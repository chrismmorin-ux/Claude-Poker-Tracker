/**
 * sessionRollupSelectors.js — per-session anchor activity aggregation.
 *
 * Pure selector layer for the SessionsView row-expand rollup (SPR-061 / WS-171).
 * Bridges hand→session linkage via caller-supplied `hands` array, then
 * filters observations by handId set and anchors by auto-retire window.
 *
 * Per `docs/design/surfaces/session-review-anchor-rollup.md` §SessionsView
 * row-expand variant (added SPR-061) + EAL CLAUDE.md core principle 7
 * (signal separation — AP-08 invariant).
 *
 * **AP-08 invariant:** matcher-system observations and owner-captured
 * observations are returned in **separate arrays**. They are never summed,
 * blended, or rendered as a unified count at the selector layer. The caller
 * (SessionAnchorRollup component) renders them as distinct sections.
 *
 * Pure module — no IO, no React. Caller supplies all inputs.
 *
 * EAL Phase 6 — SPR-061 / WS-171.
 */

import { OBSERVATION_ORIGINS } from '../../constants/anchorLibraryConstants';

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AnchorActivity
 * @property {Object[]} matcherFired   — observations with origin='matcher-system' filtered to this session
 * @property {Object[]} ownerCaptured  — observations with origin='owner-captured' filtered to this session
 * @property {string[]} distinctAnchorIds — union of anchor ids referenced across both observation arrays (sorted, dedup)
 * @property {Object[]} autoRetired    — anchors whose auto-retire transition fell within this session's window
 */

/**
 * Compute the anchor activity bundle for a single session.
 *
 * @param {Object} args
 * @param {string} args.sessionId       — session id (used for label / identification only; not for filtering)
 * @param {number} args.sessionStart    — ms timestamp of session start (inclusive)
 * @param {number} args.sessionEnd      — ms timestamp of session end (inclusive); null/undefined treated as "open" (now)
 * @param {Object[]} args.hands         — hands belonging to this session (caller filters via getHandsBySessionId)
 * @param {Object[]} args.observations  — flat array of all anchor observations (caller passes all; we filter by handId set)
 * @param {Object[]} args.anchors       — flat array of all anchors (caller passes all; we filter for auto-retire window)
 * @returns {AnchorActivity}
 */
export const selectAnchorActivityForSession = ({
  sessionId, // eslint-disable-line no-unused-vars — present for caller API symmetry / future debugging
  sessionStart,
  sessionEnd,
  hands,
  observations,
  anchors,
} = {}) => {
  // Build handId set (string-coerced for tolerance — handId from IDB can be number or string).
  const handIdSet = new Set();
  if (Array.isArray(hands)) {
    for (const hand of hands) {
      if (!hand || typeof hand !== 'object') continue;
      const id = hand.handId;
      if (id === null || id === undefined) continue;
      handIdSet.add(String(id));
    }
  }

  // Filter observations to this session's hand set, then split by origin.
  // AP-08: never push to a unified array; arrays are constructed separately.
  const matcherFired = [];
  const ownerCaptured = [];

  if (Array.isArray(observations) && handIdSet.size > 0) {
    for (const obs of observations) {
      if (!obs || typeof obs !== 'object') continue;
      const obsHandId = obs.handId;
      if (obsHandId === null || obsHandId === undefined) continue;
      if (!handIdSet.has(String(obsHandId))) continue;

      if (obs.origin === OBSERVATION_ORIGINS.MATCHER_SYSTEM) {
        matcherFired.push(obs);
      } else if (obs.origin === OBSERVATION_ORIGINS.OWNER_CAPTURED) {
        ownerCaptured.push(obs);
      }
      // Unknown origin: dropped silently (forward-compat with future origin enums).
    }
  }

  // Distinct anchor ids referenced across either observation array.
  const distinctIds = new Set();
  for (const obs of matcherFired) {
    if (typeof obs.anchorId === 'string' && obs.anchorId.length > 0) distinctIds.add(obs.anchorId);
  }
  for (const obs of ownerCaptured) {
    if (typeof obs.anchorId === 'string' && obs.anchorId.length > 0) distinctIds.add(obs.anchorId);
  }
  const distinctAnchorIds = Array.from(distinctIds).sort();

  // Auto-retire transitions: anchors stamped by useAnchorAutoRetire (SPR-060)
  // with operator.lastOverrideBy='system' AND overrideReason='auto-retire'
  // AND lastOverrideAt within [sessionStart, sessionEnd].
  // Tolerates open session (no end time): bound is +Infinity.
  const lowerMs = (typeof sessionStart === 'number' && Number.isFinite(sessionStart)) ? sessionStart : -Infinity;
  const upperMs = (typeof sessionEnd === 'number' && Number.isFinite(sessionEnd)) ? sessionEnd : Infinity;

  const autoRetired = [];
  if (Array.isArray(anchors)) {
    for (const anchor of anchors) {
      if (!anchor || typeof anchor !== 'object') continue;
      const op = anchor.operator;
      if (!op || typeof op !== 'object') continue;
      if (op.lastOverrideBy !== 'system') continue;
      if (op.overrideReason !== 'auto-retire') continue;
      const at = op.lastOverrideAt;
      if (typeof at !== 'string') continue;
      const ms = Date.parse(at);
      if (!Number.isFinite(ms)) continue;
      if (ms < lowerMs || ms > upperMs) continue;
      autoRetired.push(anchor);
    }
  }

  return {
    matcherFired,
    ownerCaptured,
    distinctAnchorIds,
    autoRetired,
  };
};

export default selectAnchorActivityForSession;
