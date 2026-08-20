# Every strategy surface must eventually run at the table

**Founder ruling, 2026-08-20.** Resolves ~6 open queue items that carried "live surface vs
analysis-only" as a per-item decision flag.

## The rule

**Analysis-only is a temporary state, and it always carries a ticket to make it live.**

There is no permanent study tier. An instrument that produces something the founder could act on
is on a path to the table, and if it is not on that path today it names the item that puts it
there. A surface with no such item is either finished (it runs live) or it is a gap.

The founder rejected the two-tier option explicitly. Latency is not a property a surface gets to
declare and then stop worrying about.

## What this does and does not mean

- **It does not mean every instrument ships live tomorrow.** Sequencing is fine. What is
  forbidden is a surface quietly settling into permanent off-table status because that was
  easier.
- **It does not mean shallower.** Latency is engineered around, never a reason to ship a
  shallower answer — that is standing doctrine here, and DEC-069 is the worked example: the
  logical refinement clock inverted the latency trade so the same reproducible answer arrives on
  a slow device, rather than a worse answer arriving fast.
- **It does mean the deep instruments carry the obligation too.** Hole Map, corpus atlas,
  projection tools — each names how it reaches the table, even if the answer is "a compiled
  artifact the live path reads" rather than "it runs in 200ms."

## The mechanism that usually satisfies it

Precompute, then read. A study instrument that is too slow to run live compiles to something the
live path can consume — a Guide, a chart, a lookup, a Conduct Card. That is a real answer to
"how does it reach the table" and it is usually the right one. What it is not is an excuse to
skip the question.

## Why the founder ruled this way

The money is earned at the table, hand by hand, in the specific hand that happened. An instrument
that never reaches it has not produced income, however good its numbers are. The failure mode
this prevents is a system that becomes an excellent study tool the founder does not use while
playing — which is the shape the repo was drifting toward, with study and backtest surfaces
outnumbering live ones.

Related: `.claude/rules/cold-read-regime.md` (the time budget at the table is the binding
constraint), DEC-049 (priority order is engine → EV → education), DEC-069.
