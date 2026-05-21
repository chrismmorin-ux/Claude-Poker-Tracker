/**
 * @file PlayerFinderView — unified find / edit / create player surface.
 *
 * Replaces `PlayerEditorView` + `PlayerPickerView`. One screen, one state
 * machine (`usePlayerFinder`), one identification-field component
 * (`IdentificationFields`). Pre-Phase-B these were two different surfaces;
 * the audit at `.claude/plans/floating-questing-conway.md` specified
 * collapsing them per `feedback_picker_editor_field_parity.md`.
 *
 * Flow at the table: tap seat → "Find or Add Player" → finder opens with
 * the seat pre-bound. User filters by visible features; results narrow.
 * Tap a result → congruency panel renders any per-axis differences →
 * user picks per axis → assign. If no result matches: tap "Save & assign
 * as NEW player" to create + assign + persist accessory in one flow.
 *
 * Modes (driven by `finderContext`):
 *   - mode='find'   (default for seat tap): assignment is the goal.
 *                   Assigning an existing player updates the seat. Creating
 *                   a new player saves + assigns + records the first
 *                   sighting.
 *   - mode='edit'   (PlayerProfileView edit button): no seat assignment;
 *                   just persist updates to the loaded player record.
 *   - mode='create' (PlayersView "+ New" button): no seat assignment;
 *                   the user is browsing the picker as an admin and the
 *                   finder doubles as an entry point for adding players.
 *   - swapMode      : when arriving via SeatContextMenu "Swap Player…"
 *                     on an occupied seat, the title labels the swap.
 *
 * Phase B (parallel rollout): reachable via `SCREEN.PLAYER_FINDER` +
 * the `#player-finder` hash route. Phase C will rewire all caller sites
 * to land here directly; Phase D deletes the legacy editor + picker dirs.
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { ChevronLeft, X, AlertTriangle, Plus, Check, Camera } from 'lucide-react';
import { useUI } from '../../../contexts/UIContext';
import { usePlayer } from '../../../contexts/PlayerContext';
import { useSession } from '../../../contexts/SessionContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  usePlayerFinder,
  FIELD_LABEL,
  formatValue,
} from '../../../hooks/usePlayerFinder';
import {
  commitDraft,
  updatePlayer,
  appendSighting,
  GUEST_USER_ID,
} from '../../../utils/persistence';
import { migratePlayerLegacyFields } from '../../../utils/identityAvatar/migratePlayerLegacyFields';
import { upsertAccessory } from '../../../utils/accessoryInventory';
import { deriveAutoName } from '../../../utils/playerAutoName';
import IdentityAvatar from '../../ui/IdentityAvatar';
import { Chip } from '../../ui/Chip';
import { Card } from '../../ui/Card';
import { CameraCaptureModal } from '../PlayerEditorView/CameraCaptureModal';
import { IdentificationFields } from './IdentificationFields';

// ===========================================================================
// HELPERS — projections between filter shape and player record shape
// ===========================================================================

/**
 * Project an existing player record into the filter-shape values our chip
 * rows operate on. Edit + view-existing flows hydrate the finder via this.
 * Runs `migratePlayerLegacyFields` first so unmigrated records still read
 * with their derived modern values.
 */
const projectPlayerToFilters = (rawPlayer) => {
  if (!rawPlayer) return null;
  const p = migratePlayerLegacyFields(rawPlayer);
  // Single-select ethnicity from the array shape (length 0 or 1).
  const ethnicity = Array.isArray(p.ethnicityTags) && p.ethnicityTags.length > 0
    ? p.ethnicityTags[0]
    : null;
  // Hair / beard treatment derived from legacy salt-pepper booleans.
  const hairTreatment = p.hairSaltPepper === true ? 'salt-pepper' : (p.hairTreatment || null);
  const beardTreatment = p.beardSaltPepper === true ? 'salt-pepper' : (p.beardTreatment || null);
  return {
    sex: p.sex || null,
    ageDecade: p.ageDecade || null,
    ethnicity,
    ethnicityNote: p.ethnicityNote || '',
    build: p.build || null,
    height: p.height || null,
    skinTone: p.skinTone || null,
    hairColor: p.hairColor || null,
    hairLength: p.hairLength || null,
    hairTexture: p.hairTexture || null,
    hairTreatment,
    facialHair: p.facialHair || null,
    beardColor: p.beardColor || null,
    beardTreatment,
    // Accessory slot stays empty in edit hydration — the inventory panel
    // shows accumulated accessories elsewhere; this slot is for the
    // currently-being-added accessory. Clean slate on hydrate.
    accessory: { kind: null, subtype: null, color: null, note: '' },
  };
};

