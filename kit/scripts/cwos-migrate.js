#!/usr/bin/env node
/**
 * cwos-migrate — Kit version migration script.
 *
 * Upgrades a repo from one CWOS kit version to another. Handles:
 * - File classification (stock vs customized via baseline hash comparison)
 * - Program schema migration (v2 → v3)
 * - Health score recalibration (0-100 → 0-10)
 * - Index rebuilds
 * - Hash tracking bootstrap
 *
 * Usage:
 *   node cwos-migrate.js <repo-path> [--dry-run] [--from 2.0] [--to 3.0]
 *   node cwos-migrate.js --state-schema [--workstream-dir <path>] [--dry-run]
 *     # WS-274: bring state/*.json schema_version up to current. Idempotent.
 */

'use strict';

require('./lib/preflight');

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  readYAMLFile, serializeYAML, writeFileAtomic, globFiles, todayISO
} = require('./lib/cwos-utils');
const { runGitInRepo, validateGitRef, validateRegistryPath } = require('./lib/shell-safe');
const { loadManifest, LEVEL_NUM } = require('./cwos-adopt-install');
const { capabilitiesForLevel } = require('./lib/capability-map');
const { ensureCapabilityDirs, expectedCapabilityDirs, enabledCapabilities } = require('./lib/cwos-kit-dirs');
const { corpusHash } = require('./lib/cwos-corpus-hash');

// 11 mutation sites across 5 logical phases (schema-migrate, file-update,
// index-rebuild, snapshot, version-stamp). Emit one phase event at the end
// of each phase function rather than per-mutation, per SPR-058 granularity.
const { makeEventEmitter } = require('./lib/cwos-utils');
const emitEvent = makeEventEmitter();

// ─── Constants ──────────────────────────────────────────────────────────────

