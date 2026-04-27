# Senior Engineer — Gate 2 Voice: Adaptive Lesson Seeding

## Stage D — Cross-product / cross-surface
**Verdict:** WARNING — shippable, but only if (a) the skill model is an **additive reducer + store** (not a retrofit onto existing state), (b) descriptor tag derivation is decoupled from lesson-progress tracking, and (c) the initial cold-start path is explicitly designed, not implied. Treating adaptive seeding as "just another reducer" hides three real cross-surface traps: hook-hoisting races (FM-Hoisted-Persistence-Hook-Race, SYSTEM_MODEL §5.1b), INV-08 violations via eager cross-descriptor queries, and silent engine-drift invalidation of authored lessons (FM-Engine-Drift-Silent-Invalidation, §5.1c). Each is preventable; none is default-safe.

---

### State model additions

The "skill model" is three orthogonal pieces of state that should **not** live together:

1. **Descriptor mastery** — per-descriptor Bayesian score `{descriptorId, alpha, beta, lastInteractedAt, lastValidatedAt, confidence}`. Beta-Binomial, consistent with the rest of the codebase's stats philosophy (SYSTEM_MODEL §12 2026-03-08 decision). 10 descriptors baseline, N growing — keep keyed-by-descriptorId, never an object with ten literal fields.
2. **Lesson progress** — per-lesson `{lessonId, descriptorIds[], status: unvisited|started|in-progress|completed, startedAt, completedAt, attemptCount, lastResult}`. Separate from mastery because a lesson can complete without mastery moving (user read it, didn't internalize it), and mastery can move without a lesson completing (user did 50 drill reps that tagged that descriptor).
3. **Recommendation state** — `{nextLessonId, reason, generatedAt, staleAfter}`. Derived, cacheable, not authoritative. Re-derivable from (1) + (2) at any time.

Self-assessment overrides belong inside (1) as a separate `overrideConfidence` field — not a flag that disables the Bayesian update, because the user will change their mind. Decay metadata is `lastInteractedAt` + `lastValidatedAt` on (1); decay is computed on read, not written, to avoid a timer-driven write storm (STP-1 RT-60 taught us that timers owned outside lifecycle registries become zombies).

### Persistence strategy (IndexedDB migration, reducer shape)

IDB is already at **v17** (not v15 as the prompt assumes — `database.js:50` sets `DB_VERSION = 17`; v17 = `villainAssumptions` from the Exploit Deviation Engine, landed 2026-04-21). So we're looking at **v17 → v18** minimum. Two new additive stores, keeping the one-store-per-domain pattern that `assumptionStorage.js` just established:

```
shapeMastery     keyPath: [userId, descriptorId]
                 indexes: userId, descriptorId, lastInteractedAt, confidence
shapeLessons     keyPath: [userId, lessonId]
                 indexes: userId, status, completedAt
```

Pattern precedent: `migrateV17` (`migrations.js:478`) is exactly the shape to copy — compound key, `userId` + domain-field indexes, schemaVersion field on every record for in-line migration per I-AE-5 (see `assumptionStorage.js:11`). **Do not** extend `players` or `settings` stores with nested shape data — that's the trap `migrateV10` fell into with `exploitBriefings[]`, which now requires per-player cursor walks to query.

**Reducer**: new `shapeLanguageReducer.js` + `ShapeLanguageContext.jsx` (mirror `AssumptionContext` / `assumptionReducer.js` pattern — both created this same month). Action shapes: `DESCRIPTOR_OBSERVED`, `DESCRIPTOR_VALIDATED`, `LESSON_STARTED`, `LESSON_COMPLETED`, `OVERRIDE_SET`, `HYDRATE_FROM_IDB`, `RESET`. Persistence hook `useShapeLanguagePersistence` debounced at 1.5s (established pattern, PERSISTENCE_OVERVIEW.md).

**Backup/export**: the existing export path (if any — worth auditing) must include the two new stores. `getAllShapeMastery(userId)` + `getAllShapeLessons(userId)` following `assumptionStorage.js`'s `getAllAssumptions` shape. Export is a weak spot already — SYSTEM_MODEL doesn't list an export path for range profiles or assumptions, which means a user switching devices loses everything. Scope this explicitly.

### Cross-surface propagation (contexts, selectors, how each surface reads)

Five surfaces read, two write. The propagation story is:

- **Provider**: `ShapeLanguageProvider` wraps the three pieces of state; mounts inside `PokerTracker.jsx` provider stack alongside `AssumptionProvider`.
- **Selector library**: `src/utils/shapeLanguage/selectors.js` — pure functions `getMasteryForDescriptor(state, id)`, `getRecommendedNextLesson(state)`, `getDescriptorsForSurface(state, surfaceKey)`. Surfaces call a `useShapeLanguage(selector)` hook (selector pattern keeps re-render scope minimal — relevant because `usePlayerTendencies` (SYSTEM_MODEL §7.2 RT-28) taught us that pan-provider consumers without selectors thrash at scale).
- **Readers**: HandReplay, SessionsView, PresessionDrillView, LiveAdviceBar, SizingPresetsPanel each call `useShapeLanguage(selectDescriptorAnnotationsForContext)` with surface-specific context.
- **Writers**: `PresessionDrillView` dispatches `DESCRIPTOR_VALIDATED` on drill success (correctness → positive Beta update); lesson container dispatches `LESSON_COMPLETED`; all other surfaces emit `DESCRIPTOR_OBSERVED` (passive, weight=0.1) on mouseover/tap telemetry. **The writer set must be enumerable** — any surface that writes mastery should be listed in one file, otherwise we get the multi-entry-point bug the sidebar rebuild just resolved (SYSTEM_MODEL §5.1 RT-43).

**Hook-hoisting trap** (FM-Hoisted-Persistence-Hook-Race, §5.1b): if a new lesson-picker view mounts Silhouette + Spire + Sizing mode tabs simultaneously and each calls `useShapeLanguagePersistence()`, they'll desync. **Hoist to provider.** This is not negotiable — the drills-consolidation roundtable (2026-04-20) flagged this exact class of bug as silently present in the codebase.

### Sidebar extension parity

Live-play HUD (`ignition-poker-tracker/`) consumes **derived descriptor tags only** — never lesson state, never mastery write-paths. Reasoning: the extension's job is in-session, the shape-language curriculum is study-mode. But here's the trap: if the main app's tag-surfacing logic is gated on mastery ("only show Silhouette label once user has Silhouette mastery ≥ threshold"), the extension must either read the same mastery (cross-origin IDB read — possible, already done per SYSTEM_MODEL §1.3) or apply a different rule (shows all tags always).

**Recommendation**: extension is **mastery-agnostic** — shows all descriptor tags always. The pedagogical "only show what you've learned" logic is main-app-only. This preserves the SR doctrine separation (extension doctrine v2 rules R-5.6, R-10.1 are about render honesty, not learning) and sidesteps the post-restart state-rehydration problem (SW reanimation, SYSTEM_MODEL §4.2). If we decide later to gate extension tags on mastery, it's a port push from app to extension, not a shared-state solve.

### Migration story (cold-start for existing users)

Upgrading user has zero shape state. The system must not:
- Force a placement test (friction; owner specifically said "cognitive prosthesis," not a curriculum gate).
- Assume everything is "unvisited" and then recommend by lesson-order (static list) — that's not adaptive, it's just sequential.
- Infer mastery from existing drill history (`preflopDrills`, `postflopDrills` stores) — descriptors are not yet tagged on those drill records.

**Proposed cold-start**:
1. On v17→v18 upgrade, hydrate `shapeMastery` with all 10 descriptors at `alpha=1, beta=1` (uninformative Beta), `lastInteractedAt=null`.
2. First recommendation = **Range Silhouette** unconditionally. It's the top-ranked descriptor in the roundtable (Top 6 #1), has the broadest surface coverage, and the "alphabet of five shapes" is the shallowest learning curve. Hardcoded seed, justified in the reason field.
3. After 3 interactions anywhere, switch to adaptive mode — recommendation driven by (posterior mean × surface-coverage × recency decay) rank.

No placement test. Seed list for the first 3 lessons is static, transition to adaptive is telemetry-driven.

### Computational cost

Mastery update on drill completion is `O(1)` — a Beta posterior bump. Recommendation ranking is `O(N_descriptors × N_lessons)` — at 10 descriptors and ~30 lessons, trivial. **Do both in-reducer, synchronously, on dispatch.** No worker, no batch job. Behavioral-signal inference (mouseover, tap) must be throttled at the telemetry boundary (one event per descriptor per 5s) — otherwise every scroll triggers a reducer dispatch which triggers a persistence debounce which at 50+ players causes the re-render cascade SYSTEM_MODEL §7.2 documents. Throttle in the hook, not the reducer.

Mobile constraint: the Samsung Galaxy A22 (HC-04) is the target. Reducer + selector + IDB write at 1.5s debounce is well within budget. No concerns.

### Failure modes & recovery

1. **Corrupted mastery state**: schemaVersion field per-record + in-line migration on read (assumptionStorage.js pattern). `RESET_DESCRIPTOR` action in reducer + a Settings toggle "Reset shape-language progress."
2. **Mastery/drill-result desync**: the `DESCRIPTOR_VALIDATED` action must be idempotent — a replay of the same drill attempt (same attemptId) must not double-count. Attempt-id deduplication in reducer.
3. **Engine drift** (FM-Engine-Drift-Silent-Invalidation, SYSTEM_MODEL §5.1c): if a lesson asserts "Saddle fires when Δ > 35 equity points" and that threshold changes in code, the lesson is silently wrong. Apply RT-108-style fixed-seed snapshot test — every authored lesson's worked examples must snapshot against the current engine output; drift fails CI.
4. **Multi-device sync conflict**: out of scope (SC-04 soft constraint: no server). If/when cloud sync happens, shape mastery merges via Beta-sum (alpha_a + alpha_b - 1, beta_a + beta_b - 1), not last-write-wins. Document as assumption, don't build yet.

---

## Recommended follow-ups

- **Design-spec item**: schema.md for `shapeMastery` + `shapeLessons` stores, following `docs/projects/exploit-deviation/schema.md` template (additive-only evolution, per-record `schemaVersion`).
- **Design-spec item**: enumerable writer-registry doc at `docs/projects/poker-shape-language/WRITERS.md` — list every surface that dispatches a mastery-mutating action, with the rule that adding a new writer requires a PR-level doc update. Mirror SYSTEM_MODEL §4.1 I-INV-PAYLOAD style.
- **Schema proposal**: v18 migration (`migrateV18` in `migrations.js`) creating the two stores. Target additive-only; no touch to any existing store.
- **Test requirement**: `gen-tests` on the new reducer covering idempotent mastery updates, cold-start hydration, RESET action, and schemaVersion migration at read-time.
- **Test requirement**: engine-drift snapshot tests (RT-108 pattern) for every authored lesson's worked example.
- **Cross-surface test**: simulated hook-hoisting race — mount two surfaces that call `useShapeLanguagePersistence()` simultaneously, assert single IDB load, assert mastery write from one surface is visible in the other within one render tick.
- **Extension boundary decision**: explicit, documented: extension is mastery-agnostic, shows all tags. Add to `ignition-poker-tracker/CLAUDE.md` as a doctrine rule.
- **Backup/export audit**: out-of-scope-but-adjacent — verify the existing export path covers all IDB stores. If it doesn't, add `shapeMastery` + `shapeLessons` + `villainAssumptions` + `rangeProfiles` to the export writer as part of this project, not a separate sweep.
- **Staleness threshold on recommendation**: recommendations cached in state must carry a `generatedAt` and re-derive if > 24h old. Mirrors `usePlayerTendencies` memoization staleness story (RT-28).
