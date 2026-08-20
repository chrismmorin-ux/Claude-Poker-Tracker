# PHASE 3 — SYNTHESIS · run-launch-sweep-2026-08-18
Facilitator. Completed 2026-08-19. Engine: eng-engine. Program: launch. Protocol: sweep.

**What I checked myself before synthesizing anything.** Per `.claude/rules/dispatch-dont-assert.md`,
claims that survive into Phase 4 were re-derived, not relayed. I independently confirmed, this session:

| Claim | My check | Result |
|---|---|---|
| `lastSavedAt` has no production consumer | `grep -rn lastSavedAt src/` (non-test) | **3 hits, all inside `usePersistence.js` itself** (`:44` docblock, `:49` declaration, `:243` return). `useAppState.js:85-93` calls the hook as a bare statement. CONFIRMED, stronger than the failure-engineer stated. |
| Auto-save failure is log-only | read `usePersistence.js:205-244` | `saveHand` at `:211`; `catch { logError('Auto-save failed:', error) }` at `:214-216`; cleanup at `:226-233` is unmount-only. CONFIRMED. |
| FIND-098's EV assertion still fails | ran `npx vitest run src/utils/exploitEngine/__tests__/gameTreeEvaluator.test.js` | **201/201 pass, 238s.** FIND-098 is STALE. The architect was right. |
| Deploy still ungated | read `.github/workflows/deploy.yml:1-20`; `grep -rn "workflow_run\|needs:" .github/workflows/` | **zero matches.** Both workflows on `push: [main]`, independent. FIND-097 unchanged, 12 days. |
| CI gate ordering | read `ci.yml` | `check-label-ledger.sh` at `:27`, `npm test` at `:34`. Ledger gate precedes tests. CONFIRMED (ADDED-3). |
| main freshness | `git rev-list --count origin/main..main` | **19 local commits unpushed**; `origin/main` = `f54e9557` (2026-08-16); local HEAD `32d968a4` (2026-08-18). |
| OQ-001 | read `system/intention.md:70-85` | Confirmed open — **and weaker than the cross-critic framed it**: the row is *literally the template placeholder*, `_placeholder — example: "Who is the first user…"_`. The question was never asked, not asked-and-unanswered. Same conclusion, more damning provenance. |
| `prog-launch.yaml` self-description | read `:1-12`, `:104-110`, `:146-160` | `lifecycle: temporary` at `:4`; `blocking_programs: []  # /adopt populates based on archetype` at `:107`; `health_score: 2 / health_ceiling: 5` at `:154-155` — **the brief's "launch 1/8" is wrong**, as the cross-critic said. |
| **Did the 08-07 sweep's 14 findings produce any work?** | `grep -rn "FIND-09[7-9]\|FIND-1[01][0-9]" .claude/workstream/queue/`; `grep finding_id` in queue-index | **ZERO work items reference FIND-097..110.** One passing cross-ref inside `WS-460.yaml:21`. Nothing else. |

That last row is mine, no expert found it, and it reframes the whole run. See §3.4 W1.

The cross-critic's corrections are binding and I have not disproved any of them. Two are refined
below (OQ-001 provenance; the error-sink severity), neither reverses it.

---

## 3.1 — AREAS OF CONSENSUS (3+ experts, and it survived cross-critique)

**C1. The launch gate has no code reader. (architect, senior, performance, security — 4 experts,
4 independent greps, plus the cross-critic with ripgrep and a direct `kit/` grep.)**
`prog-launch.yaml:107` `blocking_programs: []`; zero `.js/.mjs/.cjs` files anywhere mention
`blocking_programs` or `required_program_health`. Already filed as **FIND-106, 2026-08-07, still
open**. This is the one consensus the cross-critic certified as *genuine independent convergence*
rather than brief-inheritance. **High confidence.**

**C2. Program health 0 means never-run, not measured-failing — and that is not a reason to relax.**
(architect, security, performance, product-ux, senior.) `prog-security.yaml:163-168` all-null
`last_run_by_protocol`; `prog-design.yaml:216` says so in prose. **But architect and security both
refuted the safety corollary**, and they are right: `security` sits at 0 while carrying six real
open findings, two CRITICAL. A 0 that means "never asked" and a 0 that means "asked, answered
badly, then forgotten" are the same numeral today. **High confidence.**

**C3. There is a shippable subset, and it is `record → review`.** (senior, security, performance,
product-ux support; failure-engineer weak-refutes; cross-critic ruled SUPPORTED with a hard
boundary.) Product-ux ran the actual app and traced session → seat → act → showdown → save → stats
cleanly with screenshots. **High confidence on existence; the boundary is set in §3.2 D1.**

**C4. Documented architecture is 2-3x wrong and the canonical doc is ~100 days past its own
staleness threshold.** (senior measured; failure-engineer and architect corroborated on DB_VERSION;
performance corroborated on §2.3 describing unshipped behaviour.) `CLAUDE.md` says 8 reducers /
12 contexts / 33 hooks / 13 views / IDB v13; measured 14 / 22 / 73 / 23 (senior) or 29 view entries
(cross-critic); `database.js:50` is `DB_VERSION = 28`. `SYSTEM_MODEL.md:1-4` stamped
`last-verified-against-code: 2026-05-10`, threshold 30 days. **High confidence.** Already
FIND-110 + **WS-461** (backlog).

**C5. Nothing in this repo bounds, measures, or de-risks live advice latency on the founder's
phone.** (performance primary; product-ux via FIND-067; senior via the 26s prose.)
`onFastResult` has zero production callers (`computeHelpers.js:251-272` never passes it);
`gameTreeEvaluator.js:1611-1622`'s load-bearing yield never fires in production; no wall-clock
deadline; `treeMetadata.latency` is persisted nowhere. **FIND-109 open, WS-468 backlog, unclaimed.**
**High confidence.**

**C6. The touch-floor instrument does not cover the controls that matter most.** (product-ux
measured on a live dev server at the S22 profile; senior and performance corroborate the device
question is open.) `touch-floor.spec.js:102` scopes the roster to `[data-testid="command-column"]`,
so `CardSlot.jsx` (27.8×40.3 px rendered) and the 12-button nav rail (28×28 px) are structurally
invisible to it, and `:131-134` is `test.fixme` on the mid-hand state. **High confidence** — this
is the only finding in the run backed by rendered `boundingBox()` measurement rather than reading.

**C7. Half of this run is a re-discovery of findings filed 2026-08-07 and never worked.** All six
experts cite FIND-097..110 material. The cross-critic named it as bias evidence. I confirmed the
harder version: **not one of those fourteen findings has a work item.** See §3.4 W1.

---

## 3.2 — KEY DISAGREEMENTS, FORCED RESOLUTION

Every one is resolved. None is left as "both have a point."

### D1. Is a shippable subset real? (failure-engineer WEAK REFUTE vs five SUPPORT)
**Core tension:** the failure-engineer found that the only production save path swallows its
failures silently, and concluded no honest subset can include live hand recording. Five others
said a subset exists.

**RESOLVED — the cross-critic's ruling stands, and I adopt it as the run's position.**
H3 is **SUPPORTED with a hard boundary**. The failure-engineer owns the fact; he does not own the
verdict. The blocker he found is a wiring gap to a value the hook already computes, already returns
and already tests (`usePersistence.test.js:283-299`). A subset that becomes shippable by consuming
an existing return value is a subset that exists — calling that "not shippable" converts a
removable limitation into a scope reduction, which `.claude/rules/improvement-default.md` forbids.
**The subset is `record -> review`, conditional on the save becoming observable. Excluded
regardless: live in-hand advice (C5) and any upgrade path from DB version < 23.**

The senior engineer is **decisively wrong** on this and must be recorded as such: his "Likely
Missing Elements" cites `usePersistence.test.js` as "real signal that the core 'record a hand, do
not lose it' path is guarded." The lines that test file asserts are the ones with no production
consumer. He cited a test of dead code as proof the live path is safe.

### D2. Is `required_program_health: 60` a live defect? (4 experts SUPPORT vs cross-critic VOID)
**RESOLVED — cross-critic, and the orchestrator has independently verified it.** H1 destroys H2's
premise: a threshold no code reads cannot fail arithmetically, because no comparison occurs. Four
experts confirmed "there is no reader" and then confirmed "the comparison is impossible" in the
same report. Three of the four never left the line the brief handed them; only the architect
reached the formula (`health-scoring.js:33,37,116`).

**What survives, reframed as prospective rather than retrospective:** the founder-blessed GATE-SPEC
in `.claude/workstream/evidence/run-launch-sweep-2026-08-07.md:57-67` specifies the pass condition
*"every blocking program health >= 60"*. **That spec is latently defective and would fire the moment
anyone implements it** against a scale whose maximum is 10. Severity **LOW** as a live defect,
**blocking** as a precondition on the gate-build work — fix the number in the spec before, not
after, someone writes the reader. And the four prior NOT READY verdicts were **narrative
judgments that happened to be right**, not failed arithmetic. Nobody's verdict was ever computed.

### D3. How bad is the v23/v24 cursor clobber? (failure-engineer CRITICAL vs cross-critic HIGH)
**RESOLVED — HIGH, per the cross-critic, and the remediation is unchanged.** The mechanism is
verified twice (`migrations.js:1350`, `:1354`, unguarded by `oldVersion > 0`; both walk `players`
via `openCursor()` in one transaction). But on a fresh install `oldVersion = 0`, migrateV1 creates
an empty `players` store in that same transaction, so both cursors walk nothing. **No launch-population
user is exposed.** The failure-engineer's "exactly the real upgrade path for an existing installed
user" is unsupported — the exposed set is installs at DB v1-22, and nobody checked whether any exist.
A severity downgrade is not a remediation downgrade: the guard still ships.
**And the cross-critic's promotion is correct** — the higher-value half is forward-looking:
`migrations.js:1178` "MUST STAY LAST" is an English sentence with no assertion behind it, guarding
the `hands` store, which every future user will have populated.

### D4. Backup gap — CRITICAL (security) or a one-file import change (architect)?
**RESOLVED — both wrong, in opposite directions; merged to one HIGH finding.** Alone, a backup
nobody has run has lost nothing yet. But joined with D3 (a migration can silently drop fields) and
with `SYSTEM_MODEL.md:252`'s claim of "backup before destructive ops" — which the failure-engineer
verified **does not exist in code** — the three compose into a single finding with a name:
**there is no recovery floor.** Export covers **3 of 25 stores** (cross-critic enumerated
`migrationRegistry.js`; `grep -c createObjectStore migrations.js` = 25 independently). The architect's
"23" came from the same stale doc he was condemning in the same sentence. Add `clearAllData`'s
non-atomicity (`exportUtils.js:159-182`, FIND-103) — which runs as **phase one of every restore** —
and the recovery path can itself destroy state. One finding, three experts, zero of them joined it.

