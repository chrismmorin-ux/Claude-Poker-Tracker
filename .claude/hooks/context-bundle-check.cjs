#!/usr/bin/env node
/**
 * context-bundle-check.cjs — SessionStart hook. The repo-local caller for the
 * context-bundle validator (WS-424 / D1).
 *
 * WHY THIS FILE EXISTS AT ALL. The validator used to be delegated from
 * `kit/scripts/cwos-reconcile.js` Phase 2c2. That file is kit-managed: its recorded
 * hash in `kit/hashes-3.8.5.yaml:233` no longer matched the file on disk, meaning the
 * next `/kit-upgrade` would have reverted the delegation silently and taken the whole
 * check with it, leaving no trace that it had ever run. The constraint was already
 * written down in this very directory — `readiness-gate.cjs:12-15` — and was violated
 * anyway. Hooks are repo-local and survive.
 *
 * ENFORCEMENT CLASS: WARN (S9, clause 3).
 *   Block an irreversible act. FAIL a check with no legitimate exception. WARN a check
 *   whose failure may be evidence about the DECLARATION rather than about the item.
 * Every state this validator reports is one a healthy repo is legitimately in for a
 * while: a drifted hash means a source file was edited, which is normal work; a
 * breached budget means a bundle is growing, which is worth seeing before it is worth
 * stopping; an unbundled task means nobody has scoped it yet. A check that blocked on
 * any of those would be routed around within a week, and a routed-around check is
 * worse than no check because it still looks like coverage.
 *
 * FAILS OPEN. Absent script, bad JSON, timeout, or any throw exits 0 silently.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const VALIDATOR = path.join(REPO_ROOT, 'scripts', 'context', 'cwos-context-bundle-validate.cjs');

try {
  if (!fs.existsSync(VALIDATOR)) process.exit(0);

  const res = spawnSync('node', [VALIDATOR, '--json'], {
    encoding: 'utf8', timeout: 10000, cwd: REPO_ROOT,
  });
  if (res.signal || res.error || res.status !== 0) process.exit(0);

  let report;
  try { report = JSON.parse(res.stdout); } catch { process.exit(0); }

  const violations = report && report.violations;
  if (!Array.isArray(violations) || violations.length === 0) process.exit(0);

  // Group by type so a recurring class reads as one line rather than N.
  const byType = new Map();
  for (const v of violations) {
    if (!byType.has(v.type)) byType.set(v.type, []);
    byType.get(v.type).push(v.bundle_id || v.item_id || '?');
  }

  const lines = [`Context bundles: ${violations.length} advisory finding(s) — none block.`];
  for (const [type, ids] of byType) {
    const shown = ids.slice(0, 4).join(', ');
    const more = ids.length > 4 ? ` +${ids.length - 4} more` : '';
    lines.push(`  [${type}] ${shown}${more}`);
  }
  lines.push('  Detail: node scripts/context/cwos-context-bundle-validate.cjs');

  process.stdout.write(lines.join('\n'));
  process.exit(0);
} catch {
  process.exit(0);
}
