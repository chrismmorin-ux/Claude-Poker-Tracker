#!/usr/bin/env node
/**
 * cwos-staleness — Detect canonical files past their freshness SLA.
 *
 * Some files must be kept current because others depend on their accuracy:
 *   - system/state.md — every session (vital signs, queue counts, sprint status)
 *   - system/intention.md — every /checkpoint or every 30 days
 *   - docs/PRODUCT.md, docs/VALUE-MODEL.md — every 30 days
 *   - active plan docs (docs/*-plan.md not retired) — when phases advance
 *
 * This script reads each tracked file's "Last updated:" header line, compares
 * it to today, and reports violations of the SLA. The SLA is configured in
 * `.claude/workstream/config.yaml` under `staleness_sla`, with a built-in
 * default list (below) used when config is absent.
 *
 * Root cause for the 2026-04-20 incident: `system/state.md` went 10 days
 * stale across 11 sprint completions with no signal.
 *
 * Usage:
 *   node cwos-staleness.js                 # human report
 *   node cwos-staleness.js --quiet         # silent unless violations
 *   node cwos-staleness.js --strict        # exit 1 on any violation
 *   node cwos-staleness.js --json          # machine-readable
 *   node cwos-staleness.js --workstream-dir <p>
 */

'use strict';

require('./lib/preflight');

const path = require('path');
const fs = require('fs');
const { findWorkstreamDir, readYAMLFile, todayISO } = require('./lib/cwos-utils');

// Default SLA — used when config.yaml doesn't specify staleness_sla.
// File paths are relative to repoRoot.
const DEFAULT_SLA = [
  { file: 'system/state.md',    max_days: 3,  required: true,  description: 'Refresh at session-end / sprint boundary' },
  { file: 'system/intention.md', max_days: 30, required: false, description: 'Refresh per /checkpoint or every 30 days' },
  { file: 'docs/PRODUCT.md',     max_days: 45, required: false, description: 'Product definition — refresh when principles or target user change' },
  { file: 'docs/VALUE-MODEL.md', max_days: 45, required: false, description: 'Value model — refresh when fleet or archetypes change' },
];

function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const strict = args.includes('--strict');
  const asJson = args.includes('--json');

  let wsDir;
  const dirIdx = args.indexOf('--workstream-dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    wsDir = path.resolve(args[dirIdx + 1]);
  } else {
    try { wsDir = findWorkstreamDir(process.cwd()); }
    catch {
      if (!quiet) process.stderr.write('staleness: no workstream dir found\n');
      return 0;
    }
  }

  const repoRoot = path.resolve(wsDir, '..', '..');
  const sla = loadSLA(wsDir);

  // Also include active plan docs automatically (files named *-plan.md).
  addActivePlanDocs(repoRoot, sla);

  const today = new Date(todayISO());
  const violations = [];
  const report = { today: todayISO(), items: [] };

  for (const rule of sla) {
    const filePath = path.join(repoRoot, rule.file);
    if (!fs.existsSync(filePath)) {
      if (rule.required) {
        violations.push({ file: rule.file, type: 'missing_required_file', message: `Required file missing: ${rule.file}` });
      }
      report.items.push({ file: rule.file, status: 'missing', max_days: rule.max_days });
      continue;
    }

    const lastUpdated = readLastUpdatedDate(filePath);
    if (lastUpdated === null) {
      violations.push({
        file: rule.file,
        type: 'no_last_updated_header',
        message: `${rule.file} has no parseable "Last updated:" header — cannot verify freshness`,
      });
      report.items.push({ file: rule.file, status: 'no_header', max_days: rule.max_days });
      continue;
    }

    const daysSince = Math.floor((today - lastUpdated) / (1000 * 60 * 60 * 24));
    const stale = daysSince > rule.max_days;
    report.items.push({
      file: rule.file,
      status: stale ? 'stale' : 'fresh',
      last_updated: lastUpdated.toISOString().slice(0, 10),
      days_since: daysSince,
      max_days: rule.max_days,
    });
    if (stale) {
      violations.push({
        file: rule.file,
        type: 'stale',
        days_since: daysSince,
        max_days: rule.max_days,
        message: `${rule.file} is ${daysSince}d stale (SLA: ${rule.max_days}d). ${rule.description}`,
      });
    }
  }

  report.violations = violations;

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else if (!quiet || violations.length > 0) {
    printReport(report);
  }

  return strict && violations.length > 0 ? 1 : 0;
}

// ─── SLA Loading ───────────────────────────────────────────────────────────

function loadSLA(wsDir) {
  const configPath = path.join(wsDir, 'config.yaml');
  if (!fs.existsSync(configPath)) return [...DEFAULT_SLA];
  const { ok, data } = readYAMLFile(configPath);
  if (!ok || !data || !Array.isArray(data.staleness_sla)) return [...DEFAULT_SLA];
  // Validate each entry; fall back to defaults if malformed.
  const valid = data.staleness_sla.filter(s => s && s.file && Number.isFinite(s.max_days));
  return valid.length > 0 ? valid : [...DEFAULT_SLA];
}

