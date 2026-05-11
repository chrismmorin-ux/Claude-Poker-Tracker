# Blind-Spot Roundtable -- 2026-05-11 -- Voice Card Entry (VCE)

**Roundtable ID:** blindspot-vce-2026-05-11
**Feature:** Voice Card Entry -- Web Speech spike for board + villain showdown card entry
**Gate 1 source:** docs/design/audits/2026-05-11-entry-vce.md -- Verdict YELLOW
**Backlog ticket:** WS-181
**Authored by:** Product/UX Thinker (Stage C + Stage E primary); supporting personas for Stages A, B, D
**Date:** 2026-05-11

---

## Feature summary

Owner proposes a push-to-talk (PTT) mechanism on TableView and ShowdownView that pipes a brief voice utterance ("ace of hearts, jack of spades, ten of clubs") through the Web Speech API, snaps phonetic variants to canonical cards via a constrained parser, renders confirmation chips before commit, and requires a single tap to finalize. Scope is locked to board cards (flop/turn/river) and villain showdown cards only. Three founder ratifications bind: Web Speech only (no cloud), board+showdown scope only (no actions, no hole cards), ship-or-drop (no incremental follow-ups if live-table validation fails). Gate 1 returned YELLOW; Gate 2 is therefore required before Gate 4 surface authoring.

---

## Stage A -- Persona sufficiency

**Output: OK -- Match**

Gate 1 pre-screened this and found the existing persona cast sufficient. Confirming:

Between-Hands Chris is the correct primary persona for board entry (flop dealt between preflop and flop betting, turn/river similarly). The board-reveal moment sub-situation sits within between-hands-chris 30-90s window, and between-hands-chris already governs the highest-stakes version of that window (player swap + logging under dealer-deal pressure). No new sub-persona is warranted. Gate 4 surface spec should annotate that board entry via PTT targets the narrow 5-15s window at the start of the between-hands interval, before dealer pressure to enter cards grows.

Mid-Hand Chris is correctly flagged as secondary (board reveal blurs into hero decision in short-stack/fast-action situations). Stage C resolves the specific stress case.

Ringmaster (home-game host) is a legitimate tertiary. Home tables run slower, social cover is higher, ambient noise is lower -- VCE likely performs better for Ringmaster than for Chris at a casino table. Not a gap; noted as an observation for Gate 4 kill-criteria calibration (Ringmaster may pass thresholds Chris fails).

No new core persona is missing. No existing persona requires splitting for VCE scope.

---

## Stage B -- JTBD coverage

**Output: CAUTION -- Expansion needed**

Gate 1 proposed HE-NEW-VCE-01 and HE-NEW-VCE-02 as candidates. Confirming and refining:

**HE-NEW-VCE-01 -- Enter newly revealed cards hands-free**
Ratified as a distinct JTBD. It is not a sub-outcome of HE-14 (discreet entry): HE-14 job is not drawing attention via extended phone-staring; HE-NEW-VCE-01 job is keeping eyes on the table and hands available during a card reveal that has genuine strategic content (reads, timing, tells). The failure modes differ: HE-14 fails when entry is conspicuous; HE-NEW-VCE-01 fails when entry requires a focused 10-second eyes-down window that makes Chris miss a timing tell or physical reaction from a villain on the flop reveal. Recommend adding to jtbd/domains/hand-entry.md with state Active on Gate 2 ratification.

**HE-NEW-VCE-02 -- Recover from a misheard card in one tap**
Recommend folding into HE-12 as a named sub-flow (voice-correction sub-flow) rather than a new top-level JTBD entry. The job statement (correct it without re-entering the whole board) is structurally identical to HE-12 statement (correct it without losing the hand). The implementation differs (chip-tap vs. action-undo) but the outcome does not. Adding a sub-flow annotation keeps the atlas at the right granularity.

**Gap Gate 1 did not surface:** There is no JTBD for abandon a voice entry mid-utterance without committing any partial result. This is a legitimate distinct outcome from HE-12 (which is repair-after-commit, not abort-before-commit). Proposed: HE-NEW-VCE-03 -- Abort a voice entry in progress without side effects. It maps directly to the Mid-Hand Chris stress case in Stage C (action arrives while PTT is held; owner needs to drop the phone immediately). Gate 4 must specify this outcome's UX path. Recommend adding to jtbd/domains/hand-entry.md as state Proposed.

