/**
 * @file Leak rule: hero-multiway-bluff-frequency
 *
 * Catalog entry: docs/projects/self-coach-foundation/leak-catalog.md
 *   #hero-multiway-bluff-frequency (SHIPPED v1, SPR-108 / WS-146 fifth claim)
 *
 * Detects when hero continuation-bets the flop TOO OFTEN as the preflop
 * aggressor in a multiway (3+ way) pot. Multiway fold equity drops
 * multiplicatively — to fold everyone, each opponent must fold, so the
 * combined fold probability is the PRODUCT of individual fold rates (see
 * HERO_STATE_DESIGN.md §7.4 multiway model: multiwayFoldPct = ∏ foldᵢ).
 * Bluff EV therefore collapses, and the profitable cbet frequency drops from
 * ~70% heads-up to ~10-25% multiway. HU-style continuation in multiway pots
 * is a classic recreational leak — it bleeds chips because the bluffs almost
 * never get through.
 *
 * ── FIRST decision-bucket (aggression-frequency) rule in the catalog ──
 * Unlike the 6 fold-rate rules, this rule reads from the parallel DECISION
 * bucket (`bucketType: 'decision'`) the accumulator emits, which aggregates
 * hero's cbet-vs-check choice into one bucket so a FREQUENCY is computable.
 * The 8-axis action buckets can't do this — a cbet and a check route to
 * different `contextAction` values (the same blocker that deferred
 * `hero-pf-open-overfold`). See deriveSituationKey.deriveCbetDecision().
 *
 * The player-count dimension (`hu` vs `mw`) lives in the decision-bucket key
 * (`flop:cbet-decision:mw`), NOT in the 8-axis action key — so the 6 shipped
 * fold-rate rules and their calibrations are completely untouched.
 *
 * v1 scope (per leak-catalog):
 *   - Flop cbet decision only (turn/river barrel-frequency are future entries).
 *   - Coarse single baseline across textures/positions (maximizes the rarer
 *     multiway sample). Texture/position + 3-way-vs-4-way+ splits are v2.
 *   - Fires on OVER-betting only (cbet frequency above baseline). The mirror
 *     (under-cbetting multiway value) is a separate future rule.
 *
 * Per CLAUDE.md anti-patterns:
 *   - n≥30 floor enforced in detect().
 *   - archetype/decision labels are NOT decision inputs — the rule compares an
 *     OBSERVED frequency to a hardcoded solver baseline (first-principles:
 *     observed vs reference, no label-as-input).
 *   - Claim copy stays factual (CD-5): surfaces render
 *     "multiway flop cbet frequency X% over N hands; solver baseline ~25%" —
 *     never graded ("you bluff too much") or scored.
 */

export const rule = {
  id: 'hero-multiway-bluff-frequency',
  label: 'Multiway flop cbet frequency',

  // This rule consumes the parallel aggression-frequency decision buckets,
  // not the 8-axis action buckets. The detector routes by this field.
  bucketType: 'decision',

  // Single coarse umbrella for v1 (no sub-concept resolution yet — the rule
  // fires on the coarse `mw` bucket). Children (3way / 4way+) are registered
  // in tierConceptMap ahead of the v2 playersRemaining split.
  relatedConceptId: 'multiway-cbet-discipline-cluster',

  threshold: {
    minSampleSize: 30, // AP-SCF-04 floor — DO NOT bypass
    minSeverity: 0.3,  // SCF G4 default
    deltaPP: 0.05,     // 5 percentage points ABOVE baseline to fire (over-betting)
  },

  /**
   * Matches the multiway flop cbet decision bucket only.
   * Key shape: `flop:cbet-decision:mw` (emitted by deriveCbetDecision when
   * hero is the preflop aggressor, first-in on the flop, with ≥2 villains
   * still in the pot). The `hu` bucket is intentionally NOT matched (a
   * heads-up cbet-frequency rule would be a separate future entry).
   */
  matchesBucket(situationKey) {
    return situationKey === 'flop:cbet-decision:mw';
  },

  solverBaselineKey(situationKey) {
    return situationKey; // identity — baseline key matches the decision key
  },

  /**
   * Fires when hero's observed multiway cbet frequency exceeds the solver
   * baseline by the threshold AND the credible-interval lower bound also
   * clears the baseline (defense against false-positive on noisy data).
   *
   * NOTE the polarity: this is an OVER-frequency rule (high is the leak),
   * the opposite of the fold-rate over-fold rules. The metric is
   * `aggressFrequency` (cbet rate), not `foldRate`.
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
    // threshold — hero is demonstrably over-continuing, not within noise.
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
        metric: 'cbetFrequency',
        observed: observedRate,
        profitable: baseline.baseline,
        delta,
      },
      lastUpdatedAt: Date.now(),
    };
  },
};
