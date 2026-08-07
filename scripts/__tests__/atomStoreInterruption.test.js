/**
 * atomStoreInterruption.test.js — WS-438.
 *
 * Two multi-hour runs died to a full disk with every atom unreachable (the main repo keeps the
 * corpses: out/hero-ev-KILLED-3players-inadmissible.json, out/hero-ev-44players-PARTIAL-650dec.json).
 * The mechanisms under test are the ones that make that unrepeatable:
 *
 *   PREFLIGHT    openAtomWriter refuses at open a run that cannot finish — measured free space
 *                at the RESOLVED root (SOR_ATOM_STORE respected) against WS-430's measured
 *                bytes/atom, never a shape argument.
 *   RE-CHECK     a drive filling from elsewhere aborts the run GRACEFULLY mid-capture: flush,
 *                provisional checkpoint, typed error naming what survived.
 *   TRUNCATED    an interrupted set resolves TRUNCATED with its rows readable — never NOT_FOUND.
 *                "Never happened" and "incomplete" must be different answers. Aggregates over a
 *                truncated set are structurally labelled partial (`atomCount: null` in the
 *                provisional manifest), and finalized immutability is untouched.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, appendFile, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  openAtomWriter, resolveAtomSet, resolveAtomSetById, assertAtomsResolvable, diskPreflight,
  RESOLVE_FAILURES, AtomStoreError, MEASURED_ATOM_BYTES, DISK_PREFLIGHT_DEFAULTS,
  PROVISIONAL_MANIFEST_FILE,
} from '../backtest/atomStore.mjs';
import { atomsSelfCheck } from '../backtest/atomsSelfCheck.mjs';
import { buildDecisionAtom } from '../../src/utils/standardOfRecord/decisionAtom.js';

let root;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'ws438-')); });
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

const atom = (i) => buildDecisionAtom({
  atomId: `H${i}#0@3`,
  situationKey: 'preflop:na:MIDDLE:false:false:none:na',
  carried: { source: 'SRC-012' },
  surfaceId: 'read:test',
  action: { fold: 0.4, call: 0.6 },
  ruleId: null,
  warrant: null,
  outcome: { observedAction: 'call' },
  seeds: { deal: i },
  actorSeat: 3,
  actorRole: 'villain',
});

/** statfs stub reporting a fixed number of free bytes, recording every path it measured. */
const statfsReporting = (freeBytes, seen = []) => async (path) => {
  seen.push(path);
  return { bavail: Math.floor(freeBytes / 4096), bsize: 4096 };
};

const PLENTY = 1024 ** 4; // 1 TiB

