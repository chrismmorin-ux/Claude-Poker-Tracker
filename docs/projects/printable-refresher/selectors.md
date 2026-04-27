# Selector-library contract — Printable Refresher

**Status:** v1.0 — Gate 4, Session 4 (2026-04-24).
**Depends on:** `docs/design/surfaces/printable-refresher.md` §State §selectors subsection; `WRITERS.md` (writer registry produces state that these selectors read); charter §Acceptance Criteria red line #6 (flat access) + red line #13 (durable suppression).
**Purpose:** Define the read-side contract for `userRefresherConfig` + `cardRegistry` state. Selectors are the counterpart to writers — together they guarantee the state-clear-asymmetry contract (R-8.1 from Sidebar Rebuild doctrine).

---

## Why this contract exists

The Sidebar Rebuild program (SR-6, 2026-04-13 → 2026-04-15) surfaced 11 state-clear-asymmetries — cases where setting a piece of state produced one visible behavior but clearing or filtering that state produced a subtly different behavior. Root cause: read-site and write-site were not paired with matching selector contracts. One read path applied a filter the other didn't, and the asymmetry manifested as "this card is missing but I didn't delete it" bugs.

Doctrine **R-8.1 (state-symmetry)** requires that every writer has an explicit read-side pair with documented filter semantics. A card suppressed via `W-URC-2` must round-trip: `selectActiveCards` excludes it, `selectAllCards` includes it (with suppression status annotation), and the transition from suppressed → un-suppressed produces zero data loss.

PRF specifically needs selector discipline because:

- **Red line #6 (flat access)** requires suppressed cards to remain visible in the catalog with their status tag. A "Show suppressed" toggle flips between `selectActiveCards` (default) and `selectAllCards` — the two selectors must return compatible shape + round-trip without data loss.
- **Red line #13 (durable suppression)** requires `suppressedClasses` + `cardVisibility[cardId] === 'hidden'` to survive engine + app version bumps. Selectors must read the persisted state faithfully; a selector that silently drops suppressed entries breaks the durability contract at read-time even if write-time is correct.
- **Print-export vs catalog-display** are two different read contexts. Print-export uses a different default selector than catalog-display (print excludes hidden; catalog shows all with status). Formalizing both prevents a class of "card appeared in catalog but didn't print" surprises.

This doc formalizes the 4 selectors PRF-G4-S1 §State enumerated + adds 2 more needed for staleness-diff reads. All 6 live in `src/utils/printableRefresher/selectors.js` (Phase 5 target).

---

## Core state shape (inputs to selectors)

Selectors operate on three inputs joined in-memory at read time:

1. **`cardRegistry`** — build-time manifest registry (flat array of card objects, one per manifest). Immutable at runtime.
2. **`userRefresherConfig`** — owner state from IDB (`{ cardVisibility, suppressedClasses, printPreferences, ... }`). Read via `useRefresherConfig()` hook.
3. **`printBatches`** (optional, for staleness-aware selectors) — past batches from IDB. Read via `usePrintBatches()` hook.

Each selector is a pure function: `(inputs) => Card[]` or `(inputs, filters) => Card[]`. No hidden IDB reads; all state flows in as arguments. Selectors are memoizable on all three inputs.

```
type Card = {
  cardId: string,
  class: 'preflop' | 'math' | 'equity' | 'exceptions',
  title: string,
  schemaVersion: number,
  contentHash: string,
  phase: 'A' | 'B' | 'C',
  tier: 'free' | 'plus',
  // ... (see manifest shape in content-drift-ci.md)
}

type AnnotatedCard = Card & {
  visibility: 'default' | 'hidden' | 'pinned',
  classSuppressed: boolean,           // true if card's class is in suppressedClasses
  isStale: boolean | null,             // null if not queried against printBatches
  staleSinceBatch: string | null,      // batchId of most recent batch where card was printed + now stale
}
```

---

## Selectors

### `selectAllCards(inputs)` — the base read

**Signature.** `selectAllCards({ cardRegistry, userRefresherConfig }) → AnnotatedCard[]`

