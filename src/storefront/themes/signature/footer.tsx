import Link from "next/link";
import type { FooterProps } from "@/storefront/types";

/**
 * SIGNATURE footer — centered, restrained: wordmark, one hairline, quiet
 * link rows, a whispered legal line.
 */
export function SignatureFooter({ data }: FooterProps) {
  const { content, newsletter, contact, strings } = data;
  const copyright =
    content.copyright || strings.copyright;
  const hasContact =
    content.showContact && Boolean(contact.email || contact.phone || contact.address);

  return (
    <footer className="border-t border-black/10 bg-bone">
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <p className="font-display text-3xl font-normal tracking-tight">RUVEN DEPT</p>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-black/50">{content.description}</p>

        {hasContact && (
          <p className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-black/50">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="hover:text-ink hover:underline">{contact.email}</a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone.replace(/\s+/g, "")}`} dir="ltr" className="hover:text-ink hover:underline">
                {contact.phone}
              </a>
            )}
            {contact.address && <span>{contact.address}</span>}
          </p>
        )}

        {newsletter.enabled && (
          <form className="mx-auto mt-8 flex max-w-sm items-center gap-2">
            <input
              type="email"
              placeholder={newsletter.title || strings.newsletterPlaceholder}
              aria-label={newsletter.title || strings.newsletterPlaceholder}
              className="w-full border-b border-black/30 bg-transparent px-1 py-2.5 text-sm placeholder:text-black/35 focus:border-ink focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-bone transition-transform hover:scale-105"
            >
              {newsletter.buttonText || strings.join}
            </button>
          </form>
        )}

        {/* quiet link rows */}
        <div className="mt-14 grid gap-10 border-t border-black/10 pt-12 sm:grid-cols-3">
          {content.linkGroups.map((col) => (
            <div key={col.title}>
              <h3 className="text-[10px] font-medium uppercase tracking-[0.4em] text-black/40">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-black/60 transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-black/10 pt-8 text-xs text-black/40 sm:flex-row">
          <p>© {new Date().getFullYear()} {copyright}</p>
          <div className="flex items-center gap-6">
            {content.socialLinks.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-ink">
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
