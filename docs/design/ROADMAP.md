# Design Program — Compliance Roadmap

Established 2026-04-21. The plan to get every existing surface in the codebase governed by the Design Program, and the framework itself to operational maturity.

---

## What "100% compliance" means

Compliance has three tiers. A surface is "100% compliant" when it reaches Tier C. Most surfaces should aim for Tier B as a minimum standard; Tier C is a function of audit severity and bandwidth.

### Tier A — Baseline compliance

A surface is **catalogued** when:
- A `surfaces/<id>.md` artifact exists.
- Personas and JTBD are mapped (which of the 15 personas use it; which atlas JTBDs it serves).
- Entry is in `surfaces/CATALOG.md` at `●` state.
- An entry exists in `features/INVENTORY.md` tagged with product-line + tier.

**Cost**: ~30–60 minutes per surface, ideally batched. Produces no code changes. Mostly documentation.

### Tier B — Audit compliance

A surface is **audited** when:
- Tier A complete.
- A heuristic + situational walkthrough is logged in `audits/YYYY-MM-DD-<surface>.md`.
- Findings are severity-ranked.
- Every finding is triaged: queued for fix, explicitly deferred, or rejected with rationale.

**Cost**: ~1 session per surface for the audit itself. May surface multiple findings including missing features that become discoveries.

### Tier C — Fix compliance

A surface is **fixed-current** when:
- Tier B complete.
- All severity ≥ 3 findings (P1) are implemented or have owner-approved deferral.
- Severity 2 findings (P2) are either implemented or tracked in backlog.
- Surface artifact's "Known issues" section reflects current state.

**Cost**: highly variable. A surface with no severity ≥ 3 findings is trivially Tier C. A surface with 4 P1 findings may take 3+ sessions.

---

## Current state (2026-04-21)

### Surfaces

| Surface | Tier A | Tier B | Tier C | Notes |
|---------|--------|--------|--------|-------|
| player-picker | ✅ | ✅ | ✅ | Sessions 2–4. |
| player-editor | ✅ | ✅ | ✅ | Sessions 2–4. |
| seat-context-menu | ✅ | ✅ | ✅ | Sessions 2–4. |
| table-view | ❌ | ❌ | ❌ | Code known (TableView 594 lines, ARCH-003). Multiple legacy backlog items (RT-36, RT-37, RT-43, etc.). |
| showdown-view | ❌ | ❌ | ❌ | |
| sessions-view | ❌ | ❌ | ❌ | |
| stats-view | ❌ | ❌ | ❌ | |
| hand-replay-view | ❌ | ❌ | ❌ | Hand Significance/Importance flagged as unexposed (F-W4). |
| analysis-view | ❌ | ❌ | ❌ | |
| tournament-view | ❌ | ❌ | ❌ | Known ICM gaps from atlas. |
| online-view | ❌ | ❌ | ❌ | No Online Sessions history tab flagged. |
| players-view | ❌ | ❌ | ❌ | |
| settings-view | ❌ | ❌ | ❌ | |
| preflop-drills | ❌ | ❌ | ❌ | Only Explorer tab shipped; advanced tabs WIP. |
| postflop-drills | ❌ | ❌ | ❌ | Only Explorer + Line Study shipped. |
| sidebar (5 zones) | Doctrine exists in `docs/SIDEBAR_DESIGN_PRINCIPLES.md`; not framework-native yet | — | — | Needs framework integration, not re-audit. |

Totals: **3 of ~16 surfaces at Tier A/B/C**. **13 surfaces need at least Tier A work** (plus sidebar integration).

### Framework hygiene

| Item | Status | Action needed |
|------|--------|---------------|
| PROTO personas (15/15) | All proto | Quarterly validation pass (first: 2026-07-21) |
| Discovery LOG (CAPTURED) | 20 items from 2026-04-21 gap list | Owner triage → QUEUED / REJECTED |
| JTBD domains with 0 surfaces | 5 (subscription-account, coaching, social-group, multi-device-sync, onboarding) | Stay as-is until relevant feature work |
| Blind-spot roundtables run | 0 | Run on next new-feature proposal |
| Feature inventory: WIP items | 5 items (F-W1 through F-W5) | Track in audits as they're touched |

---

## Wave plan

Six waves, plus hygiene track. Waves are largely independent and can be re-ordered based on owner priority. Hygiene can run in parallel.

### WAVE 0 — Baseline (Tier A for everything)

**Goal**: get every currently-undocumented surface to Tier A. No audits, no code changes. Quick catalog pass.

**Scope**:
- Author surface artifacts for all 11 remaining main-app surfaces (table-view, showdown, sessions, stats, hand-replay, analysis, tournament, online, players, settings, preflop-drills, postflop-drills).
- Update `surfaces/CATALOG.md` to mark each as `●`.
- Update `features/INVENTORY.md` with per-feature detail if missing.

**Expected outputs**: ~11 new surface artifacts, ~10–60 lines each (lean — not full audits).

**Estimated sessions**: 2 sessions (batch-author 5–6 per session at baseline depth).

