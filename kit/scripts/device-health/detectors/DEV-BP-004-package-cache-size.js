/**
 * DEV-BP-004 — Package manager caches reviewed quarterly.
 *
 * Sums npm + pip + uv cache sizes. Threshold: 5 GB combined.
 * Future: also check ~/.claude/.cache-maintenance.yaml for last-reviewed marker.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ok, violate } = require('../lib/detector-base');

const SIZE_THRESHOLD_GB = 5;

function dirSizeBytes(dir, depthLimit = 6) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  function walk(p, depth) {
    if (depth > depthLimit) return;
    let entries;
    try { entries = fs.readdirSync(p, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = path.join(p, e.name);
      try {
        if (e.isFile()) {
          total += fs.statSync(full).size;
        } else if (e.isDirectory()) {
          walk(full, depth + 1);
        }
      } catch { /* skip */ }
    }
  }
  walk(dir, 0);
  return total;
}

function resolveUserHome() {
  return process.env.USERPROFILE || process.env.HOME || null;
}

module.exports = {
  id: 'DEV-BP-004',
  rule_type: 'best_practice',
  description: 'Package manager caches under 5 GB combined',
  platforms: ['win32', 'darwin', 'linux'],
  default_severity: 'medium',

  async run(_ctx) {
    const home = resolveUserHome();
    if (!home) return ok({}, 'No user home; skipping');

    const targets = process.platform === 'win32'
      ? [
          { name: 'npm', dir: path.join(home, 'AppData', 'Local', 'npm-cache') },
          { name: 'pip', dir: path.join(home, 'AppData', 'Local', 'pip', 'Cache') },
          { name: 'uv',  dir: path.join(home, 'AppData', 'Local', 'uv') },
        ]
      : [
          { name: 'npm', dir: path.join(home, '.npm') },
          { name: 'pip', dir: path.join(home, '.cache', 'pip') },
          { name: 'uv',  dir: path.join(home, '.cache', 'uv') },
        ];

    const results = targets.map(t => ({ ...t, size_gb: +(dirSizeBytes(t.dir) / (1024 ** 3)).toFixed(2) }));
    const totalGb = +(results.reduce((s, r) => s + r.size_gb, 0)).toFixed(2);
    const evidence = { caches: results, total_gb: totalGb, threshold_gb: SIZE_THRESHOLD_GB };

    if (totalGb >= SIZE_THRESHOLD_GB) {
      return violate(
        'medium',
        evidence,
        `Package caches total ${totalGb} GB (threshold ${SIZE_THRESHOLD_GB} GB) — flush via npm cache clean / pip cache purge / uv cache clean`
      );
    }
    return ok(evidence, `Package caches total ${totalGb} GB`);
  },
};
