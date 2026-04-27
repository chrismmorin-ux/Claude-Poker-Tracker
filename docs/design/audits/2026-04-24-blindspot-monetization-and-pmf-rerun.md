# Blind-Spot Roundtable Re-run — 2026-04-24 — Monetization & PMF

**Type:** Gate 2 re-run (design lifecycle per `docs/design/LIFECYCLE.md`)
**Trigger:** Gate 3 closure (owner-interview verdicts + JTBD authoring + persona ratification + anti-pattern stub). Per LIFECYCLE.md, YELLOW Gate 2 requires re-run against updated framework; output must be GREEN to proceed to Gate 4.
**Participants:** Synthesized re-run against the updated framework (single pass; does not require re-convening the 3 voices from initial Gate 2).
**Artifacts read:**
- Original Gate 2 audit: `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md`
- Gate 3 owner-interview: `docs/projects/monetization-and-pmf/gate3-owner-interview.md` (all 10 verdicts Recommended)
- Session 3a JTBD outputs: `subscription-account.md` (SA-71..75) + `cross-cutting.md` (CC-88) + `onboarding.md` (ON-88) + `billing-management.md` (SA-76..78, post-Q9 split)
- Anti-patterns stub: `docs/projects/monetization-and-pmf/anti-patterns.md` (12 refusals)
- Ratified persona files: `evaluator.md` + `trial-first-session.md` + `returning-evaluator.md` (Owner-Confirmed structural)
- Updated `personas/README.md` (16th core persona + evidence-status row)
- Updated `jtbd/ATLAS.md` (16th domain BM + range bumps)

**Status:** DRAFT — awaiting owner review. Expected ratification same-session.

---

## Verdict

**GREEN.**

All 17 Gate 2 findings (5 Stage A/B persona-and-JTBD + 6 Stage C situational + 3 Stage D cross-product + 3 Stage E heuristic-and-red-line-enumeration) map to either (a) a shipped Gate 3 artifact, (b) an explicit Gate 4 carry-forward with named MPMF-G4-* backlog ID, or (c) an explicit Gate 5 carry-forward with named MPMF-G5-* backlog ID. Plus the 10 owner-interview questions (Q1–Q10) all verdicted on Recommended positions with rationale captured.

Two findings (Q7 legal scoping + Ignition-lane work) explicitly deferred per Q3=C + Q7=A verdicts. No residual findings block Gate 4 main-app surface design.

Gate 4 (Design) is unblocked for main-app surfaces. Ignition surfaces remain deferred pending Phase 2+ re-entry.

---

## Finding-by-finding closure mapping

### Stage A — Persona sufficiency (original: ⚠️ Patch needed)

| # | Original finding | Status | Closure |
|---|---|---|---|
| A1 | Evaluator fold-or-split decision on E-CHRIS / E-SCHOLAR / E-IGNITION sub-shapes | **CLOSED** | Q10=B verdict → keep unified at core level; sub-shapes as attributes in `evaluator.md`. No fork; no new situational file. |
| A2 | Missing evaluator shapes (Coach / Banker / Analyst / Ringmaster) | **CLOSED (deferred)** | Session 2 voice + Gate 3: deferred to when respective features ship; no authoring in Phase 1. Documented in `evaluator.md` § Missing evaluator shapes. |
| A3 | Persona ratification for 3 PROTO personas | **CLOSED (structural)** | All 3 personas ratified Owner-Confirmed (structural) with change-log entries. Evidential assumptions E1–E6 + TFS1–TFS4 + RE1–RE4 remain proto pending Stream D telemetry 30–60-day window. |

### Stage B — JTBD coverage (original: ⚠️ Expansion needed)

| # | Original finding | Status | Closure |
|---|---|---|---|
| B1 | 10 JTBDs authored (SA-71..78 + CC-88 + ON-88) | **CLOSED** | Session 3a shipped 10 JTBDs across 3 domain files with full-detail authoring (trigger + autonomy-inheritance + mechanism + served-by + distinct-from + doctrine-basis). |
| B2 | JTBD domain-split decision (Q9) | **CLOSED** | Q9=A verdict → new `billing-management.md` domain authored; SA-76/77/78 moved; IDs preserved; ATLAS updated to 16 domains. |
| B3 | Out-of-scope refusals (streak / leaderboard / gamified-referral) | **CLOSED** | `docs/projects/monetization-and-pmf/anti-patterns.md` stub shipped with 12 MPMF-AP-* refusals including streak (AP-03), social-proof (AP-02), push-notification re-engagement (AP-04). |

