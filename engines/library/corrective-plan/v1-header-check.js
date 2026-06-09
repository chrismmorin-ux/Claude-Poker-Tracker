#!/usr/bin/env node
// v1-header-check: emit a v1-status header block when corrective-plan's
// measurement scorecard has ship_gate.overall != "ready". When ready, emits
// nothing (header auto-suppresses). Fails CLOSED — degraded header on error,
// never blocks the engine.
//
// Invoked by engines/library/corrective-plan/SKILL.md Phase 4a + Phase 5
// (WS-416 / FIND-275). Wired per ADR-050 v1 measurement-gate exception
// (sunset 2026-06-13).

const path = require('path');
const { readYAMLFile, findRepoRoot } = require(path.join(
  __dirname, '..', '..', '..', 'kit', 'scripts', 'lib', 'cwos-utils.js'
));

const HEADER = [
  '> **⚠ v1 — measurement-gate exception in force (sunset 2026-06-13).**',
  '> Findings below are directional, not measurement-validated. This engine',
  '> has not yet completed phase-5 measurement gating. Treat findings with',
  '> appropriate skepticism; promote to work items only after review. See',
  '> WS-408 for resolution status.',
  '',
].join('\n');

function emitHeader() {
  process.stdout.write(HEADER);
  process.exit(0);
}

function emitNothing() {
  process.exit(0);
}

const repoRoot = findRepoRoot(__dirname) || process.cwd();
const manifestPath = path.join(repoRoot, 'engines', 'library', 'corrective-plan', 'MANIFEST.yaml');

const manifest = readYAMLFile(manifestPath);
if (!manifest.ok || !manifest.data || !manifest.data.measurement_record) {
  emitHeader(); // fail-closed
}

const scorecardPath = path.join(repoRoot, manifest.data.measurement_record);
const scorecard = readYAMLFile(scorecardPath);
if (!scorecard.ok || !scorecard.data || !scorecard.data.ship_gate) {
  emitHeader(); // fail-closed
}

if (scorecard.data.ship_gate.overall === 'ready') {
  emitNothing();
}

emitHeader();
