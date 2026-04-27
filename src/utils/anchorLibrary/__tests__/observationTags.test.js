/**
 * observationTags.test.js — Tag normalizer unit tests
 *
 * Covers:
 *   - normalizeTag (whitespace, casing, kebab conversion, length limits, edge cases)
 *   - normalizeTagSet (dedupe, partial-success reporting, non-array input)
 *   - isFixedEnumTag / isCustomTag (classification)
 *   - classifyTags (split into fixed + custom)
 *   - hasAtLeastOneFixedTag (schema-delta §3.1.1 requirement)
 */

import { describe, it, expect } from 'vitest';

import {
  normalizeTag,
  normalizeTagSet,
  isFixedEnumTag,
  isCustomTag,
  classifyTags,
  hasAtLeastOneFixedTag,
  OBSERVATION_TAG_ENUM,
} from '../observationTags';

// ───────────────────────────────────────────────────────────────────────────
// normalizeTag
// ───────────────────────────────────────────────────────────────────────────

describe('normalizeTag', () => {
  it('passes through already-normalized fixed-enum tags', () => {
    const result = normalizeTag('villain-overfold');
    expect(result.ok).toBe(true);
    expect(result.tag).toBe('villain-overfold');
  });

  it('lowercases uppercase input', () => {
    expect(normalizeTag('VILLAIN-OVERFOLD').tag).toBe('villain-overfold');
    expect(normalizeTag('Villain-Overfold').tag).toBe('villain-overfold');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeTag('  villain-overfold  ').tag).toBe('villain-overfold');
    expect(normalizeTag('\tvillain-overfold\n').tag).toBe('villain-overfold');
  });

  it('converts spaces to hyphens', () => {
    expect(normalizeTag('villain overfold').tag).toBe('villain-overfold');
    expect(normalizeTag('big sizing tell').tag).toBe('big-sizing-tell');
  });

  it('converts underscores to hyphens', () => {
    expect(normalizeTag('villain_overfold').tag).toBe('villain-overfold');
  });

  it('collapses runs of non-alphanumeric to a single hyphen', () => {
    expect(normalizeTag('villain   overfold').tag).toBe('villain-overfold');
    expect(normalizeTag('villain__overfold').tag).toBe('villain-overfold');
    expect(normalizeTag('villain - overfold').tag).toBe('villain-overfold');
    expect(normalizeTag('villain!!!overfold').tag).toBe('villain-overfold');
  });

  it('strips leading and trailing hyphens after normalization', () => {
    expect(normalizeTag('-villain-overfold-').tag).toBe('villain-overfold');
    expect(normalizeTag('---villain---').tag).toBe('villain');
    expect(normalizeTag('!!!villain!!!').tag).toBe('villain');
  });

  it('preserves alphanumeric content (digits stay)', () => {
    expect(normalizeTag('3bet-light').tag).toBe('3bet-light');
    expect(normalizeTag('AKo-blocker-tell').tag).toBe('ako-blocker-tell');
  });

  it('removes diacritics? — no, only ASCII alphanumeric is preserved', () => {
    // Diacritics are non-[a-z0-9] → become hyphens. Acceptable behavior;
    // documents the v1 limitation.
    expect(normalizeTag('café-tell').tag).toBe('caf-tell');
  });

  it('rejects non-string input', () => {
    expect(normalizeTag(null).ok).toBe(false);
    expect(normalizeTag(undefined).ok).toBe(false);
    expect(normalizeTag(42).ok).toBe(false);
    expect(normalizeTag([]).ok).toBe(false);
    expect(normalizeTag({}).ok).toBe(false);
  });

  it('rejects empty / whitespace-only / punctuation-only input', () => {
    expect(normalizeTag('').ok).toBe(false);
    expect(normalizeTag('   ').ok).toBe(false);
    expect(normalizeTag('---').ok).toBe(false);
    expect(normalizeTag('!!!').ok).toBe(false);
  });

  it('rejects tags exceeding 60 chars', () => {
    const tooLong = 'x'.repeat(61);
    const result = normalizeTag(tooLong);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/60-char limit/);
  });

  it('accepts tag at exactly 60 chars', () => {
    const exactly60 = 'x'.repeat(60);
    expect(normalizeTag(exactly60).ok).toBe(true);
    expect(normalizeTag(exactly60).tag).toBe(exactly60);
  });

  it('returns descriptive reason on rejection', () => {
    expect(normalizeTag(42).reason).toMatch(/must be a string/);
    expect(normalizeTag('').reason).toMatch(/empty/);
    expect(normalizeTag('!!!').reason).toMatch(/no alphanumeric/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// normalizeTagSet
// ───────────────────────────────────────────────────────────────────────────

describe('normalizeTagSet', () => {
  it('normalizes an array of valid tags', () => {
    const result = normalizeTagSet(['villain-overfold', 'unusual sizing', 'BIG TELL']);
    expect(result.normalized).toEqual(['villain-overfold', 'unusual-sizing', 'big-tell']);
    expect(result.rejected).toEqual([]);
  });

  it('deduplicates after normalization', () => {
    const result = normalizeTagSet(['villain-overfold', 'Villain-Overfold', 'villain  overfold']);
    expect(result.normalized).toEqual(['villain-overfold']);
    expect(result.rejected).toEqual([]);
  });

  it('preserves input order in deduped result', () => {
    const result = normalizeTagSet(['unusual-sizing', 'villain-overfold', 'unusual-sizing']);
    expect(result.normalized).toEqual(['unusual-sizing', 'villain-overfold']);
  });

  it('reports rejected entries with reasons', () => {
    const result = normalizeTagSet(['villain-overfold', '', 42, '!!!']);
    expect(result.normalized).toEqual(['villain-overfold']);
    expect(result.rejected).toHaveLength(3);
    expect(result.rejected[0].reason).toMatch(/empty/);
    expect(result.rejected[1].reason).toMatch(/must be a string/);
    expect(result.rejected[2].reason).toMatch(/alphanumeric/);
  });

  it('handles non-array input gracefully', () => {
    const result = normalizeTagSet(null);
    expect(result.normalized).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toMatch(/not an array/);
  });

  it('handles empty array', () => {
    expect(normalizeTagSet([])).toEqual({ normalized: [], rejected: [] });
  });

  it('mixed valid + invalid maintains valid output', () => {
    const result = normalizeTagSet([
      'villain-overfold',
      '   ',
      'Custom Tag',
      null,
      'ANOTHER TAG',
    ]);
    expect(result.normalized).toEqual(['villain-overfold', 'custom-tag', 'another-tag']);
    expect(result.rejected).toHaveLength(2); // empty + null
  });
});

// ───────────────────────────────────────────────────────────────────────────
// isFixedEnumTag / isCustomTag
// ───────────────────────────────────────────────────────────────────────────

describe('isFixedEnumTag', () => {
  it('recognizes all 8 fixed enum tags', () => {
    for (const tag of OBSERVATION_TAG_ENUM) {
      expect(isFixedEnumTag(tag)).toBe(true);
    }
  });

  it('rejects custom tags', () => {
    expect(isFixedEnumTag('big-sizing-tell')).toBe(false);
    expect(isFixedEnumTag('snap-call-pattern')).toBe(false);
  });

  it('rejects non-strings + empty', () => {
    expect(isFixedEnumTag('')).toBe(false);
    expect(isFixedEnumTag(null)).toBe(false);
    expect(isFixedEnumTag(undefined)).toBe(false);
    expect(isFixedEnumTag(42)).toBe(false);
  });

  it('case-sensitive — un-normalized fails (caller must normalize first)', () => {
    expect(isFixedEnumTag('VILLAIN-OVERFOLD')).toBe(false);
  });
});

describe('isCustomTag', () => {
  it('recognizes a non-enum normalized tag', () => {
    expect(isCustomTag('big-sizing-tell')).toBe(true);
    expect(isCustomTag('snap-call-pattern')).toBe(true);
  });

  it('rejects fixed-enum tags', () => {
    expect(isCustomTag('villain-overfold')).toBe(false);
  });

  it('rejects empty / non-string', () => {
    expect(isCustomTag('')).toBe(false);
    expect(isCustomTag(null)).toBe(false);
    expect(isCustomTag(42)).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// classifyTags
// ───────────────────────────────────────────────────────────────────────────

describe('classifyTags', () => {
  it('splits a mixed tag list into fixed + custom', () => {
    const result = classifyTags([
      'villain-overfold',
      'big-sizing-tell',
      'unusual-sizing',
      'snap-call-pattern',
    ]);
    expect(result.fixed).toEqual(['villain-overfold', 'unusual-sizing']);
    expect(result.custom).toEqual(['big-sizing-tell', 'snap-call-pattern']);
  });

  it('handles all-fixed list', () => {
    const result = classifyTags(['villain-overfold', 'unusual-sizing']);
    expect(result.fixed).toHaveLength(2);
    expect(result.custom).toEqual([]);
  });

  it('handles all-custom list', () => {
    const result = classifyTags(['big-tell', 'snap-call']);
    expect(result.fixed).toEqual([]);
    expect(result.custom).toHaveLength(2);
  });

  it('handles empty list', () => {
    expect(classifyTags([])).toEqual({ fixed: [], custom: [] });
  });

  it('handles non-array input', () => {
    expect(classifyTags(null)).toEqual({ fixed: [], custom: [] });
    expect(classifyTags(undefined)).toEqual({ fixed: [], custom: [] });
  });

  it('drops non-string + empty entries silently', () => {
    const result = classifyTags(['villain-overfold', null, '', 42, 'big-tell']);
    expect(result.fixed).toEqual(['villain-overfold']);
    expect(result.custom).toEqual(['big-tell']);
  });

  it('preserves order within each classification', () => {
    const result = classifyTags(['big-tell', 'villain-overfold', 'snap-call']);
    expect(result.custom).toEqual(['big-tell', 'snap-call']);
    expect(result.fixed).toEqual(['villain-overfold']);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// hasAtLeastOneFixedTag (schema-delta §3.1.1 requirement)
// ───────────────────────────────────────────────────────────────────────────

describe('hasAtLeastOneFixedTag', () => {
  it('returns true when list contains a fixed enum tag', () => {
    expect(hasAtLeastOneFixedTag(['villain-overfold'])).toBe(true);
    expect(hasAtLeastOneFixedTag(['big-tell', 'villain-overfold'])).toBe(true);
  });

  it('returns false when list has only custom tags', () => {
    expect(hasAtLeastOneFixedTag(['big-tell', 'snap-call'])).toBe(false);
  });

  it('returns false for empty list', () => {
    expect(hasAtLeastOneFixedTag([])).toBe(false);
  });

  it('returns false for non-array input', () => {
    expect(hasAtLeastOneFixedTag(null)).toBe(false);
    expect(hasAtLeastOneFixedTag(undefined)).toBe(false);
  });

  it('all 8 fixed tags individually pass the requirement', () => {
    for (const tag of OBSERVATION_TAG_ENUM) {
      expect(hasAtLeastOneFixedTag([tag])).toBe(true);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// OBSERVATION_TAG_ENUM stability
// ───────────────────────────────────────────────────────────────────────────

describe('OBSERVATION_TAG_ENUM', () => {
  it('contains exactly 8 fixed seeds (schema-delta §3.1.1)', () => {
    expect(OBSERVATION_TAG_ENUM).toHaveLength(8);
  });

  it('contains the canonical 8 entries in canonical order', () => {
    expect(OBSERVATION_TAG_ENUM).toEqual([
      'villain-overfold',
      'villain-overbluff',
      'villain-overcall',
      'hero-overfolded',
      'unusual-sizing',
      'perception-gap',
      'style-mismatch',
      'session-context',
    ]);
  });

  it('is immutable (frozen)', () => {
    expect(Object.isFrozen(OBSERVATION_TAG_ENUM)).toBe(true);
  });

  it('every entry is already normalized (idempotent under normalizeTag)', () => {
    for (const tag of OBSERVATION_TAG_ENUM) {
      const result = normalizeTag(tag);
      expect(result.ok).toBe(true);
      expect(result.tag).toBe(tag);
    }
  });
});
