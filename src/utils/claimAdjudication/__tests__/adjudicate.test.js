/**
 * adjudicate.test.js — running a reasoning note against the engine.
 *
 * THE FIXTURE IS REAL. The KK narration below is the first reasoning note the
 * founder actually recorded (2026-08-01), reconstructed from his own account of
 * it after the recording was truncated. Testing against invented prose would
 * have hidden the thing that matters most about this note: almost every load-
 * bearing claim in it is about STACK DEPTH, which is exactly the quantity the
 * app could not check.
 *
 * The property under test is the founder's posture — claims stand until
 * disproven WITH DATA. An inadmissible stack must never refute a claim; it must
 * abstain and name what would settle it.
 */

import { describe, it, expect } from 'vitest';
import { adjudicateNote, defaultRegistry, collectGaps } from '../adjudicate';
import { extractClaims } from '../claimExtractor';
import { CLAIM_KIND, VERDICT, GAP, makeClaim, makeVerdict } from '../claims';
import { createRegistry } from '../resolverRegistry';
import { STACK_SOURCE } from '../../seatStacks/stackLedger';

/** Stacks the ledger has actually observed. */
const ADMISSIBLE = {
  pot: 30,
  toCall: 10,
  playersLive: 3,
  effStackBB: 22,
  effStackSource: STACK_SOURCE.CARRIED,
  stacksAdmissible: true,
};

/** Stacks that exist but were never observed — the buy-in assumption. */
const INADMISSIBLE = {
  ...ADMISSIBLE,
  effStackSource: STACK_SOURCE.BUYIN_DEFAULT,
  stacksAdmissible: false,
};

const kkNote = (context) => ({
  id: 'vrn-kk-1',
  segments: [
    {
      text: 'utg limps in and I raise with kings, knowing they are short stacked '
        + 'and more likely to consider themselves priced in',
      context,
    },
    {
      text: 'after the utg call it almost forces the hijack to call with a wide range '
        + 'since his pot odds are so good',
      context,
    },
    {
      text: 'I wanted to size up here to push the equity of my kings right there preflop',
      context,
    },
    {
      text: 'ended up two players all in against my kings',
      context,
    },
  ],
});

describe('claim extraction — the real KK narration', () => {
  it('pulls the load-bearing claims out of spoken reasoning', () => {
    const { claims } = extractClaims(kkNote(ADMISSIBLE));
    const kinds = claims.map((c) => c.kind);

    expect(kinds).toContain(CLAIM_KIND.STACK_DEPTH);
    expect(kinds).toContain(CLAIM_KIND.POT_ODDS);
    expect(kinds).toContain(CLAIM_KIND.SIZING);
    expect(kinds).toContain(CLAIM_KIND.RANGE);
  });

  it('reads a compound clause as MORE THAN ONE claim', () => {
    // "they're short AND therefore priced in" asserts two things. Collapsing it
    // to one would check half the reasoning and silently discard the rest —
    // and this compound shape is what real reasoning almost always looks like.
    const { claims } = extractClaims({
      segments: [{
        text: 'they are short stacked so they consider themselves priced in',
        context: ADMISSIBLE,
      }],
    });
    expect(claims.map((c) => c.kind).sort()).toEqual(
      [CLAIM_KIND.POT_ODDS, CLAIM_KIND.STACK_DEPTH].sort(),
    );
  });

  it('RETURNS what it could not parse rather than dropping it', () => {
    const { unparsed } = extractClaims({
      segments: [{ text: 'the dealer was slow and my coffee went cold', context: null }],
    });
    expect(unparsed.length).toBeGreaterThan(0);
    expect(unparsed[0]).toContain('coffee');
  });

  it('reports coverage honestly', () => {
    const { coverage } = extractClaims({
      segments: [
        { text: 'they are short stacked', context: null },
        { text: 'anyway the room was loud', context: null },
      ],
    });
    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThan(1);
  });

  it('binds every claim to the state that was on screen when it was spoken', () => {
    const { claims } = extractClaims(kkNote(ADMISSIBLE));
    expect(claims.every((c) => c.context === ADMISSIBLE)).toBe(true);
  });
});

