# Z3 — Street card specs

**Batch 4 of 6 (SR-4).** Per-element specs for every Z3 row with a non-`delete` verdict, authored against doctrine v2 (`docs/SIDEBAR_DESIGN_PRINCIPLES.md`).

**Inventory source:** `docs/SIDEBAR_PANEL_INVENTORY.md` §Z3 (rows 3.1–3.12) + §Rule V.

**Omitted rows:**
- **3.10** "Waiting for next deal…" placeholder — deleted per inventory (duplicate of 3.9; poker-correct noun "hand" beats "deal"; R-5.1 single-owner).

**Spec count:** 11 elements (3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.11, 3.12, 3.9).

---

## 3.1 ACTION HISTORY header

### 1. Inventory row
`3.1 ACTION HISTORY header` — static section label for the action history area at the top of the Z3 street card.

### 2. Doctrine citations
R-1.1 (fixed zone position — top of Z3), R-1.3 (static element; always present, never collapses), R-1.5 (glance pathway), R-3.1 (ambient tier — purely structural, never preempts).

### 3. Glance pathway
- **Remembered location:** Z3, street card, top row. Full-width label band, fixed height ~18 px, uppercase micro text.
- **Default summary:** text "ACTION HISTORY" in muted uppercase with standard letter-spacing. No data; purely structural. Readable in under 1 second from spatial memory alone.
- **Drill-down affordance:** none (glance-only). The header is orientation scaffolding, not an interactive target.
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** static (no state dependency).
- **Compute:** none.
- **Invalid states:** none. The header renders unconditionally as long as the Z3 frame is mounted. It does not blank when action history is empty — 3.2 is responsible for its own empty/stale state.

### 5. Interruption tier
`ambient` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** Z3 frame mount (street card is active during active-hand state).
- **Update triggers:** none. Static text; no `renderKey` dependency.
- **Unmount condition:** never during an active hand. Between-hands: Zx override may replace the Z3 frame's entire content (see 3.9 and batch invariant §c).
- **`hand:new` behavior (R-2.4):** no change. Static label persists across hand boundaries.

### 7. Corpus coverage
- S2/01 (turn, action header visible above timeline), S3/01 (flop, header visible). The header appears in every corpus frame that shows the street card.

---

## 3.2 Action history chips

### 1. Inventory row
`3.2 Action history chips ("Pre 2", "FLOP S3B$9")` — per-street compact chips summarizing betting action up to the current moment. Past streets are collapsed to count chips; the current street shows individual action chips.

