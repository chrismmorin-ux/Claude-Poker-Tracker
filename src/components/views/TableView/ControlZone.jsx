/**
 * ControlZone.jsx — Bottom control area for TableView
 *
 * Contains clear seat/undo, utility row (deselect, absent, reset street/hand),
 * and the primary Next Hand CTA.
 */

import React from 'react';
import { Undo2, SkipForward, RotateCcw } from 'lucide-react';

export const ControlZone = ({
  singleSeat, actionArray, hasSeatSelected, remainingCount, currentStreet,
  batchUndoCount = 0, onClearSeat, onUndo, onDeselect, onToggleAbsent,
  onClearStreet, onResetHand, onNextHand,
}) => (
  <div style={{ background: 'var(--panel-surface)', borderTop: '1px solid var(--panel-border)' }}>
    {/* Clear Seat / Undo — per-seat action management */}
    {singleSeat && actionArray.length > 0 && (
      <div className="flex gap-1.5 px-2 pt-2 pb-1">
        <button
          onClick={() => onClearSeat([singleSeat])}
          className="btn-press flex-1 rounded-lg font-semibold text-white"
          style={{ height: '48px', fontSize: '13px', background: '#7f1d1d' }}
        >
          Clear Seat
        </button>
        <button
          onClick={() => onUndo(singleSeat)}
          className="btn-press flex-1 rounded-lg font-semibold text-white flex items-center justify-center gap-1"
          style={{ height: '48px', fontSize: '13px', background: batchUndoCount > 0 ? '#92400e' : '#854d0e' }}
        >
          <Undo2 size={14} /> {batchUndoCount > 0 ? `Undo ${batchUndoCount}` : 'Undo'}
        </button>
      </div>
    )}

    {/* Utility row — seat/street management */}
    <div className={`flex gap-1.5 px-2 pb-1 ${singleSeat && actionArray.length > 0 ? 'pt-1' : 'pt-2'}`}>
      {hasSeatSelected && (
        <button onClick={onDeselect} className="btn-press flex-1 rounded-lg font-semibold text-white" style={{ height: '48px', fontSize: '13px', background: '#374151' }}>Deselect</button>
      )}
      {hasSeatSelected && (
        <button onClick={onToggleAbsent} className="btn-press flex-1 rounded-lg font-semibold text-white" style={{ height: '48px', fontSize: '13px', background: '#1f2937', border: '1px solid var(--panel-border)' }}>Absent</button>
      )}
      {currentStreet !== 'showdown' && remainingCount > 0 && (
        <button
          onClick={onClearStreet}
          className="btn-press flex-1 rounded-lg font-semibold text-white"
          style={{ height: '48px', fontSize: '13px', background: '#4c0519' }}
        >
          Reset Street
        </button>
      )}
      <button
        onClick={onResetHand}
        className="btn-press flex-1 rounded-lg flex items-center justify-center gap-1 font-semibold text-white"
        style={{ height: '48px', fontSize: '13px', background: '#1f2937', border: '1px solid var(--panel-border)' }}
      >
        <RotateCcw size={14} />
        Reset Hand
      </button>
    </div>

    {/* Next Hand — primary CTA, always visible, always at very bottom */}
    <div className="px-2 pt-1 pb-2">
      <button
        onClick={onNextHand}
        className="btn-press w-full rounded-lg flex items-center justify-center gap-2 font-extrabold shadow-lg"
        style={{ height: '68px', fontSize: '18px', background: 'linear-gradient(180deg, #d4a847 0%, #b8922e 100%)', color: '#1a1200' }}
      >
        <SkipForward size={20} />
        Next Hand
      </button>
    </div>
  </div>
);
