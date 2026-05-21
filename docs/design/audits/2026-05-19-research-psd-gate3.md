# Gate 3 Research — 2026-05-19 — Pre-Session Drill

**Date:** 2026-05-19
**Project:** Pre-Session Drill (PSD) — design framework Gate 3
**Author:** Claude (main)
**WS ticket:** WS-195. **Sprint:** SPR-091.
**Preceded by:** Gate 2 Blind-Spot Roundtable 2026-05-19 (`./2026-05-19-blindspot-pre-session-drill.md`), verdict 🟡 YELLOW.

---

## Purpose

Gate 3 Research deliverable. Closes the JTBD canonicalization + persona reconciliation + proto-caveat validation work surfaced by Gate 2 Stage A (R1-R3) + Stage B (G1-G5). This is the *research/synthesis* artifact; the actual atlas + persona file edits land in their canonical locations (`docs/design/jtbd/domains/*.md`, `docs/design/personas/situational/*.md`) co-modified in the same commit.

Output of Gate 3 is **not a new feature** — it is the alignment work that lets Gate 4 (surface spec) author cleanly.

---

## Findings on entry — what changed under Gate 1's feet

Two material discoveries surfaced as soon as Gate 3 work touched the atlas:

### Finding 1 — JTBD-SE-01/02/03 already canonical

The PSD Gate 1 audit (2026-04-23) treated `JTBD-SE-01/02/03` as "cited locally in `presession-preparer` persona file but not in the atlas." Gate 1 listed B-G1 as "author SE-01/02/03 in `session-entry.md`."

**Actually**, `docs/design/jtbd/domains/session-entry.md` already contains SE-01, SE-02, SE-03, and SE-04 as canonical entries (authored 2026-04-23 by exploit-deviation project Gate 3, listed in the file's "Domain origin" line). SE-01 (prepare tonight's watchlist), SE-02 (review drill predictions against session outcomes), SE-03 (scale commitment to a specific deviation via drill-side dial) are *Proposed* state with implementation track scoped to exploit-deviation project Phase 7/9.

**B-G1 status: ✅ COMPLETE — no edit required.** PSD's Gate 3 work confirms SE-01/02/03 cover PSD's session-entry outcomes and adds cross-references where PSD-specific surfaces consume them.

### Finding 2 — DS-56/57/58/59 ID slots are taken

PSD Gate 1 (2026-04-23) proposed four new JTBDs:
- "DS-56 active-recall pattern priming for upcoming session"
- "DS-57 drill on spots I got wrong in recent sessions"
- "DS-58 anchor-trace from drill card to deep artifact"
- "DS-59 verify a drill card's claim by re-running the falsifier"

