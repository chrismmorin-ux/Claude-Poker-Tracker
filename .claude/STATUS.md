# Project Status

Last updated: 2026-04-20 by Claude (**Line Study PROJECT COMPLETE** — all 6 phases shipped in one day. 8 lines (5 HU + 3 MW, 85+ nodes), 6 MW lessons, 7 MW frameworks, SPI engine, branching DAG UI with retry-from-node, persistence, 200/200 postflop drill tests green. Unblocks RT-92 (drills-consolidation gating item).).

---

## Active Sessions

_None — Line Study closed 2026-04-20._

## Recently Completed

- **Sidebar Trust Program phase 2 (STP-1) — CLOSED 2026-04-16.** Five stages shipped as one bundle after production surfaced a "213 state invariant violations in 30s" badge that the prior audit (SRT-1/SRT-2) had missed. Rolling-30s violation counter replaces the lifetime accumulator (badge tooltip finally matches the number), 4 new doctrine rules added (R-7.3 observability honesty, R-7.4 observability completeness, R-8.1 state-clear symmetry, R-10.1 payload-level invariants), 11 state-clear asymmetries fixed in `clearForTableSwitch` behind a new `STATE_FIELD_SCOPES.md` registry, 4 audit primitives landed (`lifecycle-soak`, `rendered-text-contract`, `diagnostics-dump`, `payload-fuzz`), 2 new coordinator invariants (R11 seat-disjoint, R12 hero-in-set) with matching `validateLiveContext` topology checks. System-model §4.1 extended with I-OBS-HONEST / I-OBS-COMPLETE / I-STATE-SYM / I-INV-PAYLOAD; §4.2 renamed to "Sidebar Failure Modes" with new entry linking `.claude/failures/STATE_CLEAR_ASYMMETRY.md`. Extension test suite 1,897 → 1,974 (+77). Build clean (6 entry points). Plan: `C:\Users\chris\.claude\plans\cryptic-booping-yao.md`.

- **Player Entry Overhaul (PEO) — Program CLOSED 2026-04-16.** Four sessions shipped in one day. Full post-mortem at `.claude/projects/player-entry-overhaul.md`. Feature: right-click seat → fullscreen Player Picker (live name+characteristic filter, recognition-first cards, batch mode) → pick existing (auto retro-link with undo) or Create new → fullscreen Player Editor (non-blocking form, custom SVG feature-avatar builder, draft autosave, auto-name fallback). IDB v14 with `playerDrafts` store, `avatarFeatures` on Player, invariants I-PEO-1..4. 2 new SCREEN routes, 25 new components, 8 new hooks, ~200 net new tests. Baseline 5,422 → final 5,623 (end-state includes deletion of legacy PlayerForm tests).

- **PEO-4 — Cutover + Cleanup (2026-04-16)** — Migrated `PlayersView` to route to `PlayerEditorView` via `openPlayerEditor`; seat-grid selection threads into `editorContext.seatContext`. Deleted `src/components/ui/PlayerForm/` directory (7 files). Removed `pendingSeatForPlayerAssignment` field + `SET_PENDING_SEAT_FOR_PLAYER` action from `uiReducer`, UIContext exposure, and TableView destructure. Updated PlayersView tests (asserts `openPlayerEditor` shape instead of modal). Schema-drift version tests kept passing.

- **PEO-3 — Fullscreen Player Picker + Feature Live (2026-04-16)** — `SCREEN.PLAYER_PICKER` route with autofocused name search, inline expandable feature-chip panels (Skin/Hair/Beard/Glasses/Hat), recognition-first `ResultCard` (avatar-left, bolded name prefix, faded non-matching features, gold left-border accent on full match), sticky `CreateFromQueryCTA` that seeds the editor. Batch-mode state machine (D9) with seat-progress ribbon. `SeatContextMenu` gains "🔍 Find Player…" + reroutes "Create New Player" to `PlayerEditorView`. On pick: auto assign + retro-link + undo toast. `usePlayerPicker` hook + `scorePlayerMatch` primitive from `usePlayerFiltering`. **Feature goes live.** ~60 new tests; 5,699 → 5,760 passing. Handoff: `.claude/handoffs/peo-3-picker-view.md`.

- **PEO-2 — Fullscreen Player Editor (2026-04-16)** — New `SCREEN.PLAYER_EDITOR` route with non-blocking form: `AvatarFeatureBuilder` (tap-swatch per category, live preview, hair/beard-color rows hide when style is "none"), `NameSection` with non-blocking duplicate warning, collapsible `PhysicalSection` + `ImageUploadSection`, `DraftResumeBanner` on mount, `BackToTableBar` with autosave flush. `usePlayerEditor` hook orchestrates draft binding + autoName fallback (user → seat+feature → timestamp) + atomic save. On save with seatContext: auto-assigns seat + fires `linkPlayerToPriorHandsInSession` with undo toast. Dark merge — no entry points wired (PEO-3 will wire SeatContextMenu + picker CreateFromQueryCTA). ~55 new tests; 5,644 → 5,699 passing. Handoff: `.claude/handoffs/peo-2-editor-view.md`.

