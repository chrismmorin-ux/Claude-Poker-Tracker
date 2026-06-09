#!/usr/bin/env node
/**
 * cwos-kit-upgrade — founder-facing, single-repo kit upgrade orchestrator.
 *
 * Composes the EXISTING upgrade machinery (cwos-migrate.js for MANIFEST-driven
 * file classification + apply + program v2→v3 + index rebuild + version stamp;
 * the registry-sync scripts for re-materialization) and adds the safety layer a
 * non-technical founder needs to run one command and trust the result:
 *
 *   • version-staged schema sequencing (refuse if an intermediate migrator is absent)
 *   • a comprehensive pre-upgrade snapshot (.cwos-snapshots/kit-pre-upgrade-<ts>/)
 *   • the whole write phase under a file lock (no concurrent reconcile corruption)
 *   • a post-upgrade validation gate (reconcile / next gate / allocate-ws-id /
 *     pulse / audit drift / registry path resolution / version bumped)
 *   • AUTOMATIC rollback to the snapshot if the gate fails — never a half-upgrade
 *   • loud surfacing of locally hand-edited kit files before they're overwritten
 *
 * This is adopter-local and SINGLE-repo. /fleet-update remains the HomeBase-side
 * bulk push; /kit-upgrade is the careful one-repo path with gates + auto-rollback.
 *
 * Usage:
 *   node kit/scripts/cwos-kit-upgrade.js [<repo-path>] --homebase <path> [--apply]
 *   node kit/scripts/cwos-kit-upgrade.js [<repo-path>] --rollback
 *
 *   <repo-path>   repo to upgrade (default: cwd)
 *   --homebase    HomeBase root that sources the new kit (required unless cwd/.cwos-version resolves it)
 *   --apply       perform writes (default: dry-run — shows the full diff, writes nothing)
 *   --rollback    restore the most recent kit-pre-upgrade snapshot and exit
 *   --json        machine-readable summary
 *   --yes         non-interactive (assume confirmation)
 */

'use strict';

require('./lib/preflight');

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { readYAMLFile, withFileLock } = require('./lib/cwos-utils');

const SNAPSHOT_PREFIX = 'kit-pre-upgrade-';
// Authored surfaces we snapshot for rollback (those an upgrade overwrites).
const SNAPSHOT_DIRS = [
  'kit',
  '.claude/commands',
  '.claude/agents',
  '.claude/skills',
  '.claude/workstream/programs',
  '.claude/workstream/engines',
];
const SNAPSHOT_FILES = ['.cwos-version'];

// ─── small fs helpers (Node floor is v14 — no fs.cpSync) ────────────────────

function sha256(content) {
  return 'sha256:' + require('crypto').createHash('sha256').update(content).digest('hex');
}
function isFile(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function copyTree(srcDir, dstDir) {
  ensureDir(dstDir);
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, ent.name);
    const d = path.join(dstDir, ent.name);
    if (ent.isDirectory()) {
      // never recurse into snapshot storage or VCS internals
      if (ent.name === '.cwos-snapshots' || ent.name === '.git' || ent.name === 'node_modules') continue;
      copyTree(s, d);
    } else if (ent.isFile()) {
      ensureDir(path.dirname(d));
      fs.copyFileSync(s, d);
    }
  }
}

// ─── HomeBase / version resolution ──────────────────────────────────────────

function looksLikeHomeBase(dir) {
  return dir && isFile(path.join(dir, 'kit', 'VERSION')) && isFile(path.join(dir, 'kit', 'MANIFEST.yaml'));
}

