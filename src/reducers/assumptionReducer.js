/**
 * assumptionReducer.js - VillainAssumption state management
 *
 * Per architecture §7.1 (exploit-deviation project):
 *   Manages: assumptions table, per-villain active-id lists, categorizations cache,
 *            emotionalState cache, citedDecision cache, calibrationMetrics cache,
 *            drill session state, schema version.
 *
 * Pure reducer — no IO, no side effects. Persistence is the concern of
 * `useAssumptionPersistence` which wraps this reducer with IDB sync.
 *
 * Schema version: '1.1' per schema.md. Dispatched records must already be
 * v1.1-shaped (migration runs at persistence load time per I-AE-5).
 *
 * Architecture §5 invariants relevant here:
 *   - I-AE-5 schema-version consistency — reducer refuses to set state whose
 *     schemaVersion differs from the canonical version
 *   - I-AE-1 hard-edge doctrine — reducer does NOT filter below-threshold;
 *     that's the qualityGate + producer concern. Reducer stores whatever
 *     was dispatched.
 */

import { createValidatedReducer } from '../utils/reducerUtils';
import { SCHEMA_VERSION } from '../utils/assumptionEngine';

// =============================================================================
// ACTION TYPES
// =============================================================================

export const ASSUMPTION_ACTIONS = Object.freeze({
  ASSUMPTION_PRODUCED: 'ASSUMPTION_PRODUCED',           // payload: assumption
  ASSUMPTIONS_BULK_LOADED: 'ASSUMPTIONS_BULK_LOADED',   // payload: assumption[]  (IDB hydration)
  VILLAIN_TENDENCY_LOADED: 'VILLAIN_TENDENCY_LOADED',   // payload: villainTendency  (sidecar to assumptions, used for synthesis)
  VILLAIN_TENDENCIES_BULK_LOADED: 'VILLAIN_TENDENCIES_BULK_LOADED', // payload: villainTendency[]
  ASSUMPTION_RETIRED: 'ASSUMPTION_RETIRED',             // payload: { id, reason }
  ASSUMPTION_DIAL_CHANGED: 'ASSUMPTION_DIAL_CHANGED',   // payload: { id, newDial }
  CITED_DECISION_EMITTED: 'CITED_DECISION_EMITTED',     // payload: { nodeId, citedDecision }
  EMOTIONAL_STATE_COMPUTED: 'EMOTIONAL_STATE_COMPUTED', // payload: { nodeId, emotionalState }
  CALIBRATION_METRIC_UPDATED: 'CALIBRATION_METRIC_UPDATED', // payload: { predicateKey, style, street, metric }
  DRILL_SESSION_STARTED: 'DRILL_SESSION_STARTED',       // payload: drillSession init
  DRILL_CARD_REVEALED: 'DRILL_CARD_REVEALED',           // payload: { cardIndex, assumptionId }
  DRILL_CARD_ANSWERED: 'DRILL_CARD_ANSWERED',           // payload: { cardIndex, answer, dialOverride?, retryQueued }
  DRILL_SESSION_COMPLETED: 'DRILL_SESSION_COMPLETED',   // no payload
  DRILL_SESSION_ABANDONED: 'DRILL_SESSION_ABANDONED',   // no payload
  SCHEMA_MIGRATION_RAN: 'SCHEMA_MIGRATION_RAN',         // payload: { from, to, count }
  CLEAR_ALL: 'CLEAR_ALL',                                // reset (used by tests + admin)
});

// =============================================================================
// INITIAL STATE
// =============================================================================

export const initialAssumptionState = {
  // Assumption table: id → VillainAssumption
  assumptions: {},

  // Per-villain actionable subset: villainId → assumptionId[]
  activeByVillain: {},

  // Per-villain tendency snapshot used by baselineSynthesis (style + observedRates).
  // Populated by seed flow + future tendency-loader; sidecar to assumptions store.
  villainTendencies: {},

  // Categorizations (emergent): villainId → VillainCategorization
  categorizations: {},

  // Emotional state cache: nodeId → EmotionalState
  emotionalStateCache: {},

  // Cited decision cache: nodeId → CitedDecision
  citedDecisionCache: {},

  // Calibration metrics: keyed by "predicateKey|style|street"
  calibrationMetrics: {},

  // Current drill session (null when no active drill)
  drillSession: null,

  // Schema version the state was last produced against
  schemaVersion: SCHEMA_VERSION,
};

