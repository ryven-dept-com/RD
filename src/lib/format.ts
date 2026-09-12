export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Format a price (stored in cents) with an explicit currency symbol, as
 * configured in Admin → Settings → Store. Used by both server and client
 * components. Single-glyph symbols ($, €, £) prefix the amount; longer
 * codes and words (دج, DZD, DA) are placed after it.
 */
export function formatPriceWithSymbol(cents: number, symbol: string): string {
  const amount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  const sym = (symbol || "$").trim() || "$";
  return sym.length <= 1 ? `${sym}${amount}` : `${amount} ${sym}`;
}

export function formatDate(date: Date | string, locale = "en-US"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function averageRating(ratings: number[]): number {
  if (!ratings.length) return 0;
  const sum = ratings.reduce((a, b) => a + b, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}
