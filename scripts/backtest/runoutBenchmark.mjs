#!/usr/bin/env node
/**
 * runoutBenchmark.mjs — Layer A: what the combinatorics justify.
 *
 * WS-310 GATE, Stage 2. Stage 1 (mine-runout-response.py) measured how often a player
 * who called a flop bet continues against a turn bet, split by whether the turn card
 * moved the NUT IDENTITY. Those are raw frequencies, and per the standing rule
 * (memory: feedback_numbers_carry_their_conditional) a frequency conditioned on a runout
 * is not yet a finding: "villains fold 71% when the flush completes" is a large read if
 * their range holds the flush 12% of the time and is close to correct play if it holds
 * it 40%. This script supplies the missing denominator.
 *
 * WHAT LAYER A IS. Given a board and a DECLARED range, what fraction of that range still
 * clears the price it is being offered. Pure combinatorics — no player data, no sampling
 * error, and it does not age. The deliverable of the gate is the DEVIATION,
 * observed minus justified, with a sign.
 *
 * THE FRAME IS POKER_THEORY 15. The board is not a filter applied to a range; it is the
 * thing that DEFINES the universe, and a range is a subset embedded in it. That is why a
 * turn card can be scored by what it does to the whole space of holdings rather than by
 * what it does to hero's hand — which is exactly the hero-centric test at
 * gameTreeDepth2.js:570 that this work exists to replace.
 *
 * BINDING — DECLARED RANGES, NEVER THE ENGINE'S OWN ESTIMATE.
 * Every range here comes from PREFLOP_CHARTS (imported solver-approximate charts) plus a
 * filter whose WIDTH is measured from the corpus and whose COMPOSITION is combinatorial.
 * Nothing consults the narrower, the range profile, or any model output. Taking the base
 * rate from the model makes the model validate itself — that is FIND-038, where sizing
 * tells measured self-consistency with the engine's own prior while the UI claimed
 * showdown confirmation.
 *
 * THREE THINGS ARE MEASURED, NOT ASSUMED (all from Stage 1, all uncensored):
 *   flopContinue  width of the declared flop-calling range
 *   barrelRate    per cell — width of the declared turn betting range
 *   reqEquity     the actual price offered in each spot
 * The last one is also how bet SIZING is controlled: if players size up on flush turns,
 * the threshold moves with them, so a continuation drop caused by price alone is absorbed
 * into the benchmark instead of being scored as over-folding.
 *
 * WHAT IS ASSUMED, AND HOW IT IS BOUNDED. Which combos a player barrels is not knowable
 * from the data. So the betting range is built twice — LINEAR (top f by equity) and
 * POLARISED (top f/2 plus bottom f/2) — and the result is reported as a BAND. And because
 * the absolute level depends on declared-range choices that could be wrong, the headline
 * is the DIFFERENCE-IN-DIFFERENCES against the blank cell, which cancels any level error
 * common to all cells.
 *
 * NOT A CLAIM ABOUT OPTIMAL PLAY. "Clears the pot odds" ignores implied odds, raising as
 * an option, and river play. It is a well-defined declared quantity that moves correctly
 * with the board and the price — which is all the gate needs, since the gate asks whether
 * behaviour deviates from combinatorics, not whether players are playing GTO.
 *
 * Usage:
 *   node scripts/backtest/runoutBenchmark.mjs \
 *     --records out/runout-response.json --out out/runout-benchmark.json \
 *     [--boards-per-cell 150] [--flop-samples 48] [--self-test]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
};
const flag = (name) => argv.includes(`--${name}`);

const RECORDS = arg('records', 'out/runout-response.json');
const OUT = arg('out', 'out/runout-benchmark.json');
const BOARDS_PER_CELL = Number(arg('boards-per-cell', '150'));
const FLOP_SAMPLES = Number(arg('flop-samples', '48'));
const SELF_TEST = flag('self-test');

// Deterministic PRNG — a research number that moves between runs is not a research
// number. Every sample below draws from this.
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------------------
// Weighted score index — the load-bearing performance choice.
//
// Equity of a combo against a range is "what weight of the range does it beat".
// Computed pairwise that is |R| x |B| per river (~200k ops/board/river). Sorted once
// with prefix-summed weights it is a binary search per combo. Same answer, ~two orders
// of magnitude less work, which is what makes an exact 44-river enumeration affordable
// instead of a Monte Carlo approximation.
// ---------------------------------------------------------------------------
const buildIndex = (entries) => {
  entries.sort((a, b) => a.score - b.score);
  const n = entries.length;
  const scores = new Float64Array(n);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    scores[i] = entries[i].score;
    prefix[i + 1] = prefix[i] + entries[i].weight;
  }
  return { scores, prefix, total: prefix[n], n };
};

const lowerBound = (a, n, s) => {
  let lo = 0, hi = n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < s) lo = m + 1; else hi = m; }
  return lo;
};
const upperBound = (a, n, s) => {
  let lo = 0, hi = n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= s) lo = m + 1; else hi = m; }
  return lo;
};

/** Weight strictly below s, weight equal to s, and total weight. */
const query = (idx, s) => {
  if (idx.n === 0) return { less: 0, equal: 0, total: 0 };
  const lo = lowerBound(idx.scores, idx.n, s);
  const hi = upperBound(idx.scores, idx.n, s);
  return { less: idx.prefix[lo], equal: idx.prefix[hi] - idx.prefix[lo], total: idx.total };
};