**Gate exemptions**: Wave 0 does not require Gate 2 roundtables — it's documentation of current state, not new design.

**Why first**: all subsequent waves depend on surface artifacts existing. Also cheap enough to batch. Catches "we have features nobody documented" surprises early.

---

### WAVE 1 — Core Table Surfaces (Tier B + C)

**Goal**: full audit + P1 fixes on the three surfaces Chris uses every hand.

**Scope**:
- `table-view` — THE main view. Existing legacy backlog (RT-36 memoization, RT-37 Next Hand guard, ARCH-003 component size). Audit + fix.
- `showdown-view` — touched at the end of every hand. Likely to have interaction and destructive-action concerns.
- `sessions-view` — session start / end boundary. Known flag: "no Online Sessions tab" split.

**Expected outputs**: 3 audits, per-surface findings lists, implementation of P1 findings.

**Estimated sessions**: 6–8.
- 1 session for each audit (×3 = 3 sessions).
- 1–2 sessions of P1 fixes per surface (×3 = 3–6 sessions).

**Gate 2 (Blind-spot roundtable)**: RECOMMENDED for TableView before audit. It's the most-exercised surface and most likely to reveal persona/JTBD gaps.

**Dependencies**: Wave 0 complete (surface artifacts must exist).

**Risks**:
- TableView audit may recommend structural refactor (ARCH-003 is already at 594 / 700 threshold).
- Findings may reveal issues with sidebar's TableView integration — would push Wave 5 earlier.

---

### WAVE 2 — Review & Analysis Surfaces (Tier B + C)

**Goal**: audit the surfaces used post-hand / post-session for review and analysis.

**Scope**:
- `hand-replay-view` — Hand Significance / Importance currently not surfaced (F-W4). Likely discovery-generator.
- `analysis-view` — multiple panels with layered information density; heuristic pre-check likely valuable.
- `stats-view` — session aggregate stats.

**Estimated sessions**: 5–7.

