# WRITERS.md — Monetization & PMF

**Project:** Monetization & PMF
**Scope:** writer registry for the `subscription` IDB store + cross-store invariants where commerce state touches existing stores.
**Purpose:** enumerate every write site for subscription-related persistence so entitlement drift is structurally impossible and so CI can grep-enforce the registry.

**Pattern basis:** mirrors `docs/projects/exploit-anchor-library/WRITERS.md` (13 writers across 4 stores + 7 cross-store invariants I-WR-1..7 + CI-grep enforcement sketch).

**Status:** DRAFT — Gate 4 authoring. Expands at Gate 5 as payment-processor callbacks + reducer actions get named.

---

## The `subscription` store

Single IDB object store added at next IDB version bump (dynamic `max(currentVersion+1, targetVersion)` pattern per EAL G4-DB precedent — current IDB is v17; MPMF migration likely targets v19 or later depending on parallel project merges).

**Keypath:** `userId` (single-user app = single record; deliberately not compound; single-record-per-install pattern matches existing activeSession + settings stores).

**Record shape** (subject to refinement at Gate 5):

```js
{
  userId: string,                  // anonymous ID or identified account ID
  tier: 'free' | 'plus' | 'pro' | 'founding-lifetime',
  acquiredAt: string,              // ISO8601
  cohort: 'founding-50' | 'standard',
  billingCycle: 'monthly' | 'annual' | 'lifetime',
  nextBillAt: string | null,       // null for free or lifetime
  nextBillAmount: number | null,   // in cents; null for free or lifetime
  paymentMethod: {                 // redacted; last4 + expiry + brand only
    last4: string,
    expiryMonth: number,
    expiryYear: number,
    brand: string,
  } | null,
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
  canceledAt: string | null,       // ISO8601 when user initiated cancellation
  accessThrough: string | null,    // ISO8601 — when access fully revokes
  overrides: {                     // owner-applied durable overrides (red line #3)
    devForceTier: string | null,   // dev-only override
  },
  schemaVersion: string,           // compound-semver pattern per EAL-G4-V precedent
}
```

---

## Writers (5 across 1 store)

### W-SUB-1 — migration-seed
- **Entry point:** `src/utils/persistence/database.js` → migration from v(N) to v(N+1) adds `subscription` store + seeds a single `free`-tier record per install.
- **Fields written:** entire record with `tier: 'free'`, `cohort: 'standard'`, `acquiredAt: now()`, `schemaVersion: '1.0.0'`, other fields null.
- **Trigger:** IDB upgrade event on first install of MPMF-capable version.
- **Idempotency:** check-before-insert on `userId`; re-running migration does not duplicate.
- **Failure mode:** migration fails → IDB stays at prior version; user sees app in previous state without monetization features (graceful degradation).
- **Autonomy contract:** creates record without user action; but record is `tier: 'free'` (no commerce state claimed); no PII; no consent required for local storage. Transparency panel (Q8=B) surfaces telemetry consent separately.

### W-SUB-2 — payment-success-callback
- **Entry point:** `src/utils/payments/webhookHandler.js` → handles Stripe webhook events (`checkout.session.completed`, `invoice.payment_succeeded`).
- **Fields written:** `tier` (elevated), `cohort`, `billingCycle`, `nextBillAt`, `nextBillAmount`, `paymentMethod`, `stripeCustomerId`, `stripeSubscriptionId`, `acquiredAt`.
- **Trigger:** successful payment via Stripe Checkout or subscription renewal.
- **Idempotency:** keyed on Stripe event ID; re-delivery does not double-credit.
- **Failure mode:** webhook delivery fails → retry queue; user sees pending state in UI until confirmed; no tier elevation until write succeeds. Stale-retry window ≤ 24h.
- **Autonomy contract:** user initiated via pricing-page or upgrade-modal (explicit opt-in); writing is confirmation of that action.

### W-SUB-3 — cancellation-writer
- **Entry point:** `src/utils/entitlement/cancelSubscription.js` → called from `journeys/cancellation.md` confirm action.
- **Fields written:** `canceledAt` (now), `accessThrough` (end of current billing period), emits a Stripe cancellation API call in same transaction.
- **Trigger:** user taps "Cancel" + "Confirm" in BillingSettings → cancellation modal.
- **Idempotency:** already-canceled state is no-op with toast ("already scheduled for cancellation on [date]"); does not re-trigger cancellation flow.
- **Failure mode:** Stripe API failure → user sees error toast ("We couldn't reach the billing system; try again or contact support"); does NOT partial-write `canceledAt` without Stripe-side confirmation (MPMF-AP-05 refusal — no silent fake-cancellation).
- **Autonomy contract:** **load-bearing for red line #10 (no dark-pattern cancellation)**. Writer is idempotent + non-interposed. No "are you sure?" retention trap between user tap and write. `canceledAt` set immediately on success; post-cancel state honored (no upsell / no re-prompt for ≥90 days per red line #3).

### W-SUB-4 — plan-change-writer
- **Entry point:** `src/utils/entitlement/changePlan.js` → called from `journeys/plan-change.md` confirm action.
- **Fields written:** `tier` (new), `billingCycle` (possibly new), `nextBillAt`, `nextBillAmount`, emits Stripe subscription-update API call.
- **Trigger:** user taps "Change Plan" + "Confirm" in BillingSettings → plan-change modal.
- **Idempotency:** same-tier selection is no-op; different-tier selection triggers Stripe update + IDB write in single transaction.
- **Failure mode:** Stripe API failure → error toast; no IDB write without confirmation.
- **Autonomy contract:** upgrade is immediate with prorated charge (user sees charge upfront); downgrade is effective at next billing period with credit issued if applicable (factual, stated upfront per SA-76). No "downgrade" framing (MPMF-AP-06 refused).

