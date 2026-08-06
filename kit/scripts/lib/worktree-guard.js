'use strict';

/**
 * worktree-guard.js — refuse workstream-state writes from a linked git
 * worktree (WS-532).
 *
 * WHY THIS EXISTS
 *
 * The 2026-07-26 incident had two Claude sessions writing HomeBase's single
 * working tree; a MANIFEST.yaml edit was overwritten ~60s later and git never
 * saw a conflict, because the damage happened on disk before git was involved.
 * The structural fix is one worktree per concurrent session — but only for
 * CODE. Worktrees are actively worse than the original problem for workstream
 * state, for two reasons:
 *
 *   1. `.claude/workstream/` is TRACKED — queue/, sprints/, sessions/,
 *      findings/, programs/, every *-index.yaml. A worktree gets its own
 *      forked copy. allocateNextWsId() scans the LOCAL queue dir, so two
 *      worktrees hand out the same WS-id — the SPR-018 re-issue failure that
 *      let reconcile force-complete a brand-new item.
 *
 *   2. `.claude/workstream/events/` is GITIGNORED, so it does not travel into
 *      a worktree at all. Under ADR-045 the event log is canonical and the
 *      YAMLs are materialized from it. An event appended inside a worktree
 *      goes into a stream that merges back never — the branch merge carries
 *      the YAML changes and silently drops the events that justify them.
 *
 * So: worktrees carry code, the main tree owns state. Without this guard that
 * rule is prose, and FIND-119 is this repo's own evidence that prose does not
 * hold — the AI read prog-*.yaml directly for 10 consecutive days against a
 * documented rule saying not to.
 *
 * WHAT IT COSTS
 *
 * One fs.statSync per process, cached. A linked worktree's `.git` is a FILE
 * containing `gitdir: <main>/.git/worktrees/<name>`; the main tree's `.git` is
 * a directory. That is the whole detection — no subprocess, no git dependency.
 */

const fs = require('fs');
const path = require('path');

const OVERRIDE_ENV = 'CWOS_ALLOW_WORKTREE_WRITES';

// Per-process cache keyed by the resolved repo root. Callers hit this on every
// appendEvent, and the answer cannot change within a process.
const _cache = new Map();

/**
 * Walk up from `startDir` to the first directory containing a `.git` entry.
 * Returns null if none is found before the filesystem root.
 */
function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Inspect a repo root. Returns:
 *   { linked: false }                        — main tree, or not a git repo
 *   { linked: true, root, mainTree, name }   — linked worktree
 *
 * `mainTree` is recovered from the gitdir pointer by stripping the
 * `/.git/worktrees/<name>` suffix. If the pointer is malformed we still report
 * linked:true with mainTree null — refusing without being able to name the
 * main tree is strictly better than allowing a silent fork.
 */
function inspectRoot(root) {
  const gitPath = path.join(root, '.git');
  let st;
  try { st = fs.statSync(gitPath); } catch { return { linked: false }; }
  if (!st.isFile()) return { linked: false }; // directory => main tree

  let mainTree = null;
  let name = path.basename(root);
  try {
    const pointer = fs.readFileSync(gitPath, 'utf8').trim();
    const m = pointer.match(/^gitdir:\s*(.+)$/m);
    if (m) {
      const gitdir = m[1].trim().replace(/\\/g, '/');
      const wt = gitdir.match(/^(.*)\/\.git\/worktrees\/([^/]+)\/?$/);
      if (wt) { mainTree = wt[1]; name = wt[2]; }
    }
  } catch { /* fall through — linked is already established */ }

  return { linked: true, root, mainTree, name };
}

/**
 * Classify the tree containing `fromDir` (default: cwd). Cached per repo root.
 */
function describeTree(fromDir) {
  const root = findRepoRoot(fromDir || process.cwd());
  if (!root) return { linked: false };
  if (_cache.has(root)) return _cache.get(root);
  const info = inspectRoot(root);
  _cache.set(root, info);
  return info;
}

function isLinkedWorktree(fromDir) {
  return describeTree(fromDir).linked === true;
}

function buildMessage(opName, info) {
  const lines = [
    'Refusing to write workstream state from a linked worktree.',
    '',
    `  operation:  ${opName}`,
    `  worktree:   ${info.root}`,
    `  main tree:  ${info.mainTree || '(could not resolve — check .git pointer)'}`,
    '',
    'Worktrees carry code, not state. events/ is gitignored and cannot merge',
    'back — an event appended here is lost when the branch merges. Run',
    'workstream commands from the main tree.',
    '',
    'See CLAUDE.md "Concurrent sessions" and docs/worktree-isolation.md.',
    `Deliberate override: ${OVERRIDE_ENV}=1`,
  ];
  return lines.join('\n');
}

/**
 * Throw if called from inside a linked worktree.
 *
 * @param {string} opName   what is being attempted, e.g. "append_event (sprint_approved)"
 * @param {object} [opts]
 * @param {string} [opts.fromDir]  directory to classify (default cwd)
 *
 * Deliberately NOT wrapped in the codebase's usual AS-23 silent-catch pattern
 * by its callers: a swallowed failure here reintroduces the exact silent fork
 * this guard exists to prevent.
 */
function assertMainTree(opName, opts = {}) {
  if (process.env[OVERRIDE_ENV] === '1') return;
  const info = describeTree(opts.fromDir);
  if (!info.linked) return;
  const err = new Error(buildMessage(opName || 'workstream write', info));
  err.code = 'CWOS_WORKTREE_WRITE_REFUSED';
  err.worktree = info.root;
  err.mainTree = info.mainTree;
  throw err;
}

/** Test seam — drops the per-process cache. */
function _resetCache() { _cache.clear(); }

module.exports = {
  assertMainTree,
  isLinkedWorktree,
  describeTree,
  findRepoRoot,
  OVERRIDE_ENV,
  _resetCache,
};
