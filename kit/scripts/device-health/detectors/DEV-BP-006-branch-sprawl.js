/**
 * DEV-BP-006 — Branch count per active repo < 20.
 *
 * `git branch -a` count per registered repo.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { ok, violate, unknown } = require('../lib/detector-base');
const { readYAMLFile } = require('../../lib/cwos-utils');

const BRANCH_THRESHOLD = 20;

function branchCount(repoPath) {
  try {
    const out = execSync('git branch -a', {
      cwd: repoPath, encoding: 'utf8', timeout: 5_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.split('\n').filter(l => l.trim().length > 0).length;
  } catch {
    return null;
  }
}

module.exports = {
  id: 'DEV-BP-006',
  rule_type: 'best_practice',
  description: 'Branch count per active repo < 20',
  platforms: ['win32', 'darwin', 'linux'],
  default_severity: 'low',

  async run(ctx) {
    const registryPath = path.join(ctx.repoRoot, 'fleet', 'registry.yaml');
    if (!fs.existsSync(registryPath)) return unknown({}, 'fleet/registry.yaml not found');

    let registry;
    try {
      const parsed = readYAMLFile(registryPath);
      if (!parsed || !parsed.ok) return unknown({}, 'Failed to parse fleet/registry.yaml');
      registry = parsed.data;
    } catch (err) {
      return unknown({ error: err.message }, `Parse failed: ${err.message}`);
    }

    const candidates = (registry.repos || []).filter(
      e => e && e.type !== 'simulated' && e.archived !== true && e.path && fs.existsSync(e.path)
    );

    const sprawl = [];
    const checked = [];
    for (const e of candidates) {
      if (!fs.existsSync(path.join(e.path, '.git'))) continue;
      const count = branchCount(e.path);
      if (count == null) continue;
      checked.push({ name: e.name, branch_count: count });
      if (count >= BRANCH_THRESHOLD) {
        sprawl.push({ name: e.name, branch_count: count });
      }
    }

    const evidence = { checked: checked.length, threshold: BRANCH_THRESHOLD, sprawl };
    if (sprawl.length === 0) {
      return ok(evidence, `All ${checked.length} repos under ${BRANCH_THRESHOLD} branches`);
    }
    return violate(
      'low',
      evidence,
      `${sprawl.length} repo(s) over ${BRANCH_THRESHOLD} branches: ${sprawl.map(s => `${s.name} (${s.branch_count})`).join(', ')}`
    );
  },
};
