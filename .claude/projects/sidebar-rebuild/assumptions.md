# Sidebar Rebuild — Assumption Ledger

**Program:** SR-0 → SR-7
**Seeded:** 2026-04-12 (Stage 0)
**Source:** Master plan `C:\Users\chris\.claude\plans\composed-fluttering-snowflake.md` lines 48–62.

Every assumption below is flagged for empirical validation, not accepted. Before each subsequent stage begins, the session lead reviews this ledger for stale / falsified entries and amends before proceeding.

Each entry: **Assumption** | **Challenge** | **Falsification condition** (concrete signal that the assumption is wrong) | **Validation stage** | **Status**.

---

## A1 — "Rebuilding panel-by-panel is safe"

- **Challenge:** Panels share DOM slots; the rebuild target may be the *orchestrator*, not the panels.
- **Falsification:** SR-5 architecture audit finds ≥2 current panels whose FSMs require the same DOM slot with conflicting lifecycles, AND the current orchestrator has no mechanism to arbitrate. In that case, panel-by-panel rebuild is unsafe without an orchestrator change first.
- **Validates in:** SR-5.
- **Status:** OPEN.

## A2 — "The current render coordinator is sound, only consumers are broken"

- **Challenge:** Render-key fingerprint may itself be the churn source.
- **Falsification:** SR-1 corpus replay measurements show `renderAll()` firing for render-keys whose content hash is unchanged, OR firing at a rate >N per second without a corresponding state change. (Threshold set at start of SR-5.)
- **Validates in:** SR-5 (via SR-1 instrumentation).
- **Status:** OPEN. RT-43/44/54 partially addressed coarse fingerprint but did not eliminate churn per user report.

## A3 — "Fixing null-checks and timers is enough"

- **Challenge:** Architectural — two renderers for the same DOM — will re-introduce bugs regardless.
- **Falsification:** SR-3 inventory identifies any DOM slot with >1 owner (any code path that writes innerHTML, textContent, or classList to the same element from two modules). Per master plan forensics M3, at least one such slot exists (main content slot — `renderBetweenHands` + `renderStreetCard`). Already effectively falsified; entry remains so SR-3 produces the exhaustive list.
- **Validates in:** SR-3.
- **Status:** OPEN (pre-confirmed by M3).

## A4 — "Users can describe what they need"

- **Challenge:** Owner is non-technical; symptom reports are valid, prescriptions are not.
- **Falsification:** Any SR-4 spec that derives from "the user asked for feature X" rather than "this question needs to be answered because of decision Y" is a red flag. Spec review (SR-4 gate) rejects prescriptive inputs.
- **Validates in:** SR-4 per-spec gate.
- **Status:** OPEN; procedural.

## A5 — "Between-hands mode is a feature"

- **Challenge:** It may be interrupting a live hand because its activation criteria are wrong; deletion may be correct.
- **Falsification:** SR-3 Purpose Audit row for between-hands fails to articulate a question that cannot be answered by an existing panel, OR owner marks it `delete-candidate: yes`. In that case, rebuild work on between-hands is replaced by removal work.
- **Validates in:** SR-3.
- **Status:** OPEN.

## A6 — "The existing harness is a good starting point"

- **Challenge:** It's a visualization tool, not a test suite; keeping it may anchor us to the wrong paradigm.
- **Falsification:** SR-1 replayer cannot produce a DOM-mutation-log observation that the current harness already provides, OR SR-1 shows the harness's static fixtures cannot exercise M1/M3/M7 (already implied by master plan test-infra forensics). Retain harness for manual design review only; do not build new coverage on top of it.
- **Validates in:** SR-1.
- **Status:** OPEN (pre-confirmed by master plan).

## A7 — "Real Ignition traffic can be captured"

- **Challenge:** WebSocket interception lives in the content script; side-panel may not have access.
- **Falsification:** First SR-1 task (feasibility spike, 30 min) fails to export raw WS traffic to a file through any available channel (content script → background → file, or postMessage → side-panel → download). In that case, SR-1 pivots to instrumented synthetic generator producing partial/stale/out-of-order payloads matching real Ignition quirks; subsequent assumption A8 applies.
- **Validates in:** SR-1 feasibility spike.
- **Status:** FALSIFIED-BY-SCOPE (2026-04-12). Spike conclusion: raw WS capture is *technically* feasible via the existing MAIN-world probe (frames reach the ISOLATED world via `window.postMessage` with up to 16KB previews — `content/capture-websocket-probe.js:99-108`, consumed at `content/ignition-capture.js:331-365`), and a `RECORD=1` flag could dump JSONL. However, the SR-1 gate targets **side-panel render** symptoms (S1–S5), which are driven by SW→panel port messages (`push_exploits`, `push_action_advice`, `push_live_context`, `push_tournament`), not raw WS frames. Raw-WS replay would add the entire capture pipeline (probe + TableManager + HSM + SW relay) as an uncontrolled variable between the corpus and the observed symptom. Decision: SR-1 captures + replays **port-level messages** (the SW→side-panel boundary), synthetically generated and seeded from `shared/__tests__/fixtures/payloads.js` + `side-panel/__tests__/fixtures.js`. Raw-WS capture remains an option if SR-3/SR-5 require end-to-end validation. A8 is therefore **activated** (we are on the synthetic path) but at a higher boundary than originally framed — synthesis happens at port-message level, not WS-frame level, which is easier to make deterministic.

---

## Stage-1 contingency assumptions (activated only if A7 falsifies)

## A8 — "Synthetic traffic can mimic real Ignition quirks closely enough"

- **Activated if:** A7 is falsified.
- **Challenge:** A hand-crafted generator may not reproduce the event ordering / timing nondeterminism that causes real bugs (classic test-fixture failure mode — see master plan lines 28–31).
- **Falsification:** Synthetic corpus cannot reproduce ≥3 of S1–S4 deterministically in SR-1. In that case, corpus is inadequate and must be instrumented with real-session event-timing traces even if payloads are synthetic.
- **Validates in:** SR-1 gate (replayer reproduces ≥3 symptoms deterministically).
- **Status:** ACTIVATED 2026-04-12 (synthetic path chosen — see A7). Synthesis at port-message boundary not WS-frame boundary, reducing quirk-reproduction burden. Gate still applies.

## A6 amendment (2026-04-12)

A6 pre-confirmed falsified during SR-1 spike: the existing harness (`side-panel/harness/harness.js`) bypasses `side-panel.js` entirely and calls pure render functions on static state snapshots. It cannot exercise M3 (dual-slot-owner race), M6 (auto-expand freshness), or M7 (modeAExpired reset) because those live in side-panel orchestration, not pure renders. SR-1's replayer must load the real `side-panel.js` with a mock `chrome.runtime.connect` and pump port messages through it — this is a separate harness from the visual one, which is retained per plan for manual design review only.

---

## Ledger maintenance protocol

- **Before each stage:** session lead reads this file end-to-end. If any entry's status is `FALSIFIED` or `CONFIRMED`, amend before continuing.
- **During each stage:** new assumptions discovered get appended here with the same schema.
- **At SR-7 post-mortem:** every entry must have a terminal status (`CONFIRMED` / `FALSIFIED` / `INAPPLICABLE`).
