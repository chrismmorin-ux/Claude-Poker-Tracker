/**
 * atomStore.mjs — the Decision Atom store (WS-328). Append-only, content-addressed, OUTSIDE git.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE STORAGE TIERING, AND WHY IT IS SPLIT THIS WAY.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 *   IN the repo, human-readable   Result Cards and Censuses. Small, greppable, diffable.
 *                                 THEY ARE THE ANCHOR. A card whose atoms are gone is still a
 *                                 valid anchor — it can still be read, quoted and compared.
 *   OUTSIDE git, content-addressed  Atoms. MEASURED (WS-430, on the WS-328 gen-1 set):
 *                                 844.4 B/atom raw, 17.5 B/atom gzipped (48x), 4.6853
 *                                 decisions per hand — so 100k hands is ~0.4 GB raw. (An
 *                                 earlier "~1-2 KB each" here was a shape argument, not a
 *                                 measurement.) THEY ARE WHAT LETS YOU ASK A NEW QUESTION
 *                                 OF AN OLD RUN. Store location, relocation via the
 *                                 SOR_ATOM_STORE env var, and the measured beliefState
 *                                 budget per encoding: docs/standard-of-record/VOCABULARY.md
 *                                 § "Atom store operations" (WS-430).
 *
 * The card references the atoms BY HASH, never by path. Founder decision on WS-328's decision
 * flag: local-first, hash recorded, so relocating or syncing the store later cannot invalidate
 * any Result Card. A path in the card would bind the anchor to this machine's filesystem.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY RESOLUTION REPORTS RATHER THAN RETURNS EMPTY.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `resolveAtomSet` never returns a bare array. A missing store and an empty run would then be
 * the same value, and a re-derivation over "no atoms" would silently produce a confident zero.
 * It returns `{resolved, reason, ...}` with a reason from a closed enum, and
 * `assertAtomsResolvable` turns that into a throw for callers that need the atoms to exist.
 * Same shape as the census's refusal to let absence mean anything on its own.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * APPEND-ONLY IS ENFORCED BY THE WRITER, NOT BY CONVENTION.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The file handle is opened with 'ax' (append, exclusive-create) so a second writer on the same
 * atom set id fails at open rather than interleaving. A finalized set is marked by the presence
 * of its manifest, and opening a writer over one throws. The precedent is the IDB additive-only
 * rule: `migrationRegistry` authoring rule #2 exists because a store you can rewrite is a store
 * whose history you cannot trust, and an atom set is exactly a history.
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, mkdir, readFile, writeFile, stat, appendFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createGzip, gunzipSync } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';

import { hashObjectSync, SHA256_PREFIX } from './contentHashNode.mjs';

/**
 * Where atoms live. OUTSIDE the repo by default, matching the existing
 * `C:/Users/chris/data/phh-mining` pattern for bulk measurement data.
 */
export const DEFAULT_ATOM_STORE_ROOT =
  process.env.SOR_ATOM_STORE || 'C:/Users/chris/data/sor-atoms';

/** Why a hash did not resolve to a readable atom set. Closed enum; never a bare empty list. */
export const RESOLVE_FAILURES = Object.freeze({
  NOT_FOUND: 'atom-set-not-found',
  HASH_MISMATCH: 'atom-set-hash-mismatch',
  TRUNCATED: 'atom-set-truncated',
  UNREADABLE: 'atom-set-unreadable',
});

const ATOMS_FILE = 'atoms.ndjson';
const MANIFEST_FILE = 'manifest.json';
const INDEX_FILE = 'index.ndjson';

export class AtomStoreError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'AtomStoreError';
    Object.assign(this, detail);
  }
}

const setDir = (root, atomSetId) => join(root, atomSetId);

/**
 * Open an append-only writer for a NEW atom set.
 *
 * @param {Object} params
 * @param {string} params.atomSetId
 * @param {string} [params.root]
 * @param {string} params.surfaceId
 * @param {number} [params.fullSampleRate]
 * @param {number} [params.anchorGeneration]
 */
