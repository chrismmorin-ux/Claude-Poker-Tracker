/**
 * @file Leak rule: hero-turn-barrel-frequency
 *
 * Catalog entry: docs/projects/self-coach-foundation/leak-catalog.md
 *   #hero-turn-barrel-frequency (SHIPPED v1, SPR-109 / WS-146 sixth claim)
 *
 * Detects when hero fires the turn TOO OFTEN (over-barrels) after cbetting
 * the flop as the preflop aggressor in a heads-up pot. A second barrel needs
 * to fold out the portion of villain's flop-calling range that floated or
 * called with marginal made hands; most turn cards don't sufficiently improve
 * hero's range or threaten villain's to justify barreling at a high frequency.
 * Recreationals over-barrel — they fire again automatically after cbetting,
 * bleeding chips when the turn bricks and villain's continuing range is
 * already ahead.
 *
 * ── Decision-bucket (aggression-frequency) rule ──
 * Like hero-multiway-bluff-frequency, this rule reads the parallel DECISION
 * bucket (`bucketType: 'decision'`) the accumulator emits, which aggregates
 * hero's barrel-vs-check choice into one bucket so a FREQUENCY is computable.
 * The 8-axis action buckets can't do this — a turn bet and a turn check route
 * to different `contextAction` values. See deriveSituationKey.deriveTurnBarrelDecision().
 *
 * v1 scope (per leak-catalog):
 *   - Turn barrel decision only (river triple-barrel is a future entry).
 *   - Heads-up only (`turn:barrel-decision:hu`); the `mw` bucket is a separate
 *     future entry. Coarse single baseline across textures/runouts maximizes
 *     sample; equity-shifter-card splits are v2.
 *   - Fires on OVER-barreling (barrel frequency above baseline). The mirror
 *     (under-barreling, giving up on good runouts) is a separate future rule.
 *
 * Per CLAUDE.md anti-patterns:
 *   - n≥30 floor enforced in detect().
 *   - decision labels are NOT decision inputs — the rule compares an OBSERVED
 *     frequency to a hardcoded solver baseline (first-principles: observed vs
 *     reference, no label-as-input).
 *   - Claim copy stays factual (CD-5): surfaces render "turn barrel frequency
 *     X% over N hands; solver baseline ~50%" — never graded or scored.
 */

export const rule = {
  id: 'hero-turn-barrel-frequency',
  label: 'Turn double-barrel frequency',

  // This rule consumes the parallel aggression-frequency decision buckets,
  // not the 8-axis action buckets. The detector routes by this field.
  bucketType: 'decision',

  // Single coarse umbrella for v1 (no sub-concept resolution yet — the rule
  // fires on the coarse `hu` bucket). Children (good-runout / bad-runout) are
  // registered in tierConceptMap ahead of the v2 equity-shifter split.
  relatedConceptId: 'turn-barrel-discipline-cluster',

  threshold: {
    minSampleSize: 30, // AP-SCF-04 floor — DO NOT bypass
    minSeverity: 0.3,  // SCF G4 default
    deltaPP: 0.05,     // 5 percentage points ABOVE baseline to fire (over-barreling)
  },

  /**
   * Matches the heads-up turn barrel decision bucket only.
   * Key shape: `turn:barrel-decision:hu` (emitted by deriveTurnBarrelDecision
   * when hero is the preflop aggressor, bet the flop, and is first-in on the
   * turn with exactly one villain remaining). The `mw` bucket is intentionally
   * NOT matched (a multiway turn barrel rule would be a separate future entry).
   */
  matchesBucket(situationKey) {
    return situationKey === 'turn:barrel-decision:hu';
  },

  solverBaselineKey(situationKey) {
    return situationKey; // identity — baseline key matches the decision key
  },

  /**
   * Fires when hero's observed turn barrel frequency exceeds the solver
   * baseline by the threshold AND the credible-interval lower bound also
   * clears the baseline (defense against false-positive on noisy data).
   *
   * NOTE the polarity: this is an OVER-frequency rule (high is the leak), like
   * hero-multiway-bluff-frequency. The metric is `aggressFrequency` (barrel
   * rate), not `foldRate`.
   *
   * @param {object} bucket - { situationKey, aggressCount, passCount, sampleSize, aggressFrequency, aggressFrequencyCI: {lower, upper, mean} }
   * @param {object|null} baseline - { baseline, source, confidence, lastValidatedAt }
   * @returns {object|null}
   */
  detect(bucket, baseline) {
    if (!baseline) return null;
    if (bucket.sampleSize < this.threshold.minSampleSize) return null;

    const observedRate = bucket.aggressFrequency;
    const ci = bucket.aggressFrequencyCI || { lower: 0, upper: 1, mean: 0 };
    const delta = observedRate - baseline.baseline;

    // Both point estimate AND CI lower bound must exceed the baseline by the
    // threshold — hero is demonstrably over-barreling, not within noise.
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
      confidence: baseline.confidence ?? 0.70,
      evidence: {
        metric: 'barrelFrequency',
        observed: observedRate,
        profitable: baseline.baseline,
        delta,
      },
      lastUpdatedAt: Date.now(),
    };
  },
};
