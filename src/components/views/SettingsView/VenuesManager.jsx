import React, { useState } from 'react';
import { GOLD } from '../../../constants/designTokens';

/**
 * VenueRow — a single custom venue with an editable free-text note.
 *
 * The note draft is held locally and committed via setVenueNote on blur, so
 * typing does not dispatch (and re-persist settings) on every keystroke.
 * Phase 1 — Sessions View Improvement (2026-06-06).
 */
const VenueRow = ({ venue, onRemove, onNoteChange }) => {
  const [noteDraft, setNoteDraft] = useState(venue.notes || '');

  const commitNote = () => {
    if ((venue.notes || '') !== noteDraft) {
      onNoteChange(venue.name, noteDraft);
    }
  };

  return (
    <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-gray-100 font-medium">{venue.name}</span>
        <button
          onClick={() => onRemove(venue.name)}
          className="text-red-400 hover:text-red-300 text-sm font-medium px-2 min-h-[44px]"
          title={`Remove ${venue.name}`}
        >
          Remove
        </button>
      </div>
      <textarea
        value={noteDraft}
        onChange={(e) => setNoteDraft(e.target.value)}
        onBlur={commitNote}
        placeholder="Notes (rake, table feel, parking, comps…)"
        rows={2}
        className="w-full px-3 py-2 bg-gray-800 text-gray-200 text-sm rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
      />
    </div>
  );
};

export const VenuesManager = ({ settings, addCustomVenue, removeCustomVenue, setVenueNote }) => {
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueNote, setNewVenueNote] = useState('');
  const [venueError, setVenueError] = useState('');

  const handleAddVenue = () => {
    if (!newVenueName.trim()) {
      setVenueError('Venue name is required');
      return;
    }
    const success = addCustomVenue(newVenueName, newVenueNote);
    if (success) {
      setNewVenueName('');
      setNewVenueNote('');
      setVenueError('');
    } else {
      setVenueError('Venue already exists');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h3 className="text-lg font-bold mb-4" style={{ color: GOLD.base }}>Custom Venues</h3>

      {/* Add new venue */}
      <div className="mb-4">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          Add Custom Venue
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newVenueName}
            onChange={(e) => {
              setNewVenueName(e.target.value);
              setVenueError('');
            }}
            placeholder="Enter venue name"
            className="flex-1 px-3 min-h-[44px] bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleAddVenue}
            className="px-4 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Add
          </button>
        </div>
        <textarea
          value={newVenueNote}
          onChange={(e) => setNewVenueNote(e.target.value)}
          placeholder="Notes for this venue (optional)"
          rows={2}
          className="w-full px-3 py-2 bg-gray-700 text-gray-200 text-sm rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
        />
        {venueError && (
          <p className="mt-1 text-red-400 text-sm">{venueError}</p>
        )}
      </div>

      {/* Custom venues list */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">
          Your Custom Venues
        </label>
        {settings.customVenues.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No custom venues added yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            {settings.customVenues.map((venue) => (
              <VenueRow
                key={venue.name}
                venue={venue}
                onRemove={removeCustomVenue}
                onNoteChange={setVenueNote}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
