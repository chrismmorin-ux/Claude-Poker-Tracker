# WS-492 — the full 27-directory corpus, measured against the 2-directory slice

**Date:** 2026-08-15 · **Machines:** cm-node1 (full-corpus arm), G16 (2-dir arm)
**Repo commit (both arms):** `48bd185e` · **Dataset commit:** `e47fbd58`
**Status:** first measurement complete. Downstream re-mines still open (see §6).

---

## 1. What was done

`C:/Users/chris/data/phh-dataset` is a blobless sparse checkout. On both machines it
carried **2 of its 27 HandHQ stake directories** (1,756 `.phhs` files). On cm-node1 the
sparse set was widened to `data/handhq`, materialising **all 27 directories — 21,782
hand files**, a 12.4x increase in files and **12.1x in hands** (1,065,871 → 12,927,164).

Two arms were then run with the **same miner at the same commit and the same flags**,
differing only in the corpus present on disk:

| Arm | Machine | Corpus | Workers | Elapsed |
|---|---|---|---|---|
| `2dir` | G16 (clean pinned worktree at `48bd185e`) | 2 dirs / 1,756 files | 8 | 7.7 s |
| `full27` | cm-node1 | 27 dirs / 21,782 files | 4 | 437.6 s |

Cross-machine comparability is not assumed — it was established previously (WS-493: every
determinism arm hashed identically on both machines).

### Two anchors, both of which held

1. **The 2-dir arm reproduces the shipped backtest artifact exactly.** Its `stakes` block is
   byte-identical to the existing `out/pool-reference.json`. So the 2-dir arm *is* the
   baseline, not an approximation of it, and any difference in the other arm is
   attributable to the corpus alone.
2. **The full-corpus arm reproduces the shipped PRODUCTION table exactly.**
   `handhqReferencePool.js` (SRC-011) declares `totalHands: 12927164`; the full27 arm sums
   to **12,927,164**. Per-stake hand counts match to the unit (50NLH 6max 746,972; 50NLH
   full-ring 555,455). Stat denominators are ~half, exactly as expected for a
   `--pool-pct 50` partition.

Anchor 2 is what makes the rest of this document trustworthy: the restored corpus is the
same corpus WS-262 mined on 2026-07-25.

---

## 2. Correction: the ticket's central premise is overstated

WS-492 states: *"Every prior, policy, curve and reference table in this system is fitted on
2 of the 27 available corpus stake directories."*

**That is false for the shipped production Reference tier, which is the most consequential
table in the claim.** `src/utils/exploitEngine/handhqReferencePool.js` (SRC-011) carries all
7 stake bands and 12,927,164 hands — it was mined during WS-262 while the corpus was fully
materialised, and the sparse regression happened afterwards. The app's Reference tier was
never fitted on the slice.

Recording this because the premise would otherwise have been inherited unchecked, and
because a ticket premise failing verification at execution time is a repeat pattern here
(this is the ninth logged occurrence).

**Actually fitted on the 2-dir slice:**

| Artifact | Evidence in its own manifest | Affected |
|---|---|---|
| `out/pool-reference.json` | `stakesMined: ['50NLH']` | **yes** |
| `out/fold-vs-sizing.json` | `files: 1756` — the 2-dir count exactly | **yes** |
| `out/behavior-policy.json` | `stakes: ['50NLH']`, `handsRead: 1070493` | **yes**, see note |
| `out/pole-priors.json` | no corpus fields at all | **unknown** |
| `out/behavioral-features.json` | no corpus fields at all | **unknown** |
| `handhqReferencePool.js` (SRC-011, shipped) | `totalHands: 12927164`, 7 bands | **no** |

Note on `behavior-policy.json`: it passes `--stakes 50NLH` *by design*, so 50NLH is intended.
The defect is that the flag silently selected **2 of the 3 sites** that carry 50NLH (FTP, PS
— missing ABS). Its `handsRead: 1070493` should be ~2.07M at full corpus. Intent and effect
diverged without either being wrong on its face — the worst kind of gap to spot.

The two `unknown` rows are their own finding: an artifact that records nothing about the
corpus it read cannot be audited at all. That is the gap §5 closes.

---

## 3. Same stake band, more data (the VARIANCE question)

50NLH gains a third site (ABS) when the corpus is complete. 10 of 12 stat/bucket cells move
**outside the old 95% Wilson interval**.

That statement needs its magnitude attached to be honest: at n > 1.7M the intervals are
±0.0006, so significance is nearly automatic and is **not** by itself the finding. The
magnitudes are what matter:

