# Gate 1 Entry — 2026-08-07 — Bankroll Session Capture + Variance Stats

**Feature working name:** Bankroll history import + Bankroll & Variance band
**Audit ID:** `entry-bankroll-variance-2026-08-07`
**Proposed by:** Founder, 2026-08-06 ("look in my drive for a sheet called strategy, tab 'bank roll'… I want to upgrade our session feature to be able to capture and display my bankroll session data along with the variance stats")
**Backlog ticket:** [pending — to be filed]
**Gate:** 1 (Entry) — mandatory
**Next gate:** **Gate 4 (Design)** — Gate 2 not triggered (see §Gate 2 trigger check)
**Status:** **GREEN**

---

## Feature summary (as proposed)

The founder has tracked every live and online session since Nov 2024 in a Google Sheet
("Strategy" → `bank roll`): 78 rows plus a **Bankroll Management** block. That block poses the
questions that matter — true win rate with a confidence interval, risk of ruin, required
bankroll, downswing depth, Kelly sizing — and **every one of those cells is empty**. The sheet
set up the questions and could not answer them.

The sheet is additionally wrong in four specific ways, all verified against the source:

| Defect | Consequence |
|---|---|
| `Profit / Loss` formula never filled past row 69 | The **last 9 sessions have no P&L at all** (21 Jul → 5 Aug 26) |
| Total row sums that column | Stated lifetime **−$6,175**; true figure **−$1,693.66** |
| Google parsed HHMM clock cells as durations ("4800:00:00") | **Every `$/hr` in the sheet is wrong** |
| Free-text dates, three with a year typo | Rows out of chronological order |

The app already holds sessions, an Insights band, a bankroll chart and by-stake/by-venue
breakdowns — but none of this history and none of the variance math.

**Founder decisions taken at intake (binding):**

| ID | Statement |
|---|---|
| **F1** | Sheet rows **merge as real sessions**, tagged for provenance — one bankroll, one truth. |
| **F2** | **One-time seed**, not a repeatable CSV importer. |
| **F3** | Ship **all four** variance outputs: win-rate CI, risk of ruin + required bankroll, downswing expectation, Kelly. |

---

## Output 1 — Scope classification

**Primary classification:** **Additive panel on an existing surface**, plus a one-shot data action.

- `VarianceBand` mounts below the existing `InsightsBand` on the Sessions view. Same surface,
  same fluid portrait layout, same collapse/localStorage pattern.
- The import trigger lives in Settings → Data & About, beside the existing export/import
  controls.
- No new route, no new screen, no new navigation entry, no new interaction primitive.
- No IndexedDB version bump — the added fields are optional and `validateSessionRecord`
  already tolerates them, preserving the additive-only invariant.

**Not a surface addition.** Both affordances (a collapsible band; a labelled action button with
a result line) already exist verbatim on the surfaces they land on.

---

## Output 2 — Personas identified

### In scope

- **post-session-chris** — primary. Reviews results after a session; the band answers "am I
  actually winning, and is my roll big enough". This is the persona the Sessions view exists for.
- **between-sessions-chris** — secondary. Decides what stake to sit and whether to move up;
  Kelly and required-bankroll speak to exactly that call.

### Out of scope (explicit)

- **mid-hand-chris** — the band is deliberately not surfaced at the table. Bankroll reasoning
  during a hand is a different feature (WS-296/297/298, blocked) and a different risk profile.
- **ringmaster-in-hand** — unaffected.

### Persona sufficiency check

No new persona is required. post-session-chris is well-characterised in
`docs/design/personas/` and already owns the Sessions view. The feature deepens what that
persona is served, rather than reaching a persona the framework has not modelled — which is the
exact question this gate exists to force, and the answer here is clean.

---

## Output 3 — JTBD identified

### Existing JTBDs the feature touches

- **JTBD-SM-*** (session management / results review) — the Insights band already serves "what
  happened". This extends the same job to "what does it mean".
- Bankroll tracking as currently served by the net-P&L tile and bankroll chart.

### Proposed new JTBD (candidate)

> **When** I have played enough sessions to have an opinion about whether I'm winning,
> **I want to** know whether the results are strong enough to trust and how much money the
> swings demand I keep behind me,
> **so I can** decide whether to keep playing these stakes, move up, or accept I'm not beating
> the game yet.

