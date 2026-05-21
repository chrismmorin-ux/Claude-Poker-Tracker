---
descriptorId: saddle
title: Saddle — Way-Ahead / Way-Behind on the Same Street
catalogPosition: 4
priorityTier: P1
surfaceEmbeds:
  - hand-replay-view
authoredAt: 2026-05-18
authoredAtSprint: SPR-088
authoredFor: WS-043
prototypes:
  - saddle
  - wayAhead
  - wayBehind
  - flat
relatedDescriptors:
  - range-silhouette
  - equity-distribution-curve
  - spire-polarization
versionLineage:
  version: 1
  authored_at: 2026-05-18
  amended_at: null
  amendment_reason: null
---

## Exposition

The Saddle descriptor names a configuration where a villain's range, at a given decision point, splits into two camps on opposite ends of the equity spectrum — a chunk of combos that crushes hero and a chunk that hero crushes, with almost nothing in the middle. When you graph the per-combo equity distribution, the shape looks like a saddle: two humps with a valley between them.

Saddle has two independent dimensions:

- **Way-Ahead mass (WA)** — the fraction of villain's range whose combos comfortably beat hero (heroEquity < 0.35).
- **Way-Behind mass (WB)** — the fraction whose combos hero comfortably beats (heroEquity > 0.65).

Either can be elevated without the other. A wide BTN c-bet range against a BB defender holding middle pair is *Way-Ahead only* from BB's perspective: most of villain's combos are pure air that BB beats; the value combos are rare. A loose UTG limp range vs hero's AA is *Way-Behind only*: almost every villain combo loses, with no real bluff content at this decision point. A true *Saddle* is when both camps are elevated simultaneously — a polarized range against a hero hand that sits squarely between them.

Saddle is most informative on flop and turn decisions, where one more card (or two) can still resolve the way-ahead-way-behind. By the river, equity per combo is binary (showdown is deterministic) — at that point the right primitive is a showdown-outcome distribution with strength-tier bucketing, not a way-ahead-way-behind equity split. See the Basin descriptor (catalog row 6) for the river-side analog.

The label is a rollup of the two masses. Surfaces that hide the underlying masses behind the label alone are throwing away the dimensional structure — INV-SLS-B3-SADDLE-TWO-MASS requires both percentages travel with the label everywhere it renders.

A Saddle label is descriptive, not prescriptive. It tells you "the villain's range on this street has a polarized equity profile against hero's hand" — it does not tell you what to do. Strategic decisions still derive from equity, pot odds, SPR, and players-remaining. The saddle is a name for what you're looking at, not an instruction.

## Worked example

Four canonical scenarios — one per non-empty label.

**1. Saddle — BB defends AKx flop vs BTN open, hero holds KQ.**
Villain's BB defense range contains premium pairs (AA, KK, QQ — way-behind from villain POV means *very strong* for villain, slaughters KQ) plus a wide spread of air (suited connectors, low pairs that whiffed the board, weak K-x with worse kickers — villain way-ahead means *very weak* for villain, KQ crushes them). Middle-equity combos (medium pairs, K-x that ties or barely beats KQ) are sparse. Both WA and WB camps are elevated; the middle is depleted. Shape: Saddle.

**2. Way-Ahead — BTN c-bets bluff-heavy on K72 rainbow, hero holds 88 in BB.**
Villain's c-bet range on a dry flop is bluff-heavy by construction; hero's middle pair beats most of villain's air. Way-ahead mass for villain (hero crushes) is large; way-behind (villain crushes) is small (a few sets, AK, KK). Shape: Way-Ahead (from BB's perspective the villain's range is mostly hands BB beats).

**3. Way-Behind — Hero opens AA from MP, gets called by a loose UTG limp range.**
The UTG limper's range is wide but weak vs AA. Most combos lose at showdown; the few that beat AA (set-mining hands that flopped a set) are rare. Way-behind mass is enormous; way-ahead is tiny. Shape: Way-Behind.

**4. Flat — MP cold-calls CO open, flop comes T98 two-tone, hero holds JJ (overpair on wet board).**
Villain's cold-call range on this wet flop has a wide equity distribution against an overpair — many marginal pairs (TT, 99, 88 = sets and overpair-killers), many draws (open-enders, flush draws, gutshots) with decent equity, plus some air. The distribution sprawls across the middle of the equity range; neither extreme is concentrated. Shape: Flat.

## Success criteria

After working through this lesson, you should be able to:

