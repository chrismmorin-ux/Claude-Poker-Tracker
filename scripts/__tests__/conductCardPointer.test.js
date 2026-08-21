/**
 * WS-599 — the Conduct Card pointer, and the three refusals `.claude/rules/artifact-location.md`
 * requires.
 *
 * The load-bearing tests here are the NEGATIVE ones. A pointer store that resolves cards is easy
 * and was never the risk; the risk is a resolver that quietly does something helpful when the
 * canonical artifact is gone. The ruling names both helpful things and forbids them — "it does
 * not silently use a stale local copy, and it does not quietly recompute a substitute" — so
 * `refuses when the canonical artifact is unreachable` and `refuses to fall back to a cache` are
 * the tests this file exists for. If someone adds an `allowStale` option they fail.
 *
 * `writing a card without a pointer is impossible` is the structural one: it asserts there is no
 * exported writer that takes a card and a path and stops there, and that the failure path leaves
 * no orphan card behind. A card with no pointer is the WS-599 defect, so a test that only
 * checked the happy path would miss the whole ticket.
 */
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import * as ptr from '../villainArchetype/conductCardPointer.mjs';

const {
  mintPointer, writePointer, pointerPathFor, pointerFileName, listPointers,
  reconcileStanding, regenerateIndex, resolveCard, writeCardWithPointer,
  identifyContentHash, UNRECOVERABLE, NODES, REPO_ROOT,
  UnreachableArtifactError, RemoteArtifactError, CardIntegrityError,
} = ptr;

/** A minimally-shaped card. Only the fields the pointer reads — a full one would hide typos. */
const makeCard = (over = {}) => ({
  cardId: 'CC-TESTSUBJ01-aaaaaaaa',
  schemaVersion: 2,
  subjectId: 'TESTSUBJ01/xyz',
  surfaceKind: 'Read',
  rulesetHash: 'aaaaaaaa11112222',
  contentHash: 'sha256:deadbeef',
  disclaimerRegisterVersion: 'FR-1+5875fc0c199f',
  dealBook: { dealBookHash: 'sha256:db00', files: 10, hands: 100, decisions: 250 },
  evidence: { decisions: 250 },
  rules: [{ ruleId: 'r-aaaa000000' }, { ruleId: 'r-bbbb111111' }],
  unresolved: [],
  manifest: {
    engineCommit: 'a'.repeat(40),
    engineDirty: false,
    dealBookHash: 'sha256:db00',
    schemaVersion: 12,
    constants: { minRule: 25 },
    seeds: {},
  },
  population: 'test',
  provenance: { site: 'TestSite', dateStart: '2009-07-01', dateEnd: '2009-07-23', stake: '50NLH' },
  ...over,
});

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccptr-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

/** Writes card bytes into the scratch dir and mints a pointer naming that absolute path. */
function stageCard(card, { role = 'not-yet-canonical', node = NODES.G16, canonicalRef } = {}) {
  const file = path.join(tmp, `${card.cardId}.conduct-card.json`);
  const bytes = Buffer.from(JSON.stringify(card, null, 1), 'utf8');
  fs.writeFileSync(file, bytes);
  const pointer = mintPointer({
    card,
    cardBytes: bytes,
    location: { role, node, path: file, gitignored: false, ...(canonicalRef ? { canonicalRef } : {}) },
    emittedAt: '2026-08-20T00:00:00.000Z',
    provenanceMode: 'emit-time',
    registeredBy: 'test',
  });
  return { file, bytes, pointer };
}

