# Z1 — Table read specs

**Batch 2 of 6 (SR-4).** Per-element specs for every Z1 row with a non-`delete` verdict, authored against doctrine v2 (`docs/SIDEBAR_DESIGN_PRINCIPLES.md`).

**Inventory source:** `docs/SIDEBAR_PANEL_INVENTORY.md` §Z1 (rows 1.1–1.10) + §Rule V.

**Omitted rows:**
- **1.2** seat style badge — deleted per inventory (pill row 1.9 is style source of truth; R-5.1 single-owner).
- **1.6** seat action tag — deleted per inventory (duplicate of 1.5; R-5.1 single-owner).
- **1.8** stale-advice tint + badge — **escalated out of Z1** (see §Escalations). RT-48 shipped the indicator exclusively on the action bar (Z2) and plan panel (Z4); no seat-level rendering exists. Specced in Z2/Z4, not here.

**Spec count:** 7 elements (1.1, 1.3, 1.4, 1.5, 1.7, 1.9, 1.10).

---

## 1.1 Seat circle (hands-count ring)

```spec-meta
tier: informational
owner: render-orchestrator.js:buildSeatArcHTML
slot: "#seat-arc .seat-circle, #seat-arc .seat-ring"
```

### 1. Inventory row
`1.1 Seat circle (hands count ring)` — per-seat presence marker with a circular ring whose fill/thickness encodes accumulated hand sample size for that seat's villain.

### 2. Doctrine citations
R-1.1 (fixed zone position — seat arc geometry), R-1.2 (spatial stability — seat index → arc position is immutable within a hand), R-1.3 (no reflow — vacant seats reserve their arc slot), R-1.5 (glance pathway), R-3.1 (informational tier), R-4.2 (unknown placeholder for zero-sample seats), R-5.1 (single owner of the per-seat slot).

### 3. Glance pathway
- **Remembered location:** Z1 seat arc; each seat occupies a fixed angular position determined by its seat index relative to the hero star (1.3) anchor. 9-seat geometry: hero bottom-center, seats laid clockwise. Circle diameter ~44 px; ring ~3 px stroke just outside the circle.
- **Default summary:** filled circle (seat background color) with a concentric ring. Ring fill sweeps clockwise from 12 o'clock to encode sample size on a logarithmic scale banded at {0, <20, 20–99, 100–499, 500+}. Color of the ring is a muted gray; the seat-fill color carries villain-pin / style state (owned elsewhere, not by this element).
- **Drill-down affordance:** **tap target** — the 40×40 px bounding box around the seat circle. Tap pins/unpins the villain (existing behavior, side-panel.js:1342–1359) and, per Rule V item 6, routes a range-selection override to the Z3 range slot.
- **Expansion location:** in-place popover (`showSeatPopover`). Popover belongs to the seat-popover subsystem, not to this element's layout; no Z1 reflow.

### 4. Data contract
- **Source:** `appSeatData[seat]` (hand count + seat occupancy). Seat occupancy is cross-referenced with `currentLiveContext.seats[i]` to distinguish "vacant" from "0-sample occupied".
- **Compute:** ring fill = `quantize(log10(1 + handsCount), bands)`; a pure render function over hand count.
- **Invalid states:**
  - **Vacant seat** (no player at that seat index in `currentLiveContext.seats`): the seat arc slot is reserved (R-1.3 no reflow) and the circle renders in a **blanked** style — no fill, no ring, a 1 px dashed outline indicating "seat reserved, not occupied". This replaces the old "vacant seats should blank" inventory language with an explicit placeholder form.
  - **Occupied, zero hands** (player present, `handsCount === 0`): the circle renders normally (seat fill color) and the ring is **absent** (not gray-zero, which would read as "small sample" and confuse with the <20 band). A small `—` glyph overlays the ring position. This is the R-4.2 unknown placeholder for this element.
  - Missing `appSeatData`: render as occupied-zero if seat is present in `currentLiveContext`, blanked if not.

