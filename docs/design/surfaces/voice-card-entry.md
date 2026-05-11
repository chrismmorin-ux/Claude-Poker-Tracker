# Surface — Voice Card Entry (VCE)

**ID:** `voice-card-entry`
**Status:** Spike — pending live-table validation (Gate 5). Post-validation `/decide` ADR records SHIP / KEEP-OFF / DROP. R3 binding.
**Ticket:** [WS-181](../../.claude/workstream/queue/WS-181.yaml)
**Gate 1 audit:** [`audits/2026-05-11-entry-vce.md`](../audits/2026-05-11-entry-vce.md) — YELLOW
**Gate 2 roundtable:** [`roundtables/2026-05-11-blindspot-vce.md`](../roundtables/2026-05-11-blindspot-vce.md) — YELLOW + 4 CRITICAL/HIGH for this spec
**Last reviewed:** 2026-05-11 — pending owner ratification of open decisions (see §Open decisions)

**Code paths** (NEW — to be created at Gate 5):
- `src/hooks/useVoiceCardEntry.js` — orchestrator hook (Web Speech lifecycle, parser invocation, chip state)
- `src/utils/voiceCardEntry/grammar.js` — phonetic-variant + token table (13 ranks × 4 suits + "of" + villain tokens + separators)
- `src/utils/voiceCardEntry/parser.js` — transcript → `{ cards: Card[], villainAssignments: Map<villainIdx, [Card, Card]> | null, warnings: string[] }`
- `src/components/ui/VoicePttButton.jsx` — PTT affordance (held by user)
- `src/components/ui/VoiceConfirmationChips.jsx` — chip render + swipe-to-cycle correction + commit
- `src/components/views/TableView/...` — wire PTT into board-entry zones (3 placements: flop, turn, river)
- `src/components/views/ShowdownView/...` — wire PTT into villain showdown rows
- `src/components/views/SettingsView/...` — feature flag toggle (`voiceCardEntry: false` default)
- Test files: `__tests__/voiceCardEntry/grammar.test.js`, `parser.test.js`, `useVoiceCardEntry.test.js`, `VoicePttButton.test.jsx`, `VoiceConfirmationChips.test.jsx`

**Route / entry points:** No new routes. PTT affordance embeds into existing TableView + ShowdownView surfaces. Feature flag gates render.

---

## Purpose

Pipe a brief voice utterance through the Web Speech API and convert it into the same card objects the existing tap CardPicker produces, so the owner can enter board cards (flop / turn / river) and villain showdown cards without 10–15s of phone-staring that breaks table presence and conflicts with H-PLT04 (socially discreet). The spike is bounded — ship-or-drop with no incremental upgrade path. Web Speech only. No cloud transcription.

---

## Founder ratifications (binding)

All six bind. Code or spec changes that violate any of R1–R6 require explicit owner re-ratification.

| ID | Statement | Source |
|---|---|---|
| **R1** | Web Speech API only. No Whisper, no cloud transcription, no escalation path. | WS-181 author, 2026-05-11 |
| **R2** | Scope locked to board cards + villain showdown cards. Hole cards OUT (owner is already looking at the phone). Actions OUT (separate, much larger problem; HE-16 remains Proposed and is not subsumed). | WS-181 author, 2026-05-11 |
| **R3** | Ship-or-drop spike. Live-table validation fails kill criteria → DROP (rip out). No "make it 5% better" follow-ups. | WS-181 author, 2026-05-11 |
| **R4** | Misheard-card correction: **swipe-up/down on chip cycles through 12 other ranks in the same suit**. Long-press chip = full re-pick (rank + suit) via existing CardPicker as fallback. WS-181 accept criterion (c) revised from "≤1 tap" to "≤2 deliberate user actions" — the original was unachievable. | 2026-05-11 Gate 2 close (SC-10) |
| **R5** | Multi-villain showdown grammar: **extended grammar with villain tokens** (`player one`..`player nine`) + 2 sequence separators (`next player`, `and then`). Single PTT hold can cover multiple villains. Collision-resolution rule: `ten` is a villain designator **only if** the preceding token is `player`; otherwise it is the rank `T`. | 2026-05-11 Gate 2 close (SC-7) |
| **R6** | Blank or sub-0.5s utterance on PTT release is a **strict no-op**. No chip render, no spinner, no error toast, no UI state change. Parser pre-conditions for chip render: `transcript.length > 0` AND `utterance duration ≥ 0.5s` AND `confidence ≥ owner-set threshold` AND `≥1 card parsed`. | 2026-05-11 Gate 2 close (SC-3) |

---

## JTBD served

