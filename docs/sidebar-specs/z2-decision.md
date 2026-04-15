# Z2 — Decision specs

**Batch 3 of 6 (SR-4).** Per-element specs for every Z2 row with a non-`delete` verdict, authored against doctrine v2 (`docs/SIDEBAR_DESIGN_PRINCIPLES.md`).

**Inventory source:** `docs/SIDEBAR_PANEL_INVENTORY.md` §Z2 (rows 2.1–2.9) + absorbed row **2.10** (formerly 1.8 — stale-advice indicator, reassigned per E-1 escalation from the Z1 batch; this batch executes the approved inventory move).

**Inventory patch executed in this batch (E-1 from Z1):** row 1.8 is moved from the §Z1 table to the §Z2 table as row 2.10. This is an approved R-11 escalation, not a verdict re-opening; the row's verdict (`keep`) is unchanged.

**Omitted rows:** none. All nine original Z2 rows (2.1–2.9) have verdict `keep` or `keep`-with-carve-out. Row 2.10 is added (absorbed from Z1).

**Spec count:** 10 elements.

---

## 2.1 Action headline

### 1. Inventory row
`2.1 Action headline ("BET" / "CALL" / "FOLD" large colored text)` — the recommended hero action for the current decision point, rendered as large colored type inside the action bar (Z2 top strip).

### 2. Doctrine citations
R-1.1 (fixed zone position — top of Z2), R-1.2 (primary metric — one of the ≤5 targeted-glance anchors), R-1.3 (slot reserved even when advice absent; 2.9 occupies the same slot as a placeholder), R-1.5, R-3.1 (decision-critical), R-5.1 (sole owner of the action-headline slot).

### 3. Glance pathway
- **Remembered location:** Z2, action bar, top strip. Fixed-height band (~44 px). Headline renders left-justified, large weight, colored glyph (e.g., 28 px bold).
- **Default summary:** one of `BET` / `CALL` / `FOLD` / `RAISE` / `CHECK` rendered in the action's palette color (palette source: `shared/design-tokens.js` action tokens). Paired with 2.2 edge callout on the same row.
- **Drill-down affordance:** none (glance-only). The action word itself is not clickable; 2.2's edge callout, 3.3 rationale, and 4.1/4.2 panels are the drill-down paths for "why".
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `lastGoodAdvice.action` (coordinator-owned string).
- **Compute:** direct string lookup against the palette map; pure.
- **Invalid states:**
  - **No advice (`lastGoodAdvice == null`):** headline blanks; slot owned by 2.9 "Analyzing…" placeholder.
  - **Advice stale beyond the render gate** (10s threshold is the badge threshold, not the suppression gate — stale advice *still renders*; 2.10 tint + badge disambiguate freshness): headline renders normally with 2.10 overlay.
  - **Between hands:** headline blanks per Zx override; handled by Zx spec, not by this element's local guard.

### 5. Interruption tier
`decision-critical` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** first `push_action_advice` that resolves to a non-null `action`.
- **Update triggers:** `renderKey` fields for `lastGoodAdvice.action`, `lastGoodAdvice.sizing` (sizing change can flip BET→RAISE semantics), and advice `_receivedAt` (new advice replaces headline).
- **Unmount condition:** `hand:new` clears `lastGoodAdvice` → headline blanks; slot reserved, 2.9 takes over.
- **`hand:new` behavior (R-2.4):** **reset.** Headline clears at every hand boundary. This is the most hand-scoped element in Z2.

### 7. Corpus coverage
- Non-null headlines: S2/01 (BET), S3/01 (BET/CALL), S5/01 (multiway action).
- Null (Analyzing…): S1/01.
- Between-hands: S4/02 (handled by Zx override, not by this element).

---

## 2.2 Edge callout

### 1. Inventory row
`2.2 Edge callout ("+3.1 edge")` — EV delta of the recommended action vs the next-best action, in BB.

### 2. Doctrine citations
R-1.1, R-1.2 (primary metric — one of the ≤5 targeted-glance anchors), R-1.3, R-1.5, R-3.1 (decision-critical), R-4.2 (unknown placeholder when game tree did not converge), R-5.1.

