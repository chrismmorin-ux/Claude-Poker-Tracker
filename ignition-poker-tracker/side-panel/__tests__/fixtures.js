/**
 * fixtures.js — Comprehensive state snapshots for sidebar testing.
 *
 * Each fixture is a complete state object that can be passed to the
 * extracted render-orchestrator functions. Covers every major scenario
 * and regression category.
 *
 * Shape: {
 *   cachedSeatStats, currentTableState, currentLiveContext, lastGoodAdvice,
 *   appSeatData, pinnedVillainSeat, lastGoodExploits, lastGoodTournament,
 *   cachedSeatMap, focusedVillainSeat (computed or overridden)
 * }
 */

// =========================================================================
// SHARED BUILDING BLOCKS
// =========================================================================

const makeStats = (seat, vpip, pfr, af, style, sampleSize) => ({
  seat, vpip, pfr, af, style, sampleSize,
  threeBet: null, cbet: null, foldToCbet: null,
});

const makeAppSeat = (style, sampleSize, headline, profile = null, stats = null) => ({
  exploitCount: 0, weaknessCount: 0,
  style, sampleSize,
  stats,
  villainHeadline: headline,
  villainProfile: profile,
});

/**
 * Build a test range (169 values) where the top N cells are filled with given weight.
 */
const makeTestRange = (filledCount = 40, weight = 0.8) => {
  const r = new Array(169).fill(0);
  for (let i = 0; i < filledCount && i < 169; i++) r[i] = weight;
  return r;
};

// =========================================================================
// 1. FLOP WITH ADVICE — Full happy path
// =========================================================================

