const StellaBrowser = (() => {
  let database, store, save, storageFailure = null;
  const ready = (async () => {
    const response = await fetch('database.json', {cache:'no-cache'});
    if(!response.ok) throw new Error('Cannot load database / 无法加载资料');
    database = await response.json();
    store = StellaStore.create(localStorage);
    try { save = store.load(); } catch(e) {
      storageFailure = e;
      save = {format:'stella-sora-save',version:1,language:'zh',roster:[]};
    } // Keep damaged bytes intact; only explicit import may replace them.
  })();
  function snapshot() {
    const entries = new Map(save.roster.map(r=>[r.id,r]));
    const trekkers = database.trekkers.map(t=>({...t,...entries.get(t.id)}));
    return {trekkers,commissions:database.commissions,preferences:{language:save.language,warning:storageFailure ? '浏览器存档损坏，请到数据设置导入备份。原存档未覆盖。' : ''},stats:{total:trekkers.length,owned:trekkers.filter(t=>t.owned).length,tasks:database.commissions.length}};
  }
  function commit(next, importing=false) {
    if(storageFailure && !importing) throw new Error('Import a backup first / 请先导入备份恢复存档');
    save = store.save(next); storageFailure = null;
  }
  async function request(path, values) {
    await ready;
    if(path.endsWith('/roster')) {
      if(!database.trekkers.some(t=>t.id===values.trekker_id) || !['true','false'].includes(values.owned)) throw new Error('Invalid trekker');
      const roster = save.roster.filter(t=>t.id!==values.trekker_id);
      roster.push({id:values.trekker_id,owned:values.owned==='true',level:Number(values.level)});
      commit({...save,roster}); return {ok:true};
    }
    if(path.endsWith('/preferences')) {commit({...save,language:values.language}); return {ok:true};}
    if(path.includes('/solve-')) return new Promise((resolve,reject)=>{
      const worker = new Worker('solver.js');
      worker.onmessage = ({data})=>{worker.terminate(); data.error ? reject(new Error(data.error)) : resolve(data.result);};
      worker.onerror = e=>{worker.terminate();reject(new Error(e.message));};
      worker.postMessage({database:snapshot(),tasks:path.endsWith('training') ? values.tasks.split(',') : undefined});
    });
    throw new Error('Unsupported action');
  }
  function translate(lang) {
    const en = lang==='en';
    const copy = {
      'storage-title':en?'Data and saves':'数据与存档',
      'storage-note':en?'Ownership, levels and language are saved only in this browser. Export backups before clearing site data.':'拥有状态、等级与语言只保存在当前浏览器。清除网站数据会删除存档，请定期导出备份。',
      'export-save':en?'Export save':'导出存档','import-label':en?'Import save':'导入存档',
      'refresh-site':en?'Check website data updates':'检查网站资料更新',
      'update-note':en?'Reload published website data while keeping your save. Recommendations update with the website.':'重新载入网站已发布的资料，保留个人存档。攻略随网站版本更新。'
    };
    for(const [id,text] of Object.entries(copy)) {const el=document.getElementById(id); if(el) el.textContent=text;}
    document.documentElement.lang=en?'en':'zh-CN';
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const result=document.getElementById('browser-result');
    document.getElementById('export-save').onclick=async()=>{
      try {
        await ready;
        for(const id of [...stellaDrafts.keys()]) await saveTrekker(id);
        if(stellaDrafts.size) throw new Error(stellaCopy().invalidLevel);
        if(storageFailure) throw new Error('Stored save is damaged / 原存档损坏，未导出空白存档');
        const url=URL.createObjectURL(new Blob([JSON.stringify(save,null,2)],{type:'application/json'}));
        const a=document.createElement('a'); a.href=url;a.download='stella-sora-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      } catch(e){result.textContent=e.message;}
    };
    document.getElementById('import-save').onchange=async event=>{
      try {
        await ready;
        const file=event.target.files[0]; if(!file)return;
        if(file.size>2e6)throw new Error('Save too large / 存档过大');
        const next=StellaStore.validate(JSON.parse(await file.text()));
        const en=save.language==='en';
        if(!confirm(en?'Replace this browser’s save with the imported save? Export a backup first if needed.':'用导入的存档替换此浏览器存档？如需保留当前配置，请先导出备份。'))return;
        commit(next,true);
        for(const timer of stellaSaveTimers.values())clearTimeout(timer);
        stellaDrafts.clear();stellaSaveTimers.clear();
        location.reload();
      }catch(e){result.textContent=e.message;}
      finally{event.target.value='';}
    };
    document.getElementById('refresh-site').onclick=async()=>{
      try { await ready;
        for(const id of [...stellaDrafts.keys()])await saveTrekker(id);
        if(stellaDrafts.size)throw new Error(stellaCopy().invalidLevel);
        const response=await fetch('database.json',{cache:'reload'});
        if(!response.ok)throw new Error('Update unavailable / 暂时无法更新');
        const next=await response.json();
        if(!Array.isArray(next.trekkers)||!Array.isArray(next.commissions))throw new Error('Invalid update');
        location.reload();
      }catch(e){result.textContent=e.message;}
    };
  });
  return {request,translate,async snapshotResponse(){await ready;return {ok:true,json:async()=>snapshot()};},async appResponse(){await ready;const s=snapshot();return {ok:true,json:async()=>({game:'stella_sora',trekkers:s.stats.total,ownedTrekkers:s.stats.owned,commissions:s.stats.tasks})};}};
})();
window.StellaBrowser = StellaBrowser;
