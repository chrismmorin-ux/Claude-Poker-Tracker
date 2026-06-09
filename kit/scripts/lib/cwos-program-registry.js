'use strict';
/**
 * cwos-program-registry — shared library that materializes a repo's
 * .claude/workstream/programs/registry.yaml from the rich prog-*.yaml files
 * sitting next to it.
 *
 * Why this exists (kit-v3.6.1 plumbing batch 2):
 *
 *   Before this library, /adopt copied each prog-*.yaml into programs/ but
 *   left registry.yaml at its template default of `programs: []`. /pulse
 *   reads prog-*.yaml directly so it rendered fine, but /next reads
 *   registry.yaml — saw zero active programs — and blocked every sprint
 *   composition with reason "no_programs_active". The same bug bit
 *   cwos-pulse escalate: it emitted a program_escalated event but the
 *   registry stayed stale, so the founder's "escalate launch to critical"
 *   intent vanished as far as /next was concerned.
 *
 * Source-of-truth resolution: prog-*.yaml is canonical. registry.yaml is a
 * derived, lean index that exists for fast scanning and founder priority
 * ordering. Drift between the two is always a registry-stale-vs-prog bug,
 * never the reverse. This library is the deterministic re-materialization
 * that closes the loop.
 *
 * INV-052 (asserted by cwos-audit): for every prog-<id>.yaml file in
 * .claude/workstream/programs/, registry.yaml MUST contain an entry whose
 * tier === the prog file's tier field. Surface as a finding when violated.
 *
 * Exports:
 *   - readPrograms(programsDir) → array of program summary objects
 *   - materializeRegistry(programsDir) → { programs: [...] } object
 *   - writeRegistry(registryPath, registry) → writes file, preserving
 *     header comments above the `schema_version:` line
 *   - syncRegistry(programsDir) → reads + writes; returns { written, drift }
 *   - detectDrift(programsDir) → returns array of drift entries, [] when clean
 */

const fs = require('fs');
const path = require('path');
const { readYAMLFile, writeFileAtomic, formatScalar } = require('./cwos-utils');

const REGISTRY_FILENAME = 'registry.yaml';
const PROG_FILE_RE = /^prog-.+\.yaml$/;

// Per-program founder_priority defaults. Documented at the top of the
// kit template's registry.yaml as the schema docstring; extracted here so
// the installer doesn't need to parse comments. Update both surfaces when
// adding a new program family.
const PROGRAM_PRIORITY_DEFAULTS = {
  'domain-correctness': 1,
  'financial-accuracy': 1,
  'data-quality': 1,
  'data-provenance': 1,
  'security': 2,
  'compliance': 2,
  'ux': 2,
  'design': 2,
  'launch': 2,
  'methodology-integrity': 2,
  'engineering': 3,
  'anti-hallucination': 3,
  'change-management': 4,
  'change-mgmt': 4,
  'vendor-risk': 4,
  'growth': 4,
  'infrastructure': 4,
  'claims-policy': 1,
  'optimization': 5,
  // HomeBase-only / generic fall-throughs default to 3.
};

function defaultFounderPriority(programId) {
  return PROGRAM_PRIORITY_DEFAULTS[programId] != null ? PROGRAM_PRIORITY_DEFAULTS[programId] : 3;
}

// Read every prog-<id>.yaml in programsDir (excluding prog-template.yaml)
// and return a registry-shaped summary array. Pure: no filesystem writes,
// no event emission. Failures on individual files surface as a warning
// in the returned `warnings` array — the registry omits that program
// rather than half-writing.
function readPrograms(programsDir) {
  const warnings = [];
  if (!fs.existsSync(programsDir) || !fs.statSync(programsDir).isDirectory()) {
    return { programs: [], warnings: [`programsDir does not exist: ${programsDir}`] };
  }

  const files = fs.readdirSync(programsDir)
    .filter(f => PROG_FILE_RE.test(f) && f !== 'prog-template.yaml')
    .sort();

  const programs = [];
  for (const f of files) {
    const r = readYAMLFile(path.join(programsDir, f));
    if (!r.ok || !r.data) {
      warnings.push(`failed to parse ${f}: ${r.error || 'no data'}`);
      continue;
    }
    const d = r.data;
    if (!d.id) {
      warnings.push(`${f}: missing id field`);
      continue;
    }
    programs.push(programSummary(d));
  }
  return { programs, warnings };
}