### 5. Interruption tier
`informational` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** seat arc mount (sidebar boot once a live context exists). Each seat slot in the arc is created once and re-used.
- **Update triggers:** `renderKey` fields for `appSeatData[seat].handsCount`, seat occupancy (present/vacant), and pin state (pin is owned elsewhere but shares the slot color).
- **Unmount condition:** never; the slot is reserved for the seat index as long as the table exists. On table switch, all seat slots re-mount together (R-5.1 single-owner per slot — one re-mount event).
- **`hand:new` behavior (R-2.4):** no reset. `handsCount` is a session-scoped accumulator that increments *after* showdown, not at hand boundaries. The ring does not flicker or re-animate on `hand:new`.

### 7. Corpus coverage
- Active seats with non-zero counts: S1/01, S5/01.
- Vacant / blanked slot: S3/01 (heads-up frame with other seats empty), S8/01 (no-table state exercises the full-blank geometry).
- Zero-hand occupied seat (R-4.2 placeholder): **TODO corpus extension** — current corpus does not fire an occupied seat with `handsCount === 0`. SR-6 harness should add a synthetic fixture (fresh session, new villain seated).

### 8. Rejected alternatives
Encoding sample size via seat-fill opacity was rejected — it collides with the villain-pin color channel, which has single ownership of the seat fill (R-5.1). A separate ring preserves one channel per concern.

---

## 1.3 Seat hero star

```spec-meta
tier: ambient
owner: render-orchestrator.js:buildSeatArcHTML
slot: "#seat-arc .seat-hero-star"
```

### 1. Inventory row
`1.3 Seat hero star (center circle)` — marks the hero seat so the user always knows their own position on the arc.

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3, R-1.5, R-3.1 (ambient), R-5.1.

### 3. Glance pathway
- **Remembered location:** Z1 seat arc, hero seat slot (always bottom-center by arc geometry). A small star glyph (8 px) centered inside the hero's seat circle (1.1).
- **Default summary:** filled gold star inside the hero circle. Size and color are fixed; the star never animates.
- **Drill-down affordance:** none (glance-only). The hero seat does not open a popover — hero identity is a given, not a scouting target.
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `currentLiveContext.heroSeat` (integer seat index).
- **Compute:** `seat === heroSeat`; pure boolean check per seat slot during arc render.
- **Invalid states:** if `heroSeat` is null/undefined (pre-context boot), the star is absent from every seat — no seat is incorrectly marked hero. Zero ambiguity is the R-4.1 requirement; silent absence is acceptable here because the *concept* of hero is unambiguous (the missing star reads as "no hero identified yet", not "you are no one").

### 5. Interruption tier
`ambient`.

### 6. Render lifecycle
- **Mount condition:** arc mount once `heroSeat` is known.
- **Update triggers:** `renderKey` field for `heroSeat` (rare — changes only on table switch).
- **Unmount condition:** table switch clears hero; arc re-mounts.
- **`hand:new` behavior (R-2.4):** no reset. Hero seat is table-scoped, not hand-scoped.

### 7. Corpus coverage
- Hero star rendered: S1/01, S4/01.
- Pre-context (no star): S8/01 (no table — full arc blank).

---

## 1.4 PFA annotation

```spec-meta
tier: decision-critical
owner: render-orchestrator.js:buildSeatArcHTML
slot: "#seat-arc .seat-pfa-pill"
```

### 1. Inventory row
`1.4 PFA annotation (green "PFA" label)` — marks the preflop aggressor on the seat arc so the user can orient postflop ranges to the known aggressor.

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3, R-1.5, R-2.4 (explicit `hand:new` reset), R-3.1 (decision-critical), R-5.1.

