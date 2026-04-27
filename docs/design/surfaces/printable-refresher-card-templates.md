# Surface — Printable Refresher Card Templates

**ID:** `printable-refresher-card-templates`
**Parent surface:** `printable-refresher` (PRF-G4-S1). This spec defines the per-card-class layout templates consumed by `CardDetail` + `PrintPreview` + printed output.
**Product line:** Main app. No extension-side equivalent.
**Tier placement:** Follows parent surface — Phase B (math) free / Phase A (preflop) conditional / Phase C (exceptions + equity) Plus-tier per Q5 ratification.
**Last reviewed:** 2026-04-24 (Gate 4, Session 5 — PRF-G4-S2).

**Code paths (future — Phase 5):**
- `src/components/views/PrintableRefresherView/CardTemplates/PreflopCardTemplate.jsx`
- `src/components/views/PrintableRefresherView/CardTemplates/MathCardTemplate.jsx`
- `src/components/views/PrintableRefresherView/CardTemplates/EquityCardTemplate.jsx`
- `src/components/views/PrintableRefresherView/CardTemplates/ExceptionsCardTemplate.jsx`
- `src/components/views/PrintableRefresherView/CardTemplates/LineageFooter.jsx` (shared across all 4)
- `src/utils/printableRefresher/cardRegistry.js` — `class` field maps card → template component
- `src/utils/printableRefresher/manifests/*.json` — per-card manifest consumed by its class's template

**Related docs:**
- Parent: `docs/design/surfaces/printable-refresher.md` (PRF-G4-S1)
- Heuristics: `docs/design/heuristics/printable-artifact.md` — H-PM05 atomicity is load-bearing at this spec
- Journey: `docs/design/journeys/refresher-print-and-re-print.md` — templates render in `PrintPreview` step of Variation A
- Charter: `docs/projects/printable-refresher.project.md` §Acceptance Criteria — fidelity bar F1-F6 per-card checklist
- CI: `docs/projects/printable-refresher/content-drift-ci.md` — manifest shape v1 + atomicity justification rule
- Copy: `docs/projects/printable-refresher/copy-discipline.md` — CD-1..5 per-card enforcement

---

## Purpose

Every printable card renders through one of four class-specific layout templates. Templates encode the **minimum information structure** needed to clear the 6-point fidelity bar (F1-F6) at 2.5"×2.25" or 3.75"×3.25" scale (12-up or 6-up grid, respectively — full cards per H-PM01 + H-PM04 safe-trim margin).

The template system serves three goals:

1. **Consistency** — every card of a class shares layout DNA. A user reading their 15th preflop card at arm's length knows where the range grid sits, where the sizing hint sits, where the lineage footer sits. No cognitive reload per card.
2. **Atomicity enforcement (H-PM05)** — each template is designed to hold exactly one reference unit. A card that wants to span multiple templates (e.g., "preflop open + postflop cbet for CO") is structurally rejected by the template system — author must split into two cards.
3. **Fidelity-bar binding** — each template's layout maps directly onto F1-F6 checklist fields. The `fidelityChecklist: { F1..F6: boolean }` attestation in the manifest (per `content-drift-ci.md` §Manifest shape v1) corresponds to template-slot population — empty slots cannot pass F2 / F3 / F4.

Four templates, one per Phase 1 card class: **Preflop** · **Math** · **Equity** · **Exceptions**. Phase 2+ card classes (personal-codex export, coach-curated) would author new templates under the same spec pattern.

---

## Template anatomy (common across all four)

Every template has five structural regions at fixed positions within the card boundary. The 0.25" safe-trim margin (H-PM04) is inside the outer boundary; nothing load-bearing outside it.