const SCHEMA_MIGRATIONS = {
  '2→3': migrateSchemaV2ToV3,
  '3→4': migrateSchemaV3ToV4,
};

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let repoPath = null;
  let dryRun = false;
  let fromVersion = null;
  let toVersion = null;
  let homebaseOverride = null;
  let stateSchemaMode = false;
  let workstreamDirOverride = null;
  let trustVersionHomebase = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') { dryRun = true; }
    else if (args[i] === '--from' && args[i + 1]) { fromVersion = args[++i]; }
    else if (args[i] === '--to' && args[i + 1]) { toVersion = args[++i]; }
    else if (args[i] === '--homebase' && args[i + 1]) { homebaseOverride = args[++i]; }
    // WS-431: explicit confirmation that the operator trusts the .cwos-version
    // homebase_path field (Strategy 4). Required because the field lives inside
    // the adopted repo and may be attacker-influenced.
    else if (args[i] === '--trust-version-homebase') { trustVersionHomebase = true; }
    else if (args[i] === '--state-schema') { stateSchemaMode = true; }
    else if (args[i] === '--workstream-dir' && args[i + 1]) { workstreamDirOverride = args[++i]; }
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: cwos-migrate.js <repo-path> [--dry-run] [--homebase <path>] [--trust-version-homebase] [--from 2.0] [--to 3.0]');
      console.log('       cwos-migrate.js --state-schema [--workstream-dir <path>] [--dry-run]');
      process.exit(0);
    } else if (!repoPath) { repoPath = args[i]; }
  }

  // WS-274: state-schema mode bumps state/*.json schema_version + adds
  // last_event_log_head. Idempotent. Doesn't need a repo path — defaults
  // to findWorkstreamDir() against cwd.
  if (stateSchemaMode) {
    let stateStoreMod;
    try { stateStoreMod = require('./core/state-store'); }
    catch (err) {
      console.error(`cwos-migrate --state-schema: state-store module not present (${err.message})`);
      process.exit(1);
    }
    let wsDir = workstreamDirOverride;
    if (!wsDir) {
      const { findWorkstreamDir } = require('./lib/cwos-utils');
      try { wsDir = findWorkstreamDir(process.cwd()); }
      catch { console.error('cwos-migrate --state-schema: could not find .claude/workstream/'); process.exit(1); }
    }
    if (dryRun) {
      const { stateDir } = stateStoreMod;
      const dir = stateDir(wsDir);
      const fsLocal = require('fs');
      const pathLocal = require('path');
      const wouldMigrate = [];
      if (fsLocal.existsSync(dir)) {
        for (const name of stateStoreMod.DEFAULT_DOMAINS) {
          const file = pathLocal.join(dir, `${name}.json`);
          if (!fsLocal.existsSync(file)) continue;
          try {
            const data = JSON.parse(fsLocal.readFileSync(file, 'utf8'));
            const sv = typeof data.schema_version === 'number' ? data.schema_version : 1;
            if (sv < stateStoreMod.SCHEMA_VERSION) wouldMigrate.push({ domain: name, from: sv, to: stateStoreMod.SCHEMA_VERSION });
          } catch { /* skip parse errors */ }
        }
      }
      console.log(JSON.stringify({ dry_run: true, would_migrate: wouldMigrate }, null, 2));
      process.exit(0);
    }
    const result = stateStoreMod.migrateStateSchema(wsDir, stateStoreMod.SCHEMA_VERSION);
    console.log(JSON.stringify(result, null, 2));
    if (result.migrated.length > 0) {
      emitEvent('T6:workstream', 'state-schema-migrated', {
        type: 'state-schema-migrated',
        migrated: result.migrated,
        to_version: stateStoreMod.SCHEMA_VERSION,
      });
    }
    process.exit(0);
  }

  if (!repoPath) {
    console.error('ERROR: Repo path required.');
    console.error('Usage: cwos-migrate.js <repo-path> [--dry-run] [--homebase <path>]');
    process.exit(1);
  }

  // Find HomeBase using multiple strategies (trusted first, untrusted last):
  // 1. --homebase CLI flag
  // 2. Walk up from CWD (works when run from HomeBase)
  // 3. Script's own location (it lives in HomeBase/kit/scripts/)
  // 3.5. CWOS_HOMEBASE env var
  // 4. homebase_path from the repo's .cwos-version (WS-431: gated — requires
  //     --trust-version-homebase AND a corpus_version match)
  const homebasePath = resolveHomeBase(homebaseOverride, repoPath, { trustVersionHomebase });
  if (!homebasePath) {
    console.error('ERROR: Could not find HomeBase root.');
    console.error('Specify it explicitly: --homebase "C:/Users/chris/Claude HomeBase"');
    console.error('Or run this script from within the HomeBase directory.');
    console.error('(If a homebase_path is recorded in .cwos-version but was rejected, see the');
    console.error(' WS-431 guidance above — re-run with --homebase, or --trust-version-homebase');
    console.error(' only if you have verified the recorded path is your real HomeBase.)');
    process.exit(1);
  }

  // ADR-043 / WS-306: validate paths at the data boundary before any
  // shell-out (git show, etc.) reaches them.
  try { validateRegistryPath(homebasePath); }
  catch (err) {
    console.error(`ERROR: invalid homebase path: ${err.message}`);
    process.exit(2);
  }

  repoPath = path.resolve(repoPath);
  try { validateRegistryPath(repoPath); }
  catch (err) {
    console.error(`ERROR: invalid repo path: ${err.message}`);
    process.exit(2);
  }
  if (!fs.existsSync(repoPath)) {
    console.error(`ERROR: Repo path does not exist: ${repoPath}`);
    process.exit(1);
  }

  // Read current kit version
  if (!toVersion) {
    try { toVersion = fs.readFileSync(path.join(homebasePath, 'kit', 'VERSION'), 'utf8').trim(); } catch {
      console.error('ERROR: Could not read kit/VERSION'); process.exit(1);
    }
  }

  // Detect state
  const state = detectState(repoPath, homebasePath, fromVersion);
  if (!state.cwosInstalled) {
    console.error('ERROR: No .cwos-version found. Use /adopt for fresh installation.');
    process.exit(1);
  }

  if (!fromVersion) fromVersion = state.version;
  const repoName = path.basename(repoPath);

  console.log(`\nMigration Plan: ${repoName} (v${fromVersion} → v${toVersion})`);
  console.log('\u2500'.repeat(50));

  // Phase 2: Classify files
  const classification = classifyFiles(repoPath, homebasePath, fromVersion);
  printClassification(classification);

  // Phase 3: Program schema analysis
  const programMigrations = analyzePrograms(repoPath, fromVersion);
  printProgramAnalysis(programMigrations);

  // Phase 4a: Duplicate program detection
  const existingPrograms = buildProgramIdMap(repoPath);
  const duplicates = detectProgramDuplicates(classification, existingPrograms, homebasePath);
  if (duplicates.length > 0) {
    console.log(`\nProgram duplicates detected (will be skipped):`);
    for (const d of duplicates) {
      console.log(`  ${d.template} → duplicates ${d.existing} (${d.reason})`);
    }
  }

  // Phase 5: Index analysis
  const indexStatus = analyzeIndexes(repoPath);
  printIndexAnalysis(indexStatus);

  // Summary
  const totalChanges = classification.stock.length + classification.new.length +
    classification.needsInstall.length + classification.customized.length;
  console.log(`\nEstimated changes: ${totalChanges} files, ${programMigrations.length} programs migrated, ` +
    `${classification.customized.length} .kit-update files created`);

  if (dryRun) {
    // WS-403: preview which procedural dirs the apply phase would backfill.
    const wouldBackfill = ensureCapabilityDirs(repoPath, { dryRun: true });
    if (wouldBackfill.created.length > 0) {
      console.log(`\nWould backfill ${wouldBackfill.created.length} missing dir(s): ${wouldBackfill.created.join(', ')}`);
    }
    console.log('\nDry run complete. No files were modified.');
    return;
  }

  // Execute migration
  console.log('\nExecuting migration...\n');

  // Create snapshot
  const snapshotDir = createSnapshot(repoPath, classification, programMigrations);
  console.log(`  Snapshot: ${path.relative(repoPath, snapshotDir)}`);

  // Migrate programs
  for (const prog of programMigrations) {
    migrateSchemaV2ToV3(prog.path, prog.data);
    console.log(`  Migrated: ${path.basename(prog.path)} (schema ${prog.data.schema_version || 2} → 3)`);
  }

  // Update files
  updateFiles(repoPath, homebasePath, classification);
  console.log(`  Files: ${classification.stock.length} overwritten, ${classification.new.length + classification.needsInstall.length} installed, ${classification.customized.length} .kit-update created`);

  // WS-403: backfill procedural directory sets (WORKSTREAM_SUBDIRS +
  // DOCS_EVOLUTION_SUBDIRS) the upgrade path would otherwise skip. Runs AFTER
  // updateFiles so a freshly re-installed .cwos-onboarding.yaml is on disk, but
  // capability detection unions on-disk evidence so a re-templated (all
  // `unconfigured`) onboarding file can't suppress the backfill.
  const dirBackfill = ensureCapabilityDirs(repoPath);
  if (dirBackfill.created.length > 0) {
    console.log(`  Dirs: ${dirBackfill.created.length} backfilled (${dirBackfill.created.join(', ')})`);
    emitEvent('T0:envelope', 'migration-dirs-backfilled', {
      phase: 'file-update',
      path: path.relative(process.cwd(), repoPath).replace(/\\/g, '/'),
      created: dirBackfill.created,
    });
  }

  // Rebuild indexes
  rebuildIndexes(repoPath);
  console.log('  Indexes: queue-index.yaml and findings-index.yaml rebuilt');

  // Update version stamp
  const checksumMap = bootstrapHashes(repoPath, homebasePath, classification);
  updateVersionStamp(repoPath, toVersion, checksumMap);
  console.log(`  Version: ${fromVersion} → ${toVersion} (hash tracking bootstrapped)`);

  console.log('\n\u2500'.repeat(50));
  console.log('Migration complete.');

  if (classification.customized.length > 0) {
    console.log('\nAction required — merge these .kit-update files:');
    for (const f of classification.customized) {
      console.log(`  ${f.destination}.kit-update`);
    }
  }
}

// ─── Phase 1: Detect State ─────────────────────────────────────────────────

