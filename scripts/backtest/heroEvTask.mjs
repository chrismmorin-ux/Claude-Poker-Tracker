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
import { heroPolicyAt, sampleCombos } from './heroPolicy.mjs';
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
import { strategyPolicyAt, newCoverage, mergeCoverage } from './strategyArm.mjs';
import { buildDecisionContext } from './decisionContextSet.mjs';
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
  decisionContextErrors: 0,
});

/**
 * WS-540 Phase 0 — PER-PHASE COST, MEASURED.
 *
 * The whole decoupling argument rests on "the corpus walk dominates, the arms are cheap".
 * That is a COST MODEL NOBODY HAD MEASURED, and this ticket exists because the last
 * unmeasured cost model in this pipeline was refuted by the first measurement that met it
 * (`run-rule-ladder.mjs` header: removing the engine arm bought nothing).
 *
 * Nanoseconds, summed per phase. Under the pool these are summed across WORKERS, so the
 * total exceeds wall clock by roughly the worker count — which is why `wallMs` is reported
 * beside them and every ratio is taken WITHIN the phase block, never against wall clock.
 *
 * PRODUCTION phases are arm-independent (they are what a persisted decision set would let a
 * later rung skip); SCORING phases are the per-arm work a replay would still pay.
 */
export const PRODUCTION_PHASES = Object.freeze([
  'profileBuild', 'accumulate', 'outcome', 'geometry', 'poolQuery', 'comboSample',
]);
export const SCORING_PHASES = Object.freeze([
  'engineArms', 'strategyArms', 'pbr', 'recordBuild',
]);

/**
 * How often a surviving decision is serialized to measure the prospective context row.
 * `JSON.stringify` of a hand is not free, so this is sampled rather than exhaustive — the
 * output is a mean over `samples`, and `samples` is reported so nobody reads a mean of 3
 * as a measurement.
 */
export const CONTEXT_BYTES_SAMPLE_EVERY = 25;

export const newPhaseTimings = () => {
  const t = { ns: {}, calls: {}, bytes: { samples: 0, contextTotal: 0, handTotal: 0 } };
  for (const p of [...PRODUCTION_PHASES, ...SCORING_PHASES]) { t.ns[p] = 0; t.calls[p] = 0; }
  return t;
};

export const mergePhaseTimings = (acc, frag) => {
  if (!frag) return acc;
  for (const [k, v] of Object.entries(frag.ns || {})) acc.ns[k] = (acc.ns[k] || 0) + v;
  for (const [k, v] of Object.entries(frag.calls || {})) acc.calls[k] = (acc.calls[k] || 0) + v;
  if (frag.bytes) {
    const b = acc.bytes || (acc.bytes = { samples: 0, contextTotal: 0, handTotal: 0 });
    b.samples += frag.bytes.samples || 0;
    b.contextTotal += frag.bytes.contextTotal || 0;
    b.handTotal += frag.bytes.handTotal || 0;
  }
  return acc;
};

/**
 * Split a merged timing block into the two halves the decoupling argument turns on.
 * `productionShare` is the fraction of MEASURED time a persisted decision set could skip.
 * Returns nulls rather than 0 when nothing was measured — a confident zero here would read
 * as "the arms are free", which is the exact claim under test.
 */
