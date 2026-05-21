/**
 * equityCalculator.js - Monte Carlo hand-vs-range equity
 *
 * Simulates equity by dealing out remaining board cards and comparing
 * hand evaluations. Uses chunked async to avoid blocking the UI.
 */

import { TOTAL_CARDS } from './cardParser';
import { bestFiveFromSeven } from './handEvaluator';
import { enumerateCombos } from './rangeMatrix';

/**
 * Build a deck in-place, filtering by a Uint8Array dead-card lookup.
 * Reuses the provided array to avoid allocations.
 * @param {number[]} deckBuf - Pre-allocated buffer (length >= 52)
 * @param {Uint8Array} deadLookup - 52-element boolean lookup
 * @returns {number} Number of live cards written into deckBuf
 */
const buildDeckFast = (deckBuf, deadLookup) => {
  let n = 0;
  for (let i = 0; i < TOTAL_CARDS; i++) {
    if (!deadLookup[i]) deckBuf[n++] = i;
  }
  return n;
};

/**
 * Fisher-Yates partial shuffle — only shuffle first `count` elements.
 * @param {number[]} arr
 * @param {number} len - Number of live elements in arr
 * @param {number} count - How many elements to shuffle to the front
 */
const partialShuffle = (arr, len, count) => {
  for (let i = 0; i < count && i < len - 1; i++) {
    const j = i + Math.floor(Math.random() * (len - i));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
};

/**
 * Build cumulative weight distribution for weighted random sampling.
 * @param {Array<{weight: number}>} combos
 * @returns {{ cumWeights: Float64Array, totalWeight: number }}
 */
const buildCumWeights = (combos) => {
  const cumWeights = new Float64Array(combos.length);
  let total = 0;
  for (let i = 0; i < combos.length; i++) {
    total += combos[i].weight;
    cumWeights[i] = total;
  }
  return { cumWeights, totalWeight: total };
};

/**
 * Sample a combo index using cumulative weights.
 */
const sampleCombo = (cumWeights, totalWeight) => {
  const r = Math.random() * totalWeight;
  let lo = 0, hi = cumWeights.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumWeights[mid] < r) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/**
 * Run a batch of equity trials synchronously.
 * Uses pre-allocated buffers to minimize GC pressure.
 * @returns {{ win: number, tie: number, lose: number, skipped: number }}
 */
const runBatch = (heroCards, combos, cumWeights, totalWeight, board, batchSize) => {
  let win = 0, tie = 0, lose = 0, skipped = 0;
  const boardLen = board.length;
  const cardsNeeded = 5 - boardLen;

  // Pre-allocate reusable buffers
  const deadLookup = new Uint8Array(TOTAL_CARDS);
  const deckBuf = new Array(TOTAL_CARDS);
  const sevenBuf = new Array(7); // for bestFiveFromSeven

  // Pre-set static dead cards (hero + board) — copied per trial instead of fill(0) + re-set
  const baseDead = new Uint8Array(TOTAL_CARDS);
  const h0 = heroCards[0], h1 = heroCards[1];
  baseDead[h0] = 1;
  baseDead[h1] = 1;
  for (let b = 0; b < boardLen; b++) baseDead[board[b]] = 1;

  // Pre-fill static part of sevenBuf (board cards at positions 2..2+boardLen-1)
  for (let b = 0; b < boardLen; b++) sevenBuf[2 + b] = board[b];

  for (let t = 0; t < batchSize; t++) {
    const ci = sampleCombo(cumWeights, totalWeight);
    const villain = combos[ci];
    const v0 = villain.card1, v1 = villain.card2;

    // Skip if villain cards conflict with hero
    if (v0 === h0 || v0 === h1 || v1 === h0 || v1 === h1) {
      skipped++;
      continue;
    }

    // Copy static dead cards and add villain cards (faster than fill(0) + 4-6 sets)
    deadLookup.set(baseDead);
    deadLookup[v0] = 1;
    deadLookup[v1] = 1;

    // Build deck and partial-shuffle only the cards we need
    const deckLen = buildDeckFast(deckBuf, deadLookup);
    partialShuffle(deckBuf, deckLen, cardsNeeded);

    // Build 7-card hands in-place
    sevenBuf[0] = h0;
    sevenBuf[1] = h1;
    // Board cards already set above (static)
    for (let d = 0; d < cardsNeeded; d++) sevenBuf[2 + boardLen + d] = deckBuf[d];

    const heroScore = bestFiveFromSeven(sevenBuf);

    sevenBuf[0] = v0;
    sevenBuf[1] = v1;
    // board + dealt cards already in positions 2-6

    const villainScore = bestFiveFromSeven(sevenBuf);

    if (heroScore > villainScore) win++;
    else if (heroScore < villainScore) lose++;
    else tie++;
  }

  return { win, tie, lose, skipped };
};

/**
 * Build result object from accumulated trial counts.
 * Computes equity, confidence interval (Welford), and timing.
 */
const buildResult = (totalWin, totalTie, totalLose, welfordM2, start, convergedEarly = false) => {
  const total = totalWin + totalTie + totalLose;
  const elapsed = Math.round(performance.now() - start);
  const equity = total > 0 ? Math.round(((totalWin + totalTie * 0.5) / total) * 1000) / 1000 : 0.5;

  // Welford variance → 95% confidence interval
  let stdDev = 0, ciHalf = 0;
  if (total > 1) {
    const variance = welfordM2 / (total - 1);
    stdDev = Math.sqrt(variance);
    ciHalf = Math.round(1.96 * (stdDev / Math.sqrt(total)) * 1000) / 1000;
  }

  return {
    equity,
    win: totalWin,
    tie: totalTie,
    lose: totalLose,
    trials: total,
    elapsed,
    stdDev: Math.round(stdDev * 1000) / 1000,
    ciHalf,
    ciLow: Math.max(0, Math.round((equity - ciHalf) * 1000) / 1000),
    ciHigh: Math.min(1, Math.round((equity + ciHalf) * 1000) / 1000),
    convergedEarly,
  };
};

/**
 * Deterministic win/tie/lose fractions for a single hero-vs-villain matchup on
 * a 3–5 card board, by exhaustive runout enumeration. No RNG — pure card math.
 * Returned fractions sum to 1.0 (river is a single deterministic outcome).
 * Returns null when the two hands share a card or collide with the board.
 *
 * @param {number[]} heroCards - [c0, c1] encoded hole cards
 * @param {number[]} villainCards - [c0, c1] encoded hole cards
 * @param {number[]} board - 3, 4, or 5 encoded community cards
 * @returns {{ win: number, tie: number, lose: number }|null}
 */
const comboOutcome = (heroCards, villainCards, board) => {
  const [h0, h1] = heroCards;
  const [v0, v1] = villainCards;
  if (v0 === h0 || v0 === h1 || v1 === h0 || v1 === h1) return null;
  const dead = new Set([h0, h1, v0, v1, ...board]);
  if (dead.size !== 4 + board.length) return null; // duplicate / board collision
  const cardsNeeded = 5 - board.length;

  if (cardsNeeded === 0) {
    const hScore = bestFiveFromSeven([h0, h1, ...board]);
    const vScore = bestFiveFromSeven([v0, v1, ...board]);
    if (hScore > vScore) return { win: 1, tie: 0, lose: 0 };
    if (hScore === vScore) return { win: 0, tie: 1, lose: 0 };
    return { win: 0, tie: 0, lose: 1 };
  }

  let win = 0, tie = 0, lose = 0, count = 0;
  const remaining = [];
  for (let c = 0; c < TOTAL_CARDS; c++) if (!dead.has(c)) remaining.push(c);

  if (cardsNeeded === 1) {
    for (let i = 0; i < remaining.length; i++) {
      count++;
      const board5 = [...board, remaining[i]];
      const hScore = bestFiveFromSeven([h0, h1, ...board5]);
      const vScore = bestFiveFromSeven([v0, v1, ...board5]);
      if (hScore > vScore) win++; else if (hScore === vScore) tie++; else lose++;
    }
  } else {
    // cardsNeeded === 2 (flop): enumerate every turn+river pair
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        count++;
        const board5 = [...board, remaining[i], remaining[j]];
        const hScore = bestFiveFromSeven([h0, h1, ...board5]);
        const vScore = bestFiveFromSeven([v0, v1, ...board5]);
        if (hScore > vScore) win++; else if (hScore === vScore) tie++; else lose++;
      }
    }
  }
  if (count === 0) return null;
  return { win: win / count, tie: tie / count, lose: lose / count };
};

