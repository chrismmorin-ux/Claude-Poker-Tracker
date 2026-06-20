# JTBD Domain — App Entry

Jobs around **opening the app and orienting** — the moment before any specific task. Distinct from
[Session Entry](./session-entry.md) (applied preparation for a specific session) and
[Onboarding](./onboarding.md) (first-ever use). App Entry is the recurring "I just opened the app — let me
choose what I'm here to do, and catch me up on what's changed" moment, served by the Homebase hub.

**Primary persona:** [Chris (live player)](../../personas/core/chris-live-player.md).
**Secondary personas:** [Rounder](../../personas/core/rounder.md),
[Hybrid Semi-Pro](../../personas/core/hybrid-semi-pro.md),
[Returning After Break](../../personas/situational/returning-after-break.md) (the Lapsed Returner — see AE-04).
**Surfaces:** [homebase-view](../../surfaces/homebase-view.md) (the hub + dashboard),
`NavShell` (one-tap Home throughpoint), `CollapsibleSidebar` (in-table nav).
See [navigation-ia.md](../../navigation-ia.md) for the navigation model these jobs assume.

**Domain origin:** design-audit 2026-06-20 (Homebase throughpoint work, plan `shimmying-moseying-lantern`).
The AI-conversation surface scan flagged that "app entry / orientation" had no JTBD anchor despite Homebase
shipping as the default surface.

---

## AE-01 — Orient at cold open and choose what I'm here to do

> When I open the app, I want to choose what I'm here to do (play / review / study / look something up)
> without being dropped into a single surface, so the app serves my intent instead of assuming it.

- **State:** Active (Homebase is the default entry screen).
- **Primary persona:** Chris (live player).
- **Success criteria:**
  - The launchpad's primary actions (Live Table, Online) and high-frequency destinations are reachable in
    one tap from the entry screen.
  - The entry screen paints instantly — launcher/nav are not blocked on data loads.
  - No forced interstitial when a fresh live session is genuinely active (the Resume affordance is one tap).
- **Failure modes:**
  - App opens straight into a task surface (the pre-Homebase state — the only global nav lived inside the table).
  - Entry screen blocks on async data before it's usable.

## AE-02 — Resume an in-progress session in one tap (and never be lied to about it)

> When I reopen the app mid-session, I want to get back to my live table immediately; and if a session was
> never properly ended, I want the app to say so rather than offer a "Resume" that no longer makes sense.

- **State:** Active.
- **Primary persona:** Chris (live player); the [stepped-away-from-hand](../../personas/situational/stepped-away-from-hand.md) variant.
- **Success criteria:**
  - Active session → Live Table tile reads "Resume Session" with context (duration · hands), one tap to table.
  - Stale active session (active but started long ago, almost certainly never ended) → reframed as
    "Unfinished Session — tap to finish," routing to the table's cash-out flow. The hub never fabricates a
    cash-out (financial integrity).
- **Failure modes:**
  - "Resume" shown identically whether the session is 3 minutes or 4 days old (the stale-session lie).
  - A cash-out / session-end is invented from the hub without the real end flow.

## AE-03 — Reach any major area without passing through the table

> When I want to review results, study, or look something up, I want to get there directly from the hub
> (and back to the hub from anywhere), so navigation doesn't route everything through the live table.

- **State:** Active (Homebase tiles + `NavShell` Home throughpoint).
- **Primary persona:** Chris (between sessions).
- **Success criteria:**
  - High-frequency destinations are tiles on Homebase (tile-promotion rule in navigation-ia.md).
  - A one-tap Home affordance is present on every non-table screen (`NavShell`).
  - Long-tail destinations remain reachable (sidebar) without cluttering the hub.
- **Failure modes:**
  - Global nav available only inside one view (the pre-throughpoint state).
  - Two nav surfaces disagree on what the top-level destinations are.

## AE-04 — Re-orient after a break ("since your last visit")

> When I come back after being away for a while, I want to see how my game has changed and what's new in
> the app since I was last here, so I can pick up where I left off instead of reconstructing context.

- **State:** Active (Homebase "since your last visit" band; shows when the gap exceeds ~3 days).
- **Primary persona:** [Returning After Break](../../personas/situational/returning-after-break.md) — the
  Lapsed Returner (founder-articulated 2026-06-19: "a lot of players use it, then don't for a while, and may
  have made large skill changes — give them the bits to recognize what's probably changed").
- **Success criteria:**
  - **Your game changed:** summarize sessions played since the last visit (count, net, win rate, hands).
  - **What's new in the app:** surface notable changes the user hasn't seen (`WHATS_NEW` vs `lastSeenWhatsNewId`).
  - Shown only for a genuine gap (frequent users are not nagged); never shames the gap.
- **Failure modes:**
  - Re-orientation band shown to a daily user (noise).
  - Shame framing ("you've been away!" / streak-loss) — forbidden, per the returning-after-break red lines.
  - Treating the returner as a novice or forcing a placement/recalibration before access.

---

## Domain-wide constraints

- **Instant-paint.** The entry surface's launcher + nav must render without waiting on data; dashboards
  stream in behind skeletons (the audit's anti-lag requirement for choosing a full dashboard).
- **Never lie about state.** Session-resume copy must reflect reality (AE-02 stale-session rule).
- **No shame, no nag.** Re-orientation (AE-04) acknowledges a gap supportively and only when real
  (inherits returning-after-break red lines #5 engagement-pressure + #3 durable-override).
- **Hub-curated, not exhaustive.** Homebase tiles are high-frequency only; the long tail lives on the sidebar
  (tile-promotion rule, navigation-ia.md). Ask the owner before promoting a new tile.

---

## Related domains

- [Session Entry](./session-entry.md) — applied prep for a specific session (SE-*); AE is the broader
  "just opened the app" moment that may *precede* SE.
- [Session Review](./session-review.md) — the dashboard deep-links here (SR-*); AE-04's "your game changed"
  is a re-orientation summary, not the full review.
- [Drills and Study](./drills-and-study.md) — the study-queue card deep-links here; `DS-55` (resumption after
  break) is the study-mode sibling of AE-04.
- [Multi-Device Sync](./multi-device-sync.md) — health/sync state surfaced by `HealthIndicator` on entry.

---

## Change log

- 2026-06-20 — Created. design-audit output for the Homebase throughpoint work (plan
  `shimmying-moseying-lantern`). AE-01..04 authored; registered in `ATLAS.md` same session. AE-04 encodes the
  founder-articulated Lapsed Returner persona.
