/**
 * primitiveValidity.js — Tier-2 posterior updater for PerceptionPrimitive validityScore
 *
 * Per `schema-delta.md` §3.3 (PerceptionPrimitive shape) + §3.3.1 (cross-anchor
 * invalidation rule) + WRITERS.md §W-PP-2 (validity-updater writer contract).
 *
 * **Three responsibilities:**
 *
 * 1. **Beta-posterior update on firing events.** When a dependent anchor fires
 *    and the firing supports (or contradicts) the primitive's load-bearing claim,
 *    update the primitive's `validityScore` posterior using a Beta-Binomial update.
 *    Returns the updated primitive record (W-PP-2 writer applies it transactionally).
 *
 * 2. **Cross-anchor invalidation ripple computation.** When a primitive's validity
 *    posterior credible interval crosses 0.5 (primitive no longer meaningfully
 *    load-bearing), every ExploitAnchor that references the primitive is flagged
 *    simultaneously: their `quality.composite` is degraded by a penalty factor
 *    (default 0.85). This module computes the ripple — caller (Phase 6 reducer)
 *    applies it atomically in a single IDB transaction (I-WR-3 atomicity test
 *    target → EAL-G5-CA).
 *
 * 3. **Dependent-anchor-count invariant rebuild (I-EAL-9).**
 *    `validityScore.dependentAnchorCount` MUST equal `count(anchors where
 *    perceptionPrimitiveIds includes this.id)`. Recomputed on every anchor write
 *    (caller responsibility); this module exposes the pure rebuild helper.
 *
 * Beta math is **module-local** (no import from `exploitEngine/bayesianConfidence`)
 * to avoid the I-AE-CIRC-1 inheritance from `assumptionEngine/CLAUDE.md` (anchor
 * library does not depend on exploit engine).
 *
 * Pure module — no IO, no side effects. Returns updated records; caller writes.
 *
 * **Approximation note:** credible intervals use a normal approximation
 * `mean ± z × sd` rather than exact Beta CDF inversion. For typical primitive
 * sample sizes (≥ 30 firings), normal approx is well within tolerance. For
 * smaller samples, the approximation fails-safe (slightly wider CI than exact),
 * which makes invalidation harder to fire — conservative direction. Phase 6+
 * may swap to exact Beta CDF if precision becomes load-bearing.
 */

// ───────────────────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────────────────

/**
 * Threshold at which a primitive is "no longer load-bearing" per schema-delta
 * §3.3.1. When the validity posterior's credible interval crosses 0.5 (i.e.
 * `ci.lower < 0.5 < ci.upper` flips to `ci.upper < 0.5`), the primitive is
 * structurally weakened.
 */
export const PRIMITIVE_LOAD_BEARING_THRESHOLD = 0.5;

/**
 * Default penalty factor applied to dependent anchors' `quality.composite` when
 * a primitive's validity drops below the load-bearing threshold. Per
 * schema-delta §3.3.1 the default is 0.85.
 */
export const DEFAULT_PENALTY_FACTOR = 0.85;

/**
 * Z-score for 95% credible interval (two-tailed). Used by the normal-approximation
 * CI computation. Hardcoded for the v1 schema (validityScore.credibleInterval.level
 * is always 0.95 per schema-delta §3.3).
 */
const Z_95 = 1.959963984540054;

// ───────────────────────────────────────────────────────────────────────────
// Public API — Beta-posterior update
// ───────────────────────────────────────────────────────────────────────────

/**
 * Update a primitive's validityScore posterior given one firing event.
 *
 * Beta-Binomial update: prior `Beta(α, β)` + supportingEvent → `Beta(α+w, β)`,
 * non-supportingEvent → `Beta(α, β+w)`, where w is the firing's
 * confidence weight (default 1.0). The posterior's pointEstimate is the new
 * mean `α/(α+β)`; credible interval recomputed from the new shape.
 *
 * @typedef {Object} FiringEvent
 * @property {string} anchorId               — which dependent anchor fired
 * @property {boolean} supportsClaim         — whether the firing supported the primitive's load-bearing claim
 * @property {number} [weight=1.0]           — firing confidence weight ([0, 1])
 * @property {string} [observedAt]           — ISO8601 timestamp (used for lastUpdated)
 *
 * @param {Object} primitive   — PerceptionPrimitive record (must have validityScore)
 * @param {FiringEvent} event
 * @returns {Object} updated primitive (new object; original not mutated)
 */
