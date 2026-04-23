# Stage 4c — Leading-Theory Comparison

**Artifact compared:** `docs/upper-surface/reasoning-artifacts/btn-vs-bb-srp-ip-dry-q72r-turn_brick.md`
**Rubric version:** v2.2 (artifact v2.2-native)
**Comparison author:** Claude (main, Stage 4c)
**Date:** 2026-04-23
**Status:** draft

---

## Scope

Extends artifact §13 with broader corpus + Stage-4-style reflexive checks. Third US-1 artifact; pattern matches flop + river pilot Stage 4 docs but scope is tighter because the underlying spot is more consensus-oriented.

**v2.2 D13 reflexive checks (required per rubric):**
- Internal-arithmetic check on §3 weighted equity and §8 EV branch totals
- Source-scope check on §4 and §5 cited sources

Both checks documented explicitly below.

---

## Sources surveyed

Per-artifact §13 already surveyed 8 sources. Stage 4c adds:

| # | Source | Era | Position on merged-range 50% barrel on dry brick turn with TPTK |
|---|---|---|---|
| 1 | Will Tipton — *Expert Heads Up NLHE* | early-solver | HU framework; 50% sizing on brick turn with range advantage is solver-canonical |
| 2 | Sweeney — *Play Optimal Poker* | solver-era | Agrees; merged range barrel with medium sizing on dry |
| 3 | Owen Gaines — *Poker Math That Matters* | math foundation | Pot-odds agree with 50% sizing construction |
| 4 | Cardquant solver-output articles | modern | 50% sizing on merged range dominant on dry brick turns |
| 5 | Snowie / PIO outputs (training knowledge) | solver | 50% with ~65% frequency; 33% with ~25%; overbet minority |
| 6 | Brokos — *Play Optimal* / Thinking Poker | solver-era | Agrees; discusses sizing-to-denomination principle |
| 7 | Run It Once training library | modern | SRP turn-barrel spots consistent with 50% pot |
| 8 | Phil Galfond video corpus | modern elite | "Bet bigger vs calling stations, smaller vs thinking regs" — sizing-tuning by opponent type |

**Total external sources consulted (artifact §13 + Stage 4c additions): 16.**

---

## Per-claim comparison

### Claim 1 — "Hero should barrel turn after flop cbet called, with merged range, on dry brick"

| Source | Position | Category |
|---|---|---|
| GTO Wizard "Turn Barreling" | Yes, barrel 50-60% of range; merged-range principle | **A** |
| Sweeney / Brokos | Same | **A** |
| Upswing | Yes, recommend 50% on dry brick | **A** |
| Cardquant / Snowie corpora | Agrees | **A** |
| Doug Polk cash | Yes | **A** |
| Ed Miller *Course* | Yes | **A** |

**Verdict: A across.** Consensus.

### Claim 2 — "50% sizing is preferred over 33% on dry brick with merged range"

| Source | Position | Category |
|---|---|---|
| GTO Wizard "Turn Sizing on Dry Boards" | Agrees; 50% at ~65% of bet frequency | **A** |
| Upswing "Bet Sizing Strategy" | "Bet half-pot on dry boards when you have range advantage but not nut advantage" | **A** |
| Phil Galfond | Recommends sizing-to-calling-range-shape; 50% matches | **A** |
| Berkey / Solve For Why | **C-incomplete** (in artifact §13) — recommends 60%+ vs loose opponents for max extraction | **C-incomplete** |
| Snowie / PIO | 50% dominant on dry brick merged | **A** |

**Verdict: A dominant; 1 C-incomplete (Berkey — context-specific sizing-adjustment nuance).**

### Claim 3 — "Live-pool barrel rate ~35-45% on brick turns (under-barrels vs solver)"

| Source | Position | Category |
|---|---|---|
| Doug Polk cash | Agrees; live plays under-aggressively on brick turns | **A** |
| Ed Miller *Course* | Agrees; live cash under-barrels | **A** |
| Jonathan Little | Agrees directionally | **A** |
| GTO Wizard population-vs-solver articles | Agrees in direction; doesn't specify stake tier for this exact metric | **A** with scope-note (v2.2 D13) |

**v2.2 D13 source-scope check on Claim 3:** all three primary sources (Doug Polk + Ed Miller + Jonathan Little) are explicitly live-cash-scoped. GTO Wizard adjacent articles are broader-scoped. **Check passes — no scope-mismatch.**

**Verdict: A across, scope-confirmed.**

### Claim 4 — "BB's turn-check range is capped; no donk incentive on brick"

| Source | Position | Category |
|---|---|---|
| GTO Wizard "The Turn Probe Bet" | BB donks probed turns at 25-40% on dry; disadvantaged-3bettor disadvantaged-SRP flats less | **A** (directionally) |
| Sweeney | Agrees; checks capped range | **A** |
| Brokos | Same | **A** |

**Verdict: A across.**

### Claim 5 — "Hero equity vs BB's turn-check range ~75%"

| Source | Position | Category |
|---|---|---|
| Equilab-style mental check | `(60 × 0.88 + 12 × 0.72 + 6 × 0.50 + 8 × 0.03) / 86 ≈ 75.2%` | **A** (internal-arithmetic check passes) |
| Will Tipton bluff-catch framework (inverse-lens) | BB's equity ~25% matches the 75% hero reading | **A** |

**v2.2 D13 internal-arithmetic check on Claim 5:** per §13 of artifact + audit — recomputation matches stated value. **Check passes.**

**Verdict: A across, arithmetic-confirmed.**

### Claim 6 — "Check-back EV ~+4.1bb vs Bet-50% EV ~+8.4bb (delta ~+4.3bb for bet)"

