/**
 * rangeInference — what his ACTION proves about his range, when his cards are never shown.
 *
 * FOUNDER, 2026-08-19: *"we need to implement something that gives us value on the final
 * behavior of a villain in a hand, regardless of showdown cards missing. For example, villain
 * folds when a flush draw actually hits and is facing a bet. HE DOES NOT HAVE THE NUT FLUSH (we
 * can explicitly enumerate the combos he does not have) ... we just nailed his behavior without
 * needing to see his cards."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * A FOLD IS EVIDENCE. That is the whole idea, and the schema had no way to hold it.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Cards are visible on 7-9% of decisions and survivor-filtered even there. But a hand that ends
 * without a showdown is not information-free: the terminal action is a statement about what he
 * did NOT hold, and unlike a showdown it is available on EVERY hand.
 *
 * (This docstring used to justify itself by "43 of the 128 behaviours came back BLIND for want of
 * an outcome". That premise was FALSE - the outcome was derivable all along and is now wired in,
 * moving the census from 60 blind to 25. The layer stands on its own merit regardless: it works
 * on every hand, where a showdown works on one in fourteen.)
 *
 * When the flush completes and he folds to a bet, he does not hold the flush. Not "probably" -
 * the combos are enumerable and they are excluded. The same logic runs in reverse on a bet: if
 * his shown hands say he bets only made hands, then a bet in a spot where his range is 82% value
 * and 18% busted draw is a near-certain value hand, and the 18% is the size of the doubt.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THREE QUANTITIES, AND THEY ARE DIFFERENT KINDS OF CLAIM.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 *   EXCLUDED    Hard. He folded, so every combo he would never fold is gone from his range at
 *               that node. Card-free, assumption-free, and it COMPOUNDS: an exclusion made on
 *               the turn still binds on the river.
 *
 *   IMPLIED     Soft, and honest about it. He bet, and his own showdowns say what a bet means
 *               for him. The strength of the inference is the strength of that prior, so the
 *               showdown count it rests on is carried with it. Below `MIN_SHOWDOWNS` it is not
 *               reported at all rather than reported weakly.
 *
 *   CONTRAST    The behavioural readout: his action rate when the draw COMPLETED against when it
 *               MISSED, on the same kind of board. This needs no range model whatever - it is
 *               two frequencies conditioned on a board event - and it is the cleanest evidence
 *               in the file precisely because nothing was assumed to get it.
 */
import { strengthAt, classify, encodeCardStr } from './handStrength.mjs';

/** Below this many shown hands, a "what his bet means" prior is not stated at all. */
export const MIN_SHOWDOWNS = 3;

const RANK_OF = (c) => Math.floor(c / 4);

/**
 * What folding here PROVES he did not hold.
 *
 * The exclusion is only as strong as the claim "he would never fold this", so it is restricted
 * to hands nobody folds facing one bet: the effective nuts on that board. Widening it to "he
 * would never fold top pair" would be a read about him, not a fact about the fold, and the
 * whole value of this measure is that it is not a read.
 */
export const foldExcludes = (d) => {
  if (d.action !== 'fold') return null;
  if (!(d.toCallBB > 0)) return null;                 // a free fold proves nothing
  if (!d.strength) return null;
  const s = d.strength;
  // The nut classes on this board that his range contained a moment ago and demonstrably did not
  // hold. `two-pair-plus` is the coarsest honest bucket: below it, folding is routine.
  const excludedShare = s.made['straight-plus'] + s.made['set-or-two-pair'];
  return {
    excludedShare: +excludedShare.toFixed(4),
    basis: s.basis,
    // Fraction of his range that survives the fold - what he is now KNOWN to be drawn from, had
    // the hand continued. Compounds down the street sequence.
    survivingShare: +(1 - excludedShare).toFixed(4),
  };
};

/**
 * What his own shown hands say a BET means for him.
 *
 * This is the only place the instrument uses showdowns as a prior rather than as an anecdote,
 * and it carries its own n so a reader can discount it. It is deliberately computed per ACTION,
 * not per spot: "when he bets, what does he turn over" is answerable at a sample size where
 * "when he bets THIS board, what does he turn over" is not.
 */
