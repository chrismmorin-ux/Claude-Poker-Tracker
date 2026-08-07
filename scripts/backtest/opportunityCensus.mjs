/**
 * opportunityCensus.mjs — WS-428. The Deal Book's decision-opportunity count, as a census.
 *
 * THE QUANTITY. `opportunitiesPerHand` — the second factor of the headline figure
 * (SCORED-READOUT-SPEC §3.3):
 *
 *     overallEvBB100 = edgeBB × opportunitiesPerHand × 100
 *
 * THE DEFINITION, chosen and documented here because the spec names the source (the coverage
 * census over the Deal Book) but not the counting rule:
 *
 *   A DECISION OPPORTUNITY is one POSTFLOP VOLUNTARY ACTION POINT of one seat in one hand —
 *   an entry in the hand's action sequence on flop, turn or river where a seat chose among
 *   bet / raise / call / check / fold. The denominator is the SEAT-HAND: one player dealt
 *   into one hand (POKER_THEORY §14.1 — dividing by table-hands would deflate a 9-handed
 *   rate ~9×).
 *
 * WHY POSTFLOP ONLY. `accumulateDecisions` — the object that defines the decision class the
 * edge is estimated over — emits postflop decisions only (`decisionAccumulator.js`: "Preflop
 * handled by aggregate stats"). `edgeBB` is a mean over that class; multiplying it by a count
 * of a different class (preflop included) would put the two factors on different axes, the
 * WS-291 mechanism in miniature.
 *
 * WHY ALL SEATS, not EVAL players. The POOL/EVAL partition, player caps, and training
 * minimums are properties of the MEASUREMENT DESIGN; the game presents its decisions to every
 * seat identically, and the partition is a uniform hash over players, so the all-seats
 * average is the population figure and depends on nothing the harness chooses.
 *
 * WHY FOLDS AND PREFLOP-FOLDED SEAT-HANDS COUNT. A fold is a decision the seat faced (the
 * engine can advise at it, and the harness scores it). A seat-hand with zero postflop
 * decisions — folded preflop — stays in the denominator, because the figure is the
 * UNCONDITIONAL expected number of postflop decisions per hand hero is dealt. Conditioning
 * on "reached the flop" would be a different (larger) number answering a different question.
 *
 * THE INVARIANCE, BY CONSTRUCTION. Nothing in this module accepts `--max-decisions`,
 * `--max-players`, `poolPct`, walk-forward parameters, or any other harness knob. The count
 * is a function of the Deal Book's hand records alone. That is the structural form of §3.3's
 * refusal: "NOT from n/handsRepresented on the scored subset ... otherwise the headline
 * inherits every sampling limit of the harness." The refusal test in
 * `scripts/__tests__/opportunityCensus.test.js` asserts it: the same Deal Book at two
 * different decision caps yields the same factor, while the forbidden scored-subset ratio
 * moves.
 *
 * WHAT THE HARNESS SCORES IS A SUBSET of what is counted here: geometry-resolution failures,
 * unresolved outcomes, engine skips, unparseable boards all shrink the scored set. That gap
 * is instrument, not game — preserving it is the point, not a discrepancy to reconcile.
 */

import {
  buildCoverageCensus,
  declareExamination,
  attachOpportunityCount,
  opportunitiesPerHand,
  OPPORTUNITY_BASIS,
} from '../../src/utils/standardOfRecord/coverageCensus.js';
import { iterAppHands } from './phhAdapter.mjs';

/** The postflop streets — the axis of the census, and the closed set of counted streets. */
export const OPPORTUNITY_STREETS = Object.freeze(['flop', 'turn', 'river']);

/**
 * Count decision opportunities over an iterable of app-shaped hands.
 *
 * Pure structure walk: reads `seatPlayers` (the dealt-in seats) and
 * `gameState.actionSequence` (voluntary action entries only — the adapter never emits blind
 * posts or showdown reveals as actions). NO caps, NO filters — see the module header.
 *
 * @param {Iterable<Object>} hands - app-shaped hands (from `iterAppHands` or fixtures)
 * @returns {{handsCounted: number, seatHands: number, decisionOpportunities: number,
 *   byStreet: Object}}
 */