### D5. Is `Reset Hand` dangerous because it is small? (product-ux)
**RESOLVED — strike the size clause, keep the finding at HIGH.** `touch-floor.spec.js:48` pins it
verbatim: `minToday: 24, reason: 'deliberately de-emphasized destructive action, 40 design px'`.
The smallness is a documented deliberate mitigation, and a smaller target is *harder* to slip onto —
the argument cut against its own conclusion. **What survives intact and is the real finding: the
only irreversible control in the app has no confirmation step and is visually near-identical to the
adjacent non-destructive `Reset Street`.**

### D6. npm audit and CSP — HIGH (security) or compliance theatre?
**RESOLVED against the security engineer, on his own admission.** He wrote *"I have not verified
whether Vite tree-shakes these Node-only transitive dependencies out of the shipped browser
bundle"* and recommended a CI gate anyway. Gating CI on advisories of unproven reachability in a
no-server, single-user app is Failed State #3 (compliance over value). **The correct move is not to
skip it — it is to settle reachability first**, which is one grep of `dist/`, ~30 minutes. If they
reach the bundle, the gate is justified and cheap; if not, the finding closes. CSP drops to **LOW**
for the same reason (no server, no remote user content, one user). **What must be extracted and
promoted out of that bundle: the `event.origin` gap** — see D7.

### D7. Where does the postMessage origin gap belong, and how bad is it?
**RESOLVED — split from CSP, promoted, and re-severitied UP to HIGH on the time-to-detect axis.**
`useSyncBridge.js:238` and `ignition-poker-tracker/content/app-bridge.js:149` gate on
`event.source !== window` only; `ignition-capture.js:442-443` checks both source and origin with
a comment naming the pattern. The codebase knows the right answer and applied it on one hop.
Consequence is **model poisoning, not XSS**: schema-valid fabricated hands enter the Bayesian
villain models, silently. Currently filed under the wrong program — `FIND-083.yaml:7` says
`methodology-integrity` while `:16` says *"ROUTE: origin check to security."* **WS-514 covers only
the captureId/dedup half.** The origin half is unowned.

### D8. Is the failing test a HEAD-only artifact? (senior engineer)
**RESOLVED — no. Established fact per the orchestrator, who ran both.** Committed version fails at
`:195`, working tree fails at `:205`, each 1 failed / 21 passed. There is no fix in flight. The
senior engineer's framing ("restored the working copy") implies otherwise and is wrong; it also
explains his unreconciled "2 failed" arithmetic.

### D9. Was the PlayerFinderView timeout caused by suite load? (senior engineer)
**RESOLVED — unsupported, and the run cannot distinguish it.** Six agents ran concurrently against
one working tree: two `npm run build`s into the same `dist/`, one dev server, Playwright browsers,
a full 549s Vitest run, and a file swapped in and out of the tree mid-run. "Worker contention under
the 549s load" is indistinguishable from contention with five other agents. **The run was its own
confounder and the orchestrator's design did not prevent it.** Re-measure on an idle machine before
anyone acts on the flake diagnosis.

---

## 3.3 — HIGHEST-RISK UNKNOWNS (nobody can settle these without going and looking)

**U1. Has the founder's device already silently lost a hand?** The failure-engineer proved silent
loss is *possible*; nobody asked whether it has *happened*. `hands` records carry timestamps and
`sessions` carry hand counts — a count mismatch is queryable from the founder's own IndexedDB in
about ten minutes. **This converts the #1 finding from theoretical to measured, and it is the single
highest-information check available in this entire run.**

**U2. What DB version is the founder's device on?** Decides whether D3 is HIGH or archaeology. The
app can report it. Nobody looked.

**U3. Do the 14 npm advisories (2 critical) reach the browser bundle?** One grep of `dist/`. Until
answered, D6 is undecidable and the CI-gate recommendation is unearned either way.

**U4. Is `main` protected by a required status check?** The senior engineer flagged this as
circumstantial and explicitly did not assert it. `gh api repos/.../branches/main/protection`
settles it in one call. It changes the shape of the deploy-gating fix.

**U5. Are the stamped finding counts real?** `prog-launch.yaml` says `findings_open: 4`; the brief
says 6 for security and 50 for domain-correctness; the cross-critic measured 44. Stamped counts and
computed counts disagree across at least four programs. **Every "health 0" argument in this run
rests on numbers nobody validated** — including mine, where I use them.

**U6. Does the S22 render at DPR 2 or 2.625?** `deviceProfiles.mjs:9-12` marks it provisional. If
2.625, every rendered-px figure in the product-ux report gets *worse*, not better.
`/device-probe.html` on the actual phone settles it. FIND-109 owns it; WS-468 is unclaimed.

**U7. Was the equity Worker bypass (TD-08 / RT-31) ever fixed?** The performance engineer explicitly
declined to verify and said so honestly. If still open, main-thread Monte Carlo runs on the most
frequent computation in the app, on top of everything in C5.

---

## 3.4 — SYSTEMIC WEAK POINTS, RANKED (severity x likelihood x blast radius)

**W1. Findings are produced and never converted into work. — THE dominant weak point of this repo.**
Fourteen findings were filed on 2026-08-07 with file-and-line evidence and a founder-blessed
gate spec. **Twelve days later, zero of them have a work item** (my grep; one passing cross-reference
in `WS-460.yaml:21`). `prog-launch.yaml:108-110` declares `accountability.on_finding: {action:
create_work_item, max_open_items: 5}` — the declared mechanism did not fire fourteen times in a row.
This is *why* half of this run is re-discovery, why the architect calls the GATE-SPEC delay "decision
debt," and why a sixth sweep would find the same things again. **Every other weak point below is
downstream of this one.** Blast radius: the entire governance layer's value.

**W2. Nothing in the product can tell the founder that something failed.** No Sentry, no
`captureException`, no `window.onerror`, no `unhandledrejection` anywhere in `src/`
(orchestrator-confirmed). `errorHandler.js:187-199` terminates at `console.error`. Nobody reads a
console on a phone at a poker table. **This is the multiplier that converts every silent defect in
this report from "detectable" into "unbounded."** Blast radius: every failure class in the app.

**W3. Capability ships inert, three times in one audit, and nobody noticed it was a pattern.**
`lastSavedAt` (computed, returned, tested, never consumed), `onFastResult` (declared, tested, never
passed by the one production caller), `getStoresAtVersion` (`migrationRegistry.js:504`, never
imported by `exportUtils.js`). Each caught by a different expert; none joined. This exact failure
mode is already in the founder's memory as `feedback_shipped_but_inert_capability`. Blast radius:
unbounded — it is a *class*, and the class contains the run's #1 finding.

**W4. There is no recovery floor.** Backup 3 of 25 stores, a documented pre-op backup that does not
exist, a restore path that begins with a non-atomic destructive clear, and a migration class that
can silently drop fields. Blast radius: everything on the device, at exactly the moment you need it.

**W5. Red CI and green deploy fire in parallel, today.** Both trigger on `push: [main]`, no `needs`,
no `workflow_run` (verified by me today). Deploy runs `check-untracked-imports.mjs` + `npm run build`
and **no tests**. A test in the tree fails right now. Pushing produces a failing CI run and a
successful production deploy of the same commit, simultaneously. Blast radius: production.

**W6. The gates that exist fail in the least informative way, at the wrong point in the pipeline.**
`ci.yml:27` runs the label-ledger gate before `:34` runs the tests, and `smart-test-runner.sh` has
the same ordering — so an unledgered constant in an untracked backtest file currently blocks 100%
of local test signal, and will block 100% of CI signal the moment that file is committed. A gate
whose failure output is identical for "1 test broken" and "15,922 tests broken" trains its user to
bypass it. The senior engineer bypassed it *in this run*.

**W7. Measurement instruments are scoped to the places the defects are not.** `touch-floor.spec.js`
measures one container and `test.fixme`s the mid-hand state; the two highest-traffic controls in the
app are structurally outside its root. `CLAUDE.md` tells every future session that enforcement lives
there. Same shape as W6: the instrument's existence is read as coverage.

**W8. The canonical docs are wrong by 2-3x and nothing detects it.** C4. Every session orients from
them. WS-461 exists and is unclaimed.

**W9. `launch` is a program with no referent.** See §4(e).

---

# PHASE 4 — DECISIONS & ACTIONS

## (a) THE VERDICT

> ## NOT SAFE — and for the first time, not for governance reasons.
>
> **Plain language for the founder:** *Right now the app can lose a hand you actually played and
> tell you nothing — there is no "saved" light, no error message anywhere in the product, and no
> way to find out afterwards. Fix that one thing and the app is safe for you to keep using; three
> more fix the rest.*

Two claims that must not be blurred together:

- **NOT SAFE to launch to anyone.** Deleting an account deletes nothing, backup captures 3 of 25
  stores and reports success, a failing test can deploy to production, and there is no audience
  decided for a launch anyway (§e).
- **Keep using it at the table — but you cannot currently tell whether a hand saved.** The core
  `record -> review` loop traces cleanly and was walked on a live dev server with screenshots. It is
  one wiring change away from being trustworthy, not one rewrite away.

**Prior verdicts, correctly re-labelled.** The four NOT READY verdicts before 08-07 were *narrative
judgments*, not computed results — no comparison ever executed (D2). They were **right, and
unearned**. The 08-07 sweep was the first that earned its verdict, and the brief for this run was
wrong to describe it as part of a barren streak: it produced fourteen findings and a blessed gate
spec. That correction matters, because the streak was the premise of this whole run.

### The three conditions from 2026-08-07 — status today, verified by me

| # | Condition (08-07) | Status | Evidence |
|---|---|---|---|
| 1 | Deploy gated on green CI, **with the EV assertion actually fixed** | **HALF MET** | EV assertion: **FIXED** — I ran `gameTreeEvaluator.test.js` today, 201/201 pass, so **FIND-098 is stale and should be retired by hand**. Gating: **NOT MET** — `grep -rn "workflow_run\|needs:" .github/workflows/` returns zero, `deploy.yml` runs no tests. |
| 2 | Honest data handling — deletion purges, backup covers everything | **NOT MET** | `AuthContext.jsx:294-296` still calls only `deleteUser` (cross-critic re-read it). `exportUtils.js` still pulls 3 of 25 stores. FIND-100/101 open, 12 days, no work item. |
| 3 | main carrying the real work; WS-439/440/441 fixed and walked on the phone | **PARTIALLY MET, AND REGRESSING** | The 82-commit backlog landed: `origin/main` is now `f54e9557` (08-16), not `86c0e387` (08-02). WS-441 **done**. But WS-440 is `in_progress`, **WS-439 — "Next Hand CTA clipped off-screen at preflop, the primary control unreachable" — is `deferred`**, and there are **19 new unpushed commits**, one carrying a broken test. The symptom cleared; the mechanism that produced it did not. |

### What flips the verdict — concrete, checkable, in order

