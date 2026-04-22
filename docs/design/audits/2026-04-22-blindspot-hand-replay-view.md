# Blind-Spot Roundtable + Audit — 2026-04-22 — HandReplayView

**Type:** Combined Gate-2 pre-audit blind-spot check + Gate-4 heuristic audit (DCOMP-W2-A1)
**Trigger:** Roadmap-mandated Gate 2 for hand-replay-view — distinct Apprentice / Coach / Study-block situational personas not fully covered by live-table audit patterns.
**Participants:** Claude synthesis across product-ux + systems-architect + cross-surface perspectives.
**Artifacts read:** `surfaces/hand-replay-view.md`, `HandReplayView.jsx` (345 lines) + `ReviewPanel.jsx`, `VillainAnalysisSection.jsx` (386 lines — noted as densest sub-panel), `HeroCoachingCard.jsx`, `useHandReview.js` + `useHandReplayAnalysis.js` + `useReplayState.js`, core personas (chris, rounder, hybrid-semi-pro, apprentice-student, coach), situational (post-session-chris, study-block, coach-review-session), `jtbd/ATLAS.md` SR domain.
**Method:** Code inspection + surface-artifact cross-reference + routing trace. Playwright walk deferred because getting into HandReplayView requires a recorded hand selected via Analysis → Hand Review entry, a multi-step setup that adds tool-call cost without materially changing code-inspection findings for this code-heavy read-only surface.
**Status:** Draft.

---

## Executive summary

**Verdict: YELLOW.** The review surface is well-structured (keyboard-first stepper, immersive felt, async analysis overlay) and doesn't carry the destructive-action anti-patterns that made W4 surfaces RED. But it under-serves three review-specific persona needs: (1) no hand-significance indicator means Study-block / Post-session-chris can't skim; (2) no flag/annotate flow means SR-26 / CO-49 JTBDs don't land here; (3) back-target is hardcoded to Analysis regardless of entry point, disorienting users who came from SessionsView. Plus standard polish: Back button touch target <44px, design-token drift (hardcoded hex colors for position badges), density on VillainAnalysisSection (386 LOC flagged by surface artifact itself). 0 P0, 3 P1, 5 P2, 4 P3.

---

## Gate 2 — Blind-spot roundtable

### Stage A — Persona sufficiency

**Output: ⚠️ 3 GAPS**

#### A1 — No "skim many hands fast" situational persona for Post-session-chris or Study-block
Post-session-chris and Study-block both review hands in batches. The current surface assumes deep step-through per-hand; there's no "queue of hands, next one, hand-importance at a glance" mode. Gap: **new situational persona** `batch-hand-review.md` or decision to fold into Study-block with an explicit batch-mode requirement.

#### A2 — Coach-review-session under-specified for multi-hand workflow
`coach-review-session.md` describes the cognitive model but no workflow artifact specifies how the Coach navigates between a student's hands mid-session. Is it a "next hand in queue" button? A hand-tree map? A lecture flow? Gap: **coach-workflow artifact** needed, or decision that Coach uses the same single-hand flow as everyone else (in which case the artifact should state that explicitly).

#### A3 — Apprentice's progressive-disclosure contract with HeroCoachingCard
`HeroCoachingCard.jsx` is 112 lines, tagged for Apprentice. What's the disclosure shape? Does it show level-1 coaching always + level-2 on tap? Is there a "I already know this" dismiss? The persona doc doesn't specify the contract; the component is the de facto spec. Gap: **formalize the coaching-disclosure contract** at persona level.

---

### Stage B — JTBD coverage

**Output: ⚠️ 2 UNSERVED + 2 PARTIAL**

#### B1 — SR-26 (flag disagreement with reasoning) unserved
Surface artifact explicitly flags this as a proposed JTBD whose natural home is HandReplayView. Today the user sees coaching copy + villain analysis but cannot say "I disagree with this analysis, here's why" and preserve the disagreement for later review or Coach discussion. Gap.

#### B2 — CO-49 (annotate streets) unserved
Similar to SR-26 — natural home is here. Coach needs per-decision annotations for student review. Gap.

#### B3 — F-W4 hand-significance indicator (partial)
Module exists in `handAnalysis/`; no UI surfacing. Study-block + Post-session-chris ask "which hands should I review first?" — today the answer is "the most recent" which isn't optimal. Partial service.

#### B4 — SR-23 (highlight worst-EV spots) — verify the step-through actually surfaces this
Surface claims `JTBD-SR-23` is served "via step-through with EV annotations." But the step-through is uniform — every action gets analysis regardless of EV delta. A hand where the hero makes one big -EV mistake and 15 routine actions still requires stepping through all 16 with no visual cue that step 7 is the important one. Partial at best.

---

### Stage C — Situational stress test

**Output: ⚠️ 2 cross-surface fidelity issues + 1 routing ambiguity resolved**

