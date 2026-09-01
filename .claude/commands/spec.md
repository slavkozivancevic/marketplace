---
description: Draft a feature spec using the project template
argument-hint: <feature-slug> [one-line goal]
allowed-tools: Read, Grep, Glob, Write, Bash(ls *), Bash(git log *)
---

Draft a spec for: **$ARGUMENTS**

Write it to `$1.md` in whatever directory I name. If I did not name one, ask
where it should go before writing - specs for this project are kept outside the
repo. If that file already exists, read it first and propose edits instead of
overwriting it.

The template is:

```
GOAL         what this achieves, one sentence, in business language
CONTEXT      what an agent CANNOT learn by reading the repo, plus what it would
             only learn too late to change the architecture
SCOPE        in scope / explicitly out of scope
PHASING      phases that can each ship green on their own
CONSTRAINTS  architectural decisions already made, plus hard rules
ACCEPTANCE   numbered, measurable, checkable by someone who did not write it
OPEN QUES.   decisions NOT yet made - I answer these, you never guess them
VERIFY       exact commands, plus the tests that must exist
```

Before writing, investigate the repo for real. Read the models, the read path,
the caching, the existing conventions this feature will collide with. A spec
whose CONTEXT block is generic is worthless - the value is entirely in the
specific, verified facts.

Rules for the draft:

- Every claim about existing code must be something you actually read. Do not
  reconstruct function names or line numbers from memory - grep for them.
- Anything you are unsure about goes in OPEN QUESTIONS, not into CONSTRAINTS as
  a guess.
- CONSTRAINTS must include the standing hard rules from CLAUDE.md that apply to
  this feature (migrations, deploys, four locales, form conventions).
- English, matching the rest of the repo.

When you are done, tell me which OPEN QUESTIONS matter most, and stop. Do not
start implementing.
