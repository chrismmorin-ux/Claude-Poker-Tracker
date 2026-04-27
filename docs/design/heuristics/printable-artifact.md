# Domain Heuristics — Printable Artifact

Heuristics specific to *physical laminated reference cards* designed to sit on the felt at a live poker table. These compose with Nielsen's 10 and with `poker-live-table.md` (H-PLT01-08) but are invented specifically for paper as a medium: paper cannot update, paper cannot animate, paper cannot tell you it is stale, and paper is visible to villains across the table.

Reference IDs: `H-PM01` through `H-PM08`. Consolidated at Gate 4 (2026-04-24) from Gate 2 Voice 1 (H-PRF01-05) + Voice 5 (H-PM01-06) per the Printable Refresher project.

Parent project: `docs/projects/printable-refresher.project.md`.
Parent audit: `docs/design/audits/2026-04-24-blindspot-printable-refresher.md` §Voice 1 + §Voice 5.
Re-run ratification: `docs/design/audits/2026-04-24-blindspot-printable-refresher-rerun.md` §Stage E ("H-PM01-08 consolidated").

---

## H-PM01 — Laminate-scale readability + glanceability

The printed card must be readable in ≤1.5s at arm's length (~40cm / ~14") in the typical dim ambient light of a live poker room. This binds body text, headline sizing, and contrast.

**Implications for print-CSS + layout:**

- **Body text floor: 10pt** for sustained reading; **table-body floor: 8pt**; **below 8pt banned** (sub-pixel breakage at 300dpi inkjet after lamination glare).
- **Headline: ≥ 12pt bold** — scannable answer-first.
- **Contrast ≥ 4.5:1** (WCAG AA floor) for body text against card background. High contrast survives lamination glare better than subtle color shifts.
- **Font family:** serif for body (Source Serif Pro or system serif) — serifs improve legibility at small sizes under glare better than sans. Monospaced (Inconsolata / system mono) at 10pt for poker tables where digit alignment matters.

**Test procedure.** Print a proof sheet. Laminate it. Hold at arm's length at 14". Read aloud without squinting. If fails, card is non-compliant.

