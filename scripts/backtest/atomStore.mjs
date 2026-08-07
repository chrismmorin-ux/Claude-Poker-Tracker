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
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * DISK PREFLIGHT + INTERRUPTED CAPTURES RESOLVE AS TRUNCATED, NOT NOT_FOUND (WS-438).
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Two multi-hour runs died to a full disk with every atom unreachable
 * (out/hero-ev-KILLED-3players-inadmissible.json, out/hero-ev-44players-PARTIAL-650dec.json in
 * the main repo). Two defects compounded: nothing checked free space before or during a run, and
 * a set only became READABLE at finalize() — an interrupted capture had no manifest and no index
 * entry, so it resolved NOT_FOUND. "Never happened" and "incomplete" were the same answer, which
 * is exactly the confident-zero failure the resolution enum exists to prevent.
 *
 * Three mechanisms, all in the writer:
 *
 *   PREFLIGHT   `openAtomWriter` measures free space at the RESOLVED store root (statfs — works
 *               on Windows) against expectedAtoms x measured bytes/atom (WS-430: 844.4 B raw +
 *               17.5 B gz sidecar, both kept on disk) x a safety factor, plus an absolute floor.
 *               A run that cannot finish refuses at open, not hours in.
 *   RE-CHECK    every `checkpointEveryAtoms` appends the writer re-measures; a drive filling
 *               from elsewhere aborts GRACEFULLY — provisional manifest flushed, index entry
 *               written, typed error naming exactly what was preserved. The capture survives.
 *   PROVISIONAL a provisional manifest (`manifest.provisional.json`) is written at open and
 *               updated at every checkpoint with a rolling-hash snapshot of the rows so far. It
 *               NEVER claims a complete count (`atomCount: null` — the checkpoint count lives
 *               under `checkpointAtomCount`), so any aggregate computed over a truncated set is
 *               structurally labelled partial. finalize() supersedes it (writes manifest.json,
 *               deletes the provisional). `resolveAtomSetById` reaches an interrupted set with
 *               its rows readable and reason TRUNCATED; `assertAtomsResolvable` still refuses it,
 *               so a Result Card can never silently stand on a partial capture.
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, mkdir, readFile, writeFile, stat, appendFile, statfs, unlink } from 'node:fs/promises';
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
export const PROVISIONAL_MANIFEST_FILE = 'manifest.provisional.json';

/**
 * MEASURED atom sizes — WS-430, on the WS-328 gen-1 set (97,454 atoms, 82,294,703 B raw).
 * Source of record: docs/standard-of-record/VOCABULARY.md § "Atom store operations".
 * `onDisk` is raw + gz because finalize keeps the .gz sidecar ALONGSIDE the ndjson, so a
 * finished set costs the sum. These are measurements, not shape arguments — the docblock's old
 * "~1-2 KB each" was the shape argument, and it was wrong.
 */
export const MEASURED_ATOM_BYTES = Object.freeze({
  raw: 844.4,
  gz: 17.5,
  onDisk: 844.4 + 17.5,
  atomsPerHand: 4.6853,
  source: 'WS-430 (run-beliefstate-size.mjs + gen-1 set measurement), VOCABULARY.md § Atom store operations',
});

/**
 * Preflight defaults. `expectedAtoms` 500k ≈ 107k hands at the measured 4.6853 atoms/hand —
 * generous for every run this store has seen, so a caller with no hint is still protected
 * without being spuriously refused. Callers that know their row count pass `expectedAtoms`.
 */
export const DISK_PREFLIGHT_DEFAULTS = Object.freeze({
  expectedAtoms: 500_000,
  bytesPerAtom: MEASURED_ATOM_BYTES.onDisk,
  safetyFactor: 1.5,
  minFreeBytes: 1_073_741_824, // 1 GiB absolute floor — finalize needs room for the gz pass, and a drive run to zero takes the OS down with it
  checkpointEveryAtoms: 1000,
});

