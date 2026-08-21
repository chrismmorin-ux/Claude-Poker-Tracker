/**
 * ndjsonStore.mjs — the append-only NDJSON capture discipline, extracted so there is ONE of it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `atomStore.mjs` (WS-430/438) worked out what it takes to append irreplaceable machine-produced
 * rows to disk without ever lying about what survived. That discipline is not atom-specific, and
 * the session sink (WS-6xx) needs exactly it for captured poker hands — which are MORE
 * irreplaceable than atoms, because an atom can be recomputed and a hand that was played cannot.
 *
 * Writing a second implementation of the same contract is the mechanism this repo keeps getting
 * bitten by: two objects that are supposed to agree, with nothing forcing them to meet
 * (WS-291, and `appRecordAdapter`'s own header on three representations of one hand). So the
 * mechanics live here once, and both stores are thin policy over them.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE FIVE PROPERTIES, AND WHY EACH IS LOAD-BEARING
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 *  1. `'ax'` OPEN — append, fail if the file exists. Two concurrent writers on one id would
 *     otherwise interleave into a set whose hash describes neither of them.
 *
 *  2. ROLLING HASH UPDATED **AFTER** THE WRITE SUCCEEDS. A torn final line on a dying disk sits
 *     beyond the checkpoint and is dropped by the lenient reader, rather than being hashed as
 *     though it were durable. Getting this backwards produces a hash that certifies data loss.
 *
 *  3. DISK PREFLIGHT AT OPEN, RE-CHECKED PERIODICALLY. A capture that cannot finish must refuse
 *     at open, not discover the wall hours in. The re-check catches a drive filling from
 *     ELSEWHERE, which the open-time check cannot see.
 *
 *  4. PROVISIONAL MANIFEST WITH `count: null`. "Interrupted" must be structurally distinguishable
 *     from "complete" AND from "never happened". A provisional manifest is incapable of claiming
 *     a complete count, so no aggregate over a truncated set can read as whole.
 *
 *  5. GRACEFUL ABORT THAT NAMES THE SURVIVORS. Flush, checkpoint, register, THEN throw. The rows
 *     already on disk are the thing being protected and they are already there; every step is
 *     best-effort because the disk may be genuinely full.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT IS POLICY AND STAYS WITH THE CALLER
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Record validation, the id field's name, the wording of domain errors, and any extra manifest
 * fields. This module never invents a domain message — a caller that wants its own diagnostics
 * passes `errorFactory`, and the tests asserting those exact strings keep passing.
 */

import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  appendFile, mkdir, open, readFile, stat, statfs, unlink, writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

export const SHA256_PREFIX = 'sha256:';

/**
 * Why a set could not be resolved. A CLOSED enum on purpose: "there is nothing here" and
 * "there is something here and it is broken" and "there is something here and it is partial"
 * are three different facts, and collapsing them is how a missing artifact quietly resolves
 * to a wrong one.
 */
export const RESOLVE_FAILURES = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  HASH_MISMATCH: 'HASH_MISMATCH',
  TRUNCATED: 'TRUNCATED',
  UNREADABLE: 'UNREADABLE',
});

export const PROVISIONAL_MANIFEST_FILE = 'manifest.provisional.json';
export const MANIFEST_FILE = 'manifest.json';
export const INDEX_FILE = 'index.ndjson';

export class NdjsonStoreError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'NdjsonStoreError';
    Object.assign(this, detail);
  }
}

/**
 * Free-space check against the RESOLVED root — the directory statfs actually sees, so an env-var
 * relocation is respected rather than assumed away.
 */
export const diskPreflight = async ({
  root,
  expectedRecords,
  bytesPerRecord,
  safetyFactor = 1.5,
  minFreeBytes = 256 * 1024 * 1024,
  statfsImpl = statfs,
} = {}) => {
  await mkdir(root, { recursive: true });
  const s = await statfsImpl(root);
  const freeBytes = Number(s.bavail) * Number(s.bsize);
  const estimatedBytes = Math.ceil(expectedRecords * bytesPerRecord * safetyFactor);
  return {
    ok: freeBytes >= estimatedBytes + minFreeBytes,
    root,
    freeBytes,
    estimatedBytes,
    minFreeBytes,
  };
};

/** Read every line of a set strictly, verifying the rolling hash as it goes. */
export const readStrict = async (path) => {
  const rolling = createHash('sha256');
  const records = [];
  const stream = createReadStream(path, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    rolling.update(`${line}\n`, 'utf8');
    records.push(JSON.parse(line));
  }
  return { records, hash: `${SHA256_PREFIX}${rolling.digest('hex')}` };
};

/**
 * LENIENT read, for an INTERRUPTED set only. A process killed mid-write can leave a torn final
 * line; the strict reader would report the whole set UNREADABLE, destroying every durable row
 * over one broken tail byte. This stops at the first unparseable line and SAYS SO — the tail is
 * reported, never silently absorbed. Finalized sets never take this path.
 */
