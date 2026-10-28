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
  cny: { url: 'https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/fx/ccpr.json', parse: parsePboc },
};

const BANK_CACHE = new Map();
const BANK_TTL = 30 * 60 * 1000;

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

export const inject = ['webServer'];

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 4096) { req.destroy(); resolve(''); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
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
async function fetchText(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.8' } });
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.text();
  } catch (error) {
    try {
      const electron = await import('electron');
      const net = electron && electron.net;
      if (net && typeof net.fetch === 'function') {
        const res = await net.fetch(url, { headers: { 'user-agent': UA } });
        if (!res.ok) throw new Error('http ' + res.status);
        return await res.text();
      }
    } catch (inner) { /* keep the original error */ }
    throw error;
  }
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
      const raw = await readBody(req);
      let url = '';
      try { url = String(JSON.parse(raw || '{}').url || ''); } catch (error) { url = ''; }
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
      const base = String(/[?&]base=([a-z]{3})/i.exec(String(req.url || ''))?.[1] || '').toLowerCase();
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
}
