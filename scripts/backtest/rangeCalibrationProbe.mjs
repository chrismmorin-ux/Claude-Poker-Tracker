/**
 * rangeCalibrationProbe.mjs — is an inferred range calibrated against the hand actually held?
 *
 * READ-ONLY MEASUREMENT. Changes nothing; answers a question that had never been asked.
 *
 * WHY. Showdown reveals what a seat really held. The engine, meanwhile, carries an
 * INFERRED range for that seat at every decision. Nothing in this repo had ever compared
 * the two, because there is no abstraction that joins "what was revealed" to "what we
 * believed" — so the ground truth sat unused next to the inference for the life of the
 * project.
 *
 * THE ONE METRIC THAT IS NOT ARGUABLE. Coverage: does the inferred range assign ANY
 * probability to the hand that was actually held? A model that assigns zero to an event
 * that occurred is not miscalibrated, it is falsified. Everything else here is a matter
 * of degree; that is a matter of kind.
 *
 * THE FAIR BASELINE. Coverage alone flatters a wide range — keep every combo and coverage
 * is 100%. So coverage is always reported against the RETAINED FRACTION of combos, which
 * is what a range of that width would score by eliminating at random. `coverageLift` =
 * coverage / retainedFraction is the honest measure of whether narrowing carries signal.
 *
 * THREE SURFACES ARE PROBED, because `narrowByBoard` feeds all of them:
 *   1. ACTING SEAT   — the range `decisionAccumulator` tracks, one narrowing per street.
 *   2. VILLAIN SEAT  — the range `gameTreeContext:219` hands to the EV computation. This
 *                      is the one that decides recommendations.
 *   3. CHAINED       — `gameTreeDepth2` re-narrows the same range 2-3 more times inside a
 *                      single evaluation, so the deep branches see a range cut repeatedly.
 */

import { buildRangeProfile } from '../../src/utils/rangeEngine/index.js';
import { accumulateDecisions } from '../../src/utils/exploitEngine/decisionAccumulator.js';
import {
  narrowByBoard, classifyComboFull, computeComboEquity,
} from '../../src/utils/exploitEngine/postflopNarrower.js';
import { buildBaselineRange } from '../../src/utils/exploitEngine/preflopAdvisor.js';
import { decodeIndex } from '../../src/utils/pokerCore/rangeMatrix.js';
import { scoreCoverage, holdingTruth } from '../../src/utils/holdingKnowledge/index.js';
import { parseAndEncode, encodeCard, cardRank } from '../../src/utils/pokerCore/cardParser.js';
import { comboStrengthPercentile } from '../../src/utils/pokerCore/handEvaluator.js';
import { getRangePositionCategory } from '../../src/utils/positionUtils.js';
import { TAU_FRACTION } from '../../src/utils/pokerCore/softWeights.js';
import { indexEvalPlayers } from './runner.mjs';
import { GROUPS, fnv1a32 } from './partition.mjs';
// WS-321. The admissibility bars are IMPORTED, not restated. A second copy of
// `MIN_PLAYERS_FOR_QUOTE = 30` living here would agree with the canonical one right up until
// the day it did not — the exact shape of the `PRIOR_WEIGHT` shadow that `replicationStamp.mjs`
// records as a known divergence. `rangeCalibrationReport.mjs` does not import this module, so
// there is no cycle.
import { MIN_PLAYERS_FOR_QUOTE } from './rangeCalibrationReport.mjs';
import { buildResultCard } from '../../src/utils/standardOfRecord/resultCard.js';
import { buildReplicationManifest } from '../../src/utils/standardOfRecord/manifest.js';

const USER_ID = 'backtest';

// Exported for tests (WS-293): the calibration arithmetic is pinned against the REAL
// accumulator rather than a re-implementation in the test file. A test that rebuilds `push`
// passes just as happily when `push` is the thing that broke.
export const mkStat = () => ({
  n: 0, covered: 0, retainedSum: 0, sumLogP: 0, sumLogU: 0,
  nPos: 0, sumLogPpos: 0, sumLogUpos: 0,
});

export const push = (s, { covered, retained, p, u }) => {
  s.n++;
  s.retainedSum += retained;
  if (covered) { s.covered++; s.nPos++; s.sumLogPpos += Math.log(p); s.sumLogUpos += Math.log(u); }
  s.sumLogP += Math.log(Math.max(p, 1e-9));
  s.sumLogU += Math.log(u);
};

export const summarize = (s) => {
  if (!s || !s.n) return null;
  const retained = s.retainedSum / s.n;
  const coverage = s.covered / s.n;
  return {
    n: s.n,
    coverage,
    retainedFraction: retained,
    // >1 means the narrowing keeps the true hand more often than eliminating at random
    // would; ~1 means the eliminations are effectively arbitrary.
    coverageLift: retained > 0 ? coverage / retained : null,
    deltaLogVsUniform: (s.sumLogP - s.sumLogU) / s.n,
    deltaLogGivenCovered: s.nPos ? (s.sumLogPpos - s.sumLogUpos) / s.nPos : null,
  };
};

/**
 * Score one (range, revealed hand) pair.
 *
 * WS-292: the implementation moved to `src/utils/holdingKnowledge/coverage.js`. It used to
 * live here and ONLY here — the sole join between what the engine believed and what a seat
 * turned up existed in a backtest script, outside `src/`, so nothing the app ships could
 * ask the question. This is now a field-name adapter over the primitive and nothing more.
 *
 * The adapter keeps `push()` consuming `p` and `u` separately rather than taking the
 * primitive's ready-made `logLift`. That is deliberate: summing (log p − log u) per
 * decision is not bit-identical to (Σ log p) − (Σ log u) in floating point, and this
 * refactor must not move a published number by a last-bit rounding difference.
 *
 * @returns {{covered, retained, p, u}|null}
 */
const scoreRange = (range, board, hole, dead = []) => {
  const s = scoreCoverage(range, board, hole, dead);
  if (!s) return null;
  return { covered: s.covered, retained: s.retainedFraction, p: s.weightOfTruth, u: s.uniformWeight };
};

const strengthBand = (pct) => (pct == null ? 'unknown' : pct >= 0.8 ? 'strong' : pct >= 0.5 ? 'medium' : 'weak');

// ─── WS-293: showdown selection accounting ───────────────────────────────────
//
// THE PROBLEM THIS EXISTS TO MAKE VISIBLE. Every number this probe reports is conditioned on
// the holding having been REVEALED. Hands reach showdown conditionally on the action, and
// which hands get shown is itself strategy-dependent — so scoring an inferred range only
// against revealed hands measures the showdown filter as much as the range model. That is
// `FAULT-showdown-selection` in the Suspected-Fault Register, and until WS-293 this probe
// had no term for it at all: `holdingTruth` returns null for "not revealed" and
// `{refused, reason}` for hypothesized/unscoreable, and the probe collapsed all three into
// one silent skip. The information was computed and thrown away.
//
// WHAT IS DONE ABOUT IT. The selection is NOT corrected away — it cannot be, because the
// counterfactual (what did the seat hold on the decisions where nothing was shown?) is
// exactly the thing the corpus does not record. Instead POKER_THEORY §14.1's prescription is
// followed: the conditional is FACTORED so the selection becomes an explicit estimable term
// rather than a hidden property of the denominator.
//
//     P(covered ∧ revealed | decision)  =  P(revealed | decision) × P(covered | revealed)
//                                           └── revealRate ──┘      └── what we report ──┘
//
// From that factorisation two things follow that are reported as DATA on every run, never as
// prose in a document nobody opens:
//
//   1. WORST-CASE BOUNDS over ALL decisions, not just revealed ones. Coverage over the full
//      decision set is bounded below by assuming every unrevealed decision was a miss and
//      above by assuming every one was covered. These are assumption-free (Manski) bounds:
//        lower = coverage × revealRate           upper = lower + (1 − revealRate)
//      Their width is exactly (1 − revealRate). When reveals are scarce the width approaches
//      1 and the honest reading is that the metric says almost nothing about the population —
//      which is a fact about the instrument that a reader must be handed, not left to infer.
//
//   2. THE INVERSE CONDITIONAL. Coverage is P(covered | revealed, slice). The repo's standing
//      rule is that a number carries its conditioning set AND its inverse, because the two
//      support opposite reads. So each slice also reports P(slice | revealed) against
//      P(slice | scoreable) — the composition shift. Their ratio is the showdown filter's
//      fingerprint: a slice over-represented among revealed decisions relative to all
//      decisions is one the filter selects FOR, and its calibration number is the most
//      selection-contaminated on the page.
//
// Refusals are counted SEPARATELY from non-reveals and never folded into either. A refusal is
// a data or branch problem (`unscoreable`, `hypothesized`), not a showdown outcome; averaging
// it in as a miss would understate the model, and counting it as unrevealed mass would
// overstate the selection. Three categories, three counters.
const mkSel = () => ({ opportunities: 0, revealed: 0, refused: 0, refusedByReason: {} });

/**
 * Record one decision's reveal outcome.
 * @param {Object} s - a `mkSel()` bucket
 * @param {'revealed'|'not-revealed'|'refused'} outcome
 * @param {string|null} reason - refusal reason, when outcome is 'refused'
 */
const pushSel = (s, outcome, reason = null) => {
  s.opportunities++;
  if (outcome === 'revealed') s.revealed++;
  else if (outcome === 'refused') {
    s.refused++;
    const k = reason || 'unknown';
    s.refusedByReason[k] = (s.refusedByReason[k] || 0) + 1;
  }
};

/**
 * Turn a selection bucket into the reported term.
 *
 * `scoreable` — decisions where a reveal was possible in principle — is the denominator of
 * `revealRate`, and it EXCLUDES refusals deliberately (see the note above). `null` rather than
 * a fabricated 0 when nothing was scoreable, because a rate over an empty set is not 0.
 */
export const summarizeSelection = (s) => {
  if (!s || !s.opportunities) return null;
  const scoreable = s.opportunities - s.refused;
  const revealRate = scoreable > 0 ? s.revealed / scoreable : null;
  return {
    opportunities: s.opportunities,
    scoreable,
    revealed: s.revealed,
    notRevealed: scoreable - s.revealed,
    refused: s.refused,
    refusedByReason: { ...s.refusedByReason },
    revealRate,
  };
};

/**
 * Assumption-free bounds on coverage over ALL scoreable decisions (WS-293).
 *
 * The point estimate `coverage` is P(covered | revealed). These bracket P(covered | scoreable)
 * without assuming anything about the unrevealed decisions — the lower bound calls every one a
 * miss, the upper bound calls every one covered. `width` is the honest statement of how much
 * of the answer the showdown filter is withholding.
 *
 * @returns {{lower, upper, width, revealRate}|null}
 */
export const coverageSelectionBounds = (coverage, revealRate) => {
  if (!Number.isFinite(coverage) || !Number.isFinite(revealRate)) return null;
  const lower = coverage * revealRate;
  return { lower, upper: lower + (1 - revealRate), width: 1 - revealRate, revealRate };
};

/**
 * The inverse conditional: how the showdown filter reshapes the slice mix (WS-293).
 *
 * `shareOfRevealed` is P(slice | revealed); `shareOfScoreable` is P(slice | scoreable). The
 * repo's standing rule is that P(A|B) is reported with P(B|A) because they support opposite
 * reads — here the pair says whether a slice's calibration number was measured on a
 * representative set of that slice's decisions or on a filtered one.
 *
 * `selectionRatio` > 1 means the filter selects FOR this slice.
 *
 * @param {Object} bySlice - { [key]: mkSel() bucket }
 */
export const selectionComposition = (bySlice) => {
  const entries = Object.entries(bySlice || {});
  const totRevealed = entries.reduce((s, [, v]) => s + v.revealed, 0);
  const totScoreable = entries.reduce((s, [, v]) => s + (v.opportunities - v.refused), 0);
  if (!totRevealed || !totScoreable) return {};
  return Object.fromEntries(entries.map(([k, v]) => {
    const scoreable = v.opportunities - v.refused;
    const shareOfRevealed = v.revealed / totRevealed;
    const shareOfScoreable = scoreable / totScoreable;
    return [k, {
      shareOfRevealed,
      shareOfScoreable,
      selectionRatio: shareOfScoreable > 0 ? shareOfRevealed / shareOfScoreable : null,
      revealRate: scoreable > 0 ? v.revealed / scoreable : null,
      revealed: v.revealed,
      scoreable,
    }];
  }));
};

/**
 * Display floor for the per-player calibration table (WS-292). Players with fewer revealed
 * decisions than this are omitted from the REPORT because one showdown says nothing legible
 * — not because their evidence is discarded. Nothing estimates off this constant.
 */
const PER_PLAYER_MIN_N = 5;

