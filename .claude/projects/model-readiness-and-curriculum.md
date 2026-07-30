# Project — Model Readiness & Curriculum

**Established** 2026-07-27 · **Program** domain-correctness · **Gate** WS-286

## The arc

The founder is going heads-down on domain correctness until the poker model is good
enough and stable enough to *learn*, then switching from builder to student.

```
  WS-287  hero-EV instrument        <- the missing measurement
     |
  WS-286  🚩 READINESS GATE         <- the flag; halts work when it opens
     |
     +---- WS-288  build report      what we made, tried, and rejected
     |
     +---- WS-289  learnable theory + curriculum
                |
              WS-290  comprehension + application measurement
```

## Why a gate at all

The founder's purpose is memorization. That makes **stability** a first-class
requirement alongside accuracy: an accurate but still-churning theory is a draft you
will have to relearn, and a stable but wrong one teaches errors. The gate requires
both, across six criteria fixed in advance in `docs/domain/MODEL_READINESS_GATE.md`.

Fixed **in advance** because of what WS-285 exposed. The engine's context hierarchy had
been ordered for months by a code comment nobody had tested; when finally measured it
was close to the exact inverse of the truth. A bar set after the fact repeats that
error — "good enough" gets declared at whatever the numbers happen to be, and it feels
earned. So the numbers were written down while nobody knew whether they were easy.

**Thresholds are not editable to open the gate.** Moving one is a `/decide` with a
recorded reason.

## Current state (2026-07-27)

**Gate: 0 / 6.**

| # | Criterion | Bar | Today |
|---|---|---|---|
| C1 | Villain prediction | ≥60.0% acc, ≥8.0% lift | 58.7%, 6.03% |
| C2 | Calibration | worst bucket ≤0.050 | 0.058 |
| C3 | Hero-EV | edge CI excludes 0 | **no instrument** |
| C4 | Theory stability | 0 overturns / 3 runs | 1 overturn, 1 run |
| C5 | Doctrine currency | protocol current | 32d YAML/event drift |
| C6 | No regression | 3 clean runs | 1 run recorded |

Nearest to falling: **C5** (WS-268 reconciles the drift) and **C1/C2** (WS-283's fold
curve is the obvious next lever). Furthest: **C3**, which is a build, not a tune.

## The thing this project exists to prevent

Certifying the wrong quantity. Every metric the repo can currently produce scores
**villain action prediction** — what opponents do. Nothing scores whether hero's
**recommendations** make money. Between the two sits the §6.1–6.4 value/bluff/MDF
spine, sizing, and multiway math, none of it ever measured, and WS-277 already found a
gap in its multiway half.

The founder would be memorizing the output of that unmeasured layer. Hence C3, and
hence WS-287 being the single largest piece of work in the project.

## Standing constraints

- **Labels are outputs, never inputs** — binds the curriculum as hard as it binds the
  engine. Teaching "fold more in EP" would install in the founder the anti-pattern the
  engine is forbidden to have.
- **High concept granularity; learning state, not tier rank** (self-coach doctrine).
- **Owner-volunteered assessment only** — WS-290 exists because the founder asked to
  be measured. If it ever becomes something the app does unprompted, it has crossed
  back over the standing refusal on imposed grading.
- **Live/online separation** — WS-285's corpus evidence was admissible because it
  transferred estimator *structure*. A hero-EV edge is closer to a *value* and the
  separation may genuinely bind. Unresolved; flagged on WS-287.

## Mechanics

```bash
node scripts/readiness/model-readiness.mjs           # status
node scripts/readiness/model-readiness.mjs --record  # append a run
```

`.claude/hooks/readiness-gate.cjs` (SessionStart) is silent until the gate opens, then
raises a blocking banner and holds sprint composition.

It lives in `.claude/hooks/` rather than `kit/` because the kit is synced from HomeBase
and a local edit there would be reverted by the next `/kit-upgrade`, taking the flag
with it and leaving no trace.

**It fails open** — a broken checker is indistinguishable from a closed gate. Run the
script by hand periodically; the domain-correctness protocol is the natural home for
that check.

## Evidence files

| File | Role |
|---|---|
| `docs/domain/MODEL_READINESS_GATE.md` | the stake in the ground |
| `docs/domain/readiness/scorecard-history.yaml` | append-only run history (C1–C3, C6) |
| `docs/domain/readiness/overturn-ledger.yaml` | overturned claims + attestations (C4, C5) |
| `out/records-candidates.json` | current baseline evidence |

C5 deliberately reads the **event-log** run date rather than the ledger's
`last_reviewed` self-attestation. The first version of the checker passed C5 because
the author wrote today's date beside their own name while the protocol was 37 days
overdue — the precise failure the gate exists to catch, reproduced inside the gate.
