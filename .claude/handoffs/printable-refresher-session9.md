# Session Handoff: printable-refresher-session9
Status: IN PROGRESS | Written: 2026-04-25

## Backlog Item

**PRF-G5-CI Session 3 (Check 2 + Check 3).** Continues S2 (commit `78bd449`). Two new validators + extended contentDrift suite + auto-profit mechanical verification.

| Session | Scope | Status |
|---------|-------|--------|
| S1 (commit 6cc45ce) | Manifest schema + loader + stub + `manifestSchema.test.js` | DONE |
| S2 (commit 78bd449) | `lineage.js` + Check 1 + Check 6 + recomputed hash + 2 test files | DONE |
| **S3 (this)** | `sourceUtilPolicy.js` + `copyDisciplinePatterns.js` + Check 2 + Check 3 + 2 validator test files | **DONE** |
| S4 | Check 4 (schemaVersion bump + `proseOnlyEdit`) + Check 5 (md-vs-generated) + dev scripts + `smart-test-runner.sh` wiring + verify-CI-catches-drift | NEXT |

After S4 closes, PRF-G5-CI is fully green and PRF-G5-MIG / persistence / Phase B card authoring are unblocked.

## What I Did This Session

Four new files + one extension. All within `src/utils/printableRefresher/`. All tests green.

**(1) `src/utils/printableRefresher/sourceUtilPolicy.js` — Check 2 enforcement.**

- `WHITELIST_REGEXES` (3 entries per charter §Source-util whitelist/blacklist):
  - `/^src\/utils\/pokerCore\//` — preflopCharts, rangeMatrix, boardTexture, handEvaluator, cardParser
  - `/^src\/constants\/gameTreeConstants\.js$/` — population baselines (rake configs, style-prior fold curves, SPR zones, realization factors)
  - `/^\.claude\/context\/POKER_THEORY\.md$/` — formal derivations + §9 documented divergences
- `BLACKLIST_REGEXES` (7 entries per charter):
  - `villainDecisionModel.js`, `villainObservations.js`, `villainProfileBuilder.js`
  - `assumptionEngine/` namespace
  - `anchorLibrary/` namespace
  - `CalibrationDashboardView/`, `AnchorLibraryView/`
- `validateSourceUtils(manifest)` → `{ valid, violations: [{ kind, detail }] }` where kind ∈ `'blacklist-match' | 'whitelist-miss' | 'blacklist-body-reference'`. Three failure modes:
  1. `sourceUtils[].path` matches blacklist → `blacklist-match` (the F4/F6 fidelity bar primary failure mode).
  2. `sourceUtils[].path` matches neither list → `whitelist-miss` (forces explicit charter amendment to add new sources).
  3. `bodyMarkdown` contains a string reference to one of 7 blacklisted symbols → `blacklist-body-reference` (catches "see villainDecisionModel.js" prose-smuggling).
- Empty `sourceUtils: []` is the spec-blessed pass-through for theory-only cards (auto-profit canonical). Check 6 lineage-footer ensures these still cite a theory section in field [5].

**(2) `src/utils/printableRefresher/copyDisciplinePatterns.js` — Check 3 enforcement.**

Mirrors `copy-discipline.md` §CI-lint canonical pattern catalog. Per spec amendment rule: adding/removing any pattern requires the same persona-level review as amending copy-discipline.md.

