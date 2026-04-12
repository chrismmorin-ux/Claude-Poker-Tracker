/**
 * message-sequences.js — Wire message factories for integration testing.
 *
 * Produces the exact JSON objects the service worker sends over the port.
 * Uses the same field shapes as wire-schemas.js for accuracy.
 */

// =========================================================================
// MESSAGE BUILDERS
// =========================================================================

/** Build a push_live_context message. */
export const msgLiveContext = (ctx) => ({
  type: 'push_live_context',
  context: {
    state: ctx.state || 'FLOP',
    currentStreet: ctx.currentStreet || 'flop',
    heroSeat: ctx.heroSeat ?? 5,
    dealerSeat: ctx.dealerSeat ?? 1,
    communityCards: ctx.communityCards || [],
    holeCards: ctx.holeCards || ['As', 'Kd'],
    pot: ctx.pot ?? 20,
    foldedSeats: ctx.foldedSeats || [],
    activeSeatNumbers: ctx.activeSeatNumbers || [1, 3, 5],
    actionSequence: ctx.actionSequence || [],
    blinds: ctx.blinds || { sb: 0.5, bb: 1 },
    ante: ctx.ante ?? 0,
    gameType: ctx.gameType || 'NLHE',
    pfAggressor: ctx.pfAggressor ?? null,
    handNumber: ctx.handNumber || 'HAND_001',
    stacks: ctx.stacks || {},
    seatDisplayMap: ctx.seatDisplayMap || null,
    tournamentLevelInfo: ctx.tournamentLevelInfo || null,
    ...ctx,
  },
});

/** Build a push_action_advice message. */
export const msgAdvice = (adv) => ({
  type: 'push_action_advice',
  advice: {
    villainSeat: adv.villainSeat ?? 3,
    villainStyle: adv.villainStyle || 'TAG',
    villainSampleSize: adv.villainSampleSize ?? 45,
    heroAlreadyActed: adv.heroAlreadyActed ?? false,
    confidence: adv.confidence ?? 0.8,
    dataQuality: adv.dataQuality || 'good',
    situation: adv.situation || 'facing_bet',
    situationLabel: adv.situationLabel || 'Facing Bet',
    heroEquity: adv.heroEquity ?? 0.55,
    boardTexture: adv.boardTexture || 'dry',
    foldPct: adv.foldPct ?? 45,
    recommendations: adv.recommendations || [{ action: 'call', ev: 2.1, sizing: null }],
    currentStreet: adv.currentStreet || 'flop',
    potSize: adv.potSize ?? 20,
    villainBet: adv.villainBet ?? 10,
    ...adv,
  },
  timestamp: adv.timestamp ?? Date.now(),
});

/** Build a push_exploits message. */
export const msgExploits = (seats = [], appConnected = true) => ({
  type: 'push_exploits',
  seats: seats.map(s => ({
    seat: s.seat ?? 3,
    style: s.style || 'TAG',
    sampleSize: s.sampleSize ?? 45,
    exploits: s.exploits || [],
    weaknesses: s.weaknesses || [],
    briefings: s.briefings || [],
    observations: s.observations || [],
    stats: s.stats || { cbet: null, foldToCbet: null, threeBet: null },
    villainHeadline: s.villainHeadline || 'Tight-Aggressive Regular',
    villainProfile: s.villainProfile || null,
    ...s,
  })),
  appConnected,
});

/** Build a push_pipeline_status message. */
export const msgPipeline = (tables = {}, opts = {}) => ({
  type: 'push_pipeline_status',
  tables,
  tableCount: Object.keys(tables).length,
  completedHands: opts.completedHands ?? 0,
  storedHands: opts.storedHands ?? 0,
  queueLength: opts.queueLength ?? 0,
  appConnected: opts.appConnected ?? true,
  errorCount: opts.errorCount ?? 0,
  diagnosticData: opts.diagnosticData || null,
  liveContext: opts.liveContext || null,
});

/** Build a push_pipeline_diagnostics message. */
export const msgDiag = (data = {}) => ({
  type: 'push_pipeline_diagnostics',
  data: {
    probeReady: data.probeReady ?? true,
    probeReadyAt: data.probeReadyAt ?? Date.now(),
    wsMessageCount: data.wsMessageCount ?? 10,
    gameWsMessageCount: data.gameWsMessageCount ?? 5,
    nonGameWsMessageCount: data.nonGameWsMessageCount ?? 5,
    firstWsMessageAt: data.firstWsMessageAt ?? Date.now() - 10000,
    lastWsMessageAt: data.lastWsMessageAt ?? Date.now(),
    capturePortConnected: data.capturePortConnected ?? true,
    capturePortConnectCount: data.capturePortConnectCount ?? 1,
    tableCount: data.tableCount ?? 1,
    completedHands: data.completedHands ?? 0,
    seenWsUrls: data.seenWsUrls || [],
    captureStartedAt: data.captureStartedAt ?? Date.now() - 30000,
    pageUrl: data.pageUrl || 'https://ignition.casino',
    batchedFrameCount: data.batchedFrameCount ?? 0,
    totalParsedMessages: data.totalParsedMessages ?? 10,
    pidCounts: data.pidCounts || {},
    _updatedAt: data._updatedAt ?? Date.now(),
    ...data,
  },
});

