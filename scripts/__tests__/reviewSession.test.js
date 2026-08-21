/**
 * reviewSession.test.js — the session review, on a session that was really played.
 *
 * The hands here are the founder's own, replayed through the production producer path and
 * sealed by the real sink. What is under test is not "does it run" but the four claims the
 * output makes, each of which would be a lie if the code drifted:
 *
 *   1. CARDS-KNOWN. Every hero decision carries hero's actual hole cards, folds included. This
 *      is the arm the corpus structurally cannot produce, and the runner asserts it in prose —
 *      so it had better be measured, not assumed.
 *   2. EVERY HAND ACCOUNTED FOR. Read = adapted + skipped, with named skip reasons.
 *   3. THE MONEY ARM REFUSES rather than silently pricing against the 2009 corpus.
 *   4. THE SUBJECT IS A SEAT, NOT A PERSON. Ignition carries no player identity; a card that
 *      implied otherwise would be a confident wrong artifact.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TableManager } from '../../ignition-poker-tracker/shared/table-manager.js';
import { openSession } from '../sessionSink/sessionStore.mjs';
import { reviewSession, resolveSubjects, REFUSALS } from '../villainArchetype/reviewSession.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const CAPTURE = join(REPO, 'ignition-poker-tracker/spike-data/captures',
  'ignition-frames-2026-06-19T06-48-05-980Z.jsonl');

let root;
let sealedDir;
let review;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'review-session-'));

  const captured = [];
  const tm = new TableManager((r) => captured.push(r), () => {});
  for (const line of readFileSync(CAPTURE, 'utf8').split('\n')) {
    if (!line) continue;
    let f;
    try { f = JSON.parse(line); } catch { continue; }
    if (f.kind !== 'msg') continue;
    try { tm.routeMessage(f.connId, f.data, f.url); } catch { /* the producer swallows too */ }
  }

  const t0 = Date.parse('2026-06-19T06:00:00Z');
  const s = await openSession({ tableId: 'table_real', startedAt: new Date(t0).toISOString(), root });
  let i = 0;
  for (const h of captured) {
    await s.accept({ ...h, captureId: `${h.tableId}_${h.ignitionMeta?.handNumber ?? i}` }, t0 + (i++) * 60_000);
  }
  const m = await s.seal({ reason: 'test' });
  sealedDir = m.dir;

  const out = await reviewSession({ sessionDir: sealedDir, now: () => '2026-08-21T00:00:00.000Z' });
  expect(out.ok).toBe(true);
  review = out.review;
}, 120_000);

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('claim 1 — the unbiased cards-known arm', () => {
  it('knows hero\'s hole cards on EVERY decision, folds included', () => {
    expect(review.hero.decisions).toBeGreaterThan(20);
    // The whole reason this instrument beats the corpus arm. Anything below 1.0 means the
    // adapter stopped injecting hero's cards and the prose claim has become false.
    expect(review.hero.cardsKnownFraction).toBe(1);
    expect(review.hero.cardsKnownClaim).toMatch(/UNBIASED CARDS-KNOWN/);
  });

  it('includes fold decisions — the ones a showdown-conditioned corpus arm can never see', () => {
    // A showdown-only subset contains zero folds by construction; this one must not.
    expect(review.hero.decisions).toBeGreaterThan(0);
    expect(review.hero.handsSeated).toBeGreaterThan(0);
    const gate = review.gates.find((g) => g.name === 'cards-known on hero decisions');
    expect(gate.ok).toBe(true);
  });
});

describe('claim 2 — every hand is accounted for', () => {
  it('reconciles read against adapted plus named skips', () => {
    expect(review.intake.reconciles).toBe(true);
    const skipped = Object.values(review.intake.skipped).reduce((a, b) => a + b, 0);
    expect(review.intake.handsRead).toBe(review.intake.adapted + skipped);
  });

  it('names why each dropped hand was dropped, rather than reporting a bare count', () => {
    for (const reason of Object.keys(review.intake.skipped)) {
      expect(reason).toMatch(/^[a-z-]+$/);
    }
  });
});

describe('claim 3 — the money arm refuses instead of substituting the corpus', () => {
  it('refuses with a named reason when no field policy exists', () => {
    expect(review.money.refused).toBe(true);
    expect(review.money.reason).toBe(REFUSALS.NO_FIELD_POLICY);
  });

  it('marks the corpus policy explicitly UNUSABLE for a live claim rather than falling back', () => {
    expect(review.money.arms.corpus.usable).toBe(false);
    expect(review.money.arms.corpus.why).toMatch(/levels transfer/i);
  });

  it('states what would resolve it — a limitation is a thing to remove', () => {
    expect(review.money.resolvedBy).toMatch(/field policy/i);
  });

  it('leaves the equilibrium pier post UNAVAILABLE rather than faking it', () => {
    // equilibriumPost.mjs returns null by design; substituting the "GTO-approximate" charts is
    // exactly what it refuses to do, and this review must not do it either.
    expect(review.money.pierPosts.lower).toMatch(/UNAVAILABLE, not faked/);
  });
});

