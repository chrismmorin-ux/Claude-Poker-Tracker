# Contract — Sidebar (Ignition Extension) ↔ OnlineView Read Surface

**ID:** `sidebar-to-online-view`
**Status:** DOCUMENTED 2026-05-11; bridge protocol enforced by `@extension-shared/wire-schemas.js` validators at the boundary.
**Scope:** the message-protocol + state-context boundary between the Ignition Chrome extension (in-browser HUD) and the main app's `OnlineView` (post-session study surface). Documents which surface owns which state, what crosses the bridge, and the explicit *no-handoff* invariants that prevent dual-surface contamination.
**Last reviewed:** 2026-05-11
**Surfaced:** [WS-079 / DCOMP-W4-A3-F10](../../../.claude/workstream/queue/WS-079.yaml) — long-deferred boundary contract; ratified by SPR-072.

---

## Why this contract matters

The sidebar and `OnlineView` look superficially similar — both render villain seat data, both display advice, both show tournament state. But they are **different surfaces with different ownership and different consumers:**

- **Sidebar** is the live in-browser HUD. It runs inside the Chrome extension's side panel, reads its state from the `chrome.runtime.Port` message stream, and is bound to the user's 1.5s mid-hand glance budget (`mid-hand-chris`). It owns its own selection state (`pinnedVillainSeat`), its own freshness machinery (`currentLiveContext` 30s staleness timer), and renders via the pure `render-*` modules in `ignition-poker-tracker/side-panel/`.
- **OnlineView** is the in-app aggregation/study surface. It renders inside the main React tree, reads through React context (`SyncBridgeContext` + `OnlineSessionContext` + `AnalysisContext`), and is bound to the post-session / between-hands review budget. It owns its own selection state (`selectedSeat`), its own pagination across sessions, and renders via the `OnlineView/` component tree.

Past bugs in this area collapsed when the two surfaces' boundaries were confused — for example, attempting to thread sidebar's pinned villain into the app's analysis context (which would override per-decision villain selection), or assuming hand-import events trigger an OnlineView re-render before the user has selected the session. This contract makes the boundary explicit so future sessions adding a new analytics surface know:

- What state lives on which side of the bridge.
- Which messages cross, and in what direction.
- What is **deliberately not shared** (and why).

---

## Canonical shape — the bridge

### Message protocol

Both surfaces sit behind `BRIDGE_MSG` defined in `ignition-poker-tracker/shared/constants.js:95-106`. The main-app side imports through `@extension-shared/constants.js` (alias defined in `vite.config.js`). `PROTOCOL_VERSION = 2`; bumps are observable as `versionMismatch` in `SyncBridgeContext`.

| Direction | Message | Payload shape | Frequency | Validator |
|---|---|---|---|---|
| **Ext → App** | `POKER_SYNC_HANDS` | `{ hands: HandRecord[] }` | Burst — on every completed hand observed by the WebSocket probe | `validateHandRecord()` per record before `saveOnlineHand()` |
| **Ext → App** | `POKER_SYNC_HAND_STATE` | `{ liveContext: LiveContext }` | Streaming — on every street advance / action observed mid-hand | `validateLiveContext()` |
| **Ext → App** | `POKER_SYNC_STATUS` | `{ extProtocolVersion, extManifestVersion, ... }` | Heartbeat — periodic + on extension reload | `validateStatus()` |
| **App → Ext** | `POKER_SYNC_ACK` | `{ handId, captureId }` | Per accepted hand | (no validator; ack is fire-and-forget) |
| **App → Ext** | `POKER_SYNC_EXPLOITS` | `{ seats: ExploitSeat[] }` | On tendencyMap recompute (debounced) | `buildExploitSeat()` shape builder |
| **App → Ext** | `POKER_SYNC_ACTION_ADVICE` | `ActionAdvice` (per current decision) | On advice recompute | `buildActionAdvice()` shape builder |
| **App → Ext** | `POKER_SYNC_TOURNAMENT` | `TournamentSnapshot` | On tournament state change | `buildTournament()` shape builder |
| **App → Ext** | `POKER_SYNC_ERROR` | `{ code, message, context }` | On schema-validation failure or import error | `buildErrorReport()` shape builder |

**Authoritative source:** `ignition-poker-tracker/shared/wire-schemas.js` (shape builders + validators) + `ignition-poker-tracker/shared/constants.js` (message-type enum). If this doc and the schemas disagree, the schemas win. Update this doc in the same commit as any schema change.

