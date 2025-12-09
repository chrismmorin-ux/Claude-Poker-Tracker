/**
 * NotesSection.jsx - Notes textarea
 *
 * Part of PlayerForm component decomposition.
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * NotesSection - Notes textarea input
 */
export const NotesSection = ({
  notes,
  setNotes,
}) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Notes (optional)
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Any notes about this player..."
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  );
};

NotesSection.propTypes = {
  notes: PropTypes.string.isRequired,
  setNotes: PropTypes.func.isRequired,
};
