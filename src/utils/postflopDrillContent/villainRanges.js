/**
 * villainRanges.js — alias layer over `archetypeRanges.js`.
 *
 * LSW-G4-IMPL Commit 2.5 (2026-04-22). Authored per `bucket-ev-panel-v2` spec:
 * Line Study nodes reference villain ranges by a stable string `baseRangeId`
 * instead of inlining position/action/vs tuples. This keeps the line schema
 * forward-compatible: calibration drift on a canonical range updates in one
 * place (`archetypeRanges.js`); lines keep their aliases.
 *
 * NOT a parallel range store. Every alias resolves to an existing tuple in
 * `archetypeRanges.js`; `villainRanges.js` is only the name-to-tuple map.
 * The specialist-review finding (LSW-G4 spec revision) explicitly flagged the
 * dup-store anti-pattern and drove this alias-only shape.
 *
 * Aliases are keyed by the *line + villain* shape they describe:
 *   `<line-style>_<position-tuple>_<villain-role>`
 * e.g., `btn_vs_bb_3bp_bb_range` = "BTN vs BB 3-bet pot, BB is the villain."
 *
 * v1-ship scope: the 3 HU lines unblocked by LSW-H3 for B1 widening
 * (JT6 + Q72r + K77). T98 (3BP OOP) and AK2 (4BP deep) need ranges authored
 * in `archetypeRanges.js` first — aliases for those lines land in later
 * commits alongside the missing tuples. MW lines (J85, Q53) are blocked on
 * LSW-G6 anyway.
 *
 * Extension rule: adding a new alias is additive. Authoring a new line's
 * villain reference means adding its entry to `VILLAIN_RANGE_ALIASES`, not
 * touching the range data — unless the underlying tuple doesn't yet exist,
 * in which case extend `archetypeRanges.js` first.
 */

import { archetypeRangeFor } from './archetypeRanges';

/**
 * Frozen map from `baseRangeId` → `{position, action, vs}` tuple. Each key
 * is a snake_case identifier referenced from a line node's
 * `villainRangeContext.baseRangeId` field.
 *
 * Add a comment above each entry naming the line(s) it serves.
 */
export const VILLAIN_RANGE_ALIASES = Object.freeze({
  // btn-vs-bb-3bp-ip-wet-t96 (JT6 line) — BB 3bet range vs BTN's open.
  // JT6 flop_root is the canary for Commit 3's schema migration.
  btn_vs_bb_3bp_bb_range: Object.freeze({ position: 'BB', action: 'threeBet', vs: 'BTN' }),

  // btn-vs-bb-srp-ip-dry-q72r — BB flat-call range vs BTN's open.
  btn_vs_bb_srp_bb_flat: Object.freeze({ position: 'BB', action: 'call', vs: 'BTN' }),

  // sb-vs-bb-srp-oop-paired-k77 — BB flat-call range vs SB's open.
  // LSW-F3-A1 (2026-04-22): renamed from `co_vs_bb_srp_bb_flat` when the
  // K77 line was relabeled CO → SB to fix a position/action-flow mismatch.
  // CO was IP vs BB postflop but the line's authored action flow had hero
  // acting first on every street (OOP), so SB (which IS OOP vs BB) is the
  // correct matchup.
  sb_vs_bb_srp_bb_flat: Object.freeze({ position: 'BB', action: 'call', vs: 'SB' }),

  // Deferred aliases (LSW-B1 tier 2 — ranges not yet authored in archetypeRanges.js):
  //   sb_vs_btn_3bp_btn_range  — BTN 3bet range vs SB's open (T98 wet line)
  //   utg_vs_btn_4bp_btn_call  — BTN call-of-4bet range (AK2 deep line)
  //
  // MW-deferred aliases (LSW-G6 blocked):
  //   btn_vs_bb_sb_srp_sb_flat — J85 MW line
  //   btn_vs_bb_sb_srp_bb_flat — J85 MW line
  //   co_vs_btn_bb_srp_btn_flat — Q53 MW line
  //   co_vs_btn_bb_srp_bb_flat  — Q53 MW line
});

/**
 * Check whether a `baseRangeId` has an alias registered.
 *
 * Cheap O(1) lookup; used by the v3 line schema validator to catch
 * authoring typos early (`baseRangeId` that resolves to nothing).
 *
 * @param {string} baseRangeId
 * @returns {boolean}
 */
export const isKnownBaseRangeId = (baseRangeId) =>
  typeof baseRangeId === 'string' && baseRangeId in VILLAIN_RANGE_ALIASES;

/**
 * Resolve a `baseRangeId` into a 169-cell range grid via `archetypeRangeFor`.
 *
 * Throws with a clear message when:
 *   - baseRangeId is not a string
 *   - baseRangeId has no alias entry
 *   - the aliased tuple cannot resolve in archetypeRanges.js (range author
 *     added the alias but forgot to author the underlying range)
 *
 * The two-layer error distinction (alias-missing vs underlying-missing)
 * matches the spec's `errorState` discriminant — callers can surface
 * different `userMessage` text per error kind.
 *
 * @param {string} baseRangeId
 * @returns {Float64Array}
 */
export const villainRangeFor = (baseRangeId) => {
  if (typeof baseRangeId !== 'string' || baseRangeId.length === 0) {
    throw new Error(
      `villainRangeFor: baseRangeId must be a non-empty string, got ${JSON.stringify(baseRangeId)}`
    );
  }
  const tuple = VILLAIN_RANGE_ALIASES[baseRangeId];
  if (!tuple) {
    throw new Error(
      `villainRangeFor: unknown baseRangeId '${baseRangeId}' — not in VILLAIN_RANGE_ALIASES. `
      + `Add an entry to villainRanges.js or check for typo.`
    );
  }
  try {
    return archetypeRangeFor(tuple);
  } catch (err) {
    // Range tuple is aliased but the underlying archetypeRanges entry is
    // missing — pinpoint this to the author so they know which file to edit.
    throw new Error(
      `villainRangeFor: alias '${baseRangeId}' → { position: ${tuple.position}, `
      + `action: ${tuple.action}, vs: ${tuple.vs} } could not resolve in archetypeRanges.js: `
      + `${err.message || err}`
    );
  }
};

/**
 * List every registered alias. Used by tests and by the Explorer UI when it
 * wants to surface "which lines have their villain range wired up."
 *
 * @returns {Array<{ baseRangeId: string, tuple: { position, action, vs? } }>}
 */
export const listBaseRangeAliases = () =>
  Object.entries(VILLAIN_RANGE_ALIASES).map(([baseRangeId, tuple]) => ({
    baseRangeId,
    tuple: { ...tuple },
  }));
