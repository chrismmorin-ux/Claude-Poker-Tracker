# SIDEBAR_REBUILD_PROGRAM

**Status:** RESOLVED 2026-04-15 (SR-0 → SR-7a, 4 days, 19 commits).

## Trigger

Owner reported five recurring sidebar display defects (S1–S5) over ~3 weeks of
live play. Pattern: each defect, when fixed in isolation, returned in a
different surface a few days later. Indicated structural cause, not point bugs.

| ID | Symptom |
|----|---------|
| S1 | Seat map shows `$0` bets when villain bet a fractional amount |
| S2 | Range panel shows preflop advice while live context is on flop |
| S3 | Plan panel disappears mid-hand and stays gone |
| S4 | Between-hands banner pops over an active hand |
| S5 | Generalised panel churn / re-render storm under specific event sequences |

Sealed forensics at `.claude/projects/sidebar-rebuild/00-forensics.md`.

## Mechanical causes (M1–M8)

Decomposition of the 5 symptoms into 8 root mechanisms — each mechanism could
produce ≥1 of the symptoms and most produced several.

| # | Mechanism | Surface |
|---|-----------|---------|
| M1 | Null-check gap on `appSeatData[seat].amount` | S1 |
| M2 | Full-replace destroys partial-payload prior fields | S1, S5 |
| M3 | Two renderers own the main slot (race) | S3, S4 |
| M4 | Invariant violation logged but doesn't gate render | S2 |
| M5 | 1-street tolerance permits stale advice display | S2 |
| M6 | Auto-expand timer re-arms every render, never fires | S3 |
| M7 | `modeAExpired` flag never reset on new push | S4 |
| M8 | `classList.toggle` bypasses change-detection cycle | S5 |

## Program shape

Charter: spec-first 8-stage program, no code in stages 0–5, all code behind a
single `settings.sidebarRebuild` flag in stage 6, flip + delete in stage 7.

| Stage | Output | PRs |
|-------|--------|-----|
| SR-0 | Sealed symptom register + mechanism audit | — |
| SR-1 | Replay framework (13 deterministic S-signatures, `npm run replay`) | 1 |
| SR-2 | Doctrine v2 — 33 numbered rules at `docs/SIDEBAR_DESIGN_PRINCIPLES.md` | 1 |
| SR-3 | Inventory — 48 rows, 6 zone groups at `docs/SIDEBAR_PANEL_INVENTORY.md` | 1 |
| SR-4 | Specs — 49 spec rows across 6 batches in `docs/sidebar-specs/` | 6 |
| SR-5 | Architecture delta — 4 blocking deltas (B1–B4), 11 cross-cutting findings, 27/33 rule violations | 1 |
| SR-6 | Incremental rebuild — 17 PRs (6.1 foundation → 6.17 shell migration) | 17 |
| SR-7 | Cutover — flag delete, post-mortem (this file), doc hygiene | 3 |

Final metrics: 1795 → 1837 tests, 50 test files, 6 build entry points clean,
13/13 S-signatures deterministic, 4/4 blocking deltas closed, 10/11
cross-cutting findings resolved (one explicit keep), 8/8 mechanisms M1–M8
fixed with code citations.

## What worked

- **Replay corpus as regression baseline.** SR-1 captured 13 pre-fix snapshots
  that became the regression suite for every subsequent PR. Determinism check
  caught two architectural drifts during SR-6 that would have slipped through
  unit tests.
- **FSM authoring (SR-6.5).** Five declarative panel FSMs replaced 9 ad-hoc
  DOM-mutation sites. M3 (dual-owner race), M7 (state-not-reset), and M8
  (classList bypass) all closed via this single architectural change.
- **renderKey completion (SR-6.4).** Adding 4 missing fields to the render-key
  hash made coordinator skip-same-key reliable, which unlocked the rest of
  SR-6 to assume "scheduleRender always re-runs when state changes."
- **`computeAdviceStaleness` as single source of truth (SR-6.12).** Two render
  paths and one timer used to compute `Date.now() - _receivedAt` independently.
  Consolidating to one helper closed M4/M5 plus the R-7.3 doctrine rule in
  one stroke.
- **By-zone batching for SR-4.** Authoring 49 specs in 6 batches (one per
  zone) instead of one monolith kept owner reviews under 90 minutes each.

## What didn't land as designed

