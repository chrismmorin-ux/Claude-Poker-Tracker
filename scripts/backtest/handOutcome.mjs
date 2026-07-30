/**
 * handOutcome.mjs — realized chip outcome per seat, reconstructed from a corpus hand.
 *
 * WHY THIS EXISTS (WS-287). The hero-EV instrument scores the engine's advice against
 * REAL MONEY, not against the engine's own EV arithmetic. The engine picks the
 * argmax-EV action under its own villain model, so grading it with that same arithmetic
 * is very nearly circular — it would mark its own homework. The only external anchor
 * available is what the chips actually did.
 *
 * The PHH corpus does not record pot awards, winners, or rake. It records the action
 * sequence, the board, and whatever cards were shown. That is enough: the award is
 * DERIVABLE, and deriving it is what this module does.
 *
 * WHAT IS AND IS NOT KNOWABLE. Hole cards are masked pre-showdown (`d dh p1 ????`),
 * so hand strength is known only for seats that showed. That does NOT restrict this
 * module the way it restricts hero-card lookup, because:
 *   - a hand that folds out needs no cards at all — the last live seat takes it;
 *   - a hand that reaches showdown has the contenders' cards by definition.
 * So realized outcomes are available for essentially every hand, folded and shown
 * alike, and the showdown-selection bias that blocks a cards-first design does not
 * arise here. A seat's realized result for a hand it folded is simply minus what it
 * had already put in.
 *
 * SIDE POTS ARE COMPUTED, NOT SKIPPED. Dropping all-in hands would be the worst
 * possible filter for an EV instrument: all-in hands are exactly the large-outcome
 * hands, and discarding them would shave the tail that carries most of the variance
 * and much of the signal. The standard layered algorithm below handles side pots,
 * uncalled-bet returns, and short all-ins uniformly.
 *
 * NEVER GUESS. Any hand whose award cannot be derived with certainty returns
 * `{ resolved: false, reason }` and is counted by the caller, never estimated.
 */

import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';
import { parseAndEncode } from '../../src/utils/pokerCore/cardParser.js';
import { bestFiveFromSeven } from '../../src/utils/pokerCore/handEvaluator.js';
import { estimateRake } from '../../src/utils/potCalculator.js';

/** Why an outcome could not be derived. Counted and reported, never silently dropped. */
export const OUTCOME_SKIP_REASONS = {
  MISSING_COMMITMENTS: 'missing-commitments',
  NO_LIVE_SEATS: 'no-live-seats',
  SHOWDOWN_CARDS_MISSING: 'showdown-cards-missing',
  INCOMPLETE_BOARD: 'incomplete-board',
  UNPARSEABLE_CARDS: 'unparseable-cards',
  DEAD_LAYER: 'dead-layer',
  ALL_MUCKED_LAYER: 'all-mucked-layer',
  NON_ZERO_SUM: 'non-zero-sum',
};

const EPSILON = 1e-6;
const round2 = (x) => Number(x.toFixed(2));

/**
 * Seats that never folded — the ones eligible to be awarded chips.
 * A seat that was dealt in and never acted (all-in from a blind post) never folded
 * and is therefore live, which is correct.
 */
const liveSeatsOf = (actionSequence, allSeats) => {
  const folded = new Set();
  for (const entry of actionSequence) {
    if (entry.action === PRIMITIVE_ACTIONS.FOLD) folded.add(String(entry.seat));
  }
  return allSeats.filter((s) => !folded.has(String(s)));
};

/**
 * Layered pot distribution — the standard side-pot algorithm.
 *
 * Contributions from EVERY seat (folded included) form the layers; only live seats are
 * eligible to win one. Three behaviours fall out of this for free rather than needing
 * special cases:
 *   - side pots, when a short stack is all-in for less than the others;
 *   - uncalled-bet returns, because the top layer has exactly one eligible seat — the
 *     bettor — who therefore wins their own excess back;
 *   - dead money from folded seats, which lands in the layers they reached.
 *
 * @returns {{ awards: Object<string, number> }|{ dead: true, level: number }}
 */
