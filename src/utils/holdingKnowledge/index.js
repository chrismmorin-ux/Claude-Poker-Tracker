/**
 * holdingKnowledge — what do we know about this seat's holding at this decision point?
 *
 * THE MISSING JOIN (WS-292). Showdown reveals what a seat actually held. The engine carries
 * an inferred range for that seat at every decision. Nothing in this repo joined the two.
 * `decisionAccumulator` reads `playerShowdown` and uses it for sizing-tell samples and a
 * `handShown` field — it never reconciles the range it is carrying against the hand it just
 * learned the player held. Ground truth and inference sat two hundred lines apart in the
 * same function and never met.
 *
 * That absence is why WS-291 — a falsified range model on the live recommendation path —
 * survived unmeasured for the life of the project.
 *
 * ── THE BINDING RULE ──────────────────────────────────────────────────────────
 *
 *   Never within the decision being scored. Always as accumulated evidence about the player.
 *
 * Using a revealed hand to rewrite THAT hand's earlier ranges is circular: the range would
 * already contain the answer, and every calibration number would flatter itself. Using it
 * as evidence that widens the player's model on SUBSEQUENT decisions is ordinary Bayesian
 * updating, and is the same shape as the fold-curve and sizing-tell fitting that
 * `decisionAccumulator` already does.
 *
 * So the two halves are separated by construction, not by convention:
 *
 *   holdingBelief(h)  ->  { range, provenance }              never contains revealed cards
 *   holdingTruth(h)   ->  { revealed, covered, logLift, … }  a separately-named, greppable ask
 *
 * `revealHolding` writes to provenance only. `holdingBelief(h).range` is the SAME
 * `Float64Array` reference before and after truth is attached — asserted by test, because
 * "we were careful" is not a guarantee.
 *
 * ── WHY A COVERAGE MISS IS THE MOST INFORMATIVE OBSERVATION AVAILABLE ─────────
 *
 * A revealed hand the range put near-zero weight on is not a scoring artifact — it is the
 * observation that falsifies the method FOR THAT PLAYER. It says they continue below the
 * equity threshold the model assumes, so they arrive at the river with a range both wider
 * and weaker than modelled. That cuts two ways at once: more of their river bets are
 * no-showdown-value bluffs (bluffcatch wider against them), and more of their range folds
 * to ours (bluff wider against them). Both fall out automatically once the width is right,
 * which is the clean part — no new exploit rule is needed, and per the weakness/exploit
 * separation rule none would be permitted anyway (the observation is villain-side; the
 * counter-strategy is the game tree's to compute).
 *
 * Fitting a per-player width from that signal is deliberately NOT in this module. That
 * number can only be chosen by measuring it on the corpus — the same discipline WS-291
 * applied to the floor and WS-303 to `ACTION_TAU_FRACTION` — and this module is what makes
 * the measurement possible. See `coverage.js` for why the usable signal is `logLift` rather
 * than the (currently degenerate) binary `covered`.
 *
 * ── WHY NOT pokerCore/ ────────────────────────────────────────────────────────
 *
 * `pokerCore/CLAUDE.md` binds that directory to no engine imports and no player data.
 * Producing the belief half requires `narrowByBoard` from `exploitEngine/postflopNarrower`,
 * which itself takes `playerStats` and `continuationRate`. Only a pure carrier that computes
 * nothing could live there, and a pure carrier leaves every consumer deriving its own range —
 * the exact defect this primitive exists to remove. It sits beside `heroState/` instead, as
 * the villain-side counterpart of the Hero State Primitive.
 */

import { narrowByBoard } from '../exploitEngine/postflopNarrower';
import {
  BASIS, openProvenance, appendNarrowing, markRevealed, isPurelyObserved,
} from './provenance';
import { scoreCoverage } from './coverage';

export { BASIS } from './provenance';

/**
 * Open a holding at its starting range.
 *
 * Handles are immutable — every operation returns a new one. This is not ceremony:
 * `decisionAccumulator` currently does `const rangeBefore = currentRange`, an alias that is
 * safe only because `narrowByBoard` happens to return a fresh array. Immutability removes
 * that standing hazard rather than documenting it.
 *
 * @param {Object} params
 * @param {Float64Array} params.seed - the starting 169-cell range
 * @param {string} [params.seedSource] - 'rangeProfile' | 'populationPrior' | 'baseline' |
 *   'maxEntropy' | 'caller'
 * @param {string|number|null} [params.seat]
 * @param {string|number|null} [params.handId]
 * @returns {Object} an opaque holding handle
 */
