# Handoff — Monetization & PMF · Session 2 (Gate 2 Blind-Spot Roundtable)

**Session:** 2026-04-24, Claude (main)
**Project:** `docs/projects/monetization-and-pmf.project.md`
**Phase:** Gate 2 SHIPPED (verdict YELLOW); Gate 3 NEXT (owner interview + 10 JTBDs + persona ratification)
**Status:** DRAFT — awaiting owner review

---

## Files I Own (This Session)

- `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md` — CREATED (master audit)
- `docs/projects/monetization-and-pmf/gate2-voices/01-product-ux.md` — CREATED
- `docs/projects/monetization-and-pmf/gate2-voices/02-autonomy-skeptic.md` — CREATED
- `docs/projects/monetization-and-pmf/gate2-voices/03-market-lens.md` — CREATED
- `docs/projects/monetization-and-pmf.project.md` — AMENDED (Stream A G2 checkbox + Session Log + 7 Decisions entries)
- `.claude/BACKLOG.md` — AMENDED (46 MPMF-* rows added between EAL and Shape Language sections)
- `.claude/STATUS.md` — AMENDED (top entry; prior PRF entry demoted to "Prior update")
- `.claude/handoffs/monetization-and-pmf-session2.md` — this file

**No file conflicts.** Other active streams (exploit-anchor-library Stream E, shape-language Gate 3, line-study-slice-widening audit batches, printable-refresher Gate 3) operate in different directories.

---

## What this session produced

**4 new artifacts + 3 governance amendments + 1 handoff.** Zero code touched.

| # | Artifact | Path | Role |
|---|----------|------|------|
| 1 | Master Gate 2 audit | `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md` | NEW — 5 stages + verdict YELLOW + 3 risks + 10 red lines + 12 anti-patterns + follow-ups |
| 2 | Voice 01 — Product/UX | `docs/projects/monetization-and-pmf/gate2-voices/01-product-ux.md` | NEW — Stages A/C/E; evaluator-fork decision; H-SC01 + H-SC02 new heuristics |
| 3 | Voice 02 — Autonomy skeptic | `docs/projects/monetization-and-pmf/gate2-voices/02-autonomy-skeptic.md` | NEW — Stages A/E; 10 commerce red lines; 12 anti-patterns; Q1=A advocacy |
| 4 | Voice 03 — Market lens | `docs/projects/monetization-and-pmf/gate2-voices/03-market-lens.md` | NEW — Stages B/C/D; 3 missing JTBDs (SA-76/77/78); Q7 legal scope; M9–M12 assumption seeds |
| 5 | Charter amendments | `docs/projects/monetization-and-pmf.project.md` | Stream A G2 [x]; Session Log row; 7 Decisions entries |
| 6 | BACKLOG | `.claude/BACKLOG.md` | NEW MPMF section — 46 rows (1 G1 + 1 G2 COMPLETE, 19 G3 NEXT, 15 G4 BLOCKED, 8 G5 BLOCKED, 2 ancillary) |
| 7 | STATUS | `.claude/STATUS.md` | AMENDED — top entry; PRF entry demoted |
| 8 | Handoff (this file) | `.claude/handoffs/monetization-and-pmf-session2.md` | NEW |

---

## Verdict — YELLOW

### The 3 structural risks

1. **Dark-pattern cancellation drift.** Industry's most common monetization integrity failure. Every SaaS eventually accretes "are you sure?" confirmation layers, exit surveys, pause-instead interposition. Mitigated by dedicated `journeys/cancellation.md` + CI-linted copy at Gate 4.
2. **Q7 legal posture unresolved — blocks Ignition lane.** US grey-market operator (Ignition) creates ToS + payment-processor + marketing-channel risk. Public marketing + Stripe acceptance both gate on Q7. Gate 3 must schedule separate legal-scoping session.
3. **Evaluator evidence gap.** 3 PROTO personas without ledger entries. Gate 3 ratification is structural (owner-confirmed); evidential Verified status waits on Stream D 30–60-day telemetry window.

### The pivotal question — Q1 (doctrine scope)

Every paywall-spectrum bundle ranks differently by Q1 verdict. Under Q1=A (doctrine binds commerce), bundles α + δ win and β is disqualified. Under Q1=C (doctrine skill-only), β becomes allowed but the positioning differentiator (M1 "no streaks, no guilt, two-tap cancel") is lost. The Autonomy voice advocates Q1=A forcefully: "the doctrine IS the product differentiator; weakening it weakens the one thing distinguishing this app from GTO Wizard / Upswing / Run It Once on commerce UX."

