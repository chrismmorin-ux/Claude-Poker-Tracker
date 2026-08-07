/**
 * lswRlParityBaseline.js — committed engine-equity baseline for the LSW↔RL
 * equity-parity invariant (WS-206 / INV-LSW-RL-EQUITY-PARITY).
 *
 * Each entry pins the engine's hero-vs-villain-range equity for an authored
 * Line Study node, keyed by `${lineId}::${nodeId}`. Values are exact (no Monte
 * Carlo) — deterministic exhaustive enumeration via pokerCore exactComboEquity
 * over the node's structured inputs (board + heroView single combo + villain
 * range resolved from villainRangeContext.baseRangeId).
 *
 * THIS FILE IS A REGRESSION PIN, NOT A REGENERATED ARTIFACT.
 * A diff here means engine equity for an authored teaching spot MOVED. Do NOT
 * blindly regenerate. When the parity test fails:
 *   1. Identify which side changed — an engine/equity change (rangeEngine,
 *      pokerCore, villain-range resolution) OR an edit to the LSW line node.
 *   2. Confirm the new equity is correct and the LSW line still teaches the
 *      right lesson at the new number.
 *   3. Only then update the baseline value, in the same commit, with a note.
 *
 * Regenerate (for review) by running the test with GEN_LSW_RL_BASELINE=1 — it
 * prints the JSON to stdout instead of asserting.
 */

/** Equity-match tolerance. Exact enumeration → 0 drift expected; the band
 *  absorbs any future Monte Carlo fallback (±0.5% MC variance floor, WS-206). */
export const PARITY_TOLERANCE = 0.005;

// ─────────────────────────────────────────────────────────────────────────────
// RE-PINNED 2026-08-04 — `parseRangeString` dash-span fix (GUT Range P-1a).
//
// Which side changed: VILLAIN-RANGE RESOLUTION, not the equity engine. Tokens
// containing a dash ("22-JJ", "A5s-A2s") matched no branch in
// `pokerCore/rangeMatrix.parseRangeString` and were silently discarded, so every
// villain range built from a string with a dash span resolved NARROWER than
// authored. Restoring them widens villain by exactly the dropped hands.
//
// Every delta is positive, and that direction is the check: the dropped tokens
// were the WEAK part of each range (small pairs, weak suited aces), so adding
// them back dilutes villain and raises hero equity. A negative delta here would
// have meant something other than this fix moved.
//
//   node                              old        new        Δ
//   btn-vs-bb-srp-ip-dry-q72r      0.868782 → 0.880635   +0.012
//   btn-vs-bb-3bp-ip-wet-t96       0.576512 → 0.617688   +0.041
//   sb-vs-bb-srp-oop-paired-k77    0.827117 → 0.854821   +0.028
//   sb-vs-btn-3bp-oop-wet-t98      0.720560 → 0.723906   +0.003  (was inside tolerance)
//   utg-vs-btn-4bp-deep            0.488636 → 0.786932   +0.298
//
// Lines still teach correctly at the new numbers — the ranges now match what the
// content authors wrote. The 4bp outlier is the proof: see its note below.
// ─────────────────────────────────────────────────────────────────────────────
export const LSW_RL_EQUITY_BASELINE = {
  'btn-vs-bb-srp-ip-dry-q72r::flop_root': 0.880635,
  'btn-vs-bb-3bp-ip-wet-t96::flop_root': 0.617688,
  'sb-vs-bb-srp-oop-paired-k77::flop_root': 0.854821,
  'sb-vs-btn-3bp-oop-wet-t98::flop_root': 0.723906,
  // WS-209 (SPR-096, 2026-05-20): hero combo fixed A♥K♦ → A♥K♣ (was an
  // impossible board-colliding holding, previously in KNOWN_DEGENERATE_NODES).
  // Equity now computable: hero top-two-pair vs the resolved BTN 4bet-call
  // range.
  //
  // 2026-08-04: 0.488636 → 0.786932. This node is the clearest evidence the old
  // pin was measuring a truncated range. Its range is CALL_RANGES['BTN_vs_UTG']
  // = 'QQ-JJ,AKs,AKo'; the dropped "QQ-JJ" left villain holding ONLY AK, so hero
  // chopped almost every runout — hence the anomalous sub-0.5. The WS-209 note
  // above already reasoned about "the QQ/JJ hero beats," describing hands the
  // parser had removed. Code now matches the authored intent, and top two pair
  // vs {JJ, QQ, AK} at 0.787 is the number that note was describing.
  'utg-vs-btn-4bp-deep::flop_root': 0.786932,
};

/**
 * Nodes whose structured inputs are ILLEGAL (hero combo collides with the
 * board, or villain range resolves empty) — equity is uncomputable, so they
 * are excluded from the equity pin but tracked here so the bug is never
 * silently swallowed. A NEW degenerate node not in this map fails the parity
 * test, forcing a fix or an explicit acknowledgement.
 *
 * Keyed by `${lineId}::${nodeId}` → human reason.
 */
export const KNOWN_DEGENERATE_NODES = {
  // (empty) — utg-vs-btn-4bp-deep::flop_root was fixed in WS-209 (SPR-096):
  // hero A♥K♦ → A♥K♣ removed the board collision, so the node is now pinned in
  // LSW_RL_EQUITY_BASELINE above. A NEW degenerate node not listed here will
  // fail the parity test, forcing a fix or an explicit acknowledgement.
};
