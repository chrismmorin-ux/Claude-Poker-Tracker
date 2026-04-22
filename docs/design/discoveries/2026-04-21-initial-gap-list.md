# Discovery Batch — Initial Gap List (2026-04-21)

**ID:** `DISC-2026-04-21-initial-gap-list`
**State:** CAPTURED (aggregated)
**Surfaced during:** Session 1b engine run (persona + JTBD expansion)
**Date surfaced:** 2026-04-21

---

## About this batch

The Session 1b engine surfaced ~20 missing features during exhaustive persona + JTBD generation. Rather than 20 separate discovery files up front, we captured them aggregately in this one file to preserve context. Individual break-outs should happen when:

1. Owner decides to move one to REVIEWED / QUEUED state.
2. A later audit provides specific evidence that sharpens the case for one.

Until then, this file is the single source of truth for Session 1b-surfaced gaps.

## Evidence basis

- Agent A (market research) identified recurring unmet-need themes across the competitive landscape.
- Agent B (internal feature inventory) identified feature-flow gaps and disconnections.
- Agent C (product strategist) generated the exhaustive JTBD cast and missing-feature list.

All three agent outputs are embedded in the Session 1b run context. Specific quotes / sources may be cited when any item is broken out.

---

## The 20 gaps

### Tier: Platform (always on, not tier-gated)

#### DISC-P01 — Accessibility modes (color-blind, low-light card-room theme)
- **Personas:** All live players (15/15 affected to varying degrees)
- **JTBD:** `JTBD-CC-81` accessibility for color-blind / dim-light users
- **Rationale:** Poker rooms are dim; players may be color-blind. Relying on color for state distinctions violates H-PLT03 (dim-light readable) and H-ML06 (touch targets).
- **Effort:** M
- **Notes:** Partially covered by existing dark-mode preferences; needs explicit color-blind palette + low-light "stealth" theme.

#### DISC-P02 — Session recovery + local-first guarantee
- **Personas:** All live players (Chris, Weekend Warrior, Rounder primarily)
- **JTBD:** `JTBD-SM-04` recovery from interruption; `JTBD-CC-77` crash recovery
- **Rationale:** Phones sleep, apps crash, signal drops. Losing a hand mid-session is catastrophic.
- **Effort:** M
- **Notes:** Some coverage exists (draft autosave for player editor); needs comprehensive audit of all state machines.

### Tier: Pro

#### DISC-01 — Tilt detector
- **Personas:** Weekend Warrior, Rounder, Banker
- **JTBD:** `JTBD-CC-87` tilt notification; `JTBD-SG-58` staker alert
- **Rationale:** Pattern detection on session behavior (bet size variance, session length, stop-loss breaches) to warn user (or staker) of tilt.
- **Effort:** L
- **Notes:** Could live as a background analytics pass on session data; notification channel open question.

#### DISC-02 — Cross-venue player linker
- **Personas:** Hybrid (primary), Rounder (secondary)
- **JTBD:** `JTBD-PM-32` merge duplicate players
- **Rationale:** Live reg "JohnD" ≠ online "player8342" today; merging these into one profile requires fuzzy matching + manual confirmation.
- **Effort:** M

#### DISC-04 — ICM payout structure import
- **Personas:** Circuit Grinder, Online MTT Shark
- **JTBD:** `JTBD-TS-01` ICM-adjusted decision
- **Rationale:** Manual entry of payout structures per tournament is a cost; common structures should be importable or derivable from cardroom data.
- **Effort:** M

#### DISC-05 — Bounty-adjusted EV mode
- **Personas:** Online MTT Shark (primary)
- **JTBD:** `JTBD-TS-08` bounty-adjusted EV
- **Rationale:** Marginal calls in bounty formats have different EV calculus; not modeled today.
- **Effort:** M

#### DISC-06 — Satellite / seat-bubble strategy switch
- **Personas:** Online MTT Shark, Circuit Grinder (satellite-playing)
- **JTBD:** `JTBD-TS-07` satellite survival mode
- **Rationale:** In satellites, survival beats chip accumulation near the bubble. Strategy inverts from standard MTT.
- **Effort:** S–M

#### DISC-10 — PT4/HM3 hand-history importer
- **Personas:** Multi-Tabler (primary), Hybrid, Analyst
- **JTBD:** `JTBD-DE-73` import from competitor tools
- **Rationale:** New users with existing databases won't start from zero. Large onboarding blocker.
- **Effort:** L

