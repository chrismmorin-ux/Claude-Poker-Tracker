# Session Handoff: printable-refresher-session6
Status: COMPLETE | Written: 2026-04-25

## Backlog Item

**Gate 4 CLOSED.** All 12 carry-forwards complete. Final infrastructure batch (CSS + MIG) shipped. Project moves to Gate 5 (Implementation) with PRF-G5-CI as the non-negotiable prerequisite for card authoring.

Backlog IDs closed this session: **PRF-G4-CSS / PRF-G4-MIG** (2 rows → COMPLETE). Gate 4 row count: 12 of 12 COMPLETE.

## What I Did This Session

Two final infrastructure docs authored, closing Gate 4.

**PRF-G4-CSS — `docs/projects/printable-refresher/print-css-doctrine.md`:**
- **Forbidden mechanisms enumerated first:** `html2canvas` + `jspdf` + `pdf-lib` + background images + web fonts + animations + color-only encoding + body backgrounds banned. Bundle-import CI-grep at `scripts/check-refresher-bundle.sh` enforces.
- **Page geometry:** `@page { size: letter; margin: 0.4in }` default; A4 selectable via `body[data-page-size]` data attribute. 0.4" outer margin gives safety + room for browser-default headers.
- **4 layout grids** with CSS:
  - 12-up (3×4) Letter ~2.5"×2.25" — index-card scale, default per Q4
  - 6-up (2×3) Letter ~3.75"×3.25" — larger, less dense
  - 4-up (2×2) Letter ~3.75"×4.875" — spacious for dense math
  - 1-up (1×1) Letter ~7.5"×10" — single-card poster-style
- **Card-level break prevention:** `break-inside: avoid` + legacy `page-break-inside: avoid` + `overflow: hidden`.
- **Regions 1-6 CSS:** Region 1 title 14pt bold serif accent / subtitle 10pt serif black + Region 2 primary 10pt body or 10pt mono table + Region 3 derivation 9pt with `border-top: 0.5pt solid #888` + Region 4-5 lineage footer 9pt greyscale `#555` (line 1 mono / line 2 serif) + Region 6 card-corner stamp 7pt greyscale `#666` `transform: rotate(-90deg)` absolute-positioned `bottom: 0.30in left: 0.30in` inside the 0.25" safe-trim margin.
- **Typography scale:** 10pt body floor + 8pt table floor + 6pt banned + 7pt corner stamp + 14pt title + 16pt ceiling. Hard floor + ceiling rules documented with rationale.
- **6-hue deuteranopia palette:** navy / burnt-orange / ochre / teal / charcoal / maroon as CSS custom properties. Per-class assignment: preflop=navy / math=burnt-orange / equity=teal / exceptions=maroon. Charcoal + ochre reserved for Phase 2+ classes.
- **Permitted accent uses:** title color, class badge ≤0.5", one ≤0.5pt horizontal rule, line-art icons.
- **Forbidden accent uses:** body text, table-row backgrounds, heatmap fills, large blocks visible across table.
- **B&W fallback:** `body[data-color-mode="bw"]` toggle forces 6 hues to `#000`. Auto mode lets browser greyscale; Playwright snapshot at B&W mode for every MVP card verifies all 4 categories distinguishable in greyscale.
- **`@media print` doctrine:** animation kill (`animation-duration: 0s !important`); `.print-preview-container` wrapper applies print rules unconditionally on screen for WYSIWYG verification — preview must equal print output.
- **Browser headers/footers:** suppressed via empty `@page { @top-left {} ... }` rules + `PrintConfirmationModal` UI cue to disable browser headers (S1 §A6).
- **Cross-browser test matrix:**
  - Chrome / Chromium primary — Playwright `page.pdf()` deterministic ground truth.
  - Firefox secondary — CSS grid rasterization issue at <10pt; H-PM01 floor accommodates.
  - Safari tertiary — legacy `page-break-inside` needed (covered) + `@page` margin variance; manual print-dialog QA at PR review.
  - Edge implicit Chromium / Mobile Chrome implicit / Mobile Safari out-of-scope Phase 1.
- **PRF-G5-PDF snapshot contract:** 4 grids × 2 page sizes × 2 color modes = 16 snapshots per MVP card. Byte-exact comparison fails on any rendering drift; regeneration requires `--update-snapshots` + reviewer verification.
- **Phase 5 implementation checklist:** 10 items.

