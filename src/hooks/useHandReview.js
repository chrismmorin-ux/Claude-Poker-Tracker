/**
 * useHandReview.js - State management for hand review panel
 *
 * Manages hand list loading, hand selection, street navigation,
 * and focused action tracking for the hand review feature.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { getAllHands, getHandsBySessionId, GUEST_USER_ID } from '../utils/persistence/index';
import { buildTimeline, getStreetTimeline } from '../utils/handTimeline';
import { getAvailableStreets } from '../utils/handReviewAnalyzer';
import { getCardsForStreet } from '../utils/pokerCore/cardParser';

export const useHandReview = (userId = GUEST_USER_ID) => {
  const [hands, setHands] = useState([]);
  const [selectedHandId, setSelectedHandId] = useState(null);
  const [currentStreet, setCurrentStreet] = useState('preflop');
  const [focusedActionIndex, setFocusedActionIndex] = useState(null);
  const [filterPlayerId, setFilterPlayerId] = useState(null);
  const [filterSessionId, setFilterSessionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load hands based on filters
  const loadHands = useCallback(async () => {
    setIsLoading(true);
    try {
      let loaded;
      if (filterSessionId) {
        loaded = await getHandsBySessionId(Number(filterSessionId));
      } else {
        loaded = await getAllHands(userId);
      }

      // Filter by player if needed
      if (filterPlayerId) {
        loaded = loaded.filter(h => {
          const sp = h.seatPlayers || {};
          return Object.values(sp).some(id => String(id) === String(filterPlayerId));
        });
      }

      // Sort by timestamp descending (most recent first)
      loaded.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setHands(loaded);
    } catch (e) {
      console.error('useHandReview: failed to load hands', e);
      setHands([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, filterSessionId, filterPlayerId]);

  useEffect(() => {
    loadHands();
  }, [loadHands]);

  // Selected hand
  const selectedHand = useMemo(
    () => hands.find(h => (h.handId ?? h.id) === selectedHandId) || null,
    [hands, selectedHandId]
  );

  // Timeline for selected hand
  const timeline = useMemo(
    () => selectedHand ? buildTimeline(selectedHand) : [],
    [selectedHand]
  );

  // Available streets
  const availableStreets = useMemo(
    () => getAvailableStreets(timeline),
    [timeline]
  );

  // Actions for current street
  const streetActions = useMemo(
    () => getStreetTimeline(timeline, currentStreet),
    [timeline, currentStreet]
  );

  // Community cards for current street
  const communityCardsForStreet = useMemo(() => {
    const cards = selectedHand?.cardState?.communityCards ||
                  selectedHand?.gameState?.communityCards || [];
    return getCardsForStreet(cards, currentStreet);
  }, [selectedHand, currentStreet]);

  // Hero seat
  const heroSeat = selectedHand?.gameState?.mySeat ?? null;

  // Focused action
  const focusedAction = useMemo(() => {
    if (focusedActionIndex === null) return null;
    return timeline[focusedActionIndex] || null;
  }, [timeline, focusedActionIndex]);

  // Select a hand
  const selectHand = useCallback((handId) => {
    setSelectedHandId(handId);
    setCurrentStreet('preflop');
    setFocusedActionIndex(null);
  }, []);

  // Focus a specific action (by timeline index)
  const focusAction = useCallback((timelineIndex) => {
    setFocusedActionIndex(timelineIndex);
  }, []);

  // Street navigation
  const nextStreet = useCallback(() => {
    const idx = availableStreets.indexOf(currentStreet);
    if (idx < availableStreets.length - 1) {
      setCurrentStreet(availableStreets[idx + 1]);
      setFocusedActionIndex(null);
    }
  }, [availableStreets, currentStreet]);

  const prevStreet = useCallback(() => {
    const idx = availableStreets.indexOf(currentStreet);
    if (idx > 0) {
      setCurrentStreet(availableStreets[idx - 1]);
      setFocusedActionIndex(null);
    }
  }, [availableStreets, currentStreet]);

  return {
    hands,
    selectedHand,
    selectedHandId,
    timeline,
    currentStreet,
    availableStreets,
    streetActions,
    communityCardsForStreet,
    heroSeat,
    focusedAction,
    focusedActionIndex,
    isLoading,
    filterPlayerId,
    filterSessionId,
    selectHand,
    setCurrentStreet,
    focusAction,
    nextStreet,
    prevStreet,
    setFilterPlayerId,
    setFilterSessionId,
    refresh: loadHands,
  };
};