// ─── WS-311: table-size stratification ───────────────────────────────────────
//
// §11.7–§11.9 were measured POOLED across table sizes. This app targets 9-handed play, so
// every villain-seat number needs to be readable per stratum, not just pooled.
//
// Keyed off the ACTUAL dealt-in player count carried on every corpus hand
// (`hand._backtest.dealtIn`, set in phhAdapter.mjs:429-430 from `players.length` — the raw
// PHH `players` list, whose length equals the hand's `seats = [...]` cardinality), never a
// table-name or stake-label heuristic.
//
// HEADS-UP IS NOT A STRATUM HERE, AND THAT IS CORRECT.
// The raw corpus does contain a large number of true 2-seat hands (PS especially). They have
// NEVER entered any measurement: `phhAdapter.toAppHand` skips `n === 2` outright
// (SKIP_REASONS.HEADS_UP, phhAdapter.mjs:268) — present since the original harness commit
// (WS-273, 6f8b0b8) — so a 2-seat hand never becomes an app hand and never reaches
// `decisionAccumulator`. An earlier draft of this comment, and of POKER_THEORY's §11.7
// caveat, claimed the measurements were "two-thirds heads-up contaminated". **That was
// wrong**; it read the corpus directory rather than the ingestion path.
//
// So `hu` is not merely empty — it is unreachable, and including it would make the guard
// below throw on every legitimate run. The real, surviving confound is narrower: 6-max and
// 9-max are pooled together, and they are NOT the same population.
export const TABLE_SIZE_STRATA = ['6max', '9max'];

/**
 * @param {number} dealtIn - `hand._backtest.dealtIn`
 * @returns {'6max'|'9max'|null} — `null` for 2-seat hands, which cannot reach this probe
 *   (see the HEADS-UP note above); returning null rather than 'hu' keeps them out of the
 *   guard's stratum set instead of tripping it structurally.
 */
export const tableSizeStratum = (dealtIn) => {
  if (!Number.isFinite(dealtIn)) return null;
  if (dealtIn === 2) return null;
  if (dealtIn >= 3 && dealtIn <= 6) return '6max';
  if (dealtIn >= 7) return '9max';
  return null;
};

/**
 * MANDATORY GUARD (WS-311). This repo has a live precedent (the A4 arm) where a variant
 * silently degraded to its baseline and would have been reported as a real finding. A
 * stratification is exactly that risk in a new shape: one stratum silently empty while
 * others carry data, or two strata reporting the identical discrimination number for the
 * same action, both read as "measured" when they are not. Throws rather than reports —
 * "a measurement instrument that silently degrades is worse than one that fails loudly."
 *
 * @param {Object} byActionPerStratum - { [stratum]: { [action]: summarizedStat|undefined } }
 * @param {string} label - identifies which comparison failed, for the thrown message
 */
export const assertNoStratificationDegeneracy = (byActionPerStratum, label) => {
  const strata = Object.keys(byActionPerStratum);
  const totalN = (st) => Object.values(byActionPerStratum[st] || {})
    .reduce((s, v) => s + (v?.n || 0), 0);
  const withData = strata.filter((s) => totalN(s) > 0);
  const withoutData = strata.filter((s) => totalN(s) === 0);
  if (withData.length > 0 && withoutData.length > 0) {
    throw new Error(
      `[${label}] table-size stratification collected ZERO decisions for [${withoutData.join(', ')}] `
      + `while [${withData.join(', ')}] collected data. A measurement instrument that silently `
      + 'degrades to fewer strata than it claims is worse than one that fails loudly.',
    );
  }
  const actions = new Set(strata.flatMap((s) => Object.keys(byActionPerStratum[s] || {})));
  for (const action of actions) {
    const present = strata.filter((s) => byActionPerStratum[s]?.[action]);
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const a = byActionPerStratum[present[i]][action].deltaLogVsUniform;
        const b = byActionPerStratum[present[j]][action].deltaLogVsUniform;
        if (a === b) {
          throw new Error(
            `[${label}] action "${action}" produced BIT-IDENTICAL deltaLogVsUniform (${a}) for strata `
            + `"${present[i]}" and "${present[j]}" — two genuinely different populations will not match `
            + 'to exact float equality.',
          );
        }
      }
    }
  }
};

// ─── WS-303: strength-quintile probe ─────────────────────────────────────────
//
// Where does the hand villain ACTUALLY held sit in the equity distribution of
// villain's PRE-NARROWING range on this board? Mirrors narrowByBoard's `allCombos`
// construction exactly (classifyComboFull -> computeComboEquity, same per-cell suit
// enumeration) — see postflopNarrower.js:788-824 — but restricted to the cells the
// baseline range actually holds (`baseRange[idx] > 0`), because the question here is
// about villain's OWN range, not the board-only reference population narrowByBoard's
// likelihood needs. Do not invent a different equity function.
const RQ_GRID_SIZE = 169;
const QUINTILES = ['q1', 'q2', 'q3', 'q4', 'q5'];

/**
 * Weighted percentile (0-1, midpoint-of-ties) of `hole`'s equity within the live combos
 * of `baseRange` on `board`. Returns null when the hole isn't a live combo of the range
 * on this board (dead-card collision, or the cell carries zero weight).
 */
const rangeEquityPercentile = (baseRange, board, deadCards, hole) => {
  if (!baseRange || !board || board.length < 3 || !hole) return null;
  const [c1, c2] = hole;
  const dead = new Set([...deadCards, ...board]);
  const boardRanks = board.map(cardRank).sort((a, b) => b - a);
  const street = board.length >= 5 ? 'river' : board.length >= 4 ? 'turn' : 'flop';

  let targetEquity = null;
  const combos = []; // { equity, weight }

  for (let idx = 0; idx < RQ_GRID_SIZE; idx++) {
    if (baseRange[idx] <= 0) continue;
    const { rank1, rank2, suited, isPair } = decodeIndex(idx);

    const enumSuits = isPair
      ? (() => { const out = []; for (let s1 = 0; s1 < 4; s1++) for (let s2 = s1 + 1; s2 < 4; s2++) out.push([s1, s2]); return out; })()
      : suited
        ? [[0, 0], [1, 1], [2, 2], [3, 3]]
        : (() => { const out = []; for (let s1 = 0; s1 < 4; s1++) for (let s2 = 0; s2 < 4; s2++) { if (s1 !== s2) out.push([s1, s2]); } return out; })();

    for (const [s1, s2] of enumSuits) {
      const cc1 = encodeCard(rank1, s1);
      const cc2 = encodeCard(rank2, s2);
      if (dead.has(cc1) || dead.has(cc2)) continue;

      const info = classifyComboFull(cc1, cc2, board);
      const holeRanks = [rank1, rank2].sort((a, b) => b - a);
      const equity = computeComboEquity(
        info.category, holeRanks, boardRanks, info.totalEquityOuts, street,
      );

      combos.push({ equity, weight: baseRange[idx] });
      if ((cc1 === c1 && cc2 === c2) || (cc1 === c2 && cc2 === c1)) targetEquity = equity;
    }
  }

  if (targetEquity == null || combos.length === 0) return null;
  const totalWeight = combos.reduce((s, c) => s + c.weight, 0);
  if (!(totalWeight > 0)) return null;

  let below = 0;
  let atEquity = 0;
  for (const c of combos) {
    if (c.equity < targetEquity) below += c.weight;
    else if (c.equity === targetEquity) atEquity += c.weight;
  }
  return (below + atEquity / 2) / totalWeight;
};

const quintileOf = (pct) => QUINTILES[Math.min(4, Math.max(0, Math.floor(pct * 5)))];

/**
 * Run the probe.
 *
 * @returns {Promise<Object>} nested stat summaries
 */
