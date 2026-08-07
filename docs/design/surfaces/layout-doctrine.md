# Layout doctrine — which regions scale, and which do not

**Status:** DECIDED 2026-08-01 (founder: *"appwide"*) · Item `WS-319` / SPR-162
**Supersedes:** the per-view rule in [`audits/2026-06-19-responsive-layout-audit.md`](../audits/2026-06-19-responsive-layout-audit.md) — refines it rather than replacing it, see §2.
**Resolves:** that audit's **open question #1**, open since 2026-06-19.
**Consumed by:** `WS-320` (interaction vocabulary), `WS-313` (Table View surface artifact), `WS-322` (migration).

---

## 1 — What was measured

Command column at scale 1.0, so design px = rendered px:

```
column box    450 × 720
scrollHeight  839        ← over-subscribed by 119px
   48 tabs · 65 seat · 85 orbit · 432 action block · 0 spacer · 209 control zone
```

And across the app, from `useScale` (`s = min(vw·0.95/1600, vh·0.95/720, 1)`):

| Viewport | `s` | a declared 44px target renders at |
|---|---|---|
| 1600 × 720 (design canvas) | 0.950 | 41.8px |
| 1170 × 540 (founder's device) | 0.695 | **30.6px** |

**The H-ML06 touch floor is met nowhere in the app**, and the `0.95` margin is unconditional, so nothing is ever at its declared size — not even on a desktop at the exact design resolution.

Two consequences that shape the doctrine:

- **The `flex-1` spacer is already at 0.** There is no slack; the compression is what happens after it ran out.
- **No coordinate-system change makes 839 fit in 720.** Scale was hiding a *content* over-subscription by shrinking everything below the floor.

---

## 2 — The rule, and why it changed

The 2026-06-19 audit established a **per-view** rule:

> Spatial game-flow → scaled-landscape. Everything else → portrait-native fluid.

That rule is right in spirit and **cannot express the Table View.** TableView contains a genuinely spatial region (the felt — its proportions *are* the information) *and* a purely interactive one (the command column, where every recording tap lands). A per-view rule forces both into one paradigm, and scaling the column is what produced 30.6px targets and a clipped primary CTA.

**The doctrine is therefore promoted from per-view to per-region:**

> ### Spatial regions scale. Interactive regions do not.
>
> A region is **spatial** when its geometry carries meaning — relative positions, distances, or arrangement are what the user reads. A region is **interactive** when it is a set of controls whose meaning is in their labels and states, not in their size relative to anything else.

Most views contain only one kind of region, so for them the per-region rule collapses back to the per-view rule and nothing changes. The Table View and Hand Replay are the cases that needed the finer grain.

### Why "interactive regions do not scale"

A control's job is to be hit. Its size must be expressed in the units a thumb lives in — real CSS px — not in a design-canvas unit that is silently multiplied by 0.63–0.95 before it reaches the screen. **Under this rule a 44px target is 44px**, which ends the defect class that let `AUDIT-2026-04-21-TV F8` raise a target to 44px and ship it at 28px.

---

## 3 — Per-view classification

| View | Regions | Paradigm | Change |
|---|---|---|---|
| **TableView** | felt = spatial · command column = interactive · roster rail (Phase C) = interactive | **split** | felt scales, controls do not |
| **HandReplayView** | table render = spatial · transport + controls = interactive | **split** | same shape as TableView |
| **ShowdownView** | seat grid — *classification open*, see §6 | TBD | needs a call |
| StatsView | charts + tables | fluid | un-scale |
| AnalysisView | panels | fluid | un-scale |
| OnlineView | HUD panels | fluid | un-scale |
| TournamentView | config + timer | fluid | un-scale |
| HomebaseView | tile dashboard | fluid | un-scale |
| Preflop/Postflop/Presession drills | hand + card grids | fluid | un-scale |
| SessionsView, SettingsView, PlayersView | forms + lists | fluid | **already migrated** (2026-06-06 / 06-19) |

**This answers the June audit's open question #1** — *"Stats/Analysis/Online/Tournament: keep the fixed game-canvas, or reflow as fluid?"* — with **fluid**, and derives it rather than deciding it arbitrarily: none of those four contains a region whose geometry carries meaning. They are panels of numbers.

**Note the migration is already in flight.** `FluidView` exists as the standard vehicle (`h-[100dvh] overflow-y-auto`, added by that audit's Phase 1), and Sessions / Settings / Players have already moved. This doctrine does not start a migration — it **finishes one**, and supplies the rule that was missing for the split-region cases.

---

## 4 — The Table View contract (what Gate 4 Phases B and C design within)

**Regions.** Felt scales; `SEAT_POSITIONS` stays percentage-based and reflows for free. Command column and any roster rail lay out in real CSS px.

**Touch floor.** Enforced on **rendered** px. The Gate 2 pre-commitment is restated:

> ~~All action targets stay ≥44px and equal-area.~~
> **All action targets render at ≥44px across the supported device range, and targets within one action group are equal-area.** Verified by measurement (`npm run devshot`), never by asserting a class string.

**Overflow.** Street tabs pin to the top, control zone pins to the bottom (both `flex-shrink: 0`); only the middle band scrolls. The two anchors `glance-return-chris` depends on never move, and **Next Hand becomes structurally unclippable — `WS-311` closes via this work**, not separately.

**Narrowing (D-2).** Live-players-remaining moves the boundary between the regions, quantized to street boundaries. Because the column is un-scaled, widening it buys *usable* space rather than a larger picture of the same controls — which is what narrowing was for.

**Re-anchoring required (Phase C owns).** Felt and column no longer share a coordinate system, so every element spanning them must be re-specified: `LAYOUT.CONTEXT_MENU_OFFSET_X/Y` (the seat context menu is positioned in felt coordinates), the F12 reopen-range affordance (`fixed bottom-4 left-4`), and any roster rail touching the felt edge.

---

## 5 — Consequences accepted

- **The app stops being one uniformly scaled picture.** That is the point, and it is why this needed a founder call.
- **Vertical scroll appears on a primary path.** Mitigated by pinning both anchors; H-ML05 permits vertical. Phase B confirms it against the mid-hand no-interruption contract.
- **This is a real migration, not a tweak.** ~9 views still scale. Filed as `WS-322`, sequenced behind the doctrine and aligned with the June audit's Phase 3.
- **`WS-186` (table flip) stays deferred** — and gets *cheaper*: with the felt as the only scaled region in TableView, a 180° flip becomes a transform on the felt alone rather than on the whole canvas including the controls.
- **The orientation gate (`WS-315`) changes character.** Once most views are fluid, "please rotate to landscape" applies to a shrinking set of surfaces. It does not fix `WS-315` — the founder's report is device-specific and still needs reproduction — but it shrinks the blast radius.

---

## 6 — Open: ShowdownView's classification

ShowdownView renders nine seats each with two card slots and Muck/Won controls. Is the seat *arrangement* load-bearing, or is it a per-seat form that merely happens to be laid out like a table?

- If **spatial**: split like TableView, seat geometry scales, controls do not.
- If **interactive**: fully fluid, and it becomes a vertical list of seats on a phone — arguably better, since it is a between-hands surface with no time pressure.

**Recommendation: interactive/fluid.** Showdown is entered *after* the hand; the spatial map has done its job by then, and the task is data entry. But it mirrors the table's seat layout, and breaking that correspondence has a recognition cost worth naming before it is decided. Deferred to `WS-322`.

---

## Change log

- 2026-08-01 — Created. Founder chose app-wide. Doctrine promoted from per-view to per-region; June 2026 open question #1 resolved as *fluid*, derived from the rule. ShowdownView classification left open.
