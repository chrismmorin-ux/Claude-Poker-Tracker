# Gate 2 Blind-Spot Roundtable — Post-Session Review

**Date:** 2026-08-21
**Trigger:** Gate 1 RED (`2026-08-21-entry-post-session-review.md`)
**Execution:** three agents dispatched independently per `ROUNDTABLES.md:26` — product-ux-engineer (Stages A/C), general-purpose + fresh-context external lens (Stage B), senior-engineer (Stages D/E). Briefs stated the prior verdict **as the thing to refute**, not as the founder's claim.

---

## Feature summary

A post-session review that criticises hero's play. Prices each hero postflop decision in bb against **Pool Best Response** — the max-EV response to the field's *measured* behaviour, deliberately not a solver. Builds Conduct Cards for hero and each opponent. Three named jobs: study a hand, catch missed opportunities, absorb table-level learning.

---

## Stage A — Persona sufficiency — ⚠️ Patch needed

Job 1 maps cleanly to `post-session-chris`; its own "Density is acceptable — this persona can absorb it" anticipates dense per-decision pricing.

**Job 2 collides with a persona-level invariant.** Red line #5 (`chris-live-player.md`): *"No streaks, shame, or engagement-pressure notifications or visual pressure."* The program has already ruled on a structurally identical push/pull question and ruled **against push**: `self-coach-view.md` deferred its cadence-reminder toggle because *"nudging the user to study would violate the spirit of autonomy red line #5."*

So job 2 is not "author a persona and proceed." The doctrinal question — push, or the `CC-83` passive-surfacing pattern (*"no push notifications, no badge counter, refresh is always a button, never a nag"*) — **precedes** persona authorship and is a founder decision.

**Priced criticism is a new register.** `CO-54` targets leak-frequency observations *"without ego cost"*, enforced by copy-discipline tests banning `wrong|missed|score|great job`. A **bb-denominated verdict on one decision** reads harder than a frequency, and nothing models that difference.

## Stage B — JTBD coverage — ❌ Domain missing

**The atlas has no unit of analysis above the hand.** The session and the table exist only as filters. Confirmed by independent fresh-context grep: zero hits across `jtbd/` for `table dynamic`, `table composition`, `lineup`, `session-level`, `table select`, `session summary`, `debrief`, `never acted`, `missed opportunity`, `takeaway`.

**`SE-02` is job 2, and it cannot fire.** Its success criterion is verbatim *"for each flagged pattern, did it fire, how many times, did hero catch it, what was the EV impact."* Its trigger is *"a session that I prepared for"*, rows keyed to *"villains I expect to face."* Under `cold-read-regime.md` the founder has usually never seen them. **The one JTBD covering job 2 is gated on a precondition the regime forbids.**

**Job 2 is also structurally impossible in the code as built.** `priceDecisionAt` requires `observedAction` and rejects with `ACTION_NOT_IN_RESPONSE_SET` otherwise. It is a decision-pricer; it cannot price a spot hero never entered. Job 2 needs a different instrument, not a parameter.

### Proposed entries (Gate 3 to ratify; verify ID space against the legacy 87–90 block)

| ID | Title |
|---|---|
| `SR-90` | Be shown the exploitable spots I left on the table tonight — **including ones I was never in** |
| `SR-91` | Read the table I sat at as a review object — who was there, how it changed, what it did to me |
| `SR-92` | A session census of my own play, with the comparisons it cannot support **named** |
| `SR-93` | Turn tonight's one-session read into something that **survives the villain being gone** |
| `CC-94` | Know which yardstick a number was measured against, and on what population |

`SR-91` and `SR-93` are load-bearing — the two the founder named with no near-neighbour. `SR-93` is the review-side counterpart of `WS-581`: `SE-01` *consumes* a transferable pattern and nothing *produces* one. `CC-94` has doctrine (`corpus-transfer-is-earned.md`) and a live bug (`WS-415`) behind it.

## Stage C — Situational stress — ⚠️/❌

