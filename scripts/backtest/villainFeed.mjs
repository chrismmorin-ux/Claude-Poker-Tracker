/**
 * villainFeed.mjs — the styled-villain feed (WS-436 stage B2).
 *
 * WHY THIS EXISTS. Every hero-EV instrument fed `{vpip:null, pfr:null, af:null,
 * style:null}` villains for the life of the harness (heroPolicy.mjs:203-207,
 * deliberate v1 scope), so the label channel WS-436 removed was structurally
 * unmeasurable on the advice path: no arm could differ on a field no villain
 * carried. This module builds per-villain stats the injection point can serve,
 * which is what makes the before/after advice comparison an experiment instead
 * of an assumption.
 *
 * PARTITION DISCIPLINE — POOL players only, structurally. The feed is built with
 * `indexEvalPlayers({ group: GROUPS.POOL })` — the same "same partition function,
 * opposite side" seam WS-287 added for the behavior policy — so an EVAL villain
 * simply has no entry and resolves to the population fallback. Stats for a
 * player the harness scores never enter another player's scoring, and the
 * leave-one-out guard (`excludePlayerId`) keeps each villain out of its own
 * resolved priors, exactly as the runner does.
 *
 * ORACLE-PREFIX SEMANTICS, stated rather than hidden. A villain's stats come
 * from their first `maxHandsPerVillain` corpus hands as ONE fixed snapshot —
 * richer than what a live opponent would have revealed at any single decision,
 * and potentially including the scored hand itself when it falls inside the
 * prefix. The self-inclusion is bounded exactly like the hierarchical
 * estimators' (one hand among n under a capped-pseudocount posterior moves the
 * mean by < 1/(n + W)), and — decisive for WS-436's question — EVERY arm of a
 * paired run shares the identical feed, so arm CONTRASTS (styled vs stats vs
 * null) subtract the snapshot semantics out entirely. Level claims from a
 * single arm inherit the caveat; channel claims from paired arms do not.
 *
 * NO MINIMUM-HANDS GATE, deliberately. A thin villain's shrunk posteriors sit
 * near their prior means, which IS the population fallback — the posterior
 * self-weights (POKER_THEORY §11.4/§11.5: a minimum-N gate is a threshold label
 * in another costume).
 *
 * The artifact is plain JSON (like `out/behavior-policy.json`) so it crosses
 * worker boundaries by value and stamps its own provenance.
 */

import { GROUPS, DEFAULT_POOL_PCT } from './partition.mjs';
import { indexEvalPlayers, segmentFor } from './runner.mjs';
import {
  buildPlayerStats,
  derivePercentages,
  classifyStyle,
} from '../../src/utils/tendencyCalculations.js';
import { resolveStatPriors } from '../../src/utils/exploitEngine/poolBaseline.js';
import { buildRangeProfile } from '../../src/utils/rangeEngine/index.js';
import { accumulateDecisions } from '../../src/utils/exploitEngine/decisionAccumulator.js';
import { buildVillainDecisionModel } from '../../src/utils/exploitEngine/villainDecisionModel.js';

/**
 * `_buckets` is ~89% of a serialized villain model and is the only field that has to go.
 *
 * Measured on POOL villains (`probe-villainmodel-size.mjs`): the whole model averages
 * 19,751 bytes each — 96 MB at 5,000 villains, which a JSON artifact crossing worker
 * boundaries by value cannot carry — and 2,349 bytes with `_buckets` dropped.
 *
 * WHAT THAT LEAVES UNCOVERED, named rather than implied. `queryActionDistribution` reads
 * `_buckets`, so a fed villain's SITUATIONAL action distribution still resolves to the
 * population ladder. What the feed does carry is `personalizedFoldCurve`, `foldEstimates`
 * and `personalizedMultipliers` — which is the channel FIND-138 blocked and the one WS-481
 * needed. A future ticket wanting the bucket channel measured needs a different transport,
 * not a bigger cap.
 */
const stripBuckets = (model) => {
  if (!model) return null;
  const { _buckets, ...rest } = model;
  return rest;
};

export const VILLAIN_FEED_SCHEMA_VERSION = 1;

/** The villain sources a consumer may request. */
export const VILLAIN_SOURCES = Object.freeze({
  /** Legacy null-stats villain — byte-identical to the pre-B2 harness. */
  NULL: 'null',
  /** Per-villain shrunk posteriors + aggregate stats; the style label STRIPPED. */
  STATS: 'stats',
  /** Same stats WITH the classifyStyle label attached. On any engine where the
   *  label has a live channel the two arms diverge; on the post-WS-436 engine
   *  they must be byte-identical (falsifier #1 of the removal). */
  STYLED: 'styled',
  /** The quantization-cost arms (ws436-baseline.md §4d #2): the WHOLE fed
   *  representation snapped to 3 / 5 per-stat quantile bins — what the engine
   *  would know if a human head carried the read. Bin edges are quantiles of
   *  the feed's own players (data-derived), representatives are bin-median
   *  quantiles; the derived observed-foldToCbet hint is snapped too, so no
   *  continuous value leaks around the bins. */
  STATS_BIN3: 'stats-bin3',
  STATS_BIN5: 'stats-bin5',
  /** FIND-138. The stats arm PLUS the villain's own decision model, so the engine
   *  receives a non-null `villainModel` — the channel `personalizedFoldCurve` and the
   *  per-villain fold LEVELS travel on. Requires a feed built with
   *  `withDecisionModel: true`; without one it degrades to STATS rather than
   *  silently pretending, and `resolveVillainModel` returns null. */
  MODEL: 'model',
});