**Primary:**
- [`HE-NEW-VCE-01`](../jtbd/domains/hand-entry.md#he-new-vce-01--enter-newly-revealed-cards-hands-free) — Enter newly revealed cards hands-free.
- [`HE-NEW-VCE-03`](../jtbd/domains/hand-entry.md#he-new-vce-03--abort-a-voice-entry-in-progress-without-side-effects) — Abort a voice entry without side effects (Mid-Hand Chris escape path).

**Secondary:**
- [`HE-12`](../jtbd/domains/hand-entry.md#he-12--undo--repair-a-miskeyed-action) — Undo / repair (voice-correction sub-flow via R4 swipe-to-cycle).
- [`HE-14`](../jtbd/domains/hand-entry.md#he-14--discreet-entry-that-looks-like-texting) — Discreet entry (partial overlap; voice modality is structurally less discreet than texting but addresses HE-NEW-VCE-01's eyes-off-phone outcome).

**Explicitly NOT served:**
- `HE-11` (one-tap action entry — R2 out of scope)
- `HE-13` (auto-capture sidebar — different surface)
- `HE-15` (post-session memory entry — different cadence)
- `HE-16` (voice for actions — R2 out of scope, remains Proposed)
- `HE-17` (flag for review — orthogonal)
- `HE-18` (straddle — orthogonal)

---

## Personas served

**Primary:** [Between-Hands Chris](../personas/situational/between-hands-chris.md) — board reveal sits in the 5–15s sub-window at the start of the between-hands interval (before dealer-deal pressure builds).
**Secondary:** [Mid-Hand Chris](../personas/situational/mid-hand-chris.md) — must satisfy HE-NEW-VCE-03 (abort path). Voice entry must not block action zone if action arrives mid-utterance.
**Tertiary:** [Ringmaster (home-game host)](../personas/core/ringmaster-home-host.md) — home tables run slower with higher social cover; VCE likely passes kill thresholds for Ringmaster even if marginal for Chris at a casino.

**Explicit non-personas:** Multi-Tabler, Online MTT Shark (sidebar auto-capture, not in scope); Newcomer-First-Hand (flag is OFF by default; novice should not encounter); Coach / Apprentice / Scholar (no card-entry-by-voice analog in study-mode).

---

## Surfaces affected

VCE adds an affordance to two existing surfaces. No new routed view.

| Surface | Existing artifact | VCE addition |
|---|---|---|
| TableView | [`table-view.md`](./table-view.md) | PTT button in 3 board-entry contexts (flop, turn, river). Conditional render per §State-aware visibility. No layout reflow for action zone. |
| ShowdownView | [`showdown-view.md`](./showdown-view.md) | PTT button in villain showdown row context. Multi-villain support via R5 extended grammar. No layout reflow for villain row geometry on small viewports (verified at 640×360 minimum at Gate 5). |
| SettingsView | [`settings-view`](./) (existing) | New toggle: `voiceCardEntry` (default OFF). Sub-row for confidence threshold (owner-set, defaults at Gate 4 close). No-mic-permission status surface (passive, not actionable from Settings). |

Sidebar (Ignition extension), online surfaces, all other study-mode surfaces: **zero ripple.** State written by VCE = same state written by existing tap CardPicker.

---

## State-aware visibility (Gate 2 E-5)

PTT button renders **only** when the following predicates evaluate true. Render logic is in `useVoiceCardEntry.js`; conditional render is in `VoicePttButton.jsx`. This is binding per Gate 2 finding E-5 (H-PLT07 state-aware primary action).

```
PTT visible on TableView when:
  settings.voiceCardEntry === true
  AND mic permission status !== 'denied-and-flag-disabled-by-user'
  AND (
       (currentStreet === 'flop' && flopCards.length === 0)
    OR (currentStreet === 'turn' && turnCard === null)
    OR (currentStreet === 'river' && riverCard === null)
  )

PTT visible on ShowdownView when:
  settings.voiceCardEntry === true
  AND mic permission status !== 'denied-and-flag-disabled-by-user'
  AND phase === 'showdown'
  AND atLeastOneVillain.holeCards.length < 2
```

Preflop: PTT does not render. River-complete + no showdown pending: does not render. After board fully entered for the street: does not render. After all villain cards captured: does not render.

PTT grayed (rendered, disabled) when mic permission is denied but flag is still ON (per §Mic permission flow).

---

## Anatomy

### TableView placement (annotated, empirically verified at 1600×720)

**Verification method (2026-05-11):** Playwright DOM-enumerated probe at 1600×720 with the VCE flag ON. Enumerated all clickable elements in the viewport + scanned for 56×56 empty slots on a 16px grid. The only structurally-stable empty band is **y=44–115 BETWEEN the streets-tabs row (ends y=44) and the position-tabs row (begins y=115)** — the position-tabs row extends horizontally with active seat count (8 seats → BB+7 ends at x=1521; 9 seats → BB+8 ends at x=1548), so any slot *inside* that row's vertical range is fragile. The band above is stable regardless of seat count. Regression spec at `tests/playwright/voice-card-entry-overlay.spec.js` asserts zero overlap on TableView load.

**Layout map at 1600×720 (y-axis, right column x≥1158):**

```
   y=0 ──┬─────────────────────────────────────────────────────────┐
         │  [Pre] [Flop] [Turn] [Rvr] [SD]      ← streets tabs (4–44)
   y=44  ├─────────────────────────────────────────────────────────┤
         │                                        ┌─────┐         ← VERIFIED EMPTY BAND
         │  (structurally empty band — y=44–115)  │ 🎙  │           y=44–115 (x≥0)
         │                                        │ PTT │           PTT at y=48–104
         │                                        └─────┘           (top-12 right-1)
   y=115 │  [UTG ✓] [UTG+1] [MP1+1] [MP2+2] [HJ+3] ... [BB+7] [BB+8]   ← position tabs (115–151)
   y=151 ├─────────────────────────────────────────────────────────┤
         │  (empty band 151–193, only 42px — too small for 56px PTT)
   y=193 │  [Call $4              ] [Fold                        ] ← action zone (193–293)
   y=293 ├─────────────────────────────────────────────────────────┤
         │  [$8 2x] [$12 3x] [$16 4x] [$20 5x]    ← bet sizing chips (310–378)
   y=378 │                                        ┌────┐
         │                                        │ GO │           ← GO button (384–432)
   y=432 ├────────────────────────────────────────┴────┴───────────┤
         │  [Rest Fold (8)                                       ] ← Rest Fold (448–516)
   y=516 ├─────────────────────────────────────────────────────────┤
         │  (empty band 516–580, 64px — viable but BRITTLE)
   y=580 │  [Deselect] [Absent] [Reset Street] [Reset Hand]        ← CTA stack (580–628)
   y=644 │  [Next Hand                                          ]  ← Next Hand (644–712) ⚠ DESTRUCTIVE
   y=712 └─────────────────────────────────────────────────────────┘
```

**Why this slot:**
- Zero overlap with any other clickable element verified by DOM enumeration.
- ≥44 visual-px floor satisfied (56×56 px, outside ScaledContainer per D-5).
- Visually separated from the destructive `Next Hand` button (y=644–712) — the prior bottom-right placement landed *inside* `Next Hand`'s bbox (a Gate 2 SC-4 violation discovered post-ship 2026-05-11).

**Tradeoff acknowledged:**
- TOP-right is *not* the optimal Mid-Hand Chris thumb-reach zone (H-PLT02 prefers bottom-right). Trade-off: thumb-reach (preferred-but-not-load-bearing) vs. SC-4 zero-overlap (load-bearing). Load-bearing wins.
- The alternative right-edge slot at y=516–580 is brittle (a 64px gap that could close if any future TableView change shifts the CTA stack). Top-right is the only structurally safe slot at 1600×720.
- If owner-grip or future TableView layout opens a thumb-reach slot, surface spec must be re-amended with a new DOM-verified placement diagram.

**Forward-compatibility:**
- Regression-tested by `src/components/ui/__tests__/VoiceCardEntryOverlay.placement.test.jsx` which asserts zero overlap between the PTT bbox and any other clickable element on TableView at 1600×720.

### ShowdownView placement (per D-1 — per-villain PTT)

```
┌──────────────────────────────────────────────────────────────────┐
│ Showdown header — board: [♣A][♦J][♥T][♣4][♦2]                    │
├──────────────────────────────────────────────────────────────────┤
│   Seat 3 — Hero: ♠K ♠Q (entered)            [✓]                  │
│   Seat 5 — Villain: [_] [_]                 [🎙 PTT]              │
│   Seat 7 — Villain: [_] [_]                 [🎙 PTT]              │
│   Seat 8 — Villain: [_] [_]                 [🎙 PTT]              │
└──────────────────────────────────────────────────────────────────┘
```

- One PTT button per uncaptured villain row. Grammar scoped to single villain (2 cards per utterance). No cross-villain corruption risk.
- Hidden when that villain's cards are captured (`villain.holeCards.length === 2`).
- Visual treatment matches TableView placement (E-1: no animation, static fill change for active state).
- Each PTT button is independently active. Owner holds the PTT next to villain 5's row → speaks "ace of clubs, jack of diamonds" → releases → chips bind to villain 5 only.
- Villain-row PTT is inside the ShowdownView layout grid (not viewport-anchored like the TableView PTT), so it scales with the rest of the view. ShowdownView is a portrait/landscape-tolerant view at less aggressive scale; ≥44 visual-px floor satisfied by 56 DOM-px at scale ≥0.79 (verified at Gate 5 at 1600×720 and the smallest plausible ShowdownView viewport).

### VoicePttButton component

- **Idle state:** filled circle in surface color (gray-700 background, white mic icon). 56×56 DOM-px.
- **Listening state (held):** static fill swap to one color step (gray-700 → emerald-700 background, white mic icon unchanged). **No pulsing, no ripple, no waveform, no color flash** (Gate 2 E-1 binding).
- **Hold threshold:** affirmative hold ≥300ms before mic activates (Gate 2 E-3). Below threshold = no-op, no listening session begins.
- **Touch handling:** `onPointerDown` starts hold timer; `onPointerUp` / `onPointerCancel` / `onPointerLeave` releases. Hold persists even if pointer drifts slightly inside the button's effective hit area (3px tolerance on perimeter — Gate 5 implementation detail).
- **Disabled state:** if mic permission denied (with flag still ON), button renders at 50% opacity with no listening on touch. Inline label below: `Microphone access denied — open Settings`. Single-tap on label dismisses (per §Mic permission flow).
- **Audio feedback:** NONE during spike. No tap-click, no listening-start chime, no commit-success sound. Gate 2 E-2 binding. Re-evaluating audio is a separate decision *after* the spike validates the silent baseline.

### VoiceConfirmationChips component

Chips render in a non-blocking strip adjacent to (not overlapping) the action zone. Each chip = one parsed card.

```
   Parsed:  [♣A]↕  [♦J]↕  [♥T]↕     [Commit]    [Cancel]
              ▲      ▲      ▲
              swipe up/down on any chip → cycles ranks
              long-press → full re-pick
```

- **Chip:** 64×80 DOM-px (slightly larger than CardPicker chip to accommodate swipe target). Rank + suit visible. Subtle `↕` glyph hints swipe-able vertical gesture.
- **Swipe up:** cycles to next rank (T → J → Q → K → A → 2 → 3 → ...). Suit unchanged. Per R4.
- **Swipe down:** reverse cycle.
- **Long-press chip (≥400ms):** opens the existing CardPicker for that chip's slot. Allows changing suit + rank. R4 fallback for full re-pick.
- **Single tap chip:** no action (preserves the chip; prevents accidental dismissal).
- **Commit button:** primary call-to-action, right of chip strip. Tap = commit chips to underlying card state (flopCards / turnCard / riverCard / villain.holeCards). Strictly explicit — no auto-commit on confidence threshold, no commit-on-timeout (Gate 2 E-4 / R6).
- **Cancel button:** secondary, after Commit. Tap = discard chips, restore pre-utterance state. No data written.
- **Chip strip dismissal:** Commit OR Cancel OR programmatic clear from external event (hand reset, street advance via tap entry). Chips do **not** auto-dismiss on idle timeout.

### Confirmation chip placement on TableView (does not overlap action zone)

```
                         action zone (bottom-center)
                         ┌───────────────────┐
                         │ [Fold][Check][Bet]│
                         └───────────────────┘
   Parsed: [♣A]↕ [♦J]↕ [♥T]↕  [Commit][Cancel]   [PTT🎙]
   └────── confirmation chip strip ──────┘       └─right
   left of PTT, above bottom toolbar, not overlapping action.
```

If width is constrained (small viewport), chip strip wraps to a second row **above** the action zone. Never below. Action buttons remain reachable at all times.

---

## Grammar table (binding per R1 + R5)

The parser maps Web Speech `transcript` (lowercased, punctuation-stripped) to a structured output. All recognized tokens listed; anything outside this table is a **warning** the parser logs and ignores.

### Ranks (13 tokens + phonetic variants)

| Canonical | Primary spoken form | Tolerated variants |
|---|---|---|
| A | `ace` | `aces`, `ahce` (Web Speech mishearings observed for emphasized "ace") |
| K | `king` | `kings`, `keng` |
| Q | `queen` | `queens`, `qween` |
| J | `jack` | `jacks` |
| T | `ten` | `10`, `tens` |
| 9 | `nine` | `nines`, `9` |
| 8 | `eight` | `eights`, `ate`, `8` |
| 7 | `seven` | `sevens`, `7` |
| 6 | `six` | `6`, `sicks` (mishearing observed) |
| 5 | `five` | `5`, `fives` |
| 4 | `four` | `4`, `for`, `fore` (homophones) |
| 3 | `three` | `3`, `tree` (Web Speech mishearing) |
| 2 | `two` | `2`, `too`, `to`, `deuce`, `deuces` |

### Suits (4 tokens + phonetic variants)

| Canonical | Primary spoken form | Tolerated variants |
|---|---|---|
| ♣ | `clubs` | `club`, `clubz`, `cloves` (rare mishearing) |
| ♦ | `diamonds` | `diamond`, `dimonds` |
| ♥ | `hearts` | `heart`, `harts` (mishearing observed) |
| ♠ | `spades` | `spade`, `spaids` |

### Glue token

| Canonical | Spoken | Notes |
|---|---|---|
| (separator) | `of` | Optional glue between rank and suit. `ace hearts` parses identically to `ace of hearts`. `ace o hearts` (slurred) maps to `ace of hearts` then drops glue. |

### Villain designators (per R5)

| Canonical | Spoken | Notes |
|---|---|---|
| villain[1] | `player one` | `player 1` (numeric variant from Web Speech) |
| villain[2] | `player two`, `player too`, `player to` | |
| villain[3] | `player three`, `player tree` | |
| villain[4] | `player four`, `player for`, `player fore` | |
| villain[5] | `player five` | |
| villain[6] | `player six`, `player sicks` | |
| villain[7] | `player seven` | |
| villain[8] | `player eight`, `player ate` | |
| villain[9] | `player nine` | |
| **villain[10]** | `player ten` | Collision rule below. |

**`ten` collision-resolution rule (binding per R5):** The token `ten` (or `10`) is a villain designator **only if** the immediately preceding token is `player`. Otherwise it is the rank `T`. Implementation: parser maintains a 1-token lookback. The token sequence `... player ten ...` is consumed as villain-10; the token sequence `... of ten ...` or `... ten of ...` is consumed as rank T. If the parser encounters `player ten of clubs`, the lookback resolves `ten` as a villain designator and emits a warning that `ten of clubs` does NOT form a card here.

### Sequence separators (per R5)

| Canonical | Spoken |
|---|---|
| `[NEXT]` | `next player` |
| `[NEXT]` | `and then` |

Separators delimit villain-card groups in a single utterance. `player three ace of clubs jack of diamonds next player king of clubs queen of diamonds` parses to:

```js
{
  villainAssignments: new Map([
    [3, [Card("AC"), Card("JD")]],
    [5, [Card("KC"), Card("QD")]]  // (5 inferred ONLY if villain context says so)
  ])
}
```

Without an explicit `player N` for the second group, the parser uses the next-available-villain seat in ShowdownView order. Gate 5 implementation note: ambiguous villain ordering produces a warning + falls back to ordered-position assignment with chip render showing villain ID per chip.

### Tokens outside the table

Anything unrecognized is a warning (`parser.warnings.push("Unknown token: <text>")`), not an error. Unknown tokens do not abort parsing — the parser continues with the next token. This prevents one mishearing from corrupting the whole utterance.

---

## Parser specification

```js
// src/utils/voiceCardEntry/parser.js
export function parseTranscript(transcript, options) {
  // Pre-conditions (R6 strict no-op gate)
  if (!transcript || transcript.trim().length === 0) return NULL_RESULT
  if (options.durationMs < 500) return NULL_RESULT
  if (options.confidence < options.confidenceThreshold) return NULL_RESULT

  // Tokenize: lowercase, strip punctuation, split on whitespace
  const tokens = normalize(transcript)

  // Walk tokens. State machine:
  //   IDLE -> EXPECT_RANK_OR_VILLAIN_OR_NEXT
  //   IDLE + 'player' -> EXPECT_VILLAIN_NUMBER
  //   EXPECT_VILLAIN_NUMBER + <num> -> set villainIdx, return to IDLE
  //   IDLE + <rank> -> EXPECT_OF_OR_SUIT
  //   EXPECT_OF_OR_SUIT + 'of' -> EXPECT_SUIT
  //   EXPECT_OF_OR_SUIT + <suit> -> emit Card, return to IDLE
  //   EXPECT_SUIT + <suit> -> emit Card, return to IDLE
  //   <NEXT separator> -> increment villain group pointer, return to IDLE
  //   <unknown> -> push warning, return to IDLE

  // Post-condition (R6 strict no-op gate)
  if (parsedCards.length === 0) return NULL_RESULT

  return { cards, villainAssignments, warnings }
}
```

`NULL_RESULT` ≡ `null`. Returning `null` from the parser means **no chip render** (R6). The hook (`useVoiceCardEntry`) sees `null` and exits its listening session silently.

**No partial output on parse failure.** If the parser parses 0 cards from a 3s utterance (e.g., parser hears `um yeah uh did the dealer just deal`), return `null`. The chip-render contract requires `parsedCards.length ≥ 1`.

**Confidence threshold:** sourced from Settings (`settings.voiceCardEntryConfidenceThreshold`, default TBD at Gate 4 close — see §Open decisions D-3). Web Speech returns a confidence score per result; below threshold = treat as `NULL_RESULT`.

**Parser determinism:** parser is a pure function over `(transcript, options)`. No internal state, no side effects, no IDB writes. Suitable for unit-test enumeration (every rank × every suit × variant combinations).

---

## Interaction flows

### Flow 1 — Board entry (flop)

**Preconditions:** Preflop closed. Dealer fans flop. PTT visible (state-aware render fires). Owner has phone in hand.

1. Owner picks up phone (~1–2s including unlock).
2. Owner holds PTT. Hold-threshold 300ms passes → mic activates → button changes to listening state (static color step).
3. Owner speaks: `ace of hearts, jack of spades, ten of clubs` (~2.5s utterance).
4. Owner releases PTT.
5. Web Speech `onresult` fires. Parser invoked. Pre-conditions pass.
6. Confirmation chips render: `[♣A]↕ [♦J]↕ [♥T]↕  [Commit] [Cancel]`. Action zone unaffected.
7. Owner glances at chips, confirms accuracy.
8. Owner taps `Commit`. `flopCards` is set via dispatch. Chips dismiss. PTT re-arms for the next street.

**Total:** ~5–9s from phone-pickup to commit, including unlock. Within Between-Hands Chris 5–30s budget.

### Flow 2 — Board entry (turn / river)

Identical to Flow 1 but with single-card utterance: `eight of diamonds` → `[♦8]↕  [Commit] [Cancel]`. Parser handles 1-card output identically to 3-card.

### Flow 3 — Single-villain showdown

**Preconditions:** River action complete. ShowdownView opens. Villain 3 rolls hole cards. PTT visible (per-row OR global, depending on §Open decision D-1).

1. Owner holds PTT.
2. Owner speaks: `player three, ace of clubs, jack of diamonds`.
3. Parser binds `[AC, JD]` to villain[3].
4. Confirmation chips render for villain[3]: `[♣A]↕ [♦J]↕  [Commit] [Cancel]`.
5. Owner taps Commit. Villain[3].holeCards set. Chips dismiss. PTT re-arms if other villains still uncaptured.

### Flow 4 — Multi-villain showdown (per D-1 per-villain PTT)

**Preconditions:** Two villains roll (e.g., seat 3 + seat 5). Dealer window ~3–8s before scoop.

1. Owner holds villain 3's PTT (in seat 3's row).
2. Owner speaks: `ace of clubs, jack of diamonds` (~2s). Villain context = 3 (from UI).
3. Releases. Parser binds `[AC, JD]` to villain[3].
4. Confirmation chips render bound to villain 3: `[♣A]↕ [♦J]↕  [Commit] [Cancel]`.
5. Owner taps Commit (or it auto-clears if owner moves to next PTT — see Gate 5 implementation note below).
6. Owner holds villain 5's PTT.
7. Owner speaks: `king of clubs, queen of diamonds` (~2s).
8. Releases. Parser binds `[KC, QD]` to villain[5].
9. Confirmation chips render for villain 5. Tap Commit.

**Total:** ~6–8s for 2 villains. Edge of the 8s dealer window. Per D-1 ratification, owner accepted this tradeoff vs single-utterance multi-villain (which was the Gate 2 alternative).

**Gate 5 implementation note:** Owner may proceed directly from villain 3's chip render to holding villain 5's PTT without explicitly committing villain 3 first. The hook handles this by treating "start a new PTT cycle elsewhere" as an implicit commit of the prior chips IF the prior chips are unmodified (no swipe-correction happened). If swipe-correction *did* happen, the prior chips lock and must be explicitly committed before a new PTT cycle can start — this prevents accidentally losing a manual correction.

**Risk surfaced at Gate 2 (SC-8):** three-villain showdown at ~9s exceeds the 8s dealer window. The kill-criteria spec (§Kill criteria) defines a 2-villain validated threshold; 3+ villains falls back to tap entry.

**R5 advisory behavior:** If owner speaks "player three, ace of clubs, jack of diamonds" while holding **villain 5's** PTT (the UI-selected villain), the parser logs `Warning: utterance villain token 'player three' contradicts UI selection 'villain 5' — UI selection wins`. Chips bind to villain 5. No re-routing. This preserves R5's grammar tokens for parser robustness while honoring D-1's per-villain UI flow.

### Flow 5 — Abort path (R6 strict no-op, HE-NEW-VCE-03)

**Trigger:** Mid-Hand Chris stress — action arrives faster than expected mid-utterance.

1. Owner is mid-utterance: `ace of hearts, jack of —` and the dealer says `sir, action is on you`.
2. Owner releases PTT immediately.
3. Web Speech `onresult` fires with partial transcript `ace of hearts jack of`.
4. Parser invoked:
   - Pre-conditions: transcript non-empty, duration ≥0.5s, confidence ≥ threshold — could pass.
   - State machine: parses `[♥A]` (jack-of-with-no-suit fails to emit). Returns 1 card.
   - This is **not** a no-op — 1 card parses successfully. Confirmation chip renders for `♥A` only.
5. Owner sees the lone chip blocking nothing (chip strip is non-overlapping). Action zone reachable in 1 tap.
6. Owner taps `Cancel` to dismiss the chip strip OR ignores it and taps an action button — chip strip auto-clears on commit-elsewhere.

**Distinct sub-case — true blank release** (R6 binding):
1. Owner panic-releases PTT with no utterance.
2. Parser pre-conditions fail (empty transcript OR <0.5s duration). Returns `null`.
3. No chip render. No state change. PTT re-arms silently. Action zone untouched.

### Flow 6 — Correction (R4 swipe-to-cycle)

**Trigger:** Parser hears `queen of hearts` when owner said `king of hearts`. Confirmation chip renders `♥Q`.

1. Owner glances at chips. Identifies the wrong rank (suit was heard correctly).
2. Owner swipes **up** on the `♥Q` chip. Chip becomes `♥K` (rank cycles Q → K).
3. Owner taps Commit. Correct card written.

**Total correction cost:** 1 gesture (swipe) + 1 tap (commit) = 2 deliberate actions. Satisfies revised R4 kill criterion.

**Sub-case — suit was wrong:** Owner long-presses chip → existing CardPicker opens → owner taps correct rank + correct suit → CardPicker closes, chip updates. ~3 actions in the fallback path.

### Flow 7 — Mic permission grant + denial-recovery (Gate 2 E-6)

**First-time grant flow:**
1. Owner enables `voiceCardEntry` in Settings. Flag persists to IDB.
2. Owner returns to TableView. Flop dealt. PTT renders (state predicates fire).
3. Owner holds PTT. **First-ever hold** triggers OS-level permission request: `[App] would like to access the microphone`.
4. Owner taps `Allow`. Web Speech proceeds. Normal listening flow continues.
5. Subsequent holds: no permission prompt. Web Speech proceeds immediately.

**Denial path:**
1. Owner taps `Deny` at the OS permission prompt.
2. Web Speech throws `not-allowed`. Hook catches.
3. PTT button enters disabled state (50% opacity, inline label below: `Microphone access denied — open Settings`).
4. **Flag stays ON.** Owner may grant via OS Settings later and return.
5. On next TableView mount, the hook re-checks `navigator.permissions.query({ name: 'microphone' })`. If state = `granted`, PTT restores to active state. If still `denied`, stays disabled.
6. Owner can explicitly turn the flag OFF in Settings if they want to dismiss the disabled-PTT visual entirely.

**Device-level error path** (Web Speech firing `network` / `audio-capture` / `language-not-supported`):
1. Hook catches the error. Logs to console. Does not surface as a toast (Gate 2 E-6 + H-PLT04: no conspicuous error messages mid-hand).
2. PTT enters disabled state with inline label: `Voice unavailable on this device`.
3. Flag stays ON. Owner may toggle off in Settings if persistent.

### Flow 8 — iOS-Safari fallback (OPEN DECISION D-2)

Two candidate behaviors (owner ratifies at this gate close):
- **D-2a — silent disable:** `webkitSpeechRecognition` is undefined → PTT never renders at all on iOS Safari. Flag toggle in Settings becomes a no-op visually (toggle still saves to IDB but has no surface effect).
- **D-2b — grayed-button-with-explanation:** PTT renders in disabled state at all times on iOS Safari with inline label: `Voice not supported on this browser`. Flag toggle works; just produces a permanently-disabled PTT.

Default recommendation: **D-2a (silent disable)** — Less visual noise on a surface governed by strict density constraints; iOS Safari users can simply leave the flag OFF and not encounter it.

---

## Feature flag

```js
// In SettingsView toggles
settings.voiceCardEntry = false  // default
settings.voiceCardEntryConfidenceThreshold = 0.65  // default — see Open decisions D-3
```

**Render contract:**
- `voiceCardEntry === true` is a NECESSARY but not SUFFICIENT condition for PTT render. State-aware predicates (§State-aware visibility) are the sufficient condition.
- `voiceCardEntry === false` (default): PTT never renders. All VCE code paths are dead-coded behind the flag — no Web Speech initialization, no permission queries, no hook subscription.
- Flag persists to IDB (existing settings store). No migration needed (additive field).

**Settings UI:** Single toggle row labeled `Voice card entry` with a sub-text: `Hold to speak board + showdown cards. Live-table spike — your feedback determines if it ships.`. Below: confidence-threshold slider (0.5 to 0.9, default 0.65) — see D-3.

---

## Kill criteria (OPEN DECISION D-4 — numeric thresholds owner-ratified at Gate 4 close)

WS-181 accept criteria provides candidate values. Gate 4 close ratifies actual numbers.

| ID | Criterion | Candidate threshold (WS-181) | Notes |
|---|---|---|---|
| **K-a** | Per-card accuracy at typical poker-room SPL (~70–75 dB) | ≥ 90% | Measured: out of N parsed cards in live validation, ≥90% match what owner said. |
| **K-b** | End-to-end speed vs current tap baseline | VCE faster on ≥80% of trials | Owner times both. No instrumented harness pre-spike (Gate 1 observation 5). |
| **K-c** | Correction cost | ≤2 deliberate user actions (per R4 revision) | Was "≤1 tap" pre-Gate-2 (unachievable). |
| **K-d** | False-commit count | Zero | Hard binary. Chips always inert until explicit commit tap (Gate 2 E-4 + R6). |
| **K-e** *(added 2026-05-11 Gate 4)* | Multi-villain coverage | 2-villain showdown captured within 8s; 3+ villains fall back to tap | Per Gate 2 SC-8. |
| **K-f** *(added 2026-05-11 Gate 4)* | Abort-without-side-effects | 100% of blank/short releases produce no UI state change | Per R6 + HE-NEW-VCE-03. Hard binary. |

**Disposition logic:**
- All criteria pass → **SHIP** (`/decide` ADR: flag stays, default flips ON).
- K-c, K-d, K-f pass + K-a, K-b borderline → **KEEP-OFF** (`/decide` ADR: flag stays, default OFF, owner-opt-in only).
- K-d OR K-f fail → **DROP** (`/decide` ADR: rip out, archive surface with post-mortem). K-d failure = false-commits corrupt hand data; K-f failure = abort-path failure poisons action zone — both are unrecoverable.
- K-a + K-b both fail → **DROP**. Spike was supposed to ship-or-drop; degraded-but-still-shipped is incremental-follow-up territory, which R3 forbids.

---

## Post-validation drop path

Per R3 + §Status header, this surface artifact lives in two states until Gate 5 close:

1. **Spike — pending validation** (current).
2. **Post-spike** — one of:
   - **Status: shipped — flag ON.** Surface artifact retained; "Status" header updated.
   - **Status: shipped — flag OFF (owner opt-in).** Surface artifact retained; "Status" header updated; rationale appended.
   - **Status: archived — DROPPED.** Surface artifact retained as historical reference. New "Post-mortem" section appended explaining which kill criterion failed and why. `/decide` ADR cross-referenced. Code paths deleted in the same workstream.

---

## Open decisions — RATIFIED 2026-05-11 at Gate 4 close

| ID | Decision | Ratified |
|---|---|---|
| **D-1** | ShowdownView PTT geometry | **Per-villain PTT** (one button per uncaptured villain row). Owner ratified safety-net over speed. Grammar scoped to single villain per PTT cycle. Mishear cannot cross villains. **R5 reconciliation:** the extended grammar with villain tokens remains in the parser as ADVISORY only — if owner speaks "player three, ace of clubs, jack of diamonds" while villain 5's PTT is held, the UI-selected villain (5) wins; the `player three` token is logged as a warning but does not redirect. Future global-PTT surface change would re-activate villain tokens as load-bearing. |
| **D-2** | iOS-Safari fallback | **Grayed-button + explanation.** PTT renders in disabled state at all times on iOS Safari with inline label `Voice not supported on this browser`. Single-tap dismisses temporarily; re-renders on next reveal. Owner chose transparency over visual cleanliness. |
| **D-3** | Confidence threshold default | **0.65** (balanced). Settings exposes a slider in range 0.5–0.9 for live tuning. |
| **D-4** | Kill-criteria numeric thresholds | **Accepted candidates:** K-a ≥90% accuracy, K-b faster on ≥80% of trials, K-e 2-villain showdown within 8s. K-c/K-d/K-f are binary and already specified. |
| **D-5** | TableView PTT placement | **Outside ScaledContainer.** PTT is viewport-anchored bottom-right at 56×56 DOM-px (= 56 visual-px) constant at all scales. Independent of scale-factor calculations. H-ML06 guaranteed. |

---

## Known behavior notes

- **Phone-sleep stress:** Web Speech requires an active page context. PTT cannot pre-initiate before phone-sleep; each use starts fresh. Phone-wake to PTT-hold-ready: ~2s on mid-range Android. Acceptable within Between-Hands Chris budget (5-30s) but cuts into it. Gate 2 SC-1 binding: PTT affordance must be first-render on TableView wake; no animation or transition delaying its availability.
- **One-handed stress:** PTT must be holdable with one hand. Bottom-right placement at 56 DOM-px satisfies this for right-handed Chris (per Mid-Hand Chris constraint that thumb-reachable arc is bottom-right quadrant).
- **Ambient noise:** Owner observation needed during Gate 5 spike for actual poker-room SPL. WS-181 assumes ~70–75 dB; real value drives kill-criterion K-a interpretation.
- **`onpointerleave` accidental release:** If owner drifts thumb off the PTT button while speaking, `onpointerleave` fires and releases. 3px tolerance buffer mitigates. Gate 5 implementation detail.
- **Web Speech `onerror` mid-recognition:** Hook catches all error types; surface degrades to PTT-disabled per Flow 7. No exception propagates to React.

---

## Known issues

(Gate 4 spec — no findings yet. Gate 5 spike will surface findings; post-validation audit will populate this section.)

---

## Test coverage plan (Gate 5)

| Layer | Coverage |
|---|---|
| Grammar (`grammar.test.js`) | Enumerate 13 ranks × 4 suits × variants → 52 canonical cards from canonical phrasings + 26+ phonetic variant cases. Villain tokens (9 + `player ten` collision) + 2 separators. Unknown-token warning emission. |
| Parser (`parser.test.js`) | Pre-condition gates (R6): null on empty, <0.5s, low confidence, 0-card. Multi-card output. Multi-villain output (R5). Collision: `ten` as villain vs rank in 4 grammatically distinct contexts. Partial-board (interruption case from Gate 2 SC-6). Unknown-token tolerance (parser continues, does not abort). |
| Hook (`useVoiceCardEntry.test.js`) | Web Speech mocked. Lifecycle: idle → listening → result → chip-state → commit. Abort path (R6 strict no-op). Permission-denial path (Flow 7). iOS-Safari `webkitSpeechRecognition` undefined → silent disable (D-2a). |
| PTT component (`VoicePttButton.test.jsx`) | Hold threshold ≥300ms (E-3). Conditional render per state predicates (E-5). Disabled state. No animation in active state (E-1). 56-px minimum DOM size + scale-factor compliance (E-7). |
| Confirmation chips (`VoiceConfirmationChips.test.jsx`) | Render N chips for N parsed cards. Swipe-up cycles rank (R4). Swipe-down reverse cycle. Long-press opens CardPicker. Commit dispatches. Cancel dismisses. No auto-commit on timer (E-4). |
| Visual verification (Playwright) | 1600×720 reference + 640×360 small-viewport. PTT placement, chip-strip non-overlap with action zone (Gate 2 SC-4 binding), multi-villain chip layout, mic-disabled visual treatment. |

---

## Change log

- 2026-05-11 — Authored at Gate 4. R4–R6 ratified at Gate 2 close. 5 open decisions (D-1..D-5) deferred to Gate 4 close ratification by owner before Gate 5 implementation begins. Source: WS-181, Gate 1 audit `2026-05-11-entry-vce.md`, Gate 2 roundtable `2026-05-11-blindspot-vce.md`.
- 2026-05-11 — D-1..D-5 ratified at Gate 4 close. D-1: per-villain PTT (R5 grammar tokens demoted to advisory). D-2: grayed-button + explanation on iOS Safari. D-3: confidence 0.65 default. D-4: K-a 90% / K-b 80% / K-e 8s accepted. D-5: PTT outside ScaledContainer. Spec ready for Gate 5 implementation.
