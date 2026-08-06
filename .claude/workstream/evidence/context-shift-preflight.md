# Context Shift — pre-build measurement gate (WS-424)

**Run 2026-08-05, before any organ was built.** WS-424's accept criteria require two things to be
known *before* the expensive work, not after: whether the secondary instrument can carry the study,
and — following the founder's DF2 ruling — a *derived* ceiling rather than a bigger arbitrary one.

Instrument: `scripts/context/echo-meter.mjs`. Raw data: `echo-baseline-30.json`.

---

## 1. Cheapest invalidation — attributable echo at session granularity

`A = E(O,R) − E(O,D)`: the fraction of the output's content 5-grams appearing verbatim in the
session's actual read-set, minus the same against a size-matched decoy of repo markdown the session
did *not* read.

**A defect in the instrument was found and fixed before the numbers were taken.** The first
implementation counted only `Read`/`Grep`/`Glob` as reads. In this repo `Bash` outnumbers `Read`
about 5:1 (152 vs 30 in one sampled session) — `cat`, `grep`, `git`, `head` — and that stdout enters
the context window exactly as a `Read` result does. Excluding it undercounted the read-set and
deflated `E(O,R)` by roughly 75%. All figures below are post-fix.

### Result — 26 sessions scored (of the 30 most recent; 4 skipped as too short)

| Quantity | n=5 grams | n=3 grams |
|---|---:|---:|
| mean `A` | 0.00808 | 0.02185 |
| session-to-session SD | 0.00811 | 0.01621 |
| coefficient of variation | **1.004** | 0.742 |

**Sessions needed per arm, 80% power, α=.05, between-session design:**

| Effect to detect | Sessions per arm |
|---|---:|
| 50% relative change | 64 |
| 30% relative change | 176 |
| 20% relative change | 396 |

### The verdict the criterion asked for

**The continuous signal does not exist at session granularity.** CV ≈ 1.0 — the standard deviation
equals the mean. Detecting even a *halving* of attributable echo would take 64 sessions per arm, 128
total. This project has produced 57 transcripts in its entire life. The 60-day gate cannot deliver
that, so a between-session A/B on attributable echo is not a viable instrument and must not be
written into the pre-registration as though it were.

**The variance is not a size artifact, so normalising will not rescue it.** Correlation of `A` with
output size is −0.236 and with read bytes 0.178 — both weak, despite a 36× spread in session size.
Sessions differ in *what they are*: a planning conversation and a read-heavy audit are not
comparable units. Stratifying by size would not reduce the noise because size is not what is varying.

### What WOULD make it conclusive — two routes, both real

1. **Pair within session, don't compare across sessions.** The entire measured variance is
   *between-session*. A design where the same session produces both a withheld and a non-withheld
   artifact removes that term by construction rather than averaging it down. This is the strong fix
   and it costs a harness change, not more calendar time.
2. **Move the unit of analysis from the session to the artifact.** 26 sessions is a small n; the
   artifacts those sessions produced are more numerous and far more homogeneous.

Route 2 is what the pre-registration's **primary** instrument already does. That was initially
recorded here as meaning *the primary instrument is unaffected*. **That was wrong, and measuring it
rather than assuming it is what caught it — see §1a.**

---

## 1a. The primary instrument is ALSO underpowered, and the pre-registered gate is wrong

Artifact *count* was reachable, so the primary instrument looked safe. Its *variance* had not been
measured. Instrument: `scripts/context/vocab-rate.mjs`, scoring
`V = rate(treatment) − rate(control)` per 1,000 words over 176 artifacts (203,850 words) created
2026-07-22..2026-08-05.

| Unit of analysis | n | mean V | SD | CV |
|---|---:|---:|---:|---:|
| per artifact | 176 | 1.9038 | 4.0765 | **2.141** |
| per 1,000-word block | 115 | 2.0087 | 3.7311 | **1.857** |

**The artifact was never the right unit.** The statistic is *defined* per 1,000 words, and a 60-word
finding is not an exchangeable draw with a 4,000-word ticket — one term hit in a short artifact reads
as 16/1k and inflates the variance while carrying almost no information. Re-blocking to a fixed
1,000 words is the correct unit and it lowers CV from 2.14 to 1.86. It does not lower it enough.

