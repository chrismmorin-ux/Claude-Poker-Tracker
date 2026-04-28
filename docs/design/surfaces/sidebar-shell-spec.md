# Surface — Sidebar Shell Spec (Cross-Zone Design Language)

**ID:** `sidebar-shell-spec`
**Surface role:** **Cross-zone reference** — declares the shared visual + interaction vocabulary that single-zone artifacts (Z0, Z2, Z3, Z4) reference for concepts that recur across zones (status, freshness, confidence, affordance vocabulary, color semantics, density rhythm, attention budget). Not a renderable surface; an authoritative reference document.
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 (binding rules — R-1.5 affordance vocabulary [text amended 2026-04-28 to cite §IV], R-1.6 treatment-type consistency, R-1.7 staleness shape-class consistency, **R-1.8 freshness-mechanism declaration + INV-FRESH-1..5**, **R-1.9 color-token concept-class isolation + INV-TOKEN-1..5**, **R-1.10 affordance vocabulary + INV-AFFORD-1..5**, **R-1.11 status-vocabulary + INV-STATUS-1..5**)
- `docs/design/audits/2026-04-27-entry-sidebar-holistic-coherence.md` (Gate 1 — establishes the missing-artifact gap)
- `docs/design/audits/2026-04-27-blindspot-sidebar-holistic-coherence.md` (Gate 2 — Scope A locked; outside-lens findings)
- `docs/design/audits/2026-04-27-observation-sidebar-coherence-inventory.md` (Gate 3 — visual catalog + architectural mechanism map)
- `docs/design/evidence/2026-04-27-sidebar-coherence-baseline.md` (Gate 3 closer — three load-bearing findings indexed)
- `docs/design/personas/situational/sidebar-fluency-acquiring.md` (the persona this spec defends)
- `docs/design/jtbd/domains/cross-cutting.md` §CC-90 (system-recognition), §CC-91 (affordance vocabulary), §CC-92 (panel-blame), §CC-93 (trust-the-stack)
- Per-zone surfaces: `sidebar-zone-0.md`, `sidebar-zone-1.md`, `sidebar-zone-2.md`, `sidebar-zone-3.md`, `sidebar-zone-4.md`, `sidebar-zones-overview.md`

**Product line:** Sidebar (Scope A). Cross-product extension to main-app surfaces (`online-view.md`, `analysis-view.md`, `hand-plan-layer.md`, `bucket-ev-panel-v2.md`) staged as a follow-up after this spec ships.
**Tier placement:** All sidebar tiers (Pro, Sidebar-Lite). The shell spec is binding regardless of which features are gated.
**Status:** **PARTIAL** — §I + §II + §III + §IV + §V RESOLVED (V-2 owner-approved 2026-04-27, V-3 + V-color-tokens + V-affordance + V-status owner-approved 2026-04-28); §VI section remains SCAFFOLD pending V-density walkthrough. V-1 (color overhaul scope = (c) full discipline) locked; V-color-tokens operationalizes V-1 (c); V-affordance closes R-1.5 dangling SR-4-spec-index reference; V-status closes the last concept-class section. Doctrine v3 (R-1.6 + R-1.7) + v4 (R-1.8 + INV-FRESH-1..5) + v5 (R-1.9 + INV-TOKEN-1..5) + v6 (R-1.5 amendment + R-1.10 + INV-AFFORD-1..5) + v7 (R-1.11 + INV-STATUS-1..5) bind this spec. Originally authored as Gate 4 SCAFFOLD 2026-04-27.

---

## §0 Authoring status and how to read this document

This document is **partial** — section content fills in incrementally as owner-direction walkthroughs resolve each vocabulary decision. The section structure (§I–§VI) is fixed; vocabulary content per section is filled-in when its corresponding V-decision walkthrough closes.

**Resolved vocabulary:**
- **V-1 (color overhaul scope):** **(c) full color discipline** — every color is strictly one semantic concept-class; categorical hues (style chips) lose red/yellow/green, which are reserved for ordinal quality-tier signaling. Owner-approved 2026-04-27.
- **V-2 (confidence treatment unification):** **(c) dot + typographic ladder + (d) extracted `render-confidence.js` module + explicit `unknown` state + scope boundary (engine outputs only) + ordinal CSS naming.** Module path amended 2026-04-28 to `shared/render-confidence.js` per V-3.3. Owner-approved 2026-04-27 after 5-specialist roundtable. Vocabulary lives at §III.
- **V-3 (freshness vocabulary + mechanism coherence):** **5-tier register (live / aging / stale / unknown / rejected) + extracted `shared/render-staleness.js` module + per-signal declarative registry binding R-1.8 + INV-FRESH-1..5 behavioral invariants + F-8 distinguishing-badge resolution + V-2.4 conditional stale→confidence-unknown gate.** Sub-decisions V-3.1–V-3.5 all resolved long-term-aggressive. Owner-approved 2026-04-28 after 5-specialist roundtable + meta-direction strengthening. Vocabulary lives at §II. Required co-shipping: status-dot dual-writer resolution + 1Hz `adviceAgeBadge` R-2.3 compliance + `freshness-signal-registry.test.js` + `dom-mutation-discipline.test.js` extension. Doctrine v4 amendment (R-1.8) bundled.
- **V-color-tokens (color-token concept-class isolation):** **verbose-explicit concept-class-prefixed naming + Layer-1 primitive constants + Layer-2 semantic tokens (`Object.freeze`) + ordinal hex pool reservation (any ordinal signal consumes via concept-class-distinct CSS variable name) + categorical hue migration per V-1-safe table + STYLE_COLORS / STYLE_TOKENS consolidation (`design-tokens.js` canonical) + `shared/design-tokens.meta.js` companion + R-1.9 doctrine rule with INV-TOKEN-1..5.** Sub-decisions V-color.1–V-color.5 all resolved long-term-aggressive. Owner-approved 2026-04-28 after 5-specialist roundtable. Vocabulary lives at §V. **§II.2 + §III.3 amended** with token-binding citations. Required co-shipping: side-panel.html hex sweep (~46 sites) + `--m-*` rename across 51 sites + STYLE_COLORS re-export + meta file + deprecation alias mechanism + 24-fixture rebaseline + 3 new test files + `shared/tier-thresholds.js` extraction. Doctrine v5 amendment (R-1.9) bundled.
- **V-affordance (affordance vocabulary discipline, closes R-1.5 SR-4-spec-index):** **6-shape closed enumeration (chevron / underline / pill / circle / divider / decorative-glyph) + Class A/B distinction (visual-required vs spatial-convention licensed exception) + chevron direction RESOLVED via codebase verification (down=collapsed / up=expanded; existing CSS contract correct) + closed glyph registry of 4 (★ ♦ ● →) + `chip` sub-form for hand-plan branch labels (disambiguates pill double-use) + ARIA contract mandated per shape + extracted `shared/render-affordance.js` module + single delegated listener click-wiring pattern + R-1.10 doctrine rule with INV-AFFORD-1..5.** Sub-decisions V-afford.1–V-afford.5 all long-term-aggressive: V-afford.1 = 6 shapes (cto-agent's framing); V-afford.2 = R-1.5 amendment + R-1.10 NEW (failure-engineer's behavioral-invariants case under strengthened lens); V-afford.3 = deep-chevron rotation rule VERIFIED (line 1266 `transform: rotate(180deg)` exists; existing 9 sites in render-tiers.js are compliant); V-afford.4 = INV-AFFORD-4 grandfathered allowlist with milestone; V-afford.5 = long-press deferred to V-affordance v2. Owner-approved 2026-04-28 after 5-specialist roundtable. Vocabulary lives at §IV. **§V amended (cross-cutting)** with `--action-class-*` + `--affordance-*` concept-classes (without these, Gate 5 implementers reach for `--qtr-*` and recreate cross-concept collision). **R-1.5 text amended** to cite §IV explicitly (closes dangling reference). Required co-shipping: 8 items including click-wiring consolidation, `affordance-registry.test.js`, dom-mutation-discipline.test.js extension, hero seat-arc ring migration to non-color encoding, `render-orchestrator.js:147` `||` → `??` fix, `.show-toggle-btn` element-type fix, 4-chevron-class collapse to `.affordance-chevron`. Doctrine v6 amendment (R-1.5 text + R-1.10 NEW) bundled.

**Pending vocabulary** (sections remain SCAFFOLD):
- **§I status** — V-status walkthrough TBD. Includes status-dot ownership clarification (already locked in §II.4 boundary). Token entries for `--status-*` to be added under V-status.
- **§VI density rhythm + attention budget** — V-density / V-4 walkthroughs TBD.

Per the SHC working note in `memory/project_sidebar_holistic_coherence.md`: **doctrine v3 binds Stage 4 specs authored hereafter** but pre-existing zone artifacts (Z0, Z2, Z3, Z4) are *not* retroactively forced into compliance — remediation timing is a Gate 5 / backlog concern.

Per-zone artifact cross-references (§I §II §III §IV §V §VI) land when each section's vocabulary is resolved.

---

## §I — Status / connectivity / pipeline-health vocabulary

**Concept-class:** `status` — does the system have what it needs to deliver advice right now?

**Coverage:** Z0 connection-status dot (CC-A-1), Z0 app-status badge (CC-A-3), Z0 pipeline-health strip (CC-A-4), Z0 recovery banner (CC-A-5). Hand-count numeric (CC-A-2) deferred to §VI density typography (V-density walkthrough). Per Gate 3 inventory `2026-04-27-observation-sidebar-coherence-inventory.md` §CC-A + architectural findings A-A (5-writer at `#status-dot`, not 2 as originally documented) and A-B (CC-A-1 dot vs CC-A-4 strip can disagree silently under partial failure).

**Status:** **§I RESOLVED 2026-04-28** per owner approval of V-status roundtable synthesis. 5-specialist roundtable + strengthened long-term lens. All five V-status.1–V-status.5 sub-decisions resolved. Doctrine v7 amendment (R-1.11 + INV-STATUS-1..5) bundled. Implementation deferred to Gate 5.

### §I.1 — Three-axis decomposition (closed enumeration)

Status is decomposed into three orthogonal axes; each has its own state register, shape, DOM slot, and clearing path. Axes are **closed enumeration**; new axes require doctrine amendment.

| Axis | State register | Shape (R-1.7) | DOM slot | Source |
|---|---|---|---|---|
| **Connection state** | `live` / `degraded` / `disconnected` / `fatal` | dot | `#status-dot` | `connState.cause` (port-callback driven) |
| **App-bridge state** | `synced` / `absent` | badge (pill) | `#app-status` | `lastGoodExploits.appConnected` (exploit-push driven) |
| **Pipeline stage health** | per-stage binary `nominal` / `failed` | strip (5-stage row) | pipeline-strip element | `pipeline.tables[stage]` (pipeline-status-push driven; `!hasHands` visibility-gated) |

The **recovery banner** (CC-A-5) is NOT a §I shape vocabulary entry — it is an `emergency`-tier interruption per R-3.1, escalated when connection state = `fatal` OR `versionMismatch`. R-3 banner DOM at `side-panel.html:1660-1667` is outside `#hud-content`. R-1.11 binds: only fatal-tier connection state may trigger the banner; lower tiers cannot escalate without doctrine amendment.

### §I.2 — Connection-state register (4 values)

| State | Triggered when | Visual |
|---|---|---|
| `live` | `connState.cause === 'connected'` AND `tableCount > 0` AND `handCount > 0` | Green dot — V-1 reserved positive-tier hue (resolves to `--status-conn-live`) |
| `degraded` | `connState.cause === 'connected'` AND (`tableCount === 0` OR `handCount === 0`) — connected but waiting (table or hands); ALSO: `cause === 'disconnect'` (recoverable disconnect) | Yellow dot — V-1 reserved marginal-tier hue (resolves to `--status-conn-degraded`) |
| `disconnected` | (Reserved for explicit user-initiated disconnect; not currently triggered by codebase) | Yellow-orange dot — distinct from `degraded` — (resolves to `--status-conn-disconnected`) |
| `fatal` | `connState.cause === 'contextDead'` OR `connState.cause === 'versionMismatch'` (per V-status.4 — versionMismatch is fatal, not degraded) | Red dot — V-1 reserved negative-tier hue (resolves to `--status-conn-fatal`) + escalates to recovery banner |

**Connected-waiting timeout (per INV-STATUS-4):** when `tableCount > 0 && handCount === 0` persists for >30 seconds, state escalates from `degraded` → `connected-timeout` (a sub-state of `degraded`; emits distinct text "Tracking — no hands in 30s; reload may help" but stays yellow). Timer registered via `coordinator.scheduleTimer('connectedWaitingTimeout', ..., 30_000)` per RT-60.

### §I.3 — Per-axis declarative status registry

Every status signal in the sidebar declares the following tuple in this section's registry table. Stage 6 PR gate verifies the registry entry exists.