export const ALL_VILLAIN_SOURCES = Object.values(VILLAIN_SOURCES);

// ── quantization machinery ────────────────────────────────────────────────────

const BINNED_SHRUNK_FIELDS = ['vpip', 'pfr', 'threeBet', 'cbet', 'foldToCbet', 'foldTo3Bet', 'aggFreq'];

const quantile = (sorted, q) => {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx];
};

/**
 * Per-stat bin edges + representatives from the feed's own player distribution.
 * For k bins: edges at i/k quantiles, representative = the (2i+1)/(2k) quantile
 * (the bin's median member), so a snapped value is a real, typical value of the
 * bin rather than an arithmetic midpoint of possibly-skewed edges.
 */
export const computeFeedBins = (feed, k) => {
  const bins = {};
  for (const f of BINNED_SHRUNK_FIELDS) {
    const vals = Object.values(feed.players)
      .map(p => p.shrunk?.[f])
      .filter(v => Number.isFinite(v))
      .sort((a, b) => a - b);
    const edges = [];
    const reps = [];
    for (let i = 1; i < k; i++) edges.push(quantile(vals, i / k));
    for (let i = 0; i < k; i++) reps.push(quantile(vals, (2 * i + 1) / (2 * k)));
    bins[f] = { edges, reps };
  }
  return bins;
};

// One bins table per (feed instance, k) — a pure function of the artifact,
// computed lazily so existing feed files need no rebuild.
const binsCache = new WeakMap();
const feedBins = (feed, k) => {
  let byK = binsCache.get(feed);
  if (!byK) { byK = new Map(); binsCache.set(feed, byK); }
  if (!byK.has(k)) byK.set(k, computeFeedBins(feed, k));
  return byK.get(k);
};

const snap = (v, { edges, reps }) => {
  if (!Number.isFinite(v)) return v;
  let i = 0;
  while (i < edges.length && v > edges[i]) i++;
  return reps[i];
};

/** The entry with its ENTIRE representation at bin resolution (see VILLAIN_SOURCES). */
const quantizeEntry = (entry, bins) => {
  const shrunk = {};
  for (const f of BINNED_SHRUNK_FIELDS) {
    shrunk[f] = bins[f] ? snap(entry.shrunk?.[f], bins[f]) : entry.shrunk?.[f];
  }
  // Top-level percents follow their shrunk fields; the observed foldToCbet hint
  // is re-derived from adjusted raw counts at the SAME n so the engine's
  // evidence-weighting is untouched — only the VALUE is bin-resolution.
  const facedCbet = entry.rawStats?.facedCbet || 0;
  return {
    ...entry,
    style: null,
    vpip: Math.round(shrunk.vpip * 100),
    pfr: Math.round(shrunk.pfr * 100),
    threeBet: Math.round(shrunk.threeBet * 100),
    foldTo3Bet: Math.round(shrunk.foldTo3Bet * 100),
    shrunk,
    rawStats: {
      ...entry.rawStats,
      foldedToCbet: Math.round(facedCbet * shrunk.foldToCbet),
    },
  };
};

/**
 * Build the feed from POOL players' hands.
 *
 * @param {Object} args
 * @param {Array}  args.files - corpus files [{ path, site, stakeLabel }]
 * @param {Object|null} args.referenceTable - stamped POOL reference table (the
 *   guard-validated one) for §6.5a prior resolution; null → founder estimate tier
 * @param {number} [args.poolPct]
 * @param {number} [args.maxVillains]
 * @param {number} [args.maxHandsPerVillain] - the oracle-prefix cap (see header)
 * @param {Function} [args.log]
 * @returns {Promise<Object>} the feed artifact (JSON-serializable)
 */
