/**
 * claimContractSeam.test.js — seed anchors vs assumptionEngine claim contract.
 *
 * CROSS_STREAM_SEAM_CONTRACT_MISMATCH guard: every ExploitAnchor inherits
 * VillainAssumption v1.1, but `validateAnchor` validates only the anchor
 * extension — no test ever pushed the seed fixtures through the BASE
 * contract's vocabulary. All four seeds shipped with a Unicode `'≥'`
 * operator while the producer emits — and the validator accepts — only
 * ASCII (`'<=', '>=', '==', 'in_range'`). Latent until the two-validator
 * inheritance wiring lands, at which point every seed would have failed.
 *
 * Scope note: this test pins the OPERATOR vocabulary only. The seeds'
 * predicates (e.g. `riverProbeBluffFrequencyAfterTurnXX`) are not in
 * assumptionEngine PREDICATE_KEYS — whether anchor predicates join that
 * registry (with its 4-artifact discipline) or get their own space is an
 * open design decision, tracked separately. Do not widen this test to full
 * validateClaim until that's decided.
 */

import { describe, it, expect } from 'vitest';
import { CLAIM_OPERATORS } from '../../assumptionEngine/assumptionTypes';
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
