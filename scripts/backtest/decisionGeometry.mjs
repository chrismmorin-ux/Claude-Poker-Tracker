/**
 * decisionGeometry.mjs — pot, faced bet, and live-opponent count at a decision node.
 *
 * Small on purpose, and shared on purpose (WS-287). Three consumers need this geometry:
 * the behaviour-policy miner (to key propensities by bet sizing), the hero policy (to
 * feed the engine), and the scoring pass (to slice results). Deriving it three times
 * would be three chances to disagree about what "the pot" means at a node — and the pot
 * convention is one of the details that silently corrupts every downstream number if it
 * drifts.
 *
 * This module deliberately imports no engine code, so the miner can use it without
 * paying for the game tree.
 *
 * WS-333 adds the three coordinates a GEOMETRY key needs beyond the pot: SPR band, whether
 * the action CLOSES, and the key formatter itself. The argument for putting them here is the
 * one above, unchanged — `runner.mjs` had grown its own `potAndBetBB` and a second copy of
 * `sizeBucketFor`, which was the third notion of "the pot" in `scripts/`. Those are now
 * deleted in favour of this module rather than a fourth being added.
 */

import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';
import { getSPRZone } from '../../src/utils/pokerCore/sprBands.js';

/**
 * The live bet this seat is answering, as a TOTAL street commitment in chips.
 *
 * "Total street commitment" is the corpus's own convention for BET/RAISE amounts
 * (`raise to`, not the increment), and it matches the app's `villainBet`.
 */
export const facedBetChips = (hand, order, street) => {
  let faced = null;
  for (const e of hand.gameState.actionSequence) {
    if (e.order >= order) break;
    if (e.street !== street) continue;
    if (e.action === PRIMITIVE_ACTIONS.BET || e.action === PRIMITIVE_ACTIONS.RAISE) {
      faced = e.amount;
    }
  }
  return Number.isFinite(faced) ? faced : 0;
};

/**
 * Pot geometry at a decision, in big blinds.
 *
 * `potBB` INCLUDES the bet hero is facing — that is how the corpus pot accumulates.
 * The engine wants it excluded (it re-adds `villainBet` internally), which is what
 * `enginePotChips` below is for. Keeping both explicit, with the difference named, is
 * the whole point of putting this in one place.
 */
export const decisionGeometry = (hand, order, street) => {
  const bt = hand._backtest;
  const bb = Number(bt?.bb);
  const potChips = bt?.potBeforeByOrder?.[order];
  if (!Number.isFinite(bb) || bb <= 0 || !Number.isFinite(potChips)) return null;

  const betChips = facedBetChips(hand, order, street);
  return {
    bb,
    potChips,
    betChips,
    potBB: potChips / bb,
    facingBetBB: betChips / bb,
    // Pot EXCLUDING the live bet — the value `evaluateGameTree` expects as `potSize`.
    enginePotChips: Math.max(0, potChips - betChips),
    stackChips: bt?.stackBeforeByOrder?.[order] ?? null,
  };
};

/**
 * Bet size as a fraction of the pot, on the WS-262 mining boundaries.
 *
 * Duplicated deliberately from `runner.sizeBucketFor` rather than imported: importing
 * would pull the whole villain-prediction runner (and the engine behind it) into the
 * miner. The boundaries are asserted identical by test.
 */
export const sizeBucketFor = (betBB, potBB) => {
  if (!Number.isFinite(betBB) || !Number.isFinite(potBB) || potBB <= 0) return 'unknown';
  const frac = betBB / potBB;
  if (frac < 0.33) return '0-33';
  if (frac < 0.66) return '33-66';
  if (frac < 1.0) return '66-100';
  if (frac < 1.5) return '100-150';
  return '150+';
};

/**
 * Opponents still live and not hero at this point in the hand.
 *
 * Opponent count drives the multiway terms of the decision spine — fold-through
 * compounds (POKER_THEORY 6.1) and the value threshold rises as 0.5^(1/k) (6.4) — so
 * defaulting this to 1 would score a heads-up engine on multiway pots, which is the
 * exact defect WS-277 exists for.
 */
