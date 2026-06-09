/**
 * DEV-INV-003 — No active repo has > 10 uncommitted files OR has gone
 * > 7 days since last push (excluding archived repos).
 *
 * Per registered repo: git status --porcelain count + ahead-of-upstream count
 * + last-commit date. Skips repos without a remote (DEV-INV-004 owns those).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { runGit } = require('../../lib/shell-safe');
const { ok, violate, unknown } = require('../lib/detector-base');
const { readYAMLFile } = require('../../lib/cwos-utils');

const UNCOMMITTED_THRESHOLD = 10;
const UNPUSHED_AGE_DAYS = 7;

function gitCmd(repoPath, argsString) {
  try {
    // ADR-043: split the literal arg-string into discrete tokens and
    // pass them through runGit (array form, no shell). Internal callers
    // pass curated literal strings ("status --porcelain" etc.) so a
    // simple whitespace split is safe; for any token containing
    // metacharacters, callers must pass an array directly via runGit.
    const args = argsString.trim().split(/\s+/);
    const r = runGit(args, { cwd: repoPath, timeout: 10_000, stdio: ['ignore', 'pipe', 'pipe'] });
    return r.ok ? String(r.stdout).trim() : null;
  } catch {
    return null;
  }
}

function daysSince(isoDate) {
  if (!isoDate) return null;
  const then = new Date(isoDate).getTime();
  if (isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

module.exports = {
  id: 'DEV-INV-003',
  rule_type: 'invariant',
  description: 'No active repo has > 10 uncommitted files OR > 7 days since last push',
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
    const candidates = entries.filter(
      e => e && e.type !== 'simulated' && e.archived !== true && e.has_remote !== false
    );

    const violations = [];
    const checked = [];
    for (const e of candidates) {
      if (!e.path || !fs.existsSync(e.path)) continue;
      if (!fs.existsSync(path.join(e.path, '.git'))) continue;

      const porcelain = gitCmd(e.path, 'status --porcelain');
      const uncommittedCount = porcelain ? porcelain.split('\n').filter(l => l.length > 0).length : 0;

      // Ahead-of-upstream count
      const aheadStr = gitCmd(e.path, 'rev-list --count @{u}..HEAD');
      const unpushedCount = aheadStr != null && /^\d+$/.test(aheadStr) ? parseInt(aheadStr, 10) : 0;

      // Last commit date (committer-iso, last commit on current branch)
      const lastCommitDate = gitCmd(e.path, 'log -1 --format=%cI HEAD');
      const lastCommitDays = daysSince(lastCommitDate);

      const repoFinding = {
        name: e.name,
        path: e.path,
        uncommitted_files: uncommittedCount,
        unpushed_commits: unpushedCount,
        last_commit_date: lastCommitDate,
        last_commit_days_ago: lastCommitDays,
        violations: [],
      };

      if (uncommittedCount > UNCOMMITTED_THRESHOLD) {
        repoFinding.violations.push(`uncommitted_files > ${UNCOMMITTED_THRESHOLD}`);
      }
      if (unpushedCount > 0 && lastCommitDays != null && lastCommitDays > UNPUSHED_AGE_DAYS) {
        repoFinding.violations.push(`unpushed_for > ${UNPUSHED_AGE_DAYS} days`);
      } else if (unpushedCount > 0 && lastCommitDays == null) {
        repoFinding.violations.push('unpushed_commits_no_date');
      }

      checked.push(repoFinding);
      if (repoFinding.violations.length > 0) {
        violations.push(repoFinding);
      }
    }

    const evidence = {
      checked_repos: checked.length,
      thresholds: { uncommitted_max: UNCOMMITTED_THRESHOLD, unpushed_max_age_days: UNPUSHED_AGE_DAYS },
      repos_in_violation: violations,
    };

    if (violations.length === 0) {
      return ok(evidence, `All ${checked.length} repos within thresholds`);
    }

    return violate(
      'critical',
      evidence,
      `${violations.length} repo(s) at risk: ${violations.map(v => `${v.name} (${v.uncommitted_files}u/${v.unpushed_commits}p)`).join('; ')}`
    );
  },
};
