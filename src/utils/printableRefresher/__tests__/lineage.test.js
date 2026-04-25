/**
 * lineage.test.js — unit coverage for hashUtil + computeSourceHash +
 * stableStringify + derive7FieldLineage + printFooter + isStubContentHash.
 *
 * Scope: pure-function unit tests only. The end-to-end "manifest matches its
 * stored contentHash" assertion is in `contentDrift.test.js` (Check 1).
 */

import { describe, test, expect } from 'vitest';
import {
  hashUtil,
  computeSourceHash,
  stableStringify,
  derive7FieldLineage,
  printFooter,
  isStubContentHash,
  SHA256_PREFIX,
} from '../lineage.js';

describe('lineage — hashUtil', () => {
  test('returns sha256:<64-hex> string format', async () => {
    const h = await hashUtil('hello world');
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test('byte-stable across repeated calls on identical input', async () => {
    const a = await hashUtil('exact-same-input');
    const b = await hashUtil('exact-same-input');
    expect(a).toBe(b);
  });

  test('different input produces different hash', async () => {
    const a = await hashUtil('input-a');
    const b = await hashUtil('input-b');
    expect(a).not.toBe(b);
  });

  test('handles empty string deterministically', async () => {
    const a = await hashUtil('');
    const b = await hashUtil('');
    expect(a).toBe(b);
    // Known sha256 of empty string for safety
    expect(a).toBe(`${SHA256_PREFIX}e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`);
  });

  test('UTF-8 bytes (not code points) are hashed', async () => {
    // "é" is 2 UTF-8 bytes, not 1 code-point — implementation must encode UTF-8
    const h1 = await hashUtil('é');
    const h2 = await hashUtil('e');
    expect(h1).not.toBe(h2);
  });
});

describe('lineage — stableStringify', () => {
  test('orders object keys alphabetically', () => {
    const a = stableStringify({ b: 1, a: 2 });
    const b = stableStringify({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  test('handles nested objects', () => {
    const a = stableStringify({ outer: { z: 1, a: 2 } });
    const b = stableStringify({ outer: { a: 2, z: 1 } });
    expect(a).toBe(b);
  });

  test('handles arrays in original order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });

  test('handles primitives + null + undefined', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(undefined)).toBe('undefined');
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify('hi')).toBe('"hi"');
  });
});

describe('lineage — computeSourceHash', () => {
  const minimalManifest = {
    bodyMarkdown: 'auto-profit body',
    sourceUtils: [],
    generatedFields: {},
  };

  test('produces a sha256 hash for a minimal manifest', async () => {
    const h = await computeSourceHash(minimalManifest);
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test('byte-stable across repeated calls on identical manifest', async () => {
    const a = await computeSourceHash(minimalManifest);
    const b = await computeSourceHash(minimalManifest);
    expect(a).toBe(b);
  });

  test('hash changes when bodyMarkdown changes', async () => {
    const a = await computeSourceHash(minimalManifest);
    const b = await computeSourceHash({ ...minimalManifest, bodyMarkdown: 'different body' });
    expect(a).not.toBe(b);
  });

  test('hash changes when sourceUtils[].hash changes', async () => {
    const a = await computeSourceHash({
      ...minimalManifest,
      sourceUtils: [{ path: 'p', hash: 'sha256:aaa', fn: 'f' }],
    });
    const b = await computeSourceHash({
      ...minimalManifest,
      sourceUtils: [{ path: 'p', hash: 'sha256:bbb', fn: 'f' }],
    });
    expect(a).not.toBe(b);
  });

  test('hash changes when generatedFields changes', async () => {
    const a = await computeSourceHash({ ...minimalManifest, generatedFields: { x: 'a' } });
    const b = await computeSourceHash({ ...minimalManifest, generatedFields: { x: 'b' } });
    expect(a).not.toBe(b);
  });

  test('generatedFields key order does not affect hash (stable serialization)', async () => {
    const a = await computeSourceHash({ ...minimalManifest, generatedFields: { x: '1', y: '2' } });
    const b = await computeSourceHash({ ...minimalManifest, generatedFields: { y: '2', x: '1' } });
    expect(a).toBe(b);
  });

  test('handles missing sourceUtils + generatedFields gracefully', async () => {
    const h = await computeSourceHash({ bodyMarkdown: 'plain body' });
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('lineage — isStubContentHash', () => {
  test('detects sha256:stub-pending- prefix', () => {
    expect(isStubContentHash('sha256:stub-pending-PRF-G5-CI-S2-recomputation')).toBe(true);
    expect(isStubContentHash('sha256:stub-pending-anything')).toBe(true);
  });

  test('returns false for real hashes', () => {
    expect(isStubContentHash('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe(false);
  });

  test('returns false for non-strings', () => {
    expect(isStubContentHash(null)).toBe(false);
    expect(isStubContentHash(undefined)).toBe(false);
    expect(isStubContentHash(42)).toBe(false);
  });
});

describe('lineage — derive7FieldLineage', () => {
  const sampleManifest = {
    cardId: 'PRF-MATH-AUTO-PROFIT',
    schemaVersion: 1,
    lastVersionedAt: '2026-04-25T00:00:00Z',
    sourceUtils: [],
    theoryCitation: 'POKER_THEORY.md §3.1',
    assumptions: { stakes: 'rake-agnostic', effectiveStack: 100 },
    bucketDefinitionsCited: null,
  };

  test('returns all 7 named fields, no extras', () => {
    const l = derive7FieldLineage(sampleManifest, { engineVersion: 'v123', appVersion: 'v456' });
    expect(Object.keys(l).sort()).toEqual([
      'assumptionBundle',
      'bucketDefinitionsCited',
      'cardIdSemver',
      'engineAppVersion',
      'generationDate',
      'sourceUtilTrail',
      'theoryCitation',
    ]);
  });

  test('cardIdSemver = "<cardId> v<schemaVersion>"', () => {
    const l = derive7FieldLineage(sampleManifest);
    expect(l.cardIdSemver).toBe('PRF-MATH-AUTO-PROFIT v1');
  });

  test('generationDate echoes manifest.lastVersionedAt', () => {
    const l = derive7FieldLineage(sampleManifest);
    expect(l.generationDate).toBe('2026-04-25T00:00:00Z');
  });

  test('sourceUtilTrail falls back to POKER_THEORY-derivation when sourceUtils is empty', () => {
    const l = derive7FieldLineage(sampleManifest);
    expect(l.sourceUtilTrail).toMatch(/POKER_THEORY-derivation/);
  });

  test('sourceUtilTrail enumerates path#fn (hash) when sourceUtils non-empty', () => {
    const m = {
      ...sampleManifest,
      sourceUtils: [
        { path: 'src/utils/pokerCore/preflopCharts.js', fn: 'computeOpenRange', hash: 'sha256:abc' },
      ],
    };
    const l = derive7FieldLineage(m);
    expect(l.sourceUtilTrail).toBe('src/utils/pokerCore/preflopCharts.js#computeOpenRange (sha256:abc)');
  });

  test('engineAppVersion uses runtime values when supplied', () => {
    const l = derive7FieldLineage(sampleManifest, { engineVersion: 'v999', appVersion: 'v888' });
    expect(l.engineAppVersion).toBe('engine v999 / app v888');
  });

  test('engineAppVersion falls back to "unknown" markers when runtime not supplied', () => {
    const l = derive7FieldLineage(sampleManifest);
    expect(l.engineAppVersion).toBe('engine unknown-engine / app unknown-app');
  });

  test('theoryCitation echoes manifest.theoryCitation', () => {
    const l = derive7FieldLineage(sampleManifest);
    expect(l.theoryCitation).toBe('POKER_THEORY.md §3.1');
  });

  test('assumptionBundle is stable-stringified and key-order-invariant', () => {
    const m1 = { ...sampleManifest, assumptions: { a: 1, b: 2 } };
    const m2 = { ...sampleManifest, assumptions: { b: 2, a: 1 } };
    expect(derive7FieldLineage(m1).assumptionBundle).toBe(derive7FieldLineage(m2).assumptionBundle);
  });

  test('bucketDefinitionsCited propagates null verbatim', () => {
    const l = derive7FieldLineage(sampleManifest);
    expect(l.bucketDefinitionsCited).toBeNull();
  });

  test('bucketDefinitionsCited propagates non-null string verbatim', () => {
    const m = { ...sampleManifest, bucketDefinitionsCited: 'docs/glossary/equity-buckets.md' };
    const l = derive7FieldLineage(m);
    expect(l.bucketDefinitionsCited).toBe('docs/glossary/equity-buckets.md');
  });
});

describe('lineage — printFooter', () => {
  const sampleLineage = {
    cardIdSemver: 'PRF-MATH-AUTO-PROFIT v1',
    generationDate: '2026-04-25T00:00:00Z',
    sourceUtilTrail: 'POKER_THEORY-derivation (see field [5])',
    engineAppVersion: 'engine v1.0 / app v1.0',
    theoryCitation: 'POKER_THEORY.md §3.1',
    assumptionBundle: '{"effectiveStack":100,"stakes":"rake-agnostic"}',
    bucketDefinitionsCited: null,
  };

  test('renders 7 numbered lines', () => {
    const out = printFooter(sampleLineage);
    const lines = out.split('\n');
    expect(lines).toHaveLength(7);
    expect(lines[0]).toMatch(/^\[1\]/);
    expect(lines[6]).toMatch(/^\[7\]/);
  });

  test('null bucketDefinitionsCited renders an explicit "(no bucket definitions cited)" marker', () => {
    const out = printFooter(sampleLineage);
    expect(out).toContain('(no bucket definitions cited)');
  });

  test('non-null bucketDefinitionsCited renders verbatim', () => {
    const out = printFooter({ ...sampleLineage, bucketDefinitionsCited: 'glossary.md' });
    expect(out).toContain('[7] glossary.md');
    expect(out).not.toContain('(no bucket definitions cited)');
  });
});
