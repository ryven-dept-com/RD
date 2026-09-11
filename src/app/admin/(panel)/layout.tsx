import type { ReactNode } from "react";
import { getCsrfToken, requireAdmin } from "@/lib/admin-auth";
import { AdminProvider } from "@/context/admin-context";
import { AdminSidebar, AdminTopbar } from "@/components/admin/admin-nav";

export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await requireAdmin();
  const csrf = await getCsrfToken();

  return (
    <AdminProvider csrfToken={csrf}>
      <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
        {/* fixed sidebar (desktop) */}
        <aside className="fixed inset-y-0 left-0 hidden w-64 bg-slate-900 lg:block">
          <AdminSidebar displayName={admin.displayName} />
        </aside>

        <div className="lg:pl-64">
          <AdminTopbar displayName={admin.displayName} />
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </div>
      </div>
    </AdminProvider>
  );
}
