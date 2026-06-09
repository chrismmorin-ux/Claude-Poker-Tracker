#!/usr/bin/env node
// AS-33 invocation check for corrective-plan v1 (WS-408 / ADR-050).
//
// AS-33 (per ADR-050, as amended by WS-415):
//   "corrective-plan is invoked at least three times in HomeBase within 30
//    days of v1 ship — sufficient signal to inform AS-29's weekly-cadence
//    claim rather than only act as a presence smoke test."
//   threshold:  invocation_count_in_homebase < 3 within window
//   window:     2026-05-13 to 2026-06-12
//   source:     .claude/workstream/meta/skill-telemetry.yaml
//
// Behavior: reads telemetry, filters corrective-plan entries in the window,
// compares against threshold, emits JSON on stdout, exits 0|1|2.
//
// Exit codes:
//   0  pending OR validated (window still open, or threshold met)
//   1  contradicted (window closed AND threshold not met)
//   2  read error (file missing / unparseable / schema mismatch)
//
// Run via: node engines/library/corrective-plan/as33-check.js
// Optional: env CWOS_AS33_TELEMETRY_PATH overrides the default file path
// (useful for tests).

const path = require('path');
const { readYAMLFile, findRepoRoot } = require(path.join(
  __dirname, '..', '..', '..', 'kit', 'scripts', 'lib', 'cwos-utils.js'
));

const WINDOW_START = '2026-05-13T00:00:00Z';
const WINDOW_END = '2026-06-12T23:59:59Z';
const THRESHOLD = 3;
const AS_ID = 'AS-33';

function emit(result, exitCode) {
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(exitCode);
}

const repoRoot = findRepoRoot(__dirname) || process.cwd();
const telemetryPath = process.env.CWOS_AS33_TELEMETRY_PATH
  || path.join(repoRoot, '.claude', 'workstream', 'meta', 'skill-telemetry.yaml');

const telemetry = readYAMLFile(telemetryPath);
if (!telemetry.ok || !telemetry.data || !Array.isArray(telemetry.data.entries)) {
  emit({
    ok: false,
    as_id: AS_ID,
    window: `${WINDOW_START.slice(0, 10)}..${WINDOW_END.slice(0, 10)}`,
    threshold: THRESHOLD,
    observed: null,
    status: 'read-error',
    verdict: 'unknown',
    error: telemetry.error || 'telemetry yaml missing entries[] array',
  }, 2);
}

const winStart = Date.parse(WINDOW_START);
const winEnd = Date.parse(WINDOW_END);
const now = Date.now();

const matching = telemetry.data.entries.filter(e => {
  if (!e || e.skill !== 'corrective-plan' || !e.invoked_at) return false;
  const t = Date.parse(e.invoked_at);
  return Number.isFinite(t) && t >= winStart && t <= winEnd;
});

const observed = matching.length;
const windowClosed = now > winEnd;
const daysRemaining = Math.max(0, Math.ceil((winEnd - now) / (24 * 60 * 60 * 1000)));

let status;
let verdict;
let exitCode;
if (observed >= THRESHOLD) {
  status = 'validated';
  verdict = 'validated';
  exitCode = 0;
} else if (windowClosed) {
  status = 'contradicted';
  verdict = 'contradicted';
  exitCode = 1;
} else {
  status = 'in-progress';
  verdict = 'pending';
  exitCode = 0;
}

emit({
  ok: true,
  as_id: AS_ID,
  window: `${WINDOW_START.slice(0, 10)}..${WINDOW_END.slice(0, 10)}`,
  threshold: THRESHOLD,
  observed,
  status,
  days_remaining: daysRemaining,
  verdict,
  needed_for_pass: Math.max(0, THRESHOLD - observed),
}, exitCode);
