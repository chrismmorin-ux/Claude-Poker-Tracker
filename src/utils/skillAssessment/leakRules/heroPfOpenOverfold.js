/**
 * @file Leak rule: hero-pf-open-overfold
 *
 * Catalog entry: docs/projects/self-coach-foundation/leak-catalog.md
 *   #hero-pf-open-overfold (SHIPPED v1, SPR-109 / WS-146 sixth claim)
 *   — DEFERRED since SPR-046; resolved by the SPR-108 decision-bucket substrate.
 *
 * Detects when hero opens TOO TIGHT first-in (RFI open frequency below the
 * position's solver range size). When folded to hero, every hand that should
 * open-raise but gets folded leaves EV uncontested — the blinds keep their
 * chips for free and hero misses the highest-frequency profit source in the
 * game (stealing). Under-opening is the most common recreational preflop leak
 * after the inverse (opening too wide); it caps hero's win-rate by forfeiting
 * fold equity hand after hand.
 *
 * ── FIRST UNDER-frequency decision-bucket rule ──
 * Like the other decision-bucket rules, this reads the parallel DECISION
 * bucket (`bucketType: 'decision'`) so an open FREQUENCY over the RFI decision
 * space (open vs fold, first-in) is computable — the 8-axis action buckets
 * route an RFI fold and an RFI open to different `contextAction` keys, which
 * is exactly why this rule was DEFERRED at SPR-046. See
 * deriveSituationKey.deriveRfiDecision().
 *
 * Unlike hero-multiway-bluff-frequency and hero-turn-barrel-frequency (which
 * fire on OVER-frequency), this rule fires on UNDER-frequency: the leak is a
 * LOW open rate. This establishes the under-frequency detection pattern for
 * the decision-bucket type, mirroring how hero-oop-3bet-underfold established
 * the under-FOLD pattern for the action-bucket type.
 *
 * v1 scope (per leak-catalog):
 *   - RFI decision only (folded to hero, first-in; limp/iso excluded).
 *   - Open-positions only (EARLY / MIDDLE / LATE / BUTTON); blinds excluded.
 *   - Position-split baselines (RFI range size differs sharply by seat).
 *   - Fires on UNDER-opening only; over-opening (raising too wide) is its own
 *     future rule (hero-pf-open-too-wide) with different remediation.
 *
 * Per CLAUDE.md anti-patterns:
 *   - n≥30 floor enforced in detect().
 *   - position label is NOT a decision input — it only selects which hardcoded
 *     baseline the OBSERVED frequency is compared against (first-principles:
 *     observed vs reference, no label-as-input).
 *   - Claim copy stays factual (CD-5): surfaces render "open frequency X% over
 *     N hands; solver baseline ~26%" — never graded ("you play too tight") or
 *     scored.
 */

const RFI_KEY_PREFIX = 'preflop:rfi-decision:';

export const rule = {
  id: 'hero-pf-open-overfold',
  label: 'Preflop open frequency (RFI)',

  // This rule consumes the parallel aggression-frequency decision buckets,
  // not the 8-axis action buckets. The detector routes by this field.
  bucketType: 'decision',

  // Umbrella binds here; per-position sub-concept resolution happens via
  // tierConceptMap.SITUATION_KEY_TO_CONCEPT (baselines are position-split).
  relatedConceptId: 'rfi-discipline-cluster',

  threshold: {
    minSampleSize: 30, // AP-SCF-04 floor — DO NOT bypass
    minSeverity: 0.3,  // SCF G4 default
    deltaPP: 0.05,     // 5 percentage points BELOW baseline to fire (under-opening)
  },

  /**
   * Matches any position's RFI decision bucket.
   * Key shape: `preflop:rfi-decision:{EARLY|MIDDLE|LATE|BUTTON}` (emitted by
   * deriveRfiDecision when the pot is folded to hero, first-in, from an open
   * position). Blinds and limp/iso decisions are not emitted, so they never
   * reach this rule.
   */
  matchesBucket(situationKey) {
    return typeof situationKey === 'string' && situationKey.startsWith(RFI_KEY_PREFIX);
  },

  solverBaselineKey(situationKey) {
    return situationKey; // identity — each position resolves to its own baseline
  },

  /**
   * Fires when hero's observed RFI open frequency falls BELOW the solver
   * baseline by the threshold AND the credible-interval upper bound is also
   * below the baseline (defense against false-positive on noisy data).
   *
   * NOTE the polarity: this is an UNDER-frequency rule (LOW is the leak), the
   * mirror of the over-frequency barrel/multiway rules. The metric is
   * `aggressFrequency` (open rate). The gate is the inverse: delta is measured
   * as baseline − observed, and the CI UPPER bound (not lower) must clear the
   * baseline for the under-open to be demonstrable.
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
    const delta = baseline.baseline - observedRate; // positive when UNDER-opening

    // Both point estimate AND CI upper bound must fall below the baseline by
    // the threshold — hero is demonstrably under-opening, not within noise.
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
        metric: 'openFrequency',
        observed: observedRate,
        profitable: baseline.baseline,
        delta,
      },
      lastUpdatedAt: Date.now(),
    };
  },
};
