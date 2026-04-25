#!/usr/bin/env node
/**
 * refresher-recompute-hashes.js — batch content-hash recomputation across all manifests.
 *
 * Usage:
 *   node scripts/refresher-recompute-hashes.js [--write]
 *
 * Without --write (default, dry-run): scans every manifest under
 *   src/utils/printableRefresher/manifests/, recomputes contentHash, and
 *   prints the diff (cardId / stored / recomputed / equal-or-not). No file
 *   writes. Exit 0 if all hashes already match; exit 1 if any differ.
 *
 * With --write: in addition to printing, updates each manifest's contentHash
 *   field in-place if it differs. Use after a deliberate batch source-util
 *   change (e.g., pokerCore/preflopCharts.js update across many cards). The
 *   author still must bump schemaVersion separately for Check 4 to pass —
 *   this script only recomputes hashes, it does not bump versions.
 *
 * Spec: docs/projects/printable-refresher/content-drift-ci.md §Phase 5 implementation checklist
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSourceHash } from '../src/utils/printableRefresher/lineage.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, '..', '..');
const MANIFESTS_DIR = resolve(REPO_ROOT, 'src/utils/printableRefresher/manifests');

async function main() {
  const writeMode = process.argv.includes('--write');

  let files;
  try {
    files = readdirSync(MANIFESTS_DIR).filter((f) => f.endsWith('.json'));
  } catch (err) {
    process.stderr.write(`Failed to read manifests dir ${MANIFESTS_DIR}: ${err.message}\n`);
    process.exit(1);
  }
  files.sort();

  if (files.length === 0) {
    process.stderr.write('No manifests found.\n');
    process.exit(0);
  }

  const results = [];
  for (const file of files) {
    const manifestPath = resolve(MANIFESTS_DIR, file);
    const raw = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);

    const recomputed = await computeSourceHash(manifest);
    const stored = manifest.contentHash;
    const equal = stored === recomputed;

    results.push({ file, cardId: manifest.cardId, stored, recomputed, equal });

    if (!equal && writeMode) {
      manifest.contentHash = recomputed;
      // Preserve trailing newline + 2-space indent (project convention)
      const trailingNewline = raw.endsWith('\n') ? '\n' : '';
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + trailingNewline);
    }
  }

  const drifted = results.filter((r) => !r.equal);
  process.stdout.write(`Scanned ${results.length} manifest(s); ${drifted.length} drifted.\n`);
  for (const r of drifted) {
    process.stdout.write(
      `  • ${r.cardId} (${r.file})\n` +
      `      stored:     ${r.stored}\n` +
      `      recomputed: ${r.recomputed}\n` +
      (writeMode ? `      → contentHash updated.\n` : `      → run with --write to update, or revert source change.\n`)
    );
  }

  if (drifted.length > 0 && !writeMode) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`refresher-recompute-hashes failed: ${err.message}\n`);
  process.exit(1);
});