export const updatePrimitiveValidity = (primitive, event) => {
  if (!primitive || typeof primitive !== 'object') {
    throw new TypeError('updatePrimitiveValidity: primitive must be an object');
  }
  if (!event || typeof event !== 'object' || typeof event.supportsClaim !== 'boolean') {
    throw new TypeError('updatePrimitiveValidity: event must have boolean supportsClaim');
  }

  const validity = primitive.validityScore || {};
  const priorAlpha = numberOrDefault(validity.priorAlpha, 1);
  const priorBeta = numberOrDefault(validity.priorBeta, 1);
  const sampleSize = numberOrDefault(validity.sampleSize, 0);

  // Existing accumulator: store derived shape parameters under the prior + sampleSize.
  // We back-derive successCount from current pointEstimate × sampleSize when available.
  // If no posterior yet, start from prior with no observations.
  const supportsCount = numberOrDefault(validity.supportsCount, derivedSupportsCount(validity, sampleSize));

  const weight = clampWeight(event.weight ?? 1.0);
  const newSampleSize = sampleSize + weight;
  const newSupportsCount = supportsCount + (event.supportsClaim ? weight : 0);

  const posteriorAlpha = priorAlpha + newSupportsCount;
  const posteriorBeta = priorBeta + (newSampleSize - newSupportsCount);
  const total = posteriorAlpha + posteriorBeta;
  const pointEstimate = posteriorAlpha / total;
  const variance = (posteriorAlpha * posteriorBeta) / (total * total * (total + 1));
  const credibleInterval = approximateCredibleInterval(pointEstimate, variance, 0.95);

  return {
    ...primitive,
    validityScore: {
      ...validity,
      priorAlpha,
      priorBeta,
      pointEstimate,
      sampleSize: newSampleSize,
      supportsCount: newSupportsCount,
      credibleInterval,
      lastUpdated: event.observedAt ?? validity.lastUpdated ?? null,
      dependentAnchorCount: numberOrDefault(validity.dependentAnchorCount, 0),
    },
  };
};

/**
 * Apply a batch of firing events to a primitive in order.
 * Returns the final updated primitive.
 *
 * @param {Object} primitive
 * @param {FiringEvent[]} events
 * @returns {Object}
 */
export const applyFiringBatch = (primitive, events) => {
  if (!Array.isArray(events)) {
    throw new TypeError('applyFiringBatch: events must be an array');
  }
  return events.reduce((p, e) => updatePrimitiveValidity(p, e), primitive);
};

// ───────────────────────────────────────────────────────────────────────────
// Public API — cross-anchor invalidation ripple
// ───────────────────────────────────────────────────────────────────────────

/**
 * Determine whether a primitive's validity posterior is still "load-bearing"
 * given the schema-delta §3.3.1 rule:
 *
 *   - LOAD-BEARING: credible interval excludes the threshold from below — i.e.
 *     `ci.lower ≥ threshold`. The data clearly supports the primitive's claim.
 *   - AT-RISK: credible interval spans the threshold — `ci.lower < threshold < ci.upper`.
 *     Data is ambiguous; primitive's load-bearing-ness is uncertain.
 *   - INVALIDATED: credible interval is entirely below the threshold — `ci.upper < threshold`.
 *     The data refutes the primitive's claim; ripple should fire.
 *
 * @param {Object} primitive
 * @param {Object} [options]
 * @param {number} [options.threshold=PRIMITIVE_LOAD_BEARING_THRESHOLD]
 * @returns {{ status: 'load-bearing'|'at-risk'|'invalidated', ciLower: number, ciUpper: number, threshold: number }}
 */
