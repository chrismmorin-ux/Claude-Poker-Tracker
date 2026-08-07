# Theory gaps — candidate ADDITIONS to POKER_THEORY.md

**DRAFT — awaiting founder review.** Nothing here is in POKER_THEORY.md and
nothing here is in the work queue. Promote by moving an entry into the doc, or
reject it inline.

Two runs are recorded below, newest last. **The 2026-07-26 tiers (A–E) are
carried forward intact** — the founder has not reviewed them, so nothing in them
has been resolved by being superseded. Status lines have been added where this
run or the queue shows movement; no original text has been removed.

| Run | Date | Method | Sections added |
|---|---|---|---|
| first run | 2026-07-26 | inline, 4 mechanisms | Tiers A–E |
| **run-001** | **2026-08-07** | **`eng-engine`, 6 personas + facilitator** | **Tiers F–H, top-5, claims table** |

---
---

# RUN 2026-07-26 — carried forward, unreviewed

Run: `theory_completeness` first run · 2026-07-26 · Protocol:
`docs/domain/theory-completeness-protocol.md`
Ranked by **arbitrability first** (claims a number can settle outrank claims an
argument can settle), then consequence.

> **Scope honesty.** Mechanism 2 (exhaustiveness audit) ran fully — its output is
> the inventory in the protocol doc and items D1–D3 below. Mechanism 4 (empirical
> arbitration) ran against the 2026-07-26 backtest. Mechanism 3 (internal-tension
> sweep) was added mid-session on founder feedback and ran fully against the open
> queue — Tier E. Mechanism 1 (full coaching-taxonomy coverage walk) ran as a
> **first inline pass, not a dedicated engine run** — it remains the least
> complete and the next run should give it a full pass.

> **Status note added 2026-08-07 (run-001):** mechanism 2's inventory is now
> **stale by 54% of the document** — see the cheapest-action callout below. That
> is the single most important thing this section says today.

---

## Tier A — arbitrable with a number, from data already in hand

### A1. The doc has no account of fold-rate response to BET SIZING, and the model is measurably flat
**Claim:** POKER_THEORY §11.1 documents a personalized fold-curve hierarchy, but
nowhere does the doc state what shape the fold-vs-sizing relationship actually
has in a live/online population. §6.3 treats the breakeven threshold as sizing-
dependent while the fold rate that meets it is treated as roughly a constant.

**Evidence (WS-273, 2026-07-26, 10,147 decisions):**

| sizing bucket | n | model predicts | population actually folds |
|---|---|---|---|
| 0–33% pot | 1,022 | 45.5% | 41.5% |
| 33–66% pot | 2,073 | 44.7% | **58.0%** |
| 66–100% pot | 26 | 48.7% | 84.6% |

The model predicts a nearly flat ~45% across every bucket; the population climbs
steeply. **This is a doc gap before it is a code bug** — there is no section
asserting what the curve should look like, so no sweep could flag the code for
diverging from it.

**Proposed section:** §6.3a "Fold rate is a steep function of sizing" with the
measured gradient and its live/online caveat.
**Already ticketed as a code fix:** WS-283. This entry is the *doctrine* half.

> **Status 2026-08-07:** WS-283 still `backlog`, **open 12 days**. The doctrine
> half remains unwritten and unticketed.

### A2. The doc asserts personalization is valuable without stating WHERE it is valuable
**Claim:** §6.5/§6.5a build an elaborate personalization hierarchy. The doc never
says which decision classes personalization actually improves.

**Evidence (same run):** the personalized model's entire edge is in **unopened**
spots (+3.0% lift, n=6,585). Facing a bet it is **−0.2%** (n=3,121); facing a
raise **+0.1%** (n=441). By line class: limp +4.1%, coldCall +2.3%, but
openFirstIn −0.6%, isoRaise −2.3%, cold3Bet −2.9%.

**Why it belongs in the doc:** an engineer reading §6.5 today would reasonably
conclude the hierarchy helps everywhere. It does not, and the places it does not
are exactly the places hero's own decisions are hardest.

**Proposed section:** §6.5b "Where personalization earns its keep — and where it
does not," with the measured slice table and the caveat that this is HandHQ
online 2009.

> **Status 2026-08-07:** unchanged, unticketed. run-001's F2 (thoughtCatalog)
> attaches here: a fifth signal class is in production above this hierarchy with
> no measured lift at all.

### A3. ✅ RESOLVED 2026-07-26 — the texture-preservation ORDER is REFUTED, not merely unmeasured
**Claim:** `villainDecisionModel.js:154` preserves board texture through level 3
on the stated reasoning that *"wet vs dry boards have the largest impact on
villain action distribution after street context."* POKER_THEORY does not carry
this claim at all, and it has never been measured.

**Status: SETTLED.** The `--sweep` ran (4 arms × 10,147 decisions). The smoke run
could not resolve this because its two arms routed only ~30 decisions differently.
Here they differ on **1,076** — levels 2–4 reshuffle 79→434, 135→318, 930→392 —
and the log-loss difference is **0.00018** (0.02% of lift). `texture-last` scores
0.793003 vs `shipped` 0.793184: a hair better, deep inside noise.

**Verdict: the ordering makes no detectable difference, and the stated reason for
it is unsupported.** Not "texture-last is better" — *arbitrary at this sample*.

**Action — do NOT add to POKER_THEORY.** The right fix is subtractive: delete the
causal justification from `villainDecisionModel.js:154` or restate it as an
arbitrary tie-break citing this measurement. Promoting a refuted claim into the
doc would be the exact failure this protocol exists to prevent.

**Bonus from the same sweep, worth promoting:** the two ladder guards are far more
load-bearing than believed. Removing the ladder (`flat`) costs **−3.98%** lift
(9,990 of 10,147 decisions fall to the bare prior); accepting single-observation
evidence (`min-n-1`) costs the **entire** edge (+1.69% → −0.07%). `MIN_EFFECTIVE_N
= 3` and the ladder itself deserve an explicit §11.1 note — they are cheap
parameters that would look harmless to loosen.

> **Status 2026-08-07:** the subtractive fix and the ladder-guard note both remain
> unpromoted. The ladder-guard note is one of the cheapest doc edits in this file.

---

## Tier B — real gaps, not yet arbitrable

### B1. Table and seat selection is absent entirely
The largest $/hour lever in live poker — which game to sit in, which seat, when
to leave — has no section. The doc optimizes decisions *within* a hand and is
silent on the decision that dominates hourly rate. Already filed as WS-280;
noting it here because the **doc gap** is separate from the feature gap.

