#!/usr/bin/env node
/**
 * PostToolUse hook for Write / Edit.
 *
 * The moment a `messages/*.json` file is touched, re-run the locale key check
 * and, if the four locales have drifted apart, tell the model about it right
 * away. A missing key renders the raw dotted path in the UI; typecheck cannot
 * see it, and nobody notices until a German-speaking user does.
 *
 * This is the other half of the hook contract from the PreToolUse guard.
 * That one DENIES. This one INFORMS: it returns `additionalContext`, which is
 * injected into the model's context so it can fix the drift in the same turn
 * instead of shipping it.
 *
 * Silent on success - a hook that congratulates you on every edit is noise.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

function inform(text) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: text,
      },
    }),
  );
}

try {
  const payload = JSON.parse(readFileSync(0, "utf8") || "{}");
  const path =
    payload?.tool_response?.filePath ?? payload?.tool_input?.file_path ?? "";

  // Cheap first check: bail out on the overwhelming majority of edits.
  if (!/messages[\\/][a-z]{2}\.json$/i.test(path)) process.exit(0);

  const cwd = payload?.cwd || process.cwd();
  try {
    execFileSync("node", ["scripts/check-locale-keys.mjs"], {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    });
    // Exit 0 from the script means all four locales agree. Say nothing.
  } catch (err) {
    const report = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
    inform(
      "Locale key drift detected after this edit. Every user-facing string " +
        "must exist in all four of messages/en|sr|de|es.json - a missing key " +
        "renders the raw dotted path in the UI. Fix the keys listed below " +
        "before moving on.\n\n" +
        report,
    );
  }
} catch {
  // A reporting hook that crashes must not disrupt the turn.
}
process.exit(0);