export const openHolding = ({ seed, seedSource = 'caller', seat = null, handId = null }) => {
  if (!seed) throw new Error('holdingKnowledge.openHolding: seed range is required');
  return Object.freeze({
    range: seed,
    provenance: openProvenance({ seat, handId, seedSource }),
    truth: null,
  });
};

/**
 * Narrow a holding by one action.
 *
 * A THIN PASS-THROUGH, deliberately. `options` reaches `narrowByBoard` untouched and its
 * returned array is stored by reference, so a wired call site is bit-identical to the bare
 * call it replaced. All this adds is the provenance entry — which is the whole point, and
 * is also why the migration can be verified by diffing engine output for exact equality.
 *
 * @param {Object} handle
 * @param {Object} params
 * @param {string} params.action - 'raise' | 'call' | 'check' | 'bet' | 'fold'
 * @param {number[]} params.board
 * @param {number[]} [params.deadCards]
 * @param {string} params.basis - BASIS.OBSERVED when villain really took this action,
 *   BASIS.HYPOTHESIZED for a counterfactual game-tree branch. Required, with no default:
 *   guessing it would reintroduce exactly the ambiguity this axis exists to remove.
 * @param {Object} [params.options] - forwarded verbatim to narrowByBoard
 * @returns {Object} a new handle
 */
export const narrowHolding = (handle, { action, board, deadCards = [], basis, options = {} }) => {
  const range = narrowByBoard(handle.range, action, board, deadCards, options);
  return Object.freeze({
    range,
    provenance: appendNarrowing(handle.provenance, {
      action, boardLength: board?.length ?? 0, basis,
    }),
    truth: handle.truth,
  });
};

/**
 * Attach ground truth. Does NOT touch the range — that is the binding rule, made structural.
 *
 * @param {Object} handle
 * @param {number[]} cards - the two encoded cards the seat turned up
 * @param {Object} [at] - where truth arrived, e.g. { street, order }
 */
export const revealHolding = (handle, cards, at = null) => Object.freeze({
  range: handle.range,
  provenance: markRevealed(handle.provenance, at),
  truth: (Array.isArray(cards) && cards.length === 2) ? Object.freeze([...cards]) : null,
});

/**
 * What we BELIEVE. The safe read — always available, never contaminated by truth.
 *
 * @returns {{range: Float64Array, provenance: Object}}
 */
export const holdingBelief = (handle) => ({
  range: handle.range,
  provenance: handle.provenance,
});

/**
 * What was TRUE, scored against what we believed. The explicit ask.
 *
 * Returns `null` — with a `reason` on the refusal cases so a caller cannot mistake "we
 * refuse to answer" for "nothing was shown":
 *
 *   'not-revealed'   no showdown for this seat.
 *   'hypothesized'   the range was narrowed through at least one counterfactual branch.
 *                    Villain never necessarily took it, so scoring it against the hand they
 *                    turned up measures a road not travelled. This refusal is the reason the
 *                    `basis` axis exists.
 *   'unscoreable'    board/card collision — a data problem, not a model result.
 *
 * @param {Object} handle
 * @param {Object} [params]
 * @param {number[]} [params.board] - required to score; omit and you get the refusal
 * @param {number[]} [params.deadCards]
 * @returns {(Object|null)}
 */
export const holdingTruth = (handle, { board, deadCards = [] } = {}) => {
  if (!handle.truth) return null;
  if (!isPurelyObserved(handle.provenance)) {
    return { refused: true, reason: 'hypothesized', revealed: handle.truth };
  }
  const scored = scoreCoverage(handle.range, board, handle.truth, deadCards);
  if (!scored) return { refused: true, reason: 'unscoreable', revealed: handle.truth };
  return {
    refused: false,
    revealed: handle.truth,
    revealedAt: handle.provenance.revealedAt,
    ...scored,
  };
};

/** Convenience: the shape the ticket names, with truth gated behind an explicit opt-in. */
export const holdingKnowledge = (handle, { board, deadCards = [], includeTruth = false } = {}) => ({
  range: handle.range,
  provenance: handle.provenance,
  revealed: includeTruth ? handle.truth : null,
  truth: includeTruth ? holdingTruth(handle, { board, deadCards }) : null,
});

export { scoreCoverage } from './coverage';
export { isPurelyObserved, streetFromBoardLength } from './provenance';
