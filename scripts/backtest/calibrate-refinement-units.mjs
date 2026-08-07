#!/usr/bin/env node
/**
 * calibrate-refinement-units.mjs — measure the constants of the logical refinement clock
 * (WS-432, design §3).
 *
 * The clock's semantics live in `src/utils/exploitEngine/refinementWork.js`; this script
 * measures the two PLACEHOLDER constants there and prints replacements:
 *
 *   PHASE A — COMBO_EVAL_COST. Per-board-length cost of ONE villain-combo evaluation, in
 *   microseconds, measured by timing `computePerComboEV` / `computePerComboCheckEV` over a
 *   known sampled-combo count and taking the MEDIAN across scenarios and repetitions
 *   (median, not mean — GC pauses and JIT warmup live in the tail). The three board
 *   lengths do very different arithmetic per combo (flop mini-rollout / turn river
 *   enumeration / river exact comparison), which is why the cost table is keyed by length.
 *
 *   PHASE B — REFINEMENT_UNITS_PER_MS. Run the dumpGameTreeEV scenario battery through
 *   `evaluateGameTree` at an EFFECTIVELY UNBOUNDED budget and take
 *   sum(unitsUsed) / sum(refinement wall ms). That anchors "N ms of budget" to "the work
 *   this machine does in N ms", so the shipped `refinementBudgetMs: 2000` keeps its
 *   real-device meaning while becoming deterministic. Refinement wall ms is
 *   `latency.totalMs - latency.preRefinementMs` — the budget never covered context
 *   building (WS-334) and the calibration must not either.
 *
 * BARE NODE IMPORTS, no Vite loader — the engine closure is bare-loadable (WS-433) and
 * this script is part of what keeps that property exercised. No clock or RNG patching:
 * the engine's production code never reads a patched clock any more (that is the point of
 * WS-432), and Phase A/B are timing measurements, not comparative claims.
 *
 * Verification protocol after adopting new constants (design §3): re-run the pinned slice
 * at logical-2000ms and compare the depthReached histogram + partial shares against the
 * wall-2000ms baseline; adjust REFINEMENT_UNITS_PER_MS only.
 *
 * USAGE
 *   node scripts/backtest/calibrate-refinement-units.mjs            # full battery
 *   node scripts/backtest/calibrate-refinement-units.mjs --smoke    # 2 scenarios, quick
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

import { evaluateGameTree } from '../../src/utils/exploitEngine/gameTreeEvaluator.js';
import {
  computePerComboEV, computePerComboCheckEV,
} from '../../src/utils/exploitEngine/gameTreeDepth2.js';
import {
  REFINEMENT_CLOCK_VERSION, REFINEMENT_UNITS_PER_MS, COMBO_EVAL_COST, MAX_STAGE_SHARE,
} from '../../src/utils/exploitEngine/refinementWork.js';
import { createBoardCache, weightedSample } from '../../src/utils/exploitEngine/gameTreeSampling.js';
import { createRange, parseRangeString, enumerateCombos } from '../../src/utils/pokerCore/rangeMatrix.js';
import { bestFiveFromSeven } from '../../src/utils/pokerCore/handEvaluator.js';
import { parseAndEncode } from '../../src/utils/pokerCore/cardParser.js';

const SMOKE = process.argv.includes('--smoke');
const OUT_DOC = 'docs/standard-of-record/REFINEMENT-CLOCK-CALIBRATION.md';

const cards = (...strs) => {
  const encoded = strs.map(parseAndEncode);
  const bad = strs.filter((_, i) => encoded[i] < 0);
  if (bad.length) throw new Error(`unparseable card(s): ${bad.join(', ')} — suits must be ♠♥♦♣`);
  return encoded;
};

// Ranges inline via parseRangeString — the shared test fixture
// (`__tests__/fixtures/ranges.js`) uses extensionless imports and is not bare-loadable.
const fullRange = () => { const r = createRange(); r.fill(1.0); return r; };
const tightRange = () => parseRangeString('AA,KK,QQ,JJ,TT,AKs,AKo,AQs,AQo');
const wideRange = () => parseRangeString(
  'AA,KK,QQ,JJ,TT,99,88,77,66,55,AKs,AKo,AQs,AQo,AJs,AJo,ATs,KQs,KQo,KJs,QJs,JTs,T9s,98s,87s,76s,A9s,A8s,A5s,A4s',
);

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// ── Phase A — per-board-length combo-eval cost ─────────────────────────────────────────

const PHASE_A_BOARDS = [
  { len: 3, board: cards('J♥', 'T♥', '9♦'), hero: cards('A♥', 'A♦') },
  { len: 3, board: cards('A♠', '7♥', '2♦'), hero: cards('K♦', 'Q♦') },
  { len: 4, board: cards('J♥', 'T♥', '9♦', '2♥'), hero: cards('A♥', 'J♠') },
  { len: 4, board: cards('A♠', '7♥', '2♦', '9♣'), hero: cards('K♦', 'Q♦') },
  { len: 5, board: cards('J♥', 'T♥', '9♦', '2♥', '5♥'), hero: cards('A♦', 'J♠') },
  { len: 5, board: cards('A♠', '7♥', '2♦', '9♣', '4♠'), hero: cards('K♦', 'Q♦') },
];

const phaseA = () => {
  const reps = SMOKE ? 3 : 12;
  const perLen = { 3: [], 4: [], 5: [] };
  const rows = [];

  for (const { len, board, hero } of PHASE_A_BOARDS) {
    if (SMOKE && rows.length >= 2 && perLen[len].length > 0) continue;
    const range = fullRange();
    const dead = [...hero, ...board];
    const sampled = weightedSample(enumerateCombos(range, dead), 150);
    const heroScore = bestFiveFromSeven([...hero, ...board]);
    const cache = createBoardCache();

    // Warm the JIT and the board cache once, unmeasured.
    computePerComboEV(hero, board, range, heroScore, 100, 66, { maxCombos: 150, cache });
    computePerComboCheckEV({ heroCards: hero, newBoard: board, villainRange: range, heroScore, pot: 100, maxCombos: 150, cache });

    const samples = [];
    for (let r = 0; r < reps; r++) {
      let t0 = performance.now();
      computePerComboEV(hero, board, range, heroScore, 100, 66, { maxCombos: 150, cache });
      samples.push(((performance.now() - t0) * 1000) / sampled.length);
      t0 = performance.now();
      computePerComboCheckEV({ heroCards: hero, newBoard: board, villainRange: range, heroScore, pot: 100, maxCombos: 150, cache });
      samples.push(((performance.now() - t0) * 1000) / sampled.length);
    }
    const med = median(samples);
    perLen[len].push(med);
    rows.push({ len, board: board.length, combos: sampled.length, usPerCombo: med });
  }

  const measured = {};
  for (const len of [3, 4, 5]) {
    if (perLen[len].length) measured[len] = Math.max(1, Math.round(median(perLen[len])));
  }
  return { rows, measured };
};

// ── Phase B — units per millisecond at an effectively unbounded budget ─────────────────

// The dumpGameTreeEV scenario battery (WS-386 street-coverage set), replicated here with
// inline ranges. Same spots, so the calibration weights streets the way the regression
// instrument does.
const SCENARIOS = [
  { name: 'flop-dry-noaction-tight', board: cards('A♠', '7♥', '2♦'), hero: cards('K♦', 'Q♦'),
    range: tightRange, villainAction: null, villainBet: 0, pot: 100, stack: 900 },
  { name: 'flop-dry-facing-bet-tight', board: cards('A♠', '7♥', '2♦'), hero: cards('K♦', 'Q♦'),
    range: tightRange, villainAction: 'bet', villainBet: 65, pot: 100, stack: 900 },
  { name: 'flop-wet-noaction-wide', board: cards('J♥', 'T♥', '9♦'), hero: cards('A♣', 'A♦'),
    range: wideRange, villainAction: null, villainBet: 0, pot: 120, stack: 800 },
  { name: 'flop-wet-facing-bet-wide', board: cards('J♥', 'T♥', '9♦'), hero: cards('Q♠', 'Q♣'),
    range: wideRange, villainAction: 'bet', villainBet: 80, pot: 120, stack: 800 },
  { name: 'flop-wet-facing-raise-full', board: cards('J♥', 'T♥', '9♦'), hero: cards('K♥', 'Q♥'),
    range: fullRange, villainAction: 'raise', villainBet: 150, pot: 200, stack: 700 },
  { name: 'turn-noaction-wide', board: cards('A♠', '7♥', '2♦', '9♣'), hero: cards('A♥', 'K♣'),
    range: wideRange, villainAction: null, villainBet: 0, pot: 200, stack: 600 },
  { name: 'turn-facing-bet-tight', board: cards('A♠', '7♥', '2♦', '9♣'), hero: cards('7♠', '7♦'),
    range: tightRange, villainAction: 'bet', villainBet: 120, pot: 200, stack: 600 },
  { name: 'turn-wet-facing-bet-full', board: cards('J♥', 'T♥', '9♦', '2♥'), hero: cards('A♥', 'J♠'),
    range: fullRange, villainAction: 'bet', villainBet: 140, pot: 260, stack: 540 },
  { name: 'river-dry-noaction-wide', board: cards('A♠', '7♥', '2♦', '9♣', '4♠'), hero: cards('A♥', 'K♣'),
    range: wideRange, villainAction: null, villainBet: 0, pot: 260, stack: 500 },
  { name: 'river-dry-facing-bet-tight', board: cards('A♠', '7♥', '2♦', '9♣', '4♠'), hero: cards('7♠', '7♦'),
    range: tightRange, villainAction: 'bet', villainBet: 160, pot: 260, stack: 500 },
  { name: 'river-wet-noaction-full', board: cards('J♥', 'T♥', '9♦', '2♥', '5♥'), hero: cards('A♥', 'J♠'),
    range: fullRange, villainAction: null, villainBet: 0, pot: 300, stack: 460 },
  { name: 'river-paired-facing-bet-full', board: cards('J♥', 'T♥', '9♦', '9♠', '3♣'), hero: cards('K♥', 'Q♥'),
    range: fullRange, villainAction: 'bet', villainBet: 180, pot: 300, stack: 460 },
];

const UNBOUNDED_MS = 3_600_000; // one hour of budget — no battery scenario approaches it

const phaseB = async () => {
  const battery = SMOKE ? SCENARIOS.slice(0, 2) : SCENARIOS;
  const rows = [];
  let totalUnits = 0;
  let totalRefinementMs = 0;

  for (const s of battery) {
    const t0 = performance.now();
    // eslint-disable-next-line no-await-in-loop -- the engine call IS the measurement
    const result = await evaluateGameTree({
      villainRange: s.range(),
      board: s.board,
      heroCards: s.hero,
      potSize: s.pot,
      villainAction: s.villainAction,
      villainBet: s.villainBet,
      effectiveStack: s.stack,
      playerStats: { style: 'TAG', vpip: 22, pfr: 18, af: 2.5, cbet: 60 },
      villainModel: null,
      contextHints: { isIP: true, texture: 'unknown', posCategory: 'LATE' },
      trials: 200,
      refinementBudgetMs: UNBOUNDED_MS,
    });
    const wallMs = performance.now() - t0;
    const tm = result.treeMetadata;
    const refinementMs = Math.max(1, (tm.latency?.totalMs ?? wallMs) - (tm.latency?.preRefinementMs ?? 0));
    const units = tm.unitsUsed ?? 0;
    totalUnits += units;
    totalRefinementMs += refinementMs;
    rows.push({
      name: s.name,
      units,
      refinementMs: Math.round(refinementMs),
      unitsPerMs: Math.round(units / refinementMs),
      depthReached: tm.depthReached,
      budgetBound: tm.budgetBound,
    });
  }

  return {
    rows,
    unitsPerMs: totalUnits > 0 ? Math.max(1, Math.round(totalUnits / totalRefinementMs)) : null,
    totalUnits,
    totalRefinementMs: Math.round(totalRefinementMs),
  };
};

// ── report + doc skeleton ──────────────────────────────────────────────────────────────

const main = async () => {
  console.log(`refinement-clock calibration (${REFINEMENT_CLOCK_VERSION})${SMOKE ? ' — SMOKE (2 scenarios, few reps; numbers are indicative only)' : ''}\n`);

  console.log('PHASE A — combo-eval cost (µs per sampled villain combo)');
  const a = phaseA();
  for (const r of a.rows) {
    console.log(`  board len ${r.len}  combos ${String(r.combos).padStart(3)}  median ${r.usPerCombo.toFixed(2)} µs/combo`);
  }
  console.log(`  measured COMBO_EVAL_COST:  ${JSON.stringify(a.measured)}`);
  console.log(`  shipped  COMBO_EVAL_COST:  ${JSON.stringify(COMBO_EVAL_COST)} (PLACEHOLDER until this script's full run replaces it)\n`);

  console.log('PHASE B — units per ms at an effectively unbounded budget (dumpGameTreeEV battery)');
  const b = await phaseB();
  console.log('  scenario                              units    refineMs   units/ms  depth  bound');
  for (const r of b.rows) {
    console.log(`  ${r.name.padEnd(34)} ${String(r.units).padStart(9)} ${String(r.refinementMs).padStart(8)} ${String(r.unitsPerMs).padStart(9)}      ${r.depthReached}  ${r.budgetBound}`);
  }
  console.log(`  measured REFINEMENT_UNITS_PER_MS:  ${b.unitsPerMs}  (total ${b.totalUnits} units / ${b.totalRefinementMs} ms)`);
  console.log(`  shipped  REFINEMENT_UNITS_PER_MS:  ${REFINEMENT_UNITS_PER_MS} (PLACEHOLDER)\n`);

  console.log('To adopt: replace the PLACEHOLDER values in src/utils/exploitEngine/refinementWork.js');
  console.log('with the measured ones from a FULL (non-smoke) run on the reference machine, then run');
  console.log('the §3 verification: depthReached histogram + partial shares at logical-2000ms vs the');
  console.log('wall-2000ms baseline on the pinned slice. Adjust REFINEMENT_UNITS_PER_MS only.');

  // Doc skeleton — full runs only, and only when absent. A smoke run must neither write
  // indicative numbers into the record NOR occupy the path the real run would refuse to
  // overwrite.
  if (SMOKE) {
    console.log(`\n(smoke run — ${OUT_DOC} not written)`);
    return;
  }
  if (!existsSync(OUT_DOC)) {
    mkdirSync(dirname(OUT_DOC), { recursive: true });
    writeFileSync(OUT_DOC, [
      '# Refinement clock calibration — ' + REFINEMENT_CLOCK_VERSION,
      '',
      '> SKELETON written by `scripts/backtest/calibrate-refinement-units.mjs`' + (SMOKE ? ' (--smoke — numbers below are indicative, NOT calibration)' : '') + '.',
      '> A full run on the reference machine fills this in; the adopted constants live in',
      '> `src/utils/exploitEngine/refinementWork.js` and are frozen as part of the clock version.',
      '',
      '## What the constants mean',
      '',
      '- `COMBO_EVAL_COST[boardLen]` — work units charged per sampled villain combo, ~µs of',
      '  combo-evaluation work on the reference machine at calibration time.',
      '- `REFINEMENT_UNITS_PER_MS` — converts `refinementBudgetMs` to a unit budget, so the',
      '  shipped 2000 ms keeps its real-device meaning while becoming deterministic.',
      `- \`MAX_STAGE_SHARE\` = ${MAX_STAGE_SHARE} (DEC-036 cap-not-reserve; not calibrated here).`,
      '',
      '## Machine',
      '',
      '- reference machine: _(fill in: CPU, RAM, OS, Node version, date)_',
      '',
      '## Phase A — per-board-length combo-eval cost (µs/combo, medians)',
      '',
      '```json',
      JSON.stringify(a.measured, null, 2),
      '```',
      '',
      '## Phase B — units per ms, unbounded budget over the dumpGameTreeEV battery',
      '',
      '| scenario | units | refinement ms | units/ms |',
      '|---|---|---|---|',
      ...b.rows.map((r) => `| ${r.name} | ${r.units} | ${r.refinementMs} | ${r.unitsPerMs} |`),
      '',
      `**REFINEMENT_UNITS_PER_MS (measured): ${b.unitsPerMs}**`,
      '',
      '## Verification (§3) — logical-2000ms vs wall-2000ms baseline',
      '',
      '- depthReached histogram: _(fill in after the pinned-slice comparison run)_',
      '- partial shares by stage: _(fill in)_',
      '- adjustment applied: _(REFINEMENT_UNITS_PER_MS only; record old -> new)_',
      '',
    ].join('\n'));
    console.log(`\nWrote ${OUT_DOC} (skeleton)`);
  } else {
    console.log(`\n${OUT_DOC} already exists — not overwritten.`);
  }
};

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
