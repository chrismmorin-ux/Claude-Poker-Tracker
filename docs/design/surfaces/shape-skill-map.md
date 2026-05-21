# Surface — Shape Skill Map (transparency screen)

**ID:** `shape-skill-map`
**Code paths:** (none yet — design-only at Gate 4)
- *Planned:* `src/components/views/SettingsView/ShapeSkillMapPanel/ShapeSkillMapPanel.jsx`
- *Planned:* `src/components/views/SettingsView/ShapeSkillMapPanel/DescriptorRow.jsx`
- *Planned:* `src/utils/skillAssessment/shapeLanguage/hooks.js` — `useShapeMastery()`, `useShapeMasteryDecay()`, `useShapeMasterySignalComposition()`

**Route / entry points:**
- Settings → Shape Language → "Transparency / Skill Map" (primary entry; deep-linkable)
- [shape-language-study-home.md](./shape-language-study-home.md) footer link "Transparency" (when enrolled)
- [study-home.md](./study-home.md) transparency-footer "Skill data: Shape Language" link (when enrolled in any project)

**Last reviewed:** 2026-05-11

---

## Purpose

The Shape Language project's transparency screen — surfaces the full per-descriptor mastery state that the [shape-language-study-home.md](./shape-language-study-home.md) embed renders only summarized fragments of. Implements Gate 2 **red line #2 (full transparency)** as a binding surface: per-descriptor skill estimate, evidence list, signal composition (what makes up the posterior), and recovery affordances (unmute / recalibrate / reset).

This surface is the canonical "composition is always inspectable" anchor per [feedback_scf_learning_state_not_tier_rank.md](../../../C:/Users/chris/.claude/projects/C--Users-chris-OneDrive-Desktop-Claude-Poker-Tracker/memory/feedback_scf_learning_state_not_tier_rank.md). The owner has bound that the four signal weights (`W_leak`, `W_drill`, `W_test`, `W_recent`) must be inspectable; this is the surface where that inspection happens. SLS uses a 3-signal subset (`W_drill`, `W_recent`, plus `declared` as the separate Q4 axis); the future skillAssessment shared module will expose `W_leak` + `W_test` once those signal sources exist.

It is the second surface authored for SLS Gate 4 (after `shape-language-study-home.md`); the third remaining surface is [lesson-runner.md](./lesson-runner.md) (also SPR-074).

## JTBD served

Primary:
- `DS-47` — Skill map / mastery grid (**Proposed**) — this is the literal mastery grid
- **Red line #2 instantiation** — "always one tap away: per-descriptor skill estimate, evidence list, and next-lesson justification"

Secondary:
- `DS-46` — Spaced repetition (**Proposed**) — exposes `lastValidatedAt` per descriptor; user can decide what to recalibrate
- **Red line #3 instantiation** — durable override affordances (Recalibrate / Unmute per descriptor)
- **Red line #4 instantiation** — three-way reversibility surface (per-descriptor reset, global "Start fresh", incognito toggle status indicator)

## Personas served

Primary:
- [Chris (live player)](../personas/core/chris-live-player.md) in self-review mode — "what does the system think about my Shape Language right now?"
- [scholar-drills-only](../personas/core/scholar-drills-only.md) — checks composition before deciding what to drill next
- [study-block](../personas/situational/study-block.md) — sets up a study block by inspecting which descriptors decayed

Secondary:
- [post-session-chris](../personas/situational/post-session-chris.md) — opens after a session to see what shifted (read-only signal; no rendering shift fires from this surface)

---

## Anatomy

Single scrollable page. 10 descriptor rows in catalog order. Header + footer affordances.