**PRF-G4-MIG — `docs/projects/printable-refresher/idb-migration.md`:**
- **Coordination rule (Q6):** `TARGET_VERSION = max(currentVersion + 1, 18)`. Collision-free with Shape Language v18 claim + future MPMF claims; whichever project ships first claims v18, others bump.
- **Store 1 — `userRefresherConfig`:**
  - Keypath `id: 'singleton'`, no autoincrement, no indexes, single record.
  - Record shape v1 documented (cardVisibility / suppressedClasses / printPreferences / notifications / lastExportAt).
- **Store 2 — `printBatches`:**
  - Keypath `batchId: UUID v4`, no autoincrement, single index `printedAt`.
  - Record shape v1 documented (batchId / printedAt / label / cardIds / engineVersion / appVersion / perCardSnapshots / schemaVersion).
  - Append-only per I-WR-5; W-URC-3 only writer.
- **Migration code sketch:**
  - `migrateRefresherStores(db, oldVersion, newVersion)` — additive overlay.
  - `buildDefaultRefresherConfig()` — default singleton with Phase 1 structural defaults.
  - `openRefresherAwareDb()` — `indexedDB.databases()` lookup for current version + dynamic target computation.
- **Critical migration properties:**
  1. Existence-check before create — idempotent.
  2. Singleton seeded at migration time — avoids "create-on-first-read" branch in writers.
  3. `printBatches` NOT seeded — empty until first owner print.
  4. Existing v17 stores untouched — additive-only.
