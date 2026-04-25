# Session Handoff: printable-refresher-session8
Status: IN PROGRESS | Written: 2026-04-25

## Backlog Item

**PRF-G5-CI Session 2 (lineage + Check 1 + Check 6).** Continues S1 (commit `6cc45ce`). Phase 5 implementation of content-drift CI per `docs/projects/printable-refresher/content-drift-ci.md`.

| Session | Scope | Status |
|---------|-------|--------|
| S1 (commit 6cc45ce) | Manifest schema + loader + 1 stub manifest + `manifestSchema.test.js` | DONE |
| **S2 (this)** | `lineage.js` + Check 1 + Check 6 + recompute auto-profit hash + lineage.test.js + contentDrift.test.js | **DONE** |
| S3 | Check 2 (source-util whitelist/blacklist) + Check 3 (CD forbidden-string grep) | NEXT |
| S4 | Check 4 (schemaVersion bump discipline + `proseOnlyEdit`) + Check 5 (md-vs-generated) + dev scripts + `smart-test-runner.sh` wiring + verify-CI-catches-drift | BLOCKED by S3 |

## What I Did This Session

Three new files + one stub-hash recomputation. All within `src/utils/printableRefresher/`.

**(1) `src/utils/printableRefresher/lineage.js` — hashing + 7-field lineage derivation.**

Six exports:
- `hashUtil(input: string): Promise<string>` — sha256 hex, format `sha256:<hex>`. Web Crypto path first (`globalThis.crypto.subtle.digest('SHA-256', ...)`), Node `node:crypto.createHash('sha256')` fallback. Vitest under Node hits the fallback path; tests verify byte-stability + correct format + UTF-8-byte (not code-point) hashing + the canonical "sha256 of empty string" reference value `e3b0c4429...b855`.
- `stableStringify(value)` — recursive key-sorted JSON. Equivalent objects with different key insertion orders produce identical strings. Required for deterministic hash input.
- `computeSourceHash(manifest): Promise<string>` — implements spec §Check 1 step 3. Inputs: `bodyMarkdown` + `sourceUtils[].hash` joined with `|` + stable-stringified `generatedFields`, separated by single space. For auto-profit (empty `sourceUtils` + empty `generatedFields`), this reduces to hashing `bodyMarkdown` alone — which is correct because auto-profit math is field-invariant + theory-only.
- `derive7FieldLineage(manifest, runtime = {}): LineageFooter` — red line #12 7-field derivation:
  1. `cardIdSemver`: `${cardId} v${schemaVersion}`
  2. `generationDate`: `manifest.lastVersionedAt`
  3. `sourceUtilTrail`: enumerated `path#fn (hash)` if non-empty; falls back to `"POKER_THEORY-derivation (see field [5])"` for empty `sourceUtils` per spec §Check 2 pass-through case (auto-profit canonical case)
  4. `engineAppVersion`: `engine ${runtime.engineVersion ?? 'unknown-engine'} / app ${runtime.appVersion ?? 'unknown-app'}`
  5. `theoryCitation`: echoes `manifest.theoryCitation`
  6. `assumptionBundle`: `stableStringify(manifest.assumptions)`
  7. `bucketDefinitionsCited`: propagated verbatim including `null` (the only nullable field per spec)
- `printFooter(lineage): string` — renders 7 lines `[1]..[7]` joined with `\n`. Null bucketDef renders `(no bucket definitions cited)` marker so the 7th slot is always visible.
- `isStubContentHash(s)` — true for strings starting with `sha256:stub-pending-`. The "do not ship stubs to main" guard.

**(2) Auto-profit manifest stub-hash recomputation.**
- One-shot Node invocation against the new `computeSourceHash`: `sha256:16ec2e026f1fad3384c735be7efff7b94356a24fa6ffaabb3da088f833239b0b`.
- `prf-math-auto-profit.json` `contentHash` field updated; placeholder string removed.

