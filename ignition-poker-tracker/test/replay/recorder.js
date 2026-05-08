/**
 * recorder.js — synthetic corpus generators for SR-1.
 *
 * Each builder returns { events: [...], label: {...} } where:
 *   events[i] = { t, type, message? }  // t is monotonic ms from start
 *   label     = metadata for the .yml sibling
 *
 * `type: 'inject'` → deliver `message` to side-panel's port listener.
 * `type: 'advance'` → advance the fake clock by `ms` (implicit between inject events).
 *
 * These are SEEDED from shared/__tests__/fixtures/payloads.js and
 * side-panel/__tests__/fixtures.js — we do not duplicate those shapes, we
 * re-express them at the port-message boundary.
 */

// Minimal seat stats shape matching shared/stats-engine.js output
const makePhysStats = (seat, vpip, pfr, af, style, sampleSize) => ({
  seat, vpip, pfr, af, style, sampleSize,
  hands: { total: sampleSize, preflop: sampleSize, flop: Math.round(sampleSize * 0.4) },
});

/**
 * Build a minimal hand record for seeding chrome.storage.session['side_panel_hands'].
 * `computeAllSeatStats` only needs `gameState.actionSequence` with { seat, action, amount }.
 * The tableId must match `table_<connId>` from the pipeline status (connId='1' → 'table_1').
 */
export function makeSeedHand(tableId, actions, capturedAt = 1_700_000_000_000) {
  return {
    tableId,
    capturedAt,
    gameState: { actionSequence: actions },
  };
}

/**
 * Standard pipeline status message for table connId='1'.
 * Also used by multiple corpora — keep in sync.
 */
export const PIPELINE_STATUS_TABLE_1 = {
  type: 'push_pipeline_status',
  status: {
    tables: { '1': { state: 'active' } },
    tableCount: 1,
    completedHands: 1,
  },
};

/**
 * S1 — partial appSeatData payload causing `$0` bet badge.
 *
 * Mechanism: side-panel/render-orchestrator.js renders bet/raise amounts as
 * `$${amount.toFixed(0)}`. A bet amount of 0 < x < 0.5 (e.g. 0.4) renders as "$0".
 * Fractional amounts do occur in real traffic (pennies, SB rounding).
 *
 * To make the seat arc render, we seed session storage with hands for table_1
 * so refreshHandStats can compute cachedSeatStats. Without it, renderSeatArc is
 * never called (renderAll gates on cachedSeatStats being non-null).
 */
export function buildS1Partial() {
  const liveContext = {
    state: 'FLOP',
    currentStreet: 'flop',
    handNumber: 1001,
    heroSeat: 5,
    communityCards: ['A\u2660', 'K\u2665', '7\u2663', '', ''],
    holeCards: ['Q\u2660', 'J\u2660'],
    pot: 18.5,
    activeSeatNumbers: [1, 3, 5, 7],
    foldedSeats: [],
    dealerSeat: 3,
    pfAggressor: 3,
    // The payload includes a fractional bet amount — this is the S1 trigger.
    actionSequence: [
      { seat: 3, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 6, street: 'preflop', order: 2 },
      { seat: 3, action: 'bet', amount: 0.4, street: 'flop', order: 3 }, // ← $0 trigger
    ],
  };

  const exploitsPartial = {
    appConnected: true,
    seats: [
      { seat: 1, style: 'Fish', sampleSize: 30, exploits: [], weaknesses: [] },
      { seat: 3, style: 'TAG', sampleSize: 45, exploits: [], weaknesses: [] },
      // seat 7 intentionally omitted on first push — partial payload
    ],
  };

  const exploitsFull = {
    appConnected: true,
    seats: [
      ...exploitsPartial.seats,
      { seat: 7, style: 'Fish', sampleSize: 15, exploits: [], weaknesses: [] },
    ],
  };

  // Seed hands so computeAllSeatStats produces non-null cachedSeatStats.
  // Seats 1, 3, 5, 7 appear in prior hands — this unblocks renderSeatArc.
  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 1, action: 'fold', amount: 0 },
      { seat: 3, action: 'raise', amount: 6 },
      { seat: 5, action: 'call', amount: 6 },
      { seat: 7, action: 'fold', amount: 0 },
    ]),
    makeSeedHand('table_1', [
      { seat: 1, action: 'call', amount: 3 },
      { seat: 3, action: 'raise', amount: 9 },
      { seat: 5, action: 'fold', amount: 0 },
      { seat: 7, action: 'call', amount: 9 },
    ]),
  ];

  const events = [
    // pipeline_status sets currentActiveTableId='table_1' and calls refreshHandStats,
    // which reads the pre-seeded hands and populates cachedSeatStats.
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,  type: 'inject', message: { type: 'push_live_context', context: liveContext } },
    { t: 100, type: 'inject', message: { type: 'push_exploits', ...exploitsPartial } },
    { t: 250, type: 'inject', message: { type: 'push_exploits', ...exploitsFull } },
    { t: 400, type: 'snapshot' }, // request final snapshot
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S1-partial-fractional-bet',
      symptomsTargeted: ['S1'],
      source: 'synthetic',
      sanitized: true,
      handCount: 1,
      duration_ms: 400,
      mechanism: 'actionSequence contains amount=0.4; toFixed(0) → "0" → "$0" badge in seat-action-tag',
    },
  };
}

/**
 * S2 — advice.street one rank behind liveContext.street.
 *
 * Mechanism: render-coordinator.js:429 permits 1-street rank gap; plan-panel
 * renders flop content while the board is on turn.
 */
export function buildS2StreetMismatch() {
  const flopCtx = {
    state: 'FLOP', currentStreet: 'flop', handNumber: 2001, heroSeat: 5,
    communityCards: ['A\u2660', 'K\u2665', '7\u2663', '', ''],
    holeCards: ['Q\u2660', 'J\u2660'], pot: 18.5,
    activeSeatNumbers: [3, 5], foldedSeats: [1, 7], dealerSeat: 3, pfAggressor: 3,
    actionSequence: [{ seat: 3, action: 'bet', amount: 12, street: 'flop', order: 1 }],
  };
  const turnCtx = { ...flopCtx, state: 'TURN', currentStreet: 'turn',
    communityCards: ['A\u2660', 'K\u2665', '7\u2663', '2\u2663', ''], pot: 42.5,
    actionSequence: [...flopCtx.actionSequence, { seat: 5, action: 'call', amount: 12, street: 'flop', order: 2 }],
  };

  const flopAdvice = {
    handNumber: 2001, currentStreet: 'flop', villainSeat: 3, villainStyle: 'TAG',
    potSize: 18.5, heroEquity: 0.58, foldPct: { bet: 0.35 },
    recommendations: [{
      action: 'call', ev: 1.8, reasoning: 'Flop call — draw equity',
      // handPlan required for buildPlanPanelHTML to produce non-empty HTML
      handPlan: {
        ifCall: { note: 'Continue with draw equity; reassess turn', scaryCards: 2 },
      },
    }],
    treeMetadata: { depthReached: 2, spr: 4.2, branches: 4 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 3, action: 'raise', amount: 9 },
      { seat: 5, action: 'call', amount: 9 },
    ]),
  ];

  const events = [
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,  type: 'inject', message: { type: 'push_live_context', context: flopCtx } },
    { t: 100, type: 'inject', message: { type: 'push_action_advice', advice: flopAdvice } },
    // Turn arrives; flop advice is still active (no new advice yet)
    { t: 400, type: 'inject', message: { type: 'push_live_context', context: turnCtx } },
    { t: 500, type: 'snapshot' },
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S2-advice-street-lag',
      symptomsTargeted: ['S2'],
      source: 'synthetic',
      sanitized: true,
      handCount: 1,
      duration_ms: 500,
      mechanism: 'advice.street=flop while liveContext.street=turn; 1-street gap permitted',
    },
  };
}

/**
 * S3 — plan-panel visible→hidden race (advice cleared on new-hand boundary).
 *
 * Mechanism: render-coordinator.js clears `lastGoodAdvice` to null when
 * state transitions to PREFLOP/DEALING (new hand boundary). If a new hand
 * starts quickly after the previous hand's advice was displayed, plan-panel
 * transitions visible→hidden within a tight window — erasing what the user
 * was reading mid-review.
 *
 * S3 signature: plan-panel transitions visible→hidden within 200ms with
 * no intervening user event (adjacent snapshot pairs, t diff < 200ms).
 */
