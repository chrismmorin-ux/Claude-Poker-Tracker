---
id: played-hand-review-protocol
name: Played-Hand Review Protocol (HRP)
status: active
priority: P2
created: 2026-04-23
backlog-id: HRP
---

# Project: Played-Hand Review Protocol (HRP)

## Quick Start for New Sessions

1. Read ALL files in `.claude/handoffs/` — check for file conflicts. **Parallel-safe with LSW + exploit-deviation through Gate 4** (documentation only). Code streams will coordinate if/when they land.
2. Read this file — find the current phase (marked with `<- CURRENT`).
3. Read the "Context Files" for that phase.
4. For any code session: `CLAUDE.md` + `.claude/context/POKER_THEORY.md` + relevant engine `CLAUDE.md` sub-directory file.
5. Create/update your handoff file in `.claude/handoffs/`.
6. Execute the checklist items.
7. Update this file and handoff when done.

---

## Overview

The app has two high-depth theoretical programs — Upper-Surface reasoning artifacts with ~60-row claim-falsifier ledgers, and LSW line-study with 7-dim per-node audits — and one shallow played-hand review surface (`HandReplayView` + `AnalysisView`'s Hand Review tab) that shows equity + segmentation + single-line EV copy without theoretical citation. HRP closes that gap by making the replay surface a **consumer** of the theoretical library rather than a parallel producer.

A flagged played decision resolves to its upper-surface / LSW analog via a canonical spot-key. The artifact's ledger + drill card render in a modal overlay. The depth-2/3 counterfactual tree already computed in `gameTreeEvaluator.js` — currently discarded at the UI boundary — is surfaced with per-runout-class breakdown. Post-Session Chris, Apprentice, and Coach-review-session personas are primary.

**The key architectural decision:** HRP is a *bridge*, not a new authoring surface. It doesn't produce reasoning — it consumes what LSW + Upper-Surface produce. That keeps scope finite and avoids parallel-authoring staleness.

**The load-bearing invariant:** spot-key resolution — mapping a played decision's ~8-dim context to a canonical artifact ID. SPOT-KEY feasibility spike (2026-04-23) confirmed GREEN at ~60–70% confident-or-partial coverage with ~200 LoC engineering investment.

**Shared infrastructure with exploit-deviation project:** MH-12 `AssumptionCard` component + spot-resolver logic. Coordinate before either ships to avoid duplicate modules.

**Acceptance Criteria (overall):**

- Gate 1 Entry, Gate 2 Blind-Spot, Gate 3 JTBD authoring, SPOT-KEY feasibility spike all shipped (Phase 1–3).
- `spotResolver/` module: extractor + pot-type inference + board shorthand + node classifier + corpus index, with ~30 golden-test corpus entries.
- Gate 4 surface specs authored for: HandReplayView augmentations, HandBrowser flag filter, hand-review-modal (new component spec), ShowdownView HE-17 producer entry.
- Schema: `hand.flags[]` + `hand.reviewState` additions, IDB version bump path.
- HandBrowser renders flag filter + flag indicator + last-reviewed column.
- HandReplayView renders ledger-link per decision with match-confidence indicator; modal overlay with progressive disclosure ladder.
- First-open tutorial + inline glossary + keyboard shortcut (L) shipped.
- Corpus artifacts available offline via PWA precache.
- Feature visually verified at 1600×720 on Post-Session Chris primary flow (flagged hand → review modal → dismiss).

---

## Context Files

Read these before any work:

- `CLAUDE.md` — project rules, engine guardrails, Design Program Guardrail.
- `docs/design/LIFECYCLE.md` — feature gates.
- `docs/design/ROUNDTABLES.md` — Gate 2 template.
- `docs/design/audits/2026-04-23-entry-played-hand-review-protocol.md` — Gate 1 YELLOW.
- `docs/design/audits/2026-04-23-blindspot-played-hand-review-protocol.md` — Gate 2 YELLOW; 7 new JTBDs; 7 Stage-C rules; 8 Stage-E rules.
- `docs/design/jtbd/domains/session-review.md` — SR-28..34 entries (HRP-authored).
- `docs/design/surfaces/hand-replay-view.md` — baseline surface; HRP augments.
- `docs/projects/played-hand-review-protocol/spot-key-spike.md` — feasibility verdict, proposed `spotResolver/` architecture.
- **Coordination:** `docs/projects/exploit-deviation.project.md` — shared AssumptionCard + spot-resolver infra opportunities.

---

## Streams

Three parallel work streams. Stream **A** (architecture/design) leads; stream **E** (engine) unblocks on Gate 4 spec + SPOT-KEY build; stream **U** (UI) unblocks on E.

| Stream | Status | Description | Gate |
|--------|--------|-------------|------|
| A | [x] partial | Gate 1 Entry + Gate 2 Blind-Spot + Gate 3 JTBD authoring + SPOT-KEY spike | Gates 1+2+3 closed Session 1; Gate 4 specs open |
| E | [ ] | Engine — `spotResolver/` module, IDB schema bump, counterfactual-tree exposure | Gated on Gate 4 spec closure |
| U | [ ] | UI — HandReplayView augmentations, HandBrowser filter, hand-review-modal, ShowdownView flag producer | Gated on E module ready + Gate 4 spec |

### Stream dependencies

```
A (Gates 1-4) ──┬──▶ E (spotResolver + schema + tree exposure) ──▶ U (UI surfaces)
                │
                └──▶ Gate 4 spec blocks E & U code
```

---

## Phases

| Phase | Status | Description | Accept Criteria |
|-------|--------|-------------|-----------------|
| 1 | [x] | Gate 1 Entry + Gate 2 Blind-Spot + Gate 3 JTBD authoring | Three artifacts on disk; YELLOW/YELLOW verdicts; SR-28..34 in atlas |
| 2 | [x] | SPOT-KEY feasibility spike | Spike artifact authored; GREEN feasibility; `spotResolver/` architecture proposed |
| 3 | [ ] | Gate 4 Surface specs | Surface artifacts updated (hand-replay-view, analysis-view, showdown-view); new `hand-review-modal` spec authored; schema spec for `hand.flags[]` + `hand.reviewState` |
| 4 | [ ] | Stream E — `spotResolver/` engine implementation | Module builds; 30+ golden-test corpus entries pass; corpus index loads at PWA boot |
| 5 | [ ] | Stream E — IDB schema migration + counterfactual-tree exposure | Schema v(next) ships additive; `gameTreeEvaluator.js` output exposed on replay analysis |
| 6 | [ ] | Stream U — HandBrowser flag filter + indicator + last-reviewed column | HE-17 consumer side ships; feature-flagged rollout |
| 7 | [ ] | Stream U — hand-review-modal + ledger render + counterfactual tab + drill-card tab | Modal overlay renders linked artifact; progressive disclosure; match confidence visible |
| 8 | [ ] | Stream U — ShowdownView HE-17 producer entry + first-open tutorial + inline glossary + keyboard shortcut | Flag-for-review gesture at record time; tutorial + glossary + L-key shortcut live |
| 9 | [ ] | Closeout | All acceptance criteria met; Playwright visual verify at 1600×720; STATUS.md / MEMORY.md / CLAUDE.md updated |

---

## Phase 1: Gate 1 + Gate 2 + Gate 3 ✓ CLOSED 2026-04-23

### Goal

Establish governance frame + close the persona/JTBD gaps before Gate 4 spec work begins.

### Deliverables

- `docs/design/audits/2026-04-23-entry-played-hand-review-protocol.md` — Gate 1 Entry, verdict **YELLOW** (3 JTBD gaps, 0 persona gaps, narrow cross-surface scope).
- `docs/design/audits/2026-04-23-blindspot-played-hand-review-protocol.md` — Gate 2 Blind-Spot Roundtable, verdict **YELLOW** (7 new JTBDs proposed, 7 Stage-C design rules, 8 Stage-E heuristic rules, 5 direct + 2 deferred partner surfaces, 2 shared-infra opportunities with exploit-deviation).
- `docs/design/jtbd/domains/session-review.md` — SR-28..34 authored (4 Active: SR-28 deep review, SR-29 analog resolution, SR-30 counterfactual tree, SR-31 flag queue; 3 Proposed: SR-32 nominate-for-corpus, SR-33 dispute claim, SR-34 spaced retrieval).
- `docs/design/jtbd/ATLAS.md` — session-review domain updated; SR-28..34 registered.

### Key decisions

- **Narrow scope confirmed.** HRP is consumer-only in v1. SR-32/SR-33/SR-34 are Proposed; v1 architects-for but doesn't build.
- **Ledger render = modal overlay, not inline.** ~60-row ledgers would break ReviewPanel density.
- **Between-Hands review explicitly excluded** from HRP. Live cadence incompatible with depth.
- **No new personas.** Post-Session Chris + Apprentice + Coach-review-session cover it.

---

## Phase 2: SPOT-KEY feasibility spike ✓ CLOSED 2026-04-23

### Goal

Empirically verify that the spot-key resolution invariant (SR-29) is computable at useful coverage before committing to Gate 4 specs.

### Deliverables

- `docs/projects/played-hand-review-protocol/spot-key-spike.md` — feasibility verdict **GREEN**; proposed `src/utils/spotResolver/` architecture with 7 files and public API shape.

### Key findings

- **Texture + position vocabularies already match upper-surface encoding verbatim** — `boardTexture.analyzeBoardTexture()` returns `'wet'/'medium'/'dry'` exactly as the corpus encodes; `positionUtils.POSITION_NAMES` matches `BTN/BB/CO/SB/UTG` naming. Zero-conversion join.
- **~70% of dimensions extractable with zero new code** (position, IP/OOP, texture, stack, SPR, action history, cards, hero combo).
- **~20% shallow build** (~30 LoC for pot-type inference + board shorthand).
- **~10% hard build** (~100 LoC node classifier — street + action prefix + board transition → canonical node_id).
- **Corpus: ~82 teaching nodes** (6 upper-surface artifacts + ~76 LSW line nodes). Pilot-phase; grows as LSW audits + upper-surface authoring continue.
- **Typical coverage: ~40–50% strong match, ~20–30% partial, ~15–25% no analog.** Honest confidence reporting + graceful empty state mitigate. Low coverage *is* the call-to-action for SR-32 (nominate-for-corpus) loop-closer.
- **Villain range not a v1 blocker** — HRP renders linked artifact assertions, not re-derived range.

### Engineering estimate

- `spotResolver/` module: ~200 LoC pure utilities + ~150 LoC golden-test corpus.
- ~1–2 sessions of focused work.

---

## Phase 3: Gate 4 Surface Specs [ ] NEXT <- CURRENT

### Goal

Author or update all surface artifacts HRP touches, consuming the Gate 2 Stage-C + Stage-E design rules as explicit spec requirements.

### Deliverables (to ship)

- [ ] `docs/design/surfaces/hand-replay-view.md` — **update** with HRP augmentations: ledger-link icon per decision point, modal overlay architecture, match-confidence indicator, keyboard shortcut (L).
- [ ] `docs/design/surfaces/analysis-view.md` — **update** HandBrowser sub-component: flag filter, flag indicator on hand card, last-reviewed column.
- [ ] `docs/design/surfaces/showdown-view.md` — **update** with HE-17 producer entry (flag-for-review button).
- [ ] `docs/design/surfaces/hand-review-modal.md` — **NEW** spec: tabs (summary / claims ledger / counterfactual tree / drill card / full artifact), progressive disclosure rules, touch-target rules, first-open tutorial, inline glossary binding.
- [ ] Schema spec (inline in hand-review-modal or side file): `hand.flags[]` shape, `hand.reviewState` shape, IDB version bump plan (additive-only).
- [ ] Coordination note with `docs/projects/exploit-deviation.project.md` Phase 6+ on `AssumptionCard` shared component.

### Entry prerequisites (all met)

- [x] Gate 1 YELLOW verdict rendered.
- [x] Gate 2 YELLOW verdict rendered.
- [x] Gate 3 JTBDs authored (SR-28..34 in session-review.md).
- [x] SPOT-KEY feasibility GREEN.

### Acceptance criteria

- All 5 surface docs shipped.
- Each spec references Gate 2 Stage-C + Stage-E rules that constrain it.
- Schema additions additive-only (backwards-compatible load path for legacy hands).
- No code in this phase.

---

## Phase 4: Stream E — `spotResolver/` engine [ ]

### Goal

Build the spot-key resolution module per the SPOT-KEY spike's proposed architecture.

### Deliverables

- [ ] `src/utils/spotResolver/CLAUDE.md` — module rules (pure, no writes, pokerCore only).
- [ ] `src/utils/spotResolver/index.js` — public `resolveSpot(hand, decisionIndex) → SpotMatch` API.
- [ ] `src/utils/spotResolver/spotKeyExtractor.js` — extract 8-dim spot descriptor.
- [ ] `src/utils/spotResolver/potTypeInference.js` — preflop-raise-count → potType.
- [ ] `src/utils/spotResolver/boardShorthand.js` — cards → 'T96ss'/'Q72r'/'K77'.
- [ ] `src/utils/spotResolver/nodeClassifier.js` — street + action prefix + board transition → canonical node_id.
- [ ] `src/utils/spotResolver/corpusIndex.js` — in-memory index of upper-surface + LSW nodes, built at PWA boot.
- [ ] `src/utils/spotResolver/matchScorer.js` — descriptor × corpus → scored matches.
- [ ] `__tests__/` — 30+ golden-test corpus entries.

### Acceptance criteria

- All unit tests pass.
- Manifest regeneration script in place for upper-surface filenames.
- CI fails if LSW `lines.js` renames a node without classifier update.
- No imports from `exploitEngine/` or `rangeEngine/`.

---

## Phases 5–9

Detailed in the Phases table above. Ship in order; each phase has entry prerequisites.

---

## Open questions

1. **AssumptionCard component ownership** — HRP's ledger-row render and exploit-deviation's MH-12 live-citation card are near-identical in shape. Which project authors the shared component? Recommendation: whichever gets to Phase 4/6 first. Coordinate via handoff.
2. **HE-17 implementation audit** — does the flag field exist in the hand schema today, or is HE-17 atlas-listed-only? Needs verification in Phase 3 before spec can specify schema additions correctly.
3. **Offline corpus verification** — do upper-surface `.md` files + LSW `lines.js` ship in the PWA precache manifest? Needs verification in Phase 3.
4. **Corpus growth coupling** — HRP coverage grows as LSW audits + upper-surface authoring continue. Should HRP's backlog track corpus growth as a dependency, or treat it as orthogonal?

---

## Backlog items

For `.claude/BACKLOG.md` when owner approves:

```
- [ ] HRP-G4-SPEC — Gate 4 surface specs: hand-replay-view + analysis-view +
      showdown-view updates, new hand-review-modal spec, schema spec.
      Blocks: HRP-E-RESOLVER, HRP-U-*. Effort: M. Priority: P2.

- [ ] HRP-E-RESOLVER — Implement src/utils/spotResolver/ per spike architecture.
      30+ golden-test corpus entries. Blocks: HRP-U-*. Effort: M-L. Priority: P2.

- [ ] HRP-E-SCHEMA — IDB schema bump: hand.flags[] + hand.reviewState additive.
      Backwards-compatible load path. Effort: S. Priority: P2.

- [ ] HRP-E-TREE-EXPOSE — Expose depth-2/3 counterfactual tree from
      gameTreeEvaluator.js output through useHandReplayAnalysis (currently discarded).
      Effort: S. Priority: P2.

- [ ] HRP-U-BROWSER — HandBrowser flag filter + flag indicator +
      last-reviewed column. Effort: S-M. Priority: P2.

- [ ] HRP-U-MODAL — hand-review-modal component + ledger render +
      counterfactual tab + drill-card tab + artifact tab + progressive disclosure.
      Effort: L. Priority: P2.

- [ ] HRP-U-SHOWDOWN — ShowdownView HE-17 producer entry (flag-for-review button).
      Effort: S. Priority: P2.

- [ ] HRP-U-POLISH — First-open tutorial + inline glossary + L keyboard shortcut.
      Effort: S-M. Priority: P2.

- [ ] HRP-COORD-MH12 — Coordinate with exploit-deviation Phase 6+ on
      AssumptionCard shared component. Effort: S. Priority: P2.
```

---

## Session log

- **2026-04-23 Session 1 — Gate 1 + Gate 2 + Gate 3 + SPOT-KEY spike + charter.** Four artifacts shipped: Gate 1 Entry (YELLOW), Gate 2 Blind-Spot Roundtable (YELLOW), SR-28..34 authoring in session-review.md + ATLAS.md, SPOT-KEY feasibility spike (GREEN). Project charter (this file) authored. Ready for Gate 4 surface specs. Handoff: `.claude/handoffs/hrp-gates-1-2-3-spike.md`.

---

## Change log

- 2026-04-23 — Created. Phases 1+2 closed same session. Phase 3 (Gate 4 specs) next.
