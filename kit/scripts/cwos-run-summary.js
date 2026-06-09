#!/usr/bin/env node
/**
 * cwos-run-summary — write canonical summary.yaml for an engine run (WS-314).
 *
 * Thin CLI shim around lib/cwos-run-summary.js. Used directly for backfill
 * across the existing 30+ run dirs that pre-date WS-314, and reused by
 * cwos-engine-complete.js when sealing a fresh run.
 *
 * Usage:
 *   cwos-run-summary --run-id run-NNN
 *   cwos-run-summary --run-id run-NNN --dry-run
 *   cwos-run-summary --run-id run-NNN --workstream-dir <p>
 *   cwos-run-summary --all                       # backfill every run dir
 *   cwos-run-summary --all --dry-run
 *
 * Exit codes:
 *   0 — wrote (or would write under --dry-run) summary.yaml
 *   1 — I/O failure
 *   2 — usage error
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

const { findWorkstreamDir } = require('./lib/cwos-utils');
const { writeRunSummary } = require('./lib/cwos-run-summary');

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}
function hasFlag(args, name) { return args.includes(`--${name}`); }

function processOne(runId, wsDir, dryRun) {
  if (!/^run-[A-Za-z0-9_-]+$/.test(runId)) {
    process.stderr.write(`cwos-run-summary: invalid run-id "${runId}"\n`);
    return { ok: false, run_id: runId, reason: 'invalid run-id' };
  }
  const runDir = path.join(wsDir, 'runs', runId);
  if (!fs.existsSync(runDir)) {
    process.stderr.write(`cwos-run-summary: run dir not found: ${runDir}\n`);
    return { ok: false, run_id: runId, reason: 'run dir not found' };
  }
  try {
    return writeRunSummary({ runId, runDir, wsDir, dryRun });
  } catch (e) {
    process.stderr.write(`cwos-run-summary: ${runId}: ${e.message}\n`);
    return { ok: false, run_id: runId, reason: e.message };
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || hasFlag(args, 'help') || args[0] === '-h') {
    process.stdout.write(
      'Usage: cwos-run-summary --run-id <run-NNN> [--dry-run] [--workstream-dir <p>]\n' +
      '       cwos-run-summary --all [--dry-run] [--workstream-dir <p>]\n'
    );
    process.exit(args.length === 0 ? 1 : 0);
  }

  const wsDirOverride = readFlag(args, 'workstream-dir');
  const wsDir = wsDirOverride
    ? path.resolve(wsDirOverride)
    : findWorkstreamDir(process.cwd());

  const dryRun = hasFlag(args, 'dry-run');
  const all = hasFlag(args, 'all');

  if (all) {
    const runsDir = path.join(wsDir, 'runs');
    if (!fs.existsSync(runsDir)) {
      process.stderr.write(`cwos-run-summary: ${runsDir} does not exist\n`);
      process.exit(1);
    }
    const entries = fs.readdirSync(runsDir, { withFileTypes: true });
    const runIds = entries
      .filter(e => e.isDirectory() && /^run-[A-Za-z0-9_-]+$/.test(e.name) && e.name !== 'archive')
      .map(e => e.name)
      .sort();
    const results = [];
    let written = 0, grandfathered = 0, failed = 0;
    for (const runId of runIds) {
      const r = processOne(runId, wsDir, dryRun);
      results.push(r);
      if (r.ok) {
        written++;
        if (r.grandfathered) grandfathered++;
      } else {
        failed++;
      }
    }
    process.stdout.write(JSON.stringify({
      ok: failed === 0,
      mode: dryRun ? 'dry-run' : 'write',
      total: runIds.length,
      written,
      grandfathered,
      failed,
      results,
    }, null, 2) + '\n');
    process.exit(failed === 0 ? 0 : 1);
  }

  const runId = readFlag(args, 'run-id');
  if (!runId) {
    process.stderr.write('cwos-run-summary: --run-id <run-NNN> is required (or use --all)\n');
    process.exit(2);
  }
  const result = processOne(runId, wsDir, dryRun);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { processOne };
