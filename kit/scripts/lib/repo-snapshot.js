/**
 * repo-snapshot.js — pre-mutation snapshot + restore for repo-wide operations.
 *
 * Generalized from cwos-kit-upgrade.js, which pioneered the mechanism ("never a
 * half-upgrade"): capture the surfaces an operation is about to overwrite, and
 * on failure put them back exactly. WS-503 extends the same contract to /adopt,
 * whose crash mode is worse — it mutates CLAUDE.md at Phase 3 but writes the
 * .cwos-version marker at Phase 7, so a crash between them leaves a half-adopted
 * repo that --repair refuses to touch.
 *
 * Two restore modes, because the two callers need different semantics:
 *
 *   overlay  — copy the snapshot back over the current tree (kit-upgrade).
 *              Files ADDED inside a snapshotted dir survive. Correct there:
 *              the upgrade's own created-file list drives their deletion.
 *   replace  — delete each snapshotted dir, then restore it (adopt). Files added
 *              during the failed run are pruned. Correct there: adopt creates
 *              hundreds of files across .claude/ and kit/ with no reliable
 *              on-disk record after a crash.
 *
 * Either way, paths recorded as absent at snapshot time are DELETED on restore —
 * that is what returns a virgin repo to virgin.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SNAPSHOT_ROOT = '.cwos-snapshots';

// ─── small fs helpers (Node floor is v14 — no fs.cpSync) ────────────────────

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
      if (ent.name === SNAPSHOT_ROOT || ent.name === '.git' || ent.name === 'node_modules') continue;
      copyTree(s, d);
    } else if (ent.isFile()) {
      ensureDir(path.dirname(d));
      fs.copyFileSync(s, d);
    }
  }
}

function snapshotRoot(repoPath) { return path.join(repoPath, SNAPSHOT_ROOT); }

/**
 * Ignore snapshot storage. Runs BEFORE .gitignore is captured (WS-502): a
 * restore retains the snapshot dir, so the ignore line has to survive with it —
 * capturing first would revert .gitignore to a state leaving the retained
 * snapshot untracked-and-unignored, i.e. committable by accident.
 */
function ensureGitignore(repoPath) {
  const gi = path.join(repoPath, '.gitignore');
  try {
    const cur = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
    if (!cur.includes(SNAPSHOT_ROOT)) {
      fs.appendFileSync(gi, (cur.endsWith('\n') || !cur ? '' : '\n') + SNAPSHOT_ROOT + '/\n');
    }
  } catch { /* non-fatal */ }
}

/**
 * Capture `dirs` and `files` (repo-relative) under .cwos-snapshots/<prefix><ts>/.
 *
 * @param {string} repoPath
 * @param {object} opts
 * @param {string[]} opts.dirs         repo-relative dirs to capture
 * @param {string[]} opts.files        repo-relative files to capture
 * @param {string[]} [opts.createdFiles] files the operation will create → deleted on restore
 * @param {string}   [opts.prefix]     snapshot dir name prefix
 * @param {object}   [opts.meta]       extra manifest fields (from_version, etc.)
 * @returns {string} absolute path to the snapshot directory
 */
function createSnapshot(repoPath, opts = {}) {
  const dirs = opts.dirs || [];
  const files = opts.files || [];
  const prefix = opts.prefix || 'snapshot-';
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const root = path.join(snapshotRoot(repoPath), `${prefix}${ts}`);
  ensureDir(root);

  ensureGitignore(repoPath); // before capture — see the note on the function

  // Paths absent right now are deleted on restore, which is how a virgin repo
  // returns to virgin after a failed adopt.
  const absentDirs = [];
  const absentFiles = [];

  for (const rel of dirs) {
    const src = path.join(repoPath, rel);
    if (isDir(src)) copyTree(src, path.join(root, rel));
    else absentDirs.push(rel);
  }
  for (const rel of files) {
    const src = path.join(repoPath, rel);
    if (isFile(src)) {
      ensureDir(path.join(root, path.dirname(rel)));
      fs.copyFileSync(src, path.join(root, rel));
    } else {
      absentFiles.push(rel);
    }
  }

  const manifest = Object.assign({
    created_at: new Date().toISOString(),
    snapshot_dirs: dirs,
    snapshot_files: files,
    absent_dirs: absentDirs,
    absent_files: absentFiles,
    created_files: opts.createdFiles || [],
  }, opts.meta || {});
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return root;
}

/**
 * Put the repo back the way createSnapshot() found it.
 *
 * @param {string} repoPath
 * @param {string} snapDir
 * @param {object} [opts]
 * @param {'overlay'|'replace'} [opts.mode='overlay']
 * @param {string[]} [opts.defaultDirs]  used when the manifest is unreadable
 * @param {string[]} [opts.defaultFiles]
 * @returns {object} the manifest that drove the restore
 */
function restoreSnapshot(repoPath, snapDir, opts = {}) {
  const mode = opts.mode || 'overlay';
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(path.join(snapDir, 'manifest.json'), 'utf8')); }
  catch { /* best effort — fall back to the caller's defaults */ }

  // 1. delete files the failed operation created
  for (const rel of (manifest.created_files || [])) {
    const p = path.join(repoPath, rel);
    try { if (isFile(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }

  // 2. remove paths that did not exist when we snapshotted
  for (const rel of (manifest.absent_dirs || [])) {
    try { fs.rmSync(path.join(repoPath, rel), { recursive: true, force: true }); } catch { /* ignore */ }
  }
  for (const rel of (manifest.absent_files || [])) {
    try { fs.rmSync(path.join(repoPath, rel), { force: true }); } catch { /* ignore */ }
  }

  // 3. restore captured dirs
  const dirs = manifest.snapshot_dirs || opts.defaultDirs || [];
  for (const rel of dirs) {
    const src = path.join(snapDir, rel);
    if (!isDir(src)) continue; // absent at capture — handled in step 2
    const dst = path.join(repoPath, rel);
    if (mode === 'replace') {
      // prune anything the failed run added inside this dir
      try { fs.rmSync(dst, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    copyTree(src, dst);
  }

  // 4. restore captured files
  const files = manifest.snapshot_files || opts.defaultFiles || [];
  for (const rel of files) {
    const src = path.join(snapDir, rel);
    if (!isFile(src)) continue;
    ensureDir(path.join(repoPath, path.dirname(rel)));
    fs.copyFileSync(src, path.join(repoPath, rel));
  }

  return manifest;
}

/** Most recent snapshot for `prefix`, or null. */
function latestSnapshot(repoPath, prefix) {
  const root = snapshotRoot(repoPath);
  if (!isDir(root)) return null;
  const pre = prefix || '';
  const dirs = fs.readdirSync(root)
    .filter(d => d.startsWith(pre) && isDir(path.join(root, d)))
    .sort();
  return dirs.length ? path.join(root, dirs[dirs.length - 1]) : null;
}

module.exports = {
  SNAPSHOT_ROOT,
  createSnapshot, restoreSnapshot, latestSnapshot,
  copyTree, ensureGitignore, snapshotRoot,
};
