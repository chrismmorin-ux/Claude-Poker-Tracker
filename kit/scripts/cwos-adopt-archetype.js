#!/usr/bin/env node
/**
 * cwos-adopt-archetype.js — archetype + stage bundle resolver for /adopt.
 *
 * Per ADR-035 (Tier-1 causal kit branching on identity + stage), this script
 * resolves which programs/engines/personas should install for a declared
 * (archetype, stage) pair, applying founder per-consequence overrides from
 * .cwos-onboarding.yaml#archetype_overrides.
 *
 * Invoked by fleet/commands/adopt.md between Step 4 (capture archetype/stage)
 * and Step 5 (install kit). The output is consumed by cwos-adopt-install.js
 * as a filter on which programs to copy.
 *
 * Subcommands:
 *   resolve  — emit JSON bundle to stdout
 *   apply    — write bundle into target .cwos-onboarding.yaml
 *
 * Usage:
 *   node kit/scripts/cwos-adopt-archetype.js resolve \
 *     --archetype A1 --stage S2 [--overrides-file <path>]
 *
 *   node kit/scripts/cwos-adopt-archetype.js apply \
 *     --archetype A1 --stage S2 --target-dir <path-to-repo>
 *
 * Pure-data resolver — no kit/templates/archetype-bundles/ subdirs needed.
 * Source of truth: kit/data/archetypes.yaml + kit/data/stages.yaml.
 */

const fs = require('fs');
const path = require('path');
const { readYAMLFile, writeFileAtomic } = require('./lib/cwos-utils.js');
const tm = require('./lib/tier-mapper.js');

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i < 0 || i === args.length - 1) return null;
  return args[i + 1];
}

function hasFlag(args, name) {
  return args.indexOf(`--${name}`) >= 0;
}

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function dieWith(code, msg) {
  process.stderr.write(`cwos-adopt-archetype: ${msg}\n`);
  process.exit(code);
}

function loadOverridesFromFile(p) {
  if (!p) return { programs: [], tiers: [] };
  if (!fs.existsSync(p)) dieWith(2, `overrides-file not found: ${p}`);
  const r = readYAMLFile(p);
  if (!r.ok) dieWith(2, `overrides-file parse failed: ${r.error}`);
  const data = r.data || {};
  // Two acceptable shapes: the file IS an archetype_overrides block, OR it
  // contains a top-level archetype_overrides key (e.g., the full onboarding file).
  const ao = data.archetype_overrides || data;
  return {
    programs: Array.isArray(ao.programs) ? ao.programs : [],
    tiers: Array.isArray(ao.tiers) ? ao.tiers : [],
  };
}

/**
 * resolveBundle(archetypeId, stageId, overrides)
 *
 * Returns:
 *   {
 *     archetype, stage,
 *     programs: [],
 *     engines: [],
 *     personas: [],
 *     tiers: { progId: tier },
 *     resolved_at: ISOString
 *   }
 *
 * Composition order:
 *   1. Walk axes (output, sensitivity, verification) → collect axis-derived
 *      programs/engines/personas from kit/data/archetypes.yaml#axes.
 *   2. Add archetype's label_extras (programs/engines/personas).
 *   3. Always include eng-engine (universal default, per default_no_archetype).
 *   4. Dedupe each list.
 *   5. Apply applyProgramOptOuts(programs, overrides).
 *   6. Compute tier map via mapTiers(archetype, stage, overrides, programs).
 */
