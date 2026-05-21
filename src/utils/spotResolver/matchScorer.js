/**
 * matchScorer.js — Score a played-hand descriptor against a corpus
 * entry on per-dimension equal-weight match.
 *
 * Calibration constants (not learned per CLAUDE.md §3):
 *   STRONG_THRESHOLD = 0.875 (7/8 dimensions match exactly)
 *   PARTIAL_THRESHOLD = 0.625 (5/8 dimensions match exactly)
 *
 * Per-dimension match: 1.0 for exact match, 0.0 otherwise. Tolerances:
 *   - sprBucket: partial credit (0.5) for adjacent SPR zones
 *   - boardShorthand: case-insensitive
 *   - texture: 'paired' matches both 'wet' and 'dry' (paired boards
 *     can be either)
 *
 * Null fields on the corpus side (e.g., upper-surface filenames don't
 * encode sprBucket) yield neutral credit (0.5) rather than penalty —
 * the absence of info shouldn't downgrade an otherwise-strong match.
 *
 * SLS Stream E — SPR-087 / WS-193.
 */

export const STRONG_THRESHOLD = 0.875;  // 7/8 dimensions match exactly
export const PARTIAL_THRESHOLD = 0.625; // 5/8 dimensions match exactly

const SPR_ORDER = ['MICRO', 'LOW', 'MEDIUM', 'HIGH', 'DEEP'];

/**
 * Dimensions scored in this version. 8 total, equal-weight.
 */
const SCORED_DIMENSIONS = [
  'heroPos',
  'villainPos',
  'ipOop',
  'potType',
  'texture',
  'boardShorthand',
  'sprBucket',
  'street',
];

/**
 * Compare a single dimension value between descriptor + corpus entry.
 * Returns { match: 0..1, differs: boolean }.
 */
const compareDimension = (dim, descValue, corpValue) => {
  // Null on the corpus side → neutral credit (don't penalize missing data)
  if (corpValue == null) return { match: 0.5, differs: false };

  // Null on the descriptor side with non-null corpus → mismatch
  if (descValue == null) return { match: 0, differs: true };

  // Case-insensitive string comparison
  const a = typeof descValue === 'string' ? descValue.toLowerCase() : descValue;
  const b = typeof corpValue === 'string' ? corpValue.toLowerCase() : corpValue;

  // Exact match
  if (a === b) return { match: 1, differs: false };

  // Dimension-specific tolerances
  if (dim === 'sprBucket') {
    const ai = SPR_ORDER.indexOf(descValue);
    const bi = SPR_ORDER.indexOf(corpValue);
    if (ai !== -1 && bi !== -1 && Math.abs(ai - bi) === 1) {
      // Adjacent SPR zones → partial credit
      return { match: 0.5, differs: true };
    }
  }

  if (dim === 'texture') {
    // 'paired' tolerates both wet + dry (paired boards can be either)
    if ((a === 'paired' && (b === 'wet' || b === 'dry'))
      || (b === 'paired' && (a === 'wet' || a === 'dry'))) {
      return { match: 0.7, differs: true };
    }
  }

  return { match: 0, differs: true };
};

/**
 * Score a single descriptor × corpus entry pair.
 *
 * @returns {{score: number, differsOn: string[]}} score in [0, 1]
 */
export const scoreMatch = (descriptor, corpusEntry) => {
  if (!descriptor || !corpusEntry) return { score: 0, differsOn: SCORED_DIMENSIONS.slice() };

  let total = 0;
  const differsOn = [];

  // nodeId is a critical disambiguator — checked separately and gates
  // a "strong" classification. If nodeId is missing on descriptor, the
  // top tier of confidence is unreachable; matcher reports score on
  // 8 dims as usual but the orchestrator may downgrade strong→partial.
  for (const dim of SCORED_DIMENSIONS) {
    const { match, differs } = compareDimension(dim, descriptor[dim], corpusEntry[dim]);
    total += match;
    if (differs) differsOn.push(dim);
  }

  // nodeId match contributes a 9th implicit dimension — if it matches,
  // bump the score; if it differs, surface in differsOn but don't
  // re-divide (keeps thresholds at the documented 7/8 + 5/8 levels).
  const nodeMatch = compareDimension('nodeId', descriptor.nodeId, corpusEntry.nodeId);
  if (nodeMatch.differs) differsOn.push('nodeId');

  const score = total / SCORED_DIMENSIONS.length;
  return { score, differsOn };
};

/**
 * Rank an entire corpus against a descriptor. Returns sorted matches
 * descending by score, then by source ('upper-surface' before 'lsw'
 * as tie-breaker since upper-surface artifacts are deeper authored).
 *
 * @returns {Array<{artifactId, source, score, differsOn}>}
 */
export const rankMatches = (descriptor, corpus) => {
  if (!descriptor || !Array.isArray(corpus)) return [];
  const sourceRank = (s) => (s === 'upper-surface' ? 0 : 1);
  return corpus
    .map((entry) => {
      const { score, differsOn } = scoreMatch(descriptor, entry);
      return {
        artifactId: entry.artifactId,
        source: entry.source,
        score,
        differsOn,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return sourceRank(a.source) - sourceRank(b.source);
    });
};

/**
 * Classify a score into the 3-tier confidence ladder.
 */
export const classifyConfidence = (score) => {
  if (score >= STRONG_THRESHOLD) return 'strong';
  if (score >= PARTIAL_THRESHOLD) return 'partial';
  return 'no-analog';
};
