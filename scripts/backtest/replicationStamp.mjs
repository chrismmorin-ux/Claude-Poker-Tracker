/**
 * replicationStamp.mjs — what code, which constants, which seeds.
 *
 * ADR-009 requires a Result Card to name the engine commit, every seed, and every load-bearing
 * constant the result depends on. NONE of the three was captured anywhere before WS-322:
 * `grep -rn "rev-parse" scripts/` finds nothing, `ipsEstimator` and `evCost` both default to
 * `0x9e3779b9` and neither writes it to an output file, and no run has ever recorded the value
 * of `PRIOR_WEIGHT` it ran under. Every figure this repo has published so far therefore names
 * the code that produced it only by implication — which was survivable exactly as long as
 * nobody needed to check one.
 *
 * CONSTANTS ARE READ FROM THEIR DEFINITION SITES, NEVER RE-DECLARED HERE. A stamp module that
 * held its own copy of `PRIOR_WEIGHT = 10` would record the value it believed rather than the
 * value the engine used, and the two would agree right up until the day they did not — at
 * which point the manifest would be confidently wrong, which is worse than absent. The loader
 * is the Vite SSR one the harness already uses for the engine itself, so a constant is read
 * through exactly the resolution path the app uses.
 */

import { execFileSync } from 'node:child_process';

import { knownDivergence } from '../../src/utils/standardOfRecord/manifest.js';
import { registerVersion } from '../../src/utils/standardOfRecord/faultRegister.js';

/**
 * Engine identity: the commit, and whether the tree was dirty.
 *
 * `engineDirty` is not decoration. A dirty tree means the commit does NOT identify the code
 * that ran, and a manifest that quietly recorded the SHA anyway would assert replicability it
 * cannot deliver. Saying so lets a reader discount the figure instead of trusting it.
 */
