import { describe, it, expect } from 'vitest';
import {
  assumptionReducer,
  initialAssumptionState,
  ASSUMPTION_ACTIONS,
  assumptionProduced,
  assumptionsBulkLoaded,
  assumptionRetired,
  assumptionDialChanged,
  citedDecisionEmitted,
  emotionalStateComputed,
  calibrationMetricUpdated,
  drillSessionStarted,
  drillCardRevealed,
  drillCardAnswered,
  drillSessionCompleted,
  drillSessionAbandoned,
  clearAllAssumptions,
} from '../assumptionReducer';

const makeAssumption = ({
  id = 'a1',
  villainId = 'v1',
  actionableInDrill = true,
  actionableLive = true,
  dial = 0.7,
  status = 'active',
} = {}) => ({
  id,
  villainId,
  schemaVersion: '1.1',
  operator: { currentDial: dial, target: 'villain', suppresses: [] },
  quality: { actionableInDrill, actionableLive, composite: 0.8 },
  status,
});

describe('initialAssumptionState', () => {
  it('has all required fields', () => {
    expect(initialAssumptionState.assumptions).toEqual({});
    expect(initialAssumptionState.activeByVillain).toEqual({});
    expect(initialAssumptionState.categorizations).toEqual({});
    expect(initialAssumptionState.emotionalStateCache).toEqual({});
    expect(initialAssumptionState.citedDecisionCache).toEqual({});
    expect(initialAssumptionState.calibrationMetrics).toEqual({});
    expect(initialAssumptionState.drillSession).toBeNull();
    expect(initialAssumptionState.schemaVersion).toBe('1.1');
  });
});

describe('ASSUMPTION_PRODUCED', () => {
  it('adds assumption to table and active list (actionable)', () => {
    const a = makeAssumption();
    const next = assumptionReducer(initialAssumptionState, assumptionProduced(a));
    expect(next.assumptions['a1']).toBe(a);
    expect(next.activeByVillain['v1']).toEqual(['a1']);
  });

  it('does not add to active list when below threshold', () => {
    const a = makeAssumption({ actionableInDrill: false, actionableLive: false });
    const next = assumptionReducer(initialAssumptionState, assumptionProduced(a));
    expect(next.assumptions['a1']).toBe(a);
    expect(next.activeByVillain['v1']).toBeUndefined();
  });

  it('ignores invalid payload', () => {
    const bad = assumptionReducer(initialAssumptionState, { type: ASSUMPTION_ACTIONS.ASSUMPTION_PRODUCED, payload: null });
    expect(bad).toBe(initialAssumptionState);
  });

  it('updating an existing assumption replaces it', () => {
    const a1 = makeAssumption({ id: 'x', dial: 0.5 });
    const a2 = makeAssumption({ id: 'x', dial: 0.9 });
    let state = assumptionReducer(initialAssumptionState, assumptionProduced(a1));
    state = assumptionReducer(state, assumptionProduced(a2));
    expect(state.assumptions['x'].operator.currentDial).toBe(0.9);
    expect(state.activeByVillain['v1']).toHaveLength(1);
  });

  it('multiple villains tracked independently', () => {
    let state = assumptionReducer(initialAssumptionState, assumptionProduced(makeAssumption({ id: 'a1', villainId: 'v1' })));
    state = assumptionReducer(state, assumptionProduced(makeAssumption({ id: 'a2', villainId: 'v2' })));
    expect(state.activeByVillain['v1']).toEqual(['a1']);
    expect(state.activeByVillain['v2']).toEqual(['a2']);
  });
});

describe('ASSUMPTIONS_BULK_LOADED (IDB hydration)', () => {
  it('bulk-loads multiple assumptions', () => {
    const records = [
      makeAssumption({ id: 'a1', villainId: 'v1' }),
      makeAssumption({ id: 'a2', villainId: 'v1' }),
      makeAssumption({ id: 'a3', villainId: 'v2' }),
    ];
    const next = assumptionReducer(initialAssumptionState, assumptionsBulkLoaded(records));
    expect(Object.keys(next.assumptions)).toHaveLength(3);
    expect(next.activeByVillain['v1']).toHaveLength(2);
    expect(next.activeByVillain['v2']).toHaveLength(1);
  });

  it('handles non-array payload gracefully', () => {
    const next = assumptionReducer(initialAssumptionState, { type: ASSUMPTION_ACTIONS.ASSUMPTIONS_BULK_LOADED, payload: null });
    expect(next).toEqual(initialAssumptionState);
  });
});

