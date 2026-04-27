# Blind-Spot Roundtable — 2026-04-24 — Monetization & PMF

**Type:** Gate 2 Blind-Spot audit (design lifecycle per `docs/design/LIFECYCLE.md`)
**Trigger:** Gate 1 verdict **YELLOW** (see `docs/projects/monetization-and-pmf.project.md` §Gate 1) — product-line expansion + cross-surface journey change + new persona class (Evaluator) + 7 candidate JTBDs + doctrine scope ambiguity.
**Participants:** Product/UX lead (Stages A, C, E), Autonomy skeptic (Stages A, E), Market lens (Stages B, C, D).
**Artifacts read:**
- `docs/projects/monetization-and-pmf/gate2-voices/01-product-ux.md`
- `docs/projects/monetization-and-pmf/gate2-voices/02-autonomy-skeptic.md`
- `docs/projects/monetization-and-pmf/gate2-voices/03-market-lens.md`
- `docs/projects/monetization-and-pmf.project.md` (charter + Gate 1 inline)
- `docs/projects/monetization-and-pmf/market-research.md`
- `docs/projects/monetization-and-pmf/paywall-spectrum.md`
- `docs/design/personas/core/evaluator.md`
- `docs/design/personas/situational/trial-first-session.md`
- `docs/design/personas/situational/returning-evaluator.md`
- `docs/design/audits/2026-04-24-blindspot-exploit-anchor-library.md` (template precedent)
- `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md` (template + autonomy red-line inheritance)
**Status:** DRAFT — awaiting owner ratification

---

## Executive summary

**Verdict: YELLOW.** Three voices converge: the project is structurally sound and well-scoped. Existing autonomy doctrine + design framework + persona patterns inherit cleanly. Market positioning is genuinely differentiated. But **one question must resolve before Gate 4 surface design proceeds, and three structural risks demand Gate 3 / Gate 4 attention.**

**The pivotal question: Q1 — does the 9-red-line autonomy doctrine bind commerce UX?**
Every paywall-spectrum option ranks differently under each Q1 verdict. Under Q1=A, bundle α is the doctrine-compliant winner and β is disqualified. Under Q1=C, β becomes allowed but the positioning differentiator (M1 "no streaks, no guilt, two-tap cancel") is lost. The paywall-spectrum doc was authored Q1-agnostic; Gate 4 surface specs cannot be authored Q1-agnostically.

**Top 3 structural risks:**
1. **Dark-pattern cancellation is where industry monetization integrity fails.** The cancellation flow is the single highest-risk surface for credibility violation. A dedicated `journeys/cancellation.md` with copy-discipline enforcement is non-negotiable at Gate 4.
2. **Ignition commercial lane has legal posture unresolved.** Q7 (legal/ToS) blocks any Ignition marketing and potentially affects payment-processor selection. Gate 3 must schedule legal scoping.
3. **Evaluator persona is authored cold-start without evidence.** 3 PROTO personas with no ledger entries. Ratification is structural (owner-confirmed) but evidential validation waits on Stream D telemetry. Accept 60-day window before Gate 4 surface specs lock.

**Top 3 required Gate 3 items:**
1. **Owner interview Q1–Q8** — verdicts shape every subsequent design decision.
2. **7 JTBDs authored** (SA-71..75, CC-88, ON-88) + **3 additional proposed by Market voice** (SA-76 tier-migration, SA-77 payment-method, SA-78 renewal-transparency). Potentially 10 total.
3. **Persona ratification** — 3 PROTO → Owner-Confirmed. Full Verified status waits on telemetry.

