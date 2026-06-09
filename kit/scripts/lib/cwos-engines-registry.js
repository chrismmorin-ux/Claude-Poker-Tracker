'use strict';
/**
 * cwos-engines-registry — shared library that materializes a repo's
 * .claude/workstream/engines/registry.yaml from the installed engine
 * skill files at .claude/commands/<id>.md.
 *
 * Why this exists (kit-v3.7.0 plumbing batch 3):
 *
 *   The kit template `kit/templates/workstream/engines/registry.yaml`
 *   ships with the engines: map partially populated — eng-engine,
 *   health-check, preflight, persona-validator, milestone-briefing,
 *   engine-briefing, goal-progress, component-alignment. Many other
 *   engines (constitutional-audit, drift-detector, design-audit, etc.)
 *   are commented out as "TODO" or "NOT YET IMPLEMENTED" placeholders.
 *
 *   The reality: those engines DO ship — they're in kit/MANIFEST.yaml,
 *   they land at .claude/commands/<id>.md during /adopt, and programs
 *   reference them via protocols.<name>.engine. But the registry never
 *   catches up. cwos-reconcile's protocol-engine-ref validator then
 *   warns 18+ times per run that programs reference engines "not in
 *   registry.yaml engines:" — confusing noise that drowns real issues.
 *
 *   This library scans the installed `.claude/commands/*.md` files,
 *   extracts frontmatter, and builds a complete engines map. Run during
 *   /adopt Phase 3e (and via the cwos-engines-registry-sync CLI for
 *   ongoing maintenance) so the registry stays in sync with what's
 *   actually installed.
 *
 * Exports:
 *   - readInstalledEngines(commandsDir) → array of engine summary objects
 *   - materializeRegistry(workstreamDir, opts) → { aliasesText, engines }
 *   - writeRegistry(registryPath, materialized) → writes, preserves header
 *   - syncRegistry(workstreamDir) → reads + writes; returns { written, count }
 *   - detectMissing(workstreamDir) → engines installed but not in registry
 */

const fs = require('fs');
const path = require('path');
const { readYAMLFile, writeFileAtomic, formatScalar } = require('./cwos-utils');

const COMMAND_FILE_RE = /\.md$/;
const REGISTRY_FILENAME = 'registry.yaml';

// Engines that are user-invocable commands, NOT analysis engines. Skip
// these when materializing the registry — they don't participate in the
// program-protocol invocation pipeline and shouldn't be referenced from
// prog-*.yaml protocols.
const NON_ENGINE_COMMANDS = new Set([
  // Workflow / orchestration commands
  'status', 'session-start', 'session-end', 'welcome', 'discover',
  'next', 'workstream', 'engine', 'build-engine',
  'pulse', 'audit', 'plan', 'verify', 'decide',
  'feedback', 'checkpoint', 'onboard-check',
  'adopt', 'genesis', 'intend', 'stage', 'archetype', 'rearchetype',
  'fleet-status', 'fleet-update', 'fleet-feedback', 'fleet-blitz',
  'sim', 'replay', 'benchmark', 'evolve', 'autopilot',
]);

