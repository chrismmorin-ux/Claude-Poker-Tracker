/**
 * lineTaxonomy.js - Derived preflop line classification
 *
 * Single source of truth for turning a preflop action sequence into derived
 * line tags. Governed by POKER_THEORY.md §2.5 and ratified in DEC-025.
 *
 * THE RULE (POKER_THEORY §7.1 applied to line classification): a tag is an
 * OUTPUT of the action sequence, never an input to the model. Every class
 * below is derived from sequence state — prior investment, callers between,
 * raise count, posted money. No tag is ever hand-labeled, and no tag is
 * inferred from a position label alone.
 *
 * THREE independent decision trees, each with RETAINED PARENTS and subclasses.
 * The tree is selected by ONE quantity — how many raises are already in the
 * sequence when the seat acts:
 *
 *   0 raises   No raise faced   fold | limp | open       → openFirstIn | isoRaise
 *   1 raise    Facing a raise   fold | coldCall | threeBet → cold3Bet | squeeze | limpReraise
 *   2+ raises  Facing a 3-bet   fold | call4 | fourBet   → cold4Bet | fourBetAfterOpen
 *
 * Parents keep their pre-taxonomy meaning exactly, so every existing consumer
 * of `open` / `threeBet` is unaffected. Subclasses are strictly additive.
 *
 * WS-521 / WS-270 — WHAT THE THIRD TREE FIXED, AND WHY IT HAD TO BE A TREE.
 *
 * Before this change, a second decision was emitted ONLY under `if (seatLimped)`.
 * A seat that OPENED, faced a 3-bet, and then folded / called / 4-bet produced
 * exactly ONE record: `open`. Its response to the 3-bet was emitted nowhere, and
 * `subActionExtractor.js` has no notion of `open` — so the most common aggressive
 * preflop trajectory was invisible to the range model. A missing observation
 * produces no symptom, which is why it survived.
 *
 * It is a TREE and not a fourth `threeBet` subclass because a subclass could only
 * ever claim the 4-bet RAISE branch — the `subAction: null` residual that already
 * sat in `threeBet`. It would still emit nothing for the opener who FOLDS or CALLS
 * a 3-bet, which is the actual hole. Facing a 3-bet is a decision among
 * `fold | call4 | fourBet`, and only a normalization scenario can express that.
 * (Founder ruling 2026-08-17, resolving the fork WS-270's own text left open.)
 *
 * CONSEQUENCE FOR `threeBet`, stated plainly: a raise over two or more prior
 * raises used to be counted in the `threeBet` PARENT with `subAction: null`.
 * POKER_THEORY §2.5.3 calls that residual "WS-270's slice, left with the parent"
 * and it is exactly what `totalShare < 1` measured. The third tree now CLAIMS it,
 * so `threeBet` no longer contains 4-bets. Hands that never reach a second raise
 * are bit-identical.
 */

import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions.js';

/**
 * Which decision tree a seat is in, derived from the raise count it faces.
 *
 * This replaces the `facedRaise` BOOLEAN as the discriminator. A boolean can
 * separate two trees and cannot separate three; `facedRaise` is retained on
 * every record for existing consumers, but it is now a derived convenience
 * (`scenario !== NO_RAISE`) rather than the thing that selects the tree.
 */
export const SCENARIOS = {
  NO_RAISE: 'noRaise',
  FACED_RAISE: 'facedRaise',
  FACED_3BET: 'faced3Bet',
};

/** Retained parent aggregates — pre-taxonomy semantics, unchanged. */
export const PARENT_ACTIONS = {
  FOLD: 'fold',
  LIMP: 'limp',
  OPEN: 'open',
  COLD_CALL: 'coldCall',
  THREE_BET: 'threeBet',
  CALL4: 'call4',
  FOUR_BET: 'fourBet',
};

/** Derived subclasses. Each sums into exactly one parent. */
export const SUBCLASS_ACTIONS = {
  OPEN_FIRST_IN: 'openFirstIn',
  ISO_RAISE: 'isoRaise',
  COLD_3BET: 'cold3Bet',
  SQUEEZE: 'squeeze',
  LIMP_RERAISE: 'limpReraise',
  COLD_4BET: 'cold4Bet',
  FOUR_BET_AFTER_OPEN: 'fourBetAfterOpen',
};

