---
description: Draft the PR title and body for the current branch
allowed-tools: Bash(git branch *), Bash(git log *), Bash(git diff *), Bash(git status *), Read, Grep, Glob
---

## Branch state

- Current branch: !`git branch --show-current`
- Commits ahead of main: !`git log --oneline main..HEAD`
- Files changed: !`git diff --stat main...HEAD`

## Task

Draft the pull request title and body for this branch.

In this repo, branch commits are all `wip` - the **PR title carries the real
message**, because merges are squash merges and the title becomes the commit
message on main. So the title has to stand on its own in `git log` a year from
now.

Title:

- Conventional-commit form: `type(scope): summary`
- Imperative mood, lowercase after the colon, no trailing period
- One line, under about 70 characters
- Describe the change, not the activity ("fix: ..." not "fixes for ...")

Body:

- Lead with **why**, in two or three sentences. The diff already shows what.
- Then the notable changes as a short list, grouped by area, not file by file.
- Call out anything a reviewer would otherwise miss: a schema change, a new
  environment variable, a migration the user must run, a behaviour change that
  is not obvious from the diff.
- If the branch touches money, caching, auth or the cart, say explicitly which
  invariant from CLAUDE.md it interacts with and why it still holds.
- No em dashes.

Read the actual diff before writing - the commit messages say `wip` and tell you
nothing. If the branch contains unrelated changes that should not ship together,
say so instead of writing a title that papers over it.

Output the title and body as plain text I can paste. Do not run `gh pr create`.
