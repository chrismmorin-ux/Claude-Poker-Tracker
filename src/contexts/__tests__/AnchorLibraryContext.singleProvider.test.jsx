// @vitest-environment jsdom
/**
 * AnchorLibraryContext.singleProvider.test.jsx
 *
 * Regression guard for WS-020 (reframed at SPR-113, 2026-06-10).
 *
 * The original ticket asked for a test reproducing a persistence-hook
 * "double-load race" when the Anchor Library and Calibration Dashboard surfaces
 * mount simultaneously. That race is architecturally impossible:
 *
 *   - `AnchorLibraryProvider` is mounted EXACTLY ONCE at app root
 *     (src/AppProviders.jsx).
 *   - `useAnchorLibraryPersistence` is composed INSIDE that single provider, so
 *     there is one persistence-hook instance no matter how many surfaces consume
 *     the context.
 *   - Both `AnchorLibraryView` and `CalibrationDashboardView` are descendants
 *     reading the same shared context (see AnchorLibraryContext.jsx header:
 *     "per Gate 2 Stage D #5 hook-hoisting concerns").
 *
 * Rather than reproduce an impossible race, this LOCKS IN the architecture that
 * prevents it. It fails loud if a future refactor moves persistence per-view
 * (which would reintroduce the double-load race the ticket feared) or breaks the
 * mount-once hydration contract:
 *
 *   1. Two surfaces under one provider => hydration runs EXACTLY ONCE
 *      (each getAll wrapper called once — not once-per-surface, and not
 *      re-fired on subsequent state changes).
 *   2. A write dispatched from one surface is visible to the other WITHIN ONE
 *      render tick (single shared store — no cross-surface staleness).
 *
 * This satisfies WS-020's three accept criteria meaningfully:
 *   - "Test passes"
 *   - "single persistence-hook load"      -> assertion (1)
 *   - "cross-surface-write visibility in 1 render tick" -> assertion (2)
 */

import React, { useReducer } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';

// Mock the 4 persistence wrapper modules (mirrors useAnchorLibraryPersistence.test.js).
// We only need the getAll* reads to be counting spies; writes resolve void.
vi.mock('../../utils/persistence/exploitAnchorsStore', () => ({
  getAllAnchors: vi.fn(),
  putAnchor: vi.fn(),
}));
vi.mock('../../utils/persistence/anchorObservationsStore', () => ({
  getAllObservations: vi.fn(),
  putObservation: vi.fn(),
  deleteObservation: vi.fn(),
}));
vi.mock('../../utils/persistence/anchorObservationDraftsStore', () => ({
  getAllDrafts: vi.fn(),
  putDraft: vi.fn(),
  deleteDraft: vi.fn(),
}));
vi.mock('../../utils/persistence/perceptionPrimitivesStore', () => ({
  getAllPrimitives: vi.fn(),
  putPrimitive: vi.fn(),
}));

import {
  AnchorLibraryProvider,
  useAnchorLibrary,
} from '../AnchorLibraryContext';
import {
  anchorLibraryReducer,
  initialAnchorLibraryState,
} from '../../reducers/anchorLibraryReducer';
import { ANCHOR_LIBRARY_ACTIONS } from '../../constants/anchorLibraryConstants';
import { getAllAnchors, putAnchor } from '../../utils/persistence/exploitAnchorsStore';
import { getAllObservations, putObservation } from '../../utils/persistence/anchorObservationsStore';
import { getAllDrafts, putDraft } from '../../utils/persistence/anchorObservationDraftsStore';
import { getAllPrimitives, putPrimitive } from '../../utils/persistence/perceptionPrimitivesStore';

beforeEach(() => {
  vi.clearAllMocks();
  getAllAnchors.mockResolvedValue([]);
  getAllObservations.mockResolvedValue([]);
  getAllDrafts.mockResolvedValue([]);
  getAllPrimitives.mockResolvedValue([]);
  putAnchor.mockResolvedValue();
  putObservation.mockResolvedValue();
  putDraft.mockResolvedValue();
  putPrimitive.mockResolvedValue();
});

