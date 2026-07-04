import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { GlossaryTip, InfoTip } from "@/components/ui/tooltip";
import { GLOSSARY } from "@/lib/glossary";

describe("InfoTip", () => {
  it("wires the trigger to the tooltip content for assistive tech", () => {
    render(<InfoTip label="About floor price">Cheapest listed NFT.</InfoTip>);

    const trigger = screen.getByRole("button", { name: "About floor price" });
    const tooltip = screen.getByText("Cheapest listed NFT.");

    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(tooltip).toHaveAttribute("role", "tooltip");
    expect(tooltip).toHaveClass("invisible");
  });

  it("shows on hover and hides when the pointer leaves", async () => {
    const user = userEvent.setup();

    render(<InfoTip label="About gas">Network fee.</InfoTip>);

    const trigger = screen.getByRole("button", { name: "About gas" });

    await user.hover(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Network fee.")).toHaveClass("visible");

    await user.unhover(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Network fee.")).toHaveClass("invisible");
  });

  it("shows on keyboard focus and closes on Escape", async () => {
    const user = userEvent.setup();

    render(<InfoTip label="About seed">Deterministic input.</InfoTip>);

    const trigger = screen.getByRole("button", { name: "About seed" });

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("dismisses on outside presses via the document listener", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <button type="button">Elsewhere</button>
        <InfoTip label="About anchor">One-time staking.</InfoTip>
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "About anchor" });

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // A press inside the tooltip is ignored by the outside-press handler
    // (the trigger blur still dismisses it afterwards).
    await user.pointer({
      keys: "[MouseLeft]",
      target: screen.getByText("One-time staking."),
    });

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.pointer({
      keys: "[MouseLeft]",
      target: screen.getByRole("button", { name: "Elsewhere" }),
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on click or tap and closes on outside press", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <InfoTip label="About bids">Buy offer.</InfoTip>
        <p>Outside content</p>
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "About bids" });

    // A tap fires synthetic hover and focus before click, so click must keep
    // the tooltip open rather than toggle it shut again.
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByText("Outside content"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

describe("GlossaryTip", () => {
  it("renders the shared glossary definition for a term", () => {
    render(<GlossaryTip termKey="floorPrice" />);

    expect(
      screen.getByRole("button", { name: "About floor price" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(GLOSSARY.floorPrice.definition, { exact: false }),
    ).toBeInTheDocument();
  });
});
