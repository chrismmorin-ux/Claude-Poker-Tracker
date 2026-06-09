#!/usr/bin/env node
/**
 * cwos-bypass-log.js — append bypass events to mda-metrics.yaml safely.
 *
 * Called by kit/scripts/git-hooks/post-commit-asn.sh when a --no-verify
 * bypass is detected. Keeps yaml editing out of bash.
 *
 * Usage:
 *   node cwos-bypass-log.js --bypass --sha <sha> --files <csv>
 *
 * Writes one line to .claude/workstream/meta/mda-metrics.yaml under
 * bypass_events: array. Safe against missing file (skips silently) and
 * keeps the existing schema intact by locating the bypass_events: marker
 * and inserting a new entry beneath it.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { findRepoRoot, makeEventEmitter } = require('./lib/cwos-utils');

const emitEvent = makeEventEmitter();

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = { bypass: false, sha: null, files: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--bypass') out.bypass = true;
    else if (argv[i] === '--sha' && argv[i + 1]) { out.sha = argv[i + 1]; i++; }
    else if (argv[i] === '--files' && argv[i + 1]) { out.files = argv[i + 1]; i++; }
  }
  return out;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function main() {
  const args = parseArgs();
  if (!args.bypass) {
    process.stderr.write('Usage: cwos-bypass-log.js --bypass --sha <sha> --files <csv>\n');
    process.exit(1);
  }

  const repoRoot = findRepoRoot(process.cwd());
  const metricsPath = path.join(repoRoot, '.claude', 'workstream', 'meta', 'mda-metrics.yaml');
  if (!fs.existsSync(metricsPath)) {
    // Not installed in this repo → skip silently.
    process.exit(0);
  }

  const text = fs.readFileSync(metricsPath, 'utf8');
  const sha = args.sha || 'unknown';
  const files = args.files ? args.files.split(',').filter(Boolean) : [];
  const filesList = files.length > 0
    ? files.map(f => `"${f.replace(/"/g, '\\"')}"`).join(', ')
    : '';

  const entry = `  - { date: "${todayISO()}", sha: "${sha}", files: [${filesList}] }`;

  // Locate bypass_events: line and insert entry on the next line.
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let insertIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^bypass_events:/.test(lines[i])) {
      // If the line ends with [] or the next line is another top-level key,
      // convert to a multi-line list.
      if (/bypass_events:\s*\[\]/.test(lines[i])) {
        lines[i] = 'bypass_events:';
      }
      // Find where to insert: after any existing comment lines directly under
      // bypass_events:, but before the next top-level key.
      insertIdx = i + 1;
      while (insertIdx < lines.length &&
             (lines[insertIdx].trim().startsWith('#') ||
              lines[insertIdx].trim().startsWith('- ') ||
              /^\s+-\s/.test(lines[insertIdx]))) {
        insertIdx++;
      }
      break;
    }
  }

  if (insertIdx === -1) {
    // Schema doesn't have bypass_events section; append new section at end.
    const toAppend = `\nbypass_events:\n${entry}\n`;
    fs.appendFileSync(metricsPath, toAppend, 'utf8');
    emitEvent('T0:envelope', 'bypass-logged', { sha: args.sha || null, section_created: true });
    process.exit(0);
  }

  lines.splice(insertIdx, 0, entry);
  fs.writeFileSync(metricsPath, lines.join('\n'), 'utf8');
  emitEvent('T0:envelope', 'bypass-logged', { sha: args.sha || null, section_created: false });
  process.exit(0);
}

main();
