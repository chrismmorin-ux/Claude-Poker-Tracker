/**
 * heroEvEnumeration.mjs — the stable work index the hero-EV pass never had (WS-433).
 *
 * WHY THIS EXISTS. The runner used to iterate `byPlayer` in corpus-file order, which has
 * three consequences the enumeration removes:
 *
 *   1. No seed can derive from position, because position is an accident of file order —
 *      so nothing in the pass could be seeded at all (`HERO_EV_UNSEEDED_SOURCES`).
 *   2. `estimateEdge` builds its cluster map by first-appearance order in `decisions`, and
 *      `clusterBootstrapCI` indexes that order with a fixed-seed LCG — so the CONFIDENCE
 *      INTERVAL silently depended on iteration order (`ipsEstimator.mjs:165,174,225`).
 *   3. A chunked or resumed run had no way to guarantee "a chunk boundary changes no input
 *      to any cell" — the invariant `mergeEntryMap.mjs` documents and enforces for the
 *      entry map, transferred here.
 *
 * THE ORDER IS LEXICOGRAPHIC ORDINAL on the player key (raw code-unit `<`, never
 * `localeCompare` — locale rules change between machines and Node builds; byte order does
 * not). Position in this order is `playerIndex`, and every seed in the pass derives from
 * it — same doctrine as `entryEvaluator.seedFor` ("a cell evaluated as the 3rd item of
 * chunk 4 gets exactly the seeds it would have got as the 1,437th item of a single pass").
 *
 * QUALIFICATION IS ≥ minTrainHands + 1, not ≥ minTrainHands. The checkpoint loop starts at
 * `cp = minTrainHands` and requires a non-empty test window (`hands.slice(cp, …)`), so a
 * player with exactly `minTrainHands` hands yields ZERO windows. The old runner admitted
 * such players, counted them in `evalPlayers`, and silently produced nothing — which is
 * why the qualifying count the WS-433 accept criteria demand had never been shown.
 */

import { createHash } from 'node:crypto';

/**
 * 32-bit avalanche mix (same family as gameTreeSampling.boardDerivedRng). Not a stream —
 * a combiner: fold successive coordinates into a well-scrambled 32-bit seed.
 */
const mix = (h, v) => {
  const x = (h ^ ((v + 0x9e3779b9 + ((h << 6) >>> 0) + (h >>> 2)) >>> 0)) >>> 0;
  return (Math.imul(x, 0x27d4eb2f) >>> 0);
};

/**
 * Seed for one decision, derived ONLY from stable coordinates:
 *   playerIndex     - position in the canonical enumeration (the FULL one, never the shard)
 *   checkpointIndex - k in cp = minTrainHands + k * checkpointInterval (0-based)
 *   decisionOrdinal - the ctx's index in the checkpoint's emitted ctxs array, counted over
 *                     ALL emitted ctxs INCLUDING ones later skipped for geometry/outcome.
 *                     A survivors-only ordinal would re-seed everything after a skip.
 *   equitySeed      - the run-level seed (stamped in replicationStamp.seeds.equityMc)
 */
export const seedForDecision = ({ equitySeed, playerIndex, checkpointIndex, decisionOrdinal }) =>
  mix(mix(mix(mix(0x9e3779b9 ^ (equitySeed >>> 0), playerIndex), checkpointIndex), decisionOrdinal), 0x433);

/**
 * Seed for one engine call: one sampled combo of one arm of one decision.
 * `armOrdinal` is the arm's index in the normalized arms array; `comboIndex` is the
 * combo's index in the `sampleCombos` output (itself deterministic — systematic
 * weight-proportional sampling, no RNG).
 */
export const seedForCombo = (decisionSeed, armOrdinal, comboIndex) =>
  mix(mix(decisionSeed >>> 0, armOrdinal), comboIndex);

/**
 * Build the canonical enumeration from an ingested `byPlayer` map.
 *
 * @param {Object} args
 * @param {Map<string, Array>} args.byPlayer - player key -> hand array (from indexEvalPlayers)
 * @param {number} args.minTrainHands
 * @returns {{
 *   players: Array<{playerIndex: number, playerId: string, handCount: number}>,
 *   qualifyingCount: number,
 *   totalPlayers: number,
 *   enumerationHash: string,
 * }}
 */
export const buildEnumeration = ({ byPlayer, minTrainHands }) => {
  const qualifying = [];
  for (const [playerId, hands] of byPlayer) {
    if (hands.length >= minTrainHands + 1) qualifying.push({ playerId, handCount: hands.length });
  }
  // Raw code-unit ordinal sort. Keys are unique (Map keys), so no tiebreak exists.
  qualifying.sort((a, b) => (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));

  const players = qualifying.map((q, playerIndex) => ({ playerIndex, ...q }));

  // Content hash over the ordered identity list. This is what binds a chunk's slice
  // indices to an actual player list: two runs whose corpora differ by one hand of one
  // player produce different hashes, and the merge refuses to blend them.
  const h = createHash('sha256');
  for (const p of players) h.update(`${p.playerId}:${p.handCount}\n`);

  return {
    players,
    qualifyingCount: players.length,
    totalPlayers: byPlayer.size,
    enumerationHash: `sha256:${h.digest('hex')}`,
  };
};
