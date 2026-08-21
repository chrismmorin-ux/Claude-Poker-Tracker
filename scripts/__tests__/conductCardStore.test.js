/**
 * conductCardStore.test.js — the store, and the identity defect that made it unbuildable.
 *
 * MEASURED 2026-08-21, across twelve real sessions: `cardId` collided. Two hero cards from two
 * different sessions, and two seat-8 cards describing two different humans, shared one id:
 *
 *     CC-herosess2026-643d1dd2
 *     CC-seat8s1-643d1dd2
 *
 * The cause was a readable prefix doing identity work — `subjectId.slice(0, 12)` truncated
 * away the session segment. An append-only store keyed on that would have DEDUPED two
 * different cards into one and reported success.
 *
 * These tests hold both halves of the fix: the id is a content identity, and a seat-segment
 * subject is scoped to its session.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  appendCards, readCards, bySubject, latestBySubject, supersededFor,
} from '../villainArchetype/conductCardStore.mjs';
import { cardsFromReview } from '../villainArchetype/ingestCards.mjs';

let root;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'cardstore-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

/**
 * A REAL card, captured from a regenerated session review, with only identity fields varied.
 *
 * NOT hand-built. The Conduct Card schema is at v4 with fifteen required fields, several of
 * them nested (`sizingBanding`, `separatorSearch`, `gates`, `manifest`). The first cut of this
 * fixture was written from memory of the shape, failed `conductCardProblems` on nine fields at
 * once, and would — had the store not validated on write — have made every test here pass
 * against an object the real pipeline never produces.
 *
 * Using a real artifact means the store is tested against the thing it will actually hold, and
 * a future schema bump surfaces here instead of in production.
 */
const REAL = JSON.parse(
  readFileSync(new URL('./__fixtures__/conduct-card-real.json', import.meta.url), 'utf8'),
);

const mkCard = (over = {}) => ({
  ...structuredClone(REAL),
  cardId: 'CC-test-0000000000000000',
  subjectId: 'sess-A:seat3#s1',
  ...over,
});

const withDecisions = (cardId, decisions) => mkCard({
  cardId,
  dealBook: { ...structuredClone(REAL).dealBook, decisions },
});

describe('appendCards', () => {
  it('writes a card and reads it back', async () => {
    const r = await appendCards({ cards: [mkCard()], root });
    // If the fixture is invalid the store refuses it, and a test that only checked
    // `written >= 0` would sail past that. Assert the refusal list is empty and say why.
    expect(r.invalid).toEqual([]);
    expect(r.written).toBe(1);
    const { cards } = await readCards({ root });
    expect(cards).toHaveLength(1);
    expect(cards[0].subjectId).toBe('sess-A:seat3#s1');
  });

  it('drops an exact re-derivation instead of storing it twice', async () => {
    await appendCards({ cards: [mkCard()], root });
    const again = await appendCards({ cards: [mkCard()], root });
    expect(again.written).toBe(0);
    expect(again.duplicate).toBe(1);
    const { cards } = await readCards({ root });
    expect(cards).toHaveLength(1);
  });

  it('KEEPS a superseded card rather than overwriting it', async () => {
    // Never delete for a null result: the old card still says what was believed when it was
    // current, and "what did this player look like before tonight" has to stay answerable.
    await appendCards({ cards: [withDecisions('CC-a-1', 20)], root });
    await appendCards({ cards: [withDecisions('CC-a-2', 60)], root });
    const { cards } = await readCards({ root });
    expect(cards).toHaveLength(2);
    expect(supersededFor(cards, 'sess-A:seat3#s1')).toHaveLength(1);
  });

  it('rejects an invalid card instead of storing something uninterpretable', async () => {
    const r = await appendCards({ cards: [{ cardId: 'CC-broken', kind: 'conduct-card' }], root });
    expect(r.written).toBe(0);
    expect(r.invalid).toHaveLength(1);
    expect(r.invalid[0].cardId).toBe('CC-broken');
    const { cards } = await readCards({ root });
    expect(cards).toHaveLength(0);
  });

  it('returns an empty store rather than throwing when nothing has been written', async () => {
    const { cards, sets } = await readCards({ root });
    expect(cards).toEqual([]);
    expect(sets).toEqual([]);
  });

  it('writes NO set at all when every card is already known', async () => {
    // An ingest that finds nothing new must not leave an empty sealed set behind. Repeated
    // ingests are the normal case, and a store littered with empty sets is harder to read
    // than one that says "unchanged".
    await appendCards({ cards: [mkCard()], root });
    const before = (await readCards({ root })).sets.length;
    const again = await appendCards({ cards: [mkCard()], root });
    expect(again.unchanged).toBe(true);
    expect(again.written).toBe(0);
    expect((await readCards({ root })).sets).toHaveLength(before);
  });

  it('gives the same batch id to the same set of cards, so a re-run is a no-op', async () => {
    const a = await appendCards({ cards: [withDecisions('CC-x', 10)], root });
    const fresh = await mkdtemp(join(tmpdir(), 'cardstore2-'));
    try {
      const b = await appendCards({ cards: [withDecisions('CC-x', 10)], root: fresh });
      // Derived from content, not from a clock: a timestamped id would have written a second
      // copy under a new name on every run.
      expect(b.batchId).toBe(a.batchId);
    } finally {
      await rm(fresh, { recursive: true, force: true });
    }
  });
});

