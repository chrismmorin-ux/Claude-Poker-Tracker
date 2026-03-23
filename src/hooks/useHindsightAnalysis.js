/**
 * useHindsightAnalysis.js - React hook wrapper for villain hindsight analysis
 *
 * Computes lazily when villainCards becomes non-null.
 * Caches by input key to avoid recomputation.
 */

import { useState, useEffect, useRef } from 'react';
import { analyzeWithHindsight } from '../utils/hindsightAnalysis';

/**
 * @param {string[]|null} villainCards - Villain's hole cards (null if not revealed)
 * @param {Float64Array|null} heroRange - Hero's estimated range at current point
 * @param {string[]} currentBoard - Board visible at current action
 * @param {string[]} fullBoard - Complete community cards
 * @param {string} action - Primitive action villain took
 * @param {number} potSize - Pot at decision point
 * @param {number} betSize - Amount bet/called
 * @returns {{ hindsight: Object|null, isComputing: boolean }}
 */
export const useHindsightAnalysis = (villainCards, heroRange, currentBoard, fullBoard, action, potSize, betSize) => {
  const [hindsight, setHindsight] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const cacheRef = useRef(new Map());

  useEffect(() => {
    if (!villainCards || villainCards.length < 2 || !heroRange || !action) {
      setHindsight(null);
      return;
    }

    // Build cache key (include heroRange fingerprint)
    const boardKey = (currentBoard || []).join(',');
    const rangeFp = heroRange ? `${heroRange[0].toFixed(3)}|${heroRange[84].toFixed(3)}|${heroRange[168].toFixed(3)}` : '';
    const cacheKey = `${villainCards.join(',')}|${boardKey}|${action}|${potSize}|${betSize}|${rangeFp}`;

    // Check cache
    if (cacheRef.current.has(cacheKey)) {
      setHindsight(cacheRef.current.get(cacheKey));
      return;
    }

    let cancelled = false;
    setIsComputing(true);

    analyzeWithHindsight(villainCards, heroRange, currentBoard || [], fullBoard || [], action, potSize, betSize)
      .then(result => {
        if (!cancelled) {
          cacheRef.current.set(cacheKey, result);
          // Limit cache size
          if (cacheRef.current.size > 50) {
            const firstKey = cacheRef.current.keys().next().value;
            cacheRef.current.delete(firstKey);
          }
          setHindsight(result);
        }
      })
      .catch(() => {
        if (!cancelled) setHindsight(null);
      })
      .finally(() => {
        if (!cancelled) setIsComputing(false);
      });

    return () => { cancelled = true; };
  }, [villainCards, heroRange, currentBoard, fullBoard, action, potSize, betSize]);

  return { hindsight, isComputing };
};
