/**
 * hooks.js — React hooks for Shape Language read-API.
 *
 * Wraps the context consumer + pure math. Per
 * `docs/design/contracts/shape-mastery.md` §Read-API contract.
 *
 * Read-only sprint scope (SPR-081):
 *   - `useShapeMasteryDecay(descriptorId, now?)` — exposes decay-adjusted
 *     posterior + days-since-validated for a single descriptor.
 *
 * Deferred (fast-follow WS):
 *   - `useShapeMasterySeederRanking()` — Discover-mode ranking (I-SM-4
 *     dependent on writers landing first).
 *   - `useShapeMasterySignalComposition(descriptorId)` — transparency
 *     panel per-row composition breakdown.
 *
 * SLS Stream D — SPR-081 / WS-040.
 */

import { useMemo } from 'react';
import { useShapeMastery } from '../../../contexts/ShapeMasteryContext';
import { applyTemporalDecay } from './temporalDecay';

/**
 * useShapeMasteryDecay — decay-adjusted posterior for a descriptor.
 *
 * Returns null for an unknown descriptor id. Otherwise returns the result
 * of `applyTemporalDecay` against the descriptor's current posterior +
 * lastValidatedAt.
 *
 * @param {string} descriptorId
 * @param {number} [now] — Override-able for testing.
 * @returns {null | {
 *   decayedAlpha: number,
 *   decayedBeta: number,
 *   daysSinceValidated: number | null,
 *   retainedEvidenceFraction: number,
 * }}
 */
export const useShapeMasteryDecay = (descriptorId, now) => {
  const { selectDescriptor } = useShapeMastery();
  const descriptor = selectDescriptor ? selectDescriptor(descriptorId) : null;
  return useMemo(() => {
    if (!descriptor || !descriptor.posterior) return null;
    return applyTemporalDecay(
      descriptor.posterior,
      descriptor.lastValidatedAt ?? null,
      now,
    );
  }, [descriptor, now]);
};
