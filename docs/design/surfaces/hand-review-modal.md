# Surface — Hand Review Modal

**ID:** `hand-review-modal`
**Code paths (planned — Stream U Phase 7):**
- `src/components/views/HandReplayView/HandReviewModal/HandReviewModal.jsx` (new)
- `./HandReviewModalTabs.jsx` (new)
- `./AssumptionCard.jsx` (new — shared component contract authored here; consumed by HRP claims-ledger + exploit-deviation citation surfaces)
- `./tabs/SummaryTab.jsx`, `./tabs/ClaimsLedgerTab.jsx`, `./tabs/CounterfactualTreeTab.jsx`, `./tabs/DrillCardTab.jsx`, `./tabs/FullArtifactTab.jsx` (new)
- `src/hooks/useHandReviewModal.js` (new — modal open/close + tab state + match resolution)
- `src/utils/spotResolver/` (planned at Phase 4 — produces the `SpotMatch` consumed here)

**Route / entry points:**
- Not a top-level screen. Rendered as an overlay on top of `SCREEN.HAND_REPLAY` (`hand-replay-view`).
- Opens from:
  - HandReplayView ReviewPanel ledger-link icon (per decision point) — click or `L` key
  - AnalysisView HandBrowser flagged-hand entry — clicking a flagged hand opens HandReplayView, then auto-opens the modal at the first flagged decision
- Closes to: HandReplayView at the same replay cursor position.

**Product line:** Main app
**Tier placement:** Plus+ (replay-tier consumer of the theoretical-library bridge). No solver dependency; renders artifact assertions only.
**Last reviewed:** 2026-05-17 (HRP Gate 4 author — see Change log)

---

## Purpose

The Hand Review Modal is the consumer side of the Played-Hand Review Protocol bridge. When a hero replays a decision they previously flagged (or one that the spot-resolver auto-matches with strong confidence), the modal renders the linked theoretical artifact's ledger, counterfactual EV tree, and drill card in a single tabbed overlay.

**Critical architectural constraint** — per HRP project doc line 30: HRP is a *bridge*, not a new authoring surface. **This modal renders linked artifact assertions; it never re-derives reasoning.** The claims-ledger tab shows what LSW or Upper-Surface artifacts already say about the spot. The counterfactual tree tab shows depth-2/3 EV that `gameTreeEvaluator.js` already computed during analysis (currently discarded at the UI boundary; HRP surfaces it). If no analog exists, the modal degrades to an honest "no analog found" state with a copy-spot-key affordance (the v1 form of the SR-32 nominate-for-corpus loop).

The modal is **post-session, never live**. Live-cadence surfaces (TableView, OnlineView, sidebar) are explicitly out of scope per the HRP narrow-scope decision (project doc line 117). Between-Hands cadence is also excluded (live timing incompatible with depth).

## JTBD served

Primary:
- `JTBD-SR-28` deep-review a flagged hand against upper-surface theoretical ground-truth — the modal is the depth surface for this
- `JTBD-SR-29` know if a theoretical analog exists for the spot being reviewed — match-confidence indicator + "no analog" graceful degrade
- `JTBD-SR-30` see the counterfactual EV tree for a past decision — Counterfactual Tree tab surfaces `gameTreeEvaluator.js` depth-2/3 output
- `JTBD-MH-12` (post-session form) — assumption-card render at modal-content cadence; the AssumptionCard component contract authored here is reused by exploit-deviation Phase 7+ for the live-citation cadence
- `JTBD-CO-54` see own leak without being graded — claims-ledger tab uses neutral editor's-note tone, no shame copy
- `JTBD-CO-55` learn next concept — Drill Card tab is the bridge from "this spot" to "this concept"

Secondary:
- `JTBD-SR-31` (partial) flag-queue surfacing — the modal opens via the queue from HandBrowser; queue management itself lives in HandBrowser (`analysis-view.md`)
- `JTBD-SR-32` Proposed — copy-spot-key affordance is the v1 architected-for form
- `JTBD-SR-33` Proposed — dispute-claim affordance is architected-for via a per-claim disabled-pending action stub
- `JTBD-SR-34` Proposed — spaced-retrieval re-review hides prior notes by default; v1 ships the hide-by-default policy even before notes exist as a writable field

## Personas served

