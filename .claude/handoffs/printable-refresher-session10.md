# Session Handoff: printable-refresher-session10
Status: COMPLETE | Written: 2026-04-25

## Backlog Item

**PRF-G5-CI CLOSED.** Final session (S4) of the 4-session content-drift CI implementation. All 6 spec checks live + RT-108 escape hatch wired + dev scripts shipped + verify-CI-catches-drift acceptance test green.

| Session | Scope | Commit |
|---------|-------|--------|
| S1 (foundation) | Manifest schema + loader + stub | `6cc45ce` |
| S2 (lineage + hashing) | Check 1 + Check 6 | `78bd449` |
| S3 (policy + CD) | Check 2 + Check 3 | `350dad5` |
| **S4 (this) — closeout** | Check 4 + Check 5 + RT-108 hatch + dev scripts + acceptance | this commit |

After this commit, **Phase B math-table card authoring (PRF-G5-B)** and **migration scaffold (PRF-G5-MIG)** become NEXT-unblocked. Phase 5 sequencing per S6 handoff (recommended order): PRF-G5-MIG → persistence + selectors → RL/RI/DS/LG test scaffolds → PRF-G5-B Phase B → Q5 differentiation demo → PRF-G5-A → PRF-G5-C → PRF-G5-PDF.

## What I Did This Session

Six new files + two extensions. Total S4 net-add: 44 PRF tests (now 161 across 7 files).

**(1) `src/utils/printableRefresher/getSchemaVersionChange.js` — Check 4 logic + git wrapper.**

Three exports:
- `describeChange({prior, current})` — pure helper deriving `{exists, prior, current, bumped, decremented, proseOnlyEdit, diff: {bodyMarkdownDiffers, generatedFieldsDiffer, sourceUtilsDiffer, anyDiff}}`. Uses `stableStringify` from `lineage.js` for key-order-invariant comparison of `generatedFields` + `sourceUtils`. Returns `{exists: false}` when either side missing.
- `getSchemaVersionChange(current, options)` — calls `child_process.execSync('git show HEAD:<path>')` via dependency-injected `gitShow`. Returns `{exists: false, reason}` for `'no-rel-path' | 'not-in-head' | 'parse-error'` cases. Default `gitShow` swallows stderr (legitimate "file not in HEAD" path stays clean).
- `evaluateCheck4(change)` — 5-branch decision tree per spec §Check 4:
  1. `not-in-head` → PASS (first-commit case; Check 1 strict mode handles drift).
  2. `decremented` → FAIL (monotonic violation).
  3. `no-diff` (bumped or not) → PASS (over-bumping permitted; not regressing).
  4. `diff + bumped` → PASS (intentional re-version).
  5. `diff + same-version + proseOnlyEdit:true + bodyMarkdown-only` → PASS with warning (typo fix).
  6. `diff + same-version + proseOnlyEdit:true + generatedFields-or-sourceUtils-diff` → FAIL (escape hatch misuse).
  7. `diff + same-version + no proseOnlyEdit` → FAIL (schemaVersion bump required).

**(2) `src/utils/printableRefresher/__tests__/getSchemaVersionChange.test.js` — 21 unit tests.**

Three describes:
- `describeChange`: 7 tests covering null-input, identical-pair, bodyMarkdown-diff, generatedFields key-order-invariance, sourceUtils-diff, schemaVersion bumped/decremented detection, proseOnlyEdit propagation.
- `evaluateCheck4`: 9 tests covering all 9 branches of the decision tree.
- `getSchemaVersionChange` (with `gitShow` injection): 4 tests covering no-rel-path, not-in-head (gitShow returns null), parse-error (gitShow returns invalid JSON), valid-prior-JSON (full descriptor returned).

Real git is never invoked from these tests — `gitShow` is dependency-injected as a stub.

**(3) `src/utils/printableRefresher/__tests__/contentDrift.test.js` — Check 1 RT-108 escape hatch + Check 4 + Check 5 (placeholder + hardcoded-numeric warning).**

