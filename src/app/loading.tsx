import { TokenCardSkeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-10 px-5 py-20 sm:px-8">
      <div className="skeleton h-40 rounded-[2.5rem]" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-48 rounded-[2rem]" />
        <div className="skeleton h-48 rounded-[2rem]" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <TokenCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
