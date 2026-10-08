const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ctx = { window: {}, React: { createElement: () => null }, Math: Object.create(Math), _toConsumableArray: value => Array.from(value) };
vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf('// BEGIN PRICE_2026_DATA'), html.indexOf('// TAB: КАЛЬКУЛЯТОР')), ctx);
ctx.window.BRITVA = { ALL_SERVICES: [{ label: 'Legacy only', prices: [11, 22, 33, 44] }], TIERS: ['old1', 'old2', 'old3', 'old4'] };
const originalLegacy = JSON.stringify(ctx.window.BRITVA);
const trainerStart = html.indexOf('(function () {', html.indexOf('// TAB: ТРЕНАЖЁР'));
const trainerEnd = html.indexOf('// ── ЗАЧЁТ ПРАЙСА', trainerStart);
vm.runInContext(html.slice(trainerStart, trainerEnd) + '\nwindow.trainerTest = { PRICE_TIERS, getPriceEntries, makePriceQuestion, makeServiceQuestion, priceKey, pricesOverlap, formatPriceAnswer, makeQuestion }; })();', ctx);
const api = ctx.window.trainerTest;
assert.deepEqual(Array.from(api.PRICE_TIERS, tier => tier.label), ['БАРБЕР', 'БАРБЕР+', 'ТОП-БАРБЕР', 'ТОП+', 'БРЕНД-БАРБЕР', 'БРЕНД-БАРБЕР+']);
for (const tier of api.PRICE_TIERS) {
  const entries = api.getPriceEntries(tier.key);
  const expected = ctx.window.BRITVA_PRICE.getCategories(tier.group).flatMap(category => category.items
    .filter(item => item.prices[tier.index] !== null)
    .map(item => ({ name: item.name, price: item.prices[tier.index] })));
  assert.deepEqual(Array.from(entries, entry => ({ name: entry.name, price: entry.price })), Array.from(expected));
  assert(entries.some(entry => entry.category.includes('АБОНЕМЕНТЫ')));
  for (const title of ctx.PRICE_2026.sharedCategories) assert(entries.some(entry => entry.category === title));
  for (let i = 0; i < 50; i++) {
    const question = api.makePriceQuestion(tier.key);
    assert.equal(question.prompt.tier, tier.label);
    assert(entries.some(entry => entry.name === question.prompt.title && entry.price === question.correctValue));
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map(option => option.value)).size, 4);
    assert.equal(question.options.filter(option => option.value === question.correctValue).length, 1);
    for (const option of question.options) assert(entries.some(entry => entry.price === option.value));
  }
  for (let i = 0; i < entries.length; i++) {
    ctx.Math.random = () => (i + 0.5) / entries.length;
    const question = api.makeServiceQuestion(tier.key);
    assert.equal(question.mode, 'service');
    assert.equal(question.prompt.tier, tier.label);
    assert.equal(question.prompt.title, api.formatPriceAnswer(entries[i].price));
    assert.equal(question.correctValue, entries[i].name);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map(option => option.value)).size, 4);
    const matching = question.options.filter(option => entries.some(entry => entry.name === option.value && api.priceKey(entry.price) === api.priceKey(question.prompt.title)));
    assert.equal(matching.length, 1, 'Exactly one offered service must have the given price');
    assert.equal(matching[0].value, question.correctValue);
    for (const option of question.options) assert(entries.some(entry => entry.name === option.value));
    for (const option of question.options.filter(option => option.value !== question.correctValue)) {
      assert(entries.filter(entry => entry.name === option.value).every(entry => !api.pricesOverlap(entry.price, entries[i].price)));
    }
  }
  delete ctx.Math.random;
}
assert.equal(api.getPriceEntries('unknown').length, 0);
const fixture = { title: 'Fixture', items: [{ name: 'Free', prices: [0, null] }, { name: 'Missing', prices: [null, null] }] };
ctx.PRICE_2026.groups[0].categories.push(fixture);
assert(api.getPriceEntries('barber:0').some(entry => entry.name === 'Free' && entry.price === 0));
assert(!api.getPriceEntries('barber:1').some(entry => entry.name === 'Free'));
assert(!api.getPriceEntries('barber:0').some(entry => entry.name === 'Missing'));
const withZero = api.getPriceEntries('barber:0');
ctx.Math.random = () => (withZero.length - 0.5) / withZero.length;
assert.equal(api.makeServiceQuestion('barber:0').prompt.title, api.formatPriceAnswer(0));
delete ctx.Math.random;
fixture.items.push({name:'Same-price alias',prices:['1 690 ₽',null]});
ctx.Math.random = () => 0;
const aliasesQuestion = api.makeServiceQuestion('barber:0');
assert(!aliasesQuestion.options.some(option => option.value === 'Same-price alias'));
delete ctx.Math.random;
ctx.PRICE_2026.groups[0].categories.pop();
assert.match(api.formatPriceAnswer(0), /^0\s₽$/);
const range = api.getPriceEntries('barber:0').find(entry => typeof entry.price === 'string');
assert(range, 'Ranges must remain eligible questions');
assert.equal(api.formatPriceAnswer(range.price).replace(/\s*₽$/, ''), range.price.replace(/\s*₽$/, ''));
assert.equal(JSON.stringify(ctx.window.BRITVA), originalLegacy, 'Other trainer modes and calculator data stay unchanged');
assert.equal(api.priceKey('2 000 — 4 000 ₽'), api.priceKey('2000–4000'));
assert(api.pricesOverlap('2000–4000 ₽', 3000));
assert(api.pricesOverlap('2000–4000 ₽', '4000–5000 ₽'));
assert(!api.pricesOverlap('2000–4000 ₽', 4500));
assert(api.makeQuestion('compare').options.every(option => option.label === 'Legacy only'));
console.log('PASS: price and service quizzes use six 2026 grades; every service has one correct offered answer, shared services, subscriptions, ranges, zero/missing prices; legacy comparison data unchanged.');
