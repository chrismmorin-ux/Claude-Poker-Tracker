/**
 * @file Tests for src/utils/heroState/loadTemplates.js
 *
 * Verifies all 47 shipped templates load via import.meta.glob, parse their
 * frontmatter, and split the body into Headline/Body/Branch summary sections.
 *
 * v3 catalog (WS-154, 2026-06-04): 8 preflop + 13 flop + 12 turn + 14 river.
 *   Flop grew by 3 (FLOP_MULTIWAY potType split: +_SRP +_3BP +_LIMPED).
 */

import { describe, it, expect } from 'vitest';
import { loadTemplate, listLoadedArchetypeIds } from '../loadTemplates.js';
import { ARCHETYPE_IDS } from '../types.js';

describe('loadTemplates', () => {
  it('loads all 47 archetypes from ARCHETYPE_IDS', () => {
    const loaded = listLoadedArchetypeIds();
    expect(loaded).toHaveLength(47);
    for (const id of ARCHETYPE_IDS) {
      expect(loaded, `template missing for ${id}`).toContain(id);
    }
  });

  it('loadTemplate(archetypeId) returns {meta, sections, path}', () => {
    const t = loadTemplate('PF_OPEN_RFI');
    expect(t).toBeDefined();
    expect(t.meta).toBeDefined();
    expect(t.sections).toBeDefined();
    expect(t.path).toMatch(/PF_OPEN_RFI\.md$/);
  });

  it('frontmatter has required fields per CONVENTIONS.md', () => {
    const t = loadTemplate('PF_OPEN_RFI');
    expect(t.meta.archetypeId).toBe('PF_OPEN_RFI');
    expect(t.meta.family).toBe('PREFLOP_OPEN');
    expect(t.meta.voiceNotes).toBeTypeOf('string');
    expect(Array.isArray(t.meta.slotsUsed)).toBe(true);
    expect(t.meta.slotsUsed.length).toBeGreaterThan(0);
  });

  it('parses sections: headline + body + branchSummary', () => {
    const t = loadTemplate('PF_OPEN_RFI');
    expect(t.sections.headline).toBeTruthy();
    expect(t.sections.body).toBeTruthy();
    expect(t.sections.branchSummary).toBeTruthy();
    expect(t.sections.headline).toContain('{{handContext.hand}}');
    expect(t.sections.headline).toContain('standard open');
  });

  it('FLOP_MULTIWAY catch-all loads with v3_TODO frontmatter', () => {
    // Post-WS-154: v2_TODO was promoted to v3_TODO (turn/river splits +
    // pairwise narrowing primitive remain as deferred future work).
    const t = loadTemplate('FLOP_MULTIWAY');
    expect(t.meta.archetypeId).toBe('FLOP_MULTIWAY');
    expect(t.meta.v3_TODO).toBeTypeOf('string');
  });

  it('multiway potType-split sub-archetypes all map to FLOP_MULTIWAY family', () => {
    for (const id of ['FLOP_MULTIWAY_SRP', 'FLOP_MULTIWAY_3BP', 'FLOP_MULTIWAY_LIMPED']) {
      const t = loadTemplate(id);
      expect(t.meta.archetypeId, `${id} archetypeId mismatch`).toBe(id);
      expect(t.meta.family, `${id} family mismatch`).toBe('FLOP_MULTIWAY');
      expect(Array.isArray(t.meta.slotsUsed), `${id} slotsUsed not array`).toBe(true);
      // multiwayHeroRole slot should appear in the slotsUsed list for the
      // three sub-archetypes (the descriptor that distinguishes hero role).
      expect(t.meta.slotsUsed, `${id} missing multiwayHeroRole slot`)
        .toContain('situation.multiwayHeroRole');
    }
  });

  it('all templates have non-empty Headline + Body + Branch summary', () => {
    for (const id of ARCHETYPE_IDS) {
      const t = loadTemplate(id);
      expect(t.sections.headline, `${id} missing headline`).toBeTruthy();
      expect(t.sections.body, `${id} missing body`).toBeTruthy();
      expect(t.sections.branchSummary, `${id} missing branchSummary`).toBeTruthy();
    }
  });

  it('throws Error when archetypeId is unknown', () => {
    expect(() => loadTemplate('NONEXISTENT_ARCHETYPE')).toThrow(/no template/);
  });

  it('every template uses Mustache-style {{path}} slots somewhere in body or headline', () => {
    for (const id of ARCHETYPE_IDS) {
      const t = loadTemplate(id);
      const combined = t.sections.headline + t.sections.body + t.sections.branchSummary;
      expect(combined, `${id} has no {{...}} slots`).toMatch(/\{\{[^}]+\}\}/);
    }
  });
});
