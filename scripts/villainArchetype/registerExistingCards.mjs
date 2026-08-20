/**
 * WS-599 — RETROACTIVE REGISTRATION of the seven pre-standard Conduct Cards.
 *
 * Founder decision, 2026-08-20: register all seven properly rather than record them as
 * pre-standard scratch and leave them alone. This is the one-shot that does it. It is
 * idempotent — rerunning it re-mints from the same bytes and rewrites the same files.
 *
 * WHAT THE AUDIT FOUND, because it decides what this script is allowed to write.
 * Every field below was read out of the seven files, not reconstructed:
 *
 *   RECOVERABLE, stamped in the card:  cardId, subjectId, surfaceKind, schemaVersion,
 *     contentHash, manifest.{engineCommit, engineDirty, dealBookHash, schemaVersion,
 *     constants, seeds}, disclaimerRegisterVersion, dealBook.{files,hands,decisions},
 *     evidence.*, provenance.{site,dateStart,dateEnd,stake,tableSizes}, population, rules.
 *   RECOVERABLE, measured here:  byte size, fileSha256, current path, node.
 *   GENUINELY ABSENT:  rulesetHash, emittedAt.
 *
 * And three caveats that the pointers carry as data rather than as prose nobody reads:
 *
 *   1. `engineDirty` is TRUE on all seven, and `emitConductCard.mjs` did not exist at four of
 *      the five stamped commits (fa526801, ca89f9e2, 32d968a4, 838416e6 — checked with
 *      `git cat-file -e`). The emitter was uncommitted working-tree code. The stamped commit
 *      records HEAD at run time; it does not identify the code that ran.
 *   2. Every stamped `contentHash` reproduces under the DEFECTIVE pre-WS-599 allowlist digest,
 *      which hashed 527-671 bytes of files 28-186 KB. It is a citation key, not an integrity
 *      check, and the pointer labels it so.
 *   3. `rulesetHash` is not recomputable in any meaningful sense: rule ids in these seven are
 *      positional (r01..rNN), so a digest over them is a function of rule COUNT and collides —
 *      subjects Ah5Fmohx.. and jSCaL6Fm.. both yield 59b83c08. Sentinel, with the reason.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, POINTER_DIR, NODES, currentNode,
  mintPointer, writePointer, reconcileStanding, regenerateIndex, listPointers, UNRECOVERABLE,
} from './conductCardPointer.mjs';

/** The seven, named explicitly. A glob would silently pick up an eighth nobody audited. */
const CARDS = [
  '.tmp-arch/profiles/SO0OmHLLvkJp.conduct-card.json',
  '.tmp-arch/profiles-6max/Ah5FmohxpLfw.conduct-card.json',
  '.tmp-arch/profiles-fixed/SO0OmHLLvkJp.conduct-card.json',
  '.tmp-arch/profiles-full/SO0OmHLLvkJp.conduct-card.json',
  '.tmp-arch/profiles-fullring/jSEItZVTvrRp.conduct-card.json',
  '.tmp-arch/profiles-v2/jSCaL6Fm4lAi.conduct-card.json',
  '.tmp-arch/regress/SO0OmHLLvkJp.conduct-card.json',
];

const node = currentNode();
if (node !== NODES.G16) {
  console.error(`This registrar records the seven cards as they sit on G16. Running on ${node}.`);
  process.exit(1);
}

const minted = [];
const missing = [];

