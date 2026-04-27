# Session Handoff: printable-refresher-session5
Status: COMPLETE | Written: 2026-04-24

## Backlog Item

Gate 4 Design-side Closeout batch shipped. 10 of 12 Gate 4 carry-forwards now complete. The 2 remaining (CSS + MIG) are infrastructure-only + NEXT-ready. Shipping both closes Gate 4.

Backlog IDs closed this session: **PRF-G4-J / PRF-G4-S2** (2 rows → COMPLETE).

## What I Did This Session

Two design docs authored covering the full Gate 4 design layer — the print-and-re-print journey + per-card-class layout templates. Together they complete the design side of Gate 4; only infrastructure specs (CSS + IDB migration) remain.

**PRF-G4-J — `docs/design/journeys/refresher-print-and-re-print.md`:**
- **5-variation journey** covering the full lifecycle of a laminated reference card:
  - **A First-print** — 8-step catalog-selection → print-preview → PrintConfirmationModal-confirm → `window.print()` dispatch flow. ~60s target. Zero undo after commit (I-WR-5 append-only).
  - **B Stamp-date capture** — sub-flow at step A5/A6 where `printedAt` commitment stamps every card + establishes staleness-diff reference. Date-picker defaults today + editable-backdateable per Q9. Future-date permitted but dev-warned.
  - **C Engine-changes** — silent background state transition: source-util hash change → content-drift CI gate → PR bumps schemaVersion → app deploys → owner's device `selectStaleCards` detects diff on next refresher mount → amber StalenessBanner renders passively. **Zero push / zero badge / zero days-since-bump counter.**
  - **D In-app-diff** — owner-initiated staleness discovery: banner → filter to stale cards → CardDetail staleness footer → LineageModal 7-field drilldown with staleness-diff prose.
  - **E Re-print loop** — CTA `[ Re-print this batch → ]` → Variation A resumes with stale-subset pre-selected. Old batch NOT deleted per I-WR-5.
  - **F Phase 2+ placeholder** — coach-curated-pack apprentice path (not in Phase 1 scope).
- **8 AP-PRF refusals enumerated at journey level** (AP-PRF-02/03/05/06/08/09/10/11 explicitly refused with Variation-specific reasoning).
- **17 red-line per-line compliance assertions mapped.**
- **Copy-discipline ✓/✗ demonstrations per variation.** CD-1 + CD-3 + CD-5 paper-permanence pressure tested with concrete examples. Example: banner `"Your 2026-04-24 batch: 12 of 15 cards current, 3 stale."` ✓ vs `"⚠️ Your cards are out of date!"` ✗.
- **7 Playwright evidence placeholders.**
- **3 critical-design-choice callouts** (preserve across future refresher-adjacent surfaces):
  1. Session-scoped banner dismissal — persistence would require days-since-dismissal counter → AP-PRF-03 / #5 engagement-pressure slide.
  2. Old batch NOT deleted on re-print — `printBatches` append-only per I-WR-5; re-print writes new batch; old batches remain queryable (~1KB/batch storage).
  3. Amber is the only staleness state — no color escalation to red at threshold N; no "⚠️ URGENT"; no false-precision "expires in 3 days." 1 stale renders identically to 15 stale (modulo number).

**PRF-G4-S2 — `docs/design/surfaces/printable-refresher-card-templates.md`:**
- **4 class-specific layout templates:**
  - **Preflop Template** — 13×13 hand grid + sizing hint + Q5-conditional Phase A differentiation gate.
  - **Math Template** — prominent formula + tabulated values + optional corollary. Phase B clearest starting point. Zero anti-pattern risk per Voice 3 audit.
  - **Equity Template** — range-vs-texture matrix with bucket percentages. Phase C Plus-tier. F5 range-level-aggregation-only (per-combo lookup forbidden per Voice 3 F4).
  - **Exceptions Template** — solver-baseline + live-pool divergence + override trigger + mandatory POKER_THEORY §9 audit-id citation. Phase C highest anti-pattern risk. Per-card Voice-3-equivalent fidelity review required at Gate 5.
