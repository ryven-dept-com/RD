"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/context/admin-context";

type PushConfig = {
  ok: boolean;
  enabled: boolean;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    messagingSenderId: string;
    appId: string;
  };
  vapidKey: string;
};

type DeviceRow = {
  id: number;
  provider: string;
  tokenMasked: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string;
};

type Status = "idle" | "working" | "done" | "denied" | "unsupported" | "error";

function deviceLabel(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const mobile = /Mobi|Android|iPhone|iPad/i.test(ua) ? "Mobile" : "Desktop";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  return `${mobile} · ${browser}`;
}

export function PushNotificationsCard() {
  const { adminFetch } = useAdmin();
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function fetchDevices(): Promise<DeviceRow[]> {
    try {
      const res = await adminFetch("/api/admin/devices");
      const json = await res.json();
      if (res.ok && json.ok) return json.devices ?? [];
    } catch {
      // non-fatal: the card still works for subscribing
    }
    return [];
  }

  const loadDevices = useCallback(async () => {
    setDevices(await fetchDevices());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminFetch]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/push/config")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setConfig(json);
      })
      .catch(() => {
        if (!cancelled)
          setConfig({
            ok: true,
            enabled: false,
            firebase: { apiKey: "", authDomain: "", projectId: "", messagingSenderId: "", appId: "" },
            vapidKey: "",
          });
      });
    adminFetch("/api/admin/devices")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.ok) setDevices(json.devices ?? []);
      })
      .catch(() => {
        // non-fatal: the card still works for subscribing
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enable() {
    setStatus("working");
    setMessage("");
    try {
      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        !("serviceWorker" in navigator)
      ) {
        setStatus("unsupported");
        return;
      }
      const cfg = config;
      if (!cfg?.enabled) {
        setStatus("error");
        setMessage(
          "Web push is not configured on this deployment. Set the Firebase production environment variables (FCM_SERVICE_ACCOUNT_JSON, NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID, NEXT_PUBLIC_FIREBASE_VAPID_KEY) and redeploy.",
        );
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      // Register the lightweight push service worker (no storefront logic).
      const registration =
        (await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js")) ??
        (await navigator.serviceWorker.register("/firebase-messaging-sw.js"));

      // Firebase Web SDK is loaded ONLY here, on demand, in the admin.
      const [{ getApps, initializeApp, getApp }, { getMessaging, getToken }] =
        await Promise.all([
          import("firebase/app"),
          import("firebase/messaging"),
        ]);
      const app = getApps().length
        ? getApp()
        : initializeApp({
            apiKey: cfg.firebase.apiKey,
            authDomain: cfg.firebase.authDomain,
            projectId: cfg.firebase.projectId,
            messagingSenderId: cfg.firebase.messagingSenderId,
            appId: cfg.firebase.appId,
          });
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: cfg.vapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!token) {
        setStatus("error");
        setMessage("No push token returned by Firebase for this browser.");
        return;
      }

      const res = await adminFetch("/api/admin/devices", {
        method: "POST",
        body: JSON.stringify({
          provider: "fcm",
          token,
          deviceName: deviceLabel(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setStatus("error");
        setMessage(json?.error || "Device registration failed.");
        return;
      }
      setStatus("done");
      await loadDevices();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Subscription failed.");
    }
  }

  async function remove(id: number) {
    const res = await adminFetch("/api/admin/devices", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    if (res.ok) await loadDevices();
  }

  const supported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator;

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide">
            Order push notifications — Notifications de commandes
          </h2>
          <p className="mt-1 text-xs text-black/55">
            New orders are pushed to this device even when the site is closed.
            Notifications contain only the order number, total and status.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={enable}
          disabled={status === "working" || !supported}
          className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-bone transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {status === "working"
            ? "Enabling…"
            : "Enable notifications on this device"}
        </button>
        {status === "done" && (
          <span className="text-sm font-semibold text-green-700">
            ✓ This device is now registered.
          </span>
        )}
        {status === "denied" && (
          <span className="text-sm font-medium text-red-600">
            Notification permission was denied. Allow notifications for this
            site in your browser settings, then try again.
          </span>
        )}
        {!supported && (
          <span className="text-sm font-medium text-red-600">
            This browser does not support web push notifications.
          </span>
        )}
        {status === "error" && message && (
          <span className="max-w-xl text-sm font-medium text-red-600">{message}</span>
        )}
      </div>

      {devices.length > 0 && (
        <div className="mt-4 border-t border-black/10 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-black/50">
            Registered admin devices ({devices.length})
          </h3>
          <ul className="mt-2 space-y-1.5">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 text-xs text-black/70"
              >
                <span className="truncate">
                  {d.deviceName || "Device"} — <code>{d.tokenMasked}</code>
                </span>
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  className="shrink-0 rounded-md border border-black/15 px-2 py-1 font-medium text-black/60 hover:bg-black/5"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
