import { TokenCardSkeleton } from "@/components/ui/skeleton";

export default function TokenLoading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="skeleton aspect-square rounded-[2.5rem]" />
        <div className="skeleton min-h-[28rem] rounded-[2.5rem]" />
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <TokenCardSkeleton />
        <TokenCardSkeleton />
      </div>
    </div>
  );
}
