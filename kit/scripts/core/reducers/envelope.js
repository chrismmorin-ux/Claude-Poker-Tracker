/**
 * reducers/envelope.js — T0:envelope reducer (WS-190, ADR-020 Phase A).
 *
 * Materializes state/envelope.json from T0:envelope events:
 *   - command_started  → insert active record
 *   - command_completed → update → mark completed
 *   - command_failed    → update → mark failed
 *
 * Pure function. No I/O, no Date.now(), no mutation of inputs. State-store
 * dispatches events and persists the returned patch atomically.
 *
 * Signature: reduce(event, allDomainsState, ctx) → { envelope: newDomainFile }
 * Returns undefined (no-op) for unknown event types — dispatch detects
 * same-reference return and skips writes.
 */

'use strict';

const TRACK = 'T0:envelope';
const DOMAIN = 'envelope';
const SCHEMA_VERSION = 1;

const STARTED = 'command_started';
const COMPLETED = 'command_completed';
const FAILED = 'command_failed';
const TELEMETRY_STAMPED = 'command_telemetry_stamped';

function reduce(event, allState, ctx) {
  if (!event || event.source_track !== TRACK) return undefined;
  const priorDomain = allState[DOMAIN] || emptyDomain();
  const payloadType = event.payload && event.payload.type;

  if (payloadType !== STARTED && payloadType !== COMPLETED && payloadType !== FAILED && payloadType !== TELEMETRY_STAMPED) {
    return undefined;
  }

  const priorItems = priorDomain.items || {};
  const cid = event.command_id;
  if (!cid) return undefined;   // defensive — envelope events must carry command_id

  const prior = priorItems[cid] || {};
  let nextItem;

  if (payloadType === STARTED) {
    nextItem = {
      command_id: cid,
      tag: event.track_tag || null,
      started_at: event.timestamp || null,
      started_event: event.id || null,
      transcript_mark_start: (event.payload && event.payload.transcript_mark) || null,
    };
  } else if (payloadType === COMPLETED) {
    nextItem = Object.assign({}, prior, {
      command_id: cid,
      tag: prior.tag || event.track_tag || null,
      completed_at: event.timestamp || null,
      completed_event: event.id || null,
      exit_status: 'completed',
      transcript_mark_end: (event.payload && event.payload.transcript_mark) || null,
    });
  } else if (payloadType === FAILED) {
    nextItem = Object.assign({}, prior, {
      command_id: cid,
      tag: prior.tag || event.track_tag || null,
      completed_at: event.timestamp || null,
      completed_event: event.id || null,
      exit_status: 'failed',
      failure_reason: (event.payload && event.payload.reason) || null,
      transcript_mark_end: (event.payload && event.payload.transcript_mark) || null,
    });
  } else {
    // TELEMETRY_STAMPED — merge tool_rounds_actual + tokens_derived + tool_rounds_by_type
    // (WS-271) onto the existing record. Skip silently if no prior record exists for this
    // command_id (telemetry arriving without a started/completed pair is a corrupted state,
    // not a reducer bug).
    if (!prior.command_id) return undefined;
    nextItem = Object.assign({}, prior, {
      tool_rounds_actual: (event.payload && event.payload.tool_rounds_actual) || null,
      tool_rounds_by_type: (event.payload && event.payload.tool_rounds_by_type) || null,
      chars_total: (event.payload && event.payload.chars_total) || null,
      tokens_derived: (event.payload && event.payload.tokens_derived) || null,
      telemetry_event: event.id || null,
    });
  }

  // No structural change short-circuit
  if (deepEqual(prior, nextItem)) return undefined;

  const newItems = Object.assign({}, priorItems, { [cid]: nextItem });
  const newDomain = {
    schema_version: SCHEMA_VERSION,
    domain: DOMAIN,
    updated_at: event.timestamp || (ctx && ctx.timestamp) || null,
    updated_by_event: event.id || null,
    items: newItems,
  };
  return { [DOMAIN]: newDomain };
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

function deepEqual(a, b) {
  // Small, targeted equality check for our flat item shape. Sufficient
  // for the reducer's same-state short-circuit; don't over-engineer.
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

// Self-register when called. Idempotent-in-practice: the reducer is pure
// and its short-circuit returns undefined on unchanged state, so
// double-registration at worst applies the reducer twice and the second
// application no-ops. No module-level flag — tests that clear the
// registry can re-register cleanly.
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