/**
 * Deterministic exact hero equity for a single hero-vs-villain-combo matchup on
 * a 3–5 card board (ties counted as 0.5). Pure exhaustive enumeration — no RNG,
 * so the same inputs always yield the same output (INV-RL-DETERMINISM).
 *
 * This is the single source of per-combo equity truth for the Range Lab cache
 * (`rangeEngine/equityCache.js`) and the LSW↔RL parity invariant (WS-206).
 *
 * @param {number[]} heroCards - [c0, c1] encoded hole cards
 * @param {number[]} villainCards - [c0, c1] encoded hole cards
 * @param {number[]} board - 3, 4, or 5 encoded community cards
 * @returns {number} hero equity in [0, 1], or NaN if the matchup is illegal
 *                   (shared card or board collision)
 */
export const exactComboEquity = (heroCards, villainCards, board) => {
  if (board.length < 3 || board.length > 5) {
    throw new RangeError(`exactComboEquity requires a 3-5 card board, got ${board.length}`);
  }
  const o = comboOutcome(heroCards, villainCards, board);
  return o === null ? NaN : o.win + 0.5 * o.tie;
};

/**
 * Exact equity calculation for sparse ranges (≤20 combos on turn/river).
 * Enumerates all remaining runout cards deterministically — no MC variance.
 * Returns the same shape as handVsRange for seamless integration.
 */
