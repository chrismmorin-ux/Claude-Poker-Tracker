# Surface — Printable Refresher

**ID:** `printable-refresher`
**Parent surface:** top-level routed view (`SCREEN.PRINTABLE_REFRESHER`, new route added in Phase 5). `parentSurface: 'study-home (pending authorship — first Gate 4 to need it authors)'`.
**Product line:** Main app. No extension-side equivalent — refresher is a study-mode / reference-mode activity incompatible with the sidebar's live-decision focus and its at-the-table glance-budget.
**Tier placement:** Phase B (Math Tables) free / lead-gen. Phase A (Preflop) conditional on Q5 differentiation-demo at Gate 4 design review. Phase C (Texture-Equity + Exceptions Codex) Plus-tier. Per Q5 owner ratification 2026-04-24.
**Intent mode:** **Reference** (first explicit `currentIntent: 'Reference'` surface under Shape Language three-intent taxonomy — write-silent at reducer boundary per red line #11).
**Last reviewed:** 2026-04-24 (Gate 4, Session 3).

**Code paths (future — Phase 5 of printable-refresher project):**
- `src/components/views/PrintableRefresherView/PrintableRefresherView.jsx` (new — route root)
- `src/components/views/PrintableRefresherView/CardCatalog.jsx` (new — filter + sort + virtualized list)
- `src/components/views/PrintableRefresherView/CardDetail.jsx` (new — single-card preview with lineage drilldown + hide/pin/suppress actions)
- `src/components/views/PrintableRefresherView/PrintPreview.jsx` (new — WYSIWYG sub-view rendering exactly what will print)
- `src/components/views/PrintableRefresherView/PrintControls.jsx` (new — page size + cards-per-sheet + color mode + include-lineage toggle)
- `src/components/views/PrintableRefresherView/PrintConfirmationModal.jsx` (new — per-batch print-date entry + batch summary + warnings)
- `src/components/views/PrintableRefresherView/StalenessBanner.jsx` (new — batch-level informational banner; passive)
- `src/components/views/PrintableRefresherView/LineageModal.jsx` (new — "Where does this number come from" 7-field detail)
- `src/components/views/PrintableRefresherView/CardEmptyState.jsx` (new — newcomer empty-state below threshold)
- `src/hooks/useRefresherConfig.js` (new — IDB-backed `userRefresherConfig` hook; mirrors `useAssumptionPersistence`)
- `src/hooks/useRefresherView.js` (new — filter + sort + expanded-card state; localStorage-persisted)
- `src/hooks/usePrintPreview.js` (new — print-media CSS switcher + print-window orchestration)
- `src/utils/printableRefresher/index.js` (new — barrel)
- `src/utils/printableRefresher/cardRegistry.js` (new — card class definitions + manifests)
- `src/utils/printableRefresher/selectors.js` (new — `selectActiveCards` / `selectAllCards` / `selectPinnedCards` per PRF-G4-SL)
- `src/utils/printableRefresher/lineage.js` (new — `computeLineage`, `hashUtil`, `printFooter`)
- `src/utils/printableRefresher/stalenessDiff.js` (new — per-card diff vs print-time snapshot)
- `src/utils/printableRefresher/writers.js` (new — frozen W-URC-1/2/3 registry per PRF-G4-W)
- `src/utils/printableRefresher/manifests/*.json` (new — one manifest per card)
- `src/styles/printable-refresher.css` (new — `@page` + `@media print` + grid)

**Related docs:**
- `docs/projects/printable-refresher.project.md` §Acceptance Criteria (ACP) — 17 red lines + 11 APs + 5 CDs + 6-point fidelity bar + source-util whitelist/blacklist
- `docs/projects/printable-refresher/anti-patterns.md` — feature-layer refusals cited at this surface
- `docs/projects/printable-refresher/copy-discipline.md` — language-layer refusals enforced at this surface
- `docs/design/heuristics/printable-artifact.md` — H-PM01-08 all load-bearing here (the printed artifact is the physical counterpart of this surface)
- `docs/design/heuristics/mobile-landscape.md` + `docs/design/heuristics/nielsen-10.md` — in-app view
- `docs/design/heuristics/poker-live-table.md` — the surface is NOT a live-table surface itself but the printed artifact the surface produces is
- `docs/design/personas/core/chris-live-player.md` §Autonomy constraint — red lines inherited #1-9
- `docs/design/personas/core/scholar-drills-only.md` — primary study-block consumer
- `docs/design/personas/core/rounder.md` — carry-reference secondary consumer
- `docs/design/personas/core/apprentice-student.md` — coach-curated-pack secondary consumer
- `docs/design/personas/situational/stepped-away-from-hand.md` — primary printed-artifact host situation (the four off-hand-at-venue contexts)
- `docs/design/personas/situational/presession-preparer.md` — pre-session review + stale-check
- `docs/design/personas/situational/post-session-chris.md` — post-session card-vs-played-hand lineage drill
- `docs/design/jtbd/domains/drills-and-study.md` §DS-60 (carry-the-reference-offline) + §DS-61 (export-personal-codex, Phase 2+)
- `docs/design/jtbd/domains/cross-cutting.md` §CC-82 (trust-the-sheet lineage) + §CC-83 (know-my-reference-is-stale staleness)
- `docs/design/jtbd/domains/session-entry.md` §SE-04 (pre-session kinesthetic visualization)
- `docs/projects/printable-refresher/gate3-owner-interview.md` §Q1..Q9 — owner ratifications ground decisions on this surface
- `docs/design/audits/2026-04-24-blindspot-printable-refresher-rerun.md` — GREEN verdict re-run that unblocked this surface spec
- `docs/design/surfaces/printable-refresher-card-templates.md` (pending — PRF-G4-S2) — per-card-class layout templates
- `docs/design/journeys/refresher-print-and-re-print.md` (pending — PRF-G4-J) — 5-variation print journey

---

## Purpose

The flat, filterable catalog of every reference card in the refresher library — active, pinned, and suppressed. It is **the catalog + the print pipeline**, not the content-authoring pipeline. Cards render in-app preview; user prints via browser print-dialog; lineage modal surfaces the 7-field provenance per red line #12.

The surface fulfills **flat access** (red line #6) — suppression hides a card from default print-export but never removes it from the catalog. The "Show suppressed" toggle reveals hidden cards with their status annotation. Owner-initiated actions are the only write-paths: hide / pin / suppress / configure / print. No matcher-system writer; no auto-tailoring; no proactive surfacing (red line #15 + AP-PRF-02 + AP-PRF-09).

The surface also carries the staleness-surfacing contract for printed batches (red line #10) — passive batch-level banner + per-card amber footer on diff. The laminate at the table cannot know it is stale; this surface is the sole staleness channel (H-PM07 first-of-its-kind paper-medium heuristic).

### Non-goals (explicit)

- **Not a drill surface.** `currentIntent: 'Reference'` is dispatched at mount; no skill-state mutation; no grading; no "test yourself" affordance. If pairing a card with a drill is desired, explicit intent-switch to `Deliberate` routes to the drill surface (red line #17 + AP-PRF-06 refusal).
- **Not a personalization surface in Phase 1.** No "your personalized pack tonight"; no per-villain tailoring; no play-data-driven card ordering. Phase 2+ opt-in deferred per Q7 (PRF-P2-PE) with explicit Gate 4 design pass required.
- **Not a social surface.** No QR codes; no "share this card"; no watermark for social engagement (AP-PRF-10).
- **Not a leaderboard.** Default sort is theoretical order (preflop → math → postflop → exceptions) or alphabetical by card ID. "Biggest edge" sort does not exist in the enumeration (AP-PRF-01).
- **Not a usage-tracking surface.** No "you've viewed this card N times"; no mastery score; no streak (AP-PRF-03 + AP-PRF-04 + AP-PRF-11 + red line #14 structural).
- **Not an export-format buffet.** Browser print-dialog → Save-as-PDF is the default. No jsPDF / html2canvas / rasterizing path (V5 D5 banned rasterization — kills <10pt glyphs). Static PNG/SVG export deferred to future Plus-tier feature only.
- **Not Study Home.** `parentSurface: 'study-home (pending)'` placeholder. Printable Refresher ships standalone-routed; Study Home authorship is deferred per Shape Language Gate 3 Q1 + PRF Voice 5 D1b.
- **Not a per-villain calibration surface.** Calibration lives on-screen only (Calibration Dashboard). No per-villain-calibrated util appears in any card's source-trail footer (F6 + source-util blacklist enforced by PRF-G4-CI).

---

## JTBD served

**Primary:**
- **`JTBD-DS-60`** — Carry-the-reference-offline. The primary JTBD this surface exists for. Hosts: `stepped-away-from-hand` situational (4 canonical contexts: stepped-away-between-hands / seat-waiting / tournament-break / pre-session-at-venue).
- **`JTBD-CC-82`** — Trust-the-sheet (lineage-stamped reference). Served by lineage footer on every card + lineage modal drilldown + "Where does this number come from?" tap affordance.
- **`JTBD-CC-83`** — Know-my-reference-is-stale (staleness surfacing). Served by batch-level banner + per-card amber footer + per-card diff-since-print details in lineage modal.
- **`JTBD-SE-04`** — Pre-session kinesthetic visualization. Served in `presession-preparer` context: hero flips through pinned cards 15-30 min pre-session, rehearses key decision scaffolds by feel.

**Secondary:**
- **`JTBD-DS-48`** — Understand villain's range composition. Equity-bucket cards inherit from this — but content comes from range-util derivation, not per-villain calibration.
- **`JTBD-DS-49`** — Weighted-total EV decomposition. Auto-profit / bluff-catch math cards inherit derivations from POKER_THEORY §6.
- **`JTBD-DS-51`** — Understand villain's range shape on any flop. Flop-texture × hand-type equity cards inherit (reformulated per F6 — equity reference, not prescription).
- **`JTBD-MH-04`** — Sizing tied to calling range (geometric-betting card).
- **`JTBD-MH-09`** — SPR-aware strategy cues (SPR zones card).
- **`JTBD-ON-87`** — Cold-start descriptor seeding (expert-bypass onboarding — refresher is one of the entry points for ON-87's "here are the references you'll be using" flow).
- **`JTBD-DS-61`** — Export-the-personal-codex (Phase 2+ only; LATER).

**Not served (explicit non-goals):**
- **`JTBD-DS-57`** — Capture-the-insight. Capture lives on `hand-replay-observation-capture` surface. This surface is read-side for engine utils + POKER_THEORY derivations.
- **`JTBD-DS-58`** — Validate-confidence-matches-experience. Calibration Dashboard's job; never on printable cards per F6.
- **`JTBD-DS-59`** — Retire-advice-that-stopped-working. Anchor-library + retirement journey; printable cards inherit anchor retirements via source-hash re-computation + staleness surfacing, but the retirement action itself lives elsewhere.
- **`JTBD-MH-*`** — live mid-hand jobs. Surface is study / reference mode only; printed artifact is at-table but the surface itself is not.

---

## Personas served

**Primary:**
- **`chris-live-player`** — primary owner. Prints laminates for `stepped-away-from-hand` off-hand-at-venue windows + reviews in-app pre-session + inspects staleness.
- **`scholar-drills-only`** — primary study-block consumer. Generous cognitive budget; densest interaction with filters + lineage modal + per-card detail. Prints for rote-memory rehearsal.

**Secondary:**
- **`rounder`** — carry-vetted-reference goal (amended 2026-04-24). Prints basic math tables + preflop charts for at-venue reference.
- **`apprentice-student`** — coach-curated printable pack receiver. Phase 2+ might surface coach-authored pack imports; Phase 1 ships flat catalog only.
- **`presession-preparer`** (situational) — pre-session 15-30 min review window. Surface rendering **hides** drift/trend detail per Voice 1 Stage C #5 (not this surface — applies to parallel surfaces like Anchor Library; PRF catalog shows staleness batch banner but does not show sparklines).
- **`stepped-away-from-hand`** (situational, cross-persona) — primary hosting situation of the **printed artifact** (not the in-app surface). The surface produces the laminate the situational consumes.
- **`post-session-chris`** (situational) — post-session card-vs-played-hand review via lineage modal deep-dive.
- **`returning-after-break`** (situational) — re-opening refresher after ≥28-day gap; high staleness probability; batch banner is load-bearing here.

**Tertiary:**
- **`circuit-grinder`** — ICM-specific cards (Phase A / C conditional).
- **`weekend-warrior`** — starter packs (Phase A only; simplified card set if Phase A ships).
- **`newcomer`** — **gated below threshold.** `CONSTANTS.PRF_UNLOCK_THRESHOLD_SESSIONS = 1` (Q8 ratified). Surface reachable from day one (red line #6 flat access) but catalog renders factual empty-state until 1 completed session exists.

**Explicitly excluded:**
- **`mid-hand-chris`** — no in-app refresher access mid-hand (H-PLT01 1.5s budget; app use forbidden per `mid-hand-chris.md`). The **laminate** is permitted but **only in off-hand windows per Q3 venue policy** at Wind Creek / Homewood / Horseshoe Hammond / Rivers Des Plaines — this is handled by `stepped-away-from-hand` situational, not mid-hand.
- **`between-hands-chris`** — out of primary scope; laminate glance is plausible but app-side is villain-profile-centric here.

---

## Anatomy

### Top-level view — `PrintableRefresherView`

```
┌── PrintableRefresherView ────────────────────────────────────────┐
│  [← Back]  Printable Refresher                       (Esc key)    │
├──────────────────────────────────────────────────────────────────┤
│  [ StalenessBanner — batch-level, passive, AMBER on diff ]        │
│  "Your 2026-04-24 batch: 12 of 15 cards current, 3 stale."        │
│  [Review stale cards] [Dismiss — I'll check later]                │
├──────────────────────────────────────────────────────────────────┤
│  Filters row (flex-wrap; localStorage-persisted via useRefresherView):
│  Class:    [ All ] [ Preflop ] [ Math ] [ Equity ] [ Exceptions ] │
│  Stakes:   [ All ] [ $1/$3 ] [ $2/$5 ] [ $5/$10 ] [ MTT ]         │
│  Stacks:   [ All ] [ 60bb ] [ 100bb ] [ 150bb ]                   │
│  Status:   [ Active ] [ Pinned ] [ Suppressed ]                   │
│                                                                   │
│  Sort: [ Theoretical order (default) ▾ ]  Showing N of M cards    │
│                                                                   │
│  [ Print selected batch → ]    [ Print preview → ]                │
├──────────────────────────────────────────────────────────────────┤
│  ┌── CardCatalog — virtualized vertical list ─────────────────┐   │
│  │  ┌── Card row ───────────────────────── [📌] [👁] [⛔] [ⓘ] ┐ │   │
│  │  │  PRF-PREFLOP-OPEN-CO-100BB                               │ │   │
│  │  │  Preflop open range · CO · 100bb · $2/$5 · rake 5% cap5  │ │   │
│  │  │  v1.2 · 2026-04-24 · pokerCore/preflopCharts.js           │ │   │
│  │  │                               ● current (printed 2026-04-24)│ │   │
│  │  └──────────────────────────────────────────────────────────┘ │   │
│  │  ┌── Card row (stale) ───────────────── [📌] [👁] [⛔] [ⓘ] ┐ │   │
│  │  │  PRF-MATH-AUTOPROFIT                                     │ │   │
│  │  │  Auto-profit bluff thresholds · rake-agnostic · all SPR  │ │   │
│  │  │  v1.0 · 2026-04-18 · pokerCore/ · POKER_THEORY §6.3      │ │   │
│  │  │                  ⚠ stale (rake config changed 2026-04-22) │ │   │
│  │  └──────────────────────────────────────────────────────────┘ │   │
│  │  ┌── Card row (suppressed) ─────────── [📌] [👁] [⛔] [ⓘ] ┐ │   │
│  │  │  PRF-EXCEPTIONS-DONK-SKEW (suppressed by owner)           │ │   │
│  │  │  Exceptions codex · donk-composition live-pool skew      │ │   │
│  │  │  v1.0 · 2026-04-20                        ⊘ suppressed     │ │   │
│  │  └──────────────────────────────────────────────────────────┘ │   │
│  │  ...                                                          │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Card-row action chips (top-right of each row)

- **📌 Pin** — pin card for "pinned-first" print ordering. Toggle. Persists in `userRefresherConfig.cardVisibility[cardId] = 'pinned'`.
- **👁 Hide / Show** — hide individual card from default print-export. Toggle. `cardVisibility[cardId] = 'hidden'`. Still visible in catalog unless "Show suppressed" filter is off.
- **⛔ Suppress class** — suppress the entire card class permanently. Durable across engine + app version bumps (red line #13). Triggers confirmation modal; 2-tap + "I understand" checkbox. `suppressedClasses` array mutation.
- **ⓘ Detail** — opens `CardDetail` sub-view for the card. ≥44×44 tap target (H-ML06).

### Sub-view: `CardDetail`

```
┌── CardDetail (route: /refresher/card/:cardId) ───────────────────┐
│  [← Back to catalog]                                              │
├──────────────────────────────────────────────────────────────────┤
│  PRF-PREFLOP-OPEN-CO-100BB                                        │
│  CO open, 100bb, $2/$5, 5% rake-cap $5, 9-handed live $1/$3 field │
│                                                                   │
│  [ Card preview rendering — WYSIWYG at 2×2.25" scale ]            │
│  │                                                     │          │
│  │   [ actual card content rendered here ]              │          │
│  │                                                     │          │
│  └──────────────────────────────────────────────────────┘         │
│                                                                   │
│  Lineage footer (7-field):                                         │
│  v1.2 · 2026-04-24 · src/utils/pokerCore/preflopCharts.js          │
│       · POKER_THEORY §3.2 · stakes/rake/stack/field bundle above   │
│  [ Where does this number come from? → ]                           │
│                                                                   │
│  Staleness status:                                                 │
│  ● Current — no changes since last print (2026-04-24 batch)        │
│                                                                   │
│  Actions:                                                          │
│  [ Pin ]  [ Hide from print ]  [ Suppress this class permanently ] │
└──────────────────────────────────────────────────────────────────┘
```

### Sub-view: `LineageModal` (opens from "Where does this number come from?")

```
┌── LineageModal ──────────────────────────────────────── [✕] ─┐
│  Lineage — PRF-PREFLOP-OPEN-CO-100BB                          │
├──────────────────────────────────────────────────────────────┤
│  1. Card ID + version:     PRF-PREFLOP-OPEN-CO-100BB v1.2     │
│  2. Generated:             2026-04-24T12:34:56Z               │
│  3. Source util:           src/utils/pokerCore/preflopCharts.js
│                            #computeOpenRange                  │
│                            @ sha256:a3c1d8f…                  │
│  4. Engine + app version:  engine v4.7.2 / app v123           │
│  5. Theory citation:       POKER_THEORY.md §3.2 (equity       │
│                            realization) + §4.1 (rake-adj EV)  │
│  6. Assumption bundle:     $2/$5 cash · 5% rake cap $5 no-flop│
│                            -no-drop · 100bb eff · 9-handed    │
│                            live $1/$3 field                   │
│  7. Bucket definitions:    N/A (no villain-style descriptors) │
│                                                              │
│  [ Open source util in viewer → ]   (build-time-linked)       │
│                                                              │
│  Staleness diff:                                              │
│  No changes since 2026-04-24 print.                           │
└──────────────────────────────────────────────────────────────┘
```

### Sub-view: `PrintPreview` (route: /refresher/print-preview)

```
┌── PrintPreview — WYSIWYG ─────────────────────────────── [Close] ┐
│  Page: Letter (8.5×11")   Layout: 12-up (3×4 grid)                │
│  Color: Auto            Include lineage footer: On                │
│                                                                   │
│  [ PrintControls panel — same as trigger controls in main view ]  │
│                                                                   │
│  ┌── Rendered page preview (@media print CSS applied) ──────────┐ │
│  │  ┌────┐┌────┐┌────┐                                          │ │
│  │  │card││card││card│                                          │ │
│  │  └────┘└────┘└────┘                                          │ │
│  │  ┌────┐┌────┐┌────┐                                          │ │
│  │  │card││card││card│                                          │ │
│  │  └────┘└────┘└────┘                                          │ │
│  │  ┌────┐┌────┐┌────┐                                          │ │
│  │  │card││card││card│                                          │ │
│  │  └────┘└────┘└────┘                                          │ │
│  │  ┌────┐┌────┐┌────┐                                          │ │
│  │  │card││card││card│                                          │ │
│  │  └────┘└────┘└────┘                                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Tips: "Disable browser headers for best result · Ctrl-P to print"│
│                                                                   │
│  [ Send to browser print dialog → ]                               │
└──────────────────────────────────────────────────────────────────┘
```

### Sub-view: `PrintConfirmationModal`

Opens when user clicks "Send to browser print dialog." User must confirm the print action and enter the date. This modal is the only write-path to `printBatches`.

```
┌── PrintConfirmationModal ─────────────────────────────── [✕] ─┐
│  Confirm batch print                                           │
├───────────────────────────────────────────────────────────────┤
│  You are about to print:                                       │
│  • 15 cards (Letter, 12-up = 2 pages)                          │
│  • Selected: all active + pinned; 0 suppressed; 0 hidden       │
│                                                                │
│  When will you print these?                                    │
│  [2026-04-24 ▼]   (defaults to today; editable)                │
│  "This is the date stamped on cards + used for staleness diff."│
│                                                                │
│  Batch label (optional):                                        │
│  [_________________________]  ("Home game refresh" etc.)       │
│                                                                │
│  Reminder:                                                     │
│  "Disable browser headers + footers for best laminate result." │
│  "If a card is cut off, check the A4-vs-Letter setting."       │
│                                                                │
│  [ Cancel ]              [ Confirm and open print dialog → ]   │
└───────────────────────────────────────────────────────────────┘
```

**On confirm:** W-URC-3 `print-date-stamp-writer` writes the batch to IDB `printBatches` store with `{ batchId: uuid(), printedAt: userDate, cardIds: [...], engineVersion: ..., appVersion: ..., perCardSnapshots: { cardId: contentHash, ... } }`. Then browser `window.print()` dialog opens.

### Card-row action — confirmation for Suppress

```
┌── SuppressConfirmModal ──────────────────────────────── [✕] ─┐
│  Suppress card class?                                         │
├──────────────────────────────────────────────────────────────┤
│  Suppressing "PRF-EXCEPTIONS-DONK-SKEW" will:                 │
│  • Hide this card from all print exports (past + future).     │
│  • Keep it visible in the catalog under "Suppressed" filter.  │
│  • Persist across app + engine updates.                       │
│  • You can un-suppress any time — the system will not nudge.  │
│                                                              │
│  [ ] I understand this is a permanent suppression.           │
│                                                              │
│  [ Cancel ]                      [ Suppress this class → ]    │
└──────────────────────────────────────────────────────────────┘
```

Confirmation follows the EAL `RetirementConfirmModal` pattern + red line #13 durable-suppression guarantees. `[ Suppress this class → ]` button disabled until checkbox ticked.

### Empty states

- **Newcomer below threshold:** `"Complete 1 session to enable the printable refresher. The library activates once the first session has been completed — no further action required."` Factual; no progress bar; no countdown; no engagement pattern (red line #5 + AP-PRF-03 refusal).
- **Zero filter matches:** `"No cards match your filters. [Clear filters]"` active action.
- **All cards suppressed (edge case):** flat list of suppressed cards remains visible per red line #6; empty "active" tab shows `"All cards are currently suppressed. Toggle Status: Suppressed to view + un-suppress."`
- **First-time load (pre-seed):** skeleton loader; does not show "no cards" copy until manifest registry has completed loading.

---

## State

- **UI (`useUI`):** `currentScreen === SCREEN.PRINTABLE_REFRESHER`. `currentIntent: 'Reference'` dispatched at mount (red line #11 enforcement — reducer-boundary test PRF-G5-RI asserts zero mutation of skill-state stores under this intent across the session).
  - Sub-routes: `/refresher`, `/refresher/card/:cardId`, `/refresher/print-preview`.
- **Refresher config (`useRefresherConfig`):** IDB-backed `userRefresherConfig` singleton (v18+ store). Keypath `id: 'singleton'`. Fields:
  - `schemaVersion: 1`
  - `cardVisibility: { [cardId]: 'default' | 'hidden' | 'pinned' }`
  - `suppressedClasses: string[]` — durable class-level hide
  - `printPreferences: { pageSize: 'letter' | 'a4', cardsPerSheet: 12 | 6 | 4 | 1, colorMode: 'auto' | 'bw', includeLineage: boolean, includeCodex: false /* Phase 1 default structural */ }`
  - `notifications: { staleness: boolean /* default false per AP-PRF-08 */ }`
  - `lastExportAt: ISO8601 | null`
- **Print batches (`usePrintBatches`):** IDB-backed `printBatches` store (v18+). Keypath `batchId: UUID`. Each batch: `{ batchId, printedAt: ISO8601, label: string | null, cardIds: string[], engineVersion, appVersion, perCardSnapshots: { [cardId]: { contentHash: string, version: semver } } }`.
- **Catalog (`useRefresherCatalog`):** derived; reads `cardRegistry.js` manifests + applies selectors per PRF-G4-SL.
- **View state (`useRefresherView`):** localStorage-persisted.
  - `filters: { classes: [], stakes: [], stacks: [], statuses: ['active', 'pinned'] /* default: active + pinned; suppressed requires explicit toggle */ }`
  - `sort: 'theoretical' | 'alphabetical' | 'lastPrinted' | 'pinnedFirst'` — default `'theoretical'`. **Explicitly NOT present:** `'biggestEdge' / 'mostUsed' / 'mostPopular'` (AP-PRF-01 / AP-PRF-11).
  - `selectedCardIds: Set<string>` — which cards are queued for the next print batch. Session-scoped; not persisted.

### Mutations (write-paths)

All mutations are **owner-initiated**. No matcher, no automated writer. Writers per PRF-G4-W:

- **W-URC-1 — `config-preference-writer`** — settings panel updates (pageSize, cardsPerSheet, colorMode, includeLineage, notifications.staleness). Debounced 400ms.
- **W-URC-2 — `card-visibility-writer`** — per-card pin / hide / suppress actions. Immediate write. Suppress-class triggers confirmation modal before write.
- **W-URC-3 — `print-date-stamp-writer`** — writes a new `printBatches` record on `PrintConfirmationModal` confirm. Includes user-entered date + per-card content-hash snapshot at time of print.

**Reducer-boundary assertion (red line #11 test PRF-G5-RI):** no dispatch originating from this surface mutates `shapeMastery`, `villainAssumption`, or any skill-state store. `currentIntent: 'Reference'` guarantees this structurally.

### Environment assumptions

- `RefresherConfigProvider` mounted at app root (Phase 5 task).
- `userRefresherConfig` + `printBatches` stores seeded via v18+ migration (fresh schema guarantees this).
- `useScale` available for responsive scaling per 1600×720 landscape convention.
- `cardRegistry.js` manifests loaded at build time via dynamic imports on app boot.

---

## Props / context contract

### `PrintableRefresherView` props
- `scale: number` — viewport scale from `useScale`.

### Context consumed
- `useRefresherConfig()` — config singleton read + writer invocations via reducer dispatch.
- `useRefresherCatalog()` — catalog manifests + selectors.
- `useRefresherView()` — filter + sort + selection state.
- `usePrintBatches()` — past print batches + staleness-diff input.
- `useUI()` — navigation (to / from parent surface), toast dispatch, `currentIntent` state.

### Intent dispatch (first explicit Reference-mode surface)

On mount: `dispatch({ type: UI_SET_CURRENT_INTENT, payload: 'Reference' })`. On unmount: `dispatch({ type: UI_SET_CURRENT_INTENT, payload: null })`. Reducer asserts no concurrent mutation of skill-state stores under Reference (PRF-G5-RI).

---

## Key interactions

1. **Navigation in.** From nav home OR deep-link from toast ("View in refresher"). Mount dispatches `currentIntent: 'Reference'`.
2. **Filter change.** Tap a class / stakes / stacks / status chip → toggles its inclusion → list re-renders. Chip state visually obvious (filled vs outline). Multi-select within a group is additive (OR); across groups is conjunctive (AND). localStorage-persisted.
3. **Sort change.** Tap sort dropdown → 4-option menu → select → list re-orders. Default `'theoretical'` restored on "Reset sort" (first option in dropdown, labeled `"Theoretical order (default)"`).
4. **Pin card.** Tap 📌 icon on card row → toggles pinned state → row annotated + pin icon filled. Pinned cards sort to top under `'pinnedFirst'` sort option. Writer W-URC-2 immediate.
5. **Hide card.** Tap 👁 icon → toggles hidden state → row dimmed + excluded from default print-export (still visible in catalog unless "Status: Suppressed" toggled off).
6. **Suppress class.** Tap ⛔ icon → opens `SuppressConfirmModal` → user checks "I understand" + confirms → W-URC-2 writes `suppressedClasses` array addition. Durable; no future nudge (AP-PRF-05 refused). Un-suppress via the same icon in the "Suppressed" filter view.
7. **Card detail.** Tap ⓘ icon OR card row body → navigate to `/refresher/card/:cardId`. Card preview renders + lineage footer visible + actions available.
8. **Lineage modal.** In `CardDetail`, tap "Where does this number come from?" → opens `LineageModal` with 7-field detail + source-util deep-link (build-time-generated URL to repo file).
9. **Staleness banner.** Passive amber banner appears on mount when any card in any past `printBatch` has `contentHash` diverging from current registry hash. Tap "Review stale cards" → filter list to `status: 'stale'` (derived). Tap "Dismiss — I'll check later" → banner stays dismissed for session only (returns on next session-start; not persisted as a dismissal record — no "days-since-dismissal" counter, no nag pattern).
10. **Select for print.** Tap cards to select for batch → selected cards get visual checkbox. "Print selected batch" button enables + shows count. Non-selection of suppressed/hidden is structural.
11. **Print preview.** Tap "Print preview →" → navigate to `/refresher/print-preview`. WYSIWYG preview with `@media print` CSS applied unconditionally via `.print-preview-container` wrapper.
12. **Print controls change.** In preview, adjust page size (Letter/A4), cards-per-sheet (12/6/4/1), color mode (Auto/B&W), include-lineage (on/off). Changes update preview + persist to `userRefresherConfig.printPreferences` via W-URC-1 (debounced 400ms).
13. **Send to print.** Tap "Send to browser print dialog →" → opens `PrintConfirmationModal`. User enters print-date (defaults today) + optional label → confirm → W-URC-3 writes batch + `window.print()` fires.
14. **Intent-switch for drill pairing** (red line #17). If a card has a "Drill this card" button (Phase 2+ feature), tap dispatches `currentIntent: 'Deliberate'` + navigates to drill surface. Button copy is explicit "Drill this card" — never "Review this card" (ambiguous, refused per CD-2 + red line #17).
15. **Back navigation.** Back button OR Escape → previous route. Navigation out dispatches `currentIntent: null` (or restores previous intent if entered mid-session).

### Keyboard / accessibility
- Filter chips: standard buttons, Tab-reachable, Enter/Space toggle.
- Sort dropdown: standard `<select>`, arrow-key navigation.
- Card row action chips: Tab-reachable icon buttons; Enter activates; focus ring visible.
- `LineageModal`: focus-trapped; Escape closes.
- `PrintConfirmationModal`: focus-trapped; Escape cancels; Tab cycle includes [date input → label input → Cancel → Confirm].
- `SuppressConfirmModal`: focus-trapped; confirm button disabled until checkbox focused + checked (Space toggle).
- Status dots + amber stale indicator: `aria-label` with status text ("stale: rake config changed 2026-04-22").
- Every card row has `data-card-id` attribute for test selectors + deep-link anchor.

---

## Anti-patterns refused at this surface

This surface enforces the following feature-layer refusals from `anti-patterns.md`:

- **AP-PRF-01 — Card leaderboard.** Default sort is `'theoretical'`; enumeration does NOT include `'biggestEdge'`. Enforced in `printableRefresher/sortStrategies.js` (named export list tested at Gate 5).
- **AP-PRF-02 — "Card of the day" auto-surface.** No rotating-selection banner; no "today's card" section; no auto-highlight. Opening the surface renders the static catalog with filters applied.
- **AP-PRF-03 — Print-streak visualization.** Batch banner does not show "consecutive print batches" / "days since last print" / "you've printed N times." Only shows "N of M cards current, K stale" (informational).
- **AP-PRF-04 — "Mastery score" per card.** No scalar score per card. Card row shows version + date + source-util + current-status-chip only.
- **AP-PRF-05 — "Retired cards you might reconsider" nudges.** Suppressed cards visible in Suppressed filter view per red line #6; no auto-surface; no "reconsider" prompt. Un-suppress requires explicit owner action via the same ⛔ icon.
- **AP-PRF-06 — "Your refresher accuracy" graded-work framing.** No surface element measures owner's use of the refresher. Copy is model-accuracy and content-descriptor framing throughout.
- **AP-PRF-07 — Cross-surface contamination.** Surface renders no `TableView` / `LiveAdviceBar` / `CalibrationDashboard` components. Source-util blacklist (charter ACP §Source-util whitelist) prevents any card from sourcing per-villain calibration. Reducer-boundary test asserts no skill-state mutation under Reference intent.
- **AP-PRF-08 — Engagement notifications default-on.** `userRefresherConfig.notifications.staleness: false` structural default. Opt-in toggle exists in settings panel; renders passive in-app banner only when enabled + never push / email / badge.
- **AP-PRF-09 — Auto-personalized print pack.** No play-data-driven card ordering; no per-villain tailoring; `printPreferences.includeCodex: false` Phase 1 structural. Phase 2+ opt-in (PRF-P2-PE) gated by dedicated Gate 4 design pass.
- **AP-PRF-10 — Watermark-based social engagement.** Lineage footer is factual utility only. No QR code, no share button, no "Printed by Chris" branding, no social-proof insertion.
- **AP-PRF-11 — Card-view analytics surfaced to owner.** No "you've viewed this card N times" element. View-counts are not tracked internally per red line #14.

EAL-inherited refusals (AP-01..AP-09 from `docs/projects/exploit-anchor-library/anti-patterns.md`) apply transitively wherever refresher surfaces intersect anchor / calibration surfaces (e.g., a card citing a POKER_THEORY §9 divergence backed by an EAL anchor inherits the parent anti-pattern register).

---

## Red-line compliance checklist (Gate 5 test targets → PRF-G5-RL)

All 17 red lines asserted on this surface.

**Inherited red lines (#1-9):**

- **#1 Opt-in enrollment** — surface does not produce any skill-state write; reducer-boundary test asserts zero mutation under `currentIntent: 'Reference'`. No enrollment toggle on this surface (inherited structural).
- **#2 Full transparency on demand** — lineage modal ≤2 taps from any card (tap ⓘ → "Where does this come from?" → modal opens).
- **#3 Durable overrides** — suppression survives app + engine version bumps; test PRF-G5-DS asserts post-bump persistence.
- **#4 Reversibility** — un-suppress via same icon; "Reset visibility" in settings resets all cardVisibility; incognito mode (if Phase 2+) disables per-card view tracking. Per-card + global reset are ≤3 taps.
- **#5 No streaks / engagement-pressure** — no streak counter, no "days since," no timer, no countdown. Banner is informational.
- **#6 Flat access** — suppressed cards visible via "Status: Suppressed" filter. Test: `selectAllCards().length === renderedCardsWhenShowSuppressedOn.length`.
- **#7 Editor's-note tone** — empty-state copy "Complete 1 session to enable" / "No cards match your filters" / staleness banner "3 stale" are factual; no nudge, no pressure, no imperative verbs. Matches CD-1.
- **#8 No cross-surface contamination** — surface renders no live components; no per-villain data. Test: assert no `TableView` / `LiveAdviceBar` / `CalibrationDashboard` render paths are children.
- **#9 Incognito observation mode** — N/A directly (refresher doesn't capture observations); structurally subsumed by #11.

**New PRF-specific red lines (#10-17):**

- **#10 Printed-advice permanence requires in-app staleness surfacing** — batch-level `StalenessBanner` passive on mount when any batch's card has diverging contentHash; per-card amber footer in `CardDetail` when staleness detected. Test: seed 2 batches with diverging engine versions → banner renders correctly.
- **#11 Reference-mode write-silence at reducer boundary** — on mount, `currentIntent: 'Reference'` is dispatched; reducer asserts no mutations of `shapeMastery` / `villainAssumption` / etc. Test PRF-G5-RI: spy on 15 MVP card opens + verify zero skill-state writes.
- **#12 Lineage-mandatory on every card** — every rendered card (catalog row + detail + print preview) carries all 7 lineage fields. Test PRF-G5-LG: snapshot every rendered card's lineage; assert 7-field completeness across 15 MVP cards.
- **#13 Owner-suppression is durable indefinitely** — `suppressedClasses` persists across simulated schemaVersion bump + engine version bump + app version bump. Test PRF-G5-DS.
- **#14 No completion / mastery / streak tracking even digital** — surface contains no view-count display, no progress bar, no streak counter. Test: grep rendered DOM for forbidden-string list ("mastered", "streak", "days since", "X times").
- **#15 No proactive print-output** — `window.print()` fires only after explicit user confirmation in `PrintConfirmationModal`. Surface has no auto-trigger, no background PDF generation, no notification/banner initiating a print action.
- **#16 Cross-surface segregation bidirectional** — (a) surface writes nothing to live-advice state or other surfaces; (b) surface reads only from approved source-utils (whitelist per ACP). Source-util blacklist enforced at build by PRF-G4-CI (content-drift CI). Test: simulated source-util scan of manifest registry; fail if any manifest references blacklisted path.
- **#17 Intent-switch mandatory for drill-pairing** — Phase 2+ drill-pair buttons use "Drill this card" copy (explicit); dispatch switches `currentIntent` → `'Deliberate'` + navigates to drill surface. Test (Phase 2): assert button copy + intent dispatch on click.

---

## Known behavior notes

- **Virtualized list** — catalog renders a virtualized vertical-scroll list (react-window or equivalent); default ~4-6 visible rows at 1600×720 under `useScale ≈ 0.45`. Row height ~140px at scale.
- **Card row thumbnail** — cards render as metadata rows in catalog (no thumbnail). Rationale: at scale 0.45, a thumbnail would be <120px wide — too small for meaningful preview. Preview lives in `CardDetail` sub-view. Matches Voice 5 §Stage E scaling analysis.
- **Staleness banner dismissal scope** — dismiss is session-scoped, not persisted. Rationale: persisted dismissal would invite "X days since dismissal" tracking which violates AP-PRF-03 + #5. Passive re-appearance on next visit is the intended behavior; owner controls cadence by acting on the banner, not by dismissing.
- **Pin vs pinned-first sort interaction** — pinning a card does not automatically re-sort; "pinned-first" is an explicit sort option. Rationale: pinning is a user's per-card importance signal; sorting is a view preference. Keeping them orthogonal avoids the AP-PRF-01 edge case where "pinned-first + theoretical secondary" turns pins into an implicit leaderboard.
- **PrintConfirmationModal default-date** — today's date, editable. User can back-date when confirming print after the fact (e.g., printed yesterday but forgot to mark). This matches H-PM07 (owner-entered print-date is the staleness reference).
- **Suppression confirmation is 2-tap + checkbox** — deliberate friction for a permanent action (red line #13 durable). Matches EAL `RetirementConfirmModal` pattern.
- **Phase 1 `includeCodex: false` structural** — personal-codex export (DS-61) is Phase 2+. Control is present in PrintControls but disabled with tooltip "Personal codex export available in Phase 2+."
- **Browser print headers are out of our control** — we surface a copy cue "Disable browser headers for best laminate result." Matches Voice 5 §Stage D5.
- **No automatic PDF generation** — browser print dialog → Save as PDF is the path. Playwright `page.pdf()` is used only in CI snapshot tests (PRF-G5-PDF), never shipped to users.
- **Drill-pair affordance is Phase 2+** — Phase 1 surface has no "Drill this card" buttons on cards. Red line #17 enforcement is forward-looking structural + test-assertion at Phase 2 Gate 4.
- **Source-util deep-link in LineageModal** — build-time-generated `new URL('src/utils/pokerCore/...', import.meta.url)` link. Opens in in-app file-viewer (if present) or falls back to a plain link. Future Plus-tier feature: open in GitHub with commit SHA. Out of Phase 1 scope.
- **`currentIntent: 'Reference'` is the first explicit use of the taxonomy** — Shape Language Gate 3 defined it; PRF is the first surface that crystallizes it at the reducer boundary. Future Reference-mode surfaces (planned: Study Home, Range Lab export, etc.) inherit the PRF-G5-RI test pattern.

---

## Known issues

None at creation — new surface. First audit will be Gate 4 design-review pass.

Placeholder for future audit findings:
- [PR-TBD-*] — findings to be added as they surface.

---

## Test coverage

### Unit tests (Phase 5 target — PRF-G5-*)

- `CardCatalog.test.jsx` — filter chip toggle, multi-select within group, clear-all, virtualization row-visibility.
- `CardRow.test.jsx` — lineage footer rendering, action chip tap targets (≥44×44), staleness amber indicator mapping.
- `CardDetail.test.jsx` — layout, lineage footer render, action buttons wiring, amber staleness footer when diff detected.
- `LineageModal.test.jsx` — 7-field rendering, source-util deep-link format, staleness-diff prose generation.
- `PrintPreview.test.jsx` — `@media print` CSS applied via `.print-preview-container`, page-size + cards-per-sheet re-layout.
- `PrintControls.test.jsx` — settings writes debounced 400ms, `includeCodex` disabled Phase 1, color-mode toggle.
- `PrintConfirmationModal.test.jsx` — date picker default = today, batch summary correct, W-URC-3 writer invoked on confirm, `window.print()` fires after IDB commit resolves.
- `SuppressConfirmModal.test.jsx` — confirm button disabled until checkbox ticked, W-URC-2 suppress-class write.
- `StalenessBanner.test.jsx` — passive appearance, session-scoped dismissal, "Review stale cards" filter navigation.
- `PrintableRefresherView.test.jsx` — full view render across states: newcomer-locked, active, mixed-staleness, all-suppressed.
- `useRefresherView.test.js` — localStorage persistence for filter/sort.
- `useRefresherConfig.test.js` — IDB write via W-URC-1/2/3 across actions.
- `usePrintBatches.test.js` — batch append + query + staleness-diff input.
- `printableRefresher/sortStrategies.test.js` — assertion: `'biggestEdge'` NOT exported (AP-PRF-01 enforcement).
- `printableRefresher/selectors.test.js` — `selectAllCards` includes suppressed (red line #6); `selectActiveCards` excludes hidden + suppressed; `selectPinnedCards` subset.
- `printableRefresher/lineage.test.js` — 7-field shape; contentHash stability; schemaVersion validation.
- `printableRefresher/stalenessDiff.test.js` — diff correctness across source-util version bumps.

### Integration tests (Phase 5)

- `PrintableRefresherView.e2e.test.jsx` — filter → select batch → print preview → confirmation → IDB write → print-fire.
- **PRF-G5-RL red-line assertion suite** — 17 assertions, one per red line per Gate 4 ACP.
- **PRF-G5-RI reducer-boundary write-silence test** — mount surface + open 15 MVP cards + verify zero skill-state mutations.
- **PRF-G5-DS durable-suppression test** — suppress class + simulate schemaVersion bump + verify suppression persists.
- **PRF-G5-LG lineage footer test** — snapshot 15 MVP cards' lineage objects + assert 7-field completeness.

### Visual verification (Playwright — PRF-G5-PDF)

- `EVID-PHASE5-PRF-S1-NEWCOMER-EMPTY` — newcomer below-threshold empty state.
- `EVID-PHASE5-PRF-S1-POPULATED-ACTIVE` — catalog with 15 MVP cards, active filter.
- `EVID-PHASE5-PRF-S1-CARD-DETAIL` — single-card detail with lineage footer.
- `EVID-PHASE5-PRF-S1-LINEAGE-MODAL` — modal expanded with 7-field content.
- `EVID-PHASE5-PRF-S1-PRINT-PREVIEW-LETTER-12UP` — print preview Letter 12-up layout.
- `EVID-PHASE5-PRF-S1-PRINT-PREVIEW-A4-6UP` — print preview A4 6-up layout.
- `EVID-PHASE5-PRF-S1-PRINT-PREVIEW-BW` — B&W fallback render.
- `EVID-PHASE5-PRF-S1-CONFIRMATION-MODAL` — print confirmation with date picker.
- `EVID-PHASE5-PRF-S1-SUPPRESSION-MODAL` — suppress-class confirmation.
- `EVID-PHASE5-PRF-S1-STALENESS-BANNER` — amber banner with staleness count.

### Print-snapshot tests (Playwright `page.pdf()`)

- `prf-letter-12up-bw.pdf` — deterministic reference PDF at Letter 12-up B&W; compared byte-for-byte in CI on engine/util bumps.
- `prf-a4-6up-color.pdf` — A4 6-up color variant.
- Cross-browser matrix: Chrome (primary), Firefox (secondary), Safari (tertiary). Firefox known to rasterize CSS grid inconsistently below 10pt; test range is 10pt+ per H-PM01.

---

## Cross-surface dependencies

- **Study Home (pending — cross-project surface)** — `parentSurface: 'study-home (pending)'`. Refresher is a Reference-mode embed candidate. Authorship deferred per Shape Language Gate 3 Q1 + PRF Voice 5 D1b.
- **Card Templates (`printable-refresher-card-templates`, PRF-G4-S2)** — defines per-card-class layout templates consumed by `CardDetail` + `PrintPreview`. S2 blocks on S1 (this file).
- **Refresher Print + Re-Print Journey (`refresher-print-and-re-print`, PRF-G4-J)** — 5-variation journey: first-print / stamp-date / engine-changes / in-app-diff / re-print-prompt. J blocks on S1.
- **Calibration Dashboard (`calibration-dashboard`)** — **NOT a cross-surface dependency.** Per F6 + source-util blacklist, refresher cards never read calibration state. The two surfaces are deliberately isolated.
- **Anchor Library (`anchor-library`)** — also NOT a cross-surface dependency for the same reason. Anchors inform POKER_THEORY §9 divergence entries; divergence entries inform certain refresher cards. But anchor calibration state never appears on refresher.
- **Drill surfaces (preflop-drills / postflop-drills)** — Phase 2+ intent-switch target for "Drill this card" affordance. Phase 1 has no direct dependency.
- **Settings (`settings-view`)** — refresher notification opt-in lives in settings (AP-PRF-08 opt-in default OFF). Settings reads `userRefresherConfig.notifications.staleness` + writes via W-URC-1.
- **Toast Container** — batch-print confirmation toast + suppress-class confirmation toast fire via `useUI().showToast`.
- **IDB migration (`v17 → v18` or `v19` per dynamic rule)** — PRF-G4-MIG authors the migration adding `userRefresherConfig` + `printBatches` stores. Migration is additive-only; no existing-store modifications. Coordinate with Shape Language per `max(currentVersion + 1, 18)` rule (EAL Gate 4 P3 §2 precedent).

---

## Change log

- 2026-04-24 — v1.0 authored as Gate 4 Session 3 artifact (PRF-G4-S1). Full anatomy (5 sub-views: catalog + card-detail + lineage-modal + print-preview + print-confirmation + suppression-confirm) + filter/sort/action-chip specs + 17 red-line compliance checklist with per-red-line test targets + 11 AP-PRF refusals with allowed-alternatives + state contract + writers + cross-surface dependencies + Phase 5 code-path plan (~18 new files across views / hooks / utils / manifests / styles) + 10 Playwright evidence placeholders + print-snapshot test matrix. `parentSurface: 'study-home (pending)'` placeholder. First explicit `currentIntent: 'Reference'` surface under Shape Language three-intent taxonomy — reducer-boundary write-silence test PRF-G5-RI is the load-bearing Gate 5 assertion. Zero code changes.
