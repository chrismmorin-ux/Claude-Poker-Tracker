# JTBD Domain — Coaching

This domain has two modes:

- **Formal-coach mode** (CO-48..53) — third-party Coach reviewing an Apprentice's play and assigning follow-up work. Authored 2026-04-21.
- **Self-coach mode** (CO-54..57) — Chris (live-player) reviewing his OWN play; the user is both coach and student. Authored 2026-05-02 by SCF Gate 1.

Mirror jobs for the student appear in other domains (session review, drills, cross-cutting).

**Primary personas:**
- Formal-coach mode: [Coach](../../personas/core/coach.md), [Apprentice](../../personas/core/apprentice-student.md) (from student side).
- Self-coach mode: [chris-live-player](../../personas/core/chris-live-player.md) in self-coach posture (see persona §Skill-ladder positioning + §Goals when self-coaching).

**Surfaces:**
- Formal-coach mode: coach dashboard (does not exist yet — see DISC-07).
- Self-coach mode: **`SelfCoachView`** (SCF Gate 4 ratified 2026-05-02; surface artifact `surfaces/self-coach-view.md`). 2-tab IA (Study / Settings); Study tab has 3 sections (Hero leaks / Curriculum / Tests history & browse). Plus `surfaces/lesson-card.md` (Curriculum section instantiation), `surfaces/skill-assessment-test.md` (opt-in-test mode of drill engine; thin surface), `surfaces/leak-distillation.md` (cross-surface pipeline UI). HRV inline annotation extension binds CO-54 to per-action ⚑ badge. CO-56 reuses Calibration Dashboard primitives (KEEP SEPARATE per Gate 2 §B Stage B).

---

## CO-48 — Student hand queue in coach dashboard

> When student flags hands for review, I want them queued in my dashboard, so I batch-review efficiently.

- State: **Proposed** (DISC-07).

## CO-49 — Annotate streets with voice/text

> When reviewing, I want to annotate a specific street with voice or text, so my feedback is precise.

- State: **Proposed**.

## CO-50 — Save pattern as reusable lesson

> When I identify a common student pattern, I want to save the explanation as a reusable lesson, so I teach it without rewriting.

- State: **Proposed**.

## CO-51 — Assign drills from library or custom

> When a student needs practice on a concept, I want to assign drills from a library or create custom drills from their hands, so homework is targeted.

- State: **Proposed**.

## CO-52 — Week-over-week mastery trends

> When tracking student progress, I want week-over-week mastery trends by concept, so I justify my fee and see improvement.

- State: **Proposed**.

## CO-53 — Skill-baseline assessment for new student

> When onboarding a new student, I want a baseline assessment (automatic or drill-driven), so I tailor a plan.

- State: **Proposed**.

---

# Self-coach mode  *(SCF Gate 1, 2026-05-02)*

Jobs where the user reviews their **own** play to identify and patch leaks, learn the next concept they're ready for, validate that prior coaching has translated into actual play improvement, and surface predicted-vs-observed confidence gaps as a coaching signal. Authored by SCF Gate 1 (`docs/design/audits/2026-05-02-entry-self-coach-foundation.md`); ratified for SCF Gate 2 (Blind-Spot Roundtable) review.

**Distinct from formal-coach mode:** no third party, no privacy boundary, no fee justification, no week-over-week reporting for billing. The user is both coach and student.

**Load-bearing constraints (all four jobs):** the 9 autonomy red lines on `chris-live-player` apply. Especially #1 (opt-in enrollment, no silent inference), #5 (no shame / engagement-pressure), #7 (editor's-note tone — no gamified-infantile language), #8 (no cross-surface contamination — hero-leak inference does NOT render on live surfaces).

## CO-54 — See own leak surfaced without being graded