export function buildS3PlanPanelRace() {
  // Hand 3001: hero raised preflop, got advice, flop ran out
  const flopCtx = {
    state: 'FLOP', currentStreet: 'flop', handNumber: 3001, heroSeat: 5,
    communityCards: ['T\u2660', '7\u2665', '2\u2663', '', ''],
    holeCards: ['A\u2660', 'K\u2660'], pot: 18,
    activeSeatNumbers: [3, 5], foldedSeats: [7], dealerSeat: 7, pfAggressor: 5,
    actionSequence: [
      { seat: 5, action: 'raise', amount: 9, street: 'preflop', order: 1 },
      { seat: 3, action: 'call', amount: 9, street: 'preflop', order: 2 },
    ],
  };

  const flopAdvice = {
    handNumber: 3001, currentStreet: 'flop', villainSeat: 3, villainStyle: 'Fish',
    potSize: 18, heroEquity: 0.72, foldPct: { bet: 0.45 },
    recommendations: [{
      action: 'bet', ev: 3.1, reasoning: 'Value bet with top pair top kicker',
      handPlan: {
        ifCall: { note: 'Bet turn again on non-scare cards', scaryCards: 1 },
        nextStreet: { note: 'Reassess vs villain range', scaryCards: 0 },
      },
    }],
    treeMetadata: { depthReached: 2, spr: 3.8, branches: 4 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  // New hand 3002 starts 100ms later — clears lastGoodAdvice → plan panel hides
  const newHandCtx = {
    state: 'PREFLOP', currentStreet: 'preflop', handNumber: 3002, heroSeat: 5,
    communityCards: ['', '', '', '', ''],
    holeCards: ['Q\u2660', 'J\u2660'], pot: 3,
    activeSeatNumbers: [3, 5, 7], foldedSeats: [], dealerSeat: 3, pfAggressor: null,
    actionSequence: [],
  };

  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 3, action: 'call', amount: 6 },
      { seat: 5, action: 'raise', amount: 9 },
      { seat: 7, action: 'fold', amount: 0 },
    ]),
    makeSeedHand('table_1', [
      { seat: 3, action: 'raise', amount: 6 },
      { seat: 5, action: 'call', amount: 6 },
      { seat: 7, action: 'fold', amount: 0 },
    ]),
  ];

  const events = [
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,  type: 'inject', message: { type: 'push_live_context', context: flopCtx } },
    { t: 100, type: 'inject', message: { type: 'push_action_advice', advice: flopAdvice } },
    // Snapshot after advice push: plan-panel should be visible
    { t: 120, type: 'snapshot' },
    // New hand arrives 70ms later — clears advice (PREFLOP state transition)
    { t: 150, type: 'inject', message: { type: 'push_live_context', context: newHandCtx } },
    // Snapshot 70ms after first one: plan-panel should now be hidden
    { t: 190, type: 'snapshot' },
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S3-plan-panel-race',
      symptomsTargeted: ['S3'],
      source: 'synthetic',
      sanitized: true,
      handCount: 2,
      duration_ms: 190,
      mechanism: 'new PREFLOP hand at t=150 clears lastGoodAdvice → plan-panel hides within 70ms of first snapshot',
    },
  };
}

/**
 * S4 — between-hands visible during live hand (race window / stale DOM).
 *
 * Mechanism: After a COMPLETE hand, renderBetweenHands paints the panel.
 * When a new PREFLOP hand arrives, `scheduleRender('live_context')` queues
 * an 80ms coalesce render. During that 80ms window, the between-hands panel
 * is still visible from the previous render pass while `liveContext` already
 * carries the new handNumber. This "stale DOM in the render gap" is the
 * race-window variant of the between-hands overlap symptom.
 *
 * S4 signature: betweenHandsVisible=true at same snapshot as new handNumber.
 * Uses `fast_snapshot` to capture DOM state before the coalesce render fires.
 */
export function buildS4BetweenHandsOverlap() {
  // End of hand 4000 — COMPLETE state → between-hands WAITING mode
  const endOfHandCtx = {
    state: 'COMPLETE', currentStreet: 'river', handNumber: 4000, heroSeat: 5,
    communityCards: ['A\u2660', 'K\u2665', '7\u2663', '2\u2663', 'J\u2665'],
    holeCards: ['Q\u2660', 'J\u2660'], pot: 80,
    activeSeatNumbers: [], foldedSeats: [1, 3, 7], dealerSeat: 3, pfAggressor: 3,
    actionSequence: [],
  };

  // New hand 4001 — PREFLOP context, new handNumber
  const newHandCtx = {
    state: 'PREFLOP', currentStreet: 'preflop', handNumber: 4001, heroSeat: 5,
    communityCards: ['', '', '', '', ''],
    holeCards: ['K\u2665', 'Q\u2665'], pot: 3,
    activeSeatNumbers: [1, 3, 5], foldedSeats: [], dealerSeat: 1, pfAggressor: null,
    actionSequence: [],
  };

  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 1, action: 'fold', amount: 0 },
      { seat: 3, action: 'raise', amount: 6 },
      { seat: 5, action: 'call', amount: 6 },
    ]),
    makeSeedHand('table_1', [
      { seat: 1, action: 'call', amount: 3 },
      { seat: 3, action: 'raise', amount: 9 },
      { seat: 5, action: 'call', amount: 9 },
    ]),
  ];

  const events = [
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    // End-of-hand COMPLETE: full snapshot confirms between-hands is visible
    { t: 50,  type: 'inject', message: { type: 'push_live_context', context: endOfHandCtx } },
    { t: 200, type: 'snapshot' }, // between-hands should be visible here
    // New hand PREFLOP arrives: schedules 80ms coalesce render, doesn't fire immediately
    { t: 300, type: 'inject', message: { type: 'push_live_context', context: newHandCtx } },
    // fast_snapshot: drains rAF (~20ms) only — coalesce hasn't fired yet.
    // DOM still shows COMPLETE-hand render (between-hands visible).
    // lastMessages.context.handNumber is already 4001.
    { t: 320, type: 'fast_snapshot' },
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S4-between-hands-overlap',
      symptomsTargeted: ['S4'],
      source: 'synthetic',
      sanitized: true,
      handCount: 2,
      duration_ms: 320,
      mechanism: 'fast_snapshot captures 80ms render-gap: between-hands DOM is stale while context.handNumber=4001',
    },
  };
}

/**
 * S5 — excessive DOM mutations per render pass.
 *
 * Mechanism: classList.toggle() + full innerHTML replacements fire on every
 * renderAll() call even when content is identical. In a fast-updating hand
 * (many pushes in quick succession), mutation rate spikes.
 *
 * S5 signature: mutations/snapshot ratio > 50.
 */
