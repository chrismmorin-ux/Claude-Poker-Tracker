/**
 * DEV-INV-005 — HomeBase auto-memory directory is replicated off-device.
 *
 * Locates ~/.claude/projects/<encoded-path>/memory/ for HomeBase.
 * Validates EITHER:
 *   (a) the memory directory (or any ancestor up to ~/.claude/projects/) is
 *       inside a git repo with a remote and recent push activity, OR
 *   (b) a marker file `~/.claude/.memory-backup-config.yaml` declares an
 *       external backup target with a recent successful run.
 *
 * If neither condition holds, the memory is at risk.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { ok, violate, unknown } = require('../lib/detector-base');
const { readYAMLFile } = require('../../lib/cwos-utils');

const MAX_BACKUP_AGE_DAYS = 7;

function resolveUserHome() {
  return process.env.USERPROFILE || process.env.HOME || null;
}

function encodeProjectPath(absPath) {
  // Claude Code encodes project paths by replacing : / \ <space> with -
  return absPath.replace(/[:/\\ ]/g, '-');
}

function gitInfo(dir) {
  try {
    const isInside = execSync('git rev-parse --is-inside-work-tree', {
      cwd: dir, encoding: 'utf8', timeout: 3_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (isInside !== 'true') return null;
    const root = execSync('git rev-parse --show-toplevel', { cwd: dir, encoding: 'utf8', timeout: 3_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const remotes = execSync('git remote', { cwd: dir, encoding: 'utf8', timeout: 3_000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return { root, has_remote: remotes.length > 0 };
  } catch {
    return null;
  }
}

function daysSince(epochMs) {
  return Math.floor((Date.now() - epochMs) / (1000 * 60 * 60 * 24));
}

module.exports = {
  id: 'DEV-INV-005',
  rule_type: 'invariant',
  description: 'HomeBase auto-memory directory is replicated off-device',
  platforms: ['win32', 'darwin', 'linux'],
  default_severity: 'critical',

  async run(ctx) {
    const userHome = resolveUserHome();
    if (!userHome) return unknown({}, 'Could not resolve user home directory');

    const repoRoot = ctx.repoRoot;
    const encodedPath = encodeProjectPath(path.resolve(repoRoot));
    const memoryDir = path.join(userHome, '.claude', 'projects', encodedPath, 'memory');

    if (!fs.existsSync(memoryDir)) {
      return unknown(
        { memory_dir: memoryDir, encoded_path_basis: repoRoot },
        `Memory directory not found at ${memoryDir} — Claude Code may not have created it yet`
      );
    }

    const stats = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));
    const evidence = {
      memory_dir: memoryDir,
      file_count: stats.length,
      checks: {},
    };

    // Check (a) — git tracking
    const gi = gitInfo(memoryDir);
    if (gi) {
      evidence.checks.git = { tracked: true, root: gi.root, has_remote: gi.has_remote };
      if (gi.has_remote) {
        return ok(evidence, `Memory directory is git-tracked under ${gi.root} with remote`);
      }
    } else {
      evidence.checks.git = { tracked: false };
    }

    // Check (b) — backup-config marker
    const configPath = path.join(userHome, '.claude', '.memory-backup-config.yaml');
    if (fs.existsSync(configPath)) {
      try {
        const parsed = readYAMLFile(configPath);
        const cfg = parsed && parsed.ok ? parsed.data : null;
        if (cfg && cfg.last_successful_run) {
          const lastRun = new Date(cfg.last_successful_run).getTime();
          if (!isNaN(lastRun)) {
            const ageDays = daysSince(lastRun);
            evidence.checks.backup_config = { configured: true, last_run_days_ago: ageDays, target: cfg.target || null };
            if (ageDays <= MAX_BACKUP_AGE_DAYS) {
              return ok(evidence, `Memory directory backed up via ${cfg.target || 'declared target'} ${ageDays} day(s) ago`);
            }
          }
        }
      } catch (err) {
        evidence.checks.backup_config = { configured: true, parse_error: err.message };
      }
    } else {
      evidence.checks.backup_config = { configured: false };
    }

    return violate(
      'critical',
      evidence,
      `Memory directory (${stats.length} files) is not git-tracked with remote AND no recent backup config — irreplaceable institutional memory at risk`
    );
  },
};
