import { cookies } from "next/headers";
import { getStorefrontCategories } from "@/lib/queries";
import { getBuilderStore } from "@/lib/builder/storage";
import { BUILDER_PREVIEW_PARAM, getBuilderPreviewDoc } from "@/lib/builder/preview";
import { NavbarClient, type HeaderCfg, type NavLink } from "./navbar-client";

/**
 * Safe fallback links — used only when the database is momentarily
 * unavailable so the public navigation never renders empty. As soon as
 * categories load from the database they take over (Phase 6).
 */
const FALLBACK_LINKS: NavLink[] = [
  { label: "New", href: "/shop?filter=new", systemKey: "nav.new" },
  { label: "Hoodies", href: "/shop?category=Hoodies" },
  { label: "Jackets", href: "/shop?category=Jackets" },
  { label: "Footwear", href: "/shop?category=Footwear" },
  { label: "Shop All", href: "/shop", systemKey: "nav.shopAll" },
];

/**
 * Server wrapper: builds the navigation from ACTIVE database categories
 * (respecting the admin sort order, hiding disabled ones) without changing
 * the existing /shop?category=… URL scheme. When the Storefront Builder has
 * a published configuration, the header chrome (logo/nav/height/sticky/
 * toggles + menu order) follows the owner's settings.
 */
export async function Navbar() {
  let links = FALLBACK_LINKS;
  let fromDb = false;
  try {
    const cats = await getStorefrontCategories();
    // Top-level categories only, keep the bar compact (max 4).
    const topLevel = cats.filter((c) => c.parentId == null).slice(0, 4);
    if (topLevel.length) {
      links = [
        // Category names stay exactly as stored by the admin (data is
        // never machine-translated); only the system links are localized.
        { label: "New", href: "/shop?filter=new", systemKey: "nav.new" },
        ...topLevel.map((c) => ({
          label: c.name,
          href: `/shop?category=${encodeURIComponent(c.name)}`,
        })),
        { label: "Shop All", href: "/shop", systemKey: "nav.shopAll" },
      ];
      fromDb = true;
    }
  } catch {
    // keep fallback links
  }

  let cfg: HeaderCfg | null = null;
  try {
    const [store, token] = await Promise.all([
      getBuilderStore(),
      cookies().then((c) => c.get(BUILDER_PREVIEW_PARAM)?.value ?? null).catch(() => null),
    ]);
    const doc = getBuilderPreviewDoc(token ?? undefined) ?? store.published;
    if (doc) {
      cfg = doc.header;
      if (fromDb) {
        const groupFor = (key: string): NavLink[] =>
          key === "home"
            ? [{ label: "Home", href: "/", systemKey: "nav.home" }]
            : key === "shop"
              ? links.filter((l) => l.href === "/shop")
              : key === "collections"
                ? links.filter((l) => l.href !== "/shop" && l.href !== "/")
                : [];
        const ordered = cfg.navOrder.flatMap((k) => groupFor(k));
        if (ordered.length) links = ordered;
      }
    }
  } catch {
    // builder not published → legacy header
  }

  return <NavbarClient links={links} cfg={cfg} />;
}