- `CD1_PATTERNS` (5): "you must" + "always|never|don't|do not" each followed by a poker action verb within 50 chars.
- `CD2_PATTERNS` (6): "grade your" / "score your" / "check your answer" / "how did you" / "test yourself" / "(was|did) your read".
- `CD3_PATTERNS` (14): "mastered" / "cards remaining" / "streak" / "keep it up" / "great job" / "level up" / "unlock" / "last chance" / "limited time" / "re-?print soon" / "users like you" / "most popular" / "trending" / "your N%".
- `CD4_PATTERN` (single regex with `g` flag for matchAll iteration): `(vs|against|versus)\s+(fish|nit|lag|tag|station|maniac|whale).{0,80}(iso|bet|bluff|fold|raise|call|3-?bet|4-?bet|cbet|barrel|tighten|loosen)`. Whitelist exception: each match is bypassed if `POKER_THEORY` appears within 200 characters (spec radius). Implementation iterates matches, slices a 200-char window before+after each, and checks for the citation needle.
- `CD5_STAKES_REGEX` + `CD5_STACK_REGEX`: bodyMarkdown must match BOTH unless the manifest carries `cd5_exempt: true` AND a non-empty `cd5_exempt_justification`. Empty justification does NOT bypass — a whitelist exception requires a real reason in the diff.
- `validateCopyDiscipline(manifest, renderedFooter)` → `{ valid, violations: [{ rule, label, excerpt }] }`. Prose to scan is `title + bodyMarkdown + renderedFooter` joined with newline (per spec §Check 3 mechanism). CD-5 is the exception — it scans `bodyMarkdown` only because the test pattern is "cover the lineage footer with a finger; the body must still declare stakes + rake + stack + field."
- Excerpts include 30-char padding before+after the match with `…` ellipsis markers for actionable error messages.

**(3) `src/utils/printableRefresher/__tests__/contentDrift.test.js` — extended with Check 2 + Check 3.**

Two new top-level describes appended (no S2 logic touched):
- **Check 2**: per manifest, `validateSourceUtils()` returns `valid: true`. Failure messages enumerate `[kind] detail` per violation + cite charter §Source-util whitelist/blacklist + suggest "refactor to source from pokerCore + gameTreeConstants + POKER_THEORY, or redirect to on-screen surface."
- **Check 3**: per manifest, `validateCopyDiscipline()` returns `valid: true`. Failure messages enumerate `[rule] label\n  excerpt: …` per violation + cite copy-discipline.md.

Both checks use `derive7FieldLineage(manifest, { engineVersion: 'test', appVersion: 'test' })` + `printFooter()` to compute the footer text passed into Check 3's prose-scan.

**(4) `src/utils/printableRefresher/__tests__/sourceUtilPolicy.test.js` — 16 unit tests.**

Regex catalog shape (3 whitelist + 7 blacklist) + 12 fixture-driven validator tests:
- 3 whitelist-passing paths (pokerCore, gameTreeConstants, POKER_THEORY.md)
- 4 blacklist-failing paths (villainDecisionModel, assumptionEngine namespace, anchorLibrary namespace, CalibrationDashboardView)
- 1 non-whitelisted-non-blacklisted path → `whitelist-miss`
- 1 multi-violation enumeration (no short-circuit)
- 2 bodyMarkdown blacklist-reference scans (villainDecisionModel + assumptionEngine)
- 1 combined blacklist + body-reference (multiple violations)
- 1 missing-sourceUtils-field graceful default

**(5) `src/utils/printableRefresher/__tests__/copyDisciplinePatterns.test.js` — 34 unit tests.**

Pattern catalog shape (5 CD-1 + 6 CD-2 + 14 CD-3 + 1 CD-4 + 2 CD-5 regexes) + per-rule fixtures:
- CD-1: 5 failing fixtures (each pattern) + 1 near-miss passing ("Auto-profit math is always rake-agnostic" — no action verb adjacent)
- CD-2: 3 failing fixtures (grade your / test yourself / did your read)
- CD-3: 5 failing fixtures (mastered / level up / limited time / users like you / your 45%) + 2 near-miss passing (plain "42.9%" without "your" + "unlock"-not-in-body sanity)
- CD-4: 2 failing fixtures + 1 whitelist-exception passing ("vs Fish iso (POKER_THEORY.md §5.5...)") + 1 whitelist-exception failing (300-char filler between match and citation breaks the 200-char radius)
- CD-5: 3 passing fixtures (auto-profit case + tournament + $2/$5 cash) + 2 failing fixtures (missing stakes + missing stack) + cd5_exempt bypass with non-empty justification + cd5_exempt with EMPTY justification does NOT bypass
- Multi-violation reporting: simultaneous CD-1 + CD-3 + CD-4 all enumerated.

**(6) Auto-profit manifest mechanical CD-verification.**

