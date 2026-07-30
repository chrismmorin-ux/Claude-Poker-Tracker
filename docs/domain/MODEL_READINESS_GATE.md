# The Model Readiness Gate

**Status: CLOSED** · Established 2026-07-27 · Tracked by **WS-286**

---

## What this is

A stake in the ground. It defines — **in advance, in numbers** — the point at which the
poker model and engine are good enough and *stable* enough that the founder should stop
building and start **studying**.

When every criterion below is met, the gate opens, sprint composition halts, and the
founder is told: **the theory is ready to learn.**

## Why it is written before it is reached

The gate exists because of what WS-285 exposed. For months the engine's context hierarchy
was ordered by a code comment asserting board texture mattered most. It had never been
measured. When it finally was, the assertion was not just wrong — it was close to the exact
inverse of the evidence, and it had been quietly costing accuracy the whole time.

A readiness bar defined *after* the fact is the same failure. "Good enough" would get
declared at whatever the numbers happened to be, and the declaration would feel earned.
So the numbers are fixed here, first, while nobody knows whether they are easy.

**Corollary — do not edit a threshold to open the gate.** Changing a bar is a founder
decision recorded as a decision, with its reason. Moving one silently to clear it defeats
the entire artifact.

## What the gate is actually protecting

The founder's stated purpose is to **memorize this theory and apply it at the table.**
That makes two things load-bearing, not one:

1. **Accuracy** — the theory must be right, or you memorize errors.
2. **Stability** — the theory must have stopped moving, or you memorize a draft.

A model can be accurate and churning (bad to learn — it will change under you) or stable
and mediocre (bad to learn — it is wrong). The gate requires both.

---

## The six criteria

| # | Criterion | Bar | Today | Status |
|---|---|---|---|---|
| C1 | Villain prediction accuracy | ≥ 60.0% **and** lift ≥ 8.0% | 58.7%, 6.03% | ❌ |
| C2 | Calibration honesty | worst bucket error ≤ 0.050 (n ≥ 100) | 0.058 | ❌ |
| C3 | Hero-EV validated | instrument exists; edge CI excludes 0 | no instrument | ❌ |
| C4 | Theory stability | 0 overturns in last 3 protocol runs | 1 (WS-285) | ❌ |
| C5 | Doctrine currency | protocol not stale; algorithms documented | 32-day drift | ❌ |
| C6 | No regression | 3 consecutive runs, no metric regressed | 1 run recorded | ❌ |

---

### C1 — Villain prediction accuracy · **≥ 60.0% accuracy AND ≥ 8.0% lift**

Paired backtest over the corpus, scored by `calibrationMetrics.js`, same protocol as
`dump-records.mjs --arms candidates`.

*Today: 58.7% / 6.03% (WS-285, 2026-07-27).*

