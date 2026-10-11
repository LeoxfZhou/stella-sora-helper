/* Offline, source-backed recommendations; no automatic network refresh. */
(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bilingual = value => value ? `${value.zh} (${value.en || '英文待核实'})` : '';
  function sortedCharacters(characters, profiles, query = '', onlyCovered = false, sort = 'recent') {
    const covered = new Set(profiles.map(p => p.characterId));
    return characters.filter(c => (!onlyCovered || covered.has(c.id)) &&
      `${c.name.zh} ${c.name.en}`.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => (sort === 'recent' ? (b.firstBannerDate || '').localeCompare(a.firstBannerDate || '') : 0) ||
        a.name.zh.localeCompare(b.name.zh, 'zh-CN') || a.id - b.id);
  }
  function profilesFor(profiles, id) {
    return profiles.filter(p => p.characterId === id).sort((a,b) => (b.guideDate || '').localeCompare(a.guideDate || '') || a.id.localeCompare(b.id));
  }
  function formatValue(affix, rarity) {
    const value = affix.values?.find(v => v.rarity === Number(rarity))?.value;
    if (value == null) return '未提供';
    return affix.mode === 'percent' ? `${Number((value * 100).toFixed(3))}%` :
      affix.mode === 'level' ? `+${value}` : String(value);
  }
  const tierOrder = ['S','A','B','C'];
  function ranked(profile) {
    return tierOrder.map(tier => ({tier, items: (profile.ratings || []).filter(r => r.tier === tier)}));
  }
  function teammateProfile(profiles, teamId, characterId) {
    return profiles.find(p => p.teamId === teamId && p.characterId === characterId);
  }
  const api = {sortedCharacters, profilesFor, formatValue, bilingual, ranked, teammateProfile};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  root.StellaEmblems = api;
  const $ = s => document.querySelector(s);
  let data, loading, selectedId = null, profileId = null, lang = 'zh';
  const t = (zh,en) => lang === 'en' ? en : zh;
  const local = v => v?.[lang] || v?.zh || '';
  const role = r => r === 'main' || r === '主控' ? t('主控','Main') : t('援护','Support');
  const flow = p => lang === 'zh' ? p.flow : p.flowEn;
  const buildLabel = p => `${local(p.teamFlow)} · ${local(p.teamName)} · ${role(p.role)}`;
  function sourceLink(url, label) {
    return /^https:\/\/(www\.bilibili\.com|i[0-9]+\.hdslb\.com)\//.test(url || '') || /^\/assets\/emblem-guides\//.test(url || '') ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>` : escape(label);
  }
  api.setLanguage = value => {
    lang = value === 'en' ? 'en' : 'zh';
    $('#stella-emblems-tab').textContent = t('纹章推荐','Emblems');
    $('#stella-dispatch-tab').textContent = t('派遣任务','Dispatch');
    if (data) renderShell();
  };
  async function load() {
    if (data) return;
    if (loading) return loading;
    $('#stella-emblems-panel').innerHTML = `<p role="status">${t('正在读取本地资料…','Loading local data…')}</p>`;
    loading = (async () => {
      try {
        const response = await fetch('/api/stella-sora/emblems');
        if (!response.ok) throw Error(t('资料加载失败，请重新启动游戏助手。','Unable to load data. Restart the game assistant.'));
        const incoming = await response.json();
        if (incoming.schemaVersion !== 2) throw Error(t('资料格式不匹配，请重新启动。','Data version mismatch. Please restart.'));
        data = incoming; renderShell();
      } catch (error) {
        data = null;
        $('#stella-emblems-panel').innerHTML = `<p role="alert">${escape(error.message)}</p><button id="emblem-retry">${t('重试','Retry')}</button>`;
        $('#emblem-retry').onclick = load;
      } finally { loading = null; }
    })();
    return loading;
  }
  function renderShell() {
    const search = $('#emblem-search')?.value || '', sort = $('#emblem-sort')?.value || 'recent', covered = $('#emblem-covered')?.checked || false;
    $('#stella-emblems-panel').innerHTML = `<div class="emblem-summary"><div><b>${t('选旅人，看队伍，按优先级配纹章','Choose a trekker, team and emblem priorities')}</b><p>${t('S 关键／必需 · A 推荐 · B 可用 · C 少量收益；低于 C 不展示。','S Essential · A Recommended · B Usable · C Marginal; below C is hidden.')}</p></div><span class="badge">${t('图鉴更新','Database updated')} ${escape(data.checkedAt)}</span></div>
      <div class="emblem-layout"><aside class="card emblem-picker"><label for="emblem-search">${t('查找旅人','Find a trekker')}</label><input id="emblem-search" type="search" placeholder="${t('旅人名称','Trekker name')}"><div class="emblem-filter"><select id="emblem-sort" aria-label="${t('排序','Sort')}"><option value="recent">${t('最近首次卡池记录','First banner: newest')}</option><option value="name">${t('名称排序','Name')}</option></select><label><input id="emblem-covered" type="checkbox">${t('仅有推荐','With guides')}</label></div><p id="emblem-count" class="note"></p><div id="emblem-character-list"></div><p class="note">${t('按最早卡池记录排序，不代表攻略最新或角色强度。','Sorted by earliest recorded banner, not guide freshness or strength.')}</p></aside><section id="emblem-detail" class="card emblem-detail" aria-live="polite"></section></div>
      <details class="card emblem-catalog"><summary>${t('纹章图鉴与数值对照','Emblem reference and values')}</summary><p class="note">${t('公共词条数值表：当前接口为九种纹章返回相同词条，不能据此推定各槽位可洗范围；不提供未核实的出率或锁定规则。','Shared affix value reference: the API returns identical lists for all nine emblems. This does not establish slot availability, roll rates or locking rules.')}</p><div class="emblem-filter"><select id="emblem-catalog-select" aria-label="${t('纹章','Emblem')}">${data.emblems.map(e=>`<option value="${e.id}">${escape(bilingual(e.name))}</option>`).join('')}</select><input id="emblem-affix-search" type="search" placeholder="${t('搜索词条','Search affixes')}"><select id="emblem-rarity" aria-label="${t('品质','Rarity')}">${[t('彩色','Rainbow'),t('金色','Gold'),t('蓝色','Blue'),t('绿色','Green')].map((s,i)=>`<option value="${i+1}">${s}</option>`).join('')}</select></div><div id="emblem-affix-table"></div></details>
      <p class="note">${t('分级是基于所选攻略和流派的整理判断，不是精确增伤计算。未收录／未核实不等于无用；同级不强行排名。攻略核对日期：','Tiers are editorial judgments for the selected guide and build, not damage calculations. Missing or unverified does not mean useless; items within a tier are not ordered. Guide review: ')}${escape(data.recommendationsCheckedAt)} · <a href="https://stella.ennead.cc/emblems" target="_blank" rel="noopener noreferrer">StellaBase</a></p>`;
    $('#emblem-search').value=search; $('#emblem-sort').value=sort; $('#emblem-covered').checked=covered;
    $('#emblem-search').oninput=renderList; $('#emblem-sort').onchange=renderList; $('#emblem-covered').onchange=renderList;
    $('#emblem-catalog-select').onchange=renderCatalog; $('#emblem-rarity').onchange=renderCatalog; $('#emblem-affix-search').oninput=renderCatalog;
    renderList();renderCatalog();
  }
  function renderList() {
    let characters=sortedCharacters(data.characters,data.profiles,$('#emblem-search').value,$('#emblem-covered').checked,$('#emblem-sort').value);
    if ($('#emblem-sort').value==='name') characters.sort((a,b)=>local(a.name).localeCompare(local(b.name),lang));
    if (!characters.some(c=>c.id===selectedId)) { selectedId=characters[0]?.id ?? null;profileId=null; }
    $('#emblem-count').textContent=t(`${characters.length} 位旅人`,`${characters.length} trekkers`);
    $('#emblem-character-list').innerHTML=characters.map(c=>`<button type="button" class="emblem-character ${c.id===selectedId?'selected':''}" data-emblem-character="${c.id}" aria-pressed="${c.id===selectedId}"><img src="${escape(c.image)}" alt="" loading="lazy"><span><b>${escape(local(c.name))}</b><small>${escape(c.firstBannerDate || t('首次记录未知','First banner unknown'))}</small><small>${profilesFor(data.profiles,c.id).length} ${t('套方案','builds')}</small></span></button>`).join('') || t('没有匹配旅人。','No matching trekkers.');
    document.querySelectorAll('[data-emblem-character]').forEach(b=>b.onclick=()=>{selectedId=Number(b.dataset.emblemCharacter);profileId=null;renderList();});renderDetail();
  }
  function coreCards(member) {
    if (!member?.cores.length) return `<div class="emblem-core pending">${t('两个粉色潜能待核实','Two core potentials not yet verified')}</div>`;
    const evidence=member.coreEvidence, source=data.sources[evidence?.source];
    const reference=source ? `<small class="emblem-core-reference">${sourceLink(source.localImage || source.images?.[evidence.sourceImage-1] || source.url,t('潜能参考原图','Core potential reference'))}</small>` : '';
    const code=evidence?.code ? `<small class="emblem-core-reference">${t('攻略配队码','Guide team code')}: <code>${escape(evidence.code)}</code></small>` : '';
    return member.cores.map(key=>`<div class="emblem-core"><b>${escape(bilingual(data.terms[key].name))}</b><small>${t('粉色核心潜能','Pink core potential')}</small></div>`).join('')+reference+code;
  }
  function renderDetail() {
    const c=data.characters.find(c=>c.id===selectedId), panel=$('#emblem-detail');
    if (!c) {panel.innerHTML=t('换一个名称试试。','Try another name.');return;}
    const profiles=profilesFor(data.profiles,c.id), p=profiles.find(p=>p.id===profileId)||profiles[0]; profileId=p?.id;
    const member=p?.team?.find(m=>m.characterId===c.id);
    const head=`<div class="emblem-character-heading"><img src="${escape(c.image)}" alt=""><div><h3>${escape(local(c.name))}</h3><p class="note">${escape(local(c.element))} · ${c.rarity}★</p></div><div class="emblem-selected-cores">${p?coreCards(member):''}</div></div>`;
    if (!p) {panel.innerHTML=head+`<p>${t('暂无已核实方案，不自动套用其他旅人的推荐。','No verified build yet. Other trekkers’ recommendations are not substituted.')}</p>`;return;}
    const source=data.sources[p.source];
    const teammates=p.team.filter(m=>m.characterId!==c.id).map(m=>{const a=data.characters.find(x=>x.id===m.characterId);return `<article class="emblem-teammate"><div class="emblem-team-heading"><img src="${escape(a.image)}" alt=""><b>${escape(local(a.name))}</b><span class="badge">${role(m.role)}</span><button type="button" class="secondary emblem-team-jump" data-team-jump="${m.characterId}">${t('查看本队纹章','Emblems in this team')}</button></div><div class="emblem-core-pair">${coreCards(m)}</div></article>`;}).join('');
    const labels={S:t('关键／必需','Essential'),A:t('推荐','Recommended'),B:t('可用','Usable'),C:t('少量收益','Marginal')};
    panel.innerHTML=head+`<label for="emblem-build">${t('流派与队伍位置','Build and team role')}</label><select id="emblem-build">${profiles.map(x=>`<option value="${escape(x.id)}" ${x.id===p.id?'selected':''}>${escape(buildLabel(x))} · ${escape(x.guideDate||t('日期未知','Date unknown'))}</option>`).join('')}</select>
      <div class="emblem-team" aria-label="${t('固定队友','Fixed teammates')}">${teammates}</div>
      <p class="emblem-context"><span class="badge">${role(p.role)}</span> ${escape(flow(p))} <span class="note">${t('按当前队伍与流派分级','Tiers for this team and build')}</span></p>
      <div class="emblem-tier-list">${ranked(p).filter(g=>g.items.length).map(g=>`<article class="emblem-tier tier-${g.tier}"><h4><b>${g.tier}</b> ${labels[g.tier]}</h4><ul>${g.items.map(r=>{
        const slots=p.rows.filter(row=>row.choices.some(c=>c.terms.includes(r.term))).map(row=>row.label.match(/70|80|90/)?.[0]).filter(Boolean);
        const boosts=[...new Set(p.rows.flatMap(row=>row.choices.filter(c=>c.terms.includes(r.term)&&c.boost).map(c=>c.boost)))];
        return `<li><div><b>${escape(bilingual(data.terms[r.term].name))}</b>${boosts.length?` <span class="badge">${boosts.map(n=>'+'+n).join('/')}</span>`:''}${slots.length?` <small>${[...new Set(slots)].join(' / ')}</small>`:''}</div><p class="note">${escape(local(r.reason))} <small class="emblem-rating-basis">${r.basis==='mechanism'?t('机制推导','Mechanics-based'):t('攻略参考','Guide-based')}</small></p></li>`;
      }).join('')}</ul></article>`).join('')}</div>
      <details class="emblem-source"><summary>${t('查看攻略来源与适用说明','Guide sources and context')}</summary><p>${sourceLink(source.url,t(source.title,'Original guide'))} · ${escape(source.author)}</p><p>${t('文章日期','Published')}: ${escape(source.publishedDate||t('未知','Unknown'))} · ${p.guideDateBasis==='publication'?t('参考投稿日期','Reference post date'):t('攻略图日期','Guide image date')}: ${escape(p.guideDate||t('未知','Unknown'))}</p><p>${escape(t(p.note||source.reliability,p.noteEn||'Historical guide reference; this build has not been validated against the latest patch.'))}</p><p>${t('优先参考铃儿的猫猫球；配队码还原的是攻略选择，不能把潜能等级直接当作纹章排名。标注机制推导的条目是结合当前队伍整理的建议。','Ling\'s guides have priority. Imported potential levels are guide selections, not emblem ranks. Mechanics-based entries are judgments for this specific team.')}</p>${sourceLink(source.localImage||source.images?.[p.sourceImage-1],t('打开攻略原图','Open source image'))}</details>`;
    $('#emblem-build').onchange=e=>{profileId=e.target.value;renderDetail();};
    panel.querySelectorAll('[data-team-jump]').forEach(button=>button.onclick=()=>{
      const target=teammateProfile(data.profiles,p.teamId,Number(button.dataset.teamJump));
      if (!target) return;
      selectedId=target.characterId;profileId=target.id;
      $('#emblem-search').value='';renderList();
      $('#emblem-build').focus({preventScroll:true});
      $('#emblem-detail').scrollIntoView({block:'start',behavior:'smooth'});
    });
  }
  function renderCatalog() {
    const emblem=data.emblems.find(e=>String(e.id)===$('#emblem-catalog-select').value), q=$('#emblem-affix-search').value.toLowerCase();
    $('#emblem-affix-table').innerHTML=`<div class="emblem-table-scroll"><table><thead><tr><th>${t('词条','Affix')}</th><th>${t('所选品质数值','Value at selected rarity')}</th></tr></thead><tbody>${emblem.affixes.filter(a=>bilingual(a.name).toLowerCase().includes(q)).map(a=>`<tr><td>${escape(bilingual(a.name))}</td><td>${escape(formatValue(a,$('#emblem-rarity').value))}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function switchTab(emblems) {
    $('#stella-emblems-panel').classList.toggle('hidden',!emblems);$('#stella-dispatch-panel').classList.toggle('hidden',emblems);
    for(const [id,active] of [['stella-emblems-tab',emblems],['stella-dispatch-tab',!emblems]]){$('#'+id).setAttribute('aria-selected',String(active));$('#'+id).classList.toggle('secondary',!active);}
    if(emblems)load();
  }
  $('#stella-emblems-tab').onclick=()=>switchTab(true);$('#stella-dispatch-tab').onclick=()=>switchTab(false);
  for(const id of ['stella-emblems-tab','stella-dispatch-tab']) $('#'+id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const emblems=e.key==='End'||(e.key!=='Home'&&id==='stella-dispatch-tab');switchTab(emblems);$(emblems?'#stella-emblems-tab':'#stella-dispatch-tab').focus();}};
})(typeof window !== 'undefined' ? window : globalThis);
