/**
 * shared/wire-schemas.js — Single source of truth for cross-boundary message shapes
 *
 * Every message that crosses a boundary (Port, window.postMessage, chrome.runtime.sendMessage)
 * MUST be built by a function in this module. This eliminates manual field cherry-picking
 * and ensures schema changes are caught at compile/test time, not in production.
 *
 * Builders return the wire-format object. Validators return { valid, errors }.
 * Consumers: useSyncBridge.js, app-bridge.js, service-worker.js, side-panel.js
 */

// ============================================================================
// HELPERS
// ============================================================================

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';
const isNum = (v) => typeof v === 'number';
const isArr = Array.isArray;

const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
};

// ============================================================================
// SHARED FIELD LISTS (used by both exploit seat and advice builders)
// ============================================================================

const VILLAIN_PROFILE_FIELDS = [
  'headline', 'maturityLabel', 'totalObservations',
  'streets', 'aggressionResponse', 'rangeShape',
  'awareness', 'decisionModelShape', 'decisionModelDescription',
  'vulnerabilities',
];

const TREE_META_FIELDS = [
  'depth', 'depthReached', 'branches', 'computeMs',
  'street', 'spr', 'sprZone',
  'blockerEffects', 'advantage', 'comboStats',
  'numOpponents', 'comboCounted', 'dynamicAnchors',
];

const VILLAIN_RANGE_FIELDS = [
  'seat', 'position', 'actionKey', 'rangeWidth',
  'equity', 'equityCI', 'narrowedFrom', 'active',
];

const MODEL_QUALITY_FIELDS = [
  'facingBetConfidence', 'facingNoneConfidence', 'overallSource',
];

// ============================================================================
// EXPLOIT SEAT — tendency data for one seat (app → extension)
// ============================================================================

/**
 * Build the wire-format exploit seat from raw tendency data.
 * This is the ONLY place that defines which fields cross the wire.
 *
 * @param {string|number} seat - Seat identifier
 * @param {Object} data - Raw tendency data from useOnlineAnalysis
 * @returns {Object} Wire-format seat object
 */
export const buildExploitSeat = (seat, data) => ({
  seat,
  style: data.style || null,
  sampleSize: data.sampleSize || 0,
  exploits: (data.exploits || []).map(e => pick(e, [
    'id', 'label', 'category', 'street', 'statBasis', 'scoring', 'tier',
    'evidence', 'displayTier', 'source', 'position',
  ])),
  weaknesses: (data.weaknesses || []).slice(0, 10).map(w => pick(w, [
    'id', 'label', 'category', 'severity', 'confidence',
    'street', 'context', 'sampleSize', 'evidence', 'position',
  ])),
  briefings: (data.briefings || []).slice(0, 5).map(b => pick(b, [
    'ruleId', 'label', 'scoring', 'evidenceBreakdown', 'handExamples', 'riskAnalysis',
    'confidence', 'sampleSize', 'impact',
  ])),
  observations: (data.observations || []).slice(0, 24).map(o => pick(o, [
    'id', 'heroContext', 'heroContextLabel', 'signal', 'severity',
    'confidence', 'tier', 'street', 'evidence',
  ])),
  stats: {
    cbet: data.cbet ?? (data.rawStats?.pfAggressorFlops > 0
      ? Math.round((data.rawStats?.cbetCount || 0) / data.rawStats.pfAggressorFlops * 100) : null),
    foldToCbet: data.foldToCbet ?? (data.rawStats?.facedCbet > 0
      ? Math.round((data.rawStats?.foldedToCbet || 0) / data.rawStats.facedCbet * 100) : null),
    threeBet: data.threeBet ?? null,
  },
  villainHeadline: data.villainProfile?.headline || null,
  villainProfile: data.villainProfile
    ? pick(data.villainProfile, VILLAIN_PROFILE_FIELDS)
    : null,
});

export const validateExploitSeat = (seat) => {
  const errors = [];
  if (!isObj(seat)) return { valid: false, errors: ['seat must be an object'] };
  if (seat.seat === undefined) errors.push('missing seat identifier');
  if (!isArr(seat.exploits)) errors.push('exploits must be an array');
  if (!isArr(seat.weaknesses)) errors.push('weaknesses must be an array');
  if (!isArr(seat.briefings)) errors.push('briefings must be an array');
  if (!isArr(seat.observations)) errors.push('observations must be an array');
  if (!isObj(seat.stats)) errors.push('stats must be an object');
  return { valid: errors.length === 0, errors };
};