### 3. Glance pathway
- **Remembered location:** Z1 seat arc, attached to the PFA's seat circle. Small green pill containing `PFA` text, positioned above the seat circle (opposite side from the dealer button 1.7 so the two do not collide on the button seat when the button is also the PFA).
- **Default summary:** green pill with white `PFA` glyph. Pill appears only on the PFA seat; never on multiple seats simultaneously.
- **Drill-down affordance:** none (glance-only).
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `currentLiveContext.pfAggressor` (seat index of the preflop aggressor, or null during preflop until the first raise resolves).
- **Compute:** `seat === pfAggressor`; pure boolean check per seat slot.
- **Invalid states:**
  - **Preflop, before any raise:** no PFA is set; the pill does not render anywhere. This is the correct default (R-4.1 — "no aggressor" is a truthful state, not unknown data).
  - **Limped pot reaching the flop with no preflop raise:** `pfAggressor` remains null postflop; the pill does not render. Rule V falls through to item 4 (no-aggression placeholder in Z3), which is the cross-zone consequence.
  - **Hero is PFA:** the pill renders on the hero seat. This is a valid state and the glance signal is correct.

### 5. Interruption tier
`decision-critical` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** first time `pfAggressor` becomes non-null within a hand (typically resolved on the preflop raise action).
- **Update triggers:** `renderKey` field for `pfAggressor`. If a 3-bet/4-bet re-assigns the PFA, the pill moves to the new seat; the slot on the old seat is blanked but the slot (the airspace above each seat circle) is always reserved so there is no reflow (R-1.3).
- **Unmount condition:** `hand:new` clears `pfAggressor`; the pill disappears from the arc until the next preflop aggressor is identified.
- **`hand:new` behavior (R-2.4):** **explicit reset.** `pfAggressor` is cleared at `hand:new`; the pill does not persist across hand boundaries. This is the most hand-scoped element in Z1.

### 7. Corpus coverage
- PFA rendered postflop: S1/01 (preflop reveal), S5/01 (multiway postflop with PFA visible).
- No PFA (limped / pre-raise preflop): **TODO corpus extension** — no current frame captures the limped-to-flop state cleanly for this element. SR-6 can synthesize from S13/01 (checked-around flop) if that fixture also has no PFA.

---

## 1.5 Seat bet chip ("B $9" / "C $6" / "R $9")

```spec-meta
tier: decision-critical
owner: render-orchestrator.js:buildSeatArcHTML
slot: "#seat-arc .seat-bet-chip"
```

### 1. Inventory row
`1.5 Seat bet chip ("B $9" / "C $6" / "R $9")` — per-seat live wager indicator for the current street. Owns the per-seat per-street action-annotation slot.

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3 (slot reserved even when no wager), R-1.5, R-3.1 (decision-critical), R-5.1 (sole owner of the per-seat per-street annotation slot — 1.10 shares the slot with declared priority; see §Batch invariants).

### 3. Glance pathway
- **Remembered location:** Z1 seat arc, slot attached to each seat circle on the pot-facing side. Fixed-width chip (~56 px) sized to the widest expected label (`R $999`).
- **Default summary:** small chip with a one-letter action prefix + amount: `B $9` (bet), `C $6` (call), `R $9` (raise). Color-coded by action (existing palette). Chip renders only for seats with a non-zero wager this street.
- **Drill-down affordance:** none (glance-only).
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `currentLiveContext.seats[i].streetBet` (amount) and `currentLiveContext.seats[i].lastAction` (for the B/C/R prefix).
- **Compute:** `prefix(lastAction) + " $" + streetBet` when `streetBet > 0`; render nothing when `streetBet === 0` or seat has folded.
- **Invalid states:**
  - **Seat folded this hand:** chip is blanked (R-1.3 slot reserved — see §Batch invariants for priority).
  - **Seat checked this street (streetBet === 0 with lastAction === 'check'):** chip is blanked; the slot is occupied by 1.10 (check indicator) per declared priority.
  - **Fractional-bet edge case (from S1 corpus):** amount is rendered to at most one decimal for sub-dollar values; pre-existing rendering policy.

