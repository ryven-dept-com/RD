import type { Metadata } from "next";
import { getBuilderStore } from "@/lib/builder/storage";
import { BuilderClient } from "./builder-client";

export const metadata: Metadata = { title: "Storefront Builder · Admin" };
export const dynamic = "force-dynamic";

/**
 * Admin → Storefront Builder. Server-enforced admin session (panel layout);
 * the client island talks only to CSRF-checked /api/admin/builder routes.
 */
export default async function BuilderPage() {
  const store = await getBuilderStore();
  return <BuilderClient initial={store} />;
}
