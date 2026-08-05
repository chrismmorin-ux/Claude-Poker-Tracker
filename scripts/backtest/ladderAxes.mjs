/**
 * ladderAxes.mjs — WS-320. Per-player (k, n) tallies for the STUDY LADDER rungs.
 *
 * THE QUESTION. POKER_THEORY §15.3 records a founder hypothesis: the pool is strung out along
 * a study ladder — never deviating from a preflop range, then no open-limping, then 3-betting,
 * then c-betting as a range, then board-selective c-betting — rather than clustered near
 * equilibrium. §11.8 refused to build a per-villain trap channel because `P(check | strong)`
 * did not separate (χ²/df = 1.005 against a control at 1.859), but named the reason as WEAK
 * POWER: median TWO strong-hand spots per player. The rungs above are HIGH-FREQUENCY
 * observables, so they should carry the power the slowplay axis lacked.
 *
 * THIS FILE ONLY TALLIES. The instrument that decides separability lives in `separability.mjs`;
 * keeping them apart is what lets the same overdispersion code run on these axes and on the
 * §11.8 control without either being able to special-case the other.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * AXIS DEFINITIONS, AND THE CONDITIONING SET FOR EACH.
 *
 * Every rate here is a CONDITIONAL, and the repo rule (memory: numbers carry their
 * conditional) is that the conditioning set travels with the number. It is therefore stored
 * on the axis descriptor rather than left in a comment, so a report cannot print a rate
 * without being able to print what it is conditioned on.
 *
 *   limpRate      P(call | preflop · no raise yet · actor is not the BB)
 *                 The BB is excluded because with no raise outstanding the BB owes nothing,
 *                 so its "call" is emitted as a CHECK and it can never limp. Leaving the BB
 *                 in the denominator would deflate every player in proportion to how often
 *                 they sat there — a position artifact masquerading as a habit.
 *                 SB completing IS a limp and is counted: it is the same passive entry.
 *
 *   threeBetRate  P(raise | preflop · exactly one raise so far)
 *                 Includes cold 3-bets, squeezes and blind 3-bets. This is decision-context
 *                 descriptive and tagged from SEQUENCE STATE, never from first-action-only
 *                 (memory: derived line tags). A player who opened cannot appear in this
 *                 denominator, because facing their own raise is not a state that occurs.
 *
 *   cbetRate      P(bet flop | actor was the last preflop raiser · saw the flop ·
 *                             no bet made on the flop before them)
 *                 The "checked to the c-bettor" condition matters: being donked into is a
 *                 different decision and folding it into the same rate would mix two
 *                 populations of spot.
 *
 *   flopBetFreq   P(bet flop | flop decision · nothing owed)          ← §11.8's CONTROL
 *                 The axis that separated decisively last time (χ²/df = 1.859, z = +15.5,
 *                 between-player SD ≈ 9pp). Reproduced here IN THE SAME RUN so the comparison
 *                 is against a number this instrument produced, not a remembered one.
 *
 *   flopBetFreqNonPfa   flopBetFreq restricted to actors who were NOT the preflop raiser.
 *                 WHY THIS EXISTS AND IS NOT DECORATION. `cbetRate` is a strict SUBSET of
 *                 `flopBetFreq`: every c-bet opportunity is also a flop decision with nothing
 *                 owed. So a correlation between the two is guaranteed by construction and
 *                 says nothing about whether c-betting is a separate trait. The task this
 *                 instrument answers is precisely "does this axis add anything to one I
 *                 already have", and a control that overlaps the candidate cannot answer it.
 *                 This variant is DISJOINT from `cbetRate` by construction, so their
 *                 correlation is informative.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * PLAYER IDENTITY IS SITE-SCOPED. HandHQ pseudonyms are stable within a site and carry no
 * guarantee across sites, so the unit is a player-SITE row (`FTP:abc123`), matching §11.8's
 * "700 player-site rows". Merging two sites on a colliding pseudonym would invent a player
 * whose rate is a blend of two people — the exact artifact an overdispersion test would then
 * read as heterogeneity.
 */

import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';

/** Seats the adapter's right-aligned embedding always assigns to the blinds. */
export const SB_SEAT = 1;
export const BB_SEAT = 2;

const EPSILON = 1e-9;

