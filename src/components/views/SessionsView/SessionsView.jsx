/**
 * SessionsView.jsx - Sessions management view
 *
 * Displays current active session and all past sessions.
 * Allows creating, ending, editing, and deleting sessions.
 */

import React, { useState, useEffect, useRef } from 'react';
import { logger } from '../../../utils/errorHandler';
import { Play, Square, Download, Upload, PlayCircle, Calendar, Wifi } from 'lucide-react';
import { SessionForm } from '../../ui/SessionForm';
import { SessionRowWithRollup } from './SessionRowWithRollup';
import {
  matchesSessionsFilter,
  sortSessions,
  searchSessions,
  groupSessionsByMonth,
} from '../../../utils/sessionsFilter';
import { GAME_TYPES } from '../../../constants/sessionConstants';
import { downloadBackup, readJsonFile, validateImportData, importAllData } from '../../../utils/exportUtils';
import { ActiveSessionCard } from './ActiveSessionCard';
import { CashOutModal } from './CashOutModal';
import { ImportConfirmModal } from './ImportConfirmModal';
import { InsightsBand } from './InsightsBand';
import { SessionDetailModal } from './SessionDetailModal';
import { ReviewQueuePanel } from './ReviewQueuePanel';
import { useToast } from '../../../contexts/ToastContext';
import { useSession, useUI, useTournament, useSyncBridge, useSettings, useAuth } from '../../../contexts';
import { useGameHandlers } from '../../../hooks/useGameHandlers';
import { ENABLE_PRESESSION_DRILL } from '../PresessionDrillView';

/**
 * SessionsView component
 */
