import Link from "next/link";
import type { FooterProps } from "@/storefront/types";

/**
 * BLOCK SEVEN footer — the wall tag: a giant outlined wordmark stamped over
 * an ink slab, chunky link columns and a stamped legal strip. Pure server
 * component: zero client JS.
 */
export function SeventhFooter({ data }: FooterProps) {
  const { content, newsletter, contact, strings } = data;
  const copyright = content.copyright || strings.copyright;
  const hasContact =
    content.showContact && Boolean(contact.email || contact.phone || contact.address);

  return (
    <footer className="rd-footer rd-dark-panel border-t-[3px] border-ink bg-ink text-bone">
      <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
        {/* outlined wall wordmark */}
        <p className="sb-outline font-display text-[16vw] uppercase leading-[0.85] sm:text-[11vw] lg:text-[8.5rem]" aria-hidden="true">
          RUVEN·7
        </p>

        <div className="mt-10 grid gap-10 border-t-2 border-bone/15 pt-10 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <p className="max-w-xs text-sm leading-relaxed text-bone/60">{content.description}</p>
            {hasContact && (
              <ul className="mt-5 space-y-1.5 text-sm text-bone/60">
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
              <form className="mt-6 flex max-w-sm items-stretch gap-2">
                <input
                  type="email"
                  placeholder={newsletter.title || strings.newsletterPlaceholder}
                  aria-label={newsletter.title || strings.newsletterPlaceholder}
                  className="w-full border-2 border-bone/40 bg-transparent px-3 py-2.5 text-sm placeholder:text-bone/40 focus:border-olive focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 border-2 border-bone bg-bone px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-ink transition-colors hover:border-olive hover:bg-olive"
                >
                  {newsletter.buttonText || strings.join}
                </button>
              </form>
            )}
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {content.linkGroups.map((col) => (
              <div key={col.title}>
                <h3 className="border-b-2 border-olive pb-2 font-display text-xs uppercase tracking-[0.15em] text-bone">
                  {col.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-sm font-medium text-bone/70 transition-colors hover:text-bone">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t-2 border-bone/15 py-7 text-xs text-bone/50 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {copyright}
          </p>
          <div className="flex flex-wrap items-center gap-5">
            {content.socialLinks.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold uppercase tracking-widest transition-colors hover:text-bone">
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
