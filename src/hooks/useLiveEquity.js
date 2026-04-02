/**
 * useLiveEquity.js - Auto-compute hero equity vs focused villain
 *
 * Triggers when hero has 2 hole cards and 3+ community cards.
 * Picks the best villain (non-folded, has range profile), computes
 * hand-vs-range equity with debounce + abort pattern.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { handVsRange } from '../utils/exploitEngine/equityCalculator';
import { parseAndEncode, parseBoard } from '../utils/pokerCore/cardParser';
import { segmentRange } from '../utils/exploitEngine/rangeSegmenter';
import { estimateFoldPct } from '../utils/exploitEngine/foldEquityCalculator';
import { getRangePositionCategory } from '../utils/positionUtils';
import { getVillainActionKey, getVillainRange } from '../utils/rangeEngine/rangeAccessors';
import { SEAT_ARRAY, ACTIONS } from '../constants/gameConstants';
import { useAbortControl } from './useAbortControl';

/**
 * @param {Object} params
 * @param {string[]} params.holeCards - hero's 2 cards as strings
 * @param {string[]} params.communityCards - board cards as strings
 * @param {number} params.mySeat
 * @param {number} params.dealerSeat
 * @param {Object[]} params.actionSequence
 * @param {Object} params.tendencyMap - from usePlayerTendencies
 * @param {Function} params.getSeatPlayer - from PlayerContext
 * @returns {{ equity: number|null, foldPct: number|null, isComputing: boolean, villainName: string|null, villainSeat: number|null }}
 */
export const useLiveEquity = ({
  holeCards,
  communityCards,
  mySeat,
  dealerSeat,
  actionSequence,
  tendencyMap,
  getSeatPlayer,
}) => {
  const [equity, setEquity] = useState(null);
  const [foldPct, setFoldPct] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const [villainName, setVillainName] = useState(null);
  const [villainSeat, setVillainSeat] = useState(null);
  const { register, isCurrent } = useAbortControl();
  const debounceRef = useRef(null);

  // Parse hero cards
  const heroEncoded = useMemo(() => {
    if (!holeCards || holeCards.length < 2) return null;
    const h0 = holeCards[0], h1 = holeCards[1];
    if (!h0 || !h1 || h0 === '' || h1 === '') return null;
    const e0 = parseAndEncode(h0);
    const e1 = parseAndEncode(h1);
    if (e0 < 0 || e1 < 0) return null;
    return [e0, e1];
  }, [holeCards]);

  // Parse board
  const boardEncoded = useMemo(() => parseBoard(communityCards), [communityCards]);

  // Find focused villain
  const villain = useMemo(() => {
    if (!mySeat || !dealerSeat || !tendencyMap || !getSeatPlayer) return null;

    // Find folded seats
    const foldedSeats = new Set();
    for (const entry of actionSequence) {
      if (entry.action === ACTIONS.FOLD || entry.action === ACTIONS.FOLD_TO_CR ||
          entry.action === ACTIONS.FOLD_TO_CBET) {
        foldedSeats.add(entry.seat);
      }
    }

    let bestVillain = null;
    let bestHands = -1;

    for (const seat of SEAT_ARRAY) {
      if (seat === mySeat) continue;
      if (foldedSeats.has(seat)) continue;

      const player = getSeatPlayer(seat);
      if (!player) continue;

      const t = tendencyMap[player.playerId];
      if (!t?.rangeProfile) continue;

      const hands = t.rangeProfile.handsProcessed || 0;
      if (hands > bestHands) {
        bestHands = hands;
        bestVillain = { seat, player, tendencies: t };
      }
    }

    return bestVillain;
  }, [mySeat, dealerSeat, tendencyMap, getSeatPlayer, actionSequence]);

  useEffect(() => {
    // Clear debounce on unmount
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    // Guard: need 2 hero cards + 3+ board cards + a villain
    if (!heroEncoded || boardEncoded.length < 3 || !villain) {
      setEquity(null);
      setFoldPct(null);
      setVillainName(null);
      setVillainSeat(null);
      return;
    }

    // Debounce 800ms
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const callId = register();
      setIsComputing(true);

      const position = getRangePositionCategory(villain.seat, dealerSeat);
      const actionKey = getVillainActionKey(actionSequence, villain.seat);
      const range = getVillainRange(villain.tendencies.rangeProfile, position, actionKey);

      if (!range) {
        if (isCurrent(callId)) {
          setEquity(null);
          setFoldPct(null);
          setIsComputing(false);
        }
        return;
      }

      setVillainName(villain.player.name || `Seat ${villain.seat}`);
      setVillainSeat(villain.seat);

      handVsRange(heroEncoded, range, boardEncoded, { trials: 2000 })
        .then(result => {
          if (isCurrent(callId)) {
            setEquity(result.equity);

            // Compute fold% from range segmentation (synchronous, cheap)
            try {
              const seg = segmentRange(range, boardEncoded, heroEncoded);
              const fpResult = estimateFoldPct(seg, 'bet');
              setFoldPct(fpResult.value);
            } catch {
              setFoldPct(null);
            }

            setIsComputing(false);
          }
        })
        .catch(() => {
          if (isCurrent(callId)) {
            setEquity(null);
            setFoldPct(null);
            setIsComputing(false);
          }
        });
    }, 800);
  }, [heroEncoded, boardEncoded, villain, dealerSeat, actionSequence]);

  return { equity, foldPct, isComputing, villainName, villainSeat };
};
