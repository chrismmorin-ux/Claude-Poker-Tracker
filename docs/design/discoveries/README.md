# Discoveries

Pipeline for capturing missing features surfaced during audits, engine runs, or user feedback. Discoveries become backlog items after prioritization.

---

## Why this exists

Audits of existing surfaces routinely surface "we don't have X but persona Y needs it." Without a pipeline, these observations evaporate. The discovery layer:

1. **Captures** the missing feature the moment it's identified, with full persona + JTBD context.
2. **Prioritizes** using a consistent scoring rubric — personas covered × JTBD criticality × tier fit.
3. **Routes** approved discoveries to `BACKLOG.md` with enough context to execute without re-discovering.

Without this, missing-feature findings get lost in audit files and never become work.

---

## Files

- [_template.md](./_template.md) — per-discovery template.
- [LOG.md](./LOG.md) — chronological index.
- `YYYY-MM-DD-<name>.md` — individual discovery files.

---

## Discovery lifecycle

```
1. SURFACED    ← Audit / engine run / user feedback identifies gap
       ↓
2. CAPTURED    ← File created in discoveries/ with full context
       ↓
3. SCORED      ← Priority score calculated
       ↓
4. REVIEWED    ← Owner signs off; tier placement confirmed
       ↓
5. QUEUED      ← Added to BACKLOG.md with discovery ID reference
       ↓
6. IMPLEMENTED ← Code shipped; discovery file marked CLOSED
       ↓
7. ARCHIVED    ← Kept for reference; feature entry exists in features/INVENTORY
```

A discovery may also be REJECTED at step 4 (doesn't fit roadmap, conflicts with another approach, etc.) — rejected discoveries stay in the file with the rejection reason.

## Priority scoring rubric

**Raw priority score** = `personas_covered × jtbd_criticality × tier_fit_factor`.

- `personas_covered`: 1–15 (number of personas meaningfully affected).
- `jtbd_criticality`: 1 (cosmetic), 2 (friction), 3 (blocker), 4 (unblocks core use).
- `tier_fit_factor`: 1.0 if feature fits cleanly into an existing tier; 0.7 if it crosses tiers; 0.5 if tier is ambiguous or creates a new tier.

**Effort tier:**
- S: < 1 week
- M: 1–4 weeks
- L: 1–3 months
- XL: 3+ months

**WSJF-style weighting** (optional): priority_score / effort_weeks → compare discoveries for backlog order.

## Routing to backlog

When a discovery is approved:
1. Add entry in `BACKLOG.md` with format:
   ```
   - [ ] [P#] [DISC-YYYY-MM-DD-name] Short title (tier: Pro, persona: Rounder; effort: M)
   ```
2. Update discovery file's state to QUEUED.
3. Add pointer in `features/INVENTORY.md` proposed section (if not already there).

## Capturing etiquette

- **One discovery per gap.** If an audit surfaces three distinct missing capabilities, three discovery files.
- **Persona-linked.** A discovery without at least one persona is suspect — fix or archive.
- **JTBD-linked.** Every discovery should name the JTBD it would enable.
- **Evidence or it's speculation.** Back every discovery claim with an entry in `evidence/LEDGER.md` OR label as `[SPECULATION]`.

---

## Change log

- 2026-04-21 — Created Session 1b.