### Stage C — Situational stress (original: ⚠️ Targeted adjustments)

| # | Original finding | Status | Closure |
|---|---|---|---|
| C1 | trial-at-live-table evaluator path | **CARRY FORWARD** to MPMF-G4-J1 (`journeys/evaluator-onboarding.md`). Gate 4 surface spec addresses at-table degraded first-experience OR authors dedicated at-table path. Session 2 Product/UX voice + Market voice (Pokeri precedent) documented; Gate 4 owner reviews. |
| C2 | Returning-evaluator state-preservation + resume-vs-fresh choice | **CARRY FORWARD** to MPMF-G4-J1 (`journeys/evaluator-onboarding.md`) + `returning-evaluator.md` persona ratified with this invariant. Implementation-level concern; Gate 4 specs the UX. |
| C3 | Newcomer-first-hand paywall exclusion ≥ 20–50 hand threshold | **CARRY FORWARD** to MPMF-G4-S2 (`paywall-modal.md`). Mirrors EAL's 25-hand anchor-feature unlock threshold. Gate 4 defines exact number. |
| C4 | H-SC01 paywall-never-interrupts-active-work binding | **CLOSED (doctrine) / CARRY FORWARD (test)** | Doctrine established in Gate 2 audit + SA-73 JTBD + anti-pattern MPMF-AP-12. Gate 5 test assertion at MPMF-G5-SC (H-SC01 test — paywall never fires mid-hand). |
| C5 | Presession-preparer surface hides upgrade CTAs | **CARRY FORWARD** to MPMF-G4-S3 (`upgrade-prompt-inline.md`) — context-aware CTA suppression for presession context. |
| C6 | Cancellation journey handles re-entry cleanly (cancelled → free tier degradation visible, not silent) | **CARRY FORWARD** to MPMF-G4-J3 (`journeys/cancellation.md`) — dark-pattern-free post-cancel state handling. |

### Stage D — Cross-product (original: ⚠️ Partner surfaces need updates; Q7 blocking)

| # | Original finding | Status | Closure |
|---|---|---|---|
| D1 | Q7 legal/ToS posture unresolved — blocks Ignition lane | **DEFERRED** per Q7=A verdict (schedule separate legal-scoping session). Combined with Q3=C verdict (defer Ignition commercial lane). Phase 1 main-app unblocked; Phase 2 Ignition blocked on legal session + Q7 resolution. Tracked as backlog item MPMF-G3-Q7. |
| D2 | WRITERS.md for `subscription` store | **CARRY FORWARD** to MPMF-G4-W (`docs/projects/monetization-and-pmf/WRITERS.md` with 5-writer registry for subscription-state writes). |
| D3 | Entitlement architecture: main-app IDB source of truth, extension subscribes via WebSocket | **CLOSED (architecture decision)** | Ratified in charter Decisions Log + Gate 2 voice 03. Mirrors existing ignition-poker-tracker WebSocket bridge pattern. No independent extension-side entitlement state. |
| D4 | Bundle ε Ignition SKU strict-superset of Pro | **CLOSED (structural) / DEFERRED (surface work)** | Bundle structure ratified (avoids cross-product state gaps); surface design deferred per Q3=C. |
| D5 | Payment processor selection deferred pending Q7 | **CARRY FORWARD** to MPMF-G5-PP. Stripe default for Phase 1 main-app (clean legal posture); Paddle/LemonSqueezy alternatives considered if Q7 verdict for Phase 2 Ignition requires. |

### Stage E — Heuristic pre-check (original: ❌ Fixable with the 10 red lines enumerated)