---

## Stage C -- Situational stress test

**Output: CAUTION -- Adjust -- three scenarios require targeted design decisions; one surfaces a near-failure**

This stage received the full adversarial treatment. Four scenarios walked in sequence.

---

### Scenario 1 -- Between-Hands Chris, standard flop entry

**Situation:** Preflop action closes. Dealer fans the flop. Chris picks up phone. Chris has approximately 10-20s before the first flop actor is asked to act.

**Walk-through:**

1. Dealer fans three cards. Chris glances at board: Ac Jd Th (visually confirmed at table).
2. Chris picks up phone one-handed (right hand, thumb on lower-right quadrant per H-PLT02). Phone may have slept -- H-PLT05 stress applies.
3. Chris locates PTT button. First critical gap: if PTT is in-picker, Chris must open the card picker first -- that adds 1 tap and ~2s, eroding the budget. PTT must be directly accessible on TableView.
4. Chris holds PTT. Web Speech begins listening. No tactile confirmation -- mic-live indicator must be unambiguous at a glance under dim table lighting (H-PLT03).
5. Chris speaks: ace of clubs, jack of diamonds, ten of hearts. ~2.5s of speech. Total elapsed from phone-pickup: ~4-6s including unlock, locate, hold.
6. Chris releases PTT. Web Speech fires onresult. Parser maps transcript. Android Chrome processing latency: 300-800ms after release. Elapsed now ~5-7s.
7. Confirmation chips render. Chris taps commit. Total elapsed: ~6-9s.
8. Between-hands-chris 5-30s budget for logging tasks. **This passes the budget under good conditions.**

**Phone-sleep stress (H-PLT05):** Android Chrome Web Speech requires an active page context. PTT cannot be pre-initiated before phone-sleep; must be initiated from scratch on each use. Phone-wake to PTT-hold sequence: ~2s minimum on a mid-range device. Acceptable within budget but cuts into it.

**Finding SC-1 (Moderate):** Phone-wake latency unaccounted for in the design. Gate 4 must specify that the PTT affordance is the first-render element on TableView wake with no animation or transition delaying its availability.

**One-handed stress:** PTT must be holdable with one hand while Chris may hold cards in the other. Achievable if PTT is bottom-right thumb-reachable and large enough to hold reliably without visual confirmation of contact.

**Finding SC-2 (Low):** No blocking issue with standard between-hands flop entry under good conditions. Budget passes.

---

### Scenario 2 -- Mid-Hand Chris, fast-action stress

**Situation:** Short-stack villain (8 BB effective) jams all-in on the flop. Chris is in the hand. Flop was just dealt 5 seconds ago and Chris has not yet entered the board cards. Action is now on Chris. Chris has ~10-15s before looking like he is tanking.

**Walk-through:**

1. Villain jams. Action is on Chris. Chris needs to: (a) enter board cards so the engine has context, (b) read the recommendation, (c) decide.
2. If Chris initiates PTT: holds PTT, speaks 3 cards (~2.5s), releases, waits for confirmation chips (~0.5-1s), taps commit (~0.5s). Total: ~4-5s before the engine has board context.
3. During those 4-5s, action buttons are live on screen. Does holding PTT visually or functionally block the action buttons? If PTT is a floating button overlapping the action zone and Chris is holding it, he cannot simultaneously hold PTT and tap an action button. This is the critical failure mode.
4. Even if PTT does not physically block action buttons, Chris has a single thumb in use (PTT hold). Tapping an action button while holding PTT means: release PTT (triggering a premature parse of an incomplete utterance, or a blank utterance), then tap action. The in-flight PTT hold and the action-tap are mutually exclusive on a one-handed device.
5. Correct behavior: Chris must be able to abort voice entry instantly (PTT release with no text spoken = no-op) and reach action buttons within 1 tap. If parse logic fires on a blank or very short utterance and shows junk confirmation chips, that blocks the action zone visually until Chris dismisses or a timeout clears it.

**Finding SC-3 (CRITICAL):** A blank or short utterance on PTT release must produce zero UI state change -- no confirmation chips, no spinner, no partial parse. The parser must have a minimum-confidence gate that results in a strict no-op when utterance duration is below ~0.5s or transcript is empty. Gate 4 must specify this explicitly. Without it, a panic-release of PTT during fast action leaves Chris with a broken confirmation UI blocking his action buttons -- a live-hand corruption.