| bucket | stat | 2-dir | full27 | absolute | relative |
|---|---|---|---|---|---|
| full | vpip | 0.1981 | 0.2134 | +0.0153 | **+7.7%** |
| full | pfr | 0.0894 | 0.0847 | −0.0047 | −5.3% |
| full | threeBet | 0.0312 | 0.0289 | −0.0023 | −7.4% |
| full | foldToCbet | 0.5576 | 0.5681 | +0.0105 | +1.9% |
| full | foldTo3Bet | 0.8656 | 0.8581 | −0.0075 | −0.9% |
| 6max | vpip | 0.2814 | 0.2870 | +0.0056 | +2.0% |
| 6max | pfr | 0.1408 | 0.1372 | −0.0036 | −2.6% |
| 6max | threeBet | 0.0472 | 0.0459 | −0.0013 | −2.8% |
| 6max | foldToCbet | 0.5295 | 0.5366 | +0.0071 | +1.3% |
| 6max | foldTo3Bet | 0.7870 | 0.7840 | −0.0030 | −0.4% |
| 6max | cbet | 0.5771 | 0.5781 | +0.0010 | inside CI |
| full | cbet | 0.6034 | 0.6050 | +0.0016 | inside CI |

Largest single move: full-ring VPIP, **+7.7% relative**, from one additional site at the
same stake.

---

## 4. Across stakes (the BIAS question) — this is the real finding

Every stat carries a **monotone gradient in stake**, and the gradients are large.

### Full ring (≥7 dealt in — the founder's 9-handed table)

| stat | 25NLH | 50NLH | 100NLH | 200NLH | 400NLH | 600NLH | 1000NLH | spread |
|---|---|---|---|---|---|---|---|---|
| vpip | 0.2168 | 0.2134 | 0.1953 | 0.1914 | 0.1970 | 0.1933 | 0.1978 | 0.0254 |
| pfr | 0.0834 | 0.0847 | 0.0891 | 0.0984 | 0.1001 | 0.1160 | 0.1164 | 0.0330 |
| threeBet | 0.0293 | 0.0289 | 0.0313 | 0.0365 | 0.0372 | 0.0458 | 0.0453 | 0.0169 |
| foldTo3Bet | 0.8544 | 0.8581 | 0.8698 | 0.8669 | 0.8592 | 0.8590 | 0.8505 | 0.0193 |
| cbet | 0.6017 | 0.6050 | 0.5589 | 0.5842 | 0.6045 | 0.6035 | 0.5965 | 0.0461 |
| foldToCbet | 0.5520 | 0.5681 | 0.5660 | 0.5599 | 0.5461 | 0.5366 | 0.5323 | 0.0358 |
| _hands_ | 2,679,664 | 555,455 | 493,759 | 590,486 | 326,067 | 141,738 | 138,217 | |

### 6-max (exactly 6 dealt in)

| stat | 25NLH | 50NLH | 100NLH | 200NLH | 400NLH | 600NLH | 1000NLH | spread |
|---|---|---|---|---|---|---|---|---|
| vpip | 0.2855 | 0.2870 | 0.2548 | 0.2620 | 0.2542 | 0.2628 | 0.2594 | 0.0328 |
| pfr | 0.1298 | 0.1372 | 0.1413 | 0.1526 | 0.1583 | 0.1617 | 0.1704 | 0.0406 |
| threeBet | 0.0424 | 0.0459 | 0.0506 | 0.0562 | 0.0590 | 0.0594 | 0.0664 | 0.0239 |
| foldTo3Bet | 0.7872 | 0.7840 | 0.8107 | 0.8010 | 0.8064 | 0.7979 | 0.7970 | 0.0267 |
| cbet | 0.5831 | 0.5781 | 0.5654 | 0.5822 | 0.5973 | 0.5915 | 0.5955 | 0.0320 |
| foldToCbet | 0.5366 | 0.5366 | 0.5276 | 0.5232 | 0.5167 | 0.5110 | 0.4973 | 0.0393 |
| _hands_ | 2,517,638 | 746,972 | 670,723 | 1,222,686 | 1,314,093 | 691,555 | 838,111 | |

Aggression rises monotonically with stake and passivity falls: 6-max PFR +31% and 3-bet
**+57%** from 25NLH to 1000NLH; full-ring PFR +40%, 3-bet **+56%**. Fold-to-c-bet declines
steadily. These are not noise — the smallest cell here still holds 138k hands.

**A single-stake fit is therefore not "the pool". It is one price point**, and the corpus is
bottom-heavy (25NLH alone is 40% of full-ring hands), so an unstratified average is dragged
toward the softest games.

### CORRECTED 2026-08-16 — this section originally drew the wrong inference

> **Founder ruling, 2026-08-16.** The paragraph below originally read: *"The founder plays
> live 1/2–1/3, which maps to canonical `1-2` = 200NLH"*, and treated the 50NLH→200NLH
> column as the error to correct for his game. **That mapping is wrong, and the direction
> of the error is not what it looks like.**
>
> Online and live are not comparable by bb level. The skill axis *inverts*: online pools are
> substantially tougher than live pools at the same nominal stake, so online 200NL is a far
> harder game than live 1/2 or even 2/5. Founder: *"200NL online, which it might seem
> comparable to 1/2 or 2/5, has a MUCH higher skill level of player, since online has better
> players at lower stakes than live games. The types of mistakes are already different."*
>
> Picking the bb-matched band is therefore **not** picking the skill-matched band, and
> 200NLH may sit *further* from his table than 50NLH does. No band in this corpus "is" his
> game. See DEC-082.

