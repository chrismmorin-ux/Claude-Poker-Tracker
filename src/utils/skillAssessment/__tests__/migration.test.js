/**
 * @file Migration cross-reference tests — verify the WS-148 / SPR-033
 * concept-kind architecture is consistent across:
 *   - tierConceptMap registry
 *   - lessonRegistry loaded lessons
 *   - leakRules registered rules
 *
 * Catches drift like "added a sub-concept to the registry but forgot to
 * register a lesson" or "renamed a rule's relatedConceptId without
 * updating the registry."
 */

import { describe, it, expect } from 'vitest';
import {
  CONCEPT_REGISTRY,
  getAllUmbrellaIds,
  SITUATION_KEY_TO_CONCEPT,
} from '../tierConceptMap.js';
import { getLesson, listLoadedLessons } from '../lessonRegistry.js';
import { listRegisteredRules, getRuleById } from '../heroLeakDetector.js';

describe('migration — leak rule → umbrella concept binding', () => {
  it('every shipped leak rule binds to a registered umbrella concept', () => {
    const ruleIds = listRegisteredRules();
    expect(ruleIds.length).toBeGreaterThan(0);
    const umbrellas = new Set(getAllUmbrellaIds());
    const violations = [];
    for (const id of ruleIds) {
      const rule = getRuleById(id);
      const conceptId = rule?.relatedConceptId;
      if (!conceptId) continue;
      const meta = CONCEPT_REGISTRY[conceptId];
      if (!meta) {
        violations.push(`rule ${id} → relatedConceptId ${conceptId} (not in tierConceptMap)`);
      } else if (!umbrellas.has(conceptId)) {
        violations.push(`rule ${id} → relatedConceptId ${conceptId} (not an umbrella; kind=${meta.kind})`);
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('every umbrella concept has a loaded lesson', () => {
    const umbrellas = getAllUmbrellaIds();
    const missing = [];
    for (const conceptId of umbrellas) {
      const lesson = getLesson(conceptId);
      if (!lesson) missing.push(`umbrella ${conceptId} has no loaded lesson`);
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });
});

describe('migration — situation-key resolution', () => {
  it('every SITUATION_KEY_TO_CONCEPT value is a registered specific concept whose parent is an umbrella', () => {
    for (const [key, conceptId] of Object.entries(SITUATION_KEY_TO_CONCEPT)) {
      const meta = CONCEPT_REGISTRY[conceptId];
      expect(meta, `key ${key} → ${conceptId} not registered`).toBeDefined();
      expect(meta.kind, `key ${key} → ${conceptId} kind`).toBe('rule-anchored-specific');
      expect(meta.parent, `key ${key} → ${conceptId} parent`).toBeTruthy();
      const parentMeta = CONCEPT_REGISTRY[meta.parent];
      expect(parentMeta?.kind, `parent ${meta.parent} kind`).toBe('rule-anchored-umbrella');
    }
  });
});

describe('migration — sub-concepts may not have lesson files yet (WS-149)', () => {
  it('sub-concepts without lessons are documented expected state, not failures', () => {
    // Per WS-148 plan: sub-concept lessons are deferred to WS-149 ongoing
    // authoring. Registering the IDs in tierConceptMap establishes the
    // granularity floor; lessons follow.
    const loaded = new Set(listLoadedLessons());
    const subConcepts = Object.entries(CONCEPT_REGISTRY)
      .filter(([, m]) => m.kind === 'rule-anchored-specific')
      .map(([id]) => id);
    expect(subConcepts.length).toBeGreaterThan(0);
    // It's OK for sub-concepts to lack lessons at this point. We just
    // assert that any sub-concept lesson that DOES exist has consistent
    // frontmatter.
    for (const conceptId of subConcepts) {
      if (!loaded.has(conceptId)) continue; // expected: no lesson yet
      const lesson = getLesson(conceptId);
      expect(lesson.meta.conceptId).toBe(conceptId);
    }
  });
});

describe('migration — lesson frontmatter cross-references registry', () => {
  it('every loaded lesson is registered in tierConceptMap', () => {
    const loaded = listLoadedLessons();
    const violations = [];
    for (const conceptId of loaded) {
      if (!CONCEPT_REGISTRY[conceptId]) {
        violations.push(`lesson ${conceptId} not in tierConceptMap`);
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('every loaded lesson tier matches tierConceptMap tier', () => {
    const loaded = listLoadedLessons();
    const violations = [];
    for (const conceptId of loaded) {
      const lesson = getLesson(conceptId);
      const registryTier = CONCEPT_REGISTRY[conceptId]?.tier;
      const lessonTier = Number(lesson?.meta?.tier);
      if (registryTier !== lessonTier) {
        violations.push(`lesson ${conceptId} tier=${lessonTier} but registry tier=${registryTier}`);
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });
});
