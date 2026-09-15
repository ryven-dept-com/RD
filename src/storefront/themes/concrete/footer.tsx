import Link from "next/link";
import type { FooterProps } from "@/storefront/types";

/**
 * RAW CONCRETE footer — a fused bordered grid: wordmark cell, contact cell,
 * link cells and a stamped legal strip. Industrial to the end.
 */
export function ConcreteFooter({ data }: FooterProps) {
  const { content, newsletter, contact, strings } = data;
  const copyright =
    content.copyright || strings.copyright;
  const hasContact =
    content.showContact && Boolean(contact.email || contact.phone || contact.address);

  return (
    <footer className="rd-dark-panel border-t-2 border-ink bg-ink text-bone">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid border-2 border-bone/30 md:grid-cols-2 lg:grid-cols-4">
          {/* wordmark cell */}
          <div className="border-b-2 border-bone/30 p-6 md:border-e-2 lg:border-b-0">
            <p className="font-display text-3xl uppercase leading-none tracking-tight">RUVEN</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.4em] text-amber">Dept.</p>
            <p className="mt-4 text-sm leading-relaxed text-bone/50">{content.description}</p>
            {newsletter.enabled && (
              <form className="mt-5 flex items-center gap-2">
                <input
                  type="email"
                  placeholder={newsletter.title || strings.newsletterPlaceholder}
                  aria-label={newsletter.title || strings.newsletterPlaceholder}
                  className="w-full border-2 border-bone/30 bg-transparent px-3 py-2 text-sm placeholder:text-bone/40 focus:border-amber focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 border-2 border-bone bg-bone px-3 py-2 text-xs font-bold uppercase tracking-widest text-ink transition-colors hover:bg-transparent hover:text-bone"
                >
                  {newsletter.buttonText || strings.join}
                </button>
              </form>
            )}
          </div>

          {/* contact cell */}
          <div className="border-b-2 border-bone/30 p-6 lg:border-b-0 lg:border-e-2">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber">/ {String(content.linkGroups.length + 1).padStart(2, "0")}</h3>
            {hasContact ? (
              <ul className="mt-4 space-y-2 text-sm text-bone/70">
                {contact.email && (
                  <li>
                    <a href={`mailto:${contact.email}`} className="hover:text-bone">{contact.email}</a>
                  </li>
                )}
                {contact.phone && (
                  <li dir="ltr" className="text-start">
                    <a href={`tel:${contact.phone.replace(/\s+/g, "")}`} className="hover:text-bone">{contact.phone}</a>
                  </li>
                )}
                {contact.address && <li>{contact.address}</li>}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-bone/50">RYVEN DEPT</p>
            )}
          </div>

          {/* link cells */}
          {content.linkGroups.slice(0, 2).map((col, i) => (
            <div key={col.title} className={`p-6 ${i === 0 ? "border-b-2 border-bone/30 md:border-b-0 md:border-e-2" : ""}`}>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber">
                / {String(i + 1).padStart(2, "0")} — {col.title}
              </h3>
              <ul className="mt-4 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-bone/70 hover:text-bone">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* stamped legal strip */}
        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-2 border-bone/30 px-5 py-4 text-xs text-bone/50 sm:flex-row">
          <p>© {new Date().getFullYear()} {copyright}</p>
          <div className="flex flex-wrap items-center gap-5">
            {content.socialLinks.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold uppercase tracking-widest hover:text-bone">
                {s.label}
              </a>
            ))}
            <span className="border border-bone/30 px-2 py-0.5 font-display tracking-[0.2em]">{strings.privacy}</span>
            <span className="border border-bone/30 px-2 py-0.5 font-display tracking-[0.2em]">{strings.terms}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
