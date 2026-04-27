# Gate 3 Triage — Shape Language Adaptive Lesson Seeding

**Status: SUPERSEDED BY DECISION MEMO (2026-04-23).** All 6 research threads (R1-R6) resolved in `gate3-decision-memo.md`. Persona/JTBD authoring shipped same session. Gate 2 re-run GREEN — see `docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding-rerun.md`. Gate 3 CLOSED.

**This file is kept as provenance only — do not use as a task list.** Active Gate 4 scope is enumerated in the re-run audit §"Gate 4 spec carry-forwards" and the charter's Stream A section.

---

**Triggered by:** Gate 2 RED verdict (`docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md`).
**Purpose:** Extract concrete research items, persona/JTBD authoring work, and design red lines from the Gate 2 audit; scope each for a future session.
**Gate 3 is mandatory per LIFECYCLE.md before Gate 4 can start.**

---

## Research threads (6)

Each thread is scoped to land in one session (or less). Citations required for every claim that informs a design decision.

### R1 — Stable skill-level taxonomy for a descriptor
**Question:** What are the discrete levels of mastery for a single descriptor (e.g., Silhouette)?
**Sources to consult:** BKT (Corbett & Anderson, Knowledge Tracing), DKT (Piech et al.), FSRS (Ye Jiarui), Duolingo / Chess.com level taxonomies.
**Output:** named level set (e.g., Pre-prototype → Novice → Practicing → Reliable → Mastered) with evidence requirements per transition.
**Blocks:** Gate 4 skill-map surface spec.

### R2 — Cold-start + opt-in enrollment UX
**Question:** How do adaptive-learning products let an expert user bootstrap without feeling patronized? How do they handle the "I already know this" case?
**Sources:** Duolingo placement test UX, Khan Academy Mastery onboarding, Anki deck-import flows, Brilliant sign-up, GTO Wizard study setup.
**Output:** proposed enrollment flow (screens, copy, defaults) + cold-start state specification.
**Blocks:** Gate 4 enrollment journey + `onboarding` JTBD extension.

### R3 — Transparency-screen information architecture
**Question:** What does "the system thinks I'm at Reliable on Silhouette and Novice on Saddle, here's why" look like? What evidence does it surface, and in what form?
**Sources:** Duolingo Oral Exam / placement explainer, Khan progress pages, Anki learning stats, medical decision-aid UX literature.
**Output:** screen spec with information density budget for 1600×720 + desktop variants.
**Blocks:** Gate 4 skill-map surface spec.

### R4 — Override UX + signal-vs-preference disambiguation
**Question:** When the user skips a lesson or dismisses a recommendation, is that a signal (model should learn) or a preference (model should respect without learning)? How do other products handle the ambiguity?
**Sources:** Autonomy skeptic voice cites specific dark-pattern literature; reconsult. Netflix "not interested" vs Duolingo "skip" vs Anki "again". Self-determination theory research (Deci & Ryan).
**Output:** override UX spec with explicit disambiguation ("Already know this" vs "Not today" vs "Not interested in this descriptor").
**Blocks:** Gate 4 interaction spec; relates to DS-54 (exploration override) JTBD.

### R5 — Incognito drill mode + reversibility
**Question:** What does a practice-without-being-graded mode look like? What state does it write, what state doesn't it write? What's the UX for "reset my skill model"?
**Sources:** Anki's "preview" mode, chess trainers' "puzzle rush / puzzle streak / puzzle storm" modes, video game practice-mode conventions.
**Output:** incognito-mode spec + full-reset UX spec + "unmodel me" affordance.
**Blocks:** Gate 4 interaction spec; non-negotiable per autonomy red line #4.

### R6 — Returning-after-break detection + reseed logic
**Question:** After how long should the system assume decay rather than resume? What's the reseed path? What do FSRS/BKT say about re-entry?
**Sources:** FSRS documentation on card-interval decay, Duolingo "welcome back" reseed, SM-2 re-introduction patterns.
**Output:** reseed-vs-resume logic + welcome-back UX spec.
**Blocks:** Gate 4 interaction spec; `returning-after-break` situational persona.

---

## Persona / JTBD authoring work

### Personas to amend (2)

- **`docs/design/personas/core/chris-live-player.md`** — add `skill_state_per_descriptor` attribute of shape `{level, confidence, lastTouched, trendDirection}`. Add autonomy-constraint paragraph: *"The app may not form persistent opinions about the owner's skill without an explicit enrolled-state toggle. Recommendations are hypotheses, not verdicts."*
- **`docs/design/personas/core/scholar-drills-only.md`** — add same `skill_state_per_descriptor` attribute. Leave existing streak language intact but flag it as deferred to a future opt-in mode.

