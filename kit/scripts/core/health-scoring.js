/**
 * health-scoring.js — canonical health-scoring formula (WS-208, ADR-020).
 *
 * Extracted from kit/scripts/cwos-score.js so cwos-score (CLI),
 * kit/scripts/core/reducers/vital-signs.js (state-store reducer), and
 * any future caller share one source of truth. cwos-score.js still
 * works — it now imports from this module.
 *
 * The formula matches kit/templates/system/health-scoring.md exactly.
 *
 * Zero external dependencies.
 */

'use strict';

const path = require('path');

const { readYAMLFile, dateDiffDays } = require('../lib/cwos-utils');

// ─── Constants ──────────────────────────────────────────────────────────────

const TIER_ORDER = { dormant: 0, watch: 1, active: 2, critical: 3 };

const PROTOCOL_RIGOR = {
  delta: 2,
  baseline: 5,
  sweep: 5,
  challenge: 6,
  blind_spot: 8,
};

// Rigor level → ceiling cap
const RIGOR_CEILING = [0, 2, 4, 5, 6, 7, 8, 9, 9, 10];

const TIER_WEIGHT = { dormant: 0, watch: 1.5, active: 2.5, critical: 4.0 };
const PHASE_MULTIPLIER = { critical: 2.0, high: 1.5, medium: 1.0, low: 0.5 };
const TARGET_CEILING = { dormant: 0, watch: 4, active: 8, critical: 10 };

// ─── Findings helpers ──────────────────────────────────────────────────────

function loadFindingsIndex(wsDir) {
  const indexPath = path.join(wsDir, 'findings-index.yaml');
  const { ok, data } = readYAMLFile(indexPath);
  if (!ok || !data.findings) return [];
  return Array.isArray(data.findings) ? data.findings : [];
}

function countOpenFindings(programId, findingsIndex) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findingsIndex) {
    if (f.program === programId && f.status === 'open') {
      const sev = String(f.severity).toLowerCase();
      if (counts.hasOwnProperty(sev)) counts[sev]++;
    }
  }
  return counts;
}

// ─── Health-score formula (canonical) ──────────────────────────────────────

function computeHealthScore(prog, findingsIndex, today) {
  const tier = prog.tier || 'dormant';
  const protocols = prog.protocols || {};
  const lastRuns = prog.last_run_by_protocol || {};
  const problemClasses = prog.problem_classes || [];
  const maturityLevel = (prog.maturity && prog.maturity.level) || 0;

  // Step 1: Rigor ceiling (highest rigor level achieved)
  let maxRigor = 0;
  for (const [proto, runInfo] of Object.entries(lastRuns)) {
    if (runInfo && runInfo.date) {
      const rigor = PROTOCOL_RIGOR[proto] || 0;
      maxRigor = Math.max(maxRigor, rigor);
    }
  }
  const evidence = prog.evidence || {};
  const history = evidence.protocol_history || [];
  for (const entry of history) {
    if (entry.engine === 'quality-judge') maxRigor = Math.max(maxRigor, 7);
    if (entry.engine === 'meta-engine') maxRigor = Math.max(maxRigor, 9);
  }
  const rigorIdx = Math.min(maxRigor, RIGOR_CEILING.length - 1);
  const ceiling = RIGOR_CEILING[rigorIdx];

  // Step 2: finding_health
  const openFindings = countOpenFindings(prog.id, findingsIndex);
  const findingPenalty = (openFindings.critical * 0.4) + (openFindings.high * 0.2) + (openFindings.medium * 0.1);
  const findingHealth = Math.max(0.0, 1.0 - findingPenalty);

  // Step 3: protocol_currency
  const protocolCurrency = computeProtocolCurrency(protocols, lastRuns, tier, today);

  // Step 4: problem_class_coverage
  const totalClasses = problemClasses.length || 1;
  let checkedClasses = 0;
  for (const [proto, protoDef] of Object.entries(protocols)) {
    const run = lastRuns[proto];
    if (run && run.date) {
      if (protoDef.problem_classes === 'all') { checkedClasses = totalClasses; break; }
      if (Array.isArray(protoDef.problem_classes)) {
        checkedClasses = Math.max(checkedClasses, protoDef.problem_classes.length);
      }
    }
  }
  const coverage = checkedClasses / totalClasses;

  // Step 5: maturity_progress
  const maturityProgress = maturityLevel / 4;

  // Step 6: earned_score
  const raw = (findingHealth * 0.35) + (protocolCurrency * 0.25)
            + (coverage * 0.25) + (maturityProgress * 0.15);
  const earnedScore = Math.round(raw * ceiling);

  // Step 7: apply ceiling
  let score = Math.min(earnedScore, ceiling);

  // Step 8: hard caps (penalties)
  const capsApplied = [];
  if (openFindings.critical > 0) {
    score = Math.min(score, 4);
    capsApplied.push('CRITICAL finding -> max 4');
  }
  if (openFindings.high >= 3) {
    score = Math.min(score, 6);
    capsApplied.push('3+ HIGH findings -> max 6');
  }
  const accountability = prog.accountability || {};
  const onStale = accountability.on_stale || {};
  if (onStale.block_sprint && isStale(protocols, lastRuns, tier, today, prog.created_at)) {
    score = Math.min(score, 2);
    capsApplied.push('block_sprint + stale -> max 2');
  }

  // Step 9: staleness decay
  const mostRecentRun = getMostRecentRunDate(lastRuns);
  if (mostRecentRun) {
    const effectiveCadence = getEffectiveCadence(protocols, tier);
    if (effectiveCadence > 0) {
      const daysSince = dateDiffDays(mostRecentRun, today);
      if (daysSince > 2 * effectiveCadence) {
        const extraPeriods = Math.floor((daysSince - 2 * effectiveCadence) / effectiveCadence);
        if (extraPeriods > 0) {
          score = Math.max(1, score - extraPeriods);
          capsApplied.push(`staleness decay -${extraPeriods}`);
        }
      }
    }
  }

  return {
    id: prog.id,
    score, ceiling, maxRigor,
    findingHealth: round2(findingHealth),
    protocolCurrency: round2(protocolCurrency),
    coverage: round2(coverage),
    maturityProgress: round2(maturityProgress),
    raw: round2(raw),
    earnedScore, capsApplied, openFindings,
  };
}