/**
 * Build the patch object that gets merged onto an existing player record
 * (edit-save) OR used as the initial payload for a new player (create).
 *
 * Caller applies a `keepExistingFor` set so per-axis decisions can preserve
 * the player's existing value when the user picked "Keep:" on a mismatch
 * row. By default every set filter axis writes through.
 *
 * Returns a partial player record in canonical shape (Phase 3+ fields).
 */
const buildPlayerPatchFromFilters = (filters, { keepExistingFor = new Set() } = {}) => {
  const patch = {};
  const setIfNotKept = (key, value) => {
    if (keepExistingFor.has(key)) return;
    patch[key] = value;
  };
  if (filters.sex) setIfNotKept('sex', filters.sex);
  if (filters.ageDecade) setIfNotKept('ageDecade', filters.ageDecade);
  if (filters.ethnicity) setIfNotKept('ethnicityTags', [filters.ethnicity]);
  if (filters.ethnicityNote && filters.ethnicityNote.trim()) {
    setIfNotKept('ethnicityNote', filters.ethnicityNote.trim());
  }
  if (filters.build) setIfNotKept('build', filters.build);
  if (filters.height) setIfNotKept('height', filters.height);
  if (filters.skinTone) setIfNotKept('skinTone', filters.skinTone);
  if (filters.hairColor) setIfNotKept('hairColor', filters.hairColor);
  if (filters.hairLength) setIfNotKept('hairLength', filters.hairLength);
  if (filters.hairTexture) setIfNotKept('hairTexture', filters.hairTexture);
  if (filters.hairTreatment) {
    setIfNotKept('hairTreatment', filters.hairTreatment);
    // Back-compat: maintain hairSaltPepper boolean for AvatarRenderer paths
    // that still read it. Migration shim drops this in time.
    if (filters.hairTreatment === 'salt-pepper') {
      setIfNotKept('hairSaltPepper', true);
    }
  }
  if (filters.facialHair) setIfNotKept('facialHair', filters.facialHair);
  if (filters.beardColor) setIfNotKept('beardColor', filters.beardColor);
  if (filters.beardTreatment) {
    setIfNotKept('beardTreatment', filters.beardTreatment);
    if (filters.beardTreatment === 'salt-pepper') {
      setIfNotKept('beardSaltPepper', true);
    }
  }
  return patch;
};

// ===========================================================================
// SUB-COMPONENTS — congruency panel + result row (kept local to view)
// ===========================================================================

const DecisionBadge = ({ kind }) => {
  const isAddition = kind === 'addition';
  const palette = isAddition
    ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
    : 'text-amber-300 bg-amber-500/10 border-amber-500/30';
  return (
    <span className={`text-[9px] font-bold rounded px-2 py-0.5 border ${palette}`}>
      {isAddition ? '+ NEW' : 'DIFF'}
    </span>
  );
};

const DecisionRow = ({ item, decision, onPick }) => {
  const left = item.kind === 'mismatch'
    ? { id: 'filter', label: `Filter: ${formatValue(item.axis, item.filterValue)}` }
    : { id: 'add',    label: `Add: ${formatValue(item.axis, item.filterValue)}` };
  const right = item.kind === 'mismatch'
    ? { id: 'player', label: `Keep: ${formatValue(item.axis, item.playerValue)}` }
    : { id: 'skip',   label: 'Skip' };
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">
          {FIELD_LABEL[item.axis] || item.axis}
        </span>
        <DecisionBadge kind={item.kind} />
      </div>
      <div className="flex gap-2">
        <Chip shape="square" size="sm" active={decision === left.id} label={left.label} onClick={() => onPick(left.id)} />
        <Chip shape="square" size="sm" active={decision === right.id} label={right.label} onClick={() => onPick(right.id)} />
      </div>
    </div>
  );
};

