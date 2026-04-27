# JTBD Domain — Subscription / Account / Access

Jobs around account creation, tier selection, and access boundaries — the "getting to a paid tier" arc. Ongoing subscription state management (plan changes, payment methods, renewal transparency) moved to [billing-management domain](./billing-management.md) per Monetization & PMF Gate 3 Q9 verdict. Mix of Proposed (no code yet) and Active (pending Monetization & PMF Gate 4 surface design). SA-71..75 authored 2026-04-24 as part of Monetization & PMF Gate 3 — each promotes from implicit to explicit JTBD with autonomy-constraint inheritance where applicable.

**Primary personas:** All. Acute for [Evaluator](../../personas/core/evaluator.md) (prospective-buyer cognitive state; SA-71..75 primary), [Coach](../../personas/core/coach.md), [Banker](../../personas/core/banker-staker.md), [Ringmaster](../../personas/core/ringmaster-home-host.md) (group sub), [Newcomer](../../personas/core/newcomer.md) (free → paid conversion).

**Surfaces:** `SettingsView` (auth exists), billing / tier UI (doesn't exist; Gate 4 surface specs pending).

---

## SA-64 — Free tier with real value

> When I'm new to the app, I want a free tier that has enough value to be worth using, so I can evaluate before paying.

- See [tier-0-free](../../tiers/tier-0-free.md).
- **Primary persona (new):** [Evaluator](../../personas/core/evaluator.md). Pairs with SA-71.

## SA-65 — Tier comparison before purchase

> When considering upgrading, I want a clear feature comparison across tiers, so I pick the right one.

- **Primary persona:** [Evaluator](../../personas/core/evaluator.md).

## SA-66 — Transparent billing + easy pause

> When my subscription renews, I want transparent billing, and if I need to pause, I can without friction, so I don't feel trapped.

- Pairs with SA-74 (cancel-without-friction) and SA-78 (know-when-ill-be-billed) — together compose the red-line-#2 (transparency on demand) + red-line-#3 (durable override) stack.

## SA-67 — Multi-region access

> When traveling, I want the app to work in my destination country without region-specific friction.

## SA-68 — Granular coach / student permissions

> When I share with a coach, I want granular control — hands yes, bankroll no, notes maybe, so privacy is mine.

## SA-69 — Team / seat-based billing

> When I run a team (staker + horses, coach + students), I want seat-based billing, so it scales.

## SA-70 — Local-only mode (no cloud) with full features

> When I don't want my data synced (paranoid pro, data sovereignty), I want local-only mode with full features, so I control my data.

- Active today by default — IndexedDB is local. Explicit "no-sync" mode would formalize.

---

## SA-71 — Try the product before paying

> When I discover the app and I'm unsure whether it solves my problem, I want to experience its core value without paying or committing, so I can decide based on reality, not marketing.

- State: **Active** (pending Monetization & PMF Gate 4).
- **Primary persona:** [Evaluator](../../personas/core/evaluator.md) in [trial-first-session](../../personas/situational/trial-first-session.md) state. Returning-evaluator re-visits the same JTBD in subsequent evaluation sessions.
- **Autonomy constraint:** inherits red line #1 (opt-in enrollment). Evaluation does NOT require account creation, email, or payment before felt value. First-launch paywall (L1 in paywall-spectrum doc) is disqualified under this JTBD.
- **Mechanism:**
  - Free tier (SA-64) shape decided at Q5 owner verdict (session-scoped / hand-quota / feature-subset candidates).
  - Sample-data mode (ON-86) available for evaluator with no data to import.
  - Paywall triggers only after felt-value moments: usage-threshold (L3), history-access (L4), depth-of-analysis (L6), never at first launch.
- **Served by:** `surfaces/pricing-page.md`, `journeys/evaluator-onboarding.md` (Gate 4, pending Q1 verdict).
- **Distinct from:**
  - **SA-64** (free tier with real value) — SA-64 is product-design ("the free tier must have value"); SA-71 is user-journey ("let me experience it"). SA-64 is a system property; SA-71 is an experiential outcome.
  - **SA-65** (tier comparison before purchase) — SA-65 is information architecture ("show me a comparison table"); SA-71 is experiential ("let me use the thing"). A user can satisfy SA-65 by reading alone; SA-71 requires hands-on.
- Doctrine basis: Monetization & PMF Gate 2 audit §Stage B + charter §Q5 + paywall-spectrum §L1 disqualification.

## SA-72 — Understand what's free, what's paid, and why

> When I'm using the app, I want to know at a glance which features are free and which require payment, so I don't discover paywalls by accident and can plan my usage.

- State: **Active** (pending Monetization & PMF Gate 4).
- **Primary persona:** [Evaluator](../../personas/core/evaluator.md) during trial-first-session and returning-evaluator states. Also serves already-committed users who are considering tier changes.
- **Autonomy constraint:** inherits red line #7 (editor's-note tone) — tier-state indicator is factual, not cajoling. Inherits red line #8 (no cross-surface contamination) — indicator never interrupts live-play.
- **Mechanism:**
  - Trial-state indicator (H-SC02) visible in ≤2 taps from anywhere. Likely a small chip in top-right nav or within SettingsView.
  - Inline locked-feature badges where a feature is tier-gated ("Plus feature" chip; tap → informational explainer, not aggressive upsell).
  - Pricing-page link within SettingsView + within every paywall-surfaced modal.
- **Served by:** `surfaces/trial-state-indicator.md`, `surfaces/pricing-page.md`, inline badges on gated features (Gate 4).
- **Distinct from:**
  - **SA-65** (tier comparison before purchase) — SA-65 is pre-purchase decision; SA-72 is intra-session legibility ("which of these things I'm looking at is paid?").
  - **SA-66** (transparent billing + easy pause) — SA-66 is post-purchase billing transparency; SA-72 is feature-level paid-vs-free transparency.
- Doctrine basis: Monetization & PMF Gate 2 audit §Stage E + H-SC02 new project-specific heuristic.

## SA-73 — Hit a paywall with dignity

> When I reach the edge of what my tier offers, I want a dignified upgrade moment that respects my autonomy and frames the gate factually, so I'm not manipulated into paying and so the trust I have in the app isn't damaged at this friction point.

- State: **Active** (pending Monetization & PMF Gate 4).
- **Primary persona:** [Evaluator](../../personas/core/evaluator.md) + any free-tier user hitting a usage threshold.
- **Autonomy constraint:** inherits red lines #5 (no engagement-pressure), #7 (editor's-note tone), #8 (no cross-surface contamination). Paywall copy uses CTA register C5 (factual) or C6 (editor's-note) per paywall-spectrum doc. Timer-urgency, loss-framing, social-pressure copy registers are forbidden under Q1=A (pending owner verdict).
- **Mechanism:**
  - Paywall modal (Gate 4 surface) triggers at usage-threshold (L3) or history-access (L4) or depth-of-analysis (L6). Never first-launch (L1) or time-trial-end (L7 under Q1=A).
  - Copy states the fact: "Free tier: 3 deep analyses per session. You've used 3 of 3." Offers: "Upgrade" + equal-weight "Keep free" button.
  - H-SC01 binding: paywall never fires mid-hand. If quota exhausts mid-hand, defer modal to hand-end.
  - Dismissal-respect: a dismissed paywall on a given surface does not re-fire for ≥7 days per H-N07.
- **Served by:** `surfaces/paywall-modal.md`, `journeys/paywall-hit.md` (Gate 4).
- **Distinct from:**
  - **SA-65** (tier comparison before purchase) — SA-65 is browse-to-buy decision; SA-73 is felt-loss-to-buy moment. Different motivations, different surface treatments.
  - **SA-71** (try before paying) — SA-71 is evaluator pre-paywall state; SA-73 is the paywall-touch moment itself.
- Doctrine basis: Monetization & PMF Gate 2 audit §Stage E + §Q1 doctrine scope + 10 commerce red lines + 12 anti-patterns (MPMF-AP-01, 02, 03, 05, 07, 09).

## SA-74 — Cancel without friction

> When I decide to cancel my subscription, I want to cancel in ≤2 taps without exit surveys, guilt trips, or pause-instead traps, so cancellation is cancellation and my trust in the app is preserved through this friction point.

- State: **Active** (pending Monetization & PMF Gate 4).
- **Primary persona:** Any paying user. Highest-stakes for autonomy doctrine — cancellation is where industry monetization integrity most commonly fails.
- **Autonomy constraint:** load-bearing for **red line #10** (no dark-pattern cancellation — new in Monetization & PMF Gate 2 audit). Also inherits #3 (durable override — cancellation fully respected), #4 (reversibility — cancellation reversible before billing period ends), #7 (editor's-note tone — no guilt), #5 (no engagement-pressure — no "we miss you" copy).
- **Mechanism:**
  - Path: SettingsView → Billing → Cancel → Confirm. ≤2 taps from billing settings.
  - Optional exit survey is **offered, not interposed** — the cancel button is the primary action on the confirm screen; survey is below.
  - "Pause instead" is offered with **equal visual weight** to cancel (not pre-selected, not dark-pattern-boosted).
  - Confirmation copy is factual: "Cancel [tier]. You'll keep access through [date]. You can come back any time — your account and data are preserved." Forbidden copy per MPMF-AP-06: "downgrade" framing on cancellation.
  - Post-cancel state honored: no upsell banners, no degraded UI teasing the plan, no re-subscription prompts for ≥90 days.
  - Data retention: local IDB preserved; no server-side deletion unless user explicitly requests via separate action.
- **Served by:** `journeys/cancellation.md` (Gate 4 — CI-linted forbidden-copy enforcement mandatory).
- **Distinct from:**
  - **SA-66** (transparent billing + easy pause) — SA-66 covers pause; SA-74 covers cancel. Pause and cancel are distinct actions with different downstream state.
  - **SA-76** (switch between plan tiers) — downgrade-to-lower-tier is plan-change, not cancellation. Cancellation is to-free-tier-or-no-account.
- Doctrine basis: Monetization & PMF Gate 2 audit §Stage E red line #10 + MPMF-AP-05 (cancellation retention traps) + MPMF-AP-06 (downgrade framing). Industry context: GTO Wizard cancellation requires email contact per user reports (anti-pattern this JTBD prevents).

## SA-75 — Evaluate the sidebar separately from the main app

> When I'm evaluating the online-poker sidebar (Ignition extension), I want it treated as its own commercial lane — its own pricing, its own trial, its own cancellation — without bundling into main-app marketing or billing UX, so my legal posture and payment expectations are clear.

- State: **Active** (pending Monetization & PMF Gate 4 + Q3 verdict for Ignition lane timing + Q7 legal scoping).
- **Primary persona:** [Evaluator](../../personas/core/evaluator.md) in E-IGNITION sub-shape (per `evaluator.md` §Evaluator sub-shapes). Secondary: existing [Multi-tabler](../../personas/core/multi-tabler.md) and [Online MTT Shark](../../personas/core/online-mtt-shark.md) personas considering the sidebar.
- **Autonomy constraint:** inherits red line #8 (no cross-surface contamination). Main-app commerce state does NOT leak into sidebar UX; sidebar commerce state does NOT leak into main-app UX. Bundle ε per paywall-spectrum doc is structured as strict-superset (Ignition includes Pro features) to avoid cross-product state gaps.
- **Mechanism:**
  - Separate SKU with independent pricing (~$69–99/mo hypothesis, pending market validation).
  - Separate pricing page OR clearly-demarcated Ignition section on unified pricing page (Gate 4 decision).
  - Entitlement state: main-app IDB source of truth; extension subscribes via existing WebSocket bridge (no independent extension-side entitlement state).
  - Q7 legal scoping gates public marketing: ToS posture for US grey-market operator, payment-processor acceptability (Stripe risk), marketing-channel constraints (YouTube/Twitter poker-content policies).
- **Served by:** `surfaces/pricing-page.md` (Ignition section or separate surface — Gate 4 decision), `ignition-poker-tracker/` extension (existing).
- **Distinct from:**
  - **SA-64** (free tier with real value) — SA-64's free tier applies to main-app; Ignition lane has its own free/paid structure (Q3-verdict-gated).
  - **SA-65** (tier comparison before purchase) — SA-65 comparison may or may not include Ignition depending on pricing-page structure decision.
- Doctrine basis: Monetization & PMF Gate 2 audit §Stage D + charter §Q3 + §Q7 + paywall-spectrum bundle ε.

---

> **SA-76, SA-77, SA-78 moved to [billing-management.md](./billing-management.md)** per Monetization & PMF Gate 3 Q9 verdict (2026-04-24). IDs retain `SA-*` prefix in new domain for reference persistence; new billing-management entries use `BM-*` prefix going forward.

---

## Domain-wide constraints

- Nothing in this domain is implemented as tier-gating code today. The framework documents what tiers *would* look like.
- Auth exists (Firebase); tier is not expressed in user data.
- Billing is Gate 5 scope for Monetization & PMF project — not before.
- **Q1 doctrine scope verdict** (Monetization & PMF Gate 3 owner interview) determines which autonomy red lines bind commerce UX. SA-71..78 authored Q1-agnostic with red-line inheritance noted; Gate 4 surfaces commit to a Q1 verdict.
- **Q9 domain-split** (Monetization & PMF Gate 3 owner interview, verdicted 2026-04-24 = A) **executed**: SA-76/77/78 moved to [billing-management.md](./billing-management.md). This file now holds SA-64..75.

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-04-24 — Added SA-71 (try-before-paying) + SA-72 (understand-free-vs-paid) + SA-73 (hit-paywall-with-dignity) + SA-74 (cancel-without-friction) + SA-75 (evaluate-sidebar-separately) + SA-76 (switch-between-plan-tiers) + SA-77 (manage-payment-method) + SA-78 (know-when-ill-be-billed). Output of Gate 3 for Monetization & PMF project. 8 new JTBDs; range bumped SA-64..70 → SA-64..78. Each JTBD includes autonomy-constraint inheritance + distinct-from-siblings paragraph. Q9 domain-split deferred to owner verdict at Gate 3 interview. See `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md` + `docs/projects/monetization-and-pmf.project.md`.
- 2026-04-24 (later same day) — Q9 verdict = A → SA-76/77/78 moved to [billing-management.md](./billing-management.md); this file now holds SA-64..75. IDs preserved (not renumbered) for reference persistence in the 3 newly-moved entries. New billing-management entries going forward use `BM-*` prefix. Range for SA domain now SA-64..75; BM domain added to ATLAS as 16th domain.
