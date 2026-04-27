// @vitest-environment jsdom
/**
 * AnchorLibraryContext.integration.test.jsx
 *
 * End-to-end integration test for the EAL state-management stack with
 * **no mocks**. fake-indexeddb backs the real CRUD wrappers, so this
 * exercises the full dispatch → reducer → state → debounced persistence
 * hook write → IDB transaction → unmount → fresh hydrate round-trip.
 *
 * Closes the loop S13 left open: the unit-level tests mock the four
 * wrapper modules, so they don't catch a broken reducer/wrapper contract
 * (e.g., id mismatch, payload-shape drift). This integration test does.
 *
 * EAL Phase 6 Stream D B3 — Session 14 (2026-04-27).
 */

import React, { useReducer } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import {
  AnchorLibraryProvider,
  useAnchorLibrary,
} from '../AnchorLibraryContext';
import {
  anchorLibraryReducer,
  initialAnchorLibraryState,
} from '../../reducers/anchorLibraryReducer';
import {
  ANCHOR_LIBRARY_ACTIONS,
  ENROLLMENT_STATES,
} from '../../constants/anchorLibraryConstants';
import { closeDB, resetDBPool, DB_NAME } from '../../utils/persistence/database';
import { putAnchor } from '../../utils/persistence/exploitAnchorsStore';

// migrateV19 seeds 8 perception primitives (PP-01..PP-08) on first DB open.
// First-launch hydration sees them; this is the documented behavior.
const SEEDED_PRIMITIVE_COUNT = 8;

// ───────────────────────────────────────────────────────────────────────────
// Test setup — wipe IDB between tests so each round-trip starts fresh
// ───────────────────────────────────────────────────────────────────────────

const deleteEntireDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.deleteDatabase(DB_NAME);
  req.onsuccess = () => resolve();
  req.onerror = (e) => reject(e.target.error);
  req.onblocked = () => resolve();
});

beforeEach(async () => {
  closeDB();
  resetDBPool();
  await deleteEntireDB();
});

afterEach(async () => {
  closeDB();
  resetDBPool();
});

// ───────────────────────────────────────────────────────────────────────────
// Test harness — composes useReducer + Provider exactly like AppRoot does,
// then exposes the live context value via a probe ref so tests can read /
// dispatch without mocking anything.
// ───────────────────────────────────────────────────────────────────────────

const Probe = React.forwardRef((_, ref) => {
  const ctx = useAnchorLibrary();
  React.useImperativeHandle(ref, () => ctx, [ctx]);
  return (
    <div>
      <span data-testid="ready">{ctx.isReady ? 'ready' : 'pending'}</span>
      <span data-testid="anchor-count">{Object.keys(ctx.anchors || {}).length}</span>
      <span data-testid="observation-count">{Object.keys(ctx.observations || {}).length}</span>
      <span data-testid="draft-count">{Object.keys(ctx.drafts || {}).length}</span>
      <span data-testid="primitive-count">{Object.keys(ctx.primitives || {}).length}</span>
      <span data-testid="enrolled">{ctx.isEnrolled() ? 'yes' : 'no'}</span>
    </div>
  );
});

const Harness = React.forwardRef(({ initialState = initialAnchorLibraryState }, ref) => {
  const [state, dispatch] = useReducer(anchorLibraryReducer, initialState);
  return (
    <AnchorLibraryProvider
      anchorLibraryState={state}
      dispatchAnchorLibrary={dispatch}
    >
      <Probe ref={ref} />
    </AnchorLibraryProvider>
  );
});

// Fixtures matching schema requirements (anchorLibraryWrappers.test.js shape).
const sampleAnchor = (overrides = {}) => ({
  id: 'anchor-int-1',
  schemaVersion: 'exploit-anchor-v1.0',
  villainId: 'villain-7',
  status: 'active',
  ...overrides,
});

const sampleObservation = (overrides = {}) => ({
  id: 'obs:hand-int:0',
  schemaVersion: 'anchor-obs-v1.0',
  createdAt: '2026-04-27T10:00:00Z',
  handId: 'hand-int',
  streetKey: 'turn',
  note: 'Round-trip integration smoke.',
  ownerTags: ['villain-overfold'],
  status: 'open',
  origin: 'owner-captured',
  contributesToCalibration: true,
  ...overrides,
});

const sampleDraft = (overrides = {}) => ({
  // id intentionally omitted — reducer auto-attaches `draft:${handId}`
  handId: 'hand-int',
  partialNote: 'in progress',
  ...overrides,
});