export const openAtomWriter = async ({
  atomSetId,
  root = DEFAULT_ATOM_STORE_ROOT,
  surfaceId,
  fullSampleRate = 0,
  anchorGeneration = 1,
} = {}) => {
  if (!atomSetId) throw new AtomStoreError('openAtomWriter: atomSetId is required');
  const dir = setDir(root, atomSetId);
  await mkdir(dir, { recursive: true });

  const manifestPath = join(dir, MANIFEST_FILE);
  try {
    await stat(manifestPath);
    throw new AtomStoreError(
      `openAtomWriter: atom set "${atomSetId}" is already finalized. Atoms are append-only and `
      + 'a finalized set is immutable — reopening it would let the hash a Result Card recorded '
      + 'stop describing the atoms behind it. Use a new atomSetId.',
      { atomSetId },
    );
  } catch (err) {
    if (err instanceof AtomStoreError) throw err;
    // ENOENT is the expected, correct case: no manifest means not finalized.
  }

  // 'ax' — append, and FAIL if the file already exists. Two concurrent runs on one id would
  // otherwise interleave into a set whose hash describes neither of them.
  const handle = await open(join(dir, ATOMS_FILE), 'ax');
  const rolling = createHash('sha256');
  const seenIds = new Set();
  let atomCount = 0;
  let closed = false;

  return {
    atomSetId,
    dir,

    /**
     * Append one atom. Refuses a duplicate atomId: two atoms sharing an id make every
     * downstream join ambiguous, and the ambiguity would surface as a quiet double-count.
     */
    async append(atom) {
      if (closed) throw new AtomStoreError('atomStore: writer is finalized', { atomSetId });
      if (!atom?.atomId) throw new AtomStoreError('atomStore: atom has no atomId', { atomSetId });
      if (seenIds.has(atom.atomId)) {
        throw new AtomStoreError(
          `atomStore: duplicate atomId "${atom.atomId}" — atoms are the primary record and a `
          + 'repeated id makes every aggregate over them ambiguous',
          { atomId: atom.atomId },
        );
      }
      seenIds.add(atom.atomId);
      const line = `${JSON.stringify(atom)}\n`;
      rolling.update(line, 'utf8');
      await handle.write(line, null, 'utf8');
      atomCount += 1;
      return atom.atomId;
    },

    get atomCount() { return atomCount; },

    /**
     * Seal the set: write the manifest, gzip the atoms, register the hash.
     *
     * The hash covers the atom LINES ONLY, not the manifest — so `seatOccupancy` arriving at
     * finalize time cannot change the identity of the atoms a Result Card points at.
     */
    async finalize({ seatOccupancy = [], notes = null } = {}) {
      if (closed) throw new AtomStoreError('atomStore: already finalized', { atomSetId });
      await handle.close();
      closed = true;

      const atomSetHash = `${SHA256_PREFIX}${rolling.digest('hex')}`;
      const manifest = {
        atomSetId,
        surfaceId,
        fullSampleRate,
        anchorGeneration,
        atomCount,
        atomSetHash,
        seatOccupancy,
        notes,
        createdAt: new Date().toISOString(),
      };
      await writeFile(join(dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

      // Compressed sidecar. Kept ALONGSIDE the ndjson rather than replacing it, so a reader
      // that cannot gunzip is not locked out of the primary record.
      await pipeline(
        createReadStream(join(dir, ATOMS_FILE)),
        createGzip(),
        createWriteStream(join(dir, `${ATOMS_FILE}.gz`)),
      );

      // Hash -> id index, so a Result Card carrying only a hash can find its atoms.
      await appendFile(
        join(root, INDEX_FILE),
        `${JSON.stringify({ atomSetHash, atomSetId, atomCount, at: manifest.createdAt })}\n`,
        'utf8',
      );

      return manifest;
    },
  };
};

/** Read every atom line of a set, verifying the rolling hash as it goes. */
const readAtoms = async (dir) => {
  const path = join(dir, ATOMS_FILE);
  const rolling = createHash('sha256');
  const atoms = [];
  const stream = createReadStream(path, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    rolling.update(`${line}\n`, 'utf8');
    atoms.push(JSON.parse(line));
  }
  return { atoms, hash: `${SHA256_PREFIX}${rolling.digest('hex')}` };
};

/**
 * Resolve an atom set BY HASH.
 *
 * Never throws for a missing set and never returns a bare array — see the header. A caller that
 * needs the atoms wraps this in `assertAtomsResolvable`.
 *
 * @returns {Promise<{resolved: boolean, reason: string|null, atoms: Array, manifest: Object|null}>}
 */
export const resolveAtomSet = async (atomSetHash, { root = DEFAULT_ATOM_STORE_ROOT } = {}) => {
  const miss = (reason, detail = {}) => ({
    resolved: false, reason, atoms: [], manifest: null, atomSetHash, root, ...detail,
  });
  if (!atomSetHash) return miss(RESOLVE_FAILURES.NOT_FOUND, { detail: 'no hash supplied' });

  let indexText;
  try {
    indexText = await readFile(join(root, INDEX_FILE), 'utf8');
  } catch {
    return miss(RESOLVE_FAILURES.NOT_FOUND, { detail: `no atom store index at ${root}` });
  }
  const entry = indexText
    .split('\n')
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean)
    .reverse()
    .find((e) => e.atomSetHash === atomSetHash);
  if (!entry) return miss(RESOLVE_FAILURES.NOT_FOUND, { detail: 'hash is not in the store index' });

  const dir = setDir(root, entry.atomSetId);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(dir, MANIFEST_FILE), 'utf8'));
  } catch (err) {
    return miss(RESOLVE_FAILURES.UNREADABLE, { detail: `manifest unreadable: ${err.message}` });
  }

  let read;
  try {
    read = await readAtoms(dir);
  } catch (err) {
    return miss(RESOLVE_FAILURES.UNREADABLE, { detail: `atoms unreadable: ${err.message}` });
  }

  if (read.hash !== atomSetHash) {
    return miss(RESOLVE_FAILURES.HASH_MISMATCH, {
      detail: `store holds ${read.hash}; the card asked for ${atomSetHash}`,
      manifest,
    });
  }
  if (read.atoms.length !== manifest.atomCount) {
    return miss(RESOLVE_FAILURES.TRUNCATED, {
      detail: `manifest claims ${manifest.atomCount} atoms; ${read.atoms.length} readable`,
      manifest,
    });
  }
  return { resolved: true, reason: null, atoms: read.atoms, manifest, atomSetHash, root };
};

