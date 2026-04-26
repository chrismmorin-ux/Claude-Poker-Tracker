/**
 * refresherSelectors.test.js — unit coverage for the 6 selectors + the 4
 * state-clear-asymmetry roundtrip tests + partition + memoization guardrail.
 *
 * Per `selectors.md` §State-clear-asymmetry coverage (R-8.1), the selector
 * library guarantees zero data loss across every writer-action roundtrip. The
 * un-suppress roundtrip is the canonical proof: pin 3 cards → suppress class
 * → un-suppress class → all 3 cards still pinned.
 */

import { describe, test, expect } from 'vitest';
import {
  selectAllCards,
  selectActiveCards,
  selectPinnedCards,
  selectSuppressedCards,
  selectCardsForBatchPrint,
  selectStaleCards,
  annotateCard,
} from '../refresherSelectors.js';

const sampleCards = [
  { cardId: 'PRF-MATH-AUTO-PROFIT', class: 'math', title: 'Auto-profit', contentHash: 'sha256:hash-A' },
  { cardId: 'PRF-MATH-POT-ODDS', class: 'math', title: 'Pot odds', contentHash: 'sha256:hash-B' },
  { cardId: 'PRF-PREFLOP-CO-OPEN', class: 'preflop', title: 'CO open', contentHash: 'sha256:hash-C' },
  { cardId: 'PRF-EQUITY-BUCKETS', class: 'equity', title: 'Equity buckets', contentHash: 'sha256:hash-D' },
  { cardId: 'PRF-EXCEPTIONS-FISH-DEEP', class: 'exceptions', title: 'Fish deep', contentHash: 'sha256:hash-E' },
];

const emptyConfig = {
  cardVisibility: {},
  suppressedClasses: [],
};

describe('refresherSelectors — annotateCard', () => {
  test('default visibility + classSuppressed false for a clean config', () => {
    const out = annotateCard(sampleCards[0], emptyConfig);
    expect(out.visibility).toBe('default');
    expect(out.classSuppressed).toBe(false);
  });

  test('visibility derived from cardVisibility map', () => {
    const out = annotateCard(sampleCards[0], { cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'pinned' }, suppressedClasses: [] });
    expect(out.visibility).toBe('pinned');
  });

  test('classSuppressed derived from suppressedClasses array', () => {
    const out = annotateCard(sampleCards[0], { cardVisibility: {}, suppressedClasses: ['math'] });
    expect(out.classSuppressed).toBe(true);
  });

  test('preserves all other card fields (title / contentHash / class)', () => {
    const out = annotateCard(sampleCards[0], emptyConfig);
    expect(out.cardId).toBe('PRF-MATH-AUTO-PROFIT');
    expect(out.title).toBe('Auto-profit');
    expect(out.contentHash).toBe('sha256:hash-A');
    expect(out.class).toBe('math');
  });

  test('isStale + staleSinceBatch initialized to null (set later by selectStaleCards)', () => {
    const out = annotateCard(sampleCards[0], emptyConfig);
    expect(out.isStale).toBeNull();
    expect(out.staleSinceBatch).toBeNull();
  });

  test('unrecognized visibility values fall back to default', () => {
    const out = annotateCard(sampleCards[0], { cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'whatever' }, suppressedClasses: [] });
    expect(out.visibility).toBe('default');
  });
});

describe('refresherSelectors — selectAllCards', () => {
  test('returns every card from the registry', () => {
    const all = selectAllCards({ cardRegistry: sampleCards, userRefresherConfig: emptyConfig });
    expect(all).toHaveLength(5);
  });

  test('annotates each card with visibility + classSuppressed', () => {
    const all = selectAllCards({
      cardRegistry: sampleCards,
      userRefresherConfig: { cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'hidden' }, suppressedClasses: ['exceptions'] },
    });
    const autoProfit = all.find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT');
    expect(autoProfit.visibility).toBe('hidden');
    const exceptionsCard = all.find((c) => c.class === 'exceptions');
    expect(exceptionsCard.classSuppressed).toBe(true);
  });

  test('returns empty array when registry is empty', () => {
    const all = selectAllCards({ cardRegistry: [], userRefresherConfig: emptyConfig });
    expect(all).toEqual([]);
  });

  test('returns empty array when registry is non-array (graceful default)', () => {
    expect(selectAllCards({ cardRegistry: null, userRefresherConfig: emptyConfig })).toEqual([]);
    expect(selectAllCards({ cardRegistry: undefined, userRefresherConfig: emptyConfig })).toEqual([]);
  });
});

