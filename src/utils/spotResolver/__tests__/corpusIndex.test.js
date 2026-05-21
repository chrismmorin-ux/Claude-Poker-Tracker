/**
 * corpusIndex.test.js — Verify the PWA-boot corpus index loads cleanly
 * from both upper-surface filenames + LSW lines.js, and that every
 * upper-surface filename parses via the canonical encoding.
 *
 * Per spike §Risks line 175 (upper-surface filename drift): a new
 * artifact shipped with a non-conforming filename should fail this
 * test rather than silently breaking the resolver.
 *
 * SLS Stream E — SPR-087 / WS-193.
 */

import { describe, it, expect } from 'vitest';
import {
  getCorpusIndex,
  getAllCorpusEntries,
  _parseUpperSurfaceFilenameForTests,
} from '../corpusIndex';

describe('corpusIndex — index build', () => {
  it('loads ≥1 entry from upper-surface artifacts', () => {
    const entries = getAllCorpusEntries();
    const upperSurface = entries.filter((e) => e.source === 'upper-surface');
    expect(upperSurface.length).toBeGreaterThanOrEqual(1);
  });

  it('loads ≥10 entries from LSW lines (8 lines × multiple decision nodes)', () => {
    const entries = getAllCorpusEntries();
    const lsw = entries.filter((e) => e.source === 'lsw');
    expect(lsw.length).toBeGreaterThanOrEqual(10);
  });

  it('every entry has the required CorpusEntry shape', () => {
    const entries = getAllCorpusEntries();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry).toHaveProperty('artifactId');
      expect(entry).toHaveProperty('source');
      expect(entry).toHaveProperty('heroPos');
      expect(entry).toHaveProperty('villainPos');
      expect(entry).toHaveProperty('potType');
      expect(entry).toHaveProperty('ipOop');
      expect(entry).toHaveProperty('texture');
      expect(entry).toHaveProperty('boardShorthand');
      expect(entry).toHaveProperty('nodeId');
    }
  });

  it('getCorpusIndex is memoized (returns identity-stable reference)', () => {
    const a = getCorpusIndex();
    const b = getCorpusIndex();
    expect(a).toBe(b);
  });

  it('source values are one of the allowed set', () => {
    const entries = getAllCorpusEntries();
    for (const entry of entries) {
      expect(['upper-surface', 'lsw']).toContain(entry.source);
    }
  });
});

describe('parseUpperSurfaceFilename', () => {
  it('parses btn-vs-bb-3bp-ip-wet-t96-flop_root.md', () => {
    const r = _parseUpperSurfaceFilenameForTests(
      'docs/upper-surface/reasoning-artifacts/btn-vs-bb-3bp-ip-wet-t96-flop_root.md',
    );
    expect(r).not.toBeNull();
    expect(r.heroPos).toBe('BTN');
    expect(r.villainPos).toBe('BB');
    expect(r.potType).toBe('3bp');
    expect(r.ipOop).toBe('ip');
    expect(r.texture).toBe('wet');
    expect(r.boardShorthand).toBe('t96');
    expect(r.nodeId).toBe('flop_root');
    expect(r.source).toBe('upper-surface');
  });

  it('parses btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md (multi-token node)', () => {
    const r = _parseUpperSurfaceFilenameForTests(
      'docs/upper-surface/reasoning-artifacts/btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md',
    );
    expect(r).not.toBeNull();
    expect(r.potType).toBe('srp');
    expect(r.boardShorthand).toBe('q72r');
    expect(r.nodeId).toBe('river_after_turn_checkback');
  });

  it('parses multiway pot-type variants (sb-vs-btn-3bp-oop-wet-t98)', () => {
    const r = _parseUpperSurfaceFilenameForTests(
      'docs/upper-surface/reasoning-artifacts/sb-vs-btn-3bp-oop-wet-t98-river_after_turn_call.md',
    );
    expect(r).not.toBeNull();
    expect(r.heroPos).toBe('SB');
    expect(r.villainPos).toBe('BTN');
    expect(r.potType).toBe('3bp');
    expect(r.ipOop).toBe('oop');
  });

  it('returns null on un-parseable filename (no -vs- segment)', () => {
    const r = _parseUpperSurfaceFilenameForTests('random-name.md');
    expect(r).toBeNull();
  });

  it('returns null on unrecognized pot-type', () => {
    const r = _parseUpperSurfaceFilenameForTests('btn-vs-bb-xyz-ip-wet-t96-flop_root.md');
    expect(r).toBeNull();
  });

  it('returns null on missing ip/oop segment', () => {
    const r = _parseUpperSurfaceFilenameForTests('btn-vs-bb-srp-wet-t96-flop_root.md');
    expect(r).toBeNull();
  });
});

describe('corpusIndex — drift guards', () => {
  it('every upper-surface entry has potType in the canonical POT_TYPES enum', () => {
    const validPotTypes = new Set([
      'srp', '3bp', '4bp', 'limped', 'srp-3way', '3bp-3way', 'srp-4way',
    ]);
    const entries = getAllCorpusEntries().filter((e) => e.source === 'upper-surface');
    for (const entry of entries) {
      expect(validPotTypes.has(entry.potType), `entry ${entry.artifactId} has invalid potType ${entry.potType}`).toBe(true);
    }
  });

  it('LSW entries are derived from LINES export (drift catches renamed lines)', () => {
    const entries = getAllCorpusEntries().filter((e) => e.source === 'lsw');
    // artifactId format is `<lineId>/<nodeId>` — both segments are required.
    for (const entry of entries) {
      expect(entry.artifactId).toMatch(/^[a-z0-9-]+\/[a-z_]+$/);
    }
  });
});