/** Build a push_tournament message. */
export const msgTournament = (t) => ({
  type: 'push_tournament',
  tournament: t ? {
    heroMRatio: t.heroMRatio ?? 15,
    playersRemaining: t.playersRemaining ?? 50,
    totalEntrants: t.totalEntrants ?? 100,
    currentLevelIndex: t.currentLevelIndex ?? 3,
    progress: t.progress ?? 0.5,
    heroStack: t.heroStack ?? 15000,
    avgStack: t.avgStack ?? 10000,
    icmPressure: t.icmPressure || null,
    currentBlinds: t.currentBlinds || { sb: 50, bb: 100 },
    ...t,
  } : null,
  timestamp: Date.now(),
});

/** Build a push_hands_updated message. */
export const msgHandsUpdated = (totalHands = 1) => ({
  type: 'push_hands_updated',
  totalHands,
});

/** Build a push_recovery_needed message. */
export const msgRecoveryNeeded = (reason = 'silence_timeout', message = 'No WS traffic') => ({
  type: 'push_recovery_needed',
  reason,
  message,
});

/** Build a push_recovery_cleared message. */
export const msgRecoveryCleared = () => ({
  type: 'push_recovery_cleared',
});

// =========================================================================
// SCENARIO BUILDING BLOCKS
// =========================================================================

/** Preflop live context */
export const ctxPreflop = (overrides = {}) => ({
  state: 'PREFLOP',
  currentStreet: 'preflop',
  heroSeat: 5,
  handNumber: 'HAND_001',
  pot: 1.5,
  activeSeatNumbers: [1, 3, 5, 7, 9],
  foldedSeats: [],
  actionSequence: [],
  communityCards: [],
  holeCards: ['As', 'Kd'],
  ...overrides,
});

/** Flop live context */
export const ctxFlop = (overrides = {}) => ({
  state: 'FLOP',
  currentStreet: 'flop',
  heroSeat: 5,
  handNumber: 'HAND_001',
  pot: 8,
  activeSeatNumbers: [3, 5, 7],
  foldedSeats: [1, 9],
  actionSequence: [
    { seat: 3, action: 'raise', street: 'preflop', order: 1, amount: 3 },
    { seat: 5, action: 'call', street: 'preflop', order: 2, amount: 3 },
  ],
  communityCards: ['Ah', 'Kc', '7d'],
  holeCards: ['As', 'Kd'],
  pfAggressor: 3,
  ...overrides,
});

/** Turn live context */
export const ctxTurn = (overrides = {}) => ({
  state: 'TURN',
  currentStreet: 'turn',
  heroSeat: 5,
  handNumber: 'HAND_001',
  pot: 24,
  activeSeatNumbers: [3, 5],
  foldedSeats: [1, 7, 9],
  communityCards: ['Ah', 'Kc', '7d', '3s'],
  holeCards: ['As', 'Kd'],
  pfAggressor: 3,
  ...overrides,
});

/** River live context */
export const ctxRiver = (overrides = {}) => ({
  state: 'RIVER',
  currentStreet: 'river',
  heroSeat: 5,
  handNumber: 'HAND_001',
  pot: 40,
  activeSeatNumbers: [3, 5],
  foldedSeats: [1, 7, 9],
  communityCards: ['Ah', 'Kc', '7d', '3s', '9h'],
  holeCards: ['As', 'Kd'],
  pfAggressor: 3,
  ...overrides,
});

/** Dealing context (new hand start) */
export const ctxDealing = (overrides = {}) => ({
  state: 'DEALING',
  currentStreet: null,
  heroSeat: 5,
  handNumber: overrides.handNumber || 'HAND_002',
  pot: 0,
  activeSeatNumbers: [1, 3, 5, 7, 9],
  foldedSeats: [],
  actionSequence: [],
  communityCards: [],
  holeCards: [],
  ...overrides,
});

/** Preflop advice */
export const advPreflop = (overrides = {}) => ({
  currentStreet: 'preflop',
  villainSeat: 3,
  recommendations: [{ action: 'raise', ev: 3.5, sizing: '3bb' }],
  ...overrides,
});

/** Flop advice */
export const advFlop = (overrides = {}) => ({
  currentStreet: 'flop',
  villainSeat: 3,
  recommendations: [{ action: 'call', ev: 2.1, sizing: null }],
  foldPct: 42,
  heroEquity: 0.55,
  ...overrides,
});

/** Turn advice */
export const advTurn = (overrides = {}) => ({
  currentStreet: 'turn',
  villainSeat: 3,
  recommendations: [{ action: 'bet', ev: 5.5, sizing: '66%' }],
  foldPct: 48,
  heroEquity: 0.60,
  ...overrides,
});

/** River advice */
export const advRiver = (overrides = {}) => ({
  currentStreet: 'river',
  villainSeat: 3,
  recommendations: [{ action: 'bet', ev: 8.5, sizing: '75%' }],
  foldPct: 55,
  heroEquity: 0.72,
  ...overrides,
});
