# Journey — [Name]

**ID:** `journey-id` (kebab-case, matches filename)
**Last reviewed:** YYYY-MM-DD

---

## Purpose

A journey documents the user's end-to-end path to complete one or more JTBD, often across multiple surfaces. Unlike a surface artifact (static, per-location), a journey is dynamic and time-ordered.

---

## Primary JTBD

- [JTBD-ID] — title

## Secondary JTBD along the journey

- [JTBD-ID] — how it interleaves

## Personas

- [persona ID] — primary
- [persona ID] — secondary

---

## Entry triggers

What starts the journey? (User intent, external event, prior surface action.)

## Exit conditions

- Success: [criteria]
- Abort: [criteria]
- Partial: [criteria]

---

## Steps

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| 1 | [surface-id] | [what user does] | [what changes] | [target seconds] |
| 2 | [surface-id] | ... | ... | ... |
| ... | | | | |

Total target time: X seconds for primary path.

---

## Variations

- **Variation A:** [what's different, when it applies]
- **Variation B:** ...

## Failure / abort paths

- **Abort at step N:** [what happens, what state]
- ...

---

## Observations

- Non-obvious behavior.
- Cross-surface dependencies.
- State that must persist across steps.

## Linked audits

- [AUDIT-YYYY-MM-DD]

---

## Change log

- YYYY-MM-DD — Created.
