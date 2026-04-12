/**
 * message-harness.js — HarnessRunner for message-level integration testing.
 *
 * Replicates the side-panel.js IIFE handler logic in a testable form.
 * Feeds raw push_* messages through a real RenderCoordinator and records
 * all state transitions and renders.
 *
 * Does NOT import from side-panel.js (untestable IIFE). Instead, it
 * mirrors the handler patterns and delegates to the same coordinator.
 */

import { RenderCoordinator, PRIORITY } from '../render-coordinator.js';

// =========================================================================
// HARNESS RUNNER
// =========================================================================

export class HarnessRunner {
  constructor(opts = {}) {
    this.renders = [];
    this.renderCount = 0;

    this.coord = new RenderCoordinator({
      renderFn: (snap, reason) => {
        this.renderCount++;
        this.renders.push({ snap: { ...snap }, reason, at: Date.now(), index: this.renderCount });
      },
      getTimestamp: () => Date.now(),
      requestFrame: (cb) => setTimeout(cb, 0),
      setTimeout: (cb, ms) => setTimeout(cb, ms),
      clearTimeout: (id) => clearTimeout(id),
    }, { coalesceMs: opts.coalesceMs ?? 80 });

    // Infrastructure state (mirrors side-panel.js Category B vars)
    this._tableGraceTimer = null;
    this._refreshInFlight = false;
  }

  // =======================================================================
  // MESSAGE DISPATCH
  // =======================================================================

