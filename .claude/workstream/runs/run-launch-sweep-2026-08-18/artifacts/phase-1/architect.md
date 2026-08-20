### SYSTEMS ARCHITECT

All file:line citations below were opened this session. Where a claim reproduces a prior
finding (FIND-097..110, FIND-LA-001), I re-verified it against current state rather than
relaying it -- divergences from the prior finding are called out explicitly.

#### Key Concerns (top 5)

1. **The launch gate is arithmetically incapable of ever passing -- confirmed by formula, not inference.**
   `prog-launch.yaml:106` sets `required_program_health: 60`. `kit/scripts/core/health-scoring.js:33`
   (`RIGOR_CEILING`) caps every program's ceiling at `10`; line 37 (`TARGET_CEILING`) confirms
   `critical: 10` is the maximum tier target; line 116 (`score = Math.min(earnedScore, ceiling)`)
   enforces that cap. No program can score above 10 under this formula. `60` was never reachable --
   not "hard to reach," structurally unreachable, since the day the file was created
   (`prog-launch.yaml:209`, `created_at: "2026-05-01"`). This is an exact 6x scale mismatch, not a
   rounding or calibration issue.

2. **The gate has zero code readers -- confirmed by exhaustive grep, not by trusting the prior finding.**
   `grep -r "required_program_health|blocking_programs" kit/scripts/` returns zero matches anywhere
   in the codebase. The only files in the whole repo referencing these fields are
   `prog-launch.yaml` itself, this run's `BRIEF.md`, `FIND-106.yaml`, and the evidence doc that
   filed it. `blocking_programs: []` (`prog-launch.yaml:107`) has been empty since baseline. Every
   "NOT READY" verdict in `protocol_history` (`prog-launch.yaml:165-196`) is stamped
   "Inline meta-aggregation, no new findings", against the fed_by list
   (`prog-launch.yaml:129`), never a contract evaluation, because no contract exists to evaluate.

3. **A founder-ratified fix has sat unimplemented for 11 days across unrelated feature work.**
   `.claude/workstream/evidence/run-launch-sweep-2026-08-07.md:57-67` records a "GATE-SPEC" --
   blocking-set proposal, pass condition, and code work -- explicitly "BLESSED with two facilitator
   amendments." `git log --oneline -15` from current HEAD (`32d968a4`, 2026-08-18) shows the 15 most
   recent commits are all `villain-archetype` feature work; none touch `prog-launch.yaml` blocking_programs
   field or add a launch-branch to `cwos-pulse.js`. The decision was made and
   not executed -- this is a decision-debt pattern, not a missing-decision pattern.

4. **Backup/restore covers 3 of 23 IndexedDB stores, and the exact fix already exists unused in the codebase.**
   `src/utils/exportUtils.js:32-54` (`exportAllData`) fetches only `hands`, `sessions`, `players`
   via `getAllHands`/`getAllSessions`/`getAllPlayers` (imports at lines 8-19 -- no others). Line 22:
   `const EXPORT_VERSION = '1.2.0'; // Aligns with IndexedDB v12 schema` -- against an actual
   `DB_VERSION = 28` (`src/utils/persistence/database.js:50`, confirmed by direct read). Sixteen
   schema versions of accretion (23 stores per `.claude/context/SYSTEM_MODEL.md:501`) were never
   folded into backup. The fix is not hypothetical: `src/utils/persistence/migrationRegistry.js:504`
   exports `getStoresAtVersion(version)` for exactly this enumeration, and `exportUtils.js` does not
   import `migrationRegistry` at all. `clearAllData` (`exportUtils.js:159-182`, the function
   FIND-100 cites as the account-deletion purge path) has the identical 3-of-23 gap for the same
   reason. Per `improvement-default.md`: this is a defect to remove (a one-file import plus
   enumeration change), not a scope to plan around.