- **Shared Regions 1-6 anatomy:** title (14pt bold serif, accent color) / subtitle (10pt serif, F3 scenario declaration) / primary content (class-specific layout, ~1.4" height budget on 2.5"×2.25" card) / derivation or exception callout (optional per template, ~0.25") / lineage footer line 1 (9pt greyscale mono `v<semver> · <date> · <source-util>`) / lineage footer line 2 (9pt greyscale serif `<theory> · <assumptions>`) / **Region 6 card-corner physical version-stamp** — rotated 90° counter-clockwise, 7pt serif greyscale, printed in bottom-left corner **inside** the 0.25" safe-trim margin. H-PM07 laminate cross-reference affordance.
- **`TEMPLATE_BY_CLASS` map** dispatches `manifest.class` → React template component.
- **Shared components** (extracted into `CardTemplates/`): `LineageFooter.jsx`, `CardCornerStamp.jsx`, `CardTitle.jsx`.
- **Per-template H-PM05 atomicity justification** enumerated:
  - Preflop: single (position × action × stack × stakes/rake) combination.
  - Math: single formula + its tabulated values at standard sizings.
  - Equity: single (opponent range × stack depth) across canonical textures.
  - Exceptions: single divergence in single line for single population.
- **Per-template F1-F6 fidelity bar compliance** documented with specific structural enforcement.
- **Known risks per template:**
  - Preflop: commodity-competitive market (Upswing / GTO Wizard / BBZ). Q5 differentiation gate at Gate 4 design review decides ship/cut.
  - Equity: anti-pattern slide (per-combo regression). Template structurally prevents via `generatedFields.equityMatrix` row cap.
  - Equity: bucket definition dependency on glossary doc (must exist before Phase C authoring).
  - Exceptions: highest anti-pattern risk; per-card fidelity review required; audit-id dependency on POKER_THEORY §9 entries.
- **Phase 5 implementation checklist** — 9 items including "run Q5 differentiation demo at Gate 4 design review" + "Phase C templates require per-card Voice-3-equivalent fidelity review."

**Governance:**
- **BACKLOG:** 2 PRF-G4-* rows flipped NEXT → COMPLETE with detailed accept criteria. Section header + footer updated (10 of 12 complete, 2 infrastructure remaining).
- **STATUS.md:** new top entry (full detail inline). Parallel Monetization & PMF Session 6 Batch 3 (cancellation + paywall-hit + plan-change journeys) preserved in prior-update stack — no file conflicts (MPMF touched different rows in CATALOG inline widgets; PRF added one row).
- **Charter:** status line updated ("10 of 12 complete; 2 infrastructure-only remain"). Gate 4 closure checklist updated (10 of 12 checked). Decisions Log gained 2 new entries: (a) design-side closeout batch shipped, (b) 3 critical journey design choices (session-scoped dismissal + old-batch-not-deleted + amber-is-only-state) flagged for preservation in future refresher-adjacent surfaces.
- **CATALOG.md:** `printable-refresher-card-templates` added as inline widget at spec-level + change-log entry.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE — no files owned.* Both docs are in a stable, cross-referenceable state. Next session can freely touch any PRF file.

## Uncommitted Changes

Created in this session:
- `docs/design/journeys/refresher-print-and-re-print.md`
- `docs/design/surfaces/printable-refresher-card-templates.md`

Modified in this session:
- `docs/design/surfaces/CATALOG.md` (new `printable-refresher-card-templates` row in Inline Widgets table + change-log entry)
- `docs/projects/printable-refresher.project.md` (status line + Gate 4 closure checklist 10/12 + 2 Decisions Log entries)
- `.claude/BACKLOG.md` (2 row state changes + section header + section footer)
- `.claude/STATUS.md` (top entry + prior-update preservation of parallel MPMF S6-B3 entry)

