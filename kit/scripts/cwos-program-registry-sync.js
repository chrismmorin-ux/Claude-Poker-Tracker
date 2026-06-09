#!/usr/bin/env node
/**
 * cwos-program-registry-sync — reconcile .claude/workstream/programs/registry.yaml
 * against the prog-<id>.yaml files in the same directory.
 *
 * Invoked by:
 *   - kit/scripts/cwos-adopt-install.js (Phase 3d — first materialization)
 *   - kit/scripts/cwos-pulse.js (after escalate / tier mutation)
 *   - kit/scripts/cwos-audit.js (drift detection only, via --check)
 *   - the founder, when /audit surfaces INV-052 drift
 *
 * Default: read prog-*.yaml, project to registry.yaml, write if changed.
 *
 * Flags:
 *   --check       Detect drift; exit 1 if any drift detected. Do not write.
 *   --dry-run     Compute the projected registry but don't write.
 *   --quiet       Suppress "no drift" output.
 *   --path <p>    Path to the repo root (default: cwd). Looks for
 *                 <path>/.claude/workstream/programs/.
 *   --json        Emit JSON instead of human output.
 *
 * Exit codes:
 *   0  — success (synced, no-drift, or --check passed)
 *   1  — drift detected under --check, or unrecoverable error
 *   2  — usage error
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

const { syncRegistry, detectDrift, materializeRegistry } = require('./lib/cwos-program-registry');
const { findWorkstreamDir, makeEventEmitter } = require('./lib/cwos-utils');

const emitEvent = makeEventEmitter();

function parseArgs(argv) {
  const opts = { check: false, dryRun: false, quiet: false, json: false, repoPath: process.cwd() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opts.check = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--path' && argv[i + 1]) opts.repoPath = path.resolve(argv[++i]);
    else if (a === '--help' || a === '-h') { printUsage(); process.exit(0); }
    else { process.stderr.write(`unknown flag: ${a}\n`); process.exit(2); }
  }
  return opts;
}

function printUsage() {
  process.stdout.write([
    'usage: cwos-program-registry-sync [--check] [--dry-run] [--quiet] [--json] [--path <repo>]',
    '',
    'Reconciles .claude/workstream/programs/registry.yaml against the rich',
    'prog-<id>.yaml files. The prog files are canonical; registry.yaml is',
    'a derived index. INV-052 asserts they never disagree on tier.',
  ].join('\n') + '\n');
}

function resolveProgramsDir(repoPath) {
  // Prefer the workstream-dir lookup; fall back to direct path so this works
  // pre-/adopt (e.g., when invoked from a sim sandbox that hasn't completed
  // the install phase yet).
  let ws;
  try { ws = findWorkstreamDir(repoPath); } catch { ws = null; }
  if (ws) return path.join(ws, 'programs');
  return path.join(repoPath, '.claude', 'workstream', 'programs');
}

function main() {
  const opts = parseArgs(process.argv);
  const programsDir = resolveProgramsDir(opts.repoPath);

  if (!fs.existsSync(programsDir)) {
    const msg = `programs directory not found: ${programsDir}`;
    if (opts.json) process.stdout.write(JSON.stringify({ ok: false, reason: 'programs_dir_missing', programs_dir: programsDir }) + '\n');
    else if (!opts.quiet) process.stderr.write(`${msg}\n`);
    process.exit(1);
  }

  if (opts.check) {
    const drift = detectDrift(programsDir);
    if (opts.json) {
      process.stdout.write(JSON.stringify({ ok: drift.length === 0, drift }, null, 2) + '\n');
    } else if (drift.length === 0) {
      if (!opts.quiet) process.stdout.write('program-registry-sync: clean (registry agrees with prog-*.yaml)\n');
    } else {
      process.stdout.write(`program-registry-sync: ${drift.length} drift entr${drift.length === 1 ? 'y' : 'ies'}:\n`);
      for (const d of drift) {
        if (d.kind === 'tier_mismatch') {
          process.stdout.write(`  ${d.program_id}: prog=${d.prog_tier} registry=${d.registry_tier}\n`);
        } else if (d.kind === 'missing_from_registry') {
          process.stdout.write(`  ${d.program_id}: present in prog-*.yaml but missing from registry.yaml\n`);
        } else {
          process.stdout.write(`  ${d.program_id}: present in registry.yaml but no prog-*.yaml file\n`);
        }
      }
    }
    process.exit(drift.length === 0 ? 0 : 1);
  }

  if (opts.dryRun) {
    const reg = materializeRegistry(programsDir);
    const drift = detectDrift(programsDir);
    if (opts.json) {
      process.stdout.write(JSON.stringify({ ok: true, dry_run: true, programs_count: reg.programs.length, drift }, null, 2) + '\n');
    } else if (!opts.quiet) {
      process.stdout.write(`program-registry-sync (dry-run): would materialize ${reg.programs.length} programs; ${drift.length} drift entr${drift.length === 1 ? 'y' : 'ies'}.\n`);
    }
    process.exit(0);
  }

  const result = syncRegistry(programsDir);
  if (result.warnings && result.warnings.length > 0 && !opts.quiet) {
    for (const w of result.warnings) process.stderr.write(`warning: ${w}\n`);
  }
  if (result.written) {
    emitEvent('T12:program-management', 'program-registry-synced', {
      programs_dir: path.relative(opts.repoPath, programsDir).replace(/\\/g, '/'),
      programs_count: result.programs_count,
    });
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok: true, written: result.written, programs_count: result.programs_count }, null, 2) + '\n');
  } else if (!opts.quiet) {
    if (result.written) {
      process.stdout.write(`program-registry-sync: wrote ${result.programs_count} entries to registry.yaml\n`);
    } else {
      process.stdout.write(`program-registry-sync: no drift (${result.programs_count} programs already in registry.yaml)\n`);
    }
  }
  process.exit(0);
}

if (require.main === module) {
  try { main(); }
  catch (err) {
    process.stderr.write(`cwos-program-registry-sync: ${err.message}\n${err.stack || ''}\n`);
    process.exit(1);
  }
}
