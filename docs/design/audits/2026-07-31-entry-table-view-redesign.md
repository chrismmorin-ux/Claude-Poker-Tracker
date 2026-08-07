# Gate 1 Entry — 2026-07-31 — Table View redesign (hand-entry speed, dynamic layout, player entry)

**Surface working name:** Table View v2 — `surfaces/table-view.md` reworked from the ground up
**Proposed by:** Founder request, 2026-07-31 — *"kick off a redesign of the table view … from the ground up, rooting it in what we've learned about common actions and sizing to speed up hand entry, better utilizing the space and optimizing for hand entry speed … maybe introducing some dynamic elements as the hand plays out, like narrowing the table or having deliberately thought out default actions but also ability to be precise. Also player entry is a bit slow."*
**Gate:** 1 (Entry)
**Next gate:** 2 (Blind-Spot Roundtable) — **required**, see verdict.
**Status:** **RED.**

---

## Why this audit exists

The Table View is the only surface used *during* a hand. It has accreted through DCOMP-W1 (2026-04-21, twelve findings all closed), WS-002 straddle, WS-129 guards, WS-182 intent-based recording, WS-190 review-tag, WS-191 multi-select and HE-19 all-in. Every one of those was a **surface-bound fix**: a defect repaired in place, inside a layout whose proportions have never been revisited.

The founder's request is the first time the *allocation* is in question rather than the contents. That is a different class of change and it does not fit the surface-bound path.

---

## Evidence — the measured case (code read 2026-07-31, not assumed)

### E1 — The layout is constant; the hand is not

`LAYOUT` (`src/constants/gameConstants.js:99-138`) fixes every proportion at module scope:

| Element | Value | Varies by street? | Varies by players remaining? |
|---|---|---|---|
| `TABLE_WIDTH` × `TABLE_HEIGHT` | 1600 × 720 | no | no |
| `FELT_WIDTH` × `FELT_HEIGHT` | 860 × 450 | no | no |
| `TABLE_OFFSET_X/Y` | 117, 95 | no | no |
| `ACTION_PANEL_WIDTH` | 450 | no | no |

The CommandStrip is `position: absolute; right: 0; top: 0; bottom: 0` at 450px (`CommandStrip.jsx:684-693`) — **324,000 px², 28% of the canvas, identical 9-handed preflop and heads-up on the river.**

Felt-region budget with the sidebar collapsed (`ml-14` = 56px): 1600 − 450 − 56 = **1094 × 720**. The felt occupies x 117–977, y 95–545. That leaves ~117px gutters on both sides, ~95px above and ~175px below — and because the felt is a stadium, its own bounding-box corners are empty too. **Roughly 35–40% of the left region carries no information at any moment in any hand.**

### E2 — The CommandStrip over-subscribes its own column

Worst realistic case — seat selected, preflop, sizing panel open, all-in row, batch row, control zone:

```
street tabs        40   (CommandStrip.jsx:705)
advice bar        ~80
seat indicator    ~64   (:766)
orbit strip     40–80   (:856, flex-wrap → 2 rows at 9-handed)
action buttons    100   (:943)
sizing panel     ~130   (68 presets + 48 custom + padding)
all-in            56    (:1010)
batch row         68    (:1023)
control zone     ~240   (48 + 48 + 48 + 68 + padding)
                 ────
                 ~818–858  in a 720px column
```

Children carry `height` (not `min-height`) and inherit `flex-shrink: 1`. There is no `overflow-y`. So the column does not scroll — **it compresses, and the 100px "can't-miss thumb hit" action buttons shrink first**, precisely in the states where the most is on screen. This is a live defect, not merely a redesign opportunity.

> **CONFIRMED on device, same session.** The founder supplied screenshots after this section was drafted. [`evidence/2026-07-31-tvr-device-baseline/02-table-preflop-nexthand-clipped.jpg`](../evidence/2026-07-31-tvr-device-baseline/) shows the table at preflop with UTG to act and **the gold Next Hand CTA cut off by the bottom edge of the screen.** The flop screenshot shows it fully visible, because the orbit strip does not render postflop — the predicted mechanism, observed. The consequence is worse than this section assumed: it is not that buttons squash, it is that **the primary CTA of the surface is unreachable in the most common state of the app.** `WS-311` upgraded P1 → **P0**.

### E3 — Player entry is ordered inversely to frequency

`SeatContextMenu.jsx:200-223` renders, in order: Make My Seat → Make Dealer → [Straddle] → [Multi-select] → divider → [Clear Player, Swap Player] → Find or Add Player… → divider → "Recent" label → up to 20 recent names.