/**
 * The axes, with their conditioning set and their studied direction.
 *
 * `studiedDirection` is what the ladder hypothesis says a player MOVES TOWARD as they study.
 * It is needed for the ordering test and is stated here rather than at the call site, because
 * getting the sign wrong would turn "acquired the rung" into "has not acquired it" and the
 * co-occurrence matrix would still look perfectly plausible.
 */
export const AXES = Object.freeze({
  limpRate: {
    id: 'limpRate',
    label: 'limp rate',
    role: 'candidate',
    rung: 1,
    conditioning: 'preflop decision · no raise yet · actor is not the BB',
    numerator: 'actor calls (open-limp, over-limp, or SB complete)',
    studiedDirection: 'lower',
  },
  threeBetRate: {
    id: 'threeBetRate',
    label: '3-bet rate',
    role: 'candidate',
    rung: 2,
    conditioning: 'preflop decision · exactly one raise so far',
    numerator: 'actor raises',
    studiedDirection: 'higher',
  },
  cbetRate: {
    id: 'cbetRate',
    label: 'c-bet rate',
    role: 'candidate',
    rung: 3,
    conditioning: 'flop · actor was last preflop raiser · no flop bet before them',
    numerator: 'actor bets',
    studiedDirection: 'higher',
  },
  flopBetFreq: {
    id: 'flopBetFreq',
    label: 'flop bet frequency (§11.8 control)',
    role: 'control',
    rung: null,
    conditioning: 'flop decision · nothing owed',
    numerator: 'actor bets',
    studiedDirection: 'higher',
  },
  flopBetFreqNonPfa: {
    id: 'flopBetFreqNonPfa',
    label: 'flop bet frequency, non-aggressor (disjoint control)',
    role: 'control',
    rung: null,
    conditioning: 'flop decision · nothing owed · actor was NOT the preflop raiser',
    numerator: 'actor bets',
    studiedDirection: 'higher',
  },
});

export const AXIS_IDS = Object.freeze(Object.keys(AXES));

/** Candidate rungs in the founder's stated order. The ordering test needs the sequence. */
export const LADDER_RUNGS = Object.freeze(['limpRate', 'threeBetRate', 'cbetRate']);

/** The control the separability verdict is read against. */
export const CONTROL_AXIS = 'flopBetFreq';

/**
 * Extract every axis observation from one converted hand.
 *
 * Returns a flat list of `{ playerKey, axis, hit }` rather than mutating a tally, so the
 * function stays pure and testable and the caller decides what to accumulate. ORDER IS
 * PRESERVED — the temporal split-half reliability in `separability.mjs` depends on
 * observations arriving in the order they were played.
 *
 * @param {Object} hand - an app-shaped hand from `phhAdapter.toAppHand`
 * @returns {Array<{playerKey: string, axis: string, hit: boolean}>}
 */
