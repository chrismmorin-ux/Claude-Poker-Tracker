# Session Handoff: printable-refresher-session7
Status: IN PROGRESS | Written: 2026-04-25

## Backlog Item

**PRF-G5-CI Session 1 (foundation).** Phase 5 (Implementation) opened. This is the non-negotiable first step before any card-authoring PR may merge — see `docs/projects/printable-refresher/content-drift-ci.md` §Non-negotiable sequencing.

Backlog row touched: **PRF-G5-CI** (NEXT → IN PROGRESS, Session 1 detail appended).

PRF-G5-CI is multi-session by design. This session shipped foundation only:

| Session | Scope | Status |
|---------|-------|--------|
| **S1 (this)** | Manifest schema + loader + 1 stub manifest + `manifestSchema.test.js` | **DONE** |
| S2 | `lineage.js` + Check 1 (contentHash recomputation) + Check 6 (lineage-footer completeness) | NEXT |
| S3 | Check 2 (source-util whitelist/blacklist) + Check 3 (CD forbidden-string grep) | BLOCKED by S2 lineage |
| S4 | Check 4 (schemaVersion bump discipline) + Check 5 (md-vs-generated precedence) + dev scripts (`refresher-recompute-hashes.js` + `refresher-compute-hash.js`) + `smart-test-runner.sh` wiring + verify-CI-catches-drift | BLOCKED by S3 |

## What I Did This Session

Three new files + one BACKLOG row state-flip. All within the new `src/utils/printableRefresher/` namespace (no conflicts; no other session owns this path).

**(1) `src/utils/printableRefresher/cardRegistry.js` — barrel loader.**
- `import.meta.glob('./manifests/*.json', { eager: true })` — Vite-native, sync at module load. Vitest goes through Vite, so this works in test env without setup tweaks (verified by S1 test green).
- Builds an `entries` array of `{ path, filename, slug, manifest }` then sorts by `cardId.localeCompare()` for deterministic iteration order across machines + snapshot tests.
- Exports: `manifestEntries` (with path/filename for filename↔cardId tests), `manifests` (just the manifest objects — primary API), `manifestsByCardId` (for direct lookup).
- Also exports enum constants: `CARD_CLASS_VALUES = ['preflop', 'math', 'equity', 'exceptions']`, `PHASE_VALUES = ['A', 'B', 'C']`, `TIER_VALUES = ['free', 'plus']`, `ATOMICITY_WORD_COUNT_MAX = 25`, `FIDELITY_KEYS = [F1..F6]`.
- Default-export normalization: handles both `mod.default` (JSON-import via Vite) and direct-object cases.

**(2) `src/utils/printableRefresher/manifests/prf-math-auto-profit.json` — first stub manifest.**
- v1 shape per `content-drift-ci.md` §Manifest shape — every required field present.
- `cardId: "PRF-MATH-AUTO-PROFIT"` / filename `prf-math-auto-profit.json` (lowercase(cardId).json convention enforced by schema test).
- `class: "math"` / `phase: "B"` / `tier: "free"` — Phase B math-table card per spec example.
- `sourceUtils: []` — auto-profit is the canonical "POKER_THEORY-only citation, no source utils" case (spec §Check 2 pass-through case explicitly names auto-profit).
- `theoryCitation: "POKER_THEORY.md §3.1 (auto-profit threshold derivation)"`.
- `assumptions.rake: null` + `assumptions.stakes: "rake-agnostic"` — auto-profit math is field-invariant; CD-5 stakes-regex passes via "rake-agnostic" keyword.
- `atomicityJustification: "Single derivation (auto-profit threshold) presented as one card."` (8 words; ≤ 25 ceiling).
- `bodyMarkdown` includes a worked example (bet 6 into pot 8 → 42.9% break-even) that's CD-3-clean (no engagement copy) and CD-1-clean (no imperative tone).
- `contentHash: "sha256:stub-pending-PRF-G5-CI-S2-recomputation"` — placeholder. S2's Check 1 will recompute + compare. The placeholder is intentionally distinguishable from a real hash so S2 review catches if recomputation is skipped.
- `proseOnlyEdit: false` — included as explicit field even though Check 4 (schemaVersion discipline) won't fire until S4.

