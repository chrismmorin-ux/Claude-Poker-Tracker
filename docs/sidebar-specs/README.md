# Sidebar Per-Element Specs (SR-4)

This directory holds per-element design specifications produced by SR-4. Each spec is authored against **doctrine v2** (`docs/SIDEBAR_DESIGN_PRINCIPLES.md`) and cites the row it implements from `docs/SIDEBAR_PANEL_INVENTORY.md`.

## Batching

SR-4 is authored by zone (owner verdict 2026-04-12). One spec batch per session:

| Batch | Scope | File |
|---|---|---|
| Z0 | Chrome (0.1–0.9) | `z0-chrome.md` |
| Z1 | Table read (1.1–1.10) | `z1-table-read.md` |
| Z2 | Decision (2.1–2.9) | `z2-decision.md` |
| Z3 | Street card | `z3-street-card.md` |
| Z4 | Deep analysis | `z4-deep-analysis.md` |
| Zx | Overrides / edge states | `zx-overrides.md` |

A batch file contains one spec section per inventory row in that zone (only rows with verdict `keep`, `merge:*` target, or `conditional-render` — deleted rows are omitted with a one-line note).

## Spec template

Every element spec MUST contain the following fields, in this order:

### 1. Inventory row
Cite `#` and title verbatim from `SIDEBAR_PANEL_INVENTORY.md`. If this spec is the merge target of another row, list the absorbed rows here.

### 2. Doctrine citations
List the v2 rule numbers this spec satisfies (e.g., R-1.1, R-1.5, R-3.1, R-5.1). If the spec invokes a rule exception, cite the amendment or justify inline.

### 3. Glance pathway (per R-1.5) — MANDATORY
Four sub-fields:
- **Remembered location** — zone, position within zone, fixed slot dimensions (w × h in px or col-span).
- **Default summary** — the glance-readable rendering. Describe visible text/shape, not data source.
- **Drill-down affordance** — from the standardized vocabulary below. If none, state "none (glance-only)".
- **Expansion location** — in-place (default), or a justified deviation.

### 4. Data contract
- **Source** — exact state key or push-message path (e.g., `lastGoodAdvice.action`, `push_pipeline_status`).
- **Compute** — any derivation from raw source (keep minimal; pure render functions only).
- **Invalid states** — conditions under which the element MUST NOT render, or MUST render a stale/empty label. Cite the data-source guard.

### 5. Interruption tier (R-3.1)
One of: `emergency` / `decision-critical` / `informational` / `ambient`. Must match the inventory tier unless this spec changes it (call out the change explicitly).

### 6. Render lifecycle
- **Mount condition** — when this element first appears.
- **Update triggers** — which `renderKey` fingerprint fields cause re-render.
- **Unmount condition** — when it disappears (or stays mounted with blanked content — specify).

### 7. Corpus coverage
List the S-frames (e.g., `S1/01`, `S7/02`) that exercise this element's default, edge, and invalid states. If a needed frame doesn't exist yet, add a TODO for a future corpus extension.

### 8. Rejected alternatives (optional)
Brief rationale for design choices that were considered and discarded, especially if they were previously shipped.

---

## Standardized drill-down vocabulary

Exactly one of these patterns per element. Ambiguity between patterns is a spec violation.

| Affordance | Visual | Use case |
|---|---|---|
| **Chevron** (`▾`/`▴`) | 8–10 px triangle at row edge | In-place expand/collapse. Content renders in the element's own slot (vertical growth allowed; neighbours reflow only below). |
| **Underlined text link** | Standard underline on the clickable span | Navigate to a dedicated view (e.g., tournament log, diagnostics). |
| **Pill/chip click** | Pill with hover state, cursor pointer | Cycle selection within a fixed-size container (e.g., range-slot seat selector). No reflow. |
| **Tap target** | Invisible bounding box ≥ 40×40 px over a visual element | Same semantic as pill click; used for seat circles / board cards where the visible element is the affordance. |

If a new affordance is needed, amend this vocabulary (not the element spec).

---

## Authoring order within a batch

For each zone batch:
1. List all inventory rows in the zone with verdict `keep` / `merge:*` target / `conditional-render`.
2. Write one spec section per row, in inventory-row order.
3. At end of batch, write a "Batch invariants" section: any zone-wide rules (e.g., Z2 fixed column widths, Z0 always-visible row height).
4. Owner-review gate: owner approves the batch file wholesale before the next zone starts.

## Non-goals

- SR-4 specs do NOT author implementation code or CSS. Those come in SR-6+.
- SR-4 specs do NOT re-open inventory verdicts. If a spec cannot be authored because the verdict is wrong, escalate to a doctrine or inventory amendment (R-11 process).
