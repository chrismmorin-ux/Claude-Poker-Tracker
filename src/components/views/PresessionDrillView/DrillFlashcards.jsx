/**
 * DrillFlashcards.jsx — Flashcard display with click-to-reveal
 *
 * Per surface spec §Anatomy Mode 2. Renders one card at a time; hero can answer
 * before or after reveal. Click-to-reveal is final per Gate 2 Stage E.
 *
 * v1 simplification: no rich game-state rendering (hand, board, action history).
 * The card shows: villain + predicate context + "What's your move?" prompt.
 * v1.5+ will pull in real game-state visualization from existing HandReplay primitives.
 */

import React from 'react';
import { DrillReveal } from './DrillReveal';

export const DrillFlashcards = ({
  cardIndex,
  totalCards,
  currentCard,
  isRevealed,
  timeBudgetMinutes,
  onReveal,
  onAnswer,
  onSetDial,
  onAbandon,
}) => {
  if (!currentCard) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center text-gray-400">
        No card available
      </div>
    );
  }

  const predicateLabel = predicateToLabel(currentCard.claim?.predicate);
  const deviationLabel = deviationToLabel(currentCard.consequence?.deviationType);

  return (
    <div className="w-full h-full bg-gray-900 flex flex-col" style={{ width: 1600, height: 720 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-gray-800">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Card {cardIndex + 1} of {totalCards} · ~{Math.round(timeBudgetMinutes / totalCards)} min
          </div>
          <h1 className="text-xl font-bold text-white">
            Villain <span className="text-amber-400">{currentCard.villainId}</span>
            <span className="text-sm font-normal text-gray-500 ml-3">
              {predicateLabel} — {deviationLabel}
            </span>
          </h1>
        </div>
        <button
          type="button"
          onClick={onAbandon}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded"
          data-testid="drill-flashcards-exit"
          style={{ minHeight: 44 }}
        >
          Exit drill ×
        </button>
      </div>

      {/* Body — card content */}
      <div className="flex-1 flex items-center justify-center px-8 py-6 overflow-y-auto">
        <div className="max-w-3xl w-full">
          {/* Spot description */}
          <div className="p-6 rounded-lg bg-gray-800 border border-gray-700 mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">Spot</h2>
            <p className="text-gray-300 leading-relaxed">
              {currentCard.recognizability?.triggerDescription ?? 'Spot description unavailable'}
            </p>
          </div>

          {/* Prompt */}
          {!isRevealed ? (
            <div className="p-6 rounded-lg bg-gray-800 border border-gray-700 text-center">
              <h3 className="text-lg font-semibold text-white mb-4">What's your move?</h3>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onReveal}
                  className="px-8 py-4 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold rounded transition-colors"
                  style={{ minHeight: 56, minWidth: 200 }}
                  data-testid="drill-flashcards-reveal"
                >
                  Reveal ▼
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Think first — reveal is final, no peeking.
              </p>
            </div>
          ) : (
            <DrillReveal
              card={currentCard}
              onSetDial={onSetDial}
            />
          )}
        </div>
      </div>

      {/* Footer — answer buttons (only after reveal) */}
      {isRevealed && (
        <div className="px-8 py-4 border-t border-gray-800 flex items-center justify-center gap-4" data-testid="drill-flashcards-answer-row">
          <button
            type="button"
            onClick={() => onAnswer('correct')}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded transition-colors"
            style={{ minHeight: 48, minWidth: 140 }}
            data-testid="drill-flashcards-got-it"
          >
            ✓ Got it
          </button>
          <button
            type="button"
            onClick={() => onAnswer('retry-later')}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded transition-colors"
            style={{ minHeight: 48, minWidth: 140 }}
            data-testid="drill-flashcards-retry-later"
          >
            ↻ Retry later
          </button>
          <button
            type="button"
            onClick={() => onAnswer('skip')}
            className="px-6 py-3 text-gray-400 hover:text-white font-semibold rounded transition-colors"
            style={{ minHeight: 48, minWidth: 100 }}
            data-testid="drill-flashcards-skip"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
};

// Predicate + deviation label helpers — lightweight human-readable mapping
const predicateToLabel = (predicate) => {
  if (!predicate) return 'pattern';
  const mapping = {
    foldToCbet: 'Fold to cbet',
    foldToTurnBarrel: 'Fold to turn barrel',
    foldToRiverBet: 'Fold to river',
    checkRaiseFrequency: 'Check-raise',
    thinValueFrequency: 'Calls thin value',
    slowplayFrequency: 'Slowplays nuts',
    overbetFrequency: 'Overbets',
    foldOnScareCard: 'Fold on scare card',
  };
  return mapping[predicate] ?? predicate;
};

const deviationToLabel = (deviationType) => {
  if (!deviationType) return '';
  const mapping = {
    'bluff-prune': 'Drop bluffs',
    'value-expand': 'Expand value',
    'range-bet': 'Range-bet',
    'sizing-shift': 'Shift sizing',
    'spot-skip': 'Skip spot',
    'line-change': 'Change line',
  };
  return mapping[deviationType] ?? deviationType;
};
