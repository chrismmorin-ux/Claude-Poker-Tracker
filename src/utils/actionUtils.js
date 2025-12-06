/**
 * actionUtils.js - Utility functions for action styling and display
 */

/**
 * Gets the display name for an action
 * @param {string} action - Action constant
 * @param {Function} isFoldAction - Function to check if action is a fold
 * @param {Object} ACTIONS - Actions constants
 * @returns {string} - Display name for the action
 */
export const getActionDisplayName = (action, isFoldAction, ACTIONS) => {
  if (isFoldAction(action)) return 'fold';

  switch (action) {
    case ACTIONS.LIMP: return 'limp';
    case ACTIONS.CALL: return 'call';
    case ACTIONS.OPEN: return 'open';
    case ACTIONS.THREE_BET: return '3bet';
    case ACTIONS.FOUR_BET: return '4bet';
    case ACTIONS.CBET_IP_SMALL: return 'cbet IP (S)';
    case ACTIONS.CBET_IP_LARGE: return 'cbet IP (L)';
    case ACTIONS.CBET_OOP_SMALL: return 'cbet OOP (S)';
    case ACTIONS.CBET_OOP_LARGE: return 'cbet OOP (L)';
    case ACTIONS.CHECK: return 'check';
    case ACTIONS.CHECK_RAISE: return 'check-raise';
    case ACTIONS.DONK: return 'donk';
    case ACTIONS.STAB: return 'stab';
    case ACTIONS.MUCKED: return 'muck';
    case ACTIONS.WON: return 'won';
    case ACTIONS.FOLD_TO_CBET: return 'fold to cbet';
    case ACTIONS.FOLD_TO_CR: return 'fold to CR';
    default: return action || '';
  }
};

/**
 * Gets Tailwind classes for action color (used in showdown summary)
 * @param {string} action - Action constant
 * @param {Function} isFoldAction - Function to check if action is a fold
 * @param {Object} ACTIONS - Actions constants
 * @returns {string} - Tailwind classes
 */
export const getActionColor = (action, isFoldAction, ACTIONS) => {
  if (isFoldAction(action)) {
    return 'bg-red-300 text-red-900';
  }

  switch (action) {
    case ACTIONS.LIMP:
      return 'bg-gray-300 text-gray-900';
    case ACTIONS.CALL:
    case ACTIONS.CHECK:
      return 'bg-blue-200 text-blue-900';
    case ACTIONS.OPEN:
      return 'bg-green-300 text-green-900';
    case ACTIONS.THREE_BET:
    case ACTIONS.STAB:
      return 'bg-yellow-300 text-yellow-900';
    case ACTIONS.FOUR_BET:
    case ACTIONS.DONK:
    case ACTIONS.CHECK_RAISE:
      return 'bg-orange-300 text-orange-900';
    case ACTIONS.CBET_IP_SMALL:
    case ACTIONS.CBET_IP_LARGE:
    case ACTIONS.CBET_OOP_SMALL:
    case ACTIONS.CBET_OOP_LARGE:
      return 'bg-green-200 text-green-900';
    case ACTIONS.MUCKED:
      return 'bg-gray-400 text-gray-900';
    case ACTIONS.WON:
      return 'bg-green-400 text-green-900';
    default:
      return 'bg-gray-100 text-gray-900';
  }
};

/**
 * Gets seat background and ring colors based on action (used in table view)
 * @param {string} action - Action constant
 * @param {Function} isFoldAction - Function to check if action is a fold
 * @param {Object} ACTIONS - Actions constants
 * @returns {Object} - {bg, ring} with Tailwind classes
 */
export const getSeatActionStyle = (action, isFoldAction, ACTIONS) => {
  if (isFoldAction(action)) {
    return { bg: 'bg-red-400', ring: 'ring-red-300' };
  }

  switch (action) {
    case ACTIONS.LIMP:
      return { bg: 'bg-gray-400', ring: 'ring-gray-300' };
    case ACTIONS.CALL:
    case ACTIONS.CHECK:
      return { bg: 'bg-blue-300', ring: 'ring-blue-200' };
    case ACTIONS.OPEN:
      return { bg: 'bg-green-400', ring: 'ring-green-300' };
    case ACTIONS.THREE_BET:
    case ACTIONS.STAB:
      return { bg: 'bg-yellow-400', ring: 'ring-yellow-300' };
    case ACTIONS.FOUR_BET:
    case ACTIONS.DONK:
    case ACTIONS.CHECK_RAISE:
      return { bg: 'bg-orange-400', ring: 'ring-orange-300' };
    case ACTIONS.CBET_IP_SMALL:
    case ACTIONS.CBET_IP_LARGE:
    case ACTIONS.CBET_OOP_SMALL:
    case ACTIONS.CBET_OOP_LARGE:
      return { bg: 'bg-green-500', ring: 'ring-green-300' };
    default:
      return { bg: 'bg-green-500', ring: 'ring-green-300' };
  }
};

/**
 * Determines overlay status for showdown view
 * @param {string} inactiveStatus - Inactive status (SEAT_STATUS.FOLDED or SEAT_STATUS.ABSENT)
 * @param {boolean} isMucked - Whether seat mucked
 * @param {boolean} hasWon - Whether seat won
 * @param {Object} SEAT_STATUS - Seat status constants
 * @returns {string|null} - Status string or null
 */