> **Status 2026-08-07:** WS-280 still `backlog`, **open 12 days**. Two run-001
> lenses (failure-engineer #1, product-ux #2) re-found this independently and
> product-ux presented it as new — see "Dedupe log" below. **Re-found twice in
> one run and shipped zero times is the signal here, not the gap itself.**
> run-001 adds one thing: it is **not corpus-settleable** (needs session-level
> data HandHQ does not carry), so it will never be resolved by a mining pass.

### B2. No account of hero's own strategy or perceived range
The doc models villain ranges extensively and hero's hand-state (§HSP), but has
no section on what villain thinks HERO holds. Every bluff-frequency and
balance claim implicitly assumes villain reads hero correctly. Filed as WS-276.

> **Status 2026-08-07 — MOVED. WS-276 is `done` and §12 now exists**
> ("Hero's Range, and What Villain Thinks It Is", POKER_THEORY.md:1976–2117).
> The doc gap as stated is **closed**. Two residuals inherit it, both from
> run-001: §12.3's perceived-range accumulation ignores that hero's actions are
> *system-recommended* and therefore more deterministic than the population prior
> assumes (:2017-2020, → G6); and the shipped `perceivedHeroRange` capability is
> reported as inert behind an optional parameter no production call site passes.
> **Do not mark B2 closed without checking the second residual.**

### B3. Non-stationarity is not addressed
§6.5a's hierarchy treats a villain's stats as a stationary quantity to be
estimated. Real players tilt, adjust, and change gears. The doc has no concept of
recency weighting or regime change. Filed as WS-275.

> **Status 2026-08-07:** WS-275 still `backlog`, **open 12 days**. run-001
> sharpens it twice: §11.8 (:1853-1855) *already names the missing instrument*
> ("within-session, change-point-shaped, keyed on recent history — not a
> per-player corpus rate") and does not build it; and :1849's "stable rate
> averaged over months" needs to become an explicit **doctrine boundary**, not a
> caveat. Security lens adds the adversarial face (→ G2).

### B4. Multiway bluff-catching with players behind
§4.2 now carries this as an explicit known gap with a pointer to WS-282 (added
2026-07-26 by WS-277). Listed here so the completeness inventory stays complete.

> **Status 2026-08-07:** WS-282 still `backlog`, **open 12 days**.

---

## Tier C — coaching-taxonomy coverage gaps (first pass, least complete)

Topics a standard live-cash curriculum covers that POKER_THEORY.md has no section
for. **Coverage signal only — presence on this list is not an argument that the
topic belongs.**

- **Stack-depth-conditional preflop strategy.** §2 opening ranges are stated
  without reference to effective stack; 40bb and 200bb play differently.
  > *2026-08-07 — SHARPENED to a specific defect by failure-engineer #3, now F6.*
- **Blind defense as a distinct discipline.** Referenced in passing
  (`blindDefendMax`) but no section.
  > *2026-08-07 — untouched by run-001; still the least-examined row here.*
- **Multi-street planning / line construction.** The engine does depth-2/3
  planning; the doc has no theory section describing what a *line* is or how to
  construct one.
  > *2026-08-07 — SHARPENED by senior-engineer #3 (barrel doctrine), now F10.*
- **Table dynamics and meta-game.** Recent history between two specific players
  changes both ranges. Named in the challenge protocol's prompt as something the
  engine ignores; no doc section.
  > *2026-08-07 — SHARPENED by security-engineer #1 into its adversarial form
  > (villain adjusting to hero specifically), now G2.*
- **Variance, bankroll, and stop-loss discipline.** Adjacent to strategy rather
  than part of it — plausibly out of scope by design, but the doc should say so.
  > *2026-08-07 — product-ux #2 re-found this; it belongs with B1/WS-280. The
  > "the doc should say so" half is still the actionable half.*

---

## Tier D — defects in the doc's own completeness claims

From mechanism 2. Full inventory in the protocol doc.

### D1. §3.4 reasserts exhaustiveness in the same voice that was already wrong
The four-motive taxonomy was falsified once (protection was missing until
WS-278). It now says four-plus-inducing in the same confident register. It should
carry an explicit marker that this list has been incomplete before.

> **Status 2026-08-07:** unresolved, and run-001 found it *worse* than recorded —
> the **heading still says "Four Motivations" (:329) while the body names five,
> including inducing (:349)**. The heading/body mismatch sits directly under the
> doc's own falsified-once banner. Independently found by senior-engineer and
> failure-engineer. This is a one-line edit.

### D2. §4.2's bluff-catcher definition has no falsifier
*"A hand that beats all bluffs and loses to all value hands"* defines an
idealized category; real hands sit on a continuum. Fine as pedagogy, dangerous as
a modelling assumption, and the doc does not distinguish the two uses.

> **Status 2026-08-07 — ESCALATED.** senior-engineer traced the definition into
> **14 consuming files under `src/`** (incl. `holdingKnowledge/index.js`,
> `postflopDrillContent/lines.js`, `anchorLibrary/perceptionPrimitiveSeed.js`,
> `heroState/equityVsRangeParts.js`). The "fine as pedagogy" framing understates
> it: **it is already load-bearing as a modelling assumption.** Re-rank D2 above
> D1 and D3.

### D3. §8 is implicitly exhaustive and explicitly open-ended
"Common Mistakes This Document Prevents" is an accumulating list, not a closed
set. It should say so, so no reader treats absence from it as evidence of
correctness.

> **Status 2026-08-07:** unresolved. product-ux adds that §8's 14 mistakes are
> *all analytical* — none is an execution or psychological failure of hero
> (→ G7). That is a second, different sense in which §8 is not exhaustive.

---

## Tier E — queued work that will make a POKER_THEORY section WRONG

Added 2026-07-26 after the founder observed the first draft "omits a lot of the
improvements we have queued up that might affect the theory." Correct. Mechanism 3
(internal-tension sweep) was added to the protocol and run against the open
`prog-domain-correctness` queue.

The question asked of each ticket is **not** "which section does this implement" —
it is **"which section does shipping this make wrong?"** Every row below is a
place the doc currently argues with itself, or with the code, *today*.

| Ticket | Section it breaks | The tension, stated | Status 2026-08-07 |
|---|---|---|---|
| **WS-279** equity realization | **§1.4** | §1.4 states realization as a **lookup** ("suited realize better than offsuit", position/SPR/texture factors). §7.1/§7.5 say derive from game state and never use labels as inputs. These are already contradictory; the ticket resolves it toward §7. **§1.4 must be rewritten when it ships, and is arguably wrong now.** | `backlog`, **open 12 days**. Re-found by failure-engineer as a documented internal contradiction. |
| **WS-274** preflop from table composition *(in flight, other session)* | **§2.1** | §2.1 keys opening ranges on position **labels**. §7.2 says position labels are proxies, never causes. The ticket replaces `POSITIONAL_FOLD_TO_3BET` with fold equity computed against the players actually behind. §2.1 becomes a *presentation* default, not doctrine. | **`done`.** The §2.1 doc edit this row predicts is now **owed** — verify §2.1 was demoted to presentation-default, or this is a live doc/code divergence. |
| **WS-254** foldTo3Bet definition | **§2.3, §6.5a** | The doc's "3-bet" is a poker concept; the code's `foldTo3Bet` stat counts **any preflop fold facing a raise, including fold-to-open** — measured 78–86% in the corpus vs a true ~49.9%. §6.5a lists `foldTo3Bet` among the six priors without ever saying what it measures. **The doc and the stat share a name and not a definition.** | `backlog`. Still one of the two rows worth promoting ahead of its ticket. |
| **WS-255** limp-reraise ≠ 3-bet | **§2.2, §2.5** | `threeBet` fixes `facedRaise` at first action, so a limp-reraise is not counted. §2.5's derived taxonomy names limpReraise as a distinct class; the scalar stat predates it and disagrees. | `backlog`. run-001 F5 adds a *second* problem with the same hand: the per-100-hands denominator. |
| **WS-275** non-stationarity | **§6.5a** | The whole four-tier hierarchy treats a villain's stats as a **stationary** quantity to be estimated ever more precisely. Players tilt, adjust, change gears. §6.5a has no time dimension at all — not "handles it badly", *absent*. | `backlog`, **open 12 days**. See B3 status. |
| **WS-276** hero / perceived range | **§4.2, §5.4** | Every balance and bluff-frequency statement implicitly assumes villain reads hero's range correctly. There is no § for what villain *thinks* hero holds, which is the level-2 gap. | **`done` — §12 shipped (:1976).** See B2 status for the two residuals. |
| **WS-265** bluff triggers | **§3.4, §6.3** | §6.3 gives the breakeven fold rate — *whether* a bluff is profitable. Nothing says **when to bluff**: no trigger taxonomy, no account of which spots generate the river-air frequency the Field frame measured at 4–7%. | `backlog`. §13 shipped (:2118) and covers bluff *candidate selection*; confirm whether §13 closes this row or only narrows it. |
| **WS-264** mining pass 2 | **§3.5, new** | Brings a **concealment premium** / perceived-range factor with no doc home; pairs with WS-276. | `backlog`. WS-276 has now shipped, so the doc home (§12) exists. |
| **WS-252** sizing tells → thresholds | **§3.5** | §3.5 says the sizing↔range-shape mapping "is NOT deterministic" and "must be validated by showdown data" — correctly cautious. Wiring correlation into live bluff-catch thresholds is exactly the step §3.5 warns about; the doc needs to state the gating conditions under which it becomes admissible. | `backlog`. |
| **WS-253** timing tells | **absent** | Time-to-act is not mentioned anywhere in POKER_THEORY. A data-model change with zero doctrinal grounding. | `backlog`, **open 48 days** — the oldest row here. Intersects run-001 H2 (live-only channels). |
| **WS-270** 4-bet tree | **§2 (absent)** | §2 covers opens, limps, 3-bets, squeezes. **There is no 4-bet section.** The third preflop scenario has no theory. | `backlog`, **open 13 days**. |
| **WS-283** fold curve | **§11.1, §6.3** | Already Tier A1 — listed here so the queue walk is complete. | `backlog`, **open 12 days**. |
| **WS-281 / WS-282** | **§6 preamble, §4.2** | Already referenced by name from those sections (WS-277). Closing either forces a doc edit. | Both `backlog`, **open 12 days**. run-001 F11 finds the §6 preamble marker is **already stale** — §11.4 measured part of what it says is unmeasured. |

**The pattern worth noticing.** Most of these are not "the doc is missing a
topic." They are **the doc says X and the code does Y, and neither the sweep nor
the challenge protocol flags it, because the code is doing the *better* thing.**
Inward protocols look for code drifting from doc. They are structurally blind to
doc drifting from the game while the code quietly keeps up.

That is a stronger version of WS-272's original thesis than the ticket stated,
and it argues the `theory_completeness` cadence should be tied to **queue
throughput**, not only to the calendar: every closed domain-correctness ticket is
a candidate doc edit. Recommend revisiting the 90-day cadence once 5+ of the
above have shipped.

> **Status 2026-08-07 — the cadence argument is now evidenced.** Three Tier E
> tickets closed in twelve days (WS-274, WS-276, plus WS-302/WS-303 feeding
> §11.9) and **each one owes a doc edit that has not been made**. Meanwhile the
> doc grew past §16. The 90-day calendar cadence would have caught none of it.

---
---

# RUN-001 — 2026-08-07 · `eng-engine`, 6 personas + facilitator

Ordered per protocol: **corpus/code-settleable first (Tier F), then
measurement-needed (Tier G), then permanent-blind-spot declarations (Tier H).**

Every entry carries: the claim (what is absent), the source lens(es) — with
**⇄ CONVERGENCE** marking findings two or more lenses reached from different
starting points — the evidence with `file:line`, a proposed placement, and a
settleability class.

**Facilitator verification note.** Per `.claude/rules/dispatch-dont-assert.md`,
load-bearing anchors in Tier F were re-checked against the repo at HEAD by the
facilitator, not accepted from the lens outputs. Two lens claims did not survive
that check and are corrected in-line and in the dedupe log. **The corrections are
stated where the claim is, not in a footnote.**

---

## Tier F — settleable now, from the corpus or from the code

### F1. Hero bluff SELECTION has no blocker theory, while the code already has a blocker score ⇄ CONVERGENCE
**Claim:** The doc has no theory of card removal for choosing *which* hand hero
bluffs with. Blockers appear only as scattered asides, none of them hero-side
selection.

**Source:** systems-architect #5 (from doc structure) + senior-engineer #1 (from
`heroActionBuilder.js` / `blockerScore`). Independent starting points.

**Evidence:**
- `POKER_THEORY.md:2118-2249` is §13, the doc's **dedicated bluff-candidate-
  selection section**. Facilitator-verified: **zero occurrences of "blocker" in
  that span.**
- Blockers appear four times in the whole doc, none of them hero bluff selection:
  `:410` (blocker *bet* as one of the sizing motivations), `:551` (blocker as a
  **bluff-CATCHING** criterion), `:997` and `:1021` (§9, solver divergence — the
  pool "donks blocker-bluffs less than solver prescribes").
- `src/utils/exploitEngine/CLAUDE.md:139-140`: *"`blockerScore` (WS-315) is
  hero-side candidate selection and still has no EV path."* WS-315 is `backlog`.

**Facilitator correction (line-number dispute in the cross-critique).** The
cross-critique instructed treating `:410` as unconfirmed and `:551` as the only
mention. **That is wrong and is hereby overruled — `:410` is confirmed present,
and there are two further mentions at `:997` and `:1021` that no lens found.**
The architect's count was the more accurate one. This does not weaken the finding:
four mentions, none of which is hero bluff selection, is a *sharper* statement of
the gap than two.

**Proposed placement:** §13.5, "Which bluff — card removal in candidate selection."
**Settleability:** **CORPUS-SETTLEABLE.** Score blocker vs non-blocker candidates
of equal §13.1 tier through the WS-273 harness. Design already sketched by
senior-engineer.

### F2. A 19-pattern cognitive taxonomy runs in production with zero theory backing, above a hierarchy the doc calls exhaustive
**Claim:** `thoughtInference` assigns villains first-person cognitive labels
(`tilt-prone`, `river-panic`, `sizing-is-a-tell`, `hand-strength-only`, …) inside
the live analysis pipeline. POKER_THEORY.md does not mention this signal class at
all — no evidence standard for inferring it, no statement of where it sits
relative to the four adjustment tiers, no double-counting doctrine.

**Source:** senior-engineer #2, fully independent and code-anchored. Nominated by
the cross-critique as the most consequential item of the run.

**Evidence (all facilitator-verified this session):**
- `src/utils/exploitEngine/thoughtCatalog.js` exports `THOUGHT_CATALOG`, **19
  entries**, each with an `id`, a first-person `thought`, a `meaning`,
  `signatures` (**85 signal blocks across the catalog**), `contradicts`, and
  `predicts`.
- Wired into production: `src/utils/analysisPipeline.js:24` imports
  `inferVillainThoughts`; Step 5b (~`:147-157`) calls it and pushes
  `thoughtInference` onto `diagnostics.stepsCompleted`.
- **`POKER_THEORY.md` contains zero occurrences of `thought`, `cognitive`,
  `thoughtInference`, or `thoughtCatalog`.** (Facilitator grep, HEAD 18f49f22.)
- `POKER_THEORY.md:851-874` (§7.4) states the adjustment-source hierarchy as
  **"pick ONE per adjustment"** over exactly four tiers: villain decision model →
  observed aggregate stats → style-conditioned parameters → population priors.
  A fifth signal class is in production and is not in that list.

> **FACILITATOR CORRECTION — stated up front because it is a contradiction of a
> relayed claim.** senior-engineer reported a **"64-entry"** taxonomy. The actual
> count is **19**. The 64 does not correspond to anything I can find: signals are
> 85, `predicts` blocks are 19. This is the "motivated rounding" error shape the
> repo's own AI-error-shape study flagged — an inflated magnitude attached to an
> otherwise sound finding. **Every named example the lens cited does exist**
> (`hand-strength-only`, `tilt-prone`, `river-panic`, `sizing-is-a-tell` are all
> real IDs), and the substance — production taxonomy, no doctrine, no evidence
> standard, §7.4 claims exhaustiveness — reproduces exactly. Quote 19, never 64.

**Proposed placement:** §7.4a, "The fifth signal class, and why it does not stack"
— or an explicit §7.4 amendment stating the tier at which inferred cognitive
patterns enter, if any.
**Settleability:** **CORPUS-SETTLEABLE.** Does a thought label improve held-out
next-action prediction *beyond* the villain decision model? If not, the labels are
presentation and the doc should say so. If yes, §7.4's hierarchy is incomplete as
written. Either answer is a doc edit; both are cheap on the existing harness.

### F3. Two "canonical" strength ladders, and nothing has ever compared them
**Claim:** §15.4 declares percentile **the** cross-board coordinate. §2.3 derives
its preflop percentile from `EQUITY_VS_OPEN` — equity *against an opening range*.
§16.2's `f = S·w` is equity *against random*. These are different orderings of the
same 169 classes, and the doc treats them as one thing.

**Source:** systems-architect (unfalsified-claims section). Nominated by the
cross-critique as the most cheaply settleable NEW claim of the run.

**Evidence:** `POKER_THEORY.md:191` — *"Hand strength in the priors is the
combo-weighted equity percentile of the class, from
`pokerCore/preflopEquityTable.EQUITY_VS_OPEN`"*, with the identity that makes
thresholds derivable rather than tuned; vs `:2358` — *"What survives is the
**normalisation**. A percentile — rank within *this* board's universe"* and the
EV-vs-percentile machinery at `:2368-2399`. §2.3 already documents a one-rank
divergence against a third basis, so a divergence here is not hypothetical.

**Proposed placement:** a note in §15.4 naming which basis the coordinate is, plus
a cross-reference in §2.3.
**Settleability:** **PURE COMPUTATION — no corpus, no engine run, no sweep.**
Rank all 169 classes by `EQUITY_VS_OPEN` and by equity-vs-random; report Kendall's
tau and the largest rank displacements. This is the cheapest settleable item in
either run.

### F4. §11.9 says coverage is "100% everywhere"; §3.6.1 and §11.6 say ~94%, and §11.9 says 88–94%
**Claim:** The document states its own headline post-fix range-coverage figure
three different ways, and the strongest version — "100% everywhere — the floor
guarantees it" — is used to dismiss a ticket's numbers. (The percentages are
range-coverage counts quoted from the document under audit — a consistency
finding, not an EV claim; the contradiction itself is the finding.)

