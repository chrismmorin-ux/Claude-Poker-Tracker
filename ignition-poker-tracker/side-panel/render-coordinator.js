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
    this._setInterval = deps.setInterval || ((cb, ms) => setInterval(cb, ms));
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
      // SR-6.10 (Z0 0.2): null = unknown (boot-race). Renders as `—`.
      // 0 = known-zero ("0 captured"). Callers that compute `> 0` or equality
      // still work (null > 0 is false; null !== N for any numeric N).
      lastHandCount: null,
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
      // SR-6.11 §1.11 + batch-invariant 6 (Rule V cross-zone contract):
      // Z1 pill-click / Z3 villain-tab-click emit a range-selection event that
      // writes this slot. Distinct from pinnedVillainSeat — Rule V selection
      // is the Z3 range-grid's seat, NOT the scouting pin.
      rangeSelectedSeat: null,
      // SR-6.14: split from monolithic deepExpanderOpen into per-collapsible
      // keys. R-5.1 single-owner: each Z4 row (4.2 More Analysis, 4.3 Model
      // Audit) has its own toggle state.
      moreAnalysisOpen: false,
      modelAuditOpen: false,
      // SR-6.14 RT-61: stable discriminator so renderPlanPanel only arms the
      // 8 s auto-expand timer once per fresh advice. Tracks the advice
      // `_receivedAt` that last caused the timer to arm. `hand:new` + table
      // switch + user toggle clear this. NOT in snapshot/renderKey — it's
      // write-only coordinator-local state.
      lastAutoExpandAdviceAt: null,
      // SR-6.14 RT-61: sticky user-intent flag. When the user explicitly
      // toggles the plan panel (open or close), auto-expand is suppressed
      // for the rest of the hand. Reset on hand:new / table switch only.
      userToggledPlanPanelInHand: false,
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
      // RT-66 + STP-1: invariant-violation surfacing.
      // `lastViolationAt` drives the 30s badge visibility gate (unchanged).
      // `violationCountLifetime` is the monotonic total since construction —
      // useful for long-run signal in the diagnostics dump.
      // `_violationTimestamps` is the rolling-30s window: each failing check
      // pushes one timestamp per rule hit; snapshot derives `violationCount30s`
      // from it by filtering to now-30_000. Old entries are pruned eagerly on
      // push to keep the array bounded during steady-violation sessions.
      lastViolationAt: 0,
      violationCountLifetime: 0,
      _violationTimestamps: [],
      // Layer 2: Position lock — heroSeat/dealerSeat frozen per hand
      _lockedHeroSeat: null,
      _lockedDealerSeat: null,
      _lockedHandNumber: null,
      // Settings flags. Default false until side-panel.js calls
      // loadSettings(); real values arrive via coordinator.set('settings', ...).
      settings: { debugDiagnostics: false },
      // SR-6.5: FSM panel state map { [fsmId]: currentState }. Populated by
      // registerFsm(); mutated only via dispatch(). Snapshotted + hashed into
      // renderKey so every transition forces a re-render.
      panels: {},
      // SR-6.5: seat popover auxiliary data (seat + coords) surfaced by the
      // seat-popover FSM's seatClick handler. Lives outside `panels` because
      // it's derived data, not FSM state.
      seatPopoverDetail: null,
    };

    // SR-6.6: freshness sidecar. Metadata only — underlying state objects
    // in `_state` are unchanged, so existing readers keep reading flat
    // fields. Consumers (age badges, stale labels) read via `snap.freshness`.
    // R-4.1 envelope is { timestamp, source }; `confidence` deferred until
    // a renderer consumes it (R-4.4 age badges land in SR-6.10/6.12/6.14).
    this._freshness = {
      currentLiveContext: null,       // { timestamp, source } — object-level
      currentLiveContextFields: {},   // { [fieldName]: { timestamp, source } } — per-field
      appSeatData: {},                // { [seatNum]: { timestamp, source } }
    };

    // SR-6.5: registered FSMs + hand-new hook list.
    this._fsms = new Map();
    this._handNewHooks = [];

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
      rangeSelectedSeat: s.rangeSelectedSeat,
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
      rangeSelectedSeat: s.rangeSelectedSeat,
      moreAnalysisOpen: s.moreAnalysisOpen,
      modelAuditOpen: s.modelAuditOpen,
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
      // RT-66 + STP-1: violation surfacing. Both counters exposed — the
      // badge uses `violationCount30s`; diag dumps and governance reports
      // show `violationCountLifetime`. Window is computed at snapshot time
      // so a long idle period naturally drops the 30s count to zero even
      // if no new render has occurred since the last violation.
      lastViolationAt: s.lastViolationAt || 0,
      violationCountLifetime: s.violationCountLifetime || 0,
      violationCount30s: (() => {
        const cutoff = this._getTimestamp() - 30_000;
        const ts = s._violationTimestamps || [];
        let n = 0;
        for (let i = ts.length - 1; i >= 0 && ts[i] > cutoff; i--) n++;
        return n;
      })(),
      // RT-71: expose pending-advice presence so renderKey + renderers can
      // react to buffered advice transitions (e.g. SW reanimation hold).
      pendingAdvicePresent: this._pendingAdvice ? 1 : 0,
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
      // SR-6.1: foundation flags. Shallow-copied so downstream readers
      // can't mutate coordinator state.
      settings: { ...s.settings },
      // SR-6.5: FSM state map + seat popover detail.
      panels: { ...s.panels },
      seatPopoverDetail: s.seatPopoverDetail,
      // SR-6.6: freshness sidecar. Shallow-copied so renderers can't mutate
      // coordinator state. Per-field currentLiveContext map + per-seat
      // appSeatData map. Age badges / stale labels consume from here.
      freshness: {
        currentLiveContext: this._freshness.currentLiveContext,
        currentLiveContextFields: { ...this._freshness.currentLiveContextFields },
        appSeatData: { ...this._freshness.appSeatData },
      },
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
      snap.rangeSelectedSeat,
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
      // Flag flips must force a re-render (debug-diagnostics toggles
      // 0.7 footer + 4.3 audit panel visibility).
      snap.settings?.debugDiagnostics ? 1 : 0,
      // SR-6.4: coordinator-owned collapsible/UI state. Without these in
      // the key, a user-driven toggle would not re-render (coalesced
      // pushes would hit the skip-same-key fast path).
      snap.moreAnalysisOpen ? 1 : 0,
      snap.modelAuditOpen ? 1 : 0,
      snap.planPanelOpen ? 1 : 0,
      snap.tournamentCollapsed ? 1 : 0,
      // SR-6.4: lastGoodExploits presence + appConnected bit. exploitPushCount
      // covers push-increment re-renders; this covers clears (table switch)
      // and appConnected transitions carried on the exploits object.
      snap.lastGoodExploits ? 1 : 0,
      snap.lastGoodExploits?.appConnected ? 1 : 0,
      // SR-6.5: FSM state — concat sorted `id:state` pairs so any transition
      // forces a re-render. seatPopoverDetail's seat included so re-clicking
      // a different seat (seatClick → seatClick staying in `shown`) still
      // re-renders.
      Object.keys(snap.panels || {}).sort().map(k => `${k}:${snap.panels[k]}`).join(','),
      snap.seatPopoverDetail?.seat ?? '',
      // RT-71: freshness digest — field-only timestamp updates (capture
      // re-sent same value at new time) must invalidate the key so the
      // stale-tint / age badge re-evaluates without waiting for an
      // unrelated state change to coincide.
      this._freshnessDigest(snap.freshness),
      // RT-71: invariant violation stamp — "!" badge must appear within the
      // next frame, not on the next unrelated state change.
      snap.lastViolationAt || 0,
      // RT-71: pending-advice presence bit — transitions into/out of
      // _pendingAdvice (SW reanimation hold, promotion, hand-boundary drop)
      // must re-render so the "Stale — recomputing" label can reflect state.
      snap.pendingAdvicePresent || 0,
    ].join('|');
  }

  /**
   * RT-71: Cheap digest of the freshness sidecar. Combines max timestamp
   * across all per-field / per-seat freshness entries with a field count,
   * so either a new timestamp or a new field appearing invalidates the key.
   */
  _freshnessDigest(freshness) {
    if (!freshness) return '';
    let maxTs = 0;
    let count = 0;
    const ctx = freshness.currentLiveContext;
    if (ctx && ctx.timestamp > maxTs) maxTs = ctx.timestamp;
    const fields = freshness.currentLiveContextFields || {};
    for (const k in fields) {
      count++;
      const ts = fields[k]?.timestamp || 0;
      if (ts > maxTs) maxTs = ts;
    }
    const seats = freshness.appSeatData || {};
    for (const k in seats) {
      count++;
      const ts = seats[k]?.timestamp || 0;
      if (ts > maxTs) maxTs = ts;
    }
    return `${maxTs}:${count}`;
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

    // RT-70 / R-7.2: pre-dispatch invariant evaluation. Violations are
    // detected BEFORE _renderFn is invoked. The violations are stamped
    // into coordinator state so the same render frame can surface the "!"
    // badge and affected panels can degrade (show stale-recomputing rather
    // than wrong content). In throwOnViolation mode (tests), the render
    // is blocked entirely and the error surfaces immediately.
    const result = this._invariantChecker.check(snap);
    if (result.violations.length > 0) {
      const now = this._getTimestamp();
      const ts = this._state._violationTimestamps;
      for (const v of result.violations) {
        this.logPipelineEvent('INVARIANT_VIOLATION', v);
        ts.push(now);
      }
      // Prune entries older than the 30s window. Array is append-only with
      // monotonic timestamps, so shift-while-old is O(k) per call where k
      // is the number of expired entries — bounded by render rate * 30s.
      const cutoff = now - 30_000;
      while (ts.length > 0 && ts[0] < cutoff) ts.shift();
      this._state.lastViolationAt = now;
      this._state.violationCountLifetime = (this._state.violationCountLifetime || 0) + result.violations.length;
      if (this._throwOnViolation) {
        this._lastRenderKey = key;
        throw new InvariantViolationError(result.violations);
      }
      // Rebuild snapshot with the fresh violation stamp so the badge
      // renders in this same frame (not deferred to the next render).
      const snapWithViolation = this.buildSnapshot();
      this._lastRenderKey = this.buildRenderKey(snapWithViolation);
      this._state.lastRenderedStreet = snapWithViolation.street;
      this._state.focusedVillainSeat = snapWithViolation.focusedVillainSeat;
      this._renderFn(snapWithViolation, reason);
      return;
    }

    this._lastRenderKey = key;

    // Update lastRenderedStreet in state for next cycle
    this._state.lastRenderedStreet = snap.street;
    // Update focusedVillainSeat in state for external readers
    this._state.focusedVillainSeat = snap.focusedVillainSeat;

    this._renderFn(snap, reason);
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

    // SR-6.7: R-7.3 1-street gap tolerance revoked. Only exact street match
    // is accepted; advice ahead of context is held in _pendingAdvice until
    // live context catches up. Renderer surfaces "stale, recomputing" on
    // mismatch rather than blanking — see side-panel renderAll.
    if (adviceRank >= 0 && liveRank >= 0 && adviceRank === liveRank) {
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

    // SR-6.6 R-4.3: field-level merge mid-hand; full replace at hand boundary.
    // Hand-boundary reset is load-bearing — retaining flop `communityCards`
    // into a new PREFLOP would surface stale board data. Mid-hand, retain
    // fields absent from the new payload (S1: `pot` missing must not null).
    const ts = this._getTimestamp();
    const prior = this._state.currentLiveContext;
    if (isNewHandBoundary || !prior) {
      this._state.currentLiveContext = { ...ctx, _receivedAt: ts };
      this._freshness.currentLiveContextFields = {};
      for (const key of Object.keys(ctx)) {
        this._freshness.currentLiveContextFields[key] = { timestamp: ts, source: 'push_live_context' };
      }
    } else {
      this._state.currentLiveContext = { ...prior, ...ctx, _receivedAt: ts };
      for (const key of Object.keys(ctx)) {
        this._freshness.currentLiveContextFields[key] = { timestamp: ts, source: 'push_live_context' };
      }
    }
    this._freshness.currentLiveContext = { timestamp: ts, source: 'push_live_context' };

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
        // SR-6.7: mid-hand reconnect promotes pending advice only on exact
        // street match. Earlier tolerance (≤1 ahead) is revoked — see
        // handleAdvice for the rationale.
        if (adviceRank >= 0 && liveRank >= 0 && adviceRank === liveRank) {
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
      this._state.moreAnalysisOpen = false;
      this._state.modelAuditOpen = false;
      this._state.lastAutoExpandAdviceAt = null;
      this._state.userToggledPlanPanelInHand = false;
      // STP-1 R-8.1 — plan panel state is per-hand (matches moreAnalysisOpen
      // / modelAuditOpen). Was only cleared on table-switch pre-STP-1.
      this._state.planPanelOpen = false;
      // SR-6.11 §1.11: Rule V override is hand-scoped (spec batch-invariant 4).
      this._state.rangeSelectedSeat = null;
      this.logPipelineEvent('new_hand', `${prevState || 'null'} \u2192 ${newState}`);
      // SR-6.5: fan `handNew` to every registered FSM + extra hooks.
      this.dispatchHandNew();
      // RT-69: force-clear any pending advice at the hand-new boundary. If
      // promotion succeeded earlier this call, pending is already null (no-op).
      // Otherwise a cross-hand pending would otherwise promote on the next
      // coincidental street match — the exact SW-reanimation failure mode.
      this._pendingAdvice = null;
    }
  }

  // =======================================================================
  // TABLE SWITCH (clears per-table state)
  // =======================================================================

  /**
   * Clear per-table state on table switch.
   */
  /**
   * SR-6.6 R-4.3: per-seat field-level merge for appSeatData. Seats absent
   * from `newSeatMap` retain their prior entries (S5: partial exploit push
   * must not null other seats). Bumps `appSeatDataVersion` so renderKey
   * invalidates. Stamps per-seat freshness.
   *
   * Replaces the full-replace-on-push + manual version bump pattern.
   */
  mergeAppSeatData(newSeatMap, source = 'push_exploits') {
    if (!newSeatMap || typeof newSeatMap !== 'object') return;
    const ts = this._getTimestamp();
    const merged = { ...(this._state.appSeatData || {}) };
    for (const [seat, data] of Object.entries(newSeatMap)) {
      merged[seat] = data;
      this._freshness.appSeatData[seat] = { timestamp: ts, source };
    }
    this._state.appSeatData = merged;
    this._state.appSeatDataVersion = (this._state.appSeatDataVersion || 0) + 1;
  }

  clearForTableSwitch() {
    // RT-60: cancel all registered timers before wiping state so no
    // orphan callback can fire on the next table's context.
    this.clearAllTimers();
    // SR-6.5: fan tableSwitch out to every registered FSM so panels collapse
    // to their initial states before the snapshot rebuilds.
    this.dispatchTableSwitch();
    for (const hook of this._tableSwitchHooks) {
      try { hook(); } catch (_) { /* best-effort: one bad hook must not break lifecycle */ }
    }
    this._state.pinnedVillainSeat = null;
    this._state.rangeSelectedSeat = null;
    this._state.lastGoodAdvice = null;
    this._state.lastGoodTournament = null;
    this._state.currentLiveContext = null;
    // SRT-trust: advicePendingForStreet is per-table per-hand. If the table
    // is gone, we're not waiting for advice on it. Leaving this set while
    // currentLiveContext + lastGoodAdvice are null arms R5 permanently and
    // spams the invariant counter every render until a new context arrives
    // (observed: ~30s cadence during probe-flake / grace-expiry cycles).
    this._state.advicePendingForStreet = null;
    // STP-1 R-8.1 — per-table exploit data must not bleed across table
    // switches. Seat references encode the previous table's layout; carrying
    // them over to a new table displays wrong-villain stats and can arm R4
    // (focused-villain warning) or worse, mislead the user on seat-specific
    // reads. Cleared together so no renderer sees an inconsistent subset.
    this._state.lastGoodExploits = null;
    this._state.lastGoodWeaknesses = null;
    this._state.lastGoodBriefings = null;
    this._state.lastGoodObservations = null;
    // STP-1 R-8.1 — hand-snapshot state is per-table. Must clear together:
    // clearing lastHandCount without hasTableHands could arm R1. These are
    // re-populated by the next handlePipelineStatus push.
    this._state.lastHandCount = null;
    this._state.hasTableHands = false;
    this._state.cachedSeatStats = null;
    this._state.cachedSeatMap = null;
    // STP-1 R-8.1 — staleContext is a derived flag from the 60s/120s timer.
    // On table switch we null currentLiveContext, so the "Data may be stale"
    // indicator (gated by `staleContext && liveCtx`) is suppressed anyway —
    // but the flag itself should reset to match. Prevents leftover staleness
    // state from bleeding into the next table's first render frame.
    this._state.staleContext = false;
    this._state._lockedHeroSeat = null;
    this._state._lockedDealerSeat = null;
    this._state._lockedHandNumber = null;
    this._state.userCollapsedSections = new Set();
    this._state.planPanelOpen = false;
    // SR-6.14: reset Z4 collapsibles + auto-expand tracker on table switch.
    this._state.moreAnalysisOpen = false;
    this._state.modelAuditOpen = false;
    this._state.lastAutoExpandAdviceAt = null;
    this._state.userToggledPlanPanelInHand = false;
    this.clearModeATimer();
    this._pendingAdvice = null;
    this._lastStreetCardHtml = null;
    // SR-6.6: freshness follows currentLiveContext lifecycle. appSeatData
    // freshness retained since appSeatData itself is not cleared on table
    // switch (matches existing doctrine).
    this._freshness.currentLiveContext = null;
    this._freshness.currentLiveContextFields = {};
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

  /**
   * Schedule a new timer under `key`. Replaces any existing timer at that key
   * (same contract as registerTimer). Returns the handle for rare callers that
   * need it. This is the preferred API — it keeps bare setTimeout/setInterval
   * calls out of client code so the RT-60 contract is the only way a timer
   * enters the module's lifecycle.
   *
   * SR-6.3: added to eliminate `registerTimer(key, setTimeout(...), kind)`
   * pattern so the enforcement test can forbid bare timer calls outright.
   */
  scheduleTimer(key, cb, ms, kind = 'timeout') {
    const handle = kind === 'interval'
      ? this._setInterval(cb, ms)
      : this._setTimeout(cb, ms);
    this.registerTimer(key, handle, kind);
    return handle;
  }

  /** Returns true if a timer is currently registered under `key`. */
  hasTimer(key) {
    return this._timers.has(key);
  }

  /** Count of active registered timers — introspection for tests. */
  activeTimerCount() {
    return this._timers.size;
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
  // FSM REGISTRY + DISPATCH (SR-6.5)
  //
  // Declarative panel state machines. Each FSM owns one visibility/phase
  // concern (recovery banner, seat popover, deep expander, between-hands,
  // street-card transition). Event handlers dispatch named events; render
  // functions read `snap.panels[id]` and write DOM. This replaces the prior
  // pattern where event handlers mutated DOM directly outside scheduleRender.
  //
  // Lifecycle: `tableSwitch` fans out to every registered FSM on
  // clearForTableSwitch(); `handNew` fans out from handleLiveContext() when
  // the PREFLOP/DEALING boundary fires. Each FSM declares whether those
  // events change state.
  // =======================================================================

  /**
   * Register a declarative FSM. Initializes `_state.panels[id]` to the FSM's
   * initial state. Re-registering the same id is a no-op (idempotent boot).
   */
  registerFsm(fsm) {
    if (!fsm || !fsm.id) throw new Error('registerFsm: fsm.id required');
    if (this._fsms.has(fsm.id)) return;
    this._fsms.set(fsm.id, fsm);
    if (this._state.panels[fsm.id] == null) {
      this._state.panels[fsm.id] = fsm.initial;
    }
  }

  /**
   * Apply an event to a registered FSM. On state change, scheduleRender
   * (IMMEDIATE) so the user-driven or lifecycle-driven transition paints
   * without coalesce delay. Returns the transition descriptor
   * { state, changed, extra? } so callers can read side info (e.g. the
   * seat-popover FSM surfaces `{ seat, coords }` on seatClick).
   *
   * Unknown FSM id / unknown event / same-state result → no render, no throw.
   */
  dispatch(fsmId, event, payload, ctx) {
    const fsm = this._fsms.get(fsmId);
    if (!fsm) return { state: null, changed: false };
    const prev = this._state.panels[fsmId] ?? fsm.initial;
    const result = fsm.transition(prev, event, payload, ctx);
    if (result.changed) {
      this._state.panels[fsmId] = result.state;
    }
    // Seat-popover FSM surfaces { seat, coords } in extra — stash in its
    // own slot so render fns can read without peeking into FSM internals.
    if (fsmId === 'seatPopover') {
      if (result.state === 'shown' && result.extra) {
        this._state.seatPopoverDetail = { seat: result.extra.seat, coords: result.extra.coords };
      } else if (result.state === 'hidden') {
        this._state.seatPopoverDetail = null;
      }
    }
    if (result.changed || (fsmId === 'seatPopover' && result.extra)) {
      this.scheduleRender(`fsm:${fsmId}:${event}`, PRIORITY.IMMEDIATE);
    }
    return result;
  }

  /** Read the current FSM state for a panel. Falls back to FSM.initial. */
  getPanelState(fsmId) {
    if (this._state.panels[fsmId] != null) return this._state.panels[fsmId];
    const fsm = this._fsms.get(fsmId);
    return fsm ? fsm.initial : null;
  }

  /**
   * Fan a `tableSwitch` event out to every registered FSM. Called from
   * clearForTableSwitch; also available for direct invocation from tests.
   */
  dispatchTableSwitch() {
    for (const fsm of this._fsms.values()) {
      const prev = this._state.panels[fsm.id] ?? fsm.initial;
      const result = fsm.transition(prev, 'tableSwitch');
      if (result.changed) this._state.panels[fsm.id] = result.state;
      if (fsm.id === 'seatPopover' && result.state === 'hidden') {
        this._state.seatPopoverDetail = null;
      }
    }
  }

  /**
   * Fan a `handNew` event out to every registered FSM. Invoked by
   * handleLiveContext when a PREFLOP/DEALING boundary is detected.
   */
  dispatchHandNew() {
    for (const fsm of this._fsms.values()) {
      const prev = this._state.panels[fsm.id] ?? fsm.initial;
      const result = fsm.transition(prev, 'handNew');
      if (result.changed) this._state.panels[fsm.id] = result.state;
      if (fsm.id === 'seatPopover' && result.state === 'hidden') {
        this._state.seatPopoverDetail = null;
      }
    }
    for (const hook of this._handNewHooks) {
      try { hook(); } catch (_) { /* best-effort */ }
    }
  }

  /** Register an extra `hand:new` callback for non-FSM consumers. */
  onHandNew(fn) {
    if (typeof fn === 'function') this._handNewHooks.push(fn);
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