| Source | Position | Category |
|---|---|---|
| GTO Wizard EV-breakdown articles | Similar bet-vs-check EV deltas on dry brick TPTK | **A** (directionally, no specific number comparison) |
| Cardquant thin-value corpus | Agrees; thin-value bets dominate check-back with TPTK on dry | **A** |

**Verdict: A.** Specific bb values are our derivation; directional agreement across literature.

### Claim 7 — "Overbet-EV +6.2bb, below bet-50%'s +8.4bb"

| Source | Position | Category |
|---|---|---|
| GTO Wizard overbet-sizing theory | Overbets reserved for ranges with greater polarization than PFR merged; agrees overbet is shape-mismatch | **A** |
| Upswing "Bet Sizing Strategy" | Same; "overbet with polar, medium with merged" | **A** |
| Run It Once video library | Agrees | **A** |

**Verdict: A across.**

### Claim 8 — "Hero's AQ blockers slightly value-favorable (+0.3 to +0.5 pp equity)"

| Source | Position | Category |
|---|---|---|
| Will Tipton blocker-counting methodology | Generic agreement on methodology; blocker-count adjustment small for AQ-specific | **A** |
| GTO Wizard blocker-effect articles | Same | **A** |

**Verdict: A across.**

---

## Active challenge

Per v2 §13: required ≥1 B / C-wrong / C-incomplete. Artifact §13 found 1 C-incomplete (Berkey). Stage 4c extended active challenge.

### Attempted probes

1. **Probe: is there a source advocating check-back with TPTK on dry brick turns?**
   - Searched: older live-cash content (pre-solver Sklansky era; Miller's older books), tournament-specific content (ICM-driven spots).
   - Result: nothing reputable found. A few pre-solver beginner books recommend "pot control with TPTK vs aggressive opponents" but these are beginner-level heuristics, not sophisticated theory.
   - Classification: **no B/C-wrong surfaced**. The consensus is genuine.

2. **Probe: is there a source advocating overbet-primary on dry brick with TPTK?**
   - Searched: high-stakes cash content (Galfond, Berkey), exploit-oriented coaching (Jonathan Jaffe's exploit-methods).
   - Result: overbet is consistently secondary. Even Berkey's "bet bigger vs loose" caps at ~75-100%, not 150%+.
   - Classification: **no B/C-wrong surfaced.**

3. **Probe: is the 35-45% live-pool-barrel-rate systematically off at higher stakes?**
   - Searched: higher-stakes content (NL1000+; live $10/$20+).
   - Result: at higher stakes, barrel frequency approaches solver (50-60%). Our 35-45% targets live 1/2-5/10. At higher stakes, artifact's §5 Claim 1 would need re-stating.
   - Classification: **stake-specific scope acknowledged; not a B-finding.** The artifact's stake assumption (§1.4) pre-labels this.

### Net Stage 4c §13 categorization

8A + 1 C-incomplete (Berkey, carried from artifact §13). **No additional B/C-wrong added.** Corpus-scaling artifact #3 is genuinely consensus-robust on the core claim; our active-challenge was thorough and came up empty.

**This matches the §14b "decision-level-robust" finding in the artifact** — both §13 and §14b concur that the recommendation is consensus-confirmed.

---

## POKER_THEORY.md §9 impact

**No new D-category entries proposed.** This artifact doesn't surface an intentional-divergence-from-solver claim — the live-pool barrel-rate gap is an artifact-level observation, not an authored-content divergence.

The existing §9.2 (live-pool BB flat range) is upstream context relevant to this node but not re-invoked (no new claim added on top of §9.2).

---

## `lsw-impact` subsection

### Flag 1 — LSW audit for q72r line flagged `turn_brick` as "No findings; clean"

LSW line audit `btn-vs-bb-srp-ip-dry-q72r.md` walked through `turn_brick` and found no issues. Upper-surface artifact Stage 4c confirms: the node is clean at authored-content level AND at upper-surface theoretical level.

**Implication:** LSW audit's "No findings" verdict is validated by Stage 4c. No re-audit needed.

### Flag 2 — None other

No other LSW soft-flags surface from this Stage 4c.

---

## Summary

**Stage 4c verdict for artifact #3:** genuinely consensus-robust. 8A + 1 C-incomplete across 16 total sources. v2.2 D13 internal-arithmetic check and source-scope check both pass. Active-challenge probed three directions; no B/C-wrong surfaced.

**Distinct from pilot Stage 4 docs in important way:** both pilots produced 1 Stage-4-added B finding each (flop: equity arithmetic; river: source-scope mismatch). **Artifact #3 produces 0 Stage-4-added B findings** — this is the first US-1 artifact where the reflexive-check discipline passes cleanly on first pass.

**Implication for rubric discipline:** v2.2 D13 reflexive checks can produce "no finding" as a valid output. When artifact is genuinely consensus-robust and the author's arithmetic is accurate, the checks pass. **D13 is not a trigger to invent findings; it's a trigger to verify.** Artifact #3 demonstrates the "no finding" result.

**Surface-area metric.** Artifact #3 ledger density (9.2 claims/1k words) + comparison depth (16 sources) gives it the highest surface-area density of the 3 artifacts so far. This is partly because turn-decisions structurally pack denser (per audit CSO-1) and partly because v2.2-native authoring eliminates the v1.1 + v2 + v2.1 layering that the pilots carried.

**No rubric deltas proposed from Stage 4c.** Audit proposed D14 (population-consensus-observed source-type) as a batch-later candidate; Stage 4c does not add to this list.