```
┌────────────────────────────────────────────┐
│  [Card Title Region]                        │ ← Region 1 (top, full-width)
│  Subtitle / scenario declaration            │
├────────────────────────────────────────────┤
│                                             │
│  [Primary Content Region]                    │ ← Region 2 (class-specific layout)
│                                             │
│                                             │
├────────────────────────────────────────────┤
│  [Derivation / Exception Region]             │ ← Region 3 (class-specific; may be empty per template)
│                                             │
├────────────────────────────────────────────┤
│  v<semver> · <YYYY-MM-DD> · <source-util>  │ ← Region 4 (lineage footer line 1)
│  <theory-citation> · <assumption-bundle>    │ ← Region 5 (lineage footer line 2)
└────────────────────────────────────────────┘
  [Card corner stamp: v<semver> · <date>]    ← Region 6 (card-corner, physical version-stamp per H-PM07)
```

### Region 1 — Title + subtitle (full-width top band)

- **Title:** 14pt bold serif. 1-2 lines max. Describes the card's "one idea" at glance (H-PM01 ≤1.5s glanceability).
- **Subtitle:** 10pt serif. 1 line. Declares the scenario per F3 + CD-5 (stakes / rake / stack / field / position context). Required; cannot be empty.
- Height: ~0.35" (both lines).
- Ink: title accent color (one of 6-hue deuteranopia palette per H-PM02) + black body. Accent ≤ 5% ink-coverage per H-PM03.

### Region 2 — Primary content (class-specific)

This is the card's main visual payload. Layout differs per template (see below). Height budget: ~1.4" on 2.5"×2.25" card; ~2" on 3.75"×3.25" card. All primary reference data lives here.

### Region 3 — Derivation / exception callout (class-specific; optional for some templates)

Short formula / derivation reference / exception annotation. Per F2 (math visible) + F5 (pure/exception provenance unambiguous). Height: ~0.25". Templates that have no derivation region (e.g., some equity templates) leave this area absorbed into Region 2.

### Region 4-5 — Lineage footer (shared across all templates)

Exact layout per `PrintableRefresher` §CardDetail:

- **Line 1 (9pt greyscale, monospace):** `v<semver> · <YYYY-MM-DD> · <source-util>`
  - Example: `v1.2 · 2026-04-24 · pokerCore/preflopCharts.js`
- **Line 2 (9pt greyscale, serif):** `<theory-citation> · <assumption-bundle>`
  - Example: `POKER_THEORY §3.2 · $2/$5 · rake 5% cap $5 · 100bb`

Together the two lines provide 5 of the 7 lineage fields (ID+semver, generated-date, source-util, theory-citation, assumption-bundle). The remaining 2 (engine+app version, bucket-definitions-cited-if-applicable) live in the expanded `LineageModal` (accessed via tap on the card ID in-app; not printed — H-PM01 readability floor means we can't print all 7 fields on the physical card).

Ink: entirely greyscale; no accent color. Height: ~0.2".

### Region 6 — Card-corner physical version-stamp (H-PM07)

- **Text:** `v<semver> · <YYYY-MM-DD>` in 7pt serif, greyscale, rotated 90° counter-clockwise, printed in bottom-left corner **inside the 0.25" safe-trim margin**.
- **Purpose:** survives lamination glare + obvious at arm's length for cross-referencing against in-app staleness-diff (H-PM07 — owner needs to know their laminate's date without the full footer being legible).
- **Height:** ~0.5" × 0.1" rotated.
- **Ink:** greyscale, no accent.

---

## Template 1 — Preflop

**Class:** `preflop`
**Phase placement:** Phase A (conditional on Q5 differentiation demo at Gate 4 design review).
**Canonical cards:** `PRF-PREFLOP-OPEN-CO-100BB-2-5`, `PRF-PREFLOP-DEFEND-BB-VS-BTN-OPEN-100BB-2-5`, `PRF-ICM-PUSH-FOLD-12BB-UTG`.

### Layout

