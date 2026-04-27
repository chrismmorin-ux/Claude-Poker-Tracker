# Handoff — Monetization & PMF · Session 3a (Gate 3 Mode B — JTBD authoring, Claude-solo)

**Session:** 2026-04-24, Claude (main)
**Project:** `docs/projects/monetization-and-pmf.project.md`
**Phase:** Gate 3 Mode B (JTBD authoring) shipped; Modes A (owner interview) + C (persona ratification) + D (Gate 2 re-run) pending Session 3b
**Status:** DRAFT — 10 JTBDs shipped; remaining Gate 3 scope requires owner-attended session

---

## Files I Own (This Session)

- `docs/design/jtbd/domains/subscription-account.md` — AMENDED (added SA-71..78; updated intro, primary personas, domain-wide constraints, change-log)
- `docs/design/jtbd/domains/cross-cutting.md` — AMENDED (added CC-88; updated change-log)
- `docs/design/jtbd/domains/onboarding.md` — AMENDED (added ON-88; updated change-log)
- `docs/design/jtbd/ATLAS.md` — AMENDED (domain-index row ranges; 10 new table rows across 3 sections; section headers; change-log)
- `docs/projects/monetization-and-pmf.project.md` — AMENDED (Session Log row + 4 Decisions entries)
- `.claude/BACKLOG.md` — AMENDED (10 MPMF-G3-J* rows flipped COMPLETE)
- `.claude/STATUS.md` — AMENDED (top entry; prior PRF entry demoted)
- `.claude/handoffs/monetization-and-pmf-session3a.md` — this file

**No file conflicts** with other active streams. MPMF operates in its own namespace (docs/projects/monetization-and-pmf/) + additive edits to ATLAS and shared JTBD domain files. PRF and EAL didn't touch these files during their parallel sessions.

---

## What this session produced

**10 JTBDs + 4 file amendments + handoff.** Zero code. Zero test regressions.

| # | JTBD | File | Pattern inherited |
|---|---|---|---|
| 1 | SA-71 try-before-paying | subscription-account.md | Red line #1 (opt-in enrollment) |
| 2 | SA-72 understand-free-vs-paid | subscription-account.md | Red line #7 + H-SC02 new heuristic |
| 3 | SA-73 hit-paywall-with-dignity | subscription-account.md | Red lines #5, #7, #8 + H-SC01 + H-N07 |
| 4 | SA-74 cancel-without-friction | subscription-account.md | Red line #10 (new in Gate 2 audit) |
| 5 | SA-75 evaluate-sidebar-separately | subscription-account.md | Red line #8 + Q3 + Q7 gating |
| 6 | SA-76 switch-between-plan-tiers | subscription-account.md | Red lines #2, #3, #4 |
| 7 | SA-77 manage-payment-method | subscription-account.md | Red line #2 |
| 8 | SA-78 know-when-ill-be-billed | subscription-account.md | Red line #2 + MPMF-AP-11 refusal |
| 9 | CC-88 honest-telemetry-transparency | cross-cutting.md | Red line #9 (cross-project pattern) |
| 10 | ON-88 expert-bypass-for-evaluators | onboarding.md | Distinct from ON-84 + ON-87 |

### Quality level

Each JTBD authored at full-detail level matching EAL's DS-57..59 and PRF's CC-82/83 exemplars:
- Trigger-situation "When…" framing
- State: Active (pending MPMF Gate 4)
- Primary personas named
- Autonomy-constraint inheritance lines citing specific red lines
- Mechanism description
- Served-by-surface list (Gate 4 carry-forwards)
- Distinct-from-siblings paragraph (3–5 siblings each)
- Doctrine-basis line citing Gate 2 audit + charter

### ATLAS.md changes

- Domain-index rows: SA 64..70 → 64..78; CC adds 88; ON 82..87 → 82..88
- Section headers bumped to match
- 10 new JTBD rows added to respective tables
- Change-log entry describing scope + Q9 deferral + cross-project pattern note for CC-88

