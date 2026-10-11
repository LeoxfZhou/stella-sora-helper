const assert = require('node:assert/strict');
const {compareTrekkers} = require('../web/trekker_sort.js');

const trekkers = [
  {id: 'b', level: 70, rarity: 4, name: {zh: '乙', en: 'Beta'}},
  {id: 'a', level: 70, rarity: 5, name: {zh: '甲', en: 'Alpha'}},
  {id: 'c', level: 20, rarity: 5, name: {zh: '丙', en: 'Gamma'}},
  {id: 'd', level: 1, rarity: 3, name: {zh: '丁', en: 'Delta'}},
];

const ids = sort => [...trekkers].sort((a, b) => compareTrekkers(a, b, sort, 'zh')).map(value => value.id);
assert.deepEqual(ids('level-desc'), ['a', 'b', 'c', 'd']);
assert.deepEqual(ids('level-asc'), ['d', 'c', 'a', 'b']);
assert.deepEqual(ids('rarity-desc'), ['a', 'c', 'b', 'd']);
assert.deepEqual(ids('rarity-asc'), ['d', 'b', 'a', 'c']);

const same = [
  {id: 'z', level: 10, rarity: 4, name: {zh: '同名', en: 'Same'}},
  {id: 'a', level: 10, rarity: 4, name: {zh: '同名', en: 'Same'}},
];
assert.deepEqual(same.sort((a, b) => compareTrekkers(a, b, 'level-desc', 'zh')).map(value => value.id), ['a', 'z']);
console.log('trekker sorting tests passed');
