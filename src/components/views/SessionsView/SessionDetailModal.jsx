import React, { useEffect, useState } from 'react';
import { Clock, Target, StickyNote, Trophy, X } from 'lucide-react';
import { formatTime12Hour, calculateTotalRebuy, ordinalSuffix } from '../../../utils/displayUtils';
import { computeSessionPnl, computeSessionDurationMs } from '../../../utils/sessionStats/sessionAnalytics';
import { getHandsBySessionId } from '../../../utils/persistence/index';
import { logger } from '../../../utils/errorHandler';

const money = (n) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`;
const pnlClass = (n) => (n > 0 ? 'text-emerald-400' : n < 0 ? 'text-red-400' : 'text-gray-300');

const formatDuration = (ms) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const formatDate = (ts) =>
  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const Stat = ({ label, value, valueClass = 'text-gray-100' }) => (
  <div className="bg-gray-900/50 rounded-lg px-3 py-2">
    <div className="text-[0.6875rem] uppercase tracking-wide text-gray-500">{label}</div>
    <div className={`text-base font-bold tabular-nums ${valueClass}`}>{value}</div>
  </div>
);

/**
 * SessionDetailModal — full drill-down for a single past session.
 *
 * Phase 3 — Sessions View Improvement (2026-06-06). Shows complete stats, the
 * venue note, goal/notes, the rebuy timeline, and the session's hands (lazy-
 * loaded), each of which opens in HandReplayView. Responsive/portrait-friendly.
 *
 * @param {Object} props
 * @param {Object} props.session
 * @param {string} [props.venueNote]
 * @param {Function} props.onClose
 * @param {Function} props.onOpenHand — (handId, hand) => void
 */
export const SessionDetailModal = ({ session, venueNote = '', onClose, onOpenHand }) => {
  const [hands, setHands] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getHandsBySessionId(session.sessionId);
        if (!cancelled) setHands(Array.isArray(loaded) ? loaded : []);
      } catch (error) {
        logger.error('SessionDetailModal', error);
        if (!cancelled) setHands([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session.sessionId]);

  const isTournament = session.gameType === 'Tournament';
  const totalRebuys = calculateTotalRebuy(session.rebuyTransactions);
  const pnl = computeSessionPnl(session);
  const durationMs = computeSessionDurationMs(session);
  const rebuys = Array.isArray(session.rebuyTransactions) ? session.rebuyTransactions : [];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      data-testid="session-detail-modal"
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-full max-w-lg max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start gap-3 p-5 border-b border-gray-700">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">
              {formatDate(session.startTime)} · {session.venue || 'No venue'} · {session.gameType}
            </h2>
            <div className="text-xs text-gray-400 mt-0.5">
              {formatTime12Hour(session.startTime)}
              {session.source === 'ignition' && (
                <span className="ml-2 px-2 py-0.5 rounded bg-emerald-800 text-emerald-300 font-bold">Online</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-2 -mr-2 -mt-2"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Venue note */}
          {venueNote && (
            <div className="flex items-start gap-2 text-sm text-gray-400 italic bg-gray-900/40 rounded-lg p-3">
              <StickyNote size={15} className="mt-0.5 flex-shrink-0 text-gray-500" />
              <span className="whitespace-pre-wrap">{venueNote}</span>
            </div>
          )}

          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat label="P&L" value={pnl === null ? '—' : money(pnl)} valueClass={pnl === null ? 'text-gray-500' : pnlClass(pnl)} />
            <Stat label="Duration" value={formatDuration(durationMs)} />
            <Stat label="Hands" value={(session.handCount ?? 0).toLocaleString()} />
            {session.buyIn != null && <Stat label="Buy-in" value={`$${session.buyIn}`} />}
            {totalRebuys > 0 && <Stat label="Rebuys" value={`$${totalRebuys}`} />}
            {session.cashOut != null && <Stat label="Cash out" value={`$${session.cashOut}`} />}
            {session.tipAmount > 0 && <Stat label="Tip" value={`$${session.tipAmount}`} />}
          </div>

          {/* Tournament info */}
          {isTournament && (session.tournamentFinishPosition || session.tournamentPayout != null) && (
            <div className="flex items-center gap-4 text-sm text-gray-300 bg-gray-900/40 rounded-lg p-3">
              {session.tournamentFinishPosition && (
                <span className="flex items-center gap-1">
                  <Trophy size={15} className="text-yellow-400" />
                  {session.tournamentFinishPosition}{ordinalSuffix(session.tournamentFinishPosition)}
                  {session.tournamentTotalEntrants && ` / ${session.tournamentTotalEntrants}`}
                </span>
              )}
              {session.tournamentPayout != null && <span>Payout: ${session.tournamentPayout}</span>}
            </div>
          )}

          {/* Goal */}
          {session.goal && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Target size={15} className="text-gray-500" />
              {session.goal}
            </div>
          )}

          {/* Notes */}
          {session.notes && (
            <div className="text-sm text-gray-300 bg-gray-900/40 rounded-lg p-3 whitespace-pre-wrap">
              {session.notes}
            </div>
          )}

          {/* Rebuy timeline */}
          {rebuys.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-2">Rebuys</div>
              <div className="flex flex-col gap-1">
                {rebuys.map((tx, i) => (
                  <div key={i} className="flex justify-between text-sm text-gray-300 tabular-nums">
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-gray-500" />
                      {tx.timestamp ? formatTime12Hour(tx.timestamp) : `Rebuy ${i + 1}`}
                    </span>
                    <span>${tx.amount || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hands */}
          <div>
            <div className="text-xs font-semibold text-gray-400 mb-2">
              Hands{hands ? ` (${hands.length})` : ''}
            </div>
            {loading ? (
              <div className="text-sm text-gray-500">Loading hands…</div>
            ) : hands && hands.length > 0 ? (
              <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                {hands.map((hand) => (
                  <button
                    key={hand.handId}
                    onClick={() => onOpenHand(hand.handId, hand)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-gray-900/40 hover:bg-gray-700/60 transition-colors text-sm text-gray-200"
                    data-testid="session-detail-hand-row"
                  >
                    {hand.handDisplayId || `Hand ${hand.handId}`}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600 italic">No hands recorded for this session.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDetailModal;
