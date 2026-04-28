# JTBD Domain — Cross-Cutting

Jobs that span multiple surfaces and don't belong to any one domain — undo, recovery, search, accessibility, notifications.

**Primary personas:** All.

**Surfaces:** every surface, via shared primitives (Toast, navigation, state recovery).

---

## CC-01 — Undo a recent destructive action

> When I take a reversible destructive action (clear seat, delete player), I want undo within a reasonable window, so misclicks don't cost data.

- Partial: retro-link undo is gold standard; clear-player lacks undo.

## CC-02 — Recover from app crash without data loss

> When the app crashes or reloads, I want my in-flight data (hand, session, draft) intact, so I continue without reconstruction.

- Partial: drafts covered; in-flight hand state recovery partial.

## CC-03 — Navigate views without losing in-progress input

> When I navigate between views, I want in-progress input (form fields, search queries) preserved, so navigation doesn't cost data.

## CC-76 — Instant undo with no confirmation for hot paths

> When I take a hot-path action (tap an action button), I want instant undo available for a few seconds, so speed wins over safety-rail friction.

## CC-77 — State recovery to exact position after crash

> When the app crashes mid-hand, I want state recovered to exactly where I was (current street, selected seat, pending action), so I don't re-enter.

## CC-78 — Unified search across hands / players / sessions

> When I search for anything, I want one search box that finds hands, players, and sessions, so I don't pick a tab first.

- State: **Proposed**.

## CC-79 — Navigation that returns to prior position

> When I drill from summary to detail and back, I want to return to exactly where I was in the summary, so deep-dives don't cost navigation tax.

## CC-80 — Configurable alerts / notifications

> When the app needs to alert me (tilt warning, session milestone, staker push), I want configurable channels, so I'm not spammed or missed.

- State: **Proposed**.

## CC-81 — Accessibility modes (color-blind, low-light)

> When I have color-vision limits or I'm in a dim card room, I want accessibility modes (color-blind-safe palette, low-light theme), so I can actually read the UI.

- State: **Proposed** (DISC-P01).

## CC-82 — Trust-the-sheet (lineage-stamped reference artifacts)

> When I look at a piece of content the app generated for me — whether a printed laminated card, an on-screen chart, or a range table — I want to know the numbers derive from a specific util + theory citation + assumption bundle, so I can rely on it with the same confidence I rely on live advice, and so I can audit the claim if I ever doubt it.