export function buildS5ExcessiveMutations() {
  const baseCtx = {
    state: 'FLOP', currentStreet: 'flop', handNumber: 5001, heroSeat: 5,
    communityCards: ['A\u2660', 'K\u2665', '7\u2663', '', ''],
    holeCards: ['Q\u2660', 'J\u2660'], pot: 18.5,
    activeSeatNumbers: [1, 3, 5, 7, 9], foldedSeats: [],
    dealerSeat: 3, pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'bet', amount: 9, street: 'flop', order: 1 },
    ],
  };

  const advice = {
    handNumber: 5001, currentStreet: 'flop', villainSeat: 3, villainStyle: 'TAG',
    potSize: 18.5, heroEquity: 0.55, foldPct: { raise: 0.4, fold: 0.3 },
    recommendations: [{
      action: 'call', ev: 1.2, reasoning: 'Flop call with equity',
      handPlan: {
        ifCall: { note: 'Take free card on turn if checked to', scaryCards: 1 },
      },
    }],
    treeMetadata: { depthReached: 2, spr: 3.5, branches: 4 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 1, action: 'fold', amount: 0 },
      { seat: 3, action: 'raise', amount: 6 },
      { seat: 5, action: 'call', amount: 6 },
      { seat: 7, action: 'fold', amount: 0 },
      { seat: 9, action: 'call', amount: 6 },
    ]),
    makeSeedHand('table_1', [
      { seat: 1, action: 'call', amount: 3 },
      { seat: 3, action: 'raise', amount: 9 },
      { seat: 5, action: 'call', amount: 9 },
      { seat: 7, action: 'fold', amount: 0 },
      { seat: 9, action: 'fold', amount: 0 },
    ]),
    makeSeedHand('table_1', [
      { seat: 1, action: 'fold', amount: 0 },
      { seat: 3, action: 'raise', amount: 12 },
      { seat: 5, action: 'call', amount: 12 },
      { seat: 7, action: 'call', amount: 12 },
      { seat: 9, action: 'fold', amount: 0 },
    ]),
  ];

  // Rapid fire: 10 consecutive updates in 200ms — same content, should deduplicate
  const events = [
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,  type: 'inject', message: { type: 'push_live_context', context: baseCtx } },
    { t: 80,  type: 'inject', message: { type: 'push_action_advice', advice } },
    // Rapid repeated exploit pushes (simulates SW sending updates every 20ms)
    { t: 100, type: 'inject', message: { type: 'push_exploits', appConnected: true, seats: [{ seat: 1, style: 'Fish', sampleSize: 30, exploits: [], weaknesses: [] }] } },
    { t: 120, type: 'inject', message: { type: 'push_exploits', appConnected: true, seats: [{ seat: 1, style: 'Fish', sampleSize: 30, exploits: [], weaknesses: [] }, { seat: 3, style: 'TAG', sampleSize: 45, exploits: [], weaknesses: [] }] } },
    { t: 140, type: 'inject', message: { type: 'push_exploits', appConnected: true, seats: [{ seat: 1, style: 'Fish', sampleSize: 30, exploits: [], weaknesses: [] }, { seat: 3, style: 'TAG', sampleSize: 45, exploits: [], weaknesses: [] }, { seat: 7, style: 'Nit', sampleSize: 20, exploits: [], weaknesses: [] }] } },
    { t: 160, type: 'inject', message: { type: 'push_live_context', context: { ...baseCtx, pot: 19 } } },
    { t: 180, type: 'inject', message: { type: 'push_live_context', context: { ...baseCtx, pot: 19 } } },
    { t: 200, type: 'inject', message: { type: 'push_exploits', appConnected: true, seats: [{ seat: 1, style: 'Fish', sampleSize: 30, exploits: [], weaknesses: [] }, { seat: 3, style: 'TAG', sampleSize: 45, exploits: [], weaknesses: [] }, { seat: 7, style: 'Nit', sampleSize: 20, exploits: [], weaknesses: [] }, { seat: 9, style: 'LP', sampleSize: 12, exploits: [], weaknesses: [] }] } },
    { t: 220, type: 'inject', message: { type: 'push_live_context', context: { ...baseCtx, pot: 19 } } },
    { t: 240, type: 'inject', message: { type: 'push_exploits', appConnected: true, seats: [{ seat: 1, style: 'Fish', sampleSize: 30, exploits: [], weaknesses: [] }, { seat: 3, style: 'TAG', sampleSize: 45, exploits: [], weaknesses: [] }, { seat: 7, style: 'Nit', sampleSize: 20, exploits: [], weaknesses: [] }, { seat: 9, style: 'LP', sampleSize: 12, exploits: [], weaknesses: [] }] } },
    { t: 260, type: 'snapshot' },
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S5-excessive-mutations',
      symptomsTargeted: ['S5'],
      source: 'synthetic',
      sanitized: true,
      handCount: 1,
      duration_ms: 260,
      mechanism: 'rapid repeated pushes trigger full innerHTML replacements and classList.toggle churn',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SR-3 corpus extension (S6–S13)
// Added 2026-04-12 during SR-3 Panel Inventory & Purpose Audit to cover display
// states the original S1–S5 forensics corpus did not exercise. Each builder
// fires a specific sidebar UI element that had no screenshot evidence until now.
// Doctrine: R-8.3 — every SR-4 spec requires ≥1 corpus scenario.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * S6 — StateInvariantChecker Rule 2 violation (red "!" badge).
 *
 * Mechanism: push_live_context with state='FLOP' but currentStreet=null violates
 * Rule 2 ("live state FLOP but street is null"). The RenderCoordinator's
 * invariant checker runs on every render, stamps `lastViolationAt = Date.now()`,
 * and the status bar renders a `<span class="invariant-badge">!</span>` for 30s
 * after the violation. Fake clock's Date.now() is frozen at snapshot time so the
 * badge stays visible.
 */
export function buildS6InvariantViolation() {
  // Deliberately inconsistent: state says FLOP, currentStreet is null.
  const badContext = {
    state: 'FLOP',
    currentStreet: null,      // ← violates R2
    handNumber: 6001,
    heroSeat: 5,
    communityCards: ['A\u2660', 'K\u2665', '7\u2663', '', ''],
    holeCards: ['Q\u2660', 'J\u2660'],
    pot: 15,
    activeSeatNumbers: [3, 5],
    foldedSeats: [1, 7],
    dealerSeat: 3,
    pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 6, street: 'preflop', order: 2 },
    ],
  };

  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 3, action: 'raise', amount: 6 },
      { seat: 5, action: 'call', amount: 6 },
    ]),
  ];

  // The invariant checker runs AFTER each render; the first render with the
  // bad context trips R2 and stamps lastViolationAt, but the badge only
  // appears on the NEXT render. Push a second (minimally different) context
  // to force a second render that reads lastViolationAt into the snapshot.
  const badContextNudge = { ...badContext, pot: 16 };

  const events = [
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,  type: 'inject', message: { type: 'push_live_context', context: badContext } },
    { t: 300, type: 'inject', message: { type: 'push_live_context', context: badContextNudge } },
    { t: 500, type: 'snapshot' },
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S6-invariant-violation',
      symptomsTargeted: ['S6'],
      source: 'synthetic',
      sanitized: true,
      handCount: 1,
      duration_ms: 500,
      mechanism: 'push_live_context with state=FLOP + currentStreet=null violates R2; second push forces re-render so lastViolationAt flows into snapshot and badge renders',
    },
  };
}

/**
 * S7 — Advice goes stale (10s threshold; yellow-orange border + "Stale Ns").
 *
 * Mechanism: push_action_advice stamps lastGoodAdvice._receivedAt with Date.now().
 * The 1Hz updateStaleAdviceBadge interval polls and when Date.now() - _receivedAt
 * exceeds 10_000ms, the action-bar gains `.stale` class and a <span class="stale-badge">
 * is rendered containing "Stale Ns". Fake clock advances fire the setInterval and
 * mutate Date.now() coherently.
 */
export function buildS7AdviceStale() {
  const liveCtx = {
    state: 'FLOP', currentStreet: 'flop', handNumber: 7001, heroSeat: 5,
    communityCards: ['A\u2660', 'K\u2665', '7\u2663', '', ''],
    holeCards: ['Q\u2660', 'J\u2660'], pot: 18,
    activeSeatNumbers: [3, 5], foldedSeats: [1, 7], dealerSeat: 3, pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'bet', amount: 9, street: 'flop', order: 1 },
    ],
  };

  const advice = {
    handNumber: 7001, currentStreet: 'flop', villainSeat: 3, villainStyle: 'TAG',
    potSize: 18, heroEquity: 0.55, foldPct: { bet: 0.40 },
    recommendations: [{
      action: 'call', ev: 1.4, reasoning: 'Flop call with draw equity',
      handPlan: { ifCall: { note: 'Continue on blank turn', scaryCards: 1 } },
    }],
    treeMetadata: { depthReached: 2, spr: 3.6, branches: 4 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 3, action: 'raise', amount: 9 },
      { seat: 5, action: 'call', amount: 9 },
    ]),
  ];

  // Nudge to force a re-render after the 10s threshold elapses. The .stale
  // class on #action-bar only toggles during a full render — the 1Hz badge
  // interval writes the badge span directly but does NOT re-render the bar.
  const liveCtxNudge = { ...liveCtx, pot: 19 };

  const events = [
    { t: 0,      type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,     type: 'inject', message: { type: 'push_live_context', context: liveCtx } },
    { t: 100,    type: 'inject', message: { type: 'push_action_advice', advice } },
    { t: 200,    type: 'snapshot' }, // fresh: action-bar NOT stale
    // Advance past the 10s threshold, then nudge the context to force a
    // renderKey change → full render → .stale class toggles.
    { t: 11_400, type: 'inject', message: { type: 'push_live_context', context: liveCtxNudge } },
    { t: 11_500, type: 'snapshot' }, // stale: action-bar HAS .stale class + "Stale 11s" badge
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S7-advice-stale',
      symptomsTargeted: ['S7'],
      source: 'synthetic',
      sanitized: true,
      handCount: 1,
      duration_ms: 11_500,
      mechanism: 'advice _receivedAt frozen; clock.advance crosses 10s threshold; updateStaleAdviceBadge adds .stale + badge',
    },
  };
}

