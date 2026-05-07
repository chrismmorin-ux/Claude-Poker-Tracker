/**
 * @file Leak rule: hero-flop-vs-donk-misresponse
 *
 * Catalog entry: docs/projects/self-coach-foundation/leak-catalog.md
 *   #hero-flop-vs-donk-misresponse (SHIPPED v1, SPR-040 / WS-146 second claim)
 *
 * Detects when hero over-folds to flop donk leads. A "donk lead" is when
 * villain (the preflop caller) bets first on the flop instead of checking
 * to the preflop aggressor (hero). The donk signals a polarized villain
 * range; hero's defense rate should track villain's bluff frequency.
 *
 * v1 scope (single rule, single direction): fires on OVER-FOLDING vs donk
 * (hero folds at a higher rate than the population baseline). Mirror direction
 * (over-calling vs aggressive donker, over-raising vs passive donker) is
 * deferred to v2 when villainProfile.donkStyle is wired into the bucket.
 *
 * Detection requires the 8-axis situation key with `pfa` as the 8th axis
 * (hero was preflop aggressor). This is the architectural feature added in
 * SPR-040 specifically to enable this rule — without it, donk responses
 * collapse into the IP cbet-defense bucket (`hero-ip-cbet-overfold`) and
 * can't be distinguished.
 *
 * Position scope: LATE + BUTTON (hero is IP postflop after raising preflop).
 * SB/BB donks would fire `oop-cbet-overfold` rule's pfa-variant — explicitly
 * not covered here in v1 (catalog entry: future split if needed).
 *
 * Confidence is 0.75 (lower than v1 cbet rule's 0.80) — averaged-across-styles
 * baseline carries more uncertainty than calibrated cbet baselines. Future v2
 * splits by donker style (`passive` vs `aggressive`) when villainProfile data
 * lands in the bucket.
 */

export const rule = {
  id: 'hero-flop-vs-donk-misresponse',
  label: 'Flop vs donk lead — fold-to-donk rate',
  relatedConceptId: 'flop-vs-donk-defense-cluster',

  threshold: {
    minSampleSize: 30,    // AP-SCF-04 floor (donk spots are rarer; the floor
                          // is enforced uniformly to keep the rule honest)
    minSeverity: 0.3,
    deltaPP: 0.05,        // 5pp above baseline to fire
  },

  /**
   * Matches flop:*:LATE:def:ip:bet:vsBet:pfa + flop:*:BUTTON:def:ip:bet:vsBet:pfa.
   * Hero is IP postflop (was preflop aggressor `pfa` from LATE/BUTTON), defending
   * (def), facing a bet (facingAction=bet, contextAction=vsBet) on the flop.
   *
   * The 8th-axis `pfa` is what distinguishes this rule from `hero-ip-cbet-overfold`
   * (`pfc`); both rules fire on the same 7-axis prefix but disjoint 8th axes,
   * so they never overlap.
   */
  matchesBucket(situationKey) {
    if (!situationKey) return false;
    const parts = situationKey.split(':');
    if (parts.length !== 8) return false;
    const [street, , posCategory, isAgg, isIP, facingAction, contextAction, preflopAggressor] = parts;
    return (
      street === 'flop'
      && (posCategory === 'LATE' || posCategory === 'BUTTON')
      && isAgg === 'def'
      && isIP === 'ip'
      && facingAction === 'bet'
      && contextAction === 'vsBet'
      && preflopAggressor === 'pfa'
    );
  },

  solverBaselineKey(situationKey) {
    return situationKey; // identity
  },

  detect(bucket, baseline) {
    if (!baseline) return null;
    if (bucket.sampleSize < this.threshold.minSampleSize) return null;

    const observedRate = bucket.foldRate;
    const ci = bucket.foldRateCI || { lower: 0, upper: 1, mean: 0 };
    const delta = observedRate - baseline.baseline;

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
      confidence: baseline.confidence ?? 0.75,
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
