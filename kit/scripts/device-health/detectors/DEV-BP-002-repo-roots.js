/**
 * DEV-BP-002 — Repos clustered under one root path.
 *
 * Counts distinct top-level roots across active fleet entries.
 * One root or fewer = passing. More than one = soft violation.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ok, violate, unknown } = require('../lib/detector-base');
const { readYAMLFile } = require('../../lib/cwos-utils');

function topLevelRoot(p) {
  if (!p) return null;
  // Normalize separators, take parent of immediate parent
  const norm = p.replace(/\\/g, '/').replace(/\/$/, '');
  const parts = norm.split('/');
  // Drop the repo name itself; keep the parent path
  return parts.slice(0, parts.length - 1).join('/').toLowerCase();
}

module.exports = {
  id: 'DEV-BP-002',
  rule_type: 'best_practice',
  description: 'Repos clustered under one root path',
  platforms: ['win32', 'darwin', 'linux'],
  default_severity: 'low',

  async run(ctx) {
    const repoRoot = ctx.repoRoot;
    const registryPath = path.join(repoRoot, 'fleet', 'registry.yaml');
    if (!fs.existsSync(registryPath)) return unknown({}, 'fleet/registry.yaml not found');

    let registry;
    try {
      const parsed = readYAMLFile(registryPath);
      if (!parsed || !parsed.ok) return unknown({}, 'Failed to parse fleet/registry.yaml');
      registry = parsed.data;
    } catch (err) {
      return unknown({ error: err.message }, `Failed to parse: ${err.message}`);
    }

    const entries = (registry.repos || []).filter(e => e && e.type !== 'simulated' && e.path);
    const roots = new Map();
    for (const e of entries) {
      const r = topLevelRoot(e.path);
      if (!r) continue;
      if (!roots.has(r)) roots.set(r, []);
      roots.get(r).push(e.name);
    }

    const rootCount = roots.size;
    const breakdown = Array.from(roots.entries()).map(([root, names]) => ({ root, repos: names }));
    const evidence = { distinct_roots: rootCount, breakdown };

    if (rootCount <= 1) {
      return ok(evidence, `All ${entries.length} repos under a single root`);
    }
    return violate('low', evidence, `Repos split across ${rootCount} roots — consolidate for clarity`);
  },
};
