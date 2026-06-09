'use strict';
/**
 * cwos-kit-dirs.js — Single source of truth for the procedurally-created
 * directory sets that /adopt provisions, plus an idempotent backfill the
 * UPGRADE path can call (WS-403).
 *
 * Why this exists: the subdir sets below are created by
 * cwos-adopt-install.js:ensureDirectories at /adopt time, but the upgrade
 * path (cwos-migrate.js, used by /fleet-update and /kit-upgrade) never runs
 * that function. Zero MANIFEST files land under docs/evolution/, so migrate's
 * per-file ensureDir() never creates it either. Result: repos adopted before a
 * given dir set existed never backfill it on upgrade. ensureCapabilityDirs()
 * closes that gap from the shared upgrade path.
 *
 * Robustness note: gating purely on .cwos-onboarding.yaml#capabilities is
 * fragile — a repo missing that file (WS-407) has it re-installed from a
 * template whose capabilities are all `unconfigured`, which would suppress the
 * backfill in exactly the scenario WS-403 targets. So enabledCapabilities()
 * takes the UNION of onboarding-declared state and on-disk evidence. Creating
 * an empty dir is harmless and idempotent, so a false-positive costs nothing;
 * a false-negative reproduces the bug.
 */

const fs = require('fs');
const path = require('path');
const { readYAMLFile } = require('./cwos-utils');

// Subdirectories of .claude/workstream/ created when the workstream capability
// is enabled. Mirrors WORKSTREAM_SUBDIRS consumed by ensureDirectories.
const WORKSTREAM_SUBDIRS = [
  'queue', 'queue/archive',
  'findings', 'findings/archive',
  'engines', 'programs',
  'enhancements', 'readiness',
  'sprints', 'runs', 'evidence',
  'governance',
];

// Subdirectories the engine library + trend persistence depend on. Created at
// engines-capability time because that's the first capability that touches
// docs/evolution/. compliance-scores/ holds per-run score files; trends.yaml
// lives in docs/evolution/ directly.
const DOCS_EVOLUTION_SUBDIRS = [
  'docs/evolution',
  'docs/evolution/compliance-scores',
];

const VALID_CAPABILITIES = ['core', 'workstream', 'engines', 'governance', 'autonomous'];

// Capabilities the .cwos-onboarding.yaml#capabilities block declares enabled.
// Returns a Set (possibly empty); null only if the file is absent.
function onboardingEnabled(repoPath) {
  const fp = path.join(repoPath, '.cwos-onboarding.yaml');
  if (!fs.existsSync(fp)) return null;
  const r = readYAMLFile(fp);
  if (!r.ok || !r.data || !r.data.capabilities) return new Set();
  const out = new Set();
  for (const cap of VALID_CAPABILITIES) {
    const entry = r.data.capabilities[cap];
    if (entry && entry.state === 'enabled') out.add(cap);
  }
  return out;
}

// Capabilities inferred from files actually on disk. Independent of the
// onboarding file (which may have just been re-templated). These are the
// durable, hard-to-fake signals that a capability is in use.
function diskEnabled(repoPath) {
  const out = new Set(['core']);
  if (fs.existsSync(path.join(repoPath, '.claude', 'workstream'))) out.add('workstream');
  const engineCmd = path.join(repoPath, '.claude', 'commands', 'engine.md');
  const engineReg = path.join(repoPath, '.claude', 'workstream', 'engines', 'registry.yaml');
  if (fs.existsSync(engineCmd) || fs.existsSync(engineReg)) out.add('engines');
  return out;
}

// Union of declared + on-disk capability evidence. Used by the backfill so a
// missing/re-templated onboarding file can't suppress directory creation.
function enabledCapabilities(repoPath) {
  const declared = onboardingEnabled(repoPath) || new Set();
  const disk = diskEnabled(repoPath);
  return new Set([...declared, ...disk]);
}

// Repo-relative directories that SHOULD exist for the given enabled set.
function expectedCapabilityDirs(enabled) {
  const dirs = [];
  if (enabled.has('workstream')) {
    for (const sub of WORKSTREAM_SUBDIRS) {
      dirs.push(path.join('.claude', 'workstream', ...sub.split('/')));
    }
  }
  if (enabled.has('engines')) {
    for (const sub of DOCS_EVOLUTION_SUBDIRS) {
      dirs.push(path.join(...sub.split('/')));
    }
  }
  return dirs;
}

// Idempotent backfill of the procedural dir sets. Returns { created: [...] }
// listing repo-relative paths that were newly made (forward-slash form).
// opts.enabled overrides capability detection (used by tests); opts.dryRun
// reports without writing.
function ensureCapabilityDirs(repoPath, opts = {}) {
  const enabled = opts.enabled || enabledCapabilities(repoPath);
  const created = [];
  for (const rel of expectedCapabilityDirs(enabled)) {
    const abs = path.join(repoPath, rel);
    if (!fs.existsSync(abs)) {
      if (!opts.dryRun) fs.mkdirSync(abs, { recursive: true });
      created.push(rel.replace(/\\/g, '/'));
    }
  }
  return { created };
}

module.exports = {
  WORKSTREAM_SUBDIRS,
  DOCS_EVOLUTION_SUBDIRS,
  VALID_CAPABILITIES,
  onboardingEnabled,
  diskEnabled,
  enabledCapabilities,
  expectedCapabilityDirs,
  ensureCapabilityDirs,
};
