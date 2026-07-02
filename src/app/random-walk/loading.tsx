import { TokenCardSkeleton } from "@/components/ui/skeleton";

export default function CollectionLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-5 py-14 sm:px-8">
      <div className="skeleton h-56 rounded-[2.5rem]" />
      <div className="skeleton h-48 rounded-[2rem]" />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <TokenCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
