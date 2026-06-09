# Context Examples

How to tell Claude what's going on in your business. Just describe it in plain language — Claude will add it to `system/context.md` and adjust priorities accordingly.

## Examples

### "A customer reported a bug"
> "John says the payment page shows the wrong amount"

Claude adds:
- **Type:** customer_issue
- **Urgency:** high
- **Related programs:** engineering, ux
- **Effect:** Related work items get +15 priority boost

### "I have a demo on Thursday"
> "Demo for a potential investor this Thursday"

Claude adds:
- **Type:** deadline
- **Urgency:** high
- **Deadline:** Thursday's date
- **Related programs:** ux, launch
- **Effect:** UX polish and stability items boosted

### "I want more users"
> "Goal: grow from 10 to 100 users this quarter"

Claude adds:
- **Type:** goal
- **Related programs:** ux, marketing
- **Effect:** Gentle +3 boost to user-facing improvements

### "Something feels risky"
> "Worried about our Stripe integration — we've never tested with real money"

Claude adds:
- **Type:** risk
- **Urgency:** high
- **Related programs:** security, engineering
- **Effect:** Payment-related items boosted +10

### "There's an opportunity"
> "Got an email from a blogger who wants to review us next month"

Claude adds:
- **Type:** opportunity
- **Deadline:** next month
- **Related programs:** ux, marketing, launch
- **Effect:** Polish items boosted +5

## How Context Affects Priorities

| Context Type | Priority Boost | When It Triggers |
|-------------|---------------|------------------|
| Customer issue | +15 | Items touching related files or programs |
| Deadline | +10 (scales with proximity) | Items related to the deadline's programs |
| Risk | +10 | Items in the risk's related programs |
| Opportunity | +5 | Items that help capitalize on the opportunity |
| Goal | +3 | Gentle nudge, not urgent |

Boosts take the single highest match — they don't stack.
