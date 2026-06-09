/**
 * @file scorePlayerMatch.js — recognition match scoring + highlight metadata.
 *
 * WS-164 / SPR-110 (PIO G5 child E). Implements the §PIO-G4-PVA weighted
 * recognition score + §PIO-G4-DISAMB confidence band, per
 * `docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md`.
 *
 * This REPLACES (per founder decision, SPR-110) the PEO-3 highlight primitive
 * that previously lived in `src/hooks/usePlayerFiltering.js`. The contract is
 * EXTENDED additively: the function now returns a weighted `score` (+ `perDim`
 * + `confidence` band) in addition to the original highlight metadata
 * (`nameMatchStart` / `nameMatchEnd` / `matchedFeatures` /
 * `unmatchedFeatureFilters` / `allFiltersMatch` / `passesFilters`). Existing
 * highlight consumers are unaffected; new consumers (PlayersView ranking,
 * ConfidenceBar) read `score` / `confidence`. `usePlayerFiltering.js`
 * re-exports `scorePlayerMatch` from here to preserve the public import path.
 *
 * §PIO-G4-PVA score:
 *   score = 0.35·name + 0.10·age + 0.10·skin + 0.10·ethnicity + 0.10·hair
 *         + 0.05·jewelry + 0.05·wardrobe + 0.05·hat + 0.05·logo      (= 1.00)
 * Each non-name dim's contribution is scaled by `computeStability().posterior`
 * (always≈full, sometimes≈half, today-only≈near-zero) when sighting history is
 * supplied. The denominator renormalizes over ACTIVE query dims only, so a
 * name-only query can reach 1.0 rather than being capped at the name weight.
 *
 * §PIO-G4-DISAMB confidence band: ≥0.7 'strong' / 0.4–0.7 'partial' / <0.4 'weak'.
 *
 * Per AP-PIO-05 / AP-PIO-01: demographic attributes drive identification
 * ranking ONLY — this module must never feed the exploit engine / tendencyMap.
 */

import { matchesInRange } from '../playerFilterRange.js';
import { computeStability } from './computeStability.js';

// §PIO-G4-PVA weight vector, taken verbatim from the audit's per-dim values.
// NOTE: the audit text states these "= 1.00", but the listed values actually
// sum to 0.95 (0.35 + 0.10×4 + 0.05×4) — a documented arithmetic discrepancy in
// the spec. It does NOT affect scores: the score renormalizes over the ACTIVE
// query dims' weights, so only the relative weighting matters, not the absolute
// sum. Preserving the audit's literal per-dim weights rather than inventing a
// different distribution to force a 1.00 total.
export const RECOGNITION_WEIGHTS = {
  name: 0.35,
  age: 0.10,
  skin: 0.10,
  ethnicity: 0.10,
  hair: 0.10,
  jewelry: 0.05,
  wardrobe: 0.05,
  hat: 0.05,
  logo: 0.05,
};

// §PIO-G4-DISAMB confidence-band thresholds (v1; tunable per audit).
export const CONFIDENCE_THRESHOLDS = { strong: 0.7, partial: 0.4 };

// Each score dim → { the player field it reads, the query field it reads,
// whether the value is an array (set-overlap) or a scalar, and the
// playerFilterRange axis name for adjacency partial-credit (null = exact-only). }
const DIM_SPEC = {
  age:       { playerField: 'ageDecade',     queryField: 'ageDecade',     array: false, rangeAxis: 'ageDecade', stabilityAttr: 'ageDecade' },
  skin:      { playerField: 'skinTone',      queryField: 'skinTone',      array: false, rangeAxis: 'skinTone',  stabilityAttr: 'skinTone' },
  ethnicity: { playerField: 'ethnicityTags', queryField: 'ethnicityTags', array: true,  rangeAxis: null,        stabilityAttr: 'ethnicityTags' },
  hair:      { playerField: 'hairColor',     queryField: 'hairColor',     array: false, rangeAxis: 'hairColor', stabilityAttr: 'hairColor' },
  jewelry:   { playerField: 'jewelry',       queryField: 'jewelry',       array: true,  rangeAxis: null,        stabilityAttr: 'jewelry' },
  wardrobe:  { playerField: 'wardrobe',      queryField: 'wardrobe',      array: true,  rangeAxis: null,        stabilityAttr: 'wardrobe' },
  hat:       { playerField: 'headwear',      queryField: 'headwear',      array: false, rangeAxis: null,        stabilityAttr: 'headwear' },
  logo:      { playerField: 'logo',          queryField: 'logo',          array: true,  rangeAxis: null,        stabilityAttr: 'logo' },
};

