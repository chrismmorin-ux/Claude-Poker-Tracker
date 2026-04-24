/**
 * SessionsView.jsx - Sessions management view
 *
 * Displays current active session and all past sessions.
 * Allows creating, ending, editing, and deleting sessions.
 */

import React, { useState, useEffect, useRef } from 'react';
import { logger } from '../../../utils/errorHandler';
import { Play, Square, Download, Upload, PlayCircle, Calendar, Wifi } from 'lucide-react';
import { ScaledContainer } from '../../ui/ScaledContainer';
import { SessionForm } from '../../ui/SessionForm';
import { SessionCard } from '../../ui/SessionCard';
import { GAME_TYPES } from '../../../constants/sessionConstants';
import { calculateTotalRebuy } from '../../../utils/displayUtils';
import { downloadBackup, readJsonFile, validateImportData, importAllData } from '../../../utils/exportUtils';
import { ActiveSessionCard } from './ActiveSessionCard';
import { CashOutModal } from './CashOutModal';
import { ImportConfirmModal } from './ImportConfirmModal';
import { BankrollDisplay } from './BankrollDisplay';
import { useToast } from '../../../contexts/ToastContext';
import { useSession, useUI, useTournament, useSyncBridge } from '../../../contexts';
import { useGameHandlers } from '../../../hooks/useGameHandlers';
import { ENABLE_PRESESSION_DRILL } from '../PresessionDrillView';

/**
 * SessionsView component
 */
export const SessionsView = ({ scale }) => {
  const { showSuccess, showError, addToast } = useToast();

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

  // AUDIT-2026-04-21-SV F1: deferred-delete pattern for Delete Session toast+undo.
  // Tracks { sessionId → timeout, snapshot } while the undo window is open.
  const pendingDeletesRef = useRef(new Map());
  const { setCurrentScreen, SCREEN, autoOpenNewSession, setAutoOpenNewSession } = useUI();
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
      await downloadBackup();
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

  // Calculate running total bankroll.
  // AUDIT-2026-04-21-SV F2: tipAmount subtracted from P&L. Prior to this, tipped
  // sessions silently overcounted lifetime bankroll by the tip amount per session.
  // Legacy sessions without `tipAmount` read as undefined → `|| 0` fallback →
  // zero deduction (backward-compatible).
  const calculateTotalBankroll = () => {
    return sessions.reduce((total, session) => {
      if (session.endTime && session.cashOut !== null && session.cashOut !== undefined) {
        const buyIn = session.buyIn || 0;
        const totalRebuys = calculateTotalRebuy(session.rebuyTransactions);
        const tip = session.tipAmount || 0;
        const profitLoss = session.cashOut - buyIn - totalRebuys - tip;
        return total + profitLoss;
      }
      return total;
    }, 0);
  };

  const totalBankroll = calculateTotalBankroll();
  const completedSessionCount = sessions.filter(s => s.endTime && s.cashOut !== null).length;

  return (
    <ScaledContainer scale={scale}>
      <div className="w-full bg-gray-900 relative" style={{ width: 1600, height: 720 }}>
        {/* Scrollable Content */}
        <div className="w-full h-full pt-8 px-8 pb-24 overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white">Sessions</h1>
            <div className="flex gap-3">
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

          {/* Past Sessions */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-200">Past Sessions</h2>
              {/* AUDIT-2026-04-21-SV F7: Live/Online filter pills.
                  In-memory filter over the past-sessions list. Previously, online
                  (ignition) sessions mixed with live sessions without grouping —
                  post-session-chris scanning live-only history had to visually
                  skip online entries. Filter persists to localStorage. */}
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

            <div className="divide-y divide-gray-700">
              {sessions
                .filter((s) => !s.isActive)
                .filter((s) => {
                  if (pastSessionFilter === 'live') return s.source !== 'ignition';
                  if (pastSessionFilter === 'online') return s.source === 'ignition';
                  return true;
                })
                .map((session) => (
                  <SessionCard
                    key={session.sessionId}
                    session={session}
                    onDelete={handleDeleteSession}
                  />
                ))}

              {sessions.filter((s) => !s.isActive).length === 0 && (
                <div className="p-8 text-center flex flex-col items-center">
                  <Calendar size={48} className="text-gray-600 mb-3" />
                  <div className="text-xl font-semibold text-gray-400">No Past Sessions</div>
                  <div className="text-sm text-gray-500">Complete a session to see it here</div>
                </div>
              )}
            </div>
          </div>

          {/* New Session Form Modal */}
          {showNewSessionForm && (
            <SessionForm
              onSubmit={handleNewSession}
              onCancel={() => setShowNewSessionForm(false)}
              scale={scale}
              defaultGameType={
                sessions.length > 0
                  ? Object.keys(GAME_TYPES).find(key => GAME_TYPES[key].label === sessions[0].gameType)
                  : ''
              }
              defaultVenue={sessions.length > 0 ? sessions[0].venue : ''}
            />
          )}
        </div>

        {/* AUDIT-2026-04-21-SV F5: bottom bar unified. Previously three independent
            absolute-positioned elements (BankrollDisplay @ bottom-8 left-8,
            Preflop Drills @ bottom-8 right-48, Postflop Drills @ bottom-8 right-8)
            risked visual collision at sub-reference scale. Single flex container
            with justify-between is collision-proof at any scale. */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between items-center px-8 pb-8 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <BankrollDisplay
              totalBankroll={totalBankroll}
              completedSessionCount={completedSessionCount}
            />
          </div>
          <div className="flex gap-3 pointer-events-auto">
            <button
              onClick={() => setCurrentScreen(SCREEN.PREFLOP_DRILLS)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg font-medium transition-colors"
            >
              Preflop Drills
            </button>
            <button
              onClick={() => setCurrentScreen(SCREEN.POSTFLOP_DRILLS)}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-lg font-medium transition-colors"
            >
              Postflop Drills
            </button>
            {ENABLE_PRESESSION_DRILL && (
              <button
                onClick={() => setCurrentScreen(SCREEN.PRESESSION_DRILL)}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-lg font-medium transition-colors"
                style={{ minHeight: 48 }}
                data-testid="sessions-view-presession-drill-cta"
              >
                Prepare for tonight
              </button>
            )}
          </div>
        </div>

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
      </div>
    </ScaledContainer>
  );
};