describe('refresherSelectors — selectActiveCards', () => {
  test('excludes hidden cards', () => {
    const active = selectActiveCards({
      cardRegistry: sampleCards,
      userRefresherConfig: { cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'hidden' }, suppressedClasses: [] },
    });
    expect(active.find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT')).toBeUndefined();
    expect(active).toHaveLength(4);
  });

  test('excludes class-suppressed cards', () => {
    const active = selectActiveCards({
      cardRegistry: sampleCards,
      userRefresherConfig: { cardVisibility: {}, suppressedClasses: ['math'] },
    });
    expect(active.every((c) => c.class !== 'math')).toBe(true);
    expect(active).toHaveLength(3);
  });

  test('includes pinned cards (pinning un-hides at writer layer; selector trusts contract)', () => {
    const active = selectActiveCards({
      cardRegistry: sampleCards,
      userRefresherConfig: { cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'pinned' }, suppressedClasses: [] },
    });
    expect(active.find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT')).toBeDefined();
  });

  test('combines hide + class-suppress filters', () => {
    const active = selectActiveCards({
      cardRegistry: sampleCards,
      userRefresherConfig: {
        cardVisibility: { 'PRF-PREFLOP-CO-OPEN': 'hidden' },
        suppressedClasses: ['math'],
      },
    });
    // 5 total - 1 hidden preflop - 2 math = 2 (equity + exceptions)
    expect(active).toHaveLength(2);
  });
});

describe('refresherSelectors — selectPinnedCards', () => {
  test('returns only cards with visibility === pinned', () => {
    const pinned = selectPinnedCards({
      cardRegistry: sampleCards,
      userRefresherConfig: {
        cardVisibility: {
          'PRF-MATH-AUTO-PROFIT': 'pinned',
          'PRF-MATH-POT-ODDS': 'hidden',
          'PRF-PREFLOP-CO-OPEN': 'pinned',
        },
        suppressedClasses: [],
      },
    });
    expect(pinned).toHaveLength(2);
    expect(pinned.map((c) => c.cardId).sort()).toEqual(['PRF-MATH-AUTO-PROFIT', 'PRF-PREFLOP-CO-OPEN']);
  });

  test('returns empty array when no cards are pinned', () => {
    const pinned = selectPinnedCards({ cardRegistry: sampleCards, userRefresherConfig: emptyConfig });
    expect(pinned).toEqual([]);
  });
});

describe('refresherSelectors — selectSuppressedCards', () => {
  test('returns hidden cards', () => {
    const suppressed = selectSuppressedCards({
      cardRegistry: sampleCards,
      userRefresherConfig: { cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'hidden' }, suppressedClasses: [] },
    });
    expect(suppressed).toHaveLength(1);
    expect(suppressed[0].cardId).toBe('PRF-MATH-AUTO-PROFIT');
  });

  test('returns class-suppressed cards', () => {
    const suppressed = selectSuppressedCards({
      cardRegistry: sampleCards,
      userRefresherConfig: { cardVisibility: {}, suppressedClasses: ['math'] },
    });
    expect(suppressed).toHaveLength(2);
    expect(suppressed.every((c) => c.class === 'math')).toBe(true);
  });

  test('returns union of hidden + class-suppressed (no duplicates)', () => {
    const suppressed = selectSuppressedCards({
      cardRegistry: sampleCards,
      userRefresherConfig: {
        cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'hidden' }, // already in math (class-suppressed)
        suppressedClasses: ['math'],
      },
    });
    // Both math cards (one hidden + class-suppressed, one only class-suppressed)
    expect(suppressed).toHaveLength(2);
    // Auto-profit appears once
    expect(suppressed.filter((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT')).toHaveLength(1);
  });
});

describe('refresherSelectors — partition (PRF-G5-SL-PARTITION)', () => {
  test('selectActive ∪ selectSuppressed === selectAll, intersection empty', () => {
    const inputs = {
      cardRegistry: sampleCards,
      userRefresherConfig: {
        cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'hidden', 'PRF-PREFLOP-CO-OPEN': 'pinned' },
        suppressedClasses: ['exceptions'],
      },
    };
    const all = selectAllCards(inputs);
    const active = selectActiveCards(inputs);
    const suppressed = selectSuppressedCards(inputs);

    // Union covers all
    const unionIds = new Set([...active.map((c) => c.cardId), ...suppressed.map((c) => c.cardId)]);
    const allIds = new Set(all.map((c) => c.cardId));
    expect(unionIds.size).toBe(allIds.size);
    for (const id of allIds) expect(unionIds.has(id)).toBe(true);

    // Intersection empty
    const activeIds = new Set(active.map((c) => c.cardId));
    const suppressedIds = new Set(suppressed.map((c) => c.cardId));
    for (const id of activeIds) expect(suppressedIds.has(id)).toBe(false);
    for (const id of suppressedIds) expect(activeIds.has(id)).toBe(false);
  });
});

