# Tiers

Hypothetical product tiers. Describes *what would be gated where* if the app were tier-gated today. It is not.

---

## Why this exists (given the app has no payment code)

Two reasons the framework needs the tier dimension even though the code doesn't:

1. **Persona fit.** Many of the 15 core personas differ in what they'd pay and what they'd expect for that price. Without a tier articulation, design decisions about "which feature should we prioritize" lose a load-bearing axis.
2. **Feature placement.** A new feature proposal lands better if it's explicitly framed as "this belongs in the Pro tier, alongside X and Y." It forces trade-off thinking and prevents tier-pollution (e.g., accidentally building a Studio-tier feature that costs the Free tier to support).

## What tiers are NOT

- Permissions. No code enforces tier membership today and there are no plans to in the short term.
- Prices. The dollar figures are placeholders that benchmark against competitor pricing; actual pricing would require customer research.
- Guarantees. A feature tagged "Pro" may move tiers after usage data is available.

---

## Tier ladder

| ID | Name | Target persona | Target $/mo | Role |
|----|------|----------------|-------------|------|
| [tier-0-free](./tier-0-free.md) | Free / Tourist | Newcomer, Weekend Warrior, Scholar (light) | $0 | Evaluation + light recreational use |
| [tier-1-plus](./tier-1-plus.md) | Plus / Regular | Weekend Warrior (upgraded), Scholar, Apprentice, Ringmaster | ~$19 | Full individual use |
| [tier-2-pro](./tier-2-pro.md) | Pro / Grinder | Rounder, Multi-Tabler, Online MTT Shark, Circuit Grinder, Hybrid, Analyst, Traveler | ~$49 | Serious play + advanced features |
| [tier-3-studio](./tier-3-studio.md) | Studio / Teams | Coach, Banker, Ringmaster (group), Analyst (API) | ~$149+ | Multi-user, coach/staker roles, API |
| [tier-sidebar-lite](./tier-sidebar-lite.md) | Sidebar Lite (alt track) | Multi-Tabler entry, Online MTT Shark casual | ~$15 | Sidebar-only, no main app |

## Product-line × tier matrix

The app has two product lines (see [products/](../products/)). Tiers can apply independently per product line.

| Tier | Main app | Sidebar extension |
|------|----------|-------------------|
| Free | Yes — hand entry, basic P&L, 50-player cap | Not available |
| Plus | Full | Not available |
| Pro | Full + advanced | Full advanced sidebar |
| Studio | Full + team | Full team |
| Sidebar Lite | Not available | Full sidebar only |

---

## Gating dimensions (what's commonly tier-gated)

Each dimension decides placement of a feature into a tier.

- **Depth of exploit engine** — Layer 1 / depth-1 in free; Layers 2–3 in Pro.
- **History window** — 7 days free; unlimited Plus+.
- **Player database size** — 50 free; unlimited Plus+.
- **Device count** — 1 free; 2 Plus; unlimited Pro.
- **Multi-device sync** — Pro+.
- **Sidebar** — Pro+ or Sidebar Lite.
- **Data export** — Plus+ (CSV), Pro+ (JSON/API).
- **Drill library** — basic Plus; full Pro.
- **Custom drills from own hands** — Pro.
- **ICM / bounty / satellite features** — Pro.
- **Coach/student roles** — Studio.
- **Staker/horse roles** — Studio.
- **API / webhooks** — Studio.
- **Multi-user / team billing** — Studio.

## Not gateable (platform-wide)

- Offline-first local-mode operation.
- Security and auth.
- Account recovery.
- Onboarding.
- Accessibility.
- Data export of *the user's own data* (always respect data ownership).
- Core correctness (invariants, no-silent-corruption).

---

## Using tiers in audits

- **Feature placement:** when proposing a new feature in a discovery, tag it with a proposed tier. Debate tier later; start with a default.
- **Persona coverage:** when auditing a surface, verify every tier that contains an applicable persona gets a usable experience — not just the paid tiers.
- **Tier pollution check:** if a Pro feature's UX leaks into Free (teaser, preview, paywall), audit for Nielsen H05 error prevention and H08 minimalist — paywalls shouldn't feel like bait-and-switch.

---

## Change log

- 2026-04-21 — Created Session 1b.
