/**
 * stale-context-tick.js — Pure decision helper for the side-panel's
 * staleContext lifecycle.
 *
 * Per WS-107 (SPR-057): consolidates `staleContext` ownership to the
 * 10s interval tick. The push handler used to also write
 * `staleContext = false` (side-panel.js:547) to handle the
 * push-restores-freshness case, because the tick lacked a clear-stale
 * branch. That dual-writer pattern is the bug WS-107 fixes.
 *
 * Extracted to `shared/` per the extension's CLAUDE.md anti-pattern:
 * "Never import from side-panel.js — put testable logic outside the
 * IIFE." The pure helper is unit-tested in
 * `shared/__tests__/stale-context-tick.test.js`.
 *
 * ─── Behavior ─────────────────────────────────────────────────────────────
 *
 * Two-phase staleness model (preserved from the original tick body):
 *   - 0 to 60_000 ms      = fresh
 *   - 60_001 to 120_000   = stale (badge visible; last content kept)
 *   - 120_001+            = full clear (currentLiveContext = null)
 *
 * Decision shape:
 *   { action, renderTag } | null
 *
 * Actions:
 *   - 'full-clear'  → caller sets currentLiveContext=null,
 *                     staleContext=false, advicePendingForStreet=null
 *   - 'set-stale'   → caller sets staleContext=true
 *   - 'clear-stale' → caller sets staleContext=false (NEW BRANCH;
 *                     handles push-restores-freshness without a
 *                     separate writer in handleLiveContextPush)
 *   - null          → no-op (idempotent / no-context / boundary)
 *
 * Pure: no side effects, no clock reads. Caller passes `now` and the
 * current context + stale-flag explicitly.
 */

const STALE_THRESHOLD_MS = 60_000;
const FULL_CLEAR_THRESHOLD_MS = 120_000;

/**
 * @param {number} now                 — current timestamp (ms since epoch)
 * @param {object|null|undefined} ctx  — coordinator's currentLiveContext
 * @param {boolean} isCurrentlyStale   — coordinator.get('staleContext') === true
 * @returns {{action: string, renderTag: string}|null}
 */
export const evaluateStaleContext = (now, ctx, isCurrentlyStale) => {
  if (typeof now !== 'number' || !Number.isFinite(now)) return null;
  if (!ctx || typeof ctx !== 'object') return null;

  const receivedAt = ctx._receivedAt;
  if (typeof receivedAt !== 'number' || !Number.isFinite(receivedAt)) return null;

  const age = now - receivedAt;

  if (age > FULL_CLEAR_THRESHOLD_MS) {
    return { action: 'full-clear', renderTag: 'stale_full_clear' };
  }
  if (age > STALE_THRESHOLD_MS && !isCurrentlyStale) {
    return { action: 'set-stale', renderTag: 'stale_indicator' };
  }
  if (age <= STALE_THRESHOLD_MS && isCurrentlyStale) {
    return { action: 'clear-stale', renderTag: 'stale_cleared' };
  }
  return null;
};

export const STALE_CONTEXT_THRESHOLDS = Object.freeze({
  STALE_MS: STALE_THRESHOLD_MS,
  FULL_CLEAR_MS: FULL_CLEAR_THRESHOLD_MS,
});
