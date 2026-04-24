/**
 * PresessionDrillView — top-level view for the exploit-deviation presession drill
 *
 * Per surface spec `docs/design/surfaces/presession-drill.md`.
 *
 * Commit 8 Phase A: Entry + Flashcards + basic Exit placeholder
 * Commit 8 Phase A+: Retry queue + proper Exit with mood-aware framing (this update)
 *
 * Deferred (Commit 8.2 Phase B):
 *   - Real gameTree integration in DrillReveal (pulls baselineAction + recommendedAction
 *     from citedDecisionProducer rather than v1 heuristic labels)
 *   - Navigation entry points (TableView "Prepare for tonight" button + SessionsView drill-review tab)
 *   - DrillReview.jsx SessionsView tab (Mode 5)
 *   - Slider-style dial (currently discrete buttons)
 *
 * Feature-flagged via ENABLE_PRESESSION_DRILL — default off until Phase 8
 * Tier-2 calibration accrues meaningful sample.
 */

import React, { useState } from 'react';
import { ScaledContainer } from '../../ui/ScaledContainer';
import { useUI } from '../../../contexts';
import { usePresessionDrill } from '../../../hooks/usePresessionDrill';
import { DrillEntry } from './DrillEntry';
import { DrillFlashcards } from './DrillFlashcards';
import { DrillRetryQueue } from './DrillRetryQueue';
import { DrillExit } from './DrillExit';

/**
 * Feature flag — default false. Flipping to true exposes the drill to users.
 * Per architecture §Phase 7: enabled after Phase 8 calibration validates.
 */
export const ENABLE_PRESESSION_DRILL = false;

export const PresessionDrillView = ({ scale }) => {
  const { setCurrentScreen, SCREEN } = useUI();
  const drill = usePresessionDrill();

  // Local state: have we shown the retry-queue intro yet this session?
  // Retry mode shows the intro once, then switches to flashcard replay.
  const [retryIntroShown, setRetryIntroShown] = useState(false);

  // Reset the intro flag whenever we leave retry mode
  React.useEffect(() => {
    if (drill.mode !== 'retry' && retryIntroShown) setRetryIntroShown(false);
  }, [drill.mode, retryIntroShown]);

  // Feature-flag gate — if disabled, render a simple placeholder.
  if (!ENABLE_PRESESSION_DRILL) {
    return (
      <ScaledContainer scale={scale}>
        <div className="w-full h-full bg-gray-900 flex items-center justify-center" style={{ width: 1600, height: 720 }}>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Presession Drill</h1>
            <p className="text-gray-400 mb-6">Not yet available.</p>
            <button
              type="button"
              onClick={() => setCurrentScreen(SCREEN.TABLE)}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded"
              style={{ minHeight: 48 }}
              data-testid="drill-disabled-back"
            >
              ← Back to Table
            </button>
          </div>
        </div>
      </ScaledContainer>
    );
  }

  const backToTable = () => setCurrentScreen(SCREEN.TABLE);

  // In retry mode we show the intro first, then the flashcard UI.
  // Intro button "Retry" transitions intro-shown=true and continues in retry flow.
  const showRetryIntro = drill.mode === 'retry' && !retryIntroShown;

  return (
    <ScaledContainer scale={scale}>
      {drill.mode === 'entry' && (
        <DrillEntry
          timeBudget={drill.timeBudget}
          onTimeBudgetChange={drill.setTimeBudget}
          availableVillains={drill.availableVillains}
          selectedVillainIds={drill.selectedVillainIds}
          onToggleVillain={drill.toggleVillain}
          onStartDrill={drill.startDrill}
          onBack={backToTable}
        />
      )}

      {drill.mode === 'flashcards' && (
        <DrillFlashcards
          cardIndex={drill.currentCardIndex}
          totalCards={drill.deck.length}
          currentCard={drill.currentCard}
          citedDecision={drill.currentCitedDecision}
          isRevealed={drill.isRevealed}
          timeBudgetMinutes={drill.timeBudget}
          onReveal={drill.revealCard}
          onAnswer={drill.answerCard}
          onSetDial={drill.setDial}
          onAbandon={drill.abandonDrill}
        />
      )}

      {showRetryIntro && (
        <DrillRetryQueue
          retryDeck={drill.retryDeck}
          sessionSummary={drill.sessionSummary}
          onReplay={() => setRetryIntroShown(true)}
          onSkip={drill.skipRetry}
          onAbandon={drill.abandonDrill}
        />
      )}

      {drill.mode === 'retry' && retryIntroShown && drill.retryDeck.length > 0 && (
        <DrillFlashcards
          cardIndex={drill.retryIndex}
          totalCards={drill.retryDeck.length}
          currentCard={drill.currentCard}
          citedDecision={drill.currentCitedDecision}
          isRevealed={drill.isRevealed}
          timeBudgetMinutes={drill.timeBudget}
          onReveal={drill.revealCard}
          onAnswer={drill.answerCard}
          onSetDial={drill.setDial}
          onAbandon={drill.abandonDrill}
        />
      )}

      {drill.mode === 'exit' && (
        <DrillExit
          deck={drill.deck}
          retryDeck={drill.retryDeck}
          sessionSummary={drill.sessionSummary}
          drillSession={drill.drillSession}
          assumptions={drill.assumptions}
          onStartSession={backToTable}
          onBackToEntry={drill.exitToEntry}
        />
      )}
    </ScaledContainer>
  );
};
