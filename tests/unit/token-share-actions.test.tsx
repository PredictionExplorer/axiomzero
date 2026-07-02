import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TokenShareActions } from "@/components/marketplace/token-share-actions";

describe("TokenShareActions", () => {
  it("copies share links to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(
      <TokenShareActions
        links={[
          {
            label: "detail link",
            value:
              "/token/cosmic-signature/19?theme=black&media=image&tab=notes",
          },
        ]}
        detailHref="https://axiomzero.market/token/cosmic-signature/19"
        title="NUMBA 19"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /copy detail link/i }),
    );

    expect(writeText).toHaveBeenCalledWith(
      "/token/cosmic-signature/19?theme=black&media=image&tab=notes",
    );
    expect(screen.getByText("detail link copied.")).toBeVisible();
    expect(screen.getByRole("link", { name: /share on x/i })).toHaveAttribute(
      "href",
      expect.stringContaining("twitter.com/intent/tweet"),
    );
  });
});