**WS-424's gate of `n ≥ 40 artifacts` is short by roughly 7×.** At 40 artifacts (~46 blocks) the
minimum detectable effect is about **108%** — the study could only detect V *doubling*. Shipping
that gate would have guaranteed an uninterpretable result while looking rigorous, which is the exact
failure mode this whole ticket exists to stop.

**The binding constraint is the baseline arm, not the calendar.** The baseline is capped near 120
blocks because nearly every dated artifact in the repo was created in the last 14 days. With the
baseline fixed, extending the treatment arm barely helps:

| Baseline blocks | Treatment blocks | Min detectable effect |
|---:|---:|---:|
| 115 | 115 | 68.6% |
| 115 | 230 | 59.4% |
| 115 | 435 | 54.5% |
| 115 | 870 | 51.6% |

Running for a year instead of 60 days moves it from 55% to 52%. **The honest pre-registered minimum
detectable effect is a ~55% relative change in V** — roughly, the study can detect the compact tier
halving or doubling the gap, and nothing finer.

### What removes this limitation — and it is cheap

**Enlarge the baseline arm using git-derived creation dates.** The population rule bans `mtime` for a
good reason, and `created_at` frontmatter exists only on queue items and findings. But
`git log --diff-filter=A --format=%aI -- <file> | tail -1` gives a file's *true first-commit date* —
it is a creation date, not a modification date, so it satisfies the rule's intent exactly. That opens
`docs/`, `system/`, `.claude/context/`, and session files to the baseline arm, which is where most of
this repo's prose actually lives. This is the difference between a study that can see a halving and
one that can see a quarter-change, and it costs one function.

That work is named, costed, and belongs in the pre-registration before it freezes — not deferred.

### The sharper signal found on the way

**Cited-but-unread: 33 of 61 citations (54.1%) across 26 sessions** name a file as a source that
never entered the read-set. That is the exact signature the requirements describe — a conclusion
reproduced in structure while its mechanism was wrong, recalled rather than read. It is a boolean per
citation, it is cheap, and nothing computed it before today. It is reported here as a **baseline
observation, not as a pre-registered result** — the regex that finds citations is conservative
(repo-relative paths with an extension) and its denominator is therefore a floor, not a count.

**`E(O,D)` is exactly 0.00000 in every one of the 26 sessions at n=5.** The decoy control never
fires: verbatim 5-content-word collisions between unrelated repo documents do not happen. So at n=5,
`A ≡ E(O,R)` and the control is inert. It is retained anyway because it is the thing that would
detect the failure if the gram size were ever lowered — at n=3 it is no longer inert.

---

## 2a. CORRECTION — the premise under §2 was wrong, and §2 is superseded

**Recorded 2026-08-06, after the founder rejected the framing. The original §2 is left
below with this correction on top rather than deleted, because the reasoning that produced it
is seductive and reads as rigour.**

**The inherited premise: "accretion rate is the driver of drag."** Taken from the handoff and
the judge's S1, adopted without ever being tested. POKER_THEORY grew 62.5% in ten days at
156 lines/day, and that was recorded as a pathology "with no ceiling."

**It is not a pathology. It is the return on a large exploration and testing phase.** The
document grew because the project learned that much, that fast. Writing it down is the
correct behaviour. Treating knowledge production as the disease, and then building machinery
to cap and evict it, inverts cause and asset — and it is precisely the measurability bias the
repo's own standing rule names: shrinking the work to fit the instrument.

**The real limitation, stated correctly: the always-loaded channel does not scale with what
the project learns.** That is a defect in the channel, not in the learning. The two
diagnoses point in opposite directions — one says cap the document, the other says build a
channel that can carry more, on demand, at higher throughput.

**The founder demonstrated the correct move on the fleet context the same day:** the fleet
knowledge was not shrunk, it was **routed** to a skill that loads when triggered, leaving a
23-line always-loaded spine. Load freed, knowledge preserved. That is what "organise around
the injection point" (S1) actually implies, and it is what `docs/context-bundles.md` exists
to do for this repo's doctrine.

**What this invalidates concretely — the decay schedule in §2 below:**

1. **It budgeted the high-value channel against the low-value one.** S1 holds that position
   dominates volume, so a per-turn byte is worth more than a session-start byte. Capping the
   per-turn injection at one tenth of the session-start read rations the expensive channel to
   protect the cheap one.