function resolveBundle(archetypeId, stageId, overrides) {
  overrides = overrides || { programs: [], tiers: [] };

  if (archetypeId === 'NONE' || archetypeId === 'default_no_archetype') {
    const data = tm._internal.loadArchetypes();
    const dna = data.default_no_archetype || {};
    const programs = applyProgramOptOuts(Array.isArray(dna.programs) ? dna.programs : [], overrides);
    const tiers = stageId ? tm.mapTiers('NONE', stageId, overrides, programs) : {};
    return {
      archetype: 'NONE',
      stage: stageId || null,
      programs,
      engines: dedupe(Array.isArray(dna.engines) ? dna.engines : ['eng-engine']),
      personas: dedupe(Array.isArray(dna.personas) ? dna.personas : []),
      tiers,
      resolved_at: new Date().toISOString(),
    };
  }

  const archetype = tm.findArchetype(archetypeId);
  const data = tm._internal.loadArchetypes();
  const axes = data.axes || {};
  const coords = archetype.axis_coordinates || {};

  const programs = [];
  const engines = ['eng-engine']; // universal default
  const personas = [];

  for (const axisName of ['output', 'sensitivity', 'verification']) {
    const axisValue = coords[axisName];
    if (!axisValue) continue;
    const axisDef = (axes[axisName] || {})[axisValue] || {};
    pushAll(programs, axisDef.programs);
    pushAll(engines, axisDef.engines);
    pushAll(personas, axisDef.personas);
  }

  // Label extras layer on top.
  const extras = archetype.label_extras || {};
  pushAll(programs, extras.programs);
  pushAll(engines, extras.engines);
  pushAll(personas, extras.personas);

  const dedupedPrograms = dedupe(programs);
  const filteredPrograms = applyProgramOptOuts(dedupedPrograms, overrides);
  const tiers = stageId ? tm.mapTiers(archetypeId, stageId, overrides, filteredPrograms) : {};

  return {
    archetype: archetypeId,
    stage: stageId || null,
    programs: filteredPrograms,
    engines: dedupe(engines),
    personas: dedupe(personas),
    tiers,
    resolved_at: new Date().toISOString(),
  };
}

function applyProgramOptOuts(programIds, overrides) {
  return tm.applyProgramOptOuts(programIds, overrides);
}

function dedupe(arr) {
  if (!Array.isArray(arr)) return [];
  return Array.from(new Set(arr.filter((x) => x != null && x !== '')));
}

function pushAll(target, source) {
  if (!Array.isArray(source)) return;
  for (const x of source) target.push(x);
}

// ─── subcommands ──────────────────────────────────────────────────────────

function cmdResolve(args) {
  const archetype = readFlag(args, 'archetype');
  const stage = readFlag(args, 'stage');
  const overridesFile = readFlag(args, 'overrides-file');
  if (!archetype) dieWith(2, 'resolve: --archetype <A1..A5|NONE> required');
  // stage is optional — resolver returns programs without tier map if absent.

  const overrides = loadOverridesFromFile(overridesFile);
  let bundle;
  try {
    bundle = resolveBundle(archetype, stage, overrides);
  } catch (e) {
    dieWith(2, `resolve failed: ${e.message}`);
  }
  writeJson(bundle);
}

function cmdApply(args) {
  const archetype = readFlag(args, 'archetype');
  const stage = readFlag(args, 'stage');
  const targetDir = readFlag(args, 'target-dir');
  const overridesFile = readFlag(args, 'overrides-file');
  if (!archetype) dieWith(2, 'apply: --archetype <A1..A5|NONE> required');
  if (!targetDir) dieWith(2, 'apply: --target-dir <path-to-repo> required');

  const onboardingPath = path.join(targetDir, '.cwos-onboarding.yaml');
  if (!fs.existsSync(onboardingPath)) dieWith(2, `apply: ${onboardingPath} does not exist`);

  // Load existing onboarding to read any archetype_overrides already there.
  const existing = readYAMLFile(onboardingPath);
  if (!existing.ok) dieWith(2, `apply: cannot parse ${onboardingPath}: ${existing.error}`);
  const data = existing.data || {};

  const overridesFromFile = overridesFile ? loadOverridesFromFile(overridesFile) : null;
  const overridesFromOnboarding = data.archetype_overrides || { programs: [], tiers: [] };
  const overrides = overridesFromFile || overridesFromOnboarding;

  let bundle;
  try {
    bundle = resolveBundle(archetype, stage, overrides);
  } catch (e) {
    dieWith(2, `apply failed: ${e.message}`);
  }

  // Write the bundle back into the onboarding file via an in-place patch
  // that preserves comments + unrelated fields. Pragmatic approach: read raw
  // text, replace the archetype/stage/archetype_bundle_resolved blocks.
  const raw = fs.readFileSync(onboardingPath, 'utf8');
  const patched = patchOnboarding(raw, archetype, stage, bundle);
  writeFileAtomic(onboardingPath, patched);

  writeJson({ ok: true, target: onboardingPath, bundle });
}

