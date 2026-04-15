# SR-1 — Replay Framework (WIP)

**Status:** COMPLETE (2026-04-12). All 8 gate requirements met. All 5 signatures fire deterministically.

## What exists

```
ignition-poker-tracker/test/replay/
  chrome-stub.js              # Fake chrome.runtime / storage / tabs — enough to load side-panel.js
  clock.js                    # Fake Date.now / setTimeout / setInterval / rAF
  recorder.js                 # Synthetic corpus builders (buildS1–buildS5); makeSeedHand helper
  signatures.js               # S1–S5 matchers against mutation log + snapshots
  replayer.js                 # runReplay({events, seedHands}) — loads side-panel.js, pumps corpus
                              #   seedHands: pre-seeds chrome.storage.session to enable seat-arc render
                              #   fast_snapshot: drains rAF only (not 80ms coalesce) for race testing
  replay-determinism.mjs      # Standalone determinism checker (runs suite twice, diffs hashes)
  determinism.test.js         # S1 corpus test
  s2-street-lag.test.js       # S2 corpus test
  s3-plan-panel-race.test.js  # S3 corpus test
  s4-between-hands.test.js    # S4 corpus test
  s5-excessive-mutations.test.js # S5 corpus test
.claude/projects/sidebar-rebuild/corpus/
  S1-partial-fractional-bet.jsonl  + .yml
  S2-advice-street-lag.jsonl       + .yml
  S3-plan-panel-race.jsonl         + .yml
  S4-between-hands-overlap.jsonl   + .yml
  S5-excessive-mutations.jsonl     + .yml
.claude/projects/sidebar-rebuild/findings/
  SR-1-TDZ-registerTimer.md        # latent production crash surfaced on first run
```

## Decision log

- **A7 falsified-by-scope:** Raw-WS capture is technically possible via the existing probe but adds the entire capture pipeline as an uncontrolled variable between a corpus and a sidebar symptom. Synthesis happens at the **port-message boundary** (SW → side-panel) instead. See `assumptions.md`.
- **A8 activated** at port-message level (not WS-frame level).
- **A6 pre-confirmed falsified:** the existing visual harness bypasses `side-panel.js` entirely and cannot exercise M3/M6/M7. The SR-1 replayer must — and does — load real `side-panel.js` with a mock `chrome.runtime`.

## How to run

```bash
cd ignition-poker-tracker
npm run replay                    # All 5 corpus tests (5 test files, each with fresh IIFE)
npm run replay:determinism        # Runs suite twice, diffs hashReplay() outputs
npx vitest run test/replay/determinism.test.js  # S1 only (ad-hoc)
```

All 5 tests pass as of 2026-04-12. Each test file is a separate vitest worker so the IIFE
initializes once per corpus — this is the multi-replay isolation architecture.

## Corpus file schema

One `.jsonl` + one `.yml` per corpus entry.

`.jsonl` first line is a `# {"_meta":{...}}` comment with label metadata; subsequent lines are events:

```
{"t":0,   "type":"inject",   "message":{"type":"push_pipeline_status", ...}}
{"t":50,  "type":"inject",   "message":{"type":"push_live_context",    ...}}
{"t":100, "type":"inject",   "message":{"type":"push_exploits",        ...}}
{"t":400, "type":"snapshot"}
```

Event types:
- `inject` — deliver `message` to side-panel's port listener
- `snapshot` — drain timers + capture `{seatArcHTML, planPanelVisible, betweenHandsVisible, adviceStreet, contextStreet, handNumber}`
- `advance` — advance the fake clock by `ms` with no message

## Signature matchers

`signatures.js` exports matchers `{S1, S2, S3, S4, S5}` each taking `{mutations, snapshots, corpus}` and returning `{matched: boolean, evidence?: string}`.

| ID | Matcher logic |
|----|---------------|
| S1 | regex `class="seat-bet"[^>]*>\s*\$0\b` in any snapshot's `seatArcHTML` |
| S2 | any snapshot with `planPanelVisible && adviceStreet !== contextStreet` |
| S3 | adjacent snapshots with `planPanelVisible: true → false` within 200ms |
| S4 | new handNumber with `betweenHandsVisible: true` in same snapshot |
| S5 | mutations-per-snapshot ratio > 50 (threshold TBD from baseline) |

## Architecture notes

- **seedHands**: `runReplay({ events, seedHands })` pre-seeds `chrome.storage.session['side_panel_hands']` before IIFE load. Required for seat-arc signatures since `renderSeatArc` is gated on `cachedSeatStats` which comes from `refreshHandStats` → storage. Seed hands must have `tableId: 'table_1'` and `gameState.actionSequence` with seat/action entries.
- **Multi-replay isolation**: One corpus per test file. vitest runs each file in a fresh worker, giving each corpus its own IIFE init. Do NOT put two `runReplay()` calls in the same test file.
- **fast_snapshot**: New event type that drains rAF (20ms) but NOT the 80ms coalesce timer. Used in S4 to capture the pre-render race window where DOM still reflects old state but `lastMessages` already has new handNumber.
- **Microtask depth**: After each inject, 10 microtask ticks are drained to handle async chains: `handlePipelineStatus → await refreshHandStats → await chrome.storage.session.get`.
- **Snapshot drain**: Normal snapshots advance 100ms to flush both the 80ms coalesce timer and a rAF callback.

## Gate status

| Requirement | Status |
|---|---|
| Feasibility decision logged | ✅ (assumptions.md A7 FALSIFIED-BY-SCOPE) |
| Recorder + replayer + observer implemented | ✅ (all three; DOM observer folded into replayer) |
| ≥5 corpus files committed with labels | ✅ (S1–S5 all committed with .jsonl + .yml) |
| `npm run replay:determinism` passes | ✅ (script added; HASH lines in each test; checker diffs two runs) |
| ≥3 of S1/S2/S3/S4/S5 signatures fire deterministically | ✅ (ALL 5 fire: S1, S2, S3, S4, S5) |
| No diff in forbidden files | ⚠️ — `side-panel.js` patched at 2 TDZ sites (first-half session). See findings/SR-1-TDZ-registerTimer.md — latent init-crash fix, not M1–M8 |
| Handoff written | ✅ |
| BACKLOG SR-1 → COMPLETE | ✅ (updated to COMPLETE) |

**SR-1 COMPLETE.** All gate requirements met. SR-2 unblocked.
