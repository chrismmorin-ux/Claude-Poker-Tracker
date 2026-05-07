/**
 * @file Leak rule: hero-bb-defense-width
 *
 * Catalog entry: docs/projects/self-coach-foundation/leak-catalog.md
 *   #hero-bb-defense-width (SHIPPED v1, SPR-031 / WS-146 first claim)
 *
 * Detects when hero defends BB too tight vs single open. BB closes the action
 * with pot-odds discount; under-defending leaks chips. Most documented
 * preflop leak; well-known solver baselines per opener position.
 *
 * Per chris-live-player.md autonomy red lines #5 + #7 — neutral editor's-note
 * tone, no shame copy.
 *
 * Detector design:
 *   - Triggers on situation key matching preflop:none:BIG_BLIND:def:oop:raise:vsopen
 *   - "Defense too tight" = hero's fold rate is HIGHER than the solver
 *     baseline by ≥5pp (overfolding) AND CI lower bound exceeds baseline.
 *   - Mirror direction (over-defending — calling too wide) is its own future
 *     rule; this rule fires only on overfolding.
 *
 * v1 limitations:
 *   - Single solver baseline per opener position (no dynamic by opener size)
 *   - Doesn't split by stack depth or table dynamic
 */

export const rule = {
  id: 'hero-bb-defense-width',
  label: 'BB defense width — fold rate vs single open',
  // Per WS-148 / SPR-033: rule binds to umbrella. Per-opener-position
  // sub-concept resolution arrives when WS-146 v2 splits the rule
  // (situation key gains opener-position axis).
  relatedConceptId: 'bb-defense-cluster',

  threshold: {
    minSampleSize: 30, // AP-SCF-04 floor
    minSeverity: 0.3,
    deltaPP: 0.05,     // 5pp above baseline to fire
  },

  /**
   * Matches preflop:none:BIG_BLIND:def:oop:raise:vsopen:na.
   * Hero is BB defending OOP vs a single preflop raise (vsopen context).
   * The 8th `preflopAggressor` axis is `na` on preflop streets (the action
   * under analysis IS the preflop decision, so the axis isn't applicable).
   */
  matchesBucket(situationKey) {
    if (!situationKey) return false;
    const parts = situationKey.split(':');
    if (parts.length !== 8) return false;
    const [street, , posCategory, isAgg, isIP, facingAction, contextAction, preflopAggressor] = parts;
    return (
      street === 'preflop'
      && posCategory === 'BIG_BLIND'
      && isAgg === 'def'
      && isIP === 'oop'
      && facingAction === 'raise'
      && contextAction === 'vsopen'
      && preflopAggressor === 'na'
    );
  },

  solverBaselineKey(situationKey) {
    return situationKey;
  },

  detect(bucket, baseline) {
    if (!baseline) return null;
    if (bucket.sampleSize < this.threshold.minSampleSize) return null;

    const observedRate = bucket.foldRate;
    const ci = bucket.foldRateCI || { lower: 0, upper: 1, mean: 0 };
    const delta = observedRate - baseline.baseline;

    // Both point-estimate AND CI lower bound must exceed baseline by threshold.
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
      confidence: baseline.confidence ?? 0.85,
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
