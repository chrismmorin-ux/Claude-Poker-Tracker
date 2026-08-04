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
import { decisionGeometry, sizeBucketFor, liveOpponentCount } from './decisionGeometry.mjs';
import {
  validatePbrHeldOut, poolBestResponseAt, poolBestResponseSweep,
  PBR_SHRINK_SWEEP, PBR_SURFACE_ID,
} from './poolBestResponse.mjs';

const USER_ID = 'backtest';

/**
 * Modelled online 50NL rake. The corpus stores NO rake, so this is an assumption about
 * the games these hands came from, not a reading of them — and it is reported as
 * modelled wherever it appears. POKER_THEORY 11.3 defines the schedule shape.
 */
export const DEFAULT_RAKE_CONFIG = { pct: 0.05, cap: 3, noFlopNoDrop: true };

const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };

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
  log = () => {},
  // Called with a PARTIAL snapshot (`complete: false`) every 25 scored decisions. Default
  // no-op, so nothing changes for callers that do not want it.
  onPartial = () => {},
}) => {
  // All guards run at construction, before any work: a run that could leak must not
  // be able to start, let alone produce a number someone might quote.
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

        const ours = await heroPolicyAt({ ctx, hand: ctx.hand, rakeConfig, comboSamples, trials });
        if (!ours.ok) { bump(counters.policySkips, ours.reason); continue; }
        counters.engineErrors += ours.engineErrors;

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
          netBB,
          netBBUnraked,
          piOurs: ours.actions,
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
      },
      // Carried, not computed here — the runner measures, the report assembles the card.
      dealBook,
      replicationStamp,
      surfaceId,
      fieldId,
    };
  }
};