**To flip "keep using it" from caveated to clean — one item, ~M effort:**
1. `usePersistence` surfaces `lastSavedAt` and its own catch to a view, and flushes the pending
   debounced write on `visibilitychange`/`pagehide` — not only on React unmount.
   *Falsifier that this worked:* kill the tab mid-hand on the phone; the hand is present on reload,
   and a forced save failure produces a visible signal, not a console line.

**To flip "NOT SAFE to launch" -> "SAFE", all four:**
2. Deploy gated on green CI (`workflow_run` edge + branch protection) — FIND-097, 12 days open.
3. Account deletion purges local data, and a user-invocable purge exists — FIND-100.
4. Backup/restore/purge derive their store list from the schema registry (`getStoresAtVersion`),
   `clearAllData` becomes atomic, and a parity test fails the build when a new store is added
   without a backup counterpart — FIND-101 + FIND-103.
5. **New, and it did not exist as a condition on 08-07:** an error sink exists in the product, so a
   failure of *any* kind has a bounded time-to-detect.

**And one that is not an engineering condition at all:** §(e) — decide whether there is a launch.
Conditions 2-5 are worth doing whether or not there is; they are the difference between an
instrument the founder can trust and one he cannot.

## (b) RANKED FINDINGS — re-ranked on TIME-TO-DETECT x (1 − RECOVERABILITY)

The cross-critic's central argument is adopted: **for a local-first, single-user, no-server,
no-telemetry app, "how long before he notices, and can it be got back" dominates "how bad if it
fires."** Instantly self-announcing defects have a bounded cost; the founder reacts. Silent
unrecoverable ones do not, and there is no instrument in this product that could shorten them.
Rankings below therefore differ from every phase-1 report.

---

**F1 · CRITICAL · Auto-save failure is unobservable, on the only production save path.**
`src/hooks/usePersistence.js:211` (sole non-test `saveHand` call site in the app) -> `:214-216`
swallow -> `:241-244` returns `lastSavedAt` -> `src/hooks/useAppState.js:85-93` captures nothing.
`grep -rn lastSavedAt src/` (non-test) = 3 hits, all inside the hook itself.
- **Defect:** every hand the founder records passes through one debounced write whose failure is
  invisible, and the value that would make it visible is computed, returned, tested and dropped.
- **time_to_detect: UNBOUNDED.** Nothing announces it. Discovery is by noticing a session review has
  fewer hands than were played — if he counts.
- **recoverability: NONE.** The hand is gone. `feedback_income_hand_specificity`: *"the unit of
  reality is the specific hand that happened."*
- **NEW this run.** Not in FIND-097..110. Not in the queue.

**F2 · CRITICAL · No error sink exists anywhere in the product.**
`src/utils/errorHandler.js:187-199` terminates at `console.error`; zero matches for
`Sentry|captureException|window.onerror|unhandledrejection` in `src/` (orchestrator-confirmed).
`postHogAdapter.js:92` is an opt-in *event* adapter, not an error channel.
- **Defect:** every failure class in this app has unbounded time-to-detect **by construction**, and
  no instrument exists that could shorten any of them.
- **time_to_detect: n/a — this IS the detection defect. recoverability: n/a.**
- **I am raising this from the cross-critic's HIGH to CRITICAL, with reasoning:** it is not one
  finding among many, it is the multiplier on F1, F3, F5, F6 and F12. It is also the single cheapest
  lever that shortens TTD across all of them simultaneously. A severity that ranks it alongside
  ordinary HIGHs mis-states its blast radius.
- **NEW this run.**

**F3 · HIGH · The pending debounced save is lost on backgrounding.**
`usePersistence.js:226-233` flushes on React unmount only; `DEBOUNCE_DELAY = 1500` (`:26`). Repo-wide
grep for `visibilitychange|pagehide|beforeunload` in `src/` (non-test) hits only
`useSpeechCapture.js` and `useBuildVersion.js`.
- **Defect:** phone lock, OS eviction of a backgrounded tab, or battery death mid-hand discards up
  to 1.5s of the most recent action — a river shove — with not even the F1 log line, because the
  closure never runs.
- **time_to_detect: UNBOUNDED. recoverability: NONE.**
- **On the target device this is the most likely trigger of the F1 class**, and it is the same
  ~20-line fix. **NEW this run.**

**F4 · HIGH · There is no recovery floor** (merged: architect KC#4 + security KC#2 + failure-eng #4
+ FIND-103).
`exportUtils.js:22` `EXPORT_VERSION '1.2.0' // Aligns with IndexedDB v12` against
`database.js:50 DB_VERSION = 28`; export pulls **3 of 25** stores; `validateImportData` validates the
same 3, so a restore reports success while photos/tournaments/rangeProfiles/exploitAnchors vanish;
`exportUtils.js:159-182` `clearAllData` is non-atomic **and runs as phase one of every restore**;
`SYSTEM_MODEL.md:252`'s "backup before destructive ops" **does not exist in code**;
`migrationRegistry.js:504` `getStoresAtVersion` is the exact enumerator and is never imported.
- **time_to_detect: at restore — i.e. the worst possible moment. recoverability: NONE** — the data
  was never captured.
- **RE-DISCOVERY: FIND-101 + FIND-103** (2026-08-07, open, no work item). Related: **WS-266**
  (`exportAllData` omits `anchorObservations`, backlog, S) is a single-store instance of the same
  defect and should be **absorbed**, not worked separately.

**F5 · HIGH · Migrations can silently clobber fields, and the ordering rule that prevents it on the
most valuable store is an English sentence.**
`migrations.js:1350` (`oldVersion < 23`) and `:1354` (`oldVersion < 24`) unguarded by
`oldVersion > 0`; both open `players.openCursor()` in one transaction (`:798-799`, `:870-871`), both
`c.update()`. The hazard class is documented by the codebase itself at `:1077-1087` and *guarded* in
v27/v28 — v23/v24 have no guard. Every seed in `migrationV24.test.js` starts at v23, so the co-run
path is untested by construction. **And `:1178` "MUST STAY LAST" has no assertion behind it**,
guarding `hands`.
- **time_to_detect: UNBOUNDED** — the transaction commits cleanly; there is no error at all.
  **recoverability: NONE**, and F4 means there is no snapshot behind it.
- **Downgraded CRITICAL -> HIGH per cross-critique:** fresh installs walk an empty store, so no
  launch-population user is exposed; the exposed set is installs at v1-22, existence unverified (U2).
  **Remediation unchanged and mandatory.** The forward half (`:1178`) outranks the historical half.
- **PARTIAL RE-DISCOVERY: FIND-104** already names "v23 cursor migration untested" and "migrateV28
  must-stay-last enforced by comment only." **The v23/v24 co-run clobber *mechanism* is NEW** and is
  not in FIND-104.

**F6 · HIGH · Cross-boundary message forgery poisons the villain models silently.**
`src/hooks/useSyncBridge.js:238` and `ignition-poker-tracker/content/app-bridge.js:149` gate on
`event.source !== window` only. `ignition-capture.js:442-443` checks **both** source and origin,
with a comment naming the pattern.
- **Defect:** any script in that document can inject schema-valid fabricated hands.
  `useSyncBridge.js:246-256` validates *shape*, which stops malformed data and not fabricated data.
  For a Bayesian-modelling product this is worse than defacement.
- **time_to_detect: UNBOUNDED** — poisoned posteriors produce plausible advice.
  **recoverability: POOR** — fabricated hands are not separable from real ones after the fact.
- **I promote this above the account/CSP cluster on the TTD axis**, per the cross-critic's
  toward-goal ruling: it attacks Imagined Outcome capability (2), "player-interaction relations."
- **RE-DISCOVERY: FIND-083**, but **misfiled** (`FIND-083.yaml:7` program `methodology-integrity`
  while `:16` routes it to security) and **unowned** — **WS-514 covers only the captureId half.**

**F7 · HIGH · Red CI and green deploy fire in parallel, today.**
`ci.yml` and `deploy.yml` both `on: push: branches: [main]`, no `needs`, no `workflow_run`
(verified by me today, zero matches). `deploy.yml` runs `check-untracked-imports.mjs` + `npm run
build`, no tests. `scripts/__tests__/phhAdapter.test.js` fails **right now in both the committed and
the working tree** (orchestrator ran both; `:195` and `:205`, 1 failed / 21 passed each), broken by
`56ef59096` (WS-521), whose commit message claims "4,887 tests pass."
- **time_to_detect: MEDIUM for the deploy itself** (a build error is loud; a *passing build of
  failing code* is not); **UNBOUNDED for whatever the shipped defect writes to IndexedDB.**
  **recoverability: YES for the deploy** (redeploy); **NO for data written by a wrong build.**
- **RE-DISCOVERY: FIND-097** (CRITICAL, open, 12 days, **no work item**) + a **new live instance**.
  Note that **FIND-098 is now STALE** — I ran its cited test, 201/201 — so the sequencing constraint
  in FIND-097's `recommended_fix` ("root-cause the EV inversion BEFORE landing the gating") is
  **cleared**. Gating can land now. That is the single most actionable thing this synthesis produces.

**F8 · HIGH · Account deletion is theatre, and no purge path exists anywhere in the product.**
`src/contexts/AuthContext.jsx:294-296` calls only `deleteUser(auth.currentUser)`; `clearAllData` has
no caller on that path. Every hand, session, ethnicity/physical-description field and unencrypted
photo blob survives, while the UI says "Account deleted."
- **time_to_detect: NEVER** (nothing ever contradicts the toast). **recoverability: YES, trivially**
  — the data is still there; that is precisely the defect.
- **Kept at HIGH rather than CRITICAL on this axis** (nothing is lost; a promise is broken), but it
  is a *trust* defect with a non-technical blast radius: a partner, a store reviewer, or a described
  player would read it as a data-protection failure on sight.
- **RE-DISCOVERY: FIND-100** (CRITICAL, open, 12 days, **no work item**).

**F9 · HIGH · The only irreversible control has no confirmation step.**
`Reset Hand` discards the entire hand's recorded actions in one tap, sits adjacent to the visually
near-identical non-destructive `Reset Street`, and directly above the full-width `Next Hand` CTA.
- **time_to_detect: INSTANT. recoverability: NONE** — the recorded actions are gone; re-entry is
  from memory, at a live table.
- **The size clause is STRUCK** (`touch-floor.spec.js:48` pins it as a deliberate de-emphasis; a
  smaller target is harder to slip onto). The confirmation gap survives alone at HIGH.
- **NEW this run.**

**F10 · HIGH · Live advice can freeze the UI for tens of seconds, and the mechanism that would
prevent it is built, tested, and unwired.**
`computeHelpers.js:251-272` calls `evaluateGameTree` without `onFastResult`;
`gameTreeEvaluator.js:1611-1622` ("THE YIELD IS LOAD-BEARING") only fires `if (onFastResult)`;
`useLiveActionAdvisor.js:206` awaits it on the render thread; no wall-clock deadline;
`treeMetadata.latency` persisted nowhere; SYSTEM_MODEL §7.1 records a 26s worst case *on desktop*.
- **time_to_detect: INSTANT. recoverability: YES (wait).** Which is why it ranks here and not at the
  top — but its blast radius is the product's core value proposition, "cueing in the moment."