describe('latestBySubject — evidence, not write order', () => {
  it('picks the card with MORE decisions even when the thin one was written last', async () => {
    // A backfill can write a 2-hand card after a 40-hand one purely from processing order.
    // "Latest write" would hand the caller the thinner card and look perfectly healthy.
    const fat = withDecisions('CC-a-fat', 90);
    const thin = withDecisions('CC-a-thin', 4);
    await appendCards({ cards: [fat, thin], root });
    const { cards } = await readCards({ root });
    expect(latestBySubject(cards).get('sess-A:seat3#s1').cardId).toBe('CC-a-fat');
  });

  it('groups by subject, never by card id', async () => {
    await appendCards({
      cards: [
        mkCard({ cardId: 'CC-a-1' }),
        mkCard({ cardId: 'CC-b-1', subjectId: 'sess-B:seat3#s1' }),
      ],
      root,
    });
    const { cards } = await readCards({ root });
    const groups = bySubject(cards);
    // Same seat number, different sessions — two subjects, because they are two people.
    expect(groups.size).toBe(2);
    expect([...groups.keys()].sort()).toEqual(['sess-A:seat3#s1', 'sess-B:seat3#s1']);
  });
});

describe('cardsFromReview', () => {
  const review = {
    session: { id: 'sess-A' },
    stampedAt: '2026-08-21T00:00:00.000Z',
    hero: { conductCard: { cardId: 'CC-hero', subjectId: 'hero-sess-A' } },
    opponents: {
      subjects: [
        { card: { cardId: 'CC-o1', subjectId: 'sess-A:seat3#s1' } },
        { card: null },
        { card: { cardId: 'CC-o2', subjectId: 'sess-A:seat4#s1' } },
      ],
    },
  };

  it('collects hero and opponent cards and skips subjects that refused', () => {
    const cards = cardsFromReview(review);
    expect(cards.map((c) => c.cardId)).toEqual(['CC-hero', 'CC-o1', 'CC-o2']);
  });

  it('stamps the originating session, because for a seat segment that IS the identity', () => {
    const cards = cardsFromReview(review);
    for (const c of cards) expect(c._source.sessionId).toBe('sess-A');
    expect(cards[0]._source.role).toBe('hero');
    expect(cards[1]._source.role).toBe('opponent');
  });

  it('returns nothing rather than throwing on a review with no cards', () => {
    expect(cardsFromReview({})).toEqual([]);
    expect(cardsFromReview({ hero: {}, opponents: { subjects: [] } })).toEqual([]);
  });
});
