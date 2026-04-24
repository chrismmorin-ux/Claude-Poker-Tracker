/**
 * dividendCalibrationBacktest.js — Heuristic-vs-engine dividend gap (Plan A, Session 20)
 *
 * Part of the assumptionEngine module. See `CLAUDE.md` for rules.
 *
 * Why: each recipe in `assumptionProducer.js` carries a heuristic
 * `consequence.expectedDividend.mean` (e.g. `0.40 + belowThreshold * 8`). The drill
 * UI now (S19) renders the engine-derived dividend from `produceCitedDecision`. If
 * the heuristic disagrees with the engine, the calibration framework's "predicted"
 * baseline is misaligned — Tier-2 calibration gaps would be measured against the
 * wrong number.
 *
 * This module sanity-checks recipes against the engine for ALL persisted assumptions:
 * synthesize a representative game state per assumption (via `baselineSynthesis`),
 * compute the engine's CitedDecision dividend, compare against the heuristic.
 *
 * Output is a per-assumption + per-predicate report, classified against the same
 * `CALIBRATION_LADDER` thresholds the realized-vs-predicted accumulator uses (so
 * Plan B can apply the identical policy on top).
 *
 * Honesty: when the engine bails (`gameTree-error` / `gameTree-empty`), the
 * assumption is recorded with `engineDividend: null` + `reason` and EXCLUDED from
 * the per-predicate rollup. Never fabricate a value.
 *
 * v1 scope (this module):
 *   - Synthesizes one representative game state per assumption.
 *   - Joins activation rate from `runActivationBacktest` when `hands` provided.
 *   - In-memory snapshot only (no IDB persistence — that's Plan B's continuous loop).
 *   - Reports gap classification but does NOT mutate assumption status.
 *   - Per-firing weighting deferred to Plan B (real-data realized dividends).
 */

import { computeBaselineForAssumption } from '../../citedDecision/computeBaselineForAssumption';
import { produceCitedDecision } from '../../citedDecision/citedDecisionProducer';
import { classifyGap } from './calibrationAccumulator';
import { runActivationBacktest, extractDecisionNodes, scopeMatches } from './historyBacktest';
import { reconstructStateAtDecisionNode } from './handStateReconstructor';
import { parseBlinds } from '../../potCalculator';

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

/**
 * Compute the dividend gap per calibration.md §3.2:
 *   |predicted − realized| / |predicted| when |predicted| ≥ HEURISTIC_EPS
 *   |predicted − realized| (absolute) when |predicted| < HEURISTIC_EPS
 *
 * Returns null when either input is non-finite (engine bailout).
 */
const HEURISTIC_EPS = 0.05; // bb threshold below which we use absolute error

const computeGap = (heuristic, engine) => {
  if (!Number.isFinite(heuristic) || !Number.isFinite(engine)) return null;
  if (Math.abs(heuristic) < HEURISTIC_EPS) {
    // Heuristic ≈ 0 — ratio is undefined-ish; fall back to absolute error.
    return Math.abs(heuristic - engine);
  }
  return Math.abs(heuristic - engine) / Math.abs(heuristic);
};

/**
 * Flatten assumptions into a single array. Mirrors historyBacktest pattern.
 */
const flattenAssumptions = (assumptions) => {
  if (Array.isArray(assumptions)) return assumptions.filter(Boolean);
  if (assumptions && typeof assumptions === 'object') {
    return Object.values(assumptions).flat().filter(Boolean);
  }
  return [];
};

/**
 * Resolve the villain tendency to feed baselineSynthesis. Prefers an explicit
 * `villainTendencies[villainId]`; falls back to `_villainSnapshot.style` on the
 * assumption record (added in S19 sidecar).
 */