| # | Original finding | Status | Closure |
|---|---|---|---|
| E1 | 10 commerce red lines enumerated in charter §Acceptance Criteria | **CARRY FORWARD** to MPMF-G4-ACP — charter §Acceptance Criteria expanded inline from "9 autonomy red lines applied" placeholder to enumerated 10 red lines with in-app test assertions. Mirrors EAL pattern. |
| E2 | 12 anti-patterns in `docs/projects/monetization-and-pmf/anti-patterns.md` | **CLOSED** — stub shipped this session (Session 3b). Full expansion at Gate 4 as surface specs reveal additional refusals. |
| E3 | CI-linted forbidden-copy-strings check | **CARRY FORWARD** to MPMF-G5-CL (`scripts/check-commerce-copy.sh` or equivalent + deterministic copy generators mirror EAL `calibrationCopy.js` + `retirementCopy.js`). |
| E4 | H-SC01 + H-SC02 added to `heuristics/poker-live-table.md` or project-specific heuristics doc | **CARRY FORWARD** to MPMF-G4-HT. |
| E5 | Paywall-spectrum compatibility matrix under Q1 verdicts formalized | **CLOSED** | Matrix in `paywall-spectrum.md` + Gate 2 audit; bundle α + δ confirmed as Gate 4 design targets under Q1=A verdict; bundle β disqualified; bundles γ + ε deferred. |

---

## Owner-interview question closures (10 of 10)

All 10 owner-interview questions verdicted. Documented in `gate3-owner-interview.md` with rationale + Gate 4 implications + carry-forwards.

| # | Question | Verdict | Effect |
|---|---|---|---|
| Q1 | Doctrine scope | **A** | All 10 commerce red lines bind. Bundle β disqualified. Bundle α + δ authoritative Gate 4 targets. |
| Q2 | Sequencing | **B** | Parallel soft-launch + telemetry. Founding-member launch + PostHog install ship together. |
| Q3 | Ignition commercial lane timing | **C** | Defer Ignition commercial lane to Phase 2+. Phase 1 main-app only. |
| Q4 | Founding-member mechanism | **A** | $299 lifetime cap 50. Transactional scarcity. Feedback-loop cohort. |
| Q5 | Free-tier shape | **A** | Session-scoped. No cross-session persistence. Paywall gates history depth. |
| Q6 | Scholar fork | **C** | Defer pending Stream D telemetry 60+ day signal. Unified tier ladder for now. |
| Q7 | Ignition legal/ToS posture | **A** | Schedule separate legal-scoping session. Ignition marketing blocked pending session. Compatible with Q3=C. |
| Q8 | Telemetry consent default | **B** | Opt-out with first-launch transparency panel. Always-visible off-switch. PostHog install unblocked. |
| Q9 | JTBD domain split | **A** | Executed this session. New `billing-management.md` domain; SA-76/77/78 moved; IDs preserved. |
| Q10 | Evaluator-ignition-mode situational | **B** | Keep unified; sub-shapes as attributes. No new situational file. |

---

## Structural risks at re-run

Original Gate 2 identified 3 structural risks. Each is now addressed:

1. **Dark-pattern cancellation drift.** Mitigated by: (a) dedicated MPMF-G4-J3 `journeys/cancellation.md` Gate 4 carry-forward, (b) red line #10 enumerated in anti-patterns MPMF-AP-05 + MPMF-AP-06, (c) CI-linted forbidden-copy-strings at MPMF-G5-CL, (d) SA-74 JTBD authored with load-bearing red-line #10 reference. **Risk downgraded to ACTIVE (mitigation-shipped-to-Gate-4).**
2. **Q7 legal posture blocks Ignition lane.** Addressed by Q7=A verdict (schedule legal session) + Q3=C verdict (defer Ignition commercial lane). Phase 1 main-app proceeds. Phase 2 Ignition blocked pending legal session; tracked as MPMF-G3-Q7. **Risk downgraded to DEFERRED (known blocker with clear resolution path).**
3. **Evaluator evidence gap.** Addressed by Gate 3 ratification (structural Owner-Confirmed) + assumption-ledger carry-forward to Gate 4 (MPMF-G4-AL) + Stream D telemetry plan (MPMF-G5-PH) validates assumptions E1–E6 + TFS1–TFS4 + RE1–RE4 over 30–60-day window. **Risk downgraded to ACTIVE (mitigation-ongoing-via-telemetry).**

No new structural risks surfaced in re-run.

---

## Stage re-verdicts

