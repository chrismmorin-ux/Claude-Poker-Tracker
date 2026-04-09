/**
 * render-coordinator.js — Unified render scheduler for side panel.
 *
 * Replaces the ad-hoc debounce + bypass system with a single coordinated
 * render pipeline. All push handlers update state, then call scheduleRender().
 * All DOM writes happen in one renderAll() call per animation frame.
 *
 * Extracted as a class with dependency injection so it can be tested with
 * fake timers and no chrome APIs.
 */

import { computeFocusedVillain } from './render-orchestrator.js';

// =========================================================================
// PRIORITY LEVELS
// =========================================================================

export const PRIORITY = Object.freeze({
  /** Debounced — coalesces rapid pushes (80ms). Used for most data pushes. */
  NORMAL: 'normal',
  /** Immediate — bypasses debounce, renders next rAF. Used for advice arrival, user interaction. */
  IMMEDIATE: 'immediate',
});

// =========================================================================
// STREET_RANK — used by advice guard
// =========================================================================

const STREET_RANK = { preflop: 0, flop: 1, turn: 2, river: 3 };

// =========================================================================
// RENDER COORDINATOR
// =========================================================================

/**
 * @typedef {Object} RenderCoordinatorDeps
 * @property {(snapshot: Object, reason: string) => void} renderFn - Called to render all DOM
 * @property {() => number} getTimestamp - Returns current time (injectable for tests)
 * @property {(cb: () => void) => void} requestFrame - Schedules a frame (rAF or setTimeout)
 * @property {(cb: () => void, ms: number) => number} setTimeout - Timer (injectable for tests)
 * @property {(id: number) => void} clearTimeout - Cancel timer
 */

export class RenderCoordinator {
  /**
   * @param {RenderCoordinatorDeps} deps
   * @param {Object} [opts]
   * @param {number} [opts.coalesceMs=80] - Debounce window for NORMAL priority
   */
  constructor(deps, { coalesceMs = 80 } = {}) {
    this._renderFn = deps.renderFn;
    this._getTimestamp = deps.getTimestamp || (() => Date.now());
    this._requestFrame = deps.requestFrame || ((cb) => requestAnimationFrame(cb));
    this._setTimeout = deps.setTimeout || ((cb, ms) => setTimeout(cb, ms));
    this._clearTimeout = deps.clearTimeout || ((id) => clearTimeout(id));
    this._coalesceMs = coalesceMs;

    // --- State variables (mirroring side-panel.js module-level vars) ---
    this._state = {
      lastHandCount: 0,
      cachedSeatStats: null,
      currentTableState: null,
      currentActiveTableId: null,
      currentLiveContext: null,
      lastGoodExploits: null,
      lastGoodAdvice: null,
      lastGoodWeaknesses: null,
      lastGoodBriefings: null,
      lastGoodObservations: null,
      lastGoodTournament: null,
      tournamentCollapsed: false,
      appSeatData: {},
      lastPipeline: null,
      exploitPushCount: 0,
      advicePushCount: 0,
      cachedDiag: null,
      swFallbackState: null,
      focusedVillainSeat: null,
      pinnedVillainSeat: null,
      deepExpanderOpen: false,
      lastRenderedStreet: null,
      advicePendingForStreet: null,
      userCollapsedSections: new Set(),
      recoveryMessage: null,
      connState: { connected: false },
      cachedSeatMap: null,
      // Versioning for renderKey
      appSeatDataVersion: 0,
    };

    // --- Internal scheduling state ---
    this._lastRenderKey = null;
    this._coalesceTimer = null;
    this._rafPending = false;
    this._pendingReason = null;

    // --- Advice hold buffer (RT-45) ---
    this._pendingAdvice = null;

    // --- Visual continuity (RT-48) ---
    this._lastStreetCardHtml = null;
  }

  // =======================================================================
  // STATE ACCESS
  // =======================================================================