/**
 * S8 — No active table banner.
 *
 * Mechanism: push_pipeline_status with `tables: {}` (empty). handlePipelineStatus
 * enters a 5s grace window before clearing `currentActiveTableId`. After grace
 * elapses, `hasTableHands` becomes false, `#hud-content` hides, and `#no-table`
 * banner shows "No active table detected".
 */
export function buildS8NoTable() {
  const EMPTY_PIPELINE = {
    type: 'push_pipeline_status',
    status: { tables: {}, tableCount: 0, completedHands: 0 },
  };

  const events = [
    // Establish a table first so the empty-tables message actually enters the
    // grace+clear path (handlePipelineStatus only clears if prevTableId existed).
    { t: 0,     type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 100,   type: 'inject', message: EMPTY_PIPELINE },
    // 5s grace + extra buffer to let the timer fire cleanly.
    { t: 6_500, type: 'snapshot' },
  ];

  return {
    events,
    seedHands: [],
    label: {
      id: 'S8-no-table',
      symptomsTargeted: ['S8'],
      source: 'synthetic',
      sanitized: true,
      handCount: 0,
      duration_ms: 6_500,
      mechanism: 'push_pipeline_status tables:{} after prior active table triggers 5s grace then no-table banner',
    },
  };
}

/**
 * S9 — Pipeline recovery banner (visible, then cleared).
 *
 * Mechanism: push_recovery_needed sets recoveryMessage → banner visible.
 * push_recovery_cleared (or diagnostics with gameWsMessageCount>0) clears it.
 */
export function buildS9PipelineRecovery() {
  const events = [
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 100, type: 'inject', message: {
      type: 'push_recovery_needed',
      message: 'Connection issue detected. Reload the Ignition page to start capturing.',
    } },
    { t: 400, type: 'snapshot' }, // banner visible
    { t: 500, type: 'inject', message: { type: 'push_recovery_cleared' } },
    { t: 800, type: 'snapshot' }, // banner cleared
  ];

  return {
    events,
    seedHands: [],
    label: {
      id: 'S9-pipeline-recovery',
      symptomsTargeted: ['S9'],
      source: 'synthetic',
      sanitized: true,
      handCount: 0,
      duration_ms: 800,
      mechanism: 'push_recovery_needed shows banner; push_recovery_cleared hides it',
    },
  };
}

/**
 * S10 — Tournament mode bar with M-ratio + ICM + blinds.
 *
 * Mechanism: push_tournament writes lastGoodTournament; renderTournamentPanel
 * builds the #tournament-bar with M-ratio zone coloring and blind ladder.
 */
export function buildS10Tournament() {
  const tournamentPayload = {
    heroMRatio: 8.5,
    mRatioGuidance: { zone: 'caution', label: 'Caution zone' },
    currentLevelIndex: 5,
    currentBlinds: { sb: 50, bb: 100, ante: 10 },
    nextBlinds: { sb: 100, bb: 200, ante: 20 },
    heroStack: 2400,
    avgStack: 3500,
    playersRemaining: 6,
    totalEntrants: 18,
    levelEndTime: 1_700_000_600_000,  // startAt + 600_000 (matches clock startAt)
    icmPressure: { zone: 'approaching', playersFromBubble: 2 },
    blindOutInfo: { levelsRemaining: 8, wallClockMinutes: 120 },
    predictions: { milestones: [{ milestone: 'bubble', estimatedMinutes: 45 }] },
    progress: 33,
  };

  const liveCtx = {
    state: 'PREFLOP', currentStreet: 'preflop', handNumber: 10_001, heroSeat: 5,
    communityCards: ['', '', '', '', ''],
    holeCards: ['A\u2660', 'K\u2660'], pot: 150,
    activeSeatNumbers: [1, 3, 5, 7], foldedSeats: [], dealerSeat: 3, pfAggressor: null,
    actionSequence: [],
  };

  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 3, action: 'raise', amount: 200 },
      { seat: 5, action: 'call', amount: 200 },
    ]),
  ];

  const events = [
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,  type: 'inject', message: { type: 'push_tournament', tournament: tournamentPayload } },
    { t: 100, type: 'inject', message: { type: 'push_live_context', context: liveCtx } },
    { t: 400, type: 'snapshot' },
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S10-tournament-mode',
      symptomsTargeted: ['S10'],
      source: 'synthetic',
      sanitized: true,
      handCount: 1,
      duration_ms: 400,
      mechanism: 'push_tournament with full payload surfaces tournament-bar with M-ratio, ICM zone, blind ladder',
    },
  };
}

/**
 * S11 — Hero folded / observing mode.
 *
 * Mechanism: first push_live_context has hero active; second has hero in
 * foldedSeats. handleLiveContextPush detects the transition (!wasHeroFolded &&
 * isHeroFolded) and kicks Mode A. The between-hands/header shows "Observing".
 */
export function buildS11HeroFolded() {
  const activeCtx = {
    state: 'FLOP', currentStreet: 'flop', handNumber: 11_001, heroSeat: 5,
    communityCards: ['A\u2660', 'K\u2665', '7\u2663', '', ''],
    holeCards: ['2\u2663', '7\u2666'], pot: 25,
    activeSeatNumbers: [1, 3, 5, 7], foldedSeats: [], dealerSeat: 1, pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'raise', amount: 9, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 9, street: 'preflop', order: 2 },
      { seat: 3, action: 'bet', amount: 12, street: 'flop', order: 3 },
    ],
  };

  // Hero folds — foldedSeats now includes heroSeat=5.
  const foldedCtx = {
    ...activeCtx,
    activeSeatNumbers: [1, 3, 7],
    foldedSeats: [5],
    actionSequence: [
      ...activeCtx.actionSequence,
      { seat: 5, action: 'fold', amount: 0, street: 'flop', order: 4 },
    ],
  };

  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 1, action: 'fold', amount: 0 },
      { seat: 3, action: 'raise', amount: 9 },
      { seat: 5, action: 'call', amount: 9 },
      { seat: 7, action: 'fold', amount: 0 },
    ]),
  ];

  const events = [
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,  type: 'inject', message: { type: 'push_live_context', context: activeCtx } },
    { t: 200, type: 'snapshot' },  // pre-fold
    { t: 300, type: 'inject', message: { type: 'push_live_context', context: foldedCtx } },
    { t: 500, type: 'snapshot' },  // post-fold — Observing mode
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S11-hero-folded',
      symptomsTargeted: ['S11'],
      source: 'synthetic',
      sanitized: true,
      handCount: 1,
      duration_ms: 500,
      mechanism: 'two push_live_context frames transition hero from active to folded; Mode A timer starts; Observing label renders',
    },
  };
}

/**
 * S12 — River hero-to-act.
 *
 * Mechanism: standard flop/turn/river progression ending with hero facing a
 * river bet. Street progress strip marks 'river' active; 5 board cards render.
 */
export function buildS12RiverDecision() {
  const riverCtx = {
    state: 'RIVER', currentStreet: 'river', handNumber: 12_001, heroSeat: 5,
    communityCards: ['A\u2660', 'K\u2665', '7\u2663', '2\u2666', 'J\u2660'],
    holeCards: ['Q\u2660', 'J\u2663'], pot: 180,
    activeSeatNumbers: [3, 5], foldedSeats: [1, 7], dealerSeat: 3, pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'raise', amount: 9, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 9, street: 'preflop', order: 2 },
      { seat: 3, action: 'bet', amount: 12, street: 'flop', order: 3 },
      { seat: 5, action: 'call', amount: 12, street: 'flop', order: 4 },
      { seat: 3, action: 'bet', amount: 30, street: 'turn', order: 5 },
      { seat: 5, action: 'call', amount: 30, street: 'turn', order: 6 },
      { seat: 3, action: 'bet', amount: 60, street: 'river', order: 7 },
    ],
  };

  const riverAdvice = {
    handNumber: 12_001, currentStreet: 'river', villainSeat: 3, villainStyle: 'TAG',
    potSize: 180, heroEquity: 0.42, foldPct: { raise: 0.55 },
    recommendations: [{
      action: 'call', ev: 0.8, reasoning: 'River call — bluff-catcher vs polarized range',
      handPlan: { ifCall: { note: 'Bluff-catching range bet; no further streets', scaryCards: 0 } },
    }],
    treeMetadata: { depthReached: 1, spr: 0.9, branches: 2 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 3, action: 'raise', amount: 9 },
      { seat: 5, action: 'call', amount: 9 },
    ]),
  ];

  const events = [
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,  type: 'inject', message: { type: 'push_live_context', context: riverCtx } },
    { t: 100, type: 'inject', message: { type: 'push_action_advice', advice: riverAdvice } },
    { t: 400, type: 'snapshot' },
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S12-river-decision',
      symptomsTargeted: ['S12'],
      source: 'synthetic',
      sanitized: true,
      handCount: 1,
      duration_ms: 400,
      mechanism: 'full preflop→river progression; hero facing river bet; street-progress marks river active with 5 board cards',
    },
  };
}

