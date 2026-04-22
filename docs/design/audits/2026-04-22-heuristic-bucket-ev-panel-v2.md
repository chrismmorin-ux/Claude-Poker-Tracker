# Heuristic Audit — 2026-04-22 — `bucket-ev-panel-v2` Gate-4

**Type:** Gate-4 heuristic audit per `docs/design/LIFECYCLE.md`. Design-artifact audit — spec-level, not code-level.
**Auditor:** Claude (main) + product-ux-engineer lens.
**Scope:** `docs/design/surfaces/bucket-ev-panel-v2.md` (revised post-specialist-review).
**Heuristic sets walked:** Nielsen-10 (`heuristics/nielsen-10.md`), Poker-Live-Table (`heuristics/poker-live-table.md`), Mobile-Landscape (`heuristics/mobile-landscape.md`).
**Goal:** Produce P0/P1/P2/P3 findings and a go/no-go verdict on Commit 1.

---

## Scope + method

`bucket-ev-panel-v2` is a **study surface** rendered inside Postflop Drills → Line → walkthrough. It is **not** a live-table surface. This means:

- **Primary heuristic weight:** Nielsen-10 + Mobile-Landscape.
- **Secondary weight:** Poker-Live-Table heuristics H-PLT03 (dim-light readable — applies because students study in varied environments) + H-PLT05 (phone-sleep-safe — study sessions are interruptible) + H-PLT07 (state-aware primary action — v2's `decisionKind`-driven rendering directly parallels this heuristic) + H-PLT08 (no-interruption input — walkthrough state must survive interruption).
- **Not applicable:** H-PLT01 (sub-second glanceability — study surfaces tolerate ~2s parse time), H-PLT02 (one-handed thumb reach — desktop-primary for study), H-PLT04 (socially discreet — off-table context), H-PLT06 (misclick absorption for high-frequency actions — study interactions are low-frequency).

The audit walks each relevant heuristic against the spec's primitives (P1..P8), variants (V1..V11), data contract, schema extensions, and I-DM invariants. Findings are tagged with heuristic IDs + severity + affected primitive/variant.

Personas used as audit anchors:
- **First-principles-learner** (`personas/situational/first-principles-learner.md`, just shipped via LSW-J2) — primary.
- **Apprentice** (`personas/core/apprentice-student.md`) — primary.
- **Study-block** (`personas/situational/study-block.md`) — situational.
- **Coach** (`personas/core/coach.md`) — secondary.

---

## Findings summary

| # | Severity | Heuristics | Primitive / Variant / Element | One-line |
|---|----------|------------|------------------------------|----------|
| F01 | P1 | H-N06, H-N10 | Bucket labels across P1 + P2 | No inline glossary mechanism specified; 28+ taxonomy labels assume prior vocabulary for first-principles-learner persona. |
| F02 | P1 | H-ML01, H-ML04 | Full-stack layout at 900x400 phone | Q4 resolved for 1600x720; sub-1200px viewports not verified. P1+P2+P5+others may overflow below fold on real phones. |
| F03 | P1 | H-N01, H-N09 | Range-unavailable error state | P1's "villain range empty — no decomposition possible" empty state is specified; what happens when `villainRanges.js` lookup fails? No spec guidance. |
| F04 | P2 | H-N04 | Disclosure-pattern consistency | P1 visible-row cap uses "Show all N groups" disclosure; P2 column cap uses "Other (+N)" aggregation. Two disclosure patterns serve similar purposes — pick one. |
| F05 | P2 | H-PLT05, H-PLT08 | Walkthrough state on sleep/navigation | Spec is silent on whether archetype toggle, disclosure-open state, and reveal state persist across phone-sleep or line-picker-return. |
| F06 | P2 | H-N07 | Power-user accelerators | No keyboard shortcut / tap-hold accelerator specified. Scholar + first-principles-learner reload the same line repeatedly; reopening disclosures each time is friction. |
| F07 | P2 | H-PLT03, H-N04 | Color-only distinctions in relation badges | "crushed/dominated/neutral/favored/dominating" relation badges use 5-color palette (rose/orange/amber/teal/emerald per G5 shipped code). H-PLT03 says "color-only fails"; spec doesn't require shape or weight reinforcement. |
| F08 | P2 | H-N01 | MC confidence intervals not always shown | P1 spec says "X% ±Y% (method)"; good. P2 `totalEVCI` is defined in the output contract but the example layout doesn't show it. Student sees deterministic-looking total EV with no variance hint. |
| F09 | P2 | H-N03 | No "undo last interaction" in walkthrough | If a student misclicks an archetype, they switch and re-read. No undo of that archetype change. Minor — archetype switch is cheap — but H-N03 says "any reversible action." |
| F10 | P2 | H-N02 | Bucket-label jargon vs user language | Labels like `topPairGood`, `nonNutFlushDraw`, `pairPlusFD` are developer-shorthand, not natural user language. Spec's P1 doesn't specify display-label transforms (e.g., `topPairGood` → "Top pair, good kicker"). |
| F11 | P3 | H-N08 | Dense P2 on high-group-count nodes | Capped at 5 columns + Total (6 columns total) — fine at 1600x720. At 900x400, 6 columns is tight. Spec does not specify responsive behavior below reference viewport. |
| F12 | P3 | H-PLT07 | `decisionKind` coverage | Three kinds: `standard`, `bluff-catch`, `thin-value`. No kind for "hero has the nuts — maximize value" (e.g., V7 river thin-value where hero is strong) or "protect vs draws" flop spots. Extension seam unclear for new kinds. |
| F13 | P3 | H-N10, H-N01 | First-time onboarding on v2 | Post-Path-2 restructure changes the first-visit mental model (no more Reveal gate per Q7). Students who used v1 see a different layout. No onboarding tooltip or migration hint specified. |
| F14 | P3 | H-ML06 | Touch targets on `(?)` glossary taps | Q1 proposes tap-for-definition on bucket labels. Labels are text; tap target is the text itself. At reference viewport 1600x720 + default font sizing, each label is <44px tall. Accessibility risk. |

---

## Heuristic-by-heuristic walkthrough

### H-N01 — Visibility of system status

**✓ Strong:** `decisionKind` drives P1 rendering mode visibly; archetype is always shown in toolbar; `P6.ConfidenceDisclosure` surfaces MC trial count + caveats.

**⚠ F03 / F08:** Error states for range-unavailable are implicit; MC confidence on P2 totals is defined in output but unspecified in visual example.

**Action:** Add explicit "range-unavailable" error rendering to P1 spec (banner-level primitive output, not silent). Update P2 layout example to show `±` band on totals.

---

### H-N02 — Match between system and the real world

**⚠ F10:** Bucket-label taxonomy uses developer shorthand (`topPairGood`, `pairPlusFD`, `nonNutFlushDraw`). A first-principles-learner who is past poker mechanics still needs to parse "pairPlusFD" as "pair plus flush draw" on every read until the vocabulary is internalized. This is a poker-learner's version of H-N02: the system uses taxonomy the user is learning, not taxonomy the user already knows.

**Action:** `BUCKET_TAXONOMY` in `bucketTaxonomy.js` already carries `displayName` fields for some entries (spot-check confirmed G5.1 split added `"Top Pair Good"` for `topPairGood`). Spec must require P1 + P2 render via `displayName`, not via the code-id. Add as a hard rule in the primitives section.

---

### H-N03 — User control and freedom

**✓ Strong:** Walkthrough supports retry-from-breadcrumb (shipped already in Line Study). Archetype toggle is non-destructive.

**⚠ F09:** No undo on archetype toggle. Low-severity — the action is cheap, 1 tap to revert — but canonical H-N03 compliance would include tap-history of archetype changes. **Action:** Accept as a known trade-off; cost of undo UI exceeds benefit on this interaction.

---

### H-N04 — Consistency and standards

**⚠ F04:** Two disclosure patterns in v2 — "Show all N groups" on P1 row overflow; "Other (+N)" aggregation on P2 column overflow. Both serve the same purpose (too-many-to-show) but look different.

**Action:** Pick one pattern. Recommendation: "Show all N" on both — consistent affordance, explicit count, tap to expand. "Other (+N)" can stay as the collapsed-state label. Update spec to make P1 row overflow and P2 column overflow use the same disclosure copy and behavior.

**F13 adjacent:** Existing Line Study walkthrough uses `BucketEVPanel` v1 with a "Reveal bucket EVs vs [archetype]" button. v2 (per Q7 recommendation a) removes the Reveal gate. This is a *deliberate* consistency break with v1, but it's a break. No copy or visual treatment specified to handle transition.

---

### H-N05 — Error prevention

**✓ Strong:** Schema v3 migration guard rejects dual-authored nodes; `SCHEMA_VERSION` bump prevents silent drift; dev-mode P2 assertion on empty `perGroupContribution`.

**✓ Also strong:** Decisively spec'd: a v2 node without `heroView` falls through to v1 rendering. No impossible-state rendering.

**Action:** None required. F03 (range-unavailable) falls under H-N01 already.

---

### H-N06 — Recognition over recall

**⚠ F01 (P1):** First-principles-learner persona file explicitly flags bucket-taxonomy vocabulary as "still being learned; the student is consciously translating." P1 renders 6–12 group rows; P2 renders 4–5 column labels. Without an inline glossary mechanism, the student is relying on recall for every label they encounter.

**Action:** Make the inline glossary a first-class spec requirement, not a Q1 open question. Add `P6.GlossaryBlock` as an always-rendered 1-line affordance at the bottom of the panel: "Bucket definitions ▸" expands a modal or inline section listing every label currently rendered on this node with a 1-sentence definition. Resolve Q1 in favor of inline tap-for-definition on each label (F14 touch-target follow-up).

---

### H-N07 — Flexibility and efficiency of use

**⚠ F06:** Scholar + Rounder reload lines frequently (drills, re-study). No keyboard shortcut for archetype toggle (today's UI: 3 clickable buttons). Tap-targets exist; keyboard shortcuts do not.

**Action:** v1.1 candidate. Not Commit-1 blocking. Add `1/2/3` keyboard shortcuts for Reg/Fish/Pro in a v1.1 enhancement ticket. Not worth spec update right now.

---

### H-N08 — Aesthetic and minimalist design

**⚠ F11:** At 1600×720, 6-column P2 is tight but readable. At 900×400 (a smaller phone), 6 columns at ~130px each forces font scaling below dim-light-readable.

**Action:** Spec must define the responsive downgrade. Options: (a) collapse P2 to 3 columns on <1200px viewports ("Beats you / Pays you / Other / Total"), (b) switch P2 to vertical layout (actions in rows, per-group contributions in expandable sub-rows). Recommend (a) — preserves the horizontal-arithmetic-reading pattern for reference device and gracefully degrades elsewhere. Ties into F02 below.

---

### H-N09 — Help users recognize, diagnose, recover from errors

**⚠ F03 related:** Error taxonomy for `computeBucketEVsV2` failures is undefined. What does the student see when:
- Villain range fails to resolve (`villainRanges.js` alias missing)?
- MC computation times out (above `timeBudgetMs`)?
- Hero combo is malformed (caught by schema today, but defensive)?

**Action:** Add an `errorState` discriminant to `ComputeBucketEVsV2Output`:
```typescript
errorState?: {
  kind: 'range-unavailable' | 'timeout' | 'malformed-hero' | 'engine-internal';
  userMessage: string;  // what the student sees
  diagnostic: string;   // for dev logs
  recovery?: string;    // e.g., "retry" or "please file a report"
};
```
P1 renders a banner when `errorState` is populated, not silent-empty. H-N09 compliance.

---

### H-N10 — Help and documentation

**⚠ F01 / F13:** Bucket glossary addressed under H-N06 above. Onboarding for first-visit users under F13 below.

---

### H-ML01 — Works on the full viewport range

**⚠ F02:** Q4 resolved the 1600×720 layout. The 640×360 minimum is unverified in spec. A student reading on a 900×400 phone with P5 docked above P1 + cap-6 rows P1 + cap-5 columns P2 + P3 + P4 + P6 would hit ~420-460px just for the panel, over the ~290px visible height after chrome.

**Action:** Spec must define behavior below 1200px (common tablet/phone width). Two sub-findings:
- **F02a:** At <1200px, P5 auto-collapses to 1 line with tap-to-expand. Reduces to ~30px.
- **F02b:** At <1200px, P2 collapses per F11 recommendation.
- **F02c:** At <900px, P1 visible-row cap drops from 6 to 4. Further reduces.

These are responsive downgrades, not redesigns. Target: every primary primitive visible at 640×360 minimum.

---

### H-ML02 — Scroll containers are obvious and reachable

**✓ Strong:** Walkthrough already has one primary scroll container (`LineWalkthrough`). v2 panel renders inside it; no nested scroll.

**Action:** None required. Audit confirms at Commit 3 that nested disclosures don't introduce nested scroll.

---

### H-ML04 — Respect the `scale` transform convention

**⚠ Implicit:** The app uses `useScale` globally. All layout math in the spec assumes CSS pixel measurements; `scale` transform shrinks visual but not DOM. Spec's height budget (480px) is DOM-px, not visual-px.

**Action:** Add a note to the spec's layout section: "All pixel measurements are DOM-px. Visual size scales with `useScale`. Touch targets must satisfy H-ML06 at scale = 0.5 minimum (=88 DOM-px target for 44 visual-px)."

---

### H-ML06 — Touch targets ≥ 44×44

**⚠ F14:** Bucket-label inline glossary (H-N06 resolution) proposes tap-for-definition. Bucket labels are rendered as text within table rows. At reference viewport + scale 1.0, row heights are ~40-48px. At scale 0.5, effective tap size is 20-24 visual-px. **Below threshold.**

**Action:** Spec must require bucket labels in P1 + P2 to have minimum 44 DOM-px tap area (extend the label's clickable box to include surrounding padding, not just the text itself). This is layout-level — not a primitive change.

**F11 adjacent:** Touch targets on P4 and P6 disclosure toggles are uncontested; archetype toolbar already at 44+ DOM-px.

---

### H-PLT03 — Dim-light readable

**⚠ F07:** Relation badges use 5-color palette (rose/orange/amber/teal/emerald). If a student studies in a dim room on a dimmed phone screen, amber-vs-teal-vs-emerald contrast may be insufficient.

**Action:** Spec must require a secondary distinction beyond color — recommend **shape**: `crushed: "▼"`, `dominated: "▽"`, `neutral: "◆"`, `favored: "△"`, `dominating: "▲"`. Triangle symbols alongside color text. Cheap to ship; failure-mode is safe (colorblind + dim-room users get an alternative cue).

---

### H-PLT05 — Phone-sleep-safe / H-PLT08 — No-interruption input

**⚠ F05:** Spec doesn't address state preservation. A study session interrupted by phone-sleep should restore:
- Current line + current node (already handled by `LineWalkthrough`).
- Archetype selection.
- Whether P1/P2 disclosures were expanded.
- Whether P6 confidence was expanded.
- Glossary expansion state.

**Action:** Add a state-preservation section to the spec. These are `useState` ephemeral today — no persistence. For v1 ship, define which states survive page reload (likely: archetype via `localStorage` or URL param; disclosure states reset OK) and which don't. This is a 1-paragraph addition to the spec.

---

### H-PLT07 — State-aware primary action

**✓ Strong:** v2's `decisionKind` + variant recipes + P1 rendering-mode-per-kind are the textbook implementation of this heuristic. Panel reshapes based on node state. I-DM invariants encoded structurally via `VARIANT_RECIPES` enforce the state-awareness at the code level.

**⚠ F12:** `decisionKind` enum is 3 values (`standard` / `bluff-catch` / `thin-value`). Extension seam for new kinds is unspecified. What does a future `value-protection` kind look like? The `narrowingSpec` composable pattern (R3 resolution) is a clean reference for how to scale; `decisionKind` should adopt the same pattern before committing content.

**Action:** Promote `decisionKind` from enum string to `DecisionKindSpec` object `{ kind: string, ...params }` with handler-map dispatch in P1's rendering mode selection. Parallel to `narrowingSpec`. 1-paragraph addition to spec.

---

## Verdict

**YELLOW — ship with spec additions before Commit 1.**

The spec's structural soundness holds up to the three heuristic sets. V1-V6 variants + P1-P6 primitives + I-DM invariants all map cleanly to Nielsen + ML + applicable PLT. The gaps are tractable:

- **4 P1 findings** must be addressed in the spec before Commit 1: glossary mechanism first-class (F01), responsive downgrade for sub-1200px viewports (F02a/b/c), range-unavailable error rendering (F03), disclosure-pattern consistency (F04).
- **8 P2 findings** tracked in the spec's open-questions section or risks; most are responsive-design details (F07, F08, F09, F10, F11) or accommodation for sub-primary use cases (F05, F06, F12).
- **3 P3 findings** deferred to Gate-4 v2 if needed (F13, F14 already addressed in F01's expansion).

Specialist reviews (systems-architect, product-ux-engineer, senior-engineer) plus this heuristic audit have converged. No finding surfaces a structural redesign requirement. The spec can proceed to Commit 1 after the 4 P1 patches land.

---

## Required spec additions before Commit 1

Ordered by priority:

1. **F01 — Glossary as first-class.** Promote Q1 to in-spec decision: `P6.GlossaryBlock` 1-line affordance at bottom of panel; expand to inline modal listing every label rendered on this node with a 1-sentence definition. Bucket labels inline use `displayName` (H-N02); inline tap-for-definition with ≥44 DOM-px tap area (F14).

2. **F02 — Responsive downgrade for <1200px.** Spec must define: at <1200px, P5 collapses to 1 line, P2 collapses to 3 columns (Beats / Pays / Other / Total), P1 visible-row cap stays 6 OR drops to 4 at <900px. Every primary primitive visible at 640×360 minimum.

3. **F03 — `errorState` discriminant** added to `ComputeBucketEVsV2Output`. P1 renders banner when populated. H-N09 compliance.

4. **F04 — Disclosure pattern unified.** P1 row overflow + P2 column overflow both use "Show all N [groups|terms]" pattern; tap-to-expand. Drop "Other (+N)" as separate pattern.

P2+ findings (F05-F14) can be logged as LSW-G4-IMPL-P2 sub-tickets or tracked in the spec's risks section. They do not block Commit 1.

---

## Status

- **Status:** DRAFT (pending owner review).
- **Blocks:** LSW-G4-IMPL Commit 1.
- **Unblocked by:** spec patches landing for F01/F02/F03/F04; owner sign-off on verdict.

## Change log

- 2026-04-22 — Drafted. Three heuristic sets walked (Nielsen-10 + 5 PLT-applicable + 5 ML). 14 findings: 4 P1 block Commit 1, 8 P2 trackable, 3 P3 deferred. Verdict YELLOW.
