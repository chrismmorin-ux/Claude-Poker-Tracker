/**
 * strategyProfile.mjs — WS-323 follow-on. What kind of strategy did we actually declare?
 *
 * The Entry Map answers 1,690 cells. It does not say what those answers ADD UP TO — how often
 * this strategy would play a hand, how that compares to the pool it would sit down against, or
 * where its weaknesses are concentrated. A map you cannot characterise is a map you cannot
 * improve on purpose.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS NOT. IT IS NOT A MEASUREMENT OF PERFORMANCE.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Every number below is the MODEL'S OWN ARITHMETIC, INTEGRATED — the same engine that produced
 * each cell, weighted by how often each cell arises. It is the map's self-report, and a
 * self-report cannot detect the error it was itself computed under. If CP-1 misprices unpaired
 * hands, the integral of CP-1 misprices them by exactly as much.
 *
 * So `forecastEdgeBB100` is NOT a Result Card, must not be cited as what this strategy makes,
 * and does not resolve a comparative claim under ADR-009. The independent number requires
 * playing the strategy out against a population that responds (WS-326), scored against the
 * ceiling of what was available to win (WS-331). This module exists to say what we are about to
 * measure, and to make the weaknesses findable BEFORE spending that compute.
 *
 * The distinction is the whole point of WS-295: the engine's stated EV and what its advice
 * realizes are different quantities, and the gap between them is a research subject rather than
 * a rounding error.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * FREQUENCIES ARE COMPUTED FROM GAME STATE, NOT FROM LABELS
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * §7.2 forbids position labels as decision inputs. Nothing here is a decision, but the same
 * discipline applies to the weighting or the answer is circular: a position category selects
 * WHICH SEAT hero occupies, the seat determines HOW MANY PLAYERS ACT BEFORE HERO, and every
 * spot probability falls out of that count and the pool's own measured aggression. There is no
 * `if (pos === 'LATE') weight *= x` anywhere below and there must never be.
 *
 * The structural families in `structureOf` are used to GROUP CELLS FOR REPORTING and never to
 * compute a number. That distinction is the same one the engine draws between a label as an
 * output and a label as an input.
 */

import { HERO_SEAT_BY_POS, POS_CATEGORIES, PREFLOP_ACTION_ORDER, BANDS } from './entryMap.mjs';

export const STRATEGY_PROFILE_SCHEMA_VERSION = 1;

/** Total two-card combinations in a 52-card deck. */
export const TOTAL_COMBOS = 1326;

/**
 * How many of the 1,326 combos a hand class covers.
 *
 * A PAIR is 6, a suited class 4, an offsuit class 12 — which is why an offsuit class is worth
 * three times a suited one in any frequency-weighted sum, and why "AKs is a fold" costs a third
 * of what "AKo is a fold" costs even though the first sounds worse.
 */
export const handClassCombos = (handClass) => {
  if (handClass.length === 2) return 6;
  return handClass.endsWith('s') ? 4 : 12;
};

export const handClassWeight = (handClass) => handClassCombos(handClass) / TOTAL_COMBOS;

/**
 * How many seats each position category covers at the 9-handed table the map assumes.
 *
 * A NAMED APPROXIMATION. The map evaluated hero at ONE representative seat per category
 * (`HERO_SEAT_BY_POS`), so weighting EARLY by its two seats applies seat 3's numbers to seat 4
 * as well. Seat 4 acts second rather than first and faces one fewer player, so its true spot
 * distribution differs. The error is small next to the ones this profile is looking for, but it
 * is stated rather than absorbed — an approximation nobody wrote down is one nobody can price.
 */
export const positionSeatCounts = () => {
  const counts = Object.fromEntries(POS_CATEGORIES.map((p) => [p, 0]));
  for (const { posCategory } of PREFLOP_ACTION_ORDER) counts[posCategory] += 1;
  return counts;
};

export const positionWeight = (posCategory) =>
  positionSeatCounts()[posCategory] / PREFLOP_ACTION_ORDER.length;

/** Hero's index in the preflop action order — i.e. how many players act before hero. */
export const playersBefore = (posCategory) =>
  PREFLOP_ACTION_ORDER.findIndex((s) => s.seat === HERO_SEAT_BY_POS[posCategory]);