const exactEnumerateEquity = (heroCards, combos, board) => {
  const start = performance.now();
  const [h0, h1] = heroCards;

  let totalWin = 0, totalTie = 0, totalLose = 0, totalWeight = 0;

  for (const combo of combos) {
    if (combo.card1 === h0 || combo.card1 === h1 || combo.card2 === h0 || combo.card2 === h1) continue;
    const w = combo.weight;
    if (w < 0.001) continue;

    const o = comboOutcome(heroCards, [combo.card1, combo.card2], board);
    if (o === null) continue;

    totalWeight += w;
    totalWin += w * o.win;
    totalTie += w * o.tie;
    totalLose += w * o.lose;
  }

  const elapsed = performance.now() - start;
  if (totalWeight === 0) {
    return Promise.resolve({ equity: 1.0, win: 0, tie: 0, lose: 0, trials: 0, elapsed,
      stdDev: 0, ciHalf: 0, ciLow: 1.0, ciHigh: 1.0, convergedEarly: true });
  }

  const equity = (totalWin + totalTie * 0.5) / totalWeight;
  return Promise.resolve({
    equity,
    win: totalWin / totalWeight,
    tie: totalTie / totalWeight,
    lose: totalLose / totalWeight,
    trials: combos.length,
    elapsed,
    stdDev: 0,
    ciHalf: 0,
    ciLow: equity,
    ciHigh: equity,
    convergedEarly: true,
  });
};

/**
 * Calculate hand-vs-range equity using Monte Carlo simulation.
 * Runs in async chunks to avoid blocking the UI thread.
 * Fast path: exact enumeration for sparse ranges (≤20 combos on turn/river).
 *
 * @param {number[]} heroCards - 2 encoded hero cards
 * @param {Float64Array} villainRange - 13x13 range grid
 * @param {number[]} board - Encoded board cards (0-5)
 * @param {{ trials?: number, batchSize?: number, convergenceThreshold?: number, minTrials?: number }} options
 * @returns {Promise<{ equity: number, win: number, tie: number, lose: number, trials: number, elapsed: number, stdDev: number, ciHalf: number, ciLow: number, ciHigh: number, convergedEarly: boolean }>}
 */