function resolveHomeBase(override, repoPath) {
  if (override) return path.resolve(override);
  // walk up from cwd (works when invoked from inside HomeBase)
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (looksLikeHomeBase(dir) && path.resolve(dir) !== path.resolve(repoPath)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// .cwos-version may be YAML (new) or a bare version scalar (legacy fixtures).
function readInstalledVersion(repoPath) {
  const vp = path.join(repoPath, '.cwos-version');
  if (!fs.existsSync(vp)) return null;
  const raw = fs.readFileSync(vp, 'utf8');
  const { ok, data } = readYAMLFile(vp);
  if (ok && data && typeof data === 'object') {
    const v = data.kit_version_at_install || data.version;
    if (v) return String(v).trim();
  }
  const m = raw.match(/(\d+\.\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

function readKitVersion(homebase) {
  return fs.readFileSync(path.join(homebase, 'kit', 'VERSION'), 'utf8').trim();
}

// ─── schema sequencing (req 3) ──────────────────────────────────────────────

function detectMinProgramSchema(repoPath) {
  const dir = path.join(repoPath, '.claude', 'workstream', 'programs');
  if (!isDir(dir)) return null;
  let min = null;
  for (const f of fs.readdirSync(dir)) {
    if (!/^prog-.*\.yaml$/.test(f) || f === 'registry.yaml') continue;
    const { ok, data } = readYAMLFile(path.join(dir, f));
    if (!ok || !data || !data.id) continue;
    const sv = Number(data.schema_version) || 1;
    if (min === null || sv < min) min = sv;
  }
  return min;
}

function targetProgramSchema(homebase) {
  const { ok, data } = readYAMLFile(path.join(homebase, 'kit', 'templates', 'workstream', 'programs', 'prog-template.yaml'));
  return ok && data && Number(data.schema_version) ? Number(data.schema_version) : 4;
}

/**
 * Resolve the ordered program-schema migrator chain. Returns
 * { steps: ['2→3','3→4'], missing: [] } — `missing` non-empty means refuse.
 */
function resolveSchemaChain(fromSchema, toSchema, SCHEMA_MIGRATIONS) {
  const steps = [];
  const missing = [];
  // migrators below 2 are folded into '2→3' (it tolerates v1/v2 input)
  let v = fromSchema < 2 ? 2 : fromSchema;
  for (; v < toSchema; v++) {
    const key = `${v}→${v + 1}`;
    steps.push(key);
    if (!SCHEMA_MIGRATIONS[key]) missing.push(key);
  }
  return { steps, missing };
}

// ─── local-mod baseline (req 9, decision 3: shipped hash manifest) ──────────

function loadHashBaseline(homebase, repoPath, installedVersion) {
  // primary: the per-version manifest SHIPPED into the adopter at install time,
  // i.e. the adopter's own kit/hashes-<installed>.yaml. This is the authoritative
  // record of what version <installed> shipped (decision 3). Fall back to
  // HomeBase's copy of the same version if the adopter predates the manifest.
  for (const [label, root] of [['repo', repoPath], ['homebase', homebase]]) {
    const mp = path.join(root, 'kit', `hashes-${installedVersion}.yaml`);
    if (isFile(mp)) {
      const { ok, data } = readYAMLFile(mp);
      if (ok && data && data.files) {
        return { source: `${label}:hashes-${installedVersion}.yaml`, files: data.files };
      }
    }
  }
  // fallback: .cwos-version installed_files (populated by adopt/fleet-update)
  const { ok, data } = readYAMLFile(path.join(repoPath, '.cwos-version'));
  if (ok && data && data.installed_files && Object.keys(data.installed_files).length) {
    return { source: '.cwos-version#installed_files', files: data.installed_files, keyedByDestination: true };
  }
  // else: git-tag reconstruction is handled inside cwos-migrate's classifyFiles;
  // we mark the baseline unavailable so detection is never silently skipped.
  return null;
}

/**
 * Detect locally hand-edited kit files among those that will be overwritten.
 * Returns [{ source, destination, expected, actual }].
 */
function detectLocalMods(homebase, repoPath, manifestFiles, baseline) {
  if (!baseline) return null; // unavailable — caller surfaces this
  const mods = [];
  for (const entry of manifestFiles) {
    if (entry.homebase_only) continue;
    const dest = String(entry.destination || '').replace('{system_dir}', 'system');
    const destAbs = path.join(repoPath, dest);
    if (!isFile(destAbs)) continue;
    const key = baseline.keyedByDestination ? dest : entry.source;
    const expected = baseline.files[key];
    if (!expected) continue;
    const actual = sha256(fs.readFileSync(destAbs));
    if (actual !== expected) mods.push({ source: entry.source, destination: dest, expected, actual });
  }
  return mods;
}

// ─── snapshot / rollback (req 8) ────────────────────────────────────────────

function snapshotDirsRoot(repoPath) { return path.join(repoPath, '.cwos-snapshots'); }

function createPreUpgradeSnapshot(repoPath, createdFiles, fromV, toV) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const root = path.join(snapshotDirsRoot(repoPath), `${SNAPSHOT_PREFIX}${ts}`);
  ensureDir(root);
  for (const rel of SNAPSHOT_DIRS) {
    const src = path.join(repoPath, rel);
    if (isDir(src)) copyTree(src, path.join(root, rel));
  }
  for (const rel of SNAPSHOT_FILES) {
    const src = path.join(repoPath, rel);
    if (isFile(src)) { ensureDir(path.join(root, path.dirname(rel))); fs.copyFileSync(src, path.join(root, rel)); }
  }
  const manifest = {
    created_at: new Date().toISOString(),
    from_version: fromV,
    to_version: toV,
    snapshot_dirs: SNAPSHOT_DIRS,
    snapshot_files: SNAPSHOT_FILES,
    created_files: createdFiles, // files that did not exist pre-upgrade → delete on rollback
  };
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
  ensureGitignore(repoPath);
  return root;
}

function ensureGitignore(repoPath) {
  const gi = path.join(repoPath, '.gitignore');
  try {
    const cur = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
    if (!cur.includes('.cwos-snapshots')) fs.appendFileSync(gi, (cur.endsWith('\n') || !cur ? '' : '\n') + '.cwos-snapshots/\n');
  } catch { /* non-fatal */ }
}

function latestSnapshot(repoPath) {
  const root = snapshotDirsRoot(repoPath);
  if (!isDir(root)) return null;
  const dirs = fs.readdirSync(root).filter(d => d.startsWith(SNAPSHOT_PREFIX) && isDir(path.join(root, d))).sort();
  return dirs.length ? path.join(root, dirs[dirs.length - 1]) : null;
}

function restoreSnapshot(repoPath, snapDir) {
  const manPath = path.join(snapDir, 'manifest.json');
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(manPath, 'utf8')); } catch { /* best effort */ }
  // 1. delete files created during the (failed) upgrade
  for (const rel of (manifest.created_files || [])) {
    const p = path.join(repoPath, rel);
    try { if (isFile(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
  // 2. restore snapshotted dirs (overwrite current with pre-upgrade state)
  for (const rel of (manifest.snapshot_dirs || SNAPSHOT_DIRS)) {
    const src = path.join(snapDir, rel);
    if (isDir(src)) copyTree(src, path.join(repoPath, rel));
  }
  for (const rel of (manifest.snapshot_files || SNAPSHOT_FILES)) {
    const src = path.join(snapDir, rel);
    if (isFile(src)) { ensureDir(path.join(repoPath, path.dirname(rel))); fs.copyFileSync(src, path.join(repoPath, rel)); }
  }
  return manifest;
}

// ─── spawning composed tools + validation gate ──────────────────────────────

function run(homebase, repoPath, scriptRel, args, opts = {}) {
  // prefer the repo's own (post-upgrade) copy for validation; else homebase's
  const repoScript = path.join(repoPath, scriptRel);
  const hbScript = path.join(homebase, scriptRel);
  const script = (opts.preferRepo && isFile(repoScript)) ? repoScript : (isFile(hbScript) ? hbScript : repoScript);
  if (!isFile(script)) return { ok: false, code: 127, stdout: '', stderr: `script not found: ${scriptRel}`, absent: true };
  const r = spawnSync('node', [script, ...args], { cwd: repoPath, encoding: 'utf8', timeout: 120000 });
  return { ok: r.status === 0, code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// Each check returns { name, pass, detail }.
// `preUnresolved` is the set of registry paths already broken BEFORE the upgrade;
// the gate fails the registry check only on paths the upgrade newly broke, so a
// pre-existing drift doesn't block (and silently roll back) an otherwise-clean upgrade.
function runValidationGate(homebase, repoPath, targetVersion, validateRegistryPaths, preUnresolved = new Set()) {
  const checks = [];

  const reconcile = run(homebase, repoPath, 'kit/scripts/cwos-reconcile.js', ['--quiet'], { preferRepo: true });
  checks.push({ name: 'reconcile --quiet', pass: reconcile.code === 0, detail: reconcile.code === 0 ? 'clean' : (reconcile.stderr || reconcile.stdout || `exit ${reconcile.code}`).trim().slice(0, 200) });

  // gate: exit 0 (clear) or 1 (legit gate-block, e.g. token budget) both mean "ran"; 2/crash = fail
  const gate = run(homebase, repoPath, 'kit/scripts/cwos-next.js', ['gate'], { preferRepo: true });
  checks.push({ name: 'next gate', pass: gate.code === 0 || gate.code === 1, detail: `exit ${gate.code}` });

  const alloc = run(homebase, repoPath, 'kit/scripts/cwos-next.js', ['allocate-ws-id'], { preferRepo: true });
  let allocOk = false; try { allocOk = JSON.parse(alloc.stdout.trim()).ok === true; } catch { /* */ }
  checks.push({ name: 'allocate-ws-id (WS-040 guard)', pass: allocOk, detail: alloc.stdout.trim().slice(0, 120) });

  const pulse = run(homebase, repoPath, 'kit/scripts/cwos-pulse.js', ['overview'], { preferRepo: true });
  checks.push({ name: 'pulse overview', pass: pulse.code === 0 || pulse.absent, detail: pulse.absent ? 'script absent (skipped)' : `exit ${pulse.code}` });

  const audit = run(homebase, repoPath, 'kit/scripts/cwos-audit.js', ['focus', 'drift'], { preferRepo: true });
  checks.push({ name: 'audit focus drift', pass: audit.code === 0 || audit.absent, detail: audit.absent ? 'script absent (skipped)' : `exit ${audit.code}` });

  const reg = validateRegistryPaths(repoPath);
  const newlyBroken = reg.unresolved.filter(u => !preUnresolved.has(u.path));
  checks.push({
    name: 'registry path resolution',
    pass: newlyBroken.length === 0,
    detail: newlyBroken.length
      ? `${newlyBroken.length} NEWLY unresolved: ${newlyBroken.map(u => u.path).join(', ').slice(0, 160)}`
      : (reg.ok ? `${reg.checked} paths ok` : `${reg.unresolved.length} pre-existing unresolved (not introduced by upgrade)`),
  });

  const stamped = readInstalledVersion(repoPath);
  checks.push({ name: 'version stamped', pass: stamped === targetVersion, detail: `${stamped} (want ${targetVersion})` });

  // Test seam: force a gate failure to exercise the auto-rollback path deterministically.
  if (process.env.CWOS_KITUPGRADE_FORCE_GATE_FAIL) {
    checks.push({ name: 'forced-failure (test seam)', pass: false, detail: 'CWOS_KITUPGRADE_FORCE_GATE_FAIL set' });
  }

  return { ok: checks.every(c => c.pass), checks };
}

// ─── output helpers ─────────────────────────────────────────────────────────

function emit(opts, human, payload) {
  if (opts.json) process.stdout.write(JSON.stringify(payload) + '\n');
  else process.stdout.write(human + '\n');
}

function printDiff(repoPath, classification, schemaPlan, localMods, baselineInfo) {
  const lines = [];
  const A = classification.new.length + classification.needsInstall.length;
  const M = classification.stock.length;
  const C = classification.customized.length;
  lines.push('');
  lines.push('Schema migrations (run on apply):');
  if (schemaPlan.program.steps.length) lines.push(`  • program schema: ${schemaPlan.program.from} → ${schemaPlan.program.to} (${schemaPlan.program.count} program(s), steps ${schemaPlan.program.steps.join(', ')})`);
  else lines.push('  • program schema: up to date');
  lines.push('  • state-store schema: brought current (idempotent)');
  lines.push('');
  lines.push(`Files — ${M} overwrite, ${A} add, ${C} customized (.kit-update sidecar):`);
  const show = (label, arr) => arr.slice(0, 50).forEach(e => lines.push(`  [${label}] ${e.destination}`));
  show('overwrite', classification.stock);
  show('add', [...classification.new, ...classification.needsInstall]);
  show('.kit-update', classification.customized);
  const total = M + A + C;
  if (total > 150) lines.push(`  … (${total} files total)`);
  lines.push('');
  if (localMods === null) {
    lines.push(`⚠ Local-mod baseline unavailable (no hashes-<version> manifest, no installed_files).`);
    lines.push(`  Customized files are still protected: cwos-migrate writes .kit-update sidecars (git-tag baseline).`);
  } else if (localMods.length) {
    lines.push(`⚠ Local kit modifications detected (baseline: ${baselineInfo}) — overwritten unless saved:`);
    for (const m of localMods.slice(0, 40)) lines.push(`  ${m.destination}\n      ${m.expected} → ${m.actual}`);
    if (localMods.length > 40) lines.push(`  … and ${localMods.length - 40} more`);
  } else {
    lines.push(`✓ No local kit modifications (baseline: ${baselineInfo}).`);
  }
  return lines.join('\n');
}

// ─── main ───────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = { repo: null, homebase: null, apply: false, rollback: false, json: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--homebase' && argv[i + 1]) o.homebase = argv[++i];
    else if (a === '--apply') o.apply = true;
    else if (a === '--rollback') o.rollback = true;
    else if (a === '--json') o.json = true;
    else if (a === '--yes' || a === '-y') o.yes = true;
    else if (a === '--help' || a === '-h') { printUsage(); process.exit(0); }
    else if (!a.startsWith('--') && !o.repo) o.repo = a;
  }
  return o;
}

function printUsage() {
  process.stdout.write([
    'Usage: cwos-kit-upgrade.js [<repo-path>] --homebase <path> [--apply]',
    '       cwos-kit-upgrade.js [<repo-path>] --rollback',
    '',
    'Default is DRY RUN (shows the full diff, writes nothing). Pass --apply to upgrade.',
  ].join('\n') + '\n');
}

function fail(opts, code, msg) {
  if (opts.json) process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
  else process.stderr.write(`ERROR: ${msg}\n`);
  process.exit(code);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repoPath = path.resolve(opts.repo || process.cwd());
  if (!isDir(repoPath)) return fail(opts, 1, `repo path does not exist: ${repoPath}`);

  // ── rollback mode ──
  if (opts.rollback) {
    const snap = latestSnapshot(repoPath);
    if (!snap) return fail(opts, 1, 'no kit-pre-upgrade snapshot found');
    const m = restoreSnapshot(repoPath, snap);
    emit(opts, `Rolled back to ${path.basename(snap)} (was v${m.from_version || '?'} → v${m.to_version || '?'}). Snapshot retained.`, { ok: true, rolled_back: true, snapshot: path.basename(snap), restored_to: m.from_version });
    return;
  }

  if (!fs.existsSync(path.join(repoPath, '.cwos-version'))) {
    return fail(opts, 1, 'no .cwos-version in repo — use /adopt for a fresh install, not /kit-upgrade');
  }

  const homebase = resolveHomeBase(opts.homebase, repoPath);
  if (!homebase || !looksLikeHomeBase(homebase)) {
    return fail(opts, 1, 'could not resolve HomeBase source — pass --homebase "<path to Claude HomeBase>"');
  }
  if (path.resolve(homebase) === repoPath) {
    return fail(opts, 1, 'HomeBase source and target repo are the same path — pass --homebase explicitly');
  }

  // require the NEWEST composed logic from the resolved HomeBase
  let migrate, validateRegistryPaths, loadManifest;
  try {
    migrate = require(path.join(homebase, 'kit', 'scripts', 'cwos-migrate.js'));
    ({ validateRegistryPaths } = require(path.join(homebase, 'kit', 'scripts', 'lib', 'cwos-registry-paths.js')));
    ({ loadManifest } = require(path.join(homebase, 'kit', 'scripts', 'cwos-adopt-install.js')));
  } catch (e) {
    return fail(opts, 1, `could not load HomeBase upgrade modules: ${e.message}`);
  }

  const installedVersion = readInstalledVersion(repoPath);
  const targetVersion = readKitVersion(homebase);
  if (!installedVersion) return fail(opts, 1, 'could not read installed kit version from .cwos-version');

  // ── Phase 0: idempotent no-op ──
  if (installedVersion === targetVersion) {
    const gate = runValidationGate(homebase, repoPath, targetVersion, validateRegistryPaths);
    emit(opts,
      `Already current: kit v${installedVersion} == HomeBase v${targetVersion}. No changes.\n` +
      `Health: ${gate.ok ? 'all checks pass ✓' : 'WARNINGS — ' + gate.checks.filter(c => !c.pass).map(c => c.name).join(', ')}`,
      { ok: true, noop: true, installed: installedVersion, target: targetVersion, gate });
    return;
  }

  // ── Phase 1: schema sequencing (refuse if an intermediate migrator is missing) ──
  const minProg = detectMinProgramSchema(repoPath);
  const tgtProg = targetProgramSchema(homebase);
  const progChain = (minProg !== null && minProg < tgtProg)
    ? resolveSchemaChain(minProg, tgtProg, migrate.SCHEMA_MIGRATIONS)
    : { steps: [], missing: [] };
  if (progChain.missing.length) {
    return fail(opts, 3, `cannot stage upgrade — missing program-schema migrator(s): ${progChain.missing.join(', ')}. ` +
      `Add them to SCHEMA_MIGRATIONS in kit/scripts/cwos-migrate.js before upgrading.`);
  }

  // ── Phase 2: classify + local-mod detection ──
  const manifestFiles = loadManifest(homebase);
  const classification = migrate.classifyFiles(repoPath, homebase, installedVersion);
  const baseline = loadHashBaseline(homebase, repoPath, installedVersion);
  const localMods = detectLocalMods(homebase, repoPath, manifestFiles, baseline);
  const baselineInfo = baseline ? baseline.source : 'unavailable';

  const schemaPlan = {
    program: { from: minProg === null ? 'n/a' : minProg, to: tgtProg, steps: progChain.steps, count: countProgsBelow(repoPath, tgtProg) },
  };

  const header = `Kit upgrade: ${path.basename(repoPath)} (v${installedVersion} → v${targetVersion})${opts.apply ? '' : '  [DRY RUN]'}\nSource: ${homebase}`;

  if (!opts.apply) {
    const diff = printDiff(repoPath, classification, schemaPlan, localMods, baselineInfo);
    emit(opts, header + '\n' + diff + '\n\nRun with --apply to upgrade (snapshot + auto-rollback on gate failure).',
      { ok: true, dry_run: true, installed: installedVersion, target: targetVersion,
        files: { overwrite: classification.stock.length, add: classification.new.length + classification.needsInstall.length, customized: classification.customized.length },
        schema: schemaPlan, local_mods: localMods, baseline: baselineInfo });
    return;
  }

  // ── Phase 3: APPLY under lock ──
  const lockPath = path.join(repoPath, '.claude', 'workstream', '.kit-upgrade.lock');
  ensureDir(path.dirname(lockPath));

  let result;
  try {
    result = withFileLock(lockPath, () => applyUpgrade({
      opts, repoPath, homebase, installedVersion, targetVersion,
      classification, migrate, validateRegistryPaths, progChain,
    }), { ownerLabel: 'kit-upgrade', maxWaitMs: 8000, staleAfterMs: 600000 });
  } catch (e) {
    return fail(opts, 1, `could not acquire upgrade lock (another upgrade running?): ${e.message}`);
  }

  if (!result.ok) {
    emit(opts,
      `${header}\n\n✗ Upgrade FAILED at gate check: ${result.failedCheck}\n  → rolled back to pre-upgrade snapshot (${path.basename(result.snapshot)}).\n  Repo restored to v${installedVersion}.\n\nGate detail:\n` +
      result.gate.checks.map(c => `  ${c.pass ? '✓' : '✗'} ${c.name} — ${c.detail}`).join('\n'),
      { ok: false, applied: false, rolled_back: true, failed_check: result.failedCheck, snapshot: path.basename(result.snapshot), gate: result.gate });
    process.exit(4);
  }

  emit(opts,
    `${header}\n\n✓ Upgrade complete: v${installedVersion} → v${targetVersion}.\n  Snapshot: ${path.basename(result.snapshot)} (retained)\n  Gate: all ${result.gate.checks.length} checks passed.` +
    (classification.customized.length ? `\n\n  Action: review ${classification.customized.length} .kit-update sidecar(s) for your customizations.` : ''),
    { ok: true, applied: true, installed: installedVersion, target: targetVersion, snapshot: path.basename(result.snapshot), gate: result.gate, kit_update_sidecars: classification.customized.map(e => e.destination + '.kit-update') });
}

function countProgsBelow(repoPath, target) {
  const dir = path.join(repoPath, '.claude', 'workstream', 'programs');
  if (!isDir(dir)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!/^prog-.*\.yaml$/.test(f) || f === 'registry.yaml') continue;
    const { ok, data } = readYAMLFile(path.join(dir, f));
    if (ok && data && data.id && (Number(data.schema_version) || 1) < target) n++;
  }
  return n;
}

function applyUpgrade(ctx) {
  const { repoPath, homebase, installedVersion, targetVersion, classification, migrate, validateRegistryPaths } = ctx;

  const destRel = e => String(e.destination || '').replace('{system_dir}', 'system');
  // files the upgrade CREATES → must be deleted on rollback:
  //  - genuinely new/needsInstall files that don't exist yet
  //  - .kit-update sidecars written for customized files
  const createdFiles = [
    ...[...classification.new, ...classification.needsInstall].map(destRel).filter(rel => !fs.existsSync(path.join(repoPath, rel))),
    ...classification.customized.map(e => destRel(e) + '.kit-update'),
  ];

  // registry paths already broken before we touch anything — the gate must not
  // fail (and roll back) on drift that was pre-existing.
  const preUnresolved = new Set(validateRegistryPaths(repoPath).unresolved.map(u => u.path));

  // 3a. comprehensive pre-upgrade snapshot (the rollback source of truth)
  const snapshot = createPreUpgradeSnapshot(repoPath, createdFiles, installedVersion, targetVersion);

  // 3b. file apply + program v2→v3 + index rebuild + version stamp (the existing engine)
  const mig = spawnSync('node', [path.join(homebase, 'kit', 'scripts', 'cwos-migrate.js'), repoPath, '--homebase', homebase],
    { cwd: repoPath, encoding: 'utf8', timeout: 300000 });
  if (mig.status !== 0) {
    restoreSnapshot(repoPath, snapshot);
    return { ok: false, failedCheck: 'cwos-migrate apply (file/schema/stamp)', snapshot, gate: { checks: [{ name: 'cwos-migrate', pass: false, detail: (mig.stderr || mig.stdout || `exit ${mig.status}`).trim().slice(0, 300) }] } };
  }

  // 3c. program v3 → v4 (the step cwos-migrate's main() doesn't run)
  for (const f of fs.readdirSync(path.join(repoPath, '.claude', 'workstream', 'programs'))) {
    if (!/^prog-.*\.yaml$/.test(f) || f === 'registry.yaml') continue;
    const fp = path.join(repoPath, '.claude', 'workstream', 'programs', f);
    const { ok, data } = readYAMLFile(fp);
    if (ok && data && (Number(data.schema_version) || 1) === 3) migrate.migrateSchemaV3ToV4(fp, data);
  }

  // 3d. state-store schema (idempotent)
  spawnSync('node', [path.join(homebase, 'kit', 'scripts', 'cwos-migrate.js'), '--state-schema', '--workstream-dir', path.join(repoPath, '.claude', 'workstream')],
    { cwd: repoPath, encoding: 'utf8', timeout: 60000 });

  // 3e. re-materialize registries (then validated by the gate's path-resolution loop)
  for (const s of ['cwos-program-registry-sync.js', 'cwos-engines-registry-sync.js']) {
    run(homebase, repoPath, `kit/scripts/${s}`, ['--path', repoPath, '--quiet', '--json'], { preferRepo: false });
  }

  // 3f. seed the adopter's local-mod baseline for NEXT time: copy HomeBase's
  // hashes-<target>.yaml into the repo (decision 3 — baseline lives in the
  // adopter as version-named local state, never MANIFEST-orphan-reaped).
  const hbHashes = path.join(homebase, 'kit', `hashes-${targetVersion}.yaml`);
  if (isFile(hbHashes)) {
    ensureDir(path.join(repoPath, 'kit'));
    fs.copyFileSync(hbHashes, path.join(repoPath, 'kit', `hashes-${targetVersion}.yaml`));
  }

  // ── Phase 4: validation gate ──
  const gate = runValidationGate(homebase, repoPath, targetVersion, validateRegistryPaths, preUnresolved);
  if (!gate.ok) {
    // ── Phase 5 (failure): AUTO-rollback ──
    restoreSnapshot(repoPath, snapshot);
    const failed = gate.checks.find(c => !c.pass);
    return { ok: false, failedCheck: failed ? failed.name : 'unknown', snapshot, gate };
  }
  return { ok: true, snapshot, gate };
}

module.exports = {
  resolveSchemaChain, detectMinProgramSchema, targetProgramSchema,
  loadHashBaseline, detectLocalMods, createPreUpgradeSnapshot, restoreSnapshot,
  latestSnapshot, runValidationGate, readInstalledVersion, copyTree,
};

if (require.main === module) main();
