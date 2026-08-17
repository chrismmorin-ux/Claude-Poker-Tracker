# Runbook — the baseline EV run

**Who this is for:** you, starting the run yourself, in a fresh session, without help.
**How long it takes:** about 4 hours of the computer working. About 10 minutes of yours.
**What you get:** one number with an honest error bar, and a file that lets you ask
follow-up questions for the next several months without ever running this again.

Read section 1 and section 8. The rest you can come back to.

---

## 1. What this measures — and what it does not

The engine looks at a real hand from 2009, at one moment where a player had to act, and
says what it would have done. We already know what actually happened and what the hand
paid. The measurement asks:

> **If you had followed our advice at that one moment, and the rest of the hand had played
> out the way it did, would you have made more money than a typical player in that spot?**

The answer comes out in **big blinds** — at your 1/2 game, one big blind is $2.

### Four things it is not

**It is not a winrate.** Each hand's result is counted once for every decision in it, so a
hand with three scored decisions contributes its whole result three times. The number is
"expected value of a hand, measured at a decision", not "expected value per hand". Reading
it as a winrate overstates it by roughly the number of decisions per hand.

**It is not your game.** The hands are online 6-max cash from July 2009. You play live
9-handed 1/2–1/3. Those are different populations and this repo has never merged them. Any
live reading of this number is **transferred, not measured** — say so whenever you quote
it. This is the top-ranked entry in
[`docs/standard-of-record/DISCLAIMER-AND-FAULT-REGISTER.md`](../standard-of-record/DISCLAIMER-AND-FAULT-REGISTER.md).

**It only changes one decision.** Everything after the moment we advise on is the 2009
player's play, not ours. So this measures the value of substituting our action into an
otherwise-2009 hand. It does not measure the value of playing our whole strategy through a
hand. That is a real limit and it is also the right unit for learning, which happens one
decision at a time.

**It never sees your hole cards.** The corpus hides them until showdown. So the engine's
advice is averaged over every hand you *could* have held at that moment, weighted by how
likely each one is. That is a weaker claim than "we tested it on your actual hand" and it is
the strongest claim this data supports.

### What the run compares

Two versions of the engine, on exactly the same decisions:

| Arm | What it is |
|---|---|
| **depth-2** | The full engine, including the deep look-ahead. This is the real product. |
| **depth-1** | The same engine with the deep look-ahead switched off. |

You get both, plus the difference between them, for essentially the price of the depth-2 arm
alone — the shallow arm is cheap and rides along free. It is a control, not a candidate.

---

## 2. Pre-flight — five minutes, do not skip

### 2.1 Commit or stash your work first

Every result this repo has ever produced carries `engineDirty: true`, which means *"we
cannot tell you exactly which version of the code produced this number."* That is a
permanent asterisk on a 4-hour measurement, and it costs one command to avoid.

```
git status
```

If anything is listed, either commit it or stash it. When `git status` says
`nothing to commit, working tree clean`, you are ready. **Do not edit any file while the run
is going** — the check happens at the start, but a mid-run edit makes the stamp a lie.

### 2.2 Check the propensity table is there

```
dir out\behavior-policy.json
```

You should see a file of about 64 KB. This is the "what does a typical player do here"
table, and it is the denominator of the whole calculation. The run refuses to start without
it, on purpose — an unstated one would silently decide the answer.

### 2.3 Check the corpus is there

```
dir C:\Users\chris\data\phh-dataset\data\handhq
```

About 1.3 GB, 1,756 files.

### 2.4 Check disk space

The run writes about **60 MB**. Have 500 MB free and you will not think about it again.

### 2.5 Close what you can

The engine's deep look-ahead is on a stopwatch — it does as much thinking as fits in 2
seconds and drops the rest. **That means a busy machine gets shallower advice than an idle
one.** This is a known defect (section 9). Until it is fixed, the mitigation is behavioural:
close your browser and anything heavy, and let the run have the machine.

---

## 3. The command

One line. Copy it, paste it into the terminal at the repo root, press Enter.

```
node scripts/backtest/run-depth-ablation.mjs --reference none --behavior-policy out/behavior-policy.json --stakes 50NLH --max-files 300 --max-decisions 600 --refinement-ms 2000 --out out/baseline-ev-run1.json --card docs/standard-of-record/cards/RC-baseline-ev-run1.json --decisions-out out/baseline-ev-run1.decisions.jsonl
```

If you would like a copy of everything that scrolls past, add ` | Tee-Object out\baseline-ev-run1.log` to the end.

**Leave the window open.** Closing the terminal kills the run.

<details>
<summary>What each part of that line does</summary>