- [Post-session Chris](../personas/situational/post-session-chris.md) — **primary**. The persona who flags 2-3 hands per session and reviews them in the 30-60 minutes after the session ends.
- [Apprentice](../personas/core/apprentice-student.md) — secondary. Inline glossary policy (every bolded technical term tap-to-define) is authored for this persona.
- [Coach review session](../personas/situational/coach-review-session.md) — secondary. The two-person-one-phone reading scenario drives font + contrast minimums + the per-claim anchor-link affordance.
- [Chris](../personas/core/chris-live-player.md) — out-of-cadence (Chris is the live-player persona; the modal is post-session).
- [Study block](../personas/situational/study-block.md) — explicitly **not served**. Study-block does general fluency work; HRP is hand-specific. Out of scope.

---

## Anatomy

```
┌──────────────────────────────────────────────────────────────┐
│ Hand Review — Decision N of M           [✕ close]  [L key]   │
│ Spot: BTN vs BB, 3BP, IP, wet T96ss, 65bb eff                │
│ Match: ●● strong  ·  Artifact YELLOW · last reviewed 2026-04 │
├──────────────────────────────────────────────────────────────┤
│ [Summary] [Claims Ledger] [Counterfactual] [Drill] [Artifact]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  TAB BODY (one of 5; see §Tab specifications below)          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Summary (default tab):                                 │  │
│  │  • Spot key + match-confidence reason                  │  │
│  │  • Linked-artifact summary (4-5 sentences)             │  │
│  │  • Hero's actual action (read-only)                    │  │
│  │  • Quick-jump chips to other tabs                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ [< prev decision]    Decision N of M    [next decision >]    │
└──────────────────────────────────────────────────────────────┘
```

When the modal is open, the underlying HandReplayView felt + ReviewPanel are dimmed but the replay cursor's decision context (action, street, pot, stacks) stays visible in the modal header — hero never loses place per Stage E heuristic check (H-N01 visibility of system status, audit line 228).

## Tab specifications

### Tab 1 — Summary (default)

The orientation tab. Default-open because Stage C Review-Pedagogue voice (audit line 126) called for "skim summary first, drill on contested claims" — summary is the skim layer.

**Contents:**
- Spot-key string in monospace (developer-grade copy; useful for the v1 nominate-for-corpus copy-paste flow)
- Match-confidence chip with reason: `●● strong match` / `● partial — stack depth differs` / `○ no analog`
- Linked-artifact summary block: the artifact's own 4-5-sentence "claim summary" (extracted from the upper-surface or LSW source; HRP does not re-author)
- Hero's actual action card (read-only, mirrors `HeroStateSection`'s "Your action" panel)
- Quick-jump chips: `[Claims (N)]` `[Counterfactual]` `[Drill]` `[Full]` — counts inline so hero knows what's there

**No analog state:** when `match.confidence === 'no-analog'`, the Summary tab swaps the linked-artifact summary block for an SR-32 stub:

```
┌────────────────────────────────────────────────────┐
│ No analog found for this spot.                     │
│                                                    │
│ The theoretical corpus doesn't yet have an         │
│ artifact for: <spot-key>                           │
│                                                    │
│ [Copy spot-key to clipboard]                       │
│                                                    │
│ (Nomination-for-authoring is a future feature.)    │
└────────────────────────────────────────────────────┘
```

The Claims/Counterfactual/Drill/Full tabs are hidden when no analog exists (no content to render). Counterfactual tab MAY still render if `gameTreeEvaluator` produced depth-2/3 output for this decision — that data exists independently of artifact matching.

### Tab 2 — Claims Ledger

The depth tab. Renders the artifact's claim-falsifier ledger as a list of `AssumptionCard` rows (see §AssumptionCard component contract below).

**Default state:** rows are collapsed to the claim text + falsification status (`✓` / `⚠` / `✗`). Tapping expands.

**Expanded row content (per `AssumptionCard` contract):**
- Claim text (the assertion the artifact makes)
- Falsifier — what would invalidate this claim
- Evidence — links to LSW lines, prior audits, or hand examples
- Confidence — claim-level confidence (distinct from the artifact-level confidence in the header)
- Per-claim anchor link (`#claim-N`) — for Pro-Coach voice (audit line 132) "tap claim #4" sharing

**Progressive disclosure ladder:** per Stage C rule 2 (audit line 152). Summary → expand row → expand sub-rows. Three taps to bottom; bottom render is < 60 lines of dense text.

**Glossary:** every bolded technical term (`**MDF**`, `**SPR**`, `**realization-factor**`, etc.) is wrapped in an inline glossary affordance — tap → tooltip with definition sourced from `POKER_THEORY.md` / `BUCKET_DEFINITIONS`. Per Stage C rule 3 (audit line 154).