export const runRangeCalibrationProbe = async ({
  files, poolPct = 50, maxPlayers = Infinity, maxHandsPerPlayer = Infinity,
  tauSweep = null, floorSweep = null, supportSweep = null,
  actionTauSweep = null, depthTauSweep = null, strengthQuintiles = false,
  log = () => {},
}) => {
  const { byPlayer, handsRead } = await indexEvalPlayers({
    files, poolPct, maxPlayers, maxHandsPerPlayer,
    onProgress: ({ handsRead: h, players }) => log(`read ${h} hands, ${players} players`),
  });
  log(`indexed ${byPlayer.size} players from ${handsRead} hands`);

  const acting = { all: mkStat(), byStreet: {}, byAction: {}, byStrength: {}, bySite: {} };
  // WS-292: acting-seat calibration keyed by player, so the per-player width the follow-up
  // ticket has to fit can be READ rather than assumed. Scored on exactly the same decisions
  // as `acting.all` — it is a re-slice of that stream, not a separate arm.
  const actingByPlayer = {};
  const villain = { all: mkStat(), byStreet: {}, byAction: {} };
  const chained = { 1: mkStat(), 2: mkStat(), 3: mkStat() };
  // WS-291: sweep the logistic softness on the villain-side narrowing so the parameter
  // is chosen by measured discrimination rather than by taste.
  const tauArms = {};
  if (Array.isArray(tauSweep)) for (const t of tauSweep) tauArms[t] = mkStat();

  // WS-291: and sweep the FLOOR — the minimum P(action | combo) any holding keeps.
  //
  // The floor is the parameter that decides how much of the old defect survives. Too low
  // and an implausible holding is "impossible" in all but name, which is the hard cut
  // returning in slow motion; too high and every read is washed out toward uniform. It
  // cannot be argued to a value, only measured to one: coverage is 100% for ANY positive
  // floor, so the arm that wins is the one with the best DISCRIMINATION (Δlog of the hand
  // actually held vs uniform).
  const floorArms = {};
  if (Array.isArray(floorSweep)) for (const f of floorSweep) floorArms[f] = mkStat();

  // WS-302: and sweep the PREFLOP SUPPORT WEIGHT — how much of the population prior's
  // mass is carried by a smooth equity-ranked grid rather than by the positional chart.
  //
  // This is the residual WS-291's floor could not reach. The postflop floor guarantees
  // every combo positive weight given a preflop range that CONTAINED it; 30-37% of the
  // chart's cells were zero, and `narrowByBoard` deliberately preserves a caller's
  // exclusion, so those hands stayed impossible at every street. Same argument as the
  // floor above applies to picking lambda: coverage is 100% for ANY positive lambda, so
  // the arm that wins is the one with the best DISCRIMINATION. The cost side is real and
  // is what the sweep is actually pricing — a 1%-wide 3-bet prior spends its added
  // bottom-end mass out of its own top, so too large a lambda erodes the "a live 3-bet is
  // almost always a monster" read (POKER_THEORY 2.3).
  const supportArms = {};
  if (Array.isArray(supportSweep)) for (const s of supportSweep) supportArms[s] = mkStat();

  // per-action tau sweep — bucketed by the villain's observed action, so the discrimination
  // (strongly positive for raise/call/bet, negative for check) can be read per action rather
  // than blended into one global number.
  const actionTauArms = {};
  if (Array.isArray(actionTauSweep)) {
    for (const t of actionTauSweep) actionTauArms[t] = {};
  }

  // WS-311: table-size strata for the villain-seat baseline and, if configured, the
  // per-action tau sweep — scored on the SAME decisions as their pooled counterparts above.
  const villainByTableSize = {};
  for (const st of TABLE_SIZE_STRATA) villainByTableSize[st] = {}; // action -> stat

  const actionTauByTableSize = {};
  if (Array.isArray(actionTauSweep)) {
    for (const st of TABLE_SIZE_STRATA) {
      actionTauByTableSize[st] = {};
      for (const t of actionTauSweep) actionTauByTableSize[st][t] = {}; // action -> stat
    }
  }

  // depth-tempered chaining sweep — KAPPA=1.0 must reproduce `chained` exactly (correctness
  // check on the plumbing); other kappas temper the softness with depth.
  const depthTauArms = {};
  if (Array.isArray(depthTauSweep)) {
    for (const kappa of depthTauSweep) {
      depthTauArms[kappa] = { 1: mkStat(), 2: mkStat(), 3: mkStat() };
    }
  }

  // WS-303: strength-quintile sweep — where does the ACTUAL hand villain held sit in the
  // equity distribution of villain's PRE-NARROWING range, split by observed action?
  // Founder hypothesis under test: the check branch's U-shape discrimination deficit
  // (POKER_THEORY / postflopNarrower.js ACTION_TAU_FRACTION note) CONCENTRATES in the
  // middle quintiles — a fear-driven check with a middling made hand — rather than
  // spreading evenly or sitting at a tail. Fixed at three softness settings so the shape
  // is visible: 0.3 (sharp), 1.0 (shipped check default), 20 (narrowing effectively off,
  // the reference). tau -> action -> quintile -> stat.
  const STRENGTH_QUINTILE_TAUS = [0.3, 1.0, 20];
  const strengthQuintileArms = {};
  if (strengthQuintiles) {
    for (const t of STRENGTH_QUINTILE_TAUS) strengthQuintileArms[t] = {};
  }

  let decisions = 0;
  let revealedActing = 0;
  let revealedVillain = 0;

  // WS-293: the reveal denominator, sliced the same way the calibration numbers are. Without
  // this every figure below is a rate whose denominator nobody chose (POKER_THEORY §14).
  const sel = {
    acting: { all: mkSel(), byStreet: {}, byAction: {}, bySite: {} },
    villain: { all: mkSel(), byStreet: {}, byAction: {} },
  };

  const at = (bucket, key) => (bucket[key] || (bucket[key] = mkStat()));
  const atMap = (bucket, key) => (bucket[key] || (bucket[key] = {}));
  const atSel = (bucket, key) => (bucket[key] || (bucket[key] = mkSel()));

  // WS-293: how many players were DISCARDED, and why. `accumulateDecisions` is wrapped in a
  // catch that drops the entire remaining player, so a fault in the engine — or in a module
  // being edited concurrently — makes every player fail silently and the probe returns a
  // clean-looking result with zero decisions in it. That happened during WS-293's own
  // development and produced a Result Card whose every metric was null, which is exactly the
  // "instrument that silently degrades" failure the WS-311 stratification guard exists to
  // prevent. Counting the failures is what makes the collapse visible.
  let playersFailedProfile = 0;
  let playersFailedAccumulate = 0;
  let firstFailure = null;

  for (const [pid, hands] of byPlayer) {
    let profile;
    try { profile = buildRangeProfile(pid, hands, USER_ID); } catch (err) {
      playersFailedProfile++;
      if (!firstFailure) firstFailure = `buildRangeProfile: ${err?.message || String(err)}`;
      continue;
    }
    if (!profile) { playersFailedProfile++; continue; }

    try {
      accumulateDecisions(pid, hands, profile, USER_ID, {
        onDecision: (ctx) => {
          decisions++;
          const hand = ctx.hand;
          const sd = hand.gameState.showdownCards || {};
          const board = ctx.board;
          const site = hand._backtest?.site || '?';
          // WS-311: actual dealt-in seat count for this hand — see phhAdapter.mjs:429-430.
          const tableSize = tableSizeStratum(hand._backtest?.dealtIn);
          if (!board || board.length < 3) return;

          // ---- 1. acting seat: the range the accumulator tracks ----
          //
          // WS-292: read straight off the holding handle the accumulator now emits. This
          // block used to re-join the showdown map to `ctx.rangeBefore` itself; the
          // accumulator had both halves in the same function and never connected them, so
          // every consumer that wanted the join built its own. `holdingTruth` refuses if
          // the range carries a hypothesized narrowing, which this one never does — the
          // accumulator only ever narrows on actions the seat really took.
          const truth = ctx.holding ? holdingTruth(ctx.holding, { board }) : null;
          // WS-293: classify EVERY decision the accumulator tracked a range for, not only the
          // ones that scored. `holdingTruth` already computes all three outcomes; the probe
          // used to keep one and drop two, which is why the reveal rate — the other half of
          // every number on this page — did not exist.
          if (ctx.holding) {
            const outcome = !truth ? 'not-revealed' : (truth.refused ? 'refused' : 'revealed');
            const reason = truth?.refused ? truth.reason : null;
            pushSel(sel.acting.all, outcome, reason);
            pushSel(atSel(sel.acting.byStreet, ctx.street), outcome, reason);
            pushSel(atSel(sel.acting.byAction, ctx.action), outcome, reason);
            pushSel(atSel(sel.acting.bySite, site), outcome, reason);
          }
          if (truth && !truth.refused) {
            const hole = truth.revealed;
            const r = {
              covered: truth.covered,
              retained: truth.retainedFraction,
              p: truth.weightOfTruth,
              u: truth.uniformWeight,
            };
            revealedActing++;
            push(acting.all, r);
            push(at(acting.byStreet, ctx.street), r);
            push(at(acting.byAction, ctx.action), r);
            push(at(acting.bySite, site), r);
            const band = strengthBand(comboStrengthPercentile(hole[0], hole[1], board));
            push(at(acting.byStrength, band), r);
            // WS-292 follow-up input: per-player calibration. A player whose revealed hands
            // sit persistently near the floor of the range we inferred is telling us their
            // continuation threshold is looser than the model assumes — they arrive at the
            // river wider and weaker than modelled. Attributed to `pid`, the player whose
            // range this actually is; the villain-seat surface below is keyed by SEAT and
            // cannot be attributed this way without resolving the seat to a player.
            push(at(actingByPlayer, String(pid)), r);
          }

          // ---- 2. villain seat: the range the game tree actually consumes ----
          //
          // Reconstructed the way `gameTreeContext:219` builds it — a baseline range for
          // the villain's position, narrowed by the villain's own last action. This is
          // the range that decides what the engine recommends.
          const vSeat = ctx.opponentSeat;
          if (vSeat != null) {
            // WS-293: the villain's last action on this street is resolved BEFORE the reveal
            // check, because it is the DENOMINATOR's condition and not the numerator's —
            // without an action there is no range to narrow, so the decision was never
            // scoreable whether or not cards were shown. Resolving it only for revealed hands
            // is precisely what made the reveal rate uncomputable. The SCORED set is unchanged:
            // still exactly (vAction resolvable) ∧ (showdown cards present) ∧ (cards parse).
            let vAction = null;
            for (const e of hand.gameState.actionSequence) {
              if (e.order >= ctx.order) break;
              if (e.street !== ctx.street) continue;
              if (String(e.seat) === String(vSeat)) vAction = e.action;
            }
            if (vAction) {
              const vRaw = sd[String(vSeat)];
              const vHole = vRaw ? vRaw.map(parseAndEncode) : null;
              const vRevealed = Boolean(vHole && !vHole.some((c) => c < 0));
              // Cards present but unparseable is a DATA problem, not a showdown outcome, so it
              // is a refusal — never folded into the unrevealed mass, which would overstate the
              // selection effect, and never into the scored set, which would understate the model.
              const vOutcome = vRevealed
                ? 'revealed'
                : (vRaw ? 'refused' : 'not-revealed');
              const vReason = (!vRevealed && vRaw) ? 'unparseable-showdown-cards' : null;
              pushSel(sel.villain.all, vOutcome, vReason);
              pushSel(atSel(sel.villain.byStreet, ctx.street), vOutcome, vReason);
              pushSel(atSel(sel.villain.byAction, vAction), vOutcome, vReason);
              if (vRevealed) {
                const vPos = getRangePositionCategory(Number(vSeat), hand.gameState.dealerButtonSeat);
                const base = buildBaselineRange(null, null, vPos);
                let narrowed;
                try {
                  narrowed = narrowByBoard(base, vAction, board, []);
                } catch { narrowed = null; }
                if (narrowed) {
                  const r = scoreRange(narrowed, board, vHole);
                  if (r) {
                    revealedVillain++;
                    push(villain.all, r);
                    push(at(villain.byStreet, ctx.street), r);
                    push(at(villain.byAction, vAction), r);
                    if (tableSize) push(at(villainByTableSize[tableSize], vAction), r);
                  }
                }
                // ---- 3b. softness sweep on the same decision ----
                for (const t of Object.keys(tauArms)) {
                  try {
                    const nt = narrowByBoard(base, vAction, board, [], { tauFraction: Number(t) });
                    const r = scoreRange(nt, board, vHole);
                    if (r) push(tauArms[t], r);
                  } catch { /* skip arm */ }
                }

                // ---- 3a2. per-action softness sweep on the SAME decision ----
                // Bucketed by vAction: every arm for a given action is scored on the same
                // set of decisions as every other arm for that action (the whole point of
                // the instrument), but arms for different actions are naturally scored on
                // different decision sets, since they're keyed by the action itself.
                for (const t of Object.keys(actionTauArms)) {
                  try {
                    const nt = narrowByBoard(base, vAction, board, [], { tauFraction: Number(t) });
                    const r = scoreRange(nt, board, vHole);
                    if (r) {
                      push(at(actionTauArms[t], vAction), r);
                      if (tableSize && actionTauByTableSize[tableSize]) {
                        push(at(actionTauByTableSize[tableSize][t], vAction), r);
                      }
                    }
                  } catch { /* skip arm */ }
                }

                // ---- 3c. floor sweep on the SAME decision ----
                // Same decisions for every arm, so the arms are differenced per decision
                // rather than each being scored on its own set — the selection effect
                // exploitEngine/CLAUDE.md names for the fallback-level table.
                for (const f of Object.keys(floorArms)) {
                  try {
                    const nf = narrowByBoard(base, vAction, board, [], { continuationFloor: Number(f) });
                    const r = scoreRange(nf, board, vHole);
                    if (r) push(floorArms[f], r);
                  } catch { /* skip arm */ }
                }

                // ---- 3d. preflop support sweep on the SAME decision (WS-302) ----
                // The baseline range itself is rebuilt per arm; narrowing is left at its
                // shipped settings so this arm prices the PREFLOP change alone.
                for (const s of Object.keys(supportArms)) {
                  try {
                    const bs = buildBaselineRange(null, null, vPos, { supportLambda: Number(s) });
                    const ns = narrowByBoard(bs, vAction, board, []);
                    const r = scoreRange(ns, board, vHole);
                    if (r) push(supportArms[s], r);
                  } catch { /* skip arm */ }
                }

                // ---- 3. chaining: what gameTreeDepth2 does inside one evaluation ----
                if (narrowed) {
                  let cur = base;
                  for (let depth = 1; depth <= 3; depth++) {
                    try { cur = narrowByBoard(cur, 'call', board, []); } catch { break; }
                    const r = scoreRange(cur, board, vHole);
                    if (r) push(chained[depth], r);
                  }
                }

                // ---- 3e. depth-tempered chaining sweep on the SAME decision ----
                // At depth k (1-indexed), softness = TAU_FRACTION * kappa^(k-1). kappa=1.0
                // reproduces the `chained` block above exactly — the correctness check on
                // the plumbing.
                for (const kappa of Object.keys(depthTauArms)) {
                  const kappaNum = Number(kappa);
                  let curD = base;
                  for (let depth = 1; depth <= 3; depth++) {
                    const tauFraction = TAU_FRACTION * Math.pow(kappaNum, depth - 1);
                    try { curD = narrowByBoard(curD, 'call', board, [], { tauFraction }); } catch { break; }
                    const r = scoreRange(curD, board, vHole);
                    if (r) push(depthTauArms[kappa][depth], r);
                  }
                }

                // ---- 3f. strength-quintile sweep on the SAME decision (WS-303) ----
                // quintile is computed once per decision (it depends on the true hand and
                // the PRE-narrowing range, not on tau); every tau arm for this decision is
                // scored into the SAME quintile bucket, so arms differ only in narrowing.
                if (Object.keys(strengthQuintileArms).length) {
                  const pct = rangeEquityPercentile(base, board, [], vHole);
                  if (pct != null) {
                    const quintile = quintileOf(pct);
                    for (const t of Object.keys(strengthQuintileArms)) {
                      try {
                        const nq = narrowByBoard(base, vAction, board, [], { tauFraction: Number(t) });
                        const r = scoreRange(nq, board, vHole);
                        if (r) push(at(atMap(strengthQuintileArms[t], vAction), quintile), r);
                      } catch { /* skip arm */ }
                    }
                  }
                }
              }
            }
          }
        },
      });
    } catch (err) {
      // Semantics unchanged — the player is still skipped rather than aborting the run — but
      // the skip is now COUNTED and its first cause retained, so a run that lost every player
      // cannot be mistaken for a run that found nothing to say.
      playersFailedAccumulate++;
      if (!firstFailure) firstFailure = `accumulateDecisions: ${err?.message || String(err)}`;
    }
  }

  const mapSummary = (o) => Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, summarize(v)]).filter(([, v]) => v),
  );

  // WS-311: summarize + guard the table-size strata BEFORE returning. Guard failure throws
  // (assertNoStratificationDegeneracy above) rather than shipping a table that silently
  // degraded to fewer strata — or two strata reporting the same number — than it claims.
  const byTableSize = {};
  for (const st of TABLE_SIZE_STRATA) {
    const byAction = mapSummary(villainByTableSize[st]);
    byTableSize[st] = {
      n: Object.values(byAction).reduce((s, v) => s + v.n, 0),
      byAction,
    };
    if (Array.isArray(actionTauSweep)) {
      byTableSize[st].actionTauSweep = Object.fromEntries(
        Object.entries(actionTauByTableSize[st]).map(([t, byAct]) => [t, mapSummary(byAct)]),
      );
    }
  }

  assertNoStratificationDegeneracy(
    Object.fromEntries(TABLE_SIZE_STRATA.map((st) => [st, byTableSize[st].byAction])),
    'villain.byAction (table-size baseline)',
  );
  if (Array.isArray(actionTauSweep)) {
    for (const t of actionTauSweep) {
      assertNoStratificationDegeneracy(
        Object.fromEntries(TABLE_SIZE_STRATA.map((st) => [st, byTableSize[st].actionTauSweep[t]])),
        `actionTauSweep tau=${t} (table-size)`,
      );
    }
  }

  const mapSelection = (o) => Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, summarizeSelection(v)]).filter(([, v]) => v),
  );

  return {
    // WS-293: the showdown-selection term. Every calibration number in this result is
    // P(· | revealed); this block is the P(revealed | ·) that the factorisation needs, plus the
    // composition shift that says which slices the filter selects for. It is emitted
    // unconditionally — a selection term that only appears when someone passes a flag is a
    // caveat, and the whole point is that it is data.
    selection: {
      acting: {
        all: summarizeSelection(sel.acting.all),
        byStreet: mapSelection(sel.acting.byStreet),
        byAction: mapSelection(sel.acting.byAction),
        bySite: mapSelection(sel.acting.bySite),
        compositionByAction: selectionComposition(sel.acting.byAction),
        compositionByStreet: selectionComposition(sel.acting.byStreet),
      },
      villain: {
        all: summarizeSelection(sel.villain.all),
        byStreet: mapSelection(sel.villain.byStreet),
        byAction: mapSelection(sel.villain.byAction),
        compositionByAction: selectionComposition(sel.villain.byAction),
        compositionByStreet: selectionComposition(sel.villain.byStreet),
      },
    },
    scanned: {
      decisions,
      revealedActing,
      revealedVillain,
      players: byPlayer.size,
      handsRead,
      // WS-293: the health of the scan itself. `playersFailed` > 0 with `decisions` low means
      // the run collapsed rather than found nothing.
      playersFailedProfile,
      playersFailedAccumulate,
      firstFailure,
      // WS-311: n per table-size stratum, prominent — 9-max is the thin one.
      byTableSize: Object.fromEntries(TABLE_SIZE_STRATA.map((st) => [st, byTableSize[st].n])),
    },
    byTableSize,
    acting: {
      all: summarize(acting.all),
      byStreet: mapSummary(acting.byStreet),
      byAction: mapSummary(acting.byAction),
      byStrength: mapSummary(acting.byStrength),
      bySite: mapSummary(acting.bySite),
    },
    // WS-292: per-player calibration of the acting-seat range, worst-discriminated first.
    //
    // WHAT THIS IS FOR. `deltaLogVsUniform` near zero for a given player means the range we
    // inferred for them put no more weight on the hand they actually held than a flat range
    // over the same combos would have — our read of THAT player carries no information. The
    // founder's reading of why: they continue below the equity threshold the model assumes,
    // so an equity-shaped narrowing mis-ranks them and they reach the river wider and
    // weaker than modelled.
    //
    // WHAT IT IS NOT. This is not a fitted parameter and must not be used as one yet. n is
    // small per player (showdowns are rare), the values are noisy, and picking a per-player
    // softness off this table without a proper sweep would repeat exactly what WS-291 and
    // WS-303 had to undo — a constant chosen by taste rather than measured. `minN` keeps
    // one-showdown players out of the report; it is a display floor, not a threshold gate
    // on any estimate (§11.5 forbids those).
    actingByPlayer: Object.entries(mapSummary(actingByPlayer))
      .filter(([, v]) => v.n >= PER_PLAYER_MIN_N)
      .sort((a, b) => a[1].deltaLogVsUniform - b[1].deltaLogVsUniform)
      .map(([playerId, v]) => ({ playerId, ...v })),
    villain: {
      all: summarize(villain.all),
      byStreet: mapSummary(villain.byStreet),
      byAction: mapSummary(villain.byAction),
    },
    chained: mapSummary(chained),
    tauSweep: mapSummary(tauArms),
    floorSweep: mapSummary(floorArms),
    supportSweep: mapSummary(supportArms),
    // action -> tau -> summary (per-action optimum readable per action, per tau)
    actionTauSweep: Object.fromEntries(
      Object.entries(actionTauArms).map(([t, byAction]) => [t, mapSummary(byAction)]),
    ),
    // tau -> action -> quintile -> summary (WS-303)
    strengthQuintileSweep: Object.fromEntries(
      Object.entries(strengthQuintileArms).map(([t, byAction]) => [
        t,
        Object.fromEntries(
          Object.entries(byAction).map(([act, byQuintile]) => [act, mapSummary(byQuintile)]),
        ),
      ]),
    ),
    // kappa -> depth -> summary
    depthTauSweep: Object.fromEntries(
      Object.entries(depthTauArms).map(([kappa, byDepth]) => [kappa, mapSummary(byDepth)]),
    ),
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// WS-321 — PER-PLAYER RANGE WIDTH
// ═══════════════════════════════════════════════════════════════════════════════
//
// THE QUESTION. `ACTION_TAU_FRACTION` (WS-303) established that softness is a property of
// the ACTION. This asks whether it is ALSO a property of the PLAYER: does some player's
// raise carry less equity signal than the population's raise, so that reading it at the
// population's sharpness reads it confidently and wrongly?
//
// THE PARAMETER IS A MULTIPLIER, NOT AN OVERRIDE. Every arm here scores
// `narrowByBoard(..., { widthMultiplier: m })`, which scales `ACTION_TAU_FRACTION[action]`.
// m = 1 is the shipped engine bit-for-bit; m > 1 means this player's actions carry LESS
// equity signal. This answers the ticket's decision_flag — the width applies to every action
// but scales each one's own measured softness, so the check branch (already softened to 1.0
// because narrowing it subtracts information) is never handed the raise branch's sharpness.
//
// ─── WHY THIS RUNS ON THE ACTING SEAT ────────────────────────────────────────────────────
//
// The villain-seat arm above is keyed by SEAT and never resolved to a player — which the
// report's own admissibility block already flags as "benign today because the villain range
// is a population chart with no per-player fit — NOT benign the moment any player-conditioned
// villain model is introduced." This ticket introduces exactly that, so the fit runs on the
// ACTING seat, whose player id is known, whose partition is therefore checkable, and for whom
// `indexEvalPlayers` has already gathered every hand in the slice.
//
// The RANGE is built the villain arm's way (population baseline for the seat's position,
// narrowed once by the seat's own observed action) rather than read off the accumulator. That
// is deliberate: the accumulator's range is chained across streets with no options
// pass-through, so its arms could not differ only in `m`. Here they differ in nothing else.
//
// ─── THE SELECTION PROBLEM, WHICH IS SHARPER HERE THAN FOR THE AGGREGATE ─────────────────
//
// WS-293 measured that the showdown filter is ACTION-DEPENDENT: folds reveal at 0.0% and are
// absent from the sample entirely, against raises at ~43-46%. For an AGGREGATE that is a
// caveat on one number. For a PER-PLAYER fit it is a confound with a per-player magnitude:
// every player's revealed set is drawn entirely from the branches they did not fold, so a
// player who folds a lot reveals a smaller and differently-composed slice of their range than
// one who does not. An apparent "no equity signal" can therefore be a statement about how
// much of that player's range is observable rather than about the player.
//
// Three things follow, and all three are emitted as DATA rather than written as prose:
//
//   1. NO WIDTH TRAVELS WITHOUT ITS n, ITS REVEAL RATE, AND ITS REVEALED ACTION MIX. Every
//      per-player row carries `nTrain`, `nTest`, `revealRate`, `scoreable` and
//      `revealedActionMix`. A row whose revealed mix is 90% one action has a width that is
//      mostly a statement about that action's branch, and the row says so.
//
//   2. "NO SIGNAL" AND "TOO FEW REVEALED TO TELL" ARE SEPARATE CATEGORIES. Collapsing the
//      observed-zero into the never-looked is a named failure shape in this repo, and §11.8
//      is the precedent: `P(check | strong)` returned chi2/df = 1.005 at a MEDIAN OF 2
//      observations per player, which is a weak-power null and not proof of absence.
//      `classifyPlayerSignal` separates them by POWER — see its docblock.
//
//   3. A PLAYER WE CANNOT RESOLVE IS SAID TO BE UNRESOLVED — but is NOT gated out.
//      `classification` travels ON the row, beside the width, with the standard error and
//      the minimum detectable effect that produced it. It does not null the width, and that
//      is deliberate rather than a shortfall: dropping the per-player value for players below
//      some resolution is `if (n >= K) use the specific estimate`, the threshold gate §11.4
//      and §11.5 forbid and the ticket forbids by name. The continuous shrinkage already does
//      the right thing for exactly these players — their n is small, so n/(n+k) is small, and
//      they sit near the population value without anyone deciding a cutoff. What the
//      classification adds is that a reader can see WHICH rows are near population because
//      their evidence agreed with it and which are near it because their evidence said
//      nothing. Only a player with NO revealed decision in their fitting half has a genuinely
//      null width, and that is an absence of data rather than a judgement about them.
//
// ─── LEAKAGE, STRUCTURALLY ───────────────────────────────────────────────────────────────
//
// A per-player quantity fitted from the corpus and scored on the corpus leaks two ways, and
// closing one does not close the other (leakageGuard.mjs states the general form):
//
//   POOL/EVAL   the POPULATION width — the value every per-player estimate shrinks toward —
//               is computed from POOL players ONLY. EVAL players never contribute to the
//               value they are then shrunk toward. Without this the shrinkage target
//               contains its own targets and every player looks closer to population than
//               they are.
//   WALK-FORWARD  within an EVAL player, the width is fitted on a strict PREFIX of that
//               player's hands and scored on the SUFFIX. A width fitted on a player's later
//               hands and scored on their earlier ones is an ordering that never occurs at
//               the table.
//   k SELECTION  the shrinkage constant is itself chosen by measurement, so it too can
//               overfit. EVAL players are split again into CALIB (where k is chosen) and
//               HELDOUT (where the reported number is produced). The headline never sees
//               the players that picked k.
//
// The prefix ordering is by `handId`, not by corpus read order. HandHQ hand ids are the
// site's sequential counter and their ranges are disjoint and increasing across files, but
// the harness reads files in LEXICOGRAPHIC name order (1, 10, 100, 1000, ...), so bucket
// order is scrambled in time. `orderHandsByTime` fixes that before accumulation, which makes
// the walk-forward split an actual walk forward.

/**
 * Width multipliers on `ACTION_TAU_FRACTION[action]`. Log-spaced (ratio 2) so a posterior in
 * log-width is uniform on the grid, and so the top of the grid is genuinely "narrowing off"
 * — at m = 32 the logistic is flat across the score range and the narrowed range is the
 * baseline prior, which is the reference every "does this action carry signal" contrast needs.
 *
 * 1.0 must be ON the grid and is the population/shipped point.
 */
export const WIDTH_GRID = Object.freeze([0.25, 0.5, 1, 2, 4, 8, 16, 32]);

/** Shrinkage constants swept for k. `Infinity` is the pure-population control arm. */
export const K_GRID = Object.freeze([0, 2, 5, 10, 20, 40, 80, 160, Infinity]);

/** 95% two-sided normal quantile — the large-sample limit of the table below. */
const Z95 = 1.959963985;

/**
 * Two-sided 95% Student-t quantile by degrees of freedom.
 *
 * NOT decoration, and not available from the normal quantile. The median player in this
 * measurement has SINGLE-DIGIT revealed decisions (§11.8 measured a median of 2 on a
 * neighbouring axis), and at df = 2 the correct multiplier is 4.303 against the normal's
 * 1.960 — a 2.2x wider interval. Using z there would call a player's noise a finding, and it
 * would do so hardest exactly where the data is thinnest, which is the opposite of what a
 * power-based classifier is for. It also runs the other way: a wider interval makes `mde`
 * larger, so more players land in `underpowered` and fewer get a width nobody should believe.
 *
 * Tabulated to df = 30 and stepped thereafter; the residual error above 30 is under 0.05 and
 * is in the conservative direction.
 */
const T95 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
  2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086,
  2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042,
];
export const tQuantile95 = (df) => {
  if (!Number.isFinite(df) || df < 1) return Number.POSITIVE_INFINITY;
  if (df <= 30) return T95[df - 1];
  if (df <= 60) return 2.00;
  if (df <= 120) return 1.98;
  return Z95;
};