```
┌────────────────────────────────────────────┐
│  CO open · 100bb                            │ ← Region 1
│  $2/$5 cash · 5% rake cap $5 · 9h $1/$3    │
├────────────────────────────────────────────┤
│  ┌──────────────────────────────┐           │
│  │ 13×13 hand grid               │           │ ← Region 2 (primary: hand matrix)
│  │ (pairs on diagonal, suited    │           │
│  │  upper-right, offsuit lower-  │           │
│  │  left, opens shaded)          │           │
│  └──────────────────────────────┘           │
│  Sizing: 3bb (4bb if 2 limpers)              │ ← Region 2 continued: sizing
├────────────────────────────────────────────┤
│  Exception: vs straddle → tighten top 5%    │ ← Region 3 (optional, if applicable)
├────────────────────────────────────────────┤
│  v1.2 · 2026-04-24 · pokerCore/preflopCharts│
│  POKER_THEORY §3.2 · $2/$5 · 5% cap $5 · 100bb
└────────────────────────────────────────────┘
  v1.2 · 2026-04-24                            ← Region 6 (corner stamp)
```

### Required manifest fields

- `class: 'preflop'`
- `generatedFields.rangeGrid` — references a `pokerCore/preflopCharts.js#computeOpenRange(position, stack, rake)` function; output is a 169-entry boolean/frequency array rendered as the 13×13 grid.
- `generatedFields.defaultSizing` — references a sizing computation; output is the primary sizing hint.
- `bodyMarkdown` — title + subtitle + exception prose; template renders the grid + sizing hint positionally.
- `assumptions` — required: stakes, rake, effectiveStack, field. Also required: `position` (CO / BTN / SB / BB / UTG / MP / HJ / LJ), `action` (open / 3bet / 4bet / call-vs-X / defend-vs-X).
- `fidelityChecklist.F2: true` — math visible via the grid + sizing formula in derivation region.
- `fidelityChecklist.F3: true` — full scenario declared in Region 1 subtitle.
- `atomicityJustification` — e.g., `"Single position + single action + single stack depth + single stakes/rake. One decision node per card."` (≤25 words).

### H-PM05 atomicity justification

**One idea = one (position × action × stack-depth × stakes/rake) combination.** A card encoding "CO open at 100bb at $2/$5" is one unit of reference; "CO open across 60bb + 100bb + 150bb" is three units and would need three cards. Splitting at stakes/rake is also required: a $1/$3 chart differs from a $2/$5 chart in rake impact (POKER_THEORY §4.1); merging would smuggle a label-as-input (rake label collapses into the range implicitly).

### Fidelity bar compliance

- **F1 (no archetype-as-input):** ✓ — preflop charts cite `position` + `stack` + `rake` + `field` as inputs. Villain labels absent from decision logic.
- **F2 (math visible):** ✓ — the 13×13 grid IS the math; sizing formula is declarative.
- **F3 (scenario-declared):** ✓ — Region 1 subtitle carries stakes / rake / stack / field.
- **F4 (source-trail footer):** ✓ — Region 4-5 cites `pokerCore/preflopCharts.js` + POKER_THEORY §3.2.
- **F5 (pure/exception unambiguous):** ✓ — grid is solver-baseline pure; Region 3 exceptions are cited separately (e.g., POKER_THEORY §9.2 BB live-pool divergence with audit id).
- **F6 (prescriptions computed, not labelled):** ✓ — sizing hint + exception triggers are conditional (SPR / VPIP / live-pool) — never "vs Fish do X."

### Known risks

- **Competitive commodity (Voice 2 market lens).** Preflop charts are abundant (Upswing, GTO Wizard, BBZ, Crush Live, Amazon laminates). Q5 differentiation gate at Gate 4 design review decides whether Phase A ships at all. If preflop template cards are visibly indistinguishable from Upswing free pack at the review, Phase A is cut + the project links to Upswing. Differentiation bet: rake-aware + stakes-selected + lineage-stamped. If that differentiation isn't visible on the card, Phase A doesn't ship.

---

## Template 2 — Math

