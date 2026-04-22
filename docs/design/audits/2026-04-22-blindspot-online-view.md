# Blind-Spot Roundtable + Audit — 2026-04-22 — OnlineView

**Type:** Combined Gate-2 pre-audit blind-spot check + Gate-4 heuristic audit (DCOMP-W4-A3)
**Trigger:** Roadmap-mandated Gate 2 for online-view because the surface crosses product lines (main app + extension sidebar).
**Participants:** Claude synthesis (product-ux + systems-architect + cross-product perspectives), grounded in personas + surface artifact.
**Artifacts read:** `surfaces/online-view.md`, `OnlineView.jsx` (199 lines), `PokerTracker.jsx` routing, core personas (multi-tabler, online-mtt-shark, hybrid-semi-pro, rounder), `SIDEBAR_DESIGN_PRINCIPLES.md` (referenced not re-audited), `SYSTEM_MODEL.md` cross-product sections, `STATUS.md` sidebar program history (SR + STP).
**Method:** Code inspection + Playwright live walk (discovered the OnlineView is not routed from the nav and attempted to force-navigate; reverted to code-inspection when auto-route wasn't triggerable without an active Ignition extension).
**Status:** Draft.

---

## Executive summary

**Verdict: RED.** The most consequential finding is a **discoverability defect at the product boundary itself** — OnlineView has no manual nav entry. The sidebar nav shows "Extension" (routes to `ExtensionPanel`, a standalone extension embed) but NOT "Online" — OnlineView is only reachable via auto-route when the extension sends its first payload on a fresh install. A user without an active Ignition extension has no path to OnlineView, even though Import-from-File is one of its only two primary empty-state actions. Plus the standard destructive-action anti-patterns: `alert()` on import failure, `window.location.reload()` on version mismatch (loses in-memory state silently), multiple touch targets under 44×44. Plus the surface-wide visual-token gap: OnlineView is built with inline styles, not Tailwind, so a design-token migration lag is visible. 5 P0 / 5 P1 / 3 P2 / 3 P3. Unblocks W5 only after P0s ship.

**Distinctive cross-product finding:** ExtensionPanel and OnlineView are routed as separate screens (`SCREEN.EXTENSION` vs `SCREEN.ONLINE`), but the surface artifact documents ExtensionPanel as a sub-component of OnlineView. Artifact-code-routing triangle is inconsistent. Gate-2 surfaces what a pure heuristic audit would miss.

---

## Gate 2 — Blind-spot roundtable

### Stage A — Persona sufficiency

**Output: ⚠️ PATCHES NEEDED + 1 service-contract ambiguity**

#### A1 — Multi-Tabler has no sub-persona for "between tables"
Core `multi-tabler.md` covers 4–8 simultaneous tables. The situational cognitive load when the user is actively playing 4 tables + switching focus every 8 seconds is very different from sitting at 1 table (what most personas model). `between-hands-chris` explicitly models cash-game single-table between-hand cognition. No equivalent for multi-tabling. Gap: **new situational persona** `multi-tabler-switching.md`.

#### A2 — Online MTT Shark persona service-contract with OnlineView is under-specified
Listed as primary served by this view, but the surface's own note says sharks "usually via the sidebar; this view is post-session context." What IS "post-session context" concretely? Is it session review? Villain study? ROI tracking? Without a named use-case, we can't measure whether the view serves the persona. Gap: **explicit use-case statement** — either "Online MTT Shark uses OnlineView for post-session villain study" (then verify the view supports that) OR drop the persona claim.

#### A3 — Hybrid Semi-Pro cross-format handoff not modeled
Hybrid Semi-Pro switches between live cash (TableView) and online MTT (sidebar + this view). The moment-of-switch — closing a live session, opening the extension, importing an old JSON — has no situational persona. Gap: **consider** `hybrid-context-switch.md` if cross-format is frequent enough. Or defer.

#### A4 — Rounder listed "occasional online" but surface offers no path for occasional users
Rounders import an occasional JSON file (tournament result, home-game export). The view gates them through the same extension-connected chrome + seat grid + tendency analysis that a daily multi-tabler needs. A Rounder who just wants to see a single imported hand file has excessive chrome. Gap: **"single-import" lightweight state** not served. Could be a P2 finding in Stage B rather than a persona gap.

---

### Stage B — JTBD coverage

**Output: ⚠️ 3 GAPS + 1 misclaim**

#### B1 — No JTBD for "discover what my sidebar advice is based on"
Online MTT Shark at a multi-way flop, sidebar says "fold", shark wants to know *why*. Clicking the sidebar zone might open a details overlay (sidebar-specific, Wave 5). But if the shark is tabbed away from the poker client, is OnlineView the right surface to answer "why did the sidebar say fold 11 hands ago"? Currently, OnlineView doesn't bridge this — it shows current tendency + advice, not *history of past advice with reasoning*. Gap: **new JTBD** likely MH-20 or SR-45 domain.

#### B2 — No JTBD for "verify the extension is receiving hands correctly"
User installs the extension, plays a hand, sees `importedCount: 1`. Is that expected? What about N+1? The surface has `importedCount` as a number — no JTBD says "the user needs to verify capture is working end-to-end." The current UX assumes "we count up therefore it's working" — without the user knowing what count to expect after their hand. Gap: **new JTBD** in MT (multi-tenant/multi-device) domain: "verify extension capture matches played hands."

#### B3 — MH-01 (see recommended action for current street) is claimed but the live surface is the sidebar
Surface artifact lines 36–37: "JTBD-MH-01 see the recommended action for the current street (cross-surface; live surface is sidebar)." So OnlineView claims it but defers live delivery to the sidebar. If sidebar is the live delivery, why is MH-01 on OnlineView's served list at all? Gap: **either** drop the MH-01 claim OR explicitly state "OnlineView post-hoc mirror of the advice that was shown live on the sidebar."

#### B4 — DE-72 (raw JSON import) is served but the button is hidden
The Import from File button is in the empty state AND a small button below the populated state (per code). But the whole empty state is only reachable by navigating to OnlineView, which as established has no manual nav entry. **So the JTBD is served by a feature whose entry point is unreachable by intent.** Gap: **discoverability defect at DE-72.** This is the headline finding.

---

### Stage C — Situational stress test

**Output: ❌ FUNDAMENTAL DISCOVERABILITY DEFECT + destructive-action gaps**

#### C1 — OnlineView has no manual nav entry — surfaced by Playwright walk
**Verified 2026-04-22 via Playwright:** The main-app nav has 7 buttons (Stats, Hand Review, Sessions, Players, Analysis, Extension, Settings). No "Online" button. Clicking "Extension" routes to `SCREEN.EXTENSION` → `<ExtensionPanel />` (standalone extension embed showing an empty seat grid + "IDLE" status). `SCREEN.ONLINE` → `<OnlineView />` exists as a route but has no UI entry point. Users can only reach it via auto-route on first extension payload.

This is **P0**. A user who imports a hand file with no extension installed (legitimate Rounder / Coach / analyst use case per A4) has no path. A user who previously reached OnlineView via auto-route + then navigated away can't return. Discoverability broken for every persona except "extension is actively pushing payloads right now."

#### C2 — `alert('Import failed: ' + err.message)` on file-import error
`OnlineView.jsx:43`. Native alert — same anti-pattern class as Wave 1 `confirm()` removals. P0 finding. Fix: replace with toast (error variant) that renders err.message + a retry affordance.

#### C3 — `window.location.reload()` on version-mismatch banner
`OnlineView.jsx:79`. Full page reload. In-memory analysis state is wiped. The user's session-selector choice, seat selection, any unsaved work — all lost. No confirmation. Per the error's nature (extension version mismatch) a reload may be the correct fix, but the current flow gives no undo and no "pause and tell me what broke" state. P0 finding. Fix: confirm-before-reload with diagnostic preview (e.g., "Extension v1.4.2 vs main-app v1.5.0 — reload to refresh the extension contract?"). Ideally the mismatch detection captures what specifically is incompatible and surfaces it before reload.

#### C4 — "Continue Anyway" on version-mismatch banner masks real incompatibilities
Surface artifact acknowledges this: "Version-mismatch resolution — 'continue anyway' may mask real incompatibilities; richer diagnostic UI could help." Dismissing the banner silences the warning but doesn't verify the capture pipeline is still valid. The user gets mixed-state data with no indication. P1 finding. Fix: "Continue Anyway" should degrade gracefully — maybe show a persistent amber pip in the "Extension connected" indicator, and log the mismatch to a persistent diagnostic so it can be reviewed later.

#### C5 — Import-from-File has no loading state
`handleFileImport` (`OnlineView.jsx:35-46`): reads file, parses JSON, calls `importFromJson`, calls `loadSessions`. Between click and completion, no progress or disabled state. Large imports (thousand-hand JSON archives) could take seconds. No indication that the import is in progress. P1 finding. Fix: disable the button + show spinner during import; surface count of hands-being-imported.

---

### Stage D — Cross-product / cross-surface

**Output: ❌ MAJOR ARTIFACT-CODE DRIFT + cross-surface gaps**

#### D1 — ExtensionPanel is routed as a SEPARATE screen (SCREEN.EXTENSION) but the surface artifact lists it as a sub-component of OnlineView
Surface artifact `online-view.md` line 10: `./ExtensionPanel.jsx` listed as a code path of OnlineView.
Routing `PokerTracker.jsx:104-105`: `SCREEN.ONLINE → <OnlineView />` and `SCREEN.EXTENSION → <ExtensionPanel />` — TWO SEPARATE SCREENS.

This is the same class of artifact-code drift the 2026-04-22 TournamentView audit caught (Undo button described in artifact but not in code). The artifact says the component composes one way; the routing says another. Which is canonical? Needs resolution.

P0 finding (artifact-code consistency). Fix options: (a) if `ExtensionPanel` is meant to be an OnlineView sub-component, remove `SCREEN.EXTENSION` route; (b) if `ExtensionPanel` is intentionally a separate screen (e.g., a dedicated live-sidebar preview), update the surface artifact to reflect that, and create a new surface artifact for ExtensionPanel at `surfaces/extension-panel.md`.

#### D2 — Sidebar ↔ OnlineView handoff not documented
Surface artifact line 53: "Sidebar-specific personas (Multi-Tabler, Online MTT Shark) are canonically served on the sidebar surfaces (Z0–Z4); this view is the main-app counterpart." No document names the handoff:
- When should a user open OnlineView vs. stay in the sidebar?
- Does selecting a seat in OnlineView feed anything back to the sidebar (e.g., "focus this seat in live advice")?
- Is there a cross-surface link from the sidebar to OnlineView (for post-hand review)?

P1 finding. Fix: contract doc `contracts/sidebar-to-online-view.md` describing the handoff (even if the conclusion is "they're intentionally isolated — user manually switches").

#### D3 — "Online Sessions" missing from SessionsView — surface artifact's known gap
Surface artifact line 118: "No 'Online Sessions' tab in the main SessionsView." Online captures are stored in the shared `sessions` store but undifferentiated. Users can't tell "which sessions came from the extension" without opening each. This is a cross-surface finding — on SessionsView's side, SV-F7 in Wave 1 shipped an All/Live/Online filter pill. Does that pill work for online sessions imported from the extension? Verification needed. P2 finding.

#### D4 — Main-app settings don't flow to extension; extension's config doesn't flow back
Surface artifact line 131: "The main app has venue / game defaults; online captures use the extension's config and don't inherit main-app settings." No JTBD names this as a served outcome; no cross-surface invariant captures it. P2 finding for documentation; P1 if the invariant is material to analysis correctness.

---

### Stage E — What the Gate-4 audit might miss

**Output: 4 items to watch for**

#### E1 — Visual-token migration gap on the whole view
OnlineView is 199 lines of `style={{ ... }}` inline objects. The rest of the app uses Tailwind + design tokens. A heuristic audit checking for "inconsistent styling" might find dozens of instances; this is one audit item, not dozens. Audit-watch: treat the inline-style gap as a single finding, not a finding per inline-style.

#### E2 — Empty state and populated state have DIFFERENT Import-from-File buttons
Empty state: `padding: '8px 16px', fontSize: 13`. Populated state (`handCount > 0`): `padding: '6px 12px', fontSize: 11`. Same action, different sizes, different visual prominence. Pattern: the populated state treats Import as secondary because extension push is primary — but for a Rounder who imports occasionally, the button size-shrink is not aligned with their task importance. Audit-watch.

#### E3 — `selectedSeat` is an extension-sourced ID, not a main-app seat number (1..9)
Surface artifact flags this: "Seat IDs are extension-sourced — `selectedSeat` is an extension seat ID, not a main-app seat 1–9. Keep reconciliation in mind for any cross-view link." If a cross-surface link ever wants to open "Seat 4" on TableView from OnlineView, the ID-space mismatch will break it. Audit-watch as a future-coupling risk.

#### E4 — No offline-fallback JTBD-MT-62 verification
Claimed as served. The only offline path is Import-from-File in the empty state. If the extension was connected earlier and then goes offline mid-session, what does the UI do? Probably falls back to the last-known tendency map (analysis pipeline runs at app-root). Not verified. Audit-watch.

---

## Gate 4 — Heuristic audit findings

Each finding anchored to the Gate-2 output or surfaced independently by heuristic walk.

### F1 — OnlineView has no manual nav entry (discoverability)

- **Severity:** 4 (P0, Gate-2 C1 + B4)
- **Heuristics violated:** H-N7 flexibility + efficiency of use, H-ML01 discoverability of primary surfaces
- **JTBD impact:** DE-72 raw JSON import — button only reachable via OnlineView empty state, which is unreachable
- **Evidence:** `PokerTracker.jsx:104` routes `SCREEN.ONLINE → <OnlineView />`. Left-nav sidebar has 7 buttons (Stats, Hand Review, Sessions, Players, Analysis, Extension, Settings) — no "Online". Verified via Playwright.
- **Recommended fix:** Add "Online" button to the main-app nav sidebar. Route it to `SCREEN.ONLINE`. Keep "Extension" as a separate entry only if ExtensionPanel is a legitimate separate-screen surface (see D1). If D1's resolution is "they should be one screen," the nav gets simplified to just "Online" (which renders OnlineView, which may internally render ExtensionPanel for the extension-embed widget).
- **Effort:** S (single nav entry add + route wire) but depends on D1's resolution.
- **Proposed backlog item:** `DCOMP-W4-A3-F1 — Add Online nav entry` (P0)

### F2 — ExtensionPanel artifact-code routing drift (D1)

- **Severity:** 4 (P0, Gate-2 D1)
- **Heuristics violated:** Framework-consistency (not a user-facing heuristic, but infrastructure hygiene)
- **Evidence:** Surface artifact lists ExtensionPanel as a code path under OnlineView. `PokerTracker.jsx:105` routes `SCREEN.EXTENSION` to `<ExtensionPanel />` directly, not as OnlineView sub-render.
- **Recommended fix:** Pick a canonical shape. Option A: ExtensionPanel is standalone (nav-Extension = sidebar-embed preview; nav-Online = OnlineView analysis). Option B: ExtensionPanel is OnlineView-internal (remove `SCREEN.EXTENSION`, route nav-Extension through OnlineView). Option A is defensible and matches current routing; pick it, then update the surface artifact to reflect that ExtensionPanel has its own artifact. Option B reduces surface count but requires code change.
- **Effort:** S (documentation + maybe one route deletion)
- **Proposed backlog item:** `DCOMP-W4-A3-F2 — Resolve OnlineView/ExtensionPanel routing canonical` (P0)

### F3 — `alert()` on import failure → error toast

- **Severity:** 4 (P0, Gate-2 C2)
- **Heuristics violated:** H-N5 error prevention, H-ML04 non-blocking error surfaces, Wave-1 pattern
- **Evidence:** `OnlineView.jsx:43` `alert('Import failed: ' + err.message);`
- **Recommended fix:** Replace with `showError()` from `ToastContext` (same API as Wave-1 destructive-action toasts). Include err.message + optional retry affordance.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W4-A3-F3 — Import-failure alert → toast` (P0)

### F4 — `window.location.reload()` on version mismatch (no diagnostic)

- **Severity:** 4 (P0, Gate-2 C3)
- **Heuristics violated:** H-N5, H-N9 recognize/diagnose/recover from errors
- **Evidence:** `OnlineView.jsx:79`.
- **Recommended fix:** Before reload: (a) render mismatch diagnostics (extension version vs main-app version, specific contract delta if known), (b) require explicit user confirmation, (c) after reload — flag the reload in sessionStorage so the post-reload app can verify the mismatch cleared.
- **Effort:** M (diagnostic plumbing requires the extension → main-app handshake to carry version + contract fingerprint).
- **Proposed backlog item:** `DCOMP-W4-A3-F4 — Version-mismatch reload diagnostic + confirm` (P0)

### F5 — "Continue Anyway" silences warning without degrading gracefully

- **Severity:** 3 (P1, Gate-2 C4)
- **Heuristics violated:** H-N1 visibility of system status
- **Recommended fix:** Dismissing the banner → persistent amber pip on the Extension-connected indicator; log the mismatch to a debug store for later review; suppress advice that relies on the mismatched field.
- **Effort:** M.
- **Proposed backlog item:** `DCOMP-W4-A3-F5 — Version-mismatch graceful degradation` (P1)

### F6 — Import-from-File has no loading/progress state

- **Severity:** 3 (P1, Gate-2 C5)
- **Heuristics violated:** H-N1
- **Evidence:** `handleFileImport` no disabled state during async work.
- **Recommended fix:** Disable button + spinner + "Importing N hands…" text during `importFromJson`. Toast success count on completion.
- **Effort:** S.
- **Proposed backlog item:** `DCOMP-W4-A3-F6 — Import-from-File loading state` (P1)

### F7 — Touch targets: Reload Page, Continue Anyway, session pill, Import buttons all <44×44

- **Severity:** 3 (P1, heuristic)
- **Heuristics violated:** H-ML06
- **Evidence:** Reload Page `padding: '2px 8px', fontSize: 11` ≈ 15px tall. Continue Anyway identical. Session pill `padding: '4px 10px', fontSize: 11` ≈ 19px tall. Empty-state Import `padding: '8px 16px', fontSize: 13` ≈ 29px tall. Populated Import `padding: '6px 12px'` ≈ 23px tall.
- **Recommended fix:** Bundle with F8 (inline-style migration). Any touch target applies ≥44px via padding during migration.
- **Effort:** M (bundled with F8).
- **Proposed backlog item:** `DCOMP-W4-A3-F7 — OnlineView touch targets ≥44×44` (P1, bundled)

### F8 — Inline-style migration gap (whole view)

- **Severity:** 3 (P1, Gate-2 E1)
- **Heuristics violated:** H-internal-consistency (Tailwind + design tokens are the app standard post-Wave-1)
- **Evidence:** 199 lines of `style={{ ... }}` objects throughout. Gold `#d4a847` hex literal instead of token.
- **Recommended fix:** Migrate OnlineView.jsx + its sub-components to Tailwind utility classes with tokens from `designTokens.js`. Preserve behavior exactly; visual verify via Playwright after. **High-leverage** because the rest of W4-A3's P1 findings (touch targets, loading state) can be bundled into the migration.
- **Effort:** M–L (view + 10+ sub-components).
- **Proposed backlog item:** `DCOMP-W4-A3-F8 — OnlineView inline-styles → Tailwind migration` (P1, M-L effort)

### F9 — Empty/populated Import-buttons have different sizes

- **Severity:** 2 (P2, Gate-2 E2)
- **Heuristics violated:** H-N4 consistency and standards
- **Recommended fix:** Single Import-from-File component, rendered in both states with the same size. Empty state may add a surrounding "Get started" panel; the button itself stays consistent.
- **Effort:** S (bundled with F8).
- **Proposed backlog item:** `DCOMP-W4-A3-F9 — Import-button size consistency` (P2, bundled)

### F10 — Sidebar ↔ OnlineView handoff undocumented

- **Severity:** 2 (P2, Gate-2 D2)
- **Recommended fix:** `contracts/sidebar-to-online-view.md` documenting the handoff (even if "no handoff — intentional isolation").
- **Effort:** S (documentation).
- **Proposed backlog item:** `DCOMP-W4-A3-F10 — sidebar-to-online-view contract doc` (P2)

### F11 — Online/Live differentiation in SessionsView

- **Severity:** 2 (P2, Gate-2 D3)
- **Recommended fix:** Verify SV-F7's filter pill correctly classifies extension-imported sessions as "Online". If not, add `source: 'extension'` to Session record on import.
- **Effort:** S–M.
- **Proposed backlog item:** `DCOMP-W4-A3-F11 — Online session classification verify` (P2)

### F12 — Personas + JTBD patches

- **Severity:** 1 (P3, Gate-2 A1/A2/A3 + B1/B2/B3)
- **Recommended fix:** Resolve per Stage A — `multi-tabler-switching.md`, clarify Online MTT Shark scope, Hybrid cross-format handoff; patch MH-01 claim; new JTBDs for MH-20/SR-45 (sidebar-advice-history) and MT-XX (extension capture verification).
- **Effort:** M (multiple artifacts).
- **Proposed backlog item:** `DCOMP-W4-A3-F12 — Online persona + JTBD patches` (P3)

### F13 — MT-62 offline-fallback verification

- **Severity:** 1 (P3, Gate-2 E4)
- **Recommended fix:** Verify the analysis pipeline degrades gracefully when extension disconnects mid-session (last-known tendency map persists; no crash). Document behavior.
- **Effort:** S (verify + document).
- **Proposed backlog item:** `DCOMP-W4-A3-F13 — MT-62 offline-fallback verify` (P3)

---

## Observations without fixes

- **App-root analysis** (surface note) is the correct post-Sidebar-Rebuild pattern — analysis flows regardless of which view renders. Don't regress.
- **Version-mismatch banner + sync-error banner are separate** — correct separation. Don't merge.
- **Session selector only shown when >1 session** — correct data-conditional. (But creates discovery issue noted in A4.)

## Open questions for the owner

- Is ExtensionPanel a standalone surface or OnlineView's sub-component? (F2 unlocks on this answer.)
- Is the Rounder "occasional import" use case Free+ or Pro? (Affects empty-state button prominence.)
- Should the extension-connected indicator also surface in non-Online views, or only here? (Affects visibility-of-system-status.)

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | F1 — Add Online nav entry | 4 | S | P0 |
| 2 | F2 — Resolve OnlineView/ExtensionPanel routing canonical | 4 | S | P0 |
| 3 | F3 — Import-failure alert → toast | 4 | S | P0 |
| 4 | F4 — Version-mismatch reload diagnostic + confirm | 4 | M | P0 |
| 5 | F8 — OnlineView inline-styles → Tailwind migration (bundles F7/F9) | 3 | M-L | P1 |
| 6 | F5 — Version-mismatch graceful degradation | 3 | M | P1 |
| 7 | F6 — Import-from-File loading state | 3 | S | P1 |
| 8 | F7 — Touch targets ≥44×44 (bundled with F8) | 3 | M | P1 |
| 9 | F9 — Import-button size consistency (bundled with F8) | 2 | S | P2 |
| 10 | F10 — sidebar-to-online-view contract doc | 2 | S | P2 |
| 11 | F11 — Online session classification verify | 2 | S-M | P2 |
| 12 | F12 — Persona + JTBD patches | 1 | M | P3 |
| 13 | F13 — MT-62 offline-fallback verify | 1 | S | P3 |

---

## Backlog proposals

Copy-paste ready for `.claude/BACKLOG.md`:

```
- [P0] [DCOMP-W4-A3 F1] Add "Online" nav entry to main-app sidebar; route SCREEN.ONLINE
- [P0] [DCOMP-W4-A3 F2] Resolve OnlineView/ExtensionPanel routing canonical (two screens or one)
- [P0] [DCOMP-W4-A3 F3] Import-failure alert() → error toast
- [P0] [DCOMP-W4-A3 F4] Version-mismatch reload: diagnostic + confirm (no silent full reload)
- [P1] [DCOMP-W4-A3 F5] Version-mismatch graceful degradation on Continue Anyway
- [P1] [DCOMP-W4-A3 F6] Import-from-File loading/progress state
- [P1] [DCOMP-W4-A3 F8] OnlineView inline-styles → Tailwind migration (bundles F7 touch targets + F9 button size consistency)
- [P2] [DCOMP-W4-A3 F10] contracts/sidebar-to-online-view.md documenting handoff (or explicit no-handoff)
- [P2] [DCOMP-W4-A3 F11] Verify SV-F7 filter pill classifies extension-imported sessions as Online
- [P3] [DCOMP-W4-A3 F12] Online persona + JTBD patches (multi-tabler-switching, online-shark scope, Hybrid cross-format, MH-20/MT-XX new JTBDs, MH-01 claim reconciliation)
- [P3] [DCOMP-W4-A3 F13] MT-62 offline-fallback verify + document
```

---

## Severity rubric

Standard template rubric — see `docs/design/audits/_template.md`.

## Review sign-off

- **Drafted by:** Claude (main), session 2026-04-22
- **Reviewed by:** [owner] on [date]
- **Closed:** [date]

## Change log

- 2026-04-22 — Draft. Combined Gate-2 + Gate-4 in one artifact — matches the 2026-04-22 tournament-view precedent. Playwright-assisted; discovered the nav-entry defect (F1) via walkthrough which a pure code inspection would have missed.
