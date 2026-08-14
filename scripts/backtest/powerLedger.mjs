/**
 * powerLedger.mjs — per-player variance persisted from every completed scoring run, and the
 * pre-flight MDE computed from it BEFORE the next run burns wall-clock (WS-435).
 *
 * THE PROBLEM THIS SOLVES. The repo's only MDE (`classifyPlayerSignal`,
 * rangeCalibrationProbe.mjs) needs a per-player standard error that exists solely as the
 * output of a COMPLETED pass — so no run could be told in advance whether it could answer
 * its own question, and a null result was unreadable: "the fix did nothing" and "the
 * instrument had no power" printed identically. DEPTH-ABLATION-2026-08-05 says it plainly:
 * "At 260 decisions and 22 players the instrument cannot separate a half-big-blind effect
 * from nothing."
 *
 * THE SEPARATOR IS POWER, NOT SAMPLE SIZE — `classifyPlayerSignal`'s rule, applied one
 * level up: mde = z · se, where `se` here is the bootstrap SD of the SAME statistic under
 * the SAME player-cluster resampling the real run will use. The pre-flight does not model
 * the instrument; it RUNS the instrument (`clusterBootstrapCI` with `drawClusters` set to
 * the planned player count) over the persisted per-player rows. Same LCG, same WIS
 * nonlinearity, same clustering — an analytic sd/sqrt(P) would be a second comparison path,
 * which ADR-009 exists to forbid.
 *
 * WHY RAW RATIOS, NOT WEIGHTS. `weightFor` clips at the run's weight cap. A ledger of
 * clipped weights could not honestly simulate a planned run at a DIFFERENT --weight-cap, so
 * the ledger stores the raw uncapped ratio per decision and the pre-flight re-clips at the
 * PLANNED cap. Per-decision granularity is kept (not per-player aggregates) so a planned
 * per-player decision cap can be honored by truncation — the record's shape outlives the
 * questions asked of it today.
 *
 * WHY THE LEDGER IS TRACKED. `out/` is gitignored; a basis that lives beside the run
 * artifacts dies with the machine. `docs/standard-of-record/power/` is in git, so the
 * second machine and the second month both start from a real basis instead of a one-point
 * extrapolation.
 *
 * UNITS. Everything here is bb — the units of the claim the gate protects — never Δ-log.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  weightFor, wisValue, poolValue, clusterBootstrapCI,
  DEFAULT_BOOTSTRAP_SEED, DEFAULT_BOOTSTRAP_RESAMPLES, DEFAULT_WEIGHT_CAP,
  Z_DETECT, Z80_POWER,
} from './ipsEstimator.mjs';
import { MIN_CLUSTERS_FOR_CI } from './heroEvReport.mjs';
import { resolvePerPlayerCap } from './heroEvRunner.mjs';

export const POWER_LEDGER_SCHEMA_VERSION = 1;

/** Tracked. See header — a gitignored basis is a basis one machine wide. */
export const POWER_LEDGER_DIR = 'docs/standard-of-record/power';

/**
 * WS-410's target effect for the hero-EV instrument, previously prose in run-hero-ev.mjs's
 * player-supply log line ("power target for 0.20bb MDE"). This is now its definition site;
 * that log line and the gate default both import it.
 */
export const TARGET_EFFECT_BB = 0.20;

/**
 * The two founder-decision switch points (2026-08-14, WS-435 sprint):
 *
 *   - gate MODE: 'refuse' — an underpowered plan stops before spending days of wall-clock,
 *     with --power-override "<reason>" as the recorded escape.
 *   - gate FORMULA: 'power80' — the blocking figure is the 80%-power MDE. A run whose
 *     detection-boundary MDE equals the target has a COIN FLIP's chance of seeing it;
 *     gating on that would bless runs that cannot honestly answer their question.
 *
 * The 80% bar is deliberately a constant and not doctrine — the founder holds it as an
 * OPEN question (synthetic-data bridging may later change what "resolvable" means, and
 * extreme-tail spots such as betting into a nutted range need their own attention). Both
 * figures are always computed and reported; these constants only pick what gates.
 */
export const DEFAULT_POWER_GATE_MODE = 'refuse';
export const POWER_GATE_FORMULA = 'power80';

const round6 = (x) => Number(x.toFixed(6));