**Gate 2**: recommended for hand-replay-view (likely to surface missing features and persona gaps for Apprentice / Coach who haven't been served yet).

**Dependencies**: Wave 0 complete.

---

### WAVE 3 — Study / Drills Surfaces (Tier B + C)

**Goal**: audit the drill surfaces; decide fate of the WIP tabs.

**Scope**:
- `preflop-drills` — only Explorer ships; F-W2 flags stubs for Shape, Recipe, Math, Framework, Library, Lessons.
- `postflop-drills` — only Explorer + Line Study ship; F-W1 flags stubs for Estimate, Framework, Library, Lessons.
- Likely outcome: audit surfaces discoveries ("customize drill from history" — DISC-13, "spaced repetition" — DISC) and pushes decision: finish the WIP tabs or retire them?

**Estimated sessions**: 3–4.
- Preflop + Postflop drills can be audited together (single session).
- Fixes depend on owner decision on WIP tab fate.

**Gate 2**: RECOMMENDED. The WIP tabs plus the Scholar persona (unserved today) may surface significant gaps.

---

### WAVE 4 — Specialized Surfaces (Tier B + C)

**Goal**: audit the lower-frequency but still-important surfaces.

**Scope**:
- `players-view` — player database list. Mostly edit-oriented.
- `tournament-view` — ICM, bubble, FT. Known missing features (DISC-04 ICM payout import, DISC-05 bounty EV, DISC-06 satellite mode).
- `online-view` — sidebar integration surface. Known: no Online Sessions tab.
- `settings-view` — auth + display + venue config.

**Estimated sessions**: 4–6.

**Gate 2**: RECOMMENDED for `tournament-view` (multiple discovery-candidates) and `online-view` (cross-product surface → triggers sidebar considerations).

---

### WAVE 5 — Sidebar Integration (unique)

**Goal**: bring the Chrome extension sidebar into the framework without duplicating its existing doctrine.

**Scope**:
- For each of the 5 zones (Z0 chrome, Z1 table-read, Z2 decision, Z3 street-card, Z4 deep-analysis): create a surface artifact that references the existing `docs/SIDEBAR_DESIGN_PRINCIPLES.md` rather than re-deriving.
- Audit each zone against the framework's heuristic sets (the sidebar has its own 33 rules; cross-map to Nielsen / PLT / ML where applicable).
- Catalog any sidebar-specific personas (Multi-Tabler + Online MTT Shark are primary).
- Verify the sidebar's own program history (Sidebar Rebuild + Trust Programs) is referenced in evidence ledger.

**Estimated sessions**: 3–4.

**Gate 2**: OPTIONAL — the sidebar has its own rigorous doctrine already; framework integration is documentation work.

**Dependencies**: Wave 0 + Wave 4 (online-view) ideally precede.

**Risks**:
- Duplication with existing sidebar doctrine if not careful. Policy: framework links to doctrine rather than re-stating.
- Mapping between sidebar's 33 rules and framework's Nielsen / PLT / ML may reveal gaps in one or the other.

---

### HYGIENE TRACK (parallel with Waves 1–5)

**Goal**: keep the framework itself honest. Not gated on surface waves.

**Work items**:
- **H1**: Triage the 20-item initial gap list (`discoveries/2026-04-21-initial-gap-list.md`). Owner decides which move to QUEUED, REJECTED, ARCHIVED. ~1 session.
- **H2**: First PROTO persona validation pass. Owner answers A1–A6 assumptions on Chris-live-player; scan which end-user archetypes still make sense. ~1 session. Scheduled 2026-07-21 (quarterly).
- **H3**: JTBD domain review. For each domain with 0 served surfaces: either populate when relevant feature work arrives, or mark DEPRECATED. Continuous.
- **H4**: Evidence LEDGER hygiene. Append entries as audits happen. No scheduled pass needed.

---

### ONGOING — Blind-spot roundtables (triggered, not scheduled)

Not a wave. Triggered by:
- New feature proposals.
- Entering NEXT for any UX-touching work classified as Gate 1 YELLOW or RED.
- Owner request.
- Cadence (if no roundtable runs in 180 days).

When triggered, produces an `audits/YYYY-MM-DD-blindspot-<topic>.md` per `ROUNDTABLES.md`. Typically 1 session.

---

## Total estimate (realistic window)

| Track | Sessions | Calendar (rough) |
|-------|----------|------------------|
| WAVE 0 | 2 | 1 day |
| WAVE 1 | 6–8 | 1–2 weeks |
| WAVE 2 | 5–7 | 1–2 weeks |
| WAVE 3 | 3–4 | 0.5–1 week |
| WAVE 4 | 4–6 | 1 week |
| WAVE 5 | 3–4 | 0.5–1 week |
| HYGIENE | 2–3 | distributed |
| **Total** | **~25–34 sessions** | **~6–10 weeks** if run back-to-back |

Calendar assumes 3–4 Claude sessions per working day. Sessions can run in parallel tracks (e.g., hygiene + a wave) if needed.

---

## Sequencing guidance

**Minimum viable compliance state** (the "we're definitely governed now" bar): Wave 0 complete + Wave 1 complete + Hygiene H1 (discovery triage) complete. This covers the three most-used surfaces (table/showdown/sessions) at full Tier C, and gets the rest to Tier A. Realistic in ~10 sessions.

**Full compliance state**: all waves 0–5 through Tier B, P1 findings through Tier C, hygiene H1 + H2 done. Realistic in 25–34 sessions.

**Drop-first candidates if scope pressure**:
- WAVE 3 (Drills) — the WIP tab decision may warrant its own project; audit can defer until that decision.
- WAVE 5 (Sidebar) — existing doctrine is strong; framework integration is nice-to-have not must-have.
- Tier C on P2 findings everywhere — defer to follow-on work.

---

## Gate 2 schedule preview

Roundtables recommended during the roadmap:

| Wave | Surface | Rationale |
|------|---------|-----------|
| 1 | table-view | Most-used surface; likely persona/JTBD gaps |
| 2 | hand-replay-view | Apprentice/Coach personas unserved; likely discovery-rich |
| 3 | drills (both) | Scholar persona unserved; WIP tab fate decision |
| 4 | tournament-view | Known discovery clusters (ICM/bounty/satellite) |
| 4 | online-view | Cross-product surface |

Five triggered roundtables minimum through the roadmap. That's the program's first real exercise of the Gate 2 mechanism.

---

## Feature changes likely to emerge

Because the audits will find issues, the roadmap includes *unknown unknowns*. Known candidates based on existing flags:

| Surface | Likely finding class | Scope |
|---------|---------------------|-------|
| TableView | Performance / memoization (RT-36) | Already in backlog |
| TableView | Component decomposition (ARCH-003) | Potentially major refactor |
| ShowdownView | Destructive-action patterns | Moderate |
| SessionsView | Online Sessions split | New sub-surface |
| HandReplay | Surface hand significance (F-W4) | New widget |
| Analysis | Density / navigation | Moderate |
| Drills | WIP tab fate | Major — might retire features |
| Tournament | ICM / bounty / satellite | New discoveries |

**Program-level policy**: audits can recommend scope-expanding findings. Owner approves whether the expansion happens inside the same wave or spawns its own project.

---

## Success criteria

The roadmap is complete when:

1. All 16 surfaces are at Tier A minimum (CATALOG all `●`).
2. All P1 findings across all audits are either implemented or explicitly deferred with owner approval.
3. Discovery LOG has no items in CAPTURED state older than 60 days.
4. At least 5 PROTO personas have been validated (moved to VERIFIED or explicitly kept PROTO with rationale).
5. At least 3 blind-spot roundtables have been conducted, each producing ≥1 substantive finding (proving the mechanism works).
6. First quarterly hygiene pass (H2) has been completed.

Hitting all six = full program maturity. This is not a "done and forgotten" state — compliance is continuous, and new waves open whenever new surfaces are added.

---

## Change log

- 2026-04-21 — Created. Part of Design Program establishment.
