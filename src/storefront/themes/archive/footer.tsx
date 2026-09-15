import Link from "next/link";
import type { FooterProps } from "@/storefront/types";

/**
 * ARCHIVE footer — the colophon: double rules, serif wordmark, ledger
 * columns, a printed-matter legal line.
 */
export function ArchiveFooter({ data }: FooterProps) {
  const { content, newsletter, contact, strings } = data;
  const copyright =
    content.copyright || strings.copyright;
  const hasContact =
    content.showContact && Boolean(contact.email || contact.phone || contact.address);

  return (
    <footer className="border-t-2 border-ink bg-bone">
      <div className="mx-4 border-b border-ink sm:mx-6 lg:mx-auto lg:max-w-7xl" aria-hidden />
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <p className="font-display text-3xl font-medium tracking-tight">
              Ruven <span className="italic text-amber">Dept.</span>
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-black/50">{content.description}</p>
            {hasContact && (
              <ul className="mt-4 space-y-1.5 text-sm text-black/50">
                {contact.email && (
                  <li>
                    <a href={`mailto:${contact.email}`} className="hover:text-ink hover:underline">{contact.email}</a>
                  </li>
                )}
                {contact.phone && (
                  <li dir="ltr" className="text-start">
                    <a href={`tel:${contact.phone.replace(/\s+/g, "")}`} className="hover:text-ink hover:underline">{contact.phone}</a>
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
                  className="w-full border-b border-black/40 bg-transparent px-1 py-2.5 text-sm placeholder:text-black/40 focus:border-ink focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-bone transition-transform hover:scale-105"
                >
                  {newsletter.buttonText || strings.join}
                </button>
              </form>
            )}
          </div>

          {content.linkGroups.map((col, i) => (
            <div key={col.title}>
              <h3 className="font-display text-xs italic tracking-[0.25em] text-amber">
                {String(i + 1).padStart(2, "0")}. {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-black/60 transition-colors hover:text-ink hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-black/20 pt-6 text-xs text-black/40">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="font-display italic">© {new Date().getFullYear()} {copyright}</p>
            <div className="flex items-center gap-6">
              {content.socialLinks.map((s) => (
                <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
                  {s.label}
                </a>
              ))}
              <span>{strings.privacy}</span>
              <span>{strings.terms}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
