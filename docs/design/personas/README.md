# Personas

Who uses (or could use) the app. Organized hierarchically.

---

## Architecture

```
personas/
├─ core/                         ← archetypes (~16)
│   ├─ chris-live-player.md     ← primary & reference
│   ├─ evaluator.md             ← prospective-buyer cognitive state (pre-commitment)
│   └─ [13 end-user archetypes]  ← design targets across the market
└─ situational/                  ← the same core in a specific moment
    ├─ [chris-specific × 4]      ← mid-hand, between-hands, seat-swap, post-session
    ├─ [evaluator-specific × 2]  ← trial-first-session, returning-evaluator
    └─ [cross-persona × 6+]      ← e.g., bubble-decision, home-game-settle, stepped-away-from-hand
```

- **Core personas** are durable archetypes. One person can match only one core at a time (though archetypes evolve — The Weekend Warrior may become The Rounder over years).
- **Situational sub-personas** are the same person in a specific situation. One core persona has many situations. Some situations span multiple cores (bubble-decision is experienced by the Circuit Grinder and the Online MTT Shark, etc.).

Situational sub-personas carry the time / attention / cognitive-load constraints that drive interaction design. A surface that works for a post-session core persona may fail for the same persona in a mid-hand situation.

---

## Who to read, when

| Working on… | Read first |
|-------------|-----------|
| Feature that only Chris uses | `core/chris-live-player.md` + his situational sub-personas |
| Feature shared across multiple archetypes | `core/*.md` for all applicable archetypes + the relevant cross-persona situational file |
| Tier / pricing questions | All 15 core personas — tier assignment follows persona dimensions |
| Mobile form-factor concern | Chris + Weekend Warrior + Rounder (all phone-live) |
| Sidebar / online concern | Multi-Tabler + Online MTT Shark + Hybrid (sidebar-primary) |
| Coaching workflow | Coach + Apprentice pair |
| Monetization / group features | Banker + Coach + Ringmaster |

---

## Core persona roster

| Persona | Venue / Format | Intent | Product line | WTP (/mo) |
|---------|----------------|--------|--------------|-----------|
| [Chris (owner)](./core/chris-live-player.md) | Live cash (assumed) | Play-aid + direct | Both | n/a |
| [Weekend Warrior](./core/weekend-warrior.md) | Live cash recreational | Play-aid + light tracking | Main | $0–15 |
| [Rounder](./core/rounder.md) | Live cash serious | Play-aid + deep study | Main | $30–60 |
| [Circuit Grinder](./core/circuit-grinder.md) | Live MTT | ICM-critical play-aid | Main | $60–150 |
| [Multi-Tabler](./core/multi-tabler.md) | Online cash grinder | Sidebar HUD + review | Sidebar-primary | $30–80 |
| [Online MTT Shark](./core/online-mtt-shark.md) | Online MTT | Sidebar push/fold + ICM | Sidebar-primary | $60–150 |
| [Hybrid](./core/hybrid-semi-pro.md) | Mixed live + online | Unified cross-venue | Both | $60–100 |
| [Ringmaster](./core/ringmaster-home-host.md) | Live home game | Host tooling + group stats | Main | $0–15 or group sub |
| [Coach](./core/coach.md) | Online review | Student review + assignment | Main | $60–150 (expensed) |
| [Apprentice](./core/apprentice-student.md) | Any | Flag hands + drill | Both | $15–30 (bundled?) |
| [Scholar](./core/scholar-drills-only.md) | None (study only) | Drills + frameworks | Main | $15–30 |
| [Banker](./core/banker-staker.md) | Meta (oversight) | Horse P&L + flagging | Main | $60–200 |
| [Newcomer](./core/newcomer.md) | Any low-stakes | Learn in context | Main | $0–10 |
| [Analyst](./core/analyst-api-user.md) | Online mostly | Raw export + API | Main + API | $30–60 |
| [Traveler](./core/traveler.md) | Live cross-border | Multi-currency tracking | Main | $30–80 |
| [Evaluator](./core/evaluator.md) | N/A (pre-commitment) | Evaluate whether app fits | Either (main-app first) | pre-WTP; trial cohort |

---

## Evidence status

| Persona | Status | Basis |
|---------|--------|-------|
| Chris | PROTO, partially verified | Direct observation from owner interaction |
| Evaluator | Owner-Confirmed (structural), PROTO-evidential | Owner-ratified 2026-04-24 at Monetization & PMF Gate 3 (structural shape confirmed); full Verified pending Stream D telemetry 30-60-day window |
| All 14 others | PROTO, **unverified** | Synthesis from market research (competitive products + community discussion) |

None of the 14 end-user archetypes have been validated by direct observation. They are *design targets*, not *research conclusions*. Upgrading any to VERIFIED requires: real-world interview, telemetry analysis, or documented user study. Until then, treat as hypothesis-driven design targets — useful for divergent thinking, dangerous to treat as ground truth.

---

## Reading order (fastest path to orientation)

1. [Chris (owner)](./core/chris-live-player.md) — reference point.
2. Three contrasting end-users to feel the spread:
   - [Weekend Warrior](./core/weekend-warrior.md) — simple, recreational.
   - [Rounder](./core/rounder.md) — serious, mid-stakes.
   - [Coach](./core/coach.md) — non-player role.
3. Browse remaining cores as questions arise.

---

## Change log

- 2026-04-21 — Created Session 1b (engine expansion).
- 2026-04-24 — Added Evaluator core persona (16th core) + `trial-first-session` situational + `returning-evaluator` situational as output of Monetization & PMF project Gate 1 authoring + Gate 3 owner ratification. Architecture diagram updated to reflect new cast. Evidence-status table gained row for Evaluator (Owner-Confirmed structural / PROTO-evidential — full Verified pending telemetry). Evaluator fills the prospective-buyer cognitive-state gap — every other persona describes already-committed users; Evaluator is the person deciding whether to become one. Sub-shapes (E-CHRIS / E-SCHOLAR / E-IGNITION) documented as attributes in `evaluator.md`, not forked to separate core personas (Gate 2 audit Stage A verdict + Gate 3 Q10=B verdict). See `docs/projects/monetization-and-pmf/gate3-owner-interview.md` + `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md`.
