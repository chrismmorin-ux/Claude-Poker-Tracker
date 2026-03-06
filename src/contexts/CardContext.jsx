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

  // Derived: Get player cards for a specific seat
  const getPlayerCards = useCallback((seat) => {
    return allPlayerCards[seat] || ['', ''];
  }, [allPlayerCards]);

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
    getPlayerCards,
  }), [
    communityCards,
    holeCards,
    holeCardsVisible,
    allPlayerCards,
    dispatchCard,
    getPlayerCards,
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
