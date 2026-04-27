# Entitlement Architecture — Monetization & PMF

**Project:** Monetization & PMF
**Artifact:** MPMF-G4-EA (Gate 4 Batch 1 — 2026-04-24)
**Purpose:** Define where entitlement state lives, how writers mutate it, how consumers read it, and how the main-app ↔ extension contract works.

**Status:** DRAFT — Gate 4 design. Gate 5 implementation references this document.

---

## Summary

**Main-app IDB is the single source of truth for entitlement state.** The extension reads entitlement via the existing WebSocket bridge; it never writes or caches entitlement independently.

This decision flows from:
- Gate 2 audit Stage D cross-product analysis (cross-product state coherence).
- Q3=C verdict (defer Ignition commercial lane; entitlement architecture must still accommodate eventual Phase 2+ Ignition SKU).
- Existing ignition-poker-tracker architecture (extension already uses WebSocket bridge for state; mirroring this for entitlement is zero-new-infrastructure).

---

## Layered architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Payment Processor (Stripe)                                      │
│  - Source of truth for billing state (subscription status, etc.) │
│  - Webhook events push state changes to main-app                 │
└─────────────────────────────────────────────────────────────────┘
                            │ (webhook push)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Main-app — IDB `subscription` store                             │
│  - Source of truth for entitlement state WITHIN the app          │
│  - Synced from Stripe via webhook handler (W-SUB-2)              │
│  - Writers: 5 (per WRITERS.md)                                   │
│  - Readers: EntitlementContext + selectors (unrestricted)        │
└─────────────────────────────────────────────────────────────────┘
            │ (read via WebSocket bridge — NO WRITE)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Extension (ignition-poker-tracker/)                             │
│  - Reads entitlement state via existing WebSocket bridge         │
│  - Caches in memory per-session; re-queries on reconnect         │
│  - Writers: NONE                                                 │
│  - Degrades gracefully if bridge unreachable (treats as 'free')  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Main-app side

### IDB `subscription` store

**Schema:** see `WRITERS.md` §The subscription store. Single-record-per-install pattern. Keypath `userId`.

**Version:** added at next IDB bump — dynamic `max(currentVersion+1, targetVersion)` pattern per EAL G4-P3 §2 precedent. Current IDB is v17; MPMF migration likely targets v19 or later depending on parallel project merges (Shape Language + EAL + PRF all targeting v18 or v19).

**Migration:** additive only. Creates `subscription` store + seeds single `{tier: 'free', cohort: 'standard', ...}` record for the current installed user.

