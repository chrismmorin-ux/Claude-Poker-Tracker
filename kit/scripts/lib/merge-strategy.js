/**
 * merge-strategy.js — one definition of `merge_strategy`, consulted by BOTH the
 * install path and the upgrade path.
 *
 * WS-559 (2026-08-02). `kit/MANIFEST.yaml` declares `merge_strategy` on all 394
 * rows. `cwos-adopt-install.js` read it in 32 places; `cwos-migrate.js` and
 * `cwos-kit-upgrade.js` — the entire upgrade path — read it in ZERO. So for every
 * repo that has already adopted CWOS, three of the four declared behaviours were
 * decoration:
 *
 *   additive        11 rows   A founder-EDITED config was sidecarred, so new kit
 *                             fields never arrived. An UNEDITED one was
 *                             overwritten wholesale. Either way the "gain new
 *                             fields, never reset existing values" contract that
 *                             /fleet-update documents did not run.
 *   skip-if-exists  18 rows   Per-repo data seeded once was OVERWRITTEN on every
 *                             upgrade — the exact clobber the strategy exists to
 *                             prevent. Masked only because "matches baseline"
 *                             happens to imply untouched; coincidence, not
 *                             structure.
 *   preamble-replace 2 rows   Fixed by WS-523, one instance, one code path.
 *
 * And because the enum was hand-rolled at each call site with an `else` meaning
 * overwrite, a typo failed OPEN: `skip_if_exists` (underscores) sat on
 * kit/templates/cwos-health.yaml declaring one thing and doing the opposite.
 * Nothing anywhere said so. That is the WS-546 family, and it is why
 * `strategyOf` throws on an unrecognized value instead of defaulting.
 *
 * The shape here is `lib/preamble-merge.js` generalized: a small pure module the
 * apply phase consults, returning { ok, content, reason } and REFUSING rather
 * than guessing when it cannot merge safely. A refusal is not a failure — the
 * caller falls back to the .kit-update sidecar, which is what it did before.
 *
 * WHY THIS MODULE DOES NOT EXPORT PER-VALUE CONSTANTS
 *
 * The obvious next step — export S_ADDITIVE and have every call site branch on
 * the symbol — is wrong here, and INV-067 is why. WS-562's liveness gate asks
 * whether each declared value has a VISIBLE reader: a quoted literal within 8
 * lines of a mention of the key, in the consumer file itself. Hiding the values
 * behind imported symbols would make "does the upgrade path handle
 * skip-if-exists?" unanswerable by reading the upgrade path — which is the exact
 * property that let this bug live for 394 rows and however many releases.
 *
 * So the branching stays as quoted literals at each call site, and this module
 * owns the two things that genuinely must not drift: the closed set, and the
 * merge algorithm. A call site that FORGETS a value is still caught twice over —
 * its dispatch has no case for it, and INV-067 reports the value as unread on
 * that consumer.
 */

'use strict';

const { parseYAML } = require('./cwos-utils');

/** The closed set. Anything else is a manifest bug, not a runtime condition. */
const KNOWN_STRATEGIES = ['overwrite', 'additive', 'skip-if-exists', 'preamble-replace'];
const KNOWN = new Set(KNOWN_STRATEGIES);

/**
 * Check every row up front so a bad manifest is reported whole, not one throw at
 * a time. Callers turn a non-empty `violations` into a non-zero exit.
 */