/**
 * Extract per-player raw-ratio rows from a completed run's decision list.
 *
 * Single-arm (kind 'hero-ev'): rows are `{r, net}` where `r` is the RAW pi_ours/pi_pool
 * ratio (uncapped — see header). Paired (kind 'depth-ablation'): pass `arms: {base, test}`
 * and rows are `{rA, rB, net}` from `piOursByArm`.
 *
 * The skip taxonomy is `weightFor`'s own (zero-propensity, missing-outcome, …), applied
 * with an infinite cap so nothing is clipped and nothing extra is dropped — the ledger
 * scores exactly the population `estimateEdge`/`pairedDelta` would score. Row order is the
 * run's scoring order, so a later first-N truncation mirrors the runner's own per-player
 * cap semantics.
 */
export const extractPowerRows = (decisions, { arms = null } = {}) => {
  const byPlayer = new Map();
  const skipped = {};
  const bump = (k) => { skipped[k] = (skipped[k] || 0) + 1; };
  let kept = 0;

  for (const d of decisions ?? []) {
    let row = null;
    if (arms) {
      const a = d.piOursByArm?.[arms.base];
      const b = d.piOursByArm?.[arms.test];
      if (!a || !b) { bump('missing-arm'); continue; }
      const wa = weightFor({ ...d, piOurs: a }, { weightCap: Infinity });
      const wb = weightFor({ ...d, piOurs: b }, { weightCap: Infinity });
      if (!wa.ok) { bump(`${arms.base}:${wa.reason}`); continue; }
      if (!wb.ok) { bump(`${arms.test}:${wb.reason}`); continue; }
      row = { rA: round6(wa.raw), rB: round6(wb.raw), net: round6(wa.net) };
    } else {
      const w = weightFor(d, { weightCap: Infinity });
      if (!w.ok) { bump(w.reason); continue; }
      row = { r: round6(w.raw), net: round6(w.net) };
    }
    let bucket = byPlayer.get(d.playerId);
    if (!bucket) byPlayer.set(d.playerId, (bucket = []));
    bucket.push(row);
    kept++;
  }

  return {
    byPlayer: [...byPlayer.entries()].map(([playerId, rows]) => ({ playerId, rows })),
    decisions: kept,
    skipped,
  };
};

/**
 * Build a ledger entry from a completed run. Every stamp field is READ from the run's own
 * replication stamp / Deal Book / config — never re-derived here (a re-derivation is a
 * transcription with extra steps).
 */
export const buildLedgerEntry = ({ run, kind, extracted, weightCap = DEFAULT_WEIGHT_CAP }) => ({
  schemaVersion: POWER_LEDGER_SCHEMA_VERSION,
  kind,
  createdAt: new Date().toISOString(),
  dealBookId: run.dealBook?.dealBookId ?? null,
  dealBookHash: run.dealBook?.contentHash ?? run.replicationStamp?.dealBookHash ?? null,
  engineCommit: run.replicationStamp?.engineCommit ?? null,
  engineDirty: run.replicationStamp?.engineDirty ?? null,
  weightCap,
  players: extracted.byPlayer.length,
  decisions: extracted.decisions,
  skipped: extracted.skipped,
  config: {
    maxPlayers: run.config?.maxPlayers ?? null,
    maxDecisions: run.config?.maxDecisions ?? null,
    maxDecisionsPerPlayer: run.config?.maxDecisionsPerPlayer ?? null,
    refinementBudgetMs: run.config?.depthArms?.map((a) => a.refinementBudgetMs) ?? null,
  },
  caveat:
    'POWER BASIS ONLY — per-player raw importance ratios persisted for pre-flight MDE '
    + 'simulation (WS-435). Not a result; no figure in this file may be quoted as one.',
  byPlayer: extracted.byPlayer,
});

const cleanInfinity = (v) => (Number.isFinite(v) ? v : null);

/** Deterministic, collision = same measurement (idempotent overwrite by design). */
export const entryFileName = (entry) => {
  const hash8 = (entry.dealBookHash ?? 'nohash').replace('sha256:', '').slice(0, 8);
  const commit8 = (entry.engineCommit ?? 'nocommit').slice(0, 8);
  const day = (entry.createdAt ?? '').slice(0, 10).replace(/-/g, '') || 'nodate';
  return `${entry.kind}-${hash8}-${commit8}-${day}.json`;
};

/**
 * Persist an entry. REFUSES an incomplete run or a <2-player basis — a smoke run must not
 * be able to pollute the basis every future gate reads. Refusal is a return value, never a
 * throw: ledger bookkeeping must not kill the report that follows it.
 */
