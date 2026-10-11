let stellaState = null;
let stellaLanguage = 'zh';
let lastCommissionPlans = null;
let stellaCommissionState = 'idle';
let stellaCommissionError = '';
const stellaDrafts = new Map();
const stellaSaveTimers = new Map();
const stellaSaving = new Set();
let appState = null;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

async function requestJson(path, values = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', 'X-Azur-Token': appState?.token},
    body: new URLSearchParams(values)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作失败');
  return data;
}

const stellaText = {
  zh: {
    title: '星塔旅人助手', subtitle: '派遣任务与纹章推荐。', pageDescription: '选择派遣任务，或按旅人与流派查看中英文纹章推荐。',
    roster: '旅人仓库', search: '搜索旅人', all: '全部', owned: '已拥有', unowned: '未拥有', level: '等级',
    autoSave: '等级或拥有状态修改后会自动保存。', pending: count => `等待自动保存：${count} 项。`, saving: '正在自动保存…', saved: '已自动保存。', invalidLevel: '等级必须是1—90之间的整数。',
    levelDesc: '等级从高到低', levelAsc: '等级从低到高', rarityDesc: '稀有度从高到低', rarityAsc: '稀有度从低到高',
    commission: '委托推荐', commissionNote: '当前收益模式自动考虑全部36个任务；培养规划只允许4个不同III级任务。', current: '当前收益最大化', choose: '指定III级任务', generate: '生成培养方案', requirement: '需求',
    stats: (owned, total, tasks) => `已拥有 ${owned}/${total} · ${tasks} 个委托`, plan: rank => `方案 ${rank}`, unique: '四队全局不重复', bonus: '奖励特质', train: '需要培养：', ready: '当前等级已经全部满足。', noPlan: '当前拥有的旅人无法组成四支满足要求且互不重复的队伍。', calculating: '正在组合四支队伍…', generated: count => `已生成 ${count} 套方案。`, failed: message => `计算失败：${message}`, chooseFour: '请恰好选择4个不同的III级任务。', loadFailed: '无法读取星塔旅人数据', saveFailed: '保存失败', warning: '语言偏好文件异常'
  },
  en: {
    title: 'Stella Sora Helper', subtitle: 'Commissions and emblem recommendations.', pageDescription: 'Plan commissions or explore bilingual emblem recommendations by Trekker and build.',
    roster: 'Trekker Roster', search: 'Search Trekkers', all: 'All', owned: 'Owned', unowned: 'Not Owned', level: 'Level',
    autoSave: 'Level and ownership changes are saved automatically.', pending: count => `${count} change${count === 1 ? '' : 's'} waiting to save.`, saving: 'Saving automatically…', saved: 'Saved automatically.', invalidLevel: 'Level must be an integer from 1 to 90.',
    levelDesc: 'Level: High to Low', levelAsc: 'Level: Low to High', rarityDesc: 'Rarity: High to Low', rarityAsc: 'Rarity: Low to High',
    commission: 'Commission Recommendations', commissionNote: 'Current-reward mode considers all 36 commissions; training plans use exactly four distinct Tier III commissions.', current: 'Maximize Current Rewards', choose: 'Choose Tier III Commissions', generate: 'Generate Training Plans', requirement: 'Requires',
    stats: (owned, total, tasks) => `Owned ${owned}/${total} · ${tasks} commissions`, plan: rank => `Plan ${rank}`, unique: 'No Trekker Reuse', bonus: 'Bonus traits', train: 'Training needed: ', ready: 'All current levels already meet the requirements.', noPlan: 'Your owned Trekkers cannot form four valid non-overlapping teams.', calculating: 'Building four teams…', generated: count => `Generated ${count} plans.`, failed: () => 'Calculation failed. Please check your roster and try again.', chooseFour: 'Select exactly four distinct Tier III commissions.', loadFailed: 'Unable to load Stella Sora data', saveFailed: 'Could not save the Trekker.', warning: 'The language preference file is invalid'
  }
};

