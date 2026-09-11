"use client";

import { createContext, useContext, type ReactNode } from "react";

type AdminContextValue = {
  csrfToken: string;
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({
  csrfToken,
  children,
}: {
  csrfToken: string;
  children: ReactNode;
}) {
  const adminFetch = (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set("x-csrf-token", csrfToken);
    // Let the browser set the multipart boundary for FormData uploads — only
    // default to JSON for plain bodies.
    const isBinaryBody =
      typeof FormData !== "undefined" &&
      (options.body instanceof FormData ||
        options.body instanceof Blob ||
        options.body instanceof ArrayBuffer);
    if (options.body && !isBinaryBody && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(url, { ...options, headers });
  };

  return (
    <AdminContext.Provider value={{ csrfToken, adminFetch }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