const isPresent = (v) => {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const lc = (s) => String(s).toLowerCase();

/**
 * matchScore for a scalar dim: exact → 1.0; adjacent (on a range axis) → 0.5;
 * else 0. Non-range axes are exact-only.
 */
const scalarMatch = (rangeAxis, queryValue, playerValue) => {
  if (!isPresent(playerValue)) return 0;
  if (lc(queryValue) === lc(playerValue)) return 1.0;
  if (rangeAxis) {
    const inRange = matchesInRange(rangeAxis, queryValue, playerValue);
    if (inRange === true) return 0.5; // neighbor (not exact, since exact handled above)
  }
  return 0;
};

/**
 * matchScore for an array dim: |query ∩ player| / |query| in [0..1].
 */
const arrayMatch = (queryArr, playerArr) => {
  const q = (Array.isArray(queryArr) ? queryArr : [queryArr]).filter(isPresent).map(lc);
  if (q.length === 0) return 0;
  const p = new Set((Array.isArray(playerArr) ? playerArr : []).filter(isPresent).map(lc));
  let hits = 0;
  for (const v of q) if (p.has(v)) hits += 1;
  return hits / q.length;
};

/**
 * Band a [0..1] score into a confidence label per §PIO-G4-DISAMB.
 * @returns {'strong' | 'partial' | 'weak'}
 */
export const bandConfidence = (score) => {
  if (score >= CONFIDENCE_THRESHOLDS.strong) return 'strong';
  if (score >= CONFIDENCE_THRESHOLDS.partial) return 'partial';
  return 'weak';
};

/**
 * Score a player against a recognition query + compute highlight metadata.
 *
 * @param {object} player — a player record (modern identification fields)
 * @param {object} query
 *   @param {string}  [query.nameQuery]      — live text (name/nickname prefix; drives the name dim + highlight)
 *   @param {object}  [query.featureFilters] — legacy avatarFeatures highlight filters (PEO-3 highlight path)
 *   @param {string}  [query.ageDecade]
 *   @param {string}  [query.skinTone]
 *   @param {string[]}[query.ethnicityTags]
 *   @param {string}  [query.hairColor]
 *   @param {string[]}[query.jewelry]
 *   @param {string[]}[query.wardrobe]
 *   @param {string}  [query.headwear]
 *   @param {string[]}[query.logo]
 * @param {object} [options]
 *   @param {Array}   [options.sightings]    — sighting history for this player; enables stability scaling
 * @returns {{
 *   score: number,                          // §PIO-G4-PVA weighted recognition score [0..1]
 *   confidence: 'strong'|'partial'|'weak',  // §PIO-G4-DISAMB band
 *   perDim: Object<string,{match:number,weight:number,stability:number,contribution:number}>,
 *   nameMatchStart: number|null,
 *   nameMatchEnd: number|null,
 *   matchedFeatures: Set<string>,
 *   unmatchedFeatureFilters: Set<string>,
 *   allFiltersMatch: boolean,
 *   passesFilters: boolean,
 * }}
 */
export const scorePlayerMatch = (player, query = {}, options = {}) => {
  const nameQuery = (query.nameQuery ?? '').toString().trim();
  const featureFilters = query.featureFilters || {};
  const sightings = options.sightings;

  // --- Name prefix match (highlight metadata; unchanged from PEO-3) --------
  let nameMatchStart = null;
  let nameMatchEnd = null;
  let namePasses = true;

  if (nameQuery.length > 0) {
    const q = nameQuery.toLowerCase();
    const candidates = [player?.name, player?.nickname].filter(Boolean);
    let best = null;
    for (const candidate of candidates) {
      const idx = candidate.toLowerCase().indexOf(q);
      if (idx === 0) {
        best = { start: 0, end: q.length, onName: candidate === player?.name };
        if (best.onName) break;
      }
    }
    if (best) {
      nameMatchStart = best.start;
      nameMatchEnd = best.end;
    } else {
      namePasses = false;
    }
  }

  // --- Feature filter match (legacy avatarFeatures highlight; unchanged) ---
  const matchedFeatures = new Set();
  const unmatchedFeatureFilters = new Set();
  const playerFeatures = player?.avatarFeatures || {};
  const activeFilterCategories = Object.entries(featureFilters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '');

  for (const [category, filterValue] of activeFilterCategories) {
    if (playerFeatures[category] === filterValue) {
      matchedFeatures.add(category);
    } else {
      unmatchedFeatureFilters.add(category);
    }
  }
  const allFiltersMatch = unmatchedFeatureFilters.size === 0;

  // --- §PIO-G4-PVA weighted recognition score ------------------------------
  const perDim = {};
  let numerator = 0;
  let activeWeight = 0;

  // Name dim — active when a name query is present. matchScore is the prefix
  // result (1 if matched, 0 if not). Name is inherently stable (no scaling).
  if (nameQuery.length > 0) {
    const match = nameMatchStart !== null ? 1 : 0;
    const weight = RECOGNITION_WEIGHTS.name;
    perDim.name = { match, weight, stability: 1, contribution: weight * match };
    numerator += weight * match;
    activeWeight += weight;
  }

  for (const [dim, spec] of Object.entries(DIM_SPEC)) {
    const queryValue = query[spec.queryField];
    if (!isPresent(queryValue)) continue; // dim inactive — excluded from renormalization
    const playerValue = player?.[spec.playerField];
    const match = spec.array
      ? arrayMatch(queryValue, playerValue)
      : scalarMatch(spec.rangeAxis, queryValue, playerValue);
    // Stability scaling (per §PIO-G3-STAB): only when sighting history supplied.
    let stability = 1;
    if (Array.isArray(sightings)) {
      stability = computeStability(sightings, spec.stabilityAttr).posterior;
    }
    const weight = RECOGNITION_WEIGHTS[dim];
    const contribution = weight * match * stability;
    perDim[dim] = { match, weight, stability, contribution };
    numerator += contribution;
    activeWeight += weight;
  }

  const rawScore = activeWeight > 0 ? numerator / activeWeight : 0;
  const score = Math.min(1, Math.max(0, rawScore));

  return {
    score,
    confidence: bandConfidence(score),
    perDim,
    nameMatchStart,
    nameMatchEnd,
    matchedFeatures,
    unmatchedFeatureFilters,
    allFiltersMatch,
    passesFilters: namePasses && allFiltersMatch,
  };
};
