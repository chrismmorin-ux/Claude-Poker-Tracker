# Gate 1 Entry — 2026-05-09 — EAL Stream C: Live Anchor Badge

**Feature working name:** EAL Stream C — Live Anchor Badge + System Observation Writer
**Proposed by:** Workstream-driven (`WS-016`, sprint `SPR-059`)
**Gate:** 1 (Entry) — mandatory
**Next gate:** 4 (Design) — see Gate 2 disposition below
**Status:** OPEN — this document is the Gate 1 artifact; Gate 4 surface authored same-session at `surfaces/live-anchor-badge.md`

---

## Feature summary (as proposed)

The Exploit Anchor Library has shipped its full pure-utils stack across Streams B + D: `getMatchingAnchors(situation, anchors)` returns active anchors matching the current line, the Anchor Library study surface and Anchor Detail Panel are live, retirement evaluator + un-retirement journey are wired, and HandReplay's Tier-0 owner-capture (Section G) is shipped. **Nothing renders an anchor on the live in-game surface yet.** Stream C closes that gap.

The new affordance is a small badge that appears in the LiveAdviceBar when an authored archetype fires for the current villain × line — e.g., when villain-style is `Nit` and the line matches `EAL_SEED_01` (river overbet on a 4-flush scare board), the badge renders `● Nit scare-fold ▮▮▮▮▮▯▯▯▯▯`. A second smaller surface adds a `●` overlay on the SizingPresetsPanel preset matching `consequence.sizingShift`. A headless system-observation writer logs every fire (gated on enrollment state) so Tier 2 calibration accrues evidence.

---

## Prior-art note (no scope-shifting discovery)

Before authoring this Gate 1, I confirmed:

1. **`live-exploit-citation` surface is already speced** (`docs/design/surfaces/live-exploit-citation.md`, 2026-04-23 Gate 4) but unimplemented (Phase 9 of the exploit-deviation project, flag-gated `ENABLE_EXPLOIT_CITATION`). It cites a `VillainAssumption` (predicate-level, exposes `n=52, 17%`) — a **distinct signal class** from the anchor badge.
2. **EAL Gate 2 already ran** on 2026-04-24 (`docs/design/audits/2026-04-24-blindspot-exploit-anchor-library.md` + rerun) with explicit Stage A/C/E coverage of the LiveAdviceBar anchor badge.
3. **AP-07** (`docs/projects/exploit-anchor-library/anti-patterns.md:102-118`) explicitly forbids calibration-state leakage onto the live surface — anchor badge shows `archetypeName + confidence dial` only.

These facts establish the constraint envelope. This Gate 1 codifies the surface addition; it does not reopen settled design decisions.

---

## Output 1 — Scope classification

**Primary classification:** **Surface addition** — new affordance class on existing surfaces (LiveAdviceBar adds a 6th row; SizingPresetsPanel adds a status-dot overlay on one preset button).

**Secondary classification considerations:**

- **New affordance vocabulary on a live surface.** Status-dot + ≤3-word archetype name + 10-segment confidence dial in a single row. The dot + dial precedent exists in `AnchorCard.jsx` (study-mode); the live composition is new.
- **New interaction model.** Tap = deferred drill (target stored, rendered post-hand or between hands per AP-07 line 112). Distinct from `live-exploit-citation`'s tap = immediate Z4 expansion.
- **New signal class on the live surface.** Anchor (archetype-level) vs Citation (predicate-level). Both surfaces target the LiveAdviceBar / Z2 advice slot in different rows. No render conflict because citation is unimplemented in v1.
- **Headless observation writer.** Pure-utils system-observation appender; not user-facing. Gated on enrollment per `WRITERS.md:47`.

**NOT a new routed view.** No `SCREEN.*` route added.
**NOT a new persona.** Inherits the EAL Gate 2 amendment to `chris-live-player.md` (`observation_capture_active` attribute).

---

## Output 2 — Personas identified

### In scope (anchor-badge primary users)

| Persona | Role | Core/Situational |
|---|---|---|
| [Mid-Hand Chris](../personas/situational/mid-hand-chris.md) | 1.5s glance budget; load-bearing constraint for badge legibility | Situational — primary |
| [Chris (live player)](../personas/core/chris-live-player.md) | Owner / primary live-game user | Core |
| [Weekend Warrior](../personas/core/weekend-warrior.md) | Live cash recreational; phone-based; secondary live-game user | Core |
| [Rounder](../personas/core/rounder.md) | Live cash serious; occasional mid-hand glance | Core |
| [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) | Mixed live + online; cross-format | Core |

### Out of scope (explicitly excluded)