export const appendLedgerEntry = ({ dir = POWER_LEDGER_DIR, entry, complete }) => {
  if (complete === false) {
    return { written: false, reason: 'run incomplete — a partial basis would understate variance for every future gate' };
  }
  if (!entry?.byPlayer?.length || entry.byPlayer.length < 2) {
    return { written: false, reason: `${entry?.byPlayer?.length ?? 0} player(s) — a cluster basis needs at least 2` };
  }
  try {
    mkdirSync(dir, { recursive: true });
    const path = join(dir, entryFileName(entry));
    writeFileSync(path, JSON.stringify(entry, null, 1));
    return { written: true, path };
  } catch (err) {
    return { written: false, reason: `write failed: ${err?.message || err}` };
  }
};

/** Load all entries of a kind. Missing dir is an empty ledger, not an error. */
export const loadPowerLedger = ({ dir = POWER_LEDGER_DIR, kind }) => {
  if (!existsSync(dir)) return [];
  const entries = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const e = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (e?.kind === kind && e?.schemaVersion <= POWER_LEDGER_SCHEMA_VERSION && Array.isArray(e?.byPlayer)) {
        entries.push({ ...e, file: f });
      }
    } catch { /* an unreadable entry is skipped, never fatal — the gate degrades to fewer bases */ }
  }
  return entries;
};

/** Deterministic basis choice: most players, tie → newest. Stated so it can be argued with. */
export const selectBasisEntry = (entries) => {
  if (!entries?.length) return null;
  return [...entries].sort((a, b) =>
    (b.players - a.players) || String(b.createdAt).localeCompare(String(a.createdAt)))[0];
};

/**
 * The pre-flight MDE: the smallest effect the PLANNED run could resolve, computed by
 * running the real instrument over the persisted basis at the planned configuration.
 *
 * THE SEPARATOR IS POWER, NOT SAMPLE SIZE (`classifyPlayerSignal`'s rule, one level up).
 * `mdeDetectBB = Z_DETECT · se` is the effect that would just reach significance — seeing
 * it is a coin flip. `mdePower80BB = (Z_DETECT + Z80_POWER) · se` is the effect the run has
 * a 4-in-5 chance of resolving; per founder ruling it is the one that gates (POWER_GATE_FORMULA).
 *
 * EXTRAPOLATION ASYMMETRY, stated because it decides how to read the flags: when
 * plannedPlayers exceeds the basis player count, the basis under-represents tail players,
 * so the simulated SE errs OPTIMISTIC. A REFUSAL under extrapolation is therefore safe —
 * reality is worse than the simulation that already refused. A PASS at a large
 * extrapolation ratio is the direction that needs suspicion, and carries its own warning.
 */
