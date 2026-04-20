import React, { useMemo, useState } from 'react';
import { LESSONS, LESSON_CATEGORIES } from '../../../utils/drillContent/lessons';
import { FRAMEWORKS } from '../../../utils/drillContent/frameworks';
import { computeHandVsHand, parseHandClass } from '../../../utils/pokerCore/preflopEquity';
import { classifyMatchup } from '../../../utils/drillContent/frameworks';
import { MatchupBreakdown, FRAMEWORK_COLOR } from './MatchupBreakdown';
import { CALCULATORS } from './LessonCalculators';

/**
 * LessonsMode — browse curated concept pages. Each lesson mixes prose,
 * formulas, and worked matchup examples with click-to-reveal equity.
 *
 * Reuses MatchupBreakdown for example rendering; computeHandVsHand is
 * cached at the utility layer so repeat reveals are instant.
 */
export const LessonsMode = () => {
  const [activeLessonId, setActiveLessonId] = useState(LESSONS[0].id);
  const lesson = useMemo(
    () => LESSONS.find((l) => l.id === activeLessonId) || LESSONS[0],
    [activeLessonId],
  );

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6 h-full">
      <LessonList
        lessons={LESSONS}
        activeId={activeLessonId}
        onSelect={setActiveLessonId}
      />
      <LessonBody key={lesson.id} lesson={lesson} />
    </div>
  );
};

const CATEGORY_CHIP_COLOR = {
  practical_math: 'bg-teal-900 text-teal-200',
};

const chipMetaForLesson = (l) => {
  // Category overrides the framework chip when present — used for lessons that
  // teach foundational math rather than a structural framework.
  if (l.category && LESSON_CATEGORIES[l.category]) {
    return {
      name: LESSON_CATEGORIES[l.category].name,
      hue: CATEGORY_CHIP_COLOR[l.category] || 'bg-gray-700 text-gray-200',
    };
  }
  const fw = Object.values(FRAMEWORKS).find((f) => f.id === l.frameworkId);
  return {
    name: fw?.name || l.frameworkId,
    hue: FRAMEWORK_COLOR[l.frameworkId] || 'bg-gray-700 text-gray-200',
  };
};

const LessonList = ({ lessons, activeId, onSelect }) => (
  <div className="bg-gray-800/50 border border-gray-800 rounded-lg overflow-y-auto">
    <div className="px-4 py-3 border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
      Lessons
    </div>
    <div>
      {lessons.map((l) => {
        const active = l.id === activeId;
        const chip = chipMetaForLesson(l);
        return (
          <button
            key={l.id}
            onClick={() => onSelect(l.id)}
            className={`w-full text-left px-4 py-3 border-b border-gray-800/60 transition-colors ${
              active ? 'bg-purple-900/30 border-l-2 border-l-purple-500' : 'hover:bg-gray-800/60'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${chip.hue}`}>
                {chip.name}
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
  if (section.kind === 'prose') return <ProseSection section={section} />;
  if (section.kind === 'formula') return <FormulaSection section={section} />;
  if (section.kind === 'example') return <ExampleSection section={section} />;
  if (section.kind === 'compute') return <ComputeSection section={section} />;
  return null;
};

const ComputeSection = ({ section }) => {
  const Calculator = CALCULATORS[section.calculator];
  if (!Calculator) {
    return (
      <div className="bg-rose-900/30 border border-rose-800 text-rose-200 rounded px-3 py-2 text-xs">
        Unknown calculator: {String(section.calculator)}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {section.heading && (
        <h3 className="text-sm font-semibold text-gray-200">{section.heading}</h3>
      )}
      {section.intro && (
        <p className="text-sm text-gray-300 leading-relaxed">{section.intro}</p>
      )}
      <Calculator />
      {section.takeaway && (
        <p className="text-xs text-gray-400 italic leading-relaxed">{section.takeaway}</p>
      )}
    </div>
  );
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
  const [result, setResult] = useState(null);
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reveal = () => {
    if (revealed) return;
    setLoading(true);
    setError(null);
    setTimeout(() => {
      try {
        const r = computeHandVsHand(section.a, section.b);
        const m = classifyMatchup(parseHandClass(section.a), parseHandClass(section.b));
        setResult(r);
        setMatches(m);
        setRevealed(true);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Worked example</div>
          <div className="text-xl font-bold text-white mt-0.5">{section.a} vs {section.b}</div>
        </div>
        {!revealed && (
          <button
            onClick={reveal}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Computing…' : 'Reveal equity'}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-300 italic">{section.takeaway}</p>

      {error && (
        <div className="mt-3 bg-red-900/30 border border-red-800 text-red-300 rounded px-3 py-2 text-xs">
          {error}
        </div>
      )}

      {revealed && result && (
        <div className="mt-3">
          <MatchupBreakdown
            handALabel={section.a}
            handBLabel={section.b}
            result={result}
            frameworkMatches={matches}
          />
        </div>
      )}
    </div>
  );
};
