/**
 * retirementEvaluator.js — Session-close Tier-3 evaluator for ExploitAnchor retirement
 *
 * Per `docs/design/journeys/anchor-retirement.md` Variation D (Tier 3 auto-retirement,
 * system-initiated + user-reviewed) and `schema-delta.md` §2.6 retirementCondition.
 *
 * Called exactly once per session-close (H-N05 error prevention — no mid-session
 * surprise state transitions per journey spec). Returns a list of proposed status
 * transitions for each anchor; caller (the session-close hook) applies them atomically
 * via W-EA-3 writer.
 *
 * Two retirement-condition methods supported in Phase 5:
 *
 * **credible-interval-overlap** (default; SEED-01 + SEED-03 + SEED-04 use)
 *   Fires when the 95% (or specified) credible interval of the observed rate overlaps
 *   the anchor's GTO referenceRate — i.e. the observed data no longer meaningfully
 *   diverges from GTO-balanced baseline. Per seed-01 §7.
 *
 * **gap-threshold** (SEED-02 uses)
 *   Fires when |pointEstimate − referenceRate| ≤ params.gap — i.e. the point estimate
 *   has converged within the gap threshold. Per seed-02 §7: "hero's calling decision
 *   is sensitive to the point estimate of villain bluff frequency (via pot-odds)."
 *   Note: the "sessions: 10" parameter in seed-02's retirementCondition is a
 *   consecutive-session requirement; this evaluator expects the caller to pass
 *   `context.sessionHistory` with per-session gap readings so the evaluator can
 *   verify 10-consecutive-session compliance.
 *
 * Status-transition rules:
 *
 *   active → expiring    on first session-close fire of retirement condition
 *   expiring → retired   on subsequent session-close fire of retirement condition
 *   candidate → no-op    (never auto-transition; already non-firing by design)
 *   retired → no-op      (terminal state; explicit re-enable via owner action only)
 *   suppressed → no-op   (explicit user-state; auto-retirement respects override)
 *
 * Owner override suppression (red line #3 durability):
 *   If `operator.lastOverrideBy === 'owner'` AND `operator.lastOverrideAt` is
 *   more recent than the anchor's last auto-transition, the evaluator skips
 *   auto-transition. User overrides are durable — no algorithmic rebuttal.
 *
 * Pure module — no IO, no side effects. Returns decisions; caller applies writes.
 */

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RetirementContext
 * @property {string} sessionId          — ID of the session just closing
 * @property {string} currentDate        — ISO8601 timestamp of this evaluation
 * @property {Object[]} [sessionHistory] — optional; prior session-close readings for
 *                                         gap-threshold consecutive-session logic.
 *                                         Entries: { sessionId, closedAt, anchorGaps: { [anchorId]: number } }
 */

/**
 * @typedef {Object} RetirementDecision
 * @property {string} anchorId
 * @property {'active'|'expiring'|'retired'|'candidate'|'suppressed'} fromStatus
 * @property {'expiring'|'retired'} toStatus
 * @property {string} method              — retirement-condition method that fired
 * @property {string} reason              — human-readable summary
 * @property {Object} metrics             — supporting numbers (CI bounds, gap, etc)
 */

/**
 * @typedef {Object} SkipReason
 * @property {string} anchorId
 * @property {string} reason              — why skipped (terminal / no-op / override / candidate / invariant)
 * @property {Object} [detail]
 */

/**
 * Evaluate retirement for a single anchor at session-close.
 *
 * Returns a RetirementDecision if the anchor should transition, or null if not.
 * Returns a SkipReason wrapped in { skipped: true } for explicit reasons (for logging).
 *
 * @param {Object} anchor — ExploitAnchor record (schema-valid)
 * @param {RetirementContext} context
 * @returns {RetirementDecision | { skipped: true, reason: string, detail?: Object } | null}
 */
export const evaluateAnchorRetirement = (anchor, context) => {
  if (!anchor || typeof anchor !== 'object') {
    return { skipped: true, reason: 'invalid-input: anchor is not an object' };
  }
  if (!context || typeof context !== 'object') {
    return { skipped: true, reason: 'invalid-input: context is not an object' };
  }

  const status = anchor.status ?? 'active';

  // ─── Terminal / no-op states ──────────────────────────────────────────
  if (status === 'candidate') {
    return { skipped: true, reason: 'status-candidate', detail: { anchorId: anchor.id } };
  }
  if (status === 'retired') {
    return { skipped: true, reason: 'status-terminal-retired', detail: { anchorId: anchor.id } };
  }
  if (status === 'suppressed') {
    return { skipped: true, reason: 'status-user-suppressed', detail: { anchorId: anchor.id } };
  }

  // ─── Owner override check (red line #3 durability) ────────────────────
  if (isOwnerOverrideRecent(anchor)) {
    return {
      skipped: true,
      reason: 'owner-override-durable',
      detail: {
        anchorId: anchor.id,
        lastOverrideAt: anchor.operator?.lastOverrideAt,
        lastOverrideBy: anchor.operator?.lastOverrideBy,
      },
    };
  }

  // ─── Evaluate retirement condition ────────────────────────────────────
  const firing = evaluateCondition(anchor, context);
  if (!firing.fired) {
    return null; // no transition proposed
  }

  // ─── Status transition: active → expiring, expiring → retired ────────
  const toStatus = status === 'active' ? 'expiring' : 'retired';

  return {
    anchorId: anchor.id,
    fromStatus: status,
    toStatus,
    method: firing.method,
    reason: firing.reason,
    metrics: firing.metrics,
  };
};

