---
id: monetization-and-pmf
name: Monetization & Product-Market Fit — Pricing, Paywall, Telemetry, Evaluator Journey
status: active
priority: P1
created: 2026-04-24
backlog-id: MPMF
---

# Project: Monetization & Product-Market Fit

## Quick Start for New Sessions

1. Read ALL files in `.claude/handoffs/` — check for file conflicts.
2. Read this file — find the current phase (marked with `<- CURRENT`).
3. Read the "Context Files" for the active phase.
4. Create/update your handoff file in `.claude/handoffs/`.
5. Execute the checklist items.
6. Update this file and handoff when done.

---

## Overview

Monetization-readiness program for the app. Produces the pricing strategy, paywall mechanics, telemetry foundation, and evaluator-journey design needed to move from "single-owner-use" to "externally-sold product" without giving away content that belongs at a higher price point.

The project has **four intertwined concerns** — none of them can be designed correctly without the others:

1. **Persona expansion** — the current cast (Chris Live Player, Scholar, their sub-personas) does not include anyone *evaluating the app as a prospective buyer*. Every persona is an already-committed user. This project authors the Evaluator persona + situational variants (trial-first-session, returning-evaluator) so that trial UX and paywall messaging can be designed against a real persona, not a folk-model.
2. **Pricing + paywall design** — tier shape, WTP anchoring, feature/usage gating boundaries, trial mechanics, paywall copy, upgrade-moment instrumentation. The doctrine red lines #5 (no streaks/shame/engagement-pressure) and #7 (editor's-note tone) constrain which conventional SaaS tactics are allowable; resolving this scope is **Owner Interview Q1** for Gate 3.
3. **Telemetry foundation** — no credible pricing or UX decision can be made without observation data. Install PostHog (or equivalent), instrument screen time, navigation graph, action-level events, feature-touch events, frustration signals (rage-clicks, form-abandonment, repeated-opens, session-replay flags). Use events to *infer which persona* is actually on the app and *which JTBDs* are being attempted.
4. **UX redesign against falsifiable assumptions** — the project does NOT redesign the UI upfront. It produces a load-bearing UX assumption ledger (10–15 assumptions with kill-criteria), instruments those assumptions, and gates any redesign behind 30–60 days of evidence. This avoids "redesign by taste."

**Explicit scope exclusions:**
- This project does NOT implement a payment processor, tier-entitlement enforcement, or account system in Phase 1. Those are Gate 5 outputs that arrive only after Gate 4 design is locked.
- This project does NOT finalize pricing numbers. It produces a ranked candidate set + a test plan for validating numbers with founding-member soft launch.
- This project does NOT fix UI "feature drift" complaints directly. It builds the observation layer that will tell you *which* drifts cost users.

**Relationship to other projects:**
- **Parallel to** `exploit-anchor-library` + `poker-shape-language` — those projects produce the content that will be tier-gated; this project produces the commercial wrapper. Both benefit from the telemetry foundation this project ships.
- **Depends on none** — this is a foundation project. It unblocks the eventual "launch" milestone.
- **May retroactively amend** — if telemetry reveals a persona not in the cast (e.g., "an actual Scholar user who also plays live"), this project's Gate 3 output feeds back into the design framework.

---

## Gate 1 — Entry (per `docs/design/LIFECYCLE.md`)

**Date:** 2026-04-24. **Author:** Session 1, Claude (main).

### Scope classification

**Primary:** *Product-line expansion + cross-surface journey change + new persona class.*

Specifically:
- **New persona class:** the *Evaluator* — a core persona with no pre-existing commitment to the app. Requires authoring from zero; no existing persona covers prospective-buyer cognitive state.
- **New surfaces (anticipated, confirmed at Gate 4):** pricing page, paywall modal, upgrade-prompt embeds on gated features, trial-state indicator, account/settings billing section, post-signup onboarding differentiated from current (no-onboarding) flow.
- **Cross-surface journey change:** every existing view needs to know its trial-vs-paid entitlement state for any feature-gated surface. This threads entitlement through the app without forcing redesign today.
- **Telemetry foundation:** PostHog integration + event schema — not a "surface" but a cross-cutting foundation that will inform all other design work.
- **New commercial lane (Ignition sidebar SKU):** the Ignition extension is priced separately from the main app; requires a distinct commercial treatment and onboarding.

### Personas identified

**Existing cast mapped:**
- `chris-live-player` — already-committed user. Does not plausibly map to trial/paywall experience without a different cognitive state.
- `scholar-drills-only` — already-committed user. Has `Tier fit: Plus (Regular) ~$19/mo` note + S1 WTP hypothesis, but no evaluator-shape coverage.
- All 14 core personas + 14 situational personas in `docs/design/personas/` — **zero** capture the evaluator cognitive state.

**New personas required (authored in this project):**
- **`evaluator`** (core) — someone discovering the product without prior commitment; evaluating whether to continue past the free tier. Distinct cognitive shape: they do not know what they want yet; they do not know what the app does; they do not know whether it is worth money.
- **`trial-first-session`** (situational) — the evaluator's first session specifically; 5–15 minutes of first-impression window; "is this for me?" mode.
- **`returning-evaluator`** (situational) — evaluator who installed, drifted, came back after a week. Different cognitive state than first-session; "does this still make sense?" mode.

**Persona amendments possible (deferred to Gate 3 or later):**
- `chris-live-player` may gain a *trial-cohort* attribute once observed behavior of founding members clarifies whether "Chris" as shipped is actually the user profile of early buyers.
- `newcomer` persona already exists (core) — but is scoped to "new to poker," NOT "new to this app while being experienced at poker." Gate 3 decides whether to amend Newcomer or keep Evaluator fully separate.

### JTBD identified

**Existing JTBDs relevant (from `docs/design/jtbd/`):**
- **SA-64** — Free tier with real value (*Proposed*).
- **SA-65** — Tier comparison before purchase (*Proposed*).
- **SA-66** — Transparent billing + easy pause (*Proposed*).
- **SA-67** — Multi-region access (*Proposed*).
- **SA-68** — Granular coach/student permissions (*Proposed*).
- **SA-69** — Team / seat-based billing (*Proposed*).
- **SA-70** — Local-only mode with full features (*Active — ok today*).
- **ON-82..87** — Onboarding domain (mostly *Proposed*).

**Status reality check:** every SA-* JTBD except SA-70 is `Proposed` — meaning the atlas identifies the job but the supporting feature doesn't exist. This project is where those get promoted to `Active`.

**Candidate new JTBDs (Gate 3 authoring scope):**
- **SA-71 (proposed)** — *Try the product before paying* — evaluator wants to experience core value without committing money, without feeling tricked or rate-limited into immediate purchase.
- **SA-72 (proposed)** — *Understand what's free, what's paid, and why* — tier clarity JTBD; distinct from SA-65 (comparison) because it's about intra-session legibility, not a one-time comparison screen.
- **SA-73 (proposed)** — *Hit a paywall with dignity* — when an evaluator hits the free-tier ceiling, they need a dignified upgrade moment that respects their autonomy and frames the gate in editor's-note tone (not coercive).
- **SA-74 (proposed)** — *Cancel without friction* — a dark-pattern-free cancellation flow is itself a JTBD; failing this is a doctrine violation under red line #5 + #7.
- **SA-75 (proposed)** — *Evaluate the sidebar separately from the main app* — the Ignition sidebar has its own commercial lane; evaluator must understand and optionally trial it without it being bundled in default onboarding.
- **CC-88 (proposed)** — *Have the app observe my usage honestly and transparently* — meta-JTBD around telemetry + session replay; every paid feature observes the user, and red line #9 (incognito) composes with that.
- **ON-88 (proposed)** — *Expert-bypass onboarding for evaluators who already know poker tooling* — sister-JTBD to ON-84 but specific to evaluators (who may know the category but not this app).

### Gap analysis

**Verdict: YELLOW.** Scope is tractable — the commercial architecture is well-understood in SaaS industry terms, and the telemetry + assumption-ledger pattern is a standard product-discovery move. Real gaps:

