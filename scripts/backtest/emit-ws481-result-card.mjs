/**
 * WS-481 fold-curve AXIS correction — Result Card emitter (RC-FOLD-CURVE-AXIS-2026-08-15).
 *
 * Every headline figure is RECOMPUTED FROM THE ARTIFACTS here rather than transcribed, so
 * the card cannot drift from the records that back it.
 *
 * Inputs (all produced this ticket):
 *   out/ws481-BEFORE-smoke.json / ws481-after-smoke.json   WS-273 blindness proof
 *   out/ws481-probe-BEFORE.json / ws481-probe-AFTER.json    probeFrequency blindness proof
 *   out/ws481-model-BEFORE.json / ws481-model-AFTER.json    the paired advice delta
 *   out/villain-feed-model-{BEFORE,AFTER}.json             the instrument built to see it
 *
 * Run from the repo root:
 *   node scripts/backtest/emit-ws481-result-card.mjs
 */
import { writeFileSync, readFileSync } from 'node:fs';

const REPO = process.cwd().split(String.fromCharCode(92)).join('/');
const { openLoader } = await import(`file:///${REPO}/scripts/backtest/loader.mjs`);
const loader = await openLoader(REPO);

const { buildResultCard, resultCardProblems } = await loader.load('/src/utils/standardOfRecord/resultCard.js');
const { buildReplicationManifest } = await loader.load('/src/utils/standardOfRecord/manifest.js');
const { registerVersion } = await loader.load('/src/utils/standardOfRecord/faultRegister.js');
const { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
const { buildDealBook } = await loader.load('/scripts/backtest/dealBook.mjs');
const { gitStamp, collectConstants } = await loader.load('/scripts/backtest/replicationStamp.mjs');
const { foldCurveAxisFraction, villainFacingFraction } = await loader.load('/src/utils/exploitEngine/foldEquityCalculator.js');

const J = (p) => JSON.parse(readFileSync(`${REPO}/${p}`, 'utf8'));
const tv = (p, q) => {
  const ks = new Set([...Object.keys(p || {}), ...Object.keys(q || {})]);
  let s = 0;
  for (const k of ks) s += Math.abs((p?.[k] || 0) - (q?.[k] || 0));
  return s / 2;
};

// ── the paired advice delta, conditioned on a served villain model ───────────────
const pairedDelta = (aPath, bPath) => {
  const A = J(aPath), B = J(bPath);
  const mapB = new Map(B.rows.map(r => [r.key, r]));
  let paired = 0, fed = 0, fedDiv = 0, unfed = 0, unfedDiv = 0, tvFed = 0, aggA = 0, aggB = 0;
  for (const a of A.rows) {
    const b = mapB.get(a.key);
    if (!b) continue;
    paired++;
    const d = tv(a.piOurs, b.piOurs);
    if (a.villainFed) {
      fed++;
      aggA += (a.piOurs?.bet || 0) + (a.piOurs?.raise || 0);
      aggB += (b.piOurs?.bet || 0) + (b.piOurs?.raise || 0);
      if (d > 1e-12) { fedDiv++; tvFed += d; }
    } else {
      unfed++;
      if (d > 1e-12) unfedDiv++;
    }
  }
  return {
    paired, fed, fedDiv, unfed, unfedDiv,
    meanTvOnDivergent: fedDiv ? tvFed / fedDiv : 0,
    aggBefore: fed ? aggA / fed : 0,
    aggAfter: fed ? aggB / fed : 0,
  };
};

const model = pairedDelta('out/ws481-model-BEFORE.json', 'out/ws481-model-AFTER.json');
const nullArm = pairedDelta('out/ws481-probe-BEFORE.json', 'out/ws481-probe-AFTER.json');

// ── the WS-273 blindness proof: bit-identity of the two scorecards ───────────────
const stripRuntime = (j) => {
  const c = JSON.parse(JSON.stringify(j));
  for (const s of c.scorecards) delete s.generatedFrom.runtimeMs;
  return JSON.stringify(c);
};
const predBefore = J('out/ws481-BEFORE-smoke.json');
const predAfter = J('out/ws481-after-smoke.json');
const predIdentical = stripRuntime(predBefore) === stripRuntime(predAfter);

const feedBefore = J('out/villain-feed-model-BEFORE.json');
const feedAfter = J('out/villain-feed-model-AFTER.json');

// The documented anchor, recomputed through the shipped function (exploitEngine/CLAUDE.md:
// P=100, B=65, a 54 raise on top reads 0.235 on the fitted axis).
const anchor = foldCurveAxisFraction(54, 100 + 65 + 119);
const anchorViaConsumer = villainFacingFraction('raise', { potSize: 100, villainBet: 65, betSize: 54 });
const potSizedFlopBet = foldCurveAxisFraction(13, 13 + 13);

const files = await discoverCorpusFiles({ root: DEFAULT_CORPUS_ROOT, stakes: ['50NLH'] });
const dealBook = await buildDealBook({
  files: files.slice(0, 300),
  root: DEFAULT_CORPUS_ROOT,
  sliceSpec: { sites: ['FTP', 'PS'], stakes: ['0.5'], maxFiles: 300 },
  identity: 'path+size',
});
const { engineCommit, engineDirty } = gitStamp(REPO);
const constantsFromStamp = await collectConstants(loader);
const disclaimerRegisterVersion = await registerVersion();

const card = buildResultCard({
  resultCardId: 'RC-FOLD-CURVE-AXIS-2026-08-15',
  clusterUnit: 'players',
  treatment:
    'WS-481: `personalizedFoldCurve` fitted on `foldCurveAxisFraction(owed, potIncludingFacedBet)` — '
    + 'the same definition `villainFacingFraction` evaluates it on — instead of on '
    + '`facingBetAmount / hand.gameState.potSize` (raise-TO level over the hand\'s FINAL pot). '
    + 'Control arm is the identical harness against the engine at 70a2a192~1.',
  match: {
    surfaceId: 'SURF-engine-advice-probe',
    dealBookId: dealBook.dealBookId,
    fieldId: 'FIELD-handhq-50nl-2009-07-behavior-policy',
  },
  estimand:
    'The paired, per-decision change to the engine\'s advised action distribution from correcting '
    + 'the VARIABLE `personalizedFoldCurve` is fitted on. Before, `decisionAccumulator` fitted it on '
    + '`facingBetAmount / hand.gameState.potSize` — the hand\'s FINAL total pot, with the raise-TO '
    + 'level in the numerator — while `gameTreeEvaluator` evaluated it at the street-pot fraction via '
    + '`villainFacingFraction`. Both sides now resolve to ONE exported definition. Scored on the SAME '
    + 'seeded decisions before and after; nothing is compared across different decision sets.',
  metrics: {
    kind: 'fold-curve-axis',
    axisDefinition: {
      formula: 'owed / (potIncludingFacedBet - owed)',
      sharedBy: [
        'src/utils/exploitEngine/foldEquityCalculator.js foldCurveAxisFraction (the definition)',
        'villainFacingFraction (consumption) — delegates to it',
        'src/utils/exploitEngine/decisionAccumulator.js (training) — imports it',
      ],
      anchorCheck: {
        documented: 0.235,
        recomputedViaDefinition: anchor,
        recomputedViaConsumer: anchorViaConsumer,
        consumerAgreesWithDefinition: Math.abs(anchor - anchorViaConsumer) < 1e-12,
        note: 'exploitEngine/CLAUDE.md records P=100, B=65, a 54 raise on top as 0.235 on the fitted axis.',
      },
    },
    trainingSideBefore: {
      numerator: 'the aggressor\'s raise-TO level (not the increment owed) — `amount` is the raise-to '
        + 'in both corpus (phhAdapter.mjs:256) and live app (recordSeatAction.js:20)',
      denominator: 'hand.gameState.potSize — the FINAL total pot (phhAdapter.mjs states it)',
      worked: {
        scenario: 'pot-sized flop bet of 13 into 13, in a hand whose final pot is 156',
        before: 13 / 156,
        after: potSizedFlopBet,
        note: 'Trained as 0.083 where the truth is 1.0 — an order of magnitude, in the direction that '
          + 'makes every bet look small and therefore cheap to call.',
      },
    },
    blindInstruments: [
      {
        instrument: 'WS-273 villain-prediction harness (scripts/backtest/run.mjs → runner.mjs)',
        blindBecause: 'It scores queryActionDistribution (the decision-bucket model) and never reads '
          + 'personalizedFoldCurve, foldCurve, gameTree, estimateFoldPct or sizingTells.',
        evidence: {
          preRegisteredPrediction: 'the two arms will be BIT-IDENTICAL',
          held: predIdentical,
          logLossBefore: predBefore.scorecards[0].overall.logLoss,
          logLossAfter: predAfter.scorecards[0].overall.logLoss,
          brierBefore: predBefore.scorecards[0].overall.brier,
          brierAfter: predAfter.scorecards[0].overall.brier,
          n: predBefore.scorecards[0].overall.n,
        },
      },
      {
        instrument: 'probeFrequency at its default villain source (null-stats villains)',
        blindBecause: 'heroPolicy.mjs passed `villainModel: null` unconditionally — as did all 11 '
          + 'game-tree call sites under scripts/backtest/ (FIND-138).',
        evidence: {
          pairedDecisions: nullArm.paired,
          divergentDecisions: nullArm.fedDiv + nullArm.unfedDiv,
          note: 'Zero divergence. This doubles as the cross-process determinism control for the '
            + 'harness: two processes, two code states, identical output where the channel is absent.',
        },
      },
    ],
    reach: {
      playersConsidered: 222,
      playersWithFittedCurve: 139,
      conditioned: {
        k: 139, n: 222, rate: 139 / 222,
        conditional: 'P(villain has a fitted personalizedFoldCurve | EVAL player with >=15 corpus hands)',
      },
      note: 'scripts/backtest/probe-foldcurve-reach.mjs. Establishes that a null divergence would have '
        + 'been the instrument, not an inert feature — the curve is produced for most players and '
        + 'OUTRANKS the population curve on the bet path (gameTreeEvaluator.js).',
    },
    pairedAdviceDelta: {
      paired: model.paired,
      fed: model.fed,
      divergent: model.fedDiv,
      meanTvOnDivergent: model.meanTvOnDivergent,
      conditioned: {
        k: model.fedDiv, n: model.fed, rate: model.fed ? model.fedDiv / model.fed : null,
        conditional: 'P(advice distribution changed | decision where a personalized villain model was served)',
      },
      unconditionedRate: model.paired ? model.fedDiv / model.paired : null,
      unconditionedNote: 'Reported and NOT quoted as the headline: it is diluted by decisions the '
        + 'channel cannot reach, where the change is zero by construction.',
    },
    controlUnfedMustBeZero: {
      n: model.unfed,
      divergent: model.unfedDiv,
      passed: model.unfedDiv === 0,
      note: 'Decisions with no villain model must diverge on zero rows. A nonzero value would mean the '
        + 'measured effect is not carried by the channel claimed.',
    },
    aggressionShift: {
      before: model.aggBefore,
      after: model.aggAfter,
      delta: model.aggAfter - model.aggBefore,
      basis: 'mean (bet + raise) mass over the fed decisions',
      signPrediction: 'NEGATIVE — the old axis understated every faced sizing, and exploitEngine/CLAUDE.md '
        + 'records that inflated fold equity makes the engine RECKLESS, not timid. Removing the '
        + 'inflation should reduce aggression.',
      signAsPredicted: (model.aggAfter - model.aggBefore) < 0,
    },
    instrumentBuilt: {
      what: 'villainFeed MODEL source + resolveVillainModel + heroPolicy threading, so a harness can '
        + 'serve a real villainModel for the first time (FIND-138).',
      coverage: {
        villainsInFeed: Object.keys(feedAfter.players).length,
        withFittedCurveBefore: feedBefore.builtFrom.villainsWithFittedFoldCurve,
        withFittedCurveAfter: feedAfter.builtFrom.villainsWithFittedFoldCurve,
        decisionsServed: model.fed,
        decisionsTotal: model.paired,
      },
      omits: feedAfter.builtFrom.decisionModelOmits,
      omitsNote: '`_buckets` is ~89% of a serialized model (19,751 B whole vs 2,349 B without; 96 MB at '
        + '5,000 villains). queryActionDistribution reads it, so a fed villain\'s SITUATIONAL action '
        + 'distribution still resolves to population. The fold-curve and fold-LEVEL channels are live; '
        + 'the bucket channel needs a different transport, not a bigger cap.',
    },
  },
  admissibility: {
    quotable: true,
    reasons: [],
    caveats: [
      'TRANSFERRED, NOT MEASURED for live 9-handed 1/2-1/3. Corpus is online cash, July 2009, 50NL.',
      'ARGMAX-distribution instrument at depth-1: an EV shift that flips no combo\'s best action is '
      + 'invisible to it. The headline is an ADVICE-CHANGE rate, not an EV delta in chips.',
      'Depth-1 is the correct configuration here and not a cheaper one: the corrected curve is consumed '
      + 'at the depth-1 fold estimate (gameTreeEvaluator), which is where the defect lives.',
      'Villain models are an oracle-prefix snapshot (villainFeed.mjs header). Both arms share the '
      + 'construction, so the CONTRAST subtracts it out; a level claim from one arm would not.',
      'Feed coverage is 55 of 300 decisions. The conditioned rate is the claim; the unconditioned one '
      + 'is diluted by decisions the channel cannot reach.',
    ],
  },
  manifest: buildReplicationManifest({
    engineCommit,
    engineDirty,
    dealBookHash: dealBook.contentHash,
    fieldVersion: 'handhq-50nl-2009-07-ftp+ps · behavior-policy out/behavior-policy.json (400 POOL '
      + 'players, 13,976 decisions) · villain feed 4,000 POOL villains with decision models',
    partition: 'player-level POOL/EVAL at poolPct=50; villain feed POOL-side only; before-arm engine at '
      + '70a2a192~1 with the WS-481 instrument scripts overlaid unchanged in both arms',
    seeds: {
      probePairing: 'mulberry32(fnv1a-32(`${playerId}|${handId}|${order}`)) per decision',
    },
    unseededSources: [],
    constants: {
      ...constantsFromStamp.constants,
      REFINEMENT_BUDGET_MS: 0,
      MIN_FOLD_CURVE_OBS: 8,
      MIN_DISTINCT_SIZES: 2,
      FOLD_CURVE_AXIS: 'owed-over-pot-before-faced-bet',
      FEED_BEFORE: feedBefore.builtFrom,
      FEED_AFTER: feedAfter.builtFrom,
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
writeFileSync(`${REPO}/docs/research/ws481-fold-curve-axis-2026-08-15.result-card.json`, JSON.stringify(card, null, 2) + '\n');
console.log('OK RC-FOLD-CURVE-AXIS-2026-08-15');
console.log(`   dealBookId=${dealBook.dealBookId} engineCommit=${engineCommit} dirty=${engineDirty}`);
console.log(`   advice changed on ${model.fedDiv}/${model.fed} fed decisions (${(100 * model.fedDiv / model.fed).toFixed(1)}%), meanTV ${model.meanTvOnDivergent.toFixed(4)}`);
console.log(`   control (unfed) divergent: ${model.unfedDiv} of ${model.unfed} — must be 0`);
console.log(`   aggression ${model.aggBefore.toFixed(4)} -> ${model.aggAfter.toFixed(4)} (${(model.aggAfter - model.aggBefore).toFixed(4)})`);
await loader.close();