### 5. Interruption tier
`decision-critical`.

### 6. Render lifecycle
- **Mount condition:** first non-zero wager on the street.
- **Update triggers:** `renderKey` fields for `streetBet` and `lastAction` per seat.
- **Unmount condition:** street advance clears `streetBet` (bets roll into pot); chip blanks. The slot remains reserved.
- **`hand:new` behavior (R-2.4):** **reset.** All seat bet chips blank at `hand:new`. The slot remains reserved (arc geometry is hand-independent).

### 7. Corpus coverage
- Active bet / call / raise chips: S1/01 (preflop raises + calls), S3/01 (flop HU bet chip), S5/01 (multiway flop with mixed chips).
- Folded-seat blanking: S11/02 (hero folded; surrounding seat state visible).

---

## 1.7 Dealer button

```spec-meta
tier: informational
owner: render-orchestrator.js:buildSeatArcHTML
slot: "#seat-arc .seat-dealer-button"
```

### 1. Inventory row
`1.7 Dealer button (D chip)` — marks the button seat so the user can derive position for every other seat without reading labels.

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3, R-1.5, R-3.1 (informational), R-5.1.

### 3. Glance pathway
- **Remembered location:** Z1 seat arc; a small `D` chip attached to the button seat's circle, positioned opposite the PFA pill slot (1.4) so the two never collide geometrically.
- **Default summary:** white circular chip with bold black `D` glyph (~16 px). Exactly one chip visible per hand.
- **Drill-down affordance:** none (glance-only).
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `currentLiveContext.buttonSeat`.
- **Compute:** `seat === buttonSeat`; pure boolean per seat.
- **Invalid states:** if `buttonSeat` is null (pre-context), the chip is absent from every seat. This is rare and transient; the arc is typically not renderable in a meaningful way without a button seat, so the absence is a non-issue under R-4.1.

### 5. Interruption tier
`informational`.

### 6. Render lifecycle
- **Mount condition:** arc mount once `buttonSeat` is known.
- **Update triggers:** `renderKey` field for `buttonSeat`. The button moves exactly once per hand (on the transition between hands); the chip re-renders on the new seat slot and blanks on the old.
- **Unmount condition:** table switch; the chip re-mounts on the new table's button.
- **`hand:new` behavior (R-2.4):** **button moves.** The chip relocates to the next seat on `hand:new` (per the dealer-button rotation rule). This is the only Z1 element whose *position* changes at hand boundaries; its slot (the arc position per seat) is still hand-independent.

### 7. Corpus coverage
- Button rendered: S4/01, S1/01.
- Button rotation across hands: **TODO corpus extension** — no current frame captures the rotation transition itself. SR-6 harness should step S4 through a `hand:new` event and capture both frames.

---

## 1.9 Villain style pill row

```spec-meta
tier: informational
owner: render-street-card.js:renderStreetCard
slot: ".villain-tab"
```

### 1. Inventory row
`1.9 Villain style pill row ("S1 Fish 30h" etc.)` — row of one pill per still-in villain, summarizing seat, style, and sample size. Shown below the action bar in the Z1 region.

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3 (row height reserved whether 0 or 4 pills), R-1.5 (targeted-glance pathway for "who is still in the pot?"), R-3.1 (informational), R-5.1 (single owner of the still-in-villains scouting slot).

Cross-reference: **Rule V** (inventory §Rule V) binds the click behavior of pills in this row to the Z3 range slot's seat selection. This spec describes the pill-row half only; the range-slot half is in `z3-street-card.md` (row 3.6 / 3.7 / 3.11).

