#!/usr/bin/env node
/**
 * refresher-compute-hash.js — single-card content-hash computation.
 *
 * Usage:
 *   node scripts/refresher-compute-hash.js <cardId>
 *
 * Reads the manifest from src/utils/printableRefresher/manifests/<lowercase(cardId)>.json,
 * runs computeSourceHash(), prints the result to stdout. Does NOT modify the
 * manifest — copy-paste the printed value into the manifest's contentHash field
 * after a deliberate source-util / bodyMarkdown change.
 *
 * Spec: docs/projects/printable-refresher/content-drift-ci.md §Phase 5 implementation checklist
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSourceHash } from '../src/utils/printableRefresher/lineage.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, '..', '..');
const MANIFESTS_DIR = resolve(REPO_ROOT, 'src/utils/printableRefresher/manifests');

async function main() {
  const cardId = process.argv[2];
  if (!cardId) {
    process.stderr.write('Usage: node scripts/refresher-compute-hash.js <cardId>\n');
    process.stderr.write('Example: node scripts/refresher-compute-hash.js PRF-MATH-AUTO-PROFIT\n');
    process.exit(2);
  }

  const filename = `${cardId.toLowerCase()}.json`;
  const manifestPath = resolve(MANIFESTS_DIR, filename);

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    process.stderr.write(`Failed to read manifest at ${manifestPath}: ${err.message}\n`);
    process.exit(1);
  }

  const hash = await computeSourceHash(manifest);
  process.stdout.write(`${hash}\n`);

  // Friendly diagnostic on stderr — does not pollute stdout for piping
  if (manifest.contentHash !== hash) {
    process.stderr.write(`Note: stored contentHash differs from recomputed value.\n`);
    process.stderr.write(`  stored:     ${manifest.contentHash}\n`);
    process.stderr.write(`  recomputed: ${hash}\n`);
    process.stderr.write(`Update manifest.contentHash to the recomputed value if this re-version is intentional.\n`);
  } else {
    process.stderr.write(`OK: stored contentHash matches recomputed value.\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`refresher-compute-hash failed: ${err.message}\n`);
  process.exit(1);
});
