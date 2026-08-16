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
  const src = j.source || {};
  process.stdout.write([
    f.replace(/\.json$/, ''),
    src.ws_id || '',
    src.job_hash || '',
    j.outcome || '',
  ].join('|') + '\n');
}