describe('ASSUMPTION_RETIRED', () => {
  it('marks assumption as retired and removes from active list', () => {
    const a = makeAssumption();
    let state = assumptionReducer(initialAssumptionState, assumptionProduced(a));
    state = assumptionReducer(state, assumptionRetired('a1', 'calibration-gap'));
    expect(state.assumptions['a1'].status).toBe('retired');
    expect(state.assumptions['a1'].retirementReason).toBe('calibration-gap');
    expect(state.activeByVillain['v1']).toBeUndefined();
  });

  it('no-op when id not in state', () => {
    const state = assumptionReducer(initialAssumptionState, assumptionRetired('nonexistent'));
    expect(state).toEqual(initialAssumptionState);
  });
});

describe('ASSUMPTION_DIAL_CHANGED', () => {
  it('updates currentDial within [0, 1]', () => {
    const a = makeAssumption({ dial: 0.5 });
    let state = assumptionReducer(initialAssumptionState, assumptionProduced(a));
    state = assumptionReducer(state, assumptionDialChanged('a1', 0.9));
    expect(state.assumptions['a1'].operator.currentDial).toBe(0.9);
  });

  it('rejects out-of-range dial', () => {
    const a = makeAssumption({ dial: 0.5 });
    let state = assumptionReducer(initialAssumptionState, assumptionProduced(a));
    state = assumptionReducer(state, assumptionDialChanged('a1', 1.5));
    expect(state.assumptions['a1'].operator.currentDial).toBe(0.5);
  });

  it('no-op when id missing', () => {
    const state = assumptionReducer(initialAssumptionState, assumptionDialChanged('missing', 0.3));
    expect(state).toEqual(initialAssumptionState);
  });
});

describe('CITED_DECISION_EMITTED', () => {
  it('caches citedDecision by nodeId', () => {
    const decision = { recommendedAction: { action: 'check' }, dividend: 0.3 };
    const next = assumptionReducer(initialAssumptionState, citedDecisionEmitted('node-1', decision));
    expect(next.citedDecisionCache['node-1']).toBe(decision);
  });

  it('ignores missing nodeId or decision', () => {
    const next = assumptionReducer(initialAssumptionState, { type: ASSUMPTION_ACTIONS.CITED_DECISION_EMITTED, payload: {} });
    expect(next).toEqual(initialAssumptionState);
  });
});

describe('EMOTIONAL_STATE_COMPUTED', () => {
  it('caches emotionalState by nodeId', () => {
    const es = { fearIndex: 0.3, greedIndex: 0.2, joint: [0.3, 0.2] };
    const next = assumptionReducer(initialAssumptionState, emotionalStateComputed('node-1', es));
    expect(next.emotionalStateCache['node-1']).toBe(es);
  });
});

describe('CALIBRATION_METRIC_UPDATED', () => {
  it('stores metric by composite key predicateKey|style|street', () => {
    const metric = { firings: 10, predictedSum: 1.2, realizedSum: 1.1 };
    const next = assumptionReducer(initialAssumptionState,
      calibrationMetricUpdated('foldToRiverBet', 'Fish', 'river', metric));
    expect(next.calibrationMetrics['foldToRiverBet|Fish|river']).toBe(metric);
  });

  it('defaults style and street to ALL when missing', () => {
    const metric = { firings: 5 };
    const next = assumptionReducer(initialAssumptionState,
      calibrationMetricUpdated('foldToCbet', null, null, metric));
    expect(next.calibrationMetrics['foldToCbet|ALL|ALL']).toBe(metric);
  });
});

