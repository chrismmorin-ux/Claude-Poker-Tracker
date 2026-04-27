# WRITERS — Printable Refresher

**Status:** v1.0 — Gate 4, Session 4 (2026-04-24).
**Depends on:** `docs/design/surfaces/printable-refresher.md` §State; charter §Acceptance Criteria red lines #11 + #13 + #15; `docs/projects/printable-refresher.project.md` §Q6 (IDB coordination) + §Q9 (print-date ergonomics).
**Purpose:** Enumerable registry of every write-site into the two Printable Refresher IDB stores (`userRefresherConfig`, `printBatches`). CI-grep-enforceable. Any write not registered here is a bug.

---

## Why this registry exists

The Sidebar Rebuild program (SR-0 → SR-7, 2026-04-12 → 2026-04-15) established doctrine rule **R-7.2 (cross-panel writer registry)** after repeated incidents where a store gained a new write site silently, broke a cross-surface invariant, and the root cause took hours to trace. PRF inherits the rule. The two PRF stores are single-surface today (all writes originate from `PrintableRefresherView`) but multi-writer within that surface:

- `userRefresherConfig` — 2 writers (config-preferences + card-visibility)
- `printBatches` — 1 writer (print-date-stamp)

Three total writers. Low absolute count — but the autonomy stakes are high:

- All three writers sit inside a `currentIntent: 'Reference'` surface, and red line #11 (Reference-mode write-silence at reducer boundary) asserts **none of them mutate skill-state stores**. The writers enumerated here are the only allowed mutations from refresher surfaces; any other write is a red-line violation.
- Red line #13 (durable suppression) requires `userRefresherConfig.suppressedClasses` to survive engine + app version bumps. The writer boundary is where the durability contract is enforced.
- Red line #15 (no proactive print-output) requires `W-URC-3` to fire **only** after owner confirmation in `PrintConfirmationModal`. No automatic writer exists for `printBatches`.

This document is the source of truth. `src/utils/printableRefresher/writers.js` (Phase 5, to be authored) re-exports the registry as a frozen object for runtime assertion.

**Enforcement contract.** A CI grep check (per `scripts/check-sidebar-writers.sh` existing pattern — repurposed as `scripts/check-refresher-writers.sh`) scans for any call that writes to one of these stores (pattern: `put\s*\(\s*['"]userRefresherConfig` and equivalents). Every match must be reachable from a writer enumerated below. Unregistered writes fail CI.

---

## Store: `userRefresherConfig`

**Keypath:** `id` (string, constant `'singleton'` — one-record store).
**Indexes:** none (single record).
**Record shape** (per S1 §State + v18+ migration spec PRF-G4-MIG):

```
{
  id: 'singleton',
  schemaVersion: 1,
  cardVisibility: { [cardId: string]: 'default' | 'hidden' | 'pinned' },
  suppressedClasses: string[],                  // card-class-level hide (DURABLE)
  printPreferences: {
    pageSize: 'letter' | 'a4',
    cardsPerSheet: 12 | 6 | 4 | 1,
    colorMode: 'auto' | 'bw',
    includeLineage: boolean,
    includeCodex: false,                         // Phase 1 structural (AP-PRF-09 + red line #16)
  },
  notifications: {
    staleness: boolean,                          // default false (AP-PRF-08)
  },
  lastExportAt: ISO8601 | null,
}
```

### W-URC-1 — `config-preference-writer`

**Purpose.** Persists settings panel adjustments to `printPreferences` + `notifications.staleness` + `lastExportAt` timestamp.

**Entry point (Phase 5).** `src/utils/printableRefresher/writers.js` → `writeConfigPreferences(patch)` invoked from `PrintControls.jsx` (preview surface) + `SettingsView` refresher subsection (for notifications opt-in).

**Fields written.** `printPreferences.*` subfields + `notifications.staleness` + `lastExportAt` (set by W-URC-3 via shared wrapper; see note below). **Never writes** `cardVisibility` (W-URC-2 owns) or `suppressedClasses` (W-URC-2 owns).

**Trigger.** Owner toggles a setting in `PrintControls` (page size, cards-per-sheet, color mode, include-lineage) OR in Settings (notifications.staleness toggle). Writes are debounced 400ms via `useRefresherConfig` hook (mirrors `useAssumptionPersistence` pattern). Debounce target is latency — rapid toggling of page-size selector should not produce N IDB writes.