**Source:** senior-engineer, independently reproduced from the file (WS-423 C1).
Facilitator re-verified all four anchors.

**Evidence:**
- `:468` — coverage flop→turn→river: `89% → 71% → 56%` before, **`~94% flat`** after.
- `:469` — coverage facing a raise: `55%` before, **`93%`** after.
- `:496` — *"Known residual, stated rather than implied (2026-07-28). Coverage
  plateaus at ~88–94%…"*
- `:1969` — *"Neither reproduced: **coverage is 100% everywhere** post-§11.6 (the
  floor guarantees it)"*, used to reject WS-303's reported 84–86%.

The upstream 94% instances were never relabeled. **This is the WS-291 mechanism —
nothing forces two numbers onto the same axis, so a wrong number never has to meet
a right one — reproducing inside the section written to record WS-291's fix.**
Note that `:1972` already instructs *"Re-measure before quoting any of the older
numbers"* — that sentence is its own falsifier and nobody has executed it.

**Proposed placement:** §11.9 correction + a §11 convention that coverage figures
carry their conditioning set (by street / facing-raise / under chaining), per the
repo's "numbers carry their conditional" doctrine.
**Settleability:** **CODE-SETTLEABLE — one re-measure.** Either 100% is right and
three upstream figures are stale, or 94% is right and §11.9 overstates.