**Why this bar.** WS-285 moved accuracy 52.2% → 58.7% in a single change, so 60% is not a
stretch — but it cannot be reached by tuning. It requires at least one more genuine
improvement (WS-283's fold curve is the obvious candidate). The bar is set where luck
cannot carry it.

**Why accuracy AND lift.** Accuracy alone can rise because the decision mix got easier.
Lift is measured against the population baseline on the *same* decisions, so it cannot.

---

### C2 — Calibration honesty · **worst bucket error ≤ 0.050**, buckets with n ≥ 100

*Today: 0.058 (80–100% bucket: predicts 86.8%, happens 81.0%).*

**This is the most important criterion for a curriculum, and the least obvious.**

A curriculum teaches you to act on the engine's confidence. If the engine says "villain
folds 64% here" and villains actually fold 53%, you will memorize a false number and bet
into it at the table. Accuracy does not catch this — a model can rank actions correctly
while being systematically overconfident about all of them.

Before WS-285 the worst error was 0.109 and the model was *most* wrong exactly where it was
*most* sure. That is now 0.058. The bar closes the remaining gap.

---

### C3 — Hero-EV validated · **the instrument exists and shows a positive edge**

**Nothing in this repo currently measures whether the engine's advice makes money.**

Every number above scores *villain action prediction* — what the opponent will do. That is
an **input** to good advice, not evidence of it. Between a correct villain model and a
correct recommendation sits the entire §6.1–6.4 value/bluff/MDF spine, plus sizing, plus
multiway math — and the multiway part is already known to have a gap (WS-277). None of it
has ever been scored.

The founder would be memorizing the *output* of that unmeasured layer.

**Bar:** an instrument exists that replays corpus hands, takes the engine's recommended
action at each hero decision, and scores realized EV against stated baselines
(always-fold/check; population-typical play). The engine's edge must be **positive with a
95% CI excluding zero** on held-out data, under the WS-259 two-level split (POOL/EVAL
players **and** walk-forward in time) so corpus-mined priors cannot leak in.

Built by **WS-287**. This is the largest piece of work between here and the gate, and it is
the one that decides whether the curriculum teaches something true.

---

### C4 — Theory stability · **zero overturns across 3 consecutive protocol runs**

An *overturn* is a change that invalidates a load-bearing claim already documented in
POKER_THEORY.md — not an addition, not a refinement. WS-285 was an overturn: §11's context
hierarchy was documented, taught, and wrong.

Logged in `docs/domain/readiness/overturn-ledger.yaml`, appended by the domain-correctness
protocol. Also requires **zero open findings** classified as *could overturn a documented
claim*.

**Why three runs.** One quiet run means nobody looked hard. Three consecutive means the
instrument has been pointed at the theory repeatedly and stopped finding load-bearing
errors. That is the difference between "no known problems" and "we searched."

*Today: 1 overturn (WS-285) in the current window. The counter restarts from 2026-07-27.*

---

### C5 — Doctrine currency · **protocol current, algorithms documented**

You cannot teach what is not written down, and you must not teach what is written down but
no longer true.

- `domain-correctness` challenge protocol is **not stale** (currently 32 days of drift
  between its event log and its YAML — this is what caps the program at 2/9; **WS-268**).
- Every load-bearing engine algorithm appears in POKER_THEORY §11 with its measured basis.
- Zero known contradictions between POKER_THEORY.md and `exploitEngine/CLAUDE.md`.

---

### C6 — No regression · **3 consecutive runs, no metric regressed beyond noise**

"Reliable **and consistent**" — consistency is its own bar.

Every readiness run appends to `docs/domain/readiness/scorecard-history.yaml`. C1–C3 metrics
must not regress across the last three runs beyond paired-test noise (CI overlapping zero is
not a regression; a significant negative delta is).

This catches the failure where a change improves the headline and quietly degrades a slice —
the thing the per-level analysis in WS-285 caught only because someone went looking.

---

## Checking the gate

```bash
node scripts/readiness/model-readiness.mjs            # human summary
node scripts/readiness/model-readiness.mjs --json     # machine
node scripts/readiness/model-readiness.mjs --record   # append a run to scorecard-history
```

Exit code `0` = gate OPEN, `1` = still closed, `2` = evidence missing/stale.

A **SessionStart hook** runs this every session. When the gate opens it raises a blocking
banner and holds sprint composition until acknowledged.

**Criteria the script cannot judge mechanically** (C4's "load-bearing", C5's "documented")
are read from ledger files that a human or protocol run must maintain. The script reports
those as `ATTESTED` with the attestation date and **fails them when the attestation is
stale** — it never assumes an unverifiable criterion is met.

---

## What happens when it opens

The gate is a cue, not a finish line. It triggers, in order:

1. **WS-288** — the full report: what we built, what we tried, what lost and why, every
   lever and mapping, with the measurements that decided each one.
2. **WS-289** — the theory rewritten to be *learnable*: progressive, memorizable, ordered
   for a human at a table rather than for an engine.
3. **WS-290** — comprehension and application measurement, at the founder's own request
   (owner-volunteered, so it clears the standing refusal on system-imposed grading).

Then the founder sits down and studies.
