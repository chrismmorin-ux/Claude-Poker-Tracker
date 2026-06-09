#!/usr/bin/env node
/**
 * cwos-push-preflight — pre-flight check that a `git push` to origin master
 * would succeed without a rebase/merge dance.
 *
 * WS-224 / DEC-030 / ADR-026. Used by /autopilot Step 1 to refuse trigger
 * registration when the working tree is dirty or origin has moved ahead.
 * Also usable by any other command that registers a Remote-Trigger
 * (trigger prompts clone origin/master and run autonomously — a dirty
 * tree at trigger-register time means stale context enters the autonomous
 * run, and a diverged HEAD means founder work could be clobbered by a
 * forced push that happens after the fact).
 *
 * Checks (in order, short-circuit on first failure):
 *   1. We are in a git repo (`git rev-parse --is-inside-work-tree`)
 *   2. Working tree is clean — OR only paths listed in --allow-paths are dirty
 *   3. Origin/master is reachable (`git ls-remote origin master` < timeout)
 *   4. HEAD is at or ahead of origin/master (no upstream commits we haven't
 *      merged — pushing would fast-forward or no-op)
 *
 * Flags:
 *   --allow-paths <p1,p2,...>  Comma-separated repo-relative paths that may
 *                              be dirty. Exact path match OR prefix match
 *                              when the entry ends in '/'.
 *   --timeout-ms <n>           Override ls-remote timeout (default 10000).
 *   --quiet                    Silent unless blocked.
 *   --json                     Machine-readable JSON only; no bundle noise.
 *
 * Exits:
 *   0 = push would succeed
 *   1 = blocked (dirty tree, unreachable origin, diverged HEAD, or other
 *       structural failure)
 *
 * Output:
 *   Default — cwos-context-bundle emitted to stdout; human-readable
 *   summary to stderr on failure.
 *   With --json — single JSON object to stdout, nothing to stderr.
 *
 * Usage:
 *   node kit/scripts/cwos-push-preflight.js
 *   node kit/scripts/cwos-push-preflight.js --allow-paths .claude/workstream/autopilot.yaml
 *   node kit/scripts/cwos-push-preflight.js --allow-paths .claude/workstream/
 *   node kit/scripts/cwos-push-preflight.js --json
 */

'use strict';

require('./lib/preflight');

const { execFileSync, execFile } = require('child_process');
const { emitBundle, bundleError } = require('./lib/cwos-orchestrate');

const DEFAULT_TIMEOUT_MS = 10000;

// ─── CLI ───────────────────────────────────────────────────────────────────

function parseCLI() {
  const args = process.argv.slice(2);
  const config = { allowPaths: [], timeoutMs: DEFAULT_TIMEOUT_MS, quiet: false, asJson: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--allow-paths' && args[i + 1]) {
      config.allowPaths = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    } else if (a === '--timeout-ms' && args[i + 1]) {
      config.timeoutMs = Math.max(1000, parseInt(args[++i], 10) || DEFAULT_TIMEOUT_MS);
    } else if (a === '--quiet') {
      config.quiet = true;
    } else if (a === '--json') {
      config.asJson = true;
    }
  }
  return config;
}

// ─── git helpers ───────────────────────────────────────────────────────────

function gitSync(args, opts = {}) {
  try {
    const stdout = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    return { ok: true, stdout };
  } catch (err) {
    return { ok: false, error: err.stderr || err.message || String(err), code: err.status };
  }
}

function gitAsync(args, timeoutMs) {
  return new Promise(resolve => {
    const child = execFile('git', args, { encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, error: stderr || err.message, code: err.code });
      else resolve({ ok: true, stdout });
    });
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      resolve({ ok: false, error: `ls-remote timed out after ${timeoutMs}ms`, code: 'ETIMEDOUT' });
    }, timeoutMs);
    child.on('exit', () => clearTimeout(timer));
  });
}

// ─── Check implementations ─────────────────────────────────────────────────

function checkInRepo() {
  const r = gitSync(['rev-parse', '--is-inside-work-tree']);
  if (!r.ok) return { ok: false, reason: 'not inside a git repository' };
  if (String(r.stdout).trim() !== 'true') return { ok: false, reason: 'not inside a git working tree' };
  return { ok: true };
}

/**
 * Returns { ok, dirty_paths: string[], blocking_paths: string[] }
 *
 * `dirty_paths` lists every path `git status --porcelain` reports.
 * `blocking_paths` is the subset that's NOT covered by allowPaths.
 */
function checkWorkingTreeClean(allowPaths) {
  const r = gitSync(['status', '--porcelain']);
  if (!r.ok) return { ok: false, reason: `git status failed: ${r.error}` };
  const lines = String(r.stdout).split('\n').filter(l => l.length > 0);
  const dirty = lines.map(parsePorcelainLine).filter(Boolean);

  const blocking = dirty.filter(p => !isAllowed(p, allowPaths));
  return { ok: blocking.length === 0, dirty_paths: dirty, blocking_paths: blocking };
}

/**
 * Parse one porcelain-v1 status line. Format: "XY <path>" or "R  <old> -> <new>".
 * Returns the current path, or null for rename-with-split we don't parse here.
 */
