# Gate 2 Voice 5 — Senior Engineer + Print-Medium Designer — Printable Refresher

**Date:** 2026-04-24
**Voice:** Senior engineer + print-medium designer
**Stages owned:** D (cross-surface) + E (in-app ML + print-medium heuristics)

## Summary

PRF is tractable on the engineering axis but carries three structural hazards the project should resolve **before Gate 4**: Study Home parent coupling (author now or defer?), content-drift CI (no regression guardrail today catches a rake-config edit invalidating a printed card), and export format (browser-print default is acceptable only if print CSS is treated as a first-class deliverable, not a sidecar). Persistence is small (one store, `userRefresherConfig`). IDB bump v17 → v18 is clean if sequenced with Shape Language's own v17 → v18 claim — **they cannot both ship as v18 independently.** Stage D verdict: ⚠️ YELLOW, three RED risks conditional. Stage E verdict: ⚠️ YELLOW — the printed-artifact heuristic set is novel and under-specified; one-idea-per-card atomicity is the load-bearing unresolved.

## Stage D — Cross-surface + implementation

### D1 — Study Home parent coupling

**Recommendation: D1b — parent-TBD reference; do NOT author Study Home inside PRF.**

Gate 3 Q1 of Shape Language decided Study Home is a cross-project surface (`docs/design/surfaces/study-home.md`, `STUDY-HOME-SURFACE` backlog item). Authoring it inside PRF creates the exact governance problem Q1 argued against: "whose acceptance criteria close the parent?" PRF is a Reference-mode surface; Study Home's layout must also accommodate Deliberate + Discover embeds (Shape Language lessons, Range Lab, Presession Drills, HRP flags). PRF knows one of three needed shapes. Authoring now would hardcode a Reference-mode bias into a surface that must be intent-neutral.

PRF should ship `docs/design/surfaces/printable-refresher.md` with a `parentSurface: 'study-home (pending authorship — first Gate 4 to need it authors)'` field, and the PRF route (`SCREEN.PRINTABLE_REFRESHER`) should be directly linkable without needing Study Home to exist. Standalone-route-plus-future-embed is the correct posture.

### D2 — Persistence footprint

**Recommendation: one new store, `userRefresherConfig`, IDB v17 → v18.**

Card content is derived from existing utils (no storage needed). What DOES need persistence:

```
Store: userRefresherConfig
Keypath: id ('singleton' — one-record store)
Indexes: none (single record)
Record shape:
  id: 'singleton'
  schemaVersion: 1
  cardVisibility: { [cardId]: 'default' | 'hidden' | 'pinned' }
  cardPrintDates: { [cardId]: ISO8601 }   // user-entered "when I printed this"
  customNotes: { [cardId]: string (max 280ch) }
  suppressedClasses: string[]              // card-class-level hide
  lastExportAt: ISO8601 | null
  printPreferences: { pageSize, cardsPerSheet, colorMode, includeLineage }
```

**v17 → v18 conflict.** Shape Language's Gate 3 schema plan also claims v18 (for `shapeMastery` + `shapeLessons`). Both cannot ship as v18 independently. Resolution: whichever project reaches migration-authoring first claims v18; the second claims v19. This is a STATUS.md-level coordination item, not a project-charter-level one. Add to Decisions Log + raise to owner before Gate 4.

**Writer registry (per EAL WRITERS.md precedent):**
- `W-URC-1` — `config-preference-writer` (settings panel updates, debounced 400ms)
- `W-URC-2` — `card-visibility-writer` (per-card hide/pin actions, immediate)
- `W-URC-3` — `print-date-stamp-writer` (user marks "printed today," immediate)

One store, three writers, all owner-initiated, no matcher-system writer because Reference-mode is write-silent on skill state.

### D3 — Build-time vs runtime content generation

**Recommendation: HYBRID, per-card-class.**

| Card class | Strategy | Rationale |
|---|---|---|
| Preflop charts (per-seat × hand) | **Build-time** | Static data in `pokerCore/preflopCharts.js`; no per-session variance. Manifest hash on util content. |
| Equity-bucket tables | **Build-time** | Derived from range definitions + canonical flop textures; deterministic. |
| Geometric-betting / auto-profit / pot-odds formula tables | **Runtime** | Functions of `rakeConfig` + `stakesAssumption` + `effectiveStackAssumption` — all user-adjustable. Build-time would freeze rake at build time. |
| Binomial all-in survival | **Build-time** | Pure combinatorics; no user params. |
| Implied / reverse-implied odds | **Runtime** | Depends on SPR + rake + stack. |
| "Pure plays + exceptions" codex | **Build-time** (content) + **runtime** (lineage stamp) | Markdown-authored content with runtime-verified hash. |
| Postflop texture × hand-type matrices | **Runtime** | Inherits from `exploitEngine/` + villain model — live-tunable. |

