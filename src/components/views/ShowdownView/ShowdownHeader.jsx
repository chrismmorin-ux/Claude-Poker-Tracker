import React from 'react';
import { SkipForward } from 'lucide-react';
import { CardSlot } from '../../ui/CardSlot';

/**
 * ShowdownHeader - Header bar with community cards display and action buttons
 */
export const ShowdownHeader = ({
  communityCards,
  onNextHand,
  onClearCards,
  onDone,
  showdownMode = 'quick',
  onToggleMode,
}) => {
  return (
    <div className="bg-white p-6 flex justify-between items-center">
      <h2 className="text-3xl font-bold">
        {showdownMode === 'quick' ? 'Who won?' : 'Showdown - Click a card slot, then click a card'}
      </h2>
      <div className="flex items-center gap-4">
        {/* Community Cards Display */}
        <div>
          <div className="text-sm font-bold mb-2 text-center">BOARD</div>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((idx) => (
              <CardSlot
                key={idx}
                card={communityCards[idx]}
                variant="selector"
                canInteract={false}
  
              />
            ))}
          </div>
        </div>
        <button
          onClick={onNextHand}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg text-xl font-bold flex items-center gap-2"
        >
          <SkipForward size={24} />
          Next Hand
        </button>
        <button
          onClick={onClearCards}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-xl font-bold"
        >
          Clear Cards
        </button>
        {onToggleMode && (
          <button
            onClick={onToggleMode}
            className="btn-press text-white px-6 py-3 rounded-lg text-xl font-bold"
            style={{ background: showdownMode === 'quick' ? '#7c3aed' : '#6d28d9' }}
          >
            {showdownMode === 'quick' ? 'Assign Cards' : 'Quick Mode'}
          </button>
        )}
        <button
          onClick={onDone}
          className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg text-xl font-bold"
        >
          Done
        </button>
      </div>
    </div>
  );
};

