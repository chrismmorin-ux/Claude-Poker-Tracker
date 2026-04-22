# Persona — The Coach

**Type:** Core (end-user archetype)
**Evidence status:** PROTO — unverified
**Last reviewed:** 2026-04-21

---

## Snapshot

Sells 1-on-1 poker lessons at $100–300/hour. Coaches 5–15 students concurrently. Needs to review student hand histories quickly, annotate them, assign drills / homework, and track student progress. Currently uses PT4 + Zoom + Discord + Google Docs — fragmented, frustrating.

## Context

- **Venue:** Online reviews from home office.
- **Format:** Sees student hands across all formats.
- **Skill:** Expert.
- **Volume:** 20–40 coaching hours/month + review time.
- **Device:** Desktop primarily; phone for checking student flags.
- **Intent:** Review + annotate + assign + track.
- **Role:** Coach.

## Goals

- Import/view student hand histories quickly.
- Annotate specific streets with voice or text.
- Assign drills targeted to student weaknesses.
- Track student progress across weeks.
- Scale to 10+ students without losing personalization.

## Frustrations

- Current workflow is duct-taped across multiple tools.
- No way to assign targeted practice that the app enforces.
- Can't track whether student actually worked on assigned weakness.
- Lesson prep takes as long as the lesson itself.

## Non-goals

- Playing at high volume personally.
- Competing on micro-stakes online for profit.

---

## Constraints

- **Time pressure:** Batched — blocks of coaching then blocks of review.
- **Error tolerance:** Low in annotations; high in exploratory analysis.
- **Visibility tolerance:** High. Wants depth.
- **Complexity tolerance:** High. Power-user.

---

## Related situational sub-personas

- [Coach review session](../situational/coach-review-session.md)
- [Pre-lesson hand review](../situational/coach-review-session.md) — same file, different triggers.

## Related JTBD

- `JTBD-CO-*` coaching (student queue, annotation, drill assignment, progress tracking)
- `JTBD-DE-*` data-export/integration (import PT4/HM3 student files)
- `JTBD-SR-*` session review (adapted for student data)

## Product line

- **Main app.** Coach dashboard is a product role, not a separate product line.

## Tier fit

- **Studio (Teams) ~$149/mo** with per-student seats. Professional expense.

---

## Missing-feature needs

- [DISC] Coach dashboard with student queue.
- [DISC] Annotation with voice/text on specific streets.
- [DISC] Drill assignment library + custom drills.
- [DISC] Student progress tracking (week-over-week mastery).
- [DISC] PT4/HM3 student-file import.
- [DISC] Shareable replay links.

## Proto caveats

- **[C1]** $60–150 WTP. Basis: business expense, typical coach tooling spend. Verify.

---

## Change log

- 2026-04-21 — Created Session 1b.
