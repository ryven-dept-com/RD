"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/context/admin-context";
import { LanguageSwitcher } from "@/components/language-switcher";

const NAV = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { label: "Products", href: "/admin/products", icon: "M4 7l8-4 8 4-8 4-8-4zM4 7v10l8 4 8-4V7" },
  { label: "Categories", href: "/admin/categories", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { label: "Orders", href: "/admin/orders", icon: "M6 2l1 4h10l1-4M5 6h14l-1 14H6L5 6z" },
  { label: "Delivery", href: "/admin/delivery", icon: "M3 7h11v8H3zM14 10h4l3 3v2h-7M7 18a1.6 1.6 0 100-3.2M17.5 18a1.6 1.6 0 100-3.2" },
  { label: "Customers", href: "/admin/customers", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" },
  { label: "Content", href: "/admin/content", icon: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" },
  { label: "Marketing", href: "/admin/marketing", icon: "M3 10v4a1 1 0 001 1h2l1 5h2l-1-5h2l9 4V5l-9 4H4a1 1 0 00-1 1z" },
  { label: "Themes", href: "/admin/themes", icon: "M3 5h18v4H3zM3 11h8v8H3zM13 11h8v8h-8z" },
  { label: "Builder", href: "/admin/builder", icon: "M4 5h16v3H4zM4 10h7v9H4zM13 10h7v4h-7zM13 16h7v3h-7z" },
  { label: "Health", href: "/admin/storefront/health", icon: "M12 21s-7-4.6-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 6c-2.5 4.4-9.5 9-9.5 9zM8 12h2l1.5-3 2 5L15 12h2" },
  { label: "Analytics", href: "/admin/analytics", icon: "M4 20v-7M10 20V6M16 20v-10M2 20h20" },
  { label: "Settings", href: "/admin/settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 00-1.7-1L14.5 2h-4l-.3 3a7 7 0 00-1.7 1l-2.4-1-2 3.4L4 11a7 7 0 000 2l-2 1.6 2 3.4 2.4-1a7 7 0 001.7 1l.3 3h4l.3-3a7 7 0 001.7-1l2.4 1 2-3.4-2-1.6a7 7 0 00.1-1z" },
];

export function AdminSidebar({
  displayName,
  onNavigate,
}: {
  displayName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white font-display text-lg text-slate-900">
          R
        </div>
        <div>
          <p className="font-display text-base leading-none tracking-wide text-white">
            RUVEN
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
            Admin Panel
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-4 py-4">
        <p className="px-1 text-xs text-slate-500">Signed in as</p>
        <p className="px-1 text-sm font-medium text-white">{displayName}</p>
      </div>
    </div>
  );
}

export function AdminTopbar({ displayName }: { displayName: string }) {
  const router = useRouter();
  const { adminFetch } = useAdmin();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    await adminFetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div className="hidden lg:block">
          <p className="text-sm text-slate-500">Store management</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            target="_blank"
            className="hidden rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:block"
          >
            View store ↗
          </Link>
          {/* Phase 9 language infrastructure — persists the rd-locale
              cookie and flips html lang/dir for the admin panel too. */}
          <LanguageSwitcher compact />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={logout}
              disabled={loggingOut}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              {loggingOut ? "…" : "Logout"}
            </button>
          </div>
        </div>
      </header>

      {/* mobile sidebar drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-slate-900">
            <AdminSidebar
              displayName={displayName}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