**The flag never gated anything.** Charter said: "ship dark behind
`settings.sidebarRebuild`, flip when safe." In practice SR-6.10–6.15 (the
zone PRs) edited render-orchestrator/render-street-card in place and never
introduced an `if (snap.settings?.sidebarRebuild)` branch. The flag flowed
into the renderKey hash so toggling forced a re-render — but the re-render
produced byte-identical output, so the toggle was a no-op.

This was caught by the pre-cutover audit (`07-pre-cutover-audit.md` Finding
0), not during SR-6. No user-visible harm, but the program's safety story
("we can flip back if it's bad") was notional. SR-7a deleted the flag
rather than flip-and-keep, since gating zero branches isn't worth the
cognitive overhead.

**Implication for next program:** either commit to real flag branching
with both paths under test (expensive — doubles the test matrix) or drop
the flag from the charter and rely on per-PR replay-corpus determinism
for safety (cheap — what we ended up doing). Don't keep the charter's
flag clause when the team isn't going to honor it.

## Doctrine rules that needed lint gates, not spot checks

Audit caveat C-4 surfaced 4 rules whose enforcement depended on spot-checks
during code review rather than automated gates. Two were addressed in SR-8
polish; two remain blocked on doctrine-metadata work:

| Rule | Status | Notes |
|------|--------|-------|
| R-2.3 (no DOM mutations outside FSM) | ✅ SR-8.2 | `dom-mutation-discipline.test.js` baseline-locks 23 sites across 3 files |
| R-7.2 (cross-panel invariant pre-dispatch) | ✅ SR-8.3 | `cross-panel-invariant-coverage.test.js` pins both layers (render gate + observability) |
| R-3.3 (tier preemption matrix) | 🚫 deferred | Needs per-spec `@tier:` metadata to enforce |
| R-5.2 (slot-owner module boundary) | 🚫 deferred | Needs per-slot `@owner:` metadata |

## Future-session guidance

When resuming sidebar work:

1. Read this file before opening any source. Mechanism inventory M1–M8 is
   the test set: any new sidebar bug should map to one (regression) or
   identify a new mechanism (extension).
2. Read `.claude/context/SYSTEM_MODEL.md` § sidebar — has the post-SR-7
   architecture: 6 zone containers, 5 FSMs, freshness sidecar pattern,
   `computeAdviceStaleness` as the stale-surface single source of truth.
3. Read `docs/SIDEBAR_DESIGN_PRINCIPLES.md` (33 rules, doctrine v2). Three
   rules have automated gates: R-2.3, R-7.2, RT-60 (timer discipline).
   The other 30 are spot-checked at PR review.
4. Use the replay framework: `npm run replay` in `ignition-poker-tracker/`
   produces deterministic hashes for 13 S-signatures. Add a new fixture
   to `side-panel/__tests__/fixtures.js` if your change exercises a new
   state shape — it auto-runs through null-safety + no-undefined-text
   assertions.

## Anti-patterns to avoid

- Patching a single panel's symptom without checking which mechanism (M1–M8)
  it derives from. Most surface bugs in this codebase have structural roots.
- Adding a new render-time DOM mutation outside an FSM transition handler.
  R-2.3's discipline test will block the PR; route through `coordinator.dispatch()`
  or schedule a render that emits the change idempotently in `renderAll`.
- Reading `chrome.storage.local` from a render function. Single-source-of-truth
  is `shared/settings.js` → coordinator snapshot. R-5.1.
- Computing `Date.now() - _receivedAt` inline. Always go through
  `computeAdviceStaleness`. R-7.2 / R-7.3.

## Related artifacts

- Charter: `C:\Users\chris\.claude\plans\composed-fluttering-snowflake.md`
- Forensics: `.claude/projects/sidebar-rebuild/00-forensics.md` (sealed)
- Architecture delta: `docs/sidebar-rebuild/05-architecture-delta.md`
- Pre-cutover audit: `.claude/projects/sidebar-rebuild/07-pre-cutover-audit.md`
- Doctrine: `docs/SIDEBAR_DESIGN_PRINCIPLES.md` (v2, 33 rules)
- Inventory: `docs/SIDEBAR_PANEL_INVENTORY.md` (48 rows)
- Specs: `docs/sidebar-specs/{z0,z1,z2,z3,z4,zx}.md` (49 specs)
- Per-stage handoffs: `.claude/handoffs/sr-*.md`
- Commits: `7b8889f` (Phase D close) → `830fd4f` (SR-6 squash) → `551e354`
  (SR-8 polish) → `8d026fe` (SR-7a flag delete) → this commit (SR-7b post-mortem)
