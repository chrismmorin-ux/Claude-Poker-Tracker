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
import { decisionGeometry, sizeBucketFor } from './decisionGeometry.mjs';

const USER_ID = 'backtest';

/**
 * Mine the behaviour policy from POOL players.
 *
 * @returns {Promise<Object>} stamped policy table
 */
export const minePolicyObservations = async ({
  files,
  poolPct = 50,
  maxPlayers = Infinity,
  maxHandsPerPlayer = Infinity,
  stakes = ['*'],
  log = () => {},
}) => {
  const { byPlayer, handsRead } = await indexEvalPlayers({
    files,
    poolPct,
    maxPlayers,
    maxHandsPerPlayer,
    group: GROUPS.POOL,          // <- the opposite half from the scored set
    onProgress: ({ handsRead: h, players }) => log(`read ${h} hands, ${players} pool players`),
  });
  log(`indexed ${byPlayer.size} POOL players from ${handsRead} hands`);

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
          });
        },
      });
    } catch {
      accumulateFailures++;
    }
  }

  log(`collected ${observations.length} pool decisions`);

  const table = buildPolicyTable(observations, {
    poolPct,
    players: byPlayer.size,
    handsRead,
    stakes,
    profileFailures,
    accumulateFailures,
    geometryFailures,
  });

  // Sanity: the hierarchy the table was built with must be the one queries will use.
  if (table.provenance.hierarchy.join() !== POLICY_HIERARCHY.join()) {
    throw new Error('behaviour-policy hierarchy mismatch between build and query');
  }
  return table;
};
