#!/usr/bin/env node
/**
 * layerAblation.mjs — FSA Phase 3. Measure BOTH candidate `d`s on one volume, then attribute
 * the divergence to a layer (WS-350).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS RUN IS FOR.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * FSA open question #2 — "KL versus EV-difference, decide in Phase 3, MEASURE BOTH" — has been
 * open since WS-322. WS-324 built the whole attribution substrate around it without closing it,
 * by requiring `d` as an argument with no default. This script is the measurement that was
 * owed: both measures, the same paired decisions, the primary PRE-REGISTERED before the run, and
 * the ranking disagreement (if any) reported as the finding rather than resolved by preference.
 *
 * `src/utils/standardOfRecord/divergence.js` is the ONE comparison path ADR-009 permits. This
 * script computes nothing itself; it produces atoms and hands them to that module. A divergence
 * arithmetic written here would be the second path the ADR forbids, wearing a script's clothes.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE SURFACES, AND WHY THESE ONES.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Three REAL configurations of the shipped engine, distinguished only by the depth-2/3
 * refinement budget:
 *
 *   sfc-depth1        refinementBudgetMs 0    — the configuration that actually shipped for the
 *                                               life of the project (WS-334 measured zero
 *                                               depth-2 calls on a live evaluation). REFERENCE.
 *   sfc-depth2-fast   a short budget          — candidate
 *   sfc-depth2-full   production's 2000ms     — candidate
 *
 * TWO candidates is the minimum for a ranking to exist at all, which is what AC2 needs: with one
 * candidate the two measures cannot disagree about an order, and "they agreed" would be a claim
 * the data could not make.
 *
 * They share their `range` and `equity` layers BY CONSTRUCTION — same `ctx.rangeBefore`, same
 * deterministic `sampleCombos`, same equity call — and differ only at `ev` and `action`. So the
 * expected attribution is `ev`, and any divergence landing on `equity` is Monte Carlo noise
 * (`FAULT-monte-carlo-irreproducibility`, register rank 9) rather than a difference between the
 * surfaces. That is a prediction this run can falsify, which is the point of making it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS RUN CANNOT DO, STATED BEFORE ANY NUMBER.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * 1. NO SUMMING BY-LAYER DECOMPOSITION. `decomposeByLayer{Telescoping,Shapley}` need layer
 *    functions pinned to the atom set's engine commit, evaluated on HYBRID inputs no atom
 *    records. For this stack that means re-running the engine on a substituted range — 2^L
 *    evaluations per decision at ~20s each. It is not affordable at any n worth reporting, so
 *    this run uses `localizeByLayer`, which is evaluation-free and carries `sumsToTotal: false`.
 *    The card therefore reports a first divergent LAYER and NO share. The sum identity (AC5) is
 *    asserted by test on the pinned fixture, where the layer functions are closed-form.
 *
 * 2. NO `foldProbability` LAYER. `heroPolicyAt` does not expose it. A stack may OMIT layers; it
 *    may not invent them, and emitting a fold probability this pass never computed would be a
 *    fabricated intermediate sitting in a permanent record.
 *
 * 3. THE POPULATION. HandHQ online cash, July 2009 (SRC-011/012). The founder's game is LIVE
 *    9-handed 1/2-1/3. Every figure here is TRANSFERRED, not measured, for that game —
 *    `FAULT-population-mismatch`, rank 1 of the register by expected damage.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * USAGE — the same surface as run-depth-ablation.mjs, because it reuses that harness's guards.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 *   node scripts/backtest/layerAblation.mjs \
 *     --reference none --behavior-policy out/behavior-policy.json \
 *     --stakes 50NLH --max-files 40 --max-players 40 --max-decisions 60 \
 *     --refinement-fast 200 --refinement-full 2000 \
 *     --primary ev-difference --weighting frequency \
 *     --out out/layer-ablation.json --card docs/standard-of-record/cards/RC-layer-divergence.json
 *
 * `--reference` and `--behavior-policy` have NO defaults, for the reason run-hero-ev states: the
 * shipped reference table was mined from the whole corpus and pi_pool is the denominator of every
 * importance weight. `--primary` is the PRE-REGISTRATION and is stamped into the card.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import { REFERENCE_DISABLED } from './leakageGuard.mjs';
import { hashObjectSync } from './contentHashNode.mjs';

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
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : null);
const int = (v, d) => (v === undefined ? d : Number.parseInt(v, 10));

/**
 * The range layer's recorded value.
 *
 * The full 169-cell grid is what the engine consumed, but the quantity the downstream layers
 * actually saw is the SAMPLED combo set — `heroPolicyAt` marginalizes over exactly those, and
 * `sampleCombos` is deterministic given the range and board. So the sampled weights ARE the full
 * input, and recording them is `valueKind: 'full'` honestly rather than by courtesy.
 *
 * Kept as a sorted weight vector so two arms' range layers are comparable elementwise without
 * anyone having to agree on a combo ordering afterwards.
 */