**(3) `src/utils/printableRefresher/__tests__/manifestSchema.test.js` — schema validation.**
- 23 tests passing (1 file). 3 registry-sanity tests + 20 per-manifest tests via `describe.each`.
- Registry sanity: ≥1 manifest loaded; `cardId` globally unique; sorted-by-cardId iteration order.
- Per-manifest assertions:
  1. `cardId` matches `^PRF-[A-Z0-9-]+$` (kebab-case + uppercase + PRF prefix)
  2. Filename equals `lowercase(cardId).json`
  3. `schemaVersion` is integer ≥ 1
  4. `class` ∈ `CARD_CLASS_VALUES`
  5. `title` non-empty string
  6. `bodyMarkdown` non-empty string
  7. `generatedFields` is plain object (not array, not null)
  8. `sourceUtils` is array; each entry has `{path, hash, fn}` with hash matching `^sha256:[A-Za-z0-9-]+$`
  9. `theoryCitation` non-empty string
  10. `assumptions.{stakes, rake (object|null with pct/cap/noFlopNoDrop), effectiveStack > 0, field}` shape
  11. `bucketDefinitionsCited` null or non-empty string
  12. `atomicityJustification` non-empty string
  13. `atomicityJustificationWordCount` recomputed-vs-authored equality + ≤ `ATOMICITY_WORD_COUNT_MAX` (25)
  14. `phase` ∈ `PHASE_VALUES`
  15. `tier` ∈ `TIER_VALUES`
  16. `cd5_exempt` boolean; if true → non-empty justification string; else null
  17. `proseOnlyEdit` boolean
  18. `fidelityChecklist` has all 6 F-keys, every value `true` at MVP, no extra keys
  19. `contentHash` matches `^sha256:[A-Za-z0-9-]+$`
  20. `lastVersionedAt` matches ISO8601 + parses to a valid Date
- Word-count enforcement is recompute-vs-authored (catches stale counts on edits).
- F1-F6 hard-required `true` at MVP — relaxation requires schema amendment per spec amendment rule.

**Governance:**
- BACKLOG row PRF-G5-CI flipped NEXT → IN PROGRESS with Session 1 accept-criteria detail + S2/S3/S4 sequencing inline.
- STATUS top entry: pending (will write after smart-test-runner verifies zero regressions). Prior PRF-S6 entry preserved in prior-update stack.

## Files I Own (DO NOT EDIT)

*Session is currently IN PROGRESS — but Session 1 scope itself is COMPLETE.* No file lock needed for S2 transition.

If S2 spawns a parallel session before this is committed: lineage.js does NOT exist yet (no conflict). The 3 S1 files are stable; S2 should not touch them other than possibly extending exports from `cardRegistry.js` (e.g., add `MANIFESTS_DIR_PATH` if needed by lineage.js).

## Uncommitted Changes

Created in this session:
- `src/utils/printableRefresher/cardRegistry.js`
- `src/utils/printableRefresher/manifests/prf-math-auto-profit.json`
- `src/utils/printableRefresher/__tests__/manifestSchema.test.js`

Modified in this session:
- `.claude/BACKLOG.md` (PRF-G5-CI row state flip + Session 1 detail)
- `.claude/STATUS.md` (top entry — pending until test verification completes)
- `.claude/handoffs/printable-refresher-session7.md` (this file)

**NOT modified:**
- All 12 Gate 4 design docs — stable.
- `SYSTEM_MODEL.md` — defer to Phase 5 first material implementation; foundation files alone don't yet warrant the section update planned in handoff S6 §System Model Updates Needed.

## What's Next

**S2 (next session) — `lineage.js` + Check 1 + Check 6.**

