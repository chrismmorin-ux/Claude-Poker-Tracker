/**
 * holdingKnowledge.test.js — WS-292
 *
 * The leak guards are the load-bearing tests here. The whole value of the primitive is that
 * ground truth cannot reach an inference path by accident, and "cannot" has to be asserted
 * rather than documented — per exploitEngine/CLAUDE.md, when a comment states a fact the code
 * could assert instead, assert it. Three of this engine's shipped defects (WS-285, WS-291,
 * WS-300) were a label claiming something nothing checked.
 */

import { describe, it, expect } from 'vitest';
import {
  holdingKnowledgeAt,
  revealedHolding,
  hasRevealedHolding,
  isHoldingKnowledge,
  narrowedWith,
  HoldingKnowledgeError,
  REVEAL_DROP_REASONS,
  REVEAL_AT_SHOWDOWN,
} from '../holdingKnowledge';
import { parseAndEncode, parseBoard } from '../cardParser';

const range = (fill = 1) => new Float64Array(169).fill(fill);
const BOARD = parseBoard(['A♠', '7♦', '2♣']);

describe('holdingKnowledgeAt — construction', () => {
  it('requires a 169-cell range', () => {
    expect(() => holdingKnowledgeAt({ range: new Float64Array(52) }))
      .toThrow(HoldingKnowledgeError);
    expect(() => holdingKnowledgeAt({ range: null })).toThrow(HoldingKnowledgeError);
    expect(() => holdingKnowledgeAt({})).toThrow(HoldingKnowledgeError);
  });

  it('holds the range by reference rather than copying it', () => {
    const r = range();
    const k = holdingKnowledgeAt({ range: r });
    // Documented contract: copying 169 floats per decision would be a real cost in the
    // corpus harness, and this codebase treats ranges as immutable.
    expect(k.range).toBe(r);
  });

  it('freezes the record and its provenance', () => {
    const k = holdingKnowledgeAt({ range: range(), seat: 4 });
    expect(Object.isFrozen(k)).toBe(true);
    expect(Object.isFrozen(k.provenance)).toBe(true);
    expect(Object.isFrozen(k.provenance.narrowedBy)).toBe(true);
  });

  it('normalizes seat to a string so string/number seats compare equal', () => {
    expect(holdingKnowledgeAt({ range: range(), seat: 4 }).seat).toBe('4');
    expect(holdingKnowledgeAt({ range: range(), seat: '4' }).seat).toBe('4');
    expect(holdingKnowledgeAt({ range: range() }).seat).toBe(null);
  });

  it('rejects a non-array narrowedBy', () => {
    expect(() => holdingKnowledgeAt({ range: range(), narrowedBy: 'bet' }))
      .toThrow(HoldingKnowledgeError);
  });
});

