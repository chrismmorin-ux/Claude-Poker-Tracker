/**
 * @file LessonDetailView — minimal SCF lesson detail surface.
 *
 * Renders Exposition + Worked example + Success criteria sections of a
 * loaded lesson. Triggered from HandReplay's "Drill this" affordance via
 * useUI().openLessonDetail(conceptId).
 *
 * Per chris-live-player.md autonomy red lines #5 + #7:
 *   - Editor's-note tone in lesson copy (CD-1/CD-2/CD-3 enforced at authoring)
 *   - Source-util-policy whitelisted (HandReplayView + SelfCoachView only)
 *
 * Per src/utils/skillAssessment/CLAUDE.md: this component MUST NOT be
 * rendered from live-table surfaces. Routing is gated by SCREEN.LESSON_DETAIL
 * which only opens via openLessonDetail handler.
 *
 * SPR-032 / WS-147 (2026-05-03).
 */

import React from 'react';
import { useUI } from '../../contexts';
import { getLesson } from '../../utils/skillAssessment/lessonRegistry';

export const LessonDetailView = ({ scale }) => {
  const { lessonConceptId, closeLessonDetail } = useUI();
  const lesson = lessonConceptId ? getLesson(lessonConceptId) : null;

  if (!lesson) {
    return (
      <div className="p-4 text-gray-400" data-testid="lesson-detail-missing">
        <button
          type="button"
          onClick={closeLessonDetail}
          className="text-cyan-400 text-sm"
        >
          ← Back
        </button>
        <div className="mt-4">
          Lesson not found{lessonConceptId ? `: ${lessonConceptId}` : ''}.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto" data-testid="lesson-detail-view">
      <button
        type="button"
        onClick={closeLessonDetail}
        className="text-cyan-400 text-sm mb-4"
      >
        ← Back
      </button>
      <h1
        className="text-white text-2xl font-semibold mb-1"
        data-testid="lesson-title"
      >
        {lesson.meta.title}
      </h1>
      <div className="text-gray-500 text-xs mb-6" data-testid="lesson-meta">
        Tier {lesson.meta.tier ?? '—'} · {lesson.meta.conceptId}
        {lesson.meta.citation?.source ? ` · ${lesson.meta.citation.source}` : ''}
      </div>

      {lesson.sections.exposition && (
        <section className="mb-6" data-testid="lesson-section-exposition">
          <h2 className="text-indigo-400 text-sm font-semibold mb-2 uppercase tracking-wide">
            Exposition
          </h2>
          <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
            {lesson.sections.exposition}
          </div>
        </section>
      )}

      {lesson.sections.workedExample && (
        <section className="mb-6" data-testid="lesson-section-workedExample">
          <h2 className="text-indigo-400 text-sm font-semibold mb-2 uppercase tracking-wide">
            Worked Example
          </h2>
          <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
            {lesson.sections.workedExample}
          </div>
        </section>
      )}

      {lesson.sections.successCriteria && (
        <section data-testid="lesson-section-successCriteria">
          <h2 className="text-indigo-400 text-sm font-semibold mb-2 uppercase tracking-wide">
            Success Criteria
          </h2>
          <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
            {lesson.sections.successCriteria}
          </div>
        </section>
      )}
    </div>
  );
};