Static cards get a `contentHash` baked at build; runtime cards get a `paramFingerprint` (rake + stakes + stack snapshot) computed on render. Both flow into the lineage footer.

### D4 — Print CSS doctrine

**Page size:** US Letter default (8.5×11") + A4 fallback (user-selectable). Index card (3×5") as a separate mode, not a page size — it's a sheet of 3×5 index-card cells laid on Letter.

**Layout:** `display: grid` with `@page { size: letter; margin: 0.4in }`. Default 3×4 grid = 12 cards/sheet at ~2.5"×2.25" finished size; 2×3 grid = 6 cards/sheet at ~3.75"×3.25" (index-card-scale). Crop marks via `::after` pseudo-elements on card corners, toggleable.

**Typography:** Base `12pt` serif for body (Source Serif Pro or system serif); `14pt bold` for card title; `9pt` for lineage footer. Poker-chart tables: monospaced `10pt` (Inconsolata / system mono) for digit alignment. **Hard floor: 8pt** — anything below risks sub-pixel breakage on 300dpi inkjet after lamination glare.

**B&W fallback:** use `prefers-color-scheme` AND a `@media print` override forcing greyscale glyphs + line-art icons. Color is accent-only (one accent hue per card class, surviving greyscale as a tone).

**Page breaks:** `.refresher-card { break-inside: avoid; page-break-inside: avoid }` (both for legacy Safari). `.card-class-section { break-before: page }`.

**Cross-browser.** Chromium is baseline. Firefox print-preview rasterizes CSS grid inconsistently below 10pt — test matrix: Chrome (primary), Firefox (secondary), Safari (tertiary). Playwright `page.pdf()` is deterministic — use it as the CI ground truth.

**Headers/footers:** ship a `@page { @top-left {} @bottom-right {} }` fallback with project name + print date. Browser-chrome headers are out of our control — copy in UI says "disable browser headers for best result."

### D5 — Export format

**Recommendation: browser print → PDF (Ctrl-P) as default; Playwright/`page.pdf()`-style server-side PDF deferred until a user actually asks for it.**

Rationale: browser print is zero-dependency, works on mobile (Chrome Android "Save as PDF"), and honors user's printer config. jsPDF / pdf-lib / html2canvas all degrade print fidelity (raster vs vector text) and add ~200KB+ bundle. html2canvas specifically rasterizes — **forbidden** because poker glyphs at 8-10pt after raster compression are illegible. Static PNG/SVG per card is best quality but worst ergonomics (user has to place and print N images); reserve for a future "designer-quality export" Plus-tier feature.

Decision criterion for revisiting: if a user complains that browser print is breaking layout across >2 browsers in ways we can't fix in CSS, add `page.pdf()` as a server-less export via dynamic-import of pdf-lib.

### D6 — Lineage pipeline

**Every card carries a `lineage` object:**

```
{
  appVersion: 'v123',                          // from package.json at build
  engineVersion: 'v4.7.2',                     // exploit-engine semver (new: add to package)
  sourceUtils: [                               // array, not scalar — cards aggregate
    { path: 'src/utils/pokerCore/preflopCharts.js', contentHash: 'sha256:a3c...' }
  ],
  theorySection: 'POKER_THEORY.md §3.2',
  assumptions: {                               // runtime-bound for dynamic cards
    rakeConfig: { pct: 0.05, cap: 5, noFlopNoDrop: true },
    stakes: '$2/$5 cash',
    effectiveStack: 100,                       // in BB
  },
  generatedAt: ISO8601,                        // build-time for static; render-time for dynamic
  schemaVersion: 1
}
```

**Print footer:** 2-line 9pt greyscale at card bottom:
```
Line 1: v123 / engine v4.7.2 / 2026-04-24
Line 2: pokerCore/preflopCharts @ a3c... | POKER_THEORY §3.2
```