5. **Open findings suppress program health scores with no re-verification step -- and I caught one that is already stale.**
   `health-scoring.js:86-88` computes `findingPenalty` directly from `countOpenFindings` (open,
   unverified findings). `FIND-098` (`findings-index.yaml:708-715`, title about the live production
   build carrying a failed exploit-engine EV assertion, `severity: critical`,
   `status: open`, filed 2026-08-07) cites `gameTreeEvaluator.test.js`. I independently ran that
   exact file against current HEAD (`32d968a4`): 201/201 tests pass, exit code 0 (dispatched
   run, not a relayed claim). `git log --oneline --since=2026-08-07 -- src/utils/exploitEngine/gameTreeEvaluator.js`
   shows 8 fix/feat commits landed on that file since the finding was filed. FIND-098 is still open
   and still counted in the health-penalty formula for both `launch` and `security`. This is not
   "the finding was wrong" -- it is "nothing in the architecture re-checks an open finding against
   current state," so the health number is contaminated by unknown-currency findings by construction.

#### Hidden Risks

- **The "0 = unmeasured" reading fails on `security` specifically, and this generalizes.**
  `prog-security.yaml:79` (`tier: dormant`), lines 163-168 (`last_run_by_protocol` -- every protocol
  `date: null`), and line 170 (`health_score: 0`) all support "never run its own protocol." But line
  173 shows `findings_open: 6`, and `findings-index.yaml:726-778` (FIND-100..105) shows those 6 are
  real, filed by a different program (`launch`) sweep on 08-07, at severities
  CRITICAL/CRITICAL/HIGH/HIGH/MEDIUM/MEDIUM, `program: security`, all still `status: open`. A `0` for
  `security` is doing two jobs at once -- "own protocol never ran" (true) and "independently known to
  carry 2 open CRITICALs" (also true) -- and an aggregate that treats every `0` identically (per H4
  framing) would flatten those into the same signal as a program with genuinely zero information
  (e.g. `guide-authority`, `claims-policy`).
- **Additive-only migrations are being read as "migrations are safe" when they only guarantee one thing.**
  `INV-PERSIST-2` (`system/invariants.md:85`) -- enforced by CI gate `scripts/check-idb-additive.sh`
  -- forbids `deleteObjectStore`/`deleteIndex`, which prevents structural data loss (a store
  disappearing). It does not address transactional data loss during a migration. I re-verified
  TD-19 directly: `src/utils/persistence/migrations.js:400-402` and `:431-433` still log via
  `logError` in cursor `.onerror` handlers with no explicit `tx.abort()` call. Combined with finding
  #4 above (backup covers 3 of 23 stores, no rollback path exists -- `grep -rn "rollback|migrateDown"`
  in `src/utils/persistence/` matches only a test file), a mid-migration cursor failure has no
  forward fix and no working backup to fall back to. For a local-first app, this is the actual
  analogue of "data loss on server restart" the brief names, and it is compounded, not singular.
- **The backup gap grows monotonically with feature velocity and nothing detects it.**
  At least 12 architectural surfaces were added to `persistence/` since April per the tech-debt
  register (`SYSTEM_MODEL.md` TD-15 through TD-24) -- each is a candidate new IndexedDB store. No
  test asserts "every store in `MIGRATION_REGISTRY` has a backup-export counterpart." The gap found
  in concern #4 is not a one-time miss; it is undetectable by the current test suite and will widen
  on every future store addition unless the export path is rebuilt to derive its store list from
  `migrationRegistry.js` rather than hand-enumerate it.