The load-bearing half is the second clause. The founder's sheet reached for exactly this and
left it blank, which is unusually strong evidence the job is real and currently unserved.

### Not served (explicit non-goals)

- bb/100 normalisation across stakes — the sheet's `# hands played` column is empty for all 78
  rows, so hand counts do not exist for the history. Session-clustered $/hr is the honest unit.
- Tournament variance — excluded by design (heavy right tail; a different distribution).
  Reported as an exclusion count, never pooled.
- Any prescriptive "move up / move down" instruction. The band reports; the founder decides.

---

## Output 4 — Gap analysis

| Dimension | Finding |
|---|---|
| Persona coverage | **GREEN** — existing primary persona, no gap |
| JTBD coverage | **GREEN** — extends an existing job on its own surface |
| Surface novelty | **GREEN** — no new surface, no new primitive |
| Interaction novelty | **GREEN** — collapse band, pill selector, numeric input; all established |
| Data risk | **GREEN** — additive writer only; the destructive `importAllData` path is explicitly not reused |
| Domain risk | **AMBER → mitigated** — see below |

**The one real risk is domain, not UX.** A variance panel is a machine for producing
confident-looking numbers from a thin sample. Three mitigations are binding on the
implementation:

1. **Cluster unit is the session**, per POKER_THEORY §14.3. Never hands — hands within a session
   share opponents, dynamic and tilt state, and clustering on them would understate variance.
   Every returned object carries `clusterUnit` and `n`.
2. **Projected figures are stamped `modelled`**, per §14.4, and rendered with a visible tag.
3. **The interval refuses to render below 20 sessions**, and when it straddles zero the UI says
   so in plain words rather than letting a positive observed rate imply a proven one.

On the founder's actual data this last mitigation is not hypothetical: 52 cash sessions,
+$16.27/hr observed, 95% CI **−$27.67 … +$60.43**. The honest headline is that he cannot yet
prove he is a winning player, and the band must say that rather than flatter the number.

### Overall verdict: **GREEN**

---

## Gate 2 trigger check

Gate 2 (Blind-Spot Roundtable) is required when the verdict is YELLOW/RED, a new surface is
introduced, an underserved persona is targeted, or the work crosses product lines. **None
applies:**

- Verdict GREEN.
- No new surface — additive panel on the Sessions view.
- Primary persona is the surface's existing owner.
- Single product line.

**Gate 2 not triggered.** Recorded explicitly per LIFECYCLE.md.

---

## Observations without fixes (carried forward)

1. **Live/Online filter classification.** `matchesSessionsFilter` treats `source !== 'ignition'`
   as Live, so the 5 imported online tournament rows sit under the Live pill. Changing that
   filter's semantics would touch a tested contract for no gain here — the rows are tournaments
   and are excluded from cash variance regardless. Noted, not fixed.

2. **One undated row.** "Greg's range" (−$900) has a blank date cell but real money in it. It
   inherits the preceding row's date and is stamped `dateInferred`, because silently dropping it
   would understate lifetime P&L by $900. A flagged date beats a missing loss.

3. **The band answers a question the engine also wants.** WS-296/297/298 (blocked) need a real
   bankroll figure for log-utility over outcomes. This work produces one. Sequencing note only —
   no coupling introduced here.

4. **Sheet-vs-app divergence will reappear.** F2 chose a one-time seed, so sessions the founder
   logs in the sheet after 5 Aug 2026 will not reach the app until someone re-transcribes. The
   importer is idempotent, so growing the seed file and re-running is the cheap path if that
   becomes a recurring cost.

---

## Prioritized fix list

None blocking. Implementation proceeds to Gate 4.

---

## Review sign-off

| Role | Verdict | Note |
|---|---|---|
| Gate 1 entry audit | **GREEN** | No persona or JTBD gap; domain risk mitigated by §14.3/§14.4 compliance |
| Gate 2 | **Not triggered** | No new surface, no new persona, GREEN verdict |
| Gate 4 | Required | `docs/design/surfaces/sessions-view.md` updated in the same session |

---

## Change log

| Date | Change |
|---|---|
| 2026-08-07 | Gate 1 entry audit authored; GREEN; Gate 2 not triggered |
