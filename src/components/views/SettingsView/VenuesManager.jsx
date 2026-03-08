import React, { useState } from 'react';
import { GOLD } from '../../../constants/designTokens';

export const VenuesManager = ({ settings, addCustomVenue, removeCustomVenue }) => {
  const [newVenueName, setNewVenueName] = useState('');
  const [venueError, setVenueError] = useState('');

  const handleAddVenue = () => {
    if (!newVenueName.trim()) {
      setVenueError('Venue name is required');
      return;
    }
    const success = addCustomVenue(newVenueName);
    if (success) {
      setNewVenueName('');
      setVenueError('');
    } else {
      setVenueError('Venue already exists');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h3 className="text-lg font-bold mb-4" style={{ color: GOLD }}>Custom Venues</h3>

      {/* Add new venue */}
      <div className="mb-4">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          Add Custom Venue
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newVenueName}
            onChange={(e) => {
              setNewVenueName(e.target.value);
              setVenueError('');
            }}
            placeholder="Enter venue name"
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleAddVenue}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
          >
            Add
          </button>
        </div>
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
          <div className="flex flex-wrap gap-2">
            {settings.customVenues.map((venue) => (
              <span
                key={venue}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-700 text-gray-200 rounded-full text-sm"
              >
                {venue}
                <button
                  onClick={() => removeCustomVenue(venue)}
                  className="ml-1 text-red-400 hover:text-red-300 font-bold"
                  title="Remove venue"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
