import { db } from "@/db";
import { products } from "@/db/schema";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getCmsData } from "@/lib/cms";

export const dynamic = "force-dynamic";

/** Full CMS snapshot + product options for the admin editor. Session only. */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [cms, productRows] = await Promise.all([
      getCmsData(),
      db
        .select({ id: products.id, name: products.name, image: products.images })
        .from(products)
        .orderBy(products.name),
    ]);
    return Response.json({
      ok: true,
      cms,
      products: productRows.map((p) => ({
        id: p.id,
        name: p.name,
        image: p.image[0] ?? "",
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/cms failed:", err);
    return Response.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