### Situational personas to author (1)

- **`docs/design/personas/situational/returning-after-break.md`** — Chris or Scholar returning after 3+ weeks away. Skills decayed; model overconfident; needs reseed rather than resume. Shapes R6 research thread.

### Situational personas deferred

- **`plateaued-learner`** — express as an attribute-state (`trendDirection: plateaued`) first; revisit in later Gate 3 if distinct behavior patterns emerge.

### Situational personas refused

- **`streak-habitualist`** — violates autonomy red line #5 (no streaks/shame/engagement-pressure). Do not author.
- **`skeptical-learner`** — the owner IS the skeptic; encoding him as a distinct persona creates fiction. Autonomy handled as cross-cutting constraint on `chris-live-player`.

### JTBDs to add (5)

Proposed location: new `docs/design/jtbd/domains/adaptive-learning.md` domain OR extension of `cross-cutting.md`. Decide in Gate 3.

- **DS-52 — Retention maintenance.** Owns FSRS-style re-surfacing of mastered descriptors.
- **DS-53 — Edge-case probe.** Defends against mastery-illusion from over-personalization.
- **DS-54 — Exploration override.** Non-negotiable — structural defense of learner agency.
- **DS-55 — Resumption after break.** Pairs with R6 research + situational persona.
- **ON-87 — Cold-start descriptor seeding.** Owns the "expert user bootstrapping without a placement test" outcome.

### JTBD refused

- **Streak-formation JTBD** — out of scope per autonomy red line.

### JTBD deferred

- **DS-56 Calibration check** — may be decomposable into DS-53. Revisit after Gate 3 research.

---

## Design red lines for Gate 4 (non-negotiable)

These come from the Autonomy skeptic voice, endorsed by the Gate 2 audit as the feature's structural defense:

1. **Opt-in enrollment required.** No silent skill inference. Using the app is not consent to be modeled.
2. **Full transparency screen.** Estimate + evidence + next-lesson rationale visible on demand.
3. **Durable overrides.** Override declarations persist and don't trigger adversarial re-inference.
4. **Three-way reversibility.** Full reset + delete skill data + incognito drill mode (practice without being graded).
5. **No streaks, no shame, no engagement-pressure notifications.** Including future notifications, streak counters, daily-goal nudges, and streak-freeze monetization.
6. **Flat lesson index always accessible.** Adaptivity sets order, never access. Owner can always hand-pick a lesson regardless of skill-state.
7. **No gamified-infantile language.** Editor's-note tone, not "Nice work! 🎉 You're a Silhouette Master!"
8. **No cross-surface contamination.** Study-mode inference stays in study surface. Live-table surfaces (LiveAdviceBar, SizingPresetsPanel) render only classifier-fired descriptor badges. The seeding algorithm is headless on live surfaces.

**Additional structural constraint (Product/UX voice):**

9. **Explicit v1 exclusion.** Seeding does not fire while `newcomer-first-hand` situational applies. Newcomer cannot absorb Shape Language vocabulary; activating seeding for them violates H-N10.

---

## Owner interview questions (for Gate 3 kickoff)

The Gate 2 audit lists open questions requiring owner input. Surface these at the start of the Gate 3 session:

1. **Opt-in enrollment: per-descriptor or per-feature?** Enable Shape Language once, or enable each descriptor separately?
2. **How aggressive is retention re-surfacing?** Weekly? Monthly? Never unless explicitly requested?
3. **Self-assessment vs behavioral-signal weighting?** If owner self-reports Mastered but drill data suggests Practicing, which wins?
4. **Incognito mode default: on or off?** The anti-grading safety toggle — which is the default state?
5. **Skill-model portability / export?** Is skill data included in app export/backup? Can it be selectively excluded?
6. **Cold-start: expert bypass or everyone starts the same?** Owner co-authored the descriptors — should he be able to pre-declare Mastered on Silhouette, or is that a privilege-of-authorship rather than a generalizable pattern?

---

## Exit criteria for Gate 3

Gate 3 is complete when:

- All 6 research threads have findings docs in `docs/projects/poker-shape-language/gate3-research/R[1-6].md`.
- 2 personas amended.
- 1 situational persona authored.
- 5 JTBDs authored (location decided — new domain or extension).
- Owner interview questions answered (session with owner).
- Updated persona/JTBD framework passes a **re-run of Gate 2** against the updated framework — output must be GREEN or YELLOW (with residual YELLOWs explicitly scoped for Gate 4 attention).
- Design red lines propagated to `docs/projects/poker-shape-language.project.md` Decisions Log (already done this session).

When Gate 3 exits GREEN/YELLOW, Gate 4 (design spec) starts.
