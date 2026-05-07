/**
 * @file Leak rule: hero-oop-cbet-overfold
 *
 * Catalog entry: docs/projects/self-coach-foundation/leak-catalog.md
 *   #hero-oop-cbet-overfold (SHIPPED v1, SPR-040 / WS-146 second claim)
 *
 * Detects when hero defends too tight to flop continuation bets when out
 * of position from the blinds. OOP fold rate is structurally higher than
 * IP (worse equity realization without position) — but folding *beyond*
 * the OOP-calibrated baseline still gives villain auto-profit on bluff
 * frequency.
 *
 * Mirror of `hero-ip-cbet-overfold`; structurally near-identical except:
 *   - Position axis: SMALL_BLIND / BIG_BLIND (was LATE / BUTTON)
 *   - isIP axis: oop (was ip)
 *   - Baselines ~10pp higher than IP equivalent (OOP equity realization)
 *
 * v1 scope (per leak-catalog):
 *   - Covers SB/BB defending OOP (SMALL_BLIND + BIG_BLIND position categories)
 *   - 8th `preflopAggressor` axis filters to `pfc` (hero called preflop;
 *     this rule fires on cbet defense, not donk defense)
 *   - Single solver baseline per (texture, position) — no villain-style
 *     precision; no SRP-vs-3BP split
 *
 * v2/v3 expansions (deferred per catalog notes):
 *   - Split SRP vs 3BP (3-bet-pot dynamics differ — fewer bluffs in 3BP)
 *   - Split by villain style (Fish overfold less; TAG overfold more)
 *   - Board-class precision beyond dry/medium/wet
 */

export const rule = {
  id: 'hero-oop-cbet-overfold',
  label: 'OOP cbet defense — fold-to-cbet rate',
  // Per WS-148 / SPR-033: rule binds to umbrella; per-cell sub-concept
  // resolved via tierConceptMap.SITUATION_KEY_TO_CONCEPT (6 sub-concepts).
  relatedConceptId: 'oop-cbet-defense-cluster',

  threshold: {
    minSampleSize: 30,    // AP-SCF-04 floor
    minSeverity: 0.3,     // SCF G4 default
    deltaPP: 0.05,        // 5 percentage points above baseline to fire
  },

  /**
   * Matches flop:*:SMALL_BLIND:def:oop:bet:vsBet:pfc + flop:*:BIG_BLIND:def:oop:bet:vsBet:pfc.
   * Hero is OOP from the blinds, defending (def), facing a bet (facingAction=bet,
   * contextAction=vsBet) on the flop, AND was a preflop CALLER (pfc).
   */
  matchesBucket(situationKey) {
    if (!situationKey) return false;
    const parts = situationKey.split(':');
    if (parts.length !== 8) return false;
    const [street, , posCategory, isAgg, isIP, facingAction, contextAction, preflopAggressor] = parts;
    return (
      street === 'flop'
      && (posCategory === 'SMALL_BLIND' || posCategory === 'BIG_BLIND')
      && isAgg === 'def'
      && isIP === 'oop'
      && facingAction === 'bet'
      && contextAction === 'vsBet'
      && preflopAggressor === 'pfc'
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
