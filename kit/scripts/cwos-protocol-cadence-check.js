#!/usr/bin/env node
/**
 * cwos-protocol-cadence-check.js — Surface overdue program protocols.
 *
 * Durability mechanism for DELTA-3 (P-23 audit): the program designed to
 * detect program-system drift (prog-program-integrity) had a 7-day delta
 * cadence but never fired because nothing surfaced overdue runs to the
 * founder/AI. This script closes that gap.
 *
 * For each program at .claude/workstream/programs/prog-*.yaml, for each
 * protocol with cadence_days defined:
 *   - if last_run_by_protocol.<protocol>.date is null AND program tier >=
 *     protocol.min_tier: flag as never-run
 *   - else if days since last run > cadence_days: flag as overdue
 *
 * Output:
 *   --quiet  : single-line summary written to stdout (or nothing if empty)
 *   --json   : full JSON object
 *   default  : human-readable list to stdout
 *
 * Exit code: always 0 — informational, not a gate.
 *
 * Wired into SessionStart hook in .claude/settings.local.json.
 *
 * Zero LLM calls. Zero external deps. Uses kit/scripts/lib/cwos-utils.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { readYAMLFile, globFiles, todayISO, dateDiffDays } = require('./lib/cwos-utils');

// ─── Constants ──────────────────────────────────────────────────────────────

const PROGRAM_DIR = '.claude/workstream/programs';
const TIER_INDEX = { dormant: 0, watch: 1, active: 2, critical: 3 };
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Tier comparison ────────────────────────────────────────────────────────

function tierGTE(programTier, protocolMinTier) {
  if (!protocolMinTier) return true; // no min specified = always eligible
  const a = TIER_INDEX[String(programTier || 'dormant').toLowerCase()];
  const b = TIER_INDEX[String(protocolMinTier).toLowerCase()];
  if (a == null || b == null) return true; // unknown tier = lenient (don't suppress)
  return a >= b;
}

// ─── Per-program scan ───────────────────────────────────────────────────────

function scanProgram(programPath, programYaml, today) {
  const overdue = [];
  const programId = programYaml.id || path.basename(programPath, '.yaml').replace(/^prog-/, '');
  const programTier = programYaml.tier;
  const status = programYaml.status;

  // Skip retired/paused programs — their protocols shouldn't fire
  if (status === 'retired' || status === 'paused') return overdue;

  const protocols = programYaml.protocols || {};
  const lastRun = programYaml.last_run_by_protocol || {};

  for (const protocolName of Object.keys(protocols)) {
    const proto = protocols[protocolName];
    if (!proto || typeof proto !== 'object') continue;

    const cadenceDays = proto.cadence_days;
    if (cadenceDays == null) continue; // not a cadenced protocol (e.g., baseline)

    const numericCadence = Number(cadenceDays);
    if (!Number.isFinite(numericCadence) || numericCadence <= 0) continue;

    if (!tierGTE(programTier, proto.min_tier)) continue;

    const entry = lastRun[protocolName];
    const lastDate = entry && typeof entry === 'object' && entry.date && ISO_DATE_RE.test(entry.date)
      ? entry.date
      : null;

    if (lastDate == null) {
      // Never run — flag if program is at min_tier or above
      overdue.push({
        program: programId,
        protocol: protocolName,
        cadence_days: numericCadence,
        days_since: null,
        days_overdue: null,
        kind: 'never-run',
        tier: programTier,
        min_tier: proto.min_tier || null,
      });
      continue;
    }

    const days = dateDiffDays(lastDate, today);
    if (days > numericCadence) {
      overdue.push({
        program: programId,
        protocol: protocolName,
        cadence_days: numericCadence,
        days_since: days,
        days_overdue: days - numericCadence,
        kind: 'overdue',
        tier: programTier,
        min_tier: proto.min_tier || null,
        last_run_date: lastDate,
      });
    }
  }

  return overdue;
}

// ─── Output formatting ──────────────────────────────────────────────────────

function formatHuman(items) {
  if (items.length === 0) {
    return 'No overdue protocols. All cadences current.';
  }
  const lines = [`${items.length} overdue protocol${items.length === 1 ? '' : 's'}:`];
  // Sort: never-run first (by program), then overdue by days_overdue desc
  const sorted = [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'never-run' ? -1 : 1;
    if (a.kind === 'never-run') return a.program.localeCompare(b.program);
    return (b.days_overdue || 0) - (a.days_overdue || 0);
  });
  for (const it of sorted) {
    if (it.kind === 'never-run') {
      lines.push(`  - ${it.program}.${it.protocol}: never run (cadence ${it.cadence_days}d, tier ${it.tier})`);
    } else {
      lines.push(`  - ${it.program}.${it.protocol}: ${it.days_overdue}d overdue (last ${it.last_run_date}, cadence ${it.cadence_days}d)`);
    }
  }
  return lines.join('\n');
}

function formatQuiet(items) {
  if (items.length === 0) return '';
  const programs = new Set(items.map((i) => i.program));
  return `[cadence] ${items.length} overdue protocol${items.length === 1 ? '' : 's'} across ${programs.size} program${programs.size === 1 ? '' : 's'} — run /pulse for details`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--json') ? 'json' :
               args.includes('--quiet') ? 'quiet' : 'human';

  const today = todayISO();
  const files = globFiles(PROGRAM_DIR, 'prog-*.yaml');

  const allItems = [];
  let scanned = 0;

  for (const file of files) {
    if (path.basename(file) === 'prog-template.yaml') continue;
    let yaml;
    try {
      const result = readYAMLFile(file);
      // readYAMLFile returns { ok, data, warnings } — unwrap to plain object
      if (!result || result.ok === false) {
        process.stderr.write(`[cadence] skip parse fail: ${file}: ${(result && result.error) || 'unknown'}\n`);
        continue;
      }
      yaml = result.data;
    } catch (err) {
      // Don't fail the hook on parse errors; just skip
      process.stderr.write(`[cadence] skip parse fail: ${file}: ${err.message}\n`);
      continue;
    }
    scanned++;
    const items = scanProgram(file, yaml, today);
    allItems.push(...items);
  }

  if (mode === 'json') {
    process.stdout.write(JSON.stringify({
      ok: true,
      today,
      programs_scanned: scanned,
      overdue_count: allItems.length,
      items: allItems,
    }, null, 2) + '\n');
  } else if (mode === 'quiet') {
    const line = formatQuiet(allItems);
    if (line) process.stdout.write(line + '\n');
  } else {
    process.stdout.write(formatHuman(allItems) + '\n');
  }

  process.exit(0);
}

main();
