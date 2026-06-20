import { useEffect, useRef, useCallback } from 'react';
import { logAutoSelectFiring } from '../utils/dev/seatSelectionTelemetry';

/**
 * useAutoSeatSelection - Auto-selects first action seat on mount, street change, or card selector close
 * @param {boolean} showCardSelector - Whether card selector is open
 * @param {string} currentStreet - Current street name
 * @param {Function} getFirstActionSeat - Returns first seat that needs to act
 * @param {Function} setSelectedPlayers - Named handler from UIContext
 * @param {Array} [selectedPlayers] - Current selection (optional, telemetry-only — used by WS-189 Phase 1
 *   to log H3 multi-seat-clobber evidence; does NOT change behavior or trigger re-runs)
 * @returns {{ scheduleAutoSelect: Function }} Deferred auto-select for use after state resets
 */
export const useAutoSeatSelection = (showCardSelector, currentStreet, getFirstActionSeat, setSelectedPlayers, selectedPlayers) => {
  const getFirstActionSeatRef = useRef(getFirstActionSeat);
  getFirstActionSeatRef.current = getFirstActionSeat;
  // Mirror selectedPlayers as a ref so the firing effect can read current
  // selection at log time without re-running on every selection change.
  const selectedPlayersRef = useRef(selectedPlayers);
  selectedPlayersRef.current = selectedPlayers;
  const prevShowCardSelectorRef = useRef(showCardSelector);
  const prevStreetRef = useRef(currentStreet);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const wasOpen = prevShowCardSelectorRef.current;
    const wasStreet = prevStreetRef.current;
    prevShowCardSelectorRef.current = showCardSelector;
    prevStreetRef.current = currentStreet;

    if (showCardSelector || currentStreet === 'showdown') return;

    // INV-SEAT-SELECTION-4 (override contract): a manual multi-seat queue
    // (selectedPlayers.length > 1) is explicit user intent — only the user can
    // produce a length>1 selection, since autoselect only ever sets a single
    // seat. Mount and card-selector-close are PASSIVE transitions and must NOT
    // overwrite it. Street change is a new-round signal and DOES reset.
    const currentSelection = selectedPlayersRef.current;
    const hasManualQueue = Array.isArray(currentSelection) && currentSelection.length > 1;

    // Card selector just closed — passive transition, respect a manual queue.
    if (wasOpen) {
      const firstSeat = getFirstActionSeatRef.current();
      logAutoSelectFiring({
        trigger: 'selector-close',
        currentStreet,
        prevStreet: wasStreet,
        candidateSeat: firstSeat,
        currentSelection,
        action: hasManualQueue
          ? 'noop-respect-manual-queue'
          : firstSeat ? 'set' : 'noop-empty-candidate',
      });
      if (!hasManualQueue && firstSeat) {
        setSelectedPlayers([firstSeat]);
      }
      return;
    }

    // First mount or street changed — auto-select first seat
    if (!hasMountedRef.current || wasStreet !== currentStreet) {
      const isStreetChange = hasMountedRef.current && wasStreet !== currentStreet;
      const trigger = !hasMountedRef.current ? 'mount' : 'street-change';
      hasMountedRef.current = true;
      // Street change unconditionally resets; mount is passive (respects queue).
      const willOverride = isStreetChange || !hasManualQueue;
      const firstSeat = getFirstActionSeatRef.current();
      logAutoSelectFiring({
        trigger,
        currentStreet,
        prevStreet: wasStreet,
        candidateSeat: firstSeat,
        currentSelection,
        action: !willOverride
          ? 'noop-respect-manual-queue'
          : firstSeat ? 'set' : 'noop-empty-candidate',
      });
      if (willOverride && firstSeat) {
        setSelectedPlayers([firstSeat]);
      }
    }
  }, [showCardSelector, currentStreet, setSelectedPlayers]);

  const scheduleAutoSelect = useCallback(() => {
    setTimeout(() => {
      const firstSeat = getFirstActionSeatRef.current();
      logAutoSelectFiring({
        trigger: 'scheduled',
        currentStreet: prevStreetRef.current,
        prevStreet: prevStreetRef.current,
        candidateSeat: firstSeat,
        currentSelection: selectedPlayersRef.current,
        action: firstSeat ? 'set' : 'noop-empty-candidate',
      });
      if (firstSeat) {
        setSelectedPlayers([firstSeat]);
      }
    }, 0);
  }, [setSelectedPlayers]);

  return { scheduleAutoSelect };
};
