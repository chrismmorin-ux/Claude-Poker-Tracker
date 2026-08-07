# launch/sweep — run evidence (2026-08-07, end of overnight autonomous run)

Engine: eng-engine (6 personas → orchestrator cross-critique → roundtable-facilitator with
independent verification). Orchestrator: ses-20260807-0535-df53cf18. Production = main@86c0e387
(2026-08-02); dev = ws-292-holding-knowledge @ 18f49f22 (82 commits ahead). Findings filed as
FIND-097..110.

## Facilitator verification verdicts
- **Deploy ungated — CONFIRMED, WORSE:** deploy.yml never runs the test suite at all (only
  check-untracked-imports preflight); zero workflow_run/needs edges anywhere in .github/;
  visual-regression is continue-on-error by design. Nothing can fail a deploy except a build
  error or version-stamp mismatch. Production version.json = 86c0e387 — the exact commit whose
  CI run failed at gameTreeEvaluator.test.js:441 (an EV-correctness assertion).
- **deleteAccount no purge — CONFIRMED, STRONGER:** AuthContext.jsx:276-304 calls deleteUser
  only; clearAllData has zero non-test callers outside exportUtils.js:205 (import replace-mode).
  NO user-invocable purge path exists in the product. The "Account deleted" toast is misleading.
- Backup v12-vs-v28 CONFIRMED; guest auto-merge CONFIRMED (GuestDataMerge is headless by its own
  docblock, return null, no consent path); launch gate CONFIRMED unread by any code in kit/scripts.
- **ORCHESTRATOR DEDUP ERROR CORRECTED:** device-identity contradiction (A22 vs S22 vs Helio G80)
  is NOT covered by re-filed WS-441 (44px floor) — it needed its own finding (FIND-109). Also the
  wall-clock-shallower-answer behavior is related to but not owned by FIND-074/075.
- **ORCHESTRATOR SEED REFUTED (from the senior lens, upheld):** the "10 environmental
  sessionRecoveryLiveness failures" label — propagated through every overnight item brief — is
  wrong; they are deterministic kit regressions (reason-string drift, assumeLocal:true,
  pid_recorded_at never implemented). Probable cause of the session-recovery --auto hang at
  session start.

## VERDICT — NOT READY (confirmed, for sharper reasons)
Plain language: the tests do not stop a broken build from going live — the deploy workflow never
runs them, and the live production build failed its own exploit-engine EV test. The site is five
days stale with 82 commits (including the founder's own scroll fix) unmerged. Deleting an account
deletes nothing locally — every hand, physical description, and photo stays, and no purge path
exists. Backup captures 3 stores of ~25 and reports success.
**Three conditions to flip the verdict:** (1) deploy gated on green CI with the EV assertion
actually fixed; (2) honest data handling — deletion purges, backup covers everything; (3) main
carrying the real work — the 82 commits landed through the gate, and WS-439/440/441 fixed and
walked on the actual phone.

## Findings index (FIND-097..110)
| ID | Facil# | Sev | Program | Subject |
|----|--------|-----|---------|---------|
| FIND-097 | F1 | CRITICAL | launch | Deploy path never runs tests; no CI edge |
| FIND-098 | F2 | CRITICAL | launch | Failing EV assertion is the live production build |
| FIND-099 | F3 | CRITICAL | launch | main frozen red 5 days; 82 commits unmerged; no PRs |
| FIND-100 | F4 | CRITICAL | security | Account deletion purges nothing; no purge path exists |
| FIND-101 | F5 | CRITICAL | security | Backup = 3 stores at v12 schema vs v28 DB; restore reports success |
| FIND-102 | F6 | HIGH | security | Guest data auto-merges headlessly into any signing-in account |
| FIND-103 | F7 | HIGH | security | clearAllData non-atomic — and it precedes every restore |
| FIND-104 | F8 | MEDIUM | security | Quota console-only; v3-v23 cursor migrations untested; seed inside upgrade tx |
| FIND-105 | F9 | MEDIUM | security | No CSP; extension ships localhost permission + non-descriptive store identity (x-ref FIND-083) |
| FIND-106 | F10 | HIGH | launch | Gate unenforceable in code; fed_by names non-existent programs (supersedes FIND-LA-001) |
| FIND-107 | F11 | MEDIUM | engineering | Protocol stamping and health scoring decoupled — prerequisite for any gate |
| FIND-108 | F12 | HIGH | engineering | Session-recovery failures are deterministic regressions mislabeled environmental |
| FIND-109 | F13 | HIGH | engineering | Target device unresolved (A22/S22/Helio G80); zero mobile latency measurements (x-ref WS-364/334/441) |
| FIND-110 | F14 | MEDIUM | engineering | No bundle instrument; 750KB warning unrecorded; state.md/CLAUDE.md drift (engineering row, IDB v13-vs-28) |

## GATE-SPEC (founder decision package — architect proposal BLESSED with two facilitator amendments)
Blocking set: domain-correctness (ADD), methodology-integrity (ADD), data-quality (keep),
engineering (keep), **security (keep BLOCKING — facilitator overruled the advisory downgrade:
dormancy is the defect, not an exemption; two verified criticals belong to it)**, launch
(self-clause). Advisory: infrastructure. Removed: compliance, financial-accuracy (never
installable). Renamed: ux → design.
Pass condition: every blocking program health >= 60 AND zero open CRITICAL findings in blocking
programs AND zero open HIGH findings on the gate's explicit blocking_findings list.
Code work: cwos-pulse launch branch reading blocking_programs + findings-index (M); stamp-write
recomputes health in the same pass (S — PREREQUISITE, else the gate reports stale numbers);
prog-launch.yaml fed_by/blocking_programs rewrite (S). Sequence the recompute fix FIRST.

## Trend result (stamped)
This sweep converted the launch verdict from an aggregate-health abstraction into fourteen
findings with file-and-line evidence; verdict remains NOT READY. Both headline claims were
independently verified rather than relayed (deploy never runs tests; no local purge path exists).
The gate is doubly dead (empty array + zero code readers). Two prior labels were corrected:
session-recovery failures are kit regressions, not environmental; and the device-identity
contradiction was unowned by any ticket. The blocking-set proposal is blessed with security kept
blocking and a blocking-findings clause added, sequenced behind the stamp/score recompute fix.
Highest-value next work: release gating (FIND-097..099) and the two data-safety criticals
(FIND-100, FIND-101).