**Finding SC-4 (CRITICAL):** PTT button placement must not physically overlap the action button zone. The action zone is the primary mid-hand surface. PTT is a between-hands tool. Gate 4 surface spec must show both the TableView action state and the TableView board-entry state with PTT visible in each, confirming no spatial conflict.

**Finding SC-5 (Moderate):** There is no specified abort-voice-entry affordance beyond PTT release. Gate 4 must guarantee either: (a) PTT release with blank utterance = strict no-op, or (b) an explicit cancel affordance adjacent to the confirmation chip area. Connects to HE-NEW-VCE-03 (JTBD gap from Stage B).

**Interruption stress (dealer asks Chris a question mid-utterance):** Chris is mid-utterance: ace of hearts, jack of -- and the dealer says sir, action is on you. Chris stops speaking, turns to the table. PTT is still held or released. If held: Web Speech continues recording ambient table noise and dealer speech. Parser receives ace of hearts jack of [dealer noise] and may snap to a junk third card. Gate 4 must specify that the confirmation chip render never auto-commits -- chips must sit inert until Chris explicitly taps commit. Any auto-commit on high-confidence parse would be catastrophic here.

**Finding SC-6 (Moderate):** Interruption mid-utterance produces ambiguous parse output. The parser must handle partial boards gracefully -- showing N chips for the N cards it parsed, not forcing Chris to commit a complete board or nothing. If the parser produces 2 chips from a 3-card utterance, Chris must be able to tap-add the missing card via the existing chip picker without re-speaking the whole utterance.

---

### Scenario 3 -- Villain showdown, multi-villain rapid entry

**Situation:** River action ends. Dealer says show them. Two or three villains flip. Dealer clock: ~3-8 seconds before scooping. Chris needs to capture N villains x 2 cards in sequence before the cards are gone.

This is the hardest VCE scenario and the one most likely to expose a fundamental mismatch.

**Single-villain best case:** Chris holds PTT, says: player three, ace of clubs, jack of diamonds. Releases. Parser must handle the villain designator plus 2 cards. Confirmation chips render. Chris taps commit. Elapsed: ~3-4s. Marginal but achievable.

**Two-villain realistic case:** Two villains flip. Chris holds PTT, says: player three, ace of clubs, jack of diamonds, player five, king of clubs, queen of diamonds. Releases. The grammar must now parse: a villain designator, two cards, another villain designator, two more cards. This is a materially different parsing problem from single-villain or board entry. The current grammar spec (13 ranks x 4 suits + of + phonetic variants) makes no provision for villain designators or sequencing tokens.

**Finding SC-7 (CRITICAL -- grammar scope gap):** The proposed grammar table is sufficient for single-entity board entry (3-5 cards, same entity). It is not sufficient for multi-villain showdown entry in a single utterance. The grammar must either:

Option A: Extend to include villain-designator tokens (player one through player nine, seat number variants) and a sequencing separator (next player, and then). This expands the grammar significantly and introduces new parse ambiguity. Key collision: player ten collides with rank ten. Solvable but non-trivial.

Option B: Require per-villain PTT -- one PTT hold per villain, with the UI keeping the active-villain context visible so Chris knows which villain he is currently entering.

Option B is strongly preferred. Per-villain PTT keeps the grammar at its current scope (2 cards per utterance), the parser has a fixed-length expected output (exactly 2 cards), and a mishear on villain 2 does not corrupt villain 1 entry. UX cost: Chris holds PTT twice for a two-villain showdown. At 3-8s total window, two 2.5s utterances plus 0.5s confirmation each = ~6s. At the edge of the budget for two villains but does not exceed it.

**Finding SC-8 (High):** For three or more villain showdowns, even per-villain PTT is at budget risk. Three villains x ~3s per villain = ~9s, exceeding the 8s window. VCE kill criteria should specify a minimum viable villain count (e.g., two-villain showdown within 8s) rather than implying all-villain coverage. Gate 4 must be explicit about N-villain limits and fall-back to tap entry when N exceeds the threshold.

**Finding SC-9 (Moderate):** Gate 4 grammar table must explicitly address villain-designation: either ban it (per-villain PTT only, Option B) or specify the exact designator tokens and their collision analysis. The ambiguity resolution rule must live in the grammar table, not left to implementation.

---

### Scenario 4 -- Misheard card recovery under ambient noise

