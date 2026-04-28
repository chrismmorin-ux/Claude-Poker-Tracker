/**
 * retirementCopy.js — deterministic copy generator for the retirement journey.
 *
 * Per `docs/design/journeys/anchor-retirement.md` §"Copy discipline rules":
 *   - AP-06 refusal applies to every text node in this journey.
 *   - Generator is deterministic from (action, anchor); no free-form LLM at runtime.
 *   - CI-grep target for forbidden-string violations (FORBIDDEN_PATTERNS export).
 *
 * Three primary actions:
 *   - `retire`    — anchor moves to status='retired'; visible in flat-list.
 *   - `suppress`  — status='suppressed'; library entry preserved.
 *   - `reset`     — calibration posterior dropped; 2-tap confirm required (destructive).
 *
 * One reverse action:
 *   - `undo`      — toast text + reverse-dispatch label.
 *
 * Output shape per call: { title, subText, confirmLabel, cancelLabel,
 *   destructiveCheckboxLabel?, successToast, undoLabel, undoneToast, errorToast }.
 *
 * EAL Phase 6 — Session 21 (S21).
 */

// ───────────────────────────────────────────────────────────────────────────
// Forbidden patterns (AP-06 — graded-work trap)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Patterns that MUST NOT appear in any generated copy. CI-grep target.
 * Scoped to avoid false-positive on technical strings (e.g., "your accuracy"
 * is forbidden but "anchor's accuracy" is fine — phrasing test).
 */
export const FORBIDDEN_PATTERNS = Object.freeze([
  /your accuracy/i,
  /your observation/i,
  /you were off/i,
  /you misjudged/i,
  /grade your/i,
  /score your/i,
  /how did you/i,
  /did you nail/i,
  /your confidence (in|was|may|might)/i,
  /this anchor underperformed/i,
  /giving up on this/i,
  /\breconsider\b.*\bretired\b/i,  // "reconsider retired" nudge — AP-05
]);

/**
 * Validate a generated string against forbidden patterns. Pure helper used
 * by tests + (in Phase 5+) CI-lint script `scripts/check-retirement-copy.sh`.
 *
 * @param {string} text
 * @returns {{ valid: boolean, violations: Array<{ pattern: string, match: string }> }}
 */
export const validateRetirementCopy = (text) => {
  if (typeof text !== 'string') return { valid: true, violations: [] };
  const violations = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    const m = text.match(pattern);
    if (m) violations.push({ pattern: String(pattern), match: m[0] });
  }
  return { valid: violations.length === 0, violations };
};

// ───────────────────────────────────────────────────────────────────────────
// Per-action copy bundles
// ───────────────────────────────────────────────────────────────────────────

const ACTION_COPY = {
  retire: {
    titleTemplate: (name) => `Retire ${name}?`,
    subText:
      'Retired anchors don\'t fire on live surfaces. Evidence history is preserved. ' +
      'You can re-enable this anchor from the Anchor Library at any time.',
    confirmLabel: 'Retire',
    successToastTemplate: (name) => `${name} retired.`,
    undoneToastTemplate: (name) => `${name} restored.`,
    overrideReason: 'manual-retire',
    targetStatus: 'retired',
    destructive: false,
  },
  suppress: {
    titleTemplate: (name) => `Suppress ${name}?`,
    subText:
      'Suppressed anchors don\'t fire on live surfaces but remain in the library. ' +
      'You can un-suppress from the Anchor Library flat-list at any time.',
    confirmLabel: 'Suppress',
    successToastTemplate: (name) => `${name} suppressed.`,
    undoneToastTemplate: (name) => `${name} restored.`,
    overrideReason: 'manual-suppress',
    targetStatus: 'suppressed',
    destructive: false,
  },
  reset: {
    titleTemplate: (name) => `Reset calibration for ${name}?`,
    subText:
      'Resetting drops accumulated observations and restarts Tier 2 calibration ' +
      'from seed priors. Evidence history is preserved but no longer contributes ' +
      'to the posterior. This action cannot be auto-undone after the 12s toast window.',
    confirmLabel: 'Reset',
    destructiveCheckboxLabel: 'I understand calibration data will be reset',
    successToastTemplate: (name) => `${name} calibration reset.`,
    undoneToastTemplate: (name) => `${name} calibration restored.`,
    overrideReason: 'manual-reset',
    targetStatus: null, // status unchanged on reset; only operator + calibrationGap stamp
    destructive: true,
  },
};

const VALID_ACTIONS = Object.freeze(Object.keys(ACTION_COPY));

/**
 * Whether the given action string is a known retirement journey action.
 */
export const isKnownRetirementAction = (action) => VALID_ACTIONS.includes(action);

/**
 * The full list of valid actions (for enum-style consumers).
 */
export const RETIREMENT_ACTIONS = VALID_ACTIONS;

/**
 * Build the copy bundle for a given action + anchor.
 *
 * @param {'retire'|'suppress'|'reset'} action
 * @param {Object} anchor — ExploitAnchor record
 * @returns {Object|null} copy bundle, or null for unknown action
 */
export const buildRetirementCopy = (action, anchor) => {
  const bundle = ACTION_COPY[action];
  if (!bundle) return null;
  const name = (anchor && typeof anchor.archetypeName === 'string' && anchor.archetypeName.length > 0)
    ? anchor.archetypeName
    : 'this anchor';

  return {
    action,
    anchorId: typeof anchor?.id === 'string' ? anchor.id : '',
    title: bundle.titleTemplate(name),
    subText: bundle.subText,
    confirmLabel: bundle.confirmLabel,
    cancelLabel: 'Cancel',
    destructiveCheckboxLabel: bundle.destructiveCheckboxLabel || null,
    destructive: bundle.destructive,
    successToast: bundle.successToastTemplate(name),
    undoLabel: 'Undo',
    undoneToast: bundle.undoneToastTemplate(name),
    errorToast: 'Couldn\'t save change. Please try again.',
    overrideReason: bundle.overrideReason,
    targetStatus: bundle.targetStatus,
  };
};

/**
 * Convenience — runs validateRetirementCopy across every text field in a bundle.
 * Used in tests; can be wired into CI lint as a per-bundle gate.
 */
export const validateRetirementCopyBundle = (bundle) => {
  if (!bundle || typeof bundle !== 'object') return { valid: true, violations: [] };
  const fields = [
    bundle.title,
    bundle.subText,
    bundle.confirmLabel,
    bundle.cancelLabel,
    bundle.destructiveCheckboxLabel,
    bundle.successToast,
    bundle.undoLabel,
    bundle.undoneToast,
    bundle.errorToast,
  ];
  const allViolations = [];
  for (const field of fields) {
    const { violations } = validateRetirementCopy(field);
    allViolations.push(...violations);
  }
  return { valid: allViolations.length === 0, violations: allViolations };
};

export default buildRetirementCopy;