export const liveOpponentCount = (hand, order, heroSeat) => {
  const folded = new Set();
  for (const e of hand.gameState.actionSequence) {
    if (e.order >= order) break;
    if (e.action === PRIMITIVE_ACTIONS.FOLD) folded.add(String(e.seat));
  }
  let n = 0;
  for (const seat of Object.keys(hand.seatPlayers)) {
    if (String(seat) === String(heroSeat)) continue;
    if (!folded.has(String(seat))) n++;
  }
  return n;
};

/**
 * Stack-to-pot ratio at a decision, and its band.
 *
 * Uses `potChips` — the pot INCLUDING the live bet — because that is what
 * `runner.sprZoneFor` has always used (`stackBeforeByOrder / potBeforeByOrder`), and every
 * `sprZone`-sliced figure the repo has published was computed that way.
 *
 * The other convention is arguable: excluding the bet would make SPR a property of the pot
 * being contested rather than of the pot after the decision resolves. But changing it here
 * would silently re-partition every historical `sprZone` slice while looking like a
 * refactor, and shipping BOTH would be the second definition this module exists to prevent.
 * One notion, matching what already shipped. If the convention is wrong that is a finding
 * with a measurement attached, not a quiet edit inside a geometry change.
 */
export const sprFor = (geo) => {
  if (!geo) return null;
  const { stackChips, potChips } = geo;
  if (!Number.isFinite(stackChips) || !Number.isFinite(potChips) || potChips <= 0) return null;
  return stackChips / potChips;
};

/**
 * SPR band. Boundaries 2 / 4 / 8 / 13, imported from `pokerCore/sprBands` rather than
 * duplicated — see that module's header for why it exists.
 */
export const sprBandFor = (spr) => getSPRZone(spr) ?? 'unknown';

/**
 * ─────────────────────────────────────────────────────────────────────────────────────
 * DOES MATCHING THE CURRENT BET CLOSE THE ACTION?
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * This is the coordinate WS-333 exists for, and the one the repo did not have.
 *
 * WHY IT MATTERS. Against a 2.5x BTN open at 100bb, SB needs ~33% equity and BB ~27% — six
 * points apart. Pot odds alone therefore predict SB defends nearly as wide as BB. Observed
 * and solver behaviour is the opposite: SB collapses toward 3bet-or-fold. Price is not the
 * driver. SB carries three penalties and only one is visible in the odds — worse price, out
 * of position, and **a live player still behind it**. SB can call correctly on price and
 * still be squeezed off its equity before seeing a flop. BB's call closes the action; SB's
 * does not. That asymmetry is structural, and it is invisible to every quantity the engine
 * currently computes.
 *
 * IT IS A PROPERTY OF THE NODE, NOT OF THE ACTION TAKEN. The predicate asks what *matching*
 * would do, not what the actor actually did — a raise trivially reopens the action, so
 * conditioning on the real action would collapse the coordinate to "did they raise". Asking
 * the counterfactual keeps it a geometry property, which is what lets it index a cell.
 *
 * HOW WS-312 GOT THIS WRONG, recorded so it is not repeated. An earlier attempt in
 * `teachableArmsProbe.mjs` detected closure from `ctx.opponentSeat` inside a callback that
 * "only fires when someone still has a decision to make on the same street, i.e. the street
 * has NOT closed" — so it could never observe a closing action, and classified every check
 * as check-OOP. Two arms scored bit-identically and the bug was invisible until an inertness
 * guard was added. This derivation therefore reads the street's ACTION LIST directly, the
 * same way `decisionAccumulator.isFirstToAct` does, and never a callback.
 *
 * NOT A RESTATEMENT OF `isIP`. `isIP` is already `HIERARCHY_ORDER[1]`, so if closure were a
 * function of position it would be a rename of a dimension already in the ladder and the
 * shrinkage loop's `totalN === lastAppliedN` guard would correctly swallow it. The two
 * genuinely differ preflop and multiway — SB is OOP and does not close; BB is OOP and does —
 * which is exactly the case this exists for. Asserted by an inertness test.
 *
 * @returns {boolean|null} null when the seat set is unknown
 */
