import { useEffect, useRef, useCallback } from 'react';

/**
 * useAutoSeatSelection - Auto-selects first action seat on mount, street change, or card selector close
 * @param {boolean} showCardSelector - Whether card selector is open
 * @param {string} currentStreet - Current street name
 * @param {Function} getFirstActionSeat - Returns first seat that needs to act
 * @param {Function} setSelectedPlayers - Named handler from UIContext
 * @returns {{ scheduleAutoSelect: Function }} Deferred auto-select for use after state resets
 */
export const useAutoSeatSelection = (showCardSelector, currentStreet, getFirstActionSeat, setSelectedPlayers) => {
  const getFirstActionSeatRef = useRef(getFirstActionSeat);
  getFirstActionSeatRef.current = getFirstActionSeat;
  const prevShowCardSelectorRef = useRef(showCardSelector);
  const prevStreetRef = useRef(currentStreet);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const wasOpen = prevShowCardSelectorRef.current;
    const wasStreet = prevStreetRef.current;
    prevShowCardSelectorRef.current = showCardSelector;
    prevStreetRef.current = currentStreet;

    if (showCardSelector || currentStreet === 'showdown') return;

    // Card selector just closed — always auto-select
    if (wasOpen) {
      const firstSeat = getFirstActionSeatRef.current();
      if (firstSeat) {
        setSelectedPlayers([firstSeat]);
      }
      return;
    }

    // First mount or street changed — auto-select first seat
    if (!hasMountedRef.current || wasStreet !== currentStreet) {
      hasMountedRef.current = true;
      const firstSeat = getFirstActionSeatRef.current();
      if (firstSeat) {
        setSelectedPlayers([firstSeat]);
      }
    }
  }, [showCardSelector, currentStreet, setSelectedPlayers]);

  const scheduleAutoSelect = useCallback(() => {
    setTimeout(() => {
      const firstSeat = getFirstActionSeatRef.current();
      if (firstSeat) {
        setSelectedPlayers([firstSeat]);
      }
    }, 0);
  }, [setSelectedPlayers]);

  return { scheduleAutoSelect };
};
