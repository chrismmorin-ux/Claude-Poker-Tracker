/**
 * WS-599 — THE POINTER. A Conduct Card that the repo cannot cite is not a record.
 *
 * `profileVillain.mjs` wrote a card into `${OUT}` and discarded its identity at write time.
 * `.tmp-arch/` is gitignored (.gitignore:84), so seven schema-valid cards sat on G16 with
 * nothing in the repo naming any of them. Four of the seven claim the same `cardId`
 * (`CC-SO0OmHLLvkJp`) with 19, 25, 18 and 18 rules — four answers to one question and no rule
 * saying which is the answer. `emitConductCard.mjs:231` documents that exact ambiguity.
 *
 * `.claude/rules/artifact-location.md` (founder ruling 2026-08-20) says what the repo keeps
 * when it does not keep the artifact: "enough identity (hash, size, location) that a card can
 * always find its atoms, and that a missing artifact fails loudly rather than silently
 * resolving to something else." That is this file.
 *
 * THREE CLAUSES OF THE RULING ARE IMPLEMENTED AS REFUSALS, NOT AS WARNINGS:
 *
 *   1. "Unreachable must be an error, never a fallback." `resolveCard` throws. It does not
 *      search sibling directories, it does not fall back to a cache, and it does not recompute
 *      a substitute. There is deliberately no code path here that produces a card the pointer
 *      did not name.
 *   2. "A local copy is a cache and says so." A pointer with `location.role === 'cache'` MUST
 *      carry `location.canonicalRef`, and resolving it checks the canonical FIRST. An
 *      unreachable canonical fails the whole resolve even though the bytes are sitting there.
 *   3. Integrity mismatch is a hard failure. `CardIntegrityError`, never a console.warn.
 *
 * WHY `fileSha256` IS THE INTEGRITY ANCHOR AND THE CARD'S OWN `contentHash` IS NOT.
 * Measured on all seven existing cards, 2026-08-20: every stamped `contentHash` reproduces
 * exactly under the legacy digest `JSON.stringify({...card, contentHash: null},
 * Object.keys(card).sort())` — a replacer ALLOWLIST applied at every depth, which hashed
 * 527-671 bytes of files 28-186 KB. It is a digest of a rule count and a few top-level
 * scalars. Sabotaging every rate, interval, holding and gate inside those cards leaves it
 * identical, so it cannot detect the corruption a cache check exists to detect. The pointer
 * therefore records the stamped hash as a citation key, labelled with the algorithm that
 * produced it, and verifies bytes it hashed itself.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const POINTER_DIR = path.join(REPO_ROOT, 'docs', 'standard-of-record', 'pointers');
export const INDEX_PATH = path.join(POINTER_DIR, 'INDEX.yaml');

export const POINTER_VERSION = 1;

/**
 * The sentinel for a field that is genuinely absent from the artifact.
 *
 * It is a value rather than an omission on purpose. An omitted key is indistinguishable from
 * a key nobody thought to write, and a pointer that asserts provenance nobody verified is
 * worse than one that says it does not know. Every use of it is paired with a `*Reason`.
 */
export const UNRECOVERABLE = 'unrecoverable';

/** Fleet node labels, matching `.claude/rules/machine-affinity.md`. */
export const NODES = { G16: 'G16', NODE1: 'CM-NODE1' };

/** The node this process is running on. Hostname-derived; the fleet registry is authoritative. */
export function currentNode() {
  const h = os.hostname().toLowerCase();
  if (h.startsWith('morincomputer')) return NODES.G16;
  if (h.startsWith('cm-node1')) return NODES.NODE1;
  return `unknown:${os.hostname()}`;
}

// ─── REFUSALS ────────────────────────────────────────────────────────────────
// Distinct classes because the caller's correct response differs: unreachable-here is "run it
// on the other node", integrity is "the artifact is wrong, stop", missing-canonical is "the
// ruling forbids me proceeding from the copy I can see".

export class UnreachableArtifactError extends Error {
  constructor(msg, detail) { super(msg); this.name = 'UnreachableArtifactError'; this.detail = detail; }
}
export class RemoteArtifactError extends UnreachableArtifactError {
  constructor(msg, detail) { super(msg, detail); this.name = 'RemoteArtifactError'; }
}
export class CardIntegrityError extends Error {
  constructor(msg, detail) { super(msg); this.name = 'CardIntegrityError'; this.detail = detail; }
}

const sha256 = (buf) => `sha256:${createHash('sha256').update(buf).digest('hex')}`;

