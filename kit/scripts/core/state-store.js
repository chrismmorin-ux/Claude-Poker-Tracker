/**
 * state-store.js — canonical-state runtime (ADR-020 step 2, WS-189).
 *
 * Loads materialized state from `.claude/workstream/state/*.json`,
 * exposes a typed-API read surface with O(1) / O(n) deterministic
 * lookups on indexed keys, and drives reducer dispatch when
 * events.appendEvent appends a new event.
 *
 * Design (per ADR-020 + WS-189 plan):
 *   - One JSON file per domain (envelope, queue, findings, sprints,
 *     programs, config, sessions)
 *   - Indexes built on load (by_id, by_status, by_program) — no
 *     persisted index files; zero drift risk
 *   - Reducers are pure functions: (event, domainState, ctx) → newDomainState
 *   - Dispatch is synchronous in events.appendEvent (state always in
 *     sync with event log); lazy-required there with guarded try/catch
 *     so a state-store failure is non-fatal to the append
 *   - Atomic writes via writeFileAtomic (hardlink-safe, size-gated)
 *
 * Zero external dependencies.
 */

'use strict';

require('../lib/preflight');

const fs = require('fs');
const path = require('path');

const { findWorkstreamDir, writeFileAtomic } = require('../lib/cwos-utils');

const ENV_VAR_DISABLE = 'CWOS_STATE_STORE_DISABLED';
const ENV_VAR_LAG_THRESHOLD = 'CWOS_STATE_LAG_THRESHOLD';
const SCHEMA_VERSION = 2;
const LAG_THRESHOLD_DEFAULT = 100;

// Every domain ships with these keys even before any reducer populates it.
const DEFAULT_DOMAINS = ['envelope', 'queue', 'findings', 'sprints', 'programs', 'config', 'sessions', 'engines'];

// Each domain can declare which fields become indexes. The typed-API
// accessors below use these to expose byX() lookups.
const DOMAIN_INDEXES = {
  envelope:  ['command_id'],
  queue:     ['id', 'status', 'program'],
  findings:  ['id', 'status', 'program', 'severity'],
  sprints:   ['id', 'status', 'program_focus'],
  programs:  ['id', 'tier'],
  sessions:  ['id', 'status'],
  engines:   [], // keyed by program_id directly; byId() walks _byKey
  config:    [], // scalar key-value; no item indexes
};

// ─── Reducer registry ─────────────────────────────────────────────────────

// Map: track-name → [reducer-fn, ...]. Reducers self-register at
// require time from kit/scripts/core/reducers/*.js modules.
const REDUCER_REGISTRY = new Map();

function registerReducer(track, fn) {
  if (typeof track !== 'string' || track.length === 0) {
    throw new Error('registerReducer: track must be a non-empty string');
  }
  if (typeof fn !== 'function') {
    throw new Error('registerReducer: fn must be a function');
  }
  if (!REDUCER_REGISTRY.has(track)) REDUCER_REGISTRY.set(track, []);
  REDUCER_REGISTRY.get(track).push(fn);
}

function clearReducers() { REDUCER_REGISTRY.clear(); } // test-only

// ─── State-store instance ─────────────────────────────────────────────────

function stateDir(workstreamDir) {
  const ws = workstreamDir || findWorkstreamDir();
  return path.join(ws, 'state');
}

function emptyDomainFile(name) {
  return {
    schema_version: SCHEMA_VERSION,
    domain: name,
    updated_at: null,
    updated_by_event: null,
    last_event_log_head: null,
    items: name === 'config' ? {} : {},
  };
}