/**
 * Evaluate retirement across a batch of anchors at session-close.
 *
 * Returns a structured result with transitions + skipped + errors for logging.
 * Caller applies transitions atomically per anchor via W-EA-3 writer.
 *
 * @param {Object[]} anchors
 * @param {RetirementContext} context
 * @returns {{ transitions: RetirementDecision[], skipped: SkipReason[], errors: SkipReason[] }}
 */
export const evaluateAllAnchors = (anchors, context) => {
  if (!Array.isArray(anchors)) {
    return {
      transitions: [],
      skipped: [],
      errors: [{ anchorId: null, reason: 'invalid-input: anchors is not an array' }],
    };
  }

  const transitions = [];
  const skipped = [];
  const errors = [];

  for (const anchor of anchors) {
    const result = evaluateAnchorRetirement(anchor, context);
    if (result === null) {
      // No transition proposed; not notable
      continue;
    }
    if (result.skipped) {
      if (result.reason.startsWith('invalid-input') || result.reason.startsWith('invariant-')) {
        errors.push({ anchorId: anchor?.id ?? null, reason: result.reason, detail: result.detail });
      } else {
        skipped.push({ anchorId: anchor?.id ?? null, reason: result.reason, detail: result.detail });
      }
    } else {
      transitions.push(result);
    }
  }

  return { transitions, skipped, errors };
};

// ───────────────────────────────────────────────────────────────────────────
// Internal: condition evaluation
// ───────────────────────────────────────────────────────────────────────────

/**
 * Dispatch on retirement-condition method and return firing decision.
 */
const evaluateCondition = (anchor, context) => {
  const cond = anchor.retirementCondition;
  if (!cond || typeof cond !== 'object' || typeof cond.method !== 'string') {
    return {
      fired: false,
      method: 'unknown',
      reason: 'retirementCondition missing or malformed',
      metrics: {},
    };
  }

  switch (cond.method) {
    case 'credible-interval-overlap':
      return evaluateCiOverlap(anchor, cond);
    case 'gap-threshold':
      return evaluateGapThreshold(anchor, cond, context);
    default:
      return {
        fired: false,
        method: cond.method,
        reason: `retirement method "${cond.method}" not implemented in Phase 5`,
        metrics: {},
      };
  }
};

/**
 * credible-interval-overlap:
 *   Fires when evidence.credibleInterval spans the gtoBaseline.referenceRate
 *   — i.e. `ci.lower ≤ referenceRate ≤ ci.upper`. This means the observed-rate
 *   posterior no longer excludes GTO-balanced baseline; the divergence has
 *   lost statistical significance.
 */
const evaluateCiOverlap = (anchor, _cond) => {
  const ci = anchor.evidence?.credibleInterval;
  const refRate = anchor.gtoBaseline?.referenceRate;

  if (!ci || typeof ci.lower !== 'number' || typeof ci.upper !== 'number') {
    return {
      fired: false,
      method: 'credible-interval-overlap',
      reason: 'evidence.credibleInterval missing or malformed',
      metrics: {},
    };
  }
  if (typeof refRate !== 'number') {
    return {
      fired: false,
      method: 'credible-interval-overlap',
      reason: 'gtoBaseline.referenceRate missing or non-numeric',
      metrics: { ciLower: ci.lower, ciUpper: ci.upper },
    };
  }

  const overlaps = refRate >= ci.lower && refRate <= ci.upper;

  return {
    fired: overlaps,
    method: 'credible-interval-overlap',
    reason: overlaps
      ? `Observed-rate CI [${ci.lower.toFixed(3)}, ${ci.upper.toFixed(3)}] overlaps GTO baseline ${refRate.toFixed(3)} — divergence no longer statistically meaningful`
      : `CI [${ci.lower.toFixed(3)}, ${ci.upper.toFixed(3)}] excludes GTO baseline ${refRate.toFixed(3)}`,
    metrics: {
      ciLower: ci.lower,
      ciUpper: ci.upper,
      referenceRate: refRate,
      ciLevel: ci.level ?? null,
    },
  };
};

/**
 * gap-threshold:
 *   Fires when |pointEstimate − referenceRate| ≤ params.gap for
 *   params.sessions consecutive sessions. Uses context.sessionHistory for
 *   the consecutive-session check.
 *
 *   If sessions parameter is 1 (or missing), the current-session gap alone
 *   is sufficient to fire. Otherwise evaluates the last N session closings.
 */
