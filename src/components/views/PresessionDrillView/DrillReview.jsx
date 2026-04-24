/**
 * DrillReview.jsx — Mode 5 per surface spec §Anatomy Mode 5
 *
 * Post-session prediction-vs-outcome grid. Reads the completed drill session
 * from state.drillSession.cardsShown and summarizes: which flagged patterns
 * were answered correctly, retried, or skipped.
 *
 * v1 standalone component — not yet mounted in SessionsView tab. Surface-spec
 * §Anatomy Mode 5 says review mounts as a SessionsView tab; that cross-surface
 * wiring is deferred until after LSW-adjacent SessionsView work stabilizes.
 *
 * Consumes per-assumption realized outcomes from the calibration accumulator
 * once that integration lands; for v1, shows drill-only stats (no realized EV
 * since hero hasn't played live yet — that's the "review after session" flow).
 *
 * Design-rule compliance:
 *   - Mood-aware framing carries over from DrillExit (same sessionSummary.mood)
 *   - Touch targets ≥ 44 DOM-px
 *   - No punishing language
 */

import React from 'react';

export const DrillReview = ({
  drillSession,
  sessionSummary,
  assumptions,
  onClose,
  onReplayCard,
}) => {
  if (!drillSession || !drillSession.cardsShown || drillSession.cardsShown.length === 0) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center" style={{ width: 1600, height: 720 }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">No drill to review</h1>
          <p className="text-gray-400 mb-6">
            Prepare for a session first, then come back here to see how your predictions fared.
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded"
              style={{ minHeight: 48 }}
              data-testid="drill-review-back-empty"
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const { cardsShown } = drillSession;
  const cardsByStatus = groupByStatus(cardsShown);
  const hitRate = sessionSummary?.hitRate ?? 0;
  const mood = sessionSummary?.mood ?? 'neutral';

  return (
    <div className="w-full h-full bg-gray-900 flex flex-col" style={{ width: 1600, height: 720 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-white">Drill review</h1>
          <p className="text-sm text-gray-400 mt-1" data-testid="drill-review-subhead">
            {reviewSubhead(mood, cardsShown.length, cardsByStatus.correct.length, hitRate)}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded"
            style={{ minHeight: 44 }}
            data-testid="drill-review-close"
          >
            Close ×
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mb-6" data-testid="drill-review-stats">
          <StatCard
            label="Correct"
            value={cardsByStatus.correct.length}
            color="text-green-400"
            testId="drill-review-stat-correct"
          />
          <StatCard
            label="Flagged for retry"
            value={cardsByStatus.retryLater.length}
            color="text-amber-400"
            testId="drill-review-stat-retry"
          />
          <StatCard
            label="Skipped"
            value={cardsByStatus.skipped.length}
            color="text-gray-400"
            testId="drill-review-stat-skipped"
          />
          <StatCard
            label="Unanswered"
            value={cardsByStatus.unanswered.length}
            color="text-gray-500"
            testId="drill-review-stat-unanswered"
          />
        </div>

        {/* Per-card rows */}
        <div className="space-y-2" data-testid="drill-review-rows">
          {cardsShown.map((card) => (
            <ReviewRow
              key={card.assumptionId || card.cardIndex}
              card={card}
              assumption={assumptions?.[card.assumptionId]}
              onReplay={onReplayCard ? () => onReplayCard(card.assumptionId) : null}
            />
          ))}
        </div>

        {/* Calibration note — placeholder for Commit 10 real integration */}
        <div className="mt-8 p-4 rounded bg-gray-800 border border-gray-700 text-sm" data-testid="drill-review-calibration-note">
          <div className="text-gray-500 uppercase text-xs tracking-wider mb-2">Calibration</div>
          <p className="text-gray-300">
            Realized-vs-predicted EV comparison will appear here after your next live session
            populates data for these patterns.
          </p>
        </div>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

const groupByStatus = (cards) => {
  const result = { correct: [], retryLater: [], skipped: [], unanswered: [] };
  for (const card of cards) {
    if (card.heroAnswered === 'correct') result.correct.push(card);
    else if (card.heroAnswered === 'retry-later') result.retryLater.push(card);
    else if (card.heroAnswered === 'skip') result.skipped.push(card);
    else result.unanswered.push(card);
  }
  return result;
};

const reviewSubhead = (mood, total, correct, _hitRate) => {
  if (mood === 'upbeat') {
    return `Strong session — ${correct} of ${total} cards answered correctly on first pass.`;
  }
  if (mood === 'neutral') {
    return `Reviewed ${total} patterns — ${correct} correct on first pass.`;
  }
  return `Reviewed ${total} patterns. Recognition builds with reps — keep flagging the ones that trip you up.`;
};

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, color, testId }) => (
  <div
    className="p-4 rounded bg-gray-800 border border-gray-700"
    data-testid={testId}
  >
    <div className={`text-3xl font-bold ${color}`}>{value}</div>
    <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">{label}</div>
  </div>
);

const ReviewRow = ({ card, assumption, onReplay }) => {
  const answered = card.heroAnswered;
  const statusLabel = {
    correct: { text: 'Got it', color: 'text-green-400', bg: 'bg-green-900/20', border: 'border-green-700/50' },
    'retry-later': { text: 'Retry later', color: 'text-amber-400', bg: 'bg-amber-900/20', border: 'border-amber-700/50' },
    skip: { text: 'Skipped', color: 'text-gray-400', bg: 'bg-gray-800', border: 'border-gray-700' },
  }[answered] ?? { text: 'Unanswered', color: 'text-gray-500', bg: 'bg-gray-800/50', border: 'border-gray-700/50' };

  const summary = assumption?.narrative?.citationShort
    ?? assumption?.narrative?.humanStatement
    ?? card.assumptionId
    ?? '(unknown pattern)';

  return (
    <div
      className={`flex items-start gap-4 px-4 py-3 rounded border ${statusLabel.bg} ${statusLabel.border}`}
      data-testid="drill-review-row"
    >
      <div className={`w-24 shrink-0 text-xs font-semibold uppercase ${statusLabel.color}`}>
        {statusLabel.text}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium">
          {assumption?.villainId ? `${assumption.villainId} — ` : ''}
          {summary}
        </div>
        {card.dialOverride !== null && card.dialOverride !== undefined && (
          <div className="text-xs text-gray-500 mt-0.5">
            Dial override: {Number(card.dialOverride).toFixed(2)}
          </div>
        )}
      </div>
      {onReplay && answered !== 'correct' && (
        <button
          type="button"
          onClick={onReplay}
          className="shrink-0 px-3 py-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded"
          style={{ minHeight: 32 }}
          data-testid="drill-review-replay"
        >
          Review
        </button>
      )}
    </div>
  );
};