  /** Get a state value by key. */
  get(key) {
    return this._state[key];
  }

  /** Set a state value by key. */
  set(key, value) {
    this._state[key] = value;
  }

  /** Bulk-set state values. */
  merge(partial) {
    Object.assign(this._state, partial);
  }

  /** Get the pending advice buffer (RT-45). */
  getPendingAdvice() {
    return this._pendingAdvice;
  }

  /** Get the last street card HTML cache (RT-48). */
  getLastStreetCardHtml() {
    return this._lastStreetCardHtml;
  }

  /** Set the last street card HTML cache (called by renderAll after rendering). */
  setLastStreetCardHtml(html) {
    this._lastStreetCardHtml = html;
  }

  // =======================================================================
  // SNAPSHOT
  // =======================================================================

  /**
   * Build an atomic snapshot of all state. focusedVillainSeat is computed
   * here (not read from stale module variable) so the renderKey includes
   * the correct value.
   */
  buildSnapshot() {
    const s = this._state;
    const focusedVillainSeat = computeFocusedVillain({
      pinnedVillainSeat: s.pinnedVillainSeat,
      lastGoodAdvice: s.lastGoodAdvice,
      currentLiveContext: s.currentLiveContext,
      currentTableState: s.currentTableState,
    });

    return {
      // Shallow copy of all state
      lastHandCount: s.lastHandCount,
      cachedSeatStats: s.cachedSeatStats,
      currentTableState: s.currentTableState,
      currentActiveTableId: s.currentActiveTableId,
      currentLiveContext: s.currentLiveContext,
      lastGoodExploits: s.lastGoodExploits,
      lastGoodAdvice: s.lastGoodAdvice,
      lastGoodWeaknesses: s.lastGoodWeaknesses,
      lastGoodBriefings: s.lastGoodBriefings,
      lastGoodObservations: s.lastGoodObservations,
      lastGoodTournament: s.lastGoodTournament,
      tournamentCollapsed: s.tournamentCollapsed,
      appSeatData: s.appSeatData,
      lastPipeline: s.lastPipeline,
      exploitPushCount: s.exploitPushCount,
      advicePushCount: s.advicePushCount,
      cachedDiag: s.cachedDiag,
      swFallbackState: s.swFallbackState,
      pinnedVillainSeat: s.pinnedVillainSeat,
      deepExpanderOpen: s.deepExpanderOpen,
      lastRenderedStreet: s.lastRenderedStreet,
      advicePendingForStreet: s.advicePendingForStreet,
      userCollapsedSections: new Set(s.userCollapsedSections),
      recoveryMessage: s.recoveryMessage,
      connState: s.connState,
      cachedSeatMap: s.cachedSeatMap,
      appSeatDataVersion: s.appSeatDataVersion,
      // Computed
      focusedVillainSeat,
      // Derived
      street: s.currentLiveContext?.currentStreet
        || s.lastGoodAdvice?.currentStreet
        || null,
      hasHands: s.lastHandCount > 0,
      appConnected: !!(s.lastPipeline?.appConnected) || !!(s.lastGoodExploits?.appConnected),
      // Visual continuity
      lastStreetCardHtml: this._lastStreetCardHtml,
    };
  }

  // =======================================================================
  // RENDER KEY
  // =======================================================================

  /**
   * Build a fingerprint string from a snapshot. Used to skip redundant
   * renders when nothing visible has changed.
   *
   * RT-44 fixes:
   * - Uses exploitPushCount instead of !!lastGoodExploits (detects updates)
   * - Uses appSeatDataVersion (detects villain profile changes)
   * - focusedVillainSeat is already computed in the snapshot (correct value)
   */
  buildRenderKey(snap) {
    return [
      snap.currentLiveContext?.state,
      snap.currentLiveContext?.currentStreet,
      (snap.currentLiveContext?.foldedSeats || []).length,
      (snap.currentLiveContext?.actionSequence || []).length,
      snap.currentLiveContext?.pot,
      snap.lastGoodAdvice?.currentStreet,
      snap.lastGoodAdvice?.recommendations?.[0]?.action,
      snap.focusedVillainSeat,
      snap.pinnedVillainSeat,
      snap.lastHandCount,
      snap.exploitPushCount,
      snap.advicePushCount,
      !!snap.lastGoodTournament,
      snap.advicePendingForStreet,
      snap.appSeatDataVersion,
      snap.cachedDiag ? 1 : 0,
      snap.recoveryMessage ? 1 : 0,
      snap.connState?.connected ? 1 : 0,
    ].join('|');
  }

