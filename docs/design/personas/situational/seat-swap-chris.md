# Situational Persona — Seat-Swap Chris

**Type:** Situational (derived from [Chris, Live Player](../core/chris-live-player.md))
**Evidence status:** Proto
**Last reviewed:** 2026-04-21
**Owner review:** Pending

---

## Snapshot

A player has just left a seat. A new player is sitting down, or already has. Chris needs to either **clear** the seat (nobody there yet), **swap** (replace the existing player with a new or known one), or **reassign** a known player who has moved seats. This situation is a specific slice of Between-Hands Chris, elevated to its own persona because the **two known UX defects cited by the owner on 2026-04-21 both live here**.

---

## Situation trigger

- A seated player leaves (stands up, racks chips) OR a new player sits in a previously empty seat OR a seated player moves to another seat at the table.
- Exits when: the seat state reflects reality (empty or correct player assigned).

## Context (deltas from between-hands)

- **Time pressure:** 10–60s typical. If the new player sits between hands the clock is tight. If the seat is empty for multiple hands the clock is loose.
- **Attention:** Shared with watching the new player stack, introducing self, quick reads on buy-in size and demeanor.
- **Cognitive load:** Moderate to high. First impressions on a new villain; simultaneously managing the clerical act of clearing / assigning in-app.

## Goals

- **Clear a seat fast** when a player leaves and nobody has sat yet. This is the most common action in this situation per owner observation. [EVID-2026-04-21-CLEAR-PLAYER]
- **Assign a known player (from the app's database)** to a seat when a regular returns after a break or moves.
- **Create a new player and assign to seat** when someone new the app has never seen sits down.
- **Retroactively link** prior hands to the new player if the app caught actions before the player was tagged (existing PEO-1 feature).

## Frustrations

- **Destructive action buried.** "Clear Player" currently sits at the bottom of the seat context menu, under several assign-type actions, despite being the most common post-departure action. [EVID-2026-04-21-CLEAR-PLAYER]
- **Landscape form viewport.** The Player Editor, fine on 1600x720, is cut off and doesn't scroll on smaller phone landscape viewports. [EVID-2026-04-21-LANDSCAPE-SCROLL]
- Misclicks on a context menu next to an occupied seat that clear the player and force an undo.
- Multi-tap paths for the most common action (clear) when single-tap would suffice.

## Non-goals

- Deep player profile editing — covered by Post-session Chris.
- Name recall assistance via fuzzy search — covered in the Picker flow which is well-formed for its purpose.

---

## Constraints

- **Time budget:** 1–2 taps for clear. 2–5 taps for assign-known. Variable for create-new.
- **Error tolerance:** Moderate. Clear is recoverable (player record still exists, just unassigned). Create is not — typos in names cost cleanup later.
- **Visibility tolerance:** Clear should be visibly the primary action when a seat is occupied. Assign-variants should be visibly the primary action when a seat is empty.
- **Recovery expectation:** Undo for retro-link (exists). Undo for accidental clear does *not* currently exist — worth considering as a finding.

---

## Related JTBD

- `player-management/clear-seat`
- `player-management/swap-player`
- `player-management/assign-known-player`
- `player-management/create-and-assign-new-player`

---

## What a surface must offer

1. **State-aware primary action.** If seat is occupied → Clear is primary. If empty → Assign is primary. Menu order reflects seat state.
2. **Visual weight on destructive actions.** Red color is good; position adjacent to common assign actions is bad if destructive is not the state-primary.
3. **Landscape scroll that actually scrolls** on phones of 640x360 up.
4. **Undo for any reversible destructive action**, with the same duration pattern as retro-link (≥5s, ideally 8s).

## What a surface must NOT do

- Order the menu by "creation flow steps" (assign → configure → clear) when user intent at the surface is rarely step-1.
- Require viewport >720px height for any form to be usable.

---

## Change log

- 2026-04-21 — Created Session 1 to anchor the two known issues being audited in Session 2.