1. **Evaluator persona is absent from the cast entirely** — this is a structural gap. Gate 3 must close it before Gate 4 surface design proceeds. Authored in this session (Session 1); owner ratification needed.
2. **Doctrine scope ambiguity (red lines #5, #6, #7)** — the 9 red lines were written for skill-gating, not price-gating. Whether they apply to paywall copy, upgrade prompts, trial urgency, renewal reminders, cancellation friction is **undecided**. Gate 3 owner-interview question Q1 (see below). This is the single highest-leverage question in the project — changes the option space materially.
3. **7 new JTBDs proposed** (SA-71..75, CC-88, ON-88) — Gate 3 authoring work. Maps 1:1 to the gap the evaluator persona exposes.
4. **No telemetry signal available today** — the UX assumptions in this project are all hypotheses. Gate 3 research phase includes instrumenting PostHog before the assumption ledger can be validated. This is a *sequencing* gap, not a structural one.
5. **Pricing is downstream of data we don't have yet** — the roundtable output (Session 1) ranks candidates but does not lock numbers. Gate 3 owner-interview question Q2 asks whether to soft-launch a founding-member tier in parallel with telemetry build to generate WTP signal, or defer pricing entirely until 60 days of usage data lands.

**Why YELLOW not RED:** no new core persona *category* is missing (Evaluator is authorable from zero using the same shape as Chris/Scholar). No new JTBD *domain* is missing (Subscription/Account domain exists; just under-populated). The autonomy-doctrine question is clarifying, not load-bearing — the doctrine is load-bearing regardless, we just need the owner's call on whether it binds commerce.

**Triggers Gate 2 — required per LIFECYCLE.md.** Roundtable scope will be the persona-Evaluator fit, JTBD coverage for SA-71..75, situational stress of trial-first-session + returning-evaluator, cross-product sidebar commercial lane, and heuristic pre-check of paywall patterns against N-10 + PLT + ML.

---

## Gate 3 — Owner Interview Questions (parked for Gate 3 session)

Formalized per Gate 1 finding #2 and #5. Answers shape Gate 4 surface design.

### Q1 — Doctrine scope

Do the 9 autonomy red lines (from `chris-live-player.md` §Autonomy constraint) apply to:
- (A) All commerce UX — paywall copy, upgrade prompts, trial-state indicators, renewal reminders, cancellation flow — binding equally.
- (B) Commerce UX selectively — e.g., #7 (editor's-note tone) binds paywall copy, but #5 (no engagement-pressure) applies to skill-gating only and permits conventional trial urgency.
- (C) Skill-gating only — commerce UX is out of scope for the red-line contract; only Nielsen + PLT heuristics bind.

**Recommended starting position:** (A). The owner's doctrine positions the product as *radically honest*; selective application weakens the positioning wedge. If (A) is taken, the paywall-spectrum design doc (`docs/projects/monetization-and-pmf/paywall-spectrum.md`) ranks options on doctrine compliance, not just conversion efficiency.

### Q2 — Sequencing

Should the project:
- (A) Run telemetry-first — no pricing ship until 30–60 days of PostHog data validates the assumption ledger.
- (B) Run pricing + telemetry in parallel — soft-launch a founding-member $299 lifetime to 20 first users, collect WTP signal and telemetry simultaneously, make tier decision after data lands.
- (C) Run pricing-first — ship a single-tier $19–25/mo soft launch immediately, iterate on telemetry after.

**Recommended starting position:** (B). Founding-member lifetime is capped at 50, permanently removes those 50 from the subscription LTV pool but buys direct-feedback access + generates some revenue + avoids the "framework-eats-the-ship-date" failure mode the Gate 1 skeptic voice raised in Session 1.

### Q3 — Ignition commercial lane timing

The Ignition sidebar has its own commercial lane (hypothesized $69–99/mo) but requires an in-app training flow (identified in Session 1 roundtable). Options:
- (A) Nail Ignition onboarding first, then commercialize (~3-month investment).
- (B) Commercialize Ignition at current maturity (extension already ships and works for owner); onboarding in parallel with first external customers.
- (C) Defer Ignition commercial lane entirely until main-app monetization validates.

**Recommended starting position:** (C). Main-app monetization is the bigger market + more urgent; Ignition is premium add-on and benefits from having a paid-customer base to upsell, not cold-acquire.

### Q4 — Founding-member mechanism

If Q2 → (B):
- (A) $299 lifetime, capped at 50 founding members.
- (B) $99/yr for year 1, price-locked indefinitely if they keep subscribing (no cap).
- (C) $19/mo from day 1, no special treatment.

**Recommended starting position:** (A) — caps downside, creates scarcity that is *transactional* (not engagement-coercive, so red-line compatible), generates cash, selects for evangelists.

### Q5 — Free-tier shape

The three candidates from Session 1 roundtable:
- (A) **Session-scoped free** — unlimited hand entry + single-session analysis, no persistence of villain models or cross-session data. (Recommended in roundtable.)
- (B) **Hand-quota free** — 50 hands/mo, 3 villain profiles, 5 drills. (Industry-standard usage-gate, but conflicts with red line #5 if mid-session.)
- (C) **Feature-subset free** — free forever for entry + recap, everything else paid. (Cleanest but lowest conversion pressure.)

### Q6 — Scholar persona fork

Session 1 proto-personas suggest Scholar and Chris are distinct markets. Telemetry will validate. Pre-question:
- (A) Maintain Scholar as a distinct commercial target with its own pricing narrative (lower-tier, education-forward).
- (B) Treat Scholar as a subset of Chris pricing (same tier ladder, Scholar happens to stop at Plus).
- (C) Defer Scholar as a distinct market until data shows adoption warrants; focus commercial effort on Chris alone.

### Q7 — Ignition-user identity and ToS scope

Ignition is a US-grey-market operator. Commercial questions that bind legal posture:
- Does the product's ToS disclaim poker operator grey-market risk, or stay silent?
- Does the app target a US-legal jurisdiction only?
- Are there marketing channels (e.g., YouTube) with poker/gambling content policies that constrain advertising?

Gate 3 must answer before any public marketing copy or paywall-country-gating ships.

### Q8 — Data collection consent UX

If PostHog telemetry is installed:
- (A) Opt-in banner on first launch, default off (most autonomy-aligned, lowest data quality).
- (B) Opt-out — telemetry on by default, visible off-switch in settings, respectful default (industry norm, defensible under red line spirit).
- (C) Mandatory for paid tiers, opt-out for free tier.

**Recommended starting position:** (B) with a *first-launch transparency panel* that names what is collected, what isn't (PII never), and the one-tap off-switch. This mirrors the red-line #9 (incognito) pattern: structurally always-available, default-on, per-event per-user clear.

---

## Acceptance Criteria (overall)

- **Evaluator persona class authored:** 1 core (`evaluator.md`) + 2 situational (`trial-first-session.md`, `returning-evaluator.md`). Owner ratification: **Confirmed 2026-04-24 Session 3b** (structural). Full Verified pending Stream D telemetry. [MPMF-G3-P — COMPLETE]
- **10 new JTBDs authored** (SA-71..78, CC-88, ON-88) across 3 domain files (+1 new `billing-management.md` per Q9=A). **COMPLETE 2026-04-24 Sessions 3a+3b.** [MPMF-G3-J]
- **Owner interview verdicts** at `docs/projects/monetization-and-pmf/gate3-owner-interview.md` — all 10 (Q1–Q10) verdicted on Recommended positions 2026-04-24 Session 3b. [MPMF-G3-O — COMPLETE]
- **Paywall spectrum design doc** at `docs/projects/monetization-and-pmf/paywall-spectrum.md` — full option space for messaging, trial length, paywall location, CTA copy, limited-use patterns; each option ranked on conversion efficiency AND doctrine compliance. Under Q1=A verdict, bundle α (doctrine-clean session-scoped) + bundle δ (founding-member) are authoritative Gate 4 design targets; bundle β disqualified; bundles γ/ε deferred. Session 1 delivery. [MPMF-PS — COMPLETE]
- **Market-research artifact** at `docs/projects/monetization-and-pmf/market-research.md` — preserved competitive pricing data + anchor points. Session 1 delivery. [MPMF-MR — COMPLETE]
- **Gate 2 blind-spot roundtable audit** at `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md` — 5 stages per `ROUNDTABLES.md`. **COMPLETE Session 2.** Gate 2 re-run against updated framework at `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf-rerun.md` — verdict **GREEN** Session 3b. [MPMF-G2 + MPMF-G3-RR — COMPLETE]
- **Gate 4 surface artifacts** authored before any paywall/trial code — `pricing-page.md`, `paywall-modal.md`, `upgrade-prompt-inline.md`, `trial-state-indicator.md`, `billing-settings.md` (SettingsView extension), `telemetry-consent-panel.md`, `evaluator-onboarding.md` journey, `paywall-hit.md` journey, `cancellation.md` journey (dark-pattern-free), `plan-change.md` journey. [MPMF-G4-S1..S6 + G4-J1..J4]
- **`anti-patterns.md`** at `docs/projects/monetization-and-pmf/anti-patterns.md` — 12 MPMF-AP-01..12 refusals enumerated with forbidden-string CI-lint patterns + permitted alternatives + red-line citations. Stub shipped Session 3b; expanded at Gate 4 as surface specs reveal additional refusals. [MPMF-G3-OOS + MPMF-G4-AP]
- **Assumption ledger** at `docs/projects/monetization-and-pmf/assumption-ledger.md` — 12–15 load-bearing falsifiable assumptions with kill-criteria; each assumption maps to an instrumented PostHog event. [MPMF-G4-AL]
- **Telemetry foundation** shipped — PostHog integration (Q8=B opt-out with transparency panel), event schema v1, persona-inference dashboard, frustration-detection dashboard, 30–60-day data accumulation before full-tier pricing locks. Stream D Phase 1 unblocked post-Gate-3. [MPMF-G5-PH]
- **Pricing candidate ranked + soft-launch launched** — founding-member $299 lifetime to ≤ 50 users per Q2=B + Q4=A verdicts; conversion + retention tracked via telemetry. [MPMF-G5-ER + MPMF-Stream-E]
- **Ignition lane scope decision** — Q3=C verdict defers Ignition commercial lane to Phase 2+ pending main-app validation + Q7 legal-scoping session. Bundle ε surface work deferred; SA-75 JTBD remains Active but served-by-surface list shows "Phase 2+ deferred." [MPMF-IL — DEFERRED per Q3=C]
- **10 commerce red lines applied to all commerce UX per Q1=A verdict** — every paywall/trial/cancellation/billing/upgrade/pricing surface has a red-line compliance assertion list inline in its surface artifact, mirroring `anchor-library.md` / `calibration-dashboard.md` pattern. [MPMF-G4-ACP + MPMF-G5-RL]
  1. **Opt-in enrollment for data collection** (inherits #1). Telemetry events gate on consent category; no events fire before consent (Q8=B first-launch panel default-on but always-visible off-switch). Extension observes but never writes independent entitlement state. Test assertion MPMF-G5-RL covers.
  2. **Full transparency on demand** (inherits #2). Billing settings always show: current tier / next billing date / amount / cancellation path / payment method / data export path — one tap from SettingsView; no hidden fees; no obscured dates; no auto-renewal surprises (MPMF-AP-11 refused).
  3. **Durable overrides on billing state** (inherits #3). Cancellation fully respected; no "we've paused your cancellation" dark patterns (MPMF-AP-05 refused); cancelled users not re-prompted to re-subscribe for ≥90 days.
  4. **Reversibility** (inherits #4). Cancellation reversible before billing period ends; data retention preserved locally in IDB; data export on leaving is one-click; tier-change (SA-76) reversible within billing period.
  5. **No streaks / shame / engagement-pressure notifications** (inherits #5). Push notifications banned for monetization entirely (MPMF-AP-04 refused); renewal reminders factual + transactional only; no streak mechanics on commerce surfaces (MPMF-AP-03 refused); no timer-urgency banners (MPMF-AP-01 refused); no fake-scarcity "limited-time" offers (MPMF-AP-09 refused).
  6. **Flat-access pricing page** (inherits #6 spirit). All tiers shown with clear feature comparison + founding-member cohort section with factual cap-remaining; no "most popular" social-proof pressure nudges; no inflated-count social proof (MPMF-AP-02 refused).
  7. **Editor's-note tone on all commerce copy** (inherits #7). CI-linted forbidden-string check (MPMF-G5-CL) on: pricing page, paywall modal, upgrade prompts, trial-state indicators, renewal-notice banners, cancellation journey, renewal email templates. Factual C5 or editor's-note C6 registers only; coercive C1/C2/C3 registers refused. "Downgrade" framing on cancellation (MPMF-AP-06) refused; "missing out" loss-framing (MPMF-AP-07) refused. Deterministic copy generators (mirror EAL `calibrationCopy.js` + `retirementCopy.js`) for load-bearing surfaces.
  8. **No cross-surface commerce contamination** (inherits #8). Free-tier state indicators never interrupt live-play surfaces; upgrade CTAs never on TableView during active hands; paywall modal never fires mid-hand — all paywalls defer to hand-end per H-SC01 + MPMF-AP-12 (paywall-mid-hand) refused. Main-app commerce state doesn't leak into sidebar UX; sidebar commerce state (Phase 2+) doesn't leak into main-app. Bundle ε structured as strict-superset of Pro.
  9. **Incognito observation mode non-negotiable** (inherits #9). Telemetry events respect per-category opt-out (Q8=B first-launch panel + Settings panel); per-event incognito toggle available at Gate 5 for features that write telemetry events. Mirrors EAL Tier 0 observation incognito pattern. Test assertion covers.
  10. **★ NEW — No dark-pattern cancellation** (Gate 2 audit + Q1=A). Cancellation ≤ 2 taps from billing settings; no exit-survey interposition; "pause instead?" offered with equal visual weight (not pre-selected / not dark-pattern-boosted); factual confirmation copy ("Cancel [tier]. You'll keep access through [date]."); no guilt-framing ("Are you sure you want...", "You'll lose..."); post-cancel state fully honored (no upsell banners during grace period, no degraded UI teasing); ≥90-day no-resubscription-prompt window. Dedicated `journeys/cancellation.md` at MPMF-G4-J3 with CI-linted forbidden-copy ladder enforces.
- **Graded-work trap refused throughout** — commerce copy that frames the user as being evaluated (e.g., "Have you unlocked your potential?", "Ready for the next level?", any aspirational-pressure framing) is CI-lint-refused. Mirrors EAL AP-06 (graded-work) and PRF CD-2 (no-self-evaluation) across commerce UX.
- **Live-surface footprint minimal** — paywall never fires during active hand (H-SC01); trial-state indicator ≤ 150ms glanceable (H-PLT01); no colored urgency banners on TableView.
- **IDB migration additive only** — `subscription` store added at next IDB version bump (dynamic `max(currentVersion+1, targetVersion)` pattern per EAL G4-DB precedent); zero modifications to existing stores; tested via `fake-indexeddb` migration round-trip.
- **Entitlement architecture** — main-app IDB is source of truth for entitlement state; extension (when Phase 2+ Ignition ships) subscribes via existing WebSocket bridge; no independent extension-side entitlement state. [MPMF-G4-EA]
- **No regression on existing ~5,400 tests.**

---

## Context Files

**Mandatory reads before any phase:**

- `CLAUDE.md` — root project rules; Design Program Guardrail section.
- `docs/design/LIFECYCLE.md` — 5 gates; Entry + Blind-Spot + Research + Design + Implementation.
- `docs/design/ROUNDTABLES.md` — Gate 2 template.
- `docs/design/METHODOLOGY.md` — 5-step audit process.
- `docs/design/personas/core/chris-live-player.md` — Autonomy constraint section (9 red lines); persona shape precedent.
- `docs/design/personas/core/scholar-drills-only.md` — Tier-fit hypothesis ($19 Plus) precedent.
- `docs/design/jtbd/ATLAS.md` — SA-64..70 + ON-82..87 coverage.
- `docs/design/jtbd/domains/onboarding.md` — ON-87 expert-bypass precedent (distinct-from-ON-84 rationale transferable).

**Mandatory reads before Gate 2 (Blind-Spot Roundtable):**

- `docs/projects/monetization-and-pmf/market-research.md` — this project, Session 1.
- `docs/projects/monetization-and-pmf/paywall-spectrum.md` — this project, Session 1.
- `docs/design/personas/core/evaluator.md` — this project, Session 1 (authored in parallel with charter).

**Mandatory reads before Gate 4 (Design spec phase):**

- Gate 3 owner-interview verdicts (`gate3-owner-interview.md`).
- All 3 new personas (ratified post-Gate 3).
- All 7 new JTBDs (ratified post-Gate 3).

**Mandatory reads before Gate 5 (Implementation — telemetry):**

- `src/reducers/*` — entitlement state is new reducer surface area; existing patterns inform shape.
- `src/utils/persistence/database.js` — IDB migration pattern (subscription state persists).
- PostHog JS SDK documentation (web).
- `ignition-poker-tracker/CLAUDE.md` — if Ignition commercial lane work begins.

---

## Streams

Five streams. Stream A (governance) runs first and gates the others. Stream B (persona/JTBD authoring) runs in parallel with Stream A's Gate 1/3 stages. Stream C (paywall + pricing design) depends on Stream A Gate 4. Stream D (telemetry) is independent of Gate 4 but depends on Q1+Q8 verdicts. Stream E (soft launch) depends on Streams C + D.

| Stream | Status | Description | Gate |
|--------|--------|-------------|------|
| A | [x] G1 (2026-04-24) [x] G2 (2026-04-24) [x] G3 (2026-04-24) [x] G4 (2026-04-25) [~] G5 IN PROGRESS (B1 shipped 2026-04-25) | Design lifecycle gates 1–5 | Gate 5 Batch 1 (Entitlement Foundation) shipped — 12 new files (~1,500 LOC) + 5 amendments; 108 new tests; zero regressions; clean build. Subsequent batches (G5-B2 telemetry / G5-B3 commerce primitives / G5-B4 commerce views / G5-B5 evaluator onboarding + Stream E) each get their own plan. |
| B | [x] Evaluator persona (2026-04-24) [x] 2 situational (2026-04-24) [ ] 7 JTBDs | Persona + JTBD authoring | Owner ratification closes each sub-item |
| C | [x] Market research (2026-04-24) [x] Paywall spectrum doc (2026-04-24) [ ] Surface specs | Pricing + paywall design | Per-surface at Gate 4; soft-launch readiness at Gate 5 |
| D | [ ] PostHog install [ ] Event schema v1 [ ] Persona-inference dashboard [ ] 30/60/90-day data accumulation | Telemetry foundation | Install gated by Q8 verdict; analysis cadence independent |
| E | [ ] Founding-member outreach [ ] Soft launch [ ] 30-day review [ ] Tier decision memo | Soft launch + pricing validation | Gated by Stream C + Stream D Phase 1 |

---

## Stream A — Design lifecycle gates <- CURRENT STREAM

### Completed (Session 1 — 2026-04-24)

- **Gate 1 (Entry)** — inline in this charter. Verdict: **YELLOW**. Triggered Gate 2 per LIFECYCLE.md.
- **Session 1 roundtable output** — 8-voice panel (P-STRAT / PRICE / POKER-BIZ / GROWTH / TELEM / UX-RES / BEHAV / DEVIL) surfaced in main chat transcript; 3 tier candidates + assumption ledger + telemetry plan.
- **Market research** — competitive pricing data captured at `docs/projects/monetization-and-pmf/market-research.md`.
- **Paywall spectrum** — full design-option space at `docs/projects/monetization-and-pmf/paywall-spectrum.md`.
- **Evaluator persona class** — 1 core + 2 situational personas authored in `docs/design/personas/`.

### Next: Gate 2 (Blind-Spot Roundtable)

Per `ROUNDTABLES.md` 5-stage template. Scope:
- Stage A — *does the Evaluator persona actually cover all prospective-buyer cognitive shapes, or are there sub-types we missed?* (e.g., Chris-shape evaluator vs. Scholar-shape evaluator vs. online-grinder evaluator)
- Stage B — *are SA-71..75 + CC-88 + ON-88 exhaustive for evaluator JTBDs, or do we need a billing-management domain split from SA-*?*
- Stage C — *situational stress on trial-first-session + returning-evaluator against mid-hand-chris-at-trial (do you trial the app at a table?) and post-session-chris-at-trial cases.*
- Stage D — *cross-product — Ignition sidebar commercial lane ripples; does the main-app paywall contaminate sidebar UX if an Ignition user hasn't paid for main-app?*
- Stage E — *heuristic pre-check against N-10, PLT, ML of the paywall-spectrum candidates (A/B/C); particular attention to H-N03 (undo), H-N05 (error prevention on cancellation), H-PLT06 (misclick absorption) at upgrade-CTA.*

### Then: Gate 3 (Research + Owner Interview + JTBD Authoring)

Per questions Q1–Q8 above. Output:
- `gate3-owner-interview.md` — verdicts + rationale for Q1–Q8.
- 7 JTBDs authored in `docs/design/jtbd/domains/subscription-account.md` + `cross-cutting.md` + `onboarding.md` + ATLAS update.
- Persona ratification sign-off noted in Change log of each persona file.
- Gate 2 re-run verdict GREEN.

### Then: Gate 4 (Design spec)

Per Q1 verdict:
- `surfaces/pricing-page.md`
- `surfaces/paywall-modal.md`
- `surfaces/upgrade-prompt-inline.md`
- `surfaces/trial-state-indicator.md`
- `surfaces/billing-settings.md` (or extension of `settings-view.md`)
- `journeys/evaluator-onboarding.md`
- `journeys/paywall-hit.md`
- `journeys/cancellation.md`
- Red-line compliance assertion lists inline on each surface/journey.

### Then: Gate 5 (Implementation)

Per Streams C / D / E.

---

## Stream B — Persona + JTBD authoring

### Completed (Session 1 — 2026-04-24)

- **Evaluator core persona** at `docs/design/personas/core/evaluator.md` — PROTO status, owner ratification pending.
- **Trial-first-session** situational at `docs/design/personas/situational/trial-first-session.md` — PROTO.
- **Returning-evaluator** situational at `docs/design/personas/situational/returning-evaluator.md` — PROTO.

### Remaining

- **7 JTBDs** — SA-71..75 + CC-88 + ON-88 authoring. Gate 3 scope.
- **Owner ratification** of all 3 personas — Gate 3 closing ceremony.
- **ATLAS update** — JTBD range additions + change-log entry.
- **Persona amendments** — if Gate 2 surfaces a Chris-shape-evaluator vs. Scholar-shape-evaluator split, author the subtype in Gate 3.

---

## Stream C — Pricing + paywall design

### Completed (Session 1 — 2026-04-24)

- **Market research** at `docs/projects/monetization-and-pmf/market-research.md` — competitive pricing landscape + analytics tooling comparison + sources.
- **Paywall spectrum design doc** at `docs/projects/monetization-and-pmf/paywall-spectrum.md` — full option matrix: messaging × trial length × paywall location × limited-use patterns × CTA copy × doctrine compliance.

### Remaining

- Gate 4 surface specs (6 surfaces + 3 journeys per above list).
- `assumption-ledger.md` — 10–15 load-bearing assumptions with kill-criteria (seeded from Session 1 roundtable M1–M8 list; expand + formalize in Gate 3).
- Pricing page copy draft (Gate 4 — post-doctrine-scope verdict).
- Cancellation flow journey (Gate 4 — explicit anti-dark-pattern enforcement).

---

## Stream D — Telemetry foundation

### Not started

Gate 3 verdict on Q8 required before ship.

### Phase 1 — Install + schema

- Install `posthog-js` into `src/main.jsx` or equivalent entry point.
- Apply for PostHog-for-Startups credit ($50K).
- Define event schema v1 in `src/constants/telemetryEvents.js` (new).
- Instrument 3 layers per Session 1 roundtable:
  1. Screen time + navigation graph (`view_entered`, `view_exited`, `time_on_view_ms`, `prev_view`).
  2. Action-level events (every `ACTIONS` enum value + destructive actions + undo sequences).
  3. Feature touch events (exploit engine open/close, drill started/abandoned, replay opened, villain profile viewed).

### Phase 2 — Persona-inference dashboard

- Cluster active users by behavioral signature per Session 1 plan: Chris-shape, Scholar-shape, Hybrid-shape, Unknown.
- Dashboard cadence: daily auto-snapshot + weekly review.

### Phase 3 — Frustration-detection

- Rage-click detection (3+ clicks on same element <2s).
- Form-abandonment (event: entered, not completed, time-in-form).
- Repeated view opens (same view twice in 60s).
- Session replay auto-flag for 95th-percentile-frustration sessions.

### Phase 4 — Assumption ledger validation

- Each assumption in `assumption-ledger.md` has a specific event + threshold that validates or kills it.
- Weekly review cadence; monthly kill-or-keep decision.

### Phase 5 — PMF signal

- Retention curves (day-1, day-7, day-30 by cohort).
- Feature-adoption curves per tier candidate.
- WTP signal from founding-member conversion + upgrade-prompt-dismissal rate.

---

## Stream E — Founding-member soft launch

### Blocked by

Stream C (surface specs for trial-first-session + paywall-modal at minimum) + Stream D Phase 1 (telemetry must be live before first paid user to collect behavioral data).

### Phase 1 — Readiness

- Founding-member pricing candidate selected (Q4 verdict).
- Pricing page (Gate 4 surface) shipped.
- Payment processor integrated (Stripe recommended; decision deferred to Gate 5).
- Entitlement state in reducer + IDB migration.

### Phase 2 — Outreach

- Channel list (Reddit r/poker, Twitter poker community, personal network, any YouTube/Twitch creator relationships).
- Outreach script.
- Target: 20 founding members within 30 days of readiness.

### Phase 3 — 30-day review

- Conversion funnel analysis.
- Retention cohort (all 20 still paying? churning at what step?).
- WTP signal from upgrade-to-Pro conversion if tiers above founding-member are live.
- **Go/no-go on full commercial launch.**

---

## Phases

| Phase | Stream | Description | Accept Criteria |
|-------|--------|-------------|-----------------|
| 1 | A + B + C | Gate 1 + 3 personas + market research + paywall-spectrum (Session 1) | **DONE 2026-04-24** |
| 2 | A | Gate 2 — blind-spot roundtable (5 stages) | Audit doc with verdict GREEN/YELLOW/RED; follow-ups enumerated |
| 3 | A + B | Gate 3 — 7 JTBDs authored + owner interview Q1–Q8 + persona ratification + Gate 2 re-run GREEN | Each JTBD shipped; each Q verdicted; personas change-log updated |
| 4 | A + C | Gate 4 — 6 surfaces + 3 journeys + assumption ledger + red-line compliance per Q1 verdict | Each surface artifact exists before code; each has red-line assertions inline |
| 5 | D | Telemetry Phase 1 — PostHog installed + event schema v1 + 3-layer instrumentation | Events flowing; persona-inference dashboard renders |
| 6 | D | Telemetry Phase 2 — persona-inference dashboard + frustration-detection | Dashboards functional; first 30-day usage snapshot reviewed |
| 7 | C + E | Founding-member soft launch (pricing + entitlement + payment) | 20 founding members paying; 30-day cohort alive |
| 8 | D | Telemetry Phase 3 + assumption-ledger validation | 10–15 assumptions kill-or-keep; pricing candidate locked or revised |
| 9 | E | Full-tier commercial launch | 3-tier ladder live (Candidate A or revised); Ignition SKU per Q3 verdict |
| 10 | — | Closeout | Acceptance criteria verified; MEMORY.md entry; STATUS.md reflects monetization-live |

Phases 5–8 are partially parallelizable. Stream D can begin the moment Q8 is verdicted; does not wait on Gate 4.

---

## Files This Project Touches

### New artifacts (Session 1 — 2026-04-24)
- `docs/projects/monetization-and-pmf.project.md` (this file)
- `docs/projects/monetization-and-pmf/market-research.md`
- `docs/projects/monetization-and-pmf/paywall-spectrum.md`
- `docs/design/personas/core/evaluator.md`
- `docs/design/personas/situational/trial-first-session.md`
- `docs/design/personas/situational/returning-evaluator.md`
- `.claude/handoffs/monetization-and-pmf-session1.md`

### New artifacts (Gate 2 — planned)
- `docs/design/audits/YYYY-MM-DD-blindspot-monetization-and-pmf.md`

### New artifacts (Gate 3 — planned)
- `docs/projects/monetization-and-pmf/gate3-owner-interview.md`
- `docs/projects/monetization-and-pmf/assumption-ledger.md`
- 7 JTBDs added to existing domain files (`subscription-account.md`, `cross-cutting.md`, `onboarding.md`) + ATLAS.
- `docs/design/audits/YYYY-MM-DD-blindspot-monetization-and-pmf-rerun.md` (if Gate 2 YELLOW/RED)

### New artifacts (Gate 4 — planned)
- `docs/design/surfaces/pricing-page.md`
- `docs/design/surfaces/paywall-modal.md`
- `docs/design/surfaces/upgrade-prompt-inline.md`
- `docs/design/surfaces/trial-state-indicator.md`
- `docs/design/surfaces/billing-settings.md` (or `settings-view.md` extension)
- `docs/design/journeys/evaluator-onboarding.md`
- `docs/design/journeys/paywall-hit.md`
- `docs/design/journeys/cancellation.md`

### Code (Gate 5 — planned)
- `src/constants/telemetryEvents.js` (new) — event schema.
- `src/utils/telemetry/` (new) — PostHog wrapper + event helpers.
- `src/reducers/entitlementReducer.js` (new) — tier state + trial state.
- `src/contexts/EntitlementContext.jsx` (new).
- `src/hooks/useEntitlement.js` (new).
- `src/utils/persistence/database.js` — v18 → v19 migration (additive `subscription` store).
- `src/components/views/PricingView/` (new).
- `src/components/views/BillingSettingsSection/` (new or extension).
- Embeds threaded into: any view gating a paid feature — `PaywallGate.jsx` shared component.
- `ignition-poker-tracker/` — if Q3 = B, separate commercial lane wiring.

---

## Session Log

| Date | Session | Stream | Work Done |
|------|---------|--------|-----------|
| 2026-04-24 | Claude (main) S1 | A + B + C | Charter authored with Gate 1 inline (YELLOW); 8-voice roundtable output in main chat; market research doc; paywall spectrum doc; Evaluator core persona + 2 situational personas (PROTO); handoff. Zero code. Owner-to-ratify personas + verdict Q1–Q8 at Gate 3. |
| 2026-04-24 | Claude (main) S2 | A | Gate 2 blind-spot roundtable shipped. 3 voices authored (Product/UX + Autonomy skeptic + Market lens). Master audit at `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md`. Verdict YELLOW; 3 structural risks; 10 commerce red lines; 12 anti-patterns; 10 Gate 3 items; 21 Gate 4 items; 9 Gate 5 items. Expanded scope: 10 JTBDs (not 7) + 10 owner-interview questions (Q1–Q10 added Q9 domain-split + Q10 ignition-mode situational). Key surfaced: Q7 legal/ToS blocks Ignition lane; dark-pattern cancellation is highest-risk surface; Evaluator persona ratification is structural-only until Stream D telemetry lands. BACKLOG expanded with MPMF-* section. Charter Stream A `G2 [x]`. Zero code. Handoff: `.claude/handoffs/monetization-and-pmf-session2.md`. |
| 2026-04-24 | Claude (main) S3a | A + B | **Gate 3 Mode B (JTBD authoring) shipped, Claude-solo.** 10 JTBDs authored across 3 domain files: SA-71..78 in `docs/design/jtbd/domains/subscription-account.md` (range bumped SA-64..70 → SA-64..78) + CC-88 in `cross-cutting.md` (telemetry-transparency cross-project pattern; inherits red line #9) + ON-88 in `onboarding.md` (distinct from ON-84 skip-tutorials and ON-87 seed-adaptive-skill; range bumped ON-82..87 → ON-82..88). Each JTBD authored at full detail per EAL DS-57..59 + PRF CC-82/83 exemplars — trigger-situation "When…" framing, autonomy-constraint inheritance lines, mechanism description, served-by-surface list, distinct-from-siblings paragraph, doctrine-basis line. ATLAS.md updated: domain-index row ranges bumped; 10 new JTBD table rows added; change-log entry. BACKLOG: 10 MPMF-G3-J* rows marked COMPLETE. Charter Session Log + Decisions Log entries. Zero code. **Remaining Gate 3 work (owner-attended Session 3b):** Q1–Q10 owner interview verdicts; 3 persona ratification (PROTO → Owner-Confirmed); optional `evaluator-ignition-mode.md` situational authoring (conditional on Q10); Gate 2 re-run (conditional); Q7 legal-scoping session separate scheduling. Handoff: `.claude/handoffs/monetization-and-pmf-session3a.md`. |
| 2026-04-25 | Claude (main) S9-G5-B1 | A + Gate 5 | **Gate 5 Batch 1 SHIPPED — Entitlement Foundation (FIRST CODE on the project).** Pure local-only state plumbing per approved plan; no Stripe / no PostHog / no UI components yet. Subsequent G5 batches re-planned separately with B1 lessons. **9 new files + 5 amended files + 108 new tests; zero regressions; clean build.** (1) **`src/test/setup.js`** — wired `fake-indexeddb/auto` (prerequisite — every IDB test from now on uses in-memory implementation under jsdom). (2) **`src/constants/entitlementConstants.js`** — frozen ENTITLEMENT_ACTIONS (10 types) + initialEntitlementState + ENTITLEMENT_STATE_SCHEMA + TIERS / COHORTS / BILLING_CYCLES enums + GUEST_USER_ID re-export + FOUNDING_MEMBER_CAP=50 + SUBSCRIPTION_STORE_NAME. (3) **`src/utils/entitlement/featureMap.js`** — frozen FEATURE_TIER (12 features mapped Free/Plus/Pro/Ignition) + TIER_ORDER (founding-lifetime feature-equivalent to pro at level 2; ignition separate lane at 99) + isAtLeast / hasAccessTo / resolveEffectiveTier helpers. (4) **`src/reducers/entitlementReducer.js`** — pure raw reducer + createValidatedReducer wrapper mirroring playerReducer; 10 actions covering hydration, upgrade, plan-change-recorded, cancellation lifecycle, pending-plan-change, card-decline grace, dev override; spread-based immutability; cancellation supersedes pending plan-change per Gate 4 known-behavior; fresh upgrade clears stale grace state. (5) **`src/contexts/EntitlementContext.jsx`** — Provider receives state+dispatch as props (composed in PokerTracker AppRoot via useAppState); exposes raw state + effectiveTier (respects dev override) + isReady (from persistence) + 5 semantic helpers (isAtLeast / hasAccessTo / isCancellationGrace / isPendingPlanChange / isCardDeclineGrace) + raw dispatchEntitlement; useMemo with full deps; useEntitlement hook throws helpful error outside provider. (6) **`src/hooks/useEntitlementPersistence.js`** — receives state+dispatch as params; hydrates from IDB on mount via getSubscription → ENTITLEMENT_HYDRATED dispatch; debounced 400ms writes on state change via putSubscription; pre-hydration write guard prevents overwriting existing IDB record with defaults; graceful degradation on hydration failure. (7) **`src/utils/persistence/subscriptionStore.js`** — getSubscription / putSubscription / deleteSubscription IDB primitives keyed on userId. (8) **Migration v17→v18** — `migrateV18` in migrations.js creates subscription store (keyPath: userId, no autoIncrement, no indexes) + seeds guest record `{ userId: GUEST_USER_ID, tier: 'free', cohort: 'standard', schemaVersion: '1.0.0', ... }` atomically with store creation; idempotent existence-check. **DB_VERSION bumped 17→18.** Per EAL gate4-p3-decisions §2 dynamic-target rule, MPMF claimed v18 first (PRF G5-CI hadn't shipped IDB; EAL Stream D not yet started; SLS not started). (9) **AppRoot wiring** — useAppState.js composes useReducer(entitlementReducer); AppProviders.jsx mounts `<EntitlementProvider>` between AuthProvider and GameProvider; PokerTracker.jsx threads entitlementState + dispatchEntitlement through AppProviders props; contexts/index.js re-exports EntitlementProvider + useEntitlement. **Test breakdown: 28 featureMap + 40 reducer + 16 subscription store + 18 context + 6 persistence hook = 108 tests, all green.** Database test (`creates all 11 object stores`) updated to expect 12 (subscription added). Smart-test-runner: 7643/7644 — 1 pre-existing precisionAudit flake in drillContent (unchanged, documented 13× in STATUS.md). `npm run build` clean (10.39s; PWA 1665.75 KiB; 54 precache entries). **Gate 5 functional surface unchanged for users:** no PaywallGate yet so no tier gating fires; free-tier users see no behavioral change; paid-tier code paths reachable only via DEV_OVERRIDE_TIER action. Charter Stream A flipped `G5 [~] IN PROGRESS`. BACKLOG: 1 MPMF-G5-* row updated to COMPLETE (G5-ER entitlement reducer + context + hook). **Next plan:** G5-B2 Telemetry Foundation (PostHog install + consentGate + first-launch panel + Settings telemetry mirror). Handoff: `.claude/handoffs/monetization-and-pmf-session9-g5-b1.md`. |
| 2026-04-25 | Claude (main) S8-B5 | A + C | **Gate 4 CLOSED — Batch 5 SHIPPED (final 2 surfaces + closeout).** All 16 of 16 Gate 4 carry-forwards COMPLETE. Per approved plan §Batch 5 — "Billing-settings + trial-state-indicator + Gate 4 closeout." (1) **MPMF-G4-S5 `docs/design/surfaces/billing-settings.md`** (~750 lines) — SettingsView extension. **LOAD-BEARING for red lines #2 (transparency on demand) + #10 (no dark-pattern cancellation).** 4-card layout (PlanCard / PaymentMethodCard / NextBillCard / Actions section) with **4 tier-state variants:** paid-active (full panel) / cancelled-grace (Reactivate replaces Change-plan; Payment+Next-charge hidden; only Export-data action) / free (minimal: View-plans + Export-data only) / founding-lifetime (no Change-plan; card-on-file kept-for-records-only with Remove-card affordance; Cancel routes to Variation B with non-refundable disclosure). Cross-surface entry point for cancellation journey J3 (Cancel button) + plan-change journey J4 (Change-plan button) + payment-method-update (routes to Stripe Customer Portal external). **Equal-weight action buttons** (Cancel NOT visually de-emphasized OR emphasized — refuses both anti-patterns). PendingPlanChangeIndicator inline (referenced from J4) with single-tap [Cancel pending change] reversal action — no confirmation modal needed (reversal is itself reverse action). CardDeclineGraceIndicator with subtle ⚠️ icon (no animation / no countdown / no urgency). Last-billing-event factual receipt-summary footer. **Reactivate Pro** symmetric ≤2-tap reverse of cancellation. 10 red-line compliance + Phase 5 code-path plan ~9 new files. (2) **MPMF-G4-S4 `docs/design/surfaces/trial-state-indicator.md`** (~470 lines) — persistent chip in main-nav region. Simplest commerce surface but **LOAD-BEARING for 3 heuristics + 2 red lines:** H-PLT01 (≤150ms glanceable), H-SC02 (≤2-tap to BillingSettings — canonical destination), H-SC01 (mid-hand 60% opacity + deferred routing); red lines #2 (always visible) + #8 (no cross-surface contamination — adapts not removes). 7 variant states (Free / Plus / Pro / Lifetime / "{tier} · Cancelling" / "{tier} ⚠️" card-decline / multi-state). Tap routing: Free → pricing-page (S1); paid → BillingSettings (S5) with hash anchor; card-decline → BillingSettings#payment-method direct-scroll. NO animations / NO badge counters / NO red color treatment / NO streak framing / NO first-launch coachmark — chip just appears and is glanceable. **Mid-hand behavior:** 60% opacity + tappable + deferred routing (queue intent + neutral toast "Tier info opens at hand-end"; route fires post-hand). 10 red-line compliance + Phase 5 code-path plan ~3 new files. (3) **CATALOG.md gained 2 entries** (billing-settings as inline widget within SettingsView + trial-state-indicator as inline widget in main-nav). **Stream A flipped `G4 [x]` (Gate 4 CLOSED).** All 16 Gate 4 carry-forwards COMPLETE — see breakdown: doctrine + foundation (B1: 6 items ACP/W/HT/AL/EA/ES) + foundation-remainder (B2: 2 items S6/J1) + journeys (B3: 3 items J2/J3/J4) + paywall surfaces (B4: 3 items S1/S2/S3) + billing surfaces + closeout (B5: 2 items S4/S5). **Anti-patterns final state:** 16 refusals (12 stub at S3b + AP-13/14 at B2 + AP-15/16 at B3 — none added in B4 or B5; expected since B4/B5 surfaces consumed established patterns rather than surfacing new ones). **Cross-surface architectural complete invariant:** all entry points + all journeys + all surfaces ratified. **Gate 5 fully unblocked** — Phase 5 implementation can proceed: entitlement reducer + EntitlementContext + IDB v19 migration + Stripe integration + 7 ui components (PaywallGate / PaywallModal / PaywallFallbackInline / UpgradePromptInline / TrialStateIndicator / CancellationConfirmModal / PlanSelectModal+PlanChangeConfirmModal / ReactivationConfirmModal) + 5 view components (PricingView + BillingSettings/* + FirstLaunchTelemetryPanel + EvaluatorOnboardingPicker + variation flows) + 8 hooks (useEntitlement / usePaywallCooldown / useDeferredPaywall / useUpgradePromptVisibility / useTrialStateIndicator / useBillingSettings / useTelemetryConsent / useFounderCapStatus) + 6 CI-linted copy generators (cancellationCopy / paywallCopy / planChangeCopy / pricingCopy / upgradePromptCopy / billingCopy / indicatorCopy) + scripts/check-commerce-copy.sh consolidated CI-lint script. **Stream D Phase 1 (PostHog install)** still independently unblocked. **Stream E Phase 1 (founding-member outreach)** unblocked since pricing-page surface ships. Charter Decisions Log gained 5 final entries (BillingSettings 4 tier-state variants / Cancel button equal-weight refuses both visual-emphasis-and-de-emphasis / Reactivate-Pro ≤2-tap symmetric reverse / Trial-state-indicator mid-hand 60%-opacity-not-removed / Indicator chip-routing-by-tier-state — Free→pricing Paid→billing). BACKLOG: 2 MPMF-G4-* rows flipped COMPLETE (S4 + S5); Stream A G4 status updated. Zero code. Zero test regressions. Handoff: `.claude/handoffs/monetization-and-pmf-session8-batch5-G4-CLOSED.md`. **NEXT PLAN: Gate 5 implementation** (per plan §"What comes after this plan" — entitlement reducer + Stripe + PaywallGate + BillingSettings + PostHog install + Stream E founding-member outreach kickoff). |
| 2026-04-25 | Claude (main) S7-B4 | A + C | **Gate 4 Batch 4 SHIPPED — 3 paywall surfaces (14 of 16 carry-forwards complete).** Per approved plan §Batch 4 — "Paywall surfaces: pricing-page + paywall-modal + upgrade-prompt-inline as user-facing commerce shared-tone batch." (1) **MPMF-G4-S1 `docs/design/surfaces/pricing-page.md`** (~570 lines) — most-complex Gate 4 surface. Top-level routed view at `SCREEN.PRICING`. 4 TierCards rendering at equal visual weight (NO "Most Popular" badges per MPMF-AP-02 + red line #6 load-bearing): Free $0 / Plus $17/mo $179/yr / Pro $29/mo $299/yr / Founding-Lifetime $299 once cap-50. **Pricing-tentative banner** persistent ("These prices are tentative for the launch cohort. Final pricing locks after our first 60 days of telemetry.") per plan §P4 risk + assumption M4/M9 dependency. FeatureComparisonTable expander (14 features × 4 tiers grid). **FoundingMemberSection** with factual cap-remaining count from `useFounderCapStatus()` hook (≤5min cache; server-authoritative via I-WR-4) + "transactional cap, not a timer" explicit anti-AP-01 disclosure + non-refundable disclosure inline + cap-filled-state UI ("Cap reached. Founding-Lifetime is no longer available."). 7-entry **PricingFAQ accordion** (cancel-anytime / data-on-downgrade / Founding-Lifetime explained / Ignition-sidebar Phase-2+ deferred-with-no-email-capture / telemetry-opt-out / no-paid-trial Free-tier-IS-trial / how-to-switch-tiers). **Sub-shape tailoring** invisible-to-user (gentle feature-list reordering per E-CHRIS / E-SCHOLAR / E-IGNITION attribute; never gates content; never shows "We see you're a..." copy). **Footer doctrine line "No streaks. No guilt. Cancel in two taps."** — M1 marketing wedge as explicit pricing-page footer. Cap-remaining race-condition handled (server-side I-WR-4 enforces hard cap; UI best-effort display). Cancelled-user-in-90-day-cooldown sees content but NO proactive re-subscribe nudges (red line #3). 10 red-line compliance + Phase 5 code-path plan ~10 new files + 6 Playwright evidence placeholders. (2) **MPMF-G4-S2 `docs/design/surfaces/paywall-modal.md`** (~480 lines) — detailed surface spec referenced by paywall-hit journey J2. **PaywallModal** shared across Variations A (history-access) + B (usage-threshold) + D (session-close → next-open). **2 buttons at equal visual weight** ([View plans] + [Keep free]) — CSS measurement test target MPMF-G5-RL #6 LOAD-BEARING (same width/height/padding/font-weight; equal visual treatment). NO "Maybe later" button. NO countdown / urgency / scarcity. NO pre-selection. **PaywallFallbackInline** for Variation C (depth-of-analysis surfaces; navigation is deliberate so inline-with-static-preview rather than blocking modal). **PaywallGate component** orchestrator: feature-access check → cooldown check → H-SC01 isHandInProgress() check → fallback render. **useDeferredPaywall** hook for H-SC01 mid-hand mechanism: register on mid-hand trigger; subscribe to handEnded reducer event; pop deferred queue post-hand; deferred-modals-don't-stack rule. **usePaywallCooldown** hook for H-N07 per-(surface×trigger×user×device) 7-day cooldown. Cross-surface: backdrop-tap does NOT dismiss (prevents accidental dismissal during reach-for-✕). 5 telemetry events (paywall_shown / paywall_dismissed / paywall_view_plans_clicked / paywall_deferred_to_hand_end / paywall_cooldown_blocked) all consent-gated. Test target MPMF-G5-SC explicit. Phase 5 code-path plan ~7 new files. (3) **MPMF-G4-S3 `docs/design/surfaces/upgrade-prompt-inline.md`** (~440 lines) — proactive counterpart to PaywallModal's reactive trigger. Inline widget embedded across **5 host contexts**: session-recap (post-cashout) + post-hand-review (HandReplayView ReviewPanel) + settings-billing (expanded variant) + session-list-row (compact "Plus required" badge) + drills-list (Scholar context). **Compact + Expanded variants** (settings-billing is the only expanded). **Sub-shape-tailored copy** invisible-to-user (E-CHRIS sees live-tracking copy; E-SCHOLAR sees drills copy; E-IGNITION sees online-sidebar-Phase-2 placeholder; default no-sub-shape). **H-N07 cooldown per (host context × user × device)** 7-day. **6 suppression rules:** mid-hand H-SC01 / presession-preparer / returning-evaluator-2h-window / newcomer-threshold (<25 hands) / paid-tier (entitlement check returns null component) / cooldown active. **Inline-prompt-specific anti-patterns refused:** pulsing/blinking animation / auto-scroll-to-bring-into-view / confirm-dismissal sub-prompt / re-rendering at different position after dismissal. 4 telemetry events including `upgrade_prompt_suppressed` with reason — useful for assumption M6 doctrine-as-positioning-wedge validation. 10 red-line compliance + Phase 5 code-path plan ~4 new files + 5 host-surface integrations. (4) **CATALOG.md gained 3 entries** (pricing-page top-level view + paywall-modal inline widget + upgrade-prompt-inline inline widget). **Cross-surface architectural note ratified:** PaywallModal (S2 reactive) and UpgradePromptInline (S3 proactive) are DISTINCT patterns serving different conversion moments — not interchangeable; not unified-into-one-component; not redirected-to-each-other. Modal blocks; inline lives quietly. Different copy generators (`paywallCopy.js` vs `upgradePromptCopy.js`); different telemetry events; different suppression rules. **Remaining 2 Gate 4 carry-forwards** (per plan B5): trial-state-indicator (S4) + billing-settings (S5) + Gate 4 closeout (Stream A `G4 [x]`). Charter Stream A still `G4 [ ]` until B5. Decisions Log gained 4 entries (pricing-tentative-banner-rationale + pricing-page-not-AB-tested-for-conversion-coercion + paywall-modal-S2-vs-upgrade-prompt-S3-distinct-patterns + cap-remaining-best-effort-server-authoritative). BACKLOG: 3 MPMF-G4-S* rows flipped COMPLETE. Zero code. Zero test regressions. Handoff: `.claude/handoffs/monetization-and-pmf-session7-batch4.md`. |
| 2026-04-24 | Claude (main) S6-B3 | A + C | **Gate 4 Batch 3 SHIPPED — 3 commerce journeys (dark-pattern-free critical path).** 11 of 16 Gate 4 carry-forwards now complete. (1) **MPMF-G4-J3 `journeys/cancellation.md`** (~450 lines) — LOAD-BEARING for red line #10 (no dark-pattern cancellation). 4 variations: A Standard (≤2-tap flow: Cancel button → CancellationConfirmModal → Confirm cancellation button → success toast), B Founding-member lifetime (immediate access-end; no Stripe cancel; non-refundable by design), C Card-decline grace period (offers update-payment-method alongside cancel as alternative — not interposition), D Phase-2+ placeholder for account-deletion path. Shared `CancellationConfirmModal.jsx` with 3 equal-weight buttons (Confirm cancellation / Pause instead / Keep subscription) — NO pre-selection, NO interposition, NO exit-survey-before-confirm. ~20 forbidden-string patterns enumerated (Are-you-sure / Wait / We-miss-you / You'll-lose / Don't-give-up / Downgrade / Step-down / Special-offer-if-you-stay / Limited-time-save / Pause-already-paused-for-you). CI-linted `cancellationCopy.js` deterministic generator plan. Post-cancel ≥90-day no-resubscribe-prompt window per red line #3. W-SUB-3 atomicity (I-WR-3). Test target MPMF-G5-RL explicit. (2) **MPMF-G4-J2 `journeys/paywall-hit.md`** (~430 lines) — 4 variations: A History-access (L4 — most common under Q5=A session-scoped-free), B Usage-threshold (L3 — quota exhaustion with H-SC01 defer-to-hand-end mechanism), C Depth-of-analysis (L6 — inline fallback with static preview rather than modal, since navigation is deliberate), D Session-close → paywall-next-open (Q5=A specific — session recap is free; paywall fires on later re-open not at session-close). Shared PaywallModal contract with 2 equal-weight buttons (View plans / Keep free) — NO "Maybe later", NO countdown, NO urgency. **H-SC01 defer-to-hand-end** structural: `isHandInProgress()` check; mid-hand triggers silently no-op with neutral toast "Feature unlocks at hand-end"; post-hand boundary fires deferred modal. **H-N07 7-day cooldown** per (surface × trigger × user × device); no re-prompting. Test targets include MPMF-G5-SC (H-SC01 specific). (3) **MPMF-G4-J4 `journeys/plan-change.md`** (~420 lines) — SA-76 upgrade + downgrade flows; DISTINCT from J3 cancellation. 3 variations: A Upgrade (immediate with prorated charge shown upfront per MPMF-AP-16 refusal; "Change to Pro" copy, never "Upgrade!" exclamation), B Downgrade (effective at current-billing-period-end with NO refund per industry norm; "Change to Plus" copy, never "Downgrade"; data-preservation assurance explicit), C Lateral Phase-2+ placeholder. PlanSelectModal intermediate step (3-tap flow from BillingSettings acceptable because intermediate is meaningful choice, not friction). PendingPlanChangeIndicator for scheduled-downgrade reversal. Founding-member edge case: plan-change affordance disabled. W-SUB-4 atomicity. CI-linted `planChangeCopy.js` generator plan. (4) **Anti-patterns expanded 14 → 16** — MPMF-AP-15 (silent-plan-change-on-cancellation: pre-selecting pause or switch as default, conflating cancel intent with plan-change, ambiguous single-UI-element submission) + MPMF-AP-16 (deceptive-proration-display: hiding prorated charge, "save $X" framing on downgrade without refund clarification, opaque proration math). (5) **CATALOG.md** gained 3 entries (cancellation + paywall-hit + plan-change journeys). **Cross-journey invariant:** cancellation (J3) / paywall-hit (J2) / plan-change (J4) are 3 distinct journeys with 3 distinct modal components (CancellationConfirmModal / PaywallModal / PlanChangeConfirmModal) and 3 distinct writers (W-SUB-3 cancel / W-SUB-2 payment / W-SUB-4 plan-change). Conflating any two is a dark-pattern anti-pattern (MPMF-AP-15). **Remaining 5 Gate 4 carry-forwards** (per plan B4/B5): 5 surfaces (pricing-page + paywall-modal + upgrade-prompt-inline + trial-state-indicator + billing-settings) + closeout. Charter Stream A remains `G4 [ ]` until B5 closeout. Decisions Log gained 5 entries. BACKLOG: 3 MPMF-G4-J* rows flipped COMPLETE. Zero code. Zero test regressions. Handoff: `.claude/handoffs/monetization-and-pmf-session6-batch3.md`. |
| 2026-04-24 | Claude (main) S5-B2 | A + C | **Gate 4 Batch 2 SHIPPED — foundation-remainder (unblocks Stream D Phase 1 + partial Stream E).** 8 of 16 Gate 4 carry-forwards now complete. 2 artifacts + anti-patterns expansion. (1) **MPMF-G4-S6** — `docs/design/surfaces/telemetry-consent-panel.md` (~330 lines) — first-launch modal variant (Q8=B default-on with always-visible per-category off-switch) + Settings mirror variant (`SettingsView/TelemetrySection.jsx`) + 4 categories (usage-events / session-replay / error-tracking / feature-flags) + consent-gate pattern (structural: `emitEvent` wraps PostHog; events dropped at source if category opted-out) + "NEVER collected" explicit disclosure (no PII, no hand content, no dollar amounts, no villain-profile text, no passwords) + 10 red-line compliance assertion list with per-line Gate 5 test target + extension read-only inheritance via WebSocket bridge (MPMF-P8-EX) + Phase 5 code-path plan (~8 new files). **First-launch panel fires BEFORE telemetry events emit** — structural guarantee for red line #1. (2) **MPMF-G4-J1** — `docs/design/journeys/evaluator-onboarding.md` (~340 lines) — 5 variations: Variation A (Full tour 3min/7 steps with Skip at every step — ON-82), Variation B (Fast orientation 60sec/4-point overlay + E-CHRIS/E-SCHOLAR/E-IGNITION sub-shape picker writing `settings.onboarding.evaluatorSubShape` — ON-88), Variation C (Skip — ON-84), Variation D (At-table degraded auto-detect — suppress all overlays when active session detected; Pokeri precedent), Variation E (Returning-evaluator resume — 2+ day gap triggers ResumeOrFreshModal with factual copy "Welcome back. Your last session: N hands, X days ago"). Picker UI 3-card equal-weight + copy-discipline forbidden-string list + telemetry events per variation (Stream D M13+M14 kill-criteria) + Phase 5 code-path plan (~7 new files). (3) **Anti-patterns expansion:** MPMF-AP-13 (telemetry-consent-nag — re-prompting opt-outs, consent-update-badges, new-categories-inheriting-prior-consent refused) + MPMF-AP-14 (onboarding-lock-in — forced tutorials, hidden Skip, progress-bar pressure refused). Anti-patterns.md now at 14 refusals (up from 12 at S3b stub). (4) **CATALOG.md** gained 2 entries: `telemetry-consent-panel` as top-level view + `evaluator-onboarding` as journey. **Unblocks:** Stream D Phase 1 (PostHog install) now has first-launch UX spec + consent-gate contract — can begin immediately in next plan. Stream E Phase 1 still blocked on MPMF-G4-S1 pricing-page but evaluator-onboarding informs outreach messaging. **Remaining 8 Gate 4 carry-forwards:** MPMF-G4-S1..S5 surfaces + MPMF-G4-J2/J3/J4 journeys + MPMF-G4-AP further expansion. Charter Stream A remains `G4 [ ]` until B5 closeout. Decisions Log gained 3 entries. BACKLOG: 2 MPMF-G4-* rows flipped COMPLETE. Zero code. Zero test regressions. Handoff: `.claude/handoffs/monetization-and-pmf-session5-batch2.md`. |
| 2026-04-24 | Claude (main) S4-B1 | A + C | **Gate 4 Batch 1 SHIPPED — doctrine + foundation artifacts.** 6 of 16 Gate 4 carry-forwards complete (mirrors EAL S3 precedent of doctrine-first batch). (1) **MPMF-G4-ACP** — charter §Acceptance Criteria expanded inline with 10 commerce red lines + per-line MPMF-AP-* refusal cross-refs + test-target pointers + graded-work-trap refusal + live-surface-footprint-minimal + IDB-additive-only + entitlement-architecture-pointer. Replaces the bare placeholder from Session 1. Every Gate 4 surface spec can now reference red lines by number. (2) **MPMF-G4-W** — `docs/projects/monetization-and-pmf/WRITERS.md` with 5 writers (migration-seed W-SUB-1 / payment-success W-SUB-2 / cancellation W-SUB-3 / plan-change W-SUB-4 / dev-override W-SUB-5) + 5 cross-store invariants (registry-completeness / authored-vs-evidence / cancellation-atomicity / founding-cap-enforcement / schema-version-on-write) + CI-grep enforcement sketch mirroring EAL pattern. (3) **MPMF-G4-HT** — `docs/design/heuristics/poker-live-table.md` extended with new H-SC (session-continuity) category: H-SC01 paywall-never-interrupts-active-work (mid-hand quota-exhaustion defers to hand-end; test target MPMF-G5-SC) + H-SC02 trial-state-legible-outside-settings (≤2 taps from anywhere). First H-SC category heuristics in the framework. (4) **MPMF-G4-AL** — `docs/projects/monetization-and-pmf/assumption-ledger.md` with **15 falsifiable assumptions** (M1–M8 Session 1 roundtable + M9–M12 Gate 2 Market voice + M13–M15 Gate 4 new: first-60-sec-wow + returning-evaluator-conversion + anonymous-first-feasibility). Each assumption has kill-criterion + instrumented PostHog event + soak window + owner lens. Weekly/monthly review cadence at Stream D Phase 4. Stream D Phase 1 event-schema sketch inline (TELEMETRY_EVENTS frozen constant). (5) **MPMF-G4-EA** — `docs/projects/monetization-and-pmf/entitlement-architecture.md` with layered architecture (Stripe → main-app IDB → extension read-only) + EntitlementContext + featureMap + PaywallGate + cross-surface contract for Bundle ε strict-superset + data-flow scenarios (signup / cancel / founding-cap race / extension-offline) + testing strategy + payment-processor selection (Stripe default for Phase 1; Paddle/LemonSqueezy for Phase 2+ Ignition if Q7 requires). Extension doctrine rule MPMF-P8-EX defined. (6) **MPMF-G4-ES** — Bundle ε structural decision documented inline in entitlement-architecture.md; Q3=C deferral acknowledged. **Remaining 10 Gate 4 carry-forwards** (surfaces + journeys + anti-patterns expansion + Ignition-mode) blocked on ACP anchor now unblocked — next session authors surface specs (MPMF-G4-S1..S6) and journeys (MPMF-G4-J1..J4) + expands anti-patterns.md + Ignition-mode remains LATER. Charter Decisions Log gained 6 entries. BACKLOG: 6 MPMF-G4-* rows flipped COMPLETE. Zero code. Zero test regressions. Handoff: `.claude/handoffs/monetization-and-pmf-session4-batch1.md`. |
| 2026-04-24 | Claude (main) S3b | A + B + C | **Gate 3 CLOSED — all 4 modes shipped.** (1) **Mode A — Owner interview:** 10 verdicts captured via AskUserQuestion (4+4+2 batches). **All 10 verdicts on Recommended position.** Full doc at `docs/projects/monetization-and-pmf/gate3-owner-interview.md` — per-Q rationale + Gate 4 implications + carry-forwards. Q1=A (doctrine binds commerce); Q2=B (parallel soft-launch+telemetry); Q3=C (defer Ignition); Q4=A ($299 lifetime cap 50); Q5=A (session-scoped free); Q6=C (defer Scholar fork); Q7=A (schedule legal scoping separately); Q8=B (opt-out telemetry + panel); Q9=A (split billing-management domain); Q10=B (keep Evaluator unified). (2) **Q9=A executed:** new `docs/design/jtbd/domains/billing-management.md` authored with SA-76/77/78 moved from subscription-account.md (IDs preserved for reference persistence; new entries use BM-* prefix). ATLAS gained 16th domain row; SA range now SA-64..75. (3) **Mode C — Persona ratification:** 3 personas (evaluator + trial-first-session + returning-evaluator) ratified PROTO → Owner-Confirmed (structural). Full Verified pending Stream D telemetry 30–60-day window. personas/README.md updated with 16th core + evidence-status row + architecture diagram updated. (4) **Mode D — Gate 2 re-run audit** at `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf-rerun.md` — **verdict GREEN**. All 17 original findings mapped to closure or named Gate 4/5 carry-forward backlog IDs. 3 structural risks downgraded. (5) **MPMF-G3-OOS shipped:** `docs/projects/monetization-and-pmf/anti-patterns.md` stub with 12 refusals (MPMF-AP-01..12) + CI-lint forbidden-string patterns + permitted alternatives + red-line citations. Mirrors EAL anti-patterns.md pattern. (6) Q7 legal-scoping session remains as TODO (separate external-counsel scheduling — not calendared this session). **Gate 4 unblocked for main-app surfaces** (Ignition surfaces remain Phase 2+ deferred per Q3=C + Q7 pending). Charter Stream A `G3 [x]`. BACKLOG: 7 MPMF-G3-* rows flipped COMPLETE (DS, P1, P2, P3, P4, O, OOS, RR); G3-Q7 remains NEXT (legal session pending); downstream MPMF-G4-* rows still BLOCKED-by-G3-* converted to NEXT (unblocked). Decisions Log gained 10 verdict entries + split-execution entry. Zero code. Zero test regressions. Handoff: `.claude/handoffs/monetization-and-pmf-session3b.md`. |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-24 | Formalize monetization as its own project, not a sub-stream of another | Scope spans persona expansion + JTBD authoring + commerce design + telemetry foundation + soft launch — all four are load-bearing and interact. Sub-streaming would fragment the concerns. |
| 2026-04-24 | Gate 1 inline in charter (YELLOW); trigger Gate 2 | Evaluator persona is a structural gap; 7 JTBDs proposed; doctrine scope is ambiguous — more than the 1–2 gap threshold for GREEN. |
| 2026-04-24 | Author 3 personas in Session 1 (Stream B) in parallel with charter | Evaluator persona is load-bearing for the paywall-spectrum doc (Stream C); waiting for Gate 3 to author means Stream C has to reference a placeholder. Parallel authoring + Gate 3 ratification is the cleaner sequence. |
| 2026-04-24 | Paywall spectrum doc ships Session 1 despite Q1 doctrine verdict unresolved | Full option space must be visible for the owner to answer Q1 (doctrine scope). Doc ranks options on BOTH conversion efficiency AND doctrine compliance — owner picks the bundle after verdict. |
| 2026-04-24 | Ignition commercial lane explicitly deferred — Q3 recommended (C) | Main-app monetization is bigger market + more urgent; Ignition onboarding investment compounds better once paid-customer base exists. Q3 remains open for owner. |
| 2026-04-24 | Free-tier candidate recommendation is session-scoped (Q5 = A) | Gates on history depth, hardest to replicate without paying, respects red line #5 (no mid-session usage-cap friction), clearest value amplifier. Q5 remains open for owner. |
| 2026-04-24 | Telemetry tool recommendation: PostHog | 1M events/mo free, session replay included, feature flags included, $50K startup credit available, preferred by industry consensus 2026 for early-stage. Q8 verdict required before install. |
| 2026-04-24 (S2) | Expand JTBD scope from 7 → 10 | Market voice surfaced SA-76 (tier-migration), SA-77 (payment-method-management), SA-78 (renewal-transparency) as implicit JTBDs every SaaS in category has. Gate 3 authors all 10. |
| 2026-04-24 (S2) | Add 10th commerce red line: no-dark-pattern-cancellation | Cancellation is industry's most common monetization integrity failure surface. Dedicated red line (beyond the 9 inherited from skill-gating doctrine) elevates it to non-negotiable at Gate 4 journey spec. |
| 2026-04-24 (S2) | Add 2 project-specific heuristics: H-SC01 + H-SC02 | H-SC01 paywall-never-interrupts-active-work (mid-hand quota-exhaustion defers to hand-end). H-SC02 trial-state-legible-outside-settings (≤2 taps to check tier from anywhere). Both extend the Poker-Live-Table heuristic set. |
| 2026-04-24 (S2) | Q7 legal scoping is blocking for Ignition lane | US grey-market operator creates ToS + payment-processor + marketing-channel risk. Gate 3 must schedule separate legal-scoping session before Stream E (soft launch) includes Ignition SKU. |
| 2026-04-24 (S2) | Evaluator persona stays unified at core level; E-IGNITION possibly situational | Gate 2 Stage A verdict: no core-persona fork required. Sub-shape attributes (E-CHRIS / E-SCHOLAR / E-IGNITION) live in unified `evaluator.md`. Q10 decides whether to author separate `evaluator-ignition-mode.md` situational. |
| 2026-04-24 (S2) | Bundle ε (Ignition) structured as strict-superset of Pro | Ignition SKU includes all Pro features. Avoids cross-product state gaps where user has Ignition-only and main-app surfaces must degrade inconsistently. |
| 2026-04-24 (S2) | Entitlement state: main-app IDB source of truth; extension reads via WebSocket bridge | No independent entitlement state on extension side. Synchronous check on main-app; extension subscribes via existing WebSocket. Mirrors ignition-poker-tracker doctrine pattern. |
| 2026-04-24 (S3a) | 10 JTBDs authored Q9-agnostic (all in subscription-account.md for now) | Q9 (domain-split into billing-management.md) deferred to owner verdict at Session 3b. Authoring all 15 SA-entries in one file is fine for 15 entries; refactor is mechanical if Q9 splits. Avoids premature commitment to a file structure the owner hasn't chosen. |
| 2026-04-24 (S3a) | Each JTBD authored at full-detail level (trigger + autonomy + mechanism + served-by + distinct-from + doctrine-basis) | Precedent: EAL DS-57..59 + PRF CC-82/83. Matches current atlas quality floor. Previous SA-64..70 entries remain terse (legacy from Session 1b seed); not backfilled this session since those are owned by other projects when they reach them. |
| 2026-04-24 (S3a) | CC-88 authored as cross-project pattern, not MPMF-specific | Any future project installing telemetry / session replay / usage tracking inherits the consent-gating + incognito-per-event + off-switch-always-visible pattern. Mirrors CC-82/83 pattern from PRF (cross-project patterns land in cross-cutting.md). |
| 2026-04-24 (S3a) | ON-88 authored with triangular distinction from ON-84 + ON-87 | ON-84 = skip tutorials entirely; ON-87 = seed adaptive skill model; ON-88 = UI-orientation for category-experienced evaluators. All three skippable at first-run; each serves a distinct cognitive state. First-run path offers them at equal visual weight. |
| 2026-04-24 (S3b) | Q1=A — doctrine binds all commerce UX | Autonomy voice advocated forcefully; positioning wedge M1 ("no streaks / no guilt / two-tap cancel") is the product differentiator. Bundle α + δ become Gate 4 authoritative design targets; bundle β disqualified. Conversion cost of doctrine-clean bundle is recoverable via M1 marketing framing. |
| 2026-04-24 (S3b) | Q2=B — parallel soft-launch + telemetry | Decouples PMF validation from pricing validation. Founding-member $299 lifetime + PostHog install ship together. 30-60-day decision window for full-tier launch after data lands. Avoids "framework eats the ship date." |
| 2026-04-24 (S3b) | Q3=C — defer Ignition commercial lane | Main-app monetization is bigger market + cleaner legal posture + established category. Ignition waits for paid-customer base to upsell + Q7 legal scoping + in-app training investment. Bundle ε deferred. |
| 2026-04-24 (S3b) | Q4=A — $299 lifetime cap 50 founding members | Transactional scarcity (factual cap, not coercive timer). Cash injection + evangelist cohort + direct feedback. Accepts permanent LTV cap on those 50 accounts as seeding cost. |
| 2026-04-24 (S3b) | Q5=A — session-scoped free tier | Gates on history depth — hardest to replicate without paying + clearest value amplifier + respects H-SC01 + red line #5 (no mid-session quota friction). Paywall triggers L3/L4 (history/usage) not L1/L7 (first-launch/timer). |
| 2026-04-24 (S3b) | Q6=C — defer Scholar fork pending telemetry | Scholar-shape user existence is hypothetical; no ratification without Stream D 60+ day clustering data. GTO Wizard dominates the Scholar segment — forking without evidence risks cannibalizing a lost market. |
| 2026-04-24 (S3b) | Q7=A — schedule separate legal-scoping session | Ignition grey-market posture creates compounding risk (ToS + payment-processor + marketing-channel). Not mitigable without counsel. Scheduling pending external-counsel coordination; not calendared this session. Phase 1 main-app unblocked meanwhile. |
| 2026-04-24 (S3b) | Q8=B — opt-out telemetry with first-launch transparency panel | Industry-defensible + red-line-#9-compliant (incognito observation structurally available). Opt-in (Q8=A) would result in Evaluator cohort (the most needed data) being least likely to opt in. PostHog install unblocked. |
| 2026-04-24 (S3b) | Q9=A — split into billing-management.md domain | SA-76/77/78 (plan-change + payment-method + renewal-transparency) moved to new domain. ATLAS now 16 domains. IDs preserved (SA-76/77/78 in billing-management.md); new entries use BM-* prefix. Cleaner separation: SA = "getting to paid"; BM = "ongoing subscription state." |
| 2026-04-24 (S3b) | Q10=B — keep Evaluator unified at core; sub-shapes as attributes | No fork of E-CHRIS / E-SCHOLAR / E-IGNITION into separate core personas. Sub-shape attributes documented in `evaluator.md` §Evaluator sub-shapes. Gate 4 first-run journey branches on attribute. Less persona fragmentation. |
| 2026-04-24 (S3b) | Anti-patterns stub shipped with 12 MPMF-AP-* refusals | Each refusal includes forbidden-string patterns for CI-lint + permitted alternatives + red-line citation. Mirrors EAL anti-patterns.md pattern. Gate 4 expands as surface specs reveal additional refusals. CI-linted copy check lands at Gate 5 (MPMF-G5-CL). |
| 2026-04-24 (S4-B1) | Charter §Acceptance Criteria expanded inline (not by external reference) | Alternative (point at persona + anti-patterns.md without inlining) would force future readers to follow two indirections to understand acceptance gates. Inline enumeration makes the charter self-contained for acceptance testing. Mirrors EAL S3 precedent decision. |
| 2026-04-24 (S4-B1) | 5 writers in subscription WRITERS.md (not more, not fewer) | Payment-success-callback + cancellation + plan-change are the 3 user-action writes; migration-seed + dev-override are the 2 system-action writes. Covers all known write paths. Additional future writers (e.g., grace-period-timer writing `tier` back to `free` on `accessThrough` expiration) can be added via amendment; baseline is complete for Gate 4. |
| 2026-04-24 (S4-B1) | H-SC heuristic category added to poker-live-table.md (not separate file) | Commerce UX on live-play surfaces + session-continuity concerns overlap with existing H-PLT category. Single file keeps heuristic resolution simple. Alternative (new `heuristics/session-continuity.md`) adds file count without conceptual value. H-SC distinguished from H-PLT by "only load-bearing when commerce UX is present." |
| 2026-04-24 (S4-B1) | Assumption-ledger 15 assumptions (within 12–15 target) | M1–M8 from Session 1 roundtable + M9–M12 from Gate 2 Market voice + 3 new at Gate 4 (first-60-sec-wow / returning-evaluator-conversion / anonymous-first-feasibility) = exactly 15. Further assumptions added at surface-design stage as new decisions reveal them. Each has kill-criterion + instrumented event; not all are testable at the same time (founding-member assumption M8 not triggered until Stream E launches; Ignition assumption M11 not triggered until Phase 2+). |
| 2026-04-24 (S4-B1) | Entitlement architecture — main-app IDB source-of-truth; extension read-only | Q3=C defers Ignition commercial lane, but architecture must accommodate eventual Phase 2+ Ignition SKU without redesign. Main-app IDB as source-of-truth + extension as read-only consumer via existing WebSocket bridge = zero new infrastructure + clean trust boundary (extension runs in Chrome sandbox; entitlement decisions auditable through main-app). Alternative (extension has own entitlement state) rejected — creates drift risk + redundant Stripe subscription lookups + trust boundary issue. |
| 2026-04-24 (S4-B1) | Payment processor Stripe default for Phase 1 main-app | Phase 1 main-app is a clean legal category (live-poker tracker for in-person play — not gambling-adjacent). Stripe industry-standard + best SDK + supports anonymous-first Checkout (pending M15 engineering verification). Paddle / LemonSqueezy deferred as alternatives for Phase 2+ Ignition SKU pending Q7 legal-scoping verdict. |
| 2026-04-24 (S5-B2) | Consent panel fires BEFORE any telemetry event — structural guarantee | AppRoot mount sequence: `firstLaunchSeen === false` → mount consent panel as FIRST surface → dismiss → events can fire. Consent-gate (`emitEvent`) wraps all PostHog calls; no component has direct `posthog.capture` access. Makes red line #1 (opt-in enrollment) structurally unbypassable. Alternative (consent panel shown alongside onboarding) rejected — would allow events to fire from onboarding telemetry before consent is verdicted. |
| 2026-04-24 (S5-B2) | Variation B sub-shape picker writes persistent state | Sub-shape selection (E-CHRIS / E-SCHOLAR / E-IGNITION) writes `settings.onboarding.evaluatorSubShape` for downstream personalization (upgrade-prompt copy tailoring, etc.). Stored locally, respects red line #9 (user can clear). Alternative (infer sub-shape from usage patterns) rejected — per red line #1, no silent persona inference. Only explicit declaration writes. |
| 2026-04-24 (S5-B2) | Variation D (at-table) is the only auto-detect variation | All other variations (A/B/C/E) are user-initiated through picker or explicit state (returning-evaluator re-entry). At-table auto-detect reduces friction for the specific case where a user installed earlier and is now at a table — blocking with onboarding is worse than degraded first-experience (Pokeri precedent). |
| 2026-04-24 (S6-B3) | Cancellation / paywall-hit / plan-change are 3 DISTINCT journeys with distinct modals + writers | Conflating any two is the anti-pattern this project most strongly refuses (MPMF-AP-15 now enumerated). CancellationConfirmModal + PaywallModal + PlanChangeConfirmModal are 3 separate components; W-SUB-3 cancel + W-SUB-2 payment-success + W-SUB-4 plan-change are 3 separate writers; `cancellationCopy.js` + `paywallCopy.js` + `planChangeCopy.js` are 3 separate CI-linted generators. Each journey cites distinction-from-siblings explicitly. |
| 2026-04-24 (S6-B3) | "Pause instead" is offered, not interposed | In CancellationConfirmModal, Pause is the middle button of 3 at equal visual weight; NEVER pre-selected, NEVER has color/size boost. Violates Q1=A doctrine to interpose pause between user's cancel tap and actual cancellation — refused via MPMF-AP-05 + reinforced via MPMF-AP-15. |
| 2026-04-24 (S6-B3) | Downgrade uses "Change to [tier]" copy, never "Downgrade" | MPMF-AP-06 binding. Status-ladder language (downgrade / step-down / reduce) refused across plan-change surface. Factual verb "Change" applies to both upgrade and downgrade directions. `planChangeCopy.js` enforces at CI. |
| 2026-04-24 (S6-B3) | Upgrade proration amount disclosed upfront before Confirm | MPMF-AP-08 + MPMF-AP-16 binding. Every dollar of charge today shown in modal before confirmation tap. No "complicated — trust us" opaque proration. Downgrade variant explicitly states no-refund-for-current-period to prevent "save $X!" misleading framing. |
| 2026-04-24 (S6-B3) | H-SC01 defer-to-hand-end applies to paywall, not just cancellation | Paywall-hit Variation B (usage-threshold) most commonly triggers the defer mechanism — quota exhaustion mid-hand no-ops with neutral toast; modal fires at hand-end. MPMF-G5-SC test target. Extends H-SC01 from the initial cancellation-focused framing to all commerce-UX modals that might interrupt active work. |
| 2026-04-25 (S7-B4) | Pricing-tentative banner persistent on pricing-page | Pricing numbers committed in Phase 1 (Free $0 / Plus $17 / Pro $29 / Founding $299) are tentative pending Stream D Phase 4 telemetry validation of M4 (Pro $25-35/mo WTP) + M9 (category-WTP-cap). Banner factually states this; refuses "act now before prices change!" anti-pattern (MPMF-AP-09). Banner removal/copy-update at Stream D retro. |
| 2026-04-25 (S7-B4) | Pricing-page NOT A/B-tested for conversion-coercion | Per Q1=A doctrine + assumption M6 — refuses fake-countdown-timer / "Most Popular" badge / inflated-social-proof variants as test arms. Doctrine-explicit-vs-doctrine-implicit copy A/B IS permitted (M6 kill-criterion) — that's positioning-test, not coercion-test. Categorical refusal documented in surface §State. |
| 2026-04-25 (S7-B4) | PaywallModal (S2 reactive) and UpgradePromptInline (S3 proactive) are DISTINCT patterns | Modal blocks user action when feature gate fires; inline-prompt lives quietly in contextual surfaces where upgrade is genuinely relevant. Different copy generators / telemetry events / suppression rules. NOT interchangeable; NOT unified-into-one-component; NOT redirected-to-each-other. Conflation would invite "every gate becomes a banner" anti-pattern (extension of MPMF-AP-15 silent-plan-change-on-cancellation analog). |
| 2026-04-25 (S7-B4) | Founding-member cap-remaining is best-effort UI display, server-authoritative for cap enforcement | UI fetches via `useFounderCapStatus()` with ≤5min cache. Two users seeing "1 of 50 remaining" simultaneously is acceptable — server-side W-SUB-2 webhook handler enforces I-WR-4 hard-cap; second user gets refunded with factual "Cap filled while you were checking out — refunded. Pro pricing available." Stripe + I-WR-4 are the cap authority; UI is informational. |
| 2026-04-25 (S8-B5) | BillingSettings has 4 tier-state variants rendered same component | Paid-active / cancelled-grace / free / founding-lifetime each have distinct anatomy but same `BillingSettings.jsx` shell — composition based on `useBillingSettings()` hook output. Avoids 4 separate components for a single section card; mirrors EAL `anchor-library` cross-state rendering pattern. Variant logic centralized + testable. |
| 2026-04-25 (S8-B5) | BillingSettings Cancel button equal-weight — refuses BOTH visual-emphasis AND de-emphasis | Cancel button is NOT visually emphasized (no red color / scary treatment / size boost — refuses MPMF-AP-05 anti-pattern that uses scare-design to make user hesitate) AND NOT visually de-emphasized (no hidden / 8-pt-text / requires-3-clicks-to-find — refuses dark-pattern of making cancel hard). Same width / height / font-weight / border treatment as adjacent View-plans + Export-data buttons. Categorical refusal of both common cancel-button anti-patterns. |
| 2026-04-25 (S8-B5) | Reactivate Pro is ≤2-tap symmetric reverse of cancellation | Cancel takes 3 taps (Settings → Billing → Cancel + 1 modal-confirm tap = effectively 2 nav taps + 1 commit). Reactivate is 2 taps total (Settings → Billing → Reactivate + 1 modal-confirm tap). Same-effort reverse action per red line #4 reversibility. Refuses asymmetric pattern where cancel is easy but undo-cancel is buried. |
| 2026-04-25 (S8-B5) | Trial-state-indicator persists at 60% opacity during active hand — NOT removed | Two anti-patterns rejected simultaneously: removing-during-hand (loses transparency per red line #2) AND intrusive-mid-hand (violates red line #8 + H-SC01). 60% opacity + deferred routing on tap is the third option — preserves transparency without distraction. Chip itself is glanceable + tappable + non-blocking. |
| 2026-04-25 (S8-B5) | Indicator chip-routing-by-tier-state | Free tier → pricing-page (natural next step is to see plans). Paid tiers → BillingSettings (canonical billing-state surface). Card-decline → BillingSettings#payment-method (direct-scroll to relevant card). Tier-aware routing maximizes 1-tap value of the indicator while respecting H-SC02 ≤2-tap rule for billing access. |
| 2026-04-25 (S8-B5) | **Gate 4 CLOSED — 16 of 16 carry-forwards shipped across 5 batches** | B1 doctrine+foundation (6 items: ACP/W/HT/AL/EA/ES) + B2 foundation-remainder (2 items: S6/J1) + B3 journeys (3 items: J2/J3/J4) + B4 paywall surfaces (3 items: S1/S2/S3) + B5 billing surfaces+closeout (2 items: S4/S5). Anti-patterns final state: 16 refusals. Cross-surface architectural invariants ratified: telemetry-consent + onboarding journey + paywall vs upgrade-prompt distinct patterns + cancellation/paywall/plan-change distinct journeys + billing-settings entry point + trial-state-indicator persistent chip. **Gate 5 fully unblocked** — Phase 5 code work + Stream D Phase 1 PostHog install + Stream E Phase 1 founding-member outreach all ready to begin. **Next plan: Gate 5 implementation** per project charter §"What comes after this plan." |
| 2026-04-25 (S9-G5-B1) | **MPMF G5-B1 ships first code on project** | All prior 8 sessions were design + governance. B1 introduces production code: 9 new files + 5 amended; 108 new tests; clean build. Foundation pattern matches playerReducer/PlayerContext/usePlayerPersistence exactly. No Stripe/PostHog/UI yet — pure entitlement state plumbing. Next plan G5-B2 (telemetry) requires owner prerequisites: PostHog-for-Startups application + Stripe sandbox + M15 anonymous-first verification. |
| 2026-04-25 (S9-G5-B1) | MPMF claims IDB v18 first | Per EAL gate4-p3-decisions §2 dynamic-target rule. PRF G5-CI shipped CI infrastructure but no IDB migration yet (their PRF-G5-MIG remains queued). EAL Stream D not started. SLS Stream D not started. MPMF migrateV18 creates subscription store; subsequent projects bump to v19+. |
| 2026-04-25 (S9-G5-B1) | Two persistence-hook patterns coexist in codebase, both valid | useEntitlementPersistence follows the **params-based** pattern (mirrors usePlayerPersistence — receives state+dispatch as args). useEntitlement hook follows the **useContext-based** pattern (mirrors usePlayer — thin context-consumer with helpful error outside provider). Both patterns intentional and documented in EntitlementContext.jsx. |
| 2026-04-25 (S9-G5-B1) | Cancellation supersedes pending plan-change in reducer | Per Gate 4 known-behavior note. CANCELLATION_RECORDED action clears `pendingPlanChange` state — user cancellation supersedes any prior scheduled downgrade. Tested explicitly. |
| 2026-04-25 (S9-G5-B1) | Fresh tier upgrade clears all grace state | TIER_UPGRADED action clears cancellation grace + pending plan-change + card-decline grace simultaneously — fresh subscription supersedes any prior cancelled-grace position. Tested across all 3 grace-clearance paths. |
| 2026-04-25 (S9-G5-B1) | Effective tier respects dev override; canonical state.tier preserved | `resolveEffectiveTier(state)` returns `overrides.devForceTier` if set, else `state.tier`. Components read effectiveTier; raw state.tier preserved for Stripe-backed canonical state (so dev overrides don't pollute payment-method or billing displays). Pattern available via context value `effectiveTier` field. |
| 2026-04-25 (S9-G5-B1) | EntitlementProvider mounted between AuthProvider and GameProvider | High enough that all gated features can access entitlement; inside Auth so user identification (Stripe Customer ID) can flow through later. Mounting decision in AppProviders.jsx provider hierarchy. |

---

## Closeout Checklist

Before marking project complete:

- [ ] Gates 1–5 all closed.
- [ ] Every P0/P1 Gate 2 finding shipped or explicitly waived.
- [ ] 3 personas Owner-ratified (PROTO → Verified).
- [ ] 7 JTBDs shipped to ATLAS.
- [ ] Q1–Q8 owner verdicts documented.
- [ ] 6 Gate 4 surfaces + 3 journeys shipped.
- [ ] Telemetry live ≥ 60 days before pricing locks.
- [ ] Assumption ledger kill-or-keep verdict for each of 10–15 assumptions.
- [ ] Founding-member soft launch executed (if Q2 = B).
- [ ] Full-tier commercial launch (if go-decision post-30-day review).
- [ ] 9 autonomy red lines applied to commerce UX per Q1 verdict; assertion lists in each surface artifact.
- [ ] Ignition commercial lane scope decision per Q3 — shipped, scheduled, or explicitly deferred.
- [ ] All tests green; no drift in existing suites.
- [ ] STATUS.md updated.
- [ ] MEMORY.md closed-summary entry.
- [ ] CLAUDE.md updated if monetization changes architecture (entitlement context + reducer).
- [ ] Handoff file marked COMPLETE.

---

## Change log

- 2026-04-24 — Session 1, v1.0 authoring. Charter + Gate 1 inline (YELLOW) + market research + paywall spectrum + 3 personas (PROTO) + handoff. 8-voice roundtable output delivered in main chat transcript; formal audit doc deferred to Gate 2 execution session. Zero code. Gate 2 and Gate 3 unblocked.
