import { describe, test, expect } from 'vitest';
import { LESSONS, findLesson } from '../lessons';
import { FRAMEWORKS } from '../frameworks';
import { archetypeRangeFor } from '../archetypeRanges';
import { parseFlopString } from '../scenarioLibrary';
import { parseBoard } from '../../pokerCore/cardParser';

describe('lessons — structural', () => {
  test('at least 5 lessons defined', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(5);
  });

  test('each lesson has required top-level fields', () => {
    for (const l of LESSONS) {
      expect(typeof l.id).toBe('string');
      expect(typeof l.title).toBe('string');
      expect(typeof l.summary).toBe('string');
      expect(typeof l.frameworkId).toBe('string');
      expect(Array.isArray(l.sections)).toBe(true);
      expect(l.sections.length).toBeGreaterThan(0);
    }
  });

  test('every lesson.frameworkId resolves to a registered framework', () => {
    const validIds = new Set(Object.values(FRAMEWORKS).map((f) => f.id));
    for (const l of LESSONS) {
      expect(validIds.has(l.frameworkId)).toBe(true);
    }
  });

  test('unique lesson ids', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every section has a valid kind', () => {
    const validKinds = new Set(['prose', 'formula', 'example']);
    for (const l of LESSONS) {
      for (const s of l.sections) {
        expect(validKinds.has(s.kind)).toBe(true);
      }
    }
  });

  test('every example resolves to a valid archetype range + parseable flop', () => {
    for (const l of LESSONS) {
      for (const s of l.sections) {
        if (s.kind !== 'example') continue;
        const range = archetypeRangeFor(s.context);
        expect(range).toBeDefined();
        expect(range.length).toBe(169);
        if (s.opposingContext) {
          const opp = archetypeRangeFor(s.opposingContext);
          expect(opp.length).toBe(169);
        }
        const board = parseBoard(parseFlopString(s.board));
        expect(board.length).toBe(3);
      }
    }
  });

  test('findLesson returns the lesson by id', () => {
    const l = findLesson(LESSONS[0].id);
    expect(l).toBe(LESSONS[0]);
    expect(findLesson('nonexistent')).toBeNull();
  });

  test('first lesson is Range Decomposition (pedagogical spine)', () => {
    expect(LESSONS[0].id).toBe('range-decomposition');
    expect(LESSONS[0].frameworkId).toBe('range_decomposition');
  });
});