const EMPTY_INDEX = { scores: new Float64Array(0), prefix: new Float64Array(1), total: 0, n: 0 };

/**
 * Index a villain range's scores, plus one sub-index per card.
 *
 * The per-card indices exist for CARD REMOVAL: a defender holding the Ah blocks every
 * villain combo containing the Ah, and those combos must leave both the numerator and
 * the denominator. Inclusion-exclusion over two card-indices does that exactly, which
 * matters here because blockers are precisely what a nut-changing card redistributes.
 */
const buildRangeIndex = (combos) => {
  const all = [];
  const byCard = Array.from({ length: 52 }, () => []);
  const pairScore = new Map();
  for (const c of combos) {
    const e = { score: c.score, weight: c.weight };
    all.push(e);
    byCard[c.card1].push({ score: c.score, weight: c.weight });
    byCard[c.card2].push({ score: c.score, weight: c.weight });
    pairScore.set(c.card1 * 52 + c.card2, c);
  }
  return {
    all: buildIndex(all),
    byCard: byCard.map((list) => (list.length ? buildIndex(list) : EMPTY_INDEX)),
    pairScore,
  };
};

/** Equity of one combo (score s, cards c1/c2) against an indexed range, blocker-exact. */
const equityVs = (index, c1, c2, s) => {
  const a = query(index.all, s);
  const b1 = query(index.byCard[c1], s);
  const b2 = query(index.byCard[c2], s);
  // Combos containing BOTH c1 and c2 = at most the single combo {c1,c2}.
  const both = index.pairScore.get(Math.min(c1, c2) * 52 + Math.max(c1, c2));
  let bLess = 0, bEqual = 0, bTotal = 0;
  if (both) {
    bTotal = both.weight;
    if (both.score < s) bLess = both.weight;
    else if (both.score === s) bEqual = both.weight;
  }
  const total = a.total - b1.total - b2.total + bTotal;
  if (total <= 1e-12) return null;
  const less = a.less - b1.less - b2.less + bLess;
  const equal = a.equal - b1.equal - b2.equal + bEqual;
  return (less + 0.5 * equal) / total;
};

// ---------------------------------------------------------------------------
// Range shaping — declared rules, stated plainly.
// ---------------------------------------------------------------------------

/** Keep the top `fraction` of total weight, ordered by `key` descending. */
const topFraction = (combos, key, fraction) => {
  const sorted = [...combos].sort((a, b) => key.get(b) - key.get(a));
  const target = sorted.reduce((s, c) => s + c.weight, 0) * fraction;
  const out = [];
  let acc = 0;
  for (const c of sorted) {
    if (acc >= target) break;
    out.push(c);
    acc += c.weight;
  }
  return out;
};

/**
 * Polarised: `valueShare` of the width taken from the top, the rest from the bottom.
 *
 * WHY valueShare IS NOT 0.5. A 50/50 split at the measured barrel widths (~0.55-0.63)
 * means betting the top 30% AND the bottom 30% of the range — an object no real player
 * constructs, and one whose average strength is so low that essentially every defending
 * combo clears the price. Measured: it pins justified continuation at ~99.8% in EVERY
 * cell, so its cell-to-cell differences vanish and the difference-in-differences
 * degenerates back into the raw observed contrast — Layer A contributing nothing.
 * That arm is reported anyway, flagged as saturated, because the failure is worth
 * recording rather than quietly dropping.
 */
