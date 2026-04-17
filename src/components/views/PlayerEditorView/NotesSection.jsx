/**
 * NotesSection.jsx — Free-form notes textarea.
 */

import React from 'react';

export const NotesSection = ({ notes, onNotesChange }) => {
  return (
    <div className="bg-white border border-gray-200 rounded p-3">
      <label htmlFor="player-notes" className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
        Notes
      </label>
      <textarea
        id="player-notes"
        rows={3}
        value={notes || ''}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Playing tendencies, tells, session context…"
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
        data-testid="player-notes-input"
      />
    </div>
  );
};

export default NotesSection;
