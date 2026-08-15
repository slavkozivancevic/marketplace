import { chromium, type FullConfig } from "@playwright/test";

/**
 * Next's dev server (the one `webServer` boots, both locally and in CI)
 * compiles every route - and every Route Handler it calls client-side, like
 * `/api/products` - on demand, the first time something requests it. The
 * product grid only renders after a client-side fetch, so a plain `fetch()`
 * against the SSR shell here wouldn't touch that route at all. Driving a
 * real page through the same list -> detail flow the specs exercise warms
 * every route the specs need (list page, `/api/products`, `/api/facets`,
 * the `[slug]` detail page) before any test's timed assertions start,
 * instead of letting whichever spec runs first race that compile.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/en/products`, { waitUntil: "networkidle" });

  const firstProduct = page.locator('a[href*="/en/products/"]').first();
  if (await firstProduct.count() > 0) {
    const href = await firstProduct.getAttribute("href");
    if (href) await page.goto(`${baseURL}${href}`, { waitUntil: "networkidle" });
  }

  await browser.close();
}