export const showdownPrior = (decisions) => {
  const byAction = new Map();
  for (const d of decisions) {
    if (!d.handKnown || !d.holeCards || !Array.isArray(d.boardCards) || d.boardCards.length < 3) continue;
    const board = d.boardCards.map(encodeCardStr);
    const hole = d.holeCards.map(encodeCardStr);
    if (board.some((c) => c < 0) || hole.some((c) => c < 0)) continue;
    const k = classify(hole[0], hole[1], board, board.map(RANK_OF).sort((a, b) => b - a));
    const act = d.action;
    if (!byAction.has(act)) byAction.set(act, { n: 0, value: 0, draw: 0, air: 0 });
    const a = byAction.get(act);
    a.n++;
    if (['straight-plus', 'set-or-two-pair', 'overpair', 'top-pair'].includes(k.made)) a.value++;
    else if (k.draw !== 'none') a.draw++;
    else a.air++;
  }
  const out = {};
  for (const [act, a] of byAction) {
    if (a.n < MIN_SHOWDOWNS) continue;                // stated at all, or not at all
    out[act] = { n: a.n, value: +(a.value / a.n).toFixed(3), draw: +(a.draw / a.n).toFixed(3), air: +(a.air / a.n).toFixed(3) };
  }
  return out;
};

/**
 * The contrast that needs no range model: what he does when the draw GOT there, versus when it
 * bricked, on boards where a draw was live the street before.
 *
 * This is the founder's example run as a measurement. Two frequencies, conditioned on an event
 * that is a property of the cards on the table and nothing else. No assumed range, no equity
 * ordering, no showdown - which is why it survives every caveat that limits the rest of the file.
 */
export const drawCompletionContrast = (decisions) => {
  const cell = () => ({ n: 0, fold: 0, call: 0, bet: 0, raise: 0, check: 0 });
  const out = { completed: cell(), missed: cell() };
  for (const d of decisions) {
    if (d.street === 'preflop' || !d.strengthDelta) continue;
    // A draw was live and the new card resolved it one way or the other.
    const bucket = d.strengthDelta.completed ? out.completed
      : (d.strengthDelta.draw < -0.05 ? out.missed : null);
    if (!bucket) continue;
    bucket.n++;
    if (bucket[d.action] !== undefined) bucket[d.action]++;
  }
  /**
   * COUNTS TRAVEL WITH RATES. The renderer cannot put an interval on 33.3% unless it knows
   * that is 4 of 12, and a 33.3% quoted beside a 20.0% measured on 65 invites a comparison
   * the sample does not support. Emitting k alongside the rate is what makes the interval
   * derivable downstream instead of dropped.
   */
  const rate = (c) => (c.n ? {
    n: c.n,
    aggressionK: c.bet + c.raise,
    foldK: c.fold,
    passiveK: c.call + c.check,
    aggression: +((c.bet + c.raise) / c.n).toFixed(3),
    fold: +(c.fold / c.n).toFixed(3),
    passive: +((c.call + c.check) / c.n).toFixed(3),
  } : null);
  return { completed: rate(out.completed), missed: rate(out.missed) };
};

/**
 * Attach per-decision inference. Called after strength and deltas exist.
 *
 * The prior is computed once over ALL his decisions and applied per row, because a prior fitted
 * inside the spot it is used to interpret would be circular - the same trap the range-inference
 * fixed point has, arrived at from the other direction.
 */
export const annotate = (decisions) => {
  const prior = showdownPrior(decisions);
  let excluded = 0; let implied = 0;
  for (const d of decisions) {
    const ex = foldExcludes(d);
    if (ex) { d.excluded = ex; excluded++; }
    if ((d.action === 'bet' || d.action === 'raise') && prior[d.action] && d.strength) {
      // What his range could hold here, weighted by what a bet from him has historically meant.
      d.implied = {
        priorN: prior[d.action].n,
        priorValue: prior[d.action].value,
        rangeValue: d.strength.value,
        rangeDraw: d.strength.realDraw,
        // The residual doubt: he bet, his range is this much non-value, and his own history says
        // he bets value this often. What is left is the size of the bluff hypothesis.
        doubt: +Math.max(0, 1 - prior[d.action].value - d.strength.value).toFixed(3),
      };
      implied++;
    }
  }
  return { prior, excluded, implied, contrast: drawCompletionContrast(decisions) };
};