### State ownership per side

| State | Owner | Lifetime | Visible to other side? |
|---|---|---|---|
| `pinnedVillainSeat` (sidebar) | `side-panel.js` IIFE | Until table switch / user unclick | **No** — sidebar-internal selection |
| `selectedSeat` (OnlineView) | `OnlineView.jsx` local `useState` | Until session switch / user unselect | **No** — view-internal selection |
| `liveContext` | `side-panel.js` (`currentLiveContext`) ←← `app-bridge` ←← `service-worker` ←← capture probe | 30s staleness timeout on sidebar; persisted to IDB via app | **App receives** the latest via `HAND_STATE`; the sidebar's own `currentLiveContext` is independently freshness-tracked |
| `tendencyMap` | `useAnalysisContext` (main app) | Computed from IDB hands | **Sidebar receives** via `EXPLOITS` push (transformed via `buildExploitSeat`) |
| `advice` | `useAnalysisContext` (main app) | Recomputed on tendencyMap + liveContext change | **Sidebar receives** via `ACTION_ADVICE` push (transformed via `buildActionAdvice`) |
| `tournament` | `useTournament` (main app) | See `tournament-to-table.md` | **Sidebar receives** via `TOURNAMENT` push |
| `versionMismatch` | `useSyncBridgeImpl` (main app) | Until extension reload + protocol re-handshake | **Ext-side**: tracked separately in `service-worker.js` as part of `STATUS` payload |
| `dismissedDespiteMismatch` | `useSyncBridgeImpl` (main app) | sessionStorage; until page reload or explicit clear | **No** — user-experience override on app side; sidebar continues to push regardless |

---

## Writers

| Writer | Side | Entry point | What it writes |
|---|---|---|---|
| Capture probe (`capture-websocket-probe.js` MAIN world) | Ext | window.postMessage → `ignition-capture.js` ISOLATED world | Raw protocol frames |
| `ignition-capture.js` ISOLATED | Ext | `chrome.runtime.Port` → service worker | Parsed `HandRecord` + `LiveContext` |
| `service-worker.js` | Ext | port broadcasts to side panel + `app-bridge` | Replay buffer (24h) + relay to side panel/app |
| `app-bridge.js` | Ext | `window.postMessage(BRIDGE_MSG.*)` | App-bound messages (HANDS / HAND_STATE / STATUS) |
| `useSyncBridgeImpl.pushExploits` | App | `window.postMessage(BRIDGE_MSG.EXPLOITS)` | tendencyMap → ExploitSeat[] |
| `useSyncBridgeImpl.pushAdvice` | App | `window.postMessage(BRIDGE_MSG.ACTION_ADVICE)` | advice → ActionAdvice |
| `useSyncBridgeImpl.pushTournament` | App | `window.postMessage(BRIDGE_MSG.TOURNAMENT)` | tournament state → TournamentSnapshot |

Pushes from app to extension happen at the **AppRoot level** — see `OnlineView.jsx:1-9` doc header: "All analysis, advisor, and extension push logic runs at app-root level so advice flows even when this view isn't active." OnlineView is a **reader** of state that drives pushes; the pushes themselves are not OnlineView-gated.

---

## Readers

| Reader | Side | Entry point | What it reads |
|---|---|---|---|
| `side-panel.js` IIFE | Ext | port message handlers | All inbound from `service-worker`; assembles UI state |
| `render-orchestrator.js` (+ siblings) | Ext | function args | Sidebar UI state → DOM strings |
| `OnlineView.jsx` | App | `useSyncBridge()` (connection + import state) | `isExtensionConnected`, `versionMismatch`, `importedCount`, `syncError`, `postReloadStatus`, etc. |
| `OnlineView.jsx` | App | `useOnlineSession()` | `selectedSessionId`, `onlineSessions`, `loadSessions` |
| `OnlineView.jsx` | App | `useAnalysisContext()` | `tendencyMap`, `handCount`, `isLoading`, `advice` |
| `useAnalysisContext` consumers across the app | App | context | Tendency/advice values; not OnlineView-specific |

---

## Invariants

