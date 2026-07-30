# Project — De-risking, Bankroll, and the Objective Function

**Established** 2026-07-28 · **Program** domain-correctness · **Status** chartered, not started
**Relation to the readiness gate (WS-286):** Phase 0 is gate-relevant and runs now. Phases 1–3 are
post-gate by default; see *Sequencing* below.

---

## The claim

The engine maximizes **expected chips**. It should maximize **expected utility of money**.

Everything the founder named — high variance, high misread potential, high chance of hero
playing it wrong — is a term that falls out of that one substitution. They are not four features.
They are four channels into a single integral the engine currently evaluates at a point.

The repo already contains the correct template. POKER_THEORY §10.1 establishes that a chip is not
a dollar in tournaments, and `icmEngine/riskPremium.js` implements the correction as a derived
per-spot quantity that is identity when there is no pressure. This project generalizes that from
"the payout ladder makes money non-linear" to "**being able to lose it makes money non-linear**",
of which the payout ladder is one cause and a finite bankroll is another.

---

## What exists today

| Concern | Status | Evidence |
|---|---|---|
| Outcome variance | **Measured, never priced** | `riskAnalysis.js:9` — *"Risk is OBSERVATION, not action override — riskScore never changes EV ranking."* Feeds `LiveAdviceBar` as a badge. |
| Bankroll | **Rear-view only** | `sessionAnalytics.js` `buildBankrollSeries` plots cumulative P&L. No engine reads it. No stake-to-roll ratio, no risk of ruin, no Kelly. |
| Tournament risk premium | **Correctly implemented, narrowly gated** | `riskPremium.js` `computeCommittedIcmTax`; POKER_THEORY §10.3. Gated to heads-up committed stack-offs (`ICM_COMMIT_FRACTION`), identity in cash. |
| Model uncertainty | **Propagated into estimates, not into the choice** | Beta posteriors + §11.5 shrinkage give honest per-parameter uncertainty. Nothing accounts for what taking a **max over noisy estimates** does. |
| Hero execution error | **Absent** | The game tree prices a line assuming optimal continuation. |
| Session decay / tilt | **Absent, and out of scope for v1** | Needs capture that does not exist. |

One heuristic is quietly doing this job badly. `computeRiskComparison` (`riskAnalysis.js:262`)
offers a "safer alternative" when it cuts variance ≥30% for ≤10% of pot in EV. Both constants
are invented. They are exactly the quantity bankroll theory determines from a number the founder
already knows.

---

## The unification

Replace the objective:

```
  today:      maximize   E[ Δchips ]
  proposed:   maximize   E[ U(B + Δmoney) ]
```

with the expectation taken over the **joint** distribution of

1. outcome given parameters (cards),
2. parameters given data (villain model posterior),
3. hero's own future actions (policy, not optimal play).

`U` is concave. That is the whole of the de-risking bias; each channel below is a term of that
expectation, and each has a coefficient that is **measured, not tuned**.

### Channel 1 — Card variance · the Kelly term

Log utility, expanded for `Δ ≪ B`:

```
  E[log(B + X)] ≈ log B + μ/B − σ²/(2B²)        →   maximize  μ − σ²/(2B)
```

The penalty for choosing a higher-variance line is `Δσ²/(2B)`. Illustrative, at 1/3 NL:

| Bankroll | σ = $400 line vs σ = $250 line | Chip-EV edge required to justify |
|---|---|---|
| $20,000 (≈67 buy-ins) | Δσ²/(2B) | **$2.44** |
| $5,000 (≈17 buy-ins) | Δσ²/(2B) | **$9.75** |

This is the validity check on the whole idea: the correction is a rounding error when properly
rolled and a genuine strategy shift when underrolled. If it ever produces a large penalty for a
well-rolled player, the implementation is wrong.

**Do not ship the mean-variance approximation.** It assumes `X ≪ B`, which fails for a stack-off
by an underrolled player — precisely the case that motivates the feature. `riskAnalysis.js`
already computes the **full per-combo outcome distribution**, so `E[log(B + X)]` can be
integrated exactly over it. Use the exact form; quote the quadratic only as intuition.

### Channel 2 — Misread potential · the optimizer's-curse term

Uncertainty in villain's fold rate does **not**, by itself, bias the EV of any single action —
the §6.1 fold-equity expression is linear in `foldPct`. The bias enters at the `max`:

```
  E[ max_a  ÊV(a) ]   ≥   max_a  E[ EV(a) ]
```

The action the engine selects is disproportionately the one whose parameters were most favourably
mis-estimated, so its realized value sits **systematically below** its stated EV. This is the
rigorous form of "high misread potential is a source of loss." It always points the same
direction, and its size grows with posterior width and shrinks with the EV gap between the top
two actions.

**The fix is the construction the repo already uses.** POKER_THEORY §11.5 replaced a threshold
with shrinkage, each context level priming the next. The curse correction is the same
construction applied one level up — shrinkage **across actions** rather than across context
levels. Not a penalty. Not a new mechanism.

Model uncertainty also enters Channel 1 through the law of total variance
(`Var(X) = E[Var(X|θ)] + Var(E[X|θ])`), so misreads and card variance share one pipe.

### Channel 3 — Hero's own errors · line-level realization

POKER_THEORY §1.4 already treats equity realization as first-class for preflop hands. The same
idea extends to lines: a triple-barrel bluff or a deep-SPR float out of position carries
downstream decisions hero gets wrong at some rate, and its true value is against **hero's
policy**, not the optimal continuation. `heroPolicy.mjs` already represents the engine's advice
as a distribution over hero's range — the machinery to compare policies exists.

`ipsEstimator.mjs` names this exact bias as its own horizon limitation: *"this measures the value
of substituting our action at a single node... it does NOT measure the value of playing our whole
strategy."* Channel 3 is that gap, priced.

