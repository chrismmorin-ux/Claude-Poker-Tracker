#!/usr/bin/env node
/**
 * hand-class-sweep.mjs — the reproduction harness for a hand-class study.
 *
 * Produces every number in `docs/guides/hand-class-99-TT-JJ.md`, and is the reference
 * implementation of the method in `docs/guides/HAND_CLASS_STUDY_METHOD.md`. It is
 * parameterised by hand class, so studying a different class is a flag, not a rewrite.
 *
 * The whole point is that a hand-class guide should be DERIVED, not authored: every
 * claim in the guide traces to one of the stages below, and re-running this file is how
 * you find out whether the guide is still true after the engine changes.
 *
 * Usage:
 *   node --import ./scripts/utils/register-src-resolver.mjs \
 *        scripts/research/hand-class-sweep.mjs <stage> [--hands 99,TT,JJ] [--trials N]
 *
 *   stage = structure | percentile | parity | runout | priors | pool | boost | equity | evcurve | all
 *
 * DETERMINISM — split by STREET, not by stage, because that is where it actually splits.
 *   - `structure`, `percentile`, `parity`, `runout`, `priors`, `pool`, `boost` are exact
 *     and exactly reproducible.
 *   - `equity` samples via `monteCarloEquity` (unseeded `Math.random`); it reports its CI.
 *   - `evcurve` on a FLOP or TURN board is noisy: `computeComboEquity` calls
 *     `miniRolloutEquity` (gameTreeEquity.js), which runs unseeded 32-sample rollouts.
 *     Measured per-combo 95% run-to-run error is on the order of +/-1.5 chips on a
 *     100-chip pot, which is large relative to the 2-chip neutral-zone epsilon.
 *   - `evcurve` on a RIVER board is exactly reproducible — there is no future street, so
 *     no rollout runs. Its reported sd comes out ~0, which doubles as a self-check.
 *   NOTE: `weightedSample` is deterministic by construction and is NOT the noise source;
 *   an earlier version of this file blamed it, which sent readers looking in the wrong
 *   place. `maxCombos` truncation is a systematic BIAS, not noise, and is disabled here.
 */

import { bestFiveFromSeven, comboStrengthPercentile } from '../../src/utils/pokerCore/handEvaluator.js';
import { handVsRange, handVsRangesMW } from '../../src/utils/pokerCore/monteCarloEquity.js';
import { parseRangeString, PREFLOP_CHARTS, rangeWidth, rangeIndex } from '../../src/utils/pokerCore/rangeMatrix.js';
import { EQUITY_VS_OPEN, HAND_LABELS } from '../../src/utils/pokerCore/preflopEquityTable.js';
import { getPopulationPrior } from '../../src/utils/rangeEngine/populationPriors.js';
import { analyzeBoardTexture } from '../../src/utils/pokerCore/boardTexture.js';
import { computePerComboEV, computePerComboCheckEV } from '../../src/utils/exploitEngine/gameTreeDepth2.js';
import { createBoardCache } from '../../src/utils/exploitEngine/gameTreeSampling.js';
import { HANDHQ_REFERENCE_STAKES, HANDHQ_REFERENCE_META } from '../../src/utils/exploitEngine/handhqReferencePool.js';

// ---------------------------------------------------------------- args + helpers

const argv = process.argv.slice(2);
const stage = argv[0] ?? 'all';
const argValue = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] != null ? argv[i + 1] : fallback;
};
const TRIALS = Number(argValue('--trials', 120000));
const HANDS = argValue('--hands', '99,TT,JJ').split(',');
const REPEAT = Math.max(1, Number(argValue('--repeat', 3)));
/** Reference hands always carried alongside, so the class is read against a scale. */
const REFERENCE = ['QQ', 'AA'];

