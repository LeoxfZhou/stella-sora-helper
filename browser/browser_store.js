(function(root) {
  const KEY = 'stella-sora-save-v1';
  function validate(value) {
    if (!value || value.format !== 'stella-sora-save' || value.version !== 1 || !Array.isArray(value.roster) || !['zh','en'].includes(value.language)) throw new Error('Invalid Stella Sora save / 存档格式不正确');
    const seen = new Set();
    const roster = value.roster.map(r => {
      if (!r || !/^trekker_\d+$/.test(r.id) || seen.has(r.id) || typeof r.owned !== 'boolean' || !Number.isInteger(r.level) || r.level < 1 || r.level > 90) throw new Error('Invalid roster / 旅人数据不正确');
      seen.add(r.id); return {id:r.id, owned:r.owned, level:r.level};
    });
    return {format:'stella-sora-save', version:1, language:value.language, roster};
  }
  function create(storage) {
    return {
      load() { const raw = storage.getItem(KEY); return raw ? validate(JSON.parse(raw)) : {format:'stella-sora-save', version:1, language:'zh', roster:[]}; },
      save(value) { const clean = validate(value); storage.setItem(KEY, JSON.stringify(clean)); return clean; }
    };
  }
  const api = {KEY,validate,create};
  if (typeof module !== 'undefined') module.exports = api;
  else root.StellaStore = api;
})(globalThis);
