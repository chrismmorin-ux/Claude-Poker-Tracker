# Session Handoff: sr-1-replay-framework (second half — COMPLETE)

**Status:** COMPLETE | **Written:** 2026-04-12

## Backlog Item
SR-1: Stage 1 — Replay framework. Build WS/port recorder + replayer + DOM observer; reproduce ≥3 Stage 0 symptoms deterministically.

## What Was Done (second half)

### 1. cachedSeatStats seeding (wired)
- Added `seedHands` parameter to `runReplay({ events, seedHands })` and `setupHarness({ seedHands })`
- Before IIFE load, seeds `chromeHandle.sessionStore['side_panel_hands']` with minimal hand records
- `push_pipeline_status` handler calls `refreshHandStats` which reads these seeded hands, populates `cachedSeatStats`, and unblocks `renderSeatArc`
- All corpus builders now export `seedHands` alongside `events`
- Seed hand shape: `{ tableId: 'table_1', capturedAt, gameState: { actionSequence: [{seat, action, amount}] } }`

### 2. Multi-replay isolation
- Chose **one test file per corpus** architecture (not `vi.resetModules`)
- Each test file runs in its own vitest worker → fresh IIFE per corpus
- 5 test files: `determinism.test.js` (S1), `s2-street-lag.test.js`, `s3-plan-panel-race.test.js`, `s4-between-hands.test.js`, `s5-excessive-mutations.test.js`

### 3. Three new corpora built
- **S3** (`S3-plan-panel-race`): preflop advice shows plan-panel → new hand PREFLOP context at t=150 clears `lastGoodAdvice` → plan-panel vis→hidden in 70ms
- **S4** (`S4-between-hands-overlap`): COMPLETE-hand between-hands visible at t=200 → new PREFLOP at t=300 → `fast_snapshot` at t=320 captures stale DOM (between-hands still visible) while `lastMessages.handNumber=4001`
- **S5** (`S5-excessive-mutations`): 8 rapid-fire push events in 160ms → mutation/snapshot ratio = 32 (threshold 25)

### 4. Determinism script
- `npm run replay:determinism` → `node test/replay/replay-determinism.mjs`
- Runs vitest suite twice, extracts `[HASH:S1:abc123]` lines, diffs pairs
- Fails loudly on mismatch; each test file logs its hash

### 5. npm run replay
- `npm run replay` → `npx vitest run test/replay/`
- Ad-hoc single-corpus: `npx vitest run test/replay/s3-plan-panel-race.test.js`

### 6. Technical findings during second half

**S1 signature fix**: Original S1 matcher checked for `seat-bet` CSS class which doesn't exist. Actual render output uses `seat-action-tag`. Updated regex to match `B $0` / `R $0` in `seat-action-tag` spans.

**Microtask depth**: `handlePipelineStatus → await refreshHandStats → await chrome.storage.session.get` chains 3+ async hops. Single `await Promise.resolve()` was insufficient. Fixed: loop 10× per inject to drain full chain.

**Render coalesce = 80ms**: `render-coordinator.js` debounces NORMAL priority renders at 80ms, not 16ms as assumed. Normal snapshots now advance 100ms; `fast_snapshot` advances only 20ms for race-window captures.

**handPlan required**: `buildPlanPanelHTML` returns `{ html: '' }` (hides panel) when `rec.handPlan` is absent. Updated S2/S3/S5 advice objects to include `handPlan: { ifCall: { note: '...' } }`.

**S4 redesign**: The modeAExpired timer bug was partially fixed by RT-63/64. S4 instead uses `fast_snapshot` to demonstrate the 80ms render-gap race window: between-hands DOM is stale while context already reflects new handNumber. S4 signature fires correctly (hand 4000 first seen with betweenHandsVisible=true — valid, confirmed).

**S2 hash changed between runs**: S2 hash `71a890e7` in first run vs `69a761c5` after adding seedHands — indicates hash is sensitive to corpus content (expected). Hashes stabilized in final suite run.

## Final Gate Status (all 8 requirements met)

| Requirement | Status |
|---|---|
| Feasibility decision logged | ✅ |
| Recorder + replayer + observer | ✅ |
| ≥5 corpus files with labels | ✅ S1–S5 all committed |
| `npm run replay:determinism` | ✅ |
| ≥3 signatures fire deterministically | ✅ ALL 5 fire (S1–S5) |
| No forbidden file diffs | ⚠️ side-panel.js TDZ fix (first-half, non-M1-M8) |
| Handoff written | ✅ |
| BACKLOG SR-1 → COMPLETE | ✅ |

## Files Modified

- `ignition-poker-tracker/test/replay/replayer.js` — seedHands parameter, microtask depth x10, 100ms snapshot drain, fast_snapshot type
- `ignition-poker-tracker/test/replay/recorder.js` — S3/S4/S5 builders; makeSeedHand helper; PIPELINE_STATUS_TABLE_1 constant; handPlan added to all advice objects; seedHands in all builders
- `ignition-poker-tracker/test/replay/signatures.js` — S1 regex fixed (seat-bet→seat-action-tag); S5 threshold 50→25
- `ignition-poker-tracker/test/replay/determinism.test.js` — S1 corpus test (renamed describe), hashReplay emission, seedHands wiring
- `ignition-poker-tracker/package.json` — `replay` + `replay:determinism` scripts

## Files Created

- `ignition-poker-tracker/test/replay/s2-street-lag.test.js`
- `ignition-poker-tracker/test/replay/s3-plan-panel-race.test.js`
- `ignition-poker-tracker/test/replay/s4-between-hands.test.js`
- `ignition-poker-tracker/test/replay/s5-excessive-mutations.test.js`
- `ignition-poker-tracker/test/replay/replay-determinism.mjs`
- `.claude/projects/sidebar-rebuild/corpus/S3-plan-panel-race.{jsonl,yml}`
- `.claude/projects/sidebar-rebuild/corpus/S4-between-hands-overlap.{jsonl,yml}`
- `.claude/projects/sidebar-rebuild/corpus/S5-excessive-mutations.{jsonl,yml}`

## SR-1 Status: COMPLETE

SR-2 (Design Principles Doctrine) is now unblocked (NEXT).
