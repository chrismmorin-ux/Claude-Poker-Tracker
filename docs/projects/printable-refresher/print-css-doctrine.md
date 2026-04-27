# Print-CSS doctrine — Printable Refresher

**Status:** v1.0 — Gate 4, Session 6 (2026-04-25).
**Depends on:** `docs/design/surfaces/printable-refresher.md` §State + sub-views; `docs/design/surfaces/printable-refresher-card-templates.md` (Regions 1-6 anatomy); `docs/design/heuristics/printable-artifact.md` H-PM01-08 (especially H-PM01 readability + H-PM02 color + H-PM04 safe-trim margin); charter §Acceptance Criteria.
**Purpose:** Define the print-CSS rules for refresher cards rendering under `@media print` + WYSIWYG `.print-preview-container` wrapper. Page geometry, typography scale, color palette, layout grids, cross-browser handling, and explicit rasterization ban.

---

## Why this spec exists

The refresher's central artifact is paper. CSS is the only mechanism between manifest data and what the laminator pouch eventually contains. Three forces make print-CSS first-class infrastructure:

1. **Heuristic compliance is rendered, not authored.** H-PM01 readability (10pt body floor, 8pt table floor, 6pt banned), H-PM03 finger-pointing accuracy (4mm row height), H-PM04 safe-trim margin (0.25" inside card boundary), H-PM02 color-blind + B&W fallback are all CSS-side guarantees. A manifest with correct content fails the heuristics if CSS misrenders.
2. **Browser print is the export pipeline (V5 D5).** No jsPDF / pdf-lib / html2canvas in the bundle. Browser `Ctrl-P` → Save-as-PDF is the path. CSS must produce vector glyphs that survive PDF export at 300dpi laminator scale.
3. **Cross-browser variance is real.** Chromium is the baseline (Playwright `page.pdf()` ground truth). Firefox + Safari diverge on `@page`, CSS grid below 10pt, and color-managed printing. The spec defines the test matrix + degradation strategy.

The spec is paired with PRF-G4-S2 (card templates) — S2 defines layout regions, this doc defines the CSS that renders them.

---

## Forbidden mechanisms

Before stating what's permitted, what's banned:

- **`html2canvas` and any rasterization path.** Forbidden by V5 D5. Rasterizing card content kills <10pt glyphs after compression — laminate becomes illegible. Vector text only.
- **`jsPDF` runtime PDF generation.** Adds ~200KB+ to bundle without quality benefit over browser print → Save-as-PDF. Forbidden as default path; permitted only if a future feature explicitly requires server-side PDF (out of Phase 1 scope).
- **Background images on cards.** No raster backgrounds, no decorative SVGs that depend on color rendering. H-PM03 ink-budget < 5% per card.
- **Web fonts for print.** System fonts only (`Source Serif Pro` / `Inconsolata` / `system-ui` fallback). Web font network dependency at print time is brittle + adds delay; system fonts render predictably.
- **CSS animations on print.** `@media print` overrides any animation-class to `animation: none`. Paper has no animation; H-PM06 print-first principle.
- **Color-only encoding.** Per H-PM02. Always pair color with shape, weight, or label. CSS alone cannot enforce this; reviewer-at-PR-time + Gate 5 Voice-3-equivalent fidelity review enforce.
- **`background-color` fills on body content.** Allowed only on accent badges (single-hue, ≤5% area). Zebra-striped tables banned.

---

## Page geometry

### `@page` rules

```css
@page {
  size: letter;             /* default; A4 selectable per Q4 */
  margin: 0.4in;            /* outer page margin */
}

@page :first {
  margin-top: 0.4in;        /* parity; no extra header band */
}

/* Selectable per `userRefresherConfig.printPreferences.pageSize` */
@media print {
  body[data-page-size="a4"] {
    /* Triggered via React class wrapper; CSS prints the rule chosen */
  }
}
```

**Why 0.4" outer margin.** Standard inkjet + laser duplex printers reliably print to 0.25" of paper edge; 0.4" gives safety + room for browser-default header/footer that the user is asked to disable but may forget. The 0.25" *card-internal* safe-trim margin (H-PM04) is **inside** the card boundary, not the page boundary.

### Page-size variants

| Mode | Size | Use case |
|---|---|---|
| Letter (default) | 8.5" × 11" | US owner default. Q4 ratified. |
| A4 | 8.27" × 11.69" | Non-US fallback. Q4 selectable. |
| Custom (Phase 2+) | TBD | Out of Phase 1 scope; not in `printPreferences` enum. |

Page-size switching is a `printPreferences.pageSize` write via W-URC-1 (config-preference-writer); CSS rule selects via `body[data-page-size]` attribute set by React on mount.

---

## Layout grids (cards-per-sheet)

Four grid modes per S1 §State `printPreferences.cardsPerSheet`:

| Mode | Grid | Card size (Letter) | Card size (A4) | Use case |
|---|---|---|---|---|
| 12-up | 3 columns × 4 rows | ~2.5" × 2.25" | ~2.42" × 2.45" | Default. Index-card scale. |
| 6-up | 2 × 3 | ~3.75" × 3.25" | ~3.66" × 3.55" | Larger; less dense. |
| 4-up | 2 × 2 | ~3.75" × 4.875" | ~3.66" × 5.32" | Spacious; for dense math tables. |
| 1-up | 1 × 1 | ~7.5" × 10" | ~7.32" × 10.8" | Single-card focus. Phase 2+ "designer-quality" deferred; 1-up still ships in Phase 1 for poster-style printing of single math tables. |

### Grid CSS

```css
/* Container of all selected cards */
.refresher-print-page {
  display: grid;
  gap: 0.15in;             /* space between cards */
}

/* Per-mode rules */
.refresher-print-page[data-cards-per-sheet="12"] {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(4, 1fr);
}

.refresher-print-page[data-cards-per-sheet="6"] {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(3, 1fr);
}

.refresher-print-page[data-cards-per-sheet="4"] {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.refresher-print-page[data-cards-per-sheet="1"] {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

/* Page break between full pages */
.refresher-print-page {
  page-break-after: always;
  break-after: page;       /* CSS3 modern */
}
```

### Card-level break prevention

```css
.refresher-card {
  break-inside: avoid;
  page-break-inside: avoid;        /* legacy Safari */
  overflow: hidden;                 /* clip if content exceeds card boundary */
  position: relative;
}
```

**Why both `break-inside` and `page-break-inside`.** Modern browsers honor `break-inside`; Safari ≤16 still required `page-break-inside`. Belt-and-suspenders cross-browser.

---

## Card-internal regions

Card boundary holds the 6 regions per PRF-G4-S2. All regions render **inside** the 0.25" safe-trim margin per H-PM04.

```css
.refresher-card {
  /* Inner padding = safe-trim margin */
  padding: 0.25in;
  background: white;
  color: black;
  font-family: 'Source Serif Pro', Georgia, serif;

  /* Layout regions vertically */
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  /* Region 1 (title) | Region 2 (primary content, flexes) | Region 3 (derivation, if present) | Regions 4-5 (lineage footer) */
}

.card-region-title {
  /* Region 1 */
  font-size: 14pt;
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 0.05in;
  color: var(--card-accent, #000);  /* accent set per card class */
}

.card-region-subtitle {
  /* Region 1 second line — F3 scenario declaration */
  font-size: 10pt;
  font-weight: 400;
  line-height: 1.15;
  color: black;
  margin-bottom: 0.1in;
}

.card-region-primary {
  /* Region 2 — class-specific content; flex-grows */
  font-size: 10pt;
  line-height: 1.3;
}

.card-region-derivation {
  /* Region 3 — optional per template */
  font-size: 9pt;
  line-height: 1.25;
  margin-top: 0.05in;
  padding-top: 0.05in;
  border-top: 0.5pt solid #888;
}

.card-region-lineage {
  /* Regions 4-5 — two lines */
  font-size: 9pt;
  line-height: 1.2;
  color: #555;
  margin-top: 0.05in;
}

.card-region-lineage-line-1 {
  font-family: 'Inconsolata', Consolas, 'Liberation Mono', monospace;
}

.card-region-lineage-line-2 {
  font-family: 'Source Serif Pro', Georgia, serif;
}

/* Region 6 — card-corner physical version-stamp (per H-PM07) */
.card-corner-stamp {
  position: absolute;
  bottom: 0.30in;          /* inside the 0.25" safe-trim + 0.05" inset */
  left: 0.30in;
  font-size: 7pt;
  color: #666;
  font-family: 'Source Serif Pro', Georgia, serif;
  transform: rotate(-90deg);
  transform-origin: bottom left;
  white-space: nowrap;
}
```

---

## Typography scale

Per H-PM01 (laminate-scale readability):

| Class | Element | Size | Weight | Family | Notes |
|---|---|---|---|---|---|
| `.card-region-title` | Card title (Region 1 line 1) | 14pt | bold | serif | One accent-color line |
| `.card-region-subtitle` | Scenario declaration (Region 1 line 2) | 10pt | 400 | serif | Black; F3 |
| `.card-region-primary` | Body content (Region 2) | 10pt | 400 | serif | Floor |
| `.card-region-primary table` | Tabular data | 10pt | 400 | mono | Inconsolata for digit alignment |
| `.card-region-primary table th` | Table headers | 10pt | 700 | mono | Bold for headers |
| `.card-region-derivation` | Formula / corollary (Region 3) | 9pt | 400 | serif | One-step below body |
| `.card-region-lineage-line-1` | Lineage line 1 (mono) | 9pt | 400 | mono | Greyscale `#555` |
| `.card-region-lineage-line-2` | Lineage line 2 (serif) | 9pt | 400 | serif | Greyscale `#555` |
| `.card-corner-stamp` | Region 6 stamp | 7pt | 400 | serif | Greyscale `#666`; rotated |

**Hard floor: 8pt for table cells.** Anything below produces sub-pixel breakage at 300dpi after lamination glare. Math tables that don't fit at 10pt body should drop to 9pt only with reviewer sign-off; 8pt is the absolute floor.

**Hard ceiling: 16pt for any element on a refresher card.** Larger text is poster-territory and breaks H-PM05 atomicity (cards are unitary references, not banners).

---

## Color palette

Per H-PM02 (color-blind + B&W + ink-budget):

```css
:root {
  /* 6-hue accent palette — deuteranopia-distinguishable */
  --accent-navy: #1e3a5f;
  --accent-burnt-orange: #c05621;
  --accent-ochre: #b8860b;
  --accent-teal: #0f766e;
  --accent-charcoal: #374151;
  --accent-maroon: #7f1d1d;

  /* Greyscale */
  --grey-darker: #555;
  --grey-medium: #888;
  --grey-light: #ccc;
}

/* Per-class accent assignment */
.card-class-preflop { --card-accent: var(--accent-navy); }
.card-class-math { --card-accent: var(--accent-burnt-orange); }
.card-class-equity { --card-accent: var(--accent-teal); }
.card-class-exceptions { --card-accent: var(--accent-maroon); }
/* (charcoal + ochre reserved for Phase 2+ classes) */
```

### Permitted accent uses

- Card title color (Region 1 line 1).
- Class badge / pill (≤0.5" wide).
- One horizontal rule per card (≤0.5pt).
- Line-art icons (e.g., suit pips, arrow indicators).

### Forbidden accent uses

- Body text color (must remain black for contrast).
- Background fills on body or table rows (H-PM03 ink-budget).
- Heatmap colors on equity matrices (use shape + label + greyscale density instead).
- Large blocks visible from across the table (H-PM08 social discretion).

### B&W fallback (`@media print` greyscale enforcement)

Some users print to monochrome inkjet or laser. CSS handles this via:

```css
@media print {
  /* If user explicitly set color-mode: 'bw' */
  body[data-color-mode="bw"] {
    --accent-navy: #000;
    --accent-burnt-orange: #000;
    --accent-ochre: #000;
    --accent-teal: #000;
    --accent-charcoal: #000;
    --accent-maroon: #000;
  }

  /* Auto fallback for color-managed greyscale printing */
  body[data-color-mode="auto"] .card-region-title {
    /* Browser greyscales accent automatically; verify the 6 hues
       map to distinguishable greyscale tones via Playwright CI snapshot */
  }
}
```

Owner toggles via `printPreferences.colorMode` in `PrintControls`. Auto mode lets the browser/printer manage; B&W mode forces hue → black.

**Test contract:** Playwright snapshot at B&W mode for every MVP card; Voice-3-equivalent reviewer verifies all categories remain distinguishable in greyscale.

---

## `@media print` doctrine

Print rules apply both to actual printing AND to the WYSIWYG `.print-preview-container` wrapper (which forces print rules unconditionally on screen).

```css
@media print, .print-preview-container {
  /* Common rules — apply to both contexts */
  body { background: white; color: black; }
  .refresher-card { /* ... per above ... */ }
  /* Hide non-print UI when printing */
  .nav, .toolbar, .tooltip, .modal-backdrop { display: none; }
}

@media print {
  /* Print-only — does not affect screen preview */
  @page { size: letter; margin: 0.4in; }
  /* Disable all animation */
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
  }
}

.print-preview-container {
  /* Screen-only WYSIWYG */
  background: #f5f5f5;       /* page outside card boundary; only visible in preview */
  padding: 0.4in;
  /* Forces print layout on screen for verification */
}
```

**Critical:** the `.print-preview-container` mirrors print rules so the owner can verify before committing. If the preview diverges from actual print output, the divergence is a bug — Playwright reconciliation snapshots in CI catch this.

---

## Browser print headers + footers

Browsers add their own headers (URL, page title) and footers (date, page N of M) by default. These corrupt the laminate's lineage footer + waste real estate.

**Mitigation:**

1. **Copy in PrintConfirmationModal** instructs the owner to disable browser headers. Per S1 §A6.
2. **CSS suppression where possible:** modern browsers honor `@page { @top-left {} @bottom-right {} }` for empty header zones, but support is incomplete:

```css
@page {
  /* Empty browser-managed headers — best-effort suppression */
  @top-left { content: ''; }
  @top-center { content: ''; }
  @top-right { content: ''; }
  @bottom-left { content: ''; }
  @bottom-center { content: ''; }
  @bottom-right { content: ''; }
}
```

3. **Tested behavior:** Chrome/Firefox/Safari each have a "Headers and footers" toggle in print dialog; we ship the CSS attempt + UI cue; owner is the final authority.

---

## Cross-browser test matrix

Per V5 §Stage D4. Three tiers of support:

| Browser | Tier | Test mode | Known issues |
|---|---|---|---|
| Chrome / Chromium | **Primary** (CI baseline) | Playwright `page.pdf()` deterministic ground truth | None at 10pt+. |
| Firefox | Secondary | Playwright + manual print-dialog snapshot | CSS grid rasterizes inconsistently below 10pt — H-PM01 floor of 10pt body / 8pt table accommodates. |
| Safari | Tertiary | Manual + screenshot comparison | `page-break-inside` legacy needed (covered above). `@page` margin sometimes ignored. |
| Edge | Implicit (Chromium) | Falls under Chrome tier | None. |
| Mobile Chrome (Android) | Implicit | Chrome's "Save as PDF" on phone | Print dialog UI differs but PDF output matches desktop Chrome. |
| Mobile Safari (iOS) | Out of scope Phase 1 | — | iOS print dialog unreliable for laminate-quality output; Phase 2+ if owner asks. |

### Playwright print-snapshot tests (PRF-G5-PDF)

```js
// Sketch — Phase 5 implementation
test.describe('Print snapshots', () => {
  test('Letter 12-up B&W — math auto-profit', async ({ page }) => {
    await page.goto('/refresher/print-preview?cards=math-auto-profit&pageSize=letter&cardsPerSheet=12&colorMode=bw');
    const pdf = await page.pdf({
      format: 'Letter',
      margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
      printBackground: false,
    });
    expect(pdf).toMatchSnapshot('prf-letter-12up-bw-auto-profit.pdf');
  });
  // ... matrix continues across modes
});
```

**Snapshot CI policy:** byte-exact comparison fails on any rendering drift. Regeneration requires manual `--update-snapshots` flag + reviewer verification that the new output is intentional. Cross-browser snapshots run on Chromium only (Playwright `page.pdf()` is Chromium-specific); Firefox + Safari verified via manual print-dialog screenshot at PR review.

---

## Print preview WYSIWYG mechanism

`PrintPreview` (S1 sub-view at `/refresher/print-preview`) renders cards inside `.print-preview-container`:

```jsx
function PrintPreview({ selectedCards, printPreferences }) {
  return (
    <div
      className="print-preview-container"
      data-page-size={printPreferences.pageSize}
      data-cards-per-sheet={printPreferences.cardsPerSheet}
      data-color-mode={printPreferences.colorMode}
    >
      {chunkIntoPages(selectedCards, printPreferences.cardsPerSheet).map((page, i) => (
        <div key={i} className="refresher-print-page">
          {page.map(card => <CardComponent manifest={card} mode="preview" />)}
        </div>
      ))}
    </div>
  );
}
```

The wrapper class `.print-preview-container` triggers all `@media print` rules on screen via the rule pattern at top — this guarantees what the owner sees IS what prints.

**Edge case:** browser zoom changes preview size but not actual print. Owner-controlled zoom is tolerable; preview doesn't claim 1:1 visual fidelity, only layout fidelity.

---

## Phase 5 implementation checklist

- [ ] Author `src/styles/printable-refresher.css` implementing rules above.
- [ ] Author `PrintPreview.jsx` with `.print-preview-container` wrapper + page chunking.
- [ ] Author `chunkIntoPages` util to split selected cards by `cardsPerSheet` into pages.
- [ ] Author shared template region CSS classes (Region 1-6 covered above).
- [ ] Wire `userRefresherConfig.printPreferences.{pageSize, cardsPerSheet, colorMode, includeLineage}` to `<body>` data attributes via React effect.
- [ ] Verify `@page :first` works on Chrome/Firefox/Safari at 0.4in margin.
- [ ] Run Playwright snapshot tests for the 4 grid modes × 2 page sizes × 2 color modes = 16 snapshots per MVP card.
- [ ] Manual print-dialog QA at Voice-3-equivalent review on Chromium + Firefox + Safari for one card per template class.
- [ ] Verify `body[data-color-mode="bw"]` renders all 4 accent classes distinguishably in greyscale.
- [ ] Lint check at PR time: forbidden bundle imports (`html2canvas`, `jspdf`, `pdf-lib`) fail CI.

---

## Bundle-import enforcement

Add to `scripts/check-refresher-bundle.sh` (Phase 5 dev script):

```bash
#!/usr/bin/env bash
# Forbid rasterization libraries from refresher view bundle
forbidden_imports=(
  "html2canvas"
  "jspdf"
  "pdf-lib"
)
violations=$(
  grep -rn -E "from ['\"](${forbidden_imports[0]}|${forbidden_imports[1]}|${forbidden_imports[2]})['\"]" \
    src/components/views/PrintableRefresherView/ \
    src/utils/printableRefresher/ \
    --include="*.js" --include="*.jsx" \
    || true
)
if [[ -n "$violations" ]]; then
  echo "Forbidden rasterization library imports detected in refresher code:"
  echo "$violations"
  exit 1
fi
echo "Refresher bundle check: OK"
```

Hook into CI alongside `check-refresher-writers.sh`. Mirror of the writer-registry CI-grep pattern.

---

## Amendment rule

Adding a new page-size variant (Custom / Tabloid) requires **persona-level review**. Owner must articulate the use case + commit to the broader testing matrix expansion.

Adjusting typography floor (10pt body, 8pt table, 6pt banned) is an H-PM01 boundary — amendment requires Voice 1 (Product/UX) + Voice 5 (Senior engineer + print-medium) sign-off; default answer is no.

Adjusting the 6-hue palette requires Voice 5 (engineer) sign-off **plus** deuteranopia + protanopia + tritanopia simulation verification across all 6 hues at proposed change. The palette is selected for color-blind distinguishability + B&W tone separation; introducing a new hue without verifying both axes is a regression.

Removing CSS rules that enforce H-PM01-08 is forbidden without re-deriving the heuristic from scratch.

---

## Change log

- **2026-04-25 — v1.0 shipped (Gate 4, Session 6).** Page geometry (`@page` rules + Letter/A4 variants) + 4 layout grids (12-up / 6-up / 4-up / 1-up with cross-browser break-inside protection) + card-internal Regions 1-6 CSS + typography scale (14pt title / 10pt body floor / 8pt table floor / 9pt lineage / 7pt corner stamp / 16pt ceiling) + 6-hue deuteranopia palette with per-class accent assignment + B&W fallback (`body[data-color-mode]` toggle + greyscale verification policy) + `@media print` doctrine (animation kill + WYSIWYG wrapper) + cross-browser test matrix (Chrome primary / Firefox secondary / Safari tertiary + Playwright `page.pdf()` ground truth) + bundle-import enforcement (forbidden libs: html2canvas, jspdf, pdf-lib). Phase 5 implementation checklist 10 items.