export const handVsRange = (heroCards, villainRange, board = [], options = {}) => {
  const {
    trials = 5000,
    batchSize = 500,
    convergenceThreshold = 0.02,
    minTrials = 200,
  } = options;

  return new Promise((resolve) => {
    const start = performance.now();

    // Build dead cards from hero + board
    const deadCards = [...heroCards, ...board];
    const combos = enumerateCombos(villainRange, deadCards);

    if (combos.length === 0) {
      resolve({ equity: 1.0, win: 0, tie: 0, lose: 0, trials: 0, elapsed: 0,
        stdDev: 0, ciHalf: 0, ciLow: 1.0, ciHigh: 1.0, convergedEarly: false });
      return;
    }

    // Fast path: exact enumeration for sparse ranges on turn/river (no MC variance)
    if (combos.length <= 20 && board.length >= 4) {
      exactEnumerateEquity(heroCards, combos, board).then(resolve);
      return;
    }

    const { cumWeights, totalWeight } = buildCumWeights(combos);

    let totalWin = 0, totalTie = 0, totalLose = 0, totalSkipped = 0;
    let effectiveTrials = 0;

    // Welford online variance tracking (per-trial equity: win=1.0, tie=0.5, lose=0.0)
    let welfordMean = 0, welfordM2 = 0;

    const processBatch = () => {
      const remaining = trials - effectiveTrials;
      if (remaining <= 0) {
        resolve(buildResult(totalWin, totalTie, totalLose, welfordM2, start));
        return;
      }

      // Adaptive batch sizing: inflate by observed skip rate
      const skipRate = totalSkipped / Math.max(1, effectiveTrials + totalSkipped);
      const inflated = Math.ceil(remaining / Math.max(0.1, 1 - skipRate));
      const size = Math.min(batchSize, inflated);

      const result = runBatch(heroCards, combos, cumWeights, totalWeight, board, size);

      // Update Welford accumulators for each outcome category
      const batchOutcomes = [
        { value: 1.0, count: result.win },
        { value: 0.5, count: result.tie },
        { value: 0.0, count: result.lose },
      ];
      for (const { value, count } of batchOutcomes) {
        for (let i = 0; i < count; i++) {
          effectiveTrials++;
          const delta = value - welfordMean;
          welfordMean += delta / effectiveTrials;
          const delta2 = value - welfordMean;
          welfordM2 += delta * delta2;
        }
      }

      totalWin += result.win;
      totalTie += result.tie;
      totalLose += result.lose;
      totalSkipped += result.skipped;

      // Early convergence check (relative threshold near equity extremes)
      if (effectiveTrials >= minTrials && effectiveTrials > 1) {
        const variance = welfordM2 / (effectiveTrials - 1);
        const ciH = 1.96 * Math.sqrt(variance / effectiveTrials);
        // Use relative threshold near equity 0/1 to prevent premature convergence
        const currentEquity = (totalWin + totalTie * 0.5) / effectiveTrials;
        const relativeCI = (currentEquity > 0.05 && currentEquity < 0.95)
          ? ciH / Math.max(currentEquity, 1 - currentEquity)
          : ciH;
        if (relativeCI < convergenceThreshold) {
          resolve(buildResult(totalWin, totalTie, totalLose, welfordM2, start, true));
          return;
        }
      }

      if (effectiveTrials >= trials) {
        resolve(buildResult(totalWin, totalTie, totalLose, welfordM2, start));
      } else {
        setTimeout(processBatch, 0);
      }
    };

    // Start first batch
    setTimeout(processBatch, 0);
  });
};

