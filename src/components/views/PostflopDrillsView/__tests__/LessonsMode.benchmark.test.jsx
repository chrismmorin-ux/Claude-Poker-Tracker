// @vitest-environment jsdom
/**
 * LessonsMode.benchmark.test.jsx — the `benchmark` lesson section kind.
 *
 * Gate 4 §PD-LESSON-BENCHMARK (entry audit 2026-07-31). Three things are pinned:
 *
 * 1. `benchmark` sections render as a real table — NOT as the amber
 *    UnsupportedSection fallback. That fallback exists so an unknown kind fails
 *    visibly (WS-229 F-DRILL-07); the regression this guards is someone adding a
 *    kind to the content schema without adding it to the LessonSection dispatch,
 *    which would ship a lesson full of amber error boxes.
 * 2. The anchor and the source attribution both reach the DOM. Both are
 *    load-bearing: the anchor is the reference line every row is read against,
 *    and the source is the Gate 1 number-drift mitigation.
 * 3. The section stays NON-INTERACTIVE. This is a binding design constraint, not
 *    an implementation detail — an interactive field-size widget would teach hero
 *    to consult the app at the table, which inverts the lesson's success
 *    criterion. A future "improvement" to a slider/calculator must fail here.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { LessonsMode } from '../LessonsMode';
import { findLesson } from '../../../../utils/postflopDrillContent/lessons';

const FIELD_SIZE = 'mw-field-size';

const openFieldSizeLesson = () => {
  const lesson = findLesson(FIELD_SIZE);
  fireEvent.click(screen.getByText(lesson.title));
  return lesson;
};

describe('LessonsMode — benchmark section kind', () => {
  it('renders benchmark sections as tables, not as the unsupported-kind fallback', () => {
    render(<LessonsMode />);
    const lesson = openFieldSizeLesson();

    const benchmarks = lesson.sections.filter((s) => s.kind === 'benchmark');
    expect(benchmarks.length).toBeGreaterThan(0);

    expect(screen.queryByText(/Unsupported lesson section type/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(benchmarks.length);
  });

  it('renders every row label and every cell value of each benchmark', () => {
    render(<LessonsMode />);
    const lesson = openFieldSizeLesson();

    const tables = screen.getAllByRole('table');
    const benchmarks = lesson.sections.filter((s) => s.kind === 'benchmark');

    benchmarks.forEach((section, i) => {
      const table = within(tables[i]);
      for (const col of section.columns) {
        expect(table.getByText(col)).toBeInTheDocument();
      }
      for (const row of section.rows) {
        const cells = within(table.getByText(row.label).closest('tr')).getAllByRole('cell');
        // label cell + one cell per value
        expect(cells).toHaveLength(row.values.length + 1);
        row.values.forEach((v, j) => expect(cells[j + 1]).toHaveTextContent(v));
      }
    });
  });

  it('surfaces the anchor and the source attribution for every benchmark', () => {
    render(<LessonsMode />);
    const lesson = openFieldSizeLesson();

    for (const section of lesson.sections.filter((s) => s.kind === 'benchmark')) {
      expect(screen.getByText(section.anchor)).toBeInTheDocument();
      expect(screen.getByText(`Source: ${section.source}`)).toBeInTheDocument();
    }
  });

  it('keeps benchmark sections non-interactive (binding design constraint)', () => {
    render(<LessonsMode />);
    openFieldSizeLesson();

    for (const table of screen.getAllByRole('table')) {
      const scope = within(table);
      expect(scope.queryAllByRole('button')).toHaveLength(0);
      expect(scope.queryAllByRole('slider')).toHaveLength(0);
      expect(scope.queryAllByRole('combobox')).toHaveLength(0);
      expect(scope.queryAllByRole('textbox')).toHaveLength(0);
    }
  });
});
