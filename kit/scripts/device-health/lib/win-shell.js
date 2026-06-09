/**
 * win-shell — PowerShell shellout helper for device-health detectors.
 *
 * Wraps execSync calls to powershell.exe with NoProfile + NonInteractive flags.
 * Provides a JSON-aware variant that parses ConvertTo-Json output.
 *
 * Per ADR-036 + AS-PL-2: detectors call PowerShell only for reads that
 * Node.js cannot perform natively (registry, Get-Volume, WSL state).
 * No mutating commands. No Invoke-Expression. Single-purpose helper.
 */

'use strict';

const { spawnSync } = require('child_process');

const PS_BASE_ARGS = ['-NoProfile', '-NonInteractive', '-NoLogo'];
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BUFFER = 50 * 1024 * 1024;

function isWin32() {
  return process.platform === 'win32';
}

/**
 * Run a PowerShell command, return trimmed stdout.
 * Throws on non-zero exit. Caller catches if expected to fail.
 *
 * ADR-043 / WS-306: callers MUST pass literal command strings only.
 * No template-literal interpolation of untrusted data is permitted —
 * detectors today use complex PS idioms ($_, |, Where-Object {}) so a
 * runtime metachar guard would block legitimate usage. Static
 * enforcement is via the cwos-verify.js shell-safe-pattern check
 * (INV-045) which scans for unsafe ${...} interpolation in execSync
 * call-sites under kit/scripts/.
 *
 * Uses spawnSync(shell:false) so PowerShell receives -Command as a
 * single discrete arg rather than via cmd.exe parsing.
 */
function ps(command, opts = {}) {
  if (!isWin32()) {
    throw new Error(`win-shell.ps() called on non-win32 platform (${process.platform})`);
  }
  if (typeof command !== 'string') {
    throw new Error('win-shell.ps: command must be a string');
  }
  const r = spawnSync('powershell.exe', [...PS_BASE_ARGS, '-Command', command], {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    timeout: opts.timeout || DEFAULT_TIMEOUT_MS,
    windowsHide: true,
    shell: false,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    const err = new Error(`win-shell.ps: exit code ${r.status}: ${(r.stderr || '').slice(0, 500)}`);
    err.code = r.status;
    throw err;
  }
  return String(r.stdout || '').trim();
}

/**
 * Run a PowerShell command and parse output as JSON.
 * Wraps the command in `(...) | ConvertTo-Json -Depth 10 -Compress`
 * unless the command already includes a ConvertTo-Json.
 */
function psJson(command, opts = {}) {
  const wrapped = /ConvertTo-Json/i.test(command)
    ? command
    : `(${command}) | ConvertTo-Json -Depth 10 -Compress`;
  const out = ps(wrapped, opts);
  if (!out) return null;
  try {
    return JSON.parse(out);
  } catch (err) {
    throw new Error(`win-shell.psJson: failed to parse output. Command: ${command}. Output (first 200 chars): ${out.slice(0, 200)}`);
  }
}

/**
 * Try a PS command and return null on any error.
 * Useful when the absence of an answer is itself signal (e.g. registry key missing).
 */
function tryPs(command, opts = {}) {
  try { return ps(command, opts); } catch { return null; }
}

function tryPsJson(command, opts = {}) {
  try { return psJson(command, opts); } catch { return null; }
}

module.exports = { isWin32, ps, psJson, tryPs, tryPsJson };
