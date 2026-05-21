/**
 * writers.js — in-code mirror of `docs/projects/exploit-anchor-library/WRITERS.md`.
 *
 * Per anchorLibrary CLAUDE.md "Core Principle #9 — Enumerable writer registry
 * (I-WR-1)": every write into the 4 EAL stores (exploitAnchors,
 * anchorObservations, anchorCandidates, perceptionPrimitives) MUST be listed
 * in WRITERS.md. This file makes that list runtime-inspectable.
 *
 * Built on `decisionSystems/registry` (SPR-078 / 2026-05-14 extraction). The
 * registry is append-only — `deregister` is intentionally absent (per
 * I-WR-1's enumeration completeness contract; once a writer is registered
 * it stays even if retired, with status tracked in WRITERS.md prose).
 *
 * **Drift test contract:** `writers.test.js` parses WRITERS.md headings of
 * the form `### W-XX-N — ...` and asserts that every parsed writer ID is
 * present in this registry. If either side adds/removes an entry without
 * the other, CI fails.
 *
 * Pure module — no IO.
 */

import { createRegistry } from '../decisionSystems/registry/createRegistry';

const writers = createRegistry({
  name: 'anchorLibraryWriters',
  requiredFields: ['id', 'store', 'fields', 'invariants'],
});

// ───────────────────────────────────────────────────────────────────────────
// exploitAnchors (4 writers)
// ───────────────────────────────────────────────────────────────────────────

writers.register({
  id: 'W-EA-1',
  store: 'exploitAnchors',
  fields: ['*all'], // Full anchor body per schema-delta §2
  invariants: ['I-WR-1', 'I-WR-2', 'I-WR-4'],
  name: 'ai-authored-seed-writer',
  phase: 'phase-5',
});

writers.register({
  id: 'W-EA-2',
  store: 'exploitAnchors',
  fields: [
    'evidence.pointEstimate',
    'evidence.credibleInterval',
    'evidence.lastUpdated',
    'validation.timesApplied',
    'validation.realizedDividend',
    'validation.lastFiredAt',
  ],
  invariants: ['I-WR-1', 'I-WR-2', 'I-WR-5'],
  name: 'matcher-evidence-updater',
  phase: 'phase-5',
});

writers.register({
  id: 'W-EA-3',
  store: 'exploitAnchors',
  fields: [
    'status',
    'operator.currentDial',
    'operator.lastOverrideAt',
    'operator.lastOverrideBy',
    'operator.overrideReason',
    'quality.reason',
  ],
  invariants: ['I-WR-1', 'I-WR-2', 'I-WR-7'],
  name: 'study-override-writer',
  phase: 'phase-5',
});

writers.register({
  id: 'W-EA-4',
  store: 'exploitAnchors',
  fields: ['*all'], // Full anchor body (same as W-EA-1)
  invariants: ['I-WR-1', 'I-WR-2'],
  name: 'phase8-library-expansion-writer',
  phase: 'phase-8',
});

// ───────────────────────────────────────────────────────────────────────────
// anchorObservations (3 writers)
// ───────────────────────────────────────────────────────────────────────────

writers.register({
  id: 'W-AO-1',
  store: 'anchorObservations',
  fields: [
    'id',
    'createdAt',
    'handId',
    'streetKey',
    'note',
    'tagEnum',
    'contributesToCalibration',
    'origin',
    'status',
  ],
  invariants: ['I-WR-1', 'I-WR-5', 'I-WR-6'],
  name: 'hand-replay-capture-writer',
  phase: 'phase-5',
});

writers.register({
  id: 'W-AO-2',
  store: 'anchorObservations',
  fields: [
    'id',
    'createdAt',
    'handId',
    'streetKey',
    'note',
    'tagEnum',
    'contributesToCalibration',
    'origin',
    'status',
    'firingMetrics',
  ],
  invariants: ['I-WR-1', 'I-WR-5'],
  name: 'matcher-system-observation-writer',
  phase: 'phase-5',
});

writers.register({
  id: 'W-AO-3',
  store: 'anchorObservations',
  fields: ['promotedToCandidateId', 'status', 'updatedAt'],
  invariants: ['I-WR-1'],
  name: 'candidate-promotion-writer',
  phase: 'phase-2',
});

// ───────────────────────────────────────────────────────────────────────────
// anchorCandidates (3 writers — W-AC-1 stub for Phase 2 forward-compat)
// ───────────────────────────────────────────────────────────────────────────

writers.register({
  id: 'W-AC-1',
  store: 'anchorCandidates',
  fields: [], // Phase 1 stub — no-op
  invariants: ['I-WR-1'],
  name: 'v18-empty-store-seed',
  phase: 'phase-1-stub',
});

writers.register({
  id: 'W-AC-2',
  store: 'anchorCandidates',
  fields: ['id', 'draftAnchor', 'sourceObservationIds', 'status', 'createdAt'],
  invariants: ['I-WR-1'],
  name: 'phase2-candidate-creator',
  phase: 'phase-2',
});

writers.register({
  id: 'W-AC-3',
  store: 'anchorCandidates',
  fields: ['status', 'resultingAnchorId', 'ownerPromotedAt'],
  invariants: ['I-WR-1'],
  name: 'owner-candidate-promotion-writer',
  phase: 'phase-2',
});

// ───────────────────────────────────────────────────────────────────────────
// perceptionPrimitives (3 writers)
// ───────────────────────────────────────────────────────────────────────────

writers.register({
  id: 'W-PP-1',
  store: 'perceptionPrimitives',
  fields: ['*all'], // Full primitive body per schema-delta §3.3
  invariants: ['I-WR-1', 'I-WR-2', 'I-WR-4'],
  name: 'migration-seed-writer',
  phase: 'phase-5',
});

writers.register({
  id: 'W-PP-2',
  store: 'perceptionPrimitives',
  fields: [
    'validityScore.pointEstimate',
    'validityScore.credibleInterval',
    'validityScore.lastUpdated',
    'validityScore.sampleSize',
  ],
  invariants: ['I-WR-1', 'I-WR-2', 'I-WR-3', 'I-WR-5'],
  name: 'tier2-validity-updater',
  phase: 'phase-5',
});

writers.register({
  id: 'W-PP-3',
  store: 'perceptionPrimitives',
  fields: ['overrideState', 'overrideReason', 'overrideAt'],
  invariants: ['I-WR-1', 'I-WR-2'],
  name: 'owner-primitive-override-writer',
  phase: 'phase-8',
});

// Lock the registry — subsequent register() calls at import time would
// indicate registry tampering. The registry itself enforces no duplicate
// IDs but exposing it as a read-only handle is the consumer contract.
export const anchorLibraryWriters = Object.freeze({
  get: (id) => writers.get(id),
  getAll: () => writers.getAll(),
  has: (id) => writers.has(id),
  forEach: (fn) => writers.forEach(fn),
  size: () => writers.size(),
});

/**
 * Convenience accessor — returns every writer registered for a given store.
 *
 * @param {string} store - 'exploitAnchors' | 'anchorObservations' | 'anchorCandidates' | 'perceptionPrimitives'
 * @returns {Array}
 */
export const getWritersForStore = (store) => writers.getAll().filter((w) => w.store === store);