const RANKC = '23456789TJQKA';
const SUITC = ['s', 'h', 'd', 'c'];
const enc = (s) => RANKC.indexOf(s[0]) * 4 + SUITC.indexOf(s[1]);
const dec = (c) => RANKC[c >> 2] + SUITC[c & 3];
const pairRank = (label) => RANKC.indexOf(label[0]);
const comb = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return Math.round(r); };
const tsv = (...cells) => console.log(cells.join('\t'));
const heroCombo = (rank, dead = []) => {
  const used = new Set(dead);
  const out = [];
  for (let s = 0; s < 4 && out.length < 2; s++) if (!used.has(rank * 4 + s)) out.push(rank * 4 + s);
  // A silent 1-card return propagates `undefined` into the evaluators, where `c >> 2`
  // yields NaN, every comparison fails, and the sweep reports a plausible wrong number
  // instead of crashing. Same failure shape as the 5-card/7-card evaluator divergence.
  if (out.length < 2) {
    throw new Error(`heroCombo: rank ${RANKC[rank]} has fewer than 2 live cards against the given dead cards`);
  }
  return out;
};

// =============================================================== stage: structure

/** Exhaustive C(50,3) flop enumeration. Exact — no sampling anywhere in this stage. */
const runStructure = () => {
  console.log('=== STRUCTURE — exact enumeration of all 19,600 flops ===');
  tsv('hand', '0-over%', '1-over%', '2-over%', '3-over%', 'set-flop%', 'paired-board%',
    'setByTurn%', 'setByRiver%', 'noOverByTurn%', 'noOverByRiver%');
  for (const label of [...HANDS, ...REFERENCE]) {
    const pr = pairRank(label);
    const deck = [];
    for (let c = 0; c < 52; c++) if (!((c >> 2) === pr && (c & 3) < 2)) deck.push(c);

    let total = 0, setFlop = 0, paired = 0;
    const over = [0, 0, 0, 0];
    for (let i = 0; i < 50; i++) for (let j = i + 1; j < 50; j++) for (let k = j + 1; k < 50; k++) {
      total++;
      const r = [deck[i] >> 2, deck[j] >> 2, deck[k] >> 2];
      over[r.filter((x) => x > pr).length]++;
      if (r.includes(pr)) setFlop++;
      if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) paired++;
    }
    const pNoSet = (n) => comb(48, n) / comb(50, n);
    const safe = 50 - (12 - pr) * 4;      // non-overcards left in the 50-card deck
    const pNoOver = (n) => comb(safe, n) / comb(50, n);
    const p = (x) => (100 * x / total).toFixed(2);
    tsv(label, p(over[0]), p(over[1]), p(over[2]), p(over[3]), p(setFlop), p(paired),
      (100 * (1 - pNoSet(4))).toFixed(2), (100 * (1 - pNoSet(5))).toFixed(2),
      (100 * pNoOver(4)).toFixed(2), (100 * pNoOver(5)).toFixed(2));
  }
};

// ================================================================== stage: equity

const VILLAIN_RANGES = () => ({
  'UTG open (GTO chart)': PREFLOP_CHARTS.UTG,
  'CO open (GTO chart)': PREFLOP_CHARTS.CO,
  'BTN open (GTO chart)': PREFLOP_CHARTS.BTN,
  'BB defend (GTO chart)': PREFLOP_CHARTS.BB,
  'Narrow 3bet (QQ+,AK)': parseRangeString('QQ+,AKs,AKo'),
  'Reg 3bet linear': parseRangeString('TT+,AQs+,AJs,AKo,KQs'),
  'Reg 3bet polar': parseRangeString('QQ+,AKs,AKo,A5s,A4s,76s,65s'),
  '4bet tight (KK+,AKs)': parseRangeString('KK+,AKs'),
  '4bet wide (JJ+,AQs+,AKo,A5s)': parseRangeString('JJ+,AQs+,AKo,A5s'),
  'Live limp/call (loose-passive)': parseRangeString('22+,A2s+,K2s+,Q4s+,J6s+,T6s+,95s+,85s+,74s+,64s+,53s+,43s,A2o+,K7o+,Q8o+,J8o+,T8o+,97o+,86o+,76o,65o'),
  'Live cold-caller of an open': parseRangeString('22+,A2s+,K8s+,Q9s+,J9s+,T8s+,97s+,86s+,76s,65s,54s,A9o+,KTo+,QTo+,JTo'),
});

