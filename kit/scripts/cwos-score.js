#!/usr/bin/env node
/**
 * cwos-score — Deterministic RICE and health score calculator.
 *
 * Implements health-scoring.md exactly: finding_health, protocol_currency,
 * problem_class_coverage, maturity_progress, ceiling, penalties, decay.
 *
 * Usage:
 *   node cwos-score.js health [program-id | --all]
 *   node cwos-score.js rice [item-id | --all]
 */

'use strict';

require('./lib/preflight');

const path = require('path');
const fs = require('fs');
const {
  readYAMLFile, globFiles, patchYAMLFile, findWorkstreamDir, dateDiffDays, todayISO
} = require('./lib/cwos-utils');

// WS-208 (SPR-064): canonical formula moved to core/health-scoring.js.
// This file is now a CLI + legacy-export shim that delegates to the
// shared module. Every formula constant and helper re-exported below
// is imported from the shared module — one source of truth.
const _healthScoring = require('./core/health-scoring');

const { makeEventEmitter } = require('./lib/cwos-utils');
const emitEvent = makeEventEmitter();

// ─── Constants (re-exported from core/health-scoring for backward compat) ──

const { TIER_ORDER, PROTOCOL_RIGOR, RIGOR_CEILING, TIER_WEIGHT, PHASE_MULTIPLIER, TARGET_CEILING } = _healthScoring;

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: cwos-score.js health [program-id | --all]');
    console.log('       cwos-score.js rice [item-id | --all]');
    process.exit(0);
  }

  let wsDir;
  try { wsDir = findWorkstreamDir(process.cwd()); }
  catch { console.error('ERROR: Could not find .claude/workstream/'); process.exit(1); }

  const mode = args[0];
  const target = args[1] || '--all';

  if (mode === 'health') {
    runHealthScoring(wsDir, target);
  } else if (mode === 'rice') {
    console.log('RICE mode: current items use stored priority_score (no RICE components yet).');
    console.log('This mode will activate when items include reach/impact/confidence/effort fields.');
  } else {
    console.error(`Unknown mode: ${mode}. Use 'health' or 'rice'.`);
    process.exit(1);
  }
}

// ─── Health Scoring ─────────────────────────────────────────────────────────

function runHealthScoring(wsDir, target) {
  // Load findings index for open finding counts
  const findingsIndex = loadFindingsIndex(wsDir);
  const today = todayISO();

  const progsDir = path.join(wsDir, 'programs');
  let progFiles;

  if (target === '--all') {
    progFiles = globFiles(progsDir, 'prog-*.yaml');
  } else {
    const filePath = path.join(progsDir, `prog-${target}.yaml`);
    if (!fs.existsSync(filePath)) {
      console.error(`Program not found: ${target}`);
      process.exit(1);
    }
    progFiles = [filePath];
  }

  const results = [];

  for (const filePath of progFiles) {
    const { ok, data: prog } = readYAMLFile(filePath);
    if (!ok) { console.error(`WARN: Skipping ${path.basename(filePath)}`); continue; }
    if (!prog.id || prog.status === 'retired') continue;

    const result = computeHealthScore(prog, findingsIndex, today);
    results.push(result);

    // Write back to program file
    const patches = {
      health_score: result.score,
      health_ceiling: result.ceiling,
    };
    patchYAMLFile(filePath, patches);

    // Update breakdown via more targeted patching
    updateHealthBreakdown(filePath, result);
  }

  // Print summary
  console.log('Program Health Scores:');
  console.log('─'.repeat(70));
  for (const r of results) {
    const bar = '█'.repeat(r.score) + '░'.repeat(10 - r.score);
    const caps = r.capsApplied.length > 0 ? ` [${r.capsApplied.join(', ')}]` : '';
    console.log(`  ${r.id.padEnd(25)} ${bar} ${r.score}/10 (ceiling ${r.ceiling})${caps}`);
  }
  console.log('─'.repeat(70));
  console.log(`${results.length} programs scored.`);
}

// WS-208: computeHealthScore + helpers below delegate to core/health-scoring.
// Names kept as local bindings so the CLI (`runHealthScoring` above) and
// external importers both see the same behavior from one source of truth.
const computeHealthScore = _healthScoring.computeHealthScore;
const computeProtocolCurrency = _healthScoring.computeProtocolCurrency;
const isStale = _healthScoring.isStale;
const getMostRecentRunDate = _healthScoring.getMostRecentRunDate;
const getEffectiveCadence = _healthScoring.getEffectiveCadence;
const loadFindingsIndex = _healthScoring.loadFindingsIndex;
const countOpenFindings = _healthScoring.countOpenFindings;

function updateHealthBreakdown(filePath, result) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace health_breakdown block
  const breakdownRegex = /health_breakdown:[\s\S]*?(?=\n[a-z_]+:|$)/m;
  const newBreakdown = [
    'health_breakdown:',
    `  finding_health: ${result.findingHealth}`,
    `  protocol_currency: ${result.protocolCurrency}`,
    `  problem_class_coverage: ${result.coverage}`,
    `  maturity_progress: ${result.maturityProgress}`,
    result.capsApplied.length > 0
      ? `  hard_caps_applied: [${result.capsApplied.map(c => `"${c}"`).join(', ')}]`
      : '  hard_caps_applied: []',
  ].join('\n');

  if (breakdownRegex.test(content)) {
    content = content.replace(breakdownRegex, newBreakdown + '\n');
  }

  // Update health_updated_at
  const today = todayISO();
  content = content.replace(/^(health_updated_at:\s*).*$/m, `$1"${today}"`);

  fs.writeFileSync(filePath, content, 'utf8');
  emitEvent('T11:vital-signs', 'score-updated', {
    program_file: path.basename(filePath),
    finding_health: result.findingHealth,
    protocol_currency: result.protocolCurrency,
    coverage: result.coverage,
  });
}

function round2(n) { return Math.round(n * 100) / 100; }

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  computeHealthScore,
  loadFindingsIndex,
  countOpenFindings,
  computeProtocolCurrency,
  isStale,
  RIGOR_CEILING,
  TIER_WEIGHT,
  TIER_ORDER,
  TARGET_CEILING,
  PHASE_MULTIPLIER,
  PROTOCOL_RIGOR,
};

// ─── Run ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  main();
}