- **Default singleton structural Phase 1 settings:**
  - `cardVisibility: {}` empty
  - `suppressedClasses: []` empty
  - `printPreferences.pageSize: 'letter'` (Q4)
  - `printPreferences.cardsPerSheet: 12` (Q4)
  - `printPreferences.colorMode: 'auto'`
  - `printPreferences.includeLineage: true` (red line #12)
  - `printPreferences.includeCodex: false` (Phase 1 structural; AP-PRF-09 + Q7)
  - `notifications.staleness: false` (AP-PRF-08 opt-in default OFF)
  - `lastExportAt: null`
- **6 PRF-G5-MIG test cases:**
  1. Round-trip — fresh v17 → v18+ creates both stores.
  2. Seed correctness — singleton matches `buildDefaultRefresherConfig()`.
  3. Idempotent — re-running migration preserves existing data.
  4. No v17 mutation — byte-equal snapshot of v17 stores after migration.
  5. Index — `printBatches.printedAt` index present.
  6. Collision-resolution — Shape Language pre-claim of v18 → PRF claims v19.
- **PRF-G5-DS shared test:** `suppressedClasses` byte-preservation across simulated v18→v19 bump. Shared test target across migration + writer/reducer layers.
- **I-WR-5 batch-preservation test:** asserts no `printBatches` records lost on migration.
- **Per-record schema versioning framework:** future field additions handled by lazy migration on read with field defaults + `record.schemaVersion` increment on next write. Full IDB version bumps reserved for store-level changes.
- **Backup/export expansion** per EAL precedent §3: both stores included in owner backup; share-with-others variant deferred to Phase 8+.
- **Phase 5 implementation checklist:** 8 items.

**Governance:**
- **BACKLOG:**
  - PRF-G4-CSS + PRF-G4-MIG flipped NEXT → COMPLETE with detailed accept-criteria.
  - Section header updated: "Gate 4 CLOSED 2026-04-25 — all 12 carry-forwards COMPLETE."
  - Section footer rewritten with 8-step Phase 5 sequencing recommendation.
  - PRF-G5-* row dependencies updated: PRF-G5-CI/A/B/RL/RI/DS/LG flipped from BLOCKED-by-G4-* to NEXT-Phase-5-prerequisite. PRF-G5-MIG row added for migration test suite. PRF-G5-C still BLOCKED by PRF-G5-B + bucket-definition glossary. PRF-G5-PDF still BLOCKED by PRF-G5-A+B (need cards to snapshot).
- **STATUS.md:** new top entry (full detail inline). My prior PRF S5 entry preserved in prior-update stack. No parallel sessions detected this turn.
- **Charter:** status line updated to "Gate 4 CLOSED 2026-04-25". Gate 4 closure checklist all 12 checked. Decisions Log gained 2 new entries:
  - **Gate 4 closure entry** — full inventory of 12 carry-forwards + project artifact count (12 docs: 5 in `docs/design/` + 7 in `docs/projects/printable-refresher/`).
  - **Gate 5 sequencing finalized entry** — 8-step recommended Phase 5 order with PRF-G5-CI as non-negotiable first step.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE — no files owned.* Both docs in stable state. Gate 4 is closed; next session enters Phase 5 (implementation).

## Uncommitted Changes

Created in this session:
- `docs/projects/printable-refresher/print-css-doctrine.md`
- `docs/projects/printable-refresher/idb-migration.md`

Modified in this session:
- `docs/projects/printable-refresher.project.md` (status line + Gate 4 closure checklist all-checked + 2 Decisions Log entries)
- `.claude/BACKLOG.md` (2 row state changes + Gate 5 row dependency updates + new PRF-G5-MIG row + section header + section footer rewritten)
- `.claude/STATUS.md` (top entry + prior-update preservation of my PRF S5 entry)

**NOT modified by this session:**
- All other Gate 4 docs (ACP / AP / CD / H / S1 / S2 / J / W / CI / SL) — shipped in prior sessions; no changes needed.
- CATALOG.md — no new surfaces this session (CSS is a doctrine doc; MIG is a persistence spec — neither is a UI surface).
- Other projects' files.

## What's Next

**Gate 5 (Implementation) NEXT-ready.** This is the transition from design-only to code-and-design.

**Mandatory sequencing — Phase 5 starts with PRF-G5-CI:**

The content-drift CI test + supporting infrastructure (`cardRegistry.js` + `lineage.js` + `stalenessDiff.js`) MUST ship green in main BEFORE any card-authoring PR merges. This is non-negotiable per `content-drift-ci.md` spec; the CI is the autonomy guarantee for paper permanence (red lines #10 + #12).

**Recommended Phase 5 order:**

1. **PRF-G5-CI** — implement the 6 CI checks per `content-drift-ci.md` spec. Author `cardRegistry.js` (manifest loader via `import.meta.glob`), `lineage.js` (`computeSourceHash`, `hashUtil`, `printFooter`, `derive7FieldLineage`), `stalenessDiff.js`, `manifestSchema.test.js`, `contentDrift.test.js`. Verify CI catches an intentionally-drifted manifest before proceeding.
2. **PRF-G5-MIG** — implement migration per `idb-migration.md` spec. 6 test cases all green.
3. **Persistence + selector wiring** — `useRefresherConfig` (IDB-backed) + `useRefresherView` (localStorage) + 6 selectors (`selectAllCards` / `selectActiveCards` / `selectPinnedCards` / `selectSuppressedCards` / `selectCardsForBatchPrint` / `selectStaleCards`) per `selectors.md`. Writer registry per `WRITERS.md` (W-URC-1/2/3) + `scripts/check-refresher-writers.sh` CI-grep + bundle-import check `scripts/check-refresher-bundle.sh`.
4. **PRF-G5-RL + PRF-G5-RI + PRF-G5-DS + PRF-G5-LG test scaffolds** — red-line / reducer-boundary / durable-suppression / lineage-footer test files. These can scaffold even before MVP cards exist (most assertions don't need card content).
5. **PRF-G5-B Phase B Math Tables** — clear-starting-point card authoring. 6 cards: auto-profit / geometric / pot-odds / implied / binomial / SPR zones. Author manifests in `manifests/` directory; `MathCardTemplate.jsx` renders. Each card clears 6-point fidelity bar at author time + `cardFidelityCheck()` review.
6. **Q5 differentiation demo at design review.** Author `PreflopCardTemplate.jsx` + one Phase A preflop sample card (e.g., `PRF-PREFLOP-OPEN-CO-100BB-2-5`). Compare visually to Upswing free pack at design review with owner. Owner decides Phase A go/no-go.
7. **PRF-G5-A Phase A Preflop** — conditional on Q5 verdict. 3 cards: #1 + #10 + #16 (preflop-open + pure-plays + ICM-bubble-push-fold).
8. **PRF-G5-C Phase C Equity + Exceptions** — last; per-card Voice-3-equivalent fidelity review at PR time. Equity cards depend on bucket-definition glossary (must exist first — author at Phase C prep).
9. **PRF-G5-PDF Playwright cross-browser snapshots** — once MVP cards exist. Snapshot matrix per `print-css-doctrine.md` §Cross-browser test matrix.

**Phase 1 MVP card count target: 10-13 cards** (6 Phase B + 0-3 Phase A conditional + 4 Phase C).

## Gotchas / Context

1. **Gate 4 took 6 sessions; expect Phase 5 to take 6-12 sessions or more.** Phase 5 is the first time code lands. The 12 design docs constitute ~4500 lines of spec; turning them into ~18 implementation files + 6 test suites + 10-13 card manifests is substantial. Don't try to ship Phase 5 in one session — break it into the 9 steps above.

2. **PRF-G5-CI is the most important Phase 5 step.** It's the load-bearing autonomy gate. If a future session is impatient and tries to ship Phase B math tables before contentDrift.test.js is green, refuse + redirect. The spec says "ratified BEFORE Gate 5 card authoring" — that means the test must be implemented + green in main, not just spec-shipped.

3. **Q6 dynamic version target needs runtime detection.** `indexedDB.databases()` is supported in Chrome/Edge/Firefox but partially in Safari (~iOS Safari may return undefined). The spec assumes the API is available; Phase 5 implementer may need a fallback (e.g., probe-open at v17, catch upgrade, abort, then open at computed target). Document the fallback at implementation time if needed.

4. **The `printBatches.printedAt` index is non-optional.** `selectStaleCards` queries by `printedAt DESC` for the most-recent-batch-per-card rule. Without the index, the query falls back to full-store scan + per-card filter — O(N×M) where N = batches and M = cards. With the index, query is O(log N + M). Phase 5 implementer must verify the index is created at migration time (test case #5 covers).

5. **B&W fallback is verifiable but not bulletproof.** The 6-hue deuteranopia palette is selected for distinguishability under deuteranopia simulation + greyscale conversion. Browser/printer color management can still produce flatter greyscale tones than expected. Phase 5 Voice-3-equivalent reviewer manually inspects B&W output of every MVP card before merge.

6. **`scripts/check-refresher-bundle.sh` is a separate CI gate from `scripts/check-refresher-writers.sh`.** Both run at PR time. Bundle-grep catches forbidden rasterization libraries; writer-grep catches unregistered IDB writes. Different scopes; complementary; both blocking on violation.

7. **Phase 5 writers should debounce per writer per WRITERS.md spec, not globally.** W-URC-1 debounces 400ms (config preference toggles); W-URC-2 immediate (deliberate user actions); W-URC-3 immediate on confirm. Don't introduce a global debounce wrapper that flattens these distinctions.

8. **Migration test #6 simulates Shape Language v18 pre-claim — implement carefully.** `fake-indexeddb` doesn't natively support multi-database concurrency, so the test needs to seed an IDB at v18 with the Shape Language stores added (or stub `indexedDB.databases()` to return version 18 from the start) and then verify PRF claims v19. The test asserts the dynamic-target rule, not the actual presence of Shape Language stores.

9. **The card-corner stamp at 7pt greyscale rotated -90° has Phase 5 layout risk.** CSS `transform: rotate(-90deg)` works cross-browser, but `transform-origin` + `position: absolute` interaction with `bottom: 0.30in left: 0.30in` may shift slightly between Chrome and Firefox at print-render. Add a Playwright snapshot specifically for the corner-stamp position at Phase 5 to catch positional drift.

10. **No parallel session coordination this turn.** Top entry succession went my PRF S5 → my PRF S6 directly without other projects intervening. If a parallel session lands during Phase 5, expect file conflicts to be more substantial (Phase 5 will touch `src/` files which most other projects also touch).

## System Model Updates Needed

None this session. PRF remains pre-code. **Phase 5 first session MUST update SYSTEM_MODEL.md** when first implementation lands. Cumulative entries needed:
- New top-level view `PrintableRefresherView` (~13th view) with 5 sub-views enumerated.
- New util namespace `src/utils/printableRefresher/` with ~7 modules (index / cardRegistry / selectors / lineage / stalenessDiff / writers / manifests/).
- New IDB version bump (v17 → 18 or 19 per dynamic rule; coordinate with Shape Language).
- New reducer-boundary invariant for Reference-mode write-silence (red line #11) + new `currentIntent` UI reducer field documentation.
- New CI-gate entries: content-drift CI (`scripts/check-refresher-bundle.sh` + `contentDrift.test.js`) + writer-registry CI (`scripts/check-refresher-writers.sh`).
- 4 new card-template components (`PreflopCardTemplate` / `MathCardTemplate` / `EquityCardTemplate` / `ExceptionsCardTemplate`) + 3 shared (`LineageFooter` / `CardCornerStamp` / `CardTitle`).
- 2 new IDB stores (`userRefresherConfig` singleton + `printBatches` UUID-keyed).
- New cross-project doctrine pattern (CC-82 + CC-83 + H-PM07) — consider authoring `.claude/programs/reference-integrity.md` if adoption grows beyond PRF.

## Test Status

No tests run (zero code changes). Pre-session test baseline per STATUS.md prior entries: 7238/7239 (1 pre-existing precisionAudit flake unchanged across all PRF design sessions). No regressions possible — design-doc session.

**Phase 5 implementation will introduce new test files; expect test count to grow significantly across the ~9 Phase 5 steps.**
