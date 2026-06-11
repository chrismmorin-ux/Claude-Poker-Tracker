/**
 * claimContractSeam.test.js — seed anchors vs assumptionEngine base contract.
 *
 * CROSS_STREAM_SEAM_CONTRACT_MISMATCH guard: every ExploitAnchor inherits
 * VillainAssumption v1.1. Originally this test pinned only the claim-operator
 * vocabulary (the seeds had shipped with a Unicode `'≥'` operator the base
 * validator would have rejected). WS-218 (SPR-119, founder-ratified
 * 2026-06-11) wired the full two-validator inheritance:
 *
 *   - Anchor-authored predicates live in the anchor-owned registry
 *     (`anchorPredicates.js` ANCHOR_PREDICATE_KEYS), NOT in assumptionEngine
 *     PREDICATE_KEYS — the parent enum's 4-artifact discipline is for
 *     producer-emitted predicates. Parallel discipline: every anchor
 *     predicate requires an anchor-level Tier-1 scenario.
 *   - `validateAnchorFull` composes base validation (with the registry +
 *     compound-semver accommodation) and the EAL extension validator.
 *   - All 4 seeds were completed to full v1.1 conformance by transcription
 *     from their seed-anchor markdowns.
 *
 * This suite is the seam tripwire: if a seed drifts off either contract, or
 * the registry partition blurs (an anchor predicate leaking into
 * PREDICATE_KEYS or vice versa), it fails here before the scenario runner
 * ever fires.
 */

import { describe, it, expect } from 'vitest';
import { CLAIM_OPERATORS, PREDICATE_KEYS } from '../../assumptionEngine/assumptionTypes';
import { validateAnchorFull } from '../validateAnchor';
import { ANCHOR_PREDICATE_KEYS } from '../anchorPredicates';
import { EAL_SEED_01_ANCHOR } from '../__sim__/scenarios/nitOverfoldRiver4flush';
import { EAL_SEED_02_ANCHOR } from '../__sim__/scenarios/lagOverbluffRiverProbe';
import { EAL_SEED_03_ANCHOR } from '../__sim__/scenarios/fishOvercallTurnDoubleBarrel';
import { EAL_SEED_04_ANCHOR } from '../__sim__/scenarios/tagOverfoldFlopDonk';

const SEEDS = [
  ['SEED-01', EAL_SEED_01_ANCHOR],
  ['SEED-02', EAL_SEED_02_ANCHOR],
  ['SEED-03', EAL_SEED_03_ANCHOR],
  ['SEED-04', EAL_SEED_04_ANCHOR],
];

describe('seed anchors honor the inherited claim-operator vocabulary', () => {
  it.each(SEEDS)('%s claim.operator is a legal CLAIM_OPERATORS value (ASCII, not unicode)', (_, anchor) => {
    expect(CLAIM_OPERATORS).toContain(anchor.claim.operator);
  });

  it('every seed carries a structured claim with predicate + threshold', () => {
    for (const [, anchor] of SEEDS) {
      expect(typeof anchor.claim.predicate).toBe('string');
      expect(anchor.claim.predicate.length).toBeGreaterThan(0);
      expect(typeof anchor.claim.threshold).toBe('number');
    }
  });
});

describe('full two-validator inheritance contract (WS-218)', () => {
  it.each(SEEDS)('%s passes validateAnchorFull (base v1.1 + EAL extension)', (_, anchor) => {
    const result = validateAnchorFull(anchor);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('quality blocks are derived honestly: no Phase-1 seed gates actionable', () => {
    // All seeds have pending stability (and SEED-02/03 sub-gate payoff,
    // SEED-04 sub-gate confidence) — the engine's own gate evaluator must
    // say "not actionable", not a hand-typed true.
    for (const [, anchor] of SEEDS) {
      expect(anchor.quality.actionableLive).toBe(false);
      expect(anchor.quality.actionableInDrill).toBe(false);
      expect(anchor.quality.gatesPassed.stability).toBe(false);
    }
  });
});

describe('predicate registry partition (WS-218 decision)', () => {
  it('anchor-owned predicates are in ANCHOR_PREDICATE_KEYS and NOT in PREDICATE_KEYS', () => {
    for (const predicate of [
      'riverProbeBluffFrequencyAfterTurnXX',
      'callVsTurnDoubleBarrelPaired',
      'foldVsFlopDonkWetConnected',
    ]) {
      expect(ANCHOR_PREDICATE_KEYS).toContain(predicate);
      expect(PREDICATE_KEYS).not.toContain(predicate);
    }
  });

  it('base-registry predicates are NOT duplicated in the anchor registry', () => {
    // SEED-01's foldToRiverBet lives in PREDICATE_KEYS; duplication would
    // blur which discipline (producer 4-artifact vs anchor Tier-1) governs it.
    expect(PREDICATE_KEYS).toContain('foldToRiverBet');
    expect(ANCHOR_PREDICATE_KEYS).not.toContain('foldToRiverBet');
    for (const predicate of ANCHOR_PREDICATE_KEYS) {
      expect(PREDICATE_KEYS).not.toContain(predicate);
    }
  });

  it('every seed claim predicate is resolvable in exactly one registry', () => {
    for (const [, anchor] of SEEDS) {
      const inBase = PREDICATE_KEYS.includes(anchor.claim.predicate);
      const inAnchor = ANCHOR_PREDICATE_KEYS.includes(anchor.claim.predicate);
      expect(inBase !== inAnchor).toBe(true); // XOR — one registry, never both/neither
    }
  });
});