| Part | Meaning |
|---|---|
| `--reference none` | Do not use the shipped lookup table. It was built from the whole corpus, so using it here would be marking our own homework. Stating it explicitly is required — there is no default. |
| `--behavior-policy out/behavior-policy.json` | The "typical player" table. Also required, no default. |
| `--stakes 50NLH` | Which stake to read. |
| `--max-files 300` | Read 300 of the 1,756 corpus files, **drawn proportionally across the corpus directories** (90 Full Tilt / 210 PokerStars on this machine). Changed by WS-504 on 2026-08-17: it used to take the first 300 of a path-sorted list, and because directory names lead with the site code that was **300 Full Tilt files and zero PokerStars** — while the Deal Book called itself `allsites`. Any earlier run of this command, including the one that produced `handhq-allsites-50NLH-1c560bcc`, was a one-site measurement. |
| `--file-selection` | Optional. Defaults to `proportional`. Pass `prefix` **only** to replicate a Result Card published before 2026-08-17 — it restores the single-site behaviour above, and is named rather than silent so that using it is a deliberate act. It governs the player cap as well as the file cap, because both were biased the same way. |
| `--max-decisions 600` | Stop after 600 scored decisions. Sized in section 4. |
| `--refinement-ms 2000` | Give the deep look-ahead 2 seconds per evaluation — the production setting. |
| `--out …json` | The summary file, the one you open. |
| `--card …json` | The Result Card — the formal, quotable record. |
| `--decisions-out …jsonl` | **The decision-by-decision record.** This is the file that stops you ever having to run this again to answer a new question. Section 8. |

</details>

---

## 4. How long, and why 600

About **4 hours**, plus a minute of start-up.

Measured on this machine: roughly 24 seconds per decision with both arms running. 600 × 24s
≈ 4 hours.

**600 is chosen to clear a bar, not to fill a night.** The result only counts if at least
**30 different players** contributed to it — fewer than that and the error bar is measuring
the sample size rather than the precision. Past runs produced roughly one contributing player
per 12 decisions, so 600 decisions should land near 45–50 players. That is comfortable margin
over 30, and it is why the number is not 400.

**Finishing matters more than being big.** The run walks players one at a time, all the way
through one before starting the next. So a run stopped at 70% is not "70% of the answer" —
it is the first 35 players and none of the rest, which is a biased sample and cannot be
rescued. If you have to choose between a smaller run that finishes and a larger one that
might not, choose the one that finishes.

---

## 5. What it looks like while it runs

```
Corpus scan LIMITED to 300 of 1756 matched file(s).
  realised composition: {"FTP-2009-07-01_2009-07-23_50NLH_OBFU":90,"PS-2009-07-01_2009-07-23_50NLH_OBFU":210}
Deal Book handhq-FTP+PS-50NLH-ae2172f5 — 300 file(s), path+size, sha256:ae2172f560eef…
Decision-level record streaming to out/baseline-ev-run1.decisions.jsonl
  read 25000 hands, 300 eval players
  ...
  indexed 300 EVAL players from 266826 hands
  scored 25 decisions
  scored 50 decisions
  ...
```

The first minute reads hands. Then it starts scoring, printing every 25 decisions. **Roughly
10 minutes per 25 decisions**, so `scored 300 decisions` should appear around the 2-hour mark.

**If you see `WARNING: working tree is dirty`** — stop it (Ctrl+C), commit, start again. It
will still produce a number, but the number will not identify the code that made it, and that
is the asterisk section 2.1 exists to avoid.

**Halfway check (optional).** At around 2 hours, open `out/baseline-ev-run1.json.partial` and
look at the `partial` block at the top. If `decisionsScored` is near 300 and
`contributingPlayers` is 20 or above, the run is on track to clear 30. If contributing players
is tracking well below that, the run will land short and you should plan a longer one next
time rather than quoting this one.

---

## 6. What "done" looks like

The last thing printed is a report. Four things to look at, in this order.

### 6.1 The control — check this first, before anything else

```
CONTROL OK — population-typical scored against itself: edge 0.0000 bb
```

This is a self-test. It scores "typical play" against itself and the answer has to be exactly
zero, by arithmetic. **If it is anything other than 0.0000, the whole run is void** — the
measuring instrument is broken and every other number on the page is meaningless. Do not read
past this line if it fails.

### 6.2 The admissibility block — is this quotable at all

```
ADMISSIBILITY
  contributing players 47 (absolute-arm bar: 30)
  paired delta + divergence quotable : true
  absolute arm edges quotable        : true
```