  /**
   * Feed a raw push_* message through the handler pipeline.
   * Replicates what the IIFE's conn.onMessage handler does.
   */
  push(message) {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'push_live_context':
        this._handleLiveContext(message);
        break;
      case 'push_action_advice':
        this._handleAdvice(message);
        break;
      case 'push_pipeline_status':
        this._handlePipelineStatus(message);
        break;
      case 'push_exploits':
        this._handleExploits(message);
        break;
      case 'push_pipeline_diagnostics':
        this._handleDiag(message);
        break;
      case 'push_tournament':
        this._handleTournament(message);
        break;
      case 'push_hands_updated':
        this._handleHandsUpdated(message);
        break;
      case 'push_recovery_needed':
        this.coord.set('recoveryMessage', message.message || 'Recovery needed');
        this._scheduleRender('recovery_needed');
        break;
      case 'push_recovery_cleared':
        this.coord.set('recoveryMessage', null);
        this._scheduleRender('recovery_cleared');
        break;
      case 'push_silence_alert':
        this.coord.set('recoveryMessage', message.message || 'Connection stale');
        this._scheduleRender('silence_alert');
        break;
      default:
        break;
    }
  }

  // =======================================================================
  // HANDLERS (mirror side-panel.js patterns)
  // =======================================================================

  _handleLiveContext(message) {
    if (!message.context) return;
    this.coord.set('staleContext', false);
    this.coord.handleLiveContext(message.context);
    this._scheduleRender('live_context');
  }

  _handleAdvice(message) {
    if (!message.advice) return;
    // RT-45: mirror production handleAdvicePush — stamp current hand number
    // so the guard can detect cross-hand cache replay.
    const stampedAdvice = {
      ...message.advice,
      handNumber: message.advice.handNumber
        ?? this.coord.get('currentLiveContext')?.handNumber
        ?? null,
    };
    const accepted = this.coord.handleAdvice(stampedAdvice);
    if (accepted) {
      this._scheduleRender('advice', PRIORITY.IMMEDIATE);
    } else {
      this._scheduleRender('advice_held');
    }
  }

  _handlePipelineStatus(message) {
    const pipeline = message;
    this.coord.set('lastPipeline', pipeline);

    const tableEntries = Object.entries(pipeline.tables || {});
    const prevTableId = this.coord.get('currentActiveTableId');

    if (tableEntries.length > 0) {
      const [connId, tableState] = tableEntries[0];
      const newTableId = `table_${connId}`;

      // Cancel grace timer if tables came back
      if (this._tableGraceTimer) {
        clearTimeout(this._tableGraceTimer);
        this._tableGraceTimer = null;
      }

      // Table switch detection
      if (prevTableId && prevTableId !== newTableId) {
        this.coord.clearForTableSwitch();
      }

      this.coord.set('currentActiveTableId', newTableId);
      this.coord.set('currentTableState', tableState);
    } else if (prevTableId && !this._tableGraceTimer) {
      // Tables empty — start 5s grace period
      this._tableGraceTimer = setTimeout(() => {
        this._tableGraceTimer = null;
        this.coord.set('currentActiveTableId', null);
        this.coord.set('currentTableState', null);
        this.coord.clearForTableSwitch();
        this._scheduleRender('table_grace_expired');
      }, 5000);
    }

    // RT-59: route through handleLiveContext so position-lock,
    // _receivedAt injection, and pending-advice promotion apply on both
    // push paths (mirrors production handlePipelineStatus).
    if (pipeline.liveContext) {
      this.coord.handleLiveContext(pipeline.liveContext);
    }

    this._scheduleRender('pipeline_status');
  }

  _handleExploits(message) {
    const seats = message.seats || [];
    const appConnected = message.appConnected !== false;

    this.coord.set('exploitPushCount', this.coord.get('exploitPushCount') + 1);
    this.coord.set('lastGoodExploits', { seats, appConnected });

    // Build appSeatData map
    const appSeatData = {};
    for (const s of seats) {
      appSeatData[s.seat] = {
        style: s.style,
        sampleSize: s.sampleSize,
        exploits: s.exploits || [],
        weaknesses: s.weaknesses || [],
        briefings: s.briefings || [],
        observations: s.observations || [],
        stats: s.stats || {},
        villainHeadline: s.villainHeadline || null,
        villainProfile: s.villainProfile || null,
      };
    }
    this.coord.set('appSeatData', appSeatData);
    this.coord.set('appSeatDataVersion', this.coord.get('appSeatDataVersion') + 1);

    // Extract per-type arrays
    const allWeaknesses = seats.flatMap(s => (s.weaknesses || []).map(w => ({ ...w, seat: s.seat })));
    const allBriefings = seats.flatMap(s => (s.briefings || []).map(b => ({ ...b, seat: s.seat })));
    const allObservations = seats.flatMap(s => (s.observations || []).map(o => ({ ...o, seat: s.seat })));

    this.coord.set('lastGoodWeaknesses', allWeaknesses);
    this.coord.set('lastGoodBriefings', allBriefings);
    this.coord.set('lastGoodObservations', allObservations);

    this._scheduleRender('exploits');
  }

  _handleDiag(message) {
    this.coord.set('cachedDiag', message.data);
    // Clear recovery if traffic is flowing
    if (message.data?.gameWsMessageCount > 0) {
      this.coord.set('recoveryMessage', null);
    }
    this._scheduleRender('diagnostics');
  }

  _handleTournament(message) {
    this.coord.set('lastGoodTournament', message.tournament);
    this._scheduleRender('tournament');
  }

  _handleHandsUpdated(message) {
    // In the real IIFE, this triggers refreshHandStats (async storage read).
    // In tests, we skip the storage read and just bump the hand count.
    const currentCount = this.coord.get('lastHandCount');
    this.coord.set('lastHandCount', message.totalHands ?? currentCount + 1);
    this.coord.set('hasTableHands', true);
    this._scheduleRender('hands_updated');
  }

  // =======================================================================
  // SCHEDULING
  // =======================================================================

  _scheduleRender(reason, priority = PRIORITY.NORMAL) {
    this.coord.scheduleRender(reason, priority);
  }

  // =======================================================================
  // TEST UTILITIES
  // =======================================================================

  /** Force all pending renders to execute. Returns renders since creation. */
  flush() {
    this.coord.flush();
    return this.renders;
  }

  /** Get current coordinator snapshot. */
  snapshot() {
    return this.coord.buildSnapshot();
  }

  /** Get the most recent render. */
  lastRender() {
    return this.renders[this.renders.length - 1] ?? null;
  }

  /** Get the most recent render's snapshot. */
  lastSnap() {
    return this.lastRender()?.snap ?? null;
  }

  /** Get total render count. */
  totalRenders() {
    return this.renderCount;
  }

  /** Clear render history (keeps state). */
  clearRenders() {
    this.renders = [];
  }

  /** Reset to clean state. */
  reset() {
    this.renders = [];
    this.renderCount = 0;
    if (this._tableGraceTimer) {
      clearTimeout(this._tableGraceTimer);
      this._tableGraceTimer = null;
    }
    // Reset coordinator to default state
    this.coord.merge({
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
      appSeatDataVersion: 0,
      staleContext: false,
      hasTableHands: true,
    });
    this.coord.resetRenderKey();
  }

  /** Destroy and clean up timers. */
  destroy() {
    if (this._tableGraceTimer) {
      clearTimeout(this._tableGraceTimer);
      this._tableGraceTimer = null;
    }
    this.coord.destroy();
  }
}
