# Master Plan — 2026-04-30

Owner-ratified 5-workstream program orchestrating active and new initiatives.
Single source of truth for what's running, what's queued, and how the pieces depend on each other.

This is not a charter for one project — it's the index that the per-workstream charters live under. Each workstream may spawn its own dedicated charter as it crosses a Gate.

---

## Vision (owner statement, 2026-04-30)

> The poker app needs to eventually be able to give the most accurate, predictive decisions ever in the moment it receives new data, and have a full study section designed for beginner to pro.

Two long-horizon goals:

1. **Real-time predictive engine.** Every new piece of data (action, sighting, sizing, showdown) immediately updates models and surfaces the most exploitative live decision.
2. **Beginner-to-pro study path.** Detect the user's leaks from their actual hands, distill the lesson at their current skill level, and teach them up the ladder.

Everything in this plan serves one of those two goals or removes a kink that's blocking them.

---

## The five workstreams

| ID | Name | Type | Status |
|----|------|------|--------|
| **B+E** | TableView Invariant Audit + Straddle (TIA) | Audit + bounded fix wave | Phase 1, NEXT |
| **A** | Player Identification v2 (PIO) | New program, full Gate 1–5 cycle | Gate 1 NEXT |
| **C** | Predictive Engine Maturation | Continuation of EAL + game-tree + range engine | Ongoing |
| **D** | Self-Coach Foundation (SCF) | New program, Gate 1 NEXT | Gate 1 NEXT |
| **F** | SHC Gate 5 + DCOMP P0 | Existing programs, near-completion | Ongoing |

---

## Dependency graph

```
                      ┌─ A absorbs ─→ PlayersView scaling fix
                      ├─ A absorbs ─→ PlayersView persistence audit
A (Player ID v2) ─────┤             ─→ PhysicalSection rework
                      └─ A produces ─→ recognition-confidence schema
                                       │
                                       ↓ (eventually feeds)
                                       villain identity input → C

B (TableView invariant audit) ──┐
                                ├─ shared code surface — bundled
E (straddle)             ───────┘
B is foundational — every demo, every advice surface trusts it

C (engine maturation)
   ├─ EAL Stream D (~80% shipped) → B-matcher → Stream C → B-expand → Tier 1
   ├─ game-tree 26.x (independent)
   └─ benefits from A's recognition-confidence; not blocked by it

D (self-coach)
   ├─ leak-detection: ~70% exists (weaknessDetector + decisionAccumulator + ranges + EAL)
   ├─ MISSING: skill assessment, lesson authoring framework, curriculum spine
   └─ draws on C output (EAL anchors as teaching primitives) when available

F (SHC Gate 5 + DCOMP-W4-A3-F4) ─ independent, near-done
```

**Hard dependencies** (must precede): none across A / B / C / D — they're mostly orthogonal.

**Soft dependencies** (better outcomes if ordered):
- A before C-recognition-features (otherwise C ships without identity confidence input)
- B before any new TableView feature (otherwise new features inherit unaudited invariants)
- D's curriculum spine should be aware of EAL anchor primitives (otherwise drift)

---

## Sequencing

| Phase | Window | Bundle | Parallelizable with |
|-------|--------|--------|---------------------|
| **Phase 1** | Now → ~session +5 | B + E ships (audit then fix wave) | A Gate 1 design, D Gate 1 entry, C, F |
| **Phase 2** | Parallel from now | A Gates 1–2 (Entry + Blind-Spot) | B, D Gate 1, C, F |
| **Phase 3** | ~session +5 onward | A Gates 3–4 (Research + Design surfaces) | C, F, D Gate 2–4 |
| **Phase 4** | ~session +10 onward | A Gate 5 (Implementation) | D Gate 2–4, C |
| **Phase 5** | ~session +14 onward | D Gate 5 (Implementation) + ongoing authoring | C, residual cleanups |
| **Background** | Throughout | F runs in any spare session | All |

The numbers are estimates, not commitments. Scope discoveries during audits and Gates may re-shape this.