/**
 * Run a batch of multi-villain equity trials synchronously.
 * Per trial: sample one combo per villain range, reject if any cards conflict,
 * deal remaining board, score hero + each villain, attribute hero outcome
 * (win / tie-with-k-villains / lose) and accumulate fractional equity.
 *
 * Hero outcome value per trial:
 *   - WIN  (heroScore > all villain scores)        → 1.0
 *   - TIE  (heroScore === max, k villains tied)    → 1 / (1 + k)
 *   - LOSE (heroScore < max villain score)         → 0.0
 *
 * @returns {{ win, tie, lose, skipped, totalEquityContrib, perVillainBeats: Int32Array, tieByK: Int32Array }}
 */
const runBatchMW = (heroCards, villainCombosArr, cumWeightsArr, totalWeightsArr, board, batchSize) => {
  const N = villainCombosArr.length;
  let win = 0, tie = 0, lose = 0, skipped = 0;
  let totalEquityContrib = 0;
  const boardLen = board.length;
  const cardsNeeded = 5 - boardLen;

  const deadLookup = new Uint8Array(TOTAL_CARDS);
  const deckBuf = new Array(TOTAL_CARDS);
  const sevenBuf = new Array(7);
  const villainCardsBuf = new Array(N * 2);
  const villainScores = new Array(N);
  const perVillainBeats = new Int32Array(N);
  const tieByK = new Int32Array(N + 1);

  const baseDead = new Uint8Array(TOTAL_CARDS);
  const h0 = heroCards[0], h1 = heroCards[1];
  baseDead[h0] = 1;
  baseDead[h1] = 1;
  for (let b = 0; b < boardLen; b++) baseDead[board[b]] = 1;
  for (let b = 0; b < boardLen; b++) sevenBuf[2 + b] = board[b];

  trialLoop:
  for (let t = 0; t < batchSize; t++) {
    // Sample one combo per villain
    for (let i = 0; i < N; i++) {
      const ci = sampleCombo(cumWeightsArr[i], totalWeightsArr[i]);
      const villain = villainCombosArr[i][ci];
      villainCardsBuf[i * 2] = villain.card1;
      villainCardsBuf[i * 2 + 1] = villain.card2;
    }

    // Reject if any villain combo conflicts with hero or another villain
    deadLookup.set(baseDead);
    for (let i = 0; i < N; i++) {
      const v0 = villainCardsBuf[i * 2];
      const v1 = villainCardsBuf[i * 2 + 1];
      if (deadLookup[v0] || deadLookup[v1]) {
        skipped++;
        continue trialLoop;
      }
      deadLookup[v0] = 1;
      deadLookup[v1] = 1;
    }

    // Deal remaining board
    const deckLen = buildDeckFast(deckBuf, deadLookup);
    partialShuffle(deckBuf, deckLen, cardsNeeded);
    for (let d = 0; d < cardsNeeded; d++) sevenBuf[2 + boardLen + d] = deckBuf[d];

    // Score hero
    sevenBuf[0] = h0;
    sevenBuf[1] = h1;
    const heroScore = bestFiveFromSeven(sevenBuf);

    // Score each villain; track max + per-villain beat counts
    let maxVillainScore = -1;
    for (let i = 0; i < N; i++) {
      sevenBuf[0] = villainCardsBuf[i * 2];
      sevenBuf[1] = villainCardsBuf[i * 2 + 1];
      const vScore = bestFiveFromSeven(sevenBuf);
      villainScores[i] = vScore;
      if (vScore > maxVillainScore) maxVillainScore = vScore;
      if (heroScore > vScore) perVillainBeats[i]++;
    }

    if (heroScore > maxVillainScore) {
      win++;
      totalEquityContrib += 1.0;
    } else if (heroScore < maxVillainScore) {
      lose++;
    } else {
      // tied with at least one villain — count how many
      let k = 0;
      for (let i = 0; i < N; i++) {
        if (villainScores[i] === heroScore) k++;
      }
      tie++;
      tieByK[k]++;
      totalEquityContrib += 1.0 / (1 + k);
    }
  }

  return { win, tie, lose, skipped, totalEquityContrib, perVillainBeats, tieByK };
};

