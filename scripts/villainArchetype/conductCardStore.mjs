/**
 * conductCardStore.mjs — where Conduct Cards live once they exist.
 *
 * NO SHEBANG, DELIBERATELY — see `reviewSession.mjs`. Imported by tests.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS — MEASURED, 2026-08-21
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Before this file there was no card store at all. Every Conduct Card the pipeline had ever
 * produced — ten of them, two hero and eight opponent — existed only INSIDE the `review.json`
 * of the session that made it. `docs/standard-of-record/cards/` held four Result Cards and
 * zero Conduct Cards.
 *
 * That makes three things impossible, and they are exactly the three the founder asked for:
 *
 *   - "pull up this villain's card"      — nothing to query; you would re-derive per session
 *   - "alert me to spots I missed"       — an alert needs a card that outlives its session
 *   - "how did the table's dynamics go"  — needs the cards side by side, not one per file
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE STORE IS A SET PER BATCH, NOT ONE GROWING FILE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `openNdjsonWriter` is a ONE-SHOT capture writer: it opens with `'ax'`, writes, and finalizes
 * with a manifest and a content hash. Reopening a set is an error in both directions — with a
 * manifest it is ALREADY_FINALIZED, without one it is an INTERRUPTED capture. That is not a
 * limitation to work around, it is the guarantee that makes a sealed set citable.
 *
 * So the store accumulates the way the session store does: by adding immutable sealed SETS,
 * one per ingest batch, each with its own manifest. `readCards` reads across all of them.
 * Nothing is ever appended to a set that has been sealed.
 *
 * The batch id is derived from the card ids it contains, so running the same ingest twice
 * produces the same id and writes nothing the second time.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * KEYED ON A CONTENT IDENTITY. IT NEVER OVERWRITES.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * A card is (subject, ruleset, deal book). Re-deriving the same subject from the same hands
 * under the same rules produces the same `cardId` and is a genuine duplicate — it is dropped.
 * Anything else is a DIFFERENT card and is kept beside its siblings, because "what did this
 * player's card look like before tonight" is a question the record has to be able to answer.
 *
 * Superseding is a READ-TIME judgement (`latestBySubject`), never a write-time deletion. The
 * repo has one standing rule about this and it is not negotiable: never delete for a null
 * result. A card that was replaced still says what was believed when it was current.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LOCATION
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Beside the session store, outside the repo, per `.claude/rules/artifact-location.md`:
 * cards are machine-produced and re-derivable from hands that are themselves out here. What
 * stays in the repo is the code that makes them.
 */

import { mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { openNdjsonWriter, readLenient, readManifest } from '../lib/ndjsonStore.mjs';
import { conductCardProblems } from '../../src/utils/standardOfRecord/conductCard.js';

export const DEFAULT_CARD_STORE_ROOT =
  process.env.POKER_CARD_STORE || 'C:/Users/chris/data/poker-cards';

export const CARDS_FILE = 'cards.ndjson';

/**
 * MEASURED, not estimated — the same rule the session store applies to its own bytes/hand.
 *
 * Across the ten cards in existence on 2026-08-21 the largest serialized to 32,236 bytes. The
 * budget carries headroom above that because a card grows with the number of rules induced,
 * and ten cards from two sessions is not a sample of how big one can get.
 */
export const MEASURED_CARD_BYTES = Object.freeze({ measuredMax: 32236, max: 65536 });
export const EXPECTED_CARDS = 20000;

/**
 * Add cards to the store as one new sealed set.
 *
 * REJECTS AN INVALID CARD RATHER THAN STORING IT. `conductCardProblems` is the same validator
 * `emitConductCard` runs before it returns one; running it again here is not redundant, it is
 * the boundary check — a store that accepts a malformed card turns a build-time error into a
 * permanent record nobody can interpret.
 *
 * Dedupe is against the WHOLE store, not just this batch, so an id already recorded in an
 * earlier set is a duplicate and not a second copy.
 */
export const appendCards = async ({
  cards,
  root = DEFAULT_CARD_STORE_ROOT,
  now = () => new Date().toISOString(),
}) => {
  await mkdir(root, { recursive: true });

  const existing = await readCards({ root });
  const known = new Set(existing.cards.map((c) => c.cardId));

  const result = { written: 0, duplicate: 0, invalid: [], batchId: null, dir: null };
  const admit = [];
  const seenThisBatch = new Set();

  for (const card of cards) {
    if (!card?.cardId) { result.invalid.push({ cardId: null, problems: ['no cardId'] }); continue; }
    const problems = conductCardProblems(card);
    if (problems.length) { result.invalid.push({ cardId: card.cardId, problems }); continue; }
    if (known.has(card.cardId) || seenThisBatch.has(card.cardId)) { result.duplicate += 1; continue; }
    seenThisBatch.add(card.cardId);
    admit.push(card);
  }

  // Nothing new is a real outcome, not a failure — and it must NOT create an empty sealed set.
  // A store littered with empty sets from repeated ingests is harder to read than one that
  // says "nothing changed".
  if (admit.length === 0) {
    return { ...result, count: existing.cards.length, unchanged: true };
  }

  /**
   * The batch id is a hash of the ids it carries, so the same ingest run twice resolves to the
   * same set. Combined with the dedupe above, a re-run is a no-op rather than a second copy
   * under a fresh timestamp — which is what a clock-derived id would have produced.
   */
  const batchId = `batch-${createHash('sha256')
    .update(admit.map((c) => c.cardId).sort().join('|')).digest('hex').slice(0, 16)}`;
  const dir = join(root, batchId);

  const writer = await openNdjsonWriter({
    setId: batchId,
    root,
    dir,
    dataFile: CARDS_FILE,
    idField: 'cardId',
    manifestExtras: { kind: 'conduct-card-set' },
    expectedRecords: admit.length,
    bytesPerRecord: MEASURED_CARD_BYTES.max,
    checkpointEveryRecords: 25,
    now,
  });

  for (const card of admit) {
    await writer.append(card);
    result.written += 1;
  }
  const manifest = await writer.finalize({ extras: { sealedReason: 'ingest' } });

  return {
    ...result,
    batchId,
    dir,
    manifestHash: manifest?.hash ?? null,
    count: existing.cards.length + result.written,
    unchanged: false,
  };
};

/** Every card in the store, across every sealed set, oldest set first. */
export const readCards = async ({ root = DEFAULT_CARD_STORE_ROOT } = {}) => {
  if (!existsSync(root)) return { cards: [], corruptTail: false, sets: [], root };

  const names = (await readdir(root, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const cards = [];
  const sets = [];
  let corruptTail = false;
  for (const name of names) {
    const dir = join(root, name);
    if (!existsSync(join(dir, CARDS_FILE))) continue;
    const { records, corruptTail: torn } = await readLenient(join(dir, CARDS_FILE));
    // A torn set is REPORTED, never silently dropped — its intact rows are real cards and the
    // tear is a fact about the store a caller should be able to see.
    if (torn) corruptTail = true;
    sets.push({ setId: name, dir, count: records.length, corruptTail: torn, manifest: await readManifest(dir) });
    cards.push(...records);
  }
  return { cards, corruptTail, sets, root };
};

/**
 * Cards grouped by subject, so "everything known about this player" is one lookup.
 *
 * The grouping key is `subjectId`, NOT `cardId` — that split is the whole point of the two
 * fields. `cardId` identifies one derivation; `subjectId` is the join. A seat-segment subject
 * is session-scoped and so groups to exactly one session by construction; a real `player:<id>`
 * subject accumulates across all of them, which is the only reason a stable player identity is
 * worth anything.
 */
export const bySubject = (cards) => {
  const out = new Map();
  for (const c of cards) {
    const k = c?.subjectId;
    if (!k) continue;
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(c);
  }
  return out;
};

/**
 * The current card per subject — the most DECISIONS observed, not the most recent write.
 *
 * Recency is the wrong axis and it is worth saying why, because it is the obvious choice. A
 * backfill can write a two-hand card after a forty-hand one purely because of processing
 * order, and "latest" would then hand a caller the thinner card. Evidence is the axis that
 * means something; write order is an accident of when a script ran.
 *
 * Ties break toward the later write, which is the only thing recency is good for.
 */
export const latestBySubject = (cards) => {
  const out = new Map();
  const groups = bySubject(cards);
  for (const [subjectId, list] of groups) {
    let best = null;
    for (const c of list) {
      const n = c?.dealBook?.decisions ?? c?.evidence?.decisions ?? 0;
      const bestN = best?.dealBook?.decisions ?? best?.evidence?.decisions ?? -1;
      if (best === null || n >= bestN) best = c;
    }
    out.set(subjectId, best);
  }
  return out;
};

/** Read the store and return the superseded cards, so a caller can show what changed. */
export const supersededFor = (cards, subjectId) => {
  const list = bySubject(cards).get(subjectId) ?? [];
  const current = latestBySubject(cards).get(subjectId);
  return list.filter((c) => c !== current);
};