Between Gate 1 and Gate 3 (a span of 26 days), the atlas was updated:
- **2026-04-23** — Poker Shape Language adaptive-seeding Gate 3 added DS-52..DS-56 (DS-56 = "Calibration check (blind probe after self-reported fluency)" — unrelated to PSD's proposed DS-56)
- **2026-04-24** — Exploit Anchor Library Gate 3 added DS-57..DS-59 (DS-57 = "Capture-the-insight", DS-58 = "Validate-confidence-matches-experience", DS-59 = "Retire-advice-that-stopped-working" — all unrelated to PSD's proposed DS-57/58/59)
- **2026-04-?** — Printable Refresher project added DS-60 (carry-the-reference-offline), DS-61 (export-the-personal-codex)

All four ID slots Gate 1 proposed are **occupied by unrelated JTBDs.** Naive Gate 3 execution would have either authored colliding duplicates or silently overwritten existing entries. The discovery is itself a forensic finding the framework should learn from.

**Implication for framework hygiene:** future gate audits proposing JTBD IDs should treat the proposed IDs as *placeholders* until Gate 3 confirms availability in-atlas. JTBD IDs are stable identifiers, not provisional labels.

---

## B-G1..B-G5 resolution (Gate 2 Stage B follow-ups)

| Item | Audit instruction | Gate 3 disposition |
|---|---|---|
| **B-G1** Canonicalize SE-01/02/03 in `session-entry.md` | "Move from presession-preparer's local citation to the atlas" | ✅ **No-op (already canonical).** Audit's premise was incorrect; SE-01/02/03 were authored canonically by exploit-deviation Gate 3 (2026-04-23). Cross-references confirmed; no edit needed. |
| **B-G2** Absorb "DS-56 (Gate 1)" active-recall mechanism into SE-01 | "Do not author DS-56 as a parallel JTBD" | ✅ **Resolved by ADR-005.** Active-recall *mechanism* is the implementation pattern for SE-01's watchlist (flip-card per ADR-005). No new JTBD authored. SE-01's existing text already describes the watchlist outcome; mechanism citation is now in [`ADR-005`](../../adr/ADR-005-psd-active-recall-flip-card.md). |
| **B-G3** Author "DS-57 (Gate 1) — recency-weighted drill selection" | "Keep DS-* domain — algorithm-level outcome" | ✅ **Authored as DS-62** in `drills-and-study.md` (ID-collision avoidance). Outcome description preserved from Gate 1 proposal; success-criteria + failure-modes refined per Gate 2 Stage C-A3 (mood-aware selection) + Stage D-P1 (hands ↔ node-ID cross-reference). |
| **B-G4** Author "DS-58 (Gate 1) — anchor-trace" | "Defer pending DS-58 placement decision (cross-cutting vs drills-and-study)" | ✅ **Authored as DS-63** in `drills-and-study.md`. Placement decision resolved by [`ADR-006`](../../adr/ADR-006-psd-anchor-trace-in-app-bundle.md): with in-app bundle, DS-63 is drill-internal navigation, not cross-cutting. Re-promote to cross-cutting if/when other surfaces consume the renderer (e.g., Range Lab Gate 4). |
| **B-G5** Defer "DS-59 (Gate 1) — falsifier-verify" pending WS-053 close-out | "Re-evaluate post-WS-053; if Range Lab owns falsifier-rerun, inherit via DS-63" | ⏸ **Deferred** — explicitly. Not authored. Re-evaluation trigger: WS-053 Range Lab Gate 2 close-out + Range Lab's Gate 4 decision on falsifier-verify ownership. If Range Lab implements it, PSD inherits via DS-63 navigation; if not, PSD authors a new JTBD with the next available DS-* ID at that time. |

**Net authored:** DS-62 (recency-weighted drill selection) + DS-63 (anchor-trace from drill card). Both Proposed state; both reference SPR-091 + WS-199 (Gate 4 surface) + audit cross-links.

---

## Stage A — persona work (A-R1..A-R3)

### A-R1 — presession-preparer × post-session-chris reconciliation

**Decision:** the personas are **siblings**, not nested. Resolution authored as a reconciliation block in both persona files.

Rationale (from reading both files end-to-end):
- `post-session-chris` Snapshot: "review what happened — hands he played well, hands he misplayed, villain reads worth remembering, and occasionally a deeper dive into a specific spot." Scope: *general session review*.
- `presession-preparer` review mode Snapshot: "Know which flagged patterns fired — 'you flagged 5 patterns; 3 came up in the session, you caught 2, missed 1.'" Scope: *drill-prediction-specific*.

No overlap of scope; both run post-session. A user may engage both in one window (open drill-review, close it, open HandReplay). Files updated:
- `docs/design/personas/situational/presession-preparer.md` — added "Relationship to post-session-chris" section
- `docs/design/personas/situational/post-session-chris.md` — added "Relationship to presession-preparer" section

Neither persona is amended in scope; both remain canonical as authored.

### A-R2 — PSP-1 / PSP-2 / PSP-3 owner ratification

Founder ratifications via SPR-091 plan-mode (2026-05-19):

- **PSP-1** (5/15/30 min time-budget variants) — **CONFIRMED.** No alternative bucket required for v1. Persona file updated.
- **PSP-2** (mood-detection auto-inference from session P/L) — **PROTO with v1 fallback.** Ship user-declared mood toggle (explicit stuck / heater / neutral). Auto-detection deferred to WS-201 research; hybrid (auto-detect default + user override) is v2 if validated. Persona file updated.
- **PSP-3** (48h review window) — **CONFIRMED.** No alternative window required for v1. Persona file updated.

### A-R3 — Apprentice-Student depth tolerance

**Resolution:** Apprentice remains an `Applies to` persona for `presession-preparer`. PSD's card-back depth (per Gate 2 Stage C-A2 + ADR-005) is **skim-tolerant by design**: falsifier headline first, citation paragraph second, anchor links last. Apprentice can absorb headline-only on a 1-min/card budget; citation depth is opt-in via scroll; anchor-trace is opt-in via tap (DS-63). The depth is *available*, not *required*.

Re-evaluation trigger: Apprentice usage data showing surface abandonment would be evidence the depth-tolerance flag was correct after all.

Persona file updated with the Apprentice depth-tolerance resolution.

---

## A-AP1 — autonomy red-line flag (Stage A)

Gate 2 Stage A flagged: when PSD references spaced repetition (atlas `DS-46`), implementation must be **scheduling-only** — no streak / mastery / leaderboard / tier-badge surfaces. Per `feedback_scf_learning_state_not_tier_rank.md` and `feedback_owner_volunteered_grading.md`.

**Bound in DS-62 entry** authored today: "DS-62 must NOT promote DS-46 to a streak/mastery surface — selection-only, no engagement-pressure layer." Gate 4 surface spec (WS-199) inherits this binding via the DS-62 citation.

---

## What lands where

| File | Action | Reason |
|---|---|---|
| `docs/design/jtbd/domains/session-entry.md` | No edit | SE-01/02/03 already canonical (Finding 1) |
| `docs/design/jtbd/domains/drills-and-study.md` | EDIT — add DS-62 + DS-63 + change-log entry | B-G3 + B-G4 (ID-collision resolution) |
| `docs/design/personas/situational/presession-preparer.md` | EDIT — PSP-1/2/3 ratifications + post-session-chris reconciliation + Apprentice resolution + change-log | A-R1 + A-R2 + A-R3 |
| `docs/design/personas/situational/post-session-chris.md` | EDIT — sibling-relationship reconciliation note + change-log | A-R1 (mirror) |
| `docs/adr/ADR-005-psd-active-recall-flip-card.md` | NEW | WS-196 / B-G2 (mechanism citation) |
| `docs/adr/ADR-006-psd-anchor-trace-in-app-bundle.md` | NEW | WS-197 / B-G4 (DS-63 placement implication) |
| This file (`docs/design/audits/2026-05-19-research-psd-gate3.md`) | NEW | Gate 3 research summary — single record of what was investigated and decided |

Zero `src/` diff.

---

## What this unblocks

- **WS-199 (PSD Gate 4 surface spec)** — three prior blockers cleared:
  - WS-195 (this research) — JTBD canonicalization + persona reconciliation done; references in WS-199 surface spec can cite SE-01/02/03 + DS-62/63 cleanly.
  - WS-196 (active-recall pattern ADR) — surface spec layout decisions inherit flip-card per ADR-005.
  - WS-197 (anchor-trace destination ADR) — surface spec navigation section inherits in-app bundle per ADR-006.
- **WS-200 (mobile-portrait variant)** — was already structurally independent of this work; still queued as P3 follow-up after WS-199.
- **WS-198 (Phase-0 engineering: hands ↔ node-ID)** — was always P3 and does not block Gate 4 design; DS-62 entry now references WS-198 as implementation infra.
- **WS-201 (mood-detection research)** — explicitly named in PSP-2 fallback; this Gate 3 confirms the v1 ship path (user-declared toggle) and the v2 disposition trigger (WS-201 research outcome).

---

## What remains (post-Gate-3, pre-Gate-4)

Per Gate 2 audit's 5-condition list, four are now cleared by this sprint:
- ✅ JTBD canonicalization (WS-195, this doc)
- ✅ Active-recall pattern decision (WS-196 → ADR-005)
- ✅ Anchor-trace destination decision (WS-197 → ADR-006)
- ⏳ `hands` ↔ node-ID schema decision (WS-198 — Phase 0 engineering ticket, ADR or absorbed in ticket; does NOT block Gate 4 design)
- ✅ Mobile-portrait surface variant ticket exists (WS-200 authored at SPR-090)

WS-199 (Gate 4 surface spec) is now structurally unblocked.

---

## Links

- Gate 1 audit: [`./2026-04-23-entry-pre-session-drill.md`](./2026-04-23-entry-pre-session-drill.md)
- Gate 2 audit: [`./2026-05-19-blindspot-pre-session-drill.md`](./2026-05-19-blindspot-pre-session-drill.md)
- ADR-005 (active-recall pattern): [`../../adr/ADR-005-psd-active-recall-flip-card.md`](../../adr/ADR-005-psd-active-recall-flip-card.md)
- ADR-006 (anchor-trace destination): [`../../adr/ADR-006-psd-anchor-trace-in-app-bundle.md`](../../adr/ADR-006-psd-anchor-trace-in-app-bundle.md)
- JTBD atlas (session-entry): [`../jtbd/domains/session-entry.md`](../jtbd/domains/session-entry.md)
- JTBD atlas (drills-and-study): [`../jtbd/domains/drills-and-study.md`](../jtbd/domains/drills-and-study.md)
- Persona (presession-preparer): [`../personas/situational/presession-preparer.md`](../personas/situational/presession-preparer.md)
- Persona (post-session-chris): [`../personas/situational/post-session-chris.md`](../personas/situational/post-session-chris.md)
- Sprint: SPR-091. Ticket: WS-195. Sibling tickets: WS-196, WS-197.

---

## Change log

- 2026-05-19 — Created as Gate 3 research output of SPR-091 / WS-195. Resolves Gate 2 Stage A R1-R3 + Stage B G1-G5. Surfaces the JTBD ID-collision forensic finding for framework hygiene.