### Tab 3 — Counterfactual Tree

Renders the depth-2/3 EV tree that `gameTreeEvaluator.js` produced for this decision and that HandReplayView currently discards.

**Default state:** depth-1 — hero's action + sibling actions (raise / call / fold), each with EV and a per-runout-class breakdown chip.

**Expanded:** tap an action node → reveals depth-2 (villain's response distribution + EV per villain branch). Tap a depth-2 node → reveals depth-3 (hero's next-action options, if computed).

**Per-runout-class breakdown** (SR-30 acceptance): for the action node, show how EV distributes across runout classes (e.g., "drying / coordinating / pairing" for turn). This is the unique value the counterfactual tree adds over the single-EV badge already on the replay screen.

**No-data state:** if `gameTreeEvaluator` did not produce a tree for this decision (e.g., preflop nodes pre-flop-tree, or computation bailed out), the tab renders an honest "Counterfactual tree not available — engine bailed at depth-1." with no fake content.

### Tab 4 — Drill Card

The bridge from "this spot" to "this concept." A one-page distillation card for the spot's concept tag.

**Contents:**
- Concept name (e.g., "OOP cbet defense, wet board, 3BP")
- One-line teaching frame from the linked artifact
- 2-3 worked example positions (other hands or solver lines that illustrate the concept)
- "Drill this concept" CTA (disabled in v1; future Stream F integration with PresessionDrillView)

The Drill Card tab is **read-only in v1**. The "Drill this concept" CTA visibly exists but is non-functional with a "Coming in PresessionDrillView integration" tooltip. This explicitly architects-for the future SR-34 spaced-retrieval flow without requiring drill infrastructure now.

### Tab 5 — Full Artifact

Renders the full linked artifact's markdown (upper-surface artifact files at `docs/upper-surface/reasoning-artifacts/*.md` or LSW line nodes at `docs/projects/line-study-slice-widening/*.md`).

**Why inline render and not external link:** per Stage D Information Architect voice (audit line 194). External links open file:// or relative paths that break in PWA + Electron contexts. The full artifact renders inside an expanded modal frame with its own scroll.

**Header:** shows the source path + artifact-level confidence + "View source file" affordance (for power-user debugging; opens the markdown source in dev only).

---

## AssumptionCard component contract (authored here)

> **First-author wins.** Per the cross-project coordination rule established in HRP project doc Open Question #1 + exploit-deviation Phase 6 §Coordination (lines 297-307), the project that first renders an assumption-card / claim-falsifier ledger row in a surface spec authors the component contract. `hand-review-modal.md` is the first spec to render the ledger; this section is the contract. exploit-deviation Phase 7+ consumes this component for the live-citation surface; expanded-mode toggle covers both render styles.

### Props shape

