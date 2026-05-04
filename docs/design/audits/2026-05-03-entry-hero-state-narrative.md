# Gate 1 Entry — 2026-05-03 — Hero-State Narrative HandReplay Wire

**Feature working name:** Hero-State Narrative HandReplay Wire (HSP-W1)
**Proposed by:** Master Plan §D Phase 5 chain (founder-promoted 2026-05-02 in `docs/HERO_STATE_DESIGN.md`); ratified for SPR-029 after the HSP build (SPR-024..SPR-027 closed types + classifier + role-translator + orchestrator + 18 narrative templates).
**Gate:** 1 (Entry) — mandatory
**Next gate:** 4 (Design) — Gate 2 (Blind-Spot Roundtable) NOT required per verdict below
**Status:** OPEN — this document is the Gate 1 artifact. No production code written yet. Audit-only per `docs/design/LIFECYCLE.md` Gate 1 contract.
**Sprint:** SPR-029 / WS-143.

---

## Feature summary (as proposed)

Render the `HeroState` produced by `src/utils/heroState/buildHeroState.js` (shipped WS-142, SPR-027) inside the existing `HandReplayView` ReviewPanel as a new `HeroStateSection` between `HeroCoachingCard` and `VillainAnalysisSection`. The section appears only on hero-action steps; it presents the canonical reasoning frame side-by-side with hero's actual action, in neutral editor's-note tone.

The `HeroStateSection` is the **narrative realization** of the canonical-baseline-vs-actual comparison surface that the SCF Gate 5 leak-rule wiring (WS-013) depends on. Without it, SCF G5 has no surface to attach leak-fired annotations to (the existing hero-leak inline annotation in `HeroCoachingCard` per SCF Gate 4 fires *only when a leak rule matches*; HSP narrative renders *every hero decision*).

Owner-decided scope (2026-05-03, captured in plan-mode AskUserQuestion):

