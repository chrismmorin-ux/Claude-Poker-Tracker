/**
 * LessonsMode — curated postflop lesson pages with click-to-reveal examples.
 *
 * Mirrors the preflop LessonsMode visual pattern: sidebar list of lessons,
 * main area shows the active lesson's sections. Examples reveal a full
 * RangeFlopBreakdown (hand-type-precise) when clicked.
 *
 * First lesson is Range Decomposition — the pedagogical spine.
 */

import React, { useMemo, useState } from 'react';
import { LESSONS } from '../../../utils/postflopDrillContent/lessons';
import { FRAMEWORKS } from '../../../utils/postflopDrillContent/frameworks';
import { archetypeRangeFor, contextLabel } from '../../../utils/postflopDrillContent/archetypeRanges';
import { parseFlopString } from '../../../utils/postflopDrillContent/scenarioLibrary';
import { parseBoard } from '../../../utils/pokerCore/cardParser';
import { RangeFlopBreakdown, FRAMEWORK_COLOR } from './RangeFlopBreakdown';

export const LessonsMode = () => {
  const [activeLessonId, setActiveLessonId] = useState(LESSONS[0].id);
  const lesson = useMemo(
    () => LESSONS.find((l) => l.id === activeLessonId) || LESSONS[0],
    [activeLessonId],
  );

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6 h-full overflow-hidden">
      <LessonList lessons={LESSONS} activeId={activeLessonId} onSelect={setActiveLessonId} />
      <LessonBody key={lesson.id} lesson={lesson} />
    </div>
  );
};

const LessonList = ({ lessons, activeId, onSelect }) => (
  <div className="bg-gray-800/50 border border-gray-800 rounded-lg overflow-y-auto">
    <div className="px-4 py-3 border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
      Lessons
    </div>
    <div>
      {lessons.map((l) => {
        const active = l.id === activeId;
        const chipHue = FRAMEWORK_COLOR[l.frameworkId] || 'bg-gray-700 text-gray-200';
        const fwName = Object.values(FRAMEWORKS).find((fw) => fw.id === l.frameworkId)?.name || l.frameworkId;
        return (
          <button
            key={l.id}
            onClick={() => onSelect(l.id)}
            className={`w-full text-left px-4 py-3 border-b border-gray-800/60 transition-colors ${
              active ? 'bg-teal-900/30 border-l-2 border-l-teal-500' : 'hover:bg-gray-800/60'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${chipHue}`}>
                {fwName}
              </span>
            </div>
            <div className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-200'}`}>{l.title}</div>
            <div className="text-xs text-gray-400 mt-0.5">{l.summary}</div>
          </button>
        );
      })}
    </div>
  </div>
);

const LessonBody = ({ lesson }) => (
  <div className="overflow-y-auto pr-2">
    <div className="mb-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Lesson</div>
      <h2 className="text-2xl font-bold text-white">{lesson.title}</h2>
      <p className="text-sm text-gray-400 mt-1">{lesson.summary}</p>
    </div>
    <div className="space-y-5">
      {lesson.sections.map((section, i) => (
        <LessonSection key={`${lesson.id}-${i}`} section={section} />
      ))}
    </div>
  </div>
);

const LessonSection = ({ section }) => {
  if (section.kind === 'prose')   return <ProseSection section={section} />;
  if (section.kind === 'formula') return <FormulaSection section={section} />;
  if (section.kind === 'example') return <ExampleSection section={section} />;
  return null;
};

const ProseSection = ({ section }) => (
  <div>
    {section.heading && (
      <h3 className="text-sm font-semibold text-gray-200 mb-1.5">{section.heading}</h3>
    )}
    <p className="text-sm text-gray-300 leading-relaxed">{section.body}</p>
  </div>
);

const FormulaSection = ({ section }) => (
  <div className="bg-gray-900/80 border border-gray-800 rounded-lg px-4 py-3">
    <code className="text-sm text-emerald-300 font-mono">{section.body}</code>
  </div>
);

const ExampleSection = ({ section }) => {
  const [revealed, setRevealed] = useState(false);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reveal = () => {
    if (revealed) return;
    setLoading(true);
    setError(null);
    setTimeout(() => {
      try {
        const range = archetypeRangeFor(section.context);
        const opposingRange = section.opposingContext ? archetypeRangeFor(section.opposingContext) : null;
        const board = parseBoard(parseFlopString(section.board));
        setPayload({ range, opposingRange, board });
        setRevealed(true);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  const label = contextLabel(section.context)
    + (section.opposingContext ? ` vs ${contextLabel(section.opposingContext)}` : '');

  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Worked example</div>
          <div className="text-lg font-bold text-white mt-0.5">
            {label} · <span className="font-mono text-teal-300">{section.board}</span>
          </div>
        </div>
        {!revealed && (
          <button
            onClick={reveal}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Computing…' : 'Reveal breakdown'}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-300 italic">{section.takeaway}</p>

      {error && (
        <div className="mt-3 bg-red-900/30 border border-red-800 text-red-300 rounded px-3 py-2 text-xs">
          {error}
        </div>
      )}

      {revealed && payload && (
        <div className="mt-3">
          <RangeFlopBreakdown
            range={payload.range}
            opposingRange={payload.opposingRange}
            board={payload.board}
            context={section.context}
            opposingContext={section.opposingContext}
          />
        </div>
      )}
    </div>
  );
};
