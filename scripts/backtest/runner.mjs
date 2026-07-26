/**
 * runner.mjs — WS-273 walk-forward backtest over the HandHQ corpus.
 *
 * Loaded through `loader.mjs` (Vite SSR) so it can import the PRODUCTION engine
 * modules directly. That is the whole point: the harness must score the model
 * the app actually ships, not a reimplementation of it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT MEASURES
 *
 * At every villain decision point in a held-out hand, the engine emits its
 * predicted action distribution BEFORE the action is revealed. That prediction
 * is scored against what the villain actually did, and against the population
 * prior on the identical decision. The number that means anything is the LIFT
 * over that prior — a raw log-loss is uninterpretable on its own.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TWO-LEVEL SPLIT (founder-approved 2026-07-26)
 *
 *   Across players: POOL players train the Reference-tier priors; EVAL players
 *   are scored and contributed nothing to those priors.
 *
 *   Within a player: walk-forward. Train on hands [0, cp), predict the next
 *   `checkpointInterval` hands, advance, repeat. The per-villain model is
 *   personalised, so it MUST train on the player it predicts — but only on
 *   their past.
 *
 * A pure by-player split (the ticket's original default) would leave zero
 * training data for the scored villain and could only ever measure the generic
 * population guess — not the personalised model, which is the product.
 *
 * Both levels are asserted by `leakageGuard.mjs`, not merely intended.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * CAVEATS INHERITED FROM THE CORPUS (binding, per WS-262/263): online pools only,
 * July 2009 era, numeric stakes. This measures whether the model predicts THAT
 * population. Live 1/2 generalisation is an assumption and is labelled as one at
 * the point of every number the reporter prints.
 */

import { buildRangeProfile } from '../../src/utils/rangeEngine/index.js';
import { accumulateDecisions } from '../../src/utils/exploitEngine/decisionAccumulator.js';
import {
  buildVillainDecisionModel,
  queryActionDistribution,
  buildActionPriors,
} from '../../src/utils/exploitEngine/villainDecisionModel.js';
import {
  observationBucket,
  getSPRZone,
  brierScore,
  argmaxAction,
} from '../../src/utils/exploitEngine/calibrationMetrics.js';
import { resolveStatPriors, canonicalStakeLabel } from '../../src/utils/exploitEngine/poolBaseline.js';
import {
  buildPlayerStats,
  derivePercentages,
  classifyStyle,
} from '../../src/utils/tendencyCalculations.js';
import { buildTimeline } from '../../src/utils/handAnalysis/handTimeline.js';
import { derivePreflopDecisions } from '../../src/utils/rangeEngine/lineTaxonomy.js';
import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';

import { iterAppHands } from './phhAdapter.mjs';
import { partitionOf, GROUPS, DEFAULT_POOL_PCT } from './partition.mjs';
import { LeakageGuard } from './leakageGuard.mjs';
import { HIERARCHY_VARIANTS, hierarchyOptionsFor } from './hierarchyVariants.mjs';

/** Minimum hands a player needs before the first checkpoint. Mirrors modelAudit. */
export const DEFAULT_MIN_TRAIN_HANDS = 15;

/** Hands per prediction window. Mirrors modelAudit's CHECKPOINT_INTERVAL. */
export const DEFAULT_CHECKPOINT_INTERVAL = 10;

const USER_ID = 'backtest';

// =============================================================================
// BASELINE
// =============================================================================

const PRIORS = buildActionPriors();

/**
 * The population-prior prediction for a facing context — the baseline every
 * model prediction is measured against.
 *
 * Derived from the engine's own `buildActionPriors` rather than a hand-copied
 * table, so the baseline moves if the engine's priors move.
 */
const priorPrediction = (facingAction) => {
  const prior = PRIORS[facingAction] || PRIORS.none;
  const total = Object.values(prior).reduce((s, v) => s + v, 0);
  return Object.fromEntries(Object.entries(prior).map(([a, alpha]) => [a, alpha / total]));
};

// =============================================================================
// SLICE DERIVATION
// =============================================================================

/**
 * Seats still live when `order` was decided — everyone dealt in who had not
 * already folded. Drives the players-in-pot slice, which matters because equity
 * denial is worth more multiway (POKER_THEORY §3.4.1) and the heads-up formulas
 * the engine leans on understate it.
 */
const playersInPotAt = (hand, order) => {
  const folded = new Set();
  for (const e of hand.gameState.actionSequence) {
    if (e.order >= order) break;
    if (e.action === PRIMITIVE_ACTIONS.FOLD) folded.add(String(e.seat));
  }
  return Object.keys(hand.seatPlayers).filter(s => !folded.has(String(s))).length;
};