/**
 * The digest that produced a card's stamped `contentHash`, identified rather than trusted.
 *
 * Returns the algorithm name, so the pointer records WHICH digest the citation key came from.
 * `legacy-allowlist` is the defective one described in the file header; `recursive-canonical`
 * is the full-depth projection that replaced it. `unverifiable` means neither reproduced it,
 * which is itself a finding worth carrying rather than hiding behind a boolean.
 */
export function identifyContentHash(card) {
  const stamped = card.contentHash;
  if (!stamped) return { algorithm: UNRECOVERABLE, verified: false };
  const body = { ...card, contentHash: null };
  const canon = (v) => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === 'object') {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
      return out;
    }
    return v;
  };
  if (sha256(JSON.stringify(canon(body))) === stamped) {
    return { algorithm: 'recursive-canonical', verified: true, coversWholeCard: true };
  }
  // The replacer-allowlist form. Kept here as a RECOGNISER, never as a producer.
  if (sha256(JSON.stringify(body, Object.keys(body).sort())) === stamped) {
    return {
      algorithm: 'legacy-allowlist',
      verified: true,
      coversWholeCard: false,
      note: 'Reproduced under the defective pre-WS-599 digest: a replacer allowlist that hashes '
        + 'only top-level scalars (~500-700 bytes). It identifies the card for citation but '
        + 'cannot detect corruption of any rate, interval, holding or gate inside it.',
    };
  }
  return {
    algorithm: 'unverifiable',
    verified: false,
    coversWholeCard: false,
    note: 'The stamped hash reproduces under neither the current canonical digest nor the known '
      + 'legacy one. Recorded verbatim as an opaque citation key; it is not an integrity check.',
  };
}

/**
 * MINT — build the pointer record for a card. Pure: it touches no disk beyond the card bytes
 * it is handed, so the retroactive registrar and the emit path mint through the same function
 * and cannot drift apart.
 *
 * `rulesetHash` is read from the card and is NEVER recomputed here. Recomputing it from
 * `rules[].ruleId` was tried and rejected: in the seven pre-WS-599 cards the rule ids are
 * positional (`r01`..`rNN`), so the recomputed digest is a function of the rule COUNT alone —
 * measured, two DIFFERENT subjects (Ah5Fmohx.. and jSCaL6Fm..) both produce 59b83c08, and two
 * cards from different engine builds both produce 18acf9d1. A key that collides across
 * subjects is not an identity, and writing it into the field reserved for one would be
 * fabricated provenance.
 */
