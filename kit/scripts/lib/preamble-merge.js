/**
 * preamble-merge.js — honor `merge_strategy: preamble-replace` on the UPGRADE path.
 *
 * WS-523 (2026-08-01). kit/MANIFEST.yaml declares `merge_strategy` on all 394
 * rows, and cwos-adopt-install.js reads it in 32 places. cwos-migrate.js and
 * cwos-kit-upgrade.js read it in ZERO. So on the upgrade path every declared
 * strategy is inert, and the one that matters most fails silently:
 *
 *   CLAUDE.md is `merge_strategy: preamble-replace`. Every adopted repo appends
 *   project-specific content below the `<!-- CWOS Preamble End -->` marker, so
 *   the file ALWAYS diverges from baseline, so classifyFiles always calls it
 *   customized, so the upgrade always writes CLAUDE.md.kit-update and leaves the
 *   old preamble in place. Not once, every time. The consequence is that CWOS's
 *   own operating instructions have never been updatable in any adopted repo
 *   since the day it was adopted — every improvement sits unread in a sidecar.
 *
 * Measured 2026-08-01: nutrition upgraded 3.8.3 → 3.8.4 carrying a preamble fix,
 * and its CLAUDE.md still described a catch-state hook gate of 0.6 (real value
 * 0.7) and still asserted hooks run in a repo that has none.
 *
 * The marker convention is already established by cwos-adopt-install.js; this
 * implements only the upgrade case (replace everything at or above the end
 * marker, preserve everything below it verbatim). First install, prepend, and
 * overlap-dedup stay in the adopt path, which is a genuinely different job.
 */

'use strict';

// The marker is matched by PREFIX, not by exact string, and that is deliberate.
//
// cwos-adopt-install.js declares `PREAMBLE_END = '<!-- CWOS Preamble End -->'`
// and matches it exactly. The marker actually shipped in kit/claude-preamble.md
// and present in every adopted repo is
// `<!-- CWOS Preamble End — Project-specific content below -->`, which does NOT
// contain that literal — after "End " comes an em dash, not "-->". So the exact
// match never fires, and adopt's `isReAdoption` branch is unreachable: a
// re-adoption prepends a second copy of the preamble instead of replacing the
// first. Matching the stable prefix and then scanning to the comment close
// handles both spellings and any future suffix.
const PREAMBLE_END_PREFIX = '<!-- CWOS Preamble End';
const COMMENT_CLOSE = '-->';

/** Locate the full end-marker comment. Returns { start, end } or null. */
function findEndMarker(content) {
  const start = content.indexOf(PREAMBLE_END_PREFIX);
  if (start === -1) return null;
  const close = content.indexOf(COMMENT_CLOSE, start);
  if (close === -1) return null;
  return { start, end: close + COMMENT_CLOSE.length };
}

/**
 * Merge a new preamble into an existing CLAUDE.md.
 *
 * Returns { ok, content, reason }. `ok: false` means the caller should fall back
 * to its normal handling (sidecar) rather than guess — a CLAUDE.md with no end
 * marker predates the convention or was restructured by hand, and replacing a
 * guessed region of a founder's instructions file is not a safe default.
 */
function mergePreamble(existingContent, newPreamble) {
  if (typeof existingContent !== 'string' || !existingContent.length) {
    return { ok: false, content: null, reason: 'no existing CLAUDE.md' };
  }
  const existingMarker = findEndMarker(existingContent);
  if (!existingMarker) {
    return { ok: false, content: null, reason: 'no CWOS preamble end marker' };
  }
  // Everything the founder wrote lives after the marker and is preserved byte
  // for byte, including the newline that follows it.
  const afterPreamble = existingContent.substring(existingMarker.end);

  // The shipped preamble carries its own end marker as the last line; keep the
  // NEW marker text (it is kit-authored) and drop anything after it.
  const newMarker = findEndMarker(newPreamble);
  if (!newMarker) {
    return { ok: false, content: null, reason: 'shipped preamble has no end marker' };
  }
  const preambleThroughMarker = newPreamble.substring(0, newMarker.end);

  return { ok: true, content: preambleThroughMarker + afterPreamble, reason: 'merged' };
}

module.exports = { mergePreamble, findEndMarker, PREAMBLE_END_PREFIX };
