"""Build a public static site; never read user_data in the public build."""
import csv
import json
import shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def rows(name):
    with (ROOT / 'data' / name).open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))

def build():
    out = ROOT / 'dist'
    if out.exists():
        shutil.rmtree(out)  # Generated output only: remove stale assets from earlier builds.
    out.mkdir(exist_ok=True)
    loc = {r['id']: r for r in rows('localization.csv')}
    trekkers = []
    for r in rows('trekkers.csv'):
        t = dict(id=r['trekker_id'], name=dict(zh=r['name'], en=r['english_name']), rarity=int(r['rarity']), image='assets/trekkers/' + r['image_file'], owned=False, level=1)
        for key, field in [('element','element'),('position','position'),('attackRange','attack_range'),('style','style'),('faction','faction')]:
            t[key] = loc[r[field]]
        t['traits'] = [loc[r[f'trait{i}']] for i in range(1,4)]
        trekkers.append(t)
    tasks = [dict(id=r['task_id'], name=dict(zh=r['chinese_name'], en=r['english_name']), tier=int(r['tier']), categoryPriority=int(r['category_priority']), requirements=[loc[x] for x in r['requirements'].split('|') if x], bonuses=[loc[x] for x in r['bonuses'].split('|') if x]) for r in rows('commissions.csv')]
    (out/'database.json').write_text(json.dumps(dict(trekkers=trekkers, commissions=tasks), ensure_ascii=False), encoding='utf-8')
    emblems = json.loads((ROOT/'data/emblems/snapshot.json').read_text())
    def public_value(value):
        if isinstance(value, dict):
            return {k: public_value(v) for k,v in value.items() if k not in ('localImage', 'images', 'teamEvidence', 'sourceImage', 'code')}
        if isinstance(value, list): return [public_value(v) for v in value]
        if isinstance(value, str) and ('/assets/emblem-guides/' in value or 'hdslb.com/' in value): return None
        return value
    public = public_value(emblems)
    used = {p['source'] for p in public['profiles']}
    used.update(m.get('coreEvidence', {}).get('source') for p in public['profiles'] for m in p['team'])
    public['sources'] = {k:v for k,v in public['sources'].items() if k in used}
    (out/'emblems.json').write_text(json.dumps(public, ensure_ascii=False), encoding='utf-8')
    # Only explicitly listed public resources are copied; no raw crawls or personal input.
    for folder, target in [('trekkers','trekkers')]:
        shutil.copytree(ROOT/'data/assets'/folder, out/'assets'/target, dirs_exist_ok=True)
    for p in (ROOT/'web').iterdir():
        if not p.is_file(): continue
        text = p.read_text()
        if p.suffix in ('.js','.html'):
            text = text.replace('/placeholder.svg', 'placeholder.svg').replace('src="/', 'src="').replace('href="/style.css', 'href="style.css')
        if p.name == 'app.js':
            start = text.index('async function requestJson(')
            end = text.index('const stellaText =', start)
            text = text[:start] + 'async function requestJson(path, values = {}) { return StellaBrowser.request(path, values); }\n\n' + text[end:]
            text = text.replace("fetch('/api/stella-sora/snapshot')", "StellaBrowser.snapshotResponse()")
            text = text.replace("fetch('/api/app/snapshot')", "StellaBrowser.appResponse()")
            text = text.replace('  await showRoute();', '  await loadStella();\n  await showRoute();')
            text = text.replace("  window.StellaEmblems?.setLanguage(stellaLanguage);", "  window.StellaBrowser?.translate(stellaLanguage);\n  window.StellaEmblems?.setLanguage(stellaLanguage);")
            start = text.index("document.querySelectorAll('[data-refresh]')")
            end = text.index('async function initialize()', start)
            text = text[:start] + text[end:]
            text = text.replace("  const info = routeInfo[route] || routeInfo['stella-sora'];", "  const info = [...(routeInfo[route] || routeInfo['stella-sora'])];\n  if (route === 'app-settings') { info[0] = stellaLanguage === 'en' ? 'Data Settings' : '数据设置'; info[1] = stellaLanguage === 'en' ? 'Website data and personal saves.' : '网站资料与个人存档。'; }")
            text = text.replace('`${appState.ownedTrekkers}/${appState.trekkers} 名旅人 · ${appState.commissions} 个委托`', 'stellaCopy().stats(stellaState?.stats.owned ?? appState.ownedTrekkers, appState.trekkers, appState.commissions)')
            text = text.replace("'LOCAL OFFLINE TOOL' : '本地离线工具'", "'BROWSER LOCAL SAVE' : '浏览器本地存档'")
            text = text.replace("    const result = await requestJson(path, values);", "    for (const id of [...stellaDrafts.keys()]) await saveTrekker(id);\n    if (stellaDrafts.size) throw new Error(stellaCopy().invalidLevel);\n    const result = await requestJson(path, values);")
        if p.name == 'stella_emblems.js':
            text = text.replace("fetch('/api/stella-sora/emblems')", "fetch('emblems.json', {cache: 'no-cache'})")
            # Database image paths were originally absolute server routes.
            text = text.replace('await response.json()', "JSON.parse(JSON.stringify(await response.json()).replaceAll('/assets/', 'assets/'))")
            text = text.replace('^\\/assets\\/emblem-guides\\/', '^\\/?assets\\/emblem-guides\\/')
            text = text.replace("t('潜能参考原图','Core potential reference')", "t('潜能参考来源','Core potential source')")
            text = text.replace("source.localImage||source.images?.[p.sourceImage-1],t('打开攻略原图','Open source image')", "source.url,t('打开原文','Open original post')")
        if p.name == 'index.html':
            start = text.index('    <div class="section-title">')
            end = text.index('  </section>', start)
            text = text[:start] + '''    <article class="card"><h2 id="storage-title">数据与存档</h2><p id="storage-note">拥有状态、等级与语言只保存在当前浏览器。清除网站数据会删除存档，请定期导出备份。</p><div class="actions"><button id="export-save">导出存档</button><label class="secondary"><span id="import-label">导入存档</span> <input id="import-save" type="file" accept="application/json,.json"></label><button id="refresh-site">检查网站资料更新</button></div><p id="browser-result" role="status"></p><p id="update-note">更新将重新载入网站已发布的资料，保留个人存档。攻略随网站版本更新。</p></article>
''' + text[end:]
            text = text.replace('<script src="trekker_sort.js">', '<script src="browser_store.js"></script>\n<script src="browser.js"></script>\n<script src="trekker_sort.js">')
        (out/p.name).write_text(text)
    for p in (ROOT/'browser').glob('*.js'):
        shutil.copyfile(p, out/p.name)
    (out/'.nojekyll').touch()
    print(f'Static site: {out}; {len(trekkers)} trekkers; neutral personal defaults')

if __name__ == '__main__': build()
