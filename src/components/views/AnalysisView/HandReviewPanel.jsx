import React, { useMemo, useCallback } from 'react';
import { logger } from '../../../utils/errorHandler';
import { usePlayer, useTendency, useSession, useUI } from '../../../contexts';
import { useToast } from '../../../contexts/ToastContext';
import { useHandReview } from '../../../hooks/useHandReview';
import { useHandReplayAnalysis } from '../../../hooks/useHandReplayAnalysis';
import { analyzeDecisionPoint } from '../../../utils/handAnalysis';
import { deleteHand, getSessionHandCount } from '../../../utils/persistence/index';
import { SESSION_ACTIONS } from '../../../reducers/sessionReducer';
import { SCREEN } from '../../../constants/uiConstants';
import { HandBrowser } from './HandBrowser';
import { HandWalkthrough } from './HandWalkthrough';
import { ReviewObservations } from './ReviewObservations';

export const HandReviewPanel = () => {
  const { allPlayers } = usePlayer();
  const { tendencyMap } = useTendency();
  const { currentSession, dispatchSession } = useSession();
  const { setCurrentScreen, setReplayHand } = useUI();
  const { showError, showSuccess } = useToast();

  const {
    hands, selectedHand, selectedHandId,
    timeline, currentStreet, availableStreets,
    streetActions, communityCardsForStreet,
    heroSeat, focusedAction, focusedActionIndex,
    isLoading, filterPlayerId, filterSessionId,
    selectHand, setCurrentStreet, focusAction,
    nextStreet, prevStreet,
    setFilterPlayerId, setFilterSessionId,
    refresh,
  } = useHandReview();

  // Derive heroPlayerId for HandBrowser significance scoring
  const heroPlayerId = useMemo(() => {
    if (!selectedHand) return null;
    const mySeat = selectedHand.gameState?.mySeat;
    if (!mySeat) return null;
    return selectedHand.seatPlayers?.[mySeat] || selectedHand.seatPlayers?.[String(mySeat)] || null;
  }, [selectedHand]);

  const handleDeleteHand = useCallback(async (handId, sessionId) => {
    if (!confirm('Delete this hand? This cannot be undone.')) return;
    try {
      await deleteHand(handId);
      const currentSessionId = currentSession?.sessionId;
      if (currentSessionId && sessionId === currentSessionId) {
        try {
          const newCount = await getSessionHandCount(currentSessionId);
          dispatchSession({ type: SESSION_ACTIONS.SET_HAND_COUNT, payload: { count: newCount } });
        } catch (e) {
          logger.error('HandReviewPanel', e);
        }
      }
      await refresh();
      showSuccess('Hand deleted');
    } catch (error) {
      logger.error('HandReviewPanel', error);
      showError('Failed to delete hand.');
    }
  }, [currentSession, dispatchSession, refresh, showError, showSuccess]);

  const handleReplayHand = useCallback((handId) => {
    // Find the hand object to pass along, avoiding a redundant IndexedDB fetch in HandReplayView
    const hand = hands.find(h => h.handId === handId) || null;
    setReplayHand(handId, hand);
    setCurrentScreen(SCREEN.HAND_REPLAY);
  }, [setReplayHand, setCurrentScreen, hands]);

  // Per-action range/equity analysis — lazy: only compute when an action is focused
  const analysisHand = focusedActionIndex !== null ? selectedHand : null;
  const { actionAnalysis, isComputing } = useHandReplayAnalysis(analysisHand, timeline, tendencyMap);

  // Compute rule-based analysis for focused action
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

  // Get the actionAnalysis entry for the focused action
  const focusedAnalysisEntry = useMemo(() => {
    if (focusedActionIndex === null || !actionAnalysis) return null;
    // Match by order since actionAnalysis maps 1:1 to timeline
    return actionAnalysis[focusedActionIndex] || null;
  }, [focusedActionIndex, actionAnalysis]);

  return (
    <div className="grid grid-cols-[minmax(200px,240px)_1fr_1fr] gap-3 h-[540px]">
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
            onDeleteHand={handleDeleteHand}
            onReplayHand={handleReplayHand}
            tendencyMap={tendencyMap}
            heroPlayerId={heroPlayerId}
          />
        )}
      </div>

      {/* Center: Hand Walkthrough */}
      <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 overflow-hidden">
        <h3 className="text-sm font-bold mb-2 text-indigo-400">
          Walkthrough
          {isComputing && <span className="ml-2 text-[10px] text-gray-500">(analyzing...)</span>}
        </h3>
        <HandWalkthrough
          selectedHand={selectedHand}
          streetActions={streetActions}
          currentStreet={currentStreet}
          availableStreets={availableStreets}
          communityCardsForStreet={communityCardsForStreet}
          heroSeat={heroSeat}
          focusedActionIndex={focusedActionIndex}
          timeline={timeline}
          allPlayers={allPlayers}
          actionAnalysis={actionAnalysis}
          onSetStreet={setCurrentStreet}
          onFocusAction={focusAction}
          onPrevStreet={prevStreet}
          onNextStreet={nextStreet}
        />
      </div>

      {/* Right: Review Observations */}
      <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 overflow-hidden overflow-y-auto">
        <h3 className="text-sm font-bold mb-2 text-indigo-400">Observations</h3>
        <ReviewObservations
          analysis={analysis}
          actionAnalysisEntry={focusedAnalysisEntry}
        />
      </div>
    </div>
  );
};
