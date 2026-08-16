# Gate 1 Entry — 2026-08-07 — Session Logging + All-in EV Adjusted Win Rate

**Feature working name:** Log/edit a session · All-in EV adjusted win rate
**Audit ID:** `entry-session-logging-adjusted-winrate-2026-08-07`
**Proposed by:** Founder, 2026-08-07 ("id prefer not to actually use the sheet for bankroll, I want to use the app. we need a design upgrade for me to use it, not a csv importer (yet)… ill have to capture the hands that I won or lost due to variance… will help get a true adjusted win rate")
**Backlog ticket:** [pending — to be filed]
**Gate:** 1 (Entry) — mandatory
**Next gate:** **Gate 4 (Design)** — Gate 2 not triggered (see §Gate 2 trigger check)
**Status:** **GREEN**

---

## Feature summary (as proposed)

The bankroll history landed in the app on 2026-08-07 (previous change). The
founder now wants to **retire the spreadsheet** and log in the app. Three coded
facts blocked that:

| # | Blocker | Evidence |
|---|---|---|
| 1 | No way to log a session not tracked live | `createSession` stamps `startTime: Date.now()`, `isActive: true`; `endTime` only on cash-out |
| 2 | Past sessions cannot be edited | `SessionDetailModal` / `SessionCard` have no edit path; a generic `updateSession` writer existed, unwired |
| 3 | Live capture has no time correction | Open the app late → session short; hours drive every Variance-band figure |

`sessions-view.md` already listed "Session backfill flow (SM-22)" under
*Potentially missing*, so blocker 1 was a known gap, not a discovery.

Separately, the founder asked for a luck-adjusted win rate, proposing to tag
hands he won or lost to variance.

**Founder decisions (binding):**

| ID | Statement |
|---|---|
| **F1** | **Both** logging paths — a backfill form AND hardened live capture. |
| **F2** | **All-in EV only.** No manual variance tags feeding the win rate. |

### The redirect on F2, recorded because it shaped the design

Manual tagging was raised as a concern before building: bad beats get logged,
suckouts do not, so a tag-driven adjustment drifts the rate upward while
presenting as more rigorous. The founder accepted the mechanical alternative.
This is the single most important design constraint in this change — the module
never asks anyone's opinion, it reads the `allIn` flag the hand already carries
and computes equity from the cards.

---

## Output 1 — Scope classification

**Primary classification:** **New form + entry points on an existing surface**,
plus a pure analytics module.

- `SessionLogForm` is a new component but reuses `SessionForm`'s modal shell,
  dirty-state backdrop guard (AUDIT-2026-04-21-SV F6), settings-driven venue and
  stake pickers, and 44px controls. No new interaction primitive.
- Entry points land on surfaces that already host them: a header button on the
  Sessions view, an Edit action inside the existing `SessionDetailModal`.
- The all-in adjustment adds one row to the existing `VarianceBand`.
- **No hand-entry change.** `allIn` is already modelled on the action entry
  (`sequenceUtils.js:30`, documented as load-bearing for side-pot derivation) and
  already captured by `CommandStrip.jsx:587`. The riskiest surface in the app is
  untouched — which is why F2 was affordable at all.
- No IndexedDB version bump; added fields are optional.

---

## Output 2 — Personas identified

### In scope
- **post-session-chris** — primary. Logs the night's result, corrects a
  mis-captured cash-out, reads what the numbers mean.
- **between-hands-chris** — secondary, for the live-capture start-time fix.

### Out of scope (explicit)
- **mid-hand-chris** — deliberately untouched. The all-in flag is read, never
  newly demanded, so nothing changes at the table.

### Persona sufficiency check
No new persona. Both are the Sessions view's existing owners. The feature closes
a gap in how they are served rather than reaching anyone the framework has not
modelled.

---

## Output 3 — JTBD identified

### Existing JTBDs the feature touches
- **JTBD-SM-*** (session management) — creation and results review.
- SM-22 (session backfill) — previously listed as unserved; now served.

### Proposed new JTBD (candidate)
> **When** I finish a session — whether or not I had the app open —
> **I want to** record it in under a minute in the fields I already think in,
> and fix it later if I got something wrong,
> **so I can** keep one trustworthy bankroll record instead of a spreadsheet the
> app can't see.