/**
 * patchOnboarding(raw, archetype, stage, bundle)
 *
 * Surgical text patch that updates four field blocks:
 *   - archetype: ...
 *   - declared_archetype: ...
 *   - stage: ...
 *   - declared_stage: ...
 *   - archetype_bundle_resolved: { programs, engines, personas, tiers, resolved_at }
 *
 * Preserves comments and unrelated fields. Assumes the schema-v3 template
 * shape ships these field names verbatim (cwos-adopt-install.js Phase 3.5
 * is responsible for ensuring this; absent fields are appended).
 */
function patchOnboarding(raw, archetype, stage, bundle) {
  let out = raw;

  out = patchScalarField(out, 'archetype', quoteScalar(archetype));
  out = patchScalarField(out, 'declared_archetype', quoteScalar(archetype));
  if (stage) {
    out = patchScalarField(out, 'stage', quoteScalar(stage));
    out = patchScalarField(out, 'declared_stage', quoteScalar(stage));
  }

  // Replace the archetype_bundle_resolved block.
  const blockHeader = /^archetype_bundle_resolved:\s*$/m;
  const blockEnd = /^(?=[^\s#]|#\s)/m; // next top-level key or comment header
  const idx = out.search(blockHeader);
  if (idx >= 0) {
    const after = out.slice(idx + out.slice(idx).match(blockHeader)[0].length);
    // Find end of block: next top-level key (line starting with non-space, non-#)
    const nextKeyMatch = after.match(/\n(?=[A-Za-z_][A-Za-z0-9_]*:)/);
    const blockBodyEnd = nextKeyMatch ? nextKeyMatch.index + 1 : after.length;
    const before = out.slice(0, idx);
    const remainder = after.slice(blockBodyEnd);
    out = before + renderBundleBlock(bundle) + remainder;
  } else {
    // Append at end if missing.
    if (!out.endsWith('\n')) out += '\n';
    out += '\n' + renderBundleBlock(bundle);
  }

  return out;
}

function quoteScalar(v) {
  if (v == null) return 'null';
  return `"${String(v)}"`;
}

function patchScalarField(text, field, value) {
  // Match: field: <value>[<spaces>#<comment>]
  // Group 1: "field: " (key + colon + leading spaces)
  // Group 2: value (lazy — does not consume trailing spaces)
  // Group 3: trailing spaces + optional inline comment, preserved verbatim
  const re = new RegExp(`^(${escapeRegex(field)}:[ \\t]*)([^\\n#]*?)([ \\t]*(?:#[^\\n]*)?)$`, 'm');
  if (re.test(text)) return text.replace(re, `$1${value}$3`);
  return text; // field absent — patch is a no-op (template should ship field)
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderBundleBlock(bundle) {
  const lines = [];
  lines.push('archetype_bundle_resolved:');
  lines.push(`  programs: ${formatInlineArray(bundle.programs)}`);
  lines.push(`  engines: ${formatInlineArray(bundle.engines)}`);
  lines.push(`  personas: ${formatInlineArray(bundle.personas)}`);
  lines.push('  tiers:');
  const progIds = Object.keys(bundle.tiers || {}).sort();
  if (progIds.length === 0) {
    // Inline empty mapping
    lines[lines.length - 1] = '  tiers: {}';
  } else {
    for (const id of progIds) {
      lines.push(`    ${id}: ${quoteScalar(bundle.tiers[id])}`);
    }
  }
  lines.push(`  resolved_at: ${quoteScalar(bundle.resolved_at)}`);
  lines.push('');
  return lines.join('\n');
}

function formatInlineArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '[]';
  return '[' + arr.map((x) => quoteScalar(x)).join(', ') + ']';
}

// ─── entry ────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  const rest = args.slice(1);
  switch (sub) {
    case 'resolve': return cmdResolve(rest);
    case 'apply':   return cmdApply(rest);
    case '--help':
    case '-h':
    case undefined:
      process.stderr.write(
        'usage: cwos-adopt-archetype <resolve|apply> [options]\n' +
        '  resolve --archetype A1..A5|NONE [--stage S1..S5|N1..N3] [--overrides-file <path>]\n' +
        '  apply   --archetype A1..A5|NONE --stage S1..S5|N1..N3 --target-dir <path> [--overrides-file <path>]\n'
      );
      process.exit(sub === undefined ? 2 : 0);
      return;
    default:
      dieWith(2, `unknown subcommand: ${sub}`);
  }
}

if (require.main === module) main();

module.exports = { resolveBundle, patchOnboarding };