function detectState(repoPath, homebasePath, fromVersion) {
  const versionPath = path.join(repoPath, '.cwos-version');
  if (!fs.existsSync(versionPath)) {
    return { cwosInstalled: false };
  }

  const { ok, data } = readYAMLFile(versionPath);
  if (!ok) return { cwosInstalled: false };

  return {
    cwosInstalled: true,
    version: data.kit_version_at_install || data.version || fromVersion || 'unknown',
    level: data.level || 'L1',
    installedFiles: data.installed_files || {},
    adoptedAt: data.adopted_at,
  };
}

// ─── Phase 2: Classify Files ───────────────────────────────────────────────

function classifyFiles(repoPath, homebasePath, fromVersion) {
  const result = { stock: [], customized: [], new: [], needsInstall: [] };

  const { ok, data: manifest } = readYAMLFile(path.join(homebasePath, 'kit', 'MANIFEST.yaml'));
  if (!ok || !manifest.files) {
    console.error('WARN: Could not read MANIFEST.yaml — skipping file classification');
    return result;
  }

  const tagName = `kit-v${fromVersion}`;

  for (const entry of manifest.files) {
    // Skip homebase-only files
    if (entry.homebase_only) continue;

    const destPath = path.join(repoPath, entry.destination);
    const srcRelative = entry.source;

    // Check if file exists in repo
    if (!fs.existsSync(destPath)) {
      // Does it exist in the old version?
      const baselineExists = getBaselineContent(homebasePath, srcRelative, tagName) !== null;
      if (baselineExists) {
        result.needsInstall.push(entry);
      } else {
        result.new.push(entry);
      }
      continue;
    }

    // File exists — check if customized
    const currentContent = fs.readFileSync(destPath, 'utf8');

    // Get baseline (what was installed at the old version)
    const baselineContent = getBaselineContent(homebasePath, srcRelative, tagName);

    if (baselineContent === null) {
      // File didn't exist at the old version — it's new in target version
      // But repo has it somehow (maybe manually added). Treat as customized.
      result.customized.push(entry);
      continue;
    }

    // EOL-normalize the comparison. On Windows the working tree / installed
    // files are CRLF (core.autocrlf=true) while `git show` returns the LF blob,
    // so a raw byte hash marks EVERY file as customized — which would silently
    // turn every upgrade into an all-.kit-update no-op. An EOL-only difference
    // is not a customization.
    const norm = s => s.replace(/\r\n/g, '\n');
    if (sha256(norm(currentContent)) === sha256(norm(baselineContent))) {
      result.stock.push(entry);     // unchanged from baseline — safe to overwrite
    } else {
      result.customized.push(entry); // genuinely customized
    }
  }

  return result;
}

function getBaselineContent(homebasePath, sourcePath, tagName) {
  try {
    validateGitRef(tagName);
    const r = runGitInRepo(homebasePath, ['show', `${tagName}:${sourcePath}`], { timeout: 5000 });
    return r.ok ? r.stdout : null;
  } catch {
    return null;
  }
}

function sha256(content) {
  return 'sha256:' + crypto.createHash('sha256').update(content).digest('hex');
}

// ─── Phase 3: Program Schema Analysis ──────────────────────────────────────

function analyzePrograms(repoPath, fromVersion) {
  const progsDir = path.join(repoPath, '.claude', 'workstream', 'programs');
  if (!fs.existsSync(progsDir)) return [];

  const progFiles = globFiles(progsDir, 'prog-*.yaml')
    .filter(f => !f.endsWith('registry.yaml'));
  const migrations = [];

  for (const filePath of progFiles) {
    const { ok, data } = readYAMLFile(filePath);
    if (!ok || !data.id) continue;

    const schemaVersion = data.schema_version || 1;
    if (schemaVersion < 3) {
      migrations.push({ path: filePath, data, schemaVersion });
    }
  }

  return migrations;
}

// ─── Program Schema v2 → v3 Migration ──────────────────────────────────────

