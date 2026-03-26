import React from 'react';
import { ActionSequence } from '../../ui/ActionSequence';
import { getActionsForSeatOnStreet, hasSeatFolded } from '../../../utils/sequenceUtils';
import { ACTIONS, SEAT_STATUS, isFoldAction } from '../../../constants/gameConstants';
import { getActionDisplayName } from '../../../utils/actionUtils';
import { getActionBadgeStyle } from '../../../constants/designTokens';

/**
 * ActionHistoryGrid - Street-by-street action history display
 */
export const ActionHistoryGrid = ({
  SEAT_ARRAY,
  STREETS,
  actionSequence = [],
  allPlayerCards,
  holeCards,
  mySeat,
  isSeatInactive,
  getHandAbbreviation,
}) => {
  return (
    <div className="bg-white rounded shadow p-4">
      <div className="grid grid-cols-9 gap-2">
        {/* Headers with Labels buttons */}
        {SEAT_ARRAY.map(seat => (
          <div key={seat} className="flex flex-col items-center">
            <button className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded font-semibold w-full mb-2">
              Labels
            </button>
          </div>
        ))}
      </div>

      {/* Street Sections */}
      {STREETS.map(street => (
        <div key={street} className="mb-3">
          <div className="text-xs font-bold text-gray-700 uppercase mb-1 border-b-2 border-gray-600 pb-1">
            {street}
          </div>
          <div className="grid grid-cols-9 gap-2">
            {SEAT_ARRAY.map(seat => {
              const actionArray = getActionsForSeatOnStreet(actionSequence, seat, street);
              const lastAction = actionArray[actionArray.length - 1];
              const inactiveStatus = isSeatInactive(seat);
              const cards = seat === mySeat ? holeCards : allPlayerCards[seat];

              let displayAction = '';
              let actionStyle = { backgroundColor: '#f3f4f6', color: '#111827' }; // gray-100 default

              // For showdown street, check if player folded on a previous street
              let effectiveAction = lastAction;
              if (street === 'showdown' && !lastAction) {
                const hasFolded = hasSeatFolded(actionSequence, seat);
                if (hasFolded) {
                  effectiveAction = ACTIONS.FOLD;
                }
              }

              // For betting streets, show full action sequence
              // For showdown, show last action only
              if (street !== 'showdown' && actionArray.length > 0) {
                displayAction = actionArray.map(a => getActionDisplayName(a)).join(' → ');
                actionStyle = getActionBadgeStyle(lastAction);
              } else if (effectiveAction) {
                actionStyle = getActionBadgeStyle(effectiveAction);
                displayAction = getActionDisplayName(effectiveAction);

                // For showdown, add cards if available
                if (street === 'showdown') {
                  const handAbbr = getHandAbbreviation(cards);

                  if (effectiveAction === ACTIONS.MUCKED) {
                    displayAction = 'muck';
                  } else if (effectiveAction === ACTIONS.WON) {
                    displayAction = handAbbr ? `won ${handAbbr}` : 'won';
                  } else if (isFoldAction(effectiveAction)) {
                    displayAction = handAbbr ? `fold ${handAbbr}` : 'fold';
                  } else if (inactiveStatus === SEAT_STATUS.ABSENT) {
                    displayAction = '';
                  } else {
                    displayAction = handAbbr ? `show ${handAbbr}` : '';
                  }
                }
              } else if (street === 'showdown') {
                const handAbbr = getHandAbbreviation(cards);
                if (handAbbr && inactiveStatus !== SEAT_STATUS.ABSENT && inactiveStatus !== SEAT_STATUS.FOLDED) {
                  displayAction = `show ${handAbbr}`;
                  actionStyle = { backgroundColor: '#f3f4f6', color: '#111827' };
                }
              }

              return (
                <div key={seat} className="text-center py-1 px-1 text-xs" style={{ minHeight: '24px' }}>
                  {street !== 'showdown' && actionArray.length > 0 ? (
                    <div className="flex justify-center">
                      <ActionSequence
                        actions={actionArray}
                        size="small"
                        maxVisible={3}
                      />
                    </div>
                  ) : displayAction ? (
                    <div className="rounded px-1 py-1 font-semibold" style={actionStyle}>
                      {displayAction}
                    </div>
                  ) : (
                    <div className="text-gray-300">—</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

