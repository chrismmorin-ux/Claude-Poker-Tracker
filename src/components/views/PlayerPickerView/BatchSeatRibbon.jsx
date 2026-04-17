/**
 * BatchSeatRibbon.jsx — Seat progress indicator for batch-entry mode (PEO-3)
 *
 * Appears at the top of PlayerPickerView when batchMode.active. Shows a row
 * of seat pips: filled + check for already-assigned seats, solid for current,
 * hollow for pending. Provides an explicit exit button.
 */

import React from 'react';
import { Check, X } from 'lucide-react';

const NUM_SEATS = 9;

const Pip = ({ seat, state }) => {
  // state: 'current' | 'assigned' | 'pending'
  const base = 'flex items-center justify-center rounded-full text-[11px] font-semibold shrink-0 w-7 h-7 border';
  const styles = {
    current:  'bg-amber-500 text-gray-900 border-amber-500',
    assigned: 'bg-green-600 text-white border-green-600',
    pending:  'bg-white text-gray-500 border-gray-300',
  };
  return (
    <span className={`${base} ${styles[state]}`} data-testid={`seat-pip-${seat}`} data-state={state}>
      {state === 'assigned' ? <Check size={12} /> : seat}
    </span>
  );
};

export const BatchSeatRibbon = ({ currentSeat, assignedSeats, onExit }) => {
  const assignedSet = new Set(assignedSeats || []);
  return (
    <div
      className="flex items-center gap-2 bg-gray-800 text-white px-3 py-2 border-b border-gray-700 overflow-x-auto"
      data-testid="batch-seat-ribbon"
    >
      <span className="text-xs font-semibold shrink-0 text-amber-300">Batch:</span>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: NUM_SEATS }, (_, i) => i + 1).map((seat) => {
          const state = assignedSet.has(seat)
            ? 'assigned'
            : (seat === currentSeat ? 'current' : 'pending');
          return <Pip key={seat} seat={seat} state={state} />;
        })}
      </div>
      <button
        type="button"
        onClick={onExit}
        className="ml-auto shrink-0 flex items-center gap-1 text-xs hover:bg-gray-700 px-2 py-1 rounded"
        data-testid="batch-exit-btn"
      >
        <X size={12} />
        Exit batch
      </button>
    </div>
  );
};

export default BatchSeatRibbon;