/**
 * The WS-256 preflop line class for this seat in this hand.
 * Subclass when one applies, otherwise the retained parent — never a
 * first-action-only reading (memory: derived line tags are decision-context
 * descriptive).
 */
const lineClassFor = (hand, playerSeat, timeline) => {
  const preflop = timeline.filter(e => e.street === 'preflop');
  const decisions = derivePreflopDecisions(preflop, playerSeat);
  if (!decisions || decisions.length === 0) return 'none';
  const last = decisions[decisions.length - 1];
  return last.subAction || last.parentAction;
};

/**
 * Pot and faced-bet size in BIG BLINDS at a decision.
 *
 * Needed for the fold-vs-bet EV bridge: a fold-probability error only converts
 * to money once you know the pot it was wrong about. Expressed in bb so results
 * are comparable across stakes.
 */
const potAndBetBB = (hand, order, street) => {
  const bt = hand._backtest || {};
  const bb = bt.bb;
  const pot = bt.potBeforeByOrder?.[order];
  if (!Number.isFinite(bb) || bb <= 0 || !Number.isFinite(pot)) return {};

  // The live bet this seat is answering: the last aggressive action before
  // `order` on the same street.
  let facedBet = null;
  for (const e of hand.gameState.actionSequence) {
    if (e.order >= order) break;
    if (e.street !== street) continue;
    if (e.action === PRIMITIVE_ACTIONS.BET || e.action === PRIMITIVE_ACTIONS.RAISE) {
      facedBet = e.amount;
    }
  }

  const potBB = pot / bb;
  const facingBetBB = Number.isFinite(facedBet) ? facedBet / bb : null;

  return { potBB, facingBetBB, sizeBucket: sizeBucketFor(facingBetBB, potBB) };
};

/**
 * Bet size as a fraction of the pot, bucketed on the WS-262 mining boundaries.
 *
 * This is the grouping the EV bridge must use. Breakeven fold frequency is
 * `bet / (pot + bet)` — a pure function of bet-to-pot ratio — so a group with a
 * constant size bucket has a near-constant breakeven, and its empirical fold
 * rate is the conditional that actually decides whether an estimate error flips
 * hero's decision. Grouping by SPR instead mixes sizings whose breakevens differ
 * by a factor of three, then charges one group-average fold rate against every
 * pot in the group — which manufactures cost rather than measuring it.
 */
const sizeBucketFor = (betBB, potBB) => {
  if (!Number.isFinite(betBB) || !Number.isFinite(potBB) || potBB <= 0) return 'unknown';
  const frac = betBB / potBB;
  if (frac < 0.33) return '0-33';
  if (frac < 0.66) return '33-66';
  if (frac < 1.0) return '66-100';
  if (frac < 1.5) return '100-150';
  return '150+';
};

/**
 * The segment and seat bucket a corpus player's Reference-tier priors resolve
 * against, taken from the modal table they actually sat at in the training hands.
 *
 * `resolveReferenceCounts` only serves `online/<numeric-stake>` keys — the
 * founder-ratified live/online separation (POKER_THEORY §6.5a rule 4) — and the
 * corpus is online by construction, so the key is always well formed here.
 * Seat bucket matters because 6-max and full-ring differ on EVERY stat
 * (25NL VPIP 28.6% vs 22.0%, WS-262).
 */
const segmentFor = (hands) => {
  const stakeCount = new Map();
  const bucketCount = new Map();

  for (const h of hands) {
    const bt = h._backtest || {};
    const blinds = h.gameState?.blinds;
    if (blinds?.bb > 0) {
      const slug = canonicalStakeLabel(`${blinds.sb}/${blinds.bb}`);
      stakeCount.set(slug, (stakeCount.get(slug) || 0) + 1);
    }
    const bucket = (bt.dealtIn ?? 0) >= 7 ? 'full' : '6max';
    bucketCount.set(bucket, (bucketCount.get(bucket) || 0) + 1);
  }

  const modal = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const stake = modal(stakeCount);

  return {
    segmentKey: stake ? `online/${stake}` : null,
    seatBucket: modal(bucketCount),
  };
};

const sprZoneFor = (hand, order) => {
  const bt = hand._backtest || {};
  const pot = bt.potBeforeByOrder?.[order];
  const stack = bt.stackBeforeByOrder?.[order];
  if (!Number.isFinite(pot) || !Number.isFinite(stack) || pot <= 0) return 'unknown';
  return getSPRZone(stack / pot);
};

// =============================================================================
// PER-PLAYER WALK-FORWARD
// =============================================================================

/**
 * Score one EVAL player by walking forward through their hands.
 *
 * @returns {{ records: Array, checkpoints: number, skippedCheckpoints: number }}
 */