function addActivePlanDocs(repoRoot, sla) {
  const docsDir = path.join(repoRoot, 'docs');
  if (!fs.existsSync(docsDir)) return;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'archive') continue;
        walk(full);
      } else if (entry.isFile() && /-plan\.md$/.test(entry.name)) {
        const rel = path.relative(repoRoot, full).replace(/\\/g, '/');
        // Skip if already in SLA
        if (sla.some(r => r.file === rel)) continue;
        // Skip if explicitly retired
        const content = fs.readFileSync(full, 'utf8');
        if (/\*\*Status:\*\*.*retired/i.test(content)) continue;
        sla.push({
          file: rel,
          max_days: 7,
          required: false,
          description: 'Active plan doc — refresh when phase advances or decisions log updates',
        });
      }
    }
  }
  walk(docsDir);
}

// ─── Last-Updated Parsing ──────────────────────────────────────────────────

function readLastUpdatedDate(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Try several common patterns:
  //   "Last updated: 2026-04-20"
  //   "Last updated: 2026-04-20 (session summary)"
  //   "_Last updated: 2026-04-20_"
  //   "> **Started:** 2026-04-20" (for plan docs — use start as fallback)
  const patterns = [
    /Last updated:\s*(\d{4}-\d{2}-\d{2})/i,
    /\*\*Last updated:\*\*\s*(\d{4}-\d{2}-\d{2})/i,
    /_Last updated:\s*(\d{4}-\d{2}-\d{2})/i,
    /\*\*Started:\*\*\s*(\d{4}-\d{2}-\d{2})/i, // plan-doc fallback
  ];
  for (const re of patterns) {
    const m = content.match(re);
    if (m) {
      const d = new Date(m[1]);
      if (!isNaN(d.getTime())) return d;
    }
  }
  // Final fallback: file mtime (git-independent).
  try {
    const stat = fs.statSync(filePath);
    return new Date(stat.mtime);
  } catch {
    return null;
  }
}

// ─── Reporting ─────────────────────────────────────────────────────────────

function printReport(report) {
  process.stdout.write(`staleness check (today: ${report.today}):\n`);
  for (const item of report.items) {
    const mark = item.status === 'fresh' ? 'OK' : item.status === 'stale' ? 'STALE' : item.status.toUpperCase();
    const tail = item.status === 'stale'
      ? ` (${item.days_since}d / SLA ${item.max_days}d, last ${item.last_updated})`
      : item.status === 'fresh'
      ? ` (${item.days_since}d / SLA ${item.max_days}d)`
      : '';
    process.stdout.write(`  [${mark}] ${item.file}${tail}\n`);
  }
  if (report.violations.length === 0) {
    process.stdout.write('\nstaleness: clean — all tracked files within SLA.\n');
  } else {
    process.stdout.write(`\nstaleness: ${report.violations.length} violation(s):\n`);
    for (const v of report.violations) process.stdout.write(`  - ${v.message}\n`);
  }
}

// WS-277: expose pure staleness check for cwos-frame.js consumption without
// firing the CLI's main(). When require()'d as a module, main() is skipped.
if (require.main === module && process.env.CWOS_STALENESS_NORUN !== '1') {
  try {
    process.exit(main());
  } catch (err) {
    process.stderr.write(`staleness: fatal — ${err.message}\n`);
    if (process.argv.includes('--verbose')) process.stderr.write(err.stack + '\n');
    process.exit(2);
  }
}

/**
 * computeStaleness(wsDir, [opts]) — returns a structured staleness report
 * without writing or printing anything. Pure read.
 *
 * Returns: { today, items: [...], violations: [...] }
 *   - violations[] is the load-bearing field for callers; non-empty means
 *     at least one tracked file is past its SLA.
 *
 * Replay-purity: pass `today` as ISO date string to override new Date()
 * for tests.
 */
function computeStaleness(wsDir, opts) {
  const repoRoot = path.resolve(wsDir, '..', '..');
  const sla = loadSLA(wsDir);
  addActivePlanDocs(repoRoot, sla);
  const todayStr = (opts && typeof opts.today === 'string') ? opts.today : todayISO();
  const today = new Date(todayStr);
  const violations = [];
  const items = [];
  for (const rule of sla) {
    const filePath = path.join(repoRoot, rule.file);
    if (!fs.existsSync(filePath)) {
      if (rule.required) {
        violations.push({ file: rule.file, type: 'missing_required_file', message: `Required file missing: ${rule.file}` });
      }
      items.push({ file: rule.file, status: 'missing', max_days: rule.max_days });
      continue;
    }
    const lastUpdated = readLastUpdatedDate(filePath);
    if (lastUpdated === null) {
      violations.push({ file: rule.file, type: 'no_last_updated_header', message: `${rule.file} has no parseable "Last updated:" header` });
      items.push({ file: rule.file, status: 'no_header', max_days: rule.max_days });
      continue;
    }
    const daysSince = Math.floor((today - lastUpdated) / (1000 * 60 * 60 * 24));
    const stale = daysSince > rule.max_days;
    items.push({ file: rule.file, status: stale ? 'stale' : 'fresh', last_updated: lastUpdated.toISOString().slice(0, 10), days_since: daysSince, max_days: rule.max_days });
    if (stale) {
      violations.push({ file: rule.file, type: 'stale', days_since: daysSince, max_days: rule.max_days, message: `${rule.file} is ${daysSince}d stale (SLA: ${rule.max_days}d). ${rule.description || ''}`.trim() });
    }
  }
  return { today: todayStr, items, violations };
}

module.exports = {
  computeStaleness,
  loadSLA,
  readLastUpdatedDate,
  DEFAULT_SLA,
};
