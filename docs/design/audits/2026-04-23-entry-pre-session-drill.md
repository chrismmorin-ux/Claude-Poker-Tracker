# Gate 1 Entry — 2026-04-23 — Pre-Session Drill

**Feature working name:** Pre-Session Drill
**Proposed by:** Chris (owner) — 2026-04-22, in upper-surface project conversation: *"We actually should be capturing this forced high-level explanations in the UX, and I think it probably belongs output to the user in a pre-session drill."*
**Gate:** 1 (Entry) — mandatory
**Next gate:** 2 (Blind-Spot Roundtable) — required per verdict below
**Status:** OPEN — this document is the Gate 1 artifact; no code written. **Implementation explicitly deferred per upper-surface project plan** (Stage 6 stops at Gate 1; Gate 2 + downstream gates are separate work, owner-scheduled).

---

## Feature summary (as proposed)

The pre-session drill is a user-facing surface that delivers compressed `drill cards` (per Stage 5 of the upper-surface program) immediately before a live cash session. Each card represents one decision node from the upper-surface reasoning artifact corpus. The drill is **active recall**: card front shows the spot, user predicts the action, card back reveals action + 3 reasoning beats + sensitivity pivot + falsification criterion + section anchors back into the source artifact.

Distinct from existing drilling because:

- **Timing context:** delivered in a 5–10 minute window before sitting down at a live table; not a study block, not a post-session review.
- **Selection algorithm:** recency-weighted (spots the user got wrong recently) and frequency-weighted (spots the user faces most often), not random rotation through the static drill library.
- **Format:** front-back active-recall card derived mechanically from upper-surface artifacts (with grep-validated faithfulness), not the existing answer-then-explanation flow of `PostflopDrillsView`.
- **Goal:** prime pattern recognition right before live decisions, not teach new theory.

Owner intent (verbatim from project conversation): *"this then a sort of upper surface of our understanding, and so it becomes a standard by which we can grade ourselves... we can compare it to other leading poker theories... we should be capturing this forced high-level explanations in the UX, and I think it probably belongs output to the user in a pre-session drill."*

---

## Critical scope-shifting discovery

Before writing this Gate 1, three load-bearing realities about the current state surfaced. Each shifts the scope of what "pre-session drill UX" actually means today.

### Discovery 1 — The upper-surface artifact corpus is 2 nodes

The pre-session drill consumes the corpus produced by the upper-surface program. As of this Gate 1 authoring, the corpus consists of exactly two artifacts (flop pilot + river pilot) and two drill cards (Stage 5 deliverables). **A 2-node drill is not a meaningful pre-session experience.**

For comparison: the LSW project library targets 8 lines with ~50 total decision nodes. Even if every LSW node had a corresponding upper-surface artifact (and currently most do not — only the two pilots do), 50 cards is the minimum useful corpus for a recency-weighted rotation.

**Implication:** the pre-session drill UX is **gated on corpus growth**, not just on UX design. Designing the surface ahead of meaningful corpus is premature. The corollary is that the upper-surface program's *next priority after this plan* should be corpus scaling, not surface implementation.

### Discovery 2 — `PostflopDrillsView` already implements ~40% of the concept

`src/components/views/PostflopDrillsView.jsx` ships with multiple modes (Drill, Explorer, Line). The "Drill" mode already:

- Selects a decision node from the static LSW line library
- Presents the spot
- Accepts user input (action selection)
- Reveals the answer + authored rationale
- Records the user's hit/miss for stats

What it does *not* do that the pre-session drill needs:

1. **Active-recall front/back format.** Current Drill mode shows answer + rationale immediately after user selects; doesn't gate the reveal, doesn't structure as predict-then-flip with falsification.
2. **Recency-weighted selection.** Current selection is round-robin or user-chosen; no integration with user's hand-history-based recent-leak detection.
3. **Corpus reading from upper-surface artifacts.** Current rationales are inline in `lines.js` authored content, not pulled from the upper-surface artifact corpus.
4. **Pre-session timing context.** No "5-minute pre-session warm-up mode" UI affordance distinct from the open-ended drill flow.
5. **Mechanical artifact anchors.** Current drill rationales are free prose; upper-surface drill cards have grep-validated section anchors back to the source artifact for "dig deeper" navigation.