const stellaCopy = () => stellaText[stellaLanguage];
const localized = value => value?.[stellaLanguage] || value?.zh || value?.en || '';
const alternateLocalized = value => value?.[stellaLanguage === 'zh' ? 'en' : 'zh'] || '';

function renderStellaControls() {
  if (!stellaState) return;
  const copy = stellaCopy();
  const selectedSort = $('#trekker-sort').value || 'level-desc';
  const selectedOwned = $('#trekker-owned').value;
  const selectedTasks = new Set([...document.querySelectorAll('#tier3-tasks input:checked')].map(input => input.value));
  const sorts = [
    ['level-desc', copy.levelDesc], ['level-asc', copy.levelAsc],
    ['rarity-desc', copy.rarityDesc], ['rarity-asc', copy.rarityAsc]
  ];
  $('#trekker-sort').innerHTML = sorts.map(([value, label]) => `<option value="${value}"${value === selectedSort ? ' selected' : ''}>${esc(label)}</option>`).join('');
  $('#trekker-owned').innerHTML = `<option value="">${copy.all}</option><option value="true"${selectedOwned === 'true' ? ' selected' : ''}>${copy.owned}</option><option value="false"${selectedOwned === 'false' ? ' selected' : ''}>${copy.unowned}</option>`;
  updateStellaSaveState();
  $('#tier3-tasks').innerHTML = stellaState.commissions.filter(task => task.tier === 3).map(task => `<label><input type="checkbox" value="${esc(task.id)}"${selectedTasks.has(task.id) ? ' checked' : ''}> <span><b>${esc(localized(task.name))}</b><small>${esc(alternateLocalized(task.name))} · ${copy.requirement} ${esc(task.requirements.map(localized).join(' + '))}</small></span></label>`).join('');
}

