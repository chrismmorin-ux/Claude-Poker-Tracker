// @vitest-environment jsdom
/**
 * @file Tests for LessonDetailView — minimal SCF lesson detail surface.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LessonDetailView } from '../LessonDetailView';

afterEach(() => cleanup());

// Mock useUI to inject lessonConceptId + closeLessonDetail.
const mockUI = vi.hoisted(() => ({
  current: {
    lessonConceptId: null,
    closeLessonDetail: vi.fn(),
  },
}));

vi.mock('../../../contexts', () => ({
  useUI: () => mockUI.current,
}));

// Mock lessonRegistry — provide deterministic test fixtures.
vi.mock('../../../utils/skillAssessment/lessonRegistry', () => ({
  getLesson: (conceptId) => {
    if (conceptId === 'test-concept') {
      return {
        meta: {
          conceptId: 'test-concept',
          title: 'Test Concept Title',
          tier: '3',
          citation: { source: 'POKER_THEORY.md §X.X' },
        },
        sections: {
          exposition: 'Exposition body content for test-concept.',
          workedExample: 'Worked example body for test-concept.',
          successCriteria: 'Success criteria body for test-concept.',
        },
        path: 'fake/path/test-concept.md',
      };
    }
    if (conceptId === 'minimal-concept') {
      return {
        meta: { conceptId: 'minimal-concept', title: 'Minimal' },
        sections: { exposition: 'Just exposition.', workedExample: '', successCriteria: '' },
        path: 'fake/path/minimal.md',
      };
    }
    return null;
  },
}));

describe('LessonDetailView — missing lesson', () => {
  it('renders fallback when lessonConceptId is null', () => {
    mockUI.current.lessonConceptId = null;
    render(<LessonDetailView />);
    expect(screen.getByTestId('lesson-detail-missing')).toBeDefined();
  });

  it('renders fallback when conceptId resolves to no lesson', () => {
    mockUI.current.lessonConceptId = 'nonexistent';
    render(<LessonDetailView />);
    expect(screen.getByTestId('lesson-detail-missing')).toBeDefined();
    expect(screen.getByTestId('lesson-detail-missing').textContent).toMatch(/nonexistent/);
  });

  it('back button on fallback calls closeLessonDetail', () => {
    mockUI.current.lessonConceptId = 'nonexistent';
    mockUI.current.closeLessonDetail = vi.fn();
    render(<LessonDetailView />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockUI.current.closeLessonDetail).toHaveBeenCalledTimes(1);
  });
});

describe('LessonDetailView — full lesson', () => {
  it('renders title + tier + 3 sections', () => {
    mockUI.current.lessonConceptId = 'test-concept';
    render(<LessonDetailView />);
    expect(screen.getByTestId('lesson-detail-view')).toBeDefined();
    expect(screen.getByTestId('lesson-title').textContent).toBe('Test Concept Title');
    expect(screen.getByTestId('lesson-meta').textContent).toMatch(/Tier 3/);
    expect(screen.getByTestId('lesson-meta').textContent).toMatch(/test-concept/);
    expect(screen.getByTestId('lesson-section-exposition')).toBeDefined();
    expect(screen.getByTestId('lesson-section-workedExample')).toBeDefined();
    expect(screen.getByTestId('lesson-section-successCriteria')).toBeDefined();
  });

  it('renders citation source when present in meta', () => {
    mockUI.current.lessonConceptId = 'test-concept';
    render(<LessonDetailView />);
    expect(screen.getByTestId('lesson-meta').textContent).toMatch(/POKER_THEORY/);
  });

  it('omits empty sections', () => {
    mockUI.current.lessonConceptId = 'minimal-concept';
    render(<LessonDetailView />);
    expect(screen.getByTestId('lesson-section-exposition')).toBeDefined();
    expect(screen.queryByTestId('lesson-section-workedExample')).toBeNull();
    expect(screen.queryByTestId('lesson-section-successCriteria')).toBeNull();
  });

  it('back button calls closeLessonDetail', () => {
    mockUI.current.lessonConceptId = 'test-concept';
    mockUI.current.closeLessonDetail = vi.fn();
    render(<LessonDetailView />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockUI.current.closeLessonDetail).toHaveBeenCalledTimes(1);
  });
});

describe('LessonDetailView — autonomy red line #5 (no shame copy)', () => {
  it('view shell does NOT contain forbidden engagement-pressure or shame copy', () => {
    mockUI.current.lessonConceptId = 'test-concept';
    render(<LessonDetailView />);
    const text = screen.getByTestId('lesson-detail-view').textContent || '';
    // The lesson body comes from authored markdown — that's tested at the
    // catalog/authoring layer. Here we lint the SHELL copy that the component
    // renders around the body (headers, labels, navigation).
    // The shell copy = "Tier", "Exposition", "Worked Example", "Success Criteria",
    // "Back", "Lesson not found". None of those should contain forbidden patterns.
    // The body text itself (rendered from mock data) will include "Test Concept" / etc.
    // Linting forbidden patterns on the full text catches authoring drift too.
    expect(text).not.toMatch(/wrong/i);
    expect(text).not.toMatch(/missed/i);
    expect(text).not.toMatch(/score/i);
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/level up/i);
    expect(text).not.toMatch(/grade/i);
    expect(text).not.toMatch(/great job/i);
    expect(text).not.toMatch(/well done/i);
  });
});
