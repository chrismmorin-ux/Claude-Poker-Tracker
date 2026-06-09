/**
 * DEV-BP-005 — Repos with no commits in 60 days are explicitly archived.
 *
 * For each non-archived registered repo, check last commit date. Repos
 * with > 60 days idle are flagged.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { ok, violate, unknown } = require('../lib/detector-base');
const { readYAMLFile } = require('../../lib/cwos-utils');

const STALE_THRESHOLD_DAYS = 60;

function lastCommitDate(repoPath) {
  try {
    const out = execSync('git log -1 --format=%cI', {
      cwd: repoPath, encoding: 'utf8', timeout: 5_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function daysSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

module.exports = {
  id: 'DEV-BP-005',
  rule_type: 'best_practice',
  description: 'Repos with no commits in 60 days are explicitly archived',
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

    const stale = [];
    const checked = [];
    for (const e of candidates) {
      if (!fs.existsSync(path.join(e.path, '.git'))) continue;
      const last = lastCommitDate(e.path);
      const days = daysSince(last);
      checked.push({ name: e.name, last_commit: last, days_ago: days });
      if (days != null && days > STALE_THRESHOLD_DAYS) {
        stale.push({ name: e.name, path: e.path, last_commit: last, days_ago: days });
      }
    }

    const evidence = { checked: checked.length, stale_threshold_days: STALE_THRESHOLD_DAYS, stale };

    if (stale.length === 0) {
      return ok(evidence, `All ${checked.length} active repos have commits within ${STALE_THRESHOLD_DAYS} days`);
    }
    return violate(
      'low',
      evidence,
      `${stale.length} repo(s) idle > ${STALE_THRESHOLD_DAYS} days: ${stale.map(s => `${s.name} (${s.days_ago}d)`).join(', ')}`
    );
  },
};
