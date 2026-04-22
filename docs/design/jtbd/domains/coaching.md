# JTBD Domain — Coaching

Jobs that support a coach reviewing a student's play and assigning follow-up work. Mirror jobs for the student appear in other domains (session review, drills, cross-cutting).

**Primary personas:** [Coach](../../personas/core/coach.md), [Apprentice](../../personas/core/apprentice-student.md) (from student side).

**Surfaces:** coach dashboard (does not exist yet — see DISC-07).

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

## Domain-wide constraints

- All coaching jobs rely on auth + multi-user permissions that don't exist today.
- Privacy boundary matters: coach sees hands, not bankroll; student controls what they share.
- Student's own notes should be separable from coach notes.

## Change log

- 2026-04-21 — Created Session 1b.
