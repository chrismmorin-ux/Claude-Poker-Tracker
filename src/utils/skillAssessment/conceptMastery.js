/**
 * @file SCF per-concept mastery — computes a per-concept signal vector
 * (leak / drill / test / recency) from the underlying IDB stores.
 *
 * Routes by concept-kind (per `tierConceptMap.js`):
 *   - `general-skill`: drill scheduler + perDomainMastery test results
 *   - `rule-anchored-umbrella`: aggregate from children + parent rule fire-state
 *   - `rule-anchored-specific`: heroLeaks store entry for the matching
 *     situation key (via `SITUATION_KEY_TO_CONCEPT` lookup)
 *
 * Per `src/utils/skillAssessment/CLAUDE.md` source-util-policy whitelist
 * (READ-ALLOWED: HandReplayView review-mode, SelfCoachView; BLACKLISTED: all
 * live-table surfaces). This module reads from heroLeaks IDB store +
 * preflop/postflop drill stores — those reads MUST NOT propagate to
 * blacklisted surfaces.
 *
 * Per `feedback_scf_high_granularity.md` — granularity floor binds
 * rule-anchored concepts only; general-skill stays coarse.
 *
 * SPR-033 / WS-148 (2026-05-04).
 */

import {
  CONCEPT_REGISTRY,
  getConceptKind,
  getChildrenOf,
  resolveSituationKeyToConcept,
} from './tierConceptMap.js';
import { getLesson } from './lessonRegistry.js';
import { getLeaksForPlayer } from '../persistence/heroLeaksStore.js';
import {
  loadPreflopDrills,
  loadPostflopDrills,
  aggregateFrameworkAccuracy,
} from '../persistence/index.js';

// ─── Internal helpers ────────────────────────────────────────────────────

/**
 * Recency penalty in [0, 1] from a timestamp. Linear decay over 30 days.
 *
 * @param {string|null} isoTs
 * @returns {number}
 */
const computeRecencyPenalty = (isoTs) => {
  if (!isoTs) return 0;
  const ts = Date.parse(isoTs);
  if (!Number.isFinite(ts)) return 0;
  const ageMs = Date.now() - ts;
  if (ageMs <= 0) return 1;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.max(0, 1 - ageDays / 30);
};

/**
 * Empty signal scaffold — used by callers that want a uniform shape
 * regardless of which kind the concept is.
 */
const EMPTY_SIGNALS = () => ({
  leakSignal: { hasFiredLeak: false, severity: 0, sampleSize: 0 },
  drillSignal: { mastery: 0, attemptCount: 0, lastAttemptAt: null },
  testSignal: { mastery: 0, attemptCount: 0, lastAttemptAt: null },
  recencyPenalty: 0,
});

// ─── Per-kind computation ────────────────────────────────────────────────

/**
 * General-skill mastery: average drill accuracy across the lesson's
 * declared frameworkIds. testSignal is wired but starts empty until the
 * opt-in test substrate (SCF G4 §SCF-G4-TEST) lands.
 */
const computeGeneralSkillMastery = async (userId, conceptId) => {
  const out = EMPTY_SIGNALS();
  const lesson = getLesson(conceptId);
  const frameworkIds = lesson?.meta?.frameworkIds || [];

  if (frameworkIds.length === 0) {
    return { conceptId, ...out, meta: { kind: 'general-skill', tier: CONCEPT_REGISTRY[conceptId].tier } };
  }

  // Aggregate drill accuracy across all attempts (preflop + postflop).
  const [pf, po] = await Promise.all([
    loadPreflopDrills(userId).catch(() => []),
    loadPostflopDrills(userId).catch(() => []),
  ]);
  const allDrills = [...(pf || []), ...(po || [])];
  const accByFw = aggregateFrameworkAccuracy(allDrills);

  let totalAttempts = 0;
  let weightedAcc = 0;
  let lastAttemptAt = null;
  for (const fwId of frameworkIds) {
    const stats = accByFw[fwId];
    if (!stats) continue;
    totalAttempts += stats.attempts;
    weightedAcc += stats.accuracy * stats.attempts;
  }
  // Find the latest attempt timestamp across the framework's drill records.
  for (const d of allDrills) {
    const fwIds = d?.truth?.frameworks || [];
    if (!fwIds.some((id) => frameworkIds.includes(id))) continue;
    const ts = d.timestamp || d.recordedAt || null;
    if (ts && (!lastAttemptAt || ts > lastAttemptAt)) lastAttemptAt = ts;
  }

  out.drillSignal = {
    mastery: totalAttempts > 0 ? weightedAcc / totalAttempts : 0,
    attemptCount: totalAttempts,
    lastAttemptAt,
  };
  out.recencyPenalty = computeRecencyPenalty(lastAttemptAt);

  return { conceptId, ...out, meta: { kind: 'general-skill', tier: CONCEPT_REGISTRY[conceptId].tier } };
};