**In-app drilldown:** "Where does this number come from?" button on each card opens a modal rendering the full lineage object + a link that navigates to the source-util file in the app's file-browser (build-time generation of these links is trivial — `new URL('src/utils/pokerCore/preflopCharts.js', import.meta.url)`).

### D7 — Content-drift CI

**Pattern: mirror EAL's RT-108 snapshot test.**

Authored at `src/utils/printableRefresher/__tests__/contentDrift.test.js`:

```
For each card manifest in src/utils/printableRefresher/manifests/:
  1. Recompute contentHash from sourceUtils[].path via dynamic import + stableStringify
  2. Compare to manifest.lineage.contentHash
  3. If mismatch AND manifest.schemaVersion unchanged → FAIL CI
  4. If mismatch AND schemaVersion incremented → PASS (intentional re-version)
```

**Markdown-vs-generated precedence.** Per PRF charter working principle #6 ("Lineage visible"), markdown-authored card content (pure-plays codex) is source of truth for that card's copy; generated numbers are source of truth for computed fields. A card can be partly each. Conflict rule: if markdown contradicts a generated number, CI fails — the author must update the markdown OR rebase the chart. Never silently override.

This matches EAL W-EA-1's "seed markdown is source of truth; IDB is a cache" doctrine — PRF generalizes: "manifest is source of truth; render output is a cache."

### D8 — State-clear-asymmetry

**Risk real; selector library required.** Per red line #6 (flat access), a suppressed card must remain reachable via "show suppressed" view. Precedent: EAL's `selectActiveAnchors` vs `selectAllAnchors`. Author:

- `selectActiveCards({ refresherConfig, catalog }) → Card[]` — excludes `cardVisibility === 'hidden'` + `suppressedClasses`
- `selectAllCards({ refresherConfig, catalog }) → Card[]` — every card, with visibility annotation
- `selectPinnedCards(...)` — subset pinned for at-top print ordering

Default surface view + default print-export use `selectActiveCards`. A "Show suppressed" toggle switches to `selectAllCards`. R-8.1 (state-symmetry) applies: a card can always round-trip from suppressed → visible without data loss.

## Stage E — Heuristics

### In-app view (Mobile-Landscape)

**Density at 1600×720 under useScale.** At scale ~0.45 (Samsung A22), a 12-card sheet preview fits if cards render at ~120px wide. That's too small for meaningful preview. Ship the in-app view as **one-card-at-a-time detail** with a virtualized vertical-scroll list (card thumbnails 160×140 scaled, ~4 visible at a time + scroll). The print-preview mode is a separate routed sub-view that renders exactly what will print (WYSIWYG), using the same `@media print` CSS forced via a `.print-preview-container` wrapper that applies print rules unconditionally.

**H-ML04 (scale interaction).** Filter/sort chrome (card-class filter, stakes selector, pinned toggle) must use `≥44 DOM-px` at scale — i.e., ≥98 CSS-px at `scale=0.45`. Compute with `scale`-aware `useButtonSize` pattern (existing in codebase).

**H-ML06 (touch targets).** Card actions (hide, pin, stamp print-date, drill into lineage) are icon buttons; each must honor the same 44 DOM-px floor. The lineage-drilldown should NOT be the card tap — card tap opens detail; lineage is a dedicated button with a (i) glyph.

### Printed artifact (novel print-medium)

**H-PM01 Laminate-scale readability.** Minimum body text 10pt for sustained reading; 8pt floor for tables; 6pt banned. Validated by: print a proof sheet → laminate → hold at 14" (typical at-table glance distance) → read without squinting. If fails, card is non-compliant.

**H-PM02 Color-blind (deuteranopia/protanopia).** Never use red/green as the only signal pair. Accent colors pulled from a 6-hue palette chosen for deuteranopia distinguishability: navy, burnt orange, ochre, teal, charcoal, maroon. One accent per card class.

**H-PM03 Ink-budget.** No full-bleed color fills. Accent color used only on: card-class badge, one horizontal rule, and line-art icons. Tables use 0.5pt rules, no zebra-stripes. Target: <5% ink coverage per card for greyscale printers.

**H-PM04 Lamination-friendly.** 0.25" safe-trim margin inside the card boundary — nothing load-bearing inside the outer 0.25". Laminate pouches cut at the printed card boundary; critical content inside the safe margin.