---

## Why Session 3 was split into 3a + 3b

Per the plan at `C:\Users\chris\.claude\plans\misty-swimming-rabbit.md`, Session 3 has 4 modes:

- **Mode A** — Owner interview (Q1–Q10) — owner-attended
- **Mode B** — JTBD authoring (10 JTBDs) — Claude-solo
- **Mode C** — Persona ratification (3 PROTO → Owner-Confirmed) — owner touch
- **Mode D** — Gate 2 re-run (conditional on updated framework) — Claude-solo post-C

The plan explicitly allowed splitting: "If the owner cannot do Mode A in the same sitting as authoring work, split." The owner said "continue" without providing interview answers, so I executed Mode B alone. Modes A + C + D remain for Session 3b.

---

## Session 3b scope (remaining Gate 3 work)

### Mode A — Owner interview

10 questions documented in `docs/projects/monetization-and-pmf.project.md` §Gate 3 + expanded in Gate 2 audit. Recommended sequence (lowest-branching → highest):

1. **Q8** (telemetry consent default) — unblocks Stream D regardless of Q1
2. **Q7** (legal/ToS posture for Ignition grey-market) — blocking for Ignition lane; may need separate legal-scoping session
3. **Q1** (doctrine scope) — **pivotal; compresses paywall option space from 40 to one bundle**
4. **Q5** (free-tier shape) — downstream of Q1
5. **Q2** (sequencing — telemetry-first vs parallel)
6. **Q4** (founding-member mechanism — conditional on Q2)
7. **Q3** (Ignition timing)
8. **Q6** (Scholar fork)
9. **Q9** (JTBD domain-split — keep single subscription-account.md or split SA-76..78 to billing-management.md)
10. **Q10** (evaluator-ignition-mode situational — author or keep as attribute of unified Evaluator)

Each verdict documented in `gate3-owner-interview.md` with rationale + Gate 4 implications + carry-forwards, mirroring EAL `exploit-anchor-library/gate3-owner-interview.md` pattern.

### Mode C — Persona ratification

3 PROTO personas need owner review + ratification:

- `docs/design/personas/core/evaluator.md` — validate sub-shape framing (E-CHRIS / E-SCHOLAR / E-IGNITION kept as attributes of unified core, not forked)
- `docs/design/personas/situational/trial-first-session.md` — validate 5–15 min window + 60-second wow threshold + off-table default assumption
- `docs/design/personas/situational/returning-evaluator.md` — validate 2+ day drift threshold + resume-vs-start-fresh re-entry pattern

Expected outcome: **Owner-Confirmed (structural), assumption-tracked (evidential).** Full Verified status requires Stream D telemetry 30–60-day window to kill-or-keep assumptions E1–E6 + TFS1–TFS4 + RE1–RE4.

Change-log updates in each persona file; `docs/design/personas/README.md` gains index entries for the 3 new personas (README update deferred in Session 1 to batch at ratification).

### Mode D — Gate 2 re-run (conditional)

If Mode A + Mode B + Mode C outputs update the framework sufficiently, re-run Gate 2 five stages against the updated framework. Expected verdict **GREEN** assuming:
- Q1 verdict lands on A or B (Q1=C would likely trigger Autonomy voice RED per Gate 2 voice 02)
- 10 JTBDs authored (✓ done this session)
- Personas ratified
- 12 anti-patterns acknowledged as refusal list for Gate 4

Mirror EAL re-run audit format: `docs/design/audits/YYYY-MM-DD-blindspot-monetization-and-pmf-rerun.md` with finding-by-finding closure mapping.

### Optional — evaluator-ignition-mode situational