export const SessionsView = ({ scale }) => {
  const { showSuccess, showError, addToast } = useToast();
  const { userId } = useAuth(); // export under the signed-in account, not 'guest' (data-isolation fix)

  // AUDIT-2026-04-21-SV F1: unified destructive-action undo duration (matches TableView F5)
  const UNDO_TOAST_DURATION_MS = 12000;

  // AUDIT-2026-04-21-SV F7: Live/Online/All filter for past-sessions list.
  // Persists to localStorage so the filter choice survives navigation.
  const [pastSessionFilter, setPastSessionFilter] = useState(() => {
    try {
      return localStorage.getItem('sessionsView.pastFilter') || 'all';
    } catch { return 'all'; }
  });
  const handleSetPastSessionFilter = (next) => {
    setPastSessionFilter(next);
    try { localStorage.setItem('sessionsView.pastFilter', next); } catch {}
  };

  // Phase 3 (2026-06-06): past-sessions sort / search / month-grouping +
  // session-detail drill-down. Sort + grouping persist like the filter above.
  const [sortKey, setSortKey] = useState(() => {
    try { return localStorage.getItem('sessionsView.sortKey') || 'date'; } catch { return 'date'; }
  });
  const handleSetSortKey = (next) => {
    setSortKey(next);
    try { localStorage.setItem('sessionsView.sortKey', next); } catch {}
  };
  const [groupByMonth, setGroupByMonth] = useState(() => {
    try { return localStorage.getItem('sessionsView.groupByMonth') === '1'; } catch { return false; }
  });
  const handleToggleGroupByMonth = () => {
    setGroupByMonth((prev) => {
      const next = !prev;
      try { localStorage.setItem('sessionsView.groupByMonth', next ? '1' : '0'); } catch {}
      return next;
    });
  };
  const [sessionSearch, setSessionSearch] = useState('');
  const [detailSession, setDetailSession] = useState(null);

  // AUDIT-2026-04-21-SV F1: deferred-delete pattern for Delete Session toast+undo.
  // Tracks { sessionId → timeout, snapshot } while the undo window is open.
  const pendingDeletesRef = useRef(new Map());
  const { setCurrentScreen, SCREEN, autoOpenNewSession, setAutoOpenNewSession, setReplayHand } = useUI();
  const { resetHand: resetTableState } = useGameHandlers();
  const { initTournament, createNewTournament } = useTournament();
  const {
    currentSession,
    allSessions: sessionAllSessions,
    dispatchSession,
    startNewSession,
    endCurrentSession,
    updateSessionField,
    loadAllSessions,
    deleteSessionById,
  } = useSession();

  // Build sessionState-like object for compatibility
  const sessionState = { currentSession, allSessions: sessionAllSessions };

  // Online play sync
  const { isExtensionConnected, importedCount } = useSyncBridge();
  // Venue notes — Phase 1 Sessions View Improvement (2026-06-06). Looked up per
  // past-session row and threaded into SessionCard via SessionRowWithRollup.
  const { getVenueNote } = useSettings();
  // Local UI state
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState('');
  // AUDIT-2026-04-21-SV F2: optional tip field captured at cash-out.
  const [tipAmount, setTipAmount] = useState('');

  // Import/Export state
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);

  // Load all sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      const allSessions = await loadAllSessions();
      const sorted = allSessions.sort((a, b) => b.startTime - a.startTime);
      setSessions(sorted);
    };
    loadSessions();
  }, [loadAllSessions]);

  // AUDIT-2026-04-21-SV F1: on unmount, commit any pending deletes immediately.
  // Navigating away counts as "user did not undo" — the delete was intended.
  useEffect(() => {
    const pendingMap = pendingDeletesRef.current;
    return () => {
      pendingMap.forEach((pending, sessionId) => {
        clearTimeout(pending.timeoutId);
        // Fire and forget — component is unmounting; can't surface errors via toast.
        deleteSessionById(sessionId).catch(err => logger.error('SessionsView unmount delete', err));
      });
      pendingMap.clear();
    };
  }, [deleteSessionById]);

  // Auto-open new session form when navigating from TableView
  useEffect(() => {
    if (autoOpenNewSession) {
      setShowNewSessionForm(true);
      setAutoOpenNewSession(false);
    }
  }, [autoOpenNewSession, setAutoOpenNewSession]);

  // Handle new session submission
  const handleNewSession = async (sessionData, tournamentConfig) => {
    try {
      const sessionId = await startNewSession(sessionData);
      if (tournamentConfig) {
        initTournament(tournamentConfig);
        await createNewTournament(tournamentConfig, sessionId);
      }
      setShowNewSessionForm(false);
      if (resetTableState) {
        resetTableState();
      }
      setCurrentScreen(SCREEN.TABLE);
    } catch (error) {
      logger.error('SessionsView', error);
    }
  };

  // Handle end session - show cash out modal
  const handleEndSession = () => {
    setShowCashOutModal(true);
    setCashOutAmount('');
    setTipAmount('');
  };

  // Handle confirm cash out and end session.
  // AUDIT-2026-04-21-SV F2: thread tip amount into endCurrentSession so the
  // session record stores it + BankrollDisplay subtracts it from lifetime P&L.
  const handleConfirmCashOut = async () => {
    try {
      const cashOut = cashOutAmount ? parseFloat(cashOutAmount) : null;
      const tip = tipAmount ? parseFloat(tipAmount) : null;
      await endCurrentSession(cashOut, tip);
      const allSessions = await loadAllSessions();
      const sorted = allSessions.sort((a, b) => b.startTime - a.startTime);
      setSessions(sorted);
      setShowCashOutModal(false);
      setCashOutAmount('');
      setTipAmount('');
      showSuccess('Session ended');
    } catch (error) {
      logger.error('SessionsView', error);
      showError('Failed to end session');
    }
  };

  // Handle delete session.
  // AUDIT-2026-04-21-SV F1: replaced window.confirm+immediate-delete with a deferred-delete
  // toast+undo pattern. Mirrors the approach used in TableView Reset Hand / Next Hand:
  //   1. Snapshot the session record.
  //   2. Remove it from the visible list immediately (optimistic UI).
  //   3. Show a warning toast with an Undo action (12s).
  //   4. If Undo fires → restore the record into local state; IDB is never touched.
  //   5. If the toast auto-dismisses without Undo → commit the IDB delete.
  // Rationale: mid-hand-chris and ringmaster-in-hand surface contracts explicitly forbid
  // native browser confirm dialogs on any primary surface; SessionsView is primary for
  // post-session-chris and between-hands-chris. No IDB schema change needed.
  const handleDeleteSession = async (sessionId) => {
    const snapshot = sessions.find(s => s.sessionId === sessionId);
    if (!snapshot) return;

    // Optimistic removal from visible list.
    setSessions(prev => prev.filter(s => s.sessionId !== sessionId));

    // Schedule the real IDB delete after the undo window closes.
    const timeoutId = setTimeout(async () => {
      pendingDeletesRef.current.delete(sessionId);
      try {
        await deleteSessionById(sessionId);
      } catch (error) {
        logger.error('SessionsView', error);
        // On failure, try to restore to the visible list so state isn't lost silently.
        setSessions(prev => {
          if (prev.some(s => s.sessionId === sessionId)) return prev;
          return [...prev, snapshot].sort((a, b) => b.startTime - a.startTime);
        });
        showError('Failed to delete session');
      }
    }, UNDO_TOAST_DURATION_MS);

    pendingDeletesRef.current.set(sessionId, { timeoutId, snapshot });

    const handCount = snapshot.handCount ?? 0;
    addToast(`Session deleted${handCount ? ` (${handCount} hand${handCount === 1 ? '' : 's'})` : ''}`, {
      variant: 'warning',
      duration: UNDO_TOAST_DURATION_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          const pending = pendingDeletesRef.current.get(sessionId);
          if (!pending) return;
          clearTimeout(pending.timeoutId);
          pendingDeletesRef.current.delete(sessionId);
          setSessions(prev => {
            if (prev.some(s => s.sessionId === sessionId)) return prev;
            return [...prev, pending.snapshot].sort((a, b) => b.startTime - a.startTime);
          });
          showSuccess('Session restored');
        },
      },
    });
  };

  // Handle export
  const handleExport = async () => {
    try {
      await downloadBackup(userId);
      showSuccess('Backup exported');
      setImportStatus({ success: true, message: 'Backup downloaded successfully!' });
      setTimeout(() => setImportStatus(null), 3000);
    } catch (error) {
      showError('Export failed');
      setImportStatus({ success: false, message: 'Failed to export data: ' + error.message });
    }
  };

  // Handle file selection for import
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const data = await readJsonFile(file);
      const validation = validateImportData(data);

      if (!validation.valid) {
        setImportStatus({ success: false, message: 'Invalid backup file: ' + validation.errors.join(', ') });
        return;
      }

      setImportData(data);
      setShowImportConfirm(true);
    } catch (error) {
      setImportStatus({ success: false, message: 'Failed to read file: ' + error.message });
    }

    event.target.value = '';
  };

  // Handle import confirmation
  const handleConfirmImport = async () => {
    if (!importData) return;

    try {
      const result = await importAllData(importData);

      if (result.success) {
        showSuccess(`Imported ${result.counts.hands} hands, ${result.counts.sessions} sessions, ${result.counts.players} players`);
        setImportStatus({
          success: true,
          message: `Imported ${result.counts.hands} hands, ${result.counts.sessions} sessions, ${result.counts.players} players`
        });
        const allSessions = await loadAllSessions();
        const sorted = allSessions.sort((a, b) => b.startTime - a.startTime);
        setSessions(sorted);
      } else {
        showError('Import completed with errors');
        setImportStatus({ success: false, message: 'Import completed with errors: ' + result.errors.join(', ') });
      }
    } catch (error) {
      showError('Import failed');
      setImportStatus({ success: false, message: 'Import failed: ' + error.message });
    }

    setShowImportConfirm(false);
    setImportData(null);
  };

  // Phase 2 (Sessions View Improvement, 2026-06-06): lifetime-bankroll math
  // moved into the InsightsBand (sessionAnalytics.computeSummary), which also
  // surfaces $/hr, win-rate, breakdowns, and the bankroll trend. The former
  // bottom-left BankrollDisplay widget is folded into that band.

  // Past sessions in the current Live/Online/All scope — shared by the Insights
  // band and the row list so both reflect the same filter. (Insights reflects the
  // mode scope only; text search/sort below shape the row list, not the stats.)
  const visiblePastSessions = sessions
    .filter((s) => !s.isActive)
    .filter((s) => matchesSessionsFilter(s, pastSessionFilter));

  const insightsScopeLabel =
    pastSessionFilter === 'live' ? 'Live' : pastSessionFilter === 'online' ? 'Online' : null;

  // Phase 3: the row list = scope → text search → sort. Month grouping (if on)
  // buckets the already-sorted list.
  const displayedSessions = sortSessions(
    searchSessions(visiblePastSessions, sessionSearch),
    sortKey,
    'desc'
  );
  const sessionGroups = groupByMonth ? groupSessionsByMonth(displayedSessions) : null;

  const renderSessionRow = (session) => (
    <SessionRowWithRollup
      key={session.sessionId}
      session={session}
      onDelete={handleDeleteSession}
      venueNote={getVenueNote(session.venue)}
      onShowDetails={setDetailSession}
    />
  );

  // WS-190: open a tagged hand from the Review Queue in HandReplayView.
  // Mirrors HandReviewPanel's replay-open pattern (set hand, then switch screen).
  const handleOpenTaggedHand = (handId, hand) => {
    setReplayHand(handId, hand || null);
    setCurrentScreen(SCREEN.HAND_REPLAY);
  };

  return (
    <div className="h-dvh bg-gray-900 overflow-y-auto">
      {/* Portrait-native fluid layout (2026-06-06): no 1600×720 ScaledContainer
          so every field stays legible/tappable on a phone. Capped width keeps
          lines readable on wide screens. */}
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-10">
          {/* Header */}
          <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
            <h1 className="text-2xl font-bold text-white">Sessions</h1>
            <div className="flex flex-wrap gap-2">
              {sessionState.currentSession.isActive ? (
                <button
                  onClick={handleEndSession}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <Square size={18} />
                  End Session
                </button>
              ) : (
                <button
                  onClick={() => setShowNewSessionForm(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <Play size={18} />
                  New Session
                </button>
              )}
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
              >
                <Download size={18} />
                Export
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 font-medium"
              >
                <Upload size={18} />
                Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => setCurrentScreen(SCREEN.TABLE)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Back to Table
              </button>
            </div>
          </div>

          {/* Import/Export Status */}
          {importStatus && (
            <div className={`mb-4 p-4 rounded-lg ${importStatus.success ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
              {importStatus.message}
              <button
                onClick={() => setImportStatus(null)}
                className="ml-4 text-sm underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Current Session */}
          <ActiveSessionCard
            currentSession={sessionState.currentSession}
            onEndSession={handleEndSession}
            onUpdateField={updateSessionField}
          />

          {/* No Active Session */}
          {!sessionState.currentSession.isActive && (
            <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-8 text-center flex flex-col items-center">
              <PlayCircle size={48} className="text-gray-600 mb-3" />
              <h2 className="text-xl font-semibold text-gray-400 mb-4">No Active Session</h2>
              <button
                onClick={() => setShowNewSessionForm(true)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 mx-auto font-medium"
              >
                <Play size={18} />
                New Session
              </button>
            </div>
          )}

          {/* Online Play Card */}
          {(isExtensionConnected || sessions.some(s => s.source === 'ignition')) && (
            <div className="mb-6 bg-gray-800 border border-emerald-800 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Wifi size={20} className="text-emerald-500" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-400">Online Play</h3>
                    <p className="text-xs text-gray-400">
                      {isExtensionConnected
                        ? `Extension connected · ${importedCount} hands captured`
                        : `${sessions.filter(s => s.source === 'ignition').length} online session(s) recorded`
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentScreen(SCREEN.ONLINE)}
                  className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
                >
                  {isExtensionConnected ? 'View Live Table' : 'View Online Sessions'}
                </button>
              </div>
            </div>
          )}

          {/* Insights band — at-a-glance performance summary (Phase 2). Scopes
              with the Live/Online/All filter; renders only when ≥1 completed
              session exists. Folds in the former bottom-left bankroll widget. */}
          <InsightsBand sessions={visiblePastSessions} scopeLabel={insightsScopeLabel} />

          {/* Review Queue — tagged hands (WS-190). Renders only when ≥1 hand is tagged. */}
          <ReviewQueuePanel onOpenHand={handleOpenTaggedHand} />

          {/* Past Sessions */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg">
            <div className="p-4 border-b border-gray-700">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                <h2 className="text-lg font-bold text-gray-200">Past Sessions</h2>
                {/* AUDIT-2026-04-21-SV F7: Live/Online filter pills. Persist to
                    localStorage. Only shown when online (ignition) sessions exist. */}
                {(() => {
                  const pastSessions = sessions.filter(s => !s.isActive);
                  const onlineCount = pastSessions.filter(s => s.source === 'ignition').length;
                  const liveCount = pastSessions.length - onlineCount;
                  if (pastSessions.length === 0 || onlineCount === 0) return null;
                  const pills = [
                    { id: 'all', label: `All (${pastSessions.length})` },
                    { id: 'live', label: `Live (${liveCount})` },
                    { id: 'online', label: `Online (${onlineCount})` },
                  ];
                  return (
                    <div className="flex gap-1">
                      {pills.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleSetPastSessionFilter(p.id)}
                          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                            pastSessionFilter === p.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Phase 3 (2026-06-06): search + sort + month grouping. Only shown
                  when there are past sessions to act on. */}
              {sessions.filter((s) => !s.isActive).length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    placeholder="Search venue, stake, goal…"
                    className="flex-1 min-w-[160px] px-3 min-h-[44px] bg-gray-700 text-gray-200 text-sm rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    data-testid="sessions-search"
                  />
                  <select
                    value={sortKey}
                    onChange={(e) => handleSetSortKey(e.target.value)}
                    className="px-3 min-h-[44px] bg-gray-700 text-gray-200 text-sm rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    data-testid="sessions-sort"
                    aria-label="Sort sessions"
                  >
                    <option value="date">Newest first</option>
                    <option value="profit">Biggest win</option>
                    <option value="duration">Longest</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleToggleGroupByMonth}
                    aria-pressed={groupByMonth}
                    className={`px-3 min-h-[44px] text-sm font-medium rounded-lg transition-colors ${
                      groupByMonth ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    data-testid="sessions-group-toggle"
                  >
                    By month
                  </button>
                </div>
              )}
            </div>

            <div className="divide-y divide-gray-700">
              {sessionGroups
                ? sessionGroups.map((group) => (
                    <div key={group.key}>
                      <div className="px-4 py-2 bg-gray-900/40 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {group.label} · {group.sessions.length}
                      </div>
                      {group.sessions.map(renderSessionRow)}
                    </div>
                  ))
                : displayedSessions.map(renderSessionRow)}

              {sessions.filter((s) => !s.isActive).length === 0 && (
                <div className="p-8 text-center flex flex-col items-center">
                  <Calendar size={48} className="text-gray-600 mb-3" />
                  <div className="text-xl font-semibold text-gray-400">No Past Sessions</div>
                  <div className="text-sm text-gray-500">Complete a session to see it here</div>
                </div>
              )}

              {sessions.filter((s) => !s.isActive).length > 0 && displayedSessions.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-500">
                  No sessions match your search.
                </div>
              )}
            </div>
          </div>

          {/* Drills — inline at the bottom of the fluid page (portrait-native).
              Full-width, wrapping CTAs; no absolute positioning to collide with
              scroll content. */}
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => setCurrentScreen(SCREEN.PREFLOP_DRILLS)}
              className="flex-1 min-w-[140px] px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg font-medium transition-colors"
              style={{ minHeight: 48 }}
            >
              Preflop Drills
            </button>
            <button
              onClick={() => setCurrentScreen(SCREEN.POSTFLOP_DRILLS)}
              className="flex-1 min-w-[140px] px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-lg font-medium transition-colors"
              style={{ minHeight: 48 }}
            >
              Postflop Drills
            </button>
            {ENABLE_PRESESSION_DRILL && (
              <button
                onClick={() => setCurrentScreen(SCREEN.PRESESSION_DRILL)}
                className="flex-1 min-w-[140px] px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-lg font-medium transition-colors"
                style={{ minHeight: 48 }}
                data-testid="sessions-view-presession-drill-cta"
              >
                Prepare for tonight
              </button>
            )}
          </div>

          {/* New Session Form Modal */}
          {showNewSessionForm && (
            <SessionForm
              onSubmit={handleNewSession}
              onCancel={() => setShowNewSessionForm(false)}
              defaultGameType={
                sessions.length > 0
                  ? Object.keys(GAME_TYPES).find(key => GAME_TYPES[key].label === sessions[0].gameType)
                  : ''
              }
              defaultVenue={sessions.length > 0 ? sessions[0].venue : ''}
            />
          )}

          {/* Import Confirmation Modal */}
          <ImportConfirmModal
            isOpen={showImportConfirm}
            importData={importData}
            onConfirm={handleConfirmImport}
            onCancel={() => { setShowImportConfirm(false); setImportData(null); }}
          />

          {/* Cash Out Modal */}
          <CashOutModal
            isOpen={showCashOutModal}
            cashOutAmount={cashOutAmount}
            onCashOutAmountChange={setCashOutAmount}
            tipAmount={tipAmount}
            onTipAmountChange={setTipAmount}
            onConfirm={handleConfirmCashOut}
            onCancel={() => {
              setShowCashOutModal(false);
              setCashOutAmount('');
              setTipAmount('');
            }}
          />

          {/* Session Detail Modal (Phase 3) */}
          {detailSession && (
            <SessionDetailModal
              session={detailSession}
              venueNote={getVenueNote(detailSession.venue)}
              onClose={() => setDetailSession(null)}
              onOpenHand={(handId, hand) => {
                setDetailSession(null);
                handleOpenTaggedHand(handId, hand);
              }}
            />
          )}
      </div>
    </div>
  );
};

