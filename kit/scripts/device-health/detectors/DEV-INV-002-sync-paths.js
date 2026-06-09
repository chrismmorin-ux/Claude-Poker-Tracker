/**
 * DEV-INV-002 — No active git repo lives under a cloud-synced folder.
 *
 * Walks fleet/registry.yaml; for each non-archived real entry, checks
 * whether the path is descended from any known sync prefix (OneDrive,
 * Dropbox, iCloud, Google Drive).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ok, violate, unknown } = require('../lib/detector-base');
const { readYAMLFile } = require('../../lib/cwos-utils');

const SYNC_PREFIXES = [
  // case-insensitive substring match against normalized path
  'onedrive\\',
  'onedrive/',
  '\\dropbox\\',
  '/dropbox/',
  '\\icloud',
  '/icloud',
  'google drive',
];

function normalize(p) {
  return (p || '').toLowerCase();
}

function matchesSync(p) {
  const n = normalize(p);
  for (const prefix of SYNC_PREFIXES) {
    if (n.includes(prefix)) return prefix;
  }
  return null;
}

module.exports = {
  id: 'DEV-INV-002',
  rule_type: 'invariant',
  description: 'No active git repo lives under a cloud-synced folder',
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
    const realActive = entries.filter(e => e && e.type !== 'simulated' && e.archived !== true);

    const onSync = [];
    for (const e of realActive) {
      if (!e.path) continue;
      const matched = matchesSync(e.path);
      if (matched) {
        onSync.push({ name: e.name, path: e.path, sync_prefix_matched: matched });
      }
    }

    const evidence = {
      total_active_repos: realActive.length,
      repos_on_sync_path: onSync,
      sync_prefixes_checked: SYNC_PREFIXES,
    };

    if (onSync.length === 0) {
      return ok(evidence, `All ${realActive.length} active repos are outside cloud-synced folders`);
    }

    return violate(
      'critical',
      evidence,
      `${onSync.length} active repo(s) under cloud-synced folder — silent .git corruption risk: ${onSync.map(r => r.name).join(', ')}`
    );
  },
};
