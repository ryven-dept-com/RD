"use client";

import Link from "next/link";
import type { FooterContent, NewsletterContent } from "@/lib/cms";
import { useT } from "@/i18n/language-context";

export type FooterProps = {
  content: FooterContent;
  newsletter: NewsletterContent;
  contact: { email: string; phone: string; address: string };
  /** Admin → Settings → Store name; used when no custom copyright is set. */
  storeName?: string;
};

export function Footer({ content, newsletter, contact, storeName }: FooterProps) {
  const t = useT();
  const copyright =
    content.copyright ||
    t("footer.copyright", { name: storeName || "RUVEN DEPT" });
  const hasContact =
    content.showContact &&
    Boolean(contact.email || contact.phone || contact.address);

  return (
    <footer className="bg-ink text-bone">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div
          className={`grid gap-12 ${
            content.linkGroups.length === 3
              ? "lg:grid-cols-[1.5fr_1fr_1fr_1fr]"
              : "lg:grid-cols-[1.5fr_repeat(auto-fit,1fr)]"
          }`}
        >
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl">RUVEN</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] opacity-60">
                Dept.
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-bone/50">
              {content.description}
            </p>
            {hasContact && (
              <ul className="mt-4 space-y-1.5 text-sm text-bone/50">
                {contact.email && (
                  <li>
                    <a
                      href={`mailto:${contact.email}`}
                      className="transition-colors hover:text-bone"
                    >
                      {contact.email}
                    </a>
                  </li>
                )}
                {contact.phone && (
                  <li dir="ltr" className="text-start">
                    <a
                      href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                      className="transition-colors hover:text-bone"
                    >
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.address && <li>{contact.address}</li>}
              </ul>
            )}
            {newsletter.enabled && (
              <form className="mt-6 flex max-w-sm items-center gap-2">
                <input
                  type="email"
                  placeholder={newsletter.title || t("footer.newsletterPlaceholder")}
                  aria-label={newsletter.title || t("footer.newsletterPlaceholder")}
                  className="w-full rounded-full border border-bone/20 bg-transparent px-4 py-2.5 text-sm placeholder:text-bone/40 focus:border-bone/60 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-bone px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
                >
                  {newsletter.buttonText || t("footer.join")}
                </button>
              </form>
            )}
            {newsletter.enabled && newsletter.description && (
              <p className="mt-2 max-w-sm text-xs text-bone/40">
                {newsletter.description}
              </p>
            )}
          </div>

          {content.linkGroups.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-bone/40">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-bone/70 transition-colors hover:text-bone"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-bone/10 pt-8 text-xs text-bone/40 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {copyright}
          </p>
          <div className="flex items-center gap-6">
            {content.socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-bone"
              >
                {s.label}
              </a>
            ))}
            <span>{t("footer.privacy")}</span>
            <span>{t("footer.terms")}</span>
            <span>{t("footer.accessibility")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