export const closesAction = (hand, order, street, seat) => {
  const seats = hand?.seatPlayers ? Object.keys(hand.seatPlayers) : null;
  if (!seats || seats.length === 0) return null;

  const actor = String(seat);
  const folded = new Set();
  const hasActed = new Set();
  const committed = new Map();
  let highest = 0;

  for (const e of hand.gameState.actionSequence) {
    if (e.order >= order) break;
    const s = String(e.seat);

    // Folds carry across streets; everything else is per-street state.
    if (e.action === PRIMITIVE_ACTIONS.FOLD) { folded.add(s); continue; }
    if (e.street !== street) continue;

    if (e.action === PRIMITIVE_ACTIONS.BET || e.action === PRIMITIVE_ACTIONS.RAISE) {
      // BET/RAISE amounts are TOTAL street commitment ("raise to"), per the corpus
      // convention this module already documents for `facedBetChips`.
      highest = Number.isFinite(e.amount) ? e.amount : highest;
      committed.set(s, highest);
    } else if (e.action === PRIMITIVE_ACTIONS.CALL) {
      // CALL amounts are the INCREMENT owed, not the total — the adapter writes
      // `amount: owed` and then sets the caller's commitment to the current bet. Adding
      // the increment here would double-count the caller's earlier posts, so mirror the
      // adapter and set the total directly.
      committed.set(s, highest);
    }
    hasActed.add(s);
  }

  for (const s of seats) {
    if (s === actor || folded.has(s)) continue;
    // Pending if they have not acted on this street at all, or have acted but are no
    // longer square with the highest commitment (someone raised after them).
    //
    // Preflop this is what makes the blinds come out right without special-casing them:
    // posted blinds are not entries in the action sequence, so SB and BB read as
    // not-yet-acted and are correctly pending — which is why a BTN limp does not close
    // the action (BB still has the option).
    if (!hasActed.has(s) || (committed.get(s) ?? 0) < highest) return false;
  }
  return true;
};

/**
 * The geometry key: the coordinates under which structurally identical decisions pool.
 *
 * One formatter so no consumer builds the field set inline — the same reason this module
 * owns the pot convention. Returned as an OBJECT, not a delimited string: the repo has a
 * standing guard (`situationKey.test.js`) that fails the build on positional `split(':')`
 * reads, and a geometry key serialized as a colon string would either trip it or need an
 * opt-out marker. Named fields need neither.
 *
 * PLAYERS REMAINING IS A COORDINATE, NEVER A PRICE (WS-274). It may index a cell here; it
 * may not be multiplied by a per-opponent constant to price anything. Pricing resolves per
 * seat via `liveGameContext.buildSeatsToAct` → `preflopFoldResolver.resolveSeatFoldToRaise`.
 */
export const geometryKey = ({ sBucket, sprBand, playersRemaining, closes } = {}) => ({
  sBucket: sBucket ?? 'unknown',
  sprBand: sprBand ?? 'unknown',
  playersRemaining: Number.isFinite(playersRemaining) ? playersRemaining : null,
  closesAction: typeof closes === 'boolean' ? closes : null,
});

/**
 * Everything above, for one decision node, in one call.
 *
 * The convenience form consumers should prefer — it guarantees the four coordinates are
 * derived from the SAME geometry object, which is the failure `runner.potAndBetBB` created
 * by computing its own pot beside this one.
 */
export const decisionGeometryFull = (hand, order, street, seat) => {
  const geo = decisionGeometry(hand, order, street);
  if (!geo) return null;
  const spr = sprFor(geo);
  return {
    ...geo,
    spr,
    sprBand: sprBandFor(spr),
    sizeBucket: sizeBucketFor(geo.facingBetBB, geo.potBB),
    closesAction: closesAction(hand, order, street, seat),
    liveOpponents: liveOpponentCount(hand, order, seat),
  };
};
