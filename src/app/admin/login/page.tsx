import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin Login" };

export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white font-display text-2xl text-slate-900">
            R
          </div>
          <h1 className="font-display text-2xl tracking-wide text-white">
            RUVEN DEPT — ADMIN
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Sign in to manage the store
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Protected area · Authorized personnel only
        </p>
      </div>
    </div>
  );
}