**Semantics.** Returns **every** card in the registry, annotated with visibility + class-suppression state. Never filters, never hides. This is the "Show suppressed" view used in the catalog's full-visibility toggle.

**Sort order.** Manifest registry order (deterministic; typically theoretical order preflop → math → equity → exceptions, then alphabetical within class). Sort-refinement applied downstream by `useRefresherView.sort` state via `applySortStrategy`.

**Red line linkage.** #6 (flat access) — suppressed cards are visible in this selector's output. Downstream `CardCatalog` renders them with status annotation.

**Test target PRF-G5-SL-ALL.**

```js
// Example
const all = selectAllCards({ cardRegistry, userRefresherConfig: {
  cardVisibility: { 'PRF-MATH-AUTOPROFIT': 'hidden' },
  suppressedClasses: ['exceptions'],
}});
// all.length === cardRegistry.length
// all.find(c => c.cardId === 'PRF-MATH-AUTOPROFIT').visibility === 'hidden'
// all.filter(c => c.class === 'exceptions').every(c => c.classSuppressed === true)
```

### `selectActiveCards(inputs)` — the default catalog read

**Signature.** `selectActiveCards({ cardRegistry, userRefresherConfig }) → AnnotatedCard[]`

**Semantics.** Returns cards that are **neither hidden nor class-suppressed**. Equivalent to: `selectAllCards(...).filter(c => c.visibility !== 'hidden' && !c.classSuppressed)`.

This is the default for:
- Catalog render when "Show suppressed" filter is off.
- Default print-export card set.
- Staleness-diff base set (stale count in `StalenessBanner` is computed over active cards only — hidden / suppressed cards never count toward "N of M stale").

**Red line linkage.** #5 (no engagement-pressure — catalog default doesn't surface suppressed) + red line #6 (flat access preserved via `selectAllCards` coexistence).

**Test target PRF-G5-SL-ACTIVE.**

### `selectPinnedCards(inputs)` — the pinned subset

**Signature.** `selectPinnedCards({ cardRegistry, userRefresherConfig }) → AnnotatedCard[]`

**Semantics.** Returns cards where `visibility === 'pinned'`. Subset of `selectActiveCards` (pinned cards are by definition active — pinning a card un-hides it if it was hidden, via W-URC-2 coupling).

Used for:
- "Pinned-first" sort option in `useRefresherView.sort === 'pinnedFirst'`: pinned cards render before non-pinned.
- Print-export ordering hint — pinned cards print on the first page(s) when cards-per-sheet creates multi-page output.

**Test target PRF-G5-SL-PINNED.**

### `selectSuppressedCards(inputs)` — the suppressed-view read

**Signature.** `selectSuppressedCards({ cardRegistry, userRefresherConfig }) → AnnotatedCard[]`

**Semantics.** Returns cards where either `visibility === 'hidden'` OR `classSuppressed === true`. The inverse of `selectActiveCards` relative to `selectAllCards`. Used for the "Suppressed" filter chip in the catalog Status filter group.

Constraint: the union of `selectActiveCards` + `selectSuppressedCards` equals `selectAllCards`. No card is in both; no card is in neither. Test PRF-G5-SL-PARTITION asserts this partition.

**Red line linkage.** #6 (flat access — suppressed cards are reachable via this selector) + #3 (durable override — system doesn't re-include them into active selector until owner un-suppresses explicitly).

**Test target PRF-G5-SL-SUPPRESSED + PRF-G5-SL-PARTITION.**

### `selectCardsForBatchPrint(inputs, selectedIds)` — the print-export read

**Signature.** `selectCardsForBatchPrint({ cardRegistry, userRefresherConfig }, selectedIds: string[]) → AnnotatedCard[]`

**Semantics.** Returns cards in `selectedIds` filtered to those passing `selectActiveCards` (excludes hidden + class-suppressed even if explicitly selected — defense-in-depth against UI bugs that might allow selecting a suppressed card).

Used as the final read before `W-URC-3` writes the batch + `window.print()` fires. If a selected card is dropped by this selector, UI shows a warning ("1 selected card was suppressed + excluded from print") in the `PrintConfirmationModal` summary.

