/**
 * analysisPipeline.js — Shared analysis pipeline for player tendency calculation
 *
 * Runs the 8-step analysis sequence:
 * stats → percentages → positionStats → limps → rangeProfile → decisions → weaknesses → exploits → briefings
 *
 * Used by both usePlayerTendencies (live play) and useOnlineAnalysis (online play).
 * Each consumer wraps this with its own caching/persistence strategy.
 */

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
  const rawStats = buildPlayerStats(playerId, hands);
  const pct = derivePercentages(rawStats);
  const style = classifyStyle(pct);
  const positionStats = buildPositionStats(playerId, hands);
  const limpData = countLimps(playerId, hands);

  // Range profile
  let rangeProfile = cachedRangeProfile;
  let rangeSummary = null;
  let subActionSummary = null;
  try {
    if (!rangeProfile) {
      rangeProfile = buildRangeProfile(playerId, hands, userId);
    }
    rangeSummary = getRangeWidthSummary(rangeProfile);
    subActionSummary = getSubActionSummary(rangeProfile);
  } catch (e) {
    console.warn('analysisPipeline: range profile failed', e.message);
  }

  // Decisions + villain model
  let decisionSummary = null;
  let villainModel = null;
  let weaknesses = [];
  try {
    if (rangeProfile) {
      decisionSummary = accumulateDecisions(playerId, hands, rangeProfile, userId);
      villainModel = buildVillainDecisionModel(decisionSummary, pct);
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
  } catch (e) {
    console.warn('analysisPipeline: weakness detection failed', e.message);
  }

  // Villain profile (hero-facing decision model)
  let villainProfile = null;
  try {
    villainProfile = buildVillainProfile({
      villainModel, decisionSummary, percentages: pct,
      positionStats, weaknesses, rangeProfile, style,
    });
  } catch (e) {
    console.warn('analysisPipeline: villain profile build failed', e.message);
  }

  // Exploits
  const exploits = generateExploits({
    rawStats, percentages: pct, positionStats, limpData,
    rangeProfile, rangeSummary, subActionSummary,
    traits: rangeProfile?.traits || null,
    pips: rangeProfile?.pips || null,
  });

  // Briefings
  let briefings = [];
  try {
    const briefingContext = {
      rawStats, percentages: pct, rangeSummary, rangeProfile,
      traits: rangeProfile?.traits || null,
      handsProcessed: hands.length,
      weaknesses,
    };
    briefings = buildBriefings(exploits, briefingContext);
  } catch (e) {
    console.warn('analysisPipeline: briefing generation failed', e.message);
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
  };
};