**H-PM05 One-idea-per-card (information atomicity).** *Load-bearing unresolved.* "One idea" = one decision point or one reference table the user would consult as a unit. A preflop open-raise chart by position = one idea. A flop-texture-×-hand-type cbet matrix = one idea (dense but unitary). Auto-profit formula + worked example = one idea. *Not* one idea: "all preflop math" (too broad); "UTG open hands" (too narrow, wastes a card). **Gate 4 rule: every card authored in Gate 5 must justify its atomicity to the owner in <25 words.**

**H-PM06 No dynamic-rendering-assumption content.** Anything that would normally animate, toggle, or expand in-app (collapsible sections, hover-to-reveal) cannot translate to paper. If a card's in-app version needs interaction to be legible, the print version fails. Design print-first (per charter principle #5).

## Proposed code layout (pre-Gate-4 sketch)

```
src/
  components/views/PrintableRefresherView/
    PrintableRefresherView.jsx          // route shell, ~80 lines
    CardCatalog.jsx                     // filter + sort + virtualized list
    CardDetail.jsx                      // single-card preview with lineage drilldown
    PrintPreview.jsx                    // WYSIWYG preview (applies @media print CSS)
    PrintControls.jsx                   // page size, cards-per-sheet, color mode
    LineageModal.jsx                    // "where does this number come from"
  utils/printableRefresher/
    index.js                            // barrel export
    cardRegistry.js                     // all card class definitions + manifests
    selectors.js                        // selectActiveCards / selectAllCards / selectPinnedCards
    manifests/                          // one manifest per card (JSON)
      preflop-open-ranges-100bb.json
      auto-profit-table.json
      geometric-bet-sizing.json
      binomial-survival.json
      ... (15-20 cards at MVP)
    lineage.js                          // computeLineage, hashUtil, printFooter
    writers.js                          // frozen W-URC-1/2/3 registry
    __tests__/
      contentDrift.test.js              // CI drift guardrail
      selectors.test.js                 // state-clear-asymmetry coverage
      lineage.test.js                   // hash stability + schema assertions
  hooks/
    useRefresherConfig.js               // IDB-backed config hook (mirrors useAssumptionPersistence)
    usePrintPreview.js                  // print-media CSS switcher
  utils/persistence/
    refresherConfigStorage.js           // new; v18 migration
    migrations.js                       // v17 → v18 addition (coordinate with SL)
  styles/
    printable-refresher.css             // @page + @media print + grid
```

## Stage verdict signals

- **Stage D: ⚠️ YELLOW** — tractable, but three conditional RED risks: (a) Study Home coupling defers cleanly only if standalone route ships first; (b) v18 claim collides with Shape Language; (c) content-drift CI is non-negotiable and under-specified in Gate 1.
- **Stage E: ⚠️ YELLOW** — in-app ML heuristics are standard; print-medium heuristics are novel and one (H-PM05 atomicity) needs owner ratification per card in Gate 5.

## Recommended follow-ups for Gate 3 / Gate 4 / Gate 5

- [ ] **Gate 3 decision memo:** resolve Study Home authorship order (D1b confirmed? Standalone-route-first?).
- [ ] **Gate 3 coordination:** IDB version claim resolution (PRF vs Shape Language: which is v18, which is v19?).
- [ ] **Gate 4 surface spec:** `docs/design/surfaces/printable-refresher.md` with `parentSurface: 'study-home (pending)'`.
- [ ] **Gate 4 surface spec:** print-CSS-doctrine sub-spec (page sizes, layouts, type scale, color palette).
- [ ] **Gate 4 spec:** lineage schema ratification + `WRITERS.md` for `userRefresherConfig` store.
- [ ] **Gate 4 spec:** content-drift CI test shape (`contentDrift.test.js`) ratified before Gate 5 authoring starts.
- [ ] **Gate 5 Phase 3 gate:** each authored card passes atomicity justification (H-PM05) + fidelity pre-check (Voice 3 owns).
- [ ] **Gate 5 Phase 5 test:** Playwright print-to-PDF snapshot tests for the 15-20 MVP cards + B&W fallback + cross-browser.
- [ ] **Backlog item:** `STUDY-HOME-SURFACE` cross-reference — PRF is a candidate authorship trigger if it ships before Shape Language.
- [ ] **Owner interview question:** Confirm default page size (Letter vs A4) + confirm default cards-per-sheet (12 vs 6) based on actual printer + lamination pouch sizes he uses.
