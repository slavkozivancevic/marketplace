#!/usr/bin/env node
/**
 * PreToolUse guard for Bash / PowerShell.
 *
 * Permission rules (settings.json allow/deny) are prefix-matched against the
 * start of the command string, so `cd x && git push` or `git -c k=v push`
 * slips past a `Bash(git push *)` deny rule. This hook inspects the WHOLE
 * command and denies deterministically - it is a guardrail, not an
 * instruction the model can reason its way around.
 *
 * The matching is deliberately position-aware rather than a plain substring
 * search. A first version used /\bgit\b.*\bcommit\b/ and immediately blocked a
 * legitimate script whose heredoc *documented* the rule in prose. A guardrail
 * that fires on the word is useless; it has to fire on the command.
 *
 * So: strip heredoc and here-string bodies (that text is data, not commands),
 * split what is left on shell operators, strip runner prefixes (sudo/npx/...),
 * and only then match each segment anchored at its start.
 *
 * Contract: read the hook payload from stdin, print a PreToolUse decision on
 * stdout, exit 0. No output means "no opinion" and the normal permission flow
 * continues.
 */
import { readFileSync } from "node:fs";

/** git options that consume the NEXT token as their value. */
const GIT_OPTS_WITH_VALUE = new Set([
  "-c", "-C", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env",
]);

/**
 * The git subcommand of a segment, or null if it is not a git invocation.
 * Regex cannot do this: `git -c user.name=x commit` puts an option value
 * between the options and the subcommand, so a `(-\S+\s+)*` prefix misses it.
 */
function gitSubcommand(segment) {
  const tokens = segment.split(/\s+/).filter(Boolean);
  if (tokens[0] !== "git") return null;
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (GIT_OPTS_WITH_VALUE.has(t)) { i++; continue; }
    if (t.startsWith("-")) continue;
    return t;
  }
  return null;
}

const FORBIDDEN_GIT = {
  commit: "Blocked by project guardrail: this repo never commits from an agent. Report what changed and let the user commit.",
  push: "Blocked by project guardrail: this repo never pushes from an agent.",
};

/** Patterns are anchored at the start of a command segment. */
const RULES = [
  [
    /^prisma\s+migrate\b/,
    "Blocked by project guardrail: do not run prisma migrate. Stop after the schema change and wait for the user to run it.",
  ],
  [
    /^prisma\s+db\s+push\b/,
    "Blocked by project guardrail: `prisma db push` rewrites the schema without a migration. The user runs schema changes.",
  ],
  [
    /^npm\s+run\s+db:(migrate|reset|push|create-migration)\b/,
    "Blocked by project guardrail: migrations are run by the user, not the agent.",
  ],
  [
    /^sst\s+(deploy|remove)\b/,
    "Blocked by project guardrail: never deploy or tear down infrastructure from this machine. Deploys go through CodePipeline.",
  ],
  [
    /^npm\s+run\s+(deploy|remove):/,
    "Blocked by project guardrail: never deploy from this machine. Deploys go through CodePipeline.",
  ],
];

/**
 * Commands that would dump a file's contents to the transcript. A `Read(./.env)`
 * deny rule only covers the Read tool, so without this the same secrets are one
 * `cat .env` away.
 */
const FILE_READERS = new Set([
  "cat", "type", "more", "less", "head", "tail", "bat", "nl", "strings", "xxd",
  "od", "base64", "get-content", "gc", "sed", "awk", "grep", "rg", "findstr",
  "select-string", "sls", "cp", "copy", "copy-item", "mv", "move", "move-item",
  "scp", "curl",
]);

/**
 * `.env`, `./.env`, `.env.local`, `d:/x/.env`, `$HOME/.env`, `~/.env`, `.env*`
 * - but not the regex `\.env`, and not `env.ts`.
 */
const ENV_PATH = /^(?:[A-Za-z]:)?[\\/]?(?:[\w.@+${}~-]+[\\/])*\.env(?:\.[\w*-]+)*\*?$/;

// Committed, secret-free templates. `.env.test.example` is in this repo and
// was being denied with a "live secrets" message.
const ENV_TEMPLATE = /\.(example|sample|template|dist)$/i;

