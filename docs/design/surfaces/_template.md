# Surface — [Name]

**ID:** `surface-id` (kebab-case, matches filename)
**Code paths:**
- `src/.../ComponentName.jsx`
- `src/.../useHook.js`
- ...

**Route / entry points:**
- `SCREEN.CONSTANT_NAME` (if routed via reducer)
- Opens from: [other surface] via [action]
- Closes to: [other surface] via [action]

**Last reviewed:** YYYY-MM-DD

---

## Purpose

One-paragraph statement of what this surface exists to do.

## JTBD served

Primary:
- [JTBD-ID] — how this surface contributes (entry / primary action / confirmation / side-effect)

Secondary:
- [JTBD-ID] — ...

## Personas served

- [persona ID] — primary context
- [persona ID] — secondary context

---

## Anatomy

Describe the visual / structural regions of the surface. Short bullets.

- **Header / top bar:** [description]
- **Body:** [description]
- **Footer / CTA:** [description]

Include a small ASCII diagram if the layout is non-trivial.

---

## State

- Where does the surface's state come from? (Props, context, reducer, hooks)
- What does it mutate? (Dispatch actions, IDB writes, context updates)
- What does it assume about its environment? (e.g., expects `editorContext` to be set)

## Props / context contract

- `propName: type` — what it is, who sets it.
- ...

## Key interactions

- **Interaction 1:** [what user does] → [what happens]
- ...

---

## Known behavior notes

- Anything surprising. Edge cases. Async timing considerations.

## Known issues

Link to audit findings with IDs. Do not describe fixes here — findings live in audit files.

- [AUDIT-YYYY-MM-DD-F#] — short title

---

## Test coverage

- Unit tests: `src/.../__tests__/*.test.jsx`
- Integration tests: (if any)
- Visual verification: (manual, noted below)

---

## Change log

- YYYY-MM-DD — Created.
- YYYY-MM-DD — Event.
