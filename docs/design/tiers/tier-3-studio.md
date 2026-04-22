# Tier 3 — Studio / Teams

**ID:** `tier-3-studio`
**Role:** Multi-user, coach/staker roles, API, team billing
**Target $/mo (placeholder):** ~$149+ (base) + per-seat
**Last reviewed:** 2026-04-21

---

## Who this tier is for

- Primary: [Coach](../personas/core/coach.md), [Banker](../personas/core/banker-staker.md), [Ringmaster](../personas/core/ringmaster-home-host.md) (group split), [Analyst](../personas/core/analyst-api-user.md) (API access)
- Secondary: training sites, staking groups, poker clubs

## Role vs. adjacent tiers

- Upgrade from: Pro (when role-based access or team features become necessary)
- Upgrade to: None at this stage. Enterprise tier exists hypothetically for casinos / training sites but is out of scope.

---

## What's included

### Main app

- Everything in Pro, plus:
- **Coach dashboard** — student queue, annotation tools (voice + text), drill assignment library, custom drill creation, week-over-week progress tracking
- **Staker portal** — per-horse P&L dashboard, session flagging, tilt alerts, makeup accounting, verifiable signed sessions
- **Multi-user seat billing** — up to N seats, role-based permissions (player, coach, student, staker, horse, admin)
- **Shared annotations** — coach + student see same frame
- **Group/home-game mode** — multi-player sessions with debt graph minimization and Venmo share cards
- **Public API + webhooks** — full data access, event streams
- **Advanced data export** — tax-format, cryptographically signed sessions
- **Tilt detector** with push notifications to staker / self

### Sidebar extension

- Full sidebar with all Pro features for each seat on the team.

### Platform-wide

- Priority support
- Enterprise-grade security audit trails
- As Pro otherwise

## What's NOT included

- Unlimited seats — additional seats are metered.
- Custom SSO / SAML (not yet; future Enterprise tier).
- On-premise deployment (not offered).

## Caps and limits

- Seats: N included, additional metered (placeholder; e.g., 5 seats included, $10/mo per additional)
- Player database: unlimited across all seats
- History window: unlimited
- Device count: unlimited per seat

---

## Typical customer journey

- Coach starts Pro, brings first student → upgrades to Studio when student count reaches ~5.
- Staker onboards 3 horses → Studio necessary for staker portal.
- Home game regulars bundle → Studio shared across 8 players at $19/each-ish equivalent.

## Retention risks

- Coach workflow incomplete (missing assignment → practice loop) → coach reverts to Pro + Discord + Google Docs.
- Staker portal doesn't reduce risk enough to justify business expense.
- API + webhooks broken or flaky → Analyst churns.

---

## Change log

- 2026-04-21 — Created Session 1b.