At `MENU_ROW_CLASS` 44px/row, the Recent list begins ~250px into a `max-h-96` (384px) scroll container: **about 3 of up to 20 recent names are visible without scrolling.** The single highest-frequency player operation at a live table is the furthest from the thumb, behind a scroll, below four seat-config rows that fire perhaps once per session each.

Entry is also gated on `onContextMenu` only (`SeatComponent.jsx:100`) — a ~500ms native long-press with no press-state feedback in the component. Tapping an empty seat selects it and does nothing else.

### E4 — Defaults are computed and then discarded

`actionAdvice` (`CommandStrip.jsx:653-665`) classifies VALUE / BLUFF / CHECK. `engineOptimal` sizing already highlights the nearest preset within 25% (`SizingPresetsPanel.jsx:26-37`). Yet fold, call and raise render as **identical 100px rectangles** (`CommandStrip.jsx:924-948`) despite order-of-magnitude frequency differences, and nothing is pre-armed. The engine's opinion is displayed but never lowers the cost of the likely action.

### E6 — The uniform scale transform nullifies the 44px touch floor *(added post-draft, from device evidence)*

`useScale.js` computes `s = min(vw·0.95/1600, vh·0.95/720, 1)` and `ScaledContainer` applies it as a **single CSS transform over the whole canvas**. Every px value inside — every button height, every `min-h-[44px]` — is multiplied by `s` before it reaches a thumb.

Measured from the screenshots: the 1600-design-px canvas spans ≈2118 physical px, so `s × DPR ≈ 1.26`. The width term binds. Independent of the exact DPR:

| DPR | CSS viewport width | `s` | a "44px" target renders at |
|---|---|---|---|
| 2.0 | ~1059 | 0.63 | **~28 CSS px** |
| 1.5 | ~1412 | 0.84 | **~37 CSS px** |

**The H-ML06 44px minimum is not met anywhere in the app on the founder's own device.** This nullifies prior work: `AUDIT-2026-04-21-TV F8` raised recent-player rows 40→44px inside a canvas that is then shrunk — it moved the rendered target from ~25px to ~28px and never reached its own floor. The 2026-04-21 audit anticipated the mechanism but recorded it as hypothetical; it is the everyday operating condition.

**This invalidates Gate 2's pre-commitment #2 ("all targets ≥44px") as literally written.** Gate 4 must restate every size floor in terms of *rendered* size. Ticket: `WS-316`. Evidence: EVID-2.

### E7 — Entry is gated on device orientation *(added post-draft, founder report)*

`RotateDeviceHint` (`hidden portrait:flex fixed inset-0 z-[200]`) is a full-screen, undismissable overlay shown whenever a landscape-classified view meets a portrait media query — with nothing rendered behind it and no way past. It was added as a fallback for `screen.orientation.lock()`, which only works in an installed PWA, so **the population that hits the block is exactly the population that has not installed the app.** Founder report: the app must be *loaded* in landscape; rotating afterwards does not recover.

The design objection outlives the bug: gating entry on orientation is solving a *layout* problem with a *user instruction*. Portrait is not unsupported by decision — it is unimplemented, because the app has one layout and scales it. Ticket: `WS-315` (P0). Evidence: EVID-3.

### E5 — What already works and must not regress

Orbit tap-ahead with `+N` fold-preview badges (`:832-912`), batch `Rest Fold` / `Fold to X` / `Check All` (`:1017-1046`), auto-advance after record (`:238-245`), auto-select first-to-act (`useAutoSeatSelection`), 12s unified undo (`UNDO_TOAST_DURATION_MS`, `:254`). A routine preflop orbit is already ~4 taps. **The redesign's speed case is postflop, player entry, and legibility under compression — not preflop action recording, which is close to optimal already.**

---

## Output 1 — Scope classification

**Composite. Three of the five classes fire at once:**

1. **Surface addition** — a persistent roster rail is a new element occupying space that currently reads as non-interactive; a pre-armed default is a new control state.
2. **Cross-surface journey change** — a felt-side roster rail overlaps PlayerFinderView's job (`PlayerFinderView.jsx`, 778 LOC, mode `find`/`edit`/`create`) and changes when that full-screen view is entered at all.
3. **System-coherence audit** — "how much space does this state deserve" is currently answered by module-scope constants. Making it state-derived is a density-rhythm decision that must hold across TableView *and* the sidebar product line (`surfaces/sidebar-shell-spec.md`), or the two products drift apart.

**New interaction primitives introduced — three, all unprecedented in this repo:**

