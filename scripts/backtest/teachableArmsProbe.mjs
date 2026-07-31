/**
 * teachableArmsProbe.mjs — how close does a human-memorable narrowing rule get to the
 * shipped engine, scored on the SAME villain decisions?
 *
 * READ-ONLY MEASUREMENT. Changes nothing in src/. New script rather than an edit to
 * `rangeCalibrationProbe.mjs` because this experiment mines its own POOL-only likelihood
 * tables (a second corpus pass with a different player group) before it can even build two
 * of the five arms — that mining phase has no equivalent in the existing probe, and bolting
 * it onto a file whose whole job today is single-pass parameter sweeps would make both
 * harder to read. `run-teachable-arms.mjs` is the paired CLI entry point.
 *
 * THE FIVE ARMS, all scored by `deltaLogVsUniform` (mean log P(true hand) - mean log
 * uniform) on the SAME villain decisions:
 *
 *   A0  no narrowing            — the baseline preflop range, unchanged.
 *   A1  engine, as shipped      — narrowByBoard with current defaults (ACTION_TAU_FRACTION).
 *   A2  bucket multiplier table — ACTION_MULTIPLIERS[action][bucket] (the LEGACY 5-bucket
 *                                 table already in postflopNarrower.js), never fit to this
 *                                 corpus. 4 actions x 5 buckets = 20 numbers.
 *   A3  measured 3-class LR     — P(action | class) estimated from POOL players, class =
 *                                 classifyComboFull's bucket collapsed to strong/medium/weak.
 *                                 4 actions x 3 classes = 12 numbers.
 *   A4  A3 + check position     — check split into check-back (closes the action on this
 *                                 street) and check-OOP (does not). 5 actions x 3 classes =
 *                                 15 numbers.
 *
 * THE LEAKAGE CONTROL (the whole point of this file, see POKER_THEORY / CLAUDE.md standing
 * rule against corpus-mined priors leaking into corpus backtests by construction):
 *
 *   - Players are split POOL/EVAL by `partition.mjs` (same FNV-1a partition the rest of the
 *     backtest harness uses), independently per site.
 *   - A3 and A4's likelihood tables are estimated EXCLUSIVELY from POOL players
 *     (`mineLikelihoodTables`). EVAL players contribute nothing to those numbers.
 *   - A0, A1 and A2 are not fit to anything, so leakage cannot inflate them either way —
 *     but they are STILL scored only on EVAL decisions, so the comparison across all five
 *     arms is per-decision on one shared decision set, never across different sets.
 *   - `scoreArms` requires ALL FIVE arms to produce a valid score for a decision before any
 *     of them is counted — otherwise a slice where one arm degenerates (e.g. a dead-card
 *     collision) would silently change which decisions the other arms are averaged over.
 *
 * A2's "no fit to this corpus" claim is enforced structurally too: it reads the constant
 * `ACTION_MULTIPLIERS` table straight from `postflopNarrower.js` with no corpus-derived
 * adjustment layered on (i.e. NOT `adaptMultipliers`, which would pull in observed stats).
 */

import { getRangePositionCategory } from '../../src/utils/positionUtils.js';
import { buildRangeProfile } from '../../src/utils/rangeEngine/index.js';
import { accumulateDecisions } from '../../src/utils/exploitEngine/decisionAccumulator.js';
import {
  narrowByBoard, classifyComboFull, ACTION_MULTIPLIERS,
} from '../../src/utils/exploitEngine/postflopNarrower.js';
import { buildBaselineRange } from '../../src/utils/exploitEngine/preflopAdvisor.js';
import { enumerateCombos, decodeIndex, createRange } from '../../src/utils/pokerCore/rangeMatrix.js';
import { parseAndEncode, encodeCard } from '../../src/utils/pokerCore/cardParser.js';
import { partitionOf, GROUPS } from './partition.mjs';
import { iterAppHands } from './phhAdapter.mjs';

const USER_ID = 'backtest';
const GRID_SIZE = 169;

export const ACTIONS4 = ['raise', 'call', 'check', 'bet'];
export const ACTIONS5 = ['raise', 'call', 'check-back', 'check-OOP', 'bet'];
export const CLASSES = ['strong', 'medium', 'weak'];

/** classifyComboFull's 5-bucket -> the 3-class split A3/A4 estimate likelihoods over. */
export const collapse3 = (bucket) => (
  bucket === 'nuts' || bucket === 'strong' ? 'strong'
    : bucket === 'marginal' || bucket === 'draw' ? 'medium'
      : 'weak'
);

