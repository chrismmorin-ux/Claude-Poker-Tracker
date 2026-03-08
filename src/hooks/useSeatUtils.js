import { useCallback, useMemo } from 'react';
import { hasSeatFolded as utilHasSeatFolded } from '../utils/sequenceUtils';
import {
  getFirstActionSeat as utilGetFirstActionSeat,
  getNextActionSeat as utilGetNextActionSeat,
  isStreetActionComplete as utilIsStreetActionComplete,
  getActiveSeatCount as utilGetActiveSeatCount
} from '../utils/seatUtils';

/**
 * Custom hook for seat-related utility functions
 * Wraps seatUtils functions with proper dependencies
 * Note: smallBlindSeat/bigBlindSeat live in GameContext (useGame())
 */
export const useSeatUtils = (currentStreet, dealerButtonSeat, absentSeats, actionSequence, numSeats) => {
  const hasSeatFolded = useCallback((seat) => {
    return utilHasSeatFolded(actionSequence, seat);
  }, [actionSequence]);

  const getFirstActionSeat = useCallback(() => {
    return utilGetFirstActionSeat(
      currentStreet,
      dealerButtonSeat,
      absentSeats,
      actionSequence,
      numSeats
    );
  }, [currentStreet, dealerButtonSeat, absentSeats, actionSequence, numSeats]);

  const getNextActionSeat = useCallback((currentSeat) => {
    return utilGetNextActionSeat(
      currentSeat,
      absentSeats,
      actionSequence,
      numSeats
    );
  }, [absentSeats, actionSequence, numSeats]);

  const isStreetComplete = useCallback((seq) => {
    return utilIsStreetActionComplete(
      currentStreet,
      seq,
      absentSeats,
      numSeats
    );
  }, [currentStreet, absentSeats, numSeats]);

  const activeSeatCount = useMemo(
    () => utilGetActiveSeatCount(actionSequence, absentSeats, numSeats),
    [actionSequence, absentSeats, numSeats]
  );

  return {
    hasSeatFolded,
    getFirstActionSeat,
    getNextActionSeat,
    isStreetComplete,
    activeSeatCount,
  };
};