describe('pointer round-trip', () => {
  it('mints, writes, reads back and resolves the card it names', () => {
    const card = makeCard();
    const { file, bytes, pointer } = stageCard(card);

    expect(pointer.cardId).toBe(card.cardId);
    expect(pointer.subjectId).toBe(card.subjectId);
    expect(pointer.identity.rulesetHash).toBe(card.rulesetHash);
    expect(pointer.identity.byteSize).toBe(bytes.length);
    expect(pointer.identity.fileSha256)
      .toBe(`sha256:${createHash('sha256').update(bytes).digest('hex')}`);
    expect(pointer.manifest.dealBookHash).toBe('sha256:db00');
    expect(pointer.manifest.disclaimerRegisterVersion).toBe('FR-1+5875fc0c199f');

    // Written to disk and parsed back unchanged, then resolved to the original card.
    const p = path.join(tmp, pointerFileName(pointer));
    fs.writeFileSync(p, `${JSON.stringify(pointer, null, 2)}\n`);
    const reread = JSON.parse(fs.readFileSync(p, 'utf8'));
    expect(reread).toEqual(pointer);

    const got = resolveCard(reread, { node: NODES.G16 });
    expect(got.cardId).toBe(card.cardId);
    expect(got.rules).toHaveLength(2);
    expect(file).toBe(reread.location.path);
  });

  it('records an absent field with a sentinel and a reason, never an omission or a guess', () => {
    const card = makeCard();
    delete card.rulesetHash;
    const { pointer } = stageCard(card);
    expect(pointer.identity.rulesetHash).toBe(UNRECOVERABLE);
    expect(pointer.identity.rulesetHashReason).toMatch(/positional|collide/i);

    const noTime = mintPointer({
      card, cardBytes: Buffer.from('{}'), emittedAt: null, registeredBy: 't',
      location: { role: 'not-yet-canonical', node: NODES.G16, path: 'x.json' },
    });
    expect(noTime.emittedAt).toBe(UNRECOVERABLE);
    expect(noTime.emittedAtReason).toBeTruthy();
  });

  it('labels the pre-WS-599 contentHash as a citation key, not an integrity check', () => {
    // The defective digest: a replacer ALLOWLIST over top-level keys.
    const body = { ...makeCard(), contentHash: null };
    const legacy = `sha256:${createHash('sha256')
      .update(JSON.stringify(body, Object.keys(body).sort())).digest('hex')}`;
    const kind = identifyContentHash({ ...makeCard(), contentHash: legacy });
    expect(kind.algorithm).toBe('legacy-allowlist');
    expect(kind.coversWholeCard).toBe(false);
  });
});

describe('the refusals — .claude/rules/artifact-location.md', () => {
  it('RAISES when the artifact is unreachable, and does not recompute a substitute', () => {
    const { file, pointer } = stageCard(makeCard());
    fs.unlinkSync(file);                       // the artifact is gone
    expect(() => resolveCard(pointer, { node: NODES.G16 }))
      .toThrow(UnreachableArtifactError);
    expect(() => resolveCard(pointer, { node: NODES.G16 }))
      .toThrow(/unreachable/i);
  });

  it('RAISES rather than improvising a transfer when the artifact lives on another node', () => {
    const { pointer } = stageCard(makeCard(), { node: NODES.NODE1 });
    // The bytes are sitting right there on this filesystem; the pointer says CM-NODE1 owns them.
    expect(fs.existsSync(pointer.location.path)).toBe(true);
    expect(() => resolveCard(pointer, { node: NODES.G16 })).toThrow(RemoteArtifactError);
  });

  it('REFUSES to fall back to a local cache when the canonical is unreachable', () => {
    const card = makeCard();
    const { pointer } = stageCard(card, {
      role: 'cache',
      node: NODES.G16,
      canonicalRef: { node: NODES.G16, path: path.join(tmp, 'canonical-that-does-not-exist.json') },
    });
    // The cached bytes are present and their hash is correct. It still refuses, because the
    // ruling forbids resolving from the copy when the canonical cannot be reached.
    expect(fs.existsSync(pointer.location.path)).toBe(true);
    expect(() => resolveCard(pointer, { node: NODES.G16 })).toThrow(UnreachableArtifactError);
  });

  it('a cache pointer cannot even be minted without naming its canonical', () => {
    expect(() => mintPointer({
      card: makeCard(),
      cardBytes: Buffer.from('{}'),
      location: { role: 'cache', node: NODES.G16, path: 'x.json' },
      registeredBy: 't',
    })).toThrow(/canonicalRef/);
  });

  it('exposes no fallback, stale-allowing or recompute option on the resolver', () => {
    const { file, pointer } = stageCard(makeCard());
    fs.unlinkSync(file);
    for (const opts of [{ fallback: true }, { allowStale: true }, { recompute: true }]) {
      expect(() => resolveCard(pointer, { node: NODES.G16, ...opts }))
        .toThrow(UnreachableArtifactError);
    }
  });
});

