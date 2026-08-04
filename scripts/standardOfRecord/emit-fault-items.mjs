/**
 * emit-fault-items.mjs — the suspected-fault register as a work queue (WS-330).
 *
 * The register ranks where the fault most likely is and gives each entry a FALSIFIER: the
 * measurement that would settle it. A falsifier is already an accept criterion — it states what
 * would have to be true for the entry to be closed — so turning the top-ranked entries into
 * queue items is a transcription, not a judgment call. Founder decision, 2026-08-04.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS BOUNDED, AND BOUNDED IN FOUR SEPARATE WAYS.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * An 18-entry register that filed 18 tickets would swamp `/next` composition, and a work queue
 * that buries the queue is not one. So:
 *
 *   1. DRY RUN IS THE DEFAULT. `--write` is required to touch the queue. This script creates
 *      work items, which is a hard thing to unpick once composition has ranked them.
 *   2. `--top N` DEFAULTS TO 3. The register is ranked; the tail is not urgent by construction.
 *   3. DEDUPE ON `fault_id`. An entry that already has an item is skipped, so re-running emits
 *      nothing new — the same idempotence rule `flagContaminated` follows.
 *   4. `retired` ENTRIES ARE NEVER EMITTED. They were settled with evidence; re-filing them
 *      would be asking a question that has an answer.
 *
 * WHY IT WRITES YAML BY HAND. There is no `cwos-item create` CLI — items are queue YAMLs plus a
 * reconcile, which is what the findings-promotion path does too. And the repo has no YAML parser
 * (a deliberate absence, per VOCABULARY.md), so the dedupe scan is a regex over `fault_id:`
 * lines rather than a parse. That is sufficient because `fault_id` is a flat scalar written by
 * this script and read by this script.
 *
 * Usage:
 *   node scripts/standardOfRecord/emit-fault-items.mjs                 # dry run
 *   node scripts/standardOfRecord/emit-fault-items.mjs --top 5 --write
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rankFaults, registerVersion } from '../../src/utils/standardOfRecord/faultRegister.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const QUEUE_DIR = join(REPO_ROOT, '.claude', 'workstream', 'queue');

const DEFAULT_TOP = 3;

// ── argument parsing ────────────────────────────────────────────────────────────────────

const parseArgs = (argv) => {
  const args = { top: DEFAULT_TOP, write: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--write') args.write = true;
    else if (argv[i] === '--top') {
      const n = Number.parseInt(argv[i + 1], 10);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error(`--top expects a positive integer, got "${argv[i + 1]}"`);
      }
      args.top = n;
      i += 1;
    } else if (argv[i].startsWith('--')) {
      throw new Error(`unknown flag "${argv[i]}". Usage: --top N | --write`);
    }
  }
  return args;
};

// ── queue inspection ────────────────────────────────────────────────────────────────────

const queueFiles = () => readdirSync(QUEUE_DIR).filter((f) => /^WS-\d+\.yaml$/.test(f));

/**
 * Fault ids that already have a queue item.
 *
 * Scans EVERY item regardless of status. A deferred or dismissed item still represents a
 * decision someone made about that fault, and re-filing it would quietly overturn that decision
 * by re-raising the question as if it were new.
 */
const claimedFaultIds = () => {
  const claimed = new Map();
  for (const file of queueFiles()) {
    const body = readFileSync(join(QUEUE_DIR, file), 'utf8');
    const match = body.match(/^fault_id:\s*"?(FAULT-[a-z0-9-]+)"?\s*$/m);
    if (match) claimed.set(match[1], file.replace('.yaml', ''));
  }
  return claimed;
};

/** Next free WS id. Max + 1 over the whole queue, never reusing a retired number. */
const nextItemId = () => {
  const nums = queueFiles().map((f) => Number.parseInt(f.match(/^WS-(\d+)\.yaml$/)[1], 10));
  return Math.max(0, ...nums) + 1;
};

// ── YAML emission ───────────────────────────────────────────────────────────────────────

/** Indent a block for a YAML literal scalar, wrapping at a readable width. */
const block = (text, indent = '  ') => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && (line + ' ' + word).length > 92) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.map((l) => `${indent}${l}`).join('\n');
};

