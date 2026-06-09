#!/usr/bin/env node
/**
 * cwos-adopt-install.js — Deterministic file-copy phase of /adopt.
 *
 * Replaces manual steps 5a-5m with a single script invocation.
 * Reads kit/MANIFEST.yaml, filters by enabled capabilities, copies files,
 * instantiates YAML templates, writes version stamp.
 *
 * Zero external dependencies. Uses cwos-utils.js, cwos-orchestrate.js,
 * and lib/capability-map.js.
 *
 * Usage:
 *   node cwos-adopt-install.js \
 *     --target <path>  --archetype <type>  --homebase <path> \
 *     [--capabilities core,workstream,...]  [--level L1-L5]  \
 *     [--kit-version <ver>]  [--dry-run]
 *
 *   --capabilities (preferred) — comma-separated list of capabilities to
 *     install. Drives MANIFEST filtering directly.
 *   --level (shim, ADR-016) — L1-L5 translated to the cumulative
 *     capability set via kit/scripts/lib/capability-map.js. Will be
 *     removed in kit-v5. If both flags are present, --capabilities wins.
 */

'use strict';

// Pre-flight: ensure Node.js version is adequate (>=14 for fs.mkdirSync recursive, optional chaining)
const [major] = process.versions.node.split('.').map(Number);
if (major < 14) {
  process.stderr.write(
    `Error: Node.js v14+ is required (found v${process.versions.node}).\n` +
    `Install or update Node.js: https://nodejs.org/\n`
  );
  process.exit(1);
}

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  readYAMLFile, writeFileAtomic, patchYAMLFile,
  serializeYAML, formatScalar, formatInlineArray, globFiles,
  boundedSystemDir, boundedPathInRepo, SafeWriteError,
} = require('./lib/cwos-utils');

const { emitBundle, bundleError } = require('./lib/cwos-orchestrate');

// 21 mutation sites across copy / template / scope-patch / manifest / legacy
// / milestone / version-stamp phases. Emit coarse phase events at major
// function boundaries rather than per-mutation — adoption runs rarely and
// per-file events would flood with cosmetic noise.
const { makeEventEmitter } = require('./lib/cwos-utils');
const emitEvent = makeEventEmitter();

const {
  CAPABILITY_ORDER,
  capabilitiesForLevel,
  levelForCapabilities,
  parseCapabilitiesArg,
} = require('./lib/capability-map');

const { corpusHash } = require('./lib/cwos-corpus-hash');

// ─── Constants ─────────────────────────────────────────────────────────────

const LEVEL_NUM = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
const VALID_ARCHETYPES = [
  'saas', 'frontend', 'data-platform', 'dev-tool', 'research', 'api-service',
  // Research sub-archetypes. /adopt Step 3 picks one of these instead of the
  // bare 'research' archetype when claim-domain detection surfaces a specific
  // research subtype. Bare 'research' remains valid for repos where the type
  // is unclear or doesn't fit the subtypes.
  'research-clinical', 'research-mathematical', 'research-empirical',
];

const CEREMONY_MAP = {
  saas: 'standard', 'data-platform': 'standard', frontend: 'standard',
  'api-service': 'standard', 'dev-tool': 'minimal', research: 'minimal',
  // Sub-archetypes inherit research's minimal ceremony. Clinical may bump to
  // standard in a future iteration if reviewer-cadence ceremony is warranted.
  'research-clinical': 'minimal',
  'research-mathematical': 'minimal',
  'research-empirical': 'minimal',
};

// Archetype-based file-pattern defaults for program scopes live in the shared
// module so cwos-scope-check.js (drift detection) uses the same source of truth.
const { ARCHETYPE_PATTERNS, PROGRAM_PATTERN_OVERRIDES } = require('./lib/archetype-patterns.js');

// Each canonical lists paths in priority order. Migration walks the list:
// the first one that exists becomes the source; subsequent matches get appended
// under a "Migrated from <path>" heading. New paths land at the END of each
// list so existing-repo behavior is unchanged — only repos with CPT-class
// pre-CWOS structure (governance under .claude/context/, .claude/STATUS.md)
// pick up the new migrations.
const LEGACY_MAP = [
  { canonical: 'invariants.md',
    legacy: ['docs/INVARIANTS.md', 'INVARIANTS.md', '.claude/invariants.md',
             '.claude/context/INVARIANTS.md'] },
  { canonical: 'constraints.md',
    legacy: ['docs/CONSTRAINTS.md', 'CONSTRAINTS.md', '.claude/constraints.md'] },
  { canonical: 'decisions.md',
    legacy: ['docs/decisions.md'] },
  { canonical: 'failures.md',
    legacy: ['docs/failures.md', 'FAILURES.md', '.claude/failures.md'] },
  { canonical: 'state.md',
    legacy: ['SYSTEM_MODEL.md', 'STATUS.md', '.claude/state.md',
             '.claude/STATUS.md', '.claude/context/SYSTEM_MODEL.md'] },
];

const PREAMBLE_START = '<!-- CWOS Preamble Start -->';
const PREAMBLE_END = '<!-- CWOS Preamble End -->';

// ─── Helpers ───────────────────────────────────────────────────────────────

function toForwardSlash(p) { return p.replace(/\\/g, '/'); }

function sha256(content) {
  return 'sha256:' + crypto.createHash('sha256').update(content).digest('hex');
}

function levelAllowed(fileLevel, requestedLevel) {
  return (LEVEL_NUM[fileLevel] || 99) <= (LEVEL_NUM[requestedLevel] || 0);
}

// ADR-016: gate a manifest entry by the repo's enabled-capability set.
// Prefers entry.capability (new field) and falls back to entry.level for
// entries that somehow lack the capability annotation (kit-v4 shim).
function entryAllowed(entry, enabledCapabilities) {
  if (entry.capability) return enabledCapabilities.has(entry.capability);
  if (entry.level) {
    const cap = CAPABILITY_ORDER[(LEVEL_NUM[entry.level] || 99) - 1];
    return cap ? enabledCapabilities.has(cap) : false;
  }
  return false;
}

function resolveSystemDir(target) {
  const configPath = path.join(target, '.cwos-config.yaml');
  if (fs.existsSync(configPath)) {
    const { ok, data } = readYAMLFile(configPath);
    if (ok && data.paths && data.paths.system_dir) {
      return boundedSystemDir(data.paths.system_dir);
    }
  }
  return 'system';
}

function resolveDestination(dest, systemDir) {
  return dest.replace(/\{system_dir\}/g, systemDir);
}

function safeCopy(src, dest, errors) {
  try {
    const content = fs.readFileSync(src, 'utf8');
    writeFileAtomic(dest, content);
    return content;
  } catch (err) {
    errors.push(`copy failed: ${toForwardSlash(src)} → ${toForwardSlash(dest)}: ${err.message}`);
    return null;
  }
}

// ─── Phase 0: Parse CLI ────────────────────────────────────────────────────