**Situation:** Poker room SPL ~70-75 dB. Competing voices. Dealer calling action for adjacent table. Web Speech hears queen of harts when Chris said king of hearts.

**Walk-through:** Parser snaps harts to hearts (phonetic variant). Queen of hearts maps to Q-hearts. Confirmation chip renders as Q-hearts. Chris glances at confirmation area. Sees Q-hearts. Knows it should be K-hearts. Needs to correct.

The kill criterion in WS-181: misheard cards correctable in 1 tap. What does 1-tap correction look like in the confirmation chip UX?

**Finding SC-10 (CRITICAL -- kill criterion is unachievable as stated):** Correctable in 1 tap is not implementable with any standard picker flow. A picker requires: (1) open picker, (2) select rank, (3) select suit -- 3 taps minimum. Even a rank-only correction picker (if suit was correct and only rank was wrong) requires 2 taps: open, then select rank. The only true 1-gesture correction paths are:

- Swipe up/down on the chip to cycle through nearby ranks (swipe up on Q-hearts to get K-hearts). This is a gesture, not a tap -- viable but adds new interaction vocabulary that must be discoverable without explicit instruction at the table.
- Long-press chip, popover of 13 ranks in that suit, tap the right rank. Technically 2 actions but psychologically close to one deliberate action after the long-press.
- Re-speak only the wrong card: hold PTT while the chip is selected, speak one card, parser replaces just that chip. Single voice action but requires the parser to understand replace-selected-chip context.

The kill criterion must be re-stated as something achievable. Recommend: misheard card correctable without re-entering the entire board; correction path is 2 deliberate user actions maximum. Gate 4 must specify the exact correction UX and validate it is achievable within that constraint.

---

### Stage C verdict reasoning

Two CRITICAL findings (SC-3: blank utterance must be no-op; SC-10: 1-tap correction kill criterion unachievable) plus one CRITICAL grammar scope gap (SC-7: multi-villain sequencing outside grammar spec). These are not reasons to DROP VCE -- they are precision requirements Gate 4 must specify. The feature survives Stage C as adjustable because:

- Between-Hands Chris standard board entry passes the time budget under good conditions (SC-2 Low).
- Mid-Hand Chris abort path is addressable by spec (SC-3, SC-4).
- Multi-villain showdown is addressable by per-villain PTT, Option B recommended (SC-7).
- Correction is achievable with swipe-to-cycle or re-speak if the kill criterion is reworded (SC-10).

The adjustments are non-trivial and must resolve in Gate 4 before implementation begins.

---

## Stage D -- Cross-product / cross-surface

**Output: OK -- Scoped correctly**

Gate 1 pre-screened this and found clean isolation. Confirming:

VCE writes to the same card state that the existing tap CardPicker writes. The downstream pipeline (exploitEngine, rangeEngine, analysisPipeline) is unaffected -- VCE is input-layer only per WS-181. No engine code is touched.

ShowdownView villain card entry zone will need the PTT affordance added. The villain-row layout in ShowdownView is the only structural change on an existing surface. Gate 4 surface spec should include a ShowdownView layout mockup confirming the PTT button does not collapse the existing villain name and card chip row on small viewports (H-ML01 stress at 640x360 minimum).

Sidebar (Ignition extension): online play uses auto-capture. VCE is live-manual-entry only. Zero ripple.

No cross-product issue. No navigation path changes. State written by VCE (confirmed board cards, villain showdown cards) is the same state written today by the tap picker -- same downstream consumers, same IDB schema.

One architectural observation for Gate 4: if VCE ships and later HE-16 (voice for actions) is taken up as a separate workstream, the two will share Web Speech infrastructure. Gate 4 should design src/utils/voiceCardEntry/ + src/hooks/useVoiceCardEntry.js with a replaceable grammar and parser interface so HE-16 can compose from the same hook without a full refactor. This is a forward-compatibility note, not a Stage D gap.

---

## Stage E -- Heuristic pre-check

**Output: CAUTION -- Specific adjustments needed**

Five heuristics received adversarial treatment per the roundtable brief.

---

### H-PLT04 -- Socially discreet

**Verdict: CAUTION -- Structural tension, partially mitigated**

Voice modality is categorically less discreet than tapping. Speaking aloud at a poker table is a visible, audible behavior that cannot be made to look like texting (HE-14). The mitigation path -- opt-in flag, OFF by default -- is necessary but not fully sufficient on its own.

