import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MatchupBreakdown } from './MatchupBreakdown';
import { computeHandVsHand, parseHandClass } from '../../../utils/pokerCore/preflopEquity';
import { classifyMatchup, FRAMEWORKS } from '../../../utils/drillContent/frameworks';
import { MATCHUP_LIBRARY } from '../../../utils/drillContent/matchupLibrary';
import { pickNextMatchup, scoreEstimate } from '../../../utils/drillContent/scheduler';
import {
  buildFrameworkInsight,
  buildCalibration,
  extractTrend,
} from '../../../utils/drillContent/estimateInsights';
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

  // Post-submit: identify which banded framework the user's guess and the
  // truth each snap to, and flag a mis-application when they differ.
  const frameworkInsight = useMemo(() => {
    if (!submitted || !frameworkMatches || !result) return null;
    return buildFrameworkInsight(frameworkMatches, estimate / 100, result.equity);
  }, [submitted, frameworkMatches, result, estimate]);

  // Left-panel stats: per-framework signed delta + recent-delta trend.
  const calibration = useMemo(() => buildCalibration(estimateDrills), [estimateDrills]);
  const trend = useMemo(() => extractTrend(estimateDrills, 20), [estimateDrills]);

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
          <div className="text-xs text-gray-500">
            Primary framework: <span className="text-gray-300">{frameworkLabel(matchup.primary)}</span>
          </div>
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
            <span className="text-gray-500">Avg delta (last 10)</span>
            <span className="text-emerald-400 font-semibold">±{(streak.avgDelta * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-500">Within ±5% (last 10)</span>
            <span className="text-gray-300">{streak.correct}/{streak.total}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-500">Total attempts</span>
            <span className="text-gray-300">{estimateDrills.length}</span>
          </div>

          {trend.length >= 3 && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Recent signed deltas (±pp from truth)</span>
                <span>last {trend.length}</span>
              </div>
              <TrendSparkline points={trend} />
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>oldest</span>
                <span>latest →</span>
              </div>
            </div>
          )}

          {calibration.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              <div className="text-xs text-gray-500 mb-1.5">Calibration (per framework)</div>
              <div className="space-y-1">
                {calibration.slice(0, 3).map((c) => (
                  <CalibrationRow key={c.frameworkId} entry={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        {submitted && result && score ? (
          <>
            <div className={`mb-4 p-4 rounded-lg border ${score.correct ? 'bg-emerald-900/30 border-emerald-700' : 'bg-rose-900/30 border-rose-700'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-400">
                    {score.correct ? 'Within ±5%' : 'Off target'} · <span title={STAR_LEGEND}>{renderStars(score.stars)}</span>
                  </div>
                  <div className="text-sm text-gray-200 mt-1">
                    You: <strong>{estimate}%</strong> · Truth: <strong>{(result.equity * 100).toFixed(1)}%</strong> · Delta: <strong>{(score.delta * 100).toFixed(1)}%</strong>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">{STAR_LEGEND}</div>
                </div>
              </div>
              {frameworkInsight && !score.correct && (
                <FrameworkInsightHint insight={frameworkInsight} userEstimate={estimate} truthPct={result.equity * 100} />
              )}
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
  // Continuous quality signal: lower is better. Defaults to 0 when no drills
  // recorded so the UI doesn't render NaN.
  const sumDelta = drills.reduce((s, d) => s + (typeof d.delta === 'number' ? d.delta : 0), 0);
  const avgDelta = total > 0 ? sumDelta / total : 0;
  return { correct, total, avgDelta };
};

const renderStars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

const STAR_LEGEND = '★★★ within ±2% · ★★ within ±5% · ★ within ±10%';

const FRAMEWORK_BY_ID = Object.values(FRAMEWORKS).reduce((acc, fw) => {
  acc[fw.id] = fw;
  return acc;
}, {});

const frameworkLabel = (id) => FRAMEWORK_BY_ID[id]?.name || id;

// ---------- Feedback-richness sub-components ---------- //

/**
 * FrameworkInsightHint — shown inside the post-submit panel when the user is
 * off target. Communicates which banded framework the user's estimate matched
 * versus which one truth-aligned, or (when no banded framework applies) that
 * the matchup is decomposition/coverage-driven and has no tight anchor.
 */
const FrameworkInsightHint = ({ insight, userEstimate, truthPct }) => {
  if (insight.kind === 'no_banded') {
    return (
      <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-300 leading-relaxed">
        <span className="text-amber-300 font-semibold">No tight-band framework applies here.</span>
        {' '}This matchup is driven by decomposition + coverage + flush contention, not a single
        structural anchor. Estimate by adding pair-up + draw + suitedness contributions.
      </div>
    );
  }
  if (insight.kind === 'mis_applied') {
    const u = insight.userFramework;
    const t = insight.truthFramework;
    return (
      <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-300 leading-relaxed">
        <span className="text-amber-300 font-semibold">You reasoned like {u.frameworkName}</span>
        {' '}(predicts ~{(u.predictedEquity * 100).toFixed(0)}%), but the dominant framework here is
        {' '}<span className="text-emerald-300 font-semibold">{t.frameworkName}</span>
        {' '}(predicts ~{(t.predictedEquity * 100).toFixed(0)}%). You guessed {userEstimate}%, truth {truthPct.toFixed(1)}%.
      </div>
    );
  }
  // aligned: user's guess was in the right framework's neighborhood but
  // still off target — this means intra-subcase variance (blockers, suitedness).
  return (
    <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-300 leading-relaxed">
      <span className="text-emerald-300 font-semibold">Right framework ({insight.userFramework.frameworkName})</span>
      , but your number was off by more than ±5%. Check the modifier chips for suitedness /
      connectedness / coverage — those are the fine-tune deltas.
    </div>
  );
};

/**
 * TrendSparkline — inline SVG rendering signed deltas left-to-right.
 * Zero-line is drawn in gray; each point is a dot colored green/red by sign.
 */
const TrendSparkline = ({ points }) => {
  const W = 220;
  const H = 36;
  const maxAbs = Math.max(0.05, ...points.map((p) => Math.abs(p.signedDelta)));
  const step = points.length > 1 ? W / (points.length - 1) : 0;
  const midY = H / 2;
  const scale = (H / 2 - 2) / maxAbs; // leave 2px padding at top/bottom

  const pointEls = points.map((p, i) => {
    const x = i * step;
    const y = midY - p.signedDelta * scale; // positive delta → above midline
    const color = p.signedDelta > 0.005 ? '#f87171' : p.signedDelta < -0.005 ? '#60a5fa' : '#9ca3af';
    return <circle key={i} cx={x} cy={y} r="2" fill={color} />;
  });

  const path = points
    .map((p, i) => {
      const x = i * step;
      const y = midY - p.signedDelta * scale;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={W} height={H} className="overflow-visible">
      <line x1="0" y1={midY} x2={W} y2={midY} stroke="#4b5563" strokeDasharray="2 2" strokeWidth="1" />
      <path d={path} fill="none" stroke="#6b7280" strokeWidth="1" />
      {pointEls}
    </svg>
  );
};

/**
 * CalibrationRow — one line per framework with n attempts above threshold.
 * Signed delta rendered with an arrow so the direction is visually obvious.
 */
const CalibrationRow = ({ entry }) => {
  const pp = entry.signedAvgDelta * 100;
  const arrow = pp > 0 ? '↑' : pp < 0 ? '↓' : '·';
  const tone = Math.abs(pp) < 2 ? 'text-gray-400' : pp > 0 ? 'text-rose-300' : 'text-sky-300';
  const verdict = Math.abs(pp) < 2
    ? 'tight'
    : pp > 0 ? `overshoots +${pp.toFixed(1)}pp` : `undershoots ${pp.toFixed(1)}pp`;
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-gray-400 truncate mr-2">{entry.frameworkName}</span>
      <span className={`${tone} font-mono whitespace-nowrap`}>
        {arrow} {verdict} <span className="text-gray-500">(n={entry.n})</span>
      </span>
    </div>
  );
};