const resolveTendency = (a, villainTendencies) => {
  const explicit = villainTendencies?.[a.villainId];
  if (explicit && typeof explicit === 'object') return explicit;
  const snap = a._villainSnapshot;
  if (snap && typeof snap === 'object') return { style: snap.style ?? 'Unknown' };
  return { style: 'Unknown' };
};

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * Run the heuristic-vs-engine dividend calibration backtest.
 *
 * @param {Object} opts
 * @param {Array|Object} opts.assumptions          — flat array or map by villainId
 * @param {Array<Object>} [opts.hands]              — optional; activation rates joined when present
 * @param {Object} [opts.villainTendencies]         — optional override of `_villainSnapshot` style lookup
 * @param {Function} [opts.getVillainSeat]          — passed to runActivationBacktest
 * @param {Object} [opts.computeOpts]               — passed through to computeBaselineForAssumption(opts:)
 * @param {'synthesized' | 'real'} [opts.mode='synthesized']
 *                                                  — 'synthesized' (Plan A): one engine eval per assumption
 *                                                    against a representative spot.
 *                                                  — 'real' (Plan B): walk matched decision nodes from real
 *                                                    hands, reconstruct state per node, average per assumption.
 * @param {Function} [opts.getSession]              — async (sessionId) → session record (real-mode only;
 *                                                    used to resolve blinds via session.gameType).
 *                                                    Defaulted to a function returning null → blinds default to 1/2.
 * @param {Object} [opts.reconstructorDefaults]     — passed to handStateReconstructor.defaults (real-mode only)
 *
 * @returns {Promise<{
 *   runAt, assumptionsScanned, engineBailouts, mode,
 *   perFiringSkipped?, skipReasonCounts?,
 *   perAssumption: Array, perPredicate: Object, warnings: string[],
 * }>}
 */
