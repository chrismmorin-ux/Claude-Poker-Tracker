/**
 * heroEvTask.mjs — one player's hero-EV scoring, as a pure function (WS-433).
 *
 * This is the per-player body extracted verbatim from heroEvRunner's nested loop, so that
 * the SAME code path serves the in-process serial run (`workers: 0`) and the worker-thread
 * pool. One copy of the scoring loop — the module's own single-loop doctrine: the copy
 * nobody exercises is the copy that drifts.
 *
 * PURE OF ITS INPUTS: everything the function reads arrives as an argument; everything it
 * produces returns as a fragment. Cross-player state (the global decisions array, the run
 * ledger, run counters, coverage) stays with the ORCHESTRATOR, which merges fragments in
 * canonical enumeration order so every order-sensitive float accumulation sees one fixed
 * order in serial and parallel alike.
 *
 * TWO PLAYER IDENTITIES, deliberately:
 *   - `playerKey`  — `${site}:${pseudonym}` (playerKeyScheme site-pseudo-v1), the IDENTITY:
 *     what rows carry, what the cluster bootstrap resamples, what chunks are named by.
 *   - `playerId`   — the bare pseudonym, the CORPUS UNIT: what `seatPlayers` values match,
 *     what `partitionOf` hashes, what `buildRangeProfile`/`accumulateDecisions` receive.
 * Collapsing them is the 131-pseudonym cross-site merge the ladder calls "inventing a
 * player" (`ladderAxes.mjs`).
 */

import { buildRangeProfile } from '../../src/utils/rangeEngine/index.js';
import { accumulateDecisions } from '../../src/utils/exploitEngine/decisionAccumulator.js';
import { resolveHandOutcome } from './handOutcome.mjs';
import {
  newHandLedger, countDealtWindow, markWindowDropped,
} from './handLedger.mjs';
import { heroPolicyAt } from './heroPolicy.mjs';
import { queryPolicy } from './behaviorPolicy.mjs';
import {
  decisionGeometry, sizeBucketFor, liveOpponentCount,
  sprFor, sprBandFor, closesAction,
} from './decisionGeometry.mjs';
import { holdingTruth } from '../../src/utils/holdingKnowledge/index.js';
import {
  DECISION_RECORD_SCHEMA_VERSION, cardLabel, compactHeroTruth,
} from './decisionRecord.mjs';
import {
  poolBestResponseAt, poolBestResponseSweep,
} from './poolBestResponse.mjs';
import { strategyPolicyAt, newCoverage } from './strategyArm.mjs';
import { seedForDecision, seedForCombo } from './heroEvEnumeration.mjs';

const USER_ID = 'backtest';

const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };

/** Fresh per-player counters fragment — same keys the run-level counters aggregate. */
export const newTaskCounters = () => ({
  checkpoints: 0,
  skippedCheckpoints: 0,
  outcomeUnresolved: {},
  policySkips: {},
  pbrSkips: {},
  geometrySkips: 0,
  engineErrors: 0,
  heroSeatNotInOutcome: 0,
  decisionRecordErrors: 0,
});

/** Sum a counters fragment into an accumulator (ints + one-level bump maps; strings last-win). */
export const mergeTaskCounters = (acc, frag) => {
  for (const [k, v] of Object.entries(frag)) {
    if (typeof v === 'number') {
      acc[k] = (acc[k] || 0) + v;
    } else if (typeof v === 'string') {
      acc[k] = v; // e.g. decisionRecordLastError — diagnostic, last writer wins
    } else if (v && typeof v === 'object') {
      const dst = acc[k] || (acc[k] = {});
      for (const [rk, rv] of Object.entries(v)) dst[rk] = (dst[rk] || 0) + rv;
    }
  }
  return acc;
};

/**
 * Score every checkpoint of one player.
 *
 * @param {Object} args
 * @param {number} args.playerIndex - position in the FULL canonical enumeration
 * @param {string} args.playerKey   - `${site}:${pseudonym}` identity
 * @param {string} args.playerId    - bare pseudonym (corpus unit)
 * @param {Array}  args.hands       - this player's app-shaped hands, corpus order
 * @param {Object} args.config      - { minTrainHands, checkpointInterval, comboSamples,
 *   trials, rakeConfig, arms, primaryId, captureRecord, equitySeed, maxDecisionsForPlayer }
 *   `arms` is the NORMALIZED arms array (normalizeDepthArms output) — order is load-bearing:
 *   arm ordinals seed the equity streams.
 * @param {Object} args.policy      - validated behavior policy (validateBehaviorPolicy output)
 * @param {Object} args.guard       - LeakageGuard (per worker, or the run's own in-process)
 * @param {Object} [args.emit]      - { onDecisionRecord, onProgress } — both optional
 * @returns {Promise<Object>} fragment: { playerIndex, playerKey, decisions, counters,
 *   ledger, coverageByArm, contributed }
 */
