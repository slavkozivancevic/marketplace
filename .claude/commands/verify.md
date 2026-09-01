---
description: Run the full verification loop (typecheck, lint, tests) and report
allowed-tools: Bash(npm run typecheck), Bash(npm run lint), Bash(npm test *), Bash(npm run typecheck:infra), Bash(npx tsc *), Bash(npx eslint *), Bash(npx vitest *), Read, Grep, Glob
---

Run this project's verification loop and report the result.

Run all three, in this order, even if an earlier one fails - I want the full
picture in one pass, not the first error:

```
npm run typecheck
npm run lint
npm test
```

If `sst.config.ts` was touched in the working tree, also run
`npm run typecheck:infra`.

Then report:

- One line per command: the command and PASS or FAIL.
- For each failure: the file, the line, and what is actually wrong - not the raw
  compiler dump. Quote at most the few lines that matter.
- If several failures share one root cause, say so once rather than listing
  twenty symptoms of it.

Do not fix anything. This command reports; I decide what gets fixed.
