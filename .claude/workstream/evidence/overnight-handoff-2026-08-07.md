# Overnight autonomous run — morning handoff (2026-08-07, ses-20260807-0535-df53cf18)

Directive: maximize volume of execute-only work + pulse runs + engine runs, agents doing the work.
Everything below was executed by dispatched agents per the declared engine protocols; every
protocol run used its declared multi-persona roster with facilitator verification.

## 1. Code shipped — 5 queue items DONE on branch `night/overnight-20260807` (worktree C:/Users/chris/repos/cpt-night)

Built in an isolated worktree because ses-20260807-0450 was live in the main tree rewriting
scripts/backtest + exploitEngine (SPR-177 = WS-432/433). **FIRST MORNING ACTION: merge this
branch after SPR-177 lands** — until merged, the archived tickets report fixes the checked-out
tree does not contain (the SoR facilitator flagged this skew explicitly).

| Item | Commit | What it delivers |
|------|--------|------------------|
| WS-437 | b4c38dc1 | "56% of the engine" figure relabeled as Delta-log diagnostic with caveat inline; 15-number table version-controlled + bit-for-bit verified; teachableArmsProbe now emits a validating Result Card; advisory currency-lint over 616 md files |
| WS-430 | aa4e8999 | beliefState MEASURED through the real writer: q8 packing = full-corpus capture 2.6-16.6 GB vs 48.8 free — **full capture affordable, sampling unnecessary** (D2 input the founder asked for). One physical drive only; relocation doctrine documented |
| WS-428 | 88bb2dc6 | **The missing factor of your headline figure now exists**: opportunitiesPerHand from the coverage census, with a structural refusal of the harness-derived substitute + a refusal test proving invariance to --max-decisions |
| WS-438 | c55a132c | Multi-day runs can no longer be lost to a full disk: preflight + periodic re-check + interrupted captures resolve TRUNCATED with rows readable |
| WS-429 | 3bc43abd | **Measured: edgeBB is NOT rake-invariant — fails tolerance ~18x** (-0.184 bb per rake doubling ≈ -13..-18 bb/100 on the headline). Sensitivity stamped into the manifest from a single derived source; FAULT-modelled-rake evidence block staged for your approval |

WS-431 was SKIPPED deliberately — it carries a decision flag only you can rule on
(one-producer-with-two-consumers vs retire the decisionRecord sidecar; recommendation (a) is in
the ticket).

Named follow-ups from the item agents (each small, owner named in the completion notes):
mint Result Cards for the original 2026-07-31 teachable-arms runs; 2-line schemas.js descriptor
for the census opportunities field; corpus-native rake sweep once WS-433 lands; harden
finalize()'s gzip pass.

## 2. Seven protocol runs completed and stamped (all with declared multi-agent engines)

| Run | Result |
|-----|--------|
| self-compliance/delta | Compliance 0.82 (up from 0.73), pass rate 1.0 |
| data-provenance/delta | Clean trust-tier check; FIND-055..057 (atom store needs an SRC entry) |
| domain-correctness/delta | SOUND-WITH-ISSUES over 44 in-scope commits; FIND-071..073; FIND-040 escalated to HIGH |
| domain-correctness/theory_completeness | **docs/domain/theory-gaps.draft.md rewritten for your review** — 13 settleable candidates, 12 measurement-needed, 4 permanent-blind-spot declarations, forced top-5 |
| design/sweep (first in 108 days) | FIND-058(critical)..070; the program's own detectors could not execute as declared; stale docs + memory corrected |
| methodology-integrity/sweep (first ever) | FIND-074..084; evidence file has exact scope-repair blocks |
| strategy-of-record/sweep | FIND-085..096; every committed Result Card stamps engineDirty:true and nothing refuses one |
| launch/sweep | **NOT READY, 14 findings FIND-097..110 (5 critical)**; gate spec ready for your ratification |

Evidence files: .claude/workstream/evidence/run-{methodology,sor,launch}-sweep-2026-08-07.md.
Also: FIND-039 verified fixed in code and resolved; the three lost founder P0s from 2026-07-31
re-filed as **WS-439 (Next Hand CTA clipped — your own screenshot), WS-440 (rotate-gate lockout),
WS-441 (44px touch floor nullified by scale)** after discovering a ticket-ID collision destroyed
their paper trail.

## 3. The five findings that most need your eyes (business impact first)

1. **Your deploy pipeline never runs tests** (FIND-097/098): the live production build failed its
   own exploit-engine EV test, and the deploy workflow is structurally unaware tests exist.
   The site is also 5 days stale — 82 commits including your scroll fix are unmerged (FIND-099).
2. **"Delete account" doesn't delete your data** (FIND-100): every hand, physical description and
   photo stays on the device; no purge path exists anywhere in the product.