const polarFraction = (combos, key, fraction, valueShare = 0.75) => {
  const sorted = [...combos].sort((a, b) => key.get(b) - key.get(a));
  const total = sorted.reduce((s, c) => s + c.weight, 0);
  const valueTarget = total * fraction * valueShare;
  const bluffTarget = total * fraction * (1 - valueShare);
  const out = [];
  let acc = 0;
  for (let i = 0; i < sorted.length && acc < valueTarget; i++) { out.push(sorted[i]); acc += sorted[i].weight; }
  acc = 0;
  for (let i = sorted.length - 1; i >= 0 && acc < bluffTarget; i--) { out.push(sorted[i]); acc += sorted[i].weight; }
  return out;
};

// The betting-range compositions the benchmark is bracketed across. `linear` is the
// strongest plausible range (bettor barrels their best hands); the mixed arms add
// bluffs, which weakens it. Truth sits inside; which one is right is not knowable from
// the data, so the answer is reported as a band and the DiD is what survives it.
const ARMS = [
  { key: 'linear', label: 'linear', valueShare: 1.0 },
  { key: 'mixed75', label: 'mixed 75/25', valueShare: 0.75 },
  { key: 'polar50', label: 'polar 50/50', valueShare: 0.5 },
];

const weightOf = (combos) => combos.reduce((s, c) => s + c.weight, 0);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const main = async () => {
  const loader = await openLoader(process.cwd());
  const { bestFiveFromSeven } = await loader.load('/src/utils/pokerCore/handEvaluator.js');
  const { averageCharts, enumerateCombos } = await loader.load('/src/utils/pokerCore/rangeMatrix.js');

  // -------------------------------------------------------------------------
  // DECLARED RANGES. Imported solver-approximate charts (PREFLOP_CHARTS), never a
  // model output. Widths are printed so the declaration is inspectable rather than
  // buried.
  //
  // The defender is whoever called a flop bet; the bettor is whoever made it. Neither
  // seat's exact position is recoverable per-spot, so these are pool-level stand-ins —
  // which is the right altitude anyway (Finding 14: terminal-strength distributions are
  // pool/archetype level, never per-villain).
  // -------------------------------------------------------------------------
  const BETTOR_CHART = ['HJ', 'CO', 'BTN'];
  const DEFENDER_CHART = ['BB', 'SB', 'BTN'];
  const bettorGrid = averageCharts(...BETTOR_CHART);
  const defenderGrid = averageCharts(...DEFENDER_CHART);

  const data = JSON.parse(readFileSync(RECORDS, 'utf-8'));
  const flopContinueRate = data.flopContinue.continueRate;

  if (SELF_TEST) {
    await selfTest({ bestFiveFromSeven, enumerateCombos, bettorGrid });
    await loader.close();
    return;
  }

  const cells = Object.keys(data.cells).filter((c) => (data.cells[c].n || 0) > 0);
  const results = {};
  const t0 = Date.now();

  for (const cell of cells) {
    const cellInfo = data.cells[cell];
    const samples = data.samples[cell] || [];
    const rand = mulberry32(0x51D0 + cell.length * 7919);

    // Random subsample of the reservoir, without replacement.
    const pool = [...samples];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosen = pool.slice(0, Math.min(BOARDS_PER_CELL, pool.length));

    const barrelRate = cellInfo.barrelRate;
    const acc = { n: 0, reqEq: 0 };
    // Per-board values are kept, not just their running sum: the justified figure is a
    // MEAN OVER BOARDS and several DiD values below are small, so it needs a standard
    // error attached or the reader cannot tell a real contrast from board-sampling noise.
    const perBoard = Object.fromEntries(ARMS.map((a) => [a.key, []]));

    for (const spot of chosen) {
      const out = benchmarkSpot({
        spot, bestFiveFromSeven, enumerateCombos, bettorGrid, defenderGrid,
        flopContinueRate, barrelRate, rand,
      });
      if (!out) continue;
      for (const a of ARMS) perBoard[a.key].push(out.justified[a.key]);
      acc.reqEq += spot.reqEquity;
      acc.n += 1;
    }

    const observed = cellInfo.continueRate;
    const justified = {};
    const justifiedSe = {};
    const deviation = {};
    for (const a of ARMS) {
      const s = meanSe(perBoard[a.key]);
      justified[a.key] = s.mean === null ? null : round(s.mean);
      justifiedSe[a.key] = s.se === null ? null : round(s.se);
      deviation[a.key] = s.mean === null ? null : round(observed - s.mean);
    }
    results[cell] = {
      n: cellInfo.n,
      boardsBenchmarked: acc.n,
      observedContinue: observed,
      // Binomial SE on the observed side. n is large (3k-42k) so this is small, but it
      // enters the DiD variance and should not be assumed away.
      observedSe: round(Math.sqrt(observed * (1 - observed) / cellInfo.n)),
      justified,
      justifiedSe,
      deviation,
      barrelRate,
      avgReqEquity: acc.n ? round(acc.reqEq / acc.n) : null,
      nutChanging: cellInfo.nutChanging,
    };
    console.log(`  ${cell.padEnd(20)} boards=${String(acc.n).padStart(4)} `
      + `obs=${(observed * 100).toFixed(1)}%  just lin=${(justified.linear * 100).toFixed(1)}% `
      + `mix=${(justified.mixed75 * 100).toFixed(1)}%  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }

  report(results, data);

  const payload = {
    question: ('Does turn continuation deviate from what the board combinatorics and the '
      + 'offered price justify, and does the deviation depend on whether the card moved '
      + 'the nut identity?'),
    declared: {
      bettorChart: BETTOR_CHART,
      defenderChart: DEFENDER_CHART,
      source: 'pokerCore/rangeMatrix.js PREFLOP_CHARTS — imported solver-approximate charts',
      flopContinueRate,
      note: ('Widths are MEASURED (flop continue rate, per-cell barrel rate, actual pot '
        + 'odds); compositions are DECLARED and bracketed linear-vs-polarised. No engine '
        + 'output is consulted anywhere in this file (FIND-038).'),
    },
    method: {
      equity: 'exact 44-river enumeration on the turn board, blocker-exact via card-indexed inclusion-exclusion',
      flopFilter: `equity-ordered, ${FLOP_SAMPLES} sampled two-card runouts per board`,
      boardsPerCell: BOARDS_PER_CELL,
      benchmark: ('fraction of the declared flop-calling range whose turn equity vs the '
        + 'declared betting range clears the actual price offered'),
      limits: ('Pot-odds clearing ignores implied odds, the raise option, and river play, '
        + 'so it is a declared reference quantity and not a claim about optimal play. '
        + 'Levels inherit the declared-range choice; the difference-in-differences vs the '
        + 'blank cell is the number that survives that choice.'),
    },
    arms: ARMS.map((a) => ({ key: a.key, label: a.label, valueShare: a.valueShare })),
    cells: results,
    diffInDiff: diffInDiff(results),
    saturation: saturationCheck(results),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 1));
  console.log(`\nwrote ${OUT} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await loader.close();
};

const round = (x) => Math.round(x * 100000) / 100000;

/** Mean and standard error of the mean over a sample of per-board values. */
const meanSe = (vals) => {
  const n = vals.length;
  if (!n) return { mean: null, se: null, n: 0 };
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  if (n < 2) return { mean, se: null, n };
  const varr = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { mean, se: Math.sqrt(varr / n), n };
};

/**
 * One spot's Layer-A benchmark.
 *
 * Order matters and is not cosmetic: the flop-continue filter is computed on the FLOP
 * board only. Ranking the defender's range by turn-board equity would leak the very card
 * whose effect we are trying to measure into the range that is supposed to predate it.
 */
const benchmarkSpot = ({ spot, bestFiveFromSeven, enumerateCombos, bettorGrid,
  defenderGrid, flopContinueRate, barrelRate, rand }) => {
  const flop = spot.flop;
  const board4 = [...flop, spot.turn];
  const dead = board4;

  const defCombos = enumerateCombos(defenderGrid, dead).map((c) => ({ ...c }));
  const betCombos = enumerateCombos(bettorGrid, dead).map((c) => ({ ...c }));
  if (!defCombos.length || !betCombos.length) return null;

  // --- 1. Flop-continue filter: rank the defender's preflop range by equity vs the
  // bettor's range ON THE FLOP, keep the measured continue width.
  // Equity-ordered rather than strength-ordered on purpose: a strength ordering folds
  // draws, which are exactly the holdings the collapsing-window concept is about.
  const used = new Set(board4);
  const deck = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c);

  const flopEqSum = new Map(defCombos.map((c) => [c, 0]));
  const flopEqCnt = new Map(defCombos.map((c) => [c, 0]));
  for (let s = 0; s < FLOP_SAMPLES; s++) {
    const i = Math.floor(rand() * deck.length);
    let j = Math.floor(rand() * deck.length);
    if (j === i) j = (j + 1) % deck.length;
    const r1 = deck[i], r2 = deck[j];
    const board5 = [...flop, r1, r2];

    const vill = [];
    for (const c of betCombos) {
      if (c.card1 === r1 || c.card1 === r2 || c.card2 === r1 || c.card2 === r2) continue;
      vill.push({ card1: c.card1, card2: c.card2, weight: c.weight,
        score: bestFiveFromSeven([c.card1, c.card2, ...board5]) });
    }
    if (!vill.length) continue;
    const idx = buildRangeIndex(vill);

    for (const c of defCombos) {
      if (c.card1 === r1 || c.card1 === r2 || c.card2 === r1 || c.card2 === r2) continue;
      const sc = bestFiveFromSeven([c.card1, c.card2, ...board5]);
      const eq = equityVs(idx, c.card1, c.card2, sc);
      if (eq === null) continue;
      flopEqSum.set(c, flopEqSum.get(c) + eq);
      flopEqCnt.set(c, flopEqCnt.get(c) + 1);
    }
  }
  const flopEq = new Map();
  for (const c of defCombos) {
    const n = flopEqCnt.get(c);
    flopEq.set(c, n ? flopEqSum.get(c) / n : 0);
  }
  const R1 = topFraction(defCombos, flopEq, flopContinueRate);
  if (!R1.length) return null;

  // --- 2. Turn: score every river once for BOTH ranges, and reuse those scores for
  // every betting-range composition. The evaluations are the expensive part; the
  // counting is not.
  const rivers = deck;
  const riverData = [];
  for (const r of rivers) {
    const board5 = [...board4, r];
    const bet = [];
    for (const c of betCombos) {
      if (c.card1 === r || c.card2 === r) continue;
      bet.push({ combo: c, card1: c.card1, card2: c.card2, weight: c.weight,
        score: bestFiveFromSeven([c.card1, c.card2, ...board5]) });
    }
    const def = [];
    for (const c of R1) {
      if (c.card1 === r || c.card2 === r) continue;
      def.push({ combo: c, card1: c.card1, card2: c.card2, weight: c.weight,
        score: bestFiveFromSeven([c.card1, c.card2, ...board5]) });
    }
    riverData.push({ bet, def });
  }

  // --- 3. Rank the bettor's combos by turn equity vs the defender's calling range,
  // then select the barrelling subset at the MEASURED width for this cell.
  const betEqSum = new Map(betCombos.map((c) => [c, 0]));
  const betEqCnt = new Map(betCombos.map((c) => [c, 0]));
  for (const { bet, def } of riverData) {
    if (!def.length) continue;
    const defIdx = buildRangeIndex(def);
    for (const b of bet) {
      const eq = equityVs(defIdx, b.card1, b.card2, b.score);
      if (eq === null) continue;
      betEqSum.set(b.combo, betEqSum.get(b.combo) + eq);
      betEqCnt.set(b.combo, betEqCnt.get(b.combo) + 1);
    }
  }
  const betEq = new Map();
  for (const c of betCombos) {
    const n = betEqCnt.get(c);
    betEq.set(c, n ? betEqSum.get(c) / n : 0);
  }
  const f = Math.max(0.05, Math.min(1, barrelRate));
  const armSets = ARMS.map((a) => ({
    key: a.key,
    set: new Set(a.valueShare >= 1
      ? topFraction(betCombos, betEq, f)
      : polarFraction(betCombos, betEq, f, a.valueShare)),
    eq: new Map(R1.map((c) => [c, 0])),
    cnt: new Map(R1.map((c) => [c, 0])),
  }));

  // --- 4. Defender equity vs each betting range, reusing the cached river scores.
  // Only the counting is repeated per arm; the evaluations are not.
  for (const { bet, def } of riverData) {
    if (!def.length) continue;
    for (const arm of armSets) {
      const sel = bet.filter((b) => arm.set.has(b.combo));
      if (!sel.length) continue;
      const idx = buildRangeIndex(sel);
      for (const d of def) {
        const e = equityVs(idx, d.card1, d.card2, d.score);
        if (e === null) continue;
        arm.eq.set(d.combo, arm.eq.get(d.combo) + e);
        arm.cnt.set(d.combo, arm.cnt.get(d.combo) + 1);
      }
    }
  }

  // --- 5. Justified continuation = weight of the calling range that clears the price.
  const req = spot.reqEquity;
  const totalW = weightOf(R1);
  const justified = {};
  for (const arm of armSets) {
    let w = 0;
    for (const c of R1) {
      const n = arm.cnt.get(c);
      if (n && arm.eq.get(c) / n >= req) w += c.weight;
    }
    justified[arm.key] = totalW ? w / totalW : 0;
  }
  return { justified, defenderWeight: totalW };
};

/**
 * Difference-in-differences against the blank cell.
 *
 * This is the headline. The LEVEL of `justified` inherits every declared-range choice
 * made above, and those choices could be wrong. But they are the same in every cell, so
 * differencing each nut-changing cell against `blank` cancels them and leaves the part
 * of the contrast that is actually about the card.
 */
const diffInDiff = (results) => {
  const base = results.blank;
  if (!base) return null;
  const out = {};
  for (const [cell, r] of Object.entries(results)) {
    if (cell === 'blank' || !r.boardsBenchmarked) continue;
    const obsDelta = r.observedContinue - base.observedContinue;
    const entry = { observedDelta: round(obsDelta), justifiedDelta: {}, did: {}, didSe: {}, didZ: {} };
    for (const a of ARMS) {
      const jd = r.justified[a.key] - base.justified[a.key];
      const did = obsDelta - jd;
      // Four independent sources: two binomial (observed), two board-sampling (justified).
      const se = Math.sqrt((r.observedSe ?? 0) ** 2 + (base.observedSe ?? 0) ** 2
        + (r.justifiedSe[a.key] ?? 0) ** 2 + (base.justifiedSe[a.key] ?? 0) ** 2);
      entry.justifiedDelta[a.key] = round(jd);
      entry.did[a.key] = round(did);
      entry.didSe[a.key] = round(se);
      entry.didZ[a.key] = se > 0 ? round(did / se) : null;
    }
    out[cell] = entry;
  }
  return out;
};

/**
 * An arm is SATURATED when its justified continuation is pinned near 100% in every
 * cell. Such an arm has no cell-to-cell variation left, so its difference-in-differences
 * silently collapses into the raw observed contrast — it looks like a Layer-A-corrected
 * number while containing no Layer A at all. Detecting that is the difference between a
 * band and a band with a dead end in it.
 */
const saturationCheck = (results) => {
  const out = {};
  for (const a of ARMS) {
    const vals = Object.values(results)
      .filter((r) => r.boardsBenchmarked)
      .map((r) => r.justified[a.key]);
    const min = Math.min(...vals);
    const spread = Math.max(...vals) - min;
    out[a.key] = {
      min: round(min), spread: round(spread),
      saturated: min > 0.95 && spread < 0.03,
    };
  }
  return out;
};

const pct = (x) => (x === null || x === undefined ? '   -  ' : `${(x * 100).toFixed(1)}%`);
const signed = (x) => (x === null || x === undefined ? '   -  '
  : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}pp`);

const report = (results, data) => {
  console.log('\nOBSERVED vs JUSTIFIED CONTINUATION');
  console.log('(justified = fraction of the declared calling range clearing the actual price)');
  console.log(`${'cell'.padEnd(20)}${'n'.padStart(8)}${'observed'.padStart(10)}`
    + ARMS.map((a) => `just(${a.key})`.padStart(14)).join(''));
  for (const [cell, r] of Object.entries(results)) {
    console.log(`${cell.padEnd(20)}${String(r.n).padStart(8)}${pct(r.observedContinue).padStart(10)}`
      + ARMS.map((a) => pct(r.justified[a.key]).padStart(14)).join(''));
  }

  const sat = saturationCheck(results);
  const dead = ARMS.filter((a) => sat[a.key].saturated);
  if (dead.length) {
    console.log(`\nSATURATED ARMS (excluded from the headline band): `
      + dead.map((a) => `${a.key} (min ${pct(sat[a.key].min)}, spread ${pct(sat[a.key].spread)})`).join(', '));
    console.log('  A saturated arm has no cell-to-cell variation, so its DiD degenerates');
    console.log('  into the raw observed contrast — Layer A contributing nothing.');
  }

  const did = diffInDiff(results);
  if (did) {
    console.log('\nDIFFERENCE-IN-DIFFERENCES vs blank  (cancels declared-range level error)');
    const live = ARMS.filter((a) => !sat[a.key].saturated);
    console.log(`${'cell'.padEnd(20)}${'obs delta'.padStart(12)}`
      + live.map((a) => `DiD(${a.key}) +/-se  z`.padStart(26)).join(''));
    for (const [cell, d] of Object.entries(did)) {
      console.log(`${cell.padEnd(20)}${signed(d.observedDelta).padStart(12)}`
        + live.map((a) => {
          const z = d.didZ[a.key];
          return `${signed(d.did[a.key])} +/-${(d.didSe[a.key] * 100).toFixed(1)}pp z=${z === null ? '-' : z.toFixed(1)}`.padStart(26);
        }).join(''));
    }
    console.log('\nDiD > 0 = villains continue MORE than the card justifies (sticky).');
    console.log('DiD < 0 = villains continue LESS than the card justifies (over-folding).');
    if (dead.length) console.log('* saturated arm — not evidence.');
  }
  void data;
};

/**
 * Self-test: reproduce the indexed equity by an independent route.
 *
 * The thing most likely to be silently wrong is not the evaluator — it is the
 * card-removal inclusion-exclusion, which is the only clever step here. So the test
 * compares the sorted-index result against a plain O(|R| x |B|) pairwise loop over a
 * REAL range on a REAL board, where blockers actually bite. A trivial "AA beats 72o"
 * check would pass whether or not that logic works.
 */
const selfTest = async ({ bestFiveFromSeven, enumerateCombos, bettorGrid }) => {
  const boards = [
    [12 * 4 + 0, 7 * 4 + 1, 2 * 4 + 2, 5 * 4 + 3],  // As 9h 4d 7c — rainbow
    [12 * 4 + 1, 11 * 4 + 1, 3 * 4 + 1, 9 * 4 + 1], // Ah Kh 5h Jh — four hearts, blockers bite
    [4 * 4 + 0, 4 * 4 + 1, 4 * 4 + 2, 9 * 4 + 3],   // 6s 6h 6d Jc — trips on board
  ];
  const heroes = [[12 * 4 + 1, 12 * 4 + 2], [10 * 4 + 1, 3 * 4 + 0], [8 * 4 + 0, 8 * 4 + 1]];

  let worst = 0, checks = 0;
  for (let bi = 0; bi < boards.length; bi++) {
    const board4 = boards[bi];
    const hero = heroes[bi];
    if (hero.some((h) => board4.includes(h))) continue;
    const range = enumerateCombos(bettorGrid, board4).map((c) => ({ ...c }));
    const used = new Set(board4);
    const deck = [];
    for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c);

    let idxSum = 0, bruteSum = 0, n = 0;
    for (const r of deck) {
      if (hero.includes(r)) continue;
      const board5 = [...board4, r];
      const live = range
        .filter((c) => c.card1 !== r && c.card2 !== r)
        .map((c) => ({ ...c, score: bestFiveFromSeven([c.card1, c.card2, ...board5]) }));
      if (!live.length) continue;
      const hs = bestFiveFromSeven([hero[0], hero[1], ...board5]);

      const viaIndex = equityVs(buildRangeIndex(live), hero[0], hero[1], hs);

      // Independent route: no index, no inclusion-exclusion — filter blockers by hand.
      let w = 0, tot = 0;
      for (const c of live) {
        if (c.card1 === hero[0] || c.card1 === hero[1]
          || c.card2 === hero[0] || c.card2 === hero[1]) continue;
        tot += c.weight;
        w += hs > c.score ? c.weight : hs === c.score ? 0.5 * c.weight : 0;
      }
      if (!tot) continue;
      const viaBrute = w / tot;
      if (viaIndex === null) continue;
      worst = Math.max(worst, Math.abs(viaIndex - viaBrute));
      idxSum += viaIndex; bruteSum += viaBrute; n += 1; checks += 1;
    }
    console.log(`self-test board ${bi}: index=${(idxSum / n).toFixed(6)} `
      + `brute=${(bruteSum / n).toFixed(6)} rivers=${n}`);
  }
  console.log(`self-test: ${checks} comparisons, max abs diff = ${worst.toExponential(2)}`);
  const ok = worst < 1e-9 && checks > 100;
  console.log(`self-test: ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
};

main().catch((e) => { console.error(e); process.exit(1); });
