import { describe, it, expect } from 'vitest';
import {
  buildExploitSeat, validateExploitSeat,
  buildActionAdvice, validateActionAdvice,
  buildHandForRelay, validateHandForRelay,
  buildLiveContext, validateLiveContext,
  buildStatus, validateStatus,
  buildTournament, validateTournament,
} from '../wire-schemas.js';

// ============================================================================
// buildExploitSeat / validateExploitSeat
// ============================================================================

describe('buildExploitSeat', () => {
  const fullData = {
    style: 'TAG',
    sampleSize: 42,
    exploits: [
      { id: 'e1', label: 'Fold to c-bet', category: 'postflop', street: 'flop', statBasis: 'foldToCbet', scoring: { ev: 1.5 }, tier: 'confirmed' },
    ],
    weaknesses: [
      { id: 'w1', label: 'Over-folds flop', category: 'folding', severity: 0.8, confidence: 0.7 },
    ],
    briefings: [
      { ruleId: 'b1', label: 'Test brief', scoring: { ev: 2 }, evidenceBreakdown: 'x', handExamples: [], riskAnalysis: 'low' },
    ],
    observations: [
      { id: 'o1', heroContext: 'ip', heroContextLabel: 'In Position', signal: 'fold', severity: 0.5, confidence: 0.6, tier: 'confirmed', street: 'flop', evidence: {} },
    ],
    cbet: 65,
    foldToCbet: 55,
    threeBet: 8,
    villainProfile: { headline: 'Tight-Aggressive Regular' },
  };

  it('builds a valid seat from full data', () => {
    const seat = buildExploitSeat('3', fullData);
    expect(seat.seat).toBe('3');
    expect(seat.style).toBe('TAG');
    expect(seat.sampleSize).toBe(42);
    expect(seat.exploits).toHaveLength(1);
    expect(seat.exploits[0].id).toBe('e1');
    expect(seat.weaknesses).toHaveLength(1);
    expect(seat.briefings).toHaveLength(1);
    expect(seat.observations).toHaveLength(1);
    expect(seat.stats.cbet).toBe(65);
    expect(seat.stats.foldToCbet).toBe(55);
    expect(seat.stats.threeBet).toBe(8);
    expect(seat.villainHeadline).toBe('Tight-Aggressive Regular');
  });

  it('handles empty/missing data gracefully', () => {
    const seat = buildExploitSeat('1', {});
    expect(seat.seat).toBe('1');
    expect(seat.style).toBeNull();
    expect(seat.sampleSize).toBe(0);
    expect(seat.exploits).toEqual([]);
    expect(seat.weaknesses).toEqual([]);
    expect(seat.briefings).toEqual([]);
    expect(seat.observations).toEqual([]);
    expect(seat.villainHeadline).toBeNull();
  });

  it('limits weaknesses to 10, briefings to 5, observations to 24', () => {
    const data = {
      weaknesses: Array.from({ length: 20 }, (_, i) => ({ id: `w${i}`, label: `w${i}`, category: 'x', severity: 0.5, confidence: 0.5 })),
      briefings: Array.from({ length: 10 }, (_, i) => ({ ruleId: `b${i}`, label: `b${i}` })),
      observations: Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, signal: 'x' })),
    };
    const seat = buildExploitSeat('2', data);
    expect(seat.weaknesses).toHaveLength(10);
    expect(seat.briefings).toHaveLength(5);
    expect(seat.observations).toHaveLength(24);
  });

  it('passes through new exploit fields (evidence, displayTier, source, position)', () => {
    const data = {
      exploits: [{
        id: 'e1', label: 'Test', category: 'postflop', street: 'flop',
        statBasis: 'cbet', scoring: { ev: 1 }, tier: 'confirmed',
        evidence: { metric: 'cbet', observed: 78, profitable: 65, delta: 13 },
        displayTier: 'confirmed', source: 'stat', position: 'EP',
        // These should be stripped
        suppressed: false, suppressReason: null,
      }],
    };
    const seat = buildExploitSeat('1', data);
    expect(seat.exploits[0].evidence).toEqual({ metric: 'cbet', observed: 78, profitable: 65, delta: 13 });
    expect(seat.exploits[0].displayTier).toBe('confirmed');
    expect(seat.exploits[0].source).toBe('stat');
    expect(seat.exploits[0].position).toBe('EP');
    expect(seat.exploits[0].suppressed).toBeUndefined();
  });

  it('passes through new weakness fields (street, context, sampleSize, evidence, position)', () => {
    const data = {
      weaknesses: [{
        id: 'w1', label: 'Over-folds', category: 'folding', severity: 0.8, confidence: 0.7,
        street: 'flop', context: 'wet', sampleSize: 25,
        evidence: { metric: 'foldToCbet', observed: 80, profitable: 55, delta: 25 },
        position: 'BB',
        situationKeys: ['flop:wet:BB:fold'], // Should be stripped
      }],
    };
    const seat = buildExploitSeat('2', data);
    expect(seat.weaknesses[0].street).toBe('flop');
    expect(seat.weaknesses[0].context).toBe('wet');
    expect(seat.weaknesses[0].sampleSize).toBe(25);
    expect(seat.weaknesses[0].evidence.delta).toBe(25);
    expect(seat.weaknesses[0].position).toBe('BB');
    expect(seat.weaknesses[0].situationKeys).toBeUndefined();
  });

  it('passes through new briefing fields (confidence, sampleSize, impact)', () => {
    const data = {
      briefings: [{
        ruleId: 'b1', label: 'Brief', scoring: { ev: 2 },
        confidence: 0.85, sampleSize: 40, impact: 0.7,
        reviewStatus: 'pending', // Should be stripped
      }],
    };
    const seat = buildExploitSeat('3', data);
    expect(seat.briefings[0].confidence).toBe(0.85);
    expect(seat.briefings[0].sampleSize).toBe(40);
    expect(seat.briefings[0].impact).toBe(0.7);
    expect(seat.briefings[0].reviewStatus).toBeUndefined();
  });

  it('computes cbet from rawStats when not provided directly', () => {
    const seat = buildExploitSeat('1', {
      rawStats: { pfAggressorFlops: 10, cbetCount: 7, facedCbet: 20, foldedToCbet: 12 },
    });
    expect(seat.stats.cbet).toBe(70);
    expect(seat.stats.foldToCbet).toBe(60);
  });

  it('round-trips through validate', () => {
    const seat = buildExploitSeat('3', fullData);
    const result = validateExploitSeat(seat);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('validateExploitSeat', () => {
  it('rejects non-object', () => {
    expect(validateExploitSeat(null).valid).toBe(false);
    expect(validateExploitSeat('string').valid).toBe(false);
  });

  it('rejects missing required arrays', () => {
    const result = validateExploitSeat({ seat: '1' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('exploits must be an array');
  });
});

// ============================================================================
// buildActionAdvice / validateActionAdvice
// ============================================================================

describe('buildActionAdvice', () => {
  const fullAdvice = {
    villainSeat: 3,
    villainStyle: 'TAG',
    villainSampleSize: 50,
    heroAlreadyActed: false,
    confidence: 0.8,
    dataQuality: 'good',
    situation: 'facing_cbet',
    situationLabel: 'Facing C-Bet',
    heroEquity: 0.45,
    boardTexture: 'wet',
    segmentation: {},
    foldPct: 55,
    recommendations: [{ action: 'call', ev: 1.2 }],
    currentStreet: 'flop',
    potSize: 12,
    villainBet: 8,
    playerStats: {},
    extraField: 'should be dropped',
  };

  it('picks only defined fields', () => {
    const advice = buildActionAdvice(fullAdvice);
    expect(advice.situation).toBe('facing_cbet');
    expect(advice.recommendations).toHaveLength(1);
    expect(advice.extraField).toBeUndefined();
  });

  it('returns null for falsy input', () => {
    expect(buildActionAdvice(null)).toBeNull();
    expect(buildActionAdvice(undefined)).toBeNull();
  });

  it('includes villainProfile with sub-pick (strips showdownAnchors)', () => {
    const advice = buildActionAdvice({
      ...fullAdvice,
      villainProfile: {
        headline: 'Passive calling station',
        maturityLabel: 'Developing',
        totalObservations: 35,
        streets: { flop: { betting: 0.2, calling: 0.6 } },
        aggressionResponse: { facingBet: 'passive' },
        rangeShape: { capped: true },
        awareness: { positional: false },
        decisionModelShape: 'hand-strength-only',
        decisionModelDescription: 'Decides based on hand strength',
        vulnerabilities: [{ id: 'v1', label: 'Over-calls' }],
        showdownAnchors: [{ hand: 'AA', street: 'river' }], // Should be stripped
        rawStats: { vpip: 45 }, // Should be stripped
      },
    });
    expect(advice.villainProfile.headline).toBe('Passive calling station');
    expect(advice.villainProfile.maturityLabel).toBe('Developing');
    expect(advice.villainProfile.vulnerabilities).toHaveLength(1);
    expect(advice.villainProfile.showdownAnchors).toBeUndefined();
    expect(advice.villainProfile.rawStats).toBeUndefined();
  });

  it('includes treeMetadata with sub-pick (strips cacheStats but keeps analysis fields)', () => {
    const advice = buildActionAdvice({
      ...fullAdvice,
      treeMetadata: {
        depth: 2, depthReached: 2, branches: 3, computeMs: 45,
        street: 'flop', spr: 6.5, sprZone: 'MEDIUM',
        numOpponents: 2, comboCounted: true, dynamicAnchors: true,
        blockerEffects: { nuts: -0.10, strong: 0.05, air: -0.15 },
        advantage: { rangeAdvantage: 0.15, nutAdvantage: 0.05 },
        comboStats: { total: 131, ahead: 67, behind: 52, tied: 12 },
        cacheStats: { hits: 234, misses: 12 }, // Should be stripped
        refinedActions: 3, // Should be stripped
      },
    });
    expect(advice.treeMetadata.depth).toBe(2);
    expect(advice.treeMetadata.depthReached).toBe(2);
    expect(advice.treeMetadata.computeMs).toBe(45);
    expect(advice.treeMetadata.sprZone).toBe('MEDIUM');
    expect(advice.treeMetadata.numOpponents).toBe(2);
    expect(advice.treeMetadata.comboCounted).toBe(true);
    expect(advice.treeMetadata.dynamicAnchors).toBe(true);
    expect(advice.treeMetadata.blockerEffects.nuts).toBe(-0.10);
    expect(advice.treeMetadata.advantage.rangeAdvantage).toBe(0.15);
    expect(advice.treeMetadata.comboStats.ahead).toBe(67);
    expect(advice.treeMetadata.cacheStats).toBeUndefined();
    expect(advice.treeMetadata.refinedActions).toBeUndefined();
  });

  it('includes modelQuality with sub-pick', () => {
    const advice = buildActionAdvice({
      ...fullAdvice,
      modelQuality: {
        facingBetConfidence: 0.65,
        facingNoneConfidence: 0.4,
        overallSource: 'model',
      },
    });
    expect(advice.modelQuality.overallSource).toBe('model');
    expect(advice.modelQuality.facingBetConfidence).toBe(0.65);
  });

  it('includes bucketEquities as-is', () => {
    const advice = buildActionAdvice({
      ...fullAdvice,
      bucketEquities: { nuts: 0.95, strong: 0.72, marginal: 0.45, draw: 0.35, air: 0.15 },
    });
    expect(advice.bucketEquities.nuts).toBe(0.95);
    expect(advice.bucketEquities.air).toBe(0.15);
  });

  it('includes foldMeta with curve points and adjustments', () => {
    const advice = buildActionAdvice({
      ...fullAdvice,
      foldMeta: {
        bet: {
          baseEstimate: 0.42,
          source: 'model+observed',
          observedN: 18,
          adjustments: [
            { factor: 'af', multiplier: 0.98 },
            { factor: 'vpip', multiplier: 1.05 },
          ],
          totalShiftPct: 3,
        },
        raise: { baseEstimate: 0.55, source: 'population', observedN: 0, adjustments: [], totalShiftPct: 0 },
        curve: [
          { sizing: 0.33, foldPct: 0.35 },
          { sizing: 0.75, foldPct: 0.48 },
        ],
        curveSource: 'personalized',
      },
    });
    expect(advice.foldMeta.bet.baseEstimate).toBe(0.42);
    expect(advice.foldMeta.bet.adjustments).toHaveLength(2);
    expect(advice.foldMeta.curve).toHaveLength(2);
    expect(advice.foldMeta.curveSource).toBe('personalized');
    expect(advice.foldMeta.raise.source).toBe('population');
  });

  it('preserves handPlan and villainResponse on recommendations', () => {
    const advice = buildActionAdvice({
      ...fullAdvice,
      recommendations: [{
        action: 'bet',
        ev: 5.2,
        sizing: { betFraction: 0.75, betSize: 18.75 },
        reasoning: 'Value bet',
        handPlan: {
          ifCall: { plan: 'barrel', sizing: 0.75, scaryCards: ['flush'], favorableRunouts: 8, totalRunouts: 12 },
          ifRaise: { plan: 'fold', note: 'Insufficient equity' },
        },
        villainResponse: {
          fold: { pct: 0.48, ev: 25 },
          call: { pct: 0.40, ev: 3.0 },
          raise: { pct: 0.12, ev: -8 },
        },
      }],
    });
    expect(advice.recommendations[0].handPlan.ifCall.plan).toBe('barrel');
    expect(advice.recommendations[0].handPlan.ifCall.favorableRunouts).toBe(8);
    expect(advice.recommendations[0].handPlan.ifRaise.plan).toBe('fold');
    expect(advice.recommendations[0].villainResponse.fold.pct).toBe(0.48);
    expect(advice.recommendations[0].villainResponse.call.pct).toBe(0.40);
  });

  it('omits villainProfile/treeMetadata/modelQuality when absent', () => {
    const advice = buildActionAdvice(fullAdvice);
    expect(advice.villainProfile).toBeUndefined();
    expect(advice.treeMetadata).toBeUndefined();
    expect(advice.modelQuality).toBeUndefined();
  });

  it('round-trips through validate', () => {
    const advice = buildActionAdvice(fullAdvice);
    expect(validateActionAdvice(advice).valid).toBe(true);
  });
});

describe('validateActionAdvice', () => {
  it('accepts null', () => {
    expect(validateActionAdvice(null).valid).toBe(true);
  });

  it('rejects non-object', () => {
    expect(validateActionAdvice('bad').valid).toBe(false);
  });

  it('rejects missing situation', () => {
    const result = validateActionAdvice({ recommendations: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing situation');
  });
});

// ============================================================================
// buildHandForRelay / validateHandForRelay
// ============================================================================

describe('buildHandForRelay', () => {
  const validHand = {
    timestamp: Date.now(),
    version: '1.3.0',
    source: 'ignition',
    tableId: 'table_1',
    gameState: {
      currentStreet: 'river',
      dealerButtonSeat: 3,
      mySeat: 5,
      actionSequence: [{ seat: 1, action: 'fold', street: 'preflop', order: 1 }],
      absentSeats: [7, 8],
    },
    cardState: {
      communityCards: ['A♥', 'K♦', 'Q♣', 'J♠', 'T♥'],
      holeCards: ['A♠', 'K♠'],
      holeCardsVisible: true,
      allPlayerCards: {},
    },
    seatPlayers: { 5: 'hero' },
    ignitionMeta: { handNumber: 12345, capturedAt: Date.now(), blinds: { sb: 0.5, bb: 1 }, ante: 0 },
  };

  it('returns a new object with whitelisted fields (not same reference)', () => {
    const result = buildHandForRelay(validHand);
    expect(result).not.toBe(validHand); // New object — whitelist copy
    expect(result.timestamp).toBe(validHand.timestamp);
    expect(result.source).toBe('ignition');
    expect(result.tableId).toBe('table_1');
    expect(result.gameState.currentStreet).toBe('river');
    expect(result.gameState.actionSequence).toHaveLength(1);
    expect(result.cardState.communityCards).toHaveLength(5);
    expect(result.seatPlayers).toEqual({ 5: 'hero' });
  });

  it('strips unknown fields at all levels', () => {
    const handWithExtras = {
      ...validHand,
      _debug: true,
      gameState: {
        ...validHand.gameState,
        _rawState: 64,
        actionSequence: [{ seat: 1, action: 'fold', street: 'preflop', order: 1, _rawBtn: 1024 }],
      },
      ignitionMeta: { ...validHand.ignitionMeta, _eventLog: [] },
    };
    const result = buildHandForRelay(handWithExtras);
    expect(result._debug).toBeUndefined();
    expect(result.gameState._rawState).toBeUndefined();
    expect(result.gameState.actionSequence[0]._rawBtn).toBeUndefined();
    expect(result.ignitionMeta._eventLog).toBeUndefined();
  });

  it('returns null for falsy input', () => {
    expect(buildHandForRelay(null)).toBeNull();
  });

  it('round-trips through validate', () => {
    const result = buildHandForRelay(validHand);
    expect(validateHandForRelay(result).valid).toBe(true);
  });
});

describe('validateHandForRelay', () => {
  it('rejects missing gameState', () => {
    const result = validateHandForRelay({ timestamp: 1, cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''] } });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing hand.gameState');
  });

  it('rejects missing cardState', () => {
    const result = validateHandForRelay({
      timestamp: 1,
      gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 1, actionSequence: [] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing hand.cardState');
  });

  it('rejects non-object', () => {
    expect(validateHandForRelay(42).valid).toBe(false);
  });

  it('rejects dealerButtonSeat outside 1-9', () => {
    const result = validateHandForRelay({
      timestamp: 1,
      gameState: { currentStreet: 'preflop', dealerButtonSeat: 0, mySeat: 1, actionSequence: [] },
      cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('dealerButtonSeat'))).toBe(true);
  });

  it('rejects invalid action entry fields', () => {
    const result = validateHandForRelay({
      timestamp: 1,
      gameState: {
        currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 1,
        actionSequence: [{ seat: 0, action: 'allin', street: 'postflop', order: -1 }],
      },
      cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('action[0].seat'))).toBe(true);
    expect(result.errors.some(e => e.includes('action[0].action'))).toBe(true);
    expect(result.errors.some(e => e.includes('action[0].street'))).toBe(true);
    expect(result.errors.some(e => e.includes('action[0].order'))).toBe(true);
  });

  it('rejects communityCards not length 5', () => {
    const result = validateHandForRelay({
      timestamp: 1,
      gameState: { currentStreet: 'flop', dealerButtonSeat: 1, mySeat: 1, actionSequence: [] },
      cardState: { communityCards: ['A♥', 'K♦', 'Q♣'], holeCards: ['A♠', 'K♠'] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('communityCards must be array of 5'))).toBe(true);
  });

  it('rejects invalid card format', () => {
    const result = validateHandForRelay({
      timestamp: 1,
      gameState: { currentStreet: 'river', dealerButtonSeat: 1, mySeat: 1, actionSequence: [] },
      cardState: { communityCards: ['AH', 'Kd', 'Qc', 'Js', 'Th'], holeCards: ['As', 'Ks'] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('invalid card'))).toBe(true);
  });

  it('accepts empty string cards (face-down)', () => {
    const result = validateHandForRelay({
      timestamp: 1,
      gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 1, actionSequence: [] },
      cardState: { communityCards: ['', '', '', '', ''], holeCards: ['A♥', 'K♠'] },
    });
    expect(result.valid).toBe(true);
  });

  it('rejects malformed ignitionMeta.blinds', () => {
    const result = validateHandForRelay({
      timestamp: 1,
      gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 1, actionSequence: [] },
      cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''] },
      ignitionMeta: { blinds: { sb: 'bad', bb: 1 } },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('blinds'))).toBe(true);
  });
});

// ============================================================================
// buildLiveContext / validateLiveContext
// ============================================================================

describe('buildLiveContext', () => {
  const fullContext = {
    currentStreet: 'flop',
    communityCards: ['A♥', 'K♦', 'Q♣'],
    holeCards: ['A♠', 'K♠'],
    heroSeat: 5,
    dealerSeat: 3,
    pot: 12.5,
    foldedSeats: [1, 2],
    activeSeatNumbers: [3, 4, 5],
    actionSequence: [],
    blinds: { sb: 0.5, bb: 1 },
    ante: 0,
    gameType: null,
    pfAggressor: 5,
    handNumber: '123',
    state: 'FLOP',
    stacks: { 3: 100, 4: 80, 5: 120 },
    seatDisplayMap: null,
    tournamentLevelInfo: null,
    extraField: 'should be dropped',
  };

  it('picks only defined fields', () => {
    const ctx = buildLiveContext(fullContext);
    expect(ctx.currentStreet).toBe('flop');
    expect(ctx.heroSeat).toBe(5);
    expect(ctx.extraField).toBeUndefined();
  });

  it('returns null for falsy input', () => {
    expect(buildLiveContext(null)).toBeNull();
  });

  it('round-trips through validate', () => {
    expect(validateLiveContext(buildLiveContext(fullContext)).valid).toBe(true);
  });
});

// ============================================================================
// buildStatus / validateStatus
// ============================================================================

describe('buildStatus', () => {
  it('builds connected status', () => {
    const s = buildStatus({ connected: true, protocolVersion: 1 });
    expect(s.connected).toBe(true);
    expect(s.protocolVersion).toBe(1);
  });

  it('builds disconnected status with contextDead', () => {
    const s = buildStatus({ connected: false, contextDead: true });
    expect(s.connected).toBe(false);
    expect(s.contextDead).toBe(true);
  });

  it('builds request status', () => {
    const s = buildStatus({ connected: undefined, request: true });
    expect(s.request).toBe(true);
  });

  it('round-trips through validate', () => {
    expect(validateStatus(buildStatus({ connected: true })).valid).toBe(true);
    expect(validateStatus(buildStatus({ request: true })).valid).toBe(true);
  });
});

// ============================================================================
// buildTournament / validateTournament
// ============================================================================

describe('buildTournament', () => {
  it('passes through tournament data', () => {
    const t = { level: 5, blinds: { sb: 100, bb: 200 } };
    expect(buildTournament(t)).toBe(t);
  });

  it('returns null for falsy input', () => {
    expect(buildTournament(null)).toBeNull();
    expect(buildTournament(undefined)).toBeNull();
  });

  it('round-trips through validate', () => {
    expect(validateTournament(buildTournament({ level: 1 })).valid).toBe(true);
    expect(validateTournament(buildTournament(null)).valid).toBe(true);
  });
});
