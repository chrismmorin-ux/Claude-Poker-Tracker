/**
 * manifestSchema.test.js — per-manifest shape validation for Printable Refresher.
 *
 * Runs first in the PRF CI gate stack (content-drift CI depends on schema-valid
 * manifests). Validates every manifest in `manifests/` against the v1 shape
 * defined in `docs/projects/printable-refresher/content-drift-ci.md` §Manifest shape.
 *
 * Scope: structural validation only — required fields, type checks, enum values,
 * monotonic invariants (schemaVersion >= 1), filename ↔ cardId pattern.
 *
 * Out of scope (covered by future CI checks):
 *   - Check 1: contentHash recomputation (PRF-G5-CI Session 2)
 *   - Checks 2–3: source-util whitelist + CD forbidden-string grep (Session 3)
 *   - Checks 4–5: schemaVersion bump discipline + md-vs-generated (Session 4)
 *   - Check 6: lineage-footer rendering (Session 2)
 */

import { describe, test, expect } from 'vitest';
import {
  manifestEntries,
  manifests,
  CARD_CLASS_VALUES,
  PHASE_VALUES,
  TIER_VALUES,
  ATOMICITY_WORD_COUNT_MAX,
  FIDELITY_KEYS,
} from '../cardRegistry.js';

const ISO8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const CARD_ID_RE = /^PRF-[A-Z0-9-]+$/;
const CONTENT_HASH_RE = /^sha256:[A-Za-z0-9-]+$/;

