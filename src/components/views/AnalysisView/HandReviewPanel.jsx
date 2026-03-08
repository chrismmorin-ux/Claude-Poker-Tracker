import React, { useMemo } from 'react';
import { usePlayer } from '../../../contexts';
import { useHandReview } from '../../../hooks/useHandReview';
import { usePlayerTendencies } from '../../../hooks/usePlayerTendencies';
import { analyzeDecisionPoint } from '../../../utils/handReviewAnalyzer';
import { HandBrowser } from './HandBrowser';
import { HandWalkthrough } from './HandWalkthrough';
import { ReviewObservations } from './ReviewObservations';

export const HandReviewPanel = () => {
  const { allPlayers } = usePlayer();
  const { tendencyMap } = usePlayerTendencies(allPlayers);

  const {
    hands, selectedHand, selectedHandId,
    timeline, currentStreet, availableStreets,
    streetActions, communityCardsForStreet,
    heroSeat, focusedAction, focusedActionIndex,
    isLoading, filterPlayerId, filterSessionId,
    selectHand, setCurrentStreet, focusAction,
    nextStreet, prevStreet,
    setFilterPlayerId, setFilterSessionId,
  } = useHandReview();

  // Compute analysis for focused action
  const analysis = useMemo(() => {
    if (!focusedAction || !selectedHand) return null;
    const boardCards = selectedHand?.cardState?.communityCards ||
                       selectedHand?.gameState?.communityCards || [];
    return analyzeDecisionPoint({
      timeline,
      focusedAction,
      heroSeat,
      hand: selectedHand,
      tendencyMap,
      boardCards,
    });
  }, [focusedAction, selectedHand, timeline, heroSeat, tendencyMap]);

  return (
    <div className="grid grid-cols-[280px_1fr_1fr] gap-4 h-[540px]">
      {/* Left: Hand Browser */}
      <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 overflow-hidden">
        <h3 className="text-sm font-bold mb-2 text-indigo-400">Hands</h3>
        {isLoading ? (
          <div className="text-center text-gray-400 text-xs mt-8">Loading...</div>
        ) : (
          <HandBrowser
            hands={hands}
            selectedHandId={selectedHandId}
            onSelectHand={selectHand}
            filterPlayerId={filterPlayerId}
            filterSessionId={filterSessionId}
            onFilterPlayerChange={setFilterPlayerId}
            onFilterSessionChange={setFilterSessionId}
            allPlayers={allPlayers}
          />
        )}
      </div>

      {/* Center: Hand Walkthrough */}
      <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 overflow-hidden">
        <h3 className="text-sm font-bold mb-2 text-indigo-400">Walkthrough</h3>
        <HandWalkthrough
          selectedHand={selectedHand}
          streetActions={streetActions}
          currentStreet={currentStreet}
          availableStreets={availableStreets}
          communityCardsForStreet={communityCardsForStreet}
          heroSeat={heroSeat}
          focusedActionIndex={focusedActionIndex}
          timeline={timeline}
          onSetStreet={setCurrentStreet}
          onFocusAction={focusAction}
          onPrevStreet={prevStreet}
          onNextStreet={nextStreet}
        />
      </div>

      {/* Right: Review Observations */}
      <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 overflow-hidden overflow-y-auto">
        <h3 className="text-sm font-bold mb-2 text-indigo-400">Observations</h3>
        <ReviewObservations analysis={analysis} />
      </div>
    </div>
  );
};
