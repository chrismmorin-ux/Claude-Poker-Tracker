# Gate 2 Voice 1 — Product/UX — Printable Refresher

**Date:** 2026-04-24
**Voice:** Product/UX lead
**Stages owned:** A (persona sufficiency), C (situational stress), E (heuristic pre-check on in-app view AND printed artifact)

## Summary

The existing persona cast (Chris + Scholar + Rounder + Apprentice + Newcomer + Coach) covers the *consumers* of a Printable Refresher, but the framework has no model for **paper-reference-at-table** — the defining use case. `mid-hand-chris` forbids in-app surfaces at 1.5s glance budget (H-PLT01), but the laminate sits physically on the felt and is *allowed* there. I recommend option **(A) amend `mid-hand-chris` with a `paper_reference_permitted` attribute** over authoring a new situational persona — the cognitive state is identical, only the affordance differs. Stage C finds five of seven situationals have targeted adjustments; Stage E flags four obvious heuristic risks on the in-app view and three paper-specific ones needing new heuristic IDs. **Verdict: ⚠️ across all three stages — patch, don't rebuild.**

## Stage A — Persona sufficiency

### A1. Cast coverage

**Chris + Scholar + Apprentice cover 90% of consumers.** No new core persona needed. Three small gaps:

- **Coach-assigning-printable-pack is a real workflow.** The `coach.md` core persona curates study material for apprentices; printing a tailored pack ("here are the 5 laminates I want you carrying at $1/$3 this month") is the physical analog of an assigned drill pack. This is covered *adequately* by the existing Coach + Apprentice pair — but the Apprentice persona should be amended with a bullet under *Goals* (new: "Receive coach-curated printable packs as physical study aids"). **Not a new persona; a 1-line amendment.** See A3.
- **Rounder is secondary but under-articulated.** Rounder's *Frustrations* already flags "Mobile tools are thin; desktop tools don't work at a live table." The laminate is the answer to that frustration — worth adding one bullet under Rounder *Goals* ("Carry vetted reference to the table without touching the phone").
- **Circuit Grinder / ICM-specific printable cards** — out of primary Gate 2 scope but on the Gate 4/5 backlog (Voice 2 owns competitive content scope).

### A2. Novelty resolution — I recommend **(A) amend `mid-hand-chris`**

Authoring a new `at-table-with-laminate` situational persona (option B) is tempting but wrong. The cognitive state, time pressure, attention budget, one-handedness, and recovery expectation for `mid-hand-chris` are all **identical whether or not a laminate is on the felt** — what changes is what affordances are *permitted*. That's an attribute, not a distinct persona. Option C (scope away from mid-hand) contradicts the owner's stated primary use case — the whole feature exists because "laminate on the table" is the job.

**Concrete amendment to `mid-hand-chris`:** add under *Context* or as a new section:

> **Paper-reference-permitted attribute.** Physical reference artifacts (laminated cards, notepad) are permitted within the 1.5s glance budget even though in-app surfaces are not. A laminate does not compete with the table for attention the way a screen does — it sits adjacent to the chips in the user's existing scan pattern. H-PLT01 (sub-second glanceability) and H-PLT04 (socially discreet) still apply to the laminate itself: card content must scan in ≤1.5s and must not look like a cheat-sheet from across the table (e.g., no bright color blocks visible to villains). Capture-mode (observation-capture attribute) remains forbidden mid-hand; only read-mode is permitted.

This keeps the novel constraint visible at the persona layer without fragmenting the situational cast.

### A3. Apprentice amendment

Yes — recommend adding to `apprentice-student.md` *Goals*: "Receive coach-curated printable packs as physical study aids." Also add to *Missing-feature needs*: "[DISC] Accept a coach-authored printable pack (PDF or in-app bundle) into personal library." The Coach persona gets a parallel addition: "Curate and send printable packs to apprentices" — but that's Voice 5's territory (cross-surface sharing mechanics).

## Stage C — Situational stress test

