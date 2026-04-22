# JTBD Domain — Data Export / Integration

Jobs that move data out of the app or connect it to external tools.

**Primary personas:** [Analyst](../../personas/core/analyst-api-user.md), [Multi-Tabler](../../personas/core/multi-tabler.md) (import), [Traveler](../../personas/core/traveler.md) (tax), [Banker](../../personas/core/banker-staker.md) (reporting).

**Surfaces:** export in `SessionsView` / `SettingsView`; webhooks / API don't exist.

---

## DE-71 — Tax-friendly session export

> When tax season comes, I want session data in a tax-friendly format for my accountant, so they don't have to rebuild it.

- State: **Proposed**.

## DE-72 — Raw JSON / CSV export

> When I want to build my own dashboards, I want raw JSON / CSV export of all my data, so I own it.

- Partial: some CSV export exists; full-depth JSON not formalized.

## DE-73 — PT4 / HM3 hand-history import

> When I'm moving from another tool, I want to import my existing hand history, so I don't start from zero.

- State: **Proposed** (DISC-10).

## DE-74 — Webhook events

> When session milestones happen (start, end, flagged hand), I want webhook events, so I can integrate with my own workflows.

- State: **Proposed** (DISC-15).

## DE-75 — Full-archive export on leave

> When I decide to leave the app, I want a full archive export, so I'm not locked in.

- Active by policy — IndexedDB is exportable; path could be smoother.

---

## Domain-wide constraints

- Data ownership is a platform-wide invariant: users always get their own data back.
- Import must respect schema versioning (IDB v13 → v14 path).
- API / webhooks are gated at Studio tier.

## Change log

- 2026-04-21 — Created Session 1b.
