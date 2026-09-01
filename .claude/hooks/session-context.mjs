#!/usr/bin/env node
/**
 * SessionStart hook.
 *
 * Injects the repo's current state into the model's context at the start of a
 * session, so the first answer is grounded instead of guessed. Without this the
 * agent either assumes it is on main with a clean tree, or burns a turn running
 * three git commands to find out.
 *
 * Deliberately small. This text is paid for in every request of the session,
 * so it earns its place only by being short and always relevant - the same
 * always-on budget rule that governs CLAUDE.md.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (args, fallback = "") => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: "pipe" }).trim();
  } catch {
    return fallback;
  }
};

try {
  // Read and discard stdin so the hook never blocks on an unread pipe.
  try { readFileSync(0, "utf8"); } catch { /* no stdin is fine */ }

  const branch = git(["branch", "--show-current"], "(detached)");
  const dirty = git(["status", "--porcelain"]).split("\n").filter(Boolean);
  const ahead = git(["log", "--oneline", "main..HEAD"]).split("\n").filter(Boolean);

  const lines = [`Branch: ${branch}`];
  if (ahead.length) lines.push(`${ahead.length} commit(s) ahead of main.`);
  if (dirty.length) {
    const shown = dirty.slice(0, 8).map((l) => `  ${l}`);
    lines.push(`${dirty.length} uncommitted file(s):`, ...shown);
    if (dirty.length > 8) lines.push(`  ... and ${dirty.length - 8} more`);
  } else {
    lines.push("Working tree clean.");
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: lines.join("\n"),
      },
    }),
  );
} catch {
  // Never let session startup fail because of a convenience hook.
}
process.exit(0);
