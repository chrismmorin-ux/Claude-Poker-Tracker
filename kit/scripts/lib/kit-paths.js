'use strict';

/**
 * kit-paths — the one place that answers "which root do I mean?"
 *
 * WS-549 / ADR-064 P3. Sibling of lib/kit-version.js, and the same shape of
 * problem: 19 production sites in kit/scripts/ resolved a root by counting
 * parent directories up from __dirname, and they were not all counting toward
 * the same place.
 *
 * There are THREE roots, and they are the same directory only in HomeBase:
 *
 *   repo root   the repo's own state — .claude/, system/, .cwos-config.yaml.
 *               Belongs to whoever is being operated on. Comes from an explicit
 *               path or from process.cwd(). NEVER from __dirname: the kit's
 *               position relative to the repo is not fixed. In an adopted repo
 *               it happens to be <repo>/kit/scripts/; under a plugin it is an
 *               ephemeral cache outside the repo entirely.
 *
 *   dist root   content the kit SHIPS — engines/, personas/, kit/templates/,
 *               kit/data/. Travels with the code. Correctly derived from
 *               __dirname, because a script's position INSIDE the distribution
 *               is fixed even when the distribution moves.
 *
 *   homebase    the fleet hub — fleet/registry.yaml. Exists on exactly one
 *               machine's checkout. Null everywhere else, and callers must
 *               handle that rather than scaffolding into a guess.
 *
 * The bug this module retires was not the arithmetic. It was that three sites
 * used ONE variable to reach two different roots at once — .claude/agents and
 * personas/core off the same ROOT (cwos-engine-persona-validate.js), repo
 * programs and kit template programs off the same REPO_ROOT
 * (cwos-program-schema-validate.js), fleet/registry.yaml and kit/templates off
 * the same KIT_ROOT (cwos-genesis-scaffold.js). Those read as correct in
 * HomeBase forever, because in HomeBase they ARE the same directory.
 *
 * resolveDistRoot() is deliberately the only function here that derives a path
 * from __dirname, and INV-066 excludes only this file. When the plugin layout
 * is settled, this is the one function that changes.
 */

const fs = require('fs');
const path = require('path');

const { findRepoRoot } = require('./cwos-utils');

// Any ONE of these identifies a CWOS repo.
//
// Deliberately not `kit/` — that was FIND-278 / WS-419: `kit/` is absent from L4
// adoptions, and requiring it broke the engine in 100% of them. Verified
// 2026-07-31: an adopted repo carries kit/scripts/ but NOT kit/VERSION or
// kit/MANIFEST.yaml, so neither of those works as a repo marker either.
//
// And deliberately `.claude/workstream` rather than bare `.claude`: every
// machine has a `~/.claude` config directory, so the bare marker resolved the
// USER'S HOME as a repo root for any script run outside one. Caught by the
// refusal test in __tests__/kit-paths.test.js, which is the same failure shape
// this whole item exists to remove — a path that resolves to somewhere
// plausible instead of failing.
const REPO_MARKERS = ['.cwos-version', 'CLAUDE.md', path.join('.claude', 'workstream')];

// The hub is the only place fleet/registry.yaml exists.
const HOMEBASE_MARKER = path.join('fleet', 'registry.yaml');

// Where this module sits inside the distribution: <dist>/kit/scripts/lib/.
const DIST_SEGMENTS = ['kit', 'scripts', 'lib'];

function hasAnyMarker(dir, markers) {
  return markers.some(m => fs.existsSync(path.join(dir, m)));
}

/**
 * The root of the kit distribution — where engines/, personas/ and kit/ live.
 *
 * Derived from this file's own location, which is the correct source: a script
 * cannot be separated from the content it ships alongside. Uses the position of
 * the `kit/scripts/lib` segments rather than a fixed number of `..` hops, so a
 * distribution that nests the kit deeper still resolves. Falls back to the
 * literal hop count when the segments are not found, which preserves the
 * pre-WS-549 behaviour exactly.
 */
function resolveDistRoot() {
  const parts = __dirname.split(path.sep);
  for (let i = parts.length - DIST_SEGMENTS.length; i >= 0; i--) {
    const window = parts.slice(i, i + DIST_SEGMENTS.length);
    if (window.every((seg, j) => seg === DIST_SEGMENTS[j])) {
      return parts.slice(0, i).join(path.sep) || path.sep;
    }
  }
  return path.resolve(__dirname, '..', '..', '..');
}

/**
 * The repo being operated on. Returns null when nothing resolves.
 *
 * Null rather than a guess, and rather than cwd-as-fallback, on the
 * kit-version.js precedent: returning the sentinel 'unknown' there produced the
 * git ref `kit-vunknown`, a lookup that could not succeed and failed open.
 * findRepoRoot() itself returns its start directory when it finds nothing, so
 * the marker is re-checked here before the result is trusted.
 *
 * @param {object} [opts]
 * @param {string} [opts.repo]   explicit path (a --repo flag). Trusted, but must exist.
 * @param {string} [opts.from]   directory to search upward from (default process.cwd()).
 */
function resolveRepoRoot(opts = {}) {
  if (opts.repo) {
    const abs = path.resolve(opts.repo);
    return fs.existsSync(abs) ? abs : null;
  }
  const start = opts.from ? path.resolve(opts.from) : process.cwd();
  const found = findRepoRoot(start, { markers: REPO_MARKERS, requireAll: false, maxDepth: 10 });
  return hasAnyMarker(found, REPO_MARKERS) ? found : null;
}

/**
 * The fleet hub. Null when this machine's cwd is not inside HomeBase — which is
 * the normal case in an adopted repo, and callers must branch on it rather than
 * writing into whatever the walk happened to return.
 *
 * @param {object} [opts]
 * @param {string} [opts.homebase]  explicit path (a --homebase flag).
 * @param {string} [opts.from]      directory to search upward from (default process.cwd()).
 */
function resolveHomeBaseRoot(opts = {}) {
  if (opts.homebase) {
    const abs = path.resolve(opts.homebase);
    return fs.existsSync(path.join(abs, HOMEBASE_MARKER)) ? abs : null;
  }
  const start = opts.from ? path.resolve(opts.from) : process.cwd();
  const found = findRepoRoot(start, { markers: [HOMEBASE_MARKER], requireAll: true, maxDepth: 10 });
  if (fs.existsSync(path.join(found, HOMEBASE_MARKER))) return found;

  // The distribution itself may be the hub (running a script from a HomeBase
  // checkout while cwd is elsewhere). Checked second so an explicit location
  // always wins over an inferred one.
  const dist = resolveDistRoot();
  return fs.existsSync(path.join(dist, HOMEBASE_MARKER)) ? dist : null;
}

/**
 * Convenience for the common "repo root, or fail loudly" case. Callers that
 * cannot proceed without a repo should use this so the error is uniform.
 */
function requireRepoRoot(opts = {}) {
  const root = resolveRepoRoot(opts);
  if (!root) {
    throw new Error(
      'Could not locate a CWOS repo. Run from inside one, or pass an explicit path. ' +
      `Looked for ${REPO_MARKERS.join(' / ')} upward from ` +
      (opts.from ? path.resolve(opts.from) : process.cwd())
    );
  }
  return root;
}

module.exports = {
  resolveDistRoot,
  resolveRepoRoot,
  resolveHomeBaseRoot,
  requireRepoRoot,
  REPO_MARKERS,
  HOMEBASE_MARKER,
};
