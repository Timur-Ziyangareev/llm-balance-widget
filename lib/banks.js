/** Parsers for central-bank rate pages.
 *
 *  Both return rates as "value of one unit of CODE in the bank's base currency",
 *  which is what the widget multiplies by:
 *    parseFed  -> base USD: { EUR: 1.1209, CNY: 0.1499 }
 *    parsePboc -> base CNY: { USD: 6.7165, EUR: 7.4499, RUB: 0.0828 }
 */

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Federal Reserve H.10: USD per EUR and CNY per USD, last column of the table. */
export function parseFed(html, now = new Date()) {
  if (typeof html !== 'string' || html.length < 100) return null;

  const dates = [];
  const header = /<th id="a\d"[^>]*>\s*([A-Z][a-z]{2})\.?\s*(\d{1,2})\s*<\/th>/g;
  let match;
  while ((match = header.exec(html)) !== null) {
    const month = MONTHS[match[1].toLowerCase()];
    if (month === undefined) continue;
    dates.push({ month, day: Number(match[2]) });
  }
  if (dates.length === 0) return null;
  const last = dates[dates.length - 1];

  const cellValue = (label) => {
    const block = new RegExp('<th[^>]*>[^<]*' + label + '[^<]*</th>([\\s\\S]*?)</tr>').exec(html);
    if (!block) return null;
    const cells = [...block[1].matchAll(/<td[^>]*>\s*(\d+(?:\.\d+)?)\s*<\/td>/g)].map((c) => Number(c[1]));
    if (cells.length === 0) return null;
    return cells[cells.length - 1];
  };

  const eur = cellValue('EMU MEMBERS');
  const cny = cellValue('CHINA, P\\.R\\.');
  if (!eur && !cny) return null;

  const now_ = now;
  let year = now_.getUTCFullYear();
  if (Date.UTC(year, last.month, last.day) - now_.getTime() > 180 * 864e5) year -= 1;
  const date = new Date(Date.UTC(year, last.month, last.day)).toISOString().slice(0, 10);

  const rates = {};
  if (eur) rates.EUR = eur;
  if (cny) rates.CNY = 1 / cny;
  return { date, rates, source: 'fed' };
}

/** PBOC daily fixing as published by ChinaMoney: CNY per USD, per EUR, RUB per CNY. */
export function parsePboc(payload) {
  const data = payload && payload.data;
  // ChinaMoney puts the rows at the root; older captures nested them under `data`.
  const records = payload && Array.isArray(payload.records)
    ? payload.records
    : (data && Array.isArray(data.records) ? data.records : null);
  if (!records) return null;

  const byName = {};
  for (const record of records) {
    if (record && record.vrtEName) byName[record.vrtEName] = Number(record.price);
  }

  const rates = {};
  if (isFinite(byName['USD/CNY'])) rates.USD = byName['USD/CNY'];
  if (isFinite(byName['EUR/CNY'])) rates.EUR = byName['EUR/CNY'];
  if (isFinite(byName['CNY/RUB']) && byName['CNY/RUB'] > 0) rates.RUB = 1 / byName['CNY/RUB'];
  if (Object.keys(rates).length === 0) return null;

  const date = data.lastDate ? String(data.lastDate).slice(0, 10) : null;
  return { date, rates, source: 'pboc' };
}
