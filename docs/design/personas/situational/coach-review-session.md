# Situational Sub-Persona — Coach Review Session

**Type:** Situational (cross-persona)
**Applies to:** Coach, Apprentice (from other side)
**Evidence status:** PROTO
**Last reviewed:** 2026-04-21

---

## Snapshot

A coach and student meet for a scheduled lesson (Zoom, in-person, or async). The coach has pre-reviewed flagged hands from the student's recent sessions; the student has prepared questions. During the call, they walk through specific hands together, annotate decisions, identify patterns, and assign follow-up drills.

---

## Situation trigger

- Scheduled coaching session starts.
- Or: async review where coach records annotations and sends back.
- Exits when: lesson ends or session timer expires.

## Context

- **Time pressure:** Medium — lesson has a budget (typically 60 min). Each hand gets 3–10 min.
- **Attention:** Focused on both sides.
- **Cognitive load:** High for depth, low for speed.
- **Communication:** Voice + screen-share (live) or voice/text annotations (async).

## Primary need (Coach)

- Queue of flagged hands with student context pre-loaded.
- Annotation tools — street-by-street comment, voice memo, highlight.
- Share-view mode so student sees the same frame.

## Primary need (Apprentice)

- See coach's annotations persistently after the lesson ends.
- Mark hands for follow-up review after the lesson.
- Drill assignments with clear pass criteria.

## Secondary needs

- Recording the lesson (or summary) for later re-watch.
- Progress mapping (is this lesson's pattern related to last lesson's?).

## What a surface must offer

1. **Shared session state** — coach and student see the same hand, same replay position, same annotations in real time.
2. **Persistent annotations** attached to hands, re-viewable after the session.
3. **Assignment queue** for drills or re-watched hands.
4. **Asymmetric permissions** — coach can annotate, student can ask questions; both can request changes.

## What a surface must NOT do

- Require separate tools (Zoom + Google Docs + screenshots) — that's the status quo to displace.
- Lose annotations on navigation or session end.
- Let student see coach's private notes (annotations vs. private-review notes are different).

---

## Related JTBD

- `JTBD-CO-48` student hand queue
- `JTBD-CO-49` annotate streets with voice / text
- `JTBD-CO-51` assign drills from library or custom
- `JTBD-CO-52` week-over-week mastery trends
- `JTBD-SG-58` shared read-access (privacy boundary)

## Related core personas

- [Coach](../core/coach.md) — primary
- [Apprentice](../core/apprentice-student.md) — co-participant

## Missing features

- [DISC] Coach dashboard with student queue.
- [DISC] Annotation with voice / text attached to hand streets.
- [DISC] Shared session (live collaborative review).
- [DISC] Drill assignment library + custom drills.
- [DISC] Student progress tracking.

---

## Change log

- 2026-04-21 — Created Session 1b.