function loadState(workstreamDir) {
  // WS-274: self-heal — migrate any legacy v1 state files to current
  // schema in place before loading. Idempotent; no-op on already-current.
  try { migrateStateSchema(workstreamDir, SCHEMA_VERSION); } catch { /* non-fatal */ }

  const dir = stateDir(workstreamDir);
  const domains = {};
  for (const name of DEFAULT_DOMAINS) {
    const file = path.join(dir, `${name}.json`);
    if (fs.existsSync(file)) {
      try { domains[name] = JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch { domains[name] = emptyDomainFile(name); }
    } else {
      domains[name] = emptyDomainFile(name);
    }
  }
  return instance(workstreamDir, domains);
}

/**
 * WS-274: migrate state/*.json files from older schema versions in place.
 * Idempotent — files already at toVersion are skipped. Per-version steps:
 *
 *   1 → 2: add `last_event_log_head` (initialize to existing `updated_by_event`
 *          when present, else null). Bump schema_version.
 *
 * Future bumps add another step here. This function is called automatically
 * from loadState(); the cwos-migrate.js CLI exposes it as `--state-schema`.
 */
function migrateStateSchema(workstreamDir, toVersion) {
  const dir = stateDir(workstreamDir);
  if (!fs.existsSync(dir)) return { migrated: [], skipped: [] };
  const target = typeof toVersion === 'number' ? toVersion : SCHEMA_VERSION;
  const migrated = [];
  const skipped = [];

  for (const name of DEFAULT_DOMAINS) {
    const file = path.join(dir, `${name}.json`);
    if (!fs.existsSync(file)) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { skipped.push({ domain: name, reason: 'parse-failed' }); continue; }
    const fromVersion = typeof data.schema_version === 'number' ? data.schema_version : 1;
    if (fromVersion >= target) { skipped.push({ domain: name, reason: 'already-current', version: fromVersion }); continue; }

    // Apply step 1 → 2.
    if (fromVersion < 2 && target >= 2) {
      if (!('last_event_log_head' in data)) {
        data.last_event_log_head = data.updated_by_event || null;
      }
    }
    // Future: if (fromVersion < 3 && target >= 3) { ... }

    data.schema_version = target;
    writeFileAtomic(file, JSON.stringify(data, null, 2) + '\n');
    migrated.push({ domain: name, from: fromVersion, to: target });
  }
  return { migrated, skipped };
}

/**
 * WS-274: compat() — schema-version handshake + lag visibility.
 *
 * Returns a structured envelope describing each domain's compatibility with
 * the current kit's expected schema version, plus a lag count vs the event
 * log head. Soft posture: never throws, never modifies state. Callers that
 * want hard rejection drive it from this output.
 */
function compat(workstreamDir, opts) {
  const ws = workstreamDir || findWorkstreamDir();
  const lagThreshold = (opts && typeof opts.lagThreshold === 'number')
    ? opts.lagThreshold
    : (Number(process.env[ENV_VAR_LAG_THRESHOLD]) || LAG_THRESHOLD_DEFAULT);

  // Lazy require to avoid circular dep: events.js loads state-store lazily.
  let allEvents = [];
  try {
    const eventsMod = require('./events');
    const r = eventsMod.readAllChunks(ws);
    allEvents = r.events || [];
  } catch { /* events module absent or unreadable; treat log as empty */ }

  const eventIdToIndex = new Map();
  for (let i = 0; i < allEvents.length; i++) {
    if (allEvents[i] && allEvents[i].id) eventIdToIndex.set(allEvents[i].id, i);
  }
  const currentLogHeadId = allEvents.length > 0 ? allEvents[allEvents.length - 1].id : null;

  const dir = stateDir(ws);
  const domains = {};
  const warnings = [];
  let allOk = true;

  for (const name of DEFAULT_DOMAINS) {
    const file = path.join(dir, `${name}.json`);
    if (!fs.existsSync(file)) {
      domains[name] = {
        schema_version: null,
        schema_match: true,        // missing file is not a mismatch — treated as fresh-init
        last_event_log_head: null,
        lag: 0,
        lag_threshold: lagThreshold,
        lag_exceeded: false,
        present: false,
      };
      continue;
    }
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (err) {
      domains[name] = {
        schema_version: null,
        schema_match: false,
        last_event_log_head: null,
        lag: 0,
        lag_threshold: lagThreshold,
        lag_exceeded: false,
        present: true,
        parse_error: err.message,
      };
      warnings.push(`${name}: parse failed (${err.message})`);
      allOk = false;
      continue;
    }

    const sv = typeof data.schema_version === 'number' ? data.schema_version : 1;
    const schemaMatch = sv === SCHEMA_VERSION;
    if (!schemaMatch) {
      warnings.push(`${name}: schema_version ${sv} does not match expected ${SCHEMA_VERSION}`);
      allOk = false;
    }

    const head = data.last_event_log_head || data.updated_by_event || null;
    const everMaterialized = head !== null || data.updated_at !== null;
    let lag = 0;
    let lagExceeded = false;
    if (allEvents.length === 0) {
      lag = 0;
    } else if (!everMaterialized) {
      // Domain skeleton was created but no reducer ever wrote to it
      // (e.g., config/sessions today). "Lag" is undefined here, not the
      // total event count — treat as 0 to avoid false-positive warnings.
      lag = 0;
    } else if (!head) {
      lag = allEvents.length;
    } else if (eventIdToIndex.has(head)) {
      lag = (allEvents.length - 1) - eventIdToIndex.get(head);
    } else {
      // head references an event not in the log — treat as max lag.
      lag = Number.POSITIVE_INFINITY;
    }
    if (lag > lagThreshold) {
      lagExceeded = true;
      warnings.push(`${name}: lag ${lag === Infinity ? 'Infinity' : lag} exceeds threshold ${lagThreshold}`);
      allOk = false;
    }

    domains[name] = {
      schema_version: sv,
      schema_match: schemaMatch,
      last_event_log_head: head,
      lag: lag === Infinity ? 'Infinity' : lag,
      lag_threshold: lagThreshold,
      lag_exceeded: lagExceeded,
      present: true,
    };
  }

  return {
    ok: allOk,
    expected_schema_version: SCHEMA_VERSION,
    current_log_head_id: currentLogHeadId,
    domains,
    warnings,
  };
}

function buildIndexes(domainName, items) {
  const keys = DOMAIN_INDEXES[domainName] || [];
  const idx = {};
  for (const key of keys) idx[key] = new Map();
  for (const [itemKey, item] of Object.entries(items || {})) {
    for (const key of keys) {
      const val = item && item[key];
      if (val === undefined || val === null) continue;
      if (!idx[key].has(val)) idx[key].set(val, []);
      idx[key].get(val).push(item);
    }
    // Always make byItemKey available via 'items_by_key'
    if (!idx._byKey) idx._byKey = new Map();
    idx._byKey.set(itemKey, item);
  }
  if (!idx._byKey) idx._byKey = new Map();
  return idx;
}

function accessorFor(domainName, rawGetter) {
  const idxGetter = () => buildIndexes(domainName, rawGetter().items);
  return {
    all: () => Object.values(rawGetter().items || {}),
    byId: (id) => {
      const i = idxGetter();
      if (i.id && i.id.has(id)) return i.id.get(id)[0] || null;
      return i._byKey && i._byKey.has(id) ? i._byKey.get(id) : null;
    },
    byStatus: (status) => {
      const i = idxGetter();
      return (i.status && i.status.get(status)) || [];
    },
    byProgram: (program) => {
      const i = idxGetter();
      return (i.program && i.program.get(program)) || [];
    },
    bySeverity: (severity) => {
      const i = idxGetter();
      return (i.severity && i.severity.get(severity)) || [];
    },
    byTier: (tier) => {
      const i = idxGetter();
      return (i.tier && i.tier.get(tier)) || [];
    },
    byProgramFocus: (program) => {
      const i = idxGetter();
      return (i.program_focus && i.program_focus.get(program)) || [];
    },
    byCommandId: (cid) => {
      const i = idxGetter();
      return (i.command_id && i.command_id.get(cid) && i.command_id.get(cid)[0]) || null;
    },
  };
}

function envelopeAccessor(rawGetter) {
  const base = accessorFor('envelope', rawGetter);
  return Object.assign({}, base, {
    active: () => base.all().filter((e) => e && e.exit_status === undefined),
    recent: (n) => {
      const completed = base.all()
        .filter((e) => e && e.completed_at)
        .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
      return completed.slice(0, n || 20);
    },
  });
}

function sprintsAccessor(rawGetter) {
  const base = accessorFor('sprints', rawGetter);
  return Object.assign({}, base, {
    active: () => base.all().filter((s) => s && s.status === 'approved'),
  });
}

function programsAccessor(rawGetter) {
  const base = accessorFor('programs', rawGetter);
  return Object.assign({}, base, {
    active: () => base.all().filter((p) => p && p.tier && p.tier !== 'dormant'),
  });
}

function sessionsAccessor(rawGetter) {
  const base = accessorFor('sessions', rawGetter);
  return Object.assign({}, base, {
    active: () => base.all().filter((s) => s && s.status === 'active'),
    recent: (n) => base.all()
      .filter((s) => s && s.ended_at)
      .sort((a, b) => (b.ended_at || '').localeCompare(a.ended_at || ''))
      .slice(0, n || 10),
  });
}

function configAccessor(rawGetter) {
  return {
    all: () => rawGetter().items || {},
    get: (key) => (rawGetter().items || {})[key],
  };
}

function enginesAccessor(rawGetter) {
  const base = accessorFor('engines', rawGetter);
  return Object.assign({}, base, {
    historyCount: (programId) => {
      const entry = base.byId(programId);
      return (entry && Array.isArray(entry.runs)) ? entry.runs.length : 0;
    },
  });
}

// ─── Stamp + atomic write + dispatch ──────────────────────────────────────

/**
 * WS-274: stamp current schema_version + last_event_log_head onto a
 * reducer-produced domain patch. Both _dispatch (live appends) and
 * replayToMemory (cwos-replay reconstruction) call this so the on-disk
 * shape is identical regardless of code path. Synchronous dispatch ⇒
 * the event being processed IS the log head at materialization time.
 */
function stampDomainPatch(domainState, eventId) {
  return Object.assign({}, domainState, {
    schema_version: SCHEMA_VERSION,
    last_event_log_head: eventId || domainState.last_event_log_head || null,
  });
}

function persistDomain(workstreamDir, domainName, domainFile) {
  const dir = stateDir(workstreamDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${domainName}.json`);
  const content = JSON.stringify(domainFile, null, 2) + '\n';
  writeFileAtomic(file, content);
}

// Build a full stateStore instance bound to a workstreamDir + initial snapshot
function instance(workstreamDir, initialDomains) {
  let _domains = initialDomains;
  const api = {
    workstreamDir,
    get domains() { return _domains; },
    load() {
      _domains = {};
      for (const name of DEFAULT_DOMAINS) {
        const file = path.join(stateDir(workstreamDir), `${name}.json`);
        if (fs.existsSync(file)) {
          try { _domains[name] = JSON.parse(fs.readFileSync(file, 'utf8')); }
          catch { _domains[name] = emptyDomainFile(name); }
        } else {
          _domains[name] = emptyDomainFile(name);
        }
      }
      return api;
    },
    _rawState: () => _domains,
    dispatch(event, ctx) {
      return _dispatch(api, workstreamDir, _domains, event, ctx);
    },
    _replaceDomains(nextDomains) { _domains = nextDomains; },  // used by dispatch
  };
  // Install typed accessors on the instance
  api.envelope = envelopeAccessor(() => _domains.envelope || emptyDomainFile('envelope'));
  api.queue    = accessorFor('queue',    () => _domains.queue    || emptyDomainFile('queue'));
  api.findings = accessorFor('findings', () => _domains.findings || emptyDomainFile('findings'));
  api.sprints  = sprintsAccessor(() => _domains.sprints || emptyDomainFile('sprints'));
  api.programs = programsAccessor(() => _domains.programs || emptyDomainFile('programs'));
  api.sessions = sessionsAccessor(() => _domains.sessions || emptyDomainFile('sessions'));
  api.engines  = enginesAccessor(() => _domains.engines || emptyDomainFile('engines'));
  api.config   = configAccessor(() => _domains.config || emptyDomainFile('config'));
  return api;
}

function _dispatch(storeApi, workstreamDir, domains, event, ctx) {
  if (process.env[ENV_VAR_DISABLE] === '1') {
    return { ok: true, disabled: true, domainsChanged: [], errors: [] };
  }
  if (!event || typeof event !== 'object') {
    return { ok: false, errors: ['dispatch: event must be an object'] };
  }
  const track = event.source_track;
  const reducers = REDUCER_REGISTRY.get(track) || [];
  if (reducers.length === 0) {
    return { ok: true, domainsChanged: [], errors: [] };
  }

  const effectiveCtx = Object.assign({
    timestamp: event.timestamp,
    eventId: event.id,
    workstreamDir,
  }, ctx || {});

  const changed = new Set();
  const errors = [];
  const next = Object.assign({}, domains);

  for (const reducer of reducers) {
    let result;
    try {
      // Reducer signature: (event, allDomainsState, ctx) → patch
      // patch is { <domainName>: <newDomainFile>, ... } OR undefined
      result = reducer(event, next, effectiveCtx);
    } catch (err) {
      errors.push(`reducer threw: ${err.message}`);
      continue;
    }
    if (!result || typeof result !== 'object') continue;
    for (const [domainName, newDomainState] of Object.entries(result)) {
      if (!DEFAULT_DOMAINS.includes(domainName)) {
        errors.push(`reducer produced unknown domain: ${domainName}`);
        continue;
      }
      if (next[domainName] === newDomainState) continue; // no-op
      next[domainName] = stampDomainPatch(newDomainState, event.id);
      changed.add(domainName);
    }
  }

  // Persist each changed domain atomically
  for (const name of changed) {
    try { persistDomain(workstreamDir, name, next[name]); }
    catch (err) { errors.push(`persist ${name} failed: ${err.message}`); }
  }

  storeApi._replaceDomains(next);

  return { ok: errors.length === 0, domainsChanged: Array.from(changed), errors };
}

// ─── Singleton + lazy load ───────────────────────────────────────────────

let _singleton = null;
let _reducersAutoLoaded = false;

// Auto-load every reducer module under kit/scripts/core/reducers/*.js
// on first singleton access. This is how cwos-event.js (and any other
// in-process caller) picks up the registered reducers without needing
// to call cwos-replay's loadAllReducers explicitly. Test code that
// wants full control should call clearReducers() + resetSingleton()
// and register reducers manually.
function autoLoadReducers() {
  if (_reducersAutoLoaded) return;
  _reducersAutoLoaded = true;
  const reducerDir = path.join(__dirname, 'reducers');
  if (!fs.existsSync(reducerDir)) return;
  for (const f of fs.readdirSync(reducerDir)) {
    if (!f.endsWith('.js') || f.startsWith('_')) continue;
    try {
      const mod = require(path.join(reducerDir, f));
      if (mod && typeof mod.register === 'function') mod.register(registerReducer);
    } catch { /* skip broken reducer module */ }
  }
}

function getSingleton(workstreamDir) {
  autoLoadReducers();
  if (_singleton && (!workstreamDir || _singleton.workstreamDir === workstreamDir)) {
    return _singleton;
  }
  _singleton = loadState(workstreamDir);
  return _singleton;
}

function resetSingleton() { _singleton = null; _reducersAutoLoaded = false; } // test-only

module.exports = {
  SCHEMA_VERSION,
  ENV_VAR_DISABLE,
  ENV_VAR_LAG_THRESHOLD,
  LAG_THRESHOLD_DEFAULT,
  DEFAULT_DOMAINS,
  DOMAIN_INDEXES,
  REDUCER_REGISTRY,
  registerReducer,
  clearReducers,
  stateDir,
  emptyDomainFile,
  loadState,
  persistDomain,
  migrateStateSchema,
  compat,
  stampDomainPatch,
  resetSingleton,
  get stateStore() { return getSingleton(); },
  // Convenience: call stateStore.<method>() — the singleton auto-loads
  // lazily on first access.
};
