/**
 * heroEvRunner.mjs — the hero-EV scoring pass (WS-287), now an ORCHESTRATOR (WS-433).
 *
 * Reuses the villain-side harness rather than standing up a second pipeline: the same
 * corpus reader, the same POOL/EVAL partition, the same leakage guard, the same
 * walk-forward checkpointing, and the same `accumulateDecisions` derivation of decision
 * context. What differs is only what happens AT a decision — instead of predicting what
 * the player did, it asks what the engine would advise and scores that against the
 * hand's realized chips.
 *
 * WHY WALK-FORWARD STILL APPLIES even though the villain is held at population baseline
 * in v1: hero's RANGE is a fitted object. `buildRangeProfile` learns it from hero's own
 * past hands, and that range is what `pi_ours` marginalizes over. Reading the test hands
 * with a profile fitted on those same hands would let hero's future inform the advice
 * being scored. So the profile is built from the prefix only and the guard asserts it on
 * every scored decision.
 *
 * WS-433 RESTRUCTURE. The per-player scoring body lives in `heroEvTask.mjs` as a pure
 * function; this module ingests once, builds the canonical enumeration
 * (`heroEvEnumeration.mjs`), dispatches player tasks, and merges fragments in
 * enumeration order. Three defects of the old nested loop die here:
 *
 *   1. Players were walked in corpus-file order with no interleaving, so `maxDecisions`
 *      exhausted inside the first heavy players (3 contributing players at 600 decisions
 *      — see out/hero-ev-KILLED-3players-inadmissible.README.md). Now a per-player
 *      decision cap spreads the budget across the planned players.
 *   2. Decision order — and through it the CI, via `estimateEdge`'s first-appearance
 *      cluster map and the seeded bootstrap — was an accident of file order. Now rows
 *      carry stable `(p, k, d)` coordinates and the merge sorts by them.
 *   3. Nothing could be seeded, because no work unit had a stable position. Now every
 *      engine call's equity stream seeds from `(playerIndex, checkpointIndex,
 *      decisionOrdinal, armOrdinal, comboIndex)`.
 *
 * Player identity is `${site}:${pseudonym}` (playerKeyScheme site-pseudo-v1) — the bare
 * pseudonym merge invented 131 cross-site players. The bare pseudonym remains the
 * partition unit, so POOL/EVAL membership is unchanged and mined policies stay valid.
 */

import { LeakageGuard } from './leakageGuard.mjs';
import { validateBehaviorPolicy } from './behaviorPolicy.mjs';
import { indexEvalPlayers } from './runner.mjs';
import {
  newHandLedger, mergeLedgerFragment, sealHandLedger,
} from './handLedger.mjs';
import { DEFAULT_COMBO_SAMPLES, DEFAULT_TRIALS } from './heroPolicy.mjs';
import { validatePbrHeldOut, PBR_SHRINK_SWEEP, PBR_SURFACE_ID } from './poolBestResponse.mjs';
import {
  FALLBACK, validateStrategy, validateFallback,
  newCoverage, mergeCoverage, summarizeCoverage,
} from './strategyArm.mjs';
import { buildEnumeration } from './heroEvEnumeration.mjs';
import { scoreHeroEvPlayer, newTaskCounters, mergeTaskCounters } from './heroEvTask.mjs';
import { buildChunkStamp, writeChunk, loadChunk } from './mergeHeroEvChunks.mjs';
import { REFINEMENT_CLOCK_VERSION } from '../../src/utils/exploitEngine/refinementWork.js';

export const PLAYER_KEY_SCHEME = 'site-pseudo-v1';
export const SEED_SCHEME = 'ws433-v1';

/**
 * Modelled online 50NL rake. The corpus stores NO rake, so this is an assumption about
 * the games these hands came from, not a reading of them — and it is reported as
 * modelled wherever it appears. POKER_THEORY 11.3 defines the schedule shape.
 */
