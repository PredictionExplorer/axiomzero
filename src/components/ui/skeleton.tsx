import { cn } from "@/lib/utils";

export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("skeleton rounded-2xl", className)} aria-hidden />;
}

export function TokenCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-ivory/10 bg-ivory/[0.045]">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-4 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-32" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-11 w-full" />
      </div>
    </article>
  );
}