Concrete S2 deliverables:
1. `src/utils/printableRefresher/lineage.js` exports:
   - `hashUtil(input: string): Promise<string>` — sha256 hex via Web Crypto (`crypto.subtle.digest`); falls back to Node `crypto` in test env. Result format: `sha256:<hex>`.
   - `computeSourceHash(manifest: Manifest): Promise<string>` — per spec §Check 1 mechanism: `sha256(bodyMarkdown + sourceUtils[].hash + generatedFields[].serialized_output)`. Stable-stringify each piece.
   - `derive7FieldLineage(manifest: Manifest, runtime: { engineVersion, appVersion }): LineageFooterFields` — 7-field per red line #12.
   - `printFooter(lineage: LineageFooterFields): string` — render the 7 fields as a string block (will also be used by S2 lineage.test.js + future PRF-G5-LG.test.jsx).
2. Extend `__tests__/contentDrift.test.js` (new file) with:
   - **Check 1**: `manifest.contentHash` must equal `await computeSourceHash(manifest)` UNLESS `getSchemaVersionChange()` says schemaVersion bumped in-PR. S1's stub manifest will FAIL until its hash is recomputed by S2 — this is the load-bearing escape hatch for foundation; S2 must update the stub hash to a real value so Check 1 passes for the auto-profit card. The placeholder string is intentionally chosen so a missing-recompute is loud.
   - **Check 6**: `derive7FieldLineage()` returns 7 non-null strings (or null only on `bucketDefinitionsCited`) for every manifest.
3. `__tests__/lineage.test.js` — `hashUtil` byte-stability across runs + correct format + handles empty input.

**Important S2 gotcha:** `getSchemaVersionChange()` requires `git` access during test runs. The implementation should be a thin wrapper around `child_process.execSync('git show HEAD:<path>')` or use `simple-git` if already a dependency. In the absence of git history (first commit, fresh clone), default to "no prior version" → cannot detect bumps → falls back to "hash mismatch always fails." Confirm this fallback is acceptable for first-commit case; spec assumes prior versions exist.

**S3, S4 — see BACKLOG row.**

**Recommended Phase 5 sequencing reminder (per S6 handoff):**
After PRF-G5-CI fully closes (4 sessions), proceed to: (2) PRF-G5-MIG → (3) persistence + selectors → (4) RL/RI/DS/LG test scaffolds → (5) PRF-G5-B Phase B Math Tables → (6) Q5 demo → (7) PRF-G5-A → (8) PRF-G5-C → (9) PRF-G5-PDF.

## Gotchas / Context

1. **`import.meta.glob` works in Vitest because Vitest uses Vite's transformer.** No special setup needed. Verified empirically — schema test green on first run. If a future engineer migrates the project off Vite (unlikely), this loader needs replacement.

2. **JSON manifests vs JS manifests.** Spec specifies JSON. JSON is preferred because: (a) simpler diff review at PR time, (b) no accidental computation in manifest content, (c) easier to author with editor-side schema validation. The schema test enforces shape; JSON is the format. Do not migrate to JS modules later — this is a deliberate doctrine choice.

3. **Filename↔cardId convention is `lowercase(cardId).json`.** Strictly enforced by schema test #2. Hyphens preserved. No special characters, no dollar signs (the spec sketch's `preflop-open-co-100bb-$2-$5.json` was illustrative; real filenames must be path-safe across Windows + macOS + Linux + git). Future cards must follow.

4. **`atomicityJustificationWordCount` is recomputed-vs-authored.** Authoring a manifest with a stale word count fails the schema test. This is by design — H-PM05 atomicity is load-bearing for paper artifacts; the count is a forcing function on author discipline. Word-count semantics: `text.trim().split(/\s+/).filter(Boolean).length`. Hyphenated words count as one ("auto-profit" = 1 word).

