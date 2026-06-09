/**
 * events.js — Shadow event log writer + reader + hash-chain validator.
 *
 * ADR-018 step 1, WS-170. Append-only hash-chained JSONL under
 * `.claude/workstream/events/`. Per-day chunk files (`YYYY-MM-DD.jsonl`);
 * `current.jsonl` is a pointer to today's chunk. Advisory lock via
 * O_EXCL on `events/.write.lock` (WA-006 single-writer assumption).
 * Inline payload is capped at 2KB — larger content spills to
 * `events/blobs/<sha>.json` with `{payload_ref, payload_hash}` in the
 * event.
 *
 * Zero external dependencies.
 */

'use strict';

require('../lib/preflight');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { findWorkstreamDir, withFileLock } = require('../lib/cwos-utils');
const { canonicalize, hashEvent } = require('./canonical-json');

const SCHEMA_VERSION = 1;
const PAYLOAD_INLINE_CAP_BYTES = 2048;
const ZERO_HASH = ''; // The chain's pre-first-event prior_hash is empty string (see schema).
const LOCK_FILENAME = '.write.lock';
const LOCK_MAX_WAIT_MS = 5000;
const LOCK_RETRY_MS = 25;

const SOURCE_TIERS = new Set(['founder-prompt', 'llm-emission', 'reducer-output', 'external-paste']);

// ─── Paths ─────────────────────────────────────────────────────────────────

function eventsDir(workstreamDir) {
  const ws = workstreamDir || findWorkstreamDir();
  return path.join(ws, 'events');
}

function blobsDir(workstreamDir) {
  return path.join(eventsDir(workstreamDir), 'blobs');
}

function chunkFileForDate(workstreamDir, date) {
  const d = date || new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return path.join(eventsDir(workstreamDir), `${yyyy}-${mm}-${dd}.jsonl`);
}

function currentPointer(workstreamDir) {
  return path.join(eventsDir(workstreamDir), 'current.jsonl');
}

function ensureDirs(workstreamDir) {
  fs.mkdirSync(eventsDir(workstreamDir), { recursive: true });
  fs.mkdirSync(blobsDir(workstreamDir), { recursive: true });
}

// ─── Advisory lock ─────────────────────────────────────────────────────────
//
// Thin wrapper over cwos-utils.js:withFileLock. The shared primitive provides
// stale-lock recovery (lockfile content includes ISO timestamp; locks older
// than staleAfterMs are presumed orphaned and auto-cleared). Without recovery,
// a crashed appender would leave .write.lock until manual cleanup — the
// failure mode behind FAIL-007's compound on the events hot path.

function withWriteLock(workstreamDir, fn) {
  ensureDirs(workstreamDir);
  const lockPath = path.join(eventsDir(workstreamDir), LOCK_FILENAME);
  return withFileLock(lockPath, fn, {
    ownerLabel: 'events-append',
    maxWaitMs: LOCK_MAX_WAIT_MS,
    retryMs: LOCK_RETRY_MS,
    staleAfterMs: 30000,
  });
}

// ─── Validation ────────────────────────────────────────────────────────────

const ALLOWED_FIELDS = new Set([
  'id', 'schema_version', 'timestamp', 'author', 'source_tier', 'source_track',
  'track_tag', 'command_id', 'content_hash', 'prior_hash', 'payload',
  'causation_id', 'classifier_version',
]);
const REQUIRED_FIELDS = [
  'id', 'schema_version', 'timestamp', 'author', 'source_tier', 'source_track',
  'track_tag', 'command_id', 'content_hash', 'prior_hash', 'payload',
];

