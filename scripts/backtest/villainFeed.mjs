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
});

export const ALL_VILLAIN_SOURCES = Object.values(VILLAIN_SOURCES);

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
  log = () => {},
}) => {
  const { byPlayer, handsRead } = await indexEvalPlayers({
    files, poolPct, maxPlayers: maxVillains, maxHandsPerPlayer: maxHandsPerVillain,
    group: GROUPS.POOL,
    onProgress: ({ handsRead: h, players }) => log(`  ${h} hands read, ${players} pool villains`),
  });

  const players = {};
  let built = 0;
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
    built++;
  }

  log(`villain feed: ${built} POOL villains from ${handsRead} hands read.`);
  return {
    schemaVersion: VILLAIN_FEED_SCHEMA_VERSION,
    builtFrom: {
      group: 'POOL',
      poolPct,
      maxHandsPerVillain,
      files: files.length,
      referenceTier: referenceTable ? 'stamped-table' : 'founder-estimate',
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
  return { ...entry, style: null };
};