describe('adjudication — INV-STK-01, the safety property', () => {
  it('BLOCKS a stack-depth claim when stacks were never observed', () => {
    const { results } = adjudicateNote(kkNote(INADMISSIBLE));
    const stack = results.find((r) => r.claim.kind === CLAIM_KIND.STACK_DEPTH);

    expect(stack.verdict.verdict).toBe(VERDICT.BLOCKED);
    expect(stack.verdict.gap).toBe(GAP.INADMISSIBLE_PROVENANCE);
    // Never "you were wrong" — the claim stands and the fix is named.
    expect(stack.verdict.detail).toMatch(/claim stands/i);
  });

  it('supports "short stacked" at 22bb once the stack is admissible', () => {
    const { results } = adjudicateNote(kkNote(ADMISSIBLE));
    const stack = results.find((r) => r.claim.kind === CLAIM_KIND.STACK_DEPTH);

    expect(stack.verdict.verdict).toBe(VERDICT.SUPPORTED);
    expect(stack.verdict.actual).toEqual({ value: 22, unit: 'bb' });
    expect(stack.verdict.basis.provenance).toBe(STACK_SOURCE.CARRIED);
  });

  it('disproves "short stacked" at 140bb — and says what the number is', () => {
    const deep = { ...ADMISSIBLE, effStackBB: 140, effStackSource: STACK_SOURCE.ENTERED };
    const { results } = adjudicateNote(kkNote(deep));
    const stack = results.find((r) => r.claim.kind === CLAIM_KIND.STACK_DEPTH);

    expect(stack.verdict.verdict).toBe(VERDICT.DISPROVEN);
    expect(stack.verdict.detail).toMatch(/140/);
  });
});

describe('adjudication — pot odds', () => {
  it('supports "his pot odds are so good" when the price really is cheap', () => {
    // Calling 10 into 30 needs 25% — cheap.
    const { results } = adjudicateNote(kkNote(ADMISSIBLE));
    const odds = results.find((r) => r.claim.kind === CLAIM_KIND.POT_ODDS);

    expect(odds.verdict.verdict).toBe(VERDICT.SUPPORTED);
    expect(odds.verdict.actual.unit).toBe('%-equity-needed');
  });

  it('disproves it when the price is not cheap at all', () => {
    const expensive = { ...ADMISSIBLE, pot: 10, toCall: 40 };
    const { results } = adjudicateNote(kkNote(expensive));
    const odds = results.find((r) => r.claim.kind === CLAIM_KIND.POT_ODDS);

    expect(odds.verdict.verdict).toBe(VERDICT.DISPROVEN);
  });

  it('blocks when the amount facing the player was never recorded', () => {
    const { results } = adjudicateNote(kkNote({ ...ADMISSIBLE, toCall: null }));
    const odds = results.find((r) => r.claim.kind === CLAIM_KIND.POT_ODDS);

    expect(odds.verdict.verdict).toBe(VERDICT.BLOCKED);
    expect(odds.verdict.gap).toBe(GAP.MISSING_FIELD);
    expect(odds.verdict.detail).toMatch(/toCall/);
  });
});

describe('adjudication — what must not be refuted', () => {
  it('treats "I wanted to size up" as unfalsifiable, not wrong', () => {
    // F1: this lane records divergence and never renders a verdict on whether
    // the founder's reasoning was sound.
    const { results } = adjudicateNote(kkNote(ADMISSIBLE));
    const sizing = results.find((r) => r.claim.kind === CLAIM_KIND.SIZING);
    expect(sizing.verdict.verdict).toBe(VERDICT.UNFALSIFIABLE);
  });

  it('downgrades refutation of a HEDGED claim to divergence', () => {
    const deep = { ...ADMISSIBLE, effStackBB: 140, effStackSource: STACK_SOURCE.ENTERED };
    const { results } = adjudicateNote({
      segments: [{ text: 'I think they were short stacked', context: deep }],
    });
    const stack = results.find((r) => r.claim.kind === CLAIM_KIND.STACK_DEPTH);

    expect(stack.claim.hedged).toBe(true);
    expect(stack.verdict.verdict).toBe(VERDICT.BLOCKED);
    expect(stack.verdict.detail).toMatch(/hedge/i);
  });

  it('will not answer a live hand from an online-only source', () => {
    // SRC-011 is 21.6M ONLINE hands and is barred from live segments. The wall
    // is enforced at the registry, not left to each resolver's discipline.
    const { results } = adjudicateNote(kkNote(ADMISSIBLE), { segment: 'live' });
    const range = results.find((r) => r.claim.kind === CLAIM_KIND.RANGE);

    expect(range.verdict.verdict).toBe(VERDICT.BLOCKED);
    expect(range.verdict.gap).toBe(GAP.WRONG_SEGMENT);
  });
});

