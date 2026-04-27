# Blind-Spot Roundtable — 2026-04-23 — Shape Language Adaptive Lesson Seeding

**Type:** Gate 2 Blind-Spot audit (design lifecycle per `docs/design/LIFECYCLE.md`)
**Trigger:** Gate 1 YELLOW-leaning-RED output — new surface (skill-map + seeded lesson runner), cross-product reach (HandReplay, SessionsView, PresessionDrillView, LiveAdviceBar, SizingPresetsPanel, and a sidebar parity question), and introduction of *skill-state-as-evolving-attribute* which is a new persona dimension the atlas does not model.
**Participants:** Product/UX lead (Stages A, C, E), Market/external lens (Stages A, B), Senior engineer (Stage D), Autonomy skeptic (Stages A, E).
**Artifacts read:**
- `docs/projects/poker-shape-language/gate2-voices/01-product-ux.md`
- `docs/projects/poker-shape-language/gate2-voices/02-market-lens.md`
- `docs/projects/poker-shape-language/gate2-voices/03-senior-engineer.md`
- `docs/projects/poker-shape-language/gate2-voices/04-autonomy-skeptic.md`
- `docs/projects/poker-shape-language/roundtable.md` (theory roundtable output + top-6 descriptor catalog)
- `docs/design/personas/core/*` + `docs/design/personas/situational/*` + `docs/design/jtbd/atlas.md` (referenced via voices, not re-read)
- `docs/design/heuristics/*` (Nielsen 10, Poker-Live-Table, Mobile-Landscape)
**Status:** Draft.

---

## Executive summary

**Verdict: RED.** The single most consequential finding is that **adaptive seeding as currently sketched assumes silent consent-to-be-modeled on a user who built the app precisely to avoid that dynamic** — an ed-tech anti-pattern that, unchecked, will poison the trust that the Bayesian villain reads and exploit advice depend on. Below that sits a second structural finding from the UX lead: **embedding the seeding algorithm on the live-table surface (LiveAdviceBar) is a structural mismatch with `mid-hand-chris`, not a tuning issue.** The algorithm must be headless on live surfaces; only descriptor badges (Silhouette, Saddle, Spire) ever render there, and they render because the classifier fires, not because the seeder chose this hand as a teaching moment. Third, the feature imports four JTBD domains the atlas does not currently cover (retention, edge-case probe, exploration override, resumption after break) and at least one new persona dimension (self-directed curriculum learner with heterogeneous per-descriptor skill-state). Top-3 structural risks: (1) autonomy violation via implicit modeling, (2) live-surface contamination of a study-mode feature, (3) state-model + IDB migration work that needs careful scope (v17 → v18, additive stores, hook-hoisting race risk). Top-3 required Gate 3 items: (1) skill-state level definition + evidence requirements, (2) opt-in enrollment UX and a "what the system thinks about me" transparency screen, (3) cold-start and resumption-after-break research anchored in FSRS/BKT literature. Gate 3 is **required** per LIFECYCLE.md for any YELLOW/RED Gate 2.

## Feature summary

*Adaptive lesson seeding* is the proposed pedagogical layer over the 10-descriptor Poker Shape Language catalog (Silhouette, Equity-Distribution Curve, Spire+Polarization, Sizing Curve Tag, Saddle, Basin+Sankey, Ridgeline+Ribbon, Contour Tree, Equity Basin Map, Hand Trajectory). The system infers per-descriptor skill-state from user interactions (drill outcomes, recognition latency, explicit self-assessment), then orders/chooses/surfaces lessons to target the owner's weakest descriptors first while preventing forgetting on mastered ones. Intended reach spans five surfaces: HandReplay (retrospective tag visibility), SessionsView (post-session review), PresessionDrillView (primary drill host), LiveAdviceBar (live-table descriptor tags), and SizingPresetsPanel (Sizing Curve Tag embed). The feature also proposes — implicitly, across the voices — a new "skill map" view that visualizes per-descriptor mastery.

---

## Stage A — Persona sufficiency

**Output: ❌ Structural gap.**

### Findings

All three voices that weighed on Stage A (Product/UX, Market, Autonomy skeptic) converge on a single observation: **`chris-live-player` has no skill-progression attribute**, and the persona cast as a whole is oriented around steady-state competence, not longitudinal skill change. Where the voices diverge is on *what to do about it*. The consequential findings, merged:

