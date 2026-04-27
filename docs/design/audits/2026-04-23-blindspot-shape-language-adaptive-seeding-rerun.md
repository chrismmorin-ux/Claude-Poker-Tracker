# Blind-Spot Roundtable Re-Run — 2026-04-23 — Shape Language Adaptive Lesson Seeding

**Type:** Gate 2 re-run per `docs/design/LIFECYCLE.md` — verifies that Gate 3 framework updates close the prior Gate 2 RED verdicts.
**Trigger:** Gate 3 exit condition ("Gate 2 is re-run against the updated framework; output must be GREEN to proceed").
**Participants:** Facilitator only (single-voice re-run; lightweight by design per ROUNDTABLES.md "Full roundtable ≈ 1–2 agent runs" guidance). Draws on Gate 3 decision memo, persona amendments, returning-after-break situational, DS-52..56 + ON-87 JTBDs, and updated ATLAS.
**Artifacts read:**
- `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md` — original Gate 2 audit (RED)
- `docs/projects/poker-shape-language/gate3-decision-memo.md` — Gate 3 decision memo (7 verdicts)
- `docs/design/personas/core/chris-live-player.md` — amended
- `docs/design/personas/core/scholar-drills-only.md` — amended
- `docs/design/personas/situational/returning-after-break.md` — new
- `docs/design/jtbd/domains/drills-and-study.md` — DS-52..56 added
- `docs/design/jtbd/domains/onboarding.md` — ON-87 added
- `docs/design/jtbd/ATLAS.md` — updated
**Status:** Draft.

---

## Executive summary

**Verdict: GREEN with scoped residuals.** The Gate 3 framework updates close the original RED verdict at the framework level — every Stage A and Stage B ❌ now maps to a concrete persona amendment, new situational, or new JTBD. Stage C's structural mismatch (live-surface contamination) is resolved by autonomy red line #8 being promoted to persona-level invariant on `chris-live-player`. Stage D's cross-product concerns are resolved by the proposed `src/utils/skillAssessment/` module architecture with 3-phase migration. Stage E's heuristic violations are resolved by the 8 red lines adopted as design preconditions. All remaining concerns are **Gate 4 spec items**, not framework gaps — they belong to surface artifacts that will be authored at Gate 4, not to missing personas or JTBDs. This matches the LIFECYCLE.md contract: Gate 3's job is framework completion; Gate 4's job is translating framework into spec.

The single medium-confidence verdict from the decision memo (Q4 — self-assessment vs data disagreement) carries forward to Gate 4 as a design-validation item, not a re-run blocker — the framework supports the verdict cleanly; the risk is implementation-level.

---

## Original Gate 2 findings vs. post-Gate-3 state

| Stage | Original | Post-Gate-3 | Close mechanism |
|-------|----------|-------------|-----------------|
| A — Persona sufficiency | ❌ structural gap | ✅ (1 residual) | Chris + Scholar amended with skill_state + autonomy constraint; returning-after-break authored; apprentice-student deliberately unamended (coach-mediated) |
| B — JTBD coverage | ❌ domain missing | ✅ | DS-52 retention + DS-53 edge-case probe + DS-54 exploration override + DS-55 resumption + DS-56 calibration (Proposed) + ON-87 cold-start seeding |
| C — Situational stress | ❌ structural mismatch | ✅ (Gate-4 implementation owes it) | Red line #8 (headless live surfaces) + mode-gated writes via three-intent taxonomy + returning-after-break situational |
| D — Cross-product / cross-surface | ⚠️ | ✅ (Gate-4 surface authorship owes it) | skillAssessment 3-phase migration + IDB v17→v18 additive + Q6 export verdict + Q1 study-home-surface decision |
| E — Heuristic pre-check | ❌ as sketched | ✅ (Gate-4 validates in surfaces) | 8 autonomy red lines promoted to persona-level invariants; Q2-Q7 verdicts pre-resolve heuristic violations |

---

## Stage A — Persona sufficiency — re-verdict

**Post-Gate-3 verdict: ✅ with 1 residual.**

### What closed