1. **Bridge is the only legal cross-surface channel.** Sidebar and OnlineView do not share React state, do not share IDB transactions directly, do not poke each other's DOM. Every shared signal crosses through one of the 8 `BRIDGE_MSG` types. If a future feature wants something shared, the answer is "add a message type to `BRIDGE_MSG`," not "thread a ref through somewhere."
2. **Selection state is per-surface.** Sidebar's `pinnedVillainSeat` and OnlineView's `selectedSeat` are independent. The user picking a villain in the HUD does not select a seat in OnlineView, and vice versa. This is deliberate — the two surfaces serve different decision moments (live HU vs. post-hand review) and forcing sync would create stale-cursor bugs.
3. **`PROTOCOL_VERSION` mismatch is a hard error.** When `extProtocolVersion !== PROTOCOL_VERSION` (verified at `useSyncBridgeImpl` STATUS handling), `versionMismatch` flips true. Hand imports are suppressed until either (a) the extension reloads to a matching version or (b) the user explicitly `dismissDespiteMismatch` — and even then live-advice pushes stay suppressed (WS-077 close-out). See `OnlineView.jsx:108-147` for the user-facing pip + banner.
4. **`importedCount === 0` is the empty-state gate.** Until at least one hand crosses the bridge (or is imported via JSON), OnlineView renders the empty-state CTA, not a degenerate grid. Same gate hides the SeatGrid render.
5. **Push direction is app → ext.** EXPLOITS / ACTION_ADVICE / TOURNAMENT messages are computed in the main app and pushed to the extension HUD. The extension never asks for them; the app pushes on tendencyMap / advice / tournament recompute. If a future feature needs ext-initiated pulls, that's a protocol-shape change worth its own design review.
6. **No deep-link from sidebar to OnlineView today.** Sidebar runs in the Chrome side panel; clicking a sidebar villain badge does **not** open OnlineView's per-seat panel. The two surfaces are loosely coupled by the data they share. Adding a deep-link is non-trivial — the sidebar lives in a separate process from the React tree and would require a new BRIDGE_MSG + a routing handshake.
7. **Hand-import is the only persistence handoff.** Hands written via `saveOnlineHand()` are deduplicated by `captureId` and rendered uniformly by every downstream consumer (OnlineView, HandReplay, Sessions, Analysis). The sidebar does not write to IDB directly; everything it surfaces is in-memory + replay-buffered in the service worker.
8. **STATE_FIELD_SCOPES discipline applies on both sides of the table switch.** When the user changes table in the extension, the sidebar clears `pinnedVillainSeat`, `lastGoodAdvice`, `lastGoodTournament`, `currentLiveContext` (per `ignition-poker-tracker/CLAUDE.md` anti-patterns). The main app's per-session selection (`selectedSessionId`) is independent — table switch in the sidebar does **not** force OnlineView to re-select a session. This is intentional: OnlineView is a study surface, not a live mirror.

---

## Deliberate no-handoffs

The following are **explicitly not shared** across the bridge. Each refusal has a reason; do not paper over them without re-litigating:

- **`pinnedVillainSeat` ↔ `selectedSeat`** — different decision moments; syncing creates stale-cursor bugs in post-hand review (see Invariant 2).
- **OnlineView's `selectedSessionId` ↔ sidebar's active table** — OnlineView is post-hoc study; forcing it to follow the active table breaks the user's review flow when a new hand starts.
- **Mid-hand DOM events** — sidebar does not animate or rerender OnlineView. Cross-process React updates would require a synthetic event loop that doesn't exist.
- **User input on either side** — clicks in OnlineView (seat-detail-panel expansion, recommendation drill-down) do not surface as bridge messages. The bridge is for shared *state*, not shared *user actions*.

---

## Code enforcement

- **Bridge protocol:** `@extension-shared/wire-schemas.js` defines builders + validators for every payload shape. Used by `useSyncBridgeImpl` to validate inbound `HANDS` / `HAND_STATE` / `STATUS` before processing. Failed validation routes to `buildErrorReport()` + ERROR_REPORT push back to ext, **not** a silent swallow.
- **Hand format:** `@extension-shared/hand-format.js` `validateHandRecord()` runs per record in `importHands()` before `saveOnlineHand()`. Schema drift at the per-hand level fails loud.
- **Version handshake:** `useSyncBridgeImpl` STATUS handling compares `extProtocolVersion` vs imported `PROTOCOL_VERSION`. Mismatch → `setVersionMismatch(true)` → UI banner + advice suppression.
- **Test coverage:**
  - `src/hooks/__tests__/useSyncBridge.test.js` — handshake, version-mismatch, dedup, post-reload-status transitions.
  - `ignition-poker-tracker/side-panel/__tests__/render-orchestrator.test.js` (133 DOM integration tests) — sidebar-side rendering integrity, including state-clear discipline on table switch.
  - `src/components/views/OnlineView/__tests__/OnlineView.invariants.test.jsx` — view-side invariants.
  - No single end-to-end test currently exercises both sides simultaneously. Adding one is reasonable backlog material when bridge bugs surface that cross both surfaces.

