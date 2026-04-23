# Handoff — Played-Hand Review Protocol · Session 1 (Gates 1+2+3 + SPOT-KEY spike + charter)

**Session:** 2026-04-23, Claude (main) — single continuous session, owner-driven "continue" ratchet
**Project:** `docs/projects/played-hand-review-protocol.project.md`
**Phase:** 1 + 2 SHIPPED (draft); Phase 3 (Gate 4 specs) next
**Status:** DRAFT — awaits owner review

---

## What this session produced

**Five new artifacts + three docs updated.** All design-layer; no code touched.

| # | Artifact | Path | Role |
|---|----------|------|------|
| 1 | Gate 1 Entry | `docs/design/audits/2026-04-23-entry-played-hand-review-protocol.md` | NEW — YELLOW verdict, 3 JTBD gaps, 0 persona gaps |
| 2 | Gate 2 Blind-Spot Roundtable | `docs/design/audits/2026-04-23-blindspot-played-hand-review-protocol.md` | NEW — 6 custom voices × 5 stages; YELLOW verdict; 7 new JTBDs; 7 Stage-C rules; 8 Stage-E rules |
| 3 | JTBD authoring (Gate 3) | `docs/design/jtbd/domains/session-review.md` | UPDATED — SR-28..34 added (4 Active + 3 Proposed) |
| 4 | JTBD atlas | `docs/design/jtbd/ATLAS.md` | UPDATED — Session Review domain row + by-domain table + change log |
| 5 | SPOT-KEY feasibility spike | `docs/projects/played-hand-review-protocol/spot-key-spike.md` | NEW — GREEN feasibility verdict + proposed `spotResolver/` architecture |
| 6 | Project charter | `docs/projects/played-hand-review-protocol.project.md` | NEW — 9-phase plan, Phase 1+2 CLOSED, Phase 3 CURRENT |
| 7 | Handoff (this file) | `.claude/handoffs/hrp-gates-1-2-3-spike.md` | NEW |

---

## Why this project exists

Owner asked for an audit of current played-hand review vs. what it could be. Finding: two high-depth theoretical programs (Upper-Surface reasoning artifacts with ~60-row claim-falsifier ledgers, LSW line-study with 7-dim per-node audits) exist, but the played-hand review surface (`HandReplayView` + `AnalysisView` Hand Review tab) shows equity + segmentation + single-line EV copy — no theoretical citation, no counterfactual tree (even though `gameTreeEvaluator.js` computes it and discards it), no flag-and-queue mechanism.

Owner picked **narrow / bridge scope** — HRP is a consumer of the theoretical library, not a new authoring surface. Tag a played hand → resolve each decision to its upper-surface / LSW analog → render linked ledger + counterfactual tree + drill card in a modal overlay.

---

## Gates closed this session

### Gate 1 — Entry (verdict YELLOW)

- Scope classification: surface-bound augmentation + cross-surface journey change. No new routed view.
- Personas: **GREEN**. Post-Session Chris + Apprentice + Coach-review-session cover it. No new personas.
- JTBDs: **YELLOW**. 3 confirmed gaps in existing Session Review domain (no new domain).
- Composite: **YELLOW** — less severe than exploit-deviation's Gate-1 RED because JTBDs extend an existing domain and personas are fully covered.

### Gate 2 — Blind-Spot Roundtable (verdict YELLOW)

Six custom voices: Review Pedagogue, Skeptic, Information Architect, Systems Architect, Pro Coach, Evidence Realist.

Stage findings:
- **Stage A ✅** — no new personas. Clarifications: repeat-reviewer navigation pattern; Between-Hands review explicitly excluded; Coach-review-session is a presentation mode (not a persona).
- **Stage B ⚠️** — 4 Active + 3 Proposed JTBDs authored (SR-28..34).
- **Stage C ⚠️** — 7 design rules including the material Gate-1→Gate-2 shift: **ledger renders as modal overlay, not inline**. Also: glossary, match confidence, audit-state propagation, spaced-retrieval hide-notes, offline precache verification.
- **Stage D ⚠️** — 5 direct + 2 deferred partner surfaces; schema bump required (`hand.flags[]` + `hand.reviewState`); 2 shared-infra opportunities with exploit-deviation's MH-12 (AssumptionCard + spotResolver).
- **Stage E ⚠️** — 8 heuristic rules including undo-toast flag-toggle, ≥44 DOM-px touch targets, keyboard shortcut (L), first-open tutorial.

