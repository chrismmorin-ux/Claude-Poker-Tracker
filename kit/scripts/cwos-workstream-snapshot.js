#!/usr/bin/env node
/**
 * cwos-workstream-snapshot — deterministic JSON bundle of an adopted
 * repo's workstream state, written to a configurable path so deployed
 * application code (Celery tasks, Django views, serverless functions)
 * can consume CWOS state from inside a container.
 *
 * The bundle is a single JSON file with:
 *   - all 8 materialized state domains (programs, findings, queue, sprints,
 *     sessions, config, engines, envelope) copied verbatim from .claude/
 *     workstream/state/<domain>.json (schema headers preserved)
 *   - events metadata (count, earliest, latest) + a tail of the most
 *     recent N events for runtime consumers that need short-horizon
 *     activity context
 *   - generator metadata (snapshot_schema_version, generated_at,
 *     homebase_kit_version, kit_version_at_install)
 *
 * Runs at deploy time. NOT auto-invoked on reconcile — that would couple
 * Claude Code activity to deploy artifacts. Adopted repos drop the
 * snapshot into their container via the deploy pipeline (e.g.
 * COPY ./build/cwos-snapshot.json /app/.cwos/snapshot.json).
 *
 * Reference reader: kit/templates/runtime/cwos_snapshot.py
 * Pattern doc:      docs/cwos-runtime-pattern.md
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { findWorkstreamDir, findRepoRoot, writeFileAtomic } = require('./lib/cwos-utils');
const { readAllChunks } = require('./core/events');

const SNAPSHOT_SCHEMA_VERSION = 1;
const DEFAULT_OUT = path.join('.', 'build', 'cwos-snapshot.json');
const DEFAULT_EVENTS_TAIL = 50;
const ALL_DOMAINS = ['programs', 'findings', 'queue', 'sprints', 'sessions', 'config', 'engines', 'envelope'];

// Snapshot is a pure read — no event emission. Emitting would mutate
// state and break determinism (the next snapshot would include the
// previous emission in its event tail). The snapshot file's own
// `generated_at` is the canonical provenance signal.

function parseArgs(argv) {
  const opts = {
    out: null,
    include: null,
    exclude: null,
    eventsTail: DEFAULT_EVENTS_TAIL,
    repoPath: process.cwd(),
    quiet: false,
    json: false,
    clock: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) opts.out = argv[++i];
    else if (a === '--include' && argv[i + 1]) opts.include = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--exclude' && argv[i + 1]) opts.exclude = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--events-tail' && argv[i + 1]) opts.eventsTail = parseInt(argv[++i], 10);
    else if (a === '--path' && argv[i + 1]) opts.repoPath = path.resolve(argv[++i]);
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--clock' && argv[i + 1]) opts.clock = argv[++i];
    else if (a === '--help' || a === '-h') { printUsage(); process.exit(0); }
    else { process.stderr.write(`unknown flag: ${a}\n`); process.exit(2); }
  }
  if (Number.isNaN(opts.eventsTail)) { process.stderr.write('--events-tail must be an integer\n'); process.exit(2); }
  return opts;
}

function printUsage() {
  process.stdout.write([
    'usage: cwos-workstream-snapshot [--out <path>] [--include <list>] [--exclude <list>]',
    '                                 [--events-tail <N>] [--path <repo>] [--quiet] [--json]',
    '',
    'Bundles .claude/workstream/state/*.json + recent events into a single JSON',
    'file. Runtime consumers (Python helper at kit/templates/runtime/cwos_snapshot.py)',
    'read this file from inside a container.',
    '',
    'Defaults:',
    `  --out          ${DEFAULT_OUT}`,
    `  --include      ${ALL_DOMAINS.join(',')}`,
    `  --events-tail  ${DEFAULT_EVENTS_TAIL}  (0 = metadata only; -1 = full log)`,
    '  --path         cwd',
  ].join('\n') + '\n');
}

function resolveDomains(opts) {
  let domains = opts.include ? opts.include.slice() : ALL_DOMAINS.slice();
  if (opts.exclude) domains = domains.filter(d => !opts.exclude.includes(d));
  const unknown = domains.filter(d => !ALL_DOMAINS.includes(d));
  if (unknown.length) { process.stderr.write(`unknown domain(s): ${unknown.join(', ')}\n`); process.exit(2); }
  return domains;
}

function readStateDomain(wsDir, name) {
  const file = path.join(wsDir, 'state', `${name}.json`);
  if (!fs.existsSync(file)) {
    return {
      schema_version: 2,
      domain: name,
      updated_at: null,
      updated_by_event: null,
      last_event_log_head: null,
      items: {},
      _missing: true,
    };
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readHomebaseKitVersion(repoPath) {
  // .cwos-version (adopted repo) may record a homebase_path; fall back to
  // walking up from this script's own location (HomeBase self-snapshot).
  const cwosVer = path.join(repoPath, '.cwos-version');
  if (fs.existsSync(cwosVer)) {
    try {
      const text = fs.readFileSync(cwosVer, 'utf8');
      const m = text.match(/^homebase_path:\s*['"]?([^'"\n]+)['"]?\s*$/m);
      if (m) {
        const hb = m[1].trim();
        const vFile = path.join(hb, 'kit', 'VERSION');
        if (fs.existsSync(vFile)) return fs.readFileSync(vFile, 'utf8').trim();
      }
    } catch { /* fall through */ }
  }
  // HomeBase self-snapshot: this script lives at <HomeBase>/kit/scripts/.
  const selfVersionFile = path.join(__dirname, '..', 'VERSION');
  if (fs.existsSync(selfVersionFile)) {
    try { return fs.readFileSync(selfVersionFile, 'utf8').trim(); } catch { /* fall through */ }
  }
  return 'unknown';
}

