import { useCallback, useMemo } from 'react';
import {
  getSmallBlindSeat as utilGetSmallBlindSeat,
  getBigBlindSeat as utilGetBigBlindSeat,
  hasSeatFolded as utilHasSeatFolded,
  getFirstActionSeat as utilGetFirstActionSeat,
  getNextActionSeat as utilGetNextActionSeat
} from '../utils/seatUtils';
import { isFoldAction, STREETS } from '../constants/gameConstants';

/**
 * Custom hook for seat-related utility functions
 * Wraps seatUtils functions with proper dependencies and constant injection
 */
export const useSeatUtils = (currentStreet, dealerButtonSeat, absentSeats, seatActions, numSeats) => {
  const getSmallBlindSeat = useMemo(() => {
    return () => utilGetSmallBlindSeat(dealerButtonSeat, absentSeats, numSeats);
  }, [dealerButtonSeat, absentSeats, numSeats]);

  const getBigBlindSeat = useMemo(() => {
    return () => utilGetBigBlindSeat(dealerButtonSeat, absentSeats, numSeats);
  }, [dealerButtonSeat, absentSeats, numSeats]);

  const hasSeatFolded = useCallback((seat) => {
    return utilHasSeatFolded(seat, currentStreet, STREETS, seatActions, isFoldAction);
  }, [currentStreet, seatActions]);

  const getFirstActionSeat = useCallback(() => {
    return utilGetFirstActionSeat(
      currentStreet,
      dealerButtonSeat,
      absentSeats,
      seatActions,
      STREETS,
      isFoldAction,
      numSeats
    );
  }, [currentStreet, dealerButtonSeat, absentSeats, seatActions, numSeats]);

  const getNextActionSeat = useCallback((currentSeat) => {
    return utilGetNextActionSeat(
      currentSeat,
      absentSeats,
      currentStreet,
      seatActions,
      STREETS,
      isFoldAction,
      numSeats
    );
  }, [absentSeats, currentStreet, seatActions, numSeats]);

  return {
    getSmallBlindSeat,
    getBigBlindSeat,
    hasSeatFolded,
    getFirstActionSeat,
    getNextActionSeat,
  };
};
