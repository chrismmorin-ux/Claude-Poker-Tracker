# Gate 1 Entry — 2026-05-02 — Self-Coach Foundation (SCF)

**Feature working name:** Self-Coach Foundation (SCF)
**Proposed by:** Master Plan ratified 2026-04-30 (`docs/projects/master-plan-2026-04-30.md` §D); SCF-G1 was ratified to run *parallel with* Phase 1 (TIA) per binding ratification #6 but slipped. Now the longest-overdue ratified deliverable; runs as Master Plan Phase 2 starter.
**Gate:** 1 (Entry) — mandatory
**Next gate:** 2 (Blind-Spot Roundtable) — required per verdict below
**Status:** OPEN — this document is the Gate 1 artifact. No production code written. Audit-only per `docs/design/LIFECYCLE.md` Gate 1 contract.
**Sprint:** SPR-012 / WS-009.

---

## Feature summary (as proposed)

A "Self-Coach Foundation" capability that closes the leak-to-lesson loop on the **hero side**. The user reviews their own play (during, after, or between hands), the system surfaces detected leaks in their own decisions (not the villain's), points them at the next teachable concept they're ready to learn given their current tier, and lets them validate whether prior coaching has translated into actual play improvement. A new behavioral signal — pre-verdict confidence rating — converts the gap between predicted confidence and observed correctness into a coaching input.

Master Plan §D set the rough proportions: *"~70% detection infra exists; missing skill assessment + authoring framework + curriculum spine."* This Gate 1 audit revises that estimate with codebase evidence (see §Discovery).

Owner-decided scope (2026-05-02, captured in plan-mode AskUserQuestion):

1. **Persona.** No new persona file. Extend the existing `chris-live-player` core persona with overall-tier metadata. SCF is the same person in self-coach mode.
2. **Skill ladder.** 6 tiers — `novice / live-rec / studied-amateur / part-time-grinder / serious-grinder / pro`.
3. **JTBDs to propose.** All 4 — `see-leak-without-being-graded` + `learn-next-concept-im-ready-for` + `validate-im-improving` + `self-rate-confidence-on-a-line`.

---

## Critical scope-shifting discoveries

Five realities surfaced by Phase-1 codebase exploration that materially shape what "Self-Coach Foundation" means today.

### Discovery 1 — chris-live-player ALREADY HAS a sophisticated skill-state attribute; SCF's tier ladder is a NEW concept that coexists, not replaces

`chris-live-player.md` lines 59–79 (Skill-state attribute, added 2026-04-23 in Poker Shape Language Gate 3 R1) defines a **per-domain mastery shape** with `level` / `confidence` / `lastValidatedAt` / `trendDirection` / `userMuteState`, with the explicit comment: *"taxonomy per Gate 3 R1; 3–5 ordinal values"*. Per-domain means this attribute exists once per Shape Language descriptor, once per range chart, once per postflop decision rule, etc.

The 6-tier SCF ladder is **a different concept**: an **overall player tier** (novice → pro) that gates curriculum sequencing. It does not replace per-domain mastery; it sits one level up.

| Concept | Granularity | Values | Use |
|---------|-------------|--------|-----|
| Per-domain Skill-state attribute (existing) | One per descriptor / chart / decision rule | 3–5 ordinal | Drill-level prioritization, decay, mute |
| Overall tier (SCF, new) | One per user | 6 ordinal (novice / live-rec / studied-amateur / part-time-grinder / serious-grinder / pro) | Curriculum-spine sequencing ("at studied-amateur, learn polarization next") |

**Implication:** the audit must explicitly distinguish these two concepts. Adding tier metadata to `chris-live-player.md` does NOT amend the prior 3–5 ordinal Skill-state taxonomy; the two coexist and SCF's curriculum spine reads BOTH (tier picks which concept-area is teachable next; per-domain mastery picks which drill within that concept-area).

### Discovery 2 — `coaching.md` JTBD domain ALREADY EXISTS but is framed for COACH-as-third-party, not self-coaching

`docs/design/jtbd/domains/coaching.md` exists (CO-48..53), authored 2026-04-21. Its primary persona is **Coach** (third-party tutor reviewing a student's play). All six existing JTBDs are coach-side workflow: hand queue, voice annotation, save pattern as reusable lesson, assign drills, week-over-week trend reporting (for fee justification), skill-baseline assessment for new student.

SCF is **the same user as both coach and student**. Different ergonomics: no privacy boundary, no fee justification, no week-over-week reporting for billing. Two paths considered:

| Path | Pro | Con |
|------|-----|-----|
| (A) Extend `coaching.md` with self-coaching sub-section + CO-54..57 | One domain file; clean ATLAS entry; both modes available to readers | Domain scope expands; the existing "coach reviews student" framing now has a sibling "user coaches self" |
| (B) Author new `self-coaching.md` domain with new prefix (SC?) | Strong domain separation | New domain file; ATLAS gets a new row; SC prefix collides cognitively with subscription / session-create |

**Recommendation: path (A)** — extend `coaching.md`. Lower friction and the duality is documentable inline. The new sub-section explicitly states "CO-48..53 = formal-coach mode (third-party tutor); CO-54..57 = self-coach mode (user is both)." Owner reviews and amends in Open Questions §Q2.

### Discovery 3 — Several existing DS-* JTBDs partially overlap with SCF's proposed JTBDs

Phase-1 grep through `drills-and-study.md` surfaced material overlap:

| SCF proposed JTBD | Existing DS-* with overlap | Distinction |
|-------------------|----------------------------|-------------|
| see-leak-without-being-graded | None | **Net-new.** No existing JTBD captures the explicit non-grading framing as a load-bearing constraint. |
| learn-next-concept-im-ready-for | DS-47 (skill map), DS-43 (10-min drill on weak concept), DS-46 (spaced repetition) | **Net-new but adjacent.** DS-* are drill-level (which exercise to do next); SCF is curriculum-level (which concept to study next). The decision precedes drill selection. |
| validate-im-improving | DS-56 (calibration check), DS-58 (validate-confidence-matches-experience) | **Re-framing candidate.** DS-58 is anchor-claim calibration (does this exploit anchor still hold?); DS-56 is self-reported-fluency vs drill-data alignment. SCF's `validate-im-improving` is about HERO leak fixing translating into hero play improvement — different referent (hero leak), same shape (predicted vs observed). May reduce to DS-58 with an additional referent dimension or stand alone. |
| self-rate-confidence-on-a-line | None | **Net-new.** No existing JTBD elicits pre-decision confidence so the gap becomes a coaching signal. Closest adjacent is MH-12 (cited assumption trust bridge), but MH-12 is consumer-side (the user reads a system claim), not generator-side (the user produces a confidence rating). |

**Implication:** SCF JTBDs are 2 net-new + 1 net-new-but-adjacent + 1 re-framing-candidate. The audit proposes all 4 but flags `validate-im-improving` for explicit reconciliation with DS-58 in Gate 2 (Blind-Spot Roundtable) — they may collapse, may stay separate.

### Discovery 4 — Master Plan estimate "~70% detection infra exists" is accurate for VILLAIN side; HERO side is ~20%

Phase-1 inventory of `src/utils/exploitEngine/`:

- **Villain weakness detection (RED ✓):** `weaknessDetector.js` is fully built. 12 situational + 5 preflop weakness rules. Each detected weakness carries `id / category / label / description / position / street / context (texture) / severity (0-1) / confidence (Bayesian) / sampleSize / evidence / situationKeys`. Surfaces: `ExploitList.jsx`, `VillainProfileModal.jsx`, `ExploitBriefingCard.jsx`. **Mature production capability.**
- **Hero leak detection (GREEN ✗):** `heroAnalysis.js::assessHeroEV` scores INDIVIDUAL hero actions as ±EV given equity vs villain range. `replayAnalysis.js::buildHeroCoaching` adds hero-frame reasoning. **No aggregate hero-pattern detector exists.** No `detectHeroWeaknesses(handsByHero, ...)` function. No hero-decision-bucket accumulator analogous to `decisionAccumulator.js`. No surface annotates seat-specific hero weaknesses.
- **Skill / tier metadata (GREEN ✗):** Phase-1 grep found zero tier / skillLevel / proficiency fields anywhere in persistence (`playersStorage.js`, `settingsStorage.js`, `subscriptionStore.js`). The existing per-domain Skill-state attribute (Discovery 1) has shape but **no persistence implementation** — it's a persona-doc spec, not a live data model.
- **Drill content corpus (RED ✓):** `drillContent/lessons.js` has 10 curated lessons; `frameworks.js` has 9 equity frameworks. **Mature corpus, no curriculum.**
- **Curriculum spine / sequencing (GREEN ✗):** Lessons are standalone. Zero prerequisite/dependency graph. The drill scheduler (`drillContent/scheduler.js`) weights by accuracy but has no concept-progression rules.
- **Lesson-to-leak binding (GREEN ✗):** No persistence linking detected hero leak → assigned lesson.
- **Confidence-elicitation infrastructure (GREEN ✗):** Nothing for the 4th JTBD.
- **Surfaces (YELLOW partial):** `HandReplayView` ReviewPanel partially supports hero feedback via `assessHeroEV`. No dedicated SCF surface.

**Revised Master Plan estimate:** detection infra is 70% on the villain side, 20% on the hero side. Curriculum + skill ladder + lesson-to-leak binding + confidence elicitation are all ~0%. **Total SCF infra surface that needs net-new authoring is larger than the master plan note suggested.** This is the honest update; it does not invalidate the project, it sizes it.

### Discovery 5 — The 9 autonomy red lines BIND every SCF feature

`chris-live-player.md` §Autonomy constraint (lines 106–122) lists 9 red lines promoted to persona-level invariants. Every SCF feature is gated by these. The most load-bearing for SCF specifically:

| Red line | SCF implication |
|----------|----------------|
| #1 Opt-in enrollment required — no silent skill inference | SCF's curriculum-spine + leak-detection MUST be opt-in. Tier metadata is owner-set or owner-confirmed-from-inference, never silent. |
| #5 No streaks, shame, or engagement-pressure | The `see-leak-without-being-graded` JTBD is literally a red-line-#5 enforcement clause as a JTBD. Coaching surfaces must use editor's-note tone. |
| #6 Flat access — adaptivity sets order, never gates content | Tier metadata can sequence "what to study next" but cannot HIDE concepts. A user at `live-rec` tier can still elect to drill `serious-grinder`-level concepts. |
| #7 Editor's-note tone — no gamified-infantile language | All SCF copy: "Note: your fold-to-cbet rate is high in IP" — never "Hint: you might be folding too much! 😊" |
| #8 No cross-surface contamination | SCF's hero-leak inference stays in self-coach mode. Live surfaces (OnlineView, sidebar) do NOT render hero-leak annotations on seats. |

**Implication:** the 9 red lines are not optional SCF guardrails — they are persona-level invariants the audit explicitly inherits. Gate 2 (Blind-Spot Roundtable) must pre-check every proposed surface against all 9.

---

## Output 1 — Scope classification

**Primary classification:** **Cross-surface journey change + system-coherence audit + new interaction patterns.**

- **Cross-surface journey change:** SCF spans HandReplayView ReviewPanel (existing partial), PlayerAnalysisPanel (existing villain-only), settings (tier metadata), and a likely new dedicated SCF surface (TBD Gate 4).
- **System-coherence audit:** SCF introduces overall-tier metadata that affects coaching surfaces, drill scheduler, refresher, and any future leak-to-lesson UI. Coherence between curriculum spine, drill scheduler, and per-domain mastery is a load-bearing concern.
- **New interaction patterns:** `self-rate-confidence-on-a-line` requires a confidence-elicitation interaction that does not exist anywhere in the codebase.

**Secondary classification considerations:**

- **Schema impact:** add `tier` (current + target) to user / settings persistence. Add `lessonAssignments` linking detected hero leaks to assigned lessons. Add `confidenceRatings` capturing pre-decision confidence values per hand. IDB v21+ migration likely.
- **Cross-surface ripples:** drill scheduler must read tier; refresher (PrintableRefresherView) may want tier-aware content selection; sidebar must NOT render hero-leak annotations (red line #8).
- **Persona-stress:** primary persona (`chris-live-player`) covers SCF fully — verified by §Output 2.

**Drills Consolidation HOLD:** not applicable. SCF is upstream of drills, not within drills.

---

## Output 2 — Personas identified

### In scope

| Persona | Role | Core/Situational | Status |
|---|---|---|---|
| [Chris (live player)](../personas/core/chris-live-player.md) | Primary user, in self-coach mode | Core | **Existing, extended** (this session: + Skill-ladder positioning section + Goals when self-coaching block + 4 new JTBD links) |
| [Post-Session Chris](../personas/situational/post-session-chris.md) | Post-session leak review + curriculum-next-step decision | Situational — primary | Existing |
| [Study-block](../personas/situational/study-block.md) | Off-table dedicated study time | Situational — primary | Existing |
| [Between-Hands Chris](../personas/situational/between-hands-chris.md) | Brief in-session leak ack (not full review) | Situational — secondary | Existing |

### Out of scope (explicitly excluded)

- [Mid-Hand Chris](../personas/situational/mid-hand-chris.md) — SCF is not a live-decision surface (red line #8: no cross-surface contamination).
- [Apprentice-student](../personas/core/apprentice-student.md) — apprentice has formal coach in the loop; SCF user is both coach and student. Different framing.
- [Coach](../personas/core/coach.md) — SCF user is not coaching others.
- [Newcomer](../personas/core/newcomer.md) — SCF assumes the user already plays; tier `novice` ≠ newcomer (novice = plays but no theory; newcomer = doesn't yet play).
- All other study/drill personas as primary — they appear as secondary at most.

### Persona-sufficiency check

> *"Does our current cast actually cover this feature, or do we need a new persona?"*

**Answer: 🟢 GREEN — `chris-live-player` extended with overall-tier metadata + self-coach goals covers SCF without requiring a new persona.**

The owner explicitly chose this path in plan-mode AskUserQuestion (option A: "Add tier-awareness to chris-live-player"). The reasoning: SCF is the same person in a different posture, not a different person. The Skill-state attribute (per-domain) and Goals + Constraints sections already model the "improver" stance; SCF adds the *overall-tier* dimension on top.

The existing situational personas (Post-Session Chris, Study-block, Between-Hands Chris) cover the time-budget variants of self-coaching adequately.

A new "chris-the-improver" persona was considered (option B in AskUserQuestion) and rejected to avoid persona explosion. Owner can reverse this if Gate 2 surfaces a need.

---

## Output 3 — JTBDs identified

### Already served (existing JTBDs that partially overlap; reconciliation pending)

| Existing JTBD | Domain | SCF overlap |
|--------------|--------|-------------|
| DS-47 — Skill map / mastery grid | drills-and-study | Adjacent: SCF's curriculum spine sits one level above (concepts → drills); DS-47 is drill-level visibility. |
| DS-46 — Spaced repetition for charts | drills-and-study | Adjacent: declarative-memory drill scheduling; SCF's curriculum is concept-progression, distinct mechanism. |
| DS-43 — 10-min quick drill on today's weak concept | drills-and-study | Adjacent: drill-level "what to drill next"; SCF's "what concept to learn next" is upstream. |
| DS-56 — Calibration check | drills-and-study | **Re-framing candidate** for SCF-`validate-im-improving`. DS-56 is self-reported fluency vs drill-data alignment; SCF wants leak-fix vs play-improvement alignment. Same shape, different referent. |
| DS-58 — Validate-confidence-matches-experience | drills-and-study | **Re-framing candidate** for SCF-`validate-im-improving`. DS-58 is anchor-claim calibration; SCF wants hero-improvement validation. Different referent, same predicted-vs-observed shape. |
| MH-12 — See cited assumption(s) backing a recommendation | mid-hand-decision | Adjacent: MH-12 is consumer-side (user reads a claim); SCF-`self-rate-confidence` is generator-side (user produces a confidence rating). Distinct. |

### Proposed (new — flagged for Gate 3 authoring if Gate 2 confirms)

Authored under the existing `coaching.md` domain (per §Discovery 2) as a "Self-coaching mode" sub-section. Owner can amend the placement in Open Question §Q2.

1. **JTBD-CO-54 (proposed)** — *See own leak surfaced without being graded*
   > When I review a hand or session, I want my own leaks (not the villain's) surfaced — without it feeling like a graded test or a verdict — so I can patch them without ego cost or defensive reaction.
   - Personas: chris-live-player (self-coach mode primary), post-session-chris, between-hands-chris.
   - Distinct from CO-48 (coach reviews student): CO-48 is coach-as-third-party; CO-54 is the user reviewing their own play with no third party involved. Distinct from MH-10 (plain-English why for a recommendation): MH-10 is recommendation reasoning; CO-54 is leak surfacing.
   - **Load-bearing constraint:** copy discipline must enforce non-grading framing per red line #5 + #7. Forbidden copy: "score", "grade", "rate your play", "how did you do?", "incorrect", "wrong". Acceptable: "noted", "observed", "trend", "pattern".

2. **JTBD-CO-55 (proposed)** — *Learn the next concept I'm ready for given current tier*
   > When my play is solid at one concept and I'm reviewing recent sessions, I want the system to point me at the next concept I'm ready to learn — based on my current tier (overall player level) plus per-domain mastery — not a generic study queue.
   - Personas: chris-live-player (self-coach mode primary), study-block (deliberate-study window), post-session-chris.
   - Distinct from DS-43 (drill on today's weak concept): DS-43 is drill-level (which exercise); CO-55 is curriculum-level (which concept). The decision precedes drill selection. Distinct from DS-47 (skill map): DS-47 visualizes mastery; CO-55 sequences progression.
   - **Load-bearing constraint:** red line #6 (flat access). Curriculum sequencing CAN suggest "next concept" but CANNOT hide concepts. User can always elect to study any concept regardless of current tier.

3. **JTBD-CO-56 (proposed)** — *Validate that prior coaching is translating into play improvement*
   > When I've worked on patching a leak (drilled the concept, studied the framework, made conscious adjustments at the table), I want to see whether my actual play has changed — not just whether I drilled the concept correctly, but whether the leak in my real hands is reducing.
   - Personas: chris-live-player (self-coach mode primary), post-session-chris, study-block.
   - **Reconciliation flag:** material overlap with DS-58 (validate-confidence-matches-experience) and DS-56 (calibration check). Gate 2 must explicitly resolve: collapse CO-56 into DS-58 with an extra referent dimension, OR keep separate. The owner-level question: is hero-leak-improvement a distinct outcome from anchor-claim-calibration in the user's mental model?
   - Distinct from DS-46 (spaced repetition): DS-46 is declarative-memory drill scheduling; CO-56 is observed-play-vs-drilled-concept alignment.

4. **JTBD-CO-57 (proposed)** — *Self-rate confidence on a line before seeing the verdict*
   > When I've made a decision in a hand and I'm about to see the system's verdict (post-hoc analysis, drill outcome, or hand replay), I want to first rate my own confidence in the line — so the gap between my predicted confidence and the observed correctness becomes its own coaching signal.
   - Personas: chris-live-player (self-coach mode primary), post-session-chris, study-block.
   - **Net-new.** No existing JTBD elicits pre-decision confidence as a coaching signal generator.
   - Distinct from MH-12 (cited-assumption trust bridge): MH-12 is consumer-side (user reads a system claim); CO-57 is generator-side (user produces a rating). Distinct from DS-58 (validate-confidence-matches-experience): DS-58 captures system-claim calibration; CO-57 captures user-self-claim calibration.
   - **Load-bearing constraint:** the rating must be captured BEFORE the user sees any verdict, otherwise the gap signal is contaminated. UI sequencing is the load-bearing affordance. Red line #1 (opt-in): rating is always optional, never required to proceed.

### JTBD-coverage check

> *"Does any proposed outcome not map to an existing JTBD?"*

**Answer: 🟡 YELLOW — 4 proposed JTBDs in the existing `coaching.md` domain (CO-54..57). Two have material overlap with existing DS-* JTBDs requiring reconciliation in Gate 2.**

CO-54, CO-55, CO-57 are net-new or net-new-adjacent. CO-56 is the reconciliation-pending candidate (overlap with DS-58 + DS-56). No new domain required.

---

## Output 4 — Gap analysis verdict

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| Personas | 🟢 GREEN | Existing chris-live-player extended (additive, not breaking); no new persona |
| JTBDs | 🟡 YELLOW | 4 proposed (CO-54..57); CO-56 has reconciliation overlap with DS-58 / DS-56 |
| Skill-ladder schema (overall tier) | 🔴 RED | Net-new concept; no tier metadata anywhere in persistence today |
| Per-domain Skill-state schema | 🟡 YELLOW | Spec exists in chris-live-player.md but no live persistence implementation |
| Hero leak detection | 🔴 RED | weaknessDetector.js is villain-side only; assessHeroEV scores actions but no aggregate hero-pattern infra |
| Curriculum spine | 🔴 RED | Lessons + frameworks corpus exists but ZERO authoring framework / sequencing / prerequisites |
| Lesson-to-leak binding | 🔴 RED | No persistence linking detected hero leak → assigned lesson |
| Confidence-elicitation surface | 🔴 RED | No infra for CO-57 (rate-confidence-before-verdict) anywhere |
| Drill content corpus | 🟢 GREEN | 10 lessons + 9 frameworks built; usable as-is for SCF curriculum |
| Surfaces (review / coach UI) | 🟡 YELLOW | HandReplayView ReviewPanel partial; new dedicated SCF surface likely required (TBD Gate 4) |
| Autonomy compliance | 🟡 YELLOW | All 9 red lines must be pre-checked against every proposed surface; GREEN once enforced, but RED if any surface drafts violate them |
| Coherence with existing skill-state attribute | 🟢 GREEN | Two-level concept (overall tier + per-domain mastery) coexist by design (Discovery 1) |

### Overall Gate 1 verdict: 🔴 **RED**

**Six RED dimensions, four YELLOW, three GREEN.** Gate 2 (Blind-Spot Roundtable) is **mandatory.** Gate 3 (Research) is highly likely required, especially for:

- Per-tier teachable-concept map ratification (draft authored in §Per-tier teachable-concept map below; owner amends in Gate 3)
- Curriculum-spine dependency-graph format (hand-authored DAG vs computed from leak frequency — Open Question §Q5)
- Hero-leak-detector authoring (analog to `weaknessDetector.js` but hero-side)
- DS-58 / CO-56 reconciliation
- Confidence-elicitation interaction-pattern design

---

## Per-tier teachable-concept map (DRAFT)

Per Master Plan §3 binding ratification, the SCF Gate 1 deliverable includes a **draft** per-tier × concept-area map. This is a Gate-1 starting point — owner amends in Gate 3 (Research).

| Tier | Already understands | Next teachable concept(s) |
|------|---------------------|---------------------------|
| 1 — novice | Rules, hand rankings, basic position vocabulary (UTG/BTN/BB) | Pot odds, basic open ranges, fold equity |
| 2 — live-rec | Position, opens, value betting at face value | Bluff-catcher framing, fold equity math, basic 3-bet decisions |
| 3 — studied-amateur | Pot odds, equity, fold equity, basic 3-bet | Range-vs-range thinking, polarization vs linear, board-texture |
| 4 — part-time-grinder | Range thinking, polarization, SPR awareness, board texture | Exploitative deviations, blocker effects, multi-street planning |
| 5 — serious-grinder | Exploits, blockers, mixing strategy, multi-street | Game-theoretic balancing, ICM (in tournaments), capped-vs-uncapped range theory |
| 6 — pro | Full-stack theory + exploits + GTO awareness | Leveraging meta-game, mental-game refinements, study-discipline optimization |

**Marked as DRAFT.** Owner amendments invited in Gate 3 (Research). Open Question §Q1 makes this explicit.

The map has two intentional structural choices: (a) each tier has 1–3 next teachable concepts, not a single one — multiple progression paths within a tier are normal; (b) the map is **monotonic** — all concepts at tier N are assumed mastered before tier N+1's "next teachable" become unblocked, but a user may still elect to study any concept regardless (red line #6).

---

## Recommended Gate 2 (Blind-Spot Roundtable) scope

Five stages to run as one session, ideally before any spec is written.

- **Stage A — Persona sufficiency.** Validate `chris-live-player` extended with tier-awareness covers SCF without a new persona. Test the `chris-the-improver` reversal hypothesis: would a separate persona surface different goals or constraints than the extended core does?
- **Stage B — JTBD reconciliation.** Resolve CO-56 vs DS-58 / DS-56. Specifically: is "hero leak fixed → hero play improved" a distinct outcome from "anchor claim still holds" in the user's mental model? Test by walking the persona through 3 concrete scenarios (leak fixed, leak persists, leak fixed-then-regressed). If user's framing is unified, collapse CO-56 into DS-58. If distinct, keep CO-56 separate.
- **Stage C — Situational stress.** Walk persona through SCF in three contexts: (1) post-session review window (post-session-chris, generous time, depth over speed); (2) between-hands quick leak ack (between-hands-chris, ≤30s, glanceable only); (3) deliberate study block (study-block, 30-60min, full curriculum browsing).
- **Stage D — Cross-surface / cross-system.**
  - Drill scheduler integration: must scheduler read tier? Or only per-domain mastery? How does tier-bumping ripple into drill weighting?
  - Refresher (PrintableRefresherView) integration: should refresher cards be tier-tagged?
  - PEO / chris-live-player tier metadata persistence: does this land in player schema (then the user is just one of many "players"), or in user-settings / preferences (cleaner separation)?
  - 9 red lines compliance pre-check on every proposed surface concept.
  - Live surfaces (OnlineView, sidebar) MUST NOT render hero-leak annotations (red line #8). Confirm Gate 4 surface concepts respect this.
- **Stage E — Heuristic pre-check.**
  - **Nielsen's "match between system and real world":** tier names use vocabulary the user actually thinks in. Verify with persona that "studied-amateur / part-time-grinder / serious-grinder" map to mental model.
  - **Mobile-Landscape ML06:** any SCF surface must respect 1600×720 reference viewport + 44px touch targets.
  - **Poker-Live-Table:** SCF is NOT a live-decision surface; PLT heuristics on glanceability are weaker. But "no destructive action without undo" still applies — retiring a lesson, dismissing a leak surface, must be reversible.
  - **9 autonomy red lines:** all 9 reviewed for SCF specifically. #1 (opt-in) and #5 (no shame / engagement-pressure) and #7 (editor's-note tone) and #8 (no cross-surface contamination) are most load-bearing.

---

## Required follow-ups (blocking Gate 4)

- [ ] **Gate 2 — Blind-Spot Roundtable** — author at `audits/2026-05-XX-blindspot-self-coach-foundation.md` covering all five stages above. Verdict drives Gate 3 scope.
- [ ] **Gate 3 — Research (conditional on Gate 2 verdict, likely required)**:
  - Author CO-54..57 as `Proposed` in `jtbd/domains/coaching.md` self-coaching sub-section (this audit drafts the ratifies the framing; Gate 3 ratifies the wording with success criteria + failure modes filled in).
  - Resolve CO-56 vs DS-58 reconciliation (collapse or keep separate).
  - Ratify per-tier teachable-concept map (this audit's draft amended by owner walkthrough).
  - Specify hero-leak-detector schema + algorithm (analog to `weaknessDetector.js` but hero-side).
  - Specify curriculum-spine format: hand-authored DAG vs computed from leak frequency vs hybrid (Open Question §Q5).
  - Specify confidence-elicitation interaction pattern (Q3 below).
- [ ] **Gate 4 — Design**:
  - Surface artifact at `surfaces/self-coach.md` (or wherever Gate 4 places it; Q4 below).
  - Schema delta document (overall tier metadata + lesson-to-leak persistence + confidence-rating capture).
  - Coordination with PrintableRefresher (tier-tagged content?), drill scheduler (tier-aware weighting?), HandReplayView (where does CO-57 confidence-rating UI live?).
- [ ] **Phase-0 prerequisite (engineering, post-Gate 4):** none currently identified. `weaknessDetector.js` analog for hero side is a Gate 5 implementation deliverable, not a prerequisite for design.

---

## Open questions for owner (before Gate 2)

1. **Per-tier teachable-concept map ratification.** The §Per-tier teachable-concept map above is a draft. Is it a faithful starting point, or do specific cells need amendment? In particular: live-rec → studied-amateur transition (the transition into theory-conscious play) and part-time-grinder → serious-grinder (the transition into balancing). Recommend: walk the map in Gate 3 with concrete owner introspection ("at what point did *I* feel this concept clicked?").

2. **CO-54..57 vs new domain.** §Discovery 2 recommends extending `coaching.md` with a self-coaching sub-section (CO-54..57) over creating a new `self-coaching.md` domain. Confirm or amend. If amend, the next sprint authors a new domain file with its own prefix (suggested: SC).

3. **CO-57 (self-rate confidence) ship timing.** Is CO-57 in scope for Gate 4 v1, or deferred to Gate 5? CO-57 requires a confidence-elicitation interaction that does not exist anywhere in the codebase — it has the highest design-effort cost of the four JTBDs. Recommend: Gate 4 v1 ships CO-54..56; CO-57 deferred to a v2 iteration once the leak-detection + curriculum-spine surfaces are stable.

4. **SCF surface location.** Where should the new SCF surface live — its own dedicated view (e.g., `SelfCoachView`), or modal sub-flow off PlayerAnalysisPanel / HandReplay? Recommend: own dedicated view, because (a) post-session-chris is a primary persona and benefits from a destination-mode surface, (b) the curriculum-spine + leak-detection + lesson-assignment trio is too much surface area for a modal off another view.

5. **Curriculum-spine format.** Should the curriculum spine be (a) a hand-authored DAG mapping concept-prerequisites, (b) computed from observed leak frequency (most-frequent leaks unblock first), or (c) hybrid (DAG provides skeleton; observed leaks adjust order within tier)? Recommend: (c) hybrid. The DAG ensures conceptual coherence (don't suggest polarization before pot odds); leak frequency ensures relevance (study what's actually broken).

6. **Tier inference vs explicit set.** Should the user explicitly select their tier (radio button in settings), or should the system infer it from observed play (with confirmation)? Per red line #1 (opt-in), inference must be confirmed. Recommend: explicit set in v1; inference-with-confirmation as a v2 enhancement.

7. **DS-58 / CO-56 reconciliation pre-vote.** Before Gate 2 walks the reconciliation in Stage B, what's the owner's pre-vote? Are "anchor-claim still holds" and "hero-leak-fix translates into play change" the same outcome with different referents in your mental model? Or distinct?

8. **Tier persistence location.** Tier metadata in (a) player schema (one player record with `playerType: hero`), (b) user-settings / preferences, or (c) a new dedicated `userProfile` store. Recommend: (b) user-settings — cleanest domain separation; tier is preference-shaped, not player-record-shaped.

---

## Links

- Feature lifecycle: [`docs/design/LIFECYCLE.md`](../LIFECYCLE.md)
- Methodology: [`docs/design/METHODOLOGY.md`](../METHODOLOGY.md)
- Roundtable template: [`docs/design/ROUNDTABLES.md`](../ROUNDTABLES.md)
- Master Plan: [`docs/projects/master-plan-2026-04-30.md`](../../projects/master-plan-2026-04-30.md) §D, §3 binding ratification #6
- Persona extended this session: [`personas/core/chris-live-player.md`](../personas/core/chris-live-player.md) — Skill-ladder positioning + Goals when self-coaching sub-sections added
- JTBD domain extended this session: [`jtbd/domains/coaching.md`](../jtbd/domains/coaching.md) — self-coaching mode sub-section + CO-54..57 added
- ATLAS update: [`jtbd/ATLAS.md`](../jtbd/ATLAS.md) — CO row updated to CO-48..57
- Existing skill-state attribute reference: [`personas/core/chris-live-player.md`](../personas/core/chris-live-player.md) §Skill-state attribute (lines 59-79; per-domain mastery — distinct from SCF's overall tier per Discovery 1)
- Adjacent JTBDs: DS-43, DS-46, DS-47, DS-56, DS-58 (drills-and-study domain); MH-12 (mid-hand-decision domain)
- Engine modules referenced (R/Y/G inventory):
  - `src/utils/exploitEngine/weaknessDetector.js` — villain-side leak detection (RED ✓)
  - `src/utils/exploitEngine/decisionAccumulator.js` — villain-side decision-bucket accumulator (RED ✓)
  - `src/utils/handAnalysis/heroAnalysis.js::assessHeroEV` — hero-side action scoring (YELLOW partial)
  - `src/utils/drillContent/lessons.js` + `frameworks.js` — drill corpus (RED ✓)
  - `src/utils/drillContent/scheduler.js` — drill scheduler (YELLOW: weights by accuracy, no curriculum)

---

## Change log

- 2026-05-02 — Created. Authored from Master Plan §D ratification 2026-04-30 + binding ratification #6 (D-G1 parallel with B). Verdict RED — six RED dimensions (overall-tier schema, hero leak detection, curriculum spine, lesson-to-leak binding, confidence-elicitation surface) trigger Gate 2 + Gate 3. Persona extension + JTBD authoring (CO-54..57 in coaching.md self-coaching sub-section) ratified by owner in plan-mode AskUserQuestion. Per-tier teachable-concept map drafted; owner amends in Gate 3. CO-56 vs DS-58 reconciliation deferred to Gate 2 Stage B.
