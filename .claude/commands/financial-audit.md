---
name: financial-audit
description: "Financial integrity audit — 7 verification suites covering calculation precision, reconciliation, payment flows, allocation logic, concurrency, immutability, and compliance"
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: financial-audit` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Financial Audit Engine

Comprehensive financial code verification. Checks all paths where money is calculated, stored, moved, or displayed for correctness, precision, and compliance.

## Focus Area

$ARGUMENTS (specific financial flow, or "full" for complete audit)

---

## PHASE 0 — GATHER CONTEXT

1. Read `system/state.md` — financial metrics, transaction volumes
2. Read `system/invariants.md` — financial invariants (reconciliation rules, precision requirements)
3. Read `system/constraints.md` — regulatory requirements, compliance needs
4. Read `system/failures.md` — past financial bugs (MUST NOT recur)
5. Read `CLAUDE.md` — financial domain rules and architecture
6. Identify all files involving money: models, views, services, templates, API endpoints
7. Map the money flow: creation → calculation → storage → display → reconciliation

---

## PHASE 1 — VERIFICATION SUITES

Run these 7 suites against all financial code paths:

### Suite 1: Precision Audit
- Grep for floating-point operations on monetary values
- Verify Decimal/integer-cents used for all money calculations
- Check rounding: applied once at end, not at intermediate steps
- Check division: rounding rules specified for all divisions
- Check accumulation: large sums don't lose precision
- Check display: formatting matches stored precision

### Suite 2: Reconciliation Integrity
- Every debit has a corresponding credit
- Stored totals match sum of line items
- Cross-table balances agree
- Transaction logs are immutable (no UPDATE/DELETE on financial records)
- Audit trail exists for all balance-affecting operations

### Suite 3: Payment Flow Verification
- Webhook handlers are idempotent (check for dedup keys)
- Payment API calls have retry with exponential backoff
- Concurrent payment processing is serialized or properly locked
- All payment states have defined transitions (no impossible states)
- Refund logic mirrors charge logic exactly
- Failed payments have recovery or dead-letter handling

### Suite 4: Allocation Logic
- Payment waterfall follows correct priority order
- Allocations sum exactly to the input amount (no pennies lost)
- Zero-amount edge cases handled
- Negative balance edge cases handled
- Overpayment edge cases handled
- Concurrent allocations on same balance are serialized

### Suite 5: Concurrency Safety
- Database transactions wrap multi-step financial operations
- SELECT FOR UPDATE or equivalent locking on balance reads before writes
- No TOCTOU (time-of-check-time-of-use) gaps in balance operations
- Idempotency keys on all financial API endpoints

### Suite 6: Immutability Enforcement
- Financial records are append-only (corrections create new records, not modify old)
- Audit log captures who, what, when for all changes
- Historical balances can be reconstructed from transaction log
- No soft-delete on financial records (archive instead)

### Suite 7: Compliance Check
- PCI DSS: no raw card data in code, logs, or non-tokenized storage
- Financial PII not in logs or error messages
- Required disclosures present (terms, fees, rates)
- Tax calculations use jurisdiction-appropriate rules
- Record retention meets regulatory requirements

---

## PHASE 2 — CROSS-SUITE ANALYSIS

For each finding:
1. Can this cause actual monetary loss? (severity escalation)
2. Is this a single instance or a pattern? (class elimination opportunity)
3. Does this interact with findings from other suites? (compound risk)

---

## PHASE 3 — EXPERT REVIEW

Launch the **financial-auditor** persona as an agent to review:
- All suite findings
- The money flow map
- Any complex financial logic

The financial-auditor persona provides deeper analysis on:
- Edge cases the suites missed
- Business logic correctness (not just code correctness)
- Regulatory implications of findings

---

## PHASE 4 — FINDINGS & WORK ITEMS

Severity mapping:
| Suite Result | Severity |
|-------------|----------|
| Monetary loss possible | CRITICAL |
| Reconciliation broken | CRITICAL |
| Precision error in hot path | HIGH |
| Missing idempotency | HIGH |
| Concurrency risk | HIGH |
| Missing audit trail | MEDIUM |
| Compliance gap (non-blocking) | MEDIUM |
| Code quality in financial code | LOW |

Create findings and work items per standard pipeline.

**WS-id allocation (WS-040):** allocate every new work item's id via `node kit/scripts/cwos-next.js allocate-ws-id` — call it once per id, in order. Do NOT compute the next id by eyeballing the active-queue max: that scan misses `queue/archive/` and re-issues retired ids, which lets reconcile force-complete the new item (the SPR-018 / WS-033 incident). The CLI scans queue + archive + index.

---

## PHASE 5 — REPORT

```
## Financial Audit Results

### Money Flow Map
[diagram of how money moves through the system]

### Suite Results
| Suite | Status | Critical | High | Medium | Low |
|-------|--------|----------|------|--------|-----|
| Precision | PASS/FAIL | ... | ... | ... | ... |
| Reconciliation | PASS/FAIL | ... | ... | ... | ... |
| Payment Flow | PASS/FAIL | ... | ... | ... | ... |
| Allocation | PASS/FAIL | ... | ... | ... | ... |
| Concurrency | PASS/FAIL | ... | ... | ... | ... |
| Immutability | PASS/FAIL | ... | ... | ... | ... |
| Compliance | PASS/FAIL | ... | ... | ... | ... |

### Critical Findings (immediate action)
[any finding that can cause monetary loss]

### Reconciliation Health
[can all balances be reconstructed? any drift detected?]

### Compliance Status
[regulatory requirements met/unmet]
```

---

## Contract Alignment (ADR-038)

The briefing/output phase MUST emit this block (per ADR-038 Decision #6):

```
### Contract Alignment
- mode: <honored | departed (reason)>
- stretch: <honored | departed (reason)>
- success_shape: <honored — list which target items hit | departed (reason)>
- scope_ceiling: <complied — items skipped: [list] | violated (reason)>
```