/**
 * Measure whether a capture of `expectedAtoms` rows can FINISH at `root`.
 *
 * Measures the RESOLVED store root — the path `SOR_ATOM_STORE` selects, not a hardcoded one —
 * via fs.statfs, which reports per-volume free space on Windows as well as POSIX.
 * `statfsImpl` is injectable ONLY so a test can prove the gate fires without filling a disk.
 */
export const diskPreflight = async ({
  root = DEFAULT_ATOM_STORE_ROOT,
  expectedAtoms = DISK_PREFLIGHT_DEFAULTS.expectedAtoms,
  bytesPerAtom = DISK_PREFLIGHT_DEFAULTS.bytesPerAtom,
  safetyFactor = DISK_PREFLIGHT_DEFAULTS.safetyFactor,
  minFreeBytes = DISK_PREFLIGHT_DEFAULTS.minFreeBytes,
  statfsImpl = statfs,
} = {}) => {
  const s = await statfsImpl(root);
  const freeBytes = Number(s.bavail) * Number(s.bsize);
  const estimatedBytes = Math.ceil(expectedAtoms * bytesPerAtom * safetyFactor);
  const requiredBytes = estimatedBytes + minFreeBytes;
  return {
    ok: freeBytes >= requiredBytes,
    root, freeBytes, estimatedBytes, requiredBytes,
    expectedAtoms, bytesPerAtom, safetyFactor, minFreeBytes,
  };
};

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
 * Performs the WS-438 disk PREFLIGHT before opening the handle, writes a provisional manifest
 * at open, re-checks free space and re-checkpoints every `checkpointEveryAtoms` appends, and on
 * exhaustion aborts GRACEFULLY with the capture intact.
 *
 * @param {Object} params
 * @param {string} params.atomSetId
 * @param {string} [params.root]
 * @param {string} params.surfaceId
 * @param {number} [params.fullSampleRate]
 * @param {number} [params.anchorGeneration]
 * @param {number} [params.expectedAtoms] - preflight row-count hint; safe default when absent
 * @param {number} [params.bytesPerAtom] - override for fatter atoms (e.g. beliefState runs)
 * @param {number} [params.safetyFactor]
 * @param {number} [params.minFreeBytes] - absolute free-space floor, checked during the run too
 * @param {number} [params.checkpointEveryAtoms] - provisional-manifest + re-check cadence
 * @param {Function} [params.statfsImpl] - test seam ONLY, to prove the gates fire
 */
