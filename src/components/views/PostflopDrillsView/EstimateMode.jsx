/**
 * EstimateMode — user guesses a hand-type-precise % for a generated question.
 *
 *   "What % of BB call vs BTN range on Ah Kd 7s is top-pair-or-better?"
 *
 * Scheduler picks the scenario (weighted by framework accuracy via the shared
 * `pickNextMatchup`), the question generator picks the question type and
 * side. Grading uses `scoreEstimate` (stars by delta). Record persists to
 * the postflopDrills IDB store via `usePostflopDrillsPersistence`.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SCENARIOS } from '../../../utils/postflopDrillContent/scenarioLibrary';
import { generateEstimateQuestion } from '../../../utils/postflopDrillContent/questionGenerators';
import { archetypeRangeFor } from '../../../utils/postflopDrillContent/archetypeRanges';
import { pickNextMatchup, scoreEstimate } from '../../../utils/drillContent/scheduler';
import { classifyScenario } from '../../../utils/postflopDrillContent/frameworks';
import { usePostflopDrillsPersistence } from '../../../hooks/usePostflopDrillsPersistence';
import { RangeFlopBreakdown } from './RangeFlopBreakdown';

// Scheduler expects `library[i].primary`; our SCENARIOS already have this.
// Wrap pickNextMatchup with minimal adaptation.
const pickNextScenario = (frameworkAccuracy, recentIds) =>
  pickNextMatchup(SCENARIOS, frameworkAccuracy, recentIds);

const renderStars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

const computeStreak = (drills) => {
  const total = drills.length;
  const correct = drills.filter((d) => d.correct).length;
  return { correct, total };
};

export const EstimateMode = () => {
  const { drills, recordAttempt, frameworkAccuracy } = usePostflopDrillsPersistence();

  const [question, setQuestion] = useState(null);
  const [estimate, setEstimate] = useState(20);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const recentIds = useRef([]);

  const estimateDrills = drills.filter((d) => d.drillType === 'estimate');
  const streak = computeStreak(estimateDrills.slice(0, 10));

  const nextQuestion = () => {
    const s = pickNextScenario(frameworkAccuracy, recentIds.current);
    if (!s) return;
    const seed = (Date.now() & 0xffffffff) ^ (Math.random() * 1e9 | 0);
    const q = generateEstimateQuestion(s, seed);
    recentIds.current = [s.id, ...recentIds.current].slice(0, 5);
    setQuestion(q);
    setEstimate(20);
    setSubmitted(false);
    setScore(null);
  };

  useEffect(() => { nextQuestion(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const focalMatches = useMemo(() => {
    if (!question || !submitted) return null;
    try {
      const range = archetypeRangeFor(question.scenario.context);
      const opposingRange = question.scenario.opposingContext
        ? archetypeRangeFor(question.scenario.opposingContext) : null;
      return classifyScenario({
        range,
        opposingRange,
        board: question.board,
        context: question.scenario.context,
        opposingContext: question.scenario.opposingContext,
      });
    } catch {
      return null;
    }
  }, [question, submitted]);

  const handleSubmit = () => {
    if (!question || submitted) return;
    setLoading(true);
    setTimeout(() => {
      const userFrac = estimate / 100;
      const s = scoreEstimate(userFrac, question.truth);
      setScore(s);
      setSubmitted(true);
      setLoading(false);
      recordAttempt({
        drillType: 'estimate',
        scenarioKey: `${question.scenarioId}__${question.questionId}__${question.ctx.position}`,
        context: question.scenario.context,
        opposingContext: question.scenario.opposingContext || null,
        board: question.scenario.board,
        userAnswer: { estimate: userFrac, questionId: question.questionId, about: question.ctx },
        truth: {
          pct: question.truth,
          questionId: question.questionId,
          frameworks: (focalMatches || []).map((m) => m.framework.id),
        },
        correct: s.correct,
        delta: s.delta,
      }).catch(() => { /* non-fatal */ });
    }, 0);
  };

  if (!question) {
    return <div className="text-gray-400 text-sm">Loading drill…</div>;
  }

  const resolvedRange = archetypeRangeFor(question.ctx);
  const opposingRange = question.scenario.opposingContext
    ? archetypeRangeFor(question.scenario.opposingContext) : null;
  const isFocal = question.ctx.position === question.scenario.context.position
    && question.ctx.action === question.scenario.context.action
    && (question.ctx.vs || null) === (question.scenario.context.vs || null);

  return (
    <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
      <div className="flex flex-col gap-4 overflow-y-auto pr-2">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Estimate the %</div>
          <div className="text-lg font-semibold text-white mb-2 leading-tight">{question.prompt}</div>
          <div className="text-xs text-gray-500">
            Question type: <span className="text-teal-300">{question.label}</span>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <div className="flex justify-between items-end mb-3">
            <div className="text-sm text-gray-300">Your guess (%)</div>
            <div className="text-3xl font-bold text-teal-400 w-20 text-right">{estimate}%</div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={estimate}
            onChange={(e) => setEstimate(Number(e.target.value))}
            disabled={submitted}
            className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
          <div className="mt-5 flex gap-3">
            {!submitted ? (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
              >
                {loading ? 'Computing…' : 'Submit estimate'}
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg transition-colors"
              >
                Next question →
              </button>
            )}
          </div>
        </div>

        {submitted && score && (
          <div className={`p-4 rounded-lg border ${score.correct ? 'bg-emerald-900/30 border-emerald-700' : 'bg-rose-900/30 border-rose-700'}`}>
            <div className="text-xs uppercase tracking-wide text-gray-400">
              {score.correct ? 'Within ±5 pp' : 'Off target'} · {renderStars(score.stars)}
            </div>
            <div className="text-sm text-gray-200 mt-1">
              You: <strong>{estimate}%</strong> · Truth: <strong>{(question.truth * 100).toFixed(1)}%</strong> · Delta: <strong>{(score.delta * 100).toFixed(1)} pp</strong>
            </div>
          </div>
        )}

        <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Streak (correct in last 10)</span>
            <span className="text-emerald-400 font-semibold">{streak.correct}/{streak.total}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-500">Total attempts</span>
            <span className="text-gray-300">{estimateDrills.length}</span>
          </div>
        </div>

        <div className="bg-gray-800/30 border border-gray-800 rounded-lg p-3 text-[11px] text-gray-400 leading-relaxed">
          <div className="text-gray-300 font-semibold mb-1">Scenario context</div>
          <div>Focal: {question.scenario.context.position} {question.scenario.context.action}{question.scenario.context.vs ? ' vs ' + question.scenario.context.vs : ''}</div>
          {question.scenario.opposingContext && (
            <div>Opposing: {question.scenario.opposingContext.position} {question.scenario.opposingContext.action}{question.scenario.opposingContext.vs ? ' vs ' + question.scenario.opposingContext.vs : ''}</div>
          )}
          <div>Board: {question.scenario.board}</div>
          <div className="mt-1">Asking about: <span className="text-teal-300">{question.rangeLabel}</span></div>
        </div>
      </div>

      <div className="overflow-y-auto pr-2">
        {submitted ? (
          <RangeFlopBreakdown
            range={resolvedRange}
            opposingRange={isFocal ? opposingRange : archetypeRangeFor(question.scenario.context)}
            board={question.board}
            context={question.ctx}
            opposingContext={isFocal ? question.scenario.opposingContext : question.scenario.context}
          />
        ) : (
          <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-6 min-h-[400px] flex items-center justify-center text-sm text-gray-500">
            Submit your estimate to reveal the truth + hand-type breakdown.
          </div>
        )}
      </div>
    </div>
  );
};