/**
 * Build result object for multi-villain trials.
 * Equity is computed directly from accumulated fractional contributions
 * (NOT via tie * 0.5 like buildResult — MW ties can be 1/2, 1/3, ..., 1/N).
 */
const buildResultMW = (totalWin, totalTie, totalLose, totalEquityContrib, welfordM2, perVillainBeats, start, convergedEarly = false) => {
  const total = totalWin + totalTie + totalLose;
  const elapsed = Math.round(performance.now() - start);
  const equity = total > 0 ? Math.round((totalEquityContrib / total) * 1000) / 1000 : 0.5;

  let stdDev = 0, ciHalf = 0;
  if (total > 1) {
    const variance = welfordM2 / (total - 1);
    stdDev = Math.sqrt(variance);
    ciHalf = Math.round(1.96 * (stdDev / Math.sqrt(total)) * 1000) / 1000;
  }

  const perVillainBeatRate = [];
  for (let i = 0; i < perVillainBeats.length; i++) {
    perVillainBeatRate.push({
      index: i,
      beatRate: total > 0 ? Math.round((perVillainBeats[i] / total) * 1000) / 1000 : 0,
    });
  }

  return {
    equity,
    win: totalWin,
    tie: totalTie,
    lose: totalLose,
    trials: total,
    elapsed,
    stdDev: Math.round(stdDev * 1000) / 1000,
    ciHalf,
    ciLow: Math.max(0, Math.round((equity - ciHalf) * 1000) / 1000),
    ciHigh: Math.min(1, Math.round((equity + ciHalf) * 1000) / 1000),
    convergedEarly,
    perVillainBeatRate,
  };
};

/**
 * Calculate hand-vs-multi-range equity using Monte Carlo simulation.
 * Per trial: deal hero (fixed), sample one combo per villain range, deal
 * remaining board, evaluate all (1+N) hands at showdown, attribute hero
 * outcome (win / tie-with-k-villains / lose) as fractional equity.
 *
 * Compared to handVsRange, this is the multiway primitive — it captures
 * the joint dynamics that single-villain 1v1 cannot (e.g. two villains
 * sharing draws to the same outs compresses hero's equity below either
 * 1v1 result). True N-way Monte Carlo, not per-villain composition.
 *
 * Existing `handVsRange` is unchanged — single-villain remains the fast
 * path; this is purely additive for multiway lines.
 *
 * @param {number[]} heroCards - 2 encoded hero cards
 * @param {Float64Array[]} villainRanges - N villain 13×13 range grids
 * @param {number[]} board - Encoded board cards (0-5)
 * @param {{ trials?: number, batchSize?: number, convergenceThreshold?: number, minTrials?: number }} options
 * @returns {Promise<{ equity, win, tie, lose, trials, elapsed, stdDev, ciHalf, ciLow, ciHigh, convergedEarly, perVillainBeatRate: Array<{index, beatRate}> }>}
 */