- **RE-DISCOVERY: FIND-109 / WS-468** (backlog, unclaimed, effort L). Also **FIND-067** (open, HIGH):
  no depth/confidence marker distinguishes the 200ms guess from the 2000ms refinement, so the founder
  acts on a number whose status the UI does not state — a direct `intention.md` **P2** violation.

**F11 · HIGH · The touch-floor instrument cannot see the two highest-traffic controls.**
`CardSlot.jsx:63-67` is a plain `<div onClick>` — no role, tabIndex, aria-label or onKeyDown —
rendering **27.8x40.3 px** at the S22 profile; the 12 nav-rail buttons render **28x28 px** with
`title` only (no hover on touch). `touch-floor.spec.js:102` scopes the roster to
`[data-testid="command-column"]`, so both are structurally outside it; `:131-134` is `test.fixme`
on the mid-hand state. `CLAUDE.md` tells every session enforcement lives in that file.
- **time_to_detect: INSTANT. recoverability: YES.**
- **Downgraded from product-ux's CRITICAL** on the TTD axis: the founder has been living with these
  daily and they announce themselves on every tap. **The instrument gap is the durable finding**, not
  the pixel counts — a purely geometric fix would still pass CI with zero accessible names.
- **PARTIAL RE-DISCOVERY: WS-489** (backlog, L) owns the *fix* for interactive regions; **WS-441**
  (done) built the instrument. **The roster/semantics gap is NEW.** Inherits U6.

**F12 · MEDIUM · No quota instrumentation anywhere.** Zero matches for
`navigator.storage.estimate|navigator.storage.persist` in `src/`; `QuotaExceededError` is handled in
exactly one of ~30 persistence modules (`handsStorage.js:121`). The app never requests persistent
storage, so on mobile Chrome it is a normal eviction candidate.
- **TTD: UNBOUNDED** (it manifests as F1). **recoverability: NONE.**
- **Duplicate collapsed** (failure-eng + performance filed the same grep) -> owned by
  failure-engineering as a durability finding. **RE-DISCOVERY: FIND-104**, partial. Sibling already
  queued: **WS-515** (extension journal returns `success: true` on a quota throw) — *the same defect
  shape on the other capture path*, priority 55, backlog.

**F13 · MEDIUM · The gates fail before the tests, in the least informative way.**
`ci.yml:27` `check-label-ledger.sh` precedes `ci.yml:34` `npm test`; `smart-test-runner.sh` has the
same ordering and is currently blocked entirely by untracked `scripts/backtest/ladder/rungs.card.js`
(19,333 B, 5 unledgered constructs). CI is clean **only because the file is untracked** — committing
it converts a local annoyance into a full CI outage whose output is identical for 1 broken test and
15,922. **TTD: INSTANT. recoverability: YES.** **NEW this run** (ADDED-3).

**F14 · MEDIUM · Canonical docs are wrong by 2-3x and ~100 days past their own threshold.** C4.
**TTD: UNBOUNDED — it degrades every future session's reasoning silently.** **recoverability: YES.**
**RE-DISCOVERY: FIND-110 / WS-461** (backlog, M, unclaimed).

**F15 · MEDIUM · No bundle-size instrument.** Main chunk **781,989 B** raw / ~243 KB gzip
(`dist/assets/index-6jypFfmm.js` — the performance engineer's `index-CSjMXJ_6.js` was overwritten
mid-run by a concurrent expert and does not exist; the size reproduces, the artifact does not).
Rollup's >500 kB warning is advisory; nothing fails on it. Firebase (109 KB) is `modulepreload`ed on
every load including guest sessions. **TTD: INSTANT (cold load). recoverability: YES.**
**RE-DISCOVERY: FIND-110.** *Note: the performance engineer reported "~1.25 MB / ~398 KB gzip" and
"1332 KB / ~412 KB gzip" for the same quantity in one finding — do not quote either without
re-measuring.*

**F16 · MEDIUM · One test is 87% of the suite's wall clock.** `shapesCatalog.test.js` at 480,651 ms
of a 549 s run (15,922 tests / 686 files — itself ~3x the documented "~5,400 tests / ~184 files").
Tagged `slow-unit`, no budget enforcement. **TTD: INSTANT. recoverability: YES.** **NEW this run.**

**F17 · MEDIUM · Extension stealth design is an account risk, not a code vulnerability.**
`capture-websocket-probe.js` runs MAIN-world at `document_start`, monkey-patches `window.WebSocket`
via Proxy, headers itself "STEALTH WEBSOCKET PROXY" (`:80`), hides patch markers in closure-scoped
`Symbol()`s (`:24`) and fakes `toString()` (`:42-43`, `:126-131`). `manifest.json:3-5` describes it
as "Poker Session Notes / Personal poker session note-taking assistant"; `:14` ships
`http://localhost:5173/*` as a production host permission.
- **TTD: UNBOUNDED until it fires, then INSTANT. recoverability: potentially NONE** — the blast
  radius is a real-money account balance.
- **This is a founder decision, not an engineering one.** Surfacing it is the job; deciding it is not.
- **RE-DISCOVERY: FIND-105**, partial (the ToS/account framing is new).

**F18 · LOW · The founder-blessed GATE-SPEC carries a latent 6x scale defect.**
`.claude/workstream/evidence/run-launch-sweep-2026-08-07.md:57-67` pass condition *"every blocking
program health >= 60"*; `health-scoring.js:33/37/116` bound every score at 10.
- **Prospective, not retrospective.** No comparison has ever executed (D2), so no past verdict was
  ever computed wrongly. **It fires the moment anyone implements the spec.**
- **TTD: INSTANT on implementation (the gate would never go green). recoverability: YES.**
- **Also LOW, documentation-integrity:** four `protocol_history` entries state "vs required 60" as
  their reason, so the recorded rationale of past verdicts cites a comparison that never ran.
- **RE-DISCOVERY: FIND-106** (which is the live half — the missing reader).

**F19 · LOW · No CSP header** (`firebase.json` sets Cache-Control only). No server, no remote
user-generated content, one user. **Dropped from the security engineer's HIGH** per D6. **TTD: n/a.**
**RE-DISCOVERY: FIND-105.**

**F20 · UNRESOLVED, not a finding · 14 npm advisories (2 critical) of unproven reachability.**
Settle U3 before deciding anything. If they reach the bundle it is a real HIGH; if not it closes.
Do not add a CI gate on an unanswered reachability question.

---

### Findings this run RE-DISCOVERED rather than found — say it plainly

| This run | Already filed | Age | Work item? |
|---|---|---|---|
| F4 (backup/restore/purge) | FIND-101 + FIND-103 | 12 d | **none** |
| F5 (untested cursor migrations, MUST-STAY-LAST by comment) | FIND-104 (partial) | 12 d | **none** |
| F6 (postMessage origin) | FIND-083 (misfiled program) | — | only the *other* half (WS-514) |
| F7 (deploy not gated on CI) | FIND-097 | 12 d | **none** |
| F8 (account deletion) | FIND-100 | 12 d | **none** |
| F10 (advice latency, device identity) | FIND-109 + FIND-067 | 12 d | WS-468 (backlog, unclaimed) |
| F12 (quota) | FIND-104 (partial) | 12 d | WS-515 covers the extension sibling only |
| F14 (doc drift) | FIND-110 | 12 d | WS-461 (backlog, unclaimed) |
| F15 (bundle instrument) | FIND-110 | 12 d | **none** |
| F18/F19 (gate scale, CSP) | FIND-106 / FIND-105 | 12 d | **none** |
| Guest auto-merge (not re-found this run) | FIND-102 | 12 d | **none** |
| Stamp != recompute (not re-found this run) | FIND-107 | 12 d | **none** |
| Session-recovery regressions (not re-found) | FIND-108 | 12 d | **none** |
| **FIND-098 — now STALE** | FIND-098 | 12 d | retire by hand; I ran the test, 201/201 |

**Genuinely new:** F1, F2, F3, F9, F13, F16, the v23/v24 co-run *mechanism* in F5, the roster gap in
F11, and W1/W3 as structural patterns. **That is nine new items out of ~sixty produced — and the two
experts who produced almost all of them are the two who ran or traced the actual product.**

## (c) WORK ITEM PROPOSALS

IDs are placeholders — `/workstream` assigns. `priority_score` is RICE
(reach x impact x confidence / effort). Dedup keys use
`{engine}-{category}-{file-path}-{line-range}`. Items marked AMEND are not new tickets.

```yaml
- id: "WS-NEW-A"
  title: "The save has no light: surface lastSavedAt and the auto-save catch, and flush the pending write on pagehide — one debounced write, one silent failure, one hand gone"
  type: bug
  priority_score: 90
  category: data-integrity
  program: data-quality
  capability: core
  runs_on: g16
  effort: M
  description: |
    usePersistence.js:211 is the ONLY production saveHand call site in the app (verified:
    grep "saveHand(" src/ excluding tests). Its catch at :214-216 calls logError, which
    terminates at console.error (errorHandler.js:187-199). The hook computes and returns
    lastSavedAt (:241-244); its sole production caller useAppState.js:85-93 invokes it as a
    bare statement and captures nothing; grep -rn lastSavedAt src/ (non-test) returns only
    the hook's own three lines. Separately the cleanup at :226-233 flushes pendingSaveRef on
    React unmount only — not on phone lock, OS eviction of a backgrounded tab, or battery
    death, which are the real triggers on the target device. Repo-wide grep for
    visibilitychange|pagehide|beforeunload in src/ (non-test) hits only useSpeechCapture and
    useBuildVersion.
    time_to_detect UNBOUNDED, recoverability NONE. Run's #1 finding, and it is ~20 lines of
    wiring to a value that already exists and is already tested (usePersistence.test.js:283-299).
  accept_criteria:
    - "TableView renders a persistent save-state indicator driven by lastSavedAt (e.g. 'saved 3s ago') visible during live play at the S22 profile — verified by devshot, not by class string."
    - "A forced saveHand rejection (quota stub / blocked DB) produces a visible in-app failure state, not only a console line."
    - "A visibilitychange->hidden and a pagehide each force-flush pendingSaveRef synchronously; unit-tested with fake timers and manually verified by locking the phone mid-hand and reloading."
    - "No new production path swallows a persistence error without a UI-observable consequence."
  files_involved:
    - "src/hooks/usePersistence.js"
    - "src/hooks/useAppState.js"
    - "src/components/views/TableView"
  dedup_key: "eng-engine-data-integrity-src-hooks-usePersistence.js-211-244"

- id: "WS-NEW-B"
  title: "Give the product an error sink — no Sentry, no window.onerror, no unhandledrejection anywhere in src/, so every silent failure has unbounded time-to-detect by construction"
  type: infrastructure
  priority_score: 60
  category: infrastructure
  program: infrastructure
  capability: core
  runs_on: g16
  effort: M
  description: |
    grep -rEl "Sentry|captureException|window.onerror|unhandledrejection" src/ returns ZERO
    files (orchestrator-confirmed). errorHandler.js:187-199 terminates at console.error.
    postHogAdapter.js:92 is an opt-in event adapter, not an error channel. Nobody reads a
    console on a phone at a poker table.
    This is the enabling condition beneath F1, F3, F5, F6 and F12 — the multiplier that turns
    each from detectable into unbounded, and the cheapest single lever that shortens
    time-to-detect across all of them at once. Local-first: the sink must be on-device (an IDB
    errors store plus a visible badge), NOT a remote service — no server exists and none is wanted.
  accept_criteria:
    - "A single app-level error channel captures window.onerror, unhandledrejection, and every logError call, persisting to an IndexedDB errors store with timestamp, message, stack and a context tag."
    - "A visible indicator appears when unacknowledged errors exist; Settings exposes the log and can clear it."
    - "The store is bounded (ring buffer) and is included in the WS-NEW-D export manifest."
    - "A deliberately thrown error in a view is visible in the UI within one interaction at the S22 profile, verified by screenshot."
  files_involved:
    - "src/utils/errorHandler.js"
    - "src/utils/persistence/"
    - "src/components/ErrorBoundary.jsx"
    - "src/components/ui/"
  dedup_key: "eng-engine-infrastructure-src-utils-errorHandler.js-187-199"
```

