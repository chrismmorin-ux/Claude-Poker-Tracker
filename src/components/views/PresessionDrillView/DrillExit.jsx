/**
 * DrillExit.jsx — Mode 4 per surface spec
 *
 * Mood-aware watchlist summary + session-link hand-off.
 *
 * Mood heuristic (from hook sessionSummary.mood):
 *   - upbeat      (≥ 80% hit rate) — celebratory framing
 *   - neutral     (50–79%)         — balanced framing
 *   - encouraging (< 50%)          — supportive, not punishing (per Gate 2 Stage C)
 *
 * Design rules applied:
 *   - Supportive tone in all moods — avoid "you missed" language
 *   - State-aware primary action: "Start session now"
 *   - Touch targets ≥ 44 DOM-px
 */

import React, { useState } from 'react';
import { DrillReview } from './DrillReview';

export const DrillExit = ({
  deck,
  retryDeck,
  sessionSummary,
  drillSession,
  assumptions,
  onStartSession,
  onBackToEntry,
}) => {
  const [showReview, setShowReview] = useState(false);
  const totalReviewed = sessionSummary?.totalCards ?? 0;
  const correct = sessionSummary?.correct ?? 0;
  const retryLater = sessionSummary?.retryLater ?? 0;
  const mood = sessionSummary?.mood ?? 'neutral';

  const headline = {
    upbeat: "You're dialed in.",
    neutral: "You're ready.",
    encouraging: "Good prep — take your time at the table.",
  }[mood];

  const subhead = {
    upbeat: `${correct} of ${totalReviewed} cards correct on first pass — strong recognition.`,
    neutral: `Walked through ${totalReviewed} pattern${totalReviewed === 1 ? '' : 's'} — ${correct} hit, ${retryLater} flagged for retry.`,
    encouraging: `You covered ${totalReviewed} pattern${totalReviewed === 1 ? '' : 's'}. Recognition takes reps — the watchlist below is what matters at the table.`,
  }[mood];

  // Tonight's watchlist — combine the highest-composite cards from both decks
  const watchlist = [...deck, ...retryDeck].slice(0, 5);

  // Inline review toggle — Option D per Session 16 handoff Q2.
  // DrillReview mounts here rather than requiring a separate navigation step.
  const hasReviewableSession = drillSession
    && drillSession.cardsShown
    && drillSession.cardsShown.length > 0;

  return (
    <div className="w-full h-full bg-gray-900 flex flex-col" style={{ width: 1600, height: 720 }}>
      <div className="flex-1 flex items-start justify-center px-8 py-6 overflow-y-auto">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="drill-exit-headline">
            {headline}
          </h1>
          <p className="text-gray-400 mb-8" data-testid="drill-exit-subhead">
            {subhead}
          </p>

          <div className="p-6 rounded-lg bg-gray-800 border border-gray-700 mb-8 text-left">
            <h2 className="text-sm text-gray-500 uppercase tracking-wider mb-3">
              Tonight's watchlist
            </h2>
            {watchlist.length === 0 ? (
              <p className="text-gray-400 text-sm">No patterns to flag.</p>
            ) : (
              <ul className="space-y-2 text-gray-300" data-testid="drill-exit-watchlist">
                {watchlist.map((card) => (
                  <li key={card.id} className="flex items-start gap-2">
                    <span className="text-amber-400">●</span>
                    <span>
                      {card.narrative?.teachingPattern
                        ?? card.narrative?.humanStatement
                        ?? card.id}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-gray-500 mb-6">
            When you see these spots live, the app will cite them in the sidebar.
          </p>

          <div className="flex justify-center gap-4 flex-wrap">
            <button
              type="button"
              onClick={onStartSession}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold rounded transition-colors"
              style={{ minHeight: 48, minWidth: 200 }}
              data-testid="drill-exit-start-session"
            >
              Start session now
            </button>
            {hasReviewableSession && (
              <button
                type="button"
                onClick={() => setShowReview((prev) => !prev)}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                style={{ minHeight: 48, minWidth: 180 }}
                data-testid="drill-exit-toggle-review"
              >
                {showReview ? 'Hide review ▲' : 'See full review ▼'}
              </button>
            )}
            <button
              type="button"
              onClick={onBackToEntry}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              style={{ minHeight: 48, minWidth: 160 }}
              data-testid="drill-exit-back-to-entry"
            >
              Back to drill entry
            </button>
          </div>

          {/* Inline DrillReview — option D per Session 16 handoff */}
          {showReview && hasReviewableSession && (
            <div className="mt-8 text-left" data-testid="drill-exit-inline-review">
              <div style={{ minHeight: 480 }}>
                <DrillReview
                  drillSession={drillSession}
                  sessionSummary={sessionSummary}
                  assumptions={assumptions}
                  onClose={() => setShowReview(false)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
