/**
 * heroEvRunner.mjs — the hero-EV scoring pass (WS-287).
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
 */

import { buildRangeProfile } from '../../src/utils/rangeEngine/index.js';
import { accumulateDecisions } from '../../src/utils/exploitEngine/decisionAccumulator.js';
import { LeakageGuard } from './leakageGuard.mjs';
import { validateBehaviorPolicy, queryPolicy } from './behaviorPolicy.mjs';
import { indexEvalPlayers } from './runner.mjs';
import { resolveHandOutcome } from './handOutcome.mjs';
import { heroPolicyAt, DEFAULT_COMBO_SAMPLES, DEFAULT_TRIALS } from './heroPolicy.mjs';
import {
  decisionGeometry, sizeBucketFor, liveOpponentCount,
  sprFor, sprBandFor, closesAction,
} from './decisionGeometry.mjs';
import { holdingTruth } from '../../src/utils/holdingKnowledge/index.js';
import {
  DECISION_RECORD_SCHEMA_VERSION, cardLabel, compactHeroTruth,
} from './decisionRecord.mjs';
import {
  validatePbrHeldOut, poolBestResponseAt, poolBestResponseSweep,
  PBR_SHRINK_SWEEP, PBR_SURFACE_ID,
} from './poolBestResponse.mjs';
import {
  FALLBACK, validateStrategy, validateFallback, strategyPolicyAt,
  newCoverage, summarizeCoverage,
} from './strategyArm.mjs';

const USER_ID = 'backtest';

/**
 * Modelled online 50NL rake. The corpus stores NO rake, so this is an assumption about
 * the games these hands came from, not a reading of them — and it is reported as
 * modelled wherever it appears. POKER_THEORY 11.3 defines the schedule shape.
 */
export const DEFAULT_RAKE_CONFIG = { pct: 0.05, cap: 3, noFlopNoDrop: true };

const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };

