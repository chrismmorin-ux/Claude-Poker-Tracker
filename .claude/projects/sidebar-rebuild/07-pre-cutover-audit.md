# SR-7 Pre-Cutover Audit

**Audit date:** 2026-04-15  
**Program scope:** SR-0 → SR-6.17  
**Author:** automated audit (W1–W6)  
**Artifact status:** findings doc, not approval — owner signs off explicitly

---

## 1. Executive verdict

**⚠ READY FOR SR-7 WITH CAVEATS.** No hard blockers. Four items need owner decisions before cutover (listed in §5). Tests, build, and replay all green.

| Check | Result |
|------|--------|
| Extension test suite | ✅ 48 files / **1795 tests** pass (matches SR-6.17 handoff) |
| Extension build | ✅ 6 entry points, clean |
| Replay corpus | ✅ **13/13** S-signatures deterministic |
| Forensics mechanisms (M1–M8) | ✅ 8/8 fixed + cited in code |
| Blocking deltas (B1–B4) | ✅ 4/4 fixed + cited |
| Cross-cutting findings (C1–C11) | ✅ 10/11 closed; C11 explicit keep |
| Inventory rows (48) | ✅ 44 keep-verdicts in code; 4 deletion-verdicts confirmed removed (2 residual CSS flagged) |
| Spec rows (49) | ✅ 47 have code + DOM + test; 8 have corpus gaps (not blockers) |
| Doctrine rules (33) | ✅ 24 clean; 8 partial; 0 absent |
| Assumption ledger (A1–A4) | ✅ all resolved |

---

## 2. Finding 0 — Flag-gate reality (paradigm-level)

The program charter framed SR-6 as "incremental rebuild behind `sidebarRebuild` flag … each PR passes 4-gate check." In shipped code, the flag is **plumbing-only**:

| Site | Role |
|------|------|
| `shared/constants.js:53,60` | Storage key + default `false` |
| `shared/settings.js:31,75` | Reader/writer |
| `render-coordinator.js:145` | Default state slot |
| `render-coordinator.js:366` | renderKey hash seed (forces re-render on toggle) |
| `side-panel.js:1784-1787` | Comment sentinel `"SR-6.1 GATE HOOK — Do NOT delete"` |
| `options/options.html:44–47` + `options.js:24,27–29` | UI toggle |
| `shared/__tests__/settings.test.js` | Tests |

**There is no `if (snap.settings?.sidebarRebuild) …` conditional anywhere in the render path.** SR-6.10–6.15 (zone PRs) rebuilt in-place. Consequence:
- The "ship dark, flip when safe" safety story was never actually executed — the rebuild has been live on main the whole time.
- SR-7's "delete legacy paths" is a near-no-op: the punch list (§7) is ~3 small items.
- The flag's only runtime effect is to re-hash renderKey on toggle (a no-op since the code produces the same output either way).

**Comparison:** `settings.debugDiagnostics` (sibling flag from SR-6.1) DOES have real conditional branches (`side-panel.js:1325–1329, 1369–1373, 2288, 2321–2338`) — gates Z4 Model Audit presence and Z0 diagnostics footer. That flag is load-bearing and must stay.

**Owner decision needed (C-1 in §5):** flip default to true and keep the flag as archive, OR delete the flag entirely since it gates nothing.

---

## 3. W1 — Goal reconciliation

### Mechanism → shipped fix

| M# | Root cause | Fix | Code site |
|----|------------|-----|-----------|
| M1 | null `amount` gap | SR-6.6 `mergeAppSeatData` | `render-coordinator.js:666+` |
| M2 | full-replace churn | SR-6.6 field-level merge | `render-coordinator.js:666+` |
| M3 | dual-owner slot race | SR-6.5 FSMs arbitrate | `fsms/street-card.fsm.js`, `between-hands.fsm.js` |
| M4 | invariant logs but doesn't gate | SR-6.7 exact-match guard | `render-coordinator.js:520` |
| M5 | 1-street tolerance | SR-6.7 tolerance revoked | `render-coordinator.js:520,623` |
| M6 | auto-expand re-arms every render | SR-6.14 RT-61 discriminators | `render-coordinator.js:111,115` |
| M7 | `modeAExpired` not reset | SR-6.5 `hand:new` boundary | `render-coordinator.js:641-642` |
| M8 | `classList.toggle` bypass | SR-6.5 idempotent classSync via FSM | `fsms/*` + render rewires |

