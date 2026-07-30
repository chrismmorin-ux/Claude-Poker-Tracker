# Theory Completeness Protocol — verifying the doc against the game

Established: 2026-07-26 · Ticket: WS-272 · Program: `prog-domain-correctness`
Protocol id: `theory_completeness` · Cadence: 90 days · Output: founder-review draft

## Why this exists

`prog-domain-correctness` verifies **engine code against POKER_THEORY.md** on a
14-day sweep. That loop is closed and it works. Nothing verified POKER_THEORY.md
**against poker**.

The consequence, in the founder's words: *"it's been a pull-you-along build
process."* Every automated check the system can run finds only contradictions
with what the founder has already articulated. The doc is a strong spec — it is
also **the boundary of what the system can discover**. A very good map with no
process for asking "what is off the edge of this map" produces exactly the
observed failure mode: increasingly sharp reasoning inside the boundary, and
zero volunteering of the boundary itself.

**The proof case.** POKER_THEORY §3.4 presented an EXHAUSTIVE taxonomy of betting
motivations — *"Every bet, by any player in any spot, is motivated by one or more
of"* — and omitted **protection / equity denial** entirely. The code faithfully
implemented the incomplete doc, so `actionClassifier` and `weaknessDetector`
actively MISFILED correctly-played protection bets as either thin value
("villain over-values medium hands") or as bluffs ("villain over-bluffs"). Both
misreads point hero the wrong way; both accumulated into the villain model as
evidence for a leak that does not exist.

**No code-vs-doc sweep could ever have found that.** It was found when the
founder asked the open question by hand on 2026-07-26 — which also produced six
other real gaps in one session (WS-273…WS-280).

## Boundary against the existing `blind_spot` protocol

`blind_spot` already existed and partially overlaps. The distinction is real and
load-bearing:

| | `blind_spot` | `theory_completeness` |
|---|---|---|
| Target | the **codebase** | the **doc itself** |
| Asks | "what concepts does the code not implement?" | "what is absent from POKER_THEORY.md?" |
| Output | implementation gaps | candidate doc **additions** |
| Exhaustiveness claims | not covered | core mechanism |
| Empirical arbitration | not covered | primary ranking signal |

Evidence they are not redundant: `blind_spot` ran 2026-06-20 and did not surface
the §3.4 gap.

## The four mechanisms, cheapest first

### 1. Completeness interrogation
Walk POKER_THEORY.md section by section and ask what a strong live 9-handed cash
coach would say is **missing entirely** — not explained badly, *absent*. The
coaching-content taxonomy serves as a coverage checklist here.

### 2. Exhaustiveness audit
Every section asserting completeness is a standing liability. Inventory them and
require each to **name what would falsify it**. A completeness claim with no
falsifier is itself the finding. Inventory below.

### 3. Internal-tension sweep (added 2026-07-26, founder observation)
A doc can be **internally inconsistent** without being incomplete. Two sections
that already contradict each other are a gap the first two mechanisms miss
entirely: nothing is absent, and no completeness claim is unfalsified — the doc
simply says two things.

These surface most reliably by walking the **open work queue**, because a ticket
that changes theory usually does it by forcing one side of an existing tension to
win. §1.4 states equity realization as a lookup table while §7.1/§7.5 say derive
from game state; WS-279 resolves that, and until it ships the doc argues with
itself. That pattern repeats.

**Method:** for each open ticket in `prog-domain-correctness`, ask *"which
POKER_THEORY section does shipping this make WRONG?"* — not "which does it
implement." The answer set is the tension list. Run it against the queue, not
from memory.

*Why this was missing from v1:* the protocol was designed around the §3.4 proof
case, which was a pure absence. The founder observed on 2026-07-26 that the first
run "omits a lot of the improvements we have queued up that might affect the
theory." Correct — v1 had no mechanism that would look there.

### 4. Empirical arbitration
Where a doctrine claim is measurable against the HandHQ corpus or the founder's
own hands, the WS-273 backtest settles it with a **number instead of an
argument**. This is the strongest form of the check and the reason WS-273 was
sequenced alongside WS-272 rather than after it. Claims that can be arbitrated
this way rank first.

## Admissible sources (founder decision, 2026-07-26)

**Admitted:**
- **HandHQ corpus + WS-273 backtest** — empirical arbitration. Strongest form;
  already built; no new trust decisions.