**Class:** `math`
**Phase placement:** Phase B (clear-starting-point, zero anti-pattern risk).
**Canonical cards:** `PRF-MATH-AUTOPROFIT`, `PRF-MATH-GEOMETRIC-SIZING`, `PRF-MATH-POT-ODDS`, `PRF-MATH-IMPLIED-ODDS`, `PRF-MATH-BINOMIAL-SURVIVAL`, `PRF-MATH-SPR-ZONES`.

### Layout

```
┌────────────────────────────────────────────┐
│  Auto-profit bluff thresholds               │ ← Region 1
│  rake-agnostic · all SPR · all stakes       │
├────────────────────────────────────────────┤
│  Formula (prominent):                       │
│  breakeven = bet / (pot + bet)              │ ← Region 2 (formula block)
│                                             │
│  ┌───────────┬────────┬─────────────────┐  │
│  │ Bet size  │ B/E %  │ Bluff +EV when  │  │
│  ├───────────┼────────┼─────────────────┤  │ ← Region 2 continued: table
│  │ 1/3 pot   │ 25%    │ fold > 25%      │  │
│  │ 1/2 pot   │ 33%    │ fold > 33%      │  │
│  │ 2/3 pot   │ 40%    │ fold > 40%      │  │
│  │ 3/4 pot   │ 43%    │ fold > 43%      │  │
│  │ 1× pot    │ 50%    │ fold > 50%      │  │
│  └───────────┴────────┴─────────────────┘  │
├────────────────────────────────────────────┤
│  Corollary: when fold < B/E, bluffs -EV;    │ ← Region 3 (derivation / corollary)
│  value bets at same sizing gain on same read │
├────────────────────────────────────────────┤
│  v1.0 · 2026-04-24 · pokerCore (formula)    │
│  POKER_THEORY §6.3 · rake-agnostic          │
└────────────────────────────────────────────┘
  v1.0 · 2026-04-24                            ← Region 6
```

### Required manifest fields

- `class: 'math'`
- `bodyMarkdown` — formula + table rows authored as markdown; template renders positionally.
- `generatedFields` — usually empty for pure math cards (formulas derive at render); may include `tableRows` if parameterized by `assumptions` (e.g., rake-adjusted pot-odds card).
- `assumptions` — required: `stakes` (may be `rake-agnostic`), `effectiveStack` (may be `all SPR`), `field` (may be `solver vs solver`). At least one must be non-agnostic for F3.
- `fidelityChecklist.F2: true` — formula prominent in Region 2.
- `atomicityJustification` — e.g., `"Single formula + its tabulated values at standard sizings. One math reference per card."` (≤25 words).

### H-PM05 atomicity justification

**One idea = one formula + its tabulated values.** Auto-profit (breakeven formula + bet-size table) is one unit. Geometric sizing (n-street pot-commit formula + typical SPR values) is another. Pot-odds (pot-bet-equity-required formula + table) is another. Merging (e.g., "all pot math on one card") collapses multiple derivations into a density that fails H-PM01 glanceability + H-PM03 finger-pointing accuracy.

### Fidelity bar compliance

- **F1 (no archetype-as-input):** ✓ — math cards derive from game-state (pot / bet / SPR / stacks / rake). Zero label inputs.
- **F2 (math visible):** ✓ — formula is the card; F2 is structurally satisfied by Region 2.
- **F3 (scenario-declared):** ✓ even for rake-agnostic cards — Region 1 subtitle declares the agnosticism explicitly ("rake-agnostic · all SPR · all stakes"). No context-free charts.
- **F4 (source-trail footer):** ✓ — pokerCore + POKER_THEORY citation.
- **F5 (pure/exception unambiguous):** ✓ — math is pure-derivation solver-baseline. Corollaries in Region 3 are derivatives of the primary formula, not exceptions.
- **F6 (prescriptions computed, not labelled):** ✓ — "Bluff +EV when fold > B/E" is a computed conditional, no label.

### Known risks

