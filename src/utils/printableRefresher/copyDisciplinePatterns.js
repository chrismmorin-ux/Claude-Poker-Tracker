/**
 * copyDisciplinePatterns.js — Check 3 enforcement (CD-1..CD-5).
 *
 * Mirrors `docs/projects/printable-refresher/copy-discipline.md` §CI-lint.
 * Per spec amendment rule: adding or removing a forbidden-string pattern
 * here requires the same persona-level review as amending copy-discipline.md
 * itself. Do not relax patterns to make a card pass — fix the card prose.
 *
 * Five rule families:
 *   CD-1 imperative tone — "you must" / "always|never|don't|do not" + action verb
 *   CD-2 self-evaluation — "grade your" / "score your" / "did you" etc.
 *   CD-3 engagement — "mastered" / "level up" / "your \d+%" / "limited time" etc.
 *   CD-4 labels-as-inputs — "vs Fish ... iso", with POKER_THEORY-citation-within-200
 *                           character whitelist bypass for glossary contexts.
 *   CD-5 unqualified assumptions — bodyMarkdown must declare stakes AND stack OR
 *                                  carry cd5_exempt: true with a non-empty justification.
 *
 * Spec: docs/projects/printable-refresher/content-drift-ci.md §Check 3
 *       docs/projects/printable-refresher/copy-discipline.md §CI-lint
 */

