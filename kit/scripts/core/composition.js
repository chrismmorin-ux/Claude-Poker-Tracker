/**
 * composition.js — command_id threading + multi-track orchestration.
 *
 * ADR-018 step 1, WS-171. Every event emitted during one command
 * invocation shares a `command_id`. Propagation across processes is
 * via the `CWOS_COMMAND_ID` environment variable so sub-processes and
 * sub-agents inherit it. Zero external dependencies.
 *
 * The falsification-test result (ADR-018 §Why this way) found that 12
 * of 20 classifiable commits spanned 2+ tracks — one command routinely
 * fires multiple state transitions. This module is what lets us
 * reconstruct which events belong to the same invocation.
 */

'use strict';

require('../lib/preflight');

const crypto = require('crypto');

const { readAllChunks } = require('./events');

const ENV_VAR = 'CWOS_COMMAND_ID';
const ID_PATTERN = /^cmd(-[a-z0-9]+)?-[0-9a-z]{16,}$/i;

/**
 * Generate a fresh, sortable command_id. Format: `cmd-<prefix>-<time36><rand>`
 * where time36 is the millisecond epoch in base-36 (sorts chronologically)
 * and rand is 48 bits of entropy. prefix is optional and cosmetic — useful
 * for telemetry ("cmd-next-...", "cmd-status-...").
 */
function newCommandId(prefix) {
  const now = Date.now().toString(36);
  const rand = crypto.randomBytes(6).toString('hex');
  if (prefix) return `cmd-${String(prefix).toLowerCase().replace(/[^a-z0-9]/g, '')}-${now}${rand}`;
  return `cmd-${now}${rand}`;
}

/**
 * Return the current process's command_id, or null if unset. Callers that
 * need a guaranteed id should use ensureCommandId(), which generates one
 * if the env var is missing.
 */
function currentCommandId() {
  const v = process.env[ENV_VAR];
  return v && v.length > 0 ? v : null;
}

/**
 * Ensure the process has a command_id. If one is already set in the
 * environment, return it. Otherwise generate one, set the env var so
 * child processes inherit it, and return it.
 */
function ensureCommandId(prefix) {
  const existing = currentCommandId();
  if (existing) return existing;
  const id = newCommandId(prefix);
  process.env[ENV_VAR] = id;
  return id;
}

/**
 * Run `fn` with CWOS_COMMAND_ID set to `id`, restoring the previous value
 * after. Supports both sync and async functions — detected by return
 * value being thenable. Always restores even if `fn` throws.
 */
function withCommandId(id, fn) {
  if (!id || typeof id !== 'string') throw new Error('withCommandId: id must be a non-empty string');
  const prev = process.env[ENV_VAR];
  process.env[ENV_VAR] = id;
  const restore = () => {
    if (prev === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = prev;
  };
  let result;
  try {
    result = fn();
  } catch (err) {
    restore();
    throw err;
  }
  if (result && typeof result.then === 'function') {
    return Promise.resolve(result).then(
      (v) => { restore(); return v; },
      (err) => { restore(); throw err; },
    );
  }
  restore();
  return result;
}

/**
 * Return all events with a matching command_id, across every chunk.
 * Events are returned in write order (chunks sorted by date + events
 * sorted within chunk by file order). Options:
 *   { workstreamDir }  — explicit workstream dir (default: findWorkstreamDir)
 *   { includeWarnings } — also return the reader's warnings array
 */
function findByCommandId(commandId, opts = {}) {
  if (!commandId || typeof commandId !== 'string') {
    throw new Error('findByCommandId: commandId must be a non-empty string');
  }
  const { events, warnings } = readAllChunks(opts.workstreamDir);
  const matched = events.filter((ev) => ev.command_id === commandId);
  if (opts.includeWarnings) return { events: matched, warnings };
  return matched;
}

module.exports = {
  ENV_VAR,
  ID_PATTERN,
  newCommandId,
  currentCommandId,
  ensureCommandId,
  withCommandId,
  findByCommandId,
};