export const evaluatePrimitiveStatus = (primitive, options = {}) => {
  const threshold = options.threshold ?? PRIMITIVE_LOAD_BEARING_THRESHOLD;
  const ci = primitive?.validityScore?.credibleInterval;
  if (!ci || typeof ci.lower !== 'number' || typeof ci.upper !== 'number') {
    return {
      status: 'load-bearing', // default assumption when no CI yet (insufficient data to invalidate)
      ciLower: null,
      ciUpper: null,
      threshold,
      reason: 'credibleInterval missing — insufficient data to evaluate',
    };
  }
  if (ci.upper < threshold) {
    return { status: 'invalidated', ciLower: ci.lower, ciUpper: ci.upper, threshold };
  }
  if (ci.lower < threshold && ci.upper >= threshold) {
    return { status: 'at-risk', ciLower: ci.lower, ciUpper: ci.upper, threshold };
  }
  return { status: 'load-bearing', ciLower: ci.lower, ciUpper: ci.upper, threshold };
};

/**
 * Compute the cross-anchor invalidation ripple when a primitive's status changes.
 *
 * Returns the proposed updates without mutating; caller (Phase 6 reducer with
 * single IDB transaction per I-WR-3) applies all updates atomically.
 *
 * Per schema-delta §3.3.1: when the primitive becomes `invalidated`, every anchor
 * whose `perceptionPrimitiveIds` includes the primitive's id has its
 * `quality.composite` degraded by `penaltyFactor` (default 0.85). The anchors
 * are NOT auto-retired — only flagged with the degraded composite.
 *
 * If the primitive transitions back to `load-bearing` (data recovers), the
 * ripple-back recomputes composites by dividing out the prior penalty —
 * but Phase 5 implementation intentionally does NOT include automatic recovery
 * (Phase 8 concern). For Commit 4: only the degradation direction is implemented.
 *
 * @param {Object} primitive
 * @param {Object[]} dependentAnchors  — anchors that reference the primitive
 * @param {Object} [options]
 * @param {number} [options.penaltyFactor=DEFAULT_PENALTY_FACTOR]
 * @param {string} [options.transitionFrom]  — primitive's prior status (for change detection)
 * @returns {{ shouldFire: boolean, fromStatus: string, toStatus: string, anchorPenalties: Array<{anchorId: string, fromComposite: number, toComposite: number, penaltyFactor: number}> }}
 */
export const computeRipple = (primitive, dependentAnchors, options = {}) => {
  const penaltyFactor = options.penaltyFactor ?? DEFAULT_PENALTY_FACTOR;
  const fromStatus = options.transitionFrom ?? null;

  if (penaltyFactor <= 0 || penaltyFactor > 1) {
    throw new RangeError(
      `computeRipple: penaltyFactor must be in (0, 1]; got ${penaltyFactor}`,
    );
  }

  const evaluation = evaluatePrimitiveStatus(primitive);
  const toStatus = evaluation.status;

  // Ripple fires when transitioning INTO 'invalidated' from a different state.
  // If transitionFrom is unspecified, we conservatively fire whenever current
  // status is 'invalidated' (caller knew enough to ask).
  const shouldFire = toStatus === 'invalidated'
    && (fromStatus === null || fromStatus !== 'invalidated');

  if (!shouldFire) {
    return {
      shouldFire: false,
      fromStatus,
      toStatus,
      anchorPenalties: [],
      reason: toStatus !== 'invalidated'
        ? `primitive status is '${toStatus}' — no ripple needed`
        : 'primitive was already invalidated; no further ripple',
    };
  }

  if (!Array.isArray(dependentAnchors)) {
    throw new TypeError('computeRipple: dependentAnchors must be an array');
  }

  const anchorPenalties = dependentAnchors
    .filter((a) => isAnchorReferencingPrimitive(a, primitive.id))
    .map((anchor) => {
      const fromComposite = anchor.quality?.composite;
      if (typeof fromComposite !== 'number') {
        return {
          anchorId: anchor.id,
          fromComposite: null,
          toComposite: null,
          penaltyFactor,
          skipped: true,
          reason: 'anchor.quality.composite missing or non-numeric',
        };
      }
      return {
        anchorId: anchor.id,
        fromComposite,
        toComposite: fromComposite * penaltyFactor,
        penaltyFactor,
      };
    });

  return {
    shouldFire: true,
    fromStatus,
    toStatus,
    anchorPenalties,
    primitiveId: primitive.id,
    threshold: evaluation.threshold,
  };
};

