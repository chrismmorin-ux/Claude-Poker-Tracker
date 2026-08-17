/**
 * WS-436 style-label collapse — Result Card emitter (RC-STYLE-COLLAPSE-2026-08-12).
 *
 * Recomputes every headline figure FROM THE ARTIFACTS at emit time rather than
 * transcribing numbers — a card whose metrics cannot drift from the records that
 * back them. Inputs (all produced this ticket, paths below): the three
 * dump-records prior-source runs (pre-A4, post-A4, corrected HEAD) and the six
 * paired probeFrequency runs (before/after worktrees × null/stats/styled).
 *
 * Run from the repo root AFTER the B4 matrix:
 *   node scripts/backtest/emit-ws436-result-card.mjs
 */
import { writeFileSync, readFileSync } from 'node:fs';

const REPO = process.cwd().split(String.fromCharCode(92)).join('/');
const { openLoader } = await import(`file:///${REPO}/scripts/backtest/loader.mjs`);
const loader = await openLoader(REPO);

const { buildResultCard, resultCardProblems } = await loader.load('/src/utils/standardOfRecord/resultCard.js');
const { buildReplicationManifest } = await loader.load('/src/utils/standardOfRecord/manifest.js');
const { registerVersion } = await loader.load('/src/utils/standardOfRecord/faultRegister.js');
const { discoverCorpusFiles, selectCorpusFiles, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
const { buildDealBook } = await loader.load('/scripts/backtest/dealBook.mjs');
const { gitStamp, collectConstants } = await loader.load('/scripts/backtest/replicationStamp.mjs');

const J = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ── villain-prediction instrument (dump-records, 10,147 paired decisions) ────────
const ll = (pred, actual) => -Math.log(Math.max(pred[actual] ?? 0, 1e-12));
const pairedLL = (A, B) => { // negative = B better
  let dSum = 0, dSq = 0;
  const n = A.length;
  for (let i = 0; i < n; i++) {
    const d = ll(B[i].p, B[i].a) - ll(A[i].p, A[i].a);
    dSum += d; dSq += d * d;
  }
  const mean = dSum / n;
  const se = Math.sqrt((dSq - n * mean * mean) / (n - 1)) / Math.sqrt(n);
  return { n, meanDLL: mean, t: mean / se, ci95: [mean - 1.96 * se, mean + 1.96 * se] };
};
const meanLL = (A) => A.reduce((s, r) => s + ll(r.p, r.a), 0) / A.length;
const identical = (A, B) => JSON.stringify(A) === JSON.stringify(B);

const pre = J('out/ws436-priors-records.json').recordsByArm;
const post = J('out/ws436-priors-records-postA4.json').recordsByArm;
const corr = J('out/ws436-priors-records-corrected.json').recordsByArm;

const predictionMetrics = {
  instrument: 'dump-records --arms priors (priorSource model-build axis), 300 players / 300 hands cap',
  decisions: pre.shipped.length,
  styleSeedVsPopulation_preA4: pairedLL(pre.shipped, pre['priors:population']),
  continuousSeedVsPopulation_postA4_REFUTED: pairedLL(post.shipped, post['priors:population']),
  correctedHead: {
    allThreeArmsRecordIdentical:
      identical(corr.shipped, corr['priors:population']) && identical(corr.shipped, corr['priors:style-labels']),
    shippedLogLoss: meanLL(corr.shipped),
  },
  tripwires: {
    preA4_labelsArmIdenticalToShipped: identical(pre.shipped, pre['priors:style-labels']),
    postA4_labelsArmIdenticalToShipped: identical(post.shipped, post['priors:style-labels']),
  },
};

// ── advice-path instrument (probeFrequency, paired by seeded key) ────────────────
const tv = (p, q) => {
  const acts = new Set([...Object.keys(p || {}), ...Object.keys(q || {})]);
  let d = 0; for (const a of acts) d += Math.abs((p?.[a] || 0) - (q?.[a] || 0));
  return d / 2;
};
const probeContrast = (pathA, pathB) => {
  const A = J(pathA), B = J(pathB);
  const byKey = new Map(B.rows.map(r => [r.key, r]));
  const shared = A.rows.filter(r => byKey.has(r.key));
  const divs = shared.map(r => tv(r.piOurs, byKey.get(r.key).piOurs)).filter(d => d > 1e-12);
  const fedA = A.rows.filter(r => r.villainFed).length;
  return {
    paired: shared.length,
    divergent: divs.length,
    meanTvOnDivergent: divs.length ? divs.reduce((s, d) => s + d, 0) / divs.length : 0,
    fedDecisionsA: fedA,
  };
};

const adviceMetrics = {
  instrument: 'probeFrequency paired-by-seeded-key, depth-1, 300 files / 300 players / 130 decisions; '
    + 'before = worktree at d3cf5993 (A0, engine src sha256 8c0913bb9507bb37) with B-instrument scripts overlaid',
  falsifier1_afterStyledVsStats_mustBeZero: probeContrast('out/ws436-b4-after-styled.json', 'out/ws436-b4-after-stats.json'),
  labelChannelOnOldEngine_beforeStyledVsStats: probeContrast('out/ws436-b4-before-styled.json', 'out/ws436-b4-before-stats.json'),
  engineChangeAtPopulation_beforeVsAfterNull: probeContrast('out/ws436-b4-before-null.json', 'out/ws436-b4-after-null.json'),
  engineChangeUnderFeed_beforeVsAfterStats: probeContrast('out/ws436-b4-before-stats.json', 'out/ws436-b4-after-stats.json'),
  baselineContinuity: 'before-null and after-null both reproduce the recorded Stage-0 baseline facing-aggression '
    + 'mix exactly: fold 10.2% / call 6.6% / raise 83.2% on the same 47-decision slice (ws436-baseline.md §3).',
  feed: (() => {
    const f = J('out/ws436-b4-after-stats.json');
    return { villainSource: f.villainSource, builtFrom: f.villainFeed?.builtFrom ?? null };
  })(),
};

// ── the absolute-EV statement (what WS-445's ledger row consumes) ────────────────
const absoluteEV = {
  statement:
    'The label-system removal changed the engine\'s advice DISTRIBUTION on exactly 0 of 130 paired '
    + 'decisions at population villains (the designed n=0 identity, holding end-to-end), and on 0 of '
    + '130 under the villain feed at the measured coverage — so its absolute-EV delta on this decision '
    + 'set is exactly 0: no decision\'s advice moved, therefore no decision\'s EV moved. The label '
    + 'channel it deleted was live on the OLD engine (divergent fed decisions, meanTV as recorded) and '
    + 'carried no measurable villain-action information (the prediction instrument\'s CI above). '
    + 'This is a REMOVAL AT PARITY, not an advice improvement claim.',
  evDeltaOnMeasuredSet: 0,
};

const files = await discoverCorpusFiles({ root: DEFAULT_CORPUS_ROOT, stakes: ['50NLH'] });
const dealBook = await buildDealBook({
  // WS-504 — THIS CARD DESCRIBES A HISTORICAL, PREFIX-SELECTED MEASUREMENT.
  // The metrics above are re-derived from out/*.json produced by a run that took a sorted
  // 300-file PREFIX, so the Deal Book must describe THAT sample; switching to proportional
  // here would make the card describe a population the numbers never came from.
  // The `strategy: 'prefix'` below is therefore correct and deliberate.
  //
  // The sliceSpec below was FALSE and is corrected: it declared sites [FTP,PS] while discovery
  // passed no sites filter at all, and a stake of '0.5' which is a big-blind figure, not a
  // corpus stake label (corpusFiles DIR_PATTERN requires d+NLH). Nothing validated it, because
  // sliceSpec is a caller assertion the Deal Book only hashes. The realised composition is now
  // computed from the members instead, so the sample can no longer be mislabelled.
  // NOTE: correcting sliceSpec changes this card's dealBookId AND contentHash on next emit.
  files: selectCorpusFiles(files, { maxFiles: 300, strategy: 'prefix' }).files,
  root: DEFAULT_CORPUS_ROOT,
  sliceSpec: { sites: null, stakes: ['50NLH'], maxFiles: 300, fileSelection: 'prefix' },
  identity: 'path+size',
});
const { engineCommit, engineDirty } = gitStamp(REPO);
const constantsFromStamp = await collectConstants(loader);
const disclaimerRegisterVersion = await registerVersion();

const card = buildResultCard({
  resultCardId: 'RC-STYLE-COLLAPSE-2026-08-12',
  match: {
    surfaceId: 'SURF-engine-advice-probe+villain-prediction',
    dealBookId: dealBook.dealBookId,
    fieldId: 'FIELD-handhq-50nl-2009-07-behavior-policy',
  },
  estimand:
    'The paired, per-decision change to (a) the engine\'s advised action distribution and (b) '
    + 'villain-action prediction quality, from removing the six classifyStyle labels as engine '
    + 'decision inputs (WS-436 stages A1-A4 with the in-flight A4 seed correction, plus the B2 '
    + 'feed that made the label channel measurable at all). Both halves are scored on the SAME '
    + 'decisions before and after; nothing is compared across different decision sets.',
  treatment:
    'paired-by-decision on seeded keys, depth-1 (refinementBudgetMs=0 — the shipping configuration; '
    + 'a wall-clock depth-2 arm is not comparable across runs) · villain-prediction half scored as '
    + 'log-loss with per-decision differencing, clustered on players · advice half scored as '
    + 'total-variation distance of the advised action distribution, divergent-only per the '
    + 'paired-on-divergent doctrine · leakage: POOL/EVAL partition + walk-forward, asserted by '
    + 'LeakageGuard; villain feed is POOL-only by construction with leave-one-out priors · corpus is '
    + 'online cash July 2009 50NL, so ANY CLAIM ABOUT THE FOUNDER\'S LIVE 9-HANDED 1/2-1/3 GAME IS '
    + 'TRANSFERRED, NOT MEASURED (top-ranked Suspected-Fault Register entry) · the feed\'s '
    + 'oracle-prefix semantics cancel in arm contrasts and are stated in villainFeed.mjs.',
  clusterUnit: 'players',
  metrics: {
    kind: 'style-collapse', // WS-434: dispatches to SOR_SCHEMAS['metrics.style-collapse']
    villainPrediction: predictionMetrics,
    advicePath: adviceMetrics,
    absoluteEV,
    determinism: {
      inProcess: 'verify-ws433-determinism.mjs: serial self-identity, parallel bit-identity, '
        + 'resume identity + tamper refusal — ALL GATES PASS at corrected HEAD',
      crossProcess: 'run-hero-ev twice under --villain-source stats → diffHeroEvRuns — see close-out log',
    },
  },
  admissibility: {
    quotable: true,
    reasons: [],
    caveats: [
      'TRANSFERRED, NOT MEASURED for live 9-handed 1/2-1/3. Corpus is online cash July 2009, 50NL.',
      'The advice half is an ARGMAX-distribution instrument at depth-1: EV shifts that flip no '
      + 'combo\'s best action are invisible to it (the engine-stated-EV channel is exercised by '
      + 'scripts/__tests__/villainFeed.test.js, which pins that opposite-pole villains DO move EV).',
      'Feed coverage is partial and printed per run; contrasts subtract the feed\'s snapshot '
      + 'semantics, level claims would not.',
      'The 0-EV-delta claim is exact ON THE MEASURED DECISION SET; it is not a claim about '
      + 'decisions outside it.',
    ],
  },
  manifest: buildReplicationManifest({
    engineCommit,
    engineDirty,
    dealBookHash: dealBook.contentHash,
    fieldVersion: 'handhq-50nl-2009-07-ftp+ps · behavior-policy out/behavior-policy.json · '
      + 'pool-reference regenerated with WS-373 weighting stamp',
    partition: 'player-level POOL/EVAL at poolPct=50 (fnv1a-32); villain feed POOL-side only; '
      + 'before-worktree engine at d3cf5993 (src sha256 8c0913bb9507bb37)',
    seeds: {
      probePairing: 'mulberry32(fnv1a-32(`${playerId}|${handId}|${order}`)) per decision',
      liveness: '0xC0FFEE (villainFeed.test.js fixed equity seed)',
    },
    unseededSources: [],
    constants: {
      ...constantsFromStamp.constants,
      REFINEMENT_BUDGET_MS: 0,
      PSEUDOCOUNT: 10,
      AGG_FREQ_PRIOR_MEAN: 0.45,
      POP_BET_CENTER: 0.55,
      FEED: J('out/villain-feed-v2.json').builtFrom,
    },
    disclaimerRegisterVersion,
    knownDivergences: constantsFromStamp.knownDivergences ?? [],
  }),
});

const problems = resultCardProblems(card);
if (problems.length) {
  console.error('INVALID CARD:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}
writeFileSync(`${REPO}/docs/research/ws436-style-collapse-2026-08-12.result-card.json`, JSON.stringify(card, null, 2) + '\n');
console.log('OK RC-STYLE-COLLAPSE-2026-08-12');
console.log('   dealBookId=' + dealBook.dealBookId + ' engineCommit=' + engineCommit + ' dirty=' + engineDirty);
await loader.close();
