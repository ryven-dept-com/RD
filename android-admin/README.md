# RYVEN DEPT — Private Admin App (Android)

A **private, admin-only Android app** for the RYVEN DEPT store owner. It is a
native client for the **existing** Next.js backend — same APIs, same database,
same authentication, same products/orders/delivery/analytics. It is **not** a
customer-facing app and it must **not** be published on the Play Store.

## What it does

| Screen | Data source (existing backend) |
|---|---|
| Admin Login | `POST /api/admin/login` (scrypt password check, session cookie + CSRF token) |
| Dashboard (today's orders / revenue / new / pending / products sold) | `GET /api/admin/dashboard` (real orders, Africa/Algiers day boundary) |
| Orders (search + status filters: New, Confirmed, Preparing, Shipped, Delivered, Cancelled, Returned) | `GET /api/admin/orders` |
| Order Details (customer, wilaya/commune, items + variants, totals, delivery method/price, order + delivery status, notes, history, status update) | `GET/PATCH /api/admin/orders/{id}` + notes/events |
| Products (list, stock, variants, status) | `GET /api/admin/products` |
| Notifications (new-order alerts + history) | `GET /api/admin/notifications` |
| Device registration (for push) | `POST /api/admin/devices` |

Languages: **English, French, Arabic** (full RTL when Arabic is the device
language). The storefront website is untouched by all of this.

## Security model

- **No guest access.** The app shows only the login screen until the backend
  accepts the admin credentials. There is no registration flow and no customer
  accounts.
- **Server-side authorization.** Every request sends the session cookie and the
  session-bound `x-csrf-token`; the backend rejects anything unauthenticated
  (401). The UI never gates data by itself.
- **No secrets in the app.** The bundle contains only the public API base URL.
  Database credentials, `ADMIN_SECRET`, Meta Pixel/CAPI tokens and FCM server
  keys stay on the server (Vercel environment variables).
- **HTTPS only** (`android:usesCleartextTraffic="false"`).
- Push notifications carry only the **order number + total** (no customer PII);
  the full order is fetched only inside the authenticated app.

## Building the APK (private distribution)

Requirements on the build machine: [Android Studio](https://developer.android.com/studio)
(Koala or newer) or JDK 17 + Android SDK command-line tools.

### Option A — Android Studio (recommended)

1. Open this `android-admin` folder in Android Studio (it is the Gradle root).
2. Let Gradle sync finish (first sync downloads dependencies).
3. **Build → Build App Bundle(s)/APK(s) → Build APK(s)**.
4. The private artifact appears at:
   `android-admin/app/build/outputs/apk/debug/app-debug.apk`

The **debug APK is the intended private artifact** — it is signed with the
standard Android debug keystore and installs on any Android 8.0+ device.

### Option B — Command line

```bash
cd android-admin
# once, to create the Gradle wrapper:
gradle wrapper --gradle-version 8.7
./gradlew assembleDebug
# artifact: app/build/outputs/apk/debug/app-debug.apk
```

To target a different deployment (staging, etc.):

```bash
./gradlew assembleDebug -PryvenApiBaseUrl=https://your-store.example
```

The default base URL is `https://ryven-com-ten.vercel.app` (see
`gradle.properties`).

### Optional: signed release build

Fill the `RYVEN_KEYSTORE_*` properties in `gradle.properties` (or pass them
with `-P`), create the keystore once with
`keytool -genkeypair -keystore ryven-admin.keystore -alias ryven-admin -keyalg RSA -keysize 2048 -validity 10000`,
then run `./gradlew assembleRelease`.

## Installing on the owner's phone

1. Transfer `app-debug.apk` to the phone (USB cable, Drive link, WhatsApp to
   yourself, email — any private channel).
2. Open the APK file on the phone. Android shows *“Install unknown apps”* —
   allow it for that one source and confirm the install.
3. Open **RYVEN DEPT Admin** and sign in with the store's admin credentials
   (the same account used on the website's `/admin`).
4. On Android 13+ the app asks once for the *Notifications* permission — allow
   it to receive new-order alerts.

To update later, rebuild and install the new APK over the existing one (same
applicationId → in-place update, session kept).

## Enabling push notifications (FCM)

Push is **optional** — without it the app still shows every notification in
the in-app Alerts tab. To enable real push:

1. Create a Firebase project at https://console.firebase.google.com.
2. **Add app → Android**, package name `com.ryvendept.admin`.
3. Copy three values from *Project settings* into
   `app/src/main/res/values/strings.xml`:
   - `fcm_sender_id` → “Project ID number” (Sender ID)
   - `fcm_application_id` → “App ID” (`1:…:android:…`)
   - `fcm_project_id` → “Project ID”
4. Rebuild the APK (above) and install it.
5. On the **server** (Vercel → Project → Settings → Environment variables),
   set **one** of:
   - `FCM_SERVICE_ACCOUNT_JSON` — the single-line service-account JSON
     (Firebase Console → Project settings → Service accounts → *Generate new
     private key*), preferred; or
   - `FCM_SERVER_KEY` — legacy server key (Cloud Messaging tab).
6. Redeploy the website backend and sign in to the app once — the app
   registers the device (`POST /api/admin/devices`). New customer orders now
   push an alert titled **“RYVEN DEPT — New Order”**; tapping it opens that
   order's details.

Notes:

- These Firebase values are public identifiers (they also ship in every app
  using FCM). The **server keys stay on the server only**.
- Notifications are recorded in the database either way, so an offline device
  catches up via FCM's store-and-forward and the in-app history; duplicates
  are impossible (one notification per order, enforced server-side).

## Project layout

```
android-admin/
├── settings.gradle.kts / build.gradle.kts / gradle.properties
└── app/
    ├── build.gradle.kts          # API base URL via -PryvenApiBaseUrl
    └── src/main/
        ├── AndroidManifest.xml   # HTTPS-only, RTL, no exported activities
        └── java/com/ryvendept/admin/
            ├── AdminApp.kt             # notification channel, Firebase init
            ├── SessionStore.kt         # private session storage
            ├── ApiClient.kt            # cookie + CSRF authenticated client
            ├── DeviceRegistrar.kt      # admin device registration
            ├── PushService.kt          # FCM handler (admin alerts only)
            ├── LoginActivity.kt / MainActivity.kt / OrderDetailsActivity.kt
            ├── Adapters.kt / Models.kt
            └── res/                    # EN + FR + AR strings, RTL-ready
```
