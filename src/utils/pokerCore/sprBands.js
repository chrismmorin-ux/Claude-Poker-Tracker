/**
 * sprBands.js — THE SPR zone boundaries, in one place.
 *
 * WHY THIS MOVED HERE (WS-333). SPR banding had accumulated three copies:
 * `exploitEngine/gameTreeConstants.js` (canonical), `spotResolver/spotKeyExtractor.js:22`
 * (a declared-deliberate duplicate whose own comment says *"Future cleanup may move
 * SPR_ZONES to pokerCore/"*), and the printable-refresher manifest. WS-333 needed a fourth
 * — the backtest harness, which cannot import `gameTreeConstants` because that module
 * imports `'../mathUtils'` extensionless and plain Node ESM refuses to resolve it.
 *
 * Adding the fourth copy would have been the `decisionGeometry` argument in reverse:
 * four chances to disagree about where "low SPR" ends. So the boundaries live in
 * `pokerCore/` instead — shared infrastructure both engines and the harness may import,
 * with **no imports of its own**, which is what makes it loadable from plain Node.
 *
 * `gameTreeConstants.js` re-exports these unchanged, so every existing consumer is
 * untouched and there is still exactly one definition.
 *
 * The bands themselves are unchanged and remain a JUDGEMENT, not a measurement — see the
 * rationale below. If they are ever measured, this is the one file that changes.
 */

/**
 * SPR (Stack-to-Pot Ratio) zones with poker theory rationale.
 * Only active when effectiveStack is available (online play with extension).
 *
 * MICRO (0-2): Pure commit-or-fold. Any bet commits the stack.
 * LOW (2-4): Commit-or-fold with some sizing choice. One bet ~commits.
 * MEDIUM (4-8): One-street-to-commit. Can bet once more and be pot-committed.
 * HIGH (8-13): Two-street play. Standard multi-street betting patterns.
 * DEEP (13+): Full multi-street planning. Wide ranges, positional advantage amplified.
 */
export const SPR_ZONES = {
  MICRO: 'micro',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  DEEP: 'deep',
};

/** The band edges, exported so a parity test can assert them rather than restate them. */
export const SPR_BAND_EDGES = Object.freeze([2, 4, 8, 13]);

/**
 * Classify SPR into a strategic zone.
 * @param {number|null} spr - Stack-to-pot ratio (null if unknown)
 * @returns {string|null} Zone name or null if SPR unknown
 */
export const getSPRZone = (spr) => {
  if (spr == null) return null;
  if (spr < 2) return SPR_ZONES.MICRO;
  if (spr < 4) return SPR_ZONES.LOW;
  if (spr < 8) return SPR_ZONES.MEDIUM;
  if (spr < 13) return SPR_ZONES.HIGH;
  return SPR_ZONES.DEEP;
};
