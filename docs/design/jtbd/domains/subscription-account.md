# JTBD Domain — Subscription / Account / Access

Jobs around account creation, tier selection, billing, and access boundaries. All currently proposed — no payment code exists.

**Primary personas:** All. Acute for [Coach](../../personas/core/coach.md), [Banker](../../personas/core/banker-staker.md), [Ringmaster](../../personas/core/ringmaster-home-host.md) (group sub), [Newcomer](../../personas/core/newcomer.md) (free → paid conversion).

**Surfaces:** `SettingsView` (auth exists), billing / tier UI (doesn't exist).

---

## SA-64 — Free tier with real value

> When I'm new to the app, I want a free tier that has enough value to be worth using, so I can evaluate before paying.

- See [tier-0-free](../../tiers/tier-0-free.md).

## SA-65 — Tier comparison before purchase

> When considering upgrading, I want a clear feature comparison across tiers, so I pick the right one.

## SA-66 — Transparent billing + easy pause

> When my subscription renews, I want transparent billing, and if I need to pause, I can without friction, so I don't feel trapped.

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

## Domain-wide constraints

- Nothing in this domain is implemented as tier-gating code today. The framework documents what tiers *would* look like.
- Auth exists (Firebase); tier is not expressed in user data.
- Billing is out of scope for Session 2/3.

## Change log

- 2026-04-21 — Created Session 1b.
