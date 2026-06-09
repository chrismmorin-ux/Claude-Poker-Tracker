/**
 * cwos-skill-telemetry — append a telemetry entry on engine_run_completed (WS-414).
 *
 * Closes FIND-273: corrective-plan SKILL.md Phase 4e ("Append to
 * skill-telemetry.yaml") was prose-driven, ritual-dependent. AS-33's
 * observation source was structurally unreliable because the file did
 * not exist and no script wrote to it.
 *
 * This module is invoked deterministically by cwos-engine-complete.js
 * after writeRunSummary() finishes. It reads the run's manifest +
 * summary + optional per-engine extractor, then appends a single
 * entry to .claude/workstream/meta/skill-telemetry.yaml.
 *
 * Schema v1 (per AskUserQuestion 2026-05-14 answer A):
 *   generic fields + engine_specific blob.
 *
 * Usage:
 *   writeSkillTelemetry({ runId, runDir, wsDir, engineId, programId, clock? })
 *
 * Returns: { ok, telemetry_path, skipped?, reason? }
 *
 * Always best-effort. Missing manifest / missing summary — entry still
 * appends with null fields. Re-running on same run_id is idempotent.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const {
  readYAMLFile,
  serializeYAML,
  writeFileAtomic,
  withFileLock,
} = require('./cwos-utils');

const SCHEMA_VERSION = 1;

const HEADER = `# Skill telemetry — engine run records. WS-414 / FIND-273.
#
# AUTO-APPENDED by kit/scripts/lib/cwos-skill-telemetry.js on every
# engine_run_completed event (via cwos-engine-complete.js).
#
# Schema v1:
#   - skill              engine ID (e.g. "corrective-plan", "eng-engine")
#   - invoked_at         ISO8601 start timestamp (from run manifest)
#   - completed_at       ISO8601 end timestamp
#   - run_id             run-NNN
#   - target             artifact path the engine was invoked against
#   - program            program_id derived from target
#   - verdict            ship | amend | reframe | reject | investigate | holds | unknown
#   - finding_counts     { critical, high, medium, low } | null
#   - founder_action     pending | applied | promoted | reframed | override
#   - wall_minutes       integer minutes from invoked_at → completed_at
#   - tokens_derived     integer | null (from manifest.tokens_observed)
#   - tokens_derived_source  "command_telemetry_stamped" | "artifact_size_proxy" | "unavailable"
#   - engine_specific    { ... } — per-engine extension blob from
#                         engines/library/<engine>/telemetry-extract.js
#
# This file is the AS-33 observation source for ADR-050. Do not edit by hand;
# the cwos-skill-telemetry library de-duplicates on run_id and is the canonical
# writer.

`;

function readBriefingVerdict(runDir) {
  const briefingPath = path.join(runDir, 'artifacts', 'phase-3', 'briefing.md');
  if (!fs.existsSync(briefingPath)) return null;
  let md;
  try { md = fs.readFileSync(briefingPath, 'utf8'); }
  catch { return null; }
  // briefing.md line 4 convention: **Verdict:** **AMEND** (1 CRITICAL + 3 HIGH + 3 MEDIUM)
  const m = md.match(/\*\*Verdict:\*\*\s*\*\*([A-Z]+)\*\*/);
  if (!m) return null;
  return String(m[1]).toLowerCase();
}

function readBriefingFindingCounts(runDir) {
  const briefingPath = path.join(runDir, 'artifacts', 'phase-3', 'briefing.md');
  if (!fs.existsSync(briefingPath)) return null;
  let md;
  try { md = fs.readFileSync(briefingPath, 'utf8'); }
  catch { return null; }
  // Match the verdict-line count tail: (1 CRITICAL + 3 HIGH + 3 MEDIUM + 0 LOW)
  // Severity tokens may appear in any order; LOW often omitted.
  const tail = md.match(/\*\*Verdict:\*\*\s*\*\*[A-Z]+\*\*\s*\(([^)]+)\)/);
  if (!tail) return null;
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  const re = /(\d+)\s*(CRITICAL|HIGH|MEDIUM|LOW)/gi;
  let m;
  while ((m = re.exec(tail[1])) !== null) {
    const sev = m[2].toLowerCase();
    counts[sev] = parseInt(m[1], 10);
  }
  // If we matched no severity tokens at all, return null (parse failure)
  if (counts.critical + counts.high + counts.medium + counts.low === 0
      && !/0\s*(CRITICAL|HIGH|MEDIUM|LOW)/i.test(tail[1])) {
    return null;
  }
  return counts;
}

function loadEngineExtractor(repoRoot, engineId) {
  if (!engineId) return null;
  const extractorPath = path.join(repoRoot, 'engines', 'library', engineId, 'telemetry-extract.js');
  if (!fs.existsSync(extractorPath)) return null;
  try {
    delete require.cache[require.resolve(extractorPath)];
    return require(extractorPath);
  } catch { return null; }
}

