/**
 * stratifiedSelect.mjs — WS-504. Apply a cap ACROSS strata instead of down a sorted list.
 *
 * THE DEFECT THIS REMOVES, STATED ONCE FOR BOTH CALLERS. Two independent caps in this harness
 * took a sorted PREFIX of a list whose sort key begins with the site code:
 *
 *   1. `--max-files`   — `corpusFiles.discoverCorpusFiles` returns a path-sorted list, and
 *      directory names lead with the site. Measured on G16 2026-08-17:
 *      `{sites:['FTP','PS'], stakes:['50NLH']}` → 1756 files, FTP 525 then PS 1231, first PS
 *      file at index 525. Any `--max-files <= 525` was 100% FTP.
 *
 *   2. `--max-players` — players are keyed `` `${site}:${pid}` `` (`runner.mjs:553`) and
 *      `buildEnumeration` sorts raw code-unit (`heroEvEnumeration.mjs:79`), so `'FTP:zzz'` sorts
 *      before `'PS:abc'` and `enumeration.players.slice(0, maxPlayers)` exhausted every FTP
 *      player before reaching a PS one.
 *
 * The second is the BINDING one and the reason this module is generic rather than living inside
 * corpusFiles.mjs. Stratifying files alone leaves a capped run ~100% one site, because the player
 * cap re-imposes the same prefix one layer down. Fixing either without the other looks like a fix
 * and is not one.
 *
 * WHY IT MATTERS. WS-492 measured a monotone stake gradient across these directories (6-max
 * 3-bet +57% from 25NLH to 1000NLH). The strata are not exchangeable, so a prefix sample is not
 * a smaller version of the corpus — it is a different population, reported under the corpus's
 * name.
 *
 * NO RNG. Allocation is largest-remainder and emission is a Jefferson/D'Hondt-style merge; both
 * are pure functions of the inputs with ties resolved to the lowest (key-sorted) index. Nothing
 * here needs a seed, so nothing new has to be stamped into a replication manifest. This matches
 * the existing seedless-systematic idiom in `gameTreeSampling.weightedSample` and
 * `heroPolicy.sampleCombos`.
 */

/** Bumped when the SELECTION ALGORITHM changes, so a manifest can say which one drew its sample. */
export const STRATIFIED_SELECTION_VERSION = 'strat-v1';

/**
 * `prefix` is the pre-WS-504 behaviour. Retained ONLY so an already-published Result Card can be
 * replicated, and NAMED rather than default precisely so that using it is a deliberate, recorded
 * act instead of the silent default it used to be.
 */
export const SELECTION_STRATEGIES = Object.freeze(['proportional', 'prefix']);
export const DEFAULT_SELECTION_STRATEGY = 'proportional';

/**
 * Integer quotas from fractional shares — largest-remainder (Hare–Niemeyer), expressed as a
 * greedy "largest deficit" fill so per-stratum CAPACITY is respected without a second pass.
 *
 * @param {number[]} sizes - stratum sizes, in key-sorted order
 * @param {number} max
 * @returns {number[]} quotas summing to `min(max, total)`
 */
export const allocate = (sizes, max) => {
  const n = sizes.length;
  const total = sizes.reduce((a, b) => a + b, 0);
  if (n === 0 || total === 0) return new Array(n).fill(0);
  const cap = Math.min(max, total);
  const quota = new Array(n).fill(0);
  let left = cap;

  // A floor of one per stratum whenever the cap can cover every stratum at all. Without it,
  // rounding alone can drop a small stratum to zero and quietly restore the very
  // single-population sample this module exists to prevent.
  if (left >= n) {
    for (let i = 0; i < n; i++) { quota[i] = 1; left--; }
  }

  const exact = sizes.map((s) => (cap * s) / total);
  while (left > 0) {
    let best = -1;
    let bestDeficit = -Infinity;
    for (let i = 0; i < n; i++) {
      if (quota[i] >= sizes[i]) continue;      // stratum exhausted
      const deficit = exact[i] - quota[i];     // how far below its proportional share
      if (deficit > bestDeficit) { bestDeficit = deficit; best = i; }
    }
    if (best === -1) break;                    // every stratum exhausted
    quota[best]++;
    left--;
  }
  return quota;
};

/**
 * Emit chosen items so that EVERY PREFIX is itself approximately proportional.
 *
 * Defence in depth, and cheap. Stratifying the SET is the point of this module, but several
 * consumers take a prefix of the set for their own reasons — `runner.mjs:556` stops admitting new
 * players once `byPlayer.size >= maxPlayers`, and the hero-EV wave scheduler stops on
 * `targetContributingPlayers` at a wave boundary. Handing those a stratum-blocked list would
 * re-create the bias one layer down. Interleaving removes the whole class at no cost.
 */
