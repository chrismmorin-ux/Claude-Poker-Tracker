import React from 'react';
import PropTypes from 'prop-types';
import { STREETS } from '../../../constants/gameConstants';

/**
 * StreetSelector - Street selection buttons and next street control
 */
export const StreetSelector = ({
  currentStreet,
  onStreetChange,
  onNextStreet,
  onClearStreet,
}) => {
  return (
    <>
      <div className="absolute bottom-8 left-8 flex gap-2">
        {STREETS.map(street => (
          <button
            key={street}
            onClick={() => onStreetChange(street)}
            className={`py-3 px-6 rounded-lg text-xl font-bold capitalize ${
              currentStreet === street
                ? 'bg-yellow-500 text-black shadow-lg'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {street}
          </button>
        ))}
        <button
          onClick={onNextStreet}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-xl"
        >
          Next Street ➡
        </button>
      </div>

      <div className="absolute bottom-8 right-8">
        <button
          onClick={onClearStreet}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold text-lg"
        >
          Clear Street
        </button>
      </div>
    </>
  );
};

StreetSelector.propTypes = {
  currentStreet: PropTypes.string.isRequired,
  onStreetChange: PropTypes.func.isRequired,
  onNextStreet: PropTypes.func.isRequired,
  onClearStreet: PropTypes.func.isRequired,
};
