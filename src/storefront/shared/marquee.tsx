import Link from "next/link";

/**
 * Shared announcement marquee — one implementation, themed by the parent
 * (each storefront places and skins it differently). CMS data only.
 */
export function Marquee({
  items,
  link,
  className = "",
  accent = "✦",
}: {
  items: string[];
  link?: string;
  className?: string;
  accent?: string;
}) {
  return (
    <div className={`rd-ticker relative flex overflow-hidden ${className}`}>
      <div className="animate-marquee flex shrink-0 items-center gap-8 whitespace-nowrap pe-8">
        {[...items, ...items].map((m, i) => (
          <span
            key={i}
            className="rd-ticker-item flex items-center gap-8 text-xs font-semibold uppercase tracking-[0.2em]"
          >
            {link ? (
              <Link href={link} className="hover:opacity-70">
                {m}
              </Link>
            ) : (
              m
            )}
            <span className="text-amber">{accent}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