const rangeLayerValue = (perCombo) => ({
  nCombos: perCombo.length,
  weights: perCombo.map((c) => c.sampleWeight),
});

/** Range-weighted mean equity — the equity layer's scalar, from the combos the arm actually saw. */
const equityLayerValue = (perCombo) => {
  const W = perCombo.reduce((s, c) => s + c.sampleWeight, 0);
  if (!(W > 0)) return null;
  return perCombo.reduce((s, c) => s + c.sampleWeight * c.heroEquity, 0) / W;
};

/**
 * Per-layer distance in each layer's OWN space, for `localizeByLayer`.
 *
 * Injected rather than defaulted for the same reason `d` is: the right distance between two
 * range weight vectors is not the attribution module's to decide. Total variation for the two
 * distributional layers, absolute difference for the two scalar ones.
 *
 * NOTE the units do not commute across layers — a `range` figure in TV units and an `action`
 * figure in TV units are comparable to each other, an `ev` figure in chips is not comparable to
 * either. That is exactly why a localization carries no share.
 */
const makeDLayer = (tv) => (a, b, layer) => {
  if (layer === 'action') return tv(a, b);
  if (layer === 'range') {
    const wa = a?.weights ?? [];
    const wb = b?.weights ?? [];
    if (wa.length !== wb.length) return 1;
    return wa.reduce((s, w, i) => s + Math.abs(w - wb[i]), 0) / 2;
  }
  if (Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b);
  return NaN;
};

/** Total variation between two action distributions. Test-free helper, not a divergence measure. */
const totalVariation = (a, b) => {
  if (!a || !b) return NaN;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let s = 0;
  for (const k of keys) s += Math.abs((a[k] ?? 0) - (b[k] ?? 0));
  return s / 2;
};

