import { getSettingsMap, SETTING_DEFS, SETTING_KEYS } from "@/lib/settings";
import { getCmsData } from "@/lib/cms";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settingsMap, cms] = await Promise.all([
    getSettingsMap(),
    getCmsData().catch(() => null),
  ]);

  // Fill every known key from the database, falling back to the registered
  // default so the form always starts with authoritative values.
  const initial: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    initial[key] = settingsMap[key] ?? SETTING_DEFS[key].defaultValue;
  }

  const announcement = cms
    ? {
        enabled: cms.announcement.enabled,
        text: cms.announcement.text,
        link: cms.announcement.link,
      }
    : { enabled: false, text: "", link: "" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Store configuration, checkout rules, branding, SEO and marketing
        </p>
      </div>
      <SettingsForm initial={initial} announcement={announcement} />
    </div>
  );
}
