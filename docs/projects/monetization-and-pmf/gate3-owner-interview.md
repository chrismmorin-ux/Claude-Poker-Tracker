# Gate 3 Owner Interview — Monetization & PMF

**Date:** 2026-04-24 (verdicts captured Session 3b)
**Format:** AskUserQuestion batches; owner selected all 10 recommended positions
**Status:** CLOSED — all verdicts captured; Gate 4 unblocked (pending legal-scoping for Q7)

---

## Headline

All 10 verdicts landed on the **Recommended** starting position (the position advocated by Session 2 Gate 2 audit + Session 1 charter recommendation). This is a uniform "accept recommendations" outcome.

**Direct consequences:**
1. **Paywall option space collapses from ~40 options to Bundle α + supporting bundles** (Q1=A + Q5=A).
2. **Bundle α** — doctrine-clean session-scoped free tier + paid tiers gating on history / usage / depth — becomes the authoritative Gate 4 target.
3. **Founding-member $299 lifetime cap 50** ships alongside PostHog telemetry in parallel soft-launch (Q2=B + Q4=A).
4. **Ignition commercial lane explicitly deferred** until main-app validates (Q3=C); legal scoping scheduled separately (Q7=A).
5. **Scholar fork deferred** pending Stream D telemetry signal (Q6=C).
6. **CC-88 telemetry** ships opt-out with first-launch transparency panel (Q8=B).
7. **JTBD framework restructured**: new `billing-management.md` domain holds SA-76/77/78 (Q9=A).
8. **Evaluator stays unified** at core level; E-IGNITION is an attribute, not a situational file (Q10=B).

---

## Q1 — Doctrine scope

**Verdict: A — Doctrine binds all commerce UX.**

### What this means

The 9 autonomy red lines established in `docs/design/personas/core/chris-live-player.md` §Autonomy constraint — plus the 10th commerce-specific red line added in Gate 2 audit (no dark-pattern cancellation) — apply in full to every commerce UX surface: pricing page, paywall modals, upgrade prompts, trial-state indicators, renewal reminders, cancellation flows, email templates, billing-management surfaces.

### Rationale

- Session 2 Autonomy voice advocated forcefully: "the doctrine IS the product differentiator; weakening it weakens the one thing that distinguishes this app from GTO Wizard / Upswing / Run It Once on commerce UX."
- M1 positioning wedge ("No streaks. No guilt. Cancel in two taps.") is novel in the poker-tooling category and directly markets the doctrine as a product feature.
- Conversion cost of bundle α vs bundle β (~2.5× urgency-trigger bump foregone per industry data) is recoverable via M1 marketing.
- Under Q1=B/C, Autonomy voice flagged this would escalate Gate 2 re-run to RED.

### Gate 4 implications

- **All commerce copy** reviewed against forbidden-string list at CI (mirror EAL `calibrationCopy.js` + `retirementCopy.js` pattern).
- **Paywall-spectrum bundle β disqualified** (14-day trial with renewal urgency) — not available as Gate 4 design target.
- **Bundle α + δ** (doctrine-clean + founding-member seed) become the authoritative Gate 4 design targets.
- **10 commerce red lines enumerated inline in charter §Acceptance Criteria** (MPMF-G4-ACP) — red line #10 is new for commerce; #1–#9 inherit from skill-gating doctrine.
- **12 anti-patterns** (MPMF-AP-01..12) promoted from Gate 2 audit to formal refusal list at `docs/projects/monetization-and-pmf/anti-patterns.md` (MPMF-G3-OOS — shipped this session).
- **Cancellation journey** (`journeys/cancellation.md`) becomes load-bearing surface; CI-linted copy discipline enforced.

### Carry-forwards

- MPMF-G4-ACP: charter §Acceptance Criteria expanded with 10 red lines.
- MPMF-G4-AP: `anti-patterns.md` with 12 refusals + CI-lint pattern (stub shipped this session).
- MPMF-G4-J3: `journeys/cancellation.md` with dark-pattern-free copy ladder.
- MPMF-G5-CL: CI-linted forbidden-copy-strings check.

---

## Q2 — Sequencing

**Verdict: B — Parallel soft-launch + telemetry.**

### What this means

Install PostHog (pending Q8 which verdicted B opt-out with panel) AND ship founding-member $299 lifetime to ≤50 users simultaneously. Do not wait 30-60 days for telemetry before pricing any tier; do not ship pricing without telemetry. Both streams advance in parallel.

