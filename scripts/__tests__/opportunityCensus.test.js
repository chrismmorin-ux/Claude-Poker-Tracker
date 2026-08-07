/**
 * opportunityCensus.test.js — WS-428.
 *
 * THE TEST THAT MATTERS is the refusal test: `opportunitiesPerHand` over a Deal Book must be
 * INVARIANT to `--max-decisions`, while the forbidden substitution — n/handsRepresented on
 * the scored subset — visibly moves with the cap. §3.3 refuses the substitution in prose
 * ("otherwise the headline inherits every sampling limit of the harness"); this file is the
 * executable form of that refusal.
 *
 * Runs against the checked-in fixture corpus slice (`fixtures/sample-hands.phhs`, the same
 * hermetic file phhAdapter.test.js uses), through the real Deal Book builder and the real
 * counting path — a fast integration test, no engine work.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { buildDealBook } from '../backtest/dealBook.mjs';
import {
  OPPORTUNITY_STREETS,
  countDecisionOpportunities,
  opportunityCensusFromCounts,
  opportunityCensusForDealBook,
} from '../backtest/opportunityCensus.mjs';
import { opportunitiesPerHand } from '../../src/utils/standardOfRecord/coverageCensus.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, '..', 'backtest', 'fixtures');
const FIXTURE = join(FIXTURES_DIR, 'sample-hands.phhs');
const FILES = [{ path: FIXTURE, site: 'ftp', stakeLabel: '50NL' }];

let hands;
let dealBook;

beforeAll(async () => {
  hands = [];
  for await (const h of iterAppHands(FIXTURE, { site: 'ftp', stakeLabel: '50NL' })) hands.push(h);
  dealBook = await buildDealBook({
    files: FILES,
    root: FIXTURES_DIR,
    sliceSpec: { sites: ['ftp'], stakes: ['50NL'], fixture: true },
  });
});

describe('countDecisionOpportunities — the game-structure count', () => {
  it('matches the hand-verified golden numbers for the fixture slice', () => {
    // Verified independently against the fixture before being written down (the
    // phhAdapter.test.js discipline): 4 convertible hands, 22 seat-hands (dealt-in seats),
    // 16 postflop voluntary action points — 12 flop, 2 turn, 2 river.
    const c = countDecisionOpportunities(hands);
    expect(c.handsCounted).toBe(4);
    expect(c.seatHands).toBe(22);
    expect(c.decisionOpportunities).toBe(16);
    expect(c.byStreet).toEqual({ flop: 12, turn: 2, river: 2 });
  });

  it('counts every postflop entry and no preflop entry — the edgeBB decision class', () => {
    const c = countDecisionOpportunities(hands);
    let postflop = 0;
    let preflop = 0;
    for (const h of hands) {
      for (const e of h.gameState.actionSequence) {
        if (OPPORTUNITY_STREETS.includes(e.street)) postflop += 1;
        else preflop += 1;
      }
    }
    expect(c.decisionOpportunities).toBe(postflop);
    expect(preflop).toBeGreaterThan(0); // the fixture HAS preflop actions, and none leaked in
  });

  it('keeps preflop-folded seat-hands in the denominator — the figure is unconditional', () => {
    const c = countDecisionOpportunities(hands);
    const seatsWithPostflopAction = new Set();
    for (const h of hands) {
      for (const e of h.gameState.actionSequence) {
        if (OPPORTUNITY_STREETS.includes(e.street)) seatsWithPostflopAction.add(`${h.handId}:${e.seat}`);
      }
    }
    // Most seat-hands fold preflop; they still count in the denominator.
    expect(c.seatHands).toBeGreaterThan(seatsWithPostflopAction.size);
  });

  it('takes no cap, filter, or harness parameter — invariance by construction', () => {
    // The signature IS the guarantee: one argument, the hands.
    expect(countDecisionOpportunities.length).toBe(1);
  });
});

describe('the census over the Deal Book', () => {
  it('builds an exhaustive street census carrying the opportunity count and the book hash', async () => {
    const census = await opportunityCensusForDealBook({
      files: FILES, dealBookHash: dealBook.contentHash,
    });
    expect(census.examination.mode).toBe('exhaustive');
    expect(census.opportunities.decisionOpportunities).toBe(16);
    expect(census.opportunities.seatHands).toBe(22);
    expect(census.opportunities.dealBookHash).toBe(dealBook.contentHash);
    expect(census.cells.map((c) => c.contextKey)).toEqual(['flop', 'turn', 'river']);
    const opp = opportunitiesPerHand(census);
    expect(opp.perHand).toBeCloseTo(16 / 22, 12);
  });

  it('refuses an empty file list — no book, no count, not a zero', async () => {
    await expect(opportunityCensusForDealBook({ files: [] })).rejects.toThrow(/zero files/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════
// THE REFUSAL TEST — §3.3, made executable.
//
// `scoredSubsetAtCap` below reproduces the harness's `--max-decisions` semantics exactly as
// `heroEvRunner.mjs` implements them (`if (decisions.length >= maxDecisions) { stop = true; }`):
// decisions accumulate in walk order and the run stops mid-book when the cap is hit. From that
// truncated set it derives the FORBIDDEN quantity, n / handsRepresented — the same shape as
// `evCost.mjs`'s scored-subset denominator.
//
// The assertion pair:
//   1. The forbidden ratio MOVES between two caps — proving the substitution really does
//      inherit the harness's sampling limits (if it didn't move, this test would be vacuous).
//   2. The census-derived factor is IDENTICAL at both caps — because the counting path has no
//      cap input at all, at any distance.
// ═══════════════════════════════════════════════════════════════════════════════════════════

const scoredSubsetAtCap = (allHands, maxDecisions) => {
  const scored = [];
  let stop = false;
  for (const h of allHands) {
    if (stop) break;
    for (const e of h.gameState.actionSequence) {
      if (!OPPORTUNITY_STREETS.includes(e.street)) continue;
      scored.push({ handId: h.handId, seat: e.seat, street: e.street });
      if (scored.length >= maxDecisions) { stop = true; break; }
    }
  }
  const handsRepresented = new Set(scored.map((d) => d.handId)).size;
  return { n: scored.length, handsRepresented, forbiddenRatio: scored.length / handsRepresented };
};

describe('THE REFUSAL TEST — opportunitiesPerHand is invariant to --max-decisions', () => {
  const CAP_A = 3;
  const CAP_B = 16; // everything the fixture has

  it('premise: the forbidden scored-subset ratio MOVES with the cap', () => {
    const atA = scoredSubsetAtCap(hands, CAP_A);
    const atB = scoredSubsetAtCap(hands, CAP_B);
    expect(atA.n).toBe(CAP_A);
    expect(atB.n).toBe(CAP_B);
    // The number §3.3 forbids is not even stable between two runs of the same book:
    expect(atA.forbiddenRatio).not.toBeCloseTo(atB.forbiddenRatio, 6);
  });

  it('the census factor does NOT move — same Deal Book, two caps, one number', async () => {
    // Two complete "runs" at different caps. The cap truncates what each run SCORES…
    const runA = { maxDecisions: CAP_A, scored: scoredSubsetAtCap(hands, CAP_A) };
    const runB = { maxDecisions: CAP_B, scored: scoredSubsetAtCap(hands, CAP_B) };
    expect(runA.scored.n).not.toBe(runB.scored.n);

    // …and each run derives its headline factor from the census over the Deal Book, exactly
    // as run-hero-ev.mjs wires it. The cap exists in each run's config and CANNOT reach the
    // factor: the counting path takes the book's files and nothing else.
    const censusA = await opportunityCensusForDealBook({ files: FILES, dealBookHash: dealBook.contentHash });
    const censusB = await opportunityCensusForDealBook({ files: FILES, dealBookHash: dealBook.contentHash });
    const factorA = opportunitiesPerHand(censusA);
    const factorB = opportunitiesPerHand(censusB);

    expect(factorA.perHand).toBe(factorB.perHand);
    expect(factorA.decisionOpportunities).toBe(factorB.decisionOpportunities);
    expect(factorA.seatHands).toBe(factorB.seatHands);

    // And the factor is not secretly the forbidden ratio wearing the right name:
    expect(factorA.perHand).not.toBeCloseTo(runA.scored.forbiddenRatio, 6);
    expect(factorA.perHand).not.toBeCloseTo(runB.scored.forbiddenRatio, 6);
  });

  it('quantifies the divergence the substitution would have smuggled into the headline', () => {
    // On this fixture the forbidden ratio at the tight cap is ~4x the game quantity —
    // the scored subset conditions on hands that produced decisions at all, and the census
    // does not. This is the sampling limit §3.3 refuses to inherit, measured.
    const forbidden = scoredSubsetAtCap(hands, CAP_A).forbiddenRatio;
    const counts = countDecisionOpportunities(hands);
    const game = counts.decisionOpportunities / counts.seatHands;
    expect(forbidden / game).toBeGreaterThan(2);
  });
});

describe('opportunityCensusFromCounts — the pure lift', () => {
  it('round-trips counts into a census whose reader returns the same ratio', () => {
    const counts = countDecisionOpportunities(hands);
    const census = opportunityCensusFromCounts({ counts, dealBookHash: 'sha256:test' });
    expect(opportunitiesPerHand(census).perHand)
      .toBeCloseTo(counts.decisionOpportunities / counts.seatHands, 12);
  });
});