// Project a prog-<id>.yaml's parsed object down to the registry summary
// shape. Mirrors the kit/templates/workstream/programs/registry.yaml
// example block. founder_priority falls back to the per-program default
// table when the prog file doesn't carry it.
function programSummary(progData) {
  const entry = {
    id: progData.id,
    name: progData.name || progData.id,
    status: progData.status || 'NEW',
    tier: progData.tier || 'dormant',
    health_score: progData.health_score != null ? progData.health_score : null,
    last_run_date: progData.last_run_date || null,
    founder_priority: progData.founder_priority != null
      ? progData.founder_priority
      : defaultFounderPriority(progData.id),
  };
  if (Array.isArray(progData.blocks) && progData.blocks.length > 0) {
    entry.blocks = progData.blocks.slice();
  }
  if (progData.install_group) entry.install_group = progData.install_group;
  if (progData.monitor_only === true) entry.monitor_only = true;
  return entry;
}

// Build the full registry data structure (preserving schema_version).
function materializeRegistry(programsDir) {
  const { programs, warnings } = readPrograms(programsDir);
  return {
    schema_version: 3,
    programs,
    warnings,
  };
}

// Write registry.yaml at the given path, preserving any header comment
// block (everything above the first non-comment, non-blank line) from
// the existing file. When the file doesn't exist, write a minimal header
// pointing at the kit template documentation.
//
// Comment preservation matters because the kit template's registry.yaml
// header carries the ARCHETYPE → PROGRAM MAPPING reference table — a
// founder-facing doc that would silently vanish on each sync if we
// rewrote the whole file.
function writeRegistry(registryPath, registry) {
  const header = preserveHeader(registryPath);
  const lines = [];
  if (header) lines.push(header.trimEnd(), '');
  lines.push(`schema_version: ${registry.schema_version}`);
  lines.push('');
  if (!Array.isArray(registry.programs) || registry.programs.length === 0) {
    lines.push('programs: []');
  } else {
    lines.push('programs:');
    for (const p of registry.programs) {
      lines.push(`  - id: ${formatScalar(p.id)}`);
      lines.push(`    name: ${formatScalar(p.name)}`);
      lines.push(`    status: ${formatScalar(p.status)}`);
      lines.push(`    tier: ${formatScalar(p.tier)}`);
      lines.push(`    health_score: ${p.health_score == null ? 'null' : p.health_score}`);
      lines.push(`    last_run_date: ${p.last_run_date == null ? 'null' : formatScalar(p.last_run_date)}`);
      lines.push(`    founder_priority: ${p.founder_priority}`);
      if (Array.isArray(p.blocks)) {
        if (p.blocks.length === 0) lines.push(`    blocks: []`);
        else {
          lines.push(`    blocks:`);
          for (const b of p.blocks) lines.push(`      - ${formatScalar(b)}`);
        }
      }
      if (p.install_group) lines.push(`    install_group: ${formatScalar(p.install_group)}`);
      if (p.monitor_only === true) lines.push(`    monitor_only: true`);
    }
  }
  lines.push('');
  writeFileAtomic(registryPath, lines.join('\n'));
}

// Read the existing registry.yaml and return the leading comment block
// (lines starting with `#` or blank, up to first non-comment line). null
// when the file doesn't exist. We intentionally drop the existing programs:
// block — that's what we're rewriting.
function preserveHeader(registryPath) {
  if (!fs.existsSync(registryPath)) {
    return [
      '# Program Registry — maintained by cwos-program-registry.js',
      '#',
      '# This file is a derived index. The canonical source for each program',
      '# is .claude/workstream/programs/prog-<id>.yaml. Drift between the two',
      '# is always a stale-registry bug — re-sync via:',
      '#   node kit/scripts/cwos-program-registry-sync.js',
      '#',
      '# /pulse reads prog-<id>.yaml directly. /next reads this file.',
      '# INV-052 asserts both surfaces agree on every program\'s tier.',
    ].join('\n');
  }
  const text = fs.readFileSync(registryPath, 'utf8');
  const lines = text.split('\n');
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (t === '' || t.startsWith('#')) {
      out.push(line);
      continue;
    }
    break;
  }
  return out.length > 0 ? out.join('\n') : null;
}