| Primitive | Precedent in repo | Notes |
|---|---|---|
| Layout that reflows *under the user, mid-hand* | **none** | Everything today is static or user-initiated |
| Pre-armed action (app proposes the next input) | **none** | Engine advises; it has never pre-selected |
| Always-visible roster rail on the table surface | **none** | Player ops have always been menu- or view-gated |

### Gate 2 triggers — four fire

- New surface element ✅
- New interaction primitive (×3) ✅
- Founder flagged the work as ground-up ✅
- Layout change affects a destructive-action neighbourhood (Reset Hand / Next Hand motor proximity, previously fixed as F10 — any re-layout can silently re-open it) ✅

**Gate 2 is required and not bypassable.** `LIFECYCLE.md` permits owner bypass only for *small surface-bound fixes*; this is the opposite.

---

## Output 2 — Personas identified

**Primary (in-hand):**
- [mid-hand-chris](../personas/situational/mid-hand-chris.md) — half-second decisions; forbids modal interrupts. The controlling persona for defaults and for compression.
- [ringmaster-in-hand](../personas/situational/ringmaster-in-hand.md) — hosting *and* recording; "non-modal-everything". Still **PROTO** — flagged as inferential in the 2026-04-21 audit open question #4, and still unbacked 14 weeks later.

**Secondary (between-hands):**
- [between-hands-chris](../personas/situational/between-hands-chris.md) — 30–90s window; owns player entry and calibration.
- [seat-swap-chris](../personas/situational/seat-swap-chris.md) — table composition churn; the roster rail's heaviest user.
- [cold-read-chris](../personas/situational/cold-read-chris.md) — assigning unknowns.

**Stress personas (where dynamic layout is most dangerous):**
- [stepped-away-from-hand](../personas/situational/stepped-away-from-hand.md)
- [returning-after-break](../personas/situational/returning-after-break.md)
- [newcomer-first-hand](../personas/situational/newcomer-first-hand.md)

**Explicit sufficiency check — *does the cast cover this?*** **No.** See Gap G1.

---

## Output 3 — JTBD identified

**Served today, directly affected:**
- `JTBD-HE-11` — one-tap seat action entry ("so I don't fall behind") — the core speed job. Note it is scoped **per seat-action**; nothing scopes the orbit as a unit.
- `JTBD-HE-12` — undo / repair a miskeyed action — the failure side of any default.
- `JTBD-HE-17` — flag a hand for review while recording (ControlZone real estate).
- `JTBD-HE-18` — post a straddle (context-menu row that a re-ordered menu must not orphan).
- `JTBD-PM-02` — assign a known player to a seat — the job the roster rail re-homes.
- `JTBD-PM-01` — clear a seat; `JTBD-PM-13` — describe someone into existence.
- `JTBD-MH-02` — know whether the recommendation is fresh.
- `JTBD-MH-11` — validate the pot before acting.

**Explicit coverage check — *does any proposed outcome fail to map?*** **Yes, three.** See Gaps G2–G4.

---

## Output 4 — Gap analysis

### G1 — No persona models re-orientation cost after an automatic layout change *(RED)*

Every situational persona assumes the table looks the way it did when they last looked at it. `stepped-away-from-hand` and `returning-after-break` model *state* recovery ("what happened while I was away") — **not *spatial* recovery** ("the table is a different shape than when I looked away").

This is the single largest risk in the founder's direction. Live-players-remaining-driven narrowing means the felt can reflow *while the user's eyes are on the dealer* — which is exactly when they are not watching the screen. There is no modeled persona whose failure mode this is, so nothing in the framework will catch a bad answer.

### G2 — No JTBD covers "the app proposes my next input" *(RED)*

The atlas has jobs for entering (HE-11), correcting (HE-12), and being advised (MH domain). It has **no job for the app pre-committing to an input on the user's behalf.** Pre-arming is neither advice (which is inert) nor entry (which is user-initiated); it is a new category with its own success and failure criteria — chiefly: *does a pre-armed wrong default get committed more often than an un-armed one?*

### G3 — No JTBD scopes the orbit as a unit *(YELLOW)*

HE-11 is per-seat. The batch controls (`Rest Fold`, `Fold to X`, `Check All`) and orbit tap-ahead already operate on *runs of seats* and have no JTBD of their own — they were built as accelerators of HE-11. If orbit-level throughput is now a primary design target, it needs an explicit job, or the design will keep optimising a per-seat metric while the founder is describing an per-orbit one.

### G4 — No JTBD for maintaining the table roster as a standing object *(YELLOW)*

PM-02 is *"assign a known player to a seat"* — a discrete act. A persistent roster rail implies a continuous job: *"keep the app's picture of who is at this table matching reality, cheaply, all session."* Seat-swap-chris does this constantly and currently pays full PM-02 cost per change.