describe('revealed cards are gated — the anti-leak contract', () => {
  const withCards = () => holdingKnowledgeAt({
    range: range(), board: BOARD, revealed: ['K♥', 'Q♠'], seat: 3,
  });

  it('exposes no `revealed` property', () => {
    const k = withCards();
    expect(k.revealed).toBeUndefined();
    expect(Object.keys(k)).not.toContain('revealed');
    expect(Object.getOwnPropertyNames(k)).not.toContain('revealed');
  });

  it('does not leak through destructuring', () => {
    const { revealed } = withCards();
    expect(revealed).toBeUndefined();
  });

  it('does not leak through spread', () => {
    const copy = { ...withCards() };
    expect(copy.revealed).toBeUndefined();
    expect(JSON.stringify(copy)).not.toContain('K♥');
  });

  it('does not leak through JSON serialization', () => {
    // Asserted structurally rather than by substring: the serialized 169-cell range contains
    // every small integer as an array INDEX, so a `not.toContain('45')` check would pass or
    // fail for reasons unrelated to the cards.
    const parsed = JSON.parse(JSON.stringify(withCards()));
    expect(Object.keys(parsed).sort()).toEqual(['provenance', 'range', 'seat']);
    expect(Object.keys(parsed.provenance)).not.toContain('revealed');
    // provenance may say a holding EXISTS; it must never say what it is.
    expect(parsed.provenance.hasRevealed).toBe(true);
    expect(JSON.stringify(parsed.provenance)).not.toContain(String(parseAndEncode('K♥')));
  });

  it('yields the cards only through the explicit call', () => {
    const k = withCards();
    expect(revealedHolding(k)).toEqual([parseAndEncode('K♥'), parseAndEncode('Q♠')]);
  });

  it('lets a consumer branch on existence without seeing the cards', () => {
    expect(hasRevealedHolding(withCards())).toBe(true);
    expect(hasRevealedHolding(holdingKnowledgeAt({ range: range() }))).toBe(false);
    expect(withCards().provenance.hasRevealed).toBe(true);
  });

  it('throws rather than returning null for a non-record', () => {
    // A plausible `null` here would read as "no showdown" and silently shrink a calibration
    // sample instead of failing — the failure mode this engine keeps re-learning.
    expect(() => revealedHolding({ range: range() })).toThrow(HoldingKnowledgeError);
    expect(() => revealedHolding(null)).toThrow(HoldingKnowledgeError);
    expect(() => revealedHolding({ ...withCards() })).toThrow(HoldingKnowledgeError);
  });

  it('returns null — not a throw — for a real record with no showdown', () => {
    expect(revealedHolding(holdingKnowledgeAt({ range: range() }))).toBe(null);
  });

  it('brands its own records only', () => {
    expect(isHoldingKnowledge(withCards())).toBe(true);
    expect(isHoldingKnowledge({ range: range(), provenance: {} })).toBe(false);
    expect(isHoldingKnowledge(null)).toBe(false);
  });
});

describe('revealed normalization', () => {
  it('accepts card strings and already-encoded integers alike', () => {
    const asStrings = holdingKnowledgeAt({ range: range(), board: BOARD, revealed: ['K♥', 'Q♠'] });
    const asInts = holdingKnowledgeAt({
      range: range(), board: BOARD, revealed: [parseAndEncode('K♥'), parseAndEncode('Q♠')],
    });
    expect(revealedHolding(asStrings)).toEqual(revealedHolding(asInts));
  });

  it('distinguishes "no showdown" from "unusable showdown"', () => {
    // Absent is the common case and not a data problem; supplied-but-broken is one worth
    // counting. Three pre-WS-292 sites dropped these and none reported a total.
    const absent = holdingKnowledgeAt({ range: range() });
    expect(absent.provenance.revealDropped).toBe(null);
    expect(absent.provenance.hasRevealed).toBe(false);

    const broken = holdingKnowledgeAt({ range: range(), revealed: ['Zz', 'Q♠'] });
    expect(broken.provenance.revealDropped).toBe(REVEAL_DROP_REASONS.UNPARSEABLE);
    expect(broken.provenance.hasRevealed).toBe(false);
  });

  it('rejects a holding that collides with the board', () => {
    // A card cannot be both on the board and in a hand; every downstream equity call would
    // otherwise run on an impossible deal.
    const k = holdingKnowledgeAt({ range: range(), board: BOARD, revealed: ['A♠', 'Q♠'] });
    expect(k.provenance.revealDropped).toBe(REVEAL_DROP_REASONS.BOARD_COLLISION);
    expect(hasRevealedHolding(k)).toBe(false);
  });

  it('rejects duplicate cards and wrong-length holdings', () => {
    const dup = holdingKnowledgeAt({ range: range(), revealed: ['K♥', 'K♥'] });
    expect(dup.provenance.revealDropped).toBe(REVEAL_DROP_REASONS.UNPARSEABLE);
    const three = holdingKnowledgeAt({ range: range(), revealed: ['K♥', 'Q♠', 'J♦'] });
    expect(three.provenance.revealDropped).toBe(REVEAL_DROP_REASONS.UNPARSEABLE);
  });

  it('records revealedAt only when a holding actually attached', () => {
    const with_ = holdingKnowledgeAt({ range: range(), board: BOARD, revealed: ['K♥', 'Q♠'] });
    expect(with_.provenance.revealedAt).toBe(REVEAL_AT_SHOWDOWN);
    expect(holdingKnowledgeAt({ range: range() }).provenance.revealedAt).toBe(null);
  });
});