### F5. The "one currency" of §14 was never reconciled with the two-decision-points-per-hand taxonomy of §2.5.4
**Claim:** §14 establishes events-per-100-hands as the universal denominator.
§2.5.4 establishes that a single hand can contain two distinct decision points
(limp then reraise). The doc never says whether such a hand is double-weighted.

**Source:** systems-architect #2.

**Evidence:** `POKER_THEORY.md:2264+` (§14, "The Hand Is the Denominator", section
head at `:2252`) vs `:287-293` (§2.5.4). Pairs with Tier E's WS-255 row, which
found the *stat* disagrees with the taxonomy; this finds the *denominator* does
too.

**Proposed placement:** §14.1a, one paragraph fixing the counting rule.
**Settleability:** **CODE-CHECKABLE, NO CORPUS JOB.** Inspect the opportunity-
counting call sites consuming `subActionExtractor.js`.

### F6. `pipCalculator` calls its reference "GTO" while being fed the population charts
**Claim:** PIPs are a named Key Concept. The module computing them names its
baseline `gtoRange` and documents it as a "GTO baseline," but is fed
`PREFLOP_CHARTS` from `populationPriors.js` — the table §2.1 and
`rangeEngine/CLAUDE.md` explicitly say is **population, not GTO**. The doc says
nothing that would let a reader tell whether this is a naming slip or a wrong
reference.

**Source:** senior-engineer (dangerous assumptions).

