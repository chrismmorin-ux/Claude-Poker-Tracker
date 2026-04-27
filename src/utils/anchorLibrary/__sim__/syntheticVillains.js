/**
 * syntheticVillains.js — Scare-/line-specific villain policies for EAL Tier-1 scenarios
 *
 * Per `schema-delta.md` §7 + inherits the pattern from
 * `assumptionEngine/__sim__/syntheticVillains.js`.
 *
 * A synthetic villain is a fully specified decision policy. Running a scenario
 * iterates N hands against the policy and compares the engine's predicted
 * dividend to the realized simulated dividend. Tier-1 pass condition per
 * anchorScenarioRunner:
 *   |predicted − realized| / |predicted| ≤ 0.05
 *
 * These are NOT real villain models — they are known-ground-truth policies for
 * validating anchor-specific math (GTO baseline + operator composition + dial curves).
 * Real calibration (model validity) happens in Tier-2 against real hand history per
 * `exploit-deviation/calibration.md` §3 inherited framework.
 *
 * The four starter policies in this file each exercise one of the four Session 1
 * seed anchors (EAL-SEED-01..04). Each policy's `actionAtNode` is keyed on the
 * anchor's trigger conditions and returns the policy's specified response rates.
 *
 * Pure module — no imports. Frozen objects.
 */

/**
 * @typedef {Object} SyntheticVillainPolicy
 * @property {string} styleLabel — 'Nit' / 'LAG' / 'Fish' / 'TAG' / etc
 * @property {number} seed — deterministic RNG seed for the scenario
 * @property {string} targetAnchor — which EAL-SEED this policy is calibrated for
 * @property {function(node, combo): ActionDistribution} actionAtNode
 * @property {Object} expectedObservedRates — per-predicate rates this policy will produce
 */

// ───────────────────────────────────────────────────────────────────────────
// NIT_SCARE_OVERFOLD — EAL-SEED-01 calibration
// ───────────────────────────────────────────────────────────────────────────

/**
 * Nit who over-folds to river overbets on flush- or straight-completing rivers.
 *
 * Per seed-anchor-01 §2: observed fold rate 0.72 on scare-completing rivers to
 * overbet sizings (1.0× pot and above). Non-scare fold rate ≈ 0.48 (population
 * baseline). The delta is the scare-card cognitive response (PP-01).
 */
export const NIT_SCARE_OVERFOLD = Object.freeze({
  styleLabel: 'Nit',
  seed: 101,
  targetAnchor: 'EAL-SEED-01',

  /**
   * Action distribution at a given node.
   *
   * Triggers scare-fold behavior when:
   *   - street === 'river'
   *   - texture === 'flush-complete' OR 'straight-complete'
   *   - betSizePot >= 1.0  (overbet sizing)
   *
   * Otherwise falls back to population Nit rate.
   */
  actionAtNode: (node, _combo) => {
    if (
      node.street === 'river'
      && (node.texture === 'flush-complete' || node.texture === 'straight-complete')
      && node.betSizePot >= 1.0
    ) {
      // Scare + overbet → PP-01 fires → overfold
      return { fold: 0.72, call: 0.26, raise: 0.02 };
    }
    // Non-scare river or smaller bet → population Nit baseline
    return { fold: 0.48, call: 0.48, raise: 0.04 };
  },

  expectedObservedRates: {
    foldToRiverBet: { rate: 0.72, n: Infinity }, // at scare + overbet context
  },
});

// ───────────────────────────────────────────────────────────────────────────
// LAG_TURN_XX_OVERBLUFF — EAL-SEED-02 calibration
// ───────────────────────────────────────────────────────────────────────────

/**
 * LAG who over-bluffs river probes after turn check-check.
 *
 * Per seed-anchor-02 §2: observed 62% bluff frequency in river probes after
 * turn XX (vs 43% GTO-balanced at 0.75 pot sizing). Probe frequency itself is
 * elevated (~58%) — the anchor exploits the bluff-heavy composition more than
 * the elevated probe frequency.
 *
 * Note on encoding: `actionAtNode` here returns the decision at the river-probe
 * node given villain elected to bet. The bluff-frequency-within-bet is encoded
 * as `_villainBetIsBluff` — distinct from fold/call/raise axes. For scenarios
 * consuming this policy, the hero-side `bluffCatchEV` is computed from this
 * probability.
 */
