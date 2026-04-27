/**
 * observationTags.js — Tag normalization + classification for AnchorObservation
 *
 * Per `schema-delta.md` §3.1.1 tag vocabulary spec:
 *   - Fixed enum (8 seeds): villain-overfold, villain-overbluff, villain-overcall,
 *     hero-overfolded, unusual-sizing, perception-gap, style-mismatch, session-context
 *   - Free-text tags allowed; normalized lowercase kebab-case at write
 *   - Hybrid: owner picks ≥1 fixed tag, optionally adds free-text custom tags
 *
 * Pure module. No IO.
 */

import {
  OBSERVATION_TAG_ENUM,
  OBSERVATION_TAG_ENUM_SET,
  TAG_MAX_LENGTH,
} from '../../constants/anchorLibraryConstants';

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * Normalize a single tag string to lowercase kebab-case.
 *
 * Rules:
 *   - Trim leading/trailing whitespace.
 *   - Lowercase all alphabetic characters.
 *   - Collapse runs of whitespace, underscores, or any non-alphanumeric
 *     character to a single hyphen.
 *   - Strip leading/trailing hyphens after normalization.
 *   - Reject empty result OR tags exceeding TAG_MAX_LENGTH (60 chars).
 *
 * Returns `{ ok: true, tag: '...' }` on success or `{ ok: false, reason: '...' }` on failure.
 *
 * @param {unknown} input
 * @returns {{ok: true, tag: string} | {ok: false, reason: string}}
 */
export const normalizeTag = (input) => {
  if (typeof input !== 'string') {
    return { ok: false, reason: 'tag must be a string' };
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'tag is empty after trim' };
  }
  // Replace any non-alphanumeric run with a single hyphen, lowercase the result
  const kebab = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (kebab.length === 0) {
    return { ok: false, reason: 'tag has no alphanumeric characters' };
  }
  if (kebab.length > TAG_MAX_LENGTH) {
    return { ok: false, reason: `tag exceeds ${TAG_MAX_LENGTH}-char limit (got ${kebab.length})` };
  }
  return { ok: true, tag: kebab };
};

/**
 * Normalize a set of tags. Deduplicates after normalization and preserves
 * input order for the deduped result.
 *
 * Returns the result with both successful + failed entries so the caller can
 * report partial success at the UI layer (e.g. "added 4 tags; 1 was empty").
 *
 * @param {unknown[]} tags
 * @returns {{normalized: string[], rejected: Array<{input: unknown, reason: string}>}}
 */
export const normalizeTagSet = (tags) => {
  if (!Array.isArray(tags)) {
    return {
      normalized: [],
      rejected: [{ input: tags, reason: 'tags input is not an array' }],
    };
  }
  const seen = new Set();
  const normalized = [];
  const rejected = [];

  for (const raw of tags) {
    const result = normalizeTag(raw);
    if (!result.ok) {
      rejected.push({ input: raw, reason: result.reason });
      continue;
    }
    if (seen.has(result.tag)) {
      // Silent dedupe — not an error
      continue;
    }
    seen.add(result.tag);
    normalized.push(result.tag);
  }

  return { normalized, rejected };
};

/**
 * Check if a tag (already normalized) belongs to the fixed enum.
 *
 * @param {string} tag — must be already-normalized (call normalizeTag first
 *   if input source is uncertain)
 * @returns {boolean}
 */
export const isFixedEnumTag = (tag) => OBSERVATION_TAG_ENUM_SET.has(tag);

/**
 * Check if a tag is a custom free-text tag (i.e. not in the fixed enum).
 *
 * @param {string} tag — must be already-normalized
 * @returns {boolean}
 */
export const isCustomTag = (tag) => typeof tag === 'string' && tag.length > 0 && !isFixedEnumTag(tag);

/**
 * Split a normalized tag set into { fixed, custom } classification.
 *
 * Useful for UI rendering where fixed-enum tags get the chip treatment
 * and custom tags display as text-pills with a different style.
 *
 * @param {string[]} normalizedTags
 * @returns {{fixed: string[], custom: string[]}}
 */
export const classifyTags = (normalizedTags) => {
  const fixed = [];
  const custom = [];
  if (!Array.isArray(normalizedTags)) return { fixed, custom };
  for (const tag of normalizedTags) {
    if (isFixedEnumTag(tag)) {
      fixed.push(tag);
    } else if (isCustomTag(tag)) {
      custom.push(tag);
    }
    // Silently drop non-strings + empty strings
  }
  return { fixed, custom };
};

/**
 * Validate that a normalized tag set has at least one fixed-enum tag
 * (per schema-delta §3.1.1: "owner picks ≥1 fixed tag").
 *
 * @param {string[]} normalizedTags
 * @returns {boolean}
 */
export const hasAtLeastOneFixedTag = (normalizedTags) => {
  if (!Array.isArray(normalizedTags)) return false;
  return normalizedTags.some(isFixedEnumTag);
};

// Re-export the source-of-truth enum for callers that want it from this module.
export { OBSERVATION_TAG_ENUM };
