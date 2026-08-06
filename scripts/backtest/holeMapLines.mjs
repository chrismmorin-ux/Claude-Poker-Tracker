/**
 * holeMapLines.mjs — the OUTCOME-ANCHORED arm of the hole map.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS AND WHY IT BYPASSES THE ENGINE ENTIRELY
 *
 * The rest of the hole map prices a line through a model: pot geometry gives the required
 * fold frequency, a fitted curve gives the predicted one, the gap is the exploit. That
 * chain has a load-bearing component under active suspicion — the fold-elasticity model,
 * whose LEVEL is not fitted at all and whose facing-a-raise arm was never merged.
 *
 * So this module reads WHAT HAPPENED instead of what a model thinks would happen. For each
 * named line it scans the corpus for hands where the line ACTUALLY OCCURRED and reports the
 * realized chip outcomes: count, mean bb, the distribution, showdown share.
 *
 * ITS VALUE IS AS A CHECK ON THE MODEL, WHICH IS THE THING UNDER SUSPICION. If the model
 * says a line is -EV and the realized outcomes say otherwise, that disagreement is the most
 * informative number in the whole deliverable, and it points at a specific defect rather
 * than at a vague doubt.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS AND IS NOT A SAMPLE OF
 *
 * NOT survivorship over outcomes: hands where the line was taken and LOST are in the data
 * exactly as much as hands where it won. Nothing filters on result.
 *
 * IT IS a selected sample of PLAYERS. The seats that fire a triple barrel are not a random
 * draw from the pool, and their realized bb includes whatever else they are doing well or
 * badly. So `meanNetBB` for a line is the mean result of the HANDS CONTAINING that line, in
 * the hands of the players who chose it — not the causal effect of adding the line to your
 * own game. Stated on the row, because the two readings differ and the second is the one a
 * reader will reach for.
 *
 * Also: the net is the WHOLE HAND's result, not the line's incremental contribution. A
 * triple barrel that wins a big pot is credited with money that partly belongs to the
 * preflop raise. There is no decomposition available here and none is implied.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * DETECTION
 *
 * Ported from the check-raise walker that already ships and runs on this exact hand shape
 * (`src/utils/exploitEngine/decisionAccumulator.js:534-556`) and from the barrel-chain logic
 * in `scripts/backtest/mine-behavioral-features.py:301-308`. There is no mjs multi-street
 * line classifier in the repo — `src/utils/rangeEngine/lineTaxonomy.js` is PREFLOP ONLY (its
 * 10 labels are limp/open/coldCall/threeBet/fold plus five preflop subclasses) and cannot
 * see a barrel or a check-raise. This is the gap it fills; it is not a duplicate of it.
 *
 * Adapter conventions this depends on (`scripts/backtest/phhAdapter.mjs`):
 *   · `actionSequence` entries are `{order, seat, action, street, amount?}`; `order` is
 *     dense and hand-global, `street` is on every entry.
 *   · `action` is a PRIMITIVE: postflop first chips in are `bet`, subsequent are `raise`.
 *   · `amount` on bet/raise is TOTAL STREET COMMITMENT ("raise to"), not an increment.
 *   · `seat` is a NUMBER here and a STRING in `netBySeat`/`committedBySeat`. Always cross
 *     with `String(seat)` — this is the single most common way to get zero rows silently.
 */

const STREETS = ['flop', 'turn', 'river'];

/** Per-street, per-seat action timeline, in `order`. */
const streetTimelines = (hand) => {
  const out = { flop: [], turn: [], river: [], preflop: [] };
  for (const e of hand?.gameState?.actionSequence ?? []) {
    if (out[e.street]) out[e.street].push(e);
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.order - b.order);
  return out;
};

/**
 * Did `seat` check, then face a bet/raise, then raise — on this street?
 *
 * Returns the OPPORTUNITY too (`checkedThenFacedBet`), which is the denominator a frequency
 * needs. Scoring "should have check-raised" over all checks would include the nodes where
 * villain checked behind and the question never arose.
 */
export const detectCheckRaise = (timeline, seat) => {
  const ps = String(seat);
  let checked = false;
  let facedBet = false;
  for (const e of timeline) {
    if (String(e.seat) === ps) {
      if (!checked && e.action === 'check') checked = true;
      else if (checked && facedBet && e.action === 'raise') {
        return { checkRaised: true, checkedThenFacedBet: true };
      }
    } else if (checked && !facedBet && (e.action === 'bet' || e.action === 'raise')) {
      facedBet = true;
    }
  }
  return { checkRaised: false, checkedThenFacedBet: checked && facedBet };
};

/** The seat's first voluntary BET on a street, with the pot it went into. */
const firstBetOn = (timeline, seat, hand) => {
  const ps = String(seat);
  for (const e of timeline) {
    if (String(e.seat) === ps && e.action === 'bet') {
      const potBefore = hand?._backtest?.potBeforeByOrder?.[e.order];
      const bb = hand?._backtest?.bb || 1;
      return {
        order: e.order,
        amountChips: e.amount ?? 0,
        potBeforeChips: potBefore ?? null,
        amountBB: (e.amount ?? 0) / bb,
        potBeforeBB: potBefore == null ? null : potBefore / bb,
        frac: potBefore > 0 ? (e.amount ?? 0) / potBefore : null,
      };
    }
  }
  return null;
};

/** Did the seat RAISE on this street (any raise, not necessarily a check-raise)? */
const raisedOn = (timeline, seat) =>
  timeline.some((e) => String(e.seat) === String(seat) && e.action === 'raise');

/** Did the seat FOLD at any point in the hand? */
const foldedInHand = (hand, seat) =>
  (hand?.gameState?.actionSequence ?? []).some(
    (e) => String(e.seat) === String(seat) && e.action === 'fold',
  );

