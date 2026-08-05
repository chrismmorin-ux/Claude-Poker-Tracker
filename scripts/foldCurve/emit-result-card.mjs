/**
 * WS-283 fold-curve fit — Result Card emitter
 *
 * WHY THIS LIVES HERE AND NOT IN `scripts/backtest/`. That directory is the WS-273 villain
 * PREDICTION harness. This is a different instrument measuring a different quantity: the
 * population fold-to-bet response as a function of bet size, which `queryActionDistribution`
 * — everything `scripts/backtest/run.mjs` scores — does not take as an input at all. Filing
 * it next to the harness would invite the two to be read as the same measurement.
 *
 * It imports `scripts/backtest/` modules read-only (`phhAdapter`, `corpusFiles`, `partition`,
 * `dealBook`, `replicationStamp`, `loader`) rather than re-deriving the corpus conventions —
 * the pot convention in particular is one that silently corrupts everything downstream when
 * two copies drift.
 *
 * Run order, from the repo root:
 *
 *   node scripts/foldCurve/mine-fold-vs-sizing.mjs      # ~7 min, writes fold-vs-sizing.json
 *   node scripts/foldCurve/fit-fold-curve.mjs           # ~2 min, prints the residual tables
 *   node scripts/foldCurve/emit-result-card.mjs         # writes the Result Card
 */
import { writeFileSync } from 'node:fs';

// Repo root. Run these from the repo root; the loader resolves `/src/...` against it.
const REPO = process.cwd().split(String.fromCharCode(92)).join('/');
const { openLoader } = await import(`file:///${REPO}/scripts/backtest/loader.mjs`);
const loader = await openLoader(REPO);

