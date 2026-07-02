import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FaqPage, { metadata } from "@/app/faq/page";
import { ALL_FAQ_ITEMS, FAQ_CATEGORIES } from "@/lib/faq";
import { GLOSSARY_TERMS } from "@/lib/glossary";

type JsonLdNode = {
  "@type": string;
  mainEntity?: Array<{ name: string }>;
  itemListElement?: Array<{ name: string; item: string }>;
};

function readJsonLd(container: HTMLElement): JsonLdNode[] {
  return [
    ...container.querySelectorAll('script[type="application/ld+json"]'),
  ].flatMap((script) => {
    const parsed = JSON.parse(script.innerHTML) as JsonLdNode | JsonLdNode[];
    return Array.isArray(parsed) ? parsed : [parsed];
  });
}

describe("FaqPage", () => {
  it("renders every category with its questions as accordions", () => {
    render(<FaqPage />);

    expect(
      screen.getByRole("heading", { name: /frequently asked questions/i }),
    ).toBeInTheDocument();

    for (const category of FAQ_CATEGORIES) {
      expect(
        screen.getByRole("heading", { name: category.title }),
      ).toBeInTheDocument();
    }

    for (const item of ALL_FAQ_ITEMS) {
      expect(screen.getByText(item.question)).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }
  });

  it("offers anchor navigation for each category and the glossary", () => {
    render(<FaqPage />);

    const nav = screen.getByRole("navigation", { name: /faq categories/i });

    for (const category of FAQ_CATEGORIES) {
      const link = screen.getByRole("link", { name: category.title });
      expect(nav).toContainElement(link);
      expect(link).toHaveAttribute("href", `#${category.id}`);
    }

    expect(screen.getByRole("link", { name: "Glossary" })).toHaveAttribute(
      "href",
      "#glossary",
    );
  });

  it("renders the marketplace glossary grid", () => {
    render(<FaqPage />);

    expect(
      screen.getByRole("heading", { name: /marketplace glossary/i }),
    ).toBeInTheDocument();

    for (const entry of GLOSSARY_TERMS) {
      expect(screen.getByText(entry.definition)).toBeInTheDocument();
    }
  });

  it("emits FAQPage and breadcrumb structured data for every question", () => {
    const { container } = render(<FaqPage />);
    const schemas = readJsonLd(container);

    const faqSchema = schemas.find((schema) => schema["@type"] === "FAQPage");
    expect(faqSchema?.mainEntity).toHaveLength(ALL_FAQ_ITEMS.length);
    expect(faqSchema?.mainEntity?.map((entity) => entity.name)).toEqual(
      ALL_FAQ_ITEMS.map((item) => item.question),
    );

    const breadcrumb = schemas.find(
      (schema) => schema["@type"] === "BreadcrumbList",
    );
    expect(breadcrumb?.itemListElement?.at(-1)).toMatchObject({
      name: "FAQ",
      item: "https://axiomzero.market/faq",
    });
  });

  it("links onward to the marketplace destinations", () => {
    render(<FaqPage />);

    expect(
      screen.getByRole("link", { name: /explore random walk/i }),
    ).toHaveAttribute("href", "/random-walk");
    expect(
      screen.getByRole("link", { name: /explore cosmic signature/i }),
    ).toHaveAttribute("href", "/cosmic-signature");
    expect(
      screen.getByRole("link", { name: /open my nfts/i }),
    ).toHaveAttribute("href", "/my-nfts");
  });

  it("exposes canonical FAQ metadata", () => {
    expect(metadata.title).toBe("FAQ");
    expect(metadata.alternates?.canonical).toBe(
      "https://axiomzero.market/faq",
    );
  });
});
