import { useCallback } from 'react';

/**
 * Custom hook for seat color styling
 * Determines background, ring, and animation classes for seat display
 * Handles absent, folded, selected, and action-based seat colors
 */
export const useSeatColor = (
  hasSeatFolded,
  selectedPlayers,
  mySeat,
  absentSeats,
  seatActions,
  currentStreet,
  getSeatActionStyle
) => {
  const getSeatColor = useCallback((seat) => {
    const foldedPreviously = hasSeatFolded(seat);
    const isSelected = selectedPlayers.includes(seat);
    const isMySeat = seat === mySeat;

    // Helper for ring color based on selection state
    const getSelectionRing = () => {
      if (isMySeat && isSelected) return 'ring-yellow-400 shadow-lg shadow-yellow-400/50 animate-pulse';
      if (isMySeat) return 'ring-purple-500';
      if (isSelected) return 'ring-yellow-400 shadow-lg shadow-yellow-400/50 animate-pulse';
      return '';
    };

    // Absent seats
    if (absentSeats.includes(seat)) {
      const ring = isMySeat ? 'ring-purple-500' : (isSelected ? 'ring-yellow-400' : '');
      return `bg-gray-900 ${ring ? `ring-4 ${ring}` : ''} text-gray-600 opacity-50 ${isSelected ? 'animate-pulse' : ''}`;
    }

    // Folded on previous street
    if (foldedPreviously) {
      const ringColor = getSelectionRing() || 'ring-red-300';
      return `bg-red-400 ring-4 ${ringColor} text-white`;
    }

    // Get action-based colors (use last action from array)
    const actions = seatActions[currentStreet]?.[seat] || [];
    const lastAction = actions[actions.length - 1]; // Get last action for color

    let baseColor = 'bg-gray-700';
    let ringColor = getSelectionRing();

    if (lastAction) {
      const style = getSeatActionStyle(lastAction);
      baseColor = style.bg;
      if (!ringColor) ringColor = style.ring;
    }

    const ring = ringColor ? `ring-4 ${ringColor}` : '';
    const hover = !lastAction && !isSelected && !isMySeat ? 'hover:bg-gray-600' : '';
    return `${baseColor} ${ring} text-white ${hover}`;
  }, [hasSeatFolded, selectedPlayers, mySeat, absentSeats, seatActions, currentStreet, getSeatActionStyle]);

  return getSeatColor;
};