/**
 * S13 — Checked-around flop / Rule V Q1-a fallback fixture.
 *
 * Mechanism: hand plays preflop (hero + villains call open), flop goes
 * check-check-check, now on turn. No villain bet/raise postflop → Rule V
 * requires range-slot to fall back to preflop aggressor (pfAggressor=3).
 * This corpus is a REGRESSION FIXTURE for SR-4 spec work that will implement
 * the range-slot Q1-a fallback. Current sidebar has no dedicated "checked-
 * around" indicator; signature asserts the structural state is achievable.
 */
export function buildS13CheckedFlop() {
  const turnCtx = {
    state: 'TURN', currentStreet: 'turn', handNumber: 13_001, heroSeat: 5,
    communityCards: ['A\u2660', 'K\u2665', '7\u2663', '2\u2666', ''],
    holeCards: ['Q\u2660', 'J\u2660'], pot: 27,
    activeSeatNumbers: [1, 3, 5], foldedSeats: [7], dealerSeat: 3,
    pfAggressor: 3,  // ← Seat 3 opened preflop; Rule V Q1-a defaults here
    actionSequence: [
      { seat: 3, action: 'raise', amount: 9, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 9, street: 'preflop', order: 2 },
      { seat: 1, action: 'call', amount: 9, street: 'preflop', order: 3 },
      { seat: 7, action: 'fold', amount: 0, street: 'preflop', order: 4 },
      // Flop: all three check
      { seat: 3, action: 'check', amount: 0, street: 'flop', order: 5 },
      { seat: 5, action: 'check', amount: 0, street: 'flop', order: 6 },
      { seat: 1, action: 'check', amount: 0, street: 'flop', order: 7 },
    ],
  };

  const turnAdvice = {
    handNumber: 13_001, currentStreet: 'turn', villainSeat: 3, villainStyle: 'TAG',
    potSize: 27, heroEquity: 0.48, foldPct: { bet: 0.38 },
    recommendations: [{
      action: 'check', ev: 0.3, reasoning: 'Checked-around flop gives uncertain villain range — check turn',
      handPlan: { ifCall: { note: 'PFA checked flop; river decision by texture', scaryCards: 1 } },
    }],
    treeMetadata: { depthReached: 2, spr: 3.3, branches: 3 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 1, action: 'call', amount: 3 },
      { seat: 3, action: 'raise', amount: 9 },
      { seat: 5, action: 'call', amount: 9 },
      { seat: 7, action: 'fold', amount: 0 },
    ]),
  ];

  const events = [
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,  type: 'inject', message: { type: 'push_live_context', context: turnCtx } },
    { t: 100, type: 'inject', message: { type: 'push_action_advice', advice: turnAdvice } },
    { t: 400, type: 'snapshot' },
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S13-checked-flop',
      symptomsTargeted: ['S13'],
      source: 'synthetic',
      sanitized: true,
      handCount: 1,
      duration_ms: 400,
      mechanism: 'flop actionSequence = [check,check,check]; pfAggressor=3 set; SR-4 range-slot must fall back to PFA',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SR-cluster boundary-hardening corpus extension (S14–S19)
// Added 2026-05-07 (SPR-047 / WS-101). Six race-catching corpora that lock the
// SPR-043/044/045 fixes (WS-105/103/104/102) against regression. Each sequence
// stages the exact event interleave that produced a failure mode catalogued in
// .claude/failures/SIDEBAR_REBUILD_PROGRAM.md / SW_REANIMATION_REPLAY.md /
// STATE_CLEAR_ASYMMETRY.md, then asserts via signature S<NN> that the post-fix
// observable holds (matched: true means the fix is in place).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * S17 — two push_action_advice arrive before any push_live_context.
 *
 * Mechanism: push_action_advice without companion push_live_context cannot be
 * validated against context.street. Pre-fix, the second advice could surface
 * plan-panel because the cross-panel pre-dispatch invariant gate (R-7.2) was
 * post-render. Post-WS-103 / post-WS-105, advice without context is held in
 * `_pendingAdvice` and does NOT promote until matching context arrives.
 *
 * Locks: R-7.2 (pre-dispatch invariant gate) + R-5.6 (FSM-output exclusivity).
 * Sibling fixes shipped: WS-103 (SPR-044) + WS-105 (SPR-043).
 *
 * Post-fix observable (S17 signature): a snapshot exists where `adviceStreet`
 * is set, `contextStreet` is null, and `planPanelVisible` is false — proving
 * the invariant holds.
 */
export function buildS17TwoAdviceBeforeContext() {
  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 3, action: 'raise', amount: 9 },
      { seat: 5, action: 'call', amount: 9 },
    ]),
  ];

  // Advice A: preflop street, hand 17001
  const adviceA = {
    handNumber: 17_001, currentStreet: 'preflop', villainSeat: 3, villainStyle: 'TAG',
    potSize: 12, heroEquity: 0.52, foldPct: { raise: 0.42 },
    recommendations: [{
      action: 'call', ev: 1.1, reasoning: 'Preflop call vs tight open',
      handPlan: { ifCall: { note: 'Reassess on flop texture', scaryCards: 1 } },
    }],
    treeMetadata: { depthReached: 2, spr: 8.2, branches: 4 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  // Advice B: flop street, same hand — second arrival, still no context.
  const adviceB = {
    handNumber: 17_001, currentStreet: 'flop', villainSeat: 3, villainStyle: 'TAG',
    potSize: 18, heroEquity: 0.58, foldPct: { bet: 0.36 },
    recommendations: [{
      action: 'call', ev: 1.6, reasoning: 'Flop call with TPGK',
      handPlan: { ifCall: { note: 'Continue on blank turn', scaryCards: 1 } },
    }],
    treeMetadata: { depthReached: 2, spr: 4.0, branches: 4 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  // Context arrives after both advice pushes.
  const flopCtx = {
    state: 'FLOP', currentStreet: 'flop', handNumber: 17_001, heroSeat: 5,
    communityCards: ['A♠', 'K♥', '7♣', '', ''],
    holeCards: ['Q♠', 'J♠'], pot: 18,
    activeSeatNumbers: [3, 5], foldedSeats: [1, 7], dealerSeat: 3, pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'raise', amount: 9, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 9, street: 'preflop', order: 2 },
      { seat: 3, action: 'bet', amount: 9, street: 'flop', order: 3 },
    ],
  };

  const events = [
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    // Two consecutive advice pushes — NO live_context yet.
    { t: 50,  type: 'inject', message: { type: 'push_action_advice', advice: adviceA } },
    { t: 100, type: 'inject', message: { type: 'push_action_advice', advice: adviceB } },
    // Snapshot BEFORE context arrives — plan-panel must be hidden.
    { t: 250, type: 'snapshot' },
    // Context finally arrives.
    { t: 350, type: 'inject', message: { type: 'push_live_context', context: flopCtx } },
    { t: 500, type: 'snapshot' },
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S17-two-advice-before-context',
      symptomsTargeted: ['S17'],
      source: 'synthetic',
      sanitized: true,
      handCount: 1,
      duration_ms: 500,
      mechanism: 'two push_action_advice without companion push_live_context — second advice must NOT promote plan-panel pre-context (R-7.2 pre-dispatch invariant gate)',
      locks: ['WS-103', 'WS-105'],
    },
  };
}

/**
 * S14 — reconnect-mid-advice / coincidental-street trap (RT-45).
 *
 * Mechanism: stale advice (cached by SW for hand N) re-arrives after hand boundary
 * to hand N+1. If hand N+1's street coincidentally matches the cached advice's
 * street, pre-fix logic could promote the stale advice. Post-WS-105/WS-103 path
 * stamps handNumber via the line 524-529 RT-45 stamp + coordinator.handleAdvice
 * rejects against `_lockedHandNumber`.
 *
 * Locks: R-7.2 (pre-dispatch invariant gate) + R-8.1 (state-clear symmetry).
 * Sibling fixes shipped: WS-105 (SPR-043) + WS-103 (SPR-044).
 *
 * Post-fix observable (S14 signature): the FINAL snapshot — taken after the
 * stale advice replay — has handNumber=14002, contextStreet='flop'
 * (coincidentally same as the stale advice's street), and planPanelVisible=false.
 * The cached advice for hand 14001 was correctly rejected by the locked-hand gate.
 */
