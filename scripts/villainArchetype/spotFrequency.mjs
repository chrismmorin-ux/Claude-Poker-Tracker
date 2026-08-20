/**
 * spotFrequency — how often a steal spot actually ARISES, measured rather than assumed.
 *
 * WHAT THIS REPLACES: `occurrencesPer100: 100 / 6`, a literal repeated at four call sites in
 * `runExploitCard.mjs` and commented "the button comes round once per orbit at six-handed".
 * Three things are wrong with it, and they compound:
 *
 *   1. IT IS A SEAT-OCCUPANCY RATE, NOT A SPOT RATE. It counts every button, not every button
 *      that gets folded to. The priced line is `steal:BTN-first-in`, which requires everyone
 *      before hero to fold. Measured, that happens on well under half of buttons — so the
 *      constant overstates the spot by roughly 2.8x, and every bb/100 on the card with it.
 *   2. THE SAME VALUE WAS REUSED ON THE CUTOFF AND HIJACK ROWS, where hero is not on the button
 *      at all. One constant cannot express three different seats. The two factors pull in
 *      OPPOSITE directions as you move earlier — an earlier seat is folded to less often, but
 *      more seats qualify as "earlier" across a session — so the ordering of the product is not
 *      something to reason out. It has to be measured, and it does not come out in button order.
 *   3. TABLES ARE NOT ALWAYS SIX-HANDED. `100/6` cannot express a table that is five-handed for
 *      part of the session, and at five-handed there is no hijack at all. A rate whose
 *      denominator is a guess about table size cannot carry a seat that sometimes does not exist.
 *
 * WHY IT IS RETURNED AS TWO RATES AND NOT ONE NUMBER. `P(hero is in this seat)` and
 * `P(the action folds to hero there)` are separately checkable and separately transferable. The
 * founder's game is 9-handed live; the first factor changes mechanically with table size
 * (1/9, not 1/6) while the second is a behavioural property of the population. Collapsing them
 * into a single per-100 figure destroys exactly the distinction a live transfer needs, so the
 * product is offered alongside its factors rather than instead of them.
 *
 * TRANSFER CAVEAT, MANDATORY ON ANY CARD QUOTING THESE — and narrower than it used to be.
 * This corpus was called "six-max" throughout the work that produced the exploit card. Measured,
 * it is not: table sizes run 3 to 9 handed, mean ~6.7, and roughly 18% of hands are NINE-HANDED,
 * which is the founder's game. So the table-size half of the transfer can be MEASURED rather
 * than assumed — read `bySeatAndTableSize`. The population half stands: online 2009 is not live
 * 2026, and P(the pot is folded to hero) is behavioural, not mechanical.
 */
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { positionOf } from './decisionLabeler.mjs';

export const SPOT_FREQUENCY_SCHEMA_VERSION = 1;

const rate = (k, n, conditional) => ({ k, n, rate: n ? k / n : null, conditional });

/**
 * @param {Object} opts
 * @param {Array<{path}>} opts.files
 * @param {AsyncIterable} [opts.handSource] - test seam yielding `{hand}`
 * @param {string[]} [opts.seats] - which position labels to report
 */