**Failure mode.** If patch contains a field this writer does not own (e.g., `cardVisibility`), validator rejects at writer boundary + logs registered-field mismatch. Regression test PRF-G5-WR asserts writer patch-fields are a subset of owned fields.

**Autonomy contract.**
- Structural enforcement of Phase 1 default `includeCodex: false`: validator rejects any patch that sets `includeCodex: true` (AP-PRF-09 refusal until Phase 2+ opt-in gesture authored).
- Structural enforcement of default `notifications.staleness: false`: writer permits any user-initiated toggle, but the field's schema default is `false` on singleton creation (no default-on migration; AP-PRF-08 enforcement).

### W-URC-2 — `card-visibility-writer`

**Purpose.** Records owner actions on individual card visibility (pin / hide / un-pin / un-hide) + card class suppression (suppress / un-suppress).

**Entry point (Phase 5).** `src/utils/printableRefresher/writers.js` → `writeCardVisibility({ cardId, visibility })` + `writeSuppressedClass({ classId, suppress: boolean })` invoked from `CardRow` + `CardDetail` action-chip handlers + `SuppressConfirmModal` confirm-handler.

**Fields written.** `cardVisibility[cardId]` (enum set) + `suppressedClasses` (array add / remove). **Never writes** `printPreferences` or `notifications` (W-URC-1 owns).

