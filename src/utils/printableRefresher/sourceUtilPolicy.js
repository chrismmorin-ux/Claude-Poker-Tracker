/**
 * sourceUtilPolicy.js — Check 2 enforcement (whitelist + blacklist).
 *
 * F4 + F6 fidelity bar: every card's source-trail must point to a util that
 * is safe to ship on paper. Calibration / assumption / per-villain utilities
 * are blacklisted because they invalidate the moment calibration retires
 * in-app — but the laminate survives. A laminated card cannot be "deprecated";
 * once printed it represents permanent advice. So the whitelist enumerates
 * stable, audit-able sources (poker-core algorithms + theory-derived constants
 * + POKER_THEORY.md derivations) and the blacklist enumerates everything that
 * is per-villain or calibration-dependent.
 *
 * Spec: docs/projects/printable-refresher/content-drift-ci.md §Check 2
 *       Charter §Acceptance Criteria — Source-util whitelist/blacklist
 */

export const WHITELIST_REGEXES = [
  /^src\/utils\/pokerCore\//,
  /^src\/constants\/gameTreeConstants\.js$/,
  /^\.claude\/context\/POKER_THEORY\.md$/,
];

export const BLACKLIST_REGEXES = [
  /^src\/utils\/exploitEngine\/villainDecisionModel\.js$/,
  /^src\/utils\/exploitEngine\/villainObservations\.js$/,
  /^src\/utils\/exploitEngine\/villainProfileBuilder\.js$/,
  /^src\/utils\/assumptionEngine\//,
  /^src\/utils\/anchorLibrary\//,
  /^src\/components\/views\/CalibrationDashboardView\//,
  /^src\/components\/views\/AnchorLibraryView\//,
];

const BLACKLIST_BODY_REFERENCES = [
  'villainDecisionModel',
  'villainObservations',
  'villainProfileBuilder',
  'assumptionEngine',
  'anchorLibrary',
  'CalibrationDashboardView',
  'AnchorLibraryView',
];

function matchesAny(path, regexes) {
  return regexes.some((re) => re.test(path));
}

/**
 * Validate that a manifest's source-util references comply with the
 * whitelist + blacklist policy.
 *
 * Pass-through case: `sourceUtils: []` is permitted when the card is a pure
 * POKER_THEORY-derivation (auto-profit + other field-invariant math). The
 * Check 6 lineage-footer verifier ensures such cards still cite a theory
 * section in field [5] — no missing-citation risk here.
 *
 * @param {object} manifest
 * @returns {{ valid: boolean, violations: { kind: string, detail: string }[] }}
 */
export function validateSourceUtils(manifest) {
  const violations = [];
  const sourceUtils = Array.isArray(manifest.sourceUtils) ? manifest.sourceUtils : [];

  for (const su of sourceUtils) {
    const path = String(su?.path || '');
    if (matchesAny(path, BLACKLIST_REGEXES)) {
      violations.push({
        kind: 'blacklist-match',
        detail: `sourceUtils[].path "${path}" matches blacklist. Per charter §Source-util whitelist/blacklist, calibration / assumption / per-villain utilities must not ship on paper — they invalidate once calibration retires in-app but the laminate survives.`,
      });
      continue;
    }
    if (!matchesAny(path, WHITELIST_REGEXES)) {
      violations.push({
        kind: 'whitelist-miss',
        detail: `sourceUtils[].path "${path}" is not on the whitelist (^src/utils/pokerCore/ OR ^src/constants/gameTreeConstants\\.js$ OR ^\\.claude/context/POKER_THEORY\\.md$). If the source genuinely belongs on paper, propose an amendment per charter §Acceptance Criteria amendment rule.`,
      });
    }
  }

  // Body-text scan: reject blacklisted-path string references in bodyMarkdown
  // even if sourceUtils is otherwise clean (catches "see villainDecisionModel.js"
  // prose references that smuggle calibration coupling onto paper).
  const body = String(manifest.bodyMarkdown || '');
  for (const ref of BLACKLIST_BODY_REFERENCES) {
    if (body.includes(ref)) {
      violations.push({
        kind: 'blacklist-body-reference',
        detail: `bodyMarkdown contains blacklisted reference "${ref}". Even prose references to per-villain or calibration-dependent utilities are forbidden — the card body must not describe lookup behavior that would invalidate in-app.`,
      });
    }
  }

  return { valid: violations.length === 0, violations };
}
