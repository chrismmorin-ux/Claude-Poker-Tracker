# SR-1 — Stage 1: Ground-Truth Replay Framework

**Program:** Sidebar Rebuild (master plan: `C:\Users\chris\.claude\plans\composed-fluttering-snowflake.md`)
**Prereq artifact:** `.claude/projects/sidebar-rebuild/00-forensics.md` (sealed 2026-04-12)
**Scope:** Tooling only. No changes to production render code. No "fixes" to M1–M8 in this stage.

---

## Objective

Build a deterministic WebSocket recorder + replayer + DOM observer that reproduces ≥3 of the Stage 0 symptoms (S1–S5) on demand, same mutation log every run. This is the regression harness every future SR-* stage depends on.

## Gate to SR-2 (non-negotiable)

Replayer reproduces ≥3 symptoms deterministically — a corpus replay run twice yields byte-identical DOM mutation logs, and the logs contain the expected symptom signature (e.g. `$0` bet in seat-arc innerHTML for S1).

---

## Work plan

### 1. Feasibility spike (≤30 min, first thing)

Decide real-capture vs synthetic before building anything else.

- Read `content/capture-websocket-probe.js` and `content/ignition-capture.js` — confirm they already intercept WS frames and the message shape.
- Confirm whether frames can be exported to a file (chrome.storage? downloads API? postMessage to devtools?).
- **Decision point:**
  - **Real capture feasible** → build recorder that piggybacks on existing probe; emits JSONL.
  - **Not feasible** → build synthetic generator seeded from `shared/__tests__/fixtures/payloads.js`, producing the partial/stale/out-of-order variants M1/M3/M7 require.
- Log the decision + rationale in `.claude/projects/sidebar-rebuild/assumptions.md`.

### 2. Recorder

Output: `ignition-poker-tracker/test/replay/recorder.js`

- Capture `{timestamp, direction, channel, payload}` tuples → JSONL.
- Sanitization pass: strip player handles/PIDs, keep structural shape, hand numbers, amounts, streets, seat indices.
- If real: wire into the WS probe behind a `RECORD=1` flag so production behaviour is unchanged when off.
- If synthetic: expose `generateCorpus({symptom: 'S1'|'S2'|'S3'|'S4'|'S5'})` producing JSONL matching the recorder schema.

### 3. Replayer

Output: `ignition-poker-tracker/test/replay/replayer.js`

- Reads a JSONL capture, feeds frames into the **real** `render-coordinator` inside a Playwright-driven headless Chromium with the extension loaded (or a harness page that wires the coordinator + side-panel modules to a mock chrome runtime).
- Timing-accurate: respect original `timestamp` deltas, with a `--speed` multiplier for CI.
- Deterministic: pin `Math.random`, `Date.now` via injected clock, disable animations that gate on `requestAnimationFrame` drift.
- No stubbing of `render-coordinator`, `side-panel.js`, `render-orchestrator.js`, `render-street-card.js` — the whole point is to exercise the real code.

### 4. DOM observer

Output: `ignition-poker-tracker/test/replay/dom-observer.js`

- `MutationObserver` on the side-panel root. Capture: `{t, target, type, attributeName?, oldValue?, addedNodes?, removedNodes?, innerHTMLHash?}`.
- Emit mutation log → JSONL per replay.
- Extract signatures for each symptom so tests can assert without string-matching brittle DOM:
  - **S1 signature:** any `seat-arc` subtree innerHTML contains `$0` badge token.
  - **S2 signature:** `plan-panel` rendered while `advice.street !== liveContext.street` (observer joins to frame timestamps).
  - **S3 signature:** `plan-panel` visible→hidden within Nms with no user event.
  - **S4 signature:** `between-hands` slot occupies main content during a `push_live_context` with new hand number.
  - **S5 signature:** count of mutations per logical state delta; threshold TBD from baseline.

### 5. Corpus

Output: `.claude/projects/sidebar-rebuild/corpus/`

- ≥5 labeled JSONL capture files.
- Each file targets ≥1 symptom from §2 of `00-forensics.md`. Labels in sibling `.yml`: `{symptomsTargeted: [S1,...], source: real|synthetic, sanitized: true, handCount, duration_ms}`.
- Two captures should include overlapping hand/street transitions to exercise M3 and M7 together.

### 6. Usage doc + CI entry

Output: `.claude/projects/sidebar-rebuild/01-replay-framework.md`

- How to record, how to replay, how to add a corpus entry, how to interpret mutation logs, how signatures map to symptoms, how determinism is validated (hash two consecutive runs' logs).
- A `npm run replay -- <corpus-file>` script in `ignition-poker-tracker/package.json`.
- Determinism self-test: `npm run replay:determinism` runs every corpus file twice and diffs logs; non-zero diff = fail.

---

## Files created (no production files modified)

```
ignition-poker-tracker/test/replay/
  recorder.js
  replayer.js
  dom-observer.js
  signatures.js            # S1–S5 signature matchers
  determinism.test.js
.claude/projects/sidebar-rebuild/
  corpus/
    <5+ files>.jsonl
    <5+ files>.yml
  01-replay-framework.md
  assumptions.md           # append feasibility-spike outcome
ignition-poker-tracker/package.json  # add replay scripts only
```

## Out of scope for SR-1 (do NOT do)

- Any change to `render-coordinator.js`, `side-panel.js`, `render-orchestrator.js`, `render-street-card.js`, `StateInvariantChecker`.
- Any fix for M1–M8. Replay *exposes* them; SR-6 fixes them.
- Rewriting the existing harness (`npm run harness`) — keep it; it stays as a manual visualization tool.
- Writing specs, FSMs, or design docs — those are SR-2 / SR-4.

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| WS probe can't export frames from content-script context | Feasibility spike is step 1; pivot to synthetic generator seeded from real-fixture shapes |
| Replay is non-deterministic under Playwright due to animation frames / timers | Inject fake clock + stub `requestAnimationFrame`; verify via determinism self-test; fail loud if hash diff |
| MutationObserver misses changes that happen inside a single microtask | Capture `innerHTML` snapshot hashes on every `renderAll` exit as supplement |
| Corpus leaks player handles | Sanitization is a mandatory step in the recorder, tested; lint pass rejects any corpus file whose payloads contain non-sanitized tokens |
| Scope creep — "while we're here, fix M1" | Explicit out-of-scope list above; gate review checks for production-file diffs and rejects |

## Verification (session-end checklist)

- [ ] Feasibility decision logged in `assumptions.md`
- [ ] Recorder + replayer + observer implemented
- [ ] ≥5 corpus files committed with labels
- [ ] `npm run replay:determinism` passes on all corpus files
- [ ] ≥3 of S1/S2/S3/S4/S5 produce their signature in a replay run — documented in `01-replay-framework.md`
- [ ] No diff in `render-coordinator.js`, `side-panel.js`, `render-orchestrator.js`, `render-street-card.js`, `state-invariants.js`
- [ ] Handoff written (`.claude/handoffs/sr-1-replay-framework.md`)
- [ ] BACKLOG SR-1 → COMPLETE; SR-2 → NEXT