/**
 * Order a player's hands in TIME.
 *
 * `handId` is the site's sequential hand counter; verified disjoint and increasing across
 * corpus files (file 1 spans 26262271344-26262536748, file 1000 spans 26692884256-...).
 * Read order is lexicographic by filename, which interleaves those ranges, so sorting here is
 * what turns `handIdx` into a temporal index and the walk-forward split into a real one.
 *
 * Site is the primary key because hand ids from different sites are not comparable; hands
 * with no id sort last and are counted by the caller rather than silently interleaved.
 */
export const orderHandsByTime = (hands) => [...hands].sort((a, b) => {
  const sa = a?._backtest?.site ?? '';
  const sb = b?._backtest?.site ?? '';
  if (sa !== sb) return sa < sb ? -1 : 1;
  const ia = Number.isFinite(a?.handId) ? a.handId : Number.POSITIVE_INFINITY;
  const ib = Number.isFinite(b?.handId) ? b.handId : Number.POSITIVE_INFINITY;
  return ia - ib;
});

/**
 * Per-arm accumulator over one decision set.
 *
 * `sumLogLift[g]` is the sum of (log P(true holding | arm g) - log uniform) — the published
 * Delta-log scale. `sumD[g]` / `sumD2[g]` are the PAIRED difference against a fixed reference
 * arm, and they are the reason this is not just a bag of means: every arm sees the SAME
 * decisions, so the per-decision difference has far smaller variance than the difference of
 * two independent means, and it is the paired SE that decides whether a player's evidence can
 * resolve anything at all. Differencing also cancels `log uniform` exactly, so the contrast is
 * free of the baseline.
 */
