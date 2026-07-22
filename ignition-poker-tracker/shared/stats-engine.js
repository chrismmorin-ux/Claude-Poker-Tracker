/**
 * shared/stats-engine.js — HUD stat computation
 *
 * Computes VPIP, PFR, AF, 3-Bet, C-Bet, Fold-to-CBet, and style classification
 * per seat directly from captured hand records' actionSequence arrays.
 *
 * Self-contained — no dependency on the main app's handTimeline system.
 * Field names match the main app's tendencyCalculations.js for exploit engine compatibility.
 */

export const MIN_STYLE_SAMPLE = 20;

// =========================================================================
// SAMPLE-QUALITY TIER (WS-236 / FIND-024)
// =========================================================================
// Categorical quality label for raw capture sample sizes. Vocabulary and
// thresholds mirror the main app's LiveAdviceBar ConfidenceBadge (DP-004)
// so the same words mean the same thing on every surface. Single source —
// do not restate these thresholds at render sites.
//
// Distinct concept-class from the closed 4-tier confidence register in
// render-confidence.js: that register is scoped to engine MODEL outputs
// (shell-spec §III.5); these tiers qualify raw observed-hand counts.

export const SAMPLE_QUALITY_THRESHOLDS = Object.freeze({
  DATA: 15,     // enough observed hands to lean on directly
  PARTIAL: 5,   // directional read only
});                // below PARTIAL → 'EST'

/**
 * @param {number|null|undefined} sampleSize - Observed preflop hand count
 * @returns {'DATA'|'PARTIAL'|'EST'}
 */
export const sampleQualityTier = (sampleSize) => {
  const n = Number(sampleSize) || 0;
  if (n >= SAMPLE_QUALITY_THRESHOLDS.DATA) return 'DATA';
  if (n >= SAMPLE_QUALITY_THRESHOLDS.PARTIAL) return 'PARTIAL';
  return 'EST';
};

// Badge colors mirror LiveAdviceBar (green/amber/grey family) — deliberately
// NOT the --conf-tier-* token set, which belongs to the model-confidence
// concept-class.
export const SAMPLE_QUALITY_COLORS = Object.freeze({
  DATA:    { bg: '#14532d', text: '#22c55e' },
  PARTIAL: { bg: '#422006', text: '#f59e0b' },
  EST:     { bg: '#1f2937', text: '#6b7280' },
});

// =========================================================================
// PER-HAND PREFLOP ANALYSIS
// =========================================================================

/**
 * Analyze the preflop action sequence for a single hand.
 * Returns per-seat preflop context needed for advanced stats.
 *
 * @param {Object[]} actions - Full actionSequence for the hand
 * @returns {{ pfAggressor: number|null, preflopRaiseCount: number,
 *             seatContext: Map<number, { facedRaise, threeBet, foldTo3Bet, limpedPre, limpOpportunity, vpip, pfr }> }}
 */
export const analyzePreflopContext = (actions) => {
  const preflopActions = actions
    .filter(a => a.street === 'preflop')
    .sort((a, b) => a.order - b.order);

  let raiseCount = 0;
  let pfAggressor = null;
  let lastRaiserSeat = null;
  const seatContext = new Map();

  for (const a of preflopActions) {
    const seat = a.seat;
    if (!seatContext.has(seat)) {
      seatContext.set(seat, {
        facedRaise: false,
        threeBet: false,
        foldTo3Bet: false,
        limpedPre: false,
        limpOpportunity: false,
        vpip: false,
        pfr: false,
        _actedBefore: false,
      });
    }
    const ctx = seatContext.get(seat);

    // Canonical parity (tendencyCalculations.didPlayerFaceRaise): a seat
    // "faced a raise" ONLY if a raise happened before its FIRST preflop
    // action. A raiser who later faces a re-raise is NOT a facedRaise —
    // that would inflate the 3-bet-opportunity denominator. Pinned by
    // src/utils/__tests__/statsEngineParity.seam.test.js (WS-236).
    if (!ctx._actedBefore) {
      ctx.facedRaise = raiseCount >= 1;
      ctx._actedBefore = true;
    }

    // Limp opportunity: seat can voluntarily enter the pot preflop before any raise
    if (raiseCount === 0 && (a.action === 'call' || a.action === 'raise')) {
      ctx.limpOpportunity = true;
    }

    if (a.action === 'raise') {
      ctx.vpip = true;
      ctx.pfr = true;
      // Canonical 3-bet: raise by a seat whose FIRST action already faced a
      // raise (extract3BetStats: threeBet = facedRaise && some(RAISE)).
      if (ctx.facedRaise) {
        ctx.threeBet = true;
      }
      raiseCount++;
      lastRaiserSeat = seat;
      pfAggressor = seat;
    } else if (a.action === 'call') {
      ctx.vpip = true;
      if (raiseCount === 0) {
        ctx.limpedPre = true;
      }
    } else if (a.action === 'bet') {
      ctx.vpip = true;
    } else if (a.action === 'fold') {
      // Canonical fold-to-3bet (extract3BetStats: facedRaise && !threeBet
      // && folded). NOTE the canonical semantics are broader than the name:
      // any fold while facing a raise (incl. fold-to-open) counts when the
      // seat never raised. Parity pins the extension to that definition;
      // whether the definition itself is right is a domain-correctness
      // question flagged at WS-236 close-out.
      if (ctx.facedRaise && !ctx.pfr) {
        ctx.foldTo3Bet = true;
      }
    }
  }

  return { pfAggressor, preflopRaiseCount: raiseCount, seatContext };
};

