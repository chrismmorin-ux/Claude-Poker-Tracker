# Contract — Persisted Hand Schema

**ID:** `persisted-hand-schema`
**Status:** ENFORCED BY CODE (validator exists); DOCUMENTED HERE 2026-04-21
**Scope:** shape of a hand record as stored in IDB `hands` store.
**Last reviewed:** 2026-04-21
**Surfaced:** [blind-spot audit 2026-04-21 table-view §D1](../audits/2026-04-21-blindspot-table-view.md)

---

## Why this contract matters

A hand record is written by **one** surface (TableView at hand-commit via ShowdownView) and read by **many** (HandReplayView, AnalysisView, export pipeline, stats recompute, villain profile builder). A silent shape change in the writer has blast radius across every reader, and migrations are irreversible once the data is stored.

The contract is already enforced by `src/utils/persistence/validation.js` at runtime. What was missing — and is fixed by this document — is the design-framework-visible record of:
- **which surfaces participate in the contract**
- **which fields are required vs optional**
- **where the contract has drifted historically** (dual-path fallbacks)
- **the protocol for changing the shape safely**

---

## Canonical shape

Authoritative shape lives in the Zod-style validator at `src/utils/persistence/validation.js:35-66` and the full scan of `handRecord` at the same file. A hand record is an object with at minimum:

```
{
  handId: string,                // primary key
  sessionId: string | null,
  createdAt: number,             // epoch ms

  gameState: {
    currentStreet: string,       // one of STREETS constant
    dealerButtonSeat: number,
    mySeat: number,
    // ... additional gameState fields enumerated in validation.js
  },

  cardState: {
    communityCards: string[5],   // must be length 5, '' for unknown
    holeCards: string[2],        // must be length 2
    allPlayerCards: { [seat: number]: string[2] },  // optional per seat
    holeCardsVisible: boolean,
  },

  seatPlayers: { [seat: number]: { playerId: string, ... } },
  actionSequence: ActionEntry[],   // see sequenceUtils.createActionEntry
  potInfo: { ... },
  blinds: { sb: number, bb: number, ante?: number, ... },
}
```

**Authoritative source:** `src/utils/persistence/validation.js` — if this doc and the validator disagree, the validator wins. This doc exists to make the shape findable from the design framework.

---

## Writers

| Writer | Entry point | When |
|--------|-------------|------|
| `ShowdownView` commit | `useSessionPersistence.saveHand()` | On "Next Hand" press in ShowdownView, after the action sequence has been committed via TableView → ShowdownView. |
| Import pipeline | `importAllData()` (via `SettingsView/DataAndAbout` or sidebar sync bridge) | On backup restore / online sync import. Must produce shape-conformant records. |
| Dev seeding | `src/__dev__/seedTestData.js` | Dev-only; should run the validator before insert. |

**No other surfaces write directly to the `hands` store.** Any new write path must go through the validator.

---

## Readers

| Reader | Entry point | Fields consumed |
|--------|-------------|-----------------|
| `HandReplayView` | `loadHandById()` → `buildTimeline()` | `gameState.*`, `cardState.*`, `seatPlayers`, `actionSequence`, `potInfo` |
| `AnalysisView/HandReviewPanel` | `loadHands()` via filters | same + `handId`, `sessionId`, `createdAt` |
| `AnalysisView/HandBrowser` | filter pass over hands list | `handId`, `sessionId`, `createdAt`, `gameState.currentStreet`, `seatPlayers` |
| Villain profile builder | `villainProfileBuilder.js` | `actionSequence`, `seatPlayers`, `gameState.dealerButtonSeat` |
| Stats pipeline | `usePlayerTendencies` + `analysisPipeline.js` | same as villain profile + showdown outcomes |
| Export | `exportUtils.downloadBackup()` | entire record as-is |

---

## Invariants

1. **`cardState.communityCards` is the canonical location for community cards.** Historical drift: some readers preserve a fallback to `gameState.communityCards` (see `HandReplayView/VillainAnalysisSection.jsx:40,46`). That fallback is **legacy** and should be removed once a migration pass verifies no old records rely on it.
2. **Array lengths are fixed** — `cardState.communityCards` is always length 5; `cardState.holeCards` is always length 2. Unknown cards are `''`, not absent.
3. **`seatPlayers` keys are numeric seats.** Validator enforces numeric conversion on read.
4. **`actionSequence` items conform to `createActionEntry` shape** from `sequenceUtils.js`. Reducer-emitted actions guarantee this; imports must validate.
5. **`handId` is unique within IDB `hands`** — primary key.

---

## Code enforcement

- **Writer-side:** `validateHandRecord(handRecord)` in `src/utils/persistence/validation.js`. All write paths must call this before `put()`.
- **Reader-side:** none today. Readers tolerate malformed records via defensive fallbacks (`|| []`, dual-path lookups). This is load-bearing for backward-compat but hides drift.
- **Test coverage:** `src/utils/persistence/__tests__/validation.test.js` covers the validator.

---

## Known drift

- **EVID-2026-04-21-HAND-SCHEMA-DUAL-PATH** (see `../evidence/LEDGER.md`): `HandReplayView/VillainAnalysisSection.jsx:40,46` reads `hand.cardState.communityCards || hand.gameState.communityCards`. Evidence that the shape migrated at least once without removing the fallback in every reader. Current production shape is `cardState.*`; `gameState.*` fallback is for legacy records.
- **Action entry shape** migrated during Analysis Quality Overhaul (Item 21) — `actionTypes.js` deleted, entries now via `sequenceUtils.createActionEntry`. Older records may have a slightly different action-entry shape; readers should be audited.

---

## Change protocol

To change this contract safely:

1. **Propose the change** in a design note linked from this file. Identify which fields change, the new canonical shape, and the migration story.
2. **Write a migration pass** that rewrites existing IDB records to the new shape in a single transaction.
3. **Update the validator** (`validation.js`) to accept the new shape. If breaking, bump IDB version.
4. **Update every reader** to the new shape. Remove dual-path fallbacks in the same commit.
5. **Update this document** to reflect the new canonical shape and append a "migrated" entry in the change log.
6. **Write a test** that fails if a fallback path is re-introduced. (Anti-drift gate.)

Skipping steps 3-4 is the failure mode that produces EVID-2026-04-21-HAND-SCHEMA-DUAL-PATH. Every step is mandatory.

---

## Relationship to `.claude/context/STATE_SCHEMA.md`

`STATE_SCHEMA.md` documents the **live reducer** shapes (game, card, ui, session, player, tendency, card, tournament). This contract is about the **persisted** shape — what gets written to IDB and therefore what downstream readers can rely on. They overlap (TableView's reducers produce the fields that get persisted) but serve different audiences:
- `STATE_SCHEMA.md` is for session developers working in reducers.
- This contract is for surface authors / audit owners who need to know what persisted hands look like.

Cross-reference both when writing a feature that crosses the reducer↔persistence boundary.

---

## Change log

- 2026-04-21 — Created. Authored from validator inspection. Documents the contract that was enforced in code but invisible to the design framework.