export const scorePlayer = ({
  playerId,
  hands,
  guard,
  minTrainHands = DEFAULT_MIN_TRAIN_HANDS,
  checkpointInterval = DEFAULT_CHECKPOINT_INTERVAL,
  referenceTable = null,
  hierarchyOptions = {},
}) => {
  guard.assertEvalPlayer(playerId);

  const { segmentKey, seatBucket } = segmentFor(hands);

  const records = [];
  let checkpoints = 0;
  let skippedCheckpoints = 0;

  for (let cp = minTrainHands; cp < hands.length; cp += checkpointInterval) {
    const trainHands = hands.slice(0, cp);
    const testHands = hands.slice(cp, cp + checkpointInterval);
    if (testHands.length === 0) break;

    // ---- build the model from the PAST ONLY ----
    let model;
    let trainProfile;
    try {
      trainProfile = buildRangeProfile(playerId, trainHands, USER_ID);
      if (!trainProfile) { skippedCheckpoints++; continue; }
      const trainSummary = accumulateDecisions(playerId, trainHands, trainProfile, USER_ID);

      // The four-tier prior hierarchy (POKER_THEORY §6.5a), resolved from the
      // PAST hands only. `poolIndex: null` = no founder-observed pool exists for
      // a corpus villain, so the blend is founder estimate → Reference tier.
      // `excludePlayerId` still passes the leave-one-out guard explicitly even
      // though the reference tier sits outside it — the POOL/EVAL partition is
      // what actually keeps this villain out of its own prior.
      const statPriors = referenceTable
        ? resolveStatPriors({
          poolIndex: null,
          segmentKey,
          excludePlayerId: playerId,
          referenceTable,
          seatBucket,
        })
        : null;

      // Percentages and style are what the app feeds the model
      // (analysisPipeline.js steps 1-2). Passing `{}` here — as this runner
      // originally did — silently scored a model with NO stats and NO style,
      // which disables the style-conditioned priors entirely and is not the
      // configuration that ships.
      const pct = derivePercentages(buildPlayerStats(playerId, trainHands), statPriors);
      const style = classifyStyle(pct);
      model = buildVillainDecisionModel(trainSummary, { ...pct, style });
    } catch {
      skippedCheckpoints++;
      continue;
    }
    if (!model) { skippedCheckpoints++; continue; }

    checkpoints++;

    // ---- derive the test-window decision contexts ----
    //
    // The range profile used to READ the test hands is also the train-only one.
    // modelAudit builds its test profile from train+test; using train-only here
    // is strictly more conservative and removes a subtle criticism, at the cost
    // of skipping decisions in positions the player never occupied in training.
    // Those skips are counted, not hidden.
    try {
      accumulateDecisions(playerId, testHands, trainProfile, USER_ID, {
        onDecision: (ctx) => {
          const globalHandIdx = cp + ctx.handIdx;
          guard.assertWalkForward({ playerId, trainEndIdx: cp, handIdx: globalHandIdx });

          const dist = queryActionDistribution(
            model, ctx.street, ctx.texture, ctx.posCategory,
            ctx.isAgg, ctx.isIP, ctx.facingAction,
            hierarchyOptions,
          );
          const predicted = dist.actions;
          if (!predicted || Object.keys(predicted).length === 0) return;

          const actual = ctx.action;
          const timeline = buildTimeline(ctx.hand);

          records.push({
            predicted,
            baseline: priorPrediction(ctx.facingAction),
            actual,
            predictedAction: argmaxAction(predicted),
            modelBrier: brierScore(predicted, actual),
            source: dist.source,
            confidence: dist.confidence,
            slices: {
              street: ctx.street,
              lineClass: lineClassFor(ctx.hand, ctx.playerSeat, timeline),
              sprZone: sprZoneFor(ctx.hand, ctx.order),
              playersInPot: playersInPotAt(ctx.hand, ctx.order),
              stakeSegment: ctx.hand?._backtest?.stakeLabel ?? 'unknown',
              obsBucket: observationBucket(model.totalObservations),
              facingAction: ctx.facingAction,
              sizeBucket: potAndBetBB(ctx.hand, ctx.order, ctx.street).sizeBucket ?? 'unknown',
            },
            // Provenance for auditing an individual record back to its hand,
            // plus the pot/bet context the EV bridge needs.
            _meta: {
              playerId,
              handId: ctx.handId,
              order: ctx.order,
              ...potAndBetBB(ctx.hand, ctx.order, ctx.street),
              trainEndIdx: cp,
              handIdx: globalHandIdx,
              texture: ctx.texture,
              posCategory: ctx.posCategory,
            },
          });
        },
      });
    } catch {
      skippedCheckpoints++;
    }
  }

  return { records, checkpoints, skippedCheckpoints };
};