- [Newcomer](../personas/core/newcomer.md) — anchor features are advanced; Gate 2 voice flagged a 20-50-hand minimum threshold (deferred to follow-up).
- [Scholar (drills-only)](../personas/core/scholar-drills-only.md) — study territory, served by AnchorLibraryView.
- [Pre-Session Preparer](../personas/situational/presession-preparer.md) — pre-session anchor review is served by AnchorLibraryView's filter, not the live badge.
- [Multi-Tabler](../personas/core/multi-tabler.md), [Online MTT Shark](../personas/core/online-mtt-shark.md) — sidebar-primary; main-app LiveAdviceBar mirror inherits the badge but these personas' primary surface is the sidebar.

### Persona-sufficiency check

> *"Does our current cast actually cover this feature, or do we need a new persona?"*

**Answer: 🟢 GREEN — no new persona required.** Mid-Hand Chris's 1.5s glance budget is the load-bearing constraint, and that persona is fully modeled. The EAL Gate 2 amendment to `chris-live-player.md` (`observation_capture_active`) covers the capture-mode adjacency; the live anchor badge is a *consumer* surface, not a capture surface, and inherits the existing live-player attentional model unchanged.

---

## Output 3 — JTBD identified

### Already served (inherited)

- **MH-01** — *See the recommended action for the current street* — Active. Anchor badge is a secondary signal alongside the primary advice; never replaces it.
- **MH-13** — *Dismiss or downrank a live-cited assumption in the moment (silent override)* — Active. Hero overrides the anchor by just playing the alternate action; the badge does not fight.

### Adjacent but distinct (not served by this surface)

- **MH-12** — *See the specific assumption(s) cited as backing for a recommendation* — served by `live-exploit-citation` (predicate-level), NOT by the anchor badge. The two surfaces are parallel.
- **MH-10** — *Plain-English "why" for a recommendation* — served by `live-exploit-citation`'s drill-down, not by the anchor badge (anchor's drill is deferred per AP-07).

### Proposed (new — flagged for Gate 3 authoring if scoped to follow-up)

The anchor badge introduces an **archetype-level** live signal class. The closest atlas entry is MH-12 (assumption-level citation), but the granularity differs. One candidate JTBD framing:

1. **MH-14 (proposed, deferred)** — *See archetype-level pattern recognition for the current hand line*
   > When I'm mid-decision and the system has matched an authored archetype I trust, I want a glanceable confirmation that the pattern is firing for the current villain × line, so I can act with archetype-level conviction without needing to re-derive the underlying assumption chain.
   - Personas: Mid-Hand Chris, Chris-live-player, Rounder, Hybrid Semi-Pro
   - Distinct from MH-12 (predicate-level "why") and MH-01 (action recommendation)
   - **Flagged for Gate 3 authoring as a follow-up ticket.** v1 ships under inherited MH-01 + MH-13; the new framing is non-blocking because the badge serves as a glanceable adjunct, not a primary action driver.

### JTBD-coverage check

> *"Does any proposed outcome not map to an existing JTBD?"*

**Answer: 🟡 YELLOW (mild)** — anchor-level pattern recognition is adjacent to MH-12 but not identical. v1 ships under inherited JTBDs without authoring MH-14; follow-up Gate 3 work can formalize MH-14 if the surface accumulates additional anchor-specific outcomes (deferred drill, cross-anchor inspection, etc.).

---

## Output 4 — Gap analysis verdict

| Dimension | Verdict | Notes |
|---|---|---|
| Personas | 🟢 GREEN | No new persona required; Mid-Hand Chris fully covers the load-bearing 1.5s glance constraint |
| JTBD | 🟡 YELLOW (mild) | Archetype-level signal class adjacent to MH-12; MH-14 framing flagged for follow-up Gate 3 |
| Interaction pattern | 🟡 YELLOW | New affordance vocabulary on live (status-dot + name + dial) and new deferred-drill interaction model — both covered by 2026-04-24 EAL Gate 2 (AP-07, H-PLT01/04/07) |
| Surface structure | 🟢 GREEN | Surface addition only; no structural change to LiveAdviceBar layout (new row appended) or SizingPresetsPanel (decoration overlay) |
| Cross-surface ripples | 🟢 GREEN | `live-exploit-citation` row coexists in parallel; HandReplay deferred drill stub fits existing reducer pattern; AnchorLibraryContext reused unchanged |

### Overall Gate 1 verdict: 🟡 **YELLOW (mild)**

Two YELLOW dimensions: JTBD adjacency (MH-14 candidate) and new interaction pattern.

### Gate 2 disposition: **ALREADY COVERED**

