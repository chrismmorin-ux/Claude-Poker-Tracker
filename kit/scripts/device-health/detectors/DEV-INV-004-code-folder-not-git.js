/**
 * DEV-INV-004 — Every working folder containing source code is a git repo
 * with a remote.
 *
 * Reads fleet/registry.yaml. For each non-simulated entry:
 *   - Path must exist
 *   - Path must contain .git/  (else: violation — registered as code but not git)
 *   - Repo must have at least one remote configured
 *     (entries with explicit `has_remote: false` are FLAGGED with their flag —
 *     the flag itself surfaces as a finding so the founder is reminded the
 *     work is unprotected.)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { ok, violate, unknown } = require('../lib/detector-base');
const { readYAMLFile } = require('../../lib/cwos-utils');

function hasGit(p) { return fs.existsSync(path.join(p, '.git')); }

function gitRemoteList(repoPath) {
  try {
    const out = execSync('git remote', {
      cwd: repoPath, encoding: 'utf8', timeout: 5_000, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return out ? out.split('\n').filter(s => s.length > 0) : [];
  } catch {
    return [];
  }
}

module.exports = {
  id: 'DEV-INV-004',
  rule_type: 'invariant',
  description: 'Every working folder containing source code is a git repo with a remote',
  platforms: ['win32', 'darwin', 'linux'],
  default_severity: 'critical',

  async run(ctx) {
    const repoRoot = ctx.repoRoot;
    const registryPath = path.join(repoRoot, 'fleet', 'registry.yaml');
    if (!fs.existsSync(registryPath)) {
      return unknown({ registry_path: registryPath }, 'fleet/registry.yaml not found');
    }

    let registry;
    try {
      const parsed = readYAMLFile(registryPath);
      if (!parsed || !parsed.ok) return unknown({}, 'Failed to parse fleet/registry.yaml');
      registry = parsed.data;
    } catch (err) {
      return unknown({ error: err.message }, `Failed to parse fleet/registry.yaml — ${err.message}`);
    }

    const entries = Array.isArray(registry && registry.repos) ? registry.repos : [];
    const realEntries = entries.filter(e => e && e.type !== 'simulated');

    const notGit = [];
    const noRemote = [];
    const flaggedNoRemote = [];
    const checked = [];

    for (const e of realEntries) {
      if (!e.path || !fs.existsSync(e.path)) continue;
      if (!hasGit(e.path)) {
        notGit.push({ name: e.name, path: e.path });
        continue;
      }
      const remotes = gitRemoteList(e.path);
      if (remotes.length === 0) {
        if (e.has_remote === false) {
          flaggedNoRemote.push({ name: e.name, path: e.path, has_remote_flag: false });
        } else {
          noRemote.push({ name: e.name, path: e.path });
        }
      } else {
        checked.push({ name: e.name, path: e.path, remotes: remotes.length });
      }
    }

    const evidence = {
      total_real_entries: realEntries.length,
      checked,
      registered_but_not_git: notGit,
      no_remote_undeclared: noRemote,
      no_remote_flagged: flaggedNoRemote,
    };

    const totalViolating = notGit.length + noRemote.length + flaggedNoRemote.length;
    if (totalViolating === 0) {
      return ok(evidence, `All ${checked.length} active repos are git with a remote`);
    }

    const parts = [];
    if (notGit.length) parts.push(`${notGit.length} registered but not git: ${notGit.map(r => r.name).join(', ')}`);
    if (noRemote.length) parts.push(`${noRemote.length} git without remote: ${noRemote.map(r => r.name).join(', ')}`);
    if (flaggedNoRemote.length) parts.push(`${flaggedNoRemote.length} flagged no-remote (still at risk): ${flaggedNoRemote.map(r => r.name).join(', ')}`);
    return violate('critical', evidence, parts.join('; '));
  },
};
