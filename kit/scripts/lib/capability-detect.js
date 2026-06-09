/**
 * capability-detect.js — Filesystem-based capability detection.
 *
 * Complements capability-map.js's resolveEnabledCapabilities() (which reads
 * declared state from .cwos-onboarding.yaml) with ground-truth detection
 * that probes the repo's filesystem for evidence of each capability.
 *
 * Used by:
 *   - cwos-fleet-scan.js to detect drift between registry and actual state
 *   - /session-start Step 3c registry-sync hook to cross-check declared vs actual
 *   - /discover configure mode Step 5 (detection logic previously inlined there)
 *
 * Detection rules (one per capability):
 *   core        — .cwos-version file exists
 *   workstream  — .claude/workstream/queue/ exists with WS-*.yaml files
 *                 OR .claude/workstream/queue-index.yaml has non-empty items
 *   engines     — .claude/workstream/engines/registry.yaml exists with entries
 *   governance  — at least one .claude/workstream/programs/prog-*.yaml has
 *                 last_run_by_protocol.baseline.date set (installed AND run)
 *   autonomous  — .claude/commands/plan.md exists AND system/decisions.md has
 *                 at least one non-template DEC entry
 *
 * Zero external dependencies. Returns Set<string>.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { readYAMLFile } = require('./cwos-utils');

const CAPABILITY_ORDER = ['core', 'workstream', 'engines', 'governance', 'autonomous'];

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function listMatchingFiles(dir, pattern) {
  if (!dirExists(dir)) return [];
  try {
    return fs.readdirSync(dir).filter((name) => pattern.test(name));
  } catch { return []; }
}

function detectCore(repoPath) {
  return fileExists(path.join(repoPath, '.cwos-version'));
}

function detectWorkstream(repoPath) {
  const queueDir = path.join(repoPath, '.claude', 'workstream', 'queue');
  const wsFiles = listMatchingFiles(queueDir, /^WS-\d+\.ya?ml$/);
  if (wsFiles.length > 0) return true;

  const indexPath = path.join(repoPath, '.claude', 'workstream', 'queue-index.yaml');
  if (!fileExists(indexPath)) return false;
  const { ok, data } = readYAMLFile(indexPath);
  return ok && Array.isArray(data && data.items) && data.items.length > 0;
}

function detectEngines(repoPath) {
  const regPath = path.join(repoPath, '.claude', 'workstream', 'engines', 'registry.yaml');
  if (!fileExists(regPath)) return false;
  const { ok, data } = readYAMLFile(regPath);
  if (!ok || !data) return false;
  const engines = data.engines;
  return Array.isArray(engines) && engines.length > 0;
}

function detectGovernance(repoPath) {
  const progDir = path.join(repoPath, '.claude', 'workstream', 'programs');
  const progFiles = listMatchingFiles(progDir, /^prog-.+\.ya?ml$/)
    .filter((name) => name !== 'prog-template.yaml');
  if (progFiles.length === 0) return false;

  for (const name of progFiles) {
    const { ok, data } = readYAMLFile(path.join(progDir, name));
    if (!ok || !data) continue;
    const baseline = data.last_run_by_protocol
      && data.last_run_by_protocol.baseline;
    if (baseline && baseline.date) return true;
  }
  return false;
}

function detectAutonomous(repoPath) {
  const planPath = path.join(repoPath, '.claude', 'commands', 'plan.md');
  const decisionsPath = path.join(repoPath, 'system', 'decisions.md');
  if (!fileExists(planPath) || !fileExists(decisionsPath)) return false;

  let text;
  try { text = fs.readFileSync(decisionsPath, 'utf8'); } catch { return false; }

  // Count decision headings. Accept both DEC-NNN (kit-native) and ADR-NNNN
  // (widely used community format) since /adopt's governance detector can
  // seed either into system/decisions.md.
  const headings = text.match(/^#{2,4}\s+(?:DEC|ADR)-\d+/gm) || [];
  if (headings.length === 0) return false;

  // Treat a single adoption-seeded "DEC-001: Adopt CWOS" as template-only.
  // Any second decision, or any ADR at all, or a DEC-001 with a different
  // title, counts as real autonomous activity.
  if (headings.length === 1 && /DEC-001\b/.test(headings[0])) {
    const adoptSeeded = /DEC-001[^\n]*(?:Adopt CWOS|Adopted CWOS)/i.test(text);
    return !adoptSeeded;
  }
  return true;
}

const DETECTORS = {
  core: detectCore,
  workstream: detectWorkstream,
  engines: detectEngines,
  governance: detectGovernance,
  autonomous: detectAutonomous,
};

/**
 * Probe a repo's filesystem and return the Set of capabilities for which
 * evidence was found. Does NOT read .cwos-onboarding.yaml — that's the
 * declared-state resolver's job (see capability-map.js).
 */
function detectCapabilities(repoPath) {
  const found = new Set();
  for (const cap of CAPABILITY_ORDER) {
    try {
      if (DETECTORS[cap](repoPath)) found.add(cap);
    } catch {
      // Detection is best-effort; swallow per-capability errors so one
      // broken file doesn't mask the rest.
    }
  }
  return found;
}

/**
 * Compare declared capabilities (from capability-map.resolveEnabledCapabilities)
 * against filesystem-detected capabilities. Returns an object describing any
 * drift, or null if declared matches detected exactly.
 */
function compareCapabilities(declared, detected) {
  const declaredSet = declared instanceof Set ? declared : new Set(declared);
  const detectedSet = detected instanceof Set ? detected : new Set(detected);

  const declaredOnly = [...declaredSet].filter((c) => !detectedSet.has(c));
  const detectedOnly = [...detectedSet].filter((c) => !declaredSet.has(c));

  if (declaredOnly.length === 0 && detectedOnly.length === 0) return null;
  return {
    declared: [...declaredSet].sort(),
    detected: [...detectedSet].sort(),
    declared_only: declaredOnly.sort(), // declared but no filesystem evidence
    detected_only: detectedOnly.sort(), // filesystem evidence but not declared
  };
}

module.exports = {
  CAPABILITY_ORDER,
  detectCapabilities,
  compareCapabilities,
  // Exported per-capability detectors for targeted testing:
  detectCore,
  detectWorkstream,
  detectEngines,
  detectGovernance,
  detectAutonomous,
};