**Violated when:**
- Body text drops below 10pt on a standard 2.5"×2.25" card.
- Headline blends into body weight at a glance.
- Primary answer is buried below a long preamble (violates "answer-first" — owner's eye lands on headline and consumes within 1.5s).

---

## H-PM02 — Color-blind + B&W + ink-budget

Cards must remain fully legible under three parallel constraints: deuteranopia / protanopia vision, B&W printing (many home printers produce muddy mid-tones or are monochrome), and low ink-budget (cost-per-card + laminate durability).

**Implications for print-CSS + palette:**

- **Never use red/green as the only signal pair.** Shape + position + label always accompany color.
- **6-hue accent palette chosen for deuteranopia distinguishability:** navy (`#1e3a5f`), burnt orange (`#c05621`), ochre (`#b8860b`), teal (`#0f766e`), charcoal (`#374151`), maroon (`#7f1d1d`). One accent per card class; never more than one accent per card.
- **B&W fallback:** accent color must survive greyscale (each hue tested at 25% / 50% / 75% grey equivalency). Color-only signal banned; label + weight + shape carry the semantics.
- **Ink budget: < 5% coverage per card.** No full-bleed color fills. Accent is used only for: card-class badge, one horizontal rule, line-art icons. Tables use 0.5pt rules; no zebra-stripes; no background shading.

**Test procedure.** Render card. View in deuteranopia simulation + B&W conversion. All semantic distinctions remain. Ink coverage measured via PDF preflight tool — card fails if > 5%.

**Violated when:**
- Value vs bluff categories are distinguished only by red / green text.
- A heatmap uses 5 hues that collapse to 3 in greyscale.
- A dense 20-row table uses alternating grey background fill (burns ink + loses contrast under lamination).

---

## H-PM03 — Finger-pointing row/cell accuracy

Paper has no tap target but does have a finger-and-eye scan target. The owner's index finger isolates a row or cell at arm's length; adjacent-row ambiguity at 14" distance is a failure mode.

**Implications for table / grid layout:**

- **Minimum row height: 4mm** (≈11pt at 300dpi) for dense tables with numbers in every row.
- **Minimum cell size (grid charts like preflop open ranges):** 4mm × 4mm — the full 13×13 preflop chart must fit this floor, which constrains card size (a 13×13 chart at 4mm cells = 52mm square = ~2" — fits on a 2.5"×2.25" card body).
- **Visual row separation:** 0.5pt rule OR 2px whitespace gap (either works at 14" distance; hairline rules survive lamination better than whitespace-only).

**Violated when:**
- An equity matrix packs 6 rows per cm (~1.5mm per row) — fingers + eyes can't isolate a row at arm's length.
- Row separators are absent AND whitespace gap is < 2px — adjacent rows blur under lamination glare.

---

## H-PM04 — Lamination-friendly safe-trim margin

Lamination pouches cut at the printed card boundary with some tolerance. Content too close to the edge risks being hidden under the heat-sealed margin or cut off entirely. The 0.25" safe-trim margin inside each card boundary is load-bearing — laminators vary in alignment tolerance + the pouch edge bonds inward.

**Implications for print-CSS:**

- **0.25" (≈6mm) safe-trim margin inside each card boundary.** No load-bearing content inside the outer 0.25".
- **Lineage footer placed inside the safe margin** (9pt greyscale on inner 0.25" band, clear of the trim zone).
- **Crop marks via `::after` pseudo-elements** on card corners, toggleable — help the owner cut to the intended boundary before lamination.

**Violated when:**
- Critical digits in a table extend to within 3mm of card edge.
- Accent rule is placed at card edge as a visual flourish — lamination eats half of it.

---

## H-PM05 — One-idea-per-card atomicity

Each card must encode exactly one reference unit — one decision point, one formula + worked example, or one reference table the owner consults as a unit. This is the **load-bearing** heuristic at Gate 5 card authoring; each card ships with an atomicity justification.

**Definition of "one idea":**

- ✓ A preflop open-raise chart **by one position at one stack depth** (e.g., CO 100bb open).
- ✓ A flop-texture × hand-type cbet matrix **for one stack-depth × one rake-config** (dense but unitary).
- ✓ Auto-profit formula **with its worked example at a stated sizing / pot**.
- ✓ SPR zones → commitment consequence reference (5 zones with consequence column; single reference table).
- ✗ "All preflop math" — too broad; collapses positional variation + stack-depth variation.
- ✗ "UTG open" (just one hand category, not the full open chart) — too narrow; wastes a card.
- ✗ A "preflop open + 3-bet defense + 4-bet defense for CO" — three distinct decision nodes on one card; unitarity fails.

**Rule for Gate 5 card authoring.** Every card authored at Gate 5 must include a `cardManifest.atomicityJustification` field — a <25-word explanation of what the "one idea" is and why this card is the right atomic unit for it. Reviewer (Gate-5-voice equivalent) signs off on justification before merge.

**Violated when:**
- A card tries to cover multiple positions, multiple stack depths, OR multiple decision nodes on one surface.
- A card content's reference-consultation unit is "depends on sub-section" — the card is unreadable at 1.5s glance (violates H-PM01 as a compound).

---

## H-PM06 — Print-first, no dynamic-rendering-assumption

Any content element that would normally animate, toggle, expand, or reveal-on-hover in-app cannot translate to paper. If a card's in-app version requires interaction to be legible, the print version fails.

**Implications for card design:**

- **Design print-first.** Card content renders fully in a single static view. In-app view is a rendering pass on top of the printable corpus — not the other way around (charter Working Principle #5).
- **No collapsible sections.** If the full derivation doesn't fit on the card at 10pt body, the card's atomicity is wrong (H-PM05); split into two cards.
- **No hover/tap reveals.** All critical content is visible at first sight.
- **No progressive disclosure.** Paper has no state; everything is present at once.

**Allowed in-app enhancements (optional, never load-bearing):**
- Lineage-drilldown modal (tapping the card opens full 7-field lineage).
- Print-preview mode showing exactly what will print.
- Hover tooltips with plain-text glossary entries (but the card body must not require them).

**Violated when:**
- Card's in-app version has a "Show derivation" button that reveals content not visible on paper.
- Card's in-app version has a tooltip revealing a critical caveat; printed version omits the caveat.
- Card design relies on color-cycling animation to distinguish categories.

---

## H-PM07 — Staleness channel is in-app only

**Once laminated, a card cannot tell the owner it is stale.** The app is the sole staleness channel. This is a first-order failure mode specific to the paper medium — no prior surface in the product has this property.

**Implications:**

- **Every card carries its semver + generation-date + engineVersion-hash stamp in the lineage footer** (red line #12 enforces). Owner can cross-reference to in-app per-card "current version" view.
- **In-app per-card view computes diff since print** and surfaces the delta passively ("No changes since print" / "Math unchanged; exception clause updated 2026-05-01" / "Stale: rake assumption changed 2026-05-15 — re-print recommended").
- **Batch-level banner** on refresher home: "Your 2026-04-24 batch: N of M cards current, K stale." Informational, not red, not pushy.
- **No push notifications. No badge counters. No "days since re-print" timer.** (Red line #10 + AP-PRF-03 + AP-PRF-08 enforce.)
- **Physical version-stamp on card corner** (e.g., `v1.0 · 2026-04-24`) survives lamination; lets owner cross-reference against in-app "current version" without needing the lineage footer to be legible under glare.

**Violated when:**
- A printed card carries no version stamp in its footer or corner — staleness comparison is impossible without remembering print date from memory.
- Staleness surfaces as push notification ("Your card is stale! Re-print now!") — violates red line #10 passive-surfacing requirement.
- Staleness UI uses urgency framing ("Re-print soon!" / "Your cards expire in 3 days") — violates CD-3 engagement copy rule.

---

## H-PM08 — Socially discreet laminate

Paper sits on the felt, visible to villains across the table. Like the in-app surfaces (H-PLT04), the printed card must not scream "I am consulting a cheat sheet." Laminate design is the paper analog of socially-discreet UI.

**Implications for layout + branding:**

- **Prefer monochrome or single-accent layouts.** Large colored blocks visible across the table are social signals.
- **Small card size (index-card-scale).** 2.5"×2.25" or 3"×5" is unobtrusive; letter-sized printed sheets at the table are obvious cheat sheets.
- **No branding visible to villains.** "Printable Refresher · v1.0" brand in a 9pt corner footer, not a prominent header. Owner knows what it is; villains see a plain card.
- **Avoid logo-style elements.** No company logos, no stylized symbols that read as "tech product" from across the table. Plain typography, plain rules.
- **B&W default** (compounds with H-PM02 B&W fallback) is also the most discreet — color laminates read as manufactured / commercial; B&W laminates read as homemade notes.

**Violated when:**
- Card uses bright color blocks or heavy accent fills visible from 6 feet away.
- Card has a large "Printable Refresher" header or company branding in prominent position.
- Card is letter-sized (8.5"×11") — pulling it out at the table is conspicuously non-casual.

---

## Applying these alongside Nielsen + H-PLT

Nielsen heuristics are broad; H-PLT heuristics are live-table narrow; H-PM heuristics are paper-medium narrow. In an audit or Gate 5 card review:

1. Run through **H-N01…H-N10** first for the in-app rendering pass.
2. For the in-app view specifically (card catalog, lineage modal, print-preview), also run through **H-PLT01…H-PLT08** since the surface is at-table-accessible.
3. For every card's printed artifact, run through **H-PM01…H-PM08** (this file). All 8 must pass before the card clears Gate 5.
4. A finding may cite multiple heuristics across the three files — that strengthens severity. For example, "card edge content cut by lamination" cites both H-PM04 (safe-trim) and H-N09 (error recovery — no recovery once laminated).

**Weight priorities by situation:**

- **Mid-hand-chris 1.5s glance budget** (physical laminate only — app forbidden per `personas/situational/mid-hand-chris.md`): H-PM01 (glanceability) + H-PM08 (social discretion) dominate.
- **Stepped-away-from-hand paper-reference windows** (primary PRF use case — `personas/situational/stepped-away-from-hand.md`): H-PM01 + H-PM03 (finger-pointing) + H-PM05 (atomicity) dominate.
- **Presession-preparer review at home** (laminate inspection + staleness check before session): H-PM07 (staleness) + in-app Nielsen heuristics dominate; physical heuristics (H-PM04 lamination) are inspection-only at this phase.
- **Post-session review comparing printed card to played hand** (PRF-NEW-2 trust-the-sheet, CC-82): lineage footer load-bearing; H-PM07 staleness channel consulted.

---

## Relationship to other frameworks

| Heuristic set | Scope | File |
|---|---|---|
| Nielsen 10 | Universal usability | `docs/design/heuristics/nielsen-10.md` |
| Mobile Landscape | Small-screen + landscape-specific | `docs/design/heuristics/mobile-landscape.md` |
| Poker Live Table | At-the-table attention + social + dim | `docs/design/heuristics/poker-live-table.md` |
| **Printable Artifact** | **Paper-medium specific** | **This file** |

**First-of-its-kind properties of this set:** H-PM07 (staleness-channel-is-in-app-only) is a heuristic unique to the paper medium — no prior heuristic set in the product has a heuristic whose entire domain is "this affordance cannot exist on this medium." Future non-refresher paper artifacts (e.g., printable session summaries, exported study packs) will inherit the H-PM set without re-authoring.

---

## Change log

- **2026-04-24 — Created.** Consolidated from Gate 2 Voice 1 (H-PRF01-05) + Voice 5 (H-PM01-06) per Printable Refresher Gate 4 ACP ratification. 8 heuristics (merged overlapping entries: V1's glanceability + V5's readability → H-PM01; V1's B&W printability + V5's color-blind + V5's ink-budget → H-PM02). 6-month cadence review per design-framework convention.
