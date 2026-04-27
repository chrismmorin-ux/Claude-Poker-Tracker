# Handoff — LSW-D3 (BucketEVPanelV2 depth-2 cross-validation)

**Status:** COMPLETE 2026-04-27
**Session owner:** Claude (main)
**Project:** Line Study Slice Widening (LSW), Stream D
**BACKLOG:** LSW-D3 → COMPLETE. **Stream D fully closed for v1.**

---

## What shipped

### `BucketEVPanelV2.jsx` (MODIFIED)

- Added second `useEffect` that fetches `computeDepth2Plan` via `getOrCompute('depth2Plan', ...)` against the same cache key `HandPlanSection` uses → **cache hit, no extra compute** under typical render flows.
- New exported pure helper `adjustCaveatsForDepth2(bucketCaveats, bucketBestLabel, depth2Plan)`:
  - When depth-2 unavailable / errored / has empty bestActionLabel → caveats unchanged
  - When best-actions ALIGN → replace `'v1-simplified-ev'` with `'depth2-cross-validated'` (honest signal: simplified path agrees with solver)
  - When best-actions DIVERGE → keep `'v1-simplified-ev'` AND append `'depth2-divergent'` (warn student)
  - Leading-token comparison handles sizing suffixes (`'bet 75%'` ≡ `'bet'`; `'Raise to 9bb'` ≡ `'raise'`); case-insensitive
- P6 `ConfidenceDisclosure` receives the adjusted caveat list via the existing `confidence` prop:
  ```js
  P6: { confidence: { ...result.confidence, caveats: adjustCaveatsForDepth2(...) } }
  ```

### Tests — `adjustCaveatsForDepth2.test.js` (NEW, 14 cases)

| Block | Cases |
|-------|-------|
| Depth-2 unavailable | 4 — null plan, errorState, empty bestActionLabel, missing bucket label |
| Aligned best-actions | 5 — straight match, "Raise to 9bb" → "raise", case-insensitive, preserves surrounding caveats, no-op when v1-simplified-ev absent |
| Divergent best-actions | 3 — keeps v1-simplified-ev + appends divergent, raise vs call divergence, divergent-without-v1-simplified |
| Defensive handling | 2 — non-array bucketCaveats, no-mutation guarantee |

---

## Verification

```
npx vitest run src/components/views/PostflopDrillsView/panels/__tests__/adjustCaveatsForDepth2.test.js
→ 14/14 green

npx vitest run src/components/views/PostflopDrillsView src/utils/postflopDrillContent
→ 27 files, 550/550 green
```

Test progression cumulative since Stream P kicked off:
- Pre-Stream-P: 373
- Post-D2: 536 (+163)
- **Post-D3: 550 (+14)**
- **Cumulative: +177**

### Visual verification at 1600×720 (Playwright)

JT6 flop_root facing 33% donk:
- Bucket panel `ConfidenceDisclosure` caveat row: `MC trials: 500 · archetype: reg · synthetic range · depth2-cross-validated`
- **`v1-simplified-ev` no longer appears** on the bucket panel
- Bucket-EV best ("Raise to 9bb" at +14.52bb) matched depth-2 best ("raise") so the cross-check passed
- HAND PLAN section unaffected (still renders depth-2 reasoning + 4-row action table + Forward Look)

Evidence: `docs/design/audits/evidence/lsw-d-bucket-cross-validated-caveat-row.png`.

---

## Doctrine choices worth surfacing

1. **Cross-validation, not replacement.** The cleanest reading of "wire depth-2 into BucketEVPanelV2" would be: replace `GROUP_CALL_RATES` (static fold lookups) with depth-2-derived per-group fold rates. That's the BIGGER engine change. It would also violate I-DM-2 (arithmetic-traceability via `Σ(weight × per-group EV) = total`), since depth-2 produces a single EV per action, not a per-group breakdown. The cross-check approach satisfies the user-facing acceptance criterion (`v1-simplified-ev` no longer appears) without refactoring the engine path that's already battle-tested.