---

## Workstream charters

### B+E — TableView Invariant Audit + Straddle (TIA)

**What this gives you:** trust that every action button at the table only appears when it should, never disappears when it shouldn't, and never accepts an option the rules forbid. Plus the straddle rule type added to the game state model with the same coverage from day one.

**Origin:** owner reported two bugs on 2026-04-30 — (1) "check" option appearing for a seat when two players were selected and it shouldn't have been available, (2) after a fold, next-to-act seat lost ability to bet. Both are action-availability invariants failing silently. Owner's read: "I bet there are more examples." Probably right.

**Phase 1.1 — Invariant matrix authoring (1–2 sessions, NO fixes)**

Build the matrix:

```
(active_seats × street × prior_action × hero_role × game_state) → expected_action_options
```

Author it as a test fixture. Cover:
- All preflop action contexts (open / 3bet / 4bet / squeeze / limp / cold-call / iso / squeeze-with-cold-callers / open-with-blinds-completing)
- All postflop action contexts (cbet / donk / float / probe / check-raise / 3-bet bluff / value)
- Special states: heads-up (BB acts first preflop, BTN acts first postflop or last?), all-in dynamics, dead-money blinds, blinds increased, sit-out/inactive seats
- Pre-existing bug examples included as fixture rows

Run the matrix against current code. **Bug count discovered = audit signal.** Don't fix anything in this phase. Just enumerate.

**Phase 1.2 — Straddle wired into matrix (1 session)**

Decide with owner:
- Live straddle only? Mississippi? UTG-only? Allow re-straddle?
- Straddle = effective BB or layered third blind?

Then extend the matrix to cover straddle action order, blind-posting, and pot-odds calculations. Re-run.

**Phase 1.3 — Fix wave (2–3 sessions)**

Address violations in priority order. Each fix gets a regression test that pins to the matrix row that caught it.

**Acceptance:**
- Matrix authored and committed as test fixture
- 100% of matrix cells have explicit assertion (no silent skipped rows)
- Zero violations on green tests
- Straddle covered identically to other action types
- Failure file written: `.claude/failures/TABLEVIEW_INVARIANT_GAP.md` documenting how the gap was detectable for so long

**Discoveries to flag during audit:** anything beyond action availability (pot calc errors, blind-posting bugs, sequence-order issues) — capture in BACKLOG, do NOT bundle unless trivial. Stays-focused discipline.

**Estimated cost:** 4–5 sessions total.

---

### A — Player Identification v2 (PIO)

**What this gives you:** at a live table, when an unfamiliar face sits down, you can describe them in real time — age range, skin tone with redness modifier, hair, beard, eyes, glasses, hat shape AND logo/color, jewelry (wedding ring, watch), wardrobe (red hoodie, polo with logo) — and the app dynamically scores against your known-player inventory. "Is that the guy?" turns into a checklist that converges. Sightings of "wore X on date Y" build up a temporal wardrobe history per player.

