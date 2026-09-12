import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRightIcon } from "@/components/icons";
import { LOCALE_COOKIE, resolveLocale, translate } from "@/i18n/translations";

export default async function NotFound() {
  let locale = resolveLocale(undefined);
  try {
    locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  } catch {
    // default locale
  }
  const tr = (key: string) => translate(locale, key);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center text-bone">
      <p className="font-display text-[28vw] leading-none opacity-10 sm:text-[200px]">
        404
      </p>
      <div className="-mt-16 sm:-mt-24">
        <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
          {tr("notFound.title")}
        </h1>
        <p className="mt-3 text-bone/60">{tr("notFound.text")}</p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-bone px-8 py-4 text-sm font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
        >
          {tr("notFound.backHome")}
          <ArrowRightIcon className="h-4 w-4 rtl:-scale-x-100" />
        </Link>
      </div>
    </div>
  );
}
