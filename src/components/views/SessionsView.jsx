/**
 * SessionsView.jsx - Sessions management view
 *
 * Displays current active session and all past sessions.
 * Allows creating, ending, editing, and deleting sessions.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Download, Upload } from 'lucide-react';
import { ScaledContainer } from '../ui/ScaledContainer';
import { SessionForm } from '../ui/SessionForm';
import { SessionCard } from '../ui/SessionCard';
import { SESSION_GOALS, VENUES, GAME_TYPES, GAME_TYPE_KEYS } from '../../constants/sessionConstants';
import { formatTime12Hour, calculateTotalRebuy } from '../../utils/displayUtils';
import { downloadBackup, readJsonFile, validateImportData, importAllData } from '../../utils/exportUtils';

/**
 * SessionsView component
 * @param {Object} props
 * @param {number} props.scale - Scale factor for responsive design
 * @param {Function} props.setCurrentScreen - Navigate to different views
 * @param {Object} props.sessionState - Session state from sessionReducer
 * @param {Function} props.dispatchSession - Session dispatcher
 * @param {Function} props.startNewSession - Start new session handler
 * @param {Function} props.endCurrentSession - End current session handler
 * @param {Function} props.updateSessionField - Update session field handler
 * @param {Function} props.loadAllSessions - Load all sessions handler
 * @param {Function} props.deleteSessionById - Delete session handler
 * @param {Object} props.SCREEN - Screen constants
 * @param {boolean} props.autoOpenNewSession - If true, auto-open new session form
 * @param {Function} props.setAutoOpenNewSession - Set the auto-open flag
 */