**Evidence (facilitator-verified):** `src/utils/.../pipCalculator.js` docstring
line 5 — *"by comparing player range widths to **GTO baselines** per hand
category"*; parameter `gtoRange` and `@param {Float64Array} gtoRange - GTO
baseline range` at the `computePips` signature (~`:99`); imports
`POSITION_GTO_KEYS`. Fed by `PREFLOP_CHARTS` per `pipCalculator.test.js:69,84`.

**Why this is not cosmetic:** if it is a naming slip, PIPs mean
"deviation from population" and the doc should say so where PIPs are defined. If
it is not, PIPs measure deviation from the wrong reference and every PIP ever
displayed is mislabeled. **These have opposite consequences and one file read
distinguishes them.**

**Proposed placement:** wherever PIP is defined as a Key Concept — one sentence
naming the reference distribution.
**Settleability:** **CODE-SETTLEABLE IN ONE READ.**

### F7. Hero has no check-raise doctrine, only villain's ⇄ CONVERGENCE
**Claim:** The doc covers check-raise entirely from the villain side. Hero's
check-raise as an action-selection decision — when to build the line, with what,
against what — is absent.

**Source:** systems-architect #4 (doc structure) + senior-engineer #4
(`heroActionBuilder` names check-raise as a candidate type). Independent.

**Evidence:** villain-side coverage at `POKER_THEORY.md:1304` (§11.1c
`crVillainResponse`) and §5.8 (trap). No hero-side counterpart anywhere.

**Underlying pattern, worth stating in the doc itself:** senior-engineer names
this as an instance of *villain-side theory assumed to generalize symmetrically to
hero's richer action space without a worked corollary* — the same
transplant-across-conditioning-sets family as WS-423. F1, F7 and F10 are all
instances.

**Proposed placement:** §13.x or a new hero-action-construction section.
**Settleability:** **PARTIALLY CORPUS-SETTLEABLE** — frequency and EV baselines
for check-raise lines are measurable on HandHQ; the doctrine on top is authoring
work.

### F8. Rake is priced per-pot and never as a selection pressure
**Claim:** Capped rake taxes small multiway pots disproportionately, which shifts
**which hands are worth playing**, not merely the EV of a hand already in
progress. The doc treats rake only as an in-hand EV term.

**Source:** failure-engineer #5.

**Evidence:** §1.5's implied-odds/set-mining math carries no rake haircut. The
live-vs-online rake *numbers* are non-transferable (see H3), but the
**formula-level correction is derivable today with no corpus at all**.

**Proposed placement:** §1.5 amendment + a note in §6.
**Settleability:** **DERIVABLE NOW — no data required.** The cheapest item in
Tier F after F3.

### F9. Effective stack is missing from the conditioning set of every cash maxim
**Claim:** §1.5 states the 15:1 set-mining rule with **no minimum effective-stack
floor**; at shallow stacks the payoff the rule prices is structurally unreachable
and the rule still reads "call." §2.1's opening ranges carry no stack reference.

**Source:** failure-engineer #3. **Sharpens Tier C row 1 from a coverage item to a
specific defect** — that is why it is in F rather than restated in C.

**Companion defect from the same lens:** §2.3's "3-bet = monster, fold non-
premiums" is prose-scoped to live low-stakes with **no stake ceiling stated**;
applied at 2/5+ it inverts into systematic over-folding. The code segments via
`segmentKey`; the prose does not. (See H4 — this is the doc-structure half.)

**Positive control the lens correctly identified:** §11.1a's fold curve
(founder-estimate 0.45 base, online-2009 shape) **is** correctly conditioned.
That is what §1.5 and §2.3 should look like.

**Proposed placement:** conditioning-set clauses on the affected maxims.
**Settleability:** **CORPUS-SETTLEABLE** — HandHQ carries effective stacks.

### F10. No barrel / multi-street continuation doctrine, despite a barrel-planning stage in the engine
**Claim:** The engine has `computeDepth3BarrelEV` and a named barrel-planning
stage. The doc has two asides (`:643`, `:2034`) and no doctrine. Specifically
unanswered: do §13's two gates re-clear on each street, and is §11.4's
fold-through the intended turn→river mechanism?

**Source:** senior-engineer #3. **Sharpens Tier C's "multi-street planning" row.**

**Evidence:** `src/utils/exploitEngine/CLAUDE.md:659` (barrel-planning stage);
`POKER_THEORY.md:643`, `:2034`.

**Proposed placement:** §13.x, "Does the bluff re-qualify on the turn?"
**Settleability:** **CORPUS-SETTLEABLE** via the existing harness.

### F11. §6's "UNMEASURED as of 2026-07-26" marker is already stale, and there is no revisit mechanism
**Claim:** The §6 preamble carries *"card removal … UNMEASURED as of 2026-07-26
(WS-281)"*. §11.4 (`:1404-1490`) subsequently **did** measure it for the preflop
fold-through slice. The marker was never revisited.

**Source:** systems-architect.

**The general pattern, which matters more than the instance:** the doc uses
date-stamped "unmeasured as of" markers with **no mechanism that ever revisits
them**. Every such marker decays into a false statement on a schedule nobody
tracks. This is the same structural failure as the stale exhaustiveness inventory
(cheapest-action callout below).

**Proposed placement:** fix the §6 marker; add a convention that every dated
"unmeasured" marker names the section that would close it.
**Settleability:** **DOC-SETTLEABLE — one read.**

### F12. No unified hero bet-SIZING selection theory
**Claim:** The doc covers *reading* villain sizing (§3.5) and carries scattered
directional rules (§3.4.1, §4.1, §12.4). It has no theory of how hero *selects* a
sizing scheme: tiered sizing across a range, geometric growth, when to split a
range into two sizes.

**Source:** systems-architect #3, unique — corroborated obliquely by
performance-engineer's finding that §12.4's bluff:value table has no scoring path
(see the claims table).

**Proposed placement:** §3.4.4 or a new §17.
**Settleability:** **PARTIALLY CORPUS-SETTLEABLE** via the existing
sizing/strength-correlation mining infrastructure (§9.4, §11.9).

### F13. Table-size transition (9-handed → short-handed mid-session) has no theory
**Claim:** Nothing in the doc addresses what changes when the table breaks down to
6 or fewer mid-session — which is a routine live occurrence, not an edge case.

**Source:** systems-architect #1.

**Evidence:** §11.7's resolved block (`POKER_THEORY.md:1615-1660`) **already
stratifies HandHQ by 6-max vs 9-max**. The same stratification answers "does this
§2–§5 claim hold at 6 as at 9" for most claims in those sections, at near-zero
marginal cost.

**Proposed placement:** §2.0, or a note near §7 — *table size is game state, not a
label*, which is the §7.1 framing applied correctly.
**Settleability:** **CORPUS-SETTLEABLE, INFRASTRUCTURE ALREADY BUILT.**

---

## Tier G — real gaps that a corpus pass cannot settle

These need an instrument that does not exist, or a measurement the corpus
structurally cannot carry. Per the protocol's ordering rule they rank below Tier F
**for settlement sequencing only** — G1 and G2 are higher-consequence than most of
Tier F and one of them is in the top 5.

> **Ranking tension, resolved.** The security-engineer lens argued its items
> should rank **first** on consequence despite being non-settleable. The protocol
> declares corpus/code-settleable first. **Resolved in the protocol's favour** —
> ordering here is a *sequencing* claim about what to settle next, not a claim
> about importance, and the protocol's ordering is what keeps a run from
> terminating in a list of things nobody can act on. Security's items are kept in
> full, with their evidence-source note attached: **the correct evidence source
> for all of them is the prediction ledger or a new within-session instrument, not
> HandHQ.** G2 is nonetheless ranked #4 in the top 5 on consequence.

### G1. No theory-under-compute-budget, and the doc's own axiom is violated by the architecture ⇄ CONVERGENCE (4 lenses)
**Claim:** §9–§13 are written as if evaluation time were unconstrained. The reader
cannot tell which doctrinal sections are guaranteed-before-hero-acts and which are
refinement luxuries that may never complete. Worse: **§7.1's own axiom —
decisions derive from game state, never from labels — is silently violated by the
compute architecture, because refinement depth is gated on wall-clock time.**
Identical game state under different CPU load produces different advice. Depth of
computation is an unstated decision input, and the doc never applies its own rule
to itself.

**Source:** performance-engineer #1, #2, #4 + product-ux #7. **The strongest
convergence of the run by lens count**, from independent evidence chains
(SYSTEM_MODEL benchmarks vs the live decision window).

**Evidence:**
- `SYSTEM_MODEL.md:366` — ~400ms fast path; +2000ms refinement; **26s worst-case
  wet flop**. `SYSTEM_MODEL.md:159,166` — budget set on desktop.
- `POKER_THEORY.md` contains **zero matches** for `refinementBudgetMs`,
  `MAX_STAGE_SHARE`, `26s`, or `Galaxy`.
- `gameTreeEvaluator` ~`:895-903`, `:927-930` — refinement gated on `Date.now()`.
  Measured by WS-379 (`backlog`) as a load-dependent ordering flip that three
  agents in one night each had to prove was not their regression.
- Live decision window is 15–30s against a 26s worst case.
- Nothing states what degrades first, or whether the live player ever actually
  receives §12's perceived-range correction rather than silently falling back to
  the §12.1–12.2 omniscient model the doc itself calls defective.

> **Status correction:** product-ux reported that **no production caller wires the
> fast depth-1 answer (`onFastResult`)**. The closest ticket, **WS-334** ("the
> depth-2/3 subsystem never runs on the live path — context building spends 390ms
> before the 150ms budget is first checked"), is **`done`**. Whether that closed
> the `onFastResult` gap or only the budget-check gap was **not resolved this
> run** — verify before ticketing.

**Proposed placement:** a new §17, "What the engine can actually compute before
you have to act," plus a §7.1 corollary naming compute depth as a decision input
that must be made explicit or eliminated.
**Settleability:** **NOT corpus-settleable.** It is a cross-reference of
measurements that already exist plus one doctrine statement. **The improvement
default applies: the correct resolution is to remove the non-determinism, not to
document it.** Documenting it is the interim, not the fix.

### G2. Nothing detects a villain adjusting to hero specifically
**Claim:** Every §5.2 weakness category (`:599-605`) is a **static trait**. None is
"this villain's tendencies are a function of *my* recent actions." §12.5 caps
recursion at level 2 and names the deeper-modeling trigger in prose only —
*"prediction-ledger evidence that responses are better explained by adjustment"*
(`:2065-2067`) — with **no threshold, no instrument, and no monitored statistic**.
The app can therefore recommend the same exploit indefinitely against a villain
who quietly stopped falling for it.

**Source:** security-engineer #1, #2.

**Evidence:** `:599-605`, `:2065-2067`. And `:1853-1855` (§11.8) **already names
the missing instrument** — *"within-session, change-point-shaped, keyed on recent
history — not a per-player corpus rate"* — for tilt/state, and never extends it to
deliberate counter-adjustment.

**Compounding static-model evidence:** the Beta-Binomial updater is time-invariant
with no within-session decay, so a mid-session deliberate change takes
~`PRIOR_WEIGHT ≈ 10` new observations — **roughly a full live session** — to
outweigh the prior. The villain finishes adjusting before the model notices.

**Proposed placement:** a new §5.2 category — *"villain response correlates with
hero's recent action history"* — plus a §12.5 trigger with a threshold.
**Settleability:** **NOT corpus-settleable.** HandHQ is static, monthly-averaged,
and its opponents do not recur — §11.8 admits this itself. Evidence source is the
prediction ledger plus a within-session drift detector that exists nowhere.

### G3. Minimum sample before ACTING is conflated with minimum sample before BELIEVING — and neither is calibrated to live speed
**MERGED CANDIDATE** — per the cross-critique, security's "minimum-sample-before-
acting" and product-ux #5's "sample size at live speed" are two faces of one gap
and are reported once.

**Claim, face A (threshold):** the doc has one shrinkage mechanism serving two
different questions. How much evidence before the model's estimate *moves* is not
the same question as how much before hero should *stake money on the difference*.
§5.7's lone CAUTION is an unnumbered footnote.
**Claim, face B (calibration):** `PRIOR_WEIGHT ≈ 10` is calibrated on corpus
volumes. Live 9-handed runs ~25–30 hands/hour with few showdowns. **What the
system should claim about a villain at hand #15 of a first-ever session is stated
nowhere** — and that is the modal live case, not an edge case.

**Source:** security-engineer (missing elements) + product-ux #5. Independent.

**Proposed placement:** a §5.7 promotion from footnote to numbered subsection,
carrying both the acting threshold and the live-volume calibration.
**Settleability:** **PARTIALLY.** The corpus can calibrate the *believing*
threshold at small n; the *acting* threshold needs an EV-at-risk framing and the
prediction ledger.

### G4. §12.5 stops recursion on theory grounds and §12.6 stops correction on engineering grounds, and the doc does not separate them
**Claim:** `:2057-2067` stops at level 2 because *the pool does not reason at level
3* — a doctrine claim. `:2069-2078` stops because *WS-301's breached timing budget
cannot absorb it* — an engineering claim. They are presented as one boundary.
**Only one of them is doctrine, and there is no stated threshold at which "cannot
absorb" becomes "can."**

**Source:** performance-engineer #3.

**Why it matters:** WS-301 is `done`. If the engineering constraint has moved, a
doctrinal-looking boundary is silently over-restricting the model — and nobody
would know, because the two reasons are not separable in the text.

**Proposed placement:** split the §12.5/§12.6 boundary into a doctrine clause and
an engineering clause, the latter naming its budget and its release condition.
**Settleability:** doc edit + one budget re-measure.

### G5. The Bayesian updater has no adversarial-input doctrine
**Claim:** §6.5/§6.5a (`:764-830`) and showdown anchoring in §5.9 (`:675-691`)
treat every observation as honest. There is no discount for **strategic
disclosure** — a villain manufacturing a showdown to bait a future read. §5.9's
bullets treat every shown hand as ground truth, and that assumption is never
stated as an assumption.

**Source:** security-engineer #3.
**Proposed placement:** §5.9 amendment.
**Settleability:** **NOT corpus-settleable.** Falsifiable via the prediction
ledger: shown hand → profitable sizing/frequency shift afterward.

### G6. Hero's own information leakage is entirely unmodeled, and system-recommended actions leak faster than the doc assumes
**Claim:** The doc is entirely villain-facing. Executing app recommendations
visibly — a 100% dry-board c-bet per §5.6 — **is itself a frequency tell**. §12.4
says balance costs against non-observers but supplies no mechanism for detecting
when an opponent *starts* observing. And §12.3's perceived-range accumulation
(`:2017-2020`) ignores that hero's actions are **system-recommended and therefore
more deterministic than the population prior assumes** — so a sharp opponent's
read on hero sharpens faster than the model represents.

**Source:** security-engineer #4, #5. **This is the live residual of B2/WS-276** —
§12 shipped without it.

**Also missing:** any doctrine on hero rebalancing — *how many times can hero take
the same exploit before hero's range is the tell*.

**Proposed placement:** §12.3a.
**Settleability:** **NOT corpus-settleable** (hero is not in the corpus). Prediction
ledger + a live exposure counter.

### G7. The fear mechanism was worked out for villain and never turned on hero
**Claim:** §11.6 (`:1696-1720`) is a **ratified** account of how fear pushes
villain's medium hands into passive lines. Hero has no counterpart. §8's 14
"Common Mistakes" are **all analytical** — none covers revenge-calling,
post-stacking over-tightening, sunk-cost call refusal, or fatigue.

**Source:** product-ux #3. Notable as the mirror-image of the doc's own strongest
ratified psychological result.

**Proposed placement:** §8 subsection, or a new hero-execution section.
**Settleability:** **NOT corpus-settleable** (requires hero session data).

### G8. Manual live input has no data-fidelity degradation doctrine
**Claim:** `:1387` says the SPR correction is *"only active when effective stack is
known (online/extension play)"* as a bare aside. **What the manual live path
actually does is unstated** — does it silently fall back to the forbidden
zone-label lookup, or omit the correction entirely? These have opposite
correctness consequences.

**Compounding (product-ux #6):** seat↔identity reliability is a **silent
precondition** of §2.1 and §11.4 (`:102-108`). One wrong seat↔profile link poisons
every downstream fold-through computation, with no stated detection path and no
stated degradation path.

**Source:** product-ux #1, #6.
**Proposed placement:** a new "Data Fidelity at the Table" section — which inputs
tolerate estimates, what confidence penalty applies when an input is missing, and
what the recovery step is when identity is wrong.
**Settleability:** the fallback question is **CODE-CHECKABLE** (and should be
checked before anything else here); the doctrine is authoring work.

### G9. Consequence-weighted confidence is named everywhere and defined nowhere
**Claim:** "Consequence weighting" is Core Principle #2 in
`exploitEngine/CLAUDE.md`, has tiers in `exploitValidator.js`, and appears as a
labeled box in the §5.1 diagram (`:585`) — **and is never defined quantitatively**.
This violates the doc's own drift policy at `:61`.

**Source:** senior-engineer #5.
**Proposed placement:** §5.1a.
**Settleability:** authoring + code read.

### G10. Multiway limped family pots (4–6 way) have no framing at all
**Claim:** §2.2 covers **one** limper. No section applies when five ranges are in
the pot — the defining live 1/2 situation. §3.4.3 gestures at multiway postflop;
preflop has nothing.

**Source:** failure-engineer #6.
**Settleability:** **PARTIALLY CORPUS-SETTLEABLE** — HandHQ online 2009 has far
fewer family pots than live 1/2, so the corpus will under-represent exactly this.
Borderline H-tier; kept in G because *some* signal exists.

### G11. Table/game/seat selection — KNOWN GAP, AGING (= B1 / WS-280, open 12 days)
Reported here **once**, not twice. failure-engineer #1 and product-ux #2 both
surfaced it; product-ux presented it as a new absence. See the dedupe log.
run-001's only addition: **it is not corpus-settleable**, so no mining pass will
ever close it.

### G12. Non-stationarity — KNOWN GAP, AGING (= B3 / WS-275, open 12 days)
See B3's updated status for the two sharpenings run-001 adds.

---

## Tier H — permanent blind-spot declarations

State these in POKER_THEORY.md the way §15.3.1 states **"LIVE IS UNMET"** — as a
standing declaration of what the instrument cannot see, not as a gap awaiting a
ticket. A blind spot that is not declared gets silently filled by a transferred
number.

### H1. STRADDLE IS UNMEASURABLE ⇄ CONVERGENCE
**Declaration:** The straddle changes pot odds, effective stack depth in big
blinds, and the position math **for the entire hand**. It is routine in the
founder's live 1/2–1/3 game. **HandHQ online 2009 has no straddle field. This
cannot be measured from the corpus at any sample size, ever.**

**Source:** systems-architect #6 + failure-engineer #4 — converging *including on
the unsettleability*, which is the strongest form of agreement available here.

**Evidence:** `POKER_THEORY.md:247` carries a residual note only (a straddler's
3-bet is misclassified as `cold3Bet`). Nothing else.

**The only closure path** is live accumulation through `predictionAudit` — and the
protocol's own assessment is that live volume is currently **too thin**. Declare
it; do not ticket it as if a mining pass could close it.

### H2. LIVE-ONLY INFORMATION CHANNELS ARE OUT OF INSTRUMENT
**Declaration:** Physical tells, verbal tells, timing tells, buying the button,
chopping the blinds, straddle culture, run-it-twice, and table etiquette have
**zero mentions** in POKER_THEORY.md — and, critically, are **never stated as
out of scope** the way §9 carefully states its solver divergences. Silence reads
as oversight; a declaration reads as a boundary.

**Source:** product-ux #4.
**Partial exception:** timing tells have a ticket — **WS-253, `backlog`, open 48
days**, the oldest unshipped item touching this document. The Tier E row already
notes it has *"zero doctrinal grounding."* Declaring the boundary is what makes
that ticket's premise reviewable.

### H3. LIVE RAKE IS NOT ONLINE-2009 RAKE
**Declaration:** The rake *numbers* derivable from the corpus are not transferable
to the founder's game. Any rake-conditioned figure sourced from HandHQ is
**transferred, not measured**, and must say so.
**Source:** failure-engineer #5 (the transfer half; the derivable half is F8).

### H4. FOUNDER-ESTIMATE-LIVE AND CORPUS-MEASURED-ONLINE ARE NOT MARKED APART IN §2–§5
**Declaration and structural gap in one.** The repo's fault register ranks this
first overall: the founder's game is **live 9-handed 1/2–1/3** and the corpus is
**online 2009**, so any live claim anchored on the corpus is *transferred, not
measured*. **The code enforces this via `segmentKey`. The document's structure does
not.** §2–§5 prose mixes founder-estimated live figures and corpus-measured online
figures with no structural marker, which is a standing **silent-promotion risk**:
a transferred number becomes a measured one simply by being quoted.

**Source:** systems-architect (dangerous assumptions), corroborated by
failure-engineer's §2.3 stake-ceiling instance (F9's companion defect).

**Related, and cheap:** `§FSA` is cited four times (`:2285`, `:2303`, `:2333`,
`:2400-2401`) as an internal reference but is defined only in `docs/adr/ADR-009` —
**unverifiable from POKER_THEORY.md alone**. One cross-reference fixes it.

**Proposed placement:** a provenance marker convention applied across §2–§5, and
the standing declaration at the head of §2.

---

## FORCED RESOLUTION — the top 5 of run-001

Weighed on independent convergence × cheapness of settlement × money at the table.

| # | Item | Why this one |
|---|---|---|
| **1** | **F2 — thoughtCatalog: 19 production cognitive labels with no theory** | A fifth signal class runs in the live pipeline directly above a hierarchy the doc declares exhaustive ("pick ONE per adjustment"), so either §7.4 is wrong or the labels are decorative — and the same harness that settles it also tells you which. |
| **2** | **F1 — hero blocker/bluff-selection doctrine** ⇄ | Two lenses reached it from opposite directions, `blockerScore` already exists with "no EV path," and §13 — the doc's own bluff-selection section — has zero blocker mentions; the corpus design is already written. |
| **3** | **F3 — the two percentile bases** | The single cheapest settleable claim in either run: pure computation over 169 classes, no corpus, no sweep, no engine run — and it tests whether the doc's declared cross-board coordinate is the one the priors actually use. |
| **4** | **G1 — compute-budget / decision-clock doctrine** ⇄ | Four lenses converged from two independent evidence chains on a live defect with money attached: identical game state returns different advice under CPU load, which is §7.1's own axiom violated by the architecture the axiom governs. |
| **5** | **F4 — "100% everywhere" vs 94% vs 88–94%** | The WS-291 mechanism reproducing *inside the section written to record WS-291's fix*, settled by one re-measure that the doc at `:1972` already instructs someone to perform. |

**Runner-up, deliberately named:** **F6 (`pipCalculator`'s "GTO" baseline)** — it
settles in a single file read and its two possible answers have opposite
consequences for a named Key Concept. It is out of the top 5 only because its
worst case is a naming defect, not a wrong number in production.

**On the cross-critique's nomination.** The cross-critique nominated
senior-engineer's thoughtCatalog finding as "arguably the single most consequential
item of the run." **I CONCUR, and rank it #1** — with the magnitude corrected from
64 to 19 (see F2). The correction *lowers the count and does not lower the rank*:
the consequence lives in the structural relationship to §7.4, not in the size of
the catalog. Nineteen undocumented labels feeding production advice is the finding;
sixty-four would merely have been more of it.

---

## Unfalsified completeness claims — consolidated

Every claim in the document that asserts completeness, universality, or
correctness without stating what would falsify it. Deduped across all six lenses
and across both runs.

| # | Claim | Where | Lens(es) | Corpus-settleable? |
|---|---|---|---|---|
| U1 | §11.9: *"coverage is 100% everywhere — the floor guarantees it"* vs `~94% flat`, `93%` facing a raise, and `~88–94%` | `:1969` vs `:468`, `:469`, `:496` | senior | **No — code re-measure** (and `:1972` already orders it) |
| U2 | §7.4's four-tier adjustment hierarchy is exhaustive ("pick ONE") | `:851-874` | senior | **Yes** — falsifier: an adjustment path not traceable to the four tiers; `thoughtAnalysis` is the standing candidate |
| U3 | §15.4: percentile is **the** cross-board coordinate, vs §2.3's `EQUITY_VS_OPEN` basis and §16.2's `f = S·w` | `:2358`, `:2368-2399` vs `:191` | architect | **Pure computation** — cheapest on this table |
| U4 | §14.1: "per 100 hands" is the universal currency, vs §2.5.4's two decision points per hand | `:2252+`, `:2264+` vs `:287-293` | architect | **Code-checkable** (`subActionExtractor.js` call sites) |
| U5 | §6 preamble: card removal *"UNMEASURED as of 2026-07-26"* — §11.4 measured part of it | §6 preamble vs `:1404-1490` | architect | **Doc read** |
| U6 | §3.4 heading says "Four Motivations"; body names five including inducing | `:329` vs `:349` | senior, failure (= D1) | **No — one-line doc edit** |
| U7 | §4.2 bluff-catcher: *"beats all bluffs, loses to all value"* — no falsifier, and **14 consuming files under `src/`** | §4.2 (= D2) | senior, failure | **Partially** — the continuum is measurable |
| U8 | §8 "Common Mistakes" is implicitly exhaustive and explicitly open-ended; also **all 14 are analytical** | §8 (= D3) | failure, product-ux | **No — doc edit + scope marker** |
| U9 | **§11.1b, §11.1c and §12–§16 were never inventoried at all** | `:1231-2663` | failure #7 | **Yes — re-run mechanism 2.** See callout below |
| U10 | *"River decisions are fully corrected"* — was **false for 11 weeks** (riverPerCombo bypass, WS-378 still `backlog`); fix recorded, no anti-recurrence protocol | `:2081-2082` | performance | **Yes — code test** asserting `riverPerCombo` routes through `villainDecisionEquity` |
| U11 | The §2.1/§11.4 seat-by-seat pipeline completes before hero must act; `~4ms` is desktop-implied, mobile unmeasured | `:1472-1476` | performance | **No — needs a mobile measurement** |
| U12 | §12.5's level-2 stop *"adds cost and error for no signal"* — cost half and signal half never disentangled, so unfalsifiable on **both** axes | `:2057-2067` | performance | **No — needs the two arms separated first** |
| U13 | §2.1: hero *"usually knows who is behind"*; §11.2's implied graceful manual-entry fallback | §2.1, §11.2 | product-ux | **Yes — code-checkable** |
| U14 | *"Live low-stakes opponents don't observe"* — population-asserted, never per-villain measured; licenses unbounded unbalanced play with no override | §5.4, §12.4 | security | **No — prediction ledger** |
| U15 | Villain stats are stationary (Beta-Binomial, time-invariant, no within-session decay) — never stated as an assumption | §6.5a | security, failure (= B3) | **Partially** — HandHQ has timestamps; within-session shift is measurable |
| U16 | Showdown observations are honest — never stated as an assumption | §5.9 `:675-691` | security | **No — prediction ledger** |
| U17 | §12.4's bluff:value ratio table — a memorizable teachable rule that never went through §11.9's POOL/EVAL + leakage + same-metric discipline | `:2044-2049` | performance | **Yes** |
| U18 | §13.4's `s/(1+s)` vs `s/(1+2s)` — the engine **once shipped this conflation** (§13.3 item 3); prose disambiguation only, no mnemonic, no scored guard against recurrence | `:2200-2205` | performance | **Yes — regression test** |
| U19 | §2.5.3's hierarchical shrinkage formula has no 3–5-number teachable form | `:253-259` | performance | **Yes** |
| U20 | §6.4's multiway threshold `0.5^(1/k)` — exact math, no rounded human lookup (2≈71%, 3≈79%, 4≈84%), and no falsifier for whether a live estimate of `k` is reliable enough to matter | `:756` | performance | **Partially** |
| ✅ P1 | **POSITIVE CONTROL** — §11.4's mean-field card-removal approximation: *"inside sampling error"*, **stated AND priced in ms with a degradation path** | `:1468-1476`, `:1487-1490` | performance | *This is what a priced approximation looks like; the pattern appears nowhere else in the doc* |
| ✅ P2 | **POSITIVE CONTROL** — §11.1a's fold curve: founder-estimate 0.45 base, online-2009 shape, **conditioning set stated** | §11.1a | failure | *This is what §1.5 and §2.3 should look like* |

---

## CHEAPEST ACTION OF THE RUN — re-run the exhaustiveness inventory

**Do this before anything else in this document.**

Mechanism 2's exhaustiveness inventory was built on **2026-07-26**. Since then the
document grew §11.1b, §11.1c, and §12–§16. **That span — `POKER_THEORY.md:1231`
(§11.1b, "A fitted curve has an AXIS and an ANCHOR") through `:2663` (end of §16)
— has never been swept for exhaustiveness claims at all.**

> **Facilitator quantity correction.** failure-engineer reported the unswept
> portion as **"~45% of the doc."** By line span it is **1,433 of 2,663 lines =
> 54%.** The 45% figure may be measured by content added since a date rather than
> by span; I could not reproduce it, so **quote 54% by span**. Both figures
> support the identical action — this is recorded because an unreproduced quantity
> should not travel silently, not because it changes the decision.

**Why this is the highest leverage per unit effort in the entire file:** the
sections nobody has inventoried are the sections carrying the run's two most
consequential unfalsified claims (U1 in §11.9, U3 in §15.4) and the doc's newest,
least-reviewed doctrine (§12, §13, §16). **This is the exact mechanism that let
§3.4 sit falsified** — an inventory that stops being re-run stops being an
inventory and becomes a snapshot nobody dates.

It is a re-run of an existing mechanism over a known line range. No new
instrument, no corpus job, no founder decision required beyond "yes."

**Second-cheapest, same shape:** F11's finding that dated *"unmeasured as of"*
markers have **no revisit mechanism**. The inventory re-run and the marker sweep
should be one pass, not two.

---

## NOT EXAMINED THIS RUN — declared, not implied

All six lenses read POKER_THEORY.md in full. These were nonetheless not audited by
anyone, and their absence from Tiers F–H is **not** evidence of health:

- **§16 — "The Equity Operator Is Antisymmetric, and Its Cycles Are Measurable"
  (`:2507-2663`, WS-337, `backlog`).** Referenced in passing by the architect for
  its `f = S·w` definition (U3) and by nobody else. §16 is the newest doctrine in
  the file and closes with its own admission that an estimation claim "has not
  been run." **Highest-priority target for the next run.**
- **`POKER_AXIOMS.md` (413 lines).** POKER_THEORY.md defers to it explicitly at
  `:809` — *"The forces this section defers to are enumerated in POKER_AXIOMS.md"*
  — and **that is the only reference to it in the entire document**. No lens
  examined whether the axioms and the theory agree, or whether §7 actually defers
  to what the axioms say. A one-file deferral with one inbound link is exactly the
  shape that goes stale unobserved.
- **§10 — Tournament Theory & ICM (`:1061-1137`).** Zero lens coverage. The ICM
  work shipped in 2026-06; nothing checked whether §10 tracks it.
- **§9 — Documented Divergences (`:977-1060`).** Cited as a *model* for how to
  state a boundary (H2) but never audited for whether its own divergences are
  current — and `:997`/`:1021` show it makes live solver-vs-pool claims that are
  themselves transferable-number risks (H4).

---

## Founder decisions needed

Carried forward from 2026-07-26, with run-001's additions marked **[new]**.

1. Promote / reject each of A1–A3 (all three have data behind them).
2. ~~A3 needs one `--sweep` run~~ — **done 2026-07-26; A3 is settled and its
   subtractive fix plus the ladder-guard note are still unpromoted.** Confirm.
3. B1–B4 are already ticketed; confirm the *doc* sections are wanted, not just
   the features. **[updated] B2 is now doc-closed by §12 — but verify the
   `perceivedHeroRange` inert-capability residual before closing it.**
4. C is a coverage list, not a recommendation. Which, if any, are in scope?
   **[updated] three C rows have been sharpened into specific defects (F6, F9,
   G2); "blind defense" remains untouched by both runs.**
5. D1–D3 are small doc edits with no code impact — cheapest promotions here.
   **[updated] re-rank D2 above D1/D3 — it is load-bearing in 14 source files, not
   pedagogy.**
6. **Tier E is the largest and most actionable block.** Two rows are arguably
   defects in POKER_THEORY *as it stands today*, independent of whether the
   ticket ever ships: **§1.4** (realization-as-lookup contradicts §7) and
   **§2.3/§6.5a** (the doc's "3-bet" and the `foldTo3Bet` stat share a name but
   not a definition — 78–86% measured vs ~49.9% true). Those two are worth
   promoting ahead of their tickets.
   **[new] A third row now owes a doc edit outright: WS-274 is `done`, so §2.1's
   demotion to presentation-default is due.**
7. Cadence: should `theory_completeness` be tied to queue throughput rather than
   the 90-day calendar? Every closed domain-correctness ticket is a candidate doc
   edit, and Tier E suggests the doc falls behind the code faster than 90 days.
   **[new] run-001 evidences this: three Tier E tickets closed in twelve days and
   each owes an unmade doc edit.**
8. **[new] Approve the cheapest action** — re-run the exhaustiveness inventory
   over `:1231-2663` (54% of the document, never swept), combined with the
   stale-marker sweep. One yes.
9. **[new] Approve or reject the four Tier H declarations.** These are not tickets
   and will never be closed by work; they are standing statements of what the
   instrument cannot see, written in the §15.3.1 "LIVE IS UNMET" register. H1
   (straddle) and H4 (live/online provenance not structurally marked) are the two
   with money attached.
10. **[new] Rule on the top-5 order.** #1–#3 and #5 are settleable this week;
    **#4 (G1) is the one where the improvement default bites** — the correct
    resolution is to remove the compute non-determinism, not to document it, and
    documenting it is the interim only.

---

## Run manifest

```
run:                  run-001
date:                 2026-08-07
protocol:             theory_completeness
program:              prog-domain-correctness (pulse protocol run)
engine:               eng-engine — 6 personas + facilitator
personas:             systems-architect, senior-engineer, failure-engineer,
                      performance-engineer, security-engineer, product-ux-engineer