### 3. Glance pathway
- **Remembered location:** Z2, action bar, immediately right of 2.1 headline. Fixed-width span (~64 px); sign glyph + numeral + `edge` label in smaller weight.
- **Default summary:** `+3.1 edge` or `-0.4 edge`, colored by sign (green positive, red negative). Paired visually with 2.1.
- **Drill-down affordance:** none (glance-only). 4.1 PLAN chevron is the expansion for "why this edge".
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `lastGoodAdvice.edgeBB` (numeric, BB).
- **Compute:** format to one decimal with explicit sign; pure.
- **Invalid states:**
  - **`edgeBB == null`** (low-sample, game tree bailed, or legacy advice): render R-4.2 placeholder `— edge` (em-dash, muted color). Do not render `+0.0` — zero edge reads as a decisive tie; unknown edge is a different state.
  - **`edgeBB == 0` exactly:** this is a valid computed state (action is a wash); render `0.0 edge` in neutral color. Distinct from unknown.
  - **No advice:** callout blanks with 2.1.

### 5. Interruption tier
`decision-critical`.

### 6. Render lifecycle
- **Mount condition:** with 2.1 on first advice arrival.
- **Update triggers:** `renderKey` field for `lastGoodAdvice.edgeBB` and `_receivedAt`.
- **Unmount condition:** with 2.1 at `hand:new`.
- **`hand:new` behavior (R-2.4):** **reset.**

### 7. Corpus coverage
- Non-null edge: S2/01, S3/01.
- Null edge (R-4.2 placeholder): **TODO corpus extension** — no current frame captures a null-edge advice cleanly. SR-6 harness should synthesize a low-sample fixture.

---

## 2.3 Equity % inline (headline)

### 1. Inventory row
`2.3 Equity % ("72% equity") inline` — hero equity vs the relevant villain range, rendered inline on the action-bar headline strip. **Sole owner of the equity channel** after the 2026-04-12 verdict (2.4 relinquishes equity in favor of SPR-only).

### 2. Doctrine citations
R-1.1, R-1.2 (primary metric), R-1.3, R-1.5, R-3.1 (decision-critical), R-4.2, R-5.1 (explicit sole-owner declaration — 2.4 no longer renders equity).

### 3. Glance pathway
- **Remembered location:** Z2, action bar, right-most span on the headline row (after 2.1 and 2.2). Fixed-width slot (~60 px).
- **Default summary:** `72% equity` in neutral text weight, muted color. Numeric with `%` suffix; the word `equity` is the label.
- **Drill-down affordance:** none (glance-only). 4.1 PLAN chevron surfaces per-flop-archetype breakdown when relevant.
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `lastGoodAdvice.equity` (number in 0–100 range, already percentage-scaled by the engine).
- **Compute:** round to integer, append `%`, append ` equity` label; pure.
- **Invalid states:**
  - **Preflop with no solver run** (`equity == null` preflop): R-4.2 placeholder `—% equity`. Muted. Do not render `0% equity`.
  - **Equity threaded as a fraction (0–1) instead of percent (0–100):** guard in compute: if `equity <= 1`, assume fraction and scale ×100. This defends against the mixed-unit bug class.
  - **No advice:** blanks with 2.1.

### 5. Interruption tier
`decision-critical`.

### 6. Render lifecycle
- **Mount condition:** with 2.1 on advice arrival.
- **Update triggers:** `renderKey` field for `lastGoodAdvice.equity` and `_receivedAt`.
- **Unmount condition:** with 2.1 at `hand:new`.
- **`hand:new` behavior (R-2.4):** **reset.**

### 7. Corpus coverage
- Non-null equity: S3/01 (72%), S5/01 (multiway).
- Preflop null equity: S1/01 (pre-solver) — would render `—% equity` under this spec.
- **TODO corpus extension:** a preflop frame with solver-computed equity (rare but valid for preflop 3-bet+call spots) is not in the corpus.

### 8. Rejected alternatives
Keeping equity in the 2.4 row ("Equity: 72% SPR: 3.8" combined line) was rejected at the 2026-04-12 inventory review — the headline inline position earns its pixels by being adjacent to the action word. A combined SPR+equity row split the user's glance across two locations for two primary metrics (R-1.2 violation).

---

## 2.4 SPR row

### 1. Inventory row
`2.4 Equity/SPR row ("Equity: 72% SPR: 3.8")` — **kept as SPR-only row** per 2026-04-12 verdict. Equity field deleted from this row (moved to 2.3).

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3, R-1.5, R-3.1 (decision-critical — SPR is a primary structural metric per POKER_THEORY SPR zones), R-5.1 (sole owner of the SPR channel).