export const runDividendCalibrationBacktest = async ({
  assumptions,
  hands = null,
  villainTendencies = {},
  getVillainSeat,
  computeOpts = {},
  mode = 'synthesized',
  getSession = null,
  reconstructorDefaults = {},
} = {}) => {
  const report = {
    runAt: new Date().toISOString(),
    mode,
    assumptionsScanned: 0,
    engineBailouts: 0,
    perAssumption: [],
    perPredicate: {},
    warnings: [],
  };
  if (mode === 'real') {
    report.perFiringSkipped = 0;
    report.skipReasonCounts = {};
  }

  const flat = flattenAssumptions(assumptions);
  if (flat.length === 0) {
    report.warnings.push('No assumptions to evaluate');
    return report;
  }

  // Optional activation join — when hands are present, run the existing activation
  // backtest first and key results by assumptionId for fast lookup.
  let activationByAssumptionId = null;
  if (Array.isArray(hands) && hands.length > 0) {
    const activationReport = runActivationBacktest({
      assumptions: flat,
      hands,
      getVillainSeat,
    });
    activationByAssumptionId = new Map(
      activationReport.perAssumption.map((row) => [row.assumptionId, row]),
    );
  }

  // ─── Resolve per-assumption evaluation depending on mode ──────────────
  let evaluations;
  if (mode === 'real') {
    evaluations = await evaluateAllRealMode(
      flat,
      hands,
      villainTendencies,
      { getSession, getVillainSeat, computeOpts, reconstructorDefaults, report },
    );
  } else {
    // 'synthesized' — Plan A: one engine eval per assumption against representative spot.
    const baselinePromises = flat.map(async (a) => {
      const tendency = resolveTendency(a, villainTendencies);
      const result = await computeBaselineForAssumption({
        assumption: a,
        villainTendency: tendency,
        opts: computeOpts,
      });
      return { assumption: a, tendency, result };
    });
    const settled = await Promise.all(baselinePromises);
    evaluations = settled.map(({ assumption, tendency, result }) => ({
      assumption,
      tendency,
      result,
      // Single-shot fields:
      firings: null,
      firingsSkipped: null,
    }));
  }

  for (const { assumption: a, tendency, result, firings, firingsSkipped, firingsPinned, firingsStyleSynthesized } of evaluations) {
    report.assumptionsScanned += 1;
    const heuristicDividend = a.consequence?.expectedDividend?.mean;
    const predicateKey = a.claim?.predicate;
    const street = a.claim?.scope?.street ?? null;
    const style = tendency.style ?? 'Unknown';
    const deviationType = a.consequence?.deviationType;

    // Activation join (when present)
    const actRow = activationByAssumptionId?.get(a.id);

    // Common synthesisNode shape for diagnostic transparency
    const synthesizedNode = result?.node
      ? { templateId: result.node.templateId, display: result.node.display }
      : null;

    // Engine bailed?
    if (!result?.baseline && !Number.isFinite(result?.engineDividend)) {
      report.engineBailouts += 1;
      report.perAssumption.push({
        assumptionId: a.id,
        predicateKey,
        style,
        street,
        deviationType,
        heuristicDividend: Number.isFinite(heuristicDividend) ? heuristicDividend : null,
        engineDividend: null,
        gap: null,
        classification: 'no-data',
        activationRate: actRow?.activationRate ?? null,
        eligibleNodes: actRow?.eligibleNodes ?? null,
        synthesizedNode,
        reason: result?.reason ?? 'no-baseline',
        ...(mode === 'real' ? {
          firings: firings ?? 0,
          firingsSkipped: firingsSkipped ?? 0,
          firingsPinned: firingsPinned ?? 0,
          firingsStyleSynthesized: firingsStyleSynthesized ?? 0,
        } : {}),
      });
      continue; // EXCLUDED from per-predicate rollup
    }

    // Engine succeeded — compute CitedDecision to get the engine-derived dividend.
    // Real-mode pre-computes `result.engineDividend` (averaged across firings); skip
    // re-running produceCitedDecision in that case.
    let engineDividend = null;
    let citedReason = null;
    if (Number.isFinite(result.engineDividend)) {
      engineDividend = result.engineDividend;
    } else {
      try {
        const cited = produceCitedDecision({
          node: result.node,
          assumptions: [a],
          baseline: result.baseline,
          options: { surface: 'drill', villainStyle: style },
        });
        if (cited && Number.isFinite(cited.dividend)) {
          engineDividend = cited.dividend;
        } else if (cited?.citation === null) {
          citedReason = cited.reason ?? 'producer-no-citation';
        } else {
          citedReason = 'producer-non-finite-dividend';
        }
      } catch (err) {
        citedReason = `producer-error: ${err?.message ?? String(err)}`;
      }
    }

    if (engineDividend === null) {
      report.engineBailouts += 1;
      report.perAssumption.push({
        assumptionId: a.id,
        predicateKey,
        style,
        street,
        deviationType,
        heuristicDividend: Number.isFinite(heuristicDividend) ? heuristicDividend : null,
        engineDividend: null,
        gap: null,
        classification: 'no-data',
        activationRate: actRow?.activationRate ?? null,
        eligibleNodes: actRow?.eligibleNodes ?? null,
        synthesizedNode,
        reason: citedReason,
        ...(mode === 'real' ? {
          firings: firings ?? 0,
          firingsSkipped: firingsSkipped ?? 0,
          firingsPinned: firingsPinned ?? 0,
          firingsStyleSynthesized: firingsStyleSynthesized ?? 0,
        } : {}),
      });
      continue;
    }

    const gap = computeGap(heuristicDividend, engineDividend);
    const classification = classifyGap(gap);

    const row = {
      assumptionId: a.id,
      predicateKey,
      style,
      street,
      deviationType,
      heuristicDividend: Number.isFinite(heuristicDividend) ? heuristicDividend : 0,
      engineDividend,
      gap,
      classification,
      activationRate: actRow?.activationRate ?? null,
      eligibleNodes: actRow?.eligibleNodes ?? null,
      synthesizedNode,
      ...(mode === 'real' ? { firings: firings ?? 0, firingsSkipped: firingsSkipped ?? 0 } : {}),
    };
    report.perAssumption.push(row);
  }

  // Per-predicate rollup — ONLY counting rows with a numeric gap (engine succeeded).
  for (const row of report.perAssumption) {
    if (!row.predicateKey) continue;
    if (row.gap === null) continue;
    const key = row.predicateKey;
    const agg = report.perPredicate[key] ?? {
      assumptions: 0,
      heuristicSum: 0,
      engineSum: 0,
      gapSum: 0,
      avgHeuristic: 0,
      avgEngine: 0,
      avgGap: 0,
      classification: 'no-data',
      byStyle: {},
      byStreet: {},
    };
    agg.assumptions += 1;
    agg.heuristicSum += row.heuristicDividend;
    agg.engineSum += row.engineDividend;
    agg.gapSum += row.gap;
    agg.byStyle[row.style] = (agg.byStyle[row.style] ?? 0) + 1;
    const streetKey = row.street ?? 'any';
    agg.byStreet[streetKey] = (agg.byStreet[streetKey] ?? 0) + 1;
    report.perPredicate[key] = agg;
  }
  for (const key of Object.keys(report.perPredicate)) {
    const agg = report.perPredicate[key];
    if (agg.assumptions > 0) {
      agg.avgHeuristic = agg.heuristicSum / agg.assumptions;
      agg.avgEngine = agg.engineSum / agg.assumptions;
      agg.avgGap = agg.gapSum / agg.assumptions;
      agg.classification = classifyGap(agg.avgGap);
    }
    // Drop intermediate sums — keep the rollup compact.
    delete agg.heuristicSum;
    delete agg.engineSum;
    delete agg.gapSum;
  }

  if (report.engineBailouts > 0) {
    report.warnings.push(`${report.engineBailouts} assumption(s) excluded — engine could not produce a baseline`);
  }

  return report;
};

