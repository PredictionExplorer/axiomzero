import { expect, test } from "@playwright/test";

test("home page introduces Axiom Zero and links to collection pages", async ({
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
  await expect(
    page.getByRole("button", { name: /wallet unavailable/i }),
  ).toHaveCount(0);
  const randomWalkLink = page
    .getByRole("main")
    .getByRole("link", { name: /^random walk$/i });
  await expect(randomWalkLink).toBeVisible();
  await Promise.all([page.waitForURL(/\/random-walk/), randomWalkLink.click()]);
  await expect(
    page.getByRole("heading", { name: /^random walk$/i }),
  ).toBeVisible();
});

test("collection market views are URL-driven", async ({ page }) => {
  await page.goto("/random-walk");
  await expect(
    page.getByRole("heading", { name: /^random walk$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /connect wallet/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /wallet unavailable/i }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /top bids/i }).click();

  await expect(
    page.getByRole("heading", { name: /active bids sorted highest first/i }),
  ).toBeVisible();
  await expect(page).toHaveURL(/view=top-bids/);
  await expect(page).toHaveURL(/sort=price-desc/);
});

test("collection market preserves filters from the URL", async ({ page }) => {
  await page.goto("/cosmic-signature?query=1");
  await page.getByRole("link", { name: /top bids/i }).click();

  await expect(page).toHaveURL(/\/cosmic-signature/);
  await expect(page).toHaveURL(/query=1/);
  await expect(page).toHaveURL(/filter=buy/);
});

test("owned NFT workspace prompts for a connected wallet", async ({ page }) => {
  await page.goto("/my-nfts");

  await expect(
    page.getByRole("heading", { name: /your nfts, listings, and bid alerts/i }),
  ).toBeVisible();
  await expect(page.getByText(/connect a wallet to scan/i)).toBeVisible();
});

test("old marketplace URL is not a public route", async ({ page }) => {
  const response = await page.goto("/marketplace");

  expect(response?.status()).toBe(404);
});

test("token detail page shows order book and wallet prompt", async ({
  page,
}) => {
  await page.goto("/token/random-walk/1233");

  await expect(
    page.getByRole("heading", { name: /random walk #001233/i }),
  ).toBeVisible();
  await expect(page.getByText(/live market/i).first()).toBeVisible();
  await expect(page.getByText(/connect a wallet/i).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /order book/i }),
  ).toBeVisible();

  await page.getByRole("tab", { name: /history/i }).click();
  await expect(page).toHaveURL(/tab=history/);
  await expect(
    page.getByRole("heading", { name: /token history/i }),
  ).toBeVisible();
});

test("cosmic signature token detail page renders live metadata", async ({
  page,
}) => {
  await page.goto("/token/cosmic-signature/1");

  await expect(
    page.getByRole("heading", { name: /numba 1|cosmic signature #1/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /^light$/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /triple video/i })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: /single video/i })).toBeVisible();
  await page.getByRole("tab", { name: /collector notes/i }).click();
  await expect(page).toHaveURL(/tab=notes/);
  await expect(
    page.getByText(/cosmic signature metadata is normalized/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /copy detail link/i }),
  ).toBeVisible();
});
