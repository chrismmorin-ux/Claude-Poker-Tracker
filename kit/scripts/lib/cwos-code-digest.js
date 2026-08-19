'use strict';
/**
 * cwos-code-digest.js — hash the CODE a compute job actually depends on.
 *
 * WHY THIS EXISTS (WS-572). The compute supply chain decided "this work already ran" from
 * `stepsFingerprint(steps, inputs)` — the command, its arguments, and its staged inputs, and
 * nothing else. The analysis code was invisible to it, so fixing a bug in the code that
 * produced a wrong answer did not make the job eligible to run again. The job stayed
 * permanently done and the wrong answer stayed permanently standing.
 *
 * MEASURED INSTANCE. WS-320 shipped RC-study-ladder-d908f09d with three wrong verdicts —
 * `separability.mjs` decided `separates` on z >= 3 against the binomial null while merely
 * interpolating the control axis into the reason string, so `threeBetRate` was reported as
 * separating at chi2/df = 5.569 against a control of 9.363. Commit a60d4084 fixed it on
 * 2026-08-16. Three days later the corrected code had never run, cm-node1 sat IDLE, and the
 * superseded card was still the standing answer.
 *
 * ── THE DESIGN CONSTRAINT, AND WHY IT IS NOT `git rev-parse HEAD` ──
 * Keying on HEAD would re-open EVERY past job on EVERY commit and re-run the whole history to
 * reproduce byte-identical output. Compute is the scarce resource here. So the digest covers
 * the TRANSITIVE LOCAL IMPORT CLOSURE of the job's own entry scripts — derived, never
 * hand-listed per job — and nothing else. A change to `separability.mjs` re-opens the study
 * ladder; a change to a React view does not.
 *
 * ── WHY THE CLOSURE IS TAKEN AT HEAD AND THE CONTENTS AT THE JOB'S COMMIT ──
 * Both sides of the dedupe must agree. The candidate side knows HEAD; the historical side
 * knows the commit its terminal record was produced at. Parsing imports at a historical
 * commit would need one `git show` per file per job, over ssh, on every feed tick.
 *
 * Instead both sides compute the STRUCTURE (which files) from the current working tree, and
 * look up the CONTENT (blob sha per file) at their own commit with a single `git ls-tree -r`.
 * Symmetric, one git call per side, and no historical parsing.
 *
 * The one imprecision is a file that entered the closure after the historical commit: it has
 * no blob there and is recorded as `-`, which differs from its sha at HEAD. That errs toward
 * RE-RUNNING a job, never toward falsely skipping one — the safe direction, because the
 * failure this module exists to stop is a stale answer standing unchallenged.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

/** Extensions we will follow into. A step arg pointing at anything else is not code we parse. */
const CODE_EXT = ['.mjs', '.js', '.cjs'];

/**
 * Static local imports/requires only. A dynamic `import(expr)` cannot be resolved without
 * running the program, and a bare specifier is a node_module — neither belongs in a digest
 * that must be stable and repo-local.
 */