describe('provenance — narrowing count', () => {
  it('starts at zero narrowings', () => {
    const k = holdingKnowledgeAt({ range: range(), street: 'flop' });
    expect(k.provenance.narrowingCount).toBe(0);
    expect(k.provenance.narrowedBy).toEqual([]);
    expect(k.provenance.street).toBe('flop');
  });

  it('advances the count and records WHICH action justified each cut', () => {
    // The WS-291 chaining problem was invisible because nothing carried this: a flop range
    // cut three times was indistinguishable from one cut once.
    const k0 = holdingKnowledgeAt({ range: range(), street: 'flop', seat: 5 });
    const k1 = narrowedWith(k0, 'bet', range(0.8));
    const k2 = narrowedWith(k1, 'call', range(0.6));

    expect(k1.provenance.narrowingCount).toBe(1);
    expect(k2.provenance.narrowingCount).toBe(2);
    expect(k2.provenance.narrowedBy).toEqual(['bet', 'call']);
    expect(k2.seat).toBe('5');
    expect(k2.provenance.street).toBe('flop');
  });

  it('makes a thrice-cut range distinguishable from a once-cut one', () => {
    const base = holdingKnowledgeAt({ range: range() });
    const once = narrowedWith(base, 'call', range());
    const thrice = narrowedWith(narrowedWith(once, 'call', range()), 'call', range());
    expect(once.provenance.narrowingCount).not.toBe(thrice.provenance.narrowingCount);
    expect(thrice.provenance.narrowingCount).toBe(3);
  });

  it('leaves the prior record untouched', () => {
    const k0 = holdingKnowledgeAt({ range: range() });
    narrowedWith(k0, 'bet', range(0.5));
    expect(k0.provenance.narrowingCount).toBe(0);
    expect(k0.provenance.narrowedBy).toEqual([]);
  });

  it('carries ground truth across a narrowing, still gated', () => {
    const k0 = holdingKnowledgeAt({ range: range(), board: BOARD, revealed: ['K♥', 'Q♠'] });
    const k1 = narrowedWith(k0, 'bet', range(0.5));
    expect(hasRevealedHolding(k1)).toBe(true);
    expect(k1.provenance.hasRevealed).toBe(true);
    expect(revealedHolding(k1)).toEqual(revealedHolding(k0));
    expect(k1.revealed).toBeUndefined();
    expect({ ...k1 }.revealed).toBeUndefined();
  });

  it('carries absence across a narrowing too', () => {
    const k0 = holdingKnowledgeAt({ range: range() });
    const k1 = narrowedWith(k0, 'bet', range(0.5));
    expect(hasRevealedHolding(k1)).toBe(false);
    expect(revealedHolding(k1)).toBe(null);
  });

  it('requires the action that justified the cut', () => {
    // Dealing a card is not an action — narrowing on a street transition is the off-by-one
    // WS-303 found. Forcing a name makes an unjustifiable cut awkward to write.
    const k = holdingKnowledgeAt({ range: range() });
    expect(() => narrowedWith(k, '', range())).toThrow(HoldingKnowledgeError);
    expect(() => narrowedWith(k, null, range())).toThrow(HoldingKnowledgeError);
    expect(() => narrowedWith({ range: range() }, 'bet', range())).toThrow(HoldingKnowledgeError);
    expect(() => narrowedWith(k, 'bet', new Float64Array(52))).toThrow(HoldingKnowledgeError);
  });
});

describe('provenance — source', () => {
  it('carries the SRC-* id through construction and narrowing', () => {
    // The promoted data-source registry requires provenance to survive the join at row grain.
    const k = holdingKnowledgeAt({ range: range(), source: 'SRC-012' });
    expect(k.provenance.source).toBe('SRC-012');
    expect(narrowedWith(k, 'bet', range()).provenance.source).toBe('SRC-012');
  });
});
