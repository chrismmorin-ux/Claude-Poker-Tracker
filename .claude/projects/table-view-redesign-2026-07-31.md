# Project — Table View Redesign (TVR)

**Opened:** 2026-07-31 (founder request)
**Program:** design (5-Gate UX Framework)
**Status:** Gates 1–3 COMPLETE. **Gate 2 re-run GREEN 2026-07-31 → Gate 4 (`WS-313`) is OPEN.**
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
| 3 — Research | ✅ **COMPLETE** — R1–R6 closed; R7 timing carried as a risk | WS-312 |
| 2 — Re-run | ✅ **GREEN** | all seven persona/JTBD findings closed |
| 4 — Design | 🟢 **OPEN — NEXT** | WS-313 |
| 5 — Implementation | ⬜ blocked on Gate 4 | WS-314+ |

---

## Work items

| ID | Title | Gate | Status |
|---|---|---|---|
| **WS-315** | **P0** — Orientation gate hard-blocks app entry, no recovery on rotate | — (standalone bug) | backlog |
| **WS-311** | **P0** — CommandStrip clips the Next Hand CTA at preflop (confirmed on device) | — (standalone bug) | backlog |
| **WS-316** | **P0** — Uniform scale transform nullifies the 44px touch floor app-wide | — (bug + Gate 4 input) | backlog |
| **WS-312** | TVR Gate 3 — research pass (R1–R7) | 3 | **done** |
| **WS-319** | Gate 4 **Phase A** — geometry | 4 | ✅ **DONE** (SPR-162) — app-wide |
| **WS-322** | App-wide layout migration (finishes the June responsive plan) | — | backlog, L, decompose before running |
| **WS-320** | Gate 4 **Phase B** — one interaction vocabulary (tap commits / hold refines) | 4 | **unblocked — NEXT** |
| **WS-313** | Gate 4 **Phase C** — the surface artifact | 4 | blocked by A + B |
| **WS-318** | Mine pool sizing per street × line — miner written & verified | — | **blocked on founder** (corpus is local) |
| **WS-321** | `mine-sizing-and-lines.py` has the same stab/donk conflation | — | backlog |
| **WS-317** | Confirm-before-commit — press-hold-preview-release for dense targets | 1 done (YELLOW) → 2 | backlog — **design inside WS-313** |
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

| R5 | `ringmaster-in-hand` **REFUTED** | Founder never deals — a house dealer always handles cards. All D-1/D-2 justifications citing it are struck. |
| R6 | Handedness closed | **Two hands / varies** → H-PLT02 one-handed reachability is not binding. Rail placement is freed, but target **size** now carries all the accuracy weight — which *raises* WS-316's importance. |

### The founder's reframing (2026-07-31) — load-bearing on every tie-break

> "There is always a dealer who handles the cards. **I am the single source of persistent, non-human memory, data beyond a hand.**"

He is not the ringmaster — he is the memory. That is a stronger design principle than the persona it replaced, and it independently confirms two constraints this project had already reached on other grounds:

- **Rare events outrank common ones for capture priority.** Memory's value is disproportionately in the unusual. (Confirms Gate 2 amendment C2-A.)
- **Data integrity beats entry speed at every tie.** A fast path that records the wrong thing doesn't lose time — it corrupts the one thing he is at the table to provide. (Confirms the never-auto-commit constraint.)

**Gate 3 is complete and the Gate 2 re-run returned GREEN. Gate 4 (`WS-313`) is open.**

**One carried risk, stated not closed:** R7's *timing* half is still unmeasured — nobody has clocked where the seconds actually go in a postflop street, and card entry is the prime suspect. Gate 4 proceeds treating "the speed problem is postflop entry, player entry and legibility" as a **stated assumption**; the measurement must land before Gate 5 commits. If card entry dominates, the centre of gravity moves to `CardSelectorPanel`.

---

## Founder proposal — confirm-before-commit (2026-07-31)

> "I think we should have the card selector as a click and hold to zoom, and release to lock in the selected card… this sort of thing needs to be looked at all over the interface."

Gate 1 entry authored ([`2026-07-31-entry-confirm-before-commit.md`](../../docs/design/audits/2026-07-31-entry-confirm-before-commit.md)), verdict **YELLOW**. The conclusion holds; the stated premise needed correcting, and the correction makes it generalise better.

**Measured:** card-grid cells render at **108×126px** at the design canvas and **79×92px** at device scale — roughly **twice** the 44px floor. The card grid is one of the few surfaces here that is *not* undersized. So "misclick defence" as a size argument is not supported for that surface.

**What is supported** is the second half of the sentence. Every selection in this app today is **aim → commit → verify**. In a grid of 52 near-identical cells, a perfectly accurate tap can still hit the wrong card, and nothing says so until it is written. The founder is asking for **aim → verify → commit** — a *feedback-timing* fix, not a *size* fix. That reframing is what makes it auditable across every surface instead of being a one-off zoom feature.

**The blocking risk is a gesture collision, and it is exactly the interface-wide work he asked for.** Long-press already has a meaning in three places — sizing-preset editor, seat context menu, PotDisplay edit — and that meaning is *"open a different control"*, not *"refine this one"*. Two meanings for one gesture gets learned as "hold does something unpredictable."

**Must-not:** never on the primary action buttons. It would tax `HE-23` dozens of times per orbit, Fold/Call/Raise are not confusable in the first place, and it would stack a confirmation on top of `HE-22`'s pre-arm.