// Read prog-*.yaml + registry.yaml, return drift entries that violate
// INV-052. Each entry: { program_id, prog_tier, registry_tier, kind }.
// kind ∈ { missing_from_registry, tier_mismatch, extra_in_registry }.
function detectDrift(programsDir) {
  const registryPath = path.join(programsDir, REGISTRY_FILENAME);
  const { programs: progPrograms } = readPrograms(programsDir);
  const progByIdTier = new Map();
  for (const p of progPrograms) progByIdTier.set(p.id, p.tier);

  let registryPrograms = [];
  if (fs.existsSync(registryPath)) {
    const r = readYAMLFile(registryPath);
    if (r.ok && r.data && Array.isArray(r.data.programs)) {
      registryPrograms = r.data.programs;
    }
  }
  const regByIdTier = new Map();
  for (const e of registryPrograms) {
    if (e && e.id) regByIdTier.set(e.id, e.tier || 'dormant');
  }

  const drift = [];
  for (const [id, progTier] of progByIdTier.entries()) {
    if (!regByIdTier.has(id)) {
      drift.push({ program_id: id, prog_tier: progTier, registry_tier: null, kind: 'missing_from_registry' });
      continue;
    }
    const regTier = regByIdTier.get(id);
    if (regTier !== progTier) {
      drift.push({ program_id: id, prog_tier: progTier, registry_tier: regTier, kind: 'tier_mismatch' });
    }
  }
  for (const [id, regTier] of regByIdTier.entries()) {
    if (!progByIdTier.has(id)) {
      drift.push({ program_id: id, prog_tier: null, registry_tier: regTier, kind: 'extra_in_registry' });
    }
  }
  return drift;
}

// One-shot: materialize from prog-*.yaml, write to registry.yaml.
// Returns { written: bool, programs_count, warnings }. Idempotent — safe
// to call repeatedly; only writes if the projected registry differs from
// what's on disk.
function syncRegistry(programsDir) {
  const registryPath = path.join(programsDir, REGISTRY_FILENAME);
  const reg = materializeRegistry(programsDir);
  const projected = renderForCompare(reg);

  let existing = null;
  if (fs.existsSync(registryPath)) {
    existing = renderForCompare(readRegistryFromDisk(registryPath));
  }
  if (existing && existing === projected) {
    return { written: false, programs_count: reg.programs.length, warnings: reg.warnings };
  }
  writeRegistry(registryPath, reg);
  return { written: true, programs_count: reg.programs.length, warnings: reg.warnings };
}

function readRegistryFromDisk(registryPath) {
  const r = readYAMLFile(registryPath);
  if (!r.ok || !r.data) return { schema_version: 3, programs: [], warnings: [] };
  return {
    schema_version: r.data.schema_version || 3,
    programs: Array.isArray(r.data.programs) ? r.data.programs : [],
    warnings: [],
  };
}

// Stable serialization for idempotency compare — sort programs by id,
// drop warnings (transient), normalize null/undefined.
function renderForCompare(registry) {
  const sorted = (registry.programs || []).slice().sort((a, b) => {
    return (a.id || '').localeCompare(b.id || '');
  }).map(p => ({
    id: p.id,
    name: p.name || p.id,
    status: p.status || 'NEW',
    tier: p.tier || 'dormant',
    health_score: p.health_score == null ? null : p.health_score,
    last_run_date: p.last_run_date == null ? null : p.last_run_date,
    founder_priority: p.founder_priority,
    blocks: Array.isArray(p.blocks) ? p.blocks.slice().sort() : undefined,
    install_group: p.install_group || undefined,
    monitor_only: p.monitor_only === true ? true : undefined,
  }));
  return JSON.stringify({ schema_version: registry.schema_version, programs: sorted });
}

module.exports = {
  REGISTRY_FILENAME,
  readPrograms,
  materializeRegistry,
  writeRegistry,
  syncRegistry,
  detectDrift,
  defaultFounderPriority,
  programSummary,
};