| Situational | In-app view | Printed artifact | Verdict |
|---|---|---|---|
| **`study-block`** | Primary consumer. Density high (Scholar constraint: high visibility tolerance). Reading-for-comprehension mode benefits from expandable derivation footnotes — a feature the paper cannot offer. In-app should be strictly a *superset* of the print artifact. | Export for laminate. Fine. | ✅ |
| **`presession-preparer`** | Chris lays out laminates 15–30min before session. In-app view must show **staleness-of-printed-copy** prominently (PRF-NEW-3) — "5 cards are out of date since your last print on 2026-04-10." Ties to returning-after-break's decay pattern. | Glance review: ≤2min per card. | ⚠️ Staleness banner non-negotiable. |
| **`post-session-chris`** | Compare printed card to played hand — lineage drilldown (PRF-NEW-2) is the load-bearing affordance: "This hand cited Card PF-03 v1.0; source util = `preflopCharts.js`; current version v1.2 — differs by X." Density is fine; this persona absorbs it. | Card already used at table; review against played hands on-phone. | ✅ |
| **`between-hands-chris`** (30–90s) | Not a primary host for PRF in-app view (Chris checks villain profiles here, not reference cards). | Laminate glance 3–5s between hands is plausible (H-PLT01 applies to the card). | ✅ (paper only) |
| **`mid-hand-chris`** (1.5s budget) | In-app **forbidden** — unchanged. | Laminate **permitted** per A2 amendment. Card-scan time ≤1.5s is the binding constraint. Drives layout: one-idea-per-card, headline-answer-first, derivation below fold. | ⚠️ Drives paper-artifact layout spec. |
| **`returning-after-break`** | Critical surface — user returns after 28+ days; printed laminate is stale. In-app view must show **per-card staleness list** with "re-print queue" affordance. Same decay-on-read pattern as adaptive learning; do NOT push-notify. | Stale laminate at table is a permanent wrong-answer risk if user doesn't check in-app first. | ⚠️ Red-line adjacent. |
| **`newcomer`** | Activation threshold needed. EAL precedent was 25 hands; PRF is more about *comprehension* than *observation*, so threshold could be time-based instead (1 completed session + explicit "I want to print reference cards" entry). A 90-page refresher catalog WILL overwhelm newcomer. Gate 4 decides threshold. | Simplified starter pack (3–5 cards, preflop only) if any. | ⚠️ Activation + scope. |

**Key Stage C adjustment:** the in-app view MUST render the returning-after-break + presession-preparer staleness affordance — without it, the laminate-as-permanent-wrong-answer risk materializes.

## Stage E — Heuristic pre-check

### In-app view

**Flagged risks (Nielsen 10 + Mobile-Landscape):**

- **H-N01 (visibility of system status)** — card-staleness must be unambiguous per-card, not a single global banner. Mirrors the sidebar-rebuild freshness doctrine. Proposed: every card in the catalog view carries its own `v1.x / 2026-MM-DD / source: utilPath` footer, tinted amber when current app-state deviates from printed-copy version.
- **H-N05 (error prevention)** — "Print" button must never be adjacent to "Delete card" or "Reset customization." Print commits physical real-world state; undo is impossible once laminated. Suggest explicit print-confirmation modal with "On what date will you print this? (sets printed-on-DATE field for PRF-NEW-3)."
- **H-N03 (user control and freedom)** — *paper has no undo*, but the in-app print pipeline can offer pre-print preview + "download PDF to review before sending to printer" as the software-side safety net.
- **H-ML06 (touch targets ≥ 44px at scale)** — card-catalog with filters/sorts at scale 0.45 on 1600×720 → need 98+ DOM-px touch targets on filter chips. Index-card-density preview (2cm×8cm) must NOT be the tap target; separate "preview" vs "select" affordances.
- **H-ML02 (scroll containers obvious)** — a 90-card catalog on phone landscape needs a clear vertical scroll container with sticky filter bar. Easy to get wrong with `transform: scale()`; Voice 5 owns.

### Printed artifact — adapted heuristics

Paper needs its own heuristic shortlist. Proposing **H-PRF01–H-PRF05** (new IDs, Gate 4 ratifies):

