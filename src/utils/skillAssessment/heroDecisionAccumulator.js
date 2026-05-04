/**
 * @file Hero-side decision accumulator. Buckets hero's own decisions across
 * the hand history by situation key. Generic — rule-agnostic. Detector
 * (heroLeakDetector.js) layers leak rules on top.
 *
 * Mirrors the structure of exploitEngine/decisionAccumulator.js but operates
 * on hero's actions instead of a target villain's. Reuses the situation-key
 * format `street:texture:posCategory:isAgg:isIP:facingAction:contextAction`.
 *
 * Per SCF G4 §SCF-G4-MOD: this lives in skillAssessment/ not exploitEngine/
 * because hero-side detection is a different concern (self-coaching) from
 * villain-side detection (exploit generation), even though situation-key
 * encoding can be shared.
 *
 * Per AP-SCF-04: sample-size floor (n≥30) is enforced by RULES at detect()
 * time, not by the accumulator. Accumulator just counts.
 *
 * Refactored in WS-158 / SPR-031: per-action situation-key derivation
 * extracted to deriveSituationKey.js so live consumer (ReviewPanel) can
 * compute keys identically to the offline accumulator.
 */

import { deriveSituationKey, buildHeroSituationKey, _internals } from './deriveSituationKey.js';

const { NORMALIZE_ACTION } = _internals;

// Re-export buildHeroSituationKey for tests + backward compat.
export { buildHeroSituationKey };

/**
 * Accumulate hero's decisions across a hand history. Returns buckets keyed
 * by situation key with counts + derived stats.
 *
 * @param {object} args
 * @param {Array} args.hands - Array of hand records. Each hand: { gameState: {actionSequence, dealerButtonSeat, mySeat, ...}, cardState: {communityCards, heroCards, ...} }
 * @param {number} args.heroSeat - Hero's seat number (constant across hands for v1; multi-seat support deferred)
 * @returns {object} - { buckets: { [situationKey]: bucketStats }, totalActions, sparseBucketCount, totalBucketCount }
 */
export const accumulateHeroDecisions = ({ hands, heroSeat }) => {
  const buckets = {};
  let totalActions = 0;

  if (!Array.isArray(hands) || !heroSeat) {
    return { buckets, totalActions: 0, sparseBucketCount: 0, totalBucketCount: 0 };
  }

  for (const hand of hands) {
    if (!hand?.gameState?.actionSequence) continue;
    const actionSequence = hand.gameState.actionSequence;
    const buttonSeat = hand.gameState.dealerButtonSeat;
    const totalPlayers = Object.keys(hand.gameState.players || {}).length || 6;

    // Process only hero's actions in this hand.
    const heroActions = actionSequence.filter((a) => Number(a.seat) === Number(heroSeat));
    for (const heroAction of heroActions) {
      totalActions += 1;

      const situationKey = deriveSituationKey({
        hand,
        actionEntry: heroAction,
        heroSeat,
        buttonSeat,
        totalPlayers,
      });
      if (!situationKey) continue;

      if (!buckets[situationKey]) {
        buckets[situationKey] = {
          situationKey,
          foldCount: 0,
          callCount: 0,
          raiseCount: 0,
          checkCount: 0,
          betCount: 0,
          sampleSize: 0,
        };
      }
      const bucket = buckets[situationKey];
      bucket.sampleSize += 1;
      const verb = NORMALIZE_ACTION(heroAction.action);
      if (verb === 'fold') bucket.foldCount += 1;
      else if (verb === 'call') bucket.callCount += 1;
      else if (verb === 'raise') bucket.raiseCount += 1;
      else if (verb === 'check') bucket.checkCount += 1;
      else if (verb === 'bet') bucket.betCount += 1;
    }
  }

  // Compute derived stats per bucket: rate + credible interval (Wilson approximation).
  for (const key of Object.keys(buckets)) {
    const b = buckets[key];
    b.foldRate = b.sampleSize > 0 ? b.foldCount / b.sampleSize : 0;
    b.callRate = b.sampleSize > 0 ? b.callCount / b.sampleSize : 0;
    b.raiseRate = b.sampleSize > 0 ? b.raiseCount / b.sampleSize : 0;
    const ci = wilsonCI(b.foldCount, b.sampleSize);
    b.foldRateCI = ci;
  }

  const bucketKeys = Object.keys(buckets);
  return {
    buckets,
    totalActions,
    totalBucketCount: bucketKeys.length,
    sparseBucketCount: bucketKeys.filter((k) => buckets[k].sampleSize < 30).length,
  };
};

/**
 * Wilson 95% credible interval for a binomial proportion. Returns {lower, upper, mean}.
 */
export const wilsonCI = (successes, trials, z = 1.96) => {
  if (trials === 0) return { lower: 0, upper: 0, mean: 0 };
  const phat = successes / trials;
  const denom = 1 + (z * z) / trials;
  const center = (phat + (z * z) / (2 * trials)) / denom;
  const halfWidth = (z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * trials)) / trials)) / denom;
  return {
    lower: Math.max(0, center - halfWidth),
    upper: Math.min(1, center + halfWidth),
    mean: phat,
  };
};