- **None structural.** Voice 3 Gate 2 fidelity audit identified all 6 math cards (#2 auto-profit / #3 geometric / #4 pot-odds / #5 implied / #6 binomial / #17 SPR zones) as GREEN. Zero anti-pattern risk. This template is the safest Phase 1 starting point.

---

## Template 3 — Equity

**Class:** `equity`
**Phase placement:** Phase C (Plus-tier; last; per-card fidelity review).
**Canonical cards:** `PRF-EQUITY-RANGE-VS-RANGE-TEXTURES`, `PRF-EQUITY-HAND-VS-TEXTURE-REFERENCE`.

### Layout

```
┌────────────────────────────────────────────┐
│  Range equity · flop textures               │ ← Region 1
│  vs UTG 12% open range · 100bb              │
├────────────────────────────────────────────┤
│  ┌──────────────┬─────┬─────┬─────┬─────┐  │
│  │ Texture      │ Nut │ Str │ Mrg │ Draw│  │
│  ├──────────────┼─────┼─────┼─────┼─────┤  │ ← Region 2 (equity matrix table)
│  │ KQ7 rainbow  │ 18% │ 22% │ 30% │ 20% │  │
│  │ T98 two-tone │ 14% │ 19% │ 28% │ 29% │  │
│  │ A92r         │ 22% │ 26% │ 26% │ 16% │  │
│  │ 862 mono     │ 10% │ 15% │ 25% │ 35% │  │
│  │ ... (N rows)  │     │     │     │     │  │
│  └──────────────┴─────┴─────┴─────┴─────┘  │
│  Note: % of range that falls in each bucket │ ← Region 2 caption
├────────────────────────────────────────────┤
│  Buckets cited: pokerCore/rangeMatrix       │ ← Region 3 (bucket-def citation)
├────────────────────────────────────────────┤
│  v1.0 · 2026-04-24 · pokerCore/rangeMatrix  │
│  POKER_THEORY §3.1 §7.3 · vs UTG 12% · 100bb│
└────────────────────────────────────────────┘
  v1.0 · 2026-04-24                            ← Region 6
```

### Required manifest fields

- `class: 'equity'`
- `generatedFields.equityMatrix` — references `pokerCore/rangeMatrix.js#segmentRangeByBucket(rangeId, texture)`; output is rows of bucket percentages.
- `generatedFields.rangeId` — the range being segmented (e.g., `'UTG_OPEN_12PCT'`).
- `bodyMarkdown` — title / subtitle / bucket-definition citation / caption.
- `assumptions` — required: stakes (may be solver-vs-solver), effective stack, field, **plus `opponentRange`** (which range is being segmented). Without opponentRange, F3 fails.
- `bucketDefinitionsCited` — required: path to bucket-definition glossary (e.g., `"docs/design/glossary/equity-buckets.md"` — bucket definitions out of this spec; assumed to exist when Phase C authoring begins).
- `fidelityChecklist.F5: true` — range-level aggregation explicitly cited per Voice 3 F4 ("range-level aggregation is the acceptable form; per-combo lookup is forbidden on laminate").
- `atomicityJustification` — e.g., `"Single opponent range + single stack depth across N canonical flop textures. One equity-reference table per card."` (≤25 words).

### H-PM05 atomicity justification

**One idea = one (opponent range × stack depth) combination segmented across canonical textures.** A card encoding "UTG 12% range vs 4-8 canonical textures at 100bb" is one unit. Expanding to multiple opponent ranges OR multiple stack depths requires multiple cards. Texture selection is per-card: if authoring authored cards use N=4 or N=8 textures, cards are homogeneous (not N=12 on some and N=4 on others). Atomicity is enforced via `generatedFields.equityMatrix` shape — template validates row count ≤ 8.

### Fidelity bar compliance

- **F1 (no archetype-as-input):** ✓ — equity matrix operates on **ranges** (cited range id from `rangeMatrix`) + **textures** (categorical). No villain labels.
- **F2 (math visible):** ✓ — percentages render with row/column labels + caption explaining the computation ("% of range that falls in each bucket").
- **F3 (scenario-declared):** ✓ — opponentRange cited in Region 1 subtitle.
- **F4 (source-trail footer):** ✓ — pokerCore/rangeMatrix + POKER_THEORY §3.1 §7.3.
- **F5 (pure/exception unambiguous):** ✓ — range-level aggregation only. No per-combo lookup. No prescription "do X on wet board." Pure equity reference — strategy emerges from combining with math cards.
- **F6 (prescriptions computed, not labelled):** ✓ — zero prescriptions on the card. Equity is presented; user decides.

### Known risks

- **Anti-pattern slide risk.** Voice 3 Gate 2 audit flagged this template at YELLOW — "acceptable only as range-level aggregation; per-combo lookup is forbidden on laminate." The template structurally prevents per-combo regression (the matrix is ranges × textures, not combos × textures). Per-card fidelity review at Gate 5 re-verifies.
- **Bucket definition dependency.** `bucketDefinitionsCited` references a glossary doc that must exist at author time. If the glossary doesn't exist yet, equity cards cannot ship. Phase C dependency: `docs/design/glossary/equity-buckets.md` or equivalent authored before PRF-G5-C card authoring begins.

---

## Template 4 — Exceptions

**Class:** `exceptions`
**Phase placement:** Phase C (Plus-tier; last; per-card fidelity review — highest anti-pattern risk).
**Canonical cards:** `PRF-EXCEPTIONS-BB-LIVE-POOL-FLAT-RANGE`, `PRF-EXCEPTIONS-SB-FLAT-3BET-DIVERGENCE`, `PRF-EXCEPTIONS-DONK-COMPOSITION-SKEW`.

### Layout

```
┌────────────────────────────────────────────┐
│  BB live-pool flat range vs BTN             │ ← Region 1
│  $1/$3 live · 100bb · POKER_THEORY §9.2     │
├────────────────────────────────────────────┤
│  Solver baseline:                           │
│  BB defends ~42% vs BTN open (balanced)     │ ← Region 2 (solver baseline)
│                                             │
│  Live-pool divergence:                      │
│  Live BB flats wider (48-52%) + 3bets less  │ ← Region 2 continued: divergence
│  Consequence: postflop range cap shifts     │
├────────────────────────────────────────────┤
│  Override when:                             │ ← Region 3 (override trigger)
│  observed BB 3bet% > 8% AND stakes ≥ $5/$10 │
│  → revert to solver baseline                 │
├────────────────────────────────────────────┤
│  v1.0 · 2026-04-24 · POKER_THEORY §9.2      │
│  audit id: LSW-F2-btn-vs-bb-q72r · $1/$3    │
└────────────────────────────────────────────┘
  v1.0 · 2026-04-24                            ← Region 6
```

### Required manifest fields

- `class: 'exceptions'`
- `bodyMarkdown` — primary content (solver-baseline description + divergence prose + override trigger).
- `generatedFields` — usually empty; content is prose-heavy. Parameterized only if the exception references a computed threshold.
- `assumptions` — required: all F3 fields + `divergenceScope` (e.g., `'live-pool'`, `'online-pool'`, `'tournament'`). Without scope, divergence cannot be contextualized.
- `theoryCitation` — **must** cite POKER_THEORY.md §9.X documented-divergence entry (§9 is the dedicated divergence section; exceptions cards ONLY cite §9 entries — structural enforcement via CI).
- `auditId` — required: the audit id that established the divergence (e.g., `'LSW-F2-btn-vs-bb-q72r'`). Links the card to the evidence.
- `fidelityChecklist.F5: true` — population-baseline deviation with cited audit id per Voice 3 F4.
- `atomicityJustification` — e.g., `"Single line + single population + single divergence from solver. One exception per card with its override trigger."` (≤25 words).

### H-PM05 atomicity justification

**One idea = one divergence from solver baseline in one specific line for one population.** A card encoding "BB live-pool flat vs BTN open at $1/$3 100bb" is one unit. Expanding to cover "all BB divergences" or "all live-pool divergences" collapses independent audit ids into a density that loses the per-divergence traceability — and the divergences don't always correlate (BB-vs-BTN flat-range divergence doesn't imply SB-vs-BTN 3bet-defense divergence).