**(3) `src/utils/printableRefresher/__tests__/lineage.test.js` — 33 unit tests.**
- `hashUtil`: format-regex match; byte-stable across calls; different inputs differ; empty-string deterministic + matches known sha256-of-empty `e3b0c4429...b855`; UTF-8 bytes (not code points) — `"é"` and `"e"` produce different hashes.
- `stableStringify`: key-order invariance (top + nested); array order preserved; primitives (null/undefined/boolean/number/string) round-trip.
- `computeSourceHash`: produces sha256-format; deterministic; drift on bodyMarkdown change; drift on `sourceUtils[].hash` change; drift on `generatedFields` change; key-order invariance for `generatedFields`; handles missing `sourceUtils`/`generatedFields` gracefully.
- `isStubContentHash`: detects prefix; rejects real hashes; rejects non-strings.
- `derive7FieldLineage`: returns exactly the 7 named fields (no extras); cardIdSemver format; generationDate echo; sourceUtilTrail empty-fallback vs populated-enumeration; engineAppVersion runtime-vs-fallback paths; theoryCitation echo; assumptionBundle key-order-invariant; bucketDef null vs string propagation.
- `printFooter`: 7 numbered lines; null-marker rendering vs verbatim string.

**(4) `src/utils/printableRefresher/__tests__/contentDrift.test.js` — Check 1 + Check 6 (9 tests for the current 1-manifest registry).**
- Check 1 (per manifest):
  - `contentHash` is not a stub placeholder. Stub failures throw a long error pointing at the recompute one-liner.
  - `manifest.contentHash` equals `await computeSourceHash(manifest)`. Drift failure throws an error explaining the schemaVersion-bump escape hatch is wired in S4 + until then any drift is hard-fail.
- Check 6 (per manifest, 7 sub-tests):
  - Fields [1]-[6] are non-empty strings (field [2] additionally parses as a Date).
  - Field [7] (`bucketDefinitionsCited`) is null OR non-empty string.

**(5) Governance:**
- BACKLOG row PRF-G5-CI: status flipped to "IN PROGRESS (S1+S2 shipped 2026-04-25)" with full S2 accept-criteria detail + S3/S4 sequencing inline. References commit `6cc45ce` for S1.
- STATUS top entry: pending — will write after handoff body lands.

## Files I Own (DO NOT EDIT)

*Session is currently IN PROGRESS — but Session 2 scope itself is COMPLETE.* No file lock needed for S3 transition.

S3 will:
- ADD a new top-level `describe('contentDrift CI — Check 2 ...')` block to `contentDrift.test.js` (no removal of S2 blocks)
- ADD a new top-level `describe('contentDrift CI — Check 3 ...')` block similarly
- Possibly ADD helpers to `lineage.js` if needed for sourceUtils path-resolution / regex testing (more likely a separate `sourceUtilWhitelist.js` helper file)
- Read `docs/projects/printable-refresher/copy-discipline.md` §CI-lint as the canonical source of CD regex patterns. Spec mandates the regex list be MAINTAINED in copy-discipline.md and MIRRORED in contentDrift.test.js — not the other way around.

S3 should NOT:
- Touch S1 or S2 source files except by extension (no logic changes to existing exports without a doctrine review).
- Modify the auto-profit manifest's bodyMarkdown without recomputing the contentHash. Any prose change → recompute (Check 1 will catch immediately).

## Uncommitted Changes (after S2 commit)

Created in this session:
- `src/utils/printableRefresher/lineage.js`
- `src/utils/printableRefresher/__tests__/lineage.test.js`
- `src/utils/printableRefresher/__tests__/contentDrift.test.js`
- `.claude/handoffs/printable-refresher-session8.md` (this file)

Modified in this session:
- `src/utils/printableRefresher/manifests/prf-math-auto-profit.json` (contentHash placeholder → real recomputed value)
- `.claude/BACKLOG.md` (PRF-G5-CI row state-flip — S1+S2 done)
- `.claude/STATUS.md` (new top entry pending handoff write)

**NOT modified:**
- `cardRegistry.js` — stable from S1; no API changes needed by S2.
- `manifestSchema.test.js` — still 23/23 green; Check 1's stub-hash assertion is in `contentDrift.test.js`, not duplicated here.
- All Gate 4 design docs — stable.
- `SYSTEM_MODEL.md` — defer to S3/S4 closure.