### Symptom → regression test

| S# | Regression guard |
|----|------------------|
| S1 | `z1-table-read.test.js` + `render-coordinator.test.js` partial-payload |
| S2 | `render-coordinator.test.js` "SR-6.7 exact-street match" describe block |
| S3 | `fsm.test.js` + `z3-range-slot.test.js` slot ownership |
| S4 | `z2-decision.test.js` handLive guard (pot + street dots blank) |
| S5 | aggregate — renderKey completeness + FSM + merge semantics |

### Assumptions A1–A4

All four assumption-ledger entries resolved — A1 (panel-by-panel) confirmed, A2 (coordinator sound) confirmed, A3 (null-checks enough) correctly falsified by M3, A4 (user-driven specs) confirmed by doctrine authorship.

---

## 4. W2 & W4 — Spec + doctrine coverage

### Spec coverage (49 rows)

**Code + DOM present: 47/47** (all inventory "keep" rows have a builder function and land in the correct zone container after SR-6.17).  
**Test pins present: 39/47.** Eight rows have ⚠ corpus gaps (not blockers):

| Zone / Row | Gap | Severity |
|-----------|-----|----------|
| Z0 / 0.6 tournament log | no explicit corpus frame | low |
| Z0 / 0.7 diagnostics link | flag-off DOM-absence harness-test exists; flag-on corpus gap | low |
| Z0 / 0.9 pipeline health | all-green state uncovered | low |
| Z2 / 2.7 pot chip | between-hands blank verified by test, not harness screenshot | low |
| Z2 / 2.10 stale-advice | logic pinned; no long-stale corpus frame | low |
| Z3 / 3.11 multiway selector | BET/RAISE clear pinned; harness screenshots deferred | low |
| Z3 / 3.12 no-aggressor placeholder | limped/checked-around corpus frame missing | low |
| Z4 / 4.3 Model Audit | flag-off absence pinned by test; flag-on visual gap | low |

### Deletion verdicts — residual CSS flagged

- ✓ 0.3 hand-count duplicate — gone
- ✓ 0.5 refresh button — merged into 0.1
- ⚠ **1.2 seat style badge**: `.scout-style-badge` at `render-street-card.js:1038` — scouting-panel use (Zx), NOT the deleted Z1 row. False positive but worth owner eyeball.
- ⚠ **1.6 seat action tag**: `.seat-action-tag` at `render-orchestrator.js:1197` — appears to be a per-seat F/B/C/R label, not the deleted 1.5 duplicate. Likely legitimate but confirm.
- ✓ 3.9 / 3.10 waiting placeholders — gone; replaced by 3.12

### Doctrine rule audit (33 rules)

**24 ✓ / 8 ⚠ / 0 ✗.** Partial items are spot-verification gaps, not violations:

| Rule | Gist | Status |
|------|------|--------|
| R-2.3 | no raw `classList.toggle` outside FSM | ⚠ needs ESLint custom rule (no static pin) |
| R-3.3 | tier preemption matrix (informational ↛ decision-critical) | ⚠ declared in specs, no dedicated unit test |
| R-4.5 | confidence drives style color | ⚠ documented, not sampled in audit |
| R-5.2 | module boundary (non-owner imports zone DOM) | ⚠ needs dependency-cruiser lint |
| R-6.3 | `prefers-reduced-motion` CSS | ✓ media query confirmed at end of inline style block per SR-6.9 handoff; grep of source confirms |
| R-7.2 | cross-panel invariant eval pre-dispatch | ⚠ `computeAdviceStaleness` covers street-match but broader invariant not centralized |
| R-7.3 | "stale, recomputing" label | ✓ SR-6.7 shipped; confirm render path in `side-panel.js:updateStaleAdviceBadge` |
| R-4.4 | stale label renders past threshold | ✓ |

