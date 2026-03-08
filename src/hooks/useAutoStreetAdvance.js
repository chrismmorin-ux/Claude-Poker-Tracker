import { useEffect, useRef } from 'react';

/**
 * useAutoStreetAdvance - Auto-advances to next street when all actions complete
 * @param {Array} actionSequence - Current action sequence
 * @param {string} currentStreet - Current street name
 * @param {boolean} showCardSelector - Whether card selector is open
 * @param {Function} isStreetComplete - Checks if all seats have acted
 * @param {Function} nextStreet - Advances to next street
 * @param {number} activeSeatCount - Number of non-folded seats
 * @param {Function} setCurrentStreet - Sets street directly
 * @param {Function} openShowdownScreen - Opens showdown view
 */
export const useAutoStreetAdvance = (
  actionSequence, currentStreet, showCardSelector,
  isStreetComplete, nextStreet, activeSeatCount,
  setCurrentStreet, openShowdownScreen
) => {
  const prevActionSeqLenRef = useRef(actionSequence.length);

  useEffect(() => {
    const prevLen = prevActionSeqLenRef.current;
    prevActionSeqLenRef.current = actionSequence.length;

    // Only check on action additions (not undo/clear which shrink the sequence)
    if (actionSequence.length <= prevLen) return;
    // Don't auto-advance on showdown or if card selector is open
    if (currentStreet === 'showdown' || showCardSelector) return;

    if (isStreetComplete(actionSequence)) {
      // If only 1 player remains (everyone else folded), go straight to showdown
      if (activeSeatCount <= 1) {
        setCurrentStreet('showdown');
        openShowdownScreen();
      } else {
        nextStreet();
      }
    }
  }, [actionSequence, currentStreet, showCardSelector, isStreetComplete, nextStreet, activeSeatCount, setCurrentStreet, openShowdownScreen]);
};
