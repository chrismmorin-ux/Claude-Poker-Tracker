import { useCallback } from 'react';
import { getActionsForSeatOnStreet } from '../utils/sequenceUtils';
import { getSeatActionStyle } from '../utils/actionUtils';
import { ACTION_COLORS } from '../constants/designTokens';

/**
 * Custom hook for seat color styling
 * Returns { className, style } tuples for seat display.
 * className has structural Tailwind (ring size, animation, hover, text, opacity).
 * style has color hex values (backgroundColor, --tw-ring-color).
 */
export const useSeatColor = ({
  hasSeatFolded,
  selectedPlayers,
  mySeat,
  absentSeats,
  actionSequence,
  currentStreet,
  smallBlindSeat,
  bigBlindSeat,
}) => {
  const getSeatColor = useCallback((seat) => {
    const foldedPreviously = hasSeatFolded(seat);
    const isSelected = selectedPlayers.includes(seat);
    const isMySeat = seat === mySeat;

    // Helper for selection ring (returns { className, ringHex } or null)
    const getSelectionRing = () => {
      if (isMySeat && isSelected) return { className: 'ring-4 shadow-lg shadow-yellow-400/50 animate-pulse', ringHex: '#facc15' }; // yellow-400
      if (isMySeat) return { className: 'ring-4', ringHex: '#a855f7' }; // purple-500
      if (isSelected) return { className: 'ring-4 shadow-lg shadow-yellow-400/50 animate-pulse', ringHex: '#facc15' }; // yellow-400
      return null;
    };

    // Absent seats
    if (absentSeats.includes(seat)) {
      const sel = getSelectionRing();
      return {
        className: `${sel ? sel.className : ''} text-gray-600 opacity-50 ${isSelected ? 'animate-pulse' : ''}`,
        style: {
          backgroundColor: '#111827', // gray-900
          ...(sel ? { '--tw-ring-color': sel.ringHex } : {}),
        },
      };
    }

    // Folded on previous street
    if (foldedPreviously) {
      const sel = getSelectionRing();
      return {
        className: `ring-4 text-white opacity-60`,
        style: {
          backgroundColor: ACTION_COLORS.fold.base,
          '--tw-ring-color': sel ? sel.ringHex : '#fca5a5', // red-300 default
        },
      };
    }

    // Get action-based colors (use last action from actionSequence)
    const actions = getActionsForSeatOnStreet(actionSequence, seat, currentStreet);
    const lastAction = actions[actions.length - 1];

    const sel = getSelectionRing();
    let bgHex = '#374151'; // gray-700
    let ringHex = sel ? sel.ringHex : null;

    if (lastAction) {
      const actionStyle = getSeatActionStyle(lastAction);
      bgHex = actionStyle.bg;
      if (!ringHex) ringHex = actionStyle.ring;
    } else if (currentStreet === 'preflop' && (seat === smallBlindSeat || seat === bigBlindSeat)) {
      // Blind seats on preflop with no action yet — show forced-bet color
      const blindStyle = getSeatActionStyle('blind');
      bgHex = blindStyle.bg;
      if (!ringHex) ringHex = blindStyle.ring;
    }

    const hover = !lastAction && !isSelected && !isMySeat ? 'hover:bg-gray-600' : '';
    return {
      className: `${ringHex ? (sel ? sel.className : 'ring-4') : ''} text-white ${hover}`,
      style: {
        backgroundColor: bgHex,
        ...(ringHex ? { '--tw-ring-color': ringHex } : {}),
      },
    };
  }, [hasSeatFolded, selectedPlayers, mySeat, absentSeats, actionSequence, currentStreet, smallBlindSeat, bigBlindSeat]);

  return getSeatColor;
};
