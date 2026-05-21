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

export const LSW_RL_EQUITY_BASELINE = {
  'btn-vs-bb-srp-ip-dry-q72r::flop_root': 0.868782,
  'btn-vs-bb-3bp-ip-wet-t96::flop_root': 0.576512,
  'sb-vs-bb-srp-oop-paired-k77::flop_root': 0.827117,
  'sb-vs-btn-3bp-oop-wet-t98::flop_root': 0.72056,
  // WS-209 (SPR-096, 2026-05-20): hero combo fixed A♥K♦ → A♥K♣ (was an
  // impossible board-colliding holding, previously in KNOWN_DEGENERATE_NODES).
  // Equity now computable: hero top-two-pair vs the resolved BTN 4bet-call
  // range. Sub-0.5 because hero+board remove an ace and a king, concentrating
  // villain into AKo (ties) + AA/KK sets (ahead) alongside the QQ/JJ hero
  // beats. NOTE: the villain range itself has not had its LSW-A8 audit — this
  // pin guards against engine/equity drift, not range-content correctness.
  'utg-vs-btn-4bp-deep::flop_root': 0.488636,
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