export const observationsFromHand = (hand) => {
  const out = [];
  const gs = hand?.gameState;
  const seq = gs?.actionSequence;
  if (!Array.isArray(seq) || seq.length === 0) return out;

  const site = hand?._backtest?.site ?? 'UNK';
  const keyOf = (seat) => {
    const pseudo = hand?.seatPlayers?.[seat];
    return pseudo ? `${site}:${pseudo}` : null;
  };

  const sb = gs?.blinds?.sb ?? 0;
  const bb = gs?.blinds?.bb ?? 0;
  if (!(bb > 0)) return out;

  // ── Pass 1: preflop. Also identifies the last preflop raiser, which pass 2 needs. ──
  let currentBet = bb;
  const committed = { [SB_SEAT]: sb, [BB_SEAT]: bb };
  let raiseCount = 0;
  let lastPreflopRaiser = null;

  for (const a of seq) {
    if (a.street !== 'preflop') break;
    const seat = a.seat;
    const key = keyOf(seat);

    // Decision context is read BEFORE the action is applied — that is the state the actor
    // faced. Reading it after would score the player against a board they created.
    if (key) {
      if (raiseCount === 0 && seat !== BB_SEAT) {
        out.push({ playerKey: key, axis: 'limpRate', hit: a.action === PRIMITIVE_ACTIONS.CALL });
      }
      if (raiseCount === 1) {
        out.push({ playerKey: key, axis: 'threeBetRate', hit: a.action === PRIMITIVE_ACTIONS.RAISE });
      }
    }

    if (a.action === PRIMITIVE_ACTIONS.RAISE || a.action === PRIMITIVE_ACTIONS.BET) {
      raiseCount += 1;
      lastPreflopRaiser = seat;
      currentBet = a.amount ?? currentBet;
      committed[seat] = currentBet;
    } else if (a.action === PRIMITIVE_ACTIONS.CALL) {
      committed[seat] = currentBet;
    }
  }

  // ── Pass 2: flop. ──
  const flopActions = seq.filter((a) => a.street === 'flop');
  if (flopActions.length === 0) return out;

  let flopBet = 0;
  const flopCommitted = {};
  // Only the FIRST flop decision of a player counts toward the c-bet axis: the c-bet is a
  // single opportunity, and letting a check-raise-back-around produce a second observation
  // would weight one hand twice on one player's rate.
  let cbetSpotTaken = false;

  for (const a of flopActions) {
    const seat = a.seat;
    const key = keyOf(seat);
    const owed = flopBet - (flopCommitted[seat] ?? 0);

    if (key && owed <= EPSILON && a.action !== PRIMITIVE_ACTIONS.FOLD) {
      const isBet = a.action === PRIMITIVE_ACTIONS.BET;
      const isPfa = lastPreflopRaiser !== null && seat === lastPreflopRaiser;

      out.push({ playerKey: key, axis: 'flopBetFreq', hit: isBet });
      if (!isPfa) {
        out.push({ playerKey: key, axis: 'flopBetFreqNonPfa', hit: isBet });
      }
      if (isPfa && !cbetSpotTaken && flopBet <= EPSILON) {
        cbetSpotTaken = true;
        out.push({ playerKey: key, axis: 'cbetRate', hit: isBet });
      }
    }

    if (a.action === PRIMITIVE_ACTIONS.BET || a.action === PRIMITIVE_ACTIONS.RAISE) {
      flopBet = a.amount ?? flopBet;
      flopCommitted[seat] = flopBet;
    } else if (a.action === PRIMITIVE_ACTIONS.CALL) {
      flopCommitted[seat] = flopBet;
    }
  }

  return out;
};

/**
 * Accumulator over a stream of hands.
 *
 * Per player per axis it keeps an ORDERED bit sequence rather than a running (k, n). The
 * sequence is what makes the temporal split-half reliability possible, and that check is the
 * one that distinguishes "players genuinely differ" from "the same player differs from
 * himself" — which an overdispersion statistic alone cannot tell apart.
 */
export class LadderTally {
  constructor() {
    /** @type {Map<string, Map<string, boolean[]>>} playerKey -> axis -> ordered hits */
    this.players = new Map();
    this.handsSeen = 0;
  }

  addHand(hand) {
    this.handsSeen += 1;
    for (const obs of observationsFromHand(hand)) {
      let byAxis = this.players.get(obs.playerKey);
      if (!byAxis) {
        byAxis = new Map();
        this.players.set(obs.playerKey, byAxis);
      }
      let bits = byAxis.get(obs.axis);
      if (!bits) {
        bits = [];
        byAxis.set(obs.axis, bits);
      }
      bits.push(obs.hit);
    }
    return this;
  }

  /**
   * Flatten to `{ axisId: [{ playerKey, k, n, bits }] }`.
   *
   * `bits` travels with the row because the split-half check needs it and re-deriving it
   * later would mean streaming the corpus twice.
   */
  rows() {
    const byAxis = Object.fromEntries(AXIS_IDS.map((id) => [id, []]));
    for (const [playerKey, axes] of this.players) {
      for (const [axis, bits] of axes) {
        if (!byAxis[axis]) continue;
        byAxis[axis].push({
          playerKey,
          k: bits.reduce((s, b) => s + (b ? 1 : 0), 0),
          n: bits.length,
          bits,
        });
      }
    }
    // Sorted so a run is byte-reproducible: Map iteration order follows insertion, which
    // follows file discovery order, which is a filesystem detail.
    for (const id of AXIS_IDS) byAxis[id].sort((a, b) => (a.playerKey < b.playerKey ? -1 : 1));
    return byAxis;
  }
}