Q1 must verdict at Gate 3 before Gate 4 surface spec authoring can proceed Q1-specifically.

---

## Scope expansions from this session

### JTBDs — from 7 proposed to 10

Market voice observed 3 missing JTBDs every SaaS in category has implicit:
- **SA-76** — Switch between plan tiers (upgrade/downgrade is distinct from cancellation; Gate 4 needs `journeys/plan-change.md`)
- **SA-77** — Manage payment method without churning (billing-info management distinct from plan management)
- **SA-78** — Know when and how much I'll be billed (renewal transparency; binds red line #2)

### Owner-interview questions — from 8 to 10

- **Q9** — JTBD domain split: keep single `subscription-account.md` at 15 entries, or split into `subscription-account.md` + new `billing-management.md`?
- **Q10** — Author `evaluator-ignition-mode.md` situational, or keep E-IGNITION as sub-shape attribute of unified Evaluator?

### Autonomy red lines — from 9 inherited to 10 commerce-specific

Added #10 "no dark-pattern cancellation" as distinct red line (above and beyond the 9 autonomy lines inherited from skill-gating doctrine). Cancellation is high-risk enough to warrant its own invariant.

### Heuristics — 2 new project-specific

- **H-SC01** — Paywall never interrupts active work. Mid-hand quota-exhaustion defers to hand-end.
- **H-SC02** — Trial state legible outside settings. ≤2 taps to check tier from anywhere.

### Persona authoring

Evaluator stays unified at core level (no fork). Sub-shape attributes (E-CHRIS / E-SCHOLAR / E-IGNITION) stay in `evaluator.md`. Q10 decides whether to author `evaluator-ignition-mode.md` situational.

---

## Gate 3 scope summary — what the next session delivers

Per the plan at `C:\Users\chris\.claude\plans\misty-swimming-rabbit.md` and the audit's required follow-ups:

**Mode A — Owner interview (owner-attended):**
- Q1 doctrine scope (highest-leverage)
- Q7 legal/ToS posture (likely scheduled as separate legal-scoping session)
- Q8 telemetry consent default
- Q5 free-tier shape
- Q2 sequencing
- Q4 founding-member mechanism (conditional on Q2=B)
- Q3 Ignition commercial lane timing
- Q6 Scholar fork (may be deferred)
- Q9 JTBD domain-split
- Q10 evaluator-ignition-mode-situational

**Mode B — JTBD authoring (Claude-solo):**
- SA-71..78 authored in `subscription-account.md` (or split per Q9)
- CC-88 authored in `cross-cutting.md`
- ON-88 authored in `onboarding.md`
- ATLAS updated with range bumps + change-log

**Mode C — Persona ratification (owner touch):**
- 3 PROTO → Owner-Confirmed
- Change-logs updated
- `personas/README.md` entries added

**Mode D — Gate 2 re-run (conditional):**
- If updated framework addresses YELLOW findings, Gate 2 re-runs and verdicts GREEN. Mirror EAL re-run audit pattern.

Gate 3 can split if owner availability is bursty — Mode B (JTBD authoring) runs Claude-solo; Modes A + C + D wait for owner-attended session.

---

## Key findings to carry forward

### For Gate 3

1. **Q1 verdict is doctrine-defining.** Autonomy voice recommends A; Product/UX voice recommends A (via heuristic alignment); Market voice neutral. Owner's call.
2. **Q7 legal scoping is a separate session.** Not a verdict that can be made in the same sitting as Q1–Q6/Q8–Q10.
3. **10 JTBDs is a full authoring session** (~1 hour of Claude-solo work per JTBD template depth). Consider batching authoring across 3a + 3b if owner unavailable.
4. **Bundle α is recommended under Q1=A** — but paywall-spectrum doc ranks bundles, doesn't lock one. Gate 4 authoring assumes Q1 verdicted + bundle selected.
5. **Evaluator ratification is structural, not evidential.** Owner can confirm persona shape; full Verified status (assumption kill-or-keep) waits on Stream D.

### For Gate 4