/**
 * Resolve the atoms a Result Card points at, or throw saying exactly why not.
 *
 * "Never silently" is the accept criterion, and this is the enforcement: a card whose atoms are
 * gone still READS fine — that is deliberate, the card is the anchor — but any attempt to ask a
 * NEW question of the old run fails loudly instead of computing over nothing.
 */
export const assertAtomsResolvable = async (card, { root = DEFAULT_ATOM_STORE_ROOT } = {}) => {
  if (!card?.atomSetHash) {
    throw new AtomStoreError(
      `Result Card "${card?.resultCardId}" carries no atomSetHash, so the atoms it was computed `
      + 'from cannot be located. The card remains a valid anchor; it just cannot be re-questioned.',
      { resultCardId: card?.resultCardId },
    );
  }
  const out = await resolveAtomSet(card.atomSetHash, { root });
  if (!out.resolved) {
    throw new AtomStoreError(
      `Result Card "${card.resultCardId}" references atom set ${card.atomSetHash}, which did not `
      + `resolve: ${out.reason} (${out.detail ?? 'no detail'}). Refusing to continue over an `
      + 'empty atom list — a missing store and a run with no decisions would otherwise produce '
      + 'the same confident zero.',
      { resultCardId: card.resultCardId, reason: out.reason, detail: out.detail },
    );
  }
  if (card.atomCount != null && card.atomCount !== out.manifest.atomCount) {
    throw new AtomStoreError(
      `Result Card "${card.resultCardId}" claims ${card.atomCount} atoms; the resolved set holds `
      + `${out.manifest.atomCount}. A short read must not read as a small sample.`,
      { resultCardId: card.resultCardId },
    );
  }
  return out;
};

/** Read the gzipped sidecar. Used only to prove the compressed copy round-trips. */
export const readCompressed = async (atomSetId, { root = DEFAULT_ATOM_STORE_ROOT } = {}) => {
  const buf = await readFile(join(setDir(root, atomSetId), `${ATOMS_FILE}.gz`));
  return gunzipSync(buf).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
};

/** Hash of a set's canonical manifest — used by the Ladder to key a generation rebase. */
export const manifestHash = (manifest) => hashObjectSync(manifest);