```ts
type AssumptionCardProps = {
  claim: {
    id: string;                    // stable across artifact-version bumps
    text: string;                  // the claim assertion (markdown, inline glossary terms permitted)
    falsifier: string;             // what would invalidate this claim
    evidence: Array<{
      kind: 'lsw-line' | 'prior-audit' | 'hand-example' | 'solver';
      ref: string;                 // path or ID
      label: string;               // display label
    }>;
    confidence: 'GREEN' | 'YELLOW' | 'RED' | 'unscored';
    sourceArtifactId: string;      // for back-reference + per-claim anchor link
  };
  variant: 'compact' | 'expanded';  // compact = sidebar live cadence; expanded = modal post-session
  expandable?: boolean;             // default true; false for live-cadence freeze
  onExpandToggle?: () => void;      // null in expanded variant (always expanded)
  onCopyAnchorLink?: () => void;    // copies `#claim-{id}` to clipboard (Pro-Coach voice)
};
```

### Variant rules

**`compact` variant (exploit-deviation live-citation consumption):**
- Single-line render: status icon + 1-line claim text (truncated with ellipsis)
- No expand affordance (sidebar cadence cannot host a tap-to-expand)
- Click-through opens the parent surface's full context (e.g., scroll to claim in modal)

**`expanded` variant (HRP claims-ledger consumption):**
- Multi-line render with claim + falsifier + evidence links + per-claim anchor
- Collapsible to header-only via `onExpandToggle`
- Glossary-aware (bolded terms render with tooltip wrappers)

### Visual contract

Both variants share:
- Status icon (✓ / ⚠ / ✗) matching `claim.confidence`
- Color coding per `BUCKET_DEFINITIONS` confidence palette (semantic, not raw hex)
- Tap-target floor 44×44 per Mobile-Landscape heuristic (audit Stage E line 248)
- Reduced-motion mode (`prefers-reduced-motion`) collapses transitions to instant

### Reuse contract for exploit-deviation Phase 7+

When exploit-deviation Phase 7 begins authoring the live-citation card, it MUST import this component:

```jsx
import { AssumptionCard } from '../../views/HandReplayView/HandReviewModal/AssumptionCard';
```

and use `variant='compact'`. Any visual divergence between live + post-session cadences should be controlled by `variant`, not by maintaining two separate components. If a divergence is needed that variants can't express, the next sprint amends this contract before forking.

### Anti-pattern bindings

- **No claim-confidence aggregation into a single "your understanding" score.** Per autonomy red line #9 (mastery never as score), the modal renders per-claim confidence + per-artifact confidence as separate signals. They never combine into a "your review accuracy" number.
- **No streak counters.** Per autonomy red line #5. The modal does not count "claims you've reviewed" or "hands you've flagged" toward a streak. `reviewCount` exists in `hand.reviewState` for nominate-for-corpus signal purposes only — it is NOT rendered as a counter in the UI.
- **No claim-level "you were wrong" copy.** Per red line #5 + AP-06 (no shame). The Claims Ledger tab renders the artifact's claims neutrally; hero's action (in Summary tab) is shown as-is without comparison-shame copy. Future SR-33 (dispute claim) is a hero-initiated affordance, not a system-initiated callout.

---

## Schema additions

Inline per HRP project doc Phase 3 acceptance criteria ("inline in hand-review-modal or side file"). The additions are small enough to keep here.

### `hand.flags[]`

```ts
hand.flags: Array<{
  id: string;             // ULID
  createdAt: number;      // epoch ms
  source: 'showdown' | 'handbrowser' | 'replay';
  note?: string;          // optional one-line user note (v1: omitted; future-proof)
}>
```

- Default: `[]` for new + existing hands (migration adds for existing).
- A hand is "flagged" iff `flags.length > 0`.
- Un-flagging removes the specific entry (multiple flags can exist for tracking re-flag history; HandBrowser shows the most recent).
- `source` enables HE-17 implementation audit (Stage C rule 7 / audit open-question #2): which surface produced the flag?
- `note` reserved for future Stream U-POLISH personalization. Schema spec includes the field; v1 UIs do not write or read it.

### `hand.reviewState`

```ts
hand.reviewState: {
  lastReviewedAt: number | null;       // epoch ms; null if never opened in modal
  reviewCount: number;                  // total times opened in modal (NOT rendered as UI counter — see anti-pattern)
  lastSpotResolverVersion?: string;     // corpus version used at last review; useful for SR-32 staleness gates
}
```

- Default: `{ lastReviewedAt: null, reviewCount: 0 }` for new + existing hands.
- Updated by the modal's `onOpen` lifecycle (write once on first open per session; debounced if re-opening within 5s to avoid count inflation).
- `lastSpotResolverVersion` enables future "this review used an older corpus" diff surfacing without bumping the schema again.

### IDB migration

Additive-only per `INV-PERSIST-2`. Migration `v(next)`:

```js
// hands store upgrade — additive only
hands.openCursor().forEach((hand) => {
  if (!hand.flags) hand.flags = [];
  if (!hand.reviewState) hand.reviewState = { lastReviewedAt: null, reviewCount: 0 };
  cursor.update(hand);
});
```

- Registry entry: planned at Stream E Phase 5 (`src/utils/persistence/migrationRegistry.js`); spec only here.
- Backwards-compatible load path: a hand without `flags` or `reviewState` (e.g., a v(current) snapshot replayed against v(next) code in a stale tab) is treated as `flags: []` + default `reviewState` — read path applies the same default-fill before consuming.
- No data loss path: migration never deletes existing `hand.*` fields. Forward-compatible to v(next+1) if/when SR-32 nominate-for-corpus adds `nominatedForCorpus: boolean`.

---

## State

- **Modal-scoped (`useHandReviewModal`):**
  - `isOpen: boolean` — modal visibility
  - `currentTab: 'summary' | 'claims' | 'counterfactual' | 'drill' | 'artifact'` (default: 'summary')
  - `match: SpotMatch | null` — the spot-resolver output for the current decision (see `spotResolver/` Phase 4)
  - `decisionIndex: number` — which decision is being reviewed; modal can navigate prev/next without closing
  - `glossaryOpenForTerm: string | null` — inline glossary state
- **Read from HandReplayView:**
  - `hand: Hand` — the full hand record (incl. `flags[]`, `reviewState`)
  - `replay.currentActionEntry` — the decision context
- **Writes:**
  - `hand.reviewState.lastReviewedAt` + `hand.reviewState.reviewCount` on first modal open per session (debounced)
  - No claim-level writes in v1 (SR-33 dispute-claim is Proposed; v1 architects-for via disabled affordances)
- **No live engine writes.** No dispatch to villain modeling, exploit generation, or hero-action selection. The modal is consumer-only of the analysis pipeline output.

## Props / context contract

- `hand: Hand` (required) — full hand record
- `decisionIndex: number` (required) — index into `hand.timeline` for the decision to review
- `onClose: () => void` (required) — handler for modal dismiss
- `onNavigate: (newIndex: number) => void` (required) — prev/next decision navigation
- `scale: number` (inherited from HandReplayView)

## Key interactions

1. **Open** — ledger-link icon click on a HandReplayView ReviewPanel decision, or `L` key on a decision with a strong match. Match `'no-analog'` decisions are NOT clickable (per Stage C rule 4 — empty-state clicks are misleading); the icon is rendered disabled with a tooltip "No theoretical analog for this spot."
2. **Tab navigation** — click tab or use arrow keys (`←` / `→`) inside the modal.
3. **Prev/next decision** — bottom-bar buttons or `[` / `]` keys. Modal stays open; tab state resets to Summary on navigation.
4. **Dismiss** — `Esc` key, `✕` button, or click outside modal. Returns to HandReplayView at the same cursor position.
5. **Glossary tooltip** — tap any bolded technical term (in Claims Ledger or Drill Card tabs) → tooltip with definition. Tap-outside dismisses.
6. **Copy spot-key** (Summary tab, `'no-analog'` state) — single tap copies the spot-key string to clipboard with a brief "Copied" toast.
7. **Per-claim anchor link** (Claims Ledger tab, expanded variant) — tap the anchor icon on a claim → copies `#claim-{id}` to clipboard. Pro-Coach voice (audit line 132).

