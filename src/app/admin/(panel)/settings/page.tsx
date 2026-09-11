import { getSettingsMap } from "@/lib/admin-queries";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getSettingsMap();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Store information and configuration
        </p>
      </div>
      <SettingsForm
        initial={{
          storeName: settings.storeName ?? "RUVEN DEPT",
          contactEmail: settings.contactEmail ?? "",
          contactPhone: settings.contactPhone ?? "",
          address: settings.address ?? "",
          freeShippingThreshold: settings.freeShippingThreshold ?? "",
          currency: settings.currency ?? "دج",
          announcement: settings.announcement ?? "",
        }}
      />
    </div>
  );
}
