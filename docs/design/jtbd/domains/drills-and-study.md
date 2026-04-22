# JTBD Domain — Drills and Study

Jobs around learning and concept mastery, typically off-table.

**Primary personas:** [Scholar](../../personas/core/scholar-drills-only.md), [Apprentice](../../personas/core/apprentice-student.md), [Rounder](../../personas/core/rounder.md) (occasional), any off-table session.

**Surfaces:** `PreflopDrillsView`, `PostflopDrillsView`.

---

## DS-43 — 10-minute quick drill on today's weak concept

> When I have 10 minutes, I want a quick drill targeted at today's weakness or concept, so study is efficient.

- Partial: Explorer + Line Study ship; routing to weakness-targeted drills is DISC-12 (skill map).

## DS-44 — Correct-answer reasoning (not just score)

> When I miss a drill, I want to see *why* the correct answer is correct, so I learn.

- Active (baseline); depth varies by drill mode.

## DS-45 — Custom drill from own hand history

> When I want to study a specific spot I actually faced, I want a drill built from my own history, so practice is relevant.

- State: **Proposed** (DISC-13).

## DS-46 — Spaced repetition for key charts

> When mastering preflop charts, I want spaced repetition on cards / scenarios I've missed, so retention is real.

- State: **Proposed**.

## DS-47 — Skill map / mastery grid

> When progressing, I want a skill grid showing concept mastery (preflop by position × postflop by texture × ICM × etc.), so I know what to practice.

- State: **Proposed** (DISC-12).

## DS-48 — Understand villain's range composition as the decision driver

> When studying a specific decision, I want to see villain's range decomposed by hand-type groups with per-group weight and my equity vs each, so my decision reasoning is range-vs-range not hand-vs-hand.

- State: **Active** (2026-04-22) — served by `bucket-ev-panel-v2` P1 primitive post-Path-2 restructure.
- Doctrine: first-principles decision modeling (`POKER_THEORY.md §7`, `feedback_first_principles_decisions.md`).
- Measures of success: student can name the largest group in villain's range on any studied decision; student's hypothesized correct action agrees with the weighted-total EV on ≥80% of drills after concept internalization.

## DS-49 — See weighted-total EV decomposition for a decision

> When studying a specific decision, I want to see the arithmetic — `Σ(villain-bucket weight × my EV vs bucket) = total EV per action` — so the correct answer is traceable, not asserted.

- State: **Active** (2026-04-22) — served by `bucket-ev-panel-v2` P2 primitive (`WeightedTotalTable`).
- Distinct from DS-44 ("correct-answer reasoning"), which is neutral on hero-first vs range-first framing; DS-49 specifically requires the arithmetic be visible as terms, not just as a final EV number.
- Measures of success: student can identify which villain group contributes the largest EV term for the correct action; student can explain why the same hand action shifts EV between archetypes when shown the table.

## DS-50 — Walk a hand line branch-by-branch with consequences shown

> When studying a multi-street scenario, I want to walk the decision tree node-by-node and see every branch's rationale, so I learn the whole-hand pattern, not just isolated spots.

- State: **Active** — served by Line Study (`LineWalkthrough` + `LineNodeRenderer` + `LineBranchBreadcrumb`), shipped 2026-04-20.
- Promoted from implicit on 2026-04-22 (previously listed only in `postflop-drills.md` as "line-study JTBD, implicit"). Atlas-explicit now.

## DS-51 — Understand villain's range shape on any flop before deciding

> When studying a board texture, I want the full breakdown of villain's range vs the flop (made hands / draws / whiff), so I internalize the range shape, not just individual hand equities.

- State: **Active** — served by Explorer mode (`RangeFlopBreakdown` + `ContextPicker` + `BoardPicker`) + Line Study's per-node decomposition.
- Promoted from implicit on 2026-04-22 (previously listed only in `postflop-drills.md` as "range-shape recognition, implicit"). Atlas-explicit now.
- Distinct from DS-48: DS-51 is hero-range-agnostic ("what does villain's range look like here?"); DS-48 is hero-anchored ("given my hand, what does villain have that I need to beat?").

---

## Domain-wide constraints

- Drill time-pressure should be off by default — this isn't mid-hand.
- Explanatory content should be surface-level by default with drill-deeper paths (Scholar > Apprentice depth curve).

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-04-22 — Added DS-48 / DS-49 / DS-50 / DS-51 (LSW-J1). DS-48 + DS-49 open new first-principles-teaching outcomes served by `bucket-ev-panel-v2`. DS-50 + DS-51 promote outcomes previously marked "implicit" in `surfaces/postflop-drills.md` to explicit atlas entries.
