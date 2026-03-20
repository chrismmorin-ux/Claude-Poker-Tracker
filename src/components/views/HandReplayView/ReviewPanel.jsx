/**
 * ReviewPanel.jsx - Right-side analysis panel for hand replay
 *
 * Sections: Street progress, playback transport, current action card, villain analysis.
 */

import React, { useMemo } from 'react';
import { getPositionName } from '../../../utils/positionUtils';
import { PRIMITIVE_BUTTON_CONFIG } from '../../../constants/primitiveActions';
import { RangeGrid } from '../../ui/RangeGrid';
import { SegmentationBar } from '../../ui/SegmentationBar';
import { parseAndEncode, getCardsForStreet } from '../../../utils/pokerCore/cardParser';

const STREET_LABELS = { preflop: 'PF', flop: 'Flop', turn: 'Turn', river: 'River' };

// EV verdict colors
const EV_COLORS = {
  '+EV': { bg: '#166534', text: '#4ade80' },
  '-EV': { bg: '#7f1d1d', text: '#f87171' },
  'neutral': { bg: '#374151', text: '#9ca3af' },
};

export const ReviewPanel = ({
  replay,
  hand,
  heroSeat,
  buttonSeat,
  seatPlayers,
  allPlayers,
  tendencyMap,
  actionAnalysis,
  allPlayerCards,
}) => {
  const {
    currentActionIndex, currentStreet, currentActionEntry, currentAnalysis,
    villainAnalysis, selectedVillainSeat, pinnedVillainSeat, revealedSeats,
    availableStreets, timelineLength, potAtPoint,
    stepForward, stepBack, jumpToStart, jumpToEnd, jumpToStreet,
  } = replay;

  // Determine if selected villain's cards are known (revealed or always visible)
  const villainCards = useMemo(() => {
    if (!selectedVillainSeat) return null;
    const cards = allPlayerCards[selectedVillainSeat] || allPlayerCards[String(selectedVillainSeat)];
    if (!cards || !cards[0] || !cards[1]) return null;
    if (!revealedSeats.has(selectedVillainSeat)) return null;
    return cards;
  }, [selectedVillainSeat, allPlayerCards, revealedSeats]);

  const getPlayerName = (seat) => {
    const playerId = seatPlayers[seat];
    if (!playerId) return `Seat ${seat}`;
    const player = allPlayers.find(p => String(p.playerId) === String(playerId));
    return player?.name || `P${seat}`;
  };

  const getPlayerStyle = (seat) => {
    const playerId = seatPlayers[seat];
    if (!playerId) return null;
    return tendencyMap?.[playerId]?.style || null;
  };

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* A. Street Progress */}
      <div className="flex gap-1.5 shrink-0">
        {availableStreets.map((street) => {
          const isCurrent = street === currentStreet;
          const streetIdx = availableStreets.indexOf(street);
          const currentStreetIdx = availableStreets.indexOf(currentStreet);
          const isCompleted = streetIdx < currentStreetIdx;
          return (
            <button
              key={street}
              onClick={() => jumpToStreet(street)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                ${isCurrent
                  ? 'bg-cyan-600 text-white'
                  : isCompleted
                    ? 'bg-gray-700 text-cyan-400'
                    : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                }
              `}
            >
              {isCompleted && <span className="mr-1">&#10003;</span>}
              {STREET_LABELS[street] || street}
            </button>
          );
        })}
      </div>

      {/* B. Playback Transport */}
      <div className="flex items-center gap-2 shrink-0 bg-gray-800/50 rounded-lg px-3 py-2">
        <button onClick={jumpToStart} className="text-gray-400 hover:text-white text-sm px-1" title="Jump to start (Home)">
          |&#9664;
        </button>
        <button onClick={stepBack} className="text-gray-400 hover:text-white text-lg px-1" title="Step back (Left)">
          &#9664;
        </button>
        <button onClick={stepForward} className="text-gray-400 hover:text-white text-lg px-1" title="Step forward (Right)">
          &#9654;
        </button>
        <button onClick={jumpToEnd} className="text-gray-400 hover:text-white text-sm px-1" title="Jump to end (End)">
          &#9654;|
        </button>
        <span className="text-gray-500 text-xs ml-auto">
          Action {currentActionIndex + 1} / {timelineLength}
        </span>
      </div>

      {/* C. Current Action Card */}
      {currentActionEntry && (
        <div className="shrink-0 bg-gray-800/60 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">
              {getPositionName(Number(currentActionEntry.seat), buttonSeat)}
            </span>
            <span className="text-white text-sm font-semibold">
              {getPlayerName(Number(currentActionEntry.seat))}
            </span>
            {(() => {
              const config = PRIMITIVE_BUTTON_CONFIG[currentActionEntry.action];
              return config ? (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: config.bg }}
                >
                  {config.label}
                  {currentActionEntry.amount ? ` $${currentActionEntry.amount}` : ''}
                </span>
              ) : (
                <span className="text-gray-400 text-xs">{currentActionEntry.action}</span>
              );
            })()}
          </div>

          {/* EV badge */}
          {currentAnalysis?.evAssessment && (
            <div className="mt-2 flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold"
                style={{
                  backgroundColor: EV_COLORS[currentAnalysis.evAssessment.verdict]?.bg || '#374151',
                  color: EV_COLORS[currentAnalysis.evAssessment.verdict]?.text || '#9ca3af',
                }}
              >
                {currentAnalysis.evAssessment.verdict}
              </span>
              <span className="text-gray-500 text-[10px]">
                {currentAnalysis.evAssessment.reason}
              </span>
            </div>
          )}

          {/* Action class (value/bluff) */}
          {currentAnalysis?.actionClass && (
            <div className="mt-1">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                currentAnalysis.actionClass === 'value'
                  ? 'bg-green-900/50 text-green-400'
                  : 'bg-red-900/50 text-red-400'
              }`}>
                {currentAnalysis.actionClass}
              </span>
            </div>
          )}
        </div>
      )}

      {/* D. Villain Analysis */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!selectedVillainSeat ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            {heroSeat && currentActionEntry && Number(currentActionEntry.seat) === heroSeat
              ? 'Hero action — tap a villain seat to analyze'
              : 'No analysis available'}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Villain header */}
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm">
                {getPlayerName(selectedVillainSeat)}
              </span>
              <span className="text-gray-500 text-xs">
                {getPositionName(selectedVillainSeat, buttonSeat)}
              </span>
              {getPlayerStyle(selectedVillainSeat) && (
                <span className="text-indigo-400 text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-900/30">
                  {getPlayerStyle(selectedVillainSeat)}
                </span>
              )}
              {pinnedVillainSeat && (
                <span className="text-cyan-600 text-[9px]">pinned</span>
              )}
            </div>

            {/* Revealed cards — show prominently at top when visible */}
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

            {/* Range grid — show multi-action distribution when available (preflop), else single range */}
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

            {/* Villain's range equity vs hero (villain's perspective) */}
            {villainAnalysis?.heroEquity !== null && villainAnalysis?.heroEquity !== undefined && (
              <div>
                <div className="text-gray-500 text-[10px] mb-1">
                  Range Equity vs Hero
                </div>
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

            {/* When cards revealed: actual hand equity vs hero */}
            {villainCards && villainAnalysis?.heroEquity !== null && villainAnalysis?.heroEquity !== undefined && (
              <div>
                <div className="text-gray-500 text-[10px] mb-1">
                  Actual Hand Equity vs Hero
                </div>
                <div className="text-indigo-300 text-xs">
                  {villainCards[0]} {villainCards[1]} vs Hero&apos;s range
                </div>
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
          </div>
        )}
      </div>
    </div>
  );
};
