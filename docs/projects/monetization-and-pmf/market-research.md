# Market Research — Monetization & PMF Project

**Date gathered:** 2026-04-24
**Method:** Web search (6 queries, April 2026).
**Scope:** Competitive pricing landscape, analytics tooling, freemium best practices, poker-domain pricing precedent.

---

## Purpose

Anchor the pricing and feature-gating decisions in real competitive data, not folk intuition. Every pricing candidate in `paywall-spectrum.md` references the numbers in this file.

---

## Competitor map — Live-poker tracker category (direct lane)

| Product | Price | Model | Notes |
|---|---|---|---|
| Pokeri (live iOS) | Monthly subscription (auto-renew) | SaaS | Closest direct analog — live HUD + opponent style stats. |
| Hand2Note 3 | $49–$59/mo, $588/yr ($49/mo annual) | SaaS | Online-focused; PC + Android emulator. |
| Poker Copilot 8 | $29 one-time (starter) | Perpetual | Beginner + micro stakes; HUD + hand replayer. |
| DriveHUD | $20/$40/$100 first year; $5/$8/$10 renewal | Hybrid | Tiered by stake level. |
| PokerTracker 4 | $65/$100/$160 one-time | Perpetual | Tiered by stake level + Hold'em/Omaha combo. |
| Holdem Manager 3 | $60/$100/$160 annual | Annual license | Tiered by stake level + combo. |

**Observations:**
- Live-poker market is small; most products above serve online. Pokeri is the closest live analog.
- **Perpetual licenses still dominate the category** (PT4, HM3, Copilot). Customers in this segment have historical resistance to subscriptions.
- **Price ceiling of the category appears to be ~$160 one-time or ~$59/mo.** Above that, buyers migrate to training sites.

---

## Competitor map — GTO training / study sites (Scholar-persona lane)

| Product | Price | Tiers | Notes |
|---|---|---|---|
| GTO Wizard | $0 / $26 / $44 / $116 / $206 per mo | **5 tiers** — Free/Starter/Premium/Elite/Ultra | Recent consolidation (March 2026) — merged 5 formats into 2; price hike $10–20/mo on mid-tiers with loyalty-lock for pre-hike subscribers. |
| Upswing Lab 2.0 | $99/mo or $399/6-mo or $699/yr | 1 tier | $49/mo PLO matrix separate. |
| Run It Once | $0 / $24.99 / $99.99 per mo | 3 tiers (Free/Essential/Elite) | 8,600+ videos in full library. |
| Pokercode | €59/mo | 1 tier | |
| Raise Your Edge | $697 (Apprentice Masterclass) / $1,297 (Expert Masterclass) | Course-based | One-time purchase per course; tournament-focused. |

**Observations:**
- **GTO Wizard validates the 5-tier ladder** for customers with high WTP dispersion. $0 → $206/mo spread suggests serious willingness-to-pay concentration at top.
- **Single-tier training sites cluster $59–$99/mo.** This is the Scholar-persona competitive set.
- **Lifetime/one-time courses exist ($697+)** but tend to be content-complete packages — not tools.

---

## Competitor map — Product analytics tooling (for telemetry decision)

| Tool | Free tier | Paid | Notes |
|---|---|---|---|
| **PostHog** | 1M events, 5K session replays, 1M feature-flag requests / mo | $0.00005/event after free tier; volume discounts at scale | Session replay + analytics + feature flags + experiments in one. **$50K startup credit** via PostHog for Startups. |
| Amplitude | 10K MTUs, 1K session replays | Paid plans unlock SQL + custom formulas + group/account analytics | MTU-based model; replay gated to paid tiers. |
| Mixpanel | 20M events free | Paid for retention > 12 mo + cohort features | Older; less feature-complete vs. PostHog at free tier. |

**Recommendation (from Session 1 roundtable TELEM seat):** **PostHog.** Reasons:
- Free tier genuinely useful for pre-launch.
- Session replay included — critical for "got lost / frustrated" detection.
- Feature flags included — needed for A/B testing tier-candidate copy post-launch.
- $50K startup credit applicable.
- 2026 industry consensus pick for early-stage.

---

## Freemium / SaaS pricing best practices (synthesis)

Drawn from 2026 industry guidance (Maxio, Revenera, Dodo Payments, PricingIO).

1. **Gate on value amplifiers, not basic utility.** Don't gate the core "wow" moment; gate what makes good users *better*.
2. **Usage-based triggers convert 2.5× better than time-based.** Prompt at "you've used X features heavily" > "your trial expires in 3 days."
3. **Centralize entitlement management early.** Painful to retrofit later.
4. **Set the free-to-paid boundary carefully** — too high and nobody converts, too low and free users never feel value.
5. **Manufacture a sense of loss via feature gates + usage limits.** When a user hits a limit they care about, the calculus shifts from "should I pay?" to "I want to keep what I have."
6. **Analyze usage → segment → A/B test pricing structures → track renewals → identify upsell.**
7. **Behavioral triggers at the moment of felt-value conversion > discount/urgency tactics.**

