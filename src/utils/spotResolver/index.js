/**
 * spotResolver/index.js — Public API for the HRP spot-resolution
 * primitive. Maps a played decision to a `SpotMatch` against the
 * upper-surface + LSW corpus.
 *
 * Per `docs/design/surfaces/hand-replay-view.md:213` ratified contract:
 *   SpotMatch = { confidence: 'strong' | 'partial' | 'no-analog',
 *                 artifactId, reason?, ... }
 *
 * Augmented per `docs/design/surfaces/hand-review-modal.md` consumption +
 * the SPOT-KEY spike for SR-32 future flow:
 *   { source, spotKey, descriptor, scoredMatches }
 *
 * The full output shape:
 *   {
 *     confidence: 'strong' | 'partial' | 'no-analog',
 *     artifactId: string | null,        // null when 'no-analog'
 *     source: 'upper-surface' | 'lsw' | null,
 *     reason?: string,                   // present for partial + no-analog
 *     spotKey: string,                   // always present (SR-32 copy-paste)
 *     descriptor: SpotDescriptor,        // structured 8-dim for transparency
 *     scoredMatches: Array<{artifactId, source, score, differsOn}>,
 *   }
 *
 * Returns null when the input is structurally un-resolvable (preflop,
 * missing board, missing hero cards, no villain on the street). Null
 * means "no descriptor to resolve" — distinct from 'no-analog' which
 * means "descriptor extracted but no corpus entry above PARTIAL_THRESHOLD."
 *
 * SLS Stream E — SPR-087 / WS-193.
 */

import { extractDescriptor } from './spotKeyExtractor';
import { getCorpusIndex } from './corpusIndex';
import {
  rankMatches,
  classifyConfidence,
  STRONG_THRESHOLD,
  PARTIAL_THRESHOLD,
} from './matchScorer';

/**
 * Infer a human-readable reason for partial / no-analog matches.
 */
const inferReason = (descriptor, scoredMatches, confidence) => {
  if (confidence === 'strong') return undefined;

  if (confidence === 'partial' && scoredMatches.length > 0) {
    const top = scoredMatches[0];
    const differs = (top.differsOn || []).filter((d) => d !== 'nodeId');
    if (differs.length === 0) return 'node classification differs';
    if (differs.length === 1) return `${differs[0]} differs`;
    return `${differs.slice(0, 2).join(' + ')} differ`;
  }

  if (confidence === 'no-analog') {
    // Common patterns: multiway (ipOop='mw'), tournament deep stacks, unusual pot types
    if (descriptor.ipOop === 'mw') return 'no multiway corpus';
    if (descriptor.potType === 'limped') return 'no limped-pot corpus';
    if (descriptor.potType?.endsWith('-4way')) return 'no 4-way corpus';
    if (descriptor.sprBucket === 'DEEP') return 'stack depth out of corpus range';
    return 'no analog in corpus';
  }

  return undefined;
};

/**
 * Resolve a played decision to a SpotMatch.
 *
 * @param {Object} hand               — full hand record from IDB
 * @param {number} decisionIndex      — index into buildTimeline(hand)
 * @returns {SpotMatch | null}
 */
export const resolveSpot = (hand, decisionIndex) => {
  const descriptor = extractDescriptor(hand, decisionIndex);
  if (!descriptor) return null;

  const corpus = getCorpusIndex();
  const scoredMatches = rankMatches(descriptor, corpus);

  const topScore = scoredMatches.length > 0 ? scoredMatches[0].score : 0;
  const confidence = classifyConfidence(topScore);
  const reason = inferReason(descriptor, scoredMatches, confidence);

  const top = confidence !== 'no-analog' && scoredMatches.length > 0 ? scoredMatches[0] : null;

  return {
    confidence,
    artifactId: top?.artifactId ?? null,
    source: top?.source ?? null,
    reason,
    spotKey: descriptor.spotKey,
    descriptor,
    scoredMatches: scoredMatches.slice(0, 10), // cap surface for consumers
  };
};

// ─── Re-exports for consumers + tests ─────────────────────────────────

export { extractDescriptor } from './spotKeyExtractor';
export { getCorpusIndex, getAllCorpusEntries } from './corpusIndex';
export { CANONICAL_NODE_IDS, classifyNode } from './nodeClassifier';
export { toBoardShorthand } from './boardShorthand';
export { inferPotType } from './potTypeInference';
export {
  rankMatches,
  scoreMatch,
  classifyConfidence,
  STRONG_THRESHOLD,
  PARTIAL_THRESHOLD,
} from './matchScorer';
