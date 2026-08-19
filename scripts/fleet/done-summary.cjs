#!/usr/bin/env node
'use strict';
/**
 * done-summary.js — list the compute runner's terminal jobs as `id|ws_id|job_hash|outcome`.
 *
 * WHY A FILE INSTEAD OF AN INLINE COMMAND. The feeder needs this over ssh, and the obvious
 * `ssh node1 "powershell -Command ... ForEach-Object { $_ ... }"` does not survive the hop:
 * the `$` variables came back empty on 2026-08-16, so the check silently found zero finished
 * jobs and the feeder happily re-submitted work that had already run. A silent empty result
 * is the worst possible failure for a dedupe check — it does not error, it just stops
 * deduping. Invoking a versioned file with no shell metacharacters removes the whole class.
 *
 * Lives in the repo because cm-node1 already syncs it (compute-feed.ps1 pulls before it
 * feeds), so there is nothing extra to deploy or keep in step.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

// Same fingerprint function the feeder uses on a candidate — that symmetry IS the dedupe.
const REPO_ROOT = path.join(__dirname, '..', '..');
const { stepsFingerprint } = require(path.join(REPO_ROOT, 'kit', 'scripts', 'lib', 'cwos-compute-job.js'));
// WS-572: the code the job ran is part of its identity. The candidate side computes this
// through scripts/fleet/code-digest.cjs, on this same machine and this same working tree, so
// both sides see the same import closure and differ only in the commit they price it at.
const { codeDigest } = require(path.join(REPO_ROOT, 'kit', 'scripts', 'lib', 'cwos-code-digest.js'));

// One ls-tree per distinct commit, not per job: eleven terminal records share a handful of
// commits, and this runs on every feed tick.
const digestCache = new Map();
function digestFor(steps, commit) {
  if (!commit || !Array.isArray(steps)) return null;
  const key = commit + '|' + JSON.stringify(steps.map((s) => s.args || []));
  if (!digestCache.has(key)) {
    digestCache.set(key, codeDigest({ steps, repoRoot: REPO_ROOT, commit }));
  }
  return digestCache.get(key);
}

const DONE = process.argv[2]
  || path.join(process.env.USERPROFILE || os.homedir(), 'fleet', 'compute', 'done');

let files = [];
try {
  files = fs.readdirSync(DONE).filter((f) => f.endsWith('.json'));
} catch {
  // No done dir yet is a legitimate empty result, not an error: a runner that has never
  // finished a job has nothing to dedupe against.
  process.exit(0);
}

for (const f of files) {
  let j = null;
  try {
    j = JSON.parse(fs.readFileSync(path.join(DONE, f), 'utf8'));
  } catch {
    continue;   // a half-written terminal file is not evidence of anything
  }
  // The runner does NOT preserve the submitted spec's `source` block into its terminal
  // record (verified 2026-08-16 on ws-295-bc1cf2ea6256), so ws_id and job_hash are usually
  // empty and cannot be relied on. It DOES preserve `steps`, which is the better key anyway:
  // fingerprinting the recorded steps with the same function the feeder uses on a candidate
  // makes the comparison symmetric, so changing the fingerprint definition re-keys both
  // sides instead of silently invalidating history and re-running finished work.
  const src = j.source || {};
  process.stdout.write([
    f.replace(/\.json$/, ''),
    src.ws_id || '',
    stepsFingerprint(j.steps, j.inputs, digestFor(j.steps, j.commit)),
    j.outcome || '',
    // WS-547: the runner's OWN verdict on why the job ended, base64 so a detail carrying a
    // pipe, a newline or a Windows path cannot corrupt the record separator.
    //
    // Without this the harvester had only the step log to go on, and a job that dies BEFORE
    // any step starts writes no step log at all. ws-503-17172f8726ce died in the runner's
    // `ensureWorktree` and was filed as "no error captured in the step log" while THIS field
    // held the exact cause. A failure that looks undiagnosable is worse than a loud one: it
    // reads as bad luck, and nobody goes looking for a mechanism behind bad luck.
    Buffer.from(String(j.detail || ''), 'utf8').toString('base64'),
  ].join('|') + '\n');
}