export const DEFAULT_RAKE_CONFIG = { pct: 0.05, cap: 3, noFlopNoDrop: true };

/**
 * The single-policy pass expressed as a one-armed ablation.
 *
 * Collapsing "no arms" into "one arm with the engine's own default budget" means there is
 * exactly ONE scoring loop (now in heroEvTask.mjs). A second loop for the unablated case
 * would be a second thing to keep correct, and the copy nobody exercises is the copy that
 * drifts — the same argument `snapshot()` below makes for partial vs final.
 *
 * `refinementBudgetMs: undefined` on the default arm is load-bearing: it makes the key absent
 * at the engine call, so the default arm is the engine's own configuration rather than this
 * module's opinion of it.
 */
const normalizeDepthArms = (depthArms, { allowSetChange = false } = {}) => {
  if (!depthArms) return [{ id: 'default', refinementBudgetMs: undefined, strategy: null }];
  if (!Array.isArray(depthArms) || depthArms.length === 0) {
    throw new Error('runHeroEv: depthArms must be a non-empty array of { id, refinementBudgetMs }');
  }
  const ids = new Set();
  for (const a of depthArms) {
    if (!a?.id) throw new Error('runHeroEv: every depth arm needs an id');
    if (ids.has(a.id)) throw new Error(`runHeroEv: duplicate depth arm id "${a.id}"`);
    ids.add(a.id);
  }

  // WS-425 — the STRATEGY axis, orthogonal to the depth axis. Engine arms are ordered
  // FIRST unconditionally, so a strategy arm falling back to the engine always has its
  // fallback source in hand. The reorder is invisible to every existing caller because a
  // run with no strategy arms is reordered onto itself.
  const engineArms = depthArms.filter((a) => !a.strategy);
  const stratArms = depthArms.filter((a) => a.strategy);
  if (stratArms.length && engineArms.length === 0
    && stratArms.some((a) => (a.fallback ?? FALLBACK.ENGINE) === FALLBACK.ENGINE)) {
    throw new Error(
      'runHeroEv: a strategy arm with fallback "engine" needs at least one engine arm in the '
      + 'run to fall back TO. Use fallback "pool" for a strategy-only run.',
    );
  }

  return [
    ...engineArms.map((a) => ({
      id: a.id, refinementBudgetMs: a.refinementBudgetMs, strategy: null,
    })),
    ...stratArms.map((a) => {
      const strategy = validateStrategy(a.strategy, { armId: a.id });
      const fallback = validateFallback(a.fallback ?? FALLBACK.ENGINE, {
        armId: a.id, allowSetChange,
      });
      const fallbackArmId = a.fallbackArmId ?? engineArms[engineArms.length - 1]?.id ?? null;
      if (fallback === FALLBACK.ENGINE && !ids.has(fallbackArmId)) {
        throw new Error(`runHeroEv: strategy arm "${a.id}" names fallbackArmId "${fallbackArmId}", which is not an arm in this run`);
      }
      return {
        id: a.id, refinementBudgetMs: undefined, strategy, fallback, fallbackArmId,
      };
    }),
  ];
};

/** Split a `${site}:${pseudonym}` key at the FIRST colon; sites carry no colons. */
const barePseudonym = (playerKey) => playerKey.slice(playerKey.indexOf(':') + 1);

/**
 * Run the hero-EV pass.
 *
 * @returns {Promise<{decisions: Array, integrity: Object, counters: Object}>}
 */
