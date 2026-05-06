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
// Phase C (2026-05-05): picker renders portrait-native — no ScaledContainer,
// no fixed 1600×720 frame. See feedback_portrait_mode_player_screens.md.
import NameSearchInput from './NameSearchInput';
import QuickFilterChips from './QuickFilterChips';
import ResultCard from './ResultCard';
import CreateFromQueryCTA from './CreateFromQueryCTA';
import BatchSeatRibbon from './BatchSeatRibbon';

export const PlayerPickerView = ({ scale: _scale = 1 }) => {
  const { pickerContext, closePlayerPicker, openPlayerEditor } = useUI();
  const {
    allPlayers,
    assignPlayerToSeat,
    clearSeatAssignment,
    getPlayerSeat,
    getSeatPlayer,
  } = usePlayer();
  const { currentSession } = useSession();
  const { addToast } = useToast();

  // F10: swap mode. When entered via SeatContextMenu "Swap Player…" on an
  // occupied seat, the top bar labels the action explicitly and the current
  // occupant is known. Semantically equivalent to assign; UX surfaces intent.
  const swapMode = !!pickerContext?.swapMode;

  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  useScreenFocusManagement(rootRef, searchInputRef);

  const initialBatchMode = pickerContext?.batchMode?.active
    ? { active: true, assignedSeats: pickerContext.batchMode.assignedSeats || [] }
    : { active: false, assignedSeats: [] };

  const {
    nameQuery, setNameQuery,
    quickFilter,
    setQuickFilterField,
    toggleQuickFilterEthnicity,
    clearQuickFilter,
    clearAll, hasActiveFilters,
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

    // F6: if the picked player is already assigned to a *different* seat this
    // session, clear the prior seat BEFORE assigning to the new one. Prevents
    // the silent double-assign that existed pre-audit. The toast surfaces the
    // move so the user isn't surprised.
    const priorSeatForPick = getPlayerSeat(player.playerId);
    const movedFromSeat = priorSeatForPick && priorSeatForPick !== currentSeat
      ? priorSeatForPick
      : null;

    if (movedFromSeat) {
      try {
        clearSeatAssignment(movedFromSeat);
      } catch {
        // Non-fatal — proceed with assign. Worst case is a duplicate, which
        // downstream code paths can still reconcile.
      }
    }

    try {
      await assignPlayerToSeat(currentSeat, player.playerId, { sessionId, source: 'picker' });
    } catch (err) {
      addToast(`Could not assign player: ${err.message}`, { variant: 'error' });
      return;
    }

    if (movedFromSeat) {
      addToast(
        `Moved ${player.name} from seat ${movedFromSeat} to seat ${currentSeat}`,
        { variant: 'info', duration: 6000 },
      );
    }

    // Owner-revised 2026-05-05: NO auto retroactive linking. A newly-
    // assigned player only attributes hands going forward — assigning Bob
    // to seat 1 does NOT inherit hands played at seat 1 before the
    // assignment, even within the same session. Past behavior was
    // "Linked N prior hands to Bob" toast; that surprised the owner with
    // phantom hand counts after table-clears + new sessions.

    const { batchDone } = onAssignmentComplete(currentSeat);
    if (batchDone) {
      closePlayerPicker();
    }
  }, [
    currentSeat,
    assignPlayerToSeat,
    clearSeatAssignment,
    getPlayerSeat,
    sessionId,
    onAssignmentComplete,
    closePlayerPicker,
    addToast,
  ]);

  // --- Create a new player pre-filled from query + quick-filter (Phase 4) --
  // Per audit §8.3: Picker becomes the only creation entry point. The
  // "+ Create new" CTA pre-fills the editor with the name AND any quick-
  // filter attributes the user already set (sex / ethnicity / age) — so
  // the user doesn't re-enter what they've already selected. This kills
  // the duplicate-Michael class of bug at the source: the user always
  // searches first, only creates if no match.
  const handleCreateFromQuery = useCallback(() => {
    const fieldSeeds = {};
    // Scalar axes — only seed if filter has a value. Same key on player record.
    const SCALAR_SEED_KEYS = [
      'sex', 'ageDecade', 'skinTone', 'hairColor', 'hairLength', 'hairTexture',
      'facialHair', 'beardColor', 'build', 'eyewear', 'eyewearColor', 'headwear',
    ];
    for (const k of SCALAR_SEED_KEYS) {
      if (quickFilter[k]) fieldSeeds[k] = quickFilter[k];
    }
    // Ethnicity: filter key 'ethnicity' → record key 'ethnicityTags'.
    if (quickFilter.ethnicity.length > 0) fieldSeeds.ethnicityTags = [...quickFilter.ethnicity];

    openPlayerEditor({
      mode: 'create',
      nameSeed: nameQuery,
      fieldSeeds,
      seatContext: currentSeat ? { seat: currentSeat, sessionId } : null,
    });
  }, [openPlayerEditor, nameQuery, quickFilter, currentSeat, sessionId]);

  const handleBack = useCallback(() => {
    closePlayerPicker();
  }, [closePlayerPicker]);

  // F10: swap-mode title. When the user arrived here via "Swap Player…" on
  // an occupied seat, label it so intent is obvious.
  const currentOccupantName = swapMode && currentSeat
    ? (getSeatPlayer(currentSeat)?.name ?? null)
    : null;
  const title = swapMode && currentSeat
    ? (currentOccupantName
        ? `Swap ${currentOccupantName} (seat ${currentSeat})`
        : `Swap Seat ${currentSeat}`)
    : (currentSeat ? `Pick for Seat ${currentSeat}` : 'Pick Player');

  return (
    <div
      ref={rootRef}
      className="bg-gray-100 h-dvh w-full flex flex-col overflow-hidden"
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

      {/* Search + Phase 4 quick-filter chips (sex × ethnicity × age) */}
      <div className="px-3 py-3 bg-white border-b border-gray-200 space-y-2">
        <NameSearchInput
          value={nameQuery}
          onChange={setNameQuery}
          inputRef={searchInputRef}
          autoFocus={true}
        />
        <QuickFilterChips
          quickFilter={quickFilter}
          onSet={setQuickFilterField}
          onEthnicityToggle={toggleQuickFilterEthnicity}
          onClearAll={clearQuickFilter}
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
            {results.map(({ player, score, matchedAccessories }) => {
              // F6: pass the other-seat assignment (if any) so the card can
              // render an "at seat N" badge. Badge is only shown when the
              // player is assigned to a seat *different* from currentSeat —
              // picking from-current-seat is a no-op, not a move.
              const assignedSeat = getPlayerSeat(player.playerId);
              const showSeat = assignedSeat && assignedSeat !== currentSeat
                ? assignedSeat
                : null;
              return (
                <ResultCard
                  key={player.playerId}
                  player={player}
                  score={score}
                  onSelect={handlePickPlayer}
                  hasActiveFilters={hasActiveFilters}
                  assignedToSeat={showSeat}
                  matchedAccessories={matchedAccessories || []}
                />
              );
            })}
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