export const summarizePhaseTimings = (t) => {
  const sum = (keys) => keys.reduce((a, k) => a + (t?.ns?.[k] || 0), 0);
  const production = sum(PRODUCTION_PHASES);
  const scoring = sum(SCORING_PHASES);
  const total = production + scoring;
  return {
    productionNs: production,
    scoringNs: scoring,
    totalNs: total,
    productionShare: total > 0 ? production / total : null,
    scoringShare: total > 0 ? scoring / total : null,
    byPhaseMs: Object.fromEntries(
      Object.entries(t?.ns || {}).map(([k, v]) => [k, v / 1e6]),
    ),
    calls: { ...(t?.calls || {}) },
    // What a persisted decision set would COST on disk. Null, never 0, when unsampled —
    // `MEASURED_ATOM_BYTES` (atomStore.mjs) exists because the docblock it replaced carried
    // a shape argument ("~1-2 KB each") that was wrong.
    contextBytes: (t?.bytes?.samples > 0) ? {
      samples: t.bytes.samples,
      meanContextBytes: t.bytes.contextTotal / t.bytes.samples,
      meanHandBytes: t.bytes.handTotal / t.bytes.samples,
      handShare: t.bytes.contextTotal > 0 ? t.bytes.handTotal / t.bytes.contextTotal : null,
    } : null,
  };
};

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
    arms, primaryId, captureRecord, captureContext = false, equitySeed = null,
    maxDecisionsForPlayer = Infinity,
    // WS-436 B2 — styled-villain feed, threaded verbatim to heroPolicyAt.
    villainFeed = null, villainSource = 'null',
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
  // WS-540 Phase 1 — arm-independent context rows, retained per fragment for the same
  // reason `records` is: a chunked/resumed wave must replay them or the set comes up short.
  const contexts = [];
  // Cadence for the byte probe below. Counts rows BUILT, not decisions SCORED — the two
  // diverge at the arm gate, and keying a production probe off a post-gate count made its
  // sample depend on which arms happened to fail.
  let contextsBuilt = 0;
  const counters = newTaskCounters();
  const ledger = newHandLedger();

  // WS-540 Phase 0. `timed` adds two hrtime reads (~100 ns) around calls that cost
  // microseconds to seconds — the instrument does not perturb what it measures. It touches
  // no float on any scoring path, so serial/parallel bit-identity is unaffected.
  const timings = newPhaseTimings();
  // EXCLUSIVE (self) time, not inclusive. The first version of this instrument recorded
  // inclusive time and `comboSample` nests inside `strategyArms`, so its cost was counted
  // TWICE and the production/scoring split was an artifact — the tell was a NEGATIVE
  // "unaccounted wall". A phase now records its own time minus the time its children
  // recorded, so the phases sum to the work actually done and the shares mean something.
  //
  // The frame stack is per-invocation (declared here, inside the per-player call), so two
  // players can never share it. Nesting is strictly sequential on this path — every await
  // inside a timed frame is awaited before the next timed call begins.
  const frames = [];
  const enter = () => { frames.push(0); return process.hrtime.bigint(); };
  const exit = (phase, t0) => {
    const total = Number(process.hrtime.bigint() - t0);
    const childNs = frames.pop();
    timings.ns[phase] += total - childNs;
    timings.calls[phase] += 1;
    if (frames.length) frames[frames.length - 1] += total;
  };
  const timed = (phase, fn) => {
    const t0 = enter();
    try { return fn(); } finally { exit(phase, t0); }
  };
  const timedAsync = async (phase, fn) => {
    const t0 = enter();
    try { return await fn(); } finally { exit(phase, t0); }
  };

  // Per-task: a hand shared by two players processed in different workers resolves twice.
  // resolveHandOutcome is cheap pure card math; correctness is unaffected.
  const outcomeCache = new Map();
  const outcomeFor = (hand) => {
    if (outcomeCache.has(hand)) return outcomeCache.get(hand);
    // Only the MISS is timed — a cache hit is not corpus work and counting it would
    // understate the per-decision cost of a set with no cache.
    const both = timed('outcome', () => ({
      raked: resolveHandOutcome(hand, { rakeConfig }),
      unraked: resolveHandOutcome(hand, { rakeConfig: null }),
    }));
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
      trainProfile = timed('profileBuild', () => buildRangeProfile(playerId, trainHands, USER_ID));
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
      timed('accumulate', () => accumulateDecisions(playerId, testHands, trainProfile, USER_ID, {
        onDecision: (ctx) => {
          guard.assertWalkForward({
            playerId, trainEndIdx: cp, handIdx: cp + ctx.handIdx,
          });
          ctxs.push(ctx);
        },
      }));
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
      const geo = timed('geometry', () => decisionGeometry(ctx.hand, ctx.order, ctx.street));
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
      const geometry = timed('geometry', () => {
        const spr = sprFor(geo);
        return {
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
      });

      const policyCtx = {
        facingAction: ctx.facingAction,
        isAgg: ctx.isAgg,
        isIP: ctx.isIP,
        texture: ctx.texture,
        street: ctx.street,
        posCategory: ctx.posCategory,
        sizeBucket,
      };
      const pool = timed('poolQuery', () => queryPolicy(policy, policyCtx));

      // WS-433 — the decision's seed, a pure function of stable coordinates. Null
      // equitySeed leaves every engine call on unseeded Math.random (legacy).
      const decisionSeed = equitySeed === null ? null : seedForDecision({
        equitySeed, playerIndex, checkpointIndex, decisionOrdinal,
      });

      // ── WS-540 — THE COMBO SAMPLE IS A PROPERTY OF THE DECISION, NOT OF THE ARM ────────
      //
      // `sampleCombos(range, board, k)` is pure in all three arguments, and all three belong
      // to the decision. Every arm at this node was therefore recomputing a bit-identical
      // array. MEASURED 2026-08-20 on a five-rung engine-free ladder: that recomputation was
      // 99.2% of wall clock, ~74% of it inside `evaluate5` reached through
      // `comboStrengthPercentile`, which enumerates all 1176 opponent combos per hero combo.
      //
      // This memo is per DECISION and keyed by k, so arms built at different combo counts
      // never share a sample. The saving is (arms - 1)/arms of the dominant term and it
      // GROWS with the number of arms — which is the axis a rung ladder extends along.
      //
      // Bit-identity is by construction, not by hope: a memo hit returns the same array the
      // call would have produced, and no consumer mutates a combo (both read only
      // card1/card2/sampleWeight/weight/strength).
      const comboMemo = new Map();
      const combosFor = (k) => {
        if (comboMemo.has(k)) return comboMemo.get(k);
        const range = ctx.rangeBefore;
        const board = ctx.board;
        const built = (!range || !board || board.length < 3)
          ? null
          : timed('comboSample', () => sampleCombos(range, board, k));
        comboMemo.set(k, built);
        return built;
      };

      // ── WS-540 — THE CONTEXT ROW IS BUILT ABOVE THE ARM GATE, DELIBERATELY ──────────
      //
      // It used to sit below it. The gate a few lines down drops a decision for EVERY arm
      // when ANY arm fails, so a set written below it silently excluded exactly the
      // decisions today's rules could not score — measured at 6 of 76 (7.9%) on a real
      // slice. That is the opposite of what the set is for: "an arm authored tomorrow can
      // still be scored against it" fails hardest on the rows today's arms could not handle.
      //
      // The replay gate cannot catch this. It re-scores the SAME rungs, so every row it
      // sees is one they all handled, and it passes green over a biased set. The test that
      // catches it has to assert a FAILING arm's decision still reaches the set.
      //
      // Nothing here reads an arm — the docblock below already said so, which is why this
      // is a move and not a rewrite. Production gates (geometry, outcome, netBB) stay ABOVE
      // it: those decisions have no valid row, and excluding them is correct.
      // WS-540 Phase 0 — the PROSPECTIVE decision-context row, measured but not persisted.
      // This is exactly the payload Phase 1 would write: everything the scoring half reads
      // and nothing an arm produced. `ctx.hand` is the bulk and is measured separately, so
      // a decision about column pruning can be made against a number rather than a guess.
      // WS-540 Phase 1 — the row is now built by `buildDecisionContext`, the SAME function
      // the writer uses. It used to be an object literal here, which meant the size this
      // probe measured and the payload Phase 1 would eventually write were free to diverge
      // silently — and the 730 MB sizing decision was taken against this measurement.
      const contextRow = (captureContext || contextsBuilt % CONTEXT_BYTES_SAMPLE_EVERY === 0)
        ? buildDecisionContext({
          stable: { p: playerIndex, k: checkpointIndex, d: decisionOrdinal },
          playerId: playerKey,
          handId: ctx.handId,
          order: ctx.order,
          hand: ctx.hand,
          holding: ctx.holding ?? null,
          board: ctx.board ?? null,
          handIdx: ctx.handIdx ?? null,
          street: ctx.street,
          heroSeat: ctx.playerSeat,
          buttonSeat: ctx.buttonSeat ?? null,
          opponentSeat: ctx.opponentSeat ?? null,
          facingAction: ctx.facingAction,
          isAgg: ctx.isAgg,
          isIP: ctx.isIP,
          texture: ctx.texture,
          posCategory: ctx.posCategory,
          situationKey: ctx.situationKey ?? null,
          contextAction: ctx.contextAction ?? null,
          rangeEquityPct: ctx.rangeEquityPct ?? null,
          segmentation: ctx.segmentation ?? null,
          observedAction: ctx.action,
          observedAmount: ctx.amount ?? null,
          geometry,
          sizeBucket,
          netBB,
          netBBUnraked,
          wentToShowdown: raked.wentToShowdown,
          pool: { actions: pool.actions, evidenceN: pool.evidenceN },
          decisionSeed,
          playersInPot: liveOpponentCount(ctx.hand, ctx.order, ctx.playerSeat) + 1,
        })
        : null;

      if (contextRow && contextsBuilt % CONTEXT_BYTES_SAMPLE_EVERY === 0) {
        try {
          const handBytes = Buffer.byteLength(JSON.stringify(ctx.hand ?? null), 'utf8');
          timings.bytes.samples += 1;
          timings.bytes.contextTotal += Buffer.byteLength(JSON.stringify(contextRow), 'utf8');
          timings.bytes.handTotal += handBytes;
        } catch { /* a size probe must never be able to kill a scoring pass */ }
      }

      // WS-540 Phase 1 — retained on the fragment for the same reason `records` is
      // (heroEvTask's `--resume` note): a wave seeded from a chunk must be able to replay
      // its context rows into the sink, or a resumed run silently writes a SHORT set — and
      // a short set scores fewer decisions and reports a smaller edge without erroring.
      // Retained on the fragment ONLY. The orchestrator emits these at the wave boundary in
      // canonical `playerIndex` order — see `persistWave`. Streaming them from here would
      // hand the sink task-completion order, which silently moves every bootstrap figure.
      if (contextRow) contexts.push(contextRow);
      contextsBuilt += 1;

      // ONE ENGINE PASS PER ARM, and a decision survives only if EVERY arm produced a
      // policy — a skip pattern that correlates with depth must not enter the contrast.
      const byArm = {};
      let armFailure = null;
      for (const arm of engineArms) {
        const armOrdinal = armOrdinalById.get(arm.id);
        // eslint-disable-next-line no-await-in-loop -- the engine call is the cost; arms are 1-2
        const res = await timedAsync('engineArms', () => heroPolicyAt({
          ctx, hand: ctx.hand, rakeConfig, comboSamples, trials,
          refinementBudgetMs: arm.refinementBudgetMs,
          captureComboDetail: captureRecord,
          equitySeedFor: decisionSeed === null
            ? null
            : (comboIndex) => seedForCombo(decisionSeed, armOrdinal, comboIndex),
          villainFeed, villainSource,
          // WS-540 — the engine arm reads the same shared sample. Its own comboSamples is
          // the run-level one, which is the k this memo is keyed on for engine arms.
          combos: combosFor(comboSamples),
        }));
        counters.engineErrors += res.engineErrors ?? 0;
        if (!res.ok) { armFailure = { arm: arm.id, reason: res.reason }; break; }
        byArm[arm.id] = res;
      }
      // Strategy arms AFTER engine arms so a fallback has its source. Pure functions of
      // the decision: no engine call, no clock, no RNG.
      if (!armFailure) {
        // ── COVERAGE COUNTS ONLY DECISIONS THAT SURVIVE ─────────────────────────────────
        // Found 2026-08-21 by WS-540's replay gate, which is the only thing that could have
        // found it: it scored the same rungs over the same decisions and its coverage block
        // disagreed with this one.
        //
        // `strategyPolicyAt` does `coverage.n++` as its FIRST statement, and this loop
        // `break`s on the first arm that fails — dropping the decision from the contrast
        // entirely. So arms scored BEFORE the failure kept a denominator entry for a
        // decision no arm was ultimately judged on. MEASURED on a 1,498-decision slice:
        // r0 read n=1638 while r1..r4 read n=1498, all five having covered the same 1,470.
        // `coveredShare` therefore printed 89.7% for r0 beside 98.1% for the others — an
        // 8.4-point difference between rungs that covered IDENTICALLY, produced entirely by
        // which arm happens to be first in the loop.
        //
        // That is not cosmetic. The ladder prints these rung-beside-rung as comparable, and
        // WS-536 makes `coveredShare` load-bearing precisely because an arm covering less
        // has an edge diluted by construction — so a spurious 8 points reads as a real
        // property of the rung.
        //
        // Scoring into per-decision accumulators and merging only on survival makes the
        // denominator the same set for every arm, by construction rather than by luck of
        // ordering. `mergeCoverage` is the existing fragment-merge path, reused.
        const pending = Object.fromEntries(strategyArms.map((a) => [a.id, newCoverage()]));
        for (const arm of strategyArms) {
          const res = timed('strategyArms', () => strategyPolicyAt({
            arm, ctx, hand: ctx.hand, geo: geometry,
            engineActions: byArm[arm.fallbackArmId]?.actions ?? null,
            poolActions: pool.actions ?? null,
            coverage: pending[arm.id],
            combosFor,
          }));
          if (!res.ok) { armFailure = { arm: arm.id, reason: res.reason }; break; }
          byArm[arm.id] = res;
        }
        if (!armFailure) {
          for (const arm of strategyArms) mergeCoverage(coverageByArm[arm.id], pending[arm.id]);
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
      const pbr = timed('pbr', () => poolBestResponseAt(pbrArgs));
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
        piPbrBySweep: pbr.ok ? timed('pbr', () => poolBestResponseSweep(pbrArgs)) : null,
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
        const record = timed('recordBuild', () => ({
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
        }));
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

  // ── WS-540 — THE INVARIANT THAT CATCHES THE BUG THIS BLOCK WAS WRITTEN FOR ─────────────
  //
  // A capturing run builds one context row per decision that clears the PRODUCTION gates,
  // and the arm gate drops a further 8-10% of those (measured: 6/76 and 30/296 on real
  // slices). So `contexts` must come out STRICTLY LONGER than `decisions` whenever any arm
  // failed, and never shorter. If the context build ever drifts back below the arm gate,
  // the two go equal and the set silently loses exactly the decisions today's rules cannot
  // score — which is the population an arm authored tomorrow most needs.
  //
  // This fires at the moment of the error. The replay gate structurally cannot: it
  // re-scores the SAME arms, so every row it sees is one they all handled, and it passes
  // green over a biased set.
  if (captureContext && contexts.length < decisions.length) {
    throw new Error(
      `heroEvTask: context set is SHORT for player ${playerKey} — ${contexts.length} rows for `
      + `${decisions.length} scored decisions. A context row is built once per decision that `
      + 'clears the production gates, so it can never be rarer than a scored decision. This '
      + 'means the build moved below the arm gate and the set is now conditioned on the arms '
      + 'that produced it. Refusing rather than writing a set whose bias nothing downstream '
      + 'can detect.',
    );
  }

  return {
    playerIndex,
    playerKey,
    playerId,
    decisions,
    ...(captureRecord ? { records } : {}),
    ...(captureContext ? { contexts } : {}),
    counters,
    ledger,
    coverageByArm,
    // WS-540 Phase 0 — per-phase cost, summed per player and merged by the orchestrator.
    // Carried on the fragment (not a side channel) so the pool gets it for free: a worker's
    // timings cannot be read across the thread boundary any other way.
    timings,
    contributed: decisions.length > 0,
    // Mirror of the guard's assertWalkForward counter for this player, so a parallel run
    // can synthesize the run-level integrity summary from fragments (each worker holds
    // its own guard; their counters cannot be read across threads).
    walkForwardChecked,
  };
};
