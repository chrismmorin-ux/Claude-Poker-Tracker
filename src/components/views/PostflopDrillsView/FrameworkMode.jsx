/**
 * FrameworkMode — multi-select drill. User picks which frameworks apply to
 * a scenario; grading shows TP (correct), FP (extra), FN (missed) with F1.
 *
 * Trains conceptual recognition of range-vs-board lenses. The shared
 * `pickNextMatchup` scheduler biases scenarios toward weaker frameworks.
 */

import React, { useState, useEffect, useRef } from 'react';
import { SCENARIOS, parseFlopString } from '../../../utils/postflopDrillContent/scenarioLibrary';
import { FRAMEWORK_ORDER, classifyScenario } from '../../../utils/postflopDrillContent/frameworks';
import { archetypeRangeFor, contextLabel } from '../../../utils/postflopDrillContent/archetypeRanges';
import { pickNextMatchup, scoreFrameworkSelection } from '../../../utils/drillContent/scheduler';
import { parseBoard } from '../../../utils/pokerCore/cardParser';
import { usePostflopDrillsPersistence } from '../../../hooks/usePostflopDrillsPersistence';
import { RangeFlopBreakdown } from './RangeFlopBreakdown';

export const FrameworkMode = () => {
  const { drills, recordAttempt, frameworkAccuracy } = usePostflopDrillsPersistence();

  const [scenario, setScenario] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(false);
  const recentIds = useRef([]);

  const frameworkDrills = drills.filter((d) => d.drillType === 'framework');
  const streak = {
    correct: frameworkDrills.slice(0, 10).filter((d) => d.correct).length,
    total: Math.min(10, frameworkDrills.length),
  };

  const nextScenario = () => {
    const s = pickNextMatchup(SCENARIOS, frameworkAccuracy, recentIds.current);
    if (!s) return;
    recentIds.current = [s.id, ...recentIds.current].slice(0, 5);
    setScenario(s);
    setPicked(new Set());
    setSubmitted(false);
    setScore(null);
    setMatches(null);
  };

  useEffect(() => { nextScenario(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggle = (id) => {
    if (submitted) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!scenario || submitted) return;
    setLoading(true);
    setTimeout(() => {
      try {
        const range = archetypeRangeFor(scenario.context);
        const opposingRange = scenario.opposingContext
          ? archetypeRangeFor(scenario.opposingContext) : null;
        const board = parseBoard(parseFlopString(scenario.board));
        const fwMatches = classifyScenario({
          range,
          opposingRange,
          board,
          context: scenario.context,
          opposingContext: scenario.opposingContext,
        });
        const trueIds = fwMatches.map((m) => m.framework.id);
        const s = scoreFrameworkSelection([...picked], trueIds);

        setMatches(fwMatches);
        setScore(s);
        setSubmitted(true);
        setLoading(false);

        recordAttempt({
          drillType: 'framework',
          scenarioKey: scenario.id,
          context: scenario.context,
          opposingContext: scenario.opposingContext || null,
          board: scenario.board,
          userAnswer: { picked: [...picked] },
          truth: { frameworks: trueIds },
          correct: s.correct,
          delta: null,
        }).catch(() => {});
      } catch {
        setLoading(false);
      }
    }, 0);
  };

  if (!scenario) return <div className="text-gray-400 text-sm">Loading drill…</div>;

  return (
    <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
      <div className="flex flex-col gap-4 overflow-y-auto pr-2">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Identify frameworks</div>
          <div className="text-xl font-semibold text-white leading-tight">
            {contextLabel(scenario.context)}
            {scenario.opposingContext && <span className="text-gray-500"> vs </span>}
            {scenario.opposingContext && contextLabel(scenario.opposingContext)}
          </div>
          <div className="text-lg font-mono text-teal-300 mt-1">{scenario.board}</div>
          <div className="text-xs text-gray-500 mt-2">Check every framework that applies to this scenario.</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="space-y-2">
            {FRAMEWORK_ORDER.map((fw) => {
              const isPicked = picked.has(fw.id);
              const verdict = submitted ? getVerdict(fw.id, score) : null;
              return (
                <button
                  key={fw.id}
                  onClick={() => toggle(fw.id)}
                  disabled={submitted}
                  className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3 ${verdictBg(verdict, isPicked)}`}
                >
                  <div className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center text-xs ${verdictCheckbox(verdict, isPicked)}`}>
                    {(isPicked || verdict === 'correct') ? '✓' : verdict === 'missed' ? '!' : ''}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-100">{fw.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{fw.shortDescription}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex gap-3">
            {!submitted ? (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
              >
                {loading ? 'Grading…' : 'Reveal answer'}
              </button>
            ) : (
              <button
                onClick={nextScenario}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg transition-colors"
              >
                Next scenario →
              </button>
            )}
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-4 text-sm flex justify-between">
          <span className="text-gray-500">Streak (correct in last {streak.total})</span>
          <span className="text-emerald-400 font-semibold">{streak.correct}/{streak.total}</span>
        </div>
      </div>

      <div className="overflow-y-auto pr-2">
        {submitted && score ? (
          <>
            <div className={`mb-3 p-4 rounded-lg border ${score.correct ? 'bg-emerald-900/30 border-emerald-700' : 'bg-rose-900/30 border-rose-700'}`}>
              <div className="text-xs uppercase tracking-wide text-gray-400">
                {score.correct ? 'All frameworks correctly identified' : `${score.tp.length} correct · ${score.fp.length} extra · ${score.fn.length} missed`}
              </div>
              <div className="text-xs text-gray-500 mt-1">F1: {(score.f1 * 100).toFixed(0)}%</div>
            </div>
            <RangeFlopBreakdown
              range={archetypeRangeFor(scenario.context)}
              opposingRange={scenario.opposingContext ? archetypeRangeFor(scenario.opposingContext) : null}
              board={parseBoard(parseFlopString(scenario.board))}
              context={scenario.context}
              opposingContext={scenario.opposingContext}
            />
          </>
        ) : (
          <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-6 min-h-[400px] flex items-center justify-center text-sm text-gray-500">
            Pick which frameworks apply, then reveal the answer to see the hand-type breakdown.
          </div>
        )}
      </div>
    </div>
  );
};

const getVerdict = (id, score) => {
  if (!score) return null;
  if (score.tp.includes(id)) return 'correct';
  if (score.fp.includes(id)) return 'wrong';
  if (score.fn.includes(id)) return 'missed';
  return null;
};

const verdictBg = (verdict, isPicked) => {
  if (verdict === 'correct') return 'bg-emerald-900/40 border-emerald-700';
  if (verdict === 'wrong')   return 'bg-rose-900/40 border-rose-700';
  if (verdict === 'missed')  return 'bg-amber-900/40 border-amber-700';
  if (isPicked)              return 'bg-teal-900/40 border-teal-700';
  return 'bg-gray-900/60 border-gray-700 hover:border-gray-600';
};

const verdictCheckbox = (verdict, isPicked) => {
  if (verdict === 'correct') return 'border-emerald-400 bg-emerald-600 text-white';
  if (verdict === 'wrong')   return 'border-rose-400 bg-rose-600 text-white';
  if (verdict === 'missed')  return 'border-amber-400 bg-amber-600 text-white';
  if (isPicked)              return 'border-teal-400 bg-teal-600 text-white';
  return 'border-gray-600 bg-gray-800 text-transparent';
};