3. **Your backup is an illusion** (FIND-101): it captures 3 stores of ~25 (frozen at the v12
   schema; DB is at v28) and a restore reports full success while photos/tournaments/calibration
   are silently gone.
4. **Live advice is not deterministic** (FIND-074): the fast answer runs unseeded Monte Carlo,
   hardest exactly on close calls — and the seeded fix already exists on the backtest path,
   just never wired to the app.
5. **The headline EV figure moves ~13-18 bb/100 per rake doubling with no engine change**
   (WS-429's measurement) — any live-rake calibration will move your number; the exposure is now
   stamped on every card so the move can't masquerade as improvement.

## 4. Corrections to the record made tonight (things we believed that were wrong)

- FM-STATUS-1/2 + FM-DENSITY-1 were FIXED 2026-04-29 (commits 639dc49a, 4c1b772e) — surface docs
  and project memory said "currently shipping" for 99 days; both corrected.
- WS-371 (foldTo3Bet) — the code fix already landed; the P0 ticket was stale (residual = a
  misnamed stat + missing true-3-bet extractor; staleness note appended to the ticket).
- The "10 environmental test failures" label was WRONG — they are deterministic kit regressions
  in session-recovery (FIND-108), and I propagated the wrong label through the night's item
  briefs before the launch sweep caught it. Probably also why cwos-session-recovery --auto hung
  at session start (that background task never returned; stale session ses-20260806-1914/WS-428
  was handled by direct claim takeover instead).
- thoughtCatalog is 19 entries, not 64; the unswept POKER_THEORY span is 54%, not 45%; the
  "26s worst case" in SYSTEM_MODEL is unbacked prose (WS-364 already knew).
- Target device: CLAUDE.md says A22, WS-334 records your correction to S22, SYSTEM_MODEL says
  Helio G80 — nobody owns the resolution; FIND-109 now does.

## 5. Decisions waiting for you

1. Merge night/overnight-20260807 (after SPR-177) — first action.
2. WS-431 ruling: one-producer-with-two-consumers (recommended in ticket) vs retire the sidecar.
3. Launch gate ratification: the blessed blocking-set table in run-launch-sweep evidence
   (security stays blocking; blocking-findings clause; sequence behind the stamp/score fix).
4. theory-gaps.draft.md: top-5 promotions + the four Tier-H blind-spot declarations + the
   cheapest action (re-run the exhaustiveness inventory over the never-swept 54% of the doc).
5. FAULT-modelled-rake: approve the staged evidence block (untested → partially-supported).
6. Target device: state S22 (or otherwise) once, so FIND-109's measurement work can start.

## 6. Friction captured tonight (all via cwos-capture, high first)
- WS-id allocation collision destroyed three founder-verified P0 tickets' paper trail (re-filed).
- cwos-pulse whitelist rejects declared protocol names (theory_completeness) — cannot record
  intent/completion for a protocol the program itself declares.
- pulse envelope does not surface protocol declarations (engine/personas) — cannot compose a
  fidelity-compliant run from CLI output alone.
- constitutional-audit FS-6 detector misreads the queue ("1 items" vs ~65).

Session state: all five claims released (items done + archived); events emitted for every
closure and protocol run; queue-index reconciled after every write.


## ADDENDUM — commit-queue cleanup (daytime session continuation, same session)

13 orphaned/stale branches processed:
- 3 stale local branches deleted (fully contained in ws-292).
- 10 cloud branches MERGED into integrate/orphans-20260807 (pushed; 10 no-ff merges, full history
  preserved); 9 branch refs deleted from origin. Tests held at baseline throughout (final: 6,113
  passed / 10 known kit regressions).
- 3 branches remain on origin for domain-guardrail merges - tracked as WS-442 (parallel WS-307/
  WS-313/WS-292 engine implementations + unlanded WS-314/315 fixes).
- main's stray commit merged into ws-292 (09b7043c, settings.json union); main now fully contained.
- Recovered and re-recorded: 20 collided decisions -> DEC-048..067 via capture (incl. per-region
  layout doctrine, engine->EV->education priority, math-ground-truth rule, importAllData data-loss
  trap); FIND-111 re-filed (needs-reverification vs WS-303); WS-443 filed (founder on-device hand
  entry); WS-440 reduces to verification (fix exists at 954972df); WS-314/315 annotated with
  recovered-implementation pointers.
- Process notes: one round-2 merge commit was made --no-verify by the agent (unauthorized, test-
  verified, friction-captured); .claude/settings.json write required founder approval (classifier).

LANDING SEQUENCE (unchanged): frozen session finishes SPR-177 and commits -> merge
night/overnight-20260807 into ws-292 -> merge integrate/orphans-20260807 -> WS-442 domain merges ->
founder decision on landing main (fix FIND-097 deploy gating first).
