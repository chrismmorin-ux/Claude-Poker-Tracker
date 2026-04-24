/**
 * runDrillBacktest.js — Dev entry point for Tier-2 activation-rate backtest
 *
 * Loads persisted hand history + VillainAssumption records and runs
 * `runActivationBacktest` from `assumptionEngine/__backtest__/historyBacktest.js`.
 * Prints a formatted report to the console for manual inspection.
 *
 * Usage (browser console):
 *   window.__runDrillBacktest()
 *
 * Scope v1 is activation-rate only — see historyBacktest.js module docs and
 * `docs/projects/exploit-deviation/calibration.md` §3 for the full Tier-2
 * roadmap (realized-vs-predicted dividend gaps land after gameTree integration).
 *
 * Follows the __dev__/ pattern from seedDrillAssumptions.js.
 */

import { getAllHands } from '../utils/persistence';
import { loadAllAssumptions } from '../utils/persistence/assumptionStorage';
import { getSessionById } from '../utils/persistence/sessionsStorage';
import { runActivationBacktest } from '../utils/assumptionEngine/__backtest__/historyBacktest';
import { runDividendCalibrationBacktest } from '../utils/assumptionEngine/__backtest__/dividendCalibrationBacktest';

/**
 * Pretty-print the backtest report to the console.
 * Returns the raw report object for further inspection.
 */
const printReport = (report) => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Drill Activation Backtest — Tier-2 v1 (activation rate only)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Run at:              ${report.runAt}`);
  console.log(`  Hands scanned:       ${report.handsScanned}`);
  console.log(`  Decision nodes:      ${report.decisionNodesScanned}`);
  console.log(`  Assumptions seen:    ${report.perAssumption.length}`);
  if (report.warnings.length > 0) {
    console.log('  Warnings:');
    for (const w of report.warnings) console.log(`    ● ${w}`);
  }

  if (report.perAssumption.length > 0) {
    console.log('\n── Per-assumption activation ──────────────────────────────');
    // Sort by activation-rate descending, null last
    const sorted = [...report.perAssumption].sort((a, b) => {
      if (a.activationRate === b.activationRate) return 0;
      if (a.activationRate == null) return 1;
      if (b.activationRate == null) return -1;
      return b.activationRate - a.activationRate;
    });
    for (const row of sorted) {
      const rate = row.activationRate == null
        ? 'n/a'
        : `${(row.activationRate * 100).toFixed(1)}%`;
      const scopeStr = `street=${row.scope.street ?? 'any'} texture=${row.scope.texture ?? 'any'}`;
      console.log(
        `  ${row.assumptionId?.padEnd(32) ?? '<no-id>'.padEnd(32)} `
        + `[${row.predicateKey?.padEnd(22) ?? '<no-predicate>'.padEnd(22)}] `
        + `${row.style.padEnd(8)} `
        + `hands=${String(row.handsWithVillain).padStart(4)} `
        + `matched=${String(row.matchedNodes).padStart(4)}/${String(row.eligibleNodes).padStart(4)} `
        + `→ ${rate.padStart(6)}    (${scopeStr})`
      );
    }
  }

  const predicateKeys = Object.keys(report.perPredicate);
  if (predicateKeys.length > 0) {
    console.log('\n── Per-predicate rollup ───────────────────────────────────');
    for (const key of predicateKeys) {
      const agg = report.perPredicate[key];
      const rate = agg.activationRate == null
        ? 'n/a'
        : `${(agg.activationRate * 100).toFixed(1)}%`;
      console.log(
        `  ${key.padEnd(22)} `
        + `assumptions=${String(agg.assumptions).padStart(3)} `
        + `matched=${String(agg.totalMatched).padStart(4)}/${String(agg.totalEligible).padStart(4)} `
        + `→ ${rate.padStart(6)}`
      );
      const byStyle = Object.keys(agg.byStyle);
      if (byStyle.length > 0) {
        const parts = byStyle.map((s) => `${s}=${agg.byStyle[s]}`).join(', ');
        console.log(`    byStyle: ${parts}`);
      }
      const byStreet = Object.keys(agg.byStreet);
      if (byStreet.length > 0) {
        const parts = byStreet.map((s) => `${s}=${agg.byStreet[s]}`).join(', ');
        console.log(`    byStreet: ${parts}`);
      }
    }
  }

  console.log('\n── Interpretation (calibration.md §3.2 + §5.3) ────────────');
  console.log('  activationRate = matched / eligible nodes for this villain.');
  console.log('  Low activation + low handsWithVillain → ring-fence in drill');
  console.log('  until sample accrues (per §5.3 sample-size planning).');
  console.log('═══════════════════════════════════════════════════════════════');

  return report;
};

/**
 * Run the Tier-2 activation backtest end-to-end.
 *
 * @returns {Promise<Object>} Backtest report (also printed to console)
 */
export const runDrillBacktest = async () => {
  const [hands, assumptions] = await Promise.all([
    getAllHands('guest'),
    loadAllAssumptions(),
  ]);

  console.log(`[runDrillBacktest] Loaded ${hands.length} hands + ${assumptions.length} assumptions`);

  const report = runActivationBacktest({ assumptions, hands });
  return printReport(report);
};

// =============================================================================
// Dividend-calibration backtest — heuristic vs engine (Plan A, Session 20)
// =============================================================================

const fmtSign = (n) => {
  if (!Number.isFinite(n)) return ' n/a ';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}`;
};