describe('refresherSelectors — selectCardsForBatchPrint', () => {
  test('returns selected cards filtered to active', () => {
    const out = selectCardsForBatchPrint(
      { cardRegistry: sampleCards, userRefresherConfig: emptyConfig },
      ['PRF-MATH-AUTO-PROFIT', 'PRF-PREFLOP-CO-OPEN']
    );
    expect(out.map((c) => c.cardId).sort()).toEqual(['PRF-MATH-AUTO-PROFIT', 'PRF-PREFLOP-CO-OPEN']);
  });

  test('drops selected cards that are hidden (defense-in-depth)', () => {
    const out = selectCardsForBatchPrint(
      {
        cardRegistry: sampleCards,
        userRefresherConfig: { cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'hidden' }, suppressedClasses: [] },
      },
      ['PRF-MATH-AUTO-PROFIT', 'PRF-PREFLOP-CO-OPEN']
    );
    expect(out).toHaveLength(1);
    expect(out[0].cardId).toBe('PRF-PREFLOP-CO-OPEN');
  });

  test('drops selected cards that are class-suppressed', () => {
    const out = selectCardsForBatchPrint(
      {
        cardRegistry: sampleCards,
        userRefresherConfig: { cardVisibility: {}, suppressedClasses: ['exceptions'] },
      },
      ['PRF-EXCEPTIONS-FISH-DEEP', 'PRF-MATH-AUTO-PROFIT']
    );
    expect(out).toHaveLength(1);
    expect(out[0].cardId).toBe('PRF-MATH-AUTO-PROFIT');
  });

  test('returns empty array on empty selectedIds', () => {
    const out = selectCardsForBatchPrint({ cardRegistry: sampleCards, userRefresherConfig: emptyConfig }, []);
    expect(out).toEqual([]);
  });

  test('returns empty array on null selectedIds (graceful default)', () => {
    const out = selectCardsForBatchPrint({ cardRegistry: sampleCards, userRefresherConfig: emptyConfig }, null);
    expect(out).toEqual([]);
  });
});

