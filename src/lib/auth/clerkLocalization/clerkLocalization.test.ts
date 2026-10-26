import { describe, it, expect } from "vitest";
import { deDE, enUS, esES, srRS } from "@clerk/localizations";
import { CLERK_LOCALIZATIONS, withStrings } from "./index";
import { DE_STRINGS } from "./de";
import { ES_STRINGS } from "./es";
import { SR_STRINGS } from "./sr";

/**
 * Guards the Clerk copy. Every failure here is something that compiles and
 * then shows English, a raw `{{placeholder}}`, or the wrong form of address on
 * a sign-in or profile screen.
 */

function flatten(obj: unknown, prefix = "", out = new Map<string, string>()) {
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else if (value && typeof value === "object") flatten(value, path, out);
  }
  return out;
}

const EN = flatten(enUS);

/**
 * Server error codes (and the username placeholder): Clerk's English resource
 * leaves them out and shows the API's English message, but every other locale
 * maps them - and they are what people meet most (wrong password, unknown
 * account, address taken). Gathered from Clerk's own locales so a code Clerk
 * adds to one of them is required of all three.
 */
const BASES = [srRS, deDE, esES].map((l) => flatten(l));
const SERVER_ERRORS = [...new Set(BASES.flatMap((b) => [...b.keys()]))].filter(
  (k) => !EN.has(k) && /^(unstable__errors\.|formFieldInputPlaceholder__username$)/.test(k),
);
const KNOWN = new Set([...EN.keys(), ...BASES.flatMap((b) => [...b.keys()])]);

/** Sections the app never renders: no Clerk billing, API keys, waitlist or session tasks beyond choosing an org. */
const NOT_RENDERED =
  /^(billing|apiKeys|taskSetupMfa|taskResetPassword|waitlist|web3SolanaWalletButtons|impersonationFab|maintenanceMode|locale$|badge__(activePlan|canceledEndsAt|currentPlan|endsAt|expired|freeTrial|pastDueAt|pastDuePlan|renewsAt|startsAt|trialEndsAt|upcomingPlan)|formField(InputPlaceholder|Label)__apiKey|userProfile\.(billingPage|apiKeysPage|plansPage|navbar\.(billing|apiKeys))|organizationProfile\.(billingPage|apiKeysPage|plansPage|navbar\.(billing|apiKeys)))/;
const RENDERED = [...EN.keys()].filter((k) => !NOT_RENDERED.test(k));

const placeholders = (s: string) =>
  [...s.matchAll(/\{\{\s*([a-zA-Z_]+)/g)].map((m) => m[1]).sort().join(",");

const LOCALES = {
  sr: { merged: flatten(CLERK_LOCALIZATIONS.sr), strings: SR_STRINGS },
  de: { merged: flatten(CLERK_LOCALIZATIONS.de), strings: DE_STRINGS },
  es: { merged: flatten(CLERK_LOCALIZATIONS.es), strings: ES_STRINGS },
};

describe.each(Object.entries(LOCALES))("Clerk copy - %s", (_locale, { merged, strings }) => {
  it("only overrides paths Clerk actually has (a typo or a renamed key would silently do nothing)", () => {
    expect(Object.keys(strings).filter((k) => !KNOWN.has(k))).toEqual([]);
  });

  it("translates every string the app renders (a missing one falls back to English)", () => {
    expect(RENDERED.filter((k) => !merged.has(k))).toEqual([]);
  });

  it("maps every server error code the other locales map", () => {
    expect(SERVER_ERRORS.filter((k) => !merged.has(k))).toEqual([]);
  });

  it("keeps the placeholders of the English string (a lost one drops the value, a misspelled one prints raw)", () => {
    const off = RENDERED.filter((k) => merged.has(k) && placeholders(merged.get(k)!) !== placeholders(EN.get(k)!)).map(
      (k) => `${k}: ${merged.get(k)}`,
    );
    expect(off).toEqual([]);
  });
});

describe("Clerk copy - form of address", () => {
  it("Serbian addresses the user formally, in Latin script, like the rest of the site", () => {
    const sr = LOCALES.sr.merged;
    // Unicode-aware word edges: `\b` treats "š" as a non-letter, so "Obriši"
    // would split mid-word. Second person singular: ti/tebe/tvoj, "si", and
    // verbs ending -aš/-eš/-iš ("nemaš", "želiš") - but not "Vaš"/"naš".
    const informal =
      /(?<!\p{L})(ti|tebi|tebe|tvoj\p{L}*|si)(?!\p{L})|(?<!\p{L})(?!(vaš|naš)(?!\p{L}))\p{L}+(aš|eš|iš)(?!\p{L})/iu;
    const cyrillic = /[Ѐ-ӿ]/;
    const off = [...RENDERED, ...SERVER_ERRORS].filter((k) => sr.has(k) && (informal.test(sr.get(k)!) || cyrillic.test(sr.get(k)!))).map(
      (k) => `${k}: ${sr.get(k)}`,
    );
    expect(off).toEqual([]);
  });

  it("German uses Sie, never du", () => {
    const de = LOCALES.de.merged;
    const du = /\b(du|dein|deine|deinen|deinem|deiner|dich|dir)\b/i;
    expect(
      [...RENDERED, ...SERVER_ERRORS].filter((k) => de.has(k) && du.test(de.get(k)!)).map((k) => `${k}: ${de.get(k)}`),
    ).toEqual([]);
  });

  it("the account deletion phrase matches what the instruction asks the user to type", () => {
    for (const { merged } of Object.values(LOCALES)) {
      const confirm = merged.get("userProfile.deletePage.confirm")!;
      expect(merged.get("userProfile.deletePage.actionDescription")).toContain(confirm);
    }
  });
});

describe("withStrings", () => {
  it("sets nested paths without touching siblings or the base object", () => {
    const base = { signIn: { start: { title: "a", subtitle: "b" } } } as never;
    const result = withStrings(base, { "signIn.start.title": "x" }) as { signIn: { start: { title: string; subtitle: string } } };
    expect(result.signIn.start).toEqual({ title: "x", subtitle: "b" });
    expect((base as { signIn: { start: { title: string } } }).signIn.start.title).toBe("a");
  });
});