#### C1 — Back-target is hardcoded to SCREEN.HISTORY regardless of entry path
`HandReplayView.jsx:58-60` — `handleBack` always navigates to `SCREEN.HISTORY` which routes to `<AnalysisView initialTab="review" />`. But surface artifact line 16 notes three entry paths: AnalysisView Hand Review, SessionsView SessionCard drill-in, and recursive replay-to-linked-hand. A user who entered from SessionsView clicks Back, lands on AnalysisView, is disoriented. **P1 finding.** The routing ambiguity flagged in the surface artifact (HISTORY vs ANALYSIS vs SESSIONS) is effectively resolved — code goes to Analysis — but the UX impact on non-Analysis entry-point users is the real issue.

#### C2 — Dual loading path (replayHand in UI state OR loadHandById) creates deep-link edge case
Surface artifact line 106: "Dual-source loading … browser refresh + deep-link cases." Browser refresh drops the in-memory `replayHand` but `replayHandId` persists in UI state → reload triggers IDB fetch. What happens if `replayHandId` points to a deleted hand after session cleanup (SessionsView F1 deferred-delete shipped in W4 Batch B)? HandReplayView `loadHandById` returns `null` → `!hand` branch renders "Hand not found" + Back button. Acceptable but not graceful. Flag for audit-watch.

#### C3 — No indication of keyboard shortcuts
The replay is keyboard-navigable (←→ / Home / End / Escape) but there's no on-screen hint. Apprentice / Newcomer won't discover this. **P2 finding.**

---

### Stage D — Cross-product / cross-surface

**Output: ⚠️ 1 orphaned surface + 1 untapped module**

#### D1 — DecisionTreeView.jsx is orphaned
Surface artifact lines 121–122: F-W5 DecisionTreeView exists in code but has no route. Natural homes: (a) as a ReviewPanel tab here, (b) as a standalone SCREEN.DECISION_TREE entry. The audit should surface this as an owner decision: revive-in-place / fold-in / retire. Matches the previously-logged `2026-04-21-decision-tree-fate` discovery.

#### D2 — `handSignificance` module exists, no UI consumer
`src/utils/handAnalysis/handSignificance.js` exists (confirmed via surface artifact + known-issue list). Natural home is the HandReplayView header — a "Significance: Major / Notable / Routine" badge next to `handDisplayId`. Gap.

---

### Stage E — What the Gate-4 audit might miss

**Output: 3 items**

#### E1 — Accessibility of the immersive felt
Felt uses dense gradient CSS + `radial-gradient` with blue-slate tones. Low-light readability (H-PLT-03) + color-blind friendliness (F-P19 discovery, QUEUED per H1) — these might fail without being obvious to a sighted non-color-blind reviewer. **Audit-watch.**

#### E2 — VillainAnalysisSection decomposition candidate
386 LOC in one file. Surface artifact already flags as "decomposition candidate if Wave 2 audit flags it." **Yes, flag.**

#### E3 — Hardcoded hex colors for position badges
`HandReplayView.jsx:23` `POSITION_BADGES = { D: '#d4a847', SB: '#9ca3af', BB: '#60a5fa' }`. Should use `designTokens.NAV_COLORS` or a dedicated position-badge token set. **P3 finding.**

---

## Gate 4 — Heuristic audit findings

### F1 — Back button has sub-minimum touch target AND context-insensitive routing

