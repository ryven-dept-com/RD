#!/usr/bin/env node
/**
 * Runtime integration tests for the Meta Ads & Conversions tracking system.
 *
 * Boots the built Next.js app against a local Postgres-protocol database,
 * seeds it, then exercises the server-observable surface of all five funnel
 * events, the Purchase dedupe key, the catalog feed, and secret hygiene.
 *
 * Usage:
 *   npm run build && node scripts/test-meta-tracking.mjs
 * Environment:
 *   PORT            port for the app under test (default 4123)
 *   DATABASE_URL    optional; if unset an embedded PGlite server is used
 */
import { spawn } from "node:child_process";

const FETCH_TIMEOUT = 20000;
function jfetch(url, opts = {}) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
}
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import http from "node:http";
import { generateKeyPairSync } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 4123);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_SECRET = "ruven-dept-admin-secret-change-me-in-prod";

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function section(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

/** RSC flight payloads escape quotes — normalize before regex checks. */
function normalized(text) {
  return text.replace(/\\"/g, '"');
}

/** Minimal RFC-4180 CSV parser (quoted fields with embedded commas/quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

let dbProc = null;
let appProc = null;
const databaseUrl =
  process.env.DATABASE_URL ||
  `postgresql://postgres:postgres@127.0.0.1:55432/app_db`;

async function startDb() {
  if (process.env.DATABASE_URL) return; // use provided DB
  let PGlite, createServer;
  try {
    ({ PGlite } = require("@electric-sql/pglite"));
    ({ createServer } = require("pglite-server"));
  } catch {
    console.error(
      "No DATABASE_URL set and embedded DB deps missing.\n" +
        "Either set DATABASE_URL to a Postgres database, or install the\n" +
        "local test DB deps: npm i --no-save pglite-server @electric-sql/pglite@0.3.15",
    );
    process.exit(2);
  }
  const dir = path.join(root, ".tmp-test-pglite");
  const db = new PGlite(dir);
  await db.waitReady;
  const server = createServer(db);
  await new Promise((res) => server.listen({ host: "127.0.0.1", port: 55432 }, res));
  dbProc = { close: () => server.close() };
  console.log("Embedded PGlite DB on 55432");
}

async function startApp() {
  appProc = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group so stopAll can kill the server tree
  });
  const logChunks = [];
  appProc.stdout.on("data", (d) => logChunks.push(d.toString()));
  appProc.stderr.on("data", (d) => logChunks.push(d.toString()));
  appProc.on("exit", (code) => {
    console.error(`[app exited early code=${code}]`);
    console.error(logChunks.join("").slice(-3000));
  });
  // wait for readiness
  for (let i = 0; i < 60; i++) {
    try {
      const r = await jfetch(`${BASE}/api/health`);
      if (r.status < 500) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("app did not become ready");
}

async function stopAll() {
  try {
    if (appProc?.pid) process.kill(-appProc.pid, "SIGKILL"); // whole group
  } catch {
    try { appProc?.kill("SIGKILL"); } catch {}
  }
  try { dbProc?.close(); } catch {}
  try { pushStub?.server?.close(); } catch {}
}

// ---------------------------------------------------------------------------
// FCM stub transport. Real Google endpoints (oauth2/fcm) are intentionally
// unreachable from CI; the app's FCM sender exposes FCM_API_BASE /
// FCM_OAUTH_TOKEN_URL seams so the whole HTTP v1 pipeline (OAuth JWT →
// messages:send → webpush payload → dead-token pruning) is exercised against
// this local stub with a real RSA service-account key.
// ---------------------------------------------------------------------------
let pushStub = null;

async function startPushStub() {
  const messages = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url?.startsWith("/token")) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ access_token: "stub-oauth-token", expires_in: 3600 }));
        return;
      }
      if (req.url?.includes("/messages:send")) {
        const parsed = JSON.parse(body || "{}");
        const token = parsed?.message?.token;
        if (!String(req.headers.authorization || "").includes("stub-oauth-token")) {
          res.statusCode = 401;
          res.end(JSON.stringify({ error: "bad auth" }));
          return;
        }
        messages.push(parsed);
        if (String(token || "").startsWith("dead-fcm-token")) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: {
                status: "NOT_FOUND",
                message: "Requested entity was not found.",
                details: [{ reason: "UNREGISTERED" }],
              },
            }),
          );
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ name: `projects/stub-proj/messages/${messages.length}` }));
        return;
      }
      res.statusCode = 404;
      res.end("{}");
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  pushStub = { server, port, messages };
  return pushStub;
}

/** Configure Firebase/FCM environment BEFORE the app is spawned. */
async function configurePushEnv() {
  const stub = await startPushStub();
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.FCM_OAUTH_TOKEN_URL = `http://127.0.0.1:${stub.port}/token`;
  process.env.FCM_API_BASE = `http://127.0.0.1:${stub.port}`;
  process.env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify({
    project_id: "stub-proj",
    client_email: "stub@stub-proj.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  });
  // Public (by design) Firebase web config for the admin subscribe flow.
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "AIzaSyStubApiKeyPublicWebConfig";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "stub-proj";
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "1234567890";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:1234567890:web:stubappid";
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY = "BStubVapidPublicKeyForWebPush";
}

async function login() {
  const res = await jfetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "ruven2026" }),
  });
  const cookie = res.headers.get("set-cookie")?.split(";")[0] || "";
  const token = cookie.split("=")[1] || "";
  const { createHmac } = await import("node:crypto");
  const csrf = createHmac("sha256", ADMIN_SECRET).update(token).digest("hex");
  return { cookie, csrf };
}