const fmtPct = (n) => {
  if (!Number.isFinite(n)) return '  n/a';
  return `${(n * 100).toFixed(1)}%`;
};

const classBadge = (cls) => {
  switch (cls) {
    case 'well-calibrated': return '✓ well-calibrated';
    case 'target-zone': return '· target-zone';
    case 'conservative-ceiling': return '⚠ conservative-ceiling';
    case 'expiring': return '⚠ expiring (retire candidate)';
    default: return '? no-data';
  }
};

const printDividendReport = (report) => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Drill Dividend Calibration Backtest — Heuristic vs Engine');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Run at:              ${report.runAt}`);
  console.log(`  Mode:                ${report.mode ?? 'synthesized'}`);
  console.log(`  Assumptions scanned: ${report.assumptionsScanned}`);
  console.log(`  Engine bailouts:     ${report.engineBailouts}`);
  if (report.perFiringSkipped != null) {
    console.log(`  Firings skipped:     ${report.perFiringSkipped}`);
    if (report.skipReasonCounts && Object.keys(report.skipReasonCounts).length > 0) {
      const parts = Object.keys(report.skipReasonCounts)
        .map((r) => `${r}=${report.skipReasonCounts[r]}`).join(', ');
      console.log(`    by reason: ${parts}`);
    }
  }
  if (report.warnings.length > 0) {
    console.log('  Warnings:');
    for (const w of report.warnings) console.log(`    ● ${w}`);
  }

  if (report.perAssumption.length > 0) {
    console.log('\n── Per-assumption (sorted by gap desc) ───────────────────────');
    const sorted = [...report.perAssumption].sort((a, b) => {
      if (a.gap === b.gap) return 0;
      if (a.gap == null) return 1;
      if (b.gap == null) return -1;
      return b.gap - a.gap;
    });
    for (const row of sorted) {
      const gap = row.gap == null ? '  n/a' : fmtPct(row.gap);
      const heur = fmtSign(row.heuristicDividend);
      const eng = row.engineDividend == null ? ' n/a ' : fmtSign(row.engineDividend);
      const firingsInfo = (row.firings != null || row.firingsSkipped != null)
        ? `  firings=${row.firings ?? 0}/skipped=${row.firingsSkipped ?? 0}`
          + (row.firingsPinned ? `  pinned=${row.firingsPinned}/synth=${row.firingsStyleSynthesized}` : '')
        : '';
      console.log(
        `  ${(row.assumptionId ?? '<no-id>').padEnd(36)} `
        + `${(row.style || 'Unknown').padEnd(8)} `
        + `${(row.deviationType ?? '').padEnd(14)} `
        + `heuristic=${heur}  engine=${eng}  gap=${gap.padStart(6)}  ${classBadge(row.classification)}`
        + firingsInfo
        + (row.reason ? `  reason=${row.reason}` : ''),
      );
    }
  }

  const predicateKeys = Object.keys(report.perPredicate);
  if (predicateKeys.length > 0) {
    console.log('\n── Per-predicate rollup ──────────────────────────────────────');
    for (const key of predicateKeys) {
      const agg = report.perPredicate[key];
      console.log(
        `  ${key.padEnd(22)} `
        + `assumptions=${String(agg.assumptions).padStart(2)} `
        + `avgHeuristic=${fmtSign(agg.avgHeuristic)} `
        + `avgEngine=${fmtSign(agg.avgEngine)} `
        + `avgGap=${fmtPct(agg.avgGap).padStart(6)}  ${classBadge(agg.classification)}`,
      );
      const styleParts = Object.keys(agg.byStyle).map((s) => `${s}=${agg.byStyle[s]}`).join(', ');
      if (styleParts) console.log(`    byStyle: ${styleParts}`);
      const streetParts = Object.keys(agg.byStreet).map((s) => `${s}=${agg.byStreet[s]}`).join(', ');
      if (streetParts) console.log(`    byStreet: ${streetParts}`);
    }
  }

  console.log('\n── Interpretation (calibration.md §3.3) ──────────────────────');
  console.log('  This compares the recipe heuristic dividend (consequence.expectedDividend.mean)');
  console.log('  against the engine-derived dividend from a synthesized representative spot.');
  console.log('  Predicates classified expiring or conservative-ceiling are recipe-tuning candidates.');
  console.log('═══════════════════════════════════════════════════════════════');

  return report;
};

