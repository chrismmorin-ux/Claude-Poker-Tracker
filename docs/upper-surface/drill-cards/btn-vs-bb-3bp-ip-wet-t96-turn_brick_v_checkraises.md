---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/btn-vs-bb-3bp-ip-wet-t96-turn_brick_v_checkraises.md
Source-Rubric: v2.3 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/btn-vs-bb-3bp-ip-wet-t96-turn_brick_v_checkraises-external.md
Audit: docs/upper-surface/audits/btn-vs-bb-3bp-ip-wet-t96-turn_brick_v_checkraises-audit.md
Authored: 2026-04-23
Word-count: ~240 (target ≤250)
---

# Drill Card — `btn-vs-bb-3bp-ip-wet-t96-turn_brick_v_checkraises`

## Front (predict before flipping)

**Spot.** 3BP. Hero **BTN (IP)**, ~135bb effective. Preflop: BTN 2.5 → BB 3bet 10 → BTN call. Flop T♥9♥6♠: BB donk 6.8, BTN call. Turn 2♣ (brick, kills BDFD): BB check → **hero overbet 110% (37.4bb)** → **BB check-raises to 112bb total.** Pot 184bb. Hero needs 74.8 to call. Hero holds **J♥T♠** (TPTK, dead draw).

**Question.** Action with hero's hand?

---

## Back (per v2.1 D11 archetype-conditional form)

### Action

**Default: Fold.** **Override: Call if villain is confirmed maniac-BB** (≥50-hand sample showing CR-bluff freq ≥25%).

### Why (3 beats)

1. **Hero equity ~22% vs BB's check-raise range** [§3, row 3.6]. Required 29% per pot odds. 7-percentage-point gap, blocker-adjusted.
2. **BB's CR range is ~94% value** [§11 row 2.5, population-consensus-observed]. Sets + overpairs dominate; bluffs near-zero at live. Hero drawing to 2-outer for top-two or 3-outer for trips vs sets; near-dead.
3. **Sunk-cost trap explicit.** Hero has invested 37.4bb in overbet; that's gone. Decision from here: call loses ANOTHER 74.8bb at -18bb EV vs fold's 0bb baseline. **"What action loses LEAST from this point"** is the correct frame, not "how do I recover the 37.4bb."

### Pivot (sensitivity)

**§12 Assumption A (archetype-flip).** Confirmed maniac-BB with wide CR-bluff range (~30%) flips hero equity to 32%, above threshold → call becomes +EV. Override per v2.1 D11.

### D15 range-vs-hand divergence

Hero's JT is "top of hero's overbet range" by preflop strength — but ~22% equity is individual-hand-sub-threshold. **Range-level MDF says defend 71%; individual hand says fold.** v2.3 D15 surfaces this: top-of-range ≠ call-correct when runout-conditional composition makes hand a dominated bluff-catcher.

### Falsification

**§14b headline falsifier (archetype-flip).** Villain history outside [85:15, 98:2] value:bluff ratio in CR-over-overbet spots → override activates.

### Where to dig deeper

§1 (**F-finding: stack 90bb authored conflicts with 112bb action**) · §3 (equity 22%, mostly-air bucket) · §8 (call -18, jam -23, fold 0) · §9 (JJ + TT blockers favor hero slightly) · §10 (**D15 range-vs-hand divergence** — first load-bearing in corpus) · §14b (archetype-flip single falsifier)

### Corpus note

**Second fold-correct artifact** (after #4 AA-scare-river). D11 structural-reuse validated.

---

### Faithfulness check (mechanical anchor map)

| Card claim | Source anchor |
|---|---|
| "22% equity" | §3, §11 row 3.6 |
| "Required 29%" | §11 row 1.5 |
| "BB range 94% value" | §11 row 2.5 (D14-labeled) |
| "Sunk-cost: 37.4 invested is gone" | §8 prose + §11 rows 8.1-8.3 |
| "Call EV -18, Jam EV -23" | §11 rows 8.1, 8.2 |
| "Assumption A archetype-flip" | §12 Assumption A + §6 D11 |
| "D15 range-vs-hand applies" | §9 + §10 + §11 row 10.3 |

All claims grep-traceable.