const runEquity = async () => {
  const all = [...HANDS, ...REFERENCE];

  console.log('=== EQUITY 1 — committed EQUITY_VS_OPEN table (vs the POPULATION open prior) ===');
  console.log('NOTE: the denominator is getPopulationPrior(pos, "open"), which carries WS-302');
  console.log('support on all 169 cells — a WIDER range than PREFLOP_CHARTS. Values differ from');
  console.log('EQUITY 2 for that reason; they are not two estimates of one quantity.');
  const idx = {};
  HAND_LABELS.forEach((l, i) => { idx[l] = i; });
  tsv('hand', ...Object.keys(EQUITY_VS_OPEN));
  for (const h of [...all, 'AKs', 'AKo', '88', '77']) {
    if (idx[h] == null) continue;
    tsv(h, ...Object.values(EQUITY_VS_OPEN).map((a) => (a[idx[h]] / 100).toFixed(2)));
  }

  console.log(`\n=== EQUITY 2 — hand vs constructed range, Monte Carlo @ ${TRIALS} trials ===`);
  // Narrow ranges are re-run REPEAT times and reported as mean +/- across-run half-range,
  // because that is exactly where a class's members sit inside one CI of each other and an
  // ordering read off a single run is a coin flip. Wide ranges separate far outside the CI
  // and one run is enough; the repeat budget is spent where it changes a conclusion.
  const NARROW_PCT = 10;
  tsv('range', 'width%', 'runs', ...all);
  for (const [name, r] of Object.entries(VILLAIN_RANGES())) {
    const width = rangeWidth(r);
    const reps = width <= NARROW_PCT ? REPEAT : 1;
    const cells = [];
    for (const h of all) {
      const draws = [];
      for (let rep = 0; rep < reps; rep++) {
        const res = await handVsRange(heroCombo(pairRank(h)), r, [], { trials: TRIALS, batchSize: 20000 });
        draws.push(100 * res.equity);
      }
      const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
      const spread = reps > 1 ? (Math.max(...draws) - Math.min(...draws)) / 2 : null;
      cells.push(mean.toFixed(1) + (spread === null ? '' : '±' + spread.toFixed(1)));
    }
    tsv(name, width, reps, ...cells);
  }

  console.log('\n=== EQUITY 3 — multiway (true N-way Monte Carlo, not per-villain composition) ===');
  for (const [label, key] of [['loose-passive', 'Live limp/call (loose-passive)'], ['cold-caller', 'Live cold-caller of an open']]) {
    const rng = VILLAIN_RANGES()[key];
    console.log(`-- every opponent on a ${label} range --`);
    tsv('hand', 'HU', '3-way', '4-way', '5-way');
    for (const h of all) {
      const cells = [];
      for (const n of [1, 2, 3, 4]) {
        const res = await handVsRangesMW(heroCombo(pairRank(h)), Array.from({ length: n }, () => rng), [], { trials: TRIALS, batchSize: 20000 });
        // CI is printed, not dropped: multiway has more combos to converge than heads-up
        // and is the least-checked number in a study like this.
        cells.push((100 * res.equity).toFixed(1) + '±' + (100 * res.ciHalf).toFixed(1));
      }
      tsv(h, ...cells);
    }
  }
};

// ============================================================== stage: percentile

/**
 * Board-conditional strength percentile (POKER_THEORY §15).
 *
 * This calls the SHIPPED primitive directly. An earlier version of this harness carried a
 * local "fast path" plus a run-time equivalence assertion; the assertion was a tautology —
 * `bestFiveFromSeven` delegates to `evaluate5` for 5-card inputs, so the two paths were the
 * same function — and the local copy was measurably slower and lacked the shipped guards.
 * A check that cannot fail is worse than no check, because it reads as coverage.
 */
