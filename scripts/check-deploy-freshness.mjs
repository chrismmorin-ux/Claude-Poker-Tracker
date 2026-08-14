#!/usr/bin/env node
// check-deploy-freshness.mjs — warn when finished work is stranded off the deployed branch.
//
// Origin: 2026-08-13. The founder reported unscrollable lessons/drills for the THIRD
// time while the fix (55253997, 2026-08-05) sat verified on a work branch. main had
// been frozen since 2026-08-02; deploy.yml fires only on push to main, so 121 commits
// of finished work — including the fix — never reached the deployed PWA. Fixes were
// landing in code and never shipping, and nothing surfaced the gap.
//
// This script measures that gap deterministically:
//   - every commit on any LOCAL branch not reachable from origin/main is "undeployed"
//   - WARN when the oldest undeployed commit is older than WARN_DAYS
//   - RED  when older than RED_DAYS
//
// Wired into: SessionStart hooks (.claude/settings.json) and /status. Exit code is
// always 0 — this is a signal, never a blocker. INV-DEPLOY-FRESHNESS in
// system/invariants.md is the governance entry.
//
// Flags: --json (machine output), --quiet (print nothing when green).

import { execSync } from 'node:child_process';

const WARN_DAYS = 3;
const RED_DAYS = 7;

function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const quiet = argv.includes('--quiet');

function emit(result) {
  if (asJson) {
    console.log(JSON.stringify(result));
  } else if (result.level !== 'green' || !quiet) {
    console.log(result.message);
  }
  process.exit(0); // never block a session on this signal
}

let deployedRef = 'origin/main';
try {
  git(`rev-parse --verify --quiet ${deployedRef}`);
} catch {
  emit({ level: 'green', message: 'Deploy freshness: no origin/main ref — skipped.' });
}

try {
  // All commits on local branches not reachable from the deployed branch.
  const countStr = git(`rev-list --branches --not ${deployedRef} --count`);
  const undeployed = parseInt(countStr, 10) || 0;

  if (undeployed === 0) {
    emit({ level: 'green', undeployed: 0, message: '✓ Deploy freshness: no finished work stranded off origin/main.' });
  }

  // Oldest undeployed commit (committer time, seconds).
  const dates = git(`rev-list --branches --not ${deployedRef} --format=%ct --no-commit-header`)
    .split('\n').map(Number).filter(Boolean);
  const oldest = Math.min(...dates);
  const ageDays = (Date.now() / 1000 - oldest) / 86400;
  const ageStr = ageDays.toFixed(1);

  const mainTipDate = git(`log -1 --format=%cs ${deployedRef}`);

  let level = 'green';
  if (ageDays > RED_DAYS) level = 'red';
  else if (ageDays > WARN_DAYS) level = 'warn';

  const icon = level === 'red' ? '✗ RED' : level === 'warn' ? '⚠' : '✓';
  const message =
    `${icon} Deploy freshness: ${undeployed} commit(s) not on origin/main; oldest is ${ageStr} days old ` +
    `(deployed tip: ${mainTipDate}). Threshold: warn>${WARN_DAYS}d, red>${RED_DAYS}d.` +
    (level !== 'green'
      ? ' Finished work is NOT reaching the deployed app — merge/push to main to release, or this recurs as "still broken" reports.'
      : '');

  emit({ level, undeployed, oldestAgeDays: Number(ageStr), deployedTip: mainTipDate, message });
} catch (err) {
  // Never let the freshness check itself break a session.
  emit({ level: 'green', message: `Deploy freshness: check errored (${String(err.message).split('\n')[0]}) — skipped.` });
}