export const interleave = (groups, quota) => {
  const taken = new Array(groups.length).fill(0);
  const out = [];
  const totalTake = quota.reduce((a, b) => a + b, 0);
  for (let step = 0; step < totalTake; step++) {
    let best = -1;
    let bestShare = Infinity;
    for (let i = 0; i < groups.length; i++) {
      if (taken[i] >= quota[i]) continue;
      const share = taken[i] / quota[i];       // fraction of this stratum already emitted
      if (share < bestShare) { bestShare = share; best = i; }
    }
    if (best === -1) break;
    out.push(groups[best].items[taken[best]]);
    taken[best]++;
  }
  return out;
};

/** Group into key-sorted `{key, items}` buckets, preserving each bucket's incoming order. */
const groupByStratum = (items, keyOf) => {
  const byKey = new Map();
  for (const it of items) {
    const k = keyOf(it);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(it);
  }
  return [...byKey.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, groupItems]) => ({ key, items: groupItems }));
};

/**
 * Reorder a COMPLETE list so every prefix is approximately proportional. Selects nothing.
 *
 * Separate from `stratifiedSelect` because ordering and selection are separate defects here.
 * `targetContributingPlayers` truncates nothing — it stops at a wave boundary partway down an
 * untruncated list — so an uncapped plan in lexicographic order still scored one site and
 * stopped inside it. Ordering fixes that without changing which items are eligible.
 *
 * Idempotent: re-ordering an already-stratified list reproduces it.
 */
export const stratifiedOrder = (items, keyOf) => {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return list;
  const groups = groupByStratum(list, keyOf);
  if (groups.length <= 1) return list;          // single stratum: nothing to interleave
  return interleave(groups, groups.map((g) => g.items.length));
};

/** Counts by stratum, key-sorted so the object serialises stably into a manifest. */
export const countByStratum = (items, keyOf) => {
  const counts = new Map();
  for (const it of items) {
    const k = keyOf(it);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
};

/**
 * Apply a cap across strata.
 *
 * @param {Array} items - ALREADY in canonical (sorted) order
 * @param {Object} opts
 * @param {number} [opts.max] - the cap. Infinity/null/undefined mean "no cap".
 * @param {(item: any) => string} opts.keyOf - the stratum of an item
 * @param {'proportional'|'prefix'} [opts.strategy]
 * @returns {{items: Array, selection: Object}} `selection` describes the REALISED sample.
 */
export const stratifiedSelect = (items, {
  max = Infinity,
  keyOf,
  strategy = DEFAULT_SELECTION_STRATEGY,
} = {}) => {
  if (!SELECTION_STRATEGIES.includes(strategy)) {
    throw new Error(
      `Unknown selection strategy: ${strategy}. Known: ${SELECTION_STRATEGIES.join(', ')}.`,
    );
  }
  if (typeof keyOf !== 'function') {
    throw new Error('stratifiedSelect: keyOf is required — a cap cannot stratify without a stratum.');
  }
  const list = Array.isArray(items) ? items : [];
  const discovered = { total: list.length, perStratum: countByStratum(list, keyOf) };
  const cap = (max === null || max === undefined || !Number.isFinite(max))
    ? Infinity
    : Math.max(0, Math.trunc(max));

  let chosen;
  if (cap >= list.length) {
    // Uncapped: the SAME array, in the SAME order. A run that reads everything matched must be
    // byte-identical to one from before this change, Deal Book hash included.
    chosen = list;
  } else if (strategy === 'prefix') {
    chosen = list.slice(0, cap);
  } else {
    const groups = groupByStratum(list, keyOf);
    chosen = interleave(groups, allocate(groups.map((g) => g.items.length), cap));
  }

  const realisedPerStratum = countByStratum(chosen, keyOf);
  const missingStrata = Object.keys(discovered.perStratum)
    .filter((k) => !realisedPerStratum[k])
    .sort();

  return {
    items: chosen,
    selection: {
      strategy,
      version: STRATIFIED_SELECTION_VERSION,
      capped: cap < list.length,
      discovered,
      realised: { total: chosen.length, perStratum: realisedPerStratum },
      // Reported, not refused: with a floor of one per stratum this can only happen when the cap
      // is smaller than the number of strata, which is a legitimate request. The artifact says so
      // rather than leaving the reader to notice.
      collapsed: missingStrata.length > 0,
      missingStrata,
    },
  };
};