const CongruencyPanel = ({
  player, items, decisions, onDecide, onCancel, onAssign, seat, mode,
}) => {
  const allMatch = items.length === 0;
  const applyCount = items.reduce((n, item) => {
    const d = decisions[`${item.axis}-${item.kind}`];
    return n + ((d === 'filter' || d === 'add') ? 1 : 0);
  }, 0);
  const assignVerb = mode === 'edit' ? 'Save' : `Assign ${player.name || 'player'} → Seat ${seat}`;
  return (
    <Card className="border-amber-500/50">
      <div className="flex items-center gap-2 mb-3">
        {allMatch ? (
          <>
            <Check size={16} className="text-emerald-300 shrink-0" />
            <span className="text-sm font-semibold text-emerald-300">
              {mode === 'edit' ? 'No changes from filter values' : 'Player matches all filters'}
            </span>
          </>
        ) : (
          <>
            <AlertTriangle size={16} className="text-amber-300 shrink-0" />
            <span className="text-sm font-semibold text-amber-300">
              {items.length} difference{items.length === 1 ? '' : 's'} — pick per axis
            </span>
          </>
        )}
      </div>
      {!allMatch ? (
        <div className="mb-3">
          {items.map((item) => {
            const key = `${item.axis}-${item.kind}`;
            return (
              <DecisionRow
                key={key}
                item={item}
                decision={decisions[key]}
                onPick={(side) => onDecide(key, side)}
              />
            );
          })}
        </div>
      ) : null}
      <div className={`grid ${allMatch ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
        {!allMatch ? (
          <button
            type="button"
            onClick={onCancel}
            className="bg-slate-700 hover:bg-slate-600 text-gray-200 text-sm font-semibold rounded-md min-h-[44px] px-3"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onAssign(applyCount)}
          className="bg-amber-500 hover:bg-amber-400 text-gray-900 text-sm font-semibold rounded-md min-h-[44px] px-3 shadow-sm"
          data-testid="finder-assign-btn"
        >
          {allMatch ? assignVerb : `${mode === 'edit' ? 'Save' : 'Assign'} · apply ${applyCount}`}
        </button>
      </div>
    </Card>
  );
};

const ResultRow = ({ player, onTap, matchedAccessories, isLoaded }) => {
  const head = player.name || <span className="italic text-gray-500">(unnamed)</span>;
  const subtitle = [
    player.sex,
    player.ageDecade,
    player.height,
    (player.ethnicityTags || []).slice(0, 1).join(' · '),
  ].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={() => onTap(player)}
      className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors min-h-[64px] ${
        isLoaded
          ? 'bg-amber-500/10 border-2 border-amber-500'
          : 'bg-slate-800 border border-slate-700 hover:bg-slate-700/60'
      }`}
      data-testid={`finder-result-${player.playerId}`}
    >
      <div className="shrink-0 rounded-full overflow-hidden bg-slate-900 border border-slate-600">
        <IdentityAvatar player={player} size={48} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-100 truncate">
          {head}
          {player.nickname ? <span className="ml-2 text-gray-400 text-xs">"{player.nickname}"</span> : null}
        </div>
        <div className="text-[11px] text-gray-300 capitalize truncate">{subtitle}</div>
        {matchedAccessories.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {matchedAccessories.map((acc) => {
              const headline = [acc.color, acc.subtype].filter(Boolean).join(' ') || acc.kind;
              return (
                <span
                  key={acc.accessoryId}
                  className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300"
                >
                  {headline}
                  {acc.note ? <span className="ml-1 italic">({acc.note})</span> : null}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 text-right text-[11px] text-gray-500 leading-tight">
        <div>{player.handCount || 0} hands</div>
      </div>
    </button>
  );
};

// ===========================================================================
// MAIN VIEW
// ===========================================================================

export const PlayerFinderView = ({ scale: _scale = 1 }) => {
  const { finderContext, closePlayerFinder } = useUI();
  const {
    allPlayers,
    assignPlayerToSeat,
    clearSeatAssignment,
    getPlayerSeat,
    getSeatPlayer,
    loadAllPlayers,
  } = usePlayer();
  const { currentSession } = useSession();
  const { addToast } = useToast();

  const mode = finderContext?.mode || 'find';
  const seat = finderContext?.seat ?? null;
  const swapMode = !!finderContext?.swapMode;
  const initialPlayerId = finderContext?.playerId ?? null;
  const sessionId = currentSession?.sessionId ?? null;

  // Edit-mode hydration: load the player record into filter shape.
  const initialRecord = useMemo(() => {
    if (mode !== 'edit' || initialPlayerId == null) return null;
    return allPlayers.find((p) => p.playerId === initialPlayerId) || null;
  }, [mode, initialPlayerId, allPlayers]);

  const initialFilters = useMemo(() => {
    if (mode === 'edit' && initialRecord) {
      return projectPlayerToFilters(initialRecord);
    }
    if (finderContext?.fieldSeeds) {
      // Picker forwarding semantics — seed scalar filter values from a
      // prior surface's quick-filter so user doesn't re-enter what they
      // already selected. Same shape as filters for compatible keys.
      return finderContext.fieldSeeds;
    }
    return null;
  }, [mode, initialRecord, finderContext]);

  const finder = usePlayerFinder({
    allPlayers,
    initialFilters,
    initialActiveRecord: initialRecord,
  });

  const {
    filters, nameQuery, setNameQuery,
    activeTab, setActiveTab, tabBadges, totalActiveCount,
    activeRecord, decisions, congruencyItems, livePlayer,
    setScalar, setEthnicity, setEthnicityNote, setAccessory, clearAll,
    loadRecord, cancelLoaded, decideAxis,
    results, hasActiveFilters,
    cameraOpen, openCamera, closeCamera,
    capturedPreviewUrl, setCapturedPreviewUrl,
  } = finder;

  // ---- Title --------------------------------------------------------------
  const title = useMemo(() => {
    if (mode === 'edit') return activeRecord?.name ? `Edit ${activeRecord.name}` : 'Edit Player';
    if (mode === 'create') return 'New Player';
    if (swapMode && seat) {
      const occupant = getSeatPlayer(seat);
      return occupant?.name
        ? `Swap ${occupant.name} (seat ${seat})`
        : `Swap Seat ${seat}`;
    }
    return seat ? `Pick for Seat ${seat}` : 'Pick Player';
  }, [mode, swapMode, seat, activeRecord, getSeatPlayer]);

  // ---- Builder header status text ----------------------------------------
  const builderStatus = activeRecord
    ? { line1: mode === 'edit' ? 'Editing' : 'Viewing', line2: activeRecord.name || '(unnamed player)' }
    : totalActiveCount === 0
      ? { line1: mode === 'create' ? 'Creating' : 'Building', line2: 'pick features below' }
      : { line1: mode === 'create' ? 'Creating' : 'Building', line2: `${totalActiveCount} feature${totalActiveCount === 1 ? '' : 's'} set` };

  // ---- Save / assign -----------------------------------------------------

  // Common: the set of axis keys the user marked "keep player's value" on a
  // mismatch row. Translate decision keys ('axis-mismatch', 'axis-addition')
  // to the patch's keepExistingFor set.
  const keepExistingFor = useMemo(() => {
    const set = new Set();
    for (const item of congruencyItems) {
      if (item.kind !== 'mismatch') continue;
      const d = decisions[`${item.axis}-${item.kind}`];
      if (d === 'player') {
        // Keep the player's value — translate axis name to record-shape key
        // for the patch builder.
        if (item.axis === 'ethnicity') set.add('ethnicityTags');
        else set.add(item.axis);
      }
    }
    return set;
  }, [congruencyItems, decisions]);

  // Records the first sighting after assign — captures attribute snapshot +
  // any accessory the user dialed in. Per AP-PIO-02 source-util-policy this
  // is one of the four read-allowed callers of sightingLogsStore.
  const recordFirstSighting = useCallback(async (playerId, snapshot) => {
    if (!playerId || !sessionId) return;
    try {
      const featuresSeen = [];
      if (filters.accessory.kind) {
        featuresSeen.push({
          kind: filters.accessory.kind,
          subtype: filters.accessory.subtype || null,
          color: filters.accessory.color || null,
          note: (filters.accessory.note || '').trim() || null,
        });
      }
      await appendSighting({
        playerId,
        sessionId,
        capturedAt: Date.now(),
        venueId: currentSession?.venueId ?? null,
        featuresSeen,
        attributes: snapshot,
      });
    } catch (err) {
      // Non-fatal — the assign already succeeded; sighting is best-effort.
      addToast(`Sighting log skipped: ${err.message}`, { variant: 'warning' });
    }
  }, [sessionId, filters.accessory, currentSession?.venueId, addToast]);

  // Apply the user's chosen accessory to a player's inventory and return
  // the new inventory array. No-op if no accessory filter is set or if the
  // user picked "skip" on the accessory addition row.
  const buildAccessoryInventory = useCallback((existingInventory) => {
    const acc = filters.accessory;
    const accAdditionDecision = decisions['accessory-addition'];
    const shouldAdd = !!(acc.kind || acc.subtype || acc.color || (acc.note && acc.note.trim()))
      && accAdditionDecision !== 'skip';
    if (!shouldAdd) return existingInventory || [];
    return upsertAccessory(existingInventory || [], {
      kind: acc.kind || 'other',
      subtype: acc.subtype || null,
      color: acc.color || null,
      note: (acc.note || '').trim() || null,
    });
  }, [filters.accessory, decisions]);

  // EDIT or ASSIGN-EXISTING path.
  const handleAssignExisting = useCallback(async () => {
    if (!activeRecord) return;
    const playerId = activeRecord.playerId;

    // 1) Persist any per-axis filter values the user kept (i.e., DID NOT
    //    pick "player"). buildPlayerPatchFromFilters honors keepExistingFor.
    const patch = buildPlayerPatchFromFilters(filters, { keepExistingFor });
    const newInventory = buildAccessoryInventory(activeRecord.accessoryInventory);
    const updates = { ...patch };
    if (newInventory !== (activeRecord.accessoryInventory || [])) {
      updates.accessoryInventory = newInventory;
    }
    updates.lastSeenAt = Date.now();

    try {
      if (Object.keys(updates).length > 0) {
        await updatePlayer(playerId, updates, GUEST_USER_ID);
      }
    } catch (err) {
      addToast(`Could not update player: ${err.message}`, { variant: 'error' });
      return;
    }

    if (mode === 'edit') {
      // Pure edit (PlayerProfileView): no seat assignment.
      try { await loadAllPlayers(); } catch { /* non-fatal */ }
      addToast(`Updated ${activeRecord.name || 'player'}`, { variant: 'success' });
      closePlayerFinder();
      return;
    }

    // FIND-mode (default): assign the player to the seat.
    if (!seat) {
      // Defensive — shouldn't happen because the open path always seats it.
      try { await loadAllPlayers(); } catch { /* non-fatal */ }
      closePlayerFinder();
      return;
    }
    const priorSeat = getPlayerSeat(playerId);
    const movedFromSeat = priorSeat && priorSeat !== seat ? priorSeat : null;
    if (movedFromSeat) {
      try { clearSeatAssignment(movedFromSeat); } catch { /* tolerate */ }
    }
    try {
      await assignPlayerToSeat(seat, playerId, { sessionId, source: 'finder' });
    } catch (err) {
      addToast(`Could not assign player: ${err.message}`, { variant: 'error' });
      return;
    }
    if (movedFromSeat) {
      addToast(`Moved ${activeRecord.name} from seat ${movedFromSeat} to seat ${seat}`, {
        variant: 'info', duration: 6000,
      });
    }
    await recordFirstSighting(playerId, patch);
    try { await loadAllPlayers(); } catch { /* non-fatal */ }
    closePlayerFinder();
  }, [
    activeRecord, filters, keepExistingFor, mode, seat, sessionId,
    buildAccessoryInventory, getPlayerSeat, clearSeatAssignment,
    assignPlayerToSeat, recordFirstSighting, loadAllPlayers,
    closePlayerFinder, addToast,
  ]);

  // CREATE-NEW path — composes a player from filter values + accessory and
  // assigns to seat (find mode) or just persists (create mode).
  const handleCreateNew = useCallback(async () => {
    const patch = buildPlayerPatchFromFilters(filters, {});
    const accessoryInventory = buildAccessoryInventory([]);
    const { name, nameSource } = deriveAutoName(
      { ...patch, name: nameQuery },
      seat ? { seat, sessionId } : null,
    );
    const record = {
      ...patch,
      name,
      nameSource,
      accessoryInventory,
    };
    let newId;
    try {
      newId = await commitDraft(GUEST_USER_ID, record);
    } catch (err) {
      addToast(`Could not save player: ${err.message}`, { variant: 'error' });
      return;
    }
    try { await loadAllPlayers(); } catch { /* non-fatal */ }
    if (seat && mode !== 'create') {
      try {
        await assignPlayerToSeat(seat, newId, { sessionId, source: 'finder-create' });
      } catch (err) {
        addToast(`Saved player but could not assign to seat: ${err.message}`, { variant: 'warning' });
      }
      await recordFirstSighting(newId, patch);
    }
    addToast(`Saved ${name || 'new player'}`, { variant: 'success' });
    closePlayerFinder();
  }, [
    filters, buildAccessoryInventory, nameQuery, seat, mode, sessionId,
    loadAllPlayers, assignPlayerToSeat, recordFirstSighting,
    closePlayerFinder, addToast,
  ]);

  // Keep `capturedPreviewUrl` cleaned up on unmount.
  useEffect(() => {
    return () => {
      if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = useCallback(() => {
    closePlayerFinder();
  }, [closePlayerFinder]);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div
      className="h-dvh w-full flex flex-col bg-slate-900 text-gray-100 overflow-hidden"
      data-testid="player-finder-view"
    >
      {/* TOP BAR */}
      <div className="bg-slate-950 border-b border-slate-700 shrink-0">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-sm font-semibold hover:bg-slate-800 px-2 py-1 rounded text-gray-200 min-h-[44px]"
            data-testid="finder-back-btn"
          >
            <ChevronLeft size={20} />
            Back
          </button>
          <div className="text-base font-semibold text-gray-100 truncate mx-2">
            {title}
          </div>
          <div style={{ minWidth: 60 }} />
        </div>
      </div>

      {/* BUILDER HEADER — outside scroll, always visible. */}
      <div className="bg-slate-900 border-b border-slate-700 px-3 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0" style={{ width: 56, height: 56 }}>
            <div
              className={`rounded-full overflow-hidden border-2 transition-colors ${
                activeRecord ? 'border-amber-500' : (totalActiveCount > 0 ? 'border-amber-500/50' : 'border-slate-700')
              }`}
              style={{ width: 56, height: 56 }}
            >
              <IdentityAvatar
                player={livePlayer}
                size={56}
                photoOverlay={!!capturedPreviewUrl}
                photoUrl={capturedPreviewUrl}
              />
            </div>
            <button
              type="button"
              onClick={openCamera}
              aria-label="Add photo"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 hover:bg-amber-400 text-gray-900 flex items-center justify-center shadow-md ring-2 ring-slate-900"
              data-testid="finder-camera-btn"
            >
              <Camera size={12} />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">
                {builderStatus.line1}
              </span>
              <span className="text-sm font-semibold text-gray-100 truncate">
                {builderStatus.line2}
              </span>
            </div>
            <input
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Name or nickname"
              className="w-full bg-slate-800 text-gray-100 text-xs placeholder:text-gray-500 rounded-md border border-slate-700 px-3 py-2 focus:border-amber-500 focus:outline-none min-h-[44px]"
              data-testid="finder-name-input"
            />
          </div>
        </div>
      </div>

      {/* SCROLL COLUMN */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
        <IdentificationFields
          filters={filters}
          setScalar={setScalar}
          setEthnicity={setEthnicity}
          setEthnicityNote={setEthnicityNote}
          setAccessory={setAccessory}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabBadges={tabBadges}
          mode={mode === 'edit' ? 'edit' : 'filter'}
        />

        {/* ACTIVE-FILTER COUNT BAR */}
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="text-[11px] text-gray-300">
            {hasActiveFilters ? `${results.length} match${results.length === 1 ? '' : 'es'}` : 'No filters · all players'}
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] text-gray-300 hover:text-amber-300 underline"
            >
              Clear all
            </button>
          ) : null}
        </div>

        {/* CONGRUENCY PANEL */}
        {activeRecord ? (
          <CongruencyPanel
            player={activeRecord}
            items={congruencyItems}
            decisions={decisions}
            onDecide={decideAxis}
            onCancel={cancelLoaded}
            onAssign={handleAssignExisting}
            seat={seat}
            mode={mode}
          />
        ) : null}

        {/* RESULTS */}
        {mode !== 'edit' ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                Results · {results.length}
              </span>
              {activeRecord ? (
                <button
                  type="button"
                  onClick={cancelLoaded}
                  className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200 font-semibold"
                >
                  <X size={12} />
                  Clear loaded
                </button>
              ) : null}
            </div>
            <div className="space-y-2">
              {results.length === 0 ? (
                <div className="bg-slate-800/60 border border-dashed border-slate-700 rounded-lg p-3 text-center text-sm text-gray-500">
                  No matches. Adjust a filter, or save as new player.
                </div>
              ) : (
                results.map(({ player, matchedAccessories }) => (
                  <ResultRow
                    key={player.playerId}
                    player={player}
                    matchedAccessories={matchedAccessories}
                    isLoaded={activeRecord?.playerId === player.playerId}
                    onTap={loadRecord}
                  />
                ))
              )}
            </div>

            {!activeRecord && hasActiveFilters ? (
              <button
                type="button"
                onClick={handleCreateNew}
                className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-dashed border-amber-500/50 rounded-lg py-3 text-sm font-semibold flex items-center justify-center gap-2 min-h-[44px]"
                data-testid="finder-create-new-btn"
              >
                <Plus size={16} />
                Save & Assign as NEW player using these values
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {/* CAMERA MODAL — production path. Persists via savePhotoAtomically
          (default) when an existing player is loaded; otherwise stashes
          the preview URL for live builder display until save creates the
          player record (post-save photo binding is a follow-up).

          Avatar render-chain (per WS-184 Bug E fix, SPR-076):
            CameraCaptureModal save success
              → onSaved(blobId, photoUrl) fires
              → setCapturedPreviewUrl(photoUrl) updates local state
              → IdentityAvatar above re-renders with photoOverlay=true
                + photoUrl=<the in-memory blob URL of the just-saved photo>.
            The blob is durable in IDB via savePhotoAtomically; the URL
            here is the in-session preview so the avatar updates without
            an IDB re-fetch round-trip. */}
      {cameraOpen ? (
        <CameraCaptureModal
          playerId={activeRecord?.playerId ?? 'live-builder'}
          onClose={closeCamera}
          onSaved={activeRecord ? (_blobId, photoUrl) => {
            setCapturedPreviewUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return photoUrl;
            });
          } : undefined}
          onAcceptOverride={!activeRecord ? async (blob, _previewUrl) => {
            // No record yet — stash a copy of the URL on the local state so
            // the live builder avatar shows the photo. The captured blob is
            // currently not persisted at create-time (Phase B parks photo
            // capture for new-player flow until we wire post-create binding).
            setCapturedPreviewUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return URL.createObjectURL(blob);
            });
          } : undefined}
        />
      ) : null}
    </div>
  );
};

export default PlayerFinderView;