function parseCLI() {
  const args = process.argv.slice(2);
  const config = {
    target: null, level: null, capabilitiesArg: null,
    archetype: null, homebase: null, kitVersion: null, dryRun: false,
    archetypeBundle: null, archetypeBundlePath: null,
    repair: false, force: false, noFleetRegister: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--target' && args[i + 1])              { config.target = path.resolve(args[++i]); }
    else if (arg === '--level' && args[i + 1])           { config.level = args[++i].toUpperCase(); }
    else if (arg === '--capabilities' && args[i + 1])    { config.capabilitiesArg = args[++i]; }
    else if (arg === '--archetype' && args[i + 1])       { config.archetype = args[++i].toLowerCase(); }
    else if (arg === '--archetype-bundle' && args[i + 1]) { config.archetypeBundlePath = path.resolve(args[++i]); }
    else if (arg === '--homebase' && args[i + 1])        { config.homebase = path.resolve(args[++i]); }
    else if (arg === '--kit-version' && args[i + 1])     { config.kitVersion = args[++i]; }
    else if (arg === '--dry-run')                         { config.dryRun = true; }
    else if (arg === '--repair')                          { config.repair = true; }
    else if (arg === '--force')                           { config.force = true; }
    else if (arg === '--no-fleet-register')               { config.noFleetRegister = true; }
  }

  // Load archetype-bundle JSON if provided. WS-250: when present, install
  // filters program entries by bundle.programs[] (additive to capability filter).
  // Legacy callers (no flag) keep the capability-only behavior.
  if (config.archetypeBundlePath) {
    if (!fs.existsSync(config.archetypeBundlePath)) {
      bundleError(`--archetype-bundle path does not exist: ${config.archetypeBundlePath}`);
    }
    try {
      config.archetypeBundle = JSON.parse(fs.readFileSync(config.archetypeBundlePath, 'utf8'));
    } catch (err) {
      bundleError(`--archetype-bundle parse failed: ${err.message}`);
    }
    // WS-383: full schema + INV-049 validation runs below, after config.homebase
    // is resolved (the homebase-only engine set is sourced from kit/MANIFEST.yaml).
  }

  // Validate required args
  if (!config.target) bundleError('--target is required');
  if (!fs.existsSync(config.target) || !fs.statSync(config.target).isDirectory()) {
    bundleError(`--target path does not exist or is not a directory: ${config.target}`);
  }

  // WS-384: --repair heals an existing install; it cannot bootstrap one. The
  // .cwos-version stamp is the source of the install fingerprint (installed_files
  // hash map) that repair classification depends on — without it there is no
  // baseline to diff against, so fail closed.
  if (config.repair && !fs.existsSync(path.join(config.target, '.cwos-version'))) {
    bundleError('--repair needs an existing install (.cwos-version not found) — run /adopt first');
  }
  // --force only means something with --repair (overwrite founder-customized files).
  if (config.force && !config.repair) {
    bundleError('--force is only valid together with --repair');
  }

  // Resolve enabled capabilities. --capabilities is canonical (ADR-016);
  // --level is a legacy flag that translates into capabilities for callers
  // that haven't migrated yet. Default (neither flag) preserves pre-ADR-016
  // L3 behavior so existing automation keeps working; this default retires
  // with the --level shim.
  if (config.capabilitiesArg) {
    try {
      config.enabledCapabilities = parseCapabilitiesArg(config.capabilitiesArg);
    } catch (err) {
      bundleError(err.message);
    }
    if (config.enabledCapabilities.size === 0) {
      bundleError('--capabilities cannot be empty');
    }
    // WS-378: do NOT derive config.level from capabilities. Level is a legacy
    // descriptor; when the caller passed --capabilities they've already moved
    // off the level axis (ADR-016). Downstream template-patch sites that
    // reference config.level will see undefined and skip emitting the field
    // (they branch on truthiness — see kit/templates/cwos-onboarding.yaml
    // adoption_level field, retained as null pending separate retirement).
  } else {
    if (!config.level) config.level = 'L3';
    if (!LEVEL_NUM[config.level]) bundleError(`--level must be L1-L5, got: ${config.level}`);
    config.enabledCapabilities = capabilitiesForLevel(config.level);
  }

  if (!config.archetype) bundleError('--archetype is required');
  if (!VALID_ARCHETYPES.includes(config.archetype)) {
    bundleError(`--archetype must be one of: ${VALID_ARCHETYPES.join(', ')}`);
  }

  // Resolve homebase
  if (!config.homebase) {
    // Walk up from cwd looking for kit/MANIFEST.yaml
    let dir = process.cwd();
    for (let d = 0; d < 10; d++) {
      if (fs.existsSync(path.join(dir, 'kit', 'MANIFEST.yaml'))) { config.homebase = dir; break; }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    if (!config.homebase) bundleError('Could not find HomeBase (no kit/MANIFEST.yaml). Use --homebase.');
  }

  // WS-383: validate the archetype bundle against the schema + INV-049 before
  // any install action (fail-closed). Requires config.homebase — the
  // homebase-only engine set is enumerated from kit/MANIFEST.yaml. A bundle
  // that is malformed, carries a traversal-shaped program ID, or references a
  // homebase-only engine is rejected here so HomeBase-internal apparatus can
  // never leak into an adopted repo via the bundle path (constitutional P1).
  if (config.archetypeBundle) {
    const { validateArchetypeBundle, loadHomebaseOnlyEngines } = require('./lib/cwos-bundle-validate');
    const homebaseOnlyEngines = loadHomebaseOnlyEngines(config.homebase);
    const { ok, errors } = validateArchetypeBundle(config.archetypeBundle, { homebaseOnlyEngines });
    if (!ok) {
      bundleError(`--archetype-bundle failed validation:\n  - ${errors.join('\n  - ')}`);
    }
  }

  // Read kit version
  if (!config.kitVersion) {
    const versionPath = path.join(config.homebase, 'kit', 'VERSION');
    if (fs.existsSync(versionPath)) {
      config.kitVersion = fs.readFileSync(versionPath, 'utf8').trim();
    } else {
      config.kitVersion = 'unknown';
    }
  }

  try {
    config.systemDir = resolveSystemDir(config.target);
  } catch (err) {
    if (err instanceof SafeWriteError && err.code === 'SYSTEM_DIR_INVALID') {
      process.stderr.write(
        `Refusing to adopt: .cwos-config.yaml paths.system_dir rejected — ${err.message}\n` +
        `Fix the value (single segment, no '..', '/', '\\', or absolute paths) and re-run.\n`,
      );
      process.exit(2);
    }
    throw err;
  }
  config.timestamp = new Date().toISOString();
  config.repoName = path.basename(config.target);
  config.platform = process.platform;

  return config;
}

// ─── Phase 1: Load Manifest ────────────────────────────────────────────────

function loadManifest(homebase) {
  const manifestPath = path.join(homebase, 'kit', 'MANIFEST.yaml');
  const { ok, data, error } = readYAMLFile(manifestPath);
  if (!ok) bundleError(`Cannot read kit/MANIFEST.yaml: ${error}`);
  const files = data.files;
  if (!Array.isArray(files)) bundleError('kit/MANIFEST.yaml has no files array');
  return files;
}

// kit-v3.6.0: scripts moved from .cwos/scripts/ → kit/scripts/. Adopted repos
// installed on kit-v3.5.x or earlier have the old path; clear it so the regular
// copy phases land cleanly at the new location. .cwos/scripts/ only ever held
// pre-v3.6 shipped scripts (no user state) — deletion is non-destructive.
function migrateLegacyScriptsPath(config, state) {
  const oldDir = path.join(config.target, '.cwos', 'scripts');
  if (!fs.existsSync(oldDir)) return;

  let fileCount = 0;
  function countFiles(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) countFiles(full);
      else fileCount += 1;
    }
  }
  try { countFiles(oldDir); } catch { /* directory disappeared mid-scan */ }

  if (!config.dryRun) {
    try { fs.rmSync(oldDir, { recursive: true, force: true }); }
    catch (err) {
      state.warnings.push(`legacy .cwos/scripts/ removal failed: ${err.message} — manual cleanup required`);
      return;
    }
    // Best-effort cleanup of the now-likely-empty .cwos/ parent.
    const cwosDir = path.join(config.target, '.cwos');
    try {
      if (fs.existsSync(cwosDir) && fs.readdirSync(cwosDir).length === 0) {
        fs.rmdirSync(cwosDir);
      }
    } catch { /* parent still has siblings — leave it */ }
  }

  state.migrations.push({
    from: '.cwos/scripts/',
    to: 'kit/scripts/',
    reason: 'kit-v3.6.0: scripts moved from .cwos/scripts/ to kit/scripts/',
    files_removed: fileCount,
  });
}

// ─── Phase 2: Filter by Capability ─────────────────────────────────────────

function filterByCapabilities(entries, enabledCapabilities, archetypeBundle) {
  let allowed = entries.filter(e =>
    entryAllowed(e, enabledCapabilities) && !e.homebase_only
  );
  if (archetypeBundle && Array.isArray(archetypeBundle.programs)) {
    // WS-250: when an archetype bundle is provided, drop program template
    // entries (kit/templates/workstream/programs/prog-*.yaml) whose ID is not
    // in the resolved program set. Non-program entries pass through unchanged.
    const allowedProgIds = new Set(archetypeBundle.programs);
    allowed = allowed.filter(e => {
      const dest = e.destination || '';
      const m = dest.match(/programs[\\/](prog-[A-Za-z0-9_-]+)\.ya?ml$/);
      if (!m) return true; // not a program template — pass
      return allowedProgIds.has(m[1]);
    });
  }
  return {
    m1Files: allowed.filter(e => e.install_phase === 'm1'),
    deferredFiles: allowed.filter(e => e.install_phase === 'deferred'),
  };
}

// ─── Phase 3: Install M1 Files ────────────────────────────────────────────

// Subdirectories of .claude/workstream/ that engines, scripts, and the
// findings → work-item pipeline depend on existing. Until kit-v3.6.1 the
// installer relied on incidental file-copy to create these via parent-dir
// mkdir, which left findings/, runs/, evidence/, etc. absent in real
// adoptions (no file in MANIFEST.yaml landed inside them). When the
// constitutional-audit script or reconcile tried to write FIND-NNN.yaml
// the call ENOENT'd silently. INV-052 asserts every adopted repo with
// the workstream capability has the full set.
// Procedural dir sets now live in lib/cwos-kit-dirs.js so the upgrade path
// (cwos-migrate.js) can backfill the identical sets — single source of truth,
// no divergence between adopt-time and upgrade-time provisioning (WS-403).
const { WORKSTREAM_SUBDIRS, DOCS_EVOLUTION_SUBDIRS } = require('./lib/cwos-kit-dirs');

function ensureDirectories(target, systemDir, enabledCapabilities, dryRun, state) {
  const dirs = [
    path.join(target, '.claude', 'commands'),
    path.join(target, '.claude', 'rules'),
    boundedPathInRepo(target, systemDir),
  ];

  // Workstream dir + its full subdir set only when workstream is enabled.
  if (enabledCapabilities.has('workstream')) {
    const wsRoot = path.join(target, '.claude', 'workstream');
    dirs.push(wsRoot);
    for (const sub of WORKSTREAM_SUBDIRS) {
      dirs.push(path.join(wsRoot, ...sub.split('/')));
    }
  }

  // docs/evolution/* — created at engines capability (first capability to
  // emit run scores and trend files). Doesn't require workstream.
  if (enabledCapabilities.has('engines')) {
    for (const sub of DOCS_EVOLUTION_SUBDIRS) {
      dirs.push(path.join(target, ...sub.split('/')));
    }
  }

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      if (!dryRun) fs.mkdirSync(dir, { recursive: true });
      state.directoriesCreated.push(toForwardSlash(path.relative(target, dir)));
    }
  }
}

function installPreamble(config, homebase, state) {
  const preambleSrc = path.join(homebase, 'kit', 'claude-preamble.md');
  if (!fs.existsSync(preambleSrc)) {
    state.errors.push('kit/claude-preamble.md not found');
    return;
  }

  const preambleContent = fs.readFileSync(preambleSrc, 'utf8');
  const preambleLines = preambleContent.split('\n').length;
  if (preambleLines > 200) {
    state.warnings.push(`Preamble is ${preambleLines} lines (target: <200). Consider trimming.`);
  }
  const claudeMdPath = path.join(config.target, 'CLAUDE.md');
  let existingContent = '';
  let isReAdoption = false;

  if (fs.existsSync(claudeMdPath)) {
    existingContent = fs.readFileSync(claudeMdPath, 'utf8');
    isReAdoption = existingContent.includes(PREAMBLE_END);
  }

  let finalContent;

  if (isReAdoption) {
    // Replace only the preamble section
    const endIdx = existingContent.indexOf(PREAMBLE_END);
    const afterPreamble = existingContent.substring(endIdx + PREAMBLE_END.length);
    finalContent = preambleContent + '\n' + PREAMBLE_END + afterPreamble;
  } else if (existingContent) {
    // Fresh install with existing CLAUDE.md — prepend
    finalContent = preambleContent + '\n' + PREAMBLE_END + '\n\n' + existingContent;
  } else {
    // No existing CLAUDE.md
    finalContent = preambleContent + '\n' + PREAMBLE_END + '\n';
  }

  // Preamble deduplication: check for overlapping sections below the marker
  const afterMarkerIdx = finalContent.indexOf(PREAMBLE_END);
  if (afterMarkerIdx !== -1) {
    const afterMarker = finalContent.substring(afterMarkerIdx + PREAMBLE_END.length);
    const overlapHeadings = ['## Self-Verification', '## Session Protocol', '## Session',
                             '## Autonomous', '## Proactive', '## Verification'];
    const found = overlapHeadings.filter(h => afterMarker.includes(h));
    if (found.length > 0) {
      const overrideComment = '\n<!-- Override: project-specific sections below take precedence over preamble defaults -->\n';
      if (!finalContent.includes('<!-- Override:')) {
        finalContent = finalContent.replace(PREAMBLE_END, PREAMBLE_END + overrideComment);
      }
      state.warnings.push(`Preamble overlap detected: ${found.join(', ')} — override comment inserted`);
    }
  }

  if (!config.dryRun) writeFileAtomic(claudeMdPath, finalContent);

  state.installLog.push({
    source: 'kit/claude-preamble.md',
    destination: 'CLAUDE.md',
    action: isReAdoption ? 'updated' : (existingContent ? 'prepended' : 'created'),
    merge_strategy: 'preamble-replace',
    hash: sha256(finalContent),
  });
  state.checksumMap['CLAUDE.md'] = sha256(finalContent);
}

