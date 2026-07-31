# Gate 1 — Entry: Narrowing-Literacy Curriculum

**Date:** 2026-07-31
**Requested by:** founder ("explore the nooks and crannies of this from a curriculum
perspective and get it into one of the study GUIs as a manipulatable set of tools and
lecture and charts")
**Origin:** WS-303 / SPR-163 measurement findings (POKER_THEORY §11.7, §11.8)
**Status:** Gate 1 complete — **YELLOW** → Gate 2 required before design

---

## 1. Scope classification

**Surface addition — new panel in an existing built view.** Not a new routed view.

`study-home` is the specced cross-project study host, but its code paths are marked
*"(none yet — design-only at Gate 4)"* — four projects are specced to embed into a view
nobody has built. Building it is not a prerequisite here and would balloon scope.

Recommended host: **`PostflopDrillsView`** (`src/components/views/PostflopDrillsView/`),
which already ships a 6-tab suite including `LessonsMode` (sidebar list + sections +
click-to-reveal) and `Range Explorer`. Per LIFECYCLE's applying-gates table this is
"New panel in existing view" → **Gates 1, 2, 4, 5**.

**Coupling worth naming:** `postflopDrillContent/__tests__/engineAuthoredDrift.test.js` is
currently RED because the WS-303 narrowing change moved villain's check range on authored
line `sb-vs-btn-3bp-oop-wet-t98` (`isWeaklyCapped: false → true`). The authored drill content
already needs review for exactly the concept this curriculum teaches. **The content review
and this feature are the same body of work** — a second argument for landing here rather
than in a new host.

---

## 2. Personas identified

*Explicit check: does our current cast cover this, or do we need a new persona?* — **It
covers it. No new persona required.**

| Persona | Role | Fit |
|---|---|---|
| [first-principles-learner](../personas/situational/first-principles-learner.md) | **Primary** | Near-exact. Wants arithmetic visible, range decomposition first, and explicitly names *"over-rely on authored prose for the teaching insight"* as a failure mode — i.e. the persona itself argues for manipulable tools over lecture. |
| [study-block](../personas/situational/study-block.md) | Primary | Time-and-attention shape: 20–60 min, focused, phone or desktop. |
| [scholar-drills-only](../personas/core/scholar-drills-only.md) | Primary | Drill-heavy repeated exposure. |
| [apprentice-student](../personas/core/apprentice-student.md) | Secondary | Coach-assigned curriculum entry. |
| [chris-live-player](../personas/core/chris-live-player.md) | Secondary | Founder is the requesting user; between-sessions study. |
| [coach](../personas/core/coach.md) | Indirect | Would teach *through* this surface. Authoring is an explicit study-home non-goal; consumption only here. |

---

## 3. JTBD identified

**Served (partial):**
- `DS-48` understand villain's range composition as decision driver — *Active*. Covers the
  content but is neutral on how much to narrow.
- `DS-51` understand villain's range shape on any flop — *Active*.
- `DS-66` per-street range evolution — *Proposed* (Range Lab, AP-RL-01 binding).
- `DS-49` weighted-total EV decomposition — *Active*. Arithmetic traceability, adjacent.

**Nearest but NOT the same:**
- `DS-58` validate-confidence-matches-experience — audits a *shipped anchor's* predicted rate
  against observations over many firings. This work is about the *informational content of an
  action*, not an anchor's claim.
- `DS-56` calibration check — probes the *learner's* calibration, not the read's.

**Gap — no existing JTBD covers the outcome:**

> **Proposed `DS-69` — Know how much a villain's action actually tells me.**
> *When villain takes an action, I want to know how much information it genuinely carries
> about their holding — so I narrow their range by the amount the evidence supports, instead
> of by however confident the read feels.*

This is **strategy content, not model transparency.** "A check-back caps to ~10% strong made
hands; an out-of-position check only to ~34%" (§11.8, n=428/565, both sites) is a fact about
poker that happens to have been produced by our measurement. It is teachable independent of
this app's internals.

---

## 4. Gap analysis output

### **YELLOW** — personas complete, one JTBD gap.

- Personas: **GREEN.** Full cast exists; `first-principles-learner` is a precise match.
- JTBD: **YELLOW.** One proposed addition (`DS-69`). Not RED — this extends the existing
  Drills-and-Study domain rather than opening an unmodeled outcome space.
- Interaction pattern: introduces **live parameter manipulation driving a recomputed chart**,
  which is new *as a teaching device* though not new as a mechanism (see §5).

Per LIFECYCLE §Gate 1, YELLOW output **triggers Gate 2**.

---

## 5. Technical precedent (informational — reduces Gate 2 risk)

Both hard parts already exist, so Gate 2 need not litigate feasibility:

**Charts — no library; hand-rolled SVG is the established pattern (6 components).** Closest
prior art is `OnlineView/panels/FoldCurvePanel.jsx:29`, which already renders a *population
curve (dashed) vs personalized curve (solid)* with a current-bet marker over a logistic fold
response. The WS-303 material (narrowing strength per action; discrimination by equity
quintile) is the same visual family. Also `EquityHistogram.jsx:30`,
`EquityDistributionCurveSection.jsx:51`, `SizingCurveTagSection.jsx:47`.

**Live parameter controls — two shipped precedents.** `SelfCoachView/SignalWeightSliders.jsx:41`
(discrete sliders → reducer dispatch) and `PostflopDrillsView/RangePaintGrid.jsx:52` (13×13
matrix, long-press → inline weight slider).

**Lecture scaffold — shipped.** `PostflopDrillsView/LessonsMode.jsx:19`, sidebar list + sections
+ click-to-reveal. Lesson bodies load from
`docs/projects/self-coach-foundation/lessons/{conceptId}.md` via
`skillAssessment/lessonRegistry.js`.

---

## 6. Candidate teaching content (from measured findings — Gate 2 to scope)

1. **What each action is worth.** Narrowing value by action: raise +0.54/+0.60, call
   +0.18/+0.17, bet +0.15/+0.16, **check −0.19/−0.15**. Some actions inform; one misleads.
2. **Check-back vs check.** 10.3% vs 34.3% `P(check | strong made hand)` — same word, two
   different actions.
3. **Where reads go wrong.** Quintile chart: the model is right about weak hands and wrong at
   q4 — the strong-but-not-nutted band.
4. **Fast-play dominance.** `P(strong | showdown) = 33.8%` exceeds `P(check | strong) = 24.0%`
   — most strong hands got bet.
5. **Why "I know a guy who slowplays" is hard to act on.** The archetype does not separate
   from noise (χ²/df = 1.005 against a control at 1.859); median per-player evidence is 2
   spots. A lesson in evidence sufficiency, not just ranges.

---

## 7. Open questions for Gate 2

- **Q1** Does the manipulable-parameter device teach poker, or teach *our model*? The
  persona's stated failure mode is authored prose; the risk here is the opposite — a
  parameter playground that teaches nothing transferable to the table.
- **Q2** Host confirmation: new tab in `PostflopDrillsView`, or a panel inside `LessonsMode`?
- **Q3** Does this belong to `study-home`'s Reference or Deliberate intent, given study-home
  is unbuilt? Does the panel write skill-state at all (mastery mutations), or is it strictly
  Reference-mode read-only?
- **Q4** Is `DS-69` one job or two — "how much does an action tell me" (strategy) versus "how
  much should I trust this read" (calibration literacy)?
- **Q5** Sequencing against the RED `engineAuthoredDrift` test — does authored-content review
  gate this, or run alongside?

---

## 8. Gate 1 verdict

**YELLOW.** Documented. Proceed to Gate 2 (Blind-Spot Roundtable) per LIFECYCLE §Gate 2
trigger (Gate 1 YELLOW + new interaction pattern). Do **not** author surface artifacts or
write view code until Gate 2 returns GREEN.