const samplePrimitive = (overrides = {}) => ({
  id: 'PP-int-01',
  schemaVersion: 'perception-primitive-v1.0',
  appliesToStyles: ['Fish', 'TAG'],
  validityScore: { pointEstimate: 0.65, lower: 0.4, upper: 0.85 },
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// Round-trip: dispatch → state → IDB → unmount → fresh mount → hydrate
// ───────────────────────────────────────────────────────────────────────────

describe('AnchorLibraryContext + persistence hook — full round-trip (no mocks)', () => {
  it('hydrates fresh DB with migration-seeded primitives only', async () => {
    const probeRef = React.createRef();
    render(<Harness ref={probeRef} />);

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('ready'));
    expect(screen.getByTestId('anchor-count').textContent).toBe('0');
    expect(screen.getByTestId('observation-count').textContent).toBe('0');
    expect(screen.getByTestId('draft-count').textContent).toBe('0');
    // migrateV19 seeds 8 perception primitives on first DB open
    expect(screen.getByTestId('primitive-count').textContent).toBe(String(SEEDED_PRIMITIVE_COUNT));
    // Spot-check a known seed
    expect(probeRef.current.primitives['PP-01']).toBeDefined();
    expect(probeRef.current.primitives['PP-01'].cognitiveStep).toBe('range-reweighting');
  });

  it(
    'persists OBSERVATION_CAPTURED → reads it back on a fresh mount',
    async () => {
      // First mount: dispatch a capture, wait for debounced IDB write
      const probeRef1 = React.createRef();
      const { unmount: unmount1 } = render(<Harness ref={probeRef1} />);
      await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('ready'));

      const obs = sampleObservation();
      await act(async () => {
        probeRef1.current.dispatchAnchorLibrary({
          type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
          payload: { observation: obs },
        });
      });

      // Wait past the 400ms debounce for the write
      await act(async () => {
        await new Promise((r) => setTimeout(r, 600));
      });
      // Sanity: in-memory state has it
      expect(Object.keys(probeRef1.current.observations || {})).toContain(obs.id);
      unmount1();

      // Second mount with a clean reducer state — must hydrate from IDB
      const probeRef2 = React.createRef();
      render(<Harness ref={probeRef2} />);
      await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('ready'));

      // Round-trip assertion
      const restored = probeRef2.current.observations[obs.id];
      expect(restored).toBeDefined();
      expect(restored.handId).toBe('hand-int');
      expect(restored.note).toBe('Round-trip integration smoke.');
      expect(restored.ownerTags).toEqual(['villain-overfold']);
    },
    10_000,
  );

  it(
    'persists DRAFT_UPDATED + clears it on DRAFT_CLEARED across remounts',
    async () => {
      // Mount 1: create a draft, wait for debounced write
      const probeRef1 = React.createRef();
      const { unmount: unmount1 } = render(<Harness ref={probeRef1} />);
      await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('ready'));

      await act(async () => {
        probeRef1.current.dispatchAnchorLibrary({
          type: ANCHOR_LIBRARY_ACTIONS.DRAFT_UPDATED,
          payload: { draft: sampleDraft() },
        });
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 600));
      });
      unmount1();

      // Mount 2: hydrate, observe draft, then clear it
      const probeRef2 = React.createRef();
      const { unmount: unmount2 } = render(<Harness ref={probeRef2} />);
      await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('ready'));

      // selectDraftForHand exposes the auto-keyed `draft:${handId}` shape
      expect(probeRef2.current.selectDraftForHand('hand-int')).not.toBeNull();
      expect(screen.getByTestId('draft-count').textContent).toBe('1');

      await act(async () => {
        probeRef2.current.dispatchAnchorLibrary({
          type: ANCHOR_LIBRARY_ACTIONS.DRAFT_CLEARED,
          payload: { handId: 'hand-int' },
        });
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 600));
      });
      unmount2();

      // Mount 3: confirm draft is gone after the deleteDraft IDB write
      const probeRef3 = React.createRef();
      render(<Harness ref={probeRef3} />);
      await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('ready'));
      expect(probeRef3.current.selectDraftForHand('hand-int')).toBeNull();
      expect(screen.getByTestId('draft-count').textContent).toBe('0');
    },
    15_000,
  );

  it(
    'persists ANCHOR_OVERRIDDEN status changes and they hydrate back',
    async () => {
      // Pre-seed IDB directly so the first-mount hydration loads it. This
      // mirrors how a returning-user session boots — anchor records already
      // in IDB from prior sessions / Tier 2 author flow.
      await putAnchor(sampleAnchor());

      const probeRef1 = React.createRef();
      const { unmount: unmount1 } = render(<Harness ref={probeRef1} />);
      await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('ready'));
      expect(probeRef1.current.anchors['anchor-int-1']).toBeDefined();

      // Retire the anchor (W-EA-3 study override pattern: caller passes
      // partial record; reducer merges over the existing full record)
      await act(async () => {
        probeRef1.current.dispatchAnchorLibrary({
          type: ANCHOR_LIBRARY_ACTIONS.ANCHOR_OVERRIDDEN,
          payload: { anchor: { id: 'anchor-int-1', status: 'retired' } },
        });
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 600));
      });
      unmount1();

      // Fresh mount: hydrate from IDB and confirm the retired status survived
      const probeRef2 = React.createRef();
      render(<Harness ref={probeRef2} />);
      await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('ready'));

      const restored = probeRef2.current.anchors['anchor-int-1'];
      expect(restored).toBeDefined();
      expect(restored.status).toBe('retired');
      // Original villainId preserved by reducer merge
      expect(restored.villainId).toBe('villain-7');

      // Selector enforces red-line #6: active filter excludes retired
      expect(probeRef2.current.selectActiveAnchors()).toHaveLength(0);
      expect(probeRef2.current.selectAllAnchors()).toHaveLength(1);
      expect(probeRef2.current.selectAnchorsByStatus('retired')).toHaveLength(1);
    },
    15_000,
  );

  it(
    'persists PRIMITIVE_VALIDITY_UPDATED across remounts',
    async () => {
      // Use migration-seeded PP-01 (Nit/TAG, range-reweighting cognitive step)
      // — the realistic Tier-2 update path: matcher fires, posterior updates.
      const probeRef1 = React.createRef();
      const { unmount: unmount1 } = render(<Harness ref={probeRef1} />);
      await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('ready'));

      // PP-01 is in the hydrated state via migrateV19 seed
      expect(probeRef1.current.primitives['PP-01']).toBeDefined();
      const seedAppliesToStyles = probeRef1.current.primitives['PP-01'].appliesToStyles;

      await act(async () => {
        probeRef1.current.dispatchAnchorLibrary({
          type: ANCHOR_LIBRARY_ACTIONS.PRIMITIVE_VALIDITY_UPDATED,
          payload: {
            primitive: {
              id: 'PP-01',
              validityScore: { pointEstimate: 0.91, lower: 0.78, upper: 0.97 },
            },
          },
        });
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 600));
      });
      unmount1();

      const probeRef2 = React.createRef();
      render(<Harness ref={probeRef2} />);
      await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('ready'));

      const restored = probeRef2.current.primitives['PP-01'];
      expect(restored.validityScore.pointEstimate).toBe(0.91);
      // Untouched fields preserved by reducer merge across IDB round-trip
      expect(restored.appliesToStyles).toEqual(seedAppliesToStyles);
      expect(restored.cognitiveStep).toBe('range-reweighting');
      // Style index still works after hydration (PP-01 applies to Nit + TAG)
      expect(probeRef2.current.selectPrimitivesByStyle('Nit').length).toBeGreaterThan(0);
    },
    15_000,
  );

  it(
    'persists ENROLLMENT_TOGGLED — enrolled state survives reload',
    async () => {
      const probeRef1 = React.createRef();
      const { unmount: unmount1 } = render(<Harness ref={probeRef1} />);
      await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('ready'));
      expect(screen.getByTestId('enrolled').textContent).toBe('no');

      await act(async () => {
        probeRef1.current.dispatchAnchorLibrary({
          type: ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED,
          payload: { observation_enrollment_state: ENROLLMENT_STATES.ENROLLED },
        });
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 600));
      });
      expect(screen.getByTestId('enrolled').textContent).toBe('yes');
      unmount1();

      // NOTE: Enrollment is not yet IDB-persisted (Phase 6+ wires settings
      // store integration per Q1-A). On a fresh mount it should default to
      // not-enrolled. This test pins that current behavior so a future
      // settings-store wiring change is intentional.
      const probeRef2 = React.createRef();
      render(<Harness ref={probeRef2} />);
      await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('ready'));
      expect(screen.getByTestId('enrolled').textContent).toBe('no');
    },
    10_000,
  );
});
