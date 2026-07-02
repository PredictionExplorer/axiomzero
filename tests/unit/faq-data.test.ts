import { describe, expect, it } from "vitest";

import { ALL_FAQ_ITEMS, FAQ_CATEGORIES, FEATURED_FAQ_ITEMS } from "@/lib/faq";

describe("faq data", () => {
  it("provides substantive categorized coverage", () => {
    expect(FAQ_CATEGORIES.length).toBeGreaterThanOrEqual(4);

    for (const category of FAQ_CATEGORIES) {
      expect(category.id).toMatch(/^[a-z0-9-]+$/);
      expect(category.title.length).toBeGreaterThan(3);
      expect(category.description.length).toBeGreaterThan(10);
      expect(category.items.length).toBeGreaterThanOrEqual(3);
    }

    expect(ALL_FAQ_ITEMS.length).toBeGreaterThanOrEqual(15);
  });

  it("keeps every question unique and well formed", () => {
    const questions = ALL_FAQ_ITEMS.map((item) => item.question);

    expect(new Set(questions).size).toBe(questions.length);

    for (const item of ALL_FAQ_ITEMS) {
      expect(item.question.endsWith("?")).toBe(true);
      expect(item.answer.length).toBeGreaterThan(40);
    }
  });

  it("keeps category ids unique for anchor navigation", () => {
    const ids = FAQ_CATEGORIES.map((category) => category.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("features a small curated subset for the home teaser", () => {
    expect(FEATURED_FAQ_ITEMS.length).toBeGreaterThanOrEqual(3);
    expect(FEATURED_FAQ_ITEMS.length).toBeLessThanOrEqual(6);

    for (const item of FEATURED_FAQ_ITEMS) {
      expect(ALL_FAQ_ITEMS).toContain(item);
    }
  });

  it("covers the core marketplace promises", () => {
    const allText = ALL_FAQ_ITEMS.map(
      (item) => `${item.question} ${item.answer}`,
    )
      .join(" ")
      .toLowerCase();

    expect(allText).toContain("0%");
    expect(allText).toContain("arbitrum");
    expect(allText).toContain("gas");
    expect(allText).toContain("wallet");
    expect(allText).toContain("random walk");
    expect(allText).toContain("cosmic signature");
  });
});