describe('disk preflight — refuse at open, not hours in (WS-438 #1, #5)', () => {
  it('refuses a run whose estimate exceeds free space, citing the WS-430 measured constants', async () => {
    await expect(openAtomWriter({
      atomSetId: 'set-refused', root, surfaceId: 'x',
      statfsImpl: statfsReporting(0),
    })).rejects.toThrow(/disk preflight REFUSED/);

    const err = await openAtomWriter({
      atomSetId: 'set-refused', root, surfaceId: 'x',
      statfsImpl: statfsReporting(0),
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AtomStoreError);
    expect(err.message).toMatch(/844\.4 B raw \+ 17\.5 B gz/);   // measured, WS-430 — not a shape argument
    expect(err.message).toMatch(/SOR_ATOM_STORE/);               // names the relocation lever
    expect(err.estimatedBytes).toBe(Math.ceil(
      DISK_PREFLIGHT_DEFAULTS.expectedAtoms * MEASURED_ATOM_BYTES.onDisk * DISK_PREFLIGHT_DEFAULTS.safetyFactor,
    ));
    // Refused at open: NO atoms file and NO provisional manifest were created.
    await expect(stat(join(root, 'set-refused', 'atoms.ndjson'))).rejects.toThrow();
    await expect(stat(join(root, 'set-refused', PROVISIONAL_MANIFEST_FILE))).rejects.toThrow();
  });

  it('scales the estimate with the caller\'s expectedAtoms hint', async () => {
    // 10 atoms is far under any sane headroom — a small run is NOT refused on a tight disk.
    // 1.5 GiB free: above the floor + a tiny run's estimate, below the default 500k-atom
    // estimate (~646 MB) + floor (~1.72 GB total).
    const free = Math.floor(1.5 * DISK_PREFLIGHT_DEFAULTS.minFreeBytes);
    const w = await openAtomWriter({
      atomSetId: 'set-small', root, surfaceId: 'x',
      expectedAtoms: 10, statfsImpl: statfsReporting(free),
    });
    await w.append(atom(0));
    await w.finalize();
    // The same free space refuses the default (500k-atom) estimate.
    await expect(openAtomWriter({
      atomSetId: 'set-big', root, surfaceId: 'x', statfsImpl: statfsReporting(free),
    })).rejects.toThrow(/disk preflight REFUSED/);
  });

  it('measures the RESOLVED root it was given, not a hardcoded path', async () => {
    const seen = [];
    const w = await openAtomWriter({
      atomSetId: 'set-root', root, surfaceId: 'x', statfsImpl: statfsReporting(PLENTY, seen),
    });
    await w.finalize();
    expect(seen[0]).toBe(root);
    const pre = await diskPreflight({ root, statfsImpl: statfsReporting(PLENTY, seen) });
    expect(pre.root).toBe(root);
    expect(seen[1]).toBe(root);
  });

  it('respects SOR_ATOM_STORE — the env-selected root is the one measured (WS-438 #5)', async () => {
    const envRoot = join(root, 'env-root');
    await mkdir(envRoot, { recursive: true });
    vi.stubEnv('SOR_ATOM_STORE', envRoot);
    vi.resetModules();
    const fresh = await import('../backtest/atomStore.mjs');
    expect(fresh.DEFAULT_ATOM_STORE_ROOT).toBe(envRoot);

    const seen = [];
    const w = await fresh.openAtomWriter({
      atomSetId: 'env-set', surfaceId: 'x', statfsImpl: statfsReporting(PLENTY, seen),
    });
    expect(seen[0]).toBe(envRoot);                       // measured the env-resolved root
    expect(w.dir).toBe(join(envRoot, 'env-set'));        // and writes there too
    await w.finalize();
  });

  it('refuses to start BLIND when free space cannot be measured', async () => {
    await expect(openAtomWriter({
      atomSetId: 'set-blind', root, surfaceId: 'x',
      statfsImpl: async () => { throw new Error('volume gone'); },
    })).rejects.toThrow(/could not measure free space/);
  });
});

describe('mid-run exhaustion — graceful abort with the capture intact (WS-438 #2)', () => {
  it('aborts at the checkpoint when free space falls below the floor, preserving every row', async () => {
    let calls = 0;
    const statfsImpl = async () => {
      calls += 1;
      // Preflight sees a healthy drive; every re-check sees it exhausted from elsewhere.
      const freeBytes = calls === 1 ? PLENTY : 0;
      return { bavail: Math.floor(freeBytes / 4096), bsize: 4096 };
    };
    const w = await openAtomWriter({
      atomSetId: 'set-exhausted', root, surfaceId: 'x',
      expectedAtoms: 100, checkpointEveryAtoms: 5, minFreeBytes: 1000, statfsImpl,
    });
    for (let i = 0; i < 4; i += 1) await w.append(atom(i));

    const err = await w.append(atom(4)).catch((e) => e); // 5th append: checkpoint + re-check
    expect(err).toBeInstanceOf(AtomStoreError);
    expect(err.message).toMatch(/ABORTED/);
    expect(err.message).toMatch(/with the capture intact/);
    expect(err.atomsPreserved).toBe(5);
    expect(err.checkpointHash).toMatch(/^sha256:/);
    expect(err.aborted).toBe(true);

    // The writer is dead; the history is closed.
    await expect(w.append(atom(5))).rejects.toThrow(/finalized/);
    await expect(w.finalize()).rejects.toThrow(/already finalized/);

    // Every row written before the abort is READABLE, and the set is TRUNCATED — not NOT_FOUND.
    const byId = await resolveAtomSetById('set-exhausted', { root });
    expect(byId.resolved).toBe(false);
    expect(byId.reason).toBe(RESOLVE_FAILURES.TRUNCATED);
    expect(byId.partial).toBe(true);
    expect(byId.atoms).toHaveLength(5);

    // The abort registered its checkpoint hash, so even HASH-based resolution finds the rows.
    const byHash = await resolveAtomSet(err.checkpointHash, { root });
    expect(byHash.reason).toBe(RESOLVE_FAILURES.TRUNCATED);
    expect(byHash.partial).toBe(true);
    expect(byHash.atoms).toHaveLength(5);
    expect(byHash.manifest.provisional).toBe(true);
  });

  it('refuses to reopen an interrupted set — the history stays append-only', async () => {
    let calls = 0;
    const statfsImpl = async () => {
      calls += 1;
      return { bavail: calls === 1 ? Math.floor(PLENTY / 4096) : 0, bsize: 4096 };
    };
    const w = await openAtomWriter({
      atomSetId: 'set-interrupted', root, surfaceId: 'x',
      expectedAtoms: 10, checkpointEveryAtoms: 2, minFreeBytes: 1000, statfsImpl,
    });
    await w.append(atom(0));
    await expect(w.append(atom(1))).rejects.toThrow(/ABORTED/);

    await expect(openAtomWriter({
      atomSetId: 'set-interrupted', root, surfaceId: 'x', statfsImpl: statfsReporting(PLENTY),
    })).rejects.toThrow(/INTERRUPTED capture/);
  });
});

describe('interrupted sets resolve TRUNCATED with rows readable (WS-438 #3, #4)', () => {
  /**
   * A killed process leaves exactly this on disk: rows, a provisional manifest from the last
   * checkpoint, no final manifest, no index entry. Built by hand because a SIGKILL cannot be
   * delivered to ourselves mid-test — this IS the post-kill disk state, byte for byte.
   */
  const buildKilledSet = async (atomSetId, { rows = 7, checkpointAt = 6 } = {}) => {
    const dir = join(root, atomSetId);
    await mkdir(dir, { recursive: true });
    const lines = [];
    for (let i = 0; i < rows; i += 1) lines.push(JSON.stringify(atom(i)));
    await writeFile(join(dir, 'atoms.ndjson'), lines.map((l) => `${l}\n`).join(''), 'utf8');

    const h = createHash('sha256');
    for (let i = 0; i < checkpointAt; i += 1) h.update(`${lines[i]}\n`, 'utf8');
    const provisional = {
      provisional: true,
      atomSetId,
      surfaceId: 'read:test',
      fullSampleRate: 0,
      anchorGeneration: 1,
      atomCount: null,                       // a provisional manifest CANNOT claim completeness
      checkpointAtomCount: checkpointAt,
      checkpointAtomSetHash: `sha256:${h.digest('hex')}`,
      expectedAtoms: 100,
      openedAt: new Date().toISOString(),
      checkpointAt: new Date().toISOString(),
    };
    await writeFile(
      join(dir, PROVISIONAL_MANIFEST_FILE), `${JSON.stringify(provisional, null, 2)}\n`, 'utf8',
    );
    return { dir, lines, provisional };
  };

  it('a killed capture resolves TRUNCATED with every durable row — never NOT_FOUND (#4a, #4b)', async () => {
    await buildKilledSet('set-killed');
    const out = await resolveAtomSetById('set-killed', { root });

    expect(out.resolved).toBe(false);
    expect(out.reason).toBe(RESOLVE_FAILURES.TRUNCATED);   // incomplete, not "never happened"
    expect(out.partial).toBe(true);
    expect(out.atoms).toHaveLength(7);                     // rows past the checkpoint included
    expect(out.atoms[6].atomId).toBe('H6#0@3');
    expect(out.manifest.provisional).toBe(true);
    expect(out.detail).toMatch(/final manifest never written/);
  });

  it('an aggregate over a truncated set is labelled partial, not silently complete (#4c)', async () => {
    await buildKilledSet('set-agg');
    const out = await resolveAtomSetById('set-agg', { root });

    // The standing aggregate machinery: the manifest's atomCount reader answers "was the set
    // truncated?" — and a provisional manifest can NEVER make it answer "complete", because
    // its atomCount is structurally null.
    const agg = atomsSelfCheck(out.atoms, out.manifest);
    const atomCountReport = agg.reports.find((r) => r.field === 'atomCount');
    expect(atomCountReport.value.readable).toBe(7);
    expect(atomCountReport.value.declared).toBe(null);
    expect(atomCountReport.value.agrees).toBe(false);      // labelled partial

    // And the assert-level path refuses the set outright — a Result Card can never silently
    // stand on a partial capture.
    await expect(assertAtomsResolvable(
      { resultCardId: 'RC-part', atomSetHash: out.manifest.checkpointAtomSetHash }, { root },
    )).rejects.toThrow(AtomStoreError);
  });

  it('tolerates a torn tail line, reporting it rather than absorbing it', async () => {
    const { dir } = await buildKilledSet('set-torn');
    await appendFile(join(dir, 'atoms.ndjson'), '{"atomId":"H99#0@3","situa', 'utf8'); // torn mid-write
    const out = await resolveAtomSetById('set-torn', { root });
    expect(out.reason).toBe(RESOLVE_FAILURES.TRUNCATED);
    expect(out.atoms).toHaveLength(7);                     // durable rows survive the torn byte
    expect(out.corruptTail).toBe(true);
    expect(out.detail).toMatch(/torn tail/);
  });

  it('detects tampering below the checkpoint as HASH_MISMATCH, not TRUNCATED', async () => {
    const { dir } = await buildKilledSet('set-tampered');
    const text = await readFile(join(dir, 'atoms.ndjson'), 'utf8');
    await writeFile(join(dir, 'atoms.ndjson'), text.replace('"call":0.6', '"call":0.9'), 'utf8');
    const out = await resolveAtomSetById('set-tampered', { root });
    expect(out.reason).toBe(RESOLVE_FAILURES.HASH_MISMATCH);
    expect(out.atoms).toEqual([]);
  });

  it('a set with no manifest of either kind is NOT_FOUND — absence still means absence', async () => {
    const out = await resolveAtomSetById('set-never-existed', { root });
    expect(out.resolved).toBe(false);
    expect(out.reason).toBe(RESOLVE_FAILURES.NOT_FOUND);
  });

  it('finalize SUPERSEDES the provisional manifest, and finalized immutability is untouched', async () => {
    const w = await openAtomWriter({
      atomSetId: 'set-final', root, surfaceId: 'x',
      expectedAtoms: 10, checkpointEveryAtoms: 2, statfsImpl: statfsReporting(PLENTY),
    });
    for (let i = 0; i < 5; i += 1) await w.append(atom(i));
    // Mid-run, the provisional manifest exists — that is what makes a kill recoverable.
    await stat(join(root, 'set-final', PROVISIONAL_MANIFEST_FILE));

    const m = await w.finalize();
    // Superseded: the provisional is gone, the final manifest stands alone.
    await expect(stat(join(root, 'set-final', PROVISIONAL_MANIFEST_FILE))).rejects.toThrow();

    const byId = await resolveAtomSetById('set-final', { root });
    expect(byId.resolved).toBe(true);
    expect(byId.atoms).toHaveLength(5);
    expect(byId.manifest.atomSetHash).toBe(m.atomSetHash);
    const byHash = await resolveAtomSet(m.atomSetHash, { root });
    expect(byHash.resolved).toBe(true);

    // The immutability contract survives WS-438: reopening a FINALIZED set still throws.
    await expect(openAtomWriter({
      atomSetId: 'set-final', root, surfaceId: 'x', statfsImpl: statfsReporting(PLENTY),
    })).rejects.toThrow(/already finalized/);
  });
});
