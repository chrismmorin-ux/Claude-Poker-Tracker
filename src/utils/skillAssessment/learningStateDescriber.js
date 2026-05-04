/**
 * @file SCF learning-state descriptor — emits a user-facing descriptor of
 * the user's current learning focus, with transparent composition.
 *
 * Per `feedback_scf_learning_state_not_tier_rank.md`: per-concept mastery
 * is the source of truth; the descriptor is a derived projection that
 * adapts to the surface's information-density needs (general vs specific).
 * The 6-tier ladder NEVER renders as a user-facing rank label.
 *
 * Per CD-5 inspectability: the returned `composition` object lets a
 * future surface render a "why this descriptor?" panel.
 *
 * Per autonomy red line #5 (no shame copy): summary text never contains
 * single-word rank labels (`novice`, `live-rec`, `studied-amateur`,
 * `part-time-grinder`, `serious-grinder`, `pro`).
 *
 * SPR-033 / WS-148 (2026-05-04).
 */

import { computeComposites, DEFAULT_WEIGHTS, DEFAULT_TOGGLES } from './composite.js';
import { getParentOf } from './tierConceptMap.js';

/**
 * Forbidden rank-label tokens. Lint test enforces these never appear in
 * descriptor summary text. (Tier names live in tierConceptMap + lesson
 * frontmatter only.)
 */
export const FORBIDDEN_RANK_LABELS = Object.freeze([
  'novice',
  'live-rec',
  'studied-amateur',
  'part-time-grinder',
  'serious-grinder',
  'pro',
]);

/**
 * Map a conceptId to its display name. v1 = naive: replace dashes with
 * spaces. Future iteration may pull from lesson frontmatter `title`.
 */
const conceptDisplayName = (conceptId) => {
  if (!conceptId) return '';
  return conceptId.replace(/-/g, ' ').replace(/\bcluster$/i, '').trim();
};

const buildGeneralSummary = (focused) => {
  if (focused.length === 0) return 'no active focus';
  const top = focused[0];
  // Walk up to umbrella if the top focus is a sub-concept; otherwise use the concept itself.
  const parent = getParentOf(top.conceptId);
  const summaryConcept = parent || top.conceptId;
  return `currently focused on ${conceptDisplayName(summaryConcept)}`;
};

const buildSpecificSummary = (focused) => {
  if (focused.length === 0) return 'no active focus';
  const names = focused.slice(0, 5).map((f) => conceptDisplayName(f.conceptId));
  if (names.length === 1) return `attention on ${names[0]}`;
  if (names.length === 2) return `attention on ${names[0]} and ${names[1]}`;
  return `attention on ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
};

/**
 * Emit a learning-state descriptor.
 *
 * @param {Array<object>} conceptMasteries - output of listAllConceptMastery
 * @param {object} [options]
 * @param {'general' | 'specific'} [options.granularity='general']
 * @param {object} [options.weights] - partial override of DEFAULT_WEIGHTS
 * @param {object} [options.toggles] - partial override of DEFAULT_TOGGLES
 * @returns {{
 *   summary: string,
 *   focusConcepts: string[],
 *   composition: {
 *     conceptContributions: Array<{conceptId, weight, signalBreakdown}>,
 *     weightsUsed: object,
 *     togglesUsed: object,
 *   },
 * }}
 */
export const describeLearningState = (conceptMasteries, options = {}) => {
  const granularity = options.granularity === 'specific' ? 'specific' : 'general';
  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
  const toggles = { ...DEFAULT_TOGGLES, ...(options.toggles || {}) };

  const composites = computeComposites(conceptMasteries, { weights, toggles });

  // Filter to non-zero composite scores (focus = "actively recommended").
  const focused = composites
    .filter((c) => c.compositeScore > 0)
    .sort((a, b) => b.compositeScore - a.compositeScore);

  const summary = granularity === 'general'
    ? buildGeneralSummary(focused)
    : buildSpecificSummary(focused);

  const conceptContributions = focused.slice(0, granularity === 'general' ? 1 : 5).map((c) => ({
    conceptId: c.conceptId,
    weight: c.compositeScore,
    signalBreakdown: c.breakdown,
  }));

  return {
    summary,
    focusConcepts: conceptContributions.map((c) => c.conceptId),
    composition: {
      conceptContributions,
      weightsUsed: weights,
      togglesUsed: toggles,
    },
  };
};
