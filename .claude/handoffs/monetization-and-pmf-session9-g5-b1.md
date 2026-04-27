# Handoff — Monetization & PMF · Session 9 G5-B1 (Entitlement Foundation — FIRST CODE)

**Session:** 2026-04-25, Claude (main)
**Project:** `docs/projects/monetization-and-pmf.project.md`
**Phase:** Gate 5 Batch 1 — Entitlement Foundation. **First code on the project after 8 sessions of design.**
**Status:** SHIPPED — 108 new tests green, zero regressions, clean build

---

## Files I Own (This Session)

### New (9 files)
- `src/constants/entitlementConstants.js` — frozen ACTIONS + state + schema + TIERS/COHORTS/BILLING_CYCLES enums
- `src/utils/entitlement/featureMap.js` — FEATURE_TIER + TIER_ORDER + helpers
- `src/utils/entitlement/__tests__/featureMap.test.js` — 28 tests
- `src/reducers/entitlementReducer.js` — 10-action reducer
- `src/reducers/__tests__/entitlementReducer.test.js` — 40 tests
- `src/contexts/EntitlementContext.jsx` — Provider + useEntitlement hook
- `src/contexts/__tests__/EntitlementContext.test.jsx` — 18 tests
- `src/hooks/useEntitlementPersistence.js` — IDB hydration + debounced writes
- `src/hooks/__tests__/useEntitlementPersistence.test.js` — 6 tests
- `src/utils/persistence/subscriptionStore.js` — IDB CRUD primitives
- `src/utils/persistence/__tests__/subscriptionStore.test.js` — 16 tests

### Amended (5 files)
- `src/test/setup.js` — wired `fake-indexeddb/auto`
- `src/utils/persistence/database.js` — DB_VERSION 17 → 18 + SUBSCRIPTION_STORE_NAME constant
- `src/utils/persistence/migrations.js` — added `migrateV18` function + guard
- `src/utils/persistence/index.js` — re-exported subscriptionStore CRUD
- `src/utils/persistence/__tests__/database.test.js` — updated 11→12 stores assertion
- `src/contexts/index.js` — re-exported EntitlementProvider + useEntitlement
- `src/hooks/useAppState.js` — composed useReducer(entitlementReducer)
- `src/AppProviders.jsx` — mounted EntitlementProvider between AuthProvider and GameProvider
- `src/PokerTracker.jsx` — threaded entitlementState + dispatchEntitlement through AppProviders props
- `docs/projects/monetization-and-pmf.project.md` — Stream A `G5 [~]` + Session Log row
- `.claude/BACKLOG.md` — flipped MPMF-G5-ER + MPMF-G5-IDB to COMPLETE
- `.claude/STATUS.md` — top entry; prior Gate 4 closure entry demoted

**No file conflicts.** Other active sessions (PRF G5-CI / EAL Stream E continuation) operate in different file trees.

---

## What this session produced

108 new tests across 5 test files. Zero regressions. Clean build (10.39s). DB_VERSION bumped 17 → 18 with additive `subscription` store.

### Test breakdown

| Suite | Count | Coverage |
|---|---|---|
| featureMap.test.js | 28 | FEATURE_TIER + TIER_ORDER + isAtLeast + hasAccessTo + resolveEffectiveTier |
| entitlementReducer.test.js | 40 | All 10 actions + edge cases (cancel-supersedes-pending; fresh-upgrade-clears-grace; immutability; unknown actions) |
| subscriptionStore.test.js | 16 | v18 migration + seed + idempotency + v17-untouched + CRUD round-trip |
| EntitlementContext.test.jsx | 18 | Provider + value passthrough + semantic helpers + useMemo stability + outside-provider error |
| useEntitlementPersistence.test.js | 6 | Mount hydration + seed-on-missing + debounced writes + pre-hydration write guard |
| **Total** | **108** | |

### Functional outcome

**Users see no behavioral change.** No PaywallGate component exists yet (Gate 5 Batch 3), so no tier-gating fires anywhere. Free-tier users continue to use the app exactly as before. Paid-tier code paths are reachable only via the dev-only `DEV_OVERRIDE_TIER` action.

### Architectural decisions

- **Provider hierarchy:** EntitlementProvider sits between AuthProvider and GameProvider — high enough that all gated features can access it, but inside Auth so it can later identify the user via Stripe Customer ID.
- **Two-pattern hook combo:** `useEntitlementPersistence` follows the params-based pattern (mirrors `usePlayerPersistence`); `useEntitlement` follows the useContext-based pattern (mirrors `usePlayer`). Both are valid in the codebase.
- **IDB v18 claimed first:** Per EAL gate4-p3-decisions §2 dynamic-target rule, MPMF was first to ship a v18 migration. PRF/EAL/SLS will land at v19+ when their persistence work ships.
- **Semantic helpers in context value:** isAtLeast / hasAccessTo / isCancellationGrace / isPendingPlanChange / isCardDeclineGrace pre-bound to current effective tier so consumers don't repeat the binding boilerplate.
- **Effective tier respects dev override:** `resolveEffectiveTier(state)` returns `overrides.devForceTier` if set, else `state.tier`. Components read effectiveTier; raw state.tier is preserved for Stripe-backed canonical state.
- **Cancellation supersedes pending plan-change** (per Gate 4 known-behavior note). Fresh upgrade clears all grace state (cancellation, pending plan-change, card-decline).

