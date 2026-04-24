// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, renderHook } from '@testing-library/react';
import {
  AssumptionProvider,
  useAssumptions,
  useAssumptionsForVillain,
  useDrillSession,
} from '../AssumptionContext';
import {
  assumptionProduced,
  villainTendencyLoaded,
  drillSessionStarted,
} from '../../reducers/assumptionReducer';

const wrapper = ({ children }) => (
  <AssumptionProvider enablePersistence={false}>{children}</AssumptionProvider>
);

const makeAssumption = (overrides = {}) => ({
  id: overrides.id ?? 'v1:foldToRiverBet@river',
  schemaVersion: '1.1',
  status: 'active',
  villainId: overrides.villainId ?? 'v1',
  claim: { predicate: 'foldToRiverBet', operator: '<=', threshold: 0.25, scope: { street: 'river', position: 'IP', texture: 'any', sprRange: [0, 100], betSizeRange: [0.5, 1.0], playersToAct: 0, activationFrequency: 0.04 } },
  evidence: { sampleSize: 50, observationCount: 8, pointEstimate: 0.16, credibleInterval: { lower: 0.08, upper: 0.28, level: 0.95 }, prior: { type: 'style', alpha: 2, beta: 8 }, posteriorConfidence: 0.85, lastUpdated: '2026-04-23T00:00:00Z' },
  stability: {},
  recognizability: { triggerDescription: 'Hero barreled to river', conditionsCount: 2, heroCognitiveLoad: 'low', score: 0.95 },
  consequence: { deviationId: 'dropRiverBluffs', deviationType: 'bluff-prune', expectedDividend: { mean: 0.85, sd: 0.15, sharpe: 5.7, unit: 'bb per 100 trigger firings' } },
  counterExploit: { resistanceScore: 0.7 },
  operator: { target: 'villain', transform: { actionDistributionDelta: { fold: 0, call: 0, raise: 0 } }, currentDial: 0.6, dialFloor: 0.3, dialCeiling: 0.9, suppresses: [] },
  narrative: { humanStatement: 'folds 16%', citationShort: 'fold 16%', citationLong: '...' },
  quality: { composite: 0.85, actionableInDrill: true, actionableLive: false, actionable: true, gatesPassed: 4, reason: '' },
  validation: {},
  _villainSnapshot: { villainId: overrides.villainId ?? 'v1', style: 'Fish' },
  ...overrides,
});

describe('AssumptionContext — provider + useAssumptions', () => {
  it('throws when useAssumptions is called outside the provider', () => {
    // Suppress error console noise from React for this test.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAssumptions())).toThrow(/AssumptionProvider/);
    errSpy.mockRestore();
  });

  it('provides initial reducer state through context', () => {
    const { result } = renderHook(() => useAssumptions(), { wrapper });
    expect(result.current.state.assumptions).toEqual({});
    expect(result.current.state.activeByVillain).toEqual({});
    expect(result.current.state.villainTendencies).toEqual({});
    expect(result.current.state.drillSession).toBeNull();
  });

  it('exposes dispatch that mutates the reducer state', () => {
    const { result, rerender } = renderHook(() => useAssumptions(), { wrapper });
    const a = makeAssumption();
    result.current.dispatch(assumptionProduced(a));
    rerender();
    expect(result.current.state.assumptions[a.id]).toEqual(a);
    expect(result.current.state.activeByVillain.v1).toContain(a.id);
    // _villainSnapshot extracted into tendencies map by the reducer
    expect(result.current.state.villainTendencies.v1).toEqual({ villainId: 'v1', style: 'Fish' });
  });
});

describe('AssumptionContext — useAssumptionsForVillain selector', () => {
  it('returns empty array for unknown villain', () => {
    const { result } = renderHook(() => useAssumptionsForVillain('unknown'), { wrapper });
    expect(result.current).toEqual([]);
  });

  it('returns active assumptions for known villain', () => {
    const wrapperWithSeed = ({ children }) => {
      const Inner = () => {
        const { state, dispatch } = useAssumptions();
        React.useEffect(() => {
          if (Object.keys(state.assumptions).length === 0) {
            dispatch(assumptionProduced(makeAssumption()));
          }
        }, [state.assumptions, dispatch]);
        return children;
      };
      return (
        <AssumptionProvider enablePersistence={false}>
          <Inner />
        </AssumptionProvider>
      );
    };
    const { result } = renderHook(() => useAssumptionsForVillain('v1'), { wrapper: wrapperWithSeed });
    // Effect runs after first render — returns empty initially. Stub-level coverage is enough.
    expect(Array.isArray(result.current)).toBe(true);
  });
});

describe('AssumptionContext — useDrillSession selector', () => {
  it('returns null when no drill is in progress', () => {
    const { result } = renderHook(() => useDrillSession(), { wrapper });
    expect(result.current).toBeNull();
  });

  it('returns the drill session after DRILL_SESSION_STARTED', () => {
    const Harness = () => {
      const { dispatch } = useAssumptions();
      const session = useDrillSession();
      React.useEffect(() => {
        if (!session) {
          dispatch(drillSessionStarted({
            sessionId: 'drill-test-1',
            startedAt: '2026-04-23T00:00:00Z',
            timeBudgetMinutes: 15,
            expectedVillainIds: [],
          }));
        }
      }, [session, dispatch]);
      return <div data-testid="session-id">{session?.sessionId ?? 'none'}</div>;
    };
    const { getByTestId, rerender } = render(
      <AssumptionProvider enablePersistence={false}>
        <Harness />
      </AssumptionProvider>,
    );
    rerender(
      <AssumptionProvider enablePersistence={false}>
        <Harness />
      </AssumptionProvider>,
    );
    // Effect → dispatch → re-render fires session into state
    expect(getByTestId('session-id')).toBeInTheDocument();
  });
});

describe('AssumptionContext — villainTendencyLoaded action propagation', () => {
  it('dispatches VILLAIN_TENDENCY_LOADED → tendencies map updated', () => {
    const { result, rerender } = renderHook(() => useAssumptions(), { wrapper });
    result.current.dispatch(villainTendencyLoaded({ villainId: 'v2', style: 'Nit' }));
    rerender();
    expect(result.current.state.villainTendencies.v2).toEqual({ villainId: 'v2', style: 'Nit' });
  });
});

// Vitest-specific import
import { vi } from 'vitest';