const itemYaml = ({ id, row, version, today }) => {
  const { entry } = row;
  return `id: "${id}"
title: "Falsify ${entry.faultId} — ${entry.title.replace(/"/g, "'")}"
legacy_id: ""
type: investigation
status: backlog
claimed_by: null
claimed_at: null
started_at: null
completed_at: null
completion_commit: null
priority_score: ${(row.expectedDamage * 30).toFixed(1)}
priority_label: "${row.expectedDamage >= 0.5 ? 'P0' : 'P1'}"
category: "domain-correctness"
capability: "core"
program: "strategy-of-record"
finding_id: ""
fault_id: "${entry.faultId}"
description: |
  EMITTED FROM THE SUSPECTED-FAULT REGISTER (WS-330), register version ${version}, on ${today}.
  Rank ${row.rank} of the register by expected damage.

  RANKING (expected damage = probability x contamination breadth):
    probability      ${entry.probability}  — ${entry.probabilityBasis}
    breadth (prior)  ${row.breadth.prior}
    breadth (obs)    ${row.breadth.observed === null ? 'no Result Cards to measure against yet' : row.breadth.observed.toFixed(3)}
    expected damage  ${row.expectedDamage.toFixed(3)}
    evidence weight  ${row.breadth.evidenceWeight.toFixed(3)} — how much of the breadth is measured rather than declared

  SITE: ${entry.site}
  STATUS AT EMISSION: ${entry.status}

  MECHANISM.
${block(entry.mechanism)}

  WHAT IT CONTAMINATES.
${block(entry.contaminates)}

  WHY THIS IS A TICKET AND NOT A CAVEAT. The register entry carries a falsifier, which is a
  statement of what would settle the question. That is what the accept criteria below are.
  Closing this item means the falsifier was RUN — either the entry gets confirmed (and every
  prior Result Card it contaminates is flagged suspect-pending-review) or it gets retired with
  the measurement as evidence. It does not close by being read.
accept_criteria: |
  - Run the falsifier:
${block(entry.falsifier, '    ')}
  - Record the outcome as evidence on the register entry, then either confirmFault() or
    retireFault() it in src/utils/standardOfRecord/faultRegister.js. Both require evidence.
  - If CONFIRMED: report the Result Cards flagged suspect-pending-review by the confirmation,
    and say whether each conclusion survives.
  - Update the ranked table in docs/standard-of-record/DISCLAIMER-AND-FAULT-REGISTER.md — the
    drift test asserts it matches the module.
effort: "M"
files_involved:
  - "src/utils/standardOfRecord/faultRegister.js"
  - "docs/standard-of-record/DISCLAIMER-AND-FAULT-REGISTER.md"
blocked_by: []
blocked_by_legacy: []
enables: []
sprint_id: null
decision_flags: []
source:
  type: fault-register
  created_by: ai
  finding_id: ""
  run_id: "${version}"
created_at: "${today}T00:00:00Z"
status_note: |
  Emitted by scripts/standardOfRecord/emit-fault-items.mjs. Deduped on fault_id — this entry
  had no existing queue item at emission time. Re-running the emitter will not file it again.
`;
};

// ── main ────────────────────────────────────────────────────────────────────────────────

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const version = await registerVersion();
  const today = new Date().toISOString().slice(0, 10);

  const claimed = claimedFaultIds();
  const ranked = rankFaults().map((row, i) => ({ ...row, rank: i + 1 }));

  const eligible = ranked.filter((r) => r.status !== 'retired');
  const fresh = eligible.filter((r) => !claimed.has(r.faultId));
  const selected = fresh.slice(0, args.top);

  console.log(`Suspected-fault register ${version}`);
  console.log(`  ${ranked.length} entries · ${eligible.length} eligible (retired excluded) · ${claimed.size} already ticketed`);
  console.log('');

  // Report what was SKIPPED, not only what was taken. A bounded emitter that reported only its
  // output would read as "everything is covered" when it is not — the same silent-truncation
  // problem the coverage census exists to prevent.
  for (const [faultId, itemId] of claimed) {
    const row = ranked.find((r) => r.faultId === faultId);
    console.log(`  skip  ${faultId} — already ${itemId}${row ? ` (rank ${row.rank})` : ''}`);
  }
  const beyondTop = fresh.slice(args.top);
  for (const row of beyondTop) {
    console.log(`  defer ${row.faultId} — rank ${row.rank}, below --top ${args.top}`);
  }
  const retired = ranked.filter((r) => r.status === 'retired');
  for (const row of retired) {
    console.log(`  skip  ${row.faultId} — retired with evidence`);
  }
  if (claimed.size || beyondTop.length || retired.length) console.log('');

  if (!selected.length) {
    console.log('Nothing to emit. Every eligible entry above the cut already has an item.');
    return;
  }

  let id = nextItemId();
  const written = [];
  for (const row of selected) {
    const itemId = `WS-${id}`;
    const path = join(QUEUE_DIR, `${itemId}.yaml`);
    const yaml = itemYaml({ id: itemId, row, version, today });

    console.log(`  emit  ${itemId}  rank ${row.rank}  ED ${row.expectedDamage.toFixed(3)}  ${row.faultId}`);
    if (args.write) {
      writeFileSync(path, yaml, 'utf8');
      written.push(itemId);
    }
    id += 1;
  }

  console.log('');
  if (!args.write) {
    console.log(`DRY RUN — nothing written. Re-run with --write to file ${selected.length} item(s).`);
    return;
  }

  console.log(`Wrote ${written.length} item(s): ${written.join(', ')}`);
  try {
    execFileSync('node', [join(REPO_ROOT, 'kit', 'scripts', 'cwos-reconcile.js'), '--quiet'], {
      cwd: REPO_ROOT, encoding: 'utf8',
    });
    console.log('Reconciled — queue index refreshed.');
  } catch (err) {
    // Non-fatal on purpose: the items ARE written, and a failed reconcile is a stale index
    // rather than lost work. Saying so beats leaving the founder to discover it via /next.
    console.warn(`Reconcile failed (${err?.message || err}). Items are written; run /audit drift to refresh the index.`);
  }
};

main().catch((err) => {
  console.error(`emit-fault-items: ${err?.message || err}`);
  process.exitCode = 1;
});
