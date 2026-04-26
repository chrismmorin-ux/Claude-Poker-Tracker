// @vitest-environment jsdom
/**
 * RefresherContext.test.jsx — Provider + writer-action helpers + selector helpers.
 *
 * Mocks useRefresherPersistence + writers.js to isolate context behavior from IDB.
 *
 * PRF Phase 5 — Session 14 (PRF-G5-HK).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';
import { RefresherProvider, useRefresher } from '../RefresherContext';
import { initialRefresherState } from '../../constants/refresherConstants';
import { buildDefaultRefresherConfig } from '../../utils/persistence/refresherDefaults';

vi.mock('../../hooks/useRefresherPersistence', () => ({
  useRefresherPersistence: () => ({ isReady: true }),
}));

vi.mock('../../utils/printableRefresher/writers', () => ({
  writeConfigPreferences: vi.fn(),
  writeCardVisibility: vi.fn(),
  writeSuppressedClass: vi.fn(),
  writePrintBatch: vi.fn(),
}));

import {
  writeConfigPreferences,
  writeCardVisibility,
  writeSuppressedClass,
  writePrintBatch,
} from '../../utils/printableRefresher/writers';

beforeEach(() => {
  vi.clearAllMocks();
});

const TestConsumer = ({ onValue }) => {
  const value = useRefresher();
  React.useEffect(() => { onValue(value); });
  return <div data-testid="ok">consumer-mounted</div>;
};

const renderWithProvider = (state = initialRefresherState, dispatch = vi.fn(), cardRegistry = []) => {
  let captured;
  const result = render(
    <RefresherProvider
      refresherState={state}
      dispatchRefresher={dispatch}
      cardRegistry={cardRegistry}
    >
      <TestConsumer onValue={(v) => { captured = v; }} />
    </RefresherProvider>,
  );
  return { ...result, getValue: () => captured, dispatch };
};

const sampleCards = [
  { cardId: 'PRF-MATH-AUTO-PROFIT', class: 'math', title: 'Auto-profit', contentHash: 'sha256:hash-A' },
  { cardId: 'PRF-PREFLOP-CO-OPEN', class: 'preflop', title: 'CO open', contentHash: 'sha256:hash-B' },
];

// ───────────────────────────────────────────────────────────────────────────
// Provider basics
// ───────────────────────────────────────────────────────────────────────────

describe('RefresherProvider', () => {
  it('renders children', () => {
    renderWithProvider();
    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });

  it('exposes config + printBatches + isReady', () => {
    const { getValue } = renderWithProvider();
    expect(getValue().config).toEqual(buildDefaultRefresherConfig());
    expect(getValue().printBatches).toEqual([]);
    expect(getValue().isReady).toBe(true);
  });

  it('exposes all 4 writer-action helpers', () => {
    const { getValue } = renderWithProvider();
    expect(typeof getValue().patchConfig).toBe('function');
    expect(typeof getValue().setCardVisibility).toBe('function');
    expect(typeof getValue().setClassSuppressed).toBe('function');
    expect(typeof getValue().recordPrintBatch).toBe('function');
  });

  it('exposes all 6 selector helpers', () => {
    const { getValue } = renderWithProvider();
    expect(typeof getValue().getAllCards).toBe('function');
    expect(typeof getValue().getActiveCards).toBe('function');
    expect(typeof getValue().getPinnedCards).toBe('function');
    expect(typeof getValue().getSuppressedCards).toBe('function');
    expect(typeof getValue().getCardsForBatchPrint).toBe('function');
    expect(typeof getValue().getStaleCards).toBe('function');
  });
});

describe('useRefresher consumer hook', () => {
  it('throws helpful error when called outside provider', () => {
    const ThrowingConsumer = () => {
      useRefresher();
      return null;
    };
    // Suppress React's error boundary console output
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ThrowingConsumer />)).toThrow(/RefresherProvider/);
    errorSpy.mockRestore();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Writer-action helpers
// ───────────────────────────────────────────────────────────────────────────

describe('RefresherProvider — patchConfig (W-URC-1 path)', () => {
  it('calls writeConfigPreferences and dispatches REFRESHER_CONFIG_REPLACED', async () => {
    const updated = { ...buildDefaultRefresherConfig(), printPreferences: { ...buildDefaultRefresherConfig().printPreferences, colorMode: 'bw' } };
    writeConfigPreferences.mockResolvedValue(updated);

    const dispatch = vi.fn();
    const { getValue } = renderWithProvider(initialRefresherState, dispatch);

    await act(async () => {
      await getValue().patchConfig({ printPreferences: { colorMode: 'bw' } });
    });

    expect(writeConfigPreferences).toHaveBeenCalledWith({ printPreferences: { colorMode: 'bw' } });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'REFRESHER_CONFIG_REPLACED',
      payload: { config: updated },
    });
  });

  it('propagates writer rejection (UI handles)', async () => {
    writeConfigPreferences.mockRejectedValue(new Error('AP-PRF-09 violation'));

    const { getValue } = renderWithProvider();
    await expect(getValue().patchConfig({ printPreferences: { includeCodex: true } }))
      .rejects.toThrow(/AP-PRF-09/);
  });
});

describe('RefresherProvider — setCardVisibility (W-URC-2a path)', () => {
  it('calls writeCardVisibility and dispatches', async () => {
    const updated = { ...buildDefaultRefresherConfig(), cardVisibility: { 'PRF-X': 'pinned' } };
    writeCardVisibility.mockResolvedValue(updated);

    const dispatch = vi.fn();
    const { getValue } = renderWithProvider(initialRefresherState, dispatch);

    await act(async () => {
      await getValue().setCardVisibility({ cardId: 'PRF-X', visibility: 'pinned' });
    });

    expect(writeCardVisibility).toHaveBeenCalledWith({ cardId: 'PRF-X', visibility: 'pinned' });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'REFRESHER_CONFIG_REPLACED',
      payload: { config: updated },
    });
  });
});

describe('RefresherProvider — setClassSuppressed (W-URC-2b path)', () => {
  it('calls writeSuppressedClass with all guards and dispatches', async () => {
    const updated = { ...buildDefaultRefresherConfig(), suppressedClasses: ['exceptions'] };
    writeSuppressedClass.mockResolvedValue(updated);

    const dispatch = vi.fn();
    const { getValue } = renderWithProvider(initialRefresherState, dispatch);

    await act(async () => {
      await getValue().setClassSuppressed({ classId: 'exceptions', suppress: true, confirmed: true });
    });

    expect(writeSuppressedClass).toHaveBeenCalledWith({ classId: 'exceptions', suppress: true, confirmed: true });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'REFRESHER_CONFIG_REPLACED',
      payload: { config: updated },
    });
  });
});

describe('RefresherProvider — recordPrintBatch (W-URC-3 path)', () => {
  it('calls writePrintBatch and dispatches REFRESHER_BATCH_APPENDED with both batch + updatedConfig', async () => {
    const record = {
      batchId: 'uuid-new',
      printedAt: '2026-05-01T00:00:00Z',
      label: null,
      cardIds: ['PRF-MATH-AUTO-PROFIT'],
      engineVersion: 'v4.7.2',
      appVersion: 'v123',
      perCardSnapshots: { 'PRF-MATH-AUTO-PROFIT': { contentHash: 'sha256:abc', version: 'v1.0' } },
      schemaVersion: 1,
    };
    writePrintBatch.mockResolvedValue({ batchId: 'uuid-new', record });

    const dispatch = vi.fn();
    const { getValue } = renderWithProvider(initialRefresherState, dispatch);

    await act(async () => {
      await getValue().recordPrintBatch({ printedAt: '2026-05-01T00:00:00Z' });
    });

    expect(writePrintBatch).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
    const dispatched = dispatch.mock.calls[0][0];
    expect(dispatched.type).toBe('REFRESHER_BATCH_APPENDED');
    expect(dispatched.payload.batch).toBe(record);
    expect(dispatched.payload.updatedConfig.lastExportAt).toBe('2026-05-01T00:00:00Z');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Selector helpers
// ───────────────────────────────────────────────────────────────────────────

describe('RefresherProvider — selector helpers', () => {
  it('getAllCards returns all cards from registry', () => {
    const { getValue } = renderWithProvider(initialRefresherState, vi.fn(), sampleCards);
    expect(getValue().getAllCards()).toHaveLength(2);
  });

  it('getActiveCards excludes hidden cards', () => {
    const config = { ...buildDefaultRefresherConfig(), cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'hidden' } };
    const state = { ...initialRefresherState, config };
    const { getValue } = renderWithProvider(state, vi.fn(), sampleCards);
    const active = getValue().getActiveCards();
    expect(active).toHaveLength(1);
    expect(active[0].cardId).toBe('PRF-PREFLOP-CO-OPEN');
  });

  it('getPinnedCards returns pinned subset', () => {
    const config = { ...buildDefaultRefresherConfig(), cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'pinned' } };
    const state = { ...initialRefresherState, config };
    const { getValue } = renderWithProvider(state, vi.fn(), sampleCards);
    expect(getValue().getPinnedCards()).toHaveLength(1);
  });

  it('getSuppressedCards returns hidden + class-suppressed', () => {
    const config = { ...buildDefaultRefresherConfig(), suppressedClasses: ['math'] };
    const state = { ...initialRefresherState, config };
    const { getValue } = renderWithProvider(state, vi.fn(), sampleCards);
    expect(getValue().getSuppressedCards()).toHaveLength(1);
    expect(getValue().getSuppressedCards()[0].class).toBe('math');
  });

  it('getCardsForBatchPrint filters selectedIds to active', () => {
    const config = { ...buildDefaultRefresherConfig(), cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'hidden' } };
    const state = { ...initialRefresherState, config };
    const { getValue } = renderWithProvider(state, vi.fn(), sampleCards);
    const out = getValue().getCardsForBatchPrint(['PRF-MATH-AUTO-PROFIT', 'PRF-PREFLOP-CO-OPEN']);
    expect(out).toHaveLength(1);
    expect(out[0].cardId).toBe('PRF-PREFLOP-CO-OPEN');
  });

  it('getStaleCards detects diverging contentHash from print batch snapshot', () => {
    const printBatches = [{
      batchId: 'b1',
      printedAt: '2026-04-26T00:00:00Z',
      cardIds: ['PRF-MATH-AUTO-PROFIT'],
      perCardSnapshots: {
        'PRF-MATH-AUTO-PROFIT': { contentHash: 'sha256:OLD', version: 'v0.9' },
      },
    }];
    const state = { ...initialRefresherState, printBatches };
    const { getValue } = renderWithProvider(state, vi.fn(), sampleCards);
    const stale = getValue().getStaleCards();
    expect(stale).toHaveLength(1);
    expect(stale[0].cardId).toBe('PRF-MATH-AUTO-PROFIT');
  });
});
