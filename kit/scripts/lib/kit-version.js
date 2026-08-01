'use strict';

/**
 * kit-version — the one place that answers "what kit version is this repo on?"
 *
 * WS-547 / ADR-064 P1. Four readers used to answer this question four different
 * ways, and none of them agreed:
 *
 *   cwos-migrate.js:292      kit_version_at_install → version
 *   cwos-kit-upgrade.js:102  kit_version_at_install → version
 *   cwos-fleet-scan.js:318   kit_version → kit_version_at_install → registry cache
 *   cwos-kit-health.js:210   kit_version_at_install only
 *
 * The first two prefer the HISTORICAL install-time field over the CURRENT stamp,
 * which is backwards. physical-therapy-by-ai carries `version: "3.0"` with
 * `kit_version_at_install: "3.3"` (the latter hand-edited to record a partial
 * rollout), so migration computed its baseline as three releases ahead of what
 * the repo actually had, and every file changed in between was misclassified.
 *
 * There was also no semver comparator anywhere in kit/scripts/ — comparison was
 * hand-rolled in three places. lib/cwos-utils.js quotes any value where
 * !isNaN(Number(value)), which is why "3.0" and "3.3" are quoted while 3.8.1 is
 * bare; mixed-type version fields plus string compare makes
 * "3.10.0" < "3.9.0" true on the first two-digit minor.
 *
 * ADR-064 D1 puts kit/scripts/ inside the plugin, at a Claude-Code-controlled
 * depth in an ephemeral cache. Nothing here walks up from __dirname to find a
 * repo root — every entry point takes an explicit path. (WS-549 removes the 17
 * existing sites that do; this module must not become the 18th.)
 */

const fs = require('fs');
const path = require('path');
const { readYAMLFile } = require('./cwos-utils');

// Field precedence, most authoritative first. Order is the whole point of this
// module — change it here and every reader changes with it.
//
//   version                 the current stamp. What the repo has NOW. Written by
//                           /adopt (writeVersionStamp) and by cwos-migrate
//                           (updateVersionStamp) on every upgrade.
//   kit_version_at_install  historical. Written alongside `version` and normally
//                           equal to it; only meaningful when `version` is absent.
//   kit_version             the /genesis M0 shape. Was written by nothing else
//                           and read by nothing at all, which is how siteproof
//                           degraded to the literal tag `kit-vunknown`.
const VERSION_FIELDS = ['version', 'kit_version_at_install', 'kit_version'];

// Legacy fixtures store a bare scalar rather than a YAML mapping.
const BARE_VERSION_RE = /(\d+\.\d+(?:\.\d+)?)/;

/**
 * Read a repo's .cwos-version. Returns { ok, data, raw, path }; `data` is the
 * parsed mapping (null when the file is absent or unparseable) and `raw` is the
 * original text, which callers need for comment-preserving edits.
 */
function readVersionStamp(repoPath) {
  const stampPath = path.join(repoPath, '.cwos-version');
  if (!fs.existsSync(stampPath)) {
    return { ok: false, data: null, raw: null, path: stampPath };
  }
  let raw = null;
  try { raw = fs.readFileSync(stampPath, 'utf8'); } catch { /* unreadable */ }
  const { ok, data } = readYAMLFile(stampPath);
  return {
    ok: !!(ok && data && typeof data === 'object'),
    data: (ok && data && typeof data === 'object') ? data : null,
    raw,
    path: stampPath,
  };
}

/**
 * Resolve the installed version from a parsed stamp (or its raw text).
 *
 * Returns { version, field } — `field` names which key answered, so callers can
 * explain WHY they resolved what they did. Returns null when nothing resolves.
 *
 * Never returns a sentinel string. The old code returned 'unknown' on failure,
 * which flowed straight into `kit-v${version}` and produced a git ref that could
 * not exist — a lookup that then failed open. A null forces the caller to decide.
 *
 * @param {object|null} data  parsed .cwos-version mapping
 * @param {string|null} raw   original text, for the legacy bare-scalar fallback
 */
function resolveInstalledVersion(data, raw) {
  if (data && typeof data === 'object') {
    for (const field of VERSION_FIELDS) {
      const value = data[field];
      if (value === undefined || value === null) continue;
      const version = String(value).trim();
      // A stamp may carry the key with an empty value; that is not an answer.
      if (version) return { version, field };
    }
  }
  if (typeof raw === 'string') {
    const m = raw.match(BARE_VERSION_RE);
    if (m) return { version: m[1], field: 'bare-scalar' };
  }
  return null;
}

/** Convenience: read + resolve in one call. Returns null if either step fails. */
function resolveRepoVersion(repoPath) {
  const stamp = readVersionStamp(repoPath);
  if (!stamp.raw) return null;
  return resolveInstalledVersion(stamp.data, stamp.raw);
}

/**
 * Parse a version into numeric components. Returns null rather than coercing —
 * a version that does not parse is a fact the caller needs, not one to paper
 * over with zeros. Accepts "3.8" and "3.8.1"; tolerates a leading "v".
 */
function parseSemver(value) {
  if (value === undefined || value === null) return null;
  const m = String(value).trim().match(/^v?(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: m[3] === undefined ? 0 : Number(m[3]) };
}

/**
 * Compare two versions numerically. -1 / 0 / 1, ordering unparseable values
 * last (two unparseable values compare equal). This is what makes
 * compareSemver('3.10.0', '3.9.0') === 1, where string compare says -1.
 */
function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (const part of ['major', 'minor', 'patch']) {
    if (pa[part] < pb[part]) return -1;
    if (pa[part] > pb[part]) return 1;
  }
  return 0;
}

/**
 * Classify how far an installed version lags HEAD: none | patch | minor | major.
 * The /status renderer keys its /fleet-update prompt off this (WS-404), so any
 * non-'none' value means the repo is behind. 'none' when installed >= head, or
 * when either side is missing or unparseable — an unknown lag is not a lag, and
 * INV-065 is what catches the unknown.
 */
function lagSeverity(installed, head) {
  if (!installed || !head) return 'none';
  const pa = parseSemver(installed);
  const pb = parseSemver(head);
  if (!pa || !pb) return 'none';
  if (compareSemver(installed, head) >= 0) return 'none';
  if (pa.major < pb.major) return 'major';
  if (pa.minor < pb.minor) return 'minor';
  return 'patch';
}

/** The git tag a given kit version was released under. */
function baselineTag(version) {
  return `kit-v${version}`;
}

module.exports = {
  readVersionStamp,
  resolveInstalledVersion,
  resolveRepoVersion,
  parseSemver,
  compareSemver,
  lagSeverity,
  baselineTag,
  VERSION_FIELDS,
};
