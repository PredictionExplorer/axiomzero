import { expect, test } from "@playwright/test";

test("home page introduces Axiom Zero and links to the marketplace", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /first principles/i })).toBeVisible();
  await expect(page.getByText(/Founders get no special privilege/i)).toBeVisible();
  await page.getByRole("link", { name: /enter marketplace/i }).click();
  await expect(page).toHaveURL(/\/marketplace/);
  await expect(page.getByRole("heading", { name: /0% fees/i })).toBeVisible();
});

test("marketplace filters are URL-driven", async ({ page }) => {
  await page.goto("/marketplace");
  await page.getByLabel(/collection/i).selectOption("cosmic-signature");
  await page.getByRole("button", { name: /apply/i }).click();

  await expect(page).toHaveURL(/collection=cosmic-signature/);
  await expect(page.getByText("Cosmic Signature #000011")).toBeVisible();
  await expect(page.getByText("Random Walk #001271")).not.toBeVisible();
});

test("token detail page shows order book and wallet prompt", async ({ page }) => {
  await page.goto("/token/cosmic-signature/11");

  await expect(page.getByRole("heading", { name: /cosmic signature #000011/i })).toBeVisible();
  await expect(page.getByText(/current listing/i)).toBeVisible();
  await expect(page.getByText(/connect a wallet/i)).toBeVisible();
});
