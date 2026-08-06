#!/usr/bin/env node
/**
 * enforcement-classes.cjs — the S9 catalogue.
 *
 * THE THREE-CLAUSE RULE (WS-424 / S9). Each arm of the comparison supplied one clause
 * and each was individually incomplete:
 *
 *   1. BLOCK an irreversible act.
 *   2. FAIL  a check that has no legitimate exception.
 *   3. WARN  a check whose failure may be evidence about the DECLARATION rather than
 *            about the item.
 *
 * Clause 1 alone gets the size ceiling wrong: a ceiling is a declaration, so clause 1
 * says warn — but "a light tier over its ceiling is not evidence about the ceiling, it
 * is a light tier that has stopped working," which is clause 2. Clause 3 alone would
 * make everything advisory, and a control that is always advisory is optimised into a
 * rubber stamp. The rule is the union.
 *
 * EVERY CHECK DECLARES ITS CLASS AND THE ARGUMENT FOR IT. A check whose class cannot be
 * argued from the rule is not a mis-set flag — it is A FINDING ABOUT THE RULE, and
 * `scripts/__tests__/enforcementClasses.test.js` treats it as one.
 *
 * Run `node scripts/context/enforcement-classes.cjs` to print the catalogue.
 */

'use strict';

const CLASSES = {
  BLOCK: 'block',   // clause 1 — irreversible
  FAIL: 'fail',     // clause 2 — no legitimate exception
  WARN: 'warn',     // clause 3 — may be evidence about the declaration
};

const CATALOGUE = [
  // ── clause 1: irreversible acts ──────────────────────────────────────────
  {
    check: 'context-barrier: withheld read',
    where: '.claude/hooks/context-barrier.cjs',
    class: CLASSES.BLOCK,
    clause: 1,
    why: 'Reading is irreversible. A warning about a read is a report about a harm that has already completed — by the time it exists the tokens are in the window and there is no state to restore.',
  },
  {
    check: 'git-guard: force push / hard reset on main',
    where: '.claude/hooks/git-guard.cjs',
    class: CLASSES.BLOCK,
    clause: 1,
    why: 'Rewriting published history is irreversible for everyone who has already pulled it, and no warning issued after the push can restore the commits it discarded.',
  },
  {
    check: 'secrets-scan: secret about to enter history',
    where: '.claude/hooks/secrets-scan.cjs',
    class: CLASSES.BLOCK,
    clause: 1,
    why: 'A secret in git history is irreversible without a rewrite, and is compromised the moment it lands.',
  },
  {
    check: 'retreat-detector: retreat vocabulary in a response',
    where: '.claude/hooks/retreat-detector.cjs',
    class: CLASSES.BLOCK,
    clause: 1,
    why: 'Its own header records that the first instinct was to warn "so it doesn\'t get disabled — which is the very bias the hook exists to catch." A shipped retreat is acted on before anyone reviews it.',
  },

  // ── clause 2: no legitimate exception ────────────────────────────────────
  {
    check: 'compact tier: no on-disk artifact',
    where: 'scripts/__tests__/compactTier.test.js',
    class: CLASSES.FAIL,
    clause: 2,
    why: 'There is no legitimate reason to cache the compact tier to a file. Caching it is precisely the change that reintroduces the two-artifact drift the no-file design makes impossible.',
  },
  {
    check: 'compact tier: ceiling per turn',
    where: '.claude/hooks/compact-tier.cjs (producer slices its own output)',
    class: CLASSES.FAIL,
    clause: 2,
    why: 'Arm C\'s case against clause 1: a tier over its ceiling is not evidence about the ceiling, it is a tier that has stopped working. Enforced as a producer invariant, so the failing state is unreachable rather than merely reported.',
  },
  {
    check: 'compact tier: no re-measurable magnitude (S4)',
    where: '.claude/hooks/compact-tier.cjs',
    class: CLASSES.FAIL,
    clause: 2,
    why: 'Purely syntactic and undebatable. A decimal in the compact tier can be falsified by re-measuring, which is the drift the rule exists to make impossible.',
  },
  {
    check: 'S10: a falsified claim keeps its counter',
    where: 'scripts/__tests__/falsifiedCounter.test.js',
    class: CLASSES.FAIL,
    clause: 2,
    why: 'No legitimate exception: a claim known to have been falsified may not present itself with unqualified confidence. Losing the counter in a rewrite is how the first one went missing.',
  },
  {
    check: 'provenance gate: engine substitution declared',
    where: 'kit/scripts/git-hooks/pre-commit-provenance.sh',
    class: CLASSES.FAIL,
    clause: 2,
    why: 'INV-F2. A substitution is either declared with spec_compliant: false or it is rigor compression; there is no third legitimate state.',
  },

  // ── clause 3: evidence about the declaration ─────────────────────────────
  {
    check: 'bundle: content-drift / unpinned-include',
    where: 'scripts/context/cwos-context-bundle-validate.cjs',
    class: CLASSES.WARN,
    clause: 3,
    why: 'A drifted hash means a source file was edited, which is normal work. The finding is about the bundle\'s REVIEW currency, not about the item.',
  },
  {
    check: 'bundle: budget-breach / ceiling-breach',
    where: 'scripts/context/cwos-context-bundle-validate.cjs',
    class: CLASSES.WARN,
    clause: 3,
    why: 'A growing bundle is worth SEEING before it is worth stopping. The remedy is to split the bundle and name the second subject, which is a curation act, not a blocking one.',
  },
  {
    check: 'bundle: unbundled-task',
    where: 'scripts/context/cwos-context-bundle-validate.cjs',
    class: CLASSES.WARN,
    clause: 3,
    why: 'Means nobody has scoped the item YET. That is a fact about the curation process and must be able to persist in the tree without failing reconcile.',
  },
  {
    check: 'bundle: no-withholding on a discovery bundle',
    where: 'scripts/context/cwos-context-bundle-validate.cjs',
    class: CLASSES.WARN,
    clause: 3,
    why: 'May be evidence that the bundle is mis-declared as discovery rather than that the curator forgot — exactly the ambiguity clause 3 names.',
  },
  {
    check: 'S7 post-hoc: discovery finding cites a withheld source',
    where: 'scripts/context/cwos-context-bundle-validate.cjs',
    class: CLASSES.WARN,
    clause: 3,
    why: 'Cannot distinguish a genuine violation from independent re-derivation of something the withheld file also contains — and re-derivation is a GOOD outcome that should be marked replicated. Blocking would punish the replication case.',
  },
];

module.exports = { CLASSES, CATALOGUE };

if (require.main === module) {
  const pad = (s, n) => String(s).padEnd(n);
  const order = { block: 0, fail: 1, warn: 2 };
  const rows = [...CATALOGUE].sort((a, b) => order[a.class] - order[b.class]);
  let current = null;
  for (const r of rows) {
    if (r.class !== current) {
      current = r.class;
      console.log(`\n=== ${r.class.toUpperCase()} (clause ${r.clause}) ===`);
    }
    console.log(`  ${pad(r.check, 48)} ${r.where}`);
  }
  console.log(`\n${CATALOGUE.length} checks catalogued.`);
}