/**
 * PRIOR ROLE in the facing-3-bet tree — what this seat had voluntarily done
 * BEFORE the spot. Sequence state only, never a hand or position label.
 *
 * This is a CONDITIONING SET, not a subclass: it splits the decision population
 * rather than the hand grid, which is why it lives beside `raisesFaced` on every
 * faced-3-bet decision instead of in `SUBCLASS_ACTIONS`.
 *
 * WS-521 follow-up. `FOUR_BET_FREQUENCIES` is measured on OPENER only
 * (populationPriors.js: "this seat RAISED preflop, then faced a 3-bet ... the
 * cold case is NOT measured here. It is expected to fold [more]"), and was
 * being applied to the whole tree. Measured on 28,699 corpus hands, the three
 * roles are not close and cold is the PLURALITY:
 *
 *   opener   n=2779   fold 42.97%  call4 44.98%  fourBet 12.05%   <- the prior's set
 *   cold     n=3083   fold 94.55%  call4  3.89%  fourBet  1.56%
 *   passive  n= 669   fold 68.16%  call4 29.90%  fourBet  1.94%
 *
 * Folding those together reports a number that describes none of them, which is
 * the WS-371 mechanism (P(fold | faced any raise) vs P(fold | I opened and got
 * 3-bet), 82.3% vs 48.4%) reproduced one tree deeper.
 */
export const PRIOR_ROLES = {
  OPENER: 'opener',   // raised earlier — defending a range it chose
  COLD: 'cold',       // no voluntary action yet — a backraise spot
  PASSIVE: 'passive', // limped or called earlier — investment, no aggression
};

/** subclass → parent. The sum invariant is asserted against this map. */
export const SUBCLASS_PARENT = {
  [SUBCLASS_ACTIONS.OPEN_FIRST_IN]: PARENT_ACTIONS.OPEN,
  [SUBCLASS_ACTIONS.ISO_RAISE]: PARENT_ACTIONS.OPEN,
  [SUBCLASS_ACTIONS.COLD_3BET]: PARENT_ACTIONS.THREE_BET,
  [SUBCLASS_ACTIONS.SQUEEZE]: PARENT_ACTIONS.THREE_BET,
  [SUBCLASS_ACTIONS.LIMP_RERAISE]: PARENT_ACTIONS.THREE_BET,
  [SUBCLASS_ACTIONS.COLD_4BET]: PARENT_ACTIONS.FOUR_BET,
  [SUBCLASS_ACTIONS.FOUR_BET_AFTER_OPEN]: PARENT_ACTIONS.FOUR_BET,
};

/** parent → its subclasses, in doctrine order (POKER_THEORY §2.5.2). */
export const PARENT_SUBCLASSES = {
  [PARENT_ACTIONS.OPEN]: [SUBCLASS_ACTIONS.OPEN_FIRST_IN, SUBCLASS_ACTIONS.ISO_RAISE],
  [PARENT_ACTIONS.THREE_BET]: [
    SUBCLASS_ACTIONS.COLD_3BET,
    SUBCLASS_ACTIONS.SQUEEZE,
    SUBCLASS_ACTIONS.LIMP_RERAISE,
  ],
  [PARENT_ACTIONS.FOUR_BET]: [
    SUBCLASS_ACTIONS.COLD_4BET,
    SUBCLASS_ACTIONS.FOUR_BET_AFTER_OPEN,
  ],
};

/** Which parents belong to which tree. Normalization is per-scenario (§2.5 / CLAUDE.md §3). */
export const SCENARIO_PARENTS = {
  [SCENARIOS.NO_RAISE]: [PARENT_ACTIONS.LIMP, PARENT_ACTIONS.OPEN],
  [SCENARIOS.FACED_RAISE]: [PARENT_ACTIONS.COLD_CALL, PARENT_ACTIONS.THREE_BET],
  [SCENARIOS.FACED_3BET]: [PARENT_ACTIONS.CALL4, PARENT_ACTIONS.FOUR_BET],
};

/**
 * Posted-money actions. A straddle is posted, not voluntary — it must not be
 * read as the seat's first voluntary action, and it is not a raise faced.
 * (Straddler 3-bets are the documented residual of the blind3Bet merge; they
 * classify as plain cold3Bet. POKER_THEORY §2.5.2.)
 */
const isPosted = (action) => action === PRIMITIVE_ACTIONS.STRADDLE;

/**
 * A seat's voluntary preflop actions, in order.
 * @param {Array} preflopActions - preflop timeline entries {order, seat, action}
 * @param {string} seat
 * @returns {Array} entries for this seat, posted actions excluded
 */
const voluntaryActionsForSeat = (preflopActions, seat) =>
  preflopActions
    .filter(e => e.seat === seat && !isPosted(e.action))
    .sort((a, b) => a.order - b.order);

/**
 * Classify a raise made when NO raise has been faced.
 * openFirstIn (nobody voluntarily entered) vs isoRaise (raising over limpers).
 */