```yaml
- id: "WS-NEW-C"
  title: "Land the deploy gate now — FIND-098's blocker is cleared (201/201 today), the tree still fails a different test, and CI and deploy fire in parallel on every push to main"
  type: infrastructure
  priority_score: 72
  category: infrastructure
  program: infrastructure
  capability: core
  runs_on: any
  effort: M
  description: |
    ci.yml and deploy.yml both trigger on push branches [main]; grep -rn "workflow_run|needs:"
    .github/workflows/ returns zero (re-verified 2026-08-19). deploy.yml runs
    check-untracked-imports.mjs and npm run build — no test step. Pushing local main right now
    produces a failing CI run and a successful production deploy of the same commit, in parallel.
    FIND-097's recommended_fix sequenced this behind FIND-098 ("root-cause the EV inversion
    BEFORE landing the gating"). THAT BLOCKER IS CLEARED: I ran
    src/utils/exploitEngine/__tests__/gameTreeEvaluator.test.js on HEAD 32d968a4 today —
    201/201 pass, 238s. FIND-098 should be retired by hand as part of this item.
    Prerequisite within this item: scripts/__tests__/phhAdapter.test.js fails in BOTH the
    committed tree (:195) and the working tree (:205), 1 failed / 21 passed each, broken by
    56ef59096 (WS-521) which added priorRole/scenario/raisesFaced to derivePreflopDecisions()
    without updating the pinned golden case. Gating a red tree just blocks every deploy.
  accept_criteria:
    - "phhAdapter golden case passes on the committed tree — root-caused (is priorRole correct output the golden must absorb, or a regression?), not snapshot-updated blindly."
    - "deploy.yml runs on workflow_run of the CI workflow, gated on conclusion == success."
    - "Branch protection on main requires the CI check — verified with gh api repos/:owner/:repo/branches/main/protection, and the current setting recorded either way (U4)."
    - "A deliberately failing test on a scratch branch demonstrably blocks the deploy job."
    - "FIND-098 marked resolved with the 201/201 evidence; FIND-097 closed by this item."
  files_involved:
    - ".github/workflows/deploy.yml"
    - ".github/workflows/ci.yml"
    - "scripts/__tests__/phhAdapter.test.js"
    - "src/utils/rangeEngine/lineTaxonomy.js"
  dedup_key: "eng-engine-infrastructure-.github-workflows-deploy.yml-1-20"

- id: "WS-NEW-D"
  title: "Build the recovery floor: derive backup, restore and purge from the schema registry, make clearAllData atomic, snapshot before upgrade — today it captures 3 of 25 stores and reports success"
  type: bug
  priority_score: 55
  category: data-integrity
  program: data-quality
  capability: core
  runs_on: g16
  effort: L
  description: |
    Merges FIND-101 + FIND-103 + architect KC#4 + security KC#2 + failure-engineer #4, filed as
    four separate findings by three experts with two different denominators and never joined.
    Verified counts: 25 unique stores (storesAdded union in migrationRegistry.js; grep -c
    createObjectStore migrations.js = 25 independently). exportUtils.js:22 EXPORT_VERSION 1.2.0
    comments itself as aligned to IDB v12 against database.js:50 DB_VERSION = 28; exportAllData
    (:32-54) imports only getAllHands/getAllSessions/getAllPlayers; validateImportData validates
    the same three arrays, so restore reports success while photos, tournaments, rangeProfiles,
    exploitAnchors and anchorObservations vanish. clearAllData (:159-182) is three sequential
    non-transactional phases and runs as phase ONE of every restore. SYSTEM_MODEL.md:252 claims
    "backup before destructive ops" — it does not exist in code. migrationRegistry.js:504
    getStoresAtVersion() is the exact enumerator and exportUtils.js does not import
    migrationRegistry at all — a shipped-but-inert capability (see WS-NEW-J).
    ABSORBS WS-266 (anchorObservations backup gap) — one store of the same defect.
  accept_criteria:
    - "exportAllData, importData/validateImportData and clearAllData all derive their store list from getStoresAtVersion(DB_VERSION) — no hand-enumerated import list remains."
    - "A parity test fails the build when a store exists in MIGRATION_REGISTRY with no backup/restore/purge counterpart."
    - "playerPhotos blobs round-trip, or the export refuses to emit a dangling photoBlobId."
    - "validateImportData fails loudly on version skew instead of reporting success."
    - "clearAllData runs in a single readwrite transaction across all cleared stores, or stages into shadow stores and swaps."
    - "An automatic pre-upgrade snapshot runs before onupgradeneeded, or SYSTEM_MODEL.md:252 is corrected in the same commit — the doc and the code agree either way."
    - "WS-266 closed as absorbed."
  files_involved:
    - "src/utils/exportUtils.js"
    - "src/utils/persistence/migrationRegistry.js"
    - "src/utils/persistence/database.js"
    - "src/components/views/SessionsView"
    - ".claude/context/SYSTEM_MODEL.md"
  dedup_key: "eng-engine-data-integrity-src-utils-exportUtils.js-22-182"
```

```yaml
- id: "WS-NEW-E"
  title: "Guard the v23/v24 concurrent cursor walk on players, and put an executable assertion behind 'MUST STAY LAST' on the hands store"
  type: bug
  priority_score: 45
  category: data-integrity
  program: data-quality
  capability: core
  runs_on: any
  effort: M
  description: |
    migrations.js:1350 (oldVersion < 23) and :1354 (oldVersion < 24) are unguarded by
    oldVersion > 0; both open players.openCursor() (:798-799, :870-871) in the SAME upgrade
    transaction and both call c.update(). The codebase documents this exact hazard class at
    :1077-1087 and guards it for hands in v27 (:1094-1099) and v28 (:1152-1171); v23/v24 have
    no guard. The transaction commits cleanly, so a player record can silently lose one
    migration's fields with no error at all. Every seed in migrationV24.test.js calls
    seedPlayersAtVersion(23, ...) so the co-run path is untested by construction.
    SEVERITY CORRECTED CRITICAL -> HIGH: on a fresh install oldVersion = 0 and migrateV1 creates
    players in the same transaction, so both cursors walk an EMPTY store — new users are NOT
    exposed. The exposed set is installs at DB v1-22, existence unverified (WS-NEW-K).
    Remediation unchanged and mandatory.
    The higher-value half is forward-looking: migrations.js:1178 "MUST STAY LAST" is an English
    sentence with no assertion behind it, guarding hands — the store every future user will have
    populated. FIND-104 already names the untested-cursor half; the co-run MECHANISM is new.
  accept_criteria:
    - "migrateV23/migrateV24 use the v27/v28 skip-or-reapply pattern, or are merged into a single cursor walk."
    - "A test seeds the DB below v23 and asserts every field written by both migrations survives the co-run — this test fails against current main."
    - "An executable assertion fails when a hands-store cursor migration is registered after migrateV28, replacing the comment at :1178."
    - "Behavioral tests exist for the v7 userId backfill and v13 seatActions cursor migrations (FIND-104's named highest-exposure pair)."
  files_involved:
    - "src/utils/persistence/migrations.js"
    - "src/utils/persistence/__tests__/migrationV24.test.js"
    - "src/utils/persistence/migrationRegistry.js"
  dedup_key: "eng-engine-data-integrity-src-utils-persistence-migrations.js-768-946"

- id: "WS-NEW-F"
  title: "Check event.origin on the app-side postMessage listeners — the extension's own casino-page listener already does, and fabricated schema-valid hands poison the villain models silently"
  type: bug
  priority_score: 50
  category: data-integrity
  program: security
  capability: extension
  runs_on: g16
  effort: S
  description: |
    src/hooks/useSyncBridge.js:238 and ignition-poker-tracker/content/app-bridge.js:149 gate
    window.postMessage handlers on event.source !== window only. event.source === window is true
    for ANY script in that document. ignition-capture.js:442-443 checks both source and origin
    ("RT-42: defense-in-depth origin check") — the codebase knows the pattern and applied it on
    one hop of two.
    Consequence is model poisoning, not XSS: useSyncBridge.js:246-256 validates hand SHAPE
    (validateHandForRelay + validateHandRecord), which stops malformed data and not fabricated
    data. For a product whose entire value is Bayesian modelling built from recorded hands, a
    believable fake stream is worse than defacement, and it is silent.
    ALREADY DIAGNOSED as FIND-083 but misfiled: FIND-083.yaml:7 says program
    methodology-integrity while :16 says "ROUTE: origin check to security". WS-514 covers only
    the captureId/dedup half. This half is unowned.
  accept_criteria:
    - "Both listeners validate event.origin against the expected origin, matching the ignition-capture.js:442-443 pattern."
    - "A test injects a same-document postMessage from an unexpected origin and asserts it is rejected."
    - "FIND-083's security half is re-filed under program security; the methodology-integrity record cross-references it."
  files_involved:
    - "src/hooks/useSyncBridge.js"
    - "ignition-poker-tracker/content/app-bridge.js"
    - ".claude/workstream/findings/FIND-083.yaml"
  dedup_key: "eng-engine-data-integrity-src-hooks-useSyncBridge.js-238-256"

- id: "WS-NEW-G"
  title: "Account deletion purges nothing and no purge path exists anywhere in the product — the toast says 'Account deleted' while every hand, physical description and photo blob stays on disk"
  type: bug
  priority_score: 40
  category: data-integrity
  program: security
  capability: core
  runs_on: g16
  effort: M
  description: |
    FIND-100, filed 2026-08-07, CRITICAL, open, twelve days, NO WORK ITEM — this item is the
    conversion, not a re-discovery. AuthContext.jsx:294-296 calls only
    deleteUser(auth.currentUser); clearAllData has zero non-test callers outside
    exportUtils.js:205 (import replace-mode). Facilitator-verified stronger form from 08-07 and
    re-confirmed in cross-critique: no user-invocable purge path exists ANYWHERE in the product,
    even outside the deletion flow.
    Sequence AFTER WS-NEW-D — the purge must enumerate from the same registry, or it will purge
    3 of 25 stores exactly as the backup does.
  accept_criteria:
    - "deleteAccount purges every user-scoped store (including playerPhotos blobs) before calling deleteUser, ordered so a failed purge aborts the deletion."
    - "The confirm modal offers export-first."
    - "A user-invocable 'delete all my data' path exists independent of account deletion."
    - "The toast copy matches what actually happened in every branch."
  files_involved:
    - "src/contexts/AuthContext.jsx"
    - "src/components/ui/AccountSection.jsx"
    - "src/utils/exportUtils.js"
  dedup_key: "eng-engine-data-integrity-src-contexts-AuthContext.jsx-276-304"
```