## Red-line compliance

This surface's slot in the chris-live-player autonomy red-line conformance:

| Red line | How this surface complies | Enforcement |
|---|---|---|
| #5 — no shame / engagement-pressure copy | No "you missed," "wrong action," streak counters, or comparison-shame copy. Claim text is neutral editor's-note tone. | CI grep: forbidden phrases (`great job`, `streak`, `level up`, `you missed`, `wrong action`) on `hand-review-modal.md` + future component files. |
| #8 — no cross-surface contamination | Modal renders ONLY inside HandReplayView. Live-table surfaces (TableView, OnlineView, sidebar) explicitly excluded per HRP narrow scope. | Import grep: no `HandReviewModal` import from `OnlineView/`, `TableView/`, sidebar code paths. |
| #9 — mastery never displayed as a score | Per-claim confidence + per-artifact confidence are separate signals; never aggregated into a "your understanding" score. `reviewCount` is data, not UI. | DOM test on `HandReviewModal.test.jsx` asserts no element with `data-testid="*-mastery-score"` or similar; assertion that `reviewCount` does not render as visible text. |

Additionally, **Gate 2 Stage-C design rules** (audit lines 150-163) are bound:

| Rule | This surface's compliance | Section |
|---|---|---|
| Rule 1 — Ledger render = modal overlay | The whole spec implements this. | §Anatomy |
| Rule 2 — Progressive disclosure ladder | Summary → Claims (collapsed rows) → Counterfactual (depth-1 → depth-2) → Drill | §Tab specifications |
| Rule 3 — Inline glossary | Every bolded technical term tap-to-define | §Tab 2 / §Key interactions |
| Rule 4 — Match confidence visible | Header chip + per-tab gating | §Anatomy / §Tab 1 |
| Rule 5 — Linked artifact's audit-state visible | Header shows artifact-level GREEN/YELLOW/RED + last-reviewed date | §Anatomy |
| Rule 6 — Spaced-retrieval hide-own-notes (architected-for) | `hand.reviewState.lastReviewedAt` enables SR-34 future flow; v1 ships hide-by-default policy | §Schema additions |
| Rule 7 — Offline precaching | Upper-surface + LSW corpus MUST land in PWA precache manifest before this surface ships | §Verification (deferred to Stream E) |

