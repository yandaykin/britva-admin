const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
const start = html.indexOf('// BEGIN PRICE_2026_DATA');
const end = html.indexOf('// TAB: КАЛЬКУЛЯТОР', start);
const code = html.slice(start, end).replace('window.TabPrice = TabPrice;', 'window.TabPrice = TabPrice; window.priceTest = { getCategories, hasPrice, PriceValue };');
const ctx = { window: {}, React: { createElement: (type, props, ...children) => ({ type, props, children }), Fragment: 'fragment' } };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const { getCategories, hasPrice, PriceValue } = ctx.window.priceTest;
const data = ctx.PRICE_2026;
assert.deepEqual(Array.from(data.groups, g => g.label), ['Барбер', 'Топ-барбер', 'Бренд-барбер']);
assert.equal(hasPrice(0), true);
for (const v of [null, undefined, '', '—', '--']) assert.equal(hasPrice(v), false);
assert.match(PriceValue({ value: 0 }), /^0\s₽$/);
assert.equal(PriceValue({ value: null }).children[0], '—');
assert.equal(PriceValue({ value: '2 000–4 000 ₽' }).children.filter(v => v?.type === 'wbr').length, 1);
const expectedCounts = [63, 62, 56];
data.groups.forEach((group, i) => {
  const cats = getCategories(group);
  const services = cats.flatMap(c => c.items);
  assert.equal(services.length, expectedCounts[i]);
  for (const cat of cats) assert.equal(new Set(cat.items.map(s => s.name)).size, cat.items.length);
  for (const original of group.categories) for (const item of original.items) {
    const actual = cats.find(c => c.title === original.title)?.items.find(s => s.name === item.name);
    if (item.prices.some(hasPrice)) assert.equal(JSON.stringify(actual.prices), JSON.stringify(item.prices));
  }
  for (const title of data.sharedCategories) {
    assert.equal(JSON.stringify(cats.find(c => c.title === title)), JSON.stringify(getCategories(data.groups[0]).find(c => c.title === title)));
  }
  const hair = services.find(s => s.name === 'МУЖСКАЯ СТРИЖКА');
  assert.equal(JSON.stringify(hair.prices), JSON.stringify([[1690,1890],[2290,2500],[2900,3100]][i]));
  assert.equal(cats.find(c => c.title.includes('АБОНЕМЕНТЫ')).items.length, 3);
});
data.groups[0].categories.push({title:'Проверка',items:[{name:'Ноль',prices:[0,null]},{name:'Без цены',prices:[null,null]}]});
const fixture = getCategories(data.groups[0]).find(c => c.title === 'Проверка');
assert.equal(fixture.items.length, 1);
assert.equal(fixture.items[0].name, 'Ноль');
data.groups[0].categories.pop();
const original = JSON.stringify(data);
getCategories(data.groups[1]);
assert.equal(JSON.stringify(data), original, 'Rendering must not mutate the snapshot');
console.log('PASS: scripts parse, all source prices retained, shared categories, duplicates, ranges, zero/missing prices, subscriptions.');