```yaml
- id: "WS-NEW-H"
  title: "Confirmation on Reset Hand — the only irreversible control in the app is one tap, unconfirmed, and visually near-identical to the non-destructive Reset Street beside it"
  type: bug
  priority_score: 38
  category: ux
  program: design
  capability: core
  runs_on: g16
  effort: S
  description: |
    Reset Hand discards the entire hand's recorded actions in one tap. It sits adjacent to Reset
    Street (same dark treatment, similar size) and directly above the full-width gold Next Hand
    CTA, on a surface used one-handed under time pressure at a live table. Recoverability NONE —
    re-entry is from memory.
    THE SIZE ARGUMENT IS STRUCK: touch-floor.spec.js:48 pins Reset Hand at minToday 24 with
    reason 'deliberately de-emphasized destructive action, 40 design px'. The smallness is an
    intentional mitigation and a smaller target is HARDER to slip onto. Do not enlarge it.
    Design gate: docs/design/audits/2026-07-31-entry-confirm-before-commit.md already exists for
    this class — check it per-control rather than assuming it closed the loop.
  accept_criteria:
    - "Reset Hand requires a confirmation distinguishable from routine controls (hold-to-confirm or a modal); Reset Street is unaffected."
    - "The control's rendered size is unchanged — the de-emphasis mitigation is preserved."
    - "The change references the audit-id / surface-id it implements, per the Design Program Guardrail."
    - "Verified by devshot at the S22 profile, not from the class string."
  files_involved:
    - "src/components/views/TableView"
    - "tests/playwright/touch-floor.spec.js"
    - "docs/design/surfaces/"
  dedup_key: "eng-engine-ux-src-components-views-TableView-reset-hand"

- id: "WS-NEW-I"
  title: "The touch-floor gate measures one container and fixmes the state that matters — card slots (27.8x40.3) and the 12-button nav rail (28x28) are invisible to it, and none of them have accessible names"
  type: bug
  priority_score: 35
  category: ux
  program: design
  capability: core
  runs_on: g16
  effort: M
  description: |
    touch-floor.spec.js:102 scopes the roster to [data-testid="command-column"], so CardSlot.jsx
    (the highest-frequency target in the app) and the persistent nav rail are outside the
    measured root entirely; :131-134 is test.fixme on the mid-hand action grid and HandReplay
    transport — not test.skip with a passing baseline. CLAUDE.md tells every session that
    rendered-size enforcement lives in that file, which reads as coverage.
    Measured on a live dev server at the S22 profile (1170x540, DPR2, scale 0.694687, matching
    devshot exactly): hole-card slots 27.8x40.3, community-card slots 38.9x55.6, all 12 nav
    buttons 28x28. CardSlot.jsx:63-67 is a plain div with onClick — no role, tabIndex,
    aria-label or onKeyDown — so it is also unreachable by tab order and invisible to any
    accessibility walk. The nav buttons carry title only, which requires hover and therefore
    does not exist on a touchscreen.
    THE FIX for the geometry is WS-489 (interactive regions in real CSS px). THIS ITEM is the
    instrument gap plus semantics: a purely geometric fix would still pass CI with zero
    accessible names. Inherits U6 — deviceProfiles.mjs:9-12 marks the S22 DPR provisional; at
    DPR 2.625 every number above gets worse.
  accept_criteria:
    - "The touch-floor roster covers CardSlot (both variants) and the nav rail, or the spec states in code why a surface is exempt."
    - "The :131-134 fixme is replaced by a real measurement of the mid-hand action grid and HandReplay transport, with a PINNED baseline where the floor is not yet met."
    - "An accessible-name check fails CI when an interactive element has no accessible name; CardSlot gains role/tabIndex/aria-label/onKeyDown and the nav buttons gain aria-label."
    - "The S22 DPR is measured on the real device via /device-probe.html and deviceProfiles.mjs:9-12 stops saying provisional (closes U6, feeds FIND-109)."
  files_involved:
    - "tests/playwright/touch-floor.spec.js"
    - "tests/playwright/deviceProfiles.mjs"
    - "src/components/ui/CardSlot.jsx"
    - "src/components/ui/"
  dedup_key: "eng-engine-ux-tests-playwright-touch-floor.spec.js-45-134"

- id: "WS-NEW-J"
  title: "AMEND WS-464 — three shipped-but-inert capabilities in one audit; extend the reachability gate from engine exports to hook return values and cross-module helpers"
  type: infrastructure
  priority_score: 34
  category: domain-correctness
  program: domain-correctness
  capability: governance
  runs_on: any
  effort: M
  description: |
    AMEND WS-464 rather than filing new — that item already scopes "every exported engine symbol
    has a production importer or a dated @inert-until annotation" (backlog, priority 30, M).
    This run found the pattern is NOT confined to engine exports:
      1. lastSavedAt — computed, returned by usePersistence:241-244, TESTED at
         usePersistence.test.js:283-299, zero production consumers.
      2. onFastResult — declared and guarded at gameTreeEvaluator.js:954,1611-1622, tested
         (depthReachability.test.js:249 names the risk class in a comment), zero production
         callers; computeHelpers.js:251-272 does not pass it.
      3. getStoresAtVersion — migrationRegistry.js:504, never imported by exportUtils.js.
    Each was found by a different expert and none noticed it was a pattern. It is already in the
    founder's memory as feedback_shipped_but_inert_capability. Recurring three times in one audit
    is itself the finding.
    Note the compounding failure mode: a TEST of an inert capability reads as coverage of the
    live path. The senior engineer cited usePersistence.test.js as proof the core save path is
    guarded — the exact lines with no production consumer.
  accept_criteria:
    - "WS-464's scope covers hook return values and cross-module exported helpers, not only engine symbols."
    - "The gate flags a symbol whose only importers are test files."
    - "The gate flags all three known instances against current main (known-answer anchor); each is either wired or annotated @inert-until with a date."
  files_involved:
    - ".claude/workstream/queue/WS-464.yaml"
    - "src/hooks/usePersistence.js"
    - "src/utils/exploitEngine/gameTreeEvaluator.js"
    - "src/utils/persistence/migrationRegistry.js"
  dedup_key: "eng-engine-domain-correctness-cross-cutting-shipped-but-inert-x3"
```

