# Gate 2 Voice 03 — Market Lens

**Project:** Monetization & PMF
**Date:** 2026-04-24
**Stages covered:** B (JTBD coverage — market framing), C (situational stress — competitive context), D (cross-product — Ignition commercial lane)

---

## Opening framing

I carry the external market data from Session 1's research into this roundtable. My job is to stress-test the persona + JTBD + paywall work against what the poker-tooling market actually looks like, not what the framework assumes. Three big concerns I want to put on the table:

1. **The Evaluator persona has no competitive benchmark.** Every existing poker tracker, HUD, and training site assumes already-committed users in their UX. The category has no precedent for Evaluator-first onboarding. This is both an opportunity (differentiation) and a risk (we have nothing to copy).
2. **The Ignition commercial lane is structurally constrained by grey-market posture.** Commercial decisions have legal tails that the Session 1 roundtable noted (Q7) but the charter doesn't yet address. Until Q7 is resolved, Stream E (soft launch) can't include Ignition SKU because marketing it publicly is legally risky.
3. **The JTBDs in the atlas are under-specified for commerce.** SA-64..75 + CC-88 + ON-88 are a good start but miss 2–3 JTBDs around *renewal* and *tier migration* that every SaaS product in the category has implicitly. Gate 3 should expand to 9–10 JTBDs, not 7.

---

## Stage B — JTBD coverage (market-framed)

### The 7 proposed JTBDs reviewed

