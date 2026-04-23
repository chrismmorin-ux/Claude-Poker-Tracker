---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/btn-vs-bb-sb-srp-mw-j85-flop_root.md
Source-Rubric: v2.3 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/btn-vs-bb-sb-srp-mw-j85-flop_root-external.md
Audit: docs/upper-surface/audits/btn-vs-bb-sb-srp-mw-j85-flop_root-audit.md
Authored: 2026-04-23
Word-count: ~235 (target ≤250)
---

# Drill Card — `btn-vs-bb-sb-srp-mw-j85-flop_root`

## Front (predict before flipping)

**Spot.** **3-way SRP, hero BTN (IP).** 100bb effective. Preflop: BTN open 3 → SB call → BB call. Flop **J♠8♥5♦** rainbow middling-dry. **SB checks, BB checks.** Hero **A♦J♣** (TPTK). Pot 10bb.

**Question.** Action with hero's hand?

---

## Back

### Action

**Cbet 50% pot (~5bb) — polar (narrow range with value+semi-bluffs).** Single recommendation; action-robust.

### Why (3 beats)

1. **Hero ~79% equity** vs combined villain range [§3, row 3.6]. TPTK dominates the pair-heavy check-through ranges of SB+BB. Value-bet frame.
2. **Joint fold equity ~30%** at polar 50% [§7 row 7.3]. Meets auto-profit threshold (joint MDF 33%). Cbet is +EV even as pure bluff against the joint-fold-rate (but hero isn't bluffing — TPTK is value).
3. **"Bluff frequency collapse" framework.** HU cbet-frequency (~75%) must compress to ~30% in 3-way because joint-fold-equity compounds. **HU-player-trap:** applying HU frequencies to MW is a structural leak.

### Pivot (sensitivity)

**§12 all assumptions robust.** Archetype (fish/reg/pro/nit) doesn't flip action. Joint fold rate drops to ~20% still keeps cbet-50% +EV (hero has 79% equity vs call-range too). Size may adjust (33% vs extreme-calling stations, overbet vs extreme-foldy), but action stays.

### Falsification

**§14b: No action-level headline falsifiers.** Decision-level-robust across all §11 credible intervals. **Fifth consensus-robust corpus artifact** (#3, #5, #7, #8 prior + #9).

### Where to dig deeper

§2 (**v2.3 D17 inclusion-exclusion combined range ~280 combos**) · §7 (**two-villain + joint synthesis; "bluff frequency collapse" framework explicit**) · §8 (scenario-grouping: 5 outcomes, 30% both-fold) · §10 (**D15 explicitly N/A** — TPTK is range-top AND individual-hand-correct) · §9 (blockers +2pp favorable)

### Corpus note

**Third MW artifact + second MW-postflop + first BTN-IP-MW.** Contrast with artifact #6 (CO-sandwiched): both converge on cbet-50%-polar despite different positions. **MW theory position-robust.**

---

### Faithfulness check

| Card claim | Anchor |
|---|---|
| "79% equity combined" | §3, §11 row 3.6 |
| "Joint fold 30%" | §11 row 7.3 |
| "Joint MDF 33%" | §11 row 10.3 |
| "Cbet-50% EV +6.7" | §11 row 8.10 |
| "Cbet-33% EV ~+5.5" | §11 row 8.11 |
| "Check-back EV ~+3" | §11 row 8.12 |
| "Bluff frequency collapse framework" | §4 Claim 4 + §5 Claim 4 |
| "D15 N/A explicit" | §11 row 10.5 |

All claims grep-traceable.
