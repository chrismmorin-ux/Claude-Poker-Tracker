#!/usr/bin/env node
/**
 * push-channel-meter.mjs — measure the always-injected channel, and ratchet it.
 *
 * RANK 4 of the 2026-08-20 design pressure-test (`P6a`). The argument for putting the
 * ceiling in code is not mine; `docs/context-architecture.md` §2.1 already made it:
 * "The ceiling is the only part of this design with no judgement in it, which is
 * exactly why it is the part most worth mechanizing."
 *
 * WHAT IT MEASURES. The push channel is everything the harness injects before the
 * founder types a character and before any hook runs:
 *   - `CLAUDE.md` (project instructions)
 *   - `.claude/rules/*.md` (project instructions, every file, no exceptions)
 *   - the global `~/.claude/CLAUDE.md`
 *   - `MEMORY.md` from the out-of-repo memory store
 * The rest of the memory store is PULL — 113 topic files that load only when Read —
 * and is counted separately so the asymmetry stays visible rather than averaged away.
 *
 * WHY A RATCHET AND NOT A TARGET. Choosing "the right size" for the push channel forces
 * relocation decisions that are the founder's (`.claude/rules/improvement-default.md`:
 * accommodation is never the AI's recommendation). Choosing "no larger than it is today"
 * forces nothing and still stops the measured failure — the channel grew +117% in 15
 * days, unbounded and ungated. So the ceiling ships at the recorded high-water mark.
 * Growth past it fails. LOWERING it is a founder decision and `--set` records that it
 * was made deliberately, by whom, and why.
 *
 * A CEILING NOBODY CAN RAISE SILENTLY. `--set` rewrites the baseline, and that is the
 * point: it must be an explicit act that lands in a diff, not a number this script
 * quietly relaxes when it trips. If a legitimate addition needs more room, the raise is
 * reviewable in git next to the content that justified it.
 *
 * Usage:
 *   node scripts/context/push-channel-meter.mjs              # measure + check, exit 1 if over
 *   node scripts/context/push-channel-meter.mjs --json       # machine-readable
 *   node scripts/context/push-channel-meter.mjs --set --why "…"   # re-baseline the ratchet
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REPO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..', '..',
);
const CEILING_FILE = path.join(REPO_ROOT, '.claude', 'context', 'push-channel-ceiling.json');

/**
 * Bytes -> tokens is an ESTIMATE and is labelled as one everywhere it is printed.
 * 4 bytes/token is the conventional English-prose approximation. The ratchet is
 * enforced on BYTES, which are measured, never on the estimate.
 */
const BYTES_PER_TOKEN = 4;

const MEMORY_DIR = path.join(
  os.homedir(), '.claude', 'projects', 'C--Users-chris-repos-claude-poker-tracker', 'memory',
);