describe('claim 4 — the subject is a seat, and the artifact says so', () => {
  it('identifies subjects by seat segment, because Ignition carries no player identity', () => {
    expect(review.opponents.identityBasis).toBe('seat-segment');
    for (const s of review.opponents.subjects) {
      expect(s.identityBasis).toBe('seat-segment');
      expect(s.identity).toBeNull();
      expect(s.subjectId).toMatch(/^seat\d+#s\d+$/);
    }
  });

  it('carries the caveat on the artifact, not just in a source comment', () => {
    expect(review.opponents.caveat).toMatch(/no player identity/i);
    expect(review.opponents.caveat).toMatch(/SEAT-OCCUPANCY SEGMENT/);
  });

  it('refuses a card for a subject too thin to induce, rather than emitting a vacuous one', () => {
    const refused = review.opponents.subjects.filter((s) => !s.card);
    expect(refused.length).toBeGreaterThan(0);
    for (const s of refused) {
      expect(s.refusal.reason).toBe(REFUSALS.THIN);
      // Names the shortfall, never a bare "not enough data".
      expect(s.refusal.resolvedBy).toMatch(/more decisions/);
    }
  });
});

describe('the seat-change heuristic', () => {
  const bb = 2;
  const mk = (handSeats, stacks) => ({
    hand: {
      seatPlayers: Object.fromEntries(handSeats.map((s) => [String(s), `seat_${s}`])),
      gameState: { mySeat: 9, actionSequence: [], dealerButtonSeat: 1, communityCards: [] },
      handId: `h${Math.random()}`,
    },
    source: { ignitionMeta: { blinds: { sb: 1, bb }, startStacks: stacks } },
  });

  it('does NOT split when a player merely wins a big pot — they never left the table', () => {
    const adapted = [
      mk([3], { 3: 100 * bb }),
      mk([3], { 3: 160 * bb }), // won 60bb; same human
      mk([3], { 3: 155 * bb }),
    ];
    const { subjects, segmentSplits } = resolveSubjects(adapted, 9);
    expect(segmentSplits).toBe(0);
    expect(subjects.map((s) => s.subjectId)).toEqual(['seat3#s1']);
  });

  it('splits when the seat went EMPTY and someone sat down with a different stack', () => {
    const adapted = [
      mk([3], { 3: 40 * bb }),
      mk([], {}),                 // seat 3 vacant — the only moment a swap can happen
      mk([3], { 3: 100 * bb }),   // back, with a fresh buy-in
    ];
    const { segmentSplits, subjects } = resolveSubjects(adapted, 9);
    expect(segmentSplits).toBe(1);
    expect(subjects.map((s) => s.subjectId).sort()).toEqual(['seat3#s1', 'seat3#s2']);
  });

  it('does NOT split on a vacancy alone when the stack is unchanged — probably sat out a hand', () => {
    const adapted = [
      mk([3], { 3: 100 * bb }),
      mk([], {}),
      mk([3], { 3: 100 * bb }),
    ];
    expect(resolveSubjects(adapted, 9).segmentSplits).toBe(0);
  });
});

/**
 * REGRESSION, and the reason it exists is worth keeping.
 *
 * The first cut ranked hands by `r.priceBB ?? r.amountBB`, and NEITHER FIELD EXISTS on a
 * labelled decision row. Every hand therefore scored 0, the ranking silently degraded to
 * decision-count, and the rendered page printed "0.0" in a money column as though it were a
 * measurement. Fifteen tests passed over it — none of them looked at the value, only at the
 * shape. A number that is always zero is exactly what a shape assertion cannot see.
 */
describe('the money columns carry real numbers, not a silent zero', () => {
  it('reports non-zero chips for hands hero actually put money into', () => {
    const hands = review.notable.hands;
    expect(hands.length).toBeGreaterThan(3);
    const invested = hands.map((h) => h.investedBB);
    expect(invested.some((v) => v > 0)).toBe(true);
    // The top-ranked hand is the one hero committed most to; a zero there means the field
    // name is wrong again.
    expect(hands[0].investedBB).toBeGreaterThan(0);
    expect(hands[0].potPeakBB).toBeGreaterThan(0);
  });

  it('ranks by what hero put in, descending', () => {
    const invested = review.notable.hands.map((h) => h.investedBB);
    const sorted = [...invested].sort((a, b) => b - a);
    expect(invested).toEqual(sorted);
  });

  it('never reports hero investing more than the pot he was facing', () => {
    for (const h of review.notable.hands) {
      // A sanity bound on the units: if invested were summed instead of maxed it would blow
      // past the pot immediately.
      expect(h.investedBB).toBeLessThanOrEqual(h.potPeakBB + 0.001);
    }
  });
});

describe('the rendered page', () => {
  it('renders without throwing and states the load-bearing facts', async () => {
    const { renderSessionReview } = await import('../villainArchetype/renderSessionReview.mjs');
    const html = renderSessionReview(review);
    expect(html).toContain('Session review');
    // The refusal must be visible on the page, not buried in the JSON.
    expect(html).toContain('unexamined:no-field-policy');
    // The seat-not-a-person caveat must reach the reader.
    expect(html).toMatch(/no player identity/i);
    // And the money column must show a real figure.
    expect(html).toContain(review.notable.hands[0].investedBB.toFixed(1));
  });

  it('escapes content rather than interpolating it raw', async () => {
    const { renderSessionReview } = await import('../villainArchetype/renderSessionReview.mjs');
    const poisoned = JSON.parse(JSON.stringify(review));
    poisoned.population = '<script>alert(1)</script>';
    const html = renderSessionReview(poisoned);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('reproducibility', () => {
  /**
   * Explicit timeout, not the 5s default. A full review of this 54-hand capture takes ~5s on
   * its own, so under parallel suite load it tipped over the default and reported as a hash
   * mismatch it never was — determinism was verified separately across a deliberate delay.
   * Rebuilding the whole review is the point of the test, so the cost is inherent.
   */
  it('produces a stable content hash for the same session and clock', async () => {
    const again = await reviewSession({ sessionDir: sealedDir, now: () => '2026-08-21T00:00:00.000Z' });
    expect(again.review.contentHash).toBe(review.contentHash);
  }, 120_000);
});