// ─── CORPUS INGEST — ONE PASS, TWO GROUPS ────────────────────────────────────
//
// `runner.mjs`'s `indexEvalPlayers` reads the corpus once per group; this probe needs
// BOTH groups from the same site, so it reads once and routes each player's hands into
// whichever bucket their FNV partition assigns them to. Same partition function, same
// site, half the IO of two separate `indexEvalPlayers` calls.
export const indexPlayersBothGroups = async ({
  files, poolPct = 50, maxPlayersPool = Infinity, maxPlayersEval = Infinity,
  maxHandsPerPlayer = Infinity, onProgress = null,
}) => {
  const byPlayerPool = new Map();
  const byPlayerEval = new Map();
  let handsRead = 0;

  for (const file of files) {
    for await (const hand of iterAppHands(file.path, { site: file.site, stakeLabel: file.stakeLabel }, {})) {
      handsRead++;
      for (const pid of Object.values(hand.seatPlayers)) {
        const grp = partitionOf(pid, poolPct);
        const targetMap = grp === GROUPS.POOL ? byPlayerPool : byPlayerEval;
        const cap = grp === GROUPS.POOL ? maxPlayersPool : maxPlayersEval;
        let bucket = targetMap.get(pid);
        if (!bucket) {
          if (targetMap.size >= cap) continue;
          bucket = [];
          targetMap.set(pid, bucket);
        }
        if (bucket.length < maxHandsPerPlayer) bucket.push(hand);
      }
      if (onProgress && handsRead % 25000 === 0) {
        onProgress({ handsRead, pool: byPlayerPool.size, eval: byPlayerEval.size });
      }
    }
  }

  return { byPlayerPool, byPlayerEval, handsRead };
};

// ─── SHARED VILLAIN-DECISION RECONSTRUCTION ──────────────────────────────────
//
// IMPORTANT DEVIATION from rangeCalibrationProbe.mjs's "villain seat" block, and why.
//
// That block sources the modeled action from `ctx.opponentSeat` — the villain whose PRIOR
// action produced the context a DIFFERENT tracked player (`ctx.playerSeat`, "hero" in that
// framing) is now facing. That construction cannot ever observe a check-back: by
// definition it only fires when there is a SUBSEQUENT decision for someone else on the
// same street, and a check-back is precisely the action that closes the street and leaves
// no subsequent decision to hang the observation on. Verified empirically before this
// comment was written: `ctx.opponentSeat`-sourced check-back counts were 0/0/0 across every
// class on a full 350-player PS run — not a thin cell, a structurally impossible one.
//
// This probe instead sources the modeled action from the TRACKED player's OWN decision —
// `ctx.playerSeat`, `ctx.action`, `ctx.order` directly, no secondary scan needed. Because
// `accumulateDecisions` fires `onDecision` once for every action the tracked player takes,
// including the action that closes a street, this observes check-backs correctly. It is
// the same "ACTING SEAT" framing rangeCalibrationProbe.mjs already uses in its first probe
// (just narrowed by ONE fresh `buildBaselineRange` + one action, to match how A1 calls
// `narrowByBoard`, rather than that probe's `ctx.rangeBefore`, which is the accumulator's
// own multi-action running range and a different question). Every corpus player who
// appears in `byPlayer` is walked as "the tracked player" in turn, so this is symmetric
// across seats — there is no hero/villain distinction left, only "the acting player."
//
// check-back / check-OOP (for A4): a check is a "check-back" when the checking player is IN
// POSITION and "check-OOP" when they are out of position. THIS is the determination
// `slowplayProbe.mjs:147` uses and demonstrably works on this corpus (428 IP check-backs vs
// 565 OOP checks): `decisionAccumulator.js`'s `onDecision` callback already computes
// `ctx.isIP` (`'ip'`/`'oop'`, set at decisionAccumulator.js:389 from the `ipStatus` computed
// at decisionAccumulator.js:324-326 via `isInPosition`) for whichever player is acting — we
// reuse it directly rather than re-deriving position or re-scanning the action sequence.
// WS-312: an EARLIER version of this file tried to detect "closes the action" by order
// instead of position, and sourced it from `ctx.opponentSeat` — the villain whose PRIOR
// action produced hero's decision context — which structurally can never observe a
// check-back (that callback only fires when someone still has a decision to make on the
// same street, i.e. the street has NOT closed). That always classified every check as
// check-OOP (bit-identical A3/A4 scores). This version fixes both problems at once by doing
// what `slowplayProbe.mjs` does: track the ACTING player's own decision directly
// (`ctx.playerSeat`/`ctx.action`/`ctx.isIP`), so every action — including the one that
// closes a street — fires its own `onDecision` callback.
const forEachVillainDecision = (byPlayer, cb) => {
  for (const [pid, hands] of byPlayer) {
    let profile;
    try { profile = buildRangeProfile(pid, hands, USER_ID); } catch { continue; }
    if (!profile) continue;

    try {
      accumulateDecisions(pid, hands, profile, USER_ID, {
        onDecision: (ctx) => {
          const hand = ctx.hand;
          const board = ctx.board;
          if (!board || board.length < 3) return;

          const vAction = ctx.action;
          if (!vAction || !ACTIONS4.includes(vAction)) return;

          const vSeat = ctx.playerSeat;
          if (vSeat == null) return;
          const sd = hand.gameState.showdownCards || {};
          const vRaw = sd[String(vSeat)];
          if (!vRaw) return;
          const vHole = vRaw.map(parseAndEncode);
          if (vHole.some((c) => c < 0)) return;
          if (board.includes(vHole[0]) || board.includes(vHole[1])) return;

          // Same determination as slowplayProbe.mjs:147 — position label straight off ctx,
          // not re-derived.
          const isLastOnStreet = ctx.isIP === 'ip';

          const vPos = getRangePositionCategory(Number(vSeat), hand.gameState.dealerButtonSeat);
          const base = buildBaselineRange(null, null, vPos);

          cb({ board, vHole, vAction, isLastOnStreet, base, street: ctx.street });
        },
      });
    } catch { /* player skipped */ }
  }
};

