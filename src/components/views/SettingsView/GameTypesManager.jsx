import React, { useState } from 'react';
import { GOLD } from '../../../constants/designTokens';

export const GameTypesManager = ({ settings, addCustomGameType, removeCustomGameType }) => {
  const [newGameTypeLabel, setNewGameTypeLabel] = useState('');
  const [newGameTypeBuyIn, setNewGameTypeBuyIn] = useState('');
  const [gameTypeError, setGameTypeError] = useState('');

  const handleAddGameType = () => {
    if (!newGameTypeLabel.trim()) {
      setGameTypeError('Game type name is required');
      return;
    }
    const buyIn = newGameTypeBuyIn ? parseFloat(newGameTypeBuyIn) : 0;
    if (newGameTypeBuyIn && (isNaN(buyIn) || buyIn < 0)) {
      setGameTypeError('Buy-in must be a positive number');
      return;
    }
    const success = addCustomGameType({
      label: newGameTypeLabel.trim(),
      buyInDefault: buyIn,
      rebuyDefault: buyIn,
    });
    if (success) {
      setNewGameTypeLabel('');
      setNewGameTypeBuyIn('');
      setGameTypeError('');
    } else {
      setGameTypeError('Game type already exists');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h3 className="text-lg font-bold mb-4" style={{ color: GOLD }}>Custom Game Types</h3>

      {/* Add new game type */}
      <div className="mb-4">
        <label className="block text-gray-300 text-sm font-medium mb-2">
          Add Custom Game Type
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newGameTypeLabel}
            onChange={(e) => {
              setNewGameTypeLabel(e.target.value);
              setGameTypeError('');
            }}
            placeholder="e.g., 5/10 PLO"
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <div className="relative w-24">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="text"
              value={newGameTypeBuyIn}
              onChange={(e) => {
                setNewGameTypeBuyIn(e.target.value);
                setGameTypeError('');
              }}
              placeholder="Buy-in"
              className="w-full pl-7 pr-2 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleAddGameType}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium"
          >
            Add
          </button>
        </div>
        {gameTypeError && (
          <p className="mt-1 text-red-400 text-sm">{gameTypeError}</p>
        )}
      </div>

      {/* Custom game types list */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-2">
          Your Custom Game Types
        </label>
        {settings.customGameTypes.length === 0 ? (
          <p className="text-gray-500 text-sm italic">No custom game types added yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {settings.customGameTypes.map((gameType) => (
              <span
                key={gameType.label}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-700 text-gray-200 rounded-full text-sm"
              >
                {gameType.label}
                {gameType.buyInDefault > 0 && (
                  <span className="text-gray-400">(${gameType.buyInDefault})</span>
                )}
                <button
                  onClick={() => removeCustomGameType(gameType.label)}
                  className="ml-1 text-red-400 hover:text-red-300 font-bold"
                  title="Remove game type"
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