// CD-1 — imperative tone
export const CD1_PATTERNS = [
  { id: 'CD-1a', regex: /\byou must\b/i, label: 'imperative "you must"' },
  { id: 'CD-1b', regex: /\balways\b.{0,50}(fold|iso|check|bet|bluff|call|raise|3-?bet|4-?bet|cbet|barrel)/i, label: 'imperative "always" + action verb' },
  { id: 'CD-1c', regex: /\bnever\b.{0,50}(bluff|call|bet|fold|raise|iso|cbet|barrel)/i, label: 'imperative "never" + action verb' },
  { id: 'CD-1d', regex: /\bdo not\b.{0,50}(fold|call|bet|bluff|raise|iso|cbet|barrel)/i, label: 'imperative "do not" + action verb' },
  { id: 'CD-1e', regex: /\bdon't\b.{0,50}(fold|call|bet|bluff|raise|iso|cbet|barrel)/i, label: 'imperative "don\'t" + action verb' },
];

// CD-2 — self-evaluation framing
export const CD2_PATTERNS = [
  { id: 'CD-2a', regex: /\bgrade your\b/i, label: 'self-evaluation "grade your"' },
  { id: 'CD-2b', regex: /\bscore your\b/i, label: 'self-evaluation "score your"' },
  { id: 'CD-2c', regex: /\bcheck your answer\b/i, label: 'self-evaluation "check your answer"' },
  { id: 'CD-2d', regex: /\bhow did you\b/i, label: 'self-evaluation "how did you"' },
  { id: 'CD-2e', regex: /\btest yourself\b/i, label: 'self-evaluation "test yourself"' },
  { id: 'CD-2f', regex: /\b(was|did) your read\b/i, label: 'self-evaluation "was/did your read"' },
];

// CD-3 — engagement / urgency / social-proof copy
export const CD3_PATTERNS = [
  { id: 'CD-3a', regex: /\bmastered\b/i, label: 'engagement "mastered"' },
  { id: 'CD-3b', regex: /\bcards remaining\b/i, label: 'engagement "cards remaining"' },
  { id: 'CD-3c', regex: /\bstreak\b/i, label: 'engagement "streak"' },
  { id: 'CD-3d', regex: /\bkeep it up\b/i, label: 'engagement "keep it up"' },
  { id: 'CD-3e', regex: /\bgreat job\b/i, label: 'engagement "great job"' },
  { id: 'CD-3f', regex: /\blevel up\b/i, label: 'engagement "level up"' },
  { id: 'CD-3g', regex: /\bunlock\b/i, label: 'engagement "unlock"' },
  { id: 'CD-3h', regex: /\blast chance\b/i, label: 'urgency "last chance"' },
  { id: 'CD-3i', regex: /\blimited time\b/i, label: 'urgency "limited time"' },
  { id: 'CD-3j', regex: /\bre-?print soon\b/i, label: 'urgency "re-print soon"' },
  { id: 'CD-3k', regex: /\busers like you\b/i, label: 'social-proof "users like you"' },
  { id: 'CD-3l', regex: /\bmost popular\b/i, label: 'social-proof "most popular"' },
  { id: 'CD-3m', regex: /\btrending\b/i, label: 'social-proof "trending"' },
  { id: 'CD-3n', regex: /your \d+%/i, label: 'engagement "your N%"' },
];

// CD-4 — labels-as-inputs (with POKER_THEORY-citation-within-200 chars whitelist exception)
export const CD4_PATTERN = {
  id: 'CD-4',
  regex: /(vs|against|versus)\s+(fish|nit|lag|tag|station|maniac|whale).{0,80}(iso|bet|bluff|fold|raise|call|3-?bet|4-?bet|cbet|barrel|tighten|loosen)/gi,
  label: 'labels-as-inputs (vs Fish/Nit/LAG/TAG/etc. + directive)',
};
export const CD4_WHITELIST_RADIUS = 200;
export const CD4_WHITELIST_NEEDLE = /POKER_THEORY/i;

// CD-5 — unqualified assumptions (bodyMarkdown-only check)
export const CD5_STAKES_REGEX = /(\$[\d.]+\/\$[\d.]+|tournament|rake-agnostic)/i;
export const CD5_STACK_REGEX = /(\d+bb|\d+BB|effective)/;

/**
 * Validate the manifest's prose against CD-1..CD-5.
 *
 * Per spec §Check 3 mechanism, the prose to scan is `title + bodyMarkdown +
 * derived lineage footer`. CD-5 is the exception — it's a structural check
 * on `bodyMarkdown` only (the "1.5-second laminate glance" rule from CD-5
 * test-pattern: cover the lineage footer with a finger; the body must still
 * declare stakes + rake + stack + field).
 *
 * @param {object} manifest
 * @param {string} renderedFooter — printFooter(derive7FieldLineage(manifest, runtime))
 *                                   passed in by the caller so we don't have to
 *                                   re-derive it here.
 * @returns {{ valid: boolean, violations: { rule: string, label: string, excerpt: string }[] }}
 */
export function validateCopyDiscipline(manifest, renderedFooter = '') {
  const violations = [];
  const title = String(manifest.title || '');
  const body = String(manifest.bodyMarkdown || '');
  const prose = [title, body, renderedFooter].join('\n');

  // CD-1 / CD-2 / CD-3 — straightforward regex scan against full prose
  const flat = [...CD1_PATTERNS, ...CD2_PATTERNS, ...CD3_PATTERNS];
  for (const { id, regex, label } of flat) {
    const m = prose.match(regex);
    if (m) {
      violations.push({
        rule: id,
        label,
        excerpt: excerptAround(prose, m.index, m[0].length),
      });
    }
  }

  // CD-4 — labels-as-inputs with POKER_THEORY-within-200 whitelist exception
  const cd4Matches = [...prose.matchAll(CD4_PATTERN.regex)];
  for (const m of cd4Matches) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const windowStart = Math.max(0, start - CD4_WHITELIST_RADIUS);
    const windowEnd = Math.min(prose.length, end + CD4_WHITELIST_RADIUS);
    const window = prose.slice(windowStart, windowEnd);
    if (!CD4_WHITELIST_NEEDLE.test(window)) {
      violations.push({
        rule: CD4_PATTERN.id,
        label: CD4_PATTERN.label,
        excerpt: excerptAround(prose, start, m[0].length),
      });
    }
  }

  // CD-5 — bodyMarkdown must declare stakes AND stack (bypass: cd5_exempt + non-empty justification)
  const exempt = manifest.cd5_exempt === true && typeof manifest.cd5_exempt_justification === 'string' && manifest.cd5_exempt_justification.trim().length > 0;
  if (!exempt) {
    if (!CD5_STAKES_REGEX.test(body)) {
      violations.push({
        rule: 'CD-5-stakes',
        label: 'unqualified-assumptions: bodyMarkdown does not declare stakes (e.g., "$2/$5", "tournament", or "rake-agnostic")',
        excerpt: body.slice(0, 200),
      });
    }
    if (!CD5_STACK_REGEX.test(body)) {
      violations.push({
        rule: 'CD-5-stack',
        label: 'unqualified-assumptions: bodyMarkdown does not declare stack depth (e.g., "100bb", "200BB", or contains "effective")',
        excerpt: body.slice(0, 200),
      });
    }
  }

  return { valid: violations.length === 0, violations };
}

function excerptAround(text, index, matchLength, padding = 30) {
  const start = Math.max(0, index - padding);
  const end = Math.min(text.length, index + matchLength + padding);
  const before = start > 0 ? '…' : '';
  const after = end < text.length ? '…' : '';
  return `${before}${text.slice(start, end)}${after}`;
}
