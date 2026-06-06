# Gate 1 — Entry — 2026-06-05 — Mid-Hand Tag-for-Review

**Date:** 2026-06-05
**Project:** Mid-hand tag-for-review (review-workflow)
**Author:** Claude (main)
**Format:** Per `docs/design/LIFECYCLE.md` Gate 1 (Entry) — scope classification, personas, JTBD, gap analysis.
**WS ticket:** WS-190. **Sprint:** SPR-107.
**Verdict:** 🟡 **YELLOW** — proceed; Gate 2 blind-spot questions folded into the Gate 4 surface (small blast radius, all-reused patterns) rather than a full roundtable.

---

## Feature summary

A one-tap affordance during live action entry that flags the current hand for later study. Tagged hands accumulate in a Review Queue ("Tagged ⭐") on the Sessions view; tapping a queued hand opens it in HandReplayView, where a "Reviewed — clear tag" button removes the flag. Storage is an additive `reviewTag` field on the hand record (IDB v27).

Owner request, verbatim (2026-05-12): *"We need a way for a player to tag a hand for later review, while entering the hand."*

## Scope classification

- **New surface?** No new routed view. Adds: one control to TableView's ControlZone; one panel to SessionsView; one badge+button to HandReplayView's header.
- **New interaction modality?** Mild — a tag-during-entry toggle. Reuses the existing button/`btn-press` idiom; no new gesture.
- **New persistent state class?** Yes — `reviewTag` on hand records (additive, mirrors the v25 `predictionAudit` precedent).
- **Cross-product impact?** None. Live-table → history-review loop only.

## Personas served

- **mid-hand-chris** (primary) — at the table, mid-action-entry. Needs to flag without breaking flow. Load-bearing constraint: **one tap, no modal/confirm/sub-menu**.
- **post-session-chris / between-hands-chris** (secondary) — returns to the Review Queue later to study flagged hands.

## JTBD served

- **Primary:** "When I notice something interesting mid-hand, flag it so I can find it later without losing focus right now."
- **Secondary:** "After the session, work through the hands I flagged, one at a time, then clear each once reviewed."

## Gap analysis

| Dimension | Finding |
|---|---|
| Existing surface covers this? | 🔴 No — grep confirms no `reviewTag`/`flaggedHands`/`markedForReview`/`bookmarked` field and no tag affordance. Greenfield. |
| Persona coverage | 🟢 Existing personas (mid-hand / post-session) cover it; no new persona. |
| Interaction novelty | 🟡 Tag-during-entry is a new toggle, but uses established button patterns. |
| Data model | 🟢 Additive field, v25 migration precedent, consumers tolerate undefined. |
| Cognitive-load risk | 🟡 Must remain strictly one-tap; enforced by test (no modal) + AC. |

**Net:** YELLOW. The only RED cell is "no existing surface" (the reason the feature exists). No novel architecture, no cross-product reach.

## Gate 2 disposition

Gate 2 (Blind-Spot Roundtable) is triggerable by the YELLOW interaction-novelty cell. Given (a) the blast radius is three small edits to existing surfaces, (b) every pattern is reused (button idiom, Sessions panel list, additive migration, replay header badge), and (c) the storage shape + cognitive-load rule were pre-ratified by the owner on 2026-05-12, the blind-spot questions are folded directly into the Gate 4 surface doc (`docs/design/surfaces/hand-tag-for-review.md`) rather than run as a standalone roundtable. If implementation surfaces a genuine unknown, escalate.

## Owner decisions (ratified 2026-06-05, SPR-107 plan-mode)

1. **Review Queue surface:** "Tagged ⭐" filter/panel on SessionsView (not a separate view).
2. **Note affordance:** omitted for v1 — strictly one-tap. (Long-press note deferred to v1.1.)
3. **Untag UX:** explicit "Reviewed — clear tag" button on the replay surface (re-tapping the tag also toggles off during live play).
4. **Storage shape (pre-ratified 2026-05-12):** `hand.reviewTag = { tagged: true, taggedAt: number } | null`, additive IDB migration. Resolved at implementation to **v27** (v26 already existed — SLS Stream D).

## Verdict

🟡 **YELLOW → proceed to Gate 4 + Gate 5 in-sprint.** Surface spec authored same session.
