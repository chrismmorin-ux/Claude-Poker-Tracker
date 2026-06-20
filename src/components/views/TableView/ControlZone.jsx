/**
 * ControlZone.jsx — Bottom control area for TableView
 *
 * Contains clear seat/undo, utility row (deselect, absent, reset street/hand),
 * and the primary Next Hand CTA.
 */

import React from 'react';
import { Undo2, SkipForward, RotateCcw, Star } from 'lucide-react';

export const ControlZone = ({
  singleSeat, actionArray, hasSeatSelected, remainingCount, currentStreet,
  isMultiSeat = false, onUndoLastSeat,
  batchUndoCount = 0, onClearSeat, onUndo, onDeselect, onToggleAbsent,
  onClearStreet, onResetHand, onNextHand,
  reviewTagged = false, onToggleReviewTag,
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

    {/* Tag-for-review (WS-190) — one-tap flag for the in-progress hand. Always
        visible, single tap toggles, no modal/confirm. Surfaces later in the
        Sessions "Tagged ⭐" Review Queue. */}
    {onToggleReviewTag && (
      <div className="flex px-2 pt-2 pb-1">
        <button
          onClick={onToggleReviewTag}
          aria-pressed={reviewTagged}
          aria-label={reviewTagged ? 'Remove review tag from this hand' : 'Tag this hand for later review'}
          title={reviewTagged ? 'Tagged for review — tap to remove' : 'Tag this hand for later review'}
          className="btn-press flex-1 rounded-lg flex items-center justify-center gap-1.5 font-semibold"
          style={{
            height: '48px',
            fontSize: '13px',
            background: reviewTagged ? 'rgba(212, 168, 71, 0.18)' : '#1f2937',
            border: reviewTagged ? '1px solid #d4a847' : '1px solid var(--panel-border)',
            color: reviewTagged ? '#d4a847' : '#9ca3af',
          }}
        >
          <Star size={15} fill={reviewTagged ? '#d4a847' : 'none'} />
          {reviewTagged ? 'Tagged for Review' : 'Tag for Review'}
        </button>
      </div>
    )}

    {/* Utility row — seat/street management
        AUDIT-2026-04-21-TV F10: Reset Hand moved OUT of this row (was adjacent to Next Hand);
        now lives in a gap-separated utility slot above Next Hand to reduce motor-proximity miss-tap risk
        against the gold Next Hand CTA. */}
    <div className={`flex gap-1.5 px-2 pb-1 ${singleSeat && actionArray.length > 0 ? 'pt-1' : 'pt-2'}`}>
      {/* WS-191: step-back Undo for multi-seat entry. Removes only the most
          recently added seat (insertion-order pop), so a single mis-tap in the
          rare multi-seat flow is recoverable one step at a time. Deselect (clear
          all) stays available alongside it. */}
      {isMultiSeat && onUndoLastSeat && (
        <button
          onClick={onUndoLastSeat}
          aria-label="Undo last added seat"
          className="btn-press flex-1 rounded-lg font-semibold text-white flex items-center justify-center gap-1"
          style={{ height: '48px', fontSize: '13px', background: '#854d0e' }}
        >
          <Undo2 size={14} /> Undo Seat
        </button>
      )}
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
        className="btn-press flex-1 rounded-lg flex items-center justify-center gap-1 font-semibold text-gray-400"
        style={{ height: '40px', fontSize: '12px', background: '#1f2937', border: '1px solid var(--panel-border)', opacity: 0.75 }}
      >
        <RotateCcw size={12} />
        Reset Hand
      </button>
    </div>

    {/* Next Hand — primary CTA, always visible, always at very bottom.
        AUDIT-2026-04-21-TV F10: increased top spacing to add physical gap between Reset Hand and the gold CTA. */}
    <div className="px-2 pt-3 pb-2">
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