function copyM1Files(config, homebase, m1Files, state) {
  for (const entry of m1Files) {
    // Skip preamble — handled separately
    if (entry.merge_strategy === 'preamble-replace') continue;

    const srcPath = path.join(homebase, entry.source);
    const destRel = resolveDestination(entry.destination, config.systemDir);
    const destPath = boundedPathInRepo(config.target, destRel);
    const destRelForward = toForwardSlash(destRel);

    if (!fs.existsSync(srcPath)) {
      state.errors.push(`Source missing: ${toForwardSlash(entry.source)}`);
      continue;
    }

    const srcContent = fs.readFileSync(srcPath, 'utf8');

    // Ensure parent directory exists
    const parentDir = path.dirname(destPath);
    if (!fs.existsSync(parentDir)) {
      if (!config.dryRun) fs.mkdirSync(parentDir, { recursive: true });
    }

    if (entry.merge_strategy === 'additive') {
      // Preserve existing file entirely
      if (fs.existsSync(destPath)) {
        state.installLog.push({
          source: toForwardSlash(entry.source), destination: destRelForward,
          action: 'preserved', merge_strategy: 'additive',
          hash: sha256(fs.readFileSync(destPath, 'utf8')),
        });
        state.checksumMap[destRelForward] = sha256(fs.readFileSync(destPath, 'utf8'));
        continue;
      }
      // Create new from template
      if (!config.dryRun) writeFileAtomic(destPath, srcContent);
      state.installLog.push({
        source: toForwardSlash(entry.source), destination: destRelForward,
        action: 'created', merge_strategy: 'additive',
        hash: sha256(srcContent),
      });
      state.checksumMap[destRelForward] = sha256(srcContent);
    } else {
      // overwrite strategy
      if (fs.existsSync(destPath)) {
        const existing = fs.readFileSync(destPath, 'utf8');
        if (existing === srcContent) {
          state.installLog.push({
            source: toForwardSlash(entry.source), destination: destRelForward,
            action: 'unchanged', merge_strategy: 'overwrite',
            hash: sha256(srcContent),
          });
          state.checksumMap[destRelForward] = sha256(srcContent);
          continue;
        }
        // User-customized — write .kit-update sidecar
        const updatePath = destPath + '.kit-update';
        if (!config.dryRun) writeFileAtomic(updatePath, srcContent);
        state.installLog.push({
          source: toForwardSlash(entry.source), destination: destRelForward,
          action: 'kit-update-written', merge_strategy: 'overwrite',
          hash: sha256(existing),
        });
        state.checksumMap[destRelForward] = sha256(existing);
        state.warnings.push(`${destRelForward} is user-customized — new kit version written to ${destRelForward}.kit-update`);
      } else {
        if (!config.dryRun) writeFileAtomic(destPath, srcContent);
        state.installLog.push({
          source: toForwardSlash(entry.source), destination: destRelForward,
          action: 'created', merge_strategy: 'overwrite',
          hash: sha256(srcContent),
        });
        state.checksumMap[destRelForward] = sha256(srcContent);
      }
    }
  }
}

// Copy deferred files whose capability is in the enabled set. Mirrors
// copyM1Files logic; conditional: entries are skipped because /adopt
// markdown (Step 5q etc.) installs those after domain-specific detection.
// Before this phase existed, main() only copied m1Files while
// updateMilestones blindly flipped deferred_commands.<cap>.installed to
// true based on capability enablement — adopted repos ended up with
// `installed: true` flags and zero actual files. See FIND-silent-deferred.
function copyDeferredFiles(config, homebase, deferredFiles, state) {
  for (const entry of deferredFiles) {
    // Preamble handled in installPreamble; preamble-replace is never deferred
    // in practice but defend in depth.
    if (entry.merge_strategy === 'preamble-replace') continue;
    // conditional: <reason> — installed by /adopt markdown after a
    // domain-specific detector fires (e.g., claims-policy on repo_claims).
    // Copying unconditionally here would fire the template for every repo.
    if (entry.conditional) continue;

    const srcPath = path.join(homebase, entry.source);
    const destRel = resolveDestination(entry.destination, config.systemDir);
    const destPath = boundedPathInRepo(config.target, destRel);
    const destRelForward = toForwardSlash(destRel);

    if (!fs.existsSync(srcPath)) {
      state.errors.push(`Deferred source missing: ${toForwardSlash(entry.source)}`);
      continue;
    }

    const srcContent = fs.readFileSync(srcPath, 'utf8');

    const parentDir = path.dirname(destPath);
    if (!fs.existsSync(parentDir)) {
      if (!config.dryRun) fs.mkdirSync(parentDir, { recursive: true });
    }

    const strategy = entry.merge_strategy || 'overwrite';

    if (strategy === 'additive' || strategy === 'skip-if-exists') {
      // Both preserve existing content; only create when the target is absent.
      if (fs.existsSync(destPath)) {
        const existing = fs.readFileSync(destPath, 'utf8');
        state.installLog.push({
          source: toForwardSlash(entry.source), destination: destRelForward,
          action: 'preserved', merge_strategy: strategy,
          hash: sha256(existing),
        });
        state.checksumMap[destRelForward] = sha256(existing);
        continue;
      }
      if (!config.dryRun) writeFileAtomic(destPath, srcContent);
      state.installLog.push({
        source: toForwardSlash(entry.source), destination: destRelForward,
        action: 'created', merge_strategy: strategy,
        hash: sha256(srcContent),
      });
      state.checksumMap[destRelForward] = sha256(srcContent);
    } else {
      // overwrite strategy — match copyM1Files behavior.
      if (fs.existsSync(destPath)) {
        const existing = fs.readFileSync(destPath, 'utf8');
        if (existing === srcContent) {
          state.installLog.push({
            source: toForwardSlash(entry.source), destination: destRelForward,
            action: 'unchanged', merge_strategy: 'overwrite',
            hash: sha256(srcContent),
          });
          state.checksumMap[destRelForward] = sha256(srcContent);
          continue;
        }
        const updatePath = destPath + '.kit-update';
        if (!config.dryRun) writeFileAtomic(updatePath, srcContent);
        state.installLog.push({
          source: toForwardSlash(entry.source), destination: destRelForward,
          action: 'kit-update-written', merge_strategy: 'overwrite',
          hash: sha256(existing),
        });
        state.checksumMap[destRelForward] = sha256(existing);
        state.warnings.push(
          `${destRelForward} is user-customized — new kit version written to ${destRelForward}.kit-update`
        );
      } else {
        if (!config.dryRun) writeFileAtomic(destPath, srcContent);
        state.installLog.push({
          source: toForwardSlash(entry.source), destination: destRelForward,
          action: 'created', merge_strategy: 'overwrite',
          hash: sha256(srcContent),
        });
        state.checksumMap[destRelForward] = sha256(srcContent);
      }
    }
  }
}

// ─── Phase 3-repair: Heal a Partially-Broken Install (WS-384) ──────────────
//
// /adopt --repair. The normal copy phases are additive: a broken file (corrupt
// YAML, partial copy) survives every re-adoption because existing files are
// preserved entirely. --repair heals files that have DRIFTED from the install
// record. The `.cwos-version` installed_files[dest] hash is the fingerprint of
// what /adopt last wrote (post-instantiation) — it, not raw kit source, is the
// source of truth for what this repo should hold.
// Classification (founder decision 2026-06-08: preserve customizations):
//   on-disk == kit source                  → unchanged   (healthy)
//   on-disk == install record              → unchanged   (healthy — covers files /adopt patched at install)
//   missing but expected (non-conditional) → repaired-missing (re-create from kit)
//   drifted + YAML fails to parse          → repaired-corrupt (restore from kit even if customized — warn)
//   drifted + valid (founder edit)         → customized  (preserve + .kit-update sidecar + needs-review)
//                                            unless --force → repaired-forced (overwrite, .pre-repair backup)
// Repair heals corruption; it does NOT push newer kit versions to untouched
// files — that is /kit-upgrade's job (kit/hashes-*.yaml baseline).
// Schema-version migration is detect-and-warn only here (WS-376 owns auto-apply).
function repairInstalledFiles(config, homebase, m1Files, deferredFiles, state) {
  const stampPath = path.join(config.target, '.cwos-version');
  const { ok: stampOk, data: stamp } = readYAMLFile(stampPath);
  const installedFiles = (stampOk && stamp && stamp.installed_files) || {};

  // Repair the full installed surface. Conditional deferred entries (installed
  // by the /adopt skill only after a domain detector fires) are repaired when
  // already present but never re-created from absence — recreating them would
  // fire a template the repo deliberately doesn't have.
  const entries = [...m1Files, ...deferredFiles];

  for (const entry of entries) {
    if (entry.merge_strategy === 'preamble-replace') continue; // preamble healed separately

    const srcPath = path.join(homebase, entry.source);
    const destRel = resolveDestination(entry.destination, config.systemDir);
    const destPath = boundedPathInRepo(config.target, destRel);
    const destRelForward = toForwardSlash(destRel);

    if (!fs.existsSync(srcPath)) {
      state.errors.push(`Repair source missing: ${toForwardSlash(entry.source)}`);
      continue;
    }
    const srcContent = fs.readFileSync(srcPath, 'utf8');
    const srcHash = sha256(srcContent);
    const recordedHash = installedFiles[destRelForward] || null;
    const isYAML = /\.ya?ml$/i.test(destRelForward);

    // ── Missing file ──
    if (!fs.existsSync(destPath)) {
      if (entry.conditional) continue; // never resurrect a conditional template
      const parentDir = path.dirname(destPath);
      if (!fs.existsSync(parentDir) && !config.dryRun) fs.mkdirSync(parentDir, { recursive: true });
      if (!config.dryRun) writeFileAtomic(destPath, srcContent);
      state.installLog.push({
        source: toForwardSlash(entry.source), destination: destRelForward,
        action: 'repaired-missing', merge_strategy: 'repair', hash: srcHash,
      });
      state.checksumMap[destRelForward] = srcHash;
      state.warnings.push(`${destRelForward} was missing — re-provisioned from kit`);
      continue;
    }

    const existing = fs.readFileSync(destPath, 'utf8');
    const existingHash = sha256(existing);

    // ── Matches current kit verbatim → healthy ──
    if (existingHash === srcHash) {
      state.installLog.push({
        source: toForwardSlash(entry.source), destination: destRelForward,
        action: 'unchanged', merge_strategy: 'repair', hash: srcHash,
      });
      state.checksumMap[destRelForward] = srcHash;
      continue;
    }

    // ── Matches what /adopt last wrote → healthy ──
    // The install record is the source of truth for what THIS repo should hold.
    // Many files legitimately differ from raw kit source because /adopt patched
    // them at install (instantiateYAMLTemplates / patchProgramScopes /
    // rewritePathReferences). If on-disk still equals the recorded install hash,
    // the file is exactly as adoption left it — healthy, leave it alone. Pushing
    // newer kit versions to untouched files is /kit-upgrade's job, not repair's.
    if (recordedHash && existingHash === recordedHash) {
      state.installLog.push({
        source: toForwardSlash(entry.source), destination: destRelForward,
        action: 'unchanged', merge_strategy: 'repair', hash: existingHash,
      });
      state.checksumMap[destRelForward] = existingHash;
      continue;
    }

    // From here the file has DRIFTED from the install record (or predates the
    // fingerprint entirely): corruption, partial write, or a founder edit.

    // ── Definitively broken (empty / structureless) → restore from kit ──
    // A corrupt template helps nobody, so we overwrite even if the drift might
    // have been an edit. But the kit's YAML parser is deliberately lenient
    // (it coerces almost any text to an object), so "fails to parse" is not a
    // usable signal. We auto-heal ONLY files we can call broken with confidence:
    // empty/whitespace-only, or a YAML that the kit source fills with structure
    // but on-disk parses to nothing usable. Every other drift is preserved and
    // surfaced (below) — the founder swaps in the .kit-update if it was corrupt.
    if (isStructurallyBroken(existing, srcContent, isYAML)) {
      if (!config.dryRun) writeFileAtomic(destPath, srcContent);
      state.installLog.push({
        source: toForwardSlash(entry.source), destination: destRelForward,
        action: 'repaired-corrupt', merge_strategy: 'repair', hash: srcHash,
      });
      state.checksumMap[destRelForward] = srcHash;
      state.warnings.push(`${destRelForward} was empty or structurally broken — restored from kit source (re-run /adopt if this file is normally repo-customized)`);
      continue;
    }

    // ── Drifted but valid → treat as a founder customization ──
    if (config.force) {
      // Explicit opt-in: overwrite, but keep a backup of the local version.
      if (!config.dryRun) {
        writeFileAtomic(destPath + '.pre-repair', existing);
        writeFileAtomic(destPath, srcContent);
      }
      state.installLog.push({
        source: toForwardSlash(entry.source), destination: destRelForward,
        action: 'repaired-forced', merge_strategy: 'repair', hash: srcHash,
      });
      state.checksumMap[destRelForward] = srcHash;
      state.warnings.push(`${destRelForward} was customized — overwritten by --force (local version saved to ${destRelForward}.pre-repair)`);
      continue;
    }
    // Default: preserve the customization, surface the kit version alongside.
    if (!config.dryRun) writeFileAtomic(destPath + '.kit-update', srcContent);
    state.installLog.push({
      source: toForwardSlash(entry.source), destination: destRelForward,
      action: 'customized', merge_strategy: 'repair', hash: existingHash,
    });
    state.checksumMap[destRelForward] = existingHash;
    state.needsReview.push(destRelForward);
    state.warnings.push(`${destRelForward} is customized — kept as-is; current kit version written to ${destRelForward}.kit-update`);
  }

  // Schema-version drift: detect-and-warn only (WS-376 owns safe auto-migration).
  detectSchemaVersionDrift(config, homebase, entries, state);
}