/**
 * The single-policy pass expressed as a one-armed ablation.
 *
 * Collapsing "no arms" into "one arm with the engine's own default budget" means there is
 * exactly ONE scoring loop in this module. A second loop for the unablated case would be a
 * second thing to keep correct, and the copy nobody exercises is the copy that drifts —
 * the same argument `snapshot()` below makes for partial vs final.
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

  // WS-425 — the STRATEGY axis, which is orthogonal to the depth axis above.
  //
  // A depth arm varies the engine's search budget; a strategy arm replaces the policy
  // entirely with an externally-published rule. Both land a distribution in `piOursByArm`,
  // which is the only thing `estimateEdge` and `pairedDelta` read — so the two axes share
  // every downstream figure and neither needs to know about the other.
  //
  // Engine arms are ordered FIRST unconditionally, so that a strategy arm falling back to
  // the engine at a decision it does not cover always has its fallback source in hand. The
  // reorder is invisible to every existing caller because a run with no strategy arms is
  // reordered onto itself.
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
  // WS-322 / ADR-009. Both default to null so every existing caller and test keeps working;
  // a run without them still measures, and its report says plainly that it produced no
  // Result Card and must not be quoted.
  dealBook = null,
  replicationStamp = null,
  surfaceId = 'engine-read',
  fieldId = 'pool-mined-behavior-policy',
  // WS-334 AC5 — the depth ablation.
  //
  // `null` (the default) is the existing single-policy pass, unchanged. When supplied, this
  // is an ordered list of `{ id, refinementBudgetMs }`: the engine is asked for its advice
  // ONCE PER ARM at every decision, and both answers are stored on the same row.
  //
  // WHY BOTH ARMS RUN IN ONE PASS rather than as two runs differenced afterwards. Two runs
  // would share a Deal Book but not a decision SET — a checkpoint that skipped in one run
  // for an engine error, a walk-forward boundary, or a policy skip would leave the arms
  // scored over different decisions, and the difference would then contain a selection
  // effect indistinguishable from a depth effect. Here a decision is kept only if EVERY arm
  // produced a policy for it, so the contrast is exactly paired and the population term in
  // the edge cancels identically.
  depthArms = null,
  // Which arm supplies `piOurs` (and the equities PBR consumes) so that every existing
  // downstream reader of a run keeps its current meaning. Defaults to the LAST arm, which is
  // the shipped configuration by convention of how the arms are ordered.
  primaryArmId = null,
  log = () => {},
  // Called with a PARTIAL snapshot (`complete: false`) every 25 scored decisions. Default
  // no-op, so nothing changes for callers that do not want it.
  onPartial = () => {},
  // WS-393 — the full decision-level record, one call per scored decision, as it is scored.
  //
  // Null (the default) leaves every existing caller unchanged and, importantly, leaves the
  // per-combo capture OFF inside `heroPolicyAt` — so a run that does not want the record
  // does not pay for it in memory or time.
  //
  // Supplying it does NOT change what lands in `--out`. The heavy per-combo payload goes to
  // the callback (a JSONL sidecar, in practice) and is never retained on `decisions`,
  // because `decisions` is what the report re-reads and what a human opens.
  onDecisionRecord = null,
  // WS-425. Opt-in to a strategy arm whose `fallback: 'refuse'` changes the decision set the
  // OTHER arms are averaged over. Off by default because that change is invisible in the
  // output it produces and visible only in the one it does not.
  allowSetChange = false,
}) => {
  // All guards run at construction, before any work: a run that could leak must not
  // be able to start, let alone produce a number someone might quote.
  const captureRecord = typeof onDecisionRecord === 'function';
  const arms = normalizeDepthArms(depthArms, { allowSetChange });
  const engineArms = arms.filter((a) => !a.strategy);
  const strategyArms = arms.filter((a) => a.strategy);
  // The primary arm supplies `perCombo` (which PBR consumes) and `evStats` (which the
  // optimizer's-curse figures consume). A strategy arm computes neither — it never calls the
  // engine — so making one primary would silently null the ceiling and the curse for the
  // whole run while every other figure kept working.
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
  const coverageByArm = Object.fromEntries(strategyArms.map((a) => [a.id, newCoverage()]));

  const guard = new LeakageGuard({ poolPct, reference });
  const policy = validateBehaviorPolicy(behaviorPolicy, poolPct);
  // WS-331. A THIRD refusal, not a repeat of the second. `validateBehaviorPolicy` asks whether
  // this table may be a DENOMINATOR for these players; this asks whether a BEST RESPONSE
  // derived from it may be scored on them. The second question is strictly stronger — at
  // poolPct=100 the denominator is legitimate and the best response would be evaluated on its
  // own training set, which is the inflated-ceiling failure the ticket exists to prevent.
  validatePbrHeldOut(policy, poolPct);

  const { byPlayer, skipStats, handsRead } = await indexEvalPlayers({
    files,
    poolPct,
    maxPlayers,
    maxHandsPerPlayer,
    onProgress: ({ handsRead: h, players }) => log(`read ${h} hands, ${players} eval players`),
  });
  log(`indexed ${byPlayer.size} EVAL players from ${handsRead} hands`);

  const decisions = [];
  const counters = {
    checkpoints: 0,
    skippedCheckpoints: 0,
    outcomeUnresolved: {},
    policySkips: {},
    pbrSkips: {},
    geometrySkips: 0,
    engineErrors: 0,
    heroSeatNotInOutcome: 0,
  };

  const outcomeCache = new Map();
  const outcomeFor = (hand) => {
    if (outcomeCache.has(hand)) return outcomeCache.get(hand);
    const r = resolveHandOutcome(hand, { rakeConfig });
    // Also compute the unraked ledger so the rake-inclusive and rake-free edges can be
    // reported side by side from a single pass. The accept criteria require that an
    // edge which vanishes under rake be reported as vanishing.
    const bare = resolveHandOutcome(hand, { rakeConfig: null });
    const both = { raked: r, unraked: bare };
    outcomeCache.set(hand, both);
    return both;
  };

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
      try {
        trainProfile = buildRangeProfile(playerId, trainHands, USER_ID);
      } catch {
        counters.skippedCheckpoints++;
        continue;
      }
      if (!trainProfile) { counters.skippedCheckpoints++; continue; }
      counters.checkpoints++;

      // `accumulateDecisions` is synchronous and the engine call is async, so the
      // contexts are collected first and scored after. Doing the engine work inside
      // the callback would silently drop every await.
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
        continue;
      }

      for (const ctx of ctxs) {
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
        // policy and the slices already used. Nothing here is a new notion of the pot; `spr`
        // and `closesAction` are the two coordinates `decisionGeometryFull` adds, taken
        // through the shared derivation rather than re-derived locally.
        //
        // Stored raw and unbucketed ALONGSIDE the buckets in `slices`, not instead of them:
        // a bucket boundary is a decision someone made before the data existed, and keeping
        // only `sizeBucket: '33-66'` forecloses every question that wants the real 0.51.
        //
        // WS-425 MOVED THIS ABOVE THE ARM LOOP. It used to be built after the arms, which was
        // fine while only the engine consumed geometry. A Strategy Card matches on `sprBand`
        // and `closesAction` (both `CARRIED_AXES`), so a card arm needs them BEFORE it is
        // asked for a policy. Deriving them a second time inside the arm would be a second
        // notion of the same coordinate, which is what this block's own comment forbids —
        // so it moves rather than being copied. Nothing here depends on any arm, so the move
        // is pure and the resulting row is byte-identical.
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

        // ONE ENGINE PASS PER ARM, and a decision survives only if EVERY arm produced a
        // policy. Keeping a decision one arm could score and the other could not would let a
        // skip pattern that CORRELATES WITH DEPTH (a refinement stage that throws only on
        // hard spots, say) enter the contrast as if it were a depth effect.
        const byArm = {};
        let armFailure = null;
        for (const arm of engineArms) {
          // eslint-disable-next-line no-await-in-loop -- the engine call is the cost; arms are 1-2
          const res = await heroPolicyAt({
            ctx, hand: ctx.hand, rakeConfig, comboSamples, trials,
            refinementBudgetMs: arm.refinementBudgetMs,
            captureComboDetail: captureRecord,
          });
          counters.engineErrors += res.engineErrors ?? 0;
          if (!res.ok) { armFailure = { arm: arm.id, reason: res.reason }; break; }
          byArm[arm.id] = res;
        }
        // WS-425 — strategy arms, evaluated AFTER the engine arms so an arm falling back to
        // the engine has its fallback source. Pure functions of the decision: no engine call,
        // no clock, no RNG, so this pass adds no wall-clock dependence to the run and a
        // strategy arm's own distribution is bit-reproducible.
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

        // WS-331 — the ceiling, from the equities the engine pass just paid for. No engine
        // call. Scored on exactly the decisions the engine policy is scored on, so the two
        // arms share a denominator and `exploitationEfficiency` is a ratio of like for like.
        const pbrArgs = {
          ctx, hand: ctx.hand, geo, perCombo: ours.perCombo, policy,
        };
        const pbr = poolBestResponseAt(pbrArgs);
        if (!pbr.ok) bump(counters.pbrSkips, pbr.reason);

        decisions.push({
          playerId,
          handId: ctx.handId,
          order: ctx.order,
          observedAction: ctx.action,
          observedAmount: ctx.amount ?? null,
          netBB,
          netBBUnraked,
          // ── WS-393 raw context. Additive; no consumer of this row reads any of it. ──
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
          // WS-295 — the engine's OWN stated EV at this node, from the primary arm.
          //
          // This sits beside `netBB` (what the hand actually paid) deliberately: the optimizer's
          // curse is the gap between what the engine asserts and what its advice delivers, and
          // the two quantities have never before been on the same row. They are NOT on the same
          // scale — `netBB` is the whole hand's net in bb, `statedEvMean` is a per-decision
          // quantity in the engine's internal chips — so no figure may difference them directly.
          // heroEvReport measures the SHAPE, which survives the unit mismatch.
          evStats: ours.evStats ?? null,
          // WS-334 AC5. Present on every run — a single-arm run carries `{ default: … }`,
          // which is the same object `piOurs` already is. A field that exists only on the
          // ablation runs would be a field every reader has to remember to check for.
          piOursByArm: Object.fromEntries(arms.map((a) => [a.id, byArm[a.id].actions])),
          piPool: pool.actions,
          poolEvidenceN: pool.evidenceN,
          // The ceiling at the shipped shrinkage, and the whole sweep beside it. The sweep is
          // stored PER DECISION rather than aggregated here because the report scores each
          // sweep point through the same `estimateEdge` the other arms use — aggregating
          // early would create the second comparison path ADR-009 forbids.
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

        // WS-393 — the full record, emitted once, never retained. See decisionRecord.mjs
        // for why the heavy payload does not live on `decisions`.
        if (captureRecord) {
          const row = decisions[decisions.length - 1];
          try {
            onDecisionRecord({
              schemaVersion: DECISION_RECORD_SCHEMA_VERSION,
              ...row,
              // pi_ours, pi_pool, w and R kept SEPARATE and never pre-multiplied: the
              // question "was this decision's contribution driven by a big weight or a big
              // outcome" is unanswerable from a product. `wRawByArm` is uncapped — the
              // weight cap is a property of the ESTIMATOR, applied at read time, so a run
              // recorded at cap 20 can still be re-read at cap 5.
              pPoolObserved: pool.actions?.[ctx.action] ?? null,
              pOursObservedByArm: Object.fromEntries(
                arms.map((a) => [a.id, byArm[a.id].actions?.[ctx.action] ?? null]),
              ),
              wRawByArm: Object.fromEntries(arms.map((a) => {
                const po = byArm[a.id].actions?.[ctx.action];
                const pp = pool.actions?.[ctx.action];
                return [a.id, (Number.isFinite(po) && Number.isFinite(pp) && pp > 0) ? po / pp : null];
              })),
              // Hero's ACTUAL hand where the corpus showed it. Read the docblock on
              // compactHeroTruth before conditioning on this — it is showdown-selected.
              heroTruth: compactHeroTruth(
                ctx.holding ? holdingTruth(ctx.holding, { board: ctx.board }) : null,
              ),
              evStatsByArm: Object.fromEntries(
                arms.map((a) => [a.id, byArm[a.id].evStats ?? null]),
              ),
              // The whole ranked candidate set, per sampled combo, per arm. This is the
              // heavy part and the reason the sidecar exists.
              combosByArm: Object.fromEntries(
                arms.map((a) => [a.id, byArm[a.id].comboDetail ?? null]),
              ),
              policyDiagByArm: Object.fromEntries(arms.map((a) => [a.id, {
                samples: byArm[a.id].samples ?? null,
                engineErrors: byArm[a.id].engineErrors ?? null,
                outOfSet: byArm[a.id].outOfSet ?? null,
              }])),
              pbrSkipReason: pbr.ok ? null : (pbr.reason ?? null),
            });
          } catch (err) {
            // A sidecar write must never be able to kill a multi-hour scoring pass.
            counters.decisionRecordErrors = (counters.decisionRecordErrors || 0) + 1;
            counters.decisionRecordLastError = err?.message || String(err);
          }
        }

        if (decisions.length % 25 === 0) {
          log(`scored ${decisions.length} decisions`);
          // A full pass is measured in HOURS and used to write nothing until it returned,
          // so an interrupted run — however far it got — produced exactly as much as one
          // killed on the first decision. Emit a snapshot at the same cadence as the
          // progress line so a kill costs precision, not the whole run.
          onPartial(snapshot(false));
        }
        if (decisions.length >= maxDecisions) { stop = true; break; }
      }
    }
  }

  return snapshot(true);

  // Declared after the loop it serves (hoisted): partial and final snapshots MUST be built
  // by the same code. Two constructions would be two chances to disagree about what a run
  // contains, and the partial one is the copy nobody checks — same argument as
  // decisionGeometry.mjs makes for the pot convention.
  function snapshot(complete) {
    return {
      complete,
      decisionsScored: decisions.length,
      decisions,
      integrity: {
        ...guard.summary(),
        behaviorPolicy: {
          partition: policy.provenance.partition,
          poolPct: policy.provenance.poolPct,
          observations: policy.provenance.observations,
          players: policy.provenance.players,
          hierarchy: policy.provenance.hierarchy,
        },
        // WS-331. Stamped so a reader of the artifact can see that the ceiling was HELD OUT
        // without re-deriving it from the partition fields above — the held-out property is
        // what separates a trusted anchor from an inflated fantasy, and it must travel with
        // the number rather than being reconstructable by someone who knows to check.
        pbr: {
          surfaceId: PBR_SURFACE_ID,
          fitPartition: policy.provenance.partition,
          evaluatedOn: 'eval',
          heldOut: true,
          poolPct,
          shrinkSweep: [...PBR_SHRINK_SWEEP],
        },
      },
      counters: { ...counters, handsRead, evalPlayers: byPlayer.size, adapterSkips: skipStats },
      config: {
        poolPct, minTrainHands, checkpointInterval, comboSamples, trials,
        rakeConfig, rakeIsModelled: true, maxDecisions,
        depthArms: arms.map((a) => ({ id: a.id, refinementBudgetMs: a.refinementBudgetMs ?? null })),
        primaryArmId: primaryId,
        // WS-425. Recorded per arm, in the config rather than only in the report, because
        // `encoding` is what says whether the arm IS the publication or a hybrid carrying
        // something we supplied — and a reader who loses that distinction reads a hybrid's
        // win as the publication's.
        strategyArms: strategyArms.map((a) => ({
          id: a.id,
          strategyId: a.strategy.id,
          strategyVersion: a.strategy.version ?? null,
          encoding: a.strategy.encoding,
          sourceRef: a.strategy.sourceRef,
          fallback: a.fallback,
          fallbackArmId: a.fallback === 'engine' ? a.fallbackArmId : null,
        })),
      },
      // Coverage is a PROPERTY OF THE RUN, not of the report: it depends on which decisions
      // the corpus produced, so it cannot be recomputed from the artifact afterwards.
      strategyCoverage: Object.fromEntries(
        strategyArms.map((a) => [a.id, summarizeCoverage(coverageByArm[a.id])]),
      ),
      // Carried, not computed here — the runner measures, the report assembles the card.
      dealBook,
      replicationStamp,
      surfaceId,
      fieldId,
    };
  }
};