export function buildS14ReconnectMidAdvice() {
  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 3, action: 'raise', amount: 9 },
      { seat: 5, action: 'call', amount: 9 },
    ]),
  ];

  // Hand 14001 — flop in progress, advice valid + visible.
  const ctxA = {
    state: 'FLOP', currentStreet: 'flop', handNumber: 14_001, heroSeat: 5,
    communityCards: ['A♠', 'K♥', '7♣', '', ''],
    holeCards: ['Q♠', 'J♠'], pot: 18,
    activeSeatNumbers: [3, 5], foldedSeats: [1, 7], dealerSeat: 3, pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'raise', amount: 9, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 9, street: 'preflop', order: 2 },
      { seat: 3, action: 'bet', amount: 9, street: 'flop', order: 3 },
    ],
  };

  const adviceA = {
    handNumber: 14_001, currentStreet: 'flop', villainSeat: 3, villainStyle: 'TAG',
    potSize: 18, heroEquity: 0.58, foldPct: { bet: 0.36 },
    recommendations: [{
      action: 'call', ev: 1.6, reasoning: 'Flop call with TPGK',
      handPlan: { ifCall: { note: 'Continue on blank turn', scaryCards: 1 } },
    }],
    treeMetadata: { depthReached: 2, spr: 4.0, branches: 4 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  // Hand 14002 — new hand starts at PREFLOP, then advances to FLOP. Coincidentally
  // same street as the cached advice from hand 14001 — this is the "coincidental
  // street trap" the bug exploits.
  const ctxB_preflop = {
    state: 'PREFLOP', currentStreet: 'preflop', handNumber: 14_002, heroSeat: 5,
    communityCards: ['', '', '', '', ''],
    holeCards: ['9♠', '8♠'], pot: 3,
    activeSeatNumbers: [1, 3, 5], foldedSeats: [], dealerSeat: 3, pfAggressor: null,
    actionSequence: [],
  };

  const ctxB_flop = {
    state: 'FLOP', currentStreet: 'flop', handNumber: 14_002, heroSeat: 5,
    communityCards: ['T♥', '6♠', '2♣', '', ''],   // different board than 14001
    holeCards: ['9♠', '8♠'], pot: 12,
    activeSeatNumbers: [3, 5], foldedSeats: [1], dealerSeat: 3, pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 6, street: 'preflop', order: 2 },
    ],
  };

  const events = [
    { t: 0,    type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,   type: 'inject', message: { type: 'push_live_context', context: ctxA } },
    { t: 100,  type: 'inject', message: { type: 'push_action_advice', advice: adviceA } },
    { t: 250,  type: 'snapshot' },  // hand 14001 — advice should be visible here

    // Hand boundary: PREFLOP transition clears lastGoodAdvice / re-locks handNumber.
    { t: 400,  type: 'inject', message: { type: 'push_live_context', context: ctxB_preflop } },
    // Hand 14002 advances to flop — _lockedHandNumber is now 14002, contextStreet='flop'.
    { t: 600,  type: 'inject', message: { type: 'push_live_context', context: ctxB_flop } },

    // SW-cache replay simulation: stale advice for hand 14001 re-arrives
    // (same handNumber, same street). Pre-fix would promote (coincidental
    // street match). Post-fix RT-45 + handleAdvice gate rejects (locked=14002).
    { t: 700,  type: 'inject', message: { type: 'push_action_advice', advice: adviceA } },

    { t: 900,  type: 'snapshot' }, // FINAL — stale advice must NOT be promoted.
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S14-reconnect-mid-advice',
      symptomsTargeted: ['S14'],
      source: 'synthetic',
      sanitized: true,
      handCount: 2,
      duration_ms: 900,
      mechanism: 'stale advice (handNumber=14001) replayed post-hand-boundary on coincidentally-matching street; RT-45 + locked-hand gate must reject',
      locks: ['WS-105', 'WS-103'],
    },
  };
}

/**
 * S15 — SW-reanimate / cross-hand cache replay without companion context.
 *
 * Mechanism: Chrome MV3 service-worker is evicted after ~30s idle. On
 * reanimation, `pushFullStateToSidePanel` replays cached actionAdvice (and
 * other bundled state) WITHOUT a fresh push_live_context companion. Pre-fix,
 * cached advice for hand N could buffer in `_pendingAdvice` and surface on
 * the next live_context arrival for hand N+1. Post-WS-105 (validateMessage
 * parity at SW boundary), the boundary checker rejects messages that violate
 * the contract; post-WS-103 (freeze live_context), advice without context
 * companion stays held; post-RT-45, handNumber stamping rejects across hands.
 *
 * Distinguishes from S14 by:
 *   - 30-second eviction gap (clock advance simulating SW idle eviction);
 *   - bundled cached-state replay (advice + exploits as SW reanimation would push);
 *   - NO companion context with the cached advice (context-less replay).
 *
 * Locks: R-8.1 (state-clear symmetry) + R-7.2 (pre-dispatch invariant gate).
 * Sibling fixes shipped: WS-105 (SPR-043) + WS-103 (SPR-044).
 *
 * Post-fix observable (S15 signature): the FINAL snapshot, taken after the
 * SW-reanimate bundle re-injection on hand 15002, shows plan-panel hidden.
 * The cached advice for hand 15001 was correctly rejected.
 */
export function buildS15SwReanimate() {
  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 3, action: 'raise', amount: 9 },
      { seat: 5, action: 'call', amount: 9 },
    ]),
  ];

  // Hand 15001 — flop, advice + exploits valid.
  const ctxA = {
    state: 'FLOP', currentStreet: 'flop', handNumber: 15_001, heroSeat: 5,
    communityCards: ['A♠', 'K♥', '7♣', '', ''],
    holeCards: ['Q♠', 'J♠'], pot: 18,
    activeSeatNumbers: [3, 5], foldedSeats: [1, 7], dealerSeat: 3, pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'raise', amount: 9, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 9, street: 'preflop', order: 2 },
      { seat: 3, action: 'bet', amount: 9, street: 'flop', order: 3 },
    ],
  };

  const adviceA = {
    handNumber: 15_001, currentStreet: 'flop', villainSeat: 3, villainStyle: 'TAG',
    potSize: 18, heroEquity: 0.55, foldPct: { bet: 0.36 },
    recommendations: [{
      action: 'call', ev: 1.4, reasoning: 'Flop call with TPGK',
      handPlan: { ifCall: { note: 'Continue on blank turn', scaryCards: 1 } },
    }],
    treeMetadata: { depthReached: 2, spr: 4.2, branches: 4 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  const exploitsA = {
    appConnected: true,
    seats: [
      { seat: 1, style: 'Fish', sampleSize: 30, exploits: [], weaknesses: [] },
      { seat: 3, style: 'TAG', sampleSize: 50, exploits: [], weaknesses: [] },
    ],
  };

  // Hand 15002 — new hand starting, only PREFLOP context arrives BEFORE the
  // SW-reanimate bundle replays. No flop context for 15002 is ever pushed —
  // the cached advice for 15001 must NOT promote into 15002's PREFLOP state.
  const ctxB_preflop = {
    state: 'PREFLOP', currentStreet: 'preflop', handNumber: 15_002, heroSeat: 5,
    communityCards: ['', '', '', '', ''],
    holeCards: ['T♥', '9♥'], pot: 3,
    activeSeatNumbers: [1, 3, 5], foldedSeats: [], dealerSeat: 3, pfAggressor: null,
    actionSequence: [],
  };

  const events = [
    { t: 0,      type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,     type: 'inject', message: { type: 'push_live_context', context: ctxA } },
    { t: 100,    type: 'inject', message: { type: 'push_action_advice', advice: adviceA } },
    { t: 150,    type: 'inject', message: { type: 'push_exploits', ...exploitsA } },
    { t: 300,    type: 'snapshot' },  // hand 15001 — advice + exploits visible

    // Hand boundary at t=400, then 30s of nothing (SW eviction window).
    { t: 400,    type: 'inject', message: { type: 'push_live_context', context: ctxB_preflop } },
    { t: 600,    type: 'snapshot' },  // PREFLOP for 15002 — plan-panel hidden (advice cleared on hand boundary)

    // SW eviction window — 30 seconds of no traffic.
    // SW reanimates and replays the bundled cached state (advice + exploits)
    // WITHOUT a fresh live_context. This is the pushFullStateToSidePanel
    // shape per docs/SW_REANIMATION_REPLAY.md.
    { t: 30_700, type: 'inject', message: { type: 'push_action_advice', advice: adviceA } },
    { t: 30_750, type: 'inject', message: { type: 'push_exploits', ...exploitsA } },

    { t: 31_000, type: 'snapshot' }, // FINAL — stale advice must NOT promote on 15002 PREFLOP.
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S15-sw-reanimate',
      symptomsTargeted: ['S15'],
      source: 'synthetic',
      sanitized: true,
      handCount: 2,
      duration_ms: 31_000,
      mechanism: 'SW eviction (30s gap) → reanimation re-pushes cached advice+exploits for hand 15001 onto hand 15002 PREFLOP — locked-hand gate must reject the stale advice',
      locks: ['WS-105', 'WS-103'],
    },
  };
}