**Specific tension:** The PTT button itself, when held, has a visual signature. If it is a floating mic-icon button with a listening animation (pulsing, color change, waveform), that animation is visible to anyone glancing at the phone from across the table. H-PLT04 explicitly flags pulsing indicators that draw eyes. A pulsing-mic animation while Chris holds PTT is a direct heuristic violation.

**Finding E-1 (High -- H-PLT04):** The PTT button active-listening state must use a visual treatment that is not animated and not conspicuously bright. No pulsing ring, no waveform animation, no color that changes more than one step from the base state. The mic-is-live signal must be unambiguous to Chris at close range while being unreadable as anything unusual from 2+ feet away. Acceptable: a static filled-circle or static color swap on the button itself. Unacceptable: ripple animation, waveform bar, aggressive red or green flash. Gate 4 must specify the exact visual treatment.

**Finding E-2 (Moderate -- H-PLT04):** Any audio output from confirmation -- a beep, a chime, or a spoken read-back of the parsed cards -- must default OFF and must not be re-enabled without an explicit Settings path. H-PLT04 (audio feedback is off by default) binds directly. A spoken read-back (ace of clubs, jack of diamonds, confirmed) is the most conspicuous possible VCE output and would immediately signal to the table that Chris is using a card-tracking app. Gate 4 must mark audio-feedback as OFF-only for the VCE spike.

The opt-in framing (flag OFF by default, owner activates per situation) adequately addresses the population-level concern. For an owner who activates it, the social cover is reduced but the choice is informed. Opt-in framing is sufficient mitigation for H-PLT04 at the feature level, conditional on E-1 and E-2 being satisfied.

---

### H-PLT06 -- Misclick absorption

**Verdict: CAUTION -- Specific risk on PTT accidental activation**

WS-181 accept criteria: zero false-commits. The proposed UX (chips render, then tap to commit) correctly prevents false-commits from the commit path -- a mis-tap of the commit button without confirming chips is structurally impossible. That part is sound.

The false-commit risk is on the PTT button itself, not on the commit button. If the hold threshold fires before Chris realizes he has contacted the PTT area, a recognition session begins without his awareness. Chris then speaks to the dealer or another player, and the parser produces a junk chip render.

**Finding E-3 (High -- H-PLT06 / H-N05):** The PTT button must require an affirmative hold of at least 300ms before the mic activates, providing sufficient accidental-activation protection on a surface where incidental contact is common. Gate 4 must specify the hold threshold explicitly. Additionally, the PTT button should not activate when the phone proximity sensor indicates the screen is against a surface (face-down or pocketed).

**Finding E-4 (Moderate -- H-PLT06):** The confirmation chip zone must have no auto-commit path under any condition -- not on high confidence, not on timer expiry, not on next-tap-anywhere semantics. WS-181 states this intent but Gate 4 surface spec must make it structurally explicit: commit requires a specific tap on a specific commit affordance.

---

### H-PLT07 -- State-aware primary action

**Verdict: CAUTION -- Visibility scope needs explicit decision**

The PTT button is only relevant at two board moments: (a) after a new street card count is known but before that street cards are entered, and (b) after river action ends and villain showdown is in progress with uncaptured cards. Outside those windows, the PTT button is irrelevant.

**Finding E-5 (High -- H-PLT07):** The PTT button must not render when: preflop (no board cards exist -- voice board entry has no target), the current street cards are already fully entered, the hand is complete and no showdown is pending, or the VCE flag is OFF. Rendering a mic icon persistently across all TableView states adds visual noise on a surface governed by strict density constraints. The PTT button conditional render logic must be driven by hand state, not by the feature flag alone -- the flag is a necessary but not sufficient render condition.

Gate 4 must enumerate the handState predicates that expose the PTT affordance. Proposed: (a) street is FLOP and flopCards.length is 0, (b) street is TURN and turnCard is null, (c) street is RIVER and riverCard is null, (d) phase is SHOWDOWN and at least one villain cards are un-entered.

---

### H-N05 -- Error prevention: mic permission denial path

**Verdict: CAUTION -- Recovery flow unspecified**

If the owner taps the PTT button and mic permission has been denied (explicitly denied by the OS, or never granted), the Web Speech API either throws an error immediately or silently does nothing. Neither behavior is acceptable without a recovery path.