export const mkWidthStat = (G = WIDTH_GRID.length) => ({
  n: 0,
  sumLogLift: new Float64Array(G),
  sumD: new Float64Array(G),
  sumD2: new Float64Array(G),
});

/**
 * Record one decision.
 * @param {Object} s - a `mkWidthStat()`
 * @param {number[]} logLift - per-arm (log p - log u) for this one decision
 * @param {number} refIdx - grid index the paired differences are taken against
 */
export const pushWidth = (s, logLift, refIdx) => {
  const ref = logLift[refIdx];
  s.n++;
  for (let g = 0; g < logLift.length; g++) {
    s.sumLogLift[g] += logLift[g];
    const d = logLift[g] - ref;
    s.sumD[g] += d;
    s.sumD2[g] += d * d;
  }
};

/**
 * Mean Delta-log per arm, plus the paired contrast against the reference arm with its SE.
 *
 * `se[g]` is the standard error of the MEAN paired difference — sd/sqrt(n) with the n-1
 * denominator. `null` at n < 2, because a standard error over one observation is not 0.
 */
export const summarizeWidth = (s) => {
  if (!s || !s.n) return null;
  const G = s.sumLogLift.length;
  const deltaLog = [];
  const meanD = [];
  const se = [];
  for (let g = 0; g < G; g++) {
    deltaLog.push(s.sumLogLift[g] / s.n);
    const m = s.sumD[g] / s.n;
    meanD.push(m);
    if (s.n < 2) { se.push(null); continue; }
    const varD = Math.max(0, (s.sumD2[g] - s.n * m * m) / (s.n - 1));
    se.push(Math.sqrt(varD / s.n));
  }
  return { n: s.n, deltaLog, meanD, se };
};

/**
 * Parabolic-interpolated argmax over a log-spaced grid.
 *
 * The grid is coarse (ratio 2) and the curve is smooth in log-width, so taking the bare
 * argmax would quantise every estimate onto eight points and make the shrinkage below
 * invisible for any player whose evidence is worth less than a full grid step. Fitting a
 * parabola through the argmax and its two neighbours recovers a continuous value at no cost
 * in assumptions the grid does not already make.
 *
 * Clamped to the grid: an interior optimum is interpolated, an edge optimum is reported AT
 * the edge rather than extrapolated to a width nothing was measured at.
 *
 * @param {number[]} logGrid - log of each multiplier, ascending
 * @param {number[]} values - the curve, one per grid point (higher is better)
 * @returns {{logWidth: number, argmaxIdx: number, interpolated: boolean}|null}
 */
export const interpolatedArgmax = (logGrid, values) => {
  if (!Array.isArray(values) || values.length !== logGrid.length || values.length === 0) return null;
  let best = 0;
  for (let g = 1; g < values.length; g++) if (values[g] > values[best]) best = g;
  if (best === 0 || best === values.length - 1) {
    return { logWidth: logGrid[best], argmaxIdx: best, interpolated: false };
  }
  const y0 = values[best - 1];
  const y1 = values[best];
  const y2 = values[best + 1];
  const denom = y0 - 2 * y1 + y2;
  // A flat or non-concave triple has no interior vertex to find; fall back to the grid point
  // rather than dividing by ~0 and inventing a width off the end of the world.
  if (!(denom < -1e-12)) return { logWidth: logGrid[best], argmaxIdx: best, interpolated: false };
  const step = 0.5 * (y0 - y2) / denom;
  const clamped = Math.max(-1, Math.min(1, step));
  const h = logGrid[best + 1] - logGrid[best];
  return { logWidth: logGrid[best] + clamped * h, argmaxIdx: best, interpolated: true };
};

/**
 * Shrink a per-player log-width toward the population log-width by observation count.
 *
 * `w = n / (n + k)` — §11.5's construction, and deliberately NOT a threshold gate. At n = 0
 * the estimate IS the population value; it moves off it continuously as evidence arrives and
 * there is no sample size at which a per-player value abruptly switches on. `k = Infinity`
 * is the pure-population control and `k = 0` the unshrunk per-player fit; both are arms in
 * the same sweep rather than positions in an argument.
 */
export const shrinkLogWidth = ({ rawLogWidth, populationLogWidth, n, k }) => {
  if (!Number.isFinite(rawLogWidth)) return { logWidth: populationLogWidth, weight: 0 };
  if (!Number.isFinite(k)) return { logWidth: populationLogWidth, weight: 0 };
  const weight = (n + k) > 0 ? n / (n + k) : 0;
  return { logWidth: populationLogWidth + weight * (rawLogWidth - populationLogWidth), weight };
};

/**
 * Separate "this player's actions carry no equity signal" from "we have too few revealed
 * hands to tell". These are the observed-zero and the never-looked, and collapsing them is
 * the failure this classifier exists to prevent.
 *
 * THE CONTRAST. `signal` = Delta-log at the population width minus Delta-log at the widest
 * grid arm (narrowing effectively off). Positive means narrowing this player's actions buys
 * something; zero means their actions tell us nothing an unnarrowed prior did not already
 * say; negative means the equity-shaped read is worse than no read — the founder's mechanism,
 * a player who continues below the threshold the model assumes.
 *
 * THE SEPARATOR IS POWER, NOT SAMPLE SIZE. There is no minimum-n gate here (§11.4 forbids
 * one, and a gate would also be the wrong instrument: what matters is not how many decisions
 * a player has but how tightly those decisions pin the contrast, which depends on their
 * variance too). `mde = z * se` is the smallest effect this player's own evidence could have
 * resolved. Compare it to the effect the POPULATION shows:
 *
 *   mde <= populationSignal  ->  a population-sized effect WOULD have been visible here.
 *                                A null is then an observed zero and means something.
 *   mde >  populationSignal  ->  it would NOT have been visible. The null is a statement
 *                                about the instrument, the player gets NO width, and we say so.
 *
 * This is §11.8's own reasoning applied per player instead of per axis: what predicts whether
 * an axis separates is observations per player, not whether the trait is real.
 *
 * @returns {{class: string, signal: number, se: number|null, mde: number|null,
 *            resolvable: boolean|null, reason: string}}
 */
export const classifyPlayerSignal = ({ signal, se, n = null, populationSignal, z = null }) => {
  // The multiplier is the SMALL-SAMPLE one whenever the caller supplies n, which every real
  // caller does. `z` stays overridable so a test can pin the large-sample behaviour explicitly
  // rather than having to fabricate an n large enough to reach it.
  const zz = Number.isFinite(z) ? z : (Number.isFinite(n) ? tQuantile95(n - 1) : Z95);
  if (!Number.isFinite(signal) || !Number.isFinite(se) || se <= 0 || !Number.isFinite(zz)) {
    return {
      class: 'underpowered', signal: Number.isFinite(signal) ? signal : null, se: null, mde: null,
      resolvable: null,
      reason: 'fewer than 2 revealed decisions — no paired standard error exists, so nothing '
        + 'can be said about this player in either direction',
    };
  }
  const mde = zz * se;
  const resolvable = Number.isFinite(populationSignal) ? mde <= Math.abs(populationSignal) : null;
  if (signal - mde > 0) {
    return {
      class: 'signal', signal, se, mde, resolvable,
      reason: 'narrowing at the population width beats not narrowing by more than this '
        + "player's own noise — their actions carry equity signal",
    };
  }
  if (signal + mde < 0) {
    return {
      class: 'negative-signal', signal, se, mde, resolvable,
      reason: 'narrowing at the population width is measurably WORSE than not narrowing — '
        + 'this player continues below the equity threshold the model assumes',
    };
  }
  if (resolvable === true) {
    return {
      class: 'no-signal', signal, se, mde, resolvable,
      reason: 'indistinguishable from zero AND this player has enough resolution that a '
        + 'population-sized effect would have shown — an OBSERVED zero',
    };
  }
  return {
    class: 'underpowered', signal, se, mde, resolvable,
    reason: 'indistinguishable from zero, but a population-sized effect would ALSO have been '
      + 'indistinguishable from zero at this resolution — we did not look hard enough to say',
  };
};

/**
 * Revealed-vs-scoreable action composition for ONE player (WS-293's inverse conditional,
 * per player rather than per corpus).
 *
 * `selectionRatio > 1` means the showdown filter selects FOR that action in this player's
 * sample, so the player's fitted width is disproportionately a statement about that branch.
 * The fold row is the one to read: it is 0 for everyone, by construction, and it is why the
 * revealed set can never be a sample of the whole range.
 */
export const playerActionComposition = (revealedByAction, scoreableByAction) => {
  const acts = new Set([
    ...Object.keys(revealedByAction || {}), ...Object.keys(scoreableByAction || {}),
  ]);
  const totR = Object.values(revealedByAction || {}).reduce((s, v) => s + v, 0);
  const totS = Object.values(scoreableByAction || {}).reduce((s, v) => s + v, 0);
  const out = {};
  for (const a of acts) {
    const r = revealedByAction?.[a] || 0;
    const s = scoreableByAction?.[a] || 0;
    out[a] = {
      revealed: r,
      scoreable: s,
      shareOfRevealed: totR > 0 ? r / totR : null,
      shareOfScoreable: totS > 0 ? s / totS : null,
      revealRate: s > 0 ? r / s : null,
      selectionRatio: (totR > 0 && totS > 0 && s > 0) ? (r / totR) / (s / totS) : null,
    };
  }
  return out;
};

/**
 * The distribution of RAW (unshrunk) per-player widths, with the evidence behind each.
 *
 * `edgePinned` is the diagnostic that matters most. An argmax on a thin, flat curve does not
 * land near the truth — it lands at whichever end of the grid noise happened to favour, and it
 * lands there with total confidence. A large edge-pinned share is therefore the signature of
 * a fit that has nothing to fit, and it is what a shrinkage constant chosen by measurement
 * will react to. Reporting the width histogram WITHOUT it would show a plausible spread of
 * player-specific values and invite exactly the reading the data does not support.
 *
 * `noEstimate` counts players whose TRAIN half revealed nothing at all. They are not dropped
 * and they are not defaulted to a number: they stay at the population value, which is what a
 * shrinkage weight of n/(n+k) = 0 already does, and they are counted here so the denominator
 * of every other row is legible.
 */
export const widthDistribution = (perPlayer, grid) => {
  const lo = Math.min(...grid);
  const hi = Math.max(...grid);
  const rows = [];
  let noEstimate = 0;
  for (const pl of perPlayer) {
    if (!pl.trainArgmax || !(pl.train?.n > 0)) { noEstimate++; continue; }
    rows.push({ width: Math.exp(pl.trainArgmax.logWidth), nTrain: pl.train.n });
  }
  rows.sort((a, b) => a.width - b.width);
  const edgePinned = rows.filter((r) => r.width <= lo * 1.05 || r.width >= hi * 0.95).length;
  const q = (f) => (rows.length ? rows[Math.min(rows.length - 1, Math.floor(f * rows.length))] : null);
  return {
    withEstimate: rows.length,
    noEstimate,
    edgePinned,
    edgePinnedShare: rows.length ? edgePinned / rows.length : null,
    quantiles: {
      min: q(0), p25: q(0.25), median: q(0.5), p75: q(0.75), max: q(0.999),
    },
    // The population value is 1.0; how many players' own evidence points each way at all.
    below1: rows.filter((r) => r.width < 1).length,
    above1: rows.filter((r) => r.width > 1).length,
  };
};

