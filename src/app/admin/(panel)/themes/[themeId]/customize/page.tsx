import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signThemePreviewToken } from "@/lib/admin-auth";
import { getStoreSettings } from "@/lib/settings";
import { getTheme } from "@/themes/registry";
import { EMPTY_CUSTOMIZATION } from "@/themes/customize";
import { isThemeId, type ThemeId } from "@/themes/types";
import { CustomizeClient } from "./customize-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ themeId: string }>;
}): Promise<Metadata> {
  const { themeId } = await params;
  if (!isThemeId(themeId)) return { title: "Themes · Admin" };
  const theme = getTheme(themeId);
  return { title: `Customize ${theme.name} · Admin` };
}

/**
 * Admin → Themes → Customize — full typography + color control for ONE
 * storefront. Customizations are stored per theme (never globally) and are
 * presentation-only: business data, checkout and delivery are untouched.
 */
export default async function CustomizeThemePage({
  params,
}: {
  params: Promise<{ themeId: string }>;
}) {
  const { themeId } = await params;
  if (!isThemeId(themeId)) redirect("/admin/themes");
  const id = themeId as ThemeId;
  const theme = getTheme(id);

  let saved = EMPTY_CUSTOMIZATION;
  let activeId = "";
  try {
    const store = await getStoreSettings();
    saved = store.themeCustomizations[id] ?? EMPTY_CUSTOMIZATION;
    activeId = store.activeTheme;
  } catch {
    // defaults below
  }

  // Secure preview for the live iframe: same HMAC gateway as the regular
  // theme preview — read-only, short-lived cookie, no data writes.
  const previewToken = signThemePreviewToken(id);

  return (
    <CustomizeClient
      theme={{ id, name: theme.name, tagline: theme.tagline, description: theme.description }}
      isActive={activeId === id}
      initialCustomization={saved}
      previewToken={previewToken}
    />
  );
}
