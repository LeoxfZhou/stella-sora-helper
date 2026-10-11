const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {sortedCharacters, profilesFor, formatValue} = require('../web/stella_emblems.js');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/emblems/snapshot.json')));

// Missing dates stay last and sorting does not mutate the source collection.
const input = [{id:1,name:{zh:'甲',en:'A'},firstBannerDate:null},
  {id:2,name:{zh:'乙',en:'B'},firstBannerDate:'2026-10-01'},
  {id:3,name:{zh:'丙',en:'C'},firstBannerDate:'2025-01-01'}];
assert.deepEqual(sortedCharacters(input, []).map(c=>c.id), [2,3,1]);
assert.equal(input[0].id, 1);
assert.deepEqual(sortedCharacters(input,[{characterId:3}], '',true).map(c=>c.id),[3]);
assert.equal(sortedCharacters(data.characters,data.profiles,'aLLIe')[0].name.zh,'艾蕾');
assert.equal(profilesFor(data.profiles,103).length,0); // No fabricated fallback.
const allie = profilesFor(data.profiles,139);
assert.equal(allie.length,2);
const skill = allie.find(p=>p.flow==='技能');
const mark = allie.find(p=>p.flow==='印记');
const ids = p => p.rows.flatMap(r=>r.choices.flatMap(c=>c.terms));
assert(ids(skill).includes('22'));
assert(!ids(skill).includes('24'));
assert(ids(mark).includes('24'));
assert(!ids(mark).includes('22'));
// Switching an old character to a newer team keeps both dated recommendations.
assert.equal(profilesFor(data.profiles,143)[0].guideDate,'2026-09-08');
assert.equal(formatValue({mode:'percent',values:[{rarity:1,value:0.15}]},1),'15%');
assert.equal(formatValue({mode:'level',values:[{rarity:1,value:3}]},1),'+3');
assert.equal(formatValue({mode:'flat',values:[]},1),'未提供');

const characters = new Set(data.characters.map(c=>c.id));
const profileIds = new Set();
for(const p of data.profiles) {
  assert(!profileIds.has(p.id)); profileIds.add(p.id);
  assert(characters.has(p.characterId)); assert(data.sources[p.source]);
  for(const row of p.rows) for(const choice of row.choices) for(const key of choice.terms) {
    const term=data.terms[key]; assert(term?.name.zh); assert(term?.name.en);
    if(term.kind==='potential') assert.equal(term.characterId,p.characterId);
  }
}
assert.equal(data.emblems.length,9);
console.log(`Stella emblem tests passed: ${data.characters.length} characters, ${data.profiles.length} source-backed profiles`);

const {ranked}=require('../web/stella_emblems.js');
assert.equal(data.schemaVersion,2);
assert.deepEqual(skill.team.map(m=>m.characterId),[139,160,130]);
assert.deepEqual(mark.team.map(m=>m.characterId),[139,160,127]);
assert.equal(skill.team.flatMap(m=>m.cores).length,6);
assert.equal(mark.team.flatMap(m=>m.cores).length,6);
assert.notDeepEqual(skill.team[0].cores,mark.team[0].cores);
assert.notDeepEqual(skill.team[1].cores,mark.team[1].cores);
assert.equal(mark.ratings.find(r=>r.term==='21').tier,'C');
assert(ranked(skill).flatMap(g=>g.items).length>3);
assert.equal(ranked({ratings:[{term:'x',tier:'D'}]}).flatMap(g=>g.items).length,0);
for(const p of data.profiles) {
 assert(p.flowEn);assert.equal(p.team.length,3);
 assert.equal(p.team.filter(m=>m.role==='main').length,1);
 assert.equal(new Set(p.ratings.map(r=>r.term)).size,p.ratings.length);
 for(const member of p.team) {
   assert(member.cores.length===2 || member.coreStatus==='unverified');
   for(const key of member.cores) {
     assert.equal(data.terms[key].characterId,member.characterId);
     assert.equal(data.terms[key].group,member.role==='main'?'mainCore':'supportCore');
   }
 }
}
const csv=fs.readFileSync(path.join(__dirname,'../data/trekkers.csv'),'utf8');
const csvIds=[...csv.matchAll(/^trekker_(\d+),/gm)].map(m=>Number(m[1])).sort();
assert.deepEqual(csvIds,data.characters.map(c=>c.id).sort());
console.log('Shared roster, six-core Allie builds and complete tier display passed');

const {teammateProfile}=require('../web/stella_emblems.js');
const teams=new Set(data.profiles.map(p=>p.teamId));
assert.equal(teams.size,30);
for(const p of data.profiles) {
 for(const m of p.team) {
  assert.equal(m.cores.length,2);
  const target=teammateProfile(data.profiles,p.teamId,m.characterId);
  assert(target,'Every teammate must have a recommendation in this exact team');
  assert.deepEqual(target.team,p.team);
  assert.equal(target.role,m.role==='main'?'主控':'援护');
  assert.equal(target.teamId,p.teamId);
 }
 for(const r of p.ratings) {
  assert(['guide','mechanism'].includes(r.basis));
  const term=data.terms[r.term];
  if(term.kind==='potential') {
   assert.equal(term.characterId,p.characterId);
   assert([p.role==='主控'?'mainNormal':'supportNormal','common'].includes(term.group));
  }
 }
}
const willow=profilesFor(data.profiles,160);
assert(willow.length>=7);
const windWillow=willow.find(p=>p.teamId==='team-33');
assert.equal(windWillow.role,'主控');
assert(windWillow.ratings.some(r=>r.term==='27'));
assert(!windWillow.ratings.some(r=>r.term==='28'));
const allieWillow=teammateProfile(data.profiles,'team-36',160);
assert.equal(allieWillow.role,'援护');
assert(allieWillow.ratings.some(r=>r.term==='28'));
assert(!allieWillow.ratings.some(r=>r.term==='15'));
assert(!allieWillow.ratings.some(r=>r.term.startsWith('potential:139:')));
assert.equal(teammateProfile(data.profiles,'missing',160),undefined);
assert.deepEqual(teammateProfile(data.profiles,'team-24',140).team.map(m=>m.characterId),[140,156,159]);
assert.deepEqual(teammateProfile(data.profiles,'team-25',114).team[0].cores,['potential:114:mainCore:2','potential:114:mainCore:3']);
console.log('30 complete teams: all member links, role-specific affixes, source and mechanics provenance passed');
