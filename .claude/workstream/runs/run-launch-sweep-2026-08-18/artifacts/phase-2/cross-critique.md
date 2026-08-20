### CROSS-CRITIC — run-launch-sweep-2026-08-18

Every file:line below was opened by me this session. Where I contradict an expert I ran the
check myself, generally with a different tool than they used. Where I could not verify, I say so.

**Headline, stated first because burying it would be the failure this repo has rules about:**
H1 and H2 are not two findings. H2 is *void* as stated, and all four experts who "confirmed"
it did so without noticing that their own H1 conclusion destroys its premise. Separately, the
orchestrator's pre-registered falsifier for P2 **fired**, and the falsifier for P3 **could not
have detected the defect that was actually there** — a documented past failure of this repo,
repeated.

---

## 1. Wrongness audit — one verified defect per expert

**ARCHITECT — "3 of 23 IndexedDB stores" is wrong; it is 3 of 25, and he had the correct
source open in the same sentence.**
Key Concern #4 cites `.claude/context/SYSTEM_MODEL.md:501` for "23 stores." I enumerated the
`storesAdded` union across `src/utils/persistence/migrationRegistry.js`: **25 unique stores**
(activeSession, anchorCandidates, anchorObservationDrafts, anchorObservations, exploitAnchors,
hands, heroLeaks, perceptionPrimitives, playerDrafts, playerPhotos, players, postflopDrills,
preflopDrills, printBatches, rangeProfiles, sessions, settings, shapeLessons, shapeMastery,
sightingLogs, subscription, telemetryConsent, tournaments, userRefresherConfig,
villainAssumptions). `grep -c createObjectStore src/utils/persistence/migrations.js` = 25,
independently. He took the count from a doc he *simultaneously* condemned as 16 schema-versions
stale, in the same finding, while citing `migrationRegistry.js:504` (`getStoresAtVersion`) two
lines later as the authoritative enumerator. He had ground truth in hand and quoted the stale
doc. Security-engineer's hedged "~25" was the more accurate number and carried less confidence.

**Second architect defect, and it is brief-inheritance:** Key Concern #2 states *"Every 'NOT
READY' verdict in protocol_history (prog-launch.yaml:165-196) is stamped 'Inline
meta-aggregation, no new findings'."* False. `prog-launch.yaml:171` — the 2026-06-09 baseline —
ends *"Cleared first-run-required block."* and carries no such stamp. Three of four entries
have it, not four. That is verbatim the BRIEF's overstatement ("All four were recorded in
protocol_history as 'Inline meta-aggregation'") reproduced by an expert who opened the file and
opened his report with *"I re-verified it against current state rather than relaying it."*

**SENIOR ENGINEER — the phhAdapter failure is NOT a HEAD-only defect. The working copy fails
too, and he implied it does not.**
His Concern #1 describes swapping `git show HEAD:scripts/__tests__/phhAdapter.test.js` into
place, confirming FAIL, "then restoring the working copy" — the plain reading is that the
modified working copy is the fix in flight. I ran the working copy as it sits:
`npx vitest run scripts/__tests__/phhAdapter.test.js` → **1 failed | 21 passed**, failing at
`phhAdapter.test.js:205:23`, not the `195-197` he cited. There is no fix in flight. The finding
is worse than reported and the citation is ten lines off. This also reconciles his unexplained
arithmetic: he reported "2 failed" in the full run and named only one (the PlayerFinderView
timeout). The second was this one, in the tree he described as restored to passing.

**FAILURE ENGINEER — the v23/v24 clobber is real and I verified it, but "exactly the real
upgrade path for an existing installed user" is unsupported and the launch-exposed population
is zero.**
Verified: `migrations.js:1350` (`if (oldVersion < 23) migrateV23`) and `:1354`
(`if (oldVersion < 24) migrateV24`), neither guarded by `oldVersion > 0`; both open
`playersStore.openCursor()` on the same store in the same transaction (`:798-799`, `:870-871`);
both call `c.update(player)` (`:829` and the v24 walk). The hazard class is documented by the
codebase itself at `migrations.js:1077-1087`, and v27/v28 carry guards v23/v24 lack. Mechanism
**confirmed**. Exposure is not: on a fresh install (`oldVersion = 0`) migrateV1 creates
`players` in the same transaction, so both cursors walk an **empty store** — no records, no
clobber. New users at launch are *not* exposed, the opposite of what the concern asserts. The
exposed set is exactly "installs at DB version 1-22," whose existence — including on the
founder's own device — is asserted and never checked.

**PERFORMANCE ENGINEER — cites a build artifact that does not exist, and reports two different
totals for one measurement.**
He cites `dist/assets/index-CSjMXJ_6.js` at 782.0 kB. `ls dist/assets/index-*.js` returns
`index-6jypFfmm.js` (781,989 bytes, mtime 23:39) and no `CSjMXJ_6`; `dist/index.html:12`
references `6jypFfmm`. His hash is from a build a *concurrently running expert* overwrote
mid-run (senior-engineer reports `6jypFfmm`). The size reproduces; the artifact reference does
not. Separately his Concern #4 headline says "~1.25 MB raw / ~398 KB gzip" and its closing line
says "1332 KB raw / ~412 KB gzip" — the first excludes the stylesheet, the second includes it,
both labelled "critical path." Two numbers, one claim, no stated conditional: a direct
`intention.md` **P4** violation inside a finding whose severity rests on comparing that number
to a budget.