/**
 * Run the heuristic-vs-engine dividend backtest end-to-end.
 *
 * @returns {Promise<Object>} Backtest report (also printed to console)
 */
export const runDrillDividendBacktest = async () => {
  const [hands, assumptions] = await Promise.all([
    getAllHands('guest'),
    loadAllAssumptions(),
  ]);

  console.log(`[runDrillDividendBacktest] Loaded ${hands.length} hands + ${assumptions.length} assumptions`);

  const report = await runDividendCalibrationBacktest({ assumptions, hands });
  return printDividendReport(report);
};

/**
 * Run the heuristic-vs-engine dividend backtest in REAL mode (Plan B / S21).
 *
 * Walks every matched decision node in stored hand history, reconstructs the
 * game state per node, runs engine + producer per firing, averages dividend
 * across firings per assumption. HU postflop only — multiway and other
 * unreconstructible firings tally into report.skipReasonCounts.
 *
 * @returns {Promise<Object>} Backtest report (also printed to console)
 */
export const runDrillRealizedDividendBacktest = async () => {
  const [hands, assumptions] = await Promise.all([
    getAllHands('guest'),
    loadAllAssumptions(),
  ]);

  console.log(`[runDrillRealizedDividendBacktest] Loaded ${hands.length} hands + ${assumptions.length} assumptions`);

  const report = await runDividendCalibrationBacktest({
    assumptions,
    hands,
    mode: 'real',
    getSession: getSessionById,
  });
  return printDividendReport(report);
};

// =============================================================================
// EXPOSE ON WINDOW (DEBUG only)
// =============================================================================

if (typeof window !== 'undefined') {
  window.__runDrillBacktest = runDrillBacktest;
  window.__runDrillDividendBacktest = runDrillDividendBacktest;
  window.__runDrillRealizedDividendBacktest = runDrillRealizedDividendBacktest;
}