### Gate 3 — JTBD authoring (same session per exploit-deviation precedent)

SR-28..34 added to `jtbd/domains/session-review.md`:

| ID | Title | State |
|---|---|---|
| SR-28 | Deep-review a flagged hand against upper-surface theoretical ground-truth | Active |
| SR-29 | Know whether a theoretical analog exists for the spot being reviewed, and what to do if it does not | Active (gated on SPOT-KEY) |
| SR-30 | See the counterfactual EV tree for a past decision, with runout-class breakdown | Active |
| SR-31 | Flag a played hand for deep review and find it again in the queue | Active (producer = HE-17) |
| SR-32 | Nominate a played hand for inclusion in the theoretical corpus | Proposed |
| SR-33 | Dispute a cited claim against a played hand's evidence | Proposed |
| SR-34 | Re-review a previously reviewed hand on a spaced-retrieval schedule | Proposed |

ATLAS.md updated: Session Review row + by-domain table rows + change log entry.

---

## SPOT-KEY feasibility spike (Gate 4 prerequisite)

Per Gate 2, **spot-key resolution is the load-bearing technical invariant**. Spike answers: *can we map a played decision to its canonical theoretical analog at useful coverage?*

### Key findings (empirical survey)

- **Corpus size:** ~82 teaching nodes (6 upper-surface artifacts + ~76 LSW line-study nodes).
- **Vocabulary alignment:** texture (`'wet'/'medium'/'dry'`) and position (`BTN/BB/CO/SB/UTG`) already match upper-surface encoding **verbatim**. `boardTexture.analyzeBoardTexture()` + `positionUtils.POSITION_NAMES` — zero-conversion join.
- **Extractable dimensions:** ~70% free from existing helpers (position, IP/OOP, texture, stack, SPR, action history, cards, hero combo).
- **Missing helpers:** pot-type inference (~20 LoC), board shorthand (~10 LoC), node classifier (~100 LoC).
- **Typical coverage:** ~40–50% strong match, ~20–30% partial, ~15–25% no analog for a typical cash decision.
- **Villain range blocker resolved:** HRP renders linked artifact assertions (not re-derived ranges), so hand-record's lack of persisted villain ranges is NOT a v1 blocker. Reconstructed at render time by `useHandReplayAnalysis` for any future SR-33 dispute-claim need.

### Proposed `spotResolver/` architecture

7 files in `src/utils/spotResolver/`: extractor, pot-type inference, board shorthand, node classifier, corpus index, match scorer, golden tests. ~200 LoC pure utilities + ~150 LoC test corpus. 1–2 sessions of focused work.

### Verdict

**GREEN.** Spike unblocks Gate 4 surface specs — specs can reference the proposed `spotResolver/` API shape without waiting on implementation.

---

## Files I Own (this session)

All files are new or updates I made this session. **No existing implementation files touched.**

Created:
- `docs/design/audits/2026-04-23-entry-played-hand-review-protocol.md`
- `docs/design/audits/2026-04-23-blindspot-played-hand-review-protocol.md`
- `docs/projects/played-hand-review-protocol.project.md`
- `docs/projects/played-hand-review-protocol/spot-key-spike.md`
- `.claude/handoffs/hrp-gates-1-2-3-spike.md` (this file)

Updated:
- `docs/design/jtbd/domains/session-review.md` — SR-28..34 added + HRP header + change-log entry
- `docs/design/jtbd/ATLAS.md` — Session Review domain index row + by-domain table + change-log entry

**Parallel-safe with:**
- LSW (their files in `src/utils/postflopDrillContent/`, `docs/projects/line-study-slice-widening/`, `docs/design/audits/line-audits/` — zero overlap).
- Exploit-deviation (their files in `src/utils/assumptionEngine/`, `src/utils/emotionalState/`, `src/utils/citedDecision/`, `docs/projects/exploit-deviation/` — zero overlap). Note coordination point: if/when HRP Phase 4 builds `spotResolver/`, verify exploit-deviation's MH-12 live-citation hasn't built a parallel resolver. Handoff-based coordination.

---

## Owner review requests

Four items.

### 1. Accept Gate 1 + Gate 2 + Gate 3 verdicts

- Gate 1 YELLOW (scope + JTBD gaps identified).
- Gate 2 YELLOW (JTBD authoring + design rules confirmed).
- Gate 3 JTBDs (SR-28..34) authored same session per exploit-deviation precedent.

**Question:** Accept all three as shipped?

### 2. Accept SPOT-KEY feasibility verdict