### Rationale

- Session 1 DEVIL voice: "if you need monetization revenue this quarter, the realistic play is a $20/mo single-tier soft launch to 20 users with manual check-ins, not a polished 3-tier system. Don't let the framework eat the ship date."
- Founding-member lifetime generates cash + direct feedback + evangelist cohort while telemetry accumulates PMF signal.
- Decouples PMF validation from pricing validation — they run in parallel windows.
- 30-60 day horizon to full-tier launch decision after data lands.

### Gate 4 implications

- **Founding-member pricing page** shipped at Gate 4 (even if full-tier pricing page deferred).
- **Stream D Phase 1 (PostHog install)** can begin immediately after Q8 verdict lands (Q8=B confirmed; unblocked).
- **Stream E Phase 1 (founding-member outreach)** runs parallel, not sequential.

### Carry-forwards

- MPMF-G4-S1: `surfaces/pricing-page.md` includes founding-member tier + "lifetime founding" labeling + factual cap scarcity.
- MPMF-G5-PH: PostHog install + event schema v1 (Q8-gated — now unblocked).
- MPMF-Stream-E: founding-member outreach kickoff.

---

## Q3 — Ignition commercial lane timing

**Verdict: C — Defer until main-app validates.**

### What this means

Ignition sidebar SKU is NOT commercialized in Phase 1. Main-app monetization ships first. Ignition extension continues to work for existing owner-use (and any paid-customer who later wants it). Commercial lane for Ignition waits until:
- (a) Main-app paid-customer base exists to upsell from.
- (b) Q7 legal scoping completes.
- (c) Dedicated in-app Ignition training flow (onboarding) is built.

### Rationale

- Session 1 POKER-BIZ voice: "nail the in-app training first, then price 100x; don't price premium until onboarding converts."
- Session 2 Market voice: grey-market operator creates ToS + payment-processor + marketing-channel risk that compounds without legal scoping.
- Session 2 DEVIL voice: "Ignition is one US-grey-market operator. Pricing it 100x assumes (a) users playing online real-money poker (b) on Ignition specifically (c) willing to pay sidebar money. That's a small funnel."
- Main-app audience is larger + cleaner legal posture + established market-category anchor ($15-50/mo band).

### Gate 4 implications

- **No Ignition SKU surface spec** in Phase 1 Gate 4.
- **Charter Stream E (soft launch)** includes main-app founding-member only; Ignition explicitly out of scope.
- **`ignition-poker-tracker/` extension** continues to ship as-is for owner-use; no commercial-lane wiring.
- **Bundle ε (paywall-spectrum)** deferred; surface specs reference bundle α + δ only.
- **SA-75 JTBD** (evaluate-sidebar-separately) remains Active per Gate 3 authoring but served-by-surface list is all "Phase 2+ pending Q3 re-verdict + Q7 resolution."

### Carry-forwards

- MPMF-G4-IM: Ignition-mode surface design → LATER (not Phase 1).
- MPMF-P8-EX: Extension entitlement-read-only doctrine → still valid when Ignition lane does ship; remains P3 BLOCKED.
- Future re-verdict: after main-app validates (founding-member 30-day review + initial full-tier launch), re-open Q3 with evidence.

---

## Q4 — Founding-member mechanism

**Verdict: A — $299 lifetime cap 50.**

### What this means