function applyStellaLanguage() {
  window.StellaEmblems?.setLanguage(stellaLanguage);
  if (!stellaState) return;
  const copy = stellaCopy();
  $('#stella-page-title').textContent = copy.title;
  $('#stella-page-description').textContent = copy.pageDescription;
  $('#stella-roster-title').textContent = copy.roster;
  $('#trekker-search').placeholder = copy.search;
  $('#stella-commission-title').textContent = copy.commission;
  $('#stella-commission-note').textContent = copy.commissionNote;
  $('#solve-current').textContent = copy.current;
  $('#show-training').textContent = copy.choose;
  $('#solve-training').textContent = copy.generate;
  document.querySelectorAll('[data-stella-language]').forEach(button => {
    button.classList.toggle('active', button.dataset.stellaLanguage === stellaLanguage);
    button.classList.toggle('secondary', button.dataset.stellaLanguage !== stellaLanguage);
  });
  const warning = $('#stella-preference-warning');
  warning.textContent = stellaState.preferences.warning ? (stellaLanguage === 'en' ? copy.warning : `${copy.warning}：${stellaState.preferences.warning}`) : '';
  warning.classList.toggle('hidden', !stellaState.preferences.warning);
  renderStellaControls();
  renderTrekkers();
  if (lastCommissionPlans) renderCommissionPlans(lastCommissionPlans);
  renderStellaCommissionStatus();
  if ((location.hash.replace(/^#\/?/, '') || 'home') === 'stella-sora') updateRouteHeader('stella-sora');
}

function renderStellaCommissionStatus() {
  if (!stellaState) return;
  const copy = stellaCopy();
  $('#commission-status').textContent = stellaCommissionState === 'calculating' ? copy.calculating :
    stellaCommissionState === 'generated' ? copy.generated(lastCommissionPlans?.plans.length || 0) :
    stellaCommissionState === 'failed' ? copy.failed(stellaCommissionError) : '';
}

async function loadStella() {
  const response = await fetch('/api/stella-sora/snapshot');
  if (!response.ok) throw new Error(stellaCopy().loadFailed);
  stellaState = await response.json();
  stellaLanguage = stellaState.preferences.language === 'en' ? 'en' : 'zh';
  applyStellaLanguage();
  $('#status').textContent = stellaCopy().stats(stellaState.stats.owned, stellaState.stats.total, stellaState.stats.tasks);
}

function renderTrekkers() {
  if (!stellaState) return;
  const copy = stellaCopy();
  const query = $('#trekker-search').value.trim().toLowerCase();
  const sort = $('#trekker-sort').value || 'level-desc';
  const owned = $('#trekker-owned').value;
  const trekkers = stellaState.trekkers.filter(value =>
    (!query || `${value.name.zh} ${value.name.en}`.toLowerCase().includes(query)) &&
    (!owned || String(value.owned) === owned));
  trekkers.sort((left, right) => compareTrekkers(left, right, sort, stellaLanguage));
  $('#stella-stats').textContent = copy.stats(stellaState.stats.owned, stellaState.stats.total, stellaState.stats.tasks);
  $('#status').textContent = copy.stats(stellaState.stats.owned, stellaState.stats.total, stellaState.stats.tasks);
  $('#trekker-grid').innerHTML = trekkers.map(trekker => {
    const draft = stellaDrafts.get(trekker.id);
    const owned = draft ? draft.owned : trekker.owned;
    const level = draft ? draft.level : trekker.level;
    return `<article class="trekker-card ${owned ? '' : 'unowned'}${draft ? ' dirty' : ''}"><img src="${esc(trekker.image)}" onerror="this.src='/placeholder.svg'"><div class="trekker-info"><b>${esc(localized(trekker.name))}</b><small>${esc(alternateLocalized(trekker.name))} · ${trekker.rarity}★ · ${esc(localized(trekker.element))} · ${esc(localized(trekker.position))} · ${esc(localized(trekker.attackRange))}</small><small>${esc(localized(trekker.style))} · ${esc(localized(trekker.faction))}</small><div class="trait-list">${trekker.traits.map(value => `<span>${esc(localized(value))}</span>`).join('')}</div><div class="roster-controls"><label><input id="owned-${trekker.id}" type="checkbox" ${owned ? 'checked' : ''} onchange="trackTrekkerDraft('${trekker.id}')">${copy.owned}</label><label>${copy.level} <input id="level-${trekker.id}" type="number" min="1" max="90" value="${esc(level)}" oninput="trackTrekkerDraft('${trekker.id}')"></label></div></div></article>`;
  }).join('');
  updateStellaSaveState();
}

function updateStellaSaveState(message = '') {
  const copy = stellaCopy();
  $('#stella-roster-save-status').textContent = message || (stellaSaving.size ? copy.saving :
    stellaDrafts.size ? copy.pending(stellaDrafts.size) : copy.autoSave);
}

function trackTrekkerDraft(id) {
  const owned = $(`#owned-${id}`).checked;
  const level = $(`#level-${id}`).value;
  const original = stellaState.trekkers.find(trekker => trekker.id === id);
  if (stellaSaveTimers.has(id)) clearTimeout(stellaSaveTimers.get(id));
  if (original && owned === original.owned && Number(level) === original.level) {
    stellaDrafts.delete(id);
    stellaSaveTimers.delete(id);
  } else {
    stellaDrafts.set(id, {owned, level});
    const parsed = Number(level);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 90)
      stellaSaveTimers.set(id, setTimeout(() => saveTrekker(id), 500));
  }
  updateStellaSaveState();
}

async function persistTrekker(id, draft) {
  const owned = draft.owned, level = Number(draft.level);
  if (!Number.isInteger(level) || level < 1 || level > 90) throw new Error(stellaCopy().invalidLevel);
  await requestJson('/api/stella-sora/roster', {trekker_id: id, owned: String(owned), level});
  return {owned, level};
}

async function saveTrekker(id) {
  const draft = stellaDrafts.get(id);
  if (!draft) return;
  stellaSaveTimers.delete(id);
  stellaSaving.add(id);
  updateStellaSaveState();
  try {
    const saved = await persistTrekker(id, draft);
    const current = stellaState.trekkers.find(trekker => trekker.id === id);
    current.owned = saved.owned;
    current.level = saved.level;
    if (stellaDrafts.get(id) === draft) stellaDrafts.delete(id);
    afterStellaRosterSave();
  } catch (error) {
    alert(stellaLanguage === 'zh' ? `自动保存失败：${error.message}` : stellaCopy().saveFailed);
  } finally {
    stellaSaving.delete(id);
    updateStellaSaveState(stellaDrafts.size ? '' : stellaCopy().saved);
  }
}

function afterStellaRosterSave() {
  lastCommissionPlans = null;
  stellaCommissionState = 'idle';
  $('#commission-results').innerHTML = '';
  stellaState.stats.owned = stellaState.trekkers.filter(trekker => trekker.owned).length;
  renderTrekkers();
  updateStellaSaveState(stellaCopy().saved);
}

window.addEventListener('beforeunload', event => {
  if (!stellaDrafts.size && !stellaSaving.size) return;
  event.preventDefault();
  event.returnValue = '';
});

['#trekker-search', '#trekker-sort', '#trekker-owned'].forEach(selector => {
  $(selector).oninput = renderTrekkers;
  $(selector).onchange = renderTrekkers;
});

document.querySelectorAll('[data-stella-language]').forEach(button => button.onclick = async () => {
  const next = button.dataset.stellaLanguage;
  if (next === stellaLanguage) return;
  const previous = stellaLanguage;
  stellaLanguage = next;
  applyStellaLanguage();
  try {
    await requestJson('/api/stella-sora/preferences', {language: next});
    stellaState.preferences.language = next;
    stellaState.preferences.warning = '';
    applyStellaLanguage();
  } catch (error) {
    stellaLanguage = previous;
    applyStellaLanguage();
    alert(previous === 'zh' ? error.message : 'Could not save the language preference.');
  }
});

function renderCommissionPlans(data) {
  const copy = stellaCopy();
  const nameById = new Map(stellaState.trekkers.map(value => [value.id, value.name]));
  $('#commission-results').innerHTML = data.plans.length ? data.plans.map(plan => `<article class="plan-card"><div class="team-head"><h4>${copy.plan(plan.rank)}</h4><span class="badge">${copy.unique}</span></div>${plan.teams.map(team => `<div class="commission-team"><div><b>${esc(localized(team.task))}</b><small>${esc(alternateLocalized(team.task))} · ${copy.bonus} ${team.bonus}/${team.bonusTotal}</small></div><div class="member-row">${team.members.map(member => `<span><img src="${esc(member.image)}" onerror="this.src='/placeholder.svg'"><span>${esc(localized(member.name))}<small>Lv.${member.level}${member.training ? ' → 70' : ''}</small></span></span>`).join('')}</div></div>`).join('')}${plan.training.length ? `<p class="warning">${copy.train}${plan.training.map(value => `${localized(nameById.get(value.id) || value.name)} Lv.${value.currentLevel}→${value.targetLevel}`).join(stellaLanguage === 'zh' ? '、' : ', ')}</p>` : `<p class="note">${copy.ready}</p>`}</article>`).join('') : `<p class="warning">${copy.noPlan}</p>`;
}

async function solveCommissions(path, values = {}) {
  const button = path.endsWith('current') ? $('#solve-current') : $('#solve-training');
  button.disabled = true;
  stellaCommissionState = 'calculating';
  stellaCommissionError = '';
  renderStellaCommissionStatus();
  try {
    const result = await requestJson(path, values);
    lastCommissionPlans = result;
    stellaCommissionState = 'generated';
    renderCommissionPlans(result);
    renderStellaCommissionStatus();
  } catch (error) {
    stellaCommissionState = 'failed';
    stellaCommissionError = error.message;
    renderStellaCommissionStatus();
  }
  finally { button.disabled = false; }
}

$('#solve-current').onclick = () => solveCommissions('/api/stella-sora/solve-current');
$('#show-training').onclick = () => $('#training-picker').classList.toggle('hidden');
$('#solve-training').onclick = () => {
  const tasks = [...document.querySelectorAll('#tier3-tasks input:checked')].map(input => input.value);
  if (tasks.length !== 4) { alert(stellaCopy().chooseFour); return; }
  solveCommissions('/api/stella-sora/solve-training', {tasks: tasks.join(',')});
};


const routeInfo = {"stella-sora": ["星塔旅人助手", "派遣任务与纹章推荐。"], "app-settings": ["数据设置", "手动检查离线参考资料更新。"]};

function updateRouteHeader(route) {
  const info = routeInfo[route] || routeInfo['stella-sora'];
  if (route === 'stella-sora') { info[0] = stellaCopy().title; info[1] = stellaCopy().subtitle; }
  $('#header-settings-button').textContent = stellaLanguage === 'en' ? 'Data Settings' : '数据设置';
  $('#app-eyebrow').textContent = stellaLanguage === 'en' ? 'LOCAL OFFLINE TOOL' : '本地离线工具';
  $('#app-title').textContent = info[0];
  $('#app-subtitle').textContent = info[1];
  $('#breadcrumbs').innerHTML = `<button data-route="stella-sora">${esc(stellaCopy().title)}</button><i>›</i><span>${esc(info[0])}</span>`;
  $('#breadcrumbs button').onclick = () => navigate('stella-sora');
}
async function showRoute() {
  const requested = location.hash.replace(/^#\/?/, '') || 'stella-sora';
  const selected = routeInfo[requested] ? requested : 'stella-sora';
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  $(`#page-${selected}`).classList.add('active');
  updateRouteHeader(selected);
  try {
    if (selected === 'stella-sora' && !stellaState) await loadStella();
    else $('#status').textContent = `${appState.ownedTrekkers}/${appState.trekkers} 名旅人 · ${appState.commissions} 个委托`;
  } catch (error) { $('#status').textContent = '加载失败'; alert(error.message); }
}
function navigate(route) { location.hash = `#/${route}`; }
document.querySelectorAll('[data-route]').forEach(button => button.onclick = () => navigate(button.dataset.route));
window.addEventListener('hashchange', showRoute);

document.querySelectorAll('[data-refresh]').forEach(button => button.onclick = async () => {
  const module = button.dataset.refresh, output = $('#data-refresh-result');
  button.disabled = true; output.textContent = '正在下载到暂存区并校验…';
  try {
    const preview = await requestJson('/api/data-refresh/preview', {module});
    const info = preview.modules[module], records = info.recordDiff, assets = info.assetDiff;
    const summary = `${module === "stella" ? `派遣与纹章共用 ${info.records} 位旅人；${info.emblems} 种纹章；保留 ${info.profiles} 套攻略，攻略分级不随图鉴自动更新。` : ""}资料 ${info.records} 条；记录新增 ${records.added.length}、修改 ${records.modified.length}、删除 ${records.removed.length}、无法关联 ${records.unmatched.length}；图片新增 ${assets.added.length}、修改 ${assets.modified.length}。`;
    const changed = [['新增', records.added], ['修改', records.modified], ['删除', records.removed], ['无法关联', records.unmatched]].filter(([, values]) => values.length).map(([label, values]) => `${label}：${values.slice(0, 12).join('、')}${values.length > 12 ? '…' : ''}`).join('；');
    output.textContent = changed ? `${summary} ${changed}` : `${summary} 没有记录变化。`;
    if (confirm(`${output.textContent}\n\n确认应用吗？个人仓库与进度不会被覆盖；重新双击启动后读取新数据。`)) {
      await requestJson('/api/data-refresh/apply', {module});
      output.textContent = '已原子应用参考数据。请重新启动游戏助手以载入新版本。';
    }
  } catch (error) { output.textContent = `检查失败：${error.message}。旧数据保持不变。`; }
  finally { button.disabled = false; }
});

async function initialize() {
  const response = await fetch('/api/app/snapshot');
  if (!response.ok) throw new Error('无法启动本地游戏助手');
  appState = await response.json();
  await showRoute();
}

initialize().catch(error => { $('#status').textContent = '加载失败'; alert(error.message); });