GREEN at ~60–70% coverage with ~200 LoC investment. Texture + position vocabulary already aligned is the single biggest de-risking fact.

**Question:** Proceed with `spotResolver/` architecture as proposed? Any re-scoping before Gate 4 specs reference the API shape?

### 3. Next step — three options

Per the project charter's Phase 3 (CURRENT):

- **Option A — Phase 3 Gate 4 surface specs.** Update `hand-replay-view.md`, `analysis-view.md`, `showdown-view.md`; author new `hand-review-modal.md`; schema spec. 1–2 sessions. No code.
- **Option B — Phase 4 `spotResolver/` engine first.** Build the engine module in parallel with spec work (specs can reference the API shape without waiting). Unblocks everything downstream earlier.
- **Option C — Pause here.** Fold HRP-G4-SPEC + HRP-E-RESOLVER into BACKLOG.md for later claim. Lets active LSW + exploit-deviation work land first.

**Recommendation:** **Option C** — HRP is P2 behind LSW (active, shipping audits) and exploit-deviation (mid-flight Commit 2 of 9). Both have sharper near-term deadlines. HRP's design framework is already established; parking it for a few sessions loses nothing and keeps the active projects focused.

### 4. BACKLOG entries

Nine proposed items drafted in project charter (HRP-G4-SPEC through HRP-COORD-MH12). Ready to add to `.claude/BACKLOG.md` on approval.

**Question:** Add to backlog now, or wait until owner is ready to pick up a session?

---

## What was intentionally NOT done this session

1. **No STATUS.md update.** Pending owner acceptance of Gate-1/2/3/spike verdicts.
2. **No BACKLOG.md update.** Charter lists proposed items; owner approval gates the add.
3. **No MEMORY.md update.** Will add one line pointing to the project file at closeout.
4. **No code.** Pure design/architecture layer this session.
5. **No Gate 4 specs** yet — that's Phase 3, next session.
6. **No `spotResolver/` scaffolding** — spike proposed architecture but did not create files.
7. **No coordination-loop-close with exploit-deviation.** Both projects are parallel-safe through current phases; coordination point lands at HRP Phase 4 or exploit-deviation Phase 7, whichever ships first.
8. **HE-17 implementation audit deferred** — Gate 2 open question; verify in Phase 3 whether `hand.flags` field exists today or is atlas-listed only.

---

## Verification trail

- Gate 1 follows LIFECYCLE.md Gate-1 template; verdict output matches rubric (YELLOW = 1-2 JTBD gaps + fits-within-existing-framework).
- Gate 2 follows ROUNDTABLES.md 5-stage template; custom voices scoped to HRP blind-spot space; Stage E covers Nielsen/PLT/ML heuristics.
- Gate 3 JTBDs follow domain-file conventions (title, state, personas, surfaces, success criteria, failure modes) per existing SR-23..27 pattern.
- SPOT-KEY spike grounded in empirical survey (file:line citations in spike doc) — not speculation.
- Charter mirrors exploit-deviation project shape; phases have explicit accept criteria.

---

## Suggested next session

**Per Owner Option C (recommended): pause here.** Fold HRP-G4-SPEC + HRP-E-RESOLVER into BACKLOG.md when owner approves. Resume when LSW + exploit-deviation reach natural pause points.

**If Owner picks Option A: Phase 3 — Gate 4 surface specs.** Estimated 1–2 sessions:
- Session 1: Update `hand-replay-view.md` + `analysis-view.md` + `showdown-view.md`; verify HE-17 schema status; verify offline-precache status.
- Session 2: Author `hand-review-modal.md` (NEW) + schema spec for `hand.flags[]` + `hand.reviewState`.

**If Owner picks Option B: Phase 4 — `spotResolver/` engine.** Estimated 1–2 sessions:
- Session 1: `spotKeyExtractor` + `potTypeInference` + `boardShorthand` + `corpusIndex` + golden-test scaffolding.
- Session 2: `nodeClassifier` (hardest part) + `matchScorer` + 30+ golden corpus entries + test coverage.

---

## Status

**Phases 1 + 2:** CLOSED (draft). Gate 1 + Gate 2 + Gate 3 + SPOT-KEY spike all shipped.
**Phase 3:** READY (Gate 4 surface specs).
**Phase 4:** READY (unblocked by spike).
**Dependencies:** none blocking; coordinates with exploit-deviation MH-12 + AssumptionCard when those phases land.
**Next:** owner acceptance of verdicts + Option A/B/C decision.