// ───────────────────────────────────────────────────────────────────────────
// Real-mode evaluation (Plan B / S21)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Resolve blinds per session — caches the lookup so we don't re-fetch across
 * many hands sharing a session. Returns a Map<sessionId, { sb, bb }>.
 *
 * Defaults to { sb: 1, bb: 2 } when getSession is null or returns no record.
 */
const resolveBlindsBySession = async (hands, getSession) => {
  const blindsBySession = new Map();
  if (!Array.isArray(hands)) return blindsBySession;

  const sessionIds = new Set();
  for (const hand of hands) {
    if (hand?.sessionId != null) sessionIds.add(hand.sessionId);
  }

  if (typeof getSession !== 'function') {
    // No resolver — every session falls back to the default.
    for (const sid of sessionIds) blindsBySession.set(sid, { sb: 1, bb: 2 });
    return blindsBySession;
  }

  for (const sid of sessionIds) {
    try {
      const session = await getSession(sid);
      const gameType = session?.gameType ?? '1/2';
      blindsBySession.set(sid, parseBlinds(gameType));
    } catch {
      blindsBySession.set(sid, { sb: 1, bb: 2 });
    }
  }
  return blindsBySession;
};

/**
 * Default villain-seat resolver — mirrors historyBacktest.
 */
const defaultGetVillainSeatRealMode = (villainId, hand) => {
  const sp = hand?.seatPlayers;
  if (!sp || typeof sp !== 'object') return null;
  for (const [seat, playerId] of Object.entries(sp)) {
    if (playerId === villainId) return Number(seat);
  }
  return null;
};

/**
 * Real-mode per-assumption evaluator.
 *
 * Walks every matched decision node across every hand for the assumption's
 * villain. Reconstructs state per node, runs engine + producer per firing,
 * averages the dividend.
 *
 * @returns {Promise<Array<{ assumption, tendency, result, firings, firingsSkipped }>>}
 *          Same shape contract the synthesized-mode evaluator returns; `result`
 *          carries `engineDividend` (averaged) when at least one firing succeeded,
 *          or `null` baseline + reason when no firings produced a value.
 */