export const buildVillainFeed = async ({
  files,
  referenceTable = null,
  poolPct = DEFAULT_POOL_PCT,
  maxVillains = Infinity,
  maxHandsPerVillain = 200,
  // FIND-138. Off by default so every existing feed and caller stays byte-identical; the
  // per-villain range profile + decision accumulation this turns on is the expensive part
  // of the build, and only the MODEL source consumes it.
  withDecisionModel = false,
  log = () => {},
}) => {
  const { byPlayer, handsRead } = await indexEvalPlayers({
    files, poolPct, maxPlayers: maxVillains, maxHandsPerPlayer: maxHandsPerVillain,
    group: GROUPS.POOL,
    onProgress: ({ handsRead: h, players }) => log(`  ${h} hands read, ${players} pool villains`),
  });

  const players = {};
  let built = 0;
  let withCurve = 0;
  for (const [pid, hands] of byPlayer) {
    const stats = buildPlayerStats(pid, hands);
    const { segmentKey, seatBucket } = segmentFor(hands);
    const statPriors = resolveStatPriors({
      segmentKey,
      seatBucket,
      referenceTable,
      excludePlayerId: pid,
      poolIndex: null,
    });
    const pct = derivePercentages(stats, statPriors);
    players[pid] = {
      vpip: pct.vpip,
      pfr: pct.pfr,
      af: pct.af,
      threeBet: pct.threeBet ?? null,
      foldTo3Bet: pct.foldTo3Bet ?? null,
      style: classifyStyle(pct),
      shrunk: pct.shrunk ?? null,
      rawStats: {
        pfAggressorFlops: stats.pfAggressorFlops || 0,
        cbetCount: stats.cbetCount || 0,
        facedCbet: stats.facedCbet || 0,
        foldedToCbet: stats.foldedToCbet || 0,
        facedRaisePreflop: stats.facedRaisePreflop || 0,
        threeBetCount: stats.threeBetCount || 0,
      },
      handCount: hands.length,
    };

    if (withDecisionModel) {
      // The villain's own model, from the villain's own hands, built through the SAME
      // production derivation the app uses — a reimplementation here would model a villain
      // the engine never sees. Failures are non-fatal and leave `decisionModel` null, which
      // resolves to the population fallback exactly as a missing entry does.
      try {
        const profile = buildRangeProfile(pid, hands, 'villainfeed');
        const summary = accumulateDecisions(pid, hands, profile, 'villainfeed');
        players[pid].decisionModel = stripBuckets(buildVillainDecisionModel(summary, pct));
        if (players[pid].decisionModel?.personalizedFoldCurve) withCurve++;
      } catch {
        players[pid].decisionModel = null;
      }
    }
    built++;
  }

  log(`villain feed: ${built} POOL villains from ${handsRead} hands read.`);
  if (withDecisionModel) {
    log(`  decision models: ${withCurve}/${built} carry a fitted personalizedFoldCurve.`);
  }
  return {
    schemaVersion: VILLAIN_FEED_SCHEMA_VERSION,
    builtFrom: {
      group: 'POOL',
      poolPct,
      maxHandsPerVillain,
      files: files.length,
      referenceTier: referenceTable ? 'stamped-table' : 'founder-estimate',
      withDecisionModel,
      // Stamped so a consumer can tell a model-bearing feed from a stats-only one, and so
      // the omission is a property of the artifact rather than folklore (FIND-138).
      decisionModelOmits: withDecisionModel ? ['_buckets'] : null,
      villainsWithFittedFoldCurve: withDecisionModel ? withCurve : null,
    },
    players,
  };
};

/**
 * Resolve one villain from the feed under a source setting.
 *
 * Returns `null` whenever the legacy null-stats villain should be used — the
 * 'null' source, a missing feed, or a villain with no entry (EVAL players by
 * construction, plus POOL players beyond the build caps). The caller keeps its
 * legacy construction on the null path so absent-feed runs stay byte-identical.
 *
 * @param {Object|null} feed - the artifact from buildVillainFeed (or parsed JSON)
 * @param {string|null} pid - `hand.seatPlayers[ctx.opponentSeat]`
 * @param {string} source - one of VILLAIN_SOURCES
 * @returns {Object|null} villainData for liveGameContext.buildPlayerStats
 */
export const resolveVillain = (feed, pid, source = VILLAIN_SOURCES.NULL) => {
  if (!ALL_VILLAIN_SOURCES.includes(source)) {
    throw new Error(`Unknown villain source "${source}". Expected ${ALL_VILLAIN_SOURCES.join(' | ')}.`);
  }
  if (source === VILLAIN_SOURCES.NULL) return null;
  const entry = pid != null ? feed?.players?.[pid] : null;
  if (!entry) return null;
  if (source === VILLAIN_SOURCES.STYLED) return entry;
  if (source === VILLAIN_SOURCES.STATS_BIN3) return quantizeEntry(entry, feedBins(feed, 3));
  if (source === VILLAIN_SOURCES.STATS_BIN5) return quantizeEntry(entry, feedBins(feed, 5));
  // MODEL serves the same stats as STATS; the model travels separately via
  // `resolveVillainModel`, so this function's contract (villainData for
  // buildPlayerStats) is unchanged and its existing callers need no edit.
  return { ...entry, style: null };
};

/**
 * The villain's decision model, or null when one should not be served (FIND-138).
 *
 * Null on: any source but MODEL, a missing feed or entry, or a feed built without
 * `withDecisionModel`. Null is the legacy path — the engine falls back to population — so a
 * consumer that forgets to build a model-bearing feed gets the OLD behaviour rather than a
 * half-populated one.
 *
 * The model carries no `_buckets` (see `stripBuckets`): `personalizedFoldCurve` and the fold
 * LEVELS are live, `queryActionDistribution` is not.
 */
export const resolveVillainModel = (feed, pid, source = VILLAIN_SOURCES.NULL) => {
  if (source !== VILLAIN_SOURCES.MODEL) return null;
  const entry = pid != null ? feed?.players?.[pid] : null;
  return entry?.decisionModel ?? null;
};
