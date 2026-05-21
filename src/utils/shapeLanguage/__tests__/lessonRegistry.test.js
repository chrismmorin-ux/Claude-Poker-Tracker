/**
 * lessonRegistry.test.js — Drift detection + structure tests for the
 * SLS lesson loader.
 *
 * SLS Stream B1 — WS-041 / SPR-082.
 */

import { describe, it, expect } from 'vitest';
import { getShapeLesson, getAllShapeLessons } from '../lessonRegistry';
import { classifySilhouette } from '../shapeDescriptors/silhouetteClassifier';
import { SHAPE_DESCRIPTOR_CATALOG } from '../../../constants/shapeMasteryConstants';
import { parseRangeString } from '../../pokerCore/rangeMatrix';

describe('lessonRegistry — basic loading', () => {
  it('loads at least one lesson', () => {
    const all = getAllShapeLessons();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it('every loaded lesson key matches a SHAPE_DESCRIPTOR_CATALOG id', () => {
    const all = getAllShapeLessons();
    const catalogIds = new Set(SHAPE_DESCRIPTOR_CATALOG.map((d) => d.id));
    for (const descriptorId of all) {
      expect(catalogIds.has(descriptorId)).toBe(true);
    }
  });

  it('returns null for an unknown descriptorId', () => {
    expect(getShapeLesson('nonexistent-descriptor')).toBe(null);
  });
});

describe('lessonRegistry — Silhouette lesson', () => {
  const lesson = getShapeLesson('silhouette');

  it('exists', () => {
    expect(lesson).not.toBe(null);
  });

  it('has the expected frontmatter fields', () => {
    expect(lesson.meta.descriptorId).toBe('silhouette');
    expect(lesson.meta.title).toBeTruthy();
    expect(lesson.meta.catalogPosition).toBeTruthy();
    expect(lesson.meta.priorityTier).toBeTruthy();
  });

  it('has all four sections present and non-empty', () => {
    expect(lesson.sections.exposition.length).toBeGreaterThan(50);
    expect(lesson.sections.workedExample.length).toBeGreaterThan(50);
    expect(lesson.sections.successCriteria.length).toBeGreaterThan(50);
    expect(lesson.sections.drillSpots.length).toBeGreaterThan(50);
  });

  it('parses 6+ drill spots from the Drill spots section', () => {
    expect(lesson.drillSpots.length).toBeGreaterThanOrEqual(6);
  });

  it('every parsed drill spot has correctLabel + reasoning + raw block', () => {
    for (const spot of lesson.drillSpots) {
      // `range` MAY be a special token like "uniform-50pct" that isn't
      // poker-notation parseable; the agreement test below handles that.
      expect(spot.range).toBeTruthy();
      expect(spot.correctLabel).toBeTruthy();
      expect(spot.reasoning).toBeTruthy();
      expect(spot.raw).toBeTruthy();
      expect(['oval', 'barbell', 'triangle', 'comb', 'cloud']).toContain(spot.correctLabel);
    }
  });

  it('drill spots collectively cover all 5 prototypes', () => {
    const labels = new Set(lesson.drillSpots.map((s) => s.correctLabel));
    for (const proto of ['oval', 'barbell', 'triangle', 'comb', 'cloud']) {
      expect(labels.has(proto), `Missing drill-spot coverage for prototype: ${proto}`).toBe(true);
    }
  });
});

describe('lessonRegistry — drill-spot classifier agreement', () => {
  const lesson = getShapeLesson('silhouette');

  it('classifier agrees with each parseable drill spot label (allowing compound)', () => {
    if (!lesson) return; // covered above
    for (const spot of lesson.drillSpots) {
      // Spots may carry a special non-parseable token like "uniform-50pct"
      // (Cloud) — the future renderer constructs the grid programmatically.
      // Skip the classifier check for those; the structural tests above
      // validate them.
      if (!spot.range || /^uniform/i.test(spot.range)) continue;
      const grid = parseRangeString(spot.range);
      const result = classifySilhouette(grid);
      const agrees = result.label === spot.correctLabel
        || (result.label === 'compound' && result.components.includes(spot.correctLabel));
      expect(agrees, `Spot ${spot.index} "${spot.range}" expected ${spot.correctLabel}, classifier returned ${result.label}${result.components ? ` [${result.components.join(', ')}]` : ''} (scores: ${JSON.stringify(result.prototypeScores)})`).toBe(true);
    }
  });
});

describe('lessonRegistry — forbidden-copy guard (CD-3 / I-SM-9)', () => {
  const lesson = getShapeLesson('silhouette');

  it('no engagement-pressure copy in any section', () => {
    if (!lesson) return;
    const fullText = [
      lesson.sections.exposition,
      lesson.sections.workedExample,
      lesson.sections.successCriteria,
      lesson.sections.drillSpots,
    ].join('\n').toLowerCase();
    const forbidden = [
      'great job',
      'keep it up',
      'you\'re doing great',
      'level up',
      'streak',
      'current streak',
      'longest streak',
      'percentile',
      'masteryscore',
      'fusedmastery',
    ];
    for (const f of forbidden) {
      expect(fullText.includes(f), `Forbidden phrase: "${f}"`).toBe(false);
    }
  });
});
