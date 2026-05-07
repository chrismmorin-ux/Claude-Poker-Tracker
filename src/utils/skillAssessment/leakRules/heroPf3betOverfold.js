/**
 * @file Leak rule: hero-pf-3bet-overfold
 *
 * Catalog entry: docs/projects/self-coach-foundation/leak-catalog.md
 *   #hero-pf-3bet-overfold — preflop fold-equity gap closure (SPR-046 / WS-146 third claim)
 *
 * Detects when hero opens preflop and over-folds to a 3bet. Hero opened the
 * pot, so hero already has equity invested + a strong opening range; folding
 * too often to villain's 3bet allows the 3bettor to print money against the
 * open. Mirror direction (under-folding, calling/4betting too wide) is its
 * own future rule and not detected here.
 *
 * Sprint pivot context (SPR-046, founder-ratified 2026-05-07): originally
 * scoped pair was hero-pf-open-overfold + hero-oop-3bet-underfold. Discovered
 * during execution that hero-pf-open-overfold has a structural blocker — the
 * accumulator (deriveSituationKey:DERIVE_CONTEXT_ACTION) buckets RFI fold
 * (`limp` contextAction) and RFI open (`open` contextAction) into different
 * keys, so fold-rate over the RFI decision space can't be computed from a
 * single bucket. Pivoted to this rule (hero-pf-3bet-overfold) which is
 * structurally clean: vs3bet fold + call land in the same bucket; 4bets land
 * in a separate `:4bet:na` bucket. fold-rate-given-non-4bet is well-defined.
 *
 * Detector design:
 *   - Triggers on situation keys matching preflop:none:{EARLY|MIDDLE|LATE|BUTTON}:agg:?:raise:vs3bet:na
 *   - "Over-folding" = hero's vs3bet fold rate exceeds the solver baseline by
 *     ≥5pp AND CI lower bound exceeds baseline.
 *   - Single per-position baseline (isIP axis normalized by solverBaselineKey).
 *     This v1 simplification trades baseline precision for fewer entries; per-
 *     isIP and per-3bettor-style splits are v2 expansions.
 *
 * v1 limitations:
 *   - Single baseline per opener position (no 3bettor-position splits)
 *   - No 3bet-sizing axis (smaller 3bets justify wider continue ranges)
 *   - No 3bettor-style adjustment (TAGs underbluff; fish overbluff)
 */

export const rule = {
  id: 'hero-pf-3bet-overfold',
  label: 'Folding to preflop 3bets too often (post-open)',
  // Per WS-148 / SPR-033 + WS-146 third claim: rule binds to umbrella; per-
  // position sub-concepts resolved via tierConceptMap.SITUATION_KEY_TO_CONCEPT
  // (4 sub-concepts, one per opener position; both isIP variants resolve to
  // the same sub-concept since the v1 baseline is position-only).
  relatedConceptId: 'pf-3bet-defense-cluster',

  threshold: {
    minSampleSize: 30, // AP-SCF-04 floor
    minSeverity: 0.3,
    deltaPP: 0.05,     // 5pp above baseline to fire
  },

  /**
   * Matches preflop:none:{EARLY|MIDDLE|LATE|BUTTON}:agg:{ip|oop}:raise:vs3bet:na.
   * Hero is preflop aggressor (opened) facing a 3bet (vs3bet contextAction).
   * isIP axis is permissive — both 'ip' (hero opened from non-blind, 3bettor
   * is blind) and 'oop' (hero opened from earlier seat, 3bettor squeezes from
   * a later seat or BTN) are valid bucket configurations.
   */
  matchesBucket(situationKey) {
    if (!situationKey) return false;
    const parts = situationKey.split(':');
    if (parts.length !== 8) return false;
    const [street, , posCategory, isAgg, isIP, facingAction, contextAction, preflopAggressor] = parts;
    return (
      street === 'preflop'
      && (posCategory === 'EARLY' || posCategory === 'MIDDLE'
          || posCategory === 'LATE' || posCategory === 'BUTTON')
      && isAgg === 'agg'
      && (isIP === 'ip' || isIP === 'oop')
      && facingAction === 'raise'
      && contextAction === 'vs3bet'
      && preflopAggressor === 'na'
    );
  },

  /**
   * Normalize isIP to 'ip' for baseline lookup so a single per-position entry
   * serves both ip and oop bucket configurations. v2 will split per-isIP if
   * solver data justifies the precision (typical OOP-vs-3bet penalty is small
   * compared to baseline variance).
   */
  solverBaselineKey(situationKey) {
    if (!situationKey) return situationKey;
    const parts = situationKey.split(':');
    if (parts.length !== 8) return situationKey;
    parts[4] = 'ip'; // isIP axis (5th of 8, 0-indexed → 4)
    return parts.join(':');
  },

  detect(bucket, baseline) {
    if (!baseline) return null;
    if (bucket.sampleSize < this.threshold.minSampleSize) return null;

    const observedRate = bucket.foldRate;
    const ci = bucket.foldRateCI || { lower: 0, upper: 1, mean: 0 };
    const delta = observedRate - baseline.baseline;

    // Over-fold direction: both point-estimate AND CI lower bound must
    // exceed baseline by threshold.
    if (delta < this.threshold.deltaPP) return null;
    if (ci.lower <= baseline.baseline) return null;

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
      confidence: baseline.confidence ?? 0.80,
      evidence: {
        metric: 'foldRate',
        observed: observedRate,
        profitable: baseline.baseline,
        delta,
      },
      lastUpdatedAt: Date.now(),
    };
  },
};