export const openAtomWriter = async ({
  atomSetId,
  root = DEFAULT_ATOM_STORE_ROOT,
  surfaceId,
  fullSampleRate = 0,
  anchorGeneration = 1,
  expectedAtoms = DISK_PREFLIGHT_DEFAULTS.expectedAtoms,
  bytesPerAtom = DISK_PREFLIGHT_DEFAULTS.bytesPerAtom,
  safetyFactor = DISK_PREFLIGHT_DEFAULTS.safetyFactor,
  minFreeBytes = DISK_PREFLIGHT_DEFAULTS.minFreeBytes,
  checkpointEveryAtoms = DISK_PREFLIGHT_DEFAULTS.checkpointEveryAtoms,
  statfsImpl = statfs,
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

  // PREFLIGHT (WS-438 accept #1): refuse a run that cannot finish, at open rather than hours in.
  // Measured against the RESOLVED root — the directory statfs actually sees, SOR_ATOM_STORE
  // respected — using WS-430's measured bytes/atom, never an estimate someone argued from shape.
  let pre;
  try {
    pre = await diskPreflight({ root, expectedAtoms, bytesPerAtom, safetyFactor, minFreeBytes, statfsImpl });
  } catch (err) {
    if (err instanceof AtomStoreError) throw err;
    throw new AtomStoreError(
      `openAtomWriter: disk preflight could not measure free space at "${root}": ${err.message}. `
      + 'Refusing to start a capture blind — two multi-hour runs have already died to a full disk '
      + '(out/hero-ev-KILLED-3players-inadmissible.json, out/hero-ev-44players-PARTIAL-650dec.json).',
      { atomSetId, root },
    );
  }
  if (!pre.ok) {
    throw new AtomStoreError(
      `openAtomWriter: disk preflight REFUSED atom set "${atomSetId}" — estimated `
      + `${pre.estimatedBytes} B (${expectedAtoms} atoms x ${bytesPerAtom} B/atom `
      + '[WS-430 measured: 844.4 B raw + 17.5 B gz sidecar, both kept on disk] x '
      + `${safetyFactor} safety) plus the ${minFreeBytes} B floor exceeds ${pre.freeBytes} B free `
      + `at "${pre.root}". A run that cannot finish must refuse at open, not discover the wall `
      + 'hours in. Free space, relocate the store via SOR_ATOM_STORE, or pass a smaller '
      + 'expectedAtoms if this run is genuinely smaller.',
      { atomSetId, ...pre },
    );
  }

  // 'ax' — append, and FAIL if the file already exists. Two concurrent runs on one id would
  // otherwise interleave into a set whose hash describes neither of them.
  let handle;
  try {
    handle = await open(join(dir, ATOMS_FILE), 'ax');
  } catch (err) {
    if (err?.code === 'EEXIST') {
      throw new AtomStoreError(
        `openAtomWriter: atom set "${atomSetId}" already has rows but no final manifest — an `
        + 'INTERRUPTED capture, not a finalized one. Its rows are readable and it resolves as '
        + 'TRUNCATED via resolveAtomSetById. Atom sets are append-only; use a new atomSetId '
        + 'rather than writing over an interrupted history.',
        { atomSetId, dir },
      );
    }
    throw err;
  }
  const rolling = createHash('sha256');
  const seenIds = new Set();
  let atomCount = 0;
  let closed = false;
  const openedAt = new Date().toISOString();

  /**
   * Provisional manifest (WS-438 accept #3). `atomCount` is null ON PURPOSE: a provisional
   * manifest must be structurally incapable of claiming a complete count, so any aggregate
   * over a truncated set reads as partial rather than silently complete. The checkpoint count
   * lives under its own name. `rolling.copy()` snapshots the hash of exactly the rows written
   * so far without disturbing the live digest.
   */
  const writeProvisional = async () => {
    const checkpointAtomSetHash = `${SHA256_PREFIX}${rolling.copy().digest('hex')}`;
    const provisional = {
      provisional: true,
      atomSetId,
      surfaceId,
      fullSampleRate,
      anchorGeneration,
      atomCount: null,
      checkpointAtomCount: atomCount,
      checkpointAtomSetHash,
      expectedAtoms,
      openedAt,
      checkpointAt: new Date().toISOString(),
    };
    await writeFile(
      join(dir, PROVISIONAL_MANIFEST_FILE), `${JSON.stringify(provisional, null, 2)}\n`, 'utf8',
    );
    return provisional;
  };

  /**
   * Graceful abort (WS-438 accept #2): flush, checkpoint, register, THEN throw — the error
   * names exactly what survived. Every step is best-effort because the disk may be truly full;
   * the rows already on disk are the thing being protected, and they are already there.
   */
  const failGracefully = async (why, cause = null) => {
    closed = true;
    let provisional = null;
    try { await handle.sync(); } catch { /* best-effort — rows may already be durable */ }
    try { provisional = await writeProvisional(); } catch { /* disk may be truly full */ }
    try {
      if (provisional) {
        await appendFile(
          join(root, INDEX_FILE),
          `${JSON.stringify({
            atomSetHash: provisional.checkpointAtomSetHash, atomSetId,
            atomCount: provisional.checkpointAtomCount, provisional: true, at: provisional.checkpointAt,
          })}\n`,
          'utf8',
        );
      }
    } catch { /* index entry is a convenience; resolveAtomSetById needs no index */ }
    try { await handle.close(); } catch { /* already closing */ }
    throw new AtomStoreError(
      `atomStore: capture "${atomSetId}" ABORTED (${why}) — with the capture intact. `
      + `${atomCount} atoms are preserved at ${dir}; the set resolves as TRUNCATED `
      + `(resolveAtomSetById("${atomSetId}")), its rows readable, never NOT_FOUND. `
      + 'It cannot be finalized or reopened; start a new atomSetId when space exists.',
      {
        atomSetId,
        dir,
        atomsPreserved: atomCount,
        checkpointHash: provisional?.checkpointAtomSetHash ?? null,
        aborted: true,
        cause: cause?.message ?? null,
      },
    );
  };

  await writeProvisional();

  return {
    atomSetId,
    dir,

    /**
     * Append one atom. Refuses a duplicate atomId: two atoms sharing an id make every
     * downstream join ambiguous, and the ambiguity would surface as a quiet double-count.
     *
     * The rolling hash is updated AFTER the write succeeds, so a checkpoint hash only ever
     * covers rows that reached the file — a torn final line on a dying disk sits beyond the
     * checkpoint and is dropped by the lenient reader, never silently hashed as if durable.
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
      try {
        await handle.write(line, null, 'utf8');
      } catch (err) {
        await failGracefully(`write failed: ${err.message}`, err);
      }
      rolling.update(line, 'utf8');
      atomCount += 1;

      // Periodic checkpoint + re-check (WS-438 accept #2): a drive filling from ELSEWHERE is
      // caught at the next checkpoint, not at the uncaught throw hours later.
      if (atomCount % checkpointEveryAtoms === 0) {
        try {
          await writeProvisional();
        } catch (err) {
          await failGracefully(`checkpoint write failed: ${err.message}`, err);
        }
        let freeBytes;
        try {
          const s = await statfsImpl(root);
          freeBytes = Number(s.bavail) * Number(s.bsize);
        } catch (err) {
          await failGracefully(`free-space re-check failed: ${err.message}`, err);
        }
        if (freeBytes < minFreeBytes) {
          await failGracefully(
            `free space ${freeBytes} B at "${root}" fell below the ${minFreeBytes} B floor mid-run`,
          );
        }
      }
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

      // The final manifest SUPERSEDES the provisional one (WS-438 accept #3) — a finalized set
      // must be unambiguously distinct from an interrupted one, so the provisional is removed.
      try { await unlink(join(dir, PROVISIONAL_MANIFEST_FILE)); } catch { /* absent is fine */ }

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
 * LENIENT read for an INTERRUPTED set only (WS-438). A process killed mid-write can leave a
 * torn final line; the strict reader would report the whole set UNREADABLE, destroying every
 * durable row over one broken tail byte. This reader stops at the first unparseable line and
 * says so — the tail is reported, never silently absorbed. Finalized sets NEVER take this
 * path; their read stays strict.
 */
const readAtomsLenient = async (dir) => {
  const path = join(dir, ATOMS_FILE);
  const atoms = [];
  const rawLines = [];
  let corruptTail = false;
  const stream = createReadStream(path, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    try {
      atoms.push(JSON.parse(line));
    } catch {
      corruptTail = true;
      break;
    }
    rawLines.push(line);
  }
  rl.close();
  stream.destroy();
  return { atoms, rawLines, corruptTail };
};

/** Hash of the first `count` lines — verifies an interrupted set's checkpointed prefix. */
const prefixHash = (rawLines, count) => {
  const h = createHash('sha256');
  for (let i = 0; i < count; i += 1) h.update(`${rawLines[i]}\n`, 'utf8');
  return `${SHA256_PREFIX}${h.digest('hex')}`;
};

/**
 * Resolve an INTERRUPTED set from its provisional manifest (WS-438 accept #3).
 *
 * Returns `resolved: false, reason: TRUNCATED` — WITH the rows. The distinction this preserves:
 * NOT_FOUND means "never happened"; TRUNCATED means "happened, incomplete, here is what
 * survived". `partial: true` and the manifest's `atomCount: null` mean no aggregate over these
 * rows can read as complete, and `assertAtomsResolvable` still refuses the set outright.
 */
const resolveProvisional = async ({ dir, root, requestedHash = null }) => {
  const miss = (reason, detail = {}) => ({
    resolved: false, reason, atoms: [], manifest: null, atomSetHash: requestedHash, root, ...detail,
  });
  let provisional;
  try {
    provisional = JSON.parse(await readFile(join(dir, PROVISIONAL_MANIFEST_FILE), 'utf8'));
  } catch (err) {
    return miss(RESOLVE_FAILURES.NOT_FOUND, {
      detail: `no final or provisional manifest: ${err.message}`,
    });
  }
  let read;
  try {
    read = await readAtomsLenient(dir);
  } catch (err) {
    return miss(RESOLVE_FAILURES.UNREADABLE, { detail: `atoms unreadable: ${err.message}` });
  }
  const k = provisional.checkpointAtomCount ?? 0;
  if (requestedHash && requestedHash !== provisional.checkpointAtomSetHash) {
    return miss(RESOLVE_FAILURES.HASH_MISMATCH, {
      manifest: provisional,
      detail: `provisional checkpoint is ${provisional.checkpointAtomSetHash}; asked for ${requestedHash}`,
    });
  }
  if (read.rawLines.length >= k && k > 0
      && prefixHash(read.rawLines, k) !== provisional.checkpointAtomSetHash) {
    return miss(RESOLVE_FAILURES.HASH_MISMATCH, {
      manifest: provisional,
      detail: `checkpointed prefix (${k} rows) does not match ${provisional.checkpointAtomSetHash} — `
        + 'the interrupted set has been altered since its last checkpoint',
    });
  }
  return {
    resolved: false,
    reason: RESOLVE_FAILURES.TRUNCATED,
    partial: true,
    atoms: read.atoms,
    manifest: provisional,
    atomSetHash: requestedHash ?? provisional.checkpointAtomSetHash,
    root,
    corruptTail: read.corruptTail,
    detail: `interrupted capture: ${read.atoms.length} rows readable `
      + `(${k} checkpoint-verified${read.rawLines.length < k ? ', FEWER than checkpointed — rows lost' : ''}`
      + `${read.corruptTail ? ', torn tail line dropped' : ''}); final manifest never written`,
  };
};

/**
 * Resolve a set BY ID — the recovery path for an interrupted capture (WS-438).
 *
 * A crashed run's operator holds the atomSetId (it is in the run log and the abort error), not
 * a content hash — the final hash never existed. A finalized set resolves exactly as
 * `resolveAtomSet` would; an interrupted one resolves TRUNCATED with its rows.
 */
export const resolveAtomSetById = async (atomSetId, { root = DEFAULT_ATOM_STORE_ROOT } = {}) => {
  const dir = setDir(root, atomSetId);
  const miss = (reason, detail = {}) => ({
    resolved: false, reason, atoms: [], manifest: null, atomSetHash: null, root, ...detail,
  });
  let manifest = null;
  try {
    manifest = JSON.parse(await readFile(join(dir, MANIFEST_FILE), 'utf8'));
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      return miss(RESOLVE_FAILURES.UNREADABLE, { detail: `manifest unreadable: ${err.message}` });
    }
  }
  if (!manifest) return resolveProvisional({ dir, root });

  let read;
  try {
    read = await readAtoms(dir);
  } catch (err) {
    return miss(RESOLVE_FAILURES.UNREADABLE, { detail: `atoms unreadable: ${err.message}` });
  }
  if (read.hash !== manifest.atomSetHash) {
    return miss(RESOLVE_FAILURES.HASH_MISMATCH, {
      manifest,
      detail: `store holds ${read.hash}; the manifest declares ${manifest.atomSetHash}`,
    });
  }
  if (read.atoms.length !== manifest.atomCount) {
    return miss(RESOLVE_FAILURES.TRUNCATED, {
      manifest,
      detail: `manifest claims ${manifest.atomCount} atoms; ${read.atoms.length} readable`,
    });
  }
  return {
    resolved: true, reason: null, atoms: read.atoms, manifest,
    atomSetHash: manifest.atomSetHash, root,
  };
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
    if (err?.code === 'ENOENT') {
      // No FINAL manifest. A graceful abort registers its checkpoint hash in the index
      // (WS-438), so this hash may name an INTERRUPTED set — resolve it as TRUNCATED with its
      // rows rather than collapsing "incomplete" into "unreadable" or "never happened".
      return resolveProvisional({ dir, root, requestedHash: atomSetHash });
    }
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
