/**
 * ReviewQueuePanel.jsx — "Tagged ⭐" Review Queue (WS-190 / SPR-107)
 *
 * Lists hands the owner flagged mid-session via the one-tap Tag-for-Review
 * affordance in TableView's ControlZone. Tapping a row opens the hand in
 * HandReplayView for study. Untagging happens on the replay surface (decision:
 * "Reviewed — clear tag" button), so rows here are read + navigate only.
 *
 * Tagged hands are sorted most-recently-tagged first (getTaggedHands).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Star } from 'lucide-react';
import { getTaggedHands } from '../../../utils/persistence/index';
import { logger } from '../../../utils/errorHandler';

const formatTaggedAt = (taggedAt) => {
  if (!taggedAt) return '';
  try {
    return new Date(taggedAt).toLocaleString();
  } catch {
    return '';
  }
};

export const ReviewQueuePanel = ({ onOpenHand, userId }) => {
  const [taggedHands, setTaggedHands] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const hands = userId ? await getTaggedHands(userId) : await getTaggedHands();
      setTaggedHands(hands);
    } catch (error) {
      logger.error('ReviewQueuePanel', error);
      setTaggedHands([]);
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Don't render until the first load resolves, and stay hidden when empty so
  // the surface only appears once the owner has actually tagged something.
  if (!loaded || taggedHands.length === 0) return null;

  return (
    <div className="mb-6 bg-gray-800 border border-amber-700/60 rounded-lg" data-testid="review-queue-panel">
      <div className="p-4 border-b border-gray-700 flex items-center gap-2">
        <Star size={18} className="text-amber-400" fill="#fbbf24" />
        <h2 className="text-lg font-bold text-amber-300">Tagged for Review</h2>
        <span className="ml-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-900/60 text-amber-300">
          {taggedHands.length}
        </span>
      </div>
      <div className="divide-y divide-gray-700">
        {taggedHands.map((hand) => (
          <button
            key={hand.handId}
            onClick={() => onOpenHand(hand.handId, hand)}
            className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
            data-testid="review-queue-row"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Star size={14} className="text-amber-400 flex-shrink-0" fill="#fbbf24" />
              <span className="text-sm font-semibold text-gray-200 truncate">
                {hand.handDisplayId || `Hand ${hand.handId}`}
              </span>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
              {formatTaggedAt(hand.reviewTag?.taggedAt)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