const percentile = (hero, board) => comboStrengthPercentile(hero[0], hero[1], board);

const summarize = (arr) => {
  const s = [...arr].sort((x, y) => x - y);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {
    mean: (s.reduce((a, b) => a + b, 0) / s.length).toFixed(2),
    p10: q(0.10).toFixed(1), p25: q(0.25).toFixed(1), median: q(0.50).toFixed(1), p90: q(0.90).toFixed(1),
    above95: (100 * s.filter((v) => v >= 95).length / s.length).toFixed(1),
    below85: (100 * s.filter((v) => v < 85).length / s.length).toFixed(1),
    below75: (100 * s.filter((v) => v < 75).length / s.length).toFixed(1),
  };
};

const runPercentile = () => {
  console.log('=== PERCENTILE — flop percentile over ALL 19,600 flops (exhaustive) ===');
  const results = {};
  tsv('hand', 'mean', 'p10', 'p25', 'median', 'p90', '%>=95', '%<85', '%<75');
  for (const label of [...HANDS, ...REFERENCE]) {
    const pr = pairRank(label);
    const hero = [pr * 4 + 0, pr * 4 + 1];
    const deck = [];
    for (let c = 0; c < 52; c++) if (c !== hero[0] && c !== hero[1]) deck.push(c);
    const all = [], byOver = { 0: [], 1: [], 2: [], 3: [] }, set = [], noSet = [];
    for (let i = 0; i < 50; i++) for (let j = i + 1; j < 50; j++) for (let k = j + 1; k < 50; k++) {
      const board = [deck[i], deck[j], deck[k]];
      const p = percentile(hero, board);
      all.push(p);
      const r = board.map((c) => c >> 2);
      byOver[r.filter((x) => x > pr).length].push(p);
      (r.includes(pr) ? set : noSet).push(p);
    }
    results[label] = { byOver, set, noSet };
    const s = summarize(all);
    tsv(label, s.mean, s.p10, s.p25, s.median, s.p90, s.above95, s.below85, s.below75);
    // The doc quotes a "mass point" for hands with a heavy modal percentile; report it
    // rather than inferring it from a neighbouring bucket.
    const counts = new Map();
    for (const v of all) counts.set(v.toFixed(3), (counts.get(v.toFixed(3)) ?? 0) + 1);
    const [modeVal, modeN] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    console.log(`    modal percentile ${modeVal}: ${modeN} flops (${(100 * modeN / all.length).toFixed(2)}%)`);
  }

  console.log('\n-- conditional on overcard count --');
  tsv('hand', 'overcards', 'share%', 'mean', 'median', '%>=95', '%<85');
  for (const [label, r] of Object.entries(results)) {
    for (const o of [0, 1, 2, 3]) {
      if (!r.byOver[o].length) continue;
      const s = summarize(r.byOver[o]);
      tsv(label, o, (100 * r.byOver[o].length / 19600).toFixed(1), s.mean, s.median, s.above95, s.below85);
    }
  }

  console.log('\n-- set vs no-set (the bimodality) --');
  tsv('hand', 'branch', 'share%', 'mean', 'median', 'p10', 'p90');
  for (const [label, r] of Object.entries(results)) {
    for (const [branch, arr] of [['set/quads', r.set], ['no set', r.noSet]]) {
      const s = summarize(arr);
      tsv(label, branch, (100 * arr.length / 19600).toFixed(2), s.mean, s.median, s.p10, s.p90);
    }
  }
};

// ================================================================== stage: parity

/**
 * How close together are the members of the class ON THE SAME BOARD?
 *
 * The per-hand sweeps in `percentile` each enumerate a slightly different board set
 * (each hand removes its own two cards), so they support statements about
 * DISTRIBUTIONS and not about individual boards. This stage fixes that: it enumerates
 * only boards live for EVERY studied hand, then reports the max pairwise percentile
 * gap per board — which is the quantity a claim like "they are the same hand on this
 * board" actually needs.
 *
 * Split by top-card rank, and by whether any member makes a set, because those are the
 * two conditions under which the class is expected to separate.
 */
