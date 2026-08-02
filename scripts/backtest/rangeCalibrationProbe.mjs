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

const USER_ID = 'backtest';

const mkStat = () => ({
  n: 0, covered: 0, retainedSum: 0, sumLogP: 0, sumLogU: 0,
  nPos: 0, sumLogPpos: 0, sumLogUpos: 0,
});

const push = (s, { covered, retained, p, u }) => {
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

  const at = (bucket, key) => (bucket[key] || (bucket[key] = mkStat()));
  const atMap = (bucket, key) => (bucket[key] || (bucket[key] = {}));

  for (const [pid, hands] of byPlayer) {
    let profile;
    try { profile = buildRangeProfile(pid, hands, USER_ID); } catch { continue; }
    if (!profile) continue;

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
          const vRaw = vSeat != null ? sd[String(vSeat)] : null;
          if (vRaw) {
            const vHole = vRaw.map(parseAndEncode);
            if (!vHole.some((c) => c < 0)) {
              // the villain's last action on this street, before hero's decision
              let vAction = null;
              for (const e of hand.gameState.actionSequence) {
                if (e.order >= ctx.order) break;
                if (e.street !== ctx.street) continue;
                if (String(e.seat) === String(vSeat)) vAction = e.action;
              }
              if (vAction) {
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
    } catch { /* player skipped */ }
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

  return {
    scanned: {
      decisions,
      revealedActing,
      revealedVillain,
      players: byPlayer.size,
      handsRead,
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