export function mintPointer({
  card,
  cardBytes,
  location,
  emittedAt,
  provenanceMode,
  registeredBy,
  notes,
}) {
  if (!card || !card.cardId || !card.subjectId) {
    throw new Error('mintPointer: card must carry cardId and subjectId');
  }
  if (!location || !location.role || !location.node || !location.path) {
    throw new Error('mintPointer: location requires { role, node, path }');
  }
  if (location.role === 'cache' && !location.canonicalRef) {
    throw new Error(
      'mintPointer: a cache pointer MUST carry location.canonicalRef — '
      + '"a local copy is a cache and says so" (.claude/rules/artifact-location.md)',
    );
  }
  const bytes = Buffer.isBuffer(cardBytes) ? cardBytes : Buffer.from(String(cardBytes), 'utf8');
  const contentHashKind = identifyContentHash(card);

  const rulesetHash = card.rulesetHash || UNRECOVERABLE;

  return {
    pointerVersion: POINTER_VERSION,
    cardId: card.cardId,
    subjectId: card.subjectId,
    surfaceKind: card.surfaceKind ?? UNRECOVERABLE,
    cardSchemaVersion: card.schemaVersion ?? UNRECOVERABLE,

    identity: {
      // The currency key. Everything about "which card is current" hangs off this field, which
      // is why an absent one is a sentinel and not a computed stand-in.
      rulesetHash,
      ...(rulesetHash === UNRECOVERABLE ? {
        rulesetHashReason:
          'The card predates rulesetHash being stamped (emitConductCard.mjs mints it as of the '
          + 'WS-599-era change). It is not recoverable from the card: the rule ids are positional '
          + '(r01..rNN), so any digest over them is a function of the rule count and collides '
          + 'across distinct subjects. See mintPointer() for the measurement.',
      } : {}),

      // Recorded verbatim as the citation key the card itself asserts. NOT the integrity check.
      stampedContentHash: card.contentHash ?? UNRECOVERABLE,
      contentHashAlgorithm: contentHashKind.algorithm,
      contentHashCoversWholeCard: contentHashKind.coversWholeCard ?? false,
      ...(contentHashKind.note ? { contentHashNote: contentHashKind.note } : {}),

      // THE INTEGRITY ANCHOR. Hashed from the bytes on disk by this process, at this moment.
      fileSha256: sha256(bytes),
      byteSize: bytes.length,
    },

    location: {
      role: location.role,                       // canonical | cache | not-yet-canonical
      node: location.node,
      path: location.path,                        // repo-relative when inside the repo tree
      gitignored: location.gitignored ?? null,
      ...(location.canonicalRef ? { canonicalRef: location.canonicalRef } : {}),
      ...(location.role === 'canonical' ? {} : {
        migrationObligation: location.migrationObligation ?? {
          requiredNode: NODES.NODE1,
          rule: '.claude/rules/artifact-location.md',
          ticket: 'WS-599',
          status: 'outstanding',
          note: 'Heavy artifacts live outside the repo and CM-NODE1 is their canonical home. '
            + 'This artifact has not been migrated, and this pointer records where it actually '
            + 'is rather than where the ruling says it belongs.',
        },
      }),
    },

    manifest: {
      engineCommit: card.manifest?.engineCommit ?? UNRECOVERABLE,
      engineDirty: card.manifest?.engineDirty ?? UNRECOVERABLE,
      /**
       * Whether the stamped commit identifies the code that ran. `engineDirty` alone understates
       * it: for four of the seven existing cards `emitConductCard.mjs` did not exist at the
       * stamped commit at all, so the commit records HEAD at run time and nothing more.
       */
      engineCommitIdentifiesCode: card.manifest?.engineDirty === true ? false
        : (card.manifest?.engineCommit ? true : UNRECOVERABLE),
      dealBookHash: card.manifest?.dealBookHash ?? card.dealBook?.dealBookHash ?? UNRECOVERABLE,
      decisionSchemaVersion: card.manifest?.schemaVersion ?? UNRECOVERABLE,
      constants: card.manifest?.constants ?? UNRECOVERABLE,
      seeds: card.manifest?.seeds ?? UNRECOVERABLE,
      // A card without one is invalid per ADR-009; carried on the pointer so a fault confirmed
      // tomorrow can find the results that depended on it yesterday without opening the card.
      disclaimerRegisterVersion: card.disclaimerRegisterVersion ?? UNRECOVERABLE,
    },

    emittedAt: emittedAt ?? UNRECOVERABLE,
    ...(emittedAt ? {} : {
      emittedAtReason:
        'No Conduct Card field carries an emission timestamp, and the pointer was minted after '
        + 'the fact. Filesystem mtime is recorded separately as an observation — it is not a '
        + 'stamp and a copy would overwrite it.',
    }),
    ...(notes?.fileMtime ? { observedFileMtime: notes.fileMtime } : {}),

    evidence: {
      decisions: card.evidence?.decisions ?? card.dealBook?.decisions ?? null,
      hands: card.dealBook?.hands ?? null,
      corpusFiles: card.dealBook?.files ?? null,
      rules: Array.isArray(card.rules) ? card.rules.length : null,
      unresolved: Array.isArray(card.unresolved) ? card.unresolved.length : null,
    },
    corpus: card.provenance
      ? {
        site: card.provenance.site ?? UNRECOVERABLE,
        dateStart: card.provenance.dateStart ?? UNRECOVERABLE,
        dateEnd: card.provenance.dateEnd ?? UNRECOVERABLE,
        stake: card.provenance.stake ?? UNRECOVERABLE,
        tableSizes: card.provenance.tableSizes ?? UNRECOVERABLE,
      }
      : UNRECOVERABLE,
    population: card.population ?? UNRECOVERABLE,

    // Set by reconcileStanding(), never by hand. See that function for the ranking rule.
    standing: 'unranked',
    standingReason: 'Not yet reconciled.',
    supersededBy: null,

    registeredAt: new Date().toISOString(),
    registeredBy: registeredBy ?? 'unknown',
    provenanceMode: provenanceMode ?? 'emit-time',   // emit-time | retroactive
  };
}

/** Stable, collision-free filename. The card id alone collides — four of seven share one. */
export function pointerFileName(pointer) {
  const short = pointer.identity.fileSha256.replace(/^sha256:/, '').slice(0, 12);
  return `${pointer.cardId}-${short}.json`;
}