5. **F1-F6 fidelity checklist must all be `true` at MVP.** This is non-negotiable per Gate 4 §Acceptance Criteria + Voice 3 F4/F6. The schema test enforces. If a Phase A/B/C card cannot honestly mark all 6 as `true`, the card MUST be redesigned or removed — not shipped with `false` flags.

6. **`contentHash` placeholder convention.** S1 uses `sha256:stub-pending-PRF-G5-CI-S2-recomputation` so the placeholder is loudly identifiable in CI failures. S2 MUST recompute via `computeSourceHash()` and write the real hash before Check 1 enables. Future stub manifests authored ahead of their content-finalization should follow this pattern (`sha256:stub-pending-<phase-tag>-recomputation`). When `contentHash` matches `/^sha256:stub-pending-/`, future Check 1 should treat as a hard failure even with schemaVersion bump — this is the "do not ship stubs to main" guard. Add this guard at S2 implementation time.

7. **No `cardRegistry` cache invalidation needed in test.** `import.meta.glob` resolves at module load; vitest spawns workers per test file but each worker re-evaluates modules — manifest changes between test files within a single test session pick up correctly. No additional cache flush logic.

8. **`sourceUtils` empty array is the spec-blessed pass-through case for auto-profit.** Future Phase B cards (geometric / pot-odds / implied / binomial / SPR zones) will likely all have `sourceUtils: []` because the math is rake-agnostic + theory-only. Phase A preflop cards WILL have non-empty `sourceUtils` (preflop chart util references). Phase C equity cards need `bucketDefinitionsCited` (per spec §Out of scope §Glossary prerequisite).

9. **Pre-commit hook risk.** This session adds JSON files under `src/utils/printableRefresher/manifests/`. If pre-commit hooks try to lint the JSON or the directory, they may complain about no eslint config matching `manifests/*.json`. Check `.eslintignore` / `.eslintrc.json` patterns at first commit time. Add `manifests/` to .eslintignore if needed (linting JSON content adds no value).

10. **`smart-test-runner.sh` wiring is deferred to S4.** S1 verified green via direct vitest invocation. S4 must add `contentDrift.test.js` (the assembled file by S4) to `smart-test-runner.sh`'s mandatory pre-commit gate per spec §Phase 5 implementation checklist.

## System Model Updates Needed

Defer to S2/S3/S4 once `lineage.js` + the full `contentDrift.test.js` exist. At that point `SYSTEM_MODEL.md` should grow:
- New util namespace `src/utils/printableRefresher/` with subtree: `cardRegistry.js`, `lineage.js` (S2), `stalenessDiff.js` (post-S4), `manifests/`, `__tests__/`.
- New CI-gate entry: content-drift CI (`contentDrift.test.js`) per spec §Relationship to other CI gates.

Bigger updates (new view, new IDB stores, new reducers) wait for the persistence + UI implementation steps later in Phase 5 sequencing.

## Test Status

Direct vitest run: **23/23 passing** for `manifestSchema.test.js`.

Full smart-test-runner: **7307 passing / 2 failing / 280 files**.
- **Failure 1** — `drillContent/__tests__/precisionAudit.test.js`: known pre-existing flake. Unchanged across all PRF sessions per S6 handoff. Not regression.
- **Failure 2** — `exploitEngine/__tests__/gameTreeDepth2.test.js > computeCallDepth2EV > returns correct shape`: test-timeout-in-15000ms in the full run. **Verified environmental** by re-running the file in isolation — 36/36 pass in 20.20s with the shape test taking ~5.9s (well under the 15s timeout when not under parallel-runner load). My S1 changes are pure additions to a new `src/utils/printableRefresher/` namespace + cannot affect exploitEngine code. The full-run hit a load-related timeout, not a logic issue.

**Zero regressions introduced by S1.** Test counts changed from S6 baseline 7238/7239 → 7307/7309 (deltas reflect parallel work between S6 and S7 + my +23 schema tests). Net: same baseline-flake-and-environmental-timeout pattern that's been stable through PRF design phases.