- **Severity:** 3 (P1, Gate-2 C1)
- **Heuristics violated:** H-ML06 (touch target), H-N3 (user control + freedom — "back" doesn't return to where user came from)
- **Evidence:** `HandReplayView.jsx:131-136` — text-only button (`text-sm`, no min-height) routing to `SCREEN.HISTORY` hardcoded. ~20px tall in isolation.
- **Recommended fix:** Two-part:
  1. Add `min-h-[44px] px-3` to the button.
  2. Make back routing context-aware: track the entry-screen in UI state (`replayBackTarget`) set on entry from Analysis / Sessions / recursive-replay. `handleBack` routes to the captured target.
- **Effort:** S-M (routing-aware back requires a small UIContext field + setters at 3 entry points).
- **Proposed backlog item:** `DCOMP-W2-A1-F1 — HandReplayView Back: ≥44×44 + context-aware routing` (P1)

### F2 — No hand-significance indicator (F-W4 known gap)

- **Severity:** 3 (P1, Gate-2 B3 + D2)
- **Heuristics violated:** H-N6 (recognition rather than recall — user shouldn't have to remember which hand was the big one), H-PLT-05 (primary content prominence)
- **Evidence:** `handSignificance` module exists; HandReplayView header does not consume it.
- **Recommended fix:** Import `computeHandSignificance` (verify exact API) at mount time; render badge in the header row between `handDisplayId` and the street label. 3-tier colour: `Major` (amber), `Notable` (cyan), `Routine` (gray). Unlocks Study-block + Post-session-chris batch-review.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W2-A1-F2 — HandReplayView significance badge` (P1)

### F3 — No flag/annotate affordance (SR-26 + CO-49 unserved)

- **Severity:** 3 (P1, Gate-2 B1 + B2)
- **Heuristics violated:** N/A (missing-feature; doesn't violate heuristic so much as leave value unserved)
- **Recommended fix:** Bundle as a new `<FlagAndAnnotateBar />` component in ReviewPanel. Minimum shape: (a) flag button ("I disagree with this analysis"), (b) free-text annotation field (up to 500 chars), (c) per-action-step binding so annotations travel with the timeline cursor. Persist to hand record as `reviewNotes: { [actionId]: { flag: bool, annotation: string } }`. Schema-additive; backward-compatible.
- **Effort:** M (new component + schema field + ReviewPanel integration + optional listing in AnalysisView's hand-review queue).
- **Proposed backlog item:** `DCOMP-W2-A1-F3 — Flag + annotate per-action` (P1)

### F4 — VillainAnalysisSection density (386 LOC in one file)

- **Severity:** 2 (P2, Gate-2 E2)
- **Heuristics violated:** Internal-consistency / maintainability (not user-facing heuristic; dev-ergonomics)
- **Evidence:** Surface artifact line 109 flags; 386 LOC.
- **Recommended fix:** Decompose into `VillainDecisionRow.jsx` + `VillainAnalysisSection.jsx` container; if multiple repeat subsections (e.g., per-villain blocks, per-street blocks), factor them. Target: no file in the subtree > 200 LOC.
- **Effort:** M (refactor with test preservation).
- **Proposed backlog item:** `DCOMP-W2-A1-F4 — VillainAnalysisSection decomposition` (P2)

### F5 — Keyboard-shortcut hints missing from UI

- **Severity:** 2 (P2, Gate-2 C3)
- **Heuristics violated:** H-N7 (flexibility + efficiency — shortcuts exist but not discoverable)
- **Evidence:** `useEffect` at `HandReplayView.jsx:68-79` registers keyboard handlers; UI has no on-screen hint.
- **Recommended fix:** Add a small keyboard-hint row below the stepper buttons: `← →  step` | `Home End  jump` | `Esc  back`. Or a tooltip on the Back button header: `"Esc to close"`.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W2-A1-F5 — Keyboard-shortcut hint row` (P2)

### F6 — DecisionTreeView orphan status — owner decision needed

- **Severity:** 2 (P2, Gate-2 D1)
- **Evidence:** `DecisionTreeView.jsx` exists in code; not routed.
- **Recommended fix:** Owner decision — revive / fold-in / retire. Matches prior-logged `2026-04-21-decision-tree-fate` discovery.
- **Effort:** 0 (decision) → variable (action).
- **Proposed backlog item:** Pointer to existing discovery `2026-04-21-decision-tree-fate`.

### F7 — Deep-link to deleted hand renders generic "Hand not found"

- **Severity:** 2 (P2, Gate-2 C2)
- **Heuristics violated:** H-N9 (recognize + recover from errors)
- **Evidence:** `HandReplayView.jsx:101-110` — renders "Hand not found" + Back button. No diagnostic (was it deleted? never existed?).
- **Recommended fix:** Distinguish via URL / UI-state info: if `replayHandId` looks like a valid ID but IDB miss → "This hand was deleted (or session cleared). Back to Hand Review." If the ID looks invalid → "Hand link is malformed."
- **Effort:** S (better copy + trivial branch).
- **Proposed backlog item:** `DCOMP-W2-A1-F7 — Hand-not-found diagnostic copy` (P2)

### F8 — Felt accessibility not verified

- **Severity:** 2 (P2, Gate-2 E1)
- **Recommended fix:** Audit-watch. Verify with a color-blind simulation pass + low-light physical test. Not immediately actionable; flag for when P01 accessibility (QUEUED from H1) lands.
- **Proposed backlog item:** Bundle into P01 accessibility discovery.

### F9 — Hardcoded hex colors for position badges

- **Severity:** 1 (P3, Gate-2 E3)
- **Heuristics violated:** H-N4 (consistency + standards — design-token drift)
- **Evidence:** `HandReplayView.jsx:23` hardcoded colors.
- **Recommended fix:** Move to `designTokens.js` as `POSITION_BADGE_COLORS`. Share with any other position-badge renderer (seat-context-menu, TableView seat indicators).
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W2-A1-F9 — POSITION_BADGE_COLORS design token` (P3)

### F10 — Multi-hand queue / next-hand affordance missing (A1 + A2 bundle)

- **Severity:** 1 (P3, Gate-2 A1 + A2)
- **Recommended fix:** Coach-review-session + Study-block workflows need this. Defer to a proper queue-workflow session; not a single-component fix.
- **Proposed backlog item:** `DCOMP-W2-A1-F10 — Multi-hand review queue workflow` (P3, discovery-candidate)

### F11 — Coaching disclosure contract un-formalized (A3)

- **Severity:** 1 (P3)
- **Recommended fix:** Author progressive-disclosure spec for HeroCoachingCard at `docs/design/contracts/` (matches persisted-hand-schema precedent). Pin the component to it.
- **Effort:** S (documentation).
- **Proposed backlog item:** `DCOMP-W2-A1-F11 — HeroCoachingCard disclosure contract` (P3)

### F12 — SR-23 step-through doesn't highlight worst-EV spots

- **Severity:** 1 (P3, Gate-2 B4)
- **Recommended fix:** Use EV-delta to mark "skip to next significant" navigation: a ">|" button that jumps the cursor past routine actions to the next EV-delta-above-threshold action. Complements F2 significance badge.
- **Effort:** M.
- **Proposed backlog item:** `DCOMP-W2-A1-F12 — Skip-to-significant action nav` (P3)

---

## Observations without fixes

- **Keyboard-first stepper** (ref-based handlers to avoid effect churn) is a clean pattern — don't regress.
- **Blue-slate felt** visual differentiation from TableView is effective — prevents mode confusion.
- **Async analysis guard** via `isComputing` is correctly placed.
- **Hand metadata surfacing** (handDisplayId / street / pot) in the header is good R-1.5-style information density for the glance-read case.

## Open questions for the owner

- DecisionTreeView fate (F6) — already a standing discovery; reminder it's on the pile.
- Coach-review-session workflow scope — is this a Plus-tier or Studio-tier feature? (affects F10 prioritization).
- SR-26 / CO-49 scope — are flag-and-annotate a Plus-tier or Free-tier feature? (affects F3 prioritization).

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | F1 — Back button ≥44×44 + context-aware routing | 3 | S-M | P1 |
| 2 | F2 — Hand significance badge | 3 | S | P1 |
| 3 | F3 — Flag + annotate per-action | 3 | M | P1 |
| 4 | F4 — VillainAnalysisSection decomposition | 2 | M | P2 |
| 5 | F5 — Keyboard-shortcut hint row | 2 | S | P2 |
| 6 | F6 — DecisionTreeView fate owner decision | 2 | 0 | P2 |
| 7 | F7 — Hand-not-found diagnostic copy | 2 | S | P2 |
| 8 | F8 — Felt accessibility audit | 2 | — | P2 (bundle w/ P01) |
| 9 | F9 — POSITION_BADGE_COLORS tokens | 1 | S | P3 |
| 10 | F10 — Multi-hand review queue workflow | 1 | L | P3 (discovery) |
| 11 | F11 — HeroCoachingCard disclosure contract | 1 | S | P3 |
| 12 | F12 — Skip-to-significant action nav | 1 | M | P3 |

---

## Backlog proposals

```
- [P1] [DCOMP-W2-A1 F1] HandReplayView Back button ≥44×44 + context-aware routing
- [P1] [DCOMP-W2-A1 F2] HandReplayView significance badge (consume handSignificance module)
- [P1] [DCOMP-W2-A1 F3] Flag + annotate per-action (SR-26 + CO-49 coverage)
- [P2] [DCOMP-W2-A1 F4] VillainAnalysisSection decomposition
- [P2] [DCOMP-W2-A1 F5] Keyboard-shortcut hint row
- [P2] [DCOMP-W2-A1 F6] Owner decision: DecisionTreeView revive/fold-in/retire (pointer to 2026-04-21-decision-tree-fate discovery)
- [P2] [DCOMP-W2-A1 F7] Hand-not-found diagnostic copy (distinguish deleted vs malformed)
- [P2] [DCOMP-W2-A1 F8] Felt accessibility verification (bundle w/ DISC-P01)
- [P3] [DCOMP-W2-A1 F9] POSITION_BADGE_COLORS design token
- [P3] [DCOMP-W2-A1 F10] Multi-hand review queue workflow (discovery candidate)
- [P3] [DCOMP-W2-A1 F11] HeroCoachingCard disclosure contract (docs/design/contracts/)
- [P3] [DCOMP-W2-A1 F12] Skip-to-significant action nav
```

---

## Severity rubric

Standard template rubric — see `docs/design/audits/_template.md`.

## Review sign-off

- **Drafted by:** Claude (main), session 2026-04-22
- **Reviewed by:** [owner] on [date]
- **Closed:** [date]

## Change log

- 2026-04-22 — Draft. Review-surface audit: weaker destructive-action concern (no P0s), stronger persona-JTBD-unserved concern. Combined Gate-2 + Gate-4 precedent matches W4-A2/A3 authoring pattern.
