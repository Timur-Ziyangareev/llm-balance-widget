import assert from 'node:assert';
import { parseFed, parsePboc } from '../lib/banks.js';

// Trimmed copy of the Federal Reserve H.10 table layout.
const FED_HTML = `<!DOCTYPE html><html><body><table><thead>
<tr>
<th id="a1" colspan="1">COUNTRY</th>
<th id="a2">CURRENCY</th>
<th id="a3">      Oct. 19 </th>
<th id="a4">      Oct. 20 </th>
<th id="a5">      Oct. 23 </th>
</tr>
</thead><tbody>
<tr>
<th id="r1" headers="a1"> *EMU MEMBERS       </th>
<td headers="a2 a1 r1">EURO     </td>
<td headers="a3 a1 r1">        1.1209</td>
<td headers="a4 a1 r1">        1.1232</td>
<td headers="a5 a1 r1">        1.1199</td>
</tr>
<tr>
<th id="r1" headers="a1">  CHINA, P.R.       </th>
<td headers="a2 a1 r1">YUAN     </td>
<td headers="a3 a1 r1">        6.6806</td>
<td headers="a4 a1 r1">        6.6779</td>
<td headers="a5 a1 r1">        6.6702</td>
</tr>
</tbody></table></body></html>`;

const fed = parseFed(FED_HTML, new Date('2026-10-28T00:00:00Z'));
assert.strictEqual(fed.date, '2026-10-23');
assert.strictEqual(fed.rates.EUR, 1.1199);
assert.strictEqual(fed.rates.CNY.toFixed(8), (1 / 6.6702).toFixed(8));
assert.strictEqual(fed.source, 'fed');

// Year rollover: a December page parsed in January belongs to the previous year.
const JANUARY = FED_HTML.replace('Oct. 19', 'Dec. 28').replace('Oct. 20', 'Dec. 29').replace('Oct. 23', 'Dec. 31');
const fedOld = parseFed(JANUARY, new Date('2027-01-05T00:00:00Z'));
assert.strictEqual(fedOld.date, '2026-12-31');

// Broken markup must not throw.
assert.strictEqual(parseFed('<html></html>', new Date()), null);

// PBOC fixing published by ChinaMoney: rows live at the root of the payload.
const pboc = parsePboc({
  data: { lastDate: '2026-10-28 9:15' },
  records: [
    { vrtEName: 'USD/CNY', price: '6.7165' },
    { vrtEName: 'EUR/CNY', price: '7.4499' },
    { vrtEName: 'CNY/RUB', price: '12.0749' },
    { vrtEName: 'JPY/CNY', price: '4.2434' },
  ],
});
assert.strictEqual(pboc.date, '2026-10-28');
assert.strictEqual(pboc.rates.USD, 6.7165);
assert.strictEqual(pboc.rates.EUR, 7.4499);
assert.strictEqual(pboc.rates.RUB.toFixed(8), (1 / 12.0749).toFixed(8));
assert.strictEqual(pboc.source, 'pboc');

// Older captures nested the rows under `data`.
const nested = parsePboc({ data: { lastDate: '2026-10-27 9:15', records: [{ vrtEName: 'USD/CNY', price: '6.70' }] } });
assert.strictEqual(nested.rates.USD, 6.7);

assert.strictEqual(parsePboc({ records: [] }), null);
assert.strictEqual(parsePboc(null), null);

console.log('banks ok');
