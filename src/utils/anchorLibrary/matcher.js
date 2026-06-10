/**
 * matcher.js — Live anchor matcher (pure utils)
 *
 * Per `docs/projects/exploit-anchor-library/exploit-anchor-library.project.md`
 * Stream B + `CLAUDE.md` File Responsibilities table (Commit 5 / Phase 8).
 *
 * Takes a structured `situation` (current game state at decision point) +
 * an array of `ExploitAnchor` records, returns the subset whose
 * `lineSequence` matches the situation. This is the pure-utils dep that
 * Stream C (LiveAdviceBar anchor-badge slot + SizingPresetsPanel embed)
 * consumes via the AnchorLibraryContext.
 *
 * No persistence. No effects. No React. Caller normalizes raw game state
 * into the situation shape; this module just walks the structural match.
 *
 * ─── Design decisions (SPR-055) ──────────────────────────────────────────
 *
 * **Matcher API shape: filtered-list.** `getMatchingAnchors(situation,
 * anchors, options?) → Anchor[]`. Phase 1 anchor counts are small (~4 seed
 * anchors); lazy iteration unnecessary. `matchesAnchor(situation, anchor)
 * → boolean` is also exported for testing individual anchors.
 *
 * **Status-filter: internal default + opt-out.** Default filter is
 * `active`-only (red line #6: candidates/retired/suppressed never fire on
 * live surfaces). Study-mode surfaces pass `{ includeStatuses: [...] }` to
 * see other states. S23 un-retirement: when an anchor's status flips
 * `retired → active`, the matcher picks it up automatically because the
 * filter reads the current status.
 *
 * **Retirement evaluator location: pure util (already shipped).**
 * `retirementEvaluator.js` is the existing pure-util dep; no co-changes.
 *
 * ─── Situation shape ─────────────────────────────────────────────────────
 *
 * ```js
 * {
 *   villainStyle?: string,         // 'Nit' | 'LAG' | 'TAG' | 'Fish' | null
 *                                  // matched case-insensitive against
 *                                  // deriveStyle(anchor); absent = wildcard
 *   actionHistory: {               // keyed by street; missing keys =
 *                                  // street hasn't happened yet
 *     preflop?: StreetEntry,
 *     flop?:    StreetEntry,
 *     turn?:    StreetEntry,
 *     river?:   StreetEntry,
 *   }
 * }
 *
 * StreetEntry = {
 *   heroAction?:    { kind: ActionKind, sizing?: number }, // sizing = ratio
 *                                                          // of pot, e.g. 0.75
 *   villainAction?: { kind: ActionKind, sizing?: number },
 *   board?: {
 *     texture?:   'dry'|'wet'|'paired'|'monotone'|
 *                 'flush-complete'|'straight-complete'|'any',
 *     scareKind?: '4-flush'|'straight-complete'|'overcard'|
 *                 'board-pair'|'none',
 *   },
 *   spr?: number,                  // current effective SPR at this street
 * }
 * ```
 *
 * Anchors specify a 1..3-step `lineSequence`; each `LineStep` is
 * effectively a constraint set on the matching `StreetEntry`. Absent
 * fields on the anchor side are wildcards (a step that omits `heroAction`
 * matches regardless of whether hero acted that street).
 *
 * Anchor texture `'any'` is an explicit wildcard that always matches
 * (per seed-01 flop step `texture: 'any'`).
 */

import { deriveStyle } from './librarySelectors';

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * Default status filter — only active anchors fire on live surfaces.
 * Aligns with red line #6 + I-AE-1 (sub-threshold anchors don't fire).
 */
export const DEFAULT_LIVE_STATUSES = Object.freeze(['active']);

/**
 * Matches a single anchor against a situation. Returns true if every step
 * in `anchor.lineSequence` finds a matching entry in `situation.actionHistory`
 * AND the villain style matches (when both sides specify it).
 *
 * Pure. Returns false (never throws) for malformed inputs.
 *
 * @param {Object} situation
 * @param {Object} anchor — ExploitAnchor record
 * @returns {boolean}
 */
export const matchesAnchor = (situation, anchor) => {
  if (!situation || typeof situation !== 'object') return false;
  if (!anchor || typeof anchor !== 'object') return false;

  const lineSeq = anchor.lineSequence;
  if (!Array.isArray(lineSeq) || lineSeq.length === 0) return false;

  const history = situation.actionHistory;
  if (!history || typeof history !== 'object') return false;

  if (!matchesStyle(situation, anchor)) return false;

  for (const step of lineSeq) {
    if (!step || typeof step !== 'object') return false;
    const entry = history[step.street];
    if (!entry || typeof entry !== 'object') return false;
    if (!matchesStep(step, entry)) return false;
  }

  return true;
};