- **Coaching content taxonomy** — used purely as a COVERAGE checklist ("what
  topics exist that our doc has no section for"). Weak as authority, strong as a
  gap detector.

**Deliberately excluded:**
- **Solver / GTO literature.** It describes equilibrium play. This engine is
  deliberately exploitative and live-population-facing, so solver completeness is
  the wrong yardstick for what belongs in this doc. (POKER_THEORY §9 already
  records *deliberate* divergences from solver play as a feature.)
- **Founder's own tagged hands.** Highest relevance to the actual game, but the
  volume is too low to arbitrate anything today. Revisit once the predictionAudit
  readback accumulates live hands.

## Entry path (founder decision, 2026-07-26)

Candidate gaps enter as a **founder-review draft** at
`docs/domain/theory-gaps.draft.md` — the same pattern already ratified for
`docs/domain-spec.draft.md`. Nothing enters POKER_THEORY.md or the work queue
without founder sign-off.

Rationale: an outward-facing pass is a generative act and can hallucinate a
"gap." Auto-promoting to findings would put unreviewed inventions in the backlog
at priority floor. The cost is one founder review pass per run — acceptable at a
90-day cadence.

> This deviates from WS-272's written accept criterion ("filed as findings under
> prog-domain-correctness"). The founder decision on 2026-07-26 supersedes it.

---

# Exhaustiveness Claim Inventory

Every completeness assertion currently in POKER_THEORY.md, with the observation
that would falsify it. **A claim with no falsifier is a defect** — flagged below.

| § | Claim | Falsifier | Status |
|---|---|---|---|
| 3.4 | "Every bet is motivated by one or more of the following" (four motives + inducing as inverse) | A bet whose profit source is none of: call from worse, fold from better, equity denial, information, inducing | ⚠️ **Falsified once already** (protection was missing until WS-278). Now 4+1. Treat as provisional, not settled. |
| 1.1 | "Every analysis in this app operates on ranges, never individual hands" | An analysis path keyed on a specific holding rather than a range | ✅ Architectural, greppable |
| 1.2 | "Every poker decision has an EV" | — (definitional, not empirical) | ✅ Definitional |
| 2.5 | "a derived action tag must be descriptive enough to distinguish decision contexts with different range implications" | Two spots sharing a tag whose measured fold/continue economics diverge materially | ✅ **Corpus-arbitrable** via WS-273 BY LINECLASS slice |
| 2.5.3 | "Containment: per cell, every child ≤ its parent and Σ children ≤ parent" | A subclass grid cell exceeding its parent | ✅ Asserted by test (`crossRangeConstraints` Pass B) |
| 4.2 | "A bluff catcher beats all bluffs and loses to all value hands" | A hand that beats part of the value range and loses to part of the bluff range — i.e. most real hands | ⚠️ **Idealization stated as a definition.** No falsifier because it defines a category rather than describing a population. Flagged. |
| 5.2 | "a deviation is only a weakness if it loses EV" | — (definitional guard, deliberately) | ✅ Definitional guard |
| 5.3 | "Every exploit must trace back to a specific weakness with a quantified threshold" | An exploit shipped without a threshold | ✅ Process rule, auditable |
| 6.5a | "different populations are never pooled" | A baseline blending live and online hands | ✅ Asserted in code (`segmentKey`) |
| 6.5a #2 | "Leave-one-out — non-negotiable" | A villain shrinking toward a pool containing its own hands | ✅ Asserted by test |
| 6.1–6.4 | N-player forms with "N=1 is the specialization" | An N=1 evaluation diverging from the classic formula | ✅ Asserted by test (WS-277, `multiwayDecisionMath.test.js`) |
| 7.1 | "Every decision derives from game state, not labels" | A decision path taking a position/bucket/style label as a direct input | ✅ Greppable; 9 anti-patterns enforce it |
| 7.2 | "Position labels … must never be the final answer" | Same as 7.1 | ✅ Covered |
| 8 | "Common Mistakes This Document Prevents" (14 numbered) | A recurring engine defect class not on the list | ⚠️ **Implicitly exhaustive, explicitly open-ended.** No falsifier by construction — it is a growing list, not a closed set. Acceptable, but should say so. |
| 10.3 | "Risk premium … a Derived Quantity, Never a Label" | A bubble-factor or M-zone lookup table feeding a decision | ✅ Asserted by challenge protocol |

## Standing defects in the inventory itself

1. **§3.4 has been falsified once.** Its exhaustiveness claim survived from
   authorship until 2026-07-26. The current 4+1 taxonomy should carry an explicit
   "this list has been wrong before" marker rather than reasserting completeness
   in the same voice.
2. **§4.2's bluff-catcher definition has no falsifier** because it defines an
   idealized category. Real hands sit on a continuum. This is fine as pedagogy
   and dangerous as a modelling assumption — the doc does not currently
   distinguish the two uses.
3. **§8 is implicitly exhaustive and explicitly open-ended.** It should state
   that it is an accumulating list so no reader treats absence from it as
   evidence of correctness.

These three are the output of mechanism 2 on its first run and are carried into
`theory-gaps.draft.md` for founder review.
