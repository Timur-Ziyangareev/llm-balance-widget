import { execFile } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseFed, parsePboc } from './lib/banks.js';

/** Pages the widget is allowed to open: provider key pages only. */
const ALLOWED_HOSTS = new Set(['platform.deepseek.com', 'openrouter.ai']);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Central banks fetched server-side: the Fed and the PBOC do not send CORS headers. */
const BANK_SOURCES = {
  usd: { url: 'https://www.federalreserve.gov/releases/h10/current/', parse: parseFed },
  cny: {
    url: 'https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/fx/ccpr.json',
    parse: (text) => {
      try { return parsePboc(JSON.parse(text)); } catch (error) { return null; }
    },
  },
};

const BANK_CACHE = new Map();
const BANK_TTL = 30 * 60 * 1000;

/** Token usage lives behind the signed-in platform session, not the API key. */
const PLATFORM = 'https://platform.deepseek.com';
const PLATFORM_RECORD = 'deepseek-account-platform/default';
const USAGE_CACHE = new Map();
const USAGE_TTL = 15 * 60 * 1000;
const USAGE_MONTHS_BACK = 24;

/** Brings the browser window to the front after the tab has opened.
 *  Windows does not raise the window for a link opened from another app.
 *  Default browser first; if it cannot be matched, a single other running
 *  browser is raised (never a guess when several are open). */
