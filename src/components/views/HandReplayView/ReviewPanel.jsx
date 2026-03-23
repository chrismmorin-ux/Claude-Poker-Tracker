/**
 * ReviewPanel.jsx - Right-side analysis panel for hand replay
 *
 * Sections: Street progress, playback transport, current action card,
 * hero coaching (HeroCoachingCard), villain analysis (VillainAnalysisSection).
 */

import React, { useMemo } from 'react';
import { getPositionName } from '../../../utils/positionUtils';
import { PRIMITIVE_BUTTON_CONFIG } from '../../../constants/primitiveActions';
import { STREET_LABELS_SHORT } from '../../../constants/gameConstants';
import { EV_COLORS } from '../../../constants/designTokens';
import { getPlayerName } from '../../../utils/handAnalysis';
import { HeroCoachingCard } from './HeroCoachingCard';
import { VillainAnalysisSection } from './VillainAnalysisSection';

export const ReviewPanel = ({
  replay,
  hand,
  heroSeat,
  buttonSeat,
  seatPlayers,
  seatNames,
  tendencyMap,
  actionAnalysis,
  allPlayerCards,
}) => {
  const {
    currentActionIndex, currentStreet, currentActionEntry, currentAnalysis,
    villainAnalysis, selectedVillainSeat, pinnedVillainSeat, revealedSeats,
    availableStreets, timelineLength, potAtPoint,
    stepForward, stepBack, jumpToStart, jumpToEnd, jumpToStreet,
    analysisLens, setAnalysisLens,
  } = replay;

  // Determine if selected villain's cards are known (revealed or always visible)
  const villainCards = useMemo(() => {
    if (!selectedVillainSeat) return null;
    const cards = allPlayerCards[selectedVillainSeat] || allPlayerCards[String(selectedVillainSeat)];
    if (!cards || !cards[0] || !cards[1]) return null;
    if (!revealedSeats.has(selectedVillainSeat)) return null;
    return cards;
  }, [selectedVillainSeat, allPlayerCards, revealedSeats]);

  // Compute villainStyle for VillainAnalysisSection
  const villainStyle = useMemo(() => {
    if (!selectedVillainSeat) return null;
    const playerId = seatPlayers[selectedVillainSeat];
    if (!playerId) return null;
    return tendencyMap?.[playerId]?.style || null;
  }, [selectedVillainSeat, seatPlayers, tendencyMap]);

  // Is current action a hero action?
  const isHeroAction = heroSeat && currentActionEntry && Number(currentActionEntry.seat) === heroSeat;
  const heroCoaching = currentAnalysis?.heroAnalysis || null;

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
              {STREET_LABELS_SHORT[street] || street}
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
              {getPlayerName(seatNames, Number(currentActionEntry.seat))}
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

      {/* D. Hero Coaching Card */}
      {isHeroAction && <HeroCoachingCard heroCoaching={heroCoaching} />}

      {/* E. Villain Analysis */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <VillainAnalysisSection
          selectedVillainSeat={selectedVillainSeat}
          villainAnalysis={villainAnalysis}
          villainCards={villainCards}
          pinnedVillainSeat={pinnedVillainSeat}
          analysisLens={analysisLens}
          setAnalysisLens={setAnalysisLens}
          currentAnalysis={currentAnalysis}
          currentActionEntry={currentActionEntry}
          potAtPoint={potAtPoint}
          hand={hand}
          isHeroAction={isHeroAction}
          seatNames={seatNames}
          buttonSeat={buttonSeat}
          villainStyle={villainStyle}
        />
      </div>
    </div>
  );
};