const classifyUnraisedRaise = (priorEntries, seat) => {
  const limpersAhead = priorEntries.some(
    e => e.seat !== seat && e.action === PRIMITIVE_ACTIONS.CALL
  );
  return limpersAhead ? SUBCLASS_ACTIONS.ISO_RAISE : SUBCLASS_ACTIONS.OPEN_FIRST_IN;
};

/**
 * Classify a raise made FACING EXACTLY ONE RAISE — the 3-bet tree.
 *
 * The `raises.length !== 1` guard that used to return null here is gone: this
 * function is now only reached in the one-raise scenario, so the condition it
 * tested cannot occur. Two-or-more-raise spots go to the 4-bet tree instead of
 * falling through to a null subclass.
 *
 * @param {Array} priorEntries - all preflop entries before this action
 * @param {string} seat
 * @param {boolean} seatLimpedEarlier
 */
const classifyRaiseFacingRaise = (priorEntries, seat, seatLimpedEarlier) => {
  // Limp-reraise wins over every other subclass: the passive line was chosen
  // deliberately, and that makes the range uncapped (POKER_THEORY §5.8).
  if (seatLimpedEarlier) return SUBCLASS_ACTIONS.LIMP_RERAISE;

  const raises = priorEntries.filter(
    e => e.seat !== seat && e.action === PRIMITIVE_ACTIONS.RAISE
  );
  // Defensive: the caller guarantees exactly one raise faced.
  if (raises.length === 0) return null;

  // Squeeze: at least one caller came in between the raise and this seat.
  // Matches sequenceUtils.wouldBeSqueeze (parity asserted by test).
  const raiseOrder = raises[0].order;
  const callersBetween = priorEntries.some(
    e => e.seat !== seat &&
         e.action === PRIMITIVE_ACTIONS.CALL &&
         e.order > raiseOrder
  );

  return callersBetween ? SUBCLASS_ACTIONS.SQUEEZE : SUBCLASS_ACTIONS.COLD_3BET;
};

/**
 * Classify a raise made FACING TWO OR MORE RAISES — the 4-bet tree.
 *
 * Derived purely from the seat's own prior voluntary investment, which is the
 * sequence-state fact that separates the two ranges:
 *
 *   cold4Bet          the seat has invested NOTHING voluntarily — a backraise
 *                     over an open and a 3-bet, with players still behind. The
 *                     4-bet analogue of the cold3Bet doctrine (§2.5.2): no money
 *                     in, so the live pool does this with genuine value plus a
 *                     thin bluff tail.
 *   fourBetAfterOpen  the seat RAISED earlier and is defending that raise. Wider
 *                     and more merged than a cold 4-bet — the seat already
 *                     represented a range and is being attacked inside it.
 *
 * A seat that LIMPED or CALLED earlier and then 4-bets is neither: there is prior
 * investment but no prior aggression. That is left as a documented residual on the
 * parent (`subAction: null`), the same treatment the 4-bet raise itself received
 * before this tree existed.
 */
const priorRoleOf = (priorEntries, seat) => {
  const own = priorEntries.filter(e => e.seat === seat && !isPosted(e.action));
  if (own.length === 0) return PRIOR_ROLES.COLD;
  if (own.some(e => e.action === PRIMITIVE_ACTIONS.RAISE)) return PRIOR_ROLES.OPENER;
  return PRIOR_ROLES.PASSIVE;
};

const classifyRaiseFacingThreeBet = (priorEntries, seat) => {
  // Derived from the SAME role fact the denominator uses, so a 4-bet can never
  // be counted into one conditioning set and subclassed into another.
  switch (priorRoleOf(priorEntries, seat)) {
    case PRIOR_ROLES.COLD: return SUBCLASS_ACTIONS.COLD_4BET;
    case PRIOR_ROLES.OPENER: return SUBCLASS_ACTIONS.FOUR_BET_AFTER_OPEN;
    default: return null;
  }
};

/** The tree a seat is in, from the raise count already in the sequence. */
const scenarioFor = (raiseCount) => {
  if (raiseCount === 0) return SCENARIOS.NO_RAISE;
  if (raiseCount === 1) return SCENARIOS.FACED_RAISE;
  return SCENARIOS.FACED_3BET;
};