// ─── A3 / A4 LIKELIHOOD MINING (POOL ONLY) ───────────────────────────────────

export const mineLikelihoodTables = (byPlayerPool) => {
  const counts4 = {};
  for (const a of ACTIONS4) counts4[a] = { strong: 0, medium: 0, weak: 0 };
  const counts5 = {};
  for (const a of ACTIONS5) counts5[a] = { strong: 0, medium: 0, weak: 0 };

  let nMined = 0;

  forEachVillainDecision(byPlayerPool, ({ board, vHole, vAction, isLastOnStreet }) => {
    const bucket = classifyComboFull(vHole[0], vHole[1], board).bucket;
    const cls = collapse3(bucket);
    counts4[vAction][cls]++;
    const action5 = vAction === 'check' ? (isLastOnStreet ? 'check-back' : 'check-OOP') : vAction;
    counts5[action5][cls]++;
    nMined++;
  });

  return { counts4, counts5, nMined, nPlayersPool: byPlayerPool.size };
};

/**
 * counts[action][class] -> { table, classTotals, grandTotal }, where
 * table[action][class] = { n, classTotal, p, baseRate, ratioToBase, oddsRatio }.
 *   p           = P(action | class), estimated from POOL only.
 *   baseRate    = P(action) unconditional (all classes pooled), same POOL corpus.
 *   ratioToBase = p / baseRate — the plain multiplier a human applies to the base rate.
 *   oddsRatio   = odds(action | class) / odds(action) unconditional — standard 2x2 form.
 */
export const buildLikelihoodTable = (counts, actions) => {
  const classTotals = { strong: 0, medium: 0, weak: 0 };
  for (const a of actions) for (const c of CLASSES) classTotals[c] += counts[a][c];
  const grandTotal = CLASSES.reduce((s, c) => s + classTotals[c], 0);

  const actionTotals = {};
  for (const a of actions) actionTotals[a] = CLASSES.reduce((s, c) => s + counts[a][c], 0);

  const table = {};
  for (const a of actions) {
    table[a] = {};
    const baseRate = grandTotal > 0 ? actionTotals[a] / grandTotal : null;
    for (const c of CLASSES) {
      const n = counts[a][c];
      const denom = classTotals[c];
      const p = denom > 0 ? n / denom : null;
      let oddsRatio = null;
      if (p != null && p < 1 && baseRate != null && baseRate > 0 && baseRate < 1) {
        oddsRatio = (p / (1 - p)) / (baseRate / (1 - baseRate));
      }
      const ratioToBase = (p != null && baseRate != null && baseRate > 0) ? p / baseRate : null;
      table[a][c] = { n, classTotal: denom, p, baseRate, ratioToBase, oddsRatio };
    }
  }
  return { table, classTotals, grandTotal, actionTotals };
};

