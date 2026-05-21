/**
 * writers.test.js — drift cross-check between WRITERS.md table and the
 * in-code `anchorLibraryWriters` registry.
 *
 * The test:
 *   1. Reads `docs/projects/exploit-anchor-library/WRITERS.md` at run time.
 *   2. Extracts every writer ID from `### W-XX-N — name` headings.
 *   3. Asserts every parsed ID is present in the registry.
 *   4. Asserts every registered ID is in the parsed set.
 *
 * Drift fails CI on either side: an unregistered writer in the MD, or an
 * orphaned writer in the registry. This is the I-WR-1 enforcement contract.
 *
 * Per anchorLibrary CLAUDE.md §9 — "CI-grep enforced." The grep target
 * for `scripts/check-anchor-writers.sh` is the registry; the registry is
 * cross-checked here against the source-of-truth document.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { anchorLibraryWriters, getWritersForStore } from '../writers';

const WRITERS_MD_PATH = resolve(
  process.cwd(),
  'docs/projects/exploit-anchor-library/WRITERS.md',
);

const parseWritersFromMarkdown = () => {
  const content = readFileSync(WRITERS_MD_PATH, 'utf8');
  // Match `### W-XX-N — name` headings (the `—` is an em-dash, U+2014).
  const headingRe = /^### (W-[A-Z]+-\d+)\b/gm;
  const ids = new Set();
  let match;
  while ((match = headingRe.exec(content)) !== null) {
    ids.add(match[1]);
  }
  return ids;
};

describe('anchorLibraryWriters — WRITERS.md ↔ registry drift cross-check', () => {
  const mdIds = parseWritersFromMarkdown();
  const registryIds = new Set(anchorLibraryWriters.getAll().map((w) => w.id));

  it('WRITERS.md contains at least 13 writer headings (sanity)', () => {
    expect(mdIds.size).toBeGreaterThanOrEqual(13);
  });

  it('every WRITERS.md writer ID is registered in writers.js', () => {
    const missing = [...mdIds].filter((id) => !registryIds.has(id));
    expect(missing).toEqual([]);
  });

  it('every writers.js entry has a WRITERS.md heading', () => {
    const orphaned = [...registryIds].filter((id) => !mdIds.has(id));
    expect(orphaned).toEqual([]);
  });

  it('counts match exactly', () => {
    expect(registryIds.size).toBe(mdIds.size);
  });
});

describe('anchorLibraryWriters — registry surface', () => {
  it('exposes get / getAll / has / forEach / size', () => {
    expect(typeof anchorLibraryWriters.get).toBe('function');
    expect(typeof anchorLibraryWriters.getAll).toBe('function');
    expect(typeof anchorLibraryWriters.has).toBe('function');
    expect(typeof anchorLibraryWriters.forEach).toBe('function');
    expect(typeof anchorLibraryWriters.size).toBe('function');
  });

  it('does NOT expose register / deregister (frozen handle)', () => {
    expect(anchorLibraryWriters.register).toBeUndefined();
    expect(anchorLibraryWriters.deregister).toBeUndefined();
  });

  it('has the expected per-store counts (4 / 3 / 3 / 3)', () => {
    expect(getWritersForStore('exploitAnchors')).toHaveLength(4);
    expect(getWritersForStore('anchorObservations')).toHaveLength(3);
    expect(getWritersForStore('anchorCandidates')).toHaveLength(3);
    expect(getWritersForStore('perceptionPrimitives')).toHaveLength(3);
  });

  it('every entry has required fields populated', () => {
    anchorLibraryWriters.forEach((entry) => {
      expect(entry.id).toMatch(/^W-[A-Z]+-\d+$/);
      expect(typeof entry.store).toBe('string');
      expect(entry.store.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.fields)).toBe(true);
      expect(Array.isArray(entry.invariants)).toBe(true);
      expect(entry.invariants.length).toBeGreaterThan(0);
    });
  });

  it('every entry carries I-WR-1 (enumeration completeness)', () => {
    anchorLibraryWriters.forEach((entry) => {
      expect(entry.invariants).toContain('I-WR-1');
    });
  });
});
