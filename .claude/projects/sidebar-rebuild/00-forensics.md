# Stage 0 — Forensics & Scope Freeze

**Program:** Sidebar Rebuild (SR-0 → SR-7)
**Master plan:** `C:\Users\chris\.claude\plans\composed-fluttering-snowflake.md`
**Date sealed:** 2026-04-12
**Status:** DRAFT — awaiting owner sign-off

---

## §1 Scope Freeze Statement

After owner sign-off, **the symptom register in §2 is frozen**. Stages SR-1 through SR-7 work only against symptoms listed here.

- A new user-reported symptom during SR-1+ is not accepted into the program until it is added to §2 with an ID, reproducible description, and mechanism link (or explicit `TBD`).
- A new mechanical cause discovered during replay (SR-1) is added to §3 and back-linked into §2 via the traceability matrix in §6.
- Prior-fix ledger rows in §4 are append-only; existing rows are not rewritten without an explicit amendment note.
- Closed RT-* items are NOT re-opened. If a closed fix is found to have regressed, a new symptom ID is created in §2 and the relevant §4 row gets an "outcome revised" annotation — the underlying RT-* stays closed.

Stage 0 makes no code changes. The artifact is this file plus `assumptions.md` and a handoff.

---

## §2 Symptom Register

All symptoms sourced from the master plan Context section. Each symptom ID is sealed.

