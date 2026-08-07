/**
 * check-engine-bare-import.mjs — guard for the WS-433 worker-loadability property.
 *
 * The worker path imports the hero-EV task closure (~91 modules spanning rangeEngine,
 * exploitEngine, pokerCore, handAnalysis) under BARE Node ESM — no Vite. That property
 * was established by the WS-433 extensionless-import codemod and is exactly the kind of
 * thing one future `import x from './y'` (no extension) silently breaks: the Vite-loader
 * scripts keep passing while every worker thread dies on spawn.
 *
 * This check imports the closure under plain `node` and makes one trivial smoke call.
 * Wire it into preflight; it costs ~2s.
 *
 * Exit 0 = closure loads and evaluates; non-zero = the worker path is broken.
 */

const main = async () => {
  // Importing heroEvTask.mjs pulls the entire scoring closure, engine included.
  const { scoreHeroEvPlayer } = await import('./heroEvTask.mjs');
  const { evaluateGameTree } = await import('../../src/utils/exploitEngine/gameTreeEvaluator.js');
  const { handVsRange } = await import('../../src/utils/pokerCore/monteCarloEquity.js');
  const { buildRangeProfile } = await import('../../src/utils/rangeEngine/index.js');
  if (typeof scoreHeroEvPlayer !== 'function' || typeof evaluateGameTree !== 'function'
    || typeof handVsRange !== 'function' || typeof buildRangeProfile !== 'function') {
    throw new Error('closure imported but expected exports are missing');
  }

  // Smoke: one tiny seeded equity call proves the engine side actually evaluates.
  const { createRange, rangeIndex } = await import('../../src/utils/pokerCore/rangeMatrix.js');
  const { makeSeededEquityFn } = await import('./seededEquity.mjs');
  const range = createRange();
  range[rangeIndex(12, 12, false)] = 1.0; // AA
  const res = await makeSeededEquityFn(1)( [0, 13], range, [], { trials: 200, minTrials: 200 });
  if (!Number.isFinite(res.equity)) throw new Error(`smoke equity call returned ${JSON.stringify(res)}`);

  console.log('engine bare-import check: OK (closure loads under plain node; smoke call evaluated)');
};

main().catch((err) => {
  console.error(`engine bare-import check FAILED — the worker path is broken:\n${err?.stack || err}`);
  process.exit(1);
});
