#!/usr/bin/env node
/**
 * cwos-asn-transition.js — record an AS-N lifecycle transition in mda-metrics.
 *
 * The AS-N's own status: field + history: entry in its containing artifact
 * are edited directly by the founder (or /decide invocation). This script
 * handles the mda-metrics.yaml bookkeeping so the append-only logs stay in
 * sync without the founder hand-editing YAML every time.
 *
 * Usage:
 *   node cwos-asn-transition.js \
 *     --asn AS-NN --from <state> --to <state> --reason "<text>" \
 *     [--who chris] [--source "<short>"] [--new-adr ADR-NNN]
 *
 * Effects:
 *   1. Append one entry to asn_transitions[].
 *   2. If --to is at_risk|contradicted, append one entry to fires[].
 *   3. If --new-adr is provided, append to decisions_revised_due_to_asn[].
 *
 * Safe against missing mda-metrics.yaml (errors out with exit 1 if absent).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { findRepoRoot, makeEventEmitter } = require('./lib/cwos-utils');

const emitEvent = makeEventEmitter();

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = { asn: null, from: null, to: null, reason: null, who: 'chris', source: null, newAdr: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--asn' && v) { out.asn = v; i++; }
    else if (a === '--from' && v) { out.from = v; i++; }
    else if (a === '--to' && v) { out.to = v; i++; }
    else if (a === '--reason' && v) { out.reason = v; i++; }
    else if (a === '--who' && v) { out.who = v; i++; }
    else if (a === '--source' && v) { out.source = v; i++; }
    else if (a === '--new-adr' && v) { out.newAdr = v; i++; }
  }
  return out;
}

const VALID_STATES = new Set(['proposed', 'active', 'at_risk', 'validated', 'contradicted', 'retired']);
const FIRE_STATES = new Set(['at_risk', 'contradicted']);
const ASN_ID_RE = /^AS-\d+$/;
const ADR_ID_RE = /^ADR-\d+$/;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function escapeYamlString(s) {
  // Double-quote and escape embedded double quotes + backslashes.
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function main() {
  const args = parseArgs();

  if (!args.asn || !args.to || !args.reason) {
    process.stderr.write('Usage: cwos-asn-transition.js --asn AS-NN --from <state> --to <state> --reason "<text>" [--who X] [--source X] [--new-adr ADR-NNN]\n');
    process.exit(1);
  }
  if (!ASN_ID_RE.test(args.asn)) {
    process.stderr.write(`Invalid --asn "${args.asn}" — must match ^AS-\\d+$\n`);
    process.exit(1);
  }
  if (args.from && !VALID_STATES.has(args.from)) {
    process.stderr.write(`Invalid --from state "${args.from}"\n`);
    process.exit(1);
  }
  if (!VALID_STATES.has(args.to)) {
    process.stderr.write(`Invalid --to state "${args.to}"\n`);
    process.exit(1);
  }
  if (args.newAdr && !ADR_ID_RE.test(args.newAdr)) {
    process.stderr.write(`Invalid --new-adr "${args.newAdr}" — must match ^ADR-\\d+$\n`);
    process.exit(1);
  }
  if (String(args.reason).trim().length < 5) {
    process.stderr.write('--reason must be at least 5 chars\n');
    process.exit(1);
  }

  const repoRoot = findRepoRoot(process.cwd());
  const metricsPath = path.join(repoRoot, '.claude', 'workstream', 'meta', 'mda-metrics.yaml');
  if (!fs.existsSync(metricsPath)) {
    process.stderr.write(`mda-metrics.yaml missing at ${metricsPath}\n`);
    process.exit(1);
  }

  const text = fs.readFileSync(metricsPath, 'utf8');
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  const date = todayISO();

  // ─── Entry 1: asn_transitions ─────────────────────────────────────────────
  const transitionEntry = `  - { asn_id: ${args.asn}, date: "${date}", from: ${args.from || 'proposed'}, to: ${args.to}, who: ${args.who}${args.source ? `, source: "${escapeYamlString(args.source)}"` : ''} }`;
  appendToSection(lines, 'asn_transitions', transitionEntry);

  // ─── Entry 2 (conditional): fires ─────────────────────────────────────────
  if (FIRE_STATES.has(args.to)) {
    const fireEntry = `  - { asn_id: ${args.asn}, date: "${date}", to: ${args.to}, reason: "${escapeYamlString(args.reason)}" }`;
    appendToSection(lines, 'fires', fireEntry);
  }

  // ─── Entry 3 (conditional): decisions_revised_due_to_asn ──────────────────
  if (args.newAdr) {
    const revisionEntry = `  - { adr_id: ${args.newAdr}, date: "${date}", because_of_asn: ${args.asn} }`;
    appendToSection(lines, 'decisions_revised_due_to_asn', revisionEntry);
  }

  fs.writeFileSync(metricsPath, lines.join('\n'), 'utf8');

  emitEvent('T3:record-decision', 'asn-transition', {
    asn: args.asn, from: args.from || 'proposed', to: args.to, new_adr: args.newAdr || null,
  });

  process.stdout.write(`Recorded transition: ${args.asn} ${args.from || 'proposed'} → ${args.to}\n`);
  if (FIRE_STATES.has(args.to)) process.stdout.write(`  + fires[] entry\n`);
  if (args.newAdr) process.stdout.write(`  + decisions_revised_due_to_asn[] entry linking ${args.newAdr}\n`);
  process.stdout.write(`File: ${metricsPath}\n`);
  process.exit(0);
}

/**
 * Find `<section>:` at column 0 and insert the entry line immediately after
 * the section header and any existing entries under it (list items at 2-char
 * indent beginning with "- "). If the section is currently `[]` (empty flow
 * list), convert to block list.
 */
function appendToSection(lines, section, entry) {
  const headerRe = new RegExp(`^${section}:\\s*(\\[\\])?\\s*$`);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    // Section missing — append as a new block at end of file.
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push(`${section}:`);
    lines.push(entry);
    return;
  }

  // If header was `<section>: []`, strip the `[]`.
  if (/\[\]/.test(lines[headerIdx])) {
    lines[headerIdx] = lines[headerIdx].replace(/\s*\[\]\s*$/, '');
  }

  // Find insertion point: after the header, skip existing entries (lines
  // starting with "  -" or comments at indent 2).
  let insertIdx = headerIdx + 1;
  while (insertIdx < lines.length) {
    const ln = lines[insertIdx];
    if (/^  -\s/.test(ln) || /^\s*#/.test(ln)) {
      insertIdx++;
    } else {
      break;
    }
  }
  lines.splice(insertIdx, 0, entry);
}

main();