---

## Accessibility

- 44×44 tap-target floor on all interactive elements (tabs, claim expand toggles, glossary triggers, anchor copy buttons) per Stage E Mobile-Landscape heuristic.
- Keyboard navigation: `L` to open, `Esc` to close, arrow keys for tab + claim navigation, `[`/`]` for decision navigation.
- ARIA: modal has `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing to the decision summary in the header. Tab navigation uses `role="tablist"` + `role="tab"` + `role="tabpanel"` per WAI-ARIA tabs pattern.
- Reduced-motion: collapses tab transitions + glossary tooltip animations to instant when `prefers-reduced-motion: reduce` is set.
- Two-person reading scenario (Coach review session): minimum font-size 14px for body text, 16px for claim text. Contrast ratio ≥ 4.5:1 on all rendered text against the modal's background.
- Glossary tooltips do not trap focus — they're dismissible by tap-outside or `Esc`.

## Known behavior notes

- Modal navigation persists `decisionIndex` to the HandReplayView's replay cursor on close — closing at decision N leaves the felt at decision N (not at the modal-opening position).
- If hero opens the modal during async analysis computation (`useHandReplayAnalysis.isComputing === true`), the modal renders a "Computing analysis..." state in the Counterfactual tab body but allows Summary + Claims + Drill + Full Artifact tabs to render immediately (those don't depend on game-tree output).
- Hand-level writes (`reviewState.lastReviewedAt` update) are debounced — re-opening the modal within 5 seconds does not increment `reviewCount`.

## Known issues / deferred

- **HE-17 producer-side verification** (Stage C rule 7 / audit open-question #2): need to confirm `hand.flags[]` field is actually persisted today. Phase 3 spec assumes it does not exist (additive migration). If it does exist and has different shape, the migration must reconcile (this is a Phase 5 task, not Phase 3).
- **SR-32 nominate-for-corpus full flow** — v1 ships copy-spot-key; the actual "submit nomination" backend lands when LSW + Upper-Surface authoring projects integrate.
- **SR-33 dispute-claim** — disabled affordance in v1; full flow lands when claim-edit infrastructure ships.
- **SR-34 spaced-retrieval re-review** — `lastReviewedAt` enables the data; the actual "you reviewed this 7 days ago, time to re-test" surfacing is deferred.
- **First-open tutorial + inline glossary** content authoring — referenced as a binding contract; actual tutorial copy + glossary entries land in Stream U Phase 8.

## Test coverage (planned — Stream U Phase 7)

- `HandReviewModal.test.jsx` — modal open/close + tab navigation + keyboard shortcuts + match-confidence rendering + no-analog graceful state
- `AssumptionCard.test.jsx` — compact vs expanded variant + glossary tooltips + anchor-link copy + red-line compliance grep
- `useHandReviewModal.test.js` — match resolution + decision-index navigation + reviewState write debouncing
- Integration test on HandReplayView — opening the modal from ReviewPanel preserves replay cursor

## Cross-references

- HRP project doc — `docs/projects/played-hand-review-protocol.project.md`
- HRP Gate 2 audit — `docs/design/audits/2026-04-23-blindspot-played-hand-review-protocol.md` (Stage-C + Stage-E rules cited above)
- SPOT-KEY feasibility spike — `docs/projects/played-hand-review-protocol/spot-key-spike.md`
- Companion amended specs:
  - `docs/design/surfaces/hand-replay-view.md` (ReviewPanel ledger-link entry point)
  - `docs/design/surfaces/analysis-view.md` (HandBrowser flag queue)
  - `docs/design/surfaces/showdown-view.md` (HE-17 producer entry)
- AssumptionCard cross-project coordination — `docs/projects/exploit-deviation.project.md` §Coordination

## Change log

- **2026-05-17 — SPR-085 / WS-067 — Initial author.** HRP Gate 4 surface spec for the hand-review-modal. Authored the AssumptionCard component contract (per cross-project rule, HRP is first-to-render via surface spec); exploit-deviation Phase 7+ consumes via `variant='compact'`. Schema additions for `hand.flags[]` + `hand.reviewState` inlined here per Phase 3 acceptance criteria. All Gate 2 Stage-C + Stage-E design rules bound. Anti-pattern compliance for chris-live-player autonomy red lines #5/#8/#9 documented. No code shipped this sprint (Phase 3 is documentation-only).
