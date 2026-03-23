/**
 * VillainAnalysisSection.jsx - Villain analysis panel for hand replay
 *
 * Shows villain range grid, equity bars, segmentation, hindsight lens toggle,
 * and "with hindsight" analysis when villain cards are revealed.
 */

import React, { useMemo } from 'react';
import { getPositionName } from '../../../utils/positionUtils';
import { LUCKY_COLORS } from '../../../constants/designTokens';
import { useHindsightAnalysis } from '../../../hooks/useHindsightAnalysis';
import { getCardsForStreet } from '../../../utils/pokerCore/cardParser';
import { getPlayerName } from '../../../utils/playerNameMap';
import { RangeGrid } from '../../ui/RangeGrid';
import { SegmentationBar } from '../../ui/SegmentationBar';

export const VillainAnalysisSection = ({
  selectedVillainSeat,
  villainAnalysis,
  villainCards,
  pinnedVillainSeat,
  analysisLens,
  setAnalysisLens,
  currentAnalysis,
  currentActionEntry,
  potAtPoint,
  hand,
  isHeroAction,
  seatNames,
  buttonSeat,
  villainStyle,
}) => {

  // Derive current street from action entry
  const currentStreet = currentActionEntry?.street || 'preflop';

  // Full community cards for hindsight runout
  const fullBoard = useMemo(() => {
    const cards = hand?.cardState?.communityCards || hand?.gameState?.communityCards || [];
    return cards.filter(c => c && c.trim().length >= 2);
  }, [hand]);

  // Board at decision point
  const currentBoard = useMemo(() => {
    const cards = hand?.cardState?.communityCards || hand?.gameState?.communityCards || [];
    return getCardsForStreet(cards, currentStreet);
  }, [hand, currentStreet]);

  // Hindsight analysis — only computes when villainCards revealed + hindsight lens active
  const hindsightVillainCards = analysisLens === 'hindsight' ? villainCards : null;
  const heroRangeForHindsight = analysisLens === 'hindsight'
    ? (villainAnalysis?.heroRangeAtPoint || currentAnalysis?.heroRangeAtPoint || null)
    : null;
  const { hindsight, isComputing: isHindsightComputing } = useHindsightAnalysis(
    hindsightVillainCards,
    heroRangeForHindsight,
    currentBoard,
    fullBoard,
    villainAnalysis?.action || null,
    potAtPoint,
    currentActionEntry?.amount || 0
  );

  const canShowHindsight = villainCards && selectedVillainSeat;

  if (!selectedVillainSeat) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        {isHeroAction
          ? 'Hero action — tap a villain seat to analyze'
          : 'No analysis available'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Villain header */}
      <div className="flex items-center gap-2">
        <span className="text-white font-semibold text-sm">
          {getPlayerName(seatNames, selectedVillainSeat)}
        </span>
        <span className="text-gray-500 text-xs">
          {getPositionName(selectedVillainSeat, buttonSeat)}
        </span>
        {villainStyle && (
          <span className="text-indigo-400 text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-900/30">
            {villainStyle}
          </span>
        )}
        {pinnedVillainSeat && (
          <span className="text-cyan-600 text-[9px]">pinned</span>
        )}
      </div>

      {/* Revealed cards */}
      {villainCards && (
        <div className="bg-indigo-900/30 rounded-lg p-2 border border-indigo-500/30">
          <div className="text-indigo-400 text-[10px] mb-1 font-semibold">Actual Hand</div>
          <span className="text-white text-lg font-mono font-bold">
            {villainCards[0]} {villainCards[1]}
          </span>
          {villainAnalysis?.actionClass && (
            <span className={`ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
              villainAnalysis.actionClass === 'value'
                ? 'bg-green-900/50 text-green-400'
                : 'bg-red-900/50 text-red-400'
            }`}>
              {villainAnalysis.actionClass === 'value' ? 'Value' : 'Bluff'}
            </span>
          )}
        </div>
      )}

      {/* Lens toggle */}
      {canShowHindsight && (
        <div className="flex gap-1">
          <button
            onClick={() => setAnalysisLens('moment')}
            className={`flex-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              analysisLens === 'moment'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            In the Moment
          </button>
          <button
            onClick={() => setAnalysisLens('hindsight')}
            className={`flex-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              analysisLens === 'hindsight'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            With Hindsight
          </button>
        </div>
      )}

      {/* "In the Moment" view */}
      {analysisLens === 'moment' && (
        <>
          {/* Range grid */}
          {villainAnalysis?.preActionRanges ? (
            <div>
              <div className="text-gray-500 text-[10px] mb-1">
                {villainAnalysis.preActionLabel || 'Preflop Decision'}
              </div>
              <RangeGrid actionRanges={villainAnalysis.preActionRanges} size="compact" hideConfidence />
            </div>
          ) : villainAnalysis?.rangeAtPoint ? (
            <div>
              <div className="text-gray-500 text-[10px] mb-1">
                {villainAnalysis.rangeLabel || 'Estimated Range'}
              </div>
              <RangeGrid weights={villainAnalysis.rangeAtPoint} size="compact" hideConfidence />
            </div>
          ) : (
            <div className="text-gray-600 text-xs">No range data at this point</div>
          )}

          {/* Range equity vs hero */}
          {villainAnalysis?.heroEquity !== null && villainAnalysis?.heroEquity !== undefined && (
            <div>
              <div className="text-gray-500 text-[10px] mb-1">Range Equity vs Hero</div>
              {(() => {
                const villainEq = Math.round((1 - villainAnalysis.heroEquity) * 100);
                return (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${villainEq}%`,
                          backgroundColor: villainEq > 50 ? '#ef4444' : '#22c55e',
                        }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${
                      villainEq > 50 ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {villainEq}%
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Segmentation */}
          {villainAnalysis?.segmentation?.buckets && (
            <div>
              <div className="text-gray-500 text-[10px] mb-1">Range Composition</div>
              <SegmentationBar buckets={villainAnalysis.segmentation.buckets} size="sm" />
            </div>
          )}

          {/* Range profitability */}
          {villainAnalysis?.rangeEquity !== null && villainAnalysis?.rangeEquity !== undefined && (
            <div>
              <div className="text-gray-500 text-[10px] mb-1">Range Profitability</div>
              <div className="text-white text-xs">
                {Math.round(villainAnalysis.rangeEquity)}% of range is profitable
              </div>
            </div>
          )}
        </>
      )}

      {/* "With Hindsight" view */}
      {analysisLens === 'hindsight' && villainCards && (
        <div className="space-y-3">
          {isHindsightComputing ? (
            <div className="text-gray-500 text-xs text-center py-4">
              Computing hindsight analysis...
            </div>
          ) : hindsight ? (
            <>
              {/* Actual equity at decision point */}
              <div>
                <div className="text-gray-500 text-[10px] mb-1">
                  Actual Equity at Decision ({villainCards[0]} {villainCards[1]})
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round(hindsight.actualEquity * 100)}%`,
                        backgroundColor: hindsight.actualEquity > 0.5 ? '#a855f7' : '#6b7280',
                      }}
                    />
                  </div>
                  <span className="text-purple-300 text-xs font-bold">
                    {Math.round(hindsight.actualEquity * 100)}%
                  </span>
                </div>
              </div>

              {/* Runout equity */}
              {hindsight.runoutEquity !== null && (
                <div>
                  <div className="text-gray-500 text-[10px] mb-1">Equity After Runout</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round(hindsight.runoutEquity * 100)}%`,
                          backgroundColor: hindsight.runoutEquity > 0.5 ? '#a855f7' : '#6b7280',
                        }}
                      />
                    </div>
                    <span className="text-purple-300 text-xs font-bold">
                      {Math.round(hindsight.runoutEquity * 100)}%
                    </span>
                  </div>
                  <div className="text-gray-500 text-[9px] mt-0.5">
                    Board changed equity from {Math.round(hindsight.actualEquity * 100)}% to {Math.round(hindsight.runoutEquity * 100)}%
                  </div>
                </div>
              )}

              {/* Lucky/unlucky badge */}
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    backgroundColor: LUCKY_COLORS[hindsight.luckyUnlucky].bg,
                    color: LUCKY_COLORS[hindsight.luckyUnlucky].text,
                  }}
                >
                  {LUCKY_COLORS[hindsight.luckyUnlucky].label}
                </span>
              </div>

              {/* Correct play verdict */}
              <div className="bg-purple-900/20 rounded p-2 border border-purple-600/30">
                <div className="text-purple-300 text-[10px]">
                  {hindsight.wasCorrectPlay}
                </div>
              </div>
            </>
          ) : (
            <div className="text-gray-600 text-xs text-center py-4">
              Unable to compute hindsight analysis
            </div>
          )}
        </div>
      )}
    </div>
  );
};
