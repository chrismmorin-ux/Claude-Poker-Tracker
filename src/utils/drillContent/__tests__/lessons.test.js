import { describe, test, expect } from 'vitest';
import { LESSONS, findLesson } from '../lessons';
import { FRAMEWORKS } from '../frameworks';
import { parseHandClass } from '../../pokerCore/preflopEquity';
import { isKnownCalculator } from '../calculatorRegistry';

const frameworkIds = new Set(Object.values(FRAMEWORKS).map((fw) => fw.id));
const VALID_KINDS = ['prose', 'formula', 'example', 'compute'];

describe('lessons — structural integrity', () => {
  test('LESSONS is a non-empty array', () => {
    expect(Array.isArray(LESSONS)).toBe(true);
    expect(LESSONS.length).toBeGreaterThan(0);
  });

  test('every lesson has id, title, frameworkId, summary, sections', () => {
    for (const l of LESSONS) {
      expect(typeof l.id).toBe('string');
      expect(l.id.length).toBeGreaterThan(0);
      expect(typeof l.title).toBe('string');
      expect(typeof l.frameworkId).toBe('string');
      expect(typeof l.summary).toBe('string');
      expect(Array.isArray(l.sections)).toBe(true);
      expect(l.sections.length).toBeGreaterThan(0);
    }
  });

  test('no duplicate lesson ids', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every frameworkId resolves to a real framework', () => {
    for (const l of LESSONS) {
      expect(frameworkIds.has(l.frameworkId)).toBe(true);
    }
  });
});

describe('lessons — section validity', () => {
  test('every section kind is a valid kind', () => {
    for (const l of LESSONS) {
      for (const s of l.sections) {
        expect(VALID_KINDS).toContain(s.kind);
      }
    }
  });

  test('compute sections reference a calculator that resolves in the registry', () => {
    for (const l of LESSONS) {
      for (const s of l.sections) {
        if (s.kind === 'compute') {
          expect(typeof s.calculator).toBe('string');
          expect(isKnownCalculator(s.calculator)).toBe(true);
        }
      }
    }
  });

  test('prose sections have non-empty body', () => {
    for (const l of LESSONS) {
      for (const s of l.sections) {
        if (s.kind === 'prose') {
          expect(typeof s.body).toBe('string');
          expect(s.body.length).toBeGreaterThan(10);
        }
      }
    }
  });

  test('formula sections have body', () => {
    for (const l of LESSONS) {
      for (const s of l.sections) {
        if (s.kind === 'formula') {
          expect(typeof s.body).toBe('string');
          expect(s.body.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('example sections have parseable hand labels and takeaway text', () => {
    for (const l of LESSONS) {
      for (const s of l.sections) {
        if (s.kind === 'example') {
          expect(() => parseHandClass(s.a)).not.toThrow();
          expect(() => parseHandClass(s.b)).not.toThrow();
          expect(typeof s.takeaway).toBe('string');
          expect(s.takeaway.length).toBeGreaterThan(10);
        }
      }
    }
  });

  test('every lesson has at least one worked example', () => {
    for (const l of LESSONS) {
      const exampleCount = l.sections.filter((s) => s.kind === 'example').length;
      expect(exampleCount).toBeGreaterThan(0);
    }
  });
});

describe('lessons — findLesson', () => {
  test('returns lesson by id', () => {
    const first = LESSONS[0];
    expect(findLesson(first.id)).toBe(first);
  });

  test('returns null for unknown id', () => {
    expect(findLesson('nonexistent')).toBeNull();
  });
});

describe('lessons — key coverage', () => {
  test('Straight Coverage lesson includes the AK vs AQ worked example', () => {
    const lesson = findLesson('straight-coverage');
    expect(lesson).not.toBeNull();
    const hasAkVsAq = lesson.sections.some(
      (s) => s.kind === 'example' && s.a === 'AKo' && s.b === 'AQo',
    );
    expect(hasAkVsAq).toBe(true);
  });
});
