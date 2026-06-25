import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { TokenDetailTab } from "@/lib/marketplace/token-detail";

type DetailTab = {
  id: TokenDetailTab;
  label: string;
  href: string;
};

export function TokenDetailTabs({
  tabs,
  activeTab,
  children,
}: {
  tabs: DetailTab[];
  activeTab: TokenDetailTab;
  children: ReactNode;
}) {
  return (
    <section className="mt-8" aria-label="Token detail sections">
      <div
        className="grid grid-cols-3 rounded-full border border-ivory/10 bg-ivory/[0.045] p-1 text-center text-sm font-semibold text-bone"
        role="tablist"
        aria-label="Token detail panels"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab.id}-panel`}
              id={`${tab.id}-tab`}
              className={cn(
                "rounded-full px-4 py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chartreuse",
                isActive ? "bg-copper text-ink" : "hover:bg-ivory/[0.08]",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div
        id={`${activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`${activeTab}-tab`}
        className="mt-6"
      >
        {children}
      </div>
    </section>
  );
}
