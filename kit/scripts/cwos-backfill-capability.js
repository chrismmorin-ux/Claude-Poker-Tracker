#!/usr/bin/env node
/**
 * cwos-backfill-capability — one-shot ADR-016 backfill.
 *
 * Adds `capability:` to every WS-*.yaml that lacks it. Uses the same
 * deriveCapability() rules cwos-index.js applies at index time; here it
 * persists onto the item file so capability is authoritative on the item.
 * Inserts as a new line after `category:` to preserve YAML formatting.
 * Reports un-derivable items for hand-assignment review.
 *
 * Usage: node cwos-backfill-capability.js [--workstream-dir <path>] [--dry-run]
 *        Scans queue/ AND queue/archive/ to cover done items too.
 */

'use strict';

require('./lib/preflight');

const path = require('path');
const fs = require('fs');

// Shadow-event instrumentation (WS-170 + WS-174/177b). Guarded require per AS-23.
const { readYAMLFile, globFiles, findWorkstreamDir, makeEventEmitter } = require('./lib/cwos-utils');
const emitEvent = makeEventEmitter();

const CAPABILITY_BY_PROGRAM = {
  'kit-quality': 'engines',
  'engine-reliability': 'engines',
  'product-evolution': 'engines',
  'simulation-framework': 'engines',
  'fleet-health': 'governance',
  'program-integrity': 'governance',
  'documentation-accuracy': 'governance',
};
const CAPABILITY_BY_CATEGORY = {
  architecture: 'core',
  workstream: 'workstream',
  engines: 'engines',
  evolution: 'engines',
  fleet: 'governance',
  'program-maintenance': 'governance',
  quality: 'governance',
  onboarding: 'core',
};

function deriveCapability(data) {
  if (data.program && CAPABILITY_BY_PROGRAM[data.program]) return CAPABILITY_BY_PROGRAM[data.program];
  if (data.category && CAPABILITY_BY_CATEGORY[data.category]) return CAPABILITY_BY_CATEGORY[data.category];
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  let wsDir;
  const dirIdx = args.indexOf('--workstream-dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) wsDir = path.resolve(args[dirIdx + 1]);
  else wsDir = findWorkstreamDir(process.cwd());

  const dirs = [path.join(wsDir, 'queue'), path.join(wsDir, 'queue', 'archive')];
  const files = dirs.flatMap(d => fs.existsSync(d) ? globFiles(d, 'WS-*.yaml') : []);

  let added = 0, skipped = 0, unresolved = [];
  for (const filePath of files) {
    const { ok, data } = readYAMLFile(filePath);
    if (!ok) { skipped++; continue; }
    if (data.capability) { skipped++; continue; }
    const capability = deriveCapability(data);
    if (!capability) { unresolved.push(data.id || path.basename(filePath)); continue; }

    const text = fs.readFileSync(filePath, 'utf8');
    // Insert `capability: <value>` line after the `category:` line, matching its indentation.
    const lines = text.split('\n');
    const catIdx = lines.findIndex(l => /^\s*category:/.test(l));
    if (catIdx === -1) { unresolved.push(data.id + ' (no category line)'); continue; }
    const indent = lines[catIdx].match(/^\s*/)[0];
    lines.splice(catIdx + 1, 0, `${indent}capability: ${capability}`);
    if (!dryRun) {
      fs.writeFileSync(filePath, lines.join('\n'));
      emitEvent('T1:capture', 'capability-backfill', {
        item: data.id, capability,
      });
    }
    added++;
  }

  console.log(`${dryRun ? '[dry-run] would add' : 'Added'} capability to ${added} files`);
  console.log(`Skipped ${skipped} (already had capability or unreadable)`);
  if (unresolved.length > 0) {
    console.log(`\nUn-derivable (${unresolved.length}) — needs hand-assignment:`);
    unresolved.forEach(id => console.log(`  - ${id}`));
  } else {
    console.log('All items derivable — no hand-assignment needed.');
  }
}

main();
