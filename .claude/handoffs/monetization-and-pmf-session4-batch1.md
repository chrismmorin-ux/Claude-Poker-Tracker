# Handoff — Monetization & PMF · Session 4 Batch 1 (Gate 4 doctrine + foundation)

**Session:** 2026-04-24, Claude (main)
**Project:** `docs/projects/monetization-and-pmf.project.md`
**Phase:** Gate 4 Batch 1 (doctrine + foundation) shipped; 10 remaining Gate 4 carry-forwards unblocked
**Status:** DRAFT — awaiting owner review

---

## Files I Own (This Session)

- `docs/projects/monetization-and-pmf.project.md` — AMENDED (§Acceptance Criteria expanded inline with 10 red lines; Session Log + 6 Decisions entries)
- `docs/projects/monetization-and-pmf/WRITERS.md` — CREATED (5 writers + 5 invariants + CI-grep sketch)
- `docs/projects/monetization-and-pmf/assumption-ledger.md` — CREATED (15 falsifiable assumptions + event schema sketch)
- `docs/projects/monetization-and-pmf/entitlement-architecture.md` — CREATED (layered architecture + feature map + PaywallGate + data flows + testing strategy)
- `docs/design/heuristics/poker-live-table.md` — AMENDED (new H-SC category with H-SC01 + H-SC02)
- `.claude/BACKLOG.md` — AMENDED (6 MPMF-G4-* rows flipped COMPLETE)
- `.claude/STATUS.md` — AMENDED (top entry; prior PRF S3 entry demoted)
- `.claude/handoffs/monetization-and-pmf-session4-batch1.md` — this file

**No file conflicts** with other active streams (PRF S3 Gate 4 work uses `docs/design/surfaces/printable-refresher.md` + `docs/projects/printable-refresher/` subdir; EAL Stream E uses `src/utils/anchorLibrary/`; Shape Language uses `docs/projects/poker-shape-language/`).

---

## What this session produced

**6 artifacts shipped (doctrine + foundation batch).** Zero code.

| # | Artifact | Path | Role |
|---|---|---|---|
| 1 | ACP expansion | `monetization-and-pmf.project.md` §Acceptance Criteria | 10 commerce red lines inline; per-line refusal cross-refs; test-target pointers |
| 2 | WRITERS registry | `monetization-and-pmf/WRITERS.md` | 5 writers + 5 cross-store invariants + CI-grep enforcement |
| 3 | Heuristics H-SC | `heuristics/poker-live-table.md` | New H-SC category; H-SC01 + H-SC02; first-of-their-kind session-continuity heuristics |
| 4 | Assumption ledger | `monetization-and-pmf/assumption-ledger.md` | 15 falsifiable assumptions with kill-criteria + PostHog events |
| 5 | Entitlement architecture | `monetization-and-pmf/entitlement-architecture.md` | Main-app IDB source-of-truth + extension read-only + featureMap + PaywallGate + data flows + payment-processor selection |
| 6 | Bundle ε decision | inline in entitlement-architecture.md | Strict-superset of Pro; Q3=C deferral acknowledged |

### What doctrine-batch-first accomplishes

This mirrors EAL S3 pattern (ACP + WRITERS + S3 capture surface). Authoring doctrine first means every downstream surface spec can reference red lines by number, anti-patterns by ID, heuristics by ID, and architectural decisions by document — no surface spec re-establishes context from scratch.

**Unlocks:**
- Surface specs (MPMF-G4-S1..S6) can now reference "red line #7 — editor's-note tone" without re-defining.
- Journey specs (MPMF-G4-J1..J4) can reference specific anti-patterns (e.g., cancellation journey references MPMF-AP-05 + MPMF-AP-06 refusals).
- Assumption-ledger provides kill-criteria that each surface's Gate 5 test assertions can target.
- Entitlement architecture provides the contract surface specs need (feature names, tier ordering, PaywallGate interface).

---

## The 10 commerce red lines (now in charter §Acceptance Criteria)