// ───────────────────────────────────────────────────────────────────────────
// Public API — dependent-anchor-count invariant rebuild (I-EAL-9)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Rebuild a primitive's `validityScore.dependentAnchorCount` from the canonical
 * source: count of anchors whose `perceptionPrimitiveIds` includes this primitive.
 *
 * I-EAL-9 invariant requires this count to be exact at every primitive write.
 * Caller invokes this whenever the anchor list changes.
 *
 * @param {Object} primitive
 * @param {Object[]} allAnchors
 * @returns {Object} updated primitive
 */
export const rebuildDependentAnchorCount = (primitive, allAnchors) => {
  if (!primitive || typeof primitive !== 'object') {
    throw new TypeError('rebuildDependentAnchorCount: primitive must be an object');
  }
  if (!Array.isArray(allAnchors)) {
    throw new TypeError('rebuildDependentAnchorCount: allAnchors must be an array');
  }

  const count = allAnchors.filter((a) => isAnchorReferencingPrimitive(a, primitive.id)).length;

  return {
    ...primitive,
    validityScore: {
      ...(primitive.validityScore || {}),
      dependentAnchorCount: count,
    },
  };
};

// ───────────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────────

const numberOrDefault = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt);

const clampWeight = (w) => {
  const n = typeof w === 'number' && Number.isFinite(w) ? w : 1.0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
};

/**
 * If a primitive has been updated before and we don't have an explicit
 * supportsCount stored, derive it from `pointEstimate × sampleSize` (rounded).
 * This is a one-time bootstrap for primitives written before this module existed;
 * after the first update through this module, `supportsCount` is stored exactly.
 */
const derivedSupportsCount = (validity, sampleSize) => {
  const pe = validity?.pointEstimate;
  if (typeof pe !== 'number' || sampleSize <= 0) return 0;
  return pe * sampleSize;
};

/**
 * Approximate credible interval for a Beta posterior using normal approximation.
 *
 * For Beta(α, β) with mean = α/(α+β) and variance = αβ/((α+β)²(α+β+1)),
 * the (1-α) credible interval ≈ mean ± z_{1-α/2} × √variance, clamped to [0, 1].
 *
 * Phase 6+ may upgrade to exact Beta CDF inversion if precision matters more.
 */
const approximateCredibleInterval = (mean, variance, level = 0.95) => {
  if (!Number.isFinite(mean) || !Number.isFinite(variance) || variance < 0) {
    return { lower: 0, upper: 1, level };
  }
  const z = level === 0.95 ? Z_95 : approximateZ(level);
  const sd = Math.sqrt(variance);
  const lower = Math.max(0, mean - z * sd);
  const upper = Math.min(1, mean + z * sd);
  return { lower, upper, level };
};

/**
 * Approximate inverse standard-normal CDF for non-95% levels.
 * Beasley-Springer-Moro is overkill here; use a simple approximation.
 */
const approximateZ = (level) => {
  // Common z-scores for two-tailed CI levels
  const map = { 0.90: 1.6449, 0.95: 1.96, 0.99: 2.5758 };
  return map[level] ?? 1.96;
};

/**
 * Check whether an anchor references a primitive by id.
 */
const isAnchorReferencingPrimitive = (anchor, primitiveId) => {
  if (!anchor || typeof anchor !== 'object') return false;
  const ids = anchor.perceptionPrimitiveIds;
  return Array.isArray(ids) && ids.includes(primitiveId);
};
