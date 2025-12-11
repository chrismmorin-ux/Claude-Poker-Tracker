/**
 * positionUtils.js - Position-related utilities for pattern recognition
 *
 * Determines player positions relative to the button and provides
 * context for pattern detection (IP/OOP, position names, etc.)
 *
 * @module patternRecognition/positionUtils
 */

import { LIMITS } from '../../constants/gameConstants';

/**
 * Position names in clockwise order from button
 * Index 0 = Button (BTN), Index 1 = Small Blind (SB), etc.
 */
export const POSITION_NAMES = [
  'BTN',  // Button
  'SB',   // Small Blind
  'BB',   // Big Blind
  'UTG',  // Under the Gun
  'UTG+1',
  'MP1',  // Middle Position
  'MP2',
  'HJ',   // Hijack
  'CO',   // Cutoff
];

/**
 * Position categories for filtering/grouping
 */
export const POSITION_CATEGORIES = {
  BLINDS: ['SB', 'BB'],
  EARLY: ['UTG', 'UTG+1'],
  MIDDLE: ['MP1', 'MP2'],
  LATE: ['HJ', 'CO', 'BTN'],
};

/**
 * Get position name for a seat relative to button
 *
 * @param {number} seat - Seat number (1-9)
 * @param {number} buttonSeat - Button seat number (1-9)
 * @returns {string} Position name (BTN, SB, BB, UTG, etc.)
 */
export const getPositionName = (seat, buttonSeat) => {
  if (!seat || !buttonSeat) return 'Unknown';
  if (seat < 1 || seat > LIMITS.NUM_SEATS) return 'Unknown';
  if (buttonSeat < 1 || buttonSeat > LIMITS.NUM_SEATS) return 'Unknown';

  // Calculate offset from button (0 = button, 1 = SB, etc.)
  const offset = (seat - buttonSeat + LIMITS.NUM_SEATS) % LIMITS.NUM_SEATS;
  return POSITION_NAMES[offset] || 'Unknown';
};

/**
 * Get seat number for a position name relative to button
 *
 * @param {string} position - Position name (BTN, SB, etc.)
 * @param {number} buttonSeat - Button seat number (1-9)
 * @returns {number|null} Seat number, or null if invalid
 */
export const getSeatForPosition = (position, buttonSeat) => {
  if (!position || !buttonSeat) return null;

  const posIndex = POSITION_NAMES.indexOf(position);
  if (posIndex === -1) return null;

  // Calculate seat: button + offset, wrap around
  const seat = ((buttonSeat - 1 + posIndex) % LIMITS.NUM_SEATS) + 1;
  return seat;
};

/**
 * Check if seat is in position (IP) relative to another seat
 * "In position" means acting after opponent postflop
 *
 * @param {number} mySeat - Our seat number
 * @param {number} opponentSeat - Opponent's seat number
 * @param {number} buttonSeat - Button seat number
 * @returns {boolean} True if mySeat acts after opponentSeat postflop
 */
export const isInPosition = (mySeat, opponentSeat, buttonSeat) => {
  if (!mySeat || !opponentSeat || !buttonSeat) return false;

  // Postflop order: SB first, then clockwise to button
  // Position closer to button (without crossing it) = in position
  const myOffset = (mySeat - buttonSeat + LIMITS.NUM_SEATS) % LIMITS.NUM_SEATS;
  const oppOffset = (opponentSeat - buttonSeat + LIMITS.NUM_SEATS) % LIMITS.NUM_SEATS;

  // Lower offset = closer to button = more "in position"
  // But SB (offset 1) acts before BB (offset 2)
  // Postflop order: 1(SB), 2(BB), 3, 4, 5, 6, 7, 8, 0(BTN)
  const postflopOrder = (offset) => offset === 0 ? LIMITS.NUM_SEATS : offset;

  return postflopOrder(myOffset) > postflopOrder(oppOffset);
};

/**
 * Check if seat is out of position (OOP) relative to another seat
 *
 * @param {number} mySeat - Our seat number
 * @param {number} opponentSeat - Opponent's seat number
 * @param {number} buttonSeat - Button seat number
 * @returns {boolean} True if mySeat acts before opponentSeat postflop
 */
export const isOutOfPosition = (mySeat, opponentSeat, buttonSeat) => {
  if (mySeat === opponentSeat) return false;
  return !isInPosition(mySeat, opponentSeat, buttonSeat);
};

/**
 * Get the position category for a seat
 *
 * @param {number} seat - Seat number
 * @param {number} buttonSeat - Button seat number
 * @returns {string} Category: 'BLINDS', 'EARLY', 'MIDDLE', or 'LATE'
 */
export const getPositionCategory = (seat, buttonSeat) => {
  const posName = getPositionName(seat, buttonSeat);

  for (const [category, positions] of Object.entries(POSITION_CATEGORIES)) {
    if (positions.includes(posName)) {
      return category;
    }
  }
  return 'LATE'; // Default for BTN
};

/**
 * Check if a position is a blind position
 *
 * @param {number} seat - Seat number
 * @param {number} buttonSeat - Button seat number
 * @returns {boolean}
 */
export const isBlindPosition = (seat, buttonSeat) => {
  const posName = getPositionName(seat, buttonSeat);
  return POSITION_CATEGORIES.BLINDS.includes(posName);
};

/**
 * Get all seats in their preflop action order
 * Preflop: UTG first, then clockwise, BB last
 *
 * @param {number} buttonSeat - Button seat number
 * @returns {number[]} Seat numbers in preflop order
 */
export const getPreflopOrder = (buttonSeat) => {
  const seats = [];
  // Start from UTG (3 positions from button)
  for (let i = 3; i < 3 + LIMITS.NUM_SEATS; i++) {
    const seat = ((buttonSeat - 1 + i) % LIMITS.NUM_SEATS) + 1;
    seats.push(seat);
  }
  return seats;
};

/**
 * Get all seats in their postflop action order
 * Postflop: SB first, then clockwise, button last
 *
 * @param {number} buttonSeat - Button seat number
 * @returns {number[]} Seat numbers in postflop order
 */
export const getPostflopOrder = (buttonSeat) => {
  const seats = [];
  // Start from SB (1 position from button)
  for (let i = 1; i <= LIMITS.NUM_SEATS; i++) {
    const seat = ((buttonSeat - 1 + i) % LIMITS.NUM_SEATS) + 1;
    seats.push(seat);
  }
  return seats;
};

/**
 * Determine if seat is "early" in preflop action order
 * (First 3 to act: UTG, UTG+1, MP1)
 *
 * @param {number} seat - Seat number
 * @param {number} buttonSeat - Button seat number
 * @returns {boolean}
 */
export const isEarlyPosition = (seat, buttonSeat) => {
  const order = getPreflopOrder(buttonSeat);
  const position = order.indexOf(seat);
  return position >= 0 && position < 3;
};

/**
 * Determine if seat is "late" in preflop action order
 * (Last 3 to act before blinds: HJ, CO, BTN)
 *
 * @param {number} seat - Seat number
 * @param {number} buttonSeat - Button seat number
 * @returns {boolean}
 */
export const isLatePosition = (seat, buttonSeat) => {
  const posName = getPositionName(seat, buttonSeat);
  return POSITION_CATEGORIES.LATE.includes(posName);
};