describe('adjudication — the gap queue', () => {
  it('turns blocked claims into deduplicated work items ranked by how often they bite', () => {
    const { gaps } = adjudicateNote(kkNote(INADMISSIBLE), { segment: 'live' });

    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps[0].count).toBeGreaterThanOrEqual(gaps[gaps.length - 1].count);
    expect(gaps.some((g) => g.gap === GAP.INADMISSIBLE_PROVENANCE)).toBe(true);
  });

  it('groups by (gap, kind) — the unit of work is a capability, not a sentence', () => {
    const gaps = collectGaps([
      {
        claim: makeClaim({ kind: CLAIM_KIND.STACK_DEPTH, text: 'a' }),
        verdict: makeVerdict({ verdict: VERDICT.BLOCKED, gap: GAP.MISSING_FIELD }),
      },
      {
        claim: makeClaim({ kind: CLAIM_KIND.STACK_DEPTH, text: 'b' }),
        verdict: makeVerdict({ verdict: VERDICT.BLOCKED, gap: GAP.MISSING_FIELD }),
      },
    ]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].count).toBe(2);
  });

  it('summarises without losing the blocked count', () => {
    const { summary } = adjudicateNote(kkNote(INADMISSIBLE));
    const total = summary.supported + summary.disproven + summary.blocked + summary.unfalsifiable;
    expect(total).toBeGreaterThan(0);
    expect(summary.blocked).toBeGreaterThan(0);
  });
});

describe('resolver registry — extensibility', () => {
  it('blocks with NO_RESOLVER for a claim kind nothing answers yet', () => {
    const registry = createRegistry();
    const verdict = registry.resolve(makeClaim({ kind: CLAIM_KIND.BOARD, text: 'brick' }), {});
    expect(verdict.verdict).toBe(VERDICT.BLOCKED);
    expect(verdict.gap).toBe(GAP.NO_RESOLVER);
  });

  it('a new engine capability is ONE registration — nothing else moves', () => {
    const registry = defaultRegistry();
    registry.register({
      id: 'board/texture',
      kinds: [CLAIM_KIND.BOARD],
      requires: ['board'],
      resolve: () => makeVerdict({ verdict: VERDICT.SUPPORTED, detail: 'dry' }),
    });
    const verdict = registry.resolve(
      makeClaim({ kind: CLAIM_KIND.BOARD, text: 'that board is dry' }),
      { board: ['Ah', '7c', '2d'] },
    );
    expect(verdict.verdict).toBe(VERDICT.SUPPORTED);
    expect(verdict.basis.resolver).toBe('board/texture');
  });

  it('a resolver that throws blocks only its own claim', () => {
    const registry = createRegistry();
    registry.register({
      id: 'exploding',
      kinds: [CLAIM_KIND.EQUITY],
      resolve: () => { throw new Error('boom'); },
    });
    const verdict = registry.resolve(makeClaim({ kind: CLAIM_KIND.EQUITY, text: 'x' }), {});
    expect(verdict.verdict).toBe(VERDICT.BLOCKED);
    expect(verdict.detail).toMatch(/boom/);
  });

  it('treats 0 as present — it is a real pot, not a missing one', () => {
    const registry = createRegistry();
    registry.register({
      id: 'zero-ok',
      kinds: [CLAIM_KIND.POT_ODDS],
      requires: ['pot'],
      resolve: () => makeVerdict({ verdict: VERDICT.SUPPORTED }),
    });
    const verdict = registry.resolve(
      makeClaim({ kind: CLAIM_KIND.POT_ODDS, text: 'x' }), { pot: 0 },
    );
    expect(verdict.verdict).toBe(VERDICT.SUPPORTED);
  });

  it('refuses a BLOCKED verdict that does not name its gap', () => {
    expect(() => makeVerdict({ verdict: VERDICT.BLOCKED })).toThrow(/name its gap/);
  });

  it('reports what the engine can currently answer', () => {
    const caps = defaultRegistry().capabilities();
    expect(caps.map((c) => c.id)).toContain('stack-depth/stackLedger');
    expect(caps.find((c) => c.id === 'range/population-priors').segments).toEqual(['online']);
  });
});
