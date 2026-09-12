import { getStorefrontCategories } from "@/lib/queries";
import { NavbarClient, type NavLink } from "./navbar-client";

/**
 * Safe fallback links — used only when the database is momentarily
 * unavailable so the public navigation never renders empty. As soon as
 * categories load from the database they take over (Phase 6).
 */
const FALLBACK_LINKS: NavLink[] = [
  { label: "New", href: "/shop?filter=new" },
  { label: "Hoodies", href: "/shop?category=Hoodies" },
  { label: "Jackets", href: "/shop?category=Jackets" },
  { label: "Footwear", href: "/shop?category=Footwear" },
  { label: "Shop All", href: "/shop" },
];

/**
 * Server wrapper: builds the navigation from ACTIVE database categories
 * (respecting the admin sort order, hiding disabled ones) without changing
 * the existing /shop?category=… URL scheme.
 */
export async function Navbar() {
  let links = FALLBACK_LINKS;
  try {
    const cats = await getStorefrontCategories();
    // Top-level categories only, keep the bar compact (max 4).
    const topLevel = cats.filter((c) => c.parentId == null).slice(0, 4);
    if (topLevel.length) {
      links = [
        { label: "New", href: "/shop?filter=new" },
        ...topLevel.map((c) => ({
          label: c.name,
          href: `/shop?category=${encodeURIComponent(c.name)}`,
        })),
        { label: "Shop All", href: "/shop" },
      ];
    }
  } catch {
    // keep fallback links
  }
  return <NavbarClient links={links} />;
}