export const countDecisionOpportunities = (hands) => {
  let handsCounted = 0;
  let seatHands = 0;
  let decisionOpportunities = 0;
  const byStreet = { flop: 0, turn: 0, river: 0 };

  for (const hand of hands) {
    handsCounted += 1;
    seatHands += Object.keys(hand?.seatPlayers ?? {}).length;
    for (const entry of hand?.gameState?.actionSequence ?? []) {
      if (!OPPORTUNITY_STREETS.includes(entry.street)) continue;
      byStreet[entry.street] += 1;
      decisionOpportunities += 1;
    }
  }

  return { handsCounted, seatHands, decisionOpportunities, byStreet };
};

/**
 * Lift raw counts into a Coverage Census over the street axis, with the opportunity count
 * attached under the one admissible basis.
 *
 * The census carries the by-street counts as cell hits (a street the book never reached is
 * an `observed-zero` cell — we walked every hand and it never happened, which for the river
 * is a real possibility on a tiny fixture and a meaningful fact on a real slice).
 *
 * @param {Object} params
 * @param {Object} params.counts - from `countDecisionOpportunities`
 * @param {string|null} [params.dealBookHash] - identity of the hand set the walk covered
 * @param {Object} [params.domain] - overrides the default domain descriptor
 * @returns {Object} frozen census carrying `opportunities`
 */
export const opportunityCensusFromCounts = ({ counts, dealBookHash = null, domain = null }) => {
  const census = buildCoverageCensus({
    domain: domain ?? {
      object: 'hero decision opportunities over a Deal Book',
      unit: 'postflop voluntary action points per seat-hand',
      dealBookHash,
    },
    axes: [{ name: 'street', levels: [...OPPORTUNITY_STREETS] }],
    hits: { ...counts.byStreet },
    examination: declareExamination({
      mode: 'exhaustive',
      basis: 'every hand record in the Deal Book was walked; counting is a pure function of '
        + 'hand structure with no caps, filters, or harness parameters',
    }),
  });
  return attachOpportunityCount(census, {
    basis: OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE,
    seatHands: counts.seatHands,
    dealBookHash,
    note: 'postflop voluntary action points (bet/raise/call/check/fold on flop|turn|river) '
      + 'per seat-hand; preflop excluded to match the decision class edgeBB is estimated over',
  });
};

/**
 * The full path: stream every hand of a Deal Book's member files and produce the census.
 *
 * @param {Object} params
 * @param {Array<{path: string, site?: string, stakeLabel?: string}>} params.files - the
 *   EXACT file list the Deal Book was built over (post `--max-files` slice — the book must
 *   describe the hands the run saw, and so must this census)
 * @param {string|null} [params.dealBookHash]
 * @param {Function} [params.log]
 * @returns {Promise<Object>} frozen census carrying `opportunities`
 */
export const opportunityCensusForDealBook = async ({ files, dealBookHash = null, log = () => {} }) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('opportunityCensusForDealBook: refusing to census zero files — an empty '
      + 'Deal Book has no opportunity count, not a zero one');
  }
  const totals = { handsCounted: 0, seatHands: 0, decisionOpportunities: 0, byStreet: { flop: 0, turn: 0, river: 0 } };
  let filesDone = 0;
  for (const file of files) {
    const hands = [];
    for await (const hand of iterAppHands(file.path, { site: file.site, stakeLabel: file.stakeLabel })) {
      hands.push(hand);
    }
    const c = countDecisionOpportunities(hands);
    totals.handsCounted += c.handsCounted;
    totals.seatHands += c.seatHands;
    totals.decisionOpportunities += c.decisionOpportunities;
    for (const s of OPPORTUNITY_STREETS) totals.byStreet[s] += c.byStreet[s];
    filesDone += 1;
    if (filesDone % 100 === 0) log(`opportunity census: ${filesDone}/${files.length} files, ${totals.decisionOpportunities} opportunities over ${totals.seatHands} seat-hands`);
  }
  return opportunityCensusFromCounts({ counts: totals, dealBookHash });
};

/** Re-exported so harness-side consumers get the reader from the same module as the counter. */
export { opportunitiesPerHand };
