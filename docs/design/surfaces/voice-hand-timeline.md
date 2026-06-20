# Surface — Voice Hand-Timeline (Voice Hand-Tree Entry)

**ID:** `voice-hand-timeline`
**Status:** Pre-Gate prototype — owner-only sandbox. Speech→timeline parser deferred until real voice data is collected. Decision: [DEC-021](../../../system/decisions.md#dec-021-voice-input-scope-expansion--ws-181-card-spike--voice-hand-tree-entry-re-ratifies-r2-r1-holds).
**Supersedes/extends:** [`voice-card-entry.md`](./voice-card-entry.md) (WS-181, cards-only). This surface is the action-sequence + full-hand-tree evolution.
**Project:** Voice Hand-Tree Entry (memory: `project_voice_hand_tree_entry.md`).
**Design source:** `prototypes/voice-hand-timeline.html` (standalone) → `src/components/views/VoiceTimelineSandbox/VoiceTimelineSandbox.jsx` (in-app sandbox).
**Last reviewed:** 2026-06-19 — owner ratified scope expansion + correction model via AskUserQuestion.

**Code paths:**
- `src/components/views/VoiceTimelineSandbox/VoiceTimelineSandbox.jsx` — sandbox screen: real Web Speech capture + hand-tree editor.
- `src/constants/uiConstants.js` — `SCREEN.VOICE_TIMELINE_SANDBOX`.
- `src/constants/viewRegistry.jsx` — registry entry (orientation: portrait).
- `src/components/views/SettingsView/AdminSection.jsx` — `SANDBOX_TOOLS` card (owner-email gate).
- Existing reuse target (not yet wired): `src/utils/voiceCardEntry/` (grammar + parser), `src/hooks/useVoiceCardEntry.js`.

**Route / entry points:** Owner-only. Settings → Admin/Sandbox → "Voice hand-timeline". No public route; not in main nav.

---

## Purpose

Let the owner narrate a poker hand by voice into a single editable **hand-tree** — all streets, all actors, in order — usable both **live** (glance at the recorded hand, clear one uncertain link, dismiss, keep playing) and **post-hoc** (reconstruct a hand from memory, restructuring it: insert a forgotten cold-caller, re-type a check-raise as a donk 3-bet). Voice is one writer into the hand-tree; the touch editor is the other. The center of gravity is **graceful degradation on partial hearing**: when recognition is imperfect, the correction UX must let the owner decide whether the partial data is good enough to fix in place or worth a retry — fixing in place is primary, retry is secondary.

---

## Founder ratifications (binding)

| ID | Statement | Source |
|---|---|---|
| **R1** | Web Speech API only. No cloud transcription / Whisper. (Carried from WS-181, still binding.) | WS-181; reaffirmed DEC-021 |
| **R2′** | Scope EXPANDED from cards-only to whole-hand narration including **action sequences** + full hand-tree editing. (Supersedes WS-181 R2.) | DEC-021, 2026-06-19 |
| **R-SoT** | The capability writes into the **same hand record the live tracker uses** — no parallel hand format. One source of truth. | DEC-021, 2026-06-19 |
| **R-FIX** | On partial hearing, **always render the partial chain immediately; fix-in-place is primary, retry is secondary.** "Only fix the doubt" is the top layer over a full editable timeline. | Owner, 2026-06-19 (AskUserQuestion) |
| **R-GEST** | Correction gestures: **swipe to fix a value + drag to reorder.** Usually the owner touches only the one uncertain link. | Owner, 2026-06-19 (AskUserQuestion) |
| **R-DATA** | The speech→timeline **action parser is built from REAL captured voice data, not guesses.** Capture first; parse later. | DEC-021, 2026-06-19 |

---

## JTBD served

**Primary:**
- Enter a hand hands-light without breaking table presence (live peek context) — extends `HE-NEW-VCE-01`.
- Reconstruct a hand from memory after the fact, including structural recall corrections — new (HE-16 voice-for-actions, previously Proposed under WS-181, now in scope).

**Secondary:**
- Abort/partial recovery without side effects (`HE-NEW-VCE-03`) — generalized: partial hearing yields a fixable chain, never a corrupted hand.

---

## Personas served

**Primary:** Between-Hands Chris (live peek), Post-Session Chris (reconstruction).
**Secondary:** Mid-Hand Chris (must not block the action zone; live peek is glance-and-dismiss).
**Non-personas:** any non-owner user (sandbox is owner-email-gated); online/multi-tabler surfaces (out of scope).

---

## The model

### Hand-tree object
A hand = ordered **streets** (Preflop / Flop / Turn / River), each an ordered list of **actions**: `{ actor, action, size? }`.
- `actor` ∈ seats (UTG / MP / CO / BTN / SB / BB / Hero).
- `action` ∈ fold / check / call / limp / bet / raise / 3-bet / 4-bet / donk / check-raise.
- `size` present only for sized actions; `null` size on a sized action = **unclear** (amber).

### Two layers (R-FIX)
1. **Confirm-by-exception (top).** Confident links lock and stay silent. Only uncertain links surface — one at a time — with a scrubber + a "say it again" voice option. If 5 of 6 came through, the owner interacts with exactly 1 thing.
2. **Full editable timeline (underneath).** Tap any action → change action (incl. donk / check-raise), pick the seat, scrub the size, move up/down, insert-after, delete. "＋ add action" inserts a forgotten actor. This is the escape hatch when memory needs restructuring.

### Two contexts, one surface
- **Live peek:** glance, clear the one amber doubt, "Looks right — back to table," keep playing.
- **Reconstruct:** open the whole tree, restructure freely from memory.

### Pre-trainers (permanent trigger vocabulary)
Structural tokens the parser ALWAYS recognizes, segmenting the utterance so a garbled card/size stays contained to one link instead of breaking the hand:
- **Start anchor:** "new hand" / "preflop".
- **Street advancers:** "flop" / "turn" / "river" / "next street" (action analog of the card grammar's existing `next player` / `and then`).
- **Self-reference:** "I" / "hero" → Hero seat.
- **Positions:** UTG / MP / CO / BTN / SB / BB.

---

## Voice-data collector (built; live)

The sandbox screen captures **real** Web Speech transcripts: tap-to-start/stop, continuous + interim, accumulates final results, persists device-local (localStorage, capped 200), "copy all" export. This is the instrument that produces the data R-DATA requires before the parser is written. It does **not** yet parse speech into the timeline — capture and edit are separate by design.

---

## What is deferred (and why)

| Deferred | Why |
|---|---|
| **speech → timeline parser** | R-DATA: build the action grammar from real captures, not guesses. |
| **commit into the real hand record** | R-SoT path; built after the model is validated. Sandbox writes nothing to real hands yet. |
| **numeric kill-criteria for the expanded capability** | Set at first live validation (mirrors WS-181 K-a/K-b/K-c). |
| **drag-to-reorder polish** | Sandbox uses up/down + insert/delete for robust one-finger editing; free-drag reorder is a refinement. |

---

## Open decisions (for a later gate)

- Exact action grammar (token table for actions/sizes/positions) — authored from captured data.
- How "say it again" re-listens for a single value (scoped re-capture vs full re-narrate).
- Whether the timeline editor graduates from sandbox into a real surface, and if so where it lives relative to TableView and HandReplay.
- Multi-way pot sizing semantics ("three-bet to 45" vs "three-bet 45") and all-in handling.

---

## Change log

- 2026-06-19 — Authored at sandbox-prototype stage. Scope expansion ratified in DEC-021 (re-ratifies WS-181 R2; R1 holds). Correction model ("only fix the doubt" + swipe/drag, fix-in-place over retry) and one-source-of-truth ratified by owner via AskUserQuestion. In-app owner-only sandbox shipped: real voice capture + hand-tree editor. Parser + real-hand-record commit deferred pending real voice data.
