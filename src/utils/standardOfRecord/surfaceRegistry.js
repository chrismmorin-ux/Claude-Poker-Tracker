/**
 * surfaceRegistry.js — the four surface kinds, and the sixth surface FSA was missing.
 *
 * A SURFACE is the Five-Surface Atlas's term, unchanged: a function from game state to
 * action distribution. Over the space of game states that function is a surface, and the
 * question the atlas exists to answer is how much volume separates two of them.
 *
 * FSA registers five surfaces across three KINDS — one Equilibrium, three Fields, one Read.
 * Every one of them is OBSERVED, FITTED, or IMPORTED. None can be DECLARED: there is no way
 * to author a strategy on purpose, run it, and score it. `Declared` is the fourth kind and
 * WS-322 is where it gets registered.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * `surface_kind`, NOT `surface_class` — a name collision resolved deliberately.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * `docs/provenance/data-source-registry.md` already carries a `surface_class:` field on all
 * fifteen SRC entries, meaning something entirely different — `internal_db | vendor_api |
 * derived | reference_data`, i.e. what KIND OF STORE a data source is. That register is
 * promoted, has an audit program behind it, and shipped first.
 *
 * ADR-009 line 203 says no third meaning of "surface" is permitted, and it is right, but the
 * cheapest way to honour it is to give the NEW axis a new name rather than to rewrite fifteen
 * entries in a promoted register. So: `surface_kind` here, `surface_class` there, and a
 * cross-reference line in the provenance register so the next person to grep finds both.
 * Founder decision, 2026-08-02.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * It does not compare surfaces. FSA Phase 3 — the divergence instrument — does not exist in
 * code; Phase 1 (the situation key) is the only phase that does. ADR-009's guarantee is that
 * `Declared` is scored by the SAME instrument as the other four and that no second comparison
 * path is permitted. The way to honour that guarantee from here is to build no comparison at
 * all: register the surfaces, define the interface Phase 3 will consume, and stop. Adding a
 * divergence function here would create exactly the second path the ADR forbids, and it would
 * be built before the open question of what `d` even is (FSA open question #2 — KL versus
 * EV-difference, "decide in Phase 3, measure both") has been answered.
 */

/**
 * The four surface kinds.
 *
 *   Equilibrium — what an unexploitable opponent does. IMPORTED (SRC-013, does not exist yet).
 *   Field       — what a population does. OBSERVED (SRC-011/012, SRC-005, SRC-014).
 *   Read        — what our model believes THIS villain does. FITTED.
 *   Declared    — what someone said they would do, on purpose, with reasons. AUTHORED.
 */
export const SURFACE_KINDS = Object.freeze(['Equilibrium', 'Field', 'Read', 'Declared']);

export const isSurfaceKind = (k) => SURFACE_KINDS.includes(k);

/**
 * How a surface came to exist. Recorded because it is the property that separates `Declared`
 * from the other three, and because "who authored this" is the first question about a claim.
 */
export const SURFACE_ORIGINS = Object.freeze({
  Equilibrium: 'imported',
  Field: 'observed',
  Read: 'fitted',
  Declared: 'authored',
});

/**
 * A registered surface.
 *
 * @typedef {Object} SurfaceEntry
 * @property {string} surfaceId
 * @property {string} surfaceKind - one of SURFACE_KINDS
 * @property {string[]} sources - SRC-* ids from the promoted provenance registry
 * @property {Array|null} stack - the ordered layers composing this surface (WS-324)
 * @property {string|null} pool - stake + venue class; FSA cannot separate its Fields without it
 * @property {string|null} contentHash - for a Declared surface, its Card's hash
 */

/**
 * Build a surface registry entry.
 *
 * `stack` is accepted and stored but NOT yet required. WS-324 ("Declare the Stack") is the
 * ticket that makes an unstacked surface unregistrable — and its own acceptance criterion is
 * that such a surface "cannot be registered, it is not merely warned about". Enforcing it
 * here, before the layer vocabulary exists, would reject every surface in the repo including
 * the ones already shipping. So the slot exists now, the refusal arrives with the thing that
 * can satisfy it, and this comment records that the gap is intentional rather than forgotten.
 */
export const buildSurfaceEntry = ({
  surfaceId,
  surfaceKind,
  sources = [],
  stack = null,
  pool = null,
  contentHash = null,
} = {}) => {
  if (!surfaceId || typeof surfaceId !== 'string') {
    throw new Error('surfaceId is required to register a surface');
  }
  if (!isSurfaceKind(surfaceKind)) {
    throw new Error(
      `surfaceKind "${surfaceKind}" is not one of ${SURFACE_KINDS.join(' | ')}`,
    );
  }
  return {
    surfaceId,
    surfaceKind,
    origin: SURFACE_ORIGINS[surfaceKind],
    sources: [...sources],
    stack,
    pool,
    contentHash,
  };
};