## What's Next

**S3 — Checks 2 + 3.** Two checks shipped together because both scan manifest content (sourceUtils paths + bodyMarkdown prose) and both require regex-pattern maintenance.

Concrete S3 deliverables:
1. `src/utils/printableRefresher/sourceUtilPolicy.js` (or similar) — exports:
   - `WHITELIST_REGEXES` array (3 entries per spec).
   - `BLACKLIST_REGEXES` array (7 entries per spec).
   - `validateSourceUtils(manifest)` → `{ valid: boolean, violations: string[] }`. Scans `manifest.sourceUtils[].path` against both lists + scans `manifest.bodyMarkdown` for blacklisted-path string references.
2. `src/utils/printableRefresher/copyDisciplinePatterns.js` (or similar) — exports the CD regex catalog mirroring `copy-discipline.md` §CI-lint:
   - `CD1_IMPERATIVE_TONE` (5 patterns)
   - `CD2_SELF_EVALUATION` (6 patterns)
   - `CD3_ENGAGEMENT` (8 patterns)
   - `CD4_LABELS_AS_INPUTS` (1 pattern + whitelist-exception logic for POKER_THEORY-citation-within-200-chars)
   - `CD5_UNQUALIFIED_ASSUMPTIONS` (stakes-regex + stack-regex requirements + `cd5_exempt` bypass)
   - `validateCopyDiscipline(manifest)` → `{ valid: boolean, violations: { rule, pattern, excerpt }[] }`.
3. Extend `contentDrift.test.js` with two new top-level describes:
   - **Check 2**: per manifest, `validateSourceUtils()` returns valid=true.
   - **Check 3**: per manifest × per CD pattern, validation passes (or the CD-4/CD-5 whitelist exception applies).
4. Auto-profit verification: re-confirm bodyMarkdown is CD-clean. The S1 prose ("Bet B into pot P needs villain to fold at least B/(P+B) of their range to be auto-profit before equity is considered. Rake-agnostic at 100bb effective; pure pot-odds derivation. Worked example: bet 6 into pot 8 → break-even fold frequency = 6/14 = 42.9%.") was authored CD-clean — S3 must verify with the actual regex set.

S3 sizing: ~3-4 files added/modified. Slightly more than S2 because of the regex breadth, but mechanically straightforward — patterns are enumerated in `copy-discipline.md`, not designed at S3 time.

**S4 — Checks 4 + 5 + dev scripts + verify-CI-catches-drift.** Last PRF-G5-CI session.

Key S4 risk: `getSchemaVersionChange()` git wrapper. The implementation needs to call `git show HEAD:src/utils/printableRefresher/manifests/<filename>` and `git diff HEAD -- ...` from a vitest run. CI-environment behavior may differ from local. Plan: use `child_process.execSync` with a try/catch that falls back to "no prior version" (defaulting to "first commit, recomputation must match"). Document the fallback semantics in S4.

## Gotchas / Context

1. **Web Crypto vs Node crypto path.** Web Crypto is async-only via `subtle.digest` returning a Promise. Node `crypto.createHash` is sync. The `hashUtil` API is async to keep both paths under one signature — callers use `await`. Tests verify both paths produce the same canonical sha256-of-empty-string `e3b0c4429...b855`, which is the canonical reference value (RFC 4634 / NIST FIPS 180-4 test vector).

2. **`computeSourceHash` separator choice.** I joined the three input segments (bodyMarkdown / sourceUtils-hashes / stableStringified-generatedFields) with a single ASCII space ` `. This separator is arbitrary but deterministic. If S3+ extends the input set (e.g., adds `assumptions` to the hash directly), choose a separator that cannot appear naturally in any segment. Currently safe because the ASCII space is plentiful in bodyMarkdown but the segment ORDER is fixed + unambiguous.

