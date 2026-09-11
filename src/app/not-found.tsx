import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center text-bone">
      <p className="font-display text-[28vw] leading-none opacity-10 sm:text-[200px]">
        404
      </p>
      <div className="-mt-16 sm:-mt-24">
        <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 text-bone/60">
          This page took a different route. Let&apos;s get you back.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-bone px-8 py-4 text-sm font-semibold uppercase tracking-widest text-ink transition-transform hover:scale-105"
        >
          Back home
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