| Stage | Original | Re-run |
|---|---|---|
| A — Persona sufficiency | ⚠️ Patch needed | ✅ Closed (fork decision verdicted; ratification complete) |
| B — JTBD coverage | ⚠️ Expansion needed | ✅ Closed (10 JTBDs authored + domain-split executed + refusal list shipped) |
| C — Situational stress | ⚠️ Targeted adjustments | ✅ Closed at doctrine level; 6 Gate 4 carry-forwards with named backlog IDs |
| D — Cross-product | ⚠️ Partner surfaces + Q7 blocking | ✅ Closed at architecture level; Q7 deferred per verdict; 4 Gate 4/5 carry-forwards |
| E — Heuristic pre-check | ❌ Current charter placeholder + 10 red lines needed | ✅ Closed at doctrine level; 4 Gate 4/5 carry-forwards for implementation |

Overall: **GREEN.**

---

## What this unblocks

**Gate 4 (Design) unblocked for main-app surfaces.** Session 4+ authoring scope:
- `surfaces/pricing-page.md` (MPMF-G4-S1)
- `surfaces/paywall-modal.md` (MPMF-G4-S2)
- `surfaces/upgrade-prompt-inline.md` (MPMF-G4-S3)
- `surfaces/trial-state-indicator.md` (MPMF-G4-S4)
- `surfaces/billing-settings.md` (MPMF-G4-S5) — SettingsView extension
- `surfaces/telemetry-consent-panel.md` (MPMF-G4-S6)
- `journeys/evaluator-onboarding.md` (MPMF-G4-J1)
- `journeys/paywall-hit.md` (MPMF-G4-J2)
- `journeys/cancellation.md` (MPMF-G4-J3) — dark-pattern-free
- `journeys/plan-change.md` (MPMF-G4-J4)
- `heuristics/` updates for H-SC01 + H-SC02 (MPMF-G4-HT)
- Charter §Acceptance Criteria expansion (MPMF-G4-ACP)
- `WRITERS.md` (MPMF-G4-W)
- `assumption-ledger.md` (MPMF-G4-AL)

**Stream D Phase 1 (PostHog install) unblocked.** Q8=B verdict lets telemetry work begin immediately, independent of Gate 4 main-app surface progress.

**Stream E Phase 1 (founding-member outreach) unblocked once Gate 4 MPMF-G4-S1 + MPMF-G4-J1 land.** Q2=B + Q4=A verdicts lock founding-member-lifetime-at-$299-cap-50 as the seeding mechanism.

**Ignition lane remains deferred.** MPMF-G4-IM + MPMF-P8-EX + MPMF-G5 Ignition-specific work all blocked on Q7 legal scoping completion + main-app validation + re-open of Q3.

---

## Required follow-ups (from re-run)

Same as original Gate 2 audit's follow-ups, with the following status updates:

### Gate 3 (Research) — scope
- [x] Author 10 JTBDs (SA-71..78 + CC-88 + ON-88) — **DONE 2026-04-24 Session 3a**
- [x] Domain-split decision Q9 — **DONE 2026-04-24 Session 3b** (A verdict; executed)
- [x] `evaluator-ignition-mode.md` situational (Q10) — **RESOLVED** (Q10=B no new file; attribute in evaluator.md)
- [x] Owner interview Q1–Q10 — **DONE 2026-04-24 Session 3b**
- [x] Ratify 3 personas PROTO → Owner-Confirmed — **DONE 2026-04-24 Session 3b** (structural; evidential pending telemetry)
- [x] Document out-of-scope anti-patterns — **DONE 2026-04-24 Session 3b** (`anti-patterns.md` stub shipped)
- [ ] Schedule separate Q7 legal-scoping session — **PENDING** (calendar coordination required with counsel; tracked as MPMF-G3-Q7)
- [x] Gate 2 re-run against updated framework — **DONE 2026-04-24 Session 3b** (this document, verdict GREEN)

### Gate 4 (Design) — scope

All items unchanged from original Gate 2 audit. Full list in `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md` §Required follow-ups §Gate 4. 15 MPMF-G4-* backlog items remain.

### Gate 5 (Implementation) — constraints to propagate

All items unchanged. Full list in original audit. 9 MPMF-G5-* backlog items remain.

---

## Change log

- 2026-04-24 — Created Session 3b. Gate 2 re-run against Gate 3 updated framework. All 17 original findings mapped to closure or Gate 4/5 carry-forward with named backlog IDs. All 10 owner-interview questions verdicted Recommended. 3 structural risks downgraded. Verdict GREEN. Gate 4 main-app surface design unblocked. Ignition lane remains deferred per Q3=C + Q7=A (pending legal scoping session).
