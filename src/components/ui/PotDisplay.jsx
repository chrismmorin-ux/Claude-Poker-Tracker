import React, { useState, useRef } from 'react';

// AUDIT-2026-04-21-TV F9: hold duration before edit-mode engages (H-PLT06 misclick
// absorption — single tap is benign; sustained press is intent).
const POT_EDIT_LONG_PRESS_MS = 400;

/**
 * PotDisplay - Shows running pot total on the felt.
 *
 * AUDIT-2026-04-21-TV F9: Tapping the pot badge is a common miss-path on the felt
 * (the badge sits in the center of the view, directly in the thumb-reach arc for
 * mid-hand-chris reaching for the action panel). Edit mode is now gated behind a
 * long-press so accidental single-taps do not trigger a keyboard + input overlay.
 * The numeric input uses `inputMode="decimal"` for a compact keypad on Android
 * (H-ML03) — this is the first adopter; copy this pattern for other numeric inputs.
 */
export const PotDisplay = ({ potTotal, isEstimated, onCorrect }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showTapHint, setShowTapHint] = useState(false);
  const longPressTimerRef = useRef(null);
  const hintTimerRef = useRef(null);

  const beginEdit = () => {
    setEditValue(String(potTotal));
    setIsEditing(true);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerDown = (e) => {
    e.stopPropagation();
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      beginEdit();
    }, POT_EDIT_LONG_PRESS_MS);
  };

  const handlePointerEndOrLeave = () => {
    // If the long-press timer is still armed when the user releases, this was
    // a short tap — surface the "Long-press to correct" hint briefly rather
    // than entering edit mode.
    if (longPressTimerRef.current) {
      clearLongPressTimer();
      setShowTapHint(true);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => setShowTapHint(false), 1500);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) {
      onCorrect(val);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <form
        onSubmit={handleSubmit}
        className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-1"
        style={{ top: '68%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-amber-300 font-bold text-sm">$</span>
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') handleCancel(); }}
          autoFocus
          className="w-20 px-2 py-1 text-sm font-bold text-center bg-gray-900 text-white border border-amber-500 rounded"
        />
        <button type="submit" className="px-2 py-1 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700">OK</button>
        <button type="button" onClick={handleCancel} className="px-2 py-1 bg-gray-600 text-white text-xs font-bold rounded hover:bg-gray-700">X</button>
      </form>
    );
  }

  return (
    <button
      // AUDIT-2026-04-21-TV F9: long-press to edit. Single tap does not enter edit mode;
      // mouse/touch down starts a 400ms timer, mouse/touch up before it fires = hint only.
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEndOrLeave}
      onPointerLeave={handlePointerEndOrLeave}
      onPointerCancel={handlePointerEndOrLeave}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute left-1/2 transform -translate-x-1/2 px-4 py-1 bg-amber-700 bg-opacity-90 border-2 border-amber-500 rounded-full text-white font-bold text-sm shadow-lg hover:bg-amber-600 transition-colors cursor-pointer"
      style={{ top: '68%' }}
      title="Long-press to correct pot"
    >
      {isEstimated ? '~' : ''}${potTotal}
      {showTapHint && (
        <span
          className="absolute left-1/2 -translate-x-1/2 mt-2 px-2 py-0.5 text-[10px] font-semibold bg-gray-900 text-amber-300 rounded whitespace-nowrap"
          style={{ top: '100%' }}
        >
          Long-press to correct
        </span>
      )}
    </button>
  );
};