- **Deploy-freshness is fixed; the thing it protects against is not.** `scripts/check-deploy-freshness.mjs`
  (invariant `INV-DEPLOY-FRESHNESS-1`, `system/invariants.md:179`, added 2026-08-13) currently
  reports green -- I ran it directly: 19 commits not on origin/main, oldest 2.1 days old
  (warn threshold 3 days, red threshold 7 days). So FIND-099 specific staleness symptom ("main frozen
  5 days") is resolved. But `deploy.yml:1-67` (re-read this session) still has no test step and no
  `workflow_run`/`needs` edge to `ci.yml` -- confirmed by direct read, both workflows trigger on
  identical `push: [main]` with no cross-reference. Freshness now means a red commit would ship
  faster, not that it cannot ship.

#### Likely Missing Elements

- A `cwos-pulse` launch branch that actually reads `blocking_programs` plus `findings-index.yaml`
  and computes a pass/fail against a same-scale threshold. Currently absent (confirmed by the grep
  in Key Concern #2); this is exactly what the 08-07 GATE-SPEC scoped and nobody has built.
- Any mechanism to re-verify an open finding against current code state before it continues to
  penalize health scores (Key Concern #5). Today "open" only ever transitions by hand.
  `findings-index.yaml` has no `last_verified_at` or equivalent field on any entry read this session.
  Not present.
- A store-manifest-driven backup/export/purge path. `getStoresAtVersion()`
  (`migrationRegistry.js:504`) exists as a building block; nothing calls it from `exportUtils.js`
  or from the account-deletion path.
- Enforcement (not just documentation) for `INV-14` (`system/invariants.md:38`) -- its "how to check"
  column reads "Manual code review + future ESLint rule (RT-103)" -- the rule was proposed
  2026-04-20, is marked VIOLATED, and the enforcement mechanism is still "None (structural)" four
  months later.

#### Dangerous Assumptions

- **That the launch gate contract text was ever operative.** `prog-launch.yaml:7-12` states this
  program is "the single source of truth for are we ready to launch." That sentence has been false
  since the file creation date -- not degraded over time, never true. Every prior "correct verdict"
  was correct by manual judgment coinciding with the right answer, not by the mechanism the file
  describes itself as being.
- **That additive-only migrations make the schema safe.** They remove one failure mode (deleted
  stores) and leave another open (partial-write on cursor error, TD-19, confirmed still present).
  Treating "additive-only" as "migration-safe" is a category error a founder reading `INV-PERSIST-2`
  in isolation could easily make.
- **That "not ready to launch" and "not usable today" are the same claim (H3 premise).**
  Structurally they look separable from where I sit: the CRITICAL-finding cluster (deploy gating,
  account deletion, backup/restore, the gate itself) touches `exportUtils.js`, `AuthContext.jsx`,
  `.github/workflows/deploy.yml`, and `prog-launch.yaml` -- files with no import-graph overlap with
  the core hand-tracking/exploit-engine loop, whose own test suite I ran directly and found green
  (201/201, `gameTreeEvaluator.test.js`, current HEAD). But "separable in the dependency graph" is
  not the same claim as "verified usable end-to-end" -- that requires a Core-User-Flows walkthrough
  I did not perform (product/UX lens, not architecture). I can support only the structural half of H3.

#### Verdict on H1-H4

- **H1 (self-perpetuating NOT-READY artifact): SUPPORT.** Confirmed by exhaustive grep (zero code
  readers of `blocking_programs`/`required_program_health` anywhere in the repo outside the program
  file, the brief, and the finding that already caught this) and by the `protocol_history` entries
  themselves, all stamped "Inline meta-aggregation, no new findings" against an empty blocking set.
  Not new -- FIND-106 found this on 2026-08-07 -- but it remains true today, 11 days and roughly 15
  unrelated commits later, which is itself evidence of the self-perpetuation: the finding closing
  the loop was filed and then not acted on.
- **H2 (0-10 vs 60 scale mismatch): SUPPORT, arithmetically exact.** `health-scoring.js:33,37,116`
  bound every possible score at 10; `required_program_health: 60` cannot be met by construction.
  This is not a judgment call -- the bound was derived directly from the formula rather than
  accepted from the brief framing.
- **H3 (shippable subset exists): PARTIAL SUPPORT, lens-limited.** The CRITICAL-findings cluster is
  structurally separable (different files, no shared call path) from the core engine, and the core
  engine own tests are currently green under independent verification. Core-flow-level correctness
  is outside this lens and was not checked here.
- **H4 (health=0 conflates never-run with broken): SUPPORT the general claim, REFUTE the
  safe-to-ignore corollary.** Most 0-health programs are genuinely never-run (confirmed for
  `security`: `last_run_by_protocol` all-null). But `security` 0 sits alongside 6 real open
  findings -- 2 CRITICAL -- filed by a different program sweep. Treating every 0 as equivalently
  ignorable would bury the single worst case (known-critical-and-never-self-measured) under the
  same numeral as the null case (nothing known at all).
