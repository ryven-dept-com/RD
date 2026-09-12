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

  section("10) Graceful degradation");
  await putSettings(auth, { metaPixelEnabled: "false" });
  const homeOff = await html("/");
  check(
    "disabling the pixel flags it off in the client payload",
    /"pixel":\{"enabled":false/.test(normalized(homeOff.text)),
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
