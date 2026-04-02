/**
 * analysisPipeline.js — Shared analysis pipeline for player tendency calculation
 *
 * Runs the 8-step analysis sequence:
 * stats → percentages → positionStats → limps → rangeProfile → decisions → weaknesses → exploits → briefings
 *
 * Used by both usePlayerTendencies (live play) and useOnlineAnalysis (online play).
 * Each consumer wraps this with its own caching/persistence strategy.
 */

import { logger } from './errorHandler';
import { buildPlayerStats, derivePercentages, classifyStyle } from './tendencyCalculations';
import { buildPositionStats } from './exploitEngine/positionStats';
import { countLimps } from './sessionStats';
import { buildRangeProfile, getRangeWidthSummary, getSubActionSummary } from './rangeEngine';
import { generateExploits } from './exploitEngine/generateExploits';
import { buildBriefings } from './exploitEngine/briefingBuilder';
import { accumulateDecisions } from './exploitEngine/decisionAccumulator';
import { detectWeaknesses } from './exploitEngine/weaknessDetector';
import { buildVillainDecisionModel } from './exploitEngine/villainDecisionModel';
import { buildVillainProfile } from './exploitEngine/villainProfileBuilder';
import { computeVillainObservations } from './exploitEngine/villainObservations';
import { inferVillainThoughts } from './exploitEngine/thoughtInference';

/**
 * Run the full analysis pipeline for a single player.
 *
 * @param {string|number} playerId - Player or pseudo-player ID
 * @param {Array} hands - Hand history array
 * @param {string} userId - User ID for range profile scoping
 * @param {Object|null} [cachedRangeProfile] - Pre-loaded range profile (skip build if provided)
 * @returns {Object} Full analysis result
 */
export const runAnalysisPipeline = (playerId, hands, userId, cachedRangeProfile = null) => {
  const TOTAL_STEPS = 8;
  const diagnostics = { errors: [], warnings: [], stepsCompleted: [] };

  // Steps 1-2: Core stats (must succeed — no recovery possible)
  const rawStats = buildPlayerStats(playerId, hands);
  const pct = derivePercentages(rawStats);
  const style = classifyStyle(pct);
  const positionStats = buildPositionStats(playerId, hands);
  const limpData = countLimps(playerId, hands);
  diagnostics.stepsCompleted.push('stats', 'positions');

  // Step 3: Range profile
  let rangeProfile = cachedRangeProfile;
  let rangeSummary = null;
  let subActionSummary = null;
  try {
    if (!rangeProfile) {
      rangeProfile = buildRangeProfile(playerId, hands, userId);
    }
    rangeSummary = getRangeWidthSummary(rangeProfile);
    subActionSummary = getSubActionSummary(rangeProfile);
    diagnostics.stepsCompleted.push('rangeProfile');
  } catch (e) {
    logger.warn('AnalysisPipeline', 'range profile failed', e.message);
    diagnostics.errors.push({ step: 'rangeProfile', message: e.message });
  }

  // Step 4: Decisions + villain model
  let decisionSummary = null;
  let villainModel = null;
  let weaknesses = [];
  try {
    if (rangeProfile) {
      decisionSummary = accumulateDecisions(playerId, hands, rangeProfile, userId);
      villainModel = buildVillainDecisionModel(decisionSummary, { ...pct, style });
    }
    weaknesses = detectWeaknesses({
      decisionSummary,
      percentages: pct,
      rangeProfile,
      rangeSummary,
      subActionSummary,
      traits: rangeProfile?.traits || null,
      pips: rangeProfile?.pips || null,
      positionStats,
    });
    diagnostics.stepsCompleted.push('decisions');
  } catch (e) {
    logger.warn('AnalysisPipeline', 'weakness detection failed', e.message);
    diagnostics.errors.push({ step: 'decisions', message: e.message });
  }

  // Step 5: Villain profile
  let villainProfile = null;
  try {
    villainProfile = buildVillainProfile({
      villainModel, decisionSummary, percentages: pct,
      positionStats, weaknesses, rangeProfile, style,
    });
    diagnostics.stepsCompleted.push('villainProfile');
  } catch (e) {
    logger.warn('AnalysisPipeline', 'villain profile build failed', e.message);
    diagnostics.errors.push({ step: 'villainProfile', message: e.message });
  }

  // Step 5b: Thought inference (cognitive pattern detection)
  let thoughtAnalysis = null;
  try {
    thoughtAnalysis = inferVillainThoughts({
      weaknesses, villainModel, villainProfile, decisionSummary,
      percentages: pct, positionStats, rangeProfile, style,
    });
    diagnostics.stepsCompleted.push('thoughtInference');
  } catch (e) {
    logger.warn('AnalysisPipeline', 'thought inference failed', e.message);
    diagnostics.errors.push({ step: 'thoughtInference', message: e.message });
  }

  // Step 6: Exploits + observations
  let exploits = [];
  let observations = [];
  try {
    exploits = generateExploits({
      rawStats, percentages: pct, positionStats, limpData,
      rangeProfile, rangeSummary, subActionSummary,
      traits: rangeProfile?.traits || null,
      pips: rangeProfile?.pips || null,
    });
    observations = computeVillainObservations({
      rawStats, pct, positionStats, subActionSummary,
      decisionSummary, villainModel, rangeSummary,
    });
    diagnostics.stepsCompleted.push('exploits');
  } catch (e) {
    logger.warn('AnalysisPipeline', 'exploit/observation generation failed', e.message);
    diagnostics.errors.push({ step: 'exploits', message: e.message });
  }

  // Step 7: Briefings
  let briefings = [];
  try {
    const briefingContext = {
      rawStats, percentages: pct, rangeSummary, rangeProfile,
      traits: rangeProfile?.traits || null,
      handsProcessed: hands.length,
      weaknesses,
      villainModel,
    };
    briefings = buildBriefings(exploits, briefingContext);
    diagnostics.stepsCompleted.push('briefings');
  } catch (e) {
    logger.warn('AnalysisPipeline', 'briefing generation failed', e.message);
    diagnostics.errors.push({ step: 'briefings', message: e.message });
  }

  return {
    rawStats,
    pct,
    style,
    positionStats,
    limpData,
    rangeProfile,
    rangeSummary,
    subActionSummary,
    decisionSummary,
    villainModel,
    villainProfile,
    weaknesses,
    exploits,
    briefings,
    observations,
    thoughtAnalysis,
    diagnostics,
    completeness: diagnostics.stepsCompleted.length / TOTAL_STEPS,
  };
};
