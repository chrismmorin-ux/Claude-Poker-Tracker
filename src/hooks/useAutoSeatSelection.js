import { useEffect, useRef, useCallback } from 'react';
import { UI_ACTIONS } from '../reducers/uiReducer';

/**
 * useAutoSeatSelection - Auto-selects first action seat on mount, street change, or card selector close
 * @param {boolean} showCardSelector - Whether card selector is open
 * @param {string} currentStreet - Current street name
 * @param {Function} getFirstActionSeat - Returns first seat that needs to act
 * @param {Function} dispatchUi - UI dispatcher
 * @returns {{ scheduleAutoSelect: Function }} Deferred auto-select for use after state resets
 */
export const useAutoSeatSelection = (showCardSelector, currentStreet, getFirstActionSeat, dispatchUi) => {
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
        dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: [firstSeat] });
      }
      return;
    }

    // First mount or street changed — auto-select first seat
    if (!hasMountedRef.current || wasStreet !== currentStreet) {
      hasMountedRef.current = true;
      const firstSeat = getFirstActionSeatRef.current();
      if (firstSeat) {
        dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: [firstSeat] });
      }
    }
  }, [showCardSelector, currentStreet, dispatchUi]);

  const scheduleAutoSelect = useCallback(() => {
    setTimeout(() => {
      const firstSeat = getFirstActionSeatRef.current();
      if (firstSeat) {
        dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: [firstSeat] });
      }
    }, 0);
  }, [dispatchUi]);

  return { scheduleAutoSelect };
};
