/**
 * CardContext.jsx - Card state context provider
 * Provides: communityCards, holeCards, holeCardsVisible, allPlayerCards
 * Plus derived utilities for card access
 */

import { createContext, useContext, useMemo, useCallback } from 'react';

// Create context
const CardContext = createContext(null);

/**
 * Card context provider component
 * Wraps children with card state and utilities
 */
export const CardProvider = ({ cardState, dispatchCard, children }) => {
  const { communityCards, holeCards, holeCardsVisible, allPlayerCards } = cardState;

  // Derived: Get a specific community card by index
  const getCommunityCard = useCallback((index) => {
    return communityCards[index] || '';
  }, [communityCards]);

  // Derived: Get hole card by index
  const getHoleCard = useCallback((index) => {
    return holeCards[index] || '';
  }, [holeCards]);

  // Derived: Get player cards for a specific seat
  const getPlayerCards = useCallback((seat) => {
    return allPlayerCards[seat] || ['', ''];
  }, [allPlayerCards]);

  // Derived: Check if a specific card is already used in community cards
  const isCardInCommunity = useCallback((card) => {
    if (!card) return false;
    return communityCards.includes(card);
  }, [communityCards]);

  // Derived: Check if a specific card is already used in hole cards
  const isCardInHoleCards = useCallback((card) => {
    if (!card) return false;
    return holeCards.includes(card);
  }, [holeCards]);

  // Derived: Check if a card is used anywhere (community, hole, or player cards)
  const isCardUsed = useCallback((card) => {
    if (!card) return false;

    // Check community cards
    if (communityCards.includes(card)) return true;

    // Check hole cards
    if (holeCards.includes(card)) return true;

    // Check all player cards
    for (let seat = 1; seat <= 9; seat++) {
      if (allPlayerCards[seat]?.includes(card)) return true;
    }

    return false;
  }, [communityCards, holeCards, allPlayerCards]);

  // Derived: Get all used cards as an array
  const getAllUsedCards = useCallback(() => {
    const used = new Set();

    // Add community cards
    communityCards.forEach(card => {
      if (card) used.add(card);
    });

    // Add hole cards
    holeCards.forEach(card => {
      if (card) used.add(card);
    });

    // Add all player cards
    for (let seat = 1; seat <= 9; seat++) {
      if (allPlayerCards[seat]) {
        allPlayerCards[seat].forEach(card => {
          if (card) used.add(card);
        });
      }
    }

    return Array.from(used);
  }, [communityCards, holeCards, allPlayerCards]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // State
    communityCards,
    holeCards,
    holeCardsVisible,
    allPlayerCards,
    // Dispatch
    dispatchCard,
    // Derived utilities
    getCommunityCard,
    getHoleCard,
    getPlayerCards,
    isCardInCommunity,
    isCardInHoleCards,
    isCardUsed,
    getAllUsedCards,
  }), [
    communityCards,
    holeCards,
    holeCardsVisible,
    allPlayerCards,
    dispatchCard,
    getCommunityCard,
    getHoleCard,
    getPlayerCards,
    isCardInCommunity,
    isCardInHoleCards,
    isCardUsed,
    getAllUsedCards,
  ]);

  return (
    <CardContext.Provider value={value}>
      {children}
    </CardContext.Provider>
  );
};

/**
 * Hook to access card context
 * Throws if used outside of CardProvider
 */
export const useCard = () => {
  const context = useContext(CardContext);
  if (!context) {
    throw new Error('useCard must be used within a CardProvider');
  }
  return context;
};

export default CardContext;
