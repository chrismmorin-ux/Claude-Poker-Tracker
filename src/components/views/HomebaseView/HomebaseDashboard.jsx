import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Clock, Sparkles, ChevronRight } from 'lucide-react';
import { useSession, useAuth } from '../../../contexts';
import { useSelfCoachMastery } from '../../../hooks/useSelfCoachMastery';
import { InsightsBand } from '../SessionsView/InsightsBand';
import {
  computeSummary,
  isCompletedSession,
  computeSessionPnl,
  computeSessionDurationMs,
} from '../../../utils/sessionStats/sessionAnalytics';
import { getLastVisit, stampVisit } from '../../../utils/lastVisit';
import { WHATS_NEW } from '../../../constants/whatsNew';
import { SCREEN } from '../../../constants/uiConstants';

// A returning player is one who's been away at least this long — short of this,
// they're a frequent user and the re-orientation band would be noise.
const RETURNING_GAP_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const money = (n) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`;
const pnlClass = (n) => (n > 0 ? 'text-emerald-400' : n < 0 ? 'text-red-400' : 'text-gray-300');
const fmtHours = (ms) => `${(ms / 3600000).toFixed(1)}h`;
const fmtDur = (ms) => {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};
const fmtDate = (ts) => {
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

const Card = ({ children, onClick, testid }) => {
  const cls =
    'bg-gray-800 border border-gray-700 rounded-lg p-4 ' +
    (onClick ? 'w-full text-left hover:border-gray-500 transition-colors' : '');
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} data-testid={testid}>
      {children}
    </button>
  ) : (
    <div className={cls} data-testid={testid}>
      {children}
    </div>
  );
};

const SkeletonRow = ({ w = 'w-full' }) => (
  <div className={`h-4 rounded bg-gray-700/60 animate-pulse ${w}`} />
);

/**
 * HomebaseDashboard — the at-a-glance results dashboard on the Home screen.
 * Plan shimmying-moseying-lantern, Phase D. Assembled from existing parts:
 *  - InsightsBand (win-rate / $-hr / bankroll chart / breakdowns) — reused as-is.
 *  - A compact recent-sessions list.
 *  - A study-queue card (open work from the skill-assessment system).
 *  - A "since your last visit" band for the Lapsed Returner persona.
 *
 * Data streams in behind skeletons so the Home screen paints instantly (the
 * launcher tiles render immediately in HomebaseView; this band fills in after).
 */
export const HomebaseDashboard = ({ onNavigate }) => {
  const { allSessions, loadAllSessions, isLoading } = useSession();
  const { userId } = useAuth();
  const coach = useSelfCoachMastery(userId);

  // Capture the prior visit ONCE (before we stamp the new one), then stamp.
  const priorVisit = useRef(getLastVisit()).current;
  useEffect(() => {
    stampVisit({ whatsNewId: WHATS_NEW[0]?.id });
  }, []);

  // Load sessions once on mount; the provider threads the auth userId already.
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    Promise.resolve(loadAllSessions?.()).finally(() => setRequested(true));
  }, [loadAllSessions]);

  const sessions = useMemo(() => allSessions || [], [allSessions]);
  const loading = isLoading || !requested;

  const recent = useMemo(
    () =>
      sessions
        .filter(isCompletedSession)
        .sort((a, b) => (b.startTime || 0) - (a.startTime || 0))
        .slice(0, 5),
    [sessions]
  );

  // Open study work — concepts the skill system flags as needing attention.
  const openWork = useMemo(
    () => (coach.composites || []).filter((c) => c.compositeScore > 0).length,
    [coach.composites]
  );

  // "Since your last visit" — only for a genuinely returning player.
  const sinceLastVisit = useMemo(() => {
    const since = priorVisit.lastVisitAt;
    const returning = since && Date.now() - since > RETURNING_GAP_MS;
    if (!returning) return null;
    const away = sessions.filter((s) => isCompletedSession(s) && (s.endTime || 0) > since);
    const awaySummary = computeSummary(away);
    const seenIdx = WHATS_NEW.findIndex((w) => w.id === priorVisit.lastSeenWhatsNewId);
    const freshWhatsNew = seenIdx === -1 ? WHATS_NEW : WHATS_NEW.slice(0, seenIdx);
    if (awaySummary.completedCount === 0 && freshWhatsNew.length === 0) return null;
    return { since, awaySummary, freshWhatsNew };
  }, [priorVisit, sessions]);

  return (
    <div className="flex flex-col gap-4" data-testid="homebase-dashboard">
      {/* Since your last visit — re-orientation for the returning player */}
      {sinceLastVisit && (
        <Card testid="since-last-visit">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={18} className="text-amber-400" />
            <h2 className="text-lg font-bold text-gray-200">
              Since your last visit
            </h2>
            <span className="text-xs text-gray-500">· {fmtDate(sinceLastVisit.since)}</span>
          </div>

          {sinceLastVisit.awaySummary.completedCount > 0 && (
            <div className="mb-3 text-sm text-gray-300">
              You played{' '}
              <span className="font-semibold text-gray-100">
                {sinceLastVisit.awaySummary.completedCount}
              </span>{' '}
              session{sinceLastVisit.awaySummary.completedCount === 1 ? '' : 's'} —{' '}
              <span className={`font-semibold ${pnlClass(sinceLastVisit.awaySummary.totalPnl)}`}>
                {money(sinceLastVisit.awaySummary.totalPnl)}
              </span>
              {sinceLastVisit.awaySummary.winRate !== null && (
                <> · {Math.round(sinceLastVisit.awaySummary.winRate * 100)}% win rate</>
              )}{' '}
              · {sinceLastVisit.awaySummary.totalHands.toLocaleString()} hands.
            </div>
          )}

          {sinceLastVisit.freshWhatsNew.length > 0 && (
            <div className="border-t border-gray-700 pt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                New in the app
              </div>
              <ul className="flex flex-col gap-2">
                {sinceLastVisit.freshWhatsNew.map((w) => (
                  <li key={w.id} className="text-sm">
                    <span className="font-semibold text-gray-100">{w.title}</span>
                    <span className="text-gray-400"> — {w.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Results dashboard (win-rate, $/hr, bankroll chart, breakdowns) */}
      {loading ? (
        <Card testid="dashboard-skeleton">
          <div className="flex flex-col gap-3">
            <SkeletonRow w="w-40" />
            <div className="grid grid-cols-3 gap-2">
              <SkeletonRow /><SkeletonRow /><SkeletonRow />
            </div>
            <SkeletonRow w="w-full" />
          </div>
        </Card>
      ) : (
        <>
          <InsightsBand sessions={sessions} scopeLabel="All" />

          {/* Recent sessions */}
          {recent.length > 0 && (
            <Card testid="recent-sessions">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={18} className="text-blue-400" />
                <h2 className="text-lg font-bold text-gray-200">Recent sessions</h2>
              </div>
              <div className="flex flex-col divide-y divide-gray-700/60">
                {recent.map((s) => {
                  const pnl = computeSessionPnl(s);
                  return (
                    <div key={s.sessionId} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-gray-300 truncate">
                        {fmtDate(s.startTime)} · {s.venue || '—'} {s.gameType ? `· ${s.gameType}` : ''}
                      </span>
                      <span className="flex items-center gap-3 flex-shrink-0 tabular-nums text-gray-400">
                        <span>{fmtDur(computeSessionDurationMs(s))}</span>
                        <span>{(s.handCount || 0)}h</span>
                        {pnl !== null && (
                          <span className={`font-semibold ${pnlClass(pnl)}`}>{money(pnl)}</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Empty state — no sessions yet */}
          {recent.length === 0 && (
            <Card testid="dashboard-empty">
              <div className="text-sm text-gray-400">
                No completed sessions yet. Start a live session or import online hands to see your dashboard here.
              </div>
            </Card>
          )}
        </>
      )}

      {/* Study queue */}
      <Card onClick={() => onNavigate?.(SCREEN.SELF_COACH)} testid="study-queue">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-violet-400" />
            <span className="text-base font-semibold text-gray-200">Study queue</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            {coach.loading ? (
              <span className="text-gray-500">Loading…</span>
            ) : openWork > 0 ? (
              <span className="text-violet-300 font-semibold">
                {openWork} concept{openWork === 1 ? '' : 's'} to work on
              </span>
            ) : (
              <span className="text-gray-500">Nothing flagged — nice</span>
            )}
            <ChevronRight size={16} />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default HomebaseDashboard;
