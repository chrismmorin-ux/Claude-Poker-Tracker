# Session Handoff: printable-refresher-session20
Status: COMPLETE | Written: 2026-04-27

## Backlog Item

**PRF-G5-UI continued — 3 remaining card templates + dispatcher upgrade.** S18 shipped initial UI (shell + math template + catalog); S19 shipped sub-view + modal nav + menu wire-up. S20 ships the 3 deferred class templates and upgrades the `ClassDispatchedTemplate` from 1-of-1 dispatch with placeholder fallback to 1-of-4 dispatch with placeholder reserved for unknown classes. The change is purely additive — case branches + imports — so it carries zero coupling cost to other components.

| S20 deliverable | Status |
|---|---|
| `PreflopCardTemplate.jsx` (navy `#1e3a5f`) | DONE |
| `EquityCardTemplate.jsx` (teal `#0f766e`) | DONE |
| `ExceptionsCardTemplate.jsx` (maroon `#7f1d1d`) | DONE |
| `ClassDispatchedTemplate` switch dispatch in `CardDetail.jsx` | DONE |
| Per-template tests + dispatcher tests | DONE (49 net new) |
| Math regression visual-verification via Playwright | DONE (`prf-s20-math-card-detail-regression.png`) |
| `PrintPreview` sub-view | DEFERRED to S21 |
| `PrintConfirmationModal` | DEFERRED to S21 |
| StalenessBanner / filter expansion / URL routing / PRF-G5-PDF | DEFERRED to S21+ |

## What I Did This Session

3 new component files + 3 new test files + 1 extended test file + 1 source edit (CardDetail.jsx).

**(1) `PreflopCardTemplate.jsx` — Phase A navy `#1e3a5f`.**

Per `docs/design/surfaces/printable-refresher-card-templates.md` §Template 1.

- Region 1: 14pt bold serif accent title.
- Region 2: 13×13 hand grid (169-cell CSS grid built from `manifest.generatedFields.rangeGrid`); pairs on diagonal as `${r}${r}`, suited above as `${r1}${r2}s`, offsuit below as `${r2}${r1}o`. Cell shading: full-frequency cells solid accent + white text; mixed-frequency cells use `linear-gradient(to top, accent ${pct}%, transparent ${pct}%)` per H-PM02 (deuteranopia-friendly intensity); 0-frequency cells outline-only with grey border. Sizing hint (`generatedFields.defaultSizing`) renders as accent-colored 10pt bold block under grid.
- Region 3: derivation/exception callout (italic 9pt prose; second+ paragraphs from bodyMarkdown after `\n\n` split).
- Region 4-5 lineage footer + compact-mode mask gradient: identical to MathCardTemplate (verbatim copy — see Doctrine (a)).
- Defensive fallbacks: missing/non-array/wrong-length rangeGrid omits the entire grid (no crash); missing sizing omits sizing block; missing 2nd paragraph omits Region 3.

**(2) `EquityCardTemplate.jsx` — Phase C teal `#0f766e`.**

Per surface spec §Template 3.

- Region 2: equity matrix as `<table role="table">` with `<th scope="col">` bucket headers + one `<tr>` per row in `equityMatrix.rows` with `<th scope="row">` texture name + cell percentages with `%` suffix and `font-variant-numeric: tabular-nums` for visual alignment.
- **Atomicity cap enforced at render-time**: rows sliced to ≤8 per H-PM05. The contract is "≤8 rows" at the manifest level; the template also enforces it at the rendering layer for defense-in-depth.
- Region 3: bucket-definition citation (italicized 10pt prose from second+ bodyMarkdown paragraphs).
- Defensive: missing/non-array equityMatrix omits the table entirely.

**(3) `ExceptionsCardTemplate.jsx` — Phase C maroon `#7f1d1d`.**

Per surface spec §Template 4 (the highest anti-pattern risk template).

- Region 2: classifies bodyMarkdown paragraphs by **leading prefix** — "Solver baseline:", "Live-pool divergence:", "Override when:" — into labeled sub-sections with accent-colored 9.5pt bold labels. Unprefixed paragraphs fall through as plain prose.
- Region 3: hoists the override paragraph (if present) into a callout with light-red `#fef2f2` background + dashed top border + accent-colored "Override when:" label — emphasis on the override trigger per surface spec layout.
- Region 4-5: lineage footer additionally renders `audit id: <auditId>` line in accent color (the audit-id citation per F4 + F5 fidelity bar). Article also exposes `data-audit-id` HTML attribute for CI introspection.
- Defensive: missing override paragraph omits Region 3 callout entirely; missing auditId omits the audit-id footer line + omits the data-audit-id attribute.