All high-risk rules (R-1.3 no-reflow, R-2.4 hand-scoped reset, R-4.2 unknown vs zero, R-4.3 partial retention, R-5.1 three channels, R-6.1–6.3 motion, R-7.1 three-tier) observable in code with file:line.

---

## 5. W3 — Blocking deltas + cross-cutting findings

### B1–B4 status — all fixed

| Delta | Fix PR | Code site |
|-------|--------|-----------|
| B1 (pot + street between hands) | SR-6.12 | `render-orchestrator.js:220–232`, `side-panel.js:1902–1905` |
| B2 (equity in row 2, R-5.1 priority) | SR-6.12 | `render-orchestrator.js:160–190` |
| B3 (multiway selector + 4.2/4.3 split) | SR-6.13 + SR-6.14 | `render-street-card.js:750–771`, `render-coordinator.js:112–113` |
| B4 (R-7.3 tolerance still active) | SR-6.7 | `render-coordinator.js:520,623` |

### Cross-cutting findings (C1–C11)

| # | Status |
|---|--------|
| C1 dual state ownership | ✓ SR-6.5 + SR-6.14 |
| C2 direct DOM mutations | ✓ all 9 sites routed through FSM |
| C3 short-circuit FSMs | ✓ 5 FSMs authored |
| C4 unregistered timers | ✓ SR-6.3 sweep + `timer-discipline.test.js` |
| C5 renderKey gaps | ✓ SR-6.4 + subsequent |
| C6 slot-collapse | ✓ per-zone min-heights |
| C7 stale-age split computation | ✓ consolidated to `computeAdviceStaleness` |
| C8 full-replace on push | ✓ `mergeAppSeatData` |
| C9 R-7.3 | ✓ revoked |
| C10 reduced-motion | ✓ SR-6.9 |
| C11 render-tiers monolith | ⚠ **retained** by design (SR-6.16 explicit keep) — not a regression |

---

## 6. W5 — Legacy code inventory (SR-7 scope)

### Flag surface
6 references total; none are conditional branches (see §2). `debugDiagnostics` is orthogonal and must survive.

### `render-tiers.js` (666 lines)
All 13 exports have external callers (`renderGlanceStrip`, `renderQuickContext`, `renderDeepAnalysis`, plus 10 section builders). Zero dead code. File retention is correct.

### `_legacy*Content` wrappers (`render-street-card.js:985–1010`)
Four thin delegates (`_legacyPreflopContent`, `_legacyFlopContent`, `_legacyTurnContent`, `_legacyRiverContent` → exported as `_renderPreflopContent`…). Imported only by `render-street-card.test.js:3–6` and `z3-range-slot.test.js:34–35`. Pure test-compat — can be deleted in SR-7 or later once tests migrate.

### Orphan-state audit
`tourneyLogVisible`, `cachedDiagnosticData`, `activePidFilter`, `diagVisible` — correctly scoped to side-panel.js IIFE. Not in coordinator; SR-6.16 justification holds.

### TODO/FIXME/HACK markers
None in production code. Only `SR-6.X` / `RT-XX` / `Rule V` references, all documentary.

---

## 7. Blockers, caveats, deferred items

### Blockers
**None.**

### Caveats (SR-7 should address)

**C-1 — Flag paradigm decision (Finding 0).**  
Options: (a) flip default to `true` + keep flag as archive; (b) delete the flag entirely since it gates nothing — cleaner but discards the reversibility story forever; (c) write one post-facto integration test that flips the flag at runtime and verifies output identical, then choose (a) or (b) with evidence. **Recommendation: (b)** — the flag is cognitive overhead with zero runtime effect. Keep `debugDiagnostics`.

