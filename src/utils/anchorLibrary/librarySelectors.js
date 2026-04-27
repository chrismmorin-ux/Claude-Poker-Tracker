/**
 * librarySelectors.js — Filtering selectors for AnchorLibraryView.
 *
 * Per `docs/design/surfaces/anchor-library.md` §State + §Filter row:
 *   - 5 independent filter groups (styles / streets / polarities / tiers / statuses)
 *   - Within a group: OR (multi-select union)
 *   - Across groups: AND (conjunctive)
 *   - Empty array means "All" (no filtering for that group)
 *
 * Style derivation: anchor schema doesn't ship a top-level `style` field today.
 * This module reads `anchor.style` if present, else falls back to the first
 * whitespace-separated token of `archetypeName` (canonical anchors are named
 * "Fish/Nit/LAG/TAG ..."). Forward-compatible: when schema adds `style`, this
 * Just Works without filter logic changes.
 *
 * Street derivation: from the LAST entry of `lineSequence` per surface spec
 * (the "spot" street the anchor names — e.g., a 3-step turn-river anchor is
 * filed under "river").
 *
 * Pure module. No persistence side effects.
 *
 * EAL Phase 6 — Session 19 (S19).
 */

// ───────────────────────────────────────────────────────────────────────────
// Field derivers (also exported for use in AnchorFilters chip-rendering)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Returns the anchor's villain style if reachable. Reads `anchor.style` first
 * (forward-compat); else first token of archetypeName; else null.
 */
export const deriveStyle = (anchor) => {
  if (!anchor || typeof anchor !== 'object') return null;
  if (typeof anchor.style === 'string' && anchor.style.length > 0) return anchor.style;
  const name = typeof anchor.archetypeName === 'string' ? anchor.archetypeName.trim() : '';
  if (!name) return null;
  const first = name.split(/\s+/)[0];
  return first || null;
};

/**
 * Returns the anchor's "spot" street (last entry of lineSequence) or null.
 */
export const deriveStreet = (anchor) => {
  const seq = Array.isArray(anchor?.lineSequence) ? anchor.lineSequence : [];
  if (seq.length === 0) return null;
  const last = seq[seq.length - 1];
  return last && typeof last.street === 'string' ? last.street : null;
};

/**
 * Returns the anchor's tier as a normalized string label ("Tier 0/1/2") or null.
 * Numeric tier 1 is rendered as "Tier 1 candidate" per surface spec — but for
 * filter-matching we use the raw key. UI may display the user-facing label.
 */
export const deriveTierKey = (anchor) => {
  if (!anchor || typeof anchor !== 'object') return null;
  if (typeof anchor.tier === 'number') return `tier-${anchor.tier}`;
  if (typeof anchor.tier === 'string' && anchor.tier.length > 0) return anchor.tier;
  return null;
};

// ───────────────────────────────────────────────────────────────────────────
// Filter shape + defaults
// ───────────────────────────────────────────────────────────────────────────

/**
 * Default empty filter set. All groups are empty arrays meaning "no filter."
 */
export const EMPTY_FILTERS = Object.freeze({
  styles: [],
  streets: [],
  polarities: [],
  tiers: [],
  statuses: [],
});

/**
 * True if every group is empty (no active filter).
 */
export const isFilterEmpty = (filters) => {
  if (!filters || typeof filters !== 'object') return true;
  const groups = ['styles', 'streets', 'polarities', 'tiers', 'statuses'];
  return groups.every((g) => !Array.isArray(filters[g]) || filters[g].length === 0);
};

// ───────────────────────────────────────────────────────────────────────────
// Filter selectors
// ───────────────────────────────────────────────────────────────────────────

/**
 * Apply a filter set to an anchor list. Pure. Empty groups = no filter.
 *
 * @param {Array} anchors
 * @param {Object} filters - { styles, streets, polarities, tiers, statuses }
 * @returns {Array}
 */
export const selectAnchorsFiltered = (anchors, filters) => {
  if (!Array.isArray(anchors)) return [];
  if (isFilterEmpty(filters)) return anchors;

  const styleSet = new Set(filters.styles || []);
  const streetSet = new Set(filters.streets || []);
  const polaritySet = new Set(filters.polarities || []);
  const tierSet = new Set((filters.tiers || []).map(String));
  const statusSet = new Set(filters.statuses || []);

  return anchors.filter((anchor) => {
    if (styleSet.size > 0) {
      const style = deriveStyle(anchor);
      if (!style || !styleSet.has(style)) return false;
    }
    if (streetSet.size > 0) {
      const street = deriveStreet(anchor);
      if (!street || !streetSet.has(street)) return false;
    }
    if (polaritySet.size > 0) {
      const p = anchor?.polarity;
      if (typeof p !== 'string' || !polaritySet.has(p)) return false;
    }
    if (tierSet.size > 0) {
      // Match user-selected tier values against either raw `tier` or
      // derived "tier-N" key. Accept both numeric tier-2 and string forms.
      const rawTier = anchor?.tier;
      const tierStr = typeof rawTier === 'number' ? String(rawTier) : (typeof rawTier === 'string' ? rawTier : '');
      const tierKey = deriveTierKey(anchor) || '';
      if (!tierSet.has(tierStr) && !tierSet.has(tierKey)) return false;
    }
    if (statusSet.size > 0) {
      const s = anchor?.status;
      if (typeof s !== 'string' || !statusSet.has(s)) return false;
    }
    return true;
  });
};