### 2. Doctrine citations
R-1.2 (glance-targetable — compact chips encode past action in <1 second), R-1.3 (row height is fixed; overflow clips or wraps within the declared row, never pushes neighbours), R-1.5, R-3.1 (informational), R-4.1 (each chip is backed by `actionSequence` entries), R-4.2 (empty action sequence renders the row's declared empty placeholder, not a blank gap), R-5.1 (single owner: `render-street-card.js:renderCompactTimeline`).

### 3. Glance pathway
- **Remembered location:** Z3, street card, second row (below 3.1 label). Fixed-height flex row (~24 px), horizontally scrolling if chips overflow.
- **Default summary:** a horizontal sequence of street chips. Completed streets: a muted gray pill with label + action count ("Pre 2", "Flop 3"). Current street: street label followed by individual action chips (e.g., "FLOP  S3B$9  S5C"). Hero actions have a gold border; villain actions are borderless. Dollar amounts in subdued opacity.
- **Drill-down affordance:** none (glance-only). The chips are read, not clicked; interaction is not in scope for this element (action sequence detail is the Z4 deep-analysis domain).
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `currentLiveContext.actionSequence[]` — each entry has `{ seat, action, amount, street }`.
- **Compute:** group by street (STREET_ORDER: preflop → flop → turn → river); past streets render count chip; current street renders per-action chips. Hero detection: `a.seat === liveContext.heroSeat`. Amount formatting: `$` prefix, integer if ≥ 1, 2 decimals if fractional.
- **Invalid states:**
  - **Empty `actionSequence`:** row renders an R-4.2 placeholder — a single muted chip labeled "—" — not a collapsed blank. The slot height is preserved (R-1.3).
  - **`liveContext == null`:** row renders "—" placeholder.
  - **Preflop-only, single chip:** the PRE chip with action count is valid and expected. It is not a degraded state; it is the correct preflop rendering.

### 5. Interruption tier
`informational` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** Z3 frame mount.
- **Update triggers:** `renderKey` fields for `currentLiveContext.actionSequence` (length + last entry) and `currentLiveContext.currentStreet` (street boundary changes which chip is "current").
- **Unmount condition:** never; placeholder holds the slot (R-1.3).
- **`hand:new` behavior (R-2.4):** **reset.** At `hand:new`, `actionSequence` is empty; row immediately shows the "—" placeholder. It populates with the first action of the new hand (typically preflop ANTE/BLIND entries).

### 7. Corpus coverage
- Current-street chips visible: S3/01 (flop action, individual chips), S5/01 (multiway flop).
- Collapsed past-street chip: visible in S3/01 as "Pre N" pill.
- Empty placeholder: **TODO corpus extension** — no current frame captures a live hand with an empty action sequence immediately after `hand:new`. SR-6 harness should add a synthetic early-DEALING fixture.

---

## 3.3 Action-rationale line

### 1. Inventory row
`3.3 Action-rationale line ("Value bet with top pair top kicker")` — a single plain-English sentence explaining why the recommended action was chosen. Occupies a dedicated row below the action history.

### 2. Doctrine citations
R-1.3 (rationale slot is fixed-height; when absent, the R-4.2 unknown placeholder holds the slot, not a collapse), R-1.5, R-3.1 (decision-critical — the user's eye reaches here when they want justification, not just the action word), R-4.1 (backed by `lastGoodAdvice.rationale`), R-4.2 (absent rationale renders "—" placeholder), R-7.1 (render gate: if `advice.street ≠ liveContext.street`, row renders stale-recomputing state per R-7.3), R-7.3 (stale-recomputing label required during street transitions — no blanking).

### 3. Glance pathway
- **Remembered location:** Z3, street card, third row (below 3.2 chips). Fixed-height single-line slot (~20 px), full width. Text is secondary-color weight to distinguish it from the primary Z2 action headline.
- **Default summary:** one plain-English sentence, truncated at ~80 characters with an ellipsis (…) if longer. The full text is always the same content — no abbreviation that changes meaning. "Value bet with top pair top kicker" is the nominal example.
- **Drill-down affordance:** none (glance-only). Deeper reasoning is in Z4 model audit / More Analysis.
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `lastGoodAdvice.rationale` (string, from `recommendations[0].reasoning` in the engine).
- **Compute:** truncate to 80 chars + ellipsis if longer; pure.
- **Invalid states:**
  - **`rationale == null`:** render R-4.2 unknown placeholder "—".
  - **Advice stale (street mismatch):** render stale-recomputing state per R-7.3 — the prior street's rationale with a "Stale" label in muted color, not blanked. The age badge lives on the Z2 action bar (2.10), not here; this row only appends a "(stale)" suffix to the text.
  - **`lastGoodAdvice == null`:** render "—" placeholder.

### 5. Interruption tier
`decision-critical` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** Z3 frame mount.
- **Update triggers:** `renderKey` fields for `lastGoodAdvice.rationale`, `lastGoodAdvice._receivedAt`, `liveContext.currentStreet`.
- **Unmount condition:** never; "—" placeholder holds the slot.
- **`hand:new` behavior (R-2.4):** **reset.** At `hand:new`, `lastGoodAdvice` clears; row shows "—" placeholder until new advice arrives.

### 7. Corpus coverage
- Non-null rationale: S3/01.
- Null placeholder: S1/01 (pre-advice frame, Analyzing state).
- Stale-recomputing state: S2/01 (advice-street mismatch), S7/02 (stale advice tint — same stale predicate applies to the rationale row).

---

## 3.4 Fold-% callout

### 1. Inventory row
`3.4 Fold-% callout ("S3 FOLD % 45% fold to bet")` — a prominent callout displaying the selected villain's estimated fold-to-bet percentage. Retained as a primary villain read, distinct from the edge callout in Z2.

### 2. Doctrine citations
R-1.3 (fixed slot height — absent/low-sample cases render R-4.2 placeholder, not collapse), R-1.5, R-3.1 (decision-critical — owner verdict "primary villain read"), R-4.1 (backed by `lastGoodAdvice.villainFoldPct` / `foldMeta`), R-4.2 (insufficient sample renders labeled placeholder), R-4.5 (confidence is a first-class field — low-confidence fold% renders with a confidence indicator), R-5.1 (single owner of the fold% callout slot), R-7.3 (stale-recomputing state on street mismatch, not blank).

### 3. Glance pathway
- **Remembered location:** Z3, street card, fourth row (below 3.3 rationale). Fixed-height callout block (~36 px). The fold percentage numeral is the primary glance target; label text ("fold to bet") is secondary weight.
- **Default summary:** large numeric percentage (e.g., "45%") with a label identifying the villain seat and action type ("S3 FOLD % · fold to bet"). On river, this element expands to show the multi-sizing fold table (see §4 data contract); the slot height adjusts for the table but the glance entry point (large % for recommended sizing) stays in the same position.
- **Drill-down affordance:** none for the basic callout. On river, the multi-sizing table is rendered inline (no extra tap required — it is the element's normal state at river, per the render module's `renderMultiSizingTable` logic). No chevron needed.
- **Expansion location:** in-place (for river table — the slot height grows to accommodate the table, but no neighbour shifts occur while the fold% slot is active; R-1.3 guarantees the fixed outer container height, see batch invariant §a for the range-slot; the fold% callout slot is its own independent fixed area above the range slot).

### 4. Data contract
- **Source:** `lastGoodAdvice.foldPct.bet` (primary) or `lastGoodAdvice.foldMeta.foldPct` (fallback). Villain seat label from `lastGoodAdvice.villainSeat`. For river multi-sizing: `lastGoodAdvice.foldMeta.curve[]` (array of `{ sizing, foldPct }`).
- **Compute:**
  - Single fold%: `Math.round(foldPct * 100)` → "N%".
  - River table: iterate `curve[]`, format each row as "N% pot → M% fold" with a color-coded bar (green ≥50%, yellow ≥30%, red <30%).
  - Sample-size guard: fold% is considered unreliable below **n=15 observed villain actions** (threshold derived from `bayesianConfidence.js` minimum-sample conventions). Below this threshold, the element renders the R-4.2 placeholder.
- **Invalid states:**
  - **`foldPct == null && foldMeta == null`:** "—" placeholder in the fixed slot.
  - **Insufficient sample (n < 15):** R-4.2 placeholder "Insufficient sample" with muted color. Do NOT render "0%" or any numeric default.
  - **Advice stale (street mismatch):** render prior value with "(stale)" suffix per R-7.3.
  - **Preflop with no fold% data:** "—" placeholder (fold% is inherently a postflop read in most situations; if preflop fold% is present it renders normally).

### 5. Interruption tier
`decision-critical` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** Z3 frame mount.
- **Update triggers:** `renderKey` fields for `lastGoodAdvice.foldPct`, `lastGoodAdvice.foldMeta`, `lastGoodAdvice.villainSeat`, `liveContext.currentStreet`.
- **Unmount condition:** never; "—" placeholder holds the slot.
- **`hand:new` behavior (R-2.4):** **reset.** Clears to "—" placeholder at every hand boundary.

### 7. Corpus coverage
- Non-null fold% with mini curve: S3/01 (flop, fold% visible with villain label).
- River multi-sizing table: S12/01 (river frame — **TODO verify** that S12 exercises the fold table path; corpus map shows S12 covers Z2 river, but fold table rendering is a Z3 path. SR-6 should confirm).
- Insufficient-sample placeholder: **TODO corpus extension** — no current frame captures a fresh-session villain with n < 15. SR-6 harness should add a synthetic low-sample fixture.

### 8. Rejected alternatives
- Showing fold% inside the Z2 action bar alongside edge was rejected — the inventory owner's verdict was explicit: fold% is a primary villain read with its own glance slot, not an edge input accessory. R-5.1 single-owner.
- Suppressing the row when fold% is absent was rejected — R-1.3 requires the placeholder.

---

## 3.5 Hand plan block

### 1. Inventory row
`3.5 Hand plan block ("If CALL → Bet turn again on non-scare cards")` — a forward-looking branch plan showing what hero should do on the next street given different villain responses. Temporally distinct from 3.2 action history (past) — these two elements coexist in the same street card frame without ambiguity.

### 2. Doctrine citations
R-1.3 (slot height fixed even when plan is absent — R-4.2 placeholder holds the slot), R-1.5, R-3.1 (decision-critical), R-4.1 (backed by `lastGoodAdvice.handPlan`), R-4.2 (absent plan renders "—" or a minimal single-line placeholder, not collapse), R-5.1 (sole owner of the plan-branch slot within Z3; note: Z4 plan panel `4.1` is a separate expandable detail view — the Z3 block is the glance-level summary, not the Z4 full tree), R-7.3 (stale-recomputing label on street mismatch).

### 3. Glance pathway
- **Remembered location:** Z3, street card, fifth row (below 3.4 fold%). One branch-note line per active branch (CALL, RAISE, V BETS), each prefixed with a colored action label. Fixed-height container; up to 3 branches visible; overflow clips within the slot.
- **Default summary:** one to three labeled branch lines. Example: "If CALL → Bet turn on non-scare cards" in green CALL color. Each branch is one concise instruction. The block is readable in under 1 second (spatial memory — user knows to look here for "what's next").
- **Drill-down affordance:** none (glance-only for the Z3 summary). The Z4 PLAN chevron (4.1) is the drill-down for the full tree with runout bars and scary-card lists. Z3 and Z4 are two separate elements in two separate zones; Z3 never expands into Z4 territory (R-1.4 zone-boundary enforcement).
- **Expansion location:** n/a for Z3; see Z4 spec.

### 4. Data contract
- **Source:** `lastGoodAdvice.recommendations[0].handPlan` — object with optional keys `ifCall`, `ifRaise`, `ifBet`, each containing a `note` string.
- **Compute:** extract at most 3 branch notes in priority order (CALL first, then RAISE, then V BETS); truncate each note at ~60 chars; pure. The plan note summary is temporally distinct from 3.2 (it describes *future* streets, not *past* ones); no overlap in data.
- **Invalid states:**
  - **`handPlan == null`:** slot renders "—" placeholder.
  - **`handPlan` present but all branches empty:** same "—" placeholder.
  - **Preflop without plan:** "—" placeholder (preflop plans require deep game tree; absence is valid).
  - **Stale advice:** branch text rendered with "(stale)" suffix per R-7.3, not blanked.

### 5. Interruption tier
`decision-critical` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** Z3 frame mount.
- **Update triggers:** `renderKey` fields for `lastGoodAdvice.recommendations[0].handPlan`, `_receivedAt`, `liveContext.currentStreet`.
- **Unmount condition:** never; placeholder holds the slot.
- **`hand:new` behavior (R-2.4):** **reset.** Hand plan clears at every hand boundary (`lastGoodAdvice` cleared). "—" placeholder returns immediately; repopulates when first advice of the new hand arrives.

### 7. Corpus coverage
- Non-null plan with branches: S3/01 (flop, plan visible), S5/01 (multiway flop with plan branches).
- Preflop plan (if available): S1/01 — **TODO verify** whether preflop advice in S1 includes a `handPlan` object.
- Null placeholder: S1/01 (pre-advice, Analyzing state).
- River plan (typically absent): S12/01 — expected "—" placeholder.

---

## 3.6 Range slot — grid

### 1. Inventory row
`3.6 Range slot — grid (hero preflop OR villain postflop)` — the 13×13 hand-matrix grid that fills the single fixed-height range slot. Content switches by street and seat-selection state (Rule V). This is the **frame owner** of the range slot container; rows 3.7, 3.8, 3.11, and 3.12 all render within this container's bounds (see batch invariant §a).

### 2. Doctrine citations
R-1.3 (fixed-height container — no reflow regardless of whether it shows hero grid, villain grid, or the 3.12 placeholder; this is the archetype of glance-stable slot referenced in the inventory's Group 3 audit), R-1.5, R-3.1 (decision-critical), R-4.1 (backed by `lastGoodAdvice.rangeMatrix` or `villainRanges[seat].range`), R-4.2 (invalid state renders 3.12 placeholder, not a blank gap), R-5.1 (sole owner of the range grid canvas within the range slot container — no other module writes to this DOM node), R-7.1 (render gate: grid refuses if advice street ≠ live context street, per R-7.3), R-8.2 (anti-scenario: grid MUST NOT render a stale-street hero range when the live context has advanced to postflop).

### 3. Glance pathway
- **Remembered location:** Z3, street card, range slot — a fixed-height block (~120 px), full width. Position is invariant regardless of which content is currently displayed.
- **Default summary:** a 13-column × 13-row color-coded matrix. Cells are colored by range membership (filled = in range, hollow = not in range) with the hero's hole cards highlighted. Grid is readable as a gestalt pattern — the user glances at the matrix density and their cards' position, not at individual cells.
- **Drill-down affordance:** none (glance-only). The grid is a read-only display; tapping a cell is out of scope. The 3.11 seat-selector pills are the interaction affordance for *which* villain's grid is shown; they sit in the grid's headline strip (3.7) and are specced separately.
- **Expansion location:** n/a.

### 4. Data contract — full decision tree for "what does 3.6 render right now?"

This is the single authoritative declaration for range-slot content selection. Every state the grid can be in is enumerated; no "implicit fallback" is permitted (R-5.3).

```
IF handState === 'COMPLETE'
  → 3.12 placeholder renders (no data to show). [3.9 owns the Z3 frame in this state — see batch invariant §c]

ELSE IF currentStreet === 'preflop' OR (currentStreet == null AND liveContext.board is empty)
  → Hero preflop range grid:
      source: renderRangeGrid({ position: heroPos, holeCards, situation })
      label (3.7): "Hero · {heroPosition}" + range-width metric from advice.situation
      selector (3.11): NOT rendered (preflop is always hero; Rule V does not apply preflop)

ELSE (postflop streets: flop, turn, river)
  → Apply Rule V seat-selection (see §Rule V cross-zone contract in batch invariant §b):
      CASE A — heads-up (exactly 1 villain still in):
          auto-select that villain
      CASE B — multiway, villain aggressor present:
          auto-select last BET/RAISE villain (ties: most-recent in sequence)
      CASE C — multiway, no villain aggressor, but PFA still in:
          auto-select PFA seat
      CASE D — multiway, no villain aggression anywhere, hero is sole aggressor (Q1-c):
          → 3.12 no-aggressor placeholder renders
      [User override of CASE A/B/C: use override seat; see batch invariant §b]

      FOR CASE A/B/C (or override):
          IF villainRanges[selectedSeat].range has 169 cells:
              render full 169-cell grid
              source: advice.villainRanges[].range
              label (3.7): "S{seat} · {position} · {actionKey}" + equity% + rangeWidth
              selector (3.11): rendered ONLY in CASE B/C with ≥2 active villains
          ELSE IF villainRanges[selectedSeat].equity != null:
              render equity-only fallback badge (no full grid)
              source: advice.villainRanges[].equity
              label (3.7): "S{seat}" + equity%
          ELSE:
              → 3.12 placeholder with "No range data for S{seat}"
```

- **Source:**
  - Preflop hero: `currentLiveContext.holeCards`, `currentLiveContext.heroSeat`, `currentLiveContext.dealerSeat`, `lastGoodAdvice.situation`.
  - Postflop villain: `lastGoodAdvice.villainRanges[]` (array of `{ seat, range[169], equity, rangeWidth, actionKey, position, active }`).
- **Compute:** pure functions `renderRangeGrid()` and `renderVillainRangeSection()` from `render-street-card.js`. No state mutation in the grid renderer.
- **Invalid states:**
  - **Advice street ≠ live context street:** grid renders in R-7.3 stale-recomputing state — prior grid with a "Recomputing" overlay label, not blanked.
  - **`lastGoodAdvice == null` (preflop, pre-advice):** hero preflop grid is rendered from `liveContext` alone (no advice required for the hero preflop grid) — this is a valid non-null grid state.
  - **`liveContext == null`:** 3.12 placeholder.

### 5. Interruption tier
`decision-critical` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** Z3 frame mount. The range slot container mounts once and is never destroyed during an active session; its inner content is swapped.
- **Update triggers:** `renderKey` fields for `liveContext.currentStreet`, `liveContext.holeCards`, `liveContext.heroSeat`, `liveContext.dealerSeat`, `lastGoodAdvice.villainRanges` (length + focused seat), `lastGoodAdvice.situation`, and the Rule V override seat index.
- **Unmount condition:** never. Placeholder 3.12 holds the slot in all invalid/empty states (R-1.3).
- **`hand:new` behavior (R-2.4):** **partial reset.** The container stays mounted. Inner content resets: villain range grids are cleared, Rule V override is cleared. The hero preflop grid repopulates immediately from `liveContext.holeCards` as soon as the new hand's context is pushed (it does not wait for advice). This produces a seamless visual transition where the slot never shows a blank — it goes directly from villain grid to hero preflop grid.

### 7. Corpus coverage
- Hero preflop grid: S1/01 (hero preflop, range matrix shown).
- Villain postflop grid (full 169 cells): **corpus gap** — inventory Known Gaps section flags this. No current corpus frame captures a postflop villain range grid. **TODO:** SR-6 harness must add a synthetic postflop fixture with `villainRanges[].range` populated. Tag: `corpusGap:3.6-villain-postflop`.
- Equity-only fallback (no 169-cell range): **corpus gap** — see above. SR-6 fixture needed.
- Stale-recomputing state: S2/01 (advice-street mismatch; range slot would show stale overlay).

### 8. Rejected alternatives
- Collapsing the range slot when no villain range is available was rejected — R-1.3 and the inventory Group 3 verdict both explicitly name this as the archetype of a glance-stable fixed slot. The slot must occupy its space even when its content is a placeholder.
- Rendering the hero preflop grid only after advice arrives was considered and rejected — the render module already shows the hero grid from `liveContext` alone, before advice, providing immediate visual feedback on hand strength positioning. This is correct behavior and the spec preserves it.

---

## 3.7 Range slot — headline row

### 1. Inventory row
`3.7 Range slot — headline row` — a one-line text row above the 3.6 grid, naming whose range is shown and providing a summary metric (range width, equity, or position). Always visible within the range slot container; always paired with 3.6.

### 2. Doctrine citations
R-1.3 (headline row occupies a fixed strip inside the range slot; no reflow when content changes), R-1.5, R-3.1 (decision-critical — answers "whose range am I looking at?" at a glance), R-4.2 (absent data renders "—" not blank), R-5.1 (single owner: derived from 3.6 source selection; headline is computed by the same renderKey that governs 3.6).

### 3. Glance pathway
- **Remembered location:** Z3, range slot, headline strip — a fixed-height row (~18 px) immediately above the 3.6 grid canvas. Full width. Monospace or semi-bold face for seat label; lighter weight for metrics.
- **Default summary:** for hero preflop: "Hero · {position}" with range-width or situation label (e.g., "Hero · BTN · Opening range"). For villain postflop: "S{N} · {position} · {actionKey}" followed by equity% and range-width% in muted text (e.g., "S3 · CO · Call  42%  18% of hands"). Seat label is the primary glance target; metrics are secondary.
- **Drill-down affordance:** none (glance-only). Seat identity and summary metrics are the complete information for this row; deeper breakdown is Z4 territory.
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** derived from the same selection logic as 3.6 (see §3.6 §4 decision tree). No independent state read.
- **Compute:**
  - Hero preflop: label = "Hero · {heroPosition}" where `heroPosition = getPositionName(heroSeat, dealerSeat)`; metric = advice situation label if present.
  - Villain postflop: label = "S{seat} · {position} · {actionKey}"; metrics = `${Math.round(equity*100)}%` and `${rangeWidth}% of hands`.
  - All label strings are escaped (XSS safe).
- **Invalid states:**
  - **3.12 placeholder active (Q1-c or no data):** headline reads "No aggressor" or "—" depending on which 3.12 sub-state is active.
  - **Equity-only fallback:** headline reads "S{seat} · {equity}%" without grid metrics.
  - **`lastGoodAdvice == null` (preflop, pre-advice):** headline reads "Hero · {position}" from `liveContext` only; no metric suffix.

### 5. Interruption tier
`decision-critical` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** with the range slot container (co-mounted with 3.6).
- **Update triggers:** same `renderKey` fields as 3.6 (they share a composite key).
- **Unmount condition:** never; placeholder text holds the strip.
- **`hand:new` behavior (R-2.4):** **reset in sync with 3.6.** Headline transitions from villain label to "Hero · {position}" as the new hand's preflop context arrives.

### 7. Corpus coverage
- Hero preflop headline ("Hero · BTN" etc.): S1/01.
- Villain postflop headline: **corpus gap** — shares the 3.6 villain postflop gap. SR-6 fixture needed. Tag: `corpusGap:3.7-villain-postflop`.

---

## 3.8 Range grid legend

### 1. Inventory row
`3.8 Range grid legend ("In range / Your hand")` — a static key below the 3.6 grid that decodes the cell colors used in the range matrix.

### 2. Doctrine citations
R-1.3 (legend occupies a fixed strip in the range slot container; height is invariant), R-1.5, R-3.1 (ambient — purely static reference, never preempts), R-5.1 (single owner: co-owned with the range slot container; always visible when the grid renders).

### 3. Glance pathway
- **Remembered location:** Z3, range slot, bottom strip — a fixed-height row (~14 px) immediately below the 3.6 grid canvas, always occupying its slot.
- **Default summary:** two swatch-label pairs: "■ In range" (filled color) and "● Your hand" (highlighted cell color). Micro text, muted, placed at the bottom of the range slot container. The user glances here at most once per session, then relies on spatial memory.
- **Drill-down affordance:** none (glance-only). Static legend.
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** static (colors are CSS palette tokens, not state-dependent).
- **Compute:** none. The legend does not change when the grid switches between hero and villain content — both grids use the same color semantics.
- **Invalid states:** none. The legend always renders when the range slot container is mounted. Even when 3.12 placeholder is active, the legend renders in a muted/grayed state rather than disappearing (R-1.3 no collapse).

### 5. Interruption tier
`ambient` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** with the range slot container.
- **Update triggers:** none. Static; no `renderKey` dependency.
- **Unmount condition:** never.
- **`hand:new` behavior (R-2.4):** no change. Static content persists across hand boundaries.

### 7. Corpus coverage
- Legend visible below hero preflop grid: S1/01.
- Legend visible below villain postflop grid: **corpus gap** — same 3.6 postflop gap. SR-6 fixture needed.

---

## 3.11 Range slot — multiway seat selector

### 1. Inventory row
`3.11 Range slot — multiway seat selector (NEW)` — a row of clickable pill chips for each still-in villain, rendered inside the range slot headline strip (sharing it with 3.7). Visible only in multiway postflop situations with ≥2 active villains. Implements the user-override half of Rule V (item 6).

### 2. Doctrine citations
R-1.3 (selector pills render in a fixed-height strip within the range slot container; the strip is always reserved even when only one pill is visible, to prevent reflow when multiway becomes HU), R-1.5, R-3.1 (informational — the selector does not preempt any decision-critical element), R-2.4 (override cleared on `hand:new`), R-5.1 (single owner of the seat-selector strip within the range slot), R-5.3 (selector and 3.7 headline co-occupy the same strip; priority rule declared — see §3 and batch invariant §a).

### 3. Glance pathway
- **Remembered location:** Z3, range slot, headline strip — the same strip as 3.7, right-aligned (3.7 label is left-aligned; pills are right-aligned, sharing the row). Each pill is a small chip (~28 × 16 px).
- **Default summary:** one pill per active villain (e.g., "S3", "S5", "S7"). The currently displayed villain's pill is highlighted (solid fill or bold border). Auto-selected villain (per Rule V default) is pre-highlighted on render; no user action needed. On the river this is still the same single-line strip — no multiline expansion.
- **Drill-down affordance:** **pill/chip click** (per vocabulary). Tapping a pill overrides Rule V and switches the displayed range to that seat. The selected pill becomes highlighted; the grid and headline update in place (no reflow). The override persists until a new BET/RAISE occurs or `hand:new` fires (R-2.4).
- **Expansion location:** n/a. The grid update is an in-place content swap within 3.6, not a new element.

### 4. Data contract
- **Source:** `currentLiveContext.activeSeatNumbers` filtered against `foldedSeats` and excluding `heroSeat` — the remaining seats are "still in". Pills are rendered only for seats with a corresponding entry in `advice.villainRanges[].active === true`.
- **Compute:** sort by seat index ascending; mark focused seat (from Rule V selection or user override) as active. Pill label: "S{seat}" with optional equity% suffix if `villainRanges[seat].equity != null`.
- **Invalid states:**
  - **HU (exactly 1 villain still in):** pills NOT rendered. The headline strip shows only the 3.7 label. There is no single-villain pill — that would add noise without benefit. The strip height is reserved regardless (R-1.3).
  - **Preflop:** pills NOT rendered (Rule V does not apply preflop; hero grid always shown).
  - **No villain range data for a seat:** that seat's pill is still rendered (to allow the user to select it), but the grid shows the equity-only fallback or 3.12 placeholder for that seat.
  - **`advice.villainRanges` empty:** pills NOT rendered; 3.12 placeholder takes the grid area.

### 5. Interruption tier
`informational` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** multiway postflop context — `activeSeatNumbers.length - 1 (minus hero) >= 2` AND `currentStreet != 'preflop'`.
- **Update triggers:** `renderKey` fields for `liveContext.activeSeatNumbers`, `liveContext.foldedSeats`, `advice.villainRanges` (active seats), Rule V selection index, and user override seat index.
- **Unmount condition:** transitions to HU or to preflop; strip reverts to 3.7-only mode (pills hidden; slot height preserved). "Unmount" here means "pills hidden, strip stays mounted".
- **`hand:new` behavior (R-2.4):** **reset.** User override cleared. Auto-selection will re-run from Rule V defaults when the new hand's postflop context arrives.

### 7. Corpus coverage
- Multiway seat selector visible: **corpus gap** — inventory Known Gaps flags this as "not fired in corpus" (postflop multiway range scenario not captured). SR-6 harness must add a synthetic multiway-postflop fixture with ≥2 active villains and `villainRanges` populated. Tag: `corpusGap:3.11-multiway-selector`.
- HU mode (pills absent): S3/01 (HU flop, selector strip should not render — can verify pill absence from existing frame).

---

## 3.12 Range slot — empty/no-aggressor placeholder

### 1. Inventory row
`3.12 Range slot — empty/no-aggressor placeholder (NEW)` — reserves the range slot's fixed height with a centered message when no valid range is available to show. Two sub-states: (a) Q1-c no-aggressor (limped/checked-around pot) and (b) general data-absent state. Ensures R-1.3 compliance when the grid cannot render.

### 2. Doctrine citations
R-1.3 (this element's sole purpose is to hold the fixed-height slot when its siblings 3.6/3.7/3.8 have nothing valid to display — it is the R-1.3 guarantee for the range slot), R-1.5, R-3.1 (informational — a placeholder does not preempt anything), R-4.2 (the placeholder IS the declared unknown-value rendering for the range slot), R-5.1 (single owner within the range slot frame under the conditions that trigger it; 3.6 yields to 3.12 per the priority rule — see batch invariant §a).

### 3. Glance pathway
- **Remembered location:** Z3, range slot — the same fixed-height block as 3.6. Content is centered text at mid-height.
- **Default summary:** two sub-states:
  - **Q1-c (no villain aggression, hero is sole aggressor):** "No aggression yet — click a seat to inspect" in muted color, centered. The seat-selector pills (3.11) remain visible in the headline strip (user can still manually select a villain even in the Q1-c state).
  - **Data-absent (no `villainRanges` at all, or `liveContext == null`):** "—" centered in muted color.
- **Drill-down affordance:** none. In the Q1-c sub-state, the 3.11 seat-selector pills (when present) serve as the navigation affordance — that is 3.11's affordance, not this element's.
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** absence of valid range data. Triggered when the 3.6 decision tree produces no renderable content (see §3.6 §4 decision tree terminal states).
- **Compute:** distinguish sub-state: Q1-c vs data-absent, using `liveContext.activeSeatNumbers`, `advice.villainRanges`, and the Rule V selection result.
- **Invalid states:**
  - **Should not render when any valid villain range is available:** if 3.6 can render a grid, 3.12 must not be shown (R-5.3 — they are mutually exclusive occupants of the same slot).
  - **Preflop:** 3.12 does not render during preflop; hero grid always fills the slot.

### 5. Interruption tier
`informational` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** when the 3.6 decision tree's result is a terminal no-data state.
- **Update triggers:** `renderKey` fields for `advice.villainRanges`, `liveContext.activeSeatNumbers`, `liveContext.foldedSeats`, `liveContext.currentStreet`, Rule V selection result.
- **Unmount condition:** when a valid villain range becomes available (first BET/RAISE event in Q1-c state, or on a new villain range push). 3.6 takes over; 3.12 hides in place (slot height unchanged).
- **`hand:new` behavior (R-2.4):** transitions to hero preflop grid mode (3.12 hides; hero preflop grid shows from liveContext). If the new hand's preflop context is not yet available, 3.12 data-absent sub-state shows briefly.

### 7. Corpus coverage
- Q1-c no-aggressor placeholder: **corpus gap** — inventory Known Gaps flags this. SR-6 harness must add a synthetic checked-around fixture (e.g., limped pot postflop with no BET/RAISE in sequence). Tag: `corpusGap:3.12-no-aggressor`.
- Data-absent placeholder: **TODO corpus extension** — a synthetic fresh-session postflop fixture (before villain range data arrives) would exercise this state.

---

## 3.9 "Waiting for next hand…" placeholder

### 1. Inventory row
`3.9 "Waiting for next hand..." placeholder` — a centered text placeholder that occupies the Z3 frame when `handState === 'COMPLETE'` and the session is waiting for the next hand to begin. This is the **Z3-local between-hands holding state**, not a Zx full-zone override (see batch invariant §c for the boundary declaration).

### 2. Doctrine citations
R-1.3 (placeholder holds the Z3 frame slot during between-hands to prevent neighbour reflow in surrounding zones), R-2.1 (lifecycle declared — `COMPLETE` → placeholder state; first `push_live_context` with new `handNumber` → reset), R-2.4 (placeholder is the declared `hand:new` post-completion state), R-3.4 (between-hands content is `informational` and must NOT preempt `decision-critical` content — this is why 3.9 is classified Z3-local: it only occupies the Z3 slot, never takes over Z2 or other decision-critical zones), R-5.1 (this element is the sole occupant of the Z3 frame in the `COMPLETE` state — it yields to 3.1/3.2/3.3/… rows when the new hand begins).

### 3. Glance pathway
- **Remembered location:** Z3, street card frame — the full Z3 content area. Text is centered at mid-height.
- **Default summary:** "Waiting for next hand…" in muted color, centered. No spinner, no animation beyond the optional shimmer class (see §6). Intentionally low-salience so the user's attention stays on the table.
- **Drill-down affordance:** none (glance-only). The placeholder is pure ambient content during the between-hands interval.
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `currentLiveContext.state === 'COMPLETE'` OR (`currentLiveContext == null` AND no pending hand context).
- **Compute:** none. The trigger is a boolean predicate over `handState`; the content is static text.
- **Invalid states:**
  - **Active hand in progress (`isLive === true`):** 3.9 MUST NOT render. This is the primary anti-scenario: a live hand is never interrupted by the waiting placeholder. If 3.9 renders during `isLive`, it is a regression (forensics S3/S4 pattern).
  - **DEALING/PREFLOP state but no advice yet:** the render module holds current content + loading shimmer rather than showing 3.9 (see `render-street-card.js:56-72` — `pendingNewHand` guard). This is correct; 3.9 is not the "analyzing" state — it is the "truly between hands" state.

### 5. Interruption tier
`informational` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** `currentLiveContext.state === 'COMPLETE'` (or null context post-completion).
- **Update triggers:** none while active. The placeholder is static text; no `renderKey` churn.
- **Unmount condition:** new `push_live_context` with `state !== 'COMPLETE'` (DEALING or PREFLOP) and non-null `handNumber` — the Z3 frame transitions to the active-hand rendering stack (3.1–3.8 rows take over). The transition is immediate (no fade); the loading shimmer covers the visual gap while advice is pending.
- **`hand:new` behavior (R-2.4):** this element IS the between-`hand:new` state. On `hand:new`, the placeholder dismisses itself and the active-hand content renders. The placeholder is the "exits on `hand:new`" example.

### 7. Corpus coverage
- Between-hands placeholder: S4/02 (between-hands frame, "Waiting for next hand…" text visible in the street card area, per corpus coverage map noting S4 exercises 3.9).

### 8. Rejected alternatives
- Using 3.10 "Waiting for next deal…" wording was rejected — "deal" is not poker-standard terminology; "hand" matches player expectation and the codebase's existing string (`render-street-card.js:956`). This was the inventory verdict; not re-opened here.
- Showing a full Zx between-hands override (villain scouting, tournament snapshot) inside Z3 was considered — the corpus (S4/02) shows 3.9 *within* the street card frame, not as a full-panel takeover, confirming Z3-local placement. The richer between-hands content lives in the Zx override zone, not here. See batch invariant §c.

---

## Batch invariants (Z3-wide)

These rules apply across all Z3 elements and bind the zone's layout contract. Stage 6 PR reviews check each of these as a gate.

### (a) Z3 range slot — single fixed-height container with priority rule

Rows 3.6, 3.7, 3.8, 3.11, and 3.12 all render inside **one fixed-height outer container** ("the range slot"). This container's height is declared in CSS constants and **never changes at runtime** (R-1.3 invariance guarantee). The five rows are not independent siblings that reflow around each other — they are sub-regions of the container:

```
┌─────────────────────────────────────────┐  fixed height ~152 px
│  HEADLINE STRIP  (~18 px)               │
│  [3.7 label · left]  [3.11 pills · right]│
│  (3.11 pills hidden when HU or preflop) │
├─────────────────────────────────────────┤
│  GRID CANVAS  (~120 px)                 │
│  → 3.6 grid  (active when data valid)   │
│  → 3.12 placeholder (when no data)      │
│  (3.6 and 3.12 are mutually exclusive)  │
├─────────────────────────────────────────┤
│  LEGEND STRIP  (~14 px)                 │
│  [3.8 legend]                           │
│  (muted/grayed when 3.12 is active)     │
└─────────────────────────────────────────┘
```

**Priority rule within the container:**
1. If the 3.6 decision tree yields a renderable grid → 3.6 renders; 3.12 hides.
2. If the 3.6 decision tree yields a terminal no-data state → 3.12 renders; 3.6 hides.
3. 3.7 headline and 3.11 pills always render in the headline strip (with appropriate content per their own specs); they are layout-stable regardless of whether 3.6 or 3.12 occupies the canvas.
4. 3.8 legend always renders in the legend strip, grayed out when 3.12 is active.

**3.6 is the frame owner** — it holds the outer container's DOM reference. 3.7, 3.8, 3.11, and 3.12 are co-occupants of sub-regions within the container and do not hold the outer reference (R-5.2 cross-owner write prohibition).

**R-1.3 invariance guarantee:** no transition between hero preflop ↔ villain postflop ↔ multiway ↔ no-aggressor states causes the container height to change. The height is constant; the grid canvas content is an in-place swap.

### (b) Rule V cross-zone contract — Z3 half

The Z1 batch invariant 6 (`z1-table-read.md`) declared the Z1 side: emit pill-click with seat index, reflect selected seat as a pill highlight. This section declares the **Z3 side** of the same contract.

**Default seat selection priority (Rule V, Z3 enforcement):**
1. **HU (1 villain still in):** auto-select that villain. No override possible (only one option).
2. **Multiway — villain aggressor:** auto-select the villain whose most recent action was BET or RAISE (excluding CALL, CHECK, FOLD), per the action sequence. Ties: most recent in sequence wins.
3. **Multiway — no villain aggressor, PFA still in (Q1-a):** auto-select the PFA seat.
4. **Multiway — no villain aggression anywhere and hero is sole aggressor (Q1-c):** 3.12 no-aggressor placeholder. No seat auto-selected.

**User override (Rule V item 6):** any pill-click from 3.11 (within Z3) or from a still-in seat tap in Z1 (1.9 pill or 1.1 seat arc tap-target) routes a `rangeSlotSeatOverride` event to the Z3 range slot. The Z3 range slot consumes this event and:
- Switches the displayed range to the override seat.
- Updates the 3.11 pill highlight and 3.7 headline to reflect the override seat.
- Does **not** modify Rule V's auto-selection state — the override is a view-layer preference, not a model update.

**Override persistence and expiry:**
- Override persists until: (a) a new BET or RAISE action occurs in the action sequence (Rule V item 2 re-applies automatically, overriding the override), OR (b) `hand:new` fires.
- `hand:new` unconditionally clears the override (R-2.4). The new hand starts with Rule V defaults.

**Hero-exclusion:** Rule V applies over villain actions only. Hero is excluded from "last aggressor" computation (Q2-a). If hero is the sole aggressor in the pot, Rule V falls through to Q1-c (no-aggressor placeholder, 3.12).

**E-2 carry-forward (from Z1):** the seat arc range-selection ring (visual feedback on the Z1 arc for which villain's range is currently displayed in Z3) requires either a new inventory row 1.11 or an amendment to row 1.1. This is unresolved at Z3 batch time. Z3 does not depend on the ring to function — 3.7 headline and 3.11 pill highlight are the primary "whose range is shown" indicators within Z3. If E-2 is resolved to add the ring, that is a Z1 spec amendment, not a Z3 spec amendment.

### (c) 3.9 vs Zx boundary declaration

**Verdict: 3.9 is a Z3-local placeholder, not a Zx full-zone override.**

Evidence and reasoning:
- The corpus (S4/02) shows "Waiting for next hand…" text rendered inside the street card frame (a Z3-scoped element), not as a full-sidebar takeover.
- `render-street-card.js:914–959` (`renderBetweenHandsContent`) is called only when the street card's own frame is between-hands (`!isLive && !advice`), and its output is set as the street card's `innerHTML` — it does not write to any Z2 or Z1 DOM node. This is Z3-local.
- The richer between-hands content (villain scouting, tournament snapshot) is rendered by `renderBetweenHandsContent`, which includes a "Waiting for next hand…" fallback at line 956 when no scouting rows exist.
- **Z3 scope:** 3.9 occupies the Z3 street card frame's full content area. It does not take over Z2, Z1, or Z0.
- **Zx scope:** the Zx override zone takes over the *entire sidebar or sidebar sub-regions* (e.g., X.1 launch CTA, X.6 observer scouting panel). Zx renders its own DOM regions that are separate from the Z3 frame.

**Coexistence:** when the hand is complete, both may be relevant simultaneously:
- Z3 frame shows 3.9 placeholder (or `renderBetweenHandsContent` with scouting rows if data exists).
- Zx override may show X.1 CTA (if app not connected) or X.6 observer panel (if hero folded) — but these render in their own DOM slots, not inside the Z3 frame.

**E-3 carry-forward from Z2:** S4/02-a/b (pot chip + street progress still visible between hands) is an SR-6 follow-up item. If the root cause analysis reveals that the between-hands Zx override *should* fully blank Z3 (not just show 3.9), that would be a boundary re-assessment. For now, the Z3-local verdict matches corpus and render-module behavior, and any change requires R-11 escalation, not a silent spec amendment.

### (d) 3.10 rejected-alternatives note

Row 3.10 ("Waiting for next deal…") was deleted per inventory verdict. The rationale: "deal" is not standard poker terminology at this stage of the hand; "hand" matches player mental models and the existing codebase string. Having two between-hands placeholders with different strings in different screen positions was the S4/S5 churn pattern (multiple owners of the same conceptual slot). The deletion consolidates ownership to 3.9 per R-5.1. No spec is authored for 3.10.

### (e) `hand:new` summary (R-2.4) — per row

| Row | `hand:new` behavior |
|-----|---------------------|
| 3.1 | No change (static label) |
| 3.2 | Reset — chips clear; "—" placeholder returns until first action of new hand |
| 3.3 | Reset — "—" placeholder returns until new advice arrives |
| 3.4 | Reset — "—" placeholder returns until new advice arrives |
| 3.5 | Reset — "—" placeholder returns until new advice arrives |
| 3.6 | Partial reset — Rule V override cleared; villain grid cleared; hero preflop grid immediately populates from `liveContext.holeCards` |
| 3.7 | Reset in sync with 3.6 — transitions to "Hero · {position}" |
| 3.8 | No change (static legend) |
| 3.11 | Reset — override cleared; pills reshown when postflop multiway context arrives |
| 3.12 | Hides on new hand (hero preflop grid takes over immediately) |
| 3.9 | Dismisses on `hand:new` — this is the element's designed exit transition |

Every Z3 element has an explicit declared behavior; there are no implicit slots.

### (f) Single-owner declaration per sub-slot

| Slot | Owner | Co-occupant | Priority rule |
|------|-------|-------------|---------------|
| Range slot outer container | **3.6** | — | 3.6 holds the DOM reference |
| Range slot headline strip | **3.7** (label) | **3.11** (pills, right-aligned) | 3.7 is always present; 3.11 renders conditionally (multiway postflop only); both co-occupy the strip with no priority conflict |
| Range slot grid canvas | **3.6** (active) | **3.12** (placeholder) | Mutually exclusive; 3.6 wins when data valid, 3.12 wins otherwise (R-5.3) |
| Range slot legend strip | **3.8** | — | Always present; grayed when 3.12 active |
| Z3 frame (full content area) | **3.1–3.12 row stack** (active hand) | **3.9** (between-hands) | Row stack active when `isLive || (advice != null)`; 3.9 active when `handState === 'COMPLETE'`; mutually exclusive by predicate |

---

## Escalations

**E-2 from Z1 — re-flagged per handoff instruction.** The Rule V seat-arc selection ring (a visual ring on the Z1 arc indicating which villain's range is displayed in Z3) requires owner decision: new inventory row 1.11 or fold into row 1.1 spec. This Z3 batch is not blocked by that decision — 3.7 and 3.11 provide the "whose range" signal within Z3. The Z1-arc ring is a Z1 concern; Z3 spec does not depend on its resolution.

**E-3 from Z2 — acknowledged, not a Z3 concern.** S4/02-a/b (pot chip + street progress visible between hands) is an SR-6 root-cause item. Z3 batch invariant §c records the 3.9 Z3-local placement verdict; if SR-6 determines a different boundary is correct, R-11 escalation would re-open the boundary, not a silent spec amendment.

**Corpus gaps (no escalation required — implementation TODOs for SR-6):**

| Tag | Missing frame | Affected rows |
|-----|---------------|---------------|
| `corpusGap:3.6-villain-postflop` | Postflop villain range grid (full 169-cell) | 3.6, 3.7, 3.8 |
| `corpusGap:3.11-multiway-selector` | Multiway postflop, ≥2 villains, villainRanges populated | 3.11 |
| `corpusGap:3.12-no-aggressor` | Limped/checked-around pot postflop (Q1-c) | 3.12 |

These are SR-6 harness additions, not inventory or spec amendments. They do not block owner approval of this batch.

---

## Self-check (per README authoring order)

- [x] One section per kept Z3 row in spec order (3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.11, 3.12, 3.9); 3.10 omitted with one-line note at top.
- [x] 8-field template used verbatim on every section (§8 optional — present on 3.6, 3.7, 3.9).
- [x] §3 glance pathway complete (all 4 sub-fields) on every spec.
- [x] ≥1 doctrine rule cited in §2 on every spec.
- [x] ≥1 S-frame cited in §7 on every spec (with corpus gap tags where inventory-documented gaps exist).
- [x] Every spec declares §6 `hand:new` behavior (R-2.4); batch invariant §e summarizes the full Z3 table.
- [x] Single-slot carve-out (3.6/3.7/3.8/3.11/3.12) priority rule declared (batch invariant §a).
- [x] Rule V Z3-half contract declared (batch invariant §b).
- [x] 3.9 vs Zx boundary declared — Z3-local verdict with evidence and E-3 carry-forward (batch invariant §c).
- [x] 3.10 rejected-alternatives note (batch invariant §d).
- [x] No spec re-opens an inventory verdict; E-2 and E-3 escalations re-flagged per handoff, not amended.
- [x] 3.4 fold% sample-size guard declared (n=15, derived from bayesianConfidence.js conventions).
- [x] 3.6 full decision tree declared (single authoritative location for "what does the range slot render?").
- [x] 3.2 vs 3.5 temporal-disjointness declared (past vs future; can coexist).
- [x] Batch invariants section present.

Awaiting owner review.
