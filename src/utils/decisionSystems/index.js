/**
 * decisionSystems/ — shared infrastructure for the stateful decision-system
 * pattern (engine + IDB store + reducer + persistence hook + context).
 *
 * Public API barrel. Keep ≤ 12 named exports — anything larger is a sign
 * that the module is accreting concerns instead of consolidating them.
 *
 * See `CLAUDE.md` for the inclusion rule (who belongs, who doesn't) and
 * for the ADRs governing this module:
 *   - .claude/decisions/2026-05-14-decision-systems-extraction.md (ADR-1)
 *   - .claude/decisions/2026-05-14-idb-store-factory-migration-binding.md (ADR-2)
 */

// Accumulator
export { createAccumulator } from './accumulator/createAccumulator';
export {
  Z_95,
  applyEvent,
  mean,
  variance,
  standardDeviation,
  credibleInterval,
} from './accumulator/betaPosterior';
export { wilsonInterval } from './accumulator/wilsonCI';

// Registry
export { createRegistry } from './registry/createRegistry';

// IDB store factories
export { createUpsertStore } from './idbStore/createUpsertStore';
export { createReplaceAllStore } from './idbStore/createReplaceAllStore';
export { createEmbeddedRecordStore } from './idbStore/createEmbeddedRecordStore';
export { assertStoreRegistered, __testing__ } from './idbStore/migrationGuard';

// Reducer composition
export { createNamespacedReducer } from './reducerComposition/createNamespacedReducer';
export {
  withPersistenceDispatch,
  shouldPersistAction,
} from './reducerComposition/withPersistenceDispatch';
