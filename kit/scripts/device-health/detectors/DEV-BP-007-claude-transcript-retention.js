/**
 * DEV-BP-007 — ~/.claude/projects/ retention policy applied.
 *
 * Computes total size + file count of ~/.claude/projects/. Flags if size
 * exceeds threshold (1 GB) AND no retention marker (~/.claude/.retention-policy.yaml)
 * is present + recent.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ok, violate, unknown } = require('../lib/detector-base');
const { readYAMLFile } = require('../../lib/cwos-utils');

const SIZE_THRESHOLD_GB = 1;
const RETENTION_MAX_AGE_DAYS = 90;

function dirStats(dir, depthLimit = 6) {
  if (!fs.existsSync(dir)) return { size: 0, count: 0 };
  let size = 0, count = 0;
  function walk(p, depth) {
    if (depth > depthLimit) return;
    let entries;
    try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(p, e.name);
      try {
        if (e.isFile()) {
          size += fs.statSync(full).size;
          count += 1;
        } else if (e.isDirectory()) {
          walk(full, depth + 1);
        }
      } catch { /* skip */ }
    }
  }
  walk(dir, 0);
  return { size, count };
}

function resolveUserHome() { return process.env.USERPROFILE || process.env.HOME || null; }
function daysSince(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

module.exports = {
  id: 'DEV-BP-007',
  rule_type: 'best_practice',
  description: '~/.claude/projects/ retention policy applied',
  platforms: ['win32', 'darwin', 'linux'],
  default_severity: 'low',

  async run(_ctx) {
    const home = resolveUserHome();
    if (!home) return unknown({}, 'No user home');
    const projectsDir = path.join(home, '.claude', 'projects');
    if (!fs.existsSync(projectsDir)) {
      return ok({ projects_dir: projectsDir, exists: false }, 'No ~/.claude/projects yet');
    }

    const stats = dirStats(projectsDir);
    const sizeGb = +(stats.size / (1024 ** 3)).toFixed(2);

    // Check retention policy marker
    const policyPath = path.join(home, '.claude', '.retention-policy.yaml');
    let policyAgeDays = null;
    if (fs.existsSync(policyPath)) {
      try {
        const parsed = readYAMLFile(policyPath);
        const cfg = parsed && parsed.ok ? parsed.data : null;
        if (cfg && cfg.last_applied) policyAgeDays = daysSince(cfg.last_applied);
      } catch { /* ignore */ }
    }

    const evidence = {
      projects_dir: projectsDir,
      size_gb: sizeGb,
      file_count: stats.count,
      threshold_gb: SIZE_THRESHOLD_GB,
      retention_policy_present: fs.existsSync(policyPath),
      retention_last_applied_days_ago: policyAgeDays,
      retention_max_age_days: RETENTION_MAX_AGE_DAYS,
    };

    const oversized = sizeGb >= SIZE_THRESHOLD_GB;
    const policyStale = !fs.existsSync(policyPath) || policyAgeDays == null || policyAgeDays > RETENTION_MAX_AGE_DAYS;

    if (oversized && policyStale) {
      return violate(
        'low',
        evidence,
        `~/.claude/projects/ is ${sizeGb} GB across ${stats.count} files with no recent retention policy applied`
      );
    }
    return ok(evidence, `~/.claude/projects/ is ${sizeGb} GB (${stats.count} files)`);
  },
};