export const runHeroEv = async ({
  files,
  reference,
  behaviorPolicy,
  poolPct = 50,
  maxPlayers = Infinity,
  maxHandsPerPlayer = Infinity,
  minTrainHands = 15,
  checkpointInterval = 10,
  maxDecisions = Infinity,
  comboSamples = DEFAULT_COMBO_SAMPLES,
  trials = DEFAULT_TRIALS,
  rakeConfig = DEFAULT_RAKE_CONFIG,
  // WS-322 / ADR-009. Both default to null so every existing caller and test keeps working.
  dealBook = null,
  replicationStamp = null,
  surfaceId = 'engine-read',
  fieldId = 'pool-mined-behavior-policy',
  // WS-334 AC5 — the depth ablation. See normalizeDepthArms.
  depthArms = null,
  primaryArmId = null,
  log = () => {},
  onPartial = () => {},
  // WS-393 — the full decision-level record. See heroEvTask.mjs.
  onDecisionRecord = null,
  allowSetChange = false,
  // ── WS-433 ────────────────────────────────────────────────────────────────────────
  // Run-level equity seed. null = legacy unseeded Math.random path, bit-identical to
  // before the parameter existed. An integer seeds every engine call's Monte Carlo from
  // stable work coordinates (SEED_SCHEME) and is stamped in replicationStamp.seeds.
  equitySeed = null,
  // Per-player decision ceiling. null = ceil(maxDecisions / plannedPlayers) when both are
  // finite, else Infinity. This is the stratification that stops early heavy players
  // monopolizing the run budget — breadth (independent clusters) over depth (correlated
  // evidence), which is what the cluster-bootstrap CI actually narrows on.
  maxDecisionsPerPlayer = null,
  // Stop admitting waves once this many players have contributed >= 1 scored decision.
  // null = no target (process every planned player).
  targetContributingPlayers = null,
  // Worker-thread count. 0 = in-process serial through the identical task function —
  // the bit-identity baseline. N > 0 = worker pool (heroEvPool.mjs).
  workers = 0,
  // Wave size for admission. Stop rules (maxDecisions, targetContributingPlayers) are
  // evaluated ONLY at wave boundaries, in both serial and parallel modes, so the admitted
  // work set is a pure function of (corpus, config) — wave-quantized, never
  // race-quantized. Stamped in config: two runs compare only at equal waveSize when a
  // stop rule fires. null = max(4 * max(workers, 1), 16).
  waveSize = null,
  // Chunk persistence: every completed wave is written to this directory atomically
  // (mergeHeroEvChunks.mjs), so a killed multi-hour run loses at most one wave.
  // null = no chunk persistence (existing callers unchanged).
  chunkDir = null,
  // With `resume`, a wave whose valid chunk exists in chunkDir is seeded from disk
  // instead of re-executed. Stamp mismatches REFUSE (throw) — a chunk from a different
  // measurement must never be blended in silently.
  resume = false,
}) => {
  // All guards run at construction, before any work: a run that could leak must not
  // be able to start, let alone produce a number someone might quote.
  const captureRecord = typeof onDecisionRecord === 'function';
  const arms = normalizeDepthArms(depthArms, { allowSetChange });
  const engineArms = arms.filter((a) => !a.strategy);
  const strategyArms = arms.filter((a) => a.strategy);
  const defaultPrimary = (engineArms[engineArms.length - 1] ?? arms[arms.length - 1]).id;
  const primaryId = primaryArmId ?? defaultPrimary;
  if (!arms.some((a) => a.id === primaryId)) {
    throw new Error(`runHeroEv: primaryArmId "${primaryId}" is not one of ${arms.map((a) => a.id).join(', ')}`);
  }
  if (engineArms.length && strategyArms.some((a) => a.id === primaryId)) {
    throw new Error(
      `runHeroEv: primaryArmId "${primaryId}" is a strategy arm. The primary arm supplies `
      + 'perCombo (the PBR ceiling) and evStats (the optimizer\'s curse), neither of which a '
      + 'strategy arm computes — naming one primary would null both without saying so.',
    );
  }
  if (equitySeed !== null && !Number.isInteger(equitySeed)) {
    throw new Error(`runHeroEv: equitySeed must be an integer or null, got ${equitySeed}`);
  }
  if (!Number.isInteger(workers) || workers < 0) {
    throw new Error(`runHeroEv: workers must be a non-negative integer, got ${workers}`);
  }
  if (workers > 0 && strategyArms.length > 0) {
    // A strategy's policyAt is a function and cannot cross the thread boundary. The
    // residual is NAMED, not silently dropped: supporting strategy arms in workers needs
    // a serializable strategy descriptor (the Strategy Card JSON) rebuilt in-worker via
    // validateStrategy — filed with WS-433's completion notes. Until then a strategy run
    // is serial, never a silently different measurement.
    throw new Error('runHeroEv: strategy arms are not yet transportable to workers — run with workers: 0');
  }

  const guard = new LeakageGuard({ poolPct, reference });
  const policy = validateBehaviorPolicy(behaviorPolicy, poolPct);
  // WS-331. A THIRD refusal, not a repeat of the second — see poolBestResponse.mjs.
  validatePbrHeldOut(policy, poolPct);

  // Ingest ONCE, uncapped by maxPlayers at the identity level we plan from: the planned
  // set is the first N of the canonical enumeration, not the first N seen in the corpus.
  // (`maxPlayers` at ingest was the old cap semantics; planning from the enumeration is
  // what makes a capped run's player set independent of file order.)
  const { byPlayer, skipStats, handsRead } = await indexEvalPlayers({
    files,
    poolPct,
    maxPlayers: Infinity,
    maxHandsPerPlayer,
    keyBySite: true,
    onProgress: ({ handsRead: h, players }) => log(`read ${h} hands, ${players} eval players`),
  });
  log(`indexed ${byPlayer.size} EVAL players from ${handsRead} hands`);

  // The stable work index. Qualification (>= minTrainHands + 1) is what makes the
  // qualifying count reportable — the old runner admitted zero-window players silently.
  const enumeration = buildEnumeration({ byPlayer, minTrainHands });
  const planned = Number.isFinite(maxPlayers)
    ? enumeration.players.slice(0, maxPlayers)
    : enumeration.players;
  log(`enumerated ${enumeration.qualifyingCount} qualifying players (of ${enumeration.totalPlayers} indexed) — planning ${planned.length}`);

  const perPlayerCap = maxDecisionsPerPlayer
    ?? ((Number.isFinite(maxDecisions) && planned.length > 0)
      ? Math.ceil(maxDecisions / planned.length)
      : Infinity);

  const taskConfig = {
    minTrainHands,
    checkpointInterval,
    comboSamples,
    trials,
    rakeConfig,
    arms,
    primaryId,
    captureRecord,
    equitySeed,
    maxDecisionsForPlayer: perPlayerCap,
  };

  // ── Fragment collection + fold-on-demand ─────────────────────────────────────────
  //
  // Fragments arrive per player (in canonical order from the serial executor, in
  // COMPLETION order from the pool). Every accumulated number is produced by folding
  // the fragments in canonical order at read time, so worker timing cannot reach any
  // float: serial and parallel runs fold identically by construction.
  const fragments = [];
  const failures = [];

  const foldAll = () => {
    const sorted = [...fragments].sort((a, b) => a.playerIndex - b.playerIndex);
    const counters = newTaskCounters();
    const ledger = newHandLedger();
    const coverageByArm = Object.fromEntries(strategyArms.map((a) => [a.id, newCoverage()]));
    const decisions = [];
    const barePids = new Set();
    let contributing = 0;
    let walkForwardChecked = 0;
    for (const f of sorted) {
      decisions.push(...f.decisions);
      mergeTaskCounters(counters, f.counters);
      mergeLedgerFragment(ledger, f.ledger);
      for (const [armId, cov] of Object.entries(f.coverageByArm)) {
        mergeCoverage(coverageByArm[armId], cov);
      }
      if (f.contributed) contributing++;
      walkForwardChecked += f.walkForwardChecked;
      barePids.add(f.playerId);
    }
    // Canonical order + deterministic ceiling: `maxDecisions` is a CEILING, cut in
    // (p, k, d) order — never in completion order.
    decisions.sort((a, b) => (a.stable.p - b.stable.p) || (a.stable.k - b.stable.k) || (a.stable.d - b.stable.d));
    if (Number.isFinite(maxDecisions) && decisions.length > maxDecisions) {
      decisions.length = maxDecisions;
    }
    return {
      decisions, counters, ledger, coverageByArm, contributing, walkForwardChecked, barePids,
    };
  };

  // ── Wave admission — the scheduler both modes share ──────────────────────────────
  //
  // Players are admitted in canonical-order waves; stop rules are evaluated ONLY at
  // wave boundaries, so the admitted work set is wave-quantized and identical across
  // serial and parallel execution at equal config. Within an admitted wave every player
  // runs to completion even if a target is crossed mid-wave.
  const W = waveSize ?? Math.max(4 * Math.max(workers, 1), 16);
  let rawDecisionCount = 0; // pre-truncation sum — same in both modes at wave boundaries
  let contributingSoFar = 0;

  const admitMore = () => {
    if (Number.isFinite(maxDecisions) && rawDecisionCount >= maxDecisions) return false;
    if (targetContributingPlayers !== null && contributingSoFar >= targetContributingPlayers) return false;
    return true;
  };

  const takeFragment = (frag) => {
    fragments.push(frag);
    rawDecisionCount += frag.decisions.length;
    if (frag.contributed) contributingSoFar++;
  };

  const waves = [];
  for (let i = 0; i < planned.length; i += W) waves.push(planned.slice(i, i + W));

  // ── Chunk stamp — what binds a chunk to THIS measurement ─────────────────────────
  // dealBookHash / engineCommit come from the CLI's replication stamp when present;
  // programmatic callers without one stamp nulls, which still must match on resume.
  const chunkStamp = buildChunkStamp({
    enumerationHash: enumeration.enumerationHash,
    dealBookHash: replicationStamp?.dealBookHash ?? null,
    engineCommit: replicationStamp?.engineCommit ?? null,
    engineDirty: replicationStamp?.engineDirty ?? null,
    playerKeyScheme: PLAYER_KEY_SCHEME,
    seedScheme: equitySeed === null ? null : SEED_SCHEME,
    equitySeed,
    // WS-432: the engine's own clock version, imported from its definition site so the
    // stamp cannot drift from the engine. Old 'wall' chunks are auto-refused by MUST_MATCH.
    refinementClock: REFINEMENT_CLOCK_VERSION,
    config: {
      poolPct,
      minTrainHands,
      checkpointInterval,
      comboSamples,
      trials,
      rakeConfig,
      depthArms: arms.map((a) => ({ id: a.id, refinementBudgetMs: a.refinementBudgetMs ?? null })),
      primaryArmId: primaryId,
      maxDecisionsPerPlayer: Number.isFinite(perPlayerCap) ? perPlayerCap : null,
      waveSize: W,
      maxDecisions: Number.isFinite(maxDecisions) ? maxDecisions : null,
      targetContributingPlayers,
      maxHandsPerPlayer: Number.isFinite(maxHandsPerPlayer) ? maxHandsPerPlayer : null,
    },
    behaviorPolicy: {
      partition: policy.provenance.partition,
      poolPct: policy.provenance.poolPct,
      observations: policy.provenance.observations,
      players: policy.provenance.players,
    },
  });
  let resumedWaves = 0;
  let resumedEngineDirty = false;

  const waveBounds = (wave) => ({
    from: wave[0].playerIndex,
    to: wave[wave.length - 1].playerIndex + 1,
  });

  /** Seed a wave from its chunk if resume finds one. Returns true when seeded. */
  const seedWaveFromChunk = (wave) => {
    if (!chunkDir || !resume) return false;
    const { from, to } = waveBounds(wave);
    const hit = loadChunk(chunkDir, {
      from, to, ofTotal: enumeration.qualifyingCount, stamp: chunkStamp,
    });
    if (!hit) return false;
    for (const f of hit.fragments) takeFragment(f);
    failures.push(...hit.failures);
    if (hit.engineDirty) resumedEngineDirty = true;
    resumedWaves++;
    log(`resumed wave [${from}, ${to}) from chunk — ${hit.fragments.length} players`);
    return true;
  };

  const persistWave = (wave, waveFragments, waveFailures) => {
    if (!chunkDir) return;
    const { from, to } = waveBounds(wave);
    writeChunk(chunkDir, {
      from,
      to,
      ofTotal: enumeration.qualifyingCount,
      stamp: chunkStamp,
      fragments: [...waveFragments].sort((a, b) => a.playerIndex - b.playerIndex),
      failures: waveFailures,
    });
  };

  if (workers === 0) {
    for (const wave of waves) {
      if (!admitMore()) break;
      if (seedWaveFromChunk(wave)) continue;
      const waveFragments = [];
      const waveFailures = [];
      for (const entry of wave) {
        // eslint-disable-next-line no-await-in-loop -- serial mode is the baseline; the pool is the fast path
        await scoreHeroEvPlayer({
          playerIndex: entry.playerIndex,
          playerKey: entry.playerId,
          playerId: barePseudonym(entry.playerId),
          hands: byPlayer.get(entry.playerId),
          config: taskConfig,
          policy,
          guard,
          emit: {
            onDecisionRecord,
            onProgress: ({ decisionsScored }) => {
              if ((rawDecisionCount + decisionsScored) % 50 === 0) {
                log(`scored ~${rawDecisionCount + decisionsScored} decisions`);
              }
            },
          },
        }).then((frag) => {
          takeFragment(frag);
          waveFragments.push(frag);
        }).catch((err) => {
          waveFailures.push({ playerIndex: entry.playerIndex, playerKey: entry.playerId, message: err?.message || String(err) });
          log(`player ${entry.playerId} failed: ${err?.message || err}`);
        });
      }
      failures.push(...waveFailures);
      persistWave(wave, waveFragments, waveFailures);
      log(`wave done: ${fragments.length} players, ${rawDecisionCount} decisions, ${contributingSoFar} contributing`);
      // A full pass is measured in HOURS and used to write nothing until it returned.
      // Emit a snapshot at every wave boundary so a kill costs one wave, not the run.
      onPartial(snapshot(false));
    }
  } else {
    const { createHeroEvPool } = await import('./heroEvPool.mjs');
    const pool = await createHeroEvPool({
      config: taskConfig,
      behaviorPolicy,
      reference,
      poolPct,
      workers,
      // Sidecar rows arrive in completion order under the pool; rows carry `stable`
      // coordinates so a reader can canonicalize. The sidecar is capture, never a
      // comparison artifact (ADR-009).
      onRecord: onDecisionRecord,
      log,
    });
    try {
      for (const wave of waves) {
        if (!admitMore()) break;
        if (seedWaveFromChunk(wave)) continue;
        const waveFragments = [];
        // eslint-disable-next-line no-await-in-loop -- waves are the admission barrier
        const { failures: waveFailures } = await pool.runWave(wave, {
          handsFor: (key) => byPlayer.get(key),
          bareIdFor: barePseudonym,
          onFragment: (frag) => {
            takeFragment(frag);
            waveFragments.push(frag);
          },
        });
        failures.push(...waveFailures);
        persistWave(wave, waveFragments, waveFailures);
        log(`wave done: ${fragments.length} players, ${rawDecisionCount} decisions, ${contributingSoFar} contributing`);
        onPartial(snapshot(false));
      }
    } finally {
      await pool.destroy();
    }
  }

  return snapshot(true);

  // Declared after the loop it serves (hoisted): partial and final snapshots MUST be built
  // by the same code. Two constructions would be two chances to disagree about what a run
  // contains, and the partial one is the copy nobody checks.
  function snapshot(complete) {
    const folded = foldAll();
    const { decisions } = folded;
    return {
      complete,
      decisionsScored: decisions.length,
      decisions,
      integrity: {
        // Synthesized from fragments (identically in serial and parallel — each worker
        // holds its own guard, so the run-level summary cannot come from any single
        // guard instance). `evalPlayersChecked` counts distinct BARE pseudonyms, matching
        // the guard's own Set semantics; `decisionsChecked` mirrors assertWalkForward.
        poolPct,
        referenceMode: guard.referenceMode,
        evalPlayersChecked: folded.barePids.size,
        decisionsChecked: folded.walkForwardChecked,
        statWindowsChecked: 0,
        fieldSourceId: guard.fieldSourceId,
        fieldRowsExposed: guard.fieldRowsExposed,
        behaviorPolicy: {
          partition: policy.provenance.partition,
          poolPct: policy.provenance.poolPct,
          observations: policy.provenance.observations,
          players: policy.provenance.players,
          hierarchy: policy.provenance.hierarchy,
        },
        // WS-331. Stamped so a reader can see the ceiling was HELD OUT without re-deriving
        // it — the held-out property must travel with the number.
        pbr: {
          surfaceId: PBR_SURFACE_ID,
          fitPartition: policy.provenance.partition,
          evaluatedOn: 'eval',
          heldOut: true,
          poolPct,
          shrinkSweep: [...PBR_SHRINK_SWEEP],
        },
      },
      counters: {
        ...folded.counters,
        handsRead,
        evalPlayers: byPlayer.size,
        adapterSkips: skipStats,
        // WS-433 — the counts the accept criteria demand. `qualifyingPlayers` is the
        // supply figure (>= one train/test window); `contributingPlayers` is the cluster
        // count the bootstrap CI actually resamples. A run reporting `n` without them
        // invites the assumption that power scaled with n — it did not.
        qualifyingPlayers: enumeration.qualifyingCount,
        plannedPlayers: planned.length,
        playersProcessed: fragments.length,
        contributingPlayers: folded.contributing,
        playerTaskErrors: failures.length,
      },
      // WS-428 Stage 0. The control whose correct value is known INDEPENDENTLY of this
      // instrument — see `handLedger.mjs`. NOT a Result Card figure and not quotable.
      fieldAnchor: sealHandLedger(folded.ledger),
      config: {
        poolPct, minTrainHands, checkpointInterval, comboSamples, trials,
        rakeConfig, rakeIsModelled: true, maxDecisions,
        depthArms: arms.map((a) => ({ id: a.id, refinementBudgetMs: a.refinementBudgetMs ?? null })),
        primaryArmId: primaryId,
        strategyArms: strategyArms.map((a) => ({
          id: a.id,
          strategyId: a.strategy.id,
          strategyVersion: a.strategy.version ?? null,
          encoding: a.strategy.encoding,
          sourceRef: a.strategy.sourceRef,
          fallback: a.fallback,
          fallbackArmId: a.fallback === 'engine' ? a.fallbackArmId : null,
        })),
        // WS-433 provenance. `playerKeyScheme` and `seedScheme` are stamped so chunk
        // merges can refuse cross-scheme blends; `maxDecisionsPerPlayer` is the
        // stratification cap; `workers` is honesty about how the run executed.
        playerKeyScheme: PLAYER_KEY_SCHEME,
        seedScheme: equitySeed === null ? null : SEED_SCHEME,
        equitySeed,
        maxDecisionsPerPlayer: Number.isFinite(perPlayerCap) ? perPlayerCap : null,
        targetContributingPlayers,
        workers,
        waveSize: W,
        chunkDir: chunkDir ?? null,
        resumedWaves,
        resumedEngineDirty,
      },
      strategyCoverage: Object.fromEntries(
        strategyArms.map((a) => [a.id, summarizeCoverage(folded.coverageByArm[a.id])]),
      ),
      // Carried, not computed here — the runner measures, the report assembles the card.
      dealBook,
      replicationStamp,
      surfaceId,
      fieldId,
    };
  }
};