export const flopWithAdvice = {
  cachedSeatStats: {
    1: makeStats(1, 45, 8, 0.7, 'Fish', 30),
    3: makeStats(3, 22, 18, 2.1, 'TAG', 45),
    5: makeStats(5, 28, 22, 1.8, 'Hero', 100),
    7: makeStats(7, 55, 12, 0.5, 'Fish', 15),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [1, 3, 5, 7] },
  currentLiveContext: {
    state: 'FLOP',
    currentStreet: 'flop',
    heroSeat: 5,
    communityCards: ['A\u2660', 'K\u2665', '7\u2663', '', ''],
    holeCards: ['Q\u2660', 'J\u2660'],
    pot: 18.5,
    activeSeatNumbers: [1, 3, 5, 7],
    foldedSeats: [],
    dealerSeat: 3,
    pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 6, street: 'preflop', order: 2 },
      { seat: 1, action: 'call', amount: 6, street: 'preflop', order: 3 },
      { seat: 3, action: 'bet', amount: 12, street: 'flop', order: 4 },
    ],
  },
  lastGoodAdvice: {
    currentStreet: 'flop',
    villainSeat: 3,
    villainStyle: 'TAG',
    villainSampleSize: 45,
    potSize: 18.5,
    heroEquity: 0.58,
    foldPct: { bet: 0.35 },
    foldMeta: {
      curve: [
        { sizing: 0.33, foldPct: 0.22 },
        { sizing: 0.50, foldPct: 0.30 },
        { sizing: 0.75, foldPct: 0.38 },
        { sizing: 1.00, foldPct: 0.45 },
        { sizing: 1.50, foldPct: 0.52 },
        { sizing: 2.00, foldPct: 0.58 },
      ],
      curveSource: 'personalized',
      bet: {
        baseEstimate: 0.35,
        source: 'model+observed',
        adjustments: [
          { factor: 'af', multiplier: 1.05 },
          { factor: 'vpip', multiplier: 0.97 },
        ],
      },
    },
    recommendations: [
      {
        action: 'call',
        ev: 1.8,
        sizing: null,
        reasoning: 'Strong draw — call to realize equity',
        handPlan: {
          ifCall: { note: 'Barrel favorable turns', favorableRunouts: 18, totalRunouts: 47, scaryCards: 3, scaryCardRanks: ['A', 'K', 'Q'] },
          ifRaise: { note: 'Fold — behind vs TAG' },
        },
        villainResponse: { fold: { pct: 0.35 }, call: { pct: 0.55 }, raise: { pct: 0.10 } },
        risk: 'M',
      },
      {
        action: 'raise',
        ev: 0.4,
        sizing: { betFraction: 2.5, betSize: 46, foldPct: 0.52 },
        reasoning: 'Semi-bluff raise — fold equity + draw equity',
      },
    ],
    treeMetadata: {
      depthReached: 2,
      spr: 4.2,
      branches: 4,
      computeMs: 180,
      comboCounted: true,
      dynamicAnchors: true,
      numOpponents: 1,
      comboStats: { total: 131, ahead: 56, behind: 62, tied: 13 },
      blockerEffects: { nutFlush: -0.12, air: -0.05 },
      advantage: { rangeAdvantage: 0.08 },
    },
    modelQuality: { overallSource: 'player_model' },
    villainProfile: {
      headline: 'Tight aggressive — selective but aggressive postflop',
      streets: {
        preflop: { tendency: 'Selective opener — raises strong hands', confidence: 0.85 },
        flop: { tendency: 'C-bets frequently, folds to raises', confidence: 0.72 },
      },
      vulnerabilities: [
        { label: 'Overfolds to flop raises', severity: 0.75, exploitHint: 'Raise wide on dry boards' },
        { label: 'Shutdown on wet turns', severity: 0.55, exploitHint: 'Barrel turn after flop call' },
      ],
    },
    segmentation: {
      handTypes: {
        overpair: { count: 6, weightSum: 6, pct: 9.1, avgDrawOuts: 0 },
        topPairGood: { count: 10, weightSum: 10, pct: 15.2, avgDrawOuts: 0 },
        middlePair: { count: 8, weightSum: 8, pct: 12.1, avgDrawOuts: 0 },
        nutFlushDraw: { count: 4, weightSum: 4, pct: 6.1, avgDrawOuts: 9 },
        oesd: { count: 5, weightSum: 5, pct: 7.6, avgDrawOuts: 8 },
        air: { count: 33, weightSum: 33, pct: 50.0, avgDrawOuts: 0 },
      },
      totalCombos: 66,
      totalWeight: 66,
    },
    villainRanges: [
      { seat: 3, position: 'CO', actionKey: 'open', range: makeTestRange(35, 0.75), rangeWidth: 22, equity: 0.58, equityCI: [0.54, 0.62], narrowedFrom: 28, active: true },
      { seat: 1, position: 'UTG', actionKey: 'coldCall', range: makeTestRange(25, 0.6), rangeWidth: 15, equity: 0.65, equityCI: [0.60, 0.70], narrowedFrom: 22, active: true },
    ],
    multiwayEquity: { equity: 0.38, ci: null, method: 'pairwise' },
    narrowingLog: [
      { street: 'flop', seat: 3, action: 'bet', fromWidth: 28, toWidth: 22, description: 'Bet \u2192 top 22% by equity' },
    ],
  },
  appSeatData: {
    1: makeAppSeat('Fish', 30, 'Loose passive — calls too wide'),
    3: makeAppSeat('TAG', 45, 'Tight aggressive — selective but aggressive postflop', {
      headline: 'Tight aggressive — selective but aggressive postflop',
      streets: { preflop: { tendency: 'Selective opener' } },
    }, { cbet: 72, foldToCbet: 28 }),
    7: makeAppSeat('Fish', 15, 'Very loose — plays almost any hand'),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 2. PREFLOP NO ADVICE — "Analyzing..." state
// =========================================================================

export const preflopNoAdvice = {
  cachedSeatStats: {
    2: makeStats(2, 35, 10, 0.8, 'Fish', 20),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 50),
    8: makeStats(8, 18, 15, 2.5, 'TAG', 35),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [2, 5, 8] },
  currentLiveContext: {
    state: 'PREFLOP',
    currentStreet: 'preflop',
    heroSeat: 5,
    communityCards: ['', '', '', '', ''],
    holeCards: ['A\u2665', 'K\u2660'],
    pot: 3,
    activeSeatNumbers: [2, 5, 8],
    foldedSeats: [1, 3, 4, 6, 7, 9],
    dealerSeat: 8,
    pfAggressor: null,
    actionSequence: [],
  },
  lastGoodAdvice: null,
  appSeatData: {
    2: makeAppSeat('Fish', 20, 'Loose passive fish'),
    8: makeAppSeat('TAG', 35, 'Tight aggressive reg'),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 3. PREFLOP WITH ADVICE — Hand plan + flop archetype
// =========================================================================

export const preflopWithAdvice = {
  cachedSeatStats: {
    3: makeStats(3, 48, 8, 0.6, 'Fish', 25),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 50),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [3, 5] },
  currentLiveContext: {
    state: 'PREFLOP',
    currentStreet: 'preflop',
    heroSeat: 5,
    communityCards: ['', '', '', '', ''],
    holeCards: ['J\u2665', 'T\u2665'],
    pot: 5,
    activeSeatNumbers: [3, 5],
    foldedSeats: [1, 2, 4, 6, 7, 8, 9],
    dealerSeat: 5,
    pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'raise', amount: 6, street: 'preflop', order: 1 },
    ],
  },
  lastGoodAdvice: {
    currentStreet: 'preflop',
    situation: 'facing_raise',
    villainSeat: 3,
    villainStyle: 'Fish',
    villainSampleSize: 25,
    potSize: 5,
    heroEquity: 0.42,
    foldPct: { bet: 0.15 },
    recommendations: [
      {
        action: 'call',
        ev: 0.8,
        reasoning: 'Suited connector — call to set mine',
        handPlan: {
          ifCall: { note: 'Check-raise wet flops', favorableRunouts: 22, totalRunouts: 47 },
          ifRaise: { note: 'Unlikely to fold — calling station' },
        },
      },
    ],
    flopBreakdown: [
      { archetype: 'top_pair', probability: 0.16 },
      { archetype: 'flush_draw', probability: 0.11 },
      { archetype: 'straight_draw', probability: 0.08 },
      { archetype: 'miss', probability: 0.52 },
      { archetype: 'set', probability: 0.01 },
    ],
    treeMetadata: { depthReached: 2, spr: 8.5, branches: 3, computeMs: 120 },
    modelQuality: { overallSource: 'mixed' },
    villainProfile: {
      headline: 'Loose passive — calls too wide, folds to aggression',
      streets: { preflop: { tendency: 'Limps frequently, calls wide', confidence: 0.80 } },
      vulnerabilities: [
        { label: 'Calls too wide preflop', severity: 0.85, exploitHint: 'Value bet thinner' },
      ],
    },
    segmentation: null,
    villainRanges: [
      { seat: 3, position: 'MP2', actionKey: 'open', range: makeTestRange(50, 0.7), rangeWidth: 35, equity: 0.42, equityCI: [0.38, 0.46], narrowedFrom: 35, active: true },
    ],
    multiwayEquity: null,
    narrowingLog: [],
  },
  appSeatData: {
    3: makeAppSeat('Fish', 25, 'Loose passive — calls too wide', {
      headline: 'Loose passive — calls too wide',
      streets: { preflop: { tendency: 'Limps frequently' } },
    }, { cbet: 45, foldToCbet: 55 }),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 4. TURN BARREL — Turn with barrel recommendation
// =========================================================================

export const turnBarrel = {
  cachedSeatStats: {
    3: makeStats(3, 42, 10, 0.7, 'Fish', 28),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 50),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [3, 5] },
  currentLiveContext: {
    state: 'TURN',
    currentStreet: 'turn',
    heroSeat: 5,
    communityCards: ['A\u2660', '8\u2665', '3\u2663', 'K\u2660', ''],
    holeCards: ['A\u2665', 'Q\u2666'],
    pot: 24,
    activeSeatNumbers: [3, 5],
    foldedSeats: [],
    dealerSeat: 5,
    pfAggressor: 5,
    actionSequence: [
      { seat: 5, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 3, action: 'call', amount: 6, street: 'preflop', order: 2 },
      { seat: 5, action: 'bet', amount: 8, street: 'flop', order: 3 },
      { seat: 3, action: 'call', amount: 8, street: 'flop', order: 4 },
    ],
  },
  lastGoodAdvice: {
    currentStreet: 'turn',
    villainSeat: 3,
    villainStyle: 'Fish',
    villainSampleSize: 28,
    potSize: 24,
    heroEquity: 0.72,
    foldPct: { bet: 0.38 },
    recommendations: [
      {
        action: 'bet',
        ev: 4.2,
        sizing: { betFraction: 0.67, betSize: 16, foldPct: 0.38 },
        reasoning: 'Value bet — top pair top kicker against wide calling range',
        villainResponse: { fold: { pct: 0.52 }, call: { pct: 0.38 }, raise: { pct: 0.10 } },
        risk: 'L',
        handPlan: {
          ifCall: { plan: 'barrel', note: 'Continue betting ~67% pot on safe runouts', scaryCards: 2, scaryCardRanks: ['A', '9'], favorableRunouts: 30, totalRunouts: 44 },
          ifRaise: { plan: 'fold', note: 'Fold — their raise range is too strong here' },
        },
      },
    ],
    treeMetadata: { depthReached: 2, spr: 2.8, branches: 3, computeMs: 95 },
    modelQuality: { overallSource: 'player_model' },
    villainProfile: { headline: 'Loose passive fish — calls too wide' },
    segmentation: {
      handTypes: {
        topPairWeak: { count: 8, weightSum: 8, pct: 18, avgDrawOuts: 0 },
        middlePair: { count: 10, weightSum: 10, pct: 22, avgDrawOuts: 0 },
        air: { count: 27, weightSum: 27, pct: 60, avgDrawOuts: 0 },
      },
      totalCombos: 45,
    },
  },
  appSeatData: {
    3: makeAppSeat('Fish', 28, 'Loose passive fish'),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 5. RIVER VALUE BET — Multi-sizing fold table
// =========================================================================

export const riverValueBet = {
  cachedSeatStats: {
    3: makeStats(3, 42, 10, 0.7, 'Fish', 28),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 50),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [3, 5] },
  currentLiveContext: {
    state: 'RIVER',
    currentStreet: 'river',
    heroSeat: 5,
    communityCards: ['A\u2660', '8\u2665', '3\u2663', 'K\u2660', '2\u2666'],
    holeCards: ['A\u2665', 'Q\u2666'],
    pot: 56,
    activeSeatNumbers: [3, 5],
    foldedSeats: [],
    dealerSeat: 5,
    pfAggressor: 5,
    actionSequence: [],
  },
  lastGoodAdvice: {
    currentStreet: 'river',
    villainSeat: 3,
    villainStyle: 'Fish',
    villainSampleSize: 28,
    potSize: 56,
    heroEquity: 0.82,
    foldPct: { bet: 0.30 },
    foldMeta: {
      curve: [
        { sizing: 0.33, foldPct: 0.18 },
        { sizing: 0.50, foldPct: 0.25 },
        { sizing: 0.75, foldPct: 0.32 },
        { sizing: 1.00, foldPct: 0.38 },
        { sizing: 1.50, foldPct: 0.48 },
        { sizing: 2.00, foldPct: 0.55 },
      ],
      curveSource: 'personalized',
    },
    recommendations: [
      {
        action: 'bet',
        ev: 8.5,
        sizing: { betFraction: 0.75, betSize: 42, foldPct: 0.32 },
        reasoning: 'Value bet — TPTK, villain range is mostly worse pairs and air',
      },
    ],
    treeMetadata: { depthReached: 1, spr: 1.2 },
    modelQuality: { overallSource: 'player_model' },
    villainProfile: { headline: 'Loose passive fish — calls too wide' },
    segmentation: {
      handTypes: {
        topPairWeak: { count: 5, weightSum: 5, pct: 16, avgDrawOuts: 0 },
        middlePair: { count: 6, weightSum: 6, pct: 19, avgDrawOuts: 0 },
        air: { count: 20, weightSum: 20, pct: 65, avgDrawOuts: 0 },
      },
      totalCombos: 31,
    },
  },
  appSeatData: { 3: makeAppSeat('Fish', 28, 'Loose passive fish') },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 6. BETWEEN HANDS — Villain scouting
// =========================================================================

export const betweenHands = {
  cachedSeatStats: {
    1: makeStats(1, 45, 8, 0.7, 'Fish', 30),
    3: makeStats(3, 22, 18, 2.1, 'TAG', 45),
    5: makeStats(5, 28, 22, 1.8, 'Hero', 100),
    7: makeStats(7, 12, 10, 3.5, 'Nit', 55),
  },
  currentTableState: { heroSeat: 5, state: 'IDLE', activeSeats: [1, 3, 5, 7] },
  currentLiveContext: null,
  lastGoodAdvice: null,
  appSeatData: {
    1: makeAppSeat('Fish', 30, 'Loose passive — calls everything'),
    3: makeAppSeat('TAG', 45, 'Tight aggressive regular', {
      headline: 'Tight aggressive regular',
      streets: { preflop: { tendency: 'Selective opener' } },
    }),
    7: makeAppSeat('Nit', 55, 'Very tight — only plays premiums'),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 7. BETWEEN HANDS + TOURNAMENT — ICM bubble
// =========================================================================

export const betweenHandsTournament = {
  cachedSeatStats: {
    2: makeStats(2, 38, 12, 1.0, 'LAG', 20),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 50),
  },
  currentTableState: { heroSeat: 5, state: 'IDLE', activeSeats: [2, 5] },
  currentLiveContext: null,
  lastGoodAdvice: null,
  appSeatData: {
    2: makeAppSeat('LAG', 20, 'Loose aggressive — raises wide'),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: {
    heroMRatio: 8.5,
    playersRemaining: 22,
    totalEntrants: 120,
    currentLevelIndex: 8,
    currentBlinds: { sb: 200, bb: 400, ante: 50 },
    nextBlinds: { sb: 300, bb: 600, ante: 75 },
    heroStack: 6800,
    avgStack: 10909,
    mRatioGuidance: { zone: 'caution', label: 'Caution zone — open-shove or fold from late position' },
    icmPressure: { zone: 'approaching', playersFromBubble: 4 },
    blindOutInfo: { levelsRemaining: 3, wallClockMinutes: 24 },
    progress: 82,
    predictions: {
      milestones: [
        { milestone: 'bubble', estimatedMinutes: 12 },
        { milestone: 'finalTable', estimatedMinutes: 45 },
      ],
    },
  },
  cachedSeatMap: { 2: 'P4', 5: 'P1' },
};

// =========================================================================
// 8. HERO FOLDED — Shows "Observing"
// =========================================================================

export const heroFolded = {
  cachedSeatStats: {
    3: makeStats(3, 42, 10, 0.7, 'Fish', 28),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 50),
    7: makeStats(7, 20, 16, 2.0, 'TAG', 40),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [3, 5, 7] },
  currentLiveContext: {
    state: 'FLOP',
    currentStreet: 'flop',
    heroSeat: 5,
    communityCards: ['T\u2660', '6\u2665', '2\u2663', '', ''],
    holeCards: ['8\u2666', '4\u2663'],
    pot: 15,
    activeSeatNumbers: [3, 7],
    foldedSeats: [5],
    dealerSeat: 7,
    pfAggressor: 7,
    actionSequence: [
      { seat: 7, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 5, action: 'fold', amount: 0, street: 'preflop', order: 2 },
      { seat: 3, action: 'call', amount: 6, street: 'preflop', order: 3 },
    ],
  },
  lastGoodAdvice: {
    currentStreet: 'flop',
    villainSeat: 7,
    villainStyle: 'TAG',
    villainSampleSize: 40,
    potSize: 15,
    heroEquity: 0.12,
    foldPct: null,
    recommendations: [
      { action: 'fold', ev: 0, reasoning: 'Already folded — observing' },
    ],
    treeMetadata: { depthReached: 0 },
    modelQuality: { overallSource: 'population' },
    villainProfile: { headline: 'Tight aggressive regular' },
    segmentation: null,
  },
  appSeatData: {
    3: makeAppSeat('Fish', 28, 'Loose passive fish'),
    7: makeAppSeat('TAG', 40, 'Tight aggressive regular'),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 9. NO TABLE — Empty state
// =========================================================================

export const noTable = {
  cachedSeatStats: null,
  currentTableState: null,
  currentLiveContext: null,
  lastGoodAdvice: null,
  appSeatData: {},
  pinnedVillainSeat: null,
  lastGoodExploits: null,
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 10. PINNED VILLAIN OVERRIDE — Pinned differs from advice villain
// =========================================================================

export const pinnedVillainOverride = {
  ...flopWithAdvice,
  pinnedVillainSeat: 1,
  appSeatData: {
    ...flopWithAdvice.appSeatData,
    1: makeAppSeat('Fish', 30, 'Loose passive — calls everything', {
      headline: 'Loose passive — calls everything',
      streets: { preflop: { tendency: 'Limps wide' } },
      vulnerabilities: [{ label: 'Never folds to c-bets', severity: 0.9 }],
    }),
  },
};

// =========================================================================
// 11. FULL NINE-HANDED — All seats with varied states
// =========================================================================

export const fullNineHanded = {
  cachedSeatStats: {
    1: makeStats(1, 45, 8, 0.7, 'Fish', 30),
    2: makeStats(2, 38, 25, 3.2, 'LAG', 22),
    3: makeStats(3, 22, 18, 2.1, 'TAG', 45),
    4: makeStats(4, 12, 10, 4.0, 'Nit', 60),
    5: makeStats(5, 28, 22, 1.8, 'Hero', 100),
    6: makeStats(6, 32, 14, 1.2, 'LP', 18),
    7: makeStats(7, 55, 12, 0.5, 'Fish', 15),
    8: makeStats(8, 0, 0, 0, 'Unknown', 3),
    9: makeStats(9, 20, 16, 2.0, 'Reg', 35),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  currentLiveContext: {
    state: 'FLOP',
    currentStreet: 'flop',
    heroSeat: 5,
    communityCards: ['Q\u2665', '9\u2660', '4\u2666', '', ''],
    holeCards: ['K\u2665', 'Q\u2663'],
    pot: 22,
    activeSeatNumbers: [1, 2, 3, 5, 7, 9],
    foldedSeats: [4, 6, 8],
    dealerSeat: 9,
    pfAggressor: 2,
    actionSequence: [
      { seat: 2, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 3, action: 'call', amount: 6, street: 'preflop', order: 2 },
      { seat: 5, action: 'call', amount: 6, street: 'preflop', order: 3 },
      { seat: 7, action: 'call', amount: 6, street: 'preflop', order: 4 },
      { seat: 9, action: 'call', amount: 6, street: 'preflop', order: 5 },
      { seat: 1, action: 'call', amount: 6, street: 'preflop', order: 6 },
      { seat: 2, action: 'bet', amount: 15, street: 'flop', order: 7 },
    ],
  },
  lastGoodAdvice: null,
  appSeatData: {
    1: makeAppSeat('Fish', 30, 'Loose passive fish'),
    2: makeAppSeat('LAG', 22, 'Loose aggressive maniac'),
    3: makeAppSeat('TAG', 45, 'Tight aggressive regular'),
    4: makeAppSeat('Nit', 60, 'Extreme nit — only premiums'),
    6: makeAppSeat('LP', 18, 'Loose passive station'),
    7: makeAppSeat('Fish', 15, 'Very loose'),
    9: makeAppSeat('Reg', 35, 'Solid regular'),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 12. NULL EDGES — Everything null/empty
// =========================================================================

export const nullEdges = {
  cachedSeatStats: {},
  currentTableState: null,
  currentLiveContext: null,
  lastGoodAdvice: null,
  appSeatData: {},
  pinnedVillainSeat: null,
  lastGoodExploits: null,
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 13. PINNED VILLAIN FOLDED — Pinned villain is in foldedSeats
// =========================================================================

export const pinnedVillainFolded = {
  ...flopWithAdvice,
  pinnedVillainSeat: 1,
  currentLiveContext: {
    ...flopWithAdvice.currentLiveContext,
    foldedSeats: [1],
    activeSeatNumbers: [3, 5, 7],
  },
};

// =========================================================================
// 14. HEADS UP — Only 2 seats active
// =========================================================================

export const headsUp = {
  cachedSeatStats: {
    3: makeStats(3, 42, 10, 0.7, 'Fish', 28),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 50),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [3, 5] },
  currentLiveContext: {
    state: 'FLOP',
    currentStreet: 'flop',
    heroSeat: 5,
    communityCards: ['J\u2660', '8\u2665', '2\u2663', '', ''],
    holeCards: ['A\u2660', 'A\u2665'],
    pot: 12,
    activeSeatNumbers: [3, 5],
    foldedSeats: [],
    dealerSeat: 5,
    pfAggressor: 5,
    actionSequence: [
      { seat: 5, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 3, action: 'call', amount: 6, street: 'preflop', order: 2 },
    ],
  },
  lastGoodAdvice: {
    currentStreet: 'flop',
    villainSeat: 3,
    villainStyle: 'Fish',
    villainSampleSize: 28,
    potSize: 12,
    heroEquity: 0.85,
    foldPct: { bet: 0.25 },
    recommendations: [
      {
        action: 'bet',
        ev: 3.5,
        sizing: { betFraction: 0.75, betSize: 9, foldPct: 0.25 },
        reasoning: 'Value bet — overpair on dry board',
      },
    ],
    treeMetadata: { depthReached: 2, spr: 5.0 },
    modelQuality: { overallSource: 'player_model' },
    villainProfile: { headline: 'Loose passive fish — calls too wide' },
    segmentation: null,
  },
  appSeatData: { 3: makeAppSeat('Fish', 28, 'Loose passive fish') },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 15. APP DISCONNECTED — No exploit data, no app
// =========================================================================

export const appDisconnected = {
  cachedSeatStats: {
    3: makeStats(3, 42, 10, 0.7, 'Fish', 28),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 50),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [3, 5] },
  currentLiveContext: {
    state: 'FLOP',
    currentStreet: 'flop',
    heroSeat: 5,
    communityCards: ['T\u2660', '7\u2665', '3\u2663', '', ''],
    holeCards: ['K\u2660', 'Q\u2660'],
    pot: 8,
    activeSeatNumbers: [3, 5],
    foldedSeats: [],
    dealerSeat: 3,
    pfAggressor: null,
    actionSequence: [],
  },
  lastGoodAdvice: null,
  appSeatData: {},
  pinnedVillainSeat: null,
  lastGoodExploits: null,
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 16. ALL FOLDED TO HERO — Solo pot
// =========================================================================

export const allFoldedToHero = {
  cachedSeatStats: {
    1: makeStats(1, 45, 8, 0.7, 'Fish', 30),
    3: makeStats(3, 22, 18, 2.1, 'TAG', 45),
    5: makeStats(5, 28, 22, 1.8, 'Hero', 100),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [1, 3, 5] },
  currentLiveContext: {
    state: 'FLOP',
    currentStreet: 'flop',
    heroSeat: 5,
    communityCards: ['A\u2660', '8\u2665', '3\u2663', '', ''],
    holeCards: ['A\u2665', 'K\u2666'],
    pot: 18,
    activeSeatNumbers: [5],
    foldedSeats: [1, 3],
    dealerSeat: 1,
    pfAggressor: 5,
    actionSequence: [
      { seat: 5, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 1, action: 'fold', amount: 0, street: 'preflop', order: 2 },
      { seat: 3, action: 'fold', amount: 0, street: 'preflop', order: 3 },
    ],
  },
  lastGoodAdvice: null,
  appSeatData: {
    1: makeAppSeat('Fish', 30, 'Loose passive fish'),
    3: makeAppSeat('TAG', 45, 'Tight aggressive regular'),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 17. MIXED SPOT — Two near-optimal actions with mix frequencies
// =========================================================================

export const mixedSpot = {
  cachedSeatStats: {
    3: makeStats(3, 30, 22, 1.9, 'TAG', 60),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 100),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [3, 5] },
  currentLiveContext: {
    state: 'TURN',
    currentStreet: 'turn',
    heroSeat: 5,
    communityCards: ['T\u2660', '7\u2665', '4\u2663', '2\u2666', ''],
    holeCards: ['A\u2660', '9\u2660'],
    pot: 22,
    activeSeatNumbers: [3, 5],
    foldedSeats: [],
    dealerSeat: 5,
    pfAggressor: 5,
    actionSequence: [
      { seat: 5, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 3, action: 'call', amount: 6, street: 'preflop', order: 2 },
      { seat: 5, action: 'bet', amount: 8, street: 'flop', order: 3 },
      { seat: 3, action: 'call', amount: 8, street: 'flop', order: 4 },
    ],
  },
  lastGoodAdvice: {
    currentStreet: 'turn',
    villainSeat: 3,
    villainStyle: 'TAG',
    villainSampleSize: 60,
    potSize: 22,
    heroEquity: 0.44,
    foldPct: { bet: 0.45 },
    recommendations: [
      {
        action: 'bet',
        ev: 0.3,
        sizing: { betFraction: 0.67, betSize: 15, foldPct: 0.45 },
        reasoning: 'Semi-bluff barrel — flush draw with overcard',
        mixFrequency: 0.6,
        risk: 'M',
        villainResponse: { fold: { pct: 0.45 }, call: { pct: 0.45 }, raise: { pct: 0.10 } },
      },
      {
        action: 'check',
        ev: 0.1,
        reasoning: 'Pot control — realize equity without risking raise',
        mixFrequency: 0.4,
      },
    ],
    treeMetadata: { depthReached: 2, spr: 3.1, branches: 3, computeMs: 110 },
    modelQuality: { overallSource: 'player_model' },
    villainProfile: { headline: 'TAG — balanced but check-raises dry turns' },
    segmentation: null,
  },
  appSeatData: {
    3: makeAppSeat('TAG', 60, 'TAG — balanced but check-raises dry turns'),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 18. AGGRESSOR FACING CHECK — Hero is PFA, villain checked (IP with initiative)
// =========================================================================

export const aggFacingCheck = {
  cachedSeatStats: {
    3: makeStats(3, 38, 12, 0.8, 'Fish', 40),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 100),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [3, 5] },
  currentLiveContext: {
    state: 'FLOP',
    currentStreet: 'flop',
    heroSeat: 5,
    communityCards: ['J\u2660', '8\u2665', '3\u2663', '', ''],
    holeCards: ['A\u2660', 'K\u2660'],
    pot: 14,
    activeSeatNumbers: [3, 5],
    foldedSeats: [],
    dealerSeat: 5,
    pfAggressor: 5,
    actionSequence: [
      { seat: 5, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 3, action: 'call', amount: 6, street: 'preflop', order: 2 },
      { seat: 3, action: 'check', amount: 0, street: 'flop', order: 3 },
    ],
  },
  lastGoodAdvice: {
    currentStreet: 'flop',
    villainSeat: 3,
    villainStyle: 'Fish',
    villainSampleSize: 40,
    potSize: 14,
    heroEquity: 0.55,
    foldPct: { bet: 0.40 },
    recommendations: [
      {
        action: 'bet',
        ev: 2.1,
        sizing: { betFraction: 0.50, betSize: 7, foldPct: 0.40 },
        reasoning: 'C-bet for value — overcards with backdoor flush draw',
        risk: 'L',
        villainResponse: { fold: { pct: 0.40 }, call: { pct: 0.52 }, raise: { pct: 0.08 } },
        handPlan: {
          ifCall: { plan: 'barrel', note: 'Barrel turn on safe cards', scaryCards: 2, scaryCardRanks: ['A', 'K'], favorableRunouts: 28, totalRunouts: 44 },
          ifRaise: { plan: 'fold', note: 'Fold — fish check-raise means strength' },
          ifVillainChecks: { plan: 'bet', sizing: 0.50, note: 'Bet ~50% pot on the next street' },
        },
      },
    ],
    treeMetadata: { depthReached: 2, spr: 5.0, branches: 3, computeMs: 90 },
    modelQuality: { overallSource: 'player_model' },
    villainProfile: {
      headline: 'Loose passive fish — calls too wide, folds to aggression',
      showdownAnchors: [{ handDescription: 'S3 showed 72o bluff vs S7 (hand #47)', outcome: 'shown', position: 'BB', hand: '72o' }],
    },
    segmentation: null,
  },
  appSeatData: {
    3: makeAppSeat('Fish', 40, 'Loose passive fish — calls too wide'),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 19. CALLER FIRST TO ACT — Hero OOP without initiative
// =========================================================================

export const callerFirstToAct = {
  cachedSeatStats: {
    3: makeStats(3, 28, 22, 2.0, 'TAG', 55),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 100),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [3, 5] },
  currentLiveContext: {
    state: 'FLOP',
    currentStreet: 'flop',
    heroSeat: 5,
    communityCards: ['9\u2665', '6\u2663', '2\u2660', '', ''],
    holeCards: ['T\u2665', '9\u2663'],
    pot: 14,
    activeSeatNumbers: [3, 5],
    foldedSeats: [],
    dealerSeat: 3,
    pfAggressor: 3,
    actionSequence: [
      { seat: 3, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 5, action: 'call', amount: 6, street: 'preflop', order: 2 },
    ],
  },
  lastGoodAdvice: {
    currentStreet: 'flop',
    villainSeat: 3,
    villainStyle: 'TAG',
    villainSampleSize: 55,
    potSize: 14,
    heroEquity: 0.48,
    foldPct: { bet: 0.25 },
    recommendations: [
      {
        action: 'check',
        ev: 0.5,
        reasoning: 'Check to PFA — plan to check-call or check-raise',
        risk: 'L',
        handPlan: {
          ifVillainBets: { plan: 'call', note: 'Call — villain c-bets 72% of flops, your top pair is ahead' },
          ifVillainChecks: { plan: 'bet', sizing: 0.50, note: 'Bet ~50% pot for value on the turn' },
        },
      },
    ],
    treeMetadata: { depthReached: 2, spr: 5.0, branches: 3, computeMs: 85 },
    modelQuality: { overallSource: 'player_model' },
    villainProfile: { headline: 'Aggressive PFA — bets most flops, slows on paired boards' },
    segmentation: null,
  },
  appSeatData: {
    3: makeAppSeat('TAG', 55, 'Aggressive PFA — bets most flops'),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 20. PREFLOP CONTESTED — Hero facing 3-bet
// =========================================================================

export const preflopContested = {
  cachedSeatStats: {
    3: makeStats(3, 22, 18, 2.5, 'TAG', 70),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 100),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [3, 5] },
  currentLiveContext: {
    state: 'PREFLOP',
    currentStreet: 'preflop',
    heroSeat: 5,
    communityCards: ['', '', '', '', ''],
    holeCards: ['A\u2665', 'Q\u2660'],
    pot: 24,
    activeSeatNumbers: [3, 5],
    foldedSeats: [1, 2, 4, 6, 7, 8, 9],
    dealerSeat: 5,
    pfAggressor: 3,
    actionSequence: [
      { seat: 5, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 3, action: 'raise', amount: 18, street: 'preflop', order: 2 },
    ],
  },
  lastGoodAdvice: {
    currentStreet: 'preflop',
    situation: 'facing_3bet',
    villainSeat: 3,
    villainStyle: 'TAG',
    villainSampleSize: 70,
    potSize: 24,
    heroEquity: 0.42,
    foldPct: { bet: 0.55 },
    recommendations: [
      {
        action: 'call',
        ev: 0.6,
        reasoning: 'Call in position — re-evaluate on flop texture',
        risk: 'M',
        handPlan: {
          ifCall: { note: 'Check-raise wet flops for value', favorableRunouts: 20, totalRunouts: 47 },
        },
      },
    ],
    flopBreakdown: [
      { archetype: 'top_pair', probability: 0.18 },
      { archetype: 'flush_draw', probability: 0.08 },
      { archetype: 'miss', probability: 0.60 },
    ],
    treeMetadata: { depthReached: 2, spr: 3.5, branches: 3, computeMs: 100 },
    modelQuality: { overallSource: 'player_model' },
    villainProfile: { headline: 'TAG — 3-bets 7% from BTN, polarized range' },
    segmentation: null,
  },
  appSeatData: {
    3: makeAppSeat('TAG', 70, 'TAG — 3-bets 7% from BTN'),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// 21. HERO FOLDED (PROFITABLE) — Engine recommended call, hero folded
// =========================================================================

export const heroFoldedProfitable = {
  cachedSeatStats: {
    3: makeStats(3, 42, 10, 0.7, 'Fish', 28),
    5: makeStats(5, 25, 20, 1.5, 'Hero', 50),
    7: makeStats(7, 20, 16, 2.0, 'TAG', 40),
  },
  currentTableState: { heroSeat: 5, state: 'ACTIVE', activeSeats: [3, 5, 7] },
  currentLiveContext: {
    state: 'FLOP',
    currentStreet: 'flop',
    heroSeat: 5,
    communityCards: ['T\u2660', '6\u2665', '2\u2663', '', ''],
    holeCards: ['9\u2665', '8\u2665'],
    pot: 15,
    activeSeatNumbers: [3, 7],
    foldedSeats: [5],
    dealerSeat: 7,
    pfAggressor: 7,
    actionSequence: [
      { seat: 7, action: 'raise', amount: 6, street: 'preflop', order: 1 },
      { seat: 5, action: 'fold', amount: 0, street: 'preflop', order: 2 },
      { seat: 3, action: 'call', amount: 6, street: 'preflop', order: 3 },
    ],
  },
  lastGoodAdvice: {
    currentStreet: 'preflop',
    villainSeat: 7,
    villainStyle: 'TAG',
    villainSampleSize: 40,
    potSize: 9,
    heroEquity: 0.38,
    foldPct: null,
    recommendations: [
      { action: 'call', ev: 1.2, reasoning: 'Suited connector — call to set mine' },
      { action: 'fold', ev: 0, reasoning: 'Fold is break-even' },
    ],
    treeMetadata: { depthReached: 1 },
    modelQuality: { overallSource: 'mixed' },
    villainProfile: { headline: 'Tight aggressive regular' },
    segmentation: null,
  },
  appSeatData: {
    3: makeAppSeat('Fish', 28, 'Loose passive fish — calls everything', {
      headline: 'Loose passive fish — calls everything',
      streets: { preflop: { tendency: 'Limps frequently', confidence: 0.8 }, flop: { tendency: 'Calls any bet', confidence: 0.7 } },
      vulnerabilities: [
        { label: 'Calls too wide on flop', severity: 0.85, exploitHint: 'Value bet thinner' },
        { label: 'Folds to river bets 72%', severity: 0.70, exploitHint: 'Bluff rivers' },
        { label: 'Low check-raise frequency', severity: 0.55, exploitHint: 'Bet freely' },
      ],
    }),
    7: makeAppSeat('TAG', 40, 'Tight aggressive regular', {
      headline: 'Tight aggressive regular',
      streets: { preflop: { tendency: 'Selective opener', confidence: 0.85 } },
      vulnerabilities: [
        { label: 'Over-folds to turn bets', severity: 0.65, exploitHint: 'Barrel turns' },
      ],
      showdownAnchors: [{ handDescription: 'S7 opened KQs from CO (hand #31)', outcome: 'shown', position: 'CO', hand: 'KQs' }],
    }),
  },
  pinnedVillainSeat: null,
  lastGoodExploits: { seats: [], appConnected: true },
  lastGoodTournament: null,
  cachedSeatMap: null,
};

// =========================================================================
// ALL FIXTURES (for harness iteration)
// =========================================================================

export const ALL_FIXTURES = {
  flopWithAdvice,
  preflopNoAdvice,
  preflopWithAdvice,
  turnBarrel,
  riverValueBet,
  betweenHands,
  betweenHandsTournament,
  heroFolded,
  noTable,
  pinnedVillainOverride,
  fullNineHanded,
  nullEdges,
  pinnedVillainFolded,
  headsUp,
  appDisconnected,
  allFoldedToHero,
  mixedSpot,
  aggFacingCheck,
  callerFirstToAct,
  preflopContested,
  heroFoldedProfitable,
};