> When I review a hand or session, I want my own leaks (not the villain's) surfaced — without it feeling like a graded test or a verdict — so I can patch them without ego cost or defensive reaction.

- State: **Active** (SCF Gate 3, 2026-05-02; promoted from Proposed at SCF Gate 1).
- Primary persona: [chris-live-player](../../personas/core/chris-live-player.md) in self-coach mode.
- Secondary personas: [post-session-chris](../../personas/situational/post-session-chris.md), [between-hands-chris](../../personas/situational/between-hands-chris.md).
- **Surface placement (SCF Gate 4, 2026-05-02):** `surfaces/self-coach-view.md` Hero leaks section (aggregated inventory; n≥30 floor) + `surfaces/hand-replay-view.md` inline hero-leak annotation in HeroCoachingCard (per-action ⚑ badge with inline expansion to full CD-5 claim card). Pipeline: `surfaces/leak-distillation.md`.
- Distinct from CO-48 (coach reviews student): CO-48 is third-party-coach; CO-54 has no third party. Distinct from MH-10 (plain-English why for recommendation): MH-10 is recommendation-reasoning; CO-54 is leak-surfacing.
- **Load-bearing copy discipline (AP-SCF-01 nuance per SCF Gate 3):** Forbidden words on **system-imposed** grading surfaces include `score`, `grade`, `rate your play`, `how did you do?`, `incorrect`, `wrong`. Acceptable on system-imposed surfaces: `noted`, `observed`, `trend`, `pattern`. **PERMITTED on owner-volunteered test surfaces** (opt-in only): factual quiz results display ("3 of 5 correct") — the opt-in gate is the load-bearing autonomy contract. CI-grep enforcement at SCF Gate 5; allowed-context expanded for `cd5_exempt: 'owner-volunteered-test'` manifest flag.

## CO-55 — Learn the next concept I'm ready for given current tier

> When my play is solid at one concept and I'm reviewing recent sessions, I want the system to point me at the next concept I'm ready to learn — based on my current tier (overall player level) plus per-domain mastery — not a generic study queue.

- State: **Active** (SCF Gate 3, 2026-05-02; promoted from Proposed at SCF Gate 1).
- Primary persona: [chris-live-player](../../personas/core/chris-live-player.md) in self-coach mode.
- Secondary personas: [study-block](../../personas/situational/study-block.md), [post-session-chris](../../personas/situational/post-session-chris.md).
- **Surface placement (SCF Gate 4, 2026-05-02):** `surfaces/self-coach-view.md` Curriculum section. Lesson cards (`surfaces/lesson-card.md`) are the building-block instantiation. "Why this concept?" expand reveals per-signal composite breakdown.
- Distinct from DS-43 (drill on today's weak concept): DS-43 is drill-level (which exercise); CO-55 is curriculum-level (which concept). Decision precedes drill selection. Distinct from DS-47 (skill map): DS-47 visualizes mastery; CO-55 sequences progression.
- **Load-bearing constraint:** red line #6 (flat access). Curriculum sequencing CAN suggest "next concept" but CANNOT hide concepts. User can always elect any concept regardless of current tier.
- **Spine signals (per SCF Gate 3 SCF-G3-SPINE; aggregated by `src/utils/skillAssessment/composite.js` per SCF Gate 4 §SCF-G4-MOD):** four-signal composite: hand-authored DAG (skeleton) + observed drill mastery + observed-leak-frequency (heroLeakDetector output) + opt-in owner-volunteered test results. Within-tier ordering weighted (W_leak=0.5, W_drill=0.3, W_test=0.15, W_recent=0.05; weights v1 baseline locked in Gate 4; corpus-driven tuning in Gate 5).

## CO-56 — Validate that prior coaching is translating into play improvement

> When I've worked on patching a leak (drilled the concept, studied the framework, made conscious adjustments at the table), I want to see whether my actual play has changed — not just whether I drilled the concept correctly, but whether the leak in my real hands is reducing.

- State: **Active** (SCF Gate 3, 2026-05-02; promoted from Proposed at SCF Gate 1). **Reconciliation closed** — SCF Gate 2 §B Stage B 3-scenario walk verdict: KEEP SEPARATE. CO-56 audits hero behavioral change ("did MY play change?"); DS-58 audits anchor-claim stability ("does this anchor still hold?"). Shape-similar (both use credible-interval-over-time + drift-arrow + sample-size-aware confidence) but referent-distinct. Infrastructure reuse high (~70% via parameterized credible-interval primitives shared with anchor-calibration store); JTBD separation clean.
- **Success criterion** (per Gate 3 wording amendment): see whether actual play has changed — **with non-graded framing per AP-SCF-01 (system-imposed-grading refused; owner-volunteered tests permitted)**.
- **Surface placement (SCF Gate 4, 2026-05-02):** Reuses `surfaces/calibration-dashboard.md` primitives (parameterized credible-interval-over-time + drift arrow + sample-size-aware confidence) per Gate 2 §B Stage B KEEP SEPARATE verdict. Distinct trend display from CO-54 leak observation; Gate 5 implementation wires the parameter pass-through.
- Primary persona: [chris-live-player](../../personas/core/chris-live-player.md) in self-coach mode.
- Secondary personas: [post-session-chris](../../personas/situational/post-session-chris.md), [study-block](../../personas/situational/study-block.md).

## CO-57 — Self-rate confidence on a line before seeing the verdict

> When I've made a decision in a hand and I'm about to see the system's verdict (post-hoc analysis, drill outcome, or hand replay), I want to first rate my own confidence in the line — so the gap between my predicted confidence and the observed correctness becomes its own coaching signal.

- State: **Proposed** (SCF Gate 1, 2026-05-02). **Deferred to Gate 4 v2** per SCF Gate 3 Open Questions §1 — `assumptionEngine/` has no existing precedent for pre-decision confidence elicitation; the surface affordance is net-new and high design-effort cost. Gate 3 ratifies the JTBD shape; Gate 4 v2 designs the surface; Gate 5 implements.
- Primary persona: [chris-live-player](../../personas/core/chris-live-player.md) in self-coach mode.
- Secondary personas: [post-session-chris](../../personas/situational/post-session-chris.md), [study-block](../../personas/situational/study-block.md).
- **Net-new.** No existing JTBD elicits pre-decision confidence as a coaching signal generator.
- Distinct from MH-12 (cited-assumption trust bridge): MH-12 is consumer-side (user reads system claim); CO-57 is generator-side (user produces a rating). Distinct from DS-58: DS-58 captures system-claim calibration; CO-57 captures user-self-claim calibration.
- **Load-bearing UI sequencing:** rating MUST be captured BEFORE the user sees any verdict, otherwise the gap signal is contaminated. Red line #1 (opt-in): rating is always optional, never required to proceed.

---

## Domain-wide constraints

### Formal-coach mode (CO-48..53)

- All formal-coach jobs rely on auth + multi-user permissions that don't exist today.
- Privacy boundary matters: coach sees hands, not bankroll; student controls what they share.
- Student's own notes should be separable from coach notes.

### Self-coach mode (CO-54..57)

- All self-coach jobs are gated by the 9 autonomy red lines on `chris-live-player`. See SCF Gate 1 audit §Discovery 5.
- Tier metadata + per-domain mastery + lesson-to-leak binding are net-new schema (TBD SCF Gate 4 spec).
- Hero leak detection requires a hero-side analog of `weaknessDetector.js` (TBD SCF Gate 5 implementation).
- Live surfaces (OnlineView, sidebar) MUST NOT render hero-leak annotations (red line #8 — no cross-surface contamination).

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-05-02 — Added **Self-coach mode** sub-section with CO-54..57 (SCF Gate 1, SPR-012 / WS-009). Domain scope expanded to include user-coaches-self mode. CO-56 flagged for reconciliation against DS-58 in SCF Gate 2.
- 2026-05-02 (later) — SCF Gate 4 surface placements added (SPR-020 / WS-012). CO-54 → SelfCoachView Hero leaks section + HRV inline annotation in HeroCoachingCard. CO-55 → SelfCoachView Curriculum section; lesson cards are building blocks. CO-56 → reuses Calibration Dashboard primitives (KEEP SEPARATE per Gate 2 §B Stage B). Top-of-file Surfaces list updated. CO-57 stays Proposed v2-deferred (no surface placement until Gate 4 v2).
