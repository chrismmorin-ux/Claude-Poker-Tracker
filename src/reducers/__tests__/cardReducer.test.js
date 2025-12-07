/**
 * cardReducer.test.js - Tests for card state reducer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  cardReducer,
  CARD_ACTIONS,
  initialCardState,
  CARD_STATE_SCHEMA,
} from '../cardReducer';

describe('cardReducer', () => {
  let state;

  beforeEach(() => {
    // Deep clone initial state to avoid mutation between tests
    state = JSON.parse(JSON.stringify(initialCardState));
  });

  describe('initialCardState', () => {
    it('has correct default values', () => {
      expect(initialCardState.communityCards).toEqual(['', '', '', '', '']);
      expect(initialCardState.holeCards).toEqual(['', '']);
      expect(initialCardState.holeCardsVisible).toBe(true);
      expect(initialCardState.showCardSelector).toBe(false);
      expect(initialCardState.cardSelectorType).toBe('community');
      expect(initialCardState.highlightedBoardIndex).toBe(0);
      expect(initialCardState.isShowdownViewOpen).toBe(false);
      expect(initialCardState.highlightedSeat).toBe(1);
      expect(initialCardState.highlightedHoleSlot).toBe(0);
    });

    it('has empty player cards for all 9 seats', () => {
      for (let seat = 1; seat <= 9; seat++) {
        expect(initialCardState.allPlayerCards[seat]).toEqual(['', '']);
      }
    });
  });

  describe('SET_COMMUNITY_CARD', () => {
    it('sets a community card at specified index', () => {
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_COMMUNITY_CARD,
        payload: { index: 0, card: 'A♠' },
      });
      expect(newState.communityCards[0]).toBe('A♠');
      expect(newState.communityCards[1]).toBe('');
    });

    it('preserves other community cards', () => {
      state.communityCards = ['K♥', 'Q♦', '', '', ''];
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_COMMUNITY_CARD,
        payload: { index: 2, card: 'J♣' },
      });
      expect(newState.communityCards).toEqual(['K♥', 'Q♦', 'J♣', '', '']);
    });

    it('replaces existing card at index', () => {
      state.communityCards = ['A♠', '', '', '', ''];
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_COMMUNITY_CARD,
        payload: { index: 0, card: 'K♥' },
      });
      expect(newState.communityCards[0]).toBe('K♥');
    });
  });

  describe('SET_HOLE_CARD', () => {
    it('sets hole card at specified index', () => {
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_HOLE_CARD,
        payload: { index: 0, card: 'A♠' },
      });
      expect(newState.holeCards[0]).toBe('A♠');
      expect(newState.holeCards[1]).toBe('');
    });

    it('sets second hole card', () => {
      state.holeCards = ['A♠', ''];
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_HOLE_CARD,
        payload: { index: 1, card: 'K♠' },
      });
      expect(newState.holeCards).toEqual(['A♠', 'K♠']);
    });
  });

  describe('CLEAR_COMMUNITY_CARDS', () => {
    it('resets all community cards to empty', () => {
      state.communityCards = ['A♠', 'K♥', 'Q♦', 'J♣', 'T♠'];
      const newState = cardReducer(state, { type: CARD_ACTIONS.CLEAR_COMMUNITY_CARDS });
      expect(newState.communityCards).toEqual(['', '', '', '', '']);
    });
  });

  describe('CLEAR_HOLE_CARDS', () => {
    it('resets hole cards to empty', () => {
      state.holeCards = ['A♠', 'K♠'];
      const newState = cardReducer(state, { type: CARD_ACTIONS.CLEAR_HOLE_CARDS });
      expect(newState.holeCards).toEqual(['', '']);
    });
  });

  describe('TOGGLE_HOLE_VISIBILITY', () => {
    it('toggles visibility from true to false', () => {
      state.holeCardsVisible = true;
      const newState = cardReducer(state, { type: CARD_ACTIONS.TOGGLE_HOLE_VISIBILITY });
      expect(newState.holeCardsVisible).toBe(false);
    });

    it('toggles visibility from false to true', () => {
      state.holeCardsVisible = false;
      const newState = cardReducer(state, { type: CARD_ACTIONS.TOGGLE_HOLE_VISIBILITY });
      expect(newState.holeCardsVisible).toBe(true);
    });
  });

  describe('SET_HOLE_VISIBILITY', () => {
    it('sets visibility to true', () => {
      state.holeCardsVisible = false;
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_HOLE_VISIBILITY,
        payload: true,
      });
      expect(newState.holeCardsVisible).toBe(true);
    });

    it('sets visibility to false', () => {
      state.holeCardsVisible = true;
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_HOLE_VISIBILITY,
        payload: false,
      });
      expect(newState.holeCardsVisible).toBe(false);
    });
  });

  describe('OPEN_CARD_SELECTOR', () => {
    it('opens card selector for community cards', () => {
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.OPEN_CARD_SELECTOR,
        payload: { type: 'community', index: 2 },
      });
      expect(newState.showCardSelector).toBe(true);
      expect(newState.cardSelectorType).toBe('community');
      expect(newState.highlightedBoardIndex).toBe(2);
    });

    it('opens card selector for hole cards', () => {
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.OPEN_CARD_SELECTOR,
        payload: { type: 'hole', index: 1 },
      });
      expect(newState.showCardSelector).toBe(true);
      expect(newState.cardSelectorType).toBe('hole');
      expect(newState.highlightedBoardIndex).toBe(1);
    });
  });

  describe('CLOSE_CARD_SELECTOR', () => {
    it('closes card selector and resets highlight', () => {
      state.showCardSelector = true;
      state.highlightedBoardIndex = 3;
      const newState = cardReducer(state, { type: CARD_ACTIONS.CLOSE_CARD_SELECTOR });
      expect(newState.showCardSelector).toBe(false);
      expect(newState.highlightedBoardIndex).toBe(null);
    });
  });

  describe('SET_CARD_SELECTOR_TYPE', () => {
    it('sets selector type to hole', () => {
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_CARD_SELECTOR_TYPE,
        payload: 'hole',
      });
      expect(newState.cardSelectorType).toBe('hole');
    });

    it('sets selector type to community', () => {
      state.cardSelectorType = 'hole';
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_CARD_SELECTOR_TYPE,
        payload: 'community',
      });
      expect(newState.cardSelectorType).toBe('community');
    });
  });

  describe('SET_HIGHLIGHTED_CARD_INDEX', () => {
    it('updates highlighted card index', () => {
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX,
        payload: 4,
      });
      expect(newState.highlightedBoardIndex).toBe(4);
    });

    it('can set to null', () => {
      state.highlightedBoardIndex = 2;
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_HIGHLIGHTED_CARD_INDEX,
        payload: null,
      });
      expect(newState.highlightedBoardIndex).toBe(null);
    });
  });

  describe('OPEN_SHOWDOWN_VIEW', () => {
    it('opens showdown view and initializes highlight', () => {
      const newState = cardReducer(state, { type: CARD_ACTIONS.OPEN_SHOWDOWN_VIEW });
      expect(newState.isShowdownViewOpen).toBe(true);
      expect(newState.highlightedSeat).toBe(1);
      expect(newState.highlightedHoleSlot).toBe(0);
    });
  });

  describe('CLOSE_SHOWDOWN_VIEW', () => {
    it('closes showdown view and clears highlights', () => {
      state.isShowdownViewOpen = true;
      state.highlightedSeat = 5;
      state.highlightedHoleSlot = 1;
      const newState = cardReducer(state, { type: CARD_ACTIONS.CLOSE_SHOWDOWN_VIEW });
      expect(newState.isShowdownViewOpen).toBe(false);
      expect(newState.highlightedSeat).toBe(null);
      expect(newState.highlightedHoleSlot).toBe(null);
    });
  });

  describe('SET_PLAYER_CARD', () => {
    it('sets player card at specified seat and slot', () => {
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_PLAYER_CARD,
        payload: { seat: 3, slotIndex: 0, card: 'A♠' },
      });
      expect(newState.allPlayerCards[3][0]).toBe('A♠');
      expect(newState.allPlayerCards[3][1]).toBe('');
    });

    it('sets second card slot', () => {
      state.allPlayerCards[5] = ['K♥', ''];
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_PLAYER_CARD,
        payload: { seat: 5, slotIndex: 1, card: 'Q♦' },
      });
      expect(newState.allPlayerCards[5]).toEqual(['K♥', 'Q♦']);
    });

    it('preserves other seat cards', () => {
      state.allPlayerCards[1] = ['A♠', 'K♠'];
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_PLAYER_CARD,
        payload: { seat: 9, slotIndex: 0, card: '2♣' },
      });
      expect(newState.allPlayerCards[1]).toEqual(['A♠', 'K♠']);
      expect(newState.allPlayerCards[9][0]).toBe('2♣');
    });
  });

  describe('SET_HIGHLIGHTED_SEAT', () => {
    it('updates highlighted seat', () => {
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_HIGHLIGHTED_SEAT,
        payload: 7,
      });
      expect(newState.highlightedSeat).toBe(7);
    });
  });

  describe('SET_HIGHLIGHTED_HOLE_SLOT', () => {
    it('updates highlighted hole slot', () => {
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.SET_HIGHLIGHTED_HOLE_SLOT,
        payload: 1,
      });
      expect(newState.highlightedHoleSlot).toBe(1);
    });
  });

  describe('ADVANCE_SHOWDOWN_HIGHLIGHT', () => {
    it('advances from slot 0 to slot 1 in same seat', () => {
      state.highlightedSeat = 3;
      state.highlightedHoleSlot = 0;
      const newState = cardReducer(state, { type: CARD_ACTIONS.ADVANCE_SHOWDOWN_HIGHLIGHT });
      expect(newState.highlightedSeat).toBe(3);
      expect(newState.highlightedHoleSlot).toBe(1);
    });

    it('advances from slot 1 to slot 0 of next seat', () => {
      state.highlightedSeat = 3;
      state.highlightedHoleSlot = 1;
      const newState = cardReducer(state, { type: CARD_ACTIONS.ADVANCE_SHOWDOWN_HIGHLIGHT });
      expect(newState.highlightedSeat).toBe(4);
      expect(newState.highlightedHoleSlot).toBe(0);
    });

    it('wraps from seat 9 to seat 1', () => {
      state.highlightedSeat = 9;
      state.highlightedHoleSlot = 1;
      const newState = cardReducer(state, { type: CARD_ACTIONS.ADVANCE_SHOWDOWN_HIGHLIGHT });
      expect(newState.highlightedSeat).toBe(1);
      expect(newState.highlightedHoleSlot).toBe(0);
    });

    it('skips already filled slots', () => {
      state.highlightedSeat = 1;
      state.highlightedHoleSlot = 0;
      state.allPlayerCards[1] = ['A♠', 'K♠']; // Seat 1 full
      const newState = cardReducer(state, { type: CARD_ACTIONS.ADVANCE_SHOWDOWN_HIGHLIGHT });
      expect(newState.highlightedSeat).toBe(2);
      expect(newState.highlightedHoleSlot).toBe(0);
    });
  });

  describe('RESET_CARDS', () => {
    it('resets all cards to empty', () => {
      state.communityCards = ['A♠', 'K♥', 'Q♦', 'J♣', 'T♠'];
      state.holeCards = ['9♠', '8♠'];
      state.allPlayerCards[1] = ['7♠', '6♠'];
      state.allPlayerCards[5] = ['5♠', '4♠'];

      const newState = cardReducer(state, { type: CARD_ACTIONS.RESET_CARDS });

      expect(newState.communityCards).toEqual(['', '', '', '', '']);
      expect(newState.holeCards).toEqual(['', '']);
      for (let seat = 1; seat <= 9; seat++) {
        expect(newState.allPlayerCards[seat]).toEqual(['', '']);
      }
    });
  });

  describe('HYDRATE_STATE', () => {
    it('merges loaded state into current state', () => {
      const loadedState = {
        communityCards: ['A♠', 'K♥', 'Q♦', '', ''],
        holeCards: ['J♣', 'T♠'],
      };
      const newState = cardReducer(state, {
        type: CARD_ACTIONS.HYDRATE_STATE,
        payload: loadedState,
      });
      expect(newState.communityCards).toEqual(['A♠', 'K♥', 'Q♦', '', '']);
      expect(newState.holeCards).toEqual(['J♣', 'T♠']);
      // Preserves non-hydrated fields
      expect(newState.showCardSelector).toBe(false);
    });
  });

  describe('unknown action', () => {
    it('returns state unchanged for unknown action', () => {
      const newState = cardReducer(state, { type: 'UNKNOWN_ACTION' });
      expect(newState).toEqual(state);
    });
  });
});
