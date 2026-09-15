import type { Metadata } from "next";
import { HealthClient } from "./health-client";

export const metadata: Metadata = { title: "Storefront Health · Admin" };
export const dynamic = "force-dynamic";

/** Admin → Storefront → Health: diagnostics, scores, safe auto-fix, REPAIR. */
export default function HealthPage() {
  return <HealthClient />;
}
