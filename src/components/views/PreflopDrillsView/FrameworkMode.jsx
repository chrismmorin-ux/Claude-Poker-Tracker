import React, { useState, useEffect, useRef } from 'react';
import { MatchupBreakdown } from './MatchupBreakdown';
import { computeHandVsHand, parseHandClass } from '../../../utils/pokerCore/preflopEquity';
import { classifyMatchup, FRAMEWORK_ORDER } from '../../../utils/drillContent/frameworks';
import { MATCHUP_LIBRARY } from '../../../utils/drillContent/matchupLibrary';
import { pickNextMatchup, scoreFrameworkSelection } from '../../../utils/drillContent/scheduler';
import { usePreflopDrillsPersistence } from '../../../hooks/usePreflopDrillsPersistence';

/**
 * FrameworkMode — multiple-select drill. User picks which frameworks apply;
 * system grades with green (correct), yellow (missed), red (false positive).
 * Trains conceptual recognition before numeric precision.
 */
export const FrameworkMode = () => {
  const { drills, recordAttempt, frameworkAccuracy } = usePreflopDrillsPersistence();

  const [matchup, setMatchup] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [result, setResult] = useState(null);
  const [frameworkMatches, setFrameworkMatches] = useState(null);
  const [loading, setLoading] = useState(false);
  const recentIds = useRef([]);

  const frameworkDrills = drills.filter((d) => d.drillType === 'framework');
  const streak = {
    correct: frameworkDrills.slice(0, 10).filter((d) => d.correct).length,
    total: Math.min(10, frameworkDrills.length),
  };

  const nextMatchup = () => {
    const m = pickNextMatchup(MATCHUP_LIBRARY, frameworkAccuracy, recentIds.current);
    if (m) recentIds.current = [m.id, ...recentIds.current].slice(0, 5);
    setMatchup(m);
    setPicked(new Set());
    setSubmitted(false);
    setScore(null);
    setResult(null);
    setFrameworkMatches(null);
  };

  useEffect(() => { nextMatchup(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggle = (id) => {
    if (submitted) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!matchup || submitted) return;
    setLoading(true);
    setTimeout(() => {
      try {
        const hA = parseHandClass(matchup.a);
        const hB = parseHandClass(matchup.b);
        const matches = classifyMatchup(hA, hB);
        const trueIds = matches.map((m) => m.framework.id);
        const s = scoreFrameworkSelection([...picked], trueIds);
        const r = computeHandVsHand(matchup.a, matchup.b);

        setResult(r);
        setScore(s);
        setFrameworkMatches(matches);
        setSubmitted(true);
        setLoading(false);

        recordAttempt({
          drillType: 'framework',
          matchupKey: `${matchup.a}_${matchup.b}`,
          handA: matchup.a,
          handB: matchup.b,
          userAnswer: { picked: [...picked] },
          truth: { equity: r.equity, frameworks: trueIds },
          correct: s.correct,
          delta: null,
        }).catch(() => {});
      } catch {
        setLoading(false);
      }
    }, 0);
  };

  if (!matchup) return <div className="text-gray-400 text-sm">Loading drill…</div>;

  return (
    <div className="grid grid-cols-2 gap-6 h-full">
      <div className="flex flex-col gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Identify frameworks</div>
          <div className="text-5xl font-bold text-white">{matchup.a} vs {matchup.b}</div>
          <div className="text-xs text-gray-500 mt-2">Check every framework that applies to this matchup.</div>
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
                  className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start gap-3 ${
                    verdictBg(verdict, isPicked)
                  }`}
                >
                  <div className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center text-xs ${
                    verdictCheckbox(verdict, isPicked)
                  }`}>
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
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
              >
                {loading ? 'Grading…' : 'Reveal answer'}
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

        <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-4 text-sm flex justify-between">
          <span className="text-gray-500">Streak (correct in last {streak.total})</span>
          <span className="text-emerald-400 font-semibold">{streak.correct}/{streak.total}</span>
        </div>
      </div>

      <div>
        {submitted && result && score ? (
          <>
            <div className={`mb-4 p-4 rounded-lg border ${score.correct ? 'bg-emerald-900/30 border-emerald-700' : 'bg-rose-900/30 border-rose-700'}`}>
              <div className="text-xs uppercase tracking-wide text-gray-400">
                {score.correct ? 'All frameworks correctly identified' : `${score.tp.length} correct · ${score.fp.length} extra · ${score.fn.length} missed`}
              </div>
              <div className="text-xs text-gray-500 mt-1">F1: {(score.f1 * 100).toFixed(0)}%</div>
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
            Pick which frameworks apply, then reveal the answer to see the equity breakdown.
          </div>
        )}
      </div>
    </div>
  );
};

const getVerdict = (id, score) => {
  if (!score) return null;
  if (score.tp.includes(id)) return 'correct';    // picked + true
  if (score.fp.includes(id)) return 'wrong';      // picked + not true
  if (score.fn.includes(id)) return 'missed';     // not picked + true
  return null;                                    // not picked + not true (correct skip)
};

const verdictBg = (verdict, isPicked) => {
  if (verdict === 'correct') return 'bg-emerald-900/40 border-emerald-700';
  if (verdict === 'wrong')   return 'bg-rose-900/40 border-rose-700';
  if (verdict === 'missed')  return 'bg-amber-900/40 border-amber-700';
  if (isPicked)              return 'bg-purple-900/40 border-purple-700';
  return 'bg-gray-900/60 border-gray-700 hover:border-gray-600';
};

const verdictCheckbox = (verdict, isPicked) => {
  if (verdict === 'correct') return 'border-emerald-400 bg-emerald-600 text-white';
  if (verdict === 'wrong')   return 'border-rose-400 bg-rose-600 text-white';
  if (verdict === 'missed')  return 'border-amber-400 bg-amber-600 text-white';
  if (isPicked)              return 'border-purple-400 bg-purple-600 text-white';
  return 'border-gray-600 bg-gray-800 text-transparent';
};