export const gitStamp = (cwd = process.cwd()) => {
  const git = (args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  try {
    return {
      engineCommit: git(['rev-parse', 'HEAD']),
      engineDirty: git(['status', '--porcelain']).length > 0,
    };
  } catch (err) {
    // A measurement that cannot identify its own code is not publishable, and a manifest that
    // silently substituted "unknown" would let it look publishable anyway.
    throw new Error(
      `replicationStamp: could not read the engine commit (${err?.message || err}). ` +
      'A Result Card must name the code that produced it; refusing to stamp a run that cannot.',
    );
  }
};

/**
 * Read the load-bearing constants through the harness loader.
 *
 * The minimum set is ADR-009's: PRIOR_WEIGHT, ACTION_TAU_FRACTION, MIN_CONTINUATION_WEIGHT.
 * Others are stamped alongside them where they are cheap and plausibly load-bearing —
 * `SUBCLASS_PRIOR_WEIGHT` and `TAU_FRACTION` are both read by the same code paths, and a
 * manifest is a place where over-capture is the correct bias.
 *
 * @param {{load: (path: string) => Promise<any>}} loader
 */
export const collectConstants = async (loader) => {
  const priors = await loader.load('/src/utils/rangeEngine/populationPriors.js');
  const soft = await loader.load('/src/utils/pokerCore/softWeights.js');
  const narrower = await loader.load('/src/utils/exploitEngine/postflopNarrower.js');
  const foldEq = await loader.load('/src/utils/exploitEngine/foldEquityCalculator.js');
  // WS-432: the logical refinement clock's own constants, read from their definition site.
  // MAX_STAGE_SHARE used to be a module-local const inside gameTreeEvaluator.js, unreadable
  // through the loader and recorded only as a knownDivergence with `agrees: null`; it now
  // lives in refinementWork.js precisely so this read is a real one.
  const refinement = await loader.load('/src/utils/exploitEngine/refinementWork.js');
  // FIND-090: KL_FLOOR from its canonical definition site. VOCABULARY.md documents it as
  // manifest-stamped by rule; before this only layerAblation.mjs spread it manually, so
  // every other card omitted a constant the doc said it carried.
  const divergence = await loader.load('/src/utils/standardOfRecord/divergence.js');

  const constants = {
    PRIOR_WEIGHT: priors.PRIOR_WEIGHT,
    SUBCLASS_PRIOR_WEIGHT: priors.SUBCLASS_PRIOR_WEIGHT,
    ACTION_TAU_FRACTION: { ...narrower.ACTION_TAU_FRACTION },
    TAU_FRACTION: soft.TAU_FRACTION,
    MIN_CONTINUATION_WEIGHT: soft.MIN_CONTINUATION_WEIGHT,
    MAX_STAGE_SHARE: refinement.MAX_STAGE_SHARE,
    REFINEMENT_UNITS_PER_MS: refinement.REFINEMENT_UNITS_PER_MS,
    REFINEMENT_CLOCK_VERSION: refinement.REFINEMENT_CLOCK_VERSION,
    KL_FLOOR: divergence.KL_FLOOR,
  };

  // The shadow. `foldEquityCalculator.js:661` declares a LOCAL `const PRIOR_WEIGHT = 10` that
  // is not exported and does not read the canonical one. Today both are 10, so nothing is
  // wrong — and that is exactly the condition under which the divergence is invisible.
  // Recording it means the day they drift, the manifest already says where to look.
  //
  // `foldEq.PRIOR_WEIGHT` is undefined precisely because the shadow is module-local; the
  // `?? null` keeps the record honest about that rather than pretending we read it.
  const knownDivergences = [
    knownDivergence({
      name: 'PRIOR_WEIGHT',
      canonical: constants.PRIOR_WEIGHT,
      shadowAt: 'src/utils/exploitEngine/foldEquityCalculator.js:661',
      shadowValue: foldEq.PRIOR_WEIGHT ?? null,
      note:
        'foldEquityCalculator declares a module-local PRIOR_WEIGHT that shadows the canonical ' +
        'one in rangeEngine/populationPriors.js. It is not exported, so its value cannot be ' +
        'read from outside — recorded here so a future divergence has somewhere to surface.',
    }),
  ];

  return { constants, knownDivergences };
};

/**
 * Randomness the hero-EV path CANNOT seed, named so a manifest cannot silently claim
 * bit-reproducibility it does not have.
 *
 * The chain is real and was verified rather than assumed: `heroPolicy` calls
 * `evaluateGameTree`, `gameTreeEvaluator.js:32` imports `handVsRange` from
 * `pokerCore/monteCarloEquity`, and that module calls `Math.random()` in its shuffle and its
 * weighted draw. So two runs of the same Deal Book with the same seeds produce CLOSE numbers,
 * not IDENTICAL ones, and the difference is Monte Carlo noise rather than a real change.
 *
 * This is not presented as a defect to fix here — it is a property of the instrument that any
 * reader comparing two Result Cards has to know about, and the manifest is where they will
 * look. `sampleCombos` is deliberately NOT on this list: it is systematic weight-proportional
 * sampling over a strength-sorted list, with no RNG at all.
 */
/**
 * RETIRED 2026-08-07 (WS-432): `REFINEMENT_CLOCK_UNSEEDED_SOURCE`.
 *
 * The entry (introduced by WS-393, canonical here so `run-hero-ev.mjs` and the depth
 * ablation shared one declaration) named the wall-clock refinement budget — "which
 * refinement stages complete depends on machine speed and load". WS-432 replaced the wall
 * clock with the deterministic logical work-unit clock (`refinementWork.js`,
 * REFINEMENT_CLOCK_VERSION 'logical-v1'): budget exhaustion is now a pure function of the
 * inputs, so the dependence the entry declared no longer exists on ANY code path.
 *
 * The export is DELETED rather than left empty, because `unseededSources` is a positive
 * claim and a stale entry is as wrong as a missing one — it would tell a reader to
 * discount a difference that is now real. Cards stamped before WS-432 keep the entry in
 * their own JSON, which is correct: it was true of the engine that produced them.
 */

export const HERO_EV_UNSEEDED_SOURCES = Object.freeze([
  {
    source: 'src/utils/pokerCore/monteCarloEquity.js',
    reached_via: 'heroPolicy -> evaluateGameTree -> handVsRange',
    mechanism: 'Math.random() in the deck shuffle and the weighted combo draw',
    consequence:
      'Two runs over the same Deal Book with identical seeds agree to within Monte Carlo ' +
      'noise, not exactly. Do not read a small difference between two Result Cards as a change.',
  },
]);

/**
 * WS-433. This entry is CLOSED when the run passes `--equity-seed`: the runner threads a
 * mulberry32 stream per engine call through the `equityFn` seam, seeded from position in
 * the stable work enumeration (`heroEvEnumeration.seedForCombo`), and the seed lands in
 * `seeds.equityMc`. A seeded run drops HERO_EV_UNSEEDED_SOURCES from its stamp — at
 * `refinementBudgetMs: 0` that makes `unseededSources: []` a TRUE positive claim,
 * verified by the parallel-vs-serial bit-identity gate.
 */

/**
 * RETIRED 2026-08-07 (WS-432): `WORKER_CONTENTION_SOURCE`.
 *
 * The entry (WS-433) named CPU contention under the WALL-CLOCK refinement budget: N
 * contended workers completed fewer stages per budget, so a parallel refined run measured
 * a differently-loaded engine than a serial one. Its own declaration promised retirement
 * "when WS-432's logical work-unit clock replaces the wall clock at all seven gate
 * sites" — that is this change. Under 'logical-v1', which stages complete is independent
 * of core count and load, so a parallel refined run and a serial one at the same seeds
 * are the SAME measurement. Deleted rather than kept-but-unused for the same
 * positive-claim reason as the retirement above.
 */

/**
 * Assemble everything a Result Card's manifest needs, except the Deal Book hash.
 *
 * Seeds are passed IN rather than discovered, because the only honest source for "which seed
 * did this run use" is the run itself. A default that a stamp module went and looked up would
 * be the stamp's belief about the seed, not the seed.
 *
 * @param {Object} input
 * @param {{load: Function}} input.loader
 * @param {Object} input.seeds - every seed actually used, by name
 * @param {string} input.dealBookHash
 * @param {string|null} [input.fieldVersion]
 * @param {string|null} [input.partition]
 */
export const buildStampInput = async ({
  loader,
  seeds,
  unseededSources = HERO_EV_UNSEEDED_SOURCES,
  dealBookHash,
  fieldVersion = null,
  partition = null,
  cwd = process.cwd(),
} = {}) => {
  const { constants, knownDivergences } = await collectConstants(loader);
  return {
    ...gitStamp(cwd),
    dealBookHash,
    fieldVersion,
    partition,
    seeds,
    unseededSources: [...unseededSources],
    constants,
    // WS-330. NOT a hand-maintained string: `registerVersion()` is the epoch plus a content
    // hash over the register body, so editing any entry changes what a run stamps whether or
    // not anyone remembered to bump anything. That is what makes the stamp usable in the other
    // direction — when a fault is later CONFIRMED, the cards that stood under the register
    // containing it can be found.
    disclaimerRegisterVersion: await registerVersion(),
    knownDivergences,
  };
};