const distributeLayers = (committedBySeat, liveSeats, scoreBySeat) => {
  const seats = Object.keys(committedBySeat);
  const levels = [...new Set(seats
    .map((s) => committedBySeat[s])
    .filter((c) => c > EPSILON))].sort((a, b) => a - b);

  const awards = {};
  for (const s of seats) awards[s] = 0;

  let prev = 0;
  for (const level of levels) {
    let layerPot = 0;
    for (const s of seats) {
      const c = committedBySeat[s];
      layerPot += Math.min(c, level) - Math.min(c, prev);
    }
    prev = level;
    if (layerPot <= EPSILON) continue;

    const eligible = liveSeats.filter((s) => committedBySeat[s] >= level - EPSILON);
    if (eligible.length === 0) {
      // A folded seat contributed more than every live seat. Well-formed play cannot
      // produce this (the last aggressor is live by construction), so it signals a
      // parse or data problem. Refuse the hand rather than invent a recipient.
      return { dead: true, level };
    }

    let best = -Infinity;
    for (const s of eligible) best = Math.max(best, scoreBySeat[s]);
    // Every seat eligible for this layer mucked, so no winner is derivable for it.
    // Refuse the hand rather than award chips to a hand nobody saw.
    if (best < 0) return { allMucked: true, level };
    const winners = eligible.filter((s) => scoreBySeat[s] === best);
    const share = layerPot / winners.length;
    for (const s of winners) awards[s] += share;
  }

  return { awards };
};

/**
 * Reconstruct every seat's realized net result for one corpus hand.
 *
 * @param {Object} hand - app-shaped hand from `phhAdapter.iterAppHands`
 * @param {Object} [opts]
 * @param {Object|null} [opts.rakeConfig] - { pct, cap, noFlopNoDrop }. MUST be passed
 *   explicitly to be applied. The corpus stores no rake, so any rake here is MODELLED
 *   from the stake and must be reported as modelled (POKER_THEORY 11.3).
 * @returns {{resolved: true, netBySeat, potBB, rakeBB, winners, wentToShowdown, contested}
 *          |{resolved: false, reason: string}}
 */