**Implication:** this is **not greenfield.** Significant overlap with `PostflopDrillsView` Drill mode. The right design move is likely a **new mode** (e.g., "Pre-Session") inside PostflopDrillsView, not a new routed view. Same Drills Consolidation HOLD constraint as Range Lab.

### Discovery 3 — Recency-weighted selection requires hand-history integration

The selection algorithm ("spots the user got wrong recently") requires the drill to read from the user's stored hand history (IndexedDB `hands` store) and cross-reference against decision-node identifiers. The cross-reference layer doesn't exist:

- Hand history records actions but not "which upper-surface node this hand passed through."
- Upper-surface artifacts are tagged by node-ID but no reverse-index from hand → matching nodes.
- A recency algorithm needs frequency stats per node-ID across user's recent hands (`session-stats` aggregation level).

**Implication:** "recency-weighted" is **infrastructure work**, not just selection logic. Either accept this as Phase 2 (start with random rotation) or front-load infrastructure as Phase 0.

---

## Output 1 — Scope classification

**Primary classification:** New mode within `postflop-drills` surface (not a new routed view), implementing active-recall card format + corpus-derived content + recency-weighted selection.

**Secondary classification considerations:**

- **"New interaction pattern"** (active-recall flip card with falsification reveal) — per LIFECYCLE table, this triggers Gate 2 even when added to an existing surface.
- **Drills Consolidation HOLD** (per `surfaces/postflop-drills.md` Known Issues) — same constraint as Range Lab. Pre-Session Drill execution must stay inside `PostflopDrillsView`'s existing mode-bar bounds, OR wait for the StudyView consolidation resolution.
- **Cross-surface ripples** likely via cross-linking from `hand-replay-view` ("review this decision in pre-session drill format next session") and from `sessions-view` ("show me pre-session drill for tomorrow's spots"). Additive entry points, not scope changes to those surfaces.
- **Cross-system ripple** with `docs/upper-surface/` — drill UX consumes upper-surface artifact corpus. The upper-surface program's growth rate is the rate-limit on drill content, not UX implementation speed.

**NOT a full new routed view.** A `SCREEN.PRE_SESSION_DRILL` top-level route is **rejected by this Gate 1** unless Drills Consolidation resolves against StudyView and pre-session needs its own home.

---

## Output 2 — Personas identified

### In scope (pre-session drill primary users)

| Persona | Role | Core/Situational |
|---|---|---|
| [Chris (owner)](../personas/core/chris-live-player.md) | Primary user; pre-session warm-up before live cash | Core |
| [Rounder](../personas/core/rounder.md) | Serious live-cash player with regular session routine | Core |
| [Hybrid semi-pro](../personas/core/hybrid-semi-pro.md) | Mixed live+online; pre-session for live blocks | Core |
| [Apprentice](../personas/core/apprentice-student.md) | Student doing focused warm-up before play | Core |
| [Pre-session Chris](../personas/situational/?) | The 5-10 min before sitting at a live table | Situational — primary |
| [Post-session Chris](../personas/situational/post-session-chris.md) | Reviews session-just-finished; flag spots for next session's drill | Situational — secondary |

### Out of scope (explicitly excluded)

- [Mid-hand Chris](../personas/situational/mid-hand-chris.md) — live play. Pre-session drill is **not** in-game.
- [Between-hands Chris](../personas/situational/between-hands-chris.md) — too tight a window for full active-recall cycle.
- [Multi-tabler](../personas/core/multi-tabler.md) — online grinder, no pre-session pattern.
- [Newcomer](../personas/core/newcomer.md) — pre-session warm-up is for established players with a study practice.
- [Scholar (drills-only)](../personas/core/scholar-drills-only.md) — Scholar studies on their own schedule, not pre-session-tied. Could use the cards in study mode (which is the existing PostflopDrillsView Drill mode), not pre-session.

### Persona-sufficiency check

> *"Does our current cast actually cover this feature, or do we need a new persona?"*

**Answer: YELLOW — likely new situational persona needed: "Pre-session Chris" or equivalent.**

The existing situational personas cover `study-block` (deep focused study), `first-principles-learner` (learning-by-explanation), `mid-hand-chris` (live play), `between-hands-chris` (10-second window), and `post-session-chris` (review). **None of these covers "5-10 min before sitting down at a live table."**

