#!/usr/bin/env node
/**
 * cwos-replay — replay the shadow event log through registered reducers.
 *
 * ADR-020 step 2, WS-193. The replay engine that makes INV-031
 * (replay-purity hard invariant) enforceable. Walks every event in
 * chunk-order, dispatches through all currently-registered reducers,
 * and either:
 *   - `run`      : prints a final-state summary
 *   - `check`    : diffs the replayed state against state/*.json;
 *                  exits non-zero on any drift (INV-031's mechanism)
 *   - `rebuild`  : replays and atomically overwrites state/*.json
 *                  (the corruption-recovery nuke button)
 *
 * Deterministic: byte-identical summary on repeated runs over the
 * same event log + same reducer set (AS-51).
 *
 * Zero external dependencies.
 */

'use strict';

require('../lib/preflight');

const fs = require('fs');
const path = require('path');

const events = require('./events');
const ss = require('./state-store');
const { findWorkstreamDir, writeFileAtomic } = require('../lib/cwos-utils');

// Load every reducer module in kit/scripts/core/reducers/*.js. Each
// module's `register()` installs its reducer into the shared registry.
// Called once at CLI start so the registry reflects the committed
// reducer set.
function loadAllReducers() {
  const reducerDir = path.join(__dirname, 'reducers');
  if (!fs.existsSync(reducerDir)) return 0;
  let loaded = 0;
  for (const f of fs.readdirSync(reducerDir)) {
    if (!f.endsWith('.js') || f.startsWith('_')) continue;
    try {
      const mod = require(path.join(reducerDir, f));
      if (mod && typeof mod.register === 'function') {
        mod.register(ss.registerReducer);
        loaded += 1;
      }
    } catch { /* skip broken reducer modules */ }
  }
  return loaded;
}

// ─── Replay core ──────────────────────────────────────────────────────────

// Apply an ordered event list through the registered reducers, mutating
// `domains` in place. Shared by full replay, bounded replay (snapshot
// capture), and snapshot-seeded replay so all three are byte-identical for
// the same event sequence.
function applyEvents(allEvents, domains, warnings, wsDir) {
  for (const ev of allEvents) {
    const reducers = ss.REDUCER_REGISTRY.get(ev.source_track) || [];
    for (const reducer of reducers) {
      let patch;
      try {
        patch = reducer(ev, domains, {
          timestamp: ev.timestamp,
          eventId: ev.id,
          workstreamDir: wsDir,
        });
      } catch (err) {
        warnings.push(`reducer threw on ${ev.id}: ${err.message}`);
        continue;
      }
      if (!patch || typeof patch !== 'object') continue;
      for (const [domainName, newDomainFile] of Object.entries(patch)) {
        if (!ss.DEFAULT_DOMAINS.includes(domainName)) {
          warnings.push(`reducer produced unknown domain: ${domainName}`);
          continue;
        }
        // WS-274: apply the same schema_version + last_event_log_head stamp
        // that _dispatch applies, so replay output is byte-identical to live
        // materialization (preserves AS-51 determinism + INV-031 replay-purity).
        domains[domainName] = ss.stampDomainPatch(newDomainFile, ev.id);
      }
    }
  }
}

// Read events from chunks whose basename date satisfies `datePred(dateStr)`.
function readChunksWhere(wsDir, datePred) {
  const out = [];
  const warnings = [];
  for (const chunkPath of events.listChunks(wsDir)) {
    const date = path.basename(chunkPath).replace(/\.jsonl$/, '');
    if (!datePred(date)) continue;
    const r = events.readChunk(chunkPath);
    out.push(...r.events);
    warnings.push(...r.warnings.map((w) => `${path.basename(chunkPath)}: ${w}`));
  }
  return { events: out, warnings };
}