describe('corrupted cache is a HARD FAILURE, not a warning', () => {
  it('throws when the bytes do not hash to the pointer contentHash', () => {
    const card = makeCard();
    const { file, pointer } = stageCard(card);

    // A single value changed deep inside — the class of corruption the legacy contentHash could
    // not see, which is why the pointer anchors on bytes it hashed itself.
    const tampered = JSON.parse(fs.readFileSync(file, 'utf8'));
    tampered.evidence.decisions = 999999;
    fs.writeFileSync(file, JSON.stringify(tampered, null, 1));

    expect(() => resolveCard(pointer, { node: NODES.G16 })).toThrow(CardIntegrityError);
    expect(() => resolveCard(pointer, { node: NODES.G16 })).toThrow(/expected sha256:/);
  });

  it('throws when the file is a different card entirely', () => {
    const { file, pointer } = stageCard(makeCard());
    const other = makeCard({ cardId: 'CC-OTHER-1', subjectId: 'OTHER/1' });
    fs.writeFileSync(file, JSON.stringify(other, null, 1));
    expect(() => resolveCard(pointer, { node: NODES.G16 })).toThrow(CardIntegrityError);
  });
});

describe('currency — exactly one current per (subjectId, rulesetHash)', () => {
  const at = (t, over) => mintPointer({
    card: makeCard(over),
    cardBytes: Buffer.from(JSON.stringify({ t, ...over })),
    location: { role: 'not-yet-canonical', node: NODES.G16, path: `p-${t}.json` },
    emittedAt: t,
    registeredBy: 't',
  });

  it('marks the newest current and RETAINS the superseded ones', () => {
    const a = at('2026-08-01T00:00:00.000Z');
    const b = at('2026-08-10T00:00:00.000Z');
    const c = at('2026-08-05T00:00:00.000Z');
    const all = reconcileStanding([a, b, c]);

    expect(all).toHaveLength(3);                                  // nothing deleted
    expect(all.filter((p) => p.standing === 'current')).toHaveLength(1);
    expect(b.standing).toBe('current');
    expect(a.standing).toBe('superseded');
    expect(c.standing).toBe('superseded');
    expect(a.supersededBy).toBe(pointerFileName(b));
    expect(a.standingReason).toMatch(/RETAINED|never.*deleted/i);
  });

  it('keeps groups separate — a different ruleset is a different question', () => {
    const a = at('2026-08-01T00:00:00.000Z', { rulesetHash: 'ruleset-one' });
    const b = at('2026-08-10T00:00:00.000Z', { rulesetHash: 'ruleset-two' });
    reconcileStanding([a, b]);
    expect(a.standing).toBe('current');
    expect(b.standing).toBe('current');
  });

  it('names NO current card when rulesetHash is unrecoverable', () => {
    // The seven pre-WS-599 cards. The currency key cannot be formed, so declaring one
    // authoritative would assert a fact nobody verified.
    const cardNoHash = makeCard();
    delete cardNoHash.rulesetHash;
    const a = mintPointer({
      card: cardNoHash, cardBytes: Buffer.from('a'), emittedAt: null, registeredBy: 't',
      notes: { fileMtime: '2026-08-19T15:00:00.000Z' },
      location: { role: 'not-yet-canonical', node: NODES.G16, path: 'a.json' },
    });
    const b = mintPointer({
      card: cardNoHash, cardBytes: Buffer.from('b'), emittedAt: null, registeredBy: 't',
      notes: { fileMtime: '2026-08-19T22:00:00.000Z' },
      location: { role: 'not-yet-canonical', node: NODES.G16, path: 'b.json' },
    });
    reconcileStanding([a, b]);
    expect([a.standing, b.standing]).toEqual(['unrankable', 'unrankable']);
    expect([a, b].filter((p) => p.standing === 'current')).toHaveLength(0);
    // The newest is flagged factually, and the flag is explicitly not an authority claim.
    expect(b.latestKnownForSubject).toBe(true);
    expect(a.latestKnownForSubject).toBe(false);
    expect(b.standingReason).toMatch(/not an authority claim/i);
  });
});