2. **It decayed in anti-correlation with need.** The drift this system exists to stop is
   *mid-session* drift — the recorded evidence is that this design's own session had its
   behaviour externally forced **twice, mid-session**. At turn 40 the schedule cut the
   behavioural spine to 400 bytes and dropped 13 of 16 rules.
3. **There was no budget problem to solve.** Measured after the fact: the full 16-rule tier is
   **1,912 bytes**. Emitted at *every* turn of a median 5-turn session that is **1.9% of one
   session-start load**, and **3.4%** of what is already injected unconditionally every
   session. The constraint was invented.

**Superseding rule, now implemented in `.claude/hooks/compact-tier.cjs`: the ceiling is FLAT
at 8,000 bytes and the full rule set is emitted at every turn.** The ceiling is a backstop
against the rule set growing without bound — not a ration on what a session may be reminded
of. A rising schedule (more reminder as drift accumulates) is the next thing worth testing;
flat already dominates decaying.

**Two of §2's own numbers were also wrong and are corrected here:** the "51,684 bytes" of
harness injection **excluded the global `CLAUDE.md` entirely**. Measured on 2026-08-06 the
total is **56,435 bytes** — and it went *up* partly because this session added
`.claude/rules/dispatch-dont-assert.md` to the always-loaded path while designing machinery to
shrink the per-turn one.

---

## 2. The derived ceiling — SUPERSEDED BY §2a, retained as the record of a wrong turn

The founder refused the 2,000-byte contention between WS-423's doctrine tier and WS-424's injection
channel as a false constraint. That ruling carries a debt: a new ceiling has to be *derived*, and it
still has to stop the compact tier becoming the monolith it replaces.

**The unit of cost is S1's own: bytes × turns.** The session-start load is paid once; a
`UserPromptSubmit` injection is paid every turn. So the two are not comparable per-byte, and the
ceiling depends on a quantity nobody had measured: how many turns a session actually has.

### Measured — 29 sessions

| | turns |
|---|---:|
| min | 1 |
| p25 | 2 |
| **median** | **5** |
| p75 | 7 |
| mean | 9.0 |
| max | 60 |

The distribution is severely right-skewed: mean 9 against median 5, with a 60-turn tail.

**Measured denominator — the mandated session-start load is 490,263 bytes** (verified today, not
inherited: POKER_THEORY 213,851 · queue-index 75,655 · SYSTEM_MODEL 72,285 · VOCABULARY 35,536 ·
CLAUDE.md 33,774 · DISCLAIMER 30,859 · state.md 28,303). Of that, **51,684 bytes are harness-injected
every session and cannot be withheld by any mechanism** (root `CLAUDE.md` + all seven
`.claude/rules/*.md`) — the true residue named in S6.

### The finding that changes the design

A flat ceiling prices the median and the tail identically, and they are not alike. At a flat 8,000
bytes the median 5-turn session pays 40,000 bytes; the 60-turn tail pays **480,000 — the entire
session-start load again.** A constant is the wrong shape for a per-turn cost when turn count varies
12× between the median and the tail.

**So the ceiling is a decay schedule, not a number** — which is S1's thesis (*position dominates
volume*) applied to its own budget. The first turns are where the prior is set; turn 40 is not.

Budgeting total session injection at ≤10% of the session-start load (48,600 bytes):

| Turns | Ceiling | Rationale |
|---|---:|---|
| 1–2 | **8,000 B** | Where the framing is set. 4× the rejected flat ceiling — this is the raise. |
| 3–8 | **2,000 B** | The old ceiling, now applied where it was always appropriate. |
| 9+ | **400 B** | Invariant spine only. The session already has its context. |

**Cost at each point of the measured distribution:**

| Session | Injected total | % of session-start load |
|---|---:|---:|
| median (5 turns) | 22,000 B | 4.5% |
| p75 (7 turns) | 26,000 B | 5.3% |
| max (60 turns) | 48,800 B | **10.0%** |

The tail lands on the budget exactly, which is the property a flat ceiling cannot have. The head gets
8,000 bytes — enough for WS-423's doctrine tier and WS-424's method channel to share it without
either being rebuilt, which was the contention DF2 refused.

**What still enforces "not the monolith":** 8,000 bytes is 3.7% of POKER_THEORY.md. The emitter
slices its own output to the schedule, so the ceiling is an invariant of the producer rather than a
check that can fail — and the schedule is a function of turn index, which the emitter always knows.
