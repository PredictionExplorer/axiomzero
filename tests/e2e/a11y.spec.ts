import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const path of [
  "/",
  "/random-walk",
  "/cosmic-signature",
  "/my-nfts",
  "/token/random-walk/1271",
  "/token/cosmic-signature/1",
]) {
  test(`has no serious accessibility issues on ${path}`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}