#### DISC-11 — Similar-spot search across history
- **Personas:** Rounder, Scholar, Apprentice
- **JTBD:** `JTBD-SR-88` similar-spot search
- **Rationale:** "Show me every time I faced a turn check-raise on a paired board with 40bb" — a query engine across hand history.
- **Effort:** L

#### DISC-13 — Custom drill from own hand history
- **Personas:** Scholar, Apprentice, Rounder
- **JTBD:** `JTBD-DS-45` custom drill
- **Rationale:** Self-generated drills from real decision points beat generic drill packs.
- **Effort:** M

#### DISC-14 — Multi-currency bankroll + FX
- **Personas:** Traveler (primary), Circuit Grinder (traveling)
- **JTBD:** `JTBD-SM-*` venue-aware session management; `JTBD-DE-71` tax export
- **Rationale:** International live players need FX-aware P&L.
- **Effort:** M

#### DISC-17 — Mixed-games support (PLO / stud framework)
- **Personas:** Analyst, advanced Rounder
- **JTBD:** `JTBD-CC-89` non-Hold'em format support
- **Rationale:** NLHE-only limits market. Long-term, not Session 2/3.
- **Effort:** XL (deferred)

### Tier: Plus

#### DISC-03 — Voice input for live entry
- **Personas:** Weekend Warrior, Rounder (any hands-busy live player)
- **JTBD:** `JTBD-HE-16` voice input
- **Rationale:** Hands on chips/cards; voice frees both hands.
- **Effort:** M
- **Notes:** Platform voice APIs differ; PWA voice capture has caveats.

#### DISC-12 — Skill map / mastery tracker
- **Personas:** Apprentice, Scholar
- **JTBD:** `JTBD-DS-47` skill map visualization
- **Rationale:** Concept-level mastery grid (preflop by position, postflop by texture, ICM, etc.) drives daily drill routing.
- **Effort:** M

### Tier: Plus / Studio (depending on scope)

#### DISC-09 — Home-game settle & share mode
- **Personas:** Ringmaster (primary)
- **JTBD:** `JTBD-SG-54` home-game settle; `JTBD-SG-55` group stats
- **Rationale:** Non-player feature that expands a distinct persona. Multi-player session mode + debt-graph minimizer.
- **Effort:** M
- **Tier choice:** Plus if per-player, Studio if group-subscription model.

### Tier: Studio

#### DISC-07 — Coach dashboard with student queue
- **Personas:** Coach (primary)
- **JTBD:** `JTBD-CO-48` student hand queue; `JTBD-CO-49` annotate; `JTBD-CO-51` assign drills
- **Rationale:** Coach is a distinct role requiring workflow support beyond solo use.
- **Effort:** L

#### DISC-08 — Staker read-only portal
- **Personas:** Banker
- **JTBD:** `JTBD-SG-58` shared read-access; `JTBD-CO-*` privacy boundary
- **Rationale:** Multi-user role with asymmetric permissions.
- **Effort:** L

#### DISC-15 — Public API + webhooks
- **Personas:** Analyst, Coach, Banker (for integration)
- **JTBD:** `JTBD-DE-74` webhooks; `JTBD-DE-72` raw export
- **Rationale:** Opens programmatic integration. Platform move.
- **Effort:** L

#### DISC-18 — Signed / verifiable sessions
- **Personas:** Banker (primary), staked pros
- **JTBD:** `JTBD-SG-90` cryptographic proof of play
- **Rationale:** Staking relationships need trust; cryptographic signing of session data provides it.
- **Effort:** L

### Tier: Sidebar-Lite (alternate track)

#### DISC-16 — Sidebar-only subscription track
- **Personas:** Multi-Tabler entry, casual Online MTT Shark
- **JTBD:** `JTBD-SA-65` tier comparison + pick-right-tier
- **Rationale:** Online-exclusive players should not have to pay for main-app features they won't use.
- **Effort:** N/A (pricing / packaging decision, no code)

---

## Priority scoring status

Not yet scored. Scoring happens at REVIEWED stage (owner decides what to pursue).

For reference, the discoveries agent-3 flagged as highest potential value per current persona distribution:

1. DISC-02 cross-venue linker — only blocker for Hybrid persona satisfaction.
2. DISC-07 coach dashboard — opens entire Studio tier.
3. DISC-10 PT4/HM3 importer — eliminates onboarding friction for Multi-Tabler / Hybrid.
4. DISC-P01 accessibility — affects all personas; non-negotiable at some future stage.
5. DISC-01 tilt detector — differentiator vs. competitors who all miss this.

---

## Status log

- 2026-04-21 — CAPTURED (aggregated). Awaiting owner triage + individual break-out as needed.