// ─── A2/A3/A4 NARROWING — MULTIPLY BY A FIXED LOOKUP, NOT A CALIBRATED SOFT WEIGHT ──
//
// Unlike `narrowByBoard` (A1), none of A2/A3/A4's multipliers are calibrated against the
// board's reference population or mean-pinned to an observed continuation rate — they are
// FIXED numbers (a hand-authored table or a POOL-estimated table), so it is correct and
// cheap to skip any cell the prior already excludes rather than enumerate the whole board
// reference population the way WS-291 requires for a CALIBRATED weight.
const narrowByLookup = (range, board, deadCards, lookupFn) => {
  const result = createRange();
  const dead = new Set([...deadCards, ...board]);

  for (let idx = 0; idx < GRID_SIZE; idx++) {
    if (range[idx] <= 0) continue;
    const { rank1, rank2, suited, isPair } = decodeIndex(idx);
    const enumSuits = isPair
      ? (() => { const out = []; for (let s1 = 0; s1 < 4; s1++) for (let s2 = s1 + 1; s2 < 4; s2++) out.push([s1, s2]); return out; })()
      : suited
        ? [[0, 0], [1, 1], [2, 2], [3, 3]]
        : (() => { const out = []; for (let s1 = 0; s1 < 4; s1++) for (let s2 = 0; s2 < 4; s2++) { if (s1 !== s2) out.push([s1, s2]); } return out; })();

    let wSum = 0;
    let wCount = 0;
    for (const [s1, s2] of enumSuits) {
      const c1 = encodeCard(rank1, s1);
      const c2 = encodeCard(rank2, s2);
      if (dead.has(c1) || dead.has(c2)) continue;
      const info = classifyComboFull(c1, c2, board);
      wSum += lookupFn(info.bucket);
      wCount++;
    }
    if (wCount === 0) continue;
    result[idx] = range[idx] * (wSum / wCount);
  }
  return result;
};

// ─── SCORING (shared with rangeCalibrationProbe.mjs's construction) ─────────

const mkStat = () => ({ n: 0, covered: 0, retainedSum: 0, sumLogP: 0, sumLogU: 0 });
const push = (s, { covered, retained, p, u }) => {
  s.n++;
  s.retainedSum += retained;
  if (covered) s.covered++;
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
    coverageLift: retained > 0 ? coverage / retained : null,
    deltaLogVsUniform: (s.sumLogP - s.sumLogU) / s.n,
  };
};

const totalAvailableCombos = (board, dead) => {
  const blocked = new Set([...board, ...dead]);
  const free = 52 - blocked.size;
  return (free * (free - 1)) / 2;
};

const scoreRange = (range, board, hole) => {
  const [c1, c2] = hole;
  const combos = enumerateCombos(range, board);
  if (combos.length === 0) return null;
  const total = combos.reduce((s, c) => s + c.weight, 0);
  if (!(total > 0)) return null;
  const p = combos
    .filter((c) => (c.card1 === c1 && c.card2 === c2) || (c.card1 === c2 && c.card2 === c1))
    .reduce((s, c) => s + c.weight, 0) / total;
  const avail = totalAvailableCombos(board, []);
  return {
    covered: p > 0,
    retained: avail > 0 ? combos.length / avail : 0,
    p,
    u: 1 / combos.length,
  };
};

// Never literally zero (POKER_THEORY §11.6 — narrowing is reweighting, not elimination).
// The lookup tables should always have a defined cell for every (action, bucket) this
// corpus produces; the null-coalescing fallbacks below are a defensive floor for a thin
// or unobserved cell, not an expected code path — `runTeachableArmsProbe`'s caller should
// inspect the mined tables' per-cell `n` and flag any that are actually thin (see report).
const MIN_WEIGHT = 0.01;

/**
 * Score all five arms on EVAL players, paired per decision: a decision counts toward ANY
 * arm's stats only if ALL FIVE arms produced a valid score for it, so every arm's mean is
 * over the identical decision set.
 */
export const scoreArms = ({ byPlayerEval, a3Table, a4Table }) => {
  const arms = { A0: mkStat(), A1: mkStat(), A2: mkStat(), A3: mkStat(), A4: mkStat() };
  let nScored = 0;

  forEachVillainDecision(byPlayerEval, ({ board, vHole, vAction, isLastOnStreet, base }) => {
    let r1;
    try { r1 = narrowByBoard(base, vAction, board, []); } catch { return; }

    const r0 = base;
    const r2 = narrowByLookup(base, board, [], (bucket) => (
      Math.max(ACTION_MULTIPLIERS[vAction]?.[bucket] ?? MIN_WEIGHT, MIN_WEIGHT)
    ));
    const r3 = narrowByLookup(base, board, [], (bucket) => (
      Math.max(a3Table[vAction]?.[collapse3(bucket)]?.p ?? 0.25, MIN_WEIGHT)
    ));
    const action5 = vAction === 'check' ? (isLastOnStreet ? 'check-back' : 'check-OOP') : vAction;
    const r4 = narrowByLookup(base, board, [], (bucket) => (
      Math.max(a4Table[action5]?.[collapse3(bucket)]?.p ?? 0.2, MIN_WEIGHT)
    ));

    const s0 = scoreRange(r0, board, vHole);
    const s1 = scoreRange(r1, board, vHole);
    const s2 = scoreRange(r2, board, vHole);
    const s3 = scoreRange(r3, board, vHole);
    const s4 = scoreRange(r4, board, vHole);
    if (!s0 || !s1 || !s2 || !s3 || !s4) return;

    push(arms.A0, s0);
    push(arms.A1, s1);
    push(arms.A2, s2);
    push(arms.A3, s3);
    push(arms.A4, s4);
    nScored++;
  });

  return { arms, nScored, nPlayersEval: byPlayerEval.size };
};

