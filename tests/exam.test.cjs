const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ctx = { window: {}, React: { createElement: () => null } };
vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('// BEGIN PRICE_2026_DATA'), html.indexOf('// TAB: КАЛЬКУЛЯТОР')), ctx);
ctx.window.BRITVA = { ALL_SERVICES: [], TIERS: [] };
const start = html.indexOf('(function () {', html.indexOf('// TAB: ТРЕНАЖЁР'));
const end = html.indexOf('  function TabTrainer()', start);
vm.runInContext(html.slice(start, end) + '\nwindow.examTest = { PRICE_TIERS, getPriceEntries, getExamCategories, normalizeExamAnswer, checkExamItems }; })();', ctx);
const api = ctx.window.examTest;
for (const tier of api.PRICE_TIERS) {
  const categories = api.getExamCategories(tier.key);
  const items = categories.flatMap(category => category.items);
  assert.equal(items.length, api.getPriceEntries(tier.key).length);
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
  assert(items.every(item => item.tier === tier.label && item.input === ''));
  for (const title of ctx.PRICE_2026.sharedCategories) assert(categories.some(category => category.title === title));
  assert.equal(categories.find(category => category.title.includes('АБОНЕМЕНТЫ')).items.length, 3);
  const result = api.checkExamItems(items.map(item => ({ ...item, input: String(item.correct) })));
  assert.equal(result.errors, 0);
  assert.equal(result.passed, true);
  assert.equal(api.checkExamItems(items).errors, items.length);
}
const check = (correct, input) => api.checkExamItems([{ correct, input }]).checked[0].ok;
assert(check(0, '0'));
assert(!check(0, ''));
assert(check(1690, '1 690'));
assert(!check(1690, '1690-2000'));
assert(!check(1690, '1690abc'));
for (const answer of ['2000-4000', '2 000 – 4 000', '2000—4000 ₽']) assert(check('2 000–4 000 ₽', answer));
for (const answer of ['', '2000', '3000', '4000-2000', '2000-4500', '20004000', '2000--4000']) assert(!check('2 000–4 000 ₽', answer));
const fixture = { title: 'Fixture', items: [{ name: 'Free', prices: [0, null] }, { name: 'Missing', prices: [null, null] }] };
ctx.PRICE_2026.groups[0].categories.push(fixture);
assert(api.getExamCategories('barber:0').some(category => category.items.some(item => item.name === 'Free' && item.correct === 0)));
assert(!api.getExamCategories('barber:1').some(category => category.title === 'Fixture'));
ctx.PRICE_2026.groups[0].categories.pop();
for (const [count, errors, passed] of [[10,2,true], [10,3,false], [3,1,true], [3,2,false]]) {
  const items = Array.from({ length: count }, (_, index) => ({ correct: 100, input: index < errors ? '0' : '100' }));
  assert.equal(api.checkExamItems(items).passed, passed);
}
console.log('PASS: exam categories and all prices match six 2026 grades; ranges, zero/missing answers, subscriptions and original pass threshold.');
