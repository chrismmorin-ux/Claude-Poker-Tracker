/**
 * @file Leak rule: hero-oop-3bet-underfold
 *
 * Catalog entry: docs/projects/self-coach-foundation/leak-catalog.md
 *   #hero-oop-3bet-underfold — preflop fold-equity gap closure (SPR-046 / WS-146 third claim)
 *
 * Detects when hero defends OOP from the blinds too wide vs a preflop 3bet
 * after flat-calling an open. Hero called the open from SB/BB, then a third
 * player 3bet (or original opener 3bet a re-isolation). Continuing OOP
 * without initiative at high SPR is the worst structural spot in NLHE; the
 * solver wants hero folding most flat-calling range here. Calling too wide
 * bleeds chips post-flop OOP across multiple barrel streets.
 *
 * This is the FIRST UNDER-FOLD rule in the SCF catalog — mirror direction of
 * the over-fold rules shipped to date (hero-ip-cbet-overfold, heroBbDefenseWidth,
 * hero-oop-cbet-overfold, hero-flop-vs-donk-misresponse, hero-pf-3bet-overfold).
 * Detection logic is the inversion of the over-fold pattern: fires when
 * observedRate is BELOW baseline by ≥5pp AND CI upper bound is BELOW baseline.
 *
 * Detector design:
 *   - Triggers on situation keys matching preflop:none:{SMALL_BLIND|BIG_BLIND}:def:oop:raise:vs3bet:na
 *   - Position scope is SB + BB only for v1. CO defending OOP after flat-
 *     calling open is a documented catalog scenario but the position
 *     categorizer emits 'MIDDLE' (9max) or 'LATE' (6max) for CO seats — not
 *     'CO' literal. Adding CO support requires either a position-categorizer
 *     change or matching MIDDLE/LATE here, which broadens scope beyond
 *     squeeze-defense. Deferred to v2.
 *   - Single baseline per blind position. Confidence 0.75 because squeeze
 *     dynamics + 3bet sizing both vary the right defense width.
 *
 * v1 limitations:
 *   - SB + BB only (no CO/blind-cold-call extensions)
 *   - No 3bet-sizing axis (smaller 3bets justify wider defense)
 *   - No squeezer-stack-depth / squeezer-style adjustment
 */

export const rule = {
  id: 'hero-oop-3bet-underfold',
  label: 'OOP 3bet defense width (calling too wide post-flat)',
  // Per WS-148 / SPR-033 + WS-146 third claim: rule binds to umbrella;
  // per-position sub-concepts resolved via tierConceptMap.SITUATION_KEY_TO_CONCEPT.
  relatedConceptId: 'oop-3bet-defense-cluster',

  threshold: {
    minSampleSize: 30, // AP-SCF-04 floor
    minSeverity: 0.3,
    deltaPP: 0.05,     // 5pp BELOW baseline to fire (under-fold direction)
  },

  /**
   * Matches preflop:none:{SMALL_BLIND|BIG_BLIND}:def:oop:raise:vs3bet:na.
   * Hero is in SB/BB defending OOP, faces a raise classified as vs3bet
   * (raisesBefore=2 — the open + the 3bet). Hero called the open prior;
   * facingAction='raise' + contextAction='vs3bet' captures this.
   */
  matchesBucket(situationKey) {
    if (!situationKey) return false;
    const parts = situationKey.split(':');
    if (parts.length !== 8) return false;
    const [street, , posCategory, isAgg, isIP, facingAction, contextAction, preflopAggressor] = parts;
    return (
      street === 'preflop'
      && (posCategory === 'SMALL_BLIND' || posCategory === 'BIG_BLIND')
      && isAgg === 'def'
      && isIP === 'oop'
      && facingAction === 'raise'
      && contextAction === 'vs3bet'
      && preflopAggressor === 'na'
    );
  },

  solverBaselineKey(situationKey) {
    return situationKey; // identity — single baseline per (SB|BB) key
  },

  detect(bucket, baseline) {
    if (!baseline) return null;
    if (bucket.sampleSize < this.threshold.minSampleSize) return null;

    const observedRate = bucket.foldRate;
    const ci = bucket.foldRateCI || { lower: 0, upper: 1, mean: 0 };

    // Under-fold direction (mirror of over-fold rules):
    //   delta = baseline - observedRate (positive when underfolding)
    //   delta >= threshold (rate ≥5pp below baseline)
    //   ci.upper < baseline (CI upper bound stays below baseline →
    //                       observed rate is meaningfully under-fold,
    //                       not just noise around the baseline)
    const delta = baseline.baseline - observedRate;
    if (delta < this.threshold.deltaPP) return null;
    if (ci.upper >= baseline.baseline) return null;

    const ciWidth = ci.upper - ci.lower;
    const severity = Math.min(1, Math.max(0, delta * 2 * (1 - ciWidth / 2)));
    if (severity < this.threshold.minSeverity) return null;

    return {
      leakRuleId: this.id,
      label: this.label,
      situationKey: bucket.situationKey,
      observedRate,
      ciLower: ci.lower,
      ciUpper: ci.upper,
      sampleSize: bucket.sampleSize,
      solverBaseline: baseline.baseline,
      relatedConceptId: this.relatedConceptId,
      severity,
      confidence: baseline.confidence ?? 0.75,
      evidence: {
        metric: 'foldRate',
        observed: observedRate,
        profitable: baseline.baseline,
        delta, // positive = underfold magnitude (baseline - observed)
      },
      lastUpdatedAt: Date.now(),
    };
  },
};