1. **16 of 18 sessions produce no card.** Precedent exists and is unapplied: `ReviewEmptyState.jsx` from `session-review-anchor-rollup.md`, whose non-goals already forbid grading language. Refusal must be *named, never silent* per `sparsity-refuse-or-shrink.md`. **Adjust.**
2. **21.6% priced, 79% silent.** Unpriced decisions currently produce **no row at all**, so a non-technical user cannot distinguish "no row because fine" from "no row because never evaluated" and will read silence as approval. **Requirement: every hero decision renders a state** — priced / unpriced-preflop / unpriced-thin — never an omitted row. **Leaning ❌.**
3. **An alert from a 12-hand read.** Under cold read this is near-modal, not an edge case. Data layer already refuses correctly. Open question: when an alert *does* clear the floor, the confidence must be **co-located with the alert text**, not one tap deeper. **Adjust.**
4. **Founder disagreement — ❌.** `SR-26` reads verbatim *"so the model learns."* `.claude/rules/founder-read-detects-site-not-direction.md` (ratified 2026-08-20, after SR-26) says *"No path exists from a recorded divergence to a parameter change without a re-derivation in between."* SR-26's own rationale is the shape the rule forbids, and **no JTBD implements the bidirectional divergence scoring the rule requires.**

## Stage D — Cross-product / cross-surface — ❌ Scope was wrong

1. **Reachable from one machine.** `serve.mjs:67` binds `127.0.0.1`; `grep` finds zero references to the sink, the review, or port 8791 in `src/`. The S22 cannot reach it.
2. **No ticket closes that** — which under `surfaces-reach-the-table.md`'s own test makes it a **gap, not a deferral**.
3. **The app can disagree with itself about a villain and nothing notices.** The sidebar renders `advice.villainProfile`/`villainStyle` live; the Conduct Card is induced by a separate pipeline keyed `seat{N}#s{segment}`. No shared identity, no reconciliation. `founder-read-detects-site-not-direction.md` covers *founder* disagreement — nothing covers **the app disagreeing with itself**.
4. **`artifact-location.md` compliance is currently untested** — "unreachable must be an error, never a fallback" binds a consumer, and no app-side consumer exists yet.

### The aggregation defect, sharpened

The session total is not "double counting" — it is **naive on-trajectory summation where backward induction is required**. From the real 4-decision hand `4897498850`:

```
flop pot=10 facing=0     check → best bet    +6.32
flop pot=16 facing=6     call  → best raise  +13.40  ← exists only because decision 1 was a check
turn pot=28 facing=0     check → best bet    +22.79
turn pot=28 facing=19.96 fold  → best raise  +44.58  ← exists only because decision 3 was a check
                                              ─────
                                              87.09
```

Had hero bet the flop, decision 2 never occurs. **61 of 64 priced decisions across the whole corpus sit in such a hand.**

**And it is not confined to the total.** `summarize()` buckets `byStreet`/`byAction` by key match with no hand-awareness — verified by execution: two branch-exclusive decisions summed into `byStreet.flop = 19.72bb`. **Every aggregate except the bare per-decision list inherits the defect.** The per-decision numbers themselves are valid local-regret statements at states that genuinely occurred.

## Stage E — Heuristic pre-check — ⚠️

1. **H-N01 violated, verified by execution.** `renderSessionReview.mjs:152` renders the literal string `<p>Priced.</p>` on success. **Job 2 has no UI once its backend succeeds**, and the path has never been exercised because all 18 sessions currently refuse. This is the `shipped-but-inert-capability` failure mode by name.
2. **H-N06 violated.** `buildDossier()` produces the full withhold-nothing narrative, `rankHands()` attaches it to every notable hand, and the renderer **never reads `dossier.text`**. Job 1 is unserved by the page the dossier lives on.
3. **H-N03 minor.** No back-link from a review to the `/reviews` index.
4. **Clean, stated plainly:** refusal blocks are a genuinely good H-N09 implementation — every refusal names its reason *and what would resolve it*. Dark-mode and `overflow-x` handling show H-PLT03/H-ML05 were considered. Zero interactive controls, so error-prevention heuristics don't apply.
5. **Scale-factor heuristics don't bind today** because the page is outside the canvas system — and stop being irrelevant the moment Stage D finding 1 is fixed.

---

## A false claim was found in shipped code and corrected

`priceHeroDecisions.mjs` asserted the priced fold was something *"no corpus arm and no commercial tracker will ever show him."* **The second half is false.** GTO Wizard's Hand History Analyzer prices folds explicitly. The error was a category error: the HandHQ corpus masks cards because it is third-party datamined; a player's own history never masked their own cards.

**What survives and is still a real differentiator:** (1) everyone who prices a fold prices it against a *solver's* model of villain's range — this prices against the field's *measured* behaviour, and no counterexample was found; (2) GTO Wizard skips multiway postflop, which at 9-handed live is a large share of the hands that matter.

Corrected in place with the error recorded, not deleted.

## The bill for refusing the solver, stated honestly

Recorded because the refusal is a founder ruling and its cost was never written down.

