/**
 * AnchorLibraryContext.test.jsx
 *
 * Tests for AnchorLibraryProvider + useAnchorLibrary consumer hook + selector helpers.
 *
 * EAL Phase 6 Stream D B3 — Session 13.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AnchorLibraryProvider, useAnchorLibrary } from '../AnchorLibraryContext';
import {
  initialAnchorLibraryState,
  ENROLLMENT_STATES,
} from '../../constants/anchorLibraryConstants';

// Mock the persistence hook so context tests don't hit IDB
vi.mock('../../hooks/useAnchorLibraryPersistence', () => ({
  useAnchorLibraryPersistence: () => ({ isReady: true }),
}));

// Test consumer that exposes context value for assertions
const TestConsumer = ({ onValue }) => {
  const value = useAnchorLibrary();
  React.useEffect(() => {
    onValue(value);
  });
  return <div data-testid="ok">consumer-mounted</div>;
};

const renderWithProvider = (state = initialAnchorLibraryState, dispatch = vi.fn()) => {
  let captured;
  const result = render(
    <AnchorLibraryProvider anchorLibraryState={state} dispatchAnchorLibrary={dispatch}>
      <TestConsumer onValue={(v) => { captured = v; }} />
    </AnchorLibraryProvider>,
  );
  return { ...result, getValue: () => captured };
};

const sampleAnchor = (overrides = {}) => ({
  id: `anchor:${Math.random()}`,
  archetypeName: 'Test',
  status: 'active',
  ...overrides,
});

const sampleObs = (overrides = {}) => ({
  id: `obs:${Math.random()}`,
  handId: 'hand-42',
  createdAt: '2026-04-26T10:00:00Z',
  ...overrides,
});

const samplePrim = (overrides = {}) => ({
  id: 'PP-01',
  appliesToStyles: ['Nit'],
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// Provider
// ───────────────────────────────────────────────────────────────────────────

describe('AnchorLibraryProvider', () => {
  it('renders children', () => {
    renderWithProvider();
    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });

  it('exposes raw state', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().anchors).toEqual({});
    expect(getValue().observations).toEqual({});
  });

  it('exposes dispatchAnchorLibrary', () => {
    const dispatch = vi.fn();
    const { getValue } = renderWithProvider(initialAnchorLibraryState, dispatch);
    expect(getValue().dispatchAnchorLibrary).toBe(dispatch);
  });

  it('marks isReady true (mocked persistence)', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().isReady).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Hook outside provider
// ───────────────────────────────────────────────────────────────────────────

describe('useAnchorLibrary outside provider', () => {
  it('throws helpful error', () => {
    const ConsumerOutside = () => {
      useAnchorLibrary();
      return null;
    };
    // Suppress error output for cleaner test logs
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ConsumerOutside />)).toThrow(/AnchorLibraryProvider/);
    errorSpy.mockRestore();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Selector: selectAllAnchors
// ───────────────────────────────────────────────────────────────────────────

describe('selectAllAnchors', () => {
  it('returns empty array when no anchors', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().selectAllAnchors()).toEqual([]);
  });

  it('returns all anchors regardless of status (red line #6 flat-access)', () => {
    const state = {
      ...initialAnchorLibraryState,
      anchors: {
        'a-1': sampleAnchor({ id: 'a-1', status: 'active' }),
        'a-2': sampleAnchor({ id: 'a-2', status: 'retired' }),
        'a-3': sampleAnchor({ id: 'a-3', status: 'candidate' }),
      },
    };
    const { getValue } = renderWithProvider(state);
    const all = getValue().selectAllAnchors();
    expect(all).toHaveLength(3);
    const ids = all.map((a) => a.id).sort();
    expect(ids).toEqual(['a-1', 'a-2', 'a-3']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Selector: selectActiveAnchors
// ───────────────────────────────────────────────────────────────────────────

describe('selectActiveAnchors', () => {
  it('returns only active anchors', () => {
    const state = {
      ...initialAnchorLibraryState,
      anchors: {
        'a-1': sampleAnchor({ id: 'a-1', status: 'active' }),
        'a-2': sampleAnchor({ id: 'a-2', status: 'retired' }),
        'a-3': sampleAnchor({ id: 'a-3', status: 'active' }),
        'a-4': sampleAnchor({ id: 'a-4', status: 'candidate' }),
      },
    };
    const { getValue } = renderWithProvider(state);
    const active = getValue().selectActiveAnchors();
    expect(active).toHaveLength(2);
    expect(active.map((a) => a.id).sort()).toEqual(['a-1', 'a-3']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Selector: selectAnchorsByStatus
// ───────────────────────────────────────────────────────────────────────────

describe('selectAnchorsByStatus', () => {
  it('filters by status', () => {
    const state = {
      ...initialAnchorLibraryState,
      anchors: {
        'a-1': sampleAnchor({ id: 'a-1', status: 'active' }),
        'a-2': sampleAnchor({ id: 'a-2', status: 'retired' }),
      },
    };
    const { getValue } = renderWithProvider(state);
    expect(getValue().selectAnchorsByStatus('active')).toHaveLength(1);
    expect(getValue().selectAnchorsByStatus('retired')).toHaveLength(1);
    expect(getValue().selectAnchorsByStatus('candidate')).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Selector: selectObservationsByHand
// ───────────────────────────────────────────────────────────────────────────

describe('selectObservationsByHand', () => {
  it('returns observations for a given hand', () => {
    const state = {
      ...initialAnchorLibraryState,
      observations: {
        'obs:hand-42:0': sampleObs({ id: 'obs:hand-42:0', handId: 'hand-42', createdAt: '2026-04-26T10:00:00Z' }),
        'obs:hand-42:1': sampleObs({ id: 'obs:hand-42:1', handId: 'hand-42', createdAt: '2026-04-26T11:00:00Z' }),
        'obs:hand-99:0': sampleObs({ id: 'obs:hand-99:0', handId: 'hand-99' }),
      },
    };
    const { getValue } = renderWithProvider(state);
    const obs = getValue().selectObservationsByHand('hand-42');
    expect(obs).toHaveLength(2);
    // Returns chronological DESC (newest first)
    expect(obs[0].id).toBe('obs:hand-42:1');
    expect(obs[1].id).toBe('obs:hand-42:0');
  });

  it('returns empty array for hand with no observations', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().selectObservationsByHand('hand-99')).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Selector: selectDraftForHand
// ───────────────────────────────────────────────────────────────────────────

describe('selectDraftForHand', () => {
  it('returns draft for a hand if present', () => {
    const state = {
      ...initialAnchorLibraryState,
      drafts: {
        'draft:hand-42': { id: 'draft:hand-42', handId: 'hand-42', note: 'in progress' },
      },
    };
    const { getValue } = renderWithProvider(state);
    const draft = getValue().selectDraftForHand('hand-42');
    expect(draft).toBeDefined();
    expect(draft.note).toBe('in progress');
  });

  it('returns null for hand with no draft', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().selectDraftForHand('hand-42')).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Selector: selectAllPrimitives + selectPrimitivesByStyle
// ───────────────────────────────────────────────────────────────────────────

describe('selectAllPrimitives + selectPrimitivesByStyle', () => {
  it('selectAllPrimitives returns all primitives', () => {
    const state = {
      ...initialAnchorLibraryState,
      primitives: {
        'PP-01': samplePrim({ id: 'PP-01' }),
        'PP-02': samplePrim({ id: 'PP-02' }),
      },
    };
    const { getValue } = renderWithProvider(state);
    expect(getValue().selectAllPrimitives()).toHaveLength(2);
  });

  it('selectPrimitivesByStyle filters by style', () => {
    const state = {
      ...initialAnchorLibraryState,
      primitives: {
        'PP-01': samplePrim({ id: 'PP-01', appliesToStyles: ['Nit', 'TAG'] }),
        'PP-03': samplePrim({ id: 'PP-03', appliesToStyles: ['Fish'] }),
        'PP-08': samplePrim({ id: 'PP-08', appliesToStyles: ['Fish', 'Nit', 'LAG', 'TAG'] }),
      },
    };
    const { getValue } = renderWithProvider(state);
    const nitPrims = getValue().selectPrimitivesByStyle('Nit');
    expect(nitPrims.map((p) => p.id).sort()).toEqual(['PP-01', 'PP-08']);
    const fishPrims = getValue().selectPrimitivesByStyle('Fish');
    expect(fishPrims.map((p) => p.id).sort()).toEqual(['PP-03', 'PP-08']);
  });

  it('selectPrimitivesByStyle returns empty for unknown style', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().selectPrimitivesByStyle('Unknown')).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// isEnrolled
// ───────────────────────────────────────────────────────────────────────────

describe('isEnrolled', () => {
  it('returns false in initial state (Q1-A red line #1 opt-in default)', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().isEnrolled()).toBe(false);
  });

  it('returns true when state.enrollment is enrolled', () => {
    const state = {
      ...initialAnchorLibraryState,
      enrollment: { observation_enrollment_state: ENROLLMENT_STATES.ENROLLED },
    };
    const { getValue } = renderWithProvider(state);
    expect(getValue().isEnrolled()).toBe(true);
  });
});
