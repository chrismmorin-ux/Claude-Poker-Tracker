# Blind-Spot Roundtable — 2026-04-21 — TableView

**Type:** Gate-2 pre-audit blind-spot check (DCOMP-W1)
**Trigger:** Roadmap-mandated Gate 2 for TableView before the Wave 1 heuristic audit.
**Participants:** product-ux-engineer (Stages A/B/C/E), systems-architect (Stage D), Claude synthesis.
**Artifacts read:** `surfaces/table-view.md`, all core personas, key situational personas (mid-hand-chris, between-hands-chris, push-fold-short-stack, bubble-decision), `jtbd/ATLAS.md`, `features/INVENTORY.md`, `TableView.jsx` + `CommandStrip.jsx` + `SeatContextMenu.jsx`.
**Method:** Two parallel sub-agents on independent stage slates; synthesis below.
**Status:** COMPLETE. Gate 3 (framework gap-fills) CLOSED 2026-04-21 same session — see [Gate 3 resolution notes](#gate-3-resolution-2026-04-21) below. Gate 4 (heuristic audit) is next.

---

## Feature summary

TableView is the main app's live-hand-entry surface. It is the most-used view — Chris uses it every hand. The surface artifact was authored 2026-04-21 (DCOMP-W0 S1). This roundtable is the pre-audit scoping exercise: before running the formal heuristic audit (the next step in Wave 1), hunt for things the framework itself would miss.

---

## Stage A — Persona sufficiency
**Output: ⚠️ PATCH NEEDED**

### A1 — No in-hand situational persona for the Ringmaster (host mode)
The core [Ringmaster](../personas/core/ringmaster-home-host.md) covers settlement goals but has no sub-persona for the moment of *simultaneously dealing, managing the blind timer, handling a rebuy request, and recording action for a hand in flight.* This is a distinct cognitive load profile from mid-hand-chris (who is a player, not a host). Gap: **new situational persona** needed, working name `ringmaster-in-hand.md`.

### A2 — No "first real hand, no training" situational persona for the Newcomer
[Newcomer](../personas/core/newcomer.md) describes goals but no situational persona models first-contact confusion with the orbit strip, absent-seat toggle, or right-click seat menu. The surface artifact handwaves this to ON-82 (Proposed). Gap: **new situational persona** `newcomer-first-hand.md` OR decision to treat ON-82 as the design deliverable that closes the gap.

### A3 — Push/Fold Short-Stack listed but service gap is large
[Push/fold short-stack](../personas/situational/push-fold-short-stack.md) is mapped. Its primary need is a precomputed push/fold verdict in <1 second. TableView serves via tournament overlay + `mRatioGuidance`, but the visible surface is the equity-derived `LiveAdviceBar` tag, which does not answer the push/fold question at ≤15bb. This is a design-spec gap, not a persona gap — flagged here for the audit to formalize.

---

## Stage B — JTBD coverage
**Output: ⚠️ EXPANSION NEEDED + factual defect**

### B1 — No JTBD for "mark a hand for post-session review *while still recording it*"
[Between-hands Chris](../personas/situational/between-hands-chris.md) describes tagging a hand for later. ATLAS has `SR-26` (flag disagreement) and `SR-88` (similar-spot search), but both are Proposed and oriented to review surfaces, not live entry. The live tagging job has no Active JTBD. Gap: **new JTBD** in HE domain, working name HE-17 (or an active-status addition to SR-26).

### B2 — No JTBD for "confirm the pot size is correct before acting"
TableView has a `PotDisplay` + `handlePotCorrection` — the feature exists. No JTBD names pot-validation as an outcome. Live pot reconstruction from action logs is error-prone (missed bets, side pots). Gap: **new JTBD** in MH domain.

### B3 — MH-10 served but not claimed in the surface artifact
`LiveAdviceBar` renders reasoning text (Item 28 work). The surface artifact omits MH-10 from its JTBD list. Fix: **add MH-10 to `surfaces/table-view.md`.**

### B4 — Phantom JTBD IDs in `personas/situational/bubble-decision.md` (framework defect)
**Confirmed by direct grep.** `bubble-decision.md` lines 57–58 reference `JTBD-TS-01` and `JTBD-TS-03`, which do not exist in the ATLAS (TS domain only defines TS-35..42). Traceability is broken. Fix options: (a) replace with TS-35 + a new JTBD for pay-jump-proximity, or (b) add TS-01/TS-03 to the atlas and renumber. This is a **framework-hygiene finding**, not a TableView finding — promote to H1 (discovery triage) or handle here.

---

## Stage C — Situational stress test
**Output: ❌ FUNDAMENTAL MISMATCHES**

### C1 — `window.confirm()` on Reset Hand in live play
**Verified in code:** `CommandStrip.jsx:254` — `if (!window.confirm('Reset all actions for this hand?')) return;`. Mid-hand-chris's surface contract explicitly forbids modal interruptions. Native `confirm` pulls focus, blocks rendering, and requires two-tap dismissal. The codebase already has a correct pattern (toast + undo, used for Next Hand + Clear Player). This is the single most-acute finding; **candidate P1 audit finding**.

### C2 — Recent players list in SeatContextMenu scrolls silently
`SeatContextMenu.jsx` sets `max-h-96` + `overflow-y-auto` on the recents list with up to 20 players. On a 720px-height viewport, list overflow is invisible — no count badge, no "show more" affordance, no scrollbar cue on touch. Between-hands Chris scans for a name, doesn't see it, may create a duplicate. **Candidate P2 audit finding.**

### C3 — Push/fold verdict mismatch at ≤15bb
`useLiveEquity` + `LiveAdviceBar` produce an equity-derived tag (`eq >= 0.55` = VALUE). The push/fold decision at 12bb is driven by ICM + opponent fold frequency, not raw equity. The persona's <1-second chart verdict is not what the surface delivers. This is a **design-level mismatch** that will surface in the audit; raising here to flag that it may require a dedicated "PushFold verdict" widget, not an adjustment to existing advice.

### C4 — Orbit strip horizontal scroll has no scroll indicator
`CommandStrip.jsx:554` uses `overflow-x-auto` on the preflop orbit strip. At 9 seats rendered in a right-rail column, seats off-right are invisible. Tap-ahead shortcuts fail silently when the target seat is scrolled off. **Candidate P2 audit finding.**

---

## Stage D — Cross-product / cross-surface
**Output: ⚠️ PARTNER SURFACES NEED UPDATES**

### D1 — Persisted-hand schema contract between TableView writers and HandReplay readers is implicit
`HandReplayView/VillainAnalysisSection.jsx:40,46` has dual-path fallbacks (`hand.cardState.communityCards || hand.gameState.communityCards`), which is evidence the shape has already migrated once without updating all readers/writers. No surface artifact or schema document defines the canonical persisted-hand shape. **Recommend: promote persisted-hand schema to `STATE_SCHEMA.md` with named invariants.**

### D2 — `briefing.reviewStatus` JTBD loop is broken across surfaces
TableView renders per-seat briefing badges (`TableView.jsx:252–278`) sourced from `tendencyMap[playerId].briefings`. The action to review/accept/dismiss lives in PlayersView's ExploitReviewQueue. There is **no navigation edge** from a seat badge to the review queue. A user sees a count, can't clear it without abandoning the table. **Cross-surface finding — affects table-view + players-view.**

### D3 — `autoOpenNewSession` is a transient side-effect stored as reducer state
TableView sets the flag then navigates; SessionsView reads and clears in a useEffect (`SessionsView.jsx:73–77`). If SessionsView unmounts before the effect fires (rapid nav, deep-link), the flag leaks. **Recommend: make it a navigation payload, not persistent state.** Candidate ARCH finding.

### D4 — Hybrid Semi-Pro persona spans both product lines but tournament overlay is main-app-only
Feature F-10 is tagged `main` in INVENTORY. The sidebar has no M-ratio / ICM / blind-timer counterpart. A Hybrid user playing an online MTT through the extension gets zero tournament context. **Cross-product finding — likely expands Wave 5 scope.**

### D5 — Orphaned `DecisionTreeView.jsx` (F-W5) and unmet "why this rec" drill-in
The orphan is the natural drill-in from `LiveAdviceBar` to a depth-2/3 branch visualization. No deep-link exists. JTBD MH-10 partially-served in LiveAdviceBar; fully-served path requires reviving or retiring F-W5. **Flag to audit — product decision, not compliance one.**

---

## Stage E — Heuristic pre-check
**Output: ⚠️ SPECIFIC ADJUSTMENTS NEEDED (5 pre-violations)**

| ID | Heuristic(s) | Finding | Evidence |
|----|-------------|---------|----------|
| E1 | H-N05 + H-PLT06 | `window.confirm` on Reset Hand | `CommandStrip.jsx:254` (verified) |
| E2 | H-N03 | Next Hand undo window 5000ms (Clear uses 6000ms) — mismatched + likely too short for between-hands cadence | `CommandStrip.jsx:223`; Clear at 364 |
| E3 | H-ML06 | Recent-players row `min-h-[40px]` < 44px touch floor | `SeatContextMenu.jsx:83` (verified) |
| E4 | H-PLT07 | Orbit strip `overflow-x-auto` with no scroll indicator / state-awareness | `CommandStrip.jsx:554` |
| E5 | H-N01 | `useOnlineAnalysisContext` used in live TableView — ambiguous system status (live vs. cached from online session) | `CommandStrip.jsx:78, 487` |

E1 is the sharpest. E3 and E5 are both in the "already ships, easy to miss" class. All five will carry forward as candidate findings for the Wave 1 heuristic audit.

---

## Overall verdict

**YELLOW.**

Rationale:
- Core personas + JTBDs largely cover TableView's surface area (not RED).
- But five pre-violations, two concrete persona patches, two new JTBDs, one phantom-ID framework defect, and five cross-surface ripples = enough gaps that the formal audit should NOT proceed until Gate 3 has run.
- The `window.confirm` finding (C1/E1) is severe enough to be a standalone P1 — could be fixed immediately once the audit formalizes it.

---

## Required follow-ups

### Gate 3 (Research) — SCOPED
- **Persona additions:**
  - [ ] Author `personas/situational/ringmaster-in-hand.md` (A1)
  - [ ] Author `personas/situational/newcomer-first-hand.md` (A2) — OR accept ON-82 as the design deliverable
- **JTBD additions:**
  - [ ] HE-17 "mark a hand for post-session review mid-recording" (B1) — promote SR-26 to Active or add new
  - [ ] MH-?? "validate pot size before acting" (B2)
  - [ ] MH-10 claim added to `surfaces/table-view.md` (B3)
- **Framework defect (parallel — not blocking Gate 4):**
  - [ ] Resolve phantom JTBD-TS-01 / TS-03 in bubble-decision.md (B4) — route via DCOMP-H1 or fix inline

### Gate 4 (Design) — pre-commitments
- [ ] **P1**: replace `window.confirm` in Reset Hand with toast+undo (C1/E1)
- [ ] P2: SeatContextMenu recents-list scroll indicator + count badge (C2)
- [ ] P2: orbit-strip scrollability affordance (C4/E4)
- [ ] P2: recent-players row touch target ≥44px (E3)
- [ ] P3: undo-window consistency (E2) — pick one (5s or 6s) + align
- [ ] P3: clarify advice-source naming / add freshness indicator (E5)
- [ ] Design task: PushFold-specific widget for ≤15bb decisions (C3)
- [ ] Schema doc: canonical persisted-hand shape + invariants (D1)
- [ ] Navigation: seat-badge → player-review-queue cross-surface (D2)
- [ ] Reducer cleanup: `autoOpenNewSession` → navigation payload (D3)
- [ ] Wave 5 scope note: sidebar tournament-overlay parity (D4)
- [ ] Product decision: revive or retire `DecisionTreeView.jsx` (D5)

### Out of scope for this audit
- The heuristic audit itself — runs next session as Wave 1 Session 2.
- Implementation of any of the above — Gate 4 / Gate 5 work, not Gate 2.

---

## Open questions (for owner)

1. **Gate 3 scope**: author 2 new situational personas + 2 new Active JTBDs now, or defer until H1 discovery triage and handle in one batch?
2. **Phantom JTBD-TS-01/TS-03**: fix inline now, or route via H1?
3. **Push/Fold widget (C3)**: treat as a Wave 1 discovery (and log in `discoveries/`) or bundle with the heuristic audit findings?
4. **Cross-product tournament overlay (D4)**: does this expand Wave 5 scope or become its own project?

---

## Gate 3 resolution (2026-04-21)

Same-session follow-up closed the framework gaps surfaced above. Per METHODOLOGY.md (audits are immutable once closed), this section is *appended*, not a revision.

**Persona additions (Stage A):**
- ✅ [personas/situational/ringmaster-in-hand.md](../personas/situational/ringmaster-in-hand.md) — closes A1.
- ✅ [personas/situational/newcomer-first-hand.md](../personas/situational/newcomer-first-hand.md) — closes A2.
- ⏸ A3 (push/fold persona is mapped; service gap) — routed to [DISC-2026-04-21-push-fold-widget](../discoveries/2026-04-21-push-fold-widget.md), Gate 4/5 work.

**JTBD additions (Stage B):**
- ✅ `JTBD-HE-17` flag-hand-mid-recording — added to [hand-entry.md](../jtbd/domains/hand-entry.md); closes B1.
- ✅ `JTBD-MH-11` validate-pot-before-acting — added to [mid-hand-decision.md](../jtbd/domains/mid-hand-decision.md); closes B2.
- ✅ `MH-10` now claimed in [surfaces/table-view.md](../surfaces/table-view.md); closes B3.
- ✅ B4 framework defect resolved: phantom `JTBD-TS-01/03` in bubble-decision.md replaced by `TS-43` + `TS-44` (both Active, added to [tournament-specific.md](../jtbd/domains/tournament-specific.md)). ATLAS.md counts updated. Evidence: [EVID-2026-04-21-BUBBLE-PHANTOM-JTBD](../evidence/LEDGER.md).

**Cross-surface / contract (Stage D):**
- ✅ D1 persisted-hand schema → [contracts/persisted-hand-schema.md](../contracts/persisted-hand-schema.md) authored with writers/readers/invariants/change protocol. New `contracts/` directory seeded with [README](../contracts/README.md).
- ✅ D2 briefing-badge-nav → [journeys/briefing-review.md](../journeys/briefing-review.md) (intentionally-incomplete journey documenting the gap) + [DISC-2026-04-21-briefing-badge-nav](../discoveries/2026-04-21-briefing-badge-nav.md).
- ⏸ D3 `autoOpenNewSession` reducer hygiene — Gate 4/5 work; not blocking the heuristic audit.
- ⏸ D4 sidebar tournament parity → [DISC-2026-04-21-sidebar-tournament-parity](../discoveries/2026-04-21-sidebar-tournament-parity.md). May expand Wave 5 scope.
- ⏸ D5 DecisionTreeView fate → [DISC-2026-04-21-decision-tree-fate](../discoveries/2026-04-21-decision-tree-fate.md). Owner A/B/C decision pending.

**Evidence ledger seeded (for next audit):**
- ✅ EVID-2026-04-21-TABLE-WINDOW-CONFIRM
- ✅ EVID-2026-04-21-TABLE-TOUCH-TARGET-40PX
- ✅ EVID-2026-04-21-HAND-SCHEMA-DUAL-PATH
- ✅ EVID-2026-04-21-BUBBLE-PHANTOM-JTBD

**Carry-forward findings (Stage C + E) remain open for Gate 4 heuristic audit:**
- C1/E1: `window.confirm` → toast+undo (candidate P1)
- C2: SeatContextMenu recents scroll indicator (candidate P2)
- C3: Push/fold widget (tracked as discovery)
- C4/E4: Orbit strip scroll indicator (candidate P2)
- E2: Undo window consistency (candidate P3)
- E3: 40px recent-players touch target (candidate P2)
- E5: Advice-source naming / freshness indicator (candidate P3)

**What this means for the roadmap:**
- Gate 3 CLOSED. Next session = Gate 4 heuristic audit on table-view.
- Sessions-view + showdown-view audits (the other two surfaces in Wave 1) can be dispatched in parallel; they do NOT require their own blind-spot roundtables unless new gaps surface.
- Wave 1 estimate revises DOWN slightly — the Gate 3 work was bundled into W1-S1 rather than spawning a separate session.

---

## Change log

- 2026-04-21 — Created. Gate-2 blind-spot roundtable on TableView. Part of DCOMP-W1 Session 1.
- 2026-04-21 — Gate 3 resolution appended (same session). 2 personas + 2 JTBDs + 1 phantom-ID fix + 1 contract doc + 1 journey doc + 4 discoveries + 4 evidence entries.
