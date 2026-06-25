import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketplaceControls } from "@/components/marketplace/marketplace-controls";

describe("MarketplaceControls", () => {
  it("preserves a selected collection across form submits", () => {
    const { container } = render(
      <MarketplaceControls
        search={{
          collection: "cosmic-signature",
          kind: "sell",
          sort: "price-asc",
        }}
        totalOffers={2}
      />,
    );

    expect(
      container.querySelector('input[type="hidden"][name="collection"]'),
    ).toHaveValue("cosmic-signature");
    expect(screen.getByText("2 entries")).toBeInTheDocument();
  });

  it("omits the collection field when all collections are selected", () => {
    const { container } = render(
      <MarketplaceControls
        search={{ collection: "all", kind: "buy" }}
        totalOffers={0}
      />,
    );

    expect(
      container.querySelector('input[type="hidden"][name="collection"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /buy offers/i }),
    ).toBeInTheDocument();
  });
});
