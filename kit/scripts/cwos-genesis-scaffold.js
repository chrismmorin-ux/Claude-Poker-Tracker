#!/usr/bin/env node
/**
 * cwos-genesis-scaffold.js — Empty-repo scaffold for /genesis (WS-321).
 *
 * Sibling to cwos-adopt-install.js for brand-new repos. Installs the kit in
 * dormant mode (M0): kit files in place, capture buffer initialized, but no
 * programs activated, no queue, no nags. Founder later runs /intend to ignite.
 *
 * What it does:
 *   1. Validate target is empty (or doesn't exist — create it)
 *   2. git init (if .git/ doesn't exist)
 *   3. Create dirs: .claude/, .claude/commands/, .claude/workstream/,
 *      .claude/workstream/events/, system/
 *   4. Copy kit/templates/system/intention.md → <target>/system/intention.md
 *   5. Compute SHA-256 of intention.md non-comment content (for later
 *      placeholder→content detection in /session-start Step 0c)
 *   6. Hardlink the M0-relevant commands from kit/commands/ → .claude/commands/
 *   7. Write <target>/.cwos-onboarding.yaml from kit template, patched with
 *      adoption_phase: M0 + m0_dormant block populated
 *   8. Write <target>/.cwos-version with M0 + genesis: true markers
 *   9. Register in fleet/registry.yaml (in HomeBase) with status: dormant
 *
 * Failure mode: best-effort atomic rollback. If any step after directory
 * creation fails, the script attempts to remove .claude/, .cwos-version,
 * and system/intention.md if it created them.
 *
 * Usage:
 *   node kit/scripts/cwos-genesis-scaffold.js --target-dir <path> [--system-dir <name>]
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { writeFileAtomic } = require('./lib/cwos-utils');
const { validateTargetDir } = require('./lib/shell-safe');

// HomeBase root — derived from this script's location. kit/scripts/cwos-genesis-scaffold.js → ../..
const KIT_ROOT = path.resolve(__dirname, '..', '..');
const KIT_COMMANDS_DIR = path.join(KIT_ROOT, 'kit', 'commands');
const KIT_TEMPLATES_DIR = path.join(KIT_ROOT, 'kit', 'templates');
const FLEET_REGISTRY = path.join(KIT_ROOT, 'fleet', 'registry.yaml');

// Phase F (WS-321): assets installed at scaffold time so the founder can
// operate from inside the scaffolded directory (cd in, run /intend, etc.).
// Without these, the hardlinked command markdown references `node
// kit/scripts/...` paths that don't resolve in the target. See ADR-046 +
// docs/genesis-flow.md.
//
// Each entry is repo-relative (from KIT_ROOT, which is HomeBase at scaffold
// time and the target repo at command-execution time — paths mirror).
const M0_SCRIPTS = [
  // Entry-point scripts the M0 commands invoke
  'kit/scripts/cwos-event.js',
  'kit/scripts/cwos-genesis-ignite.js',
  'kit/scripts/cwos-adopt-archetype.js',
  // Post-ignition entry-points so founders can operate from inside the
  // scaffolded target after /intend ignites (cd-from-target workflow).
  // Required for /archetype re + /stage transitions to work locally; also
  // load-bearing for WS-322 tripwire visibility (/pulse + /status).
  'kit/scripts/cwos-rearchetype.js',
  'kit/scripts/cwos-stage.js',
  'kit/scripts/cwos-pulse.js',
  'kit/scripts/cwos-status-pre.js',
  'kit/scripts/cwos-asn-report.js',
  // Lib modules required by the entry-point scripts
  'kit/scripts/lib/preflight.js',
  'kit/scripts/lib/cwos-utils.js',
  'kit/scripts/lib/tier-mapper.js',
  'kit/scripts/lib/cwos-tripwires.js',  // WS-322 evaluator (Phase B)
  // Core modules required by cwos-event.js
  'kit/scripts/core/events.js',
  'kit/scripts/core/composition.js',
  'kit/scripts/core/canonical-json.js',
  'kit/scripts/core/health-scoring.js',  // required by cwos-pulse.js (fail-soft but cleaner with it)
  // Optional core modules — events.js / cwos-event.js use try/catch around these,
  // so missing files fail soft. Including them keeps the install complete.
  'kit/scripts/core/render-events.js',
  'kit/scripts/core/telemetry.js',
  'kit/scripts/core/state-store.js',
  'kit/scripts/core/chain-anchors.js',
];

// Schemas — strict T0:envelope validation requires every emitted event type
// to have a matching schema file. T20:capture-buffer is tolerant (warn-only).
// We mirror the whole schemas/ tree because the kit can grow new event
// types and missing schemas would silently drop validation.
const M0_SCHEMA_DIRS = [
  'kit/scripts/core/schemas',  // recursive copy
];

// Data files — archetype + stage + ignition-template definitions read by
// cwos-genesis-ignite.js propose.
const M0_DATA = [
  'kit/data/archetypes.yaml',
  'kit/data/stages.yaml',
  'kit/data/genesis-sprints/A1.yaml',
  'kit/data/genesis-sprints/A3.yaml',
  'kit/data/genesis-sprints/A4.yaml',
  'kit/data/genesis-sprints/A5.yaml',
];

// Program templates — cwos-genesis-ignite.js apply copies these into the
// target's .claude/workstream/programs/ filtered by bundle.programs[]. Need
// all of them available because the founder picks archetype at /intend time.
const M0_PROGRAM_TEMPLATES_GLOB = 'kit/templates/workstream/programs/prog-*.yaml';

// Commands hardlinked at M0. Excludes anything that requires programs/queue
// (next, workstream, engine, build-engine, plan, verify, decide, audit, pulse,
// archetype, stage, decide, evolve, etc.) — those install at ignition.
const M0_COMMANDS = [
  'genesis',        // self-reference — for /genesis --help / re-running
  'intend',         // ignition trigger (Phase C; safe to skip if missing)
  'status',         // dormant view
  'session-start',  // lean briefing in M0
  'session-end',    // capture-buffer write paths
  'feedback',       // founder can record friction even in M0
  'onboard-check',  // re-evaluate progress (transitions to /intend prompt when ready)
];

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i < 0 || i === args.length - 1) return null;
  return args[i + 1];
}

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function dieWith(code, msg) {
  process.stderr.write(`cwos-genesis-scaffold: ${msg}\n`);
  process.exit(code);
}

function nowISO() {
  return new Date().toISOString();
}

function sha256OfNonCommentContent(text) {
  // Strip HTML comments <!-- ... --> and full-line comments (lines starting
  // with `<!--` and ending with `-->`) so the hash represents the founder's
  // actual content, not the template's authoring notes.
  const stripped = text
    .replace(/<!--[\s\S]*?-->/g, '')   // remove HTML comment blocks
    .replace(/^\s*$/gm, '')             // collapse whitespace-only lines
    .trim();
  return crypto.createHash('sha256').update(stripped, 'utf8').digest('hex');
}

// Validate target is empty (or doesn't exist).
function validateTarget(targetDir) {
  if (!fs.existsSync(targetDir)) return { ok: true, willCreate: true };
  const stat = fs.statSync(targetDir);
  if (!stat.isDirectory()) {
    return { ok: false, reason: `target exists but is not a directory: ${targetDir}` };
  }
  const entries = fs.readdirSync(targetDir);
  // Allow .git as long as HEAD points to no commits (fresh `git init`).
  // Reject anything else.
  const blockers = entries.filter((e) => {
    if (e === '.git') {
      try {
        const headPath = path.join(targetDir, '.git', 'HEAD');
        if (!fs.existsSync(headPath)) return true; // weird state, refuse
        const head = fs.readFileSync(headPath, 'utf8').trim();
        // `ref: refs/heads/master\n` (no commits yet) is fine; an actual
        // 40-char SHA in HEAD means there's a commit.
        if (/^[0-9a-f]{40}$/.test(head)) return true;
        // Even if HEAD is a ref, check if the ref resolves to a commit.
        const refMatch = head.match(/^ref:\s*(.+)$/);
        if (refMatch) {
          const refFile = path.join(targetDir, '.git', refMatch[1]);
          if (fs.existsSync(refFile)) {
            const refContent = fs.readFileSync(refFile, 'utf8').trim();
            if (/^[0-9a-f]{40}$/.test(refContent)) return true;
          }
        }
        return false; // empty git repo, OK
      } catch {
        return true; // any error — be conservative, refuse
      }
    }
    return true;
  });
  if (blockers.length > 0) {
    return {
      ok: false,
      reason: `target is non-empty: ${blockers.join(', ')}`,
    };
  }
  return { ok: true, willCreate: false };
}

// Best-effort removal — used in rollback. Never throws.
function safeRemove(p) {
  try {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  } catch { /* ignore */ }
}

