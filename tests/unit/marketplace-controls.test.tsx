import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketplaceControls } from "@/components/marketplace/marketplace-controls";

describe("MarketplaceControls", () => {
  it("shows view navigation and preserves selected query state", () => {
    const { container } = render(
      <MarketplaceControls
        collectionId="cosmic-signature"
        search={{
          collection: "cosmic-signature",
          kind: "sell",
          view: "listings",
          sort: "price-asc",
        }}
        totalOffers={2}
      />,
    );

    expect(container.querySelector("form")).toHaveAttribute(
      "action",
      "/cosmic-signature",
    );
    expect(
      screen.getByRole("link", { name: /^listings/i }),
    ).toHaveAttribute(
      "href",
      "/cosmic-signature?view=listings&filter=sell&sort=price-asc",
    );
    expect(container.querySelector('input[name="view"]')).toHaveValue("listings");
    expect(screen.queryByLabelText(/filter by collection/i)).toBeNull();
    expect(screen.getByText("2 entries")).toBeInTheDocument();
  });

  it("links top bids to the highest-bid offer view", () => {
    render(
      <MarketplaceControls
        collectionId="random-walk"
        search={{ collection: "all", kind: "buy", view: "top-bids" }}
        totalOffers={0}
      />,
    );

    expect(
      screen.getByRole("link", { name: /^top bids/i }),
    ).toHaveAttribute(
      "href",
      "/random-walk?view=top-bids&filter=buy&sort=price-desc",
    );
  });
});
