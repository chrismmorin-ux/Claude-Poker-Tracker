/**
 * useAnchorAutoRetire.js — Tier-3 auto-retirement orchestrator.
 *
 * Wires the pure-util retirement evaluator into the session-close hook.
 * On `sessionEndTime` transition (null → set), the orchestrator runs
 * `evaluateAllAnchors` over current anchors, builds system-stamped
 * override payloads for each transition decision, and dispatches
 * `ANCHOR_OVERRIDDEN` to the anchor library reducer.
 *
 * Pure module — no IO except localStorage for banner-dismissal timestamp.
 * Mid-session firing is structurally impossible: evaluation is gated on
 * `sessionEndTime` transition, not on render.
 *
 * Per `docs/design/journeys/anchor-retirement.md` Variation D + EAL CLAUDE.md
 * "DO NOT auto-retire mid-session" anti-pattern + WRITERS.md §W-EA-3.
 *
 * EAL Phase 6 — SPR-060 / WS-170.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ANCHOR_LIBRARY_ACTIONS } from '../constants/anchorLibraryConstants';
import { evaluateAllAnchors } from '../utils/anchorLibrary/retirementEvaluator';

const BANNER_DISMISSED_AT_KEY = 'eal-auto-retire-banner-last-dismissed';

// ───────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for testability)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Build the W-EA-3 anchor record update for an auto-retire transition.
 * Forked from `buildOverridePayload` in `useAnchorRetirement.js` to keep
 * the manual-path tests stable. The system stamp differs from owner-stamp:
 *   - `lastOverrideBy: 'system'` (vs `'owner'`)
 *   - `overrideReason: 'auto-retire'` (vs `'manual-{retire,suppress,reset}'`)
 *
 * @param {Object} priorAnchor          — anchor as it existed before evaluation
 * @param {string} toStatus             — `'expiring'` or `'retired'`
 * @param {string} timestamp            — ISO 8601 string
 * @returns {Object} updated anchor record ready for dispatch
 */
export const buildAutoRetirePayload = (priorAnchor, toStatus, timestamp) => {
  const updated = { ...priorAnchor };
  updated.status = toStatus;
  const priorOperator = priorAnchor.operator || {};
  updated.operator = {
    ...priorOperator,
    lastOverrideAt: timestamp,
    lastOverrideBy: 'system',
    overrideReason: 'auto-retire',
  };
  return updated;
};

/**
 * Read the localStorage banner-dismissal timestamp. Returns ISO string or null.
 * Tolerates missing storage (e.g., SSR) + parse errors.
 */
export const readBannerDismissedAt = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(BANNER_DISMISSED_AT_KEY);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
};

/**
 * Write the localStorage banner-dismissal timestamp.
 */
export const writeBannerDismissedAt = (timestamp) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (typeof timestamp === 'string' && timestamp.length > 0) {
      window.localStorage.setItem(BANNER_DISMISSED_AT_KEY, timestamp);
    }
  } catch {
    // No-op — localStorage may be unavailable / quota-exceeded; banner
    // simply re-shows next render. Acceptable degradation.
  }
};

/**
 * Count anchors auto-retired (status === 'retired' AND auto-stamped) since
 * `lastDismissedAt`. If `lastDismissedAt` is null, every auto-retired anchor
 * counts.
 *
 * Per journey doc Variation D: banner shows for confirmed `retired` only,
 * NOT `expiring` ("retirement already happened").
 *
 * @param {Object[]} anchors
 * @param {string|null} lastDismissedAt — ISO 8601 string or null
 * @returns {number}
 */
export const countPendingBannerAnchors = (anchors, lastDismissedAt) => {
  if (!Array.isArray(anchors)) return 0;
  let cutoff = -Infinity;
  if (typeof lastDismissedAt === 'string') {
    const parsed = Date.parse(lastDismissedAt);
    if (Number.isFinite(parsed)) cutoff = parsed;
  }
  let count = 0;
  for (const anchor of anchors) {
    if (!anchor || typeof anchor !== 'object') continue;
    if (anchor.status !== 'retired') continue;
    const op = anchor.operator || {};
    if (op.lastOverrideBy !== 'system') continue;
    if (op.overrideReason !== 'auto-retire') continue;
    const at = op.lastOverrideAt;
    if (typeof at !== 'string') continue;
    const parsed = Date.parse(at);
    if (!Number.isFinite(parsed)) continue;
    if (parsed > cutoff) count += 1;
  }
  return count;
};

