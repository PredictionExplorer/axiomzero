import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { WatchButton } from "@/components/marketplace/watch-button";
import { isWatched } from "@/lib/watchlist";

describe("WatchButton", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("toggles a token in the watchlist", () => {
    render(<WatchButton collectionId="random-walk" tokenId={7} />);

    const button = screen.getByRole("button", {
      name: /add token 7 to your watchlist/i,
    });

    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);

    expect(isWatched("random-walk", 7)).toBe(true);
    expect(
      screen.getByRole("button", {
        name: /remove token 7 from your watchlist/i,
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps multiple instances of the same token in sync", () => {
    render(
      <>
        <WatchButton collectionId="cosmic-signature" tokenId={3} />
        <WatchButton
          collectionId="cosmic-signature"
          tokenId={3}
          variant="pill"
        />
      </>,
    );

    const [icon, pill] = screen.getAllByRole("button");

    fireEvent.click(icon);

    expect(pill).toHaveAttribute("aria-pressed", "true");
    expect(pill).toHaveTextContent("Watching");

    fireEvent.click(pill);

    expect(icon).toHaveAttribute("aria-pressed", "false");
    expect(pill).toHaveTextContent("Watch");
  });
});