export const LAG_TURN_XX_OVERBLUFF = Object.freeze({
  styleLabel: 'LAG',
  seed: 102,
  targetAnchor: 'EAL-SEED-02',

  actionAtNode: (node, _combo) => {
    // Anchor trigger: flop-hero-called + turn-check-check + river-probe
    const turnCheckedThrough = (node.precedingStreetSequence || []).some(
      (step) => step === 'turn:checkCheck',
    );
    if (
      node.street === 'river'
      && turnCheckedThrough
      && node.villainAction === 'bet'
      && node.betSizePot >= 0.66
      && node.betSizePot <= 0.80
    ) {
      // Probe composition: 62% bluffs / 38% value per PP-02 + PP-05
      return {
        // From LAG's decision perspective — they bet; but for scenarios
        // testing hero's bluff-catch we need the bluff-composition field.
        fold: 0, // N/A — villain is betting, not deciding to fold
        call: 0,
        raise: 0,
        bet: 1.0,
        // Hero-side lookups:
        _villainBetIsBluff: 0.62,
      };
    }
    // Non-trigger: LAG population probe at ~50% bluff frequency
    return { fold: 0.20, call: 0.55, raise: 0.05, bet: 0.20, _villainBetIsBluff: 0.50 };
  },

  expectedObservedRates: {
    // Predicate name is non-standard — commit 2.5 resolves to actual predicate
    // key when assumptionProducer recipe is wired.
    riverProbeBluffFrequencyAfterTurnXX: { rate: 0.62, n: Infinity },
  },
});

// ───────────────────────────────────────────────────────────────────────────
// FISH_PAIRED_OVERCALL — EAL-SEED-03 calibration
// ───────────────────────────────────────────────────────────────────────────

/**
 * Fish who over-calls turn double-barrels on dry-paired boards.
 *
 * Per seed-anchor-03 §2: observed call rate 0.76 on paired turn + villain
 * called flop cbet (population Fish baseline on non-paired dry turn is ~0.62).
 * Paired-texture increment is PP-03 indirect (absence of reweighting).
 */
export const FISH_PAIRED_OVERCALL = Object.freeze({
  styleLabel: 'Fish',
  seed: 103,
  targetAnchor: 'EAL-SEED-03',

  actionAtNode: (node, _combo) => {
    const calledFlopCbet = (node.precedingStreetSequence || []).includes('flop:villainCall');
    if (
      node.street === 'turn'
      && node.texture === 'paired'
      && calledFlopCbet
      && node.heroIsAggressor
      && node.betSizePot >= 0.66
      && node.betSizePot <= 0.75
    ) {
      // Paired turn double-barrel → Fish over-calls (PP-03 indirect)
      return { fold: 0.20, call: 0.76, raise: 0.04 };
    }
    // Non-trigger Fish on turn: population baseline
    return { fold: 0.38, call: 0.58, raise: 0.04 };
  },

  expectedObservedRates: {
    callVsTurnDoubleBarrelPaired: { rate: 0.76, n: Infinity },
  },
});

// ───────────────────────────────────────────────────────────────────────────
// TAG_OFFSCRIPT_VALUE_READ — EAL-SEED-04 calibration
// ───────────────────────────────────────────────────────────────────────────

/**
 * TAG who (per speculative PP-04) over-folds to flop donk-bets on wet connected
 * boards — reading the off-script aggression as value-indicating.
 *
 * Per seed-anchor-04 §2: CLAIMED observed fold rate 0.64. Observed with wide
 * credible interval ([0.48, 0.78]) and posteriorConfidence 0.78 < 0.80 gate —
 * **anchor ships as `candidate` non-firing pending Tier 2 data**.
 *
 * PP-04 is the "most likely to invalidate primitive in Phase 1 library" per
 * gate2 audit. This synthetic villain lets the Tier-1 scenario exercise the
 * schema-for-failing-anchors + schema-candidate-status pathway even though
 * the claim may not hold empirically.
 */
export const TAG_OFFSCRIPT_VALUE_READ = Object.freeze({
  styleLabel: 'TAG',
  seed: 104,
  targetAnchor: 'EAL-SEED-04',

  actionAtNode: (node, _combo) => {
    if (
      node.street === 'flop'
      && node.texture === 'wet'
      && node.position === 'PFA' // TAG is PFA facing hero's donk
      && node.heroLineType === 'donk'
      && node.betSizePot >= 0.33
      && node.betSizePot <= 0.50
    ) {
      // Wet connected + hero donk + small sizing → PP-04 fires → TAG over-folds
      return { fold: 0.64, call: 0.28, raise: 0.08 };
    }
    // Non-trigger: TAG population fold-to-donk ~0.48
    return { fold: 0.48, call: 0.44, raise: 0.08 };
  },

  expectedObservedRates: {
    foldVsFlopDonkWetConnected: { rate: 0.64, n: Infinity },
  },
});

// ───────────────────────────────────────────────────────────────────────────
// Registry — for reference + tests
// ───────────────────────────────────────────────────────────────────────────

export const ANCHOR_SEED_VILLAINS = Object.freeze({
  'EAL-SEED-01': NIT_SCARE_OVERFOLD,
  'EAL-SEED-02': LAG_TURN_XX_OVERBLUFF,
  'EAL-SEED-03': FISH_PAIRED_OVERCALL,
  'EAL-SEED-04': TAG_OFFSCRIPT_VALUE_READ,
});