export function pointerPathFor(pointer, dir = POINTER_DIR) {
  return path.join(dir, pointerFileName(pointer));
}

/**
 * `dir` exists so tests write into a scratch store. Without it a test that exercises the emit
 * path mutates the repo's real pointer index as a side effect — which happened on the first run
 * of this file and left `total_pointers: 8` for seven cards.
 */
export function writePointer(pointer, dir = POINTER_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  const p = pointerPathFor(pointer, dir);
  fs.writeFileSync(p, `${JSON.stringify(pointer, null, 2)}\n`);
  return p;
}

/**
 * A stray `.json` in the pointer store fails LOUDLY rather than being skipped or crashing with
 * a TypeError deep inside `reconcileStanding`. Skipping it silently would mean a pointer with a
 * malformed body drops out of the currency reconciliation without anyone being told — the same
 * quiet-wrong-answer failure the store exists to prevent.
 */
export function listPointers(dir = POINTER_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const pointer = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (pointer?.pointerVersion !== POINTER_VERSION || !pointer.identity?.fileSha256) {
        throw new Error(
          `${path.join(dir, f)} is in the pointer store but is not a pointer record `
          + `(pointerVersion=${pointer?.pointerVersion}). The pointer store holds pointers only; `
          + 'the artifacts live outside the repo.',
        );
      }
      return { file: f, pointer };
    });
}

/**
 * WHICH CARD IS CURRENT — the question the seven cards had no answer to, answered in data.
 *
 * Exactly one pointer per `(subjectId, rulesetHash)` is `current`. Superseded ones are RETAINED
 * and marked; nothing here deletes a pointer, because a superseded card is still the card some
 * earlier result depended on.
 *
 * Ranking within a group, in order: newest `emittedAt`, then most evidence (decisions), then
 * `fileSha256` as a deterministic tiebreak so two runs cannot disagree.
 *
 * A group whose `rulesetHash` is UNRECOVERABLE cannot have a current member. The currency key
 * does not exist for it, so declaring one authoritative would be asserting a fact nobody
 * verified — the failure this whole file exists to stop. Those are marked `unrankable` and the
 * reason travels with them.
 */