### Not served (explicit non-goals)
- CSV import — founder deferred ("not a csv importer (yet)").
- Manual variance tags feeding the rate (F2).
- Multiway all-in equity across side pots — declared ineligible, not guessed.
- Retroactive adjustment of the 78 imported sessions: they carry `handCount: 0`,
  so there is nothing to adjust. **The adjusted rate starts from zero coverage
  and accrues only from future tracked sessions.** The UI says so explicitly
  rather than showing a number equal to the raw rate.

---

## Output 4 — Gap analysis

| Dimension | Finding |
|---|---|
| Persona coverage | **GREEN** — existing primary persona |
| JTBD coverage | **GREEN** — closes a gap the surface doc already named |
| Surface novelty | **GREEN** — no new surface |
| Interaction novelty | **GREEN** — modal form, inline edit, native date/time inputs |
| Data risk | **GREEN** — `createCompletedSession` can never produce an active session; edit refuses to touch `isActive` |
| Domain risk | **AMBER → mitigated** — see below |

**Domain risk and its mitigations.** An adjusted win rate is a machine for
producing a flattering number.

1. **Mechanical, never judgmental.** Equity from cards, at the street the chips
   went in; realized share read from the finished board via the same function, so
   it does not even depend on whether the founder tapped the winner.
2. **Symmetric by construction.** Suckouts are penalised exactly as hard as bad
   beats. Pinned by a test that runs the same matchup with the runout swapped.
3. **Coverage always stated**, and zero coverage says so in words.
4. **The ceiling is stated in the UI**: only all-in pots are corrected; a cooler
   paid off with chips behind is untouched. It narrows the interval; it does not
   collapse it.
5. **Stamped modelled** per POKER_THEORY §14.4, beside the raw rate, never
   instead of it.
6. **Preflop shoves are marked `preflop-class`** — the available exact solver
   works on hand classes, so suit blockers are invisible there. Sub-percentage
   error, but named rather than passed off as exact.

### Overall verdict: **GREEN**

---

## Gate 2 trigger check

Required on YELLOW/RED, a new surface, an underserved persona, or crossing
product lines. **None applies:** verdict GREEN; the form is a new component on an
existing surface using existing patterns; personas are the surface's own; single
product line. **Gate 2 not triggered.**

---

## Observations without fixes (carried forward)

1. **`updateSessionField` does not persist by itself.** It dispatches; the write
   happens via a debounced auto-save with an explicit field list. Adding an
   editable start time required adding `startTime` to that list — without it the
   correction would have shown in the UI and vanished on reload. Any future
   editable field needs the same treatment; the list is a silent trap.

2. **Two `fixed inset-0 z-50` modals cannot co-exist.** Opening the edit form
   from the detail modal left the detail backdrop over it, swallowing the Save
   tap. Fixed by closing the detail modal on edit. Worth a shared modal-stack
   primitive if a third case appears.

3. **`parseAndEncode` returns `-1`, not `NaN`, for an unparseable card.** A
   `Number.isInteger` guard passes it. Caught in test; noted because the same
   trap exists anywhere card parsing is validated by type rather than range.

4. **Suits are Unicode glyphs (`♠♥♦♣`), not letters.** Any new fixture using
   `'Ah'` silently parses to nothing.

5. **The June-forward slice is the founder's live decision basis.** 26 cash
   sessions, +$75.56/hr, 70% CI +$32…+$119, 95% CI −$6.52…+$157.65. The cut point
   was chosen with an independent rationale (a strategy change predating June),
   but it was still chosen while looking at outcomes. Flagged to the founder as
   the optimistic end of a real improvement, not as an established rate.

---

## Prioritized fix list

None blocking. Implementation proceeded to Gate 4.

---

## Review sign-off

| Role | Verdict | Note |
|---|---|---|
| Gate 1 entry audit | **GREEN** | No persona/JTBD gap; domain risk mitigated by mechanical symmetry + §14.4 stamping |
| Gate 2 | **Not triggered** | No new surface, no new persona, GREEN verdict |
| Gate 4 | Required | `docs/design/surfaces/sessions-view.md` updated same session |

---

## Change log

| Date | Change |
|---|---|
| 2026-08-07 | Gate 1 entry audit authored; GREEN; Gate 2 not triggered |