**Why this is its own program (not a PEO patch):** schema additions are large (sighting log, wardrobe entity, jewelry, age, logos), and the dynamic recognition-search interaction is net-new (PEO's picker is name-prefix + 5 attribute chips). Trying to patch PEO would force compromises in the schema and the search.

**Reuse from PEO (inventory at Gate 1):**
- Avatar feature system (skin/hair/beard/eyes/glasses/hat) — keep, extend with new categories
- `usePlayerDraft` autosave — keep, extend for new schema
- `useRetroactiveLinking` — keep, may need extension for sighting-log
- `PlayerPickerView` primitives (`ResultCard`, `BatchSeatRibbon`, `scorePlayerMatch`) — keep, extend scoring
- `PlayerEditorView` primitives — keep, add new sections
- `AvatarRenderer` / `AvatarMonogram` — keep
- `playerAutoName.js` — keep
- IDB v14 player schema — extend additively to v21+

**Replace from PEO:**
- `PhysicalSection.jsx` (legacy text dropdowns) — replace with structured attribute sections matching the new schema
- `ImageUploadSection.jsx` — replace with phone-camera-capture + crop + downscale flow (web-native `<input capture>`)
- `FilterChips.jsx` (5-category) — extend to cover all new categories AND add a "recognition mode" alongside name-search

**Absorb from backlog:**
- PlayersView screen scaling (owner-flagged 2026-04-30)
- PlayersView persistence issues (owner-flagged 2026-04-30)
- `DCOMP-W4-A1-F8 Phase 2` (filter drawer collapse — paused) — re-evaluated under PIO
- Any open PlayersView P2/P3 in DCOMP-W4 — re-evaluated under PIO

**Gate 1 — Entry (NEXT, ~1 session)**

Per `docs/design/LIFECYCLE.md`. Required outputs:
- Scope classification + RED/YELLOW/GREEN verdict
- Personas — primary is `chris-live-player.md`; check whether existing persona covers the recognition-under-uncertainty use case or if amendment needed
- JTBDs — likely new: "describe-someone-into-existence", "build-temporal-attribute-history", "convert-uncertain-sighting-to-known-player"
- Gap analysis: what existing surface gets us here vs. what's missing
- PEO reuse inventory (the lists above, ratified)

**Gate 2 — Blind-Spot Roundtable (~1 session)**

Per `docs/design/ROUNDTABLES.md`. Likely voices:
- UX (recognition flow ergonomics)
- Failure (false-positive recognition cost: tagging Player B's history onto Player A's profile is a poison pill — what guards prevent it?)
- Data-modeling (sighting log temporal schema; wardrobe entity granularity)
- Cultural sensitivity (ethnicity / age-bucket framing — these can be tone-deaf if implemented as checkboxes; need a careful pass)

**Gate 3 — Research (~1 session)**

JTBD details, owner interview on:
- Age bucket spans (5-year? 10-year? Decade?)
- Wardrobe granularity (item type? logo capture? color granularity?)
- Sighting log temporal model (per-attribute, per-session, both?)
- Recognition-search ranking weight defaults (which attributes are most predictive — typically headwear + glasses + skin tone + hair, but owner instinct may differ)
- Phone camera UX expectations

**Gate 4 — Design surfaces (~2 sessions)**

Likely deliverables:
- New `surfaces/player-recognition-search.md` — dynamic-attribute search; live scoring against inventory
- New `surfaces/player-sighting-log.md` — temporal append-only attribute log per player
- New `surfaces/player-wardrobe-entry.md` — clothing + jewelry + logo capture flow
- Extension of existing `surfaces/player-editor.md` — new attribute sections (age, wardrobe, jewelry, logos)
- Extension of existing `surfaces/player-picker.md` — recognition-mode toggle alongside name-search
- New `surfaces/players-view.md` — replacement of PlayersView; scaling and persistence absorbed

**Gate 5 — Implementation (~6–8 sessions, multi-PR)**

Likely milestones:
- IDB v21 (or higher) — sighting log store, wardrobe schema, extended Player schema
- Camera capture pipeline — `<input capture>` → in-app crop UI → downscale to recognition-friendly resolution → IDB
- Multi-attribute weighted scoring algorithm
- Recognition-search UI (replaces FilterChips for the recognition use case)
- PlayersView rebuild
- Migration path for existing player records (PEO-era avatars stay valid; new attributes default to unknown)
- Recognition-confidence schema exposed to villain modeling (handoff to C)

**Acceptance:**
- Full table flow: see player → describe attributes live → scoring surfaces top-N candidates → owner affirms → sighting recorded → next session benefits from updated history
- Scaling clean at 1600×720, 1280×720, 1920×1080
- Persistence audit closed
- Recognition confidence schema documented and consumable by C

**Estimated cost:** 3–4 design sessions + 6–8 implementation = 10–12 sessions total.

---

### C — Predictive Engine Maturation (continuation)

Existing program. Per BACKLOG, in flight:
- **EAL** Stream B-matcher → Stream C (LiveAdviceBar anchor badge) → Stream B-expand (10 anchors) → Tier 1 wiring (anchor library calibration dashboard)
- **Game-tree 26.x** improvements continuing
- **Range engine** improvements as discovered

**New touchpoints from this master plan:**
- When A ships recognition-confidence schema, surface it as input to villain modeling — i.e. "we're 75% sure this seat is Player K, who has these tendencies; weight model accordingly." This becomes a new game-tree input.
- When D ships skill-assessment, calibrate confidence display + lesson distillation against user's tier.

**Acceptance:** per existing project charters.

**Sequencing note:** runs in parallel with A; doesn't share files.

---

### D — Self-Coach Foundation (SCF)

**What this gives you:** the app watches the user's hands, detects leaks (e.g. "you fold to flop 3-bets at 78% but your 3-bet range only justifies 60%"), and surfaces a lesson calibrated to the user's current skill level. Over time, this becomes a personalized coaching ladder from beginner to pro.

**Why now:** the *detection* infra is ~70% built. The *teaching* infra is missing. Authoring lessons takes time, so opening Gate 1 now buys lead time on the curriculum spine while B and A do their work.

**Existing infra D can draw on:**
- `weaknessDetector.js` — 7 situational + 5 preflop weakness rules
- `decisionAccumulator.js` — postflop decisions by situation key
- `villainProfileBuilder.js` — could repurpose for hero profile too
- Range engine — to compare actual fold to fold-range-implied frequency
- EAL anchor predicates — fire on observed behavior, can be teaching primitives
- `handAnalysis/` — 7 utils for replay analysis already exist

**Missing infra D needs to build:**
- **Skill assessment of the user** — proposed in `feedback_skill_assessment_core_competency.md` 2026-04-23 but never built. D Gate 4 designs it.
- **Lesson authoring framework** — templates parameterized by skill tier; copy discipline (no graded-work framing per AP-06 precedent); examples library
- **Curriculum spine** — what is "pro"? What's the ladder?
- **Leak → lesson distillation contract** — when a leak is detected, what lesson template applies, at what skill tier

**Gate 1 — Entry (NEXT, ~1 session, can run parallel with B Phase 1)**

Required outputs:
- Skill ladder named (e.g. "novice / live-rec / studied-amateur / part-time grinder / serious grinder / pro" — owner decides the granularity)
- For each tier: rough description of what that tier already understands, what's the next teachable concept
- Scope classification + RED/YELLOW/GREEN
- Personas — primary user; possibly amend `chris-live-player.md` with self-coach goals
- JTBDs — likely "see-my-leak-without-being-graded", "learn-the-next-concept-im-ready-for", "validate-im-improving"

**Gate 2 — Blind-Spot Roundtable (~1 session)**

Likely voices:
- Pedagogy (effective adult learning loops; spaced repetition; level-appropriate framing)
- Autonomy / failure (paternalism risk; false-leak risk on small samples; AP-06 graded-work-framing refusal)
- Privacy (leak data is sensitive — what if user shares device with study partner?)
- Engineering (skill-assessment shape; lesson template engine; how it bolts to existing surfaces)

**Gate 3 — Research (~1 session)**

JTBDs detailed; existing pedagogy literature inventoried; owner interview on:
- How explicit should skill assessment be (test-based? observed-from-play? owner-declared?)
- Where does the lesson surface (inline on hand replay? dedicated study view? both?)
- Frequency of lesson firing (every leak? aggregated weekly? owner-triggered?)

**Gate 4 — Design (~2 sessions)**

Likely deliverables:
- `surfaces/study-curriculum.md` — the ladder
- `surfaces/lesson-card.md` — lesson template
- `surfaces/skill-assessment.md` — how the user's tier is determined
- `surfaces/leak-distillation.md` — how detected leak becomes a lesson at the user's tier
- New `src/utils/skillAssessment/` module design (per memory note)
- Lesson authoring template + example lessons (initial 5–10 across tiers)

**Gate 5 — Implementation (multi-PR, ongoing)**

- `src/utils/skillAssessment/` ships
- Lesson authoring framework ships
- 1–2 leak rules wired end-to-end as proof (e.g. "fold-to-flop-3bet outside MDF" → distill at user tier → surface)
- Curriculum scaffolding shipped; lessons land progressively

**Authoring (ongoing, indefinite):**

The long pole. Each lesson is a unit of original poker pedagogy authored at the user's tier. Cadence ~1–3 lessons per session of authoring time, depending on depth.

**Acceptance (Gate 5 ratification):** end-to-end loop works for at least one detected leak; curriculum has at least 10 lessons covering at least 3 tiers; user can navigate the ladder.

**Estimated cost:** 2–3 sessions Gates 1–4 + 3–5 sessions implementation foundation + ongoing authoring (effectively permanent).

---

### F — SHC Gate 5 + DCOMP P0 (continuation)

Existing programs near completion. Owner-tracked in STATUS.md.

**Remaining items:**
- V-color-tokens §V Layer-1/Layer-2 graph migration (~46 hex literals + 51 `--m-*` rename + STYLE_COLORS consolidation + design-tokens.meta.js extraction + mirror-lock test enablement). Multi-PR. Largest remaining.
- Legacy `--font-*` deprecation alias removal (cleanup, tiny)
- §VI.1 / §II.1 inline-text REJECTED tier polish (small surface detail)
- `DCOMP-W4-A3-F4` (extension version-mismatch handshake — needs extension-side change)

**Sequencing:** background; runs in any spare session.

**Acceptance:** SHC Gate 5 closed; DCOMP-W4-A3-F4 closed.

---

## Audits / refactors woven in (not deferred)

- **B+E:** TableView action-availability invariant matrix — the systemic gap, not deferred to a future "test-health" sprint
- **A:** PlayersView scaling, persistence audit, PhysicalSection rework — absorbed, not separate tickets
- **A → C handoff:** recognition-confidence schema as villain-modeling input, designed in A, consumed by C
- **D:** skill-assessment module (proposed 2026-04-23, unbuilt) — built inside D, not a separate "skill assessment" project
- **F:** mirror-lock test enablement happens as part of V-color-tokens migration, not a follow-on

The principle: when a workstream's surface inherently includes a refactor, the refactor goes in the workstream. No "we'll come back to scaling later." No "we'll build skill assessment as a separate effort."

---

## Owner ratification log

| Date | Decision | Status |
|------|----------|--------|
| 2026-04-30 | 5 workstreams identified (B+E / A / C / D / F) | Ratified |
| 2026-04-30 | Dependency graph as drawn | Ratified |
| 2026-04-30 | B framed as invariant authoring + audit, NOT spot-fix | Ratified |
| 2026-04-30 | Straddle bundled into B (shared code surface) | Ratified |
| 2026-04-30 | A absorbs PlayersView scaling + persistence + PhysicalSection rework | Ratified |
| 2026-04-30 | A reuses PEO infra where helpful | Ratified |
| 2026-04-30 | D Gate 1 opens parallel with B Phase 1 | Ratified |
| 2026-04-30 | Phone-camera capture via web-native `<input capture>` (not custom in-app surface) | Ratified |

Subsequent Gate verdicts get appended here as they're approved.

---

## Open questions for owner before Phase 1 begins

The plan is locked. These are operational questions before B+E starts:

1. **Straddle scope** — live straddle only, or include Mississippi? UTG-only or any-position? Re-straddle allowed? (Affects matrix size in B.)
2. **D Gate 1 — "what is pro?"** — name the skill ladder. Suggested 6 tiers: novice / live-rec / studied-amateur / part-time grinder / serious grinder / pro. Adjust as you see fit. (Affects D Gate 1 outcome.)
3. **A Gate 1 timing** — start before, during, or after B Phase 1? (My recommendation: parallel — Gate 1 is cheap and design lead time compounds.)

These are not blockers — they're inputs to schedule the next session. Answer when convenient.

---

*End of master plan.*
