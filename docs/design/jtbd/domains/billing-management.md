# JTBD Domain — Billing Management

Jobs around managing ongoing subscription state — tier migration, payment-method updates, renewal transparency. Distinct from the [subscription / account / access](./subscription-account.md) domain which covers access + evaluation + cancellation JTBDs (the "getting to a paid tier" arc). This domain covers the "ongoing subscription state" arc.

All entries Active pending Monetization & PMF Gate 4 surface design. Split from `subscription-account.md` 2026-04-24 per Gate 3 Q9 verdict — IDs retain `SA-*` prefix (persistence over renumber) to avoid breaking existing references; new entries in this domain going forward use `BM-*` prefix.

**Primary personas:** Any paying user. Acute at card-expiry / bankroll-reassessment / quarter-end / subscription-renewal moments.

**Surfaces:** `SettingsView` → BillingSettings panel (doesn't exist; Gate 4 spec at `surfaces/billing-settings.md`). Related journeys at `journeys/plan-change.md` (SA-76) + `journeys/cancellation.md` (SA-74, in subscription-account.md).

---

## SA-76 — Switch between plan tiers

> When my needs change — I want more features, or I want to save money — I want to upgrade or downgrade my plan without friction and without losing my data, so tier flexibility matches my actual usage.

- State: **Active** (pending Monetization & PMF Gate 4).
- **Primary persona:** Any paying user. Acute at quarter-end / bankroll-reassessment moments.
- **Autonomy constraint:** inherits red lines #2 (transparency — clear about proration, refund, or effective-date), #3 (durable override — tier change is honored), #4 (reversibility — recent changes reversible within billing period). Downgrade-framing as "reducing your capability" is forbidden per MPMF-AP-06 (although MPMF-AP-06 is primarily about cancellation, the framing rule extends).
- **Mechanism:**
  - Path: SettingsView → Billing → Change Plan → [pick new tier] → Confirm.
  - Proration: upgrade is immediate with prorated charge; downgrade is effective at next billing period with credit issued if applicable (factual, stated upfront).
  - Data preservation: downgrading to a lower tier preserves data generated on higher tier — features become inaccessible, data does not disappear. (Related to SA-70 local-only mode philosophy.)
  - Confirmation copy is factual: "Change to [tier]. Effective [date]. Your data is preserved."
- **Served by:** `journeys/plan-change.md` (Gate 4 — distinct from `journeys/cancellation.md`).
- **Distinct from:**
  - **SA-65** (tier comparison) — SA-65 is pre-decision comparison; SA-76 is execution of the decision.
  - **SA-74** (cancel without friction) — cancel is to-free-tier-or-no-account; SA-76 is between-paid-tiers. Both respect red line #10 (no dark-pattern retention).
- Doctrine basis: Monetization & PMF Gate 2 audit §Stage B (Market voice) — every SaaS has this implicit; explicit authoring forces Gate 4 to design the flow.

## SA-77 — Manage payment method without churning

> When my card expires, I move banks, or I want to update billing information, I want to update it without losing my subscription state or being forced through retention flows, so billing-info management is separate from plan management.

- State: **Active** (pending Monetization & PMF Gate 4).
- **Primary persona:** Any paying user. Historical user pain point in the category — PokerTracker annual-license renewal complaints document this friction.
- **Autonomy constraint:** inherits red line #2 (full transparency on demand) — current card on file clearly displayed (last-4 + expiry); never hidden behind extra clicks.
- **Mechanism:**
  - Path: SettingsView → Billing → Payment Method → Update.
  - Card update does NOT trigger retention flow, re-auth, or subscription reconfirmation.
  - Clear status: "Card on file: •••• 4242, expires 12/27" visible on BillingSettings panel.
  - Failed payment (card expired without update, card declined) → grace period before subscription degrades; email transactional notification; in-app banner if user opens app during grace.
- **Served by:** `surfaces/billing-settings.md` §Payment Method (Gate 4 — SettingsView extension).
- **Distinct from:**
  - **SA-74** (cancel) — card update is not cancellation; must never trigger cancellation flow.
  - **SA-76** (plan change) — card update is not plan change; independent action.
- Doctrine basis: Monetization & PMF Gate 2 audit §Stage B (Market voice) + category-precedent user-pain-point evidence.

## SA-78 — Know when I'll be billed and for how much

> When my subscription renews, I want to know exactly when the charge will happen and how much it will be, surfaced in the app ahead of time — not buried in email receipts or hidden under multiple clicks, so renewal is never a surprise.

- State: **Active** (pending Monetization & PMF Gate 4).
- **Primary persona:** Any paying user.
- **Autonomy constraint:** load-bearing for **red line #2** (full transparency on demand). Any ambiguity here is an autonomy violation. Also binds MPMF-AP-11 (silent auto-renewal is refused — renewal has advance in-app visibility).
- **Mechanism:**
  - Billing panel in SettingsView shows next bill date + amount + plan name at all times (not gated behind a click).
  - In-app banner (optional, non-urgent) 3 days before renewal: "Your [tier] subscription renews [date] for [amount]."
  - Transactional email at charge time — receipt, not marketing.
  - Under red line #5, no "don't miss out" pre-renewal pressure. Banner is informational, dismissable, non-re-firing.
- **Served by:** `surfaces/billing-settings.md` §Next Bill (Gate 4).
- **Distinct from:**
  - **SA-66** (transparent billing + easy pause) — SA-66 is retrospective + pause-focused; SA-78 is prospective (next bill visibility).
  - **CC-80** (configurable alerts / notifications) — SA-78 uses passive in-app surfacing, not push notifications. Push channels for monetization are refused per MPMF-AP-04.
- Doctrine basis: Monetization & PMF Gate 2 audit §Stage E red line #2 + MPMF-AP-11 (silent auto-renewal refused) + Market voice §Stage B.

---

## Domain-wide constraints

- Inherits all 10 commerce red lines from Monetization & PMF charter §Acceptance Criteria (Q1=A verdict — red lines bind all commerce UX).
- New entries in this domain going forward use `BM-*` prefix starting at BM-01. SA-76/77/78 retain their IDs for reference persistence.
- All entries currently Active pending Gate 4 surface design; no code shipped in this domain yet.
- CI-linted forbidden-copy-strings check applies to any Gate 4 copy in this domain (mirrors EAL `retirementCopy.js` pattern).

## Change log

- 2026-04-24 — Created. Split from `subscription-account.md` per Monetization & PMF Gate 3 Q9 verdict. Contains SA-76/77/78 (tier-migration / payment-method-management / renewal-transparency). See `docs/projects/monetization-and-pmf/gate3-owner-interview.md` §Q9 for split rationale + `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md` §Stage B for authoring basis.