export const readLenient = async (path) => {
  const records = [];
  const rawLines = [];
  let corruptTail = false;
  const stream = createReadStream(path, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line === '') continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      corruptTail = true;
      break;
    }
    rawLines.push(line);
  }
  rl.close();
  stream.destroy();
  return { records, rawLines, corruptTail };
};

/** Hash of the first `count` lines — verifies an interrupted set's checkpointed prefix. */
export const prefixHash = (rawLines, count) => {
  const h = createHash('sha256');
  for (let i = 0; i < count; i += 1) h.update(`${rawLines[i]}\n`, 'utf8');
  return `${SHA256_PREFIX}${h.digest('hex')}`;
};

/**
 * Open an append-only NDJSON writer.
 *
 * @param {Object}   p
 * @param {string}   p.setId              identity of this capture
 * @param {string}   p.root               store root (already env-resolved by the caller)
 * @param {string}   p.dir                directory for this set
 * @param {string}   p.dataFile           ndjson filename inside `dir`
 * @param {string}   p.idField            record property carrying the unique id
 * @param {Function} [p.errorFactory]     (code, detail) => Error. Lets a caller keep its own
 *                                        domain wording; defaults to generic NdjsonStoreError.
 * @param {Object}   [p.manifestExtras]   merged into both manifests
 * @param {boolean}  [p.gzipOnFinalize]   write a .gz sidecar ALONGSIDE (never replacing) the ndjson
 * @param {Function} [p.now]              () => ISO string, injectable so output can be byte-stable
 */