- **Core persona `chris-live-player` is silent on skill-state.** Framed as an already-competent player compensating for memory limits. Nowhere to hang "Chris in month 6 of Shape Language with mastered Saddle recognition and cold Ribbon reading" (Product/UX).
- **`scholar-drills-only` covers session-shape and mood but not longitudinal per-concept mastery.** Treats fluency as a frustration to be reported, not a state the app models (Product/UX). The persona is also currently PROTO — its attributes are not load-bearing.
- **`apprentice-student` is the closest archetypal fit but carries a coach dependency** that this feature does not have. Apprentice-minus-coach is not a trivial subset — the self-directed, system-paced, no-coach learner is a genuinely new archetype (Product/UX).
- **`newcomer` is a *disqualifying* persona.** Newcomers cannot absorb Shape Language vocabulary (Saddle, Ribbon, Spire). If seeding activates for Newcomer, it fails H-N10 and H-PLT01 (Product/UX).
- **Seven adaptive-learning archetypes from the wild** (Market): self-directed skill-builder (→ Scholar ✅), prep-for-goal learner (→ Pre-Session Preparer ✅), habit-maintainer (⚠️ partial), completionist (❌ gap), skeptical learner (❌ gap), returning-after-break (❌ gap), curiosity-browser (⚠️ partial).
- **The skeptic archetype is not "a user we haven't met" — it's *this owner by default*** (Autonomy). Building a named `skeptical-learner` persona to represent the owner is backwards; the skeptic stance is a cross-cutting constraint that applies to every feature, not a user we model.

### Cross-voice resolution — where Product/UX, Market, and Autonomy disagree

Product/UX proposed a **new core persona** (`self-directed-curriculum-learner`) plus two situationals (`plateaued-learner`, `returning-learner`). Market proposed **three new situationals** (streak-habitualist, returning-after-break, skeptical-of-personalization) and an **attribute extension** (coverage_orientation). Autonomy explicitly argued **no new persona** — the skeptic stance belongs as a constraint on `chris-live-player`, not as a separate named user.

**Resolution (facilitator position):**

1. **Autonomy is right about the skeptic.** The owner *is* the skeptic; creating a `skeptical-of-personalization` persona would introduce a fiction. Instead, amend `chris-live-player.md` with an **autonomy-constraint paragraph** reading: *"The app may not form persistent opinions about the owner's skill without an explicit enrolled-state toggle. Recommendations are hypotheses, not verdicts."* Reference this from any Shape Language surface spec. This is a **persona amendment**, not a new persona.
2. **Product/UX is right that a new core attribute is needed.** Skill-state-per-descriptor is a genuinely new persona dimension. But rather than author a full new `self-directed-curriculum-learner` persona (risk: it overlaps heavily with Scholar + Chris-in-study-mode and creates atlas bloat), **extend `chris-live-player` and `scholar-drills-only` with a `skill_state_per_descriptor` attribute** of shape `{level, confidence, lastTouched, trendDirection}`. Gate 3 owes research on what the stable levels are.
3. **Market's situationals are partially right.** `returning-after-break` is a real, distinct situation that existing personas don't cover and that FSRS-literature says will happen within 6 months of shipping — **author it**. `streak-habitualist` is cleanly refused — the Autonomy voice argues correctly that a streak user is a *future* user, not today's owner; do not build for that user. `plateaued-learner` (Product/UX) is real but can be an attribute-state on the skill-map, not a full persona — track in the skill-state attribute's `trendDirection: plateaued` value.
4. **Explicit exclusion.** `newcomer-first-hand` must be an explicit block on the feature — seeding cannot fire while this situational applies. Today the codebase has no machinery to detect "first hand vs hand #647"; the feature must treat this as a v1 design constraint, not a data question (all three voices agree).

### Recommended follow-ups for Gate 3