const evaluateAllRealMode = async (
  assumptions,
  hands,
  villainTendencies,
  { getSession, getVillainSeat, computeOpts, reconstructorDefaults, report },
) => {
  const out = [];
  if (!Array.isArray(hands) || hands.length === 0) {
    report.warnings.push('Real-mode requires hands; none provided');
    // Return empty results per-assumption so the downstream loop records bailouts.
    for (const a of assumptions) {
      out.push({
        assumption: a,
        tendency: resolveTendency(a, villainTendencies),
        result: { baseline: null, node: null, reason: 'no-hands' },
        firings: 0,
        firingsSkipped: 0,
      });
    }
    return out;
  }

  const blindsBySession = await resolveBlindsBySession(hands, getSession);
  const villainSeatResolver = typeof getVillainSeat === 'function'
    ? getVillainSeat
    : defaultGetVillainSeatRealMode;

  // Pre-compute decision nodes once per hand (same approach as historyBacktest).
  const nodesByHand = hands.map((hand) => ({ hand, nodes: extractDecisionNodes(hand) }));

  for (const a of assumptions) {
    const tendency = resolveTendency(a, villainTendencies);
    const scope = a?.claim?.scope;
    const villainId = a?.villainId;
    if (!scope || !villainId) {
      out.push({
        assumption: a,
        tendency,
        result: { baseline: null, node: null, reason: 'missing-scope-or-villainId' },
        firings: 0,
        firingsSkipped: 0,
      });
      continue;
    }

    const perFiringDividends = [];
    let firstSucceededNode = null;
    let firstBaseline = null;
    let firingsSkipped = 0;
    let firingsPinned = 0;          // Q3 follow-on: showdown-pinned villain range
    let firingsStyleSynthesized = 0;
    const localSkipReasons = {};

    for (const { hand, nodes } of nodesByHand) {
      const seat = villainSeatResolver(villainId, hand);
      if (seat == null) continue;

      // Resolve blinds for this hand's session
      const blinds = blindsBySession.get(hand.sessionId) ?? { sb: 1, bb: 2 };

      for (const node of nodes) {
        if (node.villainSeat !== seat) continue;
        if (!scopeMatches(scope, node)) continue;

        // Reconstruct state at this node
        const recon = reconstructStateAtDecisionNode({
          hand,
          decisionNode: node,
          blinds,
          villainTendency: tendency,
          defaults: reconstructorDefaults,
        });

        if (!recon.reconstructed) {
          firingsSkipped += 1;
          const r = recon.reason ?? 'unknown';
          localSkipReasons[r] = (localSkipReasons[r] ?? 0) + 1;
          continue;
        }

        // Engine eval against the reconstructed node
        let result;
        try {
          result = await computeBaselineForAssumption({
            assumption: a,
            villainTendency: tendency,
            node: recon,
            opts: computeOpts,
          });
        } catch (err) {
          firingsSkipped += 1;
          const r = `engine-throw: ${err?.message ?? String(err)}`;
          localSkipReasons[r] = (localSkipReasons[r] ?? 0) + 1;
          continue;
        }

        if (!result?.baseline) {
          firingsSkipped += 1;
          const r = result?.reason ?? 'no-baseline';
          localSkipReasons[r] = (localSkipReasons[r] ?? 0) + 1;
          continue;
        }

        // Producer eval
        let cited;
        try {
          cited = produceCitedDecision({
            node: recon,
            assumptions: [a],
            baseline: result.baseline,
            options: { surface: 'drill', villainStyle: tendency.style },
          });
        } catch (err) {
          firingsSkipped += 1;
          const r = `producer-throw: ${err?.message ?? String(err)}`;
          localSkipReasons[r] = (localSkipReasons[r] ?? 0) + 1;
          continue;
        }

        if (!cited || !Number.isFinite(cited.dividend)) {
          firingsSkipped += 1;
          const r = cited?.reason ?? 'producer-no-citation';
          localSkipReasons[r] = (localSkipReasons[r] ?? 0) + 1;
          continue;
        }

        perFiringDividends.push(cited.dividend);
        if (recon.villainRangeSource === 'showdown-pinned') firingsPinned += 1;
        else firingsStyleSynthesized += 1;
        if (firstSucceededNode == null) {
          firstSucceededNode = recon;
          firstBaseline = result.baseline;
        }
      }
    }

    // Tally local skips into global report
    report.perFiringSkipped += firingsSkipped;
    for (const [reason, count] of Object.entries(localSkipReasons)) {
      report.skipReasonCounts[reason] = (report.skipReasonCounts[reason] ?? 0) + count;
    }

    if (perFiringDividends.length === 0) {
      out.push({
        assumption: a,
        tendency,
        result: {
          baseline: null,
          node: null,
          reason: firingsSkipped > 0 ? 'all-firings-skipped' : 'no-matching-firings',
        },
        firings: 0,
        firingsSkipped,
        firingsPinned: 0,
        firingsStyleSynthesized: 0,
      });
      continue;
    }

    const avgDividend = perFiringDividends.reduce((s, d) => s + d, 0) / perFiringDividends.length;
    out.push({
      assumption: a,
      tendency,
      result: {
        baseline: firstBaseline,
        node: firstSucceededNode,
        engineDividend: avgDividend,
        source: 'real-firings',
      },
      firings: perFiringDividends.length,
      firingsSkipped,
      firingsPinned,
      firingsStyleSynthesized,
    });
  }

  return out;
};

// Exposed for tests
export const __TEST_ONLY__ = Object.freeze({
  computeGap,
  flattenAssumptions,
  resolveTendency,
  resolveBlindsBySession,
  defaultGetVillainSeatRealMode,
  HEURISTIC_EPS,
});
