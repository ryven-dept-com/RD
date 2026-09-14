export const dynamic = "force-dynamic";

/**
 * Public Web Push configuration for the ADMIN subscribe flow.
 *
 * Everything returned here is PUBLIC BY DESIGN (Firebase web config +
 * VAPID public key). Server credentials (FCM_SERVICE_ACCOUNT_JSON,
 * private keys, access tokens) are never part of this response — push
 * sending happens exclusively on the server.
 *
 * Env access uses bracket notation on purpose: NEXT_PUBLIC_* references are
 * statically inlined into production builds, which would freeze values at
 * build time; bracket reads stay dynamic so values configured in the host
 * (Vercel Production env vars) apply on the next deploy/restart.
 *
 * When the environment is not fully configured, `enabled` is false and the
 * admin UI shows setup guidance instead of a broken subscribe flow.
 */
export async function GET() {
  const env = process.env;
  const read = (...keys: string[]) => {
    for (const k of keys) {
      const v = env[k];
      if (v && v.trim()) return v.trim();
    }
    return "";
  };

  const serviceAccountSet = Boolean(read("FCM_SERVICE_ACCOUNT_JSON"));
  const firebase = {
    apiKey: read("NEXT_PUBLIC_FIREBASE_API_KEY", "FIREBASE_WEB_API_KEY"),
    authDomain:
      read("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "FIREBASE_WEB_AUTH_DOMAIN") ||
      (read("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "FIREBASE_WEB_PROJECT_ID")
        ? `${read("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "FIREBASE_WEB_PROJECT_ID")}.firebaseapp.com`
        : ""),
    projectId: read("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "FIREBASE_WEB_PROJECT_ID"),
    messagingSenderId: read(
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      "FIREBASE_WEB_MESSAGING_SENDER_ID",
    ),
    appId: read("NEXT_PUBLIC_FIREBASE_APP_ID", "FIREBASE_WEB_APP_ID"),
  };
  const vapidKey = read("NEXT_PUBLIC_FIREBASE_VAPID_KEY", "FCM_VAPID_KEY");
  const enabled =
    serviceAccountSet &&
    Boolean(firebase.apiKey) &&
    Boolean(firebase.projectId) &&
    Boolean(firebase.messagingSenderId) &&
    Boolean(firebase.appId) &&
    Boolean(vapidKey);

  return Response.json(
    { ok: true, enabled, firebase, vapidKey },
    { headers: { "Cache-Control": "no-store" } },
  );
}
