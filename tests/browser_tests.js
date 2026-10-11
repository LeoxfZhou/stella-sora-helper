const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {create,KEY,validate} = require('../browser/browser_store.js');
const {solve} = require('../browser/solver.js');
const db = JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/database.json')));
let raw=null;const storage={getItem:()=>raw,setItem:(key,value)=>{assert.equal(key,KEY);raw=value;}};
const store=create(storage);
assert.deepEqual(store.load().roster,[]);
const value={format:'stella-sora-save',version:1,language:'en',roster:[{id:'trekker_999',owned:true,level:90}]};
store.save(value);assert.deepEqual(create(storage).load(),value); // unknown future IDs survive
for(const bad of [{...value,version:2},{...value,roster:[...value.roster,...value.roster]},{...value,roster:[{id:'trekker_1',owned:'true',level:1}]},{...value,roster:[{id:'trekker_1',owned:true,level:91}]}])assert.throws(()=>store.save(bad));
assert.deepEqual(store.load(),value);
assert.throws(()=>create({getItem:()=>'{broken'}).load());
assert.throws(()=>create({setItem(){throw new Error('Quota');}}).save(value));
assert(db.trekkers.every(t=>!t.owned && t.level===1));
assert.equal(solve(db).plans.length,0);
assert.throws(()=>solve(db,['missing']));
const all={...db,trekkers:db.trekkers.map(t=>({...t,owned:true,level:90}))};
const current=solve(all);assert(current.plans.length>0);
for(const p of current.plans){
  assert.equal(p.teams.length,4);
  const ids=p.teams.flatMap(t=>t.members.map(m=>m.id));assert.equal(new Set(ids).size,ids.length);
  for(const t of p.teams){const requirements=db.commissions.find(c=>c.id===t.taskId).requirements;const traits={};for(const m of t.members)for(const x of all.trekkers.find(a=>a.id===m.id).traits)traits[x.id]=(traits[x.id]||0)+1;for(const r of requirements)assert(--traits[r.id]>=0);}
}
const selected=current.plans[0].teams.map(t=>t.taskId);
assert(selected.every(id=>db.commissions.find(t=>t.id===id).tier===3));
const trained=solve({...all,trekkers:all.trekkers.map(t=>({...t,level:1}))},selected);
assert(trained.plans.length>0);assert(trained.plans[0].training.length>0);
// Exercise masks above bit 31 independently from low-bit travelers.
const synthetic={trekkers:Array.from({length:36},(_,i)=>({id:'trekker_'+i,owned:i>=32,level:90,name:{zh:String(i)},traits:[{id:'x'}]})),commissions:Array.from({length:4},(_,i)=>({id:'task'+i,name:{zh:String(i)},tier:3,requirements:[{id:'x'}],bonuses:[],categoryPriority:i}))};
assert.equal(solve(synthetic).plans[0].teams.flatMap(t=>t.members).length,4);
console.log('Browser storage, validation, neutral defaults, dispatch and training tests passed.');
const publicEmblems=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/emblems.json')));
const publicText=JSON.stringify(publicEmblems);
assert(!publicText.includes('hdslb.com/'));
assert(!publicText.includes('localImage'));
assert(!publicText.includes('teamEvidence'));
assert(!publicText.includes('/Users/'));
assert(publicEmblems.profiles.every(p=>publicEmblems.sources[p.source]));
for(const p of publicEmblems.profiles)for(const m of p.team)assert(publicEmblems.sources[m.coreEvidence.source]);
assert(!fs.existsSync(path.join(__dirname,'../dist/assets/emblem-guides')));
assert(!fs.existsSync(path.join(__dirname,'../dist/user_data')));
console.log('Public build excludes original guide images, private evidence and user saves.');
const publicApp=fs.readFileSync(path.join(__dirname,'../dist/app.js'),'utf8');
const publicPage=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
assert(!publicApp.includes("fetch('/api/"));
assert(!/(?:src|href)="\//.test(publicPage));
assert(publicPage.includes('browser_store.js'));
console.log('Static entry points support repository subpaths without the desktop API.');
