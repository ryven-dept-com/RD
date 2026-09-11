import { getAllDeliveryZones } from "@/lib/admin-queries";
import { DeliveryManager } from "./delivery-manager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Delivery" };

export default async function DeliveryPage() {
  const zones = await getAllDeliveryZones();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Delivery Zones</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage Algerian wilayas, delivery prices (دج) and availability
        </p>
      </div>
      <DeliveryManager
        zones={zones.map((z) => ({
          id: z.id,
          code: z.code,
          wilaya: z.wilaya,
          price: z.price,
          estimatedTime: z.estimatedTime,
          enabled: z.enabled,
        }))}
      />
    </div>
  );
}