function gitInitIfNeeded(targetDir) {
  const gitDir = path.join(targetDir, '.git');
  if (fs.existsSync(gitDir)) return false;
  try {
    execSync('git init', { cwd: targetDir, stdio: 'ignore' });
    return true;
  } catch (e) {
    // git not on PATH or init failed — non-fatal; founder can git init later.
    process.stderr.write(`cwos-genesis-scaffold: git init skipped — ${e.message}\n`);
    return false;
  }
}

function copyTemplate(srcRel, targetAbs) {
  const src = path.join(KIT_TEMPLATES_DIR, srcRel);
  if (!fs.existsSync(src)) {
    throw new Error(`template not found: ${src}`);
  }
  const content = fs.readFileSync(src, 'utf8');
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  writeFileAtomic(targetAbs, content);
  return content;
}

// Phase F: hardlink-or-copy a single file from KIT_ROOT/<srcRel> to
// targetAbs/<srcRel>. Returns {ok, mode} where mode is 'hardlink' or 'copy'.
// Cross-volume hardlink failures fall back to copy with a warning logged.
function installAsset(srcRel, targetAbs, errors) {
  const src = path.join(KIT_ROOT, srcRel);
  const dst = path.join(targetAbs, srcRel);
  if (!fs.existsSync(src)) {
    return { ok: false, skipped: true, reason: 'source missing' };
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  try {
    if (fs.existsSync(dst)) fs.rmSync(dst, { force: true });
    fs.linkSync(src, dst);
    return { ok: true, mode: 'hardlink' };
  } catch (e) {
    try {
      fs.copyFileSync(src, dst);
      errors.push(`${srcRel}: hardlink failed (${e.code || e.message}); fell back to copy`);
      return { ok: true, mode: 'copy' };
    } catch (e2) {
      errors.push(`${srcRel}: link AND copy both failed — ${e2.message}`);
      return { ok: false, error: e2.message };
    }
  }
}

// Phase F: recursively install everything under KIT_ROOT/<srcDirRel> into
// targetAbs/<srcDirRel>, mirroring directory structure. Used for the schemas
// tree where new payload types are added over time.
function installDirRecursive(srcDirRel, targetAbs, errors) {
  const src = path.join(KIT_ROOT, srcDirRel);
  if (!fs.existsSync(src)) return { copied: 0, skipped: true };
  const stat = fs.statSync(src);
  if (!stat.isDirectory()) return { copied: 0, skipped: true };

  let copied = 0;
  function walk(currentSrc) {
    for (const entry of fs.readdirSync(currentSrc, { withFileTypes: true })) {
      const childSrc = path.join(currentSrc, entry.name);
      if (entry.isDirectory()) { walk(childSrc); continue; }
      // Compute path relative to KIT_ROOT
      const rel = path.relative(KIT_ROOT, childSrc).replace(/\\/g, '/');
      const r = installAsset(rel, targetAbs, errors);
      if (r.ok) copied += 1;
    }
  }
  walk(src);
  return { copied };
}

// Phase F: glob-style install for files matching a pattern (used for
// program templates — kit/templates/workstream/programs/prog-*.yaml).
function installGlob(pattern, targetAbs, errors) {
  const dir = path.dirname(pattern);
  const fileGlob = path.basename(pattern); // e.g. "prog-*.yaml"
  const re = new RegExp('^' + fileGlob.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
  const srcDir = path.join(KIT_ROOT, dir);
  if (!fs.existsSync(srcDir)) return { copied: 0, skipped: true };
  let copied = 0;
  for (const f of fs.readdirSync(srcDir)) {
    if (!re.test(f)) continue;
    const rel = path.posix.join(dir, f);
    const r = installAsset(rel, targetAbs, errors);
    if (r.ok) copied += 1;
  }
  return { copied };
}

function hardlinkCommand(name, targetCommandsDir, errors) {
  const src = path.join(KIT_COMMANDS_DIR, `${name}.md`);
  const dst = path.join(targetCommandsDir, `${name}.md`);
  if (!fs.existsSync(src)) {
    // Skip silently for commands that don't exist yet (e.g., /intend in
    // Phase A before Phase C ships). Re-running /genesis after Phase C
    // will pick them up via /fleet-update.
    return { ok: false, skipped: true, reason: 'source missing' };
  }
  try {
    if (fs.existsSync(dst)) fs.rmSync(dst, { force: true });
    fs.linkSync(src, dst);
    return { ok: true, hardlink: true };
  } catch (e) {
    // Cross-filesystem or permission failure — fall back to copy with a warning.
    try {
      fs.copyFileSync(src, dst);
      errors.push(`${name}: hardlink failed (${e.message}); fell back to copy — run /fleet-update later to relink`);
      return { ok: true, hardlink: false };
    } catch (e2) {
      errors.push(`${name}: link AND copy both failed — ${e2.message}`);
      return { ok: false, error: e2.message };
    }
  }
}

// Patch a top-level scalar field value. Drops any trailing inline comment —
// the CWOS YAML parser (kit/scripts/lib/cwos-utils.js) doesn't strip inline
// comments, so leaving them in would cause the comment text to become part of
// the parsed value (per feedback_yaml_parser_quirks.md / INV-022).
function patchTopLevelScalar(raw, field, newValue) {
  const re = new RegExp(`^(${escapeRegex(field)}:\\s*)(\\S+?)(\\s*(?:#.*)?)$`, 'm');
  return raw.replace(re, (m, prefix) => `${prefix}${newValue}`);
}

// Patch an indented scalar within a parent block (e.g., `m0_dormant.entered_at`).
// Same trailing-comment caveat as patchTopLevelScalar.
function patchIndentedScalar(raw, field, newValue, indent = '  ') {
  const re = new RegExp(`^(${escapeRegex(indent)}${escapeRegex(field)}:\\s*)(\\S+?)(\\s*(?:#.*)?)$`, 'm');
  return raw.replace(re, (m, prefix) => `${prefix}${newValue}`);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildOnboardingYaml(now, intentionHash, systemDir) {
  // Read the kit template and patch in the dormant + header values via
  // per-field surgical replacements. This preserves the template's copious
  // comments and trailing annotations — they are load-bearing for human
  // readers and for future evaluators.
  const templatePath = path.join(KIT_TEMPLATES_DIR, 'cwos-onboarding.yaml');
  let raw = fs.readFileSync(templatePath, 'utf8');

  // Top-level header values
  raw = patchTopLevelScalar(raw, 'started_at', `"${now}"`);
  raw = patchTopLevelScalar(raw, 'platform', `"${process.platform}"`);
  raw = patchTopLevelScalar(raw, 'adoption_phase', 'M0');

  // m0_dormant block — patch each field individually within its 2-space indent.
  // Note: even fields that stay at their `null` default need a patch pass to
  // strip inline comments — the CWOS YAML parser handles `true`/`false` but
  // not `null` w/ trailing comment (parses it as a string). Patching with the
  // same value drops the comment as a side effect.
  raw = patchIndentedScalar(raw, 'entered_at', `"${now}"`);
  raw = patchIndentedScalar(raw, 'exited_at', 'null');
  raw = patchIndentedScalar(raw, 'exit_trigger', 'null');
  raw = patchIndentedScalar(raw, 'intention_content_hash', `"${intentionHash}"`);
  raw = patchIndentedScalar(raw, 'kit_files_installed', 'true');
  raw = patchIndentedScalar(raw, 'capture_buffer_present', 'true');
  raw = patchIndentedScalar(raw, 'intention_template_present', 'true');

  return raw;
}

function buildVersionFile(now, kitVersion) {
  return [
    '# CWOS Version Stamp — written by /genesis',
    `kit_version: "${kitVersion}"`,
    `installed_at: "${now}"`,
    'install_path: /genesis',
    'adoption_phase: M0',
    'genesis: true',
    '',
  ].join('\n');
}

function readKitVersion() {
  const versionPath = path.join(KIT_ROOT, 'kit', 'VERSION');
  if (!fs.existsSync(versionPath)) return 'unknown';
  return fs.readFileSync(versionPath, 'utf8').trim();
}

function appendToFleetRegistry(targetDir, repoName, kitVersion, now, errors) {
  if (!fs.existsSync(FLEET_REGISTRY)) {
    errors.push(`fleet registry not found at ${FLEET_REGISTRY} — skipped registration`);
    return false;
  }
  try {
    const raw = fs.readFileSync(FLEET_REGISTRY, 'utf8');
    // Convert backslashes to forward slashes for cross-platform readability
    const targetForward = targetDir.replace(/\\/g, '/');
    // kit_version is written here for backstop visibility, but per WS-406 it is
    // a DEPRECATED CACHE — `cwos-fleet-scan` reads `.cwos-version` from each
    // repo directly. New consumers should not treat this field as authoritative.
    const entry = [
      '',
      `  - name: "${repoName}"`,
      `    path: "${targetForward}"`,
      '    type: unknown        # set at ignition by /intend (from archetype bundle)',
      '    capabilities_enabled: []',
      '    maturity: M0',
      `    registered_at: "${now.slice(0, 10)}"`,
      `    adopted_at: "${now}"`,
      `    kit_version: "${kitVersion}"`,
      '    status: dormant      # WS-321 — awaiting /intend to ignite',
      '',
    ].join('\n');
    // Append at end. The registry is a list under top-level `repos:`.
    const out = raw.endsWith('\n') ? raw + entry : raw + '\n' + entry;
    writeFileAtomic(FLEET_REGISTRY, out);
    return true;
  } catch (e) {
    errors.push(`fleet registry append failed: ${e.message}`);
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const targetDir = readFlag(args, 'target-dir');
  const systemDir = readFlag(args, 'system-dir') || 'system';

  if (!targetDir) {
    dieWith(2, 'usage: cwos-genesis-scaffold.js --target-dir <path> [--system-dir <name>]');
  }

  // WS-381 / INV-F1: reject path-traversal and system-location targets BEFORE
  // any destructive op. validateTargetDir throws SHELL_SAFE_REJECTED on:
  //   - .. traversal segments
  //   - null bytes / newlines
  //   - Windows: C:\Windows, C:\Program Files, C:\ProgramData, bare drive root
  //   - POSIX:   /etc, /usr, /var, /opt, /sys, /proc, /bin, /sbin, /boot, /root
  try {
    validateTargetDir(targetDir);
  } catch (e) {
    if (e && e.code === 'SHELL_SAFE_REJECTED') {
      dieWith(2, `${e.message}\n  /genesis refuses to scaffold into protected or traversed paths.\n  Pass a normal repo path under your dev directory.`);
    }
    throw e;
  }

  const targetAbs = path.resolve(targetDir);

  const validation = validateTarget(targetAbs);
  if (!validation.ok) {
    dieWith(3, `refused: ${validation.reason}\n  /genesis is for empty repos only.\n  For repos with existing code: run /adopt <path>\n  For CWOS-installed repos: run /onboard-check`);
  }

  const created = []; // tracked for rollback
  const errors = [];
  const now = nowISO();
  const kitVersion = readKitVersion();
  const repoName = path.basename(targetAbs);

  try {
    // 1. Create target dir if needed
    if (validation.willCreate) {
      fs.mkdirSync(targetAbs, { recursive: true });
      created.push(targetAbs);
    }

    // 2. git init
    const didGitInit = gitInitIfNeeded(targetAbs);

    // 3. Create directory structure
    const dirs = [
      path.join(targetAbs, '.claude'),
      path.join(targetAbs, '.claude', 'commands'),
      path.join(targetAbs, '.claude', 'workstream'),
      path.join(targetAbs, '.claude', 'workstream', 'events'),
      path.join(targetAbs, systemDir),
    ];
    for (const d of dirs) {
      fs.mkdirSync(d, { recursive: true });
      created.push(d);
    }

    // 4. Copy intention.md template
    const intentionTarget = path.join(targetAbs, systemDir, 'intention.md');
    const intentionContent = copyTemplate(
      path.join('system', 'intention.md'),
      intentionTarget
    );
    created.push(intentionTarget);

    // 5. Compute placeholder hash
    const intentionHash = sha256OfNonCommentContent(intentionContent);

    // 6. Hardlink M0 commands
    const targetCommandsDir = path.join(targetAbs, '.claude', 'commands');
    const linkResults = {};
    for (const cmd of M0_COMMANDS) {
      linkResults[cmd] = hardlinkCommand(cmd, targetCommandsDir, errors);
    }

    // 6b. (Phase F) Install scripts, schemas, data, program templates so the
    // founder can operate from inside the scaffolded dir. Without this step,
    // /intend and /session-end fail because their command markdown invokes
    // node kit/scripts/... paths that don't exist locally.
    const assetResults = {
      scripts: { ok: 0, skipped: 0, failed: 0 },
      schemas: 0,
      data: { ok: 0, skipped: 0, failed: 0 },
      program_templates: 0,
    };
    for (const srcRel of M0_SCRIPTS) {
      const r = installAsset(srcRel, targetAbs, errors);
      if (r.ok) assetResults.scripts.ok += 1;
      else if (r.skipped) assetResults.scripts.skipped += 1;
      else assetResults.scripts.failed += 1;
    }
    for (const dirRel of M0_SCHEMA_DIRS) {
      const r = installDirRecursive(dirRel, targetAbs, errors);
      assetResults.schemas += r.copied || 0;
    }
    for (const srcRel of M0_DATA) {
      const r = installAsset(srcRel, targetAbs, errors);
      if (r.ok) assetResults.data.ok += 1;
      else if (r.skipped) assetResults.data.skipped += 1;
      else assetResults.data.failed += 1;
    }
    {
      const r = installGlob(M0_PROGRAM_TEMPLATES_GLOB, targetAbs, errors);
      assetResults.program_templates = r.copied || 0;
    }

    // 7. Write .cwos-onboarding.yaml
    const onboardingPath = path.join(targetAbs, '.cwos-onboarding.yaml');
    const onboardingContent = buildOnboardingYaml(now, intentionHash, systemDir);
    writeFileAtomic(onboardingPath, onboardingContent);
    created.push(onboardingPath);

    // 8. Write .cwos-version
    const versionPath = path.join(targetAbs, '.cwos-version');
    writeFileAtomic(versionPath, buildVersionFile(now, kitVersion));
    created.push(versionPath);

    // 9. Register in fleet
    const fleetRegistered = appendToFleetRegistry(targetAbs, repoName, kitVersion, now, errors);

    // Done. Emit summary.
    writeJson({
      ok: true,
      target: targetAbs,
      repo_name: repoName,
      adoption_phase: 'M0',
      kit_version: kitVersion,
      entered_at: now,
      git_initialized: didGitInit,
      created: {
        dirs: dirs.length,
        intention_md: true,
        onboarding_yaml: true,
        version_file: true,
      },
      commands: linkResults,
      assets: assetResults,
      fleet_registered: fleetRegistered,
      intention_content_hash: intentionHash,
      errors,
    });
  } catch (err) {
    // Rollback: best-effort cleanup of anything we created
    for (const p of created.reverse()) safeRemove(p);
    dieWith(4, `scaffold failed: ${err.message}\n  partial install rolled back`);
  }
}

main();
