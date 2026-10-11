function compareTrekkers(left, right, sort, language = 'zh') {
  let compared = 0;
  if (sort === 'level-desc') compared = right.level - left.level || right.rarity - left.rarity;
  else if (sort === 'level-asc') compared = left.level - right.level || right.rarity - left.rarity;
  else if (sort === 'rarity-desc') compared = right.rarity - left.rarity || right.level - left.level;
  else if (sort === 'rarity-asc') compared = left.rarity - right.rarity || right.level - left.level;
  else compared = right.level - left.level || right.rarity - left.rarity;

  const localizedName = value => value.name?.[language] || value.name?.zh || value.name?.en || '';
  const locale = language === 'zh' ? 'zh-CN' : 'en';
  return compared || localizedName(left).localeCompare(localizedName(right), locale) ||
    left.id.localeCompare(right.id);
}

if (typeof module !== 'undefined') module.exports = {compareTrekkers};
