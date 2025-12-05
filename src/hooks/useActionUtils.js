import { useCallback } from 'react';
import {
  getActionDisplayName as utilGetActionDisplayName,
  getActionColor as utilGetActionColor,
  getSeatActionStyle as utilGetSeatActionStyle,
  getOverlayStatus as utilGetOverlayStatus
} from '../utils/actionUtils';
import {
  getCardAbbreviation as utilGetCardAbbreviation,
  getHandAbbreviation as utilGetHandAbbreviation
} from '../utils/displayUtils';
import { isFoldAction, ACTIONS, SEAT_STATUS, SUIT_ABBREV } from '../constants/gameConstants';

/**
 * Custom hook to provide action utility functions with constants injected
 * Consolidates 6 wrapped utility functions into a single hook
 */
export const useActionUtils = () => {
  const getActionDisplayName = useCallback(
    (action) => utilGetActionDisplayName(action, isFoldAction, ACTIONS),
    []
  );

  const getActionColor = useCallback(
    (action) => utilGetActionColor(action, isFoldAction, ACTIONS),
    []
  );

  const getSeatActionStyle = useCallback(
    (action) => utilGetSeatActionStyle(action, isFoldAction, ACTIONS),
    []
  );

  const getOverlayStatus = useCallback(
    (inactiveStatus, isMucked, hasWon) =>
      utilGetOverlayStatus(inactiveStatus, isMucked, hasWon, SEAT_STATUS),
    []
  );

  const getCardAbbreviation = useCallback(
    (card) => utilGetCardAbbreviation(card, SUIT_ABBREV),
    []
  );

  const getHandAbbreviation = useCallback(
    (cards) => utilGetHandAbbreviation(cards, SUIT_ABBREV),
    []
  );

  return {
    getActionDisplayName,
    getActionColor,
    getSeatActionStyle,
    getOverlayStatus,
    getCardAbbreviation,
    getHandAbbreviation,
  };
};