/**
 * Deterministic second split of the EVAL players, so the shrinkage constant k is chosen on
 * one set of players and the reported number produced on a disjoint one.
 *
 * Same FNV-1a as `partition.mjs` with a salt, so it is reproducible across runs and machines
 * without storing anything, and independent of the POOL/EVAL assignment.
 */
export const evalSubgroup = (playerId, calibPct = 50) =>
  ((fnv1a32(`${playerId}|ws321-k`) % 100) < calibPct ? 'calib' : 'heldout');

/**
 * Fit every player's width and score it, at ONE value of k.
 *
 * Scoring is PAIRED and DIRECTLY MEASURED, never interpolated: the shrunk log-width is
 * snapped to the nearest grid point and the player's TEST curve is read AT that point, where
 * an arm was actually run. `meanD` is already the per-decision difference against the
 * population arm on the SAME decisions, which is what §11.5 requires of any comparison
 * between two methods — score both on the same decisions and difference them per decision.
 *
 * The continuous (unsnapped) width is reported alongside, because that is the estimate that
 * would ship; the snapped one is the estimate that was measured. Reporting one without the
 * other would either overstate the precision of the evidence or understate the estimator.
 *
 * @returns {{k, players: Array, totalTestN: number, sumWeightedDiff: number,
 *            meanDiffPerDecision: number|null}}
 */
export const fitWidthsAtK = ({ perPlayer, populationLogWidth, logGrid, k }) => {
  const players = [];
  let totalTestN = 0;
  let sumWeightedDiff = 0;
  for (const p of perPlayer) {
    const raw = p.trainArgmax;
    const nTrain = p.train?.n || 0;
    const { logWidth, weight } = shrinkLogWidth({
      rawLogWidth: raw?.logWidth, populationLogWidth, n: nTrain, k,
    });
    // Nearest grid point in LOG space — the grid is log-spaced, so nearest-in-log is nearest
    // in the parameterisation the sweep actually explored.
    let snapped = 0;
    for (let g = 1; g < logGrid.length; g++) {
      if (Math.abs(logGrid[g] - logWidth) < Math.abs(logGrid[snapped] - logWidth)) snapped = g;
    }
    const testN = p.test?.n || 0;
    // meanD is measured against the population grid index, so this is exactly
    // "per-player width minus population width", per decision, on this player's TEST set.
    const diff = testN > 0 ? p.test.meanD[snapped] : null;
    if (testN > 0 && Number.isFinite(diff)) {
      totalTestN += testN;
      sumWeightedDiff += diff * testN;
    }
    players.push({
      playerId: p.playerId,
      subgroup: p.subgroup,
      nTrain,
      nTest: testN,
      shrinkWeight: weight,
      rawWidth: raw ? Math.exp(raw.logWidth) : null,
      fittedWidth: Math.exp(logWidth),
      snappedWidth: Math.exp(logGrid[snapped]),
      snappedIdx: snapped,
      testDiffVsPopulation: diff,
    });
  }
  return {
    k,
    players,
    totalTestN,
    sumWeightedDiff,
    meanDiffPerDecision: totalTestN > 0 ? sumWeightedDiff / totalTestN : null,
  };
};

/**
 * Scan ONE partition group, accumulating width-sweep statistics.
 *
 * Every arm is scored on the SAME decisions by construction: the arms are an inner loop over
 * one decision, not separate passes. That is the §11.5 requirement for comparing two methods,
 * and it is also what makes the paired standard errors legitimate.
 *
 * @returns {{pooled, byPlayer: Map, scanned}}
 */
const scanWidthGroup = async ({
  files, poolPct, maxPlayers, maxHandsPerPlayer, group, widthGrid, popIdx, trainFrac, log,
}) => {
  const { byPlayer, handsRead } = await indexEvalPlayers({
    files, poolPct, maxPlayers, maxHandsPerPlayer, group,
    onProgress: ({ handsRead: h, players }) => log(`[${group}] read ${h} hands, ${players} players`),
  });
  log(`[${group}] indexed ${byPlayer.size} players from ${handsRead} hands`);

  const G = widthGrid.length;
  const pooled = mkWidthStat(G);
  const players = new Map();

  // `buildBaselineRange` is deterministic in the position category and is called once per
  // decision otherwise — five distinct ranges across the whole corpus. Caching it is the
  // difference between a run that finishes and one that does not, and it cannot change a
  // number: `narrowByBoard` never mutates its input range.
  const baseByPos = new Map();
  const baseFor = (pos) => {
    if (!baseByPos.has(pos)) baseByPos.set(pos, buildBaselineRange(null, null, pos));
    return baseByPos.get(pos);
  };

  let decisions = 0;
  let revealed = 0;
  let skippedFold = 0;
  let handsWithoutId = 0;
  let playersFailed = 0;
  let firstFailure = null;

  for (const [pid, rawHands] of byPlayer) {
    // TEMPORAL ORDER, before anything reads an index. See `orderHandsByTime`.
    const hands = orderHandsByTime(rawHands);
    handsWithoutId += hands.filter((h) => !Number.isFinite(h?.handId)).length;
    // The walk-forward boundary, in HANDS so a hand never straddles it. A player with one
    // hand contributes only TRAIN, which is correct — there is nothing of theirs to score.
    const splitIdx = Math.max(1, Math.floor(trainFrac * hands.length));

    let profile;
    try { profile = buildRangeProfile(pid, hands, USER_ID); } catch (err) {
      playersFailed++;
      if (!firstFailure) firstFailure = `buildRangeProfile: ${err?.message || String(err)}`;
      continue;
    }
    if (!profile) { playersFailed++; continue; }

    const rec = {
      playerId: pid,
      hands: hands.length,
      train: mkWidthStat(G),
      test: mkWidthStat(G),
      all: mkWidthStat(G),
      // Selection accounting, per player, at the same grain WS-293 reports it per corpus.
      scoreable: 0,
      revealed: 0,
      refused: 0,
      revealedByAction: {},
      scoreableByAction: {},
    };
    players.set(pid, rec);

    try {
      accumulateDecisions(pid, hands, profile, USER_ID, {
        onDecision: (ctx) => {
          decisions++;
          const board = ctx.board;
          if (!board || board.length < 3) return;
          const action = ctx.action;
          // `narrowByBoard` returns an all-zero range for a fold and the input unchanged for
          // an unrecognised action; neither is a width measurement. Folds are also the branch
          // that reveals at 0.0%, so this skip removes nothing that was ever going to score
          // — but it is counted rather than silent, because that 0.0% is the whole selection
          // story and a reader must see it was structural and not an accident of this loop.
          if (!['raise', 'call', 'check', 'bet'].includes(action)) { skippedFold++; return; }

          const truth = ctx.holding ? holdingTruth(ctx.holding, { board }) : null;
          if (!ctx.holding) return;
          const refused = Boolean(truth?.refused);
          if (refused) { rec.refused++; return; }

          rec.scoreable++;
          rec.scoreableByAction[action] = (rec.scoreableByAction[action] || 0) + 1;
          if (!truth) return; // scoreable, not revealed — the denominator's other half

          const hole = truth.revealed;
          const pos = getRangePositionCategory(Number(ctx.playerSeat), ctx.buttonSeat);
          const base = baseFor(pos);

          const logLift = new Array(widthGrid.length);
          for (let g = 0; g < widthGrid.length; g++) {
            let narrowed;
            try {
              narrowed = narrowByBoard(base, action, board, [], { widthMultiplier: widthGrid[g] });
            } catch { return; }
            const s = scoreCoverage(narrowed, board, hole, []);
            if (!s) return;
            logLift[g] = Math.log(Math.max(s.weightOfTruth, 1e-9)) - Math.log(s.uniformWeight);
          }

          revealed++;
          rec.revealed++;
          rec.revealedByAction[action] = (rec.revealedByAction[action] || 0) + 1;
          pushWidth(pooled, logLift, popIdx);
          pushWidth(rec.all, logLift, popIdx);
          pushWidth(ctx.handIdx < splitIdx ? rec.train : rec.test, logLift, popIdx);
        },
      });
    } catch (err) {
      playersFailed++;
      if (!firstFailure) firstFailure = `accumulateDecisions: ${err?.message || String(err)}`;
    }
  }

  return {
    pooled,
    byPlayer: players,
    scanned: {
      group, handsRead, players: byPlayer.size, decisions, revealed,
      skippedNonNarrowingAction: skippedFold, handsWithoutId, playersFailed, firstFailure,
    },
  };
};

/**
 * Fit a PER-PLAYER range width and score it out of sample (WS-321).
 *
 * Runs TWO corpus passes, and they are not interchangeable:
 *   POOL pass  builds the population width every per-player estimate shrinks toward. These
 *              players are never scored.
 *   EVAL pass  fits each player's width on a temporal PREFIX of their own hands and scores
 *              it on the SUFFIX, against the population width, on the same decisions.
 *
 * A third split inside EVAL — CALIB / HELDOUT — keeps the shrinkage constant k from being
 * chosen on the players the headline is then reported over.
 */