/**
 * S16 — handNew within 80ms (sub-coalesce-window race).
 *
 * Mechanism: push_action_advice arrives, then handNew (PREFLOP for next hand)
 * arrives within the 80ms NORMAL-priority coalesce window. Pre-WS-104, timer
 * registration via queueMicrotask deferred could miss synchronous clear paths;
 * pre-WS-102, betweenHandsFsm could enter banner-visible states for transient
 * signals → plan-panel oscillation, between-hands flash, stale-badge leakage.
 *
 * Locks: RT-60 (synchronous timer registration) + R-2.3 (DOM-via-FSM-only).
 * Sibling fixes shipped: WS-104 (SPR-045) + WS-102 (SPR-045).
 *
 * Post-fix observable (S16 signature): plan-panel makes AT MOST one
 * visible→hidden transition across the snapshot sequence (no oscillation),
 * AND the final settled state is correct (hand 16002 PREFLOP, plan hidden,
 * advice cleared by hand boundary).
 *
 * fast_snapshot at t=160 captures the DOM state ~20ms into the coalesce
 * window — used as a forensic anchor showing the pre-coalesce state, not
 * asserted (the steady-state at t=400 is the load-bearing observable).
 */
export function buildS16HandNewWithin80ms() {
  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 3, action: 'raise', amount: 9 },
      { seat: 5, action: 'call', amount: 9 },
    ]),
  ];

  const ctxA = {
    state: 'FLOP', currentStreet: 'flop', handNumber: 16_001, heroSeat: 5,
    communityCards: ['A♠', 'K♥', '7♣', '', ''],
    holeCards: ['Q♠', 'J♠'], pot: 18,
    activeSeatNumbers: [3, 5], foldedSeats: [1, 7], dealerSeat: 3, pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'raise', amount: 9, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 9, street: 'preflop', order: 2 },
      { seat: 3, action: 'bet', amount: 9, street: 'flop', order: 3 },
    ],
  };

  const adviceA = {
    handNumber: 16_001, currentStreet: 'flop', villainSeat: 3, villainStyle: 'TAG',
    potSize: 18, heroEquity: 0.55, foldPct: { bet: 0.36 },
    recommendations: [{
      action: 'call', ev: 1.4, reasoning: 'Flop call with TPGK',
      handPlan: { ifCall: { note: 'Continue on blank turn', scaryCards: 1 } },
    }],
    treeMetadata: { depthReached: 2, spr: 4.2, branches: 4 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  // handNew (hand 16002 PREFLOP) arrives 60ms after advice — within the 80ms
  // coalesce window. Pre-fix, this is the timing where queueMicrotask-deferred
  // timer registration could leave the stale-badge timer running past clear,
  // and the betweenHandsFsm could flash banner states.
  const ctxB_preflop = {
    state: 'PREFLOP', currentStreet: 'preflop', handNumber: 16_002, heroSeat: 5,
    communityCards: ['', '', '', '', ''],
    holeCards: ['9♠', '8♠'], pot: 3,
    activeSeatNumbers: [1, 3, 5], foldedSeats: [], dealerSeat: 3, pfAggressor: null,
    actionSequence: [],
  };

  const events = [
    { t: 0,   type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,  type: 'inject', message: { type: 'push_live_context', context: ctxA } },
    { t: 100, type: 'inject', message: { type: 'push_action_advice', advice: adviceA } },
    { t: 130, type: 'snapshot' },  // hand 16001 flop — advice visible

    // handNew within 60ms of advice — sub-coalesce-window race.
    { t: 160, type: 'inject', message: { type: 'push_live_context', context: ctxB_preflop } },
    // fast_snapshot at t=180 — captures the in-flight coalesce-window DOM
    // (forensic anchor; not asserted by signature).
    { t: 180, type: 'fast_snapshot' },

    // Confirming handNew push within 100ms — exits betweenHandsFsm pendingActive
    // toward inactive-or-active per its rule (modeAExpired symmetry covered by
    // WS-102; we just need at least one confirming push so the FSM settles).
    { t: 250, type: 'inject', message: { type: 'push_live_context', context: ctxB_preflop } },

    { t: 400, type: 'snapshot' },  // settled — plan-panel hidden, hand=16002 PREFLOP
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S16-handnew-within-80ms',
      symptomsTargeted: ['S16'],
      source: 'synthetic',
      sanitized: true,
      handCount: 2,
      duration_ms: 400,
      mechanism: 'handNew arrives 60ms after advice (sub-coalesce window); WS-104 synchronous timer + WS-102 pendingActive debounce must keep plan-panel from oscillating',
      locks: ['WS-104', 'WS-102'],
    },
  };
}

/**
 * S18 — donk→cbet villain-action transition mid-coalesce.
 *
 * Mechanism: hero is preflop aggressor; villain donks (out-of-turn lead).
 * New advice (defend vs donk) gets dispatched. The transition from "compute
 * cbet" to "defend vs donk" can land mid-coalesce. Pre-WS-102, the renderer
 * could read raw state mid-FSM-transition (R-5.6 violation) and produce a
 * snapshot where the slot disagrees with the FSM-canonical state. Pre-WS-104,
 * tight transitions could double-render with different villain action shown.
 *
 * Locks: R-5.6 (FSM-output exclusivity) + R-2.3 (DOM-via-FSM-only).
 * Sibling fixes shipped: WS-102 (SPR-045) + WS-104 (SPR-045).
 *
 * Post-fix observable (S18 signature): plan-panel makes at most one flip
 * across the snapshot sequence (no oscillation during the donk→cbet
 * transition), AND the final snapshot has advice/context coupled to the same
 * street (no S2-style decoupling left over).
 */
