/**
 * engineCache.js — In-memory cache for line-study engine results.
 *
 * LSW-D2: NEV-12 forward requirement from RT-118. Two callsites benefit:
 *   - `computeDepth2Plan` (HandPlanSection)            [LSW-D1]
 *   - `computeBucketEVsV2` (BucketEVPanelV2)           [LSW-G4-IMPL]
 *
 * Both fire on every node render, and re-fire on every archetype toggle.
 * A full LinePicker walk through 25 decision nodes × 3 archetypes is 75
 * computes per pass; navigating back to a node or toggling Reg → Fish → Reg
 * is the common case. This cache lets the second visit return instantly.
 *
 * Design:
 *   - `Map`-backed (NEV-12 compliant — no `Object[]` keying, no prototype
 *     pollution risk from authored line IDs).
 *   - Keyed by `kind` prefix + caller-supplied `keyParts` string + the
 *     current `engineVersion`. The version stamp is read at every key
 *     composition, so a runtime bump produces different keys (old entries
 *     become unreachable; explicit `clearEngineCache()` releases memory).
 *   - In-flight promise dedup: simultaneous calls for the same key share
 *     a single Promise so MC variance is consistent + compute isn't doubled.
 *   - errorState results are NOT cached — re-runs can recover from transient
 *     engine failures (MW LSW-G6 stub, time-budget bailout, etc.).
 *
 * Invalidation contract:
 *   - `__setEngineVersionForTests(v)` overrides the stamp for tests; combined
 *     with `clearEngineCache()` this exercises the engineVersion-bump path.
 *   - In production, the stamp is `ENGINE_VERSION` from `runtimeVersions.js`.
 *     A version-bump release ships fresh keys; old entries are harmless.
 *
 * Pure module — no UI / state / persistence imports. Lives next to the engine
 * paths it caches (`drillModeEngine.js`, `computeDepth2Plan.js`).
 */

import { ENGINE_VERSION } from '../../constants/runtimeVersions';

const CACHE = new Map();      // key: string → resolved output
const IN_FLIGHT = new Map();  // key: string → Promise<output>

let _engineVersion = ENGINE_VERSION;

/**
 * Test-only override for the version stamp. Production callers must NOT
 * use this — the stamp is `ENGINE_VERSION` at module load and stays stable
 * for the page lifetime. Tests use this + `__resetEngineVersionForTests()`
 * to verify invalidation semantics.
 */
export const __setEngineVersionForTests = (v) => {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error('__setEngineVersionForTests requires a non-empty string');
  }
  _engineVersion = v;
};

export const __resetEngineVersionForTests = () => {
  _engineVersion = ENGINE_VERSION;
};

/** Read the current effective engine version (test-aware). */
export const getEngineVersion = () => _engineVersion;

/**
 * Compose a stable cache key. NOT exposed for external mutation — callers
 * pass `kind` + `keyParts` to `getOrCompute`, and we build the canonical
 * string here.
 */
const composeKey = (kind, keyParts) => {
  const partsStr = typeof keyParts === 'string' ? keyParts : JSON.stringify(keyParts);
  return `${kind}|v=${_engineVersion}|${partsStr}`;
};

/**
 * Get cached result if present, else `compute()` it, cache the result, and
 * return. Caching is skipped when:
 *   - `keyParts` is null/undefined (caller opts out — test-only escape hatch)
 *   - The compute returns a result with non-null `errorState` (don't poison
 *     the cache with transient failures)
 *
 * In-flight dedup: simultaneous calls for the same key share a Promise.
 *
 * @template T
 * @param {string} kind         Cache namespace (e.g. 'depth2Plan', 'bucketEVsV2').
 * @param {string|object|null} keyParts  Caller-stable key components.
 * @param {() => Promise<T>} compute     Producer; called only on cache miss.
 * @returns {Promise<T>}
 */
export const getOrCompute = async (kind, keyParts, compute) => {
  if (keyParts == null) {
    return compute();
  }
  if (typeof kind !== 'string' || kind.length === 0) {
    throw new Error('getOrCompute requires a non-empty kind string');
  }
  const key = composeKey(kind, keyParts);

  const cached = CACHE.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const inFlight = IN_FLIGHT.get(key);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    try {
      const result = await compute();
      if (result && typeof result === 'object' && result.errorState) {
        // Don't cache failures — let retries resolve transient issues.
        return result;
      }
      CACHE.set(key, result);
      return result;
    } finally {
      IN_FLIGHT.delete(key);
    }
  })();

  IN_FLIGHT.set(key, promise);
  return promise;
};

/**
 * Clear all cached entries + in-flight promises. Use on page navigation
 * away from line study, or as part of an explicit "Recompute" gesture.
 */
export const clearEngineCache = () => {
  CACHE.clear();
  IN_FLIGHT.clear();
};

/**
 * Diagnostic snapshot of cache state. Useful for asserting hit-rate goals
 * during integration testing + dev-mode performance overlays.
 */
export const engineCacheStats = () => ({
  size: CACHE.size,
  inflight: IN_FLIGHT.size,
  engineVersion: _engineVersion,
});

/**
 * Return whether a key is currently cached (cheap; no side effects). Used
 * by tests to assert hit-vs-miss state without invoking compute.
 */
export const hasCached = (kind, keyParts) => {
  if (keyParts == null) return false;
  return CACHE.has(composeKey(kind, keyParts));
};