function sizeOf(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

export function measure() {
  const rulesDir = path.join(REPO_ROOT, '.claude', 'rules');
  let rules = [];
  try {
    rules = fs.readdirSync(rulesDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({ name: `.claude/rules/${f}`, bytes: sizeOf(path.join(rulesDir, f)) }))
      .sort((a, b) => b.bytes - a.bytes);
  } catch { /* no rules dir — degraded, reported as zero */ }

  const components = [
    { name: 'CLAUDE.md', bytes: sizeOf(path.join(REPO_ROOT, 'CLAUDE.md')) },
    { name: '.claude/rules/* (all)', bytes: rules.reduce((s, r) => s + r.bytes, 0), count: rules.length },
    { name: '~/.claude/CLAUDE.md (global)', bytes: sizeOf(path.join(os.homedir(), '.claude', 'CLAUDE.md')) },
    { name: 'MEMORY.md (index only)', bytes: sizeOf(path.join(MEMORY_DIR, 'MEMORY.md')) },
  ];
  const total = components.reduce((s, c) => s + c.bytes, 0);

  // The pull side, measured for contrast only — never added to the push total.
  let pullMemoryFiles = 0, pullMemoryBytes = 0;
  try {
    for (const f of fs.readdirSync(MEMORY_DIR)) {
      if (!f.endsWith('.md') || f === 'MEMORY.md') continue;
      pullMemoryFiles++;
      pullMemoryBytes += sizeOf(path.join(MEMORY_DIR, f));
    }
  } catch { /* store absent — reported as zero */ }

  return { components, rules, total, pull: { files: pullMemoryFiles, bytes: pullMemoryBytes } };
}

function readCeiling() {
  try { return JSON.parse(fs.readFileSync(CEILING_FILE, 'utf8')); } catch { return null; }
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : null;
}

function main() {
  const m = measure();
  const ceiling = readCeiling();

  if (arg('set')) {
    const why = arg('why');
    if (typeof why !== 'string' || why.length < 10) {
      console.error('--set requires --why "<reason>" of at least 10 characters.');
      console.error('A ratchet that can be raised without a stated reason is not a ratchet.');
      process.exit(2);
    }
    const prev = ceiling ? ceiling.max_bytes : null;
    const next = {
      max_bytes: m.total,
      set_on: new Date().toISOString().slice(0, 10),
      previous_max_bytes: prev,
      direction: prev === null ? 'initial' : (m.total > prev ? 'RAISED' : (m.total < prev ? 'lowered' : 'unchanged')),
      why,
      components: Object.fromEntries(m.components.map((c) => [c.name, c.bytes])),
      note: 'Enforced on BYTES. The token figure anywhere in this repo is an estimate at '
          + `${BYTES_PER_TOKEN} bytes/token and is never the thing checked.`,
    };
    fs.mkdirSync(path.dirname(CEILING_FILE), { recursive: true });
    fs.writeFileSync(CEILING_FILE, JSON.stringify(next, null, 2) + '\n', 'utf8');
    console.log(`ceiling ${next.direction} -> ${m.total.toLocaleString()} B` +
                (prev !== null ? ` (was ${prev.toLocaleString()} B)` : ''));
    console.log(`  ${CEILING_FILE}`);
    return;
  }

  if (arg('json')) {
    console.log(JSON.stringify({ ...m, ceiling }, null, 2));
    process.exit(ceiling && m.total > ceiling.max_bytes ? 1 : 0);
  }

  const pad = (n) => n.toLocaleString().padStart(9);
  console.log('PUSH CHANNEL — injected every session, before any hook runs');
  console.log();
  for (const c of m.components) {
    console.log(`  ${pad(c.bytes)} B  ${c.name}${c.count !== undefined ? `  (${c.count} files)` : ''}`);
  }
  console.log(`  ${'─'.repeat(9)}`);
  console.log(`  ${pad(m.total)} B  TOTAL   ~${Math.round(m.total / BYTES_PER_TOKEN).toLocaleString()} tok (ESTIMATE)`);
  console.log();
  console.log('  For contrast — the PULL side, which loads only on a deliberate Read:');
  console.log(`  ${pad(m.pull.bytes)} B  memory store, ${m.pull.files} topic files (not counted above)`);
  console.log();

  console.log('  rules, largest first:');
  for (const r of m.rules) console.log(`  ${pad(r.bytes)} B  ${r.name}`);
  console.log();

  if (!ceiling) {
    console.log('NO CEILING RECORDED. Set one with:');
    console.log('  node scripts/context/push-channel-meter.mjs --set --why "<reason>"');
    process.exit(0);
  }

  const over = m.total - ceiling.max_bytes;
  console.log(`CEILING  ${ceiling.max_bytes.toLocaleString()} B  (set ${ceiling.set_on}: ${ceiling.why})`);
  if (over > 0) {
    console.log(`  OVER BY ${over.toLocaleString()} B — FAIL`);
    console.log('  Relocating content to the pull side, or lowering the ceiling, are both');
    console.log('  founder decisions. Raising it is done explicitly with --set --why, which');
    console.log('  lands in a diff next to whatever justified it.');
    process.exit(1);
  }
  console.log(`  headroom ${(-over).toLocaleString()} B — PASS`);
}

if (import.meta.url.endsWith(path.basename(process.argv[1] || ''))) main();