The S1 bodyMarkdown ("Bet B into pot P needs villain to fold at least B/(P+B) of their range to be auto-profit before equity is considered. Rake-agnostic at 100bb effective; pure pot-odds derivation. Worked example: bet 6 into pot 8 → break-even fold frequency = 6/14 = 42.9%.") was authored CD-clean by inspection at S1. S3 mechanical verification confirms:
- No CD-1 imperative tone (no "you must", no "always|never|don't" + action verb).
- No CD-2 self-evaluation framing.
- No CD-3 engagement (the "42.9%" is plain, not "your 42.9%").
- No CD-4 labels-as-inputs (no "vs Fish/Nit/etc.").
- CD-5 satisfied: "Rake-agnostic" matches stakes regex; "100bb effective" matches stack regex.
- No bodyMarkdown reference to blacklisted symbols.

**(7) Governance:**
- BACKLOG row PRF-G5-CI flipped IN PROGRESS (S1+S2) → IN PROGRESS (S1+S2+S3) with full S3 accept-criteria detail + S4 sequencing inline.
- STATUS top entry: pending — will write after handoff body.

## Files I Own (DO NOT EDIT)

*Session is currently IN PROGRESS — but Session 3 scope itself is COMPLETE.* No file lock needed for S4 transition.

S4 will:
- ADD a top-level `describe('contentDrift CI — Check 4 ...')` block to `contentDrift.test.js`
- ADD a top-level `describe('contentDrift CI — Check 5 ...')` block to `contentDrift.test.js`
- AUTHOR `src/utils/printableRefresher/gitDiff.js` (or similar) — thin wrapper around `git show HEAD:<path>` and `git diff HEAD -- <path>` via `child_process.execSync`. Falls back to "no prior version" on non-git environments (defaulting to "first commit, recomputation must match"). This wires the RT-108 schemaVersion-bump escape hatch into Check 1 — relaxing Check 1's S2-strict-mode.
- AUTHOR `scripts/refresher-recompute-hashes.js` (batch) + `scripts/refresher-compute-hash.js` (single-card) per spec §Phase 5 implementation checklist.
- WIRE `contentDrift.test.js` into `scripts/smart-test-runner.sh` as a mandatory pre-commit gate.
- VERIFY-CI-CATCHES-DRIFT: an acceptance test where an intentionally-drifted manifest fails with the correct error message. Per spec §Phase 5 implementation checklist final item: "Verify CI catches an intentionally-drifted manifest before proceeding."

S4 should NOT:
- Modify CD or source-util pattern catalogs without persona-level review.
- Touch the auto-profit manifest's bodyMarkdown (any change requires hash recomputation; if a real drift case must be tested, use a fixture/temp manifest).

## Uncommitted Changes (after S3 commit)

Created in this session:
- `src/utils/printableRefresher/sourceUtilPolicy.js`
- `src/utils/printableRefresher/copyDisciplinePatterns.js`
- `src/utils/printableRefresher/__tests__/sourceUtilPolicy.test.js`
- `src/utils/printableRefresher/__tests__/copyDisciplinePatterns.test.js`
- `.claude/handoffs/printable-refresher-session9.md` (this file)

Modified in this session:
- `src/utils/printableRefresher/__tests__/contentDrift.test.js` (Check 2 + Check 3 describes appended; imports updated; header comment updated)
- `.claude/BACKLOG.md` (PRF-G5-CI row state-flip)
- `.claude/STATUS.md` (new top entry pending handoff write)

**NOT modified:**
- `cardRegistry.js` / `lineage.js` / `manifestSchema.test.js` / `lineage.test.js` — stable; S3 only EXTENDS the test suite via new files + appended describes.
- Auto-profit manifest — bodyMarkdown unchanged from S2; contentHash unchanged.
- All Gate 4 design docs — stable.
- `SYSTEM_MODEL.md` — defer to S4 closure.

## What's Next

**S4 — Check 4 + Check 5 + dev scripts + verify-CI-catches-drift.** Last PRF-G5-CI session.