/**
 * Classify every line this seat took in this hand.
 *
 * Returns a Set of line ids. A hand can carry several — a double barrel is also part of a
 * triple barrel — and they are NOT mutually exclusive, which is exactly why `sumDisjoint`
 * in holeMap.mjs refuses to add their bb/hour figures.
 */
export const classifyLines = (hand, seat) => {
  const tl = streetTimelines(hand);
  const lines = new Set();
  const detail = {};

  // --- check-raise, per street, with its own opportunity denominator -------------------
  const opportunities = {};
  let anyCheckRaise = false;
  for (const st of STREETS) {
    const { checkRaised, checkedThenFacedBet } = detectCheckRaise(tl[st], seat);
    opportunities[`${st}_checkraise`] = checkedThenFacedBet ? 1 : 0;
    if (checkRaised) { lines.add(`${st}_checkraise`); anyCheckRaise = true; }
  }

  // check-raise-fold: the founder named it explicitly. It is a real, deliberate line —
  // raise to deny equity, then release when the re-raise says you are beaten.
  if (anyCheckRaise && foldedInHand(hand, seat)) lines.add('checkraise_fold');

  // --- barrel chain -------------------------------------------------------------------
  const bets = {};
  for (const st of STREETS) bets[st] = firstBetOn(tl[st], seat, hand);
  if (bets.flop && bets.turn) lines.add('double_barrel');
  if (bets.flop && bets.turn && bets.river) lines.add('triple_barrel');

  // "triple barrel with a river 3bet" — barrel the first two streets, then RAISE the river
  // rather than bet it. This is the founder's headline high-magnitude line.
  if (bets.flop && bets.turn && raisedOn(tl.river, seat)) lines.add('barrel_then_river_raise');

  // --- escalating value sizing --------------------------------------------------------
  // Strictly increasing bet-as-fraction-of-pot across consecutive barrelled streets.
  const fracs = STREETS.map((st) => bets[st]?.frac).filter((f) => Number.isFinite(f));
  if (fracs.length >= 2) {
    let rising = true;
    for (let i = 1; i < fracs.length; i++) if (!(fracs[i] > fracs[i - 1])) rising = false;
    if (rising) lines.add('escalating_sizing');
    detail.sizingFracs = fracs;
  }

  return { lines, opportunities, detail };
};

/**
 * Accumulate line occurrences and their realized outcomes across a corpus slice.
 *
 * `outcome` is whatever `resolveHandOutcome` returned — `netBySeat` is ALREADY IN BIG
 * BLINDS and must not be divided again.
 */
export const makeLineAccumulator = () => {
  const byLine = new Map();
  const totals = { hands: 0, seatHands: 0, showdowns: 0, unresolved: 0 };

  const bucketOf = (line) => {
    if (!byLine.has(line)) {
      byLine.set(line, {
        lineId: line, n: 0, opportunities: 0, netBBs: [], showdowns: 0, wins: 0,
      });
    }
    return byLine.get(line);
  };

  return {
    totals,
    /** One hand, already outcome-resolved. */
    addHand(hand, outcome) {
      if (!outcome?.resolved) { totals.unresolved++; return; }
      totals.hands++;
      if (outcome.wentToShowdown) totals.showdowns++;
      const seats = Object.keys(hand?.seatPlayers ?? {});
      totals.seatHands += seats.length;
      for (const seatStr of seats) {
        const seat = Number(seatStr);
        const { lines, opportunities } = classifyLines(hand, seat);
        for (const [k, v] of Object.entries(opportunities)) {
          if (v) bucketOf(k).opportunities += v;
        }
        if (!lines.size) continue;
        const net = outcome.netBySeat?.[seatStr];
        for (const line of lines) {
          const b = bucketOf(line);
          b.n++;
          if (Number.isFinite(net)) {
            b.netBBs.push(net);
            if (net > 0) b.wins++;
          }
          if (outcome.wentToShowdown) b.showdowns++;
        }
      }
    },
    /** Finalize: counts, rates per 100 hands, and the realized distribution. */
    finish() {
      const rows = [];
      for (const b of byLine.values()) {
        const xs = b.netBBs.slice().sort((a, x) => a - x);
        const q = (p) => (xs.length ? xs[Math.min(xs.length - 1, Math.floor(p * xs.length))] : null);
        const mean = xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null;
        const sd = xs.length > 1
          ? Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (xs.length - 1))
          : null;
        rows.push({
          lineId: b.lineId,
          n: b.n,
          // Per 100 hands FOR ONE PLAYER: occurrences divided by seat-hands, not by hands.
          // Dividing by hands would report a 9-handed table's total activity as one
          // player's frequency and inflate every rate ~9x.
          ratePer100: totals.seatHands > 0 ? (b.n / totals.seatHands) * 100 : null,
          opportunities: b.opportunities,
          rateGivenOpportunity: b.opportunities > 0 ? b.n / b.opportunities : null,
          meanNetBB: mean,
          sdNetBB: sd,
          // The CI on a heavy-tailed, tiny-n mean is the honest way to say "this is 4 hands".
          seNetBB: sd != null && xs.length > 1 ? sd / Math.sqrt(xs.length) : null,
          medianNetBB: q(0.5),
          p10NetBB: q(0.10),
          p90NetBB: q(0.90),
          minNetBB: xs.length ? xs[0] : null,
          maxNetBB: xs.length ? xs[xs.length - 1] : null,
          showdownShare: b.n > 0 ? b.showdowns / b.n : null,
          winShare: xs.length ? b.wins / xs.length : null,
          netBBs: xs,
        });
      }
      rows.sort((a, b) => b.n - a.n);
      return { rows, totals };
    },
  };
};
