/**
 * Sets the Stripe account branding (icon, logo, brand + accent color) via the
 * API, bypassing the Dashboard branding page entirely. Applies to the account
 * whose STRIPE_SECRET_KEY is in .env - run it with the sandbox key now, and
 * again with the live key after going live.
 *
 * Usage:  node --env-file=.env scripts/set-stripe-branding.mjs
 *
 * Uploads public/brand/stripe-icon.png and stripe-logo.png (regenerate them
 * with scripts/generate-brand-assets.mjs if the mark changes), then updates
 * settings[branding] on the account. primary_color = Dashboard "Brand color",
 * secondary_color = Dashboard "Accent color".
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Mirrors marketplace-notifications: brand = email header deep-space bg,
// accent = CTA button color (Stripe uses accent for checkout buttons).
const BRAND_COLOR = "#040511";
const ACCENT_COLOR = "#483e90";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY missing - run with: node --env-file=.env scripts/set-stripe-branding.mjs");
  process.exit(1);
}

const auth = { Authorization: `Bearer ${key}` };

async function uploadFile(relPath, purpose) {
  const buf = await readFile(path.join(root, relPath));
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", new Blob([buf], { type: "image/png" }), path.basename(relPath));
  const res = await fetch("https://files.stripe.com/v1/files", {
    method: "POST",
    headers: auth,
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`upload ${relPath} failed: ${JSON.stringify(json.error)}`);
  console.log(`uploaded ${relPath} as ${purpose}: ${json.id}`);
  return json.id;
}

// Dark logo variant: Stripe renders the logo on the brand-color (#040511)
// checkout header, so the white-wordmark lockup is the right one.
const iconId = await uploadFile("public/brand/stripe-icon.png", "business_icon");
const logoId = await uploadFile("public/brand/stripe-logo-dark.png", "business_logo");

const body = new URLSearchParams({
  "settings[branding][icon]": iconId,
  "settings[branding][logo]": logoId,
  "settings[branding][primary_color]": BRAND_COLOR,
  "settings[branding][secondary_color]": ACCENT_COLOR,
});
const res = await fetch("https://api.stripe.com/v1/account", {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
  body,
});
const account = await res.json();
if (!res.ok) throw new Error(`account update failed: ${JSON.stringify(account.error)}`);

console.log(`\nBranding updated for account ${account.id} (${key.startsWith("sk_test") ? "TEST/sandbox" : "LIVE"} mode):`);
console.log(JSON.stringify(account.settings.branding, null, 2));