// Best-effort frontmatter parser. The kit's engine markdown files
// universally use YAML frontmatter delimited by --- lines. We pull a
// small set of known fields; anything else stays in the body.
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = text.slice(3, end);
  const out = {};
  for (const lineRaw of block.split('\n')) {
    const line = lineRaw.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = /^([a-z_-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// Walk .claude/commands/*.md and return objects for files that look like
// engine skill files. Filter heuristics:
//   - frontmatter present
//   - name field looks like an engine id (kebab-case, no spaces)
//   - id is NOT in NON_ENGINE_COMMANDS
//   - frontmatter declares `procedure:` OR `extends: context-gather`
//     (the kit's engine-skill markers — both standard and library use them)
function readInstalledEngines(commandsDir) {
  const warnings = [];
  if (!fs.existsSync(commandsDir) || !fs.statSync(commandsDir).isDirectory()) {
    return { engines: [], warnings: [`commandsDir does not exist: ${commandsDir}`] };
  }

  const files = fs.readdirSync(commandsDir).filter(f => COMMAND_FILE_RE.test(f)).sort();
  const engines = [];

  for (const f of files) {
    const filePath = path.join(commandsDir, f);
    let text;
    try { text = fs.readFileSync(filePath, 'utf8'); }
    catch (e) { warnings.push(`read ${f} failed: ${e.message}`); continue; }

    const fm = parseFrontmatter(text);
    if (!fm) continue;
    if (!fm.name || /[\s\/]/.test(fm.name)) continue;

    const id = fm.name;
    if (NON_ENGINE_COMMANDS.has(id)) continue;

    // Engine markers (any of):
    //   - frontmatter declares `procedure:` (suite-check, agent-dispatch, ...)
    //   - frontmatter declares `extends: context-gather`
    //   - frontmatter declares `default_mode:` (ADR-038 contract field — every
    //     engine has this; user-facing commands don't)
    //   - frontmatter declares `user-invocable: false` (all engines have this,
    //     since they're invoked via /engine <name>, not /<name> directly)
    // The combination is permissive on purpose: missing any single field
    // shouldn't drop a legitimate engine from the registry. False positives
    // (a non-engine command with default_mode) are still filtered by the
    // NON_ENGINE_COMMANDS allowlist above.
    const isEngine = fm.procedure
                  || fm.extends === 'context-gather'
                  || fm.default_mode
                  || fm['user-invocable'] === 'false'
                  || /procedure:/i.test(text.slice(0, 600));
    if (!isEngine) continue;

    engines.push({
      id,
      description: fm.description || '',
      procedure: fm.procedure || null,
      extends: fm.extends || null,
      category: inferCategory(fm, id),
      impact: inferImpact(fm, id),
      skill_path: `.claude/commands/${f}`,
    });
  }

  return { engines, warnings };
}

// Heuristic category inference. Categories are: analysis, enhancement,
// preparation, briefing (per the kit template's docstring). Use the
// engine id as the primary signal; fall back to procedure.
function inferCategory(fm, id) {
  if (id.endsWith('-enhance') || id === 'context-curator' || id === 'design-critique' || id === 'corrective-plan') return 'enhancement';
  if (id.endsWith('-prep')) return 'preparation';
  if (id.endsWith('-briefing') || id === 'engine-briefing') return 'briefing';
  if (id === 'goal-progress' || id === 'milestone-briefing') return 'briefing';
  return 'analysis';
}

function inferImpact(fm, id) {
  // Briefing engines don't write; preparation engines stage but don't
  // mutate state directly; everything else may update state.
  if (id.endsWith('-briefing')) return 'informational';
  if (id.endsWith('-prep')) return 'zero-impact';
  if (id === 'preflight') return 'changes-code';
  return 'changes-state';
}

// Combine the scanned engines with any existing manually-curated
// entries in the registry. Manual entries win — the materializer is
// additive, not destructive. Returns { aliasesText, engines (object
// keyed by id) } so writeRegistry can preserve the aliases section
// from the existing file unchanged.
function materializeRegistry(workstreamDir, opts = {}) {
  const enginesDir = path.join(workstreamDir, 'engines');
  const commandsDir = opts.commandsDir
    || path.resolve(workstreamDir, '..', 'commands');
  const registryPath = path.join(enginesDir, REGISTRY_FILENAME);

  const { engines: installed, warnings } = readInstalledEngines(commandsDir);

  // Load existing registry to preserve manual entries + aliases section.
  let existingEngines = {};
  let aliasesText = '';
  if (fs.existsSync(registryPath)) {
    const r = readYAMLFile(registryPath);
    if (r.ok && r.data) {
      if (r.data.engines && typeof r.data.engines === 'object') {
        existingEngines = r.data.engines;
      }
    }
    aliasesText = extractAliasesSection(registryPath);
  }

  // Merge: existing entries win for the id-level metadata (caller may
  // have customized fields), but newly-installed engines that the
  // registry doesn't know about are added with the heuristic defaults.
  const merged = Object.assign({}, existingEngines);
  for (const eng of installed) {
    if (merged[eng.id]) continue; // existing entry preserved
    merged[eng.id] = {
      skill_path: eng.skill_path,
      category: eng.category,
      impact: eng.impact,
      trigger: 'manual',
      inputs: [],
      outputs: ['finding', 'report'],
      chains: {},
      description: eng.description,
    };
    if (eng.procedure) merged[eng.id].procedure = eng.procedure;
    if (eng.extends) merged[eng.id].extends = eng.extends;
  }

  return { aliasesText, engines: merged, warnings, addedFromScan: installed.length };
}

// Returns text from start of file through the blank line preceding
// the `engines:` block. Captures the header comment, the aliases:
// block, and any other top-level content. When the file doesn't
// exist or lacks engines:, returns the empty string.
function extractAliasesSection(registryPath) {
  if (!fs.existsSync(registryPath)) return '';
  const text = fs.readFileSync(registryPath, 'utf8');
  const lines = text.split('\n');
  const out = [];
  for (const line of lines) {
    if (/^engines:\s*$/.test(line)) break;
    out.push(line);
  }
  // Trim trailing blank lines but keep one for separation
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
  return out.join('\n');
}

// Serialize the materialized registry to YAML string. Preserves header/
// aliases text, then emits the engines: map. Returns the string; caller
// is responsible for writing it.
function renderRegistry(materialized) {
  const lines = [];
  if (materialized.aliasesText) {
    lines.push(materialized.aliasesText);
    lines.push('');
  } else {
    lines.push(headerForFreshRegistry());
    lines.push('');
  }
  lines.push('engines:');
  lines.push('');

  const sortedIds = Object.keys(materialized.engines).sort();
  for (const id of sortedIds) {
    const e = materialized.engines[id];
    lines.push(`  ${id}:`);
    if (e.skill_path) lines.push(`    skill_path: ${formatScalar(e.skill_path)}`);
    if (e.procedure)  lines.push(`    procedure: ${formatScalar(e.procedure)}`);
    if (e.extends)    lines.push(`    extends: ${formatScalar(e.extends)}`);
    if (e.category)   lines.push(`    category: ${formatScalar(e.category)}`);
    if (e.impact)     lines.push(`    impact: ${formatScalar(e.impact)}`);
    if (e.trigger)    lines.push(`    trigger: ${formatScalar(e.trigger)}`);
    // Emit inputs/outputs/chains only when they're non-trivial. The
    // cwos-utils YAML parser reads inline empty literals (`[]`, `{}`)
    // back as strings, not arrays/objects — so emitting `inputs: []`
    // would break round-trip idempotency. Skip empty.
    if (Array.isArray(e.inputs) && e.inputs.length > 0) {
      lines.push(`    inputs:`);
      for (const x of e.inputs) lines.push(`      - ${formatScalar(x)}`);
    }
    if (Array.isArray(e.outputs) && e.outputs.length > 0) {
      lines.push(`    outputs:`);
      for (const x of e.outputs) lines.push(`      - ${formatScalar(x)}`);
    }
    if (e.chains && typeof e.chains === 'object' && Object.keys(e.chains).length > 0) {
      lines.push(`    chains:`);
      for (const [k, v] of Object.entries(e.chains)) {
        if (Array.isArray(v)) {
          if (v.length === 0) continue; // skip empty arrays for same reason
          lines.push(`      ${k}:`);
          for (const x of v) lines.push(`        - ${formatScalar(x)}`);
        } else if (v != null) {
          lines.push(`      ${k}: ${formatScalar(v)}`);
        }
      }
    }
    if (e.finding_severities && typeof e.finding_severities === 'object') {
      lines.push(`    finding_severities:`);
      for (const [k, v] of Object.entries(e.finding_severities)) {
        lines.push(`      ${k}: ${formatScalar(v)}`);
      }
    }
    if (e.description) lines.push(`    description: ${formatScalar(e.description)}`);
    lines.push('');
  }

  return lines.join('\n');
}

// Thin wrapper that renders + writes. Kept for callers that don't need
// to compute the content separately.
function writeRegistry(registryPath, materialized) {
  writeFileAtomic(registryPath, renderRegistry(materialized));
}

function headerForFreshRegistry() {
  return [
    '# Engine Registry — maintained by cwos-engines-registry.js',
    '#',
    '# This file is derived from the installed .claude/commands/*.md set.',
    '# Re-materialize via: node kit/scripts/cwos-engines-registry-sync.js',
    '#',
    '# Categories: analysis | enhancement | preparation | briefing',
    '# Impact:     changes-code | changes-state | zero-impact | informational',
  ].join('\n');
}

// One-shot: materialize + write if changed. Returns { written, count }.
function syncRegistry(workstreamDir, opts = {}) {
  const enginesDir = path.join(workstreamDir, 'engines');
  if (!fs.existsSync(enginesDir)) fs.mkdirSync(enginesDir, { recursive: true });
  const registryPath = path.join(enginesDir, REGISTRY_FILENAME);

  const materialized = materializeRegistry(workstreamDir, opts);
  const count = Object.keys(materialized.engines).length;

  // Render to string, then compare to existing on-disk content before
  // writing. Avoids gratuitous mtime churn + lets idempotency tests
  // detect serialization round-trip failures.
  const projected = renderRegistry(materialized);
  let existing = '';
  if (fs.existsSync(registryPath)) existing = fs.readFileSync(registryPath, 'utf8');
  if (projected === existing) {
    return { written: false, count, warnings: materialized.warnings, addedFromScan: materialized.addedFromScan };
  }
  writeFileAtomic(registryPath, projected);
  return { written: true, count, warnings: materialized.warnings, addedFromScan: materialized.addedFromScan };
}

// Detect engines referenced by programs but missing from registry. Wraps
// the existing validateProgramProtocolEngineRefs spirit into a pure
// function callable from /audit. Returns array of { program_id, engine, protocol }.
function detectMissing(workstreamDir) {
  const enginesDir = path.join(workstreamDir, 'engines');
  const programsDir = path.join(workstreamDir, 'programs');
  const registryPath = path.join(enginesDir, REGISTRY_FILENAME);

  const registered = new Set();
  if (fs.existsSync(registryPath)) {
    const r = readYAMLFile(registryPath);
    if (r.ok && r.data && r.data.engines && typeof r.data.engines === 'object') {
      for (const k of Object.keys(r.data.engines)) registered.add(k);
    }
  }

  const missing = [];
  if (!fs.existsSync(programsDir)) return missing;

  for (const f of fs.readdirSync(programsDir)) {
    if (!/^prog-.+\.yaml$/.test(f) || f === 'prog-template.yaml') continue;
    const r = readYAMLFile(path.join(programsDir, f));
    if (!r.ok || !r.data) continue;
    const programId = r.data.id || f.replace(/^prog-/, '').replace(/\.yaml$/, '');
    const protocols = r.data.protocols || {};
    for (const [protoName, proto] of Object.entries(protocols)) {
      const engineRef = proto && proto.engine ? String(proto.engine) : null;
      if (!engineRef) continue;
      if (!registered.has(engineRef)) {
        missing.push({ program_id: programId, protocol: protoName, engine: engineRef });
      }
    }
  }
  return missing;
}

module.exports = {
  REGISTRY_FILENAME,
  NON_ENGINE_COMMANDS,
  parseFrontmatter,
  readInstalledEngines,
  materializeRegistry,
  renderRegistry,
  writeRegistry,
  syncRegistry,
  detectMissing,
  extractAliasesSection,
  inferCategory,
  inferImpact,
};
