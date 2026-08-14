#!/usr/bin/env node
/**
 * run-river-flip-replicate.mjs — WS-378 AC1. Is the 80% river flip rate systematic, or seed noise?
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 *  THE QUESTION, AND WHY IT HAD TO BE ASKED BEFORE ANY FIX.
 *
 *  The WS-334 AC5 depth ablation (`RC-depth-ablation-1c560bcc-67e9e14e`) found the top action
 *  flipping on 36 of 45 RIVER decisions between the depth-1 arm (refinementBudgetMs=0) and the
 *  depth-2 arm (2000ms). The river cannot reach depth-2 — `needsDepth2: street !== 'river'` —
 *  so what the river arm actually toggles is the `riverPerCombo` stage
 *  (`gameTreeEvaluator.js:1409`), gated on the same budget.
 *
 *  WS-295 measured depth-2 argmax stability as low as 0.50 on wet boards. A SINGLE evaluation
 *  per arm therefore cannot distinguish a genuine flip from an RNG draw at the level of an
 *  individual decision, and 80% is an UPPER BOUND. This probe re-evaluates the SAME 45 river
 *  decisions R times per arm, varying only the RNG seed, and reports:
 *
 *    - per decision, in how many of R replicates the top action flipped;
 *    - the SYSTEMATIC rate (flipped in ALL R) with a Wilson interval — that number, not 80%,
 *      is what any downstream work is about;
 *    - per-arm argmax stability across seeds, which localises WHERE the randomness enters.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * WHAT IS REUSED, AND WHAT IS NOT. The estimator is `heroPolicy.heroPolicyAt` — the same
 * function the ablation calls, at the same comboSamples/trials/rake, so this is the instrument
 * re-run and not a second one. The flip definition is `depthAblationReport.adviceDivergence`,
 * imported rather than re-implemented, so "flip" means here exactly what it meant there.
 *
 * The ONE thing this file re-states is the corpus TRAVERSAL, because `runHeroEv` scores every
 * decision it visits and has no way to say "engine-call only these 45". Re-running all 260 at
 * R replicates would cost ~9 hours to answer a question about 45 of them. The traversal is
 * therefore copied from `heroEvRunner` (same reader, same partition, same walk-forward guard,
 * same checkpoint arithmetic) and guarded against drift by a FIDELITY CHECK: the decisions it
 * reaches must be exactly the (playerId, handId, order) keys the original run recorded. A
 * traversal that had drifted would fail that check rather than quietly measure other hands.
 *
 * THE CLOCK IS FROZEN, and on the river that is close to free. `riverPerCombo` is the FIRST
 * refinement stage and is bounded by `maxCombos: 200`, not by the clock — it takes no
 * per-stage budget. Its gate is evaluated before any work is charged, so it opens under any
 * positive budget and never bails partway. Freezing `Date.now` removes machine load as a
 * confounder without changing which stages run on this street. `refinementBudgetMs: 0` is
 * still checked EXPLICITLY (`gameTreeEvaluator.isBudgetExceeded`), so the depth-1 arm remains
 * depth-1 under a frozen clock. Both arms in a replicate are seeded from the SAME value, so
 * the pairing that makes the ablation a paired design is preserved draw-for-draw.
 * WS-432: refinement gating now reads the logical work meter, never `Date.now`, so the
 * `freeze` below is INERT for refinement gates on every street — it remains only to pin
 * `Math.random` (and the historical FROZEN_NOW timestamp fields). The determinism this
 * script bought by freezing the clock is now the engine's own property.
 *
 * USAGE
 *   node scripts/backtest/run-river-flip-replicate.mjs \
 *     --behavior-policy out/behavior-policy.json --reference none \
 *     --source out/depth-ablation.json --street river --replicates 5 \
 *     --stakes 50NLH --max-files 300 --max-players 300 --max-hands-per-player 60 \
 *     --out out/river-flip-replicate.json --card docs/standard-of-record/cards/RC-river-flip-replicate.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import { REFERENCE_DISABLED } from './leakageGuard.mjs';

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

/** Same generator `run-optimism-probe` and `dumpGameTreeEV` use: a seed means one draw sequence. */
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FROZEN_NOW = 1_700_000_000_000;
const realNow = Date.now;
const realRandom = Math.random;
const freeze = (seed) => { const rng = mulberry32(seed); Math.random = () => rng(); Date.now = () => FROZEN_NOW; };
const restore = () => { Date.now = realNow; Math.random = realRandom; };