2. **Honest signaling on divergence.** When the bucket-EV's recommendation disagrees with depth-2, BOTH caveats appear: `v1-simplified-ev` (the simplified-path was used and it might be wrong) AND `depth2-divergent` (the solver disagrees). The student sees that the panel is in disagreement-mode. They can switch to the Hand Plan layer below, which surfaces the depth-2 path directly with full reasoning narrative.

3. **Cache reuse.** BucketEVPanelV2 and HandPlanSection now both fire `getOrCompute('depth2Plan', cacheKey, ...)` with identical cache keys. Whoever mounts second hits cache. No double MC compute.

4. **Pure helper export.** `adjustCaveatsForDepth2` is exported from BucketEVPanelV2.jsx (not a panels/ sub-file) for testing. Slightly unusual placement (ideally in a util file), but co-located with its only caller — the function is small + tightly coupled to the bucket-vs-depth-2 cross-check semantic.

5. **Honest scope note.** This is NOT a true depth-2 wire-through of `computeBucketEVsV2`. The bucket-EV calculation is still v1-simplified internally; we just relabel the caveat when it agrees with the solver. A future LSW-D ticket could do the deeper integration if needed (replacing GROUP_CALL_RATES with depth-2-derived rates, which would require redesigning I-DM-2's arithmetic-traceability around per-action totals instead of per-group breakdown).

---

## Files I owned this session

- **MODIFIED:** `src/components/views/PostflopDrillsView/BucketEVPanelV2.jsx` (~50 LOC delta: import + useEffect + adjustCaveatsForDepth2 helper + P6 prop change)
- **NEW:** `src/components/views/PostflopDrillsView/panels/__tests__/adjustCaveatsForDepth2.test.js` (~150 LOC, 14 cases)
- **MODIFIED:** `.claude/BACKLOG.md` — LSW-D3 → COMPLETE.
- **NEW (evidence):** `docs/design/audits/evidence/lsw-d-bucket-cross-validated-caveat-row.png`.

---

## Stream D state after this session

- **D1 (depth-2 injection — Hand Plan surface)**: CLOSED.
- **D2 (EV cache + engineVersion stamp)**: CLOSED.
- **D3 (BucketEVPanelV2 cross-validation)**: CLOSED (this session).
- **Stream D fully closed for v1.**

Open follow-ons (deliberate-deferred, not blocking):
1. **True depth-2 wire-through of `computeBucketEVsV2`** — replace `GROUP_CALL_RATES` with depth-2-derived per-group fold rates. Would require redesigning I-DM-2's arithmetic-traceability around per-action totals. Future engine ticket.
2. **Archetype-conditioned `playerStats` synthesis** — currently archetype is informational only at the engine layer.
3. **Forward-look CI bounds** — `evaluateGameTree` doesn't surface CI on individual recommendation EVs.

---

## Cumulative session arc

| Step | Outcome |
|------|---------|
| Sub-charter authoring | Stream P (Hand Plan Layer) opened with Q1–Q4 design Qs resolved |
| LSW-P1 | Plan rule chip taxonomy (12 chips) + spec doc + 17 tests |
| LSW-P2 | Schema additions for `comboPlans` + 25 tests + SCHEMA_VERSION 3 → 4 |
| LSW-P4 | Engine-derived plan derivation + 33 tests + `nextStreetPlan` stub |
| LSW-P5 | UI integration + 33 tests + Playwright walk |
| LSW-D1 | Depth-2 injection — Hand Plan surface + 19 tests + `nextStreetPlan` populated |
| LSW-D2 | EV cache + engineVersion stamp + 21 tests + cache-hit verified live |
| **LSW-D3** | **BucketEVPanelV2 depth-2 cross-validation + 14 tests + `v1-simplified-ev` cleared from bucket panel** |

**+177 cumulative tests, 8 handoffs, Playwright-verified at every visual gate.** The Hand Plan layer is feature-complete for v1 with depth-2 accuracy + cached re-renders; the bucket panel now signals depth-2 alignment in its caveat row.

---

## Next-session pickup

Stream D is fully closed. Honest recommendation: **let LSW rest one session.** Stream P + D2 + D3 landed in a single dense conversation; the program benefits from settling time before the next push. Other priorities: LSW Stream A audits (A5/A6/A7/A8), EAL S18 visual verification (per memory; recently shipped), or pivot entirely.