The 2026-04-24 EAL Blind-Spot Roundtable (`docs/design/audits/2026-04-24-blindspot-exploit-anchor-library.md` and the same-day rerun) ran Stages A / C / E across three voices (product-ux, autonomy-skeptic, senior-engineer) with explicit LiveAdviceBar anchor-badge constraints enumerated:

- **Stage A** (persona sufficiency) — `chris-live-player` amended with `observation_capture_active`; no new persona; explicit non-goal: no `owner-as-anchor-author` persona in Phase 1.
- **Stage C** (situational stress) — Mid-Hand Chris 1.5s budget validated; capture flow constraints documented; AP-07 cross-surface contamination rule formalized.
- **Stage E** (heuristic pre-check) — H-PLT01 (≤3-word badge text), H-PLT04 (socially-discreet copy), H-PLT07 (deferred drill on live), H-N03 (durable undo on retire/override), H-N06 (perception primitive names not opaque), H-ML06 (touch-target compliance at scale), 9 autonomy red lines (8 inherited + 1 new: incognito observation).

Every YELLOW dimension flagged in this Gate 1 maps onto a constraint already adjudicated by the 2026-04-24 audit. **No new Gate 2 needed.** Gate 2 normally fires when an audit raises new blind spots; here all the live-badge blind spots are already in the prior audit's record.

This is a defensible "Gate 1 YELLOW, Gate 2 absorbed" disposition — analogous to how a hot-fix audit can sometimes share its blind-spot output with a recent audit on the same scope. The hard floor (per LIFECYCLE.md) is Gate 4 — and Gate 4 is being authored same-session.

---

## Required follow-ups (this sprint)

- [x] **Gate 4 — Design** — surface artifact authored at `docs/design/surfaces/live-anchor-badge.md` (this sprint).
- [ ] **Implementation** — see plan at `C:\Users\chris\.claude\plans\vast-stargazing-pie.md`. v1 scope: hook + badge component + observation writer + LiveAdviceBar Row 6 + SizingPresetsPanel dot overlay + tests + 1600×720 visual verification.

## Required follow-ups (later)

- [ ] **Gate 3 — Research (deferred ticket)** — formalize MH-14 *Archetype-level pattern recognition* in `jtbd/domains/mid-hand-decision.md` if follow-up surfaces (deferred drill UI, cross-anchor inspector, calibration deep-link) accumulate anchor-specific outcomes that don't fit MH-12.
- [ ] **Newcomer-threshold gate** — Gate 2 voice flagged a 20-50-hand minimum threshold for anchor-feature activation. v1 ships ungated; if anchor over-fires for newcomers in practice, add a hands-played gate.
- [ ] **Deferred-drill v2** — Tap stub stores `pending_anchor_drill_id`; v2 wires HandReplayView (between-hands or post-hand context) to consume it and render the drill panel.

---

## Open questions for owner

None blocking. The four design decisions (surface placement, badge anatomy, observation writer scope, SizingPresetsPanel embed) were resolved via plan-mode AskUserQuestion at sprint start; all four recommendations were ratified.

---

## Links

- Feature lifecycle: [`docs/design/LIFECYCLE.md`](../LIFECYCLE.md)
- Methodology: [`docs/design/METHODOLOGY.md`](../METHODOLOGY.md)
- Roundtable template: [`docs/design/ROUNDTABLES.md`](../ROUNDTABLES.md)
- Gate 4 surface this audit authorizes: [`surfaces/live-anchor-badge.md`](../surfaces/live-anchor-badge.md) — same-session
- Sibling live surface (parallel): [`surfaces/live-exploit-citation.md`](../surfaces/live-exploit-citation.md)
- Study surface (host of the same anchor data): [`surfaces/anchor-library.md`](../surfaces/anchor-library.md)
- EAL Gate 2 (already absorbs this surface): [`audits/2026-04-24-blindspot-exploit-anchor-library.md`](2026-04-24-blindspot-exploit-anchor-library.md), [`audits/2026-04-24-blindspot-exploit-anchor-library-rerun.md`](2026-04-24-blindspot-exploit-anchor-library-rerun.md)
- AP-07 cross-surface contamination rule: [`docs/projects/exploit-anchor-library/anti-patterns.md`](../../projects/exploit-anchor-library/anti-patterns.md)
- Stream C work item: `.claude/workstream/queue/WS-016.yaml`
- Sprint: `.claude/workstream/sprints/SPR-059.yaml`

---

## Change log

- 2026-05-09 — Created in plan-mode of SPR-059. Founder-ratified the 4 design decisions (placement / anatomy / writer scope / sizing-embed) before this audit was authored; verdict 🟡 YELLOW with Gate 2 disposition: ALREADY COVERED by 2026-04-24 EAL Blind-Spot Roundtable. Gate 4 surface authored same-session.