export const resolveHandOutcome = (hand, { rakeConfig = null } = {}) => {
  const bt = hand?._backtest;
  const gs = hand?.gameState;
  const committedRaw = bt?.committedBySeat;
  if (!committedRaw || !gs || !Array.isArray(gs.actionSequence)) {
    return { resolved: false, reason: OUTCOME_SKIP_REASONS.MISSING_COMMITMENTS };
  }
  const bb = Number(bt.bb);
  if (!Number.isFinite(bb) || bb <= 0) {
    return { resolved: false, reason: OUTCOME_SKIP_REASONS.MISSING_COMMITMENTS };
  }

  const committedBySeat = {};
  for (const [seat, amt] of Object.entries(committedRaw)) {
    const v = Number(amt);
    if (!Number.isFinite(v) || v < 0) {
      return { resolved: false, reason: OUTCOME_SKIP_REASONS.MISSING_COMMITMENTS };
    }
    committedBySeat[seat] = v;
  }

  const allSeats = Object.keys(committedBySeat);
  const liveSeats = liveSeatsOf(gs.actionSequence, allSeats);
  if (liveSeats.length === 0) {
    return { resolved: false, reason: OUTCOME_SKIP_REASONS.NO_LIVE_SEATS };
  }

  const potTotal = allSeats.reduce((s, k) => s + committedBySeat[k], 0);
  const wentToShowdown = liveSeats.length > 1;

  // ---- hand strengths, only where a contest actually needs them ----
  const scoreBySeat = {};
  if (!wentToShowdown) {
    // Uncontested. The single live seat takes every layer it is eligible for; no
    // cards are involved, which is why folded hands are fully scorable.
    scoreBySeat[liveSeats[0]] = 1;
  } else {
    const board = Array.isArray(gs.communityCards) ? gs.communityCards : [];
    if (board.length < 5) {
      return { resolved: false, reason: OUTCOME_SKIP_REASONS.INCOMPLETE_BOARD };
    }
    const encodedBoard = board.slice(0, 5).map(parseAndEncode);
    if (encodedBoard.some((c) => c < 0)) {
      return { resolved: false, reason: OUTCOME_SKIP_REASONS.UNPARSEABLE_CARDS };
    }

    // A seat that reaches showdown and does NOT show has mucked, and a mucked hand
    // cannot be awarded a pot. That is a rule of the game, not an inference, so these
    // seats score below every real hand rather than making the pot unresolvable —
    // which is what recovers the ~40% of showdowns where only the winner's cards were
    // recorded. `bestFiveFromSeven` returns > 0 for any real holding, so MUCKED is a
    // safe floor.
    const MUCKED = -1;
    const shown = gs.showdownCards || {};
    let anyShown = false;
    for (const seat of liveSeats) {
      const hole = shown[seat];
      if (!Array.isArray(hole) || hole.length !== 2) {
        scoreBySeat[seat] = MUCKED;
        continue;
      }
      const encodedHole = hole.map(parseAndEncode);
      if (encodedHole.some((c) => c < 0)) {
        return { resolved: false, reason: OUTCOME_SKIP_REASONS.UNPARSEABLE_CARDS };
      }
      scoreBySeat[seat] = bestFiveFromSeven([...encodedHole, ...encodedBoard]);
      anyShown = true;
    }
    // Nobody showed: someone must expose a hand to claim a contested pot, so this is
    // a data problem rather than a game state. Refuse it.
    if (!anyShown) {
      return { resolved: false, reason: OUTCOME_SKIP_REASONS.SHOWDOWN_CARDS_MISSING };
    }
    // A layer whose eligible seats ALL mucked has no derivable winner; that case is
    // caught per-layer inside `distributeLayers`.
  }

  const distributed = distributeLayers(committedBySeat, liveSeats, scoreBySeat);
  if (distributed.dead) {
    return { resolved: false, reason: OUTCOME_SKIP_REASONS.DEAD_LAYER };
  }
  if (distributed.allMucked) {
    return { resolved: false, reason: OUTCOME_SKIP_REASONS.ALL_MUCKED_LAYER };
  }

  // ---- rake ----
  // Taken off the pot before award, scaled proportionally across layers. Rake applies
  // to contested pots only in the sense that `estimateRake` returns 0 preflop under
  // `noFlopNoDrop`; it is not conditioned on showdown here because a pot won by a
  // river fold has still been raked.
  const street = gs.currentStreet || 'preflop';
  const rake = estimateRake(potTotal, rakeConfig, street);
  const keepFraction = potTotal > EPSILON ? (potTotal - rake) / potTotal : 1;

  const netBySeat = {};
  const winners = [];
  for (const seat of allSeats) {
    const award = distributed.awards[seat] * keepFraction;
    if (award > EPSILON) winners.push(seat);
    netBySeat[seat] = round2((award - committedBySeat[seat]) / bb);
  }

  // Zero-sum check: every chip is accounted for, and the only leak is the rake.
  // A violation means the layering is wrong, so refuse rather than emit a number
  // that silently fails to balance.
  const netSum = Object.values(netBySeat).reduce((s, v) => s + v, 0);
  if (Math.abs(netSum + rake / bb) > 0.02) {
    return { resolved: false, reason: OUTCOME_SKIP_REASONS.NON_ZERO_SUM };
  }

  return {
    resolved: true,
    netBySeat,
    potBB: round2(potTotal / bb),
    rakeBB: round2(rake / bb),
    winners,
    wentToShowdown,
    contested: liveSeats.length,
  };
};
