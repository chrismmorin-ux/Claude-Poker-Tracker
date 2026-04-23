/**
 * DrillRetryQueue.jsx — Mode 3 per surface spec
 *
 * Shows after the primary flashcard deck is exhausted if any cards were marked
 * "retry-later." Offers to replay the queue or skip to exit.
 *
 * Design rules applied (Gate 2 Stage C + E):
 *   - Supportive tone — no punishment framing
 *   - Touch targets ≥ 44 DOM-px
 *   - State-aware primary action: "Retry" (replay the queue)
 */

import React from 'react';

export const DrillRetryQueue = ({
  retryDeck,
  sessionSummary,
  onReplay,
  onSkip,
  onAbandon,
}) => {
  const queueCount = retryDeck.length;
  const correct = sessionSummary?.correct ?? 0;
  const total = sessionSummary?.totalCards ?? queueCount;

  return (
    <div className="w-full h-full bg-gray-900 flex flex-col" style={{ width: 1600, height: 720 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-white">Retry queue</h1>
          <p className="text-sm text-gray-400 mt-1">
            {correct > 0
              ? `Nice work — you answered ${correct} of ${total} cards correctly on the first pass.`
              : `Let's work through the ${queueCount} card${queueCount === 1 ? '' : 's'} you flagged for another look.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onAbandon}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded"
          style={{ minHeight: 44 }}
          data-testid="drill-retry-exit"
        >
          Exit drill ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-8 py-6 overflow-y-auto">
        <div className="max-w-2xl w-full text-center">
          <div className="p-6 rounded-lg bg-gray-800 border border-gray-700 mb-6 text-left">
            <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-3">
              {queueCount} card{queueCount === 1 ? '' : 's'} to retry
            </h2>
            {queueCount === 0 ? (
              <p className="text-gray-400 text-sm">No cards queued for retry.</p>
            ) : (
              <ul className="space-y-3" data-testid="drill-retry-list">
                {retryDeck.slice(0, 6).map((card) => (
                  <li key={card.id} className="flex items-start gap-3">
                    <span className="text-amber-400 mt-1">●</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm">
                        {card.villainId} — {predicateToLabel(card.claim?.predicate)}
                      </div>
                      <div className="text-gray-400 text-xs mt-0.5">
                        {card.narrative?.citationShort ?? card.narrative?.humanStatement ?? ''}
                      </div>
                    </div>
                  </li>
                ))}
                {queueCount > 6 && (
                  <li className="text-gray-500 text-xs italic">
                    + {queueCount - 6} more
                  </li>
                )}
              </ul>
            )}
          </div>

          <p className="text-sm text-gray-500 mb-6">
            Want another pass through these before you sit down?
          </p>

          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={onReplay}
              disabled={queueCount === 0}
              className={`px-6 py-3 rounded font-semibold transition-colors ${
                queueCount === 0
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-400 text-gray-900'
              }`}
              style={{ minHeight: 48, minWidth: 160 }}
              data-testid="drill-retry-replay"
            >
              ↻ Retry
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded transition-colors"
              style={{ minHeight: 48, minWidth: 160 }}
              data-testid="drill-retry-skip"
            >
              I'm ready →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