export const preflightMde = ({
  entry,
  plannedPlayers,
  plannedDecisionsPerPlayer = Infinity,
  plannedWeightCap = DEFAULT_WEIGHT_CAP,
  targetEffectBB = TARGET_EFFECT_BB,
  resamples = DEFAULT_BOOTSTRAP_RESAMPLES,
  seed = DEFAULT_BOOTSTRAP_SEED,
  currentEngineCommit = null,
  currentDealBookHash = null,
}) => {
  if (!entry) return null;
  const paired = entry.kind !== 'hero-ev';

  const unboundedPlan = !Number.isFinite(plannedPlayers);
  const draws = unboundedPlan ? entry.players : Math.floor(plannedPlayers);
  if (!(draws >= 2)) return null;

  const cap = Number.isFinite(plannedDecisionsPerPlayer) ? plannedDecisionsPerPlayer : Infinity;
  const byPlayer = new Map();
  for (const p of entry.byPlayer) {
    const rows = (cap < p.rows.length ? p.rows.slice(0, cap) : p.rows).map((row) => (paired
      ? { wA: Math.min(row.rA, plannedWeightCap), wB: Math.min(row.rB, plannedWeightCap), net: row.net }
      : { w: Math.min(row.r, plannedWeightCap), net: row.net }));
    if (rows.length) byPlayer.set(p.playerId, rows);
  }

  const statOf = paired
    ? (chunk) => {
      const vA = wisValue(chunk.map((r) => ({ w: r.wA, net: r.net })));
      const vB = wisValue(chunk.map((r) => ({ w: r.wB, net: r.net })));
      return (vA !== null && vB !== null) ? vB - vA : null;
    }
    : (chunk) => {
      const a = wisValue(chunk);
      const b = poolValue(chunk);
      return (a !== null && b !== null) ? a - b : null;
    };

  const ci = clusterBootstrapCI(byPlayer, statOf, { resamples, seed, drawClusters: draws });
  if (!ci) return null;

  const se = ci.sd;
  const mdeDetectBB = Number((Z_DETECT * se).toFixed(4));
  const mdePower80BB = Number(((Z_DETECT + Z80_POWER) * se).toFixed(4));
  const gateMdeBB = POWER_GATE_FORMULA === 'power80' ? mdePower80BB : mdeDetectBB;
  const resolvable = gateMdeBB <= targetEffectBB;

  // 1/sqrt(P) inversion of the SAME simulated se — an ESTIMATE for the operator's next
  // move, not a claim; the gate at that count re-simulates rather than trusting this.
  const playersNeeded = resolvable
    ? draws
    : Math.ceil(draws * (gateMdeBB / targetEffectBB) ** 2);

  const extrapolationRatio = draws / entry.players;
  return {
    kind: entry.kind,
    basis: {
      file: entry.file ?? null,
      players: entry.players,
      decisions: entry.decisions,
      dealBookHash: entry.dealBookHash,
      engineCommit: entry.engineCommit,
      weightCap: entry.weightCap,
    },
    plannedPlayers: unboundedPlan ? null : draws,
    plannedDecisionsPerPlayer: cleanInfinity(cap),
    plannedWeightCap,
    simulatedAtPlayers: draws,
    predictedSeBB: Number(se.toFixed(4)),
    mdeDetectBB,
    mdePower80BB,
    targetEffectBB,
    gateFormula: POWER_GATE_FORMULA,
    gateMdeBB,
    resolvable,
    resolvableAtDetect: mdeDetectBB <= targetEffectBB,
    resolvableAtPower80: mdePower80BB <= targetEffectBB,
    playersNeeded,
    flags: {
      unboundedPlan,
      extrapolated: extrapolationRatio > 1,
      extrapolationRatio: Number(extrapolationRatio.toFixed(2)),
      basisBelowClusterBar: entry.players < MIN_CLUSTERS_FOR_CI,
      staleEngineCommit: currentEngineCommit === null || entry.engineCommit === null
        ? null
        : entry.engineCommit !== currentEngineCommit,
      differentDealBook: currentDealBookHash === null || entry.dealBookHash === null
        ? null
        : entry.dealBookHash !== currentDealBookHash,
      weightCapReclipped: entry.weightCap !== plannedWeightCap,
    },
  };
};

/**
 * The whole gate computation from a runner's parsed flags: load ledger → pick basis →
 * derive the effective planned configuration → simulate.
 *
 * The per-player cap comes from `resolvePerPlayerCap` — the runner's OWN exported formula,
 * imported so the gate plans with exactly what the run will execute. When `--max-decisions`
 * binds before the player count does (global ceiling / effective decisions-per-player <
 * planned players), the gate simulates at the player count the ceiling actually supports
 * and flags it — consistent with the report's own line: the power lever is --max-players,
 * --max-decisions is a ceiling.
 *
 * A plan the ceiling squeezes below 2 players is clamped to 2 — the simulation still runs
 * and refuses honestly, rather than degenerating into the no-basis path.
 */
export const preflightForPlan = ({
  kind,
  dir = POWER_LEDGER_DIR,
  maxPlayers = Infinity,
  targetContributingPlayers = null,
  maxDecisionsPerPlayer = null,
  maxDecisions = Infinity,
  weightCap = DEFAULT_WEIGHT_CAP,
  targetEffectBB = TARGET_EFFECT_BB,
  currentEngineCommit = null,
}) => {
  const basis = selectBasisEntry(loadPowerLedger({ dir, kind }));
  if (!basis) return null;

  let planned = Math.min(
    Number.isFinite(maxPlayers) ? maxPlayers : Infinity,
    targetContributingPlayers ?? Infinity,
  );
  const cap = resolvePerPlayerCap({
    maxDecisionsPerPlayer,
    maxDecisions,
    plannedPlayers: Number.isFinite(planned) ? planned : basis.players,
  });

  const meanDpp = basis.decisions / basis.players;
  const effDpp = Math.min(Number.isFinite(cap) ? cap : Infinity, meanDpp);
  let decisionsCeilingBinds = false;
  if (Number.isFinite(maxDecisions) && effDpp > 0) {
    const supportable = Math.max(2, Math.floor(maxDecisions / effDpp));
    if (!Number.isFinite(planned) || supportable < planned) {
      planned = supportable;
      decisionsCeilingBinds = true;
    }
  }

  const pf = preflightMde({
    entry: basis,
    plannedPlayers: planned,
    plannedDecisionsPerPlayer: cap,
    plannedWeightCap: weightCap,
    targetEffectBB,
    currentEngineCommit,
  });
  if (pf) pf.flags.decisionsCeilingBinds = decisionsCeilingBinds;
  return pf;
};

