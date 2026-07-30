# Theory gaps — candidate ADDITIONS to POKER_THEORY.md

**DRAFT — awaiting founder review.** Nothing here is in POKER_THEORY.md and
nothing here is in the work queue. Promote by moving an entry into the doc, or
reject it inline.

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

---

## Tier B — real gaps, not yet arbitrable

### B1. Table and seat selection is absent entirely
The largest $/hour lever in live poker — which game to sit in, which seat, when
to leave — has no section. The doc optimizes decisions *within* a hand and is
silent on the decision that dominates hourly rate. Already filed as WS-280;
noting it here because the **doc gap** is separate from the feature gap.

### B2. No account of hero's own strategy or perceived range
The doc models villain ranges extensively and hero's hand-state (§HSP), but has
no section on what villain thinks HERO holds. Every bluff-frequency and
balance claim implicitly assumes villain reads hero correctly. Filed as WS-276.

### B3. Non-stationarity is not addressed
§6.5a's hierarchy treats a villain's stats as a stationary quantity to be
estimated. Real players tilt, adjust, and change gears. The doc has no concept of
recency weighting or regime change. Filed as WS-275.

### B4. Multiway bluff-catching with players behind
§4.2 now carries this as an explicit known gap with a pointer to WS-282 (added
2026-07-26 by WS-277). Listed here so the completeness inventory stays complete.

---

## Tier C — coaching-taxonomy coverage gaps (first pass, least complete)

Topics a standard live-cash curriculum covers that POKER_THEORY.md has no section
for. **Coverage signal only — presence on this list is not an argument that the
topic belongs.**

- **Stack-depth-conditional preflop strategy.** §2 opening ranges are stated
  without reference to effective stack; 40bb and 200bb play differently.
- **Blind defense as a distinct discipline.** Referenced in passing
  (`blindDefendMax`) but no section.
- **Multi-street planning / line construction.** The engine does depth-2/3
  planning; the doc has no theory section describing what a *line* is or how to
  construct one.
- **Table dynamics and meta-game.** Recent history between two specific players
  changes both ranges. Named in the challenge protocol's prompt as something the
  engine ignores; no doc section.
- **Variance, bankroll, and stop-loss discipline.** Adjacent to strategy rather
  than part of it — plausibly out of scope by design, but the doc should say so.

---

## Tier D — defects in the doc's own completeness claims

From mechanism 2. Full inventory in the protocol doc.

### D1. §3.4 reasserts exhaustiveness in the same voice that was already wrong
The four-motive taxonomy was falsified once (protection was missing until
WS-278). It now says four-plus-inducing in the same confident register. It should
carry an explicit marker that this list has been incomplete before.

### D2. §4.2's bluff-catcher definition has no falsifier
*"A hand that beats all bluffs and loses to all value hands"* defines an
idealized category; real hands sit on a continuum. Fine as pedagogy, dangerous as
a modelling assumption, and the doc does not distinguish the two uses.

### D3. §8 is implicitly exhaustive and explicitly open-ended
"Common Mistakes This Document Prevents" is an accumulating list, not a closed
set. It should say so, so no reader treats absence from it as evidence of
correctness.

---

## Tier E — queued work that will make a POKER_THEORY section WRONG

Added 2026-07-26 after the founder observed the first draft "omits a lot of the
improvements we have queued up that might affect the theory." Correct. Mechanism 3
(internal-tension sweep) was added to the protocol and run against the open
`prog-domain-correctness` queue.

The question asked of each ticket is **not** "which section does this implement" —
it is **"which section does shipping this make wrong?"** Every row below is a
place the doc currently argues with itself, or with the code, *today*.

