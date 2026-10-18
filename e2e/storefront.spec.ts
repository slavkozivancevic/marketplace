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

  /**
   * Regression: leaving the catalog and coming back used to reset it.
   *
   * Two defects met here. "Back to Products" pointed at the bare catalog, so a
   * buyer's search was silently discarded; and the search bar wrote the
   * PREVIOUS page's query into the fresh catalog URL on mount (React renders
   * the incoming page while the search params still hold the outgoing URL),
   * which flashed the old filtered result and then undid itself. Both are
   * invisible to typecheck and lint, so they are pinned here.
   */
  test("returning from a product restores the catalog the buyer left", async ({
    page,
  }) => {
    const searchBox = page.getByPlaceholder("Search all products");

    await page.goto(CATALOG);
    // The grid is client-fetched, so a card on screen means React has hydrated
    // and the search box is wired up. Typing before that only sets a DOM value
    // that hydration then throws away.
    await expect(page.locator(DETAIL_LINK).first()).toBeVisible();
    await searchBox.fill("1000");
    await expect(page).toHaveURL(/search=1000/);

    await page.locator(DETAIL_LINK).first().click();
    await expect(page).toHaveURL(/\/en\/products\/.+/);

    await page.getByRole("link", { name: "Back to Products" }).first().click();

    // Same list, same search - not a reset catalog.
    await expect(page).toHaveURL(/\/en\/products\?.*search=1000/);
    await expect(searchBox).toHaveValue("1000");

    // And it STAYS there: the stale write used to land a beat after the
    // navigation, so a single assertion right after the click would have
    // passed while the bug was fully present.
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/en\/products\?.*search=1000/);
    await expect(searchBox).toHaveValue("1000");
  });

  test("the catalog link in the header opens an unfiltered catalog", async ({
    page,
  }) => {
    const searchBox = page.getByPlaceholder("Search all products");

    await page.goto(`${CATALOG}?search=1000`);
    await expect(page.locator(DETAIL_LINK).first()).toBeVisible();
    await expect(searchBox).toHaveValue("1000");

    await page.locator(DETAIL_LINK).first().click();
    await expect(page).toHaveURL(/\/en\/products\/.+/);

    // The remembered list is for the back link only. A fresh entry point must
    // not resurrect it.
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Products", exact: true })
      .first()
      .click();

    await expect(page).toHaveURL(/\/en\/products$/);
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/en\/products$/);
    await expect(searchBox).toHaveValue("");
  });
});