**Red line linkage.** #15 (no proactive print — this selector only runs on owner-initiated print action; never automatic) + #13 (durable suppression — suppressed cards don't print even if explicitly selected).

**Test target PRF-G5-SL-BATCH-PRINT.**

### `selectStaleCards(inputs, batches)` — the staleness-diff read

**Signature.** `selectStaleCards({ cardRegistry, userRefresherConfig }, printBatches) → StaleCard[]`

**Semantics.** Returns active cards whose current `contentHash` differs from the most-recent `printBatches[].perCardSnapshots[cardId].contentHash` where `cardId` was printed.

```
type StaleCard = AnnotatedCard & {
  currentHash: string,
  printedHash: string,
  printedAt: ISO8601,
  batchId: string,
  batchLabel: string | null,
}
```

Used for:
- `StalenessBanner` "N of M cards stale" count.
- `CardDetail` per-card staleness status chip.
- `LineageModal` staleness-diff prose ("Math unchanged; exception clause updated 2026-05-01").

**Semantics details:**
- Only active cards (from `selectActiveCards`) are considered. Hidden / suppressed cards are never "stale" in the banner — they're not in the user's active print set.
- Only the **most-recent** batch in which the card appears is compared. If a card was printed in batches A (2026-04-24) and B (2026-05-10), only B's snapshot is used. The current hash is compared against B's `perCardSnapshots[cardId].contentHash`. Rationale: staleness is about the laminate the owner currently holds, not all historical laminates.
- A card never printed (not in any batch) is **not stale** — it has no laminate to be stale.
- A card with a matching hash is "current"; a card with a diverging hash is "stale."

**Red line linkage.** #10 (printed-advice permanence requires staleness surfacing) + #12 (lineage-mandatory — stale detection relies on per-card content-hash lineage).

**Test target PRF-G5-SL-STALE.**

---

## State-clear-asymmetry coverage (R-8.1)

The selector library covers all 4 asymmetry pairs that PRF's writer registry produces:

| Write action | Write path | Read pair | Test |
|---|---|---|---|
| Pin card | W-URC-2 `writeCardVisibility({ cardId, visibility: 'pinned' })` | `selectPinnedCards` includes; `selectActiveCards` includes; `selectSuppressedCards` excludes | PRF-G5-SL-ROUNDTRIP-PIN |
| Hide card | W-URC-2 `writeCardVisibility({ cardId, visibility: 'hidden' })` | `selectActiveCards` excludes; `selectSuppressedCards` includes; `selectAllCards` includes w/ annotation | PRF-G5-SL-ROUNDTRIP-HIDE |
| Suppress class | W-URC-2 `writeSuppressedClass({ classId, suppress: true })` | `selectActiveCards` excludes all cards of class; `selectSuppressedCards` includes them w/ `classSuppressed: true`; `selectAllCards` includes w/ annotation | PRF-G5-SL-ROUNDTRIP-SUPPRESS |
| Un-suppress class | W-URC-2 `writeSuppressedClass({ classId, suppress: false, ownerInitiated: true })` | `selectActiveCards` re-includes all class cards; `selectSuppressedCards` excludes; values of original `cardVisibility[cardId]` (if any) preserved | PRF-G5-SL-ROUNDTRIP-UNSUPPRESS |

**Zero data loss.** The un-suppress roundtrip test is the canonical state-symmetry proof: set 3 cards to `'pinned'` → suppress their class → un-suppress the class → verify all 3 are still `'pinned'`. Suppressing a class does not lose the per-card pin/hide state; un-suppressing restores it.

---

## Memoization contract

Each selector is a pure function. Memoize via shallow-equality on inputs using the existing `useMemo` / `useSelector` pattern (no custom memoization library). Inputs that change:

- `cardRegistry` — never changes at runtime (immutable from build).
- `userRefresherConfig` — changes on writer invocation. Writers return a new reference via reducer spread, so shallow-equality memoization works correctly.
- `printBatches` — changes on W-URC-3 fire. Append-only (I-WR-5), so the array reference changes only on new batch creation.

