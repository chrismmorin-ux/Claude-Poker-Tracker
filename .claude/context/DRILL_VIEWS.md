---
last-verified-against-code: 2026-04-21
verified-by: drills-consolidation-roundtable-followup
staleness-threshold-days: 60
---

# Drill Views — Structural Patterns

Reference for patterns shared across `PreflopDrillsView/`, `PostflopDrillsView/`, and any future composite-tab view. Written after the 2026-04-20 drills-consolidation roundtable surfaced four implicit contracts that were never documented.

Cover four things: (1) how the height chain works, (2) how persistence hooks are mounted, (3) how `drillType` records are keyed, (4) how framework-accuracy aggregates shape across streets.

---

## 1. Height contract (RT-105)

Every Mode component inside `(Pre|Post)flopDrillsView/` uses `h-full overflow-hidden` on its outermost `div`. Those classes resolve against the nearest ancestor with a fixed height. The fixed height is set at the **view scaffold** level:

```
ScaledContainer (applies transform: scale)
  └── div style={{ width: 1600, height: 720 }}  ← fixed canvas
      └── header (px-8 pt-6 pb-4)               ← ~80 px
          tab bar (border-b)                    ← ~40 px
          └── div className="flex-1 ... pt-6 pb-6 overflow-hidden"
              └── <ActiveMode />                ← receives ~604 px of flex-1 space
                  outer div: "h-full overflow-hidden"
```

**Implications for restructuring:**

- You cannot host a Mode component from outside this chain without reproducing the chain, or its `h-full` collapses to 0 / overflows its new parent.
- Two-pane Modes (`ExplorerMode`, `ShapeMode`, `LessonsMode`, `LibraryMode`, `RecipeMode`, `LineMode`) rely on the content area being ≥ ~600 px tall. Below that their `grid-cols-2` panes clip.
- Adding new chrome (an extra tab row, a filter chip strip) between the view scaffold and the Mode reduces available content height 1:1.

**Budget rule:** at the 1600×720 target, chrome above the Mode must stay under **180 px total** to keep two-pane Modes usable. Current chrome is ~120 px.

**Owners of the `h-full`/`overflow-hidden` invariant:**
- `src/components/views/PreflopDrillsView/PreflopDrillsView.jsx` — outer fixed `1600×720`, inner `flex-1 overflow-hidden`
- `src/components/views/PostflopDrillsView/PostflopDrillsView.jsx` — same pattern
- Mode components: declare `h-full overflow-hidden` on outer div and trust the ancestor chain

---

## 2. Persistence hook hoisting (RT-104)

`usePreflopDrillsPersistence` and `usePostflopDrillsPersistence` are **stateful** hooks — each instance:

1. Fires an IDB `getAll` on mount (~20–80 ms on cold mobile).
2. Holds its own `drills` array in `useState`.
3. `recordAttempt(...)` updates only its own instance's array.

**Anti-pattern:** mounting multiple children that each call the same persistence hook simultaneously. Each instance loads independently, each holds a separate copy of the history, and `recordAttempt` in one doesn't propagate to its siblings. The scheduler (which weights framework selection by recent accuracy) then runs on out-of-sync snapshots.

**Correct pattern:** hoist the hook to the single common parent and hand state down.

```jsx
// WRONG — two hook instances, independent state
function DrillTab() {
  return (
    <>
      <RecipeDrillCard />    // calls usePreflopDrillsPersistence() internally
      <EstimateDrillCard />  // calls usePreflopDrillsPersistence() internally — separate instance
    </>
  );
}

// RIGHT — one hook, state flows down
function DrillTab() {
  const { drills, recordAttempt, frameworkAccuracy } = usePreflopDrillsPersistence();
  const recipeDrills = useMemo(() => drills.filter((d) => d.drillType === 'recipe'), [drills]);
  const estimateDrills = useMemo(() => drills.filter((d) => d.drillType === 'estimate'), [drills]);
  return (
    <>
      <RecipeDrillCard drills={recipeDrills} onAttempt={recordAttempt} accuracy={frameworkAccuracy} />
      <EstimateDrillCard drills={estimateDrills} onAttempt={recordAttempt} accuracy={frameworkAccuracy} />
    </>
  );
}
```

Today the two views (`PreflopDrillsView`, `PostflopDrillsView`) side-step this by only rendering one tab (one Mode) at a time. Any future composite view that wants to show two drill modes simultaneously (e.g., a "recent activity" card grid) **must** hoist the hook.

