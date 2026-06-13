// @vitest-environment jsdom
/**
 * @file Tests for useAnchorEnrollmentBridge — settings → anchor-library
 * enrollment sync (WS-222 / SPR-124).
 *
 * The bridge is reconciling and one-directional: when the persisted settings
 * value differs from the runtime anchor-library value, it re-asserts the
 * settings value via ENROLLMENT_TOGGLED. Key behaviors pinned here:
 *   - mismatch → exactly one dispatch with the settings value
 *   - equal values → no dispatch (convergence; no-loop proof)
 *   - invalid/missing settings value → no dispatch (pre-hydration safety)
 *   - hydration clobber (runtime resets to default) → re-dispatch (self-heal)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnchorEnrollmentBridge } from '../useAnchorEnrollmentBridge';
import { ANCHOR_LIBRARY_ACTIONS } from '../../constants/anchorLibraryConstants';

const settingsWith = (observationEnrollment) => ({
  settings: { anchorCalibration: { observationEnrollment } },
});

const anchorLibWith = (observation_enrollment_state) => ({
  enrollment: { observation_enrollment_state },
});

describe('useAnchorEnrollmentBridge', () => {
  it('dispatches ENROLLMENT_TOGGLED when settings=enrolled but runtime=not-enrolled', () => {
    const dispatch = vi.fn();
    renderHook(() =>
      useAnchorEnrollmentBridge(settingsWith('enrolled'), anchorLibWith('not-enrolled'), dispatch),
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED,
      payload: { observation_enrollment_state: 'enrolled' },
    });
  });

  it('does not dispatch when values are equal (converged)', () => {
    const dispatch = vi.fn();
    renderHook(() =>
      useAnchorEnrollmentBridge(settingsWith('enrolled'), anchorLibWith('enrolled'), dispatch),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch when both sides hold the not-enrolled default', () => {
    const dispatch = vi.fn();
    renderHook(() =>
      useAnchorEnrollmentBridge(settingsWith('not-enrolled'), anchorLibWith('not-enrolled'), dispatch),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch when the settings value is missing or invalid', () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(
      ({ settingsState }) =>
        useAnchorEnrollmentBridge(settingsState, anchorLibWith('not-enrolled'), dispatch),
      { initialProps: { settingsState: { settings: {} } } },
    );
    rerender({ settingsState: settingsWith('banana') });
    rerender({ settingsState: undefined });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('self-heals after a hydration clobber resets the runtime value', () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(
      ({ anchorLibraryState }) =>
        useAnchorEnrollmentBridge(settingsWith('enrolled'), anchorLibraryState, dispatch),
      { initialProps: { anchorLibraryState: anchorLibWith('enrolled') } },
    );
    expect(dispatch).not.toHaveBeenCalled();

    // ANCHOR_LIBRARY_HYDRATED rebuilds from initial state → not-enrolled.
    rerender({ anchorLibraryState: anchorLibWith('not-enrolled') });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: ANCHOR_LIBRARY_ACTIONS.ENROLLMENT_TOGGLED,
      payload: { observation_enrollment_state: 'enrolled' },
    });

    // Reducer applies the dispatch → runtime converges → no further dispatch.
    rerender({ anchorLibraryState: anchorLibWith('enrolled') });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
