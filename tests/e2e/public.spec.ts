import { expect, test } from "@playwright/test";

test("home page introduces Axiom Zero and links to the marketplace", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /first principles/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/Founders get no special privilege/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /connect wallet/i }),
  ).toBeVisible();
  const marketplaceLink = page
    .locator('a[href="/marketplace"]')
    .filter({ hasText: /enter marketplace/i });
  await expect(marketplaceLink).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/marketplace/),
    marketplaceLink.click(),
  ]);
  await expect(
    page.getByRole("heading", { name: /generative nft marketplace/i }),
  ).toBeVisible();
});

test("marketplace filters are URL-driven", async ({ page }) => {
  await page.goto("/marketplace");
  await page.getByRole("button", { name: /buy offers/i }).click();

  await expect(page).toHaveURL(/filter=buy/);
  await expect(
    page
      .locator("article")
      .filter({ hasText: /buy offer/i })
      .first(),
  ).toBeVisible();
  await expect(
    page.locator("article").filter({ hasText: /sell listing/i }),
  ).toHaveCount(0);
});

test("marketplace preserves collection filters from the URL", async ({ page }) => {
  await page.goto("/marketplace?collection=cosmic-signature");
  await page.getByRole("button", { name: /buy offers/i }).click();

  await expect(page).toHaveURL(/collection=cosmic-signature/);
  await expect(page).toHaveURL(/filter=buy/);
});

test("token detail page shows order book and wallet prompt", async ({
  page,
}) => {
  await page.goto("/token/random-walk/1233");

  await expect(page.getByRole("heading", { name: /#001233/i })).toBeVisible();
  await expect(page.getByText(/current listing/i).first()).toBeVisible();
  await expect(page.getByText(/connect a wallet/i).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /order book/i }),
  ).toBeVisible();
});

test("cosmic signature token detail page renders live metadata", async ({
  page,
}) => {
  await page.goto("/token/cosmic-signature/1");

  await expect(page.getByRole("heading", { name: /#000001/i })).toBeVisible();
  await expect(
    page.getByText(/cosmic signature metadata and market data/i),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /order book/i }),
  ).toBeVisible();
});