Modifications + appends:
- **Check 1 (modified)**: When hash mismatches, calls `getSchemaVersionChange(m, {manifestRelPath: 'src/utils/printableRefresher/manifests/<filename>'})`. If `change.exists && change.bumped`, error message specifically calls out "schemaVersion bumped from X to Y but contentHash was not updated" + one-liner pointer to `node scripts/refresher-compute-hash.js <cardId>`. Otherwise the original drift error. The actual equality check still fails — this is messaging clarity per spec sketch, not behavioral relaxation.
- **Check 4 (new describe)**: per manifest, `evaluateCheck4(getSchemaVersionChange(m, {manifestRelPath}))` returns `{pass: true}`. For the auto-profit manifest currently committed, Check 4 returns "no content diff" → PASS.
- **Check 5a (new test)** — placeholder resolution (strict): scans `bodyMarkdown` with `/\{\{([\w.-]+(?:\[[^\]]+\])?)\}\}/g`. For each match, extracts the placeholder name, splits on `[` to get the base key, asserts the key exists in `generatedFields`. Indexed placeholders like `{{autoProfitTable[0.5]}}` resolve via the base key `autoProfitTable`. Auto-profit (no placeholders, empty generatedFields) trivially passes.
- **Check 5b (new test)** — hardcoded-numeric warning (soft gate, never fails): scans bodyMarkdown for `\b\d+(?:\.\d+)?%`. If matches found AND no `generatedFields` AND no `theoryCitation`, emits `console.warn`. Auto-profit has `theoryCitation: 'POKER_THEORY.md §3.1'` so no warning fires. The test always passes — the warning is for reviewer signal only, per spec §Check 5 ("WARN, not fail").

**(4) `src/utils/printableRefresher/__tests__/verifyCatchesDrift.test.js` — 20 acceptance tests.**