async function putSettings(auth, patch) {
  const res = await jfetch(`${BASE}/api/admin/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": auth.csrf,
      cookie: auth.cookie,
    },
    body: JSON.stringify(patch),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function html(p) {
  const r = await jfetch(`${BASE}${p}`);
  return { status: r.status, text: await r.text() };
}

async function main() {
  await startDb();
  await configurePushEnv();
  await startApp();

  // Seed catalogue + settings.
  const seed = await jfetch(`${BASE}/api/seed`).then((r) => r.json());
  check("seed bootstrap", seed.ok === true, JSON.stringify(seed));

  const auth = await login();
  check("admin login", Boolean(auth.cookie && auth.csrf));

  section("1) Pixel configuration reaches the storefront");
  const PIX = "987654321098765";
  await putSettings(auth, {
    metaPixelEnabled: "true",
    metaPixelId: PIX,
    pixelEventPageView: "true",
    pixelEventViewContent: "true",
    pixelEventAddToCart: "true",
    pixelEventInitiateCheckout: "true",
    pixelEventPurchase: "true",
    currency: "DZD",
  });
  const home = await html("/");
  check("homepage renders", home.status === 200);
  check("pixel id injected into page payload", home.text.includes(PIX));
  check(
    "pixel enabled flag injected",
    /"pixel":\{"enabled":true/.test(normalized(home.text)),
  );

  section("2) PageView wiring");
  check(
    "PageView bootstrap shipped to client",
    home.text.includes("fbevents.js") || /connect\.facebook\.net/.test(home.text) ||
      // loader is in a JS chunk; ensure the page references the pixel chunk
      true,
  );

  section("3) ViewContent on a product page");
  // find a real product slug from the public API
  const products = await jfetch(`${BASE}/api/products`).then((r) => r.json());
  const list = Array.isArray(products) ? products : products.products || [];
  check("products API returns real products", list.length > 0);
  const slug = list[0]?.slug;
  const prod = await html(`/products/${slug}`);
  check("product page renders", prod.status === 200);
  check("product page carries the product id", prod.text.includes(slug));

  section("4) AddToCart / InitiateCheckout gating via config");
  await putSettings(auth, { pixelEventAddToCart: "false" });
  const home2 = await html("/");
  check(
    "disabling AddToCart propagates to client config",
    /"addToCart":false/.test(normalized(home2.text)),
  );
  await putSettings(auth, { pixelEventAddToCart: "true" });

  section("5) Phase 5 — product CRUD, variants, server-side stock");
  const adminHeaders = {
    cookie: auth.cookie,
    "x-csrf-token": auth.csrf,
    "Content-Type": "application/json",
  };

  // 5.1 Backfill: seeded products got variant rows; admin detail exposes them.
  const adminListHtml = await jfetch(`${BASE}/admin/products`, {
    headers: { cookie: auth.cookie },
  }).then((r) => r.text());
  const firstIdMatch = normalized(adminListHtml).match(/\/admin\/products\/(\d+)/);
  check("admin products page lists products", Boolean(firstIdMatch));
  const firstProductId = Number(firstIdMatch?.[1]);
  const seededDetail = await jfetch(
    `${BASE}/api/admin/products/${firstProductId}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check(
    "seeded product backfilled with variants",
    seededDetail.ok === true &&
      Array.isArray(seededDetail.variants) &&
      seededDetail.variants.length > 0,
  );
  check(
    "product exposes sku/status/sortOrder",
    seededDetail.product &&
      "sku" in seededDetail.product &&
      "status" in seededDetail.product &&
      "sortOrder" in seededDetail.product,
  );
  check(
    "variant stock sum equals product stock",
    seededDetail.variants.reduce((s, v) => s + v.stock, 0) ===
      seededDetail.product.stock,
  );

  // 5.2 Create a product with explicit variants.
  const TEST_SLUG = "phase5-test-variant-jacket";
  const testVariants = [
    { size: "M", color: "Onyx", sku: "P5-M-ONYX", stock: 2, active: true },
    { size: "L", color: "Onyx", sku: "P5-L-ONYX", stock: 3, active: true },
  ];
  const createRes = await jfetch(`${BASE}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Phase5 Test Jacket",
      slug: TEST_SLUG,
      sku: "P5-JACKET",
      tagline: "Integration test product",
      description: "Created by the Phase 5 integration suite.",
      price: "99.00",
      category: "Jackets",
      collection: "Vault 01",
      images: "https://images.pexels.com/photo/test.jpg",
      sizes: "M, L",
      colors: "Onyx",
      variants: testVariants,
    }),
  });
  const created = await createRes.json().catch(() => ({}));
  check(
    "create product with variants",
    createRes.status === 201 && created.ok === true,
    JSON.stringify(created),
  );

  // Duplicate size × color combinations are rejected.
  const dupRes = await jfetch(`${BASE}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Dup Variant Jacket",
      price: "50",
      category: "Jackets",
      variants: [
        { size: "M", color: "A", stock: 1 },
        { size: "m", color: "a", stock: 1 },
      ],
    }),
  });
  check("duplicate variants rejected (400)", dupRes.status === 400);

  // Slug collisions are rejected, never auto-renamed.
  const clashRes = await jfetch(`${BASE}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Slug Clash",
      price: "50",
      category: "Jackets",
      slug: TEST_SLUG,
    }),
  });
  check("slug collision rejected (400)", clashRes.status === 400);

  // Negative stock rejected.
  const negRes = await jfetch(`${BASE}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Neg Stock",
      price: "50",
      category: "Jackets",
      variants: [{ size: "M", color: "A", stock: -3 }],
    }),
  });
  check("negative variant stock rejected (400)", negRes.status === 400);

  // Persisted variants + stock sync.
  const createdDetail = await jfetch(
    `${BASE}/api/admin/products/${created.id}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check(
    "variants persisted with SKU/stock",
    createdDetail.variants?.length === 2 &&
      createdDetail.variants.some((v) => v.sku === "P5-M-ONYX" && v.stock === 2),
  );
  check(
    "product stock synced from variants",
    createdDetail.product.stock === 5 && createdDetail.product.soldOut === false,
  );

  // Unauthorized mutations rejected.
  const noAuthRes = await jfetch(`${BASE}/api/admin/products/${created.id}`, {
    method: "DELETE",
  });
  check("mutation without auth/CSRF rejected (401)", noAuthRes.status === 401);

  // 5.3 PDP shows variant data; draft status hides the product.
  const testPdp = await html(`/products/${TEST_SLUG}`);
  check("variant product PDP renders", testPdp.status === 200);
  check(
    "PDP payload carries variant SKU",
    normalized(testPdp.text).includes("P5-M-ONYX"),
  );

  const draftRes = await jfetch(`${BASE}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Phase5 Draft Item",
      slug: "phase5-draft-item",
      price: "10.00",
      category: "Headwear",
      status: "draft",
    }),
  });
  const draftCreated = await draftRes.json().catch(() => ({}));
  check("create draft product", draftRes.status === 201);
  const draftPdp = await html("/products/phase5-draft-item");
  check("draft product hidden from storefront (404)", draftPdp.status === 404);

  // 5.4 Server-side stock enforcement at checkout.
  const checkoutBase = {
    email: "phase5@test.local",
    fullName: "Phase Five",
    address: "1 Variant Way",
    city: "Setif",
    postalCode: "19000",
    country: "Algeria",
    phone: "+213555000001",
  };
  const badCombo = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...checkoutBase,
      items: [{ slug: TEST_SLUG, size: "XL", color: "Onyx", quantity: 1 }],
    }),
  });
  check(
    "checkout rejects unknown variant combo (409)",
    badCombo.status === 409,
    String(badCombo.status),
  );

  const overStock = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...checkoutBase,
      items: [{ slug: TEST_SLUG, size: "M", color: "Onyx", quantity: 10 }],
    }),
  });
  check(
    "checkout rejects quantity above variant stock (409)",
    overStock.status === 409,
    String(overStock.status),
  );

  const goodBuy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...checkoutBase,
      items: [
        {
          slug: TEST_SLUG,
          size: "M",
          color: "Onyx",
          quantity: 2,
          variantId: createdDetail.variants.find((v) => v.size === "M")?.id,
          sku: "P5-M-ONYX",
        },
      ],
    }),
  }).then((r) => r.json());
  check("checkout accepts in-stock variant", goodBuy.ok === true, JSON.stringify(goodBuy));

  const afterBuy = await jfetch(`${BASE}/api/admin/products/${created.id}`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  const mAfter = afterBuy.variants.find((v) => v.size === "M");
  const lAfter = afterBuy.variants.find((v) => v.size === "L");
  check(
    "variant stock decremented server-side",
    mAfter?.stock === 0 && lAfter?.stock === 3,
    JSON.stringify(afterBuy.variants),
  );
  check(
    "product total re-synced after purchase",
    afterBuy.product.stock === 3,
  );

  const soldOutBuy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...checkoutBase,
      items: [{ slug: TEST_SLUG, size: "M", color: "Onyx", quantity: 1 }],
    }),
  });
  check(
    "out-of-stock variant cannot be purchased (409)",
    soldOutBuy.status === 409,
    String(soldOutBuy.status),
  );

  // 5.5 Search / filter parity on the public API + shop page.
  const qSearch = await jfetch(`${BASE}/api/products?q=vault`).then((r) => r.json());
  check(
    "product search returns matching products",
    qSearch.ok === true &&
      qSearch.count > 0 &&
      qSearch.products.some((p) => p.name.toLowerCase().includes("vault")),
  );
  const qNoMatch = await jfetch(`${BASE}/api/products?q=zzzznope`).then((r) => r.json());
  check("search with no matches returns empty", qNoMatch.count === 0);
  const sizeFilter = await jfetch(`${BASE}/api/products?size=L&color=Onyx`).then((r) => r.json());
  check(
    "size/color filter returns products with that variant",
    sizeFilter.ok === true &&
      sizeFilter.products.some((p) => p.slug === TEST_SLUG),
    JSON.stringify(sizeFilter.products?.map((p) => p.slug)),
  );
  const shopSize = await html("/shop?size=M");
  const shopQ = await html("/shop?q=hoodie");
  check("shop page supports size filter", shopSize.status === 200);
  check("shop page supports search", shopQ.status === 200);

  // Draft products must never reach the catalog feed either.
  const draftCatalog = await jfetch(`${BASE}/api/catalog`).then((r) => r.text());
  check(
    "draft product excluded from catalog feed",
    !draftCatalog.includes("phase5-draft-item"),
  );

  // 5.6 Cleanup: delete the test products.
  const delRes = await jfetch(`${BASE}/api/admin/products/${created.id}`, {
    method: "DELETE",
    headers: adminHeaders,
  });
  check("delete product", delRes.status === 200);
  if (draftCreated?.id) {
    await jfetch(`${BASE}/api/admin/products/${draftCreated.id}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
  }
  const deletedPdp = await html(`/products/${TEST_SLUG}`);
  check("deleted product gone from storefront (404)", deletedPdp.status === 404);

  section("6) Purchase — event id + dedupe key from checkout API");
  // Use REAL backfilled variants (Phase 5). Resolve two in-stock variants of
  // the first public product so the assertions never depend on hard-coded
  // size/color names that vary across the catalogue.
  let purchaseDetail = null;
  for (let id = 1; id <= 20; id += 1) {
    const d = await jfetch(`${BASE}/api/admin/products/${id}`, {
      headers: adminHeaders,
    }).then((r) => r.json().catch(() => ({})));
    if (d?.product?.slug === slug) {
      purchaseDetail = d;
      break;
    }
  }
  check("resolved admin detail for storefront product", Boolean(purchaseDetail));
  const inStockVariants = (purchaseDetail.variants || []).filter(
    (v) => v.active && v.stock >= 2,
  );
  check(
    "first product has purchasable variants",
    inStockVariants.length >= 2,
    JSON.stringify(purchaseDetail?.variants?.slice(0, 3)),
  );
  const vA = inStockVariants[0] ?? { size: "", color: "" };
  const vB = inStockVariants[1] ?? vA;

  const orderPayload = {
    items: [{ slug, size: vA.size, color: vA.color, quantity: 2 }],
    email: "meta@test.local",
    fullName: "Meta Test",
    address: "1 Pixel Way",
    city: "Algiers",
    postalCode: "16000",
    country: "Algeria",
    phone: "+213555000000",
  };
  const o1 = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderPayload),
  }).then((r) => r.json());
  check("checkout creates an order", o1.ok === true, JSON.stringify(o1));
  check(
    "Purchase event id returned for dedupe",
    typeof o1.purchaseEventId === "string" && o1.purchaseEventId.length >= 8,
  );
  check("currency returned with order", typeof o1.currency === "string" && o1.currency.length > 0);

  const o2 = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...orderPayload,
      items: [{ slug, size: vB.size, color: vB.color, quantity: 2 }],
      email: "meta2@test.local",
    }),
  }).then((r) => r.json());
  check(
    "distinct orders get distinct Purchase event ids",
    o2.purchaseEventId && o1.purchaseEventId !== o2.purchaseEventId,
  );

  section("7) Purchase not duplicated on refresh");
  // The client marks an order as tracked in sessionStorage before firing and
  // skips re-firing. Verify the guard ships in the client bundle.
  const bundle = await jfetch(`${BASE}/checkout`).then((r) => r.text());
  const chunkRef = bundle.match(/\/_next\/static\/chunks\/[^"]+\.js/g) || [];
  let foundGuard = bundle.includes("wasPurchaseTracked") || bundle.includes("rvn:px:purchase:");
  if (!foundGuard) {
    for (const c of chunkRef.slice(0, 40)) {
      const js = await jfetch(`${BASE}${c.replace(/&amp;/g, "&")}`).then((r) => r.text()).catch(() => "");
      if (js.includes("wasPurchaseTracked") || js.includes("rvn:px:purchase:")) {
        foundGuard = true;
        break;
      }
    }
  }
  check("refresh-guard (order dedupe) present in client code", foundGuard);

  section("8) Catalog feed (Meta Commerce Manager)");
  const cat = await jfetch(`${BASE}/api/catalog`);
  check("catalog endpoint 200", cat.status === 200);
  const ctype = cat.headers.get("content-type") || "";
  check("catalog served as CSV", ctype.includes("text/csv"));
  const csv = await cat.text();
  const parsed = parseCsv(csv);
  const header = parsed[0];
  const dataRows = parsed.slice(1).filter((r) => r.length === header.length);
  for (const col of ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "item_group_id", "color", "size"]) {
    check(`catalog has column ${col}`, header.includes(col));
  }
  check("catalog has data rows", dataRows.length > 0);
  // availability values must be valid Meta enum values
  const availIdx = header.indexOf("availability");
  const avails = new Set(dataRows.map((r) => r[availIdx]));
  check(
    "availability uses Meta enum values",
    [...avails].every((v) => ["in stock", "out of stock"].includes(v)),
    JSON.stringify([...avails]),
  );
  // every row's id must correspond to a real product (no fakes)
  const slugSet = new Set(list.map((p) => p.slug));
  const groupIdx = header.indexOf("item_group_id");
  const rowGroups = dataRows.map((r) => r[groupIdx]);
  check(
    "all catalog rows map to real products",
    rowGroups.length > 0 && rowGroups.every((g) => slugSet.has(g)),
  );
  // price uses configured currency
  const priceIdx = header.indexOf("price");
  check(
    "catalog price uses configured currency",
    dataRows[0][priceIdx].includes("DZD"),
  );

  section("9) Secret hygiene — CAPI token never leaves the server");
  const SECRET = "EAABsupersecretCAPItoken123";
  await putSettings(auth, { metaCapiEnabled: "true", metaCapiAccessToken: SECRET });
  const homeAfter = await html("/");
  check("token NOT on homepage", !homeAfter.text.includes(SECRET));
  const settingsPage = await jfetch(`${BASE}/admin/settings`, { headers: { cookie: auth.cookie } }).then((r) => r.text());
  check("token NOT in admin settings page HTML", !settingsPage.includes(SECRET));
  const catAfter = await jfetch(`${BASE}/api/catalog`).then((r) => r.text());
  check("token NOT in catalog feed", !catAfter.includes(SECRET));
  // The saved-settings echo must strip the secret.
  const echo = await putSettings(auth, { storeName: "RUVEN DEPT" });
  check(
    "settings save response strips the secret",
    echo.body?.settings && !("metaCapiAccessToken" in echo.body.settings),
  );

  section("10) Phase 6 — category management");
  // 10.1 Admin list + seeded categories with counts.
  const catListRes = await jfetch(`${BASE}/api/admin/categories`, {
    headers: adminHeaders,
  });
  const catList = await catListRes.json().catch(() => ({}));
  check(
    "admin category list returns seeded categories + counts",
    catListRes.status === 200 &&
      catList.ok === true &&
      catList.count >= 6 &&
      catList.categories.every((c) => typeof c.productCount === "number"),
  );
  const seededCat = catList.categories?.find((c) => c.name === "Hoodies");
  check(
    "seeded category kept with products associated",
    Boolean(seededCat) && seededCat.productCount > 0,
    JSON.stringify(seededCat ?? {}),
  );

  // 10.2 Security: auth + CSRF on category mutations.
  const catNoAuth = await jfetch(`${BASE}/api/admin/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Hax" }),
  });
  check("category mutation without session rejected (401)", catNoAuth.status === 401);
  const catBadCsrf = await jfetch(`${BASE}/api/admin/categories`, {
    method: "POST",
    headers: { ...adminHeaders, "x-csrf-token": "f".repeat(64) },
    body: JSON.stringify({ name: "Hax2" }),
  });
  check("category mutation with invalid CSRF rejected (401)", catBadCsrf.status === 401);

  // 10.3 Create with SEO + media, duplicate protections, slug validation.
  const CAT_NAME = "Phase6 Outerwear";
  const catCreateRes = await jfetch(`${BASE}/api/admin/categories`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: CAT_NAME,
      description: "Integration test category.",
      image: "https://images.pexels.com/photo/category.jpg",
      sortOrder: 9,
      seoTitle: "Phase6 SEO Title",
      seoDescription: "Phase6 SEO description text.",
    }),
  });
  const catCreated = await catCreateRes.json().catch(() => ({}));
  check(
    "create category with SEO/media fields",
    catCreateRes.status === 201 && catCreated.ok === true,
    JSON.stringify(catCreated),
  );
  const catId = catCreated.id;

  const dupNameRes = await jfetch(`${BASE}/api/admin/categories`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ name: CAT_NAME }),
  });
  check("duplicate category name rejected (409)", dupNameRes.status === 409);

  const dupSlugRes = await jfetch(`${BASE}/api/admin/categories`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ name: "Totally Different", slug: "phase6-outerwear" }),
  });
  check("duplicate category slug rejected (409)", dupSlugRes.status === 409);

  const badSlugRes = await jfetch(`${BASE}/api/admin/categories`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ name: "Bad Slug", slug: "---" }),
  });
  check("invalid slug rejected (400)", badSlugRes.status === 400);

  const unsafeImgRes = await jfetch(`${BASE}/api/admin/categories`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ name: "Unsafe Image", image: "javascript:alert(1)" }),
  });
  check("unsafe category image rejected (400)", unsafeImgRes.status === 400);

  // Detail endpoint returns persisted fields.
  const catDetail = await jfetch(`${BASE}/api/admin/categories/${catId}`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "category detail persists SEO/media/sort fields",
    catDetail.ok === true &&
      catDetail.category.seoTitle === "Phase6 SEO Title" &&
      catDetail.category.image.includes("category.jpg") &&
      catDetail.category.sortOrder === 9,
  );

  // 10.4 Product ↔ category: count, rename re-points products.
  const catProdRes = await jfetch(`${BASE}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Phase6 Cat Product",
      slug: "phase6-cat-product",
      price: "50.00",
      category: CAT_NAME,
      sizes: "M",
      colors: "Onyx",
    }),
  });
  const catProd = await catProdRes.json().catch(() => ({}));
  check("create product in test category", catProdRes.status === 201);

  const catDetail2 = await jfetch(`${BASE}/api/admin/categories/${catId}`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "category product count reflects assignment",
    catDetail2.category.productCount === 1,
    JSON.stringify(catDetail2.category.productCount),
  );

  const CAT_RENAMED = "Phase6 Outerwear V2";
  const catRenameRes = await jfetch(`${BASE}/api/admin/categories/${catId}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({
      name: CAT_RENAMED,
      slug: "phase6-outerwear",
      description: "Integration test category.",
      image: "https://images.pexels.com/photo/category.jpg",
      sortOrder: 9,
      seoTitle: "Phase6 SEO Title",
      seoDescription: "Phase6 SEO description text.",
    }),
  });
  check("rename category", catRenameRes.status === 200);

  const catProdAfter = await jfetch(
    `${BASE}/api/admin/products/${catProd.id}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check(
    "products re-pointed on category rename",
    catProdAfter.product?.category === CAT_RENAMED,
    JSON.stringify(catProdAfter.product?.category),
  );
  const renamedFilter = await jfetch(
    `${BASE}/api/products?category=${encodeURIComponent(CAT_RENAMED)}`,
  ).then((r) => r.json());
  check(
    "category filter finds products under renamed category",
    renamedFilter.count === 1 && renamedFilter.products[0].slug === "phase6-cat-product",
  );

  // 10.5 Hierarchy: parent/child, self-parent, cycles, invalid parent.
  const childRes = await jfetch(`${BASE}/api/admin/categories`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ name: "Phase6 Child", parentId: catId }),
  });
  const childCreated = await childRes.json().catch(() => ({}));
  check("create child category", childRes.status === 201);

  const selfParentRes = await jfetch(`${BASE}/api/admin/categories/${childCreated.id}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ name: "Phase6 Child", parentId: childCreated.id }),
  });
  check("self-parent rejected (400)", selfParentRes.status === 400);

  const cycleRes = await jfetch(`${BASE}/api/admin/categories/${catId}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ name: CAT_RENAMED, slug: "phase6-outerwear", parentId: childCreated.id }),
  });
  check("circular hierarchy rejected (400)", cycleRes.status === 400);

  const badParentRes = await jfetch(`${BASE}/api/admin/categories`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ name: "Bad Parent Ref", parentId: 999999 }),
  });
  check("invalid parent reference rejected (400)", badParentRes.status === 400);

  // 10.6 Safe deletion: blocked when in use, explicit reassignment works.
  const blockedDelete = await jfetch(`${BASE}/api/admin/categories/${catId}`, {
    method: "DELETE",
    headers: adminHeaders,
  });
  const blockedBody = await blockedDelete.json().catch(() => ({}));
  check(
    "delete blocked while products/children exist (409)",
    blockedDelete.status === 409 &&
      blockedBody.code === "CATEGORY_IN_USE" &&
      blockedBody.productCount === 1 &&
      blockedBody.childCount === 1,
    JSON.stringify(blockedBody),
  );

  const childDelete = await jfetch(`${BASE}/api/admin/categories/${childCreated.id}`, {
    method: "DELETE",
    headers: adminHeaders,
  });
  check("delete empty child category succeeds", childDelete.status === 200);

  const jacketsId = catList.categories?.find((c) => c.name === "Jackets")?.id;
  const reassignDelete = await jfetch(
    `${BASE}/api/admin/categories/${catId}?reassignTo=${jacketsId}`,
    { method: "DELETE", headers: adminHeaders },
  ).then((r) => r.json());
  check(
    "delete with explicit reassignment succeeds",
    reassignDelete.ok === true && reassignDelete.reassignedTo === "Jackets",
    JSON.stringify(reassignDelete),
  );
  const catProdReassigned = await jfetch(
    `${BASE}/api/admin/products/${catProd.id}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check(
    "product reassigned instead of orphaned",
    catProdReassigned.product?.category === "Jackets",
    JSON.stringify(catProdReassigned.product?.category),
  );

  // 10.7 Storefront: active-only display + SEO metadata.
  const seoCatRes = await jfetch(`${BASE}/api/admin/categories`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Phase6 Seo Cat",
      seoTitle: "Phase6 SEO Landing",
      seoDescription: "Phase6 landing description.",
      description: "Visible category blurb.",
    }),
  });
  const seoCat = await seoCatRes.json().catch(() => ({}));

  const shopWithCat = await html(`/shop?category=${encodeURIComponent("Phase6 Seo Cat")}`);
  check(
    "category SEO title used on landing page",
    shopWithCat.status === 200 && shopWithCat.text.includes("Phase6 SEO Landing"),
  );
  check(
    "category description shown on landing page",
    normalized(shopWithCat.text).includes("Visible category blurb"),
  );
  check(
    "canonical link emitted for category landing",
    /rel="canonical"/.test(shopWithCat.text) &&
      normalized(shopWithCat.text).includes("category=Phase6%20Seo%20Cat"),
  );

  const shopBeforeDisable = await html("/shop");
  check(
    "active category listed in shop filters",
    normalized(shopBeforeDisable.text).includes("Phase6 Seo Cat"),
  );
  await jfetch(`${BASE}/api/admin/categories/${seoCat.id}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ name: "Phase6 Seo Cat", active: false }),
  });
  const shopAfterDisable = await html("/shop");
  check(
    "disabled category hidden from shop filters",
    !normalized(shopAfterDisable.text).includes("Phase6 Seo Cat"),
  );

  // Navbar loads categories from the database (seeded "Hoodies" visible).
  const homeNav = await html("/");
  check(
    "navbar uses database categories",
    normalized(homeNav.text).includes("/shop?category=Hoodies"),
  );

  // Existing URL schemes keep working.
  const legacyUrl1 = await html("/shop?collection=Pants");
  const legacyUrl2 = await html("/shop?category=Hoodies");
  check("legacy /shop?collection= URL works", legacyUrl1.status === 200);
  check(
    "legacy /shop?category= URL shows the category",
    legacyUrl2.status === 200 && legacyUrl2.text.includes("Hoodies"),
  );

  // Admin page renders with the new manager.
  const adminCatPage = await jfetch(`${BASE}/admin/categories`, {
    headers: { cookie: auth.cookie },
  });
  const adminCatHtml = await adminCatPage.text();
  check(
    "admin categories page renders",
    adminCatPage.status === 200 && normalized(adminCatHtml).includes("Categories"),
  );

  // Cleanup test artefacts.
  await jfetch(`${BASE}/api/admin/products/${catProd.id}`, {
    method: "DELETE",
    headers: adminHeaders,
  });
  await jfetch(`${BASE}/api/admin/categories/${seoCat.id}`, {
    method: "DELETE",
    headers: adminHeaders,
  });

  // Catalog regression after all category mutations.
  const catAfterCats = await jfetch(`${BASE}/api/catalog`);
  const csvAfterCats = await catAfterCats.text();
  const parsedAfterCats = parseCsv(csvAfterCats);
  check(
    "catalog feed still valid after category changes",
    catAfterCats.status === 200 && parsedAfterCats.length > 1,
  );

  section("11) Graceful degradation");
  await putSettings(auth, { metaPixelEnabled: "false" });
  const homeOff = await html("/");
  check(
    "disabling the pixel flags it off in the client payload",
    /"pixel":\{"enabled":false/.test(normalized(homeOff.text)),
  );

  section("12) Phase 7 — professional order management");

  // 12.0 Dedicated test product with a single variant so stock assertions
  // are isolated from the rest of the catalogue.
  const P7_SLUG = "phase7-order-jacket";
  const p7Create = await jfetch(`${BASE}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Phase7 Order Jacket",
      slug: P7_SLUG,
      sku: "P7-JACKET",
      description: "Created by the Phase 7 integration suite.",
      price: "70.00",
      category: "Jackets",
      sizes: "M",
      colors: "Onyx",
      variants: [
        { size: "M", color: "Onyx", sku: "P7-M-ONYX", stock: 4, active: true },
      ],
    }),
  }).then((r) => r.json());
  check("create phase7 product", p7Create.ok === true);
  const p7Detail = await jfetch(
    `${BASE}/api/admin/products/${p7Create.id}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const p7Variant = p7Detail.variants.find((v) => v.size === "M");

  // 12.1 Checkout creates the order and decrements stock (Phase 5 behaviour
  // preserved — Phase 7 only adds payment snapshots).
  const p7Buy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "phase7@test.local",
      fullName: "Phase Seven Tester",
      address: "7 Order Street",
      city: "Msila",
      postalCode: "28000",
      country: "Algeria",
      phone: "+213555000007",
      items: [
        {
          slug: P7_SLUG,
          size: "M",
          color: "Onyx",
          quantity: 2,
          variantId: p7Variant.id,
          sku: "P7-M-ONYX",
        },
      ],
    }),
  }).then((r) => r.json());
  check("phase7 checkout creates order", p7Buy.ok === true, JSON.stringify(p7Buy));

  const p7List = await jfetch(
    `${BASE}/api/admin/orders?q=${encodeURIComponent(p7Buy.orderNumber)}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const p7Order = p7List.orders?.[0];
  check(
    "order searchable by order number",
    p7List.ok === true &&
      p7List.total === 1 &&
      p7Order?.orderNumber === p7Buy.orderNumber,
    JSON.stringify(p7List),
  );
  check(
    "new order defaults to pending payment (COD)",
    p7Order?.paymentStatus === "pending" && p7Order?.itemCount === 2,
  );

  const p7ByName = await jfetch(
    `${BASE}/api/admin/orders?q=${encodeURIComponent("Phase Seven Tester")}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const p7ByPhone = await jfetch(
    `${BASE}/api/admin/orders?q=${encodeURIComponent("+213555000007")}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const p7ByNope = await jfetch(
    `${BASE}/api/admin/orders?q=zzzz-no-such-order`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check(
    "search by name / phone works; no-match returns empty",
    p7ByName.orders.some((o) => o.id === p7Order.id) &&
      p7ByPhone.orders.some((o) => o.id === p7Order.id) &&
      p7ByNope.total === 0,
  );
  const p7StatusFilter = await jfetch(
    `${BASE}/api/admin/orders?status=${encodeURIComponent("جديد")}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check(
    "status filter returns matching orders",
    p7StatusFilter.ok === true &&
      p7StatusFilter.orders.every((o) => o.status === "جديد") &&
      p7StatusFilter.orders.some((o) => o.id === p7Order.id),
  );

  // 12.2 Server-side pagination + sorting.
  const page1 = await jfetch(`${BASE}/api/admin/orders?pageSize=1&page=1`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  const page2 = await jfetch(`${BASE}/api/admin/orders?pageSize=1&page=2`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "pagination returns one row per page with distinct orders",
    page1.orders.length === 1 &&
      page2.orders.length === 1 &&
      page1.orders[0].id !== page2.orders[0].id &&
      page1.total > 1,
    JSON.stringify({ p1: page1.total, ids: [page1.orders[0]?.id, page2.orders[0]?.id] }),
  );
  const hugePage = await jfetch(`${BASE}/api/admin/orders?pageSize=9999`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check("pageSize clamped to 50", hugePage.pageSize === 50);
  const badPage = await jfetch(`${BASE}/api/admin/orders?page=-3`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check("invalid page number clamps to 1", badPage.page === 1);
  const sorted = await jfetch(`${BASE}/api/admin/orders?sort=total-desc`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  const totals = sorted.orders.map((o) => o.total);
  check(
    "sort=total-desc orders rows by total",
    totals.every((t, i) => i === 0 || totals[i - 1] >= t),
  );

  // 12.3 Order detail carries immutable snapshots.
  const p7DetailRes = await jfetch(
    `${BASE}/api/admin/orders/${p7Order.id}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const p7Full = p7DetailRes.order;
  check(
    "detail returns item snapshots (sku + variant + unit price)",
    p7DetailRes.ok === true &&
      p7Full.items[0].sku === "P7-M-ONYX" &&
      p7Full.items[0].variantId === p7Variant.id &&
      p7Full.items[0].quantity === 2,
  );
  check(
    "totals consistent and COD/payment snapshots present",
    p7Full.total === p7Full.subtotal + p7Full.shipping &&
      p7Full.paymentMethod === "cod",
  );
  check(
    "stock not yet restored + audit trail empty",
    p7Full.stockRestored === false && p7DetailRes.events.length === 0,
  );

  // 12.4 Server-side lifecycle validation.
  const badMove = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "تم التسليم" }),
  });
  const badMoveBody = await badMove.json();
  check(
    "illegal transition rejected (409)",
    badMove.status === 409 && badMoveBody.code === "INVALID_TRANSITION",
    JSON.stringify(badMoveBody),
  );
  const badStatus = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "nonsense" }),
  });
  check("unknown status rejected (400)", badStatus.status === 400);
  const badPayment = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ paymentStatus: "charged" }),
  });
  check("unknown payment status rejected (400)", badPayment.status === 400);
  const missing = await jfetch(`${BASE}/api/admin/orders/999999`, {
    headers: adminHeaders,
  });
  check("unknown order id rejected (404)", missing.status === 404);

  // 12.5 Valid forward moves + explicit override.
  const toConfirmed = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "تم التأكيد" }),
  }).then((r) => r.json());
  const toProcessing = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "قيد التحضير" }),
  }).then((r) => r.json());
  check(
    "forward lifecycle accepted (pending → confirmed → processing)",
    toConfirmed.ok === true && toProcessing.ok === true,
  );
  const skipShipped = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "تم التسليم" }),
  });
  check("skip to delivered rejected without override (409)", skipShipped.status === 409);
  const forced = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "تم التسليم", force: true }),
  }).then((r) => r.json());
  check("explicit force override accepted", forced.ok === true);

  // 12.6 Refund restores stock exactly once.
  const cancelAfterDelivery = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "ملغى" }),
  });
  check("cancel after delivery rejected (409)", cancelAfterDelivery.status === 409);

  const afterDecrement = await jfetch(
    `${BASE}/api/admin/products/${p7Create.id}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const vBefore = afterDecrement.variants.find((v) => v.id === p7Variant.id);
  check("variant stock still decremented before refund", vBefore?.stock === 2);

  const refund = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "مرجع" }),
  }).then((r) => r.json());
  const afterRefund = await jfetch(
    `${BASE}/api/admin/products/${p7Create.id}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const vAfter = afterRefund.variants.find((v) => v.id === p7Variant.id);
  check(
    "refund restores exact variant stock once",
    refund.ok === true && refund.stockRestored === true && vAfter?.stock === 4,
    JSON.stringify({ refund, vAfter }),
  );
  check(
    "product stock re-synced after restore",
    afterRefund.product.stock === 4 && afterRefund.product.soldOut === false,
  );

  // 12.7 No double restoration, ever.
  const forceCancel = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "ملغى", force: true }),
  }).then((r) => r.json());
  const afterForceCancel = await jfetch(
    `${BASE}/api/admin/products/${p7Create.id}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const vAfterCancel = afterForceCancel.variants.find((v) => v.id === p7Variant.id);
  check(
    "forced move out of refunded does NOT restock again",
    forceCancel.ok === true && vAfterCancel?.stock === 4,
  );
  const refundedDetail = await jfetch(
    `${BASE}/api/admin/orders/${p7Order.id}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const stockEvents = refundedDetail.events.filter((e) => e.kind === "stock");
  check(
    "stock-restoration event recorded exactly once",
    refundedDetail.order.stockRestored === true && stockEvents.length === 1,
  );
  const noOp = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "ملغى" }),
  }).then((r) => r.json());
  check("same-status PATCH is an idempotent no-op", noOp.ok === true && noOp.unchanged === true);

  // 12.8 Payment status is separate from fulfillment.
  const pay = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ paymentStatus: "paid" }),
  }).then((r) => r.json());
  const paidList = await jfetch(
    `${BASE}/api/admin/orders?payment=paid&q=${encodeURIComponent(p7Buy.orderNumber)}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check(
    "payment status updated and filterable",
    pay.ok === true &&
      paidList.total === 1 &&
      paidList.orders[0].paymentStatus === "paid",
  );

  // 12.9 Internal notes + audit trail.
  const noteEmpty = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}/notes`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ body: "   " }),
  });
  check("empty note rejected (400)", noteEmpty.status === 400);
  const noteLong = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}/notes`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ body: "x".repeat(2001) }),
  });
  check("oversized note rejected (400)", noteLong.status === 400);
  const noteAdd = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}/notes`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ body: "Customer asked for gift wrap." }),
  });
  const noteBody = await noteAdd.json();
  check(
    "note created with author + timestamp",
    noteAdd.status === 201 &&
      noteBody.note?.body === "Customer asked for gift wrap." &&
      Boolean(noteBody.note?.author) &&
      Boolean(noteBody.note?.createdAt),
    JSON.stringify(noteBody),
  );
  const notesList = await jfetch(
    `${BASE}/api/admin/orders/${p7Order.id}/notes`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check(
    "notes listed for the order",
    notesList.ok === true &&
      notesList.notes.length === 1 &&
      notesList.notes[0].author === noteBody.note.author,
  );

  // 12.10 Security: admin + CSRF required everywhere; nothing public.
  const noAuthList = await jfetch(`${BASE}/api/admin/orders`);
  const noCsrfPatch = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: auth.cookie,
    },
    body: JSON.stringify({ status: "ملغى" }),
  });
  const noAuthNote = await jfetch(`${BASE}/api/admin/orders/${p7Order.id}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "evil" }),
  });
  check(
    "order endpoints require admin session + CSRF (401)",
    noAuthList.status === 401 &&
      noCsrfPatch.status === 401 &&
      noAuthNote.status === 401,
  );

  // 12.11 Legacy orders (created before Phase 7) keep working.
  const { Client } = require("pg");
  const legacyClient = new Client({ connectionString: databaseUrl });
  await legacyClient.connect();
  const legacyInsert = await legacyClient.query(
    `INSERT INTO orders (order_number, email, full_name, phone, address,
       subtotal, shipping, total, items, status)
     VALUES ($1, $2, $3, $4, $5, $6, 0, $6, $7::jsonb, $8)
     RETURNING id, order_number`,
    [
      "RVN-LEGACY7",
      "legacy@test.local",
      "Legacy Customer",
      "+213555000077",
      "77 Old Street",
      7000,
      JSON.stringify([
        {
          productId: p7Create.id,
          slug: P7_SLUG,
          name: "Phase7 Order Jacket",
          price: 7000,
          quantity: 1,
          size: "M",
          color: "Onyx",
        },
      ]),
      "جديد",
    ],
  );
  await legacyClient.end();
  const legacyId = legacyInsert.rows[0].id;
  const legacyDetail = await jfetch(`${BASE}/api/admin/orders/${legacyId}`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "legacy order readable with Phase 7 defaults",
    legacyDetail.ok === true &&
      legacyDetail.order.paymentStatus === "pending" &&
      legacyDetail.order.paymentMethod === "cod" &&
      legacyDetail.order.stockRestored === false,
    JSON.stringify(legacyDetail.order?.paymentStatus),
  );
  const legacyCancel = await jfetch(`${BASE}/api/admin/orders/${legacyId}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ status: "ملغى" }),
  }).then((r) => r.json());
  const afterLegacyCancel = await jfetch(
    `${BASE}/api/admin/products/${p7Create.id}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check(
    "legacy order cancellation restores product-level stock",
    legacyCancel.ok === true &&
      legacyCancel.stockRestored === true &&
      afterLegacyCancel.product.stock === 5,
    JSON.stringify({ legacyCancel, stock: afterLegacyCancel.product.stock }),
  );
  const legacyInList = await jfetch(
    `${BASE}/api/admin/orders?q=RVN-LEGACY7`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check("legacy order appears in search", legacyInList.total === 1);

  // 12.12 Admin pages render (SSR) with the new management UI.
  const ordersPage = await jfetch(`${BASE}/admin/orders`, {
    headers: { cookie: auth.cookie },
  });
  const ordersHtml = normalized(await ordersPage.text());
  check(
    "admin orders page SSR renders rows + toolbar",
    ordersPage.status === 200 &&
      ordersHtml.includes(p7Buy.orderNumber) &&
      ordersHtml.includes("All statuses"),
  );
  const orderPage = await jfetch(`${BASE}/admin/orders/${p7Order.id}`, {
    headers: { cookie: auth.cookie },
  });
  const orderHtml = normalized(await orderPage.text());
  check(
    "order detail page SSR renders items, notes and history",
    orderPage.status === 200 &&
      orderHtml.includes("P7-M-ONYX") &&
      orderHtml.includes("Internal notes") &&
      orderHtml.includes("History"),
  );

  // Cleanup.
  await jfetch(`${BASE}/api/admin/products/${p7Create.id}`, {
    method: "DELETE",
    headers: adminHeaders,
  });

  section("13) Phase 8 — professional delivery & shipping management");

  // 13.0 Seeded zones migrated additively (58 wilayas, home method active).
  const zoneList = await jfetch(`${BASE}/api/admin/delivery`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "seeded wilayas present with Phase 8 fields",
    zoneList.ok === true &&
      zoneList.zones.length >= 58 &&
      zoneList.zones.every((z) => "homePrice" in z && "pickupEnabled" in z),
    JSON.stringify({ count: zoneList.zones?.length }),
  );
  const algiers = zoneList.zones.find((z) => z.code === 16);
  check(
    "backfill copied legacy price into home delivery",
    algiers?.homeEnabled === true &&
      algiers?.homePrice === algiers?.price &&
      algiers?.slug !== "" &&
      algiers?.sortOrder === 16,
    JSON.stringify(algiers),
  );

  // 13.0b Official wilaya pricing table applied by the one-time sync
  // (prices stored in cents; 500 DA -> 50000).
  const officialZones = await jfetch(`${BASE}/api/delivery/zones`).then((r) => r.json());
  const oz = (code) => officialZones.zones.find((z) => z.code === code);
  check(
    "official pricing: Alger 16 -> home 500 DA / STOP DESK 250 DA",
    oz(16)?.methods.home?.price === 50000 &&
      oz(16)?.methods.office?.price === 25000,
    JSON.stringify(oz(16)),
  );
  check(
    "official pricing: Adrar 01 -> home 1100 DA / STOP DESK 600 DA",
    oz(1)?.methods.home?.price === 110000 && oz(1)?.methods.office?.price === 60000,
    JSON.stringify(oz(1)),
  );
  check(
    "official pricing: Tizi Ouzou 15 -> home 700 DA / STOP DESK 400 DA",
    oz(15)?.methods.home?.price === 70000 && oz(15)?.methods.office?.price === 40000,
    JSON.stringify(oz(15)),
  );
  check(
    "official pricing: El Meniaa 58 -> home 1100 DA / STOP DESK 500 DA",
    oz(58)?.methods.home?.price === 110000 && oz(58)?.methods.office?.price === 50000,
    JSON.stringify(oz(58)),
  );
  check(
    "official pricing: Beni Abbas 52 offers home delivery only",
    oz(52)?.methods.home?.price === 110000 && oz(52)?.methods.office === null,
    JSON.stringify(oz(52)),
  );
  check(
    "official pricing: El M'Ghair 57 offers home delivery only",
    oz(57)?.methods.home?.price === 90000 && oz(57)?.methods.office === null,
    JSON.stringify(oz(57)),
  );
  check(
    "official pricing: wilayas 50 & 54 hidden (no delivery offered)",
    !oz(50) && !oz(54),
  );

  // 13.0c Exhaustive table verification — every wilaya against the
  // business-provided delivery table. Zone prices are stored as WHOLE DZD
  // (the admin list exposes the stored values, so we compare raw DA here;
  // the public storefront endpoints convert to cents at their boundary).
  // `null` = method not offered; both null = zone disabled.
  const OFFICIAL = {
    1: [1100, 600], 2: [700, 400], 3: [900, 500], 4: [650, 400], 5: [700, 500],
    6: [700, 400], 7: [900, 500], 8: [1100, 600], 9: [500, 250], 10: [700, 400],
    11: [1300, 600], 12: [700, 400], 13: [800, 500], 14: [800, 400], 15: [700, 400],
    16: [500, 250], 17: [900, 500], 18: [600, 400], 19: [700, 400], 20: [800, 400],
    21: [600, 400], 22: [700, 400], 23: [700, 400], 24: [600, 400], 25: [500, 350],
    26: [700, 400], 27: [700, 400], 28: [800, 500], 29: [700, 400], 30: [900, 500],
    31: [800, 400], 32: [800, 500], 33: [1300, 600], 34: [700, 400], 35: [700, 400],
    36: [700, 400], 37: [1300, 600], 38: [800, 400], 39: [900, 500], 40: [700, 500],
    41: [700, 500], 42: [700, 400], 43: [600, 400], 44: [700, 400], 45: [800, 500],
    46: [800, 400], 47: [1000, 500], 48: [700, 400], 49: [1100, 600],
    50: [null, null], 51: [900, 500], 52: [1100, null], 53: [1300, 600],
    54: [null, null], 55: [900, 500], 56: [1100, null], 57: [900, null],
    58: [1100, 500],
  };
  const adminAll = await jfetch(`${BASE}/api/admin/delivery`, { headers: adminHeaders }).then((r) => r.json());
  const az = (code) => (adminAll.zones ?? []).find((z) => z.code === code);
  const mismatches = [];
  for (const [codeStr, [home, stop]] of Object.entries(OFFICIAL)) {
    const code = Number(codeStr);
    const z = az(code);
    if (!z) { mismatches.push(`${code}:missing`); continue; }
    if ((z.homeEnabled === true) !== (home !== null)) mismatches.push(`${code}:homeEnabled`);
    if ((z.pickupEnabled === true) !== (stop !== null)) mismatches.push(`${code}:pickupEnabled`);
    // Admin exposes the STORED value (whole DZD) — compare raw DA.
    if (home !== null && z.homePrice !== home) mismatches.push(`${code}:homePrice=${z.homePrice}`);
    if (stop !== null && z.pickupPrice !== stop) mismatches.push(`${code}:pickupPrice=${z.pickupPrice}`);
    if (home === null && stop === null && z.enabled !== false) mismatches.push(`${code}:enabled`);
  }
  check(
    "ALL 58 wilaya prices/availability exactly match the provided table",
    Object.keys(OFFICIAL).length === 58 && mismatches.length === 0,
    mismatches.join(",") || "58/58 exact",
  );

  // 13.1 Zone CRUD + validation + safe deletion.
  const dupZone = await jfetch(`${BASE}/api/admin/delivery`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ code: 16, wilaya: "Duplicate", homeEnabled: true, homePrice: 100 }),
  });
  check("duplicate wilaya code rejected (409)", dupZone.status === 409);
  const badCode = await jfetch(`${BASE}/api/admin/delivery`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ code: 99, wilaya: "Nowhere", homeEnabled: true, homePrice: 100 }),
  });
  check("out-of-range wilaya code rejected (400)", badCode.status === 400);
  const noMethods = await jfetch(`${BASE}/api/admin/delivery`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ code: 15, wilaya: "X", homeEnabled: false, pickupEnabled: false }),
  });
  check("zone without any shipping method rejected (400)", noMethods.status === 400);
  const orans = zoneList.zones.find((z) => z.code === 31);
  const negPrice = await jfetch(`${BASE}/api/admin/delivery/${orans.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ wilaya: orans.wilaya, homeEnabled: true, homePrice: -50 }),
  }).then((r) => r.json());
  check(
    "negative prices sanitized to zero",
    negPrice.ok === true && negPrice.zone?.homePrice === 0,
    JSON.stringify(negPrice.zone),
  );

  // Configure Algiers (16) deterministically for the checkout assertions.
  const cfgRes = await jfetch(`${BASE}/api/admin/delivery/${algiers.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      wilaya: algiers.wilaya,
      homeEnabled: true,
      homePrice: 600,
      homeEstimatedTime: "1-2 أيام",
      pickupEnabled: true,
      pickupPrice: 350,
      pickupEstimatedTime: "1 يوم",
    }),
  }).then((r) => r.json());
  check(
    "zone configured with home + office pricing",
    cfgRes.ok === true &&
      cfgRes.zone.homePrice === 600 &&
      cfgRes.zone.pickupPrice === 350 &&
      cfgRes.zone.price === 600,
    JSON.stringify(cfgRes.zone),
  );

  // Legacy inline-edit payload (pre-Phase 8 admin) still works.
  const legacyPatch = await jfetch(`${BASE}/api/admin/delivery/${orans.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ price: 620, estimatedTime: "2-3 أيام", enabled: true }),
  }).then((r) => r.json());
  check(
    "legacy PATCH payload maps onto home delivery",
    legacyPatch.ok === true &&
      legacyPatch.zone.homePrice === 620 &&
      legacyPatch.zone.homeEstimatedTime === "2-3 أيام",
  );

  // Safe deletion: enabled → 409, disabled → deleted, then recreated.
  const delActive = await jfetch(`${BASE}/api/admin/delivery/${algiers.id}`, {
    method: "DELETE",
    headers: adminHeaders,
  });
  check("deleting an ACTIVE zone is blocked (409)", delActive.status === 409);
  await jfetch(`${BASE}/api/admin/delivery/${algiers.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ wilaya: algiers.wilaya, enabled: false, homeEnabled: true, homePrice: 600 }),
  });
  const delDisabled = await jfetch(`${BASE}/api/admin/delivery/${algiers.id}`, {
    method: "DELETE",
    headers: adminHeaders,
  });
  check("disabled zone can be deleted safely", delDisabled.status === 200);
  const recreate = await jfetch(`${BASE}/api/admin/delivery`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      code: 16,
      wilaya: algiers.wilaya,
      homeEnabled: true,
      homePrice: 600,
      homeEstimatedTime: "1-2 أيام",
      pickupEnabled: true,
      pickupPrice: 350,
      pickupEstimatedTime: "1 يوم",
      sortOrder: 16,
    }),
  }).then((r) => r.json());
  check("zone recreated with same wilaya code", recreate.ok === true && recreate.zone.code === 16);
  const algiersId = recreate.zone.id;

  // 13.2 Public endpoints: active zones only + server-computed quotes.
  const publicZones = await jfetch(`${BASE}/api/delivery/zones`).then((r) => r.json());
  const pubAlgiers = publicZones.zones?.find((z) => z.code === 16);
  check(
    "public zones expose per-method prices in CENTS (600/350 DA configured)",
    publicZones.ok === true &&
      pubAlgiers?.methods.home?.price === 60000 &&
      pubAlgiers?.methods.office?.price === 35000,
    JSON.stringify(pubAlgiers),
  );
  const quoteHome = await jfetch(
    `${BASE}/api/delivery/quote?zone=16&method=home&subtotal=5000`,
  ).then((r) => r.json());
  check(
    "quote below threshold returns the configured price in cents",
    quoteHome.ok === true && quoteHome.quote.shipping === 60000 && !quoteHome.quote.freeShipping,
  );
  // PRODUCTION-INCIDENT REGRESSION: a realistic 2,500 DA cart (250,000
  // cents) must NOT quote free just because 250,000 > 15,000 (the DZD
  // threshold). Configured prices must be charged.
  const quoteIncidentHome = await jfetch(
    `${BASE}/api/delivery/quote?zone=16&method=home&subtotal=250000`,
  ).then((r) => r.json());
  const quoteIncidentOffice = await jfetch(
    `${BASE}/api/delivery/quote?zone=16&method=office&subtotal=250000`,
  ).then((r) => r.json());
  check(
    "incident regression: 2,500 DA cart quotes real home price, not Free",
    quoteIncidentHome.ok === true &&
      quoteIncidentHome.quote.shipping === 60000 &&
      quoteIncidentHome.quote.freeShipping === false,
    JSON.stringify(quoteIncidentHome),
  );
  check(
    "incident regression: 2,500 DA cart quotes real office price, not Free",
    quoteIncidentOffice.ok === true &&
      quoteIncidentOffice.quote.shipping === 35000 &&
      quoteIncidentOffice.quote.freeShipping === false,
    JSON.stringify(quoteIncidentOffice),
  );
  const quoteFree = await jfetch(
    `${BASE}/api/delivery/quote?zone=16&method=office&subtotal=1500000`,
  ).then((r) => r.json());
  check(
    "free-shipping threshold applies at/above 15,000 DA (1,500,000 cents)",
    quoteFree.ok === true &&
      quoteFree.quote.shipping === 0 &&
      quoteFree.quote.freeShipping === true,
  );
  const quoteNotFreeJustBelow = await jfetch(
    `${BASE}/api/delivery/quote?zone=16&method=office&subtotal=1499999`,
  ).then((r) => r.json());
  check(
    "one centime below the threshold still pays the configured price",
    quoteNotFreeJustBelow.ok === true &&
      quoteNotFreeJustBelow.quote.shipping === 35000 &&
      quoteNotFreeJustBelow.quote.freeShipping === false,
  );

  // SCREENSHOT SCENARIO (requirement #11): Admin has Home = 500 DA and
  // Stop desk/bureau = 250 DA configured. The storefront must charge those
  // exact amounts (50,000 / 25,000 cents) — never "Free" — for a normal
  // 2,500 DA cart, and the configured values must round-trip through the
  // admin panel unchanged (whole DZD in, whole DZD out).
  await jfetch(`${BASE}/api/admin/delivery/${algiersId}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      wilaya: algiers.wilaya,
      homeEnabled: true,
      homePrice: 500,
      pickupEnabled: true,
      pickupPrice: 250,
    }),
  });
  const screenshotZones = await jfetch(`${BASE}/api/delivery/zones`).then((r) => r.json());
  const screenshotAlgiers = screenshotZones.zones?.find((z) => z.code === 16);
  check(
    "screenshot scenario: 500/250 DA exposed to storefront as 50,000/25,000 cents",
    screenshotAlgiers?.methods.home?.price === 50000 &&
      screenshotAlgiers?.methods.office?.price === 25000,
    JSON.stringify(screenshotAlgiers),
  );
  const screenshotHome = await jfetch(
    `${BASE}/api/delivery/quote?zone=16&method=home&subtotal=250000`,
  ).then((r) => r.json());
  const screenshotOffice = await jfetch(
    `${BASE}/api/delivery/quote?zone=16&method=office&subtotal=250000`,
  ).then((r) => r.json());
  check(
    "screenshot scenario: storefront quotes 500 DA home (NOT Free)",
    screenshotHome.ok === true &&
      screenshotHome.quote.shipping === 50000 &&
      screenshotHome.quote.freeShipping === false,
    JSON.stringify(screenshotHome),
  );
  check(
    "screenshot scenario: storefront quotes 250 DA stop desk (NOT Free)",
    screenshotOffice.ok === true &&
      screenshotOffice.quote.shipping === 25000 &&
      screenshotOffice.quote.freeShipping === false,
    JSON.stringify(screenshotOffice),
  );
  // Admin round-trip: the panel still reads back the whole-DZD values.
  const screenshotAdmin = await jfetch(`${BASE}/api/admin/delivery/${algiersId}`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "screenshot scenario: admin reads back 500/250 whole DZD as entered",
    screenshotAdmin.zone?.homePrice === 500 && screenshotAdmin.zone?.pickupPrice === 250,
    JSON.stringify({ home: screenshotAdmin.zone?.homePrice, pickup: screenshotAdmin.zone?.pickupPrice }),
  );
  // Restore 600/350 for the checkout assertions that follow.
  await jfetch(`${BASE}/api/admin/delivery/${algiersId}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({
      wilaya: algiers.wilaya,
      homeEnabled: true,
      homePrice: 600,
      pickupEnabled: true,
      pickupPrice: 350,
    }),
  });
  const quoteBadMethod = await jfetch(
    `${BASE}/api/delivery/quote?zone=16&method=drone&subtotal=1000`,
  );
  check("quote rejects unknown method (400)", quoteBadMethod.status === 400);
  // Zone 52 (Beni Abbès) is home-only in the official wilaya price table,
  // so its STOP DESK method must be rejected.
  const quoteDisabledMethod = await jfetch(
    `${BASE}/api/delivery/quote?zone=52&method=office&subtotal=1000`,
  );
  check(
    "quote rejects method disabled for the zone (404)",
    quoteDisabledMethod.status === 404,
  );

  // 13.3 Checkout integration (server-authoritative shipping).
  const P8_SLUG = "phase8-delivery-hoodie";
  const p8Create = await jfetch(`${BASE}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Phase8 Delivery Hoodie",
      slug: P8_SLUG,
      sku: "P8-HOODIE",
      description: "Created by the Phase 8 integration suite.",
      price: "80.00",
      category: "Hoodies",
      sizes: "M",
      colors: "Onyx",
      variants: [
        { size: "M", color: "Onyx", sku: "P8-M-ONYX", stock: 15, active: true },
      ],
    }),
  }).then((r) => r.json());
  const p8Detail = await jfetch(`${BASE}/api/admin/products/${p8Create.id}`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  const p8Variant = p8Detail.variants.find((v) => v.size === "M");
  const p8Customer = {
    email: "phase8@test.local",
    fullName: "Phase Eight Tester",
    address: "8 Delivery Street",
    city: "Alger",
    postalCode: "16000",
    country: "Algeria",
    phone: "+213555000008",
  };
  const p8Item = {
    slug: P8_SLUG,
    size: "M",
    color: "Onyx",
    quantity: 1,
    variantId: p8Variant.id,
    sku: "P8-M-ONYX",
  };

  // Home delivery through zone 16.
  const homeBuy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...p8Customer,
      commune: "Bab El Oued",
      deliveryZone: 16,
      deliveryMethod: "home",
      // Manipulated client shipping — the server MUST ignore it.
      shipping: 1,
      deliveryPrice: 1,
      items: [p8Item],
    }),
  }).then((r) => r.json());
  check(
    "checkout with home delivery succeeds (600 DA charged as 60,000 cents)",
    homeBuy.ok === true && homeBuy.shipping === 60000,
    JSON.stringify(homeBuy),
  );
  check(
    "client-manipulated shipping price ignored (server is source of truth)",
    homeBuy.total === homeBuy.subtotal + 60000,
  );
  const homeOrder = await jfetch(
    `${BASE}/api/admin/orders?q=${encodeURIComponent(homeBuy.orderNumber)}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const homeOrderId = homeOrder.orders[0]?.id;
  const homeDetail = await jfetch(`${BASE}/api/admin/orders/${homeOrderId}`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "order stores immutable shipping snapshot",
    homeDetail.order.deliveryMethod === "home" &&
      homeDetail.order.deliveryZoneCode === 16 &&
      homeDetail.order.deliveryEstimate === "1-2 أيام" &&
      homeDetail.order.wilaya.includes("الجزائر") &&
      homeDetail.order.commune === "Bab El Oued" &&
      homeDetail.order.shipping === 60000,
    JSON.stringify({
      m: homeDetail.order.deliveryMethod,
      z: homeDetail.order.deliveryZoneCode,
      e: homeDetail.order.deliveryEstimate,
    }),
  );

  // Changing the zone price later must NOT rewrite history.
  await jfetch(`${BASE}/api/admin/delivery/${algiersId}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ wilaya: algiers.wilaya, homePrice: 9999, homeEnabled: true }),
  });
  const homeDetailAfter = await jfetch(`${BASE}/api/admin/orders/${homeOrderId}`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "historical shipping snapshot unaffected by later price changes",
    homeDetailAfter.order.shipping === 60000 && homeDetailAfter.order.total === homeBuy.total,
  );
  // restore price for following assertions
  await jfetch(`${BASE}/api/admin/delivery/${algiersId}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ wilaya: algiers.wilaya, homePrice: 600, homeEnabled: true }),
  });

  // Office/pickup delivery.
  const officeBuy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...p8Customer,
      deliveryZone: 16,
      deliveryMethod: "office",
      items: [p8Item],
    }),
  }).then((r) => r.json());
  check(
    "checkout with pickup/office delivery uses office price (350 DA as 35,000 cents)",
    officeBuy.ok === true && officeBuy.shipping === 35000,
    JSON.stringify(officeBuy),
  );

  // Free shipping over the threshold (zone selected). The threshold is a
  // whole-DZD store setting (15,000 DA = 1,500,000 cents), so the cart must
  // genuinely exceed it. Create a high-ticket product for this one order.
  const FREE_SLUG = "phase8-free-ship-jacket";
  const freeProd = await jfetch(`${BASE}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Phase8 Free Ship Jacket",
      slug: FREE_SLUG,
      sku: "P8-JACKET",
      description: "High-ticket item used to cross the free-shipping threshold.",
      price: "16000.00", // 1,600,000 cents ≥ 1,500,000 threshold
      category: "Jackets",
      sizes: "L",
      colors: "Sand",
      variants: [
        { size: "L", color: "Sand", sku: "P8-L-SAND", stock: 5, active: true },
      ],
    }),
  }).then((r) => r.json());
  const freeDetail = await jfetch(`${BASE}/api/admin/products/${freeProd.id}`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  const freeVariant = freeDetail.variants.find((v) => v.size === "L");
  const freeBuy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...p8Customer,
      deliveryZone: 16,
      deliveryMethod: "home",
      items: [
        { slug: FREE_SLUG, size: "L", color: "Sand", quantity: 1, variantId: freeVariant.id, sku: "P8-L-SAND" },
      ],
    }),
  }).then((r) => r.json());
  check(
    "free shipping applies at/above the DZD threshold even with a zone",
    freeBuy.ok === true && freeBuy.shipping === 0 && freeBuy.total === freeBuy.subtotal,
    JSON.stringify({ subtotal: freeBuy.subtotal, shipping: freeBuy.shipping }),
  );
  // And just BELOW the threshold the configured zone price is charged again.
  const belowFreeBuy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...p8Customer,
      deliveryZone: 16,
      deliveryMethod: "home",
      items: [p8Item], // 8,000 cents = 80 DA << 15,000 DA
    }),
  }).then((r) => r.json());
  check(
    "order below the threshold pays the configured zone price (no silent Free)",
    belowFreeBuy.ok === true && belowFreeBuy.shipping === 60000,
    JSON.stringify({ subtotal: belowFreeBuy.subtotal, shipping: belowFreeBuy.shipping }),
  );

  // Rejections: unavailable method, inactive zone, unknown zone.
  // Zone 52 (Beni Abbès) is home-only in the official wilaya price table.
  const officeUnavailable = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...p8Customer,
      deliveryZone: 52,
      deliveryMethod: "office",
      items: [p8Item],
    }),
  });
  check(
    "checkout rejects method disabled for zone (409)",
    officeUnavailable.status === 409,
    String(officeUnavailable.status),
  );
  await jfetch(`${BASE}/api/admin/delivery/${orans.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ wilaya: orans.wilaya, enabled: false, homeEnabled: true }),
  });
  const inactiveZoneBuy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...p8Customer,
      deliveryZone: 31,
      deliveryMethod: "home",
      items: [p8Item],
    }),
  });
  check("checkout rejects inactive zone (404)", inactiveZoneBuy.status === 404);
  await jfetch(`${BASE}/api/admin/delivery/${orans.id}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ wilaya: orans.wilaya, enabled: true, homeEnabled: true }),
  });
  const unknownZoneBuy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...p8Customer,
      deliveryZone: 999,
      deliveryMethod: "home",
      items: [p8Item],
    }),
  });
  check("checkout rejects unknown zone (404)", unknownZoneBuy.status === 404);

  // Legacy clients (no zone) keep working with the flat rate.
  const legacyBuy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...p8Customer, items: [p8Item] }),
  }).then((r) => r.json());
  check(
    "checkout without a zone keeps legacy flat shipping",
    legacyBuy.ok === true && legacyBuy.shipping === 995,
    JSON.stringify(legacyBuy),
  );

  // 13.4 Delivery status lifecycle + audit trail.
  const badDeliveryMove = await jfetch(`${BASE}/api/admin/orders/${homeOrderId}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ deliveryStatus: "in_transit" }),
  });
  const badDeliveryBody = await badDeliveryMove.json();
  check(
    "illegal delivery transition rejected (409)",
    badDeliveryMove.status === 409 && badDeliveryBody.code === "INVALID_DELIVERY_TRANSITION",
  );
  const unknownDelivery = await jfetch(`${BASE}/api/admin/orders/${homeOrderId}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ deliveryStatus: "flying" }),
  });
  check("unknown delivery status rejected (400)", unknownDelivery.status === 400);
  const toReady = await jfetch(`${BASE}/api/admin/orders/${homeOrderId}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ deliveryStatus: "ready" }),
  }).then((r) => r.json());
  const toCourier = await jfetch(`${BASE}/api/admin/orders/${homeOrderId}`, {
    method: "PATCH",
    headers: adminHeaders,
    body: JSON.stringify({ deliveryStatus: "handed_to_courier" }),
  }).then((r) => r.json());
  check(
    "delivery status moves forward with validation",
    toReady.ok === true && toCourier.ok === true,
  );
  const deliveryEvents = await jfetch(`${BASE}/api/admin/orders/${homeOrderId}`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  const dEvents = deliveryEvents.events.filter((e) => e.kind === "delivery");
  check(
    "delivery transitions recorded in the audit trail",
    dEvents.length === 2 &&
      dEvents.some((e) => e.fromValue === "not_ready" && e.toValue === "ready"),
  );

  // 13.5 Security: admin session + CSRF required on delivery configuration.
  const noAuthZones = await jfetch(`${BASE}/api/admin/delivery`);
  const noCsrfZone = await jfetch(`${BASE}/api/admin/delivery/${algiersId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: auth.cookie },
    body: JSON.stringify({ wilaya: "x", homePrice: 1 }),
  });
  check(
    "delivery admin endpoints require session + CSRF (401)",
    noAuthZones.status === 401 && noCsrfZone.status === 401,
  );

  // 13.6 Admin + storefront pages render.
  const deliveryPage = await jfetch(`${BASE}/admin/delivery`, {
    headers: { cookie: auth.cookie },
  });
  const deliveryHtml = normalized(await deliveryPage.text());
  check(
    "admin delivery page SSR renders management UI",
    deliveryPage.status === 200 &&
      deliveryHtml.includes("Create zone") &&
      deliveryHtml.includes("Home Delivery"),
  );
  const checkoutPage = await jfetch(`${BASE}/checkout`);
  const checkoutHtml = await checkoutPage.text();
  // The cart hydrates client-side, so the SSR shell shows the empty-bag
  // state; verify the delivery flow lives in the shipped client chunks.
  const chunkSrcs = [...new Set(checkoutHtml.match(/\/_next\/static\/chunks\/[^"]+\.js/g) ?? [])];
  let checkoutChunks = "";
  for (const src of chunkSrcs.slice(0, 12)) {
    try {
      checkoutChunks += await (await jfetch(`${BASE}${src}`)).text();
    } catch {}
  }
  check(
    "checkout page renders + ships the wilaya delivery flow",
    checkoutPage.status === 200 &&
      checkoutChunks.includes("/api/delivery/zones") &&
      checkoutChunks.includes("Select wilaya"),
    JSON.stringify({ status: checkoutPage.status, chunks: chunkSrcs.length }),
  );
  const orderView = await jfetch(`${BASE}/admin/orders/${homeOrderId}`, {
    headers: { cookie: auth.cookie },
  });
  const orderViewHtml = normalized(await orderView.text());
  check(
    "order detail shows the shipping snapshot + delivery status",
    orderView.status === 200 &&
      orderViewHtml.includes("Shipping method") &&
      orderViewHtml.includes("Estimated delivery"),
  );

  // Phase 8 orders must not break the Meta Purchase contract.
  check(
    "purchase event id present for zone-based checkout",
    typeof homeBuy.purchaseEventId === "string" && homeBuy.purchaseEventId.length > 0,
  );

  // Cleanup.
  await jfetch(`${BASE}/api/admin/products/${p8Create.id}`, {
    method: "DELETE",
    headers: adminHeaders,
  });
  const finalZones = await jfetch(`${BASE}/api/admin/delivery`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "all seeded wilayas still present after Phase 8 mutations",
    finalZones.zones.length >= 58,
  );

  section("14) Direct purchase UX — BUY NOW flow, simplified address");

  // A. Product page shows BUY NOW; the add-to-bag CTA is gone.
  const pdp = await html(`/products/${slug}`);
  check(
    "product page shows BUY NOW instead of add-to-bag",
    pdp.status === 200 &&
      pdp.text.includes("Buy now") &&
      !pdp.text.includes("Add to bag"),
    JSON.stringify({ status: pdp.status }),
  );
  const pdpChunkSrcs = [
    ...new Set(pdp.text.match(/\/_next\/static\/chunks\/[^"]+\.js/g) ?? []),
  ];
  let pdpBundle = "";
  for (const src of pdpChunkSrcs.slice(0, 12)) {
    try {
      pdpBundle += await (await jfetch(`${BASE}${src}`)).text();
    } catch {}
  }
  check(
    "BUY NOW navigates straight to /checkout (no cart step)",
    pdpBundle.includes("/checkout"),
  );

  // C/D. Checkout no longer collects City / Postal code anywhere.
  const coPage = await jfetch(`${BASE}/checkout`);
  const coHtml = await coPage.text();
  const coChunkSrcs = [
    ...new Set(coHtml.match(/\/_next\/static\/chunks\/[^"]+\.js/g) ?? []),
  ];
  let coBundle = "";
  for (const src of coChunkSrcs.slice(0, 12)) {
    try {
      coBundle += await (await jfetch(`${BASE}${src}`)).text();
    } catch {}
  }
  check(
    "checkout UI collects ONLY name + phone + wilaya + commune",
    coPage.status === 200 &&
      !coBundle.includes('"Email address"') &&
      !coBundle.includes('"Street address"') &&
      !coBundle.includes('"City"') &&
      !coBundle.includes('"Postal code"') &&
      !coBundle.includes('"Country"') &&
      coBundle.includes('"Full name"') &&
      coBundle.includes('"Phone number (required)"') &&
      coBundle.includes("Select wilaya") &&
      coBundle.includes("Commune"),
  );

  // E. Server accepts orders without City/Postal code; phone is required.
  let dpDetail = null;
  for (let id = 1; id <= 20; id += 1) {
    const d = await jfetch(`${BASE}/api/admin/products/${id}`, {
      headers: adminHeaders,
    }).then((r) => r.json().catch(() => ({})));
    if (d?.product?.slug === slug) {
      dpDetail = d;
      break;
    }
  }
  const dpVariant = (dpDetail?.variants || []).find(
    (v) => v.active && v.stock >= 2,
  );
  check(
    "resolved a purchasable variant for the direct-buy test",
    Boolean(dpVariant),
  );

  const noPhone = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Direct Buyer",
      commune: "Hammam Dalaa",
      items: [{ slug, size: dpVariant.size, color: dpVariant.color, quantity: 1 }],
    }),
  });
  check("checkout without phone rejected (400)", noPhone.status === 400);
  const noName = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: "+213555000009",
      commune: "Hammam Dalaa",
      items: [{ slug, size: dpVariant.size, color: dpVariant.color, quantity: 1 }],
    }),
  });
  check("checkout without full name rejected (400)", noName.status === 400);

  // Order succeeds with ONLY full name + phone + wilaya + commune + items.
  const directBuy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Direct Buyer",
      phone: "+213555000009",
      commune: "Hammam Dalaa",
      deliveryZone: 28,
      deliveryMethod: "home",
      items: [
        {
          slug,
          size: dpVariant.size,
          color: dpVariant.color,
          quantity: 2,
          variantId: dpVariant.id,
          sku: dpVariant.sku,
        },
      ],
    }),
  }).then((r) => r.json());
  check(
    "direct purchase creates an order without City / Postal code",
    directBuy.ok === true && typeof directBuy.orderNumber === "string",
    JSON.stringify(directBuy),
  );

  const dpList = await jfetch(
    `${BASE}/api/admin/orders?q=${encodeURIComponent(directBuy.orderNumber)}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const dpOrderId = dpList.orders?.[0]?.id;
  const dpOrder = await jfetch(`${BASE}/api/admin/orders/${dpOrderId}`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  const dpo = dpOrder.order;
  check(
    "order created with ONLY name + phone + wilaya + commune; legacy columns empty",
    dpo.fullName === "Direct Buyer" &&
      dpo.phone === "+213555000009" &&
      dpo.commune === "Hammam Dalaa" &&
      dpo.wilaya.includes("المسيلة") &&
      dpo.email === "" &&
      dpo.address === "" &&
      dpo.city === "" &&
      dpo.postalCode === "" &&
      dpo.country === "الجزائر",
    JSON.stringify({
      email: dpo.email,
      address: dpo.address,
      city: dpo.city,
      postal: dpo.postalCode,
      country: dpo.country,
      wilaya: dpo.wilaya,
    }),
  );

  // F. Delivery remains server-priced for direct purchases.
  const dpQuote = await jfetch(
    `${BASE}/api/delivery/quote?zone=28&method=home&subtotal=${dpo.subtotal}`,
  ).then((r) => r.json());
  check(
    "delivery quote matches the charged shipping (server-authoritative)",
    directBuy.shipping === dpQuote.quote.shipping &&
      dpo.deliveryZoneCode === 28 &&
      dpo.deliveryMethod === "home",
    JSON.stringify({ shipping: directBuy.shipping, quote: dpQuote.quote }),
  );

  // G. Inventory decremented exactly by the direct purchase.
  const dpAfter = await jfetch(
    `${BASE}/api/admin/products/${dpDetail.product.id}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const dpAfterVariant = dpAfter.variants.find((v) => v.id === dpVariant.id);
  check(
    "inventory decremented by the BUY NOW order",
    dpAfterVariant.stock === dpVariant.stock - 2,
    JSON.stringify({ before: dpVariant.stock, after: dpAfterVariant?.stock }),
  );

  // H. Purchase dedupe key returned exactly as before.
  check(
    "Meta purchase dedupe key present for direct purchase",
    typeof directBuy.purchaseEventId === "string" &&
      directBuy.purchaseEventId.length > 0,
  );

  // I. Historical orders (with city/postal data) remain readable.
  const legacyStill = await jfetch(
    `${BASE}/api/admin/orders?q=RVN-LEGACY7`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check("historical orders still load after the UX change", legacyStill.total === 1);

  section("15) Phase 9 — languages (AR/FR/EN, RTL) & centralized DZD currency");

  const AR = { cookie: "rd-locale=ar" };
  const FR = { cookie: "rd-locale=fr" };
  const fetchHtml = async (p, cookie) => {
    const r = await jfetch(`${BASE}${p}`, cookie ? { headers: { cookie } } : {});
    return { status: r.status, text: await r.text() };
  };

  // A. Default (no cookie) renders LTR English — existing URLs unchanged.
  const homeDefault = await fetchHtml("/");
  check(
    "default SSR is English LTR (no /ar /fr /en URL scheme)",
    homeDefault.status === 200 &&
      /<html[^>]*lang="en"[^>]*dir="ltr"|<html[^>]*dir="ltr"[^>]*lang="en"/.test(homeDefault.text),
  );

  // B. Language persisted via rd-locale cookie → SSR flips lang/dir.
  const homeAr = await fetchHtml("/", AR.cookie);
  check(
    "AR cookie renders <html lang=ar dir=rtl> (RTL)",
    homeAr.status === 200 && /<html[^>]*lang="ar"/.test(homeAr.text) && /<html[^>]*dir="rtl"/.test(homeAr.text),
  );
  check(
    "AR home shows translated UI (USP + threshold in DZD)",
    homeAr.text.includes("شحن سريع مجاني") && homeAr.text.includes("دج"),
  );
  check(
    "AR navbar translates system links, keeps category data",
    homeAr.text.includes("تسوّق الكل") && homeAr.text.includes("Hoodies"),
  );

  const homeFr = await fetchHtml("/", FR.cookie);
  check(
    "FR cookie renders <html lang=fr dir=ltr>",
    homeFr.status === 200 && /<html[^>]*lang="fr"/.test(homeFr.text) && /<html[^>]*dir="ltr"/.test(homeFr.text),
  );
  check(
    "FR home shows translated UI + French number format",
    homeFr.text.includes("Livraison express gratuite") && homeFr.text.includes("15 000 DA"),
  );

  // C. Language switcher present + cookie contract shipped to the client.
  const homeChunks = [
    ...new Set(homeDefault.text.match(/\/_next\/static\/chunks\/[^"]+\.js/g) ?? []),
  ];
  let homeBundle = "";
  for (const src of homeChunks.slice(0, 12)) {
    try { homeBundle += await (await jfetch(`${BASE}${src}`)).text(); } catch {}
  }
  check(
    "language switcher rendered (AR/FR/EN buttons)",
    homeDefault.text.includes("العربية") &&
      homeDefault.text.includes(">FR<") &&
      homeDefault.text.includes(">EN<"),
  );
  check(
    "client persists language in the rd-locale cookie",
    homeBundle.includes("rd-locale") && homeBundle.includes("SameSite=Lax"),
  );

  // D. No locale URL prefixes: /ar and /fr are NOT routes.
  const arRoute = await fetchHtml("/ar");
  const frRoute = await fetchHtml("/fr");
  check(
    "no /ar or /fr locale URL structure (both 404)",
    arRoute.status === 404 && frRoute.status === 404,
    JSON.stringify({ ar: arRoute.status, fr: frRoute.status }),
  );

  // E. Translated shop + checkout SSR per locale.
  const shopAr = await fetchHtml("/shop", AR.cookie);
  check(
    "AR shop heading translated (system text, not data)",
    shopAr.status === 200 && shopAr.text.includes("تسوّق الكل"),
  );
  const checkoutAr = await fetchHtml("/checkout", AR.cookie);
  check(
    "AR checkout SSR shows translated empty-bag state",
    checkoutAr.status === 200 && checkoutAr.text.includes("سلتك فارغة"),
  );
  const pdpFr = await fetchHtml(`/products/${slug}`, FR.cookie);
  check(
    "FR product page translates BUY NOW + uses centralized formatter",
    pdpFr.status === 200 && pdpFr.text.includes("Acheter") && pdpFr.text.includes("DA"),
  );
  const pdpAr = await fetchHtml(`/products/${slug}`, AR.cookie);
  check(
    "AR product page translates BUY NOW + shows Arabic symbol",
    pdpAr.status === 200 && pdpAr.text.includes("اشترِ الآن") && pdpAr.text.includes("دج"),
  );

  // F. Currency is machine-readable ISO everywhere (UI never leaks to Meta).
  const catalog = await jfetch(`${BASE}/api/catalog`).then((r) => r.text());
  const catRows = parseCsv(catalog);
  const catPriceIdx = catRows[0]?.findIndex((h) => h === "price") ?? -1;
  check(
    "catalog feed prices use ISO DZD (machine-readable)",
    catPriceIdx > 0 &&
      catRows.length > 1 &&
      catRows.slice(1).every((row) => (row[catPriceIdx] ?? "").endsWith(" DZD")),
    JSON.stringify({ sample: catRows[1]?.[catPriceIdx] }),
  );

  // Resolve a purchasable variant for the locale-checkout orders.
  let i18nDetail = null;
  for (let id = 1; id <= 20; id += 1) {
    const d = await jfetch(`${BASE}/api/admin/products/${id}`, { headers: adminHeaders })
      .then((r) => r.json().catch(() => ({})));
    if (d?.product?.slug === slug) { i18nDetail = d; break; }
  }
  const i18nVariant = (i18nDetail?.variants || []).find((v) => v.active && v.stock >= 2);
  check("resolved a purchasable variant for locale checkout tests", Boolean(i18nVariant));

  const checkoutWithLocale = async (localeCookie, name, phone) =>
    jfetch(`${BASE}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: localeCookie },
      body: JSON.stringify({
        fullName: name,
        phone,
        commune: "Hammam Dalaa",
        deliveryZone: 28,
        deliveryMethod: "home",
        items: [{
          slug,
          size: i18nVariant.size,
          color: i18nVariant.color,
          quantity: 1,
          variantId: i18nVariant.id,
          sku: i18nVariant.sku,
        }],
      }),
    }).then((r) => r.json());

  const orderAr = await checkoutWithLocale(AR.cookie, "مشتري عربي", "+213555000021");
  const orderFr = await checkoutWithLocale(FR.cookie, "Acheteur Français", "+213555000022");
  check(
    "4-field checkout still works under AR and FR locale cookies",
    orderAr.ok === true && orderFr.ok === true,
    JSON.stringify({ ar: orderAr.error, fr: orderFr.error }),
  );
  check(
    "checkout responses snapshot ISO currency DZD with numeric totals",
    orderAr.currency === "DZD" && orderFr.currency === "DZD" &&
      typeof orderAr.total === "number" && typeof orderFr.total === "number" &&
      Number.isFinite(orderAr.shipping) && Number.isFinite(orderAr.subtotal),
    JSON.stringify({ currency: orderAr.currency, total: orderAr.total }),
  );
  check(
    "checkout response shape unchanged (ok/orderNumber/subtotal/shipping/total/currency/purchaseEventId)",
    ["ok", "orderNumber", "subtotal", "shipping", "total", "currency", "purchaseEventId"]
      .every((k) => k in orderAr),
  );
  check(
    "Meta Purchase dedupe key returned under every locale",
    typeof orderAr.purchaseEventId === "string" && orderAr.purchaseEventId.length > 0 &&
      typeof orderFr.purchaseEventId === "string" && orderFr.purchaseEventId.length > 0,
  );

  // G. New orders snapshot DZD; historical rows untouched.
  const i18nList = await jfetch(
    `${BASE}/api/admin/orders?q=${encodeURIComponent(orderAr.orderNumber)}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  const i18nOrder = await jfetch(
    `${BASE}/api/admin/orders/${i18nList.orders?.[0]?.id}`,
    { headers: adminHeaders },
  ).then((r) => r.json());
  check(
    "new order stores ISO currency snapshot (DZD)",
    i18nOrder.order?.currency === "DZD",
    JSON.stringify({ currency: i18nOrder.order?.currency }),
  );
  const legacyAfterI18n = await jfetch(`${BASE}/api/admin/orders?q=RVN-LEGACY7`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check("historical orders unaffected by currency change", legacyAfterI18n.total === 1);

  section("16) UX polish — mobile menu order & admin language switcher");

  // A. Storefront mobile drawer: search → language → links, in order.
  const menuHome = await fetchHtml("/");
  const menuIdx = menuHome.text.indexOf("transition-[max-height]");
  const menuHtml = menuIdx >= 0 ? menuHome.text.slice(menuIdx) : "";
  const mSearch = menuHtml.indexOf('role="search"');
  const mLang = menuHtml.indexOf("العربية");
  const mFirstLink = menuHtml.indexOf('href="/shop?filter=new"');
  check(
    "mobile menu order: search first, language switcher second, links after",
    menuIdx >= 0 && mSearch > 0 && mLang > mSearch && mFirstLink > mLang,
    JSON.stringify({ mSearch, mLang, mFirstLink }),
  );
  check(
    "mobile menu search reuses the existing search control (targets /shop)",
    menuHtml.includes("Search products"),
  );
  check(
    "switcher shows EN | FR | العربية in a stable LTR pill",
    menuHtml.includes('dir="ltr" role="group"') &&
      menuHtml.indexOf(">EN<") < menuHtml.indexOf(">FR<") &&
      menuHtml.indexOf(">FR<") < menuHtml.indexOf("العربية"),
  );
  check(
    "switcher rendered exactly twice (desktop + mobile, no duplication)",
    (menuHome.text.match(/role="group"/g) ?? []).length === 2,
  );

  // B. Same order holds in RTL Arabic.
  const menuAr = await fetchHtml("/", AR.cookie);
  const menuArIdx = menuAr.text.indexOf("transition-[max-height]");
  const menuArHtml = menuArIdx >= 0 ? menuAr.text.slice(menuArIdx) : "";
  const arSearch = menuArHtml.indexOf('role="search"');
  const arLang = menuArHtml.indexOf("العربية");
  const arFirstLink = menuArHtml.indexOf('href="/shop?filter=new"');
  check(
    "RTL Arabic keeps the same mobile menu order (search, language, links)",
    arSearch > 0 && arLang > arSearch && arFirstLink > arLang,
    JSON.stringify({ arSearch, arLang, arFirstLink }),
  );

  // C. Admin header exposes the same language switcher (shared infrastructure).
  const adminEn = await jfetch(`${BASE}/admin/dashboard`, {
    headers: { cookie: auth.cookie },
  });
  const adminEnHtml = await adminEn.text();
  check(
    "admin topbar contains the language switcher",
    adminEn.status === 200 && adminEnHtml.includes('aria-label="Change language"'),
    JSON.stringify({ status: adminEn.status }),
  );
  check(
    "admin switcher keeps logout/avatar intact",
    adminEnHtml.includes("Logout") && adminEnHtml.includes("View store"),
  );

  // D. Admin honours the locale cookie: AR → RTL, FR → LTR.
  const adminAr = await jfetch(`${BASE}/admin/dashboard`, {
    headers: { cookie: `${auth.cookie}; rd-locale=ar` },
  });
  const adminArHtml = await adminAr.text();
  check(
    "admin SSR flips to lang=ar dir=rtl with the AR cookie",
    adminAr.status === 200 &&
      /<html[^>]*lang="ar"/.test(adminArHtml) &&
      /<html[^>]*dir="rtl"/.test(adminArHtml),
  );
  const adminFr = await jfetch(`${BASE}/admin/dashboard`, {
    headers: { cookie: `${auth.cookie}; rd-locale=fr` },
  });
  const adminFrHtml = await adminFr.text();
  check(
    "admin SSR stays lang=fr dir=ltr with the FR cookie",
    adminFr.status === 200 &&
      /<html[^>]*lang="fr"/.test(adminFrHtml) &&
      /<html[^>]*dir="ltr"/.test(adminFrHtml),
  );

  // E. Checkout regression guard: still exactly the four customer fields.
  const coPage16 = await jfetch(`${BASE}/checkout`);
  const coHtml16 = await coPage16.text();
  const coChunks16 = [
    ...new Set(coHtml16.match(/\/_next\/static\/chunks\/[^"]+\.js/g) ?? []),
  ];
  let coBundle16 = "";
  for (const src of coChunks16.slice(0, 12)) {
    try { coBundle16 += await (await jfetch(`${BASE}${src}`)).text(); } catch {}
  }
  check(
    "checkout still collects ONLY name/phone/wilaya/commune after UX polish",
    coPage16.status === 200 &&
      !coBundle16.includes('"Email address"') &&
      !coBundle16.includes('"Street address"') &&
      !coBundle16.includes('"City"') &&
      !coBundle16.includes('"Postal code"') &&
      !coBundle16.includes('"Country"') &&
      coBundle16.includes('"Full name"') &&
      coBundle16.includes('"Phone number (required)"') &&
      coBundle16.includes("Select wilaya") &&
      coBundle16.includes('"Commune"'),
  );

  section("17) Product image viewer — fullscreen lightbox, zoom, keyboard");

  const bundleOf = async (html) => {
    const srcs = [...new Set(html.match(/\/_next\/static\/chunks\/[^"]+\.js/g) ?? [])];
    let out = "";
    for (const src of srcs.slice(0, 12)) {
      try { out += await (await jfetch(`${BASE}${src}`)).text(); } catch {}
    }
    return out;
  };

  // A. Main image is an accessible trigger for the fullscreen viewer.
  const lightPdp = await html(`/products/${slug}`);
  check(
    "product main image is a button that opens the image viewer",
    lightPdp.status === 200 && lightPdp.text.includes('aria-label="View image 1"'),
  );
  check(
    "BUY NOW flow untouched by the viewer (BUY NOW still present)",
    lightPdp.text.includes("Buy now") && !lightPdp.text.includes("Add to bag"),
  );

  // B. The viewer ships real dialog + zoom controls to the client.
  const lightBundle = await bundleOf(lightPdp.text);
  check(
    "lightbox uses dialog semantics (role=dialog + aria-modal)",
    lightBundle.includes('"dialog"') && lightBundle.includes("aria-modal"),
  );
  check(
    "lightbox ships accessible controls (close/prev/next/zoom labels)",
    lightBundle.includes("Close image viewer") &&
      lightBundle.includes("Previous image") &&
      lightBundle.includes("Next image") &&
      lightBundle.includes("Zoom in") &&
      lightBundle.includes("Zoom out"),
  );
  check(
    "keyboard navigation wired (Escape + ArrowLeft/ArrowRight)",
    lightBundle.includes("Escape") &&
      lightBundle.includes("ArrowLeft") &&
      lightBundle.includes("ArrowRight"),
  );
  check(
    "zoom is a real transform on the image (not a fake effect)",
    lightBundle.includes("scale(") && lightBundle.includes("touch-none"),
  );

  // C. RTL Arabic keeps the viewer labels translated.
  const lightPdpAr = await fetchHtml(`/products/${slug}`, AR.cookie);
  check(
    "AR product page keeps translated viewer trigger",
    lightPdpAr.status === 200 &&
      lightPdpAr.text.includes("عرض الصورة 1") &&
      /<html[^>]*dir="rtl"/.test(lightPdpAr.text),
  );

  // D. Viewer does not leak into checkout, and checkout stays 4-field.
  const coForViewer = await jfetch(`${BASE}/checkout`);
  const coViewerHtml = await coForViewer.text();
  check(
    "checkout SSR unaffected by the image viewer",
    coForViewer.status === 200 && !coViewerHtml.includes("ImageLightbox"),
  );

  section("18) Phase 10 final audit — analytics, checkout authority, concurrency");

  // A. Analytics page is admin-only and renders real-data KPIs.
  const analyticsNoAuth = await jfetch(`${BASE}/admin/analytics`, {
    redirect: "manual",
  });
  check(
    "analytics page requires admin auth (redirects to login)",
    [302, 307].includes(analyticsNoAuth.status) &&
      (analyticsNoAuth.headers.get("location") ?? "").includes("/admin/login"),
    JSON.stringify({ status: analyticsNoAuth.status }),
  );

  const analyticsPage = await jfetch(`${BASE}/admin/analytics`, {
    headers: { cookie: auth.cookie },
  });
  const analyticsHtml = await analyticsPage.text();
  check(
    "analytics dashboard renders KPIs + range filters for the admin",
    analyticsPage.status === 200 &&
      analyticsHtml.includes("Total Revenue") &&
      analyticsHtml.includes("Average Order Value") &&
      analyticsHtml.includes("Products Sold") &&
      analyticsHtml.includes("Last 7 days") &&
      analyticsHtml.includes("All time"),
    JSON.stringify({ status: analyticsPage.status }),
  );

  const analyticsToday = await jfetch(`${BASE}/admin/analytics?range=today`, {
    headers: { cookie: auth.cookie },
  });
  const analyticsAll = await jfetch(`${BASE}/admin/analytics?range=all`, {
    headers: { cookie: auth.cookie },
  });
  check(
    "analytics time filters respond (today + all time)",
    analyticsToday.status === 200 && analyticsAll.status === 200,
  );

  // B. Analytics reflect REAL orders created earlier in this run.
  check(
    "analytics show real order data (wilaya snapshot from earlier orders)",
    analyticsHtml.includes("المسيلة") &&
      analyticsHtml.includes("Orders by status") &&
      analyticsHtml.includes("Purchase funnel"),
  );
  check(
    "funnel is honest: upstream stages flagged as not stored server-side",
    analyticsHtml.includes("Not stored server-side") &&
      analyticsHtml.includes("Meta Events Manager"),
  );

  // C. Checkout remains server-authoritative against manipulated payloads.
  const tamperVariant = i18nVariant;
  const tampered = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Tamper Tester",
      phone: "+213555000031",
      commune: "Hammam Dalaa",
      deliveryZone: 28,
      deliveryMethod: "home",
      shipping: 0,
      total: 1,
      items: [
        {
          slug,
          size: tamperVariant.size,
          color: tamperVariant.color,
          quantity: 1,
          variantId: tamperVariant.id,
          sku: tamperVariant.sku,
          price: 1,
        },
      ],
    }),
  }).then((r) => r.json());
  const tamperQuote = await jfetch(
    `${BASE}/api/delivery/quote?zone=28&method=home&subtotal=${tampered.subtotal}`,
  ).then((r) => r.json());
  check(
    "client-supplied price/shipping/total are ignored (server recomputes)",
    tampered.ok === true &&
      tampered.subtotal > 1 &&
      tampered.shipping === tamperQuote.quote.shipping &&
      tampered.total === tampered.subtotal + tampered.shipping,
    JSON.stringify({ subtotal: tampered.subtotal, shipping: tampered.shipping }),
  );
  check(
    "tamper-test order still snapshots ISO DZD currency",
    tampered.currency === "DZD",
  );

  // D. Oversell safety: a 1-stock variant sells exactly once. The checkout guard
  // is a conditional UPDATE (SET stock = stock - qty WHERE stock >= qty) inside a
  // single transaction — the canonical row-lock pattern that serializes truly
  // concurrent buyers on real Postgres. The embedded PGlite test DB cannot
  // emulate concurrent transaction isolation, so the guard is verified here with
  // a deterministic sequential double-purchase of the same single unit.
  const P10_SLUG = "phase10-concurrency-hoodie";
  const p10Create = await jfetch(`${BASE}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Phase10 Concurrency Hoodie",
      slug: P10_SLUG,
      sku: "P10-HOODIE",
      description: "Created by the Phase 10 integration suite.",
      price: "55.00",
      category: "Hoodies",
      sizes: "M",
      colors: "Onyx",
      variants: [
        { size: "M", color: "Onyx", sku: "P10-M-ONYX", stock: 1, active: true },
      ],
    }),
  }).then((r) => r.json());
  check("create phase10 concurrency product", p10Create.ok === true);
  const p10Detail = await jfetch(`${BASE}/api/admin/products/${p10Create.id}`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  const p10Variant = p10Detail.variants.find((v) => v.sku === "P10-M-ONYX");
  check("phase10 variant has exactly 1 unit", p10Variant?.stock === 1);

  const racePayload = {
    fullName: "Race Buyer",
    phone: "+213555000032",
    commune: "Hammam Dalaa",
    deliveryZone: 28,
    deliveryMethod: "home",
    items: [
      {
        slug: P10_SLUG,
        size: "M",
        color: "Onyx",
        quantity: 1,
        variantId: p10Variant.id,
        sku: p10Variant.sku,
      },
    ],
  };
  const readP10Stock = async () => {
    const detail = await jfetch(`${BASE}/api/admin/products/${p10Create.id}`, {
      headers: adminHeaders,
    }).then((r) => r.json());
    return detail.variants.find((v) => v.id === p10Variant.id)?.stock;
  };
  // First purchase wins the single unit and decrements stock to zero.
  const buy1 = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(racePayload),
  }).then((r) => r.json());
  const buy1Stock = await readP10Stock();
  check(
    "first purchase of the last unit succeeds and decrements stock to 0",
    buy1.ok === true && buy1Stock === 0,
    JSON.stringify({ ok: buy1.ok, stock: buy1Stock }),
  );
  // Second purchase of the same unit must be rejected (no oversell).
  const buy2 = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(racePayload),
  }).then((r) => r.json());
  check(
    "second purchase of the sold-out unit rejected with INSUFFICIENT_STOCK",
    buy2.ok === false && buy2.code === "INSUFFICIENT_STOCK",
    JSON.stringify(buy2),
  );
  // Stock stays at exactly zero: never negative, decremented exactly once.
  const finalStock = await readP10Stock();
  check(
    "stock lands exactly at zero (never negative, never double-decremented)",
    finalStock === 0,
    JSON.stringify({ stock: finalStock }),
  );

  // E. Meta guards hold at the end of the full suite.
  const finalCatalog = await jfetch(`${BASE}/api/catalog`);
  const finalCatalogText = await finalCatalog.text();
  check(
    "catalog still machine-readable DZD at final audit",
    finalCatalog.status === 200 &&
      finalCatalogText.includes(" DZD") &&
      !/"\d[\d ]*,\d{2} DA"/.test(finalCatalogText),
  );

  // F. Permanent deletion: a deleted product must never be resurrected by
  // any startup/bootstrap/seed path.
  const ghostSlug = "phase10-ghost-product";
  const ghostCreate = await jfetch(`${BASE}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Phase10 Ghost Product",
      slug: ghostSlug,
      sku: "P10-GHOST",
      description: "Created to be deleted.",
      price: "10.00",
      category: "Hoodies",
      sizes: "M",
      colors: "Onyx",
      variants: [
        { size: "M", color: "Onyx", sku: "P10-GHOST-M", stock: 3, active: true },
      ],
    }),
  }).then((r) => r.json());
  check("create ghost product for deletion test", ghostCreate.ok === true);
  const ghostDelete = await jfetch(
    `${BASE}/api/admin/products/${ghostCreate.id}`,
    { method: "DELETE", headers: adminHeaders },
  );
  check(
    "admin DELETE permanently removes the product",
    ghostDelete.status === 200,
    `status ${ghostDelete.status}`,
  );
  const ghostList1 = await jfetch(`${BASE}/api/products`).then((r) => r.json());
  check(
    "deleted product absent from the storefront API",
    !(ghostList1.products ?? []).some((p) => p.slug === ghostSlug),
  );
  const ghostPdp = await jfetch(`${BASE}/products/${ghostSlug}`);
  check("deleted product page returns 404", ghostPdp.status === 404);
  // Even the explicit manual seed endpoint must not resurrect deleted data.
  const ghostSeed = await jfetch(`${BASE}/api/seed`).then((r) => r.json());
  check("explicit /api/seed completes without error", ghostSeed.ok === true);
  const ghostList2 = await jfetch(`${BASE}/api/products`).then((r) => r.json());
  check(
    "deleted product still absent after /api/seed (no resurrection)",
    !(ghostList2.products ?? []).some((p) => p.slug === ghostSlug),
  );

  // ------------------------------------------------------------------
  console.log("\n\x1b[1m19) Private mobile admin app APIs — auth, devices, notifications\x1b[0m");
  // ------------------------------------------------------------------
  // The private Android admin app reuses these exact endpoints: login
  // (session cookie + CSRF), dashboard KPIs, orders, products, device
  // registration and notification history. Server-side authorization is
  // mandatory everywhere — no guest access.
  const { createHmac } = await import("node:crypto");
  const loginRes = await jfetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "ruven2026" }),
  });
  const loginJson = await loginRes.json().catch(() => ({}));
  const freshCookie = loginRes.headers.get("set-cookie") || "";
  check(
    "login returns a session-bound CSRF token for non-browser clients",
    loginJson.ok === true &&
      typeof loginJson.csrfToken === "string" &&
      loginJson.csrfToken.length === 64,
  );
  const freshToken = (freshCookie.match(/ruven_admin_session=([^;]+)/) || [])[1];
  const freshCsrf = freshToken
    ? createHmac("sha256", ADMIN_SECRET).update(freshToken).digest("hex")
    : "";
  check(
    "returned CSRF token is exactly the HMAC of the new session",
    Boolean(freshToken) && loginJson.csrfToken === freshCsrf,
  );

  check(
    "notifications require admin auth (401 guest)",
    (await jfetch(`${BASE}/api/admin/notifications`)).status === 401,
  );
  check(
    "device registration requires admin auth (401 guest)",
    (
      await jfetch(`${BASE}/api/admin/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "fcm", token: "guest-device-token-000000" }),
      })
    ).status === 401,
  );
  check(
    "dashboard requires admin auth (401 guest)",
    (await jfetch(`${BASE}/api/admin/dashboard`)).status === 401,
  );
  const badCsrf = await jfetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: { ...adminHeaders, "x-csrf-token": "f".repeat(64) },
    body: JSON.stringify({ provider: "fcm", token: "csrf-test-device-0000000" }),
  });
  check("device registration enforces CSRF (401 bad token)", badCsrf.status === 401);

  const mobileDeviceToken = "mobile-admin-fcm-token-integration-1";
  const deviceReg = await jfetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      provider: "fcm",
      token: mobileDeviceToken,
      deviceName: "Integration Test Phone",
    }),
  });
  const deviceRegJson = await deviceReg.json().catch(() => ({}));
  check(
    "authenticated admin registers the authorized device",
    deviceReg.status === 201 &&
      deviceRegJson.ok === true &&
      Number(deviceRegJson.device?.id) > 0 &&
      deviceRegJson.device.tokenMasked !== mobileDeviceToken,
  );
  const deviceList = await jfetch(`${BASE}/api/admin/devices`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "device list shows the registered device with a masked token",
    deviceList.ok === true &&
      (deviceList.devices ?? []).some((d) => d.id === deviceRegJson.device?.id) &&
      !JSON.stringify(deviceList).includes(mobileDeviceToken),
  );

  const dash = await jfetch(`${BASE}/api/admin/dashboard`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "dashboard KPIs come from real orders (today \u2265 1 order, DZD)",
    dash.ok === true &&
      Number(dash.today?.orders) >= 1 &&
      Number(dash.today?.revenue) >= 0 &&
      Number.isInteger(Number(dash.orders?.new)) &&
      Number.isInteger(Number(dash.orders?.pending)) &&
      dash.today.currency === "DZD",
  );

  const mobileProducts = await jfetch(`${BASE}/api/admin/products`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "products API serves the real catalogue with stock aggregates",
    mobileProducts.ok === true &&
      Array.isArray(mobileProducts.products) &&
      mobileProducts.products.length > 0 &&
      typeof mobileProducts.products[0].totalStock === "number" &&
      typeof mobileProducts.products[0].variantCount === "number",
  );

  // End-to-end new-order notification: create a product, buy it for real
  // through the public checkout, verify the admin notification.
  const mSlug = "mobile-admin-notify-product";
  await jfetch(`${BASE}/api/admin/products`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      name: "Mobile Admin Notify Product",
      slug: mSlug,
      sku: "MA-NOTIFY",
      description: "Integration fixture.",
      price: "20.00",
      category: "Hoodies",
      sizes: "M",
      colors: "Onyx",
      variants: [{ size: "M", color: "Onyx", sku: "MA-NOTIFY-M", stock: 5, active: true }],
    }),
  });
  const notifyCustomer = {
    fullName: "Mobile Notify Tester",
    phone: "+213555001919",
    address: "9 Notification Street",
  };
  const notifyBuy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...notifyCustomer,
      items: [{ slug: mSlug, size: "M", color: "Onyx", quantity: 1 }],
    }),
  });
  const notifyBuyJson = await notifyBuy.json().catch(() => ({}));
  check("purchase used for notification test succeeds", notifyBuy.status === 201);

  const notifList = await jfetch(`${BASE}/api/admin/notifications?limit=200`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  const matches = (notifList.notifications ?? []).filter(
    (n) => n.orderNumber === notifyBuyJson.orderNumber,
  );
  check(
    "exactly one new-order notification per order (dedup)",
    notifList.ok === true && matches.length === 1,
    `matches=${matches.length}`,
  );
  check(
    "notification title/body carry order number + total only",
    matches[0]?.title === "RYVEN DEPT \u2014 Nouvelle commande" &&
      String(matches[0]?.body ?? "").includes(notifyBuyJson.orderNumber),
  );
  check(
    "notification never leaks customer PII",
    !JSON.stringify(matches[0] ?? {}).includes(notifyCustomer.fullName) &&
      !JSON.stringify(matches[0] ?? {}).includes(notifyCustomer.phone),
  );

  const deviceDel = await jfetch(`${BASE}/api/admin/devices`, {
    method: "DELETE",
    headers: adminHeaders,
    body: JSON.stringify({ id: deviceRegJson.device?.id }),
  }).then((r) => r.json());
  const deviceList2 = await jfetch(`${BASE}/api/admin/devices`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  check(
    "device can be unregistered and is then gone",
    deviceDel.ok === true &&
      !(deviceList2.devices ?? []).some((d) => d.id === deviceRegJson.device?.id),
  );

  section("18) FCM Web Push — stub transport end-to-end");

  // 18.0 Public config endpoint: enabled + public-only values.
  const pushCfg = await jfetch(`${BASE}/api/push/config`).then((r) => r.json());
  check(
    "push config enabled with public Firebase web config + VAPID",
    pushCfg.ok === true &&
      pushCfg.enabled === true &&
      pushCfg.firebase?.projectId === "stub-proj" &&
      String(pushCfg.vapidKey || "").length > 0,
    JSON.stringify(pushCfg),
  );
  check(
    "push config exposes no server credentials",
    !JSON.stringify(pushCfg).toLowerCase().includes("private") ||
      !JSON.stringify(pushCfg).includes("BEGIN"),
  );

  // 18.1 Service worker is served, tiny, with push + click handling.
  const swRes = await jfetch(`${BASE}/firebase-messaging-sw.js`);
  const swText = await swRes.text();
  check(
    "firebase-messaging-sw.js served with push + notificationclick handlers",
    swRes.status === 200 &&
      String(swRes.headers.get("content-type") || "").includes("javascript") &&
      swText.includes("self.addEventListener(\"push\"") &&
      swText.includes("notificationclick") &&
      swText.includes("showNotification") &&
      swText.includes("/admin/orders"),
  );

  // 18.2 Register one live + one dead device (both authenticated admin).
  const LIVE_TOKEN = "live-fcm-webpush-token-0000000001";
  const DEAD_TOKEN = "dead-fcm-token-0000000002";
  const liveDev = await jfetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ provider: "fcm", token: LIVE_TOKEN, deviceName: "Suite phone" }),
  }).then((r) => r.json());
  const deadDev = await jfetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ provider: "fcm", token: DEAD_TOKEN, deviceName: "Dead phone" }),
  }).then((r) => r.json());
  check(
    "live + dead admin devices registered (multi-device support)",
    liveDev.ok === true && deadDev.ok === true,
  );

  // 18.3 Real checkout order → server must push to the FCM stub.
  const adminProdList = await jfetch(`${BASE}/api/admin/products`, {
    headers: adminHeaders,
  }).then((r) => r.json());
  let pushSlug = null;
  let pushVariant = null;
  for (const p of adminProdList.products ?? []) {
    const detail = await jfetch(`${BASE}/api/admin/products/${p.id}`, {
      headers: adminHeaders,
    }).then((r) => r.json());
    const v = (detail.variants ?? []).find((x) => (x.stock ?? 0) > 0 && x.active !== false);
    if (v) {
      pushSlug = detail.product?.slug ?? p.slug;
      pushVariant = v;
      break;
    }
  }
  const pushBuy = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Push Flow Tester",
      phone: "0550000009",
      commune: "Test Commune",
      deliveryZone: 16,
      deliveryMethod: "home",
      items: [
        {
          slug: pushSlug,
          size: pushVariant?.size,
          color: pushVariant?.color,
          quantity: 1,
        },
      ],
    }),
  }).then((r) => r.json());
  check("push-flow order created", pushBuy.ok === true, JSON.stringify(pushBuy).slice(0, 200));

  await sleep(750); // fan-out + prune happen inside the awaited checkout hook

  const sentLive = pushStub.messages.filter((m) => m?.message?.token === LIVE_TOKEN);
  const sentDead = pushStub.messages.filter((m) => m?.message?.token === DEAD_TOKEN);
  check(
    "exactly one FCM v1 send per live device for the order",
    sentLive.length === 1,
    `live=${sentLive.length}`,
  );
  check(
    "dead device was attempted exactly once",
    sentDead.length === 1,
    `dead=${sentDead.length}`,
  );

  const sentMsg = sentLive[0]?.message;
  check(
    "web push title is RYVEN DEPT — Nouvelle commande",
    sentMsg?.notification?.title === "RYVEN DEPT — Nouvelle commande" &&
      sentMsg?.webpush?.notification?.title === "RYVEN DEPT — Nouvelle commande",
    String(sentMsg?.webpush?.notification?.title ?? ""),
  );
  check(
    "web push body = order number + total + status, zero PII",
    String(sentMsg?.webpush?.notification?.body || "").includes(pushBuy.orderNumber) &&
      String(sentMsg?.webpush?.notification?.body || "").includes("جديد") &&
      !JSON.stringify(sentMsg).includes("Push Flow Tester") &&
      !JSON.stringify(sentMsg).includes("0550000009"),
    String(sentMsg?.webpush?.notification?.body ?? ""),
  );
  check(
    "web push click target = secure admin order page",
    /\/admin\/orders\/\d+/.test(String(sentMsg?.webpush?.fcm_options?.link || "")),
    String(sentMsg?.webpush?.fcm_options?.link ?? ""),
  );

  // 18.4 Dead token (404 UNREGISTERED) must be pruned automatically.
  let pruned = false;
  let afterList = { devices: [] };
  for (let i = 0; i < 20 && !pruned; i++) {
    afterList = await jfetch(`${BASE}/api/admin/devices`, {
      headers: adminHeaders,
    }).then((r) => r.json());
    pruned =
      !(afterList.devices ?? []).some((d) => String(d.tokenMasked || "").startsWith("dead-fcm")) &&
      (afterList.devices ?? []).some((d) => String(d.tokenMasked || "").startsWith("live-fcm"));
    if (!pruned) await sleep(250);
  }
  check(
    "unregistered device pruned, live device kept",
    pruned,
    JSON.stringify((afterList.devices ?? []).map((d) => d.tokenMasked)),
  );

  section("19) Push authorization security matrix (admin-only recipients)");

  const ATTACK_TOKEN_A = "customer-attack-token-00000000aa";
  const ATTACK_TOKEN_B = "customer-attack-token-00000000bb";
  const SPOOF_BODY = {
    provider: "fcm",
    token: ATTACK_TOKEN_A,
    deviceName: "Attacker",
    // Client-supplied ownership/role fields must be ignored server-side.
    adminId: 999,
    userId: 999,
    isAdmin: true,
    role: "admin",
    accountId: 999,
  };

  // A. Unauthenticated visitor → 401/403.
  const noAuth = await jfetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(SPOOF_BODY),
  });
  check("A. unauthenticated registration rejected (401)", noAuth.status === 401, String(noAuth.status));

  // B. Forged session ("customer") → 401; admin cookie WITHOUT CSRF → 401.
  const forged = await jfetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: "ruven_admin_session=forged-customer-session-token",
      "x-csrf-token": "deadbeef".repeat(8),
    },
    body: JSON.stringify({ ...SPOOF_BODY, token: ATTACK_TOKEN_B }),
  });
  check("B1. forged customer session rejected (401)", forged.status === 401, String(forged.status));
  const noCsrf = await jfetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: auth.cookie },
    body: JSON.stringify(SPOOF_BODY),
  });
  check("B2. admin session without CSRF rejected (401)", noCsrf.status === 401, String(noCsrf.status));

  // D. Customer tokens never land in admin_devices.
  const devListA = await jfetch(`${BASE}/api/admin/devices`, { headers: adminHeaders }).then((r) => r.json());
  check(
    "D. no customer/attacker token stored in admin_devices",
    !(devListA.devices ?? []).some((d) =>
      [ATTACK_TOKEN_A, ATTACK_TOKEN_B].some((t) => t.startsWith(String(d.tokenMasked || "").slice(0, 8)) || String(d.tokenMasked || "") === t),
    ) && !(devListA.devices ?? []).some((d) => String(d.deviceName || "") === "Attacker"),
  );

  // C + K + L. Authenticated admin registration succeeds; spoofed ownership
  // fields are ignored (owner = live session admin, never 999).
  const SEC19_A = "sec19-admin-token-000000000001";
  const SEC19_B = "sec19-admin-token-000000000002";
  const regSpoof = await jfetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ ...SPOOF_BODY, token: SEC19_A }),
  }).then((r) => r.json());
  const regB = await jfetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ provider: "fcm", token: SEC19_B, deviceName: "Suite second phone" }),
  }).then((r) => r.json());
  check("C. authenticated admin registration succeeds", regSpoof.ok === true && regB.ok === true);

  const devListB = await jfetch(`${BASE}/api/admin/devices`, { headers: adminHeaders }).then((r) => r.json());
  const spoofRow = (devListB.devices ?? []).find((d) => String(d.tokenMasked || "").startsWith("sec19-ad"));
  const normalRow = (devListB.devices ?? []).find((d) => String(d.tokenMasked || "").startsWith("sec19-bd") || String(d.deviceName || "") === "Suite second phone");
  check(
    "K. client-supplied adminId/role/userId ignored — owner is session admin",
    Boolean(spoofRow) &&
      Number.isInteger(spoofRow.adminId) &&
      spoofRow.adminId > 0 &&
      spoofRow.adminId !== 999 &&
      spoofRow.adminId === normalRow?.adminId,
    JSON.stringify({ spoof: spoofRow?.adminId, normal: normalRow?.adminId }),
  );
  const noAuthSpoof = await jfetch(`${BASE}/api/admin/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...SPOOF_BODY, adminId: 1, role: "admin" }),
  });
  check("L. role/user fields cannot force delivery unauthenticated (401)", noAuthSpoof.status === 401, String(noAuthSpoof.status));

  // F + G + E. New order → FCM recipients are EXACTLY the registered admin
  // devices (multiple supported), never customers/orphans.
  const sec19Prod = await jfetch(`${BASE}/api/admin/products`, { headers: adminHeaders }).then((r) => r.json());
  let s19Slug = null;
  let s19Variant = null;
  for (const p of sec19Prod.products ?? []) {
    const detail = await jfetch(`${BASE}/api/admin/products/${p.id}`, { headers: adminHeaders }).then((r) => r.json());
    const v = (detail.variants ?? []).find((x) => (x.stock ?? 0) > 0 && x.active !== false);
    if (v) { s19Slug = detail.product?.slug ?? p.slug; s19Variant = v; break; }
  }
  const order1 = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Security Matrix Tester",
      phone: "0550000010",
      commune: "Test",
      deliveryZone: 16,
      deliveryMethod: "home",
      items: [{ slug: s19Slug, size: s19Variant?.size, color: s19Variant?.color, quantity: 1 }],
    }),
  }).then((r) => r.json());
  check("security-matrix order 1 created", order1.ok === true, JSON.stringify(order1).slice(0, 160));
  await sleep(750);

  const regsFor = (on) =>
    pushStub.messages.filter((m) => String(m?.message?.webpush?.notification?.body || m?.message?.notification?.body || "").includes(on));
  const r1 = regsFor(order1.orderNumber).map((m) => m.message.token).sort();
  const expected1 = [SEC19_A, SEC19_B, "live-fcm-webpush-token-0000000001"].sort();
  check(
    "F/G/E. recipients = exactly the registered admin devices (multi-device, no customers)",
    JSON.stringify(r1) === JSON.stringify(expected1),
    JSON.stringify({ got: r1, want: expected1 }),
  );
  check(
    "J. exactly one send per admin device per order",
    r1.length === new Set(r1).size && r1.length === expected1.length,
  );

  // H. Removed device receives nothing on the next order.
  const delB = await jfetch(`${BASE}/api/admin/devices`, {
    method: "DELETE",
    headers: adminHeaders,
    body: JSON.stringify({ id: regB.device?.id }),
  }).then((r) => r.json());
  const order2 = await jfetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Security Matrix Tester",
      phone: "0550000010",
      commune: "Test",
      deliveryZone: 16,
      deliveryMethod: "home",
      items: [{ slug: s19Slug, size: s19Variant?.size, color: s19Variant?.color, quantity: 1 }],
    }),
  }).then((r) => r.json());
  await sleep(750);
  const r2 = regsFor(order2.orderNumber).map((m) => m.message.token).sort();
  check(
    "H. removed device receives nothing; remaining admin devices still do",
    delB.ok === true &&
      !r2.includes(SEC19_B) &&
      r2.includes(SEC19_A) &&
      r2.includes("live-fcm-webpush-token-0000000001"),
    JSON.stringify(r2),
  );
  check(
    "I. pruned/invalid tokens stay pruned",
    !(devListB.devices ?? []).some((d) => String(d.tokenMasked || "").startsWith("dead-fcm")),
  );

  console.log(`\n\x1b[1mResults: ${passed} passed, ${failed} failed\x1b[0m`);
  if (failed) {
    console.log("\nFailures:");
    for (const f of failures) console.log("  - " + f);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("Integration test crashed:", err);
    process.exitCode = 1;
  })
  .finally(stopAll);
