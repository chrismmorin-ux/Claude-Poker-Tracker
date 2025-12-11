import React from 'react';
import PropTypes from 'prop-types';
import { ActionSequence } from '../../ui/ActionSequence';

/**
 * Extract actions for a specific seat/street from either format
 * Prefers actionSequence (new format), falls back to seatActions (legacy)
 *
 * @param {Array} actionSequence - New ordered action sequence format
 * @param {Object} seatActions - Legacy seatActions format
 * @param {string} street - Street to get actions for
 * @param {number} seat - Seat number to get actions for
 * @returns {Array} Array of action strings
 */
const getActionsForSeatStreet = (actionSequence, seatActions, street, seat) => {
  // Prefer actionSequence if available
  if (actionSequence && actionSequence.length > 0) {
    return actionSequence
      .filter(e => e.street === street && e.seat === seat)
      .map(e => e.action);
  }
  // Fallback to legacy seatActions
  return seatActions?.[street]?.[seat] || [];
};

/**
 * Check if a seat has folded in the action sequence
 *
 * @param {Array} actionSequence - Ordered action sequence
 * @param {number} seat - Seat number to check
 * @returns {boolean} True if seat has folded
 */
const hasFoldedInSequence = (actionSequence, seat) => {
  if (!actionSequence || actionSequence.length === 0) return false;
  return actionSequence.some(e => e.seat === seat && e.action === 'fold');
};

/**
 * ActionHistoryGrid - Street-by-street action history display
 */
export const ActionHistoryGrid = ({
  SEAT_ARRAY,
  STREETS,
  BETTING_STREETS,
  ACTIONS,
  ACTION_ABBREV,
  SEAT_STATUS,
  seatActions,
  actionSequence = [],
  allPlayerCards,
  holeCards,
  mySeat,
  isSeatInactive,
  getActionColor,
  getActionDisplayName,
  isFoldAction,
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
              // Use helper to get actions from either format
              const actionArray = getActionsForSeatStreet(actionSequence, seatActions, street, seat);
              const lastAction = actionArray[actionArray.length - 1];
              const inactiveStatus = isSeatInactive(seat);
              const cards = seat === mySeat ? holeCards : allPlayerCards[seat];

              let displayAction = '';
              let actionColor = 'bg-gray-100 text-gray-900';

              // For showdown street, check if player folded on a previous street
              let effectiveAction = lastAction;
              if (street === 'showdown' && !lastAction) {
                // Check both formats for fold detection
                const hasFolded = actionSequence.length > 0
                  ? hasFoldedInSequence(actionSequence, seat)
                  : BETTING_STREETS.some(prevStreet => {
                      const prevActions = seatActions[prevStreet]?.[seat];
                      const prevArray = Array.isArray(prevActions) ? prevActions : (prevActions ? [prevActions] : []);
                      return prevArray.some(a => isFoldAction(a));
                    });
                if (hasFolded) {
                  effectiveAction = ACTIONS.FOLD;
                }
              }

              // For betting streets, show full action sequence
              // For showdown, show last action only
              if (street !== 'showdown' && actionArray.length > 0) {
                displayAction = actionArray.map(a => getActionDisplayName(a)).join(' → ');
                actionColor = getActionColor(lastAction);
              } else if (effectiveAction) {
                actionColor = getActionColor(effectiveAction);
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
                  actionColor = 'bg-gray-100 text-gray-900';
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
                        ACTIONS={ACTIONS}
                        ACTION_ABBREV={ACTION_ABBREV}
                      />
                    </div>
                  ) : displayAction ? (
                    <div className={`${actionColor} rounded px-1 py-1 font-semibold`}>
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

ActionHistoryGrid.propTypes = {
  SEAT_ARRAY: PropTypes.arrayOf(PropTypes.number).isRequired,
  STREETS: PropTypes.arrayOf(PropTypes.string).isRequired,
  BETTING_STREETS: PropTypes.arrayOf(PropTypes.string).isRequired,
  ACTIONS: PropTypes.object.isRequired,
  ACTION_ABBREV: PropTypes.object.isRequired,
  SEAT_STATUS: PropTypes.object.isRequired,
  seatActions: PropTypes.object.isRequired,
  actionSequence: PropTypes.arrayOf(PropTypes.shape({
    seat: PropTypes.number.isRequired,
    action: PropTypes.string.isRequired,
    street: PropTypes.string.isRequired,
    order: PropTypes.number.isRequired,
  })),
  allPlayerCards: PropTypes.object.isRequired,
  holeCards: PropTypes.arrayOf(PropTypes.string).isRequired,
  mySeat: PropTypes.number.isRequired,
  isSeatInactive: PropTypes.func.isRequired,
  getActionColor: PropTypes.func.isRequired,
  getActionDisplayName: PropTypes.func.isRequired,
  isFoldAction: PropTypes.func.isRequired,
  getHandAbbreviation: PropTypes.func.isRequired,
};
