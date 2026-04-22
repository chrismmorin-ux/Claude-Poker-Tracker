/**
 * TournamentView.jsx - Tournament dashboard
 *
 * Main tournament management screen with blind timer, predictions,
 * chip stacks, and tournament controls.
 */

import React, { useCallback, useState } from 'react';
import { ArrowLeft, XCircle, AlertTriangle, Trophy } from 'lucide-react';
import { ScaledContainer } from '../../ui/ScaledContainer';
import { BlindTimerBar } from './BlindTimerBar';
import { PredictionsPanel } from './PredictionsPanel';
import { ChipStackPanel } from './ChipStackPanel';
import { useTournament } from '../../../contexts/TournamentContext';
import { useUI, useGame, useSession } from '../../../contexts';
import { useToast } from '../../../contexts/ToastContext';
import { SCREEN } from '../../../constants/uiConstants';

const UNDO_TOAST_DURATION_MS = 12000;

export const TournamentView = ({ scale }) => {
  const { setCurrentScreen } = useUI();
  const { mySeat } = useGame();
  const { updateSessionField } = useSession();
  const { addToast, showSuccess } = useToast();
  const [showEndForm, setShowEndForm] = useState(false);
  const [finishPosition, setFinishPosition] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [pendingAdvance, setPendingAdvance] = useState(false);
  const {
    tournamentState,
    isTournament,
    currentBlinds,
    nextBlinds,
    levelTimeRemaining,
    predictions,
    lockoutInfo,
    blindOutInfo,
    icmPressure,
    mRatioGuidance,
    advanceLevel,
    setBlindLevel,
    hydrateTournament,
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

  // W4-A2-F1: End Tournament with deferred-reset toast+undo. Captures the
  // full tournamentState before reset so undo can restore via hydrateTournament.
  // Session field writes happen optimistically; undo reverts them by writing
  // the pre-end values (undefined if the field had no prior value).
  const handleConfirmEnd = useCallback(() => {
    if (!tournamentState) return;

    // Snapshot for undo
    const tournamentSnapshot = { ...tournamentState };
    const sessionFieldSnapshot = {
      tournamentFinishPosition: undefined, // we don't know the prior value; undo writes undefined
      tournamentPayout: undefined,
      tournamentTotalEntrants: undefined,
      tournamentFormat: undefined,
    };

    // Optimistic session field writes.
    if (finishPosition) {
      updateSessionField('tournamentFinishPosition', Number(finishPosition));
    }
    if (payoutAmount) {
      updateSessionField('tournamentPayout', Number(payoutAmount));
    }
    updateSessionField('tournamentTotalEntrants', tournamentState.config.totalEntrants);
    updateSessionField('tournamentFormat', tournamentState.config.format);

    // Reset the tournament + navigate.
    resetTournament();
    setCurrentScreen(SCREEN.SESSIONS);

    // Fire toast from SESSIONS landing.
    addToast(`Tournament ended — finish ${finishPosition || '?'}${payoutAmount ? ` · $${payoutAmount}` : ''}`, {
      variant: 'warning',
      duration: UNDO_TOAST_DURATION_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          // Restore tournamentState (hydrateTournament shallow-merges the snapshot).
          hydrateTournament(tournamentSnapshot);
          // Revert session field writes.
          updateSessionField('tournamentFinishPosition', sessionFieldSnapshot.tournamentFinishPosition);
          updateSessionField('tournamentPayout', sessionFieldSnapshot.tournamentPayout);
          updateSessionField('tournamentTotalEntrants', sessionFieldSnapshot.tournamentTotalEntrants);
          updateSessionField('tournamentFormat', sessionFieldSnapshot.tournamentFormat);
          // Return to TOURNAMENT view.
          setCurrentScreen(SCREEN.TOURNAMENT);
          showSuccess('Tournament restored');
        },
      },
    });
  }, [finishPosition, payoutAmount, tournamentState, resetTournament, setCurrentScreen, updateSessionField, addToast, hydrateTournament, showSuccess]);

  // W4-A2-F2: Eliminate-a-seat with toast+undo. Snapshot is a partial
  // tournamentState slice (chipStacks + playersRemaining + eliminations)
  // that captures everything recordElimination mutates. Undo merges the
  // snapshot back via hydrateTournament (HYDRATE_TOURNAMENT reducer action).
  const handleEliminate = useCallback((seat) => {
    if (!tournamentState) return;
    const snapshot = {
      chipStacks: { ...tournamentState.chipStacks },
      playersRemaining: tournamentState.playersRemaining,
      eliminations: [...(tournamentState.eliminations || [])],
    };
    recordElimination(seat);
    addToast(`Eliminated seat ${seat}`, {
      variant: 'warning',
      duration: UNDO_TOAST_DURATION_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          hydrateTournament(snapshot);
          showSuccess(`Seat ${seat} restored`);
        },
      },
    });
  }, [tournamentState, recordElimination, addToast, hydrateTournament, showSuccess]);

  // W4-A2-F3: two-phase Advance Level guard. First tap arms a confirm window;
  // second tap within 10s commits + fires an undo toast with 12s restore.
  const handleAdvanceLevel = useCallback(() => {
    if (!tournamentState || !isTournament) return;
    const prevLevelIndex = tournamentState.currentLevelIndex;

    if (!pendingAdvance) {
      setPendingAdvance(true);
      const blinds = nextBlinds ? `${nextBlinds.sb}/${nextBlinds.bb}${nextBlinds.ante ? ` +${nextBlinds.ante}a` : ''}` : 'next level';
      addToast(`Tap again within 10s to skip to Level ${prevLevelIndex + 2} (${blinds})`, {
        variant: 'warning',
        duration: 10000,
        action: {
          label: 'Confirm',
          onClick: () => {
            advanceLevel();
            setPendingAdvance(false);
            addToast(`Advanced to Level ${prevLevelIndex + 2}`, {
              variant: 'warning',
              duration: UNDO_TOAST_DURATION_MS,
              action: {
                label: 'Undo',
                onClick: () => {
                  setBlindLevel(prevLevelIndex);
                  showSuccess(`Reverted to Level ${prevLevelIndex + 1}`);
                },
              },
            });
          },
        },
      });
      // Auto-disarm the pending state after the 10s confirm window.
      setTimeout(() => setPendingAdvance(false), 10000);
    } else {
      // Second tap: commit immediately + undo toast.
      advanceLevel();
      setPendingAdvance(false);
      addToast(`Advanced to Level ${prevLevelIndex + 2}`, {
        variant: 'warning',
        duration: UNDO_TOAST_DURATION_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            setBlindLevel(prevLevelIndex);
            showSuccess(`Reverted to Level ${prevLevelIndex + 1}`);
          },
        },
      });
    }
  }, [tournamentState, isTournament, pendingAdvance, nextBlinds, advanceLevel, setBlindLevel, addToast, showSuccess]);

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
          levelDurationMs={currentBlinds.durationMinutes * 60 * 1000}
          isPaused={isPaused}
          playersRemaining={playersRemaining}
          totalEntrants={config.totalEntrants}
          lockoutInfo={lockoutInfo}
          onPause={pauseTimer}
          onResume={resumeTimer}
          onSkipLevel={handleAdvanceLevel}
        />

        {/* Main content: Predictions + Chip Stacks side by side */}
        <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 overflow-hidden">
          <div className="overflow-y-auto">
            <PredictionsPanel
              predictions={predictions}
              heroStack={heroStack}
              heroSeat={mySeat}
              config={config}
              currentLevelIndex={currentLevelIndex}
              playersRemaining={playersRemaining}
              totalEntrants={config.totalEntrants}
              icmPressure={icmPressure}
              lockoutInfo={lockoutInfo}
              blindOutInfo={blindOutInfo}
            />
          </div>

          <div className="overflow-y-auto">
            <ChipStackPanel
              chipStacks={chipStacks}
              currentBlinds={currentBlinds}
              rankings={predictions?.finishProjections?.rankings || []}
              playersRemaining={playersRemaining}
              heroSeat={mySeat}
              totalEntrants={config.totalEntrants}
              mRatioGuidance={mRatioGuidance}
              icmPressure={icmPressure}
              onUpdateStack={updateStack}
              onEliminate={handleEliminate}
              onSetPlayersRemaining={setPlayersRemaining}
            />
          </div>
        </div>

        {/* Bottom controls / End tournament form */}
        {showEndForm ? (
          <div className="rounded-lg p-4 space-y-3" style={{
            background: '#1f2937',
            border: '1px solid rgba(239,68,68,0.3)',
          }}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={18} className="text-red-400" />
              <span className="text-sm font-bold text-red-400 uppercase tracking-wide">End Tournament</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Finish Position</label>
                <div className="relative">
                  <Trophy size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="number"
                    value={finishPosition}
                    onChange={(e) => setFinishPosition(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full pl-8 pr-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Payout</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowEndForm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEnd}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Confirm End
              </button>
            </div>
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
