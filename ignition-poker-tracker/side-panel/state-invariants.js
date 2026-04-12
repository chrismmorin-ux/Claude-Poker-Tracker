/**
 * state-invariants.js — Runtime state invariant checker for the side panel.
 *
 * Validates 10 consistency rules on every render snapshot. Violations are
 * logged in production and thrown in test mode. This is the "Design by
 * Contract" layer that makes state bugs self-detecting.
 *
 * Usage:
 *   const checker = new StateInvariantChecker();
 *   const result = checker.check(snapshot);
 *   // result.violations: string[] — hard violations (bugs)
 *   // result.warnings: string[] — soft inconsistencies
 */

import { STREET_RANK } from '../shared/constants.js';

const LIVE_STATES = new Set(['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'DEALING']);

export class StateInvariantChecker {
  /**
   * @param {Object} [deps]
   * @param {() => any[]} [deps.getPipelineEvents] - Accessor for the
   *   coordinator's pipelineEvents ring buffer. Rule 10 uses this instead
   *   of reading from the snapshot, because pipelineEvents is
   *   intentionally excluded from buildSnapshot() (it changes on every
   *   push and would force re-renders on every diagnostic event).
   */
  constructor(deps = {}) {
    this._getPipelineEvents = deps.getPipelineEvents || null;
  }

  /**
   * Check all invariants against a snapshot.
   * @param {Object} snap - Coordinator snapshot from buildSnapshot()
   * @returns {{ violations: string[], warnings: string[] }}
   */
  check(snap) {
    const violations = [];
    const warnings = [];

    this._rule1_hudVisibility(snap, violations);
    this._rule2_streetNonNull(snap, violations);
    this._rule3_adviceStreetMatch(snap, violations, warnings);
    this._rule4_focusedVillainActive(snap, violations, warnings);
    this._rule5_pendingAdviceNotStuck(snap, violations);
    this._rule6_pinnedNotHero(snap, violations);
    this._rule7_versionMonotonic(snap, warnings);
    this._rule8_heroSeatValid(snap, violations);
    this._rule9_adviceNotSelf(snap, violations);
    this._rule10_pipelineEventsCapped(snap, violations);

    return { violations, warnings };
  }

  // =========================================================================
  // RULE 1: HUD visibility consistency
  // If we have table hands AND an active table, hasTableHands must be true
  // =========================================================================
  _rule1_hudVisibility(snap, violations) {
    if (snap.lastHandCount > 0 && snap.currentActiveTableId && !snap.hasTableHands) {
      violations.push(
        `R1: hasTableHands=false but lastHandCount=${snap.lastHandCount} and activeTable=${snap.currentActiveTableId}`
      );
    }
  }

  // =========================================================================
  // RULE 2: Street must be non-null during live hand
  // If liveContext state is a playing state, street must resolve
  // =========================================================================
  _rule2_streetNonNull(snap, violations) {
    const state = snap.currentLiveContext?.state;
    if (state && LIVE_STATES.has(state) && state !== 'DEALING' && !snap.street) {
      violations.push(
        `R2: live state=${state} but street is null (no currentStreet in context or advice)`
      );
    }
  }

  // =========================================================================
  // RULE 3: Advice street must be compatible with live context street
  // Advice street must match or be at most 1 ahead of context street
  // =========================================================================
  _rule3_adviceStreetMatch(snap, violations, warnings) {
    const advice = snap.lastGoodAdvice;
    const ctx = snap.currentLiveContext;
    if (!advice || !ctx?.currentStreet) return;

    const advRank = STREET_RANK[advice.currentStreet] ?? -1;
    const ctxRank = STREET_RANK[ctx.currentStreet] ?? -1;
    if (advRank < 0 || ctxRank < 0) return;

    // Advice can lag 1 street behind (previous street's analysis displayed while
    // waiting for new advice). But >1 street behind is stale cross-hand contamination.
    if (advRank < ctxRank - 1) {
      violations.push(
        `R3: advice street=${advice.currentStreet}(${advRank}) >1 behind context street=${ctx.currentStreet}(${ctxRank})`
      );
    } else if (advRank - ctxRank > 1) {
      violations.push(
        `R3: advice street=${advice.currentStreet}(${advRank}) >1 ahead of context street=${ctx.currentStreet}(${ctxRank})`
      );
    } else if (advRank < ctxRank) {
      warnings.push(
        `R3: advice street=${advice.currentStreet} is 1 behind context street=${ctx.currentStreet} (stale but tolerable)`
      );
    }
  }

  // =========================================================================
  // RULE 4: Focused villain must be in active seats (if context exists)
  // =========================================================================
  _rule4_focusedVillainActive(snap, violations, warnings) {
    const focused = snap.focusedVillainSeat;
    const ctx = snap.currentLiveContext;
    if (focused == null || !ctx?.activeSeatNumbers) return;

    if (!ctx.activeSeatNumbers.includes(focused) && !(ctx.foldedSeats || []).includes(focused)) {
      // Villain not in active OR folded — ghost seat
      warnings.push(
        `R4: focusedVillain=${focused} not in activeSeatNumbers=[${ctx.activeSeatNumbers}] or foldedSeats=[${ctx.foldedSeats || []}]`
      );
    }
  }

  // =========================================================================
  // RULE 5: advicePendingForStreet without context is a stuck state
  // =========================================================================
  _rule5_pendingAdviceNotStuck(snap, violations) {
    if (snap.advicePendingForStreet && !snap.currentLiveContext && !snap.lastGoodAdvice) {
      violations.push(
        `R5: advicePendingForStreet=${snap.advicePendingForStreet} but currentLiveContext=null and lastGoodAdvice=null (stuck waiting)`
      );
    }
  }

  // =========================================================================
  // RULE 6: Pinned villain must not be hero's own seat
  // =========================================================================
  _rule6_pinnedNotHero(snap, violations) {
    const pinned = snap.pinnedVillainSeat;
    const heroSeat = snap.currentLiveContext?.heroSeat;
    if (pinned != null && heroSeat != null && pinned === heroSeat) {
      violations.push(
        `R6: pinnedVillainSeat=${pinned} equals heroSeat=${heroSeat}`
      );
    }
  }

  // =========================================================================
  // RULE 7: appSeatDataVersion must only increase (monotonic)
  // Tracked across calls — requires instance state
  // =========================================================================
  _lastSeenVersion = -1;

  _rule7_versionMonotonic(snap, warnings) {
    const v = snap.appSeatDataVersion;
    if (v < this._lastSeenVersion) {
      warnings.push(
        `R7: appSeatDataVersion regressed from ${this._lastSeenVersion} to ${v}`
      );
    }
    this._lastSeenVersion = v;
  }

  // =========================================================================
  // RULE 8: heroSeat must be in valid range [1,9]
  // =========================================================================
  _rule8_heroSeatValid(snap, violations) {
    const seat = snap.currentLiveContext?.heroSeat;
    if (seat != null && (seat < 1 || seat > 9 || !Number.isInteger(seat))) {
      violations.push(
        `R8: heroSeat=${seat} is outside valid range [1,9] or not integer`
      );
    }
  }

  // =========================================================================
  // RULE 9: Advice villain must not be hero
  // =========================================================================
  _rule9_adviceNotSelf(snap, violations) {
    const villainSeat = snap.lastGoodAdvice?.villainSeat;
    const heroSeat = snap.currentLiveContext?.heroSeat;
    if (villainSeat != null && heroSeat != null && villainSeat === heroSeat) {
      violations.push(
        `R9: advice villainSeat=${villainSeat} equals heroSeat=${heroSeat}`
      );
    }
  }

  // =========================================================================
  // RULE 10: Pipeline events must be capped
  // =========================================================================
  _rule10_pipelineEventsCapped(snap, violations) {
    // RT-66: read live ring buffer via coordinator accessor (preferred) so
    // Rule 10 actually fires. snap.pipelineEvents remains supported as a
    // backward-compat fallback for any test that injects pipelineEvents
    // directly.
    const events = this._getPipelineEvents
      ? this._getPipelineEvents()
      : snap.pipelineEvents;
    if (events && events.length > 50) {
      violations.push(
        `R10: pipelineEvents length=${events.length} exceeds cap of 50`
      );
    }
  }

  /** Reset stateful tracking (for test isolation). */
  reset() {
    this._lastSeenVersion = -1;
  }
}

/**
 * Error thrown when invariant violations are detected in test mode.
 */
export class InvariantViolationError extends Error {
  constructor(violations) {
    super(`Invariant violations:\n  ${violations.join('\n  ')}`);
    this.name = 'InvariantViolationError';
    this.violations = violations;
  }
}