export function buildS18DonkToCbet() {
  const seedHands = [
    makeSeedHand('table_1', [
      { seat: 3, action: 'call', amount: 3 },
      { seat: 5, action: 'raise', amount: 9 },
      { seat: 3, action: 'call', amount: 9 },
    ]),
  ];

  // Hand 18001 — hero (seat 5) is pfAggressor; villain (seat 3) called preflop.
  // Flop just dealt; villain has not yet acted (typical hero cbet spot).
  const ctxCbetSpot = {
    state: 'FLOP', currentStreet: 'flop', handNumber: 18_001, heroSeat: 5,
    communityCards: ['T♥', '7♠', '2♣', '', ''],
    holeCards: ['A♠', 'K♠'], pot: 18,
    activeSeatNumbers: [3, 5], foldedSeats: [1, 7], dealerSeat: 3, pfAggressor: 5,
    actionSequence: [
      { seat: 5, action: 'raise', amount: 9, street: 'preflop', order: 1 },
      { seat: 3, action: 'call', amount: 9, street: 'preflop', order: 2 },
    ],
  };

  // Advice for the cbet decision — recommends bet (hero is the aggressor).
  const adviceCbet = {
    handNumber: 18_001, currentStreet: 'flop', villainSeat: 3, villainStyle: 'TAG',
    potSize: 18, heroEquity: 0.62, foldPct: { bet: 0.45 },
    recommendations: [{
      action: 'bet', ev: 2.4, reasoning: 'C-bet: nut equity + fold equity',
      handPlan: { ifCall: { note: 'Continue on most turns', scaryCards: 1 } },
    }],
    treeMetadata: { depthReached: 2, spr: 4.5, branches: 4 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  // Villain donk-leads: villain bets out-of-turn (acts before the aggressor).
  // actionSequence now includes [seat 3, bet, 9, flop] BEFORE hero acts.
  const ctxDonkLead = {
    ...ctxCbetSpot,
    pot: 27,  // 18 + villain's 9 donk-bet
    actionSequence: [
      ...ctxCbetSpot.actionSequence,
      { seat: 3, action: 'bet', amount: 9, street: 'flop', order: 3 },
    ],
  };

  // New advice computed for the defend-vs-donk spot — recommends call.
  const adviceDefendDonk = {
    handNumber: 18_001, currentStreet: 'flop', villainSeat: 3, villainStyle: 'TAG',
    potSize: 27, heroEquity: 0.55, foldPct: { raise: 0.55 },
    recommendations: [{
      action: 'call', ev: 1.7, reasoning: 'Call vs donk: pot odds + equity',
      handPlan: { ifCall: { note: 'Reassess vs turn lead', scaryCards: 2 } },
    }],
    treeMetadata: { depthReached: 2, spr: 3.0, branches: 3 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  const events = [
    { t: 0,    type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,   type: 'inject', message: { type: 'push_live_context', context: ctxCbetSpot } },
    { t: 100,  type: 'inject', message: { type: 'push_action_advice', advice: adviceCbet } },
    { t: 250,  type: 'snapshot' },  // hero cbet decision — advice visible

    // Villain donks → context update + new advice in tight succession.
    { t: 300,  type: 'inject', message: { type: 'push_live_context', context: ctxDonkLead } },
    // fast_snapshot in coalesce window — captures any FSM/raw-state disagreement.
    { t: 320,  type: 'fast_snapshot' },
    { t: 360,  type: 'inject', message: { type: 'push_action_advice', advice: adviceDefendDonk } },

    { t: 600,  type: 'snapshot' },  // settled — advice/context coupled, no oscillation
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S18-donk-to-cbet',
      symptomsTargeted: ['S18'],
      source: 'synthetic',
      sanitized: true,
      handCount: 1,
      duration_ms: 600,
      mechanism: 'villain donks mid-coalesce; new advice computed; FSM/raw-state must not decouple (R-5.6); plan-panel must not oscillate',
      locks: ['WS-102', 'WS-104'],
    },
  };
}

/**
 * Pipeline status with a different active table — used by S19 for the
 * table-switch test. Distinct from PIPELINE_STATUS_TABLE_1.
 */
export const PIPELINE_STATUS_TABLE_2 = {
  type: 'push_pipeline_status',
  status: {
    tables: { '2': { state: 'active' } },
    tableCount: 1,
    completedHands: 1,
  },
};

/**
 * S19 — table-switch during stale-advice fade timer (R-8.1 state-clear symmetry).
 *
 * Mechanism: hero is on table_1 with stale advice (advice age > 10s; action-bar
 * has .stale class + "Stale Ns" badge). Hero switches to table_2 — a
 * push_pipeline_status with table_2 active triggers clearForTableSwitch.
 * Pre-fix, the 1Hz stale-badge fade timer could fire while clearForTableSwitch
 * was running (microtask race), leaving stale-badge HTML on the new table's
 * action-bar; or the lastGoodAdvice from table_1 could leak into table_2's
 * render path. Post-WS-104 (synchronous timer registration) the timer is
 * always findable by clear; post-R-8.1 (state-clear symmetry registry) every
 * per-table field has a matched clear in the lifecycle path.
 *
 * Locks: R-8.1 (state-clear symmetry) + RT-60 (synchronous timer registration).
 * Sibling fixes shipped: WS-104 (SPR-045) + the broader STP-1 state-clear
 * symmetry program (pre-cluster).
 *
 * Post-fix observable (S19 signature): the FINAL snapshot, taken after the
 * table switch + new-table context push, has:
 *   - action-bar NOT stale (no .stale class),
 *   - no "Stale Ns" badge HTML residue,
 *   - plan-panel hidden (lastGoodAdvice cleared),
 *   - handNumber advanced to the new table's hand (state actually changed).
 */
export function buildS19TableSwitchDuringFade() {
  // Seed hands for BOTH tables so refreshHandStats produces stats for either.
  const seedHands = [
    {
      tableId: 'table_1',
      capturedAt: 1_700_000_000_000,
      gameState: { actionSequence: [
        { seat: 3, action: 'raise', amount: 9 },
        { seat: 5, action: 'call', amount: 9 },
      ]},
    },
    {
      tableId: 'table_2',
      capturedAt: 1_700_000_000_000,
      gameState: { actionSequence: [
        { seat: 4, action: 'raise', amount: 6 },
        { seat: 6, action: 'call', amount: 6 },
      ]},
    },
  ];

  // Hand 19001 on table_1 — flop in progress.
  const ctxTable1 = {
    state: 'FLOP', currentStreet: 'flop', handNumber: 19_001, heroSeat: 5,
    communityCards: ['A♠', 'K♥', '7♣', '', ''],
    holeCards: ['Q♠', 'J♠'], pot: 18,
    activeSeatNumbers: [3, 5], foldedSeats: [1, 7], dealerSeat: 3, pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'raise', amount: 9, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 9, street: 'preflop', order: 2 },
      { seat: 3, action: 'bet', amount: 9, street: 'flop', order: 3 },
    ],
  };

  const adviceTable1 = {
    handNumber: 19_001, currentStreet: 'flop', villainSeat: 3, villainStyle: 'TAG',
    potSize: 18, heroEquity: 0.55, foldPct: { bet: 0.36 },
    recommendations: [{
      action: 'call', ev: 1.4, reasoning: 'Flop call with TPGK',
      handPlan: { ifCall: { note: 'Continue on blank turn', scaryCards: 1 } },
    }],
    treeMetadata: { depthReached: 2, spr: 4.2, branches: 4 },
    segmentation: { handTypes: {}, totalCombos: 0, totalWeight: 0 },
    villainRanges: [], narrowingLog: [],
  };

  // Hand 20001 on table_2 — fresh hand, no advice yet.
  const ctxTable2 = {
    state: 'PREFLOP', currentStreet: 'preflop', handNumber: 20_001, heroSeat: 6,
    communityCards: ['', '', '', '', ''],
    holeCards: ['T♥', '9♥'], pot: 3,
    activeSeatNumbers: [2, 4, 6], foldedSeats: [], dealerSeat: 2, pfAggressor: null,
    actionSequence: [],
  };

  const events = [
    { t: 0,      type: 'inject', message: { ...PIPELINE_STATUS_TABLE_1 } },
    { t: 50,     type: 'inject', message: { type: 'push_live_context', context: ctxTable1 } },
    { t: 100,    type: 'inject', message: { type: 'push_action_advice', advice: adviceTable1 } },
    { t: 200,    type: 'snapshot' }, // table_1 fresh — advice visible, action-bar not stale

    // Advance past 10s stale threshold; nudge context to force a render so
    // .stale class toggles on action-bar and "Stale Ns" badge appears.
    { t: 11_400, type: 'inject', message: { type: 'push_live_context', context: { ...ctxTable1, pot: 19 } } },
    { t: 11_500, type: 'snapshot' }, // table_1 stale — action-bar.stale + Stale badge

    // Table switch during fade — push pipeline status with table_2 active.
    // clearForTableSwitch must clear lastGoodAdvice + stop the stale-badge timer
    // + null all per-table fields per R-8.1.
    { t: 11_600, type: 'inject', message: { ...PIPELINE_STATUS_TABLE_2 } },
    // New context for table_2 arrives (different hand, different heroSeat).
    { t: 11_700, type: 'inject', message: { type: 'push_live_context', context: ctxTable2 } },

    { t: 12_000, type: 'snapshot' }, // FINAL — post-switch state must be fully cleared
  ];

  return {
    events,
    seedHands,
    label: {
      id: 'S19-table-switch-during-fade',
      symptomsTargeted: ['S19'],
      source: 'synthetic',
      sanitized: true,
      handCount: 2,
      duration_ms: 12_000,
      mechanism: 'stale-advice fade timer running on table_1; table_2 active push triggers clearForTableSwitch; R-8.1 state-clear symmetry must null all per-table fields including stale-badge timer state',
      locks: ['WS-104'],
    },
  };
}

/**
 * Serialize an event list to JSONL.
 */
export function toJSONL({ events, label }) {
  const lines = [`# ${JSON.stringify({ _meta: label })}`];
  for (const e of events) lines.push(JSON.stringify(e));
  return lines.join('\n') + '\n';
}

/**
 * Parse JSONL back into { events, label }.
 */
export function fromJSONL(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  let label = null;
  const events = [];
  for (const line of lines) {
    if (line.startsWith('# ')) {
      try { label = JSON.parse(line.slice(2))._meta; } catch (_) {}
      continue;
    }
    events.push(JSON.parse(line));
  }
  return { events, label };
}