### Channel 4 — Session decay · named, deferred

Live human EV drops after a big loss. Probably the largest of the four in practice, and nothing
in the repo touches it. It needs session-level capture that does not exist. Recorded here so it
is not silently dropped; not in v1.

### Composition with ICM — the double-count question, resolved

They do not double-count, because they act on **different variables in a chain**:

```
  chips  --[ ICM: β, POKER_THEORY §10 ]-->  $EV  --[ Kelly: λ = 1/B ]-->  utility
```

In cash the first map is the identity, so only λ acts. In a tournament, β converts chips to prize
equity and λ then prices the risk of that prize equity against the rest of the founder's poker
life. Sequential, not additive. §10 becomes the case where the chips→dollars map is non-linear;
§12 governs the map from dollars to utility. **Never apply both to the same at-risk chips.**

---

## Why this is an addition, not an overturn (C4)

`MODEL_READINESS_GATE.md` defines an overturn as *"a change that invalidates a load-bearing claim
already documented in POKER_THEORY.md — not an addition, not a refinement."*

§12 does not invalidate §1.2. It states the unit in which EV is maximized, and §10.1 already
established that the unit is not always chips. §12 generalizes §10.1; §10 becomes its tournament
specialization. **This should not reset the C4 counter** — but the determination is the
domain-correctness protocol's to make, not this document's, and it must be made explicitly before
WS-296 lands rather than assumed.

**C6 (no regression) is a different matter.** If the utility layer changes any recommendation,
the hero-EV edge is being measured on a different policy and the three-clean-run counter restarts.
That is a real cost of shipping Phase 2 before the gate opens, and it is the main reason for the
sequencing below.

---

## Sequencing against WS-286

**Phase 0 runs now.** It is a *reading of an instrument that already exists* (WS-287, closed
2026-07-28), not a build, and it is directly gate-relevant: C3 asks whether the engine's advice
makes money, and if the engine's stated EV is systematically optimistic, C3 is measuring a number
the engine cannot deliver. Phase 0 changes no doctrine and no recommendation, so it touches
neither C4 nor C6.

**Phases 1–3 are post-gate by default.** They change what the engine recommends, which restarts
C6 and delays the founder's switch from builder to student. If Phase 0 returns a large curse —
say the gap is a meaningful fraction of the measured edge — that finding is itself a reason to
re-open the sequencing question, because it would mean the theory the founder is about to
memorize overstates its own value. That is a founder call, not an automatic escalation.

---

## Standing constraints

- **No risk-appetite knob.** λ derives from a founder-entered bankroll, the way β derives from
  the payout ladder. A tunable "how cautious are you" slider is the §7 label anti-pattern wearing
  a number, and it makes every result unfalsifiable.
- **No multiplier on the EV ranking.** De-risking enters as a utility function over the outcome
  distribution or as a correction to the EV integral. A `riskScore`-scaled EV is a label scaling
  a posterior — forbidden by §7.4 and by the WS-274 corollary.
- **Identity when unconfigured.** No bankroll set → the utility layer is exactly the identity,
  the same contract `computeCommittedIcmTax` honours for cash games. Assert by test.
- **The tax is always visible.** Any de-risked recommendation shows the chip-EV alongside. A
  correction the founder cannot see is a correction they cannot audit.
- **Live/online separation may bind.** The model-readiness project already flags this for hero-EV:
  a *value* transfers across pools far less safely than an estimator's *structure*. A curse
  magnitude mined from a 2009 online corpus is evidence about the estimator's shape, and should be
  reported as shape, not as a live-game constant.

---

## Open founder decisions

1. **What is B?** The poker bankroll, or total liquid wealth? Kelly wants the roll you are
   genuinely willing to lose. This single number sets the entire magnitude of Channel 1.
2. **Visible always, or only when it flips a decision?** Showing a $2 tax on every hand is noise;
   showing it only when it changes the answer hides the mechanism.
3. **Does Phase 0's result re-open the sequencing?** Stated in advance, before the number is
   known — the WS-285 lesson.
4. **Bankroll input is a UX surface.** Adding it triggers the Design Program Guardrail (Gate 1
   entry, scope/personas/JTBD). Small, but it is not exempt.

---

## Draft POKER_THEORY §12 outline (authored by WS-296, not before)

```
12.  Risk, Utility, and the Objective Function
12.1 The engine maximizes utility of money, not chips        (generalizes §10.1)
12.2 Bankroll and the Kelly term; exact log-utility over the outcome distribution
12.3 The optimizer's curse — why a max over noisy estimates is biased
12.4 Line-level realization against hero's policy            (extends §1.4)
12.5 Composition with ICM: chips → $EV → utility, never both on the same chips
12.6 Session decay — named, unmodelled, UNMEASURED
12.7 Anti-patterns: the risk-appetite knob; the riskScore multiplier; the
     invented safer-alternative constants; double-taxing at-risk chips
```

---

## Ticket map

| ID | Phase | Title | Effort |
|---|---|---|---|
| WS-295 | 0 | Optimizer's curse — is the engine's stated EV systematically above what its advice realizes? | M |
| WS-296 | 1 | POKER_THEORY §12 — the objective function, and ICM as its special case | M |
| WS-297 | 2 | Bankroll utility layer — replace the two invented safer-alternative constants with `E[log(B+X)]` | L |
| WS-298 | 2 | Compose bankroll λ with ICM β without double-taxing at-risk chips | M |
| WS-299 | 3 | Line-level realization — price hero's own downstream errors against hero's policy | XL |

Out of scope, owned elsewhere: **WS-280** (game and seat selection) is the adjacent
variance-and-edge lever that sits outside the hand entirely. Session decay (Channel 4) has no
ticket until capture exists.
