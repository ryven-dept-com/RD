import { verifyRequest } from "@/lib/admin-auth";
import { searchOrdersAdmin } from "@/lib/order-admin";

export const dynamic = "force-dynamic";

const SORTS = new Set(["newest", "oldest", "total-desc", "total-asc"]);

/**
 * Admin order list (Phase 7): server-side search (order number, customer
 * name, phone, email), status/payment filters, date range, sorting and
 * pagination — the browser never receives more than one page.
 */
export async function GET(request: Request) {
  const admin = await verifyRequest(request);
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") ?? "newest";
    const result = await searchOrdersAdmin({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      payment: searchParams.get("payment") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      sort: SORTS.has(sort)
        ? (sort as "newest" | "oldest" | "total-desc" | "total-asc")
        : "newest",
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 20,
    });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("GET /api/admin/orders failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