- Recognize a saddled equity distribution at a flop or turn decision and name what's elevated (WA, WB, both, or neither) without confusing the label with a strategic prescription.
- Read the two mass percentages alongside the label and understand which dimension is doing the work — a "Saddle" with WA=45/WB=35 is materially different from one with WA=35/WB=45, even though they share a rollup label.
- Distinguish Saddle (bimodal — two equity humps) from Spire+Polarization (an equity-bucket histogram with a tall single bin) and from Range Silhouette (the 13×13 grid shape, independent of equity). All three describe range geometry from different angles.
- Notice when Saddle is the right descriptor (flop/turn equity decisions) versus when a different primitive is needed (at river, equity per combo is binary and the showdown-outcome distribution is what matters — Basin's territory, not Saddle's).

The lesson does NOT teach you which decision to make when a Saddle appears. The strategic implications of a polarized range — calldown frequency adjustments, raise-as-bluff opportunities, sizing tells — derive from pot odds and SPR. Saddle is the label that helps you describe what you're seeing, faster.

## Drill spots

The following drill spots are authored for the future LessonRunnerView Deliberate and Discover variants (per `docs/design/surfaces/lesson-runner.md`). Each spot describes a decision context and asks which Saddle label fits.

- **Spot 1.** Context: BB defended a BTN open with a wide range; flop is AKx rainbow; hero holds KQ. Villain's range against this board is roughly half premium combos (AA / KK / QQ / AK — slaughter KQ) and half complete air (suited connectors / small pairs / weak K-x that whiffed). Correct label: **saddle**. Reasoning: both WA and WB camps are elevated; middle equity combos (medium pairs that tie or barely beat KQ on this board) are sparse.

- **Spot 2.** Context: BTN c-bets a K72 rainbow flop after opening a wide range; hero holds 88 in the BB. Villain's c-bet range on this dry board is bluff-heavy by GTO construction; the value combos (KK, 77, 22, AK) are rare. Correct label: **wayAhead**. Reasoning: hero's middle pair beats the majority of villain's range; way-ahead-for-villain mass is small.

- **Spot 3.** Context: Hero open-raises AA from MP; a loose UTG limper calls; flop comes 962 rainbow. Villain's loose limp range contains some pairs that flopped a set (66, 99) and a lot of mid-low offsuit hands that whiffed. Correct label: **wayBehind**. Reasoning: the vast majority of villain's range is dominated by AA; way-ahead mass (the few sets) is small relative to the dominated combos.

- **Spot 4.** Context: MP cold-calls a CO open; flop is T98 two-tone; hero opened with JJ and holds an overpair. Villain's cold-call range on this wet, drawy board has wide equity dispersion: sets (TT, 99, 88), open-enders (QJ, KJ, J7s, 76s), flush draws, overpair-killers (TJ, T9), and some air. Correct label: **flat**. Reasoning: no clear bimodality; the equity distribution sprawls through the middle.

- **Spot 5.** Context: SB 3-bets a polarized range vs BTN open; flop comes 654 with two hearts; hero called the 3-bet preflop with 99 and now faces a c-bet. Villain's 3-bet polarized range is value (AA/KK/QQ/AKs/AKo) and a separate bluff set (76s, 65s, A5s/A4s). Correct label: **saddle**. Reasoning: classic polarized construction — value crushes 99, bluffs lose to 99, middle is empty by 3-bet range design.

- **Spot 6.** Context: BB defends a SB minraise with the widest possible defense range; flop comes A52 rainbow; hero opened with AK from SB and now holds top pair top kicker. Villain's defense range against the minraise is essentially "any two cards" by stack-odds math — every random low pair, suited gapper, offsuit broadway. Correct label: **wayBehind**. Reasoning: AK on A52 dominates almost the entire BB defense range; way-ahead-for-villain mass (sets, two pair, AQ/AJ) is small.

- **Spot 7.** Context: Hero open-raises JJ from MP and gets one caller from BTN; flop comes A87 rainbow. Villain's flat-call range on the BTN vs MP open typically contains medium pairs that flopped sets (77, 88), broadway hands that have aces (AT, AJ, AQ, AK — dominate JJ), and some suited speculative hands that whiffed. Correct label: **saddle**. Reasoning: BTN's range against the ace-high flop is bimodal — the Ax combos crush JJ (WB elevated from villain POV), the whiffed broadways and small pairs lose to JJ (WA elevated), and the middle (TT — which is rare in BTN's cold-call vs MP) is depleted.