**Backup/export:** new store included in any `exportAll` / `importAll` flows (mirrors EAL G4-EX scope — owner's own data, incognito status preserved on import). Export policy deferred to Gate 5.

### EntitlementContext

**Location:** `src/contexts/EntitlementContext.jsx` (new).

**Provider hierarchy:** `<AppRoot>` wraps `<EntitlementProvider>` near the top of the tree, before any view or consumer. Mirrors existing pattern (`AssumptionProvider`, `AnchorLibraryProvider`).

**Value:** hydrated from IDB on mount; updates reactively on reducer dispatch.

**Read API:**

```js
const {
  tier,                 // 'free' | 'plus' | 'pro' | 'founding-lifetime'
  isAtLeast,            // (requiredTier) => boolean
  hasAccessTo,          // (feature) => boolean  — see feature map below
  cohort,               // 'founding-50' | 'standard'
  nextBillAt,           // ISO8601 | null
  canceledAt,           // ISO8601 | null
  accessThrough,        // ISO8601 | null
} = useEntitlement();
```

**No write API exposed.** Consumers read only. Writes go through the 5 W-SUB-* entry points enumerated in `WRITERS.md`.

### Feature map (consumer layer)

`src/utils/entitlement/featureMap.js` (new) maps gated features to required tier:

```js
export const FEATURE_TIER = Object.freeze({
  // Free-tier features (always available)
  HAND_ENTRY: 'free',
  LIVE_EXPLOIT_ENGINE: 'free',
  END_OF_SESSION_RECAP: 'free',
  SAMPLE_DATA_MODE: 'free',

  // Plus features
  CROSS_SESSION_HISTORY: 'plus',
  VILLAIN_MODELS_PERSISTED: 'plus',
  BASIC_DRILLS: 'plus',

  // Pro features
  GAME_TREE_DEEP_ANALYSIS: 'pro',
  EXPLOIT_ANCHOR_LIBRARY: 'pro',
  CALIBRATION_DASHBOARD: 'pro',
  ADVANCED_DRILLS: 'pro',
  PRINTABLE_REFRESHER: 'pro',

  // Ignition SKU — deferred per Q3=C
  IGNITION_SIDEBAR: 'ignition',  // reserved; Phase 2+
});

// Tier ordering for isAtLeast checks
export const TIER_ORDER = Object.freeze({
  'free': 0,
  'plus': 1,
  'pro': 2,
  'founding-lifetime': 2,  // equivalent to pro tier features
  'ignition': 99,          // separate lane; not part of linear ladder
});
```

**Rationale:** flat feature → tier mapping keeps gating decisions centralized. Any feature needing to gate goes through `hasAccessTo(FEATURE_TIER.GAME_TREE_DEEP_ANALYSIS)` — no string-matching on tier names inside components.

### PaywallGate component

**Location:** `src/components/ui/PaywallGate.jsx` (new at Gate 5).

**Interface:**

```jsx
<PaywallGate
  feature={FEATURE_TIER.GAME_TREE_DEEP_ANALYSIS}
  fallback={<UpgradePrompt tier="pro" />}
>
  {/* feature content */}
</PaywallGate>
```

**Behavior:**
- Reads `useEntitlement()`; if user has access → render children.
- If not → render `fallback` (or a default factual lock-state explainer).
- Never interrupts — lock is pre-render, not mid-interaction (H-SC01 compliance).
- Never fires mid-hand (H-SC01 + MPMF-AP-12 refusal).

### Reducer

**Not strictly required.** EntitlementContext can be a hook wrapping IDB reads + event listener. If a reducer is warranted (e.g., for optimistic UI during plan-change), it's additive + minimal.

Pattern option A (recommended): pure hook wrapping IDB + BroadcastChannel for cross-tab sync. Simpler.

Pattern option B: Reducer + context + action types for optimistic UI. Gate 5 decision; default to A.

---

## Extension side

### Read-only entitlement

The extension (`ignition-poker-tracker/`) SHALL NOT:
- Cache entitlement in IDB or localStorage.
- Write entitlement to main-app via any mechanism.
- Assume an entitlement value; must re-query.

The extension SHALL:
- Query main-app via WebSocket bridge on connection (existing infrastructure).
- Refresh entitlement on `subscription.updated` broadcast (main-app pushes on W-SUB-2/3/4 events).
- Degrade gracefully to `tier: 'free'` if bridge unreachable.
- Surface a small "reconnecting..." indicator if bridge disconnected, never an upsell.

### Extension doctrine rule (MPMF-P8-EX)

Adds a rule to `ignition-poker-tracker/CLAUDE.md`:

> **Entitlement read-only.** The extension must not write entitlement state. All entitlement writes go through main-app webhook handler (W-SUB-2) or main-app UI actions (W-SUB-3/4). The extension reads via WebSocket bridge; if bridge is unavailable, the extension treats the user as `tier: 'free'` and does NOT attempt to infer higher tier from local evidence.

Reason: extension runs in Chrome sandbox with limited trust boundary. Entitlement decisions must be auditable through the main-app IDB record.

---

## Cross-surface contract

### Bundle ε (Ignition) strict-superset of Pro

Per Q10=B + MPMF-G4-ES decision: when Ignition SKU ships (Phase 2+), Ignition tier includes all Pro features plus sidebar-specific features. No separate "Ignition-only, no Pro" state possible — avoids cross-product UX gaps where a user with Ignition-but-not-Pro sees degraded main-app features they don't expect.

### Feature visibility

A user with `tier: 'pro'` but without Ignition SKU:
- Sees main-app fully functional.
- Sees sidebar greet "Upgrade to Ignition to activate" **inline at sidebar first-open** — NOT as main-app modal (H-SC02 + red line #8 respected).
- Main-app does NOT expose Ignition-specific surfaces (no "online-capable" icons, no references, no entries in navigation for Ignition-only flows).

A user with `tier: 'ignition'`:
- Has full Pro access in main-app.
- Has sidebar active.
- Sees no tier-lock in either surface.

A user with `tier: 'founding-lifetime'`:
- Has full Pro-equivalent access (feature-equivalent to Pro per TIER_ORDER).
- Does NOT have Ignition by default (Ignition is a separate SKU; founding-member lifetime covers main-app only unless Phase 2+ design changes).

### Grace periods and payment failures

Card decline / failed payment → grace period before tier degradation:
- 7-day grace: tier remains, in-app banner ("Update card to avoid interruption").
- After 7 days: tier degrades to `free`; user notified in-app and via transactional email.
- All data preserved (per SA-70 local-only mode + SA-76 plan-change data-preservation principle).

Cancellation:
- `canceledAt` set; `accessThrough` = end of current billing period.
- Until `accessThrough`, tier remains; user has full access.
- At `accessThrough`, tier degrades to `free` automatically (via scheduled reducer action or on-app-launch check).

---

## Data flow scenarios

### Scenario: new signup → Pro tier

1. User on pricing page → clicks "Upgrade to Pro" → Stripe Checkout.
2. User completes Checkout.
3. Stripe fires `checkout.session.completed` webhook → main-app server endpoint.
4. W-SUB-2 payment-success-callback writes `subscription` record: `tier: 'pro'`, `stripeCustomerId`, `stripeSubscriptionId`, `nextBillAt`, etc.
5. EntitlementContext observes IDB change → re-hydrates → components subscribed to `useEntitlement()` re-render with new `tier: 'pro'`.
6. Extension (if connected) receives `subscription.updated` broadcast via WebSocket → re-queries main-app → caches new tier in memory for session.

### Scenario: cancel → continues through billing period

1. User on BillingSettings → clicks "Cancel" → `journeys/cancellation.md` confirm modal.
2. User confirms → W-SUB-3 cancellation-writer fires Stripe API + IDB update atomically.
3. `canceledAt = now()`, `accessThrough = end_of_billing_period`.
4. UI reflects "Canceled; access through [date]"; no degraded features, no upsell, no re-prompt.
5. At `accessThrough`, scheduled check (or on next app-launch) detects expiration → writes `tier: 'free'`; features gracefully gate.

### Scenario: founding-member cap race condition

1. 49 founding-members signed up. Two users see "1 seat remaining" simultaneously.
2. Both click "Pay $299 for Lifetime".
3. Both reach Stripe Checkout.
4. W-SUB-2 webhook handler checks I-WR-4 (founding-member cap) before writing: first webhook succeeds → cap becomes 50 → second webhook detects cap filled → refuses write + refunds via Stripe API.
5. Second user sees "Sorry, founding-member cap reached while you were checking out — you've been refunded. Standard Pro pricing available." (factual copy; no coercion).

### Scenario: extension offline

1. User with Pro tier opens extension; WebSocket bridge fails (main-app not running).
2. Extension degrades to `tier: 'free'` display in sidebar ("Connect to main-app to access full features").
3. Extension does NOT attempt to infer tier from cached state or local heuristics.
4. User opens main-app; bridge reconnects; extension re-queries; full features restored.

---

## Testing strategy (for Gate 5)

### Unit tests

- `entitlement/featureMap.test.js` — `isAtLeast` + `hasAccessTo` logic, tier-ordering edge cases (founding-lifetime = pro for feature access), unknown-tier handling.
- `entitlement/selectors.test.js` — `selectHandsForTier` gates correctly for free-tier session-scope rule (Q5=A).

### Integration tests

- `EntitlementContext.test.jsx` — hydrates from IDB on mount; updates on IDB change event; consumers re-render.
- `PaywallGate.test.jsx` — free-tier user sees fallback; paid-tier user sees children; never interrupts during hand-in-progress (H-SC01 + MPMF-AP-12 test).

### End-to-end tests

- Signup flow → Stripe test-mode checkout → webhook received → tier updated. Playwright or equivalent.
- Cancellation flow → ≤2 taps → post-cancel state honored (no upsell for 90 days simulated). Test MPMF-AP-05 + #10.
- Founding-member cap race condition → simulated concurrent signups; verify only 50 succeed.

### Extension tests

- Extension offline → sidebar degrades gracefully → no crash, no infinite retry.
- Extension reconnect → entitlement re-queries and updates correctly.

---

## Payment processor selection (Gate 5 decision)

**Stripe** is the recommended default for Phase 1 main-app. Rationale:
- Clean legal posture for main-app (live-poker tracker for in-person play — not gambling-adjacent).
- Industry-standard; best SDK maturity; best webhook reliability.
- Stripe Checkout supports anonymous-first flow (M15 assumption pending engineering review).

**Paddle** / **LemonSqueezy** considered for Phase 2+ Ignition SKU pending Q7 legal scoping:
- Paddle handles international VAT + is more permissive on grey-market-adjacent categories.
- LemonSqueezy is newer / lighter-scrutinized.

If Stripe rejects the Phase 2+ Ignition category at that time, fall back to Paddle. Phase 1 main-app stays on Stripe regardless.

---

## Change log

- 2026-04-24 — Session 4 Batch 1. Created. Layered architecture + IDB source-of-truth + EntitlementContext + featureMap + PaywallGate + extension read-only doctrine + cross-surface contract + data-flow scenarios + testing strategy + payment-processor selection. Gate 5 implementation references this document for schema + component contracts.