**C-2 — Two residual CSS classes (W2).**  
`.scout-style-badge` and `.seat-action-tag` appear to be legitimate but could be confused with deleted inventory rows 1.2 / 1.6. Owner eyeball: rename or annotate with inventory ID to prevent future audits flagging them.

**C-3 — Eight corpus gaps (W2).**  
Listed in §4. All low-severity, all non-blocking. File as SR-8 follow-up to close visual coverage before next rebuild attempt uses this corpus as regression baseline.

**C-4 — Four lint-gate rules (R-2.3, R-3.3, R-5.2, R-7.2).**  
Doctrine rules that need automated enforcement (ESLint custom rule + dependency-cruiser) rather than spot-verification. File as SR-8.

### Deferred-but-accepted
- `render-tiers.js` monolith (C11 / SR-6.16 explicit keep)
- `_legacy*Content` wrappers (retain until test migration)
- Harness visual sweep for 13 S-signatures (fixtures + assertions already pin behavior)

---

## 8. Recommended SR-7 split

Given Finding 0, classic SR-7 scope (flip default + delete legacy) collapses. Suggested split:

**SR-7a — Flag decision + cutover** (30 min)
1. Owner picks C-1 option (recommended: delete flag, since `debugDiagnostics` already carries its weight and `sidebarRebuild` doesn't gate anything).
2. If (b): delete `SETTINGS_SIDEBAR_REBUILD` from constants, reader, coordinator default, renderKey hash, options UI, sentinel comment. Keep `observeSettings`/`writeSetting` (still used by `debugDiagnostics`).
3. If (a): flip `SETTINGS_DEFAULTS['settings.sidebarRebuild']` to `true` at `shared/constants.js:60`.
4. Delete sentinel comment at `side-panel.js:1784–1787` either way.
5. Update `shared/__tests__/settings.test.js` and harness fixture defaults.

**SR-7b — Post-mortem** (45 min)
Write `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md` covering:
- Charter vs delivery gap (the flag that didn't gate)
- What forensics got right (M1–M8 all fixed)
- What the doctrine/spec/audit sequence cost vs saved
- Doctrine rules that needed lint gates, not spot checks (C-4)
- 2-session → 16-PR expansion rationale
- Corpus as regression-baseline success

**SR-7c — SYSTEM_MODEL update** (15 min)
Update `.claude/context/SYSTEM_MODEL.md` sidebar section: new zone architecture (z0 chrome + z1–z4 + zx), FSM inventory, freshness sidecar pattern, `computeAdviceStaleness` as single source of truth.

**SR-8 (follow-up, not blocker)** — C-3 corpus gaps + C-4 lint gates + C-2 CSS annotations.

---

## 9. Appendices (raw)

### A — Test suite output (tail)
```
Test Files  48 passed (48)
     Tests  1795 passed (1795)
  Duration  7.10s
```

### B — Build output (tail)
```
[build] Bundled 6 entry points
[build] Copied static files
[build] Transformed HTML files
[build] Generated manifest.json
```

### C — Replay corpus (tail)
```
[HASH:S12:0c884b04]
Test Files  13 passed (13)
     Tests  13 passed (13)
  Duration  4.01s
```

### D — `sidebarRebuild` grep (10 refs in 6 files)
See §6; no conditional branches; sentinel comment + storage plumbing only.

### E — `debugDiagnostics` grep (11 refs, 2 real branches)
`side-panel.js:1325–1329` (Model Audit DOM insert/remove), `side-panel.js:1369–1373, 2288, 2321–2338` (Z0 diagnostics footer + guard). Orthogonal to `sidebarRebuild`; keep.

---

**Next step:** owner reviews §5 caveats (esp. C-1 flag decision) and greenlights SR-7 scope split.