// Compare schema_version in installed kit-templated YAMLs against the kit
// source. Surfaces a route-to-WS-376 warning per regression; mutates nothing.
function detectSchemaVersionDrift(config, homebase, entries, state) {
  const verRe = /^schema_version:\s*(\S+)/m;
  for (const entry of entries) {
    const destRel = resolveDestination(entry.destination, config.systemDir);
    if (!/\.ya?ml$/i.test(destRel)) continue;
    const destPath = boundedPathInRepo(config.target, destRel);
    const srcPath = path.join(homebase, entry.source);
    if (!fs.existsSync(destPath) || !fs.existsSync(srcPath)) continue;
    const instM = fs.readFileSync(destPath, 'utf8').match(verRe);
    const kitM = fs.readFileSync(srcPath, 'utf8').match(verRe);
    if (!instM || !kitM) continue;
    const instV = parseFloat(instM[1]);
    const kitV = parseFloat(kitM[1]);
    if (Number.isFinite(instV) && Number.isFinite(kitV) && instV < kitV) {
      state.warnings.push(
        `${toForwardSlash(destRel)}: schema_version ${instM[1]} < kit ${kitM[1]} — ` +
        `repair does not auto-migrate schema (route to WS-376). Review before relying on new fields.`
      );
    }
  }
}

// Is an on-disk file broken with enough confidence to overwrite it even though
// the drift COULD have been an intentional edit? Two reliable signals only:
//   1. empty / whitespace-only (a classic partial-write / truncation failure);
//   2. a YAML where the kit source carries real structure (object with keys)
//      but the on-disk copy parses to nothing usable (null / non-object / {}),
//      i.e. the parser could not recover any of the expected shape.
// The kit YAML parser is lenient, so we deliberately do NOT trust "parse threw"
// as corruption — see repairInstalledFiles. Anything subtler is preserved.
function isStructurallyBroken(existing, srcContent, isYAML) {
  if (existing.trim() === '') return true;
  if (!isYAML) return false;
  try {
    const kit = require('./lib/cwos-utils').parseYAML(srcContent);
    const cur = require('./lib/cwos-utils').parseYAML(existing);
    const kitHasShape = kit && typeof kit === 'object' && Object.keys(kit).length > 0;
    const curHasShape = cur && typeof cur === 'object' && Object.keys(cur).length > 0;
    return kitHasShape && !curHasShape;
  } catch {
    // Parser threw on the on-disk copy but not (presumably) the kit template —
    // treat as broken; the kit source is the safe restore.
    return true;
  }
}