describe('refresherSelectors — selectStaleCards', () => {
  const recentBatch = {
    batchId: 'batch-recent',
    label: 'Recent print',
    printedAt: '2026-04-25T00:00:00Z',
    cardIds: ['PRF-MATH-AUTO-PROFIT', 'PRF-PREFLOP-CO-OPEN'],
    perCardSnapshots: {
      'PRF-MATH-AUTO-PROFIT': { contentHash: 'sha256:hash-A', version: 'v1.0' },
      'PRF-PREFLOP-CO-OPEN': { contentHash: 'sha256:OLD-PREFLOP', version: 'v1.0' }, // stale
    },
  };
  const olderBatch = {
    batchId: 'batch-older',
    label: null,
    printedAt: '2026-01-01T00:00:00Z',
    cardIds: ['PRF-MATH-AUTO-PROFIT'],
    perCardSnapshots: {
      'PRF-MATH-AUTO-PROFIT': { contentHash: 'sha256:VERY-OLD', version: 'v0.9' }, // ignored — older batch
    },
  };

  test('returns stale cards (current hash differs from printed hash)', () => {
    const stale = selectStaleCards(
      { cardRegistry: sampleCards, userRefresherConfig: emptyConfig },
      [recentBatch]
    );
    expect(stale).toHaveLength(1);
    expect(stale[0].cardId).toBe('PRF-PREFLOP-CO-OPEN');
    expect(stale[0].isStale).toBe(true);
    expect(stale[0].staleSinceBatch).toBe('batch-recent');
    expect(stale[0].printedHash).toBe('sha256:OLD-PREFLOP');
    expect(stale[0].currentHash).toBe('sha256:hash-C');
  });

  test('current cards (matching hash) are not returned', () => {
    const stale = selectStaleCards(
      { cardRegistry: sampleCards, userRefresherConfig: emptyConfig },
      [recentBatch]
    );
    expect(stale.find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT')).toBeUndefined();
  });

  test('cards never printed are not stale', () => {
    const stale = selectStaleCards(
      { cardRegistry: sampleCards, userRefresherConfig: emptyConfig },
      [recentBatch]
    );
    expect(stale.find((c) => c.cardId === 'PRF-EQUITY-BUCKETS')).toBeUndefined();
    expect(stale.find((c) => c.cardId === 'PRF-EXCEPTIONS-FISH-DEEP')).toBeUndefined();
  });

  test('only most-recent batch per card is compared (older batch ignored)', () => {
    // Auto-profit current matches recent batch. Older batch has stale snapshot.
    // The selector must ignore the older batch and report current.
    const stale = selectStaleCards(
      { cardRegistry: sampleCards, userRefresherConfig: emptyConfig },
      [recentBatch, olderBatch]
    );
    expect(stale.find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT')).toBeUndefined();
  });

  test('hidden + class-suppressed cards are not stale (no laminate to be stale)', () => {
    const stale = selectStaleCards(
      {
        cardRegistry: sampleCards,
        userRefresherConfig: {
          cardVisibility: { 'PRF-PREFLOP-CO-OPEN': 'hidden' }, // would be stale, but hidden
          suppressedClasses: [],
        },
      },
      [recentBatch]
    );
    expect(stale).toHaveLength(0);
  });

  test('returns empty array when printBatches is empty', () => {
    const stale = selectStaleCards({ cardRegistry: sampleCards, userRefresherConfig: emptyConfig }, []);
    expect(stale).toEqual([]);
  });

  test('returns empty array when printBatches is null (graceful default)', () => {
    const stale = selectStaleCards({ cardRegistry: sampleCards, userRefresherConfig: emptyConfig }, null);
    expect(stale).toEqual([]);
  });

  test('out-of-order batches sort by printedAt DESC internally', () => {
    // Insert older batch first; recent batch second. Selector must still pick recent.
    const stale = selectStaleCards(
      { cardRegistry: sampleCards, userRefresherConfig: emptyConfig },
      [olderBatch, recentBatch]
    );
    expect(stale.find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// State-clear-asymmetry roundtrip tests (R-8.1 — `selectors.md` §coverage)
// ─────────────────────────────────────────────────────────────────────────

describe('PRF-G5-SL-ROUNDTRIP-PIN — pin card writer + selector pair', () => {
  test('pinned card is in selectActive + selectPinned, not in selectSuppressed', () => {
    const inputs = {
      cardRegistry: sampleCards,
      userRefresherConfig: { cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'pinned' }, suppressedClasses: [] },
    };
    expect(selectActiveCards(inputs).find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT')).toBeDefined();
    expect(selectPinnedCards(inputs).find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT')).toBeDefined();
    expect(selectSuppressedCards(inputs).find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT')).toBeUndefined();
  });
});

describe('PRF-G5-SL-ROUNDTRIP-HIDE — hide card writer + selector pair', () => {
  test('hidden card is in selectAll (annotated) + selectSuppressed, not in selectActive', () => {
    const inputs = {
      cardRegistry: sampleCards,
      userRefresherConfig: { cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'hidden' }, suppressedClasses: [] },
    };
    const allEntry = selectAllCards(inputs).find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT');
    expect(allEntry).toBeDefined();
    expect(allEntry.visibility).toBe('hidden');
    expect(selectSuppressedCards(inputs).find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT')).toBeDefined();
    expect(selectActiveCards(inputs).find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT')).toBeUndefined();
  });
});

describe('PRF-G5-SL-ROUNDTRIP-SUPPRESS — suppress class writer + selector pair', () => {
  test('all cards of suppressed class excluded from selectActive + included in selectAll w/ classSuppressed', () => {
    const inputs = {
      cardRegistry: sampleCards,
      userRefresherConfig: { cardVisibility: {}, suppressedClasses: ['math'] },
    };
    const all = selectAllCards(inputs);
    const active = selectActiveCards(inputs);
    const suppressed = selectSuppressedCards(inputs);

    const mathCards = sampleCards.filter((c) => c.class === 'math');
    expect(active.filter((c) => c.class === 'math')).toHaveLength(0);
    expect(suppressed.filter((c) => c.class === 'math')).toHaveLength(mathCards.length);
    for (const c of all.filter((c) => c.class === 'math')) {
      expect(c.classSuppressed).toBe(true);
    }
  });
});

describe('PRF-G5-SL-ROUNDTRIP-UNSUPPRESS — un-suppress preserves per-card pin/hide state (zero data loss)', () => {
  test('canonical proof: pin 3 cards → suppress class → un-suppress class → all 3 still pinned', () => {
    // This test simulates the writer-level state evolution by constructing
    // intermediate userRefresherConfig snapshots. The selector library must
    // produce consistent reads at each step. Zero data loss is asserted by
    // comparing pinned-card sets before suppression and after un-suppression.

    const t0_threeCardsPinned = {
      cardVisibility: {
        'PRF-MATH-AUTO-PROFIT': 'pinned',
        'PRF-MATH-POT-ODDS': 'pinned',
        'PRF-PREFLOP-CO-OPEN': 'pinned',
      },
      suppressedClasses: [],
    };

    // Step 1: 3 cards pinned at t0
    const t0Inputs = { cardRegistry: sampleCards, userRefresherConfig: t0_threeCardsPinned };
    const pinnedAtT0 = selectPinnedCards(t0Inputs).map((c) => c.cardId).sort();
    expect(pinnedAtT0).toEqual(['PRF-MATH-AUTO-PROFIT', 'PRF-MATH-POT-ODDS', 'PRF-PREFLOP-CO-OPEN']);

    // Step 2: Suppress 'math' class. The 2 math pin entries are PRESERVED in
    // cardVisibility (the writer doesn't clear them — durability per red line #13).
    // The selectors hide the math cards from active, but the underlying state is intact.
    const t1_classSuppressed = {
      cardVisibility: t0_threeCardsPinned.cardVisibility, // unchanged
      suppressedClasses: ['math'],
    };
    const t1Inputs = { cardRegistry: sampleCards, userRefresherConfig: t1_classSuppressed };
    expect(selectActiveCards(t1Inputs).find((c) => c.class === 'math')).toBeUndefined();
    // selectAll still annotates them as classSuppressed AND visibility='pinned'
    const allAtT1 = selectAllCards(t1Inputs);
    const autoProfitT1 = allAtT1.find((c) => c.cardId === 'PRF-MATH-AUTO-PROFIT');
    expect(autoProfitT1.visibility).toBe('pinned');
    expect(autoProfitT1.classSuppressed).toBe(true);

    // Step 3: Un-suppress 'math' class. cardVisibility unchanged through the cycle.
    const t2_classUnsuppressed = {
      cardVisibility: t0_threeCardsPinned.cardVisibility,
      suppressedClasses: [], // un-suppressed
    };
    const t2Inputs = { cardRegistry: sampleCards, userRefresherConfig: t2_classUnsuppressed };
    const pinnedAtT2 = selectPinnedCards(t2Inputs).map((c) => c.cardId).sort();
    expect(pinnedAtT2).toEqual(pinnedAtT0); // canonical zero-data-loss assertion
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Memoization guardrail (PRF-G5-SL-MEMOIZATION)
// ─────────────────────────────────────────────────────────────────────────

describe('refresherSelectors — purity / referential stability of inputs', () => {
  test('selectors do not mutate cardRegistry or userRefresherConfig', () => {
    const config = { cardVisibility: { 'PRF-MATH-AUTO-PROFIT': 'pinned' }, suppressedClasses: ['exceptions'] };
    const registry = [...sampleCards];
    const configClone = JSON.parse(JSON.stringify(config));
    const registryClone = JSON.parse(JSON.stringify(registry));

    selectAllCards({ cardRegistry: registry, userRefresherConfig: config });
    selectActiveCards({ cardRegistry: registry, userRefresherConfig: config });
    selectSuppressedCards({ cardRegistry: registry, userRefresherConfig: config });

    expect(config).toEqual(configClone);
    expect(registry).toEqual(registryClone);
  });

  test('selectors are deterministic — same inputs → equal output (deep-equal)', () => {
    const inputs = { cardRegistry: sampleCards, userRefresherConfig: emptyConfig };
    const a = selectActiveCards(inputs);
    const b = selectActiveCards(inputs);
    expect(a).toEqual(b);
    expect(a.length).toBe(b.length);
  });
});