describe('a card cannot be written without its pointer', () => {
  it('exposes no writer that takes a card and a path and stops there', () => {
    const writers = Object.keys(ptr).filter((k) => /^write/.test(k));
    expect(writers.sort()).toEqual(['writeCardWithPointer', 'writePointer']);
    // writePointer takes a pointer, not a card — there is no card-only writer to reach for.
    expect(() => ptr.writePointer({ cardId: 'x' })).toThrow();
  });

  it('leaves no orphan card behind when the pointer write fails', () => {
    const card = makeCard();
    const out = path.join(tmp, 'orphan.conduct-card.json');
    // A card the pointer minter must reject: no subjectId. The mint happens before any write.
    const bad = { ...card, subjectId: undefined };
    expect(() => writeCardWithPointer({
      card: bad, outPath: out, node: NODES.G16, registeredBy: 't', pointerDir: tmp,
    })).toThrow();
    expect(fs.existsSync(out)).toBe(false);
  });

  it('writes both, and the pointer resolves back to the exact bytes written', () => {
    // Two directories on purpose. The artifact and the pointer store are separate places in
    // production too — the card goes to a gitignored artifact dir, the pointer into the repo —
    // and pointing both at one directory made `listPointers` try to read a card as a pointer.
    const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccptr-art-'));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccptr-ptr-'));
    try {
      const card = makeCard();
      const out = path.join(artifactDir, 'x.conduct-card.json');
      // `pointerDir` keeps the test off the repo's real pointer store. Without it this test
      // rewrote docs/standard-of-record/pointers/INDEX.yaml as a side effect.
      const res = writeCardWithPointer({
        card, outPath: out, node: NODES.G16, registeredBy: 'test', pointerDir: dir,
      });
      expect(fs.existsSync(res.cardPath)).toBe(true);
      expect(fs.existsSync(res.pointerPath)).toBe(true);
      expect(res.pointer.location.role).toBe('not-yet-canonical');
      expect(res.pointer.location.migrationObligation.requiredNode).toBe(NODES.NODE1);
      expect(res.pointer.emittedAt).not.toBe(UNRECOVERABLE);

      const got = resolveCard(res.pointer, { node: NODES.G16 });
      expect(got.cardId).toBe(card.cardId);

      // The generated index is rebuilt beside the pointer, carrying its do-not-edit header.
      const idx = fs.readFileSync(path.join(dir, 'INDEX.yaml'), 'utf8');
      expect(idx).toMatch(/GENERATED — DO NOT EDIT/);
      expect(idx).toMatch(/total_pointers: 1/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.rmSync(artifactDir, { recursive: true, force: true });
    }
  });

  it('refuses to treat a card left in the pointer store as a pointer', () => {
    // Loud, not skipped: a malformed pointer that silently drops out of reconciliation would
    // leave the currency question quietly wrong, which is the failure WS-599 exists to close.
    fs.writeFileSync(path.join(tmp, 'not-a-pointer.json'), JSON.stringify(makeCard()));
    expect(() => listPointers(tmp)).toThrow(/is not a pointer record/);
  });

  it('a node1 write is canonical; a G16 write is not, and says so', () => {
    const card = makeCard();
    const p = mintPointer({
      card,
      cardBytes: Buffer.from('{}'),
      location: { role: 'canonical', node: NODES.NODE1, path: '/srv/cards/x.json' },
      emittedAt: '2026-08-20T00:00:00.000Z',
      registeredBy: 't',
    });
    expect(p.location.migrationObligation).toBeUndefined();

    const g = stageCard(card).pointer;
    expect(g.location.role).toBe('not-yet-canonical');
    expect(g.location.migrationObligation.status).toBe('outstanding');
  });
});