const main = async () => {
  const args = parseArgs(process.argv);

  if (args.reference === undefined) {
    console.error(`Refused: --reference is required. Pass a POOL-partition table path, or the explicit "${REFERENCE_DISABLED}" sentinel.`);
    process.exit(2);
  }
  const reference = args.reference === REFERENCE_DISABLED
    ? REFERENCE_DISABLED
    : JSON.parse(readFileSync(args.reference, 'utf8'));

  if (typeof args['behavior-policy'] !== 'string') {
    console.error('Refused: --behavior-policy is required. pi_pool is the denominator of every importance weight.');
    process.exit(2);
  }
  const behaviorPolicy = JSON.parse(readFileSync(args['behavior-policy'], 'utf8'));

  const refinementFast = int(args['refinement-fast'], 200);
  const refinementFull = int(args['refinement-full'], 2000);
  if (!(refinementFull > refinementFast && refinementFast > 0)) {
    console.error('Refused: --refinement-full must exceed --refinement-fast, and both must be > 0, or the two candidates are the same surface.');
    process.exit(2);
  }

  let rakeConfig = { pct: 0.05, cap: 3, noFlopNoDrop: true };
  if (args.rake === 'none') rakeConfig = null;

  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { buildDealBook } = await loader.load('/scripts/backtest/dealBook.mjs');
    const { buildStampInput, HERO_EV_UNSEEDED_SOURCES } = await loader.load('/scripts/backtest/replicationStamp.mjs');
    const { DEPTH_ABLATION_UNSEEDED_SOURCES } = await loader.load('/scripts/backtest/depthAblationReport.mjs');
    const { LeakageGuard } = await loader.load('/scripts/backtest/leakageGuard.mjs');
    const { validateBehaviorPolicy } = await loader.load('/scripts/backtest/behaviorPolicy.mjs');
    const { indexEvalPlayers } = await loader.load('/scripts/backtest/runner.mjs');
    const { heroPolicyAt } = await loader.load('/scripts/backtest/heroPolicy.mjs');
    const { decisionGeometry } = await loader.load('/scripts/backtest/decisionGeometry.mjs');
    const { buildRangeProfile } = await loader.load('/src/utils/rangeEngine/index.js');
    const { accumulateDecisions } = await loader.load('/src/utils/exploitEngine/decisionAccumulator.js');
    const { formatSituationKey } = await loader.load('/src/utils/pokerCore/situationKey.js');

    const SOR = await loader.load('/src/utils/standardOfRecord/index.js');
    const {
      buildDecisionAtom, buildLayerEmission, buildAtomSetManifest,
      buildLayer, buildSurfaceEntry, firstStructuralDivergence,
      preRegisterPrimary, measureBoth, rankSurfaces, klFloorSweep, divergenceFn, outputOfAtom,
      KL_FLOOR, DIVERGENCE_MEASURES,
      localizeByLayer, decomposeBySituation, attributeFirstLayer,
      buildReplicationManifest, buildResultCard, manifestProblems,
      buildComparisonCensus, censusSummary, contrastKey,
      buildMargin, buildFragility, buildFlipRegister,
    } = SOR;

    // ── THE PRE-REGISTRATION. Built BEFORE a single decision is scored. ──────────────────
    //
    // Its position in this file is load-bearing: nothing below it can be reordered to let the
    // numbers pick the primary. It is stamped into the card verbatim.
    const preRegistration = preRegisterPrimary({
      primary: typeof args.primary === 'string' ? args.primary : 'ev-difference',
      weighting: typeof args.weighting === 'string' ? args.weighting : 'frequency',
      at: new Date().toISOString(),
      rationale: typeof args.rationale === 'string' ? args.rationale
        : 'EV-difference is pre-registered PRIMARY because the estimand this repo acts on is '
        + 'money: ADR-009 binds "comparative claims about strategy, model quality, or EV", and a '
        + 'surface that behaves differently at no cost has not changed the thing being claimed. '
        + 'KL is reported beside it, on the same volume, because it is the measure that would '
        + 'catch a surface whose behaviour changed everywhere while its own EV model happened to '
        + 'value both choices identically — which is exactly what a self-grading instrument '
        + '(FAULT-self-grading-circularity) would look like from the inside. If the two rank the '
        + 'candidates differently, that disagreement is the headline of this run.',
    });
    console.log(`PRE-REGISTERED primary = ${preRegistration.primary} / ${preRegistration.weighting} at ${preRegistration.at}`);

    const corpusRoot = typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT;
    let files = await discoverCorpusFiles({
      root: corpusRoot, sites: list(args.sites), stakes: list(args.stakes),
    });
    if (files.length === 0) { console.error('No corpus files matched.'); process.exit(2); }
    const maxFiles = int(args['max-files'], Infinity);
    if (Number.isFinite(maxFiles) && files.length > maxFiles) {
      console.log(`Corpus scan LIMITED to ${maxFiles} of ${files.length} matched file(s).`);
      files = files.slice(0, maxFiles);
    }

    const poolPct = int(args['pool-pct'], 50);
    const dealBook = await buildDealBook({
      files,
      root: corpusRoot,
      sliceSpec: {
        root: corpusRoot, sites: list(args.sites), stakes: list(args.stakes),
        maxFiles: Number.isFinite(maxFiles) ? maxFiles : null,
        maxPlayers: int(args['max-players'], null),
        maxHandsPerPlayer: int(args['max-hands-per-player'], null),
      },
      identity: args['hash-members'] ? 'content' : 'path+size',
    });
    console.log(`Deal Book ${dealBook.dealBookId} — ${dealBook.memberCount} file(s), ${dealBook.contentHash.slice(0, 20)}…`);

    // ── the arms, as REGISTERED SURFACES with declared stacks ────────────────────────────
    //
    // `buildSurfaceEntry` REFUSES a surface that does not declare what it is made of (WS-324).
    // Registering here rather than describing in prose means the stack this run measures is the
    // stack the run declared, checked by the same code that checks every other surface.
    const STACK = [
      buildLayer({
        layer: 'range',
        inputs: ['ctx.rangeBefore', 'board'],
        outputType: 'sampledComboWeights',
        assumptions: ['systematic weight-proportional sampling, strength-ordered (heroPolicy.sampleCombos)'],
      }),
      buildLayer({
        layer: 'equity',
        inputs: ['range', 'board', 'villainRange'],
        outputType: 'scalar',
        assumptions: ['monteCarloEquity at the run trials count', 'villain held at POPULATION_PRIORS baseline'],
      }),
      buildLayer({
        layer: 'ev',
        inputs: ['equity', 'potGeometry', 'rakeConfig'],
        outputType: 'scalar',
        assumptions: ['modelled rake schedule (the corpus records none)', 'depth-2/3 refinement at this arm\'s budget'],
      }),
      buildLayer({
        layer: 'action',
        inputs: ['ev'],
        outputType: 'actionDistribution',
        assumptions: ['argmax per combo, marginalized over hero\'s range posterior'],
      }),
    ];

    const ARMS = [
      { surfaceId: 'sfc-depth1', refinementBudgetMs: 0, role: 'reference' },
      { surfaceId: 'sfc-depth2-fast', refinementBudgetMs: refinementFast, role: 'candidate' },
      { surfaceId: 'sfc-depth2-full', refinementBudgetMs: refinementFull, role: 'candidate' },
    ];
    const surfaces = ARMS.map((a) => buildSurfaceEntry({
      surfaceId: a.surfaceId,
      surfaceKind: 'Read',
      sources: ['SRC-011', 'SRC-012'],
      stack: STACK,
      pool: 'online-50NL-2009',
    }));

    // ── guards, all before any work ──────────────────────────────────────────────────────
    const guard = new LeakageGuard({ poolPct, reference });
    validateBehaviorPolicy(behaviorPolicy, poolPct);

    const comboSamples = int(args['combo-samples'], 10);
    const trials = int(args.trials, 200);
    const minTrainHands = int(args['min-train-hands'], 15);
    const checkpointInterval = int(args['checkpoint-interval'], 10);
    const maxDecisions = int(args['max-decisions'], Infinity);

    const { byPlayer, handsRead } = await indexEvalPlayers({
      files, poolPct,
      maxPlayers: int(args['max-players'], Infinity),
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      onProgress: ({ handsRead: h, players }) => console.log(`  read ${h} hands, ${players} eval players`),
    });
    console.log(`  indexed ${byPlayer.size} EVAL players from ${handsRead} hands`);

    // ── the scoring pass ─────────────────────────────────────────────────────────────────
    const atomsBySurface = Object.fromEntries(ARMS.map((a) => [a.surfaceId, []]));
    const counters = { checkpoints: 0, skippedCheckpoints: 0, geometrySkips: 0, armFailures: {}, engineErrors: 0 };
    const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
    const started = Date.now();
    let stop = false;

    for (const [playerId, hands] of byPlayer) {
      if (stop) break;
      guard.assertEvalPlayer(playerId);

      for (let cp = minTrainHands; cp < hands.length; cp += checkpointInterval) {
        if (stop) break;
        const trainHands = hands.slice(0, cp);
        const testHands = hands.slice(cp, cp + checkpointInterval);
        if (testHands.length === 0) break;

        let trainProfile;
        try { trainProfile = buildRangeProfile(playerId, trainHands, 'backtest'); }
        catch { counters.skippedCheckpoints++; continue; }
        if (!trainProfile) { counters.skippedCheckpoints++; continue; }
        counters.checkpoints++;

        const ctxs = [];
        try {
          accumulateDecisions(playerId, testHands, trainProfile, 'backtest', {
            onDecision: (ctx) => {
              guard.assertWalkForward({ playerId, trainEndIdx: cp, handIdx: cp + ctx.handIdx });
              ctxs.push(ctx);
            },
          });
        } catch { counters.skippedCheckpoints++; continue; }

        for (const ctx of ctxs) {
          if (stop) break;
          const geo = decisionGeometry(ctx.hand, ctx.order, ctx.street);
          if (!geo) { counters.geometrySkips++; continue; }

          // ONE PASS PER ARM, and a decision is kept only if EVERY arm produced a policy —
          // the exact-pairing rule `heroEvRunner` states. A skip pattern that correlated with
          // refinement budget would otherwise enter the divergence as if it were divergence.
          const byArm = {};
          let armFailure = null;
          for (const arm of ARMS) {
            // eslint-disable-next-line no-await-in-loop -- the engine call IS the cost
            const res = await heroPolicyAt({
              ctx, hand: ctx.hand, rakeConfig, comboSamples, trials,
              refinementBudgetMs: arm.refinementBudgetMs,
            });
            counters.engineErrors += res.engineErrors ?? 0;
            if (!res.ok || !res.evStats || !res.perCombo?.length) {
              armFailure = `${arm.surfaceId}:${res.reason ?? 'no-ev-or-equity'}`;
              break;
            }
            byArm[arm.surfaceId] = res;
          }
          if (armFailure) { bump(counters.armFailures, armFailure); continue; }

          // The WS-317 structured key, serialized by its owner. NOT a positional string of this
          // script's own devising — `decisionAtom.js` names that as the failure it refuses.
          const situationKey = formatSituationKey({
            street: ctx.street, texture: ctx.texture, posCategory: ctx.posCategory,
            isAgg: ctx.isAgg, isIP: ctx.isIP, facingAction: ctx.facingAction,
            contextAction: ctx.contextAction,
          });
          const atomId = hashObjectSync({ playerId, handId: ctx.handId, order: ctx.order });

          for (const arm of ARMS) {
            const res = byArm[arm.surfaceId];
            atomsBySurface[arm.surfaceId].push(buildDecisionAtom({
              atomId,
              situationKey,
              carried: {
                sprBand: null,
                playersRemaining: null,
                source: 'SRC-012',
                pool: 'online-50NL-2009',
                street: ctx.street,
              },
              surfaceId: arm.surfaceId,
              action: res.actions,
              ruleId: null,
              warrant: null,
              layers: [
                buildLayerEmission({
                  layer: 'range', value: rangeLayerValue(res.perCombo), valueKind: 'full',
                  assumptions: STACK[0].assumptions,
                }),
                buildLayerEmission({
                  layer: 'equity', value: equityLayerValue(res.perCombo), valueKind: 'full',
                  assumptions: STACK[1].assumptions,
                }),
                buildLayerEmission({
                  layer: 'ev', value: res.evStats.statedEvMean, valueKind: 'full',
                  assumptions: STACK[2].assumptions,
                }),
                buildLayerEmission({
                  layer: 'action', value: res.actions, valueKind: 'full',
                  assumptions: STACK[3].assumptions,
                }),
              ],
              // NOT `realizedChips`. The hand's net is in bb over the WHOLE hand; `ev` is a
              // per-decision quantity in engine chips. heroEvRunner records that they are not on
              // the same scale, so naming the net as this layer's ground truth would invite a
              // difference nobody may take.
              outcome: { netBB: null, wentToShowdown: null },
              seeds: { comboSampling: 'systematic-deterministic' },
              actorSeat: Number.isFinite(Number(ctx.playerSeat)) ? Number(ctx.playerSeat) : null,
              actorRole: 'hero',
            }));
          }

          if (atomsBySurface[ARMS[0].surfaceId].length % 10 === 0) {
            console.log(`  scored ${atomsBySurface[ARMS[0].surfaceId].length} decisions x ${ARMS.length} arms (${Math.round((Date.now() - started) / 1000)}s)`);
          }
          if (atomsBySurface[ARMS[0].surfaceId].length >= maxDecisions) stop = true;
        }
      }
    }

    const n = atomsBySurface[ARMS[0].surfaceId].length;
    console.log(`\nScored ${n} decisions across ${ARMS.length} surfaces in ${Math.round((Date.now() - started) / 1000)}s.`);
    if (n === 0) {
      // Counters, not a bare failure. A run that scored nothing has told you WHY it scored
      // nothing, and throwing that away is how a filter bug reads as an empty corpus.
      console.error(`No decisions scored — nothing to measure.\ncounters: ${JSON.stringify(counters, null, 2)}`);
      process.exit(2);
    }

    // ── THE MEASUREMENT. All of it through divergence.js. ────────────────────────────────
    const referenceAtoms = atomsBySurface['sfc-depth1'];
    const candidates = ARMS.filter((a) => a.role === 'candidate')
      .map((a) => ({ surfaceId: a.surfaceId, atoms: atomsBySurface[a.surfaceId] }));

    const ranking = rankSurfaces({ referenceAtoms, candidates, preRegistration });
    const floorSweep = klFloorSweep({ referenceAtoms, candidates, preRegistration });

    // Attribution against the FULL candidate — the production configuration.
    const full = atomsBySurface['sfc-depth2-full'];
    const dLayer = makeDLayer(totalVariation);
    const localization = localizeByLayer({ atomsA: referenceAtoms, atomsB: full, dLayer });
    const structural = firstStructuralDivergence(referenceAtoms[0].layers, full[0].layers);
    const bySituation = decomposeBySituation({
      atomsA: referenceAtoms, atomsB: full,
      d: divergenceFn(preRegistration.primary), outputOf: outputOfAtom,
    });
    const attribution = attributeFirstLayer({
      structuralDivergence: structural,
      localization,
      // No summing decomposition: see limit #1 in the header. `shareAvailable: false` and its
      // reason travel in the payload rather than being explained in prose nobody reads.
      decomposition: null,
    });

    // The same attribution under the SECONDARY measure, so a by-situation decomposition exists
    // for both and a reader can see whether the situation ranking moves with the measure too.
    const bySituationSecondary = decomposeBySituation({
      atomsA: referenceAtoms, atomsB: full,
      d: divergenceFn(preRegistration.secondary[0]), outputOf: outputOfAtom,
    });

    // ── the card ─────────────────────────────────────────────────────────────────────────
    const stamp = await buildStampInput({
      loader,
      seeds: { comboSampling: 'systematic-deterministic' },
      unseededSources: [...HERO_EV_UNSEEDED_SOURCES, ...DEPTH_ABLATION_UNSEEDED_SOURCES],
      dealBookHash: dealBook.contentHash,
      fieldVersion: behaviorPolicy?.provenance?.partition
        ? `behavior-policy@${behaviorPolicy.provenance.partition}/${behaviorPolicy.provenance.observations ?? '?'}obs`
        : null,
      partition: `pool-train@${poolPct}`,
    });
    stamp.constants = {
      ...stamp.constants,
      // THE INSTRUMENT'S OWN load-bearing constants. `KL_FLOOR` is the one that sets the
      // magnitude of every KL figure here — see divergence.js. A card without it names a
      // number nobody can reconstruct.
      KL_FLOOR,
      // WS-432: one canonical key, keyed by arm id (was REFINEMENT_BUDGET_MS_REFERENCE/
      // _FAST/_FULL — a suffix scheme that collided with the depth-ablation card's).
      REFINEMENT_BUDGET_MS: { reference: 0, fast: refinementFast, full: refinementFull },
      HERO_POLICY_COMBO_SAMPLES: comboSamples,
      HERO_POLICY_TRIALS: trials,
    };
    if (stamp.engineDirty) {
      console.log('  WARNING: working tree is dirty — the stamped commit does not identify the code that ran.');
    }
    const manifest = buildReplicationManifest(stamp);

    const atomSetManifest = buildAtomSetManifest({
      atomSetId: `layer-ablation-${dealBook.contentHash.replace('sha256:', '').slice(0, 12)}`,
      surfaceId: 'sfc-depth1',
      fullSampleRate: 1,
      atomCount: n * ARMS.length,
    });
    const atomSetHash = hashObjectSync({
      manifest: atomSetManifest,
      atomIds: referenceAtoms.map((a) => a.atomId),
    });

    // Margin to flip, from the swept KL floor. `sweptRange` is required context for a null
    // flip point: "does not flip" is unreadable without knowing where you looked.
    const fragility = buildFragility({
      margins: [buildMargin({
        name: 'KL_FLOOR',
        value: KL_FLOOR,
        flipsAt: floorSweep.flipsAt,
        sweptRange: floorSweep.sweptRange,
        note: 'The probability floor under KL. heroPolicy applies NO smoothing, so a flipped '
          + 'argmax against a hard zero contributes ~ln(1/floor) nats. The floor therefore sets '
          + 'the magnitude of every KL figure on this card. EV-difference has no equivalent knob, '
          + 'which is itself a difference between the two candidate measures.',
      })],
    });

    const census = buildComparisonCensus({
      axis: 'surface',
      members: ARMS.map((a) => a.surfaceId),
      drawn: candidates.map((c) => ({
        contrast: contrastKey('sfc-depth1', c.surfaceId),
        resultCardId: 'RC-layer-divergence',
      })),
      blockedReasons: {},
    });

    const primaryOf = (surfaceId, measure) =>
      ranking.perSurface[surfaceId].byMeasure[measure][preRegistration.weighting];

    const card = buildResultCard({
      resultCardId: `RC-layer-divergence-${dealBook.contentHash.replace('sha256:', '').slice(0, 8)}-${stamp.engineCommit.slice(0, 8)}`,
      match: {
        surfaceId: 'sfc-depth1 vs sfc-depth2-fast vs sfc-depth2-full',
        dealBookId: dealBook.dealBookId,
        fieldId: 'pool-mined-behavior-policy',
      },
      estimand:
        'Divergence between the shipped depth-1 advice surface and two depth-2/3-refined advice '
        + 'surfaces, at one hero decision, measured under BOTH candidate definitions of `d` on '
        + 'the SAME paired decisions: KL(reference||candidate) over the range-marginalized action '
        + 'distribution (nats), and |EV_reference - EV_candidate| over the engine\'s own stated EV '
        + '(engine chips). NOT an edge: both measures are unsigned distances, so neither says '
        + 'which surface is better. Reported per decision (frequency-weighted) and per situation '
        + '(uniform-weighted), with the primary PRE-REGISTERED before the run.',
      treatment:
        'ONE hero decision is replaced by the surface under test; the rest of the hand plays out '
        + 'as recorded. Population: online 6-max and full-ring, July 2009 (SRC-011/012). The '
        + 'founder\'s game is LIVE 9-handed 1/2-1/3, a distinct population — any live claim here '
        + 'is TRANSFERRED, not measured (FAULT-population-mismatch, register rank 1). Advice is '
        + 'RANGE-MARGINALIZED: the value of the advice averaged over hands hero COULD hold, not '
        + 'the hand hero held. Rake is MODELLED; the corpus records none.',
      metrics: {
        kind: 'layer-divergence', // WS-434: dispatches to SOR_SCHEMAS['metrics.layer-divergence']
        // THE PAIR. Both measures, both weightings, one volume. Neither is omitted and neither
        // is presented alone — that is what makes the pre-registration checkable after the fact.
        divergence: {
          preRegistration,
          comparableByMagnitude: false,
          klDirection: ranking.perSurface[candidates[0].surfaceId].klDirection,
          weightingReported: preRegistration.weighting,
          bySurface: Object.fromEntries(candidates.map((c) => [c.surfaceId, {
            volume: ranking.perSurface[c.surfaceId].volume,
            kl: ranking.perSurface[c.surfaceId].byMeasure.kl,
            'ev-difference': ranking.perSurface[c.surfaceId].byMeasure['ev-difference'],
          }])),
          ranking: {
            klOrder: ranking.klOrder,
            evOrder: ranking.evOrder,
            // THE HEADLINE when false. See divergence.js — never resolved by preference.
            ranksAgree: ranking.ranksAgree,
            swaps: ranking.swaps,
            allOrders: ranking.orders,
            // Whether the ORDER is an order of signal or of noise. Sorting point estimates
            // always returns an order, including when the candidates are indistinguishable.
            pairwiseSeparation: ranking.pairwiseSeparation,
          },
          klFloorSweep: floorSweep,
        },
        attribution: {
          contrast: 'sfc-depth1 vs sfc-depth2-full',
          ...attribution,
          localization: {
            instrument: localization.instrument,
            sumsToTotal: localization.sumsToTotal,
            n: localization.n,
            layers: localization.layers,
            firstDivergentLayer: localization.firstDivergentLayer,
          },
          bySituation: {
            primaryMeasure: preRegistration.primary,
            total: bySituation.total,
            n: bySituation.n,
            shares: bySituation.shares,
          },
          bySituationSecondary: {
            measure: preRegistration.secondary[0],
            total: bySituationSecondary.total,
            n: bySituationSecondary.n,
            shares: bySituationSecondary.shares,
          },
          summingDecompositionAvailable: false,
          summingDecompositionReason:
            'decomposeByLayer{Telescoping,Shapley} require layer functions PINNED to this atom '
            + 'set\'s engine commit and evaluated on HYBRID inputs no atom records — for this '
            + 'stack that is 2^L engine re-runs per decision at ~20s each, unaffordable at any n '
            + 'worth reporting. The sum identity (by-layer total == by-situation total) is '
            + 'asserted by test on the pinned closed-form fixture instead: '
            + 'src/utils/standardOfRecord/__tests__/divergence.test.js.',
        },
        counters,
        notAnEdge: true,
      },
      clusterUnit: 'players',
      admissibility: {
        // Stated rather than computed to a verdict, following heroEvReport: a verdict WITH its
        // reasons, never a score that hides which input was weak.
        quotable: n >= 30,
        reasons: [
          `n = ${n} paired decisions across ${byPlayer.size} EVAL players`,
          'unsigned divergence, not an edge — no surface is claimed better than another',
          'no summing by-layer decomposition (see metrics.attribution.summingDecompositionReason)',
          'transferred, not measured, for live 9-handed 1/2-1/3',
        ],
      },
      manifest,
      atomSetHash,
      atomCount: n * ARMS.length,
      anchorGeneration: 1,
      fragility,
      flipRegister: null,
      comparisonCensus: census,
    });

    const problems = manifestProblems(card.manifest);
    console.log(`\nmanifestProblems: ${problems.length === 0 ? 'NONE — card is publishable' : problems.join('; ')}`);

    // ── report ───────────────────────────────────────────────────────────────────────────
    const L = [];
    L.push('');
    L.push('=== FSA PHASE 3 — BOTH CANDIDATE `d`s, ONE VOLUME (WS-350) ===');
    L.push(`Result Card ${card.resultCardId}`);
    L.push(`PRE-REGISTERED primary: ${preRegistration.primary} / ${preRegistration.weighting}  (at ${preRegistration.at})`);
    L.push(`n = ${n} paired decisions, ${ranking.perSurface[candidates[0].surfaceId].volume.nSituations} distinct situations, ${byPlayer.size} EVAL players`);
    L.push('');
    L.push('  surface                 KL (nats)              EV-difference (chips)');
    for (const c of candidates) {
      const kl = primaryOf(c.surfaceId, 'kl');
      const ev = primaryOf(c.surfaceId, 'ev-difference');
      const f = (m) => `${m.mean.toFixed(5)} ${m.ci ? `[${m.ci[0].toFixed(5)}, ${m.ci[1].toFixed(5)}]` : '(no CI, n<2)'}${m.admissible ? '' : ' n.s.'}`;
      L.push(`  ${c.surfaceId.padEnd(22)} ${f(kl).padEnd(38)} ${f(ev)}`);
    }
    L.push('');
    L.push(`  KL order:            ${ranking.klOrder.join('  >  ')}`);
    L.push(`  EV-difference order: ${ranking.evOrder.join('  >  ')}`);
    L.push(`  RANKS AGREE: ${ranking.ranksAgree ? 'yes' : 'NO — this disagreement is the finding, not a tie to break'}`);
    if (!ranking.ranksAgree) for (const s of ranking.swaps) L.push(`    ${s.surfaceId}: KL rank ${s.klRank}, EV rank ${s.evRank}`);
    L.push('');
    L.push(`  KL floor swept over [${floorSweep.sweptRange[0]}, ${floorSweep.sweptRange[1]}]; KL ordering flips at: ${floorSweep.flipsAt ?? 'nowhere in the swept range'}`);
    L.push('');
    L.push('--- LAYER ATTRIBUTION (sfc-depth1 vs sfc-depth2-full) ---');
    L.push(`  first layer:        ${attribution.firstLayer ?? 'none — the surfaces did not admissibly separate at any layer'} (from: ${attribution.firstLayerFrom ?? 'n/a'})`);
    L.push(`  structural:         ${attribution.structuralLayer ?? 'none — identical declared stacks'}`);
    L.push(`  share of total:     ${attribution.shareAvailable ? attribution.shareOfTotal : 'UNAVAILABLE'}`);
    if (!attribution.shareAvailable) L.push(`     why: ${attribution.shareUnavailableReason}`);
    L.push('  per-layer localization (own units; NOT shares, sumsToTotal=false):');
    for (const [layer, s] of Object.entries(localization.layers)) {
      L.push(`    ${layer.padEnd(16)} mean ${s.mean.toExponential(3)}  ${s.ci ? `[${s.ci[0].toExponential(2)}, ${s.ci[1].toExponential(2)}]` : ''}  ${s.admissible ? 'admissible' : 'n.s.'}  n=${s.n}`);
    }
    L.push('');
    L.push(`  by-situation total (${preRegistration.primary}): ${bySituation.total.toExponential(4)} over ${Object.keys(bySituation.shares).length} situations`);
    L.push(`  by-situation total (${preRegistration.secondary[0]}): ${bySituationSecondary.total.toExponential(4)}`);
    L.push('');
    const cs = censusSummary(census);
    L.push(`  comparison census: ${cs.drawn}/${cs.possible} contrasts drawn, ${cs.notAttempted} not attempted`);
    if (cs.notAttempted > 0) L.push(`    not attempted: ${cs.notAttemptedContrasts.join(', ')}`);
    L.push('');
    L.push('READ THE DISCLAIMER: docs/standard-of-record/DISCLAIMER-AND-FAULT-REGISTER.md §1.');
    L.push('The corpus is online 2009; the founder\'s game is live 9-handed 1/2-1/3. Every figure');
    L.push('above is TRANSFERRED, not measured, for that game.');
    console.log(L.join('\n'));

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify({
        card,
        surfaces,
        preRegistration,
        ranking,
        floorSweep,
        localization,
        bySituation,
        bySituationSecondary,
        atomSetManifest,
        counters,
        atoms: args['emit-atoms'] ? atomsBySurface : undefined,
      }, null, 2));
      console.log(`\nWrote ${args.out}`);
    }
    if (typeof args.card === 'string') {
      mkdirSync(dirname(args.card), { recursive: true });
      writeFileSync(args.card, JSON.stringify(card, null, 2));
      console.log(`Wrote ${args.card}`);
    }
    if (problems.length > 0) process.exit(3);
  } finally {
    await loader.close();
  }
};

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