export const SessionsView = ({
  scale,
  setCurrentScreen,
  sessionState,
  dispatchSession,
  startNewSession,
  endCurrentSession,
  updateSessionField,
  loadAllSessions,
  deleteSessionById,
  SCREEN,
  autoOpenNewSession,
  setAutoOpenNewSession
}) => {
  // Local UI state
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [editingBuyIn, setEditingBuyIn] = useState(false);
  const [editingVenue, setEditingVenue] = useState(false);
  const [editingGameType, setEditingGameType] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [addingRebuy, setAddingRebuy] = useState(false);
  const [buyInValue, setBuyInValue] = useState('');
  const [venueValue, setVenueValue] = useState('');
  const [gameTypeValue, setGameTypeValue] = useState('');
  const [goalValue, setGoalValue] = useState('');
  const [rebuyAmount, setRebuyAmount] = useState('');
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState('');

  // Import/Export state
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importStatus, setImportStatus] = useState(null); // { success, message }
  const fileInputRef = useRef(null);

  // Load all sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      const allSessions = await loadAllSessions();
      // Sort by start time descending (most recent first)
      const sorted = allSessions.sort((a, b) => b.startTime - a.startTime);
      setSessions(sorted);
    };

    loadSessions();
  }, [loadAllSessions]);

  // Auto-open new session form when navigating from TableView
  useEffect(() => {
    if (autoOpenNewSession) {
      setShowNewSessionForm(true);
      // Reset the flag so it doesn't re-open on subsequent mounts
      setAutoOpenNewSession(false);
    }
  }, [autoOpenNewSession, setAutoOpenNewSession]);

  // Handle new session submission
  const handleNewSession = async (sessionData) => {
    try {
      await startNewSession(sessionData);
      setShowNewSessionForm(false);

      // Navigate back to TableView to start entering hands
      setCurrentScreen(SCREEN.TABLE);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  // Handle end session - show cash out modal
  const handleEndSession = () => {
    setShowCashOutModal(true);
    setCashOutAmount(''); // Reset to empty
  };

  // Handle confirm cash out and end session
  const handleConfirmCashOut = async () => {
    try {
      const cashOut = cashOutAmount ? parseFloat(cashOutAmount) : null;

      // Pass cashOut to the endCurrentSession function
      await endCurrentSession(cashOut);

      // Reload sessions
      const allSessions = await loadAllSessions();
      const sorted = allSessions.sort((a, b) => b.startTime - a.startTime);
      setSessions(sorted);

      // Close modal
      setShowCashOutModal(false);
      setCashOutAmount('');
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  // Handle cancel cash out modal
  const handleCancelCashOut = () => {
    setShowCashOutModal(false);
    setCashOutAmount('');
  };

  // Handle delete session
  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm(`Delete session #${sessionId}? This cannot be undone.`)) return;

    try {
      await deleteSessionById(sessionId);

      // Reload sessions
      const allSessions = await loadAllSessions();
      const sorted = allSessions.sort((a, b) => b.startTime - a.startTime);
      setSessions(sorted);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  // Handle buy-in update
  const handleBuyInUpdate = () => {
    const parsed = parseFloat(buyInValue);
    if (!isNaN(parsed)) {
      updateSessionField('buyIn', parsed);
    }
    setEditingBuyIn(false);
  };

  // Handle goal update
  const handleGoalUpdate = () => {
    updateSessionField('goal', goalValue);
    setEditingGoal(false);
  };

  // Handle start add rebuy
  const handleStartAddRebuy = () => {
    const gameType = sessionState.currentSession.gameType;
    const defaultAmount = getDefaultRebuyAmount(gameType);
    setRebuyAmount(defaultAmount.toString());
    setAddingRebuy(true);
  };

  // Handle confirm rebuy
  const handleConfirmRebuy = () => {
    const parsedAmount = parseFloat(rebuyAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    updateSessionField('rebuyTransactions', [
      ...sessionState.currentSession.rebuyTransactions,
      { timestamp: Date.now(), amount: parsedAmount }
    ]);
    setAddingRebuy(false);
  };

  // Handle cancel rebuy
  const handleCancelRebuy = () => {
    setAddingRebuy(false);
    setRebuyAmount('');
  };

  // Helper to get default rebuy amount based on game type
  const getDefaultRebuyAmount = (gameTypeLabel) => {
    const gameType = Object.values(GAME_TYPES).find(gt => gt.label === gameTypeLabel);
    return gameType?.rebuyDefault || 200;
  };

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Handle export
  const handleExport = async () => {
    try {
      await downloadBackup();
      setImportStatus({ success: true, message: 'Backup downloaded successfully!' });
      setTimeout(() => setImportStatus(null), 3000);
    } catch (error) {
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

    // Reset file input
    event.target.value = '';
  };

  // Handle import confirmation
  const handleConfirmImport = async () => {
    if (!importData) return;

    try {
      const result = await importAllData(importData);

      if (result.success) {
        setImportStatus({
          success: true,
          message: `Imported ${result.counts.hands} hands, ${result.counts.sessions} sessions, ${result.counts.players} players`
        });

        // Reload sessions
        const allSessions = await loadAllSessions();
        const sorted = allSessions.sort((a, b) => b.startTime - a.startTime);
        setSessions(sorted);
      } else {
        setImportStatus({ success: false, message: 'Import completed with errors: ' + result.errors.join(', ') });
      }
    } catch (error) {
      setImportStatus({ success: false, message: 'Import failed: ' + error.message });
    }

    setShowImportConfirm(false);
    setImportData(null);
  };

  // Calculate running total bankroll (sum of all profit/loss)
  const calculateTotalBankroll = () => {
    return sessions.reduce((total, session) => {
      // Only include completed sessions with cashOut
      if (session.endTime && session.cashOut !== null && session.cashOut !== undefined) {
        const buyIn = session.buyIn || 0;
        const totalRebuys = calculateTotalRebuy(session.rebuyTransactions);
        const profitLoss = session.cashOut - buyIn - totalRebuys;
        return total + profitLoss;
      }
      return total;
    }, 0);
  };

  const totalBankroll = calculateTotalBankroll();

  return (
    <ScaledContainer scale={scale}>
      <div className="w-full h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative">
        {/* Scrollable Content */}
        <div className="w-full h-full pt-8 px-8 pb-24 overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Sessions</h1>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewSessionForm(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
              >
                <Play size={18} />
                New Session
              </button>
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
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Back to Table
              </button>
            </div>
          </div>

          {/* Import/Export Status */}
          {importStatus && (
            <div className={`mb-4 p-4 rounded-lg ${importStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
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
          {sessionState.currentSession.isActive && sessionState.currentSession.sessionId && (
            <div className="mb-6 bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-1">
                    {sessionState.currentSession.venue} - {sessionState.currentSession.gameType} - {formatTime12Hour(sessionState.currentSession.startTime)}
                  </h2>
                  <p className="text-green-100">
                    Started {formatRelativeTime(sessionState.currentSession.startTime)}
                  </p>
                </div>
                <button
                  onClick={handleEndSession}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Square size={16} />
                  End Session
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                {/* Hands */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-green-100 mb-1">Hands</div>
                  <div className="text-2xl font-bold">{sessionState.currentSession.handCount || 0}</div>
                </div>

                {/* Buy-in + Session Total */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-green-100 mb-1">Initial Buy-in</div>
                  {editingBuyIn ? (
                    <input
                      type="number"
                      value={buyInValue}
                      onChange={(e) => setBuyInValue(e.target.value)}
                      onBlur={handleBuyInUpdate}
                      className="w-full px-2 py-1 text-gray-900 rounded"
                      autoFocus
                    />
                  ) : (
                    <div
                      onClick={() => {
                        setBuyInValue((sessionState.currentSession.buyIn || '').toString());
                        setEditingBuyIn(true);
                      }}
                      className="text-2xl font-bold mb-2 cursor-pointer hover:bg-white/10 rounded px-2 py-1"
                    >
                      ${sessionState.currentSession.buyIn || '---'}
                    </div>
                  )}
                  <div className="text-green-100 text-xs mb-1">Session Total</div>
                  <div className="text-2xl font-bold">
                    ${(sessionState.currentSession.buyIn || 0) + calculateTotalRebuy(sessionState.currentSession.rebuyTransactions)}
                  </div>
                </div>

                {/* Rebuys */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="text-green-100 mb-1">Rebuys</div>
                  {addingRebuy ? (
                    <div className="space-y-2">
                      <input
                        type="number"
                        value={rebuyAmount}
                        onChange={(e) => setRebuyAmount(e.target.value)}
                        className="w-full px-2 py-1 text-gray-900 rounded"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleConfirmRebuy}
                          className="flex-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={handleCancelRebuy}
                          className="flex-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartAddRebuy}
                      className="w-full px-3 py-2 bg-white/20 hover:bg-white/30 rounded text-sm"
                    >
                      + Add Rebuy
                    </button>
                  )}

                  {/* Rebuy transaction list */}
                  {sessionState.currentSession.rebuyTransactions && sessionState.currentSession.rebuyTransactions.length > 0 && (
                    <div className="mt-3 space-y-1 max-h-24 overflow-y-auto">
                      {sessionState.currentSession.rebuyTransactions.map((tx, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span>{formatTime12Hour(tx.timestamp)}</span>
                          <span>${tx.amount}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Venue and Game Type - Combined on one line */}
              <div className="mt-4 bg-white/10 rounded-lg p-3">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Venue */}
                  <div className="flex items-center gap-2">
                    <span className="text-green-100 text-sm">Venue:</span>
                    {editingVenue ? (
                      <select
                        value={venueValue}
                        onChange={(e) => {
                          const newVenue = e.target.value;
                          setVenueValue(newVenue);
                          updateSessionField('venue', newVenue);
                          setEditingVenue(false);
                        }}
                        onBlur={() => setEditingVenue(false)}
                        className="px-2 py-1 text-gray-900 rounded"
                        autoFocus
                      >
                        {VENUES.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    ) : (
                      <div
                        onClick={() => {
                          setVenueValue(sessionState.currentSession.venue || VENUES[0]);
                          setEditingVenue(true);
                        }}
                        className="text-lg cursor-pointer hover:bg-white/10 rounded px-2 py-1 font-medium"
                      >
                        {sessionState.currentSession.venue || 'Click to set'}
                      </div>
                    )}
                  </div>

                  {/* Game Type */}
                  <div className="flex items-center gap-2">
                    <span className="text-green-100 text-sm">Game Type:</span>
                    {editingGameType ? (
                      <select
                        value={gameTypeValue}
                        onChange={(e) => {
                          setGameTypeValue(e.target.value);
                          const gameTypeLabel = GAME_TYPES[e.target.value]?.label;
                          if (gameTypeLabel) {
                            updateSessionField('gameType', gameTypeLabel);
                          }
                          setEditingGameType(false);
                        }}
                        onBlur={() => setEditingGameType(false)}
                        className="px-2 py-1 text-gray-900 rounded"
                        autoFocus
                      >
                        {GAME_TYPE_KEYS.map((key) => (
                          <option key={key} value={key}>{GAME_TYPES[key].label}</option>
                        ))}
                      </select>
                    ) : (
                      <div
                        onClick={() => {
                          const currentKey = GAME_TYPE_KEYS.find(
                            key => GAME_TYPES[key].label === sessionState.currentSession.gameType
                          ) || GAME_TYPE_KEYS[0];
                          setGameTypeValue(currentKey);
                          setEditingGameType(true);
                        }}
                        className="text-lg cursor-pointer hover:bg-white/10 rounded px-2 py-1 font-medium"
                      >
                        {sessionState.currentSession.gameType || 'Click to set'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Goal */}
              <div className="mt-4">
                <div className="text-green-100 text-sm mb-1">Goal</div>
                {editingGoal ? (
                  <select
                    value={goalValue}
                    onChange={(e) => setGoalValue(e.target.value)}
                    onBlur={handleGoalUpdate}
                    className="w-full px-3 py-2 text-gray-900 rounded"
                    autoFocus
                  >
                    <option value="">No specific goal</option>
                    {Object.values(SESSION_GOALS).map((goal) => (
                      <option key={goal} value={goal}>{goal}</option>
                    ))}
                  </select>
                ) : (
                  <div
                    onClick={() => {
                      setGoalValue(sessionState.currentSession.goal || '');
                      setEditingGoal(true);
                    }}
                    className="text-lg cursor-pointer hover:bg-white/10 rounded px-2 py-1"
                  >
                    {sessionState.currentSession.goal || 'Click to set goal'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No Active Session */}
          {!sessionState.currentSession.isActive && (
            <div className="mb-6 bg-white rounded-lg shadow-lg p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">No Active Session</h2>
              <button
                onClick={() => setShowNewSessionForm(true)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 mx-auto font-medium"
              >
                <Play size={18} />
                New Session
              </button>
            </div>
          )}

          {/* Past Sessions */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Past Sessions</h2>
            </div>

            <div className="divide-y divide-gray-200">
              {sessions
                .filter((s) => !s.isActive)
                .map((session) => (
                  <SessionCard
                    key={session.sessionId}
                    session={session}
                    onDelete={handleDeleteSession}
                  />
                ))}

              {sessions.filter((s) => !s.isActive).length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No past sessions yet
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
                // Get game type key from most recent session
                sessions.length > 0
                  ? Object.keys(GAME_TYPES).find(key => GAME_TYPES[key].label === sessions[0].gameType)
                  : ''
              }
              defaultVenue={sessions.length > 0 ? sessions[0].venue : ''}
            />
          )}
        </div>

        {/* Running Total Bankroll - Bottom Left Corner */}
        <div className="absolute bottom-8 left-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-xl p-4 text-white z-20 max-w-xs">
          <div className="text-blue-100 text-xs mb-1">Running Total Bankroll</div>
          <div className={`text-2xl font-bold ${totalBankroll >= 0 ? 'text-white' : 'text-red-200'}`}>
            {totalBankroll >= 0 ? '+' : ''}${totalBankroll.toFixed(2)}
          </div>
          <div className="text-blue-100 text-xs mt-1">
            {sessions.filter(s => s.endTime && s.cashOut !== null).length} sessions
          </div>
        </div>

        {/* Pre-session Drills Button - Bottom Right Corner */}
        <button
          onClick={() => {/* Dead button for now */}}
          className="absolute bottom-8 right-8 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg font-medium z-10"
        >
          Pre-session Drills
        </button>

        {/* Import Confirmation Modal */}
        {showImportConfirm && importData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Confirm Import</h2>
              <p className="text-red-600 font-semibold mb-4">
                Warning: This will replace ALL existing data!
              </p>
              <p className="text-gray-600 mb-4">
                The backup file contains:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4">
                <li>{importData.counts?.hands || importData.data?.hands?.length || 0} hands</li>
                <li>{importData.counts?.sessions || importData.data?.sessions?.length || 0} sessions</li>
                <li>{importData.counts?.players || importData.data?.players?.length || 0} players</li>
              </ul>
              {importData.exportedAtISO && (
                <p className="text-sm text-gray-500 mb-4">
                  Exported: {new Date(importData.exportedAtISO).toLocaleString()}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowImportConfirm(false); setImportData(null); }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Import & Replace
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cash Out Modal */}
        {showCashOutModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">End Session</h2>
              <p className="text-gray-600 mb-4">
                Enter your cash out amount (optional)
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cash Out Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={cashOutAmount}
                    onChange={(e) => setCashOutAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Leave empty to skip</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelCashOut}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCashOut}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  End Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScaledContainer>
  );
};
