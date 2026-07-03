import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AnchorStatusPill,
  anchorStatusLabel,
} from "@/components/marketplace/anchor-status-pill";

describe("anchorStatusLabel", () => {
  it("names all three anchor states", () => {
    expect(anchorStatusLabel(false)).toBe("Never anchored");
    expect(anchorStatusLabel(true)).toBe("Anchor used");
    expect(anchorStatusLabel(true, true)).toBe("Anchored now");
  });
});

describe("AnchorStatusPill", () => {
  it("renders nothing while the anchor status is unknown", () => {
    const { container } = render(<AnchorStatusPill anchored={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("highlights never-anchored tokens positively", () => {
    render(<AnchorStatusPill anchored={false} />);

    expect(screen.getByText("Never anchored")).toBeInTheDocument();
    expect(
      screen.getByText(/anchor is still available/i),
    ).toBeInTheDocument();
  });

  it("marks used anchors and tokens sitting in the anchoring vault", () => {
    const { rerender } = render(<AnchorStatusPill anchored />);

    expect(screen.getByText("Anchor used")).toBeInTheDocument();

    rerender(<AnchorStatusPill anchored inVault />);

    expect(screen.getByText("Anchored now")).toBeInTheDocument();
    expect(screen.getByText(/anchoring vault/i)).toBeInTheDocument();
  });
});