### Fidelity bar compliance

- **F1 (no archetype-as-input):** ✓ — population is cited as `divergenceScope` (live / online / tournament — descriptive context, not decision input). Override trigger uses observed stats (3bet%), not villain labels.
- **F2 (math visible):** ✓ — divergence expressed as specific ranges + specific frequency deltas (42% → 48-52%); solver baseline cited numerically.
- **F3 (scenario-declared):** ✓ — Region 1 subtitle carries stakes / stacks / theory §.
- **F4 (source-trail footer):** ✓ — POKER_THEORY §9 citation with audit id.
- **F5 (pure/exception unambiguous):** ✓ — **this template IS the exceptions template**; divergence is explicit, baseline is cited, audit id is visible. No mixing with solver-baseline cards.
- **F6 (prescriptions computed, not labelled):** ✓ — override trigger uses observed frequencies ("observed BB 3bet% > 8%"), not labels ("vs tighter BB").

### Known risks

- **Highest anti-pattern risk in the project.** Voice 3 Gate 2 audit recommended per-card fidelity review at Gate 5 for this class — the room for labels-as-inputs creep is largest here (e.g., an author might write "live players flat wider" which slides into label-as-input). The template's structural requirement of `auditId` + `theoryCitation: POKER_THEORY.md §9.X` enforces evidence linkage; Voice-3-equivalent review at Gate 5 verifies prose.
- **Audit-id dependency.** Every exceptions card depends on an existing POKER_THEORY §9 entry with its audit id. Cards cannot be authored for divergences that haven't yet been added to POKER_THEORY §9. Phase C cards are gated on §9 authoring.
- **Override-trigger computability.** Some divergence override triggers (e.g., "when observed X > Y") must be computable from stats the owner can collect in-app. If a trigger requires data the user cannot gather, the card's F6 compliance is theoretical only. Gate 5 review verifies computability per card.

