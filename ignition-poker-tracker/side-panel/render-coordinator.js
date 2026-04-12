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
import { StateInvariantChecker, InvariantViolationError } from './state-invariants.js';
import { STREET_RANK } from '../shared/constants.js';

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
  constructor(deps, { coalesceMs = 80, throwOnViolation = false } = {}) {
    this._renderFn = deps.renderFn;
    this._getTimestamp = deps.getTimestamp || (() => Date.now());
    this._requestFrame = deps.requestFrame || ((cb) => requestAnimationFrame(cb));
    this._setTimeout = deps.setTimeout || ((cb, ms) => setTimeout(cb, ms));
    this._clearTimeout = deps.clearTimeout || ((id) => clearTimeout(id));
    this._clearInterval = deps.clearInterval || ((id) => clearInterval(id));
    // RT-60: generic timer registry for module-level setTimeout/setInterval
    // handles that belong to the IIFE but need coordinator-driven lifecycle
    // (clearForTableSwitch / destroy must cancel them to prevent orphan-fire
    // on a different table's context).
    this._timers = new Map();
    // Optional hooks registered by non-coordinator modules (e.g.
    // render-street-card.js) to cancel their own module-local timers on
    // table switch. Called with no arguments.
    this._tableSwitchHooks = [];
    this._coalesceMs = coalesceMs;
    this._throwOnViolation = throwOnViolation;
    // RT-66: give the checker a live accessor to pipelineEvents so Rule 10
    // can read the ring buffer without pipelineEvents bloating the snapshot.
    this._invariantChecker = new StateInvariantChecker({
      getPipelineEvents: () => this._state.pipelineEvents,
    });

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
      planPanelOpen: false,
      // Versioning for renderKey
      appSeatDataVersion: 0,
      // Between-hands Mode A timer state
      modeAExpired: false,
      modeATimerActive: false,
      // Two-phase stale context (Fix 3)
      staleContext: false,
      // Has-hands flag for no-table visibility (Fix 2)
      hasTableHands: true,
      // Fix 6c: Pipeline event log (capped at 50, NOT in renderKey)
      pipelineEvents: [],
      // RT-66: invariant-violation surfacing. Bumped on every failing check;
      // snap exposes the timestamp so status bar can show a "!" badge.
      lastViolationAt: 0,
      lastViolationCount: 0,
      // Layer 2: Position lock — heroSeat/dealerSeat frozen per hand
      _lockedHeroSeat: null,
      _lockedDealerSeat: null,
      _lockedHandNumber: null,
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

    // --- Between-hands Mode A timer ---
    this._modeATimer = null;
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
      staleContext: s.staleContext,
      hasTableHands: s.hasTableHands,
      planPanelOpen: s.planPanelOpen,
      modeAExpired: s.modeAExpired,
      // RT-66: violation surfacing
      lastViolationAt: s.lastViolationAt || 0,
      lastViolationCount: s.lastViolationCount || 0,
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
   * RT-43/RT-44/RT-54 fixes:
   * - Tournament content hash (not just a boolean) — blinds up / M change /
   *   player busts must invalidate the key. Pre-fix these state changes
   *   were silent and the tournament panel displayed stale data.
   * - Last-action includes amount + seat, not just action type — a raise
   *   to a different size was otherwise indistinguishable from the same
   *   action at a different size.
   * - Advice villainSeat + sizing included so pinned/advice disambiguation
   *   updates trigger re-render.
   * - Uses exploitPushCount / appSeatDataVersion / advicePushCount to
   *   catch updates without deep-equals.
   */
  buildRenderKey(snap) {
    const t = snap.lastGoodTournament;
    // Fields the sidebar *actually displays* from tournament data.
    const tournamentFingerprint = t
      ? [t.heroMRatio, t.currentLevelIndex, t.playersRemaining, t.icmPressure?.zone,
         t.levelEndTime, t.mRatioGuidance?.zone].join(':')
      : '';
    const lastAct = snap.currentLiveContext?.actionSequence?.slice(-1)?.[0];
    const lastActionFingerprint = lastAct
      ? `${lastAct.action}@${lastAct.seat}=${lastAct.amount}`
      : '';
    const topRec = snap.lastGoodAdvice?.recommendations?.[0];
    const adviceFingerprint = topRec
      ? `${topRec.action}:${topRec.sizing?.betFraction ?? ''}:${snap.lastGoodAdvice.villainSeat ?? ''}`
      : '';
    return [
      snap.currentLiveContext?.state,
      snap.currentLiveContext?.currentStreet,
      (snap.currentLiveContext?.foldedSeats || []).length,
      (snap.currentLiveContext?.actionSequence || []).length,
      snap.currentLiveContext?.pot,
      (snap.currentLiveContext?.communityCards || []).filter(c => c).join(','),
      lastActionFingerprint,
      snap.lastGoodAdvice?.currentStreet,
      adviceFingerprint,
      snap.focusedVillainSeat,
      snap.pinnedVillainSeat,
      snap.lastHandCount,
      snap.exploitPushCount,
      snap.advicePushCount,
      tournamentFingerprint,
      snap.advicePendingForStreet,
      snap.appSeatDataVersion,
      snap.cachedDiag ? 1 : 0,
      snap.recoveryMessage ? 1 : 0,
      snap.connState?.connected ? 1 : 0,
      snap.staleContext ? 1 : 0,
      snap.hasTableHands ? 1 : 0,
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

    // Layer 1: Runtime invariant check after every render
    const result = this._invariantChecker.check(snap);
    if (result.violations.length > 0) {
      for (const v of result.violations) {
        this.logPipelineEvent('INVARIANT_VIOLATION', v);
      }
      // RT-66: stamp lastViolationAt so the status bar can surface a small
      // "!" badge. The badge auto-decays — status-bar code checks
      // `Date.now() - snap.lastViolationAt < 30_000`.
      this._state.lastViolationAt = this._getTimestamp();
      this._state.lastViolationCount = (this._state.lastViolationCount || 0) + result.violations.length;
      if (this._throwOnViolation) {
        throw new InvariantViolationError(result.violations);
      }
    }
  }

  // =======================================================================
  // PIPELINE EVENT LOG (Fix 6c)
  // =======================================================================

  /**
   * Log a pipeline event for audit visibility. Capped at 50 entries.
   * NOT included in buildRenderKey — display-only data.
   */
  logPipelineEvent(event, detail = '') {
    const events = this._state.pipelineEvents;
    events.push({ ts: this._getTimestamp(), event, detail });
    if (events.length > 50) events.splice(0, events.length - 50);
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

    // RT-45: hand-number binding. Advice from a different hand than the
    // locked one is cross-hand contamination — reject outright regardless
    // of street rank. The SW can replay cached advice after a hand
    // boundary; street-rank gap alone misses the case where advice street
    // is within tolerance of the new hand's street.
    const lockedHand = this._state._lockedHandNumber;
    const adviceHand = adviceMsg.handNumber ?? null;
    if (lockedHand != null && adviceHand != null && lockedHand !== adviceHand) {
      this.logPipelineEvent('advice_rejected', `cross-hand: ${adviceHand} vs locked ${lockedHand}`);
      return false;
    }

    // Street validation: reject stale advice, hold suspicious advice
    const adviceStreet = adviceMsg.currentStreet;
    const liveStreet = this._state.currentLiveContext.currentStreet;
    const adviceRank = STREET_RANK[adviceStreet] ?? -1;
    const liveRank = STREET_RANK[liveStreet] ?? -1;

    // Accept if: known street, same or at most 1 street ahead of context
    // (advice may arrive slightly before context catches up — max 1 street gap)
    // Reject gap > 1: e.g., river advice on preflop = cross-hand contamination
    if (adviceRank >= 0 && liveRank >= 0 && adviceRank >= liveRank && (adviceRank - liveRank) <= 1) {
      // RT-48: stamp _receivedAt so the render path can age-badge the
      // card when new advice stops arriving.
      this._state.lastGoodAdvice = { ...adviceMsg, _receivedAt: this._getTimestamp() };
      if (this._state.advicePendingForStreet) {
        this._state.advicePendingForStreet = null;
      }
      this._pendingAdvice = null;
      this.logPipelineEvent('advice_accepted', adviceStreet);
      return true;
    }

    // Earlier street — stale within same hand, reject outright
    if (adviceRank >= 0 && liveRank >= 0 && adviceRank < liveRank) {
      return false;
    }

    // Unknown street, unknown context, or >1 street gap — hold in pending
    this._pendingAdvice = adviceMsg;
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

    // Layer 2: Position lock — freeze heroSeat/dealerSeat for duration of a hand.
    // Protocol noise can change these mid-hand; locking prevents chart position flicker.
    const incomingHand = ctx.handNumber || null;
    const isNewHandBoundary = prevState !== ctx.state && (ctx.state === 'PREFLOP' || ctx.state === 'DEALING');

    if (isNewHandBoundary || this._state._lockedHandNumber !== incomingHand) {
      // New hand: lock positions from incoming context
      this._state._lockedHeroSeat = ctx.heroSeat;
      this._state._lockedDealerSeat = ctx.dealerSeat;
      this._state._lockedHandNumber = incomingHand;
    } else if (this._state._lockedHeroSeat != null) {
      // Mid-hand: enforce locked positions, override protocol noise
      if (ctx.heroSeat !== this._state._lockedHeroSeat || ctx.dealerSeat !== this._state._lockedDealerSeat) {
        this.logPipelineEvent('position_override',
          `hero:${ctx.heroSeat}\u2192${this._state._lockedHeroSeat} dealer:${ctx.dealerSeat}\u2192${this._state._lockedDealerSeat}`);
        ctx.heroSeat = this._state._lockedHeroSeat;
        ctx.dealerSeat = this._state._lockedDealerSeat;
      }
    }

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
        // Mid-hand reconnect: accept same street or at most 1 ahead
        // Reject unknown street or >1 street gap (cross-hand contamination)
        if (adviceRank >= 0 && liveRank >= 0 && adviceRank >= liveRank && (adviceRank - liveRank) <= 1) {
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
      this.logPipelineEvent('new_hand', `${prevState || 'null'} \u2192 ${newState}`);
    }
  }

  // =======================================================================
  // TABLE SWITCH (clears per-table state)
  // =======================================================================

  /**
   * Clear per-table state on table switch.
   */
  clearForTableSwitch() {
    // RT-60: cancel all registered timers before wiping state so no
    // orphan callback can fire on the next table's context.
    this.clearAllTimers();
    for (const hook of this._tableSwitchHooks) {
      try { hook(); } catch (_) { /* best-effort: one bad hook must not break lifecycle */ }
    }
    this._state.pinnedVillainSeat = null;
    this._state.lastGoodAdvice = null;
    this._state.lastGoodTournament = null;
    this._state.currentLiveContext = null;
    this._state._lockedHeroSeat = null;
    this._state._lockedDealerSeat = null;
    this._state._lockedHandNumber = null;
    this._state.userCollapsedSections = new Set();
    this._state.planPanelOpen = false;
    this.clearModeATimer();
    this._pendingAdvice = null;
    this._lastStreetCardHtml = null;
  }

  // =======================================================================
  // TIMER REGISTRATION CONTRACT (RT-60)
  //
  // The IIFE side-panel.js owns several setTimeout/setInterval handles
  // (tourneyTimer, tableGrace, staleContext, planPanelAutoExpand). Before
  // RT-60 these were module-level `let` vars that clearForTableSwitch
  // couldn't reach, so timers would fire on the next table's data after
  // a switch. Now every such handle is registered under a string key so
  // the coordinator can cancel them on lifecycle events.
  //
  // Re-registering the same key clears the previous handle first — this
  // makes "replace an existing timer" a one-call operation.
  //
  // clearAllTimers() is invoked by both clearForTableSwitch() and
  // destroy().
  // =======================================================================

  /**
   * Register a timer handle under a key. Clears any existing handle for
   * the same key before storing the new one. `kind` is 'timeout' (default)
   * or 'interval' and determines which clear function is used.
   */
  registerTimer(key, handle, kind = 'timeout') {
    const existing = this._timers.get(key);
    if (existing) {
      (existing.kind === 'interval' ? this._clearInterval : this._clearTimeout)(existing.handle);
    }
    this._timers.set(key, { handle, kind });
  }

  /** Clear a single timer by key, if registered. No-op if absent. */
  clearTimer(key) {
    const entry = this._timers.get(key);
    if (!entry) return;
    (entry.kind === 'interval' ? this._clearInterval : this._clearTimeout)(entry.handle);
    this._timers.delete(key);
  }

  /** Cancel every registered timer. Called from clearForTableSwitch + destroy. */
  clearAllTimers() {
    for (const [, entry] of this._timers) {
      (entry.kind === 'interval' ? this._clearInterval : this._clearTimeout)(entry.handle);
    }
    this._timers.clear();
  }

  /**
   * Register a callback to run on table switch. Lets modules that own
   * their own local timers (e.g. render-street-card's transition timer)
   * opt into the coordinator's lifecycle without exposing the handle.
   */
  onTableSwitch(fn) {
    if (typeof fn === 'function') this._tableSwitchHooks.push(fn);
  }

  // =======================================================================
  // MODE A TIMER (between-hands reflection)
  // =======================================================================

  /**
   * Start the 10-second Mode A timer. After expiry, modeAExpired becomes
   * true and a re-render is scheduled (transitioning from reflection to
   * observing mode).
   */
  startModeATimer() {
    if (this._state.modeATimerActive) return;
    this._state.modeATimerActive = true;
    this._modeATimer = this._setTimeout(() => {
      this._state.modeAExpired = true;
      this._state.modeATimerActive = false;
      this._modeATimer = null;
      this.scheduleRender('modeA_expired', PRIORITY.IMMEDIATE);
    }, 10_000);
  }

  /**
   * Clear the Mode A timer and reset state.
   */
  clearModeATimer() {
    if (this._modeATimer != null) {
      this._clearTimeout(this._modeATimer);
      this._modeATimer = null;
    }
    this._state.modeAExpired = false;
    this._state.modeATimerActive = false;
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
    this.clearModeATimer();
    this.clearAllTimers(); // RT-60
    this._rafPending = false;
  }
}
