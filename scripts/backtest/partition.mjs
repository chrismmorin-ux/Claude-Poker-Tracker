/**
 * partition.mjs — WS-273 deterministic player partition for the backtest harness.
 *
 * THE LEAKAGE PROBLEM THIS SOLVES
 *
 * The shipped Reference-tier table (`handhqReferencePool.js`, SRC-011) was mined
 * from ALL 12.9M HandHQ hands. Every corpus hand therefore already trained the
 * priors the engine ships with. Scoring the engine on any corpus hand measures
 * memorisation, not accuracy — which is exactly the falsely-good number WS-273
 * exists to prevent.
 *
 * The fix (founder-approved 2026-07-26) is a TWO-LEVEL split:
 *
 *   POOL group (A)  → re-mined into a backtest-only reference table. Never scored.
 *   EVAL group (B)  → scored. Its players never contributed to the priors above.
 *
 * Within an EVAL player, the per-villain model additionally walks FORWARD in time
 * (train on hands 1..N, predict N+1..N+10) — that second guard lives in the runner.
 *
 * WHY BY PLAYER AND NOT BY HAND: the villain decision model is personalised per
 * player. A hand-level split would let a player's later hands train a model that
 * then predicts their earlier ones — an ordering that never occurs at the table
 * and which would flatter every number.
 *
 * WHY THIS FILE IS MIRRORED IN PYTHON: the Python miner must select exactly the
 * same POOL players when it builds the train-only table, or the guarantee is void.
 * `partition.py` is a byte-for-byte behavioural mirror; `partition.test.js` and
 * `partition_check.py` both assert against the SAME fixture vector file, so the
 * two implementations cannot silently drift apart.
 *
 * PARTITION UNIT IS THE PLAYER ROW, NOT THE HAND. A single corpus hand routinely
 * contains both POOL and EVAL players. That is fine and requires no special
 * handling: the six Reference-tier stats are all per-player tallies, so mining
 * only the POOL players' rows out of a mixed hand yields a clean POOL-only table.
 */

/** Partition group labels. */
export const GROUPS = {
  POOL: 'pool',
  EVAL: 'eval',
};

/** Default share of players routed to POOL, as a percentage. */
export const DEFAULT_POOL_PCT = 50;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const encoder = new TextEncoder();

/**
 * FNV-1a, 32-bit, over the UTF-8 bytes of `str`.
 *
 * Chosen over a cryptographic hash because it is trivially reimplementable in
 * Python with identical results — the mirroring requirement outranks avalanche
 * quality here, and FNV-1a's distribution is far better than this use needs.
 *
 * `Math.imul` performs the 32-bit multiply with correct overflow semantics;
 * plain `*` would lose precision above 2^53.
 *
 * @param {string} str
 * @returns {number} unsigned 32-bit hash
 */
export const fnv1a32 = (str) => {
  const bytes = encoder.encode(str);
  let h = FNV_OFFSET_BASIS;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
};

/**
 * Assign a player pseudonym to a partition group.
 *
 * Stable across runs, machines, and languages: the same pseudonym always lands
 * in the same group, so a backtest is reproducible and the miner and the runner
 * agree without sharing state.
 *
 * @param {string} playerId - HandHQ pseudonym (stable per player across the corpus)
 * @param {number} [poolPct=DEFAULT_POOL_PCT] - percentage routed to POOL (0-100)
 * @returns {string} GROUPS.POOL | GROUPS.EVAL
 */
export const partitionOf = (playerId, poolPct = DEFAULT_POOL_PCT) => {
  if (typeof playerId !== 'string' || playerId.length === 0) {
    throw new Error('partitionOf: playerId must be a non-empty string');
  }
  if (!Number.isInteger(poolPct) || poolPct < 0 || poolPct > 100) {
    throw new Error(`partitionOf: poolPct must be an integer 0-100 (got ${poolPct})`);
  }
  return (fnv1a32(playerId) % 100) < poolPct ? GROUPS.POOL : GROUPS.EVAL;
};

/** Convenience predicates — read better at call sites than string comparison. */
export const isPoolPlayer = (playerId, poolPct = DEFAULT_POOL_PCT) =>
  partitionOf(playerId, poolPct) === GROUPS.POOL;

export const isEvalPlayer = (playerId, poolPct = DEFAULT_POOL_PCT) =>
  partitionOf(playerId, poolPct) === GROUPS.EVAL;
