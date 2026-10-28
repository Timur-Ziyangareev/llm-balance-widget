import { execFile } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Pages the widget is allowed to open: provider key pages only. */
const ALLOWED_HOSTS = new Set(['platform.deepseek.com', 'openrouter.ai']);

/** Brings the default browser window to the front after the tab has opened.
 *  Windows does not raise the window for a link opened from another app. */
const FOCUS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName Microsoft.VisualBasic
$progId = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice').ProgId
$cmd = (Get-ItemProperty "Registry::HKEY_CLASSES_ROOT\\$progId\\shell\\open\\command").'(default)'
$exe = [regex]::Match($cmd, '"([^"]+)"').Groups[1].Value
if (-not $exe) { $exe = ($cmd -split ' ')[0] }
$name = [IO.Path]::GetFileNameWithoutExtension($exe)
foreach ($p in Get-Process -Name $name) {
  if ($p.MainWindowHandle -ne 0) { [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id) }
}
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
}
