import React from 'react';
import { SkipForward, ArrowLeft } from 'lucide-react';
import { CardSlot } from '../../ui/CardSlot';

/**
 * ShowdownHeader - Header bar with community cards display and action buttons.
 *
 * AUDIT-2026-04-21-SDV F2: Button layout reworked for destructive-action safety.
 * Done is now left-anchored (non-destructive return-to-table, mirrors Back patterns
 * elsewhere in the app) and separated from Next Hand (destructive commit) by the
 * entire board + mode-toggle row. Next Hand sits at the right edge. Adjacent-target
 * mis-tap risk is eliminated structurally, not just visually.
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
      <div className="flex items-center gap-6">
        {/* Done anchors the non-destructive return path. Back-arrow icon + "Done"
            label reads unambiguously as an exit, not a commit. */}
        <button
          onClick={onDone}
          className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg text-xl font-bold flex items-center gap-2"
        >
          <ArrowLeft size={24} />
          Done
        </button>
        <h2 className="text-3xl font-bold">
          {showdownMode === 'quick' ? 'Who won?' : 'Showdown - Click a card slot, then click a card'}
        </h2>
      </div>
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
        {/* AUDIT-2026-04-21-SDV F3: Clear Cards is a Full-Mode utility. In Quick Mode
            it is a no-op (no cards to clear) — hiding it reduces destructive-action
            surface area for between-hands-chris who stays in Quick Mode. */}
        {showdownMode !== 'quick' && (
          <button
            onClick={onClearCards}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-xl font-bold"
          >
            Clear Cards
          </button>
        )}
        {onToggleMode && (
          <button
            onClick={onToggleMode}
            className="btn-press text-white px-6 py-3 rounded-lg text-xl font-bold"
            style={{ background: showdownMode === 'quick' ? '#7c3aed' : '#6d28d9' }}
          >
            {showdownMode === 'quick' ? 'Assign Cards' : 'Quick Mode'}
          </button>
        )}
        {/* Next Hand is the commit path. AUDIT-2026-04-21-SDV F2: moved to the
            right edge, separated from Done by the BOARD display + mode toggle
            (≥200px physical gap). Pair with F1 toast+undo (shipped S4) for
            defense-in-depth on mis-tap risk. */}
        <button
          onClick={onNextHand}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg text-xl font-bold flex items-center gap-2 ml-4"
          style={{ boxShadow: '0 0 0 3px rgba(202, 138, 4, 0.25)' }}
        >
          <SkipForward size={24} />
          Next Hand
        </button>
      </div>
    </div>
  );
};

