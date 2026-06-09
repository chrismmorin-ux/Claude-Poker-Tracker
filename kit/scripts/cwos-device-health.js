#!/usr/bin/env node
/**
 * cwos-device-health — Phase 1 detector library entrypoint (WS-255 / ADR-036).
 *
 * Read-only detection of device-level invariant and best-practice violations.
 * Per ADR-036 read-only-forever v1 boundary: no device modifications.
 *
 * Usage:
 *   node cwos-device-health.js                          # all detectors, human summary
 *   node cwos-device-health.js --only DEV-INV-001       # single detector
 *   node cwos-device-health.js --rule-type invariant    # only invariants
 *   node cwos-device-health.js --rule-type best_practice
 *   node cwos-device-health.js --quiet                  # suppress stderr summary
 *   node cwos-device-health.js --json                   # JSON to stdout
 *   node cwos-device-health.js --strict                 # exit 2 on any inv violation,
 *                                                       # exit 1 on any BP violation,
 *                                                       # exit 0 on clean
 *
 * Output format (JSON, --json or piped):
 *   { ok, exit_code, detectors_run, findings: [DetectorFinding] }
 *
 * DetectorFinding:
 *   { detector_id, rule_type, severity, status, evidence, message }
 *
 * Phase 2 (WS-256) will wrap this in /device-pulse + FIND-*.yaml emission.
 * Phase 1 ships pure script layer only.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { findRepoRoot } = require('./lib/cwos-utils');
const { validateContract, validateResult } = require('./device-health/lib/detector-base');

// ─── Repo Root Discovery ────────────────────────────────────────────────────

function resolveRepoRoot() {
  const dir = findRepoRoot(process.cwd(), { markers: ['CLAUDE.md', 'kit'], requireAll: true, maxDepth: 8 });
  if (fs.existsSync(path.join(dir, 'CLAUDE.md')) && fs.existsSync(path.join(dir, 'kit'))) {
    return dir;
  }
  // Fall back to script-relative discovery (script is at <repo>/kit/scripts/)
  const scriptRoot = path.resolve(__dirname, '..', '..');
  if (fs.existsSync(path.join(scriptRoot, 'CLAUDE.md'))) return scriptRoot;
  throw new Error('Could not find repo root (CLAUDE.md + kit/ not found)');
}

// ─── Detector Loading ───────────────────────────────────────────────────────

function loadDetectors(detectorsDir) {
  if (!fs.existsSync(detectorsDir)) {
    throw new Error(`Detectors directory not found: ${detectorsDir}`);
  }
  const files = fs.readdirSync(detectorsDir)
    .filter(f => /^DEV-(INV|BP)-\d{3}-.+\.js$/.test(f))
    .sort();
  const detectors = [];
  const loadIssues = [];
  for (const file of files) {
    const fullPath = path.join(detectorsDir, file);
    let det;
    try {
      // Clear require cache so repeated invocations during /sim get fresh state
      delete require.cache[require.resolve(fullPath)];
      det = require(fullPath);
    } catch (err) {
      loadIssues.push({ file, error: err.message });
      continue;
    }
    const issues = validateContract(det);
    if (issues.length > 0) {
      loadIssues.push({ file, error: `contract issues: ${issues.join('; ')}` });
      continue;
    }
    detectors.push({ ...det, source_file: file });
  }
  return { detectors, loadIssues };
}

// ─── Detector Execution ─────────────────────────────────────────────────────

async function runDetectors(detectors, ctx, filterFn) {
  const findings = [];
  let detectorsRun = 0;
  for (const det of detectors) {
    if (filterFn && !filterFn(det)) continue;
    if (!det.platforms.includes(process.platform)) {
      findings.push({
        detector_id: det.id,
        rule_type: det.rule_type,
        severity: 'low',
        status: 'unknown',
        evidence: { reason: 'platform_not_supported', current: process.platform, supported: det.platforms },
        message: `Detector skipped — current platform (${process.platform}) not supported`,
      });
      detectorsRun += 1;
      continue;
    }
    let result;
    try {
      result = await det.run(ctx);
    } catch (err) {
      result = {
        status: 'unknown',
        severity: 'low',
        evidence: { error: err.message },
        message: `Detector threw: ${err.message}`,
      };
    }
    const validIssues = validateResult(result);
    if (validIssues.length > 0) {
      result = {
        status: 'unknown',
        severity: 'low',
        evidence: { contract_violation: validIssues, raw: result },
        message: `Detector returned malformed result: ${validIssues.join('; ')}`,
      };
    }
    findings.push({
      detector_id: det.id,
      rule_type: det.rule_type,
      severity: result.severity,
      status: result.status,
      evidence: result.evidence,
      message: result.message,
    });
    detectorsRun += 1;
  }
  return { detectorsRun, findings };
}

// ─── Aggregation ────────────────────────────────────────────────────────────

function summarize(findings) {
  const violatingInv = findings.filter(f => f.status === 'violating' && f.rule_type === 'invariant');
  const violatingBp = findings.filter(f => f.status === 'violating' && f.rule_type === 'best_practice');
  const unknownF = findings.filter(f => f.status === 'unknown');
  const passingF = findings.filter(f => f.status === 'passing');
  let exitCode = 0;
  if (violatingInv.length > 0) exitCode = 2;
  else if (violatingBp.length > 0) exitCode = 1;
  return {
    ok: violatingInv.length === 0 && violatingBp.length === 0,
    exit_code: exitCode,
    counts: {
      passing: passingF.length,
      violating_invariants: violatingInv.length,
      violating_best_practices: violatingBp.length,
      unknown: unknownF.length,
      total: findings.length,
    },
  };
}

// ─── Output ─────────────────────────────────────────────────────────────────

function renderHumanSummary(findings, summary, loadIssues) {
  const lines = [];
  lines.push(`cwos-device-health: ${findings.length} detectors run, ${summary.counts.violating_invariants} invariant violations, ${summary.counts.violating_best_practices} best-practice violations, ${summary.counts.unknown} unknown`);
  if (loadIssues && loadIssues.length > 0) {
    lines.push('');
    lines.push('Load issues:');
    for (const li of loadIssues) {
      lines.push(`  [LOAD-FAIL] ${li.file} — ${li.error}`);
    }
  }
  const violatingInv = findings.filter(f => f.status === 'violating' && f.rule_type === 'invariant');
  if (violatingInv.length > 0) {
    lines.push('');
    lines.push('Invariant violations:');
    for (const f of violatingInv) {
      lines.push(`  [${f.severity.toUpperCase()}] ${f.detector_id} — ${f.message}`);
    }
  }
  const violatingBp = findings.filter(f => f.status === 'violating' && f.rule_type === 'best_practice');
  if (violatingBp.length > 0) {
    lines.push('');
    lines.push('Best-practice violations:');
    for (const f of violatingBp) {
      lines.push(`  [${f.severity.toUpperCase()}] ${f.detector_id} — ${f.message}`);
    }
  }
  const unknownF = findings.filter(f => f.status === 'unknown');
  if (unknownF.length > 0) {
    lines.push('');
    lines.push('Unknown / skipped:');
    for (const f of unknownF) {
      lines.push(`  [SKIP] ${f.detector_id} — ${f.message}`);
    }
  }
  return lines.join('\n');
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { only: null, ruleType: null, quiet: false, json: false, strict: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--only') { args.only = argv[++i]; continue; }
    if (arg.startsWith('--only=')) { args.only = arg.slice(7); continue; }
    if (arg === '--rule-type') { args.ruleType = argv[++i]; continue; }
    if (arg.startsWith('--rule-type=')) { args.ruleType = arg.slice(12); continue; }
    if (arg === '--quiet') { args.quiet = true; continue; }
    if (arg === '--json') { args.json = true; continue; }
    if (arg === '--strict') { args.strict = true; continue; }
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(`Usage: node cwos-device-health.js [--only ID] [--rule-type TYPE] [--quiet] [--json] [--strict]\n`);
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = resolveRepoRoot();
  const detectorsDir = path.join(repoRoot, 'kit', 'scripts', 'device-health', 'detectors');
  const { detectors, loadIssues } = loadDetectors(detectorsDir);

  const ctx = { repoRoot };

  let filterFn = null;
  if (args.only) {
    filterFn = (d) => d.id === args.only;
  } else if (args.ruleType) {
    filterFn = (d) => d.rule_type === args.ruleType;
  }

  const { findings, detectorsRun } = await runDetectors(detectors, ctx, filterFn);
  const summary = summarize(findings);

  const output = {
    ok: summary.ok,
    exit_code: summary.exit_code,
    detectors_run: detectorsRun,
    counts: summary.counts,
    findings,
    load_issues: loadIssues || [],
  };

  if (args.json) {
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  } else if (!args.quiet) {
    process.stderr.write(renderHumanSummary(findings, summary, loadIssues) + '\n');
  }

  // Strict mode: exit with summary.exit_code (already non-zero on violations)
  // Non-strict mode: exit 0 unless load issues forced abort
  process.exit(args.strict ? summary.exit_code : 0);
}

main().catch(err => {
  process.stderr.write(`cwos-device-health: fatal error: ${err.message}\n${err.stack || ''}\n`);
  process.exit(3);
});