1. **Render placement.** Inline between `HeroCoachingCard` (line 191) and `VillainAnalysisSection` (line 194). Collapsible; default expanded for hero actions, hidden for villain actions.
2. **Canonical-vs-actual style.** Side-by-side neutral panels (canonical narrative panel | hero's actual action panel). No grading copy. Aligned/deviation labels in neutral editor's-note tone per `chris-live-player.md` autonomy red line #5.
3. **Persistence.** Rederive `HeroState` on each replay view (no IDB schema change for v1). Aligns with `HERO_STATE_DESIGN.md §10.2` caching deferral.

---

## Critical scope-shifting discoveries

Three realities surfaced by Phase-1 codebase exploration that shape what "HSP HandReplay wire" means today.

### Discovery 1 — `HandReplayView` ALREADY HAS hero-leak inline annotation (SCF Gate 4); HSP narrative is structurally distinct + complementary

`docs/design/surfaces/hand-replay-view.md` §"Hero-leak inline annotation (SCF Gate 4 extension, 2026-05-02)" describes a per-action ⚑ badge inside `HeroCoachingCard` that fires only when:

- Hero action matches a hero-leak detector rule's situation key, AND
- Sample size ≥ 30 (per AP-SCF-04 floor), AND
- Severity exceeds rule-defined threshold

Tap toggles inline expansion to a CD-5 claim card with `Drill this` / `Dismiss` / `Snooze` affordances.

**HSP narrative is a different concept**: it renders the canonical reasoning frame for **every** hero decision point (not gated on leak detection), regardless of whether hero's action was aligned or a deviation. The two coexist:

| Concept | Trigger | Granularity | Surface | Purpose |
|---------|---------|-------------|---------|---------|
| Hero-leak inline annotation (SCF G4) | Leak rule fires + n≥30 + severity threshold | Per-action when fired (sparse) | Inline badge inside `HeroCoachingCard` | Surface a detected pattern for drill |
| HSP narrative (this audit) | Hero decision point reached | Per-action always (when isHeroAction) | New `HeroStateSection` between coaching + villain analysis | Render the canonical reasoning frame as baseline |

**Implication:** the audit explicitly distinguishes these two concepts. WS-143 does NOT replace or modify the SCF G4 hero-leak annotation; it adds a new section that provides the always-present canonical baseline that SCF G5 leak-rule wiring will reference. They sit side-by-side in the ReviewPanel.

### Discovery 2 — All required personas + JTBDs already exist; this is a surface-bound fix, not a surface addition

Phase-1 inventory:

| Asset | Exists? | Source |
|-------|---------|--------|
| Chris (core persona) | ✓ | `personas/core/chris-live-player.md` |
| Post-session Chris (situational) | ✓ | `personas/situational/post-session-chris.md` |
| HandReplayView surface artifact | ✓ | `surfaces/hand-replay-view.md` (last reviewed 2026-04-21; SCF G4 update 2026-05-02) |
| CO-54 (see leak without grading) | ✓ Active | `jtbd/domains/coaching.md` |
| CO-55 (learn next concept) | ✓ Active | `jtbd/domains/coaching.md` |
| CO-56 (validate improvement) | ✓ Active | `jtbd/domains/coaching.md` |
| CO-57 (self-rate confidence) | ✓ Active (deferred to v2 per SCF G3) | `jtbd/domains/coaching.md` |
| SR-28 (deep-review against theory) | ✓ Active | `jtbd/domains/session-review.md` |
| SR-29 (know if analog exists) | ✓ Active | `jtbd/domains/session-review.md` |

Zero new persona files; zero new JTBDs; surface artifact already covers Chris + Post-session Chris as primary. The change is a **surface-bound fix** per `LIFECYCLE.md` scope classification — adding a new section to an existing surface that already serves the relevant personas + JTBDs.

### Discovery 3 — `chris-live-player.md` autonomy red line #8 binds HSP narrative to self-coach mode only

`chris-live-player.md` lines 106–122 enumerate 9 autonomy red lines that bind every HSP / SCF / coaching feature. Two are load-bearing for WS-143:

- **#5 (no shame / engagement-pressure):** HSP narrative copy + alignment labels MUST be in editor's-note tone. "Aligned" / "Deviation" framing is acceptable; "you got it right" / "you missed by X%" / streak / score copy is forbidden. This shapes the side-by-side panel content per implementation decision #2.
- **#8 (no cross-surface contamination):** HSP narrative renders ONLY on post-hand self-coach surfaces (HandReplay). It does NOT render on live-table surfaces (`OnlineView`, `TableView`, sidebar HUD, `TournamentView`, `ShowdownView`). This matches the existing source-util-policy whitelist enforced by SCF Gate 4 hero-leak annotation (CI-grep at `audits/2026-05-02-gate4-design-self-coach-foundation.md` §SCF-G4-SUP).

**Implication:** WS-143 implementation must:
- (a) Render only inside `src/components/views/HandReplayView/`
- (b) Lint-style test that no "wrong" / "missed" / "score" / "streak" / engagement-pressure copy ships in the rendered output
- (c) Be added to the same source-util-policy whitelist as hero-leak annotation if SCF Gate 5 adds CI-grep enforcement at that level

---

## Output 1 — Scope classification

**Surface-bound fix.** HandReplay surface exists. Adding a new section (HeroStateSection) between HeroCoachingCard and VillainAnalysisSection. No new surface, no new persona, no new JTBD, no cross-product reach.

## Output 2 — Personas identified

**Primary:** Chris (core, primary author of self-review) + Post-session Chris (situational, post-hand consumer). Both exist and already serve HandReplay per the surface artifact. Full coverage.

**Secondary** (already on the surface, indirectly served by HSP): Apprentice + Coach + Coach-review-session. HSP narrative supports apprentice mode (read-the-frame learning) and coach mode (point at canonical baseline during review with student).

**No new persona file required.**

## Output 3 — JTBD identified

HSP narrative serves jobs that already exist in the Atlas:

- **CO-54** (see own leak without being graded) — HSP narrative renders the canonical baseline; alignment labels are neutral, no grading
- **CO-55** (learn next concept) — narrative body explains the canonical reasoning, which is the concept Chris is supposed to learn
- **CO-56** (validate prior coaching translates to play improvement) — comparing canonical vs actual across multiple replay sessions surfaces improvement trajectories
- **CO-57** (self-rate confidence) — deferred to v2 per SCF G3 (out of scope for WS-143)
- **SR-28** (deep-review hand against theoretical ground-truth) — HSP narrative IS the theoretical ground-truth presentation
- **SR-29** (know if theoretical analog exists) — narrative renders or degrades-with-message if no analog (e.g., MULTIWAY archetype throws upstream)

**No new JTBD required.** Update the surface artifact's JTBD-served list to add CO-54..56 + SR-28/29 (Phase B of plan).

## Output 4 — Gap analysis

**Verdict: GREEN.**

Justification:
- Personas: complete (Chris + Post-session Chris exist + cover this; secondary roster covers apprentice/coach modes).
- JTBDs: complete (CO-54..56 + SR-28/29 all exist in Atlas; CO-57 explicitly out-of-scope per SCF G3 deferral).
- Surface: exists; this is a section addition not a surface addition.
- Cross-product reach: none (autonomy red line #8 honored — HSP narrative stays in HandReplay self-coach mode).
- Cross-surface autonomy red lines: red line #5 (no grading copy) is enforceable via lint-style test; red line #8 (no live-surface contamination) is enforceable via CI-grep on existing source-util-policy whitelist.

**Gate 2 (Blind-Spot Roundtable) NOT required** per `ROUNDTABLES.md` triggers — no YELLOW/RED gap, no new surface, no new persona archetype, no cross-product expansion, no owner flag for scrutiny.

---

## Discovery / non-obvious findings (recorded for future reference)

1. **HSP narrative is the load-bearing baseline for SCF Gate 5.** Without WS-143 shipping a canonical-vs-actual surface, SCF G5 leak-rule wiring (WS-013) has nothing to attach leak-fired annotations to. The chain is: WS-143 (this) → SCF G5 leak detector compares hero's actual action against `plan.primary` from the rendered HeroState → leak surfaces in `HeroCoachingCard` (existing SCF G4 path) when n≥30 + severity > threshold. WS-143 is the missing canonical-baseline rendering.

2. **HSP narrative coexists with HeroCoachingCard, NOT replaces it.** HeroCoachingCard surfaces EV verdict + alternative actions + weakness pattern callout from the existing analysis pipeline. HSP narrative is a *new representation* (the canonical reasoning frame from `buildHeroState`); it does not subsume the existing coaching card. Founder explicitly chose option 1 (inline between, not "replace HeroCoachingCard") in plan-mode decision #1 — keeps both representations available; WS-143 is non-destructive to existing UX.

3. **Side-by-side comparison style is the autonomy-correct framing.** Decision #2 picked side-by-side neutral panels over annotated single panel because the annotated form's "✓ aligned" / "⚠ deviation" badge framing edges toward graded copy unless carefully neutralized. Side-by-side panels with neutral alignment labels honor red line #5 by default — no badge to misframe.

4. **Rederive policy aligns with HSP-DESIGN.md §10.2 caching deferral.** Decision #3 picked rederive because: (a) zero IDB schema change risk for v1; (b) the existing `useHandReplayAnalysis` hook already runs analysis lazily per-decision, so HSP rederive fits the same lazy pattern; (c) perf measurements during dev will inform whether SPR-030+ should add caching (decision-key hash on hand-id + actionIndex + heroSeat).

---

## Open questions / followups (none blocking)

- Q1 (deferred to SCF G5): Does the hero-leak inline annotation in `HeroCoachingCard` get re-anchored to read from the rendered `HeroState.plan.primary` baseline (instead of running its own canonical computation)? Out of scope for WS-143; tracked for SCF G5 (WS-013) wiring.
- Q2 (deferred): Can a future iteration cache HSP per HandReplay record (IDB v20 → v21) once perf measurements warrant? Tracked in HSP-DESIGN.md §10.2; no ticket yet.

---

## Next gate

**Gate 4 (Design) directly.** Update `docs/design/surfaces/hand-replay-view.md` per Phase B of the WS-143 plan (add HSP section to anatomy, JTBDs served, change log entry). Skip Gate 2 (verdict GREEN) and Gate 3 (no new research needed — all primitives shipped in SPR-024..SPR-027).

## Audit close-out

- Drafted by: Claude (autonomous), 2026-05-03, in WS-143 plan-mode after exploration agents inventoried surface + framework + personas + JTBDs.
- Reviewed by: founder (acknowledged decisions 1-3 in plan-mode AskUserQuestion; final GREEN verdict acceptance is decision #4 — to be confirmed at sprint close-out).
- Status: GREEN, Gate 4 unblocked, Gate 2 not required.
