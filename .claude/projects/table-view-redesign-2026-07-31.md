# Project — Table View Redesign (TVR)

**Opened:** 2026-07-31 (founder request)
**Program:** design (5-Gate UX Framework)
**Status:** Gate 2 COMPLETE (YELLOW) → **Gate 3 IN PROGRESS** (R1–R4 done; R5/R6 need founder input, R7 needs table observation)
**Branch:** `claude/poker-table-redesign-z0h4rc`

---

## Founder statement (2026-07-31)

> "I want to kick off a redesign of the table view of the live poker app. From the ground up, rooting it in what we've learned about common actions and sizing to speed up hand entry, better utilizing the space and optimizing for hand entry speed. Maybe introducing some dynamic elements as the hand plays out, like narrowing the table or having deliberately thought out default actions but also ability to be precise. Also player entry is a bit slow — I think reordering of some visual elements could speed this up, it just takes too long right now."

---

## Why this is a project and not a ticket

Every prior Table View change has been a **surface-bound fix** inside a layout whose proportions were never in question. This is the first change to the *allocation* itself. Gate 1 returned **RED** (composite scope, three unprecedented interaction primitives, two unmodeled outcome spaces); Gate 2 returned **YELLOW** with two critical amendments. That is a full Gate 1–5 cycle across multiple sessions, which is the definition of a project here.

---

## The three directions (founder-ratified 2026-07-31, amended by Gate 2)

| ID | Direction | As stated | Gate 2 amendment |
|---|---|---|---|
| **D-1** | Defaults | Buttons weighted by frequency; most-likely action pre-armed; precision one tap away; nothing auto-records | **Weight prominence, never hit-target area.** All targets stay ≥44px and equal-area — frequency-weighted sizing would make the app worst at capturing the rarest, highest-information events (C2) |
| **D-2** | Dynamic layout | Felt narrows / panel grows as live players remaining falls | **Driver unchanged; transitions quantized to street boundaries only.** Mid-street reflow moves seats under the user's thumb during a glance-away and would slow the primary persona down (C1) |
| **D-3** | Player entry | Recents-first roster rail in the felt's dead space; tap empty seat to assign; menu keeps rare ops only | **Bounded rail (6–8), overflow routes to `PlayerFinderView`.** Twenty chips would scroll horizontally — the same defect class as orbit-strip F7, closed 2026-04-21 (C6) |

Both critical amendments preserve founder intent in full. Neither reduces scope.

---

## Measured baseline (code read 2026-07-31 — *not* visually confirmed)

| Finding | Evidence |
|---|---|
| CommandStrip is 450×720 = **28% of canvas**, constant at every street and every player count | `gameConstants.js:137`, `CommandStrip.jsx:684-693` |
| **35–40% of the felt region carries no information** — ~117px side gutters, ~175px below, plus stadium corners | `LAYOUT` offsets vs 1094×720 available |
| CommandStrip worst case stacks **~818–858px into a 720px column**; children use `height` + default `flex-shrink:1`, no `overflow-y` → **compresses, does not scroll**; 100px action buttons shrink first | `CommandStrip.jsx` heights, summed |
| Recent-players list starts **~250px into a 384px scroll container** → ~3 of up to 20 names visible | `SeatContextMenu.jsx:200-223`, `MENU_ROW_CLASS` 44px |
| Seat entry is **`onContextMenu`-only** (~500ms native long-press, no press feedback) | `SeatComponent.jsx:100` |
| Engine advice + optimal sizing already computed, never used to lower input cost | `CommandStrip.jsx:653-665`, `SizingPresetsPanel.jsx:26-37` |
| **Preflop orbit is already ~4 taps** and close to optimal — the speed problem is postflop, player entry, and legibility-under-compression | `CommandStrip.jsx:832-912`, `:1017-1046` |

**Enabling fact:** `SEAT_POSITIONS` are percentage-based, so dynamic felt dimensions reflow all nine seats, chip stacks and badges for free. D-2 is architecturally cheap.

**Verification status (updated 2026-07-31, same session):** the founder supplied device screenshots after Gates 1+2 were drafted — [`docs/design/evidence/2026-07-31-tvr-device-baseline/`](../../docs/design/evidence/2026-07-31-tvr-device-baseline/README.md). These **confirmed the compression prediction and produced two findings the code read could not reach**:

