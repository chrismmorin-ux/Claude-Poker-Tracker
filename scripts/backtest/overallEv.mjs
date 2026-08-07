/**
 * overallEv.mjs — WS-428. `overallEvBB100`, composed so the product cannot travel alone.
 *
 * SCORED-READOUT-SPEC §3.3:
 *
 *     overallEvBB100 = edgeBB × opportunitiesPerHand × 100
 *
 *       edgeBB               estimateEdge(...).edgeBB — mean change in hand value from
 *                            substituting ONE decision
 *       opportunitiesPerHand from the coverage census over the Deal Book — NOT from
 *                            n/handsRepresented on the scored subset
 *
 * THE BOTH-FACTORS RULE (WS-410 Stage 2, POKER_THEORY §14.2). The §14.2 decomposition exists
 * to expose the change that improves the rate while shrinking the opportunities — so both
 * factors are ALWAYS carried and printed beside the product, never only the product. This
 * module enforces that shape: the returned object has no form in which `overallEvBB100`
 * exists without `factors.edgeBB` and `factors.opportunitiesPerHand` beside it, and the
 * renderer prints the factors FIRST.
 *
 * Not to be confused with `ipsEstimator.edgeBBPer100`, the deprecated bare ×100 rescale with
 * no denominator change (§3.2's landmine).
 */

import { opportunitiesPerHand } from '../../src/utils/standardOfRecord/coverageCensus.js';

/**
 * HC-011 — the population statement. Printed inline wherever the figure is emitted, because
 * a caveat that lives in a different file from the number is a caveat the number travels
 * without. Rank-1 register entry: FAULT-population-mismatch (breadth 0.90).
 */
export const OVERALL_EV_POPULATION =
  'POPULATION: online 2009 HandHQ corpus (SRC-012). For the founder\'s live 1/2-1/3 game '
  + 'this figure is TRANSFERRED, NOT MEASURED — fault register rank 1, '
  + 'FAULT-population-mismatch.';

/** §3.3's horizon caveat, carried with the figure for the same reason. */
export const OVERALL_EV_HORIZON_NOTE =
  'A budget of value available across the decisions faced in 100 hands, priced one decision '
  + 'at a time (one-decision horizon, pool continuation). Summing per-decision edges assumes '
  + 'additivity (FAULT-horizon-bias). NOT a winrate.';

/**
 * Compose the headline figure from its two factors.
 *
 * @param {Object} params
 * @param {number|null} params.edgeBB - `estimateEdge(...).edgeBB`; null when nothing scored
 * @param {Object} params.census - a coverage census carrying an opportunity count
 *   (`attachOpportunityCount`). The census path is the ONLY way in: passing a bare
 *   opportunities-per-hand number is not accepted, so the §3.3 basis refusal in
 *   `opportunitiesPerHand` runs on every composition.
 * @returns {Object} frozen — product and factors inseparably together
 */
export const composeOverallEv = ({ edgeBB, census }) => {
  // Throws on a census with no attached count or a forbidden basis — see coverageCensus.js.
  const opp = opportunitiesPerHand(census);

  const haveEdge = Number.isFinite(edgeBB);
  return Object.freeze({
    /** The product. Null (with its reason beside it) when no edge was measurable. */
    overallEvBB100: haveEdge ? edgeBB * opp.perHand * 100 : null,
    overallEvUnavailableReason: haveEdge ? null : 'edgeBB is null — no decisions were scored',
    /** BOTH factors, always. WS-410 Stage 2: never only the product. */
    factors: Object.freeze({
      edgeBB: haveEdge ? edgeBB : null,
      opportunitiesPerHand: opp.perHand,
    }),
    /** The second factor's provenance, so a reader can see it is game, not harness. */
    opportunities: Object.freeze({
      decisionOpportunities: opp.decisionOpportunities,
      seatHands: opp.seatHands,
      basis: opp.basis,
      dealBookHash: opp.dealBookHash,
      conditional: opp.conditional,
    }),
    population: OVERALL_EV_POPULATION,
    horizonNote: OVERALL_EV_HORIZON_NOTE,
  });
};

const fmt = (x, dp = 4) => (x === null || x === undefined ? '—' : x.toFixed(dp));

/**
 * Render the figure. Factors first, product second, caveats inline — a reader cannot meet
 * the product before its factors, and cannot quote it without passing the population line.
 *
 * @param {Object} o - from `composeOverallEv`
 * @returns {string[]} lines
 */
export const renderOverallEvLines = (o) => {
  const L = [];
  L.push('  OVERALL EV — the optimizable figure (SCORED-READOUT-SPEC §3.3, WS-428)');
  L.push('  ' + '─'.repeat(90));
  L.push(`    factor 1  edgeBB               ${fmt(o.factors.edgeBB)} bb per substituted decision`);
  L.push(`    factor 2  opportunitiesPerHand ${fmt(o.factors.opportunitiesPerHand)} `
    + `(${o.opportunities.decisionOpportunities} postflop decision opportunities / `
    + `${o.opportunities.seatHands} seat-hands, from Deal Book structure — `
    + 'invariant to --max-decisions)');
  if (o.overallEvBB100 === null) {
    L.push(`    overallEvBB100 — (${o.overallEvUnavailableReason})`);
  } else {
    L.push(`    overallEvBB100 = ${fmt(o.factors.edgeBB)} × ${fmt(o.factors.opportunitiesPerHand)} × 100 = ${fmt(o.overallEvBB100, 3)} bb/100 hands`);
  }
  L.push(`    ${o.population}`);
  L.push(`    ${o.horizonNote}`);
  L.push('');
  return L;
};
