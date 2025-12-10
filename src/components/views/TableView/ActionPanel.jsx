import React from 'react';
import PropTypes from 'prop-types';
import { ActionSequence } from '../../ui/ActionSequence';
import { LAYOUT, ACTIONS, ACTION_ABBREV } from '../../../constants/gameConstants';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';
import { useGame } from '../../../contexts';

/**
 * ActionPanel - Action buttons panel for selected seats
 */
export const ActionPanel = ({
  selectedPlayers,
  currentStreet,
  seatActions,
  onRecordAction,
  onClearSelection,
  onToggleAbsent,
  onClearSeatActions,
  onUndoLastAction,
}) => {
  // Get recordPrimitiveAction from context
  const { recordPrimitiveAction } = useGame();

  /**
   * Record an action in both legacy and new formats.
   * During transition, we dual-write to maintain compatibility.
   *
   * @param {string} legacyAction - Legacy action constant (ACTIONS.*)
   * @param {string} primitiveAction - Primitive action (PRIMITIVE_ACTIONS.*)
   */
  const handleRecordAction = (legacyAction, primitiveAction) => {
    // Record legacy action for backwards compatibility
    onRecordAction(legacyAction);

    // Also record primitive action for new sequence system
    if (recordPrimitiveAction && primitiveAction) {
      selectedPlayers.forEach(seat => {
        recordPrimitiveAction(seat, primitiveAction);
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
            ACTIONS={ACTIONS}
            ACTION_ABBREV={ACTION_ABBREV}
          />
        </div>
      )}

      {currentStreet === 'preflop' ? (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => handleRecordAction(ACTIONS.FOLD, PRIMITIVE_ACTIONS.FOLD)} className="py-4 bg-red-400 hover:bg-red-500 rounded-lg font-bold text-base text-white">Fold</button>
          <button onClick={() => handleRecordAction(ACTIONS.LIMP, PRIMITIVE_ACTIONS.CALL)} className="py-4 bg-gray-400 hover:bg-gray-500 rounded-lg font-bold text-base text-white">Limp</button>
          <button onClick={() => handleRecordAction(ACTIONS.CALL, PRIMITIVE_ACTIONS.CALL)} className="py-4 bg-blue-300 hover:bg-blue-400 rounded-lg font-bold text-base text-white">Call</button>
          <button onClick={() => handleRecordAction(ACTIONS.OPEN, PRIMITIVE_ACTIONS.RAISE)} className="py-4 bg-green-400 hover:bg-green-500 rounded-lg font-bold text-base text-white">Open</button>
          <button onClick={() => handleRecordAction(ACTIONS.THREE_BET, PRIMITIVE_ACTIONS.RAISE)} className="py-4 bg-yellow-400 hover:bg-yellow-500 rounded-lg font-bold text-base">3bet</button>
          <button onClick={() => handleRecordAction(ACTIONS.FOUR_BET, PRIMITIVE_ACTIONS.RAISE)} className="py-4 bg-orange-400 hover:bg-orange-500 rounded-lg font-bold text-base text-white">4bet</button>
        </div>
      ) : (
        <>
          <div className="mb-3">
            <div className="text-sm font-bold text-blue-700 mb-2">IF PFR:</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleRecordAction(ACTIONS.CBET_IP_SMALL, PRIMITIVE_ACTIONS.BET)} className="py-3 bg-green-200 hover:bg-green-300 rounded font-semibold text-sm">Cbet IP (S)</button>
              <button onClick={() => handleRecordAction(ACTIONS.CBET_IP_LARGE, PRIMITIVE_ACTIONS.BET)} className="py-3 bg-green-300 hover:bg-green-400 rounded font-semibold text-sm">Cbet IP (L)</button>
              <button onClick={() => handleRecordAction(ACTIONS.CHECK, PRIMITIVE_ACTIONS.CHECK)} className="py-3 bg-blue-200 hover:bg-blue-300 rounded font-semibold text-sm">Check</button>
              <button onClick={() => handleRecordAction(ACTIONS.CBET_OOP_SMALL, PRIMITIVE_ACTIONS.BET)} className="py-3 bg-green-200 hover:bg-green-300 rounded font-semibold text-sm">Cbet OOP (S)</button>
              <button onClick={() => handleRecordAction(ACTIONS.CBET_OOP_LARGE, PRIMITIVE_ACTIONS.BET)} className="py-3 bg-green-300 hover:bg-green-400 rounded font-semibold text-sm">Cbet OOP (L)</button>
              <button onClick={() => handleRecordAction(ACTIONS.FOLD_TO_CR, PRIMITIVE_ACTIONS.FOLD)} className="py-3 bg-red-200 hover:bg-red-300 rounded font-semibold text-sm">Fold to CR</button>
            </div>
          </div>

          <div>
            <div className="text-sm font-bold text-purple-700 mb-2">IF PFC:</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleRecordAction(ACTIONS.DONK, PRIMITIVE_ACTIONS.BET)} className="py-3 bg-orange-200 hover:bg-orange-300 rounded font-semibold text-sm">Donk</button>
              <button onClick={() => handleRecordAction(ACTIONS.STAB, PRIMITIVE_ACTIONS.BET)} className="py-3 bg-yellow-200 hover:bg-yellow-300 rounded font-semibold text-sm">Stab</button>
              <button onClick={() => handleRecordAction(ACTIONS.CHECK, PRIMITIVE_ACTIONS.CHECK)} className="py-3 bg-blue-200 hover:bg-blue-300 rounded font-semibold text-sm">Check</button>
              <button onClick={() => handleRecordAction(ACTIONS.CHECK_RAISE, PRIMITIVE_ACTIONS.RAISE)} className="py-3 bg-orange-200 hover:bg-orange-300 rounded font-semibold text-sm">Check-Raise</button>
              <button onClick={() => handleRecordAction(ACTIONS.FOLD_TO_CBET, PRIMITIVE_ACTIONS.FOLD)} className="py-3 bg-red-200 hover:bg-red-300 rounded font-semibold text-sm">Fold to Cbet</button>
            </div>
          </div>
        </>
      )}

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
  onRecordAction: PropTypes.func.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  onToggleAbsent: PropTypes.func.isRequired,
  onClearSeatActions: PropTypes.func.isRequired,
  onUndoLastAction: PropTypes.func.isRequired,
};