for (const rel of CARDS) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) { missing.push(rel); continue; }
  const bytes = fs.readFileSync(abs);
  const card = JSON.parse(bytes.toString('utf8'));
  const stat = fs.statSync(abs);

  minted.push(mintPointer({
    card,
    cardBytes: bytes,
    location: {
      /**
       * TRUTHFULLY `not-yet-canonical`, not `cache` and not `canonical`.
       *
       * `cache` would be a lie — a cache implies a canonical copy elsewhere to check against,
       * and there is none; these bytes are the only copy that exists. `canonical` would be a
       * lie too — the ruling puts canonical artifacts on CM-NODE1 and these are G16 scratch.
       * WS-599 deliberately holds before any node1 run, so the obligation is recorded and the
       * files are not moved.
       */
      role: 'not-yet-canonical',
      node: NODES.G16,
      path: rel,
      gitignored: true,   // .gitignore:84 — `.tmp-arch/`
      migrationObligation: {
        requiredNode: NODES.NODE1,
        rule: '.claude/rules/artifact-location.md',
        ticket: 'WS-599',
        status: 'outstanding',
        note: 'Produced by a G16 run into a gitignored scratch directory before the pointer '
          + 'standard existed. Migration to CM-NODE1 is held pending a node1 run; until then '
          + 'this pointer names where the artifact actually is.',
      },
    },
    // No card field carries an emission time. mtime is recorded as an OBSERVATION only.
    emittedAt: null,
    notes: { fileMtime: stat.mtime.toISOString() },
    provenanceMode: 'retroactive',
    registeredBy: 'WS-599 registerExistingCards.mjs',
  }));
}

if (missing.length) {
  console.error(`REFUSING: ${missing.length} of the seven cards are not on disk:`);
  for (const m of missing) console.error(`  ${m}`);
  console.error('A registrar that silently registers a subset misstates what was registered.');
  process.exit(1);
}

// Reconcile against anything already registered, so a rerun does not orphan prior standings.
const existing = listPointers().map((e) => e.pointer)
  .filter((p) => !minted.some((m) => m.identity.fileSha256 === p.identity.fileSha256));
const all = reconcileStanding([...existing, ...minted]);
for (const p of all) writePointer(p);
const indexPath = regenerateIndex();

// ─── REPORT ──────────────────────────────────────────────────────────────────
console.log(`WS-599 retroactive registration — ${minted.length} Conduct Cards, node ${node}\n`);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('card', 22), pad('rules', 6), pad('dec', 7), pad('ruleset', 14),
  pad('standing', 12), 'path');
for (const p of minted.sort((a, b) => (a.subjectId < b.subjectId ? -1 : 1))) {
  console.log(
    pad(p.cardId, 22),
    pad(p.evidence.rules, 6),
    pad(p.evidence.decisions, 7),
    pad(p.identity.rulesetHash, 14),
    pad(p.standing, 12),
    p.location.path,
  );
}

const bySubject = new Map();
for (const p of minted) {
  if (!bySubject.has(p.subjectId)) bySubject.set(p.subjectId, []);
  bySubject.get(p.subjectId).push(p);
}
console.log('\nCURRENCY — one current per (subjectId, rulesetHash)');
for (const [sid, ps] of bySubject) {
  const cur = ps.filter((p) => p.standing === 'current');
  const latest = ps.find((p) => p.latestKnownForSubject);
  console.log(`  ${pad(sid, 24)} ${ps.length} card(s)  current=${cur.length ? cur[0].cardId : 'NONE'}`
    + `  latestKnown=${latest ? path.basename(latest.location.path) : '-'}`);
}

const unrec = minted.filter((p) => p.identity.rulesetHash === UNRECOVERABLE).length;
console.log(`\n  rulesetHash unrecoverable : ${unrec}/${minted.length}`);
console.log(`  emittedAt   unrecoverable : ${minted.filter((p) => p.emittedAt === UNRECOVERABLE).length}/${minted.length}`);
console.log(`  engineCommit identifies code: ${minted.filter((p) => p.manifest.engineCommitIdentifiesCode === true).length}/${minted.length}`);
console.log(`  contentHash covers whole card: ${minted.filter((p) => p.identity.contentHashCoversWholeCard).length}/${minted.length}`);
console.log(`  migration to ${NODES.NODE1} outstanding: ${minted.filter((p) => p.location.migrationObligation?.status === 'outstanding').length}/${minted.length}`);
console.log(`\nwrote ${minted.length} pointers to ${path.relative(REPO_ROOT, POINTER_DIR)}`);
console.log(`wrote ${path.relative(REPO_ROOT, indexPath)}`);
