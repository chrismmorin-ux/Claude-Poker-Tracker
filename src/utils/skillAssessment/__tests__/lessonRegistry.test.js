/**
 * @file Tests for lessonRegistry.js — SCF lesson loading + lookup.
 */

import { describe, it, expect } from 'vitest';
import {
  getLesson,
  listLoadedLessons,
  listLessonsForCurriculum,
} from '../lessonRegistry.js';
import { listRegisteredRules, getRuleById } from '../heroLeakDetector.js';

describe('lessonRegistry', () => {
  it('loads the 2 cluster reference lessons', () => {
    const ids = listLoadedLessons();
    expect(ids).toContain('cbet-defense-cluster');
    expect(ids).toContain('bb-defense-cluster');
  });

  it('getLesson(conceptId) returns {meta, sections, path}', () => {
    const lesson = getLesson('cbet-defense-cluster');
    expect(lesson).toBeDefined();
    expect(lesson.meta).toBeDefined();
    expect(lesson.sections).toBeDefined();
    expect(lesson.path).toMatch(/cbet-defense-cluster\.md$/);
  });

  it('frontmatter has required fields per lesson-authoring-template.md', () => {
    const lesson = getLesson('cbet-defense-cluster');
    expect(lesson.meta.conceptId).toBe('cbet-defense-cluster');
    expect(lesson.meta.title).toBeTypeOf('string');
    expect(lesson.meta.tier).toBeTypeOf('string'); // YAML parser returns string; renderer can coerce
    expect(Array.isArray(lesson.meta.leakTagIds)).toBe(true);
    expect(lesson.meta.leakTagIds).toContain('hero-ip-cbet-overfold');
  });

  it('parses sections: exposition + workedExample + successCriteria', () => {
    const lesson = getLesson('bb-defense-cluster');
    expect(lesson.sections.exposition).toBeTruthy();
    expect(lesson.sections.workedExample).toBeTruthy();
    expect(lesson.sections.successCriteria).toBeTruthy();
    expect(lesson.sections.exposition).toMatch(/BB defense/i);
  });

  it('returns null for unknown conceptId', () => {
    expect(getLesson('nonexistent-concept')).toBeNull();
  });

  it('listLoadedLessons returns sorted', () => {
    const ids = listLoadedLessons();
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('listLessonsForCurriculum sorts by tier then conceptId', () => {
    const lessons = listLessonsForCurriculum();
    expect(lessons.length).toBeGreaterThan(0);
    for (let i = 1; i < lessons.length; i += 1) {
      const prev = lessons[i - 1];
      const cur = lessons[i];
      const prevTier = Number(prev.meta.tier ?? 99);
      const curTier = Number(cur.meta.tier ?? 99);
      expect(curTier).toBeGreaterThanOrEqual(prevTier);
    }
  });

  // ─── Cross-reference: every shipped leak rule's relatedConceptId resolves ────
  it('every shipped leak rule has a matching loaded lesson', () => {
    const ruleIds = listRegisteredRules();
    expect(ruleIds.length).toBeGreaterThan(0);
    const missing = [];
    for (const id of ruleIds) {
      const rule = getRuleById(id);
      const conceptId = rule?.relatedConceptId;
      if (!conceptId) continue; // rule explicitly has no concept
      const lesson = getLesson(conceptId);
      if (!lesson) {
        missing.push(`rule ${id} → relatedConceptId ${conceptId} (no lesson found)`);
      }
    }
    expect(missing, missing.join('\n')).toEqual([]);
  });
});