**Same rule applies to** `usePlayerTendencies`, `useTournamentPersistence`, and any hook that loads from IDB on mount. If a new view shows per-player or per-session stats across multiple sub-components, the hook belongs at the composite parent.

---

## 3. `drillType` record keying (RT-101)

The preflop and postflop drill IDB stores share a record shape but differ in the **identifier field** depending on `drillType`:

| drillType      | Store          | Primary identifier field | What it encodes                                |
|----------------|----------------|--------------------------|------------------------------------------------|
| `estimate`     | preflop        | `matchupKey`             | `<handA>_<handB>` (e.g. `AKs_JTs`)             |
| `framework`    | preflop        | `matchupKey`             | Same                                           |
| `recipe`       | preflop        | `matchupKey`             | Same                                           |
| `estimate`     | postflop       | `scenarioKey`            | `<scenarioId>__<questionId>__<position>`       |
| `framework`    | postflop       | `scenarioKey`            | `scenario.id`                                  |
| `line`         | postflop       | `scenarioKey`            | `<lineId>:<nodeId>` (e.g. `btn-vs-bb-q72r-dry:flop_cbet`) |

**Implications:**

- Code that iterates a single store and expects a uniform identifier field will miss records. Always match on `(record.matchupKey \|\| record.scenarioKey)` or branch on `drillType`.
- Any future "unified drill history" UI has to handle both fields explicitly — there is no single "the key" across `drillType`s.
- The `preflopDrills` and `postflopDrills` stores are separate IDB stores with separate schemas; they are not joined server-side.

**Adding a new `drillType`:** declare which field it uses in the appropriate storage file's docstring and in this table. Do not introduce a third field name.

---

## 4. Framework-accuracy aggregate shape (RT-100)

`aggregateFrameworkAccuracy` (preflop) and `aggregatePostflopFrameworkAccuracy` (postflop) both produce `{ [frameworkId]: { attempts, correct, accuracy, ... } }` but the preflop version carries two extra fields:

| Field           | Preflop | Postflop | Why                                                           |
|-----------------|---------|----------|---------------------------------------------------------------|
| `attempts`      | ✓       | ✓        | Count of drills that tagged this framework                    |
| `correct`       | ✓       | ✓        | Count where `drill.correct === true`                          |
| `accuracy`      | ✓       | ✓        | `correct / attempts` (or 0)                                   |
| `deltaSamples`  | ✓       | ✗        | Count where `drill.delta` is numeric                          |
| `avgDelta`      | ✓       | ✗        | Mean absolute equity delta across `deltaSamples`              |

The preflop side records `delta` for estimate and recipe drills (numeric "how far off was your guess"); the postflop side doesn't — postflop estimate is a % guess with its own delta convention and postflop framework is set-matching with no delta at all. To avoid field-name collision with ambiguous semantics, the postflop aggregate simply omits the delta fields.

**Implication:** a caller that merges both aggregates (e.g., a future unified drill scheduler) must handle missing `avgDelta` / `deltaSamples` explicitly. `undefined` will propagate `NaN` into arithmetic. Options:

1. Default to `0` when missing (`acc.avgDelta ?? 0`).
2. Branch on presence (only use delta where it exists).
3. Coerce the shapes upstream by computing `avgDelta` for postflop from a different measure (not recommended — different semantics).

The existing schedulers (in `src/utils/drillContent/scheduler.js` and `src/utils/postflopDrillContent/scheduler.js`) are kept separate and never merge across streets.

**Both aggregates are hardened against prototype pollution (RT-96)** — they use `Object.create(null)` and reject non-string framework IDs.

---

## References

- **Code:** `src/utils/persistence/preflopDrillsStorage.js`, `src/utils/persistence/postflopDrillsStorage.js`, `src/hooks/usePreflopDrillsPersistence.js`, `src/hooks/usePostflopDrillsPersistence.js`
- **Roundtable findings:** RT-100, RT-101, RT-104, RT-105 in `.claude/BACKLOG.md` (2026-04-20 drills-consolidation)
- **Related invariants:** INV-09 (user-scoped persistence), INV-14 (sibling-import discipline), INV-15 (SCREEN enum lifecycle)
- **Related failure modes:** `FM-Implicit-Height-Contract`, `FM-Hoisted-Persistence-Hook-Race` in `.claude/context/SYSTEM_MODEL.md` §5.1b

*Update this file when: new `drillType` is added, aggregate return shape changes, or a new composite-tab view is designed.*
