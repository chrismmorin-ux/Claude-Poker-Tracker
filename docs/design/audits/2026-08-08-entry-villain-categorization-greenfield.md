# Gate 1 Entry — Villain Categorization Surface, Greenfield (WS-436 Track C)

Date: 2026-08-08 · Author: AI session ses-20260808-0250-3e298c5d · Trigger: founder ruling during WS-436

## Proposed change

WS-436 removes the six style labels (Fish/LAG/LP/Nit/Reg/TAG) as game-tree engine inputs —
the engine now runs on continuous shrunk-posterior statistics and game state. The founder
ruled the human-facing categorization is **greenfielded from a UX standpoint** in the same
ticket: *"what helps hero properly categorize this behavior."* The display today inherits
the six labels (badges in SeatGrid, SeatDetailPanel, VillainBrief, CompactSeatStrip,
TendencyStats, StatsView; VillainModelCard headline prose via STYLE_DESCRIPTIONS; extension
HUD street cards; STYLE_COLORS design tokens). The binding perspective, founder-stated: the
app is a source of income earned by playing individual hands through to completion — the
categorization exists to let hero recognize how a specific villain plays fast enough to act
on it mid-hand, at a live 9-handed table, on the 1600×720 device.

Constraint inherited from the engine work: after WS-436, six discrete engine types no longer
exist — the engine's truth is a continuum (k=2, silhouette 0.343, one dominant
looseness/stickiness axis; docs/research/player-archetypes-empirical-2026-07-26.md). A
display that implies the engine thinks in six types misrepresents the system it fronts.

## Scope classification

**System-coherence + surface redesign hybrid.** The villain-categorization *concept* is
rendered across ≥8 main-app components, the extension HUD, and the design-token layer —
this is a concept rendered consistently but on a foundation the data refutes, being
re-founded. Closest precedent: SHC (2026-04-27) system-coherence entry. Not a single
surface addition; not a mere surface-bound fix.

## Personas

- Core: **chris-live-player** (primary; sole user).
- Situational: **cold-read-chris** (first reads on an unknown table), **mid-hand-chris**
  (in-hand, seconds of attention), **seat-swap-chris** (re-orienting after moving),
  **between-hands-chris** (30-90s windows), **presession-preparer** (SE-01 watchlist).
- Explicit check: the cast covers the user. What it may NOT cover is the *cognitive mode* —
  the existing personas were authored against a six-type vocabulary; whether a continuous
  representation fits the recognition budget of mid-hand-chris is exactly the open question.

## JTBD

- MH-03 (bluff-catch frequency on current villain), MH-04 (sizing tied to calling range),
  DS-48 (villain range composition as decision driver), DS-51 (range shape before
  deciding), SR-24 (**filter by street/position/opponent-style** — a direct consumer of the
  label vocabulary), SE-01 (villain watchlist).
- **Gap check:** no atlas entry states the founder's named job directly — *"categorize how
  this villain behaves, at a glance, fast enough to act on it"* (recognition as its own job,
  upstream of MH-03/04's numeric reads). The six labels were serving this job implicitly.

## Gap analysis: **YELLOW**

1. JTBD gap: the at-a-glance behavioral-categorization job is unmodeled (1 JTBD, possibly a
   decomposition of the MH domain rather than a new domain).
2. Vocabulary dependency: SR-24 and the anchor-library scope predicates consume the label
   vocabulary; a greenfield categorization must state what happens to those consumers.
3. New-surface creation trigger also fires independently (replacement representation is a
   new artifact type candidate: categorization grammar shared by 8+ components).

**Gate 2 (Blind-Spot Roundtable) is triggered** — by the YELLOW, by new-surface creation,
and by the founder flagging the work. Gate 4 will require a surface artifact (likely a
design-language/categorization-grammar doc + per-surface deltas, per the SHC precedent).
