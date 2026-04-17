import React, { useState, useEffect, useRef } from 'react';
import { MatchupBreakdown } from './MatchupBreakdown';
import { computeHandVsHand, parseHandClass } from '../../../utils/pokerCore/preflopEquity';
import { classifyMatchup } from '../../../utils/drillContent/frameworks';
import { MATCHUP_LIBRARY } from '../../../utils/drillContent/matchupLibrary';
import { pickNextMatchup, scoreEstimate } from '../../../utils/drillContent/scheduler';
import { usePreflopDrillsPersistence } from '../../../hooks/usePreflopDrillsPersistence';

/**
 * EstimateMode — user guesses equity ±5%, system reveals truth + frameworks.
 * Weak-framework scheduler biases matchup selection over time.
 */
export const EstimateMode = () => {
  const { drills, recordAttempt, frameworkAccuracy } = usePreflopDrillsPersistence();

  const [matchup, setMatchup] = useState(null);
  const [estimate, setEstimate] = useState(50);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(null);
  const [frameworkMatches, setFrameworkMatches] = useState(null);
  const recentIds = useRef([]);

  const estimateDrills = drills.filter((d) => d.drillType === 'estimate');
  const recent = estimateDrills.slice(0, 10);
  const streak = computeStreak(recent);

  const nextMatchup = () => {
    const m = pickNextMatchup(MATCHUP_LIBRARY, frameworkAccuracy, recentIds.current);
    if (m) recentIds.current = [m.id, ...recentIds.current].slice(0, 5);
    setMatchup(m);
    setEstimate(50);
    setSubmitted(false);
    setResult(null);
    setScore(null);
    setFrameworkMatches(null);
  };

  useEffect(() => { nextMatchup(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleSubmit = () => {
    if (!matchup || submitted) return;
    setLoading(true);
    setTimeout(() => {
      try {
        const r = computeHandVsHand(matchup.a, matchup.b);
        const hA = parseHandClass(matchup.a);
        const hB = parseHandClass(matchup.b);
        const matches = classifyMatchup(hA, hB);
        const truthEquity = r.equity;
        const userEq = estimate / 100;
        const s = scoreEstimate(userEq, truthEquity);

        setResult(r);
        setScore(s);
        setFrameworkMatches(matches);
        setSubmitted(true);
        setLoading(false);

        recordAttempt({
          drillType: 'estimate',
          matchupKey: `${matchup.a}_${matchup.b}`,
          handA: matchup.a,
          handB: matchup.b,
          userAnswer: { estimate: userEq },
          truth: { equity: truthEquity, frameworks: matches.map((m) => m.framework.id) },
          correct: s.correct,
          delta: s.delta,
        }).catch(() => { /* persistence errors non-fatal */ });
      } catch (err) {
        setLoading(false);
      }
    }, 0);
  };

  if (!matchup) {
    return <div className="text-gray-400 text-sm">Loading drill…</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-6 h-full">
      <div className="flex flex-col gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Guess the equity</div>
          <div className="text-5xl font-bold text-white mb-4">{matchup.a} vs {matchup.b}</div>
          <div className="text-xs text-gray-500">Primary framework: {matchup.primary} / {matchup.subcase}</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <div className="flex justify-between items-end mb-3">
            <div className="text-sm text-gray-300">How often does {matchup.a} win?</div>
            <div className="text-3xl font-bold text-purple-400 w-20 text-right">{estimate}%</div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={estimate}
            onChange={(e) => setEstimate(Number(e.target.value))}
            disabled={submitted}
            className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>

          <div className="mt-5 flex gap-3">
            {!submitted ? (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
              >
                {loading ? 'Computing…' : 'Submit estimate'}
              </button>
            ) : (
              <button
                onClick={nextMatchup}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg transition-colors"
              >
                Next matchup →
              </button>
            )}
          </div>
        </div>

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
      </div>

      <div>
        {submitted && result && score ? (
          <>
            <div className={`mb-4 p-4 rounded-lg border ${score.correct ? 'bg-emerald-900/30 border-emerald-700' : 'bg-rose-900/30 border-rose-700'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">
                    {score.correct ? 'Within ±5%' : 'Off target'} · {renderStars(score.stars)}
                  </div>
                  <div className="text-sm text-gray-200 mt-1">
                    You: <strong>{estimate}%</strong> · Truth: <strong>{(result.equity * 100).toFixed(1)}%</strong> · Delta: <strong>{(score.delta * 100).toFixed(1)}%</strong>
                  </div>
                </div>
              </div>
            </div>
            <MatchupBreakdown
              handALabel={matchup.a}
              handBLabel={matchup.b}
              result={result}
              frameworkMatches={frameworkMatches}
            />
          </>
        ) : (
          <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-6 min-h-[400px] flex items-center justify-center text-sm text-gray-500">
            Submit your estimate to see the truth and the frameworks that explain it.
          </div>
        )}
      </div>
    </div>
  );
};

const computeStreak = (drills) => {
  const total = drills.length;
  const correct = drills.filter((d) => d.correct).length;
  return { correct, total };
};

const renderStars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