export const openNdjsonWriter = async ({
  setId,
  root,
  dir,
  dataFile,
  idField = 'id',
  errorFactory = null,
  manifestExtras = {},
  expectedRecords = 100_000,
  bytesPerRecord = 1024,
  safetyFactor = 1.5,
  minFreeBytes = 256 * 1024 * 1024,
  checkpointEveryRecords = 1000,
  gzipOnFinalize = true,
  statfsImpl = statfs,
  // Injected so a test can drive property 2 — that the rolling hash never advances past a write
  // that failed. Without this seam that property is asserted by inspection, which is how a
  // safety ends up circumstantial rather than structural.
  openImpl = open,
  now = () => new Date().toISOString(),
} = {}) => {
  const err = (code, message, detail = {}) => (
    errorFactory ? errorFactory(code, { message, ...detail }) : new NdjsonStoreError(message, { code, ...detail })
  );

  if (!setId) throw err('NO_SET_ID', 'openNdjsonWriter: setId is required');
  await mkdir(dir, { recursive: true });

  // A finalized set is immutable. Reopening it would let a hash recorded elsewhere stop
  // describing the rows behind it.
  const manifestPath = join(dir, MANIFEST_FILE);
  let finalized = false;
  try {
    await stat(manifestPath);
    finalized = true;
  } catch {
    // ENOENT is the expected, correct case: no manifest means not finalized.
  }
  if (finalized) throw err('ALREADY_FINALIZED', `openNdjsonWriter: set "${setId}" is already finalized`, { setId });

  let pre;
  try {
    pre = await diskPreflight({
      root, expectedRecords, bytesPerRecord, safetyFactor, minFreeBytes, statfsImpl,
    });
  } catch (e) {
    throw err('PREFLIGHT_UNMEASURABLE', `openNdjsonWriter: disk preflight could not measure free space at "${root}": ${e.message}`, { setId, root });
  }
  if (!pre.ok) {
    throw err('PREFLIGHT_REFUSED', `openNdjsonWriter: disk preflight REFUSED set "${setId}"`, { setId, ...pre });
  }

  let handle;
  try {
    handle = await openImpl(join(dir, dataFile), 'ax');
  } catch (e) {
    if (e?.code === 'EEXIST') {
      throw err('INTERRUPTED_EXISTS', `openNdjsonWriter: set "${setId}" already has rows but no final manifest — an INTERRUPTED capture`, { setId, dir });
    }
    throw e;
  }

  const rolling = createHash('sha256');
  const seenIds = new Set();
  let count = 0;
  let closed = false;
  const openedAt = now();

  const writeProvisional = async () => {
    const checkpointHash = `${SHA256_PREFIX}${rolling.copy().digest('hex')}`;
    const provisional = {
      provisional: true,
      setId,
      ...manifestExtras,
      count: null,
      checkpointCount: count,
      checkpointHash,
      expectedRecords,
      openedAt,
      checkpointAt: now(),
    };
    await writeFile(join(dir, PROVISIONAL_MANIFEST_FILE), `${JSON.stringify(provisional, null, 2)}\n`, 'utf8');
    return provisional;
  };

  const failGracefully = async (why, cause = null) => {
    closed = true;
    let provisional = null;
    try { await handle.sync(); } catch { /* rows may already be durable */ }
    try { provisional = await writeProvisional(); } catch { /* disk may be truly full */ }
    try {
      if (provisional) {
        await appendFile(
          join(root, INDEX_FILE),
          `${JSON.stringify({
            hash: provisional.checkpointHash,
            setId,
            count: provisional.checkpointCount,
            provisional: true,
            at: provisional.checkpointAt,
          })}\n`,
          'utf8',
        );
      }
    } catch { /* index is a convenience; resolution does not need it */ }
    try { await handle.close(); } catch { /* already closing */ }
    throw err(
      'ABORTED',
      `ndjsonStore: capture "${setId}" ABORTED (${why}) — with the capture intact. `
      + `${count} records are preserved at ${dir}; the set resolves as TRUNCATED, its rows readable, never NOT_FOUND.`,
      {
        setId,
        dir,
        recordsPreserved: count,
        checkpointHash: provisional?.checkpointHash ?? null,
        aborted: true,
        cause: cause?.message ?? null,
      },
    );
  };

  await writeProvisional();

  return {
    setId,
    dir,

    /** True when this id has already been written — lets a caller be idempotent rather than throw. */
    has(id) { return seenIds.has(id); },

    /**
     * Append one record. The rolling hash is updated AFTER the write succeeds, so a checkpoint
     * hash only ever covers rows that reached the file.
     */
    async append(record) {
      if (closed) throw err('WRITER_CLOSED', 'ndjsonStore: writer is finalized', { setId });
      const id = record?.[idField];
      if (!id) throw err('NO_RECORD_ID', `ndjsonStore: record has no ${idField}`, { setId });
      if (seenIds.has(id)) {
        throw err('DUPLICATE_ID', `ndjsonStore: duplicate ${idField} "${id}"`, { [idField]: id, setId });
      }
      seenIds.add(id);
      const line = `${JSON.stringify(record)}\n`;
      try {
        await handle.write(line, null, 'utf8');
      } catch (e) {
        await failGracefully(`write failed: ${e.message}`, e);
      }
      rolling.update(line, 'utf8');
      count += 1;

      if (count % checkpointEveryRecords === 0) {
        try {
          await writeProvisional();
        } catch (e) {
          await failGracefully(`checkpoint write failed: ${e.message}`, e);
        }
        let freeBytes;
        try {
          const s = await statfsImpl(root);
          freeBytes = Number(s.bavail) * Number(s.bsize);
        } catch (e) {
          await failGracefully(`free-space re-check failed: ${e.message}`, e);
        }
        if (freeBytes < minFreeBytes) {
          await failGracefully(`free space ${freeBytes} B at "${root}" fell below the ${minFreeBytes} B floor mid-run`);
        }
      }
      return id;
    },

    get count() { return count; },

    /**
     * Seal the set. The hash covers the DATA LINES ONLY, never the manifest — so a field
     * arriving at finalize time cannot change the identity of the rows something else points at.
     */
    async finalize({ extras = {} } = {}) {
      if (closed) throw err('ALREADY_FINALIZED', 'ndjsonStore: already finalized', { setId });
      await handle.close();
      closed = true;

      const hash = `${SHA256_PREFIX}${rolling.digest('hex')}`;
      const manifest = {
        setId,
        ...manifestExtras,
        ...extras,
        count,
        hash,
        createdAt: now(),
      };
      await writeFile(join(dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

      // The final manifest SUPERSEDES the provisional one — a finalized set must be
      // unambiguously distinct from an interrupted one.
      try { await unlink(join(dir, PROVISIONAL_MANIFEST_FILE)); } catch { /* absent is fine */ }

      if (gzipOnFinalize) {
        // Kept ALONGSIDE the ndjson rather than replacing it, so a reader that cannot gunzip
        // is not locked out of the primary record.
        await pipeline(
          createReadStream(join(dir, dataFile)),
          createGzip(),
          createWriteStream(join(dir, `${dataFile}.gz`)),
        );
      }

      await appendFile(
        join(root, INDEX_FILE),
        `${JSON.stringify({ hash, setId, count, at: manifest.createdAt })}\n`,
        'utf8',
      );

      return manifest;
    },
  };
};

/** Read a set's provisional manifest, if it has one. */
export const readProvisional = async (dir) => {
  try {
    return JSON.parse(await readFile(join(dir, PROVISIONAL_MANIFEST_FILE), 'utf8'));
  } catch {
    return null;
  }
};

/** Read a set's final manifest, if it has one. */
export const readManifest = async (dir) => {
  try {
    return JSON.parse(await readFile(join(dir, MANIFEST_FILE), 'utf8'));
  } catch {
    return null;
  }
};