/**
 * Analyze the flop action sequence for c-bet tracking.
 *
 * @param {Object[]} actions - Full actionSequence for the hand
 * @param {number|null} pfAggressor - Seat of the preflop aggressor
 * @returns {{ cbetFired: boolean, seatCbetContext: Map<number, { facedCbet, foldedToCbet }> }}
 */
export const analyzeFlopCbetContext = (actions, pfAggressor) => {
  if (pfAggressor === null) return { cbetFired: false, seatCbetContext: new Map() };

  const flopActions = actions
    .filter(a => a.street === 'flop')
    .sort((a, b) => a.order - b.order);

  let cbetFired = false;
  let firstBetSeat = null;
  const seatCbetContext = new Map();

  for (const a of flopActions) {
    const seat = a.seat;
    if (!seatCbetContext.has(seat)) {
      seatCbetContext.set(seat, { facedCbet: false, foldedToCbet: false });
    }

    if (!cbetFired && a.action === 'bet' && seat === pfAggressor) {
      cbetFired = true;
      firstBetSeat = seat;
      continue;
    }

    if (cbetFired && seat !== firstBetSeat) {
      const ctx = seatCbetContext.get(seat);
      ctx.facedCbet = true;
      if (a.action === 'fold') {
        ctx.foldedToCbet = true;
      }
    }
  }

  return { cbetFired, seatCbetContext };
};

// =========================================================================
// PER-SEAT STAT COMPUTATION
// =========================================================================

/**
 * Compute raw stat counters for a single physical seat across all hands.
 *
 * @param {Object[]} hands - Array of captured hand records
 * @param {number} seatNumber - Physical seat number from protocol
 * @returns {Object} Raw stat counters
 */
export const computeSeatStats = (hands, seatNumber) => {
  const stats = {
    handsSeenPreflop: 0,
    vpipCount: 0,
    pfrCount: 0,
    totalBets: 0,
    totalRaises: 0,
    totalCalls: 0,
    facedRaisePreflop: 0,
    threeBetCount: 0,
    foldTo3BetCount: 0,
    pfAggressorFlops: 0,
    cbetCount: 0,
    facedCbet: 0,
    foldedToCbet: 0,
    limpCount: 0,
    limpOpportunities: 0,
  };

  for (const hand of hands) {
    const actions = hand.gameState?.actionSequence;
    if (!Array.isArray(actions)) continue;

    const seatActions = actions.filter(a => a.seat === seatNumber);
    if (seatActions.length === 0) continue;

    const preflopActions = seatActions.filter(a => a.street === 'preflop');
    if (preflopActions.length === 0) continue;

    stats.handsSeenPreflop++;

    const { pfAggressor, seatContext } = analyzePreflopContext(actions);
    const ctx = seatContext.get(seatNumber);

    if (ctx) {
      if (ctx.vpip) stats.vpipCount++;
      if (ctx.pfr) stats.pfrCount++;
      if (ctx.facedRaise) stats.facedRaisePreflop++;
      if (ctx.threeBet) stats.threeBetCount++;
      if (ctx.foldTo3Bet) stats.foldTo3BetCount++;
      if (ctx.limpedPre) stats.limpCount++;
      if (ctx.limpOpportunity) stats.limpOpportunities++;
    }

    const foldedPreflop = preflopActions.some(a => a.action === 'fold');
    const sawFlop = !foldedPreflop && actions.some(a =>
      a.seat === seatNumber && (a.street === 'flop' || a.street === 'turn' || a.street === 'river')
    );

    if (pfAggressor === seatNumber && sawFlop) {
      stats.pfAggressorFlops++;
      const { cbetFired } = analyzeFlopCbetContext(actions, pfAggressor);
      if (cbetFired) stats.cbetCount++;
    }

    if (pfAggressor !== null && pfAggressor !== seatNumber && sawFlop) {
      const { cbetFired, seatCbetContext } = analyzeFlopCbetContext(actions, pfAggressor);
      if (cbetFired) {
        const cbetCtx = seatCbetContext.get(seatNumber);
        if (cbetCtx?.facedCbet) {
          stats.facedCbet++;
          if (cbetCtx.foldedToCbet) stats.foldedToCbet++;
        }
      }
    }

    const postflopActions = seatActions.filter(a =>
      a.street === 'flop' || a.street === 'turn' || a.street === 'river'
    );
    for (const a of postflopActions) {
      if (a.action === 'bet') stats.totalBets++;
      else if (a.action === 'raise') stats.totalRaises++;
      else if (a.action === 'call') stats.totalCalls++;
    }
  }

  return stats;
};

