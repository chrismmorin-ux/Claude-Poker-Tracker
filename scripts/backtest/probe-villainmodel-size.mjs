#!/usr/bin/env node
/**
 * probe-villainmodel-size.mjs — FIND-138 sizing probe.
 *
 * The villain feed must carry enough of `buildVillainDecisionModel`'s output for the engine
 * to behave as it does in the app. How much that costs per villain decides whether the feed
 * can carry the WHOLE model or has to name what it leaves out. Measured, not guessed.
 */
import { openLoader } from './loader.mjs';

const main = async () => {
  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { indexEvalPlayers } = await loader.load('/scripts/backtest/runner.mjs');
    const { GROUPS } = await loader.load('/scripts/backtest/partition.mjs');
    const { buildRangeProfile } = await loader.load('/src/utils/rangeEngine/index.js');
    const { accumulateDecisions } = await loader.load('/src/utils/exploitEngine/decisionAccumulator.js');
    const { buildVillainDecisionModel } = await loader.load('/src/utils/exploitEngine/villainDecisionModel.js');

    const files = (await discoverCorpusFiles({ root: DEFAULT_CORPUS_ROOT, stakes: ['50NLH'] })).slice(0, 120);
    const { byPlayer } = await indexEvalPlayers({
      files, maxPlayers: 40, maxHandsPerPlayer: 200, group: GROUPS.POOL,
    });

    let n = 0, full = 0, noBuckets = 0, curveOnly = 0, withCurve = 0;
    for (const [pid, hands] of byPlayer) {
      if (!Array.isArray(hands) || hands.length < 15) continue;
      let model;
      try {
        const profile = buildRangeProfile(pid, hands, 'sizeprobe');
        const summary = accumulateDecisions(pid, hands, profile, 'sizeprobe');
        model = buildVillainDecisionModel(summary, {});
      } catch { continue; }
      n++;
      if (model?.personalizedFoldCurve) withCurve++;
      full += JSON.stringify(model).length;
      const { _buckets, ...rest } = model;
      noBuckets += JSON.stringify(rest).length;
      curveOnly += JSON.stringify({
        personalizedFoldCurve: model.personalizedFoldCurve ?? null,
        foldEstimates: model.foldEstimates ?? null,
        totalObservations: model.totalObservations ?? 0,
        modelQuality: model.modelQuality ?? null,
      }).length;
    }

    const kb = (b) => (b / 1024).toFixed(1);
    console.log(`\n=== FIND-138 villain-model serialization cost (n=${n} POOL villains) ===`);
    console.log(`villains with a fitted personalizedFoldCurve : ${withCurve} / ${n}`);
    console.log(`mean bytes/villain  FULL model               : ${(full / n).toFixed(0)}  (${kb(full / n)} KB)`);
    console.log(`mean bytes/villain  model minus _buckets     : ${(noBuckets / n).toFixed(0)}`);
    console.log(`mean bytes/villain  curve + foldEstimates    : ${(curveOnly / n).toFixed(0)}`);
    console.log(`\nprojected feed size at 5000 villains:`);
    console.log(`  FULL        ${kb(5000 * full / n)} KB`);
    console.log(`  no _buckets ${kb(5000 * noBuckets / n)} KB`);
    console.log(`  curve only  ${kb(5000 * curveOnly / n)} KB`);
  } finally {
    await loader.close();
  }
};
main().catch((e) => { console.error(e); process.exit(1); });