/**
 * The three states hero's first decision can arrive in, and their probabilities.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE THIRD ONE IS THE FINDING
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The map declares two facing-actions: `none` (folded to hero) and `raise`. Between them sits a
 * spot it does not model at all — LIMPED TO HERO, where players have entered without raising.
 * The pool's own numbers say that spot is common: VPIP 28.8% against PFR 13.7% means roughly
 * one player in seven enters WITHOUT raising, and the chance that at least one of them is ahead
 * of hero grows with every seat.
 *
 * `none` is therefore not "hero acts first" — it is the much rarer "nobody ahead of hero played
 * at all". Reading the map's `none` cells as covering every unraised pot silently inflates its
 * coverage, which is the same failure mode as a Coverage Census that omits its zeros.
 *
 * FIRST-ORDER, AND SAID SO. `(1 - p)^k` treats the k players ahead as independent draws from
 * the pool's marginal rates. They are not: a raise ahead suppresses everyone behind it, and
 * position correlates with aggression. This is a frequency weighting rather than a decision, so
 * first-order is adequate — but it means these numbers are the right SHAPE and not exact, and
 * no conclusion here should turn on a few percentage points.
 *
 * @param {number} k - players acting before hero
 * @param {Object} pool - `{ vpip, pfr }` as proportions
 */
export const spotProbabilities = (k, { vpip, pfr }) => {
  const noEntry = (1 - vpip) ** k;      // nobody ahead played at all
  const noRaise = (1 - pfr) ** k;       // nobody ahead raised
  return {
    foldedToHero: noEntry,
    limpedNoRaise: Math.max(0, noRaise - noEntry),
    facingRaise: 1 - noRaise,
  };
};

/** The map's facing-action for a spot, or null when the map does not model it. */
export const MODELLED_SPOTS = Object.freeze({ foldedToHero: 'none', facingRaise: 'raise', limpedNoRaise: null });

/**
 * What hero has already posted before acting, in bb.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE MOST CONSEQUENTIAL LINE IN THIS FILE, AND THE EASIEST ONE TO OMIT
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The map's anchor — folding is EV = 0 — is a MARGINAL statement, and it is exactly right for
 * the entry decision: a fold puts no FURTHER money in. But summing marginal gains gives the
 * edge over always folding, not a win rate. A strategy that folds everything scores 0 by that
 * measure while losing 1.5bb per orbit in the real world.
 *
 * At a 9-handed table that omission is worth 1.5bb / 9 hands = 16.7 bb/100 — larger than any
 * plausible win rate, so a report that skipped it would not be slightly optimistic, it would
 * have the SIGN wrong. And the tighter the strategy, the worse the error: the blinds are the
 * one cost folding cannot avoid, which is precisely why a strategy that folds nearly everything
 * is not automatically safe.
 *
 * The walk is handled separately: when the pot is folded around to the big blind there is no
 * entry decision (`BB x none` is structurally unreachable), but hero still wins the small blind.
 * That branch is economics without a decision, so the map correctly has no cell for it and the
 * accounting below has to add it back by hand.
 */
export const POSTED_BB = Object.freeze({ EARLY: 0, MIDDLE: 0, LATE: 0, SB: 0.5, BB: 1 });

/** Pot hero collects when the table folds around to the big blind: both blinds. */
export const WALK_POT_BB = 1.5;

const RANK_ORDER = 'AKQJT98765432';
const rankIndex = (c) => RANK_ORDER.indexOf(c);

/**
 * Structural family of a hand class. FOR GROUPING ONLY — never an input to a number.
 */
export const structureOf = (handClass) => {
  const [hi, lo] = [handClass[0], handClass[1]];
  const paired = hi === lo;
  const suited = handClass.endsWith('s');
  const gap = paired ? 0 : Math.abs(rankIndex(hi) - rankIndex(lo)) - 1;
  const broadway = rankIndex(hi) <= 4 && rankIndex(lo) <= 4;   // both T or better
  return {
    paired,
    suited: paired ? null : suited,
    gap: paired ? null : gap,
    connected: paired ? null : gap === 0,
    broadway,
    family: paired ? 'pair' : `${broadway ? 'broadway' : gap === 0 ? 'connector' : gap <= 2 ? 'gapper' : 'unconnected'}-${suited ? 'suited' : 'offsuit'}`,
  };
};

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Spearman rank correlation.
 *
 * RANK rather than Pearson because the question is ordinal — does this strategy rank hands the
 * way their equity ranks them — and because entry EV is not a linear function of equity and was
 * never meant to be. Ties are averaged, which matters: the map has flat regions.
 */
