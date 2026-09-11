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
};