function instantiateYAMLTemplates(config, state) {
  // Patch newly-created additive files with repo-specific values
  const newAdditive = state.installLog.filter(e =>
    e.merge_strategy === 'additive' && e.action === 'created'
  );

  for (const entry of newAdditive) {
    const destPath = boundedPathInRepo(config.target, entry.destination.replace(/\//g, path.sep));
    const basename = path.basename(entry.destination);

    if (!fs.existsSync(destPath)) continue;
    if (config.dryRun) continue;

    try {
      // WS-438: adoption_level is no longer emitted into adopted-repo state.
      // ADR-016 made the capabilities block canonical and deprecated the level
      // axis; WS-378 dropped it from the .cwos-version stamp, and this completes
      // the retirement by removing the three template-patch sites. Backward
      // compatibility for existing repos is preserved by capability-map.js's
      // dual-read (resolveEnabledCapabilities), which still translates a legacy
      // adoption_level when a capabilities block is absent.
      if (basename === '.cwos-onboarding.yaml' || basename === 'cwos-onboarding.yaml') {
        const onboardingPatches = {
          started_at: config.timestamp,
          repo_archetype: config.archetype,
          platform: config.platform,
        };
        // WS-250: when an archetype bundle is provided, also seed the
        // schema-v3 archetype + stage + declared_* fields. The archetype_bundle_resolved
        // block is written by cwos-adopt-archetype.js apply (called separately
        // by /adopt Step 5g) — patchYAMLFile cannot express nested blocks.
        if (config.archetypeBundle) {
          if (config.archetypeBundle.archetype) {
            onboardingPatches.archetype = config.archetypeBundle.archetype;
            onboardingPatches.declared_archetype = config.archetypeBundle.archetype;
          }
          if (config.archetypeBundle.stage) {
            onboardingPatches.stage = config.archetypeBundle.stage;
            onboardingPatches.declared_stage = config.archetypeBundle.stage;
          }
        }
        patchYAMLFile(destPath, onboardingPatches);
      } else if (basename === '.cwos-config.yaml' || basename === 'cwos-config.yaml') {
        patchYAMLFile(destPath, {
          ceremony: CEREMONY_MAP[config.archetype] || 'standard',
        });
      } else if (basename === '.cwos-feedback.yaml' || basename === 'cwos-feedback.yaml') {
        patchYAMLFile(destPath, {
          repo_name: config.repoName,
          platform: config.platform,
          repo_archetype: config.archetype,
        });
      } else if (basename === 'usage.yaml') {
        patchYAMLFile(destPath, {
          adopted_at: config.timestamp,
          repo_type: config.archetype,
        });
      }

      // Update checksum after patching
      const patched = fs.readFileSync(destPath, 'utf8');
      state.checksumMap[entry.destination] = sha256(patched);
    } catch (err) {
      state.errors.push(`template patch failed for ${entry.destination}: ${err.message}`);
    }
  }
}

// ─── Phase 3b: Patch Program Scope Patterns ───────────────────────────────

function patchProgramScopes(config, state) {
  // Find newly-created program files in the install log
  const programEntries = state.installLog.filter(e =>
    e.action === 'created' &&
    e.destination.includes('/programs/prog-') &&
    e.destination.endsWith('.yaml')
  );

  if (programEntries.length === 0) return;

  for (const entry of programEntries) {
    const destPath = boundedPathInRepo(config.target, entry.destination.replace(/\//g, path.sep));
    if (!fs.existsSync(destPath)) continue;

    // Extract program ID from filename: prog-engineering.yaml → engineering
    const basename = path.basename(entry.destination, '.yaml');
    const programId = basename.replace(/^prog-/, '');

    const override = PROGRAM_PATTERN_OVERRIDES[programId];

    // Skip program entirely if archetype is in skip list
    if (override && override.skip_archetypes &&
        override.skip_archetypes.includes(config.archetype)) {
      if (!config.dryRun) {
        fs.unlinkSync(destPath);
        // Remove from checksum map
        delete state.checksumMap[entry.destination];
      }
      entry.action = 'skipped';
      state.warnings.push(
        `${entry.destination} removed — ${programId} program not applicable for ${config.archetype} archetype`
      );
      continue;
    }

    // Determine patterns: override base or archetype defaults
    const patterns = (override && override.base)
      ? override.base
      : (ARCHETYPE_PATTERNS[config.archetype] || []);

    if (patterns.length === 0) continue;
    if (config.dryRun) continue;

    try {
      let content = fs.readFileSync(destPath, 'utf8');

      // Preserve the file's existing line ending. Templates are authored on
      // Windows (CRLF); writing LF joins into a CRLF file produces mixed EOLs.
      const eol = content.includes('\r\n') ? '\r\n' : '\n';

      // Replace file_patterns block: from "  file_patterns:" through the
      // "# /adopt adjusts" comment line (inclusive). The `\r?\n` tolerates
      // CRLF — a bare `\n` silently fails to match CRLF program templates,
      // leaving archetype narrowing unapplied (FIND-059 / WS-471).
      const patternsYAML = patterns.map(p => `    - ${formatScalar(p)}`).join(eol);
      const blockRegex = /( {2}file_patterns:\r?\n)(?: {4}- [^\n]*\r?\n)*(?:(?: {4}# \/adopt adjusts[^\n]*\r?\n?))?/;

      if (blockRegex.test(content)) {
        content = content.replace(blockRegex, `$1${patternsYAML}${eol}`);
        writeFileAtomic(destPath, content);
        state.checksumMap[entry.destination] = sha256(content);
      } else {
        // Do NOT silently write unchanged content — that masked the CRLF bug.
        // Surface a warning so a template-format drift is detectable.
        state.warnings.push(
          `program scope patch skipped for ${entry.destination} — file_patterns block not found; archetype narrowing NOT applied (check template format)`
        );
      }
    } catch (err) {
      state.errors.push(`program scope patch failed for ${entry.destination}: ${err.message}`);
    }
  }
}

// ─── Phase 3c: Provision Program Evidence Directories (WS-372 / FIND-240) ─
//
// Every prog-*.yaml template declares an `evidence_dir:` field (e.g.,
// .claude/workstream/evidence/financial-accuracy/). Without these directories
// existing on disk, the first /pulse run write fails ENOENT → AS-23 swallows
// → founder sees no error, no artifact, last_run_by_protocol stays null →
// program looks installed but is permanently inoperative.
//
// This pass runs AFTER patchProgramScopes so the YAML reads in their final
// form. Idempotent: re-running /adopt creates any missing evidence_dirs.

function provisionEvidenceDirs(config, state) {
  const programEntries = state.installLog.filter(e =>
    (e.action === 'created' || e.action === 'updated') &&
    e.destination.includes('/programs/prog-') &&
    e.destination.endsWith('.yaml')
  );

  if (programEntries.length === 0) return;

  for (const entry of programEntries) {
    const destPath = boundedPathInRepo(config.target, entry.destination.replace(/\//g, path.sep));
    if (!fs.existsSync(destPath)) continue;

    let evidenceDir = null;
    try {
      const content = fs.readFileSync(destPath, 'utf8');
      // YAML line `evidence_dir: ".claude/workstream/evidence/<name>/"` — quoted or unquoted.
      const m = content.match(/^evidence_dir:\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/m);
      if (m) evidenceDir = m[1].trim();
    } catch (err) {
      state.errors.push(`evidence_dir parse failed for ${entry.destination}: ${err.message}`);
      continue;
    }

    if (!evidenceDir) continue;

    let evidenceAbs;
    try {
      evidenceAbs = boundedPathInRepo(config.target, evidenceDir.replace(/\//g, path.sep));
    } catch (err) {
      state.errors.push(`evidence_dir rejected for ${entry.destination}: ${err.message}`);
      continue;
    }
    if (fs.existsSync(evidenceAbs)) continue;
    if (config.dryRun) {
      state.directoriesCreated.push(`${toForwardSlash(evidenceDir)} (dry-run)`);
      continue;
    }

    try {
      fs.mkdirSync(evidenceAbs, { recursive: true });
      state.directoriesCreated.push(toForwardSlash(path.relative(config.target, evidenceAbs)));
    } catch (err) {
      state.errors.push(`evidence_dir mkdir failed for ${entry.destination} (${evidenceDir}): ${err.message}`);
    }
  }
}

// ─── Phase 3e: Materialize Engines Registry ───────────────────────────────
//
// After commands + engines + library packs are installed, populate
// .claude/workstream/engines/registry.yaml from the scanned set of
// engine skill files at .claude/commands/<id>.md. Until kit-v3.7.0 the
// kit template's engines: map shipped with ~8 entries uncommented but
// many engines (constitutional-audit, design-audit, drift-detector,
// etc.) commented out as TODO placeholders, even though those engines
// were actually installed via MANIFEST. Programs referenced them via
// protocols.<name>.engine; reconcile's protocol-engine-ref validator
// then warned 18+ times per run. The materializer scans installed
// skill files and fills the gap. See cwos-engines-registry.js.

function materializeEnginesRegistry(config, state) {
  if (config.dryRun) return;
  const wsDir = path.join(config.target, '.claude', 'workstream');
  if (!fs.existsSync(wsDir)) return;
  try {
    const { syncRegistry } = require('./lib/cwos-engines-registry');
    const result = syncRegistry(wsDir);
    if (result.warnings && result.warnings.length > 0) {
      for (const w of result.warnings) state.warnings.push(`engines-registry: ${w}`);
    }
    if (result.written) {
      state.installLog.push({
        source: '(engines-registry-sync)',
        destination: '.claude/workstream/engines/registry.yaml',
        action: 'updated',
        merge_strategy: 'derived-from-commands',
        engines_count: result.count,
        added_from_scan: result.addedFromScan,
      });
    }
  } catch (err) {
    state.errors.push(`engines-registry materialization failed: ${err.message}`);
  }
}

// ─── Phase 3d: Materialize Programs Registry ──────────────────────────────
//
// After all prog-*.yaml files are installed + scope-patched, populate the
// .claude/workstream/programs/registry.yaml index from them. Until kit-v3.6.1
// /adopt copied prog-*.yaml files but left registry.yaml at its template
// default of `programs: []` — /pulse reads prog-*.yaml directly so the
// /pulse render was correct, but /next reads registry.yaml and counted
// `active_count: 0`, blocking every sprint composition. See INV-052.

function materializeProgramsRegistry(config, state) {
  if (config.dryRun) return;
  const programsDir = path.join(config.target, '.claude', 'workstream', 'programs');
  if (!fs.existsSync(programsDir)) return;
  try {
    const { syncRegistry } = require('./lib/cwos-program-registry');
    const result = syncRegistry(programsDir);
    if (result.warnings && result.warnings.length > 0) {
      for (const w of result.warnings) state.warnings.push(`program-registry: ${w}`);
    }
    if (result.written) {
      state.installLog.push({
        source: '(program-registry-sync)',
        destination: '.claude/workstream/programs/registry.yaml',
        action: 'updated',
        merge_strategy: 'derived-from-progs',
        programs_count: result.programs_count,
      });
    }
  } catch (err) {
    state.errors.push(`program-registry materialization failed: ${err.message}`);
  }
}

// ─── Phase 3c: Assert Bootstrap Health Is Honest ──────────────────────────

// Every newly-installed program must start with health_score=0 and
// health_ceiling=0 per DEC-023 (rigor-based scoring). Any non-zero value
// implies a rigor level was earned that adoption did not actually perform.
// This guard fails loud to prevent regression of the SYN inflation bug.
function assertBootstrapHealth(config, state) {
  const programEntries = state.installLog.filter(e =>
    e.action === 'created' &&
    e.destination.includes('/programs/prog-') &&
    e.destination.endsWith('.yaml') &&
    !e.destination.endsWith('prog-template.yaml')
  );

  if (programEntries.length === 0) return;
  if (config.dryRun) return;

  for (const entry of programEntries) {
    const destPath = boundedPathInRepo(config.target, entry.destination.replace(/\//g, path.sep));
    if (!fs.existsSync(destPath)) continue;

    try {
      const content = fs.readFileSync(destPath, 'utf8');
      const scoreMatch = content.match(/^health_score:\s*(\S+)/m);
      const ceilingMatch = content.match(/^health_ceiling:\s*(\S+)/m);
      const score = scoreMatch ? scoreMatch[1] : null;
      const ceiling = ceilingMatch ? ceilingMatch[1] : null;

      if (score !== '0' || ceiling !== '0') {
        state.errors.push(
          `Bootstrap health assertion failed for ${entry.destination}: ` +
          `expected health_score=0 and health_ceiling=0 (DEC-023), got ` +
          `health_score=${score ?? 'missing'}, health_ceiling=${ceiling ?? 'missing'}. ` +
          `Fix prog-template.yaml — bootstrap must not imply earned rigor.`
        );
      }
    } catch (err) {
      state.warnings.push(`bootstrap health check skipped for ${entry.destination}: ${err.message}`);
    }
  }
}

// ─── Phase 4: Write Deferred Manifest ──────────────────────────────────────

function writeDeferredManifest(config, deferredFiles, state) {
  const onboardingPath = path.join(config.target, '.cwos-onboarding.yaml');
  if (!fs.existsSync(onboardingPath) || config.dryRun) return;

  try {
    let content = fs.readFileSync(onboardingPath, 'utf8');

    // Remove any previously written section (idempotent)
    content = content.replace(/\n# --- cwos-adopt-install deferred_file_manifest ---[\s\S]*$/, '');

    // Build deferred manifest by install_group
    const byGroup = {};
    for (const f of deferredFiles) {
      const group = f.install_group || 'ungrouped';
      if (!byGroup[group]) byGroup[group] = [];
      byGroup[group].push(f);
    }

    let section = '\n# --- cwos-adopt-install deferred_file_manifest ---\n';
    section += `# Generated: ${config.timestamp}\n`;
    section += `# Total deferred files: ${deferredFiles.length}\n`;
    section += 'deferred_file_manifest:\n';

    for (const [group, files] of Object.entries(byGroup)) {
      section += `  # ${group}\n`;
      for (const f of files) {
        const dest = resolveDestination(f.destination, config.systemDir);
        section += `  - source: ${formatScalar(toForwardSlash(f.source))}\n`;
        section += `    destination: ${formatScalar(toForwardSlash(dest))}\n`;
        section += `    level: ${f.level}\n`;
        section += `    install_group: ${formatScalar(group)}\n`;
        if (f.impact) section += `    impact: ${formatScalar(f.impact)}\n`;
        section += `    merge_strategy: ${f.merge_strategy || 'overwrite'}\n`;
      }
    }

    writeFileAtomic(onboardingPath, content + section);

    // Update checksum
    state.checksumMap['.cwos-onboarding.yaml'] = sha256(content + section);
  } catch (err) {
    state.errors.push(`deferred manifest write failed: ${err.message}`);
  }
}

// ─── Phase 5: Rewrite Path References ──────────────────────────────────────

function rewritePathReferences(config, state) {
  const scanDirs = [
    path.join(config.target, '.claude', 'commands'),
    path.join(config.target, config.systemDir),
  ];
  const scanFiles = [path.join(config.target, 'CLAUDE.md')];

  // Collect all .md files from dirs
  for (const dir of scanDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = globFiles(dir, '*.md');
    scanFiles.push(...files);
  }

  const OLD_PATH = '.claude/skills/';
  const NEW_PATH = '.claude/commands/';

  for (const filePath of scanFiles) {
    if (!fs.existsSync(filePath)) continue;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const count = (content.match(/\.claude\/skills\//g) || []).length;
      if (count === 0) continue;

      const updated = content.split(OLD_PATH).join(NEW_PATH);
      if (!config.dryRun) writeFileAtomic(filePath, updated);

      const rel = toForwardSlash(path.relative(config.target, filePath));
      state.pathRewrites.push({ file: rel, occurrences: count });
    } catch (err) {
      state.errors.push(`path rewrite failed for ${toForwardSlash(filePath)}: ${err.message}`);
    }
  }
}

// ─── Phase 6: Migrate Legacy Files ─────────────────────────────────────────

function migrateLegacy(config, state) {
  // 6a: Legacy system files
  for (const mapping of LEGACY_MAP) {
    const canonicalPath = path.join(config.target, config.systemDir, mapping.canonical);

    for (const legacyRel of mapping.legacy) {
      const legacyPath = path.join(config.target, legacyRel);
      const backupPath = legacyPath + '.pre-cwos-backup';

      // Skip if legacy doesn't exist or already backed up
      if (!fs.existsSync(legacyPath) || fs.existsSync(backupPath)) continue;
      // Skip if it's the same as canonical (e.g. system/state.md listed as legacy)
      if (path.resolve(legacyPath) === path.resolve(canonicalPath)) continue;

      try {
        const legacyContent = fs.readFileSync(legacyPath, 'utf8');

        if (!fs.existsSync(canonicalPath)) {
          // Move to canonical
          if (!config.dryRun) {
            writeFileAtomic(canonicalPath, legacyContent);
            fs.renameSync(legacyPath, backupPath);
          }
          state.migrations.push({
            from: toForwardSlash(legacyRel),
            to: toForwardSlash(path.join(config.systemDir, mapping.canonical)),
            action: 'moved',
          });
        } else {
          // Canonical exists — append legacy under heading
          const canonical = fs.readFileSync(canonicalPath, 'utf8');
          const appendix = `\n\n---\n<!-- Migrated from ${legacyRel} by CWOS /adopt -->\n\n${legacyContent}`;
          if (!config.dryRun) {
            writeFileAtomic(canonicalPath, canonical + appendix);
            fs.renameSync(legacyPath, backupPath);
          }
          state.migrations.push({
            from: toForwardSlash(legacyRel),
            to: toForwardSlash(path.join(config.systemDir, mapping.canonical)),
            action: 'appended',
          });
        }
      } catch (err) {
        state.errors.push(`legacy migration failed for ${legacyRel}: ${err.message}`);
      }
    }
  }

  // 6b: Legacy .claude/skills/ directory
  const skillsDir = path.join(config.target, '.claude', 'skills');
  if (fs.existsSync(skillsDir) && fs.statSync(skillsDir).isDirectory()) {
    const deprecatedDir = path.join(config.target, '.claude', 'skills.deprecated');
    if (!fs.existsSync(deprecatedDir)) {
      try {
        if (!config.dryRun) {
          fs.renameSync(skillsDir, deprecatedDir);
          const readme = [
            '# Deprecated — Migrated to .claude/commands/',
            '',
            'This directory was renamed during CWOS adoption.',
            'All skill files have been migrated to .claude/commands/.',
            '',
            'Safe to delete after verifying your commands work correctly.',
          ].join('\n');
          writeFileAtomic(path.join(deprecatedDir, 'README.md'), readme);
        }
        state.migrations.push({
          from: '.claude/skills/',
          to: '.claude/skills.deprecated/',
          action: 'renamed',
        });
      } catch (err) {
        state.errors.push(`skills directory migration failed: ${err.message}`);
      }
    }
  }
}

// ─── Phase 6c: Seed System Files from Existing Governance ─────────────────
//
// /adopt.md Steps 2g + 5e-ii describe scanning the repo for existing governance
// docs (ADRs, LICENSE, CONTRIBUTING, SECURITY, ARCHITECTURE) and seeding the
// new system/ files from them so adopters don't start with blank templates.
//
// The fuzzy extractions (CONTRIBUTING → invariants, ARCHITECTURE → decisions
// in prose form, SECURITY policy text → constraints) stay in the AI-driven
// step — pulling rules out of arbitrary prose isn't deterministic.
//
// The structural fits live here:
//   - docs/adr/*.md → system/decisions.md (each ADR becomes a DEC-NNN entry)
//   - (future) LICENSE detection → system/constraints.md hard-constraint row
//
// Seeding is one-shot: if system/decisions.md already exists (from a prior
// adoption or manual authoring), this phase is a no-op. The AI step in
// /adopt.md remains the right place for richer extraction.

function seedGovernance(config, state) {
  seedDecisionsFromADRs(config, state);
}

function seedDecisionsFromADRs(config, state) {
  const adrDir = path.join(config.target, 'docs', 'adr');
  if (!fs.existsSync(adrDir) || !fs.statSync(adrDir).isDirectory()) return;

  // Skip non-ADR files: README, index, and any template scaffolding. ADRs
  // typically follow the ADR-NNN-... or NNN-... naming scheme; everything else
  // in docs/adr/ is meta-documentation that shouldn't seed a DEC entry.
  const NON_ADR_BASENAMES = new Set([
    'readme.md', 'index.md', 'template.md', 'adr-template.md', '_template.md',
  ]);
  const adrFiles = globFiles(adrDir, '*.md')
    .filter(p => !NON_ADR_BASENAMES.has(path.basename(p).toLowerCase()))
    .sort();
  if (adrFiles.length === 0) return;

  const decisionsPath = path.join(config.target, config.systemDir, 'decisions.md');
  if (fs.existsSync(decisionsPath)) {
    // Already exists — don't overwrite. AI step can still merge richer content.
    return;
  }

  const lines = [
    '# Decisions',
    '',
    '<!-- Seeded from docs/adr/ during CWOS adoption. -->',
    '<!-- Each entry corresponds to an ADR file. New decisions should be -->',
    '<!-- appended below using the same DEC-NNN format. -->',
    '',
  ];

  for (let i = 0; i < adrFiles.length; i++) {
    const filePath = adrFiles[i];
    const rel = toForwardSlash(path.relative(config.target, filePath));
    const decId = `DEC-${String(i + 1).padStart(3, '0')}`;

    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      state.errors.push(`ADR seeding failed reading ${rel}: ${err.message}`);
      continue;
    }

    // Extract title from first H1 heading; fall back to filename
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.md');

    // Strip the original H1 so the seeded heading owns the section
    const body = content.replace(/^#\s+.+$/m, '').trim();

    lines.push(`## ${decId}: ${title}`);
    lines.push('');
    lines.push(`<!-- Seeded from ${rel} -->`);
    lines.push('');
    if (body) lines.push(body);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  const seededContent = lines.join('\n');

  if (!config.dryRun) {
    const systemDirAbs = path.dirname(decisionsPath);
    if (!fs.existsSync(systemDirAbs)) {
      fs.mkdirSync(systemDirAbs, { recursive: true });
    }
    writeFileAtomic(decisionsPath, seededContent);
  }

  const sourceRels = adrFiles.map(p => toForwardSlash(path.relative(config.target, p)));
  state.governanceSeeded.push({
    target_file: toForwardSlash(path.join(config.systemDir, 'decisions.md')),
    source_files: sourceRels,
    entries_added: adrFiles.length,
    action: 'seeded',
  });
  state.checksumMap[toForwardSlash(path.join(config.systemDir, 'decisions.md'))] = sha256(seededContent);
  state.installLog.push({
    source: '(governance-seed)',
    destination: toForwardSlash(path.join(config.systemDir, 'decisions.md')),
    action: 'created',
    merge_strategy: 'governance-seed',
    hash: sha256(seededContent),
  });
}

// ─── Phase 6b: Detect Parallel Governance Structures ──────────────────────
//
// Some repos invent CWOS-shaped governance independently before adoption (e.g.,
// programs at .claude/programs/*.md instead of the CWOS canonical path
// .claude/workstream/programs/prog-*.yaml). Without detection, /adopt copies
// the kit's empty workstream tree alongside the user's working programs and
// /pulse + /audit silently ignore the user's content. The user ends up with
// two parallel governance systems and no warning.
//
// This phase emits a warning per parallel governance pattern detected so the
// user knows post-install that those files exist but won't be picked up by
// CWOS commands until migrated. Migration is not automated — it requires
// schema conversion (markdown charter → YAML with scope/protocol/baseline)
// and that's a per-program design call, not a deterministic rewrite.

function detectParallelGovernance(config, state) {
  // Pattern 1: programs at .claude/programs/*.md (CPT layout)
  const customProgramsDir = path.join(config.target, '.claude', 'programs');
  if (fs.existsSync(customProgramsDir) && fs.statSync(customProgramsDir).isDirectory()) {
    const programFiles = globFiles(customProgramsDir, '*.md');
    if (programFiles.length > 0) {
      const relPaths = programFiles
        .map(p => toForwardSlash(path.relative(config.target, p)))
        .sort();
      state.parallelGovernance.push({
        pattern: '.claude/programs/*.md',
        canonical_path: '.claude/workstream/programs/',
        files: relPaths,
        impact: 'invisible to /pulse and /audit until migrated',
      });
      state.warnings.push(
        `Parallel governance detected: ${programFiles.length} program file(s) at ` +
        `.claude/programs/ (${relPaths.join(', ')}). CWOS governance commands ` +
        `(/pulse, /audit) read .claude/workstream/programs/ and will not see these. ` +
        `Migration to YAML schema is manual — preserved as-is.`
      );
    }
  }
}

// ─── Phase 7b: Update Milestone Status ─────────────────────────────────────

function updateMilestones(config, state) {
  const onboardingPath = path.join(config.target, '.cwos-onboarding.yaml');
  if (!fs.existsSync(onboardingPath) || config.dryRun) return;

  try {
    let content = fs.readFileSync(onboardingPath, 'utf8');
    const ts = config.timestamp;
    const enabled = config.enabledCapabilities;

    // M1 is always complete after /adopt
    content = markMilestone(content, 'm1_core_install', ts);

    // M1 checks — all true after successful adoption
    content = content.replace(/preamble_installed:\s*false/g, 'preamble_installed: true');
    content = content.replace(/onboard_check_installed:\s*false/g, 'onboard_check_installed: true');
    content = content.replace(/feedback_installed:\s*false/g, 'feedback_installed: true');
    content = content.replace(/state_template_created:\s*false/g, 'state_template_created: true');
    content = content.replace(/cwos_version_written:\s*false/g, 'cwos_version_written: true');
    content = content.replace(/fleet_registered:\s*false/g, 'fleet_registered: true');

    // WS-373 / INV-F2: mark deferred_commands groups as installed: true ONLY
    // when (a) the capability was enabled AND (b) no install errors mention
    // the capability AND (c) at least one file landed for the capability
    // (state.checksumMap has at least one path under the capability source).
    // Previously this set installed: true based purely on enabled.has(cap),
    // which let phantom engines (file copy failed silently) leave a flag at
    // true while the backing file was absent — the FIND-RUN017-2 dispatch gap.
    const capabilityFiles = {};
    for (const file of Object.keys(state.checksumMap || {})) {
      for (const cap of CAPABILITY_ORDER) {
        if (file.includes(`/${cap}/`) || file.includes(`${cap}-`)) {
          capabilityFiles[cap] = (capabilityFiles[cap] || 0) + 1;
        }
      }
    }
    for (const cap of CAPABILITY_ORDER) {
      if (!enabled.has(cap)) continue;
      const hasErrors = (state.errors || []).some(e => String(e).toLowerCase().includes(cap.toLowerCase()));
      const hasFiles = (capabilityFiles[cap] || 0) > 0;
      if (hasErrors || !hasFiles) {
        // Soft warning — leave the flag at false. The capability was requested
        // but its files didn't land cleanly; downstream dispatch should NOT
        // trust the flag.
        state.warnings = state.warnings || [];
        state.warnings.push(
          `capability "${cap}" stayed installed: false — ` +
          `${hasErrors ? 'install errors mention this capability' : 'no files landed under this capability'}. ` +
          `Re-run /adopt to retry, or run /onboard-check to inspect.`
        );
        continue;
      }
      const groupRegex = new RegExp(`(${cap}:[\\s\\S]*?)installed:\\s*false`);
      content = content.replace(groupRegex, '$1installed: true');
    }

    // Flip capabilities.<cap>.state from unconfigured → enabled for installed
    // groups. The template seeds all five as unconfigured; /adopt enables only
    // what was asked for. /discover is the surface that flips the rest later.
    for (const cap of CAPABILITY_ORDER) {
      if (!enabled.has(cap)) continue;
      const stateRegex = new RegExp(
        `(capabilities:[\\s\\S]*?${cap}:\\s*\\n\\s+state:\\s*)unconfigured`
      );
      content = content.replace(stateRegex, `$1enabled`);
      const capturedRegex = new RegExp(
        `(capabilities:[\\s\\S]*?${cap}:\\s*\\n\\s+state:\\s*enabled\\s*\\n\\s+captured_at:\\s*)null`
      );
      content = content.replace(capturedRegex, `$1"${ts}"`);
    }

    // Progressive onboarding: deferred_commands groups flip to installed: true
    // when their capability is enabled. Milestones M2-M5 require real-usage
    // evidence and are advanced via /onboard-check, not here.

    writeFileAtomic(onboardingPath, content);
    state.checksumMap['.cwos-onboarding.yaml'] = sha256(content);
    state.installLog.push({
      source: '(milestone-update)',
      destination: '.cwos-onboarding.yaml',
      action: 'updated',
      merge_strategy: 'in-place',
    });
  } catch (err) {
    state.warnings.push(`Milestone update failed: ${err.message}`);
  }
}

function markMilestone(content, milestoneName, timestamp) {
  // Find the milestone block and update status + completed_at
  const statusRegex = new RegExp(`(${milestoneName}:[\\s\\S]*?)status:\\s*pending`);
  const dateRegex = new RegExp(`(${milestoneName}:[\\s\\S]*?)completed_at:\\s*null`);

  if (statusRegex.test(content)) {
    content = content.replace(statusRegex, `$1status: complete`);
  }
  if (dateRegex.test(content)) {
    content = content.replace(dateRegex, `$1completed_at: "${timestamp}"`);
  }
  return content;
}

// ─── Phase 7: Write Version Stamp ──────────────────────────────────────────

function writeVersionStamp(config, state) {
  const stampPath = path.join(config.target, '.cwos-version');
  let adoptedAt = config.timestamp;

  // Preserve original adopted_at on re-adoption
  if (fs.existsSync(stampPath)) {
    const { ok, data } = readYAMLFile(stampPath);
    if (ok && data.adopted_at) adoptedAt = data.adopted_at;
  }

  // installed_files must be a FAITHFUL fingerprint of each file as adoption left
  // it on disk — both /adopt --repair (drift detection) and /kit-upgrade
  // (local-mod baseline, cwos-kit-upgrade.js:172) diff against it. state.checksumMap
  // captures each file's hash at COPY time, but later phases (instantiateYAMLTemplates,
  // rewritePathReferences, materialize*Registry) mutate files without refreshing it.
  // Recompute from disk here (Phase 7 — after all mutation) so the recorded hash
  // matches the final on-disk content. In --dry-run nothing was written, so keep
  // the in-memory map.
  const installedFiles = {};
  for (const [dest, recordedHash] of Object.entries(state.checksumMap)) {
    if (config.dryRun) { installedFiles[dest] = recordedHash; continue; }
    try {
      const abs = boundedPathInRepo(config.target, dest.replace(/\//g, path.sep));
      installedFiles[dest] = fs.existsSync(abs) ? sha256(fs.readFileSync(abs, 'utf8')) : recordedHash;
    } catch { installedFiles[dest] = recordedHash; }
  }

  // WS-378: level field retired from .cwos-version stamp per ADR-016. Legacy
  // readers fall back through capability-map.js#resolveEnabledCapabilities()
  // dual-read, which translates adoption_level on .cwos-onboarding.yaml. Only
  // emit level here when the caller explicitly used --level (legacy flag).
  const stamp = {
    version: config.kitVersion,
    adopted_at: adoptedAt,
    updated_at: config.timestamp,
    ...(config.level ? { level: config.level } : {}),
    homebase_path: toForwardSlash(config.homebase),
    kit_version_at_install: config.kitVersion,
    corpus_version: corpusHash(config.homebase),
    installed_files: installedFiles,
  };

  const content = serializeYAML(stamp) + '\n';
  if (!config.dryRun) {
    writeFileAtomic(stampPath, content);
    emitEvent('T0:envelope', 'adoption-version-stamped', {
      phase: 'version-stamp',
      path: path.relative(process.cwd(), stampPath).replace(/\\/g, '/'),
      kit_version: config.kitVersion,
      // WS-378: legacy --level flag still recorded in event payload when used;
      // capabilities path leaves it absent.
      ...(config.level ? { level: config.level } : {}),
    });
  }

  state.installLog.push({
    source: '(generated)',
    destination: '.cwos-version',
    action: adoptedAt === config.timestamp ? 'created' : 'updated',
    merge_strategy: 'overwrite',
    hash: sha256(content),
  });
}

// ─── Phase 8: Emit Manifest Bundle ─────────────────────────────────────────

function emitManifestBundle(startMs, config, state) {
  const counts = {
    created: 0, preserved: 0, unchanged: 0, 'kit-update-written': 0,
    updated: 0, prepended: 0,
  };
  for (const entry of state.installLog) {
    counts[entry.action] = (counts[entry.action] || 0) + 1;
  }

  emitBundle({
    command: 'adopt-install',
    script: 'cwos-adopt-install.js',
    startMs,
    errors: state.errors,
    data: {
      install_summary: {
        target: toForwardSlash(config.target),
        // WS-378: same truthy-guard pattern as the .cwos-version stamp emission
        // sites above (lines ~1397, ~1413). Capabilities-only callers leave
        // config.level undefined; emitting `level: undefined` here pollutes the
        // bundle output with a legacy field on a fresh-install path.
        ...(config.level ? { level: config.level } : {}),
        archetype: config.archetype,
        kit_version: config.kitVersion,
        system_dir: config.systemDir,
        dry_run: config.dryRun,
        files_created: counts.created + counts.prepended,
        files_preserved: counts.preserved,
        files_unchanged: counts.unchanged,
        files_updated: counts.updated,
        kit_updates_written: counts['kit-update-written'],
        directories_created: state.directoriesCreated.length,
        path_rewrites: state.pathRewrites.length,
        legacy_migrations: state.migrations.length,
        total_deferred: state.deferredFiles.length,
        warnings: state.warnings,
      },
      installed_files: state.installLog,
      deferred_files: state.deferredFiles.map(f => ({
        destination: toForwardSlash(resolveDestination(f.destination, config.systemDir)),
        install_group: f.install_group || 'ungrouped',
        level: f.level,
        impact: f.impact || '',
      })),
      path_rewrites: state.pathRewrites,
      migrations: state.migrations,
      parallel_governance: state.parallelGovernance,
      governance_seeded: state.governanceSeeded,
      directories_created: state.directoriesCreated,
      needs_review: state.needsReview,
    },
  });
}

// ─── Phase 8b: Register in HomeBase Fleet Registry (WS-385) ────────────────
//
// /adopt wrote .cwos-version + flipped onboarding's `fleet_registered: true`,
// but never wrote back to HomeBase's fleet/registry.yaml — so an adopted repo
// was invisible to /fleet-status, /fleet-update, etc. until a hand-edit. This
// phase closes that gap deterministically: a path-keyed UPSERT against the
// --homebase registry. Re-adoption updates the existing entry (no duplicate).
// A probable RELOCATION (same name, but the recorded path is gone from disk) is
// left for the founder-prompted resolution in adopt.md Step 7a — we warn rather
// than append a duplicate. kit_version + maturity are omitted per WS-406 (both
// deprecated; the authoritative source is each repo's .cwos-version).
//
// Skipped under --no-fleet-register (tests, sandboxes) and --dry-run so a run
// against a throwaway target never mutates the real registry.
function registerInFleet(config, state) {
  if (config.noFleetRegister || config.dryRun) return;

  // Never register HomeBase into its own fleet.
  if (toForwardSlash(config.target).toLowerCase() === toForwardSlash(config.homebase).toLowerCase()) {
    return;
  }

  const registryPath = path.join(config.homebase, 'fleet', 'registry.yaml');
  if (!fs.existsSync(registryPath)) {
    state.warnings.push(`fleet/registry.yaml not found at ${toForwardSlash(registryPath)} — repo not auto-registered`);
    return;
  }

  const parsed = readYAMLFile(registryPath);
  if (!parsed.ok) {
    state.warnings.push(`fleet/registry.yaml did not parse — repo not auto-registered (fix the file, then re-run /adopt --repair)`);
    return;
  }
  const repos = (parsed.data && parsed.data.repos) || [];
  const registryText = fs.readFileSync(registryPath, 'utf8');

  const result = upsertFleetEntry(registryText, repos, config);
  if (result.warning) state.warnings.push(result.warning);
  if (result.action === 'skipped-relocation' || result.action === 'noop') return;

  writeFileAtomic(registryPath, result.text);
  emitEvent('T0:envelope', 'fleet-registered', {
    phase: 'register-in-fleet',
    name: config.repoName,
    path: toForwardSlash(config.target),
    action: result.action, // 'created' | 'updated'
    capabilities: [...config.enabledCapabilities],
  });
  state.installLog.push({
    source: '(generated)',
    destination: 'fleet/registry.yaml',
    action: `fleet-${result.action}`,
    merge_strategy: 'fleet-registry',
    hash: sha256(result.text),
  });
}

// Render a clean, modern registry entry block (no deprecated kit_version/maturity).
function renderFleetEntry(config, registeredAt, adoptedAt) {
  const caps = [...config.enabledCapabilities];
  return [
    `  - name: ${formatScalar(config.repoName)}`,
    `    path: "${toForwardSlash(config.target)}"`,
    `    type: ${config.archetype}`,
    `    capabilities_enabled: [${caps.join(', ')}]`,
    `    registered_at: "${registeredAt}"`,
    `    adopted_at: "${adoptedAt}"`,
  ].join('\n');
}

// Pure, testable upsert. Returns { text, action, warning }.
//   action: 'created' (appended) | 'updated' (path matched) |
//           'skipped-relocation' (probable move — defer to Step 7a) | 'noop'
// Edits the registry as TEXT to preserve its header + inline comments; a
// parseYAML→serializeYAML round-trip would erase them.
function upsertFleetEntry(registryText, repos, config) {
  const targetKey = toForwardSlash(config.target).toLowerCase();
  const lines = registryText.split(/\r?\n/);

  // Top-level list items under `repos:` start with exactly "  - " (2-space indent).
  const startIdxs = [];
  for (let i = 0; i < lines.length; i++) if (/^  - /.test(lines[i])) startIdxs.push(i);
  const spans = startIdxs.map((s, k) => ({ start: s, end: k + 1 < startIdxs.length ? startIdxs[k + 1] : lines.length }));

  // ── Path match → update in place (capabilities_enabled + type only) ──
  for (const sp of spans) {
    const block = lines.slice(sp.start, sp.end).join('\n');
    const pm = block.match(/path:\s*["']?([^"'\n]+)["']?/);
    if (!pm) continue;
    if (toForwardSlash(pm[1].trim()).toLowerCase() !== targetKey) continue;

    const caps = [...config.enabledCapabilities];
    let sawCaps = false, typeLineIdx = -1;
    for (let i = sp.start; i < sp.end; i++) {
      if (/^    type:/.test(lines[i])) { lines[i] = `    type: ${config.archetype}`; typeLineIdx = i; }
      if (/^    capabilities_enabled:/.test(lines[i])) { lines[i] = `    capabilities_enabled: [${caps.join(', ')}]`; sawCaps = true; }
    }
    if (!sawCaps && typeLineIdx !== -1) {
      lines.splice(typeLineIdx + 1, 0, `    capabilities_enabled: [${caps.join(', ')}]`);
    }
    return { text: lines.join('\n'), action: 'updated' };
  }

  // ── No path match: guard against a relocation duplicate ──
  const nameMatch = repos.find(r => r && r.name && String(r.name).toLowerCase() === config.repoName.toLowerCase());
  if (nameMatch && nameMatch.path) {
    let onDisk = true;
    try { onDisk = fs.existsSync(nameMatch.path); } catch { onDisk = true; }
    if (!onDisk) {
      return {
        text: registryText, action: 'skipped-relocation',
        warning: `A fleet entry "${nameMatch.name}" points at ${toForwardSlash(nameMatch.path)}, which is missing on disk — this looks like a relocation, not a new repo. Resolve with: node kit/scripts/cwos-fleet-relocate.js "${nameMatch.name}" "${toForwardSlash(config.target)}" (adopt.md Step 7a). Skipped auto-append to avoid a duplicate.`,
      };
    }
  }

  // ── Append a new entry ──
  const registeredAt = config.timestamp.slice(0, 10); // YYYY-MM-DD
  const entry = renderFleetEntry(config, registeredAt, config.timestamp);
  let text = registryText;
  if (!text.endsWith('\n')) text += '\n';
  text += entry + '\n';
  return { text, action: 'created' };
}

// ─── Phase repair-summary: Human-Readable Repair Report (WS-384) ───────────
//
// The JSON bundle (emitManifestBundle) is the machine surface; this writes a
// concise human summary to stderr so it never corrupts the stdout bundle. The
// WS-375 readiness gate (cwos-verify-install.js) does not exist yet, so repair
// recommends /audit as the post-repair verification step.
function reportRepairSummary(config, state) {
  const counts = {};
  for (const e of state.installLog) counts[e.action] = (counts[e.action] || 0) + 1;
  const n = a => counts[a] || 0;
  const lines = [];
  lines.push(`\n/adopt --repair${config.dryRun ? ' --dry-run' : ''} — ${config.repoName}`);
  lines.push(`  re-provisioned (missing): ${n('repaired-missing')}`);
  lines.push(`  restored (corrupt):       ${n('repaired-corrupt')}`);
  lines.push(`  overwritten (--force):    ${n('repaired-forced')}`);
  lines.push(`  preserved (customized):   ${n('customized')}`);
  lines.push(`  unchanged (healthy):      ${n('unchanged')}`);
  if (state.needsReview.length) {
    lines.push(`\n  Needs review — your edits were kept; current kit version is in <file>.kit-update:`);
    for (const f of state.needsReview) lines.push(`    - ${f}`);
    lines.push(`  Reconcile each, then delete the .kit-update sidecar. Or re-run with --force to take kit's version (a .pre-repair backup is saved).`);
  }
  if (config.dryRun) {
    lines.push(`\n  Dry run — no files were written. Re-run without --dry-run to apply.`);
  } else {
    lines.push(`\n  Next: run /audit to confirm the repair restored a healthy install.`);
  }
  process.stderr.write(lines.join('\n') + '\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const startMs = Date.now();

  // Phase 0: Parse CLI
  const config = parseCLI();

  // State accumulator
  const state = {
    errors: [],
    warnings: [],
    installLog: [],
    deferredFiles: [],
    pathRewrites: [],
    migrations: [],
    directoriesCreated: [],
    checksumMap: {},
    parallelGovernance: [],
    governanceSeeded: [],
    needsReview: [],
  };

  // Phase 1: Load manifest
  const manifestEntries = loadManifest(config.homebase);

  // Phase 2: Filter by capability (ADR-016)
  const { m1Files, deferredFiles } = filterByCapabilities(manifestEntries, config.enabledCapabilities, config.archetypeBundle);
  state.deferredFiles = deferredFiles;

  // ── WS-384: --repair runs a distinct, narrower phase set ──
  // Repair heals an existing install rather than performing a fresh copy. It
  // diff-repairs every installed file (repairInstalledFiles) and re-runs only
  // the idempotent provisioning phases (dirs, evidence, registries). It does
  // NOT re-run the preamble rewrite, legacy migration, governance seeding, or
  // milestone flips — those are first-adoption concerns, not corruption-healing.
  if (config.repair) {
    ensureDirectories(config.target, config.systemDir, config.enabledCapabilities, config.dryRun, state);
    repairInstalledFiles(config, config.homebase, m1Files, deferredFiles, state);
    provisionEvidenceDirs(config, state);
    materializeProgramsRegistry(config, state);
    materializeEnginesRegistry(config, state);
    writeVersionStamp(config, state); // re-stamp with healed installed_files hashes
    registerInFleet(config, state);   // WS-385: heal a missing fleet entry too
    reportRepairSummary(config, state);
    emitManifestBundle(startMs, config, state);
    return;
  }

  // Phase 2.5: Migrate legacy .cwos/scripts/ → kit/scripts/ (kit-v3.6.0 one-time)
  migrateLegacyScriptsPath(config, state);

  // Phase 3: Install M1 files
  ensureDirectories(config.target, config.systemDir, config.enabledCapabilities, config.dryRun, state);
  installPreamble(config, config.homebase, state);
  copyM1Files(config, config.homebase, m1Files, state);
  // Phase 3.5: Install deferred files for enabled capabilities.
  // Without this phase, /adopt --capabilities core,workstream,engines installs
  // only the M1 minimum while updateMilestones flips `installed: true` for
  // workstream+engines anyway — silent partial install. See FIND-silent-deferred.
  copyDeferredFiles(config, config.homebase, deferredFiles, state);
  instantiateYAMLTemplates(config, state);

  // Phase 3b: Patch program scope patterns for archetype
  patchProgramScopes(config, state);

  // Phase 3c (WS-372 / FIND-240): provision evidence_dir for each installed program.
  // Without these, /pulse run fails ENOENT and AS-23 swallows → silent inoperative.
  provisionEvidenceDirs(config, state);

  // Phase 3c2: Assert bootstrap health is 0/0 per DEC-023
  assertBootstrapHealth(config, state);

  // Phase 3d: Materialize programs/registry.yaml from the installed prog-*.yaml files.
  // Until kit-v3.6.1 the registry stayed empty and /next blocked sprints with
  // "no_programs_active" even when prog-*.yaml files were tier: critical.
  materializeProgramsRegistry(config, state);

  // Phase 3e: Materialize engines/registry.yaml from the installed command files.
  // Until kit-v3.7.0 the registry shipped with most engines commented out as
  // TODO; reconcile's protocol-engine-ref validator surfaced 18+ noisy warnings
  // per run referencing engines that were installed but not registered.
  materializeEnginesRegistry(config, state);

  // Phase 4: Write deferred manifest
  writeDeferredManifest(config, deferredFiles, state);

  // Phase 5: Rewrite path references
  rewritePathReferences(config, state);

  // Phase 6: Migrate legacy files
  migrateLegacy(config, state);

  // Phase 6b: Detect parallel governance structures (programs at non-CWOS paths)
  detectParallelGovernance(config, state);

  // Phase 6c: Seed system/decisions.md from docs/adr/ (deterministic governance seeding)
  seedGovernance(config, state);

  // Phase 7b: Update milestone status based on enabled capabilities.
  // Runs BEFORE the version stamp so the stamp's installed_files fingerprint
  // captures the post-milestone .cwos-onboarding.yaml — otherwise the milestone
  // flips would leave onboarding drifted from its own install record, and both
  // /adopt --repair and /kit-upgrade would misread it as a local modification.
  updateMilestones(config, state);

  // Phase 7: Write version stamp (last repo-file mutation before it = faithful fingerprint)
  writeVersionStamp(config, state);

  // Phase 8b: Register the repo in HomeBase's fleet/registry.yaml (WS-385)
  registerInFleet(config, state);

  // Phase 8: Emit manifest bundle
  emitManifestBundle(startMs, config, state);
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = { sha256, loadManifest, filterByCapabilities, LEVEL_NUM, patchProgramScopes, upsertFleetEntry };

// ─── Run ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  main();
}
