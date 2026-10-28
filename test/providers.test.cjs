const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

let captured = null;
const sandbox = {
  window: { __ModuleLoader__: { load(opts) { captured = opts; } } },
  console,
  fetch: () => Promise.reject(new Error('network disabled in tests')),
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'client.js'), 'utf8'), sandbox);
assert(captured, 'client.js did not call __ModuleLoader__.load');

const mod = captured.factory((name) => (name === 'react' ? { createElement() {} } : null));
assert(mod._test, 'test hooks missing');
const { parseRates, parseDeepSeek, parseOpenRouter, toUsd, fmtTokens } = mod._test;

// CBR payload with Nominal 10 for CNY.
const rates = parseRates({
  Date: '2026-10-28T11:30:00+03:00',
  Valute: {
    USD: { Nominal: 1, Value: 92.5 },
    CNY: { Nominal: 10, Value: 129.8 },
  },
});
assert.strictEqual(rates.usd, 92.5);
assert.strictEqual(rates.cny, 12.98);
assert.strictEqual(rates.date, '2026-10-28T11:30:00+03:00');

// DeepSeek: USD entry wins over CNY.
const ds = parseDeepSeek({
  is_available: true,
  balance_infos: [
    { currency: 'CNY', total_balance: '50.00', granted_balance: '0.00', topped_up_balance: '50.00' },
    { currency: 'USD', total_balance: '12.34', granted_balance: '2.00', topped_up_balance: '10.34' },
  ],
});
assert.strictEqual(ds.currency, 'USD');
assert.strictEqual(ds.amount, 12.34);
assert.strictEqual(ds.granted, 2);

// DeepSeek: falls back to CNY when USD is absent.
const dsCny = parseDeepSeek({ balance_infos: [{ currency: 'CNY', total_balance: '100' }] });
assert.strictEqual(dsCny.currency, 'CNY');
assert.strictEqual(toUsd(dsCny, rates), 100 * 12.98 / 92.5);

// DeepSeek: empty payload.
assert.strictEqual(parseDeepSeek({ balance_infos: [] }), null);

// OpenRouter: remaining = total - usage.
const or = parseOpenRouter({ data: { total_credits: 25, total_usage: 7.5 } });
assert.strictEqual(or.amount, 17.5);
assert.strictEqual(or.currency, 'USD');
assert.strictEqual(parseOpenRouter({ data: { total_credits: null } }), null);

// Token formatting per language.
assert.strictEqual(fmtTokens(44000000, 'en'), '44 M');
assert.strictEqual(fmtTokens(44000000, 'ru'), '44 млн');
assert.strictEqual(fmtTokens(812000, 'en'), '812 K');
assert.strictEqual(fmtTokens(500, 'en'), '500');

console.log('providers ok');