**Finding E-6 (High -- H-N05):** Gate 4 must specify the full mic-permission denial UX:

1. Owner enables VCE flag in Settings.
2. First PTT hold triggers the OS permission request. Granted: normal flow. Denied: the following must happen.
3. Show a non-modal passive banner (Microphone access denied -- open device settings to enable) that does not block TableView action buttons and dismisses on next tap anywhere.
4. The VCE feature flag must NOT disable itself automatically on permission denial. The owner may want to grant permission via device settings and return without re-toggling. The flag stays ON; the PTT button renders in a grayed disabled state with a brief inline label indicating the permission state.
5. If the owner grants mic permission via device settings and returns to the app, the PTT button must restore to active state on next TableView mount -- no manual toggle-off/toggle-on required.

One additional H-N05 concern: if Web Speech fires a device-level error mid-session (language model not loaded, low memory on mid-range Android -- a real failure mode on Galaxy A22), the PTT button must degrade gracefully to a disabled state with a non-modal signal, not throw an unhandled exception to the surface.

---

### H-ML06 -- Touch target greater than or equal to 44px (scaled)

**Verdict: CAUTION -- PTT sizing and placement require explicit spec**

The PTT button is a hold target, not a tap target -- meaning it is held for 2-3 seconds while Chris speaks. The ergonomic requirement for a held button is higher than for a tapped button: it must be large enough to maintain reliable contact through the speaking duration without Chris needing to look at it to confirm he is still making contact. Standard 44x44 minimum is the floor; a PTT button should be at minimum 56x56 DOM-px to allow reliable hold without visual verification.

**Finding E-7 (Moderate -- H-ML06):** Gate 4 must specify PTT button at 56x56 DOM-px minimum. At the reference device scale factor (~0.9-1.0 at 1600x720), this renders at ~50-56 visual px -- adequate. On small viewports at scale ~0.5-0.6, a 56 DOM-px button renders at ~28-34 visual px -- below HIG minimum. Gate 4 must address: either (a) the PTT button is placed outside the ScaledContainer (fixed positioning at viewport level), or (b) the DOM size is set at a value that passes 44px visual minimum at the smallest expected scale. At scale 0.5, that requires 88 DOM-px. The surface spec must show the calculation.

**Finding E-8 (High -- H-ML06 / H-PLT02):** PTT button placement on TableView must be in the bottom-right quadrant (right-thumb reachable per H-PLT02 and Mid-Hand Chris constraint that thumb-reachable arc is bottom-right quadrant). If placed top-left, top-center, or center, Chris must re-grip to activate -- unacceptable one-handed. Bottom-center is reachable but risks conflicting with existing center-bottom TableView controls. Gate 4 layout spec must confirm bottom-right placement and show it does not overlap the action button zone (see SC-4).

---

## Overall verdict

**YELLOW -- proceed to Gate 4 with mandatory design resolutions**

VCE is not a DROP at this stage. The concept survives adversarial stress: between-hands board entry is viable within the time budget, per-villain PTT resolves the multi-villain grammar problem, and the confirmation-chip-before-commit architecture prevents false-commits structurally. The feature core mechanic is sound.

Four findings are CRITICAL or HIGH and must resolve as Gate 4 design decisions before implementation begins. They are not implementation details -- they are spec-level decisions with significant UX consequences:

1. **SC-3 + SC-4 (CRITICAL):** Blank utterance must be a strict no-op; PTT placement must not conflict with the action zone. One failure here corrupts a live hand.
2. **SC-7 (CRITICAL -- grammar scope gap):** Multi-villain showdown grammar must either be extended with villain-designator tokens (Option A, not recommended) or VCE must mandate per-villain PTT (Option B, recommended). The current grammar spec is insufficient for the showdown use case.
3. **SC-10 (CRITICAL -- kill criterion):** Correctable in 1 tap is not achievable with any standard picker flow. The kill criterion must be reworded and a specific correction UX (swipe-to-cycle-rank, re-speak-selected-chip, or long-press-popover) must be specified and committed to before Gate 4 closes.
4. **E-5 (High -- state-aware render):** PTT must be conditionally rendered by hand state, not globally visible. Preflop PTT is UX noise that violates H-PLT07 on a density-constrained surface.

The remaining HIGH/MODERATE findings (E-1, E-2, E-3, E-4, E-6, E-7, E-8, SC-1, SC-6, SC-8, SC-9) are Gate 4 spec requirements -- they do not block proceeding but must appear as explicit spec sections, not deferred to implementation.