describe('DRILL_SESSION lifecycle', () => {
  const session = { sessionId: 'drill-1', startedAt: '2026-04-23T00:00:00Z', timeBudgetMinutes: 15, expectedVillainIds: ['v1'] };

  it('DRILL_SESSION_STARTED initializes session with empty cardsShown', () => {
    const next = assumptionReducer(initialAssumptionState, drillSessionStarted(session));
    expect(next.drillSession.sessionId).toBe('drill-1');
    expect(next.drillSession.cardsShown).toEqual([]);
  });

  it('DRILL_CARD_REVEALED appends a card entry', () => {
    let state = assumptionReducer(initialAssumptionState, drillSessionStarted(session));
    state = assumptionReducer(state, drillCardRevealed(0, 'a1'));
    expect(state.drillSession.cardsShown).toHaveLength(1);
    expect(state.drillSession.cardsShown[0].cardIndex).toBe(0);
    expect(state.drillSession.cardsShown[0].assumptionId).toBe('a1');
  });

  it('DRILL_CARD_ANSWERED updates the card entry', () => {
    let state = assumptionReducer(initialAssumptionState, drillSessionStarted(session));
    state = assumptionReducer(state, drillCardRevealed(0, 'a1'));
    state = assumptionReducer(state, drillCardAnswered(0, 'correct', 0.6, false));
    const card = state.drillSession.cardsShown[0];
    expect(card.heroAnswered).toBe('correct');
    expect(card.dialOverride).toBe(0.6);
    expect(card.retryQueued).toBe(false);
  });

  it('DRILL_CARD_ANSWERED no-op when card index not found', () => {
    let state = assumptionReducer(initialAssumptionState, drillSessionStarted(session));
    state = assumptionReducer(state, drillCardAnswered(99, 'correct'));
    expect(state.drillSession.cardsShown).toEqual([]);
  });

  it('DRILL_SESSION_COMPLETED sets completedAt', () => {
    let state = assumptionReducer(initialAssumptionState, drillSessionStarted(session));
    state = assumptionReducer(state, drillSessionCompleted());
    expect(state.drillSession.completedAt).toBeDefined();
  });

  it('DRILL_SESSION_ABANDONED clears drillSession', () => {
    let state = assumptionReducer(initialAssumptionState, drillSessionStarted(session));
    state = assumptionReducer(state, drillSessionAbandoned());
    expect(state.drillSession).toBeNull();
  });

  it('DRILL actions are no-op when no active session', () => {
    let state = assumptionReducer(initialAssumptionState, drillCardRevealed(0, 'a1'));
    expect(state.drillSession).toBeNull();
  });
});

describe('SCHEMA_MIGRATION_RAN', () => {
  it('updates schemaVersion', () => {
    const next = assumptionReducer(initialAssumptionState, {
      type: ASSUMPTION_ACTIONS.SCHEMA_MIGRATION_RAN,
      payload: { from: '1.0', to: '1.1', count: 3 },
    });
    expect(next.schemaVersion).toBe('1.1');
  });
});

describe('CLEAR_ALL', () => {
  it('resets to initial state', () => {
    let state = assumptionReducer(initialAssumptionState, assumptionProduced(makeAssumption()));
    expect(Object.keys(state.assumptions)).toHaveLength(1);
    state = assumptionReducer(state, clearAllAssumptions());
    expect(state).toEqual(initialAssumptionState);
  });
});

describe('unknown action', () => {
  it('returns state unchanged', () => {
    const state = assumptionReducer(initialAssumptionState, { type: 'UNKNOWN' });
    expect(state).toBe(initialAssumptionState);
  });

  it('ignores actions with missing/non-string type', () => {
    // Note: {} without `type` is handled by the raw reducer's defensive guard.
    // createValidatedReducer assumes action is a non-null object per Redux convention.
    const state1 = assumptionReducer(initialAssumptionState, { type: 42 });
    expect(state1).toBe(initialAssumptionState);
    const state2 = assumptionReducer(initialAssumptionState, {});
    expect(state2).toBe(initialAssumptionState);
  });
});
