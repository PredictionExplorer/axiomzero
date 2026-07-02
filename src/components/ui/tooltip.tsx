"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Info } from "lucide-react";

import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "bottom";
type TooltipAlign = "center" | "start" | "end";

/**
 * Small info-icon trigger that reveals a short explanation on hover, focus,
 * or tap. Never place it inside a link or button: it renders its own button.
 */
export function InfoTip({
  label,
  children,
  side = "top",
  align = "center",
  className,
}: {
  /** Accessible name for the trigger, e.g. "About floor price". */
  label: string;
  children: ReactNode;
  side?: TooltipSide;
  align?: TooltipAlign;
  className?: string;
}) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        aria-expanded={open}
        // Open-only on click: a tap fires synthetic mouseenter/focus first,
        // so a click toggle would immediately close the tooltip on touch.
        // Dismissal happens via Escape, blur, mouse leave, or outside press.
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex size-5 items-center justify-center rounded-full border border-ivory/15 bg-ivory/[0.06] text-bone/75 transition hover:border-ivory/30 hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chartreuse"
      >
        <Info aria-hidden className="size-3.5" />
      </button>
      <span
        role="tooltip"
        id={tooltipId}
        className={cn(
          "absolute z-30 w-60 rounded-xl border border-ivory/15 bg-carbon p-3 text-left text-xs font-normal normal-case leading-5 tracking-normal text-bone shadow-[0_18px_50px_rgba(0,0,0,0.5)] transition",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          align === "center"
            ? "left-1/2 -translate-x-1/2"
            : align === "start"
              ? "left-0"
              : "right-0",
          open
            ? "visible opacity-100"
            : "pointer-events-none invisible opacity-0",
        )}
      >
        {children}
      </span>
    </span>
  );
}

/**
 * InfoTip preloaded with a marketplace glossary definition so explanations
 * stay identical everywhere a term appears.
 */
export function GlossaryTip({
  termKey,
  side,
  align,
  className,
}: {
  termKey: GlossaryKey;
  side?: TooltipSide;
  align?: TooltipAlign;
  className?: string;
}) {
  const { term, definition } = GLOSSARY[termKey];

  return (
    <InfoTip
      label={`About ${term.toLowerCase()}`}
      side={side}
      align={align}
      className={className}
    >
      <span className="font-semibold text-ivory">{term}.</span> {definition}
    </InfoTip>
  );
}