describe('the seven registered cards', () => {
  const dir = path.join(REPO_ROOT, 'docs', 'standard-of-record', 'pointers');

  // SPLIT 2026-08-20. This was one test asserting pointer integrity AND artifact
  // resolution, and it could only ever pass on a machine that happens to hold the artifact
  // store. It went red on CI the first time it ran there — `.tmp-arch/profiles-6max/` is
  // not in the repo and never will be: `.claude/rules/artifact-location.md` puts heavy
  // artifacts outside it by design. The pointer half is repo-verifiable everywhere; only
  // the resolution half needs the store.
  it('are all registered, and none is falsely marked current', () => {
    // No silent early-return on a missing dir. The pointers are COMMITTED, so their absence
    // is a real regression, and "a gate passing on an empty set is not a gate".
    expect(fs.existsSync(dir)).toBe(true);
    const entries = listPointers(dir).filter((e) => e.pointer.provenanceMode === 'retroactive');
    expect(entries).toHaveLength(7);
    for (const { pointer } of entries) {
      expect(pointer.identity.rulesetHash).toBe(UNRECOVERABLE);
      expect(pointer.standing).toBe('unrankable');
      expect(pointer.location.role).toBe('not-yet-canonical');
      expect(pointer.location.migrationObligation.requiredNode).toBe(NODES.NODE1);
      expect(pointer.manifest.engineCommitIdentifiesCode).toBe(false);
    }
  });

  it('each resolves against the artifact store, where the store is reachable', (ctx) => {
    // Resolving verifies the recorded fileSha256 against the bytes on disk, so it needs the
    // artifacts — which live outside the repo. Where they are absent this SKIPS VISIBLY
    // rather than returning silently: a skip shows in the run summary, a bare `return`
    // reports as a pass and is indistinguishable from a real verification.
    //
    // The two error classes are NOT collapsed. UnreachableArtifactError means the store is
    // not on this machine — environmental. CardIntegrityError means the bytes are present
    // and WRONG, which is the thing this test exists to catch, and it fails everywhere.
    expect(fs.existsSync(dir)).toBe(true);
    const entries = listPointers(dir).filter((e) => e.pointer.provenanceMode === 'retroactive');
    expect(entries).toHaveLength(7);

    // ALL-OR-NOTHING, deliberately. The seven pointers span three directories
    // (.tmp-arch/profiles-6max, .tmp-arch/ws551, .tmp-arch/profiles-v2), so a PARTIAL
    // resolution is possible — and it must not pass. Some-present-some-missing means the
    // store is inconsistent, which is precisely what "a missing artifact fails loudly
    // rather than silently resolving to something else" is about. Only a WHOLLY absent
    // store is environmental.
    const unreachable = [];
    let resolved = 0;
    for (const { pointer } of entries) {
      let card;
      try {
        card = resolveCard(pointer, { node: pointer.location.node });
      } catch (err) {
        if (err instanceof ptr.UnreachableArtifactError) { unreachable.push(pointer.cardId); continue; }
        throw err;                       // integrity failure — never swallowed
      }
      expect(card.cardId).toBe(pointer.cardId);
      resolved += 1;
    }

    if (unreachable.length === entries.length) {
      ctx.skip(`artifact store wholly unreachable on this machine — 0 of ${entries.length} `
        + 'cards resolvable. Pointer integrity is asserted by the sibling test; resolution '
        + 'needs the store (see .claude/rules/artifact-location.md).');
      return;
    }
    // Partial store: fail, and name the missing ones.
    expect(
      unreachable,
      `${resolved} of ${entries.length} cards resolved but ${unreachable.length} are missing `
      + `(${unreachable.join(', ')}). A partially-present store is not a reachable store — `
      + 'it verifies a subset while reporting as a complete check.',
    ).toEqual([]);
  });

  it('has a generated index carrying a do-not-edit header', () => {
    const idx = path.join(dir, 'INDEX.yaml');
    if (!fs.existsSync(idx)) return;
    const txt = fs.readFileSync(idx, 'utf8');
    expect(txt).toMatch(/GENERATED — DO NOT EDIT/);
    expect(txt).toMatch(/Rebuild from:/);
  });
});