- **`contributing players` at or above 30** → the headline numbers are quotable.
- **Below 30** → the two absolute numbers must **not** be quoted. The *difference* between
  the arms and the "did the advice move" section are still readable, because the comparison
  is made decision by decision and the thing the bar guards against differences away.

Whatever it says, believe it. It is not being cautious; it is telling you which of the numbers
on the page are load-bearing.

### 6.3 Did the advice move

```
1. DID THE ADVICE MOVE?
   advice byte-identical         62.7%
   top-action flipped            40 (15.4%)
     flop  n=138  flips  1 (0.7%)
     turn  n= 77  flips  3 (3.9%)
     river n= 45  flips 36 (80.0%)
```

This needs no chips and no error bars — it is a straight count of how often the deep
look-ahead changed the recommendation. On the last run, essentially all the change was on the
river.

### 6.4 The money

```
2. DID THE MOVEMENT MAKE MONEY?
   delta (depth2 − depth1)     -0.4711 bb   [-2.7653, 1.3290]
   interval excludes zero: false

3. THE ABSOLUTE ARMS
   depth1  -1.0007 bb   [-11.6971, 9.7036]
   depth2  -1.4719 bb   [-12.1990, 7.6727]
```

The bracketed pair is the range the true value plausibly lies in. **Read the bracket, not the
middle number.**

---

## 7. The honest expectation: the interval will probably contain zero

You should expect the answer to come back as something like *"somewhere between −2 and +1 big
blinds, and we cannot rule out zero."*

**That is the likely outcome and it is not a failure.** Here is why.

The error bar is built by resampling *players*, because that is the level at which this data is
actually independent. Poker results vary enormously between players — far more than they vary
between strategies. With 45 players, that between-player spread is wide, and it is wide
regardless of how good the advice is. To make it narrow you need more players, not better
advice.

**So what is the run for, if it probably cannot say "the engine wins"?**

1. **It puts a ceiling on the claim.** "The advice is worth somewhere between −2 and +1 bb"
   rules out "the advice is worth +10 bb". Right now nothing rules that out, which is why no
   figure from this system is quotable.
2. **It is the first honest number.** Every prior attempt was killed before it reached the
   30-player bar. This would be the first one that is admissible at all.
3. **It becomes the yardstick.** Every future engine change gets measured as a difference
   against this, on the same hands — and a difference is far better determined than either
   level, because the same decisions feed both sides and the noise cancels.
4. **The decision-by-decision file is the real prize.** The headline is one number. The file
   underneath it is a few hundred thousand facts. See section 8.

A wide interval honestly reported beats a narrow one you cannot trust. This repo has had the
second kind before.

---

## 8. What you will be able to ask afterwards — without running it again

This is the point of the run, and it is new.

The run writes `out/baseline-ev-run1.decisions.jsonl` — one line per decision, about 80 KB
each, ~50 MB in total. Each line holds **everything the engine knew and everything it
decided** at that moment: the board, the pot, the stack, the position, who was in the hand,
every candidate action it considered *with the EV it assigned to each one*, what a typical
player would have done, what the hand actually paid, and how deep the look-ahead actually got.

Nothing is pre-summarised. The headline number is a **view** over this file, not the product
of it. So the following can all be answered later, in seconds, by reading the file — no engine,
no second night:

| You can ask | Because the file holds |
|---|---|
| **Which spots make the money, and which lose it** — by street, position, board texture, bet size, stack depth, how many players are in | Every one of those, stored raw and unbucketed, next to that decision's result |
| **Which players we beat and which beat us** | The player identifier on every row, and the raw counts per player |
| **Which sub-archetypes we beat** — once archetypes are defined | Same: archetypes are a grouping applied to the player identifiers later |
| **Which decisions were close calls** | The engine's *whole* ranked list of candidate actions with their EVs — not just the winner. A future improvement flips the argmax exactly at the near-ties, and the file says which those were and by how much |
| **Was this decision's contribution driven by the odds or by the outcome** | `pi_ours`, `pi_pool`, the weight and the realised result are all stored separately and never multiplied together |
| **What the deep look-ahead actually changed, decision by decision** | Both arms' answers on the same row |
| **How much of the run the stopwatch decided** | Which refinement stages ran, which were dropped for time, and whether the budget was blown, per evaluation |
| **Where our read on a hand was wrong** | Where the corpus showed the cards, the actual holding, and how our range ranked it |

### One caution on that last row

