---
id: narrative
dimension: output
label: "Narrative"
description: "Tells the story of the codebase, building understanding through a guided journey."
---

# Output Style: Narrative

## Phase 5 Injection — Briefing Format Modifier

Replace the standard briefing format with a narrative structure:

> **Output format: Narrative**
>
> Tell the story of what you found. Structure the briefing as a guided tour of the
> codebase, not a list of findings. The reader should finish with understanding,
> not just information.
>
> Structure:
> ```
> ## The Story of [focus area or repo name]
>
> ### Setting the Scene
> [2-3 paragraphs: What does this codebase do? Who uses it? What's its current state?
> Paint a picture the founder can relate to — "A user opens the app and..." or
> "When a payment comes in, the system..."]
>
> ### What's Working Well
> [Acknowledge strengths first. This builds credibility and helps the founder
> understand which parts they can trust. Be specific — "The authentication flow
> is solid because..." not just "Some things are fine."]
>
> ### Where the Story Gets Complicated
> [Introduce findings as plot points in the narrative. Don't list them — weave
> them into the story of what happens when the system is stressed, when edge
> cases appear, or when the codebase grows.
>
> Example: "But follow that payment through the webhook handler, and things
> get interesting. When the queue backs up — and it will, during a sale —
> events start silently dropping..."]
>
> ### The Critical Moments
> [Zoom in on the highest-priority findings. For each one, explain:
> - How it connects to the story so far
> - What triggers it (the scenario)
> - What happens when it triggers (the impact)
> - What the fix looks like (in plain terms)]
>
> ### What Happens Next
> [End with a clear recommendation, framed as the next chapter in the story.
> "The most impactful thing you can do right now is..." Not a task list —
> a narrative bridge to action.]
> ```
>
> Rules:
> - Use second person ("your API", "your users") — make it personal
> - Use concrete scenarios, not abstract categories
> - Every finding must connect to a user-visible consequence
> - Keep technical details in context — explain them as you go, don't assume knowledge
> - Total length: 500-800 words (briefing, not a book)
