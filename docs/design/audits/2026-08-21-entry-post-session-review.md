# Gate 1 Entry — Post-Session Review (money column, opportunity alerts, table learning)

**Date:** 2026-08-21
**Status:** RED → Gate 2 mandatory (run same day, see `2026-08-21-blindspot-post-session-review.md`)
**Authored:** retroactively. See §6.

---

## 1. Proposed change

A post-session review that criticises the founder's play. Three jobs, in his words:

1. *"sometimes I am looking for a breakdown of a specific hand and want to study it"*
2. *"maybe I am alerted to opportunities (conduct card spots that hero can influence that are missed)"*
3. *"the general learning that need to be absorbed by me (how the table's dynamics contribute, etc)"*

With a constraint he stated in the same breath: *"we have to be a little careful not to rely too much on the aggregate."*

## 2. Scope classification

**Surface addition + cross-surface journey change.**

- New surface: a review artifact that today is an HTML page served by a loopback process, reachable from exactly one machine.
- Cross-surface: the same villain is characterised live by the sidebar and post-hoc by a Conduct Card, with no shared identity.
- Not a surface-bound fix. Not a system-coherence audit, though §Stage D of Gate 2 found a coherence problem inside it.

## 3. Personas identified

- `post-session-chris` (situational) — the canonical persona. Density-tolerant, reflective, 30s–2min per hand.
- `chris-live-player` (core) — in self-coach posture; carries the nine red lines, of which **#5 binds job 2**.
- `cold-read-chris` (situational) + `.claude/rules/cold-read-regime.md` — the binding constraint set.

**Gap question — "does our cast cover this?"** Job 1 yes. **Job 2 no**: no persona is modelled as *receiving* an unprompted claim rather than *seeking* a review. **Job 3 no**: no persona has the table or the session as its object of attention.

## 4. JTBD identified

| Job | Mapped | Unmapped |
|---|---|---|
| 1 — study a hand | SR-24, SR-25, SR-26, SR-28..31 | *which yardstick, on what population* |
| 2 — missed opportunities | SR-23 (partial), CC-80 (generic), SE-02 (blocked) | *a spot hero was never in* |
| 3 — table learning | — | *all five outcomes* |

**Gap question — "does any outcome not map?"** Yes, and the shape of the miss is structural rather than incidental: **the atlas has no unit of analysis above the hand.** The session and the table exist only as filters. Two shipped surface specs already had to write the literal string `(implicit)` where a JTBD ID belongs (`session-review-anchor-rollup.md:63`, `stats-view.md:32`).

The atlas has made this exact move once before, for entry: `HE-23` ("Record a full orbit — **unit of success: the orbit, not the tap**"), authored 2026-07-31 to close a blind-spot finding named *"B2 (no orbit-level job)"*. It has never made it for review.

## 5. Gap analysis output

**RED.**

- Job 1 — **GREEN**, minus one hole (yardstick/population provenance).
- Job 2 — **YELLOW→RED**. Not merely a missing persona: `SE-02` covers it almost exactly and is **gated on a precondition the operating regime forbids** (*"a session that I prepared for"*, rows keyed to *"villains I expect to face"*). Under cold read the founder has usually never seen these villains.
- Job 3 — **RED**. Zero coverage, confirmed by independent fresh-context grep across the whole `jtbd/` tree.

RED mandates Gate 2. It was run the same day.

## 6. Provenance of this file, stated rather than hidden

This entry artifact was authored **after** the feature's first implementation shipped (`c74536df`, `86bdb60e`). `ROUNDTABLES.md` names post-implementation review as anti-pattern #3, and `CLAUDE.md`'s Design Program Guardrail requires Gate 1 *before anything else*.

Recorded, not excused. The mitigation actually available was taken: Gate 2 ran with three independently-dispatched agents before any UI code was written, and **no surface artifact exists yet** — so Gate 4 has not been bypassed, only Gate 1's ordering. The shipped code is a `scripts/` instrument with an HTML debug view, not a product surface.

## 7. Related

- `docs/design/audits/2026-08-21-blindspot-post-session-review.md` — the Gate 2 roundtable
- `.claude/rules/cold-read-regime.md`, `.claude/rules/surfaces-reach-the-table.md`
- `WS-280` (game/seat selection — predicted this roundtable would trigger), `WS-415` (population caveat dropped by renderer)
