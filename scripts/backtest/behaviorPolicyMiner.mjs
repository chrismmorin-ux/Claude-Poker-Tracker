/**
 * behaviorPolicyMiner.mjs — the POOL-side pass that produces pi_pool.
 *
 * Loaded through the Vite SSR loader (it imports `src/`), so its CLI wrapper
 * `mine-behavior-policy.mjs` stays plain Node. Same two-tier arrangement as
 * run.mjs / runner.mjs.
 *
 * The observations come from the SAME derivation the app uses — `accumulateDecisions`
 * and its `onDecision` seam — rather than a second walk over the action sequence. A
 * reimplementation here would produce propensities keyed by a context the engine never
 * sees, and the importance weights would then be dividing two different things.
 */

import { buildRangeProfile } from '../../src/utils/rangeEngine/index.js';
import { accumulateDecisions } from '../../src/utils/exploitEngine/decisionAccumulator.js';
import { GROUPS } from './partition.mjs';
import { indexEvalPlayers } from './runner.mjs';
import { buildPolicyTable, POLICY_HIERARCHY } from './behaviorPolicy.mjs';
import {
  decisionGeometry, sizeBucketFor, sprFor, sprBandFor, closesAction,
} from './decisionGeometry.mjs';

const USER_ID = 'backtest';

/**
 * Mine the behaviour policy from POOL players.
 *
 * @returns {Promise<Object>} stamped policy table
 */
/**
 * Collect raw observations for one partition half.
 *
 * Extracted from `minePolicyObservations` (WS-333) so the geometry ablation can mine the
 * EVAL half with the IDENTICAL derivation it mines the POOL half with. Scoring an ablation
 * on decisions derived a second way would compare ladders AND derivations at once, and only
 * one of those is the question.
 */
export const collectObservations = async ({
  files,
  poolPct = 50,
  maxPlayers = Infinity,
  maxHandsPerPlayer = Infinity,
  group = GROUPS.POOL,
  log = () => {},
}) => {
  const collected = await minePolicyObservations({
    files, poolPct, maxPlayers, maxHandsPerPlayer, group, log, rawObservations: true,
  });
  return collected;
};

export const minePolicyObservations = async ({
  files,
  poolPct = 50,
  maxPlayers = Infinity,
  maxHandsPerPlayer = Infinity,
  stakes = ['*'],
  group = GROUPS.POOL,
  rawObservations = false,
  hierarchy = POLICY_HIERARCHY,
  log = () => {},
}) => {
  const { byPlayer, handsRead } = await indexEvalPlayers({
    files,
    poolPct,
    maxPlayers,
    maxHandsPerPlayer,
    group,                        // POOL by default — the opposite half from the scored set
    onProgress: ({ handsRead: h, players }) => log(`read ${h} hands, ${players} ${group} players`),
  });
  // Name the half actually mined — this said "POOL" unconditionally until WS-333 made the
  // group a parameter, which would have made an EVAL pass look like a duplicate POOL pass.
  log(`indexed ${byPlayer.size} ${group} players from ${handsRead} hands`);

  const observations = [];
  let profileFailures = 0;
  let accumulateFailures = 0;
  let geometryFailures = 0;

  for (const [playerId, hands] of byPlayer) {
    let profile;
    try {
      profile = buildRangeProfile(playerId, hands, USER_ID);
    } catch {
      profileFailures++;
      continue;
    }
    if (!profile) { profileFailures++; continue; }

    try {
      accumulateDecisions(playerId, hands, profile, USER_ID, {
        onDecision: (ctx) => {
          const geo = decisionGeometry(ctx.hand, ctx.order, ctx.street);
          if (!geo) { geometryFailures++; return; }
          observations.push({
            facingAction: ctx.facingAction,
            action: ctx.action,
            isAgg: ctx.isAgg,
            isIP: ctx.isIP,
            texture: ctx.texture,
            street: ctx.street,
            posCategory: ctx.posCategory,
            sizeBucket: sizeBucketFor(geo.facingBetBB, geo.potBB),
            // WS-333 geometry coordinates. Always mined, so a table built under any
            // hierarchy can be compared against one built under another WITHOUT re-mining
            // the corpus — the ablation is then a comparison of ladders over one
            // observation set, not of two different observation sets.
            sprBand: sprBandFor(sprFor(geo)),
            closesAction: String(closesAction(ctx.hand, ctx.order, ctx.street, ctx.playerSeat)),
          });
        },
      });
    } catch {
      accumulateFailures++;
    }
  }

  log(`collected ${observations.length} ${group} decisions`);

  // The ablation wants the observations themselves, so it can build several ladders over ONE
  // observation set rather than re-mining the corpus per arm.
  if (rawObservations) return observations;

  const table = buildPolicyTable(observations, {
    poolPct,
    players: byPlayer.size,
    handsRead,
    stakes,
    profileFailures,
    accumulateFailures,
    geometryFailures,
    // ─────────────────────────────────────────────────────────────────────────────────────
    // POPULATION IDENTITY AND HOLD-OUT, STAMPED AT THE SOURCE (WS-632)
    // ─────────────────────────────────────────────────────────────────────────────────────
    //
    // These three fields exist because a consumer must be able to answer "whose field is this"
    // and "could it contain the thing I am scoring" FROM THE ARTIFACT, without knowing which
    // miner produced it. Before WS-632 a corpus table carried neither, so `reviewSession`
    // refused it for an unverifiable hold-out — and when it was hand-stamped to get past that
    // gate, the review labelled a 2009 online table `measured-on-this-field` and priced a 2026
    // live session against it. Leakage-freedom and population-identity are DIFFERENT FACTS and
    // the absence of one must never be read as evidence of the other.
    source: 'handhq-corpus',
    population:
      `HandHQ datamined online cash hands, ${stakes.join('/')} — a 2009 ONLINE pool. This is a `
      + 'distinct population from the founder\'s live/Ignition game. Any level taken from here '
      + 'and reported about his table is TRANSFERRED, NOT MEASURED '
      + '(.claude/rules/corpus-transfer-is-earned.md).',
    // Verified-empty, not unexamined. A 2009 datamined corpus cannot contain a session the
    // founder played in 2026, so the hold-out is satisfied BY CONSTRUCTION rather than by
    // exclusion — and saying so explicitly is what lets the consumer verify it instead of
    // defaulting. `observed-zero` and `unexamined` stay distinct here as everywhere.
    contributingSessions: [],
    contributingSessionsBasis:
      'observed-zero by construction: this table is mined from third-party datamined 2009 '
      + 'online history, which contains no founder session.',
  }, { hierarchy });

  // Sanity: the hierarchy the table was built with must be the one queries will use.
  if (table.provenance.hierarchy.join() !== hierarchy.join()) {
    throw new Error('behaviour-policy hierarchy mismatch between build and query');
  }
  return table;
};
