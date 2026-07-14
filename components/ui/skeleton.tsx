import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-2xl bg-background-mist border border-border-mist", className)}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="neo-border bg-surface-white rounded-[24px] neo-shadow-md p-6 md:p-8">
      <div className="flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function BriefItemSkeleton() {
  return (
    <div className="flex gap-4 p-5 rounded-2xl bg-background-mist border border-border-mist">
      <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
      </div>
    </div>
  );
}

export function PriorityItemSkeleton() {
  return (
    <div className="p-4 space-y-2">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full rounded" />
      <Skeleton className="h-5 w-12 rounded-md" />
    </div>
  );
}