| ID | User-visible symptom | Reproducible description | DOM slot(s) | Mechanism link (→ §3) | Affected files |
|----|----------------------|--------------------------|-------------|-----------------------|----------------|
| **S1** | Seat map shows `$0` bet sizes and churns through which seats display | Any hand where an exploit push arrives with a partial `appSeatData` payload (some seats' `amount` undefined or missing). Seat arc re-renders with `$0` badges. Rapid pushes cause the set of displayed seats to change visibly frame-to-frame. | `seat-arc`, seat badges inside arc | M1 (null-check gap), M2 (full-replace churn), M8 (classList.toggle bypass) | `render-orchestrator.js:1008-1074`, `side-panel.js:375` |
| **S2** | Range panel appears/disappears at wrong times; displays postflop hand classes preflop | On street transition, the advice payload's `street` lags the live context's `street` by one street. The 1-street tolerance gate permits render; range panel shows flop hand classes while the board is preflop (or vice versa). | `plan-panel`, range grid region | M4 (invariant logs, does not gate), M5 (1-street rank gap permitted) | `render-coordinator.js:429`, `lifecycle-invariants.test.js:127` |
| **S3** | Action advice disappears mid-hand without user action | Plan panel auto-expand timer fires on incoming advice; subsequent race between `renderBetweenHands` toggling the main slot and `renderStreetCard` toggling the same slot hides the advice before it is consumed. No user interaction. | `plan-panel`, `street-card`, main content slot | M3 (two renderers own same slot), M6 (auto-expand has no freshness guard), M8 | `side-panel.js:1099-1134`, `render-street-card.js:43-138`, `side-panel.js:1073-1079` |
| **S4** | "Table reads" / between-hands panel pops over active-hand information | `modeAExpired` timer on `renderBetweenHands` never resets when a new `push_live_context` starts a new hand; between-hands stays in the main slot until the original 10s timer elapses, stealing the slot during the opening of a fresh hand. | main content slot | M3, M7 (modeAExpired never reset on new push_live_context) | `render-coordinator.js:633`, `side-panel.js:1099-1134` |
| **S5** | Overall: panels shift so constantly the sidebar cannot be read or trusted | Aggregate effect of M1–M8. Every render pass that contains any state delta propagates to multiple panels simultaneously because render-key fingerprint is coarse and class toggles fire regardless of innerHTML equality. | entire sidebar | M2, M3, M8, and emergent interaction of M1–M7 | All of the above |

No orphan symptoms — every ID has at least one mechanism link.

---

## §3 Mechanism Catalog

Sourced from master plan lines 15–23 (session-confirmed code forensics). Not hypotheses.

| Mech | Description | Source file:line | Produces symptom(s) |
|------|-------------|------------------|---------------------|
| **M1** | `buildSeatArcHTML` has no null-check on `appSeatData[seat].amount` — renders `$0` on undefined/partial payloads | `render-orchestrator.js:1008-1074` | S1 |
| **M2** | `appSeatData` is *fully replaced* each exploit push — partial payloads silently corrupt display (no merge, no prior-value fallback) | `side-panel.js:375` | S1, S5 |
| **M3** | `renderBetweenHands` and `renderStreetCard` **both** toggle visibility of the main content slot independently in the same `renderAll()` pass — race, flicker, slot-theft | `side-panel.js:1099-1134`, `render-street-card.js:43-138` | S3, S4, S5 |
| **M4** | `StateInvariantChecker` Rule 3 detects advice-street vs context-street mismatch but **never blocks render** — invariant logs, does not gate | `lifecycle-invariants.test.js:127` | S2 |
| **M5** | Street rank gap up to 1 street is *permitted* → preflop-class advice can render during flop | `render-coordinator.js:429` | S2 |
| **M6** | Plan panel auto-expand timer has no freshness guard — expands stale advice | `side-panel.js:1073-1079` | S3 |
| **M7** | `modeAExpired` timer on between-hands is never reset on new `push_live_context` — once fired, between-hands stays up until 10s elapses even if a new hand starts | `render-coordinator.js:633` | S4 |
| **M8** | `classList.toggle()` calls bypass innerHTML change-detection (multiple sites) — DOM classes flip on every render even when content is identical | multiple sites (unenumerated) | S1, S3, S5 |

No orphan mechanisms — every M is linked to ≥1 symptom. All mechanisms have concrete file:line citations; none require reproduction in Stage 1 to confirm existence. (Stage 1 will confirm their observable effect under deterministic replay.)

---

## §4 Prior-Fix Ledger

Append-only record of every prior sidebar-related attempt. Pure forensics — no judgement. "Residual symptom" column flags which of S1–S5 the fix did NOT eliminate, where evidence exists.

### Phase C+D (2026-04-12)
| Ref | Attempt | Files | Targeted | Outcome | Residual |
|-----|---------|-------|----------|---------|----------|
| RT-48 / 0341328 | Stale-advice visual indicator (yellow border + "Stale Ns" badge) | `side-panel.js`, CSS | Surface stale advice instead of silently displaying | Shipped; indicator visible at 10s | S3 — indicates staleness but does not prevent display of wrong-street content (M4/M5) |
| RT-61 / 4cd9b18 | planPanel auto-expand routes through `scheduleRender`; renderPlanPanel sole writer | `side-panel.js` | Single-owner for plan-panel visual state | Shipped | S3 — addresses ownership of plan-panel specifically but main-slot race (M3) untouched; M6 freshness guard still absent |
| RT-66 / ddb3f77 | Surface state-invariant violations as red `!` badge; fix Rule 10 dead path | `state-invariants.js`, `render-coordinator.js`, `side-panel.js` | Make invariant violations visible | Shipped | S2 — violations surfaced, still not *gated* (M4 unchanged) |

### Phase C+D verified-done (2026-04-12)
| Ref | Attempt | Outcome |
|-----|---------|---------|
| RT-49 | Preserve section collapse state across innerHTML rebuilds | Verified in code |
| RT-50 | Cancel _transitionTimer on rapid street-card updates | Verified |
| RT-51 | Message-level integration test harness (29 tests) | Shipped — logic-only, does not catch M1/M3/M7 class |
| RT-52 | Tournament timer detached-DOM (mooted by RT-60) | Verified |
| RT-53 | `_contextStale` visual indicator | Verified |
| RT-55 | Remove dead panel render fns (+ bonus orphan cleanup under 792032c) | Shipped |

### Phase B (2026-04-12)
| Ref | Attempt | Files | Targeted | Outcome | Residual |
|-----|---------|-------|----------|---------|----------|
| RT-43 / f080ae8 | Unified render scheduler + renderKey content hashes (via 892452e earlier) | `render-coordinator.js` | "Sidebar shows wrong info for hand state" — coarse renderKey | Shipped; renderKey now includes `exploitPushCount`, `appSeatDataVersion`, `focusedVillainSeat`, community cards, advice fingerprint | S1/S5 partially — reduces redundant re-renders but does not fix null-bet (M1) or full-replace churn (M2) |
| RT-44 / f080ae8 | renderKey: seat hash, exploit content hash, villain ordering | (see RT-43) | — | Folded into RT-43 | — |
| RT-54 / f080ae8 | renderKey: community cards + villain profile | Folded into RT-43 via `appSeatDataVersion` | — | — | — |
| RT-45 / 598a930 | Advice guard with hand-number binding | `side-panel.js`, `render-coordinator.js` | SW cache replay of stale advice across hands | Shipped | S2 — only catches cross-hand replay; within-hand street-gap (M5) unchanged |
| RT-47 | Async/sync interleave in `handlePipelineStatus` | — | Audit was stale; verified snapshot-before-await | No code change | — |
| RT-58 / f12c6f4 | Delete dead render fns (`renderBriefingPanel`, `renderObservationPanel`, `.briefing-item` handler); fix diag-dump bare-var refs | `side-panel.js` | Reduce surface; stop `ReferenceError` in diagnostics | Shipped | — |
| RT-59 / 6bf2cf7 | Route pipeline-status liveContext through `handleLiveContext` | `side-panel.js` | Position-lock + `_receivedAt` + pending-advice promotion on both paths | Shipped | — |
| RT-60 / fb4803b | Coordinator timer registration contract (`registerTimer`/`clearTimer`/`clearAllTimers`/`onTableSwitch`) | `render-coordinator.js`, `side-panel.js` | Orphan-timer regressions incl. `planPanelAutoExpand` | Shipped | S4 — provides registration API; `modeAExpired` reset logic (M7) NOT implemented by this item |

### Phase A (2026-04-12)
| Ref | Attempt | Files | Targeted | Outcome | Residual |
|-----|---------|-------|----------|---------|----------|
| RT-46 | escapeHtml for PID | (already in place) | XSS | Verified | — |
| RT-56 | `_receivedAt` on pipeline_status path | (already in place) | Freshness | Verified | — |
| RT-57 / 4a2184a | escapeHtml tournament level/blind | `side-panel.js` | XSS | Shipped | — |
| RT-62 / 3bde19c | Zone 3 scary-runout card names (`scaryCardRanks`) | `gameTreeDepth2.js`, `gameTreeEvaluator.js`, `render-orchestrator.js` | Plan panel clarity | Shipped | — |
| RT-63 | Mode A fold-correctness coaching | — | Not-a-bug after verification (fold EV implicit 0) | No change | — |
| RT-64 / 5d4c84b | Multiway pot odds reference the bet hero faces | `render-orchestrator.js` (`findFacedBet`) | Wrong pot odds in multiway | Shipped | — |
| RT-65 / 4a2184a | validateMessage on ignition-capture port | `service-worker.js` | Hardening | Shipped | — |
| RT-67 / 0288fbf | Canonical STREET_RANK in shared/constants.js | `render-coordinator.js`, `state-invariants.js` | Drift | Shipped | — |

### Historical sidebar work (pre-RT era)
| Ref | Attempt | Residual |
|-----|---------|----------|
| 2599983 | Sidebar zone-bars, state invariants, render orchestrator expansion | S1–S5 all still reported |
| 2a6f550 | Sidebar stability — storage race, HUD visibility, preflop charts, villain equity | S1–S5 all still reported |
| 892452e | Unified sidebar render scheduler | S1–S5 all still reported; superseded/extended by RT-43 |
| d5badf9 | Temporal replay harness with telemetry and anomaly detection | Harness exists but is static; does not catch M1/M3/M7 (per master plan test-infra forensics) |
| 7b95764 | Eliminate sidebar render flooding — state-change gating + throttles | Reduces flood volume; does not remove M3 dual-owner root cause |
| 8941b01 | Resolve sidebar flashing, stale advice, DOM corruption | Earlier attempt at same symptom class; did not hold |
| c648dc2 | Sidebar seat positions, nav buttons, session display | Feature add, not stability fix |
| d22b89f | Collapsible sidebar, dynamic hand tracking, session integration | Feature add |

**Handoff forensic finding:** `.claude/handoffs/` contains only `pm-overhaul.md` and no sidebar handoff. Every prior sidebar session closed without leaving a handoff — a process failure independent of the code failures, and part of why fixes did not compound.

---

## §5 Open Mechanisms / TBD

All 8 mechanisms in §3 have file:line citations. None are hypothesis-only.

However, **observable behaviour** of each mechanism under live WebSocket traffic is not yet captured deterministically. Stage 1 (SR-1) must produce a replay artifact that:

- Reproduces S1 by replaying a partial `appSeatData` push → observing `$0` bets in the seat arc DOM (confirms M1 + M2).
- Reproduces S2 by replaying an advice payload with `advice.street` one rank behind `liveContext.street` → observing range grid render (confirms M4 + M5).
- Reproduces S3 by replaying a sequence that triggers both `renderBetweenHands` and `renderStreetCard` main-slot writes within the same `renderAll()` pass → observing slot-ownership conflict (confirms M3); and separately by replaying a new advice push with a then-stale auto-expand timer firing (confirms M6).
- Reproduces S4 by replaying a `push_live_context` for a new hand while `modeAExpired` is mid-countdown → observing between-hands panel persisting into the new hand (confirms M7).

Mechanisms without explicit enumeration in §3:

- **Enumerate all `classList.toggle` call sites in the sidebar** (M8). Master plan says "multiple sites"; Stage 1 should produce an exhaustive list so Stage 5 can decide orchestrator keep/refactor.
- **Plan-panel auto-expand freshness guard** (M6): is the guard truly absent, or weakly implemented? Replay test will confirm.

These are the only items carried forward to SR-1.

---

## §6 Symptom × Mechanism Traceability Matrix

Rows = symptoms. Columns = mechanisms. `X` = linked in §2/§3. Empty = no current link.

|      | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 |
|------|----|----|----|----|----|----|----|----|
| S1   | X  | X  |    |    |    |    |    | X  |
| S2   |    |    |    | X  | X  |    |    |    |
| S3   |    |    | X  |    |    | X  |    | X  |
| S4   |    |    | X  |    |    |    | X  |    |
| S5   |    | X  | X  |    |    |    |    | X  |

**Coverage gaps (for owner review):**
- Column M1 only touches S1. If the seat-arc null-bet bug manifests in any other visible way (e.g. popover), add that symptom.
- Column M5 (street-rank tolerance) only touches S2. If the 1-street gap produces any other visible artifact beyond the range grid, add that symptom.
- Row S5 is aggregate-only. If the owner can describe a *specific* churn artifact not already in S1–S4, it gets its own ID.

**No empty rows** (every symptom has ≥1 mechanism). **No empty columns** (every mechanism produces ≥1 symptom).

---

## Review checklist (self-check before submitting for owner sign-off)

- [x] All 5 user-reported symptoms from master plan Context have IDs (S1–S5)
- [x] All 8 mechanical causes from master plan lines 15–23 appear in §3
- [x] Every symptom has ≥1 mechanism link OR explicit `TBD`
- [x] Prior-fix ledger covers Phases A/B/C+D (≥25 of 59 archived RT-* items cited; non-sidebar items correctly omitted)
- [x] Traceability matrix has no empty rows and no empty columns
- [x] Out-of-scope items explicitly deferred to SR-1

Awaiting owner response: **approved** | **amend row X** | **add symptom Y**.