### W-SUB-5 — dev-override-writer
- **Entry point:** `src/__dev__/entitlementOverride.js` → dev-console exposed override action.
- **Fields written:** `overrides.devForceTier`.
- **Trigger:** dev-only; NOT exposed in production UI. Gated behind `DEV_MODE` flag.
- **Idempotency:** last-write-wins; no history.
- **Failure mode:** dev-only; no user impact.
- **Autonomy contract:** dev-facing escape hatch for testing tier-specific surfaces; does not affect Stripe billing (writing `devForceTier` is IDB-only; Stripe state unchanged). Dev-override is transparent to user via Settings → Telemetry panel if ever-enabled (but realistically owner-only).

---

## Cross-store invariants (I-WR-1 through I-WR-5)

### I-WR-1 — Registry completeness (CI-grep)

Every IDB write to the `subscription` store must go through one of the 5 W-SUB-* entry points. CI-grep script `scripts/check-subscription-writers.sh` scans the codebase for direct `subscription` store writes outside those 5 files and fails CI on any match.

**Rationale:** prevents entitlement-drift via backdoor writes (a component that self-elevates tier without going through the webhook handler would violate billing integrity).

Forbidden pattern: `.put(...)` or `.add(...)` on a transaction including the `subscription` object store, outside the 5 W-SUB-* files. Permitted: `.get(...)` / `.getAll(...)` reads — any consumer can read.

### I-WR-2 — Authored-vs-evidence separation

User-initiated writes (W-SUB-2 / W-SUB-3 / W-SUB-4 — payment / cancel / change) are distinct from system-initiated writes (W-SUB-1 migration / W-SUB-5 dev-override). Logs and test assertions distinguish these categories.

**Rationale:** audit trail + autonomy-respect — a user must be able to see which writes happened because they acted vs. because the system acted. Mirrors EAL red line #9 (user-originated vs system-generated observations separation).

### I-WR-3 — Cancellation atomicity

Cancellation (W-SUB-3) writes `canceledAt` + `accessThrough` atomically with Stripe API call success. Either both complete or neither does. No partial-cancel state possible.

**Rationale:** MPMF-AP-05 refusal — no fake-cancellation or silent-retention-trap patterns. User sees either "canceled successfully" or "we couldn't process your cancellation — try again."

**Test target:** MPMF-G5-RL test for red line #10.

### I-WR-4 — Founding-member cap enforcement

Payment-success-callback (W-SUB-2) for founding-member tier checks current founding-member count BEFORE writing. If count ≥ 50, refuses the write and refunds via Stripe.

**Rationale:** Q4=A verdict — $299 lifetime cap is hard, not soft. Prevents 51st founding member being accidentally sold the lifetime deal due to a race condition between signup flow seeing "1 seat remaining" and two users paying simultaneously.

**Implementation pattern:** Stripe-side metered billing OR server-side count-check with optimistic locking. Gate 5 decision.

### I-WR-5 — Schema version on every write

Every W-SUB-* writer sets `schemaVersion` to the compound-semver pattern (per EAL G4-P3 §1 precedent). Readers check `schemaVersion` before interpreting fields; unknown future version → read-only degraded mode + prompt-to-update.

**Rationale:** forward-compatibility across tier-schema evolution without breaking existing records.

---

## CI enforcement

`scripts/check-subscription-writers.sh` (to be authored at Gate 5 MPMF-G5-CL alongside forbidden-copy-strings check):

```bash
#!/usr/bin/env bash
# Enforce I-WR-1 — all subscription store writes via W-SUB-* entry points only.
set -e

ALLOWED_FILES=(
  "src/utils/persistence/database.js"           # W-SUB-1
  "src/utils/payments/webhookHandler.js"        # W-SUB-2
  "src/utils/entitlement/cancelSubscription.js" # W-SUB-3
  "src/utils/entitlement/changePlan.js"         # W-SUB-4
  "src/__dev__/entitlementOverride.js"          # W-SUB-5
)

# Grep for writes to subscription store outside allowed files
VIOLATIONS=$(grep -rn --include="*.js" --include="*.jsx" -E \
  "(put|add)\s*\(.*subscription" src/ \
  | grep -vE "$(IFS='|'; echo "${ALLOWED_FILES[*]}")")

if [ -n "$VIOLATIONS" ]; then
  echo "I-WR-1 violation: subscription store writes outside W-SUB-* registry:"
  echo "$VIOLATIONS"
  exit 1
fi
```

Gate 5 implementation expands this pattern.

---

## Relationship to other stores

### `settings` store (existing)

Settings may reflect entitlement-adjacent UI state (e.g., "show upgrade banners: yes/no" — a user opt-out preference). Writes to `settings` are independent; NOT subject to I-WR-1. Tier-state indicator visibility preference lives in `settings`, not `subscription`.

### `players` / `sessions` / `hands` stores (existing)

These contain domain data, not entitlement. Free-tier vs paid-tier gates on *access* to these stores, not *storage*. Downgrading to free preserves data in existing stores (per SA-76 JTBD + Q5=A session-scoped-free verdict); features become inaccessible but data doesn't disappear.

**Selector pattern:** `selectHandsForTier(tier, session)` in a new `src/utils/entitlement/selectors.js` gates query results based on current `tier`. Free-tier queries return only current-session data; paid-tier queries return unbounded history.

---

## Change log

- 2026-04-24 — Session 4 Batch 1. Created. 5 writers enumerated + 5 cross-store invariants + CI-grep enforcement sketch. Mirrors EAL WRITERS.md pattern. Will expand as Gate 5 implementation names concrete reducer action types + Stripe webhook event names.
