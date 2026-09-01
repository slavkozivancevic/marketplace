#!/usr/bin/env node
/**
 * Verify that every messages/<locale>.json holds exactly the same key set.
 *
 * A missing key renders the raw dotted path in the UI, which typecheck cannot
 * see and which nobody notices until a German-speaking user does. This is a
 * deterministic set comparison, so it is a script rather than an agent task:
 * same answer every time, runs in milliseconds, costs nothing, and can gate CI.
 */
import { readFileSync } from "node:fs";

const LOCALES = ["en", "sr", "de", "es"];
const REFERENCE = "en";

/** Every leaf path in the object, dot-joined. */
function leafKeys(node, prefix = "") {
  return Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? leafKeys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

const keysByLocale = new Map(
  LOCALES.map((locale) => [
    locale,
    new Set(leafKeys(JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")))),
  ]),
);

const reference = keysByLocale.get(REFERENCE);
let problems = 0;

for (const locale of LOCALES) {
  if (locale === REFERENCE) continue;
  const keys = keysByLocale.get(locale);
  const missing = [...reference].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !reference.has(k));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`  ${locale}: ok (${keys.size} keys)`);
    continue;
  }
  problems += missing.length + extra.length;
  console.log(`  ${locale}: ${missing.length} missing, ${extra.length} extra`);
  for (const k of missing.slice(0, 20)) console.log(`    missing  ${k}`);
  for (const k of extra.slice(0, 20)) console.log(`    extra    ${k}`);
  const hidden = missing.length + extra.length - Math.min(missing.length, 20) - Math.min(extra.length, 20);
  if (hidden > 0) console.log(`    ... and ${hidden} more`);
}

if (problems > 0) {
  console.error(`\nLocale key drift: ${problems} discrepancies against ${REFERENCE}.`);
  process.exit(1);
}
console.log(`\nAll ${LOCALES.length} locales match ${REFERENCE} (${reference.size} keys).`);