The pre-session window has distinct properties:

- Time pressure: 5-10 minutes (vs `study-block`'s open-ended)
- Goal: pattern priming, not theory learning (vs `first-principles-learner`'s explanation-mode)
- State: not yet in-game (vs `mid-hand-chris`)
- Direction: forward-looking (vs `post-session-chris`'s review)
- Cognitive load: low — user is preparing to think hard, not thinking hard yet

**Gate 2 must decide:** create `pre-session-chris` situational, or extend `post-session-chris` to bidirectional (post-session + pre-next-session as paired situations)?

---

## Output 3 — JTBD identified

### Already served by `PostflopDrillsView` Drill mode (inherited)

- **DS-44** — Correct-answer reasoning (not just score) — *Active*
- **DS-50** — Walk a hand line branch-by-branch with consequences shown — *Active* (via Line mode)

### Partially served; pre-session drill extends

- **DS-44** extends to "explanation includes falsifier and pivot" (the upper-surface drill card format adds falsification criterion not in current Drill mode)
- **DS-45 (proposed in Range Lab Gate 1)** — Custom drill from own hand history — adjacent: pre-session drill's recency-weighted selection is the consumer of this same hand-history-cross-reference infrastructure

### Proposed (new — flagged for Gate 3 authoring if Gate 2 confirms YELLOW/RED)

1. **DS-56 (proposed)** — *Active-recall pattern priming for upcoming session*
   > When I'm 5–10 minutes before a live cash session, I want to be shown 3-5 decision nodes I can predict the answer to before flipping to the explanation, so my pattern recognition is warm when I sit down.
   - Personas: Chris, Rounder, Hybrid semi-pro, Apprentice
   - Distinct from DS-44 (correct-answer reasoning) which is post-decision; DS-56 is pre-prediction with active recall.

2. **DS-57 (proposed)** — *Drill on spots I got wrong in recent sessions*
   > When I review my last session's mistakes and want to focus tomorrow's pre-session drill on those leak patterns, I want the drill selector to weight recently-missed nodes higher than random rotation, so I'm targeting my actual leaks.
   - Personas: Chris, Rounder, Apprentice, Coach
   - Requires hand-history → upper-surface-node-ID cross-reference (Discovery 3).
   - Distinct from DS-45 (custom drill from history) which is user-initiated single-hand; DS-57 is automated recency-weighting across the drill library.

3. **DS-58 (proposed)** — *Anchor-trace from drill card to deep artifact when curious*
   > When a drill card raises a question I want to dig into, I want one-tap navigation from card to the source upper-surface artifact section, so I can read the full §11 ledger or §13 leading-theory comparison.
   - Personas: Scholar, Coach, Chris
   - Requires upper-surface artifact corpus accessible from app (not just docs/).

4. **DS-59 (proposed)** — *Verify a drill card's claim by re-running the falsifier*
   > When I doubt a drill card's recommendation, I want to see the falsification criterion (the §14b headline falsifier from the artifact) and a path to verify or refute it via population sample, so I can update my model rather than blindly accepting the card.
   - Personas: Scholar, Chris-as-author, Coach
   - The "verify" path may be informational-only (show the falsifier) or actionable (auto-query a hand-history sample if available).

### JTBD-coverage check

> *"Does any proposed outcome not map to an existing JTBD?"*

**Answer: YELLOW — 4 proposed new JTBDs, all in `drills-and-study` domain.** None requires a new domain. DS-56/57 are pre-session-specific; DS-58/59 are artifact-corpus-integration JTBDs that could also serve other surfaces (Range Lab study mode could surface DS-58/59 too).

---

## Output 4 — Gap analysis verdict

| Dimension | Verdict | Notes |
|---|---|---|
| Personas | 🟡 YELLOW | Likely new situational persona ("pre-session Chris") needed; Gate 2 decides create-vs-extend |
| JTBD | 🟡 YELLOW | 4 proposed additions to `drills-and-study` (DS-56/57/58/59). No new domain. |
| Interaction pattern | 🟡 YELLOW | Active-recall flip card with falsification reveal is new — not present anywhere in codebase |
| Surface structure | 🟡 YELLOW | Drills Consolidation HOLD constrains placement; must stay inside PostflopDrillsView mode-bar |
| Cross-surface ripples | 🟡 YELLOW | Hand-history cross-reference (DS-57) requires `hands` ↔ `upper-surface-node-ID` infrastructure that doesn't exist |
| Corpus dependency | 🔴 **RED** | **Upper-surface corpus is 2 nodes; minimum-viable drill needs 50+. Drill UX is corpus-gated, not just design-gated.** |

### Overall Gate 1 verdict: 🔴 **RED**

The corpus-dependency is the load-bearing reality. **A pre-session drill UX with 2 cards is not a meaningful product**, regardless of how well the surface is designed. The first scaling step is *not* design — it's **growing the upper-surface artifact corpus** from 2 nodes to a useful library size (~50 nodes minimum).

Other dimensions (personas, JTBDs, interaction, surface, cross-surface) are all YELLOW — typical Gate-2-required signals for a new surface. None of these is a blocker individually; the corpus dimension is the blocker collectively.

### Gate 2 (Blind-Spot Roundtable) is required, BUT

**Recommendation: defer Gate 2 until corpus scaling demonstrates feasibility.** Specifically: defer until upper-surface corpus reaches at least **15 artifacts** (3 lines × ~5 decision nodes per line). At 15 artifacts, Gate 2 can credibly stress-test the drill UX with a corpus that approximates the eventual production scale.

If owner wants Gate 2 sooner (e.g., to lock down design constraints before scaling), it can run on the 2-pilot corpus with the explicit caveat that selection-algorithm and recency-weighting cannot be meaningfully roundtabled at that scale.

### Gate 2 scope (pre-loaded for whenever it runs)

Five stages of roundtable to run when scheduled:

- **Stage A — Persona sufficiency:** Decide create-vs-extend `pre-session-chris` situational persona vs extending `post-session-chris` to bidirectional.
- **Stage B — JTBD coverage:** Validate DS-56/57/58/59 framings; check whether DS-58 (anchor-trace) and DS-59 (falsifier-verify) are scope-creep into Range Lab territory.
- **Stage C — Situational stress:** Walk `pre-session-chris` (or its successor) through a 5-10 minute drill experience. Where does cognitive load + time pressure + mobile constraints (1600×720 portrait pre-session, possibly worse in cab/walking) interact?
- **Stage D — Cross-surface:** Hand-history → node-ID cross-reference: schema impact on `hands` store? Performance impact at full session-history scale?
- **Stage E — Heuristic pre-check:** Nielsen's "match between system and real world" (active-recall is a strong cognitive-science pattern; verify our flip-card UX matches user mental model); ML06 touch-target (card flip area at scale 1.0); destructive-action absorption (does "skip this card" auto-mark as miss or auto-mark as not-attempted?).

---

## Required follow-ups (blocking Gate 4)

- [ ] **Upper-surface corpus scaling** — primary blocker. Target: 15+ artifacts (3+ lines × ~5 decision nodes each) before drill UX is meaningfully designable. **This is a separate work track from the design-framework gates** — it's content authoring, not design. Owner can authorize corpus scaling independent of UX gate progression.
- [ ] **Gate 2 — Blind-Spot Roundtable** — run when corpus scaling reaches ≥15 artifacts (or sooner with caveats). Output at `docs/design/audits/YYYY-MM-DD-blindspot-pre-session-drill.md`.
- [ ] **Gate 3 — Research (conditional on Gate 2 verdict)** — author DS-56/57/58/59 as `Proposed` in `drills-and-study.md`; possibly observe how Chris uses session-prep workflows today (owner interview).
- [ ] **Gate 4 — Design** — surface artifact update to `surfaces/postflop-drills.md` documenting Pre-Session mode addition; **NOT** a new `surfaces/pre-session-drill.md` file (unless Drills Consolidation resolves).
- [ ] **Prerequisite outside gate ceremony (Phase 0 engineering, authorized post-Gate 4):** build `hands` ↔ `upper-surface-node-ID` cross-reference infrastructure. Schema decision: tag `hands` records with matching node-IDs at write-time (cheap, requires node-matching logic), or compute matches on-demand via session-stats query (no schema change, but query cost). Estimated 200-300 LOC + tests.

---

## Open questions for owner (before Gate 2)

1. **Corpus scaling priority.** Is the upper-surface corpus growth track (extending Stage 2a/2b pattern to more nodes) authorized as the next priority work after this plan? The drill UX is corpus-gated; without corpus growth, the design gates are exercises rather than build-prep.

2. **Pre-session vs post-session pairing.** The pre-session drill's `DS-57` (recency-weighted from recent leaks) is functionally paired with a post-session "flag this spot for next pre-session drill" workflow. Should Gate 2 stress-test the pre-session feature in isolation, or as the trailing half of a pre+post-session loop? The latter is more honest about the actual usage pattern but doubles Gate 2 scope.

3. **Drills Consolidation collision (recurring).** Same constraint as Range Lab. If `StudyView` consolidation resolves against merging, Pre-Session Drill becomes a cleaner standalone candidate. Do you want a decision on StudyView before Gate 2 runs, or is Gate 2 allowed to assume "stay inside PostflopDrillsView mode-bar" as a constraint?

4. **Mobile / context-of-use scope.** "Pre-session" implies the user may be on phone in a cab, walking to the cardroom, or sitting at the table seconds before play starts. Mobile-portrait UX is dramatically tighter than the 1600×720 landscape baseline. Is mobile-portrait a hard requirement (likely yes for genuine pre-session use), or is desktop/landscape-only acceptable for v1?

5. **Active-recall design philosophy.** Two competing patterns: **flip-card** (front shows spot, tap to reveal back) vs **side-by-side** (spot + masked answer that reveals on tap). Flip-card is more game-like; side-by-side is faster for high-volume drill blocks. Owner preference shapes Gate 4 design substantially.

6. **Anchor-trace destination (DS-58).** Where does "dig deeper" navigation go? Options: (a) in-app rendering of the upper-surface artifact (requires bundling `docs/upper-surface/` into the app); (b) external link to a hosted version of the docs; (c) inline expansion (truncated artifact section appears in-card); (d) defer to Range Lab if Range Lab implements artifact rendering. Decision shapes app bundle size.

---

## Links

- Feature lifecycle: [`docs/design/LIFECYCLE.md`](../LIFECYCLE.md)
- Methodology: [`docs/design/METHODOLOGY.md`](../METHODOLOGY.md)
- Roundtable template: [`docs/design/ROUNDTABLES.md`](../ROUNDTABLES.md)
- Surface this expands: [`surfaces/postflop-drills.md`](../surfaces/postflop-drills.md)
- JTBD domain affected: [`jtbd/domains/drills-and-study.md`](../jtbd/domains/drills-and-study.md)
- Drills Consolidation HOLD context: [`.claude/context/DRILL_VIEWS.md`](../../../.claude/context/DRILL_VIEWS.md)
- Upper-surface program rubric: [`docs/upper-surface/RUBRIC.md`](../../upper-surface/RUBRIC.md)
- Upper-surface program plan: [`C:\Users\chris\.claude\plans\cryptic-moseying-sprout.md`](in plans dir)
- Source pilot artifacts:
  - [`docs/upper-surface/reasoning-artifacts/btn-vs-bb-3bp-ip-wet-t96-flop_root.md`](../../upper-surface/reasoning-artifacts/btn-vs-bb-3bp-ip-wet-t96-flop_root.md)
  - [`docs/upper-surface/reasoning-artifacts/btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md`](../../upper-surface/reasoning-artifacts/btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md)
- Source drill cards (Stage 5 deliverables, the prototype surface for this feature):
  - [`docs/upper-surface/drill-cards/btn-vs-bb-3bp-ip-wet-t96-flop_root.md`](../../upper-surface/drill-cards/btn-vs-bb-3bp-ip-wet-t96-flop_root.md)
  - [`docs/upper-surface/drill-cards/btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md`](../../upper-surface/drill-cards/btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md)
- Range Lab Gate 1 (template + adjacent feature): [`./2026-04-22-entry-range-lab.md`](./2026-04-22-entry-range-lab.md)

---

## Change log

- 2026-04-23 — Created. Authored as Stage 6 of the upper-surface program (`C:\Users\chris\.claude\plans\cryptic-moseying-sprout.md`). Verdict RED — corpus-dependency is the primary blocker; Gate 2 deferred until upper-surface corpus reaches ~15 artifacts. UX design surfaced (4 new JTBDs, new situational persona candidate, new interaction pattern) but not load-bearing for the RED verdict.
