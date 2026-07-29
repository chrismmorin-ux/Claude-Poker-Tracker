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
import { narrowByBoard } from '../../src/utils/exploitEngine/postflopNarrower.js';
import { buildBaselineRange } from '../../src/utils/exploitEngine/preflopAdvisor.js';
import { enumerateCombos } from '../../src/utils/pokerCore/rangeMatrix.js';
import { parseAndEncode } from '../../src/utils/pokerCore/cardParser.js';
import { comboStrengthPercentile } from '../../src/utils/pokerCore/handEvaluator.js';
import { getRangePositionCategory } from '../../src/utils/positionUtils.js';
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

/** All available combos ignoring the range — the denominator for "retained fraction". */
const totalAvailableCombos = (board, dead) => {
  const blocked = new Set([...board, ...dead]);
  const free = 52 - blocked.size;
  return (free * (free - 1)) / 2;
};

/**
 * Score one (range, revealed hand) pair.
 * @returns {{covered, retained, p, u}|null}
 */
const scoreRange = (range, board, hole, dead = []) => {
  if (!range || !board || board.length < 3) return null;
  const [c1, c2] = hole;
  if (board.includes(c1) || board.includes(c2)) return null;
  const combos = enumerateCombos(range, [...board, ...dead]);
  if (combos.length === 0) return null;
  const total = combos.reduce((s, c) => s + c.weight, 0);
  if (!(total > 0)) return null;

  const p = combos
    .filter((c) => (c.card1 === c1 && c.card2 === c2) || (c.card1 === c2 && c.card2 === c1))
    .reduce((s, c) => s + c.weight, 0) / total;

  const avail = totalAvailableCombos(board, dead);
  return {
    covered: p > 0,
    retained: avail > 0 ? combos.length / avail : 0,
    p,
    u: 1 / combos.length,
  };
};

const strengthBand = (pct) => (pct == null ? 'unknown' : pct >= 0.8 ? 'strong' : pct >= 0.5 ? 'medium' : 'weak');

/**
 * Run the probe.
 *
 * @returns {Promise<Object>} nested stat summaries
 */
export const runRangeCalibrationProbe = async ({
  files, poolPct = 50, maxPlayers = Infinity, maxHandsPerPlayer = Infinity,
  tauSweep = null, floorSweep = null,
  log = () => {},
}) => {
  const { byPlayer, handsRead } = await indexEvalPlayers({
    files, poolPct, maxPlayers, maxHandsPerPlayer,
    onProgress: ({ handsRead: h, players }) => log(`read ${h} hands, ${players} players`),
  });
  log(`indexed ${byPlayer.size} players from ${handsRead} hands`);

  const acting = { all: mkStat(), byStreet: {}, byAction: {}, byStrength: {}, bySite: {} };
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

  let decisions = 0;
  let revealedActing = 0;
  let revealedVillain = 0;

  const at = (bucket, key) => (bucket[key] || (bucket[key] = mkStat()));

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
          if (!board || board.length < 3) return;

          // ---- 1. acting seat: the range the accumulator tracks ----
          const hRaw = sd[String(ctx.playerSeat)];
          if (hRaw && ctx.rangeBefore) {
            const hole = hRaw.map(parseAndEncode);
            if (!hole.some((c) => c < 0)) {
              const r = scoreRange(ctx.rangeBefore, board, hole);
              if (r) {
                revealedActing++;
                push(acting.all, r);
                push(at(acting.byStreet, ctx.street), r);
                push(at(acting.byAction, ctx.action), r);
                push(at(acting.bySite, site), r);
                const band = strengthBand(comboStrengthPercentile(hole[0], hole[1], board));
                push(at(acting.byStrength, band), r);
              }
            }
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

                // ---- 3. chaining: what gameTreeDepth2 does inside one evaluation ----
                if (narrowed) {
                  let cur = base;
                  for (let depth = 1; depth <= 3; depth++) {
                    try { cur = narrowByBoard(cur, 'call', board, []); } catch { break; }
                    const r = scoreRange(cur, board, vHole);
                    if (r) push(chained[depth], r);
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

  return {
    scanned: { decisions, revealedActing, revealedVillain, players: byPlayer.size, handsRead },
    acting: {
      all: summarize(acting.all),
      byStreet: mapSummary(acting.byStreet),
      byAction: mapSummary(acting.byAction),
      byStrength: mapSummary(acting.byStrength),
      bySite: mapSummary(acting.bySite),
    },
    villain: {
      all: summarize(villain.all),
      byStreet: mapSummary(villain.byStreet),
      byAction: mapSummary(villain.byAction),
    },
    chained: mapSummary(chained),
    tauSweep: mapSummary(tauArms),
    floorSweep: mapSummary(floorArms),
  };
};
