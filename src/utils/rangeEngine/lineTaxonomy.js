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
 * Two independent decision trees, each with a RETAINED PARENT and subclasses:
 *
 *   No raise faced   fold | limp | open       → openFirstIn | isoRaise
 *   Facing a raise   fold | coldCall | threeBet → cold3Bet | squeeze | limpReraise
 *
 * Parents keep their pre-taxonomy meaning exactly, so every existing consumer
 * of `open` / `threeBet` is unaffected. Subclasses are strictly additive.
 *
 * NOT MODELLED HERE: facing a 3-bet (the 4-bet tree) is a THIRD scenario that
 * does not exist yet — see POKER_THEORY §2.5.5 and WS-270. A seat that raises
 * over two or more prior raises is still counted in the `threeBet` PARENT
 * (preserving today's numbers) but carries `subAction: null`, because no
 * subclass legitimately describes it. That residual is exactly the slice
 * WS-270 will claim.
 */

import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';

/** Retained parent aggregates — pre-taxonomy semantics, unchanged. */
export const PARENT_ACTIONS = {
  FOLD: 'fold',
  LIMP: 'limp',
  OPEN: 'open',
  COLD_CALL: 'coldCall',
  THREE_BET: 'threeBet',
};

/** Derived subclasses. Each sums into exactly one parent. */
export const SUBCLASS_ACTIONS = {
  OPEN_FIRST_IN: 'openFirstIn',
  ISO_RAISE: 'isoRaise',
  COLD_3BET: 'cold3Bet',
  SQUEEZE: 'squeeze',
  LIMP_RERAISE: 'limpReraise',
};

/** subclass → parent. The sum invariant is asserted against this map. */
export const SUBCLASS_PARENT = {
  [SUBCLASS_ACTIONS.OPEN_FIRST_IN]: PARENT_ACTIONS.OPEN,
  [SUBCLASS_ACTIONS.ISO_RAISE]: PARENT_ACTIONS.OPEN,
  [SUBCLASS_ACTIONS.COLD_3BET]: PARENT_ACTIONS.THREE_BET,
  [SUBCLASS_ACTIONS.SQUEEZE]: PARENT_ACTIONS.THREE_BET,
  [SUBCLASS_ACTIONS.LIMP_RERAISE]: PARENT_ACTIONS.THREE_BET,
};

/** parent → its subclasses, in doctrine order (POKER_THEORY §2.5.2). */
export const PARENT_SUBCLASSES = {
  [PARENT_ACTIONS.OPEN]: [SUBCLASS_ACTIONS.OPEN_FIRST_IN, SUBCLASS_ACTIONS.ISO_RAISE],
  [PARENT_ACTIONS.THREE_BET]: [
    SUBCLASS_ACTIONS.COLD_3BET,
    SUBCLASS_ACTIONS.SQUEEZE,
    SUBCLASS_ACTIONS.LIMP_RERAISE,
  ],
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
 * Classify a raise made FACING a raise.
 *
 * Returns null (parent-only) when the seat is facing two or more prior raises —
 * that is the unmodelled 4-bet tree (WS-270), not a 3-bet subclass.
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

  // Facing a 3-bet or beyond — parent-only until WS-270 lands.
  if (raises.length !== 1) return null;

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
 * Derive every preflop decision point a seat faced in one hand.
 *
 * ONE HAND CAN YIELD SEVERAL DECISION POINTS (POKER_THEORY §2.5.4). A seat that
 * limps and later re-raises made two decisions in two different game states,
 * and BOTH are emitted: `limp` (no-raise tree) and `limpReraise` (facing-raise
 * tree). The limp emission is load-bearing — dropping it would strip trapped
 * hands out of the limp range and manufacture the "limp range is capped"
 * exploit that §5.8 and the trait detector exist to suppress.
 *
 * Limp-call and limp-fold are NOT emitted here: there is prior investment, so
 * they are not cold calls, and they are already modelled by the sub-action
 * tree (subActionExtractor.js).
 *
 * @param {Array} preflopActions - preflop timeline entries {order, seat, action}
 * @param {string|number} seat
 * @returns {Array<{parentAction: string, subAction: string|null, facedRaise: boolean}>}
 */
export const derivePreflopDecisions = (preflopActions, seat) => {
  if (!Array.isArray(preflopActions) || preflopActions.length === 0) return [];

  const s = String(seat);
  const ordered = [...preflopActions].sort((a, b) => a.order - b.order);
  const seatActions = voluntaryActionsForSeat(ordered, s);
  if (seatActions.length === 0) return [];

  const decisions = [];

  const priorTo = (order) => ordered.filter(e => e.order < order);
  const facedRaiseAt = (order) =>
    ordered.some(
      e => e.order < order && e.seat !== s && e.action === PRIMITIVE_ACTIONS.RAISE
    );

  // --- Decision 1: the seat's first voluntary action ---
  const first = seatActions[0];
  const firstFacedRaise = facedRaiseAt(first.order);
  const firstPrior = priorTo(first.order);
  let seatLimped = false;

  switch (first.action) {
    case PRIMITIVE_ACTIONS.FOLD:
      decisions.push({
        parentAction: PARENT_ACTIONS.FOLD,
        subAction: null,
        facedRaise: firstFacedRaise,
      });
      break;

    case PRIMITIVE_ACTIONS.CALL:
      if (firstFacedRaise) {
        decisions.push({
          parentAction: PARENT_ACTIONS.COLD_CALL,
          subAction: null,
          facedRaise: true,
        });
      } else {
        seatLimped = true;
        decisions.push({
          parentAction: PARENT_ACTIONS.LIMP,
          subAction: null,
          facedRaise: false,
        });
      }
      break;

    case PRIMITIVE_ACTIONS.RAISE:
      if (firstFacedRaise) {
        decisions.push({
          parentAction: PARENT_ACTIONS.THREE_BET,
          subAction: classifyRaiseFacingRaise(firstPrior, s, false),
          facedRaise: true,
        });
      } else {
        decisions.push({
          parentAction: PARENT_ACTIONS.OPEN,
          subAction: classifyUnraisedRaise(firstPrior, s),
          facedRaise: false,
        });
      }
      break;

    default:
      // CHECK (and anything unexpected) is not a classifiable range action.
      // BB checking an unraised pot is a forced option, not a voluntary
      // decision — rangeEngine/CLAUDE.md §5. This reproduces the
      // pre-taxonomy extractor's null exactly.
      break;
  }

  // --- Decision 2: the limp-reraise, a genuinely separate decision ---
  if (seatLimped) {
    const reraise = seatActions
      .slice(1)
      .find(e => e.action === PRIMITIVE_ACTIONS.RAISE);

    if (reraise) {
      decisions.push({
        parentAction: PARENT_ACTIONS.THREE_BET,
        subAction: classifyRaiseFacingRaise(priorTo(reraise.order), s, true),
        facedRaise: true,
      });
    }
  }

  return decisions;
};