export const runPerPlayerWidthProbe = async ({
  files, poolPct = 50, maxPlayers = Infinity, maxHandsPerPlayer = Infinity,
  widthGrid = WIDTH_GRID, kGrid = K_GRID, trainFrac = 0.5, calibPct = 50,
  log = () => {},
}) => {
  const grid = [...widthGrid];
  const logGrid = grid.map(Math.log);
  const popIdx = grid.indexOf(1);
  const offIdx = grid.length - 1;
  if (popIdx < 0) {
    throw new Error(
      'runPerPlayerWidthProbe: 1.0 must be ON the width grid. It is the shipped engine and '
      + 'the reference every paired contrast is taken against; without it there is no control.',
    );
  }

  const started = Date.now();
  const pool = await scanWidthGroup({
    files, poolPct, maxPlayers, maxHandsPerPlayer, group: GROUPS.POOL,
    widthGrid: grid, popIdx, trainFrac, log,
  });
  const evalScan = await scanWidthGroup({
    files, poolPct, maxPlayers, maxHandsPerPlayer, group: GROUPS.EVAL,
    widthGrid: grid, popIdx, trainFrac, log,
  });

  const populationCurve = summarizeWidth(pool.pooled);
  if (!populationCurve) {
    throw new Error(
      'runPerPlayerWidthProbe: the POOL pass scored ZERO revealed decisions, so there is no '
      + 'population width to shrink toward. Refusing to emit per-player widths that would '
      + 'silently be unshrunk. (A collapsed pass is the WS-293 all-null-card failure.)',
    );
  }
  const populationArgmax = interpolatedArgmax(logGrid, populationCurve.deltaLog);
  const populationLogWidth = populationArgmax.logWidth;
  // How much narrowing at the population width is worth AT ALL, on POOL players: the yardstick
  // every per-player power statement is made against.
  const populationSignal = populationCurve.deltaLog[popIdx] - populationCurve.deltaLog[offIdx];

  // ── per-player rows ────────────────────────────────────────────────────────────────────
  const perPlayer = [];
  for (const [pid, rec] of evalScan.byPlayer) {
    if (!rec.all.n) continue;
    const train = summarizeWidth(rec.train);
    const test = summarizeWidth(rec.test);
    const all = summarizeWidth(rec.all);
    const signal = -all.meanD[offIdx]; // meanD is (arm - population); negate to get pop - off
    const classification = classifyPlayerSignal({
      signal, se: all.se[offIdx], n: all.n, populationSignal,
    });
    perPlayer.push({
      playerId: pid,
      subgroup: evalSubgroup(pid, calibPct),
      hands: rec.hands,
      train, test, all,
      trainArgmax: train ? interpolatedArgmax(logGrid, train.deltaLog) : null,
      // NUMBERS CARRY THEIR CONDITIONAL. n is revealed decisions; `scoreable` is the
      // denominator it is conditional on; `revealRate` is the k/n of the showdown filter for
      // THIS player; `revealedActionMix` is the inverse conditional that says which branch
      // the width is really about.
      scoreable: rec.scoreable,
      revealed: rec.revealed,
      refused: rec.refused,
      revealRate: rec.scoreable > 0 ? rec.revealed / rec.scoreable : null,
      revealedActionMix: playerActionComposition(rec.revealedByAction, rec.scoreableByAction),
      classification,
    });
  }

  // ── choose k on CALIB players only ─────────────────────────────────────────────────────
  const calib = perPlayer.filter((p) => p.subgroup === 'calib');
  const heldout = perPlayer.filter((p) => p.subgroup === 'heldout');
  const kCurve = kGrid.map((k) => {
    const fit = fitWidthsAtK({ perPlayer: calib, populationLogWidth, logGrid, k });
    return { k, meanDiffPerDecision: fit.meanDiffPerDecision, testN: fit.totalTestN };
  });
  // Argmax over k, with ties broken toward MORE shrinkage. The tie is not hypothetical: once
  // k is large enough that no player's estimate moves a full grid step, every larger k gives
  // the identical (zero) difference, and picking the smallest of those would report a finite
  // "measured" k for a channel the measurement had actually switched off. Preferring the
  // largest says what happened.
  let bestK = null;
  for (const row of kCurve) {
    if (row.meanDiffPerDecision == null) continue;
    if (!bestK
      || row.meanDiffPerDecision > bestK.meanDiffPerDecision
      || (row.meanDiffPerDecision === bestK.meanDiffPerDecision && row.k > bestK.k)) bestK = row;
  }

  // ── report on HELDOUT players at that k, plus the pure-population control ──────────────
  // Clustered standard error, players as clusters — the same cluster unit the Result Card
  // declares. Per-player TEST diffs are independent across players; decisions within a player
  // are not, which is exactly what clustering handles and what an unclustered SE would
  // understate by treating one player's 30 correlated decisions as 30 independent ones.
  const byId = new Map(heldout.map((p) => [p.playerId, p]));
  const clusteredSe = (fit) => {
    let varNum = 0;
    for (const row of fit.players) {
      const p = byId.get(row.playerId);
      const se = p?.test?.se?.[row.snappedIdx];
      if (row.nTest > 0 && Number.isFinite(se)) varNum += (row.nTest * se) ** 2;
    }
    return fit.totalTestN > 0 ? Math.sqrt(varNum) / fit.totalTestN : null;
  };

  const heldoutFit = fitWidthsAtK({
    perPlayer: heldout, populationLogWidth, logGrid, k: bestK ? bestK.k : Infinity,
  });
  const controlFit = fitWidthsAtK({
    perPlayer: heldout, populationLogWidth, logGrid, k: Infinity,
  });
  // THE UNSHRUNK ARM, AND WHY IT IS REPORTED SEPARATELY. If k is selected at Infinity, every
  // player snaps back to the population value and the headline difference is exactly 0 — a
  // true statement about the fitted estimator that says nothing about the QUESTION. The k = 0
  // arm is the maximal per-player fit: each player's own argmax, unshrunk, scored on hands it
  // never saw. That is the number that answers "does per-player width beat population width",
  // and reporting only the shrunk one would hide a measured loss behind a shrinkage constant
  // that had already decided to ignore it.
  const unshrunkFit = fitWidthsAtK({
    perPlayer: heldout, populationLogWidth, logGrid, k: 0,
  });
  const headlineSe = clusteredSe(heldoutFit);

  const classCounts = {};
  for (const p of perPlayer) {
    classCounts[p.classification.class] = (classCounts[p.classification.class] || 0) + 1;
  }
  const movedOffPopulation = heldoutFit.players.filter((r) => r.snappedIdx !== popIdx).length;

  return {
    config: {
      widthGrid: grid, kGrid: [...kGrid], trainFrac, poolPct, calibPct,
      populationArmIdx: popIdx, narrowingOffArmIdx: offIdx,
    },
    scanned: {
      pool: pool.scanned,
      eval: evalScan.scanned,
      runtimeMs: Date.now() - started,
    },
    population: {
      n: populationCurve.n,
      deltaLogByWidth: Object.fromEntries(grid.map((m, g) => [m, populationCurve.deltaLog[g]])),
      argmaxWidth: Math.exp(populationLogWidth),
      argmaxInterpolated: populationArgmax.interpolated,
      // What narrowing at the population width buys over not narrowing, on POOL players.
      signal: populationSignal,
      signalSe: populationCurve.se[offIdx],
    },
    perPlayer: perPlayer
      .slice()
      .sort((a, b) => (a.classification.signal ?? 0) - (b.classification.signal ?? 0)),
    classCounts,
    widthDistribution: widthDistribution(perPlayer, grid),
    kCurve,
    chosenK: bestK ? bestK.k : null,
    heldout: {
      players: heldoutFit.players.length,
      playersScored: heldoutFit.players.filter((r) => r.nTest > 0).length,
      movedOffPopulation,
      testDecisions: heldoutFit.totalTestN,
      // THE HEADLINE, on ONE scale: nats per decision of the per-player width over the
      // population width, paired on the same decisions.
      meanDiffPerDecision: heldoutFit.meanDiffPerDecision,
      se: headlineSe,
      controlMeanDiffPerDecision: controlFit.meanDiffPerDecision,
      // The maximal per-player arm on the same held-out decisions. See the note above.
      unshrunk: {
        meanDiffPerDecision: unshrunkFit.meanDiffPerDecision,
        se: clusteredSe(unshrunkFit),
        movedOffPopulation: unshrunkFit.players.filter((r) => r.snappedIdx !== popIdx).length,
        testDecisions: unshrunkFit.totalTestN,
      },
    },
  };
};

/**
 * Which of the three the run supports. Kept next to the estimator so a reader who reaches the
 * width parameter in `postflopNarrower.js` has one place to look for what was measured.
 */
export const PER_PLAYER_WIDTH_VERDICTS = Object.freeze({
  BEATS: 'per-player width beats the population width out of sample',
  NULL: 'per-player width does NOT beat the population width out of sample',
  UNRESOLVED: 'the run cannot separate the two — the interval spans zero at this sample size',
});

/**
 * Read the verdict off the run rather than off a reader's impression of it.
 *
 * A null here is a RESULT and is recorded as one. It is not grounds for removing the width
 * parameter, and it is not licence to ship a per-player table anyway.
 */
export const perPlayerWidthVerdict = (result, z = 1.959963985) => {
  // When the selected k collapses every player onto the population value the shrunk arm's
  // difference is identically 0 with no variance — degenerate, and NOT evidence of equality.
  // The verdict is then read off the UNSHRUNK arm, which is the same question asked where an
  // answer exists. `arm` says which one was used, so a reader is never guessing.
  const shrunkDegenerate = result?.heldout?.meanDiffPerDecision === 0
    && !(Number.isFinite(result?.heldout?.se) && result.heldout.se > 0);
  const src = (shrunkDegenerate && result?.heldout?.unshrunk)
    ? result.heldout.unshrunk : result?.heldout;
  const arm = (shrunkDegenerate && result?.heldout?.unshrunk)
    ? 'unshrunk (k = 0)' : 'shrunk (chosen k)';
  const d = src?.meanDiffPerDecision;
  const se = src?.se;
  if (!Number.isFinite(d)) {
    return { verdict: PER_PLAYER_WIDTH_VERDICTS.UNRESOLVED, arm, diff: null, se: null, ci: null };
  }
  if (!Number.isFinite(se) || se <= 0) {
    return { verdict: PER_PLAYER_WIDTH_VERDICTS.UNRESOLVED, arm, diff: d, se: null, ci: null };
  }
  const ci = [d - z * se, d + z * se];
  if (ci[0] > 0) return { verdict: PER_PLAYER_WIDTH_VERDICTS.BEATS, arm, diff: d, se, ci };
  if (ci[1] < 0) return { verdict: PER_PLAYER_WIDTH_VERDICTS.NULL, arm, diff: d, se, ci };
  return { verdict: PER_PLAYER_WIDTH_VERDICTS.UNRESOLVED, arm, diff: d, se, ci };
};

// ═══════════════════════════════════════════════════════════════════════════════
// WS-321 — per-player width mode
// ═══════════════════════════════════════════════════════════════════════════════

export const PER_PLAYER_WIDTH_ESTIMAND =
  'Whether the softness of postflop range narrowing is a property of the PLAYER as well as of '
  + 'the action: the out-of-sample gain, in nats of log P(true holding) per revealed decision, '
  + 'of a per-player width multiplier on ACTION_TAU_FRACTION over the single population width, '
  + 'measured on held-out EVAL players and paired on identical decisions.';

export const PER_PLAYER_WIDTH_TREATMENT =
  'read-only parameter sweep · no substitution and no counterfactual · every width arm scored on '
  + 'the SAME decisions and differenced per decision · the range is a population baseline for the '
  + "acting seat's position narrowed once by that seat's own observed action, so arms differ in "
  + 'nothing but the width · POPULATION width fitted on POOL players only; per-player widths '
  + "fitted on a temporal PREFIX of each EVAL player's own hands and scored on the SUFFIX; the "
  + 'shrinkage constant k chosen on a CALIB half of EVAL players and the headline reported on the '
  + 'disjoint HELDOUT half · every figure is conditional on the holding having been REVEALED, and '
  + 'the showdown filter is ACTION-DEPENDENT (folds reveal at 0.0%), so a per-player width is '
  + "measured on the branches that player did not fold, not on their range · population is online "
  + '6-max/full-ring July 2009, so any claim about live 9-handed 1/2-1/3 is TRANSFERRED, not measured.';

export const fmt = (x, d = 4) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));
export const fpct = (x) => (x == null || !Number.isFinite(x) ? '—' : `${(100 * x).toFixed(1)}%`);

