import type { Metadata } from "next";
import { getStoreSettings } from "@/lib/settings";
import { getTheme, THEMES } from "@/themes/registry";
import { ThemesClient } from "./themes-client";

export const metadata: Metadata = { title: "Themes · Admin" };
export const dynamic = "force-dynamic";

/**
 * Admin → Themes — the storefront theme library.
 *
 * Server-rendered list (admin session is enforced by the panel layout); the
 * client island only handles preview/activate actions through CSRF-checked
 * admin APIs, so customers can never reach any of this.
 */
export default async function ThemesPage() {
  let activeId = "";
  try {
    const store = await getStoreSettings();
    activeId = store.activeTheme;
  } catch {
    // registry default below
  }
  const active = getTheme(activeId);

  return (
    <ThemesClient
      initialActive={active.id}
      themes={THEMES.map((t) => ({
        id: t.id,
        name: t.name,
        tagline: t.tagline,
        description: t.description,
        tags: t.tags,
        swatch: t.swatch,
      }))}
    />
  );
}