export function reconcileStanding(pointers) {
  const groups = new Map();
  for (const p of pointers) {
    const key = `${p.subjectId} ${p.identity.rulesetHash}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  for (const [key, members] of groups) {
    const rulesetHash = key.split(' ')[1];

    if (rulesetHash === UNRECOVERABLE) {
      // Factual, non-authoritative: lets the founder find the newest artifact without that
      // being read as a citability claim.
      const newest = [...members].sort(byRecency).reverse()[0];
      for (const p of members) {
        p.standing = 'unrankable';
        p.supersededBy = null;
        p.latestKnownForSubject = p === newest;
        p.standingReason =
          'No current card can be named for this subject: rulesetHash is unrecoverable, so the '
          + '(subjectId, rulesetHash) currency key cannot be formed. `latestKnownForSubject` is a '
          + 'filesystem observation, not an authority claim. Re-derive the card through the '
          + 'WS-599 emit path to obtain a rankable one.';
      }
      continue;
    }

    const ranked = [...members].sort(byRecency).reverse();
    const [winner, ...rest] = ranked;
    winner.standing = 'current';
    winner.supersededBy = null;
    winner.latestKnownForSubject = true;
    winner.standingReason = rest.length
      ? `Current for (subjectId, rulesetHash): newest of ${members.length} pointers sharing this key.`
      : 'Current for (subjectId, rulesetHash): the only pointer with this key.';
    for (const p of rest) {
      p.standing = 'superseded';
      p.supersededBy = pointerFileName(winner);
      p.latestKnownForSubject = false;
      p.standingReason =
        'Superseded by a newer card with the same (subjectId, rulesetHash). RETAINED, never '
        + 'deleted — an earlier result may cite it.';
    }
  }
  return pointers;
}

/** Oldest-first. `unrecoverable` emittedAt sorts below any real timestamp. */
function byRecency(a, b) {
  const ta = a.emittedAt === UNRECOVERABLE ? (a.observedFileMtime ?? '') : a.emittedAt;
  const tb = b.emittedAt === UNRECOVERABLE ? (b.observedFileMtime ?? '') : b.emittedAt;
  if (ta !== tb) return ta < tb ? -1 : 1;
  const ea = a.evidence?.decisions ?? -1;
  const eb = b.evidence?.decisions ?? -1;
  if (ea !== eb) return ea < eb ? -1 : 1;
  return a.identity.fileSha256 < b.identity.fileSha256 ? -1 : 1;
}

/**
 * The generated index. Per-file records are the source of truth; this is a derived fast-scan
 * view, mirroring `queue-index.yaml` / `findings-index.yaml`. One file per card is what keeps
 * five concurrent sessions from conflicting on a single append-only file.
 */
export function regenerateIndex(dir = POINTER_DIR) {
  const entries = listPointers(dir);
  const y = (s) => JSON.stringify(String(s));
  const lines = [
    '# Conduct Card Pointer Index — fast-scan summary of all card pointers',
    '# GENERATED — DO NOT EDIT. Rebuild from: docs/standard-of-record/pointers/*.json',
    '# Rebuilt by: scripts/villainArchetype/conductCardPointer.mjs (regenerateIndex)',
    '# The per-file pointer records are the source of truth; this file is a derived view.',
    '',
    `total_pointers: ${entries.length}`,
    `generated_at: ${y(new Date().toISOString())}`,
    'by_standing:',
  ];
  const counts = {};
  for (const { pointer } of entries) counts[pointer.standing] = (counts[pointer.standing] || 0) + 1;
  for (const k of Object.keys(counts).sort()) lines.push(`  ${k}: ${counts[k]}`);
  lines.push('', 'pointers:');
  for (const { file, pointer: p } of entries) {
    lines.push(`  - file: ${y(file)}`);
    lines.push(`    cardId: ${y(p.cardId)}`);
    lines.push(`    subjectId: ${y(p.subjectId)}`);
    lines.push(`    rulesetHash: ${y(p.identity.rulesetHash)}`);
    lines.push(`    fileSha256: ${y(p.identity.fileSha256)}`);
    lines.push(`    byteSize: ${p.identity.byteSize}`);
    lines.push(`    rules: ${p.evidence.rules ?? 'null'}`);
    lines.push(`    decisions: ${p.evidence.decisions ?? 'null'}`);
    lines.push(`    standing: ${y(p.standing)}`);
    lines.push(`    location_role: ${y(p.location.role)}`);
    lines.push(`    location_node: ${y(p.location.node)}`);
    lines.push(`    location_path: ${y(p.location.path)}`);
    lines.push(`    engineCommit: ${y(p.manifest.engineCommit)}`);
    lines.push(`    dealBookHash: ${y(p.manifest.dealBookHash)}`);
    lines.push(`    emittedAt: ${y(p.emittedAt)}`);
    lines.push(`    provenanceMode: ${y(p.provenanceMode)}`);
  }
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'INDEX.yaml');
  fs.writeFileSync(out, `${lines.join('\n')}\n`);
  return out;
}

/**
 * RESOLVE — the only supported way to get a card back from a pointer, and the only place the
 * ruling's refusals live.
 *
 * There is intentionally no `fallback`, `search`, `recompute` or `allowStale` option. Adding
 * one would reintroduce the exact ambiguity the Standard of Record exists to remove, which is
 * why the ruling names both fallbacks and forbids them by name.
 */
export function resolveCard(pointer, { node = currentNode() } = {}) {
  const loc = pointer.location;

  // CLAUSE 2 — a cache is checked against its canonical, not used instead of it. An unreachable
  // canonical fails the resolve even when the cached bytes are sitting right there.
  if (loc.role === 'cache') {
    const ref = loc.canonicalRef;
    if (!ref) {
      throw new CardIntegrityError(
        'Cache pointer carries no canonicalRef; it cannot be validated and must not be used.',
        { pointer: pointer.cardId },
      );
    }
    if (ref.node !== node) {
      throw new RemoteArtifactError(
        `Canonical artifact for ${pointer.cardId} lives on ${ref.node}; this process is on ${node}. `
        + 'Refusing: the ruling forbids falling back to the local cache. Load the `fleet` skill — '
        + 'do not improvise a transfer.',
        { cardId: pointer.cardId, canonicalNode: ref.node, here: node },
      );
    }
    if (!fs.existsSync(absolutize(ref.path))) {
      throw new UnreachableArtifactError(
        `Canonical artifact for ${pointer.cardId} is unreachable at ${ref.path}. Refusing: no `
        + 'fallback to the local cache and no recomputed substitute.',
        { cardId: pointer.cardId, canonicalPath: ref.path },
      );
    }
  }

  if (loc.node !== node) {
    throw new RemoteArtifactError(
      `Artifact for ${pointer.cardId} lives on ${loc.node}; this process is on ${node}. Refusing `
      + 'rather than improvising a transfer (.claude/rules/artifact-location.md).',
      { cardId: pointer.cardId, artifactNode: loc.node, here: node },
    );
  }

  const abs = absolutize(loc.path);
  if (!fs.existsSync(abs)) {
    throw new UnreachableArtifactError(
      `Artifact for ${pointer.cardId} is unreachable at ${loc.path}. A missing artifact fails `
      + 'loudly rather than silently resolving to something else.',
      { cardId: pointer.cardId, path: loc.path },
    );
  }

  // CLAUSE 3 — mismatch is a hard failure, not a warning.
  const bytes = fs.readFileSync(abs);
  const actual = sha256(bytes);
  if (actual !== pointer.identity.fileSha256) {
    throw new CardIntegrityError(
      `Integrity failure for ${pointer.cardId} at ${loc.path}: expected `
      + `${pointer.identity.fileSha256}, got ${actual}. The bytes are not the card this pointer `
      + 'names. Refusing.',
      { cardId: pointer.cardId, expected: pointer.identity.fileSha256, actual, path: loc.path },
    );
  }
  if (bytes.length !== pointer.identity.byteSize) {
    throw new CardIntegrityError(
      `Size mismatch for ${pointer.cardId}: expected ${pointer.identity.byteSize} bytes, got `
      + `${bytes.length}.`,
      { cardId: pointer.cardId },
    );
  }

  const card = JSON.parse(bytes.toString('utf8'));
  if (card.cardId !== pointer.cardId || card.subjectId !== pointer.subjectId) {
    throw new CardIntegrityError(
      `Identity mismatch for ${loc.path}: pointer names ${pointer.cardId}/${pointer.subjectId}, `
      + `file carries ${card.cardId}/${card.subjectId}.`,
      { cardId: pointer.cardId },
    );
  }
  return card;
}

function absolutize(p) {
  return path.isAbsolute(p) ? p : path.join(REPO_ROOT, p);
}

/**
 * THE ONLY WAY TO WRITE A CARD. WS-599 accept criterion: "a card with no pointer is the defect;
 * make it unrepresentable rather than validated."
 *
 * There is no separate `writeCard`. The pointer is minted from the exact bytes BEFORE the card
 * reaches disk, and if the pointer write fails the card file is removed again — so the
 * filesystem never holds a card that no pointer names, not even transiently on the failure
 * path. `profileVillain.mjs` calls this instead of `writeFileSync`.
 */
export function writeCardWithPointer({
  card,
  outPath,
  node = currentNode(),
  role,
  canonicalRef,
  registeredBy = 'unknown',
  reconcile = true,
  pointerDir = POINTER_DIR,
}) {
  const bytes = Buffer.from(`${JSON.stringify(card, null, 1)}`, 'utf8');

  /**
   * `not-yet-canonical` is the honest role for a G16-produced card today. The ruling says
   * CM-NODE1 owns artifacts; WS-599 deliberately holds before any node1 run, so the pointer
   * records where the artifact IS and carries the migration obligation, rather than claiming a
   * canonical location that does not exist yet.
   */
  const resolvedRole = role ?? (node === NODES.NODE1 ? 'canonical' : 'not-yet-canonical');

  const rel = path.isAbsolute(outPath) ? path.relative(REPO_ROOT, outPath) : outPath;
  const pointer = mintPointer({
    card,
    cardBytes: bytes,
    location: {
      role: resolvedRole,
      node,
      path: rel.split(path.sep).join('/'),
      gitignored: rel.startsWith('.tmp-arch'),
      ...(canonicalRef ? { canonicalRef } : {}),
    },
    emittedAt: new Date().toISOString(),
    provenanceMode: 'emit-time',
    registeredBy,
  });

  const abs = absolutize(outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, bytes);

  let pointerPath;
  try {
    if (reconcile) {
      const all = [...listPointers(pointerDir).map((e) => e.pointer), pointer];
      reconcileStanding(all);
      for (const p of all) writePointer(p, pointerDir);
      pointerPath = pointerPathFor(pointer, pointerDir);
    } else {
      pointerPath = writePointer(pointer, pointerDir);
    }
    regenerateIndex(pointerDir);
  } catch (err) {
    // A card no pointer names is the defect. Do not leave one behind.
    try { fs.unlinkSync(abs); } catch { /* the throw below is the signal */ }
    throw err;
  }

  return { cardPath: abs, pointerPath, pointer };
}