export const scoreHeroEvPlayer = async ({
  playerIndex, playerKey, playerId, hands, config, policy, guard, emit = {},
}) => {
  const {
    minTrainHands, checkpointInterval, comboSamples, trials, rakeConfig,
    arms, primaryId, captureRecord, equitySeed = null,
    maxDecisionsForPlayer = Infinity,
  } = config;
  const onDecisionRecord = emit.onDecisionRecord ?? null;
  const onProgress = emit.onProgress ?? null;

  const engineArms = arms.filter((a) => !a.strategy);
  const strategyArms = arms.filter((a) => a.strategy);
  const armOrdinalById = new Map(arms.map((a, i) => [a.id, i]));
  const coverageByArm = Object.fromEntries(strategyArms.map((a) => [a.id, newCoverage()]));

  guard.assertEvalPlayer(playerId);

  const decisions = [];
  // WS-431: full decision records retained per fragment so waves persist them in chunks
  // (resume replays them). `persistWave` strips this after the chunk write, so a long run
  // holds at most one wave of full records in memory.
  const records = [];
  const counters = newTaskCounters();
  const ledger = newHandLedger();

  // Per-task: a hand shared by two players processed in different workers resolves twice.
  // resolveHandOutcome is cheap pure card math; correctness is unaffected.
  const outcomeCache = new Map();
  const outcomeFor = (hand) => {
    if (outcomeCache.has(hand)) return outcomeCache.get(hand);
    const r = resolveHandOutcome(hand, { rakeConfig });
    const bare = resolveHandOutcome(hand, { rakeConfig: null });
    const both = { raked: r, unraked: bare };
    outcomeCache.set(hand, both);
    return both;
  };

  let stop = false;
  let checkpointIndex = -1;
  let walkForwardChecked = 0;
  for (let cp = minTrainHands; cp < hands.length; cp += checkpointInterval) {
    if (stop) break;
    checkpointIndex++;
    const trainHands = hands.slice(0, cp);
    const testHands = hands.slice(cp, cp + checkpointInterval);
    if (testHands.length === 0) break;

    // BEFORE the profile build, deliberately (WS-428 Stage 0): these hands were dealt to
    // hero whether or not the harness could build a range for them.
    countDealtWindow(ledger, { playerId, testHands, outcomeFor });

    let trainProfile;
    try {
      trainProfile = buildRangeProfile(playerId, trainHands, USER_ID);
    } catch {
      counters.skippedCheckpoints++;
      markWindowDropped(ledger, testHands);
      continue;
    }
    if (!trainProfile) {
      counters.skippedCheckpoints++;
      markWindowDropped(ledger, testHands);
      continue;
    }
    counters.checkpoints++;

    // `accumulateDecisions` is synchronous and the engine call is async, so the contexts
    // are collected first and scored after. Doing the engine work inside the callback
    // would silently drop every await.
    const ctxs = [];
    try {
      accumulateDecisions(playerId, testHands, trainProfile, USER_ID, {
        onDecision: (ctx) => {
          guard.assertWalkForward({
            playerId, trainEndIdx: cp, handIdx: cp + ctx.handIdx,
          });
          ctxs.push(ctx);
        },
      });
    } catch {
      counters.skippedCheckpoints++;
      markWindowDropped(ledger, testHands);
      continue;
    }
    walkForwardChecked += ctxs.length;

    // decisionOrdinal counts ALL emitted ctxs, including ones the gates below skip — a
    // survivors-only ordinal would re-seed everything after a skip (the counter-shift trap
    // run-entry-map.mjs names).
    for (let decisionOrdinal = 0; decisionOrdinal < ctxs.length; decisionOrdinal++) {
      const ctx = ctxs[decisionOrdinal];
      const geo = decisionGeometry(ctx.hand, ctx.order, ctx.street);
      if (!geo) { counters.geometrySkips++; continue; }

      const { raked, unraked } = outcomeFor(ctx.hand);
      if (!raked.resolved) { bump(counters.outcomeUnresolved, raked.reason); continue; }
      const seat = String(ctx.playerSeat);
      const netBB = raked.netBySeat[seat];
      const netBBUnraked = unraked.resolved ? unraked.netBySeat[seat] : null;
      if (!Number.isFinite(netBB)) { counters.heroSeatNotInOutcome++; continue; }

      const sizeBucket = sizeBucketFor(geo.facingBetBB, geo.potBB);

      // WS-393 — the RAW coordinates of the node, derived from the SAME `geo` object the
      // policy and the slices already used. See heroEvRunner history for why this sits
      // above the arm loop (WS-425).
      const spr = sprFor(geo);
      const geometry = {
        bb: geo.bb,
        potChips: geo.potChips,
        betChips: geo.betChips,
        potBB: geo.potBB,
        facingBetBB: geo.facingBetBB,
        enginePotChips: geo.enginePotChips,
        stackChips: geo.stackChips,
        stackBB: Number.isFinite(geo.stackChips) ? geo.stackChips / geo.bb : null,
        spr,
        sprBand: sprBandFor(spr),
        betToPot: geo.potBB > 0 ? geo.facingBetBB / geo.potBB : null,
        closesAction: closesAction(ctx.hand, ctx.order, ctx.street, ctx.playerSeat),
        sBucket: sizeBucket,
      };

      const policyCtx = {
        facingAction: ctx.facingAction,
        isAgg: ctx.isAgg,
        isIP: ctx.isIP,
        texture: ctx.texture,
        street: ctx.street,
        posCategory: ctx.posCategory,
        sizeBucket,
      };
      const pool = queryPolicy(policy, policyCtx);

      // WS-433 — the decision's seed, a pure function of stable coordinates. Null
      // equitySeed leaves every engine call on unseeded Math.random (legacy).
      const decisionSeed = equitySeed === null ? null : seedForDecision({
        equitySeed, playerIndex, checkpointIndex, decisionOrdinal,
      });

      // ONE ENGINE PASS PER ARM, and a decision survives only if EVERY arm produced a
      // policy — a skip pattern that correlates with depth must not enter the contrast.
      const byArm = {};
      let armFailure = null;
      for (const arm of engineArms) {
        const armOrdinal = armOrdinalById.get(arm.id);
        // eslint-disable-next-line no-await-in-loop -- the engine call is the cost; arms are 1-2
        const res = await heroPolicyAt({
          ctx, hand: ctx.hand, rakeConfig, comboSamples, trials,
          refinementBudgetMs: arm.refinementBudgetMs,
          captureComboDetail: captureRecord,
          equitySeedFor: decisionSeed === null
            ? null
            : (comboIndex) => seedForCombo(decisionSeed, armOrdinal, comboIndex),
        });
        counters.engineErrors += res.engineErrors ?? 0;
        if (!res.ok) { armFailure = { arm: arm.id, reason: res.reason }; break; }
        byArm[arm.id] = res;
      }
      // Strategy arms AFTER engine arms so a fallback has its source. Pure functions of
      // the decision: no engine call, no clock, no RNG.
      if (!armFailure) {
        for (const arm of strategyArms) {
          const res = strategyPolicyAt({
            arm, ctx, hand: ctx.hand, geo: geometry,
            engineActions: byArm[arm.fallbackArmId]?.actions ?? null,
            poolActions: pool.actions ?? null,
            coverage: coverageByArm[arm.id],
          });
          if (!res.ok) { armFailure = { arm: arm.id, reason: res.reason }; break; }
          byArm[arm.id] = res;
        }
      }
      if (armFailure) {
        bump(counters.policySkips, arms.length > 1
          ? `${armFailure.arm}:${armFailure.reason}`
          : armFailure.reason);
        continue;
      }
      const ours = byArm[primaryId];

      // WS-331 — the ceiling, from the equities the engine pass just paid for.
      const pbrArgs = {
        ctx, hand: ctx.hand, geo, perCombo: ours.perCombo, policy,
      };
      const pbr = poolBestResponseAt(pbrArgs);
      if (!pbr.ok) bump(counters.pbrSkips, pbr.reason);

      decisions.push({
        playerId: playerKey,
        handId: ctx.handId,
        order: ctx.order,
        // WS-433 — the stable coordinates. What the merge sorts by, what seeds derive
        // from, and what makes a chunked run the same measurement as a whole one.
        stable: { p: playerIndex, k: checkpointIndex, d: decisionOrdinal },
        observedAction: ctx.action,
        observedAmount: ctx.amount ?? null,
        netBB,
        netBBUnraked,
        street: ctx.street,
        heroSeat: ctx.playerSeat,
        buttonSeat: ctx.buttonSeat ?? null,
        opponentSeat: ctx.opponentSeat ?? null,
        board: Array.isArray(ctx.board) ? [...ctx.board] : null,
        boardLabels: Array.isArray(ctx.board) ? ctx.board.map(cardLabel) : null,
        situationKey: ctx.situationKey ?? null,
        contextAction: ctx.contextAction ?? null,
        isAgg: ctx.isAgg,
        isIP: ctx.isIP,
        rangeEquityPct: ctx.rangeEquityPct ?? null,
        segmentation: ctx.segmentation ?? null,
        geometry,
        piOurs: ours.actions,
        evStats: ours.evStats ?? null,
        piOursByArm: Object.fromEntries(arms.map((a) => [a.id, byArm[a.id].actions])),
        piPool: pool.actions,
        poolEvidenceN: pool.evidenceN,
        piPbr: pbr.ok ? pbr.actions : null,
        piPbrBySweep: pbr.ok ? poolBestResponseSweep(pbrArgs) : null,
        slices: {
          street: ctx.street,
          facingAction: ctx.facingAction,
          texture: ctx.texture,
          posCategory: ctx.posCategory,
          sizeBucket,
          playersInPot: liveOpponentCount(ctx.hand, ctx.order, ctx.playerSeat) + 1,
          wentToShowdown: raked.wentToShowdown,
        },
      });

      // WS-393 — the full record, emitted as it completes; WS-431 — ALSO retained on the
      // fragment (`records`), so `persistWave` can put it in the chunk and a `--resume`
      // can replay it into the sink. Without that, chunk-seeded waves never re-execute
      // and their records were silently absent from a resumed run's sidecar (defect B).
      if (captureRecord) {
        const row = decisions[decisions.length - 1];
        const record = {
          schemaVersion: DECISION_RECORD_SCHEMA_VERSION,
          ...row,
          pPoolObserved: pool.actions?.[ctx.action] ?? null,
          pOursObservedByArm: Object.fromEntries(
            arms.map((a) => [a.id, byArm[a.id].actions?.[ctx.action] ?? null]),
          ),
          // pi_ours, pi_pool, w and R are kept SEPARATE and never pre-multiplied — a
          // pre-aggregated number is a question foreclosed (decisionRecord.mjs header).
          // `wRawByArm` is deliberately UNCAPPED: the weight cap is a property of the
          // ESTIMATOR, applied at read time (`weightFor`, ipsEstimator.mjs), never a
          // property of the record.
          wRawByArm: Object.fromEntries(arms.map((a) => {
            const po = byArm[a.id].actions?.[ctx.action];
            const pp = pool.actions?.[ctx.action];
            return [a.id, (Number.isFinite(po) && Number.isFinite(pp) && pp > 0) ? po / pp : null];
          })),
          heroTruth: compactHeroTruth(
            ctx.holding ? holdingTruth(ctx.holding, { board: ctx.board }) : null,
          ),
          evStatsByArm: Object.fromEntries(
            arms.map((a) => [a.id, byArm[a.id].evStats ?? null]),
          ),
          combosByArm: Object.fromEntries(
            arms.map((a) => [a.id, byArm[a.id].comboDetail ?? null]),
          ),
          policyDiagByArm: Object.fromEntries(arms.map((a) => [a.id, {
            samples: byArm[a.id].samples ?? null,
            engineErrors: byArm[a.id].engineErrors ?? null,
            outOfSet: byArm[a.id].outOfSet ?? null,
          }])),
          pbrSkipReason: pbr.ok ? null : (pbr.reason ?? null),
        };
        records.push(record);
        if (onDecisionRecord) {
          try {
            onDecisionRecord(record);
          } catch (err) {
            // A sidecar write must never be able to kill a multi-hour scoring pass.
            counters.decisionRecordErrors += 1;
            counters.decisionRecordLastError = err?.message || String(err);
          }
        }
      }

      if (onProgress && decisions.length % 10 === 0) onProgress({ playerIndex, decisionsScored: decisions.length });
      if (decisions.length >= maxDecisionsForPlayer) { stop = true; break; }
    }
  }

  return {
    playerIndex,
    playerKey,
    playerId,
    decisions,
    ...(captureRecord ? { records } : {}),
    counters,
    ledger,
    coverageByArm,
    contributed: decisions.length > 0,
    // Mirror of the guard's assertWalkForward counter for this player, so a parallel run
    // can synthesize the run-level integrity summary from fragments (each worker holds
    // its own guard; their counters cannot be read across threads).
    walkForwardChecked,
  };
};