// =============================================================================
// RAW REDUCER
// =============================================================================

/**
 * Pure reducer. `createValidatedReducer` wraps this with schema validation.
 *
 * @param {Object} state
 * @param {{ type: string, payload?: any }} action
 * @returns {Object} New state
 */
const rawAssumptionReducer = (state = initialAssumptionState, action) => {
  if (!action || typeof action.type !== 'string') return state;

  switch (action.type) {
    case ASSUMPTION_ACTIONS.ASSUMPTION_PRODUCED: {
      const a = action.payload;
      if (!a || typeof a.id !== 'string') return state;

      const nextAssumptions = { ...state.assumptions, [a.id]: a };
      const isActive = a.quality?.actionableInDrill === true || a.quality?.actionableLive === true;
      const nextActiveByVillain = updateActiveByVillain(state.activeByVillain, a, isActive);
      const nextVillainTendencies = extractTendencyFromAssumption(state.villainTendencies, a);

      return {
        ...state,
        assumptions: nextAssumptions,
        activeByVillain: nextActiveByVillain,
        villainTendencies: nextVillainTendencies,
      };
    }

    case ASSUMPTION_ACTIONS.ASSUMPTIONS_BULK_LOADED: {
      const records = Array.isArray(action.payload) ? action.payload : [];
      const nextAssumptions = { ...state.assumptions };
      const nextActiveByVillain = { ...state.activeByVillain };
      let nextVillainTendencies = state.villainTendencies;
      for (const a of records) {
        if (!a || typeof a.id !== 'string') continue;
        nextAssumptions[a.id] = a;
        const isActive = a.quality?.actionableInDrill === true || a.quality?.actionableLive === true;
        Object.assign(nextActiveByVillain, updateActiveByVillain(nextActiveByVillain, a, isActive));
        nextVillainTendencies = extractTendencyFromAssumption(nextVillainTendencies, a);
      }
      return {
        ...state,
        assumptions: nextAssumptions,
        activeByVillain: nextActiveByVillain,
        villainTendencies: nextVillainTendencies,
      };
    }

    case ASSUMPTION_ACTIONS.VILLAIN_TENDENCY_LOADED: {
      const t = action.payload;
      if (!t || typeof t.villainId !== 'string') return state;
      return {
        ...state,
        villainTendencies: { ...state.villainTendencies, [t.villainId]: t },
      };
    }

    case ASSUMPTION_ACTIONS.VILLAIN_TENDENCIES_BULK_LOADED: {
      const records = Array.isArray(action.payload) ? action.payload : [];
      if (records.length === 0) return state;
      const next = { ...state.villainTendencies };
      for (const t of records) {
        if (!t || typeof t.villainId !== 'string') continue;
        next[t.villainId] = t;
      }
      return { ...state, villainTendencies: next };
    }

    case ASSUMPTION_ACTIONS.ASSUMPTION_RETIRED: {
      const { id, reason } = action.payload || {};
      if (!id || !state.assumptions[id]) return state;

      const retired = {
        ...state.assumptions[id],
        status: 'retired',
        retirementReason: reason || 'unspecified',
      };
      const nextAssumptions = { ...state.assumptions, [id]: retired };
      // Remove from active list
      const nextActiveByVillain = updateActiveByVillain(state.activeByVillain, retired, false);
      return { ...state, assumptions: nextAssumptions, activeByVillain: nextActiveByVillain };
    }

    case ASSUMPTION_ACTIONS.ASSUMPTION_DIAL_CHANGED: {
      const { id, newDial } = action.payload || {};
      if (!id || !state.assumptions[id]) return state;
      if (typeof newDial !== 'number' || newDial < 0 || newDial > 1) return state;

      const updated = {
        ...state.assumptions[id],
        operator: {
          ...state.assumptions[id].operator,
          currentDial: newDial,
        },
      };
      return { ...state, assumptions: { ...state.assumptions, [id]: updated } };
    }

    case ASSUMPTION_ACTIONS.CITED_DECISION_EMITTED: {
      const { nodeId, citedDecision } = action.payload || {};
      if (!nodeId || !citedDecision) return state;
      return {
        ...state,
        citedDecisionCache: { ...state.citedDecisionCache, [nodeId]: citedDecision },
      };
    }

    case ASSUMPTION_ACTIONS.EMOTIONAL_STATE_COMPUTED: {
      const { nodeId, emotionalState } = action.payload || {};
      if (!nodeId || !emotionalState) return state;
      return {
        ...state,
        emotionalStateCache: { ...state.emotionalStateCache, [nodeId]: emotionalState },
      };
    }

    case ASSUMPTION_ACTIONS.CALIBRATION_METRIC_UPDATED: {
      const { predicateKey, style, street, metric } = action.payload || {};
      if (!predicateKey || !metric) return state;
      const key = `${predicateKey}|${style || 'ALL'}|${street || 'ALL'}`;
      return {
        ...state,
        calibrationMetrics: { ...state.calibrationMetrics, [key]: metric },
      };
    }

    case ASSUMPTION_ACTIONS.DRILL_SESSION_STARTED: {
      const session = action.payload;
      if (!session || typeof session.sessionId !== 'string') return state;
      return { ...state, drillSession: { ...session, cardsShown: [] } };
    }

    case ASSUMPTION_ACTIONS.DRILL_CARD_REVEALED: {
      const { cardIndex, assumptionId } = action.payload || {};
      if (state.drillSession == null) return state;
      const current = state.drillSession.cardsShown || [];
      // Add the card entry (or update if already exists)
      const existing = current.findIndex((c) => c.cardIndex === cardIndex);
      const entry = {
        cardIndex,
        assumptionId,
        revealedAt: new Date().toISOString(),
        heroAnswered: null,
        dialOverride: null,
        retryQueued: false,
      };
      const nextCards = existing >= 0
        ? [...current.slice(0, existing), { ...current[existing], ...entry }, ...current.slice(existing + 1)]
        : [...current, entry];
      return { ...state, drillSession: { ...state.drillSession, cardsShown: nextCards } };
    }

    case ASSUMPTION_ACTIONS.DRILL_CARD_ANSWERED: {
      const { cardIndex, answer, dialOverride, retryQueued = false } = action.payload || {};
      if (state.drillSession == null) return state;
      const current = state.drillSession.cardsShown || [];
      const idx = current.findIndex((c) => c.cardIndex === cardIndex);
      if (idx === -1) return state;
      const updated = {
        ...current[idx],
        heroAnswered: answer,
        dialOverride: typeof dialOverride === 'number' ? dialOverride : null,
        retryQueued,
      };
      const nextCards = [...current.slice(0, idx), updated, ...current.slice(idx + 1)];
      return { ...state, drillSession: { ...state.drillSession, cardsShown: nextCards } };
    }

    case ASSUMPTION_ACTIONS.DRILL_SESSION_COMPLETED: {
      if (state.drillSession == null) return state;
      return {
        ...state,
        drillSession: {
          ...state.drillSession,
          completedAt: new Date().toISOString(),
        },
      };
    }

    case ASSUMPTION_ACTIONS.DRILL_SESSION_ABANDONED: {
      return { ...state, drillSession: null };
    }

    case ASSUMPTION_ACTIONS.SCHEMA_MIGRATION_RAN: {
      const { to } = action.payload || {};
      if (typeof to !== 'string') return state;
      return { ...state, schemaVersion: to };
    }

    case ASSUMPTION_ACTIONS.CLEAR_ALL:
      return { ...initialAssumptionState };

    default:
      return state;
  }
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract `_villainSnapshot` sidecar field on an assumption into the tendency
 * map. Returns the updated map (no-op if no snapshot or already present).
 * Snapshots are produced at production time per assumptionProducer; persisted
 * with the assumption record. Powers baselineSynthesis style lookup without
 * a separate IDB store.
 */
const extractTendencyFromAssumption = (current, assumption) => {
  const snap = assumption?._villainSnapshot;
  if (!snap || typeof snap.villainId !== 'string') return current;
  // Idempotent: if existing tendency for this villainId carries the same style,
  // skip the merge to avoid producing a new state object on every dispatch.
  const existing = current[snap.villainId];
  if (existing && existing.style === snap.style) return current;
  return { ...current, [snap.villainId]: { ...existing, ...snap } };
};

/**
 * Add/remove an assumption's id from the villain's active-list depending on
 * whether it's actionable. Returns the updated activeByVillain map.
 */
const updateActiveByVillain = (current, assumption, isActive) => {
  const villainId = assumption.villainId;
  if (!villainId) return current;

  const existing = current[villainId] || [];
  const filtered = existing.filter((id) => id !== assumption.id);

  if (isActive) {
    return { ...current, [villainId]: [...filtered, assumption.id] };
  }
  // Remove if no longer active
  if (filtered.length === 0) {
    const { [villainId]: _removed, ...rest } = current;
    return rest;
  }
  return { ...current, [villainId]: filtered };
};

// =============================================================================
// VALIDATED REDUCER
// =============================================================================

const ASSUMPTION_STATE_SCHEMA = {
  assumptions: { type: 'object', required: true },
  activeByVillain: { type: 'object', required: true },
  categorizations: { type: 'object', required: true },
  emotionalStateCache: { type: 'object', required: true },
  citedDecisionCache: { type: 'object', required: true },
  calibrationMetrics: { type: 'object', required: true },
  villainTendencies: { type: 'object', required: true },
  drillSession: { type: 'object', required: false }, // null allowed when required: false
  schemaVersion: { type: 'string', required: true },
};

export const assumptionReducer = createValidatedReducer(
  rawAssumptionReducer,
  ASSUMPTION_STATE_SCHEMA,
  'AssumptionReducer',
);

// =============================================================================
// ACTION CREATORS (optional convenience — consumers may dispatch manually)
// =============================================================================

export const assumptionProduced = (assumption) => ({
  type: ASSUMPTION_ACTIONS.ASSUMPTION_PRODUCED,
  payload: assumption,
});

export const assumptionsBulkLoaded = (assumptions) => ({
  type: ASSUMPTION_ACTIONS.ASSUMPTIONS_BULK_LOADED,
  payload: assumptions,
});

export const villainTendencyLoaded = (villainTendency) => ({
  type: ASSUMPTION_ACTIONS.VILLAIN_TENDENCY_LOADED,
  payload: villainTendency,
});

export const villainTendenciesBulkLoaded = (tendencies) => ({
  type: ASSUMPTION_ACTIONS.VILLAIN_TENDENCIES_BULK_LOADED,
  payload: tendencies,
});

export const assumptionRetired = (id, reason) => ({
  type: ASSUMPTION_ACTIONS.ASSUMPTION_RETIRED,
  payload: { id, reason },
});

export const assumptionDialChanged = (id, newDial) => ({
  type: ASSUMPTION_ACTIONS.ASSUMPTION_DIAL_CHANGED,
  payload: { id, newDial },
});

export const citedDecisionEmitted = (nodeId, citedDecision) => ({
  type: ASSUMPTION_ACTIONS.CITED_DECISION_EMITTED,
  payload: { nodeId, citedDecision },
});

export const emotionalStateComputed = (nodeId, emotionalState) => ({
  type: ASSUMPTION_ACTIONS.EMOTIONAL_STATE_COMPUTED,
  payload: { nodeId, emotionalState },
});

export const calibrationMetricUpdated = (predicateKey, style, street, metric) => ({
  type: ASSUMPTION_ACTIONS.CALIBRATION_METRIC_UPDATED,
  payload: { predicateKey, style, street, metric },
});

export const drillSessionStarted = (session) => ({
  type: ASSUMPTION_ACTIONS.DRILL_SESSION_STARTED,
  payload: session,
});

export const drillCardRevealed = (cardIndex, assumptionId) => ({
  type: ASSUMPTION_ACTIONS.DRILL_CARD_REVEALED,
  payload: { cardIndex, assumptionId },
});

export const drillCardAnswered = (cardIndex, answer, dialOverride, retryQueued) => ({
  type: ASSUMPTION_ACTIONS.DRILL_CARD_ANSWERED,
  payload: { cardIndex, answer, dialOverride, retryQueued },
});

export const drillSessionCompleted = () => ({
  type: ASSUMPTION_ACTIONS.DRILL_SESSION_COMPLETED,
});

export const drillSessionAbandoned = () => ({
  type: ASSUMPTION_ACTIONS.DRILL_SESSION_ABANDONED,
});

export const clearAllAssumptions = () => ({
  type: ASSUMPTION_ACTIONS.CLEAR_ALL,
});