const evaluateGapThreshold = (anchor, cond, context) => {
  const gap = cond.params?.gap;
  const sessionsRequired = cond.params?.sessions ?? 1;
  const pointEstimate = anchor.evidence?.pointEstimate;
  const refRate = anchor.gtoBaseline?.referenceRate;

  if (typeof gap !== 'number') {
    return {
      fired: false,
      method: 'gap-threshold',
      reason: 'retirementCondition.params.gap missing or non-numeric',
      metrics: {},
    };
  }
  if (typeof pointEstimate !== 'number' || typeof refRate !== 'number') {
    return {
      fired: false,
      method: 'gap-threshold',
      reason: 'evidence.pointEstimate or gtoBaseline.referenceRate missing',
      metrics: { pointEstimate, refRate },
    };
  }

  const currentGap = Math.abs(pointEstimate - refRate);
  const currentFires = currentGap <= gap;

  // If only 1 session required, current gap is sufficient
  if (sessionsRequired <= 1) {
    return {
      fired: currentFires,
      method: 'gap-threshold',
      reason: currentFires
        ? `|observed ${pointEstimate.toFixed(3)} − GTO ${refRate.toFixed(3)}| = ${currentGap.toFixed(3)} ≤ threshold ${gap.toFixed(3)}`
        : `gap ${currentGap.toFixed(3)} exceeds threshold ${gap.toFixed(3)}`,
      metrics: { currentGap, gap, pointEstimate, referenceRate: refRate, sessionsRequired },
    };
  }

  // Multi-session: need sessionHistory. Include CURRENT session + N-1 prior = N total.
  const history = Array.isArray(context.sessionHistory) ? context.sessionHistory : [];
  const priorEntries = history
    .slice()
    .sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1)) // most-recent first
    .slice(0, sessionsRequired - 1); // need N-1 prior + 1 current = N total

  if (priorEntries.length < sessionsRequired - 1) {
    return {
      fired: false,
      method: 'gap-threshold',
      reason: `only ${priorEntries.length + 1} session-closes available; need ${sessionsRequired}`,
      metrics: { currentGap, gap, sessionsRequired, sessionsAvailable: priorEntries.length + 1 },
    };
  }

  const allPriorFire = priorEntries.every((entry) => {
    const entryGap = entry.anchorGaps?.[anchor.id];
    return typeof entryGap === 'number' && entryGap <= gap;
  });

  const allFire = currentFires && allPriorFire;

  return {
    fired: allFire,
    method: 'gap-threshold',
    reason: allFire
      ? `gap ≤ ${gap.toFixed(3)} for ${sessionsRequired} consecutive session-closes — sustained convergence`
      : allPriorFire
        ? `current session gap ${currentGap.toFixed(3)} exceeds threshold ${gap.toFixed(3)} (${priorEntries.length} prior sessions fired)`
        : `not all ${sessionsRequired - 1} prior sessions fired the gap-threshold`,
    metrics: {
      currentGap,
      gap,
      pointEstimate,
      referenceRate: refRate,
      sessionsRequired,
      sessionsConsecutive: (currentFires ? 1 : 0) + priorEntries.filter(
        (e) => typeof e.anchorGaps?.[anchor.id] === 'number' && e.anchorGaps[anchor.id] <= gap,
      ).length,
    },
  };
};

// ───────────────────────────────────────────────────────────────────────────
// Internal: owner-override recency check (red line #3 durability)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Returns true if an owner override has happened more recently than any
 * auto-transition — auto-retirement respects durable overrides.
 *
 * Heuristic: if `operator.lastOverrideBy === 'owner'` AND
 * `operator.lastOverrideAt` is more recent than `evidence.lastUpdated`, treat
 * the override as the freshest state — evaluator skips.
 *
 * The underlying invariant is I-WR-2 (signal separation): evidence updates
 * are matcher-driven (W-EA-2 writer); overrides are owner-driven (W-EA-3).
 * An owner who manually retired/suppressed/reset more recently than evidence
 * updates is asserting durable intent.
 */
const isOwnerOverrideRecent = (anchor) => {
  const override = anchor.operator || {};
  if (override.lastOverrideBy !== 'owner') return false;
  const overrideAt = override.lastOverrideAt;
  if (typeof overrideAt !== 'string') return false;

  // If there's no evidence timestamp to compare against, treat override as binding
  const evidenceAt = anchor.evidence?.lastUpdated;
  if (typeof evidenceAt !== 'string') return true;

  // Parse ISO8601 comparison
  const overrideTime = Date.parse(overrideAt);
  const evidenceTime = Date.parse(evidenceAt);
  if (!Number.isFinite(overrideTime) || !Number.isFinite(evidenceTime)) {
    // Malformed timestamps — fall through to treating override as binding (safer)
    return true;
  }
  return overrideTime > evidenceTime;
};
