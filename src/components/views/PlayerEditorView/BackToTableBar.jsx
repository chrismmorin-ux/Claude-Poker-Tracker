/**
 * BackToTableBar.jsx — Sticky top bar for fullscreen player editor (PEO-2)
 *
 * Always visible at the top of PlayerEditorView. One prominent back button,
 * an optional title (e.g. "Assign to Seat 3"), and a Save button on the right.
 *
 * Back-to-Table is INSTANT — it flushes any pending draft autosave through
 * the parent-provided `onBack` handler and returns to prevScreen. No
 * confirmation dialog per plan §D5 (non-blocking).
 */

import React from 'react';
import { ChevronLeft } from 'lucide-react';

export const BackToTableBar = ({
  onBack,
  onSave,
  title = 'New Player',
  isSaving = false,
}) => {
  return (
    <div
      className="sticky top-0 z-20 flex items-center justify-between bg-gray-900 text-white px-4 py-3 border-b border-gray-700"
      data-testid="back-to-table-bar"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium hover:bg-gray-800 px-2 py-1 rounded"
        data-testid="back-to-table-btn"
      >
        <ChevronLeft size={20} />
        Back
      </button>
      <h2 className="text-sm font-semibold truncate mx-2">{title}</h2>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold text-sm px-4 py-1.5 rounded disabled:opacity-60"
        data-testid="save-player-btn"
      >
        {isSaving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
};

export default BackToTableBar;
