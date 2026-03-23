import React, { useMemo } from 'react';
import { getPositionName } from '../../../utils/positionUtils';
import { PRIMITIVE_BUTTON_CONFIG } from '../../../constants/primitiveActions';
import { STREET_LABELS } from '../../../constants/gameConstants';
import { buildSeatNameMap } from '../../../utils/handAnalysis';
import { RangeGrid } from '../../ui/RangeGrid';

const ActionBadge = ({ action }) => {
  const config = PRIMITIVE_BUTTON_CONFIG[action];
  if (!config) {
    return <span className="px-2 py-0.5 rounded text-xs bg-gray-600 text-gray-300">{action}</span>;
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${config.bgColor} ${config.textColor}`}>
      {config.label}
    </span>
  );
};

export const HandWalkthrough = ({
  selectedHand,
  streetActions,
  currentStreet,
  availableStreets,
  communityCardsForStreet,
  heroSeat,
  focusedActionIndex,
  timeline,
  allPlayers,
  actionAnalysis,
  onSetStreet,
  onFocusAction,
  onPrevStreet,
  onNextStreet,
}) => {
  const buttonSeat = selectedHand?.gameState?.dealerButtonSeat ?? 1;
  const seatPlayers = selectedHand?.seatPlayers || {};

  const seatNames = useMemo(() => buildSeatNameMap(seatPlayers, allPlayers), [seatPlayers, allPlayers]);

  if (!selectedHand) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select a hand to review
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Street stepper pills */}
      <div className="flex gap-1 mb-3">
        {availableStreets.map((street) => (
          <button
            key={street}
            onClick={() => onSetStreet(street)}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              currentStreet === street
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {STREET_LABELS[street] || street}
          </button>
        ))}
      </div>

      {/* Community cards */}
      {communityCardsForStreet.length > 0 && (
        <div className="mb-3">
          <span className="text-xs font-semibold text-gray-500 mr-2">Board:</span>
          {communityCardsForStreet.map((card, i) => (
            <span key={i} className="inline-block px-2 py-1 mx-0.5 bg-gray-700 border border-gray-600 text-gray-200 rounded font-mono text-sm font-bold">
              {card}
            </span>
          ))}
        </div>
      )}

      {/* Action timeline */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {streetActions.length === 0 ? (
          <div className="text-center text-gray-400 text-xs mt-4">No actions on this street</div>
        ) : (
          streetActions.map((entry) => {
            const globalIndex = timeline.indexOf(entry);
            const isHero = entry.seat === String(heroSeat);
            const isFocused = globalIndex === focusedActionIndex;
            const posName = getPositionName(Number(entry.seat), buttonSeat);
            const playerName = seatNames[entry.seat] || `S${entry.seat}`;

            return (
              <button
                key={entry.order}
                onClick={() => onFocusAction(globalIndex)}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                  isFocused
                    ? 'bg-indigo-900/30 border border-indigo-500'
                    : isHero
                      ? 'bg-yellow-900/20 border border-yellow-700 hover:bg-yellow-900/30'
                      : 'bg-gray-700 border border-gray-600 hover:bg-gray-600'
                }`}
              >
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  isHero ? 'bg-yellow-500 text-yellow-900' : 'bg-gray-600 text-gray-300'
                }`}>
                  {posName}
                </span>
                <span className={`flex-1 ${isHero ? 'font-semibold text-gray-200' : 'text-gray-400'}`}>
                  {isHero ? 'Hero' : playerName}
                </span>
                <ActionBadge action={entry.action} />
                {isFocused && (
                  <span className="text-indigo-500 text-[10px]">&#9664;</span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Mini Range Grid for focused action */}
      {focusedActionIndex !== null && (actionAnalysis?.[focusedActionIndex]?.preActionRanges || actionAnalysis?.[focusedActionIndex]?.rangeAtPoint) && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">
            {actionAnalysis[focusedActionIndex].preActionRanges
              ? (actionAnalysis[focusedActionIndex].preActionLabel || 'Preflop Decision')
              : (actionAnalysis[focusedActionIndex].rangeLabel
                || `${seatNames[actionAnalysis[focusedActionIndex].seat] || `S${actionAnalysis[focusedActionIndex].seat}`} Range`)}
          </div>
          <div className="flex justify-center">
            {actionAnalysis[focusedActionIndex].preActionRanges ? (
              <RangeGrid
                actionRanges={actionAnalysis[focusedActionIndex].preActionRanges}
                size="compact"
              />
            ) : (
              <RangeGrid
                weights={actionAnalysis[focusedActionIndex].rangeAtPoint}
                size="compact"
              />
            )}
          </div>
        </div>
      )}

      {/* Prev/Next navigation */}
      <div className="flex justify-between mt-3 pt-2 border-t border-gray-700">
        <button
          onClick={onPrevStreet}
          disabled={availableStreets.indexOf(currentStreet) <= 0}
          className="px-3 py-1 rounded text-xs font-semibold bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          &lt; Prev Street
        </button>
        <button
          onClick={onNextStreet}
          disabled={availableStreets.indexOf(currentStreet) >= availableStreets.length - 1}
          className="px-3 py-1 rounded text-xs font-semibold bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next Street &gt;
        </button>
      </div>
    </div>
  );
};