// ============================================================================
// ACTION ADVICE — live action recommendation (app → extension)
// ============================================================================

const ADVICE_FIELDS = [
  'villainSeat', 'villainStyle', 'villainSampleSize',
  'heroAlreadyActed', 'confidence', 'dataQuality',
  'situation', 'situationLabel', 'heroEquity', 'boardTexture',
  'segmentation', 'foldPct', 'foldMeta', 'recommendations',
  'currentStreet', 'potSize', 'villainBet', 'playerStats',
  'bucketEquities',
  'villainRanges', 'multiwayEquity', 'narrowingLog',
];

/**
 * Build the wire-format action advice from raw advice data.
 * Applies sub-picks to nested objects to keep wire lean.
 * @param {Object} advice - Raw advice from useLiveActionAdvisor
 * @returns {Object|null} Wire-format advice, or null if input is falsy
 */
export const buildActionAdvice = (advice) => {
  if (!advice) return null;
  const wire = pick(advice, ADVICE_FIELDS);
  if (advice.villainProfile) {
    wire.villainProfile = pick(advice.villainProfile, VILLAIN_PROFILE_FIELDS);
  }
  if (advice.modelQuality) {
    wire.modelQuality = pick(advice.modelQuality, MODEL_QUALITY_FIELDS);
  }
  if (advice.treeMetadata) {
    wire.treeMetadata = pick(advice.treeMetadata, TREE_META_FIELDS);
  }
  // Serialize villain ranges: Float64Array → plain Array for JSON compatibility
  if (advice.villainRanges) {
    wire.villainRanges = advice.villainRanges.map(vr => ({
      ...pick(vr, VILLAIN_RANGE_FIELDS),
      range: vr.range ? Array.from(vr.range) : null,
    }));
  }
  return wire;
};

export const validateActionAdvice = (advice) => {
  if (advice === null) return { valid: true, errors: [] };
  const errors = [];
  if (!isObj(advice)) return { valid: false, errors: ['advice must be an object or null'] };
  if (advice.situation === undefined) errors.push('missing situation');
  if (advice.recommendations === undefined) errors.push('missing recommendations');
  if (advice.villainRanges !== undefined && !isArr(advice.villainRanges)) errors.push('villainRanges must be array');
  if (advice.multiwayEquity !== undefined && !isObj(advice.multiwayEquity)) errors.push('multiwayEquity must be object');
  if (advice.narrowingLog !== undefined && !isArr(advice.narrowingLog)) errors.push('narrowingLog must be array');
  return { valid: errors.length === 0, errors };
};

// ============================================================================
// HAND COMPLETE — completed hand record (extension → app)
// ============================================================================

// Whitelisted fields for each sub-object — the ONLY fields that cross the wire.
const GAME_STATE_FIELDS = ['currentStreet', 'dealerButtonSeat', 'mySeat', 'actionSequence', 'absentSeats'];
const CARD_STATE_FIELDS = ['communityCards', 'holeCards', 'holeCardsVisible', 'allPlayerCards'];
const ACTION_ENTRY_FIELDS = ['seat', 'action', 'street', 'order', 'amount'];
const IGNITION_META_FIELDS = [
  'capturedAt', 'handNumber', 'blinds', 'ante', 'gameType', 'finalStacks',
  'pot', 'potDistribution', 'winners', 'seatDisplayMap', 'partial', 'reconnectInterrupted',
  'heroSeatConfidence',
];

// Valid values for action entry fields
const VALID_ACTIONS = new Set(['check', 'bet', 'call', 'raise', 'fold', 'mucked', 'won']);
const VALID_STREETS = new Set(['preflop', 'flop', 'turn', 'river', 'showdown']);
const CARD_RE = /^[2-9TJQKA][♥♦♣♠]$/;

/**
 * Build the wire-format hand message for relay through app-bridge.
 * Explicit whitelist ensures only known fields cross the boundary.
 * @param {Object} hand - Hand record from buildHandRecord()
 * @returns {Object|null} Wire-format hand object, or null if input is falsy
 */