- [ ] Gate 3 research: **what are the stable skill levels for a Shape Language descriptor?** (e.g., Pre-prototype / Novice / Practicing / Reliable / Mastered, or fewer). Anchor in BKT + FSRS literature (Market's bibliography).
- [ ] Amend `personas/core/chris-live-player.md` with (a) `skill_state_per_descriptor` attribute shape, (b) autonomy-constraint paragraph.
- [ ] Amend `personas/core/scholar-drills-only.md` with same `skill_state_per_descriptor` attribute; leave Scholar's streak language intact but flag it as deferred to a future opt-in mode.
- [ ] Author `personas/situational/returning-after-break.md`. Attributes: decay assumption, reseed-vs-resume decision, break-length-in-days signal.
- [ ] Author `personas/situational/plateaued-learner.md`? **Deferred** — express as an attribute state first; revisit if distinct behavioral patterns emerge in Gate 3 research.
- [ ] Explicit v1 exclusion note in the design spec: "Newcomer situational is disqualifying. Seeding does not fire while newcomer conditions apply."

---

## Stage B — JTBD coverage

**Output: ❌ Domain missing.**

### Findings

Market lens is primary here. The JTBD atlas is currently thin on adaptive-learning outcomes, and four of seven candidate outcomes have no matching JTBD. Evaluation of each proposed addition:

- **DS-52 Retention maintenance** ("don't let mastery decay silently"). **Critical-path.** Owns FSRS-style scheduling — the single feature that differentiates adaptive seeding from a static curriculum. Without this JTBD the seeder has no outcome-level mandate to re-surface mastered descriptors. **Add.**
- **DS-53 Edge-case probe** ("show me unusual cases once I'm fluent on median ones"). **Add.** Addresses the "mastery illusion from over-personalization" failure mode documented in BKT literature; without a probe JTBD, the seeder converges on what the learner can succeed on and false fluency develops. Distinct from DS-44 (reasoning) and DS-47 (mastery grid).
- **DS-54 Exploration override** ("choose a different descriptor without losing progress"). **Add. Non-negotiable.** This JTBD is the structural defense against autonomy erosion; it maps 1:1 with Autonomy's "durable override" red line. Without it, every adaptive decision is paternalistic.
- **DS-55 Resumption after break** ("reassess after a break rather than resume at prior state"). **Add.** Pairs with the `returning-after-break` situational persona (Stage A). Without this JTBD, the seeder recommends advanced Saddle drills to a user whose Silhouette recognition has already decayed.
- **DS-56 Calibration check** ("blind probe after self-reported fluency"). **Add, lower priority.** Solves Dunning-Kruger specifically; the weaker Anki "again/hard/good/easy" pattern is insufficient for poker because confidence miscalibration is itself a poker skill gap. But DS-53 (edge-case probe) covers much of this functionally; DS-56 may be decomposable into DS-53.
- **ON-87 Cold-start descriptor seeding** ("infer starting level from history / placement / self-report"). **Add.** Critical because the owner is *already* an expert on descriptors he co-authored; a novice-default seeder is the wrong shape for him specifically. Senior engineer's proposed cold-start path (static Silhouette first → adaptive after 3 interactions) is one answer; ON-87 owns the outcome regardless of which implementation wins.

**One candidate refused:**

- **Streak / habit formation JTBD** (implied by streak-habitualist archetype). **Do not add in v1.** Autonomy red line; Cambridge Analytica / Decision Lab references on streak-creep are unrebutted; the owner's play cadence (3–6 hour live sessions, weeks without study time) makes streak mechanics actively hostile. If a future Scholar-mode is built, it gets its own JTBD then.

**Duplication check:**

- DS-56 (calibration) potentially decomposable into DS-53 (edge-case). **Gate 3 decision** — keep separate until research shows overlap.
- DS-52 (retention) overlaps with the proposed-but-unshipped `JTBD-DS-46` (spaced repetition). **Merge / reframe.** DS-46 as currently written is feature-framed ("spaced repetition"); DS-52 is outcome-framed ("don't forget"). The atlas should prefer the outcome framing; retire DS-46 as a redundant feature-request-shaped JTBD.

### Recommended follow-ups for Gate 3

- [ ] Author DS-52 (retention), DS-53 (edge-case probe), DS-54 (exploration override), DS-55 (resumption), ON-87 (cold-start). DS-56 pending overlap research.
- [ ] Retire or reframe `JTBD-DS-46` (spaced repetition) to the outcome-framed DS-52.
- [ ] Document streak-formation as an **explicitly out-of-scope** JTBD with the autonomy red line as the rationale, so a future contributor doesn't re-propose it without context.

---

## Stage C — Situational stress test

**Output: ❌ Fundamental mismatch on live surfaces + multiple targeted adjustments.**

### Findings — per situational persona

- **`mid-hand-chris` (time budget < 1.5s, "the shape of the screen should not move unless hand state changes"): structural mismatch.** Any seeding logic that surfaces a lesson, a nudge, or a "teaching moment" mid-hand is incompatible with this persona's primary constraint. The UX voice is explicit: **this is not a tuning issue.** On LiveAdviceBar, the seeding *algorithm* must be fully headless — only descriptor *badges* (Silhouette, Saddle, Spire tags that are already planned as the live-mode outputs of the Shape Language top-6) ever render, and they render because the classifier fires on game state, not because the seeder chose this hand. Seeding's on-screen footprint at live tables is **zero**.
- **`between-hands-chris` (30–90s): narrowly viable.** A 5-second "we noticed a Spire on Seat 4 — want to log that recognition?" prompt is acceptable *only if* dismissable via a single corner tap and only if it cannot block player swap. The primary between-hands job is villain-read logging; seeding is secondary. Gate 4 must scope this as a time-budgeted, non-blocking, single-tap-dismissable affordance, and even then it should be off-by-default.
- **`seat-swap-chris` (destructive-action-adjacent): banned.** Any seeding UI near the seat context menu compounds the H-PLT06 misclick risk documented in `[EVID-2026-04-21-CLEAR-PLAYER]`. Explicitly ban seeding anchors from seat-swap surfaces.
- **`post-session-chris` (right home, wrong framing): viable with rewrite.** Surface is correct; the proposal's framing ("we noticed you struggled with Saddles") is a grade-report register, which is a persona violation for a user whose post-session job is drill-down, comparison, and retroactive correction — not quizzing. Reframe as a **review tool**, not a report card.
- **`study-block` (primary home): viable, with one subtle gap.** Study-block explicitly wants "targeted-weakness drill as the default path — no friction to start." This is seeding's ideal situational. But **study-block with a hard end** ("10 minutes before my stop") must complete a coherent unit inside the declared window — not leave the learner mid-concept when they close the app. Gate 4 requires time-budget-aware lesson unit sizing.
- **`between-hands-chris`/`study-block` overlap with presession-preparer:** see below.
- **`newcomer-first-hand` (blocking situational): banned.** Explicit block on the feature while this persona applies.
- **`presession-preparer` (critical clash — highest-risk finding): unresolved.** The owner opens the app 15 minutes before a live session expecting **tonight's-villain-specific prep** (per that persona's primary JTBD). Adaptive seeding that delivers a **general Shape Language lesson** at this moment is a direct persona collision, and the feature proposal does not resolve which wins. **Resolution (facilitator position): presession wins by default; adaptive seeding appends only tonight-adjacent descriptor recognition patterns** (e.g., if tonight's villain has a known Spire tendency, offer a 60-second Spire refresher). Generic seeded lessons do not run in this surface.

### Red-line follow-ups

- **Whitelist of permitted seeding surfaces, not a blacklist.** The UX voice is correct: adaptivity's reach must be *allowlisted*, not *denylisted*. v1 whitelist = `study-block` + `post-session-chris` + `presession-preparer` (tonight-adjacent only). Everything else is banned by default.
- **Time-budget-aware lesson units.** A lesson must be decomposable into units completable in the declared window. Gate 3 research: what is a "unit"? A single drill? A drill + reveal? A 3-drill mini-block?
- **IDB persistence of skill-model.** Phone-sleep mid-assessment must not lose progress. Senior engineer confirms `shapeMastery` store is IDB-backed at v18; Gate 3 must document this as an invariant.
- **Presession-vs-adaptive arbitration rule.** Presession wins; seeding appends. This is a design constraint to propagate to Gate 4.
- **Structural mismatch on live surfaces propagates to a UI contract:** LiveAdviceBar surfaces only classifier-fired badges. Seeding internals are invisible. The SizingPresetsPanel embed (Sizing Curve Tag) follows the same rule — the tag is a classifier output, not a seeded lesson surface.

---

## Stage D — Cross-product / cross-surface

**Output: ⚠️ Partner surfaces need updates + one scope assumption to fix.**

### Findings

Senior engineer is the primary voice. Headline correction: **IDB is at v17 (not v15).** `villainAssumptions` store landed 2026-04-21 (Exploit Deviation Engine). Shape Language migration is **v17 → v18**, additive only.

**State model — three orthogonal pieces that must not live together:**

1. `shapeMastery` — per-descriptor Bayesian `{descriptorId, alpha, beta, lastInteractedAt, lastValidatedAt, confidence, overrideConfidence}`. Beta-Binomial, consistent with codebase convention (SYSTEM_MODEL §12 2026-03-08).
2. `shapeLessons` — per-lesson `{lessonId, descriptorIds[], status, startedAt, completedAt, attemptCount, lastResult}`. Separate because lesson-complete ≠ mastery-moved and mastery-moved ≠ lesson-complete.
3. `recommendationState` — derived, cacheable, re-derivable from (1) + (2). Carries `generatedAt` + `staleAfter`; re-derives if > 24h.

Self-assessment override lives **inside** (1) as `overrideConfidence`, not as a flag that disables the Bayesian update — the user will change their mind. Decay is **computed on read**, not written, to avoid a timer-driven write storm (STP-1 RT-60 lesson: timers outside lifecycle registries become zombies).

**IDB v17 → v18 migration:** two new additive stores, keyed by `[userId, descriptorId]` and `[userId, lessonId]`. Pattern precedent is `migrateV17` (`migrations.js:478`) — compound key, domain-field indexes, `schemaVersion` field per-record for in-line migration per I-AE-5. **Do not** extend `players` or `settings` with nested shape data — that's the trap `migrateV10` fell into with `exploitBriefings[]`.

**New reducer + context:** `shapeLanguageReducer.js` + `ShapeLanguageContext.jsx`, mirroring the just-landed `AssumptionContext` / `assumptionReducer.js`. Persistence hook `useShapeLanguagePersistence` at 1.5s debounce (established pattern).

**Provider + selector story:** `ShapeLanguageProvider` wraps all three pieces; mounts in `PokerTracker.jsx` provider stack alongside `AssumptionProvider`. Selector library at `src/utils/shapeLanguage/selectors.js` — pure functions called via `useShapeLanguage(selector)` to keep re-render scope minimal. This prevents a repeat of the `usePlayerTendencies` (RT-28) pan-provider thrash.

**Hook-hoisting trap (FM-Hoisted-Persistence-Hook-Race, §5.1b):** if a lesson-picker view mounts Silhouette + Spire + Sizing tabs simultaneously and each calls `useShapeLanguagePersistence()`, they desync. **Hoist to provider. Non-negotiable.**

**Writer registry enumerable** (FM from SR program, §5.1 RT-43): a single file lists every surface that dispatches a mastery-mutating action. Adding a new writer requires a doc update. Prevents the silent-multi-entry-point bug class.

**Sidebar extension parity:** the extension (`ignition-poker-tracker/`) is **mastery-agnostic** — shows all descriptor tags always. Pedagogical "only show what you've learned" logic is main-app-only. Preserves SR doctrine separation (R-5.6, R-10.1 are about render honesty, not learning) and sidesteps SW-reanimation state-rehydration. Document this as a doctrine rule in `ignition-poker-tracker/CLAUDE.md`.

**Cold-start:** no placement test (friction; owner explicitly said "cognitive prosthesis"). On v17→v18 upgrade, hydrate all 10 descriptors at `alpha=1, beta=1`, `lastInteractedAt=null`. First recommendation = **Range Silhouette** unconditionally (top-ranked in roundtable, broadest surface coverage, shallowest curve). After 3 interactions, switch to adaptive mode.

**Engine-drift risk (FM-Engine-Drift-Silent-Invalidation, §5.1c):** if a lesson asserts "Saddle fires when Δ > 35" and the threshold changes in code, the lesson is silently wrong. Apply RT-108-style fixed-seed snapshot tests for every authored lesson's worked example; drift fails CI.

**Export / backup:** existing export path needs audit (SYSTEM_MODEL doesn't list one for range profiles or assumptions). Scope additively: `shapeMastery` + `shapeLessons` + `villainAssumptions` + `rangeProfiles` all added to export writer as part of this project.

### Recommended follow-ups for Gate 3 / Gate 4

- [ ] Schema doc `docs/projects/poker-shape-language/schema.md` for `shapeMastery` + `shapeLessons` (additive-only, per-record `schemaVersion`).
- [ ] Writer registry doc `docs/projects/poker-shape-language/WRITERS.md` — enumerable, PR-gated updates. Mirror SYSTEM_MODEL §4.1 I-INV-PAYLOAD style.
- [ ] `migrateV18` pattern in `migrations.js` (copy `migrateV17`).
- [ ] `gen-tests` on new reducer: idempotent mastery updates, cold-start hydration, RESET action, read-time schema migration.
- [ ] RT-108-style snapshot tests for every authored lesson's worked example (engine-drift defense).
- [ ] Cross-surface test: simulated hook-hoisting race — two surfaces call `useShapeLanguagePersistence()`, assert single IDB load, assert cross-surface write visibility within one render tick.
- [ ] Extension doctrine rule added to `ignition-poker-tracker/CLAUDE.md`: "Extension is mastery-agnostic."
- [ ] Backup/export audit + additive expansion to include the new stores + the existing unexported stores.

---

## Stage E — Heuristic pre-check

**Output: ❌ (as currently sketched) — fixable with the red lines below.**

### Findings — Nielsen 10

- **H-N03 (user control & freedom) — undo on mastery declarations AND on algorithmic inference.** A user or system marking "Saddle: mastered" incorrectly starves that descriptor of practice. Declaration must be revocable indefinitely (not via a 5s toast). Equally important: the user must be able to dispute a *system-inferred* mastery ("I got lucky — keep drilling me"). Without this, seeding becomes a black box.
- **H-N05 (error prevention) — ambiguous skip-vs-mastered.** A user tapping "skip" because the drill is easy vs because they're tired must be disambiguated at tap time (Autonomy's one-time-disambiguation pattern).
- **H-N10 (match system and real world) — never reference un-introduced descriptors.** Seeding cannot tell a month-1 learner "your Basin recognition is weak" if Basin hasn't been introduced yet. The seeder must respect descriptor-introduction order.

### Findings — Poker-Live-Table

- **H-PLT01 (sub-second glanceability) — seeding internals never render on live surfaces.** Only descriptor badges from the classifier fire there. The seeder is headless on LiveAdviceBar. (Ties to Stage C's structural mismatch.)
- **H-PLT04 (socially discreet) — no "you are learning" indicator at the live table.** Conspicuous to tablemates. Seeding artifacts on live surfaces must be indistinguishable at a glance from normal advice.
- **H-PLT07 (state-aware primary action) — seeding's primary action changes by surface.** Study-block primary = "start today's drill"; post-session primary = "review what fired"; presession primary = "tonight's watchlist." A single fixed primary action across surfaces violates PLT07.

### Findings — Mobile-Landscape

- **H-ML06 (touch targets ≥44×44 scaled).** Skill-map visualization (10 descriptors × levels) on 1600×720 under `useScale` will compress sub-44px per cell unless designed against it. Gate 4 must show the scaled-measurement math up front.
- **H-ML04 (scale interaction).** Related — the skill map cannot assume sub-pixel rendering of dendrograms/matrices. Prefer the silhouette-glyph pattern for mastery visualization (paralleling the roundtable's Stage C resolution on pictogram-over-dendrogram).

### Findings — Autonomy/Agency (augmented from skeptic voice) — the eight red lines

1. **Opt-in enrollment required.** Skill inference runs only inside an explicit "start a study program" act. Outside enrolled state, drill interactions are ephemeral and produce no skill inference.
2. **Full transparency screen.** Always one tap away: per-descriptor skill estimate, evidence list ("which drill, when, what you answered"), and next-lesson justification in one English sentence. Parity with existing villain-model transparency.
3. **Durable override.** Skip / declare-mastery is respected for N sessions; does not trigger adversarial re-inference ("he's avoiding this because he's weak" — Duolingo's named mistake).
4. **Three-way reversibility.** (a) Per-descriptor reset, (b) global model reset, (c) **incognito drill mode** — practice without being graded. The incognito mode is the non-obvious requirement.
5. **No streaks, no shame, no notifications.** Zero engagement-pressure mechanics. Missing a week is valid.
6. **Flat lesson index always accessible.** Every descriptor clickable from a flat list regardless of inferred readiness. Adaptivity sets *default order*, never *access*.
7. **No gamified-infantile language.** No badges, titles, mascots, celebratory animations. Editor's-note tone ("Next: Polarization Bar — this pairs with Spire, which you already have.").
8. **No cross-surface contamination.** LiveAdviceBar never shades its recommendations based on inferred-weakness-in-descriptor-X. Study inference stays in the study surface.

---

## Overall verdict

**RED.**

Gate 2 surfaced two structural mismatches, four JTBD domain gaps, one persona amendment + one situational to author, one refused persona (streak-habitualist), a full IDB migration scope, and eight autonomy red lines. The feature is the right feature — a ten-descriptor curriculum is valuable, FSRS-style retention is valuable, and the top-6 descriptors in the theory roundtable are load-bearing. But as currently sketched, it **imports ed-tech's autonomy-violation defaults by silence**, and it places the seeding algorithm on surfaces where it structurally does not belong. Both are fixable.

### Top 3 structural risks

1. **Autonomy violation via implicit modeling.** Interaction-as-consent is the wrong default for this owner. Mitigated by opt-in enrollment + incognito drill + full transparency screen.
2. **Live-surface contamination.** Seeding internals on LiveAdviceBar / SizingPresetsPanel is a structural mismatch with `mid-hand-chris`. Mitigated by: algorithm is headless on live surfaces; only classifier-fired descriptor badges render.
3. **State model + IDB migration scope.** v17 → v18, three orthogonal pieces of state, hook-hoisting race risk, engine-drift silent-invalidation risk. Mitigated by: additive stores, hoisted persistence hook, enumerable writer registry, RT-108 snapshot tests for authored lessons.

### Top 3 non-negotiable red lines for Gate 4

1. **Opt-in enrollment + incognito drill mode + full transparency screen** — all three. No subset is sufficient. This is the autonomy triad.
2. **Seeding algorithm is headless on live surfaces.** LiveAdviceBar and SizingPresetsPanel render only classifier-fired descriptor badges. Seeding UI is study-surface-only (study-block + post-session-chris + presession-preparer with tonight-adjacent scoping).
3. **Newcomer situational disqualifies the feature.** Seeding does not fire while newcomer-first-hand applies. Explicit v1 constraint; Gate 3 must specify detection machinery or explicitly accept first-hand ambiguity as "defaults to no seeding."

### Gate 3 requirement

**Yes.** LIFECYCLE.md requires Gate 3 from any YELLOW/RED Gate 2. Gate 3 scope below is non-trivial (5 research items + 1 competitive survey + 1 owner interview). This is not a Gate-2-rubber-stamp feature.

---

## Required follow-ups

### Gate 3 (Research) — scope

- [ ] **Skill-level taxonomy for Shape Language descriptors.** What are the stable levels? (Pre-prototype, Novice, Practicing, Reliable, Mastered — or fewer?) Anchor in BKT + FSRS literature. Deliverable: `docs/projects/poker-shape-language/skill-levels.md`.
- [ ] **Cold-start research.** Owner co-authored the catalog — novice-default is wrong. Design the inference-from-history path (if descriptors aren't tagged on existing drill records, what proxies work?), the self-placement path, and the fallback hardcoded-Silhouette seed. Deliverable: cold-start spec.
- [ ] **Resumption-after-break research.** Decay curve, reseed-vs-resume decision rule, break-length thresholds. FSRS forgetting-curve literature.
- [ ] **Lesson-unit sizing research.** What completes cleanly in a 10-minute study block? A 30-minute morning block? A 5-minute between-hands slot?
- [ ] **Presession-vs-adaptive arbitration rule.** Precisely how does "tonight-adjacent" get computed from tonight's villain profile? Needs a worked example.
- [ ] **Competitive survey follow-up.** Market lens covered Duolingo / Anki-FSRS / Khan / Chess.com / GTOW. Gate 3 should produce one additional pass on *poker-specific* learning tools (if any exist beyond GTOW) — resolve whether the "intelligent defaults with cheap override" balance point (Chess.com model) is the right target.
- [ ] **Owner interview** on five questions below (Open Questions).

### Persona / JTBD additions

- [ ] Amend `personas/core/chris-live-player.md`: `skill_state_per_descriptor` attribute + autonomy-constraint paragraph.
- [ ] Amend `personas/core/scholar-drills-only.md`: `skill_state_per_descriptor` attribute; flag streak language as deferred.
- [ ] Author `personas/situational/returning-after-break.md`.
- [ ] Author JTBD `DS-52 Retention maintenance`, `DS-53 Edge-case probe`, `DS-54 Exploration override`, `DS-55 Resumption after break`, `ON-87 Cold-start descriptor seeding`. Evaluate DS-56 for decomposition vs DS-53.
- [ ] Retire / reframe `JTBD-DS-46` (spaced repetition) → DS-52.
- [ ] Add an **out-of-scope** note: streak-formation JTBD is explicitly refused for v1 with autonomy rationale.

### Design adjustments before Gate 4

- [ ] **Whitelist of permitted seeding surfaces (v1):** study-block + post-session-chris + presession-preparer (tonight-adjacent only). All other surfaces: seeding headless.
- [ ] **Recalibrate-descriptor action** on skill-map (undoes both user declaration and algorithmic inference).
- [ ] **Disambiguated skip controls**: one-time tap "already know" vs "not today" at skip-time.
- [ ] **Surface-specific primary-action map** (for H-PLT07 compliance).
- [ ] **Descriptor-introduction-order invariant** ("never reference un-introduced concepts").
- [ ] **LiveAdviceBar headless-seeding rule** propagated to the surface artifact.
- [ ] **Scaled-viewport skill-map math** (H-ML06 compliance pre-demonstrated in Gate 4 design).
- [ ] **Writer-registry doc** `docs/projects/poker-shape-language/WRITERS.md`.
- [ ] **Schema doc** `docs/projects/poker-shape-language/schema.md` (v17 → v18 additive).
- [ ] **Extension doctrine** amendment in `ignition-poker-tracker/CLAUDE.md`: mastery-agnostic.

### Open questions for the owner

1. **Enrollment granularity**: one global enrolled flag, or per-descriptor enrollment? (Global is simpler; per-descriptor is more autonomous.)
2. **Cold-start inference**: do you want the system to infer starting level from your existing drill / hand history, or would you rather self-place (or start all at zero)?
3. **Presession-vs-adaptive arbitration**: is "tonight-adjacent only" the right rule, or should presession fully lock out adaptive entirely?
4. **Incognito drill as default vs toggle**: should drills be graded by default (with an incognito toggle) or ungraded by default (with an "include in my model" toggle)?
5. **Skill map as a new view or embedded?** A new primary surface (`ShapeLanguageView`?) or embedded in an existing one (Settings? SessionsView?)?
6. **Lesson-unit length commitment**: willing to commit to units that fit inside 10 minutes, or do you want the freedom to go deeper?

---

## Backlog proposals

Copy-paste ready for `.claude/BACKLOG.md`:

```
- [P0] [SLS-G2-R1] Persona amendment: chris-live-player skill-state attribute + autonomy-constraint paragraph
- [P0] [SLS-G2-R2] Persona amendment: scholar-drills-only skill-state attribute
- [P0] [SLS-G2-R3] Author situational persona: returning-after-break
- [P0] [SLS-G2-R4] Author JTBDs DS-52 (retention), DS-53 (edge-case probe), DS-54 (exploration override), DS-55 (resumption), ON-87 (cold-start seeding); retire DS-46
- [P0] [SLS-G2-R5] Document streak-formation JTBD as explicitly out-of-scope with autonomy rationale
- [P0] [SLS-G2-R6] Gate 3 research: skill-level taxonomy for Shape Language descriptors
- [P0] [SLS-G2-R7] Gate 3 research: cold-start inference from existing history / self-placement / hardcoded Silhouette seed
- [P1] [SLS-G2-R8] Gate 3 research: resumption-after-break decay curve + reseed-vs-resume rule
- [P1] [SLS-G2-R9] Gate 3 research: lesson-unit sizing for 10/30/5-minute surfaces
- [P1] [SLS-G2-R10] Gate 3 research: presession-vs-adaptive arbitration rule with worked example
- [P0] [SLS-G2-D1] Gate 4 design constraint: seeding whitelist = study-block + post-session + presession(tonight-adjacent)
- [P0] [SLS-G2-D2] Gate 4 design requirement: opt-in enrollment + incognito drill mode + transparency screen (autonomy triad, non-bypassable)
- [P0] [SLS-G2-D3] Gate 4 design requirement: seeding algorithm headless on LiveAdviceBar and SizingPresetsPanel (classifier-fired badges only)
- [P0] [SLS-G2-D4] Gate 4 design requirement: newcomer situational disqualifies seeding (explicit v1 constraint)
- [P1] [SLS-G2-D5] Gate 4 design: recalibrate-descriptor action; disambiguated skip; surface-specific primary-action map; descriptor-introduction-order invariant
- [P1] [SLS-G2-D6] Gate 4 design: scaled-viewport math for skill-map (H-ML06 pre-demonstration)
- [P1] [SLS-G2-E1] schema.md for shapeMastery + shapeLessons (additive, per-record schemaVersion)
- [P1] [SLS-G2-E2] WRITERS.md enumerable writer registry for mastery-mutating actions
- [P1] [SLS-G2-E3] migrateV18 in migrations.js (copy migrateV17 pattern)
- [P1] [SLS-G2-E4] gen-tests on shapeLanguageReducer (idempotency, cold-start, RESET, read-time schema migration)
- [P1] [SLS-G2-E5] RT-108-style snapshot tests for every authored lesson's worked example (engine-drift defense)
- [P1] [SLS-G2-E6] Cross-surface hook-hoisting race test
- [P2] [SLS-G2-E7] Extension doctrine rule in ignition-poker-tracker/CLAUDE.md: mastery-agnostic, shows all tags
- [P2] [SLS-G2-E8] Backup/export audit + additive inclusion: shapeMastery, shapeLessons, villainAssumptions, rangeProfiles
- [P2] [SLS-G2-E9] Recommendation staleness threshold: generatedAt + re-derive if >24h (mirror usePlayerTendencies RT-28)
```

---

## Change log

- 2026-04-23 — Draft. Gate 2 blind-spot for adaptive-seeding feature. 4-voice roundtable synthesis. Verdict RED with 3 structural risks + 8 autonomy red lines + 5 Gate 3 research items. Gate 3 required per LIFECYCLE.md.