/**
 * Rule-anchored-specific mastery: read heroLeaks store and find the entry
 * whose situation key resolves to this conceptId.
 */
const computeRuleAnchoredSpecificMastery = async (userId, conceptId) => {
  const out = EMPTY_SIGNALS();
  const meta = CONCEPT_REGISTRY[conceptId];

  const allLeaks = await getLeaksForPlayer(userId).catch(() => []);
  const matching = allLeaks.find((l) => resolveSituationKeyToConcept(l.situationKey) === conceptId);

  if (matching) {
    out.leakSignal = {
      hasFiredLeak: true,
      severity: matching.severity || 0,
      sampleSize: matching.sampleSize || 0,
    };
    out.recencyPenalty = computeRecencyPenalty(matching.lastUpdatedAt || null);
  }

  return { conceptId, ...out, meta: { kind: 'rule-anchored-specific', tier: meta.tier, parent: meta.parent } };
};

/**
 * Rule-anchored-umbrella mastery: aggregate from children + check whether
 * any leak rule that binds to this umbrella has fired (situation keys
 * not yet split per-cell still fire on the umbrella).
 */
const computeUmbrellaMastery = async (userId, conceptId) => {
  const out = EMPTY_SIGNALS();
  const meta = CONCEPT_REGISTRY[conceptId];

  // Children-level rollup: max severity across children (most-pressing leak),
  // sum sampleSize, average drill mastery (children may also be drill-backed).
  const children = getChildrenOf(conceptId);
  const childMasteries = await Promise.all(
    children.map((id) => computeRuleAnchoredSpecificMastery(userId, id)),
  );

  let maxChildSeverity = 0;
  let anyChildFired = false;
  let totalChildSampleSize = 0;
  for (const cm of childMasteries) {
    if (cm.leakSignal.hasFiredLeak) {
      anyChildFired = true;
      maxChildSeverity = Math.max(maxChildSeverity, cm.leakSignal.severity);
    }
    totalChildSampleSize += cm.leakSignal.sampleSize;
  }

  // Umbrella-level fire-state: heroLeaks records bound directly to the
  // umbrella (rule's relatedConceptId points here, situation key not yet
  // resolved to a child). Today: bb-defense rule fires this way.
  const allLeaks = await getLeaksForPlayer(userId).catch(() => []);
  const directUmbrellaLeak = allLeaks.find(
    (l) => l.relatedConceptId === conceptId && resolveSituationKeyToConcept(l.situationKey) === null,
  );

  let umbrellaSeverity = 0;
  let umbrellaSampleSize = 0;
  let umbrellaTs = null;
  if (directUmbrellaLeak) {
    umbrellaSeverity = directUmbrellaLeak.severity || 0;
    umbrellaSampleSize = directUmbrellaLeak.sampleSize || 0;
    umbrellaTs = directUmbrellaLeak.lastUpdatedAt || null;
  }

  const finalSeverity = Math.max(maxChildSeverity, umbrellaSeverity);
  out.leakSignal = {
    hasFiredLeak: anyChildFired || !!directUmbrellaLeak,
    severity: finalSeverity,
    sampleSize: totalChildSampleSize + umbrellaSampleSize,
  };

  // Recency = most-recent of (any child's leak fire) or (umbrella direct fire).
  const recencyCandidates = childMasteries
    .map((cm) => cm.recencyPenalty)
    .concat(computeRecencyPenalty(umbrellaTs));
  out.recencyPenalty = recencyCandidates.reduce((a, b) => Math.max(a, b), 0);

  return {
    conceptId,
    ...out,
    meta: { kind: 'rule-anchored-umbrella', tier: meta.tier, children },
  };
};

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Compute per-concept mastery for a single concept.
 *
 * @param {string} userId
 * @param {string} conceptId
 * @returns {Promise<object|null>} - mastery record or null if conceptId unregistered
 */
export const computeConceptMastery = async (userId, conceptId) => {
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('computeConceptMastery requires a non-empty userId');
  }
  const kind = getConceptKind(conceptId);
  if (kind === null) return null;
  if (kind === 'general-skill') return computeGeneralSkillMastery(userId, conceptId);
  if (kind === 'rule-anchored-umbrella') return computeUmbrellaMastery(userId, conceptId);
  if (kind === 'rule-anchored-specific') return computeRuleAnchoredSpecificMastery(userId, conceptId);
  return null;
};

/**
 * Compute mastery for all registered concepts.
 *
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
export const listAllConceptMastery = async (userId) => {
  const ids = Object.keys(CONCEPT_REGISTRY);
  const results = await Promise.all(ids.map((id) => computeConceptMastery(userId, id)));
  return results.filter(Boolean);
};