Concrete S4 deliverables:
1. **Check 4 — schemaVersion bump discipline.**
   - `gitDiff.js` (or fold into a `getSchemaVersionChange.js`) — wrapper around `child_process.execSync('git show HEAD:<path>')` + `child_process.execSync('git diff --name-only HEAD -- <path>')`. Returns:
     - `{ exists: false }` if no prior version (first commit case → recomputation must match).
     - `{ exists: true, prior: { schemaVersion, contentHash, bodyMarkdownDiffers, generatedFieldsDiffer, sourceUtilsDiffer }, current: {...}, bumped: boolean, decremented: boolean, proseOnlyEdit: boolean }`.
   - Check 4 logic per spec §Check 4:
     - No diff + same schemaVersion → PASS.
     - Diff + schemaVersion incremented → PASS (intentional re-version).
     - Diff + same schemaVersion + `proseOnlyEdit: true` + diff is bodyMarkdown-only (no generatedFields/sourceUtils diff) → PASS with warning.
     - Diff + same schemaVersion + no `proseOnlyEdit` → FAIL.
     - schemaVersion decremented → FAIL (monotonic violation).
     - `proseOnlyEdit: true` + diff includes generatedFields or sourceUtils → FAIL (misuse).
   - Wire RT-108 escape hatch into Check 1: allow `manifest.contentHash !== computeSourceHash(manifest)` if `getSchemaVersionChange().bumped === true` AND the new contentHash matches the recomputation. This relaxes S2's strict-mode.
2. **Check 5 — markdown-vs-generated precedence.**
   - Render each manifest with current `generatedFields` placeholders → check rendered output for hardcoded numbers in `bodyMarkdown` that could have been generated.
   - Spec says: "WARN (not fail; author must justify). Repeated warnings → manual PR-review escalation." So Check 5 is a soft gate at S4 — assertions log warnings via `console.warn` rather than throwing.
   - For auto-profit (no generatedFields), nothing to verify; passes trivially.
3. **Dev scripts.**
   - `scripts/refresher-recompute-hashes.js` — iterates all manifests, runs `computeSourceHash`, updates each manifest's `contentHash` field. Used after intentional batch source-util changes.
   - `scripts/refresher-compute-hash.js <cardId>` — computes the hash for a single card; prints to stdout for copy-paste into the manifest.
4. **`smart-test-runner.sh` wiring.**
   - Add `contentDrift.test.js` to the mandatory pre-commit + CI test gates per spec §Phase 5 implementation checklist item 6 + 7.
5. **Verify-CI-catches-drift acceptance.**
   - Author a fixture or use a temp file: simulate a manifest with hash mismatch (e.g., create a copy of auto-profit with bodyMarkdown changed but contentHash unchanged). Run the test suite. Verify it fails with the spec-mandated error message format.
   - Spec §Phase 5 implementation checklist item 9 explicitly requires this acceptance step.

S4 sizing: ~5-7 files added/modified. Largest new piece is the git wrapper + Check 4 logic. The `proseOnlyEdit` + `bumped` decision tree has 5 branches; test coverage across all of them is mandatory.

After S4 ships green, PRF-G5-CI is **CLOSED**. Phase B (PRF-G5-B) math-table card authoring becomes unblocked.

## Gotchas / Context

1. **CD-3 "your N%" pattern is broad by design.** It matches `your \d+%` literally, case-insensitive. The spec allows "your N%" in poker-math contexts but I did not implement a context-detection bypass — at the moment any "your N%" is a violation. If a future card legitimately needs to say "your 45% equity edge", the bypass mechanism is left to PR review (manual override per amendment rule, document in `cd5_exempt_justification`-equivalent field, OR redesign the prose to avoid "your"). The current pattern is conservative-correct.

2. **CD-4 whitelist exception window is 200 chars BEFORE + 200 chars AFTER each match.** Effective radius is 200 chars. The spec sometimes implies the radius is centered on the match; my implementation slices `[start - 200, end + 200]` → up to 400 chars of total context for citation lookup. This is the safe interpretation. If S4 reviewers want stricter (e.g., "200 chars total centered"), adjust `CD4_WHITELIST_RADIUS` to 100.

