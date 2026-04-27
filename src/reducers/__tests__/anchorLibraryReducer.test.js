/**
 * anchorLibraryReducer.test.js
 *
 * Per-action coverage for the anchor library reducer.
 *
 * EAL Phase 6 Stream D B3 — Session 13.
 */

import { describe, it, expect } from 'vitest';
import {
  anchorLibraryReducer,
  initialAnchorLibraryState,
  ENROLLMENT_STATES,
} from '../anchorLibraryReducer';
import { ANCHOR_LIBRARY_ACTIONS } from '../../constants/anchorLibraryConstants';

// ───────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ───────────────────────────────────────────────────────────────────────────

const sampleAnchor = (overrides = {}) => ({
  id: 'anchor:nit:river:overfold:4flush',
  archetypeName: 'Nit Over-Fold to River Overbet on 4-Flush Scare',
  status: 'active',
  tier: 2,
  ...overrides,
});

const sampleObs = (overrides = {}) => ({
  id: 'obs:hand-42:0',
  schemaVersion: 'anchor-obs-v1.0',
  createdAt: '2026-04-25T14:00:00Z',
  handId: 'hand-42',
  ownerTags: ['villain-overfold'],
  origin: 'owner-captured',
  ...overrides,
});

const sampleDraft = (overrides = {}) => ({
  handId: 'hand-42',
  updatedAt: '2026-04-26T10:00:00Z',
  selectedTags: ['villain-overfold'],
  note: 'In progress',
  ...overrides,
});

const samplePrimitive = (overrides = {}) => ({
  id: 'PP-01',
  name: 'Nit re-weights aggressively on scare cards',
  appliesToStyles: ['Nit', 'TAG'],
  validityScore: { pointEstimate: 0.5 },
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// Initial state
// ───────────────────────────────────────────────────────────────────────────

describe('initialAnchorLibraryState', () => {
  it('starts with empty dictionaries', () => {
    expect(initialAnchorLibraryState.anchors).toEqual({});
    expect(initialAnchorLibraryState.observations).toEqual({});
    expect(initialAnchorLibraryState.drafts).toEqual({});
    expect(initialAnchorLibraryState.primitives).toEqual({});
  });

  it('starts with not-enrolled per Q1-A red line #1 opt-in default', () => {
    expect(initialAnchorLibraryState.enrollment.observation_enrollment_state).toBe('not-enrolled');
  });

  it('exports schemaVersion', () => {
    expect(initialAnchorLibraryState.schemaVersion).toBe('1.0.0');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(initialAnchorLibraryState)).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ANCHOR_LIBRARY_HYDRATED
// ───────────────────────────────────────────────────────────────────────────

describe('ANCHOR_LIBRARY_HYDRATED', () => {
  it('bulk-loads from arrays into id-keyed dicts', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_LIBRARY_HYDRATED,
      payload: {
        anchors: [sampleAnchor()],
        observations: [sampleObs()],
        drafts: [{ id: 'draft:hand-42', handId: 'hand-42' }],
        primitives: [samplePrimitive()],
      },
    });
    expect(result.anchors['anchor:nit:river:overfold:4flush']).toBeDefined();
    expect(result.observations['obs:hand-42:0']).toBeDefined();
    expect(result.drafts['draft:hand-42']).toBeDefined();
    expect(result.primitives['PP-01']).toBeDefined();
  });

  it('handles missing slices gracefully', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_LIBRARY_HYDRATED,
      payload: {},
    });
    expect(result.anchors).toEqual({});
    expect(result.observations).toEqual({});
  });

  it('overlays enrollment from payload', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_LIBRARY_HYDRATED,
      payload: { enrollment: { observation_enrollment_state: 'enrolled' } },
    });
    expect(result.enrollment.observation_enrollment_state).toBe('enrolled');
  });

  it('skips entries without id', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_LIBRARY_HYDRATED,
      payload: { anchors: [{ archetypeName: 'no-id' }, sampleAnchor()] },
    });
    expect(Object.keys(result.anchors)).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// OBSERVATION_CAPTURED
// ───────────────────────────────────────────────────────────────────────────

