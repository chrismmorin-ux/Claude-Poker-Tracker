import React, { useMemo, useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import {
  computeSummary,
  groupByStake,
  groupByVenue,
  buildBankrollSeries,
} from '../../../utils/sessionStats/sessionAnalytics';
import { BankrollChart } from './BankrollChart';

/** Signed currency, e.g. +$150.00 / -$80.00 / $0.00 */
const money = (n) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`;
const pnlClass = (n) => (n > 0 ? 'text-emerald-400' : n < 0 ? 'text-red-400' : 'text-gray-300');

/** Compact hours, e.g. 4.2h */
const hours = (ms) => `${(ms / 3600000).toFixed(1)}h`;

const StatTile = ({ label, value, valueClass = 'text-gray-100', sub }) => (
  <div className="bg-gray-900/50 rounded-lg px-3 py-2 min-w-0">
    <div className="text-[0.6875rem] uppercase tracking-wide text-gray-500 truncate">{label}</div>
    <div className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</div>
    {sub && <div className="text-[0.6875rem] text-gray-500 tabular-nums truncate">{sub}</div>}
  </div>
);

const BreakdownTable = ({ title, rows, emptyLabel }) => (
  <div className="bg-gray-900/40 rounded-lg p-3">
    <div className="text-xs font-semibold text-gray-400 mb-2">{title}</div>
    {rows.length === 0 ? (
      <div className="text-xs text-gray-600 italic">{emptyLabel}</div>
    ) : (
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-gray-300 truncate">{r.key}</span>
            <span className="flex items-center gap-2 flex-shrink-0 tabular-nums">
              <span className="text-[0.6875rem] text-gray-500">{r.count}×</span>
              {r.hourlyRate !== null && (
                <span className="text-[0.6875rem] text-gray-500">{money(r.hourlyRate)}/h</span>
              )}
              <span className={`font-medium ${pnlClass(r.pnl)}`}>{money(r.pnl)}</span>
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

/**
 * InsightsBand — at-a-glance performance summary for the Sessions view.
 *
 * Phase 2 — Sessions View Improvement (2026-06-06). Pure read over the same
 * (already-filtered) session list the page shows, so its stats scope with the
 * Live/Online/All filter. Folds in the former bottom-left lifetime Bankroll
 * widget (net P&L tile). Collapsible; collapse state persists to localStorage.
 *
 * @param {Object} props
 * @param {Array<Object>} props.sessions — past sessions in the current scope.
 * @param {string} [props.scopeLabel] — e.g. "Live", "Online", "All".
 */
export const InsightsBand = ({ sessions = [], scopeLabel }) => {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sessionsView.insightsCollapsed') === '1';
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sessionsView.insightsCollapsed', next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  const summary = useMemo(() => computeSummary(sessions), [sessions]);
  const byStake = useMemo(() => groupByStake(sessions), [sessions]);
  const byVenue = useMemo(() => groupByVenue(sessions), [sessions]);
  const series = useMemo(() => buildBankrollSeries(sessions), [sessions]);

  // Nothing to summarize until there's at least one completed session.
  if (summary.completedCount === 0) return null;

  return (
    <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg" data-testid="insights-band">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="w-full flex items-center justify-between p-4 min-h-[44px]"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-blue-400" />
          <h2 className="text-lg font-bold text-gray-200">Insights</h2>
          {scopeLabel && (
            <span className="text-xs text-gray-500">· {scopeLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold tabular-nums ${pnlClass(summary.totalPnl)}`}>
            {money(summary.totalPnl)}
          </span>
          {collapsed ? (
            <ChevronDown size={18} className="text-gray-400" />
          ) : (
            <ChevronUp size={18} className="text-gray-400" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <StatTile
              label="Net P&L"
              value={money(summary.totalPnl)}
              valueClass={pnlClass(summary.totalPnl)}
              sub={`${summary.completedCount} session${summary.completedCount === 1 ? '' : 's'}`}
            />
            <StatTile
              label="Per hour"
              value={summary.hourlyRate === null ? '—' : `${money(summary.hourlyRate)}`}
              valueClass={summary.hourlyRate === null ? 'text-gray-500' : pnlClass(summary.hourlyRate)}
              sub={hours(summary.totalDurationMs)}
            />
            <StatTile
              label="Win rate"
              value={summary.winRate === null ? '—' : `${Math.round(summary.winRate * 100)}%`}
              sub={`${summary.winningCount}W · ${summary.losingCount}L`}
            />
            <StatTile
              label="Hands"
              value={summary.totalHands.toLocaleString()}
              sub={summary.avgDurationMs ? `avg ${hours(summary.avgDurationMs)}` : undefined}
            />
            <StatTile
              label="Best"
              value={summary.best ? money(summary.best.pnl) : '—'}
              valueClass={summary.best ? pnlClass(summary.best.pnl) : 'text-gray-500'}
              sub={summary.best?.session?.venue || undefined}
            />
            <StatTile
              label="Worst"
              value={summary.worst ? money(summary.worst.pnl) : '—'}
              valueClass={summary.worst ? pnlClass(summary.worst.pnl) : 'text-gray-500'}
              sub={summary.worst?.session?.venue || undefined}
            />
          </div>

          {/* Bankroll trend */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-400 mb-2">Bankroll over time</div>
            <BankrollChart series={series} />
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <BreakdownTable title="By stake" rows={byStake} emptyLabel="No completed sessions" />
            <BreakdownTable title="By venue" rows={byVenue} emptyLabel="No completed sessions" />
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightsBand;
