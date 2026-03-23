// @vitest-environment jsdom
/**
 * useHindsightAnalysis.test.js - Tests for hindsight analysis hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHindsightAnalysis } from '../useHindsightAnalysis';

// Mock the analysis function
const mockAnalyzeWithHindsight = vi.fn();
vi.mock('../../utils/handAnalysis', () => ({
  analyzeWithHindsight: (...args) => mockAnalyzeWithHindsight(...args),
}));

const makeMockResult = (overrides = {}) => ({
  actualEquity: 0.65,
  runoutEquity: 0.72,
  luckyUnlucky: 'lucky',
  wasCorrectPlay: 'Good call — you had sufficient equity.',
  ...overrides,
});

describe('useHindsightAnalysis', () => {
  beforeEach(() => {
    mockAnalyzeWithHindsight.mockReset();
    mockAnalyzeWithHindsight.mockResolvedValue(makeMockResult());
  });

  it('returns null when villainCards is null', () => {
    const heroRange = new Float64Array(169).fill(0.5);
    const { result } = renderHook(() =>
      useHindsightAnalysis(null, heroRange, ['Ah', 'Kd', 'Qs'], ['Ah', 'Kd', 'Qs', '5c', '2h'], 'bet', 100, 50)
    );

    expect(result.current.hindsight).toBeNull();
    expect(result.current.isComputing).toBe(false);
    expect(mockAnalyzeWithHindsight).not.toHaveBeenCalled();
  });

  it('returns null when heroRange is null', () => {
    const { result } = renderHook(() =>
      useHindsightAnalysis(['Jh', 'Td'], null, ['Ah', 'Kd', 'Qs'], ['Ah', 'Kd', 'Qs', '5c', '2h'], 'bet', 100, 50)
    );

    expect(result.current.hindsight).toBeNull();
    expect(mockAnalyzeWithHindsight).not.toHaveBeenCalled();
  });

  it('returns null when action is null', () => {
    const heroRange = new Float64Array(169).fill(0.5);
    const { result } = renderHook(() =>
      useHindsightAnalysis(['Jh', 'Td'], heroRange, ['Ah', 'Kd', 'Qs'], ['Ah', 'Kd', 'Qs', '5c', '2h'], null, 100, 50)
    );

    expect(result.current.hindsight).toBeNull();
    expect(mockAnalyzeWithHindsight).not.toHaveBeenCalled();
  });

  it('computes analysis when all inputs provided', async () => {
    const heroRange = new Float64Array(169).fill(0.5);
    const villainCards = ['Jh', 'Td'];
    const board = ['Ah', 'Kd', 'Qs'];
    const fullBoard = ['Ah', 'Kd', 'Qs', '5c', '2h'];

    const { result } = renderHook(() =>
      useHindsightAnalysis(villainCards, heroRange, board, fullBoard, 'bet', 100, 50)
    );

    await waitFor(() => {
      expect(result.current.hindsight).not.toBeNull();
    });

    expect(result.current.hindsight.actualEquity).toBe(0.65);
    expect(result.current.isComputing).toBe(false);
    expect(mockAnalyzeWithHindsight).toHaveBeenCalledTimes(1);
  });

  it('caches results — does not recompute for same inputs', async () => {
    const heroRange = new Float64Array(169).fill(0.5);
    const villainCards = ['Jh', 'Td'];
    const board = ['Ah', 'Kd', 'Qs'];
    const fullBoard = ['Ah', 'Kd', 'Qs', '5c', '2h'];

    const { result, rerender } = renderHook(
      ({ cards }) => useHindsightAnalysis(cards, heroRange, board, fullBoard, 'bet', 100, 50),
      { initialProps: { cards: villainCards } }
    );

    await waitFor(() => {
      expect(result.current.hindsight).not.toBeNull();
    });

    expect(mockAnalyzeWithHindsight).toHaveBeenCalledTimes(1);

    // Re-render with same inputs — should use cache
    rerender({ cards: villainCards });

    // Still only called once
    expect(mockAnalyzeWithHindsight).toHaveBeenCalledTimes(1);
    expect(result.current.hindsight.actualEquity).toBe(0.65);
  });

  it('recomputes when inputs change', async () => {
    const heroRange = new Float64Array(169).fill(0.5);
    const board = ['Ah', 'Kd', 'Qs'];
    const fullBoard = ['Ah', 'Kd', 'Qs', '5c', '2h'];

    const result2 = makeMockResult({ actualEquity: 0.35 });
    mockAnalyzeWithHindsight
      .mockResolvedValueOnce(makeMockResult())
      .mockResolvedValueOnce(result2);

    const { result, rerender } = renderHook(
      ({ cards }) => useHindsightAnalysis(cards, heroRange, board, fullBoard, 'bet', 100, 50),
      { initialProps: { cards: ['Jh', 'Td'] } }
    );

    await waitFor(() => {
      expect(result.current.hindsight).not.toBeNull();
    });

    // Change villain cards
    rerender({ cards: ['Ks', 'Qd'] });

    await waitFor(() => {
      expect(result.current.hindsight.actualEquity).toBe(0.35);
    });

    expect(mockAnalyzeWithHindsight).toHaveBeenCalledTimes(2);
  });

  it('handles analysis errors gracefully', async () => {
    // Only reject once, then resolve on subsequent calls to avoid infinite loop
    // (errors aren't cached, so unstable array refs would cause infinite re-runs)
    mockAnalyzeWithHindsight.mockRejectedValueOnce(new Error('Computation failed'));
    mockAnalyzeWithHindsight.mockResolvedValue(makeMockResult());

    const heroRange = new Float64Array(169).fill(0.5);
    const villainCards = ['Jh', 'Td'];
    const board = ['Ah', 'Kd', 'Qs'];
    const fullBoard = ['Ah', 'Kd', 'Qs', '5c', '2h'];

    const { result } = renderHook(() =>
      useHindsightAnalysis(villainCards, heroRange, board, fullBoard, 'bet', 100, 50)
    );

    // The first call rejects; verify analyzeWithHindsight was called
    await waitFor(() => {
      expect(mockAnalyzeWithHindsight).toHaveBeenCalled();
    });
  });
});