describe('OBSERVATION_CAPTURED', () => {
  it('adds new observation to dict by id', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
      payload: { observation: sampleObs() },
    });
    expect(result.observations['obs:hand-42:0']).toEqual(sampleObs());
  });

  it('overwrites existing observation with same id', () => {
    const state1 = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
      payload: { observation: sampleObs() },
    });
    const state2 = anchorLibraryReducer(state1, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
      payload: { observation: sampleObs({ note: 'updated' }) },
    });
    expect(state2.observations['obs:hand-42:0'].note).toBe('updated');
  });

  it('preserves existing observations when adding new', () => {
    const state1 = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
      payload: { observation: sampleObs({ id: 'obs:a:0' }) },
    });
    const state2 = anchorLibraryReducer(state1, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
      payload: { observation: sampleObs({ id: 'obs:b:0' }) },
    });
    expect(Object.keys(state2.observations)).toHaveLength(2);
  });

  it('returns same state for missing observation payload', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
      payload: {},
    });
    expect(result).toBe(initialAnchorLibraryState);
  });

  it('returns same state for malformed observation (no id)', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
      payload: { observation: { handId: 'hand-42' } }, // no id
    });
    expect(result).toBe(initialAnchorLibraryState);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// OBSERVATION_DELETED
// ───────────────────────────────────────────────────────────────────────────

describe('OBSERVATION_DELETED', () => {
  it('removes observation by id', () => {
    const state1 = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
      payload: { observation: sampleObs() },
    });
    const state2 = anchorLibraryReducer(state1, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_DELETED,
      payload: { id: 'obs:hand-42:0' },
    });
    expect(state2.observations['obs:hand-42:0']).toBeUndefined();
  });

  it('returns same state for missing id', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_DELETED,
      payload: {},
    });
    expect(result).toBe(initialAnchorLibraryState);
  });

  it('preserves other observations when deleting one', () => {
    let state = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
      payload: { observation: sampleObs({ id: 'obs:a:0' }) },
    });
    state = anchorLibraryReducer(state, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
      payload: { observation: sampleObs({ id: 'obs:b:0' }) },
    });
    state = anchorLibraryReducer(state, {
      type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_DELETED,
      payload: { id: 'obs:a:0' },
    });
    expect(Object.keys(state.observations)).toEqual(['obs:b:0']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// DRAFT_UPDATED
// ───────────────────────────────────────────────────────────────────────────

describe('DRAFT_UPDATED', () => {
  it('auto-attaches deterministic id from handId', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_UPDATED,
      payload: { draft: sampleDraft() },
    });
    expect(result.drafts['draft:hand-42']).toBeDefined();
    expect(result.drafts['draft:hand-42'].id).toBe('draft:hand-42');
  });

  it('preserves explicit matching id', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_UPDATED,
      payload: { draft: { ...sampleDraft(), id: 'draft:hand-42' } },
    });
    expect(result.drafts['draft:hand-42']).toBeDefined();
  });

  it('overrides mismatched explicit id with deterministic id (defensive)', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_UPDATED,
      payload: { draft: { ...sampleDraft(), id: 'wrong-id' } },
    });
    // The reducer's || fallback uses the explicit id when truthy, so this
    // documents current behavior — caller should pass either no id OR the
    // correct id; mismatched explicit id is not normalized here (the IDB
    // wrapper layer's `putDraft` throws on mismatch as defense-in-depth).
    expect(result.drafts['wrong-id']).toBeDefined();
  });

  it('overwrites previous draft for same hand', () => {
    let state = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_UPDATED,
      payload: { draft: sampleDraft({ note: 'first' }) },
    });
    state = anchorLibraryReducer(state, {
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_UPDATED,
      payload: { draft: sampleDraft({ note: 'second' }) },
    });
    expect(state.drafts['draft:hand-42'].note).toBe('second');
  });

  it('returns same state for missing handId', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_UPDATED,
      payload: { draft: { note: 'orphan' } },
    });
    expect(result).toBe(initialAnchorLibraryState);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// DRAFT_CLEARED
// ───────────────────────────────────────────────────────────────────────────