```yaml
- id: "WS-NEW-K"
  title: "Ask the founder's device: has a hand already been silently lost, and what DB version is it on — ten minutes that convert this run's top two findings from theoretical to measured"
  type: task
  priority_score: 65
  category: measurement
  program: data-quality
  capability: core
  runs_on: g16
  effort: S
  description: |
    Nobody in this run asked whether the failure they proved is POSSIBLE has already HAPPENED.
    hands records carry timestamps and sessions carry hand counts, so a per-session count
    mismatch is queryable directly from the founder's own IndexedDB. Reading db.version answers
    whether the v23/v24 clobber (WS-NEW-E) is a live hazard or archaeology on this device.
    Highest information-per-minute item in the whole run. It also sets the priority of WS-NEW-A
    and WS-NEW-E: a confirmed loss makes them urgent, a clean history makes them preventive —
    and either answer is worth having before the work starts.
  accept_criteria:
    - "A one-off diagnostic (dev console or a Settings debug panel) reports current db.version, hand count per session vs the session's recorded hand count, and any gaps."
    - "The result is recorded in the finding record for WS-NEW-A — measured, with the date, not asserted."
    - "U2 answered: the exposure set for WS-NEW-E is stated as a fact rather than an assumption."
  files_involved:
    - "src/utils/persistence/database.js"
    - "src/utils/persistence/handsStorage.js"
    - "src/utils/persistence/sessionsStorage.js"
  dedup_key: "eng-engine-measurement-founder-device-hand-loss-and-db-version"

- id: "WS-NEW-L"
  title: "FOUNDER DECISION — does the launch program have a referent? intention.md never says 'launch', OQ-001 is still the unedited template placeholder, and prog-launch has been 'temporary' for 110 days"
  type: decision
  priority_score: 58
  category: methodology
  program: launch
  capability: governance
  runs_on: phone
  effort: S
  description: |
    Six experts assessed readiness for an event with no audience and not one asked whether the
    event exists. Evidence: system/intention.md contains no occurrence of "launch", "users",
    "distribution" or "pricing", and its Imagined Outcome names four capabilities (trusted math
    -> player-interaction relations -> cueing -> manipulation), none of which is a shipping
    event. intention.md:77 OQ-001 is verbatim the template placeholder text with status open —
    the register was never populated, so the question was never even asked.
    prog-launch.yaml:107 blocking_programs [] carries the comment "/adopt populates based on
    archetype" — the program was installed by a template, not authored for this repo.
    prog-launch.yaml:4 lifecycle temporary, created 2026-05-01, 110 days.
    kit/scripts/cwos-pulse.js contains zero occurrences of "launch".
    Per .claude/rules/improvement-default.md the founder makes this call, not the AI, and the
    options carry costs. See synthesis section 4(e) for three options and their stated costs.
    THIS IS NOT A DESCOPE: removing an aggregator with no referent removes a limitation. The
    engineering findings it currently sits on top of (WS-NEW-A..I) are unaffected and proceed
    either way.
  accept_criteria:
    - "The founder picks one of: (1) name the audience and date, program stays with a real contract; (2) rewrite it into a Trustworthy-Instrument gate whose blocking set is data-integrity and the answer path; (3) retire it and route its findings to the owning programs."
    - "OQ-001 is either answered with a date or replaced with the real open question."
    - "If the program survives, the GATE-SPEC's health >= 60 pass condition is corrected to the 0-10 scale in the same edit (F18)."
    - "The decision is recorded via /decide with weight heavy."
  files_involved:
    - ".claude/workstream/programs/prog-launch.yaml"
    - "system/intention.md"
    - ".claude/workstream/evidence/run-launch-sweep-2026-08-07.md"
  dedup_key: "eng-engine-methodology-.claude-workstream-programs-prog-launch.yaml-1-110"

- id: "WS-NEW-M"
  title: "Run the tests before the ledger gates — an untracked backtest file currently blocks 100% of local test signal and will black out CI the moment it is committed"
  type: bug
  priority_score: 30
  category: infrastructure
  program: infrastructure
  capability: core
  runs_on: any
  effort: S
  description: |
    ci.yml:27 runs check-label-ledger.sh BEFORE ci.yml:34 runs npm test; smart-test-runner.sh —
    CLAUDE.md's own documented pre-commit command — has the same ordering. Untracked
    scripts/backtest/ladder/rungs.card.js (19,333 B, 5 unledgered keyed-numeric constructs at
    :73/:89/:127/:173/:253/:349) blocks the local runner today, so the only way to get a test
    signal is npx vitest run — which the senior engineer did during this very run. CI is clean
    ONLY because the file is untracked. Committing it converts a local annoyance into a CI
    outage whose output is identical for "1 test broken" and "15,922 tests broken".
    A gate whose failure mode is "no information" rather than "specific information" trains its
    user to bypass it, which defeats its purpose over time.
  accept_criteria:
    - "Tests run before, or independently of, the governance ledger gates in both ci.yml and smart-test-runner.sh — a ledger failure never suppresses the test signal."
    - "A ledger-gate failure prints which construct in which file, not a bare non-zero exit."
    - "rungs.card.js is either ledgered or gitignored deliberately, with the choice recorded."
  files_involved:
    - ".github/workflows/ci.yml"
    - "scripts/smart-test-runner.sh"
    - "scripts/check-label-ledger.sh"
    - "scripts/backtest/ladder/rungs.card.js"
  dedup_key: "eng-engine-infrastructure-.github-workflows-ci.yml-21-34"

- id: "WS-NEW-N"
  title: "Settle whether the 14 npm advisories reach the browser bundle before deciding anything about a CI gate — one grep of dist/, 30 minutes"
  type: task
  priority_score: 22
  category: infrastructure
  program: security
  capability: core
  runs_on: any
  effort: S
  description: |
    npm audit --omit=dev on the main app returns 14 vulnerabilities (2 critical, 1 high, 11
    moderate): grpc-js, protobufjs, websocket-driver, opentelemetry — all transitive via firebase
    and posthog-js, all Node-only shapes. The security engineer stated plainly "I have not
    verified whether Vite tree-shakes these out of the shipped browser bundle" and recommended a
    CI gate anyway. Gating CI on advisories of unproven reachability in a no-server, single-user
    app is Failed State #3 (compliance over value) — but SKIPPING the question is not the
    alternative. Settle reachability, then the gate decision is trivial in either direction. The
    extension audits clean (0).
  accept_criteria:
    - "Reachability of each advisory's affected code in dist/ is determined by inspection of the built bundle and recorded."
    - "If any is reachable: an npm audit gate lands in ci.yml, scoped to production dependencies."
    - "If none is reachable: that is recorded on FIND-105 with the date and the bundle hash, and the gate is not added."
  files_involved:
    - "package.json"
    - ".github/workflows/ci.yml"
    - "dist/"
  dedup_key: "eng-engine-infrastructure-package.json-npm-audit-reachability"
```

### AMEND, do not duplicate

| Existing item | What this run adds |
|---|---|
| **WS-464** (reachability gate, backlog, M) | Extend from engine exports to **hook return values and cross-module helpers** — see WS-NEW-J. Three instances found this run. |
| **WS-468** (wall-clock truth on the phone, backlog L, unclaimed) | Already owns F10 in full: measure latency, bound it, wire `onFastResult`. **Add:** FIND-067's missing depth/confidence marker (an unvalidated number displayed without its status — `intention.md` P2/P3). **Do not file a new item.** |
| **WS-489** (interactive regions in real CSS px, backlog L, blocked_by WS-441) | Owns the *geometry* fix for F11. WS-NEW-I owns the *instrument and semantics* gap. Keep separate — a geometric fix passes CI with zero accessible names. |
| **WS-461** (SYSTEM_MODEL currency + doc-currency gate, backlog M) | Already owns F14. **Add** the corrections this run measured: 25 stores (not 23), DB v28 (not v13/v27), 14/22/73/23-29 for reducers/contexts/hooks/views, SYSTEM_MODEL.md:252's non-existent pre-op backup, and section 2.3 describing two-phase behaviour that does not run in production. |
| **WS-266** (`exportAllData` omits `anchorObservations`, backlog S) | **Absorbed into WS-NEW-D** — one store of a 22-store defect. Close as absorbed rather than working it. |
| **WS-515** (extension journal reports `success: true` on a quota throw, backlog, 55) | **The same defect shape as F1 on the other capture path.** Sequence with WS-NEW-A and WS-NEW-B — the fix is the same idea (a write that fails must be visible) and the error sink serves both. |
| **WS-439** (Next Hand CTA clipped, `deferred`, founder device-verified P0) | **Flag for the founder:** the primary control is unreachable in the most common state and the ticket is `deferred`. That is condition 3 of the 08-07 verdict, still unmet, and it is a device-verified P0 sitting in `deferred`. |
| **WS-479** (land or retire `integrate/orphans-20260807`, backlog L) | Related to the 19 unpushed commits; check whether it is now moot after the 08-16 landing. |

### Findings to retire or re-file by hand
(No ticket needed — cross-critic section 6: do not build a subsystem to retire a finding.)
- **FIND-098 — RETIRE.** Its cited assertion passes: I ran `gameTreeEvaluator.test.js` on HEAD
  `32d968a4`, 201/201, 2026-08-19. It has been suppressing `launch` and `security` health for 12 days.
- **FIND-099 — RETIRE the symptom, re-file the mechanism.** `origin/main` advanced 08-02 -> 08-16;
  the 82 commits landed. But 19 unpushed commits already recreate the drift, so the mechanism belongs
  to WS-NEW-C, not to a standing finding.
- **FIND-083 — RE-FILE the security half** under `program: security` (its own `:16` says so).

## (d) STRUCTURAL RECOMMENDATIONS

Where three or more findings cluster, fix the class.

### S1 — The finding-to-work-item link is broken, and it is the root cause of this run's redundancy (W1)
**Cluster:** every re-discovery in §4(b); the architect's "decision debt"; the cross-critic's
"roughly half the run's output re-confirms known open findings."
**Evidence:** fourteen findings filed 2026-08-07 with file-and-line evidence and a founder-blessed
gate spec; **zero work items reference any of them** twelve days later, while
`prog-launch.yaml:108-110` declares `accountability.on_finding: {action: create_work_item}`.
**Structural response:** a finding without a work item or an explicit `wont_fix` is an incomplete
record. Either the filing step creates the item, or a check reports findings older than N days with
no item. **Do not** build a re-verification subsystem to age findings out of the health score (the
architect proposed this; the cross-critic correctly called it Failed State #10 — three layers of
apparatus whose only consumer is a gate nothing reads). **Effort: S.** Highest leverage in this
document: it is why a sixth sweep would find the same things again.
**Test that it worked:** the next sweep's re-discovery rate is near zero because the findings were
converted, not re-found.