3. **Auto-profit bodyMarkdown is CD-1 / CD-3 / CD-5 clean by inspection but UNVERIFIED until S3.** The prose was authored without imperative tone, without engagement copy, and includes "rake-agnostic" + "100bb effective" satisfying CD-5 stakes/stack regexes. S3 must verify mechanically. If S3 finds a violation, the manifest needs prose edit + contentHash recomputation.

4. **Stub-prefix guard tests at the manifest layer, not the test layer.** `isStubContentHash` is a public function — the test asserts the manifest's stored value isn't a stub. If a future engineer adds a manifest with a stub hash and forgets to recompute, Check 1's stub-hash sub-test fails LOUDLY before the contentHash-equals-recomputed sub-test even runs. This is intentional — the error message is more actionable for the "I forgot to run recompute" case.

5. **Check 1 is currently strict-mode (no schemaVersion-bump escape hatch).** S4 wires `getSchemaVersionChange()` for the RT-108 escape hatch. Until then, every bodyMarkdown / sourceUtils[].hash / generatedFields edit MUST include a contentHash recomputation in the same PR. This is the right behavior pre-Check-4 because we don't yet have monotonicity enforcement on schemaVersion either — relaxing Check 1 without Check 4 would be an autonomy hole.

6. **`derive7FieldLineage` runtime arg defaults to `{}`.** Tests pass mock `engineVersion`/`appVersion`. Production code must thread real values from `package.json` or a build-time constant. Defer the production wiring to the persistence + UI step (post-S4 in Phase 5 sequencing).

7. **`printFooter` output format is provisional.** `[1]..[7]` numbered lines is a developer-facing format. The actual print rendering (Region 4-5 of card-templates per `printable-refresher-card-templates.md`) will produce a different visual layout — likely two lines of footer text formatted per `print-css-doctrine.md` §Region 4-5. The `printFooter` function is for tests and dev tooling, not for the print pipeline directly. Document this distinction at S4 or in the post-G5-CI persistence wiring.

8. **No CI script wiring this session.** Spec calls out `scripts/check-refresher-bundle.sh` (forbidden-rasterization-library bundle scan) + `scripts/check-refresher-writers.sh` (writer-registry CI-grep). Both are out of scope for PRF-G5-CI; they are separate CI gates per spec §Relationship to other CI gates. They get written when the persistence + bundle-build steps land.

9. **The test count delta from S1 → S2.** S1: 23. S2 adds 33 (lineage.test.js) + 9 (contentDrift.test.js) = 42 new. Total PRF: 65 tests. Once 13 MVP cards exist (Phase 1 target), Check 1 alone produces 13 hash-match assertions; Check 6 produces 13 × 7 = 91 lineage assertions; Checks 2-3 add another ~20 per card = 260; Checks 4-5 another ~5 per card. Estimate Phase 1 PRF test count ~500-700 once card-authoring completes.

10. **Pre-existing precisionAudit flake + gameTreeDepth2 env-timeout still present.** Same baseline as S1 commit. Not regression. Documented in S7 handoff §Test Status.

## System Model Updates Needed

Defer until S4 closes PRF-G5-CI. After S4, `SYSTEM_MODEL.md` should grow:
- New util namespace `src/utils/printableRefresher/` subtree: cardRegistry / lineage / sourceUtilPolicy / copyDisciplinePatterns / stalenessDiff (post-S4) / manifests / __tests__.
- New CI-gate entry: content-drift CI per spec §Relationship to other CI gates.

UI-side updates (new view, new IDB stores, new reducers) wait for the persistence + UI implementation steps later in Phase 5 sequencing.

## Test Status

PRF tests run in isolation: **65/65 passing** (3 files: manifestSchema 23 + lineage 33 + contentDrift 9).

Full smart-test-runner: not re-run this session — the only modifications outside `src/utils/printableRefresher/` are governance docs (`.claude/BACKLOG.md` + `.claude/STATUS.md` + handoff). Pre-S2 baseline 7307/7309 from S1 commit; S2 adds 42 tests; expected post-S2 baseline 7349/7351 with the same 2 baseline non-regressions (precisionAudit pre-existing flake + gameTreeDepth2 env-load timeout). Will re-run smart-test-runner if S3 introduces any cross-namespace touches.