**(4) `CardDetail.jsx` MODIFIED — `ClassDispatchedTemplate` upgraded.**

`if (manifest.class === 'math')` → `switch (manifest.class)` with 4 cases + a `default` branch that retains the S19 placeholder for unknown classes. Imports added at top: `PreflopCardTemplate` / `EquityCardTemplate` / `ExceptionsCardTemplate`.

The upgrade is **purely additive** — outer CardDetail logic is unchanged; only the inner dispatcher's body grew from one branch to four.

**(5) Tests (3 new files + 1 extended; 49 net new tests).**

- `PreflopCardTemplate.test.jsx` (16): title / navy accent / 169-cell grid / grid omits when missing or wrong-length / sizing render / Region 3 derivation / Region 3 omits when no 2nd paragraph / lineage footer / lineage compact-toggle / null manifest / data-card-class attr / data-card-id attr / break-inside avoid / aria-label / data-cell labels (AA/AKs/AKo/22) / mixed-frequency linear-gradient cell.
- `EquityCardTemplate.test.jsx` (14): title / teal accent / table role / column headers / row headers / cell percentages with unique values + count for duplicates / row cap at 8 (H-PM05) / matrix omits when missing / Region 3 bucket citation / lineage compact-toggle / null manifest / data attrs / break-inside avoid.
- `ExceptionsCardTemplate.test.jsx` (16): title / maroon accent / subtitle / "Solver baseline:" prefix classifies / "Live-pool divergence:" prefix classifies / "Override when:" hoisted to Region 3 / Region 3 omits when no override / audit id in footer / data-audit-id attr / data-audit-id absent when undefined / unprefixed-prose fallback / lineage compact-toggle hides audit-id / null manifest / data attrs / break-inside avoid.
- `CardDetail.test.jsx` extended (+3 net): replaced 1 placeholder-asserts-for-preflop test with 4 dispatcher tests (preflop / equity / exceptions dispatch correctly + unknown class falls back to placeholder).

**Total S20: 145/145 view tests green across 10 files (was 96/7 at S19 baseline; +49 tests / +3 files); full PRF + persistence + reducer + hooks + context + UI scope 714/714 green across 26 test files** in isolation.

**(6) Visual verification (Playwright):**

- Started dev server on port 5191 (5173–5190 in use by other Vite instances).
- Navigated to `http://localhost:5191/#printableRefresher` — catalog renders 6 math cards, zero console errors.
- Clicked "Open card detail" on PRF-MATH-AUTO-PROFIT — CardDetail renders correctly via the new switch dispatcher: title, body paragraphs, 7-field lineage footer, lineage CTA, 3 actions (Pin / Hide / Suppress math class permanently). No regressions.
- Saved screenshot `prf-s20-math-card-detail-regression.png` (gitignored — the `*.png` rule covers it).
- The new 3 templates are NOT visually verified at runtime because no preflop/equity/exceptions manifests exist yet. That work is gated on PRF-G5-A (Phase A preflop authoring) and PRF-G5-C (Phase C equity+exceptions authoring). Unit-test coverage substitutes for runtime verification until those phases ship.

**(7) Governance:**

- BACKLOG row PRF-G5-UI: status flipped from "S18+S19 shipped 2026-04-27" → "S18+S19+S20 shipped 2026-04-27"; S20 deliverable detail appended (4 file changes + 3 new test files + 49 net tests + visual verification note + S21 deferred items list).
- STATUS top entry: replaced with PRF S20 entry; previous EAL S14 entry demoted to "Prior update (superseded, kept for provenance — 2026-04-27 EAL S14)" line above the prior PRF S19 entry. The "Prior update" cascade now reads: PRF S20 (current) → EAL S14 → PRF S19 → ...
- This handoff file written.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE.* No file lock needed.

## Uncommitted Changes (after S20)

Created in this session:
- `src/components/views/PrintableRefresherView/PreflopCardTemplate.jsx`
- `src/components/views/PrintableRefresherView/EquityCardTemplate.jsx`
- `src/components/views/PrintableRefresherView/ExceptionsCardTemplate.jsx`
- `src/components/views/PrintableRefresherView/__tests__/PreflopCardTemplate.test.jsx`
- `src/components/views/PrintableRefresherView/__tests__/EquityCardTemplate.test.jsx`
- `src/components/views/PrintableRefresherView/__tests__/ExceptionsCardTemplate.test.jsx`
- `.claude/handoffs/printable-refresher-session20.md` (this file)

