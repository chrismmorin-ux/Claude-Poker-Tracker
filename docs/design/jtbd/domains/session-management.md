# JTBD Domain — Session Management

Jobs that create, modify, pause, end, or restore a session record.

**Primary personas:** All playing personas.

**Surfaces:** `SessionsView`, `TableView` (session header), settings.

---

## SM-17 — Open session with preset stakes / venue / game

> When I sit down, I want to open a new session in 2 taps with my usual stakes and venue preset, so setup isn't a barrier.

## SM-18 — Log add-ons / rebuys

> When I add chips mid-session, I want to log it cleanly so P&L is accurate.

## SM-19 — Pause without closing session

> When I take a break (bathroom, food), I want to pause the session timer without closing it, so my hourly is accurate and the session state is preserved.

## SM-20 — Recover session from interruption

> When the app crashes or my phone dies mid-session, I want to resume exactly where I was, so no data is lost.

- Related: `CC-77` state recovery.

## SM-21 — Clean cash-out with tip logging

> When I leave, I want a clean cash-out flow that logs my tip to the dealer, so hourly is net of tip costs.

## SM-22 — Backfill a forgotten session

> When I realize I forgot to log a session, I want to backfill with approximate data (buy-in, cash-out, duration), so records stay complete.

---

## Domain-wide constraints

- Session state is the anchor for hand records; corruption propagates.
- Timezone-awareness matters for Traveler and cross-midnight sessions.
- Venue / game-type configuration feeds into rake-adjusted EV upstream.

## Change log

- 2026-04-21 — Created Session 1b.
