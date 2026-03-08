import React from 'react';
import PropTypes from 'prop-types';

/**
 * BatchActionBar - "Rest Fold" and "Check Around" batch action buttons
 * Positioned near the street selector area
 */
export const BatchActionBar = ({
  remainingCount,
  canCheckAround,
  currentStreet,
  onRestFold,
  onCheckAround,
}) => {
  if (currentStreet === 'showdown' || remainingCount === 0) return null;

  return (
    <div className="absolute bottom-20 right-8 flex gap-2">
      <button
        onClick={onRestFold}
        className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg font-bold text-base"
      >
        Rest Fold ({remainingCount})
      </button>
      {canCheckAround && (
        <button
          onClick={onCheckAround}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-base"
        >
          Check Around ({remainingCount})
        </button>
      )}
    </div>
  );
};

BatchActionBar.propTypes = {
  remainingCount: PropTypes.number.isRequired,
  canCheckAround: PropTypes.bool.isRequired,
  currentStreet: PropTypes.string.isRequired,
  onRestFold: PropTypes.func.isRequired,
  onCheckAround: PropTypes.func.isRequired,
};