### G5 — Ringmaster-in-hand is still PROTO *(carried forward, YELLOW)*

Flagged 2026-04-21 (open question #4), unresolved. Two of the founder's three directions (defaults, dynamic layout) cite it as a beneficiary. Designing for an unvalidated persona is how surface area gets built for nobody.

### Ready (no gap)

- Seats are **percentage-positioned** (`SEAT_POSITIONS`, x/y as %) — dynamic felt dimensions reflow all nine seats, chip stacks and badges for free. This is the enabling fact that makes the founder's "narrowing" direction cheap.
- `activeSeatCount` and `hasSeatFolded` already exist in `useSeatUtils` — the narrowing trigger needs no new derivation.
- `getRecentPlayers(20, true)` already feeds the menu — the roster rail needs no new query.
- Engine advice and optimal sizing already computed — pre-arming needs no new engine work.

### At risk

- **Data integrity under defaults.** This is a *tracker*: for villains it records what happened. A default may adjust **prominence and ordering only** and must never auto-commit. Founder ratified this constraint 2026-07-31 (chose "weighted + pre-armed", explicitly rejecting confirm-to-advance). Binding on Gate 4.
- **Destructive-action proximity (F10 regression class).** Any re-layout can silently re-open the Reset Hand / Next Hand miss-tap surface that DCOMP-W1 closed.
- **Sidebar coherence.** Density decisions must hold across both product lines or `sidebar-shell-spec.md` drifts.
- **Compression defect (E2) is orthogonal.** It is a live bug and should be fixed on its own merits, not held hostage to the redesign.

---

## Output 5 — Verdict

**RED.** The change targets outcome space the framework has not modeled: one unmodeled persona failure mode (G1) and one entirely unmodeled job category (G2), plus two YELLOW job gaps and a carried-forward PROTO persona.

**Required path:** Gate 1 → **Gate 2 (roundtable)** → **Gate 3 (research — scoped to G1/G2 at minimum)** → Gate 4 → Gate 5.

**No production code may be written before Gate 4 produces a surface artifact.** Nothing in this session touched `src/`.

---

## Founder decisions recorded (2026-07-31, pre-Gate-2)

| # | Question | Decision |
|---|---|---|
| 1 | How far do defaults go? | **Weighted + pre-armed.** Buttons sized by real frequency; most-likely action visually pre-armed as a single confident tap; precise entry stays one tap away. **Nothing auto-records.** Confirm-to-advance explicitly rejected. |
| 2 | What drives narrowing? | **Live players remaining.** Felt shrinks and panel grows as seats fold. Street-driven and manual-toggle rejected. |
| 3 | Where does player entry live? | **Recents-first roster rail in the felt's dead space.** Tap an empty seat to assign directly; context menu retains only rare seat-config ops. |

These are direction, not design. Gate 2 may find that any of them breaks a situation — G1 in particular is a live threat to decision #2, and Gate 2 is empowered to send it back.

---

## Links

- **Device evidence: [`evidence/2026-07-31-tvr-device-baseline/`](../evidence/2026-07-31-tvr-device-baseline/README.md)** — founder screenshots, 2026-07-31. Confirms E2, produces E6 + E7.
- Project file: `.claude/projects/table-view-redesign-2026-07-31.md`
- Gate 2 output: [`2026-07-31-blindspot-table-view-redesign.md`](./2026-07-31-blindspot-table-view-redesign.md)
- Prior audits: [`2026-04-21-table-view.md`](./2026-04-21-table-view.md) (12 findings, all closed), [`2026-04-21-blindspot-table-view.md`](./2026-04-21-blindspot-table-view.md)
- Surface artifact to be reworked: [`surfaces/table-view.md`](../surfaces/table-view.md)
- Related queue: `WS-186` (table flip — same spatial-translation problem), `WS-187` (photo-primary avatars — roster rail depends on seat identification legibility)

## Change log

- 2026-07-31 — Drafted. RED verdict. Gate 2 required.
- 2026-07-31 — **Device evidence appended same session.** Founder supplied screenshots after Gates 1+2 were drafted. E2 upgraded from predicted to CONFIRMED (Next Hand CTA clipped at preflop; `WS-311` P1→P0). Two new findings the code read could not reach: **E6** — the uniform scale transform nullifies the 44px touch floor app-wide (`WS-316`, P0), which invalidates Gate 2 pre-commitment #2 as written; **E7** — the orientation gate hard-blocks entry for uninstalled-PWA users (`WS-315`, P0). Verdict unchanged (RED) — the new findings reinforce it.