function countWords(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

describe('printableRefresher manifestSchema — registry sanity', () => {
  test('registry loads at least one manifest', () => {
    expect(manifestEntries.length).toBeGreaterThan(0);
    expect(manifests.length).toBe(manifestEntries.length);
  });

  test('cardIds are globally unique', () => {
    const ids = manifests.map((m) => m.cardId);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  test('manifests are sorted by cardId for deterministic iteration', () => {
    const sorted = [...manifests].sort((a, b) => a.cardId.localeCompare(b.cardId));
    expect(manifests.map((m) => m.cardId)).toEqual(sorted.map((m) => m.cardId));
  });
});

describe.each(manifestEntries.map((e) => [e.manifest.cardId, e]))(
  'printableRefresher manifestSchema — %s',
  (cardId, entry) => {
    const m = entry.manifest;

    test('cardId is non-empty PRF-prefixed kebab-case (uppercase + digits + hyphens)', () => {
      expect(typeof m.cardId).toBe('string');
      expect(m.cardId.length).toBeGreaterThan(0);
      expect(m.cardId).toMatch(CARD_ID_RE);
    });

    test('filename matches lowercase(cardId) + .json', () => {
      const expectedSlug = m.cardId.toLowerCase();
      expect(entry.slug).toBe(expectedSlug);
      expect(entry.filename).toBe(`${expectedSlug}.json`);
    });

    test('schemaVersion is integer >= 1', () => {
      expect(Number.isInteger(m.schemaVersion)).toBe(true);
      expect(m.schemaVersion).toBeGreaterThanOrEqual(1);
    });

    test('class is one of the four canonical values', () => {
      expect(CARD_CLASS_VALUES).toContain(m.class);
    });

    test('title is non-empty string', () => {
      expect(typeof m.title).toBe('string');
      expect(m.title.trim().length).toBeGreaterThan(0);
    });

    test('bodyMarkdown is non-empty string', () => {
      expect(typeof m.bodyMarkdown).toBe('string');
      expect(m.bodyMarkdown.trim().length).toBeGreaterThan(0);
    });

    test('generatedFields is a plain object', () => {
      expect(m.generatedFields).not.toBeNull();
      expect(typeof m.generatedFields).toBe('object');
      expect(Array.isArray(m.generatedFields)).toBe(false);
    });

    test('sourceUtils is an array of well-formed entries', () => {
      expect(Array.isArray(m.sourceUtils)).toBe(true);
      m.sourceUtils.forEach((su, i) => {
        expect(typeof su.path, `sourceUtils[${i}].path`).toBe('string');
        expect(su.path.length).toBeGreaterThan(0);
        expect(typeof su.hash, `sourceUtils[${i}].hash`).toBe('string');
        expect(su.hash).toMatch(CONTENT_HASH_RE);
        expect(typeof su.fn, `sourceUtils[${i}].fn`).toBe('string');
        expect(su.fn.length).toBeGreaterThan(0);
      });
    });

    test('theoryCitation is non-empty string', () => {
      expect(typeof m.theoryCitation).toBe('string');
      expect(m.theoryCitation.trim().length).toBeGreaterThan(0);
    });

    test('assumptions has stakes (string), rake (object|null), effectiveStack (number), field (string)', () => {
      expect(m.assumptions).not.toBeNull();
      expect(typeof m.assumptions).toBe('object');
      expect(typeof m.assumptions.stakes).toBe('string');
      expect(m.assumptions.stakes.length).toBeGreaterThan(0);

      // rake: null OR { pct, cap, noFlopNoDrop }
      if (m.assumptions.rake !== null) {
        expect(typeof m.assumptions.rake).toBe('object');
        expect(typeof m.assumptions.rake.pct).toBe('number');
        expect(typeof m.assumptions.rake.cap).toBe('number');
        expect(typeof m.assumptions.rake.noFlopNoDrop).toBe('boolean');
      }

      expect(typeof m.assumptions.effectiveStack).toBe('number');
      expect(m.assumptions.effectiveStack).toBeGreaterThan(0);

      expect(typeof m.assumptions.field).toBe('string');
      expect(m.assumptions.field.length).toBeGreaterThan(0);
    });

    test('bucketDefinitionsCited is null or non-empty string', () => {
      if (m.bucketDefinitionsCited !== null) {
        expect(typeof m.bucketDefinitionsCited).toBe('string');
        expect(m.bucketDefinitionsCited.length).toBeGreaterThan(0);
      }
    });

    test('atomicityJustification is non-empty string', () => {
      expect(typeof m.atomicityJustification).toBe('string');
      expect(m.atomicityJustification.trim().length).toBeGreaterThan(0);
    });

    test('atomicityJustificationWordCount matches computed count and respects H-PM05 ceiling', () => {
      const computed = countWords(m.atomicityJustification);
      expect(m.atomicityJustificationWordCount).toBe(computed);
      expect(computed).toBeLessThanOrEqual(ATOMICITY_WORD_COUNT_MAX);
    });

    test('phase is one of A | B | C', () => {
      expect(PHASE_VALUES).toContain(m.phase);
    });

    test('tier is one of free | plus', () => {
      expect(TIER_VALUES).toContain(m.tier);
    });

    test('cd5_exempt is boolean; justification mirrors flag', () => {
      expect(typeof m.cd5_exempt).toBe('boolean');
      if (m.cd5_exempt) {
        expect(typeof m.cd5_exempt_justification).toBe('string');
        expect(m.cd5_exempt_justification.trim().length).toBeGreaterThan(0);
      } else {
        expect(m.cd5_exempt_justification).toBeNull();
      }
    });

    test('proseOnlyEdit is boolean (default false)', () => {
      expect(typeof m.proseOnlyEdit).toBe('boolean');
    });

    test('fidelityChecklist contains all six F-keys, every value is boolean true at MVP', () => {
      expect(m.fidelityChecklist).not.toBeNull();
      expect(typeof m.fidelityChecklist).toBe('object');
      FIDELITY_KEYS.forEach((key) => {
        expect(m.fidelityChecklist).toHaveProperty(key);
        expect(m.fidelityChecklist[key], `${key} must be true at MVP per F1-F6`).toBe(true);
      });
      // Reject extra keys to keep the checklist tight
      expect(Object.keys(m.fidelityChecklist).sort()).toEqual([...FIDELITY_KEYS].sort());
    });

    test('contentHash is sha256-prefixed string', () => {
      expect(typeof m.contentHash).toBe('string');
      expect(m.contentHash).toMatch(CONTENT_HASH_RE);
    });

    test('lastVersionedAt is ISO8601 string', () => {
      expect(typeof m.lastVersionedAt).toBe('string');
      expect(m.lastVersionedAt).toMatch(ISO8601_RE);
      // sanity: parses to a valid date
      expect(Number.isNaN(Date.parse(m.lastVersionedAt))).toBe(false);
    });
  }
);