- **SA-71 (Try before paying)** — ✓ Standard. Every competitor has this. PokerTracker and Holdem Manager have 30-day demos. GTO Wizard has permanent free tier. Run It Once has permanent free tier with limited library. This is table stakes.
- **SA-72 (Understand what's free/paid)** — ✓ Under-served in category. GTO Wizard's pricing page is famously dense (5 tiers). Simpler tier clarity is a differentiator.
- **SA-73 (Hit paywall with dignity)** — ⚠️ Novel in category. Most competitors use standard SaaS paywall modals; "dignity" framing is unique positioning. Market has no reference point.
- **SA-74 (Cancel without friction)** — ✓ Under-served. GTO Wizard cancellation requires email contact per user reports. Straightforward self-serve cancel is a marketable differentiator.
- **SA-75 (Evaluate sidebar separately)** — ✓ Rare. Only applicable to our specific two-SKU architecture. No direct competitor has this shape.
- **CC-88 (Honest telemetry)** — ⚠️ Novel in category. No competitor foregrounds telemetry transparency. Market has no reference point.
- **ON-88 (Expert-bypass for evaluators)** — ✓ Partially in market. GTO Wizard's free tier effectively serves this; not explicit. Upswing has no equivalent.

### Missing JTBDs (my proposed additions)

Three JTBDs the market has implicit that the project hasn't authored:

- **SA-76 — Switch between plan tiers.** When my needs change, I want to upgrade or downgrade without friction. Every SaaS in category has this implicit. Authoring it explicitly forces Gate 4 to consider upgrade/downgrade flows, not just cancellation.
- **SA-77 — Manage payment method without churning.** When my card expires or I want to update billing info, I can do so without losing my subscription. Billing-info management is distinct from plan management; every tracker with annual licenses has had user pain here historically (PokerTracker renewal complaints).
- **SA-78 — Know when I'll be billed and for how much.** Renewal transparency. Every SaaS best-practice doc lists this. The app should surface: next bill date, amount, plan name, and easy path to pause/cancel/change. Under red line #2 (transparency on demand), this becomes load-bearing.

### Why these matter specifically

**SA-76 exposes the tier-migration flow.** Gate 4 must have a surface for "upgrade Plus → Pro" and "downgrade Pro → Plus" — this is NOT the same as paywall-modal or pricing-page. It's a separate journey (`plan-change.md`).

**SA-77 + SA-78 expose billing-settings scope.** The charter's "extend SettingsView with BillingSettings section" needs to include: plan card, next-bill-date, payment method card, update payment-method action, change-plan action, cancel action, data-export action. Six distinct actions in one panel.

**None of these conflict with doctrine.** All three are factual-state JTBDs that the transparency + editor's-note red lines bind to.

### Domain taxonomy

Current `SA-64..75` all live in `subscription-account.md`. With SA-76/77/78, domain reaches 15 entries. Consider splitting `subscription-account.md` into `subscription-account.md` (SA-64..75 — access, evaluation, cancellation) + a new `billing-management.md` (SA-76..78 — ongoing subscription state). Gate 3 decides.

### Stage B output

⚠️ **Expansion needed (3 JTBDs to add, 0 to retire, 1 domain-split question).**

- SA-76, SA-77, SA-78 authored at Gate 3.
- Domain-split decision deferred to Gate 3 or Gate 4.

---

## Stage C — Situational stress (competitive context)

### How competitors handle trial-first-session

- **GTO Wizard:** free tier unlimited; no explicit "trial." Low friction, but evaluator doesn't know what's paid until they click a locked feature (which then shows the pricing page).
- **Upswing Lab:** no free tier; pricing page is front door; forced signup before any content. High friction.
- **Run It Once:** free tier = 20+ videos; locked videos show paywall. Clear tier boundary.
- **PokerTracker / Holdem Manager:** 30-day full-functionality demo; hard expiration; product becomes read-only after. Evaluator knows exactly when trial ends.
- **Hand2Note:** standard 14-day trial.

**My read:** this project's recommended bundle α (session-scoped free) sits between Run It Once (feature-subset free) and PT4/HM3 (time-limited full). The innovation is that *nothing expires* — user loses cross-session persistence but doesn't experience a cliff. Market has no direct precedent for this shape. Evaluator's reaction is uncertain; telemetry from Stream D will tell us.

### How competitors handle returning-evaluator

- **GTO Wizard:** no treatment; evaluator returns to same state.
- **Upswing Lab:** email re-engagement is heavy ("we miss you"). Violates our red line #5.
- **Run It Once:** similar to Upswing.
- **PokerTracker:** no meaningful re-engagement; product is a tool, users come back when they need it.
- **Hand2Note:** similar to PT.

**My read:** no competitor has a principled returning-evaluator design. This is genuinely differentiated design space. Session 1 noted "returning-evaluator opens to 'last session: N hands' factually" — this is novel and aligned with red lines. Gate 4 spec has room to innovate.

### Trial-at-live-table consideration

From Product/UX voice's Stage C concern: "does anyone trial the app at a live table?" Market evidence:
- PokerTracker demo use-case is post-session at home on desktop; at-table unusable.
- GTO Wizard is desktop-first; at-table evaluation is rare.
- **Pokeri** (the live iOS tracker most-similar to our live lane) **is explicitly designed for at-table use** in both trial and paid modes.

**My read:** E-CHRIS evaluators (live-poker shape) MAY trial at a table. This is NOT hypothetical — Pokeri's entire UX is calibrated for it. If we don't support at-table evaluator (even as degraded first-run), we cede the live-poker evaluator segment to Pokeri.

**Recommendation for Gate 4:** trial-first-session surface design includes an at-table path. If app detects real-session entry (live hands being recorded), sample-data mode dismisses and live engine takes primary. Learning curve is steeper at-table but market evidence says this is acceptable for live-poker evaluators.

### Stage C output

⚠️ **Targeted adjustments** — trial-at-table path needs Gate 4 spec. Not structural; a situational variant.

---

## Stage D — Cross-product (Ignition commercial lane)

### The Ignition SKU structural problem

Ignition is a **US grey-market operator.** It operates from outside US federal jurisdiction; its US-residing users play under state-level gambling-law ambiguity. Three commercial constraints flow from this:

1. **Public marketing of an Ignition-specific tool creates legal exposure.** Advertising "the best HUD for Ignition" on poker-content YouTube channels is actionable by Ignition's ToS enforcement (the sidebar may be seen as a prohibited third-party tool). It may also be actionable under state-level gambling-adjacent tool regulations.
2. **Payment processors (Stripe, Paddle) may reject categories associated with Ignition.** Stripe's prohibited business list includes some gambling-adjacent services. If "Ignition sidebar subscription" is flagged by Stripe's risk model, payment processing stops.
3. **The main-app is NOT in this legal category.** A live-poker tracker for in-person play has no grey-market exposure. Bundling Ignition SKU into main-app marketing contaminates the main-app's clean legal posture.

**My read:** Q7 (legal/ToS posture) must resolve before ANY public marketing copy for Ignition ships. Gate 3 schedules a legal-scoping session.

### Cross-product state concerns

If evaluator has main-app Pro but not Ignition SKU:
- Sidebar should gracefully degrade — possibly shows "unlock sidebar for online play" inline, but never forces the user to view main-app-Pro features via the sidebar path.
- Main-app should not expose Ignition-specific features in its UX (e.g., no "online" icons or references) for users who don't have Ignition SKU.
- Persistence: main-app hand history and Ignition sidebar hand history are separate streams. Evaluator who paid for main-app but not Ignition shouldn't be told "your sidebar data" exists if they never used the sidebar.

If evaluator has Ignition SKU but not main-app Pro:
- This is unusual — most sidebar users are paying a premium ($69–99/mo) that already includes main-app Pro.
- Charter's bundle ε wisely bundles Ignition-SKU as strict-superset of Pro (Ignition includes Pro features). This avoids the cross-product gaps entirely.

### Extension update mechanism concerns

The Chrome Web Store auto-updates extensions. If a paying Ignition user has an extension version that's behind the main-app version, does the sidebar still work? From EAL and SR-program lessons:

- Extension is designed version-compatible with wide range of main-app versions.
- Entitlement check must be synchronous (main-app can't wait on extension-side-panel handshake).
- Sidebar-visible features vs. sidebar-hidden-paywall features must not differ between extension versions.

**Recommendation:** entitlement state lives in main-app (IDB) and is passed to extension via the existing WebSocket bridge. Extension reads main-app entitlement; no independent entitlement state on extension side.

### Payment processor selection and Ignition

Session 1 flagged Stripe as default. With Q7 unresolved, Stripe may be risky. Alternatives:
- **Paddle** — handles international VAT, more permissive on grey-market-adjacent categories. More expensive per transaction.
- **LemonSqueezy** — newer, lighter, less-scrutinized.

**Recommendation:** Gate 5 payment-processor decision waits on Q7 + specific category categorization. If Ignition SKU is pitched as "online poker analysis tool," Stripe may reject. If pitched as "browser extension for poker research," Stripe may accept. Legal scoping determines this.

### Stage D output

⚠️ **Partner surfaces need updates; Q7 is the blocking question.**

1. Q7 legal scoping must resolve before Ignition marketing.
2. Entitlement state unified in main-app, passed to extension.
3. Bundle ε structured as strict-superset (Ignition includes Pro).
4. Payment processor selection deferred pending Q7.

---

## Stage B (revisited) — Market evidence for `assumption-ledger.md`

The Session 1 roundtable M1–M8 seeds land in `assumption-ledger.md` at Gate 3. My market-lens contribution to that ledger:

- **M9 (proposed) — Category WTP for live-tracker is capped at ~$35/mo.** Basis: Hand2Note $49–59 is online-only, Pokeri's live tier is reportedly in $15–25 range, PT4/HM3 annualized = ~$8/mo. Kill-criterion: if Pro-tier conversion >5% at $29/mo, assumption survives; if <2%, category ceiling is lower.
- **M10 (proposed) — Scholar-shape evaluator won't pay for another tool when GTO Wizard exists.** Basis: category crowding. Kill-criterion: if >20% of our paying users also subscribe to GTO Wizard, our Scholar position is complementary; if <5%, Scholar is cannibalized and we should retreat.
- **M11 (proposed) — Ignition-shape evaluator is willing to pay $69–99/mo if sidebar exceeds Hand2Note on capture quality.** Basis: Hand2Note's pricing ceiling + differentiation via live-HUD-for-live-poker. Kill-criterion: if Ignition-SKU conversion <2% at $79/mo among evaluators who install the extension, pricing is too high or differentiation isn't felt.
- **M12 (proposed) — Poker-content-community channels (Reddit, Twitter, YouTube) are the primary acquisition lane; paid ads are not.** Basis: category norm; GTO Wizard acquires via content marketing. Kill-criterion: if paid-ad CAC is <$20 after 30 days of testing, assumption falsified; if unachievable, content-marketing strategy validated.

---

## Summary of recommendations (my voice)

1. **Add SA-76, SA-77, SA-78 to Gate 3 JTBD authoring scope** (tier-migration, payment-method, renewal-transparency).
2. **Split subscription-account.md OR add billing-management.md domain** at Gate 3 if it reaches 15+ entries.
3. **Gate 3 schedule must include Q7 legal scoping session** before any Ignition commercial prep.
4. **Trial-at-table evaluator path in Gate 4 spec** — don't cede live-poker evaluators to Pokeri.
5. **Add M9–M12 market-framed assumptions to `assumption-ledger.md`** at Gate 3.
6. **Entitlement architecture: main-app source of truth, extension subscribes via WebSocket bridge.** Gate 4/5 implementation.
7. **Payment processor selection deferred to Gate 5 and gated on Q7.**
8. **Bundle ε (Ignition) structured as strict-superset of Pro** to avoid cross-product state gaps.

**Overall verdict from my voice:** YELLOW. The market context reinforces that the project is positioning in genuinely differentiated space, but Q7 legal scoping is blocking for Ignition commercial work and should be prioritized at Gate 3 alongside Q1.