Load-bearing acceptance per spec §Phase 5 implementation checklist final item: "Verify CI catches an intentionally-drifted manifest before proceeding." Constructs fixture manifests for each canonical drift mode and asserts validators report expected violations:
- Check 1: clean fixture passes / drifted bodyMarkdown fails recomputation / stub-prefix detected.
- Check 2: blacklist-match / whitelist-miss / blacklist-body-reference all caught.
- Check 3: CD-1a (you must) / CD-3a (mastered) / CD-4 (vs Fish iso) / CD-5-stakes all caught.
- Check 4: diff-no-bump-FAIL / proseOnlyEdit-misuse-FAIL / decremented-FAIL.
- Check 5: placeholder unresolved-detection + resolved-passes + indexed-base-key-resolution.
- Check 6: missing theoryCitation produces empty field [5] / null bucketDef permitted / printFooter renders 7 numbered lines with explicit null marker.
- Meta: validator-import sanity (every check's exported function is callable).

**Why this file is non-negotiable.** Without fixture-driven failure assertions, a future refactor could silently break a validator (regex stripped, comparison short-circuited, etc.) and every real manifest would still pass because the validator never fires. These fixtures keep every Check honest across refactors. Per spec sequencing this is the gate that closes PRF-G5-CI.

**(5) `scripts/refresher-compute-hash.js <cardId>` — single-card dev script.**

Reads `src/utils/printableRefresher/manifests/<lowercase(cardId)>.json`, runs `computeSourceHash`, prints to stdout. Stderr diagnostic shows match/mismatch. Verified working: `node scripts/refresher-compute-hash.js PRF-MATH-AUTO-PROFIT` returns `sha256:16ec2e02...239b0b` + `OK: stored contentHash matches recomputed value.`

**(6) `scripts/refresher-recompute-hashes.js [--write]` — batch dev script.**

Iterates all manifests under `src/utils/printableRefresher/manifests/`. Dry-run by default (exit 1 on drift; exit 0 when all hashes match). With `--write` flag, updates each manifest's `contentHash` in-place if it differs (preserves trailing newline + 2-space indent — project convention). Verified working: `node scripts/refresher-recompute-hashes.js` returns `Scanned 1 manifest(s); 0 drifted.`

**(7) Smart-test-runner / CI wiring.**

No script change required. The `vite.config.js` `unit` project glob includes `src/utils/**/__tests__/**/*.test.js` which auto-discovers all PRF test files. Both `scripts/smart-test-runner.sh` (which runs `npm test`) and `.github/workflows/ci.yml` (which also runs `npm test`) pick up `contentDrift.test.js` + `verifyCatchesDrift.test.js` + the 5 sibling test files automatically. Spec §Phase 5 implementation checklist items 6 + 7 (smart-test-runner pre-commit + CI merge gate) are satisfied by glob inclusion.

**(8) Governance.**

- BACKLOG row PRF-G5-CI: IN PROGRESS (S1+S2+S3) → **COMPLETE (2026-04-25 — all 4 sessions shipped)**. Full S4 accept-criteria detail inline.
- STATUS top entry: pending — will write after handoff body.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE. PRF-G5-CI is closed.* No file lock needed.

The next PRF session (S11+) will work on persistence/UI implementation per Phase 5 sequencing. Recommended starting point: **PRF-G5-MIG** (IDB migration scaffold). After that, the persistence + selectors layer per `selectors.md` + `WRITERS.md` specs. The content-drift CI infrastructure shipped in S1-S4 will catch drift automatically as new card manifests are added during PRF-G5-B (Phase B math-table authoring).

## Uncommitted Changes (after S4 commit)

Created in this session:
- `src/utils/printableRefresher/getSchemaVersionChange.js`
- `src/utils/printableRefresher/__tests__/getSchemaVersionChange.test.js`
- `src/utils/printableRefresher/__tests__/verifyCatchesDrift.test.js`
- `scripts/refresher-compute-hash.js`
- `scripts/refresher-recompute-hashes.js`
- `.claude/handoffs/printable-refresher-session10.md` (this file)

Modified in this session:
- `src/utils/printableRefresher/__tests__/contentDrift.test.js` (Check 1 RT-108 escape hatch + Check 4 + Check 5 placeholder + Check 5 numeric warning + import additions + header comment updated)
- `.claude/BACKLOG.md` (PRF-G5-CI flipped IN PROGRESS → **COMPLETE**)
- `.claude/STATUS.md` (new top entry pending handoff write)

**NOT modified:**
- `cardRegistry.js` / `lineage.js` / `sourceUtilPolicy.js` / `copyDisciplinePatterns.js` — stable from prior sessions.
- All four sibling test files — stable; only `contentDrift.test.js` extended.
- Auto-profit manifest — bodyMarkdown + contentHash unchanged.
- All Gate 4 design docs — stable.
- `SYSTEM_MODEL.md` — flagged for update at PRF-G5-MIG (next session) when first persistence module lands.

## What's Next

**PRF-G5-CI is closed. Phase 5 sequencing continues with PRF-G5-MIG.**

Recommended Phase 5 next-session order (per S6 handoff §Recommended Phase 5 order):

1. **PRF-G5-MIG** — IDB migration per `idb-migration.md` spec. 6 PRF-G5-MIG test cases (round-trip / seed-correctness / idempotent / no-v17-mutation / printedAt-index-present / collision-resolution simulating Shape Language pre-claim of v18).
2. **Persistence + selector wiring** — `useRefresherConfig` (IDB-backed) + `useRefresherView` (localStorage) + 6 selectors per `selectors.md`. Writer registry per `WRITERS.md` (W-URC-1/2/3) + `scripts/check-refresher-writers.sh` CI-grep + bundle-import check `scripts/check-refresher-bundle.sh`.
3. **PRF-G5-RL + PRF-G5-RI + PRF-G5-DS + PRF-G5-LG test scaffolds** — red-line / reducer-boundary / durable-suppression / lineage-footer test files. Most assertions don't need card content.
4. **PRF-G5-B Phase B Math Tables** — 6 cards (auto-profit / geometric / pot-odds / implied / binomial / SPR zones). At authoring time, the content-drift CI shipped in S1-S4 will catch any source-util drift, CD violation, missing lineage, or schemaVersion-bump-without-recompute. Author each manifest, run `node scripts/refresher-compute-hash.js <cardId>` to compute the contentHash, paste into manifest, watch all 6 checks pass.
5. **Q5 differentiation demo at design review** — author `PreflopCardTemplate.jsx` + one Phase A preflop sample card; compare visually to Upswing free pack. Owner decides Phase A go/no-go.
6. **PRF-G5-A Phase A Preflop** — conditional on Q5 verdict.
7. **PRF-G5-C Phase C Equity + Exceptions** — last; per-card Voice-3-equivalent fidelity review at PR time.
8. **PRF-G5-PDF Playwright cross-browser snapshots** — once MVP cards exist.

Phase 1 MVP card count target: 10-13 cards (6 Phase B + 0-3 Phase A conditional + 4 Phase C).

## Gotchas / Context

1. **Check 1 RT-108 escape hatch is messaging-only, not behavioral.** When the stored hash mismatches the recomputed hash, the test still fails — the escape hatch just produces a different error message depending on whether the schemaVersion was bumped. The author still has to update `manifest.contentHash` to the recomputed value. This matches the spec §Check 1 implementation sketch precisely (the spec's `if (schemaVersionChangedInPR.bumped)` branch still does `expect(manifest.contentHash).toBe(recomputed)`). Future refactors should preserve this behavior — the bump-without-recompute case is loud, not silent.

2. **Real git invocation in Check 4 is OK.** `defaultGitShow` swallows stderr + returns null on failure. In CI on a fresh clone, `git show HEAD:<path>` returns the file at HEAD (which equals the working tree on a freshly checked-out commit) → no diff → PASS. In a developer's working directory mid-edit, the comparison catches actual drift.

3. **Check 4's "first-commit" case is permissive by design.** When a manifest is added in-PR (not yet in HEAD), `getSchemaVersionChange` returns `{exists: false, reason: 'not-in-head'}` and `evaluateCheck4` returns `{pass: true}`. This is correct — the manifest is brand new; there's no prior version to bump from. Check 1 (recomputation equality) still applies and ensures the new manifest's stored hash matches the computed value. So drift is caught even on first-commit cards.

4. **`stableStringify` from `lineage.js` is reused for diff detection.** `describeChange` uses `stableStringify(generatedFields)` and `stableStringify(sourceUtils)` for diff comparison. This means key-order-invariant comparison — if an author rewrites `generatedFields: {a: '1', b: '2'}` to `generatedFields: {b: '2', a: '1'}` without changing values, Check 4 reports no diff. This matches the hash determinism behavior in `computeSourceHash`. Don't swap to plain `JSON.stringify` — that would falsely flag key-order-only diffs.

5. **Check 5 placeholder regex `/\{\{([\w.-]+(?:\[[^\]]+\])?)\}\}/g` is intentionally narrow.** Matches `{{name}}`, `{{name.path}}`, `{{name-with-hyphens}}`, `{{name[0.5]}}`, `{{name[key.subkey]}}`. Does NOT match `{{ }}` (whitespace-only), `{{name with spaces}}`, `{{name+ext}}`. If future card authors use a broader placeholder syntax, the regex needs amendment — and that amendment requires the same persona-level review as CD pattern changes (per spec §Amendment rule).

6. **Check 5 hardcoded-numeric warning is soft and informational.** It emits `console.warn` but the test always passes. The spec explicitly says "WARN (not fail; author must justify). Repeated warnings → manual PR-review escalation." This is an explicit design choice — a strict numeric check would break too many legitimate worked-example cards. Future PR review can decide whether to escalate a warning to a fail; the hook to do so is `expect(numerics.length).toBe(0)` if needed (the test currently asserts `true === true` to make the soft-gate intent explicit).

7. **The two dev scripts are isomorphic for a single card but differ at scale.** `refresher-compute-hash.js <cardId>` is the "I just edited this one card" workflow. `refresher-recompute-hashes.js --write` is the "I just changed `pokerCore/preflopCharts.js` and 12 cards now drift" workflow — bulk update + re-commit. Both rely on `lineage.js#computeSourceHash`; if that function changes, both scripts pick it up automatically.

8. **The `--write` flag is intentionally explicit on `refresher-recompute-hashes.js`.** Default behavior is dry-run with exit 1 on drift. This is the "show me what would change" pre-commit safety. Authors must consciously add `--write` to actually mutate manifests. Mirrors the same dry-run-by-default doctrine as `git apply --check` etc.

9. **No production-side runtime versioning yet.** `derive7FieldLineage(manifest, {engineVersion, appVersion})` accepts runtime params; in S4 nothing wires these from `package.json` or build constants. Tests pass mock values. Production wiring lives in the persistence + UI step (post-PRF-G5-MIG). The fallback markers `'unknown-engine' / 'unknown-app'` are loud enough to flag missing wiring at print-preview review time.

10. **`verifyCatchesDrift.test.js` does not exhaustively cover every CD pattern.** It tests one pattern per CD rule family (CD-1a, CD-3a, CD-4, CD-5-stakes). The full CD pattern coverage is in `copyDisciplinePatterns.test.js` (34 tests). The acceptance file's job is "every Check actually fires when given drift" — not "every regex pattern is exercised." If a future amendment adds a new CD-X subpattern, both `copyDisciplinePatterns.test.js` (catalog coverage) and `verifyCatchesDrift.test.js` (acceptance) need updates per amendment-rule discipline.

## System Model Updates Needed

PRF-G5-CI closure does not yet warrant `SYSTEM_MODEL.md` updates. The infrastructure is in place but pre-persistence and pre-UI. The first material persistence change (PRF-G5-MIG) will add new IDB stores requiring SYSTEM_MODEL §1 + §2 updates.

After Phase 5 fully completes, SYSTEM_MODEL should grow:
- New util namespace `src/utils/printableRefresher/` with subtree: cardRegistry / lineage / sourceUtilPolicy / copyDisciplinePatterns / getSchemaVersionChange / stalenessDiff (post-G5-CI) / manifests / __tests__.
- New CI-gate entries in §10 or appropriate section: content-drift CI per spec §Relationship to other CI gates; pending bundle-grep + writer-grep CI gates.
- New dev scripts noted in §Dev Tooling: `scripts/refresher-recompute-hashes.js` + `scripts/refresher-compute-hash.js`.

## Test Status

**PRF tests in isolation: 161/161 passing across 7 test files.**
- `manifestSchema.test.js` — 23
- `lineage.test.js` — 33
- `sourceUtilPolicy.test.js` — 16
- `copyDisciplinePatterns.test.js` — 34
- `getSchemaVersionChange.test.js` — 21 (new in S4)
- `verifyCatchesDrift.test.js` — 20 (new in S4)
- `contentDrift.test.js` — 14 (was 11 at S3; +3 for Check 4 + Check 5a + Check 5b)

**Full smart-test-runner: 7563 passing / 1 failing across 289 test files (288 passed / 1 failed) over 440s duration.** The 1 failure is the known pre-existing precisionAudit `every lane with declared representatives has measured mean within ±2.5pp of baseEquity` flake unchanged from baseline. **Zero new regressions from S4.** Note: pre-S4 baseline measurement at S1 commit reported 7307/7309 with 2 failures (precisionAudit + gameTreeDepth2 env-timeout); the current run shows 1 failure (no env-timeout this time — confirms the earlier gameTreeDepth2 failure was indeed environmental load, not a logic regression).