### 3. Glance pathway
- **Remembered location:** Z1, fixed-height single-row strip below the action bar. Row height reserved even when the row is empty (no villains still in, or HU with the sole villain). Pills lay out left-to-right in seat-index order (not action-recency order — spatial stability requires a stable sort).
- **Default summary:** one pill per still-in villain, format `S{seat} {style} {N}h` (e.g., `S3 Fish 42h`). Pill coloring matches the seat-fill color for that villain (cross-reference with 1.1 seat circle color — consistent color channel). The currently-range-selected villain (per Rule V) is visually highlighted (heavier border / inverted fill) — this is how the pill row makes Rule V's selection visible within Z1 without needing to look at Z3.
- **Drill-down affordance:** **pill/chip click** (per vocabulary). Clicking a pill routes to Rule V item 6 (user override of the range-slot seat selection). The click does not expand anything in Z1; the expansion happens in the Z3 range slot.
- **Expansion location:** n/a within Z1 (the click's effect is entirely in Z3).

### 4. Data contract
- **Source:** `currentLiveContext.seats[]` (occupancy + folded state) ∩ `appSeatData[seat]` (style + hand count). Hero is excluded.
- **Compute:** filter to seats where `!folded && !isHero && occupied`; format as pills. Stable sort by seat index.
- **Invalid states:**
  - **HU with the sole villain:** the row renders exactly one pill (the HU villain). It does not hide; the slot is reserved.
  - **All villains folded (heads-up with hero vs. one remaining then that one folds):** the row is empty; slot height preserved. (This is an edge tile of the hand-in-progress state.)
  - **Preflop:** the row renders with all still-in villains (fold-resolved as folds happen). No special preflop-vs-postflop branching.
  - **Low sample (<~20h):** pill still renders with the real hand count; style field reads `—` (R-4.2 placeholder) rather than showing a noise-level classification. This is the single-channel version of the verdict that 1.2 should not exist.

### 5. Interruption tier
`informational`.

### 6. Render lifecycle
- **Mount condition:** sidebar boot once a live context with seats exists.
- **Update triggers:** `renderKey` fields for still-in-villain set (per-seat `folded` flag) + per-seat style + per-seat hand count + Rule-V-selected seat (for the highlight).
- **Unmount condition:** never; the row is always present while a table is active.
- **`hand:new` behavior (R-2.4):** **partial reset.** Folded states clear at `hand:new` → the pill row repopulates with all occupied villains. Style and hand count are session-scoped; they persist. The Rule-V highlight clears per Rule V item 6 (hand:new resets the override).

### 7. Corpus coverage
- Multiway pills: S1/01 (4 villains), S5/01 (multiway postflop).
- HU single pill: S3/01.
- Empty row: **TODO corpus extension** — no corpus captures the "all villains folded mid-hand" state cleanly. SR-6 can synthesize by replaying S3 through a fold.

### 8. Rejected alternatives
Sorting pills by action-recency (who acted last leftmost) was rejected — it violates R-1.2 spatial stability. A pill that represents seat 4 must always occupy the same horizontal position relative to a pill for seat 6, regardless of action order, so the user's visual memory of "seat 4 is third from the left" holds across hands.

---

## 1.10 Seat check-mark indicator

```spec-meta
tier: informational
owner: render-orchestrator.js:buildSeatArcHTML
slot: "#seat-arc .seat-check-indicator"
```

### 1. Inventory row
`1.10 Seat check-mark indicator` — per-seat indicator that a seat has checked on the current street. Revealed as a distinct row in the S13 checked-around-flop fixture.

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3, R-1.5, R-3.1 (informational), R-5.1 (shares the per-seat per-street annotation slot with 1.5 — this spec and 1.5 jointly declare the priority; see §Batch invariants).

### 3. Glance pathway
- **Remembered location:** Z1 seat arc, same slot as the seat bet chip (1.5) — only one of {1.5, 1.10} is ever active on a given seat on a given street. Check indicator is a small `✓` glyph (~12 px) in a subdued color (not green — green is reserved for PFA 1.4).
- **Default summary:** subtle gray `✓` glyph. Intentionally low-salience (R-3.1 informational, R-1.5 targeted-glance).
- **Drill-down affordance:** none (glance-only).
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `actionSequence[]` filtered by current street; render indicator on each seat whose most recent action on the current street is `check`.
- **Compute:** per seat, `mostRecentStreetAction(seat, currentStreet) === 'check'`.
- **Invalid states:**
  - **Seat has bet/called/raised this street:** indicator blanked; slot owned by 1.5.
  - **Seat has not acted this street yet:** indicator blanked; slot empty.
  - **Seat folded this hand:** indicator blanked permanently for the hand.

### 5. Interruption tier
`informational`.

### 6. Render lifecycle
- **Mount condition:** first `check` action on the current street.
- **Update triggers:** `renderKey` field for per-seat most-recent-action-this-street.
- **Unmount condition:** street advance clears all check indicators (a new street means new actions; checks don't carry forward). Slot is reserved.
- **`hand:new` behavior (R-2.4):** **reset.** All check indicators blank at `hand:new`.

### 7. Corpus coverage
- Checked-around flop with multiple indicators: S13/01 (the fixture that surfaced this row).
- Single check on a street: **TODO corpus extension** — S13 is the only frame; SR-6 should add a synthetic single-check fixture to verify single-seat priority with 1.5.

---

## Batch invariants (Z1-wide)

These rules apply across every Z1 element and bind the zone's layout contract. Stage 6 PR reviews check each of these as a gate.

1. **Seat arc is a fixed geometry.** The Z1 seat arc is laid out by seat count (9-max), with each seat index assigned a fixed angular position relative to the hero-anchor (bottom-center). Arc positions are declared in CSS/geometry constants and do not change with data. Vacant seats reserve their slot (R-1.3).
2. **Per-seat per-street annotation slot — declared owner priority.** Each seat has exactly one annotation slot on its pot-facing side shared by rows **1.5 (bet chip)** and **1.10 (check indicator)**. The slot's single owner is **1.5 (bet chip)**; 1.10 occupies the slot only when 1.5's data contract says "blank" (i.e., `streetBet === 0` for the current street). This resolves the shared-slot concern in the handoff gotchas. Only one of the two is ever visible on a given seat on a given street (mutually exclusive by data: a seat that has bet this street has `streetBet > 0`; a seat that has checked has `streetBet === 0` and `lastAction === 'check'`). Folded seats blank both.
3. **PFA and dealer-button geometric non-collision.** Row 1.4 (PFA pill) is positioned *above* each seat circle; row 1.7 (dealer button chip) is positioned on the seat circle's *opposite side* from the pot-facing annotation slot. This guarantees PFA + button can coexist on the same seat (hero-on-button-and-PFA is a common case) without overlap.
4. **`hand:new` behavior (R-2.4) — per row:**
   - **Reset at `hand:new`:** 1.4 (PFA clears), 1.5 (bet chips clear), 1.10 (check indicators clear), and the 1.9 Rule-V override highlight.
   - **Move at `hand:new`:** 1.7 (button rotates to next seat).
   - **Unchanged at `hand:new`:** 1.1 (hands-count ring is session-scoped; increments on showdown only), 1.3 (hero star is table-scoped), 1.9 pill set reshapes only by fold re-resolution (style + counts are session-scoped).
   Every Z1 element has an explicit declared behavior; there are no implicit "just don't touch it" slots.
5. **Single-owner per slot (R-5.1).** Every Z1 slot has exactly one FSM owner in the rendering module. Seat-circle color has one owner (pin/selection), ring has one owner (sample-size band), PFA slot has one owner (PFA predicate), button slot has one owner (buttonSeat predicate), annotation slot has one owner (priority 1.5 > 1.10 as declared above), and pill row has one owner (still-in-villains filter). Villain-pill click routes to Z3's Rule V dispatcher; the Z1 side does not write to Z3 DOM.
6. **Rule V cross-zone contract.** The only cross-zone interaction originating in Z1 is row 1.9's pill-click, which invokes Rule V item 6 on the Z3 range slot. Z1 never re-renders Z3 state directly; it fires a selection event that the Z3 range slot consumes. This is the contract boundary between the zones. The Z1 side obligations are exactly:
   - Emit the click with the selected seat index.
   - Reflect the resulting selected-seat back as a pill-row highlight (so Z1 stays glance-consistent with Z3).
   Nothing else.
7. **Zero-data policy (R-4.2).** Elements that depend on accumulated villain data (1.1 ring, 1.9 style field) render the R-4.2 unknown placeholder when data is absent:
   - 1.1 ring: absent (with `—` glyph overlay).
   - 1.9 style field: `—`.
   Pills/circles themselves still render; only their data-dependent sub-fields blank. This preserves spatial stability while truthfully marking unknown data.
8. **Hero exclusion.** Rows 1.4 (PFA), 1.7 (button), 1.9 pills, and 1.10 checks all apply to hero and villains symmetrically. The only Z1 element that distinguishes hero is 1.3 (star). There is no "skip hero" carve-out in any other row's logic.

---

## Escalations

**E-1 (R-11): Row 1.8 is misfiled in Z1.**

- **Finding.** Inventory row 1.8 describes "Stale-advice border tint (action bar + plan panel yellow-orange) + 'Stale Ns' badge". A direct reading of the RT-48 implementation (`side-panel.js:945–981` + `:1594–1615`) confirms the stale indicator renders exclusively on the **action bar (Z2)** and the **plan panel (Z4)**. There is no seat-level or seat-arc rendering associated with this row. No Z1 component exists.
- **Per R-11 process.** This is not an inventory-verdict re-opening (the row's verdict is `keep`), but the zone assignment is incorrect. Per the handoff instruction ("If 1.8 has no Z1 component, escalate to move the row out of Z1"), this spec escalates the row to be reassigned to **Z2** (primary, since the action bar is decision-critical) with a cross-reference pointer into **Z4** for the plan-panel tint.
- **Recommended action.** Move inventory row 1.8 to the Z2 table in `SIDEBAR_PANEL_INVENTORY.md` as a new row (e.g., 2.10). Z2-batch spec (next batch) covers it. No Z1 spec is authored for 1.8 here.
- **Not decided unilaterally.** This spec does not edit the sealed inventory. Owner-approval of this batch accepts the escalation; after approval, SR-4 Z2 batch (or a targeted inventory patch via R-11) performs the move.

**E-2 (new surface, not a re-opening): Rule V seat-arc ring.**

Rule V item 7 requires "a distinct range-selection ring around the selected seat (not to be confused with the existing pinned-villain ring)" on the seat arc. This ring is *not* row 1.1's hands-count ring — it is a second, independent visual channel on the same seat circle. This spec assumes that channel will be added in SR-6 implementation; no inventory row currently captures it. Flagging for owner awareness so that the new visual channel is either added as inventory row 1.11 (new) or explicitly folded into 1.1's spec as a third color band. Owner preference decides.

---

## Self-check (per README authoring order)

- [x] One section per kept Z1 row in inventory order (1.1, 1.3, 1.4, 1.5, 1.7, 1.9, 1.10; 1.8 escalated).
- [x] 8-field template used verbatim (§8 optional — present on 1.1 and 1.9).
- [x] §3 glance pathway complete (all 4 sub-fields) on every spec.
- [x] ≥1 doctrine rule cited in §2 on every spec.
- [x] ≥1 S-frame cited in §7 on every spec (with TODO extensions noted where corpus is thin).
- [x] Every spec declares §6 `hand:new` behavior (R-2.4).
- [x] No spec re-opens an inventory verdict; E-1 escalates a zone-assignment issue per R-11 rather than amending unilaterally.
- [x] Batch invariants section present.
- [x] Rule V cross-zone contract explicitly spelled out (batch invariant 6).

Awaiting owner review.