### 3. Glance pathway
- **Remembered location:** Z2, second row of the action bar (below 2.1/2.2/2.3 headline row). Fixed-height single-line strip.
- **Default summary:** `SPR: 3.8` in neutral weight. Optionally suffixed with the SPR zone label from POKER_THEORY (MICRO/LOW/MEDIUM/HIGH/DEEP) when the zone is decision-relevant — but the zone label is a secondary annotation, not a separate element.
- **Drill-down affordance:** none (glance-only).
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `lastGoodAdvice.spr` (number) or derived from `currentLiveContext.pot` / `currentLiveContext.heroStack` if advice doesn't carry SPR.
- **Compute:** format to one decimal; pure. Zone label lookup is a pure mapping from `spr` bands.
- **Invalid states:**
  - **Preflop before flop reveal:** SPR is not yet meaningful (effective stack vs pre-flop pot is a different metric — stack-to-pot ratio preflop is a distinct concept). Render R-4.2 placeholder `SPR: —` preflop, or hide the row entirely — spec decision: **render the label with placeholder**, because the row slot is fixed-height (R-1.3) and hiding-then-reappearing on flop would reflow.
  - **Hero all-in (SPR effectively 0):** render `SPR: 0` in neutral (not placeholder); this is a decisive state, not unknown.
  - **No advice and no live context:** row blanks; slot reserved.

### 5. Interruption tier
`decision-critical`.

### 6. Render lifecycle
- **Mount condition:** Z2 mount.
- **Update triggers:** `renderKey` field for `lastGoodAdvice.spr` or derived pot/stack.
- **Unmount condition:** never; slot is always present while Z2 is rendered. Between-hands, the row blanks (content only).
- **`hand:new` behavior (R-2.4):** **reset content, keep slot.** SPR blanks at `hand:new` and repopulates once the new hand's pot and stack are known (typically immediately — SPR is preflop-derivable).

### 7. Corpus coverage
- SPR visible: S2/01 (`SPR: 3.8`), S3/01.
- Preflop placeholder: **TODO corpus extension** — the placeholder rendering under this spec (as opposed to the legacy combined row) has no current frame.

### 8. Rejected alternatives
Keeping the combined "Equity: X% SPR: Y" row was rejected at 2026-04-12 verdict (see 2.3 §8). Hiding the SPR row preflop to save pixels was rejected here: R-1.3 requires no reflow; the row is fixed-height and displays a placeholder instead of collapsing.

---

## 2.5 Board card chips

### 1. Inventory row
`2.5 Board card chips (A♦ K♥ 7♣)` — community cards rendered as suited, ranked chips in a row.

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3 (three chip slots reserved — flop stays on-screen after turn/river reveal), R-1.5, R-3.1 (decision-critical), R-5.1 (sole owner of the board-chip strip).

### 3. Glance pathway
- **Remembered location:** Z2, board strip (row below SPR). Left column of a three-column layout: **board (2.5) | hero hole cards (2.6) | pot chip (2.7)**. Board slot is fixed-width (~144 px — three flop cards + turn + river at ~28 px each with gap).
- **Default summary:** up to five chips (3 flop + turn + river) rendered in rank + suit-glyph form with suit-colored glyphs (♦/♥ red, ♣/♠ black). Each chip ~28 × 36 px.
- **Drill-down affordance:** none (glance-only).
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `currentLiveContext.board` (array of card codes).
- **Compute:** parse each code (shared cardParser utility) to rank + suit; pure render.
- **Invalid states:**
  - **Preflop** (empty board): entire strip blanks; the fixed-width slot stays reserved (R-1.3). The three-column layout within the Z2 board strip is preserved — no reflow of 2.6 and 2.7 on flop reveal.
  - **Card-parse failure (malformed push):** render the malformed chip as a muted `??` placeholder; do not crash the row. Log at `error` tier.

### 5. Interruption tier
`decision-critical`.