function migrateSchemaV2ToV3(filePath, prog) {
  const today = todayISO();

  // Read the raw content for patching
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Update schema_version
  content = content.replace(/^schema_version:\s*\d+/m, 'schema_version: 3');
  if (!/^schema_version:/m.test(content)) {
    content = content.replace(/^(status:\s*.*)$/m, `schema_version: 3\n$1`);
  }

  // 2. Rename description → contract (if description exists and contract doesn't)
  if (prog.description && !prog.contract) {
    content = content.replace(/^description:\s*>?\s*$/m, 'contract: >');
    content = content.replace(/^description:\s*"/, 'contract: "');
    content = content.replace(/^description:\s*([^\n>"])/, 'contract: $1');
  }

  // 3. Add tier (if missing)
  if (!prog.tier) {
    const tier = inferTier(prog);
    const insertAfter = /^status:\s*.*$/m;
    content = content.replace(insertAfter, `$&\ntier: ${tier}`);
  }

  // 4. Reset health_score to 0 on migration.
  //    Per DEC-023, health is computed from rigor-based formula — not preserved
  //    from v2 where scores were manually assigned estimates. The SYN adoption
  //    surfaced that inflated v2 scores (94-98) became inflated v3 scores (9-10),
  //    which gave false confidence. Migration now resets to 0 and requires a
  //    real /pulse run to re-earn the ceiling.
  if (prog.health_score !== undefined && prog.health_score !== 0) {
    content = content.replace(
      /^health_score:\s*\S+/m,
      `health_score: 0`
    );
  }

  // 5. Reset health_ceiling to 0 (or add if missing).
  //    v2 had no concept of rigor-based ceilings — any preserved value is
  //    unearned. Post-migration, /pulse run <id> baseline is what ratchets
  //    the ceiling off 0.
  if (prog.health_ceiling === undefined) {
    content = content.replace(
      /^(health_score:\s*\S+)/m,
      `$1\nhealth_ceiling: 0\nhealth_ceiling_reason: "Migrated from v2. Pre-v3 scores were manually assigned; reset to 0/0 per DEC-023. Run /pulse run <id> baseline to establish an earned score."`
    );
  } else if (prog.health_ceiling !== 0) {
    content = content.replace(
      /^health_ceiling:\s*\S+/m,
      `health_ceiling: 0`
    );
    content = content.replace(
      /^health_ceiling_reason:\s*.*$/m,
      `health_ceiling_reason: "Migrated from v2. Pre-v3 ceiling was not rigor-earned; reset to 0 per DEC-023. Run /pulse run <id> baseline to establish an earned ceiling."`
    );
  }

  // 6. Add health_updated_at (if missing)
  if (!prog.health_updated_at) {
    content = content.replace(
      /^(findings_open:\s*\d+)/m,
      `health_updated_at: "${today}"\n$1`
    );
  }

  // 7. Map last_run → last_run_by_protocol (if old format exists)
  if (prog.last_run && !prog.last_run_by_protocol) {
    const lr = prog.last_run;
    const lastRunBlock = [
      'last_run_by_protocol:',
      '  baseline:',
      `    date: "${lr.date || 'null'}"`,
      `    engine: ${lr.engine || 'null'}`,
      `    run_id: "${lr.run_id || 'null'}"`,
      `    result: "${(lr.result || '').replace(/"/g, "'")}"`,
      '  delta: { date: null, engine: null, run_id: null, result: null }',
      '  sweep: { date: null, engine: null, run_id: null, result: null }',
      '  challenge: { date: null, engine: null, run_id: null, result: null }',
      '  blind_spot: { date: null, engine: null, run_id: null, result: null }',
    ].join('\n');

    // Replace old last_run block
    content = content.replace(
      /^last_run:\s*\n(\s+\S.*\n)*/m,
      lastRunBlock + '\n'
    );
  }

  // 8. Rename audit_history → protocol_history (in evidence section)
  content = content.replace(/audit_history:/g, 'protocol_history:');

  // 9. Map engines + cadence → protocols (if old format)
  if (prog.engines && prog.cadence && !prog.protocols) {
    const protocols = mapProtocols(prog.engines, prog.cadence);
    // Insert protocols block after tier
    const protocolsBlock = serializeProtocols(protocols);
    content = content.replace(
      /^(tier:\s*\w+)/m,
      `$1\n\n${protocolsBlock}`
    );
  }

  // 10. Map auto_generate → accountability (if old format)
  if (prog.auto_generate && !prog.accountability) {
    const accountability = mapAccountability(prog.auto_generate);
    const accountBlock = serializeAccountability(accountability);
    // Insert before interconnections
    content = content.replace(
      /^(interconnections:)/m,
      `${accountBlock}\n\n$1`
    );
  }

  // Write back
  fs.writeFileSync(filePath, content, 'utf8');
  emitEvent('T12:program-management', 'program-schema-migrated', {
    phase: 'schema-migrate',
    path: path.relative(process.cwd(), filePath).replace(/\\/g, '/'),
    from: 'v2', to: 'v3',
  });
}

// ─── Program Schema v3 → v4 Migration ──────────────────────────────────────
//
// v4 adds the `assumptions:` (AS-N) and `market_dynamics:` blocks, REQUIRED at
// tier active|critical per framework-spec §5.2. A migrator cannot invent a
// program's load-bearing assumptions or market posture, so for active/critical
// programs lacking them we append the template's COMMENTED guidance blocks —
// present as a visible TODO, never as fabricated (and validator-failing) data.
// dormant/watch programs only get the version bump. Idempotent: a program
// already at schema_version >= 4 is returned untouched (returns false).
function migrateSchemaV3ToV4(filePath, prog) {
  if ((prog && Number(prog.schema_version)) >= 4) return false;
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Bump schema_version → 4
  if (/^schema_version:\s*\d+/m.test(content)) {
    content = content.replace(/^schema_version:\s*\d+/m, 'schema_version: 4');
  } else {
    content = content.replace(/^(status:\s*.*)$/m, `schema_version: 4\n$1`);
  }

  // 2. active|critical programs missing the v4 blocks get commented guidance.
  const tier = (prog && prog.tier ? String(prog.tier) : 'dormant').trim();
  const needsBlocks = tier === 'active' || tier === 'critical';
  const hasAssumptions = /^#?\s*assumptions:/m.test(content);
  const hasMarket = /^#?\s*market_dynamics:/m.test(content);

  if (needsBlocks && !(hasAssumptions && hasMarket)) {
    const block = [
      '',
      '# --- Load-Bearing Assumptions (AS-N) — REQUIRED at tier active|critical (schema v4) ---',
      '# Migrated from v3: this program is active/critical but shipped no assumptions.',
      '# Fill in >=1 falsifiable AS-N. Validator: node kit/scripts/cwos-asn-validate.js --program <this-file>',
      '# assumptions:',
      '#   - id: AS-NN                  # integer, HomeBase-wide unique',
      '#     type: strategic            # empirical | strategic | methodological',
      '#     claim: >',
      '#       One sentence. Subject + specific claim. No hedging. >=20 chars.',
      '#     falsifies_if:',
      '#       watch_surfaces: ["https://example.com/surface"]',
      '#       trigger_event: "Specific observable event that falsifies the claim. >=20 chars."',
      '#     revisit: <ISO-date or trigger string>',
      '#     status: proposed',
      '#',
      '# --- Market Dynamics Assessment — REQUIRED at tier active|critical (schema v4) ---',
      '# market_dynamics:',
      '#   subsumption_risk: insufficient-data   # low | medium | high | insufficient-data',
      '#   self_preference: insufficient-data    # ours | would_switch_to:<tool> | insufficient-data',
      '#   durable_ground: >',
      '#     One sentence on what remains defensible and why. >=20 chars.',
      '#   watch_surfaces: ["https://docs.anthropic.com/en/docs/claude-code"]',
      '#   trigger_event: "Specific observable that would flip the assessment. >=20 chars."',
      `#   last_reviewed: ${todayISO()}`,
      '',
    ].join('\n');
    content = content.replace(/\s*$/, '\n') + block;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  emitEvent('T12:program-management', 'program-schema-migrated', {
    phase: 'schema-migrate',
    path: path.relative(process.cwd(), filePath).replace(/\\/g, '/'),
    from: 'v3', to: 'v4',
  });
  return true;
}

function inferTier(prog) {
  const score = prog.health_score || 0;
  const blocks = (prog.interconnections && prog.interconnections.blocks) || [];
  if (blocks.length > 0 || score >= 95) return 'critical';
  if (score >= 50) return 'active';
  return 'watch';
}

function mapProtocols(engines, cadence) {
  const primary = engines.primary || [];
  const supplementary = engines.supplementary || [];
  return {
    baseline: {
      engine: primary[0] || 'eng-engine',
      focus: 'Full program audit',
      problem_classes: 'all',
    },
    delta: {
      engine: supplementary[0] || 'preflight',
      cadence_days: cadence.delta_check_days || 7,
      focus: 'Recent changes',
      min_tier: 'watch',
    },
    sweep: {
      engine: primary[0] || 'eng-engine',
      cadence_days: cadence.full_audit_days || 14,
      focus: 'Comprehensive review',
      min_tier: 'active',
    },
    challenge: {
      engine: 'eng-engine',
      cadence_days: 30,
      focus: 'Adversarial review',
      min_tier: 'active',
    },
    blind_spot: {
      engine: 'eng-engine',
      cadence_days: 60,
      focus: 'What are we missing?',
      min_tier: 'critical',
    },
  };
}

function mapAccountability(autoGen) {
  return {
    on_finding: {
      action: 'create_work_item',
      max_open_items: autoGen.max_open_items || 3,
      priority_floor: autoGen.item_template ? autoGen.item_template.priority_base || 18 : 18,
      escalation: {
        stale_days: 14,
        escalate_to: 'session_start',
        escalate_priority_bump: 9,
      },
    },
    on_stale: {
      action: 'create_work_item',
      message: 'Program has not been checked in {days} days.',
      block_sprint: false,
    },
    on_tier_change: {
      action: 'notify_founder',
      auto_escalate: true,
      auto_deescalate: false,
    },
  };
}

function serializeProtocols(protocols) {
  const lines = ['protocols:'];
  for (const [name, proto] of Object.entries(protocols)) {
    lines.push(`  ${name}:`);
    for (const [key, val] of Object.entries(proto)) {
      lines.push(`    ${key}: ${JSON.stringify(val).replace(/"/g, '')}`);
    }
  }
  return lines.join('\n');
}

// ─── Program Duplicate Detection ────────────────────────────────────────────

// Domain keywords that map different filenames to the same program domain
const PROGRAM_DOMAIN_MAP = {
  'financial': ['financial', 'finance', 'money', 'payment'],
  'security': ['security', 'auth', 'access'],
  'infrastructure': ['infrastructure', 'infra', 'devops', 'deploy'],
  'change-management': ['change-management', 'change-mgmt', 'change'],
  'data-quality': ['data-quality', 'data'],
  'compliance': ['compliance', 'regulatory'],
  'engineering': ['engineering', 'eng', 'code-quality'],
  'ux': ['ux', 'ui', 'frontend', 'user-experience'],
  'launch': ['launch', 'release', 'go-live'],
  'vendor': ['vendor', 'vendor-risk', 'third-party'],
  'marketing': ['marketing', 'brand', 'growth'],
};

function buildProgramIdMap(repoPath) {
  const progsDir = path.join(repoPath, '.claude', 'workstream', 'programs');
  if (!fs.existsSync(progsDir)) return new Map();

  const map = new Map(); // id | slug | name → { id, name, file }
  const progFiles = globFiles(progsDir, 'prog-*.yaml')
    .filter(f => !f.endsWith('registry.yaml'));

  for (const filePath of progFiles) {
    const { ok, data } = readYAMLFile(filePath);
    if (!ok) continue;
    const id = data.id || '';
    const name = (data.name || '').toLowerCase();
    const file = path.basename(filePath);
    const entry = { id, name, file };

    // Index by id (only if non-empty — empty ids would collide across programs)
    if (id) map.set(id, entry);
    // Index by filename slug
    const slug = file.replace('prog-', '').replace('.yaml', '');
    map.set(slug, entry);
    // Index by normalized name (for name-based matching when ids diverge)
    if (name) map.set(`name:${name}`, entry);
  }

  return map;
}

function isProgramFile(destination) {
  return destination.includes('programs/prog-') && destination.endsWith('.yaml')
    && !destination.endsWith('registry.yaml') && !destination.endsWith('prog-template.yaml');
}

function checkProgramDuplicate(srcPath, existingPrograms) {
  // Extract domain from template filename
  const basename = path.basename(srcPath);
  const templateSlug = basename.replace('prog-', '').replace('.yaml', '');

  // Direct match by slug
  if (existingPrograms.has(templateSlug)) {
    return existingPrograms.get(templateSlug);
  }

  // Check domain keyword aliases
  for (const [domain, aliases] of Object.entries(PROGRAM_DOMAIN_MAP)) {
    if (aliases.includes(templateSlug)) {
      // Check if any alias matches an existing program
      for (const alias of aliases) {
        if (existingPrograms.has(alias)) {
          return existingPrograms.get(alias);
        }
      }
    }
  }

  // Check by reading the template's ID and name fields
  const { ok, data } = readYAMLFile(srcPath);
  if (ok) {
    // Match by ID
    if (data.id) {
      const templateId = data.id;
      for (const [, prog] of existingPrograms) {
        if (prog.id && prog.id === templateId) return prog;
      }
    }
    // Match by normalized name (catches cases where slugs and ids diverge)
    if (data.name) {
      const nameKey = `name:${data.name.toLowerCase()}`;
      if (existingPrograms.has(nameKey)) return existingPrograms.get(nameKey);
    }
  }

  return null;
}

function detectProgramDuplicates(classification, existingPrograms, homebasePath) {
  const duplicates = [];
  for (const entry of [...classification.new, ...classification.needsInstall]) {
    if (!isProgramFile(entry.destination)) continue;
    const basename = path.basename(entry.destination);
    const templateSlug = basename.replace('prog-', '').replace('.yaml', '');
    const srcFullPath = homebasePath ? path.join(homebasePath, entry.source) : entry.source;

    // Direct slug match
    if (existingPrograms.has(templateSlug)) {
      const existing = existingPrograms.get(templateSlug);
      duplicates.push({ template: basename, existing: existing.file, reason: 'same slug' });
      continue;
    }

    // Domain alias match
    let aliasMatched = false;
    for (const [, aliases] of Object.entries(PROGRAM_DOMAIN_MAP)) {
      if (aliases.includes(templateSlug)) {
        for (const alias of aliases) {
          if (alias !== templateSlug && existingPrograms.has(alias)) {
            duplicates.push({ template: basename, existing: existingPrograms.get(alias).file, reason: `alias: ${alias}` });
            aliasMatched = true;
            break;
          }
        }
        if (aliasMatched) break;
      }
    }
    if (aliasMatched) continue;

    // ID / name match by reading the template file (same logic as checkProgramDuplicate)
    if (homebasePath && fs.existsSync(srcFullPath)) {
      const { ok, data } = readYAMLFile(srcFullPath);
      if (ok) {
        if (data.id) {
          for (const [, prog] of existingPrograms) {
            if (prog.id && prog.id === data.id) {
              duplicates.push({ template: basename, existing: prog.file, reason: `same id: ${data.id}` });
              break;
            }
          }
        }
        if (data.name) {
          const nameKey = `name:${data.name.toLowerCase()}`;
          if (existingPrograms.has(nameKey)) {
            const existing = existingPrograms.get(nameKey);
            if (!duplicates.find(d => d.template === basename)) {
              duplicates.push({ template: basename, existing: existing.file, reason: `same name: ${data.name}` });
            }
          }
        }
      }
    }
  }
  return duplicates;
}

function serializeAccountability(acc) {
  const lines = ['accountability:'];
  lines.push('  on_finding:');
  lines.push(`    action: create_work_item`);
  lines.push(`    max_open_items: ${acc.on_finding.max_open_items}`);
  lines.push(`    priority_floor: ${acc.on_finding.priority_floor}`);
  lines.push('    escalation:');
  lines.push(`      stale_days: ${acc.on_finding.escalation.stale_days}`);
  lines.push(`      escalate_to: ${acc.on_finding.escalation.escalate_to}`);
  lines.push(`      escalate_priority_bump: ${acc.on_finding.escalation.escalate_priority_bump}`);
  lines.push('  on_stale:');
  lines.push(`    action: create_work_item`);
  lines.push(`    message: "${acc.on_stale.message}"`);
  lines.push(`    block_sprint: ${acc.on_stale.block_sprint}`);
  lines.push('  on_tier_change:');
  lines.push(`    action: notify_founder`);
  lines.push(`    auto_escalate: ${acc.on_tier_change.auto_escalate}`);
  lines.push(`    auto_deescalate: ${acc.on_tier_change.auto_deescalate}`);
  return lines.join('\n');
}

// ─── Phase 4: File Updates ─────────────────────────────────────────────────

function updateFiles(repoPath, homebasePath, classification) {
  // Build existing program ID map for duplicate detection
  const existingPrograms = buildProgramIdMap(repoPath);

  // Stock files: overwrite
  for (const entry of classification.stock) {
    const src = path.join(homebasePath, entry.source);
    const dest = path.join(repoPath, entry.destination);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }

  // New and needs-install files: install fresh (with program duplicate check)
  for (const entry of [...classification.new, ...classification.needsInstall]) {
    const src = path.join(homebasePath, entry.source);
    const dest = path.join(repoPath, entry.destination);
    if (!fs.existsSync(src)) continue;

    // Skip program templates that duplicate an existing program
    if (isProgramFile(entry.destination)) {
      const duplicate = checkProgramDuplicate(src, existingPrograms);
      if (duplicate) {
        console.log(`  SKIP: ${entry.destination} — duplicates existing ${duplicate.file} (id: ${duplicate.id})`);
        continue;
      }
    }
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }

  // Customized files: create .kit-update sidecar
  for (const entry of classification.customized) {
    const src = path.join(homebasePath, entry.source);
    const dest = path.join(repoPath, entry.destination + '.kit-update');
    if (!fs.existsSync(src)) continue;
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
  emitEvent('T0:envelope', 'migration-files-updated', {
    phase: 'file-update',
    path: path.relative(process.cwd(), repoPath).replace(/\\/g, '/'),
    updated_count: classification.updated?.length || 0,
    customized_count: classification.customized?.length || 0,
  });
}

// ─── Phase 5: Index Rebuilds ───────────────────────────────────────────────

function rebuildIndexes(repoPath) {
  const wsDir = path.join(repoPath, '.claude', 'workstream');
  if (!fs.existsSync(wsDir)) return;

  // Rebuild queue index
  const queueDir = path.join(wsDir, 'queue');
  if (fs.existsSync(queueDir)) {
    const queueFiles = globFiles(queueDir, 'WS-*.yaml');
    const items = [];
    const byStatus = {};
    const byCategory = {};

    for (const f of queueFiles) {
      const { ok, data } = readYAMLFile(f);
      if (!ok || !data.id) continue;
      const status = data.status || 'backlog';
      const category = data.category || 'uncategorized';
      byStatus[status] = (byStatus[status] || 0) + 1;
      byCategory[category] = (byCategory[category] || 0) + 1;
      items.push({
        id: data.id,
        title: data.title || '',
        status,
        priority_score: data.priority_score || 0,
        category,
        effort: data.effort || 'M',
      });
    }

    const index = {
      total_items: items.length,
      by_status: byStatus,
      by_category: byCategory,
      items,
    };
    writeFileAtomic(path.join(wsDir, 'queue-index.yaml'), serializeYAML(index));
  }

  // Rebuild findings index
  const findingsDir = path.join(wsDir, 'findings');
  if (fs.existsSync(findingsDir)) {
    const findingFiles = globFiles(findingsDir, 'FIND-*.yaml')
      .concat(globFiles(findingsDir, 'FND-*.yaml'));
    const findings = [];

    for (const f of findingFiles) {
      const { ok, data } = readYAMLFile(f);
      if (!ok || !data.id) continue;
      findings.push({
        id: data.id,
        title: data.title || '',
        engine: data.engine || data.source_engine || '',
        severity: data.severity || 'medium',
        status: data.status || 'open',
        program: data.program || '',
        created_at: data.created_at || '',
      });
    }

    const index = { findings };
    writeFileAtomic(path.join(wsDir, 'findings-index.yaml'), serializeYAML(index));
  }
  emitEvent('T6:workstream', 'migration-indexes-rebuilt', {
    phase: 'index-rebuild',
    path: path.relative(process.cwd(), wsDir).replace(/\\/g, '/'),
  });
}

// ─── Phase 6: Finalize ─────────────────────────────────────────────────────

function createSnapshot(repoPath, classification, programMigrations) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const snapshotDir = path.join(repoPath, '.cwos-snapshots', timestamp);
  fs.mkdirSync(snapshotDir, { recursive: true });

  // Snapshot files that will be modified
  const filesToSnapshot = [
    ...classification.stock.map(e => e.destination),
    ...programMigrations.map(p => path.relative(repoPath, p.path)),
    '.cwos-version',
  ];

  for (const relPath of filesToSnapshot) {
    const srcPath = path.join(repoPath, relPath);
    if (!fs.existsSync(srcPath)) continue;
    const destPath = path.join(snapshotDir, relPath);
    ensureDir(path.dirname(destPath));
    fs.copyFileSync(srcPath, destPath);
  }

  // Write manifest
  const manifest = {
    created_at: new Date().toISOString(),
    files_count: filesToSnapshot.length,
  };
  writeFileAtomic(path.join(snapshotDir, 'manifest.yaml'), serializeYAML(manifest));

  // Ensure .cwos-snapshots is gitignored
  const gitignorePath = path.join(repoPath, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignore.includes('.cwos-snapshots')) {
      fs.appendFileSync(gitignorePath, '\n.cwos-snapshots/\n');
    }
  }

  emitEvent('T0:envelope', 'migration-snapshot-created', {
    phase: 'snapshot',
    path: path.relative(process.cwd(), snapshotDir).replace(/\\/g, '/'),
    files_count: filesToSnapshot.length,
  });

  return snapshotDir;
}

function bootstrapHashes(repoPath, homebasePath, classification) {
  const checksumMap = {};
  const allEntries = [...classification.stock, ...classification.new, ...classification.needsInstall];

  for (const entry of allEntries) {
    const filePath = path.join(repoPath, entry.destination);
    if (!fs.existsSync(filePath)) continue;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      checksumMap[entry.destination] = sha256(content);
    } catch {}
  }

  // Also hash customized files (their current version, not the kit-update)
  for (const entry of classification.customized) {
    const filePath = path.join(repoPath, entry.destination);
    if (!fs.existsSync(filePath)) continue;
    try {
      checksumMap[entry.destination] = sha256(fs.readFileSync(filePath, 'utf8'));
    } catch {}
  }

  return checksumMap;
}

function updateVersionStamp(repoPath, toVersion, checksumMap) {
  const versionPath = path.join(repoPath, '.cwos-version');
  const { ok, data: existing } = readYAMLFile(versionPath);

  // ADR-016: prefer existing capabilities_enabled; fall back to level translation.
  let capabilitiesEnabled;
  if (existing && Array.isArray(existing.capabilities_enabled) && existing.capabilities_enabled.length > 0) {
    capabilitiesEnabled = existing.capabilities_enabled;
  } else {
    const level = (existing && existing.level) || 'L4';
    capabilitiesEnabled = Array.from(capabilitiesForLevel(level));
  }

  const stamp = {
    version: toVersion,
    adopted_at: (existing && existing.adopted_at) || todayISO(),
    updated_at: new Date().toISOString(),
    capabilities_enabled: capabilitiesEnabled,
    level: (existing && existing.level) || 'L4', // shim, retires kit-v5
    homebase_path: (existing && existing.homebase_path) || '',
    kit_version_at_install: toVersion,
    installed_files: checksumMap,
  };

  writeFileAtomic(versionPath, serializeYAML(stamp));
}

// ─── Analysis Index ────────────────────────────────────────────────────────

function analyzeIndexes(repoPath) {
  const wsDir = path.join(repoPath, '.claude', 'workstream');
  const result = { queue: { status: 'ok', files: 0 }, findings: { status: 'ok', files: 0 } };

  // WS-209 (SPR-065): prefer per-repo state-store for index analysis
  // when the target repo is step-2+. Falls back to raw queue-index.yaml
  // for pre-step-2 repos. state-store is loaded with an explicit
  // workstreamDir so we read each target's own state.
  let ss = null;
  try { ss = require('./core/state-store'); } catch { /* optional */ }

  const queueDir = path.join(wsDir, 'queue');
  if (fs.existsSync(queueDir)) {
    result.queue.files = globFiles(queueDir, 'WS-*.yaml').length;
    let indexCount = null;
    if (ss && fs.existsSync(path.join(wsDir, 'state', 'queue.json'))) {
      try {
        const store = ss.loadState(wsDir);
        indexCount = store.queue.all().length;
      } catch { /* fall through */ }
    }
    if (indexCount === null) {
      const { ok, data } = readYAMLFile(path.join(wsDir, 'queue-index.yaml'));
      if (ok && typeof data.total_items === 'number') indexCount = data.total_items;
    }
    if (indexCount === null || indexCount !== result.queue.files) {
      result.queue.status = 'stale';
    }
  }

  const findingsDir = path.join(wsDir, 'findings');
  if (fs.existsSync(findingsDir)) {
    result.findings.files = globFiles(findingsDir, 'FIND-*.yaml').length +
      globFiles(findingsDir, 'FND-*.yaml').length;
    let indexCount = null;
    if (ss && fs.existsSync(path.join(wsDir, 'state', 'findings.json'))) {
      try {
        const store = ss.loadState(wsDir);
        indexCount = store.findings.all().length;
      } catch { /* fall through */ }
    }
    if (indexCount === null) {
      const { ok, data } = readYAMLFile(path.join(wsDir, 'findings-index.yaml'));
      indexCount = (ok && data.findings) ? data.findings.length : 0;
    }
    if (indexCount !== result.findings.files) {
      result.findings.status = 'stale';
    }
  }

  return result;
}

// ─── Output Helpers ────────────────────────────────────────────────────────

function printClassification(c) {
  console.log('\nFiles:');
  console.log(`  Stock (safe to overwrite): ${c.stock.length}`);
  if (c.stock.length > 0) {
    for (const e of c.stock.slice(0, 5)) console.log(`    ${e.destination}`);
    if (c.stock.length > 5) console.log(`    ... and ${c.stock.length - 5} more`);
  }
  console.log(`  Customized (needs merge):  ${c.customized.length}`);
  for (const e of c.customized) console.log(`    ${e.destination}`);
  console.log(`  New (will be added):       ${c.new.length}`);
  for (const e of c.new.slice(0, 5)) console.log(`    ${e.destination}`);
  if (c.new.length > 5) console.log(`    ... and ${c.new.length - 5} more`);
  console.log(`  Missing (will install):    ${c.needsInstall.length}`);
}

function printProgramAnalysis(migrations) {
  console.log(`\nPrograms: ${migrations.length} need schema migration (v2 → v3)`);
  if (migrations.length > 0) {
    console.log('  Health score conversion: 0-100 → 0-10');
    console.log('  New fields: tier, protocols, accountability, health_ceiling, health_breakdown');
    for (const m of migrations) {
      const score = m.data.health_score || 0;
      const v3Score = score > 10 ? Math.round(score / 10) : score;
      console.log(`    ${path.basename(m.path)}: ${score} → ${v3Score}/10`);
    }
  }
}

function printIndexAnalysis(status) {
  console.log('\nIndexes:');
  console.log(`  queue-index.yaml: ${status.queue.status.toUpperCase()} (${status.queue.files} WS-*.yaml files)`);
  console.log(`  findings-index.yaml: ${status.findings.status.toUpperCase()} (${status.findings.files} finding files)`);
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function resolveHomeBase(cliOverride, repoPath, opts) {
  const trustVersionHomebase = !!(opts && opts.trustVersionHomebase);

  // Strategy 1: Explicit --homebase flag (trusted — operator-supplied)
  if (cliOverride) {
    const resolved = path.resolve(cliOverride);
    if (fs.existsSync(path.join(resolved, 'kit', 'VERSION'))) return resolved;
    console.error(`WARN: --homebase path "${cliOverride}" does not contain kit/VERSION`);
  }

  // Strategy 2: Walk up from CWD (trusted — filesystem marker)
  const fromCwd = findHomeBase(process.cwd());
  if (fromCwd) return fromCwd;

  // Strategy 3: Script's own location (trusted — this file lives in HomeBase/kit/scripts/)
  const scriptDir = path.resolve(__dirname);
  const fromScript = findHomeBase(scriptDir);
  if (fromScript) return fromScript;

  // Strategy 3.5: CWOS_HOMEBASE env var (trusted — set by the operator/shell,
  // not by the adopted repo). Tried before the in-repo .cwos-version field.
  const envHb = process.env.CWOS_HOMEBASE;
  if (envHb) {
    const resolved = path.resolve(envHb);
    if (fs.existsSync(path.join(resolved, 'kit', 'VERSION'))) return resolved;
    console.error(`WARN: CWOS_HOMEBASE "${envHb}" does not contain kit/VERSION`);
  }

  // Strategy 4: homebase_path from the repo's .cwos-version. UNTRUSTED — gated.
  // (Extracted into resolveVersionHomebase so the security-sensitive logic is
  //  unit-testable independent of the cwd/__dirname short-circuits above.)
  return resolveVersionHomebase(repoPath, { trustVersionHomebase });
}

/**
 * Strategy 4 of resolveHomeBase: resolve a HomeBase from the `homebase_path`
 * field of the repo's .cwos-version. UNTRUSTED — this field lives inside the
 * adopted repo and may be attacker-influenced (FIND-299 / WS-431). cwos-migrate
 * reads MANIFEST from, runs git in, and copies files out of the resolved
 * HomeBase into the repo, where they later execute in sessions. Gated by two
 * checks, both required:
 *   (a) explicit operator confirmation via opts.trustVersionHomebase, and
 *   (b) the recorded corpus_version matching corpusHash(hbPath).
 * Returns the resolved path on success, else null (printing the reason).
 */
function resolveVersionHomebase(repoPath, opts) {
  const trustVersionHomebase = !!(opts && opts.trustVersionHomebase);
  const resolvedRepo = path.resolve(repoPath);
  const versionPath = path.join(resolvedRepo, '.cwos-version');
  if (!fs.existsSync(versionPath)) return null;

  const { ok, data } = readYAMLFile(versionPath);
  if (!ok || !data || !data.homebase_path) return null;

  const hbPath = path.resolve(data.homebase_path);
  if (!fs.existsSync(path.join(hbPath, 'kit', 'VERSION'))) {
    return null; // recorded path is not even a kit root
  }
  if (!trustVersionHomebase) {
    console.error('REFUSED: .cwos-version records a homebase_path but it is untrusted.');
    console.error(`  recorded homebase_path → ${hbPath}`);
    console.error('  This field lives inside the repo and could redirect the migration to a');
    console.error('  hostile HomeBase (FIND-299). Re-run with --homebase "<verified path>",');
    console.error('  or pass --trust-version-homebase if you have verified the path above.');
    return null;
  }
  const recordedCorpus = data.corpus_version || null;
  const actualCorpus = corpusHash(hbPath);
  if (!recordedCorpus || !actualCorpus || recordedCorpus !== actualCorpus) {
    console.error('REFUSED: .cwos-version homebase_path failed the corpus_version integrity check.');
    console.error(`  recorded homebase_path → ${hbPath}`);
    console.error(`  recorded corpus_version: ${recordedCorpus || '(missing)'}`);
    console.error(`  actual   corpus_version: ${actualCorpus || '(missing)'}`);
    console.error('  The resolved HomeBase does not match the one recorded at install time.');
    console.error('  Re-run with an explicit --homebase "<verified path>".');
    return null;
  }
  return hbPath;
}

function findHomeBase(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'kit', 'VERSION'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  detectState,
  classifyFiles,
  migrateSchemaV2ToV3,
  migrateSchemaV3ToV4,
  SCHEMA_MIGRATIONS,
  analyzePrograms,
  rebuildIndexes,
  inferTier,
  mapProtocols,
  mapAccountability,
  buildProgramIdMap,
  checkProgramDuplicate,
  isProgramFile,
  detectProgramDuplicates,
  resolveHomeBase,
  resolveVersionHomebase,
  findHomeBase,
  PROGRAM_DOMAIN_MAP,
};

// ─── Run ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  main();
}
