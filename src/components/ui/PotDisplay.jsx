import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * PotDisplay - Shows running pot total on the felt.
 * Tap to manually correct the pot value.
 */
export const PotDisplay = ({ potTotal, isEstimated, onCorrect }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const handleTap = () => {
    setEditValue(String(potTotal));
    setIsEditing(true);
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
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') handleCancel(); }}
          autoFocus
          min="0"
          step="any"
          className="w-20 px-2 py-1 text-sm font-bold text-center bg-gray-900 text-white border border-amber-500 rounded"
        />
        <button type="submit" className="px-2 py-1 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700">OK</button>
        <button type="button" onClick={handleCancel} className="px-2 py-1 bg-gray-600 text-white text-xs font-bold rounded hover:bg-gray-700">X</button>
      </form>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleTap(); }}
      className="absolute left-1/2 transform -translate-x-1/2 px-4 py-1 bg-amber-700 bg-opacity-90 border-2 border-amber-500 rounded-full text-white font-bold text-sm shadow-lg hover:bg-amber-600 transition-colors cursor-pointer"
      style={{ top: '68%' }}
      title="Tap to correct pot"
    >
      {isEstimated ? '~' : ''}${potTotal}
    </button>
  );
};

PotDisplay.propTypes = {
  potTotal: PropTypes.number.isRequired,
  isEstimated: PropTypes.bool.isRequired,
  onCorrect: PropTypes.func.isRequired,
};