### What this batch unblocks

**G5-B2 (Telemetry Foundation) — next plan:**
- PostHog install + consentGate + first-launch panel + Settings mirror panel
- Owner prerequisites: PostHog-for-Startups credit + Stripe sandbox account + M15 verification

**G5-B3 (Commerce Primitives) — after B2:**
- PaywallGate component + PaywallModal + PaywallFallbackInline
- UpgradePromptInline (5 host contexts)
- TrialStateIndicator chip
- All blocked on G5-B1 entitlement context (now ready)

**G5-B4 (Commerce Views) — after B3:**
- PricingView + BillingSettings + cancellation/plan-change journey modals + 6 CI-linted copy generators

**G5-B5 (Evaluator Onboarding + Stream E) — after B4:**
- EvaluatorOnboardingPicker + 5 variation flows + sample-data mode + Stream E founding-member outreach kickoff readiness

**Stream D Phase 1 (PostHog install)** — still independently unblocked; lands as part of G5-B2.

**Stream E Phase 1 (founding-member outreach)** — blocked on G5-B4 pricing-page + Stripe wiring.

---

## Known issues (not introduced by B1)

### Pre-existing precisionAudit flake (drillContent/)

Smart-test-runner reports 7643/7644 with 1 failure in `src/utils/drillContent/__tests__/precisionAudit.test.js`. This flake is documented 13× in STATUS history (EAL Stream E commits, PRF G5-CI sessions, etc.). Not regressed by G5-B1; not in MPMF's scope to fix.

---

## Risks (updates from Gate 5 plan)

| # | Risk | Status |
|---|---|---|
| P1 | IDB migration corrupts existing user data | RESOLVED — fake-indexeddb round-trip tests pass; migration is additive-only; v17 stores untouched test green |
| P2 | Concurrent project ships v18 first → version collision | RESOLVED — MPMF claimed v18 first; coordination noted in STATUS |
| P3 | createValidatedReducer wrapper rejects sparse states | RESOLVED — schema validates only top-level required keys; nested objects flexible |
| P4 | fake-indexeddb wiring breaks existing tests | RESOLVED — full smart-test-runner shows 7643/7644 (1 pre-existing flake unchanged); fake-indexeddb auto-import is global-namespace, harmless to non-IDB tests |
| P5 | EntitlementProvider mount blocks app boot if IDB read slow | RESOLVED — initial state defaults to `tier: 'free'` immediately; hydration replaces on next render; no blocking |
| P6 | useEntitlement consumer outside Provider crashes app | RESOLVED — hook throws helpful error; ESLint/runtime catches at first call site |
| P7 | Founding-lifetime / ignition tier handling | RESOLVED — TIER_ORDER tested both at level 2 (founding-lifetime) and level 99 (ignition); featureMap tests cover edge cases |
| P8 | Step 6 AppRoot integration breaks unrelated context | RESOLVED — full smart-test-runner green; existing 7,500+ tests unaffected; clean build |

---

## Ratification checklist (for owner)

Before G5-B2 plan begins, owner should:

- [ ] Confirm pricing numbers (still tentative): Free $0 / Plus $17/mo / Pro $29/mo / Founding-Lifetime $299 once
- [ ] **Apply for PostHog-for-Startups credit ($50K)** — owner-actionable; gates G5-B2 telemetry install
- [ ] Sign up for Stripe (or Paddle / LemonSqueezy) sandbox account — needed before G5-B2 webhook architectural decision
- [ ] Verify M15 anonymous-first feasibility manually: try Stripe Checkout in sandbox without pre-existing customer; confirm flow works
- [ ] Schedule Q7 legal-scoping session if Phase 2+ Ignition lane is anticipated within 6 months
- [ ] Smoke-test the build locally (`npm run dev`) and confirm app boots; open DevTools → Application → IndexedDB → verify `subscription` store exists with `{ userId: 'guest', tier: 'free', ... }`

Nothing locks until explicit ratification; B1 is fully reversible (single-revert restores prior state).

---

## What G5-B2 plan needs to address

When the next plan kicks off:

1. **Stripe webhook architecture decision** — open question parked at G5-B1. Three options:
   - (a) Serverless function (Vercel/Cloudflare Worker) — minimal infra ~$0/mo at low volume
   - (b) Stripe Customer Portal + client polling — no backend; founding-cap enforcement weakened
   - (c) Introduce a backend (substantial scope expansion)

2. **PostHog event schema v1** — drawn from `assumption-ledger.md` kill-criterion targets. Need owner sign-off on first-cut event list.

3. **First-launch panel UX** — surface spec exists at `surfaces/telemetry-consent-panel.md`; implementation matches spec exactly.

4. **Consent-gate placement** — wraps `posthog.capture` so events are dropped at source if category opted-out. Critical for red line #1 (opt-in enrollment) structural enforcement.

---

## Change log

- 2026-04-25 — Session 9 G5-B1. Gate 5 Batch 1 (Entitlement Foundation) shipped — 9 new files + 5 amended files + 108 new tests + clean build + zero regressions. First production code on Monetization & PMF project. Next plan: G5-B2 Telemetry Foundation.