export const spearman = (xs, ys) => {
  if (xs.length < 3) return null;
  const rank = (vs) => {
    const idx = vs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(vs.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
};

/**
 * Build the profile.
 *
 * @param {Object} map - a loaded entry map (bands already recomputed)
 * @param {Object} pool - `{ vpip, pfr }` as proportions, from the reference pool
 * @param {Object} equityByPos - `EQUITY_VS_OPEN`: basis points per hand class, keyed by position
 * @param {string[]} handLabels - HAND_LABELS, aligned with the equity arrays
 */
export const profileStrategy = (map, pool, equityByPos, handLabels) => {
  const equityOf = (posCategory, handClass) => {
    const arr = equityByPos[posCategory];
    if (!arr) return null;
    const i = handLabels.indexOf(handClass);
    return i === -1 ? null : arr[i] / 10000;
  };

  // A cell is ENTERED by the declared card exactly when its whole interval is above zero.
  // Fringe and unmeasured fold — see the card's rule groups.
  const enters = (cell) => cell.band === BANDS.CLEAR_PLUS;
  // Aggressive entry: opening or 3-betting rather than limping or calling.
  const isAggressive = (cell) => cell.bestAction === 'bet' || cell.bestAction === 'raise';

  const byPosition = {};
  let weightedEntry = 0;
  let weightedAggro = 0;
  let weightedEdge = 0;
  let weightedModelled = 0;
  let weightedAbsolute = 0;
  let weightedBlindCost = 0;
  let weightedWalk = 0;

  for (const posCategory of POS_CATEGORIES) {
    const k = playersBefore(posCategory);
    const spots = spotProbabilities(k, pool);
    const posW = positionWeight(posCategory);
    const cells = map.cells.filter((c) => c.posCategory === posCategory);

    let entryRate = 0;
    let aggroRate = 0;
    let edge = 0;
    let modelled = 0;

    for (const [spot, facingAction] of Object.entries(MODELLED_SPOTS)) {
      const spotP = spots[spot];
      if (facingAction === null) continue;          // the limped hole — counted below, never priced
      const spotCells = cells.filter((c) => c.facingAction === facingAction && c.reachable !== false);
      if (spotCells.length === 0) continue;         // structurally unreachable spot
      modelled += spotP;
      for (const cell of spotCells) {
        const w = spotP * handClassWeight(cell.handClass);
        if (enters(cell)) {
          entryRate += w;
          edge += w * cell.margin;
          if (isAggressive(cell)) aggroRate += w;
        }
      }
    }

    // ── From marginal edge to an actual win rate ──────────────────────────────────────────
    // The blind is posted whether hero plays or not, and no fold recovers it. The walk is added
    // back because it is money with no decision attached, so no cell carries it.
    const posted = POSTED_BB[posCategory];
    const walk = posCategory === 'BB' ? spots.foldedToHero * WALK_POT_BB : 0;
    // The limped spot has no declared rule, so the card abstains. An abstention is not an
    // action; the conservative reading is that hero folds, contributing nothing beyond the
    // blind already counted. This is where the 22% coverage hole shows up in the money.
    const absolute = -posted + walk + edge;

    byPosition[posCategory] = {
      seats: positionSeatCounts()[posCategory],
      playersBefore: k,
      spots,
      // What fraction of this seat's real first decisions the declared domain even contains.
      domainCoverage: modelled,
      unmodelledLimpedShare: spots.limpedNoRaise,
      entryRate,
      aggressiveRate: aggroRate,
      forecastEdgeBB: edge,
      postedBB: posted,
      walkBB: walk,
      absoluteBB: absolute,
    };

    weightedEntry += posW * entryRate;
    weightedAggro += posW * aggroRate;
    weightedEdge += posW * edge;
    weightedModelled += posW * modelled;
    weightedAbsolute += posW * absolute;
    weightedBlindCost += posW * posted;
    weightedWalk += posW * walk;
  }

  // ── Where the weakness lives: within-spot comparison, never pooled across spots ───────────
  // Pooling would let the position mix drive the answer (Simpson's), and position mix is
  // exactly what differs between the families being compared.
  const families = {};
  const pairedVsUnpaired = {};
  for (const cell of map.cells) {
    if (cell.band === null || cell.margin === undefined || cell.margin === null) continue;
    const spotKey = `${cell.posCategory}|${cell.facingAction}`;
    const s = structureOf(cell.handClass);

    (families[s.family] ??= []).push(cell.margin);

    const bucket = (pairedVsUnpaired[spotKey] ??= { paired: [], unpaired: [] });
    bucket[s.paired ? 'paired' : 'unpaired'].push(cell.margin);
  }

  const pairGap = Object.entries(pairedVsUnpaired)
    .filter(([, b]) => b.paired.length >= 3 && b.unpaired.length >= 3)
    .map(([spot, b]) => ({
      spot,
      pairedMean: mean(b.paired),
      unpairedMean: mean(b.unpaired),
      gapBB: mean(b.paired) - mean(b.unpaired),
      n: { paired: b.paired.length, unpaired: b.unpaired.length },
    }))
    .sort((a, b) => b.gapBB - a.gapBB);

  // ── Does the strategy rank hands the way equity ranks them? ───────────────────────────────
  const rankAgreement = [];
  for (const posCategory of POS_CATEGORIES) {
    for (const facingAction of ['none', 'raise']) {
      const cells = map.cells.filter(
        (c) => c.posCategory === posCategory && c.facingAction === facingAction && c.band !== null,
      );
      if (cells.length < 3) continue;
      const eq = cells.map((c) => equityOf(posCategory, c.handClass));
      if (eq.some((e) => e === null)) continue;
      const rho = spearman(eq, cells.map((c) => c.margin));

      // The hands this strategy treats worst RELATIVE to their equity — where a different
      // continuation policy has the most room to move the answer.
      const eqRank = [...cells].sort((a, b) => equityOf(posCategory, b.handClass) - equityOf(posCategory, a.handClass));
      const evRank = [...cells].sort((a, b) => b.margin - a.margin);
      const evPos = new Map(evRank.map((c, i) => [c.cellId, i]));
      const inversions = eqRank
        .map((c, i) => ({ cellId: c.cellId, handClass: c.handClass, drop: evPos.get(c.cellId) - i, equity: equityOf(posCategory, c.handClass), margin: c.margin }))
        .sort((a, b) => b.drop - a.drop)
        .slice(0, 5);

      rankAgreement.push({ posCategory, facingAction, n: cells.length, spearman: rho, worstInversions: inversions });
    }
  }

  // ── Is an unknown a compute problem or an evidence problem? ───────────────────────────────
  const uncertainty = { mcDominant: 0, modelDominant: 0, byBand: {} };
  for (const cell of map.cells) {
    if (cell.band === null) continue;
    const which = cell.modelError > cell.mcError ? 'modelDominant' : 'mcDominant';
    uncertainty[which] += 1;
    ((uncertainty.byBand[cell.band] ??= { mcDominant: 0, modelDominant: 0 }))[which] += 1;
  }

  return {
    schemaVersion: STRATEGY_PROFILE_SCHEMA_VERSION,
    generatedBy: 'scripts/backtest/strategyProfile.mjs',
    isResultCard: false,
    caveat:
      'MODEL SELF-REPORT, NOT A MEASUREMENT. Every figure is the same engine that produced each ' +
      'cell, integrated over how often each cell arises, so it cannot detect an error it was ' +
      'itself computed under. Not a Result Card; does not resolve a comparative claim under ' +
      'ADR-009. The independent number requires WS-326 (play it out against a responsive ' +
      'population) scored against WS-331 (the ceiling of what was available to win).',
    basedOn: {
      policyId: map.continuationPolicy.id,
      engineCommit: map.engineCommit,
      engineDirty: Boolean(map.engineDirty),
      tauBB: map.reporting.tauBB,
      pool,
    },
    headline: {
      entryRate: weightedEntry,
      aggressiveRate: weightedAggro,
      poolVpip: pool.vpip,
      poolPfr: pool.pfr,
      domainCoverage: weightedModelled,
      // The edge over ALWAYS FOLDING. Positive by construction — the card enters only where the
      // model already said the margin clears zero — so this number can never be negative and
      // must never be read as a win rate.
      forecastEdgeBB100: weightedEdge * 100,
      // What folding cannot avoid.
      blindCostBB100: -weightedBlindCost * 100,
      walkBB100: weightedWalk * 100,
      // The win rate the model's own arithmetic implies. Edge minus blinds, plus walks.
      absoluteForecastBB100: weightedAbsolute * 100,
    },
    byPosition,
    familyMargins: Object.fromEntries(
      Object.entries(families)
        .map(([f, xs]) => [f, { n: xs.length, meanBB: mean(xs) }])
        .sort((a, b) => b[1].meanBB - a[1].meanBB),
    ),
    pairGap,
    rankAgreement,
    uncertainty,
  };
};