```
+-------------------------------------------------------------+
| ← Settings / Shape Language                                 |
|                                                              |
| Shape Skill Map                       [Enrolled: 2026-04-02] |
|                                                              |
| Composition is always inspectable. Tap any row to expand     |
| signal sources and recovery actions.                         |
+-------------------------------------------------------------+
| Silhouette                                          ▾        |
|   posterior 7±3 (95% CI 4..10)      declared: known         |
|   last drill: 8 days ago            mute: none              |
|   ─────────────────────────────────                          |
|   Composition:                                              |
|     W_drill   0.50  → α=8 β=2 from 10 drills                |
|     W_recent  0.10  → 8d gap × decay profile = -0.12 weight |
|     declared  ★      → seeded "known" 2026-04-02 (Q7)       |
|     W_leak    —      → no leak data yet (signal not wired)  |
|     W_test    —      → no test data yet (signal not wired)  |
|   Last validation: 2026-05-03 (Saddle drill, 4/5 correct)   |
|   [Recalibrate]   [Mark as already known]                   |
+-------------------------------------------------------------+
| Saddle                                              ▸        |
|   posterior 5±4 (95% CI 1..9)       declared: —             |
|   last drill: 14 days ago           mute: none              |
+-------------------------------------------------------------+
| Spire                                               ▾        |
|   posterior 8±2 (95% CI 6..10)      declared: —             |
|   last drill: 30 days ago           mute: "already-known"   |
|   ─────────────────────────────────                          |
|   Composition: (same shape as Silhouette)                   |
|   [Unmute]   [Recalibrate]                                  |
+-------------------------------------------------------------+
| Ridgeline                                           ▸        |
|   posterior 6±3 (95% CI 3..9)       declared: —             |
|   last drill: never                 mute: none              |
+-------------------------------------------------------------+
| ... (6 more descriptors — Sankey, Basin, + 4 advanced)      |
+-------------------------------------------------------------+
|                                                              |
| Footer                                                       |
| Current incognito state: OFF (drill outcomes write)         |
| [Toggle incognito for next session]                         |
|                                                              |
| Danger zone                                                  |
| [Start fresh — reset all descriptors]                       |
| [Disenroll from Shape Language (data preserved)]            |
+-------------------------------------------------------------+
```

### Per-descriptor row anatomy

**Collapsed (default state):**
- Descriptor name (left, bold)
- One-line summary: `posterior {α/(α+β)}±{credible-interval-half-width}`, `declared: known | — | unknown`, `last drill: N days ago | never`, `mute: none | "already-known" | "not-interested"`
- Expand chevron (▾ / ▸) at right

**Expanded (tap to expand; persists until tap-collapse):**
- Composition block — four labeled signal rows:
  - `W_drill {weight}` → "α=N β=N from M drills" (data-derived; sourced from `posterior`)
  - `W_recent {weight}` → "{N}d gap × decay profile = {weight} adjustment" (data-derived; sourced from `applyTemporalDecay`)
  - `declared ★` → seeded source + date (declarative; sourced from `declaredLevel`)
  - `W_leak —` → "no leak data yet (signal not wired)" — placeholder until skillAssessment Phase B wires leak signal
  - `W_test —` → "no test data yet (signal not wired)" — placeholder until shape-opt-in-test surface exists
- Evidence row — most recent validation: "Last validation: {date} ({descriptor} drill, {correct}/{total} correct)"
- Action buttons:
  - If `userMuteState !== 'none'`: `[Unmute]`
  - Always: `[Recalibrate]`
  - If `declaredLevel === null` (no declaration yet): `[Mark as already known]`

### Footer affordances