function validateStrategies(files) {
  const violations = [];
  for (const entry of files || []) {
    const raw = entry && entry.merge_strategy;
    if (raw === undefined || raw === null || raw === '') continue;
    if (!KNOWN.has(raw)) {
      violations.push({
        source: entry.source || null,
        destination: entry.destination || null,
        value: raw,
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

// ─── additive: YAML ────────────────────────────────────────────────────────
//
// Text-level, on top-level key blocks. NOT parse-and-reserialize.
//
// The repo's only YAML support is the hand-rolled parser in cwos-utils.js, which
// is lossy by construction — it drops comments, quoting style, and ordering. The
// additive templates are the most heavily commented files in the kit
// (kit/templates/workstream/config.yaml explains its own ID-allocation strategy
// in nine lines of prose), and those comments are the reason a founder can edit
// the file at all. Round-tripping them through the parser to add one key would
// destroy the thing being preserved.
//
// So existing content is emitted BYTE FOR BYTE and missing top-level blocks are
// appended after it. Nothing is reordered, rewritten, or removed.

const TOP_LEVEL_KEY = /^([A-Za-z_][A-Za-z0-9_.-]*)\s*:(\s|$)/;
const COMMENT_OR_BLANK = /^(\s*#|\s*$)/;
const DOC_SEPARATOR = /^---\s*\r?$/;

/**
 * Split a YAML document into top-level key blocks.
 *
 * A block is the key's line, everything indented beneath it, and the run of
 * comment/blank lines immediately above it — those comments describe the key and
 * have to travel with it.
 *
 * Returns { ok, order, blocks, reason }. Refuses on shapes where "top-level key"
 * is not a well-defined notion: multi-document files, or a duplicated key (which
 * would make "is this key present?" ambiguous and risk appending a second copy).
 */
function splitTopLevelBlocks(text) {
  const lines = String(text).split('\n');
  const order = [];
  const blocks = new Map();
  const startLine = new Map();

  let current = null;
  let pendingStart = null; // first line of the comment/blank run above a key

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // A separator anywhere but line 0 means more than one document. Which
    // document owns a key is not a question this merger should answer.
    if (DOC_SEPARATOR.test(line) && i > 0) {
      return { ok: false, order: [], blocks, reason: 'multi-document YAML' };
    }

    const m = TOP_LEVEL_KEY.exec(line);
    if (m) {
      const key = m[1];
      if (blocks.has(key)) {
        return { ok: false, order: [], blocks, reason: `duplicate top-level key "${key}"` };
      }
      current = key;
      order.push(key);
      blocks.set(key, []);
      startLine.set(key, pendingStart === null ? i : pendingStart);
      pendingStart = null;
      continue;
    }

    if (current === null) continue; // preamble — belongs to no key

    if (COMMENT_OR_BLANK.test(line)) {
      // Might be a trailing comment of the current block, or the header of the
      // next key. Undecided until we see what follows.
      if (pendingStart === null) pendingStart = i;
    } else {
      // Indented content (or anything else) — settles the pending run onto the
      // current block.
      pendingStart = null;
    }
  }

  if (order.length === 0) {
    return { ok: false, order: [], blocks, reason: 'no top-level keys' };
  }

  // Materialize each block from its start line to the start of the next.
  for (let k = 0; k < order.length; k++) {
    const key = order[k];
    const from = startLine.get(key);
    const to = k + 1 < order.length ? startLine.get(order[k + 1]) : lines.length;
    blocks.set(key, lines.slice(from, to));
  }

  return { ok: true, order, blocks, reason: null };
}

/**
 * Appended content adopts the existing file's line ending.
 *
 * On Windows the repo copy is CRLF (core.autocrlf) while the kit source read
 * from HomeBase may be LF. Appending raw would leave the founder's config with
 * mixed endings — harmless to classification (cwos-migrate EOL-normalizes before
 * hashing) but ugly in a file the founder is meant to open and edit.
 */
function eolOf(text) {
  return /\r\n/.test(text) ? '\r\n' : '\n';
}
function joinWithEol(lines, eol) {
  return lines.map(l => l.replace(/\r$/, '')).join(eol);
}

/** Drop leading/trailing blank lines from a block so appends stay tidy. */
function trimBlankEdges(blockLines) {
  let a = 0, b = blockLines.length;
  while (a < b && /^\s*\r?$/.test(blockLines[a])) a++;
  while (b > a && /^\s*\r?$/.test(blockLines[b - 1])) b--;
  return blockLines.slice(a, b);
}

/**
 * Nested additions the block merge cannot see.
 *
 * The merge adds top-level keys. A new field nested UNDER a key that already
 * exists is invisible to it — `capabilities.autonomous.enabled` arriving beneath
 * an existing `capabilities:` is a real case. Rather than claim a complete merge,
 * find those paths so the caller can keep the .kit-update sidecar alongside the
 * in-place write.
 *
 * Read-only use of parseYAML: key sets are compared, nothing is reserialized, so
 * the parser's lossiness cannot reach disk. Returns null when the comparison
 * could not be made at all — the caller treats null as "assume incomplete".
 */
function nestedAdditions(existingText, incomingText, addedTopLevel) {
  let a, b;
  try {
    a = parseYAML(String(existingText));
    b = parseYAML(String(incomingText));
  } catch {
    return null;
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return null;

  const skip = new Set(addedTopLevel);
  const out = [];
  const walk = (existingNode, incomingNode, prefix) => {
    if (!incomingNode || typeof incomingNode !== 'object' || Array.isArray(incomingNode)) return;
    if (!existingNode || typeof existingNode !== 'object' || Array.isArray(existingNode)) return;
    for (const key of Object.keys(incomingNode)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!prefix && skip.has(key)) continue; // whole block already appended
      if (!Object.prototype.hasOwnProperty.call(existingNode, key)) {
        if (prefix) out.push(path); // top-level misses are handled by the merge
        continue;
      }
      walk(existingNode[key], incomingNode[key], path);
    }
  };
  walk(a, b, '');
  return out;
}

function mergeAdditiveYaml(existingText, incomingText) {
  const existing = splitTopLevelBlocks(existingText);
  if (!existing.ok) return { ok: false, content: null, reason: `existing: ${existing.reason}` };
  const incoming = splitTopLevelBlocks(incomingText);
  if (!incoming.ok) return { ok: false, content: null, reason: `incoming: ${incoming.reason}` };

  const missing = incoming.order.filter(k => !existing.blocks.has(k));

  let content = String(existingText);
  if (missing.length) {
    const eol = eolOf(existingText);
    if (content.length && !content.endsWith('\n')) content += eol;
    for (const key of missing) {
      content += eol + joinWithEol(trimBlankEdges(incoming.blocks.get(key)), eol) + eol;
    }
  }

  const nested = nestedAdditions(existingText, incomingText, missing);
  return {
    ok: true,
    content,
    reason: missing.length ? 'merged' : 'already current',
    added: missing,
    unmergedNested: nested || [],
    // null means the comparison failed — assume incomplete rather than claim a
    // clean merge on a file we could not read.
    sidecarStillNeeded: nested === null || nested.length > 0,
  };
}

// ─── additive: line-oriented text (.gitignore) ─────────────────────────────
//
// Mirrors ensureCwosGitignore in cwos-adopt-install.js, which already does this
// on the install path. Founder lines survive verbatim; kit lines not already
// present are appended under a header. Idempotent — a second run finds nothing
// missing.

// ASCII only — this lands in a founder's .gitignore, not in source comments.
const ADDED_HEADER = '# CWOS - added by kit upgrade';

function mergeAdditiveLines(existingText, incomingText) {
  const norm = s => s.replace(/\r$/, '').trim();
  const present = new Set(String(existingText).split('\n').map(norm).filter(Boolean));
  const meaningful = String(incomingText)
    .split('\n')
    .map(l => l.replace(/\r$/, ''))
    .filter(l => l.trim() && !l.trim().startsWith('#'));

  const missing = [];
  for (const line of meaningful) {
    const key = norm(line);
    if (present.has(key)) continue;
    present.add(key); // dedupe within the incoming block too
    missing.push(line);
  }

  let content = String(existingText);
  if (missing.length) {
    const eol = eolOf(existingText);
    if (content.length && !content.endsWith('\n')) content += eol;
    content += eol + joinWithEol([ADDED_HEADER, ...missing], eol) + eol;
  }

  return {
    ok: true,
    content,
    reason: missing.length ? 'merged' : 'already current',
    added: missing,
    unmergedNested: [],
    sidecarStillNeeded: false,
  };
}

/**
 * Merge kit content into an existing file additively: gain new fields, never
 * reset an existing value, never remove anything.
 *
 * `ok: false` means the caller should fall back to its normal handling (the
 * .kit-update sidecar) rather than guess.
 */
function mergeAdditive(existingContent, incomingContent, destination) {
  if (typeof existingContent !== 'string' || !existingContent.length) {
    return { ok: false, content: null, reason: 'no existing file to merge into' };
  }
  if (typeof incomingContent !== 'string' || !incomingContent.length) {
    return { ok: false, content: null, reason: 'no incoming content' };
  }
  const dest = String(destination || '');
  const isYaml = /\.ya?ml$/i.test(dest);
  return isYaml
    ? mergeAdditiveYaml(existingContent, incomingContent)
    : mergeAdditiveLines(existingContent, incomingContent);
}

module.exports = {
  KNOWN_STRATEGIES,
  validateStrategies,
  mergeAdditive,
  // exported for tests
  splitTopLevelBlocks,
  nestedAdditions,
};