**Test guardrail.** PRF-G5-SL-MEMOIZATION asserts: calling `selectActiveCards` twice with referentially-equal inputs returns referentially-equal output. Breaking this test means the selector has hidden state or a non-pure side effect — unacceptable.

---

## Renderer coupling rules

The selectors are the **only** approved read path for card visibility state in refresher surfaces. Direct access to `userRefresherConfig.cardVisibility[cardId]` in render code is prohibited. Rationale: direct access bypasses the annotation (`classSuppressed` derived field) + bypasses the `selectActiveCards` default filter logic.

**Enforcement.** Convention + ESLint rule (Phase 5 target) that flags direct `cardVisibility[` access outside `src/utils/printableRefresher/selectors.js`. Alternative: reviewer-at-PR-time per standard code review + `check-refresher-writers.sh` companion script `check-refresher-selectors.sh` grep.

**Allowed exceptions.**
- Writer validators may read `cardVisibility[cardId]` directly to enforce field-ownership (e.g., W-URC-2 checking if the card was already pinned before un-pinning).
- Test files may read directly for assertion convenience.
- `selectors.js` internally reads the state — it's the only approved consumer.

---

## Filter + sort composition (downstream)

Selectors return the **base set** of cards. Further filtering (by class / stakes / stacks / status) and sorting (theoretical / alphabetical / last-printed / pinned-first) happens downstream via `useRefresherView`.

```js
// Composition pattern (render code sketch)
const allCards = selectAllCards({ cardRegistry, userRefresherConfig });
const filtered = applyRefresherFilters(allCards, refresherView.filters);
const sorted = applyRefresherSort(filtered, refresherView.sort);
```

The "Status" filter group is the exception — it toggles between `selectActiveCards` and `selectAllCards` (or shows both with status annotations). This is structured as:

```js
const baseSet = refresherView.filters.statuses.includes('suppressed')
  ? selectAllCards({ cardRegistry, userRefresherConfig })
  : selectActiveCards({ cardRegistry, userRefresherConfig });
```

Pinned-first sort consumes `selectPinnedCards` for the lead-ordering step.

---

## Phase 5 implementation checklist

- [ ] Author `src/utils/printableRefresher/selectors.js` with the 6 named exports.
- [ ] Author `src/utils/printableRefresher/__tests__/selectors.test.js` covering all 6 selectors + 4 state-clear-asymmetry roundtrip tests + memoization guardrail.
- [ ] Author `applyRefresherFilters` + `applyRefresherSort` helpers (closest to selectors or in separate `viewComposition.js` — decide at implementation time).
- [ ] Add ESLint rule / grep check for direct `cardVisibility[` access outside selectors.js.
- [ ] Write integration test: render catalog with various `userRefresherConfig` states + assert rendered card list matches selector output.

---

## Relationship to writers + content-drift CI

| Concern | Scope | File |
|---|---|---|
| Write-paths into state | IDB writer registry | `WRITERS.md` |
| Read-paths from state | **This spec** | `selectors.md` |
| Content regression | Card manifest validation | `content-drift-ci.md` |

The three together form PRF's persistence + state contract. Writers produce state; selectors consume state; content-drift CI validates the content at build. All three are CI-enforced and amendment-gated via persona-level review.

---

## Amendment rule

Adding a new selector requires **persona-level review**. Default answer is no unless the new selector is load-bearing for a new red-line compliance or a new writer pair. Modifying the semantics of an existing selector (changing what it includes/excludes) requires the same review — these semantics are load-bearing for red lines #6 + #13 + state-clear-asymmetry.

Removing a selector is forbidden except as part of a larger refactor that re-homes its callers (same review required).

---

## Change log

- **2026-04-24 — v1.0 shipped (Gate 4, Session 4).** 6 selectors specified (`selectAllCards` / `selectActiveCards` / `selectPinnedCards` / `selectSuppressedCards` / `selectCardsForBatchPrint` / `selectStaleCards`). 4 state-clear-asymmetry roundtrip tests enumerated. Memoization contract + renderer coupling rules documented. Relationship to writers + content-drift CI clarified.
