import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketplaceControls } from "@/components/marketplace/marketplace-controls";

describe("MarketplaceControls", () => {
  it("shows view navigation and preserves selected query state", () => {
    const { container } = render(
      <MarketplaceControls
        search={{
          collection: "cosmic-signature",
          kind: "sell",
          view: "listings",
          sort: "price-asc",
        }}
        totalOffers={2}
      />,
    );

    expect(
      screen.getByRole("link", { name: /^listings/i }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("collection=cosmic-signature"),
    );
    expect(container.querySelector('input[name="view"]')).toHaveValue("listings");
    expect(screen.getByLabelText(/filter by collection/i)).toHaveValue(
      "cosmic-signature",
    );
    expect(screen.getByText("2 entries")).toBeInTheDocument();
  });

  it("links top bids to the highest-bid offer view", () => {
    render(
      <MarketplaceControls
        search={{ collection: "all", kind: "buy", view: "top-bids" }}
        totalOffers={0}
      />,
    );

    expect(
      screen.getByRole("link", { name: /^top bids/i }),
    ).toHaveAttribute("href", expect.stringContaining("sort=price-desc"));
  });
});