| Ticket | Section it breaks | The tension, stated |
|---|---|---|
| **WS-279** equity realization | **§1.4** | §1.4 states realization as a **lookup** ("suited realize better than offsuit", position/SPR/texture factors). §7.1/§7.5 say derive from game state and never use labels as inputs. These are already contradictory; the ticket resolves it toward §7. **§1.4 must be rewritten when it ships, and is arguably wrong now.** |
| **WS-274** preflop from table composition *(in flight, other session)* | **§2.1** | §2.1 keys opening ranges on position **labels**. §7.2 says position labels are proxies, never causes. The ticket replaces `POSITIONAL_FOLD_TO_3BET` with fold equity computed against the players actually behind. §2.1 becomes a *presentation* default, not doctrine. |
| **WS-254** foldTo3Bet definition | **§2.3, §6.5a** | The doc's "3-bet" is a poker concept; the code's `foldTo3Bet` stat counts **any preflop fold facing a raise, including fold-to-open** — measured 78–86% in the corpus vs a true ~49.9%. §6.5a lists `foldTo3Bet` among the six priors without ever saying what it measures. **The doc and the stat share a name and not a definition.** |
| **WS-255** limp-reraise ≠ 3-bet | **§2.2, §2.5** | `threeBet` fixes `facedRaise` at first action, so a limp-reraise is not counted. §2.5's derived taxonomy names limpReraise as a distinct class; the scalar stat predates it and disagrees. |
| **WS-275** non-stationarity | **§6.5a** | The whole four-tier hierarchy treats a villain's stats as a **stationary** quantity to be estimated ever more precisely. Players tilt, adjust, change gears. §6.5a has no time dimension at all — not "handles it badly", *absent*. |
| **WS-276** hero / perceived range | **§4.2, §5.4** | Every balance and bluff-frequency statement implicitly assumes villain reads hero's range correctly. There is no §  for what villain *thinks* hero holds, which is the level-2 gap. |
| **WS-265** bluff triggers | **§3.4, §6.3** | §6.3 gives the breakeven fold rate — *whether* a bluff is profitable. Nothing says **when to bluff**: no trigger taxonomy, no account of which spots generate the river-air frequency the Field frame measured at 4–7%. |
| **WS-264** mining pass 2 | **§3.5, new** | Brings a **concealment premium** / perceived-range factor with no doc home; pairs with WS-276. |
| **WS-252** sizing tells → thresholds | **§3.5** | §3.5 says the sizing↔range-shape mapping "is NOT deterministic" and "must be validated by showdown data" — correctly cautious. Wiring correlation into live bluff-catch thresholds is exactly the step §3.5 warns about; the doc needs to state the gating conditions under which it becomes admissible. |
| **WS-253** timing tells | **absent** | Time-to-act is not mentioned anywhere in POKER_THEORY. A data-model change with zero doctrinal grounding. |
| **WS-270** 4-bet tree | **§2 (absent)** | §2 covers opens, limps, 3-bets, squeezes. **There is no 4-bet section.** The third preflop scenario has no theory. |
| **WS-283** fold curve | **§11.1, §6.3** | Already Tier A1 — listed here so the queue walk is complete. |
| **WS-281 / WS-282** | **§6 preamble, §4.2** | Already referenced by name from those sections (WS-277). Closing either forces a doc edit. |

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

---

## Founder decisions needed

1. Promote / reject each of A1–A3 (all three have data behind them).
2. **A3 needs one `--sweep` run** before it can be promoted or deleted — ~30 min
   of compute, no decision required beyond "yes, run it."
3. B1–B4 are already ticketed; confirm the *doc* sections are wanted, not just
   the features.
4. C is a coverage list, not a recommendation. Which, if any, are in scope?
5. D1–D3 are small doc edits with no code impact — cheapest promotions here.
6. **Tier E is the largest and most actionable block.** Two rows are arguably
   defects in POKER_THEORY *as it stands today*, independent of whether the
   ticket ever ships: **§1.4** (realization-as-lookup contradicts §7) and
   **§2.3/§6.5a** (the doc's "3-bet" and the `foldTo3Bet` stat share a name but
   not a definition — 78–86% measured vs ~49.9% true). Those two are worth
   promoting ahead of their tickets.
7. Cadence: should `theory_completeness` be tied to queue throughput rather than
   the 90-day calendar? Every closed domain-correctness ticket is a candidate doc
   edit, and Tier E suggests the doc falls behind the code faster than 90 days.