function computeProtocolCurrency(protocols, lastRuns, tier, today) {
  const tierLevel = TIER_ORDER[tier] || 0;
  const activeProtocols = [];
  for (const [proto, protoDef] of Object.entries(protocols)) {
    const minTier = protoDef.min_tier || 'dormant';
    if (tierLevel >= (TIER_ORDER[minTier] || 0)) {
      activeProtocols.push({ name: proto, cadence: protoDef.cadence_days || 30 });
    }
  }
  if (activeProtocols.length === 0) return 0.0;

  let sum = 0;
  for (const ap of activeProtocols) {
    const run = lastRuns[ap.name];
    if (!run || !run.date) return 0.0;
    const daysSince = dateDiffDays(run.date, today);
    sum += Math.min(1.0, ap.cadence / Math.max(daysSince, 1));
  }
  return sum / activeProtocols.length;
}

function isStale(protocols, lastRuns, tier, today, programCreatedAt) {
  const tierLevel = TIER_ORDER[tier] || 0;
  for (const [proto, protoDef] of Object.entries(protocols)) {
    const minTier = protoDef.min_tier || 'dormant';
    if (tierLevel < (TIER_ORDER[minTier] || 0)) continue;
    const cadence = protoDef.cadence_days || 30;
    const run = lastRuns[proto];
    // A never-run protocol on a young program isn't stale — it's pre-due.
    // Anchor the cadence × 2 window at program.created_at when no run exists.
    // Falls back to the legacy "always stale" behavior if created_at is unset.
    const anchor = (run && run.date) ? run.date : programCreatedAt;
    if (!anchor) return true;
    if (dateDiffDays(anchor, today) > cadence * 2) return true;
  }
  return false;
}

function getMostRecentRunDate(lastRuns) {
  let latest = null;
  for (const run of Object.values(lastRuns)) {
    if (run && run.date) {
      if (!latest || run.date > latest) latest = run.date;
    }
  }
  return latest;
}

function getEffectiveCadence(protocols, tier) {
  const tierLevel = TIER_ORDER[tier] || 0;
  let minCadence = Infinity;
  for (const protoDef of Object.values(protocols)) {
    const minTier = protoDef.min_tier || 'dormant';
    if (tierLevel >= (TIER_ORDER[minTier] || 0)) {
      const cadence = protoDef.cadence_days || 30;
      minCadence = Math.min(minCadence, cadence);
    }
  }
  return minCadence === Infinity ? 30 : minCadence;
}

function round2(n) { return Math.round(n * 100) / 100; }

module.exports = {
  TIER_ORDER, PROTOCOL_RIGOR, RIGOR_CEILING, TIER_WEIGHT, PHASE_MULTIPLIER, TARGET_CEILING,
  computeHealthScore, computeProtocolCurrency, isStale,
  getMostRecentRunDate, getEffectiveCadence,
  loadFindingsIndex, countOpenFindings,
  round2,
};