**This is a Gate 4 input, not a follow-on.** It overlaps `WS-316` as a *third* strategy for the touch-floor problem — it doesn't enlarge targets, it removes the need for precision. The three strategies must be evaluated together in the surface artifact.

---

## Gate 4 split (2026-07-31)

`/next` could not compose Gate 4 at all: `WS-313` measured **L = 3 effort sessions against a 2-session cap**. That is a real defect in how I scoped it — one ticket carrying eleven pre-commitments plus the touch-floor strategy plus the confirm-before-commit design plus the sizing track.

Split along the actual dependency structure, not for convenience:

| Phase | Item | Decides | Effort |
|---|---|---|---|
| **A** | `WS-319` | **Geometry.** Does the command column keep living inside the uniform scale transform? Fixes the coordinate system, the touch floor, and overflow behaviour. **Subsumes `WS-311`** if the column is un-scaled. | M |
| **B** | `WS-320` | **Vocabulary.** *Tap commits. Hold refines. Release confirms. Cancel abandons.* Plus the three-way long-press collision. | M |
| **C** | `WS-313` | **The surface artifact** — narrowing, roster rail, defaults, TournamentView, decomposing Gate 5. | M |

Each is now cap-sized and they are strictly ordered. Writing C first would mean specifying a surface on top of an unresolved coordinate system and an unresolved gesture vocabulary, then rewriting it.

---

## Phase A finding (2026-08-01, SPR-162)

Measured the command column at scale 1.0, so design px = rendered px:

```
column box    450 × 720
scrollHeight  839        ← over-subscribed by 119px
children:  48 tabs · 65 seat · 85 orbit · 432 action block · 0 spacer · 209 control zone
```

**Two things change the shape of the decision.**

**The `flex-1` spacer is already at 0.** `WS-311`'s proposed fix (c) — *collapse the spacer before shrinking controls* — is dead. The spacer has already collapsed; the compression is what happens after it ran out.

**No coordinate-system change makes 839 fit in 720.** Scale-aware floors and a raised design-px floor both make it *worse* (bigger controls, same box). Un-scaling makes it worse in absolute terms too (540 real px for 839 of content on the founder's device). **The column is over-subscribed on content, independent of the transform** — scale was hiding it by shrinking everything below the touch floor.

**Decision: un-scale the interactive bands, and treat content reduction as non-optional.** The felt keeps scaling (its proportions *are* the information); the command column and any roster rail lay out in real CSS px, where a 44px control is actually 44px. Street tabs pin to the top, control zone pins to the bottom, only the middle band scrolls — so `Next Hand` becomes structurally unclippable and **`WS-311` closes via Phase A** rather than being fixed twice.

`WS-186` (table flip) deferred explicitly, and Phase A makes it *cheaper* later: with the felt as the only scaled region, a 180° flip becomes a transform on the felt alone rather than on the whole canvas including the controls.

**Founder chose APP-WIDE (2026-08-01).** I had recommended TableView-only. App-wide is the better call, for a reason neither of us had in front of us: **there is already a responsive migration in flight.**

The [2026-06-19 responsive audit](../../docs/design/audits/2026-06-19-responsive-layout-audit.md) established the paradigm split, built `FluidView` as the vehicle, migrated Sessions / Settings / Players — then stalled on its own **open question #1** (*"do Stats/Analysis/Online/Tournament stay scaled, or become fluid?"*), which has sat unanswered for six weeks. That is a version of the question asked here.

So app-wide **finishes existing work** rather than starting new work. It also supplies the rule June was missing: the June rule was **per-view** and cannot express TableView, which holds a spatial felt *and* an interactive command column. The doctrine promotes it to **per-region** — *spatial regions scale, interactive regions do not*. For most views that collapses back to the per-view rule and nothing changes; only TableView and HandReplay need the finer grain.

June's open question #1 is now marked **answered: fluid** — and derived rather than asserted, since none of those four views contains a region whose geometry carries meaning.

Doctrine: [`surfaces/layout-doctrine.md`](../../docs/design/surfaces/layout-doctrine.md) · TableView half: [`surfaces/table-view-geometry.md`](../../docs/design/surfaces/table-view-geometry.md) · Migration: `WS-322`.

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
- 2026-07-31 — **Founder proposal: confirm-before-commit** (`WS-317`). Gate 1 YELLOW. Measurement corrected the premise (card grid is ~2× the floor, so the fix is feedback timing not target size) and surfaced a long-press vocabulary collision across three shipped surfaces. Routed into Gate 4 as a co-design input rather than a follow-on.
- 2026-07-31 — **Gates 3 + Gate-2-re-run complete.** R1–R6 closed; `glance-return-chris` + HE-22 + HE-23 + PM-16 authored; `ringmaster-in-hand` REFUTED; handedness closed (two-handed). Re-run GREEN → Gate 4 open. Local dev/verification harness added (`npm run env:local` / `npm run devshot`), which reproduced WS-311 at the design resolution and ruled the CSS media query out of WS-315. Still zero `src/` changes.
- 2026-07-31 — **Device evidence added mid-session** (founder screenshots). Compression prediction confirmed; two new P0 findings (scale-nullifies-touch-floor, orientation gate blocks entry). `WS-315` + `WS-316` filed, `WS-311` upgraded to P0. Still zero `src/` changes.