- State: **Active** (pending Printable Refresher Gate 4 + cross-project adoption for other reference surfaces over time).
- **Primary personas:** All study-inclined personas. Load-bearing for [Chris](../../personas/core/chris-live-player.md) (owner who directs the codebase and wants engine-refresher parity) and [Scholar](../../personas/core/scholar-drills-only.md) (lineage as trust-differentiator vs market competitors).
- **Autonomy constraint:** lineage is **mandatory**, not optional (red line #12 per Printable Refresher Gate 2 audit). No anonymous content. The 7-field lineage footer (card ID + version + generation date + source util path + engine version + theory citation + assumption bundle) is structural — cards that cannot produce a full footer fail CI and do not print.
- **Mechanism:**
  - Build-time static content: manifest snapshot of `sourceUtils[].contentHash` baked into artifact at build.
  - Runtime dynamic content: `paramFingerprint` (rake + stakes + stack snapshot) computed at render.
  - Both flow into unified lineage object; rendered as 2-line 9pt footer on print, as tap-to-expand drill-down in-app.
  - CI test (`contentDrift.test.js`, RT-108 pattern from EAL) recomputes hashes; mismatch without `schemaVersion` bump fails CI.
- **Served by:** `src/utils/printableRefresher/lineage.js` (PRF); analogous lineage pipelines in future projects that adopt the pattern.
- **Distinct from:**
  - **MH-12** (live-cited assumption trust bridge) — MH-12 is in-moment "why should I trust this claim?" for live advice; CC-82 is asset-level "where did this content come from?" for reference artifacts. Both inform trust; different time scales.
  - **DS-58** (validate-confidence-matches-experience) — DS-58 is calibration (predicted-vs-observed); CC-82 is provenance (what source generated this). A card can have correct lineage (CC-82 passes) and uncalibrated claim (DS-58 fails); they are separable dimensions.
- Doctrine basis: Printable Refresher Gate 2 audit §Stage E autonomy red line #12 + Voice 5 §D6 lineage pipeline spec; `docs/projects/printable-refresher.project.md` §Working principle #6 (lineage visible).

## CC-83 — Know-my-reference-is-stale (staleness surfacing for engine-derived artifacts)

> When the rake, range, theory-citation, or heuristic that an engine-derived artifact depends on has changed in the app since I last consumed the artifact (printed a card, screenshot-ted a chart, downloaded an export), I want the app to surface that staleness passively — so I know when to refresh without being nagged.

- State: **Active** (pending Printable Refresher Gate 4).
- **Primary personas:** Primary for [Chris](../../personas/core/chris-live-player.md) (owner accumulating printed artifacts over time); extends to any user who carries app-generated content outside the app.
- **Autonomy constraint:** staleness is **passive** (red line #10 per Printable Refresher Gate 2 audit). No push notifications, no app-icon badge, no "X days since re-print" nag counter, no urgent-banner patterns. Absence of refresh is not a failure state. Owner-controlled cadence — system surfaces, owner decides.
- **Mechanism:**
  - Owner stamps `printedAt` date at print time (per-batch; per-card inherited). Persisted in IDB `printBatches` store.
  - Each artifact in a batch snapshots `engineVersion` + `sourceHash` at consume time.
  - In-app per-artifact view computes diff: current engine output vs consume-time snapshot.
  - Shows: "No changes" / "Math unchanged; exception clause updated DATE" / "Stale: rake assumption changed DATE — refresh recommended."
  - Batch-level informational banner on refresher home (never interrupt, never badge).
- **Anti-nag guarantees:**
  - No push notifications.
  - No app-icon badge counter.
  - Owner can suppress per-artifact staleness flags durably (red line #13 inheritance).
  - "Reprint" / "refresh" is always a button, never a nag.
- **Served by:** `src/utils/printableRefresher/staleness.js` (PRF); analogous staleness-diff pipelines in future projects that adopt the pattern.
- **Distinct from:**
  - **CC-80** (configurable alerts / notifications) — CC-80 is opt-in push for transient events; CC-83 is passive surfacing of persistent-state drift. CC-83 default is no-channels-at-all; CC-80 requires an explicit channel choice.
  - **DS-52** (retention maintenance) — DS-52 is skill-decay over time; CC-83 is content-drift over time. DS-52 measures user state; CC-83 measures content state. Parallel concepts, different subjects.
- Doctrine basis: Printable Refresher Gate 2 audit §Stage E autonomy red line #10 + Voice 4 §Know-stale spec + Voice 5 §D7 content-drift CI; `docs/projects/printable-refresher.project.md` §Working principle #6 (lineage visible) + PRF-NEW-3 charter.

## CC-88 — Have the app observe my usage honestly and transparently

> When the app collects telemetry about my usage — which screens I visit, which features I use, how long I dwell, where I get frustrated — I want to know exactly what is collected and transmitted, to have a visible one-tap off-switch, and to be able to opt out per-event when I want to, so I'm never observed silently and never forced into a data-collection bargain I didn't understand.

- State: **Active** (pending Monetization & PMF Gate 4 + Q8 verdict for default behavior).
- **Primary personas:** All users. Acute for [Evaluator](../../personas/core/evaluator.md) (consent posture is load-bearing in first-run — the evaluator has not yet agreed to anything). Also [Chris](../../personas/core/chris-live-player.md) (owner directing the codebase; knows exactly what's tracked).
- **Autonomy constraint:** load-bearing for **red line #9** (incognito observation mode non-negotiable — inherited from `chris-live-player.md` §Autonomy constraint). Also binds red lines #1 (opt-in enrollment), #2 (full transparency on demand), #4 (reversibility).
- **Mechanism:**
  - First-launch transparency panel (Gate 4 surface `telemetry-consent-panel.md`) shows: what categories are collected (usage events, session replays, error tracking, feature flags), what is NOT collected (no PII, no poker-result dollar amounts, no hand-level content), and a one-tap off-switch per category.
  - Under Q8=B (opt-out with transparency — recommended starting position), default is on with panel always visible; user can turn any category off at any time.
  - Settings → Telemetry panel (always accessible in ≤2 taps) mirrors first-launch panel, allows reversibility at any time.
  - Per-event incognito toggle: any feature that writes a telemetry event can be used in an "incognito" mode that generates no telemetry record (parallel to the EAL Tier 0 observation capture incognito toggle — red line #9 structural pattern).
  - Anonymous ID by default; becomes identified only on account creation. Uninstalling or clearing IDB wipes the anonymous ID.
  - Telemetry transmission fails silently (no error surfacing to user) — missing data is not the user's problem to debug.
- **Anti-nag guarantees:**
  - No push notifications about telemetry state (red line #5).
  - No badge counter on telemetry settings.
  - No "turn telemetry back on" re-prompt after user has opted out.
  - Off-switch is always one tap away, never hidden behind confirmation dialogs ("Are you sure you want less data?" is forbidden copy).
- **Served by:** `surfaces/telemetry-consent-panel.md` (Gate 4); `src/utils/telemetry/` (Gate 5) wraps PostHog with the consent gating pattern.
- **Distinct from:**
  - **CC-80** (configurable alerts / notifications) — CC-80 is opt-in push channels for transient events; CC-88 is passive observation of usage behavior. Different data flow: CC-80 is app → user; CC-88 is user → app (silently, unless disclosed).
  - **CC-82** (trust-the-sheet / lineage) — CC-82 is content provenance (where did this artifact come from?); CC-88 is observation transparency (what data about me is being collected?). Both are trust-primitives; different subjects.
  - **CC-83** (know-my-reference-is-stale) — CC-83 is content-state drift surfacing; CC-88 is data-collection disclosure. Parallel patterns, different domains.
  - **SA-66** (transparent billing + easy pause) — SA-66 is billing transparency; CC-88 is data-collection transparency. Both inherit red line #2.
- Doctrine basis: Monetization & PMF Gate 2 audit §Stage E red line #9 + charter §Q8 telemetry consent default + `chris-live-player.md` §Autonomy constraint red line #9 (incognito observation mode non-negotiable — promoted to persona-level invariant 2026-04-24 by Exploit Anchor Library Gate 3). Inherits directly; applied to commerce-UX telemetry context.

## CC-87 — Tilt detection + break suggestion

> When my session behavior indicates tilt (variance spikes, stop-loss breaches, abnormal sizings), I want a nudge to take a break, so I save money.

- State: **Proposed** (DISC-01).

## CC-89 — Mixed-games framework (PLO / stud)

> When I play non-NLHE formats, I want the same framework support (ranges, exploits, drills), so I'm not locked to Hold'em.

- State: **Proposed** (DISC-17, deferred).

---

## Domain-wide constraints

- Undo windows vary by action risk — higher risk = longer window, more visible affordance.
- State recovery requires draft-store discipline applied consistently (see PEO-1).
- Accessibility touches every surface and can't be retrofit cheaply — bake into surface templates.

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-04-24 — Added CC-82 (trust-the-sheet / lineage-stamped reference artifacts) + CC-83 (know-my-reference-is-stale / staleness surfacing). Output of Gate 3 for Printable Refresher project. Both JTBDs are cross-project patterns (not PRF-specific) — other projects shipping engine-derived reference artifacts (Range Lab, Study Home, anchor-library cards, line-study sheets) inherit the same doctrine. See `docs/design/audits/2026-04-24-blindspot-printable-refresher.md` (Gate 2) + `docs/projects/printable-refresher.project.md` §Working principles #2 + #6.
- 2026-04-24 — Added CC-88 (have-the-app-observe-my-usage-honestly-and-transparently). Output of Gate 3 for Monetization & PMF project. Cross-project pattern — any future project installing telemetry, session replay, or usage tracking inherits the same consent-gating + incognito-per-event + off-switch-always-visible pattern (mirrors red line #9 from `chris-live-player.md` §Autonomy constraint, promoted to persona-level invariant by EAL Gate 3). Q8 owner verdict determines default behavior (opt-in vs opt-out-with-panel vs tier-dependent). See `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md` (Gate 2) + `docs/projects/monetization-and-pmf.project.md` §Q8.
