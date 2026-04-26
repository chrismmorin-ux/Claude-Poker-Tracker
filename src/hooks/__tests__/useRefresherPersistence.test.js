// @vitest-environment jsdom
/**
 * useRefresherPersistence.test.js — hydration coverage.
 *
 * Mocks the IDB store wrappers; verifies parallel hydration + dispatch +
 * isReady transitions on success and failure paths.
 *
 * PRF Phase 5 — Session 14 (PRF-G5-HK).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRefresherPersistence } from '../useRefresherPersistence';
import { REFRESHER_ACTIONS } from '../../constants/refresherConstants';
import { buildDefaultRefresherConfig } from '../../utils/persistence/refresherDefaults';

vi.mock('../../utils/persistence/refresherStore', () => ({
  getRefresherConfig: vi.fn(),
  getAllPrintBatches: vi.fn(),
}));

import {
  getRefresherConfig,
  getAllPrintBatches,
} from '../../utils/persistence/refresherStore';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRefresherPersistence — hydration', () => {
  it('parallel-reads getRefresherConfig + getAllPrintBatches on mount', async () => {
    getRefresherConfig.mockResolvedValue(buildDefaultRefresherConfig());
    getAllPrintBatches.mockResolvedValue([]);

    const dispatch = vi.fn();
    renderHook(() => useRefresherPersistence(dispatch));

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(getRefresherConfig).toHaveBeenCalledTimes(1);
    expect(getAllPrintBatches).toHaveBeenCalledTimes(1);
  });

  it('dispatches REFRESHER_HYDRATED with config + printBatches payload', async () => {
    const config = buildDefaultRefresherConfig();
    const printBatches = [{ batchId: 'uuid-1', printedAt: '2026-04-26T00:00:00Z' }];
    getRefresherConfig.mockResolvedValue(config);
    getAllPrintBatches.mockResolvedValue(printBatches);

    const dispatch = vi.fn();
    renderHook(() => useRefresherPersistence(dispatch));

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(dispatch).toHaveBeenCalledWith({
      type: REFRESHER_ACTIONS.REFRESHER_HYDRATED,
      payload: { config, printBatches },
    });
  });

  it('isReady transitions false → true on successful hydration', async () => {
    getRefresherConfig.mockResolvedValue(buildDefaultRefresherConfig());
    getAllPrintBatches.mockResolvedValue([]);

    const dispatch = vi.fn();
    const { result } = renderHook(() => useRefresherPersistence(dispatch));

    expect(result.current.isReady).toBe(false);
    await waitFor(() => expect(result.current.isReady).toBe(true));
  });

  it('isReady still true on hydration failure (app remains usable)', async () => {
    getRefresherConfig.mockRejectedValue(new Error('IDB read failed'));
    getAllPrintBatches.mockResolvedValue([]);

    const dispatch = vi.fn();
    const { result } = renderHook(() => useRefresherPersistence(dispatch));

    await waitFor(() => expect(result.current.isReady).toBe(true));
    // Dispatch still fires with empty payload (reducer falls back to defaults)
    expect(dispatch).toHaveBeenCalledWith({
      type: REFRESHER_ACTIONS.REFRESHER_HYDRATED,
      payload: {},
    });
  });

  it('does not dispatch after unmount (cancellation guard)', async () => {
    let resolveConfig;
    getRefresherConfig.mockImplementation(() => new Promise((r) => { resolveConfig = r; }));
    getAllPrintBatches.mockResolvedValue([]);

    const dispatch = vi.fn();
    const { unmount } = renderHook(() => useRefresherPersistence(dispatch));

    // Unmount before the read resolves
    unmount();
    resolveConfig(buildDefaultRefresherConfig());

    // Wait a tick for any pending dispatch
    await new Promise((r) => setTimeout(r, 10));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