  // =======================================================================
  // SCHEDULE RENDER
  // =======================================================================

  /**
   * Schedule a render. All push handlers call this instead of writing DOM.
   *
   * @param {string} reason - Debug tag for render tracing
   * @param {string} [priority=PRIORITY.NORMAL] - NORMAL (debounced) or IMMEDIATE
   */
  scheduleRender(reason, priority = PRIORITY.NORMAL) {
    this._pendingReason = reason;

    // Cancel any existing coalesce timer
    if (this._coalesceTimer != null) {
      this._clearTimeout(this._coalesceTimer);
      this._coalesceTimer = null;
    }

    if (priority === PRIORITY.IMMEDIATE) {
      // Fire on next frame
      this._queueFrame();
    } else {
      // Coalesce: wait for burst to settle, then fire
      this._coalesceTimer = this._setTimeout(() => {
        this._coalesceTimer = null;
        this._queueFrame();
      }, this._coalesceMs);
    }
  }

  /** Queue a rAF callback if not already pending. */
  _queueFrame() {
    if (this._rafPending) return;
    this._rafPending = true;
    this._requestFrame(() => this._executeRender());
  }

  /** Execute the render — called from rAF. */
  _executeRender() {
    this._rafPending = false;
    const snap = this.buildSnapshot();
    const reason = this._pendingReason || 'unknown';

    const key = this.buildRenderKey(snap);
    if (key === this._lastRenderKey) return;
    this._lastRenderKey = key;

    // Update lastRenderedStreet in state for next cycle
    this._state.lastRenderedStreet = snap.street;
    // Update focusedVillainSeat in state for external readers
    this._state.focusedVillainSeat = snap.focusedVillainSeat;

    this._renderFn(snap, reason);
  }

  // =======================================================================
  // ADVICE GUARD (RT-45)
  // =======================================================================

  /**
   * Process an incoming advice message. If liveContext is null (e.g., after
   * SW restart), hold the advice in a pending buffer rather than accepting
   * it — stale advice from a prior hand would otherwise be displayed.
   *
   * @param {Object} adviceMsg - The advice payload from push_action_advice
   * @returns {boolean} Whether the advice was accepted (true) or held (false)
   */
  handleAdvice(adviceMsg) {
    if (!adviceMsg) return false;

    this._state.advicePushCount++;

    // RT-45: If no live context, hold advice until context arrives
    if (!this._state.currentLiveContext) {
      this._pendingAdvice = adviceMsg;
      return false;
    }

    // Street validation: reject advice from earlier streets than live context
    const adviceStreet = adviceMsg.currentStreet;
    const liveStreet = this._state.currentLiveContext.currentStreet;
    const adviceRank = STREET_RANK[adviceStreet] ?? -1;
    const liveRank = STREET_RANK[liveStreet] ?? -1;

    if (liveRank <= adviceRank || adviceRank === -1) {
      this._state.lastGoodAdvice = adviceMsg;
      // Clear pending flag — fresh advice arrived
      if (this._state.advicePendingForStreet) {
        this._state.advicePendingForStreet = null;
      }
      this._pendingAdvice = null;
      return true;
    }

    return false;
  }