- **Current incognito state line** — read-only display: "Current incognito state: ON | OFF". Sourced from session-scoped state.
- **Toggle incognito for next session** button — dispatches `TOGGLE_SESSION_INCOGNITO`. Tooltip: "Affects all drill writes in the next session. Reference mode is always incognito."
- **Danger zone block** — visually demoted (smaller text, neutral grey background):
  - `[Start fresh — reset all descriptors]` — dispatches `RESET_SHAPE_MASTERY` after confirm modal (Red line #4 — "global model reset")
  - `[Disenroll from Shape Language (data preserved)]` — dispatches `DISENROLL_SHAPE_MASTERY` after confirm modal; preserves data per I-SM-6

---

## State

- **Read from `shapeMastery` (via `useShapeMastery()` hook — see [shape-mastery.md](../contracts/shape-mastery.md)):** full slice. Re-renders on any descriptor mutation.
- **Read from `useShapeMasteryDecay(descriptorId, now?)`:** per-descriptor decay-adjusted posterior + `daysSinceValidated`. Computed at render; no decay write fires.
- **Read from `useShapeMasterySignalComposition(descriptorId)` (planned):** the per-descriptor composition breakdown (`{ W_drill, W_recent, declared, W_leak: null, W_test: null }`). Pure function over `DescriptorMastery` + `now`. Returns `null` for un-wired signals so the row can render the placeholder explicitly.
- **Read from session-scoped state:** `sessionIncognito: boolean` (header footer display).
- **Mutations dispatched:** `RECALIBRATE_DESCRIPTOR`, `UNMUTE_DESCRIPTOR`, `MUTE_DESCRIPTOR` (via "Mark as already known"), `TOGGLE_SESSION_INCOGNITO`, `RESET_SHAPE_MASTERY`, `DISENROLL_SHAPE_MASTERY`.
- **Mutations NOT dispatched from this surface:** `RECORD_DRILL_OUTCOME` (lesson-runner only); `SEED_DESCRIPTOR_DECLARATION` (enrollment journey only); `ENROLL_SHAPE_MASTERY` (enrollment journey only); decay writes (none exist per I-SM-2).
- **Environment assumptions:** `shapeMasteryReducer` mounted; `useShapeMastery` hook available; user is enrolled (`enrolled === true`) — surface is gated on enrollment per red line #1. If reached while not enrolled, route redirects to enrollment journey.

## Props / context contract

```
ShapeSkillMapPanel({})  // no props — reads from context

DescriptorRow({
  descriptorId: string,
  expanded: boolean,
  onToggleExpand: () => void,
})
  // Pure render of one row. State and dispatch flow through hooks at the
  // row level (not lifted) so re-renders are scoped per-descriptor.
```

## Key interactions

- **Tap row header (collapsed):** expands the row in place. No route change. State persists in surface-local `expanded` map (not in reducer — pure UI state).
- **Tap chevron (expanded):** collapses the row.
- **Tap `[Recalibrate]`:** opens confirm modal ("Reset this descriptor's data? You can drill it again to rebuild."). On confirm, dispatches `RECALIBRATE_DESCRIPTOR(descriptorId)`. Row re-renders with posterior `{alpha:1, beta:1}`, `declaredLevel: null`, `userMuteState: 'none'`, `lastValidatedAt: null`. Per I-SM-5: no implicit re-mute.
- **Tap `[Unmute]`:** dispatches `UNMUTE_DESCRIPTOR(descriptorId)` immediately (no confirm — per red line #3 "single tap", reversible). Row re-renders with `userMuteState: 'none'`.
- **Tap `[Mark as already known]`:** dispatches `MUTE_DESCRIPTOR(descriptorId, 'already-known')` + `SEED_DESCRIPTOR_DECLARATION` for this single descriptor with `declaredLevel='known'`. Row updates.
- **Tap `[Toggle incognito for next session]`:** dispatches `TOGGLE_SESSION_INCOGNITO`. Footer line updates.
- **Tap `[Start fresh]`:** opens confirm modal with explicit warning ("This resets all 10 descriptors. Drill data is lost. This cannot be undone."). On confirm, dispatches `RESET_SHAPE_MASTERY`. All rows re-render.
- **Tap `[Disenroll]`:** opens confirm modal ("You'll stop seeing the schedule and seeder. Your data is preserved and you can re-enroll any time."). On confirm, dispatches `DISENROLL_SHAPE_MASTERY`. Surface route redirects back to Settings index.

---

## Red-line compliance (this surface's slot in the SPR-074 conformance matrix)

| Red line | This surface's compliance | Enforcement |
|---|---|---|
| **#1 — Opt-in enrollment required** | Surface gated on `enrolled === true`. Route redirect to enrollment journey if reached while not enrolled. | **DOM-assert** (render test): when `enrolled === false`, `<Navigate to={enrollmentRoute} />` fires, no panel content renders. |
| **#2 — Full transparency** | This IS the transparency surface. Per-descriptor posterior + composition + evidence + decay all visible. | **DOM-assert**: render test asserts all 10 descriptor rows present + composition block renders for any expanded row. |
| **#3 — Durable override** | `[Recalibrate]` + `[Unmute]` + `[Mark as already known]` per descriptor; single-tap from row. No nag prompt re-asks about a muted descriptor. | **DOM-assert** + **CI-grep**: render test asserts buttons present per row; CI-grep forbids any string containing "are you sure you want to mute" / "still want to recalibrate" / similar nag patterns. |
| **#4 — Three-way reversibility** | Per-descriptor recalibrate (button per row); global "Start fresh" (footer); incognito toggle status + toggle (footer). All three present on this single surface. | **DOM-assert**: render test asserts `[Recalibrate]` × 10 + `[Start fresh]` + `[Toggle incognito for next session]` all present. |
| **#5 — No streaks/shame/engagement-pressure/notifications** | No streak counters; no "you missed N days" framing; no notifications emitted from this surface. Decay is rendered factually ("8 days ago"), not framed ("you've been slacking"). | **CI-grep**: forbidden strings list — `currentStreak`, `longestStreak`, `daysActive`, `consecutiveCorrectCount`, "you missed", "you've been", "streak", "keep your", "don't break". **DOM-assert**: render test asserts no element with `data-streak` or class matching `/streak/` exists in panel. |
| **#6 — Flat lesson index always accessible** | N/A for this surface (flat index lives in study-home). This surface does not gate access to lessons. | (N/A — covered by study-home conformance.) |
| **#7 — No gamified-infantile language** | Copy is editor's-note tone: "posterior 7±3", "last drill: 8 days ago", "Recalibrate", "Start fresh". No badges, celebrations, mascots, or emoji rewards. | **CI-grep**: forbidden strings list — "great job", "you've earned", "level up", "🎉", "🏆", "you're doing great", "keep it up". **DOM-assert**: render test asserts no `<img>` with badge-class + no emoji in any descriptor row body. |
| **#8 — No cross-surface contamination** | This surface reads `shapeMastery` only; never reads from or writes to LiveAdviceBar / SizingPresetsPanel / live-table state. | **CI-grep**: imports check — this surface's source file must not import from `src/components/views/TableView/**` or `src/components/views/OnlineView/**` or `src/utils/exploitEngine/**`. |
| **#9 — Mastery never displayed as a score** | Composition is broken out into W_drill + W_recent + declared (Q4 separation); no fused "mastery score: 0.65" rendering. Posterior shown as α/β + credible interval, not as a 0-1 score. Declared shown as `known | — | unknown`, not numerically. | **CI-grep**: forbidden strings — `masteryScore`, `fusedMastery`, `confidenceLevel`, `"your mastery: "`, `"your level: "`. **DOM-assert**: render test asserts both `declared` row and `W_drill` row visible in every expanded row (Q4 side-by-side). |

The matrix is per-surface; the aggregate test catalog lives at [`docs/design/audits/2026-05-11-sls-g4-redline-conformance.md`](../audits/2026-05-11-sls-g4-redline-conformance.md).

---

## Q4 separation-of-signals invariant — how this surface renders it

Per [shape-mastery.md](../contracts/shape-mastery.md) **I-SM-1** (Separation of signals), `declaredLevel` and `posterior` are independent state. This surface renders both side-by-side in every expanded row:

- **`W_drill`** row shows the data-derived posterior parameters (α, β, drill count).
- **`declared`** row shows the declarative signal (declared level + seed date).
- **No fused row.** No "overall mastery: 0.65" rendering. The user composes the picture from the parallel rows.

This is the canonical inspection target. If a future change wants to fuse the signals into a single number, it must update I-SM-1 first (which would require a new Gate 2 blind-spot roundtable per the contract's change protocol §4).

---

## Known behavior notes

- **Surface is read-heavy, write-rare.** Most interactions are inspections; only the row-action buttons + footer-action buttons dispatch.
- **Re-render scope.** Rows use per-descriptor selectors to minimize re-render fan-out — a `RECALIBRATE_DESCRIPTOR` on Silhouette does not re-render the Saddle row.
- **Decay is computed at render.** `useShapeMasteryDecay()` calls `applyTemporalDecay()` with current `Date.now()`. Per I-SM-2: no scheduled decay job, no decay-write action.
- **Confirm modals are the autonomy-affordance shape.** Destructive actions (`Recalibrate`, `Start fresh`, `Disenroll`) all confirm; reversible actions (`Unmute`, `Mark as already known`, `Toggle incognito`) do not. Per red line #3 ("single tap"), reversible affordances must be one-tap.
- **No "next-lesson justification" rendering.** Red line #2 mentions "next-lesson justification in one English sentence"; that rendering lives in the **Discover-mode body** of [shape-language-study-home.md](./shape-language-study-home.md) (the "Why: lowest confidence" line on the seeder card). This surface is the *transparency* half; the *justification* half lives on the surface where the recommendation fires.

## Known issues

None — design-only at Gate 4. Implementation surfaces bugs at Stream D code phase (`shapeMasteryReducer` + `useShapeMastery` hook + `applyTemporalDecay` math).

---

## Test coverage

- *Planned:* `src/components/views/SettingsView/ShapeSkillMapPanel/__tests__/ShapeSkillMapPanel.test.jsx` — 10 row render + footer affordance + enrollment gate.
- *Planned:* `src/components/views/SettingsView/ShapeSkillMapPanel/__tests__/DescriptorRow.test.jsx` — collapsed/expanded + per-button dispatch.
- *Planned:* `src/components/views/SettingsView/ShapeSkillMapPanel/__tests__/redlines.test.jsx` — DOM assertions per the red-line table above.
- *Planned:* `scripts/check-sls-redlines.cjs` — CI-grep boolean table (forbidden field names + forbidden copy strings); see [conformance audit](../audits/2026-05-11-sls-g4-redline-conformance.md) §enforcement.
- *Planned:* Visual verification at 1600×720 + portrait-native (per [feedback_portrait_mode_player_screens.md](../../../C:/Users/chris/.claude/projects/C--Users-chris-OneDrive-Desktop-Claude-Poker-Tracker/memory/feedback_portrait_mode_player_screens.md) — this is a Settings-routed surface so portrait-native may apply; defer to Stream D Gate 5 visual review).

---

## Cross-references

- [shape-mastery.md](../contracts/shape-mastery.md) — read/write API contract this surface consumes (writers: 6 of the 9 dispatch from here).
- [shape-language-study-home.md](./shape-language-study-home.md) — sibling surface; renders summary fragments + links here for full transparency.
- [study-home.md](./study-home.md) — grandparent surface; transparency-footer link points here.
- [lesson-runner.md](./lesson-runner.md) — sibling surface; the writer of `RECORD_DRILL_OUTCOME` that this surface's posterior column reflects.
- [shape-language-enrollment.md](../journeys/shape-language-enrollment.md) — enrollment journey; this surface gates on its completion.
- [`docs/projects/poker-shape-language/gate3-decision-memo.md`](../../projects/poker-shape-language/gate3-decision-memo.md) §Q4 verdict — separation-of-signals binding.
- [`docs/design/audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md`](../audits/2026-04-23-blindspot-shape-language-adaptive-seeding.md) §"eight red lines" — original source of red lines #1-#8.
- [`docs/design/audits/2026-05-11-sls-g4-redline-conformance.md`](../audits/2026-05-11-sls-g4-redline-conformance.md) — aggregate test catalog.

---

## Change log

- 2026-05-11 — Created at SPR-074 (Shape Language Gate 4 close-out, WS-180). Single-scrollable-page IA ratified upfront (D1=A). Implements red lines #2/#3/#4 as the canonical transparency surface; binds Q4 separation-of-signals rendering as DOM-assertable invariant; composition row reserves W_leak + W_test placeholders for skillAssessment Phase B wiring.