export const renderPerPlayerWidth = (r, verdict) => {
  const L = [];
  const bar = '═'.repeat(88);
  L.push('', bar);
  L.push('  PER-PLAYER RANGE WIDTH (WS-321) — is narrowing softness a property of the PLAYER?');
  L.push(bar);

  L.push('', `  POOL pass  ${r.scanned.pool.players} players · ${r.scanned.pool.handsRead} hands · `
    + `${r.scanned.pool.revealed} revealed decisions`);
  L.push(`  EVAL pass  ${r.scanned.eval.players} players · ${r.scanned.eval.handsRead} hands · `
    + `${r.scanned.eval.revealed} revealed decisions`);
  L.push(`  runtime ${(r.scanned.runtimeMs / 1000).toFixed(1)}s`);
  if (r.scanned.eval.playersFailed || r.scanned.pool.playersFailed) {
    L.push(`  players DROPPED: pool ${r.scanned.pool.playersFailed}, eval ${r.scanned.eval.playersFailed}`
      + `  first cause: ${r.scanned.eval.firstFailure || r.scanned.pool.firstFailure}`);
  }

  L.push('', '  POPULATION WIDTH — fitted on POOL players, the value every per-player estimate');
  L.push('  shrinks toward. Δlog is nats of log P(true holding) above uniform-over-live-combos.');
  L.push('  ' + '─'.repeat(60));
  L.push(`  ${'width×'.padStart(8)}  ${'Δlog'.padStart(9)}`);
  for (const [m, v] of Object.entries(r.population.deltaLogByWidth)) {
    const mark = Number(m) === 1 ? '   <- shipped' : '';
    L.push(`  ${m.padStart(8)}  ${fmt(v).padStart(9)}${mark}`);
  }
  L.push(`  argmax ${fmt(r.population.argmaxWidth, 3)}×`
    + `${r.population.argmaxInterpolated ? ' (interpolated between grid points)' : ' (at a grid point)'}`
    + `   n=${r.population.n}`);
  L.push(`  what narrowing at the population width is WORTH vs not narrowing: `
    + `${fmt(r.population.signal)} nats/decision (se ${fmt(r.population.signalSe)})`);
  L.push('  That number is the yardstick every per-player power statement below is made against.');

  L.push('', '  PER-PLAYER SIGNAL — "no equity signal" and "too few revealed to tell" are');
  L.push('  SEPARATE findings. The separator is POWER, not sample size: mde = 1.96 × the');
  L.push("  player's own paired SE is the smallest effect their evidence could have resolved.");
  L.push('  ' + '─'.repeat(60));
  const total = r.perPlayer.length;
  for (const [cls, n] of Object.entries(r.classCounts).sort((a, b) => b[1] - a[1])) {
    L.push(`  ${cls.padEnd(16)} ${String(n).padStart(5)}  ${fpct(total ? n / total : null).padStart(7)}`);
  }
  L.push(`  ${'TOTAL'.padEnd(16)} ${String(total).padStart(5)}`);
  L.push('    signal          their actions carry equity signal — narrowing beats not narrowing');
  L.push('    negative-signal narrowing is measurably WORSE than not narrowing for them');
  L.push('    no-signal       an OBSERVED zero: a population-sized effect WOULD have shown here');
  L.push('    underpowered    a population-sized effect would ALSO have been invisible — we');
  L.push('                    did not look hard enough, and these players get NO fitted width');

  const nRevealed = r.perPlayer.map((p) => p.revealed).sort((a, b) => a - b);
  const q = (f) => (nRevealed.length ? nRevealed[Math.min(nRevealed.length - 1, Math.floor(f * nRevealed.length))] : null);
  L.push('', `  REVEALED DECISIONS PER PLAYER (the quantity everything above is limited by):`);
  L.push(`    min ${q(0)} · p25 ${q(0.25)} · MEDIAN ${q(0.5)} · p75 ${q(0.75)} · p90 ${q(0.9)} · max ${q(0.999)}`);
  const rr = r.perPlayer.map((p) => p.revealRate).filter(Number.isFinite).sort((a, b) => a - b);
  if (rr.length) {
    L.push(`    per-player reveal rate: p25 ${fpct(rr[Math.floor(0.25 * rr.length)])} · `
      + `median ${fpct(rr[Math.floor(0.5 * rr.length)])} · p75 ${fpct(rr[Math.floor(0.75 * rr.length)])}`);
  }

  L.push('', '  WORST-DISCRIMINATED PLAYERS — no width travels without its n, its reveal rate,');
  L.push('  and the action mix of what it was measured on.');
  L.push('  ' + '─'.repeat(86));
  L.push(`  ${'player'.padEnd(13)} ${'n'.padStart(4)} ${'scor'.padStart(5)} ${'rev%'.padStart(6)}`
    + ` ${'signal'.padStart(8)} ${'mde'.padStart(7)} ${'class'.padEnd(16)} ${'rawWidth'.padStart(9)} top-action`);
  for (const p of r.perPlayer.slice(0, 15)) {
    const mix = Object.entries(p.revealedActionMix)
      .filter(([, v]) => v.revealed > 0)
      .sort((a, b) => b[1].revealed - a[1].revealed)[0];
    L.push(`  ${p.playerId.slice(0, 12).padEnd(13)} ${String(p.revealed).padStart(4)}`
      + ` ${String(p.scoreable).padStart(5)} ${fpct(p.revealRate).padStart(6)}`
      + ` ${fmt(p.classification.signal, 3).padStart(8)} ${fmt(p.classification.mde, 3).padStart(7)}`
      + ` ${p.classification.class.padEnd(16)}`
      + ` ${(p.trainArgmax ? `${Math.exp(p.trainArgmax.logWidth).toFixed(2)}×` : '—').padStart(9)}`
      + ` ${mix ? `${mix[0]} ${fpct(mix[1].shareOfRevealed)}` : '—'}`);
  }
  L.push('  A player whose revealed mix is dominated by one action has a width that is mostly a');
  L.push('  statement about that branch. FOLD is 0% for every player, by construction — the');
  L.push('  revealed set is drawn entirely from the branches they did NOT fold.');

  const wd = r.widthDistribution;
  L.push('', '  RAW PER-PLAYER WIDTH — each player\'s own argmax on their TRAIN half, before');
  L.push('  any shrinkage. Every value carries the n it was fitted on.');
  L.push('  ' + '─'.repeat(60));
  for (const [label, v] of Object.entries(wd.quantiles)) {
    L.push(`  ${label.padEnd(8)} ${(v ? `${v.width.toFixed(2)}×` : '—').padStart(8)}`
      + `   nTrain ${v ? v.nTrain : '—'}`);
  }
  L.push(`  players with an estimate ${wd.withEstimate}`
    + `   ·   with NO revealed decision in their TRAIN half ${wd.noEstimate}`
    + '  (these stay at the population value)');
  L.push(`  below 1.0× ${wd.below1}  ·  above 1.0× ${wd.above1}`);
  L.push(`  PINNED TO A GRID EDGE: ${wd.edgePinned}/${wd.withEstimate} `
    + `(${fpct(wd.edgePinnedShare)}) — an argmax on a thin flat curve does not land near the`);
  L.push('  truth, it lands at whichever end noise favoured, and it lands there with total');
  L.push('  confidence. This is the signature of a fit with nothing to fit.');

  L.push('', '  SHRINKAGE CONSTANT k — measured, not chosen. Swept on the CALIB half of EVAL');
  L.push('  players only, so the headline below never sees the players that picked it.');
  L.push('  ' + '─'.repeat(60));
  L.push(`  ${'k'.padStart(8)}  ${'Δ vs population (nats/decision)'.padStart(30)}  ${'testN'.padStart(7)}`);
  for (const row of r.kCurve) {
    const mark = row.k === r.chosenK ? '  <- chosen' : (row.k === Infinity ? '  (pure-population control)' : '');
    L.push(`  ${String(row.k).padStart(8)}  ${fmt(row.meanDiffPerDecision).padStart(30)}  ${String(row.testN).padStart(7)}${mark}`);
  }

  L.push('', '  HEADLINE — HELDOUT players, walk-forward within each player, paired per decision.');
  L.push('  ' + '─'.repeat(60));
  L.push(`  players ${r.heldout.playersScored}/${r.heldout.players} with any TEST decision`
    + `   TEST decisions ${r.heldout.testDecisions}`);
  L.push(`  players whose fitted width moved OFF the population value: ${r.heldout.movedOffPopulation}`);
  L.push(`  at the CHOSEN k: ${fmt(r.heldout.meanDiffPerDecision)} nats/decision`
    + `  (se ${fmt(r.heldout.se)}, clustered by player)`);
  L.push('  at k = 0 (UNSHRUNK — every player on their own argmax, the maximal per-player arm):');
  L.push(`      ${fmt(r.heldout.unshrunk.meanDiffPerDecision)} nats/decision`
    + `  (se ${fmt(r.heldout.unshrunk.se)})`
    + `   ${r.heldout.unshrunk.movedOffPopulation}/${r.heldout.players} players moved off population`);
  L.push(`  control arm (k = ∞, pure population): ${fmt(r.heldout.controlMeanDiffPerDecision)}`
    + '  — must be exactly 0 by construction');
  L.push('');
  L.push(`  VERDICT (read off the ${verdict.arm} arm): ${verdict.verdict}`);
  L.push(`    ${fmt(verdict.diff)} nats/decision`
    + (verdict.ci ? `   95% CI [${fmt(verdict.ci[0])}, ${fmt(verdict.ci[1])}]` : '   (no interval)'));
  L.push('');
  L.push('  READ THE CAVEAT WITH THE NUMBER. The corpus is online 50NL, July 2009; the founder');
  L.push('  plays live 9-handed 1/2-1/3, so this is TRANSFERRED, not measured. And every figure');
  L.push('  here is conditional on a showdown: folds reveal at 0.0%, so a player who folds more');
  L.push('  reveals a smaller and differently-composed slice of their range than one who does');
  L.push('  not — an apparent "no signal" can be a fact about observability, not about them.');
  L.push(bar);
  return L.join('\n');
};

export const buildPerPlayerWidthCard = ({ result, verdict, replicationStamp, dealBook, poolPct }) => {
  const blockers = [];
  const warnings = [];
  const players = result.heldout.playersScored;
  if (!Number.isFinite(result.heldout.meanDiffPerDecision)) {
    blockers.push('no HELDOUT player produced a scoreable TEST decision — there is no measurement here.');
  }
  if (players < MIN_PLAYERS_FOR_QUOTE) {
    blockers.push(`only ${players} HELDOUT players carried a TEST decision (< ${MIN_PLAYERS_FOR_QUOTE}); `
      + 'a per-player finding clustered on fewer players than this is one player wide.');
  }
  const under = result.classCounts.underpowered || 0;
  const totalPlayers = result.perPlayer.length || 1;
  if (under / totalPlayers > 0.5) {
    warnings.push(`${under} of ${totalPlayers} players (${(100 * under / totalPlayers).toFixed(1)}%) are `
      + 'UNDERPOWERED: their own evidence could not have resolved even a population-sized effect. '
      + 'A null over this population is a weak-power null (§11.8), not proof that width is not a '
      + 'property of a player.');
  }
  warnings.push(
    'SHOWDOWN SELECTION IS ACTION-DEPENDENT and is NOT corrected away. Folds reveal at 0.0%, so '
    + "every per-player width is fitted on the branches that player did not fold. Two players' "
    + 'widths are therefore not measured on comparable slices of their ranges.',
  );
  warnings.push(
    'CORPUS-MINED PRIOR: the baseline range is built from populationPriors, mined from this '
    + 'corpus. That channel is open here as it is for every arm of this instrument, and it is '
    + 'identical across width arms, so it cannot favour the per-player arm over the population '
    + 'arm — but it does inflate both against an out-of-corpus baseline.',
  );
  warnings.push(
    'buildRangeProfile runs over ALL of a player\'s hands and so selects WHICH decisions exist, '
    + 'including in the TEST suffix. It does not enter the scored range (arms are built from the '
    + 'population baseline) and it is identical across arms, so the paired contrast is unaffected '
    + '— recorded because an undeclared use of the suffix is how walk-forward guarantees rot.',
  );
  warnings.push(
    'POPULATION: online 6-max/full-ring 50NL, July 2009. The founder\'s game is live 9-handed '
    + '1/2-1/3. Any live claim anchored on this figure is TRANSFERRED, not measured.',
  );

  const admissibility = {
    admissible: blockers.length === 0,
    blockers,
    warnings,
    clusters: players,
    clusterUnit: 'players',
  };

  const manifest = buildReplicationManifest(replicationStamp);
  const resultCard = buildResultCard({
    resultCardId: `RC-per-player-width-${String(replicationStamp.dealBookHash).replace('sha256:', '').slice(0, 8)}-${String(replicationStamp.engineCommit).slice(0, 8)}`,
    match: {
      surfaceId: 'engine-read',
      dealBookId: dealBook?.dealBookId ?? null,
      fieldId: 'population-chart-baseline',
    },
    estimand: PER_PLAYER_WIDTH_ESTIMAND,
    treatment: PER_PLAYER_WIDTH_TREATMENT,
    metrics: {
      kind: 'per-player-width', // WS-434: dispatches to SOR_SCHEMAS['metrics.per-player-width']
      // ── the headline, on ONE scale ────────────────────────────────────────────────
      perPlayerMinusPopulationNatsPerDecision: result.heldout.meanDiffPerDecision,
      headlineSe: result.heldout.se,
      headlineArm: verdict.arm,
      // The maximal per-player arm, which is what answers the question when the selected k
      // has already collapsed the shrunk arm onto the population value.
      unshrunkPerPlayerMinusPopulationNatsPerDecision: result.heldout.unshrunk.meanDiffPerDecision,
      unshrunkSe: result.heldout.unshrunk.se,
      unshrunkPlayersMovedOffPopulation: result.heldout.unshrunk.movedOffPopulation,
      headlineCiLow: verdict.ci ? verdict.ci[0] : null,
      headlineCiHigh: verdict.ci ? verdict.ci[1] : null,
      // WS-434 Stage 2: unit-suffixed canonical aliases, emitted beside the bare names forever.
      headlineSeNatsPerDecision: result.heldout.se,
      headlineCiLowNatsPerDecision: verdict.ci ? verdict.ci[0] : null,
      headlineCiHighNatsPerDecision: verdict.ci ? verdict.ci[1] : null,
      verdict: verdict.verdict,
      // ── the population width itself ───────────────────────────────────────────────
      populationWidthMultiplier: result.population.argmaxWidth,
      populationWidthN: result.population.n,
      populationNarrowingWorthNats: result.population.signal,
      populationNarrowingWorthSe: result.population.signalSe,
      chosenShrinkageK: result.chosenK === Infinity ? 'Infinity' : result.chosenK,
      // ── the observed-zero / never-looked split, AS DATA ───────────────────────────
      playersSignal: result.classCounts.signal || 0,
      playersNegativeSignal: result.classCounts['negative-signal'] || 0,
      playersNoSignalObservedZero: result.classCounts['no-signal'] || 0,
      playersUnderpoweredCannotTell: result.classCounts.underpowered || 0,
      playersTotal: result.perPlayer.length,
      // ── denominators, and the selection term every one of them is conditional on ──
      heldoutPlayers: result.heldout.players,
      heldoutPlayersScored: players,
      heldoutTestDecisions: result.heldout.testDecisions,
      heldoutPlayersMovedOffPopulation: result.heldout.movedOffPopulation,
      poolRevealedDecisions: result.scanned.pool.revealed,
      evalRevealedDecisions: result.scanned.eval.revealed,
      rawWidthMedian: result.widthDistribution.quantiles.median?.width ?? null,
      rawWidthP25: result.widthDistribution.quantiles.p25?.width ?? null,
      rawWidthP75: result.widthDistribution.quantiles.p75?.width ?? null,
      rawWidthPlayersWithEstimate: result.widthDistribution.withEstimate,
      rawWidthPlayersNoEstimate: result.widthDistribution.noEstimate,
      rawWidthEdgePinned: result.widthDistribution.edgePinned,
      rawWidthEdgePinnedShare: result.widthDistribution.edgePinnedShare,
      medianRevealedPerPlayer: (() => {
        const a = result.perPlayer.map((p) => p.revealed).sort((x, y) => x - y);
        return a.length ? a[Math.floor(a.length / 2)] : null;
      })(),
      showdownConditional: true,
      foldRevealRate: 0,
    },
    clusterUnit: 'players',
    admissibility,
    manifest,
  });
  return { resultCard, admissibility };
};
