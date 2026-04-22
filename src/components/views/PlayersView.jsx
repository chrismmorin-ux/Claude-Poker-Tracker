/**
 * PlayersView.jsx - Player management view
 *
 * Displays all players with search, filter, and CRUD operations.
 * Pattern follows SessionsView.jsx structure.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Users } from 'lucide-react';
import { PlayerFilters } from '../ui/PlayerFilters';
import { PlayerRow } from '../ui/PlayerRow';
import { SeatAssignmentGrid } from '../ui/SeatAssignmentGrid';
import { ScaledContainer } from '../ui/ScaledContainer';
import { LIMITS, LAYOUT } from '../../constants/gameConstants';
import { usePlayerFiltering } from '../../hooks/usePlayerFiltering';
import { useToast } from '../../contexts/ToastContext';
import { usePlayer, useUI, useTendency, useSession } from '../../contexts';
import { RangeDetailPanel } from '../ui/RangeDetailPanel';

const UNDO_TOAST_DURATION_MS = 12000;

/** PlayersView - Player management view. All state via context hooks. */
export const PlayersView = ({ scale = 1 }) => {
  const { showError, showSuccess, addToast } = useToast();
  const {
    setCurrentScreen,
    SCREEN,
    openPlayerEditor,
  } = useUI();
  const {
    allPlayers,
    seatPlayers,
    updatePlayerById,
    deletePlayerById,
    loadAllPlayers,
    assignPlayerToSeat,
    clearSeatAssignment,
    getSeatPlayerName,
    isPlayerAssigned,
    getPlayerSeat,
    clearAllSeatAssignments,
    hydrateSeatPlayers,
  } = usePlayer();
  const { currentSession } = useSession();

  // Build a playerState-like object for compatibility with hooks that expect it
  const playerState = { allPlayers, seatPlayers };

  // Player tendency stats (shared via TendencyProvider)
  const { tendencyMap, patchTendency } = useTendency();

  // Range detail modal
  const [rangeDetailPlayerId, setRangeDetailPlayerId] = useState(null);
  const rangeDetailTendencies = rangeDetailPlayerId ? tendencyMap[rangeDetailPlayerId] : null;
  const rangeDetailProfile = rangeDetailTendencies?.rangeProfile || null;
  const rangeDetailSummary = rangeDetailTendencies?.rangeSummary || null;
  const rangeDetailPlayerName = rangeDetailPlayerId
    ? (playerState.allPlayers.find(p => p.playerId === rangeDetailPlayerId)?.name || 'Unknown')
    : '';

  // Player filtering hook
  const {
    filteredPlayers,
    allStyleTags,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    filterTag,
    setFilterTag,
    filterGender,
    setFilterGender,
    filterBuild,
    setFilterBuild,
    filterEthnicity,
    setFilterEthnicity,
    filterFacialHair,
    setFilterFacialHair,
    filterHat,
    setFilterHat,
    filterSunglasses,
    setFilterSunglasses,
    clearFilters,
  } = usePlayerFiltering(playerState.allPlayers, tendencyMap);

  // UI state (PEO-4: removed showNewPlayerModal, editingPlayer, lastCreatedPlayerId,
  // showPendingAssignmentPrompt — all migrated to PlayerEditorView route.)
  const [deletingPlayer, setDeletingPlayer] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [draggedPlayerId, setDraggedPlayerId] = useState(null);
  const [showReplacePrompt, setShowReplacePrompt] = useState(false);
  const [replacePromptData, setReplacePromptData] = useState(null);

  // Load players on mount
  useEffect(() => {
    loadAllPlayers();
  }, [loadAllPlayers]);

  // PEO-4: open the fullscreen editor. When a seat is pre-selected in the grid,
  // thread it as seatContext so the editor auto-assigns on save.
  const handleOpenCreate = () => {
    const seatContext = selectedSeat
      ? { seat: selectedSeat, sessionId: currentSession?.sessionId ?? null }
      : null;
    openPlayerEditor({ mode: 'create', seatContext });
  };

  const handleOpenEdit = (player) => {
    openPlayerEditor({ mode: 'edit', playerId: player.playerId });
  };

  // Find next empty seat (using LIMITS.NUM_SEATS instead of hardcoded 9)
  const findNextEmptySeat = (startSeat = 1) => {
    for (let i = 0; i < LIMITS.NUM_SEATS; i++) {
      const seat = ((startSeat - 1 + i) % LIMITS.NUM_SEATS) + 1;
      if (!getSeatPlayerName(seat)) {
        return seat;
      }
    }
    return null; // All seats occupied
  };

  const handleSeatClick = (seat) => {
    setSelectedSeat(seat);
  };

  const handlePlayerClick = (playerId) => {
    if (!selectedSeat) return;

    // Check if the selected seat is already occupied
    const currentPlayerInSeat = getSeatPlayerName(selectedSeat);
    if (currentPlayerInSeat) {
      // Seat is occupied, show replace prompt
      setReplacePromptData({ playerId, targetSeat: selectedSeat });
      setShowReplacePrompt(true);
      return;
    }

    // Seat is empty - check if player is already assigned to another seat
    const currentSeat = getPlayerSeat(playerId);
    if (currentSeat && currentSeat !== selectedSeat) {
      // Move player from current seat to new seat
      clearSeatAssignment(currentSeat);
    }

    assignPlayerToSeat(selectedSeat, playerId);

    // Auto-advance to next empty seat
    const nextSeat = findNextEmptySeat(selectedSeat + 1);
    if (nextSeat) {
      setSelectedSeat(nextSeat);
    } else {
      setSelectedSeat(null); // All seats filled
    }
  };

  const handleDragStart = (playerId) => {
    setDraggedPlayerId(playerId);
  };

  const handleDragEnd = () => {
    setDraggedPlayerId(null);
  };

  const handleDrop = (seat) => {
    if (!draggedPlayerId) return;

    const currentPlayerInSeat = getSeatPlayerName(seat);

    if (currentPlayerInSeat) {
      // Seat is occupied, show replace prompt
      setReplacePromptData({ playerId: draggedPlayerId, targetSeat: seat });
      setShowReplacePrompt(true);
    } else {
      // Seat is empty, assign directly
      const currentSeat = getPlayerSeat(draggedPlayerId);
      if (currentSeat) {
        clearSeatAssignment(currentSeat);
      }
      assignPlayerToSeat(seat, draggedPlayerId);
    }

    setDraggedPlayerId(null);
  };

  const handleSeatDragStart = (seat) => {
    const playerId = playerState.seatPlayers[seat];
    if (playerId) {
      setDraggedPlayerId(playerId);
    }
  };

  const handleSeatDragEnd = () => {
    setDraggedPlayerId(null);
  };

  const handleConfirmReplace = () => {
    if (replacePromptData) {
      const { playerId, targetSeat } = replacePromptData;
      const currentSeat = getPlayerSeat(playerId);

      // Clear old assignment
      if (currentSeat) {
        clearSeatAssignment(currentSeat);
      }

      // Clear target seat and assign new player
      clearSeatAssignment(targetSeat);
      assignPlayerToSeat(targetSeat, playerId);

      setShowReplacePrompt(false);
      setReplacePromptData(null);
    }
  };

  const handleCancelReplace = () => {
    setShowReplacePrompt(false);
    setReplacePromptData(null);
  };

  // F1: Clear All Seats with toast+undo (replaces native confirm per Wave-1 TV-F1 pattern).
  const handleClearAllSeats = () => {
    const snapshot = { ...playerState.seatPlayers };
    if (Object.keys(snapshot).length === 0) return; // nothing to clear
    clearAllSeatAssignments();
    setSelectedSeat(null);
    addToast(`All ${Object.keys(snapshot).length} seat assignment${Object.keys(snapshot).length === 1 ? '' : 's'} cleared`, {
      variant: 'warning',
      duration: UNDO_TOAST_DURATION_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          hydrateSeatPlayers(snapshot);
          showSuccess('Seat assignments restored');
        },
      },
    });
  };

  // F3: Per-seat Clear with toast+undo.
  const handleClearSeat = (seat) => {
    const playerId = playerState.seatPlayers[seat];
    if (!playerId) return;
    const playerName = getSeatPlayerName(seat) || 'Player';
    clearSeatAssignment(seat);
    if (selectedSeat === seat) setSelectedSeat(seat); // keep selection pointer stable
    addToast(`${playerName} cleared from seat ${seat}`, {
      variant: 'warning',
      duration: UNDO_TOAST_DURATION_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          assignPlayerToSeat(seat, playerId);
          showSuccess(`${playerName} restored to seat ${seat}`);
        },
      },
    });
  };

  const handleUpdateExploits = async (playerId, exploits) => {
    try {
      await updatePlayerById(playerId, { exploits });
    } catch (error) {
      showError(`Failed to update exploits: ${error.message}`);
    }
  };

  const handleDismissSuggestion = async (playerId, suggestionId) => {
    try {
      const player = playerState.allPlayers.find(p => p.playerId === playerId);
      const dismissed = player?.dismissedSuggestions || [];
      if (!dismissed.includes(suggestionId)) {
        await updatePlayerById(playerId, {
          dismissedSuggestions: [...dismissed, suggestionId]
        });
      }
    } catch (error) {
      showError(`Failed to dismiss suggestion: ${error.message}`);
    }
  };

  // Briefing review actions
  const handleAcceptBriefing = async (playerId, briefingId) => {
    try {
      const tendency = tendencyMap[playerId];
      const briefings = (tendency?.briefings || []).map(b =>
        b.briefingId === briefingId
          ? { ...b, reviewStatus: 'accepted', reviewedAt: Date.now() }
          : b
      );
      await updatePlayerById(playerId, { exploitBriefings: briefings });
      patchTendency(playerId, { briefings });
    } catch (error) {
      showError(`Failed to accept briefing: ${error.message}`);
    }
  };

  const handleDismissBriefing = async (playerId, briefingId) => {
    try {
      const tendency = tendencyMap[playerId];
      const currentBriefings = tendency?.briefings || [];
      const briefings = currentBriefings.map(b =>
        b.briefingId === briefingId
          ? { ...b, reviewStatus: 'dismissed', reviewedAt: Date.now() }
          : b
      );
      // Also add ruleId to dismissed list to prevent regeneration
      const targetBriefing = currentBriefings.find(b => b.briefingId === briefingId);
      const player = playerState.allPlayers.find(p => p.playerId === playerId);
      const dismissedBriefingIds = [...(player?.dismissedBriefingIds || [])];
      if (targetBriefing?.ruleId && !dismissedBriefingIds.includes(targetBriefing.ruleId)) {
        dismissedBriefingIds.push(targetBriefing.ruleId);
      }
      await updatePlayerById(playerId, { exploitBriefings: briefings, dismissedBriefingIds });
      patchTendency(playerId, { briefings });
    } catch (error) {
      showError(`Failed to dismiss briefing: ${error.message}`);
    }
  };

  const handleDeferBriefing = async (playerId, briefingId) => {
    try {
      const tendency = tendencyMap[playerId];
      const briefings = (tendency?.briefings || []).map(b =>
        b.briefingId === briefingId
          ? { ...b, reviewStatus: 'deferred' }
          : b
      );
      await updatePlayerById(playerId, { exploitBriefings: briefings });
      patchTendency(playerId, { briefings });
    } catch (error) {
      showError(`Failed to defer briefing: ${error.message}`);
    }
  };

  const handleDeletePlayer = async () => {
    try {
      await deletePlayerById(deletingPlayer.playerId);
      setDeletingPlayer(null);
      showSuccess('Player deleted');
    } catch (error) {
      showError(`Failed to delete player: ${error.message}`);
    }
  };

  return (
    <ScaledContainer scale={scale}>
    <div className="bg-gray-900 overflow-auto" style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}>
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentScreen(SCREEN.TABLE)}
              className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg font-medium transition-colors"
            >
              <ChevronLeft size={18} />
              Table View
            </button>
            <h1 className="text-2xl font-bold text-white">Player Management</h1>
          </div>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors font-medium"
          >
            + New Player
          </button>
        </div>

        {/* Search, Sort, and Filters */}
        <PlayerFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sortBy={sortBy}
          setSortBy={setSortBy}
          filterGender={filterGender}
          setFilterGender={setFilterGender}
          filterBuild={filterBuild}
          setFilterBuild={setFilterBuild}
          filterEthnicity={filterEthnicity}
          setFilterEthnicity={setFilterEthnicity}
          filterFacialHair={filterFacialHair}
          setFilterFacialHair={setFilterFacialHair}
          filterHat={filterHat}
          setFilterHat={setFilterHat}
          filterSunglasses={filterSunglasses}
          setFilterSunglasses={setFilterSunglasses}
          filterTag={filterTag}
          setFilterTag={setFilterTag}
          allStyleTags={allStyleTags}
        />

        {/* Stats */}
        <div className="mt-3 text-sm text-gray-400">
          Showing {filteredPlayers.length} of {playerState.allPlayers.length} players
        </div>
      </div>

      {/* Seat Management Section */}
      <SeatAssignmentGrid
        selectedSeat={selectedSeat}
        getSeatPlayerName={getSeatPlayerName}
        onSeatClick={handleSeatClick}
        onClearSeat={handleClearSeat}
        onClearAllSeats={handleClearAllSeats}
        onSeatDragStart={handleSeatDragStart}
        onSeatDragEnd={handleSeatDragEnd}
        onDrop={handleDrop}
      />

      {/* Player List */}
      <div className="p-4">
        {filteredPlayers.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center">
            <Users size={48} className="text-gray-600 mb-3" />
            <div className="text-xl font-semibold text-gray-400">
              {playerState.allPlayers.length === 0 ? 'No Players Yet' : 'No Matches'}
            </div>
            <div className="text-sm text-gray-500">
              {playerState.allPlayers.length === 0
                ? 'Click "New Player" to create one'
                : 'No players match your search criteria'}
            </div>
          </div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Style</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Hands</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Last Seen</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredPlayers.map(player => (
                  <PlayerRow
                    key={player.playerId}
                    player={player}
                    assignedSeat={getPlayerSeat(player.playerId)}
                    isSelecting={!!selectedSeat}
                    onDragStart={() => handleDragStart(player.playerId)}
                    onDragEnd={handleDragEnd}
                    onClick={() => selectedSeat && handlePlayerClick(player.playerId)}
                    onEdit={() => handleOpenEdit(player)}
                    onDelete={() => setDeletingPlayer(player)}
                    tendencyStats={tendencyMap[player.playerId] || null}
                    onUpdateExploits={(exploits) => handleUpdateExploits(player.playerId, exploits)}
                    onDismissSuggestion={(suggestionId) => handleDismissSuggestion(player.playerId, suggestionId)}
                    onOpenRangeDetail={setRangeDetailPlayerId}
                    onAcceptBriefing={handleAcceptBriefing}
                    onDismissBriefing={handleDismissBriefing}
                    onDeferBriefing={handleDeferBriefing}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deletingPlayer && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setDeletingPlayer(null)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 w-[90vw] max-w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-4">Delete Player</h2>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <strong>{deletingPlayer.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingPlayer(null)}
                className="px-4 py-2 text-gray-200 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePlayer}
                className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Range Detail Modal */}
      <RangeDetailPanel
        rangeProfile={rangeDetailProfile}
        rangeSummary={rangeDetailSummary}
        playerName={rangeDetailPlayerName}
        onClose={() => setRangeDetailPlayerId(null)}
        isOpen={rangeDetailPlayerId !== null}
      />

      {/* Replace Prompt */}
      {showReplacePrompt && replacePromptData && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={handleCancelReplace}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 w-[90vw] max-w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-4">Replace Player?</h2>
            <p className="text-gray-300 mb-6">
              Seat {replacePromptData.targetSeat} is already occupied by{' '}
              <strong>{getSeatPlayerName(replacePromptData.targetSeat)}</strong>.
              Replace them with the dragged player?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelReplace}
                className="px-4 py-2 text-gray-200 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReplace}
                className="px-4 py-2 text-white bg-orange-600 rounded hover:bg-orange-700 transition-colors font-medium"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ScaledContainer>
  );
};