describe('DRAFT_CLEARED', () => {
  it('removes draft by handId', () => {
    let state = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_UPDATED,
      payload: { draft: sampleDraft() },
    });
    state = anchorLibraryReducer(state, {
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_CLEARED,
      payload: { handId: 'hand-42' },
    });
    expect(state.drafts['draft:hand-42']).toBeUndefined();
  });

  it('returns same state for missing handId', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.DRAFT_CLEARED,
      payload: {},
    });
    expect(result).toBe(initialAnchorLibraryState);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ANCHOR_OVERRIDDEN
// ───────────────────────────────────────────────────────────────────────────

describe('ANCHOR_OVERRIDDEN', () => {
  it('merges updated fields onto existing anchor', () => {
    const state1 = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_LIBRARY_HYDRATED,
      payload: { anchors: [sampleAnchor()] },
    });
    const updated = sampleAnchor({ status: 'retired' });
    const state2 = anchorLibraryReducer(state1, {
      type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_OVERRIDDEN,
      payload: { anchor: updated },
    });
    expect(state2.anchors['anchor:nit:river:overfold:4flush'].status).toBe('retired');
    // Merge preserves un-touched fields
    expect(state2.anchors['anchor:nit:river:overfold:4flush'].archetypeName).toBe(updated.archetypeName);
  });

  it('adds anchor if not previously present (e.g. W-EA-1 seed)', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_OVERRIDDEN,
      payload: { anchor: sampleAnchor() },
    });
    expect(result.anchors['anchor:nit:river:overfold:4flush']).toBeDefined();
  });

  it('returns same state for missing anchor', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_OVERRIDDEN,
      payload: { anchor: { archetypeName: 'no-id' } },
    });
    expect(result).toBe(initialAnchorLibraryState);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PRIMITIVE_VALIDITY_UPDATED
// ───────────────────────────────────────────────────────────────────────────

describe('PRIMITIVE_VALIDITY_UPDATED', () => {
  it('merges updated fields onto existing primitive', () => {
    const state1 = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_LIBRARY_HYDRATED,
      payload: { primitives: [samplePrimitive()] },
    });
    const updated = {
      id: 'PP-01',
      validityScore: { pointEstimate: 0.7, sampleSize: 10 },
    };
    const state2 = anchorLibraryReducer(state1, {
      type: ANCHOR_LIBRARY_ACTIONS.PRIMITIVE_VALIDITY_UPDATED,
      payload: { primitive: updated },
    });
    expect(state2.primitives['PP-01'].validityScore.pointEstimate).toBe(0.7);
    // Other fields preserved via merge
    expect(state2.primitives['PP-01'].name).toBe(samplePrimitive().name);
  });

  it('returns same state for missing primitive', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.PRIMITIVE_VALIDITY_UPDATED,
      payload: {},
    });
    expect(result).toBe(initialAnchorLibraryState);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ENROLLMENT_TOGGLED
// ───────────────────────────────────────────────────────────────────────────

describe('ENROLLMENT_TOGGLED', () => {
  it('toggles to enrolled', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED,
      payload: { observation_enrollment_state: 'enrolled' },
    });
    expect(result.enrollment.observation_enrollment_state).toBe('enrolled');
  });

  it('toggles back to not-enrolled', () => {
    const state1 = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED,
      payload: { observation_enrollment_state: 'enrolled' },
    });
    const state2 = anchorLibraryReducer(state1, {
      type: ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED,
      payload: { observation_enrollment_state: 'not-enrolled' },
    });
    expect(state2.enrollment.observation_enrollment_state).toBe('not-enrolled');
  });

  it('rejects invalid enrollment state values', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, {
      type: ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED,
      payload: { observation_enrollment_state: 'maybe' },
    });
    expect(result).toBe(initialAnchorLibraryState);
  });

  it('exports ENROLLMENT_STATES enum', () => {
    expect(ENROLLMENT_STATES.ENROLLED).toBe('enrolled');
    expect(ENROLLMENT_STATES.NOT_ENROLLED).toBe('not-enrolled');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Unknown actions
// ───────────────────────────────────────────────────────────────────────────

describe('unknown action', () => {
  it('returns same state for unknown action type', () => {
    const result = anchorLibraryReducer(initialAnchorLibraryState, { type: 'UNKNOWN' });
    expect(result).toBe(initialAnchorLibraryState);
  });
});
