import Link from "next/link";
import type { FooterProps } from "@/storefront/types";

/**
 * NIGHT SHIFT footer — the station sign-off: glow hairline, pulsing status
 * dot, spaced columns, minimal legal strip.
 */
export function NightshiftFooter({ data }: FooterProps) {
  const { content, newsletter, contact, strings } = data;
  const copyright =
    content.copyright || strings.copyright;
  const hasContact =
    content.showContact && Boolean(contact.email || contact.phone || contact.address);

  return (
    <footer className="rd-dark-panel bg-ink text-bone">
      <div className="ns-glow-line h-px w-full bg-gradient-to-r from-transparent via-amber to-transparent opacity-60" aria-hidden />
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-10 lg:flex-row">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber" aria-hidden />
              <span className="font-display text-2xl uppercase tracking-tight">RUVEN Dept.</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-bone/50">{content.description}</p>
            {hasContact && (
              <ul className="mt-4 space-y-1.5 text-sm text-bone/50">
                {contact.email && (
                  <li>
                    <a href={`mailto:${contact.email}`} className="transition-colors hover:text-bone">{contact.email}</a>
                  </li>
                )}
                {contact.phone && (
                  <li dir="ltr" className="text-start">
                    <a href={`tel:${contact.phone.replace(/\s+/g, "")}`} className="transition-colors hover:text-bone">{contact.phone}</a>
                  </li>
                )}
                {contact.address && <li>{contact.address}</li>}
              </ul>
            )}
            {newsletter.enabled && (
              <form className="mt-6 flex max-w-sm items-center gap-2">
                <input
                  type="email"
                  placeholder={newsletter.title || strings.newsletterPlaceholder}
                  aria-label={newsletter.title || strings.newsletterPlaceholder}
                  className="w-full rounded-full border border-bone/20 bg-transparent px-4 py-2.5 text-sm placeholder:text-bone/40 focus:border-amber focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-bone px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
                >
                  {newsletter.buttonText || strings.join}
                </button>
              </form>
            )}
          </div>

          <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-3">
            {content.linkGroups.map((col) => (
              <div key={col.title}>
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-bone/40">
                  <span className="h-1 w-3 bg-amber/70" aria-hidden />
                  {col.title}
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

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-bone/10 pt-8 text-xs text-bone/40 sm:flex-row">
          <p>© {new Date().getFullYear()} {copyright}</p>
          <div className="flex items-center gap-6">
            {content.socialLinks.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-bone">
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