---

## Known drift

- **No deep-link from sidebar to OnlineView (Invariant 6) is a feature today, but may grow into a JTBD ask.** Post-Session Chris wants "review this hand from the sidebar" — currently they do this by switching to the app and finding the hand in OnlineView or HandReplay. If the JTBD escalates, the design move is a new BRIDGE_MSG (`OPEN_IN_APP` or similar) routed through the service worker → window.location, **not** a synchronization of selection state.
- **App-side pushes happen at AppRoot, not at OnlineView mount.** This is correct (per `OnlineView.jsx:1-9`) but counterintuitive — readers of OnlineView code may assume the view is the writer when in fact it's downstream of the push pipeline. The contract here is the disambiguator.
- **`importedCount` is currently a single counter across all online sessions, not per-session.** OnlineView's session selector + the bridge's count are visible-but-not-coupled. If a per-session count becomes a JTBD, add it to `useOnlineSession` rather than threading through the bridge.
- **`STATE_FIELD_SCOPES` registry (failure-library reference) governs table-switch state clearing on the sidebar.** The main-app side has no equivalent registry; the post-table-switch behavior on the app side is "no auto-clear" (OnlineView stays on the previously-selected session). This is asymmetric *by design* but readers should know.

---

## Change protocol

To change this contract safely:

1. **Adding a `BRIDGE_MSG` type:** add to `ignition-poker-tracker/shared/constants.js:95-106`, add builder + validator in `wire-schemas.js`, wire app-side handler in `useSyncBridgeImpl`, wire ext-side handler in `service-worker.js` + `app-bridge.js`. Bump `PROTOCOL_VERSION` if existing message shapes change. Document the new message in the table above in the same commit.
2. **Removing or renaming a `BRIDGE_MSG` type:** bump `PROTOCOL_VERSION`. Users on the old extension will see `versionMismatch` until they reload to the new version. Update both sides + docs in the same commit.
3. **Changing a payload shape:** update the builder + validator in `wire-schemas.js`, bump `PROTOCOL_VERSION`, audit every Reader of the changed shape on both sides. The validator failure path (ERROR_REPORT push) handles in-flight messages from outdated peers safely.
4. **Adding a new state-ownership row** to the table above: declare which side owns it, what its lifetime is, whether it crosses the bridge. If it crosses, you need a `BRIDGE_MSG`. If it doesn't, document the no-handoff reason.
5. **Loosening or tightening an invariant:** open a design-program ticket. Invariants 1, 2, 5, 6 are load-bearing; changing them probably means a Gate 2 blind-spot roundtable for the consequences (e.g., adding deep-link from sidebar to OnlineView would force a new persona/JTBD walkthrough for the cross-surface seam).

---

## Relationship to neighboring contracts

- **`persisted-hand-schema.md`** — once a hand crosses the bridge via `HANDS` and is persisted by `saveOnlineHand()`, it lives in the `hands` IDB store under the schema documented there. OnlineView, HandReplay, AnalysisView all read it from there. The bridge does not preserve transient fields that aren't in the persisted schema.
- **`tournament-to-table.md`** — `pushTournament` message payload mirrors a subset of the `TournamentContext` read surface documented there. Tournament state shape changes must be audited against *both* contracts.
- **`ignition-poker-tracker/CLAUDE.md`** — sidebar-side architecture + anti-patterns ("Never set state without clearing stale," "Never accept advice without validation"). Read for context when authoring new sidebar-side behavior.
- **`src/utils/persistence/STATE_FIELD_SCOPES`** — registry from the Sidebar Rebuild Program; documents the "what clears on what" discipline. Main app currently has no equivalent registry; if a similar discipline becomes load-bearing on the app side, add one.

---

## Change log

- 2026-05-11 — Created per WS-079 (DCOMP-W4-A3-F10), ratified by SPR-072. 8 BRIDGE_MSG types documented across both directions, 8 state-ownership rows, 8 invariants, 4 deliberate no-handoffs surfaced. Closes the long-deferred boundary-contract gap; sits alongside `persisted-hand-schema.md` + `tournament-to-table.md`.