| Evidence | Result |
|---|---|
| EVID-1 | CommandStrip over-subscription **CONFIRMED** — the gold Next Hand CTA is clipped off the bottom of the screen at preflop. `WS-311` P1 → **P0** |
| EVID-2 | **NEW** — the uniform `ScaledContainer` transform (`s ≈ 0.63–0.84` on the founder's device) deflates every px value in the canvas, so **the 44px touch floor is not met anywhere in the app**. `WS-316` **P0** |
| EVID-3 | **NEW** — `RotateDeviceHint` hard-blocks entry for uninstalled-PWA users and does not visibly recover on rotate. `WS-315` **P0** |
| EVID-4 | Floating voice/mic button overlaps the card-selector grid (A♣/K♣). Folded into `WS-313` |

**Still outstanding:** timing measurement (seconds-per-orbit, seconds-to-seat-a-player) still requires a runnable app — `.env.local` remains the blocker for R7's quantitative half. The qualitative half is now closed.

---

## Gate progress

| Gate | Status | Artifact |
|---|---|---|
| 1 — Entry | ✅ **RED** | [`audits/2026-07-31-entry-table-view-redesign.md`](../../docs/design/audits/2026-07-31-entry-table-view-redesign.md) |
| 2 — Blind-Spot | ✅ **YELLOW** | [`audits/2026-07-31-blindspot-table-view-redesign.md`](../../docs/design/audits/2026-07-31-blindspot-table-view-redesign.md) |
| 3 — Research | 🟡 **IN PROGRESS** — R1–R4 done, R5–R7 open | WS-312 |
| 4 — Design | ⬜ blocked on Gate 3 | WS-313 |
| 5 — Implementation | ⬜ blocked on Gate 4 | WS-314+ |

---

## Work items

| ID | Title | Gate | Status |
|---|---|---|---|
| **WS-315** | **P0** — Orientation gate hard-blocks app entry, no recovery on rotate | — (standalone bug) | backlog |
| **WS-311** | **P0** — CommandStrip clips the Next Hand CTA at preflop (confirmed on device) | — (standalone bug) | backlog |
| **WS-316** | **P0** — Uniform scale transform nullifies the 44px touch floor app-wide | — (bug + Gate 4 input) | backlog |
| **WS-312** | TVR Gate 3 — research pass (R1–R7) | 3 | **in progress** — R1–R4 done |
| **WS-313** | TVR Gate 4 — surface artifact for Table View v2 | 4 | blocked by WS-312 |
| **WS-314** | TVR Gate 5 — implementation (decomposes at Gate 4) | 5 | blocked by WS-313 |

**The three P0s are deliberately not gated behind the redesign.** They degrade — and in two cases outright block — the surface *today*. They should ship on their own merits whether or not the redesign proceeds. Recommended order: **WS-315** (blocks entry) → **WS-311** (blocks hand advance) → **WS-316** (measure first; the fix strategy is a Gate 4 decision).

**WS-316 is also a Gate 4 input, not just a bug.** It invalidates Gate 2 pre-commitment #2 ("all action targets stay ≥44px and equal-area") as literally written — that constraint is currently unsatisfiable inside a uniformly scaled canvas. Gate 4 must restate every size floor in terms of **rendered** size.

---

## Gate 3 output so far (2026-07-31)

| # | Artifact | Note |
|---|---|---|
| R1 | [`personas/situational/glance-return-chris.md`](../../docs/design/personas/situational/glance-return-chris.md) | The persona D-2 must be designed for — returns eyes to the screen after 2–15s of watching the physical table. **Marked UNVERIFIED**; carries the surface contract Gate 4 designs against, plus four open questions all answerable by watching you record two orbits. |
| R2 | `HE-22 — Accept or override a proposed action` | The job pre-arming serves. Failure mode stated as *"the proposal was committed without being read."* |
| R3 | `HE-23 — Record a full orbit without falling behind the dealer` | Orbit as the unit of success, because HE-11 is per-seat and the founder's goal is per-orbit. |
| R4 | `PM-16 — Keep the table roster matching reality all session` | The continuous job the rail actually serves; PM-02 is a discrete act. |

**ID collision caught and corrected.** Gate 2 proposed `HE-19` and `HE-20`; both were already allocated to the all-in / side-pot family (`audits/2026-06-19-blindspot-allin-side-pots.md`) and `HE-19` is referenced in `CommandStrip.jsx`. Reassigned to HE-22/HE-23. Root cause: those IDs live only in an audit and were never written into the domain file, so the ID space is not self-describing — flagged in `ATLAS.md` as outstanding hygiene work.

**Gate 3 is not complete.** Its exit condition is re-running Gate 2 to GREEN, which needs R5 (is `ringmaster-in-hand` real?) and R6 (handedness) — both founder input. Gate 4 (`WS-313`) stays blocked.

---

## Sequencing constraints (binding)

1. **WS-186 (table flip) cannot proceed in parallel.** Rotation and narrowing are two independent spatial transforms over the same coordinate system; specified separately they will conflict. Gate 4 either designs a single transform layer covering both, or WS-186 is explicitly deferred behind TVR.
2. **WS-187 (photo-primary avatars) should land before or with the rail.** Rail legibility depends on recognising a player from a small chip — WS-187 is the strongest argument for the rail and the rail is the strongest argument for WS-187.
3. **Persisted-hand schema is a non-goal.** D-1 changes how an action is *proposed*, never what is *written*. `contracts/persisted-hand-schema.md` output must be byte-identical; asserted by test at Gate 5.
4. **No production code before Gate 4 produces a surface artifact.** Nothing in the kickoff session touched `src/`.

---

## Open questions for the founder

1. Should dynamic narrowing be **defeatable in Settings**? (H-N03 argues yes; each opt-out is a second state the design must hold.)
2. Is **`ringmaster-in-hand` a real persona**? Still PROTO since 2026-04-21; two of three directions cite it as a beneficiary.
3. **Handedness / grip** in one-handed landscape? Blocks the H-PLT02 reachability check on rail placement.
4. Does the rail **persist across streets, or appear only between hands**? Between-hands-only removes all in-hand real-estate competition — and also removes the mid-hand seating case that appears to be the volume driver.
5. Can you supply a **`.env.local`** so the timing baseline can be measured (R7)? The screenshots closed the qualitative half; the seconds-per-orbit half still needs a runnable app.
6. **Do you want the three P0s fixed now, ahead of the design gates?** WS-315 and WS-311 both block real use today. The counter-argument is that WS-316's fix strategy (possibly un-scaling the command column) is a Gate 4 decision and could subsume WS-311 — so fixing WS-311 first may be work done twice.

---

## Change log

- 2026-07-31 — Project opened. Gates 1 + 2 complete in kickoff session. Four work items filed. Zero `src/` changes.
- 2026-07-31 — **Device evidence added mid-session** (founder screenshots). Compression prediction confirmed; two new P0 findings (scale-nullifies-touch-floor, orientation gate blocks entry). `WS-315` + `WS-316` filed, `WS-311` upgraded to P0. Still zero `src/` changes.
