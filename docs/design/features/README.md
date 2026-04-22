# Features

Inventory of what the app can do, tagged by:
- **Who** it serves (personas)
- **Where** it lives (product line: main app / sidebar extension)
- **What tier** it would belong to if tiers were enforced

The inventory is the source of truth for "does this feature exist today?" when running an audit. If a need exists that no feature in the inventory serves, that's a [discovery](../discoveries/).

---

## Files

- [INVENTORY.md](./INVENTORY.md) — master feature list, tagged.
- [_template.md](./_template.md) — template for per-feature deep-dives (optional — used when a feature needs its own artifact).

## Using features in audits

- **Step 2 of methodology** (ground yourself) — read the INVENTORY entry for the surface you're auditing. Confirms scope and tier placement.
- **Step 4 (formalize findings)** — if a feature exists but is broken, that's a finding. If a feature is missing, that's a discovery.
- **Tier audit** — verify the feature's current tier placement matches its implemented behavior (no accidentally-Pro features leaking into Free).

## Feature lifecycle

| State | Meaning |
|-------|---------|
| Shipped | Feature exists in code and serves its intended JTBD. |
| WIP | Feature skeleton exists; not yet complete. |
| Paused | Feature started, explicitly paused (e.g., Firebase sync). |
| Proposed | Appears in a discovery; not yet approved for build. |
| Deprecated | Feature exists but should be removed. |

## Editing rules

- Update INVENTORY when a feature ships, pauses, or gets removed.
- Don't list individual React components as features. Only user-facing capabilities.
- If multiple components serve one feature, list the feature once with pointers to the components.

---

## Change log

- 2026-04-21 — Created Session 1b.