| Signal | Axis | Shape | Compute | clearedBy | Scope | Single writer |
|---|---|---|---|---|---|---|
| `connection-status` | connection | dot | `classifyStatus({connState, pipeline, handCount}).conn` | `connection:reestablished`, `connection:cause-change`, `staleContext-ack` (NOT staleContext mutation — staleContext dispatches into connState slot, doesn't write DOM directly) | `session` | `renderConnectionStatus()` in `side-panel.js` (consumes classifier output from `shared/render-status.js`) |
| `app-bridge-status` | app-bridge | badge | `classifyStatus({appConnected}).app` | `connection:appDisconnected`, `clearForTableSwitch`, `connection:appReconnected` | `session` | `renderAppStatusBadge()` in IIFE (consumes classifier output) |
| `pipeline-stage-health` | pipeline | strip | `classifyStatus({pipeline}).pipeline` | per-stage push events, `clearForTableSwitch` | `session` (visibility gated to `!hasHands`) | `renderPipelineStrip()` in IIFE (consumes classifier output) |

**Cross-section migration:** `connection-status` registry entry MOVES from §II.3 freshness registry to §I.3 status registry per §II.4 boundary clarification (V-status.4 default). §II.3 freshness registry retains advice-age + live-context-staleness entries only.

### §I.4 — CSS naming (3-axis sub-prefix per V-status.2)

```
.status-conn-live          → background: var(--status-conn-live)
.status-conn-degraded      → background: var(--status-conn-degraded)
.status-conn-disconnected  → background: var(--status-conn-disconnected)
.status-conn-fatal         → background: var(--status-conn-fatal)

.status-app-synced         → background: var(--status-app-synced)
.status-app-absent         → background: var(--status-app-absent)

.status-pipeline-nominal   → background: var(--status-pipeline-nominal)
.status-pipeline-failed    → background: var(--status-pipeline-failed)
```

Replaces today's color-literal modifiers (`'status-dot green'`, `'status-dot yellow'`, `'status-dot red'`, `'app-status connected'`, `.stage-dot.{green/yellow/red}`) — these are V-1 (c) violations per doctrine v6.

`'app-status connected'` CSS class also collides with port boolean `connected: true` (`side-panel.js:132`) — same word, two concept-classes. Renamed to `.status-app-synced` per §I.4 + V-affordance `data-affordance` attribute pattern.

### §I.5 — Single-writer enforcement (5 → 1 consolidation per INV-STATUS-1)

The architectural finding A-A from Gate 3 inventory documented "dual-writer race" between `buildStatusBar()` and `renderConnectionStatus()`. **V-status verification (cto-agent + senior-engineer + failure-engineer codebase reads) confirmed it is actually a 5-writer problem:**

| Site | What it writes | Disposition |
|---|---|---|
| `side-panel.js:206, :210, :213` (`renderConnectionStatus`) | `dot.className = 'status-dot {color}'` — declared owner per comment line 136 | **Becomes the sole writer** in IIFE; consumes classifier output from `shared/render-status.js`. |
| `side-panel.js:785-794` (`updateStatusBar` consuming `buildStatusBar` return) | applies `dotClass` from buildStatusBar | **REMOVED.** `buildStatusBar` becomes pure classifier returning data; never writes DOM. |
| `side-panel.js:1847-1848` (`renderAll` inline `staleContext` override) | `dot.className = 'status-dot yellow'` when `snap.staleContext && liveCtx` | **REMOVED — closes FM-STATUS-1 silent severity downgrade.** staleContext dispatches into connState slot via `coordinator.set('connState', {...staleContext: true})`; classifier composes the appropriate tier. |
| `side-panel.js:2590-2593` (`updateStatusFromDiag`) | direct DOM write from diag-status path | **REMOVED.** Migrate to dispatch into connState slot. |
| `harness.js:81` (test-fixture writer) | sets className via `applyState()` for fixture rendering | **GRANDFATHERED ALLOWLIST.** Test-fixture path is exempt per `dom-mutation-discipline.test.js` registry-allowlist convention (parallel to `affordance-registry.test.js` Class B exception list). |

**Comment at `side-panel.js:136` ("renderConnectionStatus owns all status-dot/status-text DOM writes") is currently documentary, not enforced.** R-1.11 INV-STATUS-1 + `dom-mutation-discipline.test.js` extension makes it lint-enforced.

### §I.6 — Severity monotonicity within a render frame (INV-STATUS-2)

**FM-STATUS-1 closure.** Within a single `renderAll` invocation, status severity may only INCREASE, never decrease. The current bug: at `side-panel.js`, `renderConnectionStatus` writes red (fatal) at line 1828; staleContext block at line 1846 then writes yellow (degraded) — silently downgrading a fatal condition to a warning.

**Implementation:** `renderStatusDot()` in `shared/render-status.js` accepts a severity ordinal {0=live, 1=degraded, 2=disconnected, 3=fatal} and takes the maximum across all classifier inputs before writing the DOM **exactly once per render**. Multiple status-dispatch events within a frame compose to the highest severity; no late-arriving lower-severity write can downgrade.

### §I.7 — No-lying-status (INV-STATUS-3)

**FM-STATUS-2 closure.** Every value in the closed enumeration of `connState.cause` MUST emit a defined dot class. Current code at `side-panel.js:215-217` sets text but NOT className for `versionMismatch`, leaving the dot at whatever color the prior frame painted.

**Implementation:** `classifyStatus()` is an exhaustive switch on `connState.cause` with no fall-through. Unrecognized cause values → `degraded` tier (yellow) explicitly. `versionMismatch` → `fatal` tier (red + recovery banner) per V-status.4 default.

Verification: a test iterates the cause enum and asserts non-null dotClass for each entry.

### §I.8 — Connected-waiting escalation (INV-STATUS-4)

**FM-STATUS-3 closure.** Today `tableCount > 0 && handCount === 0` shows yellow + "waiting for hands" forever; a silently broken WebSocket produces this state indefinitely.

**Implementation:** when `connState.cause === 'connected' && tableCount > 0 && handCount === 0` is entered, the coordinator schedules a 30-second timer (`connectedWaitingTimeout`). On timer fire, state transitions to `connected-timeout` (sub-state of `degraded`; same yellow tier, distinct text "Tracking — no hands in 30s; reload may help"). Timer cleared on first hand arriving OR on table-switch. Timer registered via `coordinator.scheduleTimer('connectedWaitingTimeout', fn, 30_000)` per RT-60 contract.

Threshold (30s) is configurable in §I but not hardcoded in doctrine.

### §I.9 — App-bridge staleness clearing (INV-STATUS-5)

**FM-STATUS-5 closure.** `lastGoodExploits.appConnected` stays `true` indefinitely if app crashes mid-session (only clearing event today is `clearForTableSwitch`).

**Implementation:** `STATE_FIELD_SCOPES.md` entry for `lastGoodExploits` extended to declare `connection:appDisconnected` clearing path alongside existing `clearForTableSwitch`. `connection:appDisconnected` event fires when port-bridge connection to main app drops (heartbeat timeout, port disconnect, etc.).

Companion: `dom-mutation-discipline.test.js` extension asserts every `lastGoodExploits` write site has at least 2 declared clearing events.

### §I.10 — Module ownership: `shared/render-status.js`

The status concept-class is owned by a single pure module: **`ignition-poker-tracker/shared/render-status.js`** (per V-3.3 / V-color-tokens.5 / V-affordance.7 `shared/` placement precedent for cross-product portability).

API contract:

```js
// Pure classifier — input → 3-axis state struct
classifyStatus({ connState, pipeline, handCount, appConnected, staleContext, now? }) → {
  conn: 'live' | 'degraded' | 'disconnected' | 'fatal',
  app: 'synced' | 'absent',
  pipeline: { probe, bridge, filter, port, panel },  // per-stage 'nominal' | 'failed'
  severityOrdinal: number,  // for INV-STATUS-2 monotonicity check
}

// HTML emission per axis
renderStatusDot(connTier, opts) → string       // single source for #status-dot HTML
renderAppStatusBadge(appTier, opts) → string   // single source for #app-status HTML
renderPipelineStrip(pipelineState, opts) → string  // 5-stage row; visibility-gated
```

**Pure module discipline** (per V-2 / V-3 / V-color-tokens / V-affordance precedent):
- No `Date.now()` reads inside the module — `now` is injected.
- No coordinator imports — state is injected as a typed struct.
- No `addEventListener` calls; no DOM mutation.
- HTML emission only; click-wiring stays in IIFE per V-affordance §IV.8 `data-affordance` pattern.

The IIFE writers (`renderConnectionStatus`, `renderAppStatusBadge` consumer, `renderPipelineStrip` consumer) consume the classifier output and write DOM. Per §I.5, consolidated to **one writer per slot**.

### §I.11 — ARIA contract (mandatory)

All §I status surfaces are non-interactive ambient indicators (per V-affordance INV-AFFORD-1 — they are NOT affordance shapes). However, they are live-updating regions; ARIA `role="status"` + `aria-live` is mandatory.

| Slot | Required ARIA |
|---|---|
| `#status-dot` (parent `.status-bar`) | `role="status"` + `aria-live="polite"` + `aria-label` updated per state (e.g., `"Connected — tracking 45 hands"`, `"Disconnected — reload required"`) |
| `#app-status` badge | `role="status"` + `aria-live="polite"` + `aria-label="App {synced|not open}"` |
| Pipeline-health strip | `role="status"` on the strip container; per-stage dots get `aria-label="BRIDGE: {nominal|failed}"` |
| Recovery banner | **`role="alert"` + `aria-live="assertive"`** (only `assertive` site in the sidebar — emergency-tier R-3.1 justifies it) + `aria-label="Critical: {cause}; reload required"` |

V-affordance INV-AFFORD-4 grandfathered allowlist does NOT apply here — status signals are non-interactive (no keyboard-reachability requirement), but live-region declaration is mandatory.

### §I.12 — Required co-shipping (Gate 5 prerequisites for INV-STATUS-1..5 enforcement)

**12 cleanups bundled with V-status because they are direct prerequisites for INV-STATUS-1..5 enforcement:**

1. **`shared/render-status.js` module authored** per §I.10 API contract.
2. **5 writer sites consolidated to 1** per §I.5 (writers REMOVED; `renderConnectionStatus` becomes sole writer; harness:81 grandfathered).
3. **`staleContext` inline override at `:1847-1848` REMOVED** (FM-STATUS-1 fix per INV-STATUS-2).
4. **`versionMismatch` dot-class assignment added at `:215-217`** (FM-STATUS-2 fix per INV-STATUS-3) — classified as `fatal` tier per V-status.4.
5. **`updateStatusFromDiag` at `:2590-2593` migrated to dispatch** into connState slot.
6. **`updateAppStatus` orphan migration** — currently bypasses render snapshot (direct DOM write from push handler at `:253-263`); routed through render snapshot like every other status surface.
7. **`--status-conn-*` + `--status-app-*` + `--status-pipeline-*` token entries** in `design-tokens.js` + meta file (per V-status.2 3-axis sub-prefix).
8. **New `_P.orange_status` Layer 1 primitive** distinct from `_P.orange_deep` (per V-status.3 default — avoids INV-TOKEN-2 collision with `--cat-style-lag-text` + `--m-zone-danger`).
9. **`status-registry.test.js`** authored — INV-STATUS-1..5 assertions + cause-enum exhaustiveness check.
10. **`dom-mutation-discipline.test.js` extension** — enumerates all 5 `#status-dot` writer sites + harness allowlist; INV-STATUS-1 single-writer enforcement.
11. **`STATE_FIELD_SCOPES.md` entry for `lastGoodExploits`** adds `connection:appDisconnected` clearing path (per INV-STATUS-5).
12. **ARIA contract authored per §I.11** — `role="status"` on status-bar + app-status; `role="alert"` on recovery banner; per-stage `aria-label` on pipeline strip.

**Plus INV-STATUS-4 timer:** `coordinator.scheduleTimer('connectedWaitingTimeout', fn, 30_000)` registration per RT-60 (per V-status.5 default — 30s configurable).

### §I.13 — Cross-cutting amendments

**§V cross-cutting amendment (V-status):** §V token registry extended with three concept-class sub-prefixes:
- `--status-conn-{live, degraded, disconnected, fatal}` (4 entries)
- `--status-app-{synced, absent}` (2 entries)
- `--status-pipeline-{nominal, failed}` (2 entries)

Plus new Layer 1 primitive `_P.orange_status` for `--status-app-absent` to avoid INV-TOKEN-2 collision per V-status.3. The `STATUS_AXES` meta file entry registers the 3-axis decomposition for automated registry-test.

**§II.3 cross-cutting:** `connection-status` row REMOVED from §II.3 freshness registry; MOVES to §I.3 status registry per §II.4 boundary (which already declared §I owns `#status-dot` exclusively). §II.3 retains `advice-age` + `live-context-staleness` only.

**§II.9 co-shipping #1 amendment:** "dual-writer resolution" updated to "5-writer consolidation" with explicit line numbers per §I.5.

### §I.14 — Forbidden patterns

Code paths that violate §I.1–§I.13 — flagged at code review and at automated lint via R-1.11 enforcement:

1. **Forbidden: any code path writing `#status-dot.className` outside `renderConnectionStatus()` in IIFE** (which consumes `shared/render-status.js` classifier output). INV-STATUS-1.
2. **Forbidden: severity-downgrading writes within a render frame.** A late-arriving `degraded` write must not overwrite an earlier `fatal` write. INV-STATUS-2.
3. **Forbidden: `connState.cause` switch without explicit handling for every enum value.** Unrecognized cause values default to `degraded` tier explicitly; never silently retain prior-frame class. INV-STATUS-3.
4. **Forbidden: `tableCount > 0 && handCount === 0` state without `connectedWaitingTimeout` timer registration.** INV-STATUS-4.
5. **Forbidden: `lastGoodExploits` write sites without complete clearing-event declaration in `STATE_FIELD_SCOPES.md`.** Must include both `clearForTableSwitch` AND `connection:appDisconnected`. INV-STATUS-5.
6. **Forbidden: color-literal CSS modifiers** (`'status-dot green'`, `'status-dot yellow'`, `'status-dot red'`, `'app-status connected'`, `.stage-dot.{green/yellow/red}`). Use ordinal CSS classes (`.status-conn-*`, `.status-app-*`, `.status-pipeline-*`) per §I.4. V-1 (c) compliance.
7. **Forbidden: app-bridge state writes that bypass the render snapshot** (current `updateAppStatus` direct DOM write at `:253-263` is the canonical existing violation; remediated by §I.12 co-shipping #6).
8. **Forbidden: recovery banner trigger without `connection:fatal` event.** Banner cannot escalate from `degraded` or `disconnected` tiers; only `fatal` (contextDead, versionMismatch). R-3.1 emergency-tier discipline.
9. **Forbidden: pipeline-strip rendering when `hasHands === true`.** Visibility gating is structural per CC-A-4 architectural mechanism; co-occurrence with §II freshness strip would create user-visible ambiguity.
10. **Forbidden: ARIA-less status indicators.** Every §I slot must have `role="status"` (or `role="alert"` for recovery banner) + `aria-live` declaration per §I.11.

### §I.15 — Cross-cutting boundaries

- **§I ↔ V-1 (c) full color discipline:** status surfaces consume `--status-conn-*` / `--status-app-*` / `--status-pipeline-*` tokens (V-color-tokens cross-cutting amendment §I.13). New `_P.orange_status` Layer 1 primitive prevents `_P.orange_deep` collision.
- **§I ↔ V-2 §III + V-3 §II:** §III confidence dot and §II freshness dots are NOT §I status indicators — different concept-classes. §I owns `#status-dot` exclusively per §II.4 boundary; freshness gets distinct DOM slots per zone (e.g., `#z2-freshness-dot`); confidence gets distinct DOM slots per zone (e.g., advice-bar inline). No DOM-slot sharing across concept-classes.
- **§I ↔ V-affordance §IV:** §I status indicators are NOT affordances. They have no click handlers; INV-AFFORD-1 vocabulary exclusivity does not apply. §IV INV-AFFORD-4 (keyboard reachability) does not apply (status is non-interactive). §I.11 ARIA contract is independent of §IV ARIA contract — both mandate roles per shape, but the role values differ (`role="status"` for §I ambient vs `role="button"` for §IV chevron/pill).
- **§I ↔ V-density (§VI, pending):** CC-A-2 hand count numeric is owned by §VI density typography (V-density walkthrough), not §I status. §I declares the boundary; §VI authors the typography/color treatment.
- **§I ↔ V-5 cross-product extension:** `shared/render-status.js` placement positions vocabulary for V-5 main-app surface extension. Mirror-lock test (V-color-tokens.5) enforces token parity for `--status-*` cross-product. Recovery banner pattern may extend to main-app shell-level error handling.

**Binding rules:** **R-1.11 (status-vocabulary discipline + INV-STATUS-1..5, doctrine v7)** + companion `status-registry.test.js` + `dom-mutation-discipline.test.js` extension (Gate 5).

---

## §II — Freshness / staleness vocabulary

**Concept-class:** `freshness` — how current is the data the user is looking at?

**Coverage:** Z2 stale-advice badge (CC-B-1); Z3 placeholder text (CC-B-3); Z2 cards-strip blanking on hand-end (CC-B-4); two-phase staleContext data-clearing timer (mechanism-only, surfaces via downstream renderers); plus future zones / cross-product surfaces (per V-3 forward-compat goal). Z0 connection-status dot (CC-B-2) belongs to §I status concept-class — see §II.4 boundary clarification.

**Status:** **§II RESOLVED 2026-04-28** per owner approval of V-3 roundtable synthesis. Roundtable evidence: 5 specialists (systems-architect, senior-engineer, cto-agent, failure-engineer, product-ux-engineer); convergence on extracted module + 5-tier register + declarative registry + R-1.8 doctrine binding. Owner-strengthened long-term lens (per `memory/feedback_long_term_over_transition.md` 2026-04-28 update) shifted defaults from "minimum v1 scope" to "long-term-correct architecture even if scope/complexity grows now." V-3.1–V-3.5 sub-decisions all resolved with the long-term-aggressive option. Implementation deferred to Gate 5.

### §II.1 — Five-tier state register

Freshness renders one of exactly five tiers:

| Tier | Triggered when | Visual |
|---|---|---|
| **`live`** | Data is current; no stale conditions met | No signal (absence is the signal) |
| **`aging`** | Data is current but elapsed-time threshold reached (e.g., 5s ≤ age < 10s for advice; soft-warning window) — caller-defined per-signal threshold | Dot in V-1 marginal-tier hue (state-derived; no counter; refreshed via render snapshot diff) |
| **`stale`** | Hard threshold exceeded OR irrecoverable street-mismatch OR 60-second `staleContext` flag fired (two-phase timer phase 1) | Badge with aging counter (timer-driven, `Stale Ns` / `Stale — recomputing` for advice-age; distinct text variant for `staleContext` 60-120s window per F-8 resolution — see §II.5) |
| **`unknown`** | `_receivedAt` is null/undefined (cold-start, post-120s clear) | Dot in V-1 neutral-tier hue (parallel to `conf-tier-unknown`; no counter) |
| **`rejected`** | System rejected an incoming push (RT-68 advice rejection; RT-69 `_pendingAdvice` clear; SW reanimation replay rejection) — observable to coordinator via the rejection event | Dot in V-1 negative-tier hue + brief inline text marker (e.g., `payload rejected`) |

**Why 5 tiers, not 3 or 4** (V-3.5 owner-approved long-term lens):
- `unknown` distinguishes "data missing entirely" from `low`-tier-of-something-else — same architectural reason V-2 separated `unknown` from `low` for confidence (silent-failure protection).
- `rejected` distinguishes "system actively rejected an incoming payload" from "data never arrived." RT-68/69 SW-replay rejection is observable to the coordinator; collapsing it to `unknown` hides exactly the failure mode the user needs to diagnose. Without `rejected`, the user sees `unknown` indistinguishable between "boot-cold-start," "120-second-timeout," and "system just rejected a stale payload." The diagnostics link can resolve on demand, but the visual signal must surface the distinction at glance time.
- `between-hands` is **not** a tier. The `IDLE` / `COMPLETE` FSM states are state-derived absence-of-data; they're served by Z3 placeholder text (`buildActionBarHTML()` `render-orchestrator.js:293-298`), which is the §I/§II boundary case — the placeholder text exists in Z3 but is a *zone-state* indicator, not a freshness signal. See §II.4.

### §II.2 — CSS naming

Freshness uses **ordinal-named CSS classes**, parallel to §III's `conf-tier-*` convention:

```
.fresh-tier-live      → no DOM element rendered; class reserved for tests
.fresh-tier-aging     → background: var(--fresh-tier-aging)
.fresh-tier-stale     → background: var(--fresh-tier-stale)
.fresh-tier-unknown   → background: var(--fresh-tier-unknown)
.fresh-tier-rejected  → background: var(--fresh-tier-rejected) (distinguishing visual modifier per §II.1)
```

Independent CSS class scheme from `conf-tier-*` even though they resolve to overlapping V-1 hex pool. Per INV-TOKEN-2 concept-class exclusivity (R-1.9 doctrine v5): same hex is OK at the Layer-1 primitive level, but each concept-class gets its own CSS variable name so future hex divergence is local.

**Token binding (amended 2026-04-28, V-color-tokens):** the `--fresh-tier-*` tokens are declared in `ignition-poker-tracker/shared/design-tokens.js` per V-color-tokens §V.3 + §V.6. They alias to the Layer-1 quality-tier hex pool (`#4ade80` / `#fbbf24` / `#f87171`) + neutral grey for unknown. `--fresh-tier-rejected` resolves to negative-tier hex with a distinguishing visual modifier per §II.1 (e.g., dot + brief inline text marker) per INV-FRESH-5.

### §II.3 — Per-signal declarative registry (R-1.8 binding)

Every freshness signal in the sidebar declares the following tuple in this section's registry table. Stage 6 PR gate verifies the registry entry exists before merging.

| Signal name | Shape | Mechanism | Compute | clearedBy | Scope | Coordinator timer |
|---|---|---|---|---|---|---|
| `advice-age` | `badge` | `timer-driven-aging` | `classifyFreshness(advice, liveCtx, coordState)` (advice branch) | `advice:fresh`, `hand:new`, `table:switch` | `perHand` | `adviceAgeBadge` (1Hz interval) |
| `advice-aging-dot` | `dot` | `state-derived-per-render` | `classifyFreshness(advice, liveCtx, coordState)` returns `aging` (5–10s window) | rendered with each `scheduleRender` cycle; cleared when `live` tier returns | `perHand` | (none — render-time derived) |
| `live-context-staleness` | `badge` (variant text per F-8) | `data-clearing-timer` | Two-phase timer at `side-panel.js:536-548`; 60s sets `staleContext=true`; 120s nulls `currentLiveContext` | `live-context:fresh`, `table:switch` | `perTable` | `staleContext` (10s polling) |
| `connection-status` | `dot` | `state-event-driven` | `connState.cause === 'disconnect' \| 'contextDead' \| 'versionMismatch'` (§I owns this) | `connection:reestablished` | `session` | (none — event-driven) |
| `placeholder-banner` | (not a freshness signal — see §II.4) | — | — | — | — | — |

**Registry growth path:** New zones / new freshness sources add rows to this table. Append-only; existing rows do not change without a doctrine-amendment-level review (because R-1.8 binds Stage 4 specs to the registry).

**Mechanism enumeration** (R-1.8 closed set):
- `state-event-driven` — fires on a coordinator event (`connection:reestablished`, `hand:new`, etc.); no timer.
- `timer-driven-aging` — fires on a `coordinator.scheduleTimer` registration; uses elapsed-time crossing a threshold.
- `state-derived-per-render` — derived freshly on every `scheduleRender` cycle from current state; no internal timer or memory.
- `data-clearing-timer` — a `coordinator.scheduleTimer` registration whose primary effect is to null/clear coordinator state, surfacing visually only via downstream renderers reading the cleared state.

Adding a new mechanism class requires a doctrine amendment (extension of R-1.8's enumeration via §11).

### §II.4 — Boundary clarification (§II vs §I status, §II vs zone-state)

**Z0 connection-status dot belongs to §I status, not §II freshness.**

The Z0 `#status-dot` indicates connectivity-class state (`connState.cause`), not data-currency. When the sidebar disconnects, the user's recovery action is "reconnect" (via the recovery banner / "Reload Ignition Page" button), not "wait for fresh data." This is a §I status concept-class concern. Today's code at `side-panel.js:212-214` setting `dot.className = 'status-dot yellow'` for `cause === 'disconnect'` is correctly classified as status (V-1 reserved marginal-tier hue means "connectivity warning" in §I context).

**`#status-dot` is owned exclusively by §I.** §II freshness signals get **distinct DOM slots per zone** (e.g., `#z2-freshness-dot`, `#z3-freshness-dot`, `#z4-freshness-dot`). This resolves the V-3 architectural finding A-A (status-dot dual-writer race between `buildStatusBar()` `render-orchestrator.js:1324` and `renderConnectionStatus()` `side-panel.js:198-218`) by collapsing the writer set to one. **INV-FRESH-4 (R-1.8) lint-enforces single-writer per slot via `dom-mutation-discipline.test.js`.**

**Placeholder banner ("Waiting for next deal…", "Analyzing…") is a zone-state indicator, NOT a freshness signal.** It marks Z3's *absence-of-active-decision-content* (FSM state `IDLE` / `COMPLETE` / `!hasAdvice`). Per R-1.7, it does not need to use one of `{dot, badge, strip}` shape-classes because it is not a freshness signal — it is the placeholder *content* of a zone whose decision content is unavailable. Tracked under §I zone-state vocabulary (V-status walkthrough, pending).

### §II.5 — F-8 disambiguation (stale-was-live vs clean-between-hands)

**Resolution: option (b) — distinguishing badge text.** Per V-3 roundtable + owner long-term lens.

When the two-phase `staleContext` timer fires its 60-second phase (`coordinator.set('staleContext', true)` at `side-panel.js:546`), the `live-context-staleness` signal renders a `stale`-tier badge with **distinct text content**: `Session paused — last data Nm ago` (or similar; exact copy under V-2.4-style copy-discipline review at Gate 5). This distinguishes from the `advice-age` `stale` badge (which renders `Stale Ns` / `Stale — recomputing`).

Same shape-class (badge); different text content per registry entry. Zero new shape-class required; R-1.7 satisfied.

**Clean between-hands** (`live.state === 'COMPLETE' \|\| 'IDLE'`) renders as Z3 placeholder text only — no freshness badge fires, because no freshness signal is in `stale` or `unknown` tier (the data was correctly delivered and the hand correctly ended). This matches §II.4's classification of placeholder banner as zone-state, not freshness.

Failure case the resolution prevents: a user inactive for 90 seconds sees the same screen as a clean between-hands state, makes a decision based on prior-hand advice from t=0 (computed against now-irrelevant board), without realizing the system's last context was 90 seconds old. The distinguishing badge text surfaces this state at glance time.

### §II.6 — V-2.4 carry-forward (stale-advice → confidence interaction)

**Resolution: conditional gate.** Per V-3 roundtable synthesis (3 of 5 specialists explicitly: systems-architect, senior-engineer, failure-engineer; product-ux-engineer concurred without aging-caveat; cto-agent dissented but minority).

When `classifyFreshness()` returns:
- `stale` or `rejected` or `unknown` → caller passes `null` modelQuality to `render-confidence.js`, which renders `conf-tier-unknown` (grey dot) regardless of `mq.overallSource`.
- `aging` or `live` → caller passes `advice.modelQuality` unchanged; confidence renders at its actual tier.

**Why `stale` corrupts confidence but `aging` doesn't:** `stale` indicates the underlying decision context has likely changed (hard threshold exceeded OR street-mismatch); the engine's prior confidence assertion is no longer applicable. `aging` indicates elapsed time but data still likely valid (still on-street, recoverable). Conditional preserves the legitimate information cto-agent flagged while protecting against the failure-engineer scenario where a stale green dot misleads despite an adjacent stale badge.

**Implementation contract:** `render-staleness.js` exports a composed helper:

```js
renderConfidenceForFreshness(advice, freshnessTier) → string
  // Internally calls render-confidence.js's classifyConfidence + renderConfidenceBadge,
  // but pre-clears modelQuality to null when freshnessTier ∈ { 'stale', 'rejected', 'unknown' }.
```

Single call site for the gate; prevents divergence between callers per failure-engineer Q4. Both modules import from `shared/`; the helper lives in `render-staleness.js` because its conditional logic is freshness-driven.

### §II.7 — Structural ownership: `render-staleness.js` module

The freshness-treatment vocabulary is owned by a single pure module: **`ignition-poker-tracker/shared/render-staleness.js`** (per V-3.3 owner-approved long-term lens — `shared/` placement now, not `side-panel/` then relocate later).

**V-2 §III.6 amendment:** `render-confidence.js` likewise relocates from `ignition-poker-tracker/side-panel/render-confidence.js` to `ignition-poker-tracker/shared/render-confidence.js` for symmetry. V-2 was spec-only at amendment time (no Gate 5 code shipped); relocation is one path-string change in §III.6 + change-log note. See §III change-log entry 2026-04-28.

API contract:

```js
// Pure classifier — input → tier label
classifyFreshness(advice, liveCtx, coordinatorState, now?) →
  'live' | 'aging' | 'stale' | 'unknown' | 'rejected'

// HTML fragments per shape-class
renderFreshnessDot(tier, opts?) → string
renderFreshnessBadge(tier, ageMs?, reasonHint?, opts?) → string
renderFreshnessStrip(zoneState) → string

// Composed cross-module helper (V-2.4 carry-forward gate)
renderConfidenceForFreshness(advice, freshnessTier) → string
```

**Pure module discipline** (per V-2 precedent):
- No `Date.now()` reads inside the module — `now` is injected. Tests pass any value; production callers pass `Date.now()`.
- No coordinator imports — `coordinatorState` is injected as a struct.
- No `scheduleTimer` calls — timer ownership stays in the impure IIFE (`side-panel.js`); the module classifies and renders only.

Architectural rationale (per V-3 roundtable, 4 of 5 specialists): cto-agent's dissent (freshness is fundamentally coordinator-state-derivation) is addressed by the explicit injection contract — the module doesn't reach for state, it receives state. This preserves the pure/impure split + makes the module unit-testable in isolation + enables cross-product portability (V-5 forward-compat).

Module placement at `shared/` (NOT `side-panel/`): per V-3.3 owner long-term lens. Cross-product extension (V-5, deferred) will need `online-view.md`, `analysis-view.md`, etc. to import the same vocabulary; placing the module in `side-panel/` and relocating later means import-path churn across every consumer. Doing it once now eliminates a future evolution.

### §II.8 — Behavioral invariants (R-1.8 INV-FRESH-1..5)

R-1.8's five invariants are repeated here for spec-author convenience; the doctrine version is authoritative.

- **INV-FRESH-1 (Scope ownership).** Every signal's `scope` field matches a `STATE_FIELD_SCOPES.md` entry of the same scope. Lint-enforced via `freshness-signal-registry.test.js`.
- **INV-FRESH-2 (Single clearing path per scope).** `perHand` clears at `hand:new`; `perTable` clears in `clearForTableSwitch`; `session` clears on connection events. No ad-hoc clearing.
- **INV-FRESH-3 (Same-frame commit).** Clearing events update all in-scope signals in the same render frame; no deferred writes.
- **INV-FRESH-4 (Non-competing writers).** Each signal's DOM slot has exactly one writer. Status-dot dual-writer is the canonical existing violation; resolved by §II.4 boundary clarification + co-shipping.
- **INV-FRESH-5 (Rejection is visible).** RT-68/69 SW-replay rejection surfaces as `rejected` tier (per §II.1), distinct from `unknown`.

### §II.9 — Required co-shipping (Gate 5 prerequisites for R-1.8 enforcement)

Two cleanups bundled with V-3 because they are **direct prerequisites for INV-FRESH-4 enforcement** — without them, R-1.8's lint test fails on the first run:

**Co-shipping item 1 — Status-dot dual-writer resolution.** Today `#status-dot` is written by both `buildStatusBar()` `render-orchestrator.js:1324` (status-bar render path) and `renderConnectionStatus()` `side-panel.js:198-218` (connection-callback path). §II.4 assigns sole ownership to §I status. Implementation: `buildStatusBar()` returns `{dotClass, text}` consumed by `renderConnectionStatus()` only; no other site writes `dot.className`. Lint-test (`dom-mutation-discipline.test.js`) extended to assert no other write site exists for `#status-dot`.

**Co-shipping item 2 — 1Hz adviceAgeBadge timer R-2.3 compliance.** Today the 1Hz timer at `side-panel.js:1093-1099` directly calls `updateStaleAdviceBadge()` which mutates DOM via `actionBarEl.querySelector('.stale-badge')` — an R-2.3 violation (DOM mutation outside FSM transition handler). Implementation: timer fires `coordinator.dispatch('adviceAgeBadge', 'tick')`; FSM transition handler updates a coordinator state slot; render path reads the slot via `scheduleRender`. Routes the mutation through the standard render pipeline so R-2.3 enforcer + change-detection + table-switch lifecycle all apply.

**Co-shipping infrastructure (also Gate 5):**
- New test file `freshness-signal-registry.test.js` (parallel to `state-clear-symmetry.test.js`). Parses §II.3 registry table; asserts each signal has matching `coordinator.scheduleTimer` registration (when timer-driven) + matching `STATE_FIELD_SCOPES.md` entry + unique single writer.
- Extension of `dom-mutation-discipline.test.js` to enforce INV-FRESH-4 single-writer per slot (or new file if discipline test doesn't yet exist).
- `STATE_FIELD_SCOPES.md` entries for `staleContext` (`perTable`) and any new freshness-state slots introduced by V-3 implementation.

### §II.10 — Forbidden patterns

Code paths that violate §II.1–§II.8 — flagged at code review and (when feasible) at automated lint via R-1.8 enforcement:

1. **Forbidden: inline `Date.now() - x._receivedAt` outside `render-staleness.js`.** Use `classifyFreshness()` from the module. The same architectural reason as §III.7 forbidden #1 (single source of truth for classification).
2. **Forbidden: raw `setInterval` / `setTimeout` in any freshness path.** All timers route through `coordinator.scheduleTimer` per RT-60. Raw timers are guaranteed clearing-asymmetry candidates and are the M6 / M7 pattern from `SIDEBAR_REBUILD_PROGRAM.md`.
3. **Forbidden: a freshness signal that uses none of `{dot, badge, strip}`.** Per R-1.7 shape-class consistency. Plain floating text, opacity-as-staleness, motion-as-staleness, icon-as-staleness — all violations.
4. **Forbidden: adding a freshness signal without a registry entry in §II.3.** Stage 6 PR gate fails; `freshness-signal-registry.test.js` fails.
5. **Forbidden: collapsing `unknown` into `live` (or `between-hands` into `unknown`, or `rejected` into `unknown`).** The current code at `side-panel.js:1059` (`if (!advice?._receivedAt) return { isStale: false }`) is the canonical existing violation: missing `_receivedAt` silently passes as non-stale. Remediated by R-1.8 + §II.1 five-tier register.
6. **Forbidden: sharing a CSS class between `fresh-tier-*` and `conf-tier-*`** (e.g., a single `tier-mid` class used by both). Per §II.2: same V-1 hue at the design-token level, separate CSS classes at the concept-class level. Prevents inadvertent restyle drift.
7. **Forbidden: applying freshness vocabulary to the §I status concept-class** (or vice versa). `renderConnectionStatus()` is §I; `classifyFreshness()` is §II. Crossing the boundary is V-1 violation + §II.4 boundary violation.
8. **Forbidden: DOM mutation outside the FSM transition handler / R-2.3.** The 1Hz `adviceAgeBadge` timer at `side-panel.js:1093-1099` is the canonical existing violation; remediated by §II.9 co-shipping item 2.
9. **Forbidden: multi-writer DOM slots for freshness signals.** Status-dot dual-writer is the canonical existing violation; remediated by §II.9 co-shipping item 1. Lint-enforced by `dom-mutation-discipline.test.js`.
10. **Forbidden: confidence rendered without freshness gate when `freshnessTier ∈ { 'stale', 'rejected', 'unknown' }`.** Use `renderConfidenceForFreshness()` composed helper from `render-staleness.js`. Direct calls to `renderConfidenceBadge()` are permitted only when freshness is known to be `live` or `aging`.

### §II.11 — Cross-cutting boundaries (V-3 ↔ adjacent sections)

- **V-3 ↔ V-2 (§III confidence):** §II.6 V-2.4 carry-forward gate composed at the `render-staleness.js` layer; `render-confidence.js` stays pure of freshness knowledge. Both modules at `shared/` per V-3.3.
- **V-3 ↔ §I status:** §II.4 establishes the boundary (status owns connectivity; freshness owns data-currency). Status-dot dual-writer resolution (§II.9 co-shipping #1) is technically a §I implementation detail but is co-shipped with V-3 because INV-FRESH-4 enforcement requires it.
- **V-3 ↔ §V color tokens:** `fresh-tier-*` CSS classes resolve to V-1-reserved hues. Per V-1 (c) full color discipline, the current `trust-marginal` / `trust-value` / `trust-negative` tokens are overloaded; §V will rename them when its walkthrough lands. §II is forward-compatible with whichever token-rename scope §V adopts.
- **V-3 ↔ V-5 (cross-product extension):** `render-staleness.js` placement at `shared/` is V-5-aware. When V-5 walkthrough authorizes main-app extension, no module relocation is needed; main-app surfaces import from the same path.

**Binding rules:** R-1.7 (staleness shape-class consistency, doctrine v3) + **R-1.8 (freshness-mechanism declaration + INV-FRESH-1..5, doctrine v4)** + companion `freshness-signal-registry.test.js` lint test (Gate 5).

---

## §III — Confidence / sample-size / model-quality vocabulary

**Concept-class:** `confidence` — how much should the user trust the engine output?

**Coverage:** Z2 unified header confidence dot, Z2 context strip (currently uses opacity — to be removed per scope boundary below), Z4 glance-confidence dot+label, Z3 stat-chip sample suffix (per inventory §CC-C).

**Status:** **§III RESOLVED 2026-04-27** per owner approval of V-2 roundtable synthesis. Roundtable evidence: 5 specialists (systems-architect, senior-engineer, cto-agent, failure-engineer, product-ux-engineer); convergence on (c)+(d) hybrid + explicit `unknown` state + scope boundary. Implementation deferred to Gate 5.

### §III.1 — Visual treatment

The canonical confidence-treatment vocabulary is **dot + typographic ladder**:

- **Dot** — small colored dot, ordinal quality tier. The recognition channel.
- **Typographic ladder** — sample count rendered in a distinct meta-stat typographic register (smaller font, lighter weight, muted color), visually separated from the data value the dot is paired with. The quantitative-discrimination channel.
- **Opacity-as-confidence is forbidden.** The current Z2 context-strip pattern (`conf-player`/`conf-mixed`/`conf-population` opacity classes at `render-orchestrator.js:441-470`) is removed entirely.

This is the **only** confidence treatment in the sidebar. R-1.6 binds: any cross-zone re-occurrence of the confidence concept-class re-uses this treatment.

### §III.2 — Four-state register

Confidence renders one of exactly four tiers:

| Tier | Triggered when | Visual |
|---|---|---|
| **`high`** | `advice.modelQuality.overallSource === 'player_model'` | Green dot — V-1 reserved positive-tier hue |
| **`medium`** | `advice.modelQuality.overallSource === 'mixed'` | Yellow dot — V-1 reserved marginal-tier hue |
| **`low`** | `advice.modelQuality.overallSource === 'population'` (engine asserts low confidence — population fallback) | Red dot — V-1 reserved negative-tier hue |
| **`unknown`** | `advice.modelQuality == null` OR `advice.modelQuality.overallSource == null` (no engine assertion at all) | Grey dot (neutral; distinct from `low`) |

**`unknown` is first-class, not a fallback.** It distinguishes "engine asserts low confidence" (`low`) from "engine payload never arrived / data missing" (`unknown`). The current code silently collapses `unknown` to `low` (`mq?.overallSource ===` ternaries fall through to `red` when `mq` is undefined) — this conflation is the single-largest silent-failure risk identified by the failure-engineer specialist pass.

### §III.3 — CSS naming

Confidence uses **ordinal-named CSS classes**, not color-literal modifiers:

```
.conf-tier-high      → background: var(--conf-tier-high)
.conf-tier-mid       → background: var(--conf-tier-mid)
.conf-tier-low       → background: var(--conf-tier-low)
.conf-tier-unknown   → background: var(--conf-tier-unknown)
```

Replaces today's `confidence-dot green/yellow/red` (color-literal modifier) and `conf-player/conf-mixed/conf-population` (mechanism-specific naming). Ordinal naming makes V-1 (c) full-color-discipline enforceable: a search for color-literal modifiers (`green`, `yellow`, `red`) yields only legitimate uses; future contributors cannot accidentally bypass the tier-class scheme.

**Token binding (amended 2026-04-28, V-color-tokens):** the `--conf-tier-*` tokens are declared in `ignition-poker-tracker/shared/design-tokens.js` per V-color-tokens §V.3. They alias to the Layer-1 quality-tier hex pool (`#4ade80` / `#fbbf24` / `#f87171`) + neutral grey for unknown, but resolve via concept-class-distinct CSS variable names (per INV-TOKEN-2 concept-class exclusivity). The deprecated `--trust-marginal/value/negative` tokens are removed in the same Gate 5 wave that wires up `render-confidence.js` (no remaining render-site references).

### §III.4 — Sample-count semantics

The dot and the sample count are **two distinct upstream concepts**, intentionally rendered with different syntactic forms:

| Pairing | Adjacent text form | Source upstream |
|---|---|---|
| Confidence dot + model-training sample | `n=N` (e.g., `n=45`) | `advice.villainSampleSize` (sample backing the engine's `overallSource` decision) |
| Stat chip raw observation count (no dot) | `Nh` (e.g., `45h`) | `cachedSeatStats[*].sampleSize` (cumulative observations for that seat) |

**Two forms are intentional, not a violation of Finding F-6 lexical inconsistency.** The forms communicate different concepts:
- `n=N` asserts "the engine's confidence tier is computed from a model trained on N observations."
- `Nh` asserts "this player has been observed in N hands."

These can be displayed side-by-side without contradiction; they answer different questions. Stat-chip raw counts use no dot because there is no `overallSource` equivalent — the tier-coded confidence treatment requires an `overallSource` value to encode.

### §III.5 — Scope boundary (what confidence applies to)

The confidence dot applies **only to engine model outputs** whose epistemic uncertainty is governed by `advice.modelQuality.overallSource`. This includes:

- The recommendation itself (`advice.recommendations[0].action`, EV)
- `advice.foldPct.bet` and similar engine-derived probabilities
- Villain headline / villain profile assertions

The confidence dot **does NOT apply to** mathematically exact derived values:

- Equity (`advice.heroEquity`) — exact given hand state, not sampled
- Pot odds — exact arithmetic from current bet + pot
- SPR (`advice.treeMetadata.spr`) — exact arithmetic from current stack + pot
- Card display, hero-folded indicator, board state

The Z2 context strip's current treatment of equity / pot odds / SPR with `conf-*` opacity classes (`render-orchestrator.js:450, 462, 465`) is removed in Gate 5. Equity and pot odds render at full opacity always. The confidence dot moves to the recommendation surface, where it belongs.

This resolves senior-engineer specialist's sharp insight: *"Fading a 73% equity figure because the villain model is population-level is semantically wrong: the equity computation confidence is about the model, not about the arithmetic."*

If a future signal needs a "this entire panel's data is degraded" treatment (e.g., during connection loss or stale-context timeout), that is a **different concept-class** (panel-degraded, possibly a strip per R-1.7 shape-class enumeration) — it is not the confidence vocabulary and must not reuse this treatment.

### §III.6 — Structural ownership: `render-confidence.js` module

The confidence-treatment vocabulary is owned by a single pure module: **`ignition-poker-tracker/shared/render-confidence.js`** (new file in `shared/`, alongside `design-tokens.js` and `stats-engine.js`).

**Path amendment (2026-04-28):** Originally specified at `ignition-poker-tracker/side-panel/render-confidence.js` when V-2 was resolved 2026-04-27. Relocated to `shared/` 2026-04-28 per V-3.3 owner long-term lens (cross-product portability — main-app surfaces import the same vocabulary without relocation churn at V-5). V-2 was spec-only at amendment time (no Gate 5 code shipped); relocation is one path-string change.

API contract:

```js
// Pure classifier — input → tier label
classifyConfidence(modelQuality) → 'high' | 'medium' | 'low' | 'unknown'

// HTML fragment for the dot only
renderConfidenceDot(modelQuality, opts?) → string

// HTML fragment for the sample-count typographic register only
renderConfidenceLabel(sampleSize) → string

// Combined dot + label
renderConfidenceBadge(modelQuality, sampleSize, opts?) → string
```

All three current D-1 sites — `render-orchestrator.js:150-169`, `:441-470`, `render-tiers.js:67-74` — become single-line delegations to this module in Gate 5. Z4 stat-chip raw `Nh` rendering does NOT consume this module (different concept per §III.4).

The module is unit-testable in isolation (pure function, no DOM dependencies); zone-level tests delegate confidence-structure assertions to its tests rather than asserting on rendered HTML substrings.

Module placement rationale (decided at owner level over the systems-architect / senior-engineer / cto-agent open question): a **dedicated module** rather than adding to `render-utils.js`, because:
- `render-utils.js` is DOM-utilities (`escapeHtml`, `$`); confidence is a domain primitive (knows about `overallSource` semantics).
- Mixing them would increase fan-in on `render-utils.js`.
- `render-confidence.js` becomes the established pattern for future cross-zone primitives (e.g., `render-staleness.js` for §II shape-class enumeration; `render-affordance.js` for §IV vocabulary).

### §III.7 — Forbidden patterns

Code paths that violate §III.1–§III.6 — flagged at code review and (when feasible) at automated lint:

1. **Forbidden: inline `mq?.overallSource ===` ternaries.** Any new render function that classifies confidence from `overallSource` outside `render-confidence.js` is a violation. Use `classifyConfidence(modelQuality)` from the module.
2. **Forbidden: `confidence-dot green` / `confidence-dot yellow` / `confidence-dot red` color-literal CSS classes.** Use `conf-tier-high` / `conf-tier-mid` / `conf-tier-low` / `conf-tier-unknown` ordinal classes.
3. **Forbidden: `conf-player` / `conf-mixed` / `conf-population` opacity classes.** The opacity treatment is removed; use the dot vocabulary instead. CSS classes are deleted from `side-panel.html` in Gate 5.
4. **Forbidden: applying `.conf-tier-*` classes to mathematically exact values** (equity %, pot odds %, SPR). Confidence applies only to engine model outputs per §III.5.
5. **Forbidden: collapsing `unknown` into `low`.** Treat null/undefined `modelQuality` or `overallSource` as `unknown` (grey dot); do NOT default to `low` (red dot).
6. **Forbidden: silently substituting one sample upstream for another** (e.g., `(pinnedData?.sampleSize) || advice.villainSampleSize` at `render-orchestrator.js:147` — uses `||` not `??`, so `0` falls through to the wrong source). Pre-existing bug surfaced by failure-engineer; logged here for Gate 5 awareness.

Future contributors (or future-me): if you find yourself wanting to inline a `mq?.overallSource ===` ternary, the answer is to extend `render-confidence.js` instead. If the existing API doesn't fit your case, the right move is to extend the module's signature, not to duplicate the classification logic at a new site.

### §III.8 — Cross-cutting boundaries (V-2 ↔ V-3, V-2 ↔ §V color)

- **V-2 ↔ V-3 (stale-advice → confidence interaction):** When `computeAdviceStaleness()` (`side-panel.js:1058-1066`) flags advice as stale, should the confidence helper render `unknown` regardless of `mq.overallSource`? failure-engineer specialist proposed yes. **Deferred to V-3 walkthrough.** §III.6's API supports either choice (caller can pre-clear `modelQuality` to null when stale before calling the helper); §III's vocabulary doesn't pre-commit. V-3 will resolve.
- **V-2 ↔ §V color:** §III's `.conf-tier-*` classes resolve via CSS to V-1-reserved hues. Per V-1 (c) full color discipline (owner approved), the current `trust-marginal` / `trust-value` / `trust-negative` token names are overloaded across confidence + action + EV semantics. §V will rename these (or split them) so the CSS binding for `.conf-tier-high` reads from a confidence-specific token rather than a multi-purpose `trust-*` token. §III is forward-compatible with whichever token-rename scope §V adopts.

**Binding rules:** R-1.6 (treatment-type consistency — confidence is always the dot+label vocabulary). Doctrine §1 R-1.6 amended in Gate 5 to cite this section as the authoritative declaration of the confidence treatment-type (currently R-1.6 cites D-1 forensics; the shell-spec citation comes when implementation lands).

---

## §IV — Affordance vocabulary (drill-down + interaction)

**Concept-class:** `affordance` — how does the user know what's clickable, what tapping it will do, and what's not interactive?

**Coverage:** Every interactive element + every visual signal of interactivity-or-non-interactivity in the sidebar. Closes R-1.5's dangling "SR-4 spec index" reference (per doctrine v6 amendment 2026-04-28). Includes chevron expand/collapse sections, navigation underlines, action-recommendation pills, spatial-convention click-to-pin circles, structural dividers, and registry-managed decorative glyphs (CC-D-1..D-10 + Cross-cutting Findings F-5/F-6/F-7 from Gate 3 inventory).

**Status:** **§IV RESOLVED 2026-04-28** per owner approval of V-affordance roundtable synthesis. 5-specialist roundtable + strengthened long-term lens. All five V-afford.1–V-afford.5 sub-decisions resolved. Doctrine v6 amendment (R-1.5 text + R-1.10 + INV-AFFORD-1..5) bundled. Implementation deferred to Gate 5.

### §IV.1 — Closed-vocabulary enumeration (6 shapes)

The licensed affordance vocabulary is **exactly 6 shapes**, closed enumeration. New shapes require doctrine amendment via §11. Each shape declares **one canonical interaction outcome** (R-1.10 INV-AFFORD-1 vocabulary exclusivity).

| Shape | Class | Canonical interaction | Visual encoding |
|---|---|---|---|
| `chevron` | A (visual-affordance-required) | In-place expand/collapse via `.open` rotation | `▾` glyph + 180° rotation per `.open` CSS class (`.affordance-chevron.open { transform: rotate(180deg); }`) |
| `underline` | A | Cross-zone navigation (open external surface OR change view) | Native `<a href>` element, OR `role="link"` if non-anchor element |
| `pill` | A | Click-action / commit / filter (CALL/BET/RAISE/FOLD recommendations; range-tab filter) | Rounded full-button form factor, ≥44×44 hit area, hover/active states |
| `circle` | B (spatial-convention licensed exception) | Click-to-pin (seat-arc; range-tab) | Circular ring with `cursor: pointer` + `:hover` scale-up; **no separate signpost** — the circular shape + spatial position IS the affordance |
| `divider` | — (non-affordance) | NO interaction; structural separator only | `<hr>` or styled border, never click target |
| `decorative-glyph` | — (non-affordance) | NO interaction; semantic categorical tag | Registry-managed Unicode codepoint per §IV.5 |

**Class A** — visible-affordance-required. Default for all interactive elements.

**Class B** — spatial-convention licensed exception. **Closed list of 2** (seat-arc circle + range-tab pill via `.villain-tab[data-range-seat]`). Future stat-chip pin (CC-D-6 successor) requires doctrine amendment to extend Class B list. Hit-area ≥44×44px commitment + first-tap tooltip ("Tap to pin Seat N", once per session, no dismissal required) mandated.

**Forbidden combinations:** mixed affordance shapes on one element (chevron + underline on same header is over-signposting); pill shape used for non-action semantics (use `chip` per §IV.5 for hand-plan branch labels); chevron in any orientation other than vertical (per INV-AFFORD-3).

### §IV.2 — Per-shape interaction outcome (binding contract)

Each shape declares **exactly one canonical interaction outcome**. Same shape with different outcome at different sites = INV-AFFORD-1 violation.

- `chevron` → toggle expansion of the section it visually parents. In-place per R-1.3 (zone footprint stable; expansion grows the slot, not adjacent slots). Glyph rotates 180° on `.open`; click = toggle.
- `underline` → cross-zone navigation. Click = navigate to a distinct view OR open a secondary surface. Never expansion in-place.
- `pill` → click-action / commit. Click = execute the action the pill labels. Never expansion or navigation.
- `circle` → toggle pinned state on the entity the circle represents (seat / villain). Click = toggle pin; aria-pressed reflects pin state.
- `divider` → NO click handler. CSS `pointer-events: none` if any descendant has handlers.
- `decorative-glyph` → NO click handler. `aria-hidden="true"`.

**Tap-target rule (per V-afford default):** the tap target is the **full row or full element**, not the chevron glyph alone. A chevron at 12px right-aligned is below the 44×44 minimum. Wrapping only the glyph in `<button>` is forbidden; wrap the full header row instead.

### §IV.3 — Chevron direction (Q3 RESOLVED via codebase verification)

**Direction convention:** `▾` (down-pointing) at collapsed; `▴` (up-pointing, via 180° rotation) at expanded.

This is **the existing-correct contract in the codebase.** Verified at `side-panel.html:544, 613, 1240, 1266` — all four CSS class definitions implement uniform `.{class}.open { transform: rotate(180deg); }`. Plus `render-tiers.js:424,455,478,520,552,577,607,624,653` consistently emit `▾` glyphs. The Gate 3 inventory CC-D-1 vs CC-D-2 "chevron direction inconsistency" finding was observational drift in static rendering, not real CSS divergence — V-afford.3 verification (2026-04-28) confirmed.

§IV declares the existing-correct contract to make it enforceable: any future render function emitting `▸` / `▹` / `▻` outside `render-affordance.js` exception slots is a spec violation. INV-AFFORD-3 lint-enforces.

### §IV.4 — Drill-down expansion location

Default: **in-place** per R-1.3 / R-1.5. Expansion grows the slot's footprint inside the fixed zone; adjacent slots do not shift.

**Declared exceptions registry** (closed list; new exceptions require doctrine amendment):

| Site | Expansion behavior | Rationale |
|---|---|---|
| Seat-arc circle click | Pinned-villain context renders into existing Z2 slot (re-bind, not new DOM) | "In-place via re-targeting" — slot identity preserved |
| `show diagnostics` / `show tournament log` underline | Expand footer-area panel that already exists in DOM | Underline = navigation semantic; footer-area panel below user's eye-flow |

**Forbidden:** modal expansions, popover overlays that obscure other zones, navigation-away that loses the user's place. Modal escape hatches require doctrine amendment to add to the registry.

### §IV.5 — Decorative-glyph closed registry

Closed enumeration of **4 licensed glyphs**, lint-enforced. New glyphs require doctrine amendment to extend the registry.

| Glyph | Codepoint | Semantic | Permitted zones |
|---|---|---|---|
| ★ | U+2605 | Hero seat indicator | Z1 seat-arc only |
| ♦ | U+2666 | Blocker emphasis | Z3 hand-plan / blocker annotations |
| ● | U+25CF | Weakness / severity bullet | Z3 weakness annotations only |
| → | U+2192 | Hand-plan branch connector | Z3 hand-plan only ("If CALL → Barrel favorable turns") |

**Hand-plan branch labels** ("If CALL", "If RAISE") are classified as **`chip`** sub-form of `decorative-glyph` (semantic categorical tag) — NOT `pill`. This disambiguates the pill double-use (action-button vs branch label) surfaced by product-ux-engineer specialist. `chip` is non-interactive; pill is click-action only.

**Card-suit glyphs** (♥/♦/♣/♠) are content, not affordance, and are explicitly carved out as a separate registry in `render-utils.js` `SUIT_DISPLAY` / `SUIT_CLASS`. They are not subject to §IV decorative-glyph rules.

**Hero seat identification (cross-cutting amendment from V-1 (c)):** the ★ glyph is the canonical hero indicator. The currently-coexisting colored seat-arc ring style (gold ring around hero seat) migrates to non-color encoding (distinct ring weight) at Gate 5 — color is reserved for ordinal quality-tier per V-1 (c); hero-vs-villain is categorical, not ordinal.

**Forbidden:** any Unicode glyph codepoint outside the registry table appearing in render-function output. INV-AFFORD-1 + glyph-codepoint scan in `affordance-registry.test.js` lint-enforces.

### §IV.6 — ARIA contract (mandatory per shape)

§IV mandates ARIA mappings per shape — not deferred to per-element-spec. Without doctrine-level binding, contributors choose ARIA inconsistently (today: only 1 `aria-expanded` site in the entire codebase at `side-panel.html:1692`).

| Shape | Required ARIA |
|---|---|
| `chevron` | `role="button"` (if not native `<button>`); `aria-expanded="true\|false"` synced to `.open` class; `aria-controls="[expansion-slot-id]"` pointing to the expanded panel |
| `underline` | Native `<a href>` element preferred. If non-anchor: `role="link"` + `tabindex="0"` |
| `pill` | `role="button"` (if not native `<button>`); `aria-label` required when label is icon-only or ambiguous; `aria-disabled="true"` when advice is stale |
| `circle` | `role="button"`; `aria-pressed="true\|false"` for pin state; `aria-label="Pin Seat N as primary villain"` |
| `divider` | `role="separator"` OR CSS `border` with no role (if purely decorative) |
| `decorative-glyph` | `aria-hidden="true"` (semantic meaning carried by adjacent text label) |

ARIA contract is **mandatory at doctrine level** (R-1.10 INV-AFFORD-4 keyboard reachability). Per-element specs may extend with site-specific labels but cannot omit the role/state attributes.

### §IV.7 — Structural ownership: `render-affordance.js` module

The affordance vocabulary is owned by a single pure module: **`ignition-poker-tracker/shared/render-affordance.js`** (per V-3.3 / V-color-tokens.5 `shared/` placement precedent for cross-product portability).

API contract:

```js
// Shape classifier — input → vocabulary entry
classifyAffordance(elementKind, state) →
  'chevron' | 'underline' | 'pill' | 'circle' | 'divider' | 'decorative-glyph'

// Interactive shape emission (Class A + B)
renderChevron(opts: { isOpen: bool, controlsId: string, label: string }) → string
renderUnderlineLink(text: string, targetId: string, opts?) → string
renderActionPill(label: string, tokenClass: string, opts?) → string
renderSpatialCircle(seat: number, opts: { isPinned: bool, label: string }) → string

// Non-affordance emission
renderDecorativeGlyph(glyphKey: 'HERO' | 'BLOCKER' | 'WEAKNESS' | 'BRANCH_ARROW', opts?) → string  // throws if glyphKey not in registry
renderChip(label: string, opts?) → string  // semantic categorical tag (e.g., "If CALL" branch label)
renderDivider(opts?) → string

// Registry constant
DECORATIVE_GLYPHS = Object.freeze({
  HERO: '★', BLOCKER: '♦', WEAKNESS: '●', BRANCH_ARROW: '→',
});
```

**Pure module discipline** (per V-2 / V-3 / V-color-tokens precedent):
- No `Date.now()` reads inside the module.
- No coordinator imports.
- No `addEventListener` calls.
- HTML emission only; click-wiring stays in IIFE per §IV.8.

Module placement at `shared/` (NOT `side-panel/`) per V-3.3 / V-color-tokens.5 owner-approved long-term lens — cross-product extension (V-5) imports the same vocabulary without relocation churn.

### §IV.8 — Click-wiring discipline (single delegated listener)

Today's codebase has 3 coexisting click-wiring patterns:
- Direct `addEventListener` × 5 sites (`side-panel.js:1214, 1297, 1373, 159` + others).
- Document delegation × 2 sites (`side-panel.js:1583, 1774`).
- `bar.onclick` direct assignment × 1 outlier (`side-panel.js:669`).

§IV mandates **single delegated listener pattern**:
1. `render-affordance.js` HTML emission includes `data-affordance="{shape}"` + `data-affordance-target="{handler-key}"` attributes on every interactive element.
2. ONE delegated listener in `side-panel.js` IIFE: `document.addEventListener('click', handleAffordanceClick)` — reads `data-affordance` + `data-affordance-target` attributes from event target's closest matching ancestor; dispatches to a registered handler keyed by `data-affordance-target`.
3. Handlers register via `registerAffordanceHandler('handler-key', fn)` — single registry table in the IIFE.

**Side benefits:**
- Handler-on-detached-element race eliminated. Document-rooted delegation survives `scheduleRender` rebuilds (the regression structural-guarantee surfaced by failure-engineer specialist for V-3 co-shipping).
- 5+ separate `addEventListener` sites + document delegations + outliers consolidate to 1 pattern.
- `.show-toggle-btn` element-type bug (`<button>` with navigate semantics) fixed: migrate to `<a>` or `role="link"` per §IV.6 ARIA contract.

### §IV.9 — Behavioral invariants (R-1.10 INV-AFFORD-1..5)

R-1.10's five invariants are repeated here for spec-author convenience; the doctrine version is authoritative.

- **INV-AFFORD-1 (Vocabulary exclusivity).** Every interactive element bears exactly one §IV affordance. Lint-enforced via `affordance-registry.test.js`.
- **INV-AFFORD-2 (No lying affordances).** Every visible affordance has reachable handler in current FSM state. Lint-enforced via `dom-mutation-discipline.test.js` extension.
- **INV-AFFORD-3 (Direction consistency).** Chevron always vertical (▾ collapsed / ▴ expanded). Glyph-codepoint scan blocks `▸/▹/▻` outside exception slots.
- **INV-AFFORD-4 (Keyboard reachability).** Native interactive elements OR `role="button"` + `tabindex="0"` + `keydown(Enter|Space)` companion. **Grandfathered allowlist** for current interactive `<div>` elements without keyboard wiring; explicit Gate 5 milestone for full compliance.
- **INV-AFFORD-5 (Dot-shape concept-class exclusivity).** Selection / pin / active-state affordances NEVER use filled dots in quality-tier hue palette (`#4ade80`, `#fbbf24`, `#f87171`, `#9ca3af`). Reserved for §II freshness + §III confidence per INV-TOKEN-2.

### §IV.10 — Required co-shipping (Gate 5 prerequisites for INV-AFFORD-1..5 enforcement)

Eight cleanups bundled with V-affordance because they are direct prerequisites for INV-AFFORD-1..5 enforcement:

1. **`shared/render-affordance.js` module authored** per §IV.7 API contract.
2. **4 parallel chevron CSS classes collapsed** to one `.affordance-chevron` (resolves D-4 forensics): `.pp-chevron`, `.tourney-bar-chevron`, `.collapsible-chevron`, `.deep-chevron` → unified.
3. **Click-wiring consolidation** per §IV.8: 5+ separate `addEventListener` sites + document delegations + `bar.onclick` outlier → single delegated listener via `data-affordance` attributes. **MUST ship before V-3 implementation** to prevent the handler-on-detached-element race surfaced by failure-engineer.
4. **`affordance-registry.test.js`** authored — INV-AFFORD-1, INV-AFFORD-3 (glyph-codepoint scan), and ARIA-coverage assertions.
5. **`dom-mutation-discipline.test.js` extension** — INV-AFFORD-2 (handler-reachability) + INV-AFFORD-4 (keyboard-reachability with grandfathered allowlist).
6. **`.show-toggle-btn` element-type fix** — `<button>` with navigate semantics → `<a href>` or `role="link"`.
7. **`render-orchestrator.js:147` `||` → `??` fix** — pinned-villain sample-size substitution bug (already in §III.7 forbidden pattern #6).
8. **Hero seat-arc ring migration** — color → distinct ring weight encoding (V-1 (c) compliance; canonical hero indicator is ★ glyph per §IV.5).

### §IV.11 — Cross-cutting amendments (V-color-tokens §V)

§IV's pill + chevron + underline shapes need color tokens that V-color-tokens did not declare. **§V cross-cutting amendment (2026-04-28):**

- New concept-class **`--action-class-*`**: `--action-class-call-{bg,text,base}`, `--action-class-bet-{bg,text,base}`, `--action-class-raise-{bg,text,base}`, `--action-class-fold-{bg,text,base}` — for action-recommendation pill coloring (CALL/BET/RAISE/FOLD). Categorical concept-class (action type), not ordinal (quality tier). Hex split from `--qtr-*` per V-color-tokens INV-TOKEN-2 concept-exclusivity.
- New concept-class **`--affordance-*`**: `--affordance-chevron-{base,active,muted}`, `--affordance-underline-{base,active,muted}`, `--affordance-pill-{base,hover,disabled}` — for affordance color states. Resolves to `--text-faint` / `--text-muted` / `--surface-elevated` Layer-1 primitives per concept-class isolation.

Without these entries, Gate 5 V-affordance implementers reach for `--qtr-*` tokens (recreating cross-concept collision V-color-tokens was designed to fix) or hardcode hex (INV-TOKEN-1 violation).

§V change-log entry to be added when these tokens land at Gate 5; meta-file (`shared/design-tokens.meta.js`) extended with action-class + affordance concept-class entries.

### §IV.12 — Forbidden patterns

Code paths that violate §IV.1–§IV.11 — flagged at code review and at automated lint via R-1.10 enforcement:

1. **Forbidden: inline chevron glyphs (`▾/▴/▸/▹/▻`) outside `render-affordance.js`.** Use `renderChevron()` helper. INV-AFFORD-3.
2. **Forbidden: token names without §IV vocabulary class.** No `cursor: pointer` CSS rule on elements that lack a registered affordance class. INV-AFFORD-1 + INV-AFFORD-2.
3. **Forbidden: visible affordance with no handler.** `role="button"` / `cursor: pointer` / underline on elements with no registered handler in current FSM state. INV-AFFORD-2.
4. **Forbidden: multi-affordance per element.** Chevron + underline on the same header is over-signposting. INV-AFFORD-1.
5. **Forbidden: filled-dot affordances in quality-tier hue palette.** Selection/pin state cannot use `border-radius:50%` + solid background in `--qtr-*` colors. INV-AFFORD-5.
6. **Forbidden: pill shape for non-action semantics.** Hand-plan branch labels use `chip` per §IV.5 (decorative-glyph sub-form). Pill is click-action only.
7. **Forbidden: glyphs outside the §IV.5 closed registry.** `affordance-registry.test.js` glyph-codepoint scan blocks new Unicode in render-function output.
8. **Forbidden: `<button>` element used for navigate semantics.** Migrate to `<a href>` or `role="link"` (canonical violation: `.show-toggle-btn` at `side-panel.html:1532`).
9. **Forbidden: `addEventListener` on element-by-element basis after V-affordance Gate 5.** Single delegated listener pattern per §IV.8. Existing call sites grandfathered until consolidation ships.
10. **Forbidden: 12px tap-target.** Tap target is full row/element, not chevron glyph alone. ≥44×44px hit area.

### §IV.13 — Cross-cutting boundaries

- **§IV ↔ V-1 (c) full color discipline:** affordance shapes consume `--affordance-*` and `--action-class-*` tokens (V-color-tokens cross-cutting amendment §IV.11). Hero seat-arc ring migrates to non-color encoding (color reserved for ordinal quality-tier).
- **§IV ↔ V-2 §III + V-3 §II:** §I/§II/§III dots are NOT §IV affordances — they're ambient-state signals owned by their concept-class modules (`render-confidence.js` / `render-staleness.js`). §IV does NOT claim the dot shape; selection/pin state uses outline rings, not filled dots (INV-AFFORD-5).
- **§IV ↔ V-status (§I, pending):** `#status-dot` ownership locked at §II.4. §IV's connection-status case is a status concept-class (§I), not an affordance. V-status walkthrough authors §I; §IV has no override.
- **§IV ↔ V-density (§VI, pending):** F-6 lexical inconsistency (`n=45` vs `45h`) is owned by §VI typography ladder, not §IV. §IV mentions F-6 in the boundary section but does not resolve it.
- **§IV ↔ V-5 cross-product extension:** `render-affordance.js` placement at `shared/` (per §IV.7) positions the vocabulary for V-5 main-app surface extension without relocation. Mirror-lock test (V-color-tokens.5) enforces token parity for `--action-class-*` + `--affordance-*` cross-product.

**Binding rules:** **R-1.5 amended (text only, 2026-04-28) to cite §IV explicitly** + **R-1.10 (affordance vocabulary discipline + INV-AFFORD-1..5, doctrine v6)** + companion `affordance-registry.test.js` + `dom-mutation-discipline.test.js` extension (Gate 5).

---

## §V — Color semantic isolation

**Concept-class:** `color-semantics` — every color-as-signal maps to exactly one concept-class; every render site sources hex via concept-class-prefixed token reference.

**Coverage:** Yellow `#fbbf24` × 7 design-token roles + 2 status-dot uses + M-token-bundle reused for fold% gradient (per inventory §CC-C, §CC-E, §CC-F + Cross-cutting Finding F-3; D-2 forensic). Plus pre-existing STYLE_COLORS / STYLE_TOKENS hex divergence + ~46 hex literals in `side-panel.html` embedded CSS + 51 `--m-*` references (42 in side-panel.html alone) — D-2 widening surfaced by V-color-tokens roundtable.

**Status:** **§V RESOLVED 2026-04-28** per owner approval of V-color-tokens roundtable synthesis. 5-specialist roundtable + strengthened long-term lens. All 5 owner-decision points (V-color.1–V-color.5) resolved with long-term-aggressive defaults. Doctrine v5 amendment (R-1.9 + INV-TOKEN-1..5) bundled. Implementation deferred to Gate 5.

### §V.1 — Naming convention

All color tokens use **verbose-explicit concept-class-prefixed naming**: `--{concept-class}-{qualifier}-{role}`.

Concept-class prefixes (closed enumeration; new concept-classes require doctrine amendment):

| Prefix | Domain |
|---|---|
| `qtr-` | Quality-tier reserved (ordinal: positive / marginal / negative). Reserved for any ordinal signal: confidence, freshness, fold-%, M-ratio, EV, priority. |
| `cat-style-` | Categorical style chip (Fish/LAG/TAG/Nit/LP/Reg/Unknown). |
| `m-zone-` | Tournament M-ratio zone (ordinal: safe / warning / danger / critical). |
| `fold-pct-` | Fold-percentage gradient (ordinal: high / mid / low). |
| `fresh-tier-` | Freshness register (live / aging / stale / unknown / rejected) — new under V-3. |
| `conf-tier-` | Confidence register (high / medium / low / unknown) — new under V-2. |
| `surface-` | Background surfaces (zone-bg / panel-bg / divider). |
| `text-` | Text colors (primary / secondary / muted / faint). |
| `border-` | Borders (subtle / medium / strong). |

Concise names (`--m-red`, `--trust-negative`, `--color-warning`) are forbidden because they invite reuse across concept-classes — they are the root of D-2. The verbose form is the V-1 (c) discipline operationalized at the token-naming layer.

### §V.2 — Hex policy

**Quality-tier hex pool reserved for ALL ordinal signals.** The three hex values `#4ade80` (positive), `#fbbf24` (marginal), `#f87171` (negative) are reserved at the **primitive layer** for ordinal quality-tier signaling. Multiple concept-class tokens (`--qtr-pos`, `--m-zone-safe`, `--fold-pct-high`, `--fresh-tier-live`, `--conf-tier-high`) MAY resolve to the same hex via **distinct CSS variable names**. Future hex change to one concept-class is a one-line token edit; render sites consuming the other concept-classes are unaffected.

**Categorical hex split mandated.** Categorical concept-classes (style chips primarily) get new V-1-safe hex values (per §V.4 migration table). No categorical token may resolve to a hex in the quality-tier pool. INV-TOKEN-2 enforces concept-class exclusivity via the meta file; perceptual conflicts (TAG green-family vs `--qtr-pos` green) are V-1 violations even when the exact hex differs.

**Two-layer token graph** (systems-architect's contribution):
- Layer 1 — primitive color constants. Not exported. Not referenced by render sites. Holds the actual hex values:
  ```js
  const _P = {
    quality_pos:    '#4ade80',
    quality_marginal: '#fbbf24',
    quality_neg:    '#f87171',
    pink_hot:       '#f472b6',  // cat-style-fish
    orange_deep:    '#fb923c',  // cat-style-lag
    teal_cyan:      '#5eead4',  // cat-style-tag
    blue_sky:       '#93c5fd',  // cat-style-nit
    violet:         '#a78bfa',  // cat-style-lp
    lavender:       '#d8b4fe',  // cat-style-reg
    grey_neutral:   '#9ca3af',  // cat-style-unknown
    // ...
  };
  ```
- Layer 2 — semantic tokens. Exported via `injectTokens()` as CSS variables. Bind one concept-class each, alias from Layer 1 primitives:
  ```js
  export const TOKENS = Object.freeze({
    'qtr-pos':            _P.quality_pos,
    'qtr-marginal':       _P.quality_marginal,
    'qtr-neg':            _P.quality_neg,
    'm-zone-safe':        _P.quality_pos,      // alias — same hex, distinct CSS var
    'm-zone-warning':     _P.quality_marginal,
    'm-zone-critical':    _P.quality_neg,
    'fold-pct-high':      _P.quality_pos,
    'fold-pct-mid':       _P.quality_marginal,
    'fold-pct-low':       _P.quality_neg,
    'conf-tier-high':     _P.quality_pos,
    'conf-tier-mid':      _P.quality_marginal,
    'conf-tier-low':      _P.quality_neg,
    'conf-tier-unknown':  _P.grey_neutral,
    'fresh-tier-live':    _P.quality_pos,
    'fresh-tier-aging':   _P.quality_marginal,
    'fresh-tier-stale':   _P.quality_neg,
    'fresh-tier-unknown': _P.grey_neutral,
    'fresh-tier-rejected': _P.quality_neg,
    'cat-style-fish-text':  _P.pink_hot,
    'cat-style-lag-text':   _P.orange_deep,
    'cat-style-tag-text':   _P.teal_cyan,
    'cat-style-nit-text':   _P.blue_sky,
    'cat-style-lp-text':    _P.violet,
    'cat-style-reg-text':   _P.lavender,
    'cat-style-unknown-text': _P.grey_neutral,
    // ...
  });
  ```

`Object.freeze(TOKENS)` prevents accidental runtime mutation. Render sites consume only `var(--qtr-pos)`, never inline hex; `_P` is module-private.

### §V.3 — Quality-tier-reserved tokens (ordinal pool)

Six concept-classes share the ordinal hex pool via distinct CSS variable names:

| Token name | Hex (Layer 1 alias) | Concept |
|---|---|---|
| `--qtr-pos`, `--qtr-marginal`, `--qtr-neg` | `_P.quality_pos`, `_P.quality_marginal`, `_P.quality_neg` | Generic quality-tier (callable when no specific concept-class fits) |
| `--m-zone-safe`, `--m-zone-warning`, `--m-zone-danger`, `--m-zone-critical` | maps to ordinal pool + orange (`_P.orange_deep` or new `_P.quality_caution`) | Tournament M-ratio (rename from `--m-green/yellow/orange/red`) |
| `--fold-pct-high`, `--fold-pct-mid`, `--fold-pct-low` | ordinal pool | Fold-percentage gradient at `render-street-card.js:908` |
| `--conf-tier-high`, `--conf-tier-mid`, `--conf-tier-low`, `--conf-tier-unknown` | ordinal pool + neutral grey | V-2 confidence vocabulary |
| `--fresh-tier-live`, `--fresh-tier-aging`, `--fresh-tier-stale`, `--fresh-tier-unknown`, `--fresh-tier-rejected` | ordinal pool + neutral grey | V-3 freshness vocabulary |
| `--priority-high`, `--priority-med`, `--priority-low` | ordinal pool | Priority/severity (existing concept; rename) |

`--conf-tier-unknown` and `--fresh-tier-unknown` resolve to a neutral grey (Layer 1: `_P.grey_neutral`), distinct from quality-tier hues. `--fresh-tier-rejected` resolves to negative-tier hex with a distinguishing visual modifier per V-3 §II.1.

### §V.4 — Categorical hue migration (style chips)

Per V-color.2 owner-approved (long-term lens). Migration table (production targets):

| Style | Current text hex | V-1-safe target hex | Layer 1 primitive | Notes |
|---|---|---|---|---|
| Fish | `#fca5a5` (pink-red) | `#f472b6` (hot pink) | `_P.pink_hot` | Exits red family entirely |
| LAG | `#fdba74` (orange) | `#fb923c` (deep orange) | `_P.orange_deep` | Distance from `#fbbf24` yellow |
| TAG | `#86efac` (green) | `#5eead4` (cyan-teal) | `_P.teal_cyan` | Drop green entirely |
| Nit | `#93c5fd` (sky blue) | unchanged `#93c5fd` | `_P.blue_sky` | V-1-safe |
| LP | `#fde68a` (pale yellow) | `#a78bfa` (violet) | `_P.violet` | Avoid yellow family |
| Reg | `#d8b4fe` (lavender) | unchanged `#d8b4fe` | `_P.lavender` | V-1-safe |
| Unknown | `#9ca3af` (grey) | unchanged `#9ca3af` | `_P.grey_neutral` | V-1-safe |

Plus `bg` token per style (semi-transparent variant of text token) — same migration.

**Secondary discrimination channel: text weight.** Per product-ux-engineer's hybrid: bold for aggressive styles (Fish, LAG); normal for passive styles (Nit, LP, TAG); italic for Unknown. Adds redundant cue surviving low-contrast rendering conditions; zero new DOM elements.

**Visual harness validation required at Gate 5:** Fish saturation level (`#f472b6` may over-promote in attention hierarchy — owner check); LAG `#fb923c` adjacency to `--m-zone-warning` orange in tournament-bar fixture; LP/Reg purple-pair discrimination at 11px on Samsung Galaxy A22 (lower color gamut). Surfaced by product-ux-engineer specialist.

### §V.5 — M-zone + fold-pct semantic isolation

`--m-green/yellow/orange/red` (and the bare `--m-*` reference at 51 sites including 42 in side-panel.html) are renamed:
- `--m-green` → `--m-zone-safe`
- `--m-yellow` → `--m-zone-warning`
- `--m-orange` → `--m-zone-danger`
- `--m-red` → `--m-zone-critical`

The fold-percentage gradient at `render-street-card.js:908` (which previously consumed `var(--m-green/yellow/red)` — token-name-vs-use-site lie) reads from dedicated `--fold-pct-high/mid/low` tokens. Both bundles resolve to the same Layer 1 primitives in v1; future hex divergence is a one-line edit per concept-class.

`shared/tier-thresholds.js` extracted (cto-agent's recommendation): the `foldPct >= 50 ? 'high' : foldPct >= 30 ? 'mid' : 'low'` ordinal-classifier pattern moves into a shared module that V-2 `render-confidence.js`, V-3 `render-staleness.js`, and the Gate 5 fold-pct gradient renderer all consume. Pure function; no DOM, no timer; injectable thresholds.

### §V.6 — V-2 / V-3 token entries (cross-cutting amendment)

The `--conf-tier-*` (V-2) and `--fresh-tier-*` (V-3) CSS class names previously had **no token backing** in `design-tokens.js`. V-color-tokens adds the entries per §V.3 quality-tier-reserved tokens. Without this, Gate 5 V-2 / V-3 implementations would either hardcode hex or re-use deprecated `trust-*` tokens, recreating the V-2 / V-3 violations.

**§II.2 amendment** (cross-cutting): `fresh-tier-*` CSS classes resolve to the §V tokens — `.fresh-tier-live` → `var(--fresh-tier-live)`, etc.

**§III.3 amendment** (cross-cutting): `conf-tier-*` CSS classes resolve to the §V tokens — `.conf-tier-high` → `var(--conf-tier-high)`, etc. The deprecated `--trust-marginal/value/negative` tokens are removed in the same Gate 5 wave (no longer referenced by any render site after V-2 / V-3 implementations migrate to `--conf-tier-*` and `--fresh-tier-*`).

### §V.7 — STYLE_COLORS consolidation

Per V-color.3 owner-approved: `design-tokens.js` is the canonical source for style chip hex. `stats-engine.js:STYLE_COLORS` becomes a re-export wrapper:

```js
// shared/stats-engine.js (replacing the parallel definition at lines 327-335)
import { STYLE_TOKENS } from './design-tokens.js';
export const STYLE_COLORS = STYLE_TOKENS;  // alias for legacy callers
```

`render-orchestrator.js:13` import path unchanged (`STYLE_COLORS` identifier preserved). Existing test at `shared/__tests__/stats-engine.test.js:236-244` may need update to align hex assertions with canonical source.

CLAUDE.md anti-pattern statement updated: was "Never duplicate STYLE_COLORS — import from `shared/stats-engine.js` everywhere"; becomes "STYLE_COLORS is a re-export of canonical STYLE_TOKENS in `shared/design-tokens.js`. Import either path; both resolve to same hex. Adding new style entries: edit `design-tokens.js` only."

The pre-existing Fish hex divergence (`#fca5a5` vs `#fb923c`) is resolved by canonicalizing on `#f472b6` (the V-1-safe hot-pink target per §V.4).

### §V.8 — File structure

**Single production file + meta companion:**
- `ignition-poker-tracker/shared/design-tokens.js` — production tokens (Layer 1 primitives + Layer 2 semantic exports + `injectTokens()` + `STYLE_TOKENS`). Object.frozen.
- `ignition-poker-tracker/shared/design-tokens.meta.js` — concept-class index. Maps each token key to `{conceptClass, role, hex}`. NOT injected; test-time use only. Imported by `design-token-registry.test.js` and `token-concept-class-collision.test.js`.

Per V-color.1 owner-approved single-file consensus (3-of-5 specialists; per-concept-class file split rejected by failure-engineer's `injectTokens()` load-order argument). Section headers within `design-tokens.js` group tokens by concept-class for visual scannability.

`injectTokens()` adds **deprecation alias mechanism**: during transition, emits both old (`--trust-marginal`, `--m-yellow`, etc.) AND new (`--qtr-marginal`, `--m-zone-warning`, etc.) names. Old names removed in a follow-up PR after harness fixture-diff = 0 across the full SHC milestone. Idempotency guard (`injected = false` flag at design-tokens.js:151) hardened with content-hash comparison on reinject.

### §V.9 — Cross-product mirror-lock

Per V-color.5 owner-approved: implement now (not defer to V-5). `shared/design-tokens.js:9` claims it mirrors `src/constants/designTokens.js` — V-color-tokens makes the mirror mechanically enforced via test.

**Mirror-lock test:** imports both `shared/design-tokens.js` (extension) and `src/constants/designTokens.js` (main app); diffs shared keys; non-shared keys permitted (one file may have tokens the other doesn't). Asserts shared keys have identical hex.

V-5 cross-product extension still TBD (when do main-app surfaces import the shell-spec vocabulary as positive contract). The mirror-lock invariant guards against silent drift in the meantime — if either file edits a shared token, the test fails before the divergence ships.

Main-app `src/constants/designTokens.js` is NOT renamed in V-color-tokens scope; that's V-5 work. The mirror-lock test starts as a small set of truly-shared keys (those that already exist in both files with intent to align); the set grows as V-5 lands.

### §V.10 — Required co-shipping (Gate 5 prerequisites for INV-TOKEN-1..5 enforcement)

Five cleanups bundled with V-color-tokens because they are direct prerequisites for INV-TOKEN-1..5 enforcement:

1. **`side-panel.html` embedded CSS hex sweep.** ~46 hex literals (lines 391, 431-433, 440-441, 454, 489, 491, 699-700, etc.) converted to `var(--token)` references. Without this, INV-TOKEN-1 lint test fails on first run.
2. **`--m-*` reference rename across 51 sites** (42 in side-panel.html, 9 elsewhere including `render-street-card.js:908`). JS template-literal `var()` references manually updated; INV-TOKEN-3 lint test catches missed sites.
3. **STYLE_COLORS / STYLE_TOKENS divergence resolution.** `stats-engine.js:STYLE_COLORS` becomes re-export wrapper per §V.7. INV-TOKEN-5 lint test enforces.
4. **`shared/design-tokens.meta.js` authored** alongside the rename. INV-TOKEN-2 enforced via this file.
5. **Deprecation alias mechanism** in `injectTokens()`. Fixture-diff = 0 expected for ordinal-pool tokens; expected diff for categorical hex changes (4-7 fixtures: any rendering Fish/LAG/TAG/LP chips). Rebaseline ceremony documented per V-color.2.

**24-fixture rebaseline scope:** `static-flopWithAdvice.png`, `static-fullNineHanded.png`, `static-pinnedVillainOverride.png`, `static-betweenHandsTournament.png` (LAG chip), `static-riverValueBet.png` (FISH chip), `temporal-newHandTransition.png` (style chips visible) — these are expected to diff at the categorical-hex level. Owner verifies new hex meets visual-discrimination bar before rebaseline locks.

### §V.11 — Behavioral invariants (R-1.9 INV-TOKEN-1..5)

R-1.9's five invariants are repeated here for spec-author convenience; the doctrine version is authoritative.

- **INV-TOKEN-1 (Single source of truth).** No hex literals outside `design-tokens.js`. Lint-enforced via grep test.
- **INV-TOKEN-2 (Concept-class exclusivity).** Each token belongs to exactly one concept-class declared in the meta file. Lint-enforced.
- **INV-TOKEN-3 (Var-literal audit).** Every `var(--token-name)` JS template literal resolves to an existing token. Lint-enforced.
- **INV-TOKEN-4 (Mirror-lock).** Shared keys between `shared/design-tokens.js` and `src/constants/designTokens.js` have identical hex. Lint-enforced via cross-file diff test.
- **INV-TOKEN-5 (Style-color single-source).** `STYLE_COLORS` in `stats-engine.js` is a re-export of canonical `STYLE_TOKENS` in `design-tokens.js`. No parallel hex declarations. Lint-enforced.

### §V.12 — Forbidden patterns

Code paths that violate §V.1–§V.11 — flagged at code review and at automated lint via R-1.9 enforcement:

1. **Forbidden: inline hex literals at any render site.** All color sourced via `var(--{concept-class}-...)` CSS variable references OR named JS imports from `shared/design-tokens.js`. INV-TOKEN-1.
2. **Forbidden: token names without concept-class prefix.** `--my-color` is a violation; `--cat-style-myrole-text` is acceptable. INV-TOKEN-2.
3. **Forbidden: two distinct concept-class tokens resolving via the same CSS variable name.** Each concept-class gets its own CSS variable even when hex aliases at Layer 1.
4. **Forbidden: `var(--token, #fallback)` with reserved-tier hex as fallback.** Side-panel.html:85's `var(--m-red, #ef4444)` pattern is the canonical existing violation; remediated by §V.10 co-shipping item 1. Fallbacks for tokens within `design-tokens.js` are unnecessary because the token is guaranteed to exist; fallbacks for tokens outside (cross-product) are V-5 concern.
5. **Forbidden: parallel STYLE_COLORS / STYLE_TOKENS hex declarations.** §V.7 consolidation; INV-TOKEN-5.
6. **Forbidden: adding a new color without a meta-file entry.** §V.8 + INV-TOKEN-2.
7. **Forbidden: mutating `TOKENS` or `STYLE_TOKENS` at runtime.** `Object.freeze` enforces; pre-freeze, this would be a silent bug risk.
8. **Forbidden: bypassing the Layer 1 primitives by importing `_P` directly.** `_P` is module-private; only Layer 2 semantic tokens are exported.
9. **Forbidden: `--m-*` references in non-tournament render contexts.** After V-color-tokens, M-tokens are tournament-only; fold-pct gradient uses `--fold-pct-*`; status uses `--status-*` (per §I, pending V-status walkthrough).
10. **Forbidden: confidence/freshness tokens consumed for non-confidence/non-freshness signals.** Concept-class exclusivity per INV-TOKEN-2.

### §V.13 — Cross-cutting boundaries

- **V-color-tokens ↔ V-1 (c) full color discipline:** §V is the operationalization. V-1 (c) was the policy decision; §V is the implementation contract.
- **V-color-tokens ↔ V-2 §III:** §III.3 CSS binding citation amended to specify exact tokens (`.conf-tier-high → var(--conf-tier-high)`, etc.). Module path at §III.6 was already amended 2026-04-28 to `shared/render-confidence.js`. Forward-compat preserved.
- **V-color-tokens ↔ V-3 §II:** §II.2 CSS binding citation amended similarly. `fresh-tier-*` token entries added per §V.6.
- **V-color-tokens ↔ V-status (§I, pending):** §I status concept-class will introduce `--status-*` tokens for connectivity-warning, recovery-banner, etc. Currently `'status-dot yellow'` CSS class at `render-orchestrator.js:1326-1341` and `side-panel.js:212-214` uses color-literal modifiers — these are V-1 violations the V-status walkthrough will resolve.
- **V-color-tokens ↔ V-affordance (§IV, pending):** V-affordance closes R-1.5 SR-4-spec-index reference. Affordance vocabulary is shape-based (chevron/underline/badge/dot/pill/divider) but uses tokens for color states (e.g., chevron-active vs chevron-inactive). The token system per §V is the binding for any color-bearing affordance.
- **V-color-tokens ↔ V-5 cross-product extension:** §V.9 mirror-lock test guards against silent drift now; V-5 extension authorizes main-app surfaces to import sidebar shell-spec vocabulary as positive contract. V-color-tokens prepares the path; V-5 walks it.

**Binding rules:** **R-1.9 (color-token concept-class isolation + INV-TOKEN-1..5, doctrine v5)** + companion `design-token-registry.test.js` + `token-concept-class-collision.test.js` + mirror-lock test (Gate 5).

---

## §VI — Density rhythm + attention budget

**Concept-class:** `density-rhythm` — how tightly information packs; which zone wins the eye in which state.

**Coverage:** Per inventory §CC-F + Gate 1 §4.2 missing artifact "Attention budget" — currently no documented hierarchy of zone-by-zone eye-priority under different states.

**Vocabulary content (pending — see §V open decisions):**
- Row-height + padding + gap conventions per zone-tier (Z0 chrome, Z2 advice header, Z3 decision content, Z4 deep analysis).
- Typography ladder enumeration (font-sizes 24px / 14px / 11px per `design-tokens.js:104`; weight tiers; color tiers).
- Attention-budget map: which zone owns the user's eye in {active hand, between hands, error, tournament context} — explicit ranking.
- DriveHUD precedent (LEDGER COMP-DRIVEHUD): profile-segmented density. **Likely deferred** to a future iteration; v1 ships a single density rhythm.
- GTO Wizard precedent (LEDGER COMP-GTOWIZARD): product-level density ladder (compact/medium/large + 4 layouts) as user-controlled setting. **Likely deferred** to v2; v1 ships a single setting.

**Binding rules:** Doctrine §10 retained un-amended (visual design / colours / fonts / exact sizes are per-element-spec scope). The attention-budget map is structural, not visual.

---

## §V (open decisions) — Vocabulary decisions deferred for owner direction

**Resolved decisions** (vocabulary applied to corresponding section):
- ✅ **V-1 — Color overhaul scope:** **(c) full color discipline** approved 2026-04-27. Implications carried into §V color-token work + downstream V-decisions. Style chips lose red/yellow/green; those hues reserved for ordinal quality-tier.
- ✅ **V-2 — Confidence treatment unification:** **(c) dot + typographic ladder + (d) extracted `render-confidence.js` module + explicit `unknown` state + scope boundary + ordinal CSS naming** approved 2026-04-27 after 5-specialist roundtable. Synthesis hybrid: visual = (c), structural = (d), state = four explicit tiers, naming = `conf-tier-*` ordinal, scope = engine outputs only. Vocabulary at §III. **Path amendment 2026-04-28:** module relocated from `side-panel/render-confidence.js` to `shared/render-confidence.js` per V-3.3 long-term lens.
- ✅ **V-3 — Freshness vocabulary + mechanism coherence:** **5-tier register + extracted `shared/render-staleness.js` module + R-1.8 doctrine rule with INV-FRESH-1..5 + F-8 distinguishing badge + V-2.4 conditional stale→confidence-unknown** approved 2026-04-28 after 5-specialist roundtable + owner meta-direction strengthening. All five sub-decisions resolved: V-3.1 = include aging tier; V-3.2 = R-1.8 doctrine rule NOW (reverses default per `feedback_long_term_over_transition.md` strengthened lens); V-3.3 = `shared/` placement NOW (reverses default; V-2 amended to match); V-3.4 = §I owns `#status-dot` exclusively + `dom-mutation-discipline.test.js` enforcement; V-3.5 = add `rejected` 5th tier NOW (reverses default; INV-FRESH-5 makes RT-68/69 SW-replay rejection observable). Vocabulary at §II. Doctrine v4 amendment (R-1.8) bundled.
- ✅ **V-color-tokens — color-token concept-class isolation + operationalization of V-1 (c):** **verbose-explicit naming (`--cat-`/`--qtr-`/`--m-zone-`/`--fold-pct-`/`--conf-tier-`/`--fresh-tier-`) + Layer-1 primitive constants + Layer-2 semantic tokens + ordinal hex pool reservation for all ordinal concept-classes + categorical hue migration (Fish→hot-pink, LAG→deep-orange, TAG→cyan-teal, LP→violet) + STYLE_COLORS / STYLE_TOKENS consolidation (design-tokens.js canonical) + `shared/design-tokens.meta.js` companion file + R-1.9 doctrine rule with INV-TOKEN-1..5** approved 2026-04-28 after 5-specialist roundtable. All five sub-decisions resolved long-term-aggressive: V-color.1 = verbose-explicit naming; V-color.2 = categorical hex migration NOW (rebaseline 4-7 fixtures); V-color.3 = `design-tokens.js` canonical; V-color.4 = R-1.9 doctrine rule NOW; V-color.5 = mirror-lock test NOW. Vocabulary at §V. Doctrine v5 amendment (R-1.9) bundled. **§II.2 + §III.3 amended** with token-binding citations. **Required co-shipping:** side-panel.html hex sweep + `--m-*` rename across 51 sites + STYLE_COLORS re-export + meta file + deprecation alias mechanism + 24-fixture rebaseline + `design-token-registry.test.js` + `token-concept-class-collision.test.js` + mirror-lock test + `shared/tier-thresholds.js` extraction. **Cross-cutting amendment 2026-04-28 (V-affordance):** §V extended with `--action-class-*` (CALL/BET/RAISE/FOLD pill colors) + `--affordance-*` (chevron/underline/pill state colors) concept-class entries.
- ✅ **V-affordance — affordance vocabulary discipline + closes R-1.5 dangling SR-4-spec-index:** **6-shape closed enumeration (chevron / underline / pill / circle / divider / decorative-glyph) + Class A/B distinction (visual-required vs spatial-convention licensed exception) + chevron direction VERIFIED via codebase (down=collapsed / up=expanded; existing CSS contract correct at side-panel.html:1266) + closed glyph registry of 4 (★ ♦ ● →) + `chip` sub-form for hand-plan branch labels (disambiguates pill double-use) + ARIA contract mandated per shape + extracted `shared/render-affordance.js` module + `data-affordance` attribute + single delegated listener pattern + R-1.10 doctrine rule with INV-AFFORD-1..5** approved 2026-04-28 after 5-specialist roundtable. All V-afford.1–V-afford.5 long-term-aggressive: V-afford.1 = 6 shapes (cto-agent's framing); V-afford.2 = R-1.5 amendment + R-1.10 NEW (failure-engineer's behavioral-invariants case); V-afford.3 = deep-chevron rotation rule VERIFIED (no grandfathered exception needed); V-afford.4 = INV-AFFORD-4 grandfathered allowlist with milestone; V-afford.5 = long-press deferred to V-affordance v2. Vocabulary at §IV. Doctrine v6 amendment (R-1.5 text + R-1.10) bundled. **R-1.5 text amended** to cite §IV explicitly. **§V cross-cutting amendment** with `--action-class-*` + `--affordance-*` entries (without these, Gate 5 implementers reach for `--qtr-*` and recreate cross-concept collision). Required co-shipping: 8 items including `shared/render-affordance.js` module + 4-chevron-class collapse + click-wiring consolidation + `affordance-registry.test.js` + dom-mutation-discipline extension + INV-AFFORD-4 grandfathered allowlist + hero seat-arc ring migration to non-color encoding + `render-orchestrator.js:147` `||` → `??` fix + `.show-toggle-btn` element-type fix.
- ✅ **V-status — status concept-class discipline + 3-axis decomposition:** **3-axis register (connection-state / app-bridge-state / pipeline-stage-health) + dot/badge/strip per axis + `--status-conn-*` + `--status-app-*` + `--status-pipeline-*` token entries + new `_P.orange_status` Layer 1 primitive (distinct from `_P.orange_deep`) + extracted `shared/render-status.js` module (pure classifier; writer in IIFE) + 5-writer consolidation to 1 + comprehensive ARIA mandate (role="status" ambient; role="alert" + assertive on recovery banner) + R-1.11 doctrine rule with INV-STATUS-1..5** approved 2026-04-28 after 5-specialist roundtable. All V-status.1–V-status.5 long-term-aggressive: V-status.1 = R-1.11 NEW + INV-STATUS-1..5 (rejecting cto-agent's "no new rule" position per strengthened lens); V-status.2 = 3-axis sub-prefix; V-status.3 = new `_P.orange_status` Layer 1 primitive; V-status.4 = `versionMismatch` = fatal tier (red dot + recovery banner); V-status.5 = 30s connected-waiting timeout + escalation. Vocabulary at §I. Doctrine v7 amendment (R-1.11) bundled. **§V cross-cutting amendment** with status concept-class entries + new orange primitive. **§II.3 cross-cutting:** `connection-status` row MOVES from §II.3 to §I.3. **§II.9 co-shipping #1 amended** from "dual-writer" to "5-writer" with explicit line numbers (cto-agent + senior-engineer + failure-engineer codebase verification). Required co-shipping: 12 items including `shared/render-status.js` module + 5-writer consolidation + `staleContext` inline override at `:1847-1848` REMOVED (closes FM-STATUS-1 silent severity downgrade) + `versionMismatch` dot-class fix at `:215-217` (closes FM-STATUS-2) + `updateStatusFromDiag` migration + `updateAppStatus` orphan migration + `--status-*` tokens + `_P.orange_status` primitive + `status-registry.test.js` + dom-mutation-discipline extension + `STATE_FIELD_SCOPES.md` `lastGoodExploits` clearing-path extension + ARIA contract + INV-STATUS-4 timer registration. New forensics: 6 FM-STATUS-1..6 entries surfaced by failure-engineer, including a currently-shipping silent-severity-downgrade bug.

**Pending decisions** (defaults below; subject to owner walkthrough):

### V-1 — Color overhaul scope
**Question:** Does §V (color semantic isolation) ship as (a) **rename-only** (new tokens that resolve naming collisions, hex unchanged for v1; rename allows future hex change without breaking semantics), (b) **rename + selective hex change** (e.g., split confidence-marginal hex from m-yellow hex even if both stay yellow-ish), or (c) **full GTO-Wizard-style discipline** (every color is strictly one semantic; some hex changes mandatory)?
**Recommended default:** (a) rename-only for v1. Lowest risk, addresses the *naming-vs-semantic* concern, leaves room for v2 hex revisions when downstream impact is measured.
**Why this is owner-blocking:** (b) and (c) impose code+CSS changes on every zone; (a) is doctrine-additive only.

### V-2 — Confidence treatment unification
**Question:** Pick one canonical pattern for `mq.overallSource`. Options: (a) **dot-only** (matches CC-C-1 + CC-C-3; remove opacity treatment), (b) **opacity-only** (matches CC-C-2; remove dots), (c) **dot+typographic-ladder** (Hand2Note-style: dot + value-font / sample-count-font two-tier).
**Recommended default:** (c) dot+typographic-ladder. Dot is recognizable from existing usage; typographic ladder adds a channel that doesn't compete with color-semantic isolation work in §V.
**Why this is owner-blocking:** (a) requires removing CSS classes used in Z2 context strip; (b) requires removing dot DOM in Z2 + Z4; (c) requires CSS authoring for the typographic ladder. Each touches a different code surface.

### V-3 — Stale-but-was-live vs clean-between-hands disambiguation
**Question:** Finding F-8: `betweenHands` and `staleContextTimeout` render identically despite different mechanisms. Options: (a) **accept conflation** (stale-context-timeout is a degenerate between-hands; user diagnosis via diagnostics if needed), (b) **distinguishing badge** ("session timed out — last data N minutes ago" small ambient label), (c) **distinct color treatment** (slightly amber-tinted "Waiting…" text after timeout).
**Recommended default:** (a) accept conflation for v1. Diagnostic affordance already exists ("show diagnostics" link); building a new visual signal for an edge state introduces risk.
**Why this is owner-blocking:** Touches whether v1 introduces a new visible state at all.

### V-4 — Attention budget formality
**Question:** §VI attention-budget map — is this v1 content or v2 content? Options: (a) **v1 — explicit ranked list** (zone priority per state documented), (b) **v1 — descriptive only** (note the missing artifact, defer formal ranking), (c) **v2 — defer entirely**.
**Recommended default:** (b) descriptive-only for v1. Per Gate 1 §4.2 the attention budget is a known gap; ranking it formally requires evidence not yet gathered (telemetry on actual eye-flow patterns).
**Why this is owner-blocking:** (a) commits the spec to ranked priorities that may be wrong; (c) leaves a Gate 1 gap unaddressed.

### V-5 — Cross-product extension timing
**Question:** Per Gate 2 Stage D finding D1, the shell spec is **scoped to the sidebar first**, with concept inventory authored to be **directly portable** to main-app surfaces. When does the cross-product extension happen? Options: (a) **same Gate 4 session** (extend now), (b) **follow-up Gate 4 session within same project** (Gate 4 splits into 4a-sidebar + 4b-main-app), (c) **separate project** (file a new audit; main-app extension is its own SHC-style scope).
**Recommended default:** (c) separate project. Main-app surfaces have their own per-surface specs that didn't go through SHC Gate 1 / Gate 2 — extending sidebar vocabulary to them is a scope-defined system-coherence audit on its own (newly registered scope class per `LIFECYCLE.md` 2026-04-27 update).
**Why this is owner-blocking:** (a) and (b) commit Gate 4 to substantially more work; (c) ships sidebar shell spec cleanly and lets main-app extension be re-scoped on its own merits.

---

## What this spec does NOT cover

- **Per-element exact pixel sizes / fonts / hex values for new tokens.** Doctrine §10 retains visual-design as per-element-spec scope; this shell spec carries *concept-class vocabulary*, not pixel-level visual design.
- **FSM behavior of individual panels.** Doctrine §2 (FSM rules R-2.*) governs lifecycles; shell spec governs vocabulary used by those FSMs to communicate state.
- **Rendering pipeline architecture.** Doctrine §5 (FSM-exclusive ownership R-5.6, etc.) and §10 (R-10.* payload invariants) govern that layer.
- **First-impression / E-IGNITION / purchasing-window concerns.** Routed to Monetization & PMF program per SHC Scope A lock (2026-04-27).
- **Implementation rollout plan.** Gate 5 work; staged across multiple PRs each citing the shell spec section they bring into compliance.

---

## Cross-references that follow when this scaffold is filled

When §I–§VI carry vocabulary content, the following updates land in tandem:

- **`docs/SIDEBAR_DESIGN_PRINCIPLES.md` R-1.5** — update "small, consistent vocabulary declared in the SR-4 spec index" reference to cite this shell spec as the canonical SR-4 spec index.
- **`docs/design/surfaces/sidebar-zone-0.md`** — cross-reference §I (status vocabulary) + §II (freshness vocabulary) for Z0 elements 0.3 (connection state), 0.9 (pipeline health).
- **`docs/design/surfaces/sidebar-zone-1.md`** — cross-reference §IV (affordance vocabulary) for seat-arc click semantics.
- **`docs/design/surfaces/sidebar-zone-2.md`** — cross-reference §I + §II + §III + §V for unified header dot, stale-advice badge, context-strip opacity, action-badge colors.
- **`docs/design/surfaces/sidebar-zone-3.md`** — cross-reference §III + §IV + §V + §VI for stat chips, hand-plan affordances, fold-curve color gradient, weakness annotation.
- **`docs/design/surfaces/sidebar-zone-4.md`** — cross-reference §III + §IV for glance-tier confidence, expandable section affordances.
- **`docs/design/surfaces/sidebar-zones-overview.md`** — cross-map heuristic table updated with `sidebar-shell-spec` link as the canonical cross-zone reference.

## Change log

- 2026-04-27 — Created as **SCAFFOLD**. Gate 4 deliverable of Sidebar Holistic Coherence project. Section structure (§I–§VI) determined by Gate 3 evidence (six concept-classes from visual catalog + attention-budget gap from Gate 1). Vocabulary content deferred — five owner-blocking decisions flagged in §V open-decisions.
- 2026-04-27 (later same day) — **§III RESOLVED.** V-2 confidence-treatment vocabulary filled in after 5-specialist roundtable. Visual = (c) dot + typographic ladder; structural = (d) extracted `render-confidence.js` module; state = four-tier explicit register including first-class `unknown`; CSS naming = `conf-tier-high/mid/low/unknown` (ordinal, not color-literal); scope boundary = engine model outputs only (NOT mathematically exact derived values like equity / pot odds / SPR); sample-count semantics = `n=N` paired with dot (mq sample) vs `Nh` standalone (cumulative observation count). §III.7 forbidden-patterns section added for code-review enforcement. V-1 (color discipline = full) also recorded as resolved. Status promoted from SCAFFOLD to PARTIAL. Other sections still pending corresponding V-decisions. Implementation deferred to Gate 5 — this commit is spec-only.
- 2026-04-28 — **§II RESOLVED + V-2 §III.6 path amended.** V-3 freshness vocabulary + mechanism coherence filled in after 5-specialist roundtable + owner meta-direction strengthening (`memory/feedback_long_term_over_transition.md` updated 2026-04-28 to reject "minimum v1 scope" defaults in favor of "long-term-correct architecture even if scope/complexity grows now"). All five V-3 sub-decisions resolved with the long-term-aggressive option (V-3.1 include aging, V-3.2 R-1.8 doctrine rule NOW, V-3.3 `shared/` placement NOW, V-3.4 §I owns status-dot + lint enforcement, V-3.5 add `rejected` 5th tier NOW). Doctrine v4 amendment authored inline (option (i)) — adds R-1.8 binding rule + INV-FRESH-1..5 behavioral invariants in `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 + §11 amendment-log entry. **V-2 §III.6 amended:** `render-confidence.js` relocated from `side-panel/` to `shared/` for symmetry with `render-staleness.js`; one path-string change (V-2 was spec-only at amendment time, no Gate 5 code shipped). Status remains PARTIAL — §I §IV §V §VI sections still pending corresponding V-decisions. Implementation deferred to Gate 5 — this commit is spec + doctrine.
- 2026-04-28 (later same day) — **§V RESOLVED + §II.2 + §III.3 amended with token bindings.** V-color-tokens vocabulary filled in after 5-specialist roundtable. All five V-color.* sub-decisions resolved long-term-aggressive: V-color.1 = verbose-explicit concept-class-prefixed naming; V-color.2 = categorical hex migration NOW per V-1-safe migration table (Fish hot-pink, LAG deep-orange, TAG cyan-teal, LP violet); V-color.3 = `design-tokens.js` canonical for STYLE_COLORS / STYLE_TOKENS consolidation (`stats-engine.js:STYLE_COLORS` becomes re-export wrapper); V-color.4 = R-1.9 doctrine rule NOW with INV-TOKEN-1..5 behavioral invariants (closes the v3 Option II token-isolation deferral); V-color.5 = mirror-lock test NOW (`shared/design-tokens.js` ↔ `src/constants/designTokens.js` parity enforcer). Two-layer token graph (Layer 1 module-private primitives + Layer 2 exported semantic tokens via `Object.freeze(TOKENS)`). Quality-tier hex pool reserved for ALL ordinal concept-classes (confidence + freshness + fold-% + M-ratio + EV + priority); each consumes via concept-class-distinct CSS variable name. M-tokens renamed (`--m-green/yellow/orange/red` → `--m-zone-safe/warning/danger/critical`); fold-% gradient gets dedicated `--fold-pct-*` tokens; `shared/tier-thresholds.js` extracted for shared ordinal classifier. `--conf-tier-*` and `--fresh-tier-*` token entries added to `design-tokens.js` (previously CSS class names with no token backing — V-2 / V-3 implementations would have hardcoded hex without this). `shared/design-tokens.meta.js` companion file authored for automated D-2 violation detection. Doctrine v5 amendment authored inline — adds R-1.9 binding rule + INV-TOKEN-1..5. §II.2 + §III.3 binding citations updated to specify exact tokens. **Required co-shipping:** ~46 hex literals in `side-panel.html` swept to `var(--token)` + 51 `--m-*` references renamed (42 in side-panel.html) + STYLE_COLORS / STYLE_TOKENS consolidation + meta file + deprecation alias mechanism in `injectTokens()` + 24-fixture rebaseline (4-7 fixtures expected to diff at categorical hex level) + 3 new test files (`design-token-registry.test.js`, `token-concept-class-collision.test.js`, mirror-lock cross-file test). Status remains PARTIAL — §I §IV §VI sections still pending. Implementation deferred to Gate 5 — this commit is spec + doctrine.
- 2026-04-28 (third edit same day) — **§IV RESOLVED + R-1.5 text amended + §V cross-cutting extended.** V-affordance vocabulary filled in after 5-specialist roundtable + V-afford.3 codebase verification (`side-panel.html:1266` confirmed `.deep-section.open .deep-chevron { transform: rotate(180deg) }` exists — Gate 3 inventory CC-D-1 vs CC-D-2 chevron-direction "inconsistency" finding was observational drift, not real CSS divergence; the existing-correct contract is uniform). All V-afford.1–V-afford.5 sub-decisions resolved long-term-aggressive: V-afford.1 = 6 shapes (cto-agent's framing — chevron / underline / pill / circle / divider / decorative-glyph); V-afford.2 = R-1.5 text amendment + R-1.10 NEW with INV-AFFORD-1..5 (failure-engineer's behavioral-invariants case under strengthened lens); V-afford.3 = deep-chevron rotation VERIFIED (no grandfathered exception needed); V-afford.4 = INV-AFFORD-4 grandfathered allowlist with explicit Gate 5 milestone for keyboard-reachability remediation; V-afford.5 = long-press deferred to V-affordance v2 (no current sidebar use case). Closed glyph registry of 4 (★ ♦ ● →) + `chip` sub-form for hand-plan branch labels (disambiguates pill double-use). ARIA contract mandated per shape (chevron → role=button + aria-expanded; pill → role=button + aria-label; circle → role=button + aria-pressed + aria-label; divider → role=separator; decorative-glyph → aria-hidden=true). Extracted `shared/render-affordance.js` per V-2/V-3 precedent. Single delegated listener click-wiring pattern via `data-affordance` attributes — eliminates handler-on-detached-element race with V-3 scheduleRender (failure-engineer's structural-guarantee finding). Doctrine v6 amendment authored inline — R-1.5 text amended + R-1.10 NEW + INV-AFFORD-1..5. **§V cross-cutting amendment:** new `--action-class-*` concept-class (CALL/BET/RAISE/FOLD pill coloring) + `--affordance-*` concept-class (chevron/underline/pill state colors). **Required co-shipping (8 items):** `shared/render-affordance.js` module + 4 parallel chevron CSS classes collapsed to `.affordance-chevron` (D-4 forensics) + click-wiring consolidation per `data-affordance` pattern (eliminates handler-races) + `affordance-registry.test.js` + `dom-mutation-discipline.test.js` extension + `.show-toggle-btn` element-type fix (`<button>` → `<a>`/`role="link"`) + `render-orchestrator.js:147` `||` → `??` fix (pinned-villain sample-size substitution bug, already in §III.7) + hero seat-arc ring migration to non-color encoding (V-1 (c) compliance — ★ glyph is canonical hero indicator). New forensics: D-4 (chevron CSS-class proliferation: 4 parallel definitions + 9 emit sites in render-tiers.js), D-5 (click-affordance signposting bimodality: 14+ `cursor: pointer` declarations with no class-level affordance association). Status remains PARTIAL — §I + §VI still pending. Implementation deferred to Gate 5 — this commit is spec + doctrine.
- 2026-04-28 (fourth edit same day) — **§I RESOLVED + §V cross-cutting extended (3rd time) + §II.3 cross-cutting (connection-status registry MOVES to §I.3).** V-status vocabulary filled in after 5-specialist roundtable. All V-status.1–V-status.5 sub-decisions resolved long-term-aggressive: V-status.1 = R-1.11 NEW + INV-STATUS-1..5 (rejecting cto-agent's "no new rule" position per strengthened lens — fourth consecutive doctrine amendment with binding lint-test + spec-only-is-wishlist pattern explicitly rejected); V-status.2 = 3-axis sub-prefix (`--status-conn-*` + `--status-app-*` + `--status-pipeline-*`); V-status.3 = new `_P.orange_status` Layer 1 primitive distinct from `_P.orange_deep` (avoids INV-TOKEN-2 collision with `--cat-style-lag-text` + `--m-zone-danger`); V-status.4 = `versionMismatch` classified as fatal tier (red dot + recovery banner); V-status.5 = 30s connected-waiting threshold escalating to `connected-timeout` state. 3-axis decomposition: connection-state (4 values: live/degraded/disconnected/fatal) → dot; app-bridge-state (2 values: synced/absent) → badge; pipeline-stage-health (per-stage binary: nominal/failed) → strip (visibility-gated to `!hasHands`). Recovery banner = emergency-tier R-3.1 (correctly tiered today; banner DOM outside `#hud-content`). **Architectural finding A-A widened from dual-writer to 5-writer** via cto-agent + senior-engineer + failure-engineer codebase verification: `side-panel.js:198-218` (renderConnectionStatus) + `:785-794` (updateStatusBar) + `:1847-1848` (renderAll inline override during staleContext — currently causes FM-STATUS-1 silent severity downgrade in production: contextDead red dot overwritten to yellow in same frame, untested) + `:2590-2593` (updateStatusFromDiag) + `harness.js:81` (test-fixture, grandfathered allowlist). Comment at line 136 ("renderConnectionStatus owns all status-dot writes") is documentary, not enforced. **6 new FM-STATUS-1..6 forensics surfaced** by failure-engineer including FM-STATUS-1 silent-severity-downgrade currently shipping. Extracted `shared/render-status.js` per V-2/V-3/V-affordance precedent: pure classifier `classifyStatus({connState, pipeline, handCount, appConnected})` returning 3-axis state struct; HTML emitters `renderStatusDot` / `renderAppStatusBadge` / `renderPipelineStrip`. 5 writer sites consolidated to 1 (`renderConnectionStatus` becomes sole writer; `staleContext` inline override REMOVED — closes FM-STATUS-1; `versionMismatch` dot-class assignment added at `:215-217` — closes FM-STATUS-2; `updateStatusFromDiag` migrated to dispatch; `updateAppStatus` orphan routed through render snapshot). Doctrine v7 amendment authored inline — adds R-1.11 binding rule + INV-STATUS-1..5 (single-writer per Z0 slot, severity monotonicity within render frame, no-lying-status, connected-waiting escalation, app-bridge staleness clearing). **§V cross-cutting amendment (3rd time):** `--status-conn-{live, degraded, disconnected, fatal}` + `--status-app-{synced, absent}` + `--status-pipeline-{nominal, failed}` (8 entries) + new `_P.orange_status` Layer 1 primitive. **§II.3 cross-cutting:** `connection-status` row REMOVED from §II.3 freshness registry; MOVES to §I.3 status registry per §II.4 boundary clarification. **§II.9 co-shipping #1 amended** from "dual-writer resolution" to "5-writer consolidation". **Required co-shipping (12 items):** `shared/render-status.js` module + 5-writer consolidation + `staleContext` inline override REMOVED + `versionMismatch` className fix + `updateStatusFromDiag` migration + `updateAppStatus` orphan migration + `--status-*` tokens + `_P.orange_status` primitive + `status-registry.test.js` + dom-mutation-discipline.test.js extension + `STATE_FIELD_SCOPES.md` `lastGoodExploits` clearing-path extension (`connection:appDisconnected` added) + ARIA contract (`role="status"` + `aria-live="polite"` ambient; `role="alert"` + `aria-live="assertive"` recovery banner — only assertive site in sidebar) + INV-STATUS-4 timer registration (`coordinator.scheduleTimer('connectedWaitingTimeout', 30_000)`). Comprehensive ARIA mandate per shape closes the "only 1 `aria-expanded` site in entire codebase" accessibility gap. **Gate 4 reaches §I + §II + §III + §IV + §V resolved (5 of 6 sections); only §VI density remains.** Status PARTIAL until §VI lands; implementation deferred to Gate 5 — this commit is spec + doctrine.
