/**
 * analysisPipeline.test.js
 *
 * Orchestration tests for runAnalysisPipeline. All imports are mocked so
 * tests stay fast and deterministic — this is a wiring test, not a logic test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Stable return-value stubs — defined once so mock implementations can
// reference the same objects that assertions compare against.
// ---------------------------------------------------------------------------

const STUB_RAW_STATS    = { handsSeenPreflop: 10 };
const STUB_PCT          = { vpip: 30, pfr: 20, af: 1.5, sampleSize: 10 };
const STUB_STYLE        = { tag: true, label: 'TAG' };
const STUB_POS_STATS    = { byPosition: {} };
const STUB_LIMP_DATA    = { limpCount: 2, limpOpportunities: 10 };
const STUB_RANGE_PROFILE = { traits: { aggression: 0.5 }, pips: {}, grids: {} };
const STUB_RANGE_SUMMARY = { overall: 'medium' };
const STUB_SUB_ACTION    = { preflop: {} };
const STUB_DECISION_SUM  = { situationKeys: [] };
const STUB_VILLAIN_MODEL = { frequencies: {} };
const STUB_VILLAIN_PROFILE = { archetypes: [] };
const STUB_WEAKNESSES    = [{ id: 'W1', severity: 0.7 }];
const STUB_EXPLOITS      = [{ id: 'E1' }];
const STUB_OBSERVATIONS  = [{ category: 'preflop' }];
const STUB_BRIEFINGS     = [{ text: 'Bet the river' }];

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any dynamic import of the SUT.
// vi.mock() calls are hoisted to the top of the file by Vitest.
// ---------------------------------------------------------------------------

vi.mock('../errorHandler', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock('../tendencyCalculations', () => ({
  buildPlayerStats:   vi.fn(() => STUB_RAW_STATS),
  derivePercentages:  vi.fn(() => STUB_PCT),
  classifyStyle:      vi.fn(() => STUB_STYLE),
}));

vi.mock('../exploitEngine/positionStats', () => ({
  buildPositionStats: vi.fn(() => STUB_POS_STATS),
}));

vi.mock('../sessionStats', () => ({
  countLimps: vi.fn(() => STUB_LIMP_DATA),
}));

vi.mock('../rangeEngine', () => ({
  buildRangeProfile:    vi.fn(() => STUB_RANGE_PROFILE),
  getRangeWidthSummary: vi.fn(() => STUB_RANGE_SUMMARY),
  getSubActionSummary:  vi.fn(() => STUB_SUB_ACTION),
}));

vi.mock('../exploitEngine/generateExploits', () => ({
  generateExploits: vi.fn(() => STUB_EXPLOITS),
}));

vi.mock('../exploitEngine/briefingBuilder', () => ({
  buildBriefings: vi.fn(() => STUB_BRIEFINGS),
}));

vi.mock('../exploitEngine/decisionAccumulator', () => ({
  accumulateDecisions: vi.fn(() => STUB_DECISION_SUM),
}));

vi.mock('../exploitEngine/weaknessDetector', () => ({
  detectWeaknesses: vi.fn(() => STUB_WEAKNESSES),
}));

vi.mock('../exploitEngine/villainDecisionModel', () => ({
  buildVillainDecisionModel: vi.fn(() => STUB_VILLAIN_MODEL),
}));

vi.mock('../exploitEngine/villainProfileBuilder', () => ({
  buildVillainProfile: vi.fn(() => STUB_VILLAIN_PROFILE),
}));

vi.mock('../exploitEngine/villainObservations', () => ({
  computeVillainObservations: vi.fn(() => STUB_OBSERVATIONS),
}));

// ---------------------------------------------------------------------------
// Lazy import of the SUT after mocks are registered.
// ---------------------------------------------------------------------------

const getModule = () => import('../analysisPipeline');

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const PLAYER_ID = 42;
const USER_ID   = 'user-99';
const HANDS     = [
  { handId: 1, gameState: {}, seatPlayers: { '3': 42 } },
  { handId: 2, gameState: {}, seatPlayers: { '3': 42 } },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Re-import all mocked modules so assertions can inspect call counts. */
