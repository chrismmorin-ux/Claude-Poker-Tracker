/**
 * useHandReplayAnalysis.js - Per-action range/equity analysis for hand replay
 *
 * Thin orchestrator hook. All analytical logic lives in src/utils/replayAnalysis.js.
 * This hook manages React state (actionAnalysis, isComputing) and drives the
 * sequential analysis loop when selectedHand/timeline/tendencyMap change.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { initializeSeatRanges, analyzeTimelineAction } from '../utils/handAnalysis';

/**
 * @param {Object|null} selectedHand - The hand record
 * @param {Array} timeline - From buildTimeline()
 * @param {Object} tendencyMap - { [playerId]: { rangeProfile, ... } }
 * @returns {{ actionAnalysis: Array|null, isComputing: boolean }}
 */
export const useHandReplayAnalysis = (selectedHand, timeline, tendencyMap) => {
  const [actionAnalysis, setActionAnalysis] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const lastHandIdRef = useRef(null);

  const compute = useCallback(async () => {
    if (!selectedHand || !timeline || timeline.length === 0) {
      setActionAnalysis(null);
      return;
    }

    const handId = selectedHand.handId ?? selectedHand.id;
    if (handId === lastHandIdRef.current) return;
    lastHandIdRef.current = handId;

    setIsComputing(true);
    try {
      const buttonSeat = selectedHand?.gameState?.dealerButtonSeat ?? 1;
      const seatPlayers = selectedHand?.seatPlayers || {};
      const heroSeat = selectedHand?.gameState?.mySeat ?? null;
      const communityCards = selectedHand?.cardState?.communityCards ||
                             selectedHand?.gameState?.communityCards || [];
      const showdownCards = selectedHand?.gameState?.showdownCards || {};
      const heroCards = selectedHand?.cardState?.selectedCards ||
                        selectedHand?.gameState?.holeCards || [];
      const blindsPosted = selectedHand?.gameState?.blindsPosted;

      const { seatRanges, seatRangeProfiles, seatRangeLabels } =
        initializeSeatRanges(seatPlayers, tendencyMap, buttonSeat);

      const results = [];

      for (let i = 0; i < timeline.length; i++) {
        const result = await analyzeTimelineAction({
          entry: timeline[i],
          index: i,
          timeline,
          seatRanges,
          seatRangeLabels,
          seatRangeProfiles,
          seatPlayers,
          tendencyMap,
          buttonSeat,
          communityCards,
          heroSeat,
          heroCards,
          showdownCards,
          blindsPosted,
          results,
        });
        results.push(result);
      }

      setActionAnalysis(results);
    } catch (e) {
      console.error('useHandReplayAnalysis: failed', e);
      setActionAnalysis(null);
    } finally {
      setIsComputing(false);
    }
  }, [selectedHand, timeline, tendencyMap]);

  useEffect(() => {
    compute();
  }, [compute]);

  return { actionAnalysis, isComputing };
};