**Trigger.** Owner taps 📌 Pin / 👁 Hide / ⛔ Suppress chips. Pin + Hide writes are **immediate** (no debounce — they're deliberate single-tap actions). Suppress writes gate on `SuppressConfirmModal` confirm; checkbox must be ticked + primary button clicked. Un-suppress is same flow in reverse.

**Failure mode.**
- **Suppress without modal confirmation** → writer validator rejects write if `options.confirmed !== true` in the call payload. UI path ensures this but the writer enforces defensively (red line #13 durability — the action must be deliberate at write time).
- **Non-existent cardId** → writer permits write for forward-compatibility (a card may exist in `cardRegistry` but not yet be rendered; visibility state tracks the ID regardless). Orphaned entries cleaned up by a write-time compaction pass at schemaVersion bump (see I-WR-4).

**Autonomy contract.**
- **Durability (red line #13).** `suppressedClasses` survives engine + app version bumps + schemaVersion migrations. Migration code adds new stores but **never** mutates existing `suppressedClasses` array. Test PRF-G5-DS asserts this across simulated schemaVersion bump + engine version bump + app version bump.
- **No un-suppress nudge.** Un-suppress requires owner-initiated tap on the same ⛔ chip (in the "Suppressed" filter view). System never surfaces "reconsider this card?" or "you un-hid this similar card previously" cross-card nudges (AP-PRF-05 refused at UI; defense-in-depth at writer by forbidding any programmatic un-suppress call-path except the explicit owner-initiated one — enforced by requiring `options.ownerInitiated: true` in the un-suppress payload).

### (Note on `lastExportAt` shared write)

`lastExportAt` is technically owned by W-URC-1 (it's in `userRefresherConfig`), but W-URC-3 (print-date-stamp) also needs to update it post-print to surface "last print" in settings. Resolution: W-URC-3's wrapper invokes W-URC-1's `writeConfigPreferences({ lastExportAt: ISO8601 })` as its final step, keeping the field's write-path single-ownership at the writer level even though two writers trigger it.

---

## Store: `printBatches`

**Keypath:** `batchId` (UUID v4).
**Indexes:** `printedAt` (for chronological listing + staleness diff lookup).
**Record shape** (per S1 §State + v18+ migration spec PRF-G4-MIG):

```
{
  batchId: string (UUID v4),
  printedAt: ISO8601,                            // USER-ENTERED, editable + backdateable per Q9
  label: string | null,
  cardIds: string[],
  engineVersion: string,                          // e.g. 'v4.7.2'
  appVersion: string,                             // e.g. 'v123'
  perCardSnapshots: {
    [cardId: string]: {
      contentHash: string,                        // e.g. 'sha256:a3c1d8f...'
      version: string,                            // semver, e.g. 'v1.2'
    }
  },
  schemaVersion: 1,
}
```

### W-URC-3 — `print-date-stamp-writer`

**Purpose.** Creates a new immutable `printBatches` record every time the owner confirms a print through `PrintConfirmationModal`. Captures the user-entered print-date + content-hash snapshot per card at the moment of print.

**Entry point (Phase 5).** `src/utils/printableRefresher/writers.js` → `writePrintBatch({ printedAt, label, cardIds, engineVersion, appVersion, perCardSnapshots })` invoked from `PrintConfirmationModal.jsx` confirm handler (which fires only after modal checkbox + primary button — see PRF-G4-S1 §Key interactions).

**Fields written.** Full batch body — `batchId` (generated in-writer via `crypto.randomUUID()`), `printedAt`, `label`, `cardIds`, `engineVersion`, `appVersion`, `perCardSnapshots`, `schemaVersion: 1`. **Never mutates** existing batch records — `printBatches` is append-only (see I-WR-5).

**Trigger.** Owner confirms batch print via `PrintConfirmationModal`. The writer fires **only** in response to this explicit owner action. There is no automatic / scheduled / background invocation path. Red line #15 enforcement at the writer boundary: any call-site not originating from the modal confirm handler fails CI-grep + produces a runtime warning in dev.

**Failure mode.**
- **Empty cardIds array** → writer rejects (empty batch is meaningless; UI should prevent reaching the modal with 0 cards selected; writer validates defensively).
- **`printedAt` in the future beyond +1 day** → writer warns (dev-mode console) but accepts (owner may be setting a tomorrow-print reminder — but this is an edge case; default is today-or-past).
- **`perCardSnapshots` keys don't match `cardIds`** → writer rejects with schema mismatch error (snapshot coverage must be 1:1 with batch card list for staleness-diff correctness).

**Autonomy contract.**
- **Immutability.** Once written, a batch record is never mutated. Edits to the print-date after the fact require deleting + re-creating — and there is no UI affordance for that. Rationale: batches are snapshots; editing them corrupts staleness-diff (see I-WR-5).
- **Append-only.** Writer never deletes batches. Old batches remain queryable for staleness-diff of very old laminates (10+ months). Storage impact is small (~1KB/batch × low batch frequency).
- **No proactive trigger (red line #15).** Writer has no caller other than modal confirm handler. No heuristic / timer / scheduler / session-open path writes batches.
- **Post-write side effect:** writer invokes W-URC-1's `writeConfigPreferences({ lastExportAt: printedAt })` as its final step. Single IDB transaction guarantees atomicity of batch creation + lastExportAt update.

---

## Cross-store invariants (I-WR-*)

These invariants span multiple writers + multiple stores. Violations fail CI.

### I-WR-1 — Enumeration completeness

Every IDB write to `userRefresherConfig` or `printBatches` must originate from a writer registered above (W-URC-1 / W-URC-2 / W-URC-3). A CI grep check (mirrors `scripts/check-sidebar-writers.sh` pattern) enumerates write-patterns:

- `\.put\s*\(\s*['"]userRefresherConfig` — any put() call targeting the store
- `\.delete\s*\(\s*['"]userRefresherConfig` — any delete() call (currently only W-URC-2 for un-suppress uses this indirectly via array-filter-then-put)
- `\.put\s*\(\s*['"]printBatches` — any put() call targeting the store
- `\.delete\s*\(\s*['"]printBatches` — **NONE allowed** (append-only per I-WR-5); CI grep asserts zero matches

Unregistered matches → CI fails with writer-registry-mismatch error.

### I-WR-2 — Reference-mode write-silence at reducer boundary (red line #11)

**The load-bearing invariant for this registry.** No writer from this registry (W-URC-1 / W-URC-2 / W-URC-3) produces a mutation in `shapeMastery`, `villainAssumption`, `exploitAnchor`, `anchorObservation`, or any other skill-state store. Refresher writers are structurally segregated — they write only to `userRefresherConfig` + `printBatches`.

**Enforcement.** Test PRF-G5-RI (reducer-boundary write-silence) spies on reducer dispatch from `PrintableRefresherView` mounts and asserts:
- Zero dispatches of type `SHAPE_MASTERY_*` / `VILLAIN_ASSUMPTION_*` / `ANCHOR_*` under `currentIntent: 'Reference'`
- Only dispatches of type `REFRESHER_CONFIG_*` / `PRINT_BATCH_CREATED` are permitted under Reference intent

If a future writer is added to this registry that mutates a skill-state store, the test fails + the writer must be re-classified (either out of the refresher surface OR by dispatching an intent-switch to `Deliberate` first per red line #17).

### I-WR-3 — Cross-writer field-ownership segregation

Each writer owns a disjoint set of fields:

| Writer | Owned fields |
|---|---|
| W-URC-1 | `printPreferences.*`, `notifications.staleness`, `lastExportAt` (via W-URC-3 wrapper) |
| W-URC-2 | `cardVisibility[*]`, `suppressedClasses` |
| W-URC-3 | Full `printBatches` record (append only) |

No field is written by more than one writer. `lastExportAt` is the exception but funnels through W-URC-1's function — ownership remains single.

**Enforcement.** Validators at each writer reject patches containing non-owned fields. Test PRF-G5-WR asserts each writer's patch-field whitelist.

### I-WR-4 — Suppression durability across schemaVersion bumps (red line #13)

When `userRefresherConfig.schemaVersion` is incremented (future v2+ migration — not Phase 1 scope, but the invariant is ratified now), the migration MUST:
- Preserve `suppressedClasses` array byte-for-byte from v1.
- Preserve `cardVisibility` map (individual hidden / pinned entries).
- Accept field additions / defaults for new fields.
- **Never** reset, clear, migrate-away, or "upgrade" suppression state.

Orphaned `cardVisibility` entries (cards that were in registry at v1 but removed at v2) are permissible to leave in place (forward-compat: if the card returns, its visibility is remembered). Compaction is optional at migration time; never lossy for `suppressedClasses`.

**Enforcement.** Test PRF-G5-DS constructs a v1 singleton with 3 suppressed classes + 2 hidden cards → simulates v1→v2 migration → asserts both arrays survive.

### I-WR-5 — `printBatches` is append-only

Batches are snapshots of "what was printed when." Mutating a batch after the fact invalidates staleness-diff (a future read that compares current contentHash to the recorded `perCardSnapshots[cardId].contentHash` assumes the recorded value is the hash that was true at the print moment). No writer mutates or deletes batches.

**Enforcement.** I-WR-1 CI-grep asserts zero `.delete()` calls against `printBatches`. Zero-mutation enforced by lack of an update/patch writer registered above — W-URC-3 is the only writer and it only creates.

Exception: if a dev wants to **truly** delete a batch (e.g., for a bug repro), the dev tool at `src/__dev__/printBatchDeleter.js` (Phase 5+) uses a `__DEV__` guard + explicit console-logged warning. Dev tool is not part of the production writer registry.

### I-WR-6 — `perCardSnapshots` completeness (staleness-diff precondition)

When W-URC-3 writes a batch, `perCardSnapshots` MUST contain an entry for every `cardId` in `cardIds`. A batch with `cardIds: ['A', 'B', 'C']` and `perCardSnapshots: { A: {...}, C: {...} }` (missing B) is invalid — writer validator rejects.

Rationale: staleness-diff at read time iterates `cardIds` and reads snapshots; a missing snapshot produces an undefined-hash comparison → surface rendering breaks OR (worse) silently shows "current" for a card that may actually be stale.

**Enforcement.** Writer validator at W-URC-3 rejects; test PRF-G5-WR covers the rejection case.

### I-WR-7 — Enrollment-state gating (N/A subsumed)

In EAL, enrollment-state gated observation writers. PRF has no observation writers — Reference-mode is write-silent at reducer boundary (red line #11 + I-WR-2). Therefore enrollment-state has no writer-level gate in PRF. This invariant is listed for completeness / contrast with EAL precedent.

---

## CI-grep enforcement sketch

```bash
#!/usr/bin/env bash
# scripts/check-refresher-writers.sh
# Asserts every write to userRefresherConfig / printBatches originates from the
# writers registry. Usage: run as a CI gate.

set -euo pipefail

# Allowed caller files (all writer entry points)
ALLOWED_FILES=(
  "src/utils/printableRefresher/writers.js"
  # test files are allowed
  "src/utils/printableRefresher/__tests__/writers.test.js"
  "src/utils/printableRefresher/__tests__/"  # directory pattern
)

# Find all put() / delete() calls against the two stores
violations=$(
  grep -rn -E "\.(put|delete)\s*\(\s*['\"](userRefresherConfig|printBatches)" \
    src/ \
    --include="*.js" --include="*.jsx" \
    | grep -vE "$(IFS='|'; echo "${ALLOWED_FILES[*]}")" \
    || true
)

if [[ -n "$violations" ]]; then
  echo "UNREGISTERED WRITERS DETECTED:"
  echo "$violations"
  echo ""
  echo "See: docs/projects/printable-refresher/WRITERS.md"
  exit 1
fi

# Secondary check: zero deletes on printBatches (I-WR-5 append-only)
delete_violations=$(
  grep -rn -E "\.delete\s*\(\s*['\"]printBatches" \
    src/ \
    --include="*.js" --include="*.jsx" \
    | grep -vE "src/__dev__/printBatchDeleter\.js" \
    || true
)

if [[ -n "$delete_violations" ]]; then
  echo "printBatches DELETE DETECTED (append-only — I-WR-5):"
  echo "$delete_violations"
  exit 1
fi

echo "Writer registry check: OK"
```

Hook into `scripts/smart-test-runner.sh` pre-check + CI pipeline. Mirror of `scripts/check-sidebar-writers.sh`.

---

## Relationship to content-drift CI (PRF-G4-CI)

Content-drift CI (sibling doc) enforces the **content** layer — that every card's manifest contentHash matches re-computation at build. WRITERS.md enforces the **write-path** layer — that every IDB write originates from this registry. The two layers are complementary:

- Content-drift CI catches: "card authored at v1.0 but its source-util changed; manifest not bumped; stale hash"
- Writers CI catches: "someone added a new place that writes to `userRefresherConfig` without registering"

Both layers run at build / CI. A PR that changes a card manifest AND adds an unregistered write fails both; they fail independently so diagnosis is quick.

---

## Relationship to selector library (PRF-G4-SL)

Selectors (`selectActiveCards` / `selectAllCards` / `selectPinnedCards` — sibling doc) are the **read-side** counterpart to writers. Together they complete the state-clear-asymmetry contract (R-8.1 inherited from SR-6):

- Writers write state deliberately + durably.
- Selectors read state with explicit filter contracts (active-only vs all-including-suppressed).
- The pair guarantees round-trip: a card suppressed via W-URC-2 + queried via `selectActiveCards` is absent; queried via `selectAllCards` with "show suppressed" is present with status annotation.

---

## Amendment rule

Adding a new writer requires **persona-level review** (same rule as anti-patterns.md + copy-discipline.md). Checklist:

1. Identify the store + field(s) the new writer owns.
2. Confirm no existing writer already owns those fields (I-WR-3 segregation).
3. Confirm the writer does NOT mutate skill-state stores under `currentIntent: 'Reference'` (I-WR-2).
4. If the writer triggers programmatically (not owner-initiated), confirm it does not violate red line #15 (no proactive print-output) or adjacent invariants.
5. Add entry to this doc with Purpose / Entry point / Fields written / Trigger / Failure mode / Autonomy contract subsections (mirror existing entries).
6. Add to `src/utils/printableRefresher/writers.js` frozen registry.
7. Update `scripts/check-refresher-writers.sh` ALLOWED_FILES if the writer lives outside the central writers.js.
8. Sign-off: owner + at least one Gate-2-voice equivalent.

---

## Change log

- **2026-04-24 — v1.0 shipped (Gate 4, Session 4).** 3 writers enumerated across 2 stores (W-URC-1 config-prefs / W-URC-2 card-visibility / W-URC-3 print-date-stamp). 7 cross-store invariants (I-WR-1 enumeration / I-WR-2 Reference-mode write-silence / I-WR-3 field-ownership segregation / I-WR-4 suppression durability / I-WR-5 printBatches append-only / I-WR-6 perCardSnapshots completeness / I-WR-7 enrollment-state N/A). CI-grep enforcement sketch authored. Amendment rule: persona-level review.
