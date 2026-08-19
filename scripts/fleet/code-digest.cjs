#!/usr/bin/env node
'use strict';
/**
 * code-digest.cjs — print the code digest for one queue item's compute job, at one commit.
 *
 * WHY A FILE AND NOT AN INLINE COMMAND, and why it takes an ID rather than the steps.
 * The two sides of the compute dedupe must compute the digest THE SAME WAY or the key is
 * asymmetric and finished work silently re-runs — which has already happened twice on
 * `stepsFingerprint` (see its docblock). The historical side runs on cm-node1 inside
 * `done-summary.cjs`. So the candidate side runs here, on the same machine, against the same
 * working tree, through the same function.
 *
 * Arguments are a commit-ish and a WS id — both `[A-Za-z0-9-]`-shaped, with no shell
 * metacharacters — precisely so this survives the ssh hop. Passing a steps JSON blob would
 * not: `done-summary.cjs` exists because `$` variables came back empty over ssh on
 * 2026-08-16 and the dedupe check silently found zero finished jobs. A silent empty result is
 * the worst possible failure for a dedupe check, so this script reads the queue item itself.
 *
 * Reading the AUTHORED steps rather than the materialized ones is safe and deliberate:
 * materialization only resolves `cmd` (the node binary), and the digest is derived from
 * `args` alone. So the digest is identical on both sides without either needing a node path.
 *
 * Prints the 12-hex digest, or nothing at all when it cannot be established. An empty result
 * means "no digest", which callers must treat as the legacy steps-only key on BOTH sides.
 *
 * Usage: node scripts/fleet/code-digest.cjs <commit> <WS-id> [repoRoot]
 */

const path = require('path');

const REPO_ROOT = process.argv[4] || path.join(__dirname, '..', '..');
const { codeDigest } = require(path.join(REPO_ROOT, 'kit', 'scripts', 'lib', 'cwos-code-digest.js'));
const { readQueueItem } = require(path.join(REPO_ROOT, 'kit', 'scripts', 'lib', 'cwos-compute-job.js'));

const commit = process.argv[2];
const wsId = process.argv[3];

// A malformed invocation prints nothing and exits 0. Exiting non-zero would make the feeder
// treat a bad argument as a fleet outage; printing nothing degrades to the legacy key, which
// is the same thing every other failure path here does.
if (!commit || !wsId || !/^[A-Za-z0-9_.^~-]+$/.test(commit) || !/^[A-Za-z]{2,4}-\d+$/.test(wsId)) {
  process.exit(0);
}

const item = readQueueItem(path.join(REPO_ROOT, '.claude', 'workstream', 'queue'), wsId);
if (!item || !item.compute_job || !Array.isArray(item.compute_job.steps)) process.exit(0);

const digest = codeDigest({ steps: item.compute_job.steps, repoRoot: REPO_ROOT, commit });
if (digest) process.stdout.write(digest + '\n');