// ───────────────────────────────────────────────────────────────────────────
// Hook
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} opts
 * @param {Object[]} opts.anchors                — current anchor array
 * @param {Function} opts.dispatchAnchorLibrary  — reducer dispatch
 * @param {string|null} opts.sessionId           — current session id (used in evaluator context)
 * @param {number|null} opts.sessionEndTime      — null while session active; ms timestamp when ended
 * @param {Object[]} [opts.sessionHistory]       — optional prior session-close gap readings
 * @param {() => string} [opts.now]              — overridable timestamp source for tests
 * @returns {{
 *   pendingBannerCount: number,
 *   dismissBanner: () => void,
 * }}
 */
export const useAnchorAutoRetire = ({
  anchors,
  dispatchAnchorLibrary,
  sessionId,
  sessionEndTime,
  sessionHistory,
  now,
} = {}) => {
  // Track which sessionEndTime we've already evaluated. Prevents:
  //   - Double-firing under React StrictMode mount/unmount/remount.
  //   - Re-evaluation when an unrelated re-render happens after session-close.
  const lastEvaluatedEndTimeRef = useRef(null);

  // Hydrate dismissal timestamp from localStorage on mount; refresh on dismiss.
  const [dismissedAt, setDismissedAt] = useState(() => readBannerDismissedAt());

  // Run evaluation on session-end transition (null → set).
  useEffect(() => {
    if (typeof sessionEndTime !== 'number' || !Number.isFinite(sessionEndTime)) return;
    if (lastEvaluatedEndTimeRef.current === sessionEndTime) return;
    if (typeof dispatchAnchorLibrary !== 'function') return;
    if (!Array.isArray(anchors) || anchors.length === 0) {
      // No anchors to evaluate — record that we processed this end-time so we
      // don't try again on re-render.
      lastEvaluatedEndTimeRef.current = sessionEndTime;
      return;
    }

    const ts = (typeof now === 'function' ? now() : new Date().toISOString());
    const context = {
      sessionId: typeof sessionId === 'string' ? sessionId : '',
      currentDate: ts,
      ...(Array.isArray(sessionHistory) ? { sessionHistory } : {}),
    };

    const { transitions } = evaluateAllAnchors(anchors, context);

    for (const decision of transitions) {
      const priorAnchor = anchors.find((a) => a && a.id === decision.anchorId);
      if (!priorAnchor) continue;
      const updated = buildAutoRetirePayload(priorAnchor, decision.toStatus, ts);
      try {
        dispatchAnchorLibrary({
          type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_OVERRIDDEN,
          payload: { anchor: updated },
        });
      } catch {
        // Reducer dispatch should not throw; swallowing prevents one bad
        // anchor from blocking the rest of the batch. Caller surfaces error
        // toast if needed (out of scope for orchestrator).
      }
    }

    lastEvaluatedEndTimeRef.current = sessionEndTime;
  }, [
    sessionEndTime,
    anchors,
    dispatchAnchorLibrary,
    sessionId,
    sessionHistory,
    now,
  ]);

  // Banner pending-count derived from anchor state + dismissal timestamp.
  const pendingBannerCount = useMemo(
    () => countPendingBannerAnchors(anchors, dismissedAt),
    [anchors, dismissedAt],
  );

  // Dismiss callback: writes localStorage + bumps state to recompute count.
  const dismissBanner = useCallback(() => {
    const ts = (typeof now === 'function' ? now() : new Date().toISOString());
    writeBannerDismissedAt(ts);
    setDismissedAt(ts);
  }, [now]);

  return {
    pendingBannerCount,
    dismissBanner,
  };
};

export default useAnchorAutoRetire;
