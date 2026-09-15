import Link from "next/link";
import type { FooterProps } from "@/storefront/types";

/**
 * NOIR DEPT footer — a monumental wordmark headline, an indexed hairline
 * link row and a quiet legal strip. Dark luxury to the last pixel.
 */
export function NoirFooter({ data }: FooterProps) {
  const { content, newsletter, contact, strings } = data;
  const copyright =
    content.copyright || strings.copyright;
  const hasContact =
    content.showContact && Boolean(contact.email || contact.phone || contact.address);

  return (
    <footer className="rd-dark-panel bg-ink text-bone">
      <div className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
        {/* monumental wordmark */}
        <p className="font-display text-[18vw] uppercase leading-[0.8] tracking-tight opacity-95 sm:text-[12vw] lg:text-[9rem]">
          RUVEN
        </p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.5em] text-amber">
          Dept. — Noir
        </p>

        <div className="mt-14 grid gap-12 border-t border-bone/10 pt-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <p className="max-w-xs text-sm leading-relaxed text-bone/50">{content.description}</p>
            {hasContact && (
              <ul className="mt-5 space-y-1.5 text-sm text-bone/50">
                {contact.email && (
                  <li>
                    <a href={`mailto:${contact.email}`} className="transition-colors hover:text-bone">
                      {contact.email}
                    </a>
                  </li>
                )}
                {contact.phone && (
                  <li dir="ltr" className="text-start">
                    <a href={`tel:${contact.phone.replace(/\s+/g, "")}`} className="transition-colors hover:text-bone">
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.address && <li>{contact.address}</li>}
              </ul>
            )}
            {newsletter.enabled && (
              <form className="mt-7 flex max-w-sm items-center gap-2">
                <input
                  type="email"
                  placeholder={newsletter.title || strings.newsletterPlaceholder}
                  aria-label={newsletter.title || strings.newsletterPlaceholder}
                  className="w-full rounded-none border-b border-bone/30 bg-transparent px-1 py-2.5 text-sm placeholder:text-bone/40 focus:border-amber focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 bg-bone px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
                >
                  {newsletter.buttonText || strings.join}
                </button>
              </form>
            )}
          </div>

          {/* indexed link row */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {content.linkGroups.map((col, i) => (
              <div key={col.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber">
                  {String(i + 1).padStart(2, "0")} / {col.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-sm text-bone/70 transition-colors hover:text-bone">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-bone/10 py-8 text-xs text-bone/40 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {copyright}
          </p>
          <div className="flex items-center gap-6">
            {content.socialLinks.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="uppercase tracking-widest transition-colors hover:text-bone">
                {s.label}
              </a>
            ))}
            <span>{strings.privacy}</span>
            <span>{strings.terms}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
