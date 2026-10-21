export function Stars({ count, className = "" }: { count: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${count}/3 од`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < count ? "" : "opacity-25 grayscale"}>
          ⭐
        </span>
      ))}
    </span>
  );
}
