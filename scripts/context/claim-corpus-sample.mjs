#!/usr/bin/env node
/**
 * claim-corpus-sample.mjs — draw the adjudication sample, and emit judge packets.
 *
 * THE GATE IS NOT MINE TO SET. `docs/context-shift-prereg.md:150` froze it at
 * 60 claims across >=8 artifacts. This script enforces both and refuses to emit a
 * sample that misses either, because a gate you can silently under-fill is not a gate
 * -- the same failure the repo already recorded when a check passed on an empty set.
 *
 * SEEDED AND REPRODUCIBLE. The sample is a function of (corpus hash, seed, strata).
 * A Result Card has to carry every seed (ADR-009), and an unseeded sample cannot be
 * re-drawn by anyone checking the result. `Math.random()` would make the whole
 * measurement unreplicable while looking identical in the report.
 *
 * STRATIFIED BY (kind x provenance), NOT UNIFORM. Uniform sampling of 6786 claims
 * returns ~62% quantities and would leave the `neither` cell -- the design's actual
 * estimand -- represented by a handful of rows. The strata are the cells the result is
 * reported in, so they are the cells that must be filled.
 *
 * THE PACKETS CONTAIN NO VERDICT AND NO HINT. Each judge receives the claim, the
 * sentence around it, and the commit to check against. It does NOT receive the
 * provenance label, the founder's reply, or which cell the claim came from. Per
 * `.claude/rules/dispatch-dont-assert.md`, a brief that encodes the expected answer
 * returns the expected answer -- and provenance is exactly such a hint, since
 * "asserted without opening the file" telegraphs "probably wrong".
 *
 * Usage:
 *   node scripts/context/claim-corpus-sample.mjs                  # default seed
 *   node scripts/context/claim-corpus-sample.mjs --seed 7 --n 60
 *   node scripts/context/claim-corpus-sample.mjs --batch 10       # claims per judge packet
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const REPO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..', '..',
);
const EVIDENCE = path.join(REPO_ROOT, '.claude', 'workstream', 'evidence');
const CORPUS = path.join(EVIDENCE, 'claim-corpus.jsonl');

const MIN_CLAIMS = 60;      // docs/context-shift-prereg.md:150
const MIN_ARTIFACTS = 8;    // ibid.

/** Deterministic PRNG. mulberry32 — small, seedable, and adequate for drawing a sample. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function main() {
  const argv = process.argv.slice(2);
  const num = (flag, dflt) => (argv.includes(flag) ? Number(argv[argv.indexOf(flag) + 1]) : dflt);
  const seed = num('--seed', 20260820);
  const n = num('--n', MIN_CLAIMS);
  const batch = num('--batch', 10);

  if (!fs.existsSync(CORPUS)) {
    console.error('No corpus. Run: node scripts/context/claim-corpus-extract.mjs');
    process.exit(1);
  }
  const raw = fs.readFileSync(CORPUS, 'utf8');
  const corpusHash = crypto.createHash('sha256').update(raw).digest('hex');
  const rows = raw.trim().split('\n').map((l) => JSON.parse(l));

  // Only claims a judge can actually resolve against the repo. A quantity with no
  // cited path is real, and it is NOT adjudicable by this instrument -- there is
  // nothing to open. Excluding it is a stated limit, not a silent filter.
  const adjudicable = rows.filter((r) => r.cited_path && r.commit);
  const excludedNoPath = rows.length - adjudicable.length;

  const strata = new Map();
  for (const r of adjudicable) {
    const key = `${r.kind}|${r.provenance}`;
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key).push(r);
  }

  // Proportional allocation with a floor, so no reported cell is empty.
  const rand = rng(seed);
  const keys = [...strata.keys()].sort();
  const total = adjudicable.length;
  const alloc = new Map();
  let assigned = 0;
  for (const k of keys) {
    const want = Math.max(3, Math.round((strata.get(k).length / total) * n));
    const take = Math.min(want, strata.get(k).length);
    alloc.set(k, take);
    assigned += take;
  }
  // Trim the largest strata back to n rather than the smallest, which protects the floor.
  while (assigned > n) {
    const biggest = keys.slice().sort((a, b) => alloc.get(b) - alloc.get(a))[0];
    if (alloc.get(biggest) <= 3) break;
    alloc.set(biggest, alloc.get(biggest) - 1);
    assigned--;
  }

  const sample = [];
  for (const k of keys) sample.push(...shuffled(strata.get(k), rand).slice(0, alloc.get(k)));

  const artifacts = new Set(sample.map((r) => r.transcript));

  // THE GATE. Refuse rather than emit an under-filled sample.
  const problems = [];
  if (sample.length < MIN_CLAIMS) problems.push(`only ${sample.length} claims, gate is ${MIN_CLAIMS}`);
  if (artifacts.size < MIN_ARTIFACTS) problems.push(`only ${artifacts.size} artifacts, gate is ${MIN_ARTIFACTS}`);
  if (problems.length) {
    console.error('SAMPLE REFUSED — ' + problems.join('; '));
    console.error('docs/context-shift-prereg.md:150 sets both. Widen the corpus, do not lower the gate.');
    process.exit(2);
  }

  // ── judge packets: claim + sentence + commit. No provenance, no founder reply. ──
  const packets = [];
  for (let i = 0; i < sample.length; i += batch) {
    packets.push({
      packet_id: `p${String(packets.length + 1).padStart(2, '0')}`,
      claims: sample.slice(i, i + batch).map((r) => ({
        claim_id: r.claim_id,
        commit: r.commit,
        claim: r.claim,
        cited_path: r.cited_path,
        cited_line: r.cited_line,
        cited_line_end: r.cited_line_end,
        sentence: r.sentence,
      })),
    });
  }

  const manifest = {
    generated_for: 'retrospective claim-survival baseline (rank 2)',
    corpus_sha256: corpusHash,
    corpus_claims: rows.length,
    adjudicable_claims: adjudicable.length,
    excluded_no_cited_path: excludedNoPath,
    seed,
    n_requested: n,
    n_drawn: sample.length,
    artifacts: artifacts.size,
    gate: { min_claims: MIN_CLAIMS, min_artifacts: MIN_ARTIFACTS, source: 'docs/context-shift-prereg.md:150' },
    strata: Object.fromEntries(keys.map((k) => [k, { available: strata.get(k).length, drawn: alloc.get(k) }])),
    packets: packets.length,
    batch,
  };

  fs.writeFileSync(path.join(EVIDENCE, 'claim-sample.jsonl'),
    sample.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(EVIDENCE, 'claim-sample-packets.json'),
    JSON.stringify(packets, null, 2), 'utf8');
  fs.writeFileSync(path.join(EVIDENCE, 'claim-sample-manifest.json'),
    JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`sample drawn — seed ${seed}, corpus ${corpusHash.slice(0, 12)}…`);
  console.log(`  ${sample.length} claims across ${artifacts.size} transcripts  (gate: ${MIN_CLAIMS} / ${MIN_ARTIFACTS}) OK`);
  console.log(`  ${packets.length} judge packets of <=${batch}`);
  console.log(`  excluded, no cited path: ${excludedNoPath} (quantities with nothing to open — a stated limit, not a filter)`);
  console.log('');
  console.log('  strata (available -> drawn):');
  for (const k of keys) console.log(`    ${k.padEnd(22)} ${String(strata.get(k).length).padStart(5)} -> ${alloc.get(k)}`);
  console.log('');
  console.log('  packets carry NO provenance label and NO founder reply — a brief that');
  console.log('  encodes the expected answer returns the expected answer.');
}

main();
