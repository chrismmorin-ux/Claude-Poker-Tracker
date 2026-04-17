/**
 * PlayerPickerView.jsx — Fullscreen player picker (PEO-3)
 *
 * Launched from a seat: top bar shows "Pick for Seat N" and a back button;
 * name search autofocuses; inline filter chips narrow the list; result cards
 * surface recognition-first (avatar + matched-feature highlights).
 *
 * On pick: assigns player to seat, fires retroactive link + undo toast,
 * advances batch mode if active. On tap of the sticky "+ Create new" CTA:
 * opens PlayerEditorView with nameSeed + seatContext.
 */

import React, { useRef, useCallback } from 'react';
import { ChevronLeft, Users } from 'lucide-react';
import { useUI } from '../../../contexts/UIContext';
import { usePlayer } from '../../../contexts/PlayerContext';
import { useSession } from '../../../contexts/SessionContext';
import { useToast } from '../../../contexts/ToastContext';
import { usePlayerPicker } from '../../../hooks/usePlayerPicker';
import { useScreenFocusManagement } from '../../../hooks/useScreenFocusManagement';
import NameSearchInput from './NameSearchInput';
import FilterChips from './FilterChips';
import ResultCard from './ResultCard';
import CreateFromQueryCTA from './CreateFromQueryCTA';
import BatchSeatRibbon from './BatchSeatRibbon';

export const PlayerPickerView = ({ scale = 1 }) => {
  const { pickerContext, closePlayerPicker, openPlayerEditor } = useUI();
  const {
    allPlayers,
    assignPlayerToSeat,
    linkPlayerToPriorHandsInSession,
    undoRetroactiveLink,
  } = usePlayer();
  const { currentSession } = useSession();
  const { addToast } = useToast();

  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  useScreenFocusManagement(rootRef, searchInputRef);

  const initialBatchMode = pickerContext?.batchMode?.active
    ? { active: true, assignedSeats: pickerContext.batchMode.assignedSeats || [] }
    : { active: false, assignedSeats: [] };

  const {
    nameQuery, setNameQuery,
    featureFilters, setFeatureFilter, clearAll, hasActiveFilters,
    results,
    currentSeat, setCurrentSeat,
    batchMode, enterBatchMode, exitBatchMode, onAssignmentComplete,
  } = usePlayerPicker({
    allPlayers,
    initialSeat: pickerContext?.seat ?? null,
    initialBatchMode,
  });

  const sessionId = currentSession?.sessionId ?? null;

  // --- Pick existing player -------------------------------------------
  const handlePickPlayer = useCallback(async (player) => {
    if (!currentSeat || !player?.playerId) {
      closePlayerPicker();
      return;
    }
    try {
      await assignPlayerToSeat(currentSeat, player.playerId);
    } catch (err) {
      addToast(`Could not assign player: ${err.message}`, { variant: 'error' });
      return;
    }

    if (sessionId) {
      try {
        const linkResult = await linkPlayerToPriorHandsInSession(
          currentSeat, player.playerId, sessionId,
        );
        if (linkResult?.handIds?.length > 0) {
          addToast(
            `Linked ${linkResult.handIds.length} prior hand${linkResult.handIds.length === 1 ? '' : 's'} to ${player.name}`,
            {
              variant: 'success',
              duration: 8000,
              action: { label: 'Undo', onClick: () => undoRetroactiveLink(linkResult) },
            },
          );
        }
      } catch (err) {
        addToast(`Could not backfill prior hands: ${err.message}`, { variant: 'warning' });
      }
    }

    const { batchDone } = onAssignmentComplete(currentSeat);
    if (batchDone) {
      closePlayerPicker();
    }
  }, [
    currentSeat,
    assignPlayerToSeat,
    linkPlayerToPriorHandsInSession,
    undoRetroactiveLink,
    sessionId,
    onAssignmentComplete,
    closePlayerPicker,
    addToast,
  ]);

  // --- Create a new player pre-filled from the query --------------------
  const handleCreateFromQuery = useCallback(() => {
    openPlayerEditor({
      mode: 'create',
      nameSeed: nameQuery,
      seatContext: currentSeat ? { seat: currentSeat, sessionId } : null,
    });
  }, [openPlayerEditor, nameQuery, currentSeat, sessionId]);

  const handleBack = useCallback(() => {
    closePlayerPicker();
  }, [closePlayerPicker]);

  const title = currentSeat ? `Pick for Seat ${currentSeat}` : 'Pick Player';

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-gray-100 flex flex-col"
      style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
      data-testid="player-picker-view"
    >
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between bg-gray-900 text-white px-3 py-3 border-b border-gray-700">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 text-sm font-medium hover:bg-gray-800 px-2 py-1 rounded"
          data-testid="picker-back-btn"
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <h2 className="text-sm font-semibold truncate mx-2">{title}</h2>
        {batchMode.active ? (
          <span className="text-xs text-amber-300 shrink-0">{batchMode.assignedSeats.length}/9</span>
        ) : (
          <button
            type="button"
            onClick={enterBatchMode}
            className="flex items-center gap-1 text-xs hover:bg-gray-800 px-2 py-1 rounded"
            data-testid="enter-batch-btn"
          >
            <Users size={14} />
            Batch
          </button>
        )}
      </div>

      {batchMode.active ? (
        <BatchSeatRibbon
          currentSeat={currentSeat}
          assignedSeats={batchMode.assignedSeats}
          onExit={exitBatchMode}
        />
      ) : null}

      {/* Search + filters */}
      <div className="px-3 py-3 bg-white border-b border-gray-200 space-y-2">
        <NameSearchInput
          value={nameQuery}
          onChange={setNameQuery}
          inputRef={searchInputRef}
          autoFocus={true}
        />
        <FilterChips
          featureFilters={featureFilters}
          onFilterChange={setFeatureFilter}
          onClearAll={clearAll}
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto px-3 py-3" data-testid="picker-results-scroll">
        {results.length === 0 ? (
          <div
            className="text-center text-gray-500 text-sm py-10"
            data-testid="picker-no-results"
          >
            {hasActiveFilters
              ? 'No players match. Try clearing some filters, or create a new player below.'
              : 'No saved players yet. Create one below.'}
          </div>
        ) : (
          <div className="space-y-2">
            {results.map(({ player, score }) => (
              <ResultCard
                key={player.playerId}
                player={player}
                score={score}
                onSelect={handlePickPlayer}
                hasActiveFilters={hasActiveFilters}
              />
            ))}
          </div>
        )}
      </div>

      <CreateFromQueryCTA
        nameQuery={nameQuery}
        onClick={handleCreateFromQuery}
      />
    </div>
  );
};

export default PlayerPickerView;
