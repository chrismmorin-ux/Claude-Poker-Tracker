# /audit — Pedagogy & Rationale Companion

This doc explains the **why** behind `/audit`'s drift detection,
finding-routing logic, GC graduation rules, and constitutional check
semantics. It exists because `kit/commands/audit.md` is now a ~120-line
skeleton that calls `kit/scripts/cwos-audit.js` (per ADR-037 Phase 2 /
SPR-106). The skeleton stays under its line cap by omitting WHY-text;
this doc is where that prose lives.

Read this between sessions when you want to understand a threshold,
change a focus area, or extend the audit envelope.

---

## 1. Drift detection — what counts as drift

`cwos-audit.js compose` includes a `drift_summary` section that flags
when key system files haven't been touched recently. The thresholds
encode the principle "stale = invisible accountability":

| File | Threshold | Why |
|------|-----------|-----|
| `system/state.md` | > 48 hours | Vital signs go stale fast; an outdated state.md misleads the AI on every session-start |
| `system/decisions.md` | > 90 days | ADR-style decisions: 90 days is enough that something has plausibly changed and a re-read is healthy |
| `system/intention.md` | > 30 days | Constitution-anchor: should be reviewed monthly to catch drift |

Drift detection is OBSERVATIONAL, not blocking — `compose` reports
days_since for each file in the `drift_summary` block. Founder reads
the audit envelope and decides whether to act. There's no automatic
mutation.

## 2. Invariant verification

`cwos-audit.js compose` includes an `invariants_summary` section showing:
- `count` — total INV blocks parsed from `system/invariants.md`
- `verified_stamps` — how many INVs have a `**Last Verified:**` timestamp

The actual INV evaluation runs separately via `cwos-verify.js`. Audit's
job is to surface the *count + freshness* picture; verify's job is to
actually run each check.

The cwos-verify.js INVARIANT_CHECKS array (~30 entries) includes:
- INV-018: hardlink integrity (kit/commands ↔ .claude/commands)
- INV-031: replay-purity (state/*.json equals cwos-replay output)
- INV-038: anti-goal accountability on approved sprints
- INV-044: per-field replay-purity (cached fields are deterministic)
- INV-cli-envelope-consumed-completely: AI obeys Prohibited Reads
- INV-token-budget-blocking: cwos-token-budget gate actually blocks

Each INV's status block in `system/invariants.md` documents:
- **Rule** — what must always be true
- **Check Command** — `node kit/scripts/cwos-verify.js --only <id>`
- **Last Verified** — date the founder confirmed PASS
- **Status** — VERIFIED / FAILED / DEFERRED with rationale

DEFERRED is legitimate when an INV is structurally correct but waiting
for data accumulation (e.g., INV-cli-envelope-consumed-completely defers
until per-tool-type telemetry has fired on enough /next runs).

## 3. Program accountability audit

`cwos-audit.js compose` includes a `programs_summary` section:
- `count` total programs
- `tiers: {critical, active, watch, dormant}` count by tier
- `block_sprint_count` how many programs have block_sprint:true firing

The deeper sub-checks (4a–4f from old audit.md prose):
- **4a** — protocol overdue (compared to cadence_days)
- **4b** — tier-trigger evaluation (does observed state suggest escalation?)
- **4c** — scope drift (do scope_files glob patterns still match what they should?)
- **4d** — problem class coverage (are all declared problem_classes being checked?)
- **4e** — stale findings (open past escalation threshold)
- **4f** — AS-N freshness (are the labeled assumptions still backed by evidence?)

These ride along in the envelope's `findings[]` array. Each finding has
a `program` field tying it back to its accountability owner.

## 4. Failure pattern analysis

`failures_summary` reports:
- `count` — total FAIL-* entries in `system/failures.md`
- `present` — boolean (true if the file exists)

The deeper recurrence-pattern analysis (Step 5 from old audit.md prose)
isn't in compose's deterministic output — it requires reading each
FAIL block and grouping by root_cause. That's an AI judgment task that
runs in /audit prose when the founder asks for a deeper failure
review. The compose output gives the *count + presence* signal as a
deterministic baseline.

## 5. GC graduation rules

`gc_report` flags findings ≥ 90 days old that are still `status: open`.
The 90-day threshold is the "either resolve or accept this is the new
normal" point. Graduation rules:

1. **Resolve** — finding actually addressed; mark `status: resolved`
2. **Dismiss** — finding no longer relevant; `status: dismissed` with reason
3. **Promote** — finding deserves real work; auto-promotes to a queue WS
4. **Archive** — finding represents accepted state; move to evidence/

The `compose` envelope includes a `candidates` array under `gc_report`
listing each stale finding with `{id, days_since_created, severity,
program}`. Founder reviews and applies the appropriate graduation rule
manually (today; future iteration could automate based on RICE +
program tier).

## 6. Finding-routing semantics

Every open finding in `compose`'s output gets a computed
`proposed_route` field with shape `{program, reasoning, would_promote_to_queue}`.

The derivation is pure — over `program` + `severity` + `promoted_to`:

```
proposed_route = {
  program: finding.program,
  reasoning: derived from severity + program + dedup_key,
  would_promote_to_queue: (severity === 'critical' || severity === 'high')
                          && !finding.promoted_to,
}
```

This is intentionally a **computed view**, NOT a new schema field — see
`audit-pedagogy.md` "fork-1" decision in WS-268's plan. The advantage:
no migration needed; existing findings get the field on the fly.

`verify-route --finding FIND-NNN` shows the proposed_route for a single
finding (dry-run, no mutations). Useful for spot-checking the routing
logic before /audit's full compose ship.

## 7. Constitutional check (anti-goal corpus matching)

`cwos-audit.js constitutional` wraps `cwos-constitutional-audit.js`
which loads `kit/data/constitutional-detector-corpus.yaml` (sections
`anti_goals` + `failed_states`) and applies token-Jaccard +
phrase-coverage matching against arbitrary input text.

Two invocation modes:
- `--check-text "<text>"` — the mode /next Step 4a uses for anti-goal
  cross-check. Returns `{pass, matches}` + exit 0/1.
- (default — full corpus run) — assesses constitutional health
  end-to-end; less commonly used.

Matching algorithm:
- **Token-Jaccard:** intersection-over-union on tokenized input vs each
  corpus phrase. Threshold typically ~0.4.
- **Phrase-coverage:** what fraction of the corpus phrase's tokens
  appear in the input. Threshold typically ~0.6.
- A match fires when EITHER threshold trips for any corpus phrase.

The check is a **guardrail**, not a hard gate. Intent: surface the
constitutional implication so the founder can pause + decide. /next
Step 4a's EXEMPTION flow lets the founder approve with a recorded
reason.

---

## See also

- `kit/commands/audit.md` — the ≤120-line skeleton that calls
  cwos-audit.js
- `kit/scripts/cwos-audit.js` — 5 subcommands (focus / compose /
  constitutional / render / verify-route)
- `kit/scripts/cwos-constitutional-audit.js` — corpus matcher
- `kit/data/constitutional-detector-corpus.yaml` — the anti_goals +
  failed_states corpus
- `kit/scripts/cwos-verify.js` — the INVARIANT_CHECKS registry
- `pulse-pedagogy.md` — companion for /pulse's program-accountability
  side
- `next-command-pedagogy.md` — companion for /next's prioritization +
  composition logic