function parsePorcelainLine(line) {
  if (line.length < 4) return null;
  // Skip the two status bytes and the space.
  let rest = line.slice(3);
  // Renames: "old -> new" — take the new side.
  const arrow = rest.indexOf(' -> ');
  if (arrow !== -1) rest = rest.slice(arrow + 4);
  return rest;
}

/**
 * True if `path` matches any allowPaths entry.
 * Rules:
 *   - exact match
 *   - prefix match when the entry ends with '/'
 *   - prefix match with '/' inferred when entry has no extension AND no trailing '/' but path starts with entry + '/'
 */
function isAllowed(p, allowPaths) {
  for (const entry of allowPaths) {
    if (p === entry) return true;
    if (entry.endsWith('/') && p.startsWith(entry)) return true;
    if (!entry.includes('.') && !entry.endsWith('/') && p.startsWith(entry + '/')) return true;
  }
  return false;
}

/**
 * Fetch origin/master so subsequent `merge-base --is-ancestor` calls can
 * distinguish `behind` from `diverged`. `git ls-remote` alone returns the
 * SHA but not the objects — without the objects, `merge-base` sees the
 * remote commit as unknown and reports `diverged` even when we're
 * straightforwardly behind.
 */
async function checkOriginReachable(timeoutMs) {
  const r = await gitAsync(['fetch', '--quiet', 'origin', 'master'], timeoutMs);
  if (!r.ok) return { ok: false, reason: `origin unreachable / fetch failed: ${r.error}` };
  const sha = gitSync(['rev-parse', 'FETCH_HEAD']);
  if (!sha.ok) return { ok: false, reason: `FETCH_HEAD rev-parse failed: ${sha.error}` };
  const originSha = String(sha.stdout).trim();
  if (!originSha || originSha.length < 40) return { ok: false, reason: 'FETCH_HEAD returned no SHA' };
  return { ok: true, origin_sha: originSha };
}

/**
 * Returns one of:
 *   { ok: true, state: 'same' | 'ahead' }
 *   { ok: false, state: 'diverged' | 'behind', reason: string }
 *
 * Classification:
 *   same      — HEAD === origin_sha
 *   ahead     — origin_sha is an ancestor of HEAD (fast-forward push works)
 *   diverged  — neither is an ancestor of the other
 *   behind    — HEAD is an ancestor of origin_sha (upstream has commits we
 *               don't; pushing would be a no-op but a rebase is pending)
 */
function checkNotDiverged(originSha) {
  const head = gitSync(['rev-parse', 'HEAD']);
  if (!head.ok) return { ok: false, state: 'unknown', reason: `git rev-parse HEAD failed: ${head.error}` };
  const headSha = String(head.stdout).trim();
  if (headSha === originSha) return { ok: true, state: 'same', head_sha: headSha };

  // Is originSha an ancestor of HEAD? → HEAD is ahead.
  const originAnc = gitSync(['merge-base', '--is-ancestor', originSha, headSha]);
  if (originAnc.ok) return { ok: true, state: 'ahead', head_sha: headSha };

  // Is HEAD an ancestor of originSha? → behind (rebase pending).
  const headAnc = gitSync(['merge-base', '--is-ancestor', headSha, originSha]);
  if (headAnc.ok) return { ok: false, state: 'behind', head_sha: headSha, reason: 'origin/master has commits HEAD does not; pull --rebase before registering a trigger' };

  // Neither is ancestor of the other.
  return { ok: false, state: 'diverged', head_sha: headSha, reason: 'HEAD and origin/master have diverged; resolve locally before registering a trigger' };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const startMs = Date.now();
  const config = parseCLI();
  const errors = [];
  let blocked = false;
  const checks = {};

  const inRepo = checkInRepo();
  checks.in_repo = inRepo;
  if (!inRepo.ok) {
    blocked = true;
    errors.push(inRepo.reason);
  }

  if (!blocked) {
    const tree = checkWorkingTreeClean(config.allowPaths);
    checks.working_tree = tree;
    if (!tree.ok) {
      blocked = true;
      errors.push(`working tree dirty (${tree.blocking_paths.length} blocking path(s) outside --allow-paths)`);
    }
  }

  let reach;
  if (!blocked) {
    reach = await checkOriginReachable(config.timeoutMs);
    checks.origin_reachable = reach;
    if (!reach.ok) {
      blocked = true;
      errors.push(reach.reason);
    }
  }

  if (!blocked && reach && reach.origin_sha) {
    const div = checkNotDiverged(reach.origin_sha);
    checks.head_vs_origin = div;
    if (!div.ok) {
      blocked = true;
      errors.push(div.reason);
    }
  }

  const payload = {
    ok: !blocked,
    blocked,
    allow_paths: config.allowPaths,
    checks,
  };

  if (config.asJson) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  } else {
    emitBundle({
      command: 'push-preflight',
      script: 'cwos-push-preflight.js',
      startMs,
      errors,
      data: payload,
    });
    if (blocked && !config.quiet) {
      for (const e of errors) process.stderr.write(`push-preflight: ${e}\n`);
    }
  }

  process.exit(blocked ? 1 : 0);
}

// Only run main() when invoked directly; exports below support unit tests.
if (require.main === module) {
  main().catch(err => {
    bundleError(`push-preflight fatal: ${err.message || err}`);
  });
}

module.exports = {
  parsePorcelainLine,
  isAllowed,
  checkInRepo,
  checkWorkingTreeClean,
  checkNotDiverged,
};
