export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-sm bg-[#d8e2ea] ${className}`.trim()} />;
}

export function TableSkeleton({ rows = 8, children }) {
  return Array.from({ length: rows }).map((_, index) => children(index));
}