If Q10 verdicts "author separate situational," write `docs/design/personas/situational/evaluator-ignition-mode.md` capturing:
- Chrome-extension first-run surface
- Online-session trial context (vs main-app's off-table assumption)
- E-IGNITION WTP + competitive benchmark (Hand2Note $49–59/mo ceiling)
- Pricing bundle ε specifics

If Q10 verdicts "keep as attribute," document the sub-shape explicitly in Gate 4 `journeys/evaluator-onboarding.md` first-run branching instead.

---

## Doctrine + architecture carry-forwards to Gate 4

From the JTBDs authored this session, Gate 4 surface specs will need to enforce:

1. **Cancellation is ≤2 taps from billing settings** (SA-74) — dedicated `journeys/cancellation.md` with CI-linted forbidden-copy ladder
2. **Trial-state indicator ≤2 taps + ≤150ms glanceable** (SA-72) — `surfaces/trial-state-indicator.md`
3. **Paywall never interrupts active work** (SA-73 + H-SC01) — `surfaces/paywall-modal.md` with hand-end-deferral mechanism
4. **Pricing page shows plan cards + compare table + FAQ** (SA-65 + SA-71 + SA-72) — `surfaces/pricing-page.md`
5. **Billing settings panel in SettingsView** (SA-66 + SA-74 + SA-76 + SA-77 + SA-78) — 6-action panel
6. **Payment method update does NOT trigger retention flow** (SA-77) — explicit negative requirement in `surfaces/billing-settings.md`
7. **Plan change is distinct journey from cancellation** (SA-76 vs SA-74) — two journeys, not one
8. **Renewal advance-visibility passive surfacing** (SA-78 + CC-88 pattern) — 3-day-ahead in-app informational banner; no push notifications
9. **Telemetry consent panel first-launch + always-visible off-switch** (CC-88) — `surfaces/telemetry-consent-panel.md`
10. **ON-88 fast-orientation overlay ≤60s** (first-run) — journey branch in `journeys/evaluator-onboarding.md`

---

## What next-session Claude needs to know

**Starting context if Session 3b is owner-attended:**
- Read this handoff + charter + Gate 2 audit
- Prep with recommended starting positions for Q1–Q10 (documented in charter + audit)
- Expect Q7 to require separate scheduling (legal scoping is not a 30-min answer)

**Starting context if Session 3b+ is Claude-solo on Gate 2 re-run only:**
- Wait for owner verdicts on Q1–Q10 before re-running (the re-run needs to assess against verdicts)
- Don't ratify personas without owner touch

**Starting context for Gate 4:**
- Q1 verdict MUST be resolved before any surface spec starts (paywall-spectrum bundle selection depends on it)
- Q7 verdict MUST be resolved before Ignition-related surface spec starts (legal posture dictates copy, marketing, payment processor)
- Q5 verdict drives `surfaces/pricing-page.md` tier specifications
- Q9 verdict drives whether new file `billing-management.md` is created at Gate 4

---

## Risk log (additions from this session)

| # | Risk | Mitigation |
|---|---|---|
| R11 NEW | Q9 domain-split delayed → subscription-account.md stays at 15 entries indefinitely | Accept. Single-file readability at 15 entries is fine. If file grows beyond 20, force Q9 verdict. |
| R12 NEW | JTBDs over-specify Gate 4 surfaces before Q1 verdict | Mitigation in place: every JTBD's served-by list names surfaces as "Gate 4 pending" with red-line inheritance Q1-agnostic. |
| R13 NEW | CC-88 authored as cross-project pattern might be misinterpreted as MPMF-scope only | Doctrine-basis line explicitly references cross-project; parallels CC-82/83 precedent. Future projects installing telemetry cite CC-88 without needing new JTBD. |

---

## Change log

- 2026-04-24 — Session 3a. Gate 3 Mode B (JTBD authoring) — 10 JTBDs authored Claude-solo (SA-71..78 + CC-88 + ON-88) across 3 domain files. ATLAS updated. BACKLOG 10 rows flipped COMPLETE. Charter Session Log + 4 Decisions entries. Modes A + C + D remain for Session 3b (owner-attended). Zero code. Zero test regressions. Gate 3 ~50% shipped by row count; pivotal Q1+Q7 still unresolved blocking Gate 4.