  /**
   * Process an incoming live context message. Handles new-hand boundaries
   * (clears stale advice) and promotes any pending advice from the hold buffer.
   *
   * @param {Object} ctx - The context payload from push_live_context
   */
  handleLiveContext(ctx) {
    if (!ctx) return;

    const prevState = this._state.currentLiveContext?.state;
    this._state.currentLiveContext = { ...ctx, _receivedAt: this._getTimestamp() };

    const newState = this._state.currentLiveContext.state;

    // RT-45: Promote pending advice BEFORE hand boundary clears it.
    // On SW reconnect, advice arrives before live context. Only promote if
    // advice street MATCHES the live context street (same hand). If advice
    // is from a later street (e.g., river advice when live is preflop),
    // it's stale from a previous hand — discard it.
    let promotedPending = false;
    if (this._pendingAdvice) {
      const adviceRank = STREET_RANK[this._pendingAdvice.currentStreet] ?? -1;
      const effectiveStreet = newState === 'DEALING' ? 'preflop' : this._state.currentLiveContext.currentStreet;
      const liveRank = STREET_RANK[effectiveStreet] ?? -1;

      // Promote only if advice is for the same street or an earlier street
      // that the live context hasn't passed yet (adviceRank <= liveRank would
      // mean stale). We want adviceRank === liveRank (exact match) for reconnect.
      // Also accept if advice is for a later street (live context may not have
      // caught up yet — but only if this is NOT a new hand boundary).
      const isNewHand = prevState !== newState && (newState === 'PREFLOP' || newState === 'DEALING');
      if (isNewHand) {
        // At hand boundary: only promote if advice matches the new hand's street
        if (adviceRank === liveRank) {
          this._state.lastGoodAdvice = this._pendingAdvice;
          this._state.advicePendingForStreet = null;
          promotedPending = true;
        }
      } else {
        // Mid-hand reconnect: standard street validation
        if (liveRank <= adviceRank || adviceRank === -1) {
          this._state.lastGoodAdvice = this._pendingAdvice;
          this._state.advicePendingForStreet = null;
          promotedPending = true;
        }
      }
      this._pendingAdvice = null;
    }

    // New hand boundary: clear stale per-hand data.
    // Skip if we just promoted pending advice (reconnect scenario — advice
    // is from the current hand, not stale).
    if (!promotedPending && prevState !== newState && (newState === 'PREFLOP' || newState === 'DEALING')) {
      this._state.advicePendingForStreet = newState;
      this._state.lastGoodAdvice = null;
      this._state.lastRenderedStreet = null;
      this._state.deepExpanderOpen = false;
    }
  }

  // =======================================================================
  // TABLE SWITCH (clears per-table state)
  // =======================================================================

  /**
   * Clear per-table state on table switch.
   */
  clearForTableSwitch() {
    this._state.pinnedVillainSeat = null;
    this._state.lastGoodAdvice = null;
    this._state.lastGoodTournament = null;
    this._state.currentLiveContext = null;
    this._state.userCollapsedSections = new Set();
    this._pendingAdvice = null;
    this._lastStreetCardHtml = null;
  }

  // =======================================================================
  // FLUSH (for testing)
  // =======================================================================

  /**
   * Force-execute any pending render immediately (bypasses timers).
   * Only for use in tests.
   */
  flush() {
    if (this._coalesceTimer != null) {
      this._clearTimeout(this._coalesceTimer);
      this._coalesceTimer = null;
    }
    if (this._rafPending || this._pendingReason) {
      this._rafPending = false;
      this._executeRender();
    }
  }

  /**
   * Reset the renderKey so the next render is guaranteed to execute.
   * Only for use in tests.
   */
  resetRenderKey() {
    this._lastRenderKey = null;
  }

  /**
   * Destroy: cancel all pending timers.
   */
  destroy() {
    if (this._coalesceTimer != null) {
      this._clearTimeout(this._coalesceTimer);
      this._coalesceTimer = null;
    }
    this._rafPending = false;
  }
}