const ARMS = [
  { id: 'depth1', refinementBudgetMs: 0 },
  { id: 'depth2', refinementBudgetMs: 2000 },
];

const argmax = (dist) => {
  let best = null; let bestP = -Infinity;
  for (const [a, p] of Object.entries(dist ?? {})) if (p > bestP) { bestP = p; best = a; }
  return best;
};

/**
 * Wilson score interval. Used rather than a normal approximation because the systematic rate is
 * expected near a boundary (0 or 1) at n=45, where the normal interval runs outside [0,1] and
 * reads as precision it does not have.
 */
const wilson = (k, n, z = 1.96) => {
  if (!n) return { lo: null, hi: null };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { lo: Number(Math.max(0, (c - s) / d).toFixed(4)), hi: Number(Math.min(1, (c + s) / d).toFixed(4)) };
};

const keyOf = (d) => `${d.playerId}|${d.handId}|${d.order}`;

const main = async () => {
  const args = parseArgs(process.argv);

  if (args.reference === undefined) {
    console.error(`Refused: --reference is required (path, or the explicit "${REFERENCE_DISABLED}" sentinel).`);
    process.exit(2);
  }
  const reference = args.reference === REFERENCE_DISABLED
    ? REFERENCE_DISABLED : JSON.parse(readFileSync(args.reference, 'utf8'));
  if (typeof args['behavior-policy'] !== 'string') {
    console.error('Refused: --behavior-policy is required — it is the partition this run must reproduce.');
    process.exit(2);
  }
  const behaviorPolicy = JSON.parse(readFileSync(args['behavior-policy'], 'utf8'));
  if (typeof args.source !== 'string') {
    console.error('Refused: --source must point at the depth-ablation artifact whose decisions are being replicated.');
    process.exit(2);
  }

  const R = int(args.replicates, 5);
  if (!(R >= 2)) { console.error('--replicates must be >= 2; the whole design is repeated draws at one decision.'); process.exit(2); }
  const seeds = Array.from({ length: R }, (_, i) => int(args['seed-base'], 1000) + i);
  const street = typeof args.street === 'string' ? args.street : 'river';

  // ── the target set: exactly the decisions the original run recorded on this street ─────────
  const source = JSON.parse(readFileSync(args.source, 'utf8'));
  const sourceDecisions = source?.run?.decisions ?? [];
  const targets = new Map();
  for (const d of sourceDecisions) {
    if ((d.slices?.street ?? null) !== street) continue;
    targets.set(keyOf(d), d);
  }
  if (targets.size === 0) { console.error(`No ${street} decisions in ${args.source}.`); process.exit(2); }
  // SMOKE ONLY. A capped target set makes the traversal fidelity check vacuous, so a run that
  // uses it says so on the artifact rather than looking like the full replicate.
  const maxTargets = int(args['max-targets'], Infinity);
  if (Number.isFinite(maxTargets) && targets.size > maxTargets) {
    for (const k of [...targets.keys()].slice(maxTargets)) targets.delete(k);
    console.log(`  *** SMOKE: target set capped at ${maxTargets} — NOT the full replicate ***`);
  }
  console.log(`Target set: ${targets.size} ${street} decision(s) from ${args.source}`);
  console.log(`Replicates: ${R}  seeds ${seeds[0]}..${seeds[seeds.length - 1]}  clock FROZEN at ${FROZEN_NOW}`);

  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { indexEvalPlayers } = await loader.load('/scripts/backtest/runner.mjs');
    const { LeakageGuard } = await loader.load('/scripts/backtest/leakageGuard.mjs');
    const { validateBehaviorPolicy } = await loader.load('/scripts/backtest/behaviorPolicy.mjs');
    const { heroPolicyAt } = await loader.load('/scripts/backtest/heroPolicy.mjs');
    const { decisionGeometry } = await loader.load('/scripts/backtest/decisionGeometry.mjs');
    const { DEFAULT_RAKE_CONFIG } = await loader.load('/scripts/backtest/heroEvRunner.mjs');
    const { adviceDivergence } = await loader.load('/scripts/backtest/depthAblationReport.mjs');
    const { clusterBootstrapCI, DEFAULT_BOOTSTRAP_SEED } = await loader.load('/scripts/backtest/ipsEstimator.mjs');
    const { buildRangeProfile } = await loader.load('/src/utils/rangeEngine/index.js');
    const { accumulateDecisions } = await loader.load('/src/utils/exploitEngine/decisionAccumulator.js');
    const { buildDealBook } = await loader.load('/scripts/backtest/dealBook.mjs');
    const { buildStampInput } = await loader.load('/scripts/backtest/replicationStamp.mjs');
    const { buildReplicationManifest } = await loader.load('/src/utils/standardOfRecord/manifest.js');
    const { buildResultCard, resultCardProblems } = await loader.load('/src/utils/standardOfRecord/resultCard.js');

    const corpusRoot = typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT;
    let files = await discoverCorpusFiles({ root: corpusRoot, sites: list(args.sites), stakes: list(args.stakes) });
    const maxFiles = int(args['max-files'], Infinity);
    if (Number.isFinite(maxFiles) && files.length > maxFiles) files = files.slice(0, maxFiles);
    if (files.length === 0) { console.error('No corpus files matched.'); process.exit(2); }

    const poolPct = int(args['pool-pct'], 50);
    const maxPlayers = int(args['max-players'], Infinity);
    const maxHandsPerPlayer = int(args['max-hands-per-player'], Infinity);
    const minTrainHands = int(args['min-train-hands'], 15);
    const checkpointInterval = int(args['checkpoint-interval'], 10);
    const comboSamples = int(args['combo-samples'], 10);
    const trials = int(args.trials, 200);
    const rakeConfig = args.rake === 'none' ? null : DEFAULT_RAKE_CONFIG;

    const dealBook = await buildDealBook({
      files,
      root: corpusRoot,
      sliceSpec: {
        root: corpusRoot, sites: list(args.sites), stakes: list(args.stakes),
        maxFiles: Number.isFinite(maxFiles) ? maxFiles : null,
        maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : null,
        maxHandsPerPlayer: Number.isFinite(maxHandsPerPlayer) ? maxHandsPerPlayer : null,
      },
      identity: 'path+size',
    });
    console.log(`Deal Book ${dealBook.dealBookId} — ${dealBook.memberCount} file(s)`);

    const guard = new LeakageGuard({ poolPct, reference });
    const policy = validateBehaviorPolicy(behaviorPolicy, poolPct);

    const { byPlayer } = await indexEvalPlayers({
      files, poolPct, maxPlayers, maxHandsPerPlayer,
      onProgress: ({ handsRead: h, players }) => console.log(`  read ${h} hands, ${players} eval players`),
    });
    console.log(`  indexed ${byPlayer.size} EVAL players`);

    // ── the traversal. Identical in shape to heroEvRunner's, but the engine is called ONLY at
    //    a target key, and only R x |arms| times there. ────────────────────────────────────────
    const rows = [];
    const seen = new Set();
    const started = realNow();
    let stop = false;

    for (const [playerId, hands] of byPlayer) {
      if (stop) break;
      guard.assertEvalPlayer(playerId);
      for (let cp = minTrainHands; cp < hands.length && !stop; cp += checkpointInterval) {
        const trainHands = hands.slice(0, cp);
        const testHands = hands.slice(cp, cp + checkpointInterval);
        if (testHands.length === 0) break;

        let trainProfile;
        try { trainProfile = buildRangeProfile(playerId, trainHands, 'backtest'); } catch { continue; }
        if (!trainProfile) continue;

        const ctxs = [];
        try {
          accumulateDecisions(playerId, testHands, trainProfile, 'backtest', {
            onDecision: (ctx) => {
              guard.assertWalkForward({ playerId, trainEndIdx: cp, handIdx: cp + ctx.handIdx });
              ctxs.push(ctx);
            },
          });
        } catch { continue; }

        for (const ctx of ctxs) {
          const key = `${playerId}|${ctx.handId}|${ctx.order}`;
          if (!targets.has(key) || seen.has(key)) continue;
          if (!decisionGeometry(ctx.hand, ctx.order, ctx.street)) continue;
          seen.add(key);

          const byRep = [];
          for (let r = 0; r < R; r++) {
            const seed = seeds[r];
            const byArm = {};
            let failed = null;
            for (const arm of ARMS) {
              freeze(seed); // BOTH arms from the same seed: the pairing is draw-for-draw.
              let res;
              try {
                // eslint-disable-next-line no-await-in-loop -- the engine call IS the cost
                res = await heroPolicyAt({
                  ctx, hand: ctx.hand, rakeConfig, comboSamples, trials,
                  refinementBudgetMs: arm.refinementBudgetMs,
                });
              } finally { restore(); }
              if (!res.ok) { failed = `${arm.id}:${res.reason}`; break; }
              byArm[arm.id] = res;
            }
            if (failed) { byRep.push({ seed, failed }); continue; }
            byRep.push({
              seed,
              piOursByArm: Object.fromEntries(ARMS.map((a) => [a.id, byArm[a.id].actions])),
              depthReached: Object.fromEntries(ARMS.map((a) => [a.id, byArm[a.id].evStats?.depthReachedMax ?? null])),
              statedEvMean: Object.fromEntries(ARMS.map((a) => [a.id, byArm[a.id].evStats?.statedEvMean ?? null])),
            });
          }

          rows.push({
            key, playerId, handId: ctx.handId, order: ctx.order,
            slices: targets.get(key).slices,
            sourcePiOursByArm: targets.get(key).piOursByArm,
            replicates: byRep,
          });
          const mins = ((realNow() - started) / 60000).toFixed(1);
          console.log(`  ${rows.length}/${targets.size} replicated (${mins} min elapsed)`);
          if (seen.size >= targets.size) { stop = true; break; }
        }
      }
    }

    // ── FIDELITY: did the traversal reach the decisions the original run recorded? ────────────
    const missing = [...targets.keys()].filter((k) => !seen.has(k));
    const fidelity = {
      targeted: targets.size,
      reached: rows.length,
      missing,
      exact: missing.length === 0 && !Number.isFinite(maxTargets),
      smokeCapped: Number.isFinite(maxTargets) ? maxTargets : null,
      note: 'A traversal that had drifted from heroEvRunner would fail to reach these keys. '
        + 'Missing keys are reported rather than silently replaced by whatever was found.',
    };

    // ── analysis ─────────────────────────────────────────────────────────────────────────────
    const perDecision = rows.map((row) => {
      const usable = row.replicates.filter((r) => r.piOursByArm);
      const flips = usable.map((r) => argmax(r.piOursByArm.depth1) !== argmax(r.piOursByArm.depth2));
      const nFlip = flips.filter(Boolean).length;
      const stability = {};
      for (const arm of ARMS) {
        const tops = usable.map((r) => argmax(r.piOursByArm[arm.id]));
        const counts = {};
        for (const t of tops) counts[t] = (counts[t] || 0) + 1;
        stability[arm.id] = tops.length ? Number((Math.max(...Object.values(counts)) / tops.length).toFixed(4)) : null;
      }
      const srcFlip = argmax(row.sourcePiOursByArm?.depth1) !== argmax(row.sourcePiOursByArm?.depth2);
      const dir = usable.length && flips[0]
        ? `${argmax(usable[0].piOursByArm.depth1)}->${argmax(usable[0].piOursByArm.depth2)}`
        : null;
      return {
        key: row.key, handId: row.handId, order: row.order, slices: row.slices,
        replicatesUsable: usable.length,
        flipCount: nFlip,
        flipRate: usable.length ? Number((nFlip / usable.length).toFixed(4)) : null,
        classification: !usable.length ? 'unusable'
          : nFlip === usable.length ? 'systematic'
            : nFlip === 0 ? 'never'
              : 'seed-dependent',
        argmaxStability: stability,
        direction: dir,
        sourceRunFlipped: srcFlip,
        topByArm: Object.fromEntries(ARMS.map((a) => [
          a.id, usable.map((r) => argmax(r.piOursByArm[a.id])),
        ])),
      };
    });

    const usableRows = perDecision.filter((d) => d.classification !== 'unusable');
    const n = usableRows.length;
    const systematic = usableRows.filter((d) => d.classification === 'systematic').length;
    const seedDependent = usableRows.filter((d) => d.classification === 'seed-dependent').length;
    const never = usableRows.filter((d) => d.classification === 'never').length;
    const directions = {};
    for (const d of usableRows) if (d.direction) directions[d.direction] = (directions[d.direction] || 0) + 1;

    // Reuse the ablation's own flip definition, replicate by replicate, so the per-replicate
    // flip share printed here is computed by the SAME code that produced the 80%.
    const perReplicateDivergence = seeds.map((seed, i) => {
      const decisions = rows
        .map((row) => ({ piOursByArm: row.replicates[i]?.piOursByArm, slices: row.slices }))
        .filter((d) => d.piOursByArm);
      return { seed, ...adviceDivergence(decisions, { baseArm: 'depth1', testArm: 'depth2' }) };
    });

    const perArmStability = Object.fromEntries(ARMS.map((a) => {
      const vals = usableRows.map((d) => d.argmaxStability[a.id]).filter((x) => x !== null);
      return [a.id, {
        meanStability: vals.length ? Number((vals.reduce((s, x) => s + x, 0) / vals.length).toFixed(4)) : null,
        minStability: vals.length ? Math.min(...vals) : null,
        decisionsWithAnyInstability: vals.filter((x) => x < 1).length,
      }];
    }));

    // TWO intervals, because they answer two different questions and quoting one for the other
    // is the mistake this file exists to avoid.
    //
    //   Wilson over DECISIONS — how precisely is the systematic share pinned down AT THESE 45
    //     NODES. It is the right error bar for "did the 80% survive replication", which is a
    //     statement about this fixed node set.
    //   Cluster bootstrap over PLAYERS — whether the share would hold on other river spots.
    //     Decisions are not independent within a player (same hand history, same range profile),
    //     so this is the only interval that may be read as generalising, and it is the one the
    //     Result Card carries because `clusterUnit` is a promise about exactly that.
    const byPlayerRows = new Map();
    for (const d of usableRows) {
      const pid = d.key.split('|')[0];
      if (!byPlayerRows.has(pid)) byPlayerRows.set(pid, []);
      byPlayerRows.get(pid).push({ systematic: d.classification === 'systematic' ? 1 : 0 });
    }
    const meanSystematic = (chunk) => (chunk.length
      ? chunk.reduce((s, x) => s + x.systematic, 0) / chunk.length : null);
    const playerCI = byPlayerRows.size >= 2
      ? clusterBootstrapCI(byPlayerRows, meanSystematic, { resamples: 2000, alpha: 0.05, seed: DEFAULT_BOOTSTRAP_SEED })
      : null;

    const summary = {
      street,
      contributingPlayers: byPlayerRows.size,
      systematicFlipShareCI95Players: playerCI
        ? { lo: Number(playerCI.lo.toFixed(4)), hi: Number(playerCI.hi.toFixed(4)), resamples: playerCI.resamples }
        : null,
      replicates: R,
      seeds,
      n,
      systematicFlips: systematic,
      systematicFlipShare: n ? Number((systematic / n).toFixed(4)) : null,
      systematicFlipShareCI95: wilson(systematic, n),
      seedDependentFlips: seedDependent,
      seedDependentShare: n ? Number((seedDependent / n).toFixed(4)) : null,
      neverFlips: never,
      // The upper bound the source run reported on this same set, recomputed here so the two
      // are not compared across artifacts by hand.
      sourceRunFlips: perDecision.filter((d) => d.sourceRunFlipped).length,
      sourceRunFlipShare: perDecision.length
        ? Number((perDecision.filter((d) => d.sourceRunFlipped).length / perDecision.length).toFixed(4)) : null,
      flipDirections: directions,
      perArmArgmaxStability: perArmStability,
      perReplicateFlipShare: perReplicateDivergence.map((d) => ({ seed: d.seed, n: d.n, flips: d.topActionFlips, share: d.topActionFlipShare })),
    };

    // ── Result Card. The flip share is a COMPARATIVE claim about two configurations of one
    //    surface, so ADR-009 binds it. Same Match shape the depth ablation used. ──────────────
    const stamp = await buildStampInput({
      loader,
      seeds: { rngReplicates: seeds, generator: 'mulberry32' },
      // With Math.random patched and the clock frozen, the two sources the depth ablation had to
      // declare are CLOSED for this probe. An empty list is a positive claim, so it is made only
      // because the patch covers every consumer in-process — and the one residual risk is named.
      unseededSources: [{
        source: 'process-global Math.random patch',
        reached_via: 'freeze(seed) around every heroPolicyAt call',
        mechanism: 'The patch is in-process only. Any randomness reached through a worker, a '
          + 'native binding, or a module that captured Math.random at import time would escape it.',
        consequence: 'Bit-reproducibility is claimed for this process on this commit, not proven '
          + 'across engines. The measured per-arm argmax stability is the empirical check.',
      }],
      dealBookHash: dealBook.contentHash,
      fieldVersion: behaviorPolicy?.provenance?.partition
        ? `behavior-policy@${behaviorPolicy.provenance.partition}/${behaviorPolicy.provenance.observations ?? '?'}obs` : null,
      partition: `pool-train@${poolPct}`,
    });
    stamp.constants = {
      ...stamp.constants,
      // WS-432: one canonical key, keyed by arm id (was REFINEMENT_BUDGET_MS_DEPTH1/_DEPTH2).
      REFINEMENT_BUDGET_MS: { depth1: 0, depth2: 2000 },
      HERO_POLICY_COMBO_SAMPLES: comboSamples,
      HERO_POLICY_TRIALS: trials,
      RIVER_PER_COMBO_MAX_COMBOS: 200,
      FROZEN_NOW,
    };

    let resultCard = null;
    let cardProblems = [];
    try {
      resultCard = buildResultCard({
        resultCardId: `RC-river-flip-replicate-${String(stamp.dealBookHash).replace('sha256:', '').slice(0, 8)}-${String(stamp.engineCommit).slice(0, 8)}`,
        match: { surfaceId: 'engine-read', dealBookId: dealBook.dealBookId, fieldId: 'pool-mined-behavior-policy' },
        estimand:
          'Share of RIVER decisions (from the WS-334 AC5 paired set) at which the top action '
          + 'differs between refinementBudgetMs=0 and refinementBudgetMs=2000 in EVERY ONE of R '
          + 'seeded replicates. Outcome-free: it is a property of the engine, not of realized '
          + 'chips. NOT an EV claim, NOT a winrate, and NOT a verdict on riverPerCombo.',
        treatment:
          'Paired within-decision contrast between two configurations of the same surface, '
          + 'replicated R times per decision with Math.random seeded per replicate (mulberry32) '
          + 'and Date.now frozen. Both arms of a replicate draw from the same seed.',
        metrics: {
          kind: 'river-flip-replicate', // WS-434: dispatches to SOR_SCHEMAS['metrics.river-flip-replicate']
          systematicFlipShare: summary.systematicFlipShare,
          // The quotable interval, clustered on PLAYERS as `clusterUnit` promises.
          systematicFlipCiLow: summary.systematicFlipShareCI95Players?.lo ?? null,
          systematicFlipCiHigh: summary.systematicFlipShareCI95Players?.hi ?? null,
          // The within-node-set precision, named separately so it can never be mistaken for
          // the generalising one.
          systematicFlipCiLowBinomialOverDecisions: summary.systematicFlipShareCI95.lo,
          systematicFlipCiHighBinomialOverDecisions: summary.systematicFlipShareCI95.hi,
          seedDependentShare: summary.seedDependentShare,
          singleEvaluationFlipShare: summary.sourceRunFlipShare,
          // WS-434 Stage 2: the headline share as a canonical conditioned rate (exact k/n,
          // not the 4dp-rounded display value), plus unit-suffixed CI aliases. Emitted
          // beside the v1 names forever.
          systematicFlip: {
            k: systematic,
            n,
            rate: n ? systematic / n : null,
            conditional: `P(top action differs between arms in all ${R} seeded replicates | ${street} decision in the paired target set)`,
          },
          systematicFlipCiLowShare: summary.systematicFlipShareCI95Players?.lo ?? null,
          systematicFlipCiHighShare: summary.systematicFlipShareCI95Players?.hi ?? null,
          n,
          players: byPlayerRows.size,
          replicates: R,
          flipDirections: directions,
          perArmArgmaxStability: perArmStability,
          notAVerdict: true,
        },
        clusterUnit: 'players',
        admissibility: {
          admissible: fidelity.exact && n > 0 && byPlayerRows.size >= 2,
          blockers: [
            ...(fidelity.exact ? [] : [{ code: 'TRAVERSAL_DRIFT', detail: `${missing.length} target decision(s) unreachable, or the target set was smoke-capped; the replicated set is not the measured set.` }]),
            ...(n > 0 ? [] : [{ code: 'NO_DECISIONS', detail: 'No decision produced a usable replicate.' }]),
            ...(byPlayerRows.size >= 2 ? [] : [{ code: 'NO_CI_POSSIBLE', detail: `Only ${byPlayerRows.size} contributing player(s); a cluster bootstrap needs at least 2.` }]),
          ],
          warnings: [
            { code: 'FIXED_NODE_SET', detail: 'The 45 river nodes are the ones the WS-334 pass happened to reach, not a random sample of river spots. The player-clustered interval is the generalising one; the binomial-over-decisions interval reported beside it is the precision AT THESE NODES and must not be quoted as generalisation.' },
            ...(byPlayerRows.size < 30 ? [{ code: 'TOO_FEW_CLUSTERS', detail: `${byPlayerRows.size} contributing players is below the 30-cluster bar used elsewhere in this harness. The share is a structural tally and does not depend on the absolute arm edges, but its player-clustered interval is wide and should be read as such.` }] : []),
            ...(R < 5 ? [{ code: 'FEW_REPLICATES', detail: `${R} replicates — a decision classified "systematic" has only been shown stable across ${R} seeds.` }] : []),
          ],
        },
        manifest: buildReplicationManifest(stamp),
      });
    } catch (err) {
      cardProblems = [err?.message || String(err), ...resultCardProblems({ manifest: { ...stamp } })];
    }

    const out = {
      scope: [
        'FAULT-population-mismatch (register rank 1). HandHQ ONLINE cash, July 2009, numeric '
        + "stakes. The founder's game is LIVE 9-handed 1/2-1/3. Any live reading is TRANSFERRED, "
        + 'not measured.',
        'OUTCOME-FREE. This measures whether the engine CHANGES ITS MIND, not whether either '
        + 'answer is right. A systematic flip rate of 1.00 says the flips are real, not correct.',
        'CLUSTERED ON DECISIONS. The 45 river nodes are the ones the WS-334 pass happened to '
        + 'reach; they are not a random sample of river spots.',
      ],
      config: {
        street, replicates: R, seeds, generator: 'mulberry32', frozenNow: FROZEN_NOW,
        arms: ARMS, comboSamples, trials, rakeConfig, poolPct, minTrainHands, checkpointInterval,
        maxFiles: Number.isFinite(maxFiles) ? maxFiles : null, maxPlayers, maxHandsPerPlayer,
        source: args.source,
      },
      fidelity,
      summary,
      perDecision,
      perReplicateDivergence,
      resultCard,
      resultCardProblems: cardProblems,
      runtimeMs: realNow() - started,
    };

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify(out, null, 2));
      console.log(`\nWrote ${args.out}`);
    }
    if (typeof args.card === 'string' && resultCard) {
      mkdirSync(dirname(args.card), { recursive: true });
      writeFileSync(args.card, JSON.stringify(resultCard, null, 2));
      console.log(`Wrote ${args.card}`);
    }

    console.log('');
    console.log('═'.repeat(92));
    console.log(`  RIVER FLIP REPLICATE — is the ${street} flip rate systematic or seed noise?  (WS-378 AC1)`);
    console.log('═'.repeat(92));
    console.log(`  traversal fidelity        ${fidelity.reached}/${fidelity.targeted} target decisions reached  exact=${fidelity.exact}`);
    console.log(`  replicates per decision   ${R}   seeds ${seeds.join(',')}   clock frozen`);
    console.log('');
    console.log(`  single-evaluation flips (the 80% upper bound)   ${summary.sourceRunFlips}/${perDecision.length} = ${summary.sourceRunFlipShare}`);
    console.log(`  SYSTEMATIC (flipped in all ${R})                 ${systematic}/${n} = ${summary.systematicFlipShare}`);
    console.log(`    binomial over decisions  CI95 [${summary.systematicFlipShareCI95.lo}, ${summary.systematicFlipShareCI95.hi}]   (precision AT these nodes)`);
    console.log(`    cluster bootstrap over ${String(byPlayerRows.size).padStart(2)} players  CI95 ${summary.systematicFlipShareCI95Players ? `[${summary.systematicFlipShareCI95Players.lo}, ${summary.systematicFlipShareCI95Players.hi}]` : '—'}   (the generalising one)`);
    console.log(`  seed-dependent (flipped in some, not all)      ${seedDependent}/${n} = ${summary.seedDependentShare}`);
    console.log(`  never flipped                                  ${never}/${n}`);
    console.log(`  flip directions (systematic + seed-dependent)  ${JSON.stringify(directions)}`);
    console.log('');
    console.log('  PER-ARM ARGMAX STABILITY ACROSS SEEDS  (1.000 = the arm never changed its mind)');
    for (const [id, s] of Object.entries(perArmStability)) {
      console.log(`    ${id.padEnd(8)} mean ${s.meanStability}  min ${s.minStability}  decisions with any instability: ${s.decisionsWithAnyInstability}`);
    }
    console.log('');
    console.log('  PER-REPLICATE FLIP SHARE  (the ablation\'s own metric, one seed at a time)');
    for (const d of summary.perReplicateFlipShare) console.log(`    seed ${d.seed}  ${d.flips}/${d.n} = ${d.share}`);
    console.log('');
    if (resultCard) {
      console.log(`  Result Card ${resultCard.resultCardId}`);
      console.log(`    engine ${resultCard.manifest.engineCommit.slice(0, 12)}${resultCard.manifest.engineDirty ? '  *** DIRTY TREE ***' : ''}`);
      console.log(`    register ${resultCard.manifest.disclaimerRegisterVersion}`);
    } else {
      console.log('  *** NO RESULT CARD ***');
      for (const p of cardProblems) console.log(`    - ${p}`);
    }
    console.log('═'.repeat(92));
  } finally {
    restore();
    await loader.close();
  }
};

main().catch((err) => { restore(); console.error(err?.stack || String(err)); process.exit(1); });
