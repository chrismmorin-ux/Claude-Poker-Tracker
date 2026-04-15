# Session Handoff: sr-2-design-principles

**Status:** COMPLETE — owner approved all 5 decisions 2026-04-12 | **Written:** 2026-04-12

## Amendments Applied on Approval
- **R-7.3** — explicit "stale, recomputing" label on advice panel during street transitions (no blanking).
- **R-7.1** — three-tier invariant classification adopted: `warn` / `gate` / `emergency`. Every spec invariant must carry an explicit level.

## Backlog Item
SR-2: Stage 2 — Design Principles Doctrine. Distill research into `docs/SIDEBAR_DESIGN_PRINCIPLES.md`.

## What Was Done

Drafted `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — the binding rulebook Stages 3–7 must obey. Structure:

- **§0 Purpose & binding force** — doctrine scope, enforcement at each stage
- **§1 Hierarchy rules** (R-1.1 to R-1.4) — fixed zones, max 5 primary metrics, no runtime reorder
- **§2 Lifecycle FSMs** (R-2.1 to R-2.5) — explicit statecharts, no `classList.toggle` outside transitions, `hand:new` trigger required, timers owned by FSM via `registerTimer` contract (RT-60)
- **§3 Interruption discipline** (R-3.1 to R-3.4) — 4 tiers (ambient/informational/decision-critical/emergency), active-hand = decision-critical baseline, between-hands demoted to informational
- **§4 Freshness contract** (R-4.1 to R-4.5) — `{value, timestamp, source, confidence}`; no `0`/`null` substitution; partial-payload merge (no full-replace); stale labels always visible
- **§5 Render contract** (R-5.1 to R-5.5) — single owner per DOM slot; non-owners cannot import slot refs; renderKey captures every input; class toggles on identical content prohibited
- **§6 Animation budget** (R-6.1 to R-6.4) — 200–400ms values, <300ms reorders, `prefers-reduced-motion` honored, animation on transitions only
- **§7 Invariants as gates** (R-7.1 to R-7.5) — preconditions refuse render (not log); cross-panel invariants evaluated pre-dispatch; 1-street tolerance gate **revoked**; `render-gate` vs `test-only` labeling
- **§8 BDD acceptance** (R-8.1 to R-8.4) — Given/When/Then scenarios cite corpus files; anti-scenarios become property-test oracles
- **§9 Gate-enforcement matrix** — which stage enforces which rule
- **§10 Scope exclusions** — visual design, specific state names, framework choice, non-sidebar code
- **§11 Amendment process** — owner-approved with rationale

Every rule cites at least one symptom (S1–S5) or mechanism (M1–M8) from `00-forensics.md`, or a named research source. All 8 mechanisms appear in ≥1 rule. All 5 symptoms appear in ≥1 rule.

## Key Binding Decisions (require owner attention at sign-off)

1. **Street-rank tolerance gate revoked** (R-7.3) — advice must match context street exactly. Currently `render-coordinator.js:429` permits 1-street gap; rebuild will reject it.
2. **Between-hands demoted to `informational`** (R-3.4) — cannot preempt active-hand slot. Stage 3 inventory must either relocate it to a distinct zone or mark it delete-candidate.
3. **Full-replace-on-push prohibited** (R-4.3) — `appSeatData` full-replace is a rule violation; rebuild must merge partial payloads.
4. **No raw `setTimeout` in panel modules** (R-2.5) — Stage 6 lints this. All timers go through the coordinator's `registerTimer`.
5. **Invariants refuse, not log** (R-7.1) — `StateInvariantChecker` Rule 3 pattern is replaced by a render-refusal model.

## Files Created
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` (doctrine, ~180 lines)
- `.claude/handoffs/sr-2-design-principles.md` (this file)

## Files Modified
- `.claude/BACKLOG.md` — SR-2 status NEXT → REVIEW
- `.claude/STATUS.md` — SR-2 listed as active session

## No Code Changes

Stage 2 is no-code per master plan. Zero source files touched. Zero tests run (none needed).

## Gate Status

| Requirement | Status |
|---|---|
| Doctrine covers all 8 rule families from master plan | ✅ §1–§8 |
| Every rule cites forensics (S/M) or research source | ✅ checklist in §11 |
| All 8 mechanisms referenced | ✅ |
| All 5 symptoms referenced | ✅ |
| Owner sign-off | ⏳ PENDING |

## Next Session

**If approved:** SR-3 (Stage 3 — Panel Inventory & Purpose Audit) unblocks. Screenshot-based enumeration against the SR-1 replay corpus; every visual element gets a row with purpose/when-needed/when-invalid/delete-candidate. Output: `docs/SIDEBAR_PANEL_INVENTORY.md`.

**If amendments requested:** Apply edits to `docs/SIDEBAR_DESIGN_PRINCIPLES.md`, re-submit for sign-off, then SR-3 unblocks.

## SR-2 Status: REVIEW (awaiting owner)