---

## Template registry + manifest-to-template mapping

```js
// src/utils/printableRefresher/cardRegistry.js (sketch)

import PreflopCardTemplate from '../../components/views/PrintableRefresherView/CardTemplates/PreflopCardTemplate.jsx';
import MathCardTemplate from '../../components/views/PrintableRefresherView/CardTemplates/MathCardTemplate.jsx';
import EquityCardTemplate from '../../components/views/PrintableRefresherView/CardTemplates/EquityCardTemplate.jsx';
import ExceptionsCardTemplate from '../../components/views/PrintableRefresherView/CardTemplates/ExceptionsCardTemplate.jsx';

export const TEMPLATE_BY_CLASS = Object.freeze({
  preflop: PreflopCardTemplate,
  math: MathCardTemplate,
  equity: EquityCardTemplate,
  exceptions: ExceptionsCardTemplate,
});

export function getTemplateForManifest(manifest) {
  const Template = TEMPLATE_BY_CLASS[manifest.class];
  if (!Template) throw new Error(`Unknown card class: ${manifest.class}`);
  return Template;
}
```

### Template component contract

Each template exports a React component:

```jsx
// Shape of each template component
function PreflopCardTemplate({ manifest, mode }) {
  // manifest: full card manifest object
  // mode: 'detail' (CardDetail in-app view) | 'preview' (PrintPreview WYSIWYG) | 'print' (@media print)
  //
  // Template renders Regions 1-6 using manifest.bodyMarkdown + manifest.generatedFields
  // `mode` affects CSS (e.g., print mode applies @page rules; detail mode is screen-sized)
}
```