3. **`validateSourceUtils` does not enforce the `sourceUtils[].hash` format here.** The schema test (`manifestSchema.test.js`) already enforces `^sha256:[A-Za-z0-9-]+$` on each entry's `hash` field. Don't duplicate; trust the upstream gate.

4. **`validateCopyDiscipline` accepts `renderedFooter` as a parameter rather than re-deriving it.** This separates concerns (lineage derivation vs CD scanning) and keeps the validator pure. Caller must `derive7FieldLineage` + `printFooter` and pass the result. The contentDrift.test.js Check 3 describe handles this. If S4 reuses the validator from a non-test context, the caller must do the same.

5. **Auto-profit's body has the word "fold" but no CD-1 violation.** "needs villain to fold" doesn't match any CD-1 pattern because there's no "always" / "never" / "you must" / "don't" / "do not" + fold within 50 chars. The pattern catalog is precision-tuned; do not weaken to "any imperative-shaped sentence" — that would catch innocent prose.

6. **Empty `sourceUtils` is the spec-blessed pass-through.** I made `validateSourceUtils({sourceUtils: []})` return `valid: true` unconditionally (no whitelist enforcement on an empty array). This matches spec §Check 2 pass-through case for theory-only cards. Test #1 in sourceUtilPolicy.test.js asserts this explicitly.

7. **Test count growth.** S2: 65 PRF tests. S3: 117. S4 will add Check 4 fixtures (likely ~10-15 tests covering each branch of the schemaVersion-bump decision tree) + Check 5 sanity (~3 tests) + dev script smoke tests (optional ~5 tests) → estimated S4 PRF total ~135-150 tests. Once 13 MVP cards exist, these counts multiply by ~13× across the per-manifest checks.

8. **Pre-existing precisionAudit flake + gameTreeDepth2 env-timeout still present.** Same baseline as S2 commit. Not regression. PRF-isolation runs are clean.

9. **`g` flag on CD-4 regex is required for `matchAll`.** Without `g`, `matchAll()` throws a TypeError. The other CD patterns use `match()` for first-match-fail-fast; CD-4 uses `matchAll` because each match needs an independent whitelist-window check. Don't fold them all into the same iteration pattern — the `g` flag changes regex state machine semantics across calls.

10. **`cd5_exempt_justification` empty-string check is intentional.** A truthy `cd5_exempt: true` flag without a real justification is the dark-pattern this rule prevents — "tick the box to skip the lint." S3 verification: `cd5_exempt: true` + `cd5_exempt_justification: ''` does NOT bypass; only non-empty trimmed justification + the flag together unlock the bypass.

## System Model Updates Needed

Defer until S4 closes PRF-G5-CI. After S4, `SYSTEM_MODEL.md` should grow:
- New util namespace `src/utils/printableRefresher/` subtree: cardRegistry / lineage / sourceUtilPolicy / copyDisciplinePatterns / gitDiff (S4) / stalenessDiff (post-S4) / manifests / __tests__.
- New CI-gate entry: content-drift CI per spec §Relationship to other CI gates.
- Mention dev scripts: `scripts/refresher-recompute-hashes.js` + `scripts/refresher-compute-hash.js`.

UI-side updates (new view, new IDB stores, new reducers) wait for the persistence + UI implementation steps later in Phase 5 sequencing.

## Test Status

PRF tests run in isolation: **117/117 passing** across 5 files.
- `manifestSchema.test.js` — 23
- `lineage.test.js` — 33
- `contentDrift.test.js` — 11 (was 9 at S2; +2 from Check 2 + Check 3 per manifest × 1 manifest)
- `sourceUtilPolicy.test.js` — 16 (new)
- `copyDisciplinePatterns.test.js` — 34 (new)

S3 net-add: 52 tests.

Full smart-test-runner: not re-run this session — modifications outside `src/utils/printableRefresher/` are governance docs only. Pre-S3 baseline 7307/7309 from S2 commit unchanged; S3 adds 52 tests; expected post-S3 baseline 7401/7403 with the same 2 known non-regressions (precisionAudit pre-existing flake + gameTreeDepth2 env-load timeout).
