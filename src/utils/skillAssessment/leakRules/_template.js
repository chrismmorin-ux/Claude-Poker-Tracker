/**
 * @file Authoring template for hero-leak rules.
 *
 * To add a new rule:
 *   1. Look up the next entry in docs/projects/self-coach-foundation/leak-catalog.md
 *      by coverage gap + complexity tier (Simple > Medium > Complex)
 *   2. Copy this file to leakRules/<rule-id>.js
 *   3. Replace placeholders below
 *   4. Add solver baseline entries to ../solverBaselines.js
 *   5. Author tests at ../__tests__/<rule-id>.test.js
 *   6. Update catalog: status PLANNED → SHIPPED, add ship_sprint
 *
 * Each rule auto-registers via heroLeakDetector's import.meta.glob loader.
 * No detector code changes are needed.
 *
 * Per CLAUDE.md anti-patterns:
 *   - DO NOT bypass the n≥30 floor (enforced via threshold.minSampleSize)
 *   - DO NOT use leak rule IDs as decision inputs to other rules
 *   - DO NOT add point-estimate-only displays (always include CI)
 */

export const rule = {
  // Unique kebab-case id matching catalog entry id.
  id: 'TEMPLATE-RULE-ID',

  // Human-readable label for display surfaces (CD-5 field 1).
  label: 'TEMPLATE — what the rule detects',

  // Maps to lessonContent for the Drill this affordance.
  relatedConceptId: 'TEMPLATE-CONCEPT-ID',

  // Threshold gates (CLAUDE.md principle 2 + AP-SCF-04 + SCF G4 spec).
  threshold: {
    minSampleSize: 30,    // AP-SCF-04 floor — DO NOT bypass
    minSeverity: 0.3,     // SCF G4 default — rules can override
  },

  /**
   * Returns true if this rule applies to a given situation key.
   * Used by the detector to filter which buckets to evaluate.
   *
   * @param {string} situationKey - 8-axis format (extended SPR-040):
   *   street:texture:posCategory:isAgg:isIP:facingAction:contextAction:preflopAggressor
   *   The 8th axis is `pfa` (hero raised preflop), `pfc` (hero called preflop),
   *   or `na` (preflop streets — the action under analysis IS the preflop decision).
   * @returns {boolean}
   */
  matchesBucket(situationKey) {
    return false; // override
  },

  /**
   * Returns the solver baseline lookup key for this situation. Usually
   * identity (the situation key itself), but rules can transform.
   */
  solverBaselineKey(situationKey) {
    return situationKey;
  },

  /**
   * Detect whether this rule fires for a given bucket + baseline. Returns
   * null if no leak; returns the leak object otherwise.
   *
   * The leak object MUST contain CD-5's 4 mandatory fields plus the metadata
   * downstream surfaces need to render the badge + expanded card.
   *
   * @param {object} bucket - { situationKey, foldCount, callCount, raiseCount, sampleSize, foldRate, foldRateCI: {lower, upper, mean} }
   * @param {object|null} baseline - { baseline, source, confidence, lastValidatedAt } from solverBaselines or null
   * @returns {object|null}
   */
  detect(bucket, baseline) {
    if (!baseline) return null;
    if (bucket.sampleSize < this.threshold.minSampleSize) return null;

    // Example: detect overfolding (rate higher than baseline + threshold).
    // Override per rule. Both point-estimate AND CI must agree to fire (defense
    // against false-positive on noisy data).
    const observedRate = bucket.foldRate;
    const ci = bucket.foldRateCI || { lower: 0, upper: 1, mean: 0 };
    const delta = observedRate - baseline.baseline;
    const ciAgrees = ci.lower > baseline.baseline; // CI lower bound exceeds baseline → meaningful

    if (delta < 0.05 || !ciAgrees) return null; // 5pp threshold + CI agreement

    // Severity = how much above baseline + how confident we are.
    // Rules can override the formula. v1 default: severity = delta * (1 - CI width / 2).
    const ciWidth = ci.upper - ci.lower;
    const severity = Math.min(1, delta * (1 - ciWidth / 2));
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
      confidence: baseline.confidence ?? 0.5,
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