function validate(ev) {
  const errors = [];
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) {
    return { ok: false, errors: ['event must be an object'] };
  }
  for (const k of Object.keys(ev)) {
    if (!ALLOWED_FIELDS.has(k)) errors.push(`unknown field: ${k}`);
  }
  for (const k of REQUIRED_FIELDS) {
    if (!(k in ev)) errors.push(`missing required field: ${k}`);
  }
  if ('schema_version' in ev && ev.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  }
  if ('id' in ev && (typeof ev.id !== 'string' || ev.id.length === 0 || ev.id.length > 128)) {
    errors.push('id must be a non-empty string ≤128 chars');
  }
  if ('source_tier' in ev && !SOURCE_TIERS.has(ev.source_tier)) {
    errors.push(`source_tier must be one of ${Array.from(SOURCE_TIERS).join('|')}`);
  }
  if ('content_hash' in ev && !/^[0-9a-f]{64}$/.test(String(ev.content_hash))) {
    errors.push('content_hash must be a 64-char lowercase hex sha256');
  }
  if ('prior_hash' in ev) {
    const p = String(ev.prior_hash);
    if (p !== '' && !/^[0-9a-f]{64}$/.test(p)) errors.push('prior_hash must be "" or a 64-char lowercase hex sha256');
  }
  if ('payload' in ev) {
    if (ev.payload === null || typeof ev.payload !== 'object' || Array.isArray(ev.payload)) {
      errors.push('payload must be an object');
    }
  }

  // WS-198 + WS-211: per-type payload hard-reject (ADR-020 step 2
  // schema promotion). T0:envelope uses payload.type as the schema
  // lookup key (every envelope event carries type). T6:workstream +
  // T11:vital-signs use track_tag as the lookup key — these payloads
  // don't universally carry a `type` field but every emit is tagged.
  //
  // Tolerance: a missing schema on T6/T11 is a warning (via `warnings`
  // array pushed on result for callers that care) but NOT a hard
  // reject — step 2 is still accumulating tags. Schemas become
  // required as coverage hardens in later sprints. T0:envelope stays
  // strict-by-type since its three types are stable.
  if (ev && ev.payload && typeof ev.payload === 'object') {
    const schemaInfo = _resolveSchemaLookup(ev);
    if (schemaInfo) {
      if (schemaInfo.missingType) {
        errors.push(schemaInfo.missingType);
      } else if (!fs.existsSync(schemaInfo.path)) {
        if (schemaInfo.missingIsFatal) {
          errors.push(`${ev.source_track} payload type "${schemaInfo.key}" has no schema (expected ${path.relative(process.cwd(), schemaInfo.path).replace(/\\/g, '/')})`);
        }
        // else: tolerated (T6/T11 — step-2 accumulation phase)
      } else {
        try {
          const schema = JSON.parse(fs.readFileSync(schemaInfo.path, 'utf8'));
          const payloadErrors = validatePayloadAgainstSchema(ev.payload, schema);
          for (const e of payloadErrors) errors.push(`payload: ${e}`);
        } catch (err) {
          errors.push(`payload schema load failed: ${err.message}`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// Map an event to its schema lookup key. Returns { path, key, missingType?, missingIsFatal }
// or null (no schema enforcement for this track).
function _resolveSchemaLookup(ev) {
  // T0:envelope — lookup by payload.type (strict; missing schema is fatal)
  if (ev.source_track === 'T0:envelope') {
    const t = ev.payload.type;
    if (typeof t !== 'string' || t.length === 0) {
      return { missingType: 'T0:envelope payload must carry string `type` field', missingIsFatal: true };
    }
    return {
      path: path.join(__dirname, 'schemas', 'payloads', 'envelope', `${t}.json`),
      key: t,
      missingIsFatal: true,
    };
  }

  // T6:workstream — lookup by track_tag (tolerant; missing schema is warn-only via the outer pass-through)
  if (ev.source_track === 'T6:workstream') {
    const tag = ev.track_tag;
    if (typeof tag !== 'string' || tag.length === 0) return null;
    const file = tag.replace(/[:/]/g, '-');
    return {
      path: path.join(__dirname, 'schemas', 'payloads', 'workstream', `${file}.json`),
      key: tag,
      missingIsFatal: false,
    };
  }

  // T20:capture-buffer — lookup by track_tag (tolerant; missing schema is warn-only).
  // WS-321 Phase B. Buffer is feed-forward only — read once by /intend ignition,
  // then the genesis_ignition_consumed envelope event acts as the archive boundary.
  // Schemas live at kit/scripts/core/schemas/payloads/capture-buffer/<tag>.json.
  if (ev.source_track === 'T20:capture-buffer') {
    const tag = ev.track_tag;
    if (typeof tag !== 'string' || tag.length === 0) return null;
    const file = tag.replace(/[:/]/g, '-');
    return {
      path: path.join(__dirname, 'schemas', 'payloads', 'capture-buffer', `${file}.json`),
      key: tag,
      missingIsFatal: false,
    };
  }

  // T11:vital-signs — lookup by track_tag (tolerant)
  if (ev.source_track === 'T11:vital-signs') {
    const tag = ev.track_tag;
    if (typeof tag !== 'string' || tag.length === 0) return null;
    const file = tag.replace(/[:/]/g, '-');
    return {
      path: path.join(__dirname, 'schemas', 'payloads', 'vital-signs', `${file}.json`),
      key: tag,
      missingIsFatal: false,
    };
  }

  // T7:engines — lookup by payload.type (strict; missing schema is fatal,
  // matches T0 discipline). Engines payloads are append-only run records;
  // a missing schema means a future reducer will see an unknown payload
  // shape, which is a real bug not a graceful-degradation case.
  if (ev.source_track === 'T7:engines') {
    const t = ev.payload && ev.payload.type;
    if (typeof t !== 'string' || t.length === 0) {
      return { missingType: 'T7:engines payload must carry string `type` field', missingIsFatal: true };
    }
    return {
      path: path.join(__dirname, 'schemas', 'payloads', 'engines', `${t}.json`),
      key: t,
      missingIsFatal: true,
    };
  }

  // Other tracks — warn-only (no schema enforcement at all)
  return null;
}

// Minimal zero-dep JSON-schema validator covering the features used by
// envelope payload schemas (const, enum, type union, additionalProperties,
// required, minimum, integer/string type).
function validatePayloadAgainstSchema(value, schema) {
  const errors = [];
  _validatePayload(schema, value, '', errors);
  return errors;
}
function _validatePayload(schema, value, pathStr, errors) {
  if (!schema) return;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${pathStr || '<root>'}: expected object`);
      return;
    }
    if (schema.required) {
      for (const k of schema.required) if (!(k in value)) errors.push(`${pathStr || '<root>'}: missing required ${k}`);
    }
    if (schema.properties) {
      for (const k of Object.keys(value)) {
        if (k in schema.properties) {
          _validatePayload(schema.properties[k], value[k], pathStr ? `${pathStr}.${k}` : k, errors);
        } else if (schema.additionalProperties === false) {
          errors.push(`${pathStr || '<root>'}: unknown field ${k}`);
        }
      }
    }
    return;
  }
  const t = schema.type;
  if (t) {
    const types = Array.isArray(t) ? t : [t];
    const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const jsType = actualType === 'number' && Number.isInteger(value) ? 'integer' : actualType;
    const ok = types.some((tt) => tt === actualType || (tt === 'integer' && jsType === 'integer'));
    if (!ok) { errors.push(`${pathStr}: expected ${types.join('|')}, got ${actualType}`); return; }
  }
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${pathStr}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${pathStr}: expected one of ${JSON.stringify(schema.enum)}`);
  }
  if (typeof schema.minimum === 'number' && typeof value === 'number' && value < schema.minimum) {
    errors.push(`${pathStr}: below minimum ${schema.minimum}`);
  }
}

// ─── Hash chain ────────────────────────────────────────────────────────────

/**
 * Canonical content hash: hash the canonicalized event WITHOUT the
 * content_hash field itself (the chain is over the content being hashed,
 * not over the hash itself). prior_hash IS included in the hash input —
 * that's what makes the chain.
 */
function computeContentHash(ev) {
  const { content_hash, ...rest } = ev; // eslint-disable-line no-unused-vars
  return hashEvent(rest);
}

// ─── Blob spill ────────────────────────────────────────────────────────────

function maybeSpillLargePayload(payload, workstreamDir) {
  const serialized = canonicalize(payload);
  const byteLength = Buffer.byteLength(serialized, 'utf8');
  if (byteLength <= PAYLOAD_INLINE_CAP_BYTES) return { payload, spilled: false };
  const sha = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
  const blobFile = path.join(blobsDir(workstreamDir), `${sha}.json`);
  if (!fs.existsSync(blobFile)) {
    fs.writeFileSync(blobFile, serialized, 'utf8');
  }
  return {
    payload: { payload_ref: `blobs/${sha}.json`, payload_hash: sha },
    spilled: true,
    blobFile,
  };
}

// ─── Reader ────────────────────────────────────────────────────────────────

function readChunk(chunkPath) {
  if (!fs.existsSync(chunkPath)) return { events: [], warnings: [`not found: ${chunkPath}`] };
  const raw = fs.readFileSync(chunkPath, 'utf8');
  const lines = raw.split('\n');
  const events = [];
  const warnings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;
    try {
      const ev = JSON.parse(line);
      events.push(ev);
    } catch (err) {
      warnings.push(`line ${i + 1}: torn JSON (${err.message})`);
    }
  }
  return { events, warnings };
}

const CHUNK_NAME_RE = /^\d{4}-\d{2}-\d{2}\.jsonl$/;

// WS-428: minimum number of newest live chunks the rotator must never archive,
// so chainHead/appendEvent always have live context. Mirrored by the config
// key gc.events_keep_min_chunks; this is the hard floor regardless of config.
const KEEP_MIN_LIVE_CHUNKS = 1;

function eventsArchiveDir(workstreamDir) {
  return path.join(eventsDir(workstreamDir), 'archive');
}

// Live chunks only (events/*.jsonl). Use for size-bounded / AI-facing reads
// where archived history is intentionally excluded.
function listLiveChunks(workstreamDir) {
  const dir = eventsDir(workstreamDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => CHUNK_NAME_RE.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

// WS-428: the canonical chunk list for ALL integrity paths (replay, fsck,
// chainHead). Unions live events/*.jsonl + archived events/archive/*.jsonl,
// sorted chronologically by filename date (archived chunks are strictly older
// than live ones, so basename sort is correct order). Because rotation MOVES
// (not deletes) chunks into archive/, the hash chain + replay stay whole after
// archival — INV-031/INV-044 are preserved with no semantic change.
function listChunks(workstreamDir) {
  const liveDir = eventsDir(workstreamDir);
  const archiveDir = eventsArchiveDir(workstreamDir);
  const entries = [];
  if (fs.existsSync(archiveDir)) {
    for (const f of fs.readdirSync(archiveDir)) {
      if (CHUNK_NAME_RE.test(f)) entries.push([f, path.join(archiveDir, f)]);
    }
  }
  if (fs.existsSync(liveDir)) {
    for (const f of fs.readdirSync(liveDir)) {
      if (CHUNK_NAME_RE.test(f)) entries.push([f, path.join(liveDir, f)]);
    }
  }
  // Sort by basename (the YYYY-MM-DD date) so archived + live interleave
  // chronologically. A given date lives in exactly one dir, so no collision.
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return entries.map((e) => e[1]);
}

function readAllChunks(workstreamDir) {
  const chunks = listChunks(workstreamDir);
  const events = [];
  const warnings = [];
  for (const c of chunks) {
    const r = readChunk(c);
    events.push(...r.events);
    warnings.push(...r.warnings.map((w) => `${path.basename(c)}: ${w}`));
  }
  return { events, warnings };
}

// ─── Writer ────────────────────────────────────────────────────────────────

/**
 * Build an event envelope. Fills in defaults for schema_version, id,
 * timestamp, source_tier (founder-prompt), classifier_version. Resolves
 * prior_hash from the chain tail. Computes content_hash. Does NOT write.
 */
function buildEvent(fields, opts = {}) {
  const workstreamDir = opts.workstreamDir || findWorkstreamDir();
  const chainTail = opts.priorHashOverride != null ? opts.priorHashOverride : chainHead(workstreamDir);

  const payloadIn = fields.payload || {};
  const spill = maybeSpillLargePayload(payloadIn, workstreamDir);

  const base = {
    id: fields.id || `ev-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`,
    schema_version: SCHEMA_VERSION,
    timestamp: fields.timestamp || new Date().toISOString(),
    author: fields.author || 'cwos',
    source_tier: fields.source_tier || 'founder-prompt',
    source_track: fields.source_track || 'T0:unknown',
    track_tag: fields.track_tag || '',
    command_id: fields.command_id || process.env.CWOS_COMMAND_ID || `auto:${process.pid}:${Date.now()}`,
    prior_hash: chainTail,
    payload: spill.payload,
  };
  if ('causation_id' in fields) base.causation_id = fields.causation_id;
  if ('classifier_version' in fields) base.classifier_version = fields.classifier_version;
  else base.classifier_version = 'manual';

  base.content_hash = computeContentHash(base);
  return base;
}

/**
 * The current chain head: content_hash of the last event across all
 * chunk files, or "" if the log is empty.
 */
function chainHead(workstreamDir) {
  const chunks = listChunks(workstreamDir);
  for (let i = chunks.length - 1; i >= 0; i--) {
    const { events } = readChunk(chunks[i]);
    if (events.length > 0) return events[events.length - 1].content_hash;
  }
  return ZERO_HASH;
}

function appendEvent(fields, opts = {}) {
  const workstreamDir = opts.workstreamDir || findWorkstreamDir();
  return withWriteLock(workstreamDir, () => {
    const ev = buildEvent(fields, { workstreamDir, priorHashOverride: opts.priorHashOverride });
    const v = validate(ev);
    if (!v.ok) return { ok: false, errors: v.errors };
    const chunk = chunkFileForDate(workstreamDir);
    fs.appendFileSync(chunk, JSON.stringify(ev) + '\n', 'utf8');
    // Maintain current.jsonl as a file mirror of today's chunk (cross-platform;
    // symlinks on Windows require elevated privs). Keep it byte-identical via
    // a full rewrite per append — acceptable because single-writer is
    // enforced at the lock layer. Step 4 may promote this to a symlink on
    // POSIX fleets.
    try {
      fs.copyFileSync(chunk, currentPointer(workstreamDir));
    } catch { /* non-fatal */ }
    // WS-179: chain-anchor write on cadence (every ANCHOR_CADENCE events or
    // first append). Best-effort — failure to anchor must not fail the
    // append itself.
    try { maybeWriteAnchor(workstreamDir); } catch { /* silent */ }
    // WS-189: state-store dispatch hook (ADR-020 step 2). Guarded — a
    // reducer or state-write failure must not fail the append itself
    // (AS-23). State-store drift surfaces via INV-031 replay-purity on
    // the next cwos-verify run.
    try { maybeDispatchToStateStore(workstreamDir, ev); } catch { /* silent */ }
    return { ok: true, event: ev, chunk };
  });
}

// Lazy require to avoid a circular dep: state-store.js does not import
// events.js, and keeping the import lazy keeps minimal harnesses working.
let _stateStoreMod = null;
function _loadStateStore() {
  if (_stateStoreMod === null) {
    try { _stateStoreMod = require('./state-store'); }
    catch { _stateStoreMod = false; }
  }
  return _stateStoreMod || null;
}

function maybeDispatchToStateStore(workstreamDir, ev) {
  if (process.env.CWOS_STATE_STORE_DISABLED === '1') return;
  const mod = _loadStateStore();
  if (!mod) return;
  // Use the singleton so subsequent reads see the fresh state, and so
  // multiple appends within the same process don't re-load from disk
  // every time.
  const store = mod.stateStore;
  if (store.workstreamDir !== workstreamDir) {
    // Different workstream — re-load scoped to this dir.
    const scoped = mod.loadState(workstreamDir);
    scoped.dispatch(ev, {});
    return;
  }
  store.dispatch(ev, {});
}

// Lazy require to avoid a circular dep: chain-anchors.js's verifier reads
// events via the passed-in chainHead, and we want events.js to load
// cleanly in minimal harnesses.
let _chainAnchors = null;
function _loadChainAnchors() {
  if (_chainAnchors === null) {
    try { _chainAnchors = require('./chain-anchors'); }
    catch { _chainAnchors = false; }
  }
  return _chainAnchors || null;
}

function maybeWriteAnchor(workstreamDir) {
  const ca = _loadChainAnchors();
  if (!ca) return;
  const { events: allEvents } = readAllChunks(workstreamDir);
  const count = allEvents.length;
  const last = ca.currentAnchor(workstreamDir);
  if (!ca.shouldAnchor(count, last)) return;
  const head = count > 0 ? allEvents[count - 1].content_hash : ZERO_HASH;
  ca.appendAnchor(workstreamDir, { chain_head: head, event_count: count });
}

// ─── fsck / integrity ──────────────────────────────────────────────────────

/**
 * Walk every chunk in order, verify:
 *   - Every line is parseable JSON (torn-line detection)
 *   - Every event validates against the envelope schema
 *   - Every event's content_hash matches its canonical recomputation
 *   - Every event's prior_hash matches the previous event's content_hash
 *
 * Returns { ok, event_count, issues[] } where each issue is
 * { chunk, index?, type, message }.
 */
function fsck(opts = {}) {
  const workstreamDir = opts.workstreamDir || findWorkstreamDir();
  const issues = [];
  let eventCount = 0;
  let lastHash = ZERO_HASH;

  for (const chunkPath of listChunks(workstreamDir)) {
    const chunkName = path.basename(chunkPath);
    const raw = fs.readFileSync(chunkPath, 'utf8');
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === '') continue;
      let ev;
      try {
        ev = JSON.parse(line);
      } catch (err) {
        issues.push({ chunk: chunkName, index: i + 1, type: 'torn-line', message: err.message });
        continue;
      }
      const v = validate(ev);
      if (!v.ok) {
        issues.push({ chunk: chunkName, index: i + 1, type: 'schema', message: v.errors.join('; ') });
        continue;
      }
      const recomputed = computeContentHash(ev);
      if (recomputed !== ev.content_hash) {
        issues.push({ chunk: chunkName, index: i + 1, type: 'content-hash-mismatch', message: `computed ${recomputed}, stored ${ev.content_hash}` });
      }
      if (ev.prior_hash !== lastHash) {
        issues.push({ chunk: chunkName, index: i + 1, type: 'chain-break', message: `prior_hash ${ev.prior_hash || '""'} != expected ${lastHash || '""'}` });
      }
      lastHash = ev.content_hash;
      eventCount += 1;
    }
  }

  // Anchor consistency — delegates to chain-anchors.js (WS-179) which uses a
  // proper narrow-YAML parser and accepts cadence-drift as long as the
  // anchored hash appears somewhere in the chain history.
  const ca = _loadChainAnchors();
  if (ca) {
    // Collect the hash history we just walked so the verifier can confirm
    // the anchored hash is still present (i.e., the chain wasn't rewritten).
    const allHashes = [];
    for (const chunkPath of listChunks(workstreamDir)) {
      const { events: evs } = readChunk(chunkPath);
      for (const ev of evs) if (ev && ev.content_hash) allHashes.push(ev.content_hash);
    }
    const r = ca.verifyLatestAnchor(workstreamDir, lastHash, allHashes);
    if (r.ok === false) {
      issues.push({ chunk: 'chain-anchors.yaml', type: 'anchor-mismatch', message: `anchored ${r.anchored}, current ${r.current}` });
    }
  }

  return { ok: issues.length === 0, event_count: eventCount, chain_head: lastHash, issues };
}

module.exports = {
  SCHEMA_VERSION,
  PAYLOAD_INLINE_CAP_BYTES,
  ZERO_HASH,
  KEEP_MIN_LIVE_CHUNKS,
  eventsDir,
  eventsArchiveDir,
  blobsDir,
  chunkFileForDate,
  currentPointer,
  withWriteLock,
  validate,
  computeContentHash,
  maybeSpillLargePayload,
  readChunk,
  readAllChunks,
  listChunks,
  listLiveChunks,
  buildEvent,
  chainHead,
  appendEvent,
  fsck,
};