**SECURITY ENGINEER — claims to have re-verified all six findings, then his own table says he
re-verified two.**
Opening line: *"I re-verified all six against HEAD today; the affected files are unchanged
since 2026-08-07 (confirmed by direct read, not by trusting the finding text)."* His table
immediately below: FIND-101 *"not re-diffed line-by-line this pass"*; FIND-102 *"not
re-diffed"*; FIND-103 *"not re-diffed"*; FIND-104 *"not re-diffed"*. Four of six were verified
by **absence of a fix commit** — a materially weaker check than reading the file, while the
framing sentence claims the stronger one. His FIND-100 and FIND-105 checks are real: I
confirmed `AuthContext.jsx:294-296` calls only `deleteUser(auth.currentUser)` with no purge,
and `.github/workflows/ci.yml` runs `check-sor-additive.sh`, `check-label-ledger.sh`,
`check-guide-ledger.sh`, `npm test`, `coherence-scan.cjs` and a Playwright job with **no
`npm audit` step anywhere**. The defect is the headline overclaim — precisely the shape the
brief's "a file:line you did not open is a fabrication" constraint exists to stop.

**PRODUCT-UX — his Concern #4 argues size both ways, and the smallness he flags is a documented
deliberate mitigation.**
He rates it HIGH partly because `Reset Hand` renders 73x28, "the smallest control in the entire
command column," warning that "a slipped tap here has no visible undo path." A *smaller* target
is harder to slip onto — the size argument cuts against his own risk claim. And
`tests/playwright/touch-floor.spec.js:48` pins it verbatim:
`{ match: /^Reset Hand/i, minToday: 24, reason: 'deliberately de-emphasized destructive action,
40 design px' }`. The inversion he says "is not named anywhere found" is named in the file he
measured from, as an intentional choice. His *real* finding — no confirmation step on the only
irreversible control, visually near-identical to the adjacent `Reset Street` — survives intact
and should carry the severity alone.

**Cross-expert numeric disagreements, resolved:**

| Quantity | Claims | Truth (verified by me) |
|---|---|---|
| IDB stores | architect 23 / security ~25 / SYSTEM_MODEL 23 | **25** (migrationRegistry.js, migrations.js) |
| DB_VERSION | all three say 28 | **28** (database.js:50) — unanimous, correct |
| main chunk | senior `index-6jypFfmm.js` / perf `index-CSjMXJ_6.js` | **6jypFfmm, 781,989 B**; perf's artifact overwritten mid-run |
| launch health | BRIEF "1/8" / perf + security "2/5" | **2/5** (prog-launch.yaml:154-155) — *the brief is wrong* |
| views | senior "23 measured" | **29 entries** in src/components/views/ — direction right, count off |
| "X has no callers" | blocking_programs / onFastResult / lastSavedAt / saveHand | **all four independently verified TRUE** — no bad-grep errors in this run |

---

## 2. Missing dimension — NO expert examined TIME-TO-DETECT x RECOVERABILITY

Six experts produced roughly sixty findings and every one is ranked by *severity if it fires*.
Not one is ranked by **how long it goes unnoticed after it fires, multiplied by whether
anything can be recovered afterwards.** For a local-first, single-user, no-server,
no-telemetry app this is not a refinement of severity — it is the dominant axis, and it
reorders the run.

I verified the enabling condition, which no expert states: **there is no error sink of any
kind.** `grep -rn "Sentry|captureException|window.onerror|unhandledrejection" src/` (excluding
tests) returns **zero matches**. The only `capture` in the tree is
`src/utils/telemetry/postHogAdapter.js:92`, an opt-in *event* adapter, not an error channel.
`src/utils/errorHandler.js:187-199` terminates at `console.error` and nothing else. So for
every silent-failure class in this report, time-to-detect is not "hours" — it is **unbounded**,
and no instrument exists that could shorten it.

Re-ranked on `TTD x (1 - recoverability)`:

| Finding | Fires how | TTD | Recoverable? | Silence rank |
|---|---|---|---|---|
| Auto-save swallow (usePersistence.js:214-216) | quota / blocked DB / tab evict | **unbounded** | **No** — hand is gone | **1** |
| Debounce loss on backgrounding (:226-233 unmount-only) | phone lock mid-hand | **unbounded** | **No** | **2** |
| v23/v24 cursor clobber | upgrade from <v23 | **unbounded** | **No** — backup covers 3 of 25 | **3** |
| Backup covers 3 of 25 stores | at restore | at restore time | **No** — never captured | **4** |
| Account deletion no purge | never | **never** | Yes, trivially | 5 |
| onFastResult unwired, 26s freeze | wet flop | **instant** | Yes (wait) | 8 |
| Bundle 782 kB | every cold load | **instant** | Yes | 9 |
| Touch targets below 44px | every tap | **instant** | Yes | 10 |
| required_program_health: 60 | never (no reader) | n/a | n/a | — |

The instant-TTD findings dominate the run's page count; the unbounded-TTD findings do not.
Product-ux and performance-engineer between them produced ~15 findings the founder **cannot
fail to notice within one hand of play** — self-announcing defects have a bounded cost. The
four defects that can silently destroy the record of a hand he actually played, with no signal
and no recovery, occupy one expert's report.

