import React, { useState } from 'react';

/**
 * BankrollChart — hand-rolled SVG cumulative-bankroll line.
 *
 * Phase 2 — Sessions View Improvement (2026-06-06). No charting dependency
 * (mirrors Range Lab's equity histogram approach). Renders a responsive line of
 * running bankroll over completed sessions, a zero baseline, and a soft area
 * fill tinted by the final result. Hovering/tapping a point shows its value.
 *
 * @param {Object} props
 * @param {Array<{t:number, cumulative:number, pnl:number, sessionId:*}>} props.series
 *   Cumulative series from buildBankrollSeries (ascending by time).
 * @param {number} [props.height=120]
 */
export const BankrollChart = ({ series = [], height = 120 }) => {
  const [hover, setHover] = useState(null);

  // viewBox coordinate space; the SVG scales to its container width.
  const W = 600;
  const H = height;
  const padX = 8;
  const padY = 12;

  if (!series || series.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-gray-500 bg-gray-900/40 rounded-lg"
        style={{ height }}
        data-testid="bankroll-chart-empty"
      >
        No completed sessions yet — your bankroll trend will appear here.
      </div>
    );
  }

  const values = series.map((p) => p.cumulative);
  // Include 0 so the baseline is always in view.
  const maxV = Math.max(0, ...values);
  const minV = Math.min(0, ...values);
  const range = maxV - minV || 1;

  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  // x positions: evenly spaced across points (1 point → centered).
  const xAt = (i) =>
    series.length === 1 ? W / 2 : padX + (innerW * i) / (series.length - 1);
  const yAt = (v) => padY + innerH * (1 - (v - minV) / range);

  const zeroY = yAt(0);
  const linePoints = series.map((p, i) => `${xAt(i)},${yAt(p.cumulative)}`).join(' ');
  const areaPath =
    `M ${xAt(0)},${zeroY} ` +
    series.map((p, i) => `L ${xAt(i)},${yAt(p.cumulative)}`).join(' ') +
    ` L ${xAt(series.length - 1)},${zeroY} Z`;

  const finalUp = series[series.length - 1].cumulative >= 0;
  const lineColor = finalUp ? '#34d399' : '#f87171'; // emerald-400 / red-400
  const areaColor = finalUp ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)';

  return (
    <div className="relative w-full" data-testid="bankroll-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Cumulative bankroll over completed sessions"
      >
        {/* Area fill */}
        <path d={areaPath} fill={areaColor} stroke="none" />
        {/* Zero baseline */}
        <line x1={padX} y1={zeroY} x2={W - padX} y2={zeroY} stroke="#4b5563" strokeWidth="1" strokeDasharray="4 4" />
        {/* Bankroll line */}
        <polyline points={linePoints} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Points + hover targets */}
        {series.map((p, i) => (
          <circle
            key={p.sessionId ?? i}
            cx={xAt(i)}
            cy={yAt(p.cumulative)}
            r={hover === i ? 5 : 3}
            fill={lineColor}
            stroke="#0f172a"
            strokeWidth="1.5"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setHover(i === hover ? null : i)}
          />
        ))}
      </svg>
      {hover !== null && series[hover] && (
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-100 tabular-nums pointer-events-none"
          data-testid="bankroll-chart-tooltip"
        >
          {new Date(series[hover].t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' · '}
          <span className={series[hover].cumulative >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {series[hover].cumulative >= 0 ? '+' : ''}${series[hover].cumulative.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

export default BankrollChart;
