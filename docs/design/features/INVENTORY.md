# Feature Inventory

Master list of user-facing features. Tagged by product line, state, and proposed tier.

Source: internal codebase audit (2026-04-21) via Session 1b engine.

---

## Legend

**State:**
- `✓` Shipped
- `◐` WIP / partial
- `⏸` Paused
- `●` Proposed (not yet built; lives as a discovery)

**Product line:** `main` / `sidebar` / `both` / `platform`

**Tier:** placement if tiering were enforced

---

## Shipped features (14)

| ID | Feature | State | Product | Tier | Primary personas |
|----|---------|-------|---------|------|-------------------|
| F-01 | Live Table Interface (9-seat, action entry) | ✓ | main | Free+ | Chris, Weekend Warrior, Rounder, Circuit Grinder, Ringmaster, Hybrid, Apprentice, Newcomer |
| F-02 | Real-time Exploit Advice (LiveAdviceBar + engine) | ✓ | main | Plus+ (basic free) | Chris, Weekend Warrior, Rounder, Circuit Grinder, Hybrid, Apprentice, Newcomer |
| F-03 | Showdown Resolution | ✓ | main | Free+ | All table-based personas |
| F-04 | Session & Bankroll Tracking | ✓ | main | Free+ (capped) | Weekend Warrior, Rounder, Hybrid, Circuit Grinder, Ringmaster, Traveler |
| F-05 | Player Database & Recognition (Picker + Editor + avatars) | ✓ | main | Free+ (capped) | All player-tracking personas |
| F-06 | Player Tendency Statistics (Bayesian, range profiles) | ✓ | main | Plus+ (depth in Pro) | Rounder, Multi-Tabler, Circuit Grinder, Hybrid, Online MTT Shark |
| F-07 | Hand History & Replay | ✓ | main | Plus+ | Rounder, Hybrid, Coach, Apprentice, Analyst |
| F-08 | Preflop Equity Trainer (Explorer mode) | ✓ | main | Free+ (full in Plus) | Scholar, Apprentice, Rounder (occasional) |
| F-09 | Postflop Range Trainer (Explorer + Line Study) | ✓ | main | Plus+ | Scholar, Apprentice |
| F-10 | Tournament Dashboard (blind timer, stacks, basic ICM) | ✓ | main | Free+ (ICM in Pro) | Circuit Grinder, Online MTT Shark, Hybrid, Ringmaster |
| F-11 | Online Play via Chrome Extension (sidebar) | ✓ | sidebar | Pro / Sidebar-Lite | Multi-Tabler, Online MTT Shark, Hybrid (online) |
| F-12 | Player Analysis & Villain Profiling | ✓ | main | Plus+ (depth in Pro) | Rounder, Hybrid, Coach, Multi-Tabler |
| F-13 | Statistics Dashboard (session stats, range profiles) | ✓ | main | Plus+ | Rounder, Hybrid |
| F-14 | Settings & Account (auth, venues, display) | ✓ | platform | Free+ | All |

---

## WIP / Paused features

| ID | Feature | State | Notes |
|----|---------|-------|-------|
| F-W1 | Postflop Drills — Estimate / Framework / Library / Lessons tabs | ◐ | Only Explorer + Line Study ship. Tier: Pro (when shipped). |
| F-W2 | Preflop Drills — advanced tabs (Shape / Recipe / Math / Framework / Library / Lessons) | ◐ | Only Explorer ships. Tier: Plus → Pro. |
| F-W3 | Firebase Cloud Sync | ⏸ | Infrastructure exists; explicitly paused. Tier: Plus+. |
| F-W4 | Hand Significance / Importance Scoring | ◐ | handAnalysis exists but UI doesn't surface it. Tier: Pro. |
| F-W5 | Decision Tree Visualization (`DecisionTreeView.jsx`) | ◐ | Component exists but not routed. Orphaned. Tier: Pro/Studio. |

---

## Proposed features (from discoveries/2026-04-21-initial-gap-list)

| ID | Feature | Tier | Source personas |
|----|---------|------|-----------------|
| F-P01 | Tilt detector | Pro+ | Weekend Warrior, Rounder, Banker |
| F-P02 | Cross-venue player linker | Pro | Hybrid |
| F-P03 | Voice input for live entry | Plus | Weekend Warrior, Rounder |
| F-P04 | ICM payout structure import | Pro | Circuit Grinder, Online MTT Shark |
| F-P05 | Bounty-adjusted EV mode | Pro | Online MTT Shark, Circuit Grinder |
| F-P06 | Satellite / seat-bubble strategy switch | Pro | Online MTT Shark |
| F-P07 | Coach dashboard with student queue | Studio | Coach |
| F-P08 | Staker read-only portal | Studio | Banker |
| F-P09 | Home-game settle & share mode | Plus / Studio | Ringmaster |
| F-P10 | PT4/HM3 hand-history importer | Plus / Pro | Multi-Tabler, Hybrid |
| F-P11 | Similar-spot search across history | Pro | Rounder, Scholar |
| F-P12 | Skill map / mastery tracker | Plus | Apprentice, Scholar |
| F-P13 | Custom drill from own history | Pro | Scholar, Apprentice |
| F-P14 | Multi-currency bankroll + FX | Pro | Traveler, Circuit Grinder |
| F-P15 | Public API + webhooks | Studio | Analyst |
| F-P16 | Sidebar-only subscription track | Sidebar-Lite | Multi-Tabler entry |
| F-P17 | Mixed-games support (PLO / stud) | Pro (later) | Analyst, Rounder |
| F-P18 | Signed / verifiable sessions | Studio | Banker |
| F-P19 | Accessibility modes (color-blind, low-light) | Platform | All live players |
| F-P20 | Session recovery + local-first guarantee | Platform | All live players |

---

## Connections / flow gaps (from internal audit)

Noted but not yet formal discoveries:

- **Live advice → drill learning:** no built-in link from a mid-hand rec to "practice this concept in Explorer."
- **Hand review → study materials:** Hand Replay doesn't link observed patterns to drill scenarios.
- **Online hands → main-app history:** sidebar imports are stored but no "Online Sessions" tab surfaces them separately in the main app.

These flow gaps deserve their own discoveries when prioritized.

---

## Change log

- 2026-04-21 — Created Session 1b with 14 shipped + 5 WIP/paused + 20 proposed.