export const buildHandForRelay = (hand) => {
  if (!hand) return null;

  const wire = {
    timestamp: hand.timestamp,
    version: hand.version,
    source: hand.source,
    tableId: hand.tableId,
    seatPlayers: hand.seatPlayers,
  };

  // gameState — whitelist + sanitize action entries
  if (isObj(hand.gameState)) {
    wire.gameState = pick(hand.gameState, GAME_STATE_FIELDS);
    if (isArr(wire.gameState.actionSequence)) {
      wire.gameState.actionSequence = wire.gameState.actionSequence.map(
        a => pick(a, ACTION_ENTRY_FIELDS)
      );
    }
  }

  // cardState — whitelist, preserve allPlayerCards structure
  if (isObj(hand.cardState)) {
    wire.cardState = pick(hand.cardState, CARD_STATE_FIELDS);
  }

  // ignitionMeta — whitelist
  if (isObj(hand.ignitionMeta)) {
    wire.ignitionMeta = pick(hand.ignitionMeta, IGNITION_META_FIELDS);
  }

  return wire;
};

/**
 * Validate a hand record for relay. Deep validation of action entries,
 * card formats, and ignitionMeta structure.
 */
export const validateHandForRelay = (hand) => {
  const errors = [];
  if (!isObj(hand)) return { valid: false, errors: ['hand must be an object'] };
  if (!isNum(hand.timestamp)) errors.push('missing or invalid timestamp');
  if (!isStr(hand.tableId) && hand.tableId !== undefined) errors.push('tableId must be a string');

  // gameState
  if (!isObj(hand.gameState)) {
    errors.push('missing hand.gameState');
  } else {
    if (!isStr(hand.gameState.currentStreet)) errors.push('gameState.currentStreet must be string');
    if (!isNum(hand.gameState.dealerButtonSeat) || hand.gameState.dealerButtonSeat < 1 || hand.gameState.dealerButtonSeat > 9) {
      errors.push('gameState.dealerButtonSeat must be 1-9');
    }
    if (!isNum(hand.gameState.mySeat) || hand.gameState.mySeat < 1 || hand.gameState.mySeat > 9) {
      errors.push('gameState.mySeat must be 1-9');
    }
    if (!isArr(hand.gameState.actionSequence)) {
      errors.push('gameState.actionSequence must be array');
    } else {
      // Validate each action entry
      for (let i = 0; i < hand.gameState.actionSequence.length; i++) {
        const a = hand.gameState.actionSequence[i];
        if (!isObj(a)) { errors.push(`action[${i}] must be an object`); continue; }
        if (!isNum(a.seat) || a.seat < 1 || a.seat > 9) errors.push(`action[${i}].seat must be 1-9`);
        if (!isStr(a.action) || !VALID_ACTIONS.has(a.action)) errors.push(`action[${i}].action invalid: ${a.action}`);
        if (!isStr(a.street) || !VALID_STREETS.has(a.street)) errors.push(`action[${i}].street invalid: ${a.street}`);
        if (!isNum(a.order) || a.order < 1) errors.push(`action[${i}].order must be positive`);
        if (a.amount !== undefined && (!isNum(a.amount) || a.amount < 0)) errors.push(`action[${i}].amount must be non-negative`);
      }
    }
  }

  // cardState
  if (!isObj(hand.cardState)) {
    errors.push('missing hand.cardState');
  } else {
    if (!isArr(hand.cardState.communityCards) || hand.cardState.communityCards.length !== 5) {
      errors.push('cardState.communityCards must be array of 5');
    } else {
      for (const c of hand.cardState.communityCards) {
        if (c !== '' && !CARD_RE.test(c)) errors.push(`invalid card: ${c}`);
      }
    }
    if (!isArr(hand.cardState.holeCards) || hand.cardState.holeCards.length !== 2) {
      errors.push('cardState.holeCards must be array of 2');
    } else {
      for (const c of hand.cardState.holeCards) {
        if (c !== '' && !CARD_RE.test(c)) errors.push(`invalid hole card: ${c}`);
      }
    }
  }

  // ignitionMeta
  if (hand.ignitionMeta !== undefined) {
    if (!isObj(hand.ignitionMeta)) {
      errors.push('ignitionMeta must be an object');
    } else {
      const m = hand.ignitionMeta;
      if (m.handNumber !== undefined && !isStr(m.handNumber) && !isNum(m.handNumber)) {
        errors.push('ignitionMeta.handNumber must be string or number');
      }
      if (m.blinds !== undefined) {
        if (!isObj(m.blinds) || !isNum(m.blinds.sb) || !isNum(m.blinds.bb)) {
          errors.push('ignitionMeta.blinds must be { sb: number, bb: number }');
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

// ============================================================================
// LIVE CONTEXT — in-progress hand state (extension → app)
// ============================================================================

const LIVE_CONTEXT_FIELDS = [
  'currentStreet', 'communityCards', 'holeCards', 'heroSeat', 'dealerSeat',
  'pot', 'foldedSeats', 'activeSeatNumbers', 'actionSequence', 'blinds',
  'ante', 'gameType', 'pfAggressor', 'handNumber', 'state', 'stacks',
  'seatDisplayMap', 'tournamentLevelInfo',
];

/**
 * Build the wire-format live context from HSM state.
 * @param {Object} context - From HandStateMachine.getLiveHandContext()
 * @returns {Object|null} Wire-format context, or null if input is falsy
 */
export const buildLiveContext = (context) => {
  if (!context) return null;
  return pick(context, LIVE_CONTEXT_FIELDS);
};

export const validateLiveContext = (context) => {
  if (context === null) return { valid: true, errors: [] };
  const errors = [];
  if (!isObj(context)) return { valid: false, errors: ['context must be an object or null'] };
  if (!isStr(context.currentStreet) && context.currentStreet !== null) {
    errors.push('currentStreet must be string or null');
  }
  return { valid: errors.length === 0, errors };
};

// ============================================================================
// STATUS — connection status (extension ↔ app)
// ============================================================================

/**
 * Build the wire-format status message.
 * @param {Object} opts
 * @param {boolean} opts.connected
 * @param {number} [opts.protocolVersion]
 * @param {boolean} [opts.contextDead]
 * @param {boolean} [opts.request] - True if this is a status request (not response)
 * @returns {Object} Wire-format status
 */
export const buildStatus = ({ connected, protocolVersion, contextDead, request }) => {
  const msg = { connected };
  if (protocolVersion !== undefined) msg.protocolVersion = protocolVersion;
  if (contextDead !== undefined) msg.contextDead = contextDead;
  if (request !== undefined) msg.request = request;
  return msg;
};

export const validateStatus = (status) => {
  const errors = [];
  if (!isObj(status)) return { valid: false, errors: ['status must be an object'] };
  if (status.connected === undefined && status.request === undefined) {
    errors.push('must have connected or request field');
  }
  return { valid: errors.length === 0, errors };
};

// ============================================================================
// TOURNAMENT — tournament state (app → extension)
// ============================================================================

/**
 * Build wire-format tournament data. Pass-through since shape is owned by TournamentContext.
 * @param {Object|null} tournament
 * @returns {Object|null}
 */
export const buildTournament = (tournament) => tournament || null;

export const validateTournament = (tournament) => {
  if (tournament === null) return { valid: true, errors: [] };
  if (!isObj(tournament)) return { valid: false, errors: ['tournament must be an object or null'] };
  return { valid: true, errors: [] };
};

// ============================================================================
// ERROR REPORT — app → extension error flow for correlation tracking
// ============================================================================

/**
 * Build wire-format error report from app-side error data.
 * @param {Object} opts
 * @param {string} opts.category - Error category
 * @param {string} opts.message - Error message
 * @param {string} [opts.correlationId] - captureId or other correlation key
 * @returns {Object} Wire-format error report
 */
export const buildErrorReport = ({ category, message, correlationId }) => ({
  category: category || 'app',
  message: message || 'unknown error',
  correlationId: correlationId || null,
  source: 'app',
});

export const validateErrorReport = (report) => {
  const errors = [];
  if (!isObj(report)) return { valid: false, errors: ['report must be an object'] };
  if (!isStr(report.category)) errors.push('category must be a string');
  if (!isStr(report.message)) errors.push('message must be a string');
  return { valid: errors.length === 0, errors };
};
