/**
 * getSchemaVersionChange.js — git wrapper + Check 4 decision logic.
 *
 * Two responsibilities:
 *   (1) Read the prior version of a manifest from `git show HEAD:<path>` so
 *       we can compare against the working-tree manifest.
 *   (2) Compute the Check 4 decision (5-branch tree) from a {prior, current}
 *       pair: does the schemaVersion bump discipline + proseOnlyEdit escape
 *       hatch permit this PR's diff?
 *
 * Pure helpers (`describeChange` + `evaluateCheck4`) are exported separately
 * so unit tests can exercise the decision tree without git side effects.
 *
 * Design: dependency injection on `gitShow` for testability. The default
 * implementation calls `child_process.execSync('git show HEAD:<path>')` and
 * returns null on any failure (file not in HEAD, no git, parse error).
 *
 * Spec: docs/projects/printable-refresher/content-drift-ci.md §Check 4
 *       docs/projects/printable-refresher/content-drift-ci.md §Check 1 (RT-108 escape hatch)
 */

import { execSync } from 'node:child_process';
import { stableStringify } from './lineage.js';

/**
 * Default git-show implementation. Returns the file content at HEAD as a
 * string, or null if:
 *   - The file does not exist in HEAD (newly added in this PR).
 *   - Git is not available (running in a non-git environment).
 *   - The git command failed for any other reason.
 *
 * Stderr is suppressed so test output stays clean even on the legitimate
 * "file not in HEAD" path.
 */
function defaultGitShow(relPath, cwd) {
  try {
    const out = execSync(`git show HEAD:${JSON.stringify(relPath)}`, {
      encoding: 'utf8',
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return typeof out === 'string' ? out : out.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Pure helper: derive the Check 4 change descriptor from a {prior, current}
 * pair. No I/O, no git access — testable in isolation.
 */
export function describeChange({ prior, current }) {
  if (!prior || !current) {
    return { exists: !!prior && !!current };
  }
  const bumped = current.schemaVersion > prior.schemaVersion;
  const decremented = current.schemaVersion < prior.schemaVersion;
  const bodyMarkdownDiffers = current.bodyMarkdown !== prior.bodyMarkdown;
  const generatedFieldsDiffer =
    stableStringify(current.generatedFields ?? {}) !==
    stableStringify(prior.generatedFields ?? {});
  const sourceUtilsDiffer =
    stableStringify(current.sourceUtils ?? []) !==
    stableStringify(prior.sourceUtils ?? []);
  const anyDiff = bodyMarkdownDiffers || generatedFieldsDiffer || sourceUtilsDiffer;
  const proseOnlyEdit = current.proseOnlyEdit === true;

  return {
    exists: true,
    prior,
    current,
    bumped,
    decremented,
    proseOnlyEdit,
    diff: { bodyMarkdownDiffers, generatedFieldsDiffer, sourceUtilsDiffer, anyDiff },
  };
}

/**
 * Fetch the prior manifest from HEAD (via git) and compute the change
 * descriptor against the current working-tree manifest.
 *
 * Returns `{ exists: false, reason }` for any case where comparison cannot
 * be performed:
 *   - 'no-rel-path'  — caller did not pass a path
 *   - 'not-in-head'  — file was not in HEAD (newly added in this PR)
 *   - 'parse-error'  — prior content failed to JSON.parse
 *
 * Per spec §Check 4 the not-in-head case is treated as PASS by callers
 * (first-commit case; recomputation must still match the stored hash via
 * Check 1 strict mode).
 */
export function getSchemaVersionChange(currentManifest, options = {}) {
  const {
    manifestRelPath,
    gitShow = defaultGitShow,
    cwd = process.cwd(),
  } = options;

  if (!manifestRelPath) {
    return { exists: false, reason: 'no-rel-path' };
  }

  const priorRaw = gitShow(manifestRelPath, cwd);
  if (priorRaw == null) {
    return { exists: false, reason: 'not-in-head' };
  }

  let prior;
  try {
    prior = JSON.parse(priorRaw);
  } catch {
    return { exists: false, reason: 'parse-error' };
  }

  return describeChange({ prior, current: currentManifest });
}

/**
 * Check 4 decision tree per spec §Check 4. Returns `{ pass, reason }`.
 *
 * Branches:
 *   not-in-head           → PASS (first-commit case; Check 1 strict mode handles)
 *   decremented           → FAIL (monotonic violation)
 *   no-diff + same-ver    → PASS (no re-version needed)
 *   diff + bumped         → PASS (intentional re-version)
 *   bumped + no-diff      → PASS (over-bumping is harmless)
 *   diff + same-ver
 *     + proseOnlyEdit
 *     + bodyMarkdown-only → PASS-with-warning (typo fix)
 *   diff + same-ver
 *     + proseOnlyEdit
 *     + non-prose diff    → FAIL (proseOnlyEdit misuse)
 *   diff + same-ver
 *     + no proseOnlyEdit  → FAIL (schemaVersion bump required)
 */
export function evaluateCheck4(change) {
  if (!change.exists) {
    return {
      pass: true,
      reason: `first-commit (${change.reason || 'no prior version in HEAD'}) — Check 1 strict mode handles drift`,
    };
  }
  if (change.decremented) {
    return {
      pass: false,
      reason: `schemaVersion decremented from ${change.prior.schemaVersion} to ${change.current.schemaVersion} (monotonic violation)`,
    };
  }
  if (!change.diff.anyDiff) {
    // No content diff. Bumped or not, this is harmless.
    return { pass: true, reason: 'no content diff (schemaVersion ' + (change.bumped ? 'bumped without diff — over-bump permitted' : 'unchanged') + ')' };
  }
  // Diff is present from here.
  if (change.bumped) {
    return { pass: true, reason: 'intentional re-version (diff + schemaVersion bumped)' };
  }
  // Diff + same version.
  if (change.proseOnlyEdit) {
    if (change.diff.generatedFieldsDiffer || change.diff.sourceUtilsDiffer) {
      return {
        pass: false,
        reason: 'proseOnlyEdit:true but diff includes generatedFields or sourceUtils (escape hatch misuse). proseOnlyEdit is only valid for bodyMarkdown-only changes.',
      };
    }
    return { pass: true, reason: 'prose-only edit (typo fix; bodyMarkdown-only diff)', warning: true };
  }
  return {
    pass: false,
    reason: 'content diff without schemaVersion bump or proseOnlyEdit:true. Either bump schemaVersion + recompute contentHash (intentional re-version), or set proseOnlyEdit:true for prose-only changes (typo fix).',
  };
}