const runParity = () => {
  const ranks = HANDS.map(pairRank);
  const heroCards = {};
  for (const r of ranks) heroCards[r] = [r * 4 + 0, r * 4 + 1];
  const blocked = new Set(Object.values(heroCards).flat());
  const deck = [];
  for (let c = 0; c < 52; c++) if (!blocked.has(c)) deck.push(c);

  console.log('=== PARITY — max pairwise percentile gap within the class, ON THE SAME BOARD ===');
  console.log(`Boards enumerated: C(${deck.length},3) — only flops live for every member of `
    + `{${HANDS.join(', ')}}, so all members are scored on an identical board set.`);

  const rows = [];
  for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) for (let k = j + 1; k < deck.length; k++) {
    const board = [deck[i], deck[j], deck[k]];
    const bRanks = board.map((c) => c >> 2);
    const anySet = ranks.some((r) => bRanks.includes(r));
    const ps = ranks.map((r) => percentile(heroCards[r], board));
    rows.push({ gap: Math.max(...ps) - Math.min(...ps), top: Math.max(...bRanks), anySet });
  }

  const report = (label, subset) => {
    if (!subset.length) return;
    const g = subset.map((r) => r.gap).sort((a, b) => a - b);
    const q = (p) => g[Math.min(g.length - 1, Math.floor(p * g.length))];
    tsv(label, subset.length, (100 * subset.length / rows.length).toFixed(1),
      (g.reduce((a, b) => a + b, 0) / g.length).toFixed(2), q(0.5).toFixed(2), q(0.95).toFixed(2), g[g.length - 1].toFixed(2));
  };

  tsv('slice', 'boards', 'share%', 'meanGap', 'medianGap', 'p95Gap', 'maxGap');
  report('ALL boards', rows);
  report('no member makes a set', rows.filter((r) => !r.anySet));
  report('some member makes a set', rows.filter((r) => r.anySet));
  console.log('-- no member makes a set, by top board card --');
  for (let t = 12; t >= 0; t--) {
    report(`top card = ${RANKC[t]}`, rows.filter((r) => !r.anySet && r.top === t));
  }
  const highNoSet = rows.filter((r) => !r.anySet && r.top >= RANKC.indexOf('Q'));
  report('no set AND top card >= Q', highNoSet);
};

// ================================================================= stage: evcurve

/**
 * POKER_THEORY §15.2 — the EV-vs-percentile curve and the MEASURED neutral zone.
 * §15.2 notes the pieces exist and "have simply never been joined". This joins them.
 */
const EV_BOARDS = {
  'FLOP  8h 5s 2d   (class is an overpair, dry rainbow)': ['8h', '5s', '2d'],
  'FLOP  Kd 8s 3c   (class is an underpair, dry rainbow)': ['Kd', '8s', '3c'],
  'FLOP  Jh 9s 4d   (class straddles the top card)': ['Jh', '9s', '4d'],
  'FLOP  9h 8h 5s   (WET — connected two-tone)': ['9h', '8h', '5s'],
  'FLOP  8s 8d 3c   (PAIRED)': ['8s', '8d', '3c'],
  'RIVER Kd 8s 3c 7h 2s  (dry flop, blank runout — §12 fully corrected)': ['Kd', '8s', '3c', '7h', '2s'],
  'RIVER 8h 5s 2d Qc 4h  (overpair flop that ran out)': ['8h', '5s', '2d', 'Qc', '4h'],
  'RIVER 9h 8h 5s 2h Qd  (WET flop, flush completed)': ['9h', '8h', '5s', '2h', 'Qd'],
};