/**
 * Returns the subset of anchors that match the situation. Default filter
 * keeps only `status === 'active'` anchors.
 *
 * @param {Object} situation
 * @param {Object[]} anchors
 * @param {Object} [options]
 * @param {string[]} [options.includeStatuses] — explicit allow-list of
 *        statuses; defaults to ['active']. Pass ['active','expiring',
 *        'retired','suppressed','candidate'] for study-mode surfaces.
 * @returns {Object[]}
 */
export const getMatchingAnchors = (situation, anchors, options) => {
  if (!Array.isArray(anchors) || anchors.length === 0) return [];

  const allowed = resolveStatusAllowList(options);

  const out = [];
  for (const anchor of anchors) {
    if (!anchor || typeof anchor !== 'object') continue;
    const status = anchor.status ?? 'active';
    if (!allowed.has(status)) continue;
    if (matchesAnchor(situation, anchor)) {
      out.push(anchor);
    }
  }
  return out;
};

// ───────────────────────────────────────────────────────────────────────────
// Internal — style match
// ───────────────────────────────────────────────────────────────────────────

/**
 * Style match is wildcarded when situation.villainStyle is absent — caller
 * may not have classified the villain yet. Both sides present: case-
 * insensitive string equality on the anchor's derived style.
 */
const matchesStyle = (situation, anchor) => {
  const sitStyle = situation.villainStyle;
  if (sitStyle === null || sitStyle === undefined || sitStyle === '') return true;
  if (typeof sitStyle !== 'string') return false;

  const anchorStyle = deriveStyle(anchor);
  if (!anchorStyle) return true; // anchor has no style claim → wildcard

  return sitStyle.toLowerCase() === anchorStyle.toLowerCase();
};

// ───────────────────────────────────────────────────────────────────────────
// Internal — step match
// ───────────────────────────────────────────────────────────────────────────

/**
 * Match a single LineStep against the corresponding StreetEntry.
 * Anchor-side absent fields are wildcards; texture 'any' is also wildcard.
 */
const matchesStep = (step, entry) => {
  if (step.heroAction && !matchesAction(step.heroAction, entry.heroAction)) return false;
  if (step.villainAction && !matchesAction(step.villainAction, entry.villainAction)) return false;
  if (step.boardCondition && !matchesBoardCondition(step.boardCondition, entry.board)) return false;
  if (step.sprRange && !matchesSprRange(step.sprRange, entry.spr)) return false;
  return true;
};

/**
 * Match an ActionKind constraint. Sizing range is checked only when both
 * the anchor specifies a range AND the entry includes a sizing number.
 */
const matchesAction = (constraint, actual) => {
  if (!actual || typeof actual !== 'object') return false;
  if (constraint.kind && constraint.kind !== actual.kind) return false;

  if (Array.isArray(constraint.sizingRange) && constraint.sizingRange.length === 2) {
    const [lo, hi] = constraint.sizingRange;
    if (typeof actual.sizing !== 'number') return false;
    if (actual.sizing < lo || actual.sizing > hi) return false;
  }
  return true;
};

/**
 * Match a board condition. Anchor 'any' texture is wildcard. Both texture
 * and scareKind are independent constraints.
 *
 * A constraint with no effective demand (texture absent or 'any', no
 * scareKind) matches even when the entry has no board info — 'any' means
 * "no constraint", not "board info required". When the constraint DOES
 * demand a real texture or scareKind and the entry has no board, the step
 * fails (can't verify → don't fire; fail-safe).
 */
const matchesBoardCondition = (constraint, actual) => {
  const wantsTexture = Boolean(constraint.texture) && constraint.texture !== 'any';
  const wantsScare = Boolean(constraint.scareKind);
  if (!wantsTexture && !wantsScare) return true;

  if (!actual || typeof actual !== 'object') return false;

  if (wantsTexture && constraint.texture !== actual.texture) return false;
  if (wantsScare && constraint.scareKind !== actual.scareKind) return false;
  return true;
};

/**
 * Match an SPR range constraint against the entry's effective SPR.
 */
const matchesSprRange = (range, actualSpr) => {
  if (!Array.isArray(range) || range.length !== 2) return false;
  if (typeof actualSpr !== 'number') return false;
  const [lo, hi] = range;
  return actualSpr >= lo && actualSpr <= hi;
};

// ───────────────────────────────────────────────────────────────────────────
// Internal — status allow-list resolution
// ───────────────────────────────────────────────────────────────────────────

const resolveStatusAllowList = (options) => {
  if (!options || typeof options !== 'object') {
    return new Set(DEFAULT_LIVE_STATUSES);
  }
  const include = options.includeStatuses;
  if (!Array.isArray(include) || include.length === 0) {
    return new Set(DEFAULT_LIVE_STATUSES);
  }
  return new Set(include);
};
