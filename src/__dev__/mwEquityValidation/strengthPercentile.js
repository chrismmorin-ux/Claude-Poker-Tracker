/**
 * strengthPercentile.js — preflop hand-class strength for the MW-equity validation harness.
 *
 * WHAT THIS IS. The COMBO-WEIGHTED EQUITY PERCENTILE of a hand class: the fraction of the
 * 1326 starting combos this class beats, measured by `EQUITY_VS_OPEN` (midpoint-of-ties, so
 * classes with identical table entries share a percentile rather than being ordered by grid
 * index). A threshold `t` therefore means exactly "the top (1 − t) of the field".
 *
 * THIS IS THE SAME QUANTITY THE ENGINE USES. `rangeEngine/populationPriors.js` computes it
 * as the private `strengthPercentiles(position)` / `handStrengthTier(idx, position)` pair
 * (WS-304). Same table, same formula, same midpoint-of-ties rule, same fallback key.
 *
 * WHY IT IS RE-DERIVED HERE RATHER THAN IMPORTED — read this before "fixing" the duplication.
 * The engine keeps both functions module-private and `rangeEngine/index.js` does not surface
 * them, so importing would mean widening the engine's public API for a dev harness. The
 * thing that is genuinely shared is the TABLE (`pokerCore/preflopEquityTable.js`), which
 * both sides read, and which is the only input either computation has. If you ever promote
 * the engine's version — the right home is `pokerCore/`, since the quantity depends on
 * nothing in `rangeEngine/` — DELETE this module and import that one.
 *
 * THE DUPLICATE IS PINNED, NOT FREE-FLOATING. `mwEquityValidationSmoke.test.js` asserts that
 * the ordering this module produces reproduces the ordering visible in the engine's own
 * `getPopulationPrior(position, 'threeBet')` output. If either side's strength model moves,
 * that test fails and names this file. That guard is what makes the duplication survivable;
 * do not delete it while the duplication stands.
 *
 * WHAT IT REPLACED (WS-367). This harness previously scored hands with
 * `(rank1 + rank2 + 8·isPair + 2·suited) / 32` — a second, surviving copy of the rank sum
 * WS-304 retired from the engine. A rank sum has 33 distinct levels to spend on 169 classes,
 * and it is not a strength ordering: it scored 22 at 0.250 against K3o's 0.375, and it put
 * AKs (0.781) below JJ (0.813) for reasons that have nothing to do with either hand.
 *
 * NAMED APPROXIMATION, inherited from the table and stated in the same words as WS-304.
 * All-in equity does not encode equity REALIZATION, so this ordering ranks AKo just below
 * TT/JJ (and below 99 at LATE), where doctrine ranks AK above both. It is still the right
 * instrument here, because the error it makes is one or two rank positions and the error it
 * replaces was ~150. Every tier boundary in `scenarios/heroResponse.js` inherits the caveat.
 */

import { decodeIndex } from '../../utils/pokerCore/rangeMatrix';
import { EQUITY_VS_OPEN } from '../../utils/pokerCore/preflopEquityTable';

const GRID_SIZE = 169;
export const TOTAL_COMBOS = 1326;

const COMBOS_AT = new Uint8Array(GRID_SIZE);
for (let i = 0; i < GRID_SIZE; i++) {
  const { isPair, suited } = decodeIndex(i);
  COMBOS_AT[i] = isPair ? 6 : suited ? 4 : 12;
}

/**
 * Hero's position key into `EQUITY_VS_OPEN`, per harness position.
 *
 * The engine's score is position-conditioned and this harness's hero is not always in the
 * same seat, so the conditioning has to be named rather than defaulted. `EQUITY_VS_OPEN` is
 * keyed by hero's OPENING position — which is exactly what these scenarios model, hero
 * having opened and now facing action behind — so the mapping is the harness position's own
 * category: BTN is LATE, UTG is EARLY. The order barely moves between keys; what does move
 * is where AK sits relative to the middle pairs, and that lands on real tier boundaries
 * (see `scenarios/heroResponse.js`).
 */
export const HERO_EQUITY_KEY = Object.freeze({ BTN: 'LATE', UTG: 'EARLY' });

const percentileCache = {};

/** Percentile grid (169 cells) for one position key. */
export const strengthPercentiles = (position) => {
  if (percentileCache[position]) return percentileCache[position];
  // Same key semantics and same fallback as the engine: an unrecognized category falls back
  // rather than throwing.
  const eq = EQUITY_VS_OPEN[position] || EQUITY_VS_OPEN.LATE;
  const out = new Float64Array(GRID_SIZE);
  for (let i = 0; i < GRID_SIZE; i++) {
    let below = 0;
    let tied = 0;
    for (let j = 0; j < GRID_SIZE; j++) {
      if (eq[j] < eq[i]) below += COMBOS_AT[j];
      else if (eq[j] === eq[i]) tied += COMBOS_AT[j];
    }
    out[i] = (below + tied / 2) / TOTAL_COMBOS;
  }
  percentileCache[position] = out;
  return out;
};

/**
 * Hand strength (0.0–1.0) for one grid cell, conditioned on hero's position.
 * Higher = stronger. Deliberately NOT named `handStrengthTier`: that name belongs to the
 * engine's function, and this harness carrying a same-named different quantity is the defect
 * WS-367 closed.
 *
 * @param {number} idx - hand class index 0..168
 * @param {string} position - EQUITY_VS_OPEN key ('EARLY' | 'MIDDLE' | 'LATE' | 'SB' | 'BB')
 * @returns {number}
 */
export const strengthPercentile = (idx, position) => strengthPercentiles(position)[idx];