1. **Cancellation journey gets dedicated doc** with CI-linted forbidden-copy enforcement. Mirror EAL's `calibrationCopy.js` + `retirementCopy.js` pattern.
2. **12 anti-patterns enumerated as MPMF-AP-01..12** — Gate 4 `anti-patterns.md` turns these into explicit refusals with red-line citations.
3. **6 surfaces + 4 journeys** per audit's required follow-ups (6 surfaces: pricing-page, paywall-modal, upgrade-prompt-inline, trial-state-indicator, billing-settings, telemetry-consent-panel; 4 journeys: evaluator-onboarding, paywall-hit, cancellation, plan-change).
4. **H-SC01 + H-SC02 added to heuristics/poker-live-table.md** (or new project-specific heuristics doc).
5. **WRITERS.md** for `subscription` store (~5 writers).
6. **assumption-ledger.md** with 12–15 falsifiable assumptions (M1–M8 from Session 1 + M9–M12 from Market voice + 3–5 new at Gate 4).
7. **Entitlement architecture** (main-app IDB + WebSocket bridge to extension) confirmed.
8. **Bundle ε structured as strict-superset of Pro** confirmed.

### For Gate 5

1. **Entitlement reducer + EntitlementContext + useEntitlement hook** (additive pattern, mirrors existing contexts).
2. **IDB v17/v18 → v19 migration** with new `subscription` store (additive, ~5 writers).
3. **Payment processor selection deferred** pending Q7 (Stripe default risky for Ignition; Paddle/LemonSqueezy alternatives).
4. **PaywallGate shared component** (feature-gate wrapper with consistent copy + CTA pattern).
5. **BillingSettings extension** of `SettingsView` (6-action panel).
6. **PostHog install** gated on Q8 verdict; event schema v1 + persona-inference dashboard + frustration dashboard.
7. **In-app test assertions for 10 commerce red lines** — mirror EAL-G5-RL pattern.
8. **CI-linted forbidden-copy-strings check** — mirror EAL `scripts/check-anchor-writers.sh` pattern.
9. **H-SC01 test** — paywall never fires mid-hand.

---

## Risk log (updates from Session 1)

| # | Risk | Status |
|---|---|---|
| R1 | PROTO personas ratified without data → bad monetization design locks in | ACTIVE — mitigated by Gate 3 structural ratification + Stream D 30–60-day evidential window |
| R2 | Owner picks bundle β (conventional freemium) → doctrine differentiator lost | ACTIVE — pending Q1 verdict |
| R3 | Founding-member lifetime creates LTV cap that hurts later-stage valuation | ACTIVE — accepted as seeding cost |
| R4 | Ignition legal exposure surfaces during marketing launch | **ELEVATED** — Q7 blocking for Ignition lane; Gate 3 must schedule scoping session |
| R5 | PostHog data accumulates but persona-inference model never converges | ACTIVE — 60-day soak window accepted |
| R6 | Evaluator bounces in first 60 seconds regardless of design quality | ACTIVE — "sample data mode" mitigation per ON-86 |
| R7 | Tests regress from entitlement/reducer work at Gate 5 | ACTIVE — additive-only pattern; CI gating |
| **R8 NEW** | **Dark-pattern cancellation drift** | ACTIVE — dedicated journey doc + CI-linted copy at Gate 4 |
| **R9 NEW** | **Q1=B/C verdict escalates this audit to RED** | CONDITIONAL on Q1 |
| **R10 NEW** | **Payment processor rejects Ignition category** | CONDITIONAL on Q7 + Stripe risk review |

---

## Ratification checklist (for owner)

Before Gate 3 session begins, owner should:

- [ ] Read `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md` (master audit).
- [ ] Skim the 3 voice files if interested in individual perspectives.
- [ ] Pre-verdict Q1 + Q7 + Q8 if possible — these three are blocking for Gate 4 progress.
- [ ] Schedule legal-scoping session for Q7 (may need external counsel).
- [ ] Confirm persona ratification scope — structural OK now, Verified waits for telemetry.

Owner can redirect anything; nothing is locked until Gate 3 verdict + ratification.

---

## Change log

- 2026-04-24 — Session 2. Gate 2 blind-spot roundtable (3 voices — Product/UX + Autonomy skeptic + Market lens) + master audit. Verdict YELLOW. 3 structural risks + 10 commerce red lines + 12 anti-patterns + 2 new heuristics + scope expansions (7→10 JTBDs, 8→10 owner-interview questions). Charter Stream A G2 checkbox flipped; Decisions Log gained 7 new entries. BACKLOG expanded with 46 MPMF-* rows. Zero code. Handoff ready. Gate 3 NEXT.
