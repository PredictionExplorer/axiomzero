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
  await page.getByRole("link", { name: /enter marketplace/i }).click();
  await expect(page).toHaveURL(/\/marketplace/);
  await expect(
    page.getByRole("heading", { name: /random walk nfts marketplace/i }),
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

test("token detail page shows order book and wallet prompt", async ({
  page,
}) => {
  await page.goto("/token/random-walk/1233");

  await expect(page.getByRole("heading", { name: /#001233/i })).toBeVisible();
  await expect(page.getByText(/current listing/i).first()).toBeVisible();
  await expect(page.getByText(/connect a wallet/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /order book/i }),
  ).toBeVisible();
});