**NOT modified by this session:**
- Writers / content-drift CI / selectors / charter ACP / anti-patterns / copy-discipline / heuristics / primary surface spec — all shipped prior sessions; no changes required.
- JTBD domain files / persona files / other surface specs — design-side closeout doesn't need persona or JTBD additions (prior sessions covered).

## What's Next

**2 Gate 4 carry-forwards remain; both infrastructure-only; both NEXT-ready.** Recommended: ship them **together** as the Gate 4 closeout session.

**PRF-G4-CSS** — print-CSS doctrine spec. Defines HOW the templates render under `@media print`:
- `@page { size: letter; margin: 0.4in }` — page-level layout.
- `.refresher-card { break-inside: avoid; page-break-inside: avoid }` — card-level break prevention.
- `.card-region-*` per-region CSS classes with typography scale (body 10pt floor / table-body 8pt floor / headline 12pt / lineage-footer 9pt / corner-stamp 7pt).
- 6-hue deuteranopia-safe accent palette (navy / burnt orange / ochre / teal / charcoal / maroon).
- B&W fallback — `@media print` greyscale enforcement; accent survives as tone.
- Grid layout for 12-up / 6-up / 4-up / 1-up modes with per-mode card dimensions.
- Cross-browser test matrix (Chrome primary / Firefox secondary / Safari tertiary per S1).
- Explicit ban on html2canvas / jsPDF rasterization paths per V5 D5.

**PRF-G4-MIG** — IDB v18/v19 migration spec. Defines the additive schema migration:
- Target version: dynamic `max(currentVersion + 1, 18)` per Q6 owner ratification (inherits EAL Gate 4 P3 §2 precedent for collision with Shape Language).
- Stores: `userRefresherConfig` (singleton keypath `id: 'singleton'` — shape per S1 §State) + `printBatches` (keypath `batchId: UUID v4` + index `printedAt`; shape per S1 §State).
- Additive-only — zero mutations to existing stores.
- Migration idempotent — if either store already exists at target version, skip creation.
- Schema validators for both stores (shape documented per WRITERS.md).
- Fake-indexeddb test coverage for migration round-trip (mirrors existing EAL / exploit-deviation patterns).

**Shipping both closes Gate 4. Gate 5 card authoring unblocks once PRF-G4-CI test is IMPLEMENTED + green** (the `contentDrift.test.js` file + supporting infrastructure — `cardRegistry.js`, `lineage.js`, `stalenessDiff.js` — must be authored first, per non-negotiable sequencing). PRF-G5-B (Phase B Math Tables) remains the clear starting point once implementation begins. Phase A (Preflop) conditional on Q5 differentiation demo at Gate 4 design review. Phase C (Equity + Exceptions) last with per-card Voice-3-equivalent fidelity review.

## Gotchas / Context

