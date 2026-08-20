// @vitest-environment jsdom
/**
 * useActionAdvisor.test.js - Tests for action advisor React hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useActionAdvisor } from '../useActionAdvisor';

vi.mock('../../utils/exploitEngine/gameTreeEvaluator', () => ({
  evaluateGameTree: vi.fn(),
}));

vi.mock('../../utils/pokerCore/cardParser', () => ({
  parseAndEncode: vi.fn((str) => {
    const map = { As: 48, Kh: 45, '7c': 19, '2d': 2, Td: 34 };
    return map[str] ?? -1;
  }),
}));

import { evaluateGameTree } from '../../utils/exploitEngine/gameTreeEvaluator';

const validInput = {
  villainRange: new Float64Array(169),
  boardCards: ['7c', '2d', 'Td'],
  heroCardStrings: ['As', 'Kh'],
  potSize: 100,
  villainAction: 'bet',
};

const mockResult = {
  heroEquity: 0.62,
  recommendations: [{ action: 'bet', ev: 45 }],
};

describe('useActionAdvisor — rake reaches the game tree (WS-333 follow-up)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('forwards a resolved rakeConfig to evaluateGameTree', async () => {
    // This hook serves the MANUAL live table and passed NO rake config at all, so
    // `evaluateGameTree` defaulted it to null and every EV figure omitted the drop. A test
    // that only checked the hook still returns advice would not have noticed.
    evaluateGameTree.mockResolvedValue(mockResult);
    const rakeConfig = { pct: 0.10, cap: 8, noFlopNoDrop: true };
    const { result } = renderHook(() => useActionAdvisor());

    await act(async () => { await result.current.compute({ ...validInput, rakeConfig }); });

    expect(evaluateGameTree).toHaveBeenCalledWith(expect.objectContaining({ rakeConfig }));
  });

  it('passes null when no rake was resolved, rather than omitting the key', async () => {
    // Omitting it would let the parameter silently revert to the evaluator's default and
    // make "no rake schedule for this game" indistinguishable from "nobody wired it".
    evaluateGameTree.mockResolvedValue(mockResult);
    const { result } = renderHook(() => useActionAdvisor());

    await act(async () => { await result.current.compute(validInput); });

    expect(evaluateGameTree).toHaveBeenCalledWith(expect.objectContaining({ rakeConfig: null }));
  });
});

describe('useActionAdvisor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initial state: advice null, not computing, no error', () => {
    const { result } = renderHook(() => useActionAdvisor());
    expect(result.current.advice).toBeNull();
    expect(result.current.isComputing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.compute).toBe('function');
    expect(typeof result.current.clear).toBe('function');
  });

  it('compute() resolves with advice', async () => {
    evaluateGameTree.mockResolvedValue(mockResult);
    const { result } = renderHook(() => useActionAdvisor());

    await act(async () => {
      await result.current.compute(validInput);
    });

    // WS-574: the advice object now carries its own phase. `toMatchObject` rather than
    // `toEqual` because the two-phase markers are part of every delivery.
    expect(result.current.advice).toMatchObject(mockResult);
    expect(result.current.advice.isProvisional).toBe(false);
    expect(result.current.isComputing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ── WS-574 ────────────────────────────────────────────────────────────────────────
  // These are the tests whose ABSENCE let the defect exist. `evaluateGameTree` has been
  // two-phase since WS-334, the hook never passed `onFastResult`, and nothing failed —
  // because the suite mocks the evaluator with a bare `vi.fn()` that cannot fire the
  // callback and nothing counts state writes. A capability with no production caller and
  // no consumer-side test is invisible by construction.
  describe('two-phase delivery (WS-574)', () => {
    /**
     * An evaluator mock that behaves like the real two-phase one — including the macrotask
     * yield. That yield is not decoration: refinement is synchronous CPU work on the same
     * thread, so without a real `setTimeout(0)` the host never paints and two-phase is
     * cosmetic. A mock that resolves immediately would not exercise the thing under test.
     */
    const twoPhase = (fast, refined) => async (args) => {
      args.onFastResult?.(fast);
      await new Promise((r) => setTimeout(r, 0));
      return refined;
    };

    it('passes onFastResult to the engine at all', async () => {
      evaluateGameTree.mockResolvedValue(mockResult);
      const { result } = renderHook(() => useActionAdvisor());

      await act(async () => { await result.current.compute(validInput); });

      expect(evaluateGameTree).toHaveBeenCalledWith(
        expect.objectContaining({ onFastResult: expect.any(Function) })
      );
    });

    it('renders the fast answer as provisional, then replaces it with the refined one', async () => {
      const fast = { heroEquity: 0.55, recommendations: [{ action: 'bet', ev: 20 }] };
      const refined = { heroEquity: 0.62, recommendations: [{ action: 'check', ev: 31 }] };
      evaluateGameTree.mockImplementation(twoPhase(fast, refined));
      const { result } = renderHook(() => useActionAdvisor());

      // The two phases have to be observed ACROSS the macrotask boundary, not inside one
      // `act()` — React batches everything in a single act into one render, which would
      // hide the very thing under test. This split mirrors what actually happens at the
      // table: fast answer paints, then refinement lands later.
      let pending;
      await act(async () => {
        pending = result.current.compute(validInput);
        await Promise.resolve(); // microtask only — the mock's setTimeout(0) has NOT fired
      });

      // FAILS on the old single-`setAdvice` shape: nothing is rendered until the very end.
      const provisional = result.current.advice;
      expect(provisional).not.toBeNull();
      expect(provisional.isProvisional).toBe(true);
      expect(provisional.recommendations[0].action).toBe('bet');

      await act(async () => { await pending; });

      expect(result.current.advice.isProvisional).toBe(false);
      expect(result.current.advice.recommendations[0].action).toBe('check');
    });

    it('reports the action refinement moved OFF, and stays silent when it agrees', async () => {
      // WS-496 measured depth-2 flipping the top action on 35.3% of flops, so a silent swap
      // is the common case, not an edge case.
      const flipped = { heroEquity: 0.62, recommendations: [{ action: 'check', ev: 31 }] };
      evaluateGameTree.mockImplementation(
        twoPhase({ heroEquity: 0.55, recommendations: [{ action: 'bet', ev: 20 }] }, flipped)
      );
      const { result } = renderHook(() => useActionAdvisor());
      await act(async () => { await result.current.compute(validInput); });
      expect(result.current.advice.changedOnRefine).toBe('bet');

      const agreed = { heroEquity: 0.62, recommendations: [{ action: 'bet', ev: 31 }] };
      evaluateGameTree.mockImplementation(
        twoPhase({ heroEquity: 0.55, recommendations: [{ action: 'bet', ev: 20 }] }, agreed)
      );
      const { result: r2 } = renderHook(() => useActionAdvisor());
      await act(async () => { await r2.current.compute(validInput); });
      expect(r2.current.advice.changedOnRefine).toBeNull();
    });

    it('a fast result from a superseded call cannot overwrite a newer one', async () => {
      // The staleness guard has to cover the fast phase too, or a slow first compute
      // repaints stale advice over a newer refined answer.
      const { result } = renderHook(() => useActionAdvisor());
      let releaseFirst;
      evaluateGameTree
        .mockImplementationOnce((args) => new Promise((res) => {
          releaseFirst = () => { args.onFastResult?.({ heroEquity: 0.1, recommendations: [{ action: 'fold', ev: 0 }] }); res({ heroEquity: 0.1, recommendations: [{ action: 'fold', ev: 0 }] }); };
        }))
        .mockImplementationOnce(twoPhase(
          { heroEquity: 0.9, recommendations: [{ action: 'raise', ev: 50 }] },
          { heroEquity: 0.9, recommendations: [{ action: 'raise', ev: 55 }] },
        ));

      await act(async () => {
        const first = result.current.compute(validInput);
        await result.current.compute(validInput);
        releaseFirst();
        await first;
      });

      expect(result.current.advice.recommendations[0].action).toBe('raise');
    });
  });

  it('compute() with invalid hero cards sets error', async () => {
    const { result } = renderHook(() => useActionAdvisor());

    await act(async () => {
      await result.current.compute({
        ...validInput,
        heroCardStrings: ['Zz', 'Yy'], // parseAndEncode returns -1
      });
    });

    expect(result.current.error).toBe('Exactly 2 valid hero cards required');
    expect(result.current.advice).toBeNull();
    expect(result.current.isComputing).toBe(false);
  });

  it('compute() with too few board cards sets error', async () => {
    const { result } = renderHook(() => useActionAdvisor());

    await act(async () => {
      await result.current.compute({
        ...validInput,
        boardCards: ['7c', 'Zz'], // only 1 valid card
      });
    });

    expect(result.current.error).toBe('At least 3 board cards required');
    expect(result.current.advice).toBeNull();
  });

  it('clear() resets state', async () => {
    evaluateGameTree.mockResolvedValue(mockResult);
    const { result } = renderHook(() => useActionAdvisor());

    await act(async () => {
      await result.current.compute(validInput);
    });

    expect(result.current.advice).not.toBeNull();

    act(() => {
      result.current.clear();
    });

    expect(result.current.advice).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isComputing).toBe(false);
  });

  it('rapid double-call only keeps latest result (abort)', async () => {
    let callCount = 0;
    evaluateGameTree.mockImplementation(() => {
      callCount++;
      const thisCall = callCount;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ heroEquity: thisCall === 1 ? 0.3 : 0.7, call: thisCall });
        }, thisCall === 1 ? 50 : 10);
      });
    });

    const { result } = renderHook(() => useActionAdvisor());

    // Fire two calls — first is slow, second is fast
    await act(async () => {
      result.current.compute(validInput); // call 1, slow
      result.current.compute(validInput); // call 2, fast — aborts call 1
      // Wait for both to complete
      await new Promise((r) => setTimeout(r, 100));
    });

    // Only the second (latest) result should be kept
    expect(result.current.advice.call).toBe(2);
    expect(result.current.advice.heroEquity).toBe(0.7);
  });
});