// =========================================================================
// DERIVED PERCENTAGES
// =========================================================================

/**
 * Derive display percentages from raw counters.
 *
 * @param {Object} stats - Output of computeSeatStats()
 * @returns {Object} Derived percentages
 */
export const derivePercentages = (stats) => {
  if (!stats) return { vpip: null, pfr: null, af: null, threeBet: null, cbet: null, foldToCbet: null, sampleSize: 0 };

  const sampleSize = stats.handsSeenPreflop;

  const vpip = sampleSize > 0
    ? Math.round((stats.vpipCount / sampleSize) * 100)
    : null;

  const pfr = sampleSize > 0
    ? Math.round((stats.pfrCount / sampleSize) * 100)
    : null;

  const totalAggressive = stats.totalBets + stats.totalRaises;
  const af = stats.totalCalls > 0
    ? Math.round((totalAggressive / stats.totalCalls) * 10) / 10
    : totalAggressive > 0 ? Infinity : null;

  const threeBet = stats.facedRaisePreflop > 0
    ? Math.round((stats.threeBetCount / stats.facedRaisePreflop) * 100)
    : null;

  const cbet = stats.pfAggressorFlops > 0
    ? Math.round((stats.cbetCount / stats.pfAggressorFlops) * 100)
    : null;

  const foldToCbet = stats.facedCbet > 0
    ? Math.round((stats.foldedToCbet / stats.facedCbet) * 100)
    : null;

  return { vpip, pfr, af, threeBet, cbet, foldToCbet, sampleSize };
};

// =========================================================================
// STYLE CLASSIFICATION
// =========================================================================

/**
 * Classify player style from percentages.
 *
 * @param {Object} pct - Output of derivePercentages()
 * @returns {string|null} Style label or null if insufficient data
 */
export const classifyStyle = (pct) => {
  if (!pct || pct.sampleSize < MIN_STYLE_SAMPLE) return null;

  const { vpip, pfr, af } = pct;
  if (vpip === null || pfr === null) return null;

  if (vpip > 40) return 'Fish';
  if (vpip > 30 && pfr > 20) return 'LAG';
  if (vpip > 30 && pfr < 10) return 'LP';
  if (vpip < 15 && pfr < 10) return 'Nit';
  if (vpip >= 20 && vpip <= 30 && pfr >= 15 && pfr <= 25 && af !== null && af > 1.5) return 'Reg';
  if (vpip >= 15 && vpip <= 30 && pfr >= 10 && pfr <= 25) return 'TAG';

  return 'Unknown';
};

// =========================================================================
// CONVENIENCE: ALL SEATS AT ONCE
// =========================================================================

/**
 * Compute stats for all physical seats found in the hand data.
 *
 * @param {Object[]} hands - Array of captured hand records
 * @returns {Object} { [physicalSeat]: { vpip, pfr, af, threeBet, cbet, foldToCbet, style, sampleSize, raw } }
 */
export const computeAllSeatStats = (hands) => {
  const seatSet = new Set();
  for (const hand of hands) {
    const actions = hand.gameState?.actionSequence;
    if (!Array.isArray(actions)) continue;
    for (const a of actions) {
      if (typeof a.seat === 'number') seatSet.add(a.seat);
    }
  }

  const result = {};
  for (const seat of seatSet) {
    const raw = computeSeatStats(hands, seat);
    const pct = derivePercentages(raw);
    const style = classifyStyle(pct);

    result[seat] = {
      ...pct,
      style,
      raw,
    };
  }

  return result;
};

// =========================================================================
// STYLE COLORS (matches main app's designTokens.js)
// =========================================================================

export const STYLE_COLORS = {
  Fish:    { bg: 'rgba(127, 29, 29, 0.5)', text: '#fca5a5' },
  LAG:     { bg: 'rgba(124, 45, 18, 0.5)', text: '#fdba74' },
  TAG:     { bg: 'rgba(20, 83, 45, 0.5)',  text: '#86efac' },
  Nit:     { bg: 'rgba(30, 58, 138, 0.5)', text: '#93c5fd' },
  LP:      { bg: 'rgba(113, 63, 18, 0.5)', text: '#fde68a' },
  Reg:     { bg: 'rgba(88, 28, 135, 0.5)', text: '#d8b4fe' },
  Unknown: { bg: '#374151',                 text: '#9ca3af' },
};