First 50 users to pay $299 receive lifetime access at Pro tier + any future tier upgrades. No recurring billing for this cohort. Cap is hard (51st user doesn't get the deal). Cap is factual scarcity (not engagement-coercive — red-line-#5 compliant).

### Rationale

- Capped at 50 → permanent LTV cap on those 50 accounts (accept as seeding cost).
- Scarcity is transactional (factual cap), not coercive (no "act now!" urgency framing).
- Selects for evangelists + highest-commitment early users.
- Generates cash injection without subscription-collection infrastructure maturity.
- Feedback loop: direct access to 50 founding members for qualitative research + assumption ledger validation.

### Gate 4 implications

- **Founding-member pricing page section** displays: price, what it includes, cap remaining, "Lifetime Founding — first 50 members" labeling.
- **Founding-member tier persists in entitlement state** — distinct from standard Pro; reducer models it explicitly.
- **When cap hits 50**: signup flow transitions to standard pricing page; founding-member pathway removed from UI (not hidden behind "sold out!" urgency banner — just removed).
- **Refund/transfer policy** documented at Gate 4 (open question per Session 1 handoff: what if founding member wants to leave?).

### Carry-forwards

- MPMF-G4-S1: `surfaces/pricing-page.md` includes founding-member section + factual cap display.
- MPMF-G5-ER: entitlement reducer models `tier: 'founding-lifetime'` as distinct tier.
- MPMF-G5-IDB: IDB `subscription` store records founding-member status + acquisition cohort timestamp.
- Open for Gate 4 spec: founding-member refund/transfer policy.

---

## Q5 — Free-tier shape

**Verdict: A — Session-scoped free.**

### What this means

Free-tier users can:
- Enter unlimited hands during any active session.
- Use full live exploit engine during the session.
- See end-of-session recap.

Free-tier users CANNOT:
- Persist villain models across sessions (each new session starts fresh).
- Access prior-session history (past sessions' detailed analysis not available).
- Cross-session analytics (trends, long-term tendencies).

Paid tiers (Plus / Pro) unlock history depth + cross-session persistence + advanced analysis.

### Rationale

- Gates on history depth — hardest for free-tier to replicate without paying.
- Respects H-SC01 (paywall never interrupts mid-session) — no mid-session quota exhaustion.
- Respects red line #5 (no urgency pressure) — free user hits the natural session boundary, not an engineered countdown.
- Clear value-amplifier gate: free gives them "the app works!" moment; paid gives them "the app remembers!" moment.
- Market evidence: novel in category (no direct competitor uses session-scope gating; differentiated UX).

### Gate 4 implications

- **Free-tier users see "your session recap is saved through end-of-session" messaging** explicitly at start + end of session.
- **Paywall trigger L4 (history-access)** fires when free user attempts to re-open a prior session.
- **Session closure** is a graceful moment, not a cliff — recap is full-featured before fading.
- **Returning-evaluator** opens to "last session: N hands, recap available, upgrade Plus to see detail" — factual, not coercive.
- **Data-retention rule**: free-tier still persists data locally in IDB; paywall gates access to it, not storage. Upgrading unlocks access retroactively.

### Carry-forwards

- MPMF-G4-S1: `surfaces/pricing-page.md` tier descriptions reference session-scoped gate explicitly.
- MPMF-G4-S2: `surfaces/paywall-modal.md` L4 trigger on history-access.
- MPMF-G4-J2: `journeys/paywall-hit.md` documents session-close → paywall-next-open flow.
- MPMF-G5-ER: entitlement reducer models `historyAccess: 'session-only' | 'unlimited'` capability.
- MPMF-G5-IDB: IDB query paths gate on entitlement before returning cross-session data to free-tier users.

---

## Q6 — Scholar fork

**Verdict: C — Defer; await telemetry signal.**

### What this means

Scholar is NOT pursued as a distinct commercial target in Phase 1. Same tier ladder for Chris-shape and Scholar-shape evaluators; Scholar happens to stop at Plus. No separate pricing page, no separate marketing copy, no Scholar-aimed tier naming. After Stream D telemetry accumulates 60+ days, check if usage clusters confirm Scholar as a distinct market. If clusters appear, re-open Scholar fork in a later project.

### Rationale

- Scholar proto-persona's WTP is hypothetical ($15-30/mo range from persona assumption S1, unverified).
- Telemetry will tell us definitively whether Scholar-shape users exist separately from Chris-shape users.
- GTO Wizard's dominance of the Scholar segment is a real competitive threat; forking without data risks cannibalizing a lost segment.
- Deferring avoids committing commercial effort + marketing copy to a persona whose existence isn't validated.

### Gate 4 implications

- **No separate Scholar pricing narrative** in Phase 1 Gate 4 surfaces.
- **Pricing page copy** is Chris-aimed primary; Scholar-inclusive secondary (tier descriptions accommodate both use cases).
- **Future re-verdict**: after 60+ days Stream D data, if ≥20% of active users cluster as Scholar-shape (low live-session activity + high drill engagement), re-open Q6 with evidence.

### Carry-forwards

- MPMF-G4-AL: assumption-ledger entry M7 (Drills and live play are the same user's two modes, not two different users) — kill-criterion if <25% of users use both within 30 days, Scholar persona is a separate product.
- Future project: Scholar-fork design authored post-telemetry.

---

## Q7 — Ignition legal/ToS posture

**Verdict: A — Schedule separate legal-scoping session with counsel.**

### What this means

No Ignition-specific marketing copy, no Ignition SKU pricing page, no Ignition payment-processor category classification — until a dedicated legal-scoping session resolves:
- ToS acceptability for a tool advertised publicly for Ignition use.
- Payment-processor category classification (Stripe's prohibited-business list includes some gambling-adjacent services; Paddle/LemonSqueezy alternatives).
- Marketing-channel constraints (YouTube/Twitter poker-content policies).
- US state-level gambling-adjacent-tool regulation exposure.

**Compatible with Q3=C deferral.** Since Ignition commercial lane is deferred to Phase 2+, legal scoping has runway — doesn't need to complete before Phase 1 Gate 4 for main-app. But must complete before any Phase 2 Ignition work begins.

### Rationale

- Grey-market operator (Ignition is offshore, operates in US grey-market) creates compounding risk: ToS enforcement risk + payment-processor rejection risk + marketing-channel removal risk.
- None of these are mitigable without counsel.
- Verdict A + Q3=C combined = lowest risk posture; defers Ignition legal exposure until it's commercial-path-actionable.

### Gate 4 implications

- **None for Phase 1 main-app.** Main-app is NOT in this legal category — it's a live-poker tracker for in-person play, clean posture.
- **Charter §Q7 marked "Scheduled — pending legal counsel session"** not resolved.
- **Phase 2 Ignition work** blocked on Q7 resolution.

### Carry-forwards

- Separate TODO: schedule legal counsel session for Q7 resolution before any Phase 2 Ignition work. Not calendared this session.
- MPMF-G3-Q7 backlog row remains NEXT until scoping session happens.
- `docs/projects/monetization-and-pmf.project.md` charter updated to note Q7 pending-legal-scoping status.

---

## Q8 — Telemetry consent default

**Verdict: B — Opt-out with first-launch transparency panel.**

### What this means

Telemetry is **on by default** for new installs, but:
- First-launch panel names what is collected (usage events, screen navigation, dwell times, rage-click detection, session replay, error tracking) and what is NOT collected (no PII, no dollar amounts, no hand content, no account details).
- One-tap off-switch per category visible on first-launch panel.
- Settings → Telemetry panel (always accessible in ≤2 taps) mirrors first-launch; reversible at any time.
- Per-event incognito toggle available at Gate 5 for any feature that writes telemetry events (mirrors EAL anchor observation incognito pattern).

### Rationale

- Opt-in (Q8=A) would result in the cohort we most need data on (Evaluators bouncing) being the least likely to opt in — worst data quality for PMF validation.
- Opt-out (Q8=B) is industry-defensible AND red-line-compliant given the always-visible off-switch + transparency panel (structurally respects #9 incognito observation mode).
- Tier-dependent (Q8=C) couples consent to commerce, likely violates red lines #1 + #9.

### Gate 4 implications

- **`surfaces/telemetry-consent-panel.md`** at Gate 4 — first-launch + settings-panel variants; factual copy; no coercive framing; one-tap per-category off-switch.
- **Telemetry events gate on consent category** — events of a category that user has opted out of are dropped at the event-emitter boundary (not transmitted then discarded server-side).
- **PostHog install (Stream D Phase 1)** unblocked. Can begin immediately.

### Carry-forwards

- MPMF-G4-S6: `surfaces/telemetry-consent-panel.md` — Gate 4 surface spec.
- MPMF-G5-PH: PostHog install + event schema v1 + 3-layer instrumentation per charter Stream D.
- MPMF-G5-RL: in-app test assertion for red line #9 (incognito mode respected; events never fire in opted-out categories).
- Apply for PostHog for Startups credit ($50K).

---

## Q9 — JTBD domain split

**Verdict: A — Split into new billing-management.md.**

### What this means

SA-76 (switch-between-plan-tiers) + SA-77 (manage-payment-method) + SA-78 (know-when-ill-be-billed) are moved from `subscription-account.md` to a new domain file `docs/design/jtbd/domains/billing-management.md`. `subscription-account.md` retains SA-64..75 (access + evaluation + cancellation JTBDs). ATLAS.md gains a 16th domain row (prior count: 15).

### Rationale

- 'Getting to a paid tier' (SA-64..75) and 'managing ongoing subscription state' (SA-76..78) are distinct JTBD clusters with different persona-action budgets and different Gate 4 surface targets.
- Keeps each domain file scannable; prevents subscription-account.md from growing beyond ~15 entries.
- ID ranges cleanly: SA-71..75 stay in subscription-account, BM-76..78 move to billing-management (or renumber as BM-01..03 — Gate 3 decides on ID prefix convention).

### Gate 4 implications

- **New domain file `billing-management.md`** ships this session (MPMF-G3-J6/J7/J8 re-located).
- **ATLAS.md** gains `BM` domain index row; `SA-76..78` removed from SA range (SA range becomes `SA-64..75`).
- **ID convention decision**: keep as `SA-76..78` with note "moved to billing-management domain" OR renumber as `BM-01..03`. **Decision**: **keep as SA-76..78 but in billing-management.md** — ID persistence avoids breaking any references from persona files or audit docs already written. New entries in billing-management going forward will use `BM-*` prefix.

### Gate 4 carry-forwards (unchanged scope, just relocated)

- MPMF-G3-J6/J7/J8 served-by surfaces unchanged (plan-change + payment-method + renewal-transparency in billing-settings + journeys).

---

## Q10 — Evaluator-ignition-mode situational

**Verdict: B — Keep as attribute of unified Evaluator.**

### What this means

E-IGNITION sub-shape stays documented in `docs/design/personas/core/evaluator.md` §Evaluator sub-shapes. No separate situational file authored. Gate 4 first-run journey branches on the sub-shape attribute when surface design reaches Ignition first-run context (currently deferred per Q3=C).

### Rationale

- Avoids persona fragmentation (14 core + 16 situational is already a dense cast).
- Q3=C defers Ignition commercial lane; no urgency for Ignition-specific persona artifact in Phase 1.
- Unified Evaluator's sub-shape attributes capture the distinction sufficiently.
- If Q3 re-verdicts later (Phase 2 pursues Ignition), re-open Q10 at that time.

### Gate 4 implications

- **No new persona file this session.**
- **Gate 4 journey `evaluator-onboarding.md`** branches on sub-shape attribute at first-run (E-CHRIS default main-app path; E-SCHOLAR Scholar-aimed path; E-IGNITION deferred to Phase 2+).
- **E-IGNITION sub-shape description in `evaluator.md`** remains authoritative reference until Q10 re-verdict.

### Carry-forwards

- MPMF-G3-P4 backlog row marked COMPLETE (with resolution "defer — keep as attribute").
- Future re-verdict: when Q3 flips to A/B (Phase 2+ Ignition commercial), re-open Q10 for fresh decision.

---

## Composite Gate 4 impact

With all 10 verdicts in, Gate 4 surface design proceeds against this consolidated picture:

**Tier architecture:**
- Free (session-scoped, no cross-session persistence)
- Plus (~$15-19/mo — cross-session history + villain models)
- Pro (~$25-35/mo — advanced drills + game-tree + exploit anchors)
- Founding-Lifetime ($299 one-time, cap 50)
- [Ignition SKU: deferred]

**Paywall bundle:** α + δ (doctrine-clean + founding-member seed). β disqualified. γ unused (Scholar deferred). ε deferred (Ignition deferred).

**Commerce UX doctrine:** 10 red lines enforced; 12 anti-patterns refused; CI-linted copy.

**Telemetry:** PostHog, opt-out with transparency panel, per-category toggles.

**Sequencing:** Founding-member launch + PostHog install ship in parallel Phase 1. Full-tier launch gated on 30-day review after parallel launch.

**Persona cast:** Evaluator (core) + trial-first-session (situational) + returning-evaluator (situational). Owner-Confirmed today (structural); Verified pending telemetry signal.

**JTBD framework:** 10 new JTBDs split across `subscription-account.md` (SA-71..75) + new `billing-management.md` (SA-76..78) + `cross-cutting.md` (CC-88) + `onboarding.md` (ON-88).

---

## Open items after this interview

1. **Legal scoping session for Q7** — schedule with counsel before any Phase 2 Ignition work.
2. **Founding-member refund/transfer policy** — Gate 4 spec.
3. **PostHog-for-Startups credit application** — Stream D Phase 1 prep.
4. **Stripe vs Paddle vs LemonSqueezy decision** — Gate 5 (Phase 1 main-app is Stripe-eligible; Q7 scope is for Ignition only).
5. **Bundle γ Scholar re-open trigger** — instrument Scholar-shape clustering in PostHog dashboards so re-open-Q6 decision is evidence-driven.

---

## Change log

- 2026-04-24 — Created. All 10 verdicts captured in a single owner-interview batch. Every verdict on the Recommended position. Gate 3 CLOSED pending persona ratification + Gate 2 re-run this session.
