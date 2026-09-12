// Financial values in the admin panel are displayed in Algerian Dinar (دج).

/** Product/order amounts are stored in cents — show as X.XX دج */
export function formatDZD(amountCents: number): string {
  const value = amountCents / 100;
  return `${value.toLocaleString("fr-DZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} دج`;
}

/** Whole-dinar values (e.g. delivery prices) — show as X دج */
export function formatWholeDZD(amount: number): string {
  return `${amount.toLocaleString("fr-DZ")} دج`;
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_STYLES: Record<string, string> = {
  جديد: "bg-blue-100 text-blue-700",
  "تم التأكيد": "bg-indigo-100 text-indigo-700",
  "قيد التحضير": "bg-amber-100 text-amber-700",
  "تم الشحن": "bg-purple-100 text-purple-700",
  "تم التسليم": "bg-emerald-100 text-emerald-700",
  ملغى: "bg-rose-100 text-rose-700",
  مرجع: "bg-orange-100 text-orange-700",
};

/** Phase 7: payment status badge styles. */
export const PAYMENT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  paid: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  refunded: "bg-orange-100 text-orange-700",
  partially_refunded: "bg-amber-100 text-amber-700",
};

/** Phase 8: delivery (parcel) status labels + badge styles. */
export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  not_ready: "Not ready",
  ready: "Ready",
  handed_to_courier: "Handed to courier",
  in_transit: "In transit",
  delivered: "Delivered",
  returned: "Returned",
};

export const DELIVERY_STATUS_STYLES: Record<string, string> = {
  not_ready: "bg-slate-100 text-slate-600",
  ready: "bg-blue-100 text-blue-700",
  handed_to_courier: "bg-indigo-100 text-indigo-700",
  in_transit: "bg-amber-100 text-amber-700",
  delivered: "bg-emerald-100 text-emerald-700",
  returned: "bg-rose-100 text-rose-700",
};

/** Phase 8: shipping method labels. */
export const SHIPPING_METHOD_LABELS: Record<string, string> = {
  home: "Home Delivery",
  office: "Pickup / Office",
};