Gate 3 is **conditionally required** per LIFECYCLE.md for YELLOW Gate 2; scoping is moderate (comparable to EAL Gate 3, not Shape Language's heavier Gate 3).

## Feature summary

The Monetization & PMF project introduces commercial infrastructure to a codebase that has none: pricing design, paywall mechanics, entitlement state, telemetry foundation, and a new Evaluator persona class. The project treats monetization as four intertwined concerns: persona expansion, pricing/paywall design, telemetry foundation, and UX redesign against falsifiable assumptions. Session 1 delivered the charter + Gate 1 inline (YELLOW), 3 PROTO personas (Evaluator core + trial-first-session + returning-evaluator situationals), a paywall-spectrum design doc cataloging the full option space (9 × 9 × 7 × 7 × 5 × 3 dimensions + 5 compatible bundles), and a market-research artifact preserving competitive-pricing anchors. Eight owner-interview questions (Q1–Q8) are parked for Gate 3. Zero code changed. Zero existing infrastructure exists for telemetry, entitlement, payment processing, or paywall UI — all four pillars will be built from scratch at Gate 5.

---

## Stage A — Persona sufficiency

**Output: ⚠️ Patch needed (evaluator-sub-shape decision + minor situational authoring).**

### Findings

All three voices converge on: no new core persona required. The Evaluator persona's 3 sub-shapes (E-CHRIS / E-SCHOLAR / E-IGNITION) do NOT require forking into separate core personas. The sub-shapes can be handled as:

- (preferred per Product/UX voice) Attributes of the unified Evaluator core + one optional situational for Ignition-specific first-run context.
- (alternative) Unified core + full 3 situationals documenting each sub-shape's first-run path.

**Rationale for not forking:** the cognitive-shape attributes (first-60-second make-or-break, will-not-read-documentation, one-bounce-from-gone, no-account-before-value) are universal across E-CHRIS / E-SCHOLAR / E-IGNITION. The divergences (device, problem-they-arrived-with, wow-moment, tier-fit) are persona-attributes and situational-context, not core-persona-identity.

**Missing evaluator shapes flagged but deferred:**
- Coach-shape evaluator (audience ~zero in Phase 1)
- Banker-shape evaluator (audience ~zero in Phase 1)
- Analyst/API-user evaluator (modest audience, handled via ON-88 expert-bypass JTBD)
- Home-host / Ringmaster evaluator (modest audience; SG-54..59 home-game JTBDs are all Proposed)

All four are acknowledged but not authored in Phase 1. Gate 3 can defer-with-rationale; Gate 4 can address if surface design reveals specific need.

**Autonomy implications (Autonomy voice):**
- Evaluator is an applied-case of red line #1 (opt-in enrollment). Default assumption: not-yet-consented to modeling, tracking, or analysis. This binds Stream D (PostHog telemetry) UX decisions — Q8 verdict ties back here.
- Returning-evaluator surfaces red line #5 strongly — no re-engagement push notifications, no "we miss you" emails, no trial-ending-soon warnings. This is non-negotiable.
- Trial-first-session is the highest-stakes surface for red line #7 (editor's-note tone). All commerce copy in the 5–15 min window must be factual, never cajoling.

### Cross-voice resolution

All three voices align on: Evaluator stays unified at core level. Author ONE situational `evaluator-ignition-mode.md` (or equivalent naming) that captures the Chrome-extension first-run specifics. Defer Coach/Banker/Analyst/Ringmaster-evaluator shapes.

**Additionally:** document the 3 sub-shape attributes explicitly in `evaluator.md` §Evaluator sub-shapes (already present in Session 1 authoring) and reference that from Gate 4 first-run surface spec.

### Recommended follow-ups

- [ ] **Gate 3:** author `docs/design/personas/situational/evaluator-ignition-mode.md` if Gate 4 surface design needs it; otherwise document the deferral in charter Decisions Log.
- [ ] **Gate 3:** persona ratification — 3 PROTO → Owner-Confirmed (structural). Full Verified waits on Stream D telemetry.
- [ ] **Gate 4 constraint:** no `evaluator-coach`, `evaluator-banker`, `evaluator-analyst`, `evaluator-ringmaster` sub-personas authored in Phase 1. Deferred with rationale.
- [ ] **Gate 4 constraint:** E-CHRIS and E-SCHOLAR sub-shape attributes captured in `evaluator.md` — Gate 4 first-run surface branches on these without requiring separate situational personas.

---

## Stage B — JTBD coverage

**Output: ⚠️ Expansion needed — 3 additional JTBDs recommended beyond charter's 7.**

### Findings

Market voice's review of the 7 proposed JTBDs (SA-71..75 + CC-88 + ON-88) surfaced 3 missing JTBDs that every SaaS product in the category has implicit:

- **SA-76 — Switch between plan tiers.** Upgrade + downgrade paths are distinct from cancellation. Gate 4 needs a dedicated `journeys/plan-change.md`.
- **SA-77 — Manage payment method without churning.** Billing-info management is distinct from plan management. Historical user pain point for perpetual licenses (PT4 renewal complaints).
- **SA-78 — Know when and how much I'll be billed.** Renewal transparency. Binds to red line #2 (full transparency on demand) — non-negotiable under Q1=A.

**Domain taxonomy concern:** `subscription-account.md` reaches 15 entries with the 11 new JTBDs (SA-64..75 existing → SA-64..78 after Gate 3). Consider splitting into two domain files:
- `subscription-account.md` — access, evaluation, cancellation (SA-64..75).
- `billing-management.md` (NEW) — ongoing subscription state (SA-76..78).

Decision deferred to Gate 3 owner interview.

**Out-of-scope JTBDs (explicitly refused):**
- Streak / engagement — same refusal as Shape Language + EAL. Document autonomy rationale.
- Leaderboard / social comparison — same refusal.
- Referral mechanics with gamified rewards — same refusal (transactional "give a month, get a month" would be permitted separately).

**CC-88 (Honest telemetry) is novel in category.** No competitor foregrounds telemetry transparency. Gate 4 needs a `surfaces/telemetry-consent-panel.md` that makes this JTBD concrete.

**ON-88 (Expert-bypass for evaluators)** needs a distinct-from-sibling paragraph: ON-84 is "skip onboarding for pros," ON-87 is "seed skill model for experts entering adaptive-learning," ON-88 is "evaluator knows the tooling category and wants minimal orientation before trying." Three distinct things; atlas should reflect that.

### Recommended follow-ups

- [ ] **Gate 3:** author **10 JTBDs** (SA-71..78 + CC-88 + ON-88) instead of the charter's 7.
- [ ] **Gate 3 decision:** domain-split of `subscription-account.md` into `subscription-account.md` + `billing-management.md` — yes or no.
- [ ] **Gate 3:** explicit out-of-scope anti-pattern JTBDs (streak / leaderboard / gamified-referral) documented with red-line rationale.
- [ ] **Gate 3:** each JTBD includes distinction-from-siblings paragraph (esp. ON-88 vs ON-84 vs ON-87 triangle).

---

## Stage C — Situational stress test

**Output: ⚠️ Targeted adjustments (4 Gate 4 constraints, no structural mismatches).**

### Findings — per situational persona × paywall bundle

**`trial-first-session` (5–15 min window):**
- Against **bundle α (session-scoped free)**: ✓ works. No timer, no paywall interrupt, 60-second wow preserved.
- Against **bundle β (14-day trial)**: ❌ persona-incompatible. Timer banner triggers bounce reflex. Disqualified under Q1=A; hostile to persona under any Q1 verdict.
- Against **bundle δ (founding-member + indefinite free)**: ✓ cleanest. First-run feels ungated.
- **Against at-table trial (E-CHRIS subshape + mid-hand-chris intersection):** ⚠️ incompatible situationals. Resolution: trial-first-session is assumed off-table. At-table trial accepts degraded first experience OR Gate 4 specs an at-table-evaluator path (Pokeri precedent exists — market evidence shows live-poker evaluators do trial at-table).

**`returning-evaluator` (2+ day drift return):**
- **State preservation non-negotiable.** Re-entry shows "last session: N hands" factually. Never through paywall modal.
- **Explicit "resume vs. start fresh" choice** at re-entry — respects state-clear discipline (SR-program's 11 asymmetries).
- **No "we miss you" copy.** Red line #5 binds strongly for this persona.

**`mid-hand-chris` × paywall:**
- **H-SC01 (NEW project-specific heuristic):** paywall never fires mid-hand. Even if free-tier user hits quota mid-hand, they complete the hand; paywall at hand-end or session-end. Bundle α's U1 per-session limits respect this.
- Paywall-state indicator on live-play surfaces ≤ 150ms glanceable ("Free" or "Plus" chip in top-right). No colored banner.

**`post-session-chris` × paywall:**
- Primary host for upgrade prompts. Generous budget. CTA register C5/C6 (factual / editor's-note).
- "Upgrade for cross-session villain tracking" — this is the felt-value moment. Bundle α targets it precisely.

**`seat-swap-chris` × paywall:**
- Paywall CTA banned from seat-context-menu-adjacent surfaces (H-PLT06 misclick risk). Ties to `[EVID-2026-04-21-CLEAR-PLAYER]`.

**`newcomer-first-hand`:**
- **Paywall disqualified entirely for this persona.** Newcomer can't evaluate whether to pay before learning the app. First 20–50 hands, no paywall fires. Same threshold pattern as EAL's anchor-feature newcomer gate.

**`presession-preparer` × paywall:**
- Opening app presession to review tonight's villains — paywall must not interrupt this flow. Upgrade prompts in this context are disqualifying (the user is trying to focus).

### Recommended follow-ups

- [ ] **Gate 4 constraint:** paywall never interrupts active work (H-SC01 new heuristic). Mid-hand quota-exhaustion defers paywall to hand-end.
- [ ] **Gate 4 constraint:** trial-first-session assumed off-table; at-table trial path authored at Gate 4 if E-CHRIS commercial lane prioritizes it.
- [ ] **Gate 4 constraint:** returning-evaluator always opens to re-orient state (never to paywall modal); explicit "resume vs. start fresh" choice.
- [ ] **Gate 4 constraint:** newcomer-first-hand excluded from paywall surface until ≥ 20–50 hand threshold (mirror EAL's 25-hand pattern).
- [ ] **Gate 4 constraint:** presession-preparer surface hides upgrade CTAs.
- [ ] **Gate 4 spec:** cancellation journey handles re-entry state cleanly (cancelled → free tier degradation visible, not silent).

---

## Stage D — Cross-product / cross-surface

**Output: ⚠️ Partner surfaces need updates + Q7 legal scoping is blocking.**

### Findings (Market voice + cross-cutting concerns)

**Q7 legal/ToS posture is the blocking question for Ignition lane:**

1. **Public marketing of Ignition-specific tool creates legal exposure.** US grey-market operator; advertising "best HUD for Ignition" is Ignition-ToS-actionable + state-level gambling-adjacent-tool-regulation risk.
2. **Payment processor risk.** Stripe's prohibited-business list includes some gambling-adjacent services. Ignition SKU may be flagged.
3. **Main-app is NOT in this legal category.** Live-poker tracker for in-person play is clean. Bundling Ignition SKU into main-app marketing contaminates main-app's clean posture.

**Implication:** Q7 must resolve before ANY Ignition marketing ships. Gate 3 schedules a legal-scoping session. If Q7 verdicts "defer Ignition lane indefinitely," Phase 1 monetization is main-app-only + Ignition users remain unpaid (or evaluated differently).

**Cross-product state concerns:**

1. **Main-app Pro + no Ignition SKU:** sidebar gracefully degrades. No "unlock sidebar" intrusions on main-app surfaces. Persistence: main-app hand history and sidebar hand history are separate streams.
2. **Ignition SKU only:** unusual. Bundle ε specifies Ignition includes Pro features as strict-superset, eliminating this scenario.
3. **Entitlement state unified in main-app (IDB).** Passed to extension via existing WebSocket bridge. Extension reads; no independent entitlement state on extension side. Gate 5 architecture decision.
4. **Extension version skew.** Chrome Web Store auto-updates; entitlement check must be synchronous (main-app can't wait on extension-side handshake); sidebar-visible features must not differ between extension versions.

**Charter's bundle ε is well-designed** — strict-superset structure avoids the cross-product gaps that naive separate-SKU designs create.

**IDB migration concern:**
- Current IDB v17 + planned v18 from EAL + Shape Language both additive.
- Monetization project adds `subscription` store → IDB bumps to v19 (or dynamically per EAL's `max(currentVersion+1, targetVersion)` pattern).
- All additive; zero modifications to v17/v18 stores.

**Writer registry for entitlement state:**
- `subscription` store write sites: payment-success callback, subscription-cancel, subscription-change, manual-override (dev), migration-seed.
- ~5 writers. Author `WRITERS.md` at Gate 4 (mirror EAL pattern).

**Settings view integration:**
- `src/components/views/SettingsView/SettingsView.jsx` is the natural extension point.
- Add `BillingSettings` section alongside existing AccountSection. Layout fits the existing grid pattern.
- SA-76/77/78 surface on BillingSettings (plan card, payment method card, next-bill card + actions).

### Recommended follow-ups

- [ ] **Gate 3:** Q7 legal scoping — ToS posture for Ignition; payment-processor acceptability; marketing-channel constraints.
- [ ] **Gate 4:** `WRITERS.md` at `docs/projects/monetization-and-pmf/WRITERS.md` — 5-writer registry for `subscription` store.
- [ ] **Gate 4:** entitlement state architecture decision — main-app IDB as source of truth; extension subscribes via WebSocket bridge.
- [ ] **Gate 4:** bundle ε structured as strict-superset of Pro (Ignition includes Pro features) — confirm at paywall-spectrum re-review post-Q-verdicts.
- [ ] **Gate 4:** `BillingSettings` section in `SettingsView` — 6 actions (plan card, payment method card, next-bill date, update-payment, change-plan, cancel, data-export).
- [ ] **Gate 5:** payment processor selection deferred pending Q7 (Stripe default; Paddle/LemonSqueezy alternatives).
- [ ] **Gate 5:** IDB migration + new `subscription` store (additive; ~5 writers).
- [ ] **Phase 8 doctrine:** extension entitlement-read-only in `ignition-poker-tracker/CLAUDE.md` (mirror EAL anchor-agnostic pattern).

---

## Stage E — Heuristic pre-check

**Output: ❌ (as currently sketched — fixable with the 10 commerce red lines below; Q1 verdict is the unlock).**

### Findings

Three voices converge strongly on Stage E. The Autonomy voice enumerates 10 commerce-UX red lines (derived from the 9 autonomy red lines in `chris-live-player.md` + 1 new for dark-pattern-cancellation). The Product/UX voice identifies Nielsen/PLT/ML heuristic applications + 2 new project-specific heuristics (H-SC01 paywall-never-interrupts-work + H-SC02 trial-state-legible-outside-settings). The Market voice identifies the competitive context that informs which heuristics matter most.

**Q1 verdict determines which red lines bind commerce.** The master paywall-spectrum compatibility matrix shows which bundles survive each Q1 verdict.

### The 10 commerce red lines (non-negotiable for Gate 4 under Q1=A)

Derived by the Autonomy voice from the 9 autonomy red lines + 1 new:

1. **Opt-in enrollment for data collection** (inherits #1). Telemetry gated on user consent; no events fire before consent.
2. **Full transparency on demand** (inherits #2). Billing settings always show: current tier, next billing date, amount, cancellation path, data export path.
3. **Durable overrides on billing state** (inherits #3). Cancellation fully respected; no "we've paused your cancellation" dark patterns; no re-prompt to re-subscribe for ≥ 90 days.
4. **Reversibility** (inherits #4). Cancellation reversible before billing period ends; data retention preserved; data export on leaving is one-click.
5. **No streaks / shame / engagement-pressure notifications** (inherits #5). Push notifications banned for monetization; renewal reminders factual only.
6. **Flat-access pricing page** (inherits #6 spirit). All tiers shown with clear feature comparison; no "most popular" pressure nudges.
7. **Editor's-note tone** (inherits #7). CI-linted forbidden-string check on all commerce copy.
8. **No cross-surface commerce contamination** (inherits #8). Free-tier indicators never interrupt live-play; upgrade CTAs never on TableView during active hands; sidebar state separate from main-app state.
9. **Incognito observation mode** (inherits #9). Telemetry events respect per-event opt-out.
10. **★ NEW — No dark-pattern cancellation.** Cancellation ≤ 2 taps from billing settings; no exit-survey interposition; "pause instead?" offered equally alongside cancel; factual confirmation copy.

### 12 commerce anti-patterns (for Gate 4 `anti-patterns.md`)

Enumerated by the Autonomy voice for explicit refusal:

- **MPMF-AP-01** Timer-urgency banners ("3 days left!")
- **MPMF-AP-02** Social-proof false counts ("2,400 pros use Pro")
- **MPMF-AP-03** Streak celebrations
- **MPMF-AP-04** Re-engagement push notifications
- **MPMF-AP-05** Cancellation retention traps
- **MPMF-AP-06** "Downgrade" framing on cancellation
- **MPMF-AP-07** "Missing out" loss-framing
- **MPMF-AP-08** Dark-pattern checkout (pre-checked upsells, unclear prices)
- **MPMF-AP-09** "Limited-time" discounts (fake scarcity)
- **MPMF-AP-10** Pre-paywall friction (forced tutorial/account/email before free value)
- **MPMF-AP-11** Silent auto-renewal
- **MPMF-AP-12** Paywall mid-hand (H-SC01 violation)

### Nielsen 10 highlights (Product/UX voice)

- **H-N03 (user control & freedom):** cancellation ≤ 2 taps, no dark patterns.
- **H-N05 (error prevention):** upgrade CTAs have confirmation only for billing-sensitive actions.
- **H-N06 (recognition > recall):** tier names use standard "Plus" / "Pro" (avoid "Ultra" / "Elite" — GTO Wizard's namespace).
- **H-N07 (flexibility and efficiency):** dismissed upgrade prompts don't re-fire for ≥ 7 days on same surface.

### Poker-Live-Table highlights

- **H-PLT01 (sub-second glanceability):** paywall-state indicator ≤ 150ms readable.
- **H-PLT06 (misclick absorption):** upgrade CTA NOT in thumb-reach zone for destructive mid-hand actions.
- **H-PLT07 (state-aware primary action):** upgrade CTA placement adapts — off-table primary, during live hand tertiary or absent.

### Mobile-Landscape highlights

- **H-ML06:** pricing page buttons, paywall modal CTAs, cancellation confirm — all ≥ 44×44 at scaled measurement.
- **H-ML04:** pricing comparison table at 1600×720 under `useScale` — Gate 4 scaled-measures.

### Project-specific heuristics (NEW)

- **H-SC01 — Paywall never interrupts active work.** Mid-hand quota-exhaustion defers to hand-end. Non-negotiable.
- **H-SC02 — Trial state legible outside settings.** Free-tier user can check tier in ≤ 2 taps from anywhere.

### The paywall-spectrum compatibility matrix under Q1 verdicts

| Bundle | Q1=A (doctrine-clean) | Q1=B (selective) | Q1=C (commerce unbound) |
|---|---|---|---|
| α doctrine-clean session-scoped | ✓ Recommended | ✓ Allowed | ✓ Allowed but loses positioning |
| β conventional 14-day trial | ❌ Disqualified | ⚠️ Case-by-case | ✓ Allowed |
| γ Scholar mastery-ladder | ✓ Allowed (streak refused) | ✓ Allowed | ✓ Allowed |
| δ founding-member + indefinite-free | ✓ Recommended seed | ✓ Allowed | ✓ Allowed |
| ε Ignition SKU separate | ✓ Allowed | ✓ Allowed | ✓ Allowed |

**Autonomy voice advocacy:** Q1=A. The doctrine-differentiator is non-trivial marketing asset; M1 ("no streaks, no guilt, two-tap cancel") directly markets the doctrine as a product feature. Conversion cost of bundles α+δ is recoverable.

### Recommended follow-ups

- [ ] **Gate 4:** charter §Acceptance Criteria expanded with 10 commerce red lines enumerated inline (mirror EAL pattern).
- [ ] **Gate 4:** `docs/projects/monetization-and-pmf/anti-patterns.md` with 12 initial refusals (extensible at surface design).
- [ ] **Gate 4:** CI-linted forbidden-string check on all commerce copy (mirror EAL `calibrationCopy.js` + `retirementCopy.js` pattern).
- [ ] **Gate 4:** `heuristics/poker-live-table.md` updated with H-SC01 + H-SC02 (new project-specific).
- [ ] **Gate 5:** in-app test assertions for each of the 10 red lines — mirror EAL-G5-RL pattern.

---

## Overall verdict

**YELLOW.**

The feature is structurally sound. Persona patterns inherit cleanly from existing framework. Autonomy doctrine can extend to commerce UX if Q1=A lands. Competitive positioning is genuinely differentiated space. Stream D telemetry foundation gives a path to evidence-based pricing decisions.

Real risks are narrow: Q1 verdict unresolved, Q7 legal posture unresolved, dark-pattern cancellation is industry's most common integrity failure and must be enforced explicitly, and Evaluator persona is authored cold-start without evidence (telemetry-gated Verified status).

### Top 3 structural risks

1. **Dark-pattern cancellation drift.** Industry's most common monetization integrity failure. Every SaaS eventually adds "are you sure?" confirmation layers, exit surveys, pause-instead interposition. Mitigated by dedicated `journeys/cancellation.md` + CI-linted copy at Gate 4.
2. **Q7 legal posture unresolved — blocks Ignition lane.** Public marketing + payment processor acceptance both gate on this. Gate 3 schedules legal scoping.
3. **Evaluator evidence gap.** 3 PROTO personas without ledger entries. Gate 3 ratification is structural (owner-confirmed); evidential Verified status waits on Stream D 30–60-day telemetry window.

### Top 3 required Gate 4 items (non-negotiable)

1. **10 commerce red lines enumerated in charter §Acceptance Criteria** (replacing implicit reference).
2. **`anti-patterns.md`** with 12 initial refusals + CI-linted forbidden-copy-strings check.
3. **Surface specs** for pricing-page + paywall-modal + upgrade-prompt-inline + trial-state-indicator + billing-settings + evaluator-onboarding journey + paywall-hit journey + **cancellation journey (dark-pattern-free)**.

### Top 3 required Gate 3 items

1. **Owner interview Q1–Q8** — especially Q1 (doctrine scope), Q7 (legal posture), Q8 (telemetry consent default).
2. **10 JTBDs authored** (SA-71..78 + CC-88 + ON-88) — 3 more than the charter's 7.
3. **3 personas ratified** (PROTO → Owner-Confirmed; Verified waits on telemetry).

### Gate 3 requirement

**Required per LIFECYCLE.md** — YELLOW Gate 2 triggers Gate 3. Scoped moderate (10 JTBDs + 8 owner-interview questions + 3 persona ratifications + optional Ignition-mode situational). Comparable to EAL Gate 3; not as heavy as Shape Language Gate 3.

---

## Owner interview questions (Gate 3 kickoff)

Inherited from charter Q1–Q8 + 1 from Stage B (domain-split) + 1 from Stage A (evaluator-ignition-mode situational). Total 10 questions. Each answer shapes Gate 4 surface specs.

**From charter §Gate 3 Owner Interview Questions:**

1. **Q1 — Doctrine scope.** (A) all commerce / (B) selective / (C) skill-only. **Pivotal.**
2. **Q2 — Sequencing.** (A) telemetry-first / (B) parallel soft-launch / (C) pricing-first.
3. **Q3 — Ignition commercial lane timing.** (A) now / (B) parallel / (C) defer.
4. **Q4 — Founding-member mechanism.** (A) $299 lifetime cap 50 / (B) $99/yr price-lock / (C) $19/mo standard.
5. **Q5 — Free-tier shape.** (A) session-scoped / (B) hand-quota / (C) feature-subset.
6. **Q6 — Scholar fork.** (A) distinct / (B) subset of Chris / (C) defer.
7. **Q7 — Ignition legal/ToS posture.** Open scope — requires legal consultation before verdict.
8. **Q8 — Telemetry consent default.** (A) opt-in / (B) opt-out with panel / (C) tier-dependent.

**New from this audit:**

9. **Q9 — JTBD domain split.** Keep 11 SA-* entries in `subscription-account.md`, OR split SA-76..78 into new `billing-management.md` domain?
10. **Q10 — Evaluator-ignition-mode situational.** Author a dedicated `evaluator-ignition-mode.md` situational, OR keep E-IGNITION as a sub-shape attribute of unified Evaluator?

Recommended starting positions (Autonomy voice):
- **Q1 = A** (doctrine binds commerce — positioning differentiator).
- **Q2 = B** (parallel soft-launch — founding-member + telemetry in parallel; fastest learning).
- **Q3 = C** (defer Ignition commercial lane pending Q7 legal scoping).
- **Q4 = A** ($299 lifetime cap 50).
- **Q5 = A** (session-scoped free).
- **Q6 = C** (defer Scholar fork until telemetry signal lands).
- **Q7 = schedule legal scoping session** before verdict.
- **Q8 = B** (opt-out with first-launch transparency panel + always-visible off-switch).
- **Q9 = split into billing-management.md** — cleaner domain separation.
- **Q10 = keep E-IGNITION as attribute of unified Evaluator** — less persona fragmentation; Gate 4 first-run surface branches on the attribute.

Each verdict documented in `gate3-owner-interview.md` with rationale + Gate 4 implications + carry-forwards.

---

## Required follow-ups

### Gate 3 (Research + JTBD authoring + ratification) — scope

- [ ] Author 10 JTBDs (SA-71..78 + CC-88 + ON-88) in `docs/design/jtbd/domains/`.
- [ ] Decide domain-split: single `subscription-account.md` or split with new `billing-management.md`.
- [ ] Author `evaluator-ignition-mode.md` situational (Q10 verdict-dependent).
- [ ] Owner interview on Q1–Q10; answers recorded in `gate3-owner-interview.md`.
- [ ] Ratify 3 PROTO personas → Owner-Confirmed; change-log entries updated.
- [ ] **Out-of-scope note:** streak / leaderboard / gamified-referral explicitly refused with autonomy rationale.
- [ ] Schedule separate Q7 legal-scoping session.
- [ ] Re-run Gate 2 against updated framework; verdict GREEN expected.

### Gate 4 (Design) — scope

- [ ] **10 commerce red lines** enumerated in charter §Acceptance Criteria.
- [ ] **`anti-patterns.md`** with 12 initial refusals + CI-lint pattern.
- [ ] **`WRITERS.md`** at `docs/projects/monetization-and-pmf/WRITERS.md` for `subscription` store.
- [ ] **Surface specs** (6 files + SettingsView extension):
  - `surfaces/pricing-page.md`
  - `surfaces/paywall-modal.md`
  - `surfaces/upgrade-prompt-inline.md`
  - `surfaces/trial-state-indicator.md`
  - `surfaces/billing-settings.md` (or SettingsView extension spec)
  - `surfaces/telemetry-consent-panel.md`
- [ ] **Journeys** (3 files):
  - `journeys/evaluator-onboarding.md`
  - `journeys/paywall-hit.md`
  - `journeys/cancellation.md` — dark-pattern-free copy-discipline enforced
  - `journeys/plan-change.md` — SA-76 upgrade/downgrade
- [ ] **`heuristics/` updates** — H-SC01 + H-SC02 added to `heuristics/poker-live-table.md` or project-specific heuristics doc.
- [ ] **`assumption-ledger.md`** with 12–15 load-bearing assumptions (M1–M8 from Session 1 + M9–M12 from Market voice + 3–5 additional at Gate 4 authoring).
- [ ] **Bundle ε structured as strict-superset** of Pro confirmed.
- [ ] **Entitlement state architecture decision** (main-app IDB + extension subscribes via WebSocket).
- [ ] **Ignition-mode surface design** (only if Q3 verdict ≠ C).

### Gate 5 (Implementation) — constraints to propagate

- [ ] Entitlement reducer + EntitlementContext + useEntitlement hook (additive pattern).
- [ ] IDB v17/v18 → v19 migration with `subscription` store (additive, ~5 writers).
- [ ] Payment processor integration (Stripe default; Paddle/LemonSqueezy pending Q7).
- [ ] PaywallGate shared component (feature-gate wrapper).
- [ ] BillingSettings extension of SettingsView.
- [ ] PostHog install + event schema v1 (Q8-gated).
- [ ] In-app test assertions for 10 commerce red lines.
- [ ] CI-linted forbidden-copy-strings check on commerce copy.
- [ ] H-SC01 test — paywall never fires during active hand entry.

---

## Backlog proposals

Copy-paste ready for `.claude/BACKLOG.md`:

```
- [P0] [MPMF-G2] Gate 2 blind-spot audit (3 voices) — verdict YELLOW; 3 structural risks; 10 commerce red lines; 12 anti-patterns; Gate 3 + Gate 4 + Gate 5 items enumerated
- [P0] [MPMF-G3-J1..J10] Author 10 JTBDs (SA-71..78 + CC-88 + ON-88)
- [P0] [MPMF-G3-DS] JTBD domain-split decision (subscription-account.md vs +billing-management.md)
- [P0] [MPMF-G3-P1..P3] Ratify 3 personas PROTO → Owner-Confirmed (evaluator + trial-first-session + returning-evaluator)
- [P0] [MPMF-G3-P4] Author evaluator-ignition-mode.md situational (conditional on Q10)
- [P0] [MPMF-G3-O] Owner interview — Q1–Q10 verdicts
- [P0] [MPMF-G3-OOS] Document out-of-scope anti-patterns (streak / leaderboard / gamified-referral)
- [P0] [MPMF-G3-Q7] Q7 legal-scoping session scheduled
- [P0] [MPMF-G3-RR] Gate 2 re-run against updated framework
- [P0] [MPMF-G4-ACP] Expand charter §Acceptance Criteria with 10 commerce red lines inline
- [P0] [MPMF-G4-AP] anti-patterns.md with 12 refusals
- [P0] [MPMF-G4-W] WRITERS.md for subscription store
- [P0] [MPMF-G4-S1] surfaces/pricing-page.md
- [P0] [MPMF-G4-S2] surfaces/paywall-modal.md
- [P0] [MPMF-G4-S3] surfaces/upgrade-prompt-inline.md
- [P0] [MPMF-G4-S4] surfaces/trial-state-indicator.md
- [P0] [MPMF-G4-S5] surfaces/billing-settings.md (SettingsView extension)
- [P0] [MPMF-G4-S6] surfaces/telemetry-consent-panel.md
- [P0] [MPMF-G4-J1] journeys/evaluator-onboarding.md
- [P0] [MPMF-G4-J2] journeys/paywall-hit.md
- [P0] [MPMF-G4-J3] journeys/cancellation.md — dark-pattern-free
- [P0] [MPMF-G4-J4] journeys/plan-change.md — SA-76 upgrade/downgrade
- [P0] [MPMF-G4-HT] heuristics/ updates — H-SC01 + H-SC02 new poker-specific
- [P0] [MPMF-G4-AL] assumption-ledger.md — 12–15 falsifiable assumptions (M1–M12 + 3–5 new)
- [P1] [MPMF-G4-ES] Bundle ε structured as strict-superset of Pro confirmed
- [P1] [MPMF-G4-EA] Entitlement architecture decision — main-app IDB + extension-via-WebSocket
- [P1] [MPMF-G4-IM] Ignition-mode surface design (conditional on Q3)
- [P0] [MPMF-G5-ER] Entitlement reducer + EntitlementContext + useEntitlement hook
- [P0] [MPMF-G5-IDB] IDB migration + subscription store
- [P0] [MPMF-G5-PP] Payment processor integration (Stripe or per Q7)
- [P0] [MPMF-G5-PG] PaywallGate shared component
- [P0] [MPMF-G5-BS] BillingSettings extension of SettingsView
- [P0] [MPMF-G5-PH] PostHog install + event schema v1 (Q8-gated)
- [P0] [MPMF-G5-RL] In-app test assertions for 10 commerce red lines
- [P0] [MPMF-G5-CL] CI-linted forbidden-copy-strings check
- [P0] [MPMF-G5-SC] H-SC01 test — paywall never fires mid-hand
- [P2] [MPMF-P8-EX] Extension doctrine rule in ignition-poker-tracker/CLAUDE.md — entitlement-read-only
```

---

## Change log

- 2026-04-24 — Draft. Gate 2 blind-spot audit for Monetization & PMF. 3-voice roundtable synthesis (Product/UX, Autonomy skeptic, Market lens). Verdict YELLOW with 3 structural risks + 10 commerce red lines + 12 anti-patterns + 10 Gate 3 research items + 21 Gate 4 items + 9 Gate 5 items. Gate 3 required per LIFECYCLE.md; scoped moderate (10 JTBDs + 10 owner-interview questions + 3 persona ratifications). Q1 (doctrine scope) + Q7 (legal/ToS) are the two blocking questions for Gate 4 surface design progress.