1. **3 critical journey design choices are preserve-across-future-surfaces patterns.** When future refresher-adjacent surfaces (Study Home when it's authored, Range Lab export, line-study sheets, anchor-library exports) get their own spec work, inherit these 3: session-scoped dismissal (not persisted) / old-state-not-deleted (append-only) / single color state for warning (no escalation). Each is motivated by a specific autonomy anti-pattern: persistence → engagement counter slide; deletion → data loss risk; escalation → urgency framing slide. Document the inheritance explicitly — don't re-derive these choices for each new surface or drift is inevitable.

2. **Region 6 card-corner physical version-stamp is NOT the same as the lineage footer.** Footer (Regions 4-5) carries the full lineage line 1+2 at 9pt greyscale bottom of card. Corner stamp (Region 6) is a rotated 7pt `v<semver> · <date>` in the bottom-left corner, inside the safe-trim margin. Purpose: the corner stamp survives lamination glare + is readable at arm's length even when the full footer is too dim or too compressed to parse. Both carry date; both are on every card; serve different legibility contexts. If Phase 5 engineer wants to consolidate "just use one date label," refuse — H-PM07 requires the corner variant specifically for laminate cross-reference.

3. **Preflop Template ships at Gate 5 anyway for Q5 differentiation demo — even if Phase A will be cut.** The template needs to exist for the Gate 4 design review to happen; the review uses the authored template to render a sample preflop card that gets compared to the Upswing free pack. If the comparison shows the PRF card is visibly indistinguishable, Phase A is cut + project links to Upswing. If the comparison shows differentiation (rake-aware + stakes-selected + lineage-stamped), Phase A ships. The template authoring is prerequisite to the review — we can't decide without something to decide on.

4. **Exceptions Template is the highest Gate 5 risk.** Voice 3 Gate 2 audit flagged this template at YELLOW. Structurally the template prevents label-as-input regression via `theoryCitation: POKER_THEORY.md §9.X` enforcement + `auditId` requirement + divergenceScope-as-descriptive-context-not-decision-input rules. But prose-level slippage is hard to catch with regex alone. Gate 5 MUST run per-card Voice-3-equivalent review on every exceptions card before merge. If a future session tries to ship 4+ exceptions cards in one PR without per-card review, redirect — one-card-one-review is the cadence.

5. **Equity Template depends on bucket-definition glossary that doesn't exist yet.** `bucketDefinitionsCited` field references a file like `docs/design/glossary/equity-buckets.md`. That file hasn't been authored. Before PRF-G5-C can author equity cards, the glossary must exist. Add authoring that glossary to the Phase C prep list; it's a prerequisite I didn't explicitly flag in the S2 spec but it is load-bearing.

6. **Variation B (stamp-date) is NOT a separate variation from Variation A** — it's the focused sub-flow at A5/A6. Documented separately because the date commitment is where permanence is established, and the rules around the date-picker (defaults today / editable / backdateable / future-date-allowed-but-dev-warned / no-schedule-print / no-remind-in-60-days) deserved dedicated enumeration. If a future session asks "what's the difference between A and B?" the answer is: "B is A's step 5/6 zoomed in."

7. **`selectCardsForBatchPrint` defense-in-depth drops suppressed cards even if explicitly selected.** The `CardCatalog` UI prevents selecting suppressed cards (filter is applied before checkbox). But the selector layer also drops them at the print-boundary — if a UI bug were to allow selection, the final print would still exclude them. Red line #13 durable-suppression is honored at both UI layer + selector layer. Document this if a future engineer is confused why "I selected this card but it didn't print."

8. **Variation E re-print pre-selects STALE SUBSET ONLY, not the full prior batch.** Common intent: owner saw "3 of 15 stale" and wants to re-print just those 3. If they want a full re-print of all 15, they can re-select in the catalog. Gate 5 engineer: do NOT default to "re-print all cards from prior batch" — that's busier behavior + the selector is `selectStaleCards(...)` by construction.

9. **Region 6 stamp specifics matter for lamination — 0.25" safe-trim is non-negotiable.** H-PM04 says no load-bearing content in the outer 0.25". If the rotated stamp drifts into that zone during Phase 5 implementation, laminate heat-seal will eat part of it. CSS absolute-positioning must clamp inside the margin; test with actual laminate pouches at Gate 5 PDF snapshot time.

10. **Parallel session coordination.** Monetization & PMF Session 6 Batch 3 (3 commerce journeys) shipped between my PRF S4 and S5. No file conflicts — MPMF added 3 rows to CATALOG inline widgets (cancellation / paywall-hit / plan-change); I added 1 row (printable-refresher-card-templates). Different rows. STATUS.md top entry re-asserted; MPMF S6-B3 preserved in prior-update stack.

## System Model Updates Needed

None this session. PRF remains pre-code. SYSTEM_MODEL.md updates cumulatively required when Gate 5 ships code remain as enumerated in prior handoffs — see session4 handoff §System Model Updates Needed for the current list.

## Test Status

No tests run (zero code changes). Design-doc session only. Pre-session test baseline per STATUS.md prior entries: 7238/7239 (1 pre-existing precisionAudit flake). No regressions possible.