// ───────────────────────────────────────────────────────────────────────────
// Harness — one provider, two distinct consumer surfaces (mirrors AppRoot:
// AnchorLibraryView + CalibrationDashboardView both descend from the single
// app-level AnchorLibraryProvider). Each surface reads the shared context;
// SurfaceA renders isReady so tests can await hydration.
// ───────────────────────────────────────────────────────────────────────────

const SurfaceA = () => {
  const ctx = useAnchorLibrary();
  return (
    <div>
      <span data-testid="ready">{ctx.isReady ? 'ready' : 'pending'}</span>
      <span data-testid="surface-a-obs">{Object.keys(ctx.observations || {}).length}</span>
    </div>
  );
};

const SurfaceB = () => {
  const ctx = useAnchorLibrary();
  return <span data-testid="surface-b-obs">{Object.keys(ctx.observations || {}).length}</span>;
};

const TwoSurfaceApp = ({ dispatchRef }) => {
  const [state, dispatch] = useReducer(anchorLibraryReducer, initialAnchorLibraryState);
  // Stable dispatch from useReducer — capture once so a test can drive a write
  // "from a surface" without threading callbacks through the tree.
  if (dispatchRef) dispatchRef.current = dispatch;
  return (
    <AnchorLibraryProvider anchorLibraryState={state} dispatchAnchorLibrary={dispatch}>
      <SurfaceA />
      <SurfaceB />
    </AnchorLibraryProvider>
  );
};

const sampleObservation = (overrides = {}) => ({
  id: 'obs:cross-surface:0',
  schemaVersion: 'anchor-obs-v1.0',
  handId: 'cross-surface',
  streetKey: 'turn',
  note: 'cross-surface visibility probe',
  ownerTags: ['villain-overfold'],
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// (1) Single hydration — the architectural guarantee that makes the
//     "double-load race" impossible.
// ───────────────────────────────────────────────────────────────────────────

describe('single-provider hydration (WS-020 race prevention)', () => {
  it('hydrates exactly once when two surfaces mount under one provider', async () => {
    render(<TwoSurfaceApp />);

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('ready');
    });

    // One provider => one persistence-hook instance => one read per store.
    // If persistence were ever refactored per-view, mounting two surfaces would
    // bump these past 1 and this test would fail loud.
    expect(getAllAnchors).toHaveBeenCalledTimes(1);
    expect(getAllObservations).toHaveBeenCalledTimes(1);
    expect(getAllDrafts).toHaveBeenCalledTimes(1);
    expect(getAllPrimitives).toHaveBeenCalledTimes(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// (2) Cross-surface write visibility within one render tick + hydration stays
//     mount-once across state changes.
// ───────────────────────────────────────────────────────────────────────────

describe('cross-surface write visibility (WS-020 accept criteria)', () => {
  it('makes a write from one surface visible to the other in the same commit', async () => {
    const dispatchRef = { current: null };
    render(<TwoSurfaceApp dispatchRef={dispatchRef} />);

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('ready');
    });

    // Both surfaces start empty after the (single, empty) hydration.
    expect(screen.getByTestId('surface-a-obs').textContent).toBe('0');
    expect(screen.getByTestId('surface-b-obs').textContent).toBe('0');
    const readsAfterHydration = getAllObservations.mock.calls.length;

    // A write "from one surface" — single shared dispatch, single shared store.
    act(() => {
      dispatchRef.current({
        type: ANCHOR_LIBRARY_ACTIONS.OBSERVATION_CAPTURED,
        payload: { observation: sampleObservation() },
      });
    });

    // Visible to BOTH surfaces synchronously (one render tick, no IDB round-trip).
    expect(screen.getByTestId('surface-a-obs').textContent).toBe('1');
    expect(screen.getByTestId('surface-b-obs').textContent).toBe('1');

    // The state change must NOT retrigger hydration — mount-once invariant.
    expect(getAllObservations).toHaveBeenCalledTimes(readsAfterHydration);
  });
});
