/**
 * opportunitiesPerHand.test.js — WS-428.
 *
 * The load-bearing assertions are the REFUSALS, same as coverageCensus.test.js: the second
 * factor of the headline must be impossible to source from the scored subset. A test that
 * only checked the arithmetic would pass on the implementation §3.3 forbids.
 */

import { describe, it, expect } from 'vitest';

import {
  declareExamination,
  buildCoverageCensus,
  coverageCensusProblems,
  attachOpportunityCount,
  opportunitiesPerHand,
  OPPORTUNITY_BASIS,
  FORBIDDEN_OPPORTUNITY_BASES,
} from '../coverageCensus.js';
import { StandardOfRecordError } from '../schemas.js';

const STREET_AXES = [{ name: 'street', levels: ['flop', 'turn', 'river'] }];
const DOMAIN = { object: 'hero decision opportunities over a Deal Book' };

const exhaustiveCensus = (hits = { flop: 12, turn: 2, river: 2 }) => buildCoverageCensus({
  domain: DOMAIN,
  axes: STREET_AXES,
  hits,
  examination: declareExamination({ mode: 'exhaustive', basis: 'every hand walked' }),
});

describe('attachOpportunityCount', () => {
  it('attaches the count with the total derived from the census cells, not the caller', () => {
    const census = attachOpportunityCount(exhaustiveCensus(), {
      basis: OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE,
      seatHands: 22,
      dealBookHash: 'sha256:abc',
    });
    expect(census.opportunities.decisionOpportunities).toBe(16); // 12 + 2 + 2, from cells
    expect(census.opportunities.seatHands).toBe(22);
    expect(census.opportunities.basis).toBe('deal-book-structure');
    expect(census.opportunities.dealBookHash).toBe('sha256:abc');
  });

  it('REFUSES every scored-subset basis by name — the §3.3 refusal, structural', () => {
    for (const basis of FORBIDDEN_OPPORTUNITY_BASES) {
      expect(() => attachOpportunityCount(exhaustiveCensus(), { basis, seatHands: 22 }))
        .toThrow(/REFUSED|refused/i);
    }
  });

  it('names n/handsRepresented and --max-decisions in the scored-subset refusal', () => {
    expect(() => attachOpportunityCount(exhaustiveCensus(), {
      basis: 'scored-subset', seatHands: 22,
    })).toThrow(/n\/handsRepresented[\s\S]*--max-decisions/);
  });

  it('refuses an unknown basis rather than admitting it', () => {
    expect(() => attachOpportunityCount(exhaustiveCensus(), {
      basis: 'vibes', seatHands: 22,
    })).toThrow(StandardOfRecordError);
  });

  it('refuses a census whose examination is not exhaustive — a scoped walk is a harness property', () => {
    const scoped = buildCoverageCensus({
      domain: DOMAIN,
      axes: STREET_AXES,
      hits: { flop: 12 },
      examination: declareExamination({
        mode: 'enumerated',
        contexts: ['flop'],
        unexaminedReason: 'out-of-run-scope',
      }),
    });
    expect(() => attachOpportunityCount(scoped, {
      basis: OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE, seatHands: 22,
    })).toThrow(/exhaustive/);
  });

  it('refuses a zero, negative, or fractional seat-hand denominator', () => {
    for (const seatHands of [0, -3, 21.5, null, undefined, NaN]) {
      expect(() => attachOpportunityCount(exhaustiveCensus(), {
        basis: OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE, seatHands,
      })).toThrow(StandardOfRecordError);
    }
  });

  it('leaves the census valid — the extension is additive over the existing checker', () => {
    const census = attachOpportunityCount(exhaustiveCensus(), {
      basis: OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE, seatHands: 22,
    });
    expect(coverageCensusProblems(census)).toEqual([]);
  });

  it('a census WITHOUT an opportunity count is still valid — old artifacts stay readable', () => {
    expect(coverageCensusProblems(exhaustiveCensus())).toEqual([]);
  });
});

describe('opportunitiesPerHand — the first-class reader', () => {
  it('returns the ratio with its parts and its conditional', () => {
    const census = attachOpportunityCount(exhaustiveCensus(), {
      basis: OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE, seatHands: 22, dealBookHash: 'sha256:abc',
    });
    const opp = opportunitiesPerHand(census);
    expect(opp.perHand).toBeCloseTo(16 / 22, 12);
    expect(opp.decisionOpportunities).toBe(16);
    expect(opp.seatHands).toBe(22);
    expect(opp.conditional).toMatch(/seat-hand/);
    expect(opp.conditional).toMatch(/invariant to --max-decisions/);
  });

  it('THROWS on a census with no attached count — a null here would invite the substitution', () => {
    expect(() => opportunitiesPerHand(exhaustiveCensus()))
      .toThrow(/n\/handsRepresented/);
  });

  it('re-refuses a tampered basis at read time', () => {
    const census = attachOpportunityCount(exhaustiveCensus(), {
      basis: OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE, seatHands: 22,
    });
    const tampered = {
      ...census,
      opportunities: { ...census.opportunities, basis: 'scored-subset' },
    };
    expect(() => opportunitiesPerHand(tampered)).toThrow(/refusing to lift/i);
  });

  it('counts an observed-zero street as zero, not as absence — a book that never reached the river', () => {
    const census = attachOpportunityCount(exhaustiveCensus({ flop: 5, turn: 1, river: 0 }), {
      basis: OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE, seatHands: 9,
    });
    expect(opportunitiesPerHand(census).perHand).toBeCloseTo(6 / 9, 12);
    const riverCell = census.cells.find((c) => c.contextKey === 'river');
    expect(riverCell.status).toBe('observed-zero');
  });
});
