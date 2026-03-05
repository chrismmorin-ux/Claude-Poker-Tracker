import React from 'react';
import PropTypes from 'prop-types';
import { ActionSequence } from '../../ui/ActionSequence';
import { LAYOUT } from '../../../constants/gameConstants';
import { PrimitiveActionButton } from '../../ui/PrimitiveActionButton';
import { getValidActions, hasBetOnStreet } from '../../../utils/actionUtils';
import { useGame } from '../../../contexts';

/**
 * ActionPanel - Action buttons panel for selected seats
 */
export const ActionPanel = ({
  selectedPlayers,
  currentStreet,
  seatActions,
  onClearSelection,
  onToggleAbsent,
  onClearSeatActions,
  onUndoLastAction,
}) => {
  const { recordPrimitiveAction } = useGame();

  const isMultiSeat = selectedPlayers.length > 1;
  const hasBet = currentStreet !== 'preflop' ? hasBetOnStreet(seatActions, currentStreet) : false;
  const validActions = getValidActions(currentStreet, hasBet, isMultiSeat);

  /**
   * Record a primitive action for all selected seats.
   * @param {string} action - Primitive action (PRIMITIVE_ACTIONS.*)
   */
  const handleRecordAction = (action) => {
    if (recordPrimitiveAction) {
      selectedPlayers.forEach(seat => {
        recordPrimitiveAction(seat, action);
      });
    }
  };

  if (selectedPlayers.length === 0 || currentStreet === 'showdown') {
    return null;
  }

  const singleSeat = selectedPlayers.length === 1 ? selectedPlayers[0] : null;
  const actionArray = singleSeat ? (seatActions[currentStreet]?.[singleSeat] || []) : [];

  return (
    <div
      className="absolute bg-white rounded-lg shadow-2xl p-4"
      style={{
        width: `${LAYOUT.ACTION_PANEL_WIDTH}px`,
        top: `${LAYOUT.ACTION_PANEL_TOP}px`,
        left: `${LAYOUT.TABLE_OFFSET_X + LAYOUT.FELT_WIDTH + 20}px`
      }}
    >
      <div className="flex justify-between items-center mb-3 pb-2 border-b-2">
        <h3 className="text-2xl font-bold">
          {singleSeat
            ? `Seat ${singleSeat}`
            : `${selectedPlayers.length} Seats: ${selectedPlayers.sort((a,b) => a-b).join(', ')}`
          }
        </h3>
        <div className="text-base font-semibold text-blue-600 uppercase">{currentStreet}</div>
      </div>

      {/* Current action sequence display - only for single seat */}
      {singleSeat && actionArray.length > 0 && (
        <div className="mb-3 p-2 bg-blue-50 rounded">
          <div className="text-xs font-semibold text-gray-700 mb-1">Current Actions:</div>
          <ActionSequence
            actions={actionArray}
            size="medium"
            maxVisible={5}
          />
        </div>
      )}

      <div className={`grid ${validActions.length <= 3 ? 'grid-cols-3' : validActions.length <= 4 ? 'grid-cols-4' : 'grid-cols-5'} gap-2`}>
        {validActions.map(action => (
          <PrimitiveActionButton
            key={action}
            action={action}
            onClick={handleRecordAction}
          />
        ))}
      </div>

      <button onClick={onClearSelection} className="mt-3 w-full py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold">Clear Selection</button>
      <button onClick={onToggleAbsent} className="mt-2 w-full py-2 bg-gray-800 hover:bg-gray-900 text-white rounded font-semibold">Mark as Absent</button>

      {/* Clear and Undo buttons - only for single seat with actions */}
      {singleSeat && actionArray.length > 0 && (
        <>
          <button
            onClick={() => onClearSeatActions([singleSeat])}
            className="mt-2 w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
          >
            Clear Seat Actions
          </button>
          <button
            onClick={() => onUndoLastAction(singleSeat)}
            className="mt-2 w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-semibold"
          >
            ↶ Undo Last Action
          </button>
        </>
      )}
    </div>
  );
};

ActionPanel.propTypes = {
  selectedPlayers: PropTypes.arrayOf(PropTypes.number).isRequired,
  currentStreet: PropTypes.string.isRequired,
  seatActions: PropTypes.object.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  onToggleAbsent: PropTypes.func.isRequired,
  onClearSeatActions: PropTypes.func.isRequired,
  onUndoLastAction: PropTypes.func.isRequired,
};
