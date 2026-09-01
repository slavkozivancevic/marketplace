---
description: Full pre-PR gate - verification, invariants, code review, PR draft
argument-hint: [review level: low|medium|high|max]
allowed-tools: Read, Grep, Glob, Bash(npm run typecheck), Bash(npm run lint), Bash(npm test *), Bash(npm run check:locales), Bash(npm run typecheck:infra), Bash(git diff *), Bash(git log *), Bash(git status *), Bash(git branch *), Agent, Skill
---

Run the full pre-PR gate on this branch, in this order. Do not skip a stage
because an earlier one was clean, and do not stop at the first failure - I want
the whole picture in one pass.

## Stage 1 - deterministic

```
npm run typecheck
npm run lint
npm test
npm run check:locales
```

Plus `npm run typecheck:infra` if `sst.config.ts` is in the diff.

These are free and certain. Anything they catch is not worth a model's attention.

## Stage 2 - repo invariants

Run the `invariant-check` agent over this branch. It reviews against the eight
non-obvious invariants from CLAUDE.md, in its own context, so it sees the diff
rather than the reasoning that produced it.

## Stage 3 - general code review

Run `/code-review` at level **$1** (default `high` if I did not say). This looks
for correctness bugs and reuse/simplification cleanups that are not specific to
this repo's invariants.

## Stage 4 - PR draft

Draft the PR title and body the way `/pr-desc` does: conventional-commit title
that will survive as the squash message on main, body leading with why.

## Report

One consolidated report, in this shape:

1. **Blocking** - anything that must be fixed before this ships. Deterministic
   failures always land here.
2. **Worth fixing** - real problems that are not blockers.
3. **Noted, not acting** - things a reviewer would raise and the reason they are
   fine. This section is what keeps me from re-litigating the same point.
4. **Could not verify** - anything that needs a running app, a deploy, or data
   you do not have. Say what would settle it.

Deduplicate across stages. If the invariant agent and the code review found the
same thing, report it once and say both found it - that is a signal about
severity, not two findings.

Fix nothing. This command produces a decision list; I decide what gets changed.
