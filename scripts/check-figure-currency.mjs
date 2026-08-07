#!/usr/bin/env node
/**
 * check-figure-currency.mjs — WS-437. Percentage figures in doc HEADINGS must carry their
 * currency.
 *
 * THE MECHANISM THIS EXISTS TO STOP. POKER_THEORY §11.9 headlined "A Fifteen-Number Rule
 * Recovers ~56% of the Engine" — a Delta-log diagnostic reading as a performance/EV claim —
 * with the caveat living in a DIFFERENT document (SCORED-READOUT-SPEC §8.2). A figure whose
 * currency lives elsewhere gets quoted without it. So: any markdown heading in
 * `.claude/context/` or `docs/` that contains a percentage figure must state its currency
 * either in the heading itself or within the next few lines.
 *
 * WHAT COUNTS AS A CURRENCY ANNOTATION. A marker naming the axis the number lives on
 * (Delta-log / Δlog, bb/100, Brier, log-loss, nats), an explicit disclaimer ("not an EV
 * claim", "diagnostic, not a result", "transferred, not measured"), or a Result Card
 * reference — the ADR-009 object whose estimand IS the currency statement.
 *
 * ADVISORY BY DEFAULT (exit 0 with warnings): no existing enforcement convention covers
 * prose docs — `check-sor-additive.sh` and friends gate specific tracked files, and the SoR
 * repo-wide invariant is itself staged advisory until WS-329. Pass --strict to exit 1 on
 * unallowlisted findings once the backlog is burned down.
 *
 * Usage:
 *   node scripts/check-figure-currency.mjs [--strict] [--root <repo-root>]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/** A heading line: markdown ATX heading of any depth. */
export const HEADING_RE = /^#{1,6}\s/;

/** A percentage figure: 56%, ~56%, 57.3 %, etc. */
export const FIGURE_RE = /~?\d+(?:\.\d+)?\s?%/;

/**
 * Markers that state a figure's currency. Deliberately a NAMED-AXIS list, not a fuzzy one —
 * a marker that matches everything would turn the check into a green tick that hides the
 * failure it was built to catch.
 */
export const CURRENCY_MARKERS = [
  /delta-?\s?log/i,
  /Δ\s?log/i,
  /deltaLog/,
  /bb\s?\/\s?100/i,
  /not an ev claim/i,
  /diagnostic, not a result/i,
  /\bdiagnostic\b/i,
  /transferred, not measured/i,
  /brier/i,
  /log[- ]loss/i,
  /\bnats?\b/i,
  /result card/i,
  /win\s?rate/i,
  // Named axes: a heading that says WHAT is at N% has stated its currency.
  /\baccuracy\b/i,
  /\blift\b/i,
];

/** Lines after the heading (inclusive of the heading itself) searched for an annotation. */
export const WINDOW = 6;

/**
 * Figures that predate this check and are annotated by their surrounding document rather
 * than within the WINDOW, or that are historical records (an audit trail is not a claim
 * surface). Matched by (file substring, heading substring). Additions need a reason.
 */
export const ALLOWLIST = [
  // Historical changelog entries — version history, not a quotable claim surface.
  { file: 'docs/CHANGELOG.md', heading: '', reason: 'version history, not a claim surface' },
  // Dated design/audit/roundtable records — minutes of a past decision, not live claims.
  { file: 'docs/design/audits/', heading: '', reason: 'dated audit record' },
  { file: 'docs/design/roundtables/', heading: '', reason: 'dated roundtable record' },
  // Upper-surface reasoning artifacts and comparisons: headings are IN-HAND frequencies,
  // equities and sizings ("hero equity ~30%", "bet 50%"), inside a framework whose every
  // claim already carries a verdict and a falsifier. Not repo performance claims.
  { file: 'docs/upper-surface/', heading: '', reason: 'in-hand frequencies/equities inside the artifact claim-verdict framework' },
  // Dated research records, pre-SoR. Comparative claims from these route to Result Cards
  // under ADR-009; the documents themselves are the historical record of a run.
  { file: 'docs/research/', heading: '', reason: 'dated research record (pre-SoR); live claims route to Result Cards' },
  { file: 'docs/archive/', heading: '', reason: 'archived project record' },
  // A definition of the compliance scale itself, not a figure on it.
  { file: 'docs/design/ROADMAP.md', heading: '100% compliance', reason: 'defines the scale' },
  // A layout constraint (chrome budget as viewport share), not a measured figure.
  { file: 'docs/design/surfaces/table-build.md', heading: 'Layout chrome', reason: 'design constraint, not a measurement' },
];

/**
 * Scan one markdown document. Returns findings: heading lines carrying a percentage figure
 * with no currency annotation in the heading or the following WINDOW lines, and no
 * allowlist entry.
 */
export const scanText = (text, file = '') => {
  const lines = String(text).split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!HEADING_RE.test(line) || !FIGURE_RE.test(line)) continue;
    const window = lines.slice(i, i + WINDOW).join('\n');
    if (CURRENCY_MARKERS.some((m) => m.test(window))) continue;
    if (ALLOWLIST.some((a) => file.includes(a.file) && line.includes(a.heading))) continue;
    findings.push({ file, line: i + 1, heading: line.trim() });
  }
  return findings;
};

const walkMarkdown = (dir, acc = []) => {
  let entries;
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const name of entries) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walkMarkdown(p, acc);
    else if (name.endsWith('.md')) acc.push(p);
  }
  return acc;
};

/** Scan the repo's claim-bearing doc trees: `.claude/context/*.md` and `docs/**\/*.md`. */
export const scanRepo = (root = process.cwd()) => {
  const files = [
    ...walkMarkdown(join(root, '.claude', 'context')),
    ...walkMarkdown(join(root, 'docs')),
  ];
  const findings = [];
  for (const f of files) {
    const rel = relative(root, f).split(sep).join('/');
    findings.push(...scanText(readFileSync(f, 'utf8'), rel));
  }
  return { files: files.length, findings };
};

const main = () => {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const rootIdx = argv.indexOf('--root');
  const root = rootIdx !== -1 ? argv[rootIdx + 1] : process.cwd();

  const { files, findings } = scanRepo(root);
  if (findings.length === 0) {
    console.log(`check-figure-currency: OK — ${files} markdown files, every percentage-bearing heading carries its currency.`);
    return 0;
  }
  console.log(`check-figure-currency: ${findings.length} heading(s) carry a percentage figure with no currency annotation within ${WINDOW} lines (${files} files scanned):\n`);
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}  ${f.heading}`);
  }
  console.log(
    '\nA figure that reads as a performance claim must say what axis it lives on — inline, '
    + 'where the reader hits it, not in another document (WS-437; SCORED-READOUT-SPEC §8.2). '
    + 'Annotate with e.g. "(Delta-log against revealed hole cards — not an EV claim)", '
    + '"(bb/100)", or a Result Card reference — or add an ALLOWLIST entry with a reason.',
  );
  if (strict) return 1;
  console.log('\nAdvisory mode: exiting 0. Pass --strict to fail on findings.');
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