export const getOverlayStatus = (inactiveStatus, isMucked, hasWon, SEAT_STATUS) => {
  if (inactiveStatus === SEAT_STATUS.FOLDED) return SEAT_STATUS.FOLDED;
  if (inactiveStatus === SEAT_STATUS.ABSENT) return SEAT_STATUS.ABSENT;
  if (isMucked) return 'mucked';
  if (hasWon) return 'won';
  return null;
};

/**
 * Gets seat action summary for display
 * @param {number} seat - Seat number
 * @param {Array} streets - Array of street names
 * @param {Object} seatActions - Seat actions object
 * @param {Function} getActionDisplayName - Function to get action display name
 * @param {Function} getHandAbbreviation - Function to get hand abbreviation
 * @param {number} mySeat - Player's seat
 * @param {Array} holeCards - Player's hole cards
 * @param {Object} allPlayerCards - All player cards
 * @param {Object} ACTIONS - Actions constants
 * @returns {Array} - Array of action strings
 */
export const getSeatActionSummary = (
  seat,
  streets,
  seatActions,
  getActionDisplayName,
  getHandAbbreviation,
  mySeat,
  holeCards,
  allPlayerCards,
  ACTIONS
) => {
  const actions = [];

  streets.forEach(street => {
    const streetActions = seatActions[street]?.[seat];
    // Handle both array (new format) and single value (old format)
    const actionArray = Array.isArray(streetActions) ? streetActions : (streetActions ? [streetActions] : []);

    if (actionArray.length > 0) {
      // For hand history, show all actions in sequence
      actionArray.forEach(action => {
        let displayAction = getActionDisplayName(action);

        if (street === 'showdown' && action !== ACTIONS.MUCKED) {
          // For showdown, add cards if available
          const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
          const handAbbr = getHandAbbreviation(cards);
          if (handAbbr) {
            displayAction = `show ${handAbbr}`;
          } else {
            displayAction = 'show';
          }
        }

        actions.push(`${street} ${displayAction}`);
      });
    }
  });

  return actions;
};

/**
 * Checks if all cards are assigned in showdown
 * @param {number} numSeats - Total number of seats
 * @param {Function} isSeatInactive - Function to check if seat is inactive
 * @param {Object} seatActions - Seat actions object
 * @param {Object} ACTIONS - Actions constants
 * @param {Object} SEAT_STATUS - Seat status constants
 * @param {number} mySeat - Player's seat
 * @param {Array} holeCards - Player's hole cards
 * @param {Object} allPlayerCards - All player cards
 * @returns {boolean} - True if all cards assigned
 */
export const allCardsAssigned = (
  numSeats,
  isSeatInactive,
  seatActions,
  ACTIONS,
  SEAT_STATUS,
  mySeat,
  holeCards,
  allPlayerCards
) => {
  for (let seat = 1; seat <= numSeats; seat++) {
    const inactiveStatus = isSeatInactive(seat);
    const showdownActions = seatActions['showdown']?.[seat];
    const actionsArray = Array.isArray(showdownActions) ? showdownActions : (showdownActions ? [showdownActions] : []);
    const isMucked = actionsArray.includes(ACTIONS.MUCKED);
    const hasWon = actionsArray.includes(ACTIONS.WON);

    // Skip folded, absent, mucked, and won seats
    if (inactiveStatus === SEAT_STATUS.FOLDED || inactiveStatus === SEAT_STATUS.ABSENT || isMucked || hasWon) {
      continue;
    }

    // Check if this active seat has both cards
    const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
    if (!cards[0] || !cards[1]) {
      return false;
    }
  }
  return true;
};

/**
 * Gets action abbreviation (3-4 chars max) for badge display
 * @param {string} action - Action constant
 * @param {Object} ACTION_ABBREV - Abbreviation map
 * @returns {string} - Abbreviated action
 */
export const getActionAbbreviation = (action, ACTION_ABBREV) => {
  return ACTION_ABBREV[action] || action?.substring(0, 3).toUpperCase() || '???';
};

/**
 * Gets the last action from an action array (handles backward compatibility)
 * @param {string|string[]|undefined} actions - Action or action array
 * @returns {string|null} - Last action or null
 */
export const getLastAction = (actions) => {
  if (!actions) return null;
  if (typeof actions === 'string') return actions; // Old format (backward compat)
  if (Array.isArray(actions)) return actions[actions.length - 1] || null; // New format
  return null;
};

/**
 * Normalizes action data for backward compatibility
 * Converts string actions to arrays for new format
 * @param {string|string[]|undefined} action - Action data
 * @returns {string[]} - Array of actions
 */
export const normalizeActionData = (action) => {
  if (!action) return [];
  if (typeof action === 'string') return [action]; // Old format → convert to array
  if (Array.isArray(action)) return action; // New format → return as-is
  return [];
};

/**
 * Gets action sequence display string
 * @param {string[]} actions - Array of actions
 * @param {Function} getActionDisplayName - Display name function
 * @returns {string} - Formatted sequence (e.g., "open → 3bet → call")
 */
export const getActionSequenceDisplay = (actions, getActionDisplayName) => {
  if (!actions || actions.length === 0) return '';
  return actions.map(a => getActionDisplayName(a)).join(' → ');
};