const IMPORT_RE = /(?:^|[\s;{(])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g;
const BARE_IMPORT_RE = /(?:^|[\s;])import\s*['"]([^'"]+)['"]/g;
const REQUIRE_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * ── THE EDGE THAT STATIC IMPORTS DO NOT CARRY, AND THE REASON THIS MODULE ALMOST SHIPPED
 *    BROKEN ──
 * Measured 2026-08-19: the closure of `run-study-ladder.mjs` built from static imports alone
 * is TWO FILES. `separability.mjs` — the module whose bug this whole ticket exists to catch —
 * is not among them, so the first version of this digest would not have re-opened WS-320 and
 * would have passed review looking correct.
 *
 * The backtest harnesses load essentially everything through a Vite SSR loader:
 *     const { analyseLadder } = await loader.load('/scripts/backtest/studyLadderReport.mjs');
 * because `phhAdapter` reaches the app's `primitiveActions`, which imports `./gameConstants`
 * extensionless — plain Node ESM refuses that, so a direct static import fails at startup.
 * The dependency is real and load-bearing; it simply is not an `import` statement.
 *
 * So we also take any quoted REPO-ROOT-ABSOLUTE path to a code file as an edge. Matching the
 * string shape rather than `loader.load(` specifically means a new wrapper around the same
 * convention keeps working without touching this file.
 */
const ROOT_PATH_RE = /['"](\/(?:[\w.@-]+\/)*[\w.@-]+\.(?:mjs|js|cjs))['"]/g;

const toPosix = (p) => p.split(path.sep).join('/');

/** A specifier is ours only if it is relative. Bare = dependency, absolute = not portable. */
const isLocalSpecifier = (spec) => spec.startsWith('./') || spec.startsWith('../');

/**
 * Resolve a relative specifier the way node would, but only far enough to name a repo file.
 * Returns a repo-relative POSIX path, or null when nothing on disk answers to it.
 */
function resolveLocal(spec, fromRel, repoRoot) {
  const baseRel = toPosix(path.posix.join(path.posix.dirname(fromRel), spec));
  const candidates = [baseRel];
  if (!CODE_EXT.includes(path.posix.extname(baseRel))) {
    for (const ext of CODE_EXT) candidates.push(baseRel + ext);
    for (const ext of CODE_EXT) candidates.push(path.posix.join(baseRel, 'index' + ext));
  }
  for (const rel of candidates) {
    const abs = path.join(repoRoot, rel);
    try { if (fs.statSync(abs).isFile()) return rel; } catch { /* next candidate */ }
  }
  return null;
}

/**
 * The scripts a job actually starts. Taken from the step ARGS rather than the cmd, because
 * `cmd` is the node binary — the interesting path is always an argument to it.
 */
function entryScripts(steps, repoRoot) {
  const out = new Set();
  for (const step of Array.isArray(steps) ? steps : []) {
    for (const raw of Array.isArray(step.args) ? step.args : []) {
      const arg = toPosix(String(raw));
      if (!CODE_EXT.includes(path.posix.extname(arg))) continue;
      const rel = arg.replace(/^\.\//, '');
      if (path.posix.isAbsolute(rel) || rel.startsWith('..') || /^[A-Za-z]:/.test(rel)) continue;
      try { if (fs.statSync(path.join(repoRoot, rel)).isFile()) out.add(rel); } catch { /* not ours */ }
    }
  }
  return [...out].sort();
}

/**
 * Transitive closure of local imports from a set of entry scripts, read from the working
 * tree. Cycles terminate on the `seen` set; an unresolvable specifier is skipped rather than
 * throwing, because a digest that crashes the feeder is worse than one that is slightly wide.
 */
function importClosure(entries, repoRoot) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const rel = stack.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let src = '';
    try { src = fs.readFileSync(path.join(repoRoot, rel), 'utf8'); } catch { continue; }
    for (const re of [IMPORT_RE, BARE_IMPORT_RE, REQUIRE_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src)) !== null) {
        const spec = m[1];
        if (!isLocalSpecifier(spec)) continue;
        const next = resolveLocal(spec, rel, repoRoot);
        if (next && !seen.has(next)) stack.push(next);
      }
    }
    // Loader-style repo-root paths — see ROOT_PATH_RE. Resolved from the repo root, not from
    // the importing file, so the leading slash is stripped rather than treated as absolute.
    ROOT_PATH_RE.lastIndex = 0;
    let rm;
    while ((rm = ROOT_PATH_RE.exec(src)) !== null) {
      const candidate = rm[1].replace(/^\//, '');
      if (seen.has(candidate)) continue;
      try {
        if (fs.statSync(path.join(repoRoot, candidate)).isFile()) stack.push(candidate);
      } catch { /* a path-shaped string that is not a repo file is not an edge */ }
    }
  }
  return [...seen].sort();
}

/** Default git runner. Injectable so the tests never need a repo on disk. */
function gitLsTree(repoRoot, commit) {
  const r = spawnSync('git', ['-C', repoRoot, 'ls-tree', '-r', commit], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true,
  });
  if (r.status !== 0 || typeof r.stdout !== 'string') return null;
  return r.stdout;
}

/** `<mode> blob <sha>\t<path>` -> Map(path -> sha). */
function parseLsTree(text) {
  const map = new Map();
  for (const line of String(text || '').split('\n')) {
    const tab = line.indexOf('\t');
    if (tab === -1) continue;
    const meta = line.slice(0, tab).split(/\s+/);
    if (meta[1] !== 'blob') continue;
    map.set(line.slice(tab + 1).trim(), meta[2]);
  }
  return map;
}

/**
 * The digest, or null when it cannot be established.
 *
 * NULL IS LOAD-BEARING, not a soft failure. `stepsFingerprint` omits a null digest entirely,
 * which reproduces the pre-WS-572 hash exactly. So a job whose entry script we cannot see, or
 * a commit git cannot read, degrades to the old steps-only identity on BOTH sides rather than
 * producing an asymmetric key that would silently re-run finished work.
 */
function codeDigest({ steps, repoRoot, commit, lsTree = gitLsTree }) {
  if (!repoRoot || !commit) return null;
  const entries = entryScripts(steps, repoRoot);
  if (!entries.length) return null;
  const files = importClosure(entries, repoRoot);
  if (!files.length) return null;
  const text = lsTree(repoRoot, commit);
  if (text === null || text === undefined) return null;
  const blobs = parseLsTree(text);
  const material = files.map((rel) => `${rel}:${blobs.get(rel) || '-'}`).join('\n');
  return crypto.createHash('sha256').update(material).digest('hex').slice(0, 12);
}

module.exports = {
  CODE_EXT,
  entryScripts,
  importClosure,
  resolveLocal,
  parseLsTree,
  codeDigest,
};