phases:               1 independent analysis · 2 cross-critique · 3 synthesis · 4 draft
orchestrator session: ses-20260807-0535-df53cf18
repo:                 claude-poker-tracker @ HEAD 18f49f22
subject:              .claude/context/POKER_THEORY.md v2.3 (2,663 lines)
doc coverage:         all six personas read the document IN FULL
admissible sources:   corpus (HandHQ online 2009), repo code, SYSTEM_MODEL.md,
                      exploitEngine/rangeEngine CLAUDE.md, prediction ledger
NOT admissible:       solver / GTO output as an arbiter of correctness
                      (§9 divergences are recorded, never used to settle a claim)
ordering rule:        corpus/code-settleable → measurement-needed →
                      permanent-blind-spot declaration
dedupe basis:         docs/domain/theory-gaps.draft.md Tiers A–E (2026-07-26)
                      + .claude/workstream/queue/ at HEAD
deliverable:          this draft only — no findings filed, POKER_THEORY.md unedited
```

### Dedupe log (Phase 2 cross-critique, applied)

| Action | Detail |
|---|---|
| **DEDUPED** | product-ux #2 (session-level doctrine) → folded into **B1 / WS-280**, reported once as an aging-known gap. Presenting it as a new absence was an inheritance failure; the gap is 12 days old and ticketed. |
| **MERGED** | security's "minimum sample before ACTING" + product-ux #5 "sample size at live speed" → single candidate **G3** with both faces (action threshold + live-volume calibration). |
| **DEDUPED** | failure #2 (non-stationarity) → **B3 / WS-275**, carried with its own correct aging-known framing plus two run-001 sharpenings. |
| **RANKING TENSION RESOLVED** | security argued non-settleable items should rank first. **Resolved in the protocol's favour** — Tier F precedes Tier G. Ordering is a settlement-sequencing claim, not an importance claim; G2 is nonetheless top-5 on consequence. |
| **FRAME vs FINDING** | performance's "rules with no scoring path" frame was **seeded by the brief** and is not an independent discovery. Its four instances (U17–U20) are new and file-anchored and are **kept**. Same treatment applied to the WS-423, §11.9-discipline, and fear-doctrine seeds. |
| **FACILITATOR OVERRULE** | The cross-critique ruled `:410` unconfirmed and `:551` the sole blocker mention. **Overruled** — `:410` is confirmed, and `:997`/`:1021` exist as well. Four mentions, none hero-side. The architect's count was correct. |
| **FACILITATOR CORRECTION** | senior-engineer's thoughtCatalog count of **64 → actual 19** (85 signature signals, 19 `predicts` blocks). Finding upheld and ranked #1; magnitude corrected. |
| **FACILITATOR CORRECTION** | failure-engineer's unswept-doc figure **~45% → 54% by line span** (`:1231-2663` = 1,433 / 2,663). Action unchanged. |
| **BLIND SPOT DECLARED** | §16, `POKER_AXIOMS.md`, §10, and §9's currency were **not examined by any lens** this run. Listed above rather than left silent. |
