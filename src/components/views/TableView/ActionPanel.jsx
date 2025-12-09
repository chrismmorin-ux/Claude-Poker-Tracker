import React from 'react';
import PropTypes from 'prop-types';
import { ActionSequence } from '../../ui/ActionSequence';
import { LAYOUT, ACTIONS, ACTION_ABBREV } from '../../../constants/gameConstants';

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
          <button onClick={() => onRecordAction(ACTIONS.FOLD)} className="py-4 bg-red-400 hover:bg-red-500 rounded-lg font-bold text-base text-white">Fold</button>
          <button onClick={() => onRecordAction(ACTIONS.LIMP)} className="py-4 bg-gray-400 hover:bg-gray-500 rounded-lg font-bold text-base text-white">Limp</button>
          <button onClick={() => onRecordAction(ACTIONS.CALL)} className="py-4 bg-blue-300 hover:bg-blue-400 rounded-lg font-bold text-base text-white">Call</button>
          <button onClick={() => onRecordAction(ACTIONS.OPEN)} className="py-4 bg-green-400 hover:bg-green-500 rounded-lg font-bold text-base text-white">Open</button>
          <button onClick={() => onRecordAction(ACTIONS.THREE_BET)} className="py-4 bg-yellow-400 hover:bg-yellow-500 rounded-lg font-bold text-base">3bet</button>
          <button onClick={() => onRecordAction(ACTIONS.FOUR_BET)} className="py-4 bg-orange-400 hover:bg-orange-500 rounded-lg font-bold text-base text-white">4bet</button>
        </div>
      ) : (
        <>
          <div className="mb-3">
            <div className="text-sm font-bold text-blue-700 mb-2">IF PFR:</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => onRecordAction(ACTIONS.CBET_IP_SMALL)} className="py-3 bg-green-200 hover:bg-green-300 rounded font-semibold text-sm">Cbet IP (S)</button>
              <button onClick={() => onRecordAction(ACTIONS.CBET_IP_LARGE)} className="py-3 bg-green-300 hover:bg-green-400 rounded font-semibold text-sm">Cbet IP (L)</button>
              <button onClick={() => onRecordAction(ACTIONS.CHECK)} className="py-3 bg-blue-200 hover:bg-blue-300 rounded font-semibold text-sm">Check</button>
              <button onClick={() => onRecordAction(ACTIONS.CBET_OOP_SMALL)} className="py-3 bg-green-200 hover:bg-green-300 rounded font-semibold text-sm">Cbet OOP (S)</button>
              <button onClick={() => onRecordAction(ACTIONS.CBET_OOP_LARGE)} className="py-3 bg-green-300 hover:bg-green-400 rounded font-semibold text-sm">Cbet OOP (L)</button>
              <button onClick={() => onRecordAction(ACTIONS.FOLD_TO_CR)} className="py-3 bg-red-200 hover:bg-red-300 rounded font-semibold text-sm">Fold to CR</button>
            </div>
          </div>

          <div>
            <div className="text-sm font-bold text-purple-700 mb-2">IF PFC:</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => onRecordAction(ACTIONS.DONK)} className="py-3 bg-orange-200 hover:bg-orange-300 rounded font-semibold text-sm">Donk</button>
              <button onClick={() => onRecordAction(ACTIONS.STAB)} className="py-3 bg-yellow-200 hover:bg-yellow-300 rounded font-semibold text-sm">Stab</button>
              <button onClick={() => onRecordAction(ACTIONS.CHECK)} className="py-3 bg-blue-200 hover:bg-blue-300 rounded font-semibold text-sm">Check</button>
              <button onClick={() => onRecordAction(ACTIONS.CHECK_RAISE)} className="py-3 bg-orange-200 hover:bg-orange-300 rounded font-semibold text-sm">Check-Raise</button>
              <button onClick={() => onRecordAction(ACTIONS.FOLD_TO_CBET)} className="py-3 bg-red-200 hover:bg-red-300 rounded font-semibold text-sm">Fold to Cbet</button>
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
