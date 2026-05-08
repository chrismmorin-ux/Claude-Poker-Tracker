#!/usr/bin/env node
/**
 * check-commerce-copy.cjs — CI-grep gate for commerce UX copy doctrine.
 *
 * Enforces the forbidden-string lists in
 * `docs/projects/monetization-and-pmf/anti-patterns.md` (29 refusals,
 * MPMF-AP-01 through MPMF-AP-29). Any match in scoped paths exits 1
 * with file:line:column + matched pattern + the MPMF-AP-NN refusal name
 * + link to the anti-patterns.md section.
 *
 * Origin: WS-035 (SPR-051) — Gate 5 starter safety net. Authored before
 * Gate 5 commerce surfaces ship so the safety net catches doctrine drift
 * the moment paywall/billing/pricing/trial/upgrade-prompt code lands.
 *
 * Run: node scripts/check-commerce-copy.cjs
 * Exit code: 0 = clean, 1 = violation
 *
 * Adding a new forbidden pattern: when a new MPMF-AP-NN refusal is
 * authored in anti-patterns.md, add a corresponding entry to FORBIDDEN
 * below. Keep the order matching the markdown to ease cross-reference.
 *
 * Out of scope (deferred to v2):
 *   - Structural patterns (CSS animations, autofocus, scrollIntoView,
 *     bg-red-* on user-choice components, ≤2-tap depth, etc.) — those
 *     require AST parsing or DOM-asserting tests, not regex matching.
 *     v1 catches the string-pattern subset; structural refusals stay
 *     enforced via per-surface specs + Gate 5 red-line test suite
 *     (WS-034) when those surfaces ship.
 *   - Context-dependent matches (e.g., "maintain your" in commerce
 *     context vs. non-commerce) — narrow scope path filter is the
 *     allowlist; if SCOPE_PATHS only points at commerce code, all
 *     matches inside are by definition in commerce context.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

// ─── Scope ────────────────────────────────────────────────────────────────
//
// Where Gate 5 commerce code WILL live. Today most of these don't exist;
// the script trivially passes. When surfaces ship, the script automatically
// gates them.

const SCOPE_PATHS = [
  'src/utils/entitlement',
  'src/components/views/SettingsView',
  'src/components/views/PricingView',
];

// Component-name patterns (filename glob — bare regex on basename) that
// indicate commerce-surface code regardless of directory.
const SCOPE_COMPONENT_PATTERNS = [
  /^Paywall(Modal|Gate|FallbackInline)\.jsx?$/i,
  /^BillingSettings.*\.jsx?$/i,
  /^PricingPage.*\.jsx?$/i,
  /^TrialStateIndicator.*\.jsx?$/i,
  /^UpgradePrompt.*\.jsx?$/i,
  /^paywallCopy\.cjs$|^paywallCopy\.js$/,
  /^billingCopy\.cjs$|^billingCopy\.js$/,
  /^pricingCopy\.cjs$|^pricingCopy\.js$/,
  /^upgradePromptCopy\.cjs$|^upgradePromptCopy\.js$/,
  /^indicatorCopy\.cjs$|^indicatorCopy\.js$/,
  /^cancellationCopy\.cjs$|^cancellationCopy\.js$/,
  /^planChangeCopy\.cjs$|^planChangeCopy\.js$/,
];

const SCOPE_FILE_EXTENSIONS = ['.js', '.jsx', '.cjs', '.ts', '.tsx'];

// Components/utils to exclude even within scope (test files excluded by
// default; this is for explicit allowlist exceptions).
const EXCLUDE_BASENAMES = [
  // Test fixtures may legitimately quote forbidden strings to assert
  // they're rejected. Add specific test files here as they're authored.
];
const EXCLUDE_DIR_NAMES = ['__tests__', '__snapshots__', 'node_modules'];

// ─── Forbidden patterns ───────────────────────────────────────────────────
//
// Mirror of anti-patterns.md forbidden-string lists. Each entry:
//   ap_id:   MPMF-AP-NN refusal ID
//   kind:    'literal' (case-insensitive substring) or 'regex'
//   pattern: the string or regex to match
//   why:     short rationale shown on violation
//
// Order follows anti-patterns.md source order. Structural-only refusals
// (no string pattern) are listed as comments for cross-reference.

const FORBIDDEN = [
  // ─── Batch 1 (Session 3b) — MPMF-AP-01..AP-12 ──────────────────────────
  { ap_id: 'MPMF-AP-01', kind: 'literal', pattern: 'hurry',          why: 'Timer-urgency banner — manufactured scarcity violates red line #5' },
  { ap_id: 'MPMF-AP-01', kind: 'literal', pattern: 'last chance',    why: 'Timer-urgency banner — red line #5' },
  { ap_id: 'MPMF-AP-01', kind: 'literal', pattern: 'ends soon',      why: 'Timer-urgency banner — red line #5' },
  { ap_id: 'MPMF-AP-01', kind: 'literal', pattern: "don't wait",     why: 'Timer-urgency banner — red line #5' },
  { ap_id: 'MPMF-AP-01', kind: 'literal', pattern: 'time is running out', why: 'Timer-urgency banner — red line #5' },

  { ap_id: 'MPMF-AP-02', kind: 'regex',   pattern: /\d+[,.]?\d*\s+(pros|players|grinders|users)\s+(use|join|trust|love)/i, why: 'Social-proof inflated count — red line #7' },
  { ap_id: 'MPMF-AP-02', kind: 'literal', pattern: 'most popular',   why: 'Social-proof / editorial steering — red line #7' },
  { ap_id: 'MPMF-AP-02', kind: 'literal', pattern: '#1 choice',      why: 'Social-proof claim — red line #7' },

  { ap_id: 'MPMF-AP-03', kind: 'literal', pattern: 'streak',         why: 'Streak / engagement-pressure mechanic — red line #5' },
  { ap_id: 'MPMF-AP-03', kind: 'literal', pattern: 'keep it up',     why: 'Streak-style copy — red line #5' },
  { ap_id: 'MPMF-AP-03', kind: 'literal', pattern: "don't break",    why: 'Streak-pressure copy — red line #5' },

  { ap_id: 'MPMF-AP-04', kind: 'literal', pattern: 'we miss you',    why: 'Re-engagement push — red line #5/#7' },
  { ap_id: 'MPMF-AP-04', kind: 'literal', pattern: 'come back',      why: 'Re-engagement push (review context) — red line #5' },
  { ap_id: 'MPMF-AP-04', kind: 'literal', pattern: "haven't used",   why: 'Re-engagement framing — red line #5' },
  { ap_id: 'MPMF-AP-04', kind: 'literal', pattern: 'we noticed',     why: 'Re-engagement framing — also AP-29 surveillance disclosure' },
  { ap_id: 'MPMF-AP-04', kind: 'literal', pattern: 'last seen',      why: 'Re-engagement notification — red line #5' },

  // AP-05 (cancellation retention traps) — structural refusal; no string
  // patterns. Enforced via per-surface tests (cancellation journey J3).

  { ap_id: 'MPMF-AP-06', kind: 'literal', pattern: 'downgrade',      why: 'Cancellation/plan-change "downgrade" framing — red line #7' },
  { ap_id: 'MPMF-AP-06', kind: 'literal', pattern: 'step down',      why: 'Status-ladder framing on plan change — red line #7' },
  { ap_id: 'MPMF-AP-06', kind: 'literal', pattern: 'reduce your',    why: 'Loss-framing on plan change — red line #7' },
  { ap_id: 'MPMF-AP-06', kind: 'literal', pattern: 'lose access',    why: 'Loss-framing on plan change — red line #7 (review context)' },

  { ap_id: 'MPMF-AP-07', kind: 'literal', pattern: "don't miss",     why: 'Loss-framing — red line #7' },
  { ap_id: 'MPMF-AP-07', kind: 'literal', pattern: 'unlock your',    why: 'Aspirational loss-framing — red line #7' },
  { ap_id: 'MPMF-AP-07', kind: 'literal', pattern: 'next level',     why: 'Aspirational pressure — red line #7' },
  { ap_id: 'MPMF-AP-07', kind: 'literal', pattern: 'take your',      why: 'Aspirational pressure — red line #7 (review context)' },

  // AP-08 (dark-pattern checkout) — structural; pre-checked boxes,
  // hidden fees. Enforced via checkout-flow tests when Gate 5 ships.

  { ap_id: 'MPMF-AP-09', kind: 'literal', pattern: 'limited time',   why: 'Fake scarcity — red line #5' },
  { ap_id: 'MPMF-AP-09', kind: 'literal', pattern: 'flash sale',     why: 'Fake scarcity — red line #5' },
  { ap_id: 'MPMF-AP-09', kind: 'literal', pattern: 'today only',     why: 'Fake scarcity — red line #5' },
  { ap_id: 'MPMF-AP-09', kind: 'literal', pattern: 'this week only', why: 'Fake scarcity — red line #5' },
  { ap_id: 'MPMF-AP-09', kind: 'literal', pattern: 'while supplies last', why: 'Fake scarcity — red line #5' },

  // AP-10 (pre-paywall friction) — structural; forced account creation,
  // tutorial gating. Enforced by first-launch flow tests.

  // AP-11 (silent auto-renewal) — structural; renewal-date visibility +
  // 3-day notice. Enforced by BillingSettings tests.

  // AP-12 (paywall mid-hand) — structural; H-SC01 defer-to-hand-end.
  // Enforced by PaywallGate.test.jsx + integration tests.

  // ─── Batch 2 — MPMF-AP-13, AP-14 ──────────────────────────────────────
  // AP-13 (telemetry-consent nag) — structural; first-launch panel
  // re-fire prevention. Enforced via consent-panel mount tests.

  // AP-14 (onboarding lock-in) — structural; Skip equal weight, no
  // progress-bar pressure. Enforced via onboarding-flow tests.

  // ─── Batch 3 — MPMF-AP-15, AP-16 ──────────────────────────────────────
  // AP-15 (silent plan-change on cancellation) — structural; pre-selection
  // refusal. Enforced via cancellation-modal tests.

  // AP-16 (deceptive proration) — structural; line-item disclosure rule.
  // Enforced via plan-change-modal tests.

  // ─── Batch 4 (SPR-050, 2026-05-08) — MPMF-AP-17..AP-29 ─────────────────
  { ap_id: 'MPMF-AP-17', kind: 'literal', pattern: 'maybe later',         why: '"Maybe later" pressure-button on commerce dismissals — red line #5/#7' },
  { ap_id: 'MPMF-AP-17', kind: 'literal', pattern: 'not now',             why: '"Not now" implies deferred yes — red line #5/#7' },
  { ap_id: 'MPMF-AP-17', kind: 'literal', pattern: 'remind me',           why: '"Remind me" implies obligation to revisit — red line #5' },
  { ap_id: 'MPMF-AP-17', kind: 'literal', pattern: "i'll think",          why: 'Pressure-button implying postponed yes — red line #5/#7' },
  { ap_id: 'MPMF-AP-17', kind: 'literal', pattern: 'come back to this',   why: '"Come back to this" implies deferred yes — red line #5' },
  { ap_id: 'MPMF-AP-17', kind: 'literal', pattern: 'think it over',       why: 'Pressure-button implying postponed yes — red line #5/#7' },
  { ap_id: 'MPMF-AP-17', kind: 'literal', pattern: 'decide later',        why: '"Decide later" implies deferred yes — red line #5/#7' },

  // AP-18 (pre-focused/pre-selected primary CTA) — structural; autofocus,
  // tab order. Enforced via PaywallModal.test.jsx CSS measurement.

  { ap_id: 'MPMF-AP-19', kind: 'literal', pattern: 'best value',          why: 'Editorial choice-steering badge on tier card — red line #5/#7' },
  { ap_id: 'MPMF-AP-19', kind: 'literal', pattern: 'top pick',            why: 'Editorial choice-steering badge — red line #7' },
  { ap_id: 'MPMF-AP-19', kind: 'literal', pattern: "editor's choice",     why: 'Editorial choice-steering badge — red line #7' },
  { ap_id: 'MPMF-AP-19', kind: 'literal', pattern: 'recommended',         why: 'Editorial steering badge near tier names — red line #7 (review context)' },

  { ap_id: 'MPMF-AP-20', kind: 'regex',   pattern: /vs\s+(gto\s+wizard|piosolver|pokertracker|holdem\s+manager)/i, why: 'Competitive disparagement — red line #7 + Q7-pending' },
  { ap_id: 'MPMF-AP-20', kind: 'literal', pattern: 'why we beat',         why: 'Competitive disparagement — red line #7' },

  // AP-21 (anti-patterns as A/B-test variants) — meta-refusal; not a
  // string pattern. Enforced via experiment-config audit (manual + future
  // growthbook config validator).

  { ap_id: 'MPMF-AP-22', kind: 'literal', pattern: 'price went up',       why: 'Runtime price modification copy — red line #2/#3/#4' },
  { ap_id: 'MPMF-AP-22', kind: 'literal', pattern: 'new price',           why: 'Runtime price modification copy — red line #2 (review context)' },
  { ap_id: 'MPMF-AP-22', kind: 'literal', pattern: 'price update',        why: 'Runtime price modification copy — red line #2' },
  { ap_id: 'MPMF-AP-22', kind: 'literal', pattern: 'pricing changed',     why: 'Runtime price modification copy — red line #2' },

  // AP-23 (animation-as-pressure) — structural; CSS animations / keyframes
  // / bounce / scale on commerce. Enforced via visual-regression tests +
  // CSS audit (deferred).

  // AP-24 (color-as-shame) — structural; bg-red-* / text-red-* / border-
  // red-* on user-choice components. Enforced via component CSS tests
  // (deferred).

  // AP-25 (spatial/viewport coercion) — structural; scrollIntoView,
  // coachmarks, sticky banners. Enforced via component behavior tests
  // (deferred).

  { ap_id: 'MPMF-AP-26', kind: 'literal', pattern: 'are you sure',        why: 'Confirm-dismissal sub-prompt on commerce dismissal — red line #5/#7' },
  { ap_id: 'MPMF-AP-26', kind: 'literal', pattern: 'think again',         why: 'Dismissal questioning copy — red line #5/#7' },
  { ap_id: 'MPMF-AP-26', kind: 'literal', pattern: 'reconsider',          why: 'Dismissal questioning copy — red line #5/#7' },
  { ap_id: 'MPMF-AP-26', kind: 'literal', pattern: 'sure you want to',    why: 'Dismissal questioning copy — red line #5/#7' },
  { ap_id: 'MPMF-AP-26', kind: 'literal', pattern: 'before you go',       why: 'Exit-intent dismissal hook — red line #5' },

  // AP-27 (hard-to-find Cancel) — structural; ≤2-tap rule + equal-weight.
  // Enforced via BillingSettings.e2e.test.jsx tap-count assertion.

  { ap_id: 'MPMF-AP-28', kind: 'literal', pattern: 'thanks for upgrading', why: 'Post-conversion celebration banner — red line #5/#7' },
  { ap_id: 'MPMF-AP-28', kind: 'literal', pattern: 'welcome to plus',      why: 'Post-conversion celebration — red line #5/#7' },
  { ap_id: 'MPMF-AP-28', kind: 'literal', pattern: 'welcome to pro',       why: 'Post-conversion celebration — red line #5/#7' },
  { ap_id: 'MPMF-AP-28', kind: 'literal', pattern: 'congrats',             why: 'Post-conversion celebration framing — red line #5/#7' },
  { ap_id: 'MPMF-AP-28', kind: 'literal', pattern: 'tell your friends',    why: 'Share-prompt in conversion afterglow — red line #5/#7' },
  { ap_id: 'MPMF-AP-28', kind: 'literal', pattern: 'high five',            why: 'Celebratory post-conversion copy — red line #5/#7' },

  { ap_id: 'MPMF-AP-29', kind: 'literal', pattern: 'we see you',           why: 'Surveillance disclosure in tailoring copy — red line #1/#9' },
  { ap_id: 'MPMF-AP-29', kind: 'literal', pattern: 'based on your',        why: 'Surveillance disclosure — red line #1/#9' },
  { ap_id: 'MPMF-AP-29', kind: 'literal', pattern: "since you've",         why: 'Surveillance disclosure — red line #1/#9' },
  { ap_id: 'MPMF-AP-29', kind: 'literal', pattern: 'your usage',           why: 'Surveillance disclosure — red line #1/#9 (review context)' },
  { ap_id: 'MPMF-AP-29', kind: 'literal', pattern: 'we observed',          why: 'Surveillance disclosure — red line #1/#9' },
  { ap_id: 'MPMF-AP-29', kind: 'literal', pattern: 'we know you',          why: 'Surveillance disclosure — red line #1/#9' },
];

// ─── Discovery ────────────────────────────────────────────────────────────

function isExcludedDir(dirName) {
  return EXCLUDE_DIR_NAMES.includes(dirName);
}

function isExcludedFile(basename) {
  return EXCLUDE_BASENAMES.includes(basename);
}

function hasScopedExtension(filename) {
  return SCOPE_FILE_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

function matchesComponentScope(basename) {
  return SCOPE_COMPONENT_PATTERNS.some((re) => re.test(basename));
}

function walkDir(absDir, hits) {
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return hits;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (isExcludedDir(entry.name)) continue;
      walkDir(path.join(absDir, entry.name), hits);
    } else if (entry.isFile()) {
      if (isExcludedFile(entry.name)) continue;
      if (!hasScopedExtension(entry.name)) continue;
      hits.push(path.join(absDir, entry.name));
    }
  }
  return hits;
}

function walkComponentScope(rootRelative, hits) {
  // Walk src/ recursively, but only include files whose basename matches
  // SCOPE_COMPONENT_PATTERNS — even if they live in a directory that
  // isn't in SCOPE_PATHS.
  const absRoot = path.join(REPO_ROOT, rootRelative);
  let entries;
  try {
    entries = fs.readdirSync(absRoot, { withFileTypes: true });
  } catch {
    return hits;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (isExcludedDir(entry.name)) continue;
      walkComponentScope(path.join(rootRelative, entry.name), hits);
    } else if (entry.isFile()) {
      if (isExcludedFile(entry.name)) continue;
      if (!hasScopedExtension(entry.name)) continue;
      if (!matchesComponentScope(entry.name)) continue;
      hits.push(path.join(REPO_ROOT, rootRelative, entry.name));
    }
  }
  return hits;
}

function discoverFiles() {
  const files = new Set();
  for (const rel of SCOPE_PATHS) {
    const abs = path.join(REPO_ROOT, rel);
    walkDir(abs, []).forEach((f) => files.add(f));
  }
  walkComponentScope('src', []).forEach((f) => files.add(f));
  return [...files].sort();
}

// ─── Scan ─────────────────────────────────────────────────────────────────

function scanLine(line, lineNumber, file, violations) {
  const lower = line.toLowerCase();
  for (const entry of FORBIDDEN) {
    if (entry.kind === 'literal') {
      const idx = lower.indexOf(entry.pattern.toLowerCase());
      if (idx !== -1) {
        violations.push({
          file,
          line: lineNumber,
          column: idx + 1,
          ap_id: entry.ap_id,
          matched: line.slice(idx, idx + entry.pattern.length),
          why: entry.why,
        });
      }
    } else if (entry.kind === 'regex') {
      const m = entry.pattern.exec(line);
      if (m) {
        violations.push({
          file,
          line: lineNumber,
          column: m.index + 1,
          ap_id: entry.ap_id,
          matched: m[0],
          why: entry.why,
        });
      }
    }
  }
}

function scanFile(absPath, violations) {
  const content = fs.readFileSync(absPath, 'utf8');
  const lines = content.split('\n');
  const rel = path.relative(REPO_ROOT, absPath).replace(/\\/g, '/');
  for (let i = 0; i < lines.length; i++) {
    scanLine(lines[i], i + 1, rel, violations);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main() {
  const files = discoverFiles();
  const violations = [];
  for (const f of files) {
    scanFile(f, violations);
  }

  if (violations.length > 0) {
    console.log('❌ COMMERCE COPY DOCTRINE VIOLATION');
    console.log('');
    for (const v of violations) {
      console.log(`  ${v.file}:${v.line}:${v.column}`);
      console.log(`    refusal: ${v.ap_id}`);
      console.log(`    matched: ${JSON.stringify(v.matched)}`);
      console.log(`    why: ${v.why}`);
      console.log('');
    }
    console.log('Per docs/projects/monetization-and-pmf/anti-patterns.md,');
    console.log('every match above is a structural refusal under Q1=A verdict.');
    console.log('Either remove the pattern, route copy through the doctrine-');
    console.log('compliant generator (paywallCopy.js / billingCopy.js / etc.),');
    console.log('or — if this is a legitimate non-commerce use — add the path');
    console.log('to EXCLUDE_BASENAMES with a comment explaining why.');
    console.log('');
    console.log(`Total violations: ${violations.length}`);
    process.exit(1);
  }

  console.log('✅ Commerce copy check: OK');
  console.log(`   Scoped files scanned: ${files.length}`);
  console.log(`   Forbidden patterns checked: ${FORBIDDEN.length}`);
  console.log(`   (Structural refusals — animation, autofocus, scrollIntoView,`);
  console.log(`    bg-red-*, ≤2-tap depth — enforced via per-surface tests`);
  console.log(`    in WS-034 when Gate 5 commerce surfaces ship.)`);
}

main();