// =============================================================================
// CORPUS INGESTION
// =============================================================================

/**
 * Stream corpus files and index hands by EVAL player.
 *
 * POOL players are dropped at ingest — they are never scored, so holding their
 * hands would only cost memory. Caps are first-class because the per-player cost
 * is quadratic: every checkpoint rebuilds the profile over the whole prefix.
 */
export const indexEvalPlayers = async ({
  files,
  poolPct = DEFAULT_POOL_PCT,
  maxPlayers = Infinity,
  maxHandsPerPlayer = Infinity,
  onProgress = null,
}) => {
  const byPlayer = new Map();
  const skipStats = {};
  let handsRead = 0;

  for (const file of files) {
    for await (const hand of iterAppHands(file.path, { site: file.site, stakeLabel: file.stakeLabel }, skipStats)) {
      handsRead++;
      for (const pid of Object.values(hand.seatPlayers)) {
        if (partitionOf(pid, poolPct) !== GROUPS.EVAL) continue;
        let bucket = byPlayer.get(pid);
        if (!bucket) {
          if (byPlayer.size >= maxPlayers) continue;
          bucket = [];
          byPlayer.set(pid, bucket);
        }
        if (bucket.length < maxHandsPerPlayer) bucket.push(hand);
      }
      if (onProgress && handsRead % 25000 === 0) onProgress({ handsRead, players: byPlayer.size });
    }
  }

  return { byPlayer, skipStats, handsRead };
};

// =============================================================================
// TOP-LEVEL RUN
// =============================================================================

/**
 * Execute a full backtest.
 *
 * @param {Object} opts
 * @param {Array}  opts.files - [{ path, site, stakeLabel }]
 * @param {Object|string} opts.reference - stamped POOL table, or REFERENCE_DISABLED
 * @param {string} [opts.hierarchyVariant='shipped'] - see hierarchyVariants.mjs
 * @returns {Promise<Object>} run result: records + integrity summary + counters
 */
export const runBacktest = async ({
  files,
  reference,
  poolPct = DEFAULT_POOL_PCT,
  maxPlayers = Infinity,
  maxHandsPerPlayer = Infinity,
  minTrainHands = DEFAULT_MIN_TRAIN_HANDS,
  checkpointInterval = DEFAULT_CHECKPOINT_INTERVAL,
  hierarchyVariant = HIERARCHY_VARIANTS.SHIPPED,
  log = () => {},
}) => {
  const startedAt = Date.now();

  // Constructing the guard validates the reference decision. A run with no
  // explicit reference choice cannot start.
  const guard = new LeakageGuard({ poolPct, reference });

  // Throws on an unknown variant before any work is done.
  const hierarchyOptions = hierarchyOptionsFor(hierarchyVariant);

  {
    log(`Indexing ${files.length} corpus file(s)…`);
    const { byPlayer, skipStats, handsRead } = await indexEvalPlayers({
      files, poolPct, maxPlayers, maxHandsPerPlayer,
      onProgress: ({ handsRead: h, players }) => log(`  ${h} hands read, ${players} eval players`),
    });

    const eligible = [...byPlayer.entries()]
      .filter(([, hands]) => hands.length > minTrainHands)
      .sort((a, b) => b[1].length - a[1].length);

    log(`${byPlayer.size} eval players indexed, ${eligible.length} with > ${minTrainHands} hands.`);

    const records = [];
    let checkpoints = 0;
    let skippedCheckpoints = 0;
    let scoredPlayers = 0;

    for (const [playerId, hands] of eligible) {
      const out = scorePlayer({
        playerId, hands, guard, minTrainHands, checkpointInterval, hierarchyOptions,
        // Read from the guard, never from the raw input — this is the table that
        // passed the provenance check.
        referenceTable: guard.referenceTable,
      });
      records.push(...out.records);
      checkpoints += out.checkpoints;
      skippedCheckpoints += out.skippedCheckpoints;
      scoredPlayers++;
      if (scoredPlayers % 25 === 0) {
        log(`  scored ${scoredPlayers}/${eligible.length} players, ${records.length} decisions`);
      }
    }

    return {
      records,
      integrity: guard.summary(),
      counters: {
        handsRead,
        evalPlayersIndexed: byPlayer.size,
        eligiblePlayers: eligible.length,
        scoredPlayers,
        checkpoints,
        skippedCheckpoints,
        decisionsScored: records.length,
        adapterSkips: skipStats,
      },
      config: {
        poolPct, maxPlayers, maxHandsPerPlayer,
        minTrainHands, checkpointInterval, hierarchyVariant,
        files: files.length,
      },
      runtimeMs: Date.now() - startedAt,
    };
  }
};
