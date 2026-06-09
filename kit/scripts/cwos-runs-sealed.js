#!/usr/bin/env node
/**
 * cwos-runs-sealed — check whether one or more runs are sealed (WS-314).
 *
 * A run is "sealed" once an `engine_run_completed` event has been emitted
 * for its run_id. Sealed runs MUST NOT be edited in place — updates flow
 * through runs/<id>/addendum.md instead. The pre-commit-runs-immutability
 * hook calls this script to enforce that contract.
 *
 * Usage:
 *   cwos-runs-sealed --run-ids run-001,run-017
 *   cwos-runs-sealed --run-ids run-001 --workstream-dir <p>
 *
 * Exit codes:
 *   0 — none of the given runs are sealed
 *   1 — at least one run is sealed (names printed to stdout, one per line)
 *   2 — usage error
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

const { findWorkstreamDir } = require('./lib/cwos-utils');

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}

function isSealed(runId, eventsDir) {
  if (!fs.existsSync(eventsDir)) return false;
  let files;
  try {
    files = fs.readdirSync(eventsDir).filter(f => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
  } catch { return false; }
  for (const f of files) {
    let lines;
    try { lines = fs.readFileSync(path.join(eventsDir, f), 'utf8').split('\n'); }
    catch { continue; }
    for (const line of lines) {
      if (!line.trim()) continue;
      // Cheap pre-filter — avoid JSON parse cost on irrelevant lines.
      if (line.indexOf('engine_run_completed') === -1) continue;
      if (line.indexOf(runId) === -1) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      const p = ev.payload || {};
      if (p.type === 'engine_run_completed' && p.run_id === runId) return true;
    }
  }
  return false;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args[0] === '-h') {
    process.stdout.write('Usage: cwos-runs-sealed --run-ids run-NNN,run-NNN... [--workstream-dir <p>]\n');
    process.exit(args.length === 0 ? 1 : 0);
  }
  const runIdsCsv = readFlag(args, 'run-ids');
  if (!runIdsCsv) {
    process.stderr.write('cwos-runs-sealed: --run-ids is required\n');
    process.exit(2);
  }
  const runIds = runIdsCsv.split(',').map(s => s.trim()).filter(Boolean);
  if (runIds.length === 0) {
    process.stderr.write('cwos-runs-sealed: --run-ids must be a non-empty comma-list\n');
    process.exit(2);
  }
  const wsDirOverride = readFlag(args, 'workstream-dir');
  const wsDir = wsDirOverride
    ? path.resolve(wsDirOverride)
    : findWorkstreamDir(process.cwd());
  const eventsDir = path.join(wsDir, 'events');

  const sealed = [];
  for (const id of runIds) {
    if (!/^run-[A-Za-z0-9_-]+$/.test(id)) {
      process.stderr.write(`cwos-runs-sealed: invalid run-id "${id}"\n`);
      process.exit(2);
    }
    if (isSealed(id, eventsDir)) sealed.push(id);
  }

  if (sealed.length === 0) {
    process.exit(0);
  }
  for (const id of sealed) process.stdout.write(`${id}\n`);
  process.exit(1);
}

if (require.main === module) main();

module.exports = { isSealed };