const runEvCurve = () => {
  const POT = 100, BET = 66, EPS = 0.02 * POT;
  const HOLDING_REPEATS = Math.max(REPEAT, 25);
  const villains = {
    'live cold-caller': VILLAIN_RANGES()['Live cold-caller of an open'],
    'BB defend (wide)': VILLAIN_RANGES()['BB defend (GTO chart)'],
  };

  // Call the depth-2 primitives the way production calls them. Without a cache every
  // villain combo classifies as {bucket:'marginal', drawOuts:0} and villainDrawPct is
  // hard-gated to 0 — a branch no real call site takes. maxCombos:150 truncates the
  // ~270-290-combo ranges used here, which is a systematic bias, not noise.
  const evalPair = (hero, board, vRange, texture, cache) => {
    const heroScore = bestFiveFromSeven([...hero, ...board]);
    const opts = { boardTexture: texture, cache, maxCombos: 1326 };
    return computePerComboEV(hero, board, vRange, heroScore, POT, BET, opts)
      - computePerComboCheckEV({ heroCards: hero, newBoard: board, villainRange: vRange,
        heroScore, pot: POT, boardTexture: texture, cache, maxCombos: 1326 });
  };

  for (const [bLabel, bStr] of Object.entries(EV_BOARDS)) {
    const board = bStr.map(enc);
    const texture = analyzeBoardTexture(board);
    // ONE cache per board, per the primitive's own documented usage. Its keys are
    // (villain combo, board) — hero's cards are not part of the key and nothing it stores
    // depends on them, so sharing it across hero holdings is correct, not a shortcut.
    const cache = createBoardCache();
    for (const [vLabel, vRange] of Object.entries(villains)) {
      console.log(`\n######## ${bLabel}  vs ${vLabel}  (pot ${POT}, bet ${BET})`);
      const pts = [];
      const bs = new Set(board);
      for (let a = 0; a < 52; a++) {
        if (bs.has(a)) continue;
        for (let b = a + 1; b < 52; b++) {
          if (bs.has(b)) continue;
          const hero = [a, b];
          pts.push({ hero, p: percentile(hero, board), d: evalPair(hero, board, vRange, texture, cache) });
        }
      }
      pts.sort((x, y) => x.p - y.p);

      // Decile table. Each band averages ~110 combos, so per-band noise is ~1/10th of the
      // per-combo noise measured below — this table is the reliable read of the curve.
      tsv('pctile-band', 'n', 'mean EV(bet)-EV(check)');
      for (let lo = 0; lo < 100; lo += 10) {
        const band = pts.filter((q) => q.p >= lo && q.p < lo + 10);
        if (!band.length) continue;
        const m = band.reduce((s, q) => s + q.d, 0) / band.length;
        tsv(`${lo}-${lo + 10}`, band.length, (m >= 0 ? '+' : '') + m.toFixed(2));
      }

      // NEUTRAL ZONE. The hull is reported for continuity with earlier runs but it is a
      // BAD statistic: a single tie-group of junk combos at the bottom of the board drags
      // the lower endpoint to ~0 and inflates the width several-fold. The IQR of in-zone
      // percentiles, plus the in-zone DENSITY, is what should be compared across boards.
      const inZone = pts.filter((q) => Math.abs(q.d) < EPS);
      if (inZone.length >= 4) {
        const ps = inZone.map((q) => q.p).sort((x, y) => x - y);
        const at = (f) => ps[Math.min(ps.length - 1, Math.floor(f * ps.length))];
        const iqr = at(0.75) - at(0.25);
        console.log(`NEUTRAL ZONE (|Δ| < ${EPS} = 2% pot): `
          + `IQR [${at(0.25).toFixed(1)}, ${at(0.75).toFixed(1)}] = ${iqr.toFixed(1)}pp`
          + `  |  hull [${ps[0].toFixed(1)}, ${ps[ps.length - 1].toFixed(1)}] = ${(ps[ps.length - 1] - ps[0]).toFixed(1)}pp`
          + `  |  density ${inZone.length}/${pts.length} = ${(100 * inZone.length / pts.length).toFixed(1)}%`);
      } else {
        console.log(`NEUTRAL ZONE: ${inZone.length} combos in zone — too few to summarise`);
      }

      // Slope, in chips per percentile point, from the decile means.
      const bandMean = (lo) => {
        const band = pts.filter((q) => q.p >= lo && q.p < lo + 10);
        return band.length ? band.reduce((s, q) => s + q.d, 0) / band.length : null;
      };
      const slope = (lo, hi) => {
        const a = bandMean(lo), b = bandMean(hi);
        return a === null || b === null ? 'n/a' : ((b - a) / (hi - lo)).toFixed(3);
      };
      console.log(`slope 40->60 pctile: ${slope(40, 60)} chips/pp   |   slope 80->90: ${slope(80, 90)} chips/pp`);

      // Per-holding Δ with a REAL error bar. The flop/turn branches route through
      // `miniRolloutEquity` (unseeded Math.random, 32 samples per combo equity), so a
      // single Δ is a draw. River rows have no rollout and reproduce exactly — their sd
      // comes out ~0, which is itself the check that this is measuring the right thing.
      tsv('holding', 'cards', 'pctile', `mean Δ ±1.96sd over ${HOLDING_REPEATS} runs`, 'prefers');
      for (const label of [...HANDS, ...REFERENCE, 'AKo']) {
        const want = label.length === 2 && label[0] === label[1]
          ? [pairRank(label), pairRank(label)]
          : [RANKC.indexOf(label[0]), RANKC.indexOf(label[1])];
        const suited = label.endsWith('s');
        const found = pts.find((q) => {
          const rs = q.hero.map((c) => c >> 2).sort((x, y) => y - x);
          if (rs[0] !== Math.max(...want) || rs[1] !== Math.min(...want)) return false;
          if (want[0] === want[1]) return true;
          return suited === ((q.hero[0] & 3) === (q.hero[1] & 3));
        });
        if (!found) { tsv(label, '(blocked by board)'); continue; }
        const draws = [];
        for (let rep = 0; rep < HOLDING_REPEATS; rep++) {
          draws.push(evalPair(found.hero, board, vRange, texture, cache));
        }
        const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
        const sd = Math.sqrt(draws.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, draws.length - 1));
        const ci = 1.96 * sd;
        // No decision label is printed when the interval cannot separate Δ from ±epsilon.
        const resolved = Math.abs(mean) - ci > EPS;
        const verdict = !resolved ? (Math.abs(mean) + ci < EPS ? 'NEUTRAL' : 'UNRESOLVED') : mean > 0 ? 'BET' : 'CHECK';
        tsv(label, found.hero.map(dec).join(''), found.p.toFixed(1),
          (mean >= 0 ? '+' : '') + mean.toFixed(2) + '±' + ci.toFixed(2), verdict);
      }
    }
  }
};