Shared components pulled from `CardTemplates/`:
- `LineageFooter.jsx` — renders Regions 4-5 (all templates use this verbatim).
- `CardCornerStamp.jsx` — renders Region 6 (all templates use this verbatim).
- `CardTitle.jsx` — renders Region 1 with accent color per manifest.class.

Templates own Regions 2-3 internally.

---

## Print-CSS interaction

This spec defines **what** each template renders. `PRF-G4-CSS` (Print-CSS doctrine, pending) defines **how** it renders under `@media print`:

- `@page { size: letter; margin: 0.4in }` — page-level.
- `.refresher-card { break-inside: avoid }` — card-level.
- Per-region CSS classes (`.card-region-title`, `.card-region-primary`, etc.) — template-level.
- `@media print` B&W fallback — forces greyscale; accent colors survive as tones per H-PM02.

PRF-G4-CSS spec (next or later session) defines the full CSS doctrine; this template spec assumes CSS classes are honored without specifying their bodies.

---

## Phase 5 implementation checklist

- [ ] Author `LineageFooter.jsx` + `CardCornerStamp.jsx` + `CardTitle.jsx` — shared components first.
- [ ] Author `MathCardTemplate.jsx` — Phase B starting template.
- [ ] Author `PreflopCardTemplate.jsx` — Phase A conditional template (authors anyway for Q5 differentiation demo at Gate 4 design review).
- [ ] Author `EquityCardTemplate.jsx` — Phase C template.
- [ ] Author `ExceptionsCardTemplate.jsx` — Phase C template with audit-id linkage.
- [ ] Author `cardRegistry.js` — `TEMPLATE_BY_CLASS` map + `getTemplateForManifest` dispatcher.
- [ ] Author Phase B first MVP card manifest (`math-auto-profit.json`) + render it through `MathCardTemplate` + verify:
  - [ ] All 6 regions populate correctly.
  - [ ] 6-point fidelity bar ticks true per manifest.
  - [ ] `contentDrift.test.js` passes for this card.
  - [ ] Playwright evidence `EVID-PHASE5-PRF-S2-MATH-AUTO-PROFIT` captured.
- [ ] Run the Q5 differentiation demo at Gate 4 design review (`PreflopCardTemplate` + `PRF-PREFLOP-OPEN-CO-100BB-2-5` manifest). Owner decides Phase A go/no-go.
- [ ] Only after Phase B ship-validation + Phase A go/no-go: proceed with remaining Phase B cards + conditional Phase A.
- [ ] Phase C templates (`EquityCardTemplate` + `ExceptionsCardTemplate`) authored + first MVP card per template: requires per-card Voice-3-equivalent fidelity review before merge.

---

## Amendment rule

Adding a new card class (5th template) requires:
1. **Persona-level review** (same as anti-patterns.md + copy-discipline.md amendment).
2. New JTBD or new persona that motivates the class (existing 4 classes saturate the current JTBD set per DS-60 + DS-61 coverage).
3. Template spec section added here following the pattern above (layout / required fields / atomicity / fidelity / risks).
4. `TEMPLATE_BY_CLASS` map updated.
5. Gate 5 card authoring runs through the new template independently.

Modifying an existing template (e.g., adding a new region) is possible but invalidates all manifests of that class — schemaVersion bumps across the class; staleness banners fire for all owners who have printed cards of the class. Avoid unless necessary. Default answer is no.

Removing a template is forbidden without Phase 2+ Gate 4 re-design.

---

## Change log

- **2026-04-24 — v1.0 shipped (Gate 4, Session 5 — PRF-G4-S2).** 4 templates authored (Preflop / Math / Equity / Exceptions) with layout / required manifest fields / H-PM05 atomicity justification per template / F1-F6 fidelity compliance per template / known risks per template. Shared template anatomy (6 regions including card-corner physical version-stamp for H-PM07 laminate cross-reference) ratified. Template component contract + template-to-class dispatch + Phase 5 implementation checklist. Amendment rule: persona-level review for new classes.
