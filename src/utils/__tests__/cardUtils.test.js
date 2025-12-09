/**
 * cardUtils.test.js - Tests for card manipulation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  assignCardToSlot,
  removeCardFromAllPlayers,
  removeCardFromArray,
  shouldAutoCloseCardSelector,
  getNextCardIndex,
  findNextEmptySlot,
  assignCardToPlayer,
} from '../cardUtils';
import {
  createEmptyPlayerCards,
  createMockIsSeatInactive,
  ACTIONS,
  SEAT_STATUS,
} from '../../test/utils';

describe('assignCardToSlot', () => {
  it('assigns card to empty slot', () => {
    const cards = ['', '', '', '', ''];
    const result = assignCardToSlot(cards, 'A♠', 0);
    expect(result).toEqual(['A♠', '', '', '', '']);
  });

  it('assigns card to already-filled slot', () => {
    const cards = ['K♥', '', '', '', ''];
    const result = assignCardToSlot(cards, 'A♠', 0);
    expect(result).toEqual(['A♠', '', '', '', '']);
  });

  it('removes card from other slot if already present', () => {
    const cards = ['A♠', '', '', '', ''];
    const result = assignCardToSlot(cards, 'A♠', 2);
    expect(result).toEqual(['', '', 'A♠', '', '']);
  });

  it('does not modify original array', () => {
    const cards = ['A♠', '', '', '', ''];
    const original = [...cards];
    assignCardToSlot(cards, 'K♥', 1);
    expect(cards).toEqual(original);
  });

  it('handles assigning card to same slot (no-op)', () => {
    const cards = ['A♠', '', '', '', ''];
    const result = assignCardToSlot(cards, 'A♠', 0);
    expect(result).toEqual(['A♠', '', '', '', '']);
  });

  it('handles last slot correctly', () => {
    const cards = ['', '', '', '', ''];
    const result = assignCardToSlot(cards, 'A♠', 4);
    expect(result).toEqual(['', '', '', '', 'A♠']);
  });

  it('removes card from middle slot and assigns to end', () => {
    const cards = ['K♥', 'Q♦', 'J♣', '', ''];
    const result = assignCardToSlot(cards, 'Q♦', 4);
    expect(result).toEqual(['K♥', '', 'J♣', '', 'Q♦']);
  });
});

describe('removeCardFromAllPlayers', () => {
  it('removes card from single player', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♥'];

    const result = removeCardFromAllPlayers(allPlayerCards, 'A♠');
    expect(result[1]).toEqual(['', 'K♥']);
  });

  it('removes card from multiple players', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♥'];
    allPlayerCards[5] = ['Q♦', 'A♠'];

    const result = removeCardFromAllPlayers(allPlayerCards, 'A♠');
    expect(result[1]).toEqual(['', 'K♥']);
    expect(result[5]).toEqual(['Q♦', '']);
  });

  it('preserves other cards', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♥'];
    allPlayerCards[2] = ['Q♦', 'J♣'];

    const result = removeCardFromAllPlayers(allPlayerCards, 'A♠');
    expect(result[1]).toEqual(['', 'K♥']);
    expect(result[2]).toEqual(['Q♦', 'J♣']);
  });

  it('does not modify original object', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♥'];
    const original = JSON.parse(JSON.stringify(allPlayerCards));

    removeCardFromAllPlayers(allPlayerCards, 'A♠');
    expect(allPlayerCards).toEqual(original);
  });

  it('handles card not present in any player', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♥'];

    const result = removeCardFromAllPlayers(allPlayerCards, 'Q♦');
    expect(result[1]).toEqual(['A♠', 'K♥']);
  });

  it('handles all seats with empty cards', () => {
    const allPlayerCards = createEmptyPlayerCards();
    const result = removeCardFromAllPlayers(allPlayerCards, 'A♠');

    for (let seat = 1; seat <= 9; seat++) {
      expect(result[seat]).toEqual(['', '']);
    }
  });
});

describe('removeCardFromArray', () => {
  it('removes card from array', () => {
    const cards = ['A♠', 'K♥', 'Q♦'];
    const result = removeCardFromArray(cards, 'K♥');
    expect(result).toEqual(['A♠', '', 'Q♦']);
  });

  it('removes multiple instances of same card', () => {
    const cards = ['A♠', 'K♥', 'A♠'];
    const result = removeCardFromArray(cards, 'A♠');
    expect(result).toEqual(['', 'K♥', '']);
  });

  it('preserves other cards', () => {
    const cards = ['A♠', 'K♥', 'Q♦', 'J♣', 'T♠'];
    const result = removeCardFromArray(cards, 'Q♦');
    expect(result).toEqual(['A♠', 'K♥', '', 'J♣', 'T♠']);
  });

  it('does not modify original array', () => {
    const cards = ['A♠', 'K♥', 'Q♦'];
    const original = [...cards];
    removeCardFromArray(cards, 'K♥');
    expect(cards).toEqual(original);
  });

  it('handles card not in array', () => {
    const cards = ['A♠', 'K♥', 'Q♦'];
    const result = removeCardFromArray(cards, 'J♣');
    expect(result).toEqual(['A♠', 'K♥', 'Q♦']);
  });

  it('handles empty array', () => {
    const cards = [];
    const result = removeCardFromArray(cards, 'A♠');
    expect(result).toEqual([]);
  });

  it('handles array with all empty strings', () => {
    const cards = ['', '', ''];
    const result = removeCardFromArray(cards, 'A♠');
    expect(result).toEqual(['', '', '']);
  });
});

describe('shouldAutoCloseCardSelector', () => {
  it('returns true when flop complete (index 2)', () => {
    expect(shouldAutoCloseCardSelector('flop', 2)).toBe(true);
  });

  it('returns false when flop incomplete', () => {
    expect(shouldAutoCloseCardSelector('flop', 0)).toBe(false);
    expect(shouldAutoCloseCardSelector('flop', 1)).toBe(false);
  });

  it('returns true when turn complete (index 3)', () => {
    expect(shouldAutoCloseCardSelector('turn', 3)).toBe(true);
  });

  it('returns false when turn incomplete', () => {
    expect(shouldAutoCloseCardSelector('turn', 0)).toBe(false);
    expect(shouldAutoCloseCardSelector('turn', 1)).toBe(false);
    expect(shouldAutoCloseCardSelector('turn', 2)).toBe(false);
  });

  it('returns true when river complete (index 4)', () => {
    expect(shouldAutoCloseCardSelector('river', 4)).toBe(true);
  });

  it('returns false when river incomplete', () => {
    expect(shouldAutoCloseCardSelector('river', 0)).toBe(false);
    expect(shouldAutoCloseCardSelector('river', 1)).toBe(false);
    expect(shouldAutoCloseCardSelector('river', 2)).toBe(false);
    expect(shouldAutoCloseCardSelector('river', 3)).toBe(false);
  });

  it('returns false for preflop (no community cards)', () => {
    expect(shouldAutoCloseCardSelector('preflop', 0)).toBe(false);
    expect(shouldAutoCloseCardSelector('preflop', 4)).toBe(false);
  });

  it('returns false for showdown (no auto-close)', () => {
    expect(shouldAutoCloseCardSelector('showdown', 4)).toBe(false);
  });

  it('returns false when street and index mismatch', () => {
    expect(shouldAutoCloseCardSelector('flop', 3)).toBe(false);
    expect(shouldAutoCloseCardSelector('turn', 2)).toBe(false);
    expect(shouldAutoCloseCardSelector('river', 3)).toBe(false);
  });
});

describe('getNextCardIndex', () => {
  it('increments index when below max', () => {
    expect(getNextCardIndex(0)).toBe(1);
    expect(getNextCardIndex(1)).toBe(2);
    expect(getNextCardIndex(2)).toBe(3);
    expect(getNextCardIndex(3)).toBe(4);
  });

  it('returns null when at max index', () => {
    expect(getNextCardIndex(4)).toBe(null);
  });

  it('respects custom maxIndex parameter', () => {
    expect(getNextCardIndex(0, 1)).toBe(1);
    expect(getNextCardIndex(1, 1)).toBe(null);
    expect(getNextCardIndex(5, 8)).toBe(6);
    expect(getNextCardIndex(8, 8)).toBe(null);
  });

  it('handles maxIndex of 0', () => {
    expect(getNextCardIndex(0, 0)).toBe(null);
  });

  it('returns null when current exceeds max', () => {
    expect(getNextCardIndex(5, 4)).toBe(null);
  });
});

describe('findNextEmptySlot', () => {
  const NUM_SEATS = 9;

  describe('same seat slot advancement', () => {
    it('advances to slot 1 when current slot is 0 and slot 1 is empty', () => {
      const holeCards = ['A♠', ''];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {};

      const result = findNextEmptySlot(
        5, // currentSeat (mySeat)
        0, // currentSlot
        5, // mySeat
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toEqual({ seat: 5, slot: 1 });
    });

    it('skips to next seat when current slot is 0 and slot 1 is filled', () => {
      const holeCards = ['A♠', 'K♥'];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {};

      const result = findNextEmptySlot(
        5, // currentSeat
        0, // currentSlot
        5, // mySeat
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toEqual({ seat: 6, slot: 0 });
    });

    it('advances to slot 1 for other player seats', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      allPlayerCards[3] = ['Q♦', ''];
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {};

      const result = findNextEmptySlot(
        3, // currentSeat
        0, // currentSlot
        5, // mySeat
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toEqual({ seat: 3, slot: 1 });
    });
  });

  describe('seat iteration', () => {
    it('moves to next seat when current slot is 1', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {};

      const result = findNextEmptySlot(
        3,
        1, // currentSlot 1 - should skip to next seat
        5,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toEqual({ seat: 4, slot: 0 });
    });

    it('finds first empty slot in next available seat', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      allPlayerCards[4] = ['A♠', 'K♥']; // Seat 4 full
      allPlayerCards[5] = ['Q♦', '']; // Seat 5 has empty slot 1
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {};

      const result = findNextEmptySlot(
        3,
        1,
        7, // mySeat is different
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      // Should skip filled seat 4, find seat 5 slot 1
      expect(result).toEqual({ seat: 5, slot: 1 });
    });

    it('continues searching through multiple seats', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      allPlayerCards[2] = ['A♠', 'K♥'];
      allPlayerCards[3] = ['Q♦', 'J♣'];
      allPlayerCards[4] = ['T♠', '9♥'];
      allPlayerCards[5] = ['', ''];
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {};

      const result = findNextEmptySlot(
        1,
        1,
        7,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toEqual({ seat: 5, slot: 0 });
    });
  });

  describe('skipping inactive seats', () => {
    it('skips folded seats', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([2, 3]); // Returns 'folded' for seats 2 and 3
      const seatActions = {};

      const result = findNextEmptySlot(
        1,
        1,
        5,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      // Should skip seats 2 and 3, find seat 4
      expect(result).toEqual({ seat: 4, slot: 0 });
    });

    it('skips absent seats', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      // Mock returns 'absent' for seat 2
      const isSeatInactive = (seat) => seat === 2 ? SEAT_STATUS.ABSENT : null;
      const seatActions = {};

      const result = findNextEmptySlot(
        1,
        1,
        5,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toEqual({ seat: 3, slot: 0 });
    });

    it('skips mucked seats', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {
        showdown: {
          2: ACTIONS.MUCKED,
        },
      };

      const result = findNextEmptySlot(
        1,
        1,
        5,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toEqual({ seat: 3, slot: 0 });
    });

    it('skips won seats', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {
        showdown: {
          2: ACTIONS.WON,
        },
      };

      const result = findNextEmptySlot(
        1,
        1,
        5,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toEqual({ seat: 3, slot: 0 });
    });

    it('handles multiple action types (array format)', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {
        showdown: {
          2: [ACTIONS.MUCKED], // Array format
          3: [ACTIONS.WON],
        },
      };

      const result = findNextEmptySlot(
        1,
        1,
        5,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toEqual({ seat: 4, slot: 0 });
    });

    it('skips seats with both folded status and mucked action', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([2]);
      const seatActions = {
        showdown: {
          2: ACTIONS.MUCKED,
        },
      };

      const result = findNextEmptySlot(
        1,
        1,
        5,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toEqual({ seat: 3, slot: 0 });
    });
  });

  describe('edge cases', () => {
    it('returns null when no empty slots found', () => {
      const holeCards = ['A♠', 'K♥'];
      const allPlayerCards = createEmptyPlayerCards();
      // Fill all seats
      for (let seat = 1; seat <= 9; seat++) {
        allPlayerCards[seat] = ['Q♦', 'J♣'];
      }
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {};

      const result = findNextEmptySlot(
        5,
        1,
        5,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toBe(null);
    });

    it('returns null when all remaining seats are inactive', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([2, 3, 4, 5, 6, 7, 8, 9]);
      const seatActions = {};

      const result = findNextEmptySlot(
        1,
        1,
        1,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toBe(null);
    });

    it('returns null when all remaining seats are mucked or won', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {
        showdown: {
          2: ACTIONS.MUCKED,
          3: ACTIONS.WON,
          4: ACTIONS.MUCKED,
          5: ACTIONS.WON,
          6: ACTIONS.MUCKED,
          7: ACTIONS.WON,
          8: ACTIONS.MUCKED,
          9: ACTIONS.WON,
        },
      };

      const result = findNextEmptySlot(
        1,
        1,
        1,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toBe(null);
    });

    it('handles mySeat at last seat', () => {
      const holeCards = ['A♠', ''];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {};

      const result = findNextEmptySlot(
        9, // Last seat
        0,
        9, // mySeat
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toEqual({ seat: 9, slot: 1 });
    });

    it('returns null when starting from last seat with full cards', () => {
      const holeCards = ['A♠', 'K♥'];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {};

      const result = findNextEmptySlot(
        9,
        1,
        9,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toBe(null);
    });

    it('handles missing showdown actions gracefully', () => {
      const holeCards = ['', ''];
      const allPlayerCards = createEmptyPlayerCards();
      const isSeatInactive = createMockIsSeatInactive([]);
      const seatActions = {}; // No showdown actions

      const result = findNextEmptySlot(
        1,
        1,
        5,
        holeCards,
        allPlayerCards,
        isSeatInactive,
        seatActions,
        ACTIONS,
        SEAT_STATUS,
        NUM_SEATS
      );

      expect(result).toEqual({ seat: 2, slot: 0 });
    });
  });
});

describe('assignCardToPlayer', () => {
  it('assigns card to player slot', () => {
    const allPlayerCards = createEmptyPlayerCards();
    const result = assignCardToPlayer(allPlayerCards, 3, 0, 'A♠');

    expect(result[3]).toEqual(['A♠', '']);
  });

  it('removes card from other players before assigning', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♥'];

    const result = assignCardToPlayer(allPlayerCards, 3, 0, 'A♠');

    expect(result[1]).toEqual(['', 'K♥']);
    expect(result[3]).toEqual(['A♠', '']);
  });

  it('overwrites existing card in target slot', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[3] = ['K♥', 'Q♦'];

    const result = assignCardToPlayer(allPlayerCards, 3, 0, 'A♠');

    expect(result[3]).toEqual(['A♠', 'Q♦']);
  });

  it('assigns to slot 1', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[3] = ['K♥', ''];

    const result = assignCardToPlayer(allPlayerCards, 3, 1, 'A♠');

    expect(result[3]).toEqual(['K♥', 'A♠']);
  });

  it('does not modify original object', () => {
    const allPlayerCards = createEmptyPlayerCards();
    const original = JSON.parse(JSON.stringify(allPlayerCards));

    assignCardToPlayer(allPlayerCards, 3, 0, 'A♠');

    expect(allPlayerCards).toEqual(original);
  });

  it('removes card from multiple players', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♥'];
    allPlayerCards[5] = ['Q♦', 'A♠'];
    allPlayerCards[7] = ['A♠', 'J♣'];

    const result = assignCardToPlayer(allPlayerCards, 3, 0, 'A♠');

    expect(result[1]).toEqual(['', 'K♥']);
    expect(result[5]).toEqual(['Q♦', '']);
    expect(result[7]).toEqual(['', 'J♣']);
    expect(result[3]).toEqual(['A♠', '']);
  });

  it('handles assigning card to same player different slot', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[3] = ['A♠', 'K♥'];

    const result = assignCardToPlayer(allPlayerCards, 3, 1, 'A♠');

    // Card is removed from slot 0, then assigned to slot 1
    expect(result[3]).toEqual(['', 'A♠']);
  });

  it('preserves cards in other seats', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['K♥', 'Q♦'];
    allPlayerCards[2] = ['J♣', 'T♠'];
    allPlayerCards[4] = ['9♥', '8♦'];

    const result = assignCardToPlayer(allPlayerCards, 3, 0, 'A♠');

    expect(result[1]).toEqual(['K♥', 'Q♦']);
    expect(result[2]).toEqual(['J♣', 'T♠']);
    expect(result[3]).toEqual(['A♠', '']);
    expect(result[4]).toEqual(['9♥', '8♦']);
  });
});