// ================================================================== stage: runout

/** Percentile decay of the class through a named flop -> turn -> river runout (§5.3). */
const RUNOUTS = [
  ['9h', '5s', '2d', 'Qc', 'Ks'],
  ['8h', '5s', '2d', 'Jc', '4h'],
];

const runRunout = () => {
  console.log('=== RUNOUT — percentile decay through a named board runout ===');
  for (const cards of RUNOUTS) {
    const streets = [cards.slice(0, 3), cards.slice(0, 4), cards.slice(0, 5)];
    console.log(`-- ${cards.slice(0, 3).join(' ')} -> ${cards[3]} -> ${cards[4]} --`);
    tsv('hand', 'flop', 'turn', 'river', 'note');
    for (const label of [...HANDS, ...REFERENCE]) {
      const pr = pairRank(label);
      const madeSet = cards.slice(0, 3).some((c) => enc(c) >> 2 === pr);
      const cells = streets.map((st) => {
        const board = st.map(enc);
        return percentile(heroCombo(pr, board), board).toFixed(1);
      });
      tsv(label, ...cells, madeSet ? 'flopped a set' : 'unimproved');
    }
  }
};

// =================================================================== stage: boost

/**
 * Traces `bayesianUpdater.applyShowdownAnchor`'s flat adjacent-pair boost through
 * `crossRangeConstraints.normalizeAcrossActions`, to settle whether the distortion it
 * introduces survives normalisation.
 *
 * It does. `normalizeScenario` loops per GRID CELL and normalises across ACTIONS at that
 * cell; nothing in the pipeline compares cell i to cell j. A distortion that lives on the
 * rank axis therefore has no normalisation path that could remove it.
 */