function looksLikeEnvPath(token) {
  // `@file` is curl's "read this file" syntax and `<file` is a shell redirect.
  // Both name a real path, so strip them before matching.
  const t = token.replace(/^['"]+|['"]+$/g, "").replace(/^[@<]+/, "");
  // `\.env` is a regex escape in a grep pattern, not a path on disk.
  if (t.includes("\\.")) return false;
  if (ENV_TEMPLATE.test(t)) return false;
  return ENV_PATH.test(t.replace(/^\.[\\/]/, ""));
}

function readsEnvFile(segment) {
  const tokens = segment.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return false;
  if (!FILE_READERS.has(tokens[0].toLowerCase())) return false;
  return tokens.slice(1).some(looksLikeEnvPath);
}

/**
 * Exfiltration guard.
 *
 * The lethal trifecta for an agent is: access to private data, exposure to
 * untrusted content, and a way to talk to the outside world. This repo already
 * removes the third leg for git (`push` is denied), but an agent that reads a
 * poisoned dependency README or a hostile PR comment could still POST the
 * schema, a token or a source file to an arbitrary host.
 *
 * Local traffic is explicitly allowed - hitting localhost:3000 during
 * development is normal work, and a guard that blocks it would be turned off.
 */
const EGRESS = new Set(["curl", "wget", "http", "https", "httpie"]);

/** Tools whose entire purpose is moving a local file to a remote machine. */
const ALWAYS_UPLOAD = new Set(["scp", "sftp", "ftp", "nc", "netcat", "ncat"]);

/** Flags meaning "take this local data and send it". */
const UPLOAD_FLAG =
  /(^|\s)(-d|--data(?:-binary|-raw|-urlencode|-ascii)?|-F|--form|-T|--upload-file|--post-file|--post-data)\b/;

const LOCAL_HOST =
  /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)\b/;

function exfiltrates(segment) {
  const cmd = segment.split(/\s+/).filter(Boolean)[0]?.toLowerCase();
  if (!cmd) return false;
  if (LOCAL_HOST.test(segment)) return false;
  if (ALWAYS_UPLOAD.has(cmd)) return true;
  if (!EGRESS.has(cmd)) return false;
  return UPLOAD_FLAG.test(segment) || /(^|\s)-X\s+(POST|PUT|PATCH)\b/i.test(segment);
}

/** Runner prefixes that wrap the real command without changing what it is. */
const RUNNER = /^(?:sudo|npx|bunx|pnpm(?:\s+exec)?|yarn(?:\s+run)?|npm\s+exec|command|time|nohup|env(?:\s+\w+=\S+)*)\s+/i;

/**
 * `bash -c "git push"` puts the real command inside a quoted argument, where
 * neither the segment split nor the anchored patterns can see it. Unwrap one
 * level so the inner command is checked like any other.
 *
 * This is a completeness patch, not a completeness proof: a shell can always
 * express the same command another way ($(...), a variable, a script file,
 * `node -e`). The threat model here is an agent making a mistake, not an agent
 * trying to escape - so cover the realistic wrappers and rely on the layers
 * above (permission rules, the auto-mode classifier, human review) for the rest.
 */
const SHELL_WRAPPER = /^(?:bash|sh|zsh|dash|pwsh|powershell)\s+(?:-\w+\s+)*-c\s+(['"])([\s\S]*?)\1\s*$/i;

function unwrapShell(segment) {
  const m = SHELL_WRAPPER.exec(segment);
  return m ? m[2].trim() : null;
}

/** Heredoc bodies are data being written, not commands being run. */
function stripHeredocs(input) {
  return input.replace(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1[\s\S]*?^\s*\2\s*$/gm, " ");
}

/** Same idea for PowerShell here-strings: @' ... '@ and @" ... "@. */
function stripHereStrings(input) {
  return input.replace(/@(['"])\r?\n[\s\S]*?^\1@/gm, " ");
}

function normalize(raw) {
  let seg = raw.trim().replace(/^[({\s]+/, "");
  // `sudo npx prisma ...` needs more than one pass.
  for (let i = 0; i < 4 && RUNNER.test(seg); i++) seg = seg.replace(RUNNER, "");
  return seg;
}

function segments(input) {
  const out = [];
  for (const raw of stripHereStrings(stripHeredocs(input)).split(/\|\||&&|[;&|\n]/)) {
    const seg = normalize(raw);
    out.push(seg);
    // One level of `bash -c "..."`; the inner command gets the same treatment.
    const inner = unwrapShell(seg);
    if (inner) {
      for (const part of inner.split(/\|\||&&|[;&|\n]/)) out.push(normalize(part));
    }
  }
  return out;
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
}

try {
  const payload = JSON.parse(readFileSync(0, "utf8") || "{}");
  const command = payload?.tool_input?.command ?? "";
  outer: for (const seg of segments(command)) {
    const sub = gitSubcommand(seg);
    if (sub && FORBIDDEN_GIT[sub]) {
      deny(FORBIDDEN_GIT[sub]);
      break outer;
    }
    if (readsEnvFile(seg)) {
      deny("Blocked by project guardrail: .env holds live secrets and must not be dumped into the transcript. Ask the user for the specific value instead.");
      break outer;
    }
    if (exfiltrates(seg)) {
      deny(
        "Blocked by project guardrail: this command sends local data to a remote host. " +
          "Nothing from this repo leaves the machine through an agent. If you need to " +
          "call an external API, say what you need and let the user run it. " +
          "(Requests to localhost are allowed.)",
      );
      break outer;
    }
    for (const [pattern, reason] of RULES) {
      if (pattern.test(seg)) {
        deny(reason);
        break outer;
      }
    }
  }
} catch {
  // A guard that crashes must not block ordinary work. Fail open, silently.
}
process.exit(0);