const getMocks = async () => ({
  buildPlayerStats:          (await import('../tendencyCalculations')).buildPlayerStats,
  derivePercentages:         (await import('../tendencyCalculations')).derivePercentages,
  classifyStyle:             (await import('../tendencyCalculations')).classifyStyle,
  buildPositionStats:        (await import('../exploitEngine/positionStats')).buildPositionStats,
  countLimps:                (await import('../sessionStats')).countLimps,
  buildRangeProfile:         (await import('../rangeEngine')).buildRangeProfile,
  getRangeWidthSummary:      (await import('../rangeEngine')).getRangeWidthSummary,
  getSubActionSummary:       (await import('../rangeEngine')).getSubActionSummary,
  generateExploits:          (await import('../exploitEngine/generateExploits')).generateExploits,
  buildBriefings:            (await import('../exploitEngine/briefingBuilder')).buildBriefings,
  accumulateDecisions:       (await import('../exploitEngine/decisionAccumulator')).accumulateDecisions,
  detectWeaknesses:          (await import('../exploitEngine/weaknessDetector')).detectWeaknesses,
  buildVillainDecisionModel: (await import('../exploitEngine/villainDecisionModel')).buildVillainDecisionModel,
  buildVillainProfile:       (await import('../exploitEngine/villainProfileBuilder')).buildVillainProfile,
  computeVillainObservations:(await import('../exploitEngine/villainObservations')).computeVillainObservations,
  logger:                    (await import('../errorHandler')).logger,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runAnalysisPipeline', () => {
  let runAnalysisPipeline;
  let mocks;

  beforeEach(async () => {
    // resetAllMocks clears call counts AND restores any mockImplementation overrides
    // set in nested describe blocks, preventing state bleed between test groups.
    vi.resetAllMocks();

    // Re-establish default return values after reset wipes them.
    const tc  = await import('../tendencyCalculations');
    const ps  = await import('../exploitEngine/positionStats');
    const ss  = await import('../sessionStats');
    const re  = await import('../rangeEngine');
    const ge  = await import('../exploitEngine/generateExploits');
    const bb  = await import('../exploitEngine/briefingBuilder');
    const da  = await import('../exploitEngine/decisionAccumulator');
    const wd  = await import('../exploitEngine/weaknessDetector');
    const vdm = await import('../exploitEngine/villainDecisionModel');
    const vpb = await import('../exploitEngine/villainProfileBuilder');
    const vo  = await import('../exploitEngine/villainObservations');

    tc.buildPlayerStats.mockReturnValue(STUB_RAW_STATS);
    tc.derivePercentages.mockReturnValue(STUB_PCT);
    tc.classifyStyle.mockReturnValue(STUB_STYLE);
    ps.buildPositionStats.mockReturnValue(STUB_POS_STATS);
    ss.countLimps.mockReturnValue(STUB_LIMP_DATA);
    re.buildRangeProfile.mockReturnValue(STUB_RANGE_PROFILE);
    re.getRangeWidthSummary.mockReturnValue(STUB_RANGE_SUMMARY);
    re.getSubActionSummary.mockReturnValue(STUB_SUB_ACTION);
    ge.generateExploits.mockReturnValue(STUB_EXPLOITS);
    bb.buildBriefings.mockReturnValue(STUB_BRIEFINGS);
    da.accumulateDecisions.mockReturnValue(STUB_DECISION_SUM);
    wd.detectWeaknesses.mockReturnValue(STUB_WEAKNESSES);
    vdm.buildVillainDecisionModel.mockReturnValue(STUB_VILLAIN_MODEL);
    vpb.buildVillainProfile.mockReturnValue(STUB_VILLAIN_PROFILE);
    vo.computeVillainObservations.mockReturnValue(STUB_OBSERVATIONS);

    ({ runAnalysisPipeline } = await getModule());
    mocks = await getMocks();
  });

  // -------------------------------------------------------------------------
  // Output shape
  // -------------------------------------------------------------------------

  describe('return value shape', () => {
    it('returns an object with all 16 required keys', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      const expected = [
        'rawStats', 'pct', 'style', 'positionStats', 'limpData',
        'rangeProfile', 'rangeSummary', 'subActionSummary',
        'decisionSummary', 'villainModel', 'villainProfile',
        'weaknesses', 'exploits', 'briefings', 'observations',
      ];
      expected.forEach(key => {
        expect(result, `missing key: ${key}`).toHaveProperty(key);
      });
    });

    it('populates keys with stub values in the happy-path', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.rawStats).toBe(STUB_RAW_STATS);
      expect(result.pct).toBe(STUB_PCT);
      expect(result.style).toBe(STUB_STYLE);
      expect(result.positionStats).toBe(STUB_POS_STATS);
      expect(result.limpData).toBe(STUB_LIMP_DATA);
      expect(result.rangeProfile).toBe(STUB_RANGE_PROFILE);
      expect(result.rangeSummary).toBe(STUB_RANGE_SUMMARY);
      expect(result.subActionSummary).toBe(STUB_SUB_ACTION);
      expect(result.decisionSummary).toBe(STUB_DECISION_SUM);
      expect(result.villainModel).toBe(STUB_VILLAIN_MODEL);
      expect(result.villainProfile).toBe(STUB_VILLAIN_PROFILE);
      expect(result.weaknesses).toBe(STUB_WEAKNESSES);
      expect(result.exploits).toBe(STUB_EXPLOITS);
      expect(result.briefings).toBe(STUB_BRIEFINGS);
      expect(result.observations).toBe(STUB_OBSERVATIONS);
    });
  });

  // -------------------------------------------------------------------------
  // Dependency call arguments
  // -------------------------------------------------------------------------

  describe('dependency call arguments', () => {
    it('calls buildPlayerStats with playerId and hands', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.buildPlayerStats).toHaveBeenCalledOnce();
      expect(mocks.buildPlayerStats).toHaveBeenCalledWith(PLAYER_ID, HANDS);
    });

    it('calls derivePercentages with rawStats result', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.derivePercentages).toHaveBeenCalledWith(STUB_RAW_STATS);
    });

    it('calls classifyStyle with percentages result', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.classifyStyle).toHaveBeenCalledWith(STUB_PCT);
    });

    it('calls buildPositionStats with playerId and hands', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.buildPositionStats).toHaveBeenCalledWith(PLAYER_ID, HANDS);
    });

    it('calls countLimps with playerId and hands', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.countLimps).toHaveBeenCalledWith(PLAYER_ID, HANDS);
    });

    it('calls buildRangeProfile with playerId, hands, and userId', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.buildRangeProfile).toHaveBeenCalledWith(PLAYER_ID, HANDS, USER_ID);
    });

    it('calls getRangeWidthSummary with the range profile', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.getRangeWidthSummary).toHaveBeenCalledWith(STUB_RANGE_PROFILE);
    });

    it('calls getSubActionSummary with the range profile', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.getSubActionSummary).toHaveBeenCalledWith(STUB_RANGE_PROFILE);
    });

    it('calls accumulateDecisions with playerId, hands, rangeProfile, userId', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.accumulateDecisions).toHaveBeenCalledWith(
        PLAYER_ID, HANDS, STUB_RANGE_PROFILE, USER_ID
      );
    });

    it('calls buildVillainDecisionModel with decisionSummary and pct', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.buildVillainDecisionModel).toHaveBeenCalledWith(STUB_DECISION_SUM, STUB_PCT);
    });

    it('calls detectWeaknesses with the expected context object', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.detectWeaknesses).toHaveBeenCalledWith({
        decisionSummary:  STUB_DECISION_SUM,
        percentages:      STUB_PCT,
        rangeProfile:     STUB_RANGE_PROFILE,
        rangeSummary:     STUB_RANGE_SUMMARY,
        subActionSummary: STUB_SUB_ACTION,
        traits:           STUB_RANGE_PROFILE.traits,
        pips:             STUB_RANGE_PROFILE.pips,
        positionStats:    STUB_POS_STATS,
      });
    });

    it('calls generateExploits with the expected context object', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.generateExploits).toHaveBeenCalledWith({
        rawStats:         STUB_RAW_STATS,
        percentages:      STUB_PCT,
        positionStats:    STUB_POS_STATS,
        limpData:         STUB_LIMP_DATA,
        rangeProfile:     STUB_RANGE_PROFILE,
        rangeSummary:     STUB_RANGE_SUMMARY,
        subActionSummary: STUB_SUB_ACTION,
        traits:           STUB_RANGE_PROFILE.traits,
        pips:             STUB_RANGE_PROFILE.pips,
      });
    });

    it('calls buildBriefings with exploits and the briefing context', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.buildBriefings).toHaveBeenCalledWith(
        STUB_EXPLOITS,
        {
          rawStats:        STUB_RAW_STATS,
          percentages:     STUB_PCT,
          rangeSummary:    STUB_RANGE_SUMMARY,
          rangeProfile:    STUB_RANGE_PROFILE,
          traits:          STUB_RANGE_PROFILE.traits,
          handsProcessed:  HANDS.length,
          weaknesses:      STUB_WEAKNESSES,
        }
      );
    });

    it('calls buildVillainProfile with the correct context object', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.buildVillainProfile).toHaveBeenCalledWith({
        villainModel:    STUB_VILLAIN_MODEL,
        decisionSummary: STUB_DECISION_SUM,
        percentages:     STUB_PCT,
        positionStats:   STUB_POS_STATS,
        weaknesses:      STUB_WEAKNESSES,
        rangeProfile:    STUB_RANGE_PROFILE,
        style:           STUB_STYLE,
      });
    });

    it('calls computeVillainObservations with the expected context', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.computeVillainObservations).toHaveBeenCalledWith({
        rawStats:        STUB_RAW_STATS,
        pct:             STUB_PCT,
        positionStats:   STUB_POS_STATS,
        subActionSummary: STUB_SUB_ACTION,
        decisionSummary: STUB_DECISION_SUM,
        villainModel:    STUB_VILLAIN_MODEL,
        rangeSummary:    STUB_RANGE_SUMMARY,
      });
    });
  });

  // -------------------------------------------------------------------------
  // cachedRangeProfile bypasses buildRangeProfile
  // -------------------------------------------------------------------------

  describe('cachedRangeProfile parameter', () => {
    it('skips buildRangeProfile when cachedRangeProfile is provided', async () => {
      const cached = { traits: { aggression: 0.9 }, pips: {}, grids: {}, _cached: true };
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID, cached);
      expect(mocks.buildRangeProfile).not.toHaveBeenCalled();
    });

    it('uses the cached profile for downstream calls when provided', async () => {
      const cached = { traits: { aggression: 0.9 }, pips: {}, grids: {}, _cached: true };
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID, cached);
      expect(mocks.getRangeWidthSummary).toHaveBeenCalledWith(cached);
      expect(mocks.getSubActionSummary).toHaveBeenCalledWith(cached);
      expect(mocks.accumulateDecisions).toHaveBeenCalledWith(
        PLAYER_ID, HANDS, cached, USER_ID
      );
    });

    it('returns the cached profile as rangeProfile in the result', async () => {
      const cached = { traits: {}, pips: {}, grids: {} };
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID, cached);
      expect(result.rangeProfile).toBe(cached);
    });

    it('calls buildRangeProfile when cachedRangeProfile is null (default)', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID, null);
      expect(mocks.buildRangeProfile).toHaveBeenCalledOnce();
    });

    it('calls buildRangeProfile when cachedRangeProfile is omitted', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.buildRangeProfile).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Range profile failure path
  // -------------------------------------------------------------------------

  describe('range profile failure path', () => {
    beforeEach(() => {
      mocks.buildRangeProfile.mockImplementation(() => {
        throw new Error('IDB read error');
      });
    });

    it('sets rangeProfile to null when buildRangeProfile throws', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.rangeProfile).toBeNull();
    });

    it('sets rangeSummary to null when buildRangeProfile throws', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.rangeSummary).toBeNull();
    });

    it('sets subActionSummary to null when buildRangeProfile throws', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.subActionSummary).toBeNull();
    });

    it('sets decisionSummary to null when range profile is unavailable', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.decisionSummary).toBeNull();
    });

    it('sets villainModel to null when range profile is unavailable', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.villainModel).toBeNull();
    });

    it('does not call accumulateDecisions when rangeProfile is null', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.accumulateDecisions).not.toHaveBeenCalled();
    });

    it('still calls generateExploits (with null rangeProfile fields)', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.generateExploits).toHaveBeenCalledOnce();
    });

    it('logs a warning with the error message', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'AnalysisPipeline', 'range profile failed', 'IDB read error'
      );
    });

    it('returns a valid object shape even when range profile fails', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result).toHaveProperty('rawStats');
      expect(result).toHaveProperty('exploits');
      expect(result).toHaveProperty('briefings');
    });
  });

  // -------------------------------------------------------------------------
  // getRangeWidthSummary failure (range profile block, post-build)
  // -------------------------------------------------------------------------

  describe('range summary failure path', () => {
    beforeEach(() => {
      mocks.getRangeWidthSummary.mockImplementation(() => {
        throw new Error('summary error');
      });
    });

    it('sets rangeSummary to null when getRangeWidthSummary throws', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.rangeSummary).toBeNull();
    });

    it('sets subActionSummary to null when exception occurs in range block', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.subActionSummary).toBeNull();
    });

    it('still returns exploits and briefings', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.exploits).toBe(STUB_EXPLOITS);
    });
  });

  // -------------------------------------------------------------------------
  // Weakness detection failure path
  // -------------------------------------------------------------------------

  describe('weakness detection failure path', () => {
    beforeEach(() => {
      mocks.detectWeaknesses.mockImplementation(() => {
        throw new Error('weakness error');
      });
    });

    it('sets weaknesses to an empty array when detectWeaknesses throws', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.weaknesses).toEqual([]);
    });

    it('still calls generateExploits when weakness detection fails', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.generateExploits).toHaveBeenCalledOnce();
    });

    it('still returns exploits when weakness detection fails', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.exploits).toBe(STUB_EXPLOITS);
    });

    it('logs a warning when weakness detection throws', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'AnalysisPipeline', 'weakness detection failed', 'weakness error'
      );
    });

    it('accumulateDecisions is still called before the failure', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.accumulateDecisions).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Villain profile failure path
  // -------------------------------------------------------------------------

  describe('villain profile failure path', () => {
    beforeEach(() => {
      mocks.buildVillainProfile.mockImplementation(() => {
        throw new Error('profile error');
      });
    });

    it('sets villainProfile to null when buildVillainProfile throws', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.villainProfile).toBeNull();
    });

    it('still returns exploits when villain profile build fails', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.exploits).toBe(STUB_EXPLOITS);
    });

    it('logs a warning when villain profile build fails', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'AnalysisPipeline', 'villain profile build failed', 'profile error'
      );
    });
  });

  // -------------------------------------------------------------------------
  // Villain observations failure path
  // -------------------------------------------------------------------------

  describe('villain observations failure path', () => {
    beforeEach(() => {
      mocks.computeVillainObservations.mockImplementation(() => {
        throw new Error('observations error');
      });
    });

    it('sets observations to an empty array when computeVillainObservations throws', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.observations).toEqual([]);
    });

    it('still returns briefings when observations fail', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.briefings).toBe(STUB_BRIEFINGS);
    });

    it('logs a warning when villain observations throws', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'AnalysisPipeline', 'villain observations failed', 'observations error'
      );
    });
  });

  // -------------------------------------------------------------------------
  // Briefing failure path
  // -------------------------------------------------------------------------

  describe('briefing failure path', () => {
    beforeEach(() => {
      mocks.buildBriefings.mockImplementation(() => {
        throw new Error('briefing error');
      });
    });

    it('sets briefings to an empty array when buildBriefings throws', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.briefings).toEqual([]);
    });

    it('still returns exploits when briefings fail', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(result.exploits).toBe(STUB_EXPLOITS);
    });

    it('logs a warning when briefing generation throws', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        'AnalysisPipeline', 'briefing generation failed', 'briefing error'
      );
    });
  });

  // -------------------------------------------------------------------------
  // Empty hands array
  // -------------------------------------------------------------------------

  describe('empty hands array', () => {
    it('returns a valid object shape when hands is empty', async () => {
      const result = runAnalysisPipeline(PLAYER_ID, [], USER_ID);
      const expectedKeys = [
        'rawStats', 'pct', 'style', 'positionStats', 'limpData',
        'rangeProfile', 'rangeSummary', 'subActionSummary',
        'decisionSummary', 'villainModel', 'villainProfile',
        'weaknesses', 'exploits', 'briefings', 'observations',
      ];
      expectedKeys.forEach(key => {
        expect(result, `missing key: ${key}`).toHaveProperty(key);
      });
    });

    it('passes empty hands to buildPlayerStats', async () => {
      runAnalysisPipeline(PLAYER_ID, [], USER_ID);
      expect(mocks.buildPlayerStats).toHaveBeenCalledWith(PLAYER_ID, []);
    });

    it('passes empty hands to buildPositionStats', async () => {
      runAnalysisPipeline(PLAYER_ID, [], USER_ID);
      expect(mocks.buildPositionStats).toHaveBeenCalledWith(PLAYER_ID, []);
    });

    it('passes handsProcessed: 0 to buildBriefings context', async () => {
      runAnalysisPipeline(PLAYER_ID, [], USER_ID);
      const briefingArg = mocks.buildBriefings.mock.calls[0][1];
      expect(briefingArg.handsProcessed).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple simultaneous failures
  // -------------------------------------------------------------------------

  describe('multiple simultaneous failures', () => {
    it('handles range profile + weakness + briefing all failing, returns valid shape', async () => {
      mocks.buildRangeProfile.mockImplementation(() => { throw new Error('range fail'); });
      mocks.detectWeaknesses.mockImplementation(() => { throw new Error('weakness fail'); });
      mocks.buildBriefings.mockImplementation(() => { throw new Error('briefing fail'); });

      const result = runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);

      expect(result.rangeProfile).toBeNull();
      expect(result.rangeSummary).toBeNull();
      expect(result.decisionSummary).toBeNull();
      expect(result.villainModel).toBeNull();
      expect(result.weaknesses).toEqual([]);
      expect(result.briefings).toEqual([]);
      expect(result.rawStats).toBe(STUB_RAW_STATS);
      expect(result.exploits).toBe(STUB_EXPLOITS);
    });

    it('emits a separate logger.warn call for each failed step', async () => {
      mocks.buildRangeProfile.mockImplementation(() => { throw new Error('e1'); });
      mocks.buildBriefings.mockImplementation(() => { throw new Error('e2'); });

      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);

      const warnMessages = mocks.logger.warn.mock.calls.map(c => c[1]);
      expect(warnMessages).toContain('range profile failed');
      expect(warnMessages).toContain('briefing generation failed');
    });
  });

  // -------------------------------------------------------------------------
  // generateExploits uses null-safe trait/pip extraction
  // -------------------------------------------------------------------------

  describe('generateExploits null-safe range fields', () => {
    it('passes null traits and null pips when rangeProfile is null', async () => {
      mocks.buildRangeProfile.mockImplementation(() => { throw new Error('fail'); });

      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);

      const exploitArg = mocks.generateExploits.mock.calls[0][0];
      expect(exploitArg.traits).toBeNull();
      expect(exploitArg.pips).toBeNull();
      expect(exploitArg.rangeProfile).toBeNull();
    });

    it('passes actual traits and pips when rangeProfile is present', async () => {
      runAnalysisPipeline(PLAYER_ID, HANDS, USER_ID);

      const exploitArg = mocks.generateExploits.mock.calls[0][0];
      expect(exploitArg.traits).toBe(STUB_RANGE_PROFILE.traits);
      expect(exploitArg.pips).toBe(STUB_RANGE_PROFILE.pips);
    });
  });
});