const runBoost = async () => {
  const { normalizeAcrossActions } = await import('../../src/utils/rangeEngine/crossRangeConstraints.js');
  const ACTIONS = ['fold', 'limp', 'open', 'coldCall', 'threeBet',
    'openFirstIn', 'isoRaise', 'cold3Bet', 'squeeze', 'limpReraise'];
  const ADJ_PAIR_BOOST_UNKNOWN = 0.20;   // bayesianUpdater.js — outcome === null

  console.log('=== BOOST — flat adjacent-pair anchor boost, traced through normalisation ===');
  console.log(`Scenario: one showdown reveals ${HANDS[1]} in the 3-bet range, outcome unknown.`);
  console.log(`applyShowdownAnchor sets it to 1.0 and adds a FLAT +${ADJ_PAIR_BOOST_UNKNOWN} to both neighbours.\n`);

  const idxOf = (label) => rangeIndex(pairRank(label), pairRank(label), false);
  const line = (tag, r) => tsv(tag, ...HANDS.map((h) => `${h} 3bet=${r.threeBet[idxOf(h)].toFixed(4)} call=${r.coldCall[idxOf(h)].toFixed(4)}`),
    `ratio(${HANDS[2]}:${HANDS[0]} 3bet)=${(r.threeBet[idxOf(HANDS[2])] / r.threeBet[idxOf(HANDS[0])]).toFixed(2)}x`);

  for (const pos of ['EARLY', 'LATE']) {
    console.log(`-- ${pos} --`);
    const ranges = {};
    for (const a of ACTIONS) ranges[a] = getPopulationPrior(pos, a);
    normalizeAcrossActions(ranges);
    line('before anchor  ', ranges);
    ranges.threeBet[idxOf(HANDS[1])] = 1.0;
    for (const nb of [HANDS[0], HANDS[2]]) {
      ranges.threeBet[idxOf(nb)] = Math.min(1, ranges.threeBet[idxOf(nb)] + ADJ_PAIR_BOOST_UNKNOWN);
    }
    line('after boost    ', ranges);
    normalizeAcrossActions(ranges);
    line('after normalize', ranges);
  }
};

// ========================================================================== main

const main = async () => {
  if (stage === 'structure' || stage === 'all') runStructure();
  if (stage === 'percentile' || stage === 'all') { console.log(); runPercentile(); }
  if (stage === 'runout' || stage === 'all') { console.log(); runRunout(); }
  if (stage === 'parity' || stage === 'all') { console.log(); runParity(); }
  if (stage === 'priors' || stage === 'all') { console.log(); runPriors(); }
  if (stage === 'pool' || stage === 'all') { console.log(); runPool(); }
  if (stage === 'boost' || stage === 'all') { console.log(); await runBoost(); }
  if (stage === 'equity' || stage === 'all') { console.log(); await runEquity(); }
  if (stage === 'evcurve' || stage === 'all') { console.log(); runEvCurve(); }
};

// NOT `process.exit(0)`. When stdout is a pipe or a file, console.log writes are
// asynchronous, and exiting explicitly discards whatever is still buffered — a full
// `evcurve` run silently truncated to its first header line that way. Set the exit code
// and let the event loop drain instead.
main().then(
  () => { process.exitCode = 0; },
  (err) => { console.error(err); process.exitCode = 1; },
).catch((err) => { console.error(err); process.exitCode = 1; });
