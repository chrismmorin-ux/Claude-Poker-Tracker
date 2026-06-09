/**
 * DEV-INV-007 — Every git repo under known repo roots is registered in
 * fleet/registry.yaml at its actual path; conversely, every active entry
 * in fleet/registry.yaml resolves to an existing directory containing .git/.
 *
 * Pure Node.js + cwos-utils YAML parse. No PowerShell needed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ok, violate, unknown } = require('../lib/detector-base');
const { readYAMLFile } = require('../../lib/cwos-utils');

const KNOWN_REPO_ROOTS_RELATIVE_TO_USER = [
  '',                  // C:\Users\chris\
  'OneDrive\\Desktop', // C:\Users\chris\OneDrive\Desktop\
  'AI Repos',          // C:\Users\chris\AI Repos\
];

function resolveUserHome() {
  return process.env.USERPROFILE || process.env.HOME || null;
}

function normalizePath(p) {
  if (!p) return p;
  return p.replace(/\\/g, '/').toLowerCase();
}

function isGitRepo(dir) {
  return fs.existsSync(path.join(dir, '.git'));
}

module.exports = {
  id: 'DEV-INV-007',
  rule_type: 'invariant',
  description: 'Every git repo under known repo roots is registered in fleet/registry.yaml at its actual path',
  platforms: ['win32', 'darwin', 'linux'],
  default_severity: 'medium',

  async run(ctx) {
    const repoRoot = ctx.repoRoot;
    const registryPath = path.join(repoRoot, 'fleet', 'registry.yaml');
    if (!fs.existsSync(registryPath)) {
      return unknown({ registry_path: registryPath }, 'fleet/registry.yaml not found');
    }

    let registry;
    try {
      const parsed = readYAMLFile(registryPath);
      if (!parsed || !parsed.ok) {
        return unknown({ warnings: parsed && parsed.warnings }, 'Failed to parse fleet/registry.yaml');
      }
      registry = parsed.data;
    } catch (err) {
      return unknown({ error: err.message }, `Failed to parse fleet/registry.yaml — ${err.message}`);
    }

    const entries = Array.isArray(registry && registry.repos) ? registry.repos : [];
    const realEntries = entries.filter(e => e && e.type !== 'simulated');

    // Side A: every active entry resolves to an existing dir with .git/
    const missingPaths = [];
    const notGit = [];
    for (const e of realEntries) {
      if (!e.path) continue;
      const exists = fs.existsSync(e.path);
      if (!exists) {
        missingPaths.push({ name: e.name, path: e.path });
        continue;
      }
      if (!isGitRepo(e.path) && e.has_remote !== false) {
        // has_remote: false is an explicit marker that the entry knows about non-git/git-no-remote state
        notGit.push({ name: e.name, path: e.path });
      }
    }

    // Side B: every git repo under known roots is registered
    const userHome = resolveUserHome();
    const unregistered = [];
    if (userHome) {
      const registeredPathsLc = new Set(realEntries.map(e => normalizePath(e.path)));
      for (const rel of KNOWN_REPO_ROOTS_RELATIVE_TO_USER) {
        const rootDir = path.join(userHome, rel);
        if (!fs.existsSync(rootDir)) continue;
        let children;
        try {
          children = fs.readdirSync(rootDir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const child of children) {
          if (!child.isDirectory()) continue;
          const childPath = path.join(rootDir, child.name);
          if (!isGitRepo(childPath)) continue;
          // Skip HomeBase itself — it's not in fleet/registry.yaml by design
          if (path.resolve(childPath) === path.resolve(repoRoot)) continue;
          if (!registeredPathsLc.has(normalizePath(childPath))) {
            unregistered.push({ path: childPath });
          }
        }
      }
    }

    const evidence = {
      registered_real_repos: realEntries.length,
      missing_paths: missingPaths,
      registered_but_not_git: notGit,
      unregistered_git_repos: unregistered,
      user_home: userHome,
    };

    const violations = missingPaths.length + notGit.length + unregistered.length;
    if (violations === 0) {
      return ok(evidence, `All ${realEntries.length} registered repos resolve; no unregistered git repos under known roots`);
    }

    const parts = [];
    if (missingPaths.length) parts.push(`${missingPaths.length} registry entry(ies) point to non-existent paths`);
    if (notGit.length) parts.push(`${notGit.length} registered path(s) are not git repos`);
    if (unregistered.length) parts.push(`${unregistered.length} git repo(s) under known roots are not registered`);
    return violate('medium', evidence, parts.join('; '));
  },
};