### 6. Render lifecycle
- **Mount condition:** first flop reveal push that populates `board[]`.
- **Update triggers:** `renderKey` field for `currentLiveContext.board.length` and per-card codes (a card swap is a re-render, though it shouldn't happen in a well-formed hand).
- **Unmount condition:** `hand:new` clears the board → chips blank, slot reserved.
- **`hand:new` behavior (R-2.4):** **reset.**

### 7. Corpus coverage
- Flop: S3/01, S13/01.
- Turn: S5/01.
- River: **TODO corpus extension** — S5 is a turn frame; a river-revealed frame with board populated would exercise the 5-chip rendering.
- Preflop (empty strip with reserved slot): S1/01.

---

## 2.6 Hero hole-card chips

### 1. Inventory row
`2.6 Hero hole-card chips (right group, "Q♣ J♦")` — hero's two hole cards, shown as a distinct chip pair.

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3, R-1.5, R-3.1 (decision-critical), R-5.1 (sole owner of the hero-card slot).

### 3. Glance pathway
- **Remembered location:** Z2, board strip, middle column of the three-column layout (right of 2.5, left of 2.7). Fixed-width slot (~72 px for two chips with gap).
- **Default summary:** two chips rendered identically to 2.5 board chips but with a 1 px accent border to distinguish "yours" from "community". Visual weight is slightly heavier than board chips — hero cards are the primary anchor for "what am I holding?".
- **Drill-down affordance:** none (glance-only).
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `currentLiveContext.heroHoleCards` (array of exactly two card codes, or null).
- **Compute:** parse + render identical to 2.5.
- **Invalid states:**
  - **Hero folded this hand:** chips dim to ~40% opacity (visible but de-emphasized). Cards are still truthful data; opacity signals "observing, not playing".
  - **Hero cards not yet received (pre-deal push):** slot reserved, chips blank. No placeholder glyph (unlike 2.3 `—%` — here the blank *is* the correct state because dealt-vs-undealt is the only signal and an empty slot reads as "pre-deal" unambiguously).
  - **Card-parse failure:** same `??` placeholder as 2.5.

### 5. Interruption tier
`decision-critical`.

### 6. Render lifecycle
- **Mount condition:** first context push where `heroHoleCards` is populated.
- **Update triggers:** `renderKey` fields for hero-card codes and fold state (for the opacity flip).
- **Unmount condition:** `hand:new` clears hero cards; slot reserved, chips blank.
- **`hand:new` behavior (R-2.4):** **reset.**

### 7. Corpus coverage
- Active hero cards: S1/01, S5/01.
- Hero folded (dimmed): S11/02 (hero folded scenario).

---

## 2.7 Pot size chip

### 1. Inventory row
`2.7 Pot size chip (green "$19")` — total pot amount as a standalone green chip.

### 2. Doctrine citations
R-1.1, R-1.2 (primary metric), R-1.3, R-1.5, R-3.1 (decision-critical), R-4.1 (truthful state — no pot → blank, not `$0` when stale), R-5.1.

### 3. Glance pathway
- **Remembered location:** Z2, board strip, right column of the three-column layout. Fixed-width slot (~56 px).
- **Default summary:** green chip with `$N` text, tabular-numeric. Size matches the board/hero chip height; color channel is distinct from action-headline color (see §Batch invariants).
- **Drill-down affordance:** none (glance-only).
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `currentLiveContext.pot` (number).
- **Compute:** format with `$` prefix and no decimal unless sub-dollar; pure.
- **Invalid states:**
  - **Between hands (hand is `COMPLETE`):** pot chip **must blank** — the pot from the previous hand is not the pot now. The slot stays reserved. (S4/02 shows pot chip still rendering between hands → **regression candidate S4/02-a**, flagged for SR-6. Spec-correct behavior declared here; this batch does not fix.)
  - **Pre-deal (no active hand yet, new session):** blank; slot reserved.
  - **`pot === 0` exactly during active hand preflop before any action:** render `$0` (truthful — the pot is blinds only if blinds are posted; this should be non-zero in practice, but `$0` is valid if no posts yet). Distinguish from between-hands blanking.

### 5. Interruption tier
`decision-critical`.

### 6. Render lifecycle
- **Mount condition:** first live-context push with a non-null pot for the current hand.
- **Update triggers:** `renderKey` field for `currentLiveContext.pot` and `handState` (state transition to/from COMPLETE gates blanking).
- **Unmount condition:** `hand:new` → blanks. Slot reserved.
- **`hand:new` behavior (R-2.4):** **reset to blank.** Repopulates once the new hand's first recorded pot state pushes.

### 7. Corpus coverage
- Active pot: S1/01 (`$19`), S5/01.
- Between-hands regression (stale pot visible): S4/02 → **regression S4/02-a** flagged for SR-6.

### 8. Rejected alternatives
Rendering `$0` or `—` between hands was rejected — the slot **blanking** is the truthful R-4.1 signal. A placeholder glyph here would conflict with 2.9's placeholder semantics (which is advice-scoped, not pot-scoped).

---

## 2.8 Street progress strip

### 1. Inventory row
`2.8 Street progress strip (PRE → FLOP → TURN → RIVER dots)` — five-dot timeline showing which street the hand is on.

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3, R-1.5, R-3.1 (informational tier, matches inventory), R-5.1.

### 3. Glance pathway
- **Remembered location:** Z2, below the board strip, single-row strip spanning the Z2 width. Fixed-height band.
- **Default summary:** four dots (PRE, FLOP, TURN, RIVER) with connecting lines. Dots past the current street are filled; the current-street dot is filled and ringed; future dots are hollow. Small text labels under each dot.
- **Drill-down affordance:** none (glance-only).
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `currentLiveContext.currentStreet` (one of `'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | null`).
- **Compute:** map street to dot index; pure.
- **Invalid states:**
  - **Between hands:** strip **must reset** — all dots hollow (or hidden with slot reserved). S4/02 shows the strip still fully filled between hands → **regression candidate S4/02-b**, flagged for SR-6. Spec-correct behavior: reset at `hand:new`.
  - **`currentStreet == null`** (pre-deal): all dots hollow; slot reserved.
  - **Showdown:** all four past-street dots filled; spec keeps the strip rendered through showdown (do not pre-blank on street transition to `showdown`).

### 5. Interruption tier
`informational` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** Z2 mount; dots render in hollow state initially.
- **Update triggers:** `renderKey` field for `currentLiveContext.currentStreet`.
- **Unmount condition:** never; slot always present. Content resets on `hand:new`.
- **`hand:new` behavior (R-2.4):** **reset.** All dots hollow; current-street dot resolves with the next context push for the new hand.

### 7. Corpus coverage
- Active progress: S1/01 (preflop dot), S5/01 (turn dot).
- Between-hands regression: S4/02 → **regression S4/02-b** flagged for SR-6.

---

## 2.9 "Analyzing…" placeholder

### 1. Inventory row
`2.9 "Analyzing..." placeholder (inside action bar)` — occupies the 2.1 headline slot when advice has not yet arrived for the current context.

### 2. Doctrine citations
R-1.1, R-1.3 (slot reserved — placeholder is the reservation mechanism), R-1.5, R-3.1 (informational — the placeholder itself is not decision-critical; it signals "waiting"), R-4.2 (the "unknown yet" placeholder form for the action headline), R-5.1 (shares slot with 2.1 with declared priority — see §Batch invariants).

### 3. Glance pathway
- **Remembered location:** Z2, action bar, top strip — same slot as 2.1 headline (mutually exclusive; see §Batch invariants priority rule).
- **Default summary:** italic, muted `Analyzing…` in the same slot as the headline. Smaller weight than the eventual headline so the visual transition to a real action word is upgrade-obvious.
- **Drill-down affordance:** none.
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** absence of `lastGoodAdvice` (or `lastGoodAdvice.action == null`) combined with presence of `currentLiveContext` (i.e., the engine has context and should produce advice).
- **Compute:** boolean `(ctx != null) && (advice?.action == null)`; pure.
- **Invalid states:**
  - **Advice present:** 2.1 headline takes the slot; placeholder hides.
  - **No context at all** (pre-deal, no-table): the entire Z2 is governed by Zx overrides; this placeholder does not fire.
  - **Stale advice (age > 10s):** advice is *still* present, so 2.1 headline renders (with 2.10 stale overlay). 2.9 does **not** fire for stale advice. This is the 2.9 vs 2.10 disambiguation: 2.9 = no advice yet; 2.10 = advice exists but is stale.

### 5. Interruption tier
`informational` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** context-push arrives before first advice-push for a hand.
- **Update triggers:** `renderKey` field for `(lastGoodAdvice?.action)` presence boolean.
- **Unmount condition:** advice arrives → 2.1 replaces the placeholder in-slot; or `hand:new` → placeholder re-appears for the new hand until next advice.
- **`hand:new` behavior (R-2.4):** **re-fires.** At every `hand:new`, the placeholder is the natural initial state until the engine pushes the first advice for the new hand.

### 7. Corpus coverage
- Placeholder visible: S1/01.
- Placeholder replaced by headline: S2/01, S3/01, S5/01.

---

## 2.10 Stale-advice border tint + "Stale Ns" badge (absorbed from row 1.8)

### 1. Inventory row
Absorbed from inventory row 1.8 (formerly `Stale-advice border tint + "Stale Ns" badge`, E-1 escalated from Z1 to Z2 at the 2026-04-13 Z1 batch review; this batch executes the inventory move). The row now lives in the §Z2 table as 2.10.

This spec covers the **Z2 (action bar) half**. The plan-panel half renders in Z4 and is covered in `z4-deep-analysis.md`; the two halves share a single data source and a single `renderKey` fingerprint field, per R-5.1.

Implementation reference: `side-panel/side-panel.js:945–983` (badge + age-update interval), `side-panel/side-panel.html:59–75` (CSS for `.action-bar.stale`, `.plan-panel.stale`, `.stale-badge`).

### 2. Doctrine citations
R-1.1, R-1.3 (tint overlays existing slot; no reflow), R-1.5 (targeted-glance pathway for "is this read fresh?"), R-3.1 (informational — the tint is not decision-critical itself, but decision-critical advice renders beneath it), R-4.1 (truthful staleness signal — advice still renders, annotated as stale, rather than disappearing), R-5.1 (single data owner for both halves; see cross-zone contract).

### 3. Glance pathway
- **Remembered location:** Z2 action bar — yellow-orange border-color + soft inset shadow applied to the bar's outer frame (CSS `.action-bar.stale`). Small `Stale Ns` badge anchored to the top-right corner of the action bar (absolute position, ~4 px from corners, ~9 px text). Badge is mutually non-interfering with 2.1/2.2/2.3 layout — it overlays the corner, not the content row.
- **Default summary:** when inactive, the action bar has its normal border; no badge. When stale, the border shifts to yellow-orange (`rgba(234, 179, 8, 0.55)` border + `0.18` inset glow) and a `Stale 15s` badge appears, age updated every second.
- **Drill-down affordance:** none (glance-only).
- **Expansion location:** n/a.

### 4. Data contract
- **Source (single owner, both halves):** `lastGoodAdvice._receivedAt` (ms timestamp) + `currentLiveContext` (presence).
- **Compute:**
  - `ageMs = Date.now() - lastGoodAdvice._receivedAt`.
  - `isStale = (ageMs > 10_000) || (currentLiveContext == null)`.
  - Refresh cadence: 1 Hz via a registered coordinator timer (`adviceAgeBadge`), registered through `coordinator.registerTimer` so table-switch lifecycles cancel it cleanly (RT-60 contract).
- **Invalid states:**
  - **No advice (`lastGoodAdvice == null`):** tint inactive, badge absent. Staleness does not apply to "no data yet" — that is the 2.9 placeholder's domain.
  - **`_receivedAt == null`** (malformed advice): force `isStale = false` (truthful — we don't know the age, so we don't claim staleness; RT-56 archived regression). Log at `warn` tier.
  - **Clock skew (`ageMs < 0`):** treat as fresh; clamp badge text to not render negative seconds.

### 5. Interruption tier
`informational` (matches inventory).

### 6. Render lifecycle
- **Mount condition:** first advice arrival arms the 1 Hz timer (already armed at sidebar boot; inactive state is silent).
- **Update triggers:** the 1 Hz age timer fires regardless of `renderKey`; the tint/badge are a **targeted write** to the action-bar element outside the coordinator's main `innerHTML` rebuild path (implementation detail: prevents the age refresh from churning the full render). Main `renderKey` changes that cause the bar to rebuild must preserve the tint state on the next tick — the timer re-asserts within 1 s.
- **Unmount condition:** advice becomes fresh (age ≤ 10s and context present) → tint and badge remove immediately on the next 1 Hz tick. Table switch or `hand:new` clears advice → tint/badge clear.
- **`hand:new` behavior (R-2.4):** **clears** (with advice). New hand means new advice inbound; the tint/badge are specifically about *this* advice's age. A new hand with no advice yet is 2.9 territory, not 2.10's.

### 7. Corpus coverage
- Stale visible (tint + badge): S7/02.
- Fresh (no tint): S2/01, S3/01.
- Cross-zone stale (action bar + plan panel simultaneously): **TODO corpus extension** — S7/02 captures one half; a frame exercising both plan-panel tint and action-bar tint together would confirm the cross-zone single-data-source contract visually. SR-6 harness should add.

### 8. Rejected alternatives
- **Suppressing advice rendering when stale** was rejected — stale advice is still better than nothing (R-4.1 favors truthful annotation over silence), and the user's decision loop benefits from the last-known read with a freshness marker.
- **Placing the tint on individual sub-elements (headline, edge, equity)** was rejected — R-1.3 reflow risk and visual noise. One frame-tint communicates "entire bar is stale" at a single glance.
- **Rendering the tint also on the seat arc or villain pill row** (a Z1-level placement) was the original inventory hypothesis; rejected because no such code exists and R-1.2/R-1.5 prioritize the action bar (where the hero looks first) as the single tint location. This is the content of escalation E-1 from the Z1 batch.

---

## Batch invariants (Z2-wide)

These rules apply across every Z2 element and bind the zone's layout contract. Stage 6 PR reviews check each of these as a gate.

1. **Z2 fixed-column layout.** The Z2 zone is composed of three stacked bands with fixed heights:
   - **Action-bar row** (contains 2.1 headline, 2.2 edge, 2.3 equity inline; 2.10 tint overlays the frame; 2.9 placeholder shares 2.1's slot).
   - **SPR row** (contains 2.4 SPR-only).
   - **Board strip** (three columns: 2.5 board chips | 2.6 hero hole cards | 2.7 pot chip), followed by the 2.8 street progress strip.
   Column widths inside the board strip are declared in CSS constants and do **not** reflow on flop reveal — preflop, 2.5 blanks but its slot stays reserved (R-1.3).

2. **Decision-critical tier hygiene.** Z2 is the zone that *owns* `decision-critical` tier (R-3.1). Rows 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7 are `decision-critical`; 2.8, 2.9, 2.10 are `informational`. No other zone may preempt Z2 by rendering a competing `decision-critical` element at a higher visual priority during active-hand frames. Z0 `emergency` tier (invariant badge 0.8) is the only zone that out-prioritizes Z2 visually, and only during a live violation.

3. **Single-owner slot priority — equity channel (R-5.1).** 2.3 is the **sole owner** of the equity channel. 2.4 explicitly does **not** render equity (the legacy combined "Equity: X% SPR: Y" form is a rejected alternative — see 2.3 §8 and 2.4 §8). Any future request to surface equity elsewhere must route through the R-11 amendment process; adding a second render site silently violates R-5.1.

4. **Single-owner slot priority — action-headline slot (R-5.1).** The action-bar headline slot is jointly owned by **2.1 (headline)** and **2.9 (placeholder)**. Priority: **advice presence wins** — if `lastGoodAdvice?.action != null`, 2.1 renders; otherwise 2.9. The two are mutually exclusive by data (there is no state where both should render). 2.10 is **not** a third claimant on this slot — it is an overlay on the enclosing frame, not on the inner headline.

5. **2.9 vs 2.10 disambiguation (explicit priority rule).** These two elements signal different states and **must not collide**:
   - **2.9 fires** when `lastGoodAdvice?.action == null && currentLiveContext != null` (no advice yet for this context).
   - **2.10 fires** when `lastGoodAdvice?.action != null && isStale(advice)` (advice exists but is old).
   They are never simultaneous under correct data flow: if advice is null, there is nothing to be stale about; if advice is non-null, 2.9 does not fire. A future regression that produces both simultaneously is a data-layer bug, not a render-layer ambiguity — and Z2 does not add a guard here because silencing a symptom would mask the root cause (cf. CLAUDE.md working principles).

6. **`hand:new` behavior (R-2.4) — per row:**
   - **Reset at `hand:new`:** 2.1 (headline clears), 2.2 (edge clears), 2.3 (equity clears), 2.5 (board blanks), 2.6 (hero cards blank), 2.7 (pot blanks), 2.8 (street resets to hollow), 2.10 (stale state clears with advice).
   - **Reset content, keep slot visible:** 2.4 (SPR blanks then repopulates as soon as the new hand's pot + stack resolve).
   - **Re-fire:** 2.9 (placeholder returns as the natural initial state for the new hand).
   Every Z2 element has an explicit declared behavior; there are no implicit slots.

7. **Color-channel non-collision.** Three independent color channels render within Z2 and must remain distinguishable:
   - **Action color** (2.1 headline, BET green / CALL blue / FOLD red / etc.) — palette source: `shared/design-tokens.js` action tokens.
   - **Pot green** (2.7 pot chip) — distinct green from BET green; palette tokens declare the two separately.
   - **Stale yellow-orange** (2.10 tint + badge) — `#eab308` / `rgba(234, 179, 8, *)`. Distinct from any action color; intentional high-contrast-low-saturation so it reads as "metadata", not "recommendation".
   Additionally, the **Z0 pipeline dot** (green/amber/red in 0.1) uses its own palette tokens; it does not alias the Z2 action palette. A change to any of these palettes must be reviewed against this invariant.

8. **2.10 cross-zone contract with Z4.** The stale-advice indicator renders on the **action bar (Z2, this spec)** and the **plan panel (Z4, `z4-deep-analysis.md`)**. Both halves MUST:
   - Use a **single data source**: `lastGoodAdvice._receivedAt` + `currentLiveContext` (R-5.1).
   - Drive off a **single `renderKey` fingerprint field**: the `isStale` boolean computed from the shared formula.
   - Share the **single 1 Hz coordinator timer** (`adviceAgeBadge`). There is not a second timer for the plan-panel half.
   - Use the **same CSS palette tokens** — the two `.stale` class rules in `side-panel.html` already declare this.
   Z2 never reaches into Z4's DOM, nor vice versa; both halves observe the same boolean and apply local targeted writes. A change to the staleness threshold (currently 10s) affects both halves by construction.

9. **Between-hands behavior and regression flagging.** Rows 2.7 (pot chip) and 2.8 (street progress) are the S4/02 regression candidates identified in the Z2 kickoff handoff:
   - **S4/02-a:** 2.7 pot chip still visible between hands (spec-correct: blank on `hand:new`).
   - **S4/02-b:** 2.8 street progress strip still shows filled dots between hands (spec-correct: reset on `hand:new`).
   Both are **flagged for SR-6 implementation** — this batch authors the spec-correct behavior but does not modify code. Both regressions share a common root-cause hypothesis (the between-hands Zx override does not blank Z2 live-context-derived rendering), which SR-6 should investigate before patching either symptom individually.

---

## Escalations

**E-1 from Z1 batch — executed in this batch.** Inventory row 1.8 reassigned from Z1 to Z2 as row 2.10. Inventory file patched as part of this batch's deliverable (minimal move, no verdict change). The row now has a full Z2 spec above. R-11 process followed: owner approval of the Z1 batch included this escalation; this batch is the execution step, not a re-opening.

**E-2 from Z1 batch — NOT a Z2 concern, carried forward.** The Rule V seat-arc selection ring is a Z1 (seat arc) surface; owner to decide whether to add as inventory row 1.11 or fold into 1.1. This batch makes no Z2 claim on that decision; the Z3 batch (next) does not depend on E-2's resolution either. Re-flagged at end of batch per handoff instruction.

**E-3 (new, R-11): S4/02 regression candidates 2.7 + 2.8.** The spec-correct behavior declared here (blank pot chip + reset street strip at `hand:new`) differs from the S4/02 rendering. Escalation records the spec-implementation gap; not a verdict re-opening and not a spec amendment request. **Recommended action:** open an SR-6 follow-up item to root-cause the between-hands Zx override's failure to blank Z2 live-context-derived elements. Flag: both rows plausibly share the same root cause.

---

## Self-check (per README authoring order)

- [x] One section per kept Z2 row in inventory order (2.1–2.9), plus 2.10 appended (absorbed from 1.8 per E-1).
- [x] 8-field template used verbatim (§8 optional — present on 2.3, 2.4, 2.7, 2.10).
- [x] §3 glance pathway complete (all 4 sub-fields) on every spec.
- [x] ≥1 doctrine rule cited in §2 on every spec.
- [x] ≥1 S-frame cited in §7 on every spec (with TODO extensions noted where corpus is thin).
- [x] Every spec declares §6 `hand:new` behavior (R-2.4).
- [x] 2.7 and 2.8 between-hands behavior explicitly declared; S4/02-a and S4/02-b regressions flagged for SR-6 (batch invariant 9 + E-3).
- [x] 2.10 declares cross-zone contract with Z4 (batch invariant 8 + §1 reference).
- [x] 2.3 vs 2.4 equity ownership declared (batch invariant 3; 2.4 §8 rejects the combined form).
- [x] 2.9 vs 2.10 disambiguation declared with explicit priority rule (batch invariant 5).
- [x] Color-channel non-collision declared (batch invariant 7).
- [x] No spec re-opens an inventory verdict; E-1 execution + E-3 new escalation recorded per R-11.

Awaiting owner review.
