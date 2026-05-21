# SPR-079 — Ready-to-Start Triage Report

**Date:** 2026-05-14
**Sprint:** SPR-079 (Refactor Sprint Item 6)
**Charter:** `.claude/projects/refactor-sprint-2026-05-10.md` Item 6 — Triage ready-to-start queue
**Predecessor:** SPR-071 (broader queue reconciliation sweep — retitled 13 ready-to-start items to range-lab/played-hand-review-protocol on 2026-05-11)

---

## Scope

13 backlog items whose `category: "ready-to-start"` survived SPR-071's broader sweep. Each walked, dispositioned, and either reassigned to a real program category or promoted into the active queue.

| WS | Title | Disposition | New category | New program | Priority change |
|----|-------|-------------|--------------|-------------|-----------------|
| WS-058 | Range Lab Phase 3 (AI-native differentiators) | LEGITIMATE-BACKLOG | `range-lab` | `engineering` | unchanged (P=8) |
| WS-059 | Range Lab Phase 4 (HH paste → range evolution) | LEGITIMATE-BACKLOG | `range-lab` | `engineering` | unchanged (P=8) |
| WS-060 | Range Lab Phase 5 (custom ranges + cross-links) | LEGITIMATE-BACKLOG | `range-lab` | `engineering` | unchanged (P=8) |
| WS-062 | Pilot refits to v2.2 (sidebar v2 full pass) | LEGITIMATE-BACKLOG | `sidebar-program` | `engineering` | unchanged (P=8) |
| WS-063 | Pre-Session Drill Gate 2 (Blind-Spot Roundtable) | **PROMOTED** | `pre-session-drill` | `design` | **P=8 → P=15 (P3 → P2)** |
| WS-064 | Pre-Session Drill Gate 3 (Research) | LEGITIMATE-BACKLOG | `pre-session-drill` | `design` | unchanged (P=8) |
| WS-065 | Pre-Session Drill Gate 4 (Design) | LEGITIMATE-BACKLOG | `pre-session-drill` | `design` | unchanged (P=8) |
| WS-066 | LSW soft-flag tightening | **PROMOTED** | `lsw-v2` | `engineering` | **P=8 → P=15 (P3 → P2)** |
| WS-081 | DCOMP-W4-A3-F12 online persona + JTBD patches | LEGITIMATE-BACKLOG | `design-comprehension` | `design` | unchanged (P=8) |
| WS-082 | DCOMP-W4-A3-F13 MT-62 offline-fallback verify | LEGITIMATE-BACKLOG | `design-comprehension` | `design` | unchanged (P=8) |
| WS-083 | DCOMP-W3 drills audit + WIP tab decision | LEGITIMATE-BACKLOG | `design-comprehension` | `design` | unchanged (P=8) |
| WS-084 | DCOMP-W5 sidebar framework integration | LEGITIMATE-BACKLOG | `design-comprehension` | `design` | unchanged (P=8) |
| WS-085 | DCOMP-H2 quarterly PROTO validation | LEGITIMATE-BACKLOG | `design-comprehension` | `design` | unchanged (P=8) |

**Net disposition counts:**
- SHIPPED-elsewhere: 0
- SUPERSEDED: 0
- LEGITIMATE-BACKLOG (recategorized): 11
- **PROMOTED**: 2 (WS-063 + WS-066)
- NEEDS-RESCOPE: 0
- PAUSED-INDEFINITELY: 0

---

## Per-item rationale

### Range Lab phase chain — WS-058, WS-059, WS-060

Range Lab Phases 3, 4, 5 are stretch phases downstream of Phase 1 (WS-056) + Phase 2 (WS-057). Both WS-056 and WS-057 are already on `category: "range-lab"` after SPR-071 retitled them. WS-058/059/060 missed that pass.

**Action:** category retitled from `ready-to-start` to `range-lab`. status_note refreshed with 2026-05-14 stamp. P=8 P3 unchanged (consistent with the rest of the Range Lab chain pending owner reactivation of the Range Lab project).

**Justification for non-promotion:** Range Lab is paused; charter ratification #4 of Refactor Sprint kept new features paused until Item 4 shipped (now lifted 2026-05-14). Range Lab reactivation is owner-decision territory, not triage authority.

### Pilot refits to v2.2 — WS-062

Sidebar program follow-up. Owner approved "documentation-only fix, no re-audits" per status_note. LSW A5-A8 (shipped 2026-04-23) now codify A-with-nuance / A-with-stake-caveat forward; retroactive tightening of A1 + pilot upper-surface artifacts still pending.

**Action:** category retitled to `sidebar-program`. P=8 P3 unchanged (documentation-only sweep; not gating).

### Pre-Session Drill (PSD) Gates 2/3/4 — WS-063, WS-064, WS-065

PSD Gate 1 was "Corpus scaling" (WS-061 = US-1), which SPR-071 already closed as SHIPPED-elsewhere (15 reasoning artifacts + ~50 companion files at `docs/upper-surface/`). The corpus prereq is met.

