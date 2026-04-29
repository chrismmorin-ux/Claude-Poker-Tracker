/**
 * useHandReplayAnalysis.js - Per-action range/equity analysis for hand replay
 *
 * Thin orchestrator hook. All analytical logic lives in src/utils/replayAnalysis.js.
 * This hook manages React state (actionAnalysis, isComputing) and drives the
 * sequential analysis loop when selectedHand/timeline/tendencyMap change.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { logger } from '../utils/errorHandler';
import {
  initializeSeatRanges, analyzeTimelineAction, buildCounterfactualTree,
} from '../utils/handAnalysis';
import { getCardsForStreet } from '../utils/pokerCore/cardParser';
import { narrowByBoard } from '../utils/exploitEngine/postflopNarrower';
import { segmentRange } from '../utils/exploitEngine/rangeSegmenter';
import { buildSituationKey } from '../utils/exploitEngine/decisionAccumulator';
import { queryActionDistribution } from '../utils/exploitEngine/villainDecisionModel';
import { evaluateGameTree } from '../utils/exploitEngine/gameTreeEvaluator';

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
        const entry = timeline[i];
        const result = await analyzeTimelineAction({
          entry,
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
          deps: { narrowByBoard, segmentRange, buildSituationKey, queryActionDistribution },
        });
        // Abort if a different hand was selected mid-loop — prevents stale
        // results from clobbering newer state.
        if (handId !== lastHandIdRef.current) return;

        // HRP-E-TREE-EXPOSE: depth-2/3 game tree per postflop entry, hero or
        // villain. Helper handles preflop / missing-card skips and engine
        // errors, returning null cleanly. Sequential — engine has shared
        // caches, so concurrency would inflate worst-case latency.
        result.counterfactualTree = await buildCounterfactualTree({
          entry,
          index: i,
          timeline,
          seatRanges,
          seatPlayers,
          tendencyMap,
          heroSeat,
          heroCards,
          cardsForStreet: getCardsForStreet(communityCards, entry.street),
          potAtPoint: result?.potAtPoint ?? 0,
          boardTexture: result?.boardTexture,
          deps: { evaluateGameTree },
        });
        if (handId !== lastHandIdRef.current) return;

        results.push(result);
      }

      setActionAnalysis(results);
    } catch (e) {
      logger.error('HandReplayAnalysis', e);
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