**Doctrine tension flag:** Several of these (manufactured-loss, behavioral triggers) sit uneasily with this project's autonomy red lines #5 (no engagement-pressure) and #7 (editor's-note tone). The paywall-spectrum doc ranks each option on both conversion efficiency AND doctrine compliance. Q1 owner verdict sets the binding.

---

## Poker-domain commercial observations

Synthesized from Session 1 roundtable POKER-BIZ seat + market data above.

1. **Poker players pay for EV.** Features closer to "this makes me money next session" command higher WTP than abstract study tools.
2. **Stakes correlate with WTP.** $1/$2 live vs $5/$10 live shows 3–10× spread for the same tool.
3. **Perpetual preference in tracker segment** (PT4, HM3) — subscription introduces retention risk; mitigate with founding-member lifetime.
4. **Live vs. online is a segmentation axis — not a feature axis.** Live players pay differently from online grinders; tier naming should respect this.
5. **Rake sensitivity** — price copy should frame in EV recovery terms ("recovers a single bb/hour misread per session") rather than generic value prop.
6. **Grey-market operator exposure (Ignition)** — commercial lane must not embed the sidebar into main-app marketing unless legal posture explicit. Gate 3 Q7.

---

## Anchor points used by paywall-spectrum doc

From this research, the following prices anchor the `paywall-spectrum.md` candidate tiers:

- **Free tier precedent:** GTO Wizard $0, Run It Once $0 — non-trivial free tier is expected by category.
- **Plus/low tier:** Run It Once Essential $25/mo, GTO Wizard Starter $26/mo → **$15–25/mo** is the market-accepted "Plus" band.
- **Pro/mid tier:** GTO Wizard Premium $44/mo, Pokercode €59/mo, Hand2Note $49/mo → **$25–50/mo** is the "Pro" band for a single product.
- **Elite/power tier:** Upswing $99/mo, GTO Wizard Elite $116/mo → **$99–129/mo** is the "power user" band; requires content-density or feature-depth competitive with GTO Wizard to hold.
- **Ignition SKU band:** Hand2Note $49–59/mo is the online HUD benchmark. **$69–99/mo** pricing for Ignition sidebar requires demonstrable edge vs. Hand2Note on capture quality + live HUD.
- **Founding-member lifetime band:** $199–$399 one-time is typical "first 50 users" range in SaaS; Session 1 roundtable recommended **$299**.
- **Annual-discount band:** industry norm is **30–40% off** monthly × 12 for annual prepay.

---

## Sources

- [GTO Wizard New Pricing](https://gtowizard.com/pricing/en/)
- [GTO Wizard Subscription Plan Changes — PokerNews, March 2026](https://www.pokernews.com/news/2026/03/gto-wizard-subscription-plans-new-features-pricing-50908.htm)
- [Upswing Poker Lab Review 2026](https://cardplayerlifestyle.com/poker-courses/upswing-poker-lab-thorough-review/)
- [Pokercode Review 2026](https://www.vip-grinders.com/poker-tools/pokercode-review/)
- [Run It Once Review 2026](https://cheapcourses.eu/run-it-once-review/)
- [PokerTracker 4](https://www.pokertracker.com/products/PT4/purchase.php)
- [DriveHUD](https://drivehud.com/)
- [Poker Copilot 8](https://pokercopilot.com/)
- [Hand2Note](https://hand2note.com/)
- [Best Poker Tools 2026 — PokerNews](https://www.pokernews.com/poker-tools/)
- [Most Useful Poker Software 2025 — GipsyTeam](https://www.gipsyteam.com/news/17-10-2025/most-useful-poker-software-2025)
- [SaaS Pricing Models 2026 — Revenera](https://www.revenera.com/blog/software-monetization/saas-pricing-models-guide/)
- [SaaS Free Trial vs Freemium — Dodo Payments](https://dodopayments.com/blogs/saas-free-trial-vs-freemium)
- [Freemium Models Best Practices — Maxio](https://www.maxio.com/blog/freemium-model)
- [PostHog vs Amplitude](https://posthog.com/blog/posthog-vs-amplitude)
- [PostHog Pricing 2026 — Userorbit](https://userorbit.com/blog/posthog-pricing-guide)
- [Best Product Analytics Tools for Early-Stage Startups — Amplitude](https://amplitude.com/compare/best-product-analytics-tools-early-stage-startups)
- [Pokeri Live Poker Tracker — App Store](https://apps.apple.com/us/app/pokeri-live-poker-tracker/id1544085497)