/**
 * Run the full experiment for one site: mine A3/A4 tables from POOL, score all five arms
 * on EVAL, return everything needed for the report.
 */
export const runTeachableArmsProbe = async ({
  files, poolPct = 50, maxPlayersPool = Infinity, maxPlayersEval = Infinity,
  maxHandsPerPlayer = Infinity, log = () => {},
}) => {
  const { byPlayerPool, byPlayerEval, handsRead } = await indexPlayersBothGroups({
    files, poolPct, maxPlayersPool, maxPlayersEval, maxHandsPerPlayer,
    onProgress: ({ handsRead: h, pool, eval: ev }) => log(`read ${h} hands — pool ${pool} players, eval ${ev} players`),
  });
  log(`indexed pool=${byPlayerPool.size} eval=${byPlayerEval.size} players from ${handsRead} hands`);

  const mined = mineLikelihoodTables(byPlayerPool);
  log(`mined ${mined.nMined} POOL decisions for A3/A4 likelihood tables`);

  const a3 = buildLikelihoodTable(mined.counts4, ACTIONS4);
  const a4 = buildLikelihoodTable(mined.counts5, ACTIONS5);

  // GUARD (WS-312): a check-position split that always lands every check on one side is
  // worse than useless — it looks like a working 5-action table while silently degrading to
  // A3's 4-action one. Fail loudly instead of shipping a number nobody can tell is fake.
  const cbCounts = CLASSES.map((c) => a4.table['check-back'][c].n);
  const coCounts = CLASSES.map((c) => a4.table['check-OOP'][c].n);
  const cbTotal = cbCounts.reduce((s, n) => s + n, 0);
  const coTotal = coCounts.reduce((s, n) => s + n, 0);
  if ((cbTotal === 0 && coTotal > 0) || (coTotal === 0 && cbTotal > 0)) {
    throw new Error(
      `A4 check-position split degenerated: check-back n=[${cbCounts.join(',')}] `
      + `(total ${cbTotal}), check-OOP n=[${coCounts.join(',')}] (total ${coTotal}). One `
      + 'side collected zero observations while the other collected data — the '
      + 'in-position/out-of-position determination is not splitting the corpus.',
    );
  }

  const scored = scoreArms({ byPlayerEval, a3Table: a3.table, a4Table: a4.table });
  log(`scored ${scored.nScored} EVAL decisions across all 5 arms`);

  const armsSummary = Object.fromEntries(
    Object.entries(scored.arms).map(([k, v]) => [k, summarize(v)]),
  );

  // GUARD (WS-312): A4 (5-action: check split into check-back/check-OOP) must be able to
  // differ from A3 (4-action: undifferentiated check) — if the split table above collapses
  // to the same lookups A3 uses, the two arms score bit-identically, which is the exact
  // failure this file shipped with. Two genuinely different likelihood tables will not
  // produce exactly equal floating-point means over the same decision set, so exact
  // equality here is the correct (not overly strict) test.
  if (
    armsSummary.A3 && armsSummary.A4
    && armsSummary.A4.deltaLogVsUniform === armsSummary.A3.deltaLogVsUniform
  ) {
    throw new Error(
      `A4 is inert: deltaLogVsUniform (${armsSummary.A4.deltaLogVsUniform}) is bit-identical `
      + "to A3's. A4's check-position split produced no measurable difference from A3's "
      + 'undifferentiated check likelihood.',
    );
  }

  return {
    handsRead,
    nPlayersPool: byPlayerPool.size,
    nPlayersEval: byPlayerEval.size,
    nMinedDecisions: mined.nMined,
    nScoredDecisions: scored.nScored,
    a3Table: a3,
    a4Table: a4,
    arms: armsSummary,
  };
};
