#!/usr/bin/env node
/**
 * dump-records.mjs — emit PER-DECISION paired records, not just a scorecard.
 *
 * WHY THIS EXISTS. `run.mjs` builds a scorecard and discards the records, so the
 * only questions it can answer are MARGINAL: lift by street, OR by sprZone, OR
 * by facingAction. Two classes of question it structurally cannot answer:
 *
 *   1. PAIRED-ON-DIVERGENT. When two hierarchy arms are compared, most decisions
 *      route identically and contribute exactly zero to the difference. Judging
 *      the arms on a full-sample aggregate dilutes the real effect by the ratio
 *      of identical to divergent decisions. For shipped-vs-texture-last that
 *      ratio is ~9.4:1, which is enough to turn a real effect into "noise".
 *   2. INTERACTIONS. A -0.2% average over `facingAction=bet` can be a strong
 *      positive region and a strong negative region cancelling. Only conditional
 *      subsets show that. The fold-error sign flip across sizing buckets
 *      (+4.0pp small / -13.3pp medium) is the proof this happens here.
 *
 * Every arm is scored in ONE pass over the corpus (runBacktest takes `arms`),
 * and every arm sees the SAME decisions in the SAME order — so records are
 * index-paired across arms and can be differenced per decision.
 *
 * USAGE
 *   node scripts/backtest/dump-records.mjs --reference out/pool-reference.json \
 *     --arms ablation --max-players 300 --max-hands-per-player 300 \
 *     --out out/records.json
 *
 *   --arms ablation    ctrl:full, ctrl:none, shipped, and only:<dim>/drop:<dim>
 *                      for each of street/texture/posCategory/isAgg/isIP
 *   --arms texture     shipped vs texture-last (the paired-on-divergent case)
 *   --arms candidates  WS-285 bake-off: reordered / shrinkage:W* / min-n-* against
 *                      shipped, ctrl:none and only:isAgg
 *   --arms priors      WS-436: shipped vs priors:population vs priors:style-labels —
 *                      the model-build axis (what seeds the Dirichlet priors)
 *   --arms poles       WS-436 §4d: shipped vs priors:population vs pole-soft/pole-hard
 *                      (requires --pole-priors <path> from mine-pole-priors.mjs)
 *   --arms all         every set
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import { REFERENCE_DISABLED } from './leakageGuard.mjs';
import { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } from './corpusFiles.mjs';
import {
  HIERARCHY_VARIANTS, hierarchyOptionsFor, buildAblationArms, buildCandidateArms,
  buildShrinkWeightSweepArms, buildPriorSourceArms, buildPoleArms,
} from './hierarchyVariants.mjs';

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) args[k] = true;
    else { args[k] = n; i++; }
  }
  return args;
};
const list = (v) => (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : null);
const int = (v, d) => (v === undefined ? d : Number.parseInt(v, 10));

const textureArms = () => ([
  { name: HIERARCHY_VARIANTS.SHIPPED, kind: 'control', dim: null, hierarchyOptions: {} },
  {
    name: 'texture-last',
    kind: 'variant',
    dim: 'texture',
    hierarchyOptions: hierarchyOptionsFor('texture-last'),
  },
]);

const main = async () => {
  const args = parseArgs(process.argv);
  const log = (m) => console.log(m);

  if (args.reference === undefined) {
    throw new Error('Missing --reference. Pass a POOL table path or `--reference none`.');
  }
  const reference = (args.reference === 'none' || args.reference === true)
    ? REFERENCE_DISABLED
    : JSON.parse(readFileSync(args.reference, 'utf8'));

  const which = typeof args.arms === 'string' ? args.arms : 'ablation';
  const dedupe = (list) => {
    const seen = new Set();
    return list.filter(a => {
      if (seen.has(a.name)) return false;
      seen.add(a.name); return true;
    });
  };
  let arms;
  if (which === 'texture') arms = textureArms();
  else if (which === 'candidates') arms = buildCandidateArms();
  else if (which === 'wsweep') arms = buildShrinkWeightSweepArms();
  else if (which === 'priors') arms = buildPriorSourceArms();
  else if (which === 'poles') arms = buildPoleArms();
  else if (which === 'all') {
    arms = dedupe([
      ...buildAblationArms(), ...buildCandidateArms(), ...textureArms(),
      ...buildPriorSourceArms(),
    ]);
  } else arms = buildAblationArms();

  // WS-436 §4d: the pole arms need the mined artifact.
  const polePriors = typeof args['pole-priors'] === 'string'
    ? JSON.parse(readFileSync(args['pole-priors'], 'utf8'))
    : null;
  if (arms.some(a => String(a.priorSource || '').startsWith('pole-')) && !polePriors) {
    throw new Error('--arms poles requires --pole-priors <path> (build with mine-pole-priors.mjs).');
  }

  const files = await discoverCorpusFiles({
    root: args['corpus-root'] || DEFAULT_CORPUS_ROOT,
    sites: list(args.sites),
    stakes: list(args.stakes),
  });
  log(`Discovered ${files.length} corpus file(s). Scoring ${arms.length} arms in one pass.`);

  const loader = await openLoader(process.cwd());
  try {
    const { runBacktest } = await loader.load('/scripts/backtest/runner.mjs');
    const run = await runBacktest({
      files,
      reference,
      poolPct: int(args['pool-pct'], 50),
      maxPlayers: int(args['max-players'], Infinity),
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      minTrainHands: int(args['min-train-hands'], 15),
      checkpointInterval: int(args['checkpoint-interval'], 10),
      arms,
      polePriors,
      log,
    });

    // Slim the records: keep only what conditional analysis needs. The full
    // `predicted` distribution is retained because log-loss must be recomputed
    // per decision (the scorecard's aggregate cannot be un-aggregated).
    const slim = {};
    for (const [name, recs] of Object.entries(run.recordsByArm)) {
      slim[name] = recs.map(r => ({
        p: r.predicted,
        b: r.baseline,
        a: r.actual,
        src: r.source,
        conf: r.confidence,
        s: r.slices,
        m: {
          texture: r._meta?.texture,
          posCategory: r._meta?.posCategory,
          sizeBucket: r._meta?.sizeBucket,
          potBB: r._meta?.potBB,
          facingBetBB: r._meta?.facingBetBB,
          handIdx: r._meta?.handIdx,
          trainEndIdx: r._meta?.trainEndIdx,
        },
      }));
    }

    const out = typeof args.out === 'string' ? args.out : 'out/records.json';
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({
      arms: run.arms,
      integrity: run.integrity,
      counters: run.counters,
      recordsByArm: slim,
    }));
    const n = Object.values(slim)[0]?.length ?? 0;
    log(`Wrote ${out} — ${Object.keys(slim).length} arms x ${n} decisions.`);
  } finally {
    await loader.close();
  }
};

main().catch((e) => { console.error(`\n${e.message}\n`); process.exit(1); });