The corpus only reveals a hand at showdown. So the "actual holding" is only present on hands
that got there — which contains **zero folds** and over-represents the stronger half of every
range. It is a fine handle for *browsing* ("show me the hands where the engine wanted to barrel
and I had nothing") and it is not a fair sample for *measuring*. The file records how often
truth was available so the size of that gap is itself checkable.

### Reproducibility: run it twice

The single most useful number missing from this repo is **the same run, twice, with both
answers printed side by side.** Without it, nobody knows how much of a future +0.3 bb
improvement is real and how much is the machine being in a different mood.

When run 1 finishes, start run 2 with the identical command and only the three filenames
changed to `run2`. Two runs is one overnight. Because both walk the same players in the same
order, the two decision files line up row for row, so the comparison can be made decision by
decision — far tighter than comparing two headline numbers.

That difference is the **floor**: any future improvement smaller than it is indistinguishable
from noise.

---

## 9. Known defects you are running with, stated up front

**Fixed before this run:** the deep look-ahead used to draw its sample runouts at random with
no seed, so the same decision could give different advice twice for no reason. It is now
seeded and reproducible. Verified: two identical short runs produced identical advice on every
decision and the same headline number.

**Not fixed, and you are running with it:** the deep look-ahead is bounded by a **stopwatch**,
not by a fixed amount of work. It thinks for 2 seconds and drops whatever did not fit. On the
test runs it consistently blew that budget and dropped 3 of its 6 refinement stages. **So a
busy machine literally gets different advice than an idle one.** Fixing this properly means
replacing "2 seconds" with "this many branches", which is a real change and should not delay
this run. The mitigation is section 2.5 — give the run a quiet machine — and the decision file
records, for every single evaluation, exactly which stages the clock cut, so the run can
diagnose its own variance afterwards. Tracked as **WS-411**.

**Also still unseeded:** the raw equity calculator (`monteCarloEquity`) that both arms use. Its
noise is ordinary sampling error that averages out over 600 decisions; it is not
machine-dependent the way the stopwatch is. Tracked as **WS-412**.

---

## 10. If something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| `Refused: --reference is required` | A required flag is missing | Re-copy the command from section 3 |
| `No corpus files matched` | The corpus is not where it is expected | Check section 2.3 |
| `CONTROL` is not `0.0000` | The instrument is broken | **The run is void.** Do not quote anything from it. Report the number you saw |
| `contributing players` under 30 | Not enough different players | The paired difference is still readable; the two absolute numbers are not. Next run, raise `--max-decisions` |
| `WARNING: working tree is dirty` | Files changed since the last commit | Ctrl+C, commit, start again |
| The run stops early / you close the window | Partial, biased toward the first few players | See below |

### If it is interrupted

Two files survive, and they are not equal:

- `out/baseline-ev-run1.json.partial` — a partial summary. **Do not quote the number in it.**
  It contains every decision of the first few players and none of anyone else's, so it is one
  or two people's results wearing a confident-looking average. The file says so itself, in its
  own `caveat` field.
- `out/baseline-ev-run1.decisions.jsonl` — every decision it got to, each one complete and
  individually valid. The *average* over them is biased; the *individual rows* are not. Keep
  this file; it is real evidence and it cost real hours.

To restart, just run the command again. There is no resume — it starts from the beginning.

---

## 11. When it is done

1. Check `CONTROL` is `0.0000`.
2. Check `contributing players` is at or above 30.
3. Keep all four files: the summary, the Result Card, the decision file, and the log.
4. Start run 2 (section 8) so the reproducibility floor exists.
5. Commit the Result Card. It is the formal record; the numbers become citable from it.
6. **Regenerate the Hole Map.** One line:

   ```
   npm run hole-map
   ```

   **Why this belongs here and not somewhere else.** The Hole Map (View 7,
   `docs/standard-of-record/SCORED-READOUT-SPEC.md` §9bis) reads the behaviour policy, the
   measured fold curves and the shipped engine's own predicted fold rate. A baseline run is
   the moment those inputs changed. If you skip this step, `out/hole-map.html` keeps showing
   the *previous* engine's predicted-fold column and the `model-suspect` verdicts derived from
   it — and it will look exactly as authoritative as it did yesterday.

   The command picks up the `--decisions-out` sidecar from step 3 automatically and says so.
   With the sidecar present the map is strictly better than without it: the per-action EV
   column stops being empty (§9bis.9).

7. **If you did not regenerate, check instead.** Sub-second, pure git, no corpus pass:

   ```
   npm run hole-map:check
   ```

   It prints whether any commit touching the engine has landed since the map was generated,
   **names those commits**, and rewrites the banner at the top of `out/hole-map.html` in place
   so the page you open tells you the truth. Exit `0` = current, `1` = stale, `2` = no
   provenance / no artifact.

---

*Written 2026-08-05 for WS-393. If a command in here does not run, that is a bug in this
document — every one of them was executed before it was written down.*
