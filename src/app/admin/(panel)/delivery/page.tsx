import { listZonesAdmin } from "@/lib/delivery-admin";
import { DeliveryManager } from "./delivery-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Delivery" };

export default async function DeliveryPage() {
  const zones = await listZonesAdmin({});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Delivery</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage Algerian wilayas, shipping methods, prices (دج) and estimated
          times. Orders keep an immutable shipping snapshot — changing prices
          here never edits history.
        </p>
      </div>
      <DeliveryManager
        zones={zones.map((z) => ({
          id: z.id,
          code: z.code,
          wilaya: z.wilaya,
          slug: z.slug,
          city: z.city,
          price: z.price,
          estimatedTime: z.estimatedTime,
          homeEnabled: z.homeEnabled,
          homePrice: z.homePrice,
          homeEstimatedTime: z.homeEstimatedTime,
          pickupEnabled: z.pickupEnabled,
          pickupPrice: z.pickupPrice,
          pickupEstimatedTime: z.pickupEstimatedTime,
          notes: z.notes,
          sortOrder: z.sortOrder,
          enabled: z.enabled,
        }))}
      />
    </div>
  );
}