### S2 — Capability ships inert three times in one audit (W3)
**Cluster:** `lastSavedAt`, `onFastResult`, `getStoresAtVersion` — three experts, three finds, zero
recognition of the pattern; **plus** the compounding form, where a *test* of an inert capability was
cited as evidence the live path was safe.
**This is already a named founder failure mode** (`feedback_shipped_but_inert_capability`: "wire a
production caller in the same change and assert the paths diverge"). It recurring three times in one
audit is the finding, not the instances.
**Structural response:** WS-NEW-J / amend **WS-464** — the gate must flag any exported symbol or
hook return value whose only importers are test files. **Effort: M.** The three known instances are
the known-answer anchor: the gate is not working if it does not flag all three against current main.

### S3 — Silence is the product's dominant failure mode; give it one channel (W2)
**Cluster:** F1, F2, F3, F5, F6, F12 — six findings, all unbounded TTD, all from different lenses,
all downstream of the same fact: **there is no error sink in `src/`.**
**Structural response:** one on-device error channel (WS-NEW-B) that `logError` and the global
handlers feed, plus the F1 save indicator (WS-NEW-A) as its first consumer. This does not fix the
individual defects — it makes each of them *announce itself*, which is the difference between a
bounded and an unbounded cost. **Effort: M.** For a local-first single-user app with no telemetry,
this is the highest-value instrument that does not exist.

### S4 — Gates and instruments are scoped to where the defects are not (W6, W7)
**Cluster:** touch-floor measures one container and fixmes the mid-hand state (F11); the label-ledger
gate runs before the tests and blackens the whole signal (F13); `deploy.yml` runs no tests (F7);
`check-idb-additive.sh` guarantees no store is deleted and says nothing about field-level clobber
(F5); `smart-test-runner.sh` is documented as the pre-commit command and cannot currently run.
**The shared shape: the instrument's existence is read as coverage, in a doc, by every future
session.** `CLAUDE.md` says rendered-size enforcement lives in `touch-floor.spec.js`; `INV-PERSIST-2`
reads as "migrations are safe."
**Structural response, one rule:** **every gate states its own scope in its own file, and the doc
that cites it quotes that scope.** A gate that measures a subset says which subset, in code, next to
the assertion. Applied to `touch-floor.spec.js` (WS-NEW-I) and `check-idb-additive.sh`; and gates are
ordered so a governance failure can never suppress a correctness signal (WS-NEW-M). **Effort: S per
gate, ~M total.**

### S5 — Rank by time-to-detect x recoverability, permanently
**Cluster:** the entire re-ranking in §4(b). Sixty findings, all ranked by severity-if-it-fires, none
by how long it stays hidden or whether the lost thing comes back — for an app whose stated unit of
value is *"the specific hand that happened."*
**Structural response:** `time_to_detect` and `recoverability` become **required fields** on every
finding record filed against this repo, and the eng-engine brief template requires each persona to
supply them. **Effort: S.** This run needed a cross-critic to notice the axis; the next one should
not be able to omit it.

### S6 — Concurrency contaminated this run's own measurements
Six agents against one working tree: two builds into the same `dist/` (which destroyed the artifact
the performance engineer cited), a dev server, Playwright browsers, a 549s test run, and a file
swapped in and out of the tree mid-run. One expert then attributed a test timeout to "suite load"
(D9), which is indistinguishable from contention with five peers.
**Structural response:** measurement-producing personas either run serially or each build to a
private output directory, and any number a persona reports carries the conditions it was measured
under. **Effort: S** (an orchestration change, not code).

### S7 — Not one number in this run resolves to a Result Card
`CLAUDE.md`'s Standard of Record (ADR-009) binds *"a number someone could act on or cite."* This run
produced ~40 — 782 kB against a 500 kB budget, 15,922 tests, 549 s, 27.8x40.3 px, 480,651 ms, 14
advisories, 25-vs-23 stores — with zero replication manifests, zero `disclaimerRegisterVersion`
stamps, and at least one already unreproducible. Six experts were briefed on `improvement-default.md`
and none on the Standard of Record. **Structural response: the eng-engine brief cites ADR-009 and
`docs/standard-of-record/VOCABULARY.md`, and any comparative number in a phase-1 report carries its
conditions inline.** The rule already exists; the brief did not carry it. **Effort: S.**

### S8 — Nobody costed anything, and the brief made that legal
Six reports, zero hour estimates. `improvement-default.md`'s forced sequence step 2 requires it
("an unestimated cost is not a reason to defer; it is a reason to estimate"), while the brief said
"do NOT propose solutions in this phase." **The two instructions were never reconciled and the
weaker one won.** Fix the brief: *no solutions, but every named limitation carries a cost estimate.*
Every effort field in §4(c) is mine alone, unreviewed by the six lenses that saw the code.

## (e) THE SHARED BLIND SPOT — should the launch program exist?

Six experts spent ~90 KB arguing about whether the gate's arithmetic works, whether its blocking set
is populated, and whether `60` is on the right scale. **Not one asked what "launch" means for this
product.** They did not reach that branch because the brief — which I did not write, but which I am
the last person able to correct — had already chosen the other one. It quoted
`improvement-default.md` and then defined the limitation as the gate's *configuration*.

### The evidence, re-verified by me

- `system/intention.md` — the repo's constitution — contains **no occurrence of "launch"**, and no
  mention of users, distribution, pricing, or a second human being. Its Imagined Outcome names four
  ordered capabilities: trusted math -> player-interaction relations -> cueing -> manipulation.
  **None is a shipping event.**
- `system/intention.md:77` — OQ-001, verbatim:
  `| OQ-001 | _placeholder — example: "Who is the first user we're designing validation for?"_ | open | — |`
  **A refinement of the cross-critic, in the same direction:** this is not an open founder question,
  it is the **unedited template example**. The register of open questions was never populated. The
  question was never asked. That is worse, not better.
- `prog-launch.yaml:107` — `blocking_programs: []  # /adopt populates based on archetype`. **The
  program was not authored for this repo. It was installed by a template.**
- `prog-launch.yaml:4` — `lifecycle: temporary   # This program is removed after successful launch`,
  `created_at: "2026-05-01"`. **110 days temporary**, against an event with no date and no audience.
- `kit/scripts/cwos-pulse.js` contains **zero occurrences of "launch"**. There is no code that reads
  this gate and no event that it gates.

### My answer, stated as an answer

**The launch program as it stands has no referent, and I am not going to pretend the question is
about its arithmetic.** But per `.claude/rules/improvement-default.md`, removal is not mine to
recommend — accommodation and removal alike are the founder's call, presented as a question with its
cost stated. **The finding is that nobody surfaced the question.** Here it is, with costs.

**And to be explicit about the constraint I was given:** if the answer is "remove it," that is
removing a limitation — an aggregator with no referent, consuming sweeps and blocking nothing — not
descoping. If the answer is "rewrite it," Option 2 says into what. **What is not on the table is
doing less engineering.** WS-NEW-A through WS-NEW-I are unaffected by this decision and proceed
either way; they are worth doing because the founder uses this app at a table, not because a program
watches them.

**Option 1 — Name the audience and the date. Keep the program with a real contract.**
*Requires:* the founder answers OQ-001 with an actual first user and a date.
*Cost:* the GATE-SPEC's code work (`cwos-pulse` launch branch M, `prog-launch` rewrite S, sequenced
behind FIND-107's stamp/recompute fix S) **plus** the F18 scale correction, **plus** the downstream
consequences a real launch brings — a privacy posture for ethnicity/physical-description data about
other people, a Chrome Web Store listing that describes what the extension actually does, and the
extension's stealth design becoming someone else's account risk as well as the founder's.
*Honest read:* twelve days of the founder not building the blessed gate spec, and 110 days of a
"temporary" program, are **revealed priority**. This option is available and does not look chosen.

**Option 2 — Rewrite it into the gate this repo actually needs. My recommendation if it survives.**
Not "are we ready to launch" but **"is the instrument trustworthy?"** — which is a question
`intention.md` *does* ask, in P2 ("where the math is unvalidated, say so in the output") and in the
Imagined Outcome's ordering: trusted math comes **first**.
*Concretely:* rename to `trustworthy-instrument`, `lifecycle: permanent`, and set the blocking
contract to what this run actually found — **(a)** no hand can be silently lost (WS-NEW-A, B, C, E);
**(b)** every comparative number resolves to a Result Card (ADR-009, already binding, currently
unenforced — see S7); **(c)** the advice the founder acts on states its own depth and confidence
(FIND-067). That gate has a referent today, it would go **RED today for reasons that matter**, and it
would go green on work the founder wants done regardless of whether anyone else ever installs this.
*Cost:* the same code work as Option 1, minus the launch-specific ceremony, plus writing the contract.
*Why it is the improvement-default answer:* it removes the limitation (a gate with no referent) by
**pointing the machinery at the thing that does exist**, rather than by deleting the machinery or by
inventing an audience to justify it.

**Option 3 — Retire it. Route its findings to their owning programs.**
*Cost:* FIND-097/098/099/106 lose their home and must be re-homed to `infrastructure` and
`engineering`; the sweep cadence that produced this run's nine genuinely new findings goes away
**unless it is re-pointed** — and note carefully that this run's value came from **running the
product**, not from the launch frame, so the cadence is worth keeping under some program.
*Benefit:* five sweeps have fired against `prog-launch`; three produced literally zero findings; this
one consumed six expert dispatches. `prog-launch.yaml` declares `activation: ~5 min, ongoing:
periodic /pulse run launch`. **Nobody has ever compared the gate's running cost to its yield.**

**What I will not do:** pick for the founder, or resolve it by quietly leaving the program in place —
which is the accommodation that has already run for 110 days. **Filed as WS-NEW-L, `runs_on: phone`,
priority 58.** It is answerable from a pocket in one sentence, and until it is answered every future
launch sweep re-runs this same argument.

## (f) HONEST NOTE ON THIS RUN'S OWN VALIDITY

**The run is VALID as evidence, with H2 struck and a named contamination.** It is worth less than its
page count suggests, and here is exactly how much less.

**What is worth trusting.**
- The findings produced by the two personas whose **method forced them into the product** —
  failure-engineer (traced the call graph) and product-ux (ran the app, took screenshots, measured
  rendered `boundingBox()` values). **Every genuinely new finding in this run came from those two,
  plus the senior engineer's failing test.** They were also the two who dissented from the brief.
- H1's mechanism: confirmed by four experts with independent greps, plus the cross-critic with a
  different tool and a direct `kit/` grep. Not inheritance.
- F1: I re-derived it myself this session, and it is **stronger** than the failure-engineer stated —
  he did not establish that `usePersistence.js:211` is the *only* production save path; the
  cross-critic did, and I confirmed the `lastSavedAt` half independently.
- FIND-098's staleness: I ran the test. 201/201.

**What needs re-verification before anyone acts on it.**
- **Every number the brief supplied.** The orchestrator's brief carried **at least four wrong health
  figures** (`launch 1/8` vs the actual `2/5` at `prog-launch.yaml:154-155`; `domain-correctness
  2/10, 50 open` vs `ceiling 9, 44 open`; `data-provenance 4/8` and `design 3/8` vs `0/0`) and **no
  expert caught one** — the performance engineer read the exact line that contradicts the brief and
  quoted it without noticing. Treat the brief's table as **not a measurement**. Note the direction:
  the true number of programs at 0 is *higher* than the brief said, which strengthens H4 while
  proving the table was a summary rather than a reading. **U5 remains open: stamped and computed
  finding counts disagree across at least four programs, so every "health 0" argument in this run —
  including mine in §3.1 C2 — rests on numbers nobody validated.**
- **H2 support was brief-inheritance in three of four cases.** Only the architect reached the formula
  (`health-scoring.js:33/37/116`); the senior, performance and security engineers each inferred the
  0-10 scale from observed score samples — **the same weak check three times, not three checks.** The
  security engineer said so himself. And all four missed that H1 voids H2, *which is the signature of
  checking a claim rather than deriving one.* **H2 is struck.**
- **Every measured number in the performance report.** The run was its own confounder (S6, D9): the
  bundle artifact it cites was overwritten mid-run by a peer and no longer exists, and one finding
  reports two different totals for the same quantity in a single section. The **sizes** reproduce; the
  **artifact references and the timeout diagnosis** do not.
- **The security engineer's "I re-verified all six."** His own table says four of six were *"not
  re-diffed"* — verified by absence of a fix commit, which is materially weaker than reading the file.
  His FIND-100 and FIND-105 checks are real and were confirmed by the cross-critic.
- **The architect's store count (23) and his `protocol_history` claim.** Both wrong; both taken from
  a source he was condemning as stale in the same sentence, in a report that opened *"I re-verified it
  against current state rather than relaying it."* 25 stores is correct.

**Pre-registration scoring, recorded unhedged.** P1 SUPPORTED **and vacuous** (it predicts the
behaviour of a comparison that does not execute). **P2 REFUTED by its own pre-registered falsifier** —
two experts found three product-grounded blockers that would have produced NOT READY under a
correctly wired gate. **P3 SUPPORTED, instrument invalid** — the falsifier ("product-ux finds a core
flow broken end-to-end") could not have detected the defect that actually bounds H3, because on a
working app the save succeeds. **P4 REFUTED**, and its premise with it. **P5 REFUTED** — the
load-bearing finding came from the failure-engineer, not security. **P6's invalidation threshold did
not fire**, but its *distinguishing* test did, on H2.

**The one change that would most improve the next brief: supply no numbers and no line references.**
Every figure this brief handed over was either uncontested — and three of four inheritors never left
it — or wrong, and nobody caught it. Second change: name the Standard of Record and require a cost
estimate per limitation (S7, S8).

**And the finding that outranks all of the above, because it explains the redundancy:** roughly half
this run's output re-confirms findings filed twelve days ago that **have no work items**. The
instrument is not failing to find things. **It is failing to convert them.** That is S1, and it is
the first thing to fix.

---
*Facilitator: roundtable-facilitator. Cross-critic corrections treated as binding; none disproved.
Independent verifications this session are listed at the head of Phase 3. Numbers in this document
that came from the brief rather than from a file I opened are flagged in §4(f) and should not be
cited without re-measurement (ADR-009).*
