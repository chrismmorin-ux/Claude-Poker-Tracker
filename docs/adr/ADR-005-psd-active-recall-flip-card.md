# ADR-005: PSD Active-Recall Pattern — Flip-Card

## Status
Accepted

## Date
2026-05-19

## Context

The Pre-Session Drill (PSD) feature delivers compressed drill cards to the user in a 5/15/30 min window before a live cash session. Gate 1 audit (2026-04-23) flagged the active-recall card UX as a YELLOW design dimension; Gate 2 Blind-Spot Roundtable (2026-05-19, `docs/design/audits/2026-05-19-blindspot-pre-session-drill.md`) confirmed YELLOW and routed the choice to this ADR.

Two competing patterns were enumerated in Gate 1 Q5 and re-evaluated by Gate 2 Stage E:

1. **Flip-card** — front shows the spot + prompt; user predicts mentally; tap reveals back with action + reasoning + falsifier + anchor links.
2. **Side-by-side** — spot panel on left, masked answer panel on right; tap (or time-out) reveals the answer beside the spot, both visible simultaneously.

The choice shapes the WS-199 Gate 4 surface spec (card layout + state-aware primary action labels) and the per-card cognitive budget realism on the 5-min variant (1 min/card floor per `presession-preparer.md` Constraints).

## Decision

**Use the flip-card pattern.** Front: spot + prompt + "Tap to flip". Back: action + 3 reasoning beats + falsification criterion + anchor links + tri-state self-grade (`Got it / Partial / Missed`) → `Next`.

State-aware primary action labels (per Gate 2 Stage E E-A3): `Flip` → `Got it / Partial / Missed` → `Next`. No generic "Continue."

## Alternatives Considered

### Side-by-side
- **Pros:**
  - Faster for users who already know the spot (no flip animation latency)
  - Higher card-throughput on the 30-min variant (10-15 cards becomes 15-20 cards plausible)
  - Lower friction; appears more like a study sheet than a quiz
- **Cons:**
  - Weak enforcement of *active* prediction — masked-answer panel is still visible-as-mask, drawing eye-attention before the user commits to a prediction
  - Recognition-Primed Decision (RPD) literature (Klein) treats predict-then-verify as the cognitive loop that builds pattern recognition; side-by-side dilutes the loop
  - Two-panel landscape layout is harder to reflow for the WS-200 mobile-portrait surface variant — flip-card scales down cleanly, side-by-side requires re-thinking
  - User cognitive habit from Anki / SRS tooling is flip-card; cross-tool transfer suffers under side-by-side

### Hybrid (toggle between modes)
- **Pros:** Owner choice per-session
- **Cons:** Doubles Gate 4 surface spec; defers the question instead of answering it; per `feedback_long_term_over_transition.md` owner pattern (single user, optimize for long-term coherence), the right call is to pick one and ship it. If side-by-side proves desirable later, the surface can be re-spec'd; YAGNI now.

## Consequences

### Positive
- Cleanly enforces the predict-then-verify cognitive loop RPD requires for pattern-recognition transfer
- Aligns with user's cross-tool habit (Anki, Quizlet, conventional flashcards)
- Honors Gate 2 Stage E E-A1 (flip-card body is dominant tap target, no competing controls inside card body)
- Honors Gate 2 Stage E E-A2 (no destructive skip: "next" mid-prediction → auto-mark not-attempted → retry-later queue)
- Honors Gate 2 Stage E E-A4 (tri-state self-grade with retract until card closes; no binary commit)
- Mobile-portrait reflow (WS-200) is structurally cleaner — single-column-stack preserves the flip pattern
- Per-card cognitive budget is honest on the 5-min variant: flip-card enforces the 1-min/card floor by gating reveal on user action

### Negative
- Slower than side-by-side for users who know the spot (extra flip tap)
- 30-min variant capped at ~10-15 cards per Stage C-A4 depth-cap discipline (which is by design — adding depth contaminates PSD into Study Block territory)
- Phone-sleep recovery during the flip (Stage C-A5) needs explicit handling: missed card → not-attempted → retry-later queue

### Mitigations
- Card-back content discipline (Stage C-A2): falsifier headline first, citation paragraph second, anchor links last. Skim-tolerant for 1-min/card budgets even when the back is dense.
- Flip-card body is the dominant tap target per E-A1; no competing buttons inside the card body.
- Phone-sleep handled by C-A5 retry-later queue invariant.
- State-aware primary actions (E-A3) make the predict → grade → advance flow obvious without tutorials.

## References

- Gate 1 audit: [`docs/design/audits/2026-04-23-entry-pre-session-drill.md`](../design/audits/2026-04-23-entry-pre-session-drill.md) Q5
- Gate 2 audit: [`docs/design/audits/2026-05-19-blindspot-pre-session-drill.md`](../design/audits/2026-05-19-blindspot-pre-session-drill.md) Stage E + YELLOW condition #2
- Persona: [`docs/design/personas/situational/presession-preparer.md`](../design/personas/situational/presession-preparer.md) Constraints + What a surface must offer
- Klein, G. (1998). *Sources of Power*: Recognition-Primed Decision (RPD) model
- Sprint: SPR-091. Ticket: WS-196.
- Implementation surface: WS-199 (Gate 4 `surfaces/postflop-drills.md` update). WS-200 (mobile-portrait variant). Mobile reflow preserves flip-card pattern.
