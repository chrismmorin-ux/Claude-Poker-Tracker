/**
 * seatUtils.js - Utility functions for seat navigation and position calculation
 */

/**
 * Gets the next seat in clockwise order, skipping absent seats
 * @param {number} currentSeat - Current seat number
 * @param {Array} absentSeats - Array of absent seat numbers
 * @param {number} numSeats - Total number of seats
 * @returns {number} - Next active seat
 */
export const getNextActiveSeat = (currentSeat, absentSeats, numSeats) => {
  let seat = (currentSeat % numSeats) + 1;
  let attempts = 0;
  while (absentSeats.includes(seat) && attempts < numSeats) {
    seat = (seat % numSeats) + 1;
    attempts++;
  }
  return seat;
};

/**
 * Gets the small blind seat (first active seat after dealer)
 * @param {number} dealerSeat - Dealer button seat
 * @param {Array} absentSeats - Array of absent seat numbers
 * @param {number} numSeats - Total number of seats
 * @returns {number} - Small blind seat
 */
export const getSmallBlindSeat = (dealerSeat, absentSeats, numSeats) => {
  return getNextActiveSeat(dealerSeat, absentSeats, numSeats);
};

/**
 * Gets the big blind seat (first active seat after small blind)
 * @param {number} dealerSeat - Dealer button seat
 * @param {Array} absentSeats - Array of absent seat numbers
 * @param {number} numSeats - Total number of seats
 * @returns {number} - Big blind seat
 */
export const getBigBlindSeat = (dealerSeat, absentSeats, numSeats) => {
  const sbSeat = getSmallBlindSeat(dealerSeat, absentSeats, numSeats);
  return getNextActiveSeat(sbSeat, absentSeats, numSeats);
};

/**
 * Checks if a seat has folded on current or previous streets
 * @param {number} seat - Seat to check
 * @param {string} currentStreet - Current street
 * @param {Array} streets - Array of street names
 * @param {Object} seatActions - Seat actions object
 * @param {Function} isFoldAction - Function to check if action is a fold
 * @returns {boolean} - True if seat has folded
 */
export const hasSeatFolded = (seat, currentStreet, streets, seatActions, isFoldAction) => {
  const currentIndex = streets.indexOf(currentStreet);

  for (let i = 0; i <= currentIndex; i++) {
    const street = streets[i];
    const action = seatActions[street]?.[seat];
    if (isFoldAction(action)) {
      return true;
    }
  }
  return false;
};

/**
 * Gets the first seat to act on current street
 * @param {string} currentStreet - Current street
 * @param {number} dealerSeat - Dealer button seat
 * @param {Array} absentSeats - Array of absent seat numbers
 * @param {Object} seatActions - Seat actions object
 * @param {Array} streets - Array of street names
 * @param {Function} isFoldAction - Function to check if action is a fold
 * @param {number} numSeats - Total number of seats
 * @returns {number} - First action seat
 */
export const getFirstActionSeat = (
  currentStreet,
  dealerSeat,
  absentSeats,
  seatActions,
  streets,
  isFoldAction,
  numSeats
) => {
  if (currentStreet === 'preflop') {
    // First to act preflop is after big blind
    const sbSeat = getSmallBlindSeat(dealerSeat, absentSeats, numSeats);
    const bbSeat = getNextActiveSeat(sbSeat, absentSeats, numSeats);
    let seat = (bbSeat % numSeats) + 1;
    let attempts = 0;
    while (absentSeats.includes(seat) && attempts < numSeats) {
      seat = (seat % numSeats) + 1;
      attempts++;
    }
    return seat;
  } else {
    // Postflop, first to act is first non-absent, non-folded seat after dealer
    let seat = (dealerSeat % numSeats) + 1;
    let attempts = 0;
    while (attempts < numSeats) {
      if (!absentSeats.includes(seat) && !hasSeatFolded(seat, currentStreet, streets, seatActions, isFoldAction)) {
        return seat;
      }
      seat = (seat % numSeats) + 1;
      attempts++;
    }
    return 1; // Fallback
  }
};

/**
 * Gets the next seat to act after current seat
 * @param {number} currentSeat - Current seat
 * @param {Array} absentSeats - Array of absent seat numbers
 * @param {string} currentStreet - Current street
 * @param {Object} seatActions - Seat actions object
 * @param {Array} streets - Array of street names
 * @param {Function} isFoldAction - Function to check if action is a fold
 * @param {number} numSeats - Total number of seats
 * @returns {number|null} - Next action seat or null if no more seats
 */
export const getNextActionSeat = (
  currentSeat,
  absentSeats,
  currentStreet,
  seatActions,
  streets,
  isFoldAction,
  numSeats
) => {
  let seat = (currentSeat % numSeats) + 1;
  let attempts = 0;
  while (attempts < numSeats) {
    if (!absentSeats.includes(seat) && !hasSeatFolded(seat, currentStreet, streets, seatActions, isFoldAction)) {
      return seat;
    }
    seat = (seat % numSeats) + 1;
    attempts++;
  }
  return null; // No more seats to act
};

/**
 * Finds the closest seat to a given position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Array} seatPositions - Array of seat position objects {seat, x, y}
 * @param {Object} rect - Bounding rectangle {width, height}
 * @param {Array} absentSeats - Array of absent seats to skip
 * @returns {number} - Closest seat number
 */
export const findClosestSeat = (x, y, seatPositions, rect, absentSeats) => {
  let closestSeat = 1;
  let minDist = Infinity;

  seatPositions.forEach(({ seat, x: sx, y: sy }) => {
    // Skip absent seats
    if (absentSeats.includes(seat)) return;

    const seatX = (sx / 100) * rect.width;
    const seatY = (sy / 100) * rect.height;
    const dist = Math.sqrt((x - seatX) ** 2 + (y - seatY) ** 2);
    if (dist < minDist) {
      minDist = dist;
      closestSeat = seat;
    }
  });

  return closestSeat;
};

/**
 * Calculates context menu position based on seat
 * @param {Object} seatPosition - Seat position {x, y} in percentages
 * @param {number} tableOffsetX - Table X offset
 * @param {number} tableOffsetY - Table Y offset
 * @param {number} tableWidth - Table width
 * @param {number} tableHeight - Table height
 * @param {number} menuOffsetX - Menu X offset (default -160)
 * @param {number} menuOffsetY - Menu Y offset (default -20)
 * @returns {Object} - {x, y} position for context menu
 */
export const calculateContextMenuPosition = (
  seatPosition,
  tableOffsetX,
  tableOffsetY,
  tableWidth,
  tableHeight,
  menuOffsetX = -160,
  menuOffsetY = -20
) => {
  const seatX = (seatPosition.x / 100) * tableWidth + tableOffsetX;
  const seatY = (seatPosition.y / 100) * tableHeight + tableOffsetY;

  return {
    x: seatX + menuOffsetX,
    y: seatY + menuOffsetY
  };
};
