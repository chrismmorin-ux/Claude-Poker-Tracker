/**
 * reducers/engines.js — T7:engines reducer (WS-263, ADR-037 Phase 2).
 *
 * Materializes state/engines.json from T7:engines events:
 *   - engine_run_completed → append a run record under items[program_id].runs
 *
 * Pure function. No I/O, no Date.now(), no mutation of inputs. State-store
 * dispatches events and persists the returned patch atomically.
 *
 * Replay-pure derivation: engine_history_count for a program = the length
 * of items[program_id].runs in this domain. WS-262 (Schema additions
 * Phase 1) reads from here; WS-261 (Replay-purity test harness) verifies
 * the derivation holds across replay.
 *
 * Idempotency: each event carries a unique event id (stamped by the
 * event-log layer). The reducer dedupes on event_id so a duplicate-event
 * write or replay is a no-op rather than counting twice.
 *
 * Signature: reduce(event, allDomainsState, ctx) → { engines: newDomainFile }
 * Returns undefined (no-op) for unknown event types or duplicate events.
 */

'use strict';

const TRACK = 'T7:engines';
const DOMAIN = 'engines';
const SCHEMA_VERSION = 1;

const COMPLETED = 'engine_run_completed';

function reduce(event, allState, _ctx) {
  if (!event || event.source_track !== TRACK) return undefined;
  const payload = event.payload;
  const payloadType = payload && payload.type;
  if (payloadType !== COMPLETED) return undefined;

  const programId = payload.program_id;
  const runId = payload.run_id;
  const engineId = payload.engine_id;
  if (!programId || !runId || !engineId) return undefined;

  const priorDomain = allState[DOMAIN] || emptyDomain();
  const priorItems = priorDomain.items || {};
  const priorEntry = priorItems[programId] || {
    program_id: programId,
    runs: [],
    last_run_at: null,
    last_event_id: null,
  };

  // Idempotency: if an event with this id already lives in the runs array,
  // bail out. Replay safety + double-write protection.
  if (event.id && Array.isArray(priorEntry.runs) && priorEntry.runs.some(r => r && r.event_id === event.id)) {
    return undefined;
  }

  const runRecord = {
    run_id: runId,
    engine_id: engineId,
    artifacts_dir: payload.artifacts_dir || null,
    completed_at: payload.completed_at || event.timestamp || null,
    event_id: event.id || null,
    backfilled: payload.backfilled === true ? true : undefined,
  };
  // Drop undefined keys so equality + JSON serialization stay clean.
  if (runRecord.backfilled === undefined) delete runRecord.backfilled;

  const nextEntry = {
    program_id: programId,
    runs: priorEntry.runs.concat([runRecord]),
    last_run_at: runRecord.completed_at || priorEntry.last_run_at,
    last_event_id: event.id || priorEntry.last_event_id,
  };

  const nextItems = Object.assign({}, priorItems, { [programId]: nextEntry });
  const nextDomain = {
    schema_version: SCHEMA_VERSION,
    domain: DOMAIN,
    updated_at: event.timestamp || null,
    updated_by_event: event.id || null,
    items: nextItems,
  };

  // WS-262: cross-domain output — also patch programs.json to update
  // engine_history_count for the affected program. Pure function of
  // nextEntry.runs.length; INV-044 verifies replay-purity. Skips if the
  // program has no entry in the programs domain (e.g., dormant or not
  // yet materialized via T11:vital-signs).
  const priorPrograms = allState.programs;
  let result = { [DOMAIN]: nextDomain };
  if (priorPrograms && priorPrograms.items && priorPrograms.items[programId]) {
    const priorProg = priorPrograms.items[programId];
    const newCount = nextEntry.runs.length;
    if (priorProg.engine_history_count !== newCount) {
      const updatedProg = Object.assign({}, priorProg, { engine_history_count: newCount });
      const updatedProgItems = Object.assign({}, priorPrograms.items, { [programId]: updatedProg });
      result.programs = Object.assign({}, priorPrograms, { items: updatedProgItems });
    }
  }
  return result;
}

function emptyDomain() {
  return {
    schema_version: SCHEMA_VERSION,
    domain: DOMAIN,
    updated_at: null,
    updated_by_event: null,
    items: {},
  };
}

function register(registerReducer) {
  registerReducer(TRACK, reduce);
}

module.exports = {
  TRACK,
  DOMAIN,
  SCHEMA_VERSION,
  reduce,
  register,
  emptyDomain,
};
