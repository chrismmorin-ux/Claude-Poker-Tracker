/**
 * shell-safe — canonical wrappers for shell-out from kit/scripts/.
 *
 * ADR-043: kit/scripts/ MUST NOT use execSync with template-literal
 * interpolation. All shell-outs in production scripts go through this
 * module. Validators reject untrusted input at the boundary.
 *
 * Zero dependencies. Pure CommonJS.
 */

'use strict';

const { spawnSync } = require('child_process');

const REPO_PATH_ALLOWED = /^[A-Za-z0-9 _\-./:\\]+$/;
const MAX_PATH_LEN = 4096;

const FORBIDDEN_REF_CHARS = /[\x00-\x1f\x7f ~^:?*\[\\`$]/;

// WS-381 / INV-F1: paths that should never be the target of a /genesis scaffold
// or /adopt install. Catches both founder typos (--target-dir ../../foo) and
// dangerous mis-pastes (--target-dir C:\Windows\System32\cwos-test).
const SYSTEM_PATH_PATTERNS = [
  /^[A-Za-z]:[\\/]Windows([\\/]|$)/i,
  /^[A-Za-z]:[\\/]Program Files( \(x86\))?([\\/]|$)/i,
  /^[A-Za-z]:[\\/]ProgramData([\\/]|$)/i,
  /^[A-Za-z]:[\\/]?$/,            // bare drive root e.g. "C:\"
  /^\/etc(\/|$)/, /^\/usr(\/|$)/, /^\/var(\/|$)/, /^\/opt(\/|$)/,
  /^\/sys(\/|$)/, /^\/proc(\/|$)/, /^\/bin(\/|$)/, /^\/sbin(\/|$)/,
  /^\/boot(\/|$)/, /^\/root(\/|$)/,
];

function rejectErr(prefix, reason, value) {
  const sample = typeof value === 'string' ? JSON.stringify(value.slice(0, 200)) : String(value);
  const err = new Error(`shell-safe: ${prefix}: ${reason} — got: ${sample}`);
  err.code = 'SHELL_SAFE_REJECTED';
  throw err;
}

function validateRepoPath(p) {
  if (typeof p !== 'string') rejectErr('rejected repo path', 'not a string', p);
  if (p.length === 0) rejectErr('rejected repo path', 'empty', p);
  if (p.trim().length === 0) rejectErr('rejected repo path', 'whitespace only', p);
  if (p.length > MAX_PATH_LEN) rejectErr('rejected repo path', `length > ${MAX_PATH_LEN}`, p);
  if (!REPO_PATH_ALLOWED.test(p)) rejectErr('rejected repo path', 'character outside allowlist', p);
}

function validateRegistryPath(p) {
  validateRepoPath(p);
  const isWinAbs = /^[A-Za-z]:[\\/]/.test(p);
  const isPosixAbs = p.startsWith('/');
  if (!isWinAbs && !isPosixAbs) rejectErr('rejected registry path', 'must be absolute', p);
}

// WS-381: validate a target-dir argument before any destructive op (safeRemove,
// recursive mkdirSync, etc.). Rejects paths that traverse out of the founder's
// dev tree (../ segments) and paths that point at system locations.
//
// Use at the top of /genesis Phase A and any future tool that takes
// founder-supplied directory args.
function validateTargetDir(p) {
  validateRepoPath(p);
  if (p.includes('..')) rejectErr('rejected target dir', 'contains .. (path traversal)', p);
  if (p.includes('\x00')) rejectErr('rejected target dir', 'contains null byte', p);
  if (p.includes('\n') || p.includes('\r')) rejectErr('rejected target dir', 'contains newline', p);
  const path = require('path');
  const resolved = path.resolve(p);
  if (resolved.includes('..')) rejectErr('rejected target dir', 'resolves to traversed path', resolved);
  // Match patterns against BOTH raw input (catches POSIX paths like /etc/foo
  // even when running on Windows where path.resolve maps them to C:\etc\foo)
  // AND resolved path (catches Windows system locations).
  for (const pattern of SYSTEM_PATH_PATTERNS) {
    if (pattern.test(p) || pattern.test(resolved)) {
      rejectErr('rejected target dir', `points at protected system location`, resolved);
    }
  }
}

function validateGitRef(ref) {
  if (typeof ref !== 'string') rejectErr('rejected git ref', 'not a string', ref);
  if (ref.length === 0) rejectErr('rejected git ref', 'empty', ref);
  if (ref.length > 1024) rejectErr('rejected git ref', 'length > 1024', ref);
  if (FORBIDDEN_REF_CHARS.test(ref)) rejectErr('rejected git ref', 'forbidden char', ref);
  if (ref.includes('..')) rejectErr('rejected git ref', 'contains ..', ref);
  if (ref.includes('@{')) rejectErr('rejected git ref', 'contains @{', ref);
  if (ref.includes('//')) rejectErr('rejected git ref', 'contains //', ref);
  if (ref.startsWith('/') || ref.endsWith('/')) rejectErr('rejected git ref', 'leading or trailing /', ref);
  if (ref.endsWith('.lock')) rejectErr('rejected git ref', 'ends with .lock', ref);
  if (ref === '@') rejectErr('rejected git ref', 'single @', ref);
}

function runGit(args, opts) {
  if (!Array.isArray(args)) throw new Error('shell-safe.runGit: args must be array');
  for (const a of args) {
    if (typeof a !== 'string') throw new Error('shell-safe.runGit: every arg must be string');
  }
  const o = opts || {};
  const r = spawnSync('git', args, {
    cwd: o.cwd,
    encoding: o.encoding || 'utf8',
    timeout: o.timeout != null ? o.timeout : 5000,
    maxBuffer: o.maxBuffer || 10 * 1024 * 1024,
    windowsHide: true,
    shell: false,
    stdio: o.stdio || ['ignore', 'pipe', 'pipe'],
  });
  return {
    ok: r.status === 0,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    code: r.status,
    error: r.error || null,
  };
}

function runGitInRepo(repoPath, args, opts) {
  validateRepoPath(repoPath);
  return runGit(args, { ...(opts || {}), cwd: repoPath });
}

function runNode(scriptPath, scriptArgs, opts) {
  if (typeof scriptPath !== 'string') throw new Error('shell-safe.runNode: scriptPath must be string');
  if (!Array.isArray(scriptArgs)) throw new Error('shell-safe.runNode: scriptArgs must be array');
  for (const a of scriptArgs) {
    if (typeof a !== 'string') throw new Error('shell-safe.runNode: every arg must be string');
  }
  const o = opts || {};
  const r = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: o.cwd,
    encoding: o.encoding || 'utf8',
    timeout: o.timeout != null ? o.timeout : 30000,
    maxBuffer: o.maxBuffer || 50 * 1024 * 1024,
    windowsHide: true,
    shell: false,
    stdio: o.stdio || ['ignore', 'pipe', 'pipe'],
  });
  return {
    ok: r.status === 0,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    code: r.status,
    error: r.error || null,
  };
}

module.exports = {
  runGit,
  runGitInRepo,
  runNode,
  validateRepoPath,
  validateRegistryPath,
  validateTargetDir,
  validateGitRef,
};