export const measureSpotFrequency = async ({
  files = [], handSource = null, seats = ['BTN', 'CO', 'HJ', 'SB', 'BB', 'UTG'], onProgress = null,
} = {}) => {
  let hands = 0, seatOccupancies = 0;
  const tableSizes = new Map();
  /** position -> { dealt, firstIn } */
  const bySeat = new Map(seats.map((s) => [s, { dealt: 0, firstIn: 0 }]));
  /** `${pos}|${tableSize}` -> {dealt, firstIn}. See the note on `bySeatAndTableSize` below. */
  const bySize = new Map();
  const bumpSize = (pos, size, field) => {
    const key = `${pos}|${size}`;
    if (!bySize.has(key)) bySize.set(key, { position: pos, tableSize: size, dealt: 0, firstIn: 0 });
    bySize.get(key)[field]++;
  };

  const consume = (hand) => {
    const g = hand?.gameState;
    const occupied = Object.keys(hand?.seatPlayers ?? {});
    if (!occupied.length) return;
    hands++;
    seatOccupancies += occupied.length;
    tableSizes.set(occupied.length, (tableSizes.get(occupied.length) ?? 0) + 1);

    const seq = [...(g?.actionSequence ?? [])].sort((a, b) => a.order - b.order);
    // Position labels for every occupied seat, from the same primitive the labeller uses — so
    // "BTN" here and "BTN" on a decision row cannot mean different seats.
    const posBySeat = new Map(occupied.map((s) => [String(s), positionOf(s, g?.dealerButtonSeat, occupied)]));
    const tableSize = occupied.length;
    for (const [, pos] of posBySeat) {
      const rec = bySeat.get(pos);
      if (rec) { rec.dealt++; bumpSize(pos, tableSize, 'dealt'); }
    }

    // Walk the preflop actions in order and count every seat the action REACHES while nobody
    // has yet entered the pot.
    //
    // THE DISTINCTION THAT COST A FACTOR OF ~2.8 ON THE FIRST ATTEMPT: a seat that is folded to
    // and then FOLDS still had the opportunity. Counting only the first seat to enter measures
    // "P(this seat opens)", which is a behavioural rate about the population — not
    // "P(the spot arises for hero)", which is what a per-100 frequency multiplies EV by. Hero's
    // opportunity does not depend on what the corpus player sitting there chose to do with it.
    let entered = false;
    for (const e of seq) {
      if (e.street && e.street !== 'preflop') break;
      if (entered) break;
      const pos = posBySeat.get(String(e.seat));
      if (pos) {
        const rec = bySeat.get(pos);
        if (rec) { rec.firstIn++; bumpSize(pos, tableSize, 'firstIn'); }
      }
      if (e.action !== 'fold') entered = true;      // the pot is now open; no later seat is first-in
    }
  };

  if (handSource) {
    for await (const { hand } of handSource) consume(hand);
  } else {
    let i = 0;
    for (const f of files) {
      for await (const hand of iterAppHands(f.path)) consume(hand);
      if (onProgress && ++i % 25 === 0) onProgress({ files: i, total: files.length, hands });
    }
  }

  const out = {};
  for (const [pos, rec] of bySeat) {
    const inSeat = rate(rec.dealt, seatOccupancies,
      `P(a seated player is in ${pos} | dealt into a hand)`);
    const firstIn = rate(rec.firstIn, rec.dealt,
      `P(the pot is folded to ${pos} with nobody yet entered | dealt in ${pos})`);
    out[pos] = {
      inSeat,
      firstIn,
      // The product, offered WITH its factors rather than instead of them. Per 100 hands dealt
      // to a seated player.
      per100Hands: inSeat.rate == null || firstIn.rate == null ? null
        : +(100 * inSeat.rate * firstIn.rate).toFixed(3),
      conditional: `first-in opportunities in ${pos}, per 100 hands dealt to a seated player`,
      source: 'measured on the corpus slice named in this artifact; NOT a table-size assumption',
    };
  }

  return {
    artifact: 'spot-frequency',
    schemaVersion: SPOT_FREQUENCY_SCHEMA_VERSION,
    hands,
    seatOccupancies,
    meanTableSize: hands ? +(seatOccupancies / hands).toFixed(3) : null,
    tableSizeDistribution: Object.fromEntries([...tableSizes].sort((a, b) => a[0] - b[0])),
    bySeat: out,
    /**
     * THE SAME RATES, CONDITIONED ON TABLE SIZE — and this is not a nicety.
     *
     * The corpus was described throughout this work as "online six-max". It is not. Measured
     * table sizes run 3 to 9 handed with a mean near 6.7, and NINE-HANDED HANDS ARE ~18% OF IT.
     * The founder's game is live 9-handed, and the standing disclaimer says any live claim
     * anchored on this corpus is transferred rather than measured.
     *
     * For the table-size half of that transfer, it does not have to be. A 9-handed spot
     * frequency can be READ OFF this corpus directly instead of being derived from a six-max
     * figure by assumption. That does not close the population gap — online 2009 is still a
     * different population from live 2026, and the behavioural half of the transfer stands —
     * but it removes one of the two gaps rather than caveating both.
     */
    bySeatAndTableSize: Object.fromEntries([...bySize.values()]
      .sort((a, b) => a.tableSize - b.tableSize || a.position.localeCompare(b.position))
      .map((r) => [`${r.position}|${r.tableSize}`, {
        ...r,
        firstInRate: r.dealt ? r.firstIn / r.dealt : null,
        conditional: `P(the pot is folded to ${r.position} with nobody yet entered | dealt in `
          + `${r.position} at a ${r.tableSize}-handed table)`,
      }])),
    transferCaveat: 'Measured on an ONLINE 2009 corpus whose tables run 3-9 handed (mean ~6.7), '
      + 'NOT a six-max corpus as previously described. Read `bySeatAndTableSize` for a figure at '
      + "the founder's 9-handed table size rather than transferring a pooled one. The population "
      + 'half of the transfer still stands: online 2009 is not live 2026, and P(folded to hero) '
      + 'is a behavioural property that does not carry over intact.',
  };
};