1. **Opt-in enrollment for data collection** (inherits #1)
2. **Full transparency on demand** (inherits #2)
3. **Durable overrides on billing state** (inherits #3)
4. **Reversibility** (inherits #4)
5. **No streaks / shame / engagement-pressure notifications** (inherits #5)
6. **Flat-access pricing page** (inherits #6 spirit)
7. **Editor's-note tone on all commerce copy** (inherits #7)
8. **No cross-surface commerce contamination** (inherits #8)
9. **Incognito observation mode non-negotiable** (inherits #9)
10. **★ NEW — No dark-pattern cancellation** (Gate 2 + Q1=A)

Each red line maps to 1-3 MPMF-AP-* anti-pattern refusals in `anti-patterns.md` and 1-2 Gate 5 test assertions (MPMF-G5-RL / MPMF-G5-CL / MPMF-G5-SC).

---

## 15 falsifiable assumptions (for Stream D telemetry)

Named M1-M15 in `assumption-ledger.md`. Grouped:

**Behavioral / PMF (M1-M4):**
- M1 Persona clustering (Chris vs Scholar)
- M2 Post-hand replay is core JTBD
- M3 Session-scoped gate drives conversion
- M4 Pro-tier $25-35/mo WTP

**Commercial (M5-M8):**
- M5 Ignition-buyer is distinct (deferred — Phase 2+)
- M6 Doctrine is positioning wedge (A/B test)
- M7 Drills and live are same-user modes
- M8 Founding-member outreach yields ≥20 signups

**Market (M9-M12):**
- M9 Category WTP capped at $35/mo
- M10 Scholar won't pay with GTO Wizard available
- M11 Ignition $69-99/mo WTP (deferred)
- M12 Community channels vs paid ads

**Gate 4 new (M13-M15):**
- M13 First-60-sec wow is make-or-break
- M14 Returning-evaluator converts higher than first-session
- M15 Anonymous-first technically feasible (engineering review at Gate 5)

Each has kill-criterion + instrumented event + soak window. Weekly/monthly review cadence starts at Stream D Phase 4.

---

## What's unblocked after this batch

### Remaining Gate 4 (10 items NEXT)

Now the anchor (ACP) is in place:

**Surfaces (6):**
- MPMF-G4-S1 `surfaces/pricing-page.md` — most complex; tier cards + founding-member + feature comparison + FAQ
- MPMF-G4-S2 `surfaces/paywall-modal.md` — L3/L4 triggers + CTA register C5/C6 + hand-end deferral (H-SC01)
- MPMF-G4-S3 `surfaces/upgrade-prompt-inline.md` — context-aware dismissibility + H-N07 cooldown + presession suppression
- MPMF-G4-S4 `surfaces/trial-state-indicator.md` — H-SC02 binding; ≤150ms glanceable; top-right chip
- MPMF-G4-S5 `surfaces/billing-settings.md` — SettingsView grid extension; 6 actions (plan card, payment method, next-bill, update-payment, change-plan, cancel, data-export)
- MPMF-G4-S6 `surfaces/telemetry-consent-panel.md` — first-launch + settings mirror; Q8=B structural

**Journeys (4):**
- MPMF-G4-J1 `journeys/evaluator-onboarding.md` — ON-82 / ON-88 / ON-84 branching + sample-data + at-table path
- MPMF-G4-J2 `journeys/paywall-hit.md` — session-close → paywall-next-open (Q5=A pattern)
- MPMF-G4-J3 `journeys/cancellation.md` — **dark-pattern-free** critical; CI-linted forbidden-copy ladder; MPMF-AP-05/06 refusals
- MPMF-G4-J4 `journeys/plan-change.md` — SA-76 upgrade + downgrade flows; proration rules; data-preservation

**Anti-patterns expansion (1):**
- MPMF-G4-AP — expand `anti-patterns.md` as surface specs reveal new refusals (starts at 12 stub items)

### Stream D Phase 1 (PostHog install) still independently unblocked

Q8=B verdict unblocked telemetry work independent of Gate 4 progress. Event schema sketched in assumption-ledger.md. Can begin immediately.

### Stream E Phase 1 (founding-member outreach) blocked until MPMF-G4-S1 + MPMF-G4-J1

Pricing page + evaluator-onboarding journey must ship at Gate 4 before founding-member outreach can point evaluators at a real surface.

### Ignition lane still LATER

MPMF-G4-IM remains LATER per Q3=C + Q7 legal-scoping pending.

---

## Recommended next-session scope

Three reasonable batching options:

**Option A — Surface batch:**
- MPMF-G4-S1 (pricing-page) + MPMF-G4-S2 (paywall-modal) + MPMF-G4-S3 (upgrade-prompt-inline)
- Rationale: all three are user-facing commerce surfaces; shared tone + copy-discipline considerations benefit from batch authoring.

**Option B — Journey batch:**
- MPMF-G4-J3 (cancellation — dark-pattern-free, critical) + MPMF-G4-J2 (paywall-hit)
- Rationale: J3 is the highest-autonomy-stakes surface; ship it early to prevent drift.

**Option C — Foundation-remainder batch:**
- MPMF-G4-S6 (telemetry-consent-panel) + MPMF-G4-J1 (evaluator-onboarding)
- Rationale: unblocks Stream D Phase 1 (PostHog install) + Stream E Phase 1 (founding-member outreach can begin). Faster time-to-revenue path.

**Recommended: Option C** for shipping velocity. Option B is close second on autonomy-doctrine grounds (cancellation journey is the most trust-critical surface).

---

## Risk log (updates from this session)

| # | Risk | Status |
|---|---|---|
| R1–R15 | Prior risks from Sessions 1-3b | Unchanged |
| **R16 NEW** | **Gate 4 surface specs introduce anti-patterns not in the 12 MPMF-AP-*** | ACCEPTED — `anti-patterns.md` designed as stub; surface specs extend it as needed. CI-lint patterns added as they're identified. |
| **R17 NEW** | **Assumption M15 (anonymous-first feasibility) discovered infeasible at Gate 5** | ACTIVE — engineering review of Stripe Checkout anonymous-first flow required before Gate 5 code. If infeasible, redesign SA-71 surface spec OR switch payment processor. |
| **R18 NEW** | **PaywallGate component interface conflicts with existing `useGameHandlers` or context hierarchy** | ACTIVE (low) — EntitlementContext designed additively; provider hierarchy positions it near AppRoot where it doesn't disrupt existing contexts. Gate 5 integration test covers. |

---

## Ratification checklist (for owner)

Before next Gate 4 session begins, owner should:

- [ ] Review ACP expansion in charter §Acceptance Criteria (the 10 red lines inline enumeration)
- [ ] Review entitlement-architecture.md Bundle ε + extension read-only decisions
- [ ] Review assumption-ledger M13–M15 (new at Gate 4) — particularly M15 anonymous-first-feasibility
- [ ] Pick next-session batch (A surface / B journey / C foundation-remainder) — recommend C for velocity

---

## Change log

- 2026-04-24 — Session 4 Batch 1. 6 Gate 4 carry-forwards shipped (ACP + W + HT + AL + EA + ES). Mirrors EAL S3 doctrine-first precedent. 10 remaining Gate 4 items unblocked; MPMF-G4-IM stays LATER per Q3=C. Stream D Phase 1 still unblocked independently. Stream E Phase 1 blocked on MPMF-G4-S1 + J1. Zero code. Zero test regressions.