- **External reproducibility is forfeited permanently.** A solver output is a function of (tree, rake, stacks, sizings); a Pool-BR number is a function of *your measurement of your field*. ADR-009 makes replicability load-bearing; internal replication survives, external does not.
- **No unconditional "that was a mistake."** Every claim becomes field-indexed and expires when the field moves.
- **The baseline degrades toward the river** — where the money is — because thin cells refuse. Published single-stat thresholds run ~100 hands for flop c-bet to ~1,000 for fold-to-river-c-bet. A live 9-handed review will refuse a lot of river spots. **Size this before it is discovered in use.**
- **No shared vocabulary.** `NAMING-HISTORY.md` already records what minting terms costs here.

**What the refusal buys, and it is more than expected:** GTO Wizard's own opponent model ("Profiles") is **hand-authored constants** — *"+4% pot incentive to call, −6% to check"* — with no population statistics, no sample sizes and no empirical validation cited. Node-locking, the industry's fix for solver-vs-real-field, is conceded weak by the vendor itself (*"the adjustment happens on a different part of the game tree than you expected"*). PT4/HM3/DriveHUD cannot price *any* decision; PT4's "All-in EV" was renamed *All-in Equity Adjusted Winnings* because it misled, and it **excludes folds by design**. A tracker benchmark that a 20,000-hand losing player satisfied all-green is on record, with the vendor conceding *"only a guide."*

**The strongest argument against a total refusal:** Poker Detox's pool-first methodology used *"PIO solver **along with** mass data population analysis."* Solver as coordinate system, pool data as deviation. Per `.claude/rules/unmeasured-constants.md`, "run both arms and report the delta" is already this repo's ruling for this shape of question. **Founder decision, presented with cost — not a recommendation.**

## Market whitespace, confirmed by negative result

A fresh-context search across PT4, HM3, GTO Wizard, DriveHUD, Hand2Note and Leak Buster found **no tool producing session- or table-level strategic narrative**. The unit of analysis in the entire market is the decision node; the second unit is the aggregate over a database. **`SR-91` is genuine whitespace, and job 3 is the least-served of the three jobs by the entire market.**

Two facts that should change assumptions:
- **Live capture → solver review already exists** (LiveSolver et al. emit PokerStars-format histories straight into GTO Wizard). The differentiator is the baseline and the unit, **not the capture**.
- **On Ignition, every villain's folded holdings are reportedly available** in the 24h download. If true, that is a richer per-session record than a PokerStars player gets, and close to the ideal input for `WS-581`. **Verify primarily, then file.**

---

## Overall verdict

**YELLOW → Gate 3 required**, scope = patch the specific gaps. Not RED: job 1 is genuinely covered and the instrument's data-layer refusals are already correct doctrine. Not GREEN: two of three jobs have no home, one of them collides with a persona-level red line, and an existing JTBD contradicts a binding rule.

## Required follow-ups

**Correctness — ahead of everything else**
- [ ] **Feed a line-conditioned villain model.** `heroPolicyAt` defaults to `villainSource = NULL`; narrowing removes ~29% of range *mass* and **zero hand classes** on a third barrel. Measured on hand `4897498850`: engine used 68.2% where a value-heavy barrel range gives **17.9%** — higher than the most bluff-heavy range constructible. Every big-pot verdict is biased toward "you should have called."
- [ ] **Fix aggregation** — backward induction per hand, or first-priced-decision-only as a *labelled interim*. Until then `evLeftBB`/`byStreet`/`byAction` refuse or carry a structural flag.
- [ ] **Price preflop** — 54% of hero decisions, and where a tight live player's missed opportunities concentrate.

**Design**
- [ ] Founder decision: **push vs `CC-83` passive surfacing** for job 2 (red line #5).
- [ ] Founder decision: **solver as a second arm** per `unmeasured-constants.md`, or continued total refusal.
- [ ] Resolve `SE-02`'s cold-read block — amend, or author `SR-90` as the un-prepared sibling. Not both.
- [ ] Every hero decision renders a state; no omitted rows.
- [ ] Wire `dossier.text` into the page; implement the money card body.
- [ ] Reconcile sidebar villain read vs Conduct Card, or document why they need not agree.
- [ ] Ticket the review reaching `SessionsView` / sidebar (`surfaces-reach-the-table.md`).

**Hygiene**
- [ ] `DS-69` ID collision; `DS-68`/`DS-69`/`CC-90..93` unregistered in ATLAS.
- [ ] `personas/situational/pre-session-scouting.md` referenced by two core personas, never authored.
- [ ] `post-session-chris.md` §Related JTBD is still a placeholder.
- [ ] `session-review-anchor-rollup.md` already owns an auto-open-post-cashout route this feature did not consult.
