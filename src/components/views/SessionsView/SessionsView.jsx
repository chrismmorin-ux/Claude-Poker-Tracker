/**
 * SessionsView.jsx - Sessions management view
 *
 * Displays current active session and all past sessions.
 * Allows creating, ending, editing, and deleting sessions.
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Play, Square, Download, Upload } from 'lucide-react';
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

/**
 * SessionsView component
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
  setAutoOpenNewSession,
  resetTableState
}) => {
  // Local UI state
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState('');

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

  // Auto-open new session form when navigating from TableView
  useEffect(() => {
    if (autoOpenNewSession) {
      setShowNewSessionForm(true);
      setAutoOpenNewSession(false);
    }
  }, [autoOpenNewSession, setAutoOpenNewSession]);

  // Handle new session submission
  const handleNewSession = async (sessionData) => {
    try {
      await startNewSession(sessionData);
      setShowNewSessionForm(false);
      if (resetTableState) {
        resetTableState();
      }
      setCurrentScreen(SCREEN.TABLE);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  // Handle end session - show cash out modal
  const handleEndSession = () => {
    setShowCashOutModal(true);
    setCashOutAmount('');
  };

  // Handle confirm cash out and end session
  const handleConfirmCashOut = async () => {
    try {
      const cashOut = cashOutAmount ? parseFloat(cashOutAmount) : null;
      await endCurrentSession(cashOut);
      const allSessions = await loadAllSessions();
      const sorted = allSessions.sort((a, b) => b.startTime - a.startTime);
      setSessions(sorted);
      setShowCashOutModal(false);
      setCashOutAmount('');
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  // Handle delete session
  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm(`Delete session #${sessionId}? This cannot be undone.`)) return;

    try {
      await deleteSessionById(sessionId);
      const allSessions = await loadAllSessions();
      const sorted = allSessions.sort((a, b) => b.startTime - a.startTime);
      setSessions(sorted);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
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

  // Calculate running total bankroll
  const calculateTotalBankroll = () => {
    return sessions.reduce((total, session) => {
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
  const completedSessionCount = sessions.filter(s => s.endTime && s.cashOut !== null).length;

  return (
    <ScaledContainer scale={scale}>
      <div className="w-full h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative">
        {/* Scrollable Content */}
        <div className="w-full h-full pt-8 px-8 pb-24 overflow-y-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Sessions</h1>
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
          <ActiveSessionCard
            currentSession={sessionState.currentSession}
            onEndSession={handleEndSession}
            onUpdateField={updateSessionField}
          />

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
                sessions.length > 0
                  ? Object.keys(GAME_TYPES).find(key => GAME_TYPES[key].label === sessions[0].gameType)
                  : ''
              }
              defaultVenue={sessions.length > 0 ? sessions[0].venue : ''}
            />
          )}
        </div>

        {/* Running Total Bankroll */}
        <BankrollDisplay
          totalBankroll={totalBankroll}
          completedSessionCount={completedSessionCount}
        />

        {/* Pre-session Drills Button */}
        <button
          onClick={() => {/* Dead button for now */}}
          className="absolute bottom-8 right-8 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg font-medium z-10"
        >
          Pre-session Drills
        </button>

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
          onConfirm={handleConfirmCashOut}
          onCancel={() => { setShowCashOutModal(false); setCashOutAmount(''); }}
        />
      </div>
    </ScaledContainer>
  );
};

SessionsView.propTypes = {
  scale: PropTypes.number.isRequired,
  setCurrentScreen: PropTypes.func.isRequired,
  sessionState: PropTypes.object.isRequired,
  dispatchSession: PropTypes.func,
  startNewSession: PropTypes.func.isRequired,
  endCurrentSession: PropTypes.func.isRequired,
  updateSessionField: PropTypes.func.isRequired,
  loadAllSessions: PropTypes.func.isRequired,
  deleteSessionById: PropTypes.func.isRequired,
  SCREEN: PropTypes.object.isRequired,
  autoOpenNewSession: PropTypes.bool,
  setAutoOpenNewSession: PropTypes.func.isRequired,
  resetTableState: PropTypes.func,
};