- **PEO-1 — Data Layer + Avatar System (2026-04-16)** — Dark-merge infrastructure for Player Entry Overhaul. IDB v13 → v14 migration (additive-only, new `playerDrafts` store keyed by userId). `avatarFeatures` sub-object + `nameSource` added to Player schema (both optional/nullable on legacy records). Custom SVG feature-avatar system with 6 categories (`src/assets/avatarFeatures/`) + `AvatarRenderer` + `AvatarMonogram` + `PlayerAvatar` wrapper. Pure `linkPlayerToPriorSeatHands()` with session-scoped walk + boundary stops + idempotence + undo tokens. Atomic `batchUpdateSeatPlayers` and `commitDraft` (single IDB transaction each). Three new hooks: `usePlayerDraft` (debounced autosave), `useRetroactiveLinking` (link + undo flow), `useScreenFocusManagement` (fullscreen-route focus lifecycle). Invariants I-PEO-1..4 added. ~220 new tests; suite 5,422 → 5,644 passing. Handoff: `.claude/handoffs/peo-1-data-layer.md`. Charter: `.claude/projects/player-entry-overhaul.md`.

## Recently Completed

- **Sidebar Rebuild Program CLOSED — 2026-04-15** (SR-0 → SR-7, 4 days, 19 commits). Decomposed 5 recurring user-reported symptoms (S1–S5) into 8 root mechanisms (M1–M8), shipped doctrine v2 (33 rules at `docs/SIDEBAR_DESIGN_PRINCIPLES.md`), 6-zone architecture, 5 declarative FSMs, freshness sidecar, `computeAdviceStaleness` as single source of truth for stale surface. 4/4 blocking deltas closed, 8/8 mechanisms fixed with code citations, 3 doctrine rules now under automated lint gates (R-2.3, RT-60, R-7.2). Final state: 1837 extension tests, 50 test files, 13/13 replay signatures deterministic. **Post-mortem:** `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md`. **Pre-cutover audit:** `.claude/projects/sidebar-rebuild/07-pre-cutover-audit.md`. Per-stage handoffs retained at `.claude/handoffs/sr-*.md`.

- **Phase C + D — 2026-04-12:** 9 items closed plus orphan-panel cleanup. RT-48 stale-advice indicator. RT-61 plan-panel auto-expand routes through scheduleRender. RT-66 invariant violations surface via badge.
- **Phase B — 2026-04-12:** 8 items closed (RT-43/44/45/47/54/58/59/60). renderKey fingerprinting + dual-state convergence + advice hand-number binding + timer registration contract.
- **Phase A — 2026-04-12:** 8 items closed (RT-46/56/57/62–67). Tournament XSS, scary card ranks, multiway pot odds, capture-port validateMessage, canonical STREET_RANK.

---

## Pending Review

**14 items from 2026-04-20 Drills Consolidation Roundtable (RT-92..RT-105).** Severity breakdown: 4× P1, 6× P2, 4× P3. Top-priority blockers (P1): RT-92 (gate Phase 1 on Line Study closure), RT-93 (fix 7 design-doc defects including phantom `ViewRouter.jsx` reference, incomplete file-move tally, and 2× effort underestimate), RT-94 (create `src/components/_shared/drillInternals/` barrel before consolidation), RT-95 (resolve pre-existing INV-08 violation at `lessons.test.js`). Proposal `docs/projects/drills-consolidation.project.md` HELD pending owner approval of these. See BACKLOG.md § "REVIEW — Drills Consolidation Roundtable (2026-04-20)".

---

## Alerts

- **Drills Consolidation: REVIEW** — 14 findings from 2026-04-20 roundtable pending owner approval. No P0 items; top blockers are P1 design-doc defects (RT-92/93/94/95). Proposal HELD — do NOT scaffold `StudyView` until (a) Line Study closes, (b) design-doc defects fixed, (c) `_shared` barrel created.
- **UI Quality: YELLOW** — Owner reports S1–S5 symptoms recurring post-cutover; 6 P0 findings identify structural gaps (SW-cache replay without companion live-context, invariant check post-render not pre-dispatch, renderKey missing freshness/violation fields, `renderBetweenHands` dual-owner persists, `refreshHandStats` async gap). Program premise sound but under-specified in three places (FSM output exclusivity, pre-dispatch invariant gate, sequence-level replay corpus).
- **Test Health: GREEN** — Sidebar replay corpus + per-zone coverage + 3 automated doctrine lint gates established. Message-level integration coverage shipped under SR-6.
- **Security: GREEN** — All Phase A security items closed. Roundtable surfaced one pre-existing low-severity item (prototype pollution in `aggregateFrameworkAccuracy`, RT-96); trivial fix.
- **Product Correctness: GREEN** — All cited Phase A/B/C/D items shipped.

---

## Project Health

- **Tests:** 5,422 passing across 185 test files (main app) + **1,842** extension tests across 51 test files
- **Architecture:** v122 → SYSTEM_MODEL v1.7.0 — React + Vite + Tailwind, mobile-optimized 1600x720
- **Programs:** Security GREEN, Engine Accuracy GREEN, UI Quality GREEN, Test Health GREEN
- **Active backlog:** 0 NEXT, 0 REVIEW, 1 PAUSED (Firebase Cloud Sync), 0 BLOCKED (SR-8.4/8.5 closed 2026-04-15)
- **Open failure modes:** 0 active (1 newly-archived this cycle: SIDEBAR_REBUILD_PROGRAM marked RESOLVED)
