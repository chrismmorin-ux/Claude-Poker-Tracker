#!/usr/bin/env node
/**
 * cwos-engines-registry-sync — reconcile .claude/workstream/engines/registry.yaml
 * against the installed .claude/commands/*.md engine skill files.
 *
 * Invoked by:
 *   - kit/scripts/cwos-adopt-install.js (Phase 3e — first materialization)
 *   - The founder, when /audit surfaces missing-engine warnings
 *
 * Flags:
 *   --check       Detect missing entries; exit 1 if any. Do not write.
 *   --dry-run     Compute the projected registry but don't write.
 *   --quiet       Suppress "no drift" output.
 *   --path <p>    Path to the repo root (default: cwd).
 *   --json        Emit JSON instead of human output.
 *
 * Exit codes:
 *   0  — success / synced / --check passed
 *   1  — missing entries detected under --check, or unrecoverable error
 *   2  — usage error
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

const { syncRegistry, detectMissing, materializeRegistry } = require('./lib/cwos-engines-registry');
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
    'usage: cwos-engines-registry-sync [--check] [--dry-run] [--quiet] [--json] [--path <repo>]',
    '',
    'Re-materializes .claude/workstream/engines/registry.yaml from the',
    'installed .claude/commands/*.md skill files. Preserves the aliases:',
    'section + comment header. Existing engine entries are not overwritten;',
    'only missing entries are added.',
  ].join('\n') + '\n');
}

function resolveWorkstreamDir(repoPath) {
  let ws;
  try { ws = findWorkstreamDir(repoPath); } catch { ws = null; }
  if (ws) return ws;
  return path.join(repoPath, '.claude', 'workstream');
}

function main() {
  const opts = parseArgs(process.argv);
  const wsDir = resolveWorkstreamDir(opts.repoPath);

  if (!fs.existsSync(wsDir)) {
    const msg = `workstream dir not found: ${wsDir}`;
    if (opts.json) process.stdout.write(JSON.stringify({ ok: false, reason: 'workstream_dir_missing', dir: wsDir }) + '\n');
    else if (!opts.quiet) process.stderr.write(`${msg}\n`);
    process.exit(1);
  }

  if (opts.check) {
    const missing = detectMissing(wsDir);
    if (opts.json) {
      process.stdout.write(JSON.stringify({ ok: missing.length === 0, missing }, null, 2) + '\n');
    } else if (missing.length === 0) {
      if (!opts.quiet) process.stdout.write('engines-registry-sync: clean (every program-referenced engine is registered)\n');
    } else {
      process.stdout.write(`engines-registry-sync: ${missing.length} missing engine reference(s):\n`);
      // Group by engine to make the output scannable
      const byEngine = {};
      for (const m of missing) {
        if (!byEngine[m.engine]) byEngine[m.engine] = [];
        byEngine[m.engine].push(`${m.program_id}.${m.protocol}`);
      }
      for (const [eng, refs] of Object.entries(byEngine)) {
        process.stdout.write(`  ${eng} — referenced by: ${refs.join(', ')}\n`);
      }
    }
    process.exit(missing.length === 0 ? 0 : 1);
  }

  if (opts.dryRun) {
    const m = materializeRegistry(wsDir);
    if (opts.json) {
      process.stdout.write(JSON.stringify({ ok: true, dry_run: true, engines_count: Object.keys(m.engines).length, added_from_scan: m.addedFromScan }, null, 2) + '\n');
    } else if (!opts.quiet) {
      process.stdout.write(`engines-registry-sync (dry-run): would materialize ${Object.keys(m.engines).length} engines (${m.addedFromScan} added from scan)\n`);
    }
    process.exit(0);
  }

  const result = syncRegistry(wsDir);
  if (result.warnings && result.warnings.length > 0 && !opts.quiet) {
    for (const w of result.warnings) process.stderr.write(`warning: ${w}\n`);
  }
  if (result.written) {
    emitEvent('T12:program-management', 'engines-registry-synced', {
      workstream_dir: wsDir.replace(/\\/g, '/'),
      engines_count: result.count,
      added_from_scan: result.addedFromScan,
    });
  }
  if (opts.json) {
    process.stdout.write(JSON.stringify({ ok: true, written: result.written, engines_count: result.count, added_from_scan: result.addedFromScan }, null, 2) + '\n');
  } else if (!opts.quiet) {
    if (result.written) {
      process.stdout.write(`engines-registry-sync: wrote ${result.count} entries (${result.addedFromScan} from installed-commands scan)\n`);
    } else {
      process.stdout.write(`engines-registry-sync: no change (${result.count} engines already registered)\n`);
    }
  }
  process.exit(0);
}

if (require.main === module) {
  try { main(); }
  catch (err) {
    process.stderr.write(`cwos-engines-registry-sync: ${err.message}\n${err.stack || ''}\n`);
    process.exit(1);
  }
}
