/**
 * @file Leak rule: hero-ip-cbet-overfold
 *
 * Catalog entry: docs/projects/self-coach-foundation/leak-catalog.md
 *   #hero-ip-cbet-overfold (SHIPPED v1, SPR-030 / WS-145)
 *
 * Detects when hero defends too tight to flop continuation bets IP from late
 * position. Folding too much IP gives villain auto-profit on their bluff
 * frequency — common live-pool leak.
 *
 * Spec source: docs/design/audits/2026-05-02-gate4-design-self-coach-foundation.md
 *   §SCF-G4-S2 example badge:
 *     "Hero IP cbet defense — fold-to-cbet rate 52% [38%, 66%] over 30 hands.
 *      Solver baseline: 38%. Sample threshold: 30 hands. Related drill: cbet-defense."
 *
 * v1 scope (per leak-catalog):
 *   - Covers BTN/CO/HJ defending IP (LATE + BUTTON position categories)
 *   - Excludes blind defense (different dynamic — see hero-bb-cbet-defense)
 *   - Single solver baseline per (texture, position) — no villain-style precision
 *
 * v2/v3 expansions (deferred per catalog notes):
 *   - Split by villain style (Fish overfold less; TAG overfold more)
 *   - Board-class precision beyond dry/medium/wet
 */

export const rule = {
  id: 'hero-ip-cbet-overfold',
  label: 'IP cbet defense — fold-to-cbet rate',
  // Per WS-148 / SPR-033: rule binds to umbrella; per-cell sub-concept
  // is resolvable via tierConceptMap.SITUATION_KEY_TO_CONCEPT when the
  // badge wants to navigate to the most-specific lesson.
  relatedConceptId: 'cbet-defense-cluster',

  threshold: {
    minSampleSize: 30,    // AP-SCF-04 floor
    minSeverity: 0.3,     // SCF G4 default
    deltaPP: 0.05,        // 5 percentage points above baseline to fire
  },

  /**
   * Matches flop:*:LATE:def:ip:bet:vsBet + flop:*:BUTTON:def:ip:bet:vsBet.
   * Hero is in position (BTN/CO/HJ via LATE/BUTTON), defending (def), facing
   * a bet (facingAction=bet, contextAction=vsBet) on the flop.
   */
  matchesBucket(situationKey) {
    if (!situationKey) return false;
    const parts = situationKey.split(':');
    if (parts.length !== 7) return false;
    const [street, , posCategory, isAgg, isIP, facingAction, contextAction] = parts;
    return (
      street === 'flop'
      && (posCategory === 'LATE' || posCategory === 'BUTTON')
      && isAgg === 'def'
      && isIP === 'ip'
      && facingAction === 'bet'
      && contextAction === 'vsBet'
    );
  },

  solverBaselineKey(situationKey) {
    return situationKey; // identity — baseline keys match situation keys directly
  },

  detect(bucket, baseline) {
    if (!baseline) return null;
    if (bucket.sampleSize < this.threshold.minSampleSize) return null;

    const observedRate = bucket.foldRate;
    const ci = bucket.foldRateCI || { lower: 0, upper: 1, mean: 0 };
    const delta = observedRate - baseline.baseline;

    // Both point-estimate AND CI lower bound must exceed baseline by threshold —
    // defense against false-positive on noisy data.
    if (delta < this.threshold.deltaPP) return null;
    if (ci.lower <= baseline.baseline) return null;

    // Severity: bigger delta + tighter CI → higher severity.
    // Capped at 1.0; minimum 0.0.
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