Why this MUST be addressed for the audit to be complete: `MEMORY/feedback_income_hand_specificity`
records the founder's own framing — *"income earned hand by hand; the unit of reality is the
specific hand that happened."* An audit of a hand-tracker that does not rank findings by "can
this silently destroy the record of a specific hand" has not audited the product against its
own stated unit of value. All six lenses missed the axis; the failure-engineer found the
instances without naming it, which is why his findings did not out-rank six other experts'
louder ones.

---

## 3. Severity recalibration — forced explicit

### 3a. THE H3 RULING (mandated)

**failure-engineer: WEAK REFUTE. architect: partial support (lens-limited). senior-engineer:
SUPPORT. security: SUPPORT. performance: SUPPORT-with-exclusion. product-ux: SUPPORTED but
narrower.**

**The right answer: H3 is SUPPORTED — and the failure-engineer is the only one who earned his
verdict. The other five were right by luck, and one was right for a demonstrably wrong reason.**

The fact first. I traced the save path with a different tool than any expert used:

    grep "saveHand(" src/ --glob !**/__tests__/**
    -> src/hooks/usePersistence.js:211   (the ONLY production call site in the entire app)

`usePersistence.js:211` sits inside `try { ... } catch (error) { logError('Auto-save failed:',
error); }` (`:214-216`). `logError` reaches `console.error` and stops. The hook returns
`{ isReady, lastSavedAt }` (`:241-244`); the sole production caller, `useAppState.js:85-93`,
invokes `usePersistence(...)` **as a bare statement and captures nothing.**
`grep -rn lastSavedAt src/` returns the hook's own declaration and
`__tests__/usePersistence.test.js:283,290,299,448,451` — **and nothing else**. Every hand the
founder records passes through one debounced write whose failure is invisible, and the value
that would make it visible is computed, returned, tested, and dropped on the floor.

So the failure-engineer's fact is correct and *stronger than he stated* — he did not establish
this is the **only** save path. I did.

Now the ruling, and it goes against him on the label:

- **He is right that no honest "shippable subset" claim can include live hand recording as it
  stands.** Everyone who said otherwise did so without opening the save path.
- **He is wrong to call that a refutation of H3.** H3 asks whether a shippable subset *exists*.
  The blocker he found is a ~20-line wiring change to surface a value the hook **already
  returns and already tests**. A subset that becomes shippable by consuming an existing return
  value is a subset that exists. "Weak refute" converts a 20-line gap into a verdict — the
  accommodation move `.claude/rules/improvement-default.md` forbids in the other direction: he
  let a removable limitation set the scope of the answer.

**The one who is decisively wrong is the senior engineer, and he is wrong using the
failure-engineer's own evidence.** His "Likely Missing Elements" closes with a *positive*:
*"both useGameHandlers.js and usePersistence.js ... have dedicated test files ... This is real
signal that the core 'record a hand, do not lose it' path is guarded."* The test file he cites
as proof of safety is `usePersistence.test.js`, and lines 283-299 of it assert `lastSavedAt` —
**the exact value with no production consumer**. He cited a test of dead code as evidence the
live path is safe. That is `MEMORY/feedback_shipped_but_inert_capability` verbatim, and it
appears twice more in this codebase: `onFastResult` (perf #1 — I confirmed zero production
callers; `depthReachability.test.js:249` literally names the risk class in a comment) and
`getStoresAtVersion` (`migrationRegistry.js:504`, never imported by `exportUtils.js`).
**Three independent shipped-but-inert capabilities, each caught by a different expert, and not
one noticed it was a pattern.**

**Ruling, in the form the audit should carry forward:**
> H3: **SUPPORTED with a hard boundary.** A shippable subset exists and is one commit wide of
> where the code sits today. Its boundary is set by the failure-engineer's evidence, not the
> five supporters': the subset is *record -> review*, conditional on surfacing `lastSavedAt`
> and the auto-save catch to a view. Until that lands the subset is not shippable, and the
> correct statement is "one blocker, 20 lines, named" — **not** "not shippable"
> (failure-engineer) and **not** "core loop is guarded" (senior-engineer). Excluded from the
> subset regardless: live in-hand advice (perf #1, unwired `onFastResult`, unbounded
> refinement) and any upgrade path from DB version <23.

### 3b. The same backup gap, rated two ways by two experts

Architect Key Concern #4 and security Key Concern #2 are **the same defect, already filed as
FIND-101 on 2026-08-07**, presented by two experts as independent top-five findings with two
different denominators. Security rates it CRITICAL; architect assigns no severity and frames it
as a one-file import change. **Both are mis-severitied, in opposite directions.** It is not
CRITICAL alone (a backup nobody has run has not lost anything yet), and it is not a routine
import change either: joined with the failure-engineer's v23/v24 clobber and with
`SYSTEM_MODEL.md:252`'s claim of "backup before destructive ops" — which the failure-engineer
verified does not exist in code — the three compose into a single **HIGH, no-recovery-floor**
finding: a migration can silently drop fields, no automatic pre-upgrade snapshot exists, and
the manual snapshot that does exist captures 3 of 25 stores. One finding, three experts, zero
of them joined it.

### 3c. Recalibration nobody could make alone: red CI and green deploy, simultaneously

Senior-engineer established that 8 local commits have never been CI-validated and one breaks a
test (I reproduced the failure). Architect established, separately, that
`.github/workflows/deploy.yml` has **no test step and no needs/workflow_run edge to ci.yml** —
I confirmed both trigger on `push: branches: [main]` independently, and deploy's only guards
are `check-untracked-imports.mjs` and `npm run build`. Neither joined them. Joined, the finding
is: **pushing local main right now produces a failing CI run and a successful production deploy
of the same commit, in parallel.** Architect rated deploy-gating as a resolved-symptom footnote
("Deploy-freshness is fixed; the thing it protects against is not"). It is not a footnote — it
is live today with a named failing test in the tree. **MEDIUM (architect, implicit) -> HIGH.**

### 3d. Downgrade: v23/v24 clobber, CRITICAL -> HIGH

Per §1: fresh installs walk an empty store, so the launch population is not exposed; the
exposed set is installs at DB v1-22, whose existence is asserted and unverified. The fix stays
mandatory and unchanged (`improvement-default.md` — a severity downgrade is not a remediation
downgrade). The higher-value item is the *forward* one the failure-engineer filed as a Hidden
Risk rather than a Key Concern: `migrations.js:1178`'s **"MUST STAY LAST" is an English
sentence with no assertion behind it**, guarding the `hands` store, which every future user
will have populated. Promote that; demote the historical one.

---

## 4. Shared blind spot — what ALL SIX missed

### The one that matters: nobody asked whether the launch gate should exist.

Six experts spent a combined ~90 KB arguing about whether the gate's arithmetic works, whether
its blocking set is populated, and whether its threshold is on the right scale. **Not one asked
what "launch" means for this product.** I checked the only document with standing to answer:

- `system/intention.md` — the repo's constitution — contains **no occurrence of "launch"**, and
  no mention of users, distribution, pricing, or a second human being. Its Imagined Outcome
  names four ordered capabilities: trusted math -> player-interaction relations -> cueing ->
  manipulation. None is a shipping event.
- `system/intention.md:77` — **OQ-001: "Who is the first user we're designing validation for?"
  — status: open, placeholder.** The repo's own register of unresolved founder questions says
  the audience for a launch has never been decided.
- `prog-launch.yaml:107` — `blocking_programs: []` carries the inline comment
  **`# /adopt populates based on archetype`**. The program was not authored for this repo. It
  was installed by an archetype template.
- `prog-launch.yaml:4` — `lifecycle: temporary   # This program is removed after successful
  launch`. Created 2026-05-01. It has been "temporary" for 109 days against an event with no
  date, no audience, and an open founder question about who the audience is.

`kit/scripts/cwos-pulse.js` contains **zero occurrences of the string "launch"** and
`kit/scripts/core/health-scoring.js` contains **zero occurrences of "60"** — I ran both. There
is no code that reads this gate, and no event that it gates.

Every expert took "launch readiness" as the frame and optimised inside it. The brief told them
the hypotheses were about the gate's *arithmetic*, and six independent contexts all accepted
that the gate was the thing to repair. **The improvement-default rule the brief itself quoted
says a limitation is REMOVED by default — and the limitation here is the program.** Not one
expert reached that branch, because the brief had already chosen the other one. Per that same
rule, removal is not mine to recommend either: it is a founder question with a stated cost, and
**the finding is that nobody surfaced the question.**

### Three smaller ones, all six missed:

- **The run contaminated its own measurements.** Six agents ran concurrently against one working
  tree. Senior-engineer *swapped a file in and out of the tree* mid-run
  (`git show HEAD:... > ...`). Product-ux ran `npm run env:local`, started a dev server, and
  wrote and deleted three Playwright probe files. Perf and senior both ran `npm run build` into
  the same `dist/` — which is why perf's cited artifact no longer exists (`ls` shows mtime
  23:39; perf's report is stamped 23:38). Senior-engineer then attributed the PlayerFinderView
  timeout to *"worker contention under the 549s/15,922-test load"* — a causal claim that cannot
  be distinguished from contention with five other agents building, browsing and testing on the
  same machine at the same moment. **No expert noticed the run was its own confounder, and the
  orchestrator's design did not prevent it.**
- **Not one number in this run resolves to a Result Card.** `CLAUDE.md`'s Standard of Record
  (ADR-009) binds *"a number someone could act on or cite."* This run produced ~40 of them —
  782 kB against a 500 kB budget, 15,922 tests, 549 s, 27.8x40.3 px, 480,651 ms, 14 npm
  vulnerabilities, 25 vs 23 stores — with **zero** replication manifests, zero
  `disclaimerRegisterVersion` stamps, and at least one (the bundle hash) already
  unreproducible. Six experts were briefed on the improvement-default rule and none on the
  Standard of Record, and all six wrote comparative claims anyway.
- **Nobody costed anything.** Every report names defects; none names an hour, a day, or an
  ordering constraint. `.claude/rules/improvement-default.md` "Forced sequence" step 2 reads
  *"state what removing it costs — an unestimated cost is not a reason to defer; it is a reason
  to estimate."* Six experts, zero estimates. The brief said "do NOT propose solutions in this
  phase," which reads as licence to skip costing — but the rule the brief cited requires it,
  and the two instructions were never reconciled.

---

## 5. Alteration mandate — 8 diff entries (>=10% of ~60 findings)

**MODIFIED-1 — architect KC#4 + security KC#2, merged and re-scoped.**
*Was:* two separate top-five findings, "backup covers 3 of 23 stores" (architect, unrated) and
"backup drops most of the schema" (security, CRITICAL), different denominators.
*Now:* one finding, **HIGH**, "no recovery floor exists": backup captures 3 of **25** stores
(verified), `SYSTEM_MODEL.md:252`'s claimed pre-op backup does not exist in code, and a
migration can silently drop fields with no snapshot to fall back to.
*Why:* two experts filed the same 11-day-old FIND-101 as independent discoveries with
inconsistent counts, and neither joined it to the migration finding that makes it dangerous.

**MODIFIED-2 — failure-engineer KC#2, CRITICAL -> HIGH; promote its Hidden Risk to KC.**
*Why:* fresh installs walk an empty `players` store, so no launch-population user is exposed;
the asserted exposed set (v1-22 installs) is unverified. Remediation unchanged and mandatory.
The forward-looking half — `migrations.js:1178` "MUST STAY LAST" enforced by comment only, on
the `hands` store — is the higher-value item and was filed one tier too low.

**MODIFIED-3 — product-ux KC#4, strike the size clause.**
*Why:* `touch-floor.spec.js:48` pins `Reset Hand` at `minToday: 24` with
`reason: 'deliberately de-emphasized destructive action'`. The smallness is an intentional
mitigation and a smaller target reduces slip probability. Surviving finding, **HIGH,
unchanged**: no confirmation step on the only irreversible control, which is visually
near-identical to the adjacent non-destructive `Reset Street`.

**REMOVED-1 — H2 as an independent finding, and every recommendation to change
`required_program_health: 60`. It is void, not wrong.**
Grep across the entire repo (mine: ripgrep, plus a direct grep of `kit/`; theirs: GNU grep —
same answer) returns **11 files** mentioning `required_program_health` / `blocking_programs`:
`prog-launch.yaml`, `FIND-106.yaml`, one evidence doc, the BRIEF, the PREREGISTRATION, and the
six phase-1 reports. **Zero .js/.mjs/.cjs files.** `cwos-pulse.js` never mentions "launch";
`health-scoring.js` never mentions "60". A threshold that is never read cannot be
"arithmetically incapable of passing" — **there is no comparison to be incapable.** Four
experts confirmed H1 (no reader exists) and then confirmed H2 (the comparison fails
arithmetically) without noticing the first voids the second. Architect: *"not a judgment
call."* Performance-engineer: *"arithmetically impossible as configured."* Security: *"cannot
pass by construction."* All three describe a computation that does not occur. **What survives
is a documentation-integrity finding, LOW:** four `protocol_history` entries state "vs required
60" as their reason, so the recorded rationale of past verdicts refers to a comparison that
never ran.

**REMOVED-2 — the duplicate quota finding.**
failure-eng Hidden Risk ("no proactive quota warning — `navigator.storage.estimate`/`.persist`
zero matches") and perf Hidden Risk ("No `navigator.storage.estimate()` anywhere in src/") are
the same finding, same grep, same result. I confirmed zero matches. Keep one, MEDIUM, owned by
failure-engineering — it is a durability finding, not a latency one.

**ADDED-1 — the dimension from §2: TIME-TO-DETECT x RECOVERABILITY as a ranking axis, and the
enabling defect beneath it. HIGH.**
Verified: no Sentry, no captureException, no window.onerror, no unhandledrejection anywhere in
`src/` outside tests; `errorHandler.js:187-199` terminates at `console.error`. Every silent
failure in this product has **unbounded** time-to-detect by construction and no instrument
exists that could shorten it. Findings must be re-ranked on this axis before any launch call;
on the current ranking the four unbounded-TTD/unrecoverable defects sit below fifteen
instantly self-announcing ones.

**ADDED-2 — red CI and green deploy fire in parallel, today. HIGH.**
`ci.yml` and `deploy.yml` both trigger on `push: branches: [main]` with no `needs` and no
`workflow_run` edge (both read directly). `deploy.yml` runs `check-untracked-imports.mjs` and
`npm run build` — **no test step**. A test in the working tree fails right now (reproduced:
`phhAdapter.test.js:205`). Pushing produces a failing CI run and a successful production deploy
of the same commit. Neither the expert who found the failing test nor the expert who found the
missing deploy gate joined them.

**ADDED-3 — the label-ledger gate ordering converts a local blockage into a CI outage on the
next commit. MEDIUM.**
Senior-engineer found `smart-test-runner.sh` blocked locally by untracked
`scripts/backtest/ladder/rungs.card.js` (confirmed: `git status` shows `?? scripts/backtest/
ladder/`, 19,333 bytes) and treated it as local friction. **`ci.yml:27` runs
`check-label-ledger.sh` before `ci.yml:34` runs `npm test`** — identical ordering. The file is
untracked, so CI is currently clean; the moment it is committed, CI blocks before reaching any
test, and the failure output is indistinguishable from "1 test broken" and "10,000 tests
broken." The local annoyance and the CI outage are one defect at two points in time.

---

## 6. Blind-context constitutional check — Failed States #3 and #10

**First, a correction the orchestrator needs and did not have.** `system/intention.md` in
**this** repo has **no Failed States section at all** — it has Imagined Outcome, Principles
P1-P4, and three `_placeholder_` sections (132 lines; headers at 1/12/35/50/60/69/81/108). The
canonical Failed States live in `C:\Users\chris\repos\homebase\system\intention.md:67-81`, and
this repo's own evidence already recorded the gap on 2026-07-22
(`.claude/workstream/evidence/domain-correctness/run-sweep-2026-07-22/phase-0/context.md:8`).
**The instruction to run the constitutional check pointed at a section that does not exist
here — and every `/…-audit` command in `.claude/commands/` carries the same dangling
reference** (claims-audit.md:132,286; compliance-audit.md:343,378;
domain-audit.md:160,244,375,483; provenance-audit.md:185,360). I ran the check against the
HomeBase canon:

> **#3 Compliance over value.** A repo is "adopted" but no closer to its goal than before.
> **#10 Self-aggrandizing complexity.** Programs/engines that justify each other but don't
> connect to any repo goal.

**`direction: away-from-goal`** — technically correct findings whose remediation pushes toward
#3 or #10:

- **Fixing `required_program_health: 60`** (architect, senior, perf, security) — **#3,
  canonical form.** Correcting a number in a file no code reads produces a gate that *looks*
  repaired and still cannot fire. Every technical check passes; zero value delivered. Already
  REMOVED in §5.
- **Wiring `blocking_programs` + building the cwos-pulse launch branch** (architect's Likely
  Missing Elements; the 08-07 "GATE-SPEC" he says has sat unimplemented 11 days) — **#10.**
  Building an aggregator for an event with no date, no audience, and OQ-001 still open is
  precisely "programs that justify each other but don't connect to any repo goal." He frames
  the 11-day delay as *decision debt*. Read against the constitution, 11 days of the founder
  not building it is revealed priority, and the correct escalation is a question, not a ticket.
- **"Re-verify open findings before they penalise health"** (architect) — **#10.** New
  governance machinery whose only consumer is the health score, whose only consumer is the
  gate, which nothing reads. Three layers of apparatus, zero connection to the Imagined
  Outcome. The *underlying* observation stays and is sharp: FIND-098 is CRITICAL, open, and its
  cited test now passes (architect ran it: 201/201). Retire the finding by hand — do not build
  a subsystem to retire it.
- **npm audit gate in CI at HIGH** (security KC#4) — **#3 as stated.** He reports 14
  vulnerabilities (2 critical) and states plainly *"I have not verified whether Vite
  tree-shakes these Node-only transitive dependencies out of the shipped browser bundle."*
  Gating CI on advisories of unproven reachability in a no-server single-user app is compliance
  over value. **Toward-goal if and only if reachability is established first** — a 30-minute
  check, not a CI policy.
- **CSP header at HIGH** (security) — **#3.** No server, no user-generated remote content, one
  user. Bundled into the same finding is the origin-check gap (`useSyncBridge.js:238`,
  `app-bridge.js:149` check `event.source` but not `event.origin`, while
  `ignition-capture.js:442-443` checks both), whose consequence he correctly identifies as
  **model poisoning of the Bayesian villain models**. That half is **toward-goal and is the
  strongest security finding in the run** — it attacks Imagined Outcome capability (2),
  "player-interaction relations fully described." It is buried under a CSP recommendation and
  filed under the wrong program (`FIND-083.yaml:7` says methodology-integrity while `:16` says
  "ROUTE: origin check to security"). Split them; promote the origin check; drop CSP to LOW.
- **Chrome Web Store listing audit** (security) — **#3.** No evidence in the run that a listing
  exists.

**`direction: toward-goal`** — remediation advances the Imagined Outcome as written:

- Surface `lastSavedAt` + the auto-save failure (failure-eng #1). Direct **P2** instance —
  *"where the math is unvalidated, say so in the output"* generalises to *where the save is
  unconfirmed, say so*. Highest toward-goal/effort ratio in the run.
- `visibilitychange`/`pagehide` flush (failure-eng #3). Protects "the specific hand that
  happened."
- v23/v24 guard + an assertion behind "MUST STAY LAST" (failure-eng #2 + Hidden Risk).
- Store-manifest-driven export via `getStoresAtVersion` (architect #4 + security #2, merged).
- Wire `onFastResult` + a wall-clock deadline (perf #1, #2). Serves Imagined Outcome capability
  (3), *"cueing — telling the player the particular thing he has to do here"*; a 26 s freeze is
  the negation of "in the moment."
- The origin check on `useSyncBridge.js:238` (extracted from the CSP bundle).
- Depth/confidence marker on live advice (product-ux #5, FIND-067). **P2 and P3 verbatim** — an
  unvalidated number presented without its status.
- Touch-target and aria-label work (product-ux #1, #2), and the doc-drift auto-check
  (senior #5): cheap, and drift in CLAUDE.md/SYSTEM_MODEL.md degrades every future session.
- Extension ToS/stealth exposure (security KC#5): surfacing it is toward-goal; the decision is
  the founder's, not engineering's.

**Net:** six of the run's most confidently-argued findings — including both hypotheses the
brief nominated as central — are away-from-goal, and every one of them is in the governance
layer. The product findings are almost uniformly toward-goal. **The run's confidence is
inversely correlated with its constitutional value.**

---

## 7. ORCHESTRATOR AUDIT

### P1 — SUPPORTED, independently, but see REMOVED-1
`health-scoring.js:33` `RIGOR_CEILING = [0,2,4,5,6,7,8,9,9,10]`; `:37`
`TARGET_CEILING = {... critical: 10}`; `:116` `score = Math.min(earnedScore, ceiling)`. Max
achievable score is 10; I verified all three lines. The stated falsifier (a normalisation step)
does not exist — `health-scoring.js` contains no `60` at all. **But P1 predicts the behaviour
of a comparison that does not execute.** SUPPORTED, and vacuous.

### P2 — **REFUTED BY ITS OWN PRE-REGISTERED FALSIFIER.**
Falsifier: *"an expert finds a real, product-grounded blocker that would have produced NOT
READY even with a correctly wired gate."* Two experts found three:
- Auto-save failure is invisible on the **only** production `saveHand` call site
  (`usePersistence.js:211`, verified by me).
- `onFastResult` has zero production callers, so the two-phase design does not run, against a
  documented 26 s worst case (`gameTreeEvaluator.js:1611`, `computeHelpers.js:251-272`,
  verified by me).
- The founder's device has never had advice latency measured (FIND-109 open, WS-468 backlog).

The falsifier fired. **P2 is REFUTED, recorded unhedged.** H1's *mechanism* remains true — the
gate has no reader — but H1's *implication*, that four NOT READY verdicts were meaningless
artifacts, is false. The verdicts were right. They were right for reasons the gate did not
compute, which is a different and much less interesting finding than the brief proposed.

### P3 — SUPPORTED by its own falsifier, and **the falsifier was mis-specified.**
Falsifier: *"product-ux runs the app and finds a core flow actually broken end-to-end."*
Product-ux ran it (devshot at 1600x720 and 1170x540 plus three ad-hoc Playwright probes) and
the flow traced cleanly. Falsifier did not fire.

But the defect that actually bounds H3 — a save whose failure is invisible — **cannot be
detected by an end-to-end walkthrough of a working app**, because on a working app the save
succeeds. The instrument was shaped to test wiring; the defect was in durability. This is the
failure named in `MEMORY/feedback_dispatch_dont_assert` and in this repo's own doctrine: *"a
pre-registration whose primary instrument could not have detected a wrong claim."* You wrote
that falsifier knowing that history. **Record: P3 SUPPORTED, instrument invalid.**

### P4 — **REFUTED. Confirmed independently, and worse than reported.**
I ran the working copy directly: `scripts/__tests__/phhAdapter.test.js` -> **1 failed, 21
passed**, failing at `:205:23`. This is not a HEAD-only artifact — the modified working tree
fails too, so the ~40 uncommitted files the prediction leaned on are not a fix in flight. P4's
premise ("the founder ships working trees routinely here") is itself now falsified: the working
tree is not working.

### P5 — **REFUTED.**
The highest-severity *new* finding of this run came from the **failure-engineer**
(`usePersistence.js:211` is the sole production save path and its failure is unobservable), not
from security. Security's two CRITICALs are **relays of FIND-100 and FIND-101, filed 2026-08-07
by a prior sweep**, and by his own table four of six were verified only by absence of a fix
commit. His genuinely novel contributions — the extension stealth/ToS account risk and the
`event.origin` gap — are HIGH, not CRITICAL, and the second is a re-file of FIND-083. The
prediction named the right lens for the loudest section and the wrong lens for the load-bearing
finding.

### P6 — threshold **NOT crossed**; run is **VALID as evidence**, with H2 struck.

Literal unanimity across all six on all four did not occur: failure-engineer weakly refuted H3;
architect and security both refuted H4's safety corollary; failure-engineer, product-ux and
senior-engineer returned "cannot determine" on H1/H2/H4 in various combinations. P6's stated
invalidation condition did not fire.

**But you asked for the distinguishing test — did each expert derive it from a DIFFERENT
primary source, or restate the brief? I checked what each actually opened.**

- **H1 — genuine independent convergence.** Architect and senior-engineer each ran a repo-wide
  grep; performance-engineer and security each read `prog-launch.yaml:107` directly, and
  security added a primary source the brief never mentioned (`prog-security.yaml:154`,
  `interconnections: { blocks: [launch] }` — a declared edge that is never consulted). **I
  re-ran it with a different tool (ripgrep) and separately grepped `kit/` directly, which a
  gitignore-aware tool could have skipped: 11 files, zero JS.** H1's mechanism survives
  independent confirmation. Not inheritance.
- **H2 — brief-inheritance, three of four.** The brief handed them `prog-launch.yaml:106`. Only
  the **architect** left it, reaching `health-scoring.js:33/37/116` — the formula.
  Senior-engineer, performance-engineer and security all inferred "0-10 scale" from *observed
  score samples* (2/9, 2/5, 0/0), which is the same weak check three times, not three checks.
  Security says so himself: *"I did not locate the scoring function itself ... so I can't rule
  out that required_program_health: 60 secretly means something on a different scale."* Four
  "confirmations," one derivation. **And all four missed that H1 voids H2** (REMOVED-1) — a
  mistake far easier to make when checking a claim than when deriving one. That is the
  signature of inheritance.
- **Sharpest single piece of inheritance evidence:** the architect, who opened his report with
  *"I re-verified it against current state rather than relaying it,"* reproduced the brief's
  factual overstatement that all four `protocol_history` entries are stamped "Inline
  meta-aggregation." `prog-launch.yaml:171` is not. He was looking at the file and read the
  brief.

**Did H1-H4 stated as corrections bias experts toward gate defects and away from product
defects? Yes. Evidence both ways; the balance is clear.**

*For bias:*
1. **Three of six experts produced no new product defect at all.** Architect, senior-engineer
   and security spent their top-five slots on the gate, CI, doc drift, and re-verification of
   findings filed 11 days earlier (FIND-098, FIND-100..106, FIND-LA-001). Roughly half the
   run's output re-confirms known open findings — which is what H1/H2 asked for.
2. **The brief's imperatives produced report structure verbatim.** "Note security: ...
   Interrogate that" -> security-engineer's report opens with a section literally titled *"The
   dormant-program interrogation (asked first, per brief)"*, ahead of his own Key Concerns.
3. **The brief supplied a health table with at least four wrong numbers and nobody checked it.**
   Verified against the YAMLs: brief says `launch 1/8` -> actual `health_score: 2,
   health_ceiling: 5` (`prog-launch.yaml:154-155`); `domain-correctness 2/10, 50 open` ->
   actual `health_ceiling: 9, findings_open: 44`; `data-provenance 4/8` -> actual `0/0`;
   `design 3/8` -> actual `0/0`. **Performance-engineer read `prog-launch.yaml:154-155` — the
   exact line that contradicts the brief — and quoted it without noticing.** An expert testing
   the brief flags that contradiction in one sentence. He wasn't testing the brief; the brief
   was the frame. (Note the direction: the true count of programs at 0 is *higher* than the
   brief said, which strengthens H4 while proving the brief's table was not a measurement.)
4. **The improvement-default branch the brief foreclosed.** The brief quoted
   `improvement-default.md` and then defined the limitation as the gate's *configuration*.
   Nobody reached "remove the program," though `prog-launch.yaml:107` says the blocking set was
   populated by `/adopt` from an archetype, `:4` marks the program temporary since 2026-05-01,
   and `intention.md:77` shows OQ-001 — who the first user is — still open.

*Against bias:*
1. The two experts who **ran or traced the actual product** (product-ux via a live dev server
   and Playwright; failure-engineer via the source call graph) produced the only two genuinely
   new product-defect clusters, and both dissented from the brief on H3. The brief did not
   prevent product findings — it did not cause them, and only the two personas whose method
   forced them into the product escaped its pull.
2. Failure-engineer explicitly refused three of four hypotheses as outside what he verified —
   the correct behaviour, and evidence the "refute it if the evidence refutes it" clause has
   real effect.

**Verdict on the run:** valid as evidence, with H2 struck as void and H1 downgraded from "the
verdict was meaningless" to "the verdict was unearned but correct." The instrument that worked
was *running the product*. The instrument that produced inheritance was *checking the brief's
citations*. One change for the next brief: **supply no numbers and no line references.** Every
figure you handed over was either uncontested — and three of four inheritors never left it — or
wrong, and nobody caught it.

---

## What nobody asked

1. **Launch to whom?** OQ-001 is open and `intention.md` never says "launch." Six experts
   assessed readiness for an event with no audience.
2. **Has the founder's device ever actually lost a hand?** The failure-engineer proved silent
   loss is possible; nobody asked whether it has already happened. `hands` records carry
   timestamps and sessions carry hand counts — answerable from the founder's own IndexedDB in
   about ten minutes, and it converts the run's #1 finding from theoretical to measured.
3. **What DB version is the founder's device on?** It decides whether the v23/v24 clobber is
   HIGH or archaeology. Nobody looked, and the app can report it.
4. **Do the 14 npm advisories reach the browser bundle?** Security stated this is unknown and
   recommended a CI gate anyway. One grep of `dist/` settles it.
5. **What does a launch-gate failure cost, versus what does the ceremony cost?**
   `prog-launch.yaml` declares `activation: ~5 min`, `ongoing: periodic /pulse run launch`.
   Five runs have now fired against it, three producing zero findings, and this one consumed
   six expert dispatches. Nobody compared the gate's running cost to its yield.
6. **Why does `prog-launch.yaml` say `findings_open: 4` while the brief and security work from
   6 for security and 44/50 for domain-correctness?** Stamped counts and computed counts
   disagree across at least four programs, and no expert reconciled them — which means every
   "health 0" argument in this run rests on numbers nobody validated.
7. **The brief said the last FOUR sweeps produced nothing. There was a fifth.**
   `prog-launch.yaml:146-151` records `run-launch-sweep-2026-08-07` as the current sweep, and
   it produced FIND-100 through FIND-106 plus a founder-blessed GATE-SPEC — but it has **no
   protocol_history entry** (the last is 2026-08-03). The "self-perpetuating instrument that
   never finds anything" premise is falsified by the run immediately preceding this one. The
   architect used that run's evidence file and still did not say so.