**What the data below actually shows, stated correctly.** The gradient is real and the
numbers are unchanged — what changes is what they license. A stake band is not a dial on one
underlying game; each band **is a different game type**, and the metric vector is what
identifies it. Founder: *"IE 200NL 3bets 57% more, it's instantly a different type of game,
and our preflop charts for that game are almost certainly off. They likely checkraise more,
bet thinly for value more."*

| stat | 50NLH (what the artifacts were fitted on) | 200NLH | difference |
|---|---|---|---|
| threeBet | 0.0289 | 0.0365 | +26.4% |
| pfr | 0.0847 | 0.0984 | +16.2% |
| vpip | 0.2134 | 0.1914 | −10.3% |
| cbet | 0.6050 | 0.5842 | −3.4% |
| foldToCbet | 0.5681 | 0.5599 | −1.5% |
| foldTo3Bet | 0.8581 | 0.8669 | +1.0% |

Read as: these are **two different games**, and a preflop chart fitted on the first is
wrong for the second — not by a scaling factor, but structurally. The 3-bet difference alone
implies different opening ranges, different defence frequencies, and a different postflop
mistake distribution downstream of both.

**What follows, and what does not.**

- **Does NOT follow:** "adopt 200NLH priors because that is the founder's stake." The premise
  is the mapping this correction retracts.
- **Does follow:** the shipped artifacts are fitted on *one specific game type* (50NLH online
  2009, FTP+PS), and that fact should be stamped on them as an identity, not as a stake label.
- **The open question this actually raises:** what is the metric vector of the founder's live
  1/2–1/3 game? That is measurable from his own tracked hands, and it is the only thing that
  can say which corpus slice — if any — is near his table in the space that matters. Until
  then every band here is *transferred, not measured*, and the transfer distance is
  **unknown rather than small**.
- **The exploitability question is the mistake distribution.** Founder: *"The types of
  mistakes usually dictate the game and how exploitable it is, and are going to be the polish
  study items before a session is played."* That reframes the deliverable: the useful output
  of a corpus slice is not a prior table but a characterisation of what that pool gets wrong.

**Two population gaps, not one.** This stake/site gap sits *on top of* the online-2009 vs
live-9-handed gap already in DISCLAIMER-AND-FAULT-REGISTER §3. Both are transfers, and only
one was written down. The numbers above are **transferred, not measured**, for the live
game — and per the correction above, the bb-matched band is not the closest one.

---

## 5. What changed in code

`scripts/backtest/corpus_stamp.py` (new) and `mine-pool-reference.py` now stamp
`provenance.corpus` with `dirCount`, `handFileCount`, the directory list, the sparse
patterns, and the dataset commit.

The reason is §2's two `unknown` rows. `corpusRoot` is a path and the dataset commit is a
commit — **neither can distinguish a 2-directory tree from a 27-directory one.** Two runs at
the same commit, on 8% and 100% of the data, produced different numbers and identical
provenance. That is precisely how this survived unnoticed from 2026-07-25 to 2026-08-15.

Verified: run against G16's 2-dir tree the stamp reports `dirCount: 2,
handFileCount: 1756` — the slice is now visible in the manifest.

---

## 6. Open

- Re-mine at full corpus, each emitting a Result Card: `fold-vs-sizing`, `behavior-policy`
  (coordinate with **WS-490** — do not re-mine onto an unrecorded provenance), behavioral
  features, pole priors.
- Stamp the remaining miners with `corpus_stamp` — the Python miners share the
  `os.listdir(corpus_root)` idiom, so this is uniform.
- **G16's corpus is still the 2-dir slice.** It has 28 GB free (95% full) against ~15 GB of
  working tree plus ~1.7 GB of pack. Deliberately not expanded without a call on the disk.
- **Founder decision, now with numbers behind it:** adopt full-corpus stake-stratified
  priors wholesale, or stage by downstream consumer. §4 says the stake gradient is real and
  the founder's stake is mis-fitted by 26% on 3-bet, so this is no longer a cost question.
- The register entry for the stake/site population gap (WS-492 accept criterion) is not yet
  written; `DISCLAIMER-AND-FAULT-REGISTER.md` was being edited by another live session.

## Reproduce

```bash
# full-corpus arm (cm-node1, all 27 dirs materialised)
python scripts/backtest/mine-pool-reference.py \
  --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
  --miner-path  C:/Users/chris/data/phh-mining \
  --out out/pool-reference-full27.json --workers 4

# 2-dir arm (G16, clean worktree at 48bd185e, sparse set unchanged)
python scripts/backtest/mine-pool-reference.py \
  --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
  --miner-path  C:/Users/chris/data/phh-mining \
  --out out/pool-reference-2dir.json --workers 8
```

Artifacts: `out/pool-reference-full27.json`,
`out/pool-reference-full27.corpus-stamp.json` (note: PowerShell-written, UTF-8 **with BOM** —
read as `utf-8-sig`).
