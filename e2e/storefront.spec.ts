import { test, expect } from "@playwright/test";

/**
 * Public storefront browse journey - no auth, no payment, so it stays fast and
 * stable. Runs against the dev database's seeded catalog.
 *
 * Selectors are role/URL based (resilient to copy changes). Product cards are
 * whole-card links to `/en/products/<slug>`; the "Products" nav/breadcrumb links
 * to `/en/products` (no trailing slug) so `"/en/products/"` matches only detail
 * links.
 */
const CATALOG = "/en/products";
const DETAIL_LINK = 'a[href*="/en/products/"]';

test.describe("storefront browse journey", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("catalog lists products that link to detail pages", async ({ page }) => {
    await page.goto(CATALOG);
    await expect(page.locator(DETAIL_LINK).first()).toBeVisible();
  });

  test("opening a product shows its detail page", async ({ page }) => {
    await page.goto(CATALOG);

    const firstProduct = page.locator(DETAIL_LINK).first();
    await expect(firstProduct).toBeVisible();
    await firstProduct.click();

    await expect(page).toHaveURL(/\/en\/products\/.+/);
    await expect(page.locator("h1").first()).toBeVisible();
  });
});
