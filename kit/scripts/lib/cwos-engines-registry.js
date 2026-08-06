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
  if (id.endsWith('-enhance') || id === 'context-curator' || id === 'design-critique') return 'enhancement';
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
//
// WS-558: "existing entries win" used to be unconditional, which made a wrong
// skill_path permanent and a phantom entry immortal. Both are the same missing
// question — does this entry point at a real file? — so it is asked here, once,
// and each existing entry resolves to keep / repair / prune. See
// reconcileExistingEntry below for what each outcome means and why.
function materializeRegistry(workstreamDir, opts = {}) {
  const enginesDir = path.join(workstreamDir, 'engines');
  const commandsDir = opts.commandsDir
    || path.resolve(workstreamDir, '..', 'commands');
  // Registry skill_paths are repo-relative, so resolving one needs the repo
  // root: .claude/workstream -> .claude -> repo. Same relationship
  // lib/cwos-registry-paths.js assumes when the upgrade gate checks these.
  const repoRoot = opts.repoRoot || path.resolve(workstreamDir, '..', '..');
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

  const scanned = new Map(installed.map(e => [e.id, e]));
  const merged = {};
  const repaired = [];
  const pruned = [];

  for (const [id, entry] of Object.entries(existingEngines)) {
    const verdict = reconcileExistingEntry(repoRoot, id, entry, scanned.get(id));
    if (verdict.action === 'prune') {
      pruned.push({ id, path: verdict.deadPath });
      warnings.push(
        `pruned engine "${id}" — skill_path ${verdict.deadPath} resolves to nothing and no ` +
        `engine file exists at .claude/commands/${id}.md either. A registry entry is a promise ` +
        `that /engine ${id} works; it will be re-added when the engine is installed.`
      );
      continue;
    }
    if (verdict.action === 'repair') {
      repaired.push({ id, from: verdict.deadPath, to: verdict.entry.skill_path });
      warnings.push(
        `repaired engine "${id}" — skill_path ${verdict.deadPath} -> ${verdict.entry.skill_path}`
      );
    }
    merged[id] = verdict.entry;
  }

  // Newly-installed engines the registry doesn't know about, with heuristic
  // defaults. Unchanged behaviour.
  for (const eng of installed) {
    if (merged[eng.id]) continue;
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

  return {
    aliasesText, engines: merged, warnings,
    addedFromScan: installed.length, repaired, pruned,
  };
}

/**
 * Decide what to do with one entry already in the registry.
 *
 *   keep    — its skill_path resolves. Left byte-identical, whatever the path
 *             looks like. This is what protects a founder's custom engine and
 *             HomeBase's own registry, whose entries legitimately point into
 *             engines/ rather than .claude/commands/.
 *
 *   repair  — the path is dead but the engine IS installed, so the entry is
 *             right about the engine and wrong about where it lives. Rewrite
 *             skill_path only; every other field is the founder's.
 *
 *             This is WS-558's actual defect. kit/templates/workstream/engines/
 *             registry.yaml shipped 8 entries reading engines/standard/<id>.md,
 *             which is HomeBase's SOURCE layout — adopted repos install engines
 *             to .claude/commands/<id>.md. Authored in HomeBase, where those
 *             paths resolve, and never checked against the destinations the
 *             MANIFEST actually declares. ai-content-ecosystem's 3.8.2 upgrade
 *             overwrote its registry with that template, produced 8 dead paths
 *             at once, and the upgrade gate rolled the whole thing back.
 *
 *   prune   — dead path, no installed engine. The entry claims /engine <id>
 *             works when it cannot. Dropping it is what lets the path-resolution
 *             gate stay strict, which is the only reason it caught this.
 */
function reconcileExistingEntry(repoRoot, id, entry, scannedEngine) {
  if (!entry || typeof entry !== 'object') return { action: 'keep', entry };

  const declared = typeof entry.skill_path === 'string' ? entry.skill_path.trim() : '';
  // An entry with no skill_path at all is not a path claim — leave it be.
  if (!declared) return { action: 'keep', entry };

  let resolves = false;
  try { resolves = fs.statSync(path.join(repoRoot, declared)).isFile(); } catch { resolves = false; }
  if (resolves) return { action: 'keep', entry };

  // Where the engine would live if it is installed. Prefer the scan, which is
  // authoritative about the filename (an engine's id comes from frontmatter
  // `name` and need not match its file). Fall back to the conventional path.
  //
  // The fallback is not belt-and-braces, it is the difference between a repair
  // and a wrong delete. readInstalledEngines only counts a file as an engine if
  // its frontmatter carries one of the marker fields, and older shipped engines
  // carry none: ai-content-ecosystem's persona-validator.md, sitting right there
  // at .claude/commands/, declares only name/description/model/tools. Pruning on
  // "the scan didn't recognize it" would delete a live engine's entry over a
  // frontmatter convention it predates. Existence on disk is the honest test,
  // and it is the same test the upgrade gate applies.
  const conventional = `.claude/commands/${id}.md`;
  let target = scannedEngine ? scannedEngine.skill_path : null;
  if (!target) {
    let onDisk = false;
    try { onDisk = fs.statSync(path.join(repoRoot, conventional)).isFile(); } catch { onDisk = false; }
    if (onDisk) target = conventional;
  }

  if (target) {
    return {
      action: 'repair',
      deadPath: declared,
      entry: Object.assign({}, entry, { skill_path: target }),
    };
  }
  return { action: 'prune', deadPath: declared };
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
  const outcome = {
    count,
    warnings: materialized.warnings,
    addedFromScan: materialized.addedFromScan,
    repaired: materialized.repaired || [],
    pruned: materialized.pruned || [],
  };
  if (projected === existing) return Object.assign({ written: false }, outcome);
  writeFileAtomic(registryPath, projected);
  return Object.assign({ written: true }, outcome);
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
  reconcileExistingEntry,
  renderRegistry,
  writeRegistry,
  syncRegistry,
  detectMissing,
  extractAliasesSection,
  inferCategory,
  inferImpact,
};
