/**
 * shared/render-affordance.js — V-affordance pure render module.
 *
 * Implements the closed shape enumeration + decorative-glyph registry +
 * delegated-listener pattern resolved at SHC Gate 4 V-affordance walkthrough
 * (2026-04-28, doctrine v6 amendment R-1.10 + INV-AFFORD-1..5).
 *
 * Shell-spec source: docs/design/surfaces/sidebar-shell-spec.md §IV.
 * Doctrine source:   docs/SIDEBAR_DESIGN_PRINCIPLES.md §1 R-1.10.
 *
 * This module is the single source of truth for affordance vocabulary in the
 * sidebar.
 *
 * Gate 5 PR-2 (2026-04-29) shipped the vocabulary + delegated listener +
 * tourney-bar migration.
 *
 * Gate 5 PR-11 (2026-04-30) completed the chevron-class collapse: all 4
 * legacy classes (.deep-chevron / .collapsible-chevron / .pp-chevron /
 * .tourney-bar-chevron) deleted from side-panel.html — every chevron site
 * now consumes .affordance-chevron via the renderChevron helper. Click
 * wiring for pp-toggle / more-analysis / model-audit consolidated into the
 * affordanceRegistry (single document-rooted listener); per-element
 * addEventListener pattern eliminated. wireModelAuditClick + dataset.maWired
 * marker removed — delegated listener at document level survives the Z4
 * row 4.3 dynamic re-insertion.
 *
 * Remaining V-affordance §IV.10 co-shipping items (Gate 5 PR-12+):
 * #6 .show-toggle-btn element-type fix (button → role=link),
 * #7 render-orchestrator.js:147 || → ?? fix,
 * #8 hero seat-arc ring migration to non-color encoding.
 */

// ===========================================================================
// CLOSED 6-SHAPE ENUMERATION (V-affordance §IV.1)
// ===========================================================================
// Affordances must use one of these 6 shapes; new shapes require a doctrine
// amendment per R-1.10 + V-affordance §IV.1. The non-interactive `chip`
// sub-form disambiguates the pill double-use (pill = click-action,
// chip = categorical tag).

export const AFFORDANCE_SHAPES = Object.freeze({
  CHEVRON: 'chevron',
  UNDERLINE: 'underline',
  PILL: 'pill',
  CIRCLE: 'circle',
  DIVIDER: 'divider',
  DECORATIVE_GLYPH: 'decorative-glyph',
});

export const PILL_SUB_FORM_CHIP = 'chip'; // non-interactive categorical tag

// ===========================================================================
// CLOSED DECORATIVE-GLYPH REGISTRY (V-affordance §IV.7 + INV-AFFORD-3)
// ===========================================================================
// New glyphs require doctrine amendment per shell-spec §IV.7. The 4 entries
// below match the SHC-resolved registry; chevron direction is vertical-only
// (`▾` collapsed / `▴` expanded) per INV-AFFORD-3.

export const DECORATIVE_GLYPHS = Object.freeze({
  HERO_STAR: { glyph: '★', name: 'hero-star', meaning: 'hero seat marker' },          // ★
  BLOCKER: { glyph: '♦', name: 'blocker', meaning: 'blocker indicator' },              // ♦
  WEAKNESS: { glyph: '●', name: 'weakness-bullet', meaning: 'weakness/severity' },     // ●
  HAND_PLAN_BRANCH: { glyph: '→', name: 'hand-plan-branch', meaning: 'plan-branch' },  // →
});

export const CHEVRON_GLYPHS = Object.freeze({
  COLLAPSED: '▾', // ▾ — vertical-only per INV-AFFORD-3
  EXPANDED: '▴',  // ▴ — vertical-only per INV-AFFORD-3
});

// ===========================================================================
// renderChevron — emit canonical chevron span
// ===========================================================================
// Per V-affordance §IV.3 (chevron direction verified at side-panel.html:1266
// 2026-04-28): chevron is visual indicator only; the interactive element
// is the parent header row (≥44×44 per INV-AFFORD-4). aria-hidden=true
// because the parent owns the role="button" + aria-expanded contract.
//
// `open` drives the .open modifier class; the CSS rule
// `.affordance-chevron.open { transform: rotate(180deg); }` handles the
// `▾` → `▴` visual rotation. Parent-class-driven rotation
// (`.deep-section.open .affordance-chevron`) is also supported for legacy
// deep-section sites where the parent class already encodes the
// open/closed state (no behavior change vs the legacy `.deep-chevron`).

export const renderChevron = ({ id, open = false, extraClass = '' } = {}) => {
  const klass = `affordance-chevron${open ? ' open' : ''}${extraClass ? ' ' + extraClass : ''}`;
  const idAttr = id ? ` id="${id}"` : '';
  return `<span class="${klass}"${idAttr} aria-hidden="true">${CHEVRON_GLYPHS.COLLAPSED}</span>`;
};

// ===========================================================================
// Affordance attributes — for parent (interactive) elements
// ===========================================================================
// Returns the attribute string to spread onto an interactive parent element
// that owns a chevron affordance. Use this when authoring the parent
// `<div>` / `<button>` to declare the affordance + click-target binding
// for the delegated listener.
//
// Example:
//   `<div class="tourney-bar" ${affordanceAttrs({ shape: 'chevron',
//     target: 'tournament-detail', expanded: !collapsed })}>...`

export const affordanceAttrs = ({ shape, target, expanded }) => {
  if (!Object.values(AFFORDANCE_SHAPES).includes(shape)) {
    throw new Error(`affordance shape "${shape}" not in closed enumeration`);
  }
  if (!target || typeof target !== 'string') {
    throw new Error('affordance target must be a non-empty string');
  }
  const expandedAttr = expanded === undefined
    ? ''
    : ` aria-expanded="${expanded ? 'true' : 'false'}"`;
  return `data-affordance="${shape}" data-affordance-target="${target}" role="button"${expandedAttr}`;
};

// ===========================================================================
// installAffordanceListener — single delegated listener
// ===========================================================================
// Installs ONE click listener on the given root element. Clicks bubbling up
// from a `[data-affordance][data-affordance-target]` element are dispatched
// to the registered handler for that target. Per V-affordance §IV.8 this
// replaces the legacy pattern of multiple per-element `.onclick` handlers
// (FM-AFFORD-1 race risk: handler attached to detached element after
// scheduleRender clobbers innerHTML).
//
// `registry` is a Map<targetName, handler> where handler receives
// (event, targetEl, target). Returns an unsubscribe function for tests.

export const installAffordanceListener = (root, registry) => {
  if (!root || typeof root.addEventListener !== 'function') {
    throw new Error('installAffordanceListener: root must be an EventTarget');
  }
  if (!(registry instanceof Map)) {
    throw new Error('installAffordanceListener: registry must be a Map');
  }
  const handler = (event) => {
    const targetEl = event.target.closest('[data-affordance][data-affordance-target]');
    if (!targetEl) return;
    const target = targetEl.getAttribute('data-affordance-target');
    const dispatch = registry.get(target);
    if (typeof dispatch === 'function') {
      dispatch(event, targetEl, target);
    }
  };
  root.addEventListener('click', handler);
  return () => root.removeEventListener('click', handler);
};
