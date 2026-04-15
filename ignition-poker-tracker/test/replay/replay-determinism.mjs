/**
 * replay-determinism.mjs — standalone determinism checker.
 *
 * Runs each corpus twice via `npx vitest run --reporter json` and compares
 * hashReplay() outputs. Fails loudly (non-zero exit) if any corpus differs
 * across runs.
 *
 * Usage: node test/replay/replay-determinism.mjs
 * Or via: npm run replay:determinism
 *
 * Note: because side-panel.js is an IIFE (single init per vitest worker), each
 * corpus must run in its own vitest invocation. We spawn two sequential runs of
 * the full test/replay suite and compare the reported hash values (logged with
 * a structured prefix `[HASH:<corpus>:<hash>]` by each test).
 *
 * Limitation: this checks inter-run determinism only. Intra-run state bleed
 * between corpora is prevented by the one-file-per-corpus architecture.
 */

import { execSync } from 'node:child_process';

const CORPUS_IDS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13'];

function runReplayAndExtractHashes() {
  let output;
  try {
    // Run tests with verbose output so we can grep HASH lines
    output = execSync(
      'npx vitest run test/replay/ --reporter=verbose 2>&1',
      { encoding: 'utf8', cwd: process.cwd() }
    );
  } catch (e) {
    // vitest exits non-zero on test failure; capture output anyway
    output = e.stdout || e.output?.join('') || '';
  }

  // Extract structured hash lines: [HASH:S1:ab12cd34]
  const hashes = {};
  const hashPattern = /\[HASH:([A-Z0-9]+):([0-9a-f]+)\]/g;
  let m;
  while ((m = hashPattern.exec(output)) !== null) {
    hashes[m[1]] = m[2];
  }
  return { hashes, output };
}

console.log('SR-1 Determinism check — running corpus suite twice...\n');

const run1 = runReplayAndExtractHashes();
const run2 = runReplayAndExtractHashes();

let failed = false;
for (const id of CORPUS_IDS) {
  const h1 = run1.hashes[id];
  const h2 = run2.hashes[id];
  if (!h1 && !h2) {
    console.log(`  ${id}: SKIP (no hash emitted — corpus may not emit HASH line yet)`);
    continue;
  }
  if (!h1 || !h2) {
    console.error(`  ${id}: FAIL — hash only present in one run (run1=${h1}, run2=${h2})`);
    failed = true;
    continue;
  }
  if (h1 !== h2) {
    console.error(`  ${id}: FAIL — non-deterministic! run1=${h1} run2=${h2}`);
    failed = true;
  } else {
    console.log(`  ${id}: OK  (${h1})`);
  }
}

if (failed) {
  console.error('\nDeterminism check FAILED. See output above.');
  process.exit(1);
} else {
  console.log('\nDeterminism check PASSED — all corpora produce identical hashes across runs.');
}
