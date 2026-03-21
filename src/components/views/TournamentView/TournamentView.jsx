/**
 * TournamentView.jsx - Tournament dashboard
 *
 * Main tournament management screen with blind timer, predictions,
 * chip stacks, and tournament controls.
 */

import React, { useCallback, useState } from 'react';
import { ArrowLeft, XCircle } from 'lucide-react';
import { ScaledContainer } from '../../ui/ScaledContainer';
import { BlindTimerBar } from './BlindTimerBar';
import { PredictionsPanel } from './PredictionsPanel';
import { ChipStackPanel } from './ChipStackPanel';
import { useTournament } from '../../../contexts/TournamentContext';
import { useUI, useGame, useSession } from '../../../contexts';
import { SCREEN } from '../../../constants/uiConstants';

export const TournamentView = ({ scale }) => {
  const { setCurrentScreen } = useUI();
  const { mySeat } = useGame();
  const { updateSessionField } = useSession();
  const [showEndForm, setShowEndForm] = useState(false);
  const [finishPosition, setFinishPosition] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const {
    tournamentState,
    isTournament,
    currentBlinds,
    nextBlinds,
    levelTimeRemaining,
    predictions,
    advanceLevel,
    pauseTimer,
    resumeTimer,
    updateStack,
    recordElimination,
    setPlayersRemaining,
    resetTournament,
  } = useTournament();

  const handleBackToTable = useCallback(() => {
    setCurrentScreen(SCREEN.TABLE);
  }, [setCurrentScreen]);

  const handleConfirmEnd = useCallback(() => {
    // Write tournament result fields to session
    if (finishPosition) {
      updateSessionField('tournamentFinishPosition', Number(finishPosition));
    }
    if (payoutAmount) {
      updateSessionField('tournamentPayout', Number(payoutAmount));
    }
    updateSessionField('tournamentTotalEntrants', tournamentState.config.totalEntrants);
    updateSessionField('tournamentFormat', tournamentState.config.format);
    resetTournament();
    setCurrentScreen(SCREEN.SESSIONS);
  }, [finishPosition, payoutAmount, tournamentState.config, resetTournament, setCurrentScreen, updateSessionField]);

  const handleEliminate = useCallback((seat) => {
    recordElimination(seat);
  }, [recordElimination]);

  if (!isTournament) {
    return (
      <ScaledContainer scale={scale}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 text-lg mb-4">No active tournament</p>
            <button
              onClick={handleBackToTable}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Back to Table
            </button>
          </div>
        </div>
      </ScaledContainer>
    );
  }

  const { config, currentLevelIndex, chipStacks, playersRemaining, isPaused } = tournamentState;

  // Find hero stack (use mySeat from game context, fallback to first available)
  const heroStack = chipStacks[mySeat] || Object.values(chipStacks)[0] || 0;

  return (
    <ScaledContainer scale={scale}>
      <div className="w-full h-full flex flex-col gap-3 p-3 overflow-hidden">
        {/* Blind Timer Bar */}
        <BlindTimerBar
          currentBlinds={currentBlinds}
          nextBlinds={nextBlinds}
          currentLevelIndex={currentLevelIndex}
          levelTimeRemaining={levelTimeRemaining}
          isPaused={isPaused}
          playersRemaining={playersRemaining}
          totalEntrants={config.totalEntrants}
          onPause={pauseTimer}
          onResume={resumeTimer}
          onSkipLevel={advanceLevel}
        />

        {/* Main content: Predictions + Chip Stacks side by side */}
        <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 overflow-hidden">
          <div className="overflow-y-auto">
            <PredictionsPanel
              predictions={predictions}
              heroStack={heroStack}
              config={config}
              currentLevelIndex={currentLevelIndex}
              playersRemaining={playersRemaining}
              totalEntrants={config.totalEntrants}
            />
          </div>

          <div className="overflow-y-auto">
            <ChipStackPanel
              chipStacks={chipStacks}
              currentBlinds={currentBlinds}
              rankings={predictions?.finishProjections?.rankings || []}
              playersRemaining={playersRemaining}
              onUpdateStack={updateStack}
              onEliminate={handleEliminate}
              onSetPlayersRemaining={setPlayersRemaining}
            />
          </div>
        </div>

        {/* Bottom controls / End tournament form */}
        {showEndForm ? (
          <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Finish:</label>
              <input
                type="number"
                value={finishPosition}
                onChange={(e) => setFinishPosition(e.target.value)}
                placeholder="#"
                className="w-16 px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Payout: $</label>
              <input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="0"
                className="w-20 px-2 py-1 bg-gray-700 text-white border border-gray-600 rounded text-sm"
              />
            </div>
            <button
              onClick={handleConfirmEnd}
              className="px-4 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowEndForm(false)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <button
              onClick={handleBackToTable}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Table
            </button>

            <button
              onClick={() => setShowEndForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              <XCircle size={16} />
              End Tournament
            </button>
          </div>
        )}
      </div>
    </ScaledContainer>
  );
};
