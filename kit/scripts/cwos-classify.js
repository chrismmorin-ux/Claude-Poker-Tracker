/**
 * cwos-classify — Shared classification module (WS-265, ADR-037 Decision #3,
 * cross-critic ALTERATION-1).
 *
 * Two pure functions called inline by cwos-next.js (and future cwos-pulse.js,
 * cwos-audit.js):
 *   - classifySource(item) → 'auto-rec' | 'engine-finding' | 'pre-mortem'
 *                            | 'spr-followup' | 'plan-internal' | 'conversation'
 *                            | 'untagged'
 *   - classifyMode(item)   → 'execute' | 'plan-first'
 *
 * CRITICAL (ALTERATION-1): mode_classification is NOT cached on WS items.
 * classifyMode is invoked at candidate-list time, not stamped at write time.
 * The 5 trigger fields (effort, category, type, files_involved, decision_flags)
 * are already loaded when the WS YAML is loaded — caching adds an
 * invalidation surface for negative ROI.
 *
 * Pure: no I/O, no Date.now(), no module state, no caching. 100% deterministic
 * given input fields.
 *
 * Zero external deps.
 */

'use strict';

// ─── Source classification ──────────────────────────────────────────────────

/**
 * Classify the source-class of a workstream item.
 *
 * Rules (priority order — first match wins, mirrors next.md Step 2d):
 *   1. source === "auto-recommendation" (string)        → 'auto-rec'
 *   2. dict has `engine`                                → 'engine-finding'
 *   3. dict has `pre_mortem_id`                         → 'pre-mortem'
 *   4. dict has `parent_ws`                             → 'spr-followup'
 *   5. dict has `plan`                                  → 'plan-internal'
 *   6. dict has `conversation`                          → 'conversation'
 *   7. otherwise (absent / null / unknown shape)        → 'untagged'
 *
 * The priority order matches the source-class damping rule (Step 2d):
 * `auto-rec` and `engine-finding` are the saturation-prone classes;
 * founder-driven classes (`pre-mortem`, `plan-internal`, `conversation`,
 * `spr-followup`) come after but are never damped.
 *
 * @param {object} item — workstream item with optional `source` field
 * @returns {string} one of seven source-class enum values
 */
function classifySource(item) {
  if (!item) return 'untagged';
  const src = item.source;
  if (src == null) return 'untagged';

  if (typeof src === 'string') {
    if (src === 'auto-recommendation') return 'auto-rec';
    return 'untagged';
  }

  if (typeof src !== 'object' || Array.isArray(src)) return 'untagged';

  if ('engine' in src)         return 'engine-finding';
  if ('pre_mortem_id' in src)  return 'pre-mortem';
  if ('parent_ws' in src)      return 'spr-followup';
  if ('plan' in src)           return 'plan-internal';
  if ('conversation' in src)   return 'conversation';

  return 'untagged';
}

// ─── Mode classification ────────────────────────────────────────────────────

const PLAN_FIRST_CATEGORIES = new Set(['architecture', 'ux']);
const EXECUTE_TYPES = new Set(['bug', 'finding']);

/**
 * Classify the execution mode of a workstream item.
 *
 * plan-first if ANY of (next.md Step 3d):
 *   - effort is M or L
 *   - category is architecture or ux
 *   - type is improvement (NOT bug or finding)
 *   - files_involved spans 3+ distinct directories
 *   - decision_flags is populated (non-empty array)
 *
 * execute if ALL of:
 *   - effort is S
 *   - type is bug or finding
 *   - no decision_flags (empty or missing)
 *   - files_involved in 1-2 directories
 *
 * The two predicates are mutually exclusive given the trigger set: an item
 * with type="improvement" never matches `execute` because the type test
 * fails; an item with M/L effort always matches `plan-first` regardless of
 * other fields. There is no third bucket — every item resolves to one of
 * these two modes.
 *
 * @param {object} item — workstream item
 * @returns {string} 'execute' or 'plan-first'
 */
function classifyMode(item) {
  if (!item) return 'plan-first';   // defensive default — favor planning over rushing

  const effort = item.effort;
  const category = item.category;
  const type = item.type;
  const decisionFlags = item.decision_flags;
  const filesInvolved = item.files_involved;

  // ── plan-first triggers (any one fires) ─────────────────────────────────
  if (effort === 'M' || effort === 'L') return 'plan-first';
  if (PLAN_FIRST_CATEGORIES.has(category)) return 'plan-first';
  if (type && !EXECUTE_TYPES.has(type) && type === 'improvement') return 'plan-first';
  if (Array.isArray(decisionFlags) && decisionFlags.length > 0) return 'plan-first';
  if (Array.isArray(filesInvolved) && countDistinctDirs(filesInvolved) >= 3) return 'plan-first';

  // ── execute requirements (all must hold) ────────────────────────────────
  if (effort !== 'S') return 'plan-first';                        // not S → plan-first
  if (!type || !EXECUTE_TYPES.has(type)) return 'plan-first';     // not bug/finding → plan-first
  // (decision_flags + dirs already checked above; reaching here means they're fine)

  return 'execute';
}

/**
 * Count distinct top-level directories in a files_involved array.
 * Tolerant of annotated paths like "kit/scripts/foo.js (new)" or
 * "(parent only — ...)" — strips annotations and skips parenthetical-only
 * entries.
 *
 * Distinctness uses the dirname() of each path (POSIX-style separators).
 */
function countDistinctDirs(files) {
  const dirs = new Set();
  for (const raw of files) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('(')) continue;
    // Strip trailing annotation like " (new)" or " (hardlink target)"
    const annotIdx = trimmed.indexOf(' (');
    const pathPart = annotIdx === -1 ? trimmed : trimmed.slice(0, annotIdx);
    const norm = pathPart.replace(/\\/g, '/').trim();
    if (!norm) continue;
    const slashIdx = norm.lastIndexOf('/');
    const dir = slashIdx === -1 ? '.' : norm.slice(0, slashIdx);
    dirs.add(dir);
  }
  return dirs.size;
}

module.exports = {
  classifySource,
  classifyMode,
  countDistinctDirs,
};
