/**
 * run-study-ladder.mjs — WS-320. Does the study ladder separate?
 *
 * Usage:
 *   node scripts/backtest/run-study-ladder.mjs [--sites FTP,PS] [--stakes 50NLH]
 *                                              [--max-files N] [--min-n 20]
 *                                              [--out .artifacts/study-ladder.json]
 *
 * Runs the §11.8 overdispersion instrument on the three high-frequency study-ladder rungs
 * (limp / 3-bet / c-bet) WITH §11.8's control axis measured in the same run, plus the
 * cross-axis correlations and the ordering test the ladder hypothesis specifically predicts.
 *
 * Emits a Result Card. "Axis X separates" is a claim someone would act on by building a
 * channel, so it is not allowed to exist outside one.
 *
 * EVERY MODULE IS LOADED THROUGH THE VITE SSR LOADER, including this harness's own files.
 * `phhAdapter` imports the app's `primitiveActions`, which imports `./gameConstants`
 * extensionless — plain Node ESM refuses to resolve that, so a direct static import fails at
 * startup. `run-hero-ev.mjs` established this pattern; following it is what keeps the harness
 * reading the SAME action constants the app ships rather than a copy that could drift.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { openLoader } from './loader.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const list = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : null);

const SITES = list(flag('sites', null));
const STAKES = list(flag('stakes', null));
const MAX_FILES = Number(flag('max-files', 0)) || null;
const MIN_N = Number(flag('min-n', 20));
const POOL_PCT = Number(flag('pool-pct', 50));
const OUT = flag('out', '.artifacts/study-ladder.json');
const CARD_OUT = flag('card-out', '.artifacts/study-ladder.card.json');

const pct = (x) => (x === null || x === undefined ? '   n/a' : `${(100 * x).toFixed(1)}%`);
const num = (x, d = 3) => (x === null || x === undefined ? 'n/a' : x.toFixed(d));

const loader = await openLoader(process.cwd());
try {
  const { DEFAULT_CORPUS_ROOT, discoverCorpusFiles } = await loader.load('/scripts/backtest/corpusFiles.mjs');
  const { buildDealBook } = await loader.load('/scripts/backtest/dealBook.mjs');
  const { LadderTally, AXIS_IDS, LADDER_RUNGS } = await loader.load('/scripts/backtest/ladderAxes.mjs');
  const { LeakageGuard, REFERENCE_DISABLED } = await loader.load('/scripts/backtest/leakageGuard.mjs');
  const { iterAppHands } = await loader.load('/scripts/backtest/phhAdapter.mjs');
  const { buildStampInput } = await loader.load('/scripts/backtest/replicationStamp.mjs');
  const { analyseLadder, ladderResultCard, DEFAULT_MIN_N_SWEEP } =
    await loader.load('/scripts/backtest/studyLadderReport.mjs');

  const ROOT = flag('corpus-root', DEFAULT_CORPUS_ROOT);

  // ── 1. The Deal Book. A slice defined by a hash, not by "whatever matched today". ──
  let files = await discoverCorpusFiles({ root: ROOT, sites: SITES, stakes: STAKES });
  if (MAX_FILES) files = files.slice(0, MAX_FILES);

  const dealBook = await buildDealBook({
    files,
    root: ROOT,
    sliceSpec: { sites: SITES, stakes: STAKES, maxFiles: MAX_FILES },
    seeds: {},
    identity: 'path+size',
  });
  console.log(`Deal Book ${dealBook.dealBookId}  ${dealBook.memberCount} files  ${dealBook.contentHash}`);

  // ── 2. Stream the corpus, tallying per-player observations per axis. ──
  const tally = new LadderTally();
  const skips = {};
  let fileNo = 0;
  for (const f of files) {
    fileNo += 1;
    for await (const hand of iterAppHands(f.path, { site: f.site, stakeLabel: f.stakeLabel }, skips)) {
      tally.addHand(hand);
    }
    if (fileNo % 200 === 0) {
      console.log(`  ...${fileNo}/${files.length} files, ${tally.handsSeen} hands, ${tally.players.size} players`);
    }
  }
  console.log(`converted ${tally.handsSeen} hands · ${tally.players.size} player-site rows`);

  // ── 3. The instrument, under the leakage guard. ──
  // REFERENCE_DISABLED is the honest sentinel: this run mines its rates from the corpus itself
  // and never touches the shipped Reference table, so channel 1 is closed by not existing
  // rather than by a stamp. Channels 2 and 3 are live — see the assertions inside analyseLadder.
  const guard = new LeakageGuard({ poolPct: POOL_PCT, reference: REFERENCE_DISABLED });

  const sweep = DEFAULT_MIN_N_SWEEP.includes(MIN_N)
    ? [...DEFAULT_MIN_N_SWEEP]
    : [...DEFAULT_MIN_N_SWEEP, MIN_N].sort((a, b) => a - b);

  const analysis = analyseLadder({
    tally, poolPct: POOL_PCT, primaryMinN: MIN_N, minNSweep: sweep, guard,
  });

  // ── 4. Stamp and card. ──
  const stamp = await buildStampInput({
    loader,
    seeds: {},
    // POSITIVE CLAIM, and legitimate here. Nothing in this path calls Math.random(): the
    // tallies are exact counts, the partition is FNV-1a over the player id, and every
    // statistic is closed-form. The Monte Carlo equity path that forces the hero-EV harness
    // to declare an unseeded source is never reached from here.
    unseededSources: [],
    dealBookHash: dealBook.contentHash,
    fieldVersion: 'handhq-2009-online',
    partition:
      `pool/eval @ poolPct=${POOL_PCT}, FNV-1a over player-site id; `
      + 'walk-forward = per-player temporal split-half (early window ends where late window begins)',
  });
  // WS-432 floor: REFINEMENT_BUDGET_MS is REQUIRED on every manifest; the ladder is exact
  // counting with no game-tree evaluation, so the honest value is an explicit n/a.
  stamp.constants = {
    ...stamp.constants,
    REFINEMENT_BUDGET_MS: 'n/a — no game-tree evaluation on this path',
  };

  const card = ladderResultCard({
    analysis,
    stamp,
    dealBookId: dealBook.dealBookId,
    fieldId: 'handhq-2009-online-eval-half',
  });

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ dealBook: { ...dealBook, members: undefined }, analysis, skips }, null, 2));
  await writeFile(CARD_OUT, JSON.stringify(card, null, 2));

  // ── 5. Report. ──
  console.log('\n=== OVERDISPERSION (EVAL half, common rate mined from POOL half) ===');
  console.log(`min observations per player: ${analysis.primaryMinN}\n`);
  console.log('axis                                    role      players            k/n    rate  obs/plyr  chi2/df       z   SD_betw  reliab  verdict');
  for (const id of AXIS_IDS) {
    const a = analysis.axes[id];
    const s = a.primary.poolAnchored;
    console.log(
      `${a.label.padEnd(38)} ${a.role.padEnd(8)} ${String(s.players).padStart(7)} `
      + `${`${a.evalK}/${a.evalN}`.padStart(14)} ${pct(a.evalRate).padStart(6)} `
      + `${String(s.obsPerPlayerMedian ?? '-').padStart(9)} ${num(s.chi2PerDf).padStart(8)} `
      + `${num(s.z, 1).padStart(7)} ${pct(s.betweenPlayerSd).padStart(9)} `
      + `${num(a.reliability.reliability, 2).padStart(7)}  ${a.verdict.verdict}`,
    );
  }

  console.log('\n--- min-n sensitivity: chi2/df (players) ---');
  console.log(`axis                                   ${analysis.minNSweep.map((m) => `n>=${m}`.padStart(16)).join('')}`);
  for (const id of AXIS_IDS) {
    const a = analysis.axes[id];
    console.log(
      `${a.label.padEnd(38)}`
      + analysis.minNSweep.map((m) => {
        const s = a.sweep[m]?.poolAnchored;
        return `${num(s?.chi2PerDf)} (${s?.players ?? 0})`.padStart(16);
      }).join(''),
    );
  }

  console.log('\n=== CROSS-AXIS CORRELATION (shrunk rates, players present on both) ===');
  for (const c of analysis.correlations) {
    console.log(
      `${`${c.a} x ${c.b}`.padEnd(46)} n=${String(c.players).padStart(5)}  `
      + `r=${num(c.pearson).padStart(7)}  rho=${num(c.spearman).padStart(7)}  `
      + `disatt=${num(c.disattenuated).padStart(7)}`
      + (c.overlapping ? '   << OVERLAPPING BY CONSTRUCTION — not evidence of a shared trait' : ''),
    );
  }

  console.log('\n=== ORDERING: a ladder, or independent habits wearing a ladder\'s name? ===');
  for (const t of analysis.ordering.thresholds) {
    console.log(`  acquired(${t.axis}) := shrunk rate ${t.direction === 'lower' ? '<' : '>'} ${num(t.threshold, 4)}  (population median)`);
  }
  console.log('');
  for (const p of analysis.ordering.pairwise) {
    console.log(
      `  ${`${p.labelA} / ${p.labelB}`.padEnd(32)} n=${String(p.n).padStart(5)} both=${String(p.both).padStart(5)} `
      + `exp_if_indep=${num(p.expectedBothUnderIndependence, 1).padStart(7)} `
      + `P(A|B)=${num(p.pAgivenB)} P(B|A)=${num(p.pBgivenA)} phi=${num(p.phi)}`,
    );
  }
  const nest = analysis.ordering.nesting;
  console.log(
    `\n  Guttman nesting over ${LADDER_RUNGS.join(' -> ')}: ${nest.nested}/${nest.players} nested `
    + `(${pct(nest.nestedRate)}), ${nest.violations} violations (${pct(nest.violationRate)}).`,
  );
  console.log(
    `  marginals in this intersection: ${nest.marginals.map((m) => pct(m)).join(' / ')}  `
    + `— NOT 50/50, so the equal-marginal baseline (${pct(nest.equalMarginalBaseline)}) does not apply.`,
  );
  console.log(
    `  independent habits with THESE marginals would already nest ${pct(nest.expectedNestedRateUnderIndependence)}. `
    + `EXCESS ATTRIBUTABLE TO ORDERING: ${pct(nest.excessOverIndependence)}.`,
  );
  console.log(`  pattern counts (limp/3bet/cbet acquired): ${JSON.stringify(nest.patternCounts)}`);

  console.log('\n=== VERDICTS ===');
  for (const id of AXIS_IDS) {
    console.log(`\n  ${analysis.axes[id].label}\n    ${analysis.axes[id].verdict.verdict.toUpperCase()} — ${analysis.axes[id].verdict.reason}`);
  }

  console.log(`\n=== RESULT CARD ${card.resultCardId} ===`);
  console.log(`  admissible: ${card.admissibility.admissible}`);
  for (const b of card.admissibility.blockers) console.log(`  BLOCKER ${b.code}: ${b.detail}`);
  for (const w of card.admissibility.warnings) console.log(`  warning ${w.code}: ${w.detail}`);
  console.log(`\n  leakage guard: ${JSON.stringify(analysis.guardSummary)}`);
  console.log(`\nwrote ${OUT}\nwrote ${CARD_OUT}`);
} finally {
  await loader.close();
}