const { buildResultCard, resultCardProblems } = await loader.load('/src/utils/standardOfRecord/resultCard.js');
const { buildReplicationManifest } = await loader.load('/src/utils/standardOfRecord/manifest.js');
const { registerVersion } = await loader.load('/src/utils/standardOfRecord/faultRegister.js');
const { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
const { buildDealBook } = await loader.load('/scripts/backtest/dealBook.mjs');
const { gitStamp, collectConstants } = await loader.load('/scripts/backtest/replicationStamp.mjs');
const { POPULATION_CURVE } = await loader.load('/src/utils/exploitEngine/villainModelData.js');

const files = await discoverCorpusFiles({});
const dealBook = await buildDealBook({
  files,
  root: DEFAULT_CORPUS_ROOT,
  sliceSpec: { sites: ['FTP', 'PS'], stakes: ['0.5'], maxFiles: null },
  identity: 'path+size',
});

const { engineCommit, engineDirty } = gitStamp(REPO);
const constantsFromStamp = await collectConstants(loader);
const disclaimerRegisterVersion = await registerVersion();

const ESTIMAND =
  'The SHAPE of the population fold-to-bet response — d(fold rate)/d(bet size as a fraction '
  + 'of the pot) — for postflop decisions at which a seat faced a live BET, expressed as the '
  + 'residual of observed fold rate against `logisticFoldResponse` with the intercept '
  + 'calibrated out, so that only shape is scored and not the base rate. NOT a fold-rate '
  + 'level: the base rate is a separate quantity, supplied by the §6.5a hierarchy, and is '
  + 'deliberately not estimated here.';

const TREATMENT =
  'population-level curve fit by Brier minimisation over a fixed parameter grid · no RNG, '
  + 'bit-reproducible · leakage guard is structural and two-level (player partition POOL/EVAL '
  + 'at poolPct=50, AND walk-forward in time: fit days 1-11, score days 12-23), never a '
  + 'convention · scored per decision, clustered on players · conditioned on facing a BET '
  + '(facing a RAISE is reported separately and never merged) and on bet fraction < 3x pot '
  + '(99.7% of decisions) · population is online cash, July 2009, 50NL, Full Tilt + '
  + 'PokerStars, 3-9 handed with heads-up excluded, so ANY CLAIM ABOUT THE FOUNDER\'S LIVE '
  + '9-HANDED 1/2-1/3 GAME IS TRANSFERRED, NOT MEASURED — the top-ranked entry of the '
  + 'Suspected-Fault Register · only the SHAPE is transferred; the LEVEL '
  + '(POPULATION_PRIORS.bet.fold, STAT_PRIORS.foldToCbet) is untouched by this run.';

const card = buildResultCard({
  resultCardId: 'RC-WS283-FOLD-CURVE-SHAPE-2026-08-05',
  match: {
    surfaceId: 'SURF-fold-curve-population',
    dealBookId: dealBook.dealBookId,
    fieldId: 'FIELD-handhq-50nl-2009-07',
  },
  estimand: ESTIMAND,
  treatment: TREATMENT,
  clusterUnit: 'players',
  metrics: {
    fit: {
      partition: 'POOL players, days 1-11',
      n: 178174,
      k: 98273,
      marginalFoldRate: 0.5516,
    },
    holdOut: {
      partition: 'EVAL players, days 12-23',
      n: 318347,
      k: 178794,
      marginalFoldRate: 0.5616,
      residualSlopeVsBetFraction: { before: 0.1409, after: 0.0078 },
      brier: { before: 0.24054, after: 0.23530 },
    },
    // The observed gradient, on the WS-273 report's own sizing buckets (its axis divides the
    // bet by the pot INCLUDING that bet, hence the boundaries here on bet/pot).
    holdOutBySizeBucket: [
      { bucket: '0-33', betOverPot: '<0.4925', n: 113599, k: 52475, observed: 0.4619, errBefore: -0.014, errAfter: -0.016 },
      { bucket: '33-66', betOverPot: '0.4925-1.9412', n: 202261, k: 124399, observed: 0.6150, errBefore: 0.061, errAfter: -0.020 },
      { bucket: '66-100', betOverPot: '>=1.9412', n: 2487, k: 1920, observed: 0.7720, errBefore: 0.098, errAfter: -0.082 },
    ],
    // Reported because P(fold|size) and P(size|fold) support opposite readings.
    inverseConditional: {
      note: 'P(bet/pot in bucket | villain folded), fit set. Big bets dominate the fold RATE and are a tiny share of the folds.',
      'lt0.5': 0.3333, '0.5-1.0': 0.5102, '1.0-2.0': 0.1440, 'gte2.0': 0.0124,
    },
    facingRaiseHeldOutSeparately: {
      n: 45293, k: 19212, marginalFoldRate: 0.4242,
      residualSlopeVsBetFraction: { before: 0.1842, after: 0.0522 },
      brier: { before: 0.23210, after: 0.22007 },
      note: 'Not merged into the fit — a raise is a different decision. Reported because the '
        + 'corrected shape has to be checked against the adjacent population it will also be '
        + 'applied to, and it improves there too rather than degrading.',
    },
    holdOutByStreet: [
      { street: 'flop', n: 181424, marginalFoldRate: 0.5930, slope: { before: 0.0763, after: -0.0358 }, brier: { before: 0.23803, after: 0.23668 } },
      { street: 'turn', n: 87257, marginalFoldRate: 0.5004, slope: { before: 0.2123, after: 0.0549 }, brier: { before: 0.24267, after: 0.23405 } },
      { street: 'river', n: 49666, marginalFoldRate: 0.5548, slope: { before: 0.1697, after: 0.0222 }, brier: { before: 0.23820, after: 0.22844 } },
    ],
    fittedCurve: { ...POPULATION_CURVE },
    previousCurve: { maxDelta: 0.25, steepness: 3.0, steepnessUp: 4.0, steepnessDown: 2.0, midpoint: 0.75 },
    nullResults: {
      streetModifiers:
        'FOLD_CURVE_STREET_MODS refit per street returns the same shape on flop/turn/river; '
        + 'applying the shipped multipliers on top of the fitted curve is WORSE on the hold-out '
        + '(flop 0.23668 -> 0.23723, river 0.22844 -> 0.22885). ~5e-4, an order of magnitude under '
        + 'the population-curve effect. Values unchanged; the poker-theory justification withdrawn.',
      symmetricFallback:
        'Best free symmetric curve scores 0.23689 on the hold-out vs 0.23530 asymmetric. The '
        + 'asymmetry is real, not an artifact of the grid.',
    },
    residualNotRemoved:
      'Below ~0.15x pot the fitted curve still over-predicts folding by 3-13 points (observed '
      + '6.4% at 0.03x). A bounded logistic in raw pot fraction cannot reach that floor; the '
      + 'principled fix is to re-express the curve in required equity s/(1+2s) (POKER_THEORY '
      + '6.2), which was deliberately NOT taken here for blast radius.',
  },
  admissibility: {
    quotable: true,
    reasons: [],
    caveats: [
      'TRANSFERRED, NOT MEASURED for live 9-handed 1/2-1/3. Corpus is online cash July 2009, 50NL.',
      'Shape only. This run estimates no fold-rate LEVEL and licenses no change to one.',
      'Does not move the WS-273 villain-prediction lift: queryActionDistribution takes no bet-size '
      + 'argument, so the fold curve is not on the path that harness scores. See scope note.',
    ],
  },
  manifest: buildReplicationManifest({
    engineCommit,
    engineDirty,
    dealBookHash: dealBook.contentHash,
    fieldVersion: 'handhq-50nl-2009-07-ftp+ps',
    partition: 'player-level POOL/EVAL at poolPct=50 (fnv1a-32, scripts/backtest/partition.mjs) AND walk-forward by corpus day: fit on POOL days 1-11, scored on EVAL days 12-23',
    seeds: {},
    unseededSources: [],
    constants: {
      ...constantsFromStamp.constants,
      POPULATION_CURVE: { ...POPULATION_CURVE },
      FIT_GRID: { maxDelta: '0.05..1.00 step 0.05', steepnessUp: '0.5..8.0 step 0.25', steepnessDown: '0.5..8.0 step 0.25', midpoint: '0.05..2.50 step 0.05' },
      BIN_WIDTH: 0.05,
      BIN_MAX: 3.0,
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

writeFileSync(`${REPO}/docs/research/fold-curve-refit-2026-08-05.result-card.json`, JSON.stringify(card, null, 2) + '\n');
console.log('OK  dealBookId=' + dealBook.dealBookId);
console.log('    contentHash=' + dealBook.contentHash);
console.log('    engineCommit=' + engineCommit + ' dirty=' + engineDirty);
console.log('    disclaimerRegisterVersion=' + disclaimerRegisterVersion);
await loader.close();