function entryExistsForRun(entries, runId) {
  if (!Array.isArray(entries)) return false;
  return entries.some(e => e && e.run_id === runId);
}

function computeWallMinutes(startedAt, completedAt) {
  if (!startedAt || !completedAt) return null;
  try {
    const startMs = new Date(startedAt).getTime();
    const endMs = new Date(completedAt).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
    return Math.round((endMs - startMs) / 60000);
  } catch { return null; }
}

function writeSkillTelemetry({ runId, runDir, wsDir, engineId, programId, clock }) {
  if (!runId || !runDir || !wsDir) {
    return { ok: false, reason: 'missing required arg' };
  }

  const metaDir = path.join(wsDir, 'meta');
  if (!fs.existsSync(metaDir)) {
    try { fs.mkdirSync(metaDir, { recursive: true }); }
    catch (e) { return { ok: false, reason: `mkdir failed: ${e.message}` }; }
  }

  const telemetryPath = path.join(metaDir, 'skill-telemetry.yaml');

  // Read existing file (or init).
  let doc = { schema_version: SCHEMA_VERSION, entries: [] };
  if (fs.existsSync(telemetryPath)) {
    const r = readYAMLFile(telemetryPath);
    if (r && r.ok && r.data) {
      doc = r.data;
      if (typeof doc.schema_version !== 'number') doc.schema_version = SCHEMA_VERSION;
      if (!Array.isArray(doc.entries)) doc.entries = [];
    }
  }

  // Idempotency: same run_id → no-op.
  if (entryExistsForRun(doc.entries, runId)) {
    return { ok: true, telemetry_path: telemetryPath, skipped: true, reason: 'run_id already recorded' };
  }

  // Load manifest + summary for entry fields.
  let manifest = null;
  const manifestPath = path.join(runDir, 'manifest.yaml');
  if (fs.existsSync(manifestPath)) {
    const r = readYAMLFile(manifestPath);
    if (r && r.ok) manifest = r.data;
  }
  let summary = null;
  const summaryPath = path.join(runDir, 'summary.yaml');
  if (fs.existsSync(summaryPath)) {
    const r = readYAMLFile(summaryPath);
    if (r && r.ok) summary = r.data;
  }

  const invokedAt = (manifest && manifest.started_at) || null;
  const completedAt = (manifest && manifest.completed_at)
    || (summary && summary.completed_at)
    || (clock || new Date().toISOString());
  const target = (manifest && manifest.target) || (summary && summary.target) || null;

  // Verdict + finding counts: prefer summary fields (writeRunSummary extension),
  // fall back to briefing.md scrape, then default.
  const verdict = (summary && summary.verdict)
    || readBriefingVerdict(runDir)
    || 'unknown';
  const findingCounts = (summary && summary.finding_counts)
    || readBriefingFindingCounts(runDir)
    || null;

  const wallMinutes = computeWallMinutes(invokedAt, completedAt);

  // Tokens — pulled from manifest.tokens_observed if present.
  const tokensDerived = (manifest && manifest.tokens_observed) || null;
  const tokensDerivedSource = tokensDerived ? 'command_telemetry_stamped' : 'unavailable';

  // Engine-specific blob via optional per-engine extractor.
  let engineSpecific = {};
  const repoRoot = path.resolve(wsDir, '..', '..');
  const extractor = loadEngineExtractor(repoRoot, engineId);
  if (extractor && typeof extractor.extractTelemetry === 'function') {
    try {
      const e = extractor.extractTelemetry({ runDir, manifest, summary });
      if (e && typeof e === 'object') engineSpecific = e;
    } catch { /* extractor threw — keep empty */ }
  }

  const entry = {
    skill: engineId || null,
    invoked_at: invokedAt,
    completed_at: completedAt,
    run_id: runId,
    target: target,
    program: programId || (manifest && manifest.program_id) || null,
    verdict: verdict,
    finding_counts: findingCounts,
    founder_action: 'pending',
    wall_minutes: wallMinutes,
    tokens_derived: tokensDerived,
    tokens_derived_source: tokensDerivedSource,
    engine_specific: engineSpecific,
  };

  doc.entries.push(entry);

  // Lock + write. Prepend the canonical HEADER so the documentation block
  // survives every auto-append round-trip (cwos-utils' serializeYAML does
  // not preserve comments).
  const lockPath = `${telemetryPath}.lock`;
  withFileLock(lockPath, () => {
    const body = serializeYAML(doc);
    const out = HEADER + body + (body.endsWith('\n') ? '' : '\n');
    writeFileAtomic(telemetryPath, out);
  }, { ownerLabel: 'skill-telemetry-append', maxWaitMs: 10000 });

  return { ok: true, telemetry_path: telemetryPath, entry };
}

module.exports = {
  writeSkillTelemetry,
  // Exposed for tests
  readBriefingVerdict,
  readBriefingFindingCounts,
  computeWallMinutes,
  SCHEMA_VERSION,
};