**WS-063 (Gate 2 — Blind-Spot Roundtable)** is the natural next concrete action for SCF / Pre-Session Drill program. Per audit `docs/design/audits/2026-04-23-entry-pre-session-drill.md`, the corpus threshold has been reached and Gate 2 is actionable: 5-stage roundtable producing GREEN/YELLOW/RED verdict + addressing 6 open owner questions from Gate 1.

**Action:** **PROMOTED P=8 → P=15 (P3 → P2)**. `blocked_by_legacy: ["US-1"]` cleared (WS-061 done). Program reassigned engineering → design (Gate work is design-framework lifecycle, per `docs/design/LIFECYCLE.md`). Category retitled to `pre-session-drill`.

**WS-064 (Gate 3 — Research)** and **WS-065 (Gate 4 — Design)** remain blocked by upstream gates (WS-063, then WS-064). Same recategorize + program reassignment treatment; P=8 unchanged (gate-sequencing).

### LSW soft-flag tightening — WS-066

Documentation-only fix. Two soft flags surfaced at LSW Stage 4 (flop equity-vs-subset distinction; river stake-caveat for "25-35% bluffs") that should be retroactively applied to A1 + the pilot upper-surface artifacts. LSW A5-A8 (shipped 2026-04-23) already codify the discipline forward via inline `A-with-nuance` / `A-with-stake-caveat` categorization.

**Action:** **PROMOTED P=8 → P=15 (P3 → P2)**. Small surgical fix; cheap to ship; LSW v2 follow-up. Category retitled to `lsw-v2`.

### Design Comprehension (DCOMP) items — WS-081, WS-082, WS-083, WS-084, WS-085

5 items from the `DCOMP-*` legacy_id namespace. All design-program work (persona/JTBD audits + drill-tab decisions + sidebar framework integration + quarterly hygiene).

**Action:** category retitled to `design-comprehension`. Program reassigned engineering → design. status_note refreshed (where present).

**Notable details:**
- WS-084 (DCOMP-W5, sidebar framework Wave 5) remains BLOCKED by Wave 4 (WS-081/082 + other W4 work). status_note updated to explicit pointer.
- WS-085 (DCOMP-H2, quarterly PROTO validation) has explicit schedule `2026-07-21`. Cadence preserved; status_note retained.

**Justification for non-promotion:** all 5 items are estimated M effort; none has a current forcing function. They join the regular design-program queue at P=8 P3.

---

## What this changes for `/next` ranking

**Net /next P≥15 candidates** (post-triage):
- Already at P≥15 (pre-sweep): WS-027/030/031/032/033/036 (P=22 soft-blocked → 5.5), WS-191 (P=20 soft-blocked → 5), WS-188 (P=18), WS-164 (P=18 soft-blocked → 4.5), WS-150 (P=14), WS-155 (P=13), WS-067 (P=15), WS-087 (P=15)…
- **New entries from this sweep:** WS-063 (P=15 P2, pre-session-drill, design) + WS-066 (P=15 P2, lsw-v2, engineering).

The 2 promoted items both have natural single-sprint scope:
- **WS-063** — 5-stage Blind-Spot Roundtable, ~1-2 sessions design work.
- **WS-066** — Documentation-only soft-flag tightening, ~0.5-1 session.

Neither has a soft-block. Both should be eligible to anchor a future sprint.

---

## Zero src/ diff

This triage produced only:
- 13 `.claude/workstream/queue/WS-NNN.yaml` edits (in-place metadata refresh)
- 13 corresponding `.claude/workstream/queue-index.yaml` summary-row edits
- 1 sweep report (this file)
- 1 sprint file + 1 sprint-index row (SPR-079 itself)

No production code, no tests, no architectural artifacts touched.

---

## Cross-program rotation context

Last 3 sprints all founder-driven and engineering/project-direct:
- SPR-077 (2026-05-14) — Domain Correctness (WS-189 Phase 1 telemetry)
- SPR-078 (2026-05-14) — Engineering (Refactor Sprint Item 4 — decision-system extraction)
- SPR-079 (2026-05-14) — Engineering (Refactor Sprint Item 6 — queue triage, this sprint)

3 in a row with engineering anchor (SPR-078 + SPR-079) is acceptable — both are Refactor-Sprint scope close-out. Next sprint should rotate (design, domain-correctness, or feature work resumes).

---

## Refactor Sprint scope after this close-out

- ✅ Item 1 — SYSTEM_MODEL.md restore (2026-05-10)
- ✅ Item 2 — state.md reshape (2026-05-10)
- ✅ Item 3 — Persistence migration registry (2026-05-11)
- ✅ Item 4 — Decision-system extraction (2026-05-14, SPR-078)
- ⬜ Item 5 — useLiveActionAdvisor split (M, surgical; PMC Phase 5b enabler)
- ✅ **Item 6 — Queue triage (2026-05-14, SPR-079, this sprint)**
- ⬜ Item 7 — Persistence + cache audit (WS-188, L; Phase 1+3 parallel-safe; Phase 2+4 unblocked now that Item 4 shipped)

**Refactor Sprint completion:** 5 of 7 items done. Items 5 + 7 remain. Charter ratification #4 ("no new features until Item 4 complete") was technically lifted at SPR-078; Items 5 + 7 are owner-discretion on sequencing now.
