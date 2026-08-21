/**
 * ndjsonStore.test.js — the five properties the capture discipline exists to guarantee.
 *
 * These are not shape tests. Each one pins a property that, if it broke, would let the store
 * LIE about what survived — which is the only failure mode that matters for a record of hands
 * that were actually played and cannot be recomputed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, appendFile, open as realOpen } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import {
  openNdjsonWriter,
  readLenient,
  readStrict,
  readProvisional,
  readManifest,
  prefixHash,
  diskPreflight,
  SHA256_PREFIX,
  MANIFEST_FILE,
  PROVISIONAL_MANIFEST_FILE,
  INDEX_FILE,
} from '../lib/ndjsonStore.mjs';

const DATA_FILE = 'records.ndjson';

let root;
const openWriter = (overrides = {}) => openNdjsonWriter({
  setId: 'set-a',
  root,
  dir: join(root, 'set-a'),
  dataFile: DATA_FILE,
  idField: 'recordId',
  // A roomy fake disk unless a test says otherwise.
  statfsImpl: async () => ({ bavail: 1e9, bsize: 4096 }),
  ...overrides,
});

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ndjson-store-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('property 1 — exclusive create', () => {
  it('refuses a second writer on a set that already has rows', async () => {
    const w = await openWriter();
    await w.append({ recordId: 'r1' });

    await expect(openWriter()).rejects.toThrow(/INTERRUPTED/);
  });

  it('refuses to reopen a finalized set, because its hash is already published', async () => {
    const w = await openWriter();
    await w.append({ recordId: 'r1' });
    await w.finalize();

    await expect(openWriter()).rejects.toThrow(/already finalized/);
  });
});

describe('property 2 — the rolling hash covers only rows that reached the file', () => {
  it('finalized hash equals a hash computed independently over the lines', async () => {
    const w = await openWriter();
    for (const id of ['r1', 'r2', 'r3']) await w.append({ recordId: id, n: id.length });
    const manifest = await w.finalize();

    const raw = await readFile(join(root, 'set-a', DATA_FILE), 'utf8');
    const independent = createHash('sha256').update(raw, 'utf8').digest('hex');
    expect(manifest.hash).toBe(`${SHA256_PREFIX}${independent}`);
  });

  it('a write that THROWS does not advance the hash — the checkpoint certifies the durable rows only', async () => {
    // A real handle for the rows that succeed, wrapped so the 3rd write fails the way a dying
    // disk fails: after two rows are genuinely on disk.
    let writes = 0;
    const failingOpen = async (path, flags) => {
      const real = await realOpen(path, flags);
      return {
        write: async (...args) => {
          writes += 1;
          if (writes === 3) throw new Error('ENOSPC: simulated');
          return real.write(...args);
        },
        sync: () => real.sync(),
        close: () => real.close(),
      };
    };

    const w = await openWriter({ checkpointEveryRecords: 1000, openImpl: failingOpen });
    await w.append({ recordId: 'r1' });
    await w.append({ recordId: 'r2' });

    // The two durable rows, hashed independently of the store.
    const twoRows = await readFile(join(root, 'set-a', DATA_FILE), 'utf8');
    const twoRowHash = `${SHA256_PREFIX}${createHash('sha256').update(twoRows, 'utf8').digest('hex')}`;

    await expect(w.append({ recordId: 'r3' })).rejects.toThrow(/ABORTED/);

    // THE PROPERTY: the abort checkpoint hashes exactly the rows that reached the file — two,
    // not three. A hash that had advanced on the failed write would certify a row that is not there.
    const prov = await readProvisional(join(root, 'set-a'));
    expect(prov.checkpointCount).toBe(2);
    expect(prov.checkpointHash).toBe(twoRowHash);
    expect(prov.count).toBeNull();
  });
});

describe('property 3 — disk preflight', () => {
  it('refuses at open when the estimate plus the floor exceeds free space', async () => {
    await expect(openWriter({
      expectedRecords: 1_000_000,
      bytesPerRecord: 4096,
      statfsImpl: async () => ({ bavail: 10, bsize: 4096 }),
    })).rejects.toThrow(/REFUSED/);
  });

  it('refuses when free space cannot be measured at all, rather than starting blind', async () => {
    await expect(openWriter({
      statfsImpl: async () => { throw new Error('no such volume'); },
    })).rejects.toThrow(/could not measure free space/);
  });

  it('aborts mid-run when the disk fills from elsewhere, and names what survived', async () => {
    let free = 1e9;
    const w = await openWriter({
      checkpointEveryRecords: 2,
      minFreeBytes: 1000,
      statfsImpl: async () => ({ bavail: free, bsize: 1 }),
    });
    await w.append({ recordId: 'r1' });
    free = 10; // a different process ate the disk
    await expect(w.append({ recordId: 'r2' })).rejects.toThrow(/ABORTED/);

    // The rows that made it are still on disk and still readable.
    const { records, corruptTail } = await readLenient(join(root, 'set-a', DATA_FILE));
    expect(records.map((r) => r.recordId)).toEqual(['r1', 'r2']);
    expect(corruptTail).toBe(false);
  });
});

describe('property 4 — a provisional manifest cannot claim a complete count', () => {
  it('writes count:null at open and keeps the checkpoint count under its own name', async () => {
    await openWriter();
    const prov = await readProvisional(join(root, 'set-a'));
    expect(prov.provisional).toBe(true);
    expect(prov.count).toBeNull();
    expect(prov.checkpointCount).toBe(0);
    expect(await readManifest(join(root, 'set-a'))).toBeNull();
  });

  it('the final manifest supersedes the provisional one, so interrupted and complete are distinguishable', async () => {
    const w = await openWriter();
    await w.append({ recordId: 'r1' });
    const manifest = await w.finalize();

    expect(manifest.count).toBe(1);
    expect(await readProvisional(join(root, 'set-a'))).toBeNull();
    expect((await readManifest(join(root, 'set-a'))).count).toBe(1);
  });

  it('a checkpoint hash verifies the prefix it claims', async () => {
    const w = await openWriter({ checkpointEveryRecords: 2 });
    await w.append({ recordId: 'r1' });
    await w.append({ recordId: 'r2' });
    const prov = await readProvisional(join(root, 'set-a'));

    const { rawLines } = await readLenient(join(root, 'set-a', DATA_FILE));
    expect(prefixHash(rawLines, prov.checkpointCount)).toBe(prov.checkpointHash);
  });
});

describe('property 5 — a torn tail loses one line, never the whole set', () => {
  it('reports corruptTail and returns every durable row before it', async () => {
    const w = await openWriter();
    await w.append({ recordId: 'r1' });
    await w.append({ recordId: 'r2' });
    // Simulate a process killed mid-write.
    await appendFile(join(root, 'set-a', DATA_FILE), '{"recordId":"r3","tru', 'utf8');

    const { records, corruptTail } = await readLenient(join(root, 'set-a', DATA_FILE));
    expect(corruptTail).toBe(true);
    expect(records.map((r) => r.recordId)).toEqual(['r1', 'r2']);
  });

  it('the strict reader is not lenient — a finalized set must not silently absorb a bad line', async () => {
    await writeFile(join(root, 'bad.ndjson'), '{"recordId":"r1"}\n{oops\n', 'utf8');
    await expect(readStrict(join(root, 'bad.ndjson'))).rejects.toThrow();
  });
});

describe('identity and idempotence', () => {
  it('refuses a duplicate id, because a repeated row makes every aggregate ambiguous', async () => {
    const w = await openWriter();
    await w.append({ recordId: 'r1' });
    await expect(w.append({ recordId: 'r1' })).rejects.toThrow(/duplicate recordId/);
  });

  it('exposes has() so a caller can be idempotent without provoking a throw', async () => {
    const w = await openWriter();
    await w.append({ recordId: 'r1' });
    expect(w.has('r1')).toBe(true);
    expect(w.has('r2')).toBe(false);
  });

  it('refuses a record with no id at all', async () => {
    const w = await openWriter();
    await expect(w.append({ nope: 1 })).rejects.toThrow(/no recordId/);
  });

  it('registers the finalized hash in the store index so a pointer can find its rows', async () => {
    const w = await openWriter();
    await w.append({ recordId: 'r1' });
    const manifest = await w.finalize();

    const index = (await readFile(join(root, INDEX_FILE), 'utf8')).trim().split('\n').map(JSON.parse);
    expect(index.at(-1)).toMatchObject({ hash: manifest.hash, setId: 'set-a', count: 1 });
  });
});

describe('injected clock', () => {
  it('lets a caller make output byte-stable rather than wall-clock dependent', async () => {
    const w = await openWriter({ now: () => '2026-01-01T00:00:00.000Z' });
    await w.append({ recordId: 'r1' });
    const manifest = await w.finalize();
    expect(manifest.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('gzip sidecar', () => {
  it('is written ALONGSIDE the ndjson, never replacing it', async () => {
    const w = await openWriter();
    await w.append({ recordId: 'r1' });
    await w.finalize();

    // The primary record is still plain text and still readable.
    const { records } = await readLenient(join(root, 'set-a', DATA_FILE));
    expect(records).toEqual([{ recordId: 'r1' }]);
    await expect(readFile(join(root, 'set-a', `${DATA_FILE}.gz`))).resolves.toBeInstanceOf(Buffer);
  });

  it('can be turned off for a store that does not want one', async () => {
    const w = await openWriter({ gzipOnFinalize: false });
    await w.append({ recordId: 'r1' });
    await w.finalize();
    await expect(readFile(join(root, 'set-a', `${DATA_FILE}.gz`))).rejects.toThrow();
  });
});

describe('diskPreflight', () => {
  it('measures against the resolved root and reports the numbers it used', async () => {
    const pre = await diskPreflight({
      root,
      expectedRecords: 10,
      bytesPerRecord: 100,
      safetyFactor: 2,
      minFreeBytes: 0,
      statfsImpl: async () => ({ bavail: 2000, bsize: 1 }),
    });
    expect(pre).toMatchObject({ ok: true, freeBytes: 2000, estimatedBytes: 2000 });
  });
});