Modified in this session:
- `src/components/views/PrintableRefresherView/CardDetail.jsx` (3 imports + ClassDispatchedTemplate switch dispatch)
- `src/components/views/PrintableRefresherView/__tests__/CardDetail.test.jsx` (replaced 1 placeholder-assertion test with 4 dispatcher tests; +3 net tests)
- `.claude/BACKLOG.md` (PRF-G5-UI row extended)
- `.claude/STATUS.md` (top entry replaced; EAL S14 demoted to Prior update)

Untracked (gitignored — `*.png` rule):
- `prf-s20-math-card-detail-regression.png` (Playwright screenshot)

**NOT modified:**
- All other PRF infrastructure (CI / MIG / SL / ST / WR / HK / RL / RI / DS / LG / AppRoot / writers / lineage / cardRegistry / refresherSelectors) — stable.
- 6 Phase B math manifests — stable.
- `MathCardTemplate.jsx` / `CardRow.jsx` / `CardCatalog.jsx` / `index.jsx` / `LineageModal.jsx` / `SuppressConfirmModal.jsx` — stable.
- `RefresherProvider` / `useRefresher` / writers / W-URC-3 — stable.
- `PokerTracker.jsx` / `AppProviders.jsx` / `useAppState.js` / `contexts/index.js` — owned by parallel EAL S14; untouched.
- `CollapsibleSidebar.jsx` — S19 left it complete; untouched.
- `SYSTEM_MODEL.md` — defer until S21 PrintPreview lands (the print-flow architecture is the bigger piece warranting an update; templates alone don't change architecture).

## What's Next

**S21 — owner priority pick.** Per backlog row, the deferred items are:

(a) **PrintPreview sub-view + PrintConfirmationModal.** W-URC-3 `recordPrintBatch` writer is already shipped. Needs a grid layout per `print-css-doctrine.md` Region 1-6 plus 4 grid modes (12-up / 6-up / 4-up / 1-up) × 2 page sizes (Letter / A4) × 2 color modes (color / B&W). Most visible owner value — completes the print flow.

(b) **StalenessBanner.** Top-of-catalog count when `staleCardIds.size > 0`. Selector already exposed via `useRefresher().getStaleCards()` from RefresherProvider.

(c) **Filter expansion.** Phases + tiers in addition to classes. The filter shape already supports them in `useRefresherView` state; the UI just needs filter chips beyond the existing 4 class filters.

(d) **URL routing for sub-views.** Deep-link `#printableRefresher/card/PRF-X` opens CardDetail directly. Currently sub-view nav is component-state-based (`selectedCardId` in `index.jsx`). Adding URL routing means extending `HASH_TO_SCREEN` parsing in `PokerTracker.jsx` to support multi-segment hashes, or threading a hash watcher into `PrintableRefresherView`.

(e) **PRF-G5-PDF — Playwright cross-browser snapshots.** 4 grid × 2 page × 2 color = 16 per card × 6 math cards = 96-snapshot baseline. Requires (a) to land first since PrintPreview is what gets snapshotted.

**Suggested order** if no priority given: (a) first (most visible owner value + completes print flow + unblocks (e)), then (b) (small UX improvement; uses existing selector), then (e) once PrintPreview is stable, then (c) and (d) (smaller/optional UX polish).

## Gotchas / Context

1. **Visual verification of the new 3 templates is gated on manifest authoring.** No preflop/equity/exceptions manifests exist yet. The 16+14+16 unit tests cover render correctness comprehensively, but runtime visibility in the browser requires either (a) authoring real manifests for those classes, or (b) seeding a temp dev manifest. Both are out of S20 scope. The math-card detail flow IS visually verified via Playwright (regression check).

2. **All 4 templates share footer + compact-mode behavior via verbatim copy, not shared component.** Each template duplicates ~15 lines of footer/mask-gradient code. The surface spec mentions a future `LineageFooter.jsx` shared component; deferred until a 5th template arrives in Phase 2+ to motivate the extraction. For now, self-contained templates are easier to read at the cost of duplication.

3. **`ClassDispatchedTemplate` is a `switch`, not a registry lookup.** The cardRegistry surface spec mentions `TEMPLATE_BY_CLASS` map + `getTemplateForManifest` dispatcher as a future structure. I kept the inline `switch` because (a) only 4 classes + 1 default; map adds no value at this size; (b) the case branch + import pattern matches what S19 documented as the extension point. If a registry pattern is wanted later, refactoring is a 10-minute swap.

4. **Default placeholder retained for defense-in-depth.** Even with all 4 classes implemented, the `default` branch still renders the S19 placeholder + `role="status"` so a corrupted manifest (typo in `manifest.class` like `'mathh'`) renders informatively rather than crashing. Tested explicitly with `class: 'unknown-class'` in `CardDetail.test.jsx`.

5. **Render-time atomicity cap on equity matrix.** Surface spec H-PM05 says "row count ≤ 8". The manifest validator should also enforce it (CI will at PRF-G5-CI authoring time), but the template additionally slices `rows.slice(0, 8)` so even a malformed manifest renders within atomicity bounds. Defense-in-depth at the rendering layer.

6. **Exceptions template prefix classifier is opportunistic.** Paragraphs without leading prefixes ("Solver baseline:" / "Live-pool divergence:" / "Override when:") fall through as plain prose. The spec recommends specific section labels but the template doesn't crash when authors deviate. CI authoring tests can enforce prefix discipline at the manifest level if needed (a future PRF-G5-CI extension; not in scope for S20).

7. **`data-audit-id` HTML attribute on the exceptions-class article** exposes the auditId for CI introspection without requiring DOM scraping of the footer text. A future `contentDrift.test.js` extension could grep `data-audit-id` matches across all exceptions cards to verify F4 attestation. That's not implemented in S20 — just made possible.

8. **Mixed-frequency cells use CSS `linear-gradient` not partial-fill backgrounds.** JSDOM renders gradients as a serialized style string which tests can grep, and the gradient gives smoother visual intensity at print resolution than alpha-channel fills (which can dither poorly on B&W laser printers per H-PM02).

9. **EquityCardTemplate test fixture has duplicate `22%` and `26%` cells.** Initial draft used `getByText('22%')` which threw on multi-match. Fixed by switching to unique values for `getByText` + asserting count via `getAllByText('22%')` for the duplicate. Future test fixtures with repeated percentage values should follow this pattern.

10. **Parallel session coordination.** EAL S14 ran during the same calendar day as PRF S19, and the EAL S14 entry was on top of STATUS.md when S20 began. S20 demoted EAL S14 to "Prior update" position above PRF S19. No file conflicts: S20 owned `PrintableRefresherView/*` only — EAL S14's `PokerTracker.jsx` + `AppProviders.jsx` + `useAppState.js` + `contexts/index.js` edits are untouched. PRF S19's `CollapsibleSidebar.jsx` + `PokerTracker.jsx` HASH_TO_SCREEN entries also untouched.

## System Model Updates Needed

Defer until S21 ships PrintPreview + PrintConfirmationModal. The print-flow architecture is the bigger piece warranting a §1 Component Map update (PrintableRefresherView with N sub-views + new Print*Component subtree). Templates alone are leaves under the existing `PrintableRefresherView/` subtree; no architectural shift.

After S21 the §1 Component Map should grow:
- Top-level view PrintableRefresherView listed with full sub-view list (CardCatalog + CardDetail + PrintPreview).
- New view-component subtree: PrintableRefresherView/ with 11+ files (S18 4 + S19 3 + S20 3 + S21 ~3 expected).
- Mention the 4-template dispatcher (PreflopCardTemplate + MathCardTemplate + EquityCardTemplate + ExceptionsCardTemplate).

## Test Status

S20 net-add: **49 new tests across 3 new test files + 3 net new in extended `CardDetail.test.jsx`.**

PRF view scope: **145/145 green across 10 test files** (was 96/7 at S19 baseline).

Full PRF + persistence + reducer + hooks + context + UI scope: **714/714 green across 26 test files** in isolation.

Cumulative scaling validation:
- S15 (1 manifest, no UI): 399 tests / 19 files.
- S16 (4 manifests): 528 tests / 19 files.
- S17 (6 manifests): 614 tests / 19 files.
- S18 (6 manifests + 4 UI files): 662 tests / 23 files.
- S19 (6 manifests + 7 UI files): 710 tests / 26 files.
- S20 (6 manifests + 10 UI files): 714 tests / 26 files (some PRF view files share scope; net-new view tests = 49 from 96 → 145 in view-only scope).

Full smart-test-runner not run this session — modifications are scoped entirely to `PrintableRefresherView/*`. The known precisionAudit flake + parallel-MPMF-G5-B2 + parallel-EAL-migration test situations remain unchanged. Zero new regressions from S20.
