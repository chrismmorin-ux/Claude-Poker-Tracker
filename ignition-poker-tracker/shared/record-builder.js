/**
 * shared/record-builder.js — Stateless hand record builder
 *
 * Extracted from HandStateMachine.buildRecord(). Takes accumulated state
 * and produces a validated hand record. Pure function, no side effects.
 */

import * as handFormat from './hand-format.js';

const NUM_SEATS = 9;

/**
 * Build a hand record from accumulated HSM state.
 *
 * @param {Object} state - Accumulated state from HSM
 * @param {string|null} state.currentStreet
 * @param {number|null} state.dealerSeat
 * @param {number|null} state.heroSeat
 * @param {Array} state.actionSequence
 * @param {Array} state.communityCards
 * @param {Array} state.holeCards
 * @param {Object} state.allPlayerCards
 * @param {Set} state.activeSeats
 * @param {Object} state.seatPlayers
 * @param {string|number} state.connId
 * @param {string|number|null} state.handNumber
 * @param {Object} state.blinds - { sb, bb }
 * @param {number} state.ante
 * @param {*} state.gameType
 * @param {Object} state.stacks
 * @param {number} state.pot
 * @param {Array} state.potDistribution
 * @param {Array} state.winners
 * @param {Object} state.seatDisplayMap
 * @returns {{ record: Object|null, validation: { valid: boolean, errors: string[] } }}
 */
export const buildRecordFromState = (state) => {
  const {
    currentStreet, dealerSeat, heroSeat, actionSequence,
    communityCards, holeCards, allPlayerCards, activeSeats,
    seatPlayers, connId, handNumber, blinds, ante, gameType,
    stacks, pot, potDistribution, winners, seatDisplayMap,
  } = state;

  // Determine final street
  let finalStreet = currentStreet || 'preflop';
  if (allPlayerCards && Object.keys(allPlayerCards).length > 0) {
    finalStreet = 'showdown';
  }

  // Absent seats
  const activeSeatSet = activeSeats instanceof Set ? activeSeats : new Set(activeSeats);
  const maxActive = activeSeatSet.size > 0 ? Math.max(...activeSeatSet) : 0;
  const absentSeats = [];
  if (maxActive <= NUM_SEATS) {
    for (let s = 1; s <= NUM_SEATS; s++) {
      if (!activeSeatSet.has(s)) absentSeats.push(s);
    }
  }

  // Mark hero in seatPlayers
  const finalSeatPlayers = { ...seatPlayers };
  if (heroSeat) {
    finalSeatPlayers[heroSeat] = 'hero';
  }

  // Refuse to emit if heroSeat is null — fallback to seat 1 corrupts analysis
  if (!heroSeat) {
    return {
      record: null,
      validation: { valid: false, errors: ['heroSeat is null — cannot determine hero position'] },
    };
  }

  const record = handFormat.buildHandRecord({
    currentStreet: finalStreet,
    dealerButtonSeat: dealerSeat || 1,
    mySeat: heroSeat,
    actionSequence,
    absentSeats,
    communityCards,
    holeCards,
    allPlayerCards,
    seatPlayers: finalSeatPlayers,
    tableId: `table_${connId}`,
    ignitionMeta: {
      handNumber,
      blinds: { ...blinds },
      ante,
      gameType,
      finalStacks: { ...stacks },
      pot,
      potDistribution,
      winners,
      heroSeatConfidence: state.heroSeatConfidence || 'unknown',
      seatDisplayMap: seatDisplayMap && Object.keys(seatDisplayMap).length > 0
        ? { ...seatDisplayMap } : undefined,
    },
  });

  const validation = handFormat.validateHandRecord(record);
  return { record: validation.valid ? record : null, validation };
};