The feature highest-probability DROP condition remains what it was at Gate 1: ambient noise causing parser accuracy below the kill threshold under real casino conditions. No design decision can resolve that -- only the live-table spike (Gate 5) can evaluate it. The Gate 4 design work described above is a necessary precondition for that evaluation to be valid: a spike built without SC-3 or SC-7 specified correctly will produce invalid kill-criteria data.

---

## Required follow-ups

- [ ] **Gate 3 is not required.** No research gap was surfaced that blocks Gate 4.
- [ ] **Persona additions:** None required. Between-Hands Chris confirmed sufficient for board-reveal moment. Gate 4 surface spec adds an annotating note about the 5-15s sub-window.
- [ ] **JTBD additions to docs/design/jtbd/domains/hand-entry.md:**
  - [ ] Add HE-NEW-VCE-01 (state: Active, ratified at Gate 2 by this roundtable). Reference audit entry-vce-2026-05-11 and this roundtable ID.
  - [ ] Add HE-NEW-VCE-03 (Abort a voice entry in progress without side effects) (state: Proposed, surfaced by Stage C SC-5).
  - [ ] Fold HE-NEW-VCE-02 into HE-12 as a voice-correction sub-flow annotation. Do not add a separate JTBD entry.
- [ ] **Gate 4 surface spec must include explicit resolutions for:**
  - [ ] SC-3: Parser minimum-confidence gate; blank or sub-0.5s utterance on PTT release = strict no-op (no chip render, no spinner, no state change).
  - [ ] SC-4: PTT button DOM position relative to action button zone -- annotated layout diagram required showing both states (action-on vs. board-entry-mode) without spatial conflict.
  - [ ] SC-6: Partial-board parse behavior -- parser produces N chips for N parseable cards; unrecognized card positions left as empty tap-fill slots rather than forcing full re-speak.
  - [ ] SC-7: Multi-villain showdown grammar decision -- select Option A (extended grammar with villain tokens plus explicit collision analysis) or Option B (per-villain PTT mandate). Recommend Option B. The chosen option must be documented in the spec grammar table.
  - [ ] SC-8: Explicit N-villain coverage limit in kill criteria. Recommend: two-villain showdown captured within 8s as the validated threshold; three or more villains fall back to tap entry.
  - [ ] SC-10: Reword kill criterion (c) in WS-181 from misheard cards correctable in 1 tap to misheard card correctable without re-entering the full board; correction requires 2 deliberate user actions maximum. Specify the exact correction UX interaction in the surface spec.
  - [ ] E-1: PTT active-listening visual treatment -- static indicator only, no animation, no more than one color-step change from base state. Specify the exact visual design in the spec.
  - [ ] E-2: Audio output defaults OFF; no confirmation chime or read-back in the spike; any audio output path must route through the existing audio-feedback Settings toggle.
  - [ ] E-3: PTT hold threshold set at 300ms minimum before mic activates. Proximity-sensor guard on activation specified.
  - [ ] E-4: No auto-commit path under any condition. Commit requires explicit tap on explicit commit affordance, structurally.
  - [ ] E-5: PTT conditional render logic -- enumerate the handState predicates that expose the affordance (proposed set above; Gate 4 formalizes).
  - [ ] E-6: Full mic-permission denial UX path specified: passive non-modal banner, flag stays ON in denied state, PTT grayed with inline state label, auto-restore on next mount after OS permission grant.
  - [ ] E-7 + E-8: PTT DOM size specified at value that passes 44px visual minimum at expected scale range; bottom-right quadrant placement confirmed; no overlap with action zone documented in layout diagram.
- [ ] **Kill criteria revision in WS-181:** Item (c) reworded per SC-10 above. Owner ratification needed since this alters a founder-ratified accept criterion.
- [ ] **DISC-03 governance update:** Update discoveries/LOG.md and discoveries/2026-04-21-initial-gap-list.md to reflect REJECTED to RE-OPENED-AS-WS-181. Carried from Gate 1; unblocked by this roundtable ratification.

---

## Change log

- 2026-05-11 -- Authored at Gate 2. Overall verdict YELLOW. Stages A-E complete. Stage C and Stage E adversarial treatment applied. Four CRITICAL/HIGH findings must resolve in Gate 4 spec before implementation.
