/**
 * @file Tests for src/utils/heroState/loadTemplates.js
 *
 * Verifies all 18 shipped templates load via import.meta.glob, parse their
 * frontmatter, and split the body into Headline/Body/Branch summary sections.
 */

import { describe, it, expect } from 'vitest';
import { loadTemplate, listLoadedArchetypeIds } from '../loadTemplates.js';
import { ARCHETYPE_IDS } from '../types.js';

describe('loadTemplates', () => {
  it('loads all 18 archetypes from ARCHETYPE_IDS', () => {
    const loaded = listLoadedArchetypeIds();
    expect(loaded).toHaveLength(18);
    for (const id of ARCHETYPE_IDS) {
      expect(loaded).toContain(id);
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

  it('FLOP_MULTIWAY loads with v2_TODO frontmatter', () => {
    const t = loadTemplate('FLOP_MULTIWAY');
    expect(t.meta.archetypeId).toBe('FLOP_MULTIWAY');
    expect(t.meta.v2_TODO).toBeTypeOf('string');
    expect(t.meta.v2_TODO).toContain('§7.4');
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