export const handVsRangesMW = (heroCards, villainRanges, board = [], options = {}) => {
  const {
    trials = 5000,
    batchSize = 500,
    convergenceThreshold = 0.02,
    minTrials = 200,
  } = options;

  return new Promise((resolve) => {
    const start = performance.now();

    if (!Array.isArray(villainRanges) || villainRanges.length === 0) {
      resolve({ equity: 1.0, win: 0, tie: 0, lose: 0, trials: 0, elapsed: 0,
        stdDev: 0, ciHalf: 0, ciLow: 1.0, ciHigh: 1.0, convergedEarly: false, perVillainBeatRate: [] });
      return;
    }

    const deadCards = [...heroCards, ...board];
    const villainCombosArr = villainRanges.map((r) => enumerateCombos(r, deadCards));

    // If any villain has zero combos (range fully blocked by hero/board), hero
    // effectively faces a 1v(N-1) sub-pot — but theoretical correctness of
    // collapsing N-way to (N-1)-way is non-obvious. Return equity:1.0 to mirror
    // existing handVsRange convention for empty ranges.
    if (villainCombosArr.some((combos) => combos.length === 0)) {
      const emptyBeatRate = villainRanges.map((_, index) => ({ index, beatRate: 1.0 }));
      resolve({ equity: 1.0, win: 0, tie: 0, lose: 0, trials: 0, elapsed: 0,
        stdDev: 0, ciHalf: 0, ciLow: 1.0, ciHigh: 1.0, convergedEarly: false, perVillainBeatRate: emptyBeatRate });
      return;
    }

    const cumWeightsArr = [];
    const totalWeightsArr = [];
    for (const combos of villainCombosArr) {
      const { cumWeights, totalWeight } = buildCumWeights(combos);
      cumWeightsArr.push(cumWeights);
      totalWeightsArr.push(totalWeight);
    }

    const N = villainRanges.length;
    let totalWin = 0, totalTie = 0, totalLose = 0, totalSkipped = 0;
    let totalEquityContribAll = 0;
    let effectiveTrials = 0;
    const perVillainBeatsTotal = new Int32Array(N);

    let welfordMean = 0, welfordM2 = 0;

    const processBatch = () => {
      const remaining = trials - effectiveTrials;
      if (remaining <= 0) {
        resolve(buildResultMW(totalWin, totalTie, totalLose, totalEquityContribAll, welfordM2, perVillainBeatsTotal, start));
        return;
      }

      const skipRate = totalSkipped / Math.max(1, effectiveTrials + totalSkipped);
      const inflated = Math.ceil(remaining / Math.max(0.1, 1 - skipRate));
      const size = Math.min(batchSize, inflated);

      const result = runBatchMW(heroCards, villainCombosArr, cumWeightsArr, totalWeightsArr, board, size);

      // Welford accumulation: each trial contributes its fractional equity value.
      // Wins contribute 1.0, ties at k contribute 1/(1+k), losses contribute 0.0.
      const feedWelford = (value, count) => {
        for (let i = 0; i < count; i++) {
          effectiveTrials++;
          const delta = value - welfordMean;
          welfordMean += delta / effectiveTrials;
          const delta2 = value - welfordMean;
          welfordM2 += delta * delta2;
        }
      };

      feedWelford(1.0, result.win);
      for (let k = 1; k <= N; k++) {
        if (result.tieByK[k] > 0) feedWelford(1.0 / (1 + k), result.tieByK[k]);
      }
      feedWelford(0.0, result.lose);

      totalWin += result.win;
      totalTie += result.tie;
      totalLose += result.lose;
      totalSkipped += result.skipped;
      totalEquityContribAll += result.totalEquityContrib;
      for (let i = 0; i < N; i++) perVillainBeatsTotal[i] += result.perVillainBeats[i];

      if (effectiveTrials >= minTrials && effectiveTrials > 1) {
        const variance = welfordM2 / (effectiveTrials - 1);
        const ciH = 1.96 * Math.sqrt(variance / effectiveTrials);
        const currentEquity = totalEquityContribAll / effectiveTrials;
        const relativeCI = (currentEquity > 0.05 && currentEquity < 0.95)
          ? ciH / Math.max(currentEquity, 1 - currentEquity)
          : ciH;
        if (relativeCI < convergenceThreshold) {
          resolve(buildResultMW(totalWin, totalTie, totalLose, totalEquityContribAll, welfordM2, perVillainBeatsTotal, start, true));
          return;
        }
      }

      if (effectiveTrials >= trials) {
        resolve(buildResultMW(totalWin, totalTie, totalLose, totalEquityContribAll, welfordM2, perVillainBeatsTotal, start));
      } else {
        setTimeout(processBatch, 0);
      }
    };

    setTimeout(processBatch, 0);
  });
};