// WS-428 Stage C: find a rotation snapshot that is *active* — i.e. one whose
// covered chunks (date <= boundary) are NO LONGER on disk, so a full replay
// would silently lose their effects. Returns the snapshot with the greatest
// such boundary, or null. A Stage-B snapshot (domains: null) is ignored.
//
// IMPORTANT: this is only consulted when the caller explicitly opts in
// (allowSnapshotSeed). With chunks present, or seeding disabled, an
// unexpectedly-missing chunk MUST surface as INV-031 drift, not be silently
// healed from a snapshot.
function findActiveSnapshot(wsDir) {
  const archiveDir = events.eventsArchiveDir(wsDir);
  if (!fs.existsSync(archiveDir)) return null;
  const present = events.listChunks(wsDir).map((c) => path.basename(c).replace(/\.jsonl$/, ''));
  let best = null;
  for (const f of fs.readdirSync(archiveDir)) {
    if (!/^snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
    let snap;
    try { snap = JSON.parse(fs.readFileSync(path.join(archiveDir, f), 'utf8')); }
    catch { continue; }
    if (!snap || !snap.domains || !snap.boundary_date) continue; // incomplete anchor
    // Active only if NO covered chunk (date <= boundary) is still on disk.
    if (present.some((d) => d <= snap.boundary_date)) continue;
    if (!best || snap.boundary_date > best.boundary_date) best = snap;
  }
  return best;
}

/**
 * Replay the event log, producing a fresh in-memory domains object. Does NOT
 * persist to disk. Returns { domains, eventCount, warnings[], seededFrom }.
 *
 * Default (no opts): full replay from zero over events.readAllChunks — the
 * canonical INV-031 path, byte-identical to prior behavior.
 *
 * opts.upTo (YYYY-MM-DD, inclusive): bounded replay over chunks <= upTo. Used
 *   by rotation to capture a snapshot of state AT the archive boundary.
 *
 * opts.allowSnapshotSeed (default false): if an active rotation snapshot exists
 *   (its covered chunks have been physically removed), seed domains from it and
 *   replay only events after the boundary. OFF by default so accidental chunk
 *   loss still trips INV-031 rather than being silently masked. WS-428 Stage C.
 */
function replayToMemory(workstreamDir, opts = {}) {
  const wsDir = workstreamDir || findWorkstreamDir();
  const domains = {};
  for (const name of ss.DEFAULT_DOMAINS) domains[name] = ss.emptyDomainFile(name);

  let allEvents;
  let warnings = [];
  let seededFrom = null;

  if (opts.upTo) {
    const r = readChunksWhere(wsDir, (d) => d <= opts.upTo);
    allEvents = r.events; warnings = r.warnings;
  } else if (opts.allowSnapshotSeed) {
    const snap = findActiveSnapshot(wsDir);
    if (snap) {
      for (const name of ss.DEFAULT_DOMAINS) {
        if (snap.domains[name]) domains[name] = JSON.parse(JSON.stringify(snap.domains[name]));
      }
      const r = readChunksWhere(wsDir, (d) => d > snap.boundary_date);
      allEvents = r.events; warnings = r.warnings;
      seededFrom = snap.boundary_date;
    } else {
      const r = events.readAllChunks(wsDir);
      allEvents = r.events; warnings = r.warnings;
    }
  } else {
    const r = events.readAllChunks(wsDir);
    allEvents = r.events; warnings = r.warnings;
  }

  applyEvents(allEvents, domains, warnings, wsDir);
  return { domains, eventCount: allEvents.length, warnings, seededFrom };
}

// ─── Diff ─────────────────────────────────────────────────────────────────

/**
 * Compare two domain snapshots and report per-domain drift:
 *   - missing (domain present in expected but not actual)
 *   - extra (domain present in actual but not expected)
 *   - modified (domain file differs)
 *
 * `drift_summary` is a short line-oriented description suitable for
 * CLI output + INV-031 `detail` field.
 */
function diffDomains(expected, actual) {
  const report = { drift: false, per_domain: {}, drift_summary: '' };
  const allNames = new Set([
    ...Object.keys(expected || {}),
    ...Object.keys(actual || {}),
  ]);
  const issues = [];
  for (const name of allNames) {
    const e = expected[name];
    const a = actual[name];
    if (!e && !a) continue;
    if (!e) { issues.push(`${name}: in actual but not expected`); report.per_domain[name] = 'extra'; report.drift = true; continue; }
    if (!a) { issues.push(`${name}: in expected but not actual`); report.per_domain[name] = 'missing'; report.drift = true; continue; }
    const expectedCanonical = JSON.stringify(normalizeForCompare(e));
    const actualCanonical = JSON.stringify(normalizeForCompare(a));
    if (expectedCanonical !== actualCanonical) {
      const diff = domainDiffSummary(e, a);
      issues.push(`${name}: ${diff}`);
      report.per_domain[name] = 'modified';
      report.drift = true;
    } else {
      report.per_domain[name] = 'same';
    }
  }
  report.drift_summary = issues.join('; ');
  return report;
}

// Fields that legitimately diverge between live dispatch + replay-from-
// zero and SHOULD NOT count as drift / violations. Live dispatch stamps
// `updated_at` to the event that fired WHILE the filesystem was in a
// given state; replay-from-zero stamps it to the FIRST event that
// observed that filesystem state. Same applies to `updated_by_event`
// and `last_event_log_head` (WS-274). All three are metadata about
// "which event last wrote this domain" — not canonical state.
//
// Shared with core/replay-test.js (WS-261) so per-field checks ignore
// the same fields the whole-state diff already ignores.
const IGNORED_DOMAIN_FIELDS = new Set([
  'updated_at',
  'updated_by_event',
  'last_event_log_head',
]);

// Compare items + schema_version + domain; IGNORE the metadata fields
// in IGNORED_DOMAIN_FIELDS. INV-031 correctness is about items equality
// — the canonical state — not metadata.
function normalizeForCompare(domainFile) {
  const out = {
    schema_version: domainFile.schema_version,
    domain: domainFile.domain,
    items: {},
  };
  const keys = Object.keys(domainFile.items || {}).sort();
  for (const k of keys) out.items[k] = domainFile.items[k];
  return out;
}

function domainDiffSummary(expected, actual) {
  const ek = Object.keys(expected.items || {});
  const ak = Object.keys(actual.items || {});
  const only_in_expected = ek.filter((k) => !ak.includes(k)).slice(0, 3);
  const only_in_actual = ak.filter((k) => !ek.includes(k)).slice(0, 3);
  const parts = [];
  if (only_in_expected.length) parts.push(`expected+${only_in_expected.join(',')}`);
  if (only_in_actual.length)   parts.push(`actual+${only_in_actual.join(',')}`);
  if (!parts.length) parts.push(`${ek.length} items differ`);
  return parts.join(' ');
}

// ─── High-level operations ───────────────────────────────────────────────

function run(opts = {}) {
  loadAllReducers();
  const r = replayToMemory(opts.workstreamDir);
  const summary = {};
  for (const name of ss.DEFAULT_DOMAINS) {
    const d = r.domains[name] || {};
    summary[name] = Object.keys(d.items || {}).length;
  }
  return {
    ok: true,
    event_count: r.eventCount,
    chain_head: events.chainHead(opts.workstreamDir),
    summary,
    warnings: r.warnings,
  };
}

function check(opts = {}) {
  loadAllReducers();
  const r = replayToMemory(opts.workstreamDir);
  const store = ss.loadState(opts.workstreamDir);
  const currentDomains = store._rawState();
  const diff = diffDomains(r.domains, currentDomains);
  return {
    ok: !diff.drift,
    event_count: r.eventCount,
    per_domain: diff.per_domain,
    drift_summary: diff.drift_summary,
    warnings: r.warnings,
  };
}

function rebuild(opts = {}) {
  loadAllReducers();
  const r = replayToMemory(opts.workstreamDir);
  const wsDir = opts.workstreamDir || findWorkstreamDir();
  const written = [];
  for (const name of ss.DEFAULT_DOMAINS) {
    const file = path.join(ss.stateDir(wsDir), `${name}.json`);
    if (!fs.existsSync(ss.stateDir(wsDir))) fs.mkdirSync(ss.stateDir(wsDir), { recursive: true });
    const content = JSON.stringify(r.domains[name], null, 2) + '\n';
    writeFileAtomic(file, content);
    written.push(name);
  }
  return { ok: true, event_count: r.eventCount, rebuilt_domains: written, warnings: r.warnings };
}

// ─── CLI ──────────────────────────────────────────────────────────────────

function parseWsDir(args) {
  const i = args.indexOf('--workstream-dir');
  if (i !== -1 && args[i + 1]) return path.resolve(args[i + 1]);
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  const workstreamDir = parseWsDir(args);
  try {
    if (!sub || sub === '--help' || sub === '-h') {
      process.stdout.write('usage: cwos-replay <run|check|rebuild> [--workstream-dir <p>]\n');
      process.exit(sub ? 0 : 1);
    }
    if (sub === 'run') {
      const r = run({ workstreamDir });
      process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      return;
    }
    if (sub === 'check') {
      const r = check({ workstreamDir });
      process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      process.exit(r.ok ? 0 : 1);
    }
    if (sub === 'rebuild') {
      const r = rebuild({ workstreamDir });
      process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      return;
    }
    process.stderr.write(`cwos-replay: unknown subcommand '${sub}'\n`);
    process.exit(2);
  } catch (err) {
    process.stderr.write(`cwos-replay: ${err.message}\n`);
    process.exit(2);
  }
}

if (require.main === module) main();

module.exports = {
  loadAllReducers,
  replayToMemory,
  findActiveSnapshot,
  diffDomains,
  run,
  check,
  rebuild,
  IGNORED_DOMAIN_FIELDS,
};