const BAR = '═'.repeat(94);

/** The unmissable block. Rendered whether the verdict is pass, warn, or refusal. */
export const renderPreflight = (pf) => {
  const L = [];
  L.push(BAR);
  L.push('  PRE-FLIGHT MDE (WS-435) — can this run answer its question?');
  L.push(BAR);
  if (!pf) {
    L.push('  NO POWER BASIS — the ledger has no compatible entry, so nothing can be gated.');
    L.push(`  This run will SEED the ledger on completion (${POWER_LEDGER_DIR}); the gate is`);
    L.push('  live from the second run onward. Until then a null result from this run is');
    L.push('  UNREADABLE: it cannot be told apart from an instrument with no power.');
    L.push(BAR);
    return L.join('\n');
  }
  L.push(`  basis: ${pf.basis.players} players / ${pf.basis.decisions} decisions`
    + `${pf.basis.file ? ` (${pf.basis.file})` : ''}`);
  L.push(`  planned: ${pf.plannedPlayers ?? 'unbounded (simulated at basis size)'} players, `
    + `${pf.plannedDecisionsPerPlayer ?? 'uncapped'} decisions/player, weight cap ${pf.plannedWeightCap}`);
  L.push(`  predicted SE ${pf.predictedSeBB} bb  →  MDE detect ${pf.mdeDetectBB} bb · 80% power ${pf.mdePower80BB} bb`);
  L.push(`  target effect: ${pf.targetEffectBB} bb  →  ${pf.resolvable ? 'RESOLVABLE' : '*** NOT RESOLVABLE ***'}`
    + ` (gate formula: ${pf.gateFormula})`);
  if (!pf.resolvable) {
    L.push(`  a run that could resolve ${pf.targetEffectBB} bb needs ~${pf.playersNeeded} contributing players`);
    L.push('  (1/sqrt(P) estimate from the same simulation; the gate re-simulates at that count).');
  }
  const warn = [];
  if (pf.flags.unboundedPlan) warn.push('plan is player-unbounded — power is supply-limited, which the ledger cannot see');
  if (pf.flags.extrapolated) warn.push(`extrapolating ${pf.flags.extrapolationRatio}x beyond the basis — simulated SE errs OPTIMISTIC (a pass here is softer than it reads)`);
  if (pf.flags.basisBelowClusterBar) warn.push(`basis has ${pf.basis.players} players, below the ${MIN_CLUSTERS_FOR_CI}-cluster bar — its own SE estimate is weak`);
  if (pf.flags.staleEngineCommit) warn.push('basis was measured on a different engine commit');
  if (pf.flags.differentDealBook) warn.push('basis was measured on a different Deal Book');
  if (pf.flags.weightCapReclipped) warn.push(`basis raw ratios re-clipped from cap ${pf.basis.weightCap} to ${pf.plannedWeightCap}`);
  if (pf.flags.decisionsCeilingBinds) warn.push('--max-decisions binds before the player count — gated at the player count the ceiling supports');
  for (const w of warn) L.push(`  ! ${w}`);
  L.push(BAR);
  return L.join('\n');
};

/**
 * The gate decision. Refusal is founder policy (2026-08-14): an underpowered plan stops
 * BEFORE the spend, and the only way through is a recorded reason. `warn` mode and the
 * override both proceed — but nothing proceeds silently.
 */
export const gateVerdict = (pf, { mode = DEFAULT_POWER_GATE_MODE, overrideReason = null } = {}) => {
  const banner = renderPreflight(pf);
  if (!pf) return { proceed: true, exitCode: 0, banner, firstRun: true };
  if (pf.resolvable) return { proceed: true, exitCode: 0, banner };
  if (overrideReason) {
    return {
      proceed: true,
      exitCode: 0,
      banner: `${banner}\n  OVERRIDDEN — proceeding on founder authority: "${overrideReason}"\n  The reason is stamped into the run's provenance.`,
    };
  }
  if (mode === 'warn') {
    return {
      proceed: true,
      exitCode: 0,
      banner: `${banner}\n  PROCEEDING (--power-gate warn) — any null from this run is a statement about the\n  instrument, not the effect.`,
    };
  }
  return {
    proceed: false,
    exitCode: 2,
    banner: `${banner}\n  REFUSED — this configuration cannot resolve the targeted effect; running it would\n  spend wall-clock on a question it cannot answer. Raise the player count (see above),\n  lower --target-effect-bb deliberately, or pass --power-override "<reason>" to record\n  an intentional underpowered run.`,
  };
};