- **H-PRF01 — Paper-scan glanceability (paper analog of H-PLT01).** Card headline must be readable in ≤1.5s at arm's length (~40cm) in dim poker-room light. Implies minimum body font ~9pt, headline ~12pt+ bold, high-contrast black-on-white. Rules out color-only encoding (also H-PRF04 below).
- **H-PRF02 — Finger-pointing accuracy (paper analog of H-ML06).** No "tap target" on paper, but the user's eye + index finger isolate a row. Rows/cells must be ≥4mm tall to avoid adjacent-row ambiguity at arm's length. Dense 6-row-per-cm equity matrices are a violation.
- **H-PRF03 — Staleness is invisible on paper (NEW failure mode).** Once laminated, the card cannot tell you it's out of date. **The in-app view is the sole staleness channel.** Drives PRF-NEW-3 JTBD as non-negotiable, not nice-to-have. Consider physical version-stamp on the card corner (e.g., "v1.0 · 2026-04-24") so owner can cross-reference.
- **H-PRF04 — Dim-light + black-and-white printability (paper analog of H-PLT03).** Not everyone has a color printer; many home printers produce muddy mid-tones. Design must be legible in 1-bit black-and-white. Rules out color-only-encoded categories (e.g., green-vs-red value-vs-bluff must also use shape/label).
- **H-PRF05 — Socially discreet laminate (paper analog of H-PLT04).** Large colored blocks visible across the table signal "I am consulting a cheat sheet." Prefer monochrome layouts; small cards (index-card size); no company branding visible to villains.

**Obvious heuristic violations in the sketched design:**

1. A single "Printable Refresher" catalog with all 15 card types on one route violates H-N08 (minimalist) + H-ML02 (scroll). Needs filter/sort or tiered nav by content type.
2. The "preflop chart × rake × stacks × field" parameter matrix, if exposed as a form, risks H-N06 (recognition over recall) — the user should select a preset ("my home game"), not tune 4 dropdowns each print.
3. Print-confirmation must capture `printed-on DATE` (user-entered) — missing from the sketch per my Stage C read. Without it, PRF-NEW-3 staleness-diff is not computable.
4. Card-corner physical version-stamp (H-PRF03) is not yet specified.

## Stage A/C/E verdict signals

- **Stage A:** ⚠️ — one persona amendment (`mid-hand-chris` paper_reference_permitted) + two small goal/bullet additions (Apprentice + Rounder). No new personas.
- **Stage C:** ⚠️ — staleness-display + returning-after-break integration + newcomer activation threshold are structural, not cosmetic. Addressable at Gate 4.
- **Stage E:** ⚠️ — five new paper-specific heuristics needed (H-PRF01–05); in-app view has four pre-sketch violations but all addressable pre-code.

Net: **YELLOW across all three Voice 1 stages.** Zero RED-blockers. All issues have named fixes.

## Recommended follow-ups for Gate 3 / Gate 4

- [ ] **Gate 3:** amend `mid-hand-chris.md` with `paper_reference_permitted` attribute (§A2 exact copy above).
- [ ] **Gate 3:** amend `apprentice-student.md` *Goals* + *Missing-feature needs* with coach-curated printable-pack bullets.
- [ ] **Gate 3:** amend `rounder.md` *Goals* with "carry vetted reference without touching phone."
- [ ] **Gate 4:** author `docs/design/heuristics/printable-artifact.md` with H-PRF01–H-PRF05.
- [ ] **Gate 4:** author in-app staleness surface spec (per-card amber footer + "re-print queue" affordance for returning-after-break).
- [ ] **Gate 4:** author print-confirmation modal spec with user-entered `printed-on DATE` field.
- [ ] **Gate 4:** newcomer activation threshold decision (time-based vs hand-based, starter-pack scope).
- [ ] **Gate 4:** owner-interview question — "Do you expect the laminate to display a physical version-stamp in the corner, or is the in-app staleness channel sufficient?"
- [ ] **Gate 4:** decide single-catalog-route vs tiered-nav (preflop / math / postflop) per H-N08.