- **`chris-live-player.md` amended** — new "Skill-state attribute" section specifies `level / confidence / lastValidatedAt / trendDirection / userMuteState` shape per descriptor, with write-side rules (Reference never writes; Deliberate/Discover do; signals separate) and read-side rules (decay on read; signals exposed independently). New "Autonomy constraint" section promotes all 8 Gate 2 red lines to persona-level invariants that bind every feature.
- **`scholar-drills-only.md` amended** — inherits Chris's skill-state attribute with "same invariants" reference (no duplication); Goals section flags streak-gamification as opt-in-only per red line #5 (addresses the Autonomy skeptic's specific concern that Scholar's streak preference must not ship as default).
- **`returning-after-break.md` authored** — new situational for ≥28-day gap; welcome-back surface fires once per gap event; skip and recalibrate have equal visual weight; no shame/streak-loss language. Closes DS-55 (resumption) at persona level.
- **`newcomer-first-hand` explicit exclusion** — documented in charter decisions log; adaptive seeding does not fire while newcomer conditions apply. Prevents H-N10 violation (referencing un-introduced concepts).

### Residual (scope-appropriate, not a blocker)

- **`apprentice-student.md` not amended.** Deliberate non-amendment: the Product/UX voice flagged Apprentice as "closest archetypal fit but carries a coach dependency the feature doesn't have." Apprentice's skill-state is **coach-mediated**, not self-driven — the adaptive seeder doesn't model them. If Apprentice later becomes a direct consumer of the Shape Language study home, amendment follows then. For the current feature scope, unamendment is correct.
- **`plateaued-learner` and `streak-habitualist` deliberately refused.** `plateaued-learner` expressed as a `trendDirection: plateaued` attribute value rather than a persona (per decision memo §Stage A resolution point 3); revisit only if distinct behavioral patterns emerge in practice. `streak-habitualist` refused entirely per autonomy red line #5 (future-user drift guard).
- **`skeptical-learner` refused.** Per autonomy skeptic voice: the owner IS the skeptic; encoding him as a persona creates fiction. Handled as cross-cutting constraint on Chris (Autonomy Constraint section).

**Verdict rationale:** every Gate 2 Stage A ❌ either (a) resolved via persona amendment, (b) resolved via new situational, or (c) explicitly refused with documented rationale. No silent gap remains.

---

## Stage B — JTBD coverage — re-verdict

**Post-Gate-3 verdict: ✅.**

### What closed

