---
description: Investigate a feature area, fanning out to parallel researchers when that actually pays
argument-hint: <what to investigate>
allowed-tools: Read, Grep, Glob, Bash(git log *), Bash(git show *), Bash(ls *), Agent
---

Investigate: **$ARGUMENTS**

## First decide whether to fan out. Do not skip this.

Fan-out to parallel `spec-researcher` agents is worth it only when **all three**
hold:

1. The question splits into areas that are genuinely **independent** - no branch
   needs another branch's answer to start.
2. Each area is **expensive** on its own, roughly a dozen files or more. Two
   greps do not need an agent.
3. I need the **findings**, not the path to them. If I will want to follow the
   reasoning or redirect it mid-way, do it in this context instead.

If any of the three fails, just investigate here and say in one line why fan-out
was not warranted. A researcher that reads four files is pure overhead: the spawn
and the summarisation cost more than the reading saved.

## If it does pay

State the split first - the areas and why they are independent - then launch one
`spec-researcher` per area **in a single message**, so they run in parallel.

Give each one a self-contained brief. They start cold: no conversation history,
no knowledge of the other branches, and they cannot ask a question. A vague
brief produces a confident, useless report.

Typical split for a feature in this repo, when it applies:

- data model and write path
- read path, caching and invalidation
- admin/seller UI and its conventions
- storefront, filters and facets
- infrastructure in `sst.config.ts`

Use the areas the question actually has, not this list.

## Then synthesise - this is the part that carries the value

Do not paste four reports one after another. That is a directory, not an answer.

Produce:

1. **The picture across areas** - what is true of the system as a whole, which no
   single researcher could see because each saw one slice.
2. **Contradictions.** Two researchers disagreeing is the highest-value signal in
   the whole run: it means one of them is wrong, or the codebase is genuinely
   inconsistent there. Resolve it by reading the code yourself, and say which it
   was.
3. **Seams.** Places where two areas meet are where the design decisions and the
   bugs live. Each researcher sees one side; you see both.
4. **Open questions** for the spec's OPEN QUESTIONS block.
5. **Cost note.** One line: how many researchers, and whether the split was worth
   it in hindsight. I am calibrating when to use this.

Cite `file:line` for anything the report asserts about code. If a researcher made
a claim you could not confirm, say that rather than passing it through - a
synthesis that launders unverified claims is worse than the raw reports.

Write nothing to disk.