const FOCUS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName Microsoft.VisualBasic
$progId = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice').ProgId
$cmd = (Get-ItemProperty "Registry::HKEY_CLASSES_ROOT\\$progId\\shell\\open\\command").'(default)'
$exe = [regex]::Match($cmd, '"([^"]+)"').Groups[1].Value
if (-not $exe) { $exe = ($cmd -split ' ')[0] }
$name = [IO.Path]::GetFileNameWithoutExtension($exe)
$known = @('opera', 'chrome', 'msedge', 'firefox', 'brave', 'vivaldi', 'browser', 'chromium', 'yandex')
$targets = @(Get-Process -Name $name | Where-Object { $_.MainWindowHandle -ne 0 })
if ($targets.Count -eq 0) {
  $running = @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $known -contains $_.ProcessName })
  if ($running.Count -eq 1) { $targets = $running }
}
foreach ($p in $targets) { [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id) }
`;

export const inject = ['webServer', 'credentials'];

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

/** The host may consume the request body, so callers pass data in the query;
 *  the body stays a fallback and a short timeout keeps the route from hanging. */
function readBody(req, timeout = 300) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    const timer = setTimeout(() => resolve(''), timeout);
    const finish = (value) => { clearTimeout(timer); resolve(value); };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 4096) { req.destroy(); finish(''); return; }
      chunks.push(chunk);
    });
    req.on('end', () => finish(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => finish(''));
  });
}

function queryParam(req, name) {
  try {
    return new URL(String(req.url || ''), 'http://127.0.0.1').searchParams.get(name) || '';
  } catch (error) { return ''; }
}

/** Open in the default browser: Electron shell first, `start` as a fallback. */
async function openInBrowser(url) {
  try {
    const electron = await import('electron');
    if (electron && electron.shell && typeof electron.shell.openExternal === 'function') {
      await electron.shell.openExternal(url);
      return true;
    }
  } catch (error) { /* fall through to the shell command */ }
  return new Promise((resolve) => {
    execFile('cmd.exe', ['/c', 'start', '', url], { windowsHide: true }, (error) => resolve(!error));
  });
}

/** Fetch text with a browser-like UA; Electron's net stack trusts the OS store,
 *  which matters behind a TLS-inspecting antivirus. */
async function fetchText(url, extraHeaders) {
  const headers = Object.assign({ 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.8' }, extraHeaders || {});
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.text();
  } catch (error) {
    try {
      const electron = await import('electron');
      const net = electron && electron.net;
      if (net && typeof net.fetch === 'function') {
        const res = await net.fetch(url, { headers });
        if (!res.ok) throw new Error('http ' + res.status);
        return await res.text();
      }
    } catch (inner) { /* keep the original error */ }
    throw error;
  }
}

/** Usage tables count every token type except the request counter. */
function sumTokens(models) {
  let total = 0;
  for (const model of models || []) {
    for (const item of (model && model.usage) || []) {
      if (!item || item.type === 'REQUEST') continue;
      const value = Number(item.amount);
      if (Number.isFinite(value)) total += value;
    }
  }
  return total;
}

function dateKey(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

async function fetchUsageMonth(token, year, month) {
  const url = PLATFORM + '/api/v0/usage/amount?month=' + month + '&year=' + year;
  const json = JSON.parse(await fetchText(url, { 'x-dsh-auth-token': token, accept: 'application/json' }));
  const data = json && json.data;
  if (!data || data.biz_code !== 0) return null;
  return data.biz_data || null;
}

/** Day, month and lifetime totals. Older months are skipped once two empty
 *  months in a row prove there is nothing before them. */
async function collectUsage(token) {
  const now = new Date();
  const today = dateKey(now);
  let day = 0;
  let month = 0;
  let all = 0;
  let emptyStreak = 0;
  for (let back = 0; back < USAGE_MONTHS_BACK; back += 1) {
    const cursor = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const biz = await fetchUsageMonth(token, cursor.getFullYear(), cursor.getMonth() + 1);
    if (!biz) break;
    const monthTotal = sumTokens(biz.total);
    all += monthTotal;
    if (back === 0) {
      month = monthTotal;
      for (const entry of biz.days || []) {
        if (entry && entry.date === today) day = sumTokens(entry.data);
      }
    }
    if (monthTotal === 0) {
      emptyStreak += 1;
      if (back > 0 && emptyStreak >= 2) break;
    } else {
      emptyStreak = 0;
    }
  }
  return { ok: true, day, month, all, date: today };
}

function focusScriptPath() {
  const path = join(tmpdir(), 'llm-balance-focus.ps1');
  if (!existsSync(path)) writeFileSync(path, FOCUS_SCRIPT, 'utf8');
  return path;
}

function focusBrowser() {
  if (process.platform !== 'win32') return;
  setTimeout(() => {
    try {
      execFile('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-WindowStyle', 'Hidden', '-File', focusScriptPath(),
      ], { windowsHide: true }, () => {});
    } catch (error) { /* ignore */ }
  }, 500);
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/llm-balance/open',
    handler: async (req, res) => {
      let url = queryParam(req, 'url');
      if (!url) {
        const raw = await readBody(req);
        try { url = String(JSON.parse(raw || '{}').url || ''); } catch (error) { url = ''; }
      }
      let parsed = null;
      try { parsed = new URL(url); } catch (error) { parsed = null; }
      if (!parsed || !/^https?:$/.test(parsed.protocol) || !ALLOWED_HOSTS.has(parsed.hostname)) {
        send(res, 400, { ok: false, reason: 'denied' });
        return;
      }
      const opened = await openInBrowser(parsed.href);
      if (opened) focusBrowser();
      send(res, opened ? 200 : 500, { ok: opened });
    },
  }), 'llm-balance: open');

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/llm-balance/bank',
    handler: async (req, res) => {
      let base = queryParam(req, 'base');
      if (!base) {
        const raw = await readBody(req);
        try { base = String(JSON.parse(raw || '{}').base || ''); } catch (error) { base = ''; }
      }
      base = base.toLowerCase();
      const source = BANK_SOURCES[base];
      if (!source) { send(res, 400, { ok: false, reason: 'unknown-base' }); return; }

      const cached = BANK_CACHE.get(base);
      if (cached && Date.now() - cached.at < BANK_TTL) { send(res, 200, cached.body); return; }

      try {
        const parsed = source.parse(await fetchText(source.url));
        if (!parsed) { send(res, 502, { ok: false, reason: 'parse-failed' }); return; }
        const body = { ok: true, base: base.toUpperCase(), date: parsed.date, source: parsed.source, rates: parsed.rates };
        BANK_CACHE.set(base, { at: Date.now(), body });
        send(res, 200, body);
      } catch (error) {
        send(res, 502, { ok: false, reason: String((error && error.message) || error) });
      }
    },
  }), 'llm-balance: bank');

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/llm-balance/usage',
    handler: async (req, res) => {
      const cached = USAGE_CACHE.get('usage');
      if (cached && Date.now() - cached.at < USAGE_TTL) { send(res, 200, cached.body); return; }

      try {
        const record = await ctx.credentials.readRecord(PLATFORM_RECORD);
        const token = record && record.kind === 'grant' && record.payload && record.payload.token;
        if (!token) { send(res, 200, { ok: false, reason: 'no-session' }); return; }
        const body = await collectUsage(token);
        USAGE_CACHE.set('usage', { at: Date.now(), body });
        send(res, 200, body);
      } catch (error) {
        send(res, 200, { ok: false, reason: String((error && error.message) || error) });
      }
    },
  }), 'llm-balance: usage');
}
