/**
 * useActionAdvisor.js - React hook for on-demand exploit engine analysis
 *
 * Wraps getActionAdvice() with React state management, abort handling,
 * and card format conversion.
 */

import { useState, useCallback } from 'react';
import { getActionAdvice } from '../utils/exploitEngine/actionAdvisor';
import { parseAndEncode } from '../utils/pokerCore/cardParser';
import { useAbortControl } from './useAbortControl';

/**
 * @returns {{ advice: object|null, isComputing: boolean, error: string|null, compute: Function, clear: Function }}
 */
export const useActionAdvisor = () => {
  const [advice, setAdvice] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState(null);
  const { register, isCurrent, abort } = useAbortControl();

  const compute = useCallback(async ({
    villainRange,
    boardCards,
    heroCardStrings,
    potSize,
    villainAction,
    villainBet = 0,
    playerStats,
    villainModel,
    personalizedMultipliers,
    trials = 2000,
  }) => {
    const callId = register();
    setIsComputing(true);
    setError(null);

    try {
      // Convert card strings to encoded ints
      const heroCards = heroCardStrings.map(parseAndEncode).filter(c => c >= 0);
      if (heroCards.length !== 2) {
        throw new Error('Exactly 2 valid hero cards required');
      }

      const board = boardCards.map(parseAndEncode).filter(c => c >= 0);
      if (board.length < 3) {
        throw new Error('At least 3 board cards required');
      }

      const result = await getActionAdvice({
        villainRange,
        board,
        heroCards,
        potSize,
        villainAction: villainAction || undefined,
        villainBet,
        playerStats,
        villainModel,
        personalizedMultipliers,
        trials,
      });

      // Only update if this is still the latest call
      if (isCurrent(callId)) {
        setAdvice(result);
      }
    } catch (err) {
      if (isCurrent(callId)) {
        setError(err.message);
        setAdvice(null);
      }
    } finally {
      if (isCurrent(callId)) {
        setIsComputing(false);
      }
    }
  }, [register, isCurrent]);

  const clear = useCallback(() => {
    abort();
    setAdvice(null);
    setError(null);
    setIsComputing(false);
  }, [abort]);

  return { advice, isComputing, error, compute, clear };
};