/**
 * Derive every preflop decision point a seat faced in one hand.
 *
 * ONE HAND CAN YIELD SEVERAL DECISION POINTS (POKER_THEORY §2.5.4). A seat that
 * limps and later re-raises made two decisions in two different game states,
 * and BOTH are emitted: `limp` (no-raise tree) and `limpReraise` (facing-raise
 * tree). The limp emission is load-bearing — dropping it would strip trapped
 * hands out of the limp range and manufacture the "limp range is capped"
 * exploit that §5.8 and the trait detector exist to suppress.
 *
 * A seat is re-decided whenever the raise count in front of it CHANGES. That one
 * rule subsumes the old `if (seatLimped)` special case and is what makes the
 * opener's response to a 3-bet reachable at all.
 *
 * Limp-call and limp-fold are still NOT emitted here: in the one-raise scenario
 * there is prior investment, so they are not cold calls, and folding them into
 * `coldCall` would corrupt its definition (§2.5.4). They remain the sub-action
 * tree's business (subActionExtractor.js). In the TWO-raise scenario there is no
 * such ambiguity — `fold` and `call4` are the real branches of that decision and
 * are emitted.
 *
 * @param {Array} preflopActions - preflop timeline entries {order, seat, action}
 * @param {string|number} seat
 * @returns {Array<{parentAction, subAction, facedRaise, scenario, raisesFaced}>}
 */
export const derivePreflopDecisions = (preflopActions, seat) => {
  if (!Array.isArray(preflopActions) || preflopActions.length === 0) return [];

  const s = String(seat);
  const ordered = [...preflopActions].sort((a, b) => a.order - b.order);
  const seatActions = voluntaryActionsForSeat(ordered, s);
  if (seatActions.length === 0) return [];

  const decisions = [];
  const priorTo = (order) => ordered.filter(e => e.order < order);

  // Every raise already in the sequence, by ANY seat including this one. The
  // seat's own open is what makes its response to a 3-bet a two-raise spot.
  const raisesBefore = (order) =>
    ordered.filter(e => e.order < order && e.action === PRIMITIVE_ACTIONS.RAISE).length;

  let seatLimped = false;
  let lastRaiseCount = -1;

  for (let i = 0; i < seatActions.length; i++) {
    const act = seatActions[i];
    const raiseCount = raisesBefore(act.order);

    // Nothing new to respond to — the seat is not at a fresh decision point.
    if (i > 0 && raiseCount === lastRaiseCount) continue;

    const scenario = scenarioFor(raiseCount);
    const prior = priorTo(act.order);
    const record = (parentAction, subAction) => {
      decisions.push({
        parentAction,
        subAction,
        facedRaise: raiseCount > 0,
        scenario,
        raisesFaced: raiseCount,
        // The conditioning set this decision belongs to. Null outside the
        // facing-3-bet tree, where the distinction does not exist.
        priorRole: scenario === SCENARIOS.FACED_3BET ? priorRoleOf(prior, s) : null,
      });
      lastRaiseCount = raiseCount;
    };

    if (scenario === SCENARIOS.FACED_3BET) {
      // The third tree. All three branches are genuine decisions here.
      switch (act.action) {
        case PRIMITIVE_ACTIONS.FOLD:
          record(PARENT_ACTIONS.FOLD, null);
          break;
        case PRIMITIVE_ACTIONS.CALL:
          record(PARENT_ACTIONS.CALL4, null);
          break;
        case PRIMITIVE_ACTIONS.RAISE:
          record(PARENT_ACTIONS.FOUR_BET, classifyRaiseFacingThreeBet(prior, s));
          break;
        default:
          break;
      }
      continue;
    }

    if (i > 0) {
      // A LATER decision in the one-raise tree. Only a raise is emitted here —
      // limp-call and limp-fold belong to the sub-action tree (§2.5.4).
      if (act.action === PRIMITIVE_ACTIONS.RAISE && scenario === SCENARIOS.FACED_RAISE) {
        record(PARENT_ACTIONS.THREE_BET, classifyRaiseFacingRaise(prior, s, seatLimped));
      }
      continue;
    }

    // --- The seat's first voluntary action ---
    switch (act.action) {
      case PRIMITIVE_ACTIONS.FOLD:
        record(PARENT_ACTIONS.FOLD, null);
        break;

      case PRIMITIVE_ACTIONS.CALL:
        if (scenario === SCENARIOS.FACED_RAISE) {
          record(PARENT_ACTIONS.COLD_CALL, null);
        } else {
          seatLimped = true;
          record(PARENT_ACTIONS.LIMP, null);
        }
        break;

      case PRIMITIVE_ACTIONS.RAISE:
        if (scenario === SCENARIOS.FACED_RAISE) {
          record(PARENT_ACTIONS.THREE_BET, classifyRaiseFacingRaise(prior, s, false));
        } else {
          record(PARENT_ACTIONS.OPEN, classifyUnraisedRaise(prior, s));
        }
        break;

      default:
        // CHECK (and anything unexpected) is not a classifiable range action.
        // BB checking an unraised pot is a forced option, not a voluntary
        // decision — rangeEngine/CLAUDE.md §5. This reproduces the
        // pre-taxonomy extractor's null exactly.
        break;
    }
  }

  return decisions;
};
