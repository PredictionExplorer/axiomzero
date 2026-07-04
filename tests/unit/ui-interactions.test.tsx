import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ArtworkLightbox } from "@/components/marketplace/artwork-lightbox";
import { TokenMediaViewer } from "@/components/marketplace/token-media-viewer";
import { TokenShareActions } from "@/components/marketplace/token-share-actions";
import { Reveal } from "@/components/ui/reveal";
import type { MarketToken } from "@/lib/marketplace/types";
import { triggerIntersectionObservers } from "../setup/vitest.setup";

const token = {
  collectionId: "random-walk",
  tokenId: 7,
  name: "Random Walk #000007",
  owner: "0x0000000000000000000000000000000000000001",
  seed: "seed",
  traits: [],
  artwork: { image: "/art.png", alt: "Artwork" },
} satisfies MarketToken;

describe("ArtworkLightbox", () => {
  it("opens as a modal, closes from the backdrop, and follows the open prop", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ArtworkLightbox src="/art.png" alt="Artwork" open={false} onClose={onClose} />,
    );

    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    expect(dialog.open).toBe(false);

    rerender(
      <ArtworkLightbox src="/art.png" alt="Artwork" open onClose={onClose} />,
    );
    expect(dialog.open).toBe(true);

    // Clicks on inner content must not close the dialog.
    fireEvent.click(dialog.querySelector("img") as HTMLImageElement);
    expect(onClose).not.toHaveBeenCalled();

    // Clicking the dialog element itself means clicking the backdrop.
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <ArtworkLightbox src="/art.png" alt="Artwork" open={false} onClose={onClose} />,
    );
    expect(dialog.open).toBe(false);
  });
});

describe("TokenMediaViewer lightbox wiring", () => {
  const imageMedia = {
    type: "image",
    src: "/art.png",
    theme: "black",
    media: "image",
    requestedMedia: "image",
  } as const;

  it("opens the lightbox for still images and closes it again", async () => {
    render(
      <TokenMediaViewer
        token={token}
        selectedMedia={imageMedia}
        themeOptions={[]}
        mediaOptions={[]}
      />,
    );

    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    expect(dialog.open).toBe(false);

    fireEvent.click(
      screen.getByRole("button", { name: /open .* artwork in fullscreen/i }),
    );
    expect(dialog.open).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    await waitFor(() => {
      expect(dialog.open).toBe(false);
    });
  });

  it("does not offer a lightbox for video media", () => {
    render(
      <TokenMediaViewer
        token={token}
        selectedMedia={{
          type: "video",
          src: "/art.mp4",
          theme: "black",
          media: "single",
          requestedMedia: "single",
          unavailableMessage: "Triple video is not available for this token.",
        }}
        themeOptions={[]}
        mediaOptions={[]}
      />,
    );

    expect(document.querySelector("dialog")).toBeNull();
    expect(
      screen.getByText(/triple video is not available/i),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: /open .* artwork in fullscreen/i }),
    );
    expect(document.querySelector("dialog")).toBeNull();
  });
});

describe("Reveal", () => {
  it("becomes visible once it intersects the viewport", () => {
    render(
      <Reveal className="extra" delayMs={120}>
        <p>Revealed content</p>
      </Reveal>,
    );

    const wrapper = screen.getByText("Revealed content").parentElement;
    expect(wrapper).toHaveClass("reveal", "extra");
    expect(wrapper).toHaveStyle({ transitionDelay: "120ms" });
    expect(wrapper).not.toHaveClass("is-visible");

    triggerIntersectionObservers(false);
    expect(wrapper).not.toHaveClass("is-visible");

    triggerIntersectionObservers(true);
    expect(wrapper).toHaveClass("is-visible");
  });
});

describe("TokenShareActions clipboard fallback", () => {
  it("explains when clipboard access is unavailable", async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard",
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    try {
      render(
        <TokenShareActions
          links={[{ label: "detail link", value: "/token/random-walk/7" }]}
          detailHref="https://axiomzero.market/token/random-walk/7"
          title="Random Walk #000007"
        />,
      );

      await userEvent.click(
        screen.getByRole("button", { name: /copy detail link/i }),
      );

      expect(
        screen.getByText(/clipboard access is unavailable/i),
      ).toBeVisible();
    } finally {
      if (clipboardDescriptor) {
        Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
      } else {
        delete (navigator as { clipboard?: unknown }).clipboard;
      }
    }
  });
});
