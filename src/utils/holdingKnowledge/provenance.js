/**
 * provenance.js — the audit trail a believed range carries with it (WS-292).
 *
 * WHY A RANGE NEEDS ONE. `narrowByBoard` returns a `Float64Array` and nothing else. Two
 * arrays that look identical to every consumer can mean completely different things: one
 * may be a preflop prior cut once by an observed flop bet, the other the same prior cut
 * three times down a counterfactual branch of the game tree. WS-303 found the engine doing
 * exactly that — `gameTreeDepth2` applied three narrowings down a line where villain acts
 * twice, and the extra one fired when the turn card was *dealt*. Chained discrimination
 * decayed +0.524 → +0.404 → +0.179 and **nothing in the type system could see it**, because
 * a thrice-cut range and a once-cut range are both just 169 floats.
 *
 * Provenance makes the difference legible: `narrowingCount` is the number WS-303's
 * regression test had to reconstruct with a `vi.fn` spy, available directly on the value.
 *
 * ── OBSERVED vs HYPOTHESIZED ──────────────────────────────────────────────────
 *
 * The `basis` axis is the one that carries real weight. `narrowByBoard` is called from two
 * families of site that are indistinguishable in today's code:
 *
 *   observed      villain actually took this action. Scoring the range against a revealed
 *                 hand is meaningful — that is the WS-293 calibration question.
 *   hypothesized  a counterfactual branch of the game tree ("suppose villain calls").
 *                 Villain never necessarily took it. Scoring THAT against the hand they
 *                 turned up is a category error, not a miscalibration.
 *
 * `holdingTruth` refuses on any handle carrying a hypothesized step for that reason. This
 * module exists so the refusal can be structural rather than a comment asking callers to
 * be careful — the same lesson as `situationKey.js`: when a comment states a fact the code
 * could assert instead, assert it.
 */

export const BASIS = Object.freeze({
  OBSERVED: 'observed',
  HYPOTHESIZED: 'hypothesized',
});

const VALID_BASIS = new Set(Object.values(BASIS));

/** Street implied by board length. Kept here so no caller re-derives it. */
export const streetFromBoardLength = (len) => (
  len >= 5 ? 'river' : len === 4 ? 'turn' : len === 3 ? 'flop' : 'preflop'
);

/**
 * Seed provenance for a fresh holding.
 *
 * @param {Object} params
 * @param {string|number|null} [params.seat]
 * @param {string|number|null} [params.handId]
 * @param {string} [params.seedSource] - where the starting range came from
 *   ('rangeProfile' | 'populationPrior' | 'baseline' | 'maxEntropy' | 'caller'), recorded
 *   because a coverage number means something different against a per-player profile than
 *   against a population chart.
 */
export const openProvenance = ({ seat = null, handId = null, seedSource = 'caller' } = {}) => Object.freeze({
  seat,
  handId,
  seedSource,
  narrowedBy: Object.freeze([]),
  narrowingCount: 0,
  observedNarrowings: 0,
  hypothesizedNarrowings: 0,
  streetsNarrowed: 0,
  revealedAt: null,
});

/**
 * Append one narrowing step. Returns a new frozen provenance — never mutates.
 *
 * `streetsNarrowed` counts DISTINCT streets, which is deliberately not the same as
 * `narrowingCount`: the flop depth-3 line narrows twice across two streets (legitimate),
 * while the WS-303 defect narrowed three times across those same two. A consumer that
 * wants to ask "was this range cut more times than villain acted?" needs both numbers.
 */
export const appendNarrowing = (prov, { action, boardLength, basis }) => {
  if (!VALID_BASIS.has(basis)) {
    throw new Error(`holdingKnowledge: basis must be one of ${[...VALID_BASIS].join(' | ')}, got "${basis}"`);
  }
  const street = streetFromBoardLength(boardLength);
  const step = Object.freeze({ action, street, basis, boardLength });
  const narrowedBy = Object.freeze([...prov.narrowedBy, step]);
  const streets = new Set(narrowedBy.map((s) => s.street));
  return Object.freeze({
    ...prov,
    narrowedBy,
    narrowingCount: narrowedBy.length,
    observedNarrowings: prov.observedNarrowings + (basis === BASIS.OBSERVED ? 1 : 0),
    hypothesizedNarrowings: prov.hypothesizedNarrowings + (basis === BASIS.HYPOTHESIZED ? 1 : 0),
    streetsNarrowed: streets.size,
  });
};

/** Record that ground truth arrived. Touches provenance only — never the range. */
export const markRevealed = (prov, at) => Object.freeze({ ...prov, revealedAt: at ?? null });

/** True when every narrowing this range has been through was an action villain really took. */
export const isPurelyObserved = (prov) => prov.hypothesizedNarrowings === 0;
