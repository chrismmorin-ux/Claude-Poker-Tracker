// @vitest-environment jsdom
/**
 * ShapeMasteryContext.test.jsx
 *
 * Tests ShapeMasteryProvider + useShapeMastery consumer hook + selector helpers.
 *
 * SLS Stream D — SPR-081 / WS-040.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { ShapeMasteryProvider, useShapeMastery } from '../ShapeMasteryContext';
import {
  initialShapeMasteryState,
  buildDefaultDescriptorsDict,
  SHAPE_DESCRIPTOR_IDS,
  USER_MUTE_STATES,
} from '../../constants/shapeMasteryConstants';

// Mock the persistence hook so context tests don't hit IDB.
vi.mock('../../hooks/useShapeMasteryPersistence', () => ({
  useShapeMasteryPersistence: () => ({ isReady: true }),
}));

const seededState = (overrides = {}) => ({
  ...initialShapeMasteryState,
  descriptors: buildDefaultDescriptorsDict(),
  ...overrides,
});

const TestConsumer = ({ onValue }) => {
  const value = useShapeMastery();
  React.useEffect(() => {
    onValue(value);
  });
  return <div data-testid="ok">consumer-mounted</div>;
};

const renderWithProvider = (state = seededState(), dispatch = vi.fn()) => {
  let captured;
  const result = render(
    <ShapeMasteryProvider
      shapeMasteryState={state}
      dispatchShapeMastery={dispatch}
    >
      <TestConsumer onValue={(v) => { captured = v; }} />
    </ShapeMasteryProvider>,
  );
  return { ...result, getValue: () => captured };
};

describe('ShapeMasteryProvider — exposed value shape', () => {
  it('exposes raw state + isReady + dispatch + selectors', () => {
    const dispatch = vi.fn();
    const { getValue } = renderWithProvider(seededState(), dispatch);
    const value = getValue();
    expect(value).toBeTruthy();
    expect(value.enrolled).toBe(false);
    expect(value.isReady).toBe(true);
    expect(value.dispatchShapeMastery).toBe(dispatch);
    expect(typeof value.selectAllDescriptors).toBe('function');
    expect(typeof value.selectDescriptor).toBe('function');
    expect(typeof value.selectIsEnrolled).toBe('function');
  });

  it('selectAllDescriptors returns the dict (10 entries when seeded)', () => {
    const { getValue } = renderWithProvider(seededState());
    const all = getValue().selectAllDescriptors();
    expect(Object.keys(all).sort()).toEqual([...SHAPE_DESCRIPTOR_IDS].sort());
  });

  it('selectDescriptor returns the per-descriptor record or null', () => {
    const { getValue } = renderWithProvider(seededState());
    const silhouette = getValue().selectDescriptor('silhouette');
    expect(silhouette).toBeTruthy();
    expect(silhouette.posterior).toEqual({ alpha: 1, beta: 1 });
    expect(getValue().selectDescriptor('not-a-real-descriptor')).toBeNull();
  });

  it('selectIsEnrolled reflects state.enrolled', () => {
    const { getValue: getNotEnrolled } = renderWithProvider(seededState({ enrolled: false }));
    expect(getNotEnrolled().selectIsEnrolled()).toBe(false);
    const { getValue: getEnrolled } = renderWithProvider(seededState({ enrolled: true }));
    expect(getEnrolled().selectIsEnrolled()).toBe(true);
  });

  it('selectors honor descriptor mutations', () => {
    const state = seededState({
      descriptors: {
        ...buildDefaultDescriptorsDict(),
        silhouette: {
          ...buildDefaultDescriptorsDict().silhouette,
          posterior: { alpha: 8, beta: 2 },
          declaredLevel: 'known',
          userMuteState: USER_MUTE_STATES.ALREADY_KNOWN,
        },
      },
    });
    const { getValue } = renderWithProvider(state);
    const silhouette = getValue().selectDescriptor('silhouette');
    expect(silhouette.posterior).toEqual({ alpha: 8, beta: 2 });
    expect(silhouette.declaredLevel).toBe('known');
    expect(silhouette.userMuteState).toBe(USER_MUTE_STATES.ALREADY_KNOWN);
  });
});

describe('useShapeMastery — consumer hook contract', () => {
  it('throws when called outside a provider', () => {
    expect(() => {
      renderHook(() => useShapeMastery());
    }).toThrow(/within a ShapeMasteryProvider/);
  });
});