function readRepoKitVersionAtInstall(repoPath) {
  const cwosVer = path.join(repoPath, '.cwos-version');
  if (!fs.existsSync(cwosVer)) return null;
  try {
    const text = fs.readFileSync(cwosVer, 'utf8');
    const m = text.match(/^kit_version_at_install:\s*['"]?([^'"\n]+)['"]?\s*$/m);
    return m ? m[1].trim() : null;
  } catch { return null; }
}

function buildEventsMetadata(events) {
  if (!events.length) {
    return { total_count: 0, earliest: null, latest: null, log_head_hash: null };
  }
  const last = events[events.length - 1];
  return {
    total_count: events.length,
    earliest: events[0].timestamp || null,
    latest: last.timestamp || null,
    log_head_hash: last.content_hash || null,
  };
}

function buildEnvelope(opts, wsDir, repoRoot) {
  const domains = resolveDomains(opts);
  const state = {};
  for (const d of domains) state[d] = readStateDomain(wsDir, d);

  const { events, warnings } = readAllChunks(wsDir);
  const events_metadata = buildEventsMetadata(events);
  let recent_events;
  if (opts.eventsTail === 0) recent_events = [];
  else if (opts.eventsTail < 0) recent_events = events;
  else recent_events = events.slice(-opts.eventsTail);

  return {
    snapshot_schema_version: SNAPSHOT_SCHEMA_VERSION,
    generated_at: opts.clock || new Date().toISOString(),
    generator: 'cwos-workstream-snapshot',
    kit_version_at_install: readRepoKitVersionAtInstall(repoRoot),
    homebase_kit_version: readHomebaseKitVersion(repoRoot),
    repo_path: repoRoot,
    scope: {
      domains,
      events_tail: opts.eventsTail,
    },
    state,
    events_metadata,
    recent_events,
    _warnings: warnings.length ? warnings : undefined,
  };
}

function ensureOutDir(outPath) {
  const dir = path.dirname(path.resolve(outPath));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const opts = parseArgs(process.argv);
  const outPath = path.resolve(opts.out || DEFAULT_OUT);

  let wsDir;
  try { wsDir = findWorkstreamDir(opts.repoPath); }
  catch (err) {
    if (opts.json) process.stdout.write(JSON.stringify({ ok: false, reason: 'workstream_dir_missing', error: err.message }) + '\n');
    else process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }

  const repoRoot = findRepoRoot(opts.repoPath);

  let envelope;
  try { envelope = buildEnvelope(opts, wsDir, repoRoot); }
  catch (err) {
    if (opts.json) process.stdout.write(JSON.stringify({ ok: false, reason: 'build_failed', error: err.message }) + '\n');
    else process.stderr.write(`snapshot build failed: ${err.message}\n`);
    process.exit(1);
  }

  const json = JSON.stringify(envelope, null, 2);
  const hash = crypto.createHash('sha256').update(json).digest('hex');

  try {
    ensureOutDir(outPath);
    writeFileAtomic(outPath, json, { skipSizeGate: true });
  } catch (err) {
    if (opts.json) process.stdout.write(JSON.stringify({ ok: false, reason: 'write_failed', error: err.message }) + '\n');
    else process.stderr.write(`snapshot write failed: ${err.message}\n`);
    process.exit(1);
  }

  const result = {
    ok: true,
    out: outPath,
    bytes: json.length,
    sha256: hash,
    domains: envelope.scope.domains,
    events_count: envelope.events_metadata.total_count,
    events_tail_included: envelope.recent_events.length,
    generated_at: envelope.generated_at,
  };

  if (opts.json) {
    process.stdout.write(JSON.stringify(result) + '\n');
  } else if (!opts.quiet) {
    process.stdout.write(
      `snapshot written: ${outPath}\n` +
      `  size:    ${json.length} bytes\n` +
      `  sha256:  ${hash.slice(0, 16)}…\n` +
      `  domains: ${envelope.scope.domains.join(', ')}\n` +
      `  events:  ${envelope.events_metadata.total_count} total, ${envelope.recent_events.length} in tail\n`
    );
  }
  process.exit(0);
}

if (require.main === module) main();

module.exports = { buildEnvelope, resolveDomains, readStateDomain, ALL_DOMAINS, SNAPSHOT_SCHEMA_VERSION };
