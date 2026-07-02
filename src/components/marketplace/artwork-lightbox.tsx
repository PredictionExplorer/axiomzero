"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

export function ArtworkLightbox({
  src,
  alt,
  open,
  onClose,
}: {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-0 max-h-none max-w-none border-0 bg-ink/95 p-0 backdrop:bg-ink/90"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="flex min-h-screen flex-col">
        <div className="flex justify-end p-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="relative mx-auto flex-1 w-full max-w-6xl px-4 pb-8">
          <div className="relative aspect-square w-full">
            <Image
              src={src}
              alt={alt}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>
        </div>
      </div>
    </dialog>
  );
}
