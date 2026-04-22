# Design Framework

A structured, AI-assisted system for auditing and improving any UX surface in this repo. Built to be repeatable — one audit of one surface should look the same whether it's run today or six months from now, by Claude or a future human teammate.

---

## Who this is for

Two audiences, one format:

1. **Chris (owner + primary user)** — uses audit outputs to decide what to fix and why. Needs plain-English findings tied to real situations. Also the archetype for live-player self-observation (see [core persona](./personas/core/chris-live-player.md)).
2. **Claude (executor)** — produces audits, maintains artifacts, and consumes templates. Needs unambiguous structure and citable evidence.

**Design targets:** the app is built for Chris *as primary user today* but for a broader cast of end-user archetypes *as the eventual product*. See [personas/README.md](./personas/README.md) for the full 15-archetype roster.

---

## How the pieces fit

```
                    ┌──────────────────┐
                    │    METHODOLOGY   │  ← the "how we audit" doc
                    └────────┬─────────┘
                             │
       ┌─────────┬───────────┼──────────────┬─────────────┐
       ▼         ▼           ▼              ▼             ▼
  ┌─────────┐┌────────┐┌──────────┐ ┌──────────────┐┌────────────┐
  │PERSONAS ││ TIERS  ││   JTBD   │ │  HEURISTICS  ││  PRODUCTS  │
  │  (who)  ││ (paid/ ││  (what)  │ │ (by what rule)││ (app vs   │
  │         ││ access)││          │ │              ││  sidebar) │
  └────┬────┘└───┬────┘└────┬─────┘ └──────┬───────┘└─────┬──────┘
       │         │          │               │              │
       └─────────┴──────────┼───────────────┴──────────────┘
                            ▼
                    ┌───────────────┐
                    │   SURFACES    │  ← inventory of every UX atom
                    └───────┬───────┘
                            │
            ┌───────────────┼─────────────────┐
            ▼               ▼                 ▼
     ┌──────────────┐┌──────────────┐┌───────────────┐
     │   JOURNEYS   ││   FEATURES   ││    AUDITS     │
     │ (JTBD flows) ││ (inventory)  ││  (findings)   │
     └──────────────┘└──────┬───────┘└───────┬───────┘
                            │                │
                            ▼                ▼
                    ┌───────────────┐┌──────────────┐
                    │ DISCOVERIES   ││   EVIDENCE   │  ← every claim cited
                    │(missing feats)│└──────────────┘
                    └───────────────┘
```

**Reading order for a newcomer:** README → METHODOLOGY → one persona → one JTBD entry → one audit.

---

## Directory map

| Path | Purpose |
|------|---------|
| `README.md` | This file. Entry point. |
| `METHODOLOGY.md` | How to run an audit. Step-by-step process. |
| `personas/` | *Who* uses (or could use) the app. 15 archetypes + situational sub-personas. |
| `jtbd/` | *What* they're trying to accomplish. Atlas + 14 domain files. |
| `heuristics/` | *By what rule* we evaluate. Nielsen + poker-specific + mobile. |
| `tiers/` | Hypothetical product tiers (Free / Plus / Pro / Studio + sidebar-lite track). No code yet — the framework must *express* tiering even as the app stays feature-flat. |
| `products/` | Main app vs. sidebar extension as distinct product lines. Each can have its own tier track. |
| `features/` | Inventory of features in the app, tagged by persona + tier + product line. |
| `discoveries/` | Feature-discovery pipeline. Missing features surfaced during audits land here, get prioritized, then flow to BACKLOG.md. |
| `surfaces/` | Inventory of every UX surface (screens, menus, panels). |
| `journeys/` | End-to-end flows through multiple surfaces to complete a JTBD. |
| `audits/` | Time-stamped audit reports. Findings with severity + fix proposals. |
| `evidence/` | Ledger of observations that back up audit claims. |

---

## When to use this framework

| Trigger | Action |
|---------|--------|
| Owner reports a UX problem | Run an audit of the affected surface(s). Don't fix blindly. |
| Adding a new screen or view | Create a surface artifact first, then implement. Link a journey if it changes existing flows. |
| `/eng-engine` roundtable identifies UX issues | Each finding should cite a heuristic + JTBD + evidence entry. |
| Before a refactor of UI code | Surface artifacts document current behavior — read them before editing. |
| Quarterly health check | Sweep audits: which findings have been closed? Which are stale? |

**Do NOT** use this framework to justify cosmetic changes ("make it prettier"). Every change must trace to a JTBD impact or a heuristic violation with evidence.

---

## How personas relate to JTBD

Short version: **personas bring empathy, JTBD brings precision.** Use both.

- A **persona** tells you *who* and *in what situation* — their constraints, environment, emotional state.
- A **JTBD** tells you *what outcome* they're trying to achieve — with success criteria and context.
- A **surface** tells you *which code* is involved.
- An **audit** ties all three together: "Situational persona [X] cannot achieve JTBD [Y] on surface [Z] because heuristic [H] is violated, evidenced by [E]."

Situational sub-personas are the key move. Rather than one persona with a grab-bag of traits, each sub-persona captures *the core user in a specific moment* — mid-hand, between-hands, post-session, seat-swap. A surface that works great for post-session Chris may be unusable for mid-hand Chris.

---

## Lifecycle

| Artifact | When it changes |
|----------|-----------------|
| Personas | Rarely. Updated when real observation contradicts the proto-persona assumption. |
| JTBD atlas | When a new capability is added, or an existing JTBD is decomposed into sub-jobs. |
| Heuristics | Rarely. Nielsen 10 are stable. Domain heuristics update when a failure mode teaches a new rule. |
| Surfaces | Every time the code for that surface changes non-trivially. |
| Journeys | When the flow through surfaces changes. |
| Audits | Immutable once closed. New audit = new file. |
| Evidence | Append-only. Never delete. |

---

## Commands and slash skills (future)

Session 1 ships the files. Future sessions may add helper skills (e.g., `/design-audit <surface>` that scaffolds a new audit from templates). Out of scope this session.

---

## Status

| Component | State |
|-----------|-------|
| Framework scaffold | **Built Session 1 (2026-04-21)** |
| Multi-persona expansion (15 cores) | **Built Session 1b (2026-04-21)** |
| Tier dimension | **Scaffolded Session 1b — 4 tiers + sidebar-lite track, hypothetical** |
| Product-line separation (main-app vs sidebar) | **Built Session 1b** |
| Feature inventory | **Built Session 1b — 14 features tagged** |
| Discovery pipeline | **Built Session 1b — 20-item initial gap list** |
| JTBD atlas | **Expanded Session 1b — 14 domains, ~90 JTBDs** |
| Heuristic sets | **Nielsen 10 + poker-live-table + mobile-landscape, built Session 1** |
| First audit (player selection) | **Session 2 — pending** |
