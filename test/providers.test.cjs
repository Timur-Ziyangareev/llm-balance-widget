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
const { parseRates, parseDeepSeek, parseOpenRouter, toUsd, hasRates, factorTo, fromUsd, fmtTokens } = mod._test;

// CBR payload: Nominal is 10 for CNY and 100 for KZT.
const rates = parseRates({
  Date: '2026-10-28T11:30:00+03:00',
  Valute: {
    USD: { Nominal: 1, Value: 92.5, Previous: 92.0 },
    EUR: { Nominal: 1, Value: 100.9, Previous: 101.9 },
    CNY: { Nominal: 10, Value: 129.8, Previous: 129.3 },
    KZT: { Nominal: 100, Value: 18.4, Previous: 18.3 },
    UAH: { Nominal: 10, Value: 22.1, Previous: 22.4 },
    BYN: { Nominal: 1, Value: 27.3, Previous: 27.2 },
  },
});
assert.strictEqual(rates.usd, 92.5);
assert.strictEqual(rates.cny, 12.98);
assert.strictEqual(rates.eur, 100.9);
assert.strictEqual(rates.kzt.toFixed(6), '0.184000');
assert.strictEqual(rates.uah.toFixed(6), '2.210000');
assert.strictEqual(rates.byn, 27.3);
assert.strictEqual(rates.change.usd.toFixed(6), (0.5 / 92.0).toFixed(6));
assert.strictEqual(rates.change.eur.toFixed(6), (-1.0 / 101.9).toFixed(6));
assert.strictEqual(rates.date, '2026-10-28T11:30:00+03:00');

// A cache from an older widget version must not be reused.
assert.strictEqual(hasRates(rates), true);
assert.strictEqual(hasRates({ usd: 92.5, cny: 12.98, date: rates.date }), false);
assert.strictEqual(hasRates(null), false);

// Converter target: any supported currency, RUB included.
assert.strictEqual(factorTo('USD', 'RUB', rates), 92.5);
assert.strictEqual(factorTo('USD', 'USD', rates), 1);
assert.strictEqual(factorTo('USD', 'CNY', rates).toFixed(6), (92.5 / 12.98).toFixed(6));
assert.strictEqual(factorTo('RUB', 'USD', rates).toFixed(6), (1 / 92.5).toFixed(6));
assert.strictEqual(factorTo('CNY', 'USD', rates).toFixed(6), (12.98 / 92.5).toFixed(6));
assert.strictEqual(fromUsd(10, 'USD', rates), 10);
assert.strictEqual(fromUsd(10, 'RUB', rates), 925);
assert.strictEqual(fromUsd(10, 'CNY', rates).toFixed(6), (10 * 92.5 / 12.98).toFixed(6));

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

// A zero USD wallet must not hide a funded CNY wallet.
const dsMixed = parseDeepSeek({
  balance_infos: [
    { currency: 'USD', total_balance: '0.00', granted_balance: '0.00', topped_up_balance: '0.00' },
    { currency: 'CNY', total_balance: '18.51', granted_balance: '0.00', topped_up_balance: '18.51' },
  ],
});
assert.strictEqual(dsMixed.currency, 'CNY');
assert.strictEqual(dsMixed.amount, 18.51);

// Everything empty -> still USD, so the widget shows 0,00 $.
const dsEmpty = parseDeepSeek({
  balance_infos: [
    { currency: 'CNY', total_balance: '0.00' },
    { currency: 'USD', total_balance: '0.00' },
  ],
});
assert.strictEqual(dsEmpty.currency, 'USD');
assert.strictEqual(dsEmpty.amount, 0);

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
