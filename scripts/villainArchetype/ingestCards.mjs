/**
 * ingestCards.mjs — sweep every session's review and put its Conduct Cards in the store.
 *
 * NO SHEBANG, DELIBERATELY — see `reviewSession.mjs`.
 *
 * Cards are currently born inside a `review.json` and die there. This walks the sealed
 * sessions, collects every card, and appends it to the store. Idempotent by construction: the
 * store dedupes on `cardId`, which is now a content identity, so re-running it writes nothing
 * new and says so.
 *
 * RUN
 *   node scripts/villainArchetype/ingestCards.mjs [--sessions <root>] [--cards <root>] [--dry-run]
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { DEFAULT_SESSION_STORE_ROOT, CLOSED_DIR } from '../sessionSink/sessionStore.mjs';
import { appendCards, readCards, latestBySubject, DEFAULT_CARD_STORE_ROOT } from './conductCardStore.mjs';

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { args[a.slice(2)] = next; i += 1; } else args[a.slice(2)] = true;
  }
  return args;
};

/**
 * Every card in one review, tagged with where it came from.
 *
 * PROVENANCE IS ADDED, NOT ASSUMED. A card lifted out of a review and put in a shared store
 * has lost the one piece of context the file path was carrying — which session produced it.
 * For a seat-segment subject that context IS the identity, so it travels as a field.
 */
export const cardsFromReview = (review) => {
  const out = [];
  const sessionId = review?.session?.id ?? null;
  const stamp = (card, role) => ({
    ...card,
    _source: { sessionId, role, stampedAt: review?.stampedAt ?? null },
  });
  if (review?.hero?.conductCard) out.push(stamp(review.hero.conductCard, 'hero'));
  for (const s of review?.opponents?.subjects ?? []) {
    if (s?.card) out.push(stamp(s.card, 'opponent'));
  }
  return out;
};

const main = async () => {
  const args = parseArgs(process.argv);
  const sessionRoot = typeof args.sessions === 'string' ? args.sessions : DEFAULT_SESSION_STORE_ROOT;
  const cardRoot = typeof args.cards === 'string' ? args.cards : DEFAULT_CARD_STORE_ROOT;

  const closed = join(sessionRoot, CLOSED_DIR);
  if (!existsSync(closed)) {
    console.error(`REFUSED: no sealed sessions at ${closed}`);
    process.exit(1);
  }

  const collected = [];
  let reviewsRead = 0;
  let sessionsWithoutReview = 0;
  for (const name of await readdir(closed)) {
    const p = join(closed, name, 'review', 'review.json');
    if (!existsSync(p)) { sessionsWithoutReview += 1; continue; }
    let review;
    try { review = JSON.parse(await readFile(p, 'utf8')); } catch (e) {
      console.error(`  ${name}: review.json unreadable (${e.message}) — skipped, not guessed`);
      continue;
    }
    reviewsRead += 1;
    collected.push(...cardsFromReview(review));
  }

  console.log(`${reviewsRead} review(s) read, ${sessionsWithoutReview} session(s) had none`);
  console.log(`${collected.length} card(s) found`);

  // A collision inside ONE ingest run is worth naming loudly and separately from the store's
  // ordinary dedupe: it means two cards in the same sweep claim one identity, which is the
  // exact defect that made this store unbuildable before today.
  const byId = new Map();
  for (const c of collected) {
    if (!byId.has(c.cardId)) byId.set(c.cardId, []);
    byId.get(c.cardId).push(c);
  }
  const collisions = [...byId.entries()].filter(([, v]) =>
    new Set(v.map((c) => c.subjectId)).size > 1);
  for (const [id, v] of collisions) {
    console.error(`  COLLISION ${id} claimed by ${v.length} different subjects: `
      + v.map((c) => c.subjectId).join(', '));
  }
  if (collisions.length) {
    console.error('REFUSED: one id, several subjects. Storing these would overwrite silently.');
    process.exit(1);
  }

  if (args['dry-run']) {
    console.log(`[dry] would append ${collected.length} card(s) to ${cardRoot}`);
    return;
  }

  const res = await appendCards({ cards: collected, root: cardRoot });
  console.log(`written ${res.written}, duplicate ${res.duplicate}, invalid ${res.invalid.length}`);
  for (const bad of res.invalid) console.error(`  INVALID ${bad.cardId}: ${bad.problems.join('; ')}`);

  const { cards } = await readCards({ root: cardRoot });
  const current = latestBySubject(cards);
  console.log(`store now holds ${cards.length} card(s) across ${current.size} subject(s)`);
};

if (process.argv[1] && process.argv[1].endsWith('ingestCards.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
