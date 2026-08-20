/**
 * Known-answer check on the Conduct Card's contentHash.
 *
 * CLAIM UNDER TEST (independent audit): `canonical` at emitConductCard.mjs:39 is
 *     JSON.stringify(card, Object.keys(card).sort())
 * and the second argument to JSON.stringify is a REPLACER ALLOWLIST that applies at EVERY
 * DEPTH, not a key ordering. If so, every nested object is filtered down to keys that happen to
 * share a name with a top-level field, and the hash discriminates almost nothing.
 *
 * PRE-REGISTERED, before running:
 *   IF the claim is FALSE, mutating any nested value changes the hash.
 *   IF the claim is TRUE, I can corrupt every rate, every interval, every shown holding, the
 *   deal book hash, the engine commit, and flip all 23 gates to FAILED, and the hash will not
 *   move. That would mean every downstream citation of a card by contentHash is citing a
 *   rule count.
 *
 * Adds and removes NO top-level key. Nested values only.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonical } from '../emitConductCard.mjs';

const path = process.env.CARD || '.tmp-arch/v2re/profile/jSCaL6Fm4lAi.conduct-card.json';
const card = JSON.parse(readFileSync(path, 'utf8'));

// Reproduce the emitter's canonicalization exactly (emitConductCard.mjs:39-41).
// canonical is IMPORTED, never redefined here - see the note in emitConductCard.mjs.
const hashOf = (c) => {
  const { contentHash, ...rest } = c;
  return 'sha256:' + createHash('sha256').update(canonical(rest)).digest('hex');
};

const before = hashOf(card);
const body = canonical((({ contentHash, ...r }) => r)(card));

const sabotaged = JSON.parse(JSON.stringify(card));
// Corrupt every load-bearing nested value. No top-level key added or removed.
for (const r of sabotaged.rules) {
  r.n = 999999;
  r.when = 'TOTAL FABRICATION';
  r.verdict = 'always';
  for (const a of r.actions) { a.k = 1; a.rate = 0.999; a.ci = [0.0, 1.0]; a.action = 'WRONG'; }
  if (r.shown) for (const s of r.shown) { s.cards = 'XX'; s.action = 'WRONG'; }
}
sabotaged.dealBook.dealBookHash = 'sha256:0000000000000000';
sabotaged.dealBook.hands = 1;
sabotaged.evidence.decisions = 1;
sabotaged.evidence.revealedShare = 0.99;
sabotaged.manifest.engineCommit = 'deadbeef';
sabotaged.manifest.engineDirty = true;
sabotaged.separatorSearch.arity = 99;
sabotaged.separatorSearch.alpha = 0.99;
sabotaged.occupancy.total = 1;
sabotaged.provenance.site = 'FABRICATED';
for (const g of sabotaged.gates) { g.ok = false; g.detail = 'FAILED'; }

const after = hashOf(sabotaged);

console.log(`card: ${path}`);
console.log(`full card JSON        ${JSON.stringify(card).length.toLocaleString()} bytes`);
console.log(`canonical body hashed ${body.length.toLocaleString()} bytes  `
  + `(${(100 * body.length / JSON.stringify(card).length).toFixed(2)}% of the card)`);
console.log(`\nrules serialize to:   ${JSON.parse(body).rules ? JSON.stringify(JSON.parse(body).rules).slice(0, 60) : 'n/a'}...`);
console.log(`dealBook:             ${JSON.stringify(JSON.parse(body).dealBook)}`);
console.log(`evidence:             ${JSON.stringify(JSON.parse(body).evidence)}`);
console.log(`\nEVERY nested value sabotaged, all 23 gates flipped to FAILED.`);
console.log(`  original : ${before.slice(0, 26)}`);
console.log(`  sabotaged: ${after.slice(0, 26)}`);
console.log(`\nHASH UNCHANGED? ${before === after}`);
console.log(before === after
  ? '  -> the contentHash does NOT bind the card contents.'
  : '  -> the contentHash binds. Claim refuted.');

process.exit(before === after ? 1 : 0);
