#!/usr/bin/env node
/**
 * dump-corpus.mjs — one-shot writer for S6–S13 .jsonl + .yml corpus files.
 *
 * Reads each SR-3 builder and writes companion artifacts to
 * `.claude/projects/sidebar-rebuild/corpus/` matching the S1–S5 layout.
 *
 *   SN-<label>.jsonl   — full event stream (events[] + label metadata)
 *   SN-<label>.yml     — short label summary (human-readable sibling)
 *
 * Rerun safe — overwrites files idempotently.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildS6InvariantViolation,
  buildS7AdviceStale,
  buildS8NoTable,
  buildS9PipelineRecovery,
  buildS10Tournament,
  buildS11HeroFolded,
  buildS12RiverDecision,
  buildS13CheckedFlop,
  toJSONL,
} from '../test/replay/recorder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', '..', '.claude', 'projects', 'sidebar-rebuild', 'corpus');

const BUILDERS = [
  ['S6',  buildS6InvariantViolation],
  ['S7',  buildS7AdviceStale],
  ['S8',  buildS8NoTable],
  ['S9',  buildS9PipelineRecovery],
  ['S10', buildS10Tournament],
  ['S11', buildS11HeroFolded],
  ['S12', buildS12RiverDecision],
  ['S13', buildS13CheckedFlop],
];

function labelToYaml(label) {
  const lines = [];
  for (const [k, v] of Object.entries(label)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${JSON.stringify(item)}`);
    } else {
      lines.push(`${k}: ${typeof v === 'string' ? JSON.stringify(v) : v}`);
    }
  }
  return lines.join('\n') + '\n';
}

async function main() {
  await mkdir(OUT, { recursive: true });
  for (const [id, build] of BUILDERS) {
    const corpus = build();
    const jsonl = toJSONL({ events: corpus.events, label: corpus.label });
    const yml = labelToYaml(corpus.label);
    const jsonlPath = resolve(OUT, `${corpus.label.id}.jsonl`);
    const ymlPath = resolve(OUT, `${corpus.label.id}.yml`);
    await writeFile(jsonlPath, jsonl);
    await writeFile(ymlPath, yml);
    console.log(`[${id}] wrote ${corpus.label.id}.{jsonl,yml} (${corpus.events.length} events)`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
