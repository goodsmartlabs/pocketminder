export default function Loading() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <div className="h-4 w-40 rounded-full bg-surface-3" />
        <div className="h-10 w-72 rounded-full bg-surface-3" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface-3/70" />
        ))}
      </div>
      <div className="h-48 rounded-3xl bg-surface-3/70" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-surface-3/50" />
        ))}
      </div>
    </div>
  );
}