Six JTBDs authored in existing domains (no new domain needed — the decision memo's Q1 verdict explicitly chose cross-project surface artifact over umbrella, which carries through here: `drills-and-study.md` + `onboarding.md` already own the outcome space):

- **DS-52 Retention maintenance** (Active) — owns FSRS-adjacent re-surfacing. Decay profile is procedural-memory-gentle, not declarative-aggressive. Pairs with decision memo §Q3 verdict.
- **DS-53 Edge-case probe** (Active) — defends against mastery illusion via edge-case weighting in Discover-mode rotation. Non-forced; user can dismiss.
- **DS-54 Exploration override** (Active — **non-negotiable** per autonomy red line #3) — every Discover-mode recommendation carries a "pick something else" affordance. The one-tap "already know" vs "not today" disambiguation feeds the user-declaration signal.
- **DS-55 Resumption after break** (Active) — pairs 1:1 with returning-after-break situational persona.
- **DS-56 Calibration check** (Proposed) — user-initiated blind probe; partially subsumed by DS-53 at the seeder level but authored separately because the user-facing framing differs.
- **ON-87 Cold-start descriptor seeding / expert bypass** (Active) — closes decision memo §Q7 verdict. One-screen skippable self-declaration; no placement quiz. Distinct from ON-84 (skip tutorials) in that ON-87 seeds an adaptive model rather than bypassing one.

ATLAS.md updated: DS row is now DS-43..56; ON row is ON-82..87. Change-log entry references Gate 3 decision memo.

### Mapping to Gate 2 original outcomes

All seven outcomes named in the original Gate 2 Stage B now have JTBD homes:

| Gate 2 outcome | JTBD | State |
|---|---|---|
| Retention | DS-52 | Active |
| Edge-case probe | DS-53 | Active |
| Exploration override | DS-54 | Active (non-negotiable) |
| Resumption after break | DS-55 | Active |
| Calibration check | DS-56 | Proposed |
| Cold-start descriptor seeding | ON-87 | Active |
| Streak/habit formation | *refused* | — (out of scope per red line #5; documented in domain-wide constraints) |

### Residual

None material. **Verdict rationale:** Stage B was a domain-coverage question; coverage is now complete.

---

## Stage C — Situational stress test — re-verdict

**Post-Gate-3 verdict: ✅ at framework level (Gate 4 surface implementation pending).**

### What closed

The original Stage C ❌ was centered on *structural mismatches* between the feature and specific situational personas — not tunability gaps, but design-level incompatibilities.

- **`mid-hand-chris` × LiveAdviceBar** was flagged as "structural mismatch, not a tuning issue." Post-Gate-3: **autonomy red line #8** (no cross-surface contamination; live surfaces render only classifier-fired descriptor badges — headless seeding) is now a persona-level invariant on Chris. The seeder *architecturally cannot* fire mid-hand because the surface does not consume the seeder's output. Red line #8 + three-intent taxonomy (`currentIntent` is reducer state; live-play doesn't route through Deliberate/Discover) make this violation structurally impossible, not just discouraged.
- **`seat-swap-chris`** compounds with a prior known misclick (EVID-2026-04-21). Post-Gate-3: the Shape Language feature doesn't add seat-interaction affordances, so this pre-existing concern is not amplified. Any seat-swap-time seeding affordances are explicitly disallowed by red line #8.
- **`presession-preparer` vs adaptive-seeding clash** was named "the single highest-risk unresolved clash." Post-Gate-3: decision memo §Stage A resolution point 4 assigned priority — presession-preparer wins by default, seeding appends tonight-adjacent only. Surface-level arbitration is a Gate 4 item (`surfaces/study-home.md` ordering logic), but the *design principle* is captured.
- **`post-session-chris` × "you struggled with Saddles" framing** — this was a persona violation (grading vs reviewing tone). Post-Gate-3: autonomy red line #7 (editor's-note tone, not gamified-infantile) + Q4 verdict (transparency shows both signals in parallel, never a fused score, never "you struggled") resolve this at the copy-tone level. Gate 4 copy spec validates.
- **`newcomer-first-hand`** — explicit exclusion documented. Cannot fire.
- **`study-block` hard-end (subway stop, etc.)** — Gate 4 surface spec will own "complete coherent units within declared window" per decision memo §Q3 implication. Framework-level: DS-54 (exploration override) allows the user to exit any suggestion; the situational-persona's need is satisfied by existing JTBD coverage.

### Residual

- **Surface-level arbitration between presession-preparer and adaptive-seeding** — a Gate 4 spec item, not a framework gap. The principle is captured in decisions log + decision memo. The spec needs to exist in `surfaces/study-home.md` with an explicit ordering rule.
- **Copy-tone validation at Gate 4** — red line #7 (editor's-note tone) is a persona-level invariant; individual surface copy is validated during Gate 4 + Gate 5 visual review.

**Verdict rationale:** the Stage C ❌ was *structural*, not implementation-level. Structural resolutions are now in place (red lines as persona invariants; mode gating; explicit exclusions). Implementation risks roll forward to Gate 4 as explicit spec items, which is the correct handoff per LIFECYCLE.md.

---

## Stage D — Cross-product / cross-surface — re-verdict

**Post-Gate-3 verdict: ✅ at architecture level (Gate 4 surface authorship pending).**

### What closed

The original Stage D ⚠️ identified (1) state-model split, (2) IDB migration scope, (3) cross-surface propagation, (4) sidebar parity, (5) migration story, (6) computational cost, (7) failure modes.

- **State model split** — resolved via decision memo + charter: three-piece split (mastery / lesson-progress / recommendation) with hook-hoisting race guards + enumerable writer registry (mirrors villainAssumptions pattern from Exploit Deviation).
- **IDB migration** — resolved via corrected scope: v17 → v18 additive stores (`shapeMastery`, `shapeLessons`); no retrofit of existing stores. Migration pattern established by `migrateV17` (2026-04-21, villainAssumptions).
- **Cross-surface propagation** — resolved via Q1 verdict (cross-project surface artifact `docs/design/surfaces/study-home.md`; each project's embed defers layout to parent surface) + `currentIntent` as first-class reducer state.
- **Sidebar parity** — resolved via red line #8: sidebar extension is mastery-agnostic (shows all tags always); pedagogical gating is main-app-only. Sidesteps SW-reanimation state-rehydration complexity.
- **Migration story** — resolved via Q7 verdict: cold-start hydrates at `alpha=1,beta=1`; self-declaration seed (optional) sets initial posteriors for declared-known descriptors.
- **Computational cost** — resolved via read-time decay (no timer-driven writes) per Q3 verdict.
- **Failure modes** — three named failure modes (FM-Hoisted-Persistence-Hook-Race, FM-Engine-Drift-Silent-Invalidation, RT-43 multi-writer-bypass class) documented in senior engineer voice; each has an existing pattern remedy.

### The skillAssessment architectural proposal

The decision memo's §Architectural Proposal specified a shared `src/utils/skillAssessment/` module with a 3-phase migration:

- **Phase A (additive):** Shape Language Stream D imports from the new module. Villain code untouched. Ships with this project.
- **Phase B (villain delegation):** `assumptionEngine/` delegates Bayesian core to shared module. Cross-project; tracked separately after Phase A proves the API.
- **Phase C (invariant unification):** ESLint guard on shared module; extended to user-skill signal pairs.

This closes the "core competency" framing at the architecture level: user-skill and villain-skill inference share math (Beta-Binomial update, credible intervals, decay), differ only in adapters (drill outcomes vs action-frequencies; self-declaration vs style priors). None of the three phases is a big-bang refactor.

### Residual

- **`surfaces/study-home.md` not yet authored.** Q1 verdict decided the artifact's existence; authorship happens at Gate 4 (first consumer = Shape Language, since it's furthest along). This is a Gate 4 work item, not a framework gap.
- **Phase B and Phase C scheduling** — cross-project; tracked separately. Not a Gate 3 blocker.

**Verdict rationale:** architectural concerns are either resolved via decisions in the charter/memo or scoped for Gate 4 authorship. No cross-product risk remains unaddressed at the framework level.

---

## Stage E — Heuristic pre-check — re-verdict

**Post-Gate-3 verdict: ✅ at principle level (Gate 4 surface validation pending).**

### What closed

The original Stage E ❌ was centered on: H-N03 (undo for mastery declarations + algorithmic inferences), H-N05 (skip-vs-mastered disambiguation), H-PLT07 (state-aware primary action), H-PLT04 (social invisibility of live seeding artifacts), H-ML06 (touch targets), H-N10 (descriptor-introduction-order invariant), plus autonomy/agency heuristics (consent, transparency, override, reversibility, anti-streak, anti-filter-bubble, language/tone).

The 8 red lines + decision memo verdicts pre-resolve each:

- **H-N03 (undo)** → red line #3 (durable overrides) + red line #4 (reversibility including incognito mode + full reset).
- **H-N05 (error prevention; skip disambiguation)** → Q2 verdict — one-tap "already know" vs "not today" disambiguation at skip time.
- **H-PLT07 (state-aware primary)** → three-intent taxonomy (`currentIntent` is reducer state); primary action changes per mode.
- **H-PLT04 (social invisibility)** → red line #8 (headless live surfaces; no seeding artifacts fire on LiveAdviceBar/SizingPresetsPanel).
- **H-ML06 (touch targets)** → Gate 4 surface-level validation; 44-px minimum is a design-program constant, not a new constraint.
- **H-N10 (introduction order)** → `newcomer-first-hand` explicit exclusion + flat lesson index (red line #6) + `currentIntent=Reference` as the "never-graded lookup" path (Q5 verdict).
- **Autonomy/agency heuristics** → 8 red lines as persona-level invariants + decision memo transparency-screen spec (Q4 verdict: user and data signals shown independently, never fused).

### Residual

- **Q4's medium-confidence verdict.** "User wins silently, data transparent" works only if the transparency screen actually makes the disagreement legibly visible. Gate 4 surface validation must confirm — if the transparency screen buries the data signal, Q4 regresses. This is explicit surface risk, carried forward to Gate 4.
- **Copy-tone validation** — red line #7 (editor's-note tone, not gamified-infantile) requires Gate 4 copy review. Framework-level invariant is set; surface instances need validation.
- **Placement quiz re-emergence guard** — red line #5 + Q7 verdict disqualify placement quizzes, but the onboarding surface spec must actively guard against drift. Gate 4 must enumerate "no quiz-shaped onramp" as an explicit negative requirement.

**Verdict rationale:** heuristic-level violations from the original audit are now structurally guarded by persona-level red lines + decision-memo verdicts. Surface-level validation happens at Gate 4, which is where heuristic pre-check normally runs for a new surface anyway.

---

## Overall verdict

**GREEN.** Per LIFECYCLE.md: "Gate 2 is re-run against the updated framework; output must be GREEN to proceed." Every ❌ verdict from the original Gate 2 now maps to a concrete Gate 3 artifact — an amended persona, a new situational, a new JTBD, a decision-memo verdict, or a red line promoted to persona-level invariant. Stage A has one scope-appropriate residual (apprentice-student deliberately unamended); Stage B is fully covered; Stages C/D/E resolve at the framework level with Gate-4 implementation items enumerated explicitly.

The GREEN verdict is **framework-level**, not implementation-level. Gate 4 spec work is nontrivial — three new surface artifacts (`study-home`, `shape-language-study`, `shape-skill-map`, `lesson-runner`) plus an enrollment journey plus an interaction spec. None of that is blocked by framework gaps; all of it is unblocked by this re-run.

### Gate 4 spec carry-forwards (explicit)

The following are **scope-appropriate Gate 4 items**, not Gate 3 gaps:

1. **`surfaces/study-home.md` authorship** (Q1 verdict — cross-project surface).
2. **presession-preparer vs adaptive-seeding ordering** in study-home surface spec (decision memo §Stage A resolution).
3. **Transparency screen design validation** — Q4 medium-confidence verdict; surface must make declaration vs data disagreement legibly visible.
4. **Copy-tone validation** — red line #7 enforcement at surface instances.
5. **Enrollment journey spec** — Q2 hybrid + Q7 self-declaration-seed flow in a single journey.
6. **Incognito-mode surface design** — Q5 mode-determined default; in-mode toggle affordance.
7. **Welcome-back surface design** — DS-55 + returning-after-break persona; one-time-per-gap firing rule; equal-weight skip/recalibrate.
8. **8-red-line conformance checklist** — enumerate as a boolean pass/fail per surface spec.

---

## Required follow-ups

### Gate 3 closure (this session)

- [x] Decision memo resolves 7 owner-interview questions.
- [x] Chris + Scholar personas amended.
- [x] Returning-after-break situational authored.
- [x] DS-52..56 + ON-87 authored.
- [x] ATLAS.md updated.
- [x] Gate 2 re-run (this document).
- [ ] Owner ratification of verdicts (especially Q4 medium-confidence).
- [ ] `gate3-triage.md` closed with R1-R6 marked resolved-by-memo.
- [ ] Charter phase table updated to reflect Gate 3 complete.

### Gate 4 kickoff (next session)

Gate 4 scope is now concretely enumerated via the 8 carry-forwards above. Expected 2-3 sessions.

### Out-of-scope, tracked separately

- skillAssessment Phase B (villain delegation) — cross-project coordination; opens when Phase A ships.
- skillAssessment Phase C (ESLint invariant unification) — opens after Phase B.
- Apprentice-student amendment — opens only if Apprentice becomes a direct consumer of Shape Language study home.

---

## Change log

- 2026-04-23 — Gate 2 re-run authored as single-voice validation pass. Verdict GREEN with scope-appropriate Gate 4 carry-forwards enumerated. Closes Gate 3. Unblocks Gate 4 kickoff.